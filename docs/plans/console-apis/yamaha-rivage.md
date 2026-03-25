# Yamaha — Rivage PM (PM10 / PM7 / P10 / P3, etc.)

**Status:** Plan / research notes. **Scope:** **OSC** (per vendor PDF) for parameters relevant to **channel / strip naming**, plus **network attachment** rules. Deep scene recall / automation **out of scope**.

Driver **client-side** ([`README.md`](README.md)).

---

## Official OSC specification

| Document | URL |
|----------|-----|
| **RIVAGE PM Series OSC Specifications** (e.g. **V1.0.2**) | [`RIVAGE_PM_osc_specs_v102_en.pdf`](https://uk.yamaha.com/files/download/other_assets/5/1407565/RIVAGE_PM_osc_specs_v102_en.pdf) |

Also linked from [yamaha-rcp-docs — Official Sources](https://github.com/BrenekH/yamaha-rcp-docs).

This PDF is the authoritative list of **OSC addresses**, **argument types**, and **port** expectations for **Rivage PM**—use it to find the exact **Name** or **Label** objects for **input channels**, DCAs, etc.

---

## Parallel: RCP text protocol

The same GitHub overview notes that **QL / CL / Rivage** surfaces may also align with **TCP newline RCP** patterns for some operations. **Rivage PM’s OSC spec** should be preferred if it covers your naming use case; fall back to RCP only if OSC cannot express required labels on your firmware.

---

## Network attachment

Rivage systems use a dedicated **control / PC** network path to the DSP engine (see Yamaha Rivage **Setup** / **Network** manuals). **COL must document**:

- Which **NIC IP** the operator should target (DSP vs surface)
- Whether **multiple subnets** exist (control vs Dante)

---

## Open points

1. Extract the **exact OSC address** pattern for `InputPort` strip names for **one** channel index in the PDF → lab verify.
2. Note **UDP receive port** (if any) for echo / error packets per OSC spec.
3. If OSC naming is insufficient, prototype **`set MIXER:Current/InCh/Label/Name`** over RCP on the **DSP control IP** and compare.
