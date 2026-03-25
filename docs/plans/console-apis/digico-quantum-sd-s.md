# DiGiCo — Quantum · SD · S ranges

**Status:** Plan / research notes. **Scope:** Determine a **supported path** for **external** renaming of **input strip labels** over **Ethernet**. **Generic OSC out from the desk** to third parties ≠ COL’s need to **push names into** the console—read carefully.

Driver **client-side** ([`README.md`](README.md)).

---

## Vendor announcements (context)

| Article | URL |
|---------|-----|
| **“DiGiCo Opens Up the SD Range with Generic OSC control”** (2018) | [digico.biz news post](https://digico.biz/digico-opens-up-the-sd-range-with-generic-osc-control/) |

Summary: **Generic OSC** lets the **console send user-defined OSC** to **external** gear from channel rotaries/switches; it is **not** by itself a full “set console strip name from Python” API. **COL still needs** either:

- A **documented inbound** automation protocol for **strip text**, or  
- A **supported macro / snapshot** workflow (probably **too heavy**), or  
- **Manufacturer-confirmed** OSC receive addresses (**TBD**).

---

## Official manuals (navigation / external control UI)

| Resource | URL |
|----------|-----|
| **SD Software Reference** (check “External control”, snapshots, automation chapters) | Download the current issue from [DiGiCo Support / Manuals](https://support.digico.biz/) or the **SD software installer** bundle (filename historically similar to `SD_Software_Reference_V*.pdf`). |
| **Quantum Getting Started** (network port primer) | Example: [Quantum2 Getting Started PDF](https://digico.biz/wp-content/uploads/2021/06/Quantum2_Getting_Started_Issue_A.pdf) |

Use these to find **Setup → External Control** wording for your software generation.

---

## Third-party integration docs (inbound OSC hints)

| Source | URL | Notes |
|--------|-----|-------|
| **DiGiCo Macro OSC — KLANG** | [klang.com manuals](https://www.klang.com/manuals/digico-macro-osc/) | Describes enabling **External Control**, adding **Macro OSC** devices, IP/port pairing.**Primarily** console → device routing; still useful for **handshake** patterns. |

---

## Community packet captures (unofficial)

| Repo | URL | Notes |
|------|-----|-------|
| **DigicOSC** | [mikewoodld/DigicOSC](https://github.com/mikewoodld/DigicOSC) | Logs include initial query **`/console/name/?`** on **UDP** from iPad apps—shows **Discovery-ish** behaviour; **does not** finish the naming story. |

Treat as **lab clues**, not a contract.

---

## Open points (critical)

1. **Ask DiGiCo support / read latest SD software manual**: “What is the supported automation path to set **input channel name** from an external controller on **v####**?”  
2. If answer is **SNMP / HiQNet / other**, this placeholder must switch transport class.  
3. Until confirmed, **do not** promise Quantum/SD support in COL marketing.
