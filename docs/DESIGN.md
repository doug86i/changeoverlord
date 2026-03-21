# Visual design — Changeoverlord

**Documentation index:** [`README.md`](README.md) (all `docs/` files).

Goals: **clean**, **modern**, and **consistent** across the app — readable in **bright daylight** (office, festival compound, outdoor prep) and **dark venues** (FOH, stage wings, dim backstage).

---

## Principles

| Principle | Meaning |
|-----------|---------|
| **One system** | Shared **spacing scale**, **type scale**, **radius**, and **component** patterns — no one-off screens. |
| **Clarity over decoration** | Flat surfaces, subtle borders or shadows only where hierarchy needs it; **no** busy gradients on core work surfaces. |
| **Glanceable at distance** | Timeline and clock: **large** time labels, **strong** figure/ground contrast, **limited** simultaneous accents. |
| **Touch-first where it matters** | Minimum **44×44 px** tap targets on primary actions (prev/next band, clock, tab switches). |

---

## DHSL logo → UI (brand cues)

The **Doug Hunt** wordmark drives palette and personality; the **app chrome** stays calm so schedules and grids stay readable.

| Cue from logo | In the product |
|---------------|----------------|
| **Industrial red** | **Primary accent** — links, focus rings, **“now playing”** row, primary buttons. Starting token **`--color-brand`** ≈ **`#E30613`** — **re-sample** from your official **`dhsl-logo.svg`** when it lands in **`web/public/branding/`**. |
| **Wide, geometric caps** | **Optional** wide **`letter-spacing`** on the **app title** or section headers only — **not** on body copy or spreadsheet cells. |
| **Slight rounding** on letterforms | **Consistent border-radius** on controls and cards (e.g. **6–8px**) — crisp, not playful blobs. |
| **Metallic / lit gradient** inside letters | **Logo-only** treatment. **No** large gradients on **running order**, **clock**, or **sheet** — those stay **flat**; a **thin** focus ring or **subtle** hover on accent controls is enough. |
| **High contrast** | Red reads on **white** (daylight) and on **near-black** (venue) — same accent in **both** themes. |

**Neutrals:** use **cool** greys for backgrounds and borders so the **red** stays the single loud colour.

---

## Light and dark (two first-class themes)

| Context | Theme | Why |
|---------|--------|-----|
| **Daylight / bright** | **Light** | Paper-like screens; dark UI washes out in sun; light surfaces reduce glare. |
| **Dark venue** | **Dark** | Protects night vision; matches typical stage tooling; less eye strain on long shifts. |

**Both** themes ship in v1 — not an afterthought. **Default:** follow **`prefers-color-scheme`** (OS), with a **manual override** in Settings (and optional **persist per browser** via `localStorage`). Same layout and components in both; only **tokens** (colours, borders, shadows) change.

**Optional later:** a **“Stage”** or **high-contrast** boost (even stronger borders on the clock and running order) — only if real-world testing asks for it.

---

## Tokens (implementation direction)

Define **CSS variables** (or Tailwind theme extension) once, used everywhere:

- **Background / surface / elevated** — 2–3 layers (e.g. page, card, modal).
- **Text** — primary, secondary, muted; **never** rely on grey-on-grey below **WCAG AA** contrast for body copy.
- **Accent** — **one** primary accent: **DHSL brand red** (see above) for links, focus, “now playing”; **one** semantic set (success / warning / danger) for schedule state — **success** may stay green; **danger** must remain distinct from **brand** red (use a different hue or iconography).
- **Borders** — hairline separators; slightly stronger in dark mode so panels don’t blur together.
- **Radius** — one **small** radius (inputs, chips) and one **medium** (cards, sheets) — **no** mixed radii on the same page.

Typography: **one sans family** (system stack or a single bundled webfont for offline). **Hierarchy** = size + weight (600 for section titles, 400–500 for body), not a zoo of fonts.

---

## Surfaces by feature

| Area | Notes |
|------|--------|
| **Running order / day** | Neutral surfaces; **“now”** row uses **accent** background or **strong** left border — readable in both themes. |
| **Spreadsheet** | FortuneSheet skinned to match tokens (grid + headers align with app chrome). |
| **Fullscreen clock** | **Maximum** contrast: huge numerals, minimal chrome; **no** busy background imagery. |
| **Settings / admin** | Same chrome as rest of app — no “developer” grey exception. |

---

## Branding (within the system)

- **Client logo** in header: **contained** in a predictable slot; **no** stretching full-bleed behind content.
- **DHSL footer** — wordmark + “Powered by…” uses **`--color-brand`** (or monochrome variant of the logo file for dark backgrounds); must pass contrast checks on **both** themes.
- **Canonical files** — see **`web/public/branding/README.md`**.

---

## Related docs

- **[`PLAN.md`](PLAN.md)** — §7 UX, §10 branding  
- **[`DECISIONS.md`](DECISIONS.md)** — browsers, responsive breakpoints  

When the UI exists, add **screenshots** or **Storybook** links here for reference.
