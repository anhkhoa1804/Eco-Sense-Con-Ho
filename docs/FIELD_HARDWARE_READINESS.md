# Field Hardware Readiness (Con Ho Pilot)

This checklist is focused on real-world reliability risks that usually break community IoT systems after initial launch.

## 1. Enclosure and Corrosion

- Verify ingress rating target (minimum IP65, preferred IP67).
- Confirm cable gland sealing after 24h rain simulation.
- Confirm anti-corrosion treatment for exposed connectors.
- Confirm desiccant replacement schedule in maintenance plan.

## 2. Probe Stability and Calibration

- Record baseline EC calibration before deployment.
- Run drift check at day 7 and day 30.
- Define probe cleaning process and frequency.
- Define replacement threshold for unstable EC probes.

## 3. Power and Battery

- Verify battery voltage profile for at least 7 duty cycles.
- Confirm low-battery event threshold and alert path.
- Confirm solar charging recovery after 2 cloudy days.
- Confirm device can survive one full day without charging.

## 4. Connectivity

- Measure LTE signal and packet success at each site.
- Record weak-signal windows by hour.
- Confirm store-and-forward queue drains on reconnect.
- Confirm retry behavior does not produce duplicate telemetry rows.

## 5. Physical Security and Maintenance Access

- Confirm mounting security and vandal resistance.
- Confirm safe access path for maintenance staff.
- Add station label with support contact and device ID.
- Document tool kit and spare parts for field visits.

## 6. Pilot Acceptance Gate

Each station can enter production pilot only if all are true:

- 30-day uptime target met.
- No unresolved sensor_fault events.
- Median signal strength is above agreed floor.
- Battery remains above safe threshold under normal weather.
- Data continuity meets project KPI target.
