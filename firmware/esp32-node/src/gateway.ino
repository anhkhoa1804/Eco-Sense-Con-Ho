#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>

/*
  HORIZON - Gateway node

  Role:
  - Receive raw JSON readings from Station 1 and Station 2 through SX1278 LoRa UART.
  - Add gateway metadata.
  - Store every packet on microSD for backup.
  - Send packets to the webserver through a 4G SIM module using AT commands.

  Important:
  - The gateway should not calculate agricultural/environment thresholds.
  - The webserver stores the raw observation and calculates dashboard values,
    daily comparison tables, warnings, and recommendations.

  Expected station payload examples:
  - Station 1: water_level_cm, salinity_ppt, ec_us_cm, ultrasonic_status, ec_status
  - Station 2: air_temp_c, air_humidity_pct, soil_temp_c, soil_moisture_pct,
               soil_ec_ms_cm, soil_ph, advice

  TODO:
  - Set WEB_SERVER_URL to your deployed ingest endpoint.
  - Set SIM_APN for the SIM provider.
  - Confirm SIM module model and HTTP AT command support.
  - Confirm LoRa UART baud rate / transparent mode.
*/

static const char *GATEWAY_ID = "GATEWAY_01";
static const char *FIRMWARE_VERSION = "gateway-4g-0.1.0";

// Replace with your endpoint. It should accept JSON POST bodies.
static const char *WEB_SERVER_URL = "https://example.com/api/public/gateway";
static const char *CONFIG_URL = "https://example.com/api/public/gateway/configs";
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
static const uint32_t DEFAULT_CONFIG_POLL_INTERVAL_MS = 60000;
static const uint32_t WATCHDOG_TIMEOUT_MS = 20000;
static const size_t MAX_LOG_FILE_BYTES = 1024UL * 1024UL;

HardwareSerial loraSerial(1);
HardwareSerial modemSerial(2);
SPIClass sdSpi(VSPI);

static bool sdReady = false;
static bool modemReady = false;
static String loraLine;
static uint32_t packetSequence = 0;
static uint32_t lastRetryMs = 0;
static uint32_t lastConfigPollMs = 0;
static uint32_t configPollIntervalMs = DEFAULT_CONFIG_POLL_INTERVAL_MS;
static uint32_t gatewaySleepIntervalMs = 0;

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

String wrapGatewayPayload(const String &stationPayload) {
  packetSequence += 1;

  String payload;
  payload.reserve(stationPayload.length() + 220);
  payload += "{";
  payload += "\"gateway_id\":\"";
  payload += GATEWAY_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"sequence\":";
  payload += String(packetSequence);
  payload += ",\"uptime_ms\":";
  payload += String(millis());
  payload += ",\"transport\":\"lora_uart_to_4g\"";
  payload += ",\"raw_station_payload\":";
  payload += stationPayload;
  payload += "}";
  return payload;
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

bool httpPostJson(const String &payload) {
  if (!modemReady) {
    modemReady = initModem();
    if (!modemReady) {
      return false;
    }
  }

  sendAt("AT+HTTPTERM", "OK", 3000);
  if (!sendAt("AT+HTTPINIT")) return false;

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += WEB_SERVER_URL;
  urlCommand += "\"";
  if (!sendAt(urlCommand)) return false;

  if (!sendAt("AT+HTTPPARA=\"CONTENT\",\"application/json\"")) return false;

  String dataCommand = "AT+HTTPDATA=";
  dataCommand += String(payload.length());
  dataCommand += ",10000";
  modemSerial.println(dataCommand);
  String prompt = modemReadUntil(5000);
  if (prompt.indexOf("DOWNLOAD") < 0) {
    Serial.println("[HTTP] No DOWNLOAD prompt");
    return false;
  }

  modemSerial.print(payload);
  String dataResponse = modemReadUntil(12000);
  if (dataResponse.indexOf("OK") < 0) {
    Serial.println("[HTTP] Data upload failed");
    return false;
  }

  modemSerial.println("AT+HTTPACTION=1");
  const String actionResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  Serial.println(actionResponse);

  // SIMCom response format: +HTTPACTION: 1,<status>,<length>
  const bool success =
    actionResponse.indexOf("+HTTPACTION: 1,200") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,201") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,202") >= 0;

  sendAt("AT+HTTPTERM", "OK", 3000);
  return success;
}

bool isLikelyJson(const String &line) {
  return line.length() > 2 && line[0] == '{' && line[line.length() - 1] == '}';
}

void handleStationPayload(const String &stationPayload) {
  if (!isLikelyJson(stationPayload)) {
    Serial.print("[LORA] Ignored non-json payload: ");
    Serial.println(stationPayload);
    return;
  }

  const String gatewayPayload = wrapGatewayPayload(stationPayload);
  Serial.print("[GATEWAY] ");
  Serial.println(gatewayPayload);

  appendLine("/gateway_received.log", gatewayPayload);

  if (httpPostJson(gatewayPayload)) {
    appendLine("/gateway_sent.log", gatewayPayload);
    Serial.println("[HTTP] Sent to webserver");
  } else {
    appendLine("/gateway_pending.log", gatewayPayload);
    Serial.println("[HTTP] Send failed, queued on SD");
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

void retryPendingNotice() {
  if (!sdReady) {
    return;
  }

  if (millis() - lastRetryMs < RETRY_INTERVAL_MS) {
    return;
  }
  lastRetryMs = millis();

  File file = SD.open("/gateway_pending.log", FILE_READ);
  if (!file || file.size() == 0) {
    if (file) file.close();
    return;
  }

  Serial.println("[SD] Pending queue exists. Manual replay is required in this firmware draft.");
  file.close();
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
}

void loop() {
  esp_task_wdt_reset();
  readLoRaUart();
  pollRuntimeConfigs();
  retryPendingNotice();
  maybeEnterGatewaySleep();
  delay(10);
}
