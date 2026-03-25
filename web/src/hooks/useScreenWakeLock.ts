import { useEffect, useRef } from "react";
import { logDebug } from "../lib/debug";

/**
 * While `enabled` is true, requests the Screen Wake Lock API so the display
 * does not dim or sleep. Released when `enabled` becomes false or the hook
 * unmounts. Re-acquires when the tab becomes visible again (browsers usually
 * release the lock while the document is hidden).
 */
export function useScreenWakeLock(enabled: boolean) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;

    const releaseLock = async () => {
      if (!lock) return;
      try {
        await lock.release();
      } catch {
        // already released
      }
      lock = null;
    };

    const acquire = async () => {
      if (!enabledRef.current || cancelled) return;
      const api = navigator.wakeLock;
      if (!api?.request) return;
      try {
        await releaseLock();
        if (!enabledRef.current || cancelled) return;
        lock = await api.request("screen");
      } catch {
        logDebug("screen wake lock: request failed", {
          visibilityState: document.visibilityState,
        });
      }
    };

    if (!enabled) {
      void releaseLock();
      return () => {
        cancelled = true;
        void releaseLock();
      };
    }

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible" && enabledRef.current) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void releaseLock();
    };
  }, [enabled]);
}
