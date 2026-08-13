#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>
#include <mbedtls/md.h>

/*
  HORIZON - Gateway node

  Role:
  - Receive raw JSON readings from Station 1 and Station 2 through SX1278 LoRa UART.
  - Reshape each reading into the standard signed ingestion contract
    (services/edge-ingestion/src/types.ts TelemetryPayloadV1) and relay it,
    HMAC-signed with THIS gateway's own device secret, to the edge-ingest
    function. Stations have no clock and no HMAC code of their own — the
    gateway is the only device with real network time and enough headroom
    for crypto, so it does both on their behalf. See
    docs/ARCHITECTURE_DECISIONS.md for why.
  - Store every packet on microSD for backup and automatic retry.

  Important:
  - The gateway does not calculate agricultural/environment thresholds.
  - The webserver stores the raw observation and calculates dashboard values,
    daily comparison tables, warnings, and recommendations.
  - The gateway does NOT invent battery_voltage / signal_strength_dbm for a
    station it's relaying — it has no way to honestly measure those for a
    remote device. Those fields are simply omitted (they're optional in the
    contract for exactly this reason).

  Expected station payload examples (see trạm 1.ino / trạm 2.ino):
  - Station 1: station_id, message_id, firmware_version, water_level_cm,
               salinity_ppt, ultrasonic_status, ec_status
  - Station 2: station_id, message_id, firmware_version, soil_*, advice

  NOT VERIFIED AGAINST REAL HARDWARE — confirm before field deployment:
  - AT+CCLK? response format (module/firmware-specific; parser below
    assumes SIMCom-style `+CCLK: "YY/MM/DD,HH:MM:SS+TZ"`).
  - Whether AT+HTTPPARA="USERDATA" can be called multiple times to add
    multiple header lines (assumed here; some modules only keep the last
    call's value, which would break this — if so, the fallback is to move
    x-device-id/x-timestamp/x-signature/x-contract-version into the JSON
    body instead of HTTP headers, which requires a matching edge-ingest
    change).
  - mbedtls HMAC-SHA256 usage (standard ESP32 Arduino core API, but never
    run on this project's actual board).
  - LoRa UART transparent-mode framing between stations and gateway.

  TODO:
  - Set EDGE_INGEST_URL to your deployed Supabase Function URL.
  - Set GATEWAY_DEVICE_SECRET to match the `devices` table row for GATEWAY_01
    (see infra/supabase/seed/pilot_seed.sql for the dev/pilot value).
  - Set SIM_APN for the SIM provider.
  - Confirm SIM module model and HTTP AT command support.
  - Confirm LoRa UART baud rate / transparent mode.
*/

static const char *GATEWAY_ID = "GATEWAY_01";
static const char *FIRMWARE_VERSION = "gateway-4g-0.2.0";
static const char *CONTRACT_VERSION = "v1";

// Replace with your deployed Supabase Edge Function URL, e.g.
// https://YOUR_PROJECT_REF.supabase.co/functions/v1/edge-ingest
static const char *EDGE_INGEST_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/edge-ingest";
static const char *CONFIG_URL = "https://example.com/api/public/gateway/configs";
// Must match this gateway's device_secret row in the `devices` table.
// Dev/pilot placeholder — see infra/supabase/seed/pilot_seed.sql.
static const char *GATEWAY_DEVICE_SECRET = "gateway-secret-01";
static const char *SIM_APN = "internet";
static const char *SIM_USER = "";
static const char *SIM_PASS = "";

static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t LORA_UART_BAUD = 9600;
static const uint32_t MODEM_BAUD = 115200;

// TODO: update these pins after wiring is finalized.
static const int LORA_UART_RX_PIN = 32;
static const int LORA_UART_TX_PIN = 33;

static const int MODEM_RX_PIN = 16;  // ESP32 RX, connect to SIM TX.
static const int MODEM_TX_PIN = 17;  // ESP32 TX, connect to SIM RX.
static const int MODEM_PWR_PIN = 4;  // Optional. Set to -1 if not used.

static const int SD_SCK_PIN = 18;
static const int SD_MISO_PIN = 19;
static const int SD_MOSI_PIN = 23;
static const int SD_CS_PIN = 5;

static const uint32_t MODEM_TIMEOUT_MS = 12000;
static const uint32_t HTTP_TIMEOUT_MS = 30000;
static const uint32_t RETRY_INTERVAL_MS = 20000;
static const uint32_t TIME_SYNC_INTERVAL_MS = 15UL * 60UL * 1000UL; // re-sync every 15 min
static const uint32_t DEFAULT_CONFIG_POLL_INTERVAL_MS = 60000;
static const uint32_t WATCHDOG_TIMEOUT_MS = 20000;
static const size_t MAX_LOG_FILE_BYTES = 1024UL * 1024UL;
static const char *PENDING_QUEUE_PATH = "/gateway_pending.jsonl";
static const char *PENDING_QUEUE_TMP_PATH = "/gateway_pending.tmp";

HardwareSerial loraSerial(1);
HardwareSerial modemSerial(2);
SPIClass sdSpi(VSPI);

static bool sdReady = false;
static bool modemReady = false;
static String loraLine;
static uint32_t lastRetryMs = 0;
static uint32_t lastConfigPollMs = 0;
static uint32_t lastTimeSyncMs = 0;
static uint32_t configPollIntervalMs = DEFAULT_CONFIG_POLL_INTERVAL_MS;
static uint32_t gatewaySleepIntervalMs = 0;

