/**
 * Environment configuration
 * Centralized access to environment variables with type safety
 */

const isElectron =
  typeof window !== "undefined" && window.navigator?.userAgent?.toLowerCase().includes("electron");

export const ENV = {
  API_URL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:5226" : isElectron ? "http://localhost:5226" : "/api"),
  APP_NAME: import.meta.env.VITE_APP_NAME || "PetHotel",
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  ENABLE_DEVTOOLS: import.meta.env.VITE_ENABLE_DEVTOOLS === "true",
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || "info",
} as const;

/** Full URL for API requests (for Electron and dev — localhost:5226). */
export function getApiUrl(path: string): string {
  return path.startsWith("http")
    ? path
    : ENV.API_URL.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

/**
 * Type-safe environment variable access
 */
export type Environment = typeof ENV;

/**
 * Logger utility that respects LOG_LEVEL
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (ENV.LOG_LEVEL === "debug") {
      console.log("[DEBUG]", ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (["debug", "info"].includes(ENV.LOG_LEVEL)) {
      console.info("[INFO]", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (["debug", "info", "warn"].includes(ENV.LOG_LEVEL)) {
      console.warn("[WARN]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
};
