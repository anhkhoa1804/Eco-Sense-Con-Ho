#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <esp_sleep.h>
#include <esp_task_wdt.h>

/*
  HORIZON - Station 2, grapefruit soil node

  Hardware:
  - ESP32
  - SHT30 ambient temperature / humidity sensor, I2C
  - ES-SM-THEC-01 soil temperature / moisture / EC sensor, RS485 Modbus RTU
  - ES-PH-SOIL-01 soil pH sensor, RS485 Modbus RTU
  - SX1278 LoRa UART module, used to send readings to the gateway
  - microSD module, SPI, used as local store-and-forward backup
  - Cabinet proximity/door sensor, turns on a small cabinet light when opened

  RS485 wiring:
  - Connect both soil sensors in parallel on the same A/B bus.
  - ES-SM-THEC-01 slave ID = 1
  - ES-PH-SOIL-01 slave ID = 2

  Grapefruit guidance:
  - Soil moisture above 80% for too long can cause root rot / yellow leaves.
  - Soil EC should stay below roughly 1.5-2.0 mS/cm.
  - Good soil pH range is about 5.5-6.5.

  TODO:
  - Confirm ESP32 board pinout.
  - Confirm exact Modbus registers and scaling from both sensor datasheets.
  - Confirm LoRa UART module baud rate / AT command mode if needed.
*/

static const char *STATION_ID = "STATION_02";
static const char *FIRMWARE_VERSION = "station2-grapefruit-soil-0.1.0";

// Serial baud rates.
static const uint32_t DEBUG_BAUD = 115200;
static const uint32_t RS485_BAUD = 9600;
static const uint32_t LORA_UART_BAUD = 9600;

// TODO: update these pins after wiring is finalized.
static const int I2C_SDA_PIN = 21;
static const int I2C_SCL_PIN = 22;

static const int RS485_RX_PIN = 26;
static const int RS485_TX_PIN = 27;
static const int RS485_DE_RE_PIN = 25;  // MAX485 DE and RE tied together.

static const int LORA_UART_RX_PIN = 32;
static const int LORA_UART_TX_PIN = 33;

static const int SD_SCK_PIN = 18;
static const int SD_MISO_PIN = 19;
static const int SD_MOSI_PIN = 23;
static const int SD_CS_PIN = 5;

static const uint8_t SHT30_I2C_ADDR = 0x44;

static const uint8_t SOIL_THEC_SLAVE_ID = 1;
static const uint8_t SOIL_PH_SLAVE_ID = 2;

// Common default for many RS485 soil sensors.
// ES-SM-THEC-01 expected registers:
//   register 0: soil moisture, scale 0.1 %
//   register 1: soil temperature, scale 0.1 C, signed
//   register 2: soil EC, uS/cm
static const uint16_t THEC_START_REG = 0x0000;
static const uint16_t THEC_REG_COUNT = 3;

// Common default for many RS485 pH sensors.
// ES-PH-SOIL-01 expected register:
//   register 0: pH, scale 0.1
static const uint16_t PH_START_REG = 0x0000;
static const uint16_t PH_REG_COUNT = 1;

static const uint32_t DEFAULT_SAMPLE_INTERVAL_MS = 5000;
static const uint32_t DEFAULT_SLEEP_INTERVAL_MS = 0;
static const uint32_t WATCHDOG_TIMEOUT_MS = 15000;
static const size_t MAX_LOG_FILE_BYTES = 1024UL * 1024UL;

static const int CABINET_PROX_PIN = 35;
static const int CABINET_LIGHT_PIN = 12;
static const bool CABINET_OPEN_LEVEL = LOW;

static const char *LOG_PATH = "/station2.log";
static const char *OLD_LOG_PATH = "/station2.old";

HardwareSerial rs485Serial(2);
HardwareSerial loraSerial(1);
SPIClass sdSpi(VSPI);

struct SensorValue {
  bool ok;
  float value;
  const char *status;
};

struct Sht30Reading {
  SensorValue airTempC;
  SensorValue airHumidityPct;
};

