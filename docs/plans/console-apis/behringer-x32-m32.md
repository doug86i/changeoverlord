# Behringer / Midas — X32 · M32

**Status:** Plan / research notes. **Scope:** LAN **connection** + **input strip naming** via remote control. Faders, EQ, dynamics, routing, scenes **out of scope** for COL’s first driver surface.

COL driver runs **client-side** only (see [`README.md`](README.md)).

---

## Transport and connection

| Item | Detail |
|------|--------|
| **Protocol** | **OSC** over **UDP** |
| **Port** | **10023** (typical; confirm on console if customised) |
| **Remote enable** | Console must allow remote control; set network IP on the desk. |
| **Keepalive** | Third‑party docs state the desk expects periodic **`/xremote`** so the mixer continues to stream parameter updates to the controller (often quoted as **~every 10s**). COL only *sets* names but should still follow this if firmware requires it for stable sessions. |

**Unofficial behaviour write‑up (not vendor manual):**  
[Behringer’s X32 OSC implementation is a bit quirky – Janis Streib](https://janis-streib.de/post/behringer-x32-osc-is-quirky/)

---

## Channel / strip naming (OSC)

There is **no Behringer PDF** in wide circulation that is as complete as the community “unofficial protocol” compendium. Implementation should derive exact argument types (string vs blob) from Maillot’s reference or by packet capture against a lab desk.

**Primary reference (unofficial, community standard):**

- [Patrick‑Gilles Maillot — X32](https://sites.google.com/site/patrickmaillot/x32) — tools and **“Unofficial XOSC Remote Protocol”** documentation for X32/M32 family (firmware-dependent; check revision notes in the PDF).

**Typical pattern (verify in Maillot doc before coding):**

- Channel configuration lives under OSC addresses like **`/ch/01/config` … `/ch/32/config`** (2‑digit channel index).
- **Strip / channel “name”** is one of the parameters carried on those config messages (often documented alongside colour/icon fields).

**Code cross‑checks (still verify on hardware):**

- Go reference: [`goaudiovideo/osc/behringer/x32`](https://pkg.go.dev/github.com/goaudiovideo/osc/behringer/x32) — exposes helpers such as naming a channel (implementation detail → Maillot paths).

---

## Official / vendor starting points

- Music Group / Behringer host firmware and knowledge-base articles; the **deep OSC parameter map** is what Maillot and the forums aggregate. For *warranty/legal* work, obtain the same answers from vendor support if required.

---

## Open points for a spike

1. Confirm **exact OSC type tag** and payload shape for **name** on your firmware (string vs blob).
2. Confirm whether **`/xremote`** is required on idle links when only **pushing** names intermittently.
3. Document behaviour for **ASCII limits** (length / disallowed characters) from the desk UI manual.
