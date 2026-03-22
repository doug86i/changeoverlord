import { useLayoutEffect } from "react";

/**
 * Sets `--app-scrollbar-width` on `<html>` so `position: fixed` UI (e.g. stage chat)
 * can sit clear of classic non-overlay viewport scrollbars. Updates on resize /
 * layout changes.
 */
export function ViewportScrollbarVar() {
  useLayoutEffect(() => {
    const el = document.documentElement;
    const sync = () => {
      const gutter = window.innerWidth - el.clientWidth;
      el.style.setProperty(
        "--app-scrollbar-width",
        `${Math.max(0, Math.round(gutter))}px`,
      );
    };
    sync();
    window.addEventListener("resize", sync);
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);
  return null;
}
