# Behringer / Midas — WING

**Status:** Plan / research notes. **Scope:** LAN **connection** + **channel strip naming** (COL patch labels → desk). Full mix automation **out of scope**.

**Important:** WING’s remote model is **not** compatible with X32 `/ch/xx/...` OSC paths. Treat as a **separate driver**.

COL driver: **client-side** only ([`README.md`](README.md)).

---

## Official documentation (Music Tribe)

| Document | URL | Relevance to COL |
|----------|-----|------------------|
| **WING OSC** (parameter addresses, types, subscriptions) | [BE‑P0BV2‑WING‑OSC‑Documentation (PDF, e.g. v0.59)](https://mediadl.musictribe.com/download/software/behringer/WING/BE-P0BV2-WING-OSC-Documentation-0.59.pdf) | **Naming:** locate **channel / strip “name”** (or equivalent) parameters in the OSC tree; WING uses **named hierarchical parameters** rather than X32-style numbered config blobs for many functions. |
| **WING Remote Protocols** (overview: OSC, WAPI, connection rules) | [WING_Remote_Protocols.pdf](https://mediadl.musictribe.com/download/software/behringer/WING/WING_Remote_Protocols.pdf) | **Connection:** Ethernet, session/keepalive behaviour, concurrent clients—read before implementing long-lived sockets. |

Mirror / community hosting (same PDFs may appear on fan sites; prefer **mediadl.musictribe.com** when possible).

---

## Transport and connection (summary)

| Item | Detail |
|------|--------|
| **Protocols** | **OSC** (documented); additional **WAPI** / binary APIs exist for deep control—**COL only needs OSC naming** if sufficient. |
| **Ethernet** | Desk IP on the control LAN; firewall permits **UDP** to the WING (default port per Remote Protocols PDF—**do not assume 10023**). |
| **Keepalive** | Remote Protocols PDF describes connection maintenance; implement exactly as specified there. |

---

## Finding the right OSC address for “name”

The OSC PDF lists tree nodes and types. For effects, examples look like **`/fx/1/time`** (human-readable paths). **Input channel names** will appear under the documented **channel** branch—extract the precise path from the current PDF revision.

**Community aids (unofficial):**

- [Patrick‑Gilles Maillot — WING](https://sites.google.com/site/patrickmaillot/wing) — C / tooling around WING APIs.
- Forums: [behringer.world — WING OSC examples](https://behringer.world/) (examples only; verify against Music Tribe PDF).

---

## Open points for a spike

1. Record minimal Wireshark/session log: **one** name change on touch screen → **OSC set** pattern.
2. Confirm **UTF‑8 vs ASCII** and maximum **glyph count** for strip names in WING UI.
3. Decide whether COL uses **pure OSC** or needs **WAPI** for names (prefer OSC if PDF covers it).
