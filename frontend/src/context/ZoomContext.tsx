import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type ElectronZoomApi = {
  getZoomFactor?: () => number;
  setZoomFactor?: (value: number) => number;
};

interface ZoomContextType {
  scale: number;
  increaseScale: () => void;
  decreaseScale: () => void;
  scaleLabel: string;
  canIncrease: boolean;
  canDecrease: boolean;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

const SCALE_KEY = "ui_scale_factor";
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.4;
const SCALE_STEP = 0.1;

const roundScale = (value: number) => Number(value.toFixed(2));
const clampScale = (value: number) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));

const getElectronZoomApi = (): ElectronZoomApi | null => {
  if (typeof window === "undefined") return null;
  const api = window.electronAPI;
  if (!api) return null;
  if (typeof api.getZoomFactor !== "function" || typeof api.setZoomFactor !== "function") {
    return null;
  }
  return api;
};

// This helper is used by drag math to compensate only CSS zoom fallback.
export const getCurrentZoomFactor = (): number => {
  if (typeof document === "undefined") return 1;
  const zoomString = document.documentElement.style.zoom;
  if (!zoomString) return 1;
  const parsed = parseFloat(zoomString);
  return Number.isFinite(parsed) ? parsed : 1;
};

const readAppliedScale = (): number => {
  const electronZoom = getElectronZoomApi();
  if (electronZoom?.getZoomFactor) {
    const factor = electronZoom.getZoomFactor();
    if (Number.isFinite(factor)) {
      return factor;
    }
  }
  return getCurrentZoomFactor();
};

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem(SCALE_KEY) ?? "NaN");
    if (Number.isFinite(saved)) {
      return clampScale(roundScale(saved));
    }
    return clampScale(roundScale(readAppliedScale()));
  });

  const applyScale = useCallback((value: number) => {
    if (typeof document === "undefined") return;
    const normalized = clampScale(roundScale(value));
    const electronZoom = getElectronZoomApi();
    if (electronZoom?.setZoomFactor) {
      electronZoom.setZoomFactor(normalized);
      // Avoid mixing native Electron zoom and CSS zoom.
      document.documentElement.style.zoom = "";
      return;
    }
    document.documentElement.style.zoom = normalized.toFixed(2);
  }, []);

  useEffect(() => {
    applyScale(scale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCALE_KEY, scale.toFixed(2));
    }
  }, [applyScale, scale]);

  useEffect(() => {
    const electronZoom = getElectronZoomApi();
    if (!electronZoom?.getZoomFactor || typeof window === "undefined") return;
    const getZoomFactor = electronZoom.getZoomFactor;

    const syncScale = () => {
      const actual = clampScale(roundScale(getZoomFactor()));
      setScale((prev) => (Math.abs(prev - actual) < 0.001 ? prev : actual));
    };

    syncScale();

    const handleKeyDown = (event: KeyboardEvent) => {
      const isZoomShortcut =
        (event.metaKey || event.ctrlKey) &&
        (event.key === "+" ||
          event.key === "=" ||
          event.key === "-" ||
          event.key === "_" ||
          event.key === "0");
      if (!isZoomShortcut) return;
      window.setTimeout(syncScale, 0);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("focus", syncScale);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", syncScale);
    };
  }, []);

  const adjustScale = useCallback((delta: number) => {
    setScale((prev) => {
      const runtime = clampScale(roundScale(readAppliedScale()));
      const base = Math.abs(runtime - prev) > 0.001 ? runtime : prev;
      return clampScale(roundScale(base + delta));
    });
  }, []);

  const decreaseScale = useCallback(() => {
    adjustScale(-SCALE_STEP);
  }, [adjustScale]);

  const increaseScale = useCallback(() => {
    adjustScale(SCALE_STEP);
  }, [adjustScale]);

  const canDecrease = scale > SCALE_MIN + 0.001;
  const canIncrease = scale < SCALE_MAX - 0.001;
  const scaleLabel = `${Math.round(scale * 100)}%`;

  return (
    <ZoomContext.Provider
      value={{
        scale,
        increaseScale,
        decreaseScale,
        scaleLabel,
        canIncrease,
        canDecrease,
      }}
    >
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = () => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error("useZoom must be used within ZoomProvider");
  }
  return context;
};
