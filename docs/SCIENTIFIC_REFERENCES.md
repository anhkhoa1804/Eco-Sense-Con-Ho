# Scientific references

The basis for every interpretation HORIZON puts on screen, and — more often —
the reason it refuses to put one there.

The rule this document exists to enforce: **a number gets a colour, a word or
a status only when a published threshold applies to the exact quantity the
sensor produces, in the context it is produced in.** Where that is not true,
the value is shown plainly with no status. Filling every box with a colour
would make the dashboard look more knowledgeable than the project is.

Each entry below records: metric · unit · rule · threshold · source · scope ·
limitation.

---

## 1. Water salinity — the central quantity, and the hardest

**What the UI shows:** salinity in **‰** (parts per thousand, equivalently
g/L), on the observatory's primary box.

**Status rule applied today:** only the project's own `crop_thresholds` row,
if one is configured. Absent that row, the value renders with **no status** —
see `lib/monitoring/status.ts`, which returns no opinion rather than guessing.

### The reference that actually fits this context

For the Vietnamese Mekong Delta, the operationally-used figure is **4 g/L**
(≈ 4 ‰): salinity in irrigation water above this level is treated by
Vietnamese authorities as too high for paddy rice to survive the vegetative
stage, and a mean of 4 g/L over February–March is the critical level adopted
in delta salinity-intrusion forecasting.

- Source: Seasonal prediction of salinity intrusion in the Mekong Delta,
  *Natural Hazards and Earth System Sciences* 20, 1609–1616 (2020).
  https://nhess.copernicus.org/articles/20/1609/2020/
- Scope: **irrigation water**, Mekong Delta, **paddy rice**, dry-season
  intrusion.
- Limitation that matters here: **Cồn Hô is a fruit-growing islet, not a rice
  field.** Fruit trees — pomelo among them — are generally *more* salt-
  sensitive than rice, so 4 g/L is an upper bound from a more tolerant crop,
  not a safe level for this place. It is recorded as orientation, and is
  deliberately **not** wired into the UI as a threshold.

### The FAO guideline, and why it is not applied directly

FAO Irrigation and Drainage Paper 29 rev. 1 (Ayers & Westcot, 1985),
*Water Quality for Agriculture*, classifies irrigation water by **electrical
conductivity ECw in dS/m**:

| ECw (dS/m) | Degree of restriction on use |
| --- | --- |
| < 0.7 | None |
| 0.7 – 3.0 | Slight to moderate |
| > 3.0 | Severe |

- Source: FAO I&D Paper 29 rev.1, https://www.fao.org/4/t0234e/t0234e00.htm
- Scope: irrigation water quality, general agriculture.

**This is not applied to the ‰ figure, and must not be.** See §2.

---

## 2. ‰ ↔ dS/m — NOT converted, and why

**Salinity in ‰ and conductivity in dS/m are different physical quantities.**
‰ is a mass concentration of dissolved solids; dS/m is the electrical
conductivity of the solution. They correlate, but the constant relating them
depends on the **ionic composition** and the **temperature** of the specific
water — it is not a universal factor.

At Cồn Hô the water is a *mixture*: river water and intruding seawater in a
ratio that changes with tide and season. The ionic composition therefore
changes with the very quantity being measured, which is exactly the case where
a fixed conversion factor is least defensible.

Common rules of thumb (TDS ≈ 640 × EC, or ≈ 700 × EC) exist, but they are
calibrated for particular water types and carry errors large enough to move a
reading across a decision boundary.

**Adopted position:** salinity and EC are carried as **separate quantities**.
No conversion is performed anywhere in the codebase. If a threshold is ever
needed against the FAO EC table, it requires measuring EC directly — not
converting a ‰ reading into one.

**Additional blocker, recorded honestly:** the water EC probe (ES-EC-WT-01) is
installed but its firmware read path is not implemented, so the project has
also never established the local EC↔salinity relationship empirically. Until
it does, calibrating either threshold locally is not possible.

