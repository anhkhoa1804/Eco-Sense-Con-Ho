#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>
#include <esp_system.h>

/*
  HORIZON - Station 1, upstream water node

  Hardware:
  - ESP32
  - A02YYUW waterproof ultrasonic distance sensor, UART, 3-450 cm, IP67
  - ES-EC-WT-01 water EC probe, RS485 / 4-20mA, used through RS485
  - SX1278 LoRa UART module, used to send readings to the gateway
  - 4GB microSD module, SPI, used as local store-and-forward backup
  - 50W field light through MOSFET, triggered by PIR for night maintenance
  - Cabinet proximity/door sensor, turns on a small cabinet light when opened

  Mounting:
  - Ultrasonic sensor is installed 350 cm above the water reference line.
  - water_level_cm = SENSOR_HEIGHT_CM - measured_distance_cm

  TODO:
  - Confirm ESP32 board pinout.
  - Confirm ES-EC-WT-01 Modbus address/registers and conversion formula.
  - Confirm LoRa UART module baud rate / AT command mode if needed.
*/

static const char *STATION_ID = "STATION_01";
static const char *FIRMWARE_VERSION = "station1-water-0.1.0";

// Measurement geometry.
static const float SENSOR_HEIGHT_CM = 350.0f;
static const float A02YYUW_MIN_CM = 3.0f;
static const float A02YYUW_MAX_CM = 450.0f;

// Serial baud rates.
static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t A02YYUW_BAUD = 9600;
static const uint32_t EC_RS485_BAUD = 9600;
static const uint32_t LORA_UART_BAUD = 9600;

// TODO: update these pins after wiring is finalized.
static const int A02YYUW_RX_PIN = 16;  // ESP32 RX, connect to A02YYUW TX.
static const int A02YYUW_TX_PIN = 17;  // Usually unused, keep for UART init.

static const int EC_RS485_RX_PIN = 26;
static const int EC_RS485_TX_PIN = 27;
static const int EC_RS485_DE_RE_PIN = 25;  // MAX485 DE and RE tied together.

static const int LORA_UART_RX_PIN = 32;
static const int LORA_UART_TX_PIN = 33;

static const int SD_SCK_PIN = 18;
static const int SD_MISO_PIN = 19;
static const int SD_MOSI_PIN = 23;
static const int SD_CS_PIN = 5;

static const uint32_t DEFAULT_SAMPLE_INTERVAL_MS = 5000;
static const uint32_t DEFAULT_SLEEP_INTERVAL_MS = 0;
static const uint32_t WATCHDOG_TIMEOUT_MS = 15000;
static const size_t MAX_LOG_FILE_BYTES = 1024UL * 1024UL;
static const uint32_t FIELD_LIGHT_HOLD_MS = 30000;

static const int PIR_SENSOR_PIN = 34;
static const int FIELD_LIGHT_MOSFET_PIN = 14;
static const int CABINET_PROX_PIN = 35;
static const int CABINET_LIGHT_PIN = 12;
static const bool PIR_ACTIVE_LEVEL = HIGH;
static const bool CABINET_OPEN_LEVEL = LOW;

static const char *LOG_PATH = "/station1.log";
static const char *OLD_LOG_PATH = "/station1.old";

HardwareSerial ultrasonicSerial(1);
HardwareSerial ecSerial(2);
HardwareSerial loraSerial(0);
SPIClass sdSpi(VSPI);

struct SensorValue {
  bool ok;
  float value;
  const char *status;
};

struct StationReading {
  uint32_t sequence;
  float distanceCm;
  float waterLevelCm;
  float ecUsCm;
  float salinityPpt;
  const char *ultrasonicStatus;
  const char *ecStatus;
};

// Survives deep sleep (which preserves RTC memory) but resets to 0 on a
// true power loss / battery swap. On its own this would produce a repeat
// message_id ("STATION_01-1", ...) after a power cycle, which the
// backend's unique constraint would then silently treat as a duplicate of
// the ORIGINAL reading rather than storing the new one. bootNonce (below,
// re-randomized every boot including deep-sleep wake) makes message_id
// unique regardless of whether sequenceNumber has reset.
RTC_DATA_ATTR static uint32_t sequenceNumber = 0;
static uint32_t bootNonce = 0;
static bool sdReady = false;
static uint32_t lastSampleMs = 0;
static uint32_t configuredSampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS;
static uint32_t configuredSleepIntervalMs = DEFAULT_SLEEP_INTERVAL_MS;
static uint32_t fieldLightUntilMs = 0;
static String loraCommandLine;

