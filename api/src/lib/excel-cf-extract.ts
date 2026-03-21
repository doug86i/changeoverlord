/**
 * Extract conditional formatting rules from OOXML Excel (.xlsx) and map
 * them to FortuneSheet's `luckysheet_conditionformat_save` format.
 *
 * The @zenmrp/fortune-sheet-excel library does not extract conditional
 * formatting, so we parse the raw XML inside the zip ourselves.
 */

import JSZip from "jszip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CfRange {
  row: [number, number];
  column: [number, number];
}

interface FortuneSheetCfRule {
  type: "default" | "colorGradation" | "dataBar" | "icons";
  cellrange: CfRange[];
  format: { textColor: string | null; cellColor: string | null } | string[];
  conditionName?: string;
  conditionRange?: CfRange[];
  conditionValue?: string[];
}

interface DxfStyle {
  textColor: string | null;
  cellColor: string | null;
}

/* ------------------------------------------------------------------ */
/*  XML helpers (simple regex-based — no DOM parser needed)            */
/* ------------------------------------------------------------------ */

function allMatches(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*(?:/>|>[\\s\\S]*?</${tag}>)`, "g");
  return [...xml.matchAll(re)].map((m) => m[0]);
}

function attr(element: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  return element.match(re)?.[1];
}

function innerContent(element: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return element.match(re)?.[1];
}

/**
 * Parse an Excel cell reference range like "B2:C98" or "A2:M98 A99:A101 C99:M101"
 * into FortuneSheet CfRange objects.
 */
function parseSqref(sqref: string): CfRange[] {
  const ranges: CfRange[] = [];
  for (const part of sqref.trim().split(/\s+/)) {
    const m = part.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
    if (!m) continue;
    const c1 = colLetterToIndex(m[1]!);
    const r1 = parseInt(m[2]!, 10) - 1;
    const c2 = m[3] ? colLetterToIndex(m[3]) : c1;
    const r2 = m[4] ? parseInt(m[4], 10) - 1 : r1;
    ranges.push({ row: [r1, r2], column: [c1, c2] });
  }
  return ranges;
}

function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

/* ------------------------------------------------------------------ */
/*  Theme + dxf color resolution                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_THEME_COLORS = [
  "000000", "FFFFFF", "44546A", "E7E6E6",
  "4472C4", "ED7D31", "A5A5A5", "FFC000",
  "5B9BD5", "70AD47", "0563C1", "954F72",
];

function parseThemeColors(themeXml: string): string[] {
  const colors = [...DEFAULT_THEME_COLORS];
  const scheme = innerContent(themeXml, "a:clrScheme");
  if (!scheme) return colors;

  const tags = [
    "a:dk1", "a:lt1", "a:dk2", "a:lt2",
    "a:accent1", "a:accent2", "a:accent3", "a:accent4",
    "a:accent5", "a:accent6", "a:hlink", "a:folHlink",
  ];
  for (let i = 0; i < tags.length; i++) {
    const block = allMatches(scheme, tags[i]!)[0];
    if (!block) continue;
    const srgb = allMatches(block, "a:srgbClr")[0];
    if (srgb) {
      const val = attr(srgb, "val");
      if (val) colors[i] = val;
    }
    const sys = allMatches(block, "a:sysClr")[0];
    if (sys) {
      const lc = attr(sys, "lastClr");
      if (lc) colors[i] = lc;
    }
  }
  return colors;
}

function applyTint(hexRgb: string, tint: number): string {
  let r = parseInt(hexRgb.substring(0, 2), 16);
  let g = parseInt(hexRgb.substring(2, 4), 16);
  let b = parseInt(hexRgb.substring(4, 6), 16);
  if (tint > 0) {
    r = Math.round(r + (255 - r) * tint);
    g = Math.round(g + (255 - g) * tint);
    b = Math.round(b + (255 - b) * tint);
  } else {
    r = Math.round(r * (1 + tint));
    g = Math.round(g * (1 + tint));
    b = Math.round(b * (1 + tint));
  }
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function resolveColor(
  element: string,
  themeColors: string[],
): string | null {
  const rgb = attr(element, "rgb");
  if (rgb) {
    const hex = rgb.length === 8 ? rgb.substring(2) : rgb;
    return `#${hex}`;
  }
  const themeIdx = attr(element, "theme");
  if (themeIdx != null) {
    const base = themeColors[parseInt(themeIdx, 10)] ?? "000000";
    const tint = attr(element, "tint");
    const resolved = tint ? applyTint(base, parseFloat(tint)) : base;
    return `#${resolved}`;
  }
  return null;
}

function parseDxfStyles(
  stylesXml: string,
  themeColors: string[],
): DxfStyle[] {
  const dxfs: DxfStyle[] = [];
  const dxfsBlock = innerContent(stylesXml, "dxfs");
  if (!dxfsBlock) return dxfs;

  for (const dxf of allMatches(dxfsBlock, "dxf")) {
    let textColor: string | null = null;
    let cellColor: string | null = null;

    const fontBlock = innerContent(dxf, "font");
    if (fontBlock) {
      const colorEl = allMatches(fontBlock, "color")[0];
      if (colorEl) textColor = resolveColor(colorEl, themeColors);
    }

    const fillBlock = innerContent(dxf, "fill");
    if (fillBlock) {
      const bgEl = allMatches(fillBlock, "bgColor")[0];
      if (bgEl) cellColor = resolveColor(bgEl, themeColors);
      if (!cellColor) {
        const fgEl = allMatches(fillBlock, "fgColor")[0];
        if (fgEl) cellColor = resolveColor(fgEl, themeColors);
      }
    }

    dxfs.push({ textColor, cellColor });
  }
  return dxfs;
}

