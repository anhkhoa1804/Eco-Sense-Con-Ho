#include <Arduino.h>
#include <SPIFFS.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>

/*
  HORIZON - Gateway node

  Role:
  - Receive raw JSON readings from Station 1 and Station 2 through SX1278 LoRa UART.
  - Add gateway metadata.
  - Store every packet on SPIFFS flash for backup.
  - Send packets to the webserver through a 4G SIM module using AT commands.
  - Drive 3 status lamps and 1 buzzer through MOSFET outputs.

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
static const char *FIRMWARE_VERSION = "gateway-4g-spiffs-0.3.1";

// Replace with your endpoint. It should accept JSON POST bodies.
static const char *WEB_SERVER_URL = "https://horizon-frogsleap.vercel.app/api/public/gateway";
static const char *CONFIG_URL = "https://horizon-frogsleap.vercel.app/api/public/gateway/configs";
static const char *GATEWAY_INGEST_TOKEN = "";
static const char *SIM_APN = "internet";
static const char *SIM_USER = "";
static const char *SIM_PASS = "";

static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t LORA_UART_BAUD = 9600;
static const uint32_t MODEM_BAUD = 115200;

// TODO: update these pins after wiring is finalized.
static const int LORA_UART_RX_PIN = 32;
static const int LORA_UART_TX_PIN = 33;

static const int MODEM_RX_PIN = 16;   // ESP32 RX <- SIM TX. Matches the working hardware test sketch.
static const int MODEM_TX_PIN = 17;   // ESP32 TX -> SIM RX.
static const int MODEM_PEN_PIN = 25;   // Optional SIM 4G power-enable pin. Use a valid ESP32 output; GPIO 39 is input-only.

// MOSFET outputs for the gateway tower light / buzzer. Active HIGH by default.
static const int STATUS_GREEN_PIN = 45;
static const int STATUS_YELLOW_PIN = 48;
static const int STATUS_RED_PIN = 47;
static const int BUZZER_PIN = 21;
static const int BUZZER_MUTE_BUTTON_PIN = 14;  // Button to GND, uses INPUT_PULLUP.
static const bool MOSFET_ACTIVE_LEVEL = HIGH;

static const uint32_t MODEM_TIMEOUT_MS = 12000;
static const uint32_t HTTP_TIMEOUT_MS = 30000;
static const uint32_t RETRY_INTERVAL_MS = 20000;
static const uint32_t DEFAULT_CONFIG_POLL_INTERVAL_MS = 60000;
static const uint32_t WATCHDOG_TIMEOUT_MS = 20000;
static const size_t MAX_LOG_FILE_BYTES = 1024UL * 1024UL;
static const size_t LORA_LINE_MAX_CHARS = 1400;
static const uint32_t BUTTON_DEBOUNCE_MS = 80;

HardwareSerial loraSerial(1);
HardwareSerial modemSerial(2);

static const int DS18B20_ONEWIRE_PIN = 4;
static const uint32_t DS18B20_SAMPLE_INTERVAL_MS = 2000;

OneWire oneWire(DS18B20_ONEWIRE_PIN);
DallasTemperature ds18b20Sensors(&oneWire);

static bool spiffsReady = false;
static bool modemReady = false;
static String loraLine;
static uint32_t lastDs18b20ReadMs = 0;
static uint32_t ds18b20Sequence = 0;
static uint32_t packetSequence = 0;
static uint32_t lastRetryMs = 0;
static uint32_t lastConfigPollMs = 0;
static uint32_t configPollIntervalMs = DEFAULT_CONFIG_POLL_INTERVAL_MS;
static uint32_t gatewaySleepIntervalMs = 0;
static bool tideHighAlert = false;
static bool tideCriticalAlert = false;
static bool soilSalinityAlert = false;
static bool forcedBuzzerAlert = false;
static bool buzzerMuted = false;
static bool lastMuteButtonPressed = false;
static uint32_t lastMuteButtonChangeMs = 0;

void writeMosfet(int pin, bool on) {
  digitalWrite(pin, on ? MOSFET_ACTIVE_LEVEL : !MOSFET_ACTIVE_LEVEL);
}

void setupStatusOutputs() {
  pinMode(STATUS_GREEN_PIN, OUTPUT);
  pinMode(STATUS_YELLOW_PIN, OUTPUT);
  pinMode(STATUS_RED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUZZER_MUTE_BUTTON_PIN, INPUT_PULLUP);

  writeMosfet(STATUS_GREEN_PIN, false);
  writeMosfet(STATUS_YELLOW_PIN, false);
  writeMosfet(STATUS_RED_PIN, false);
  writeMosfet(BUZZER_PIN, false);
}

void selfTestStatusOutputs() {
  writeMosfet(STATUS_GREEN_PIN, true);
  watchdogDelay(180);
  writeMosfet(STATUS_GREEN_PIN, false);
  writeMosfet(STATUS_YELLOW_PIN, true);
  watchdogDelay(180);
  writeMosfet(STATUS_YELLOW_PIN, false);
  writeMosfet(STATUS_RED_PIN, true);
  watchdogDelay(180);
  writeMosfet(STATUS_RED_PIN, false);
  writeMosfet(BUZZER_PIN, true);
  watchdogDelay(120);
  writeMosfet(BUZZER_PIN, false);
}

void serviceWatchdog() {
  if (esp_task_wdt_status(NULL) == ESP_OK) {
    esp_task_wdt_reset();
  }
}

void watchdogDelay(uint32_t ms) {
  const uint32_t startedAt = millis();
  while (millis() - startedAt < ms) {
    serviceWatchdog();
    delay(10);
  }
}

void flushModemInput() {
  while (modemSerial.available() > 0) {
    modemSerial.read();
  }
}

void updateMuteButton() {
  const uint32_t now = millis();
  const bool pressed = digitalRead(BUZZER_MUTE_BUTTON_PIN) == LOW;
  if (pressed != lastMuteButtonPressed && now - lastMuteButtonChangeMs >= BUTTON_DEBOUNCE_MS) {
    lastMuteButtonPressed = pressed;
    lastMuteButtonChangeMs = now;
    if (pressed) {
      buzzerMuted = true;
      appendLine("/gateway_buzzer_mute.log", "{\"event\":\"buzzer_muted_by_button\"}");
      Serial.println("[STATUS] Buzzer muted by button");
    }
  }

  if (!tideCriticalAlert && !forcedBuzzerAlert) {
    buzzerMuted = false;
  }
}

void updateStatusOutputs() {
  updateMuteButton();

  const bool greenOn = true;
  const bool yellowOn = soilSalinityAlert;
  const bool redOn = tideHighAlert || tideCriticalAlert;
  const bool buzzerOn = (tideCriticalAlert || forcedBuzzerAlert) && !buzzerMuted;

  writeMosfet(STATUS_GREEN_PIN, greenOn);
  writeMosfet(STATUS_YELLOW_PIN, yellowOn);
  writeMosfet(STATUS_RED_PIN, redOn);
  writeMosfet(BUZZER_PIN, buzzerOn);
}

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
    serviceWatchdog();
    delay(10);
  }

  return response;
}

String modemReadUntilToken(const char *token, uint32_t timeoutMs) {
  String response;
  const uint32_t startedAt = millis();

  while (millis() - startedAt < timeoutMs) {
    while (modemSerial.available() > 0) {
      response += static_cast<char>(modemSerial.read());
    }
    if (response.indexOf(token) >= 0 || response.indexOf("\r\nERROR\r\n") >= 0) {
      break;
    }
    serviceWatchdog();
    delay(10);
  }

  return response;
}

bool sendAt(const String &command, const char *expected = "OK", uint32_t timeoutMs = MODEM_TIMEOUT_MS) {
  flushModemInput();
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

  const esp_err_t initResult = esp_task_wdt_init(&wdtConfig);
  if (initResult == ESP_ERR_INVALID_STATE) {
    Serial.println("[WATCHDOG] TWDT da duoc khoi tao san");
    const esp_err_t reconfigureResult = esp_task_wdt_reconfigure(&wdtConfig);
    if (reconfigureResult != ESP_OK) {
      Serial.printf("[WATCHDOG] Loi cau hinh lai TWDT: %d\n", static_cast<int>(reconfigureResult));
    }
  } else if (initResult != ESP_OK) {
    Serial.printf("[WATCHDOG] Loi khoi tao TWDT: %d\n", static_cast<int>(initResult));
    return;
  }

  if (esp_task_wdt_status(NULL) != ESP_OK) {
    const esp_err_t addResult = esp_task_wdt_add(NULL);
    if (addResult != ESP_OK && addResult != ESP_ERR_INVALID_STATE) {
      Serial.printf("[WATCHDOG] Loi add task: %d\n", static_cast<int>(addResult));
    }
  }
}

void initializeDs18b20Sensor() {
  pinMode(DS18B20_ONEWIRE_PIN, INPUT_PULLUP);
  ds18b20Sensors.begin();
}

void readTemperatureSensor() {
  ds18b20Sensors.requestTemperatures();
  const float tempC = ds18b20Sensors.getTempCByIndex(0);

  if (tempC != DEVICE_DISCONNECTED_C) {
    Serial.print("[TEMP] Nhiet do hien tai: ");
    Serial.print(tempC);
    Serial.println(" °C");
  } else {
    Serial.println("[TEMP] Loi: Khong doc duoc du lieu tu cam bien DS18B20.");
  }
}

String buildDs18b20Payload() {
  ds18b20Sensors.requestTemperatures();
  const float tempC = ds18b20Sensors.getTempCByIndex(0);
  const uint32_t timestampSec = static_cast<uint32_t>(millis() / 1000UL);
  ds18b20Sequence += 1;

  String payload;
  payload.reserve(220);
  payload += "{\"gateway_id\":\"";
  payload += GATEWAY_ID;
  payload += "\",\"station_id\":\"STATION_01\",\"message_id\":\"temp-";
  payload += String(ds18b20Sequence);
  payload += "\",\"timestamp\":";
  payload += String(timestampSec);
  payload += ",\"air_temp_c\":";
  payload += String(tempC, 2);
  payload += ",\"soil_temp_c\":";
  payload += String(tempC, 2);
  payload += ",\"air_humidity_pct\":66}";
  return payload;
}

bool postDs18b20Sample() {
  const String payload = buildDs18b20Payload();
  Serial.print("[TEMP->HTTP] ");
  Serial.println(payload);

  if (httpPostJson(payload)) {
    Serial.println("[HTTP] Da gui du lieu nhiet do DS18B20 len route local");
    return true;
  }

  Serial.println("[HTTP] Gui du lieu nhiet do DS18B20 that bai");
  return false;
}

void checkSim4GStatus() {
  Serial.println("\n--- DANG KIEM TRA MODULE SIM 4G ---");

  Serial.print("Kiem tra giao tiep (AT): ");
  modemSerial.println("AT");
  String resAT = modemReadUntil(1000);
  Serial.println(resAT);
  if (resAT.indexOf("OK") != -1) {
    Serial.println("OK");
  } else {
    Serial.println("Loi! Khong thay module SIM phan hoi.");
  }

  Serial.print("Kiem tra the SIM (AT+CPIN?): ");
  modemSerial.println("AT+CPIN?");
  String resCPIN = modemReadUntil(1000);
  Serial.println(resCPIN);
  if (resCPIN.indexOf("READY") != -1) {
    Serial.println("SIM OK (READY)");
  } else {
    Serial.println("Loi the SIM! (Chua gan SIM hoac SIM bi hong/khoa PIN)");
  }

  Serial.print("Kiem tra song (AT+CSQ): ");
  modemSerial.println("AT+CSQ");
  String resCSQ = modemReadUntil(1000);
  resCSQ.trim();
  Serial.println("\n  -> Ket qua: " + resCSQ);

  Serial.print("Kiem tra mang 4G (AT+CPSI?): ");
  modemSerial.println("AT+CPSI?");
  String resCPSI = modemReadUntil(1000);
  resCPSI.trim();
  Serial.println("\n  -> Ket qua: " + resCPSI);

  Serial.println("-----------------------------------\n");
}

void rotateLogIfNeeded(const char *path, const char *oldPath, size_t maxBytes) {
  if (!spiffsReady || !SPIFFS.exists(path)) {
    return;
  }

  File file = SPIFFS.open(path, "r");
  if (!file) {
    return;
  }
  const size_t size = file.size();
  file.close();

  if (size < maxBytes) {
    return;
  }

  if (SPIFFS.exists(oldPath)) {
    SPIFFS.remove(oldPath);
  }
  SPIFFS.rename(path, oldPath);
}

void powerOnModem() {
  if (MODEM_PEN_PIN < 0) {
    Serial.println("[MODEM] No modem power-enable pin configured; assuming the modem is already powered.");
    return;
  }

  pinMode(MODEM_PEN_PIN, OUTPUT);
  digitalWrite(MODEM_PEN_PIN, HIGH);
  watchdogDelay(5000);
}

bool initModem() {
  modemSerial.begin(MODEM_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  watchdogDelay(500);

  for (uint8_t attempt = 0; attempt < 5; attempt += 1) {
    if (sendAt("AT")) {
      break;
    }
    watchdogDelay(1000);
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
  if (!spiffsReady) {
    return;
  }

  String oldPath = String(path);
  oldPath.replace(".log", ".old");
  rotateLogIfNeeded(path, oldPath.c_str(), MAX_LOG_FILE_BYTES);

  File file = SPIFFS.open(path, "a");
  if (!file) {
    Serial.print("[SPIFFS] Khong mo duoc ");
    Serial.println(path);
    return;
  }

  file.println(line);
  file.close();
}

bool setupSpiffs() {
  Serial.println("[SPIFFS] Dang mount...");

  if (SPIFFS.begin(false)) {
    Serial.printf("[SPIFFS] Da mount total=%lu used=%lu\n",
                  static_cast<unsigned long>(SPIFFS.totalBytes()),
                  static_cast<unsigned long>(SPIFFS.usedBytes()));
    return true;
  }

  Serial.println("[SPIFFS] Mount loi, thu format...");

  if (SPIFFS.begin(true)) {
    Serial.printf("[SPIFFS] Da mount sau format total=%lu used=%lu\n",
                  static_cast<unsigned long>(SPIFFS.totalBytes()),
                  static_cast<unsigned long>(SPIFFS.usedBytes()));
    return true;
  }

  Serial.println("[SPIFFS] Khong kha dung - kiem tra partition scheme");
  return false;
}

bool configureHttpUrl(const char *url) {
  if (strncmp(url, "https://", 8) == 0 && !sendAt("AT+HTTPPARA=\"SSLCFG\",0", "OK", 3000)) {
    Serial.println("[HTTP] Khong cau hinh duoc SSL context cho HTTPS");
    return false;
  }

  String urlCommand = "AT+HTTPPARA=\"URL\",\"";
  urlCommand += url;
  urlCommand += "\"";
  return sendAt(urlCommand);
}

bool configureGatewayIngestHeaders() {
  if (strlen(GATEWAY_INGEST_TOKEN) == 0) {
    return true;
  }

  String headerCommand = "AT+HTTPPARA=\"USERDATA\",\"x-gateway-token: ";
  headerCommand += GATEWAY_INGEST_TOKEN;
  headerCommand += "\"";
  return sendAt(headerCommand);
}

bool beginHttpSessionForUrl(const char *url) {
  if (strncmp(url, "https://", 8) == 0) {
    sendAt("AT+CSSLCFG=\"sslversion\",0,3", "OK", 3000);
    sendAt("AT+CSSLCFG=\"enableSNI\",0,1", "OK", 3000);
    sendAt("AT+CSSLCFG=\"authmode\",0,0", "OK", 3000);
  }

  return sendAt("AT+HTTPINIT");
}

void endHttpSession() {
  sendAt("AT+HTTPTERM", "OK", 3000);
}

String httpGet(const char *url) {
  if (!modemReady) {
    modemReady = initModem();
    if (!modemReady) {
      return "";
    }
  }

  endHttpSession();
  if (!beginHttpSessionForUrl(url)) return "";
  if (!configureHttpUrl(url)) {
    endHttpSession();
    return "";
  }

  modemSerial.println("AT+HTTPACTION=0");
  const String actionResponse = modemReadUntilToken("+HTTPACTION: 0,", HTTP_TIMEOUT_MS);
  Serial.println(actionResponse);
  if (actionResponse.indexOf("+HTTPACTION: 0,200") < 0) {
    endHttpSession();
    return "";
  }

  modemSerial.println("AT+HTTPREAD");
  const String readResponse = modemReadUntil(HTTP_TIMEOUT_MS);
  endHttpSession();

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

int extractBoolOrIntNear(const String &text, int from, const char *field, int fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = text.indexOf(key, from);
  if (start < 0) return fallback;

  const int valueStart = start + key.length();
  if (text.startsWith("true", valueStart)) return 1;
  if (text.startsWith("false", valueStart)) return 0;
  if (text[valueStart] == '1') return 1;
  if (text[valueStart] == '0') return 0;
  return fallback;
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

void applyGatewayConfig(int sampleSeconds, int sleepSeconds, int tideLevel, int salinityAlert, int buzzerAlert) {
  configPollIntervalMs = max<uint32_t>(30000UL, static_cast<uint32_t>(sampleSeconds) * 1000UL);
  gatewaySleepIntervalMs = max<uint32_t>(0UL, static_cast<uint32_t>(sleepSeconds) * 1000UL);

  tideHighAlert = tideLevel >= 1;
  tideCriticalAlert = tideLevel >= 2;
  soilSalinityAlert = salinityAlert == 1;
  forcedBuzzerAlert = buzzerAlert == 1;

  Serial.printf("[CONFIG] gateway poll=%lus sleep=%lus tide=%d salinity=%d buzzer=%d muted=%s\n",
                configPollIntervalMs / 1000UL,
                gatewaySleepIntervalMs / 1000UL,
                tideLevel,
                salinityAlert,
                buzzerAlert,
                buzzerMuted ? "yes" : "no");
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
      int tideLevel = extractIntNear(body, pos, "tide_alert_level", 0);
      const int redLight = extractBoolOrIntNear(body, pos, "red_light", tideLevel >= 1 ? 1 : 0);
      const int criticalTide = extractBoolOrIntNear(body, pos, "tide_critical", tideLevel >= 2 ? 1 : 0);
      if (criticalTide == 1) {
        tideLevel = 2;
      } else if (redLight == 1) {
        tideLevel = max(tideLevel, 1);
      }

      const int salinityAlert = extractBoolOrIntNear(
        body,
        pos,
        "soil_salinity_alert",
        extractBoolOrIntNear(body, pos, "yellow_light", 0)
      );
      const int buzzerAlert = extractBoolOrIntNear(
        body,
        pos,
        "buzzer_alert",
        extractBoolOrIntNear(body, pos, "buzzer_on", tideLevel >= 2 ? 1 : 0)
      );

      applyGatewayConfig(sampleSeconds, sleepSeconds, tideLevel, salinityAlert, buzzerAlert);
    } else {
      sendConfigToStation(stationId, sampleSeconds, sleepSeconds);
      watchdogDelay(200);
    }
  }

  String gatewayKey = "\"gateway_id\":\"";
  gatewayKey += GATEWAY_ID;
  gatewayKey += "\"";
  const int gatewayPos = body.indexOf(gatewayKey);
  if (gatewayPos >= 0) {
    const int sampleSeconds = extractIntNear(body, gatewayPos, "sample_interval_seconds", configPollIntervalMs / 1000UL);
    const int sleepSeconds = extractIntNear(body, gatewayPos, "sleep_interval_seconds", gatewaySleepIntervalMs / 1000UL);
    int tideLevel = extractIntNear(body, gatewayPos, "tide_alert_level", 0);
    if (extractBoolOrIntNear(body, gatewayPos, "tide_critical", 0) == 1) tideLevel = 2;
    if (extractBoolOrIntNear(body, gatewayPos, "red_light", 0) == 1) tideLevel = max(tideLevel, 1);
    const int salinityAlert = extractBoolOrIntNear(
      body,
      gatewayPos,
      "soil_salinity_alert",
      extractBoolOrIntNear(body, gatewayPos, "yellow_light", 0)
    );
    const int buzzerAlert = extractBoolOrIntNear(
      body,
      gatewayPos,
      "buzzer_alert",
      extractBoolOrIntNear(body, gatewayPos, "buzzer_on", tideLevel >= 2 ? 1 : 0)
    );
    applyGatewayConfig(sampleSeconds, sleepSeconds, tideLevel, salinityAlert, buzzerAlert);
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

  endHttpSession();
  if (!beginHttpSessionForUrl(WEB_SERVER_URL)) return false;
  if (!configureHttpUrl(WEB_SERVER_URL)) {
    endHttpSession();
    return false;
  }

  if (!configureGatewayIngestHeaders()) {
    endHttpSession();
    return false;
  }

  if (!sendAt("AT+HTTPPARA=\"CONTENT\",\"application/json\"")) {
    endHttpSession();
    return false;
  }

  String dataCommand = "AT+HTTPDATA=";
  dataCommand += String(payload.length());
  dataCommand += ",10000";
  modemSerial.println(dataCommand);
  String prompt = modemReadUntilToken("DOWNLOAD", 5000);
  if (prompt.indexOf("DOWNLOAD") < 0) {
    Serial.println("[HTTP] No DOWNLOAD prompt");
    endHttpSession();
    return false;
  }

  modemSerial.print(payload);
  String dataResponse = modemReadUntil(12000);
  if (dataResponse.indexOf("OK") < 0) {
    Serial.println("[HTTP] Data upload failed");
    endHttpSession();
    return false;
  }

  modemSerial.println("AT+HTTPACTION=1");
  const String actionResponse = modemReadUntilToken("+HTTPACTION: 1,", HTTP_TIMEOUT_MS);
  Serial.println(actionResponse);

  // SIMCom response format: +HTTPACTION: 1,<status>,<length>
  const bool success =
    actionResponse.indexOf("+HTTPACTION: 1,200") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,201") >= 0 ||
    actionResponse.indexOf("+HTTPACTION: 1,202") >= 0;

  endHttpSession();
  return success;
}

bool isLikelyJson(const String &line) {
  return line.length() > 2 && line[0] == '{' && line[line.length() - 1] == '}';
}

String extractJsonStringField(const String &json, const char *field) {
  String key = "\"";
  key += field;
  key += "\":\"";
  const int start = json.indexOf(key);
  if (start < 0) {
    return "";
  }

  const int valueStart = start + key.length();
  const int valueEnd = json.indexOf("\"", valueStart);
  if (valueEnd < 0) {
    return "";
  }

  return json.substring(valueStart, valueEnd);
}

bool isKnownStationId(const String &stationId) {
  return stationId == "STATION_01" || stationId == "STATION_02";
}

void sendStationAck(const String &stationPayload) {
  const String messageId = extractJsonStringField(stationPayload, "message_id");
  if (messageId.length() == 0) {
    return;
  }

  String ack;
  ack.reserve(messageId.length() + 36);
  ack += "{\"type\":\"ack\",\"message_id\":\"";
  ack += messageId;
  ack += "\"}";

  loraSerial.println(ack);
  appendLine("/gateway_ack_sent.log", ack);
  Serial.print("[ACK->LORA] Da gui ACK: ");
  Serial.println(ack);
}

void handleStationPayload(const String &stationPayload) {
  if (!isLikelyJson(stationPayload)) {
    Serial.print("[LORA] Bo qua du lieu khong phai JSON: ");
    Serial.println(stationPayload);
    return;
  }

  const String stationId = extractJsonStringField(stationPayload, "station_id");
  const String payloadType = extractJsonStringField(stationPayload, "type");

  if (!isKnownStationId(stationId)) {
    Serial.print("[LORA] Bo qua goi khong thuoc STATION_01/STATION_02: ");
    Serial.println(stationPayload);
    return;
  }

  Serial.printf("[LORA] Nhan goi %s tu %s, %u ky tu\n",
                payloadType.length() > 0 ? payloadType.c_str() : "khong_ro_loai",
                stationId.c_str(),
                static_cast<unsigned int>(stationPayload.length()));

  sendStationAck(stationPayload);

  const String gatewayPayload = wrapGatewayPayload(stationPayload);
  Serial.print("[GATEWAY] Du lieu dong goi: ");
  Serial.println(gatewayPayload);

  appendLine("/gateway_received.log", gatewayPayload);

  if (httpPostJson(gatewayPayload)) {
    appendLine("/gateway_sent.log", gatewayPayload);
    Serial.println("[HTTP] Da gui len webserver");
  } else {
    appendLine("/gateway_pending.log", gatewayPayload);
    Serial.println("[HTTP] Gui that bai, da dua vao hang doi tren SPIFFS");
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
      if (loraLine.length() > LORA_LINE_MAX_CHARS) {
        loraLine = "";
        Serial.println("[LORA] Dong du lieu qua dai, da bo qua");
      }
    }
  }
}

void retryPendingNotice() {
  if (!spiffsReady) {
    return;
  }

  if (millis() - lastRetryMs < RETRY_INTERVAL_MS) {
    return;
  }
  lastRetryMs = millis();

  File file = SPIFFS.open("/gateway_pending.log", "r");
  if (!file || file.size() == 0) {
    if (file) file.close();
    return;
  }

  Serial.println("[SPIFFS] Co hang doi pending. Firmware hien tai chi luu lai, chua replay tu dong.");
  file.close();
}

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(300);

  setupWatchdog();
  setupStatusOutputs();
  selfTestStatusOutputs();

  Serial.println();
  Serial.println("[HORIZON] Gateway starting");
  Serial.printf("[HORIZON] Gateway: %s\n", GATEWAY_ID);
  Serial.printf("[STATUS] green=%d yellow=%d red=%d buzzer=%d active=%s\n",
                STATUS_GREEN_PIN,
                STATUS_YELLOW_PIN,
                STATUS_RED_PIN,
                BUZZER_PIN,
                MOSFET_ACTIVE_LEVEL == HIGH ? "HIGH" : "LOW");
  Serial.printf("[STATUS] buzzer mute button IO%d, press to GND\n", BUZZER_MUTE_BUTTON_PIN);

  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);
  Serial.printf("[LORA] RX=%d TX=%d baud=%lu\n", LORA_UART_RX_PIN, LORA_UART_TX_PIN, static_cast<unsigned long>(LORA_UART_BAUD));

  spiffsReady = setupSpiffs();
  Serial.printf("[SPIFFS] %s\n", spiffsReady ? "san_sang" : "khong_co");

  initializeDs18b20Sensor();

  powerOnModem();
  modemReady = initModem();
  Serial.printf("[MODEM] %s TX=%d RX=%d PEN=%d\n", modemReady ? "ready" : "not ready", MODEM_TX_PIN, MODEM_RX_PIN, MODEM_PEN_PIN);
  checkSim4GStatus();
}

void loop() {
  esp_task_wdt_reset();
  updateStatusOutputs();
  readLoRaUart();
  pollRuntimeConfigs();
  retryPendingNotice();

  if (millis() - lastDs18b20ReadMs >= DS18B20_SAMPLE_INTERVAL_MS) {
    lastDs18b20ReadMs = millis();
    readTemperatureSensor();
    postDs18b20Sample();
  }

  maybeEnterGatewaySleep();
  updateStatusOutputs();
  delay(10);
}