void setRs485Transmit(bool enabled) {
  digitalWrite(EC_RS485_DE_RE_PIN, enabled ? HIGH : LOW);
  delayMicroseconds(200);
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

uint32_t extractUintField(const String &json, const char *field, uint32_t fallback) {
  String key = "\"";
  key += field;
  key += "\":";
  const int start = json.indexOf(key);
  if (start < 0) {
    return fallback;
  }

  const int valueStart = start + key.length();
  int valueEnd = valueStart;
  while (valueEnd < json.length() && isDigit(json[valueEnd])) {
    valueEnd += 1;
  }
  if (valueEnd == valueStart) {
    return fallback;
  }

  return static_cast<uint32_t>(json.substring(valueStart, valueEnd).toInt());
}

bool configTargetsThisStation(const String &json) {
  String stationKey = "\"station_id\":\"";
  stationKey += STATION_ID;
  stationKey += "\"";
  return json.indexOf("\"type\":\"config\"") >= 0 && json.indexOf(stationKey) >= 0;
}

void applyConfigCommand(const String &json) {
  if (!configTargetsThisStation(json)) {
    return;
  }

  const uint32_t sampleSeconds = extractUintField(json, "sample_interval_seconds", configuredSampleIntervalMs / 1000UL);
  const uint32_t sleepSeconds = extractUintField(json, "sleep_interval_seconds", configuredSleepIntervalMs / 1000UL);

  configuredSampleIntervalMs = max<uint32_t>(5000UL, sampleSeconds * 1000UL);
  configuredSleepIntervalMs = sleepSeconds * 1000UL;

  Serial.printf("[CONFIG] sample=%lus sleep=%lus\n", configuredSampleIntervalMs / 1000UL, configuredSleepIntervalMs / 1000UL);
}

void readLoRaCommands() {
  while (loraSerial.available() > 0) {
    const char c = static_cast<char>(loraSerial.read());
    if (c == '\n') {
      loraCommandLine.trim();
      if (loraCommandLine.length() > 0) {
        applyConfigCommand(loraCommandLine);
      }
      loraCommandLine = "";
    } else if (c != '\r') {
      loraCommandLine += c;
      if (loraCommandLine.length() > 360) {
        loraCommandLine = "";
      }
    }
  }
}

bool cabinetOpen() {
  return digitalRead(CABINET_PROX_PIN) == CABINET_OPEN_LEVEL;
}

bool fieldMotionDetected() {
  return digitalRead(PIR_SENSOR_PIN) == PIR_ACTIVE_LEVEL;
}

void updateMaintenanceLights() {
  if (fieldMotionDetected()) {
    fieldLightUntilMs = millis() + FIELD_LIGHT_HOLD_MS;
  }

  digitalWrite(FIELD_LIGHT_MOSFET_PIN, millis() < fieldLightUntilMs ? HIGH : LOW);
  digitalWrite(CABINET_LIGHT_PIN, cabinetOpen() ? HIGH : LOW);
}

void maybeEnterConfiguredSleep() {
  if (configuredSleepIntervalMs == 0 || cabinetOpen() || millis() < fieldLightUntilMs) {
    return;
  }

  Serial.printf("[POWER] Deep sleep %lu seconds\n", configuredSleepIntervalMs / 1000UL);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(configuredSleepIntervalMs) * 1000ULL);
  esp_deep_sleep_start();
}

SensorValue readA02yyuwDistanceCm(uint32_t timeoutMs = 250) {
  const uint32_t startedAt = millis();

  while (ultrasonicSerial.available() > 0) {
    if (ultrasonicSerial.peek() == 0xFF) {
      break;
    }
    ultrasonicSerial.read();
  }

  while (millis() - startedAt < timeoutMs) {
    if (ultrasonicSerial.available() < 4) {
      delay(5);
      continue;
    }

    if (ultrasonicSerial.read() != 0xFF) {
      continue;
    }

    const uint8_t highByte = ultrasonicSerial.read();
    const uint8_t lowByte = ultrasonicSerial.read();
    const uint8_t checksum = ultrasonicSerial.read();
    const uint8_t expected = static_cast<uint8_t>(0xFF + highByte + lowByte);

    if (checksum != expected) {
      return {false, NAN, "checksum_error"};
    }

    const uint16_t distanceMm = (static_cast<uint16_t>(highByte) << 8) | lowByte;
    const float distanceCm = distanceMm / 10.0f;

    if (distanceCm < A02YYUW_MIN_CM || distanceCm > A02YYUW_MAX_CM) {
      return {false, distanceCm, "out_of_range"};
    }

    return {true, distanceCm, "ok"};
  }

  return {false, NAN, "timeout"};
}

SensorValue readWaterEc() {
  /*
    Placeholder for ES-EC-WT-01 RS485 reading.

    Fill this function after the sensor protocol is confirmed:
    - Modbus slave address
    - register address for EC
    - data type / scale
    - optional temperature compensation

    Expected output:
    - value: EC in uS/cm
    - status: "ok", "warn", or a fault reason
  */

  setRs485Transmit(false);
  return {false, NAN, "pending_ec_protocol"};
}

