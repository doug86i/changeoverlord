# Soundcraft — Vi series

**Status:** Plan / research notes. **Scope:** **HiQNet** over Ethernet — locate **virtual device / parameter ID** that stores **channel strip names**; **avoid** broader mix surface replication.

Driver **client-side** ([`README.md`](README.md)).

---

## Protocol reality

Soundcraft **Vi** and many Harman desks expose **HiQNet** on the LAN. Public **official** byte-level PDFs are **sparse** compared to X32 OSC.

---

## Third-party decoding reference (unofficial)

| Source | URL | Naming-related excerpt |
|--------|-----|------------------------|
| **HiQontrol HiQNet protocol notes** | [hiqontrol.readthedocs.io — HiQNet protocol](https://hiqontrol.readthedocs.io/en/latest/hiqnetproto.html) | Lists a virtual device **1.0.0.44 “Channels names”** with **PID 1…n** mapping to channel strip name fields (e.g. **CH1…**). **Verify on a Vi** before relying on PID mapping. |

This is **reverse-engineered documentation**; cross-check with **Soundcraft offline** tools / Harman support when doing commercial releases.

---

## Official Soundcraft / Harman entry points

| Resource | URL |
|----------|-----|
| **ViSi Remote** product page | [soundcraft.com — ViSi Remote](https://www.soundcraft.com/en-US/products/ViSi-Remote) | Confirms Ethernet remote paradigm for **Vi** and some **Si**; not the wire spec. |

Search Harman Pro for **“HiQNet** + **Vi** + **network**” PDFs (topology guides, not always parameter maps).

---

## Connection expectations

- Devices on **same subnet**; HiQNet historically relies on **UDP broadcast** discovery (see HiQontrol notes).  
- COL may need **configured console IPv4** if discovery is skipped.

---

## Open points

1. Confirm **HiQNet address** (`VD / Device / Sub / …`) for **your Vi firmware**.  
2. Determine **max name length** & encoding (ASCII vs UTF‑8).  
3. Legal review: Harman may treat HiQNet as proprietary—get **written** guidance if needed.
