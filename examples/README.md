# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## Example JSON (conditional formatting)

**`patch-template-conditional-format-demo.json`** — small two-tab workbook with **`luckysheet_conditionformat_save`** rules (**color scale** on column **B**, **data bars** on column **D**) in the shape described in Luckysheet’s sheet config docs. Upload it as a template to confirm native JSON keeps conditional formatting metadata (see **`docs/PATCH_TEMPLATE_JSON.md`**).
