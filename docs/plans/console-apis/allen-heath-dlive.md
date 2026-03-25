# Allen & Heath — dLive

**Status:** Plan / research notes. **Scope:** **MIDI over TCP** **connection** + anything the vendor protocol exposes for **channel / strip naming** (often via **SysEx** sections). Fader levels, mutes, sends **out of scope** unless needed as side effects.

Driver is **client-side** only ([`README.md`](README.md)).

---

## Official protocol PDF

| Document | URL | Notes |
|----------|-----|-------|
| **dLive MIDI over TCP/IP Protocol** | [`dLive-MIDI-Over-TCP-Protocol-V2.0.pdf`](https://www.allen-heath.com/content/uploads/2024/06/dLive-MIDI-Over-TCP-Protocol-V2.0.pdf) (Allen & Heath, 2024) | Defines SysEx framing, **TCP ports**, **TLS** options, and a matrix of **controllable functions**. |

Older revisions (e.g. v1.9) may still float on the web; prefer **latest** from [Allen & Heath dLive resources](https://www.allen-heath.com/).

---

## Connection (from V2.0 protocol)

| Target | Plain TCP | TLS |
|--------|-----------|-----|
| **MixRack** | **51325** | **51327** |
| **Surface** | **51328** | **51329** |

The PDF describes **authentication** (username/password) when using TLS. COL must implement **one** supported mode and document which (plain vs TLS) the venue enabled.

**Networking:** connect to the **MixRack** IP when controlling the **system core**; surface ports differ—follow the PDF’s guidance for your topology.

---

## Naming (what to extract from the PDF)

The dLive MIDI/TCP spec groups items such as **“Name & Colour”** for strip classes (inputs, mixes, etc.) under **SysEx** patterns with the standard Allen & Heath header (`F0 00 00 1A 50 10 …` in the doc).

**COL implementation steps:**

1. Locate the **“Name”** (and optional colour) section for **input channels** you care about.
2. Record **byte offsets**, **string length limits**, and whether names are **ASCII** or wider.
3. Ignore CC/NRPN sections that only adjust **gain/mute/EQ** unless you need them.

---

## Supporting vendor context

- [Allen & Heath — External control overview PDF](https://www.allen-heath.com/content/uploads/2023/11/AH-External-control.pdf) — lists **which** surfaces support MIDI/TCP and links families (not a substitute for the dLive protocol spec).

---

## Open points for a spike

1. Lab capture: set **one** channel name from the surface → compare to SysEx the PDF predicts.
2. Confirm **MixRack vs Surface** IP: venues differ; wrong IP = silent failure.
3. Decide TLS credential storage in COL Electron layer (never in cloud DB).
