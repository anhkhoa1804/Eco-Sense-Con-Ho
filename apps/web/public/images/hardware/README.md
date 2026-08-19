# Hardware illustrations

**Status of everything currently in this folder: `placeholder`.**

These are schematic SVG diagrams drawn from the sensor models named in
`docs/SENSOR_CAPABILITY_MATRIX.md` and the firmware sources. They are
**diagrams, not photographs**, and each carries a visible
`SƠ ĐỒ MINH HỌA · PLACEHOLDER` label.

No HORIZON hardware photograph exists in this repository, because no
hardware has been assembled or deployed — `docs/ARCHITECTURE.md`
("FUTURE / NOT YET DONE") records that firmware has never been compiled or
flashed. Nothing in this folder may be captioned or presented as a photo of
built equipment.

| File | Depicts |
| --- | --- |
| `station-water-placeholder.svg` | Station 1 layout — ESP32, A02YYUW ultrasonic, ES-EC-WT-01 EC probe |
| `station-soil-placeholder.svg` | Station 2 layout — ESP32, ES-SM-THEC-01, ES-PH-SOIL-01, SHT30 |
| `gateway-placeholder.svg` | Gateway — ESP32, SX1278 LoRa uplink from both stations, cellular modem |

## Replacing these

Drop a real photograph into this folder and update the referencing
`content/gallery/*.md` entry (or the About hardware section) to point at it,
changing `status:` to `verified`. No code change is required.
