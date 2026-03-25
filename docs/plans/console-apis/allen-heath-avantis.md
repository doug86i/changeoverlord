# Allen & Heath — Avantis

**Status:** Plan / research notes. **Scope:** **MIDI over TCP** **connection** + **SysEx / vendor messages** that change **input (and related) strip names**. Other mix parameters **out of scope**.

Driver **client-side** ([`README.md`](README.md)).

---

## Official documentation

| Document | Where | Notes |
|----------|-------|-------|
| **Avantis MIDI TCP Protocol** | *Avantis* → **Resources** on [allen-heath.com — Avantis hardware page](https://www.allen-heath.com/hardware/avantis/avantis-dual-screen/resources/) (PDF name along the lines of `Avantis-MIDI-TCP-Protocol-V*.pdf`) | Primary spec for **TCP port**, message classes, and which strip elements expose **names**. |
| **Avantis Firmware Reference Guide** | Same resources grid | UI/network setup—use for enabling remote MIDI/TCP, not for low-level bytes. |
| **External control overview** | [`AH-External-control.pdf`](https://www.allen-heath.com/content/uploads/2023/11/AH-External-control.pdf) | Confirms Avantis is in the **MIDI/TCP** control family alongside dLive/SQ. |

Direct deep links to the MIDI PDF rotate with revisions; **download the newest** from the official Avantis resources table.

---

## Connection (typical pattern)

Allen & Heath MIDI/TCP products generally expose **TCP 51325** for **plain** sessions (Avantis doc states the exact port—match your downloaded PDF revision). TLS may mirror dLive’s pattern; **only implement what the Avantis PDF explicitly supports**.

---

## Naming

Work inside the Avantis MIDI/TCP PDF section that lists **channel / strip naming** (often SysEx blocks analogous to dLive’s “Name & Colour” family). **Do not** mix dLive byte tables into Avantis without checking—firmware headers and parameter maps differ.

---

## Open points for a spike

1. Download **latest** Avantis MIDI/TCP PDF; diff against any older copy in community forks (e.g. Companion vendor zips).
2. Confirm **whether naming** uses the same SysEx major/minor header as dLive for your firmware.
3. Test **plain vs encrypted** TCP if the desk enforces TLS in corporate installs.
