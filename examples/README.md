# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## Example JSON (conditional formatting)

**`patch-template-conditional-format-demo.json`** — small two-tab workbook with **`luckysheet_conditionformat_save`** rules (**color scale** on column **B**, **data bars** on column **D**) in the shape described in Luckysheet’s sheet config docs. Upload it as a template to confirm native JSON keeps conditional formatting metadata (see **`docs/PATCH_TEMPLATE_JSON.md`**).

## DH Pick & Patch v5.2 (SatBox labels)

**`DH_Pick_Patch_TEMPLATE_v5.2_satbox_vlookup.json`** — derived from the v5.0 **Changeoverlord-native** workbook: every **SatBox Lables** item cell used a **~10k-character nested `IF`** scanning **`Channel List`!B5:B104** (FortuneSheet often fails on that depth). **v5.1** used **`INDEX`/`MATCH`**, but **`@formulajs/formulajs`** implements **`MATCH` (type 0)** with **regex substring** matching, so codes like **`B1`** could match **`B10`** — wrong row. **v5.2** uses **`VLOOKUP(…, 'Channel List'!$B$5:$D$104, 3, 0)`** for **strict equality** on **SatBox#** (column **B**) and returns **Item** (column **D**). Enter **`B1`**, **`O2`**, **`R3`**, **`Y1`**, **`P2`**, … in **SatBox#** on **Channel List**; the **Item** appears beside the coloured slot code on **SatBox Lables**. Replace your library template with this file if v5.0 / v5.1 labels misbehave.
