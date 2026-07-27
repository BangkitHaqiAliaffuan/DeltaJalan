import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, getToken, type User } from "./auth";

interface AuthState {
  user: User | null;
  token: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, token: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    user: getCurrentUser(),
    token: getToken(),
  }));

  useEffect(() => {
    function onLogin() {
      setAuth({ user: getCurrentUser(), token: getToken() });
    }
    function onLogout() {
      setAuth({ user: null, token: null });
    }
    window.addEventListener("auth:login", onLogin);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:login", onLogin);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