struct SoilThecReading {
  SensorValue soilMoisturePct;
  SensorValue soilTempC;
  SensorValue soilEcUsCm;
};

struct StationReading {
  uint32_t sequence;
  Sht30Reading ambient;
  SoilThecReading soilThec;
  SensorValue soilPh;
  const char *grapefruitAdvice;
};

RTC_DATA_ATTR static uint32_t sequenceNumber = 0;
static bool sdReady = false;
static uint32_t lastSampleMs = 0;
static uint32_t configuredSampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS;
static uint32_t configuredSleepIntervalMs = DEFAULT_SLEEP_INTERVAL_MS;
static String loraCommandLine;

void setRs485Transmit(bool enabled) {
  digitalWrite(RS485_DE_RE_PIN, enabled ? HIGH : LOW);
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

void updateCabinetLight() {
  digitalWrite(CABINET_LIGHT_PIN, cabinetOpen() ? HIGH : LOW);
}

void maybeEnterConfiguredSleep() {
  if (configuredSleepIntervalMs == 0 || cabinetOpen()) {
    return;
  }

  Serial.printf("[POWER] Deep sleep %lu seconds\n", configuredSleepIntervalMs / 1000UL);
  Serial.flush();
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(configuredSleepIntervalMs) * 1000ULL);
  esp_deep_sleep_start();
}

uint8_t crc8Sht30(const uint8_t *data, size_t len) {
  uint8_t crc = 0xFF;
  for (size_t i = 0; i < len; i += 1) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x31) : static_cast<uint8_t>(crc << 1);
    }
  }
  return crc;
}

Sht30Reading readSht30() {
  Wire.beginTransmission(SHT30_I2C_ADDR);
  Wire.write(0x2C);
  Wire.write(0x06);
  if (Wire.endTransmission() != 0) {
    return {{false, NAN, "i2c_error"}, {false, NAN, "i2c_error"}};
  }

  delay(20);

  if (Wire.requestFrom(static_cast<int>(SHT30_I2C_ADDR), 6) != 6) {
    return {{false, NAN, "timeout"}, {false, NAN, "timeout"}};
  }

  uint8_t raw[6];
  for (uint8_t i = 0; i < 6; i += 1) {
    raw[i] = Wire.read();
  }

  if (crc8Sht30(raw, 2) != raw[2] || crc8Sht30(raw + 3, 2) != raw[5]) {
    return {{false, NAN, "checksum_error"}, {false, NAN, "checksum_error"}};
  }

  const uint16_t rawTemp = (static_cast<uint16_t>(raw[0]) << 8) | raw[1];
  const uint16_t rawHum = (static_cast<uint16_t>(raw[3]) << 8) | raw[4];

  const float tempC = -45.0f + 175.0f * (static_cast<float>(rawTemp) / 65535.0f);
  const float humidityPct = 100.0f * (static_cast<float>(rawHum) / 65535.0f);

  return {{true, tempC, "ok"}, {true, humidityPct, "ok"}};
}

