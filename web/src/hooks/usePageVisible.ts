import { useEffect, useState } from "react";

/** `true` when the document tab is visible (not backgrounded / screen off). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true,
  );

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return visible;
}
