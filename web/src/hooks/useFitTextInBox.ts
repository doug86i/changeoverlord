import { useLayoutEffect, type RefObject } from "react";

/**
 * Sets `textRef` font size to the largest value where wrapped text fits inside
 * `containerRef` (multi-line, word wrap). Re-runs when `text` or container size changes.
 */
export function useFitTextInBox(
  containerRef: RefObject<HTMLElement | null>,
  textRef: RefObject<HTMLElement | null>,
  text: string,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    const el = textRef.current;
    if (!container || !el) return;

    const fit = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw < 12 || ch < 12) return;

      el.style.width = "100%";
      el.style.maxWidth = "100%";
      el.style.boxSizing = "border-box";
      el.style.whiteSpace = "normal";
      el.style.wordBreak = "break-word";
      el.style.overflowWrap = "anywhere";
      el.style.lineHeight = "1.12";
      el.style.overflow = "hidden";

      const fits = (px: number) => {
        el.style.fontSize = `${px}px`;
        return el.scrollWidth <= cw + 2 && el.scrollHeight <= ch + 2;
      };

      let low = 10;
      let high = Math.min(2200, Math.max(cw * 0.95, ch * 0.95, 200));
      for (let i = 0; i < 42; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
      }
      el.style.fontSize = `${low}px`;
    };

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(container);
    return () => {
      ro.disconnect();
      const t = textRef.current;
      if (t) {
        t.style.fontSize = "";
        t.style.width = "";
        t.style.maxWidth = "";
        t.style.whiteSpace = "";
        t.style.wordBreak = "";
        t.style.overflowWrap = "";
        t.style.lineHeight = "";
        t.style.overflow = "";
      }
    };
  }, [text, enabled]);
}
