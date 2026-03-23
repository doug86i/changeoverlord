import { useLayoutEffect, type RefObject } from "react";

/**
 * Sets `textRef` font size so one line of text fits inside `containerRef` without overflow.
 * Uses binary search; re-runs when `text` changes or the container resizes.
 */
export function useFitCountdownInBox(
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
      el.style.whiteSpace = "nowrap";
      el.style.lineHeight = "1";
      /* Tiny or not yet laid out — still pick a bounded size so text never overflows parent */
      if (cw < 4 || ch < 4) {
        el.style.fontSize = "6px";
        return;
      }
      const fits = (px: number) => {
        el.style.fontSize = `${px}px`;
        return el.scrollWidth <= cw + 1 && el.scrollHeight <= ch + 1;
      };
      let low = 4;
      let high = Math.min(Math.max(cw, 8) * 2, Math.max(ch, 8) * 6, 2000);
      for (let i = 0; i < 34; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
      }
      el.style.fontSize = `${low}px`;
    };

    fit();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [text, enabled]);
}
