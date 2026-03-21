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
      if (cw < 16 || ch < 16) return;
      el.style.whiteSpace = "nowrap";
      el.style.lineHeight = "1";
      const fits = (px: number) => {
        el.style.fontSize = `${px}px`;
        return el.scrollWidth <= cw && el.scrollHeight <= ch;
      };
      let low = 8;
      let high = Math.min(cw * 2, ch * 4, 2000);
      for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid;
        else high = mid;
      }
      el.style.fontSize = `${low}px`;
    };

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(container);
    return () => ro.disconnect();
  }, [text, enabled]);
}
