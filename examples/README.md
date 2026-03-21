# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## Example JSON (conditional formatting)

**`patch-template-conditional-format-demo.json`** — small two-tab workbook with **`luckysheet_conditionformat_save`** rules (**color scale** on column **B**, **data bars** on column **D**) in the shape described in Luckysheet’s sheet config docs. Upload it as a template to confirm native JSON keeps conditional formatting metadata (see **`docs/PATCH_TEMPLATE_JSON.md`**).

## DH Pick & Patch v5.3 (formulajs-native)

**`DH_Pick_Patch_TEMPLATE_v5.3_formulajs.json`** — full four-tab starter based on the **v5.2 SatBox** layout, with **helpers rebuilt for `@formulajs/formulajs`** (FortuneSheet’s runtime engine):

- **SatBox Lables** — **`VLOOKUP(…, 'Channel List'!$B$5:$D$104, 3, 0)`** + **`TRIM`** for exact **SatBox#** → **Item** (avoids **`MATCH` type 0** substring bugs on codes like **B1** vs **B10**).
- **Channel List** — column **AA** mirrors **Mic/DI** (**E**); **AD** is a running mic index (seed **`0`** in **AD3**); column **AE** normalizes **Stand** (**G**) to tokens **`tall` / `short` / `round`** via **`SEARCH`/`LOWER`/`ISNUMBER`/`IF`** so substring matches work without Excel-style wildcards.
- **Mic & DI List** — existing **INDEX**/**MATCH** mic rows use **AA**/**AD**; **Tall**/**Short**/**Round** counts use **`COUNTIF('Channel List'!$AE$5:$AE$104, "tall")`** (etc.).

**Grid:** **Channel List** is **31** columns (**A**–**AE**). See **`docs/PATCH_TEMPLATE_JSON.md`** (*Engine quirks*) for why older **`COUNTIF(...,"Tall*")`** patterns fail in-app.

## DH Pick & Patch v6 (rebuilt starter)

**`DH_Pick_Patch_TEMPLATE_v6.json`** — four-sheet workbook regenerated from a clean structure (**`changeoverlordWorkbook: 1`**), with **`calcChain`** populated for formula cells. Use **Import workbook JSON** (or **Replace**) when you want a known-good baseline without accumulated Yjs history.

Regenerate from repo: **`node scripts/build-dh-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v6.json`**.
