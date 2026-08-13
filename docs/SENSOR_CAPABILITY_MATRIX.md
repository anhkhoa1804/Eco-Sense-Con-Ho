# Sensor Capability Matrix

What HORIZON can honestly claim to measure, traced from physical sensor
through firmware, wire contract, database column, repository method, to
frontend display. A metric only belongs on the "real" list if every link
in that chain is unbroken.

| Metric | Physical sensor | Firmware status | DB column | Repository method | Frontend display | Verdict |
|---|---|---|---|---|---|---|
| Water level | A02YYUW ultrasonic (Station 1) | ✅ implemented, checksum-verified | `environmental_readings.water_level` | `getLatestByStation`, `getTrend24h`, `getDailyComparison` | Dashboard, station detail, daily chart | ⚠️ **Sensor and every read-side layer are real, but no row can currently be stored at all** — see below. Not "real, pending verification" as I first wrote in this file; that was wrong and is corrected here |
| Salinity | ES-EC-WT-01 EC probe (Station 1) | ❌ **stub** — `readWaterEc()` always returns NAN (trạm 1.ino:279-296) | `environmental_readings.salinity` | same as above | Dashboard, station detail, salinity chart, daily chart | ❌ Same fault cascade as water level below |
| Water EC (raw µS/cm) | ES-EC-WT-01 | ❌ stub, same as above | not persisted (only derived salinity would be) | — | not displayed | Same stub; also never separately stored — only the derived `salinity_ppt` reaches the wire contract |
| Battery voltage (station) | none — gateway can't measure a relayed station's battery | N/A by design | `station_health_logs.battery_voltage` (nullable since 018) | `getLatestHealthByStation` | Station detail "Pin trạm" tile | **Column exists, correctly nullable, but no station in the current gateway-relay topology can ever populate it** — honestly shown as "Chưa có dữ liệu" always, by design, not a bug |
| Signal strength | none — same reason | N/A by design | `station_health_logs.signal_strength_dbm` (nullable) | same | Station detail "Tín hiệu" | Same as battery — structurally always empty for relayed stations |
| Soil moisture | ES-SM-THEC-01 Modbus (Station 2) | ✅ implemented, CRC16-verified | `soil_readings.soil_moisture_pct` | **none — no repository method queries `soil_readings`** | Station detail shows "Chưa có dữ liệu" | **Sensor and DB column are both real; the read path is missing.** This is the single most fixable, well-scoped gap in the whole system |
| Soil EC | ES-SM-THEC-01 | ✅ implemented | `soil_readings.soil_ec_ms_cm` | none | not displayed | Same gap as soil moisture |
| Soil temperature | ES-SM-THEC-01 | ✅ implemented | `soil_readings.soil_temp_c` | none | not displayed | Same gap |
| Soil pH | ES-PH-SOIL-01 Modbus (Station 2) | ✅ implemented, CRC16-verified | `soil_readings.soil_ph` | none | not displayed | Same gap |
| Air temperature | SHT30 I2C (Station 2) | ✅ implemented, CRC-verified | `soil_readings.air_temp_c` | none | not displayed | Same gap |
| Air humidity | SHT30 | ✅ implemented | `soil_readings.air_humidity_pct` | none | not displayed | Same gap |
| Sensor fault status (water) | derived from ultrasonic checksum/range + EC stub's permanent "pending" state | ✅ implemented (though EC's status is always the stub's fixed value) | `environmental_readings.ec_probe_status`/`ultrasonic_status` | all readingRepository methods that select `*` | Station detail "Cảm biến EC/độ mặn"/"Cảm biến mực nước" | **Real** — the status enum is honestly reported even though the underlying EC value is stubbed |
| Sensor fault status (soil) | per-sensor null-on-fault, no combined flag | ✅ implemented (each of 6 sensors independently) | not modeled as a status enum — absence (`null`) is the fault signal | none (repository gap) | not displayed | Blocked by the same repository gap |
| Gateway delivery rate / uptime | N/A — computed, not sensed | N/A | not persisted anywhere | none | Station detail (STATION_03 profile) shows "Tỷ lệ gửi: Chưa có dữ liệu" | **Never implemented at any layer** — `stationProfiles.STATION_03` in `station-detail.tsx` defines a `deliveryRate` chart series key that has no backing data source anywhere in the schema. This is aspirational UI wiring, correctly rendering empty, but the underlying capability doesn't exist |
| "Đề xuất" / grapefruit advice | computed firmware-side from moisture/EC/pH thresholds (`buildGrapefruitAdvice()`, trạm 2.ino:407-433) | ✅ implemented, but only reachable if soil sensors + relay succeed | sent in the raw station→gateway payload as `advice`, but **the gateway's `buildSoilContractPayloadJson()` does not forward this field to the backend** (verified: gateway.ino:575-616 has no `advice` key) | — | not displayed anywhere in current UI | Computed on-device, silently dropped at the gateway relay step — a real, findable gap if this field is ever wanted server-side |

## Critical finding: Trạm 1 currently cannot store any reading at all

`readWaterEc()`'s permanent stub means `ec_status` is always
`"pending_ec_protocol"`, which `mapSensorStatus()` maps to `"fault"`
(gateway.ino:375-380 — only `"ok"`/`"warn"` map to anything else). The
gateway then sets `fault_flags = 1` whenever `ecStatus == "fault"`
(`handleWaterStationPayload`, gateway.ino:973-974), and the backend's
`isFaulty()` rejects the entire payload — water level included — with
`SENSOR_FAULT` (422) whenever `fault_flags > 0` or
`sensor_status.ec_probe === "fault"` (`ingest.ts:58-72`). **Every single
Trạm 1 reading today, including the fully-working water-level
measurement, is rejected before it reaches `environmental_readings` —
not because water level is broken, but because it's bundled with a
permanently-faulted EC status in one all-or-nothing payload.** This was
already correctly documented in `docs/ARCHITECTURE_DECISIONS.md` §7 from
an earlier session; this file's water-level row originally missed it and
has been corrected above. It is not a bug to fix quietly — it's the
system correctly refusing to store a reading it can't fully vouch for
(no reading with a known-faulted sensor gets silently split into "the
good half"). The real fix is implementing `readWaterEc()` against the
actual EC probe, which needs the physical sensor or its datasheet —
neither available in this environment (also already noted in
`ARCHITECTURE_DECISIONS.md` §9).

## Rules this matrix enforces going forward

- A metric moves from "not displayed" to "displayed" only after every
  cell in its row is checked, in order: sensor → firmware → contract →
  DB column → repository method → frontend. Skipping a layer (e.g.
  wiring a frontend display straight to a hoped-for DB column before the
  repository method exists) is exactly the kind of "components exist
  therefore they're integrated" assumption this whole phase exists to
  eliminate.
- Salinity and soil-derived metrics currently rendering "Chưa có dữ
  liệu" across the product are doing so correctly — that is the honest
  state given the stub/gap above, not a bug to silently "fix" with a
  fallback value.
