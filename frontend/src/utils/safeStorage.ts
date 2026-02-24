/**
 * Safe localStorage operations
 * Handles cases:
 * - Safari private browsing
 * - Iframe 3rd party cookies
 * - API unavailability
 */

type StorageValue = string | number | boolean | object | null;

class SafeStorage {
  private available: boolean;
  private memoryFallback: Map<string, string>;

  constructor() {
    this.memoryFallback = new Map();
    this.available = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      console.warn("[SafeStorage] localStorage not available, using memory fallback");
      return false;
    }
  }

  getItem<T = string>(key: string): T | null {
    try {
      if (this.available) {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as T) : null;
      } else {
        const value = this.memoryFallback.get(key);
        return value ? (JSON.parse(value) as T) : null;
      }
    } catch (e) {
      console.error(`[SafeStorage] Error getting item "${key}":`, e);
      return null;
    }
  }

  setItem(key: string, value: StorageValue): boolean {
    try {
      const stringValue = JSON.stringify(value);

      if (this.available) {
        localStorage.setItem(key, stringValue);
      } else {
        this.memoryFallback.set(key, stringValue);
      }

      return true;
    } catch (e) {
      console.error(`[SafeStorage] Error setting item "${key}":`, e);
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      if (this.available) {
        localStorage.removeItem(key);
      } else {
        this.memoryFallback.delete(key);
      }
      return true;
    } catch (e) {
      console.error(`[SafeStorage] Error removing item "${key}":`, e);
      return false;
    }
  }

  clear(): boolean {
    try {
      if (this.available) {
        localStorage.clear();
      } else {
        this.memoryFallback.clear();
      }
      return true;
    } catch (e) {
      console.error("[SafeStorage] Error clearing storage:", e);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }
}

export const safeStorage = new SafeStorage();
