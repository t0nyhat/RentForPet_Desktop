import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { registerLogoutCallback } from "../utils/apiClient";
import { safeStorage } from "../utils/safeStorage";
import { ENV, getApiUrl } from "../config/env";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  tenantId?: string;
  tenantName?: string;
};

type RawAuthUser = Omit<AuthUser, "role"> & { role: AuthUser["role"] | number };

const roleMap: Record<number, AuthUser["role"]> = {
  0: "Client",
  1: "Admin",
  2: "SuperAdmin",
};

const normalizeUser = (user: RawAuthUser | null | undefined): AuthUser | null => {
  if (!user) {
    return null;
  }
  const rawRole = user.role;
  const role = typeof rawRole === "number" ? (roleMap[rawRole] ?? "Client") : rawRole;
  return {
    ...user,
    role,
  };
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  initializing: boolean; // Flag for initial loading from localStorage
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string, subdomain?: string) => Promise<AuthUser | null>;
  register: (payload: RegisterPayload) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  isAuthenticated: boolean;
  isLoading: boolean;
  clearError: () => void;
};

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  loading: false,
  initializing: true, // Start with true until we check localStorage
  error: null,
};

export type RegisterPayload = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
};

const STORAGE_KEY = "pet_hotel_auth";

// Standalone mode: always in dev mode with automatic auth
const DEV_ADMIN_USER: AuthUser = {
  id: "dev-admin-001",
  email: "admin@localhost",
  role: "Admin",
  tenantId: undefined,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Standalone mode: always logged in as admin
  const [state, setState] = useState<AuthState>({
    ...initialState,
    user: DEV_ADMIN_USER,
    token: "standalone-token",
    refreshToken: null,
    initializing: true, // Loading admin data from API
  });

  // Get admin data from API on initialization
  useEffect(() => {
    const fetchAdminUser = async () => {
      try {
        const response = await fetch(getApiUrl("/api/auth/me"));
        if (response.ok) {
          const data = await response.json();
          const adminUser: AuthUser = {
            id: data.userId || DEV_ADMIN_USER.id,
            email: data.email || DEV_ADMIN_USER.email,
            role: data.role || "Admin",
            clientId: data.clientId,
            tenantId: data.tenantId,
          };
          setState((prev) => ({
            ...prev,
            user: adminUser,
            initializing: false,
          }));
        } else {
          // Fallback to default admin
          setState((prev) => ({
            ...prev,
            user: DEV_ADMIN_USER,
            initializing: false,
          }));
        }
      } catch (error) {
        console.warn("Failed to load admin data, using defaults", error);
        setState((prev) => ({
          ...prev,
          user: DEV_ADMIN_USER,
          initializing: false,
        }));
      }
    };
    fetchAdminUser();
  }, []);

  const persist = useCallback((next: Partial<AuthState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      if ("user" in next) {
        merged.user = normalizeUser(next.user as RawAuthUser | null);
      } else if (merged.user) {
        merged.user = normalizeUser(merged.user as RawAuthUser);
      }
      if (merged.token) {
        safeStorage.setItem(STORAGE_KEY, {
          token: merged.token,
          refreshToken: merged.refreshToken,
          user: merged.user,
        });
      } else {
        safeStorage.removeItem(STORAGE_KEY);
      }
      return merged;
    });
  }, []);

  // Login not needed - always authorized as admin
  const login = useCallback(async () => {
    return state.user;
  }, [state.user]);

  // Registration not needed
  const register = useCallback(async () => {
    return state.user;
  }, [state.user]);

  // Logout not needed - just a stub
  const logout = useCallback(async () => {
    // Do nothing - always stay as admin
  }, []);

  // Register logout callback for global 401 handling
  useEffect(() => {
    registerLogoutCallback(() => {
      persist({
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        initializing: false,
        error: null,
      });
    });
  }, [persist]);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    // No authorization headers needed - backend authorization disabled
    const headers = new Headers(init.headers || {});

    // Convert relative /api URLs to full URL (dev and Electron use localhost:5226)
    let url = input;
    if (typeof input === "string" && input.startsWith("/api")) {
      url = `${ENV.API_URL.replace(/\/$/, "")}${input}`;
    }

    return fetch(url, { ...init, headers });
  }, []);

  const clearError = useCallback(() => {
    persist({ error: null });
  }, [persist]);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    authFetch,
    isAuthenticated: Boolean(state.token),
    isLoading: state.loading || state.initializing, // Loading = active operation OR initialization
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
