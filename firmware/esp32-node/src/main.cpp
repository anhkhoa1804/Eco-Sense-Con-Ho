/**
 * Eco-Sense ESP32 node — firmware scaffold (ECO-022)
 *
 * Implements v1 telemetry contract per docs/API_CONTRACTS.md
 * Store-and-forward: see docs/QUEUE_AND_FALLBACK.md
 */

#include <Arduino.h>

#ifndef ECO_CONTRACT_VERSION
#define ECO_CONTRACT_VERSION "v1"
#endif

#ifndef ECO_DEFAULT_DEVICE_ID
#define ECO_DEFAULT_DEVICE_ID "STATION_01"
#endif

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[eco-sense] ESP32 node scaffold");
  Serial.printf("  contract: %s\n", ECO_CONTRACT_VERSION);
  Serial.printf("  device_id: %s\n", ECO_DEFAULT_DEVICE_ID);
  Serial.println("  TODO: sensor init, LTE attach, HMAC sign, POST edge-ingest");
}

void loop() {
  // Duty cycle: wake every 30 min — see FIRMWARE_SPEC.md
  delay(30000);
  Serial.println("[eco-sense] wake cycle placeholder");
}
