import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { authApi } from "../services/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [sessionUser, setSessionUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    let active = true;
    authApi.restore()
      .then((restoredUser) => { if (active) setSessionUser(restoredUser); })
      .catch(() => { if (active) setSessionUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const user = useMemo(() => {
    if (!sessionUser) return null;
    if (isAdminRoute) return sessionUser.role === "admin" ? sessionUser : null;
    return sessionUser.role === "admin" ? null : sessionUser;
  }, [isAdminRoute, sessionUser]);

  const value = useMemo(() => ({
    user,
    sessionUser,
    loading,
    isAuthenticated: Boolean(user),
    async login(credentials, options = {}) {
      const scope = options.scope || (isAdminRoute ? "admin" : "customer");
      const nextUser = await authApi.login(credentials);
      if (scope === "admin" && nextUser.role !== "admin") {
        await authApi.logout().catch(() => {});
        setSessionUser(null);
        throw new Error("This account is not allowed to access the admin panel.");
      }
      if (scope === "customer" && nextUser.role === "admin") {
        await authApi.logout().catch(() => {});
        setSessionUser(null);
        throw new Error("Admin accounts must use the admin login page.");
      }
      setSessionUser(nextUser);
      return nextUser;
    },
    async register(input) {
      const nextUser = await authApi.register(input);
      setSessionUser(nextUser);
      return nextUser;
    },
    async updateProfile(input) {
      const nextUser = await authApi.updateProfile(input);
      setSessionUser(nextUser);
      return nextUser;
    },
    async updateAvatar(file) {
      const nextUser = await authApi.updateAvatar(file);
      setSessionUser(nextUser);
      return nextUser;
    },
    async logout() {
      await authApi.logout();
      setSessionUser(null);
    },
  }), [isAdminRoute, loading, sessionUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
