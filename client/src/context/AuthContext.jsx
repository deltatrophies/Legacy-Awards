import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authApi.restore()
      .then((restoredUser) => { if (active) setUser(restoredUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    async login(credentials) {
      const nextUser = await authApi.login(credentials);
      setUser(nextUser);
      return nextUser;
    },
    async register(input) {
      const nextUser = await authApi.register(input);
      setUser(nextUser);
      return nextUser;
    },
    async updateProfile(input) {
      const nextUser = await authApi.updateProfile(input);
      setUser(nextUser);
      return nextUser;
    },
    async updateAvatar(file) {
      const nextUser = await authApi.updateAvatar(file);
      setUser(nextUser);
      return nextUser;
    },
    async logout() {
      await authApi.logout();
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
