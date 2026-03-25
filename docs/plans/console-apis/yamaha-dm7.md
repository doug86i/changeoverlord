# Yamaha — DM7

**Status:** Plan / research notes. **Scope:** Network **connection** to DM7 for **remote naming** of channels/strips. **Implementation path TBD** (see below).

Driver **client-side** ([`README.md`](README.md)).

---

## Official Yamaha material (starting points)

| Document | URL | Use for COL |
|----------|-----|-------------|
| **DM7 Editor Installation Guide** | Example: [DM7 Editor Installation Guide PDF](https://usa.yamaha.com/files/download/other_assets/3/2139203/dm7_editor_en_ig_a0.pdf) | Confirms **computer ↔ console** LAN use for Editor; lists network prep steps. |
| **DM7 Reference Manual** (network / remote chapter) | Search Yamaha **DM7** → **Downloads** for latest **Reference Manual** | Operational **IP** planning, remote apps (e.g. StageMix mentions **LAN** in product docs). |

At the time of this research pass, a **DM7-specific OSC spec PDF** was **not** located the same way as **DM3** / **Rivage PM**. Treat DM7 as:

1. **Candidate A — OSC:** If Yamaha publishes **`DM7_osc_specs_v*.pdf`** later, use it like Rivage PM OSC.
2. **Candidate B — RCP:** If DM7 reuses **newline TCP** patterns, BrenekH’s `MIXER:Current/.../Label/Name` commands may apply—**prove on hardware** before coding.

---

## Related official OSC spec (different product — pattern only)

| Document | URL |
|----------|-----|
| **DM3 Series OSC Specifications V1.0.0** | [`DM3_osc_specs_v100_en.pdf`](https://fr.yamaha.com/files/download/other_assets/2/2063222/DM3_osc_specs_v100_en.pdf) |

Use only as **Yamaha OSC style reference**; **do not** assume DM3 addresses work on DM7.

---

## Spike checklist

1. Install **DM7 Editor**; capture **TCP/UDP** ports when session goes **online**.
2. If OSC responses appear, map **strip rename** GUI action → OSC packet.
3. If newline `set MIXER:…` text appears, reuse CL/TF RCP parsing code with DM7 path list.