uint16_t crc16Modbus(const uint8_t *data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i += 1) {
    crc ^= data[i];
    for (uint8_t bit = 0; bit < 8; bit += 1) {
      if (crc & 0x0001) {
        crc = static_cast<uint16_t>((crc >> 1) ^ 0xA001);
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

bool readHoldingRegisters(uint8_t slaveId, uint16_t startReg, uint16_t regCount, uint16_t *outRegs, uint32_t timeoutMs = 500) {
  if (regCount == 0 || regCount > 8) {
    return false;
  }

  while (rs485Serial.available() > 0) {
    rs485Serial.read();
  }

  uint8_t request[8];
  request[0] = slaveId;
  request[1] = 0x03;
  request[2] = highByte(startReg);
  request[3] = lowByte(startReg);
  request[4] = highByte(regCount);
  request[5] = lowByte(regCount);
  const uint16_t requestCrc = crc16Modbus(request, 6);
  request[6] = lowByte(requestCrc);
  request[7] = highByte(requestCrc);

  setRs485Transmit(true);
  rs485Serial.write(request, sizeof(request));
  rs485Serial.flush();
  setRs485Transmit(false);

  const uint8_t expectedLen = static_cast<uint8_t>(5 + regCount * 2);
  uint8_t response[32];
  uint8_t count = 0;
  const uint32_t startedAt = millis();

  while (millis() - startedAt < timeoutMs && count < expectedLen) {
    if (rs485Serial.available() > 0) {
      response[count] = rs485Serial.read();
      count += 1;
    } else {
      delay(2);
    }
  }

  if (count != expectedLen) {
    return false;
  }

  const uint16_t receivedCrc = static_cast<uint16_t>(response[count - 2]) | (static_cast<uint16_t>(response[count - 1]) << 8);
  const uint16_t expectedCrc = crc16Modbus(response, count - 2);
  if (receivedCrc != expectedCrc) {
    return false;
  }

  if (response[0] != slaveId || response[1] != 0x03 || response[2] != regCount * 2) {
    return false;
  }

  for (uint16_t i = 0; i < regCount; i += 1) {
    const uint8_t offset = static_cast<uint8_t>(3 + i * 2);
    outRegs[i] = (static_cast<uint16_t>(response[offset]) << 8) | response[offset + 1];
  }

  return true;
}

SoilThecReading readSoilThec() {
  uint16_t regs[THEC_REG_COUNT] = {0};
  if (!readHoldingRegisters(SOIL_THEC_SLAVE_ID, THEC_START_REG, THEC_REG_COUNT, regs)) {
    return {
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
      {false, NAN, "modbus_error"},
    };
  }

  const float moisturePct = regs[0] / 10.0f;
  const int16_t rawTemp = static_cast<int16_t>(regs[1]);
  const float tempC = rawTemp / 10.0f;
  const float ecUsCm = static_cast<float>(regs[2]);

  return {
    {true, moisturePct, "ok"},
    {true, tempC, "ok"},
    {true, ecUsCm, "ok"},
  };
}

SensorValue readSoilPh() {
  uint16_t regs[PH_REG_COUNT] = {0};
  if (!readHoldingRegisters(SOIL_PH_SLAVE_ID, PH_START_REG, PH_REG_COUNT, regs)) {
    return {false, NAN, "modbus_error"};
  }

  const float ph = regs[0] / 10.0f;
  if (ph < 0.0f || ph > 14.0f) {
    return {false, ph, "out_of_range"};
  }

  return {true, ph, "ok"};
}

float ecUsCmToMsCm(float ecUsCm) {
  if (!isfinite(ecUsCm)) {
    return NAN;
  }
  return ecUsCm / 1000.0f;
}

const char *buildGrapefruitAdvice(float moisturePct, float ecMsCm, float ph) {
  if (isfinite(moisturePct) && moisturePct > 80.0f) {
    return "soil_too_wet_stop_pump_check_root_rot_risk";
  }

  if (isfinite(ecMsCm) && ecMsCm >= 2.0f) {
    return "soil_ec_high_reduce_fertilizer_flush_salt";
  }

  if (isfinite(ecMsCm) && ecMsCm >= 1.5f) {
    return "soil_ec_warning_monitor_before_fertilizing";
  }

  if (isfinite(ph) && ph < 5.0f) {
    return "soil_too_acidic_check_lime_and_nutrient_plan";
  }

  if (isfinite(ph) && ph > 7.0f) {
    return "soil_too_alkaline_watch_micronutrient_deficiency";
  }

  if (isfinite(ph) && (ph < 5.5f || ph > 6.5f)) {
    return "soil_ph_near_edge_monitor_grapefruit_root_zone";
  }

  return "soil_conditions_suitable_continue_monitoring";
}

StationReading collectReading() {
  sequenceNumber += 1;

  Sht30Reading ambient = readSht30();
  SoilThecReading soilThec = readSoilThec();
  SensorValue soilPh = readSoilPh();

  const float ecMsCm = soilThec.soilEcUsCm.ok ? ecUsCmToMsCm(soilThec.soilEcUsCm.value) : NAN;
  const char *advice = buildGrapefruitAdvice(
    soilThec.soilMoisturePct.ok ? soilThec.soilMoisturePct.value : NAN,
    ecMsCm,
    soilPh.ok ? soilPh.value : NAN
  );

  return {
    sequenceNumber,
    ambient,
    soilThec,
    soilPh,
    advice,
  };
}

String numberOrNull(float value, uint8_t decimals) {
  if (!isfinite(value)) {
    return "null";
  }
  return String(value, static_cast<unsigned int>(decimals));
}

void addSensorJson(String &payload, const char *key, const SensorValue &sensor, uint8_t decimals) {
  payload += "\"";
  payload += key;
  payload += "\":";
  payload += numberOrNull(sensor.value, decimals);
  payload += ",\"";
  payload += key;
  payload += "_status\":\"";
  payload += sensor.status;
  payload += "\"";
}

String buildPayload(const StationReading &reading) {
  const float soilEcMsCm = reading.soilThec.soilEcUsCm.ok ? ecUsCmToMsCm(reading.soilThec.soilEcUsCm.value) : NAN;

  String payload;
  payload.reserve(620);
  payload += "{";
  payload += "\"station_id\":\"";
  payload += STATION_ID;
  payload += "\",\"firmware_version\":\"";
  payload += FIRMWARE_VERSION;
  payload += "\",\"message_id\":\"";
  payload += STATION_ID;
  payload += "-";
  payload += String(reading.sequence);
  payload += "\",\"uptime_ms\":";
  payload += String(millis());
  payload += ",";
  addSensorJson(payload, "air_temp_c", reading.ambient.airTempC, 1);
  payload += ",";
  addSensorJson(payload, "air_humidity_pct", reading.ambient.airHumidityPct, 1);
  payload += ",";
  addSensorJson(payload, "soil_temp_c", reading.soilThec.soilTempC, 1);
  payload += ",";
  addSensorJson(payload, "soil_moisture_pct", reading.soilThec.soilMoisturePct, 1);
  payload += ",";
  addSensorJson(payload, "soil_ec_us_cm", reading.soilThec.soilEcUsCm, 0);
  payload += ",\"soil_ec_ms_cm\":";
  payload += numberOrNull(soilEcMsCm, 2);
  payload += ",";
  addSensorJson(payload, "soil_ph", reading.soilPh, 1);
  payload += ",\"crop\":\"grapefruit\"";
  payload += ",\"advice\":\"";
  payload += reading.grapefruitAdvice;
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

  pinMode(RS485_DE_RE_PIN, OUTPUT);
  pinMode(CABINET_PROX_PIN, INPUT_PULLUP);
  pinMode(CABINET_LIGHT_PIN, OUTPUT);
  digitalWrite(CABINET_LIGHT_PIN, LOW);

  setRs485Transmit(false);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  rs485Serial.begin(RS485_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  loraSerial.begin(LORA_UART_BAUD, SERIAL_8N1, LORA_UART_RX_PIN, LORA_UART_TX_PIN);

  sdSpi.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
  sdReady = SD.begin(SD_CS_PIN, sdSpi);

  Serial.println();
  Serial.println("[HORIZON] Station 2 grapefruit soil node starting");
  Serial.printf("[HORIZON] Station: %s\n", STATION_ID);
  Serial.printf("[RS485] ES-SM-THEC-01 slave ID: %u\n", SOIL_THEC_SLAVE_ID);
  Serial.printf("[RS485] ES-PH-SOIL-01 slave ID: %u\n", SOIL_PH_SLAVE_ID);
  Serial.printf("[SD] %s\n", sdReady ? "ready" : "not available");
  Serial.printf("[POWER] sample=%lus sleep=%lus\n", configuredSampleIntervalMs / 1000UL, configuredSleepIntervalMs / 1000UL);
}

void loop() {
  esp_task_wdt_reset();
  readLoRaCommands();
  updateCabinetLight();

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