// Network-synced wall clock: epochAtSync + (millis() - millisAtSync) / 1000.
static long epochAtSync = 0;
static uint32_t millisAtSync = 0;
static bool timeSynced = false;

// ---------------------------------------------------------------------------
// Modem transport (unchanged AT-command plumbing)
// ---------------------------------------------------------------------------

String modemReadUntil(uint32_t timeoutMs) {
  String response;
  const uint32_t startedAt = millis();

  while (millis() - startedAt < timeoutMs) {
    while (modemSerial.available() > 0) {
      response += static_cast<char>(modemSerial.read());
    }
    if (response.indexOf("\r\nOK\r\n") >= 0 || response.indexOf("\r\nERROR\r\n") >= 0) {
      break;
    }
    delay(10);
  }

  return response;
}

bool sendAt(const String &command, const char *expected = "OK", uint32_t timeoutMs = MODEM_TIMEOUT_MS) {
  Serial.print("[MODEM] ");
  Serial.println(command);
  modemSerial.println(command);
  const String response = modemReadUntil(timeoutMs);
  Serial.println(response);
  return response.indexOf(expected) >= 0;
}

String sendAtCapture(const String &command, uint32_t timeoutMs = MODEM_TIMEOUT_MS) {
  Serial.print("[MODEM] ");
  Serial.println(command);
  modemSerial.println(command);
  const String response = modemReadUntil(timeoutMs);
  Serial.println(response);
  return response;
}

void setupWatchdog() {
  esp_task_wdt_config_t wdtConfig = {};
  wdtConfig.timeout_ms = WATCHDOG_TIMEOUT_MS;
  wdtConfig.idle_core_mask = (1 << portNUM_PROCESSORS) - 1;
  wdtConfig.trigger_panic = true;
  esp_task_wdt_init(&wdtConfig);
  esp_task_wdt_add(NULL);
}

void rotateLogIfNeeded(const char *path, const char *oldPath, size_t maxBytes) {
  if (!sdReady || !SD.exists(path)) {
    return;
  }

  File file = SD.open(path, FILE_READ);
  if (!file) {
    return;
  }
  const size_t size = file.size();
  file.close();

  if (size < maxBytes) {
    return;
  }

  if (SD.exists(oldPath)) {
    SD.remove(oldPath);
  }
  SD.rename(path, oldPath);
}

void powerOnModem() {
  if (MODEM_PWR_PIN < 0) {
    return;
  }

  pinMode(MODEM_PWR_PIN, OUTPUT);
  digitalWrite(MODEM_PWR_PIN, LOW);
  delay(1000);
  digitalWrite(MODEM_PWR_PIN, HIGH);
  delay(1500);
  digitalWrite(MODEM_PWR_PIN, LOW);
  delay(5000);
}

