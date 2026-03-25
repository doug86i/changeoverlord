# Allen & Heath — SQ

**Status:** Plan / research notes. **Scope:** **MIDI over TCP** **connection** + messages that implement **channel / strip naming** per the SQ spec. Faders, mutes, scenes **out of scope**.

Driver **client-side** ([`README.md`](README.md)).

---

## Official protocol PDF

| Document | URL |
|----------|-----|
| **SQ MIDI Protocol** (Issue 5 quoted for **Firmware V1.5.0+**) | [`SQ-MIDI-Protocol-Issue5.pdf`](https://www.allen-heath.com/content/uploads/2023/11/SQ-MIDI-Protocol-Issue5.pdf) |

Check the **SQ resources** page for newer issues if your firmware is newer than the PDF’s footer.

---

## Connection

Per Issue 5:

- SQ accepts **MIDI over TCP/IP** on **port 51325** to the mixer’s **IP** (same port family as other Allen & Heath MIDI/TCP products; still **verify in the PDF** you ship against).
- USB MIDI (USB‑B) also exists; COL’s Electron driver will use **Ethernet**.

The manual also explains **MIDI channel** assignment in **Utility → MIDI** (SQ uses one channel for “mixer MIDI” and may reserve another for DAW control—**naming** commands are defined in the PDF, not guessed from channel numbers alone).

---

## Naming

Use the PDF section that enumerates **SysEx** (or NRPN/CC if names are there) for **input strip names**. Many Allen & Heath docs group **name + colour** together—COL only needs the **name** bytes.

---

## Supporting vendor context

- [Allen & Heath — External control overview PDF](https://www.allen-heath.com/content/uploads/2023/11/AH-External-control.pdf) — positions SQ in the wider MIDI/TCP lineup.
- Forum pointer (discussion only): [SQ API / MIDI / TCP/IP thread](https://forums.allen-heath.com/t/sq-api-midi-tcp-ip-control-documentation/15136) — may link updated PDFs.

---

## Open points for a spike

1. Confirm whether **strip rename** from the GUI produces a **SysEx** burst matching the Issue 5 tables.
2. Document **maximum characters** and **padding** rules for SQ names.
3. Validate behaviour when **TCP** session drops mid-send (transactional apply vs partial).
