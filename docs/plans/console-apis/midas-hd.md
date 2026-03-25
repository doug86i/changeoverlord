# Midas — HD platform (e.g. HD96)

**Status:** Plan / research notes. **Scope:** Identify any **published** LAN protocol usable from an external program to set **input strip names** on **HD** engines. **X32 OSC** and **Pro series OSC** ([community list for Pro2c](https://github.com/muffeeee/midas-pro-series-osc-commands)) are **different** product lines—**do not** assume carry-over.

Driver **client-side** ([`README.md`](README.md)).

---

## Official Midas entry points

| Resource | URL |
|----------|-----|
| **Midas Consoles — HD96‑AIR FAQ** | [midasconsoles.com — HD96 AIR FAQ](https://www.midasconsoles.com/hd96-air-faq) | Product-level **network / AES50** positioning—not a remote API spec. |
| **Manuals hosted by Midas / MusicTribe** | Search **HD96** on [midasconsoles.com](https://www.midasconsoles.com/) | Download the latest **User Guide / Reference**; look for chapters on **network**, **remote control**, **REAPER / DAW**, or **Osc** (if any). |

---

## What was **not** found in this research pass

- A **public Music Tribe PDF** mirroring **WING OSC** or **X32 OSC** specifically titled **“HD96 OSC Specification”**.  
- Confirmation that **MIDI over Ethernet** exposes **scribble strings** the way Allen & Heath documents.

---

## Practical spike path

1. Contact **Music Tribe/Midas support** with: “Is there a **documented Ethernet API** (OSC, TCP, MIDI) on HD96 to set **input channel names** from third-party software?”  
2. If answer references **Eucon / UAD / closed plug-in** only, COL may **defer** HD support.  
3. If answer references **generic MIDI** or **ASCII** port, mirror the **Allen & Heath** spike style (SysEx / NRPN) after obtaining the spec.

---

## Risk note

Implementing **undocumented** binary protocols risks **EULA** / stability issues—obtain **written** permission for anything beyond personal lab use.
