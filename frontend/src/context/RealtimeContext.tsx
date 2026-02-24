import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { RealtimeEvent, RealtimeEventMap } from "../types/realtime";

type RealtimeContextValue = {
  status: "disconnected" | "connecting" | "connected" | "error";
  subscribe: <K extends RealtimeEvent>(
    event: K,
    handler: (payload: RealtimeEventMap[K]) => void
  ) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

/**
 * Standalone mode: RealtimeProvider is a no-op provider
 * SignalR/WebSockets are not needed for local development with no real-time updates
 * This provider still exists for compatibility but doesn't actually connect to any hub
 */
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [status] = useState<RealtimeContextValue["status"]>("connected");
  const emitterRef = useRef<EventTarget>(new EventTarget());

  const subscribe = useCallback<RealtimeContextValue["subscribe"]>((event, handler) => {
    const listener = (e: Event) => {
      const custom = e as CustomEvent<RealtimeEventMap[typeof event]>;
      handler(custom.detail);
    };
    const target = emitterRef.current;
    target.addEventListener(event, listener as EventListener);
    return () => target.removeEventListener(event, listener as EventListener);
  }, []);

  const value = useMemo(
    () => ({
      status,
      subscribe,
    }),
    [status, subscribe]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
};
