import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ConnectionState = "connected" | "connecting" | "offline";

type ConnectionCtx = {
  state: ConnectionState;
  setState: (s: ConnectionState) => void;
};

const Ctx = createContext<ConnectionCtx>({
  state: "connecting",
  setState: () => {},
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setRaw] = useState<ConnectionState>("connecting");
  const setState = useCallback((s: ConnectionState) => setRaw(s), []);
  return <Ctx.Provider value={{ state, setState }}>{children}</Ctx.Provider>;
}

export function useConnectionState() {
  return useContext(Ctx);
}