bool initModem() {
  modemSerial.begin(MODEM_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  delay(500);

  for (uint8_t attempt = 0; attempt < 5; attempt += 1) {
    if (sendAt("AT")) {
      break;
    }
    delay(1000);
  }

  if (!sendAt("ATE0")) return false;
  if (!sendAt("AT+CPIN?", "READY")) return false;
  if (!sendAt("AT+CSQ")) return false;
  if (!sendAt("AT+CREG?", "OK")) return false;
  if (!sendAt("AT+CGREG?", "OK")) return false;

  String apnCommand = "AT+CGDCONT=1,\"IP\",\"";
  apnCommand += SIM_APN;
  apnCommand += "\"";
  if (!sendAt(apnCommand)) return false;

  // Works on SIMCom-style modules such as SIM7600/A7670 families.
  sendAt("AT+NETCLOSE", "OK", 5000);
  if (!sendAt("AT+NETOPEN", "OK", 20000)) return false;

  return true;
}

void appendLine(const char *path, const String &line) {
  if (!sdReady) {
    return;
  }

  String oldPath = String(path);
  oldPath.replace(".log", ".old");
  rotateLogIfNeeded(path, oldPath.c_str(), MAX_LOG_FILE_BYTES);

  File file = SD.open(path, FILE_APPEND);
  if (!file) {
    Serial.print("[SD] Cannot open ");
    Serial.println(path);
    return;
  }

  file.println(line);
  file.close();
}

// ---------------------------------------------------------------------------
// Network time sync (AT+CCLK?) — see NOT VERIFIED note above.
// ---------------------------------------------------------------------------

long daysFromCivil(int y, int m, int d) {
  y -= m <= 2 ? 1 : 0;
  long era = (y >= 0 ? y : y - 399) / 400;
  unsigned yoe = static_cast<unsigned>(y - era * 400);
  unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097L + static_cast<long>(doe) - 719468L;
}

bool parseCclkResponse(const String &response, long &epochOut) {
  int start = response.indexOf("+CCLK: \"");
  if (start < 0) return false;
  start += 8;
  int end = response.indexOf("\"", start);
  if (end < 0 || end - start < 17) return false;

  String ts = response.substring(start, end);
  int year = 2000 + ts.substring(0, 2).toInt();
  int month = ts.substring(3, 5).toInt();
  int day = ts.substring(6, 8).toInt();
  int hour = ts.substring(9, 11).toInt();
  int minute = ts.substring(12, 14).toInt();
  int second = ts.substring(15, 17).toInt();

  int tzQuarterHours = 0;
  if (ts.length() > 17) {
    tzQuarterHours = ts.substring(17).toInt(); // toInt() handles the leading +/- sign
  }

  const long days = daysFromCivil(year, month, day);
  const long localSeconds = days * 86400L + hour * 3600L + minute * 60L + second;
  epochOut = localSeconds - static_cast<long>(tzQuarterHours) * 15L * 60L;
  return true;
}

bool syncNetworkTime() {
  if (!modemReady) {
    return false;
  }

  const String response = sendAtCapture("AT+CCLK?", 5000);
  long epoch = 0;
  if (!parseCclkResponse(response, epoch) || epoch < 1700000000L) {
    Serial.println("[TIME] AT+CCLK? did not return a usable time");
    return false;
  }

  epochAtSync = epoch;
  millisAtSync = millis();
  timeSynced = true;
  Serial.printf("[TIME] Synced epoch=%ld\n", epochAtSync);
  return true;
}

long currentEpochSeconds() {
  if (!timeSynced) {
    return 0;
  }
  return epochAtSync + static_cast<long>((millis() - millisAtSync) / 1000UL);
}

void maybeSyncTime() {
  if (timeSynced && millis() - lastTimeSyncMs < TIME_SYNC_INTERVAL_MS) {
    return;
  }
  lastTimeSyncMs = millis();

  if (!modemReady) {
    modemReady = initModem();
  }
  if (modemReady) {
    syncNetworkTime();
  }
}

// ---------------------------------------------------------------------------
// Minimal JSON field extraction (raw station lines are simple flat objects —
// no need for a full JSON parser).
// ---------------------------------------------------------------------------

String extractStringField(const String &json, const char *field) {
  String key = "\"";
  key += field;
  key += "\":\"";
  const int start = json.indexOf(key);
  if (start < 0) return "";
  const int valueStart = start + key.length();
  const int valueEnd = json.indexOf("\"", valueStart);
  if (valueEnd < 0) return "";
  return json.substring(valueStart, valueEnd);
}

// Returns NAN if the field is absent OR explicitly null (stations send
// `null` for a field their sensor couldn't read — never treat that as 0).
float extractNumberField(const String &json, const char *field) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = json.indexOf(key);
  if (start < 0) return NAN;

  int valueStart = start + key.length();
  if (json.startsWith("null", valueStart)) {
    return NAN;
  }

  int valueEnd = valueStart;
  while (valueEnd < json.length() &&
         (isDigit(json[valueEnd]) || json[valueEnd] == '-' || json[valueEnd] == '.')) {
    valueEnd += 1;
  }
  if (valueEnd == valueStart) return NAN;
  return json.substring(valueStart, valueEnd).toFloat();
}

// Maps this project's internal firmware fault-reason strings to the
// contract's 3-value enum ("ok" | "warn" | "fault") — see
// services/edge-ingestion/src/types.ts SensorStatusValue. The detailed
// internal reason is still logged locally for diagnostics; it just isn't
// part of the wire contract.
String mapSensorStatus(const String &internalStatus) {
  if (internalStatus == "ok") return "ok";
  if (internalStatus == "warn") return "warn";
  if (internalStatus.length() == 0) return "fault";
  return "fault"; // checksum_error, timeout, out_of_range, pending_ec_protocol, i2c_error, modbus_error, ...
}