float estimateSalinityPpt(float ecUsCm) {
  if (!isfinite(ecUsCm)) {
    return NAN;
  }

  // Rough placeholder only. Replace with calibrated conversion later.
  return ecUsCm / 1000.0f * 0.64f;
}

StationReading collectReading() {
  const SensorValue distance = readA02yyuwDistanceCm();
  const SensorValue ec = readWaterEc();

  const float waterLevel = distance.ok ? max(0.0f, SENSOR_HEIGHT_CM - distance.value) : NAN;
  const float salinity = ec.ok ? estimateSalinityPpt(ec.value) : NAN;

  sequenceNumber += 1;

  return {
    sequenceNumber,
    distance.ok ? distance.value : NAN,
    waterLevel,
    ec.ok ? ec.value : NAN,
    salinity,
    distance.status,
    ec.status,
  };
}

String numberOrNull(float value, uint8_t decimals) {
  if (!isfinite(value)) {
    return "null";
  }
  return String(value, static_cast<unsigned int>(decimals));
}

String buildPayload(const StationReading &reading) {
  String payload;
  payload.reserve(360);
  payload += "{";
  payload += "\"station_id\":\"";
  payload += STATION_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"message_id\":\"";
  payload += STATION_ID;
  payload += "-";
  payload += String(bootNonce, HEX);
  payload += "-";
  payload += String(reading.sequence);
  payload += "\",\"uptime_ms\":";
  payload += String(millis());
  payload += ",\"sensor_height_cm\":";
  payload += String(SENSOR_HEIGHT_CM, 1);
  payload += ",\"distance_cm\":";
  payload += numberOrNull(reading.distanceCm, 1);
  payload += ",\"water_level_cm\":";
  payload += numberOrNull(reading.waterLevelCm, 1);
  payload += ",\"ec_us_cm\":";
  payload += numberOrNull(reading.ecUsCm, 1);
  payload += ",\"salinity_ppt\":";
  payload += numberOrNull(reading.salinityPpt, 2);
  payload += ",\"ultrasonic_status\":\"";
  payload += reading.ultrasonicStatus;
  payload += "\",\"ec_status\":\"";
  payload += reading.ecStatus;
  payload += "\"}";
  return payload;
}

void appendToSd(const String &payload) {
  if (!sdReady) {
    return;
  }

  rotateLogIfNeeded(LOG_PATH, OLD_LOG_PATH, MAX_LOG_FILE_BYTES);

  File file = SD.open(LOG_PATH, FILE_APPEND);
  if (!file) {
    Serial.println("[SD] Cannot open station log");
    return;
  }

  file.println(payload);
  file.close();
}

void sendToGateway(const String &payload) {
  loraSerial.println(payload);
}

void setup() {
  Serial.begin(DEBUG_BAUD);
  delay(300);

  setupWatchdog();
  bootNonce = esp_random();

  pinMode(EC_RS485_DE_RE_PIN, OUTPUT);
  pinMode(PIR_SENSOR_PIN, INPUT);
  pinMode(CABINET_PROX_PIN, INPUT_PULLUP);
  pinMode(FIELD_LIGHT_MOSFET_PIN, OUTPUT);
  pinMode(CABINET_LIGHT_PIN, OUTPUT);
  digitalWrite(FIELD_LIGHT_MOSFET_PIN, LOW);
  digitalWrite(CABINET_LIGHT_PIN, LOW);

  setRs485Transmit(false);

  ultrasonicSerial.begin(A02YYUW_BAUD, SERIAL_8N1, A02YYUW_RX_PIN, A02YYUW_TX_PIN);
  ecSerial.begin(EC_RS485_BAUD, SERIAL_8N1, EC_RS485_RX_PIN, EC_RS485_TX_PIN);
  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);

  sdSpi.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
  sdReady = SD.begin(SD_CS_PIN, sdSpi);

  Serial.println();
  Serial.println("[HORIZON] Station 1 water node starting");
  Serial.printf("[HORIZON] Station: %s\n", STATION_ID);
  Serial.printf("[A02YYUW] Sensor height: %.1f cm\n", SENSOR_HEIGHT_CM);
  Serial.printf("[SD] %s\n", sdReady ? "ready" : "not available");
  Serial.printf("[POWER] sample=%lus sleep=%lus\n", configuredSampleIntervalMs / 1000UL, configuredSleepIntervalMs / 1000UL);
}

void loop() {
  esp_task_wdt_reset();
  readLoRaCommands();
  updateMaintenanceLights();

  const uint32_t now = millis();
  if (now - lastSampleMs < configuredSampleIntervalMs) {
    delay(20);
    return;
  }
  lastSampleMs = now;

  const StationReading reading = collectReading();
  const String payload = buildPayload(reading);

  appendToSd(payload);
  sendToGateway(payload);

  Serial.println(payload);
  maybeEnterConfiguredSleep();
}