---

## 3. Soil EC, soil moisture, soil pH — no status shown

**What the UI shows:** values only. No colour, no interpretation word.

**Why.** Turning soil moisture, EC or pH into agronomic advice depends on the
crop, the soil texture, the rooting depth and the season. The distinction that
blocks a shortcut here: the FAO/USDA soil-salinity literature is written
against **ECe — the saturated paste extract** of a soil sample, a laboratory
preparation. An in-situ probe reports **bulk soil EC**, which is a different
quantity, related to ECe through soil-specific factors (water content, bulk
density, temperature).

- Reference class for ECe-based rice tolerance (~3 dS/m ECe): see the Mekong
  Delta salinity/acid-sulfate literature,
  https://www.tandfonline.com/doi/full/10.2489/jswc.2023.0321A
- Scope: ECe, laboratory extract, named crops.
- Limitation: **the project measures bulk EC in situ, not ECe.** No conversion
  is applied, and no status is shown.

Soil pH and soil moisture are likewise displayed without interpretation: no
crop-and-soil-specific reference has been established for Cồn Hô.

---

## 4. Wind — interpreted, WMO Beaufort scale

**What the UI shows:** wind speed in km/h with a short contextual phrase.

**Rule:** Beaufort force bands, converted to km/h. The scale is a WMO
standard and is defined on wind speed alone, which is why it is safe to apply
where the humidity/temperature indices in §6 are not.

- Source: WMO Beaufort wind force scale.
- Scope: open-air wind speed at standard measurement height.
- Limitation: the value shown is the **external weather model** for the grid
  cell (Open-Meteo), not a HORIZON anemometer. Provenance is carried in the
  model as `origin: "external"`.

Band boundaries as implemented are recorded in `docs/ASSET-SOURCES.md` and
`lib/monitoring/context.ts`.

## 5. Rainfall — interpreted, standard intensity classes

**What the UI shows:** rainfall in mm with a short contextual phrase.

**Rule:** conventional rainfall-intensity classes (no rain / light /
moderate / heavy), defined on measured depth per unit time.

- Scope: precipitation depth over the reporting interval.
- Limitation: same external-model provenance as wind.

## 6. Temperature and humidity — deliberately NO interpretation

**What the UI shows:** the values, and nothing else.

**Why.** Every official index that judges human or crop comfort from these —
heat index, humidex, WBGT — is a function of **temperature and humidity
together**, and several also require radiation or wind. A phrase attached to
temperature alone ("trời oi") would be inventing a single-variable rule where
the published science is explicitly multi-variable.

This is the clearest case in the product of choosing a blank over a plausible
label.

---

## 7. Device state — engineering thresholds, not environmental science

Battery voltage and signal strength **do** carry status, from bands in
`lib/monitoring/status.ts`:

| Metric | critical | warn | watch |
| --- | --- | --- | --- |
| Battery | ≤ 3.4 V | ≤ 3.6 V | ≤ 3.8 V |
| Signal | ≤ −100 dBm | ≤ −95 dBm | ≤ −85 dBm |

- Scope: **the hardware's own operating limits** — Li-ion discharge floor,
  LoRa/cellular link budget. These are engineering facts about the device, not
  claims about the environment, which is why they are allowed a status while
  soil pH is not.
- Limitation: not yet validated against these specific units in field
  conditions.

---

## Standing summary

| Metric | Status shown? | Basis |
| --- | --- | --- |
| Water salinity (‰) | Only if a project threshold row is configured | Project-configured, marked unverified |
| Water EC (dS/m) | No — not read by firmware | FAO 29 available once measured |
| Soil EC / moisture / pH | No | ECe vs bulk-EC mismatch; no local reference |
| Wind | Yes | WMO Beaufort |
| Rainfall | Yes | Standard intensity classes |
| Temperature / humidity | No | Indices require both variables together |
| Battery / signal | Yes | Device operating limits |

Anything marked "No" is a deliberate blank, not an unfinished feature.
