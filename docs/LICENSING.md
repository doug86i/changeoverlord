# Licensing strategy

**Documentation index:** [`README.md`](README.md) (all `docs/` files).

Discussion of **repo licence** and **dependency** choices for Changeoverlord.

---

## Application / repository (your code)

| Option | Pros | Cons |
|--------|------|------|
| **MIT** *(current [`LICENSE`](../LICENSE))* | Maximum simplicity; widely understood; compatible with almost all OSS deps. | No explicit patent grant (unlike Apache-2.0). |
| **Apache-2.0** | Explicit **patent grant**; similar permissiveness to MIT. | Slightly longer licence text; must preserve NOTICE file if third-party NOTICEs exist. |
| **AGPL-3.0** | Strong **copyleft** if you want derivatives of your server to stay open. | **Discouraged** for a tool crews **self-host** in varied environments — creates uncertainty for internal forks and “as-a-service” hosting without source release. |

**Recommendation:** keep **MIT** (or switch to **Apache-2.0** if you want the patent clause — both are fine for a crew-facing tool). **Do not** AGPL the main app unless you intentionally want strong copyleft obligations on network use.

**Current choice:** repository stays **MIT** — no change planned.

---

## Dependencies (libraries you do not own)

### Prefer

- **MIT**, **BSD**, **Apache-2.0**, **ISC** — minimal friction, clear commercial use.

### Use with care

| Package type | Example | Note |
|--------------|---------|------|
| **GPL/LGPL** in **linked** libraries | Some older libs | **LGPL** is often OK for dynamic linking; **GPL** can “infect” if you distribute a combined work — check with counsel for your distribution model. |
| **GPL** formula engine | **HyperFormula** | Powerful for Excel-like formulas; **GPL-3.0**. Acceptable if you are **comfortable** with GPL obligations for the combined work, or isolate behind a **separate process** / optional plugin — many products **avoid GPL in the core** server image. |
| **SheetJS (xlsx)** | Dual licence | **Community** edition has feature/usage limits; **commercial** licence for full features. Prefer **ExcelJS** (MIT) for core **.xlsx** import unless SheetJS terms are explicitly accepted. |

### Already aligned with plan

- **FortuneSheet** — **MIT**  
- **ExcelJS** — **MIT** (good default for server-side xlsx)  
- **pdf-lib** — **MIT** (PDF page count and single-page extract)  
- **Fastify / Drizzle / React** — permissive  

**Recommendation:** default pipeline = **ExcelJS + FortuneSheet** (collaboration is a small in-app WebSocket relay, no CRDT dependency); add **HyperFormula** only if you need **full** spreadsheet formulas and accept **GPL** implications, or evaluate **non-GPL** formula subsets.

---

## Summary

1. **Keep the repo MIT** (or Apache-2.0 if you prefer).  
2. **Stick to permissive deps** in the **default** Docker image.  
3. **Revisit GPL** (HyperFormula, etc.) only when formula support is a **hard requirement** and licence review is done.  
4. **Document** any **non-MIT** runtime dependency in this file when added.
