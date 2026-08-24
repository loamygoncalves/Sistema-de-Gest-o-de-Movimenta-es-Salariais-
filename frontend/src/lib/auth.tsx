"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, ApiError, getToken, setToken } from "./api";
import { AuthUser, LoginResponse, Role } from "@/types";

const USER_KEY = "sgms.user";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setTokenState(getToken());
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>("/auth/login", { email, password });
    setToken(res.accessToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setTokenState(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    window.localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, token, loading, login, logout, hasRole }),
    [user, token, loading, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
}

export { ApiError };
