import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LAST_STAGE_DAY_STORAGE_KEY } from "./lib/useLastVisited";

type Ctx = {
  preferredStageDayId: string | null;
  setPreferredStageDayId: (id: string) => void;
};

const ClockNavContext = createContext<Ctx | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem(LAST_STAGE_DAY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ClockNavProvider({ children }: { children: ReactNode }) {
  const [preferredStageDayId, setPreferred] = useState<string | null>(() => readStored());

  const setPreferredStageDayId = useCallback((id: string) => {
    setPreferred(id);
    try {
      localStorage.setItem(LAST_STAGE_DAY_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ preferredStageDayId, setPreferredStageDayId }),
    [preferredStageDayId, setPreferredStageDayId],
  );

  return <ClockNavContext.Provider value={value}>{children}</ClockNavContext.Provider>;
}

export function useClockNav(): Ctx {
  const v = useContext(ClockNavContext);
  if (!v) throw new Error("useClockNav must be used within ClockNavProvider");
  return v;
}
