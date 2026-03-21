import { useCallback } from "react";

export const LAST_STAGE_DAY_STORAGE_KEY = "changeoverlord-last-stage-day";

export function useLastVisited() {
  const lastStageDayId = (): string | null => {
    try {
      return localStorage.getItem(LAST_STAGE_DAY_STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const setLastStageDayId = useCallback((id: string) => {
    try {
      localStorage.setItem(LAST_STAGE_DAY_STORAGE_KEY, id);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  return { lastStageDayId, setLastStageDayId };
}