/* ------------------------------------------------------------------ */
/*  Map Excel CF rule types to FortuneSheet conditionName              */
/* ------------------------------------------------------------------ */

function mapExcelCfRule(
  ruleXml: string,
  dxfStyles: DxfStyle[],
): FortuneSheetCfRule | null {
  const ruleType = attr(ruleXml, "type");
  const dxfIdStr = attr(ruleXml, "dxfId");
  const operator = attr(ruleXml, "operator");

  const formulas = allMatches(ruleXml, "formula").map((f) => {
    const m = f.match(/>([^<]*)</);
    return m ? m[1]! : "";
  });

  if (ruleType === "cellIs" && dxfIdStr != null) {
    const dxfId = parseInt(dxfIdStr, 10);
    const style = dxfStyles[dxfId];
    if (!style) return null;

    let conditionName: string | undefined;
    if (operator === "greaterThan") conditionName = "greaterThan";
    else if (operator === "lessThan") conditionName = "lessThan";
    else if (operator === "equal") conditionName = "equal";
    else if (operator === "between") conditionName = "betweenness";
    else return null;

    return {
      type: "default" as const,
      cellrange: [],
      format: { textColor: style.textColor, cellColor: style.cellColor },
      conditionName,
      conditionRange: [],
      conditionValue: formulas,
    };
  }

  if (ruleType === "beginsWith" && dxfIdStr != null) {
    const dxfId = parseInt(dxfIdStr, 10);
    const style = dxfStyles[dxfId];
    if (!style) return null;

    const prefix =
      formulas[0]?.match(/LEN\("([^"]*)"\)/i)?.[1] ?? formulas[0] ?? "";

    return {
      type: "default" as const,
      cellrange: [],
      format: { textColor: style.textColor, cellColor: style.cellColor },
      conditionName: "textContains",
      conditionRange: [],
      conditionValue: [prefix],
    };
  }

  if (
    ruleType === "expression" &&
    dxfIdStr != null &&
    formulas[0] &&
    /^LEFT\(/i.test(formulas[0])
  ) {
    const dxfId = parseInt(dxfIdStr, 10);
    const style = dxfStyles[dxfId];
    if (!style) return null;

    const prefix = formulas[0].match(/LEN\("([^"]*)"\)/i)?.[1] ?? "";
    if (!prefix) return null;

    return {
      type: "default" as const,
      cellrange: [],
      format: { textColor: style.textColor, cellColor: style.cellColor },
      conditionName: "textContains",
      conditionRange: [],
      conditionValue: [prefix],
    };
  }

  if (
    ruleType === "expression" &&
    dxfIdStr != null &&
    formulas[0] &&
    /LEN\(TRIM\(/i.test(formulas[0])
  ) {
    return null;
  }

  if (ruleType === "colorScale") {
    const csBlock = innerContent(ruleXml, "colorScale");
    if (!csBlock) return null;
    const colorEls = allMatches(csBlock, "color");
    if (colorEls.length < 2) return null;
    const colors = colorEls
      .map((c) => resolveColor(c, dxfStyles.length ? [] : []))
      .filter(Boolean) as string[];
    if (colors.length < 2) return null;
    return {
      type: "colorGradation",
      cellrange: [],
      format: colors,
    };
  }

  if (ruleType === "dataBar") {
    return null;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Extract conditional formatting from an xlsx buffer.
 * Returns a map from 0-based sheet index to FortuneSheet CF rule arrays.
 */
export async function extractConditionalFormatting(
  xlsxBuffer: Buffer,
): Promise<Map<number, FortuneSheetCfRule[]>> {
  const result = new Map<number, FortuneSheetCfRule[]>();
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(xlsxBuffer);
  } catch {
    return result;
  }

  const themeFile = zip.file("xl/theme/theme1.xml");
  const themeXml = themeFile ? await themeFile.async("string") : "";
  const themeColors = themeXml
    ? parseThemeColors(themeXml)
    : [...DEFAULT_THEME_COLORS];

  const stylesFile = zip.file("xl/styles.xml");
  const stylesXml = stylesFile ? await stylesFile.async("string") : "";
  const dxfStyles = stylesXml
    ? parseDxfStyles(stylesXml, themeColors)
    : [];

  const sheetOrder = getSheetOrder(zip);

  for (const [sheetIndex, sheetPath] of sheetOrder.entries()) {
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;
    const sheetXml = await sheetFile.async("string");

    const cfBlocks = allMatches(sheetXml, "conditionalFormatting");
    if (cfBlocks.length === 0) continue;

    const rules: FortuneSheetCfRule[] = [];
    const seen = new Set<string>();

    for (const cfBlock of cfBlocks) {
      const sqref = attr(cfBlock, "sqref");
      if (!sqref) continue;
      const cellrange = parseSqref(sqref);
      if (cellrange.length === 0) continue;

      const cfRules = allMatches(cfBlock, "cfRule");
      for (const cfRule of cfRules) {
        const mapped = mapExcelCfRule(cfRule, dxfStyles);
        if (!mapped) continue;

        mapped.cellrange = cellrange;

        const dedup = JSON.stringify({
          cn: mapped.conditionName,
          cv: mapped.conditionValue,
          cr: mapped.cellrange,
        });
        if (seen.has(dedup)) continue;
        seen.add(dedup);

        rules.push(mapped);
      }
    }

    if (rules.length > 0) {
      result.set(sheetIndex, rules);
    }
  }

  return result;
}

function getSheetOrder(zip: JSZip): Map<number, string> {
  const order = new Map<number, string>();
  let idx = 0;
  for (let i = 1; i <= 100; i++) {
    const path = `xl/worksheets/sheet${i}.xml`;
    if (zip.file(path)) {
      order.set(idx++, path);
    }
  }
  return order;
}