// Every string field currently placed into JSON by this file (station_id,
// message_id, mapped sensor status, firmware_version) is either a fixed
// firmware constant or drawn from mapSensorStatus()'s closed 3-value set —
// none of it is free-form or sensor-derived text today, so it can't contain
// '"' or control characters in practice. This helper exists so that stays
// true if a future field (e.g. a soil-sensor reading label) is added here
// without someone having to remember to think about escaping at that point.
String escapeJsonString(const String &value) {
  String result;
  result.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); i += 1) {
    const char c = value.charAt(i);
    if (c == '"' || c == '\\') {
      result += '\\';
      result += c;
    } else if (c == '\n') {
      result += "\\n";
    } else if (c == '\r') {
      result += "\\r";
    } else if (c == '\t') {
      result += "\\t";
    } else if (static_cast<unsigned char>(c) < 0x20) {
      // Other control characters — skip rather than emit invalid JSON.
      continue;
    } else {
      result += c;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Contract signing — must match services/edge-ingestion/src/canonical.ts
// buildCanonicalString()/signPayload() exactly, field-for-field, or the
// backend's recomputed signature will never match.
// ---------------------------------------------------------------------------

String fmtNumber(double value) {
  if (isnan(value)) {
    return "";
  }
  if (value == static_cast<long>(value)) {
    return String(static_cast<long>(value));
  }
  String s = String(value, 3);
  while (s.endsWith("0")) {
    s.remove(s.length() - 1);
  }
  if (s.endsWith(".")) {
    s.remove(s.length() - 1);
  }
  return s;
}

String buildCanonicalString(
  const String &deviceId,
  const String &messageId,
  long timestamp,
  float salinity,
  float waterLevel,
  int faultFlags,
  const String &ecStatus,
  const String &ultrasonicStatus,
  const String &firmwareVersion
) {
  String result;
  result.reserve(160);
  result += deviceId;
  result += "|";
  result += messageId;
  result += "|";
  result += String(timestamp);
  result += "|";
  result += fmtNumber(salinity);
  result += "|";
  result += fmtNumber(waterLevel);
  result += "|";
  result += String(faultFlags);
  result += "|";
  result += ecStatus;
  result += "|";
  result += ultrasonicStatus;
  result += "|"; // battery_voltage — omitted (not measurable for a relayed station)
  result += "|"; // signal_strength_dbm — omitted
  result += firmwareVersion;
  result += "|";
  result += CONTRACT_VERSION;
  return result;
}

String hmacSha256Hex(const String &data, const String &secret) {
  unsigned char hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_setup(&ctx, info, 1); // 1 = use HMAC
  mbedtls_md_hmac_starts(&ctx, reinterpret_cast<const unsigned char *>(secret.c_str()), secret.length());
  mbedtls_md_hmac_update(&ctx, reinterpret_cast<const unsigned char *>(data.c_str()), data.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  static const char *hexChars = "0123456789abcdef";
  String hex;
  hex.reserve(64);
  for (int i = 0; i < 32; i += 1) {
    hex += hexChars[(hmacResult[i] >> 4) & 0xF];
    hex += hexChars[hmacResult[i] & 0xF];
  }
  return hex;
}

String buildContractPayloadJson(
  const String &deviceId,
  const String &messageId,
  long timestamp,
  float salinity,
  float waterLevel,
  int faultFlags,
  const String &ecStatus,
  const String &ultrasonicStatus,
  const String &firmwareVersion
) {
  String json;
  json.reserve(320);
  json += "{\"contract_version\":\"";
  json += CONTRACT_VERSION;
  json += "\",\"device_id\":\"";
  json += escapeJsonString(deviceId);
  json += "\",\"message_id\":\"";
  json += escapeJsonString(messageId);
  json += "\",\"timestamp\":";
  json += String(timestamp);
  json += ",\"salinity\":";
  json += isnan(salinity) ? "null" : fmtNumber(salinity);
  json += ",\"water_level\":";
  json += isnan(waterLevel) ? "null" : fmtNumber(waterLevel);
  json += ",\"fault_flags\":";
  json += String(faultFlags);
  json += ",\"sensor_status\":{\"ec_probe\":\"";
  json += escapeJsonString(ecStatus);
  json += "\",\"ultrasonic\":\"";
  json += escapeJsonString(ultrasonicStatus);
  json += "\"},\"firmware_version\":\"";
  json += escapeJsonString(firmwareVersion);
  json += "\"}";
  return json;
}

// Soil-kind (Trạm 2) canonical string — must match
// services/edge-ingestion/src/canonical.ts buildSoilCanonicalString()
// exactly. Deliberately a separate format from buildCanonicalString above,
// not an extension of it — see that TS function's comment for why.
String buildSoilCanonicalString(
  const String &deviceId,
  const String &messageId,
  long timestamp,
  float airTempC,
  float airHumidityPct,
  float soilTempC,
  float soilMoisturePct,
  float soilEcMsCm,
  float soilPh,
  int faultFlags,
  const String &firmwareVersion
) {
  String result;
  result.reserve(180);
  result += deviceId;
  result += "|";
  result += messageId;
  result += "|";
  result += String(timestamp);
  result += "|soil|";
  result += fmtNumber(airTempC);
  result += "|";
  result += fmtNumber(airHumidityPct);
  result += "|";
  result += fmtNumber(soilTempC);
  result += "|";
  result += fmtNumber(soilMoisturePct);
  result += "|";
  result += fmtNumber(soilEcMsCm);
  result += "|";
  result += fmtNumber(soilPh);
  result += "|";
  result += String(faultFlags);
  result += "|";
  result += firmwareVersion;
  result += "|";
  result += CONTRACT_VERSION;
  return result;
}

String buildSoilContractPayloadJson(
  const String &deviceId,
  const String &messageId,
  long timestamp,
  float airTempC,
  float airHumidityPct,
  float soilTempC,
  float soilMoisturePct,
  float soilEcMsCm,
  float soilPh,
  int faultFlags,
  const String &firmwareVersion
) {
  String json;
  json.reserve(360);
  json += "{\"contract_version\":\"";
  json += CONTRACT_VERSION;
  json += "\",\"reading_kind\":\"soil\",\"device_id\":\"";
  json += escapeJsonString(deviceId);
  json += "\",\"message_id\":\"";
  json += escapeJsonString(messageId);
  json += "\",\"timestamp\":";
  json += String(timestamp);
  json += ",\"fault_flags\":";
  json += String(faultFlags);
  json += ",\"soil\":{\"air_temp_c\":";
  json += isnan(airTempC) ? "null" : fmtNumber(airTempC);
  json += ",\"air_humidity_pct\":";
  json += isnan(airHumidityPct) ? "null" : fmtNumber(airHumidityPct);
  json += ",\"soil_temp_c\":";
  json += isnan(soilTempC) ? "null" : fmtNumber(soilTempC);
  json += ",\"soil_moisture_pct\":";
  json += isnan(soilMoisturePct) ? "null" : fmtNumber(soilMoisturePct);
  json += ",\"soil_ec_ms_cm\":";
  json += isnan(soilEcMsCm) ? "null" : fmtNumber(soilEcMsCm);
  json += ",\"soil_ph\":";
  json += isnan(soilPh) ? "null" : fmtNumber(soilPh);
  json += "},\"firmware_version\":\"";
  json += escapeJsonString(firmwareVersion);
  json += "\"}";
  return json;
}

// ---------------------------------------------------------------------------
// HTTP relay to edge-ingest
// ---------------------------------------------------------------------------

bool httpPostSigned(
  const String &deviceId,
  const String &messageId,
  long timestamp,
  const String &signature,
  const String &bodyJson
) {
  if (!modemReady) {
    modemReady = initModem();
    if (!modemReady) {
      return false;
    }
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  if (!sendAt("AT+HTTPINIT")) return false;

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += EDGE_INGEST_URL;
  urlCommand += "\"";
  if (!sendAt(urlCommand)) return false;

  if (!sendAt("AT+HTTPPARA=\"CONTENT\",\"application/json\"")) return false;

  // NOT VERIFIED: assumes repeated USERDATA calls append header lines
  // rather than overwrite. See file header note.
  const char *headerNames[4] = {"x-device-id", "x-timestamp", "x-signature", "x-contract-version"};
  String headerValues[4] = {deviceId, String(timestamp), signature, String(CONTRACT_VERSION)};
  for (int i = 0; i < 4; i += 1) {
    String headerCommand = "AT+HTTPPARA=\"USERDATA\",\"";
    headerCommand += headerNames[i];
    headerCommand += ": ";
    headerCommand += headerValues[i];
    headerCommand += "\"";
    if (!sendAt(headerCommand)) return false;
  }

  String dataCommand = "AT+HTTPDATA=";
  dataCommand += String(bodyJson.length());
  dataCommand += ",10000";
  modemSerial.println(dataCommand);
  String prompt = modemReadUntil(5000);
  if (prompt.indexOf("DOWNLOAD") < 0) {
    Serial.println("[HTTP] No DOWNLOAD prompt");
    return false;
  }

  modemSerial.print(bodyJson);
  String dataResponse = modemReadUntil(12000);
  if (dataResponse.indexOf("OK") < 0) {
    Serial.println("[HTTP] Data upload failed");
    return false;
  }

  modemSerial.println("AT+HTTPACTION=1");
  const String actionResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  Serial.println(actionResponse);

  // SIMCom response format: +HTTPACTION: 1,<status>,<length>
  const bool success = actionResponse.indexOf("+HTTPACTION: 1,200") >= 0;
  const bool duplicateOrRejected =
    actionResponse.indexOf("+HTTPACTION: 1,401") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,404") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,422") >= 0;
  // 4xx responses mean the backend actively rejected this exact payload
  // (bad signature, unregistered device, faulty sensor) — retrying the
  // identical bytes will never succeed, so treat it as "handled" rather
  // than queuing it forever.
  if (duplicateOrRejected) {
    Serial.println("[HTTP] Backend rejected payload (not retryable) — logging and dropping");
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  return success || duplicateOrRejected;
}

String httpGet(const char *url) {
  if (!modemReady) {
    modemReady = initModem();
    if (!modemReady) {
      return "";
    }
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  if (!sendAt("AT+HTTPINIT")) return "";

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += url;
  urlCommand += "\"";
  if (!sendAt(urlCommand)) return "";

  modemSerial.println("AT+HTTPACTION=0");
  const String actionResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  Serial.println(actionResponse);
  if (actionResponse.indexOf("+HTTPACTION: 0,200") < 0) {
    sendAt("AT+HTTPTERM", "OK", 3000);
    return "";
  }

  modemSerial.println("AT+HTTPREAD");
  const String readResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  sendAt("AT+HTTPTERM", "OK", 3000);

  const int headerEnd = readResponse.indexOf("\r\n");
  const int okStart = readResponse.lastIndexOf("\r\nOK");
  if (headerEnd < 0 || okStart <= headerEnd) {
    return readResponse;
  }

  String body = readResponse.substring(headerEnd + 2, okStart);
  body.trim();
  return body;
}

// ---------------------------------------------------------------------------
// Runtime config polling (unchanged — unrelated to the ingestion path)
// ---------------------------------------------------------------------------

int extractIntNear(const String &text, int from, const char *field, int fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = text.indexOf(key, from);
  if (start < 0) return fallback;

  const int valueStart = start + key.length();
  int valueEnd = valueStart;
  while (valueEnd < text.length() && isDigit(text[valueEnd])) {
    valueEnd += 1;
  }
  if (valueEnd == valueStart) return fallback;
  return text.substring(valueStart, valueEnd).toInt();
}

void sendConfigToStation(const char *stationId, int sampleSeconds, int sleepSeconds) {
  String command;
  command.reserve(140);
  command += "{\"type\":\"config\",\"station_id\":\"";
  command += stationId;
  command += "\",\"sample_interval_seconds\":";
  command += String(sampleSeconds);
  command += ",\"sleep_interval_seconds\":";
  command += String(sleepSeconds);
  command += "}";

  loraSerial.println(command);
  appendLine("/gateway_config_sent.log", command);
  Serial.print("[CONFIG->LORA] ");
  Serial.println(command);
}

void applyGatewayConfig(int sampleSeconds, int sleepSeconds) {
  configPollIntervalMs = max<uint32_t>(30000UL, static_cast<uint32_t>(sampleSeconds) * 1000UL);
  gatewaySleepIntervalMs = max<uint32_t>(0UL, static_cast<uint32_t>(sleepSeconds) * 1000UL);

  Serial.printf("[CONFIG] gateway poll=%lus sleep=%lus\n", configPollIntervalMs / 1000UL, gatewaySleepIntervalMs / 1000UL);
}

void parseAndForwardConfigs(const String &body) {
  const char *stations[] = {"STATION_01", "STATION_02", "STATION_03"};
  for (const char *stationId : stations) {
    String stationKey = "\"station_id\":\"";
    stationKey += stationId;
    stationKey += "\"";

    const int pos = body.indexOf(stationKey);
    if (pos < 0) {
      continue;
    }

    const int sampleSeconds = extractIntNear(body, pos, "sample_interval_seconds", 300);
    const int sleepSeconds = extractIntNear(body, pos, "sleep_interval_seconds", 0);
    if (String(stationId) == "STATION_03") {
      applyGatewayConfig(sampleSeconds, sleepSeconds);
    } else {
      sendConfigToStation(stationId, sampleSeconds, sleepSeconds);
      delay(200);
    }
  }
}

void pollRuntimeConfigs() {
  if (millis() - lastConfigPollMs < configPollIntervalMs) {
    return;
  }
  lastConfigPollMs = millis();

  const String body = httpGet(CONFIG_URL);
  if (body.length() == 0) {
    Serial.println("[CONFIG] No config response");
    return;
  }

  appendLine("/gateway_config_poll.log", body);
  parseAndForwardConfigs(body);
}

void maybeEnterGatewaySleep() {
  if (gatewaySleepIntervalMs == 0 || loraLine.length() > 0) {
    return;
  }

  Serial.printf("[POWER] Gateway deep sleep %lu seconds\n", gatewaySleepIntervalMs / 1000UL);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(gatewaySleepIntervalMs) * 1000ULL);
  esp_deep_sleep_start();
}

// ---------------------------------------------------------------------------
// Station payload relay + store-and-forward
// ---------------------------------------------------------------------------

// One line per pending reading: the station's ORIGINAL raw fields, not a
// pre-signed payload — timestamp/signature must be freshly generated at
// send time, since a signature more than ~5 minutes stale will always be
// rejected by the backend's replay window regardless of retry count.
// Internal SD-storage format only — read back by extractStringField() in
// this same file, which is a naive substring parser that does NOT
// understand JSON escape sequences. Deliberately NOT using
// escapeJsonString() here: doing so without also upgrading
// extractStringField() to unescape would corrupt the read-back round trip.
// Safe because every field passed in is still a fixed constant or one of
// mapSensorStatus()'s 3 literal values (see escapeJsonString()'s comment).
String buildPendingRecord(const String &stationId, const String &messageId, float salinity,
                           float waterLevel, int faultFlags, const String &ecStatus,
                           const String &ultrasonicStatus, const String &firmwareVersion) {
  String record;
  record.reserve(220);
  record += "{\"reading_kind\":\"water\",\"device_id\":\"";
  record += stationId;
  record += "\",\"message_id\":\"";
  record += messageId;
  record += "\",\"salinity\":";
  record += isnan(salinity) ? "null" : fmtNumber(salinity);
  record += ",\"water_level\":";
  record += isnan(waterLevel) ? "null" : fmtNumber(waterLevel);
  record += ",\"fault_flags\":";
  record += String(faultFlags);
  record += ",\"ec_status\":\"";
  record += ecStatus;
  record += "\",\"ultrasonic_status\":\"";
  record += ultrasonicStatus;
  record += "\",\"firmware_version\":\"";
  record += firmwareVersion;
  record += "\"}";
  return record;
}

// Same internal-format caveats as buildPendingRecord above (no JSON
// escaping — matches the naive extractStringField() reader; safe because
// firmware_version is a fixed constant and all six soil fields are numbers).
String buildSoilPendingRecord(const String &stationId, const String &messageId, float airTempC,
                               float airHumidityPct, float soilTempC, float soilMoisturePct, float soilEcMsCm,
                               float soilPh, const String &firmwareVersion) {
  String record;
  record.reserve(260);
  record += "{\"reading_kind\":\"soil\",\"device_id\":\"";
  record += stationId;
  record += "\",\"message_id\":\"";
  record += messageId;
  record += "\",\"air_temp_c\":";
  record += isnan(airTempC) ? "null" : fmtNumber(airTempC);
  record += ",\"air_humidity_pct\":";
  record += isnan(airHumidityPct) ? "null" : fmtNumber(airHumidityPct);
  record += ",\"soil_temp_c\":";
  record += isnan(soilTempC) ? "null" : fmtNumber(soilTempC);
  record += ",\"soil_moisture_pct\":";
  record += isnan(soilMoisturePct) ? "null" : fmtNumber(soilMoisturePct);
  record += ",\"soil_ec_ms_cm\":";
  record += isnan(soilEcMsCm) ? "null" : fmtNumber(soilEcMsCm);
  record += ",\"soil_ph\":";
  record += isnan(soilPh) ? "null" : fmtNumber(soilPh);
  record += ",\"firmware_version\":\"";
  record += firmwareVersion;
  record += "\"}";
  return record;
}

bool relayReading(const String &stationId, const String &messageId, float salinity, float waterLevel,
                   int faultFlags, const String &ecStatus, const String &ultrasonicStatus,
                   const String &firmwareVersion) {
  if (!timeSynced) {
    maybeSyncTime();
  }
  if (!timeSynced) {
    Serial.println("[RELAY] No synced time yet — queuing without sending");
    return false;
  }

  const long timestamp = currentEpochSeconds();
  const String canonical = buildCanonicalString(
    stationId, messageId, timestamp, salinity, waterLevel, faultFlags, ecStatus, ultrasonicStatus, firmwareVersion);
  const String signature = hmacSha256Hex(canonical, GATEWAY_DEVICE_SECRET);
  const String body = buildContractPayloadJson(
    stationId, messageId, timestamp, salinity, waterLevel, faultFlags, ecStatus, ultrasonicStatus, firmwareVersion);

  Serial.print("[RELAY] ");
  Serial.println(body);

  return httpPostSigned(GATEWAY_ID, messageId, timestamp, signature, body);
}

bool relaySoilReading(const String &stationId, const String &messageId, float airTempC, float airHumidityPct,
                       float soilTempC, float soilMoisturePct, float soilEcMsCm, float soilPh, int faultFlags,
                       const String &firmwareVersion) {
  if (!timeSynced) {
    maybeSyncTime();
  }
  if (!timeSynced) {
    Serial.println("[RELAY] No synced time yet — queuing without sending");
    return false;
  }

  const long timestamp = currentEpochSeconds();
  const String canonical = buildSoilCanonicalString(
    stationId, messageId, timestamp, airTempC, airHumidityPct, soilTempC, soilMoisturePct, soilEcMsCm, soilPh,
    faultFlags, firmwareVersion);
  const String signature = hmacSha256Hex(canonical, GATEWAY_DEVICE_SECRET);
  const String body = buildSoilContractPayloadJson(
    stationId, messageId, timestamp, airTempC, airHumidityPct, soilTempC, soilMoisturePct, soilEcMsCm, soilPh,
    faultFlags, firmwareVersion);

  Serial.print("[RELAY] ");
  Serial.println(body);

  return httpPostSigned(GATEWAY_ID, messageId, timestamp, signature, body);
}

// Trạm 2's payload is the only one that includes this field — see
// "trạm 2.ino" buildPayload(). Cheaper and more robust than trying to
// derive station kind from the station_id string, which is just a
// firmware-assigned label with no structural meaning to the gateway.
bool isSoilPayload(const String &json) {
  return json.indexOf("\"soil_moisture_pct\"") >= 0;
}

void handleWaterStationPayload(const String &stationPayload) {
  const String stationId = extractStringField(stationPayload, "station_id");
  const String messageId = extractStringField(stationPayload, "message_id");
  const String firmwareVersion = extractStringField(stationPayload, "firmware_version");
  const float salinity = extractNumberField(stationPayload, "salinity_ppt");
  const float waterLevel = extractNumberField(stationPayload, "water_level_cm");
  const String ecStatus = mapSensorStatus(extractStringField(stationPayload, "ec_status"));
  const String ultrasonicStatus = mapSensorStatus(extractStringField(stationPayload, "ultrasonic_status"));

  if (stationId.length() == 0 || messageId.length() == 0) {
    Serial.println("[LORA] Missing station_id/message_id — dropped");
    return;
  }

  const bool anyFault = ecStatus == "fault" || ultrasonicStatus == "fault";
  const int faultFlags = anyFault ? 1 : 0;

  const bool sent = relayReading(
    stationId, messageId, salinity, waterLevel, faultFlags, ecStatus, ultrasonicStatus, firmwareVersion);

  if (sent) {
    appendLine("/gateway_sent.log", stationPayload);
    Serial.println("[HTTP] Relayed to edge-ingest");
  } else {
    const String pending = buildPendingRecord(
      stationId, messageId, salinity, waterLevel, faultFlags, ecStatus, ultrasonicStatus, firmwareVersion);
    appendLine(PENDING_QUEUE_PATH, pending);
    Serial.println("[HTTP] Relay failed, queued on SD for retry");
  }
}

void handleSoilStationPayload(const String &stationPayload) {
  const String stationId = extractStringField(stationPayload, "station_id");
  const String messageId = extractStringField(stationPayload, "message_id");
  const String firmwareVersion = extractStringField(stationPayload, "firmware_version");
  const float airTempC = extractNumberField(stationPayload, "air_temp_c");
  const float airHumidityPct = extractNumberField(stationPayload, "air_humidity_pct");
  const float soilTempC = extractNumberField(stationPayload, "soil_temp_c");
  const float soilMoisturePct = extractNumberField(stationPayload, "soil_moisture_pct");
  const float soilEcMsCm = extractNumberField(stationPayload, "soil_ec_ms_cm");
  const float soilPh = extractNumberField(stationPayload, "soil_ph");

  if (stationId.length() == 0 || messageId.length() == 0) {
    Serial.println("[LORA] Missing station_id/message_id — dropped");
    return;
  }

  // Trạm 2 doesn't set fault_flags itself (see "trạm 2.ino") — each sensor
  // independently reports null when faulted, which is what the backend's
  // soil validation actually checks (see docs/ARCHITECTURE_DECISIONS.md §8).
  const int faultFlags = 0;

  const bool sent = relaySoilReading(
    stationId, messageId, airTempC, airHumidityPct, soilTempC, soilMoisturePct, soilEcMsCm, soilPh, faultFlags,
    firmwareVersion);

  if (sent) {
    appendLine("/gateway_sent.log", stationPayload);
    Serial.println("[HTTP] Relayed soil reading to edge-ingest");
  } else {
    const String pending = buildSoilPendingRecord(
      stationId, messageId, airTempC, airHumidityPct, soilTempC, soilMoisturePct, soilEcMsCm, soilPh, firmwareVersion);
    appendLine(PENDING_QUEUE_PATH, pending);
    Serial.println("[HTTP] Soil relay failed, queued on SD for retry");
  }
}

void handleStationPayload(const String &stationPayload) {
  if (stationPayload.length() < 2 || stationPayload.charAt(0) != '{') {
    Serial.print("[LORA] Ignored non-json payload: ");
    Serial.println(stationPayload);
    return;
  }

  appendLine("/gateway_received.log", stationPayload);

  if (isSoilPayload(stationPayload)) {
    handleSoilStationPayload(stationPayload);
  } else {
    handleWaterStationPayload(stationPayload);
  }
}

void readLoRaUart() {
  while (loraSerial.available() > 0) {
    const char c = static_cast<char>(loraSerial.read());
    if (c == '\n') {
      loraLine.trim();
      if (loraLine.length() > 0) {
        handleStationPayload(loraLine);
      }
      loraLine = "";
    } else if (c != '\r') {
      loraLine += c;
      if (loraLine.length() > 900) {
        loraLine = "";
        Serial.println("[LORA] Line too long, dropped");
      }
    }
  }
}

// Re-signs and re-sends every queued reading with a fresh timestamp. Lines
// that still fail are rewritten back to the queue; lines the backend
// actively rejects (see httpPostSigned's duplicateOrRejected) are dropped
// rather than retried forever.
void retryPendingQueue() {
  if (!sdReady || !timeSynced || !SD.exists(PENDING_QUEUE_PATH)) {
    return;
  }

  File source = SD.open(PENDING_QUEUE_PATH, FILE_READ);
  if (!source || source.size() == 0) {
    if (source) source.close();
    return;
  }

  SD.remove(PENDING_QUEUE_TMP_PATH);
  File remaining = SD.open(PENDING_QUEUE_TMP_PATH, FILE_WRITE);
  int retried = 0;
  int stillPending = 0;

  while (source.available()) {
    String line = source.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;
    retried += 1;

    const String stationId = extractStringField(line, "device_id");
    const String messageId = extractStringField(line, "message_id");

    // A line that can't even yield a device_id/message_id is corrupted
    // (e.g. partial write from a power loss mid-append, or SD corruption)
    // and can never succeed on retry — drop it rather than requeue it
    // forever. Everything else about this line is unrecoverable anyway.
    if (stationId.length() == 0 || messageId.length() == 0) {
      Serial.println("[RETRY] Dropping unparseable queue line (corrupted)");
      continue;
    }

    const String firmwareVersion = extractStringField(line, "firmware_version");
    const bool isSoil = extractStringField(line, "reading_kind") == "soil";

    bool sent;
    if (isSoil) {
      sent = relaySoilReading(
        stationId, messageId,
        extractNumberField(line, "air_temp_c"), extractNumberField(line, "air_humidity_pct"),
        extractNumberField(line, "soil_temp_c"), extractNumberField(line, "soil_moisture_pct"),
        extractNumberField(line, "soil_ec_ms_cm"), extractNumberField(line, "soil_ph"), firmwareVersion);
    } else {
      sent = relayReading(
        stationId, messageId,
        extractNumberField(line, "salinity"), extractNumberField(line, "water_level"),
        static_cast<int>(extractNumberField(line, "fault_flags")),
        extractStringField(line, "ec_status"), extractStringField(line, "ultrasonic_status"), firmwareVersion);
    }

    if (!sent) {
      stillPending += 1;
      if (remaining) {
        remaining.println(line);
      }
    }
  }

  source.close();
  if (remaining) remaining.close();

  SD.remove(PENDING_QUEUE_PATH);
  if (stillPending > 0) {
    SD.rename(PENDING_QUEUE_TMP_PATH, PENDING_QUEUE_PATH);
  } else {
    SD.remove(PENDING_QUEUE_TMP_PATH);
  }

  Serial.printf("[RETRY] queue=%d sent=%d still_pending=%d\n", retried, retried - stillPending, stillPending);
}

void maybeRetryPending() {
  if (millis() - lastRetryMs < RETRY_INTERVAL_MS) {
    return;
  }
  lastRetryMs = millis();
  retryPendingQueue();
}

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(300);

  setupWatchdog();

  Serial.println();
  Serial.println("[HORIZON] Gateway starting");
  Serial.printf("[HORIZON] Gateway: %s\n", GATEWAY_ID);

  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);

  sdSpi.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
  sdReady = SD.begin(SD_CS_PIN, sdSpi);
  Serial.printf("[SD] %s\n", sdReady ? "ready" : "not available");

  powerOnModem();
  modemReady = initModem();
  Serial.printf("[MODEM] %s\n", modemReady ? "ready" : "not ready");

  if (modemReady) {
    syncNetworkTime();
  }
}

void loop() {
  esp_task_wdt_reset();
  readLoRaUart();
  maybeSyncTime();
  pollRuntimeConfigs();
  maybeRetryPending();
  maybeEnterGatewaySleep();
  delay(10);
}
