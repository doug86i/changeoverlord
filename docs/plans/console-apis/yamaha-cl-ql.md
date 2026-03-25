# Yamaha — CL / QL (CL1/3/5, QL1/5)

**Status:** Plan / research notes. **Scope:** **RCP over TCP** on the **Mixer Control** network port — **strip / channel naming**. Routing, EQ, dynamics **out of scope**.

Driver **client-side** ([`README.md`](README.md)).

---

## Why TF docs are the starting point

Yamaha does not publish a single public “CL RCP bible” mirroring TF. The community consensus ([BrenekH/yamaha-rcp-docs](https://github.com/BrenekH/yamaha-rcp-docs)) is that **CL / QL / Rivage (non‑OSC surfaces)** share the same **text RCP** shape as TF for many `MIXER:Current/...` trees.

**Treat every path as “verify on CL firmware”** before shipping.

---

## Naming commands to spike

From the TF documentation (proposed CL equivalents):

| Path | Intent |
|------|--------|
| `set MIXER:Current/InCh/Label/Name <idx> 0 "<string>"` | Mono input **label** |
| `set MIXER:Current/StInCh/Label/Name <idx> 0 "<string>"` | Stereo input **label** |

Indices are **0‑based** in the unofficial doc (TF channel 1 → index `0`). Reconfirm for CL channel ordering (analog vs Dante vs ST‑in).

---

## Official Yamaha network references

| Document | URL |
|----------|-----|
| **CL/QL Series System Design Guide** (IP roles: Dante vs **device control** vs **mixer control**) | Example regional copy: [CL_QL system design guide PDF](https://th.yamaha.com/files/download/other_assets/0/1251310/cl_ql_system_design_guide_en.pdf) |

Use the **Mixer Control** interface IP — **not** the Dante Primary/Secondary IPs — for RCP.

---

## TCP port

**Confirm in Yamaha documentation** or by observing **CL Editor** traffic. Do **not** hard-code until measured (document the result here post‑spike).

---

## Open points

1. Side‑by‑side: same `set … Label/Name` on **TF** vs **QL** firmware—diff `OK` / `ERROR` strings?
2. Does **StageMix** lock out simultaneous RCP writes—operational note for venues?
3. Insert **rate limit** (ms between `set`) if console returns `ERROR` under burst renames.
