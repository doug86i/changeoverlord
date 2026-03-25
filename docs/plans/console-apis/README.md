# Console APIs — per-desk drivers (plan)

This folder documents a **planned** capability: push **input channel strip names** from Changeoverlord (COL) patch workbooks to **real mixing consoles** on the venue LAN.

**Status:** design / exploration only. Nothing here ships until implemented and called out in root [`CHANGELOG.md`](../../../CHANGELOG.md).

---

## Placeholder driver targets

Chosen console families — each `.md` file links **vendor PDFs** and **unofficial references** for **connection + strip naming** (not general mixing). Re-verify URLs and firmware behaviour before implementation:

| File | Manufacturer / console |
|------|------------------------|
| [`behringer-x32-m32.md`](behringer-x32-m32.md) | Behringer / Midas — X32 · M32 |
| [`behringer-wing.md`](behringer-wing.md) | Behringer / Midas — WING |
| [`allen-heath-dlive.md`](allen-heath-dlive.md) | Allen & Heath — dLive |
| [`allen-heath-avantis.md`](allen-heath-avantis.md) | Allen & Heath — Avantis |
| [`allen-heath-sq.md`](allen-heath-sq.md) | Allen & Heath — SQ |
| [`yamaha-rivage.md`](yamaha-rivage.md) | Yamaha — Rivage |
| [`yamaha-cl-ql.md`](yamaha-cl-ql.md) | Yamaha — CL / QL |
| [`yamaha-dm7.md`](yamaha-dm7.md) | Yamaha — DM7 |
| [`yamaha-tf.md`](yamaha-tf.md) | Yamaha — TF |
| [`digico-quantum-sd-s.md`](digico-quantum-sd-s.md) | DiGiCo — Quantum · SD · S |
| [`avid-venue-s6l.md`](avid-venue-s6l.md) | Avid — VENUE \| S6L |
| [`soundcraft-vi.md`](soundcraft-vi.md) | Soundcraft — Vi |
| [`soundcraft-si.md`](soundcraft-si.md) | Soundcraft — Si |
| [`midas-hd.md`](midas-hd.md) | Midas — HD platform |
| [`midas-pro.md`](midas-pro.md) | Midas — Pro series (Pro1 / Pro2 / Pro6 / Pro9 etc.) |

---

## Purpose of each desk driver

There is **no single industry API** that all manufacturers implement for remote naming. Each console family speaks its own **LAN protocol** (commonly **OSC over UDP**, **proprietary TCP**, sometimes MIDI-centric schemes).

A **driver** (per supported desk family) is therefore responsible for:

1. **Speaking that desk’s wire protocol** on the operator’s machine — open the right socket type, send the correct messages, apply any required **keepalives** (e.g. X32-style `/xremote` polling), and parse errors/timeouts where possible.
2. **Applying human-readable labels to the right strips** — map an ordered list of names (from COL) to **channel indices** the desk understands (1-based vs 0-based, bus vs input layer, etc.) per driver.
3. **Enforcing desk limits** — max name length, character set, truncation rules; define behaviour for **empty** names (skip vs clear).
4. **Staying a local, outbound client** — initiate connections **from the operator’s Mac or Windows** toward the mixer. **COL’s server (`api/`) must not** open desk sockets or push names on behalf of clients (safety and typical VLAN topology).

Drivers do **not** replace vendor control apps, embed third-party mixer UIs, or implement full remote mixing — only the minimum surface needed for **strip naming** (and optional **connection test**).

---

## Where names come from (COL-specific)

- **Only source:** text in the **per-performance patch workbook** ([`performance_workbooks.sheets_json`](../../../api/src/db/schema.ts)), located via **name binding** metadata on the template (sheet + column + row range — **never** hard-coded cell addresses in app code; see [`.cursor/rules/patch-templates.mdc`](../../../.cursor/rules/patch-templates.mdc)).
- **Not a source:** schedule **band name** ([`performances.bandName`](../../../api/src/db/schema.ts)) — running-order titles are unrelated to console channel labels.
- If binding is **missing or invalid**, the product should **refuse to push** (clear error); **never** substitute band names.

The COL web app resolves binding → **string[]**. The driver receives that list plus **console profile** (IP, model family, options).

---

## Why a normal browser is not enough

Typical SPA JavaScript **cannot** send arbitrary **UDP** (OSC) or **raw TCP** to `mixer:port`. **LAN discovery** (mDNS, etc.) is also largely unavailable compared to native code.

So desk I/O runs in a **native-capable layer on the same machine** as the UI:

- **Preferred packaging:** an **Electron** or **Tauri** shell that **loads COL from the real deployed HTTPS URL** (same as Chrome) and uses the **main process** (or equivalent) for **outbound-only** desk traffic + **in-process IPC**. The shell must **not** act as an HTTP **server** for COL or expose a LAN API — it is a **webview + local desk client** only.
- **Alternative:** plain browser + a separate **127.0.0.1** helper that forwards commands (optional pattern; more moving parts).

---

## Driver interface (conceptual)

Each desk family implements a small contract, e.g.:

- **connect(profile)** — validate reachability / auth if applicable  
- **setChannelNames(names: string[], options)** — push full or partial list; apply mapping/offset  
- **disconnect()** / cleanup  

Shared **UI concepts:** console profile (vendor/model, host, port), **row → desk channel** mapping, **preview**, explicit **“Sync to desk”**, debounced optional sync when `sheets_json` changes, confirmation before writing.

---

## Suggested first spike

**Behringer/Midas X/M32 family** — **OSC over UDP** (e.g. port **10023**), documented in community and informal references; validates **name binding → extract → push** before adding other families (e.g. Allen & Heath dLive, Yamaha, DiGiCo).

---

## Risks and constraints

- **UDP** on Wi‑Fi, **firewalls**, desk/venue **VLAN** isolation.
- Remote control may be **disabled** or **password-protected** on the desk.
- Use **published or responsibly documented** protocols; respect vendor terms.

---

## Related docs

- [`../voice-chat-future.md`](../voice-chat-future.md) — other future feature plan  
- [`../../PATCH_TEMPLATE_JSON.md`](../../PATCH_TEMPLATE_JSON.md) — workbook JSON shape  
- [`../../ROADMAP.md`](../../ROADMAP.md) — product direction  

The living exploration notes also exist in Cursor as plan **Console channel naming** (`console_channel_naming_9d165c1b`); this README is the repo-local summary for contributors.
