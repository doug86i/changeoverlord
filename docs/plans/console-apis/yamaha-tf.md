# Yamaha — TF series (TF‑Rack, TF1 / TF3 / TF5)

**Status:** Plan / research notes. **Scope:** **RCP** over **TCP** — connect to the desk and **set input channel labels** with `get` / `set` commands. Mixing parameters **out of scope**.

**RCP** = Yamaha **Remote Control Protocol** (newline‑delimited text).

Driver **client-side** ([`README.md`](README.md)).

---

## Best public references

| Source | URL | Notes |
|--------|-----|-------|
| **Unofficial but detailed RCP guide** | [BrenekH / yamaha-rcp-docs](https://github.com/BrenekH/yamaha-rcp-docs) | Documents `get` / `set`, `NOTIFY`, quoted strings, and lists paths. Explicit **naming** examples: `MIXER:Current/InCh/Label/Name` and `…/InCh/Fader/Name`. |
| **Yamaha Python script pack** | [Python_Script_Template (ZIP)](https://usa.yamaha.com/files/download/other_assets/0/1266290/Python_Script_Template_V100.zip) | Vendor “starter” examples; light on depth but **official**. |
| **Commercial‑install RCP spec (MTX/MRX)** | [RCP spec PDF V4.0.0](https://usa.yamaha.com/files/download/other_assets/5/1343735/200330_mtx_mrx_xmv_ex_rcps_v400_rev14_en.pdf) | Different product line, but explains **command grammar** common to Yamaha RCP. |

Connect the TCP client to the mixer’s **“Mixer Control”** / **Editor** IPv4 address (see Yamaha **System Design** / **Network** PDFs for TF—not the Dante audio interface).

---

## Naming (from yamaha-rcp-docs README)

**Input channel label name** (0‑based channel index `N`):

```text
set MIXER:Current/InCh/Label/Name N 0 "Your Name Here"
get MIXER:Current/InCh/Label/Name N 0
```

There is a parallel **`…/InCh/Fader/Name`** path in the same documentation—confirm on TF firmware which field the **scribble strip** uses for **your** workflow.

Stereo input channels use a different branch (`StInCh/.../Label/Name`) documented in the same repo.

---

## TCP details to confirm per desk

The unofficial docs rarely restate the **TCP port** in the README; Companion integrations historically use a fixed port for TF—**read Yamaha’s TF network manual** or sniff **TF Editor** during connect. Document the confirmed port here after spike.

---

## Open points

1. Record Wireshark session: TF Editor login → **SYN** destination port.
2. Verify **`NOTIFY`** subscription needed for pure write-only COL flow (maybe optional).
3. Extend parser only for **`Name`** paths; ignore metering `NOTIFY` floods.
