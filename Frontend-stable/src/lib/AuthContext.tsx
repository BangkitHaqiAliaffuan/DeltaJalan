import { createContext, useContext, useState, useEffect } from "react";
import { clearAuth, getCurrentUser, getToken, type User } from "./auth";

interface AuthState {
  user: User | null;
  token: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, token: null });

/**
 * Memeriksa apakah token yang tersimpan masih diterima server.
 *
 * ── Mengapa perlu ─────────────────────────────────────────────────────────
 * Token Sanctum sekarang punya masa berlaku (`expires_at`, lihat
 * `SanctumTokenService`). Tanpa pemeriksaan ini, pengguna yang tokennya sudah
 * kedaluwarsa tetap terlihat "login" di antarmuka, lalu setiap aksi gagal
 * dengan error mentah — layar kosong tanpa penjelasan, dan tidak ada jalan
 * kembali ke halaman masuk selain menghapus data situs secara manual.
 *
 * Pemeriksaan hanya dilakukan BILA ada token tersimpan, sekali saat aplikasi
 * dimuat. Biayanya satu permintaan ringan per kunjungan, bukan per klik.
 *
 * Kegagalan jaringan TIDAK menghapus sesi: kalau pengguna sedang offline atau
 * server sedang down, mereka tidak boleh ter-logout karena itu.
 */
function useSessionValidation() {
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let dibatalkan = false;

    const cek = async () => {
      try {
        const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");
        const res = await fetch(`${base}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        // Hanya 401/403 yang berarti "token mati". Status lain (500, 502,
        // 429, dll.) adalah masalah server — sesi dibiarkan.
        if (!dibatalkan && (res.status === 401 || res.status === 403)) {
          clearAuth();
        }
      } catch {
        // Offline / server tidak terjangkau → jangan hapus sesi.
      }
    };

    void cek();

    return () => {
      dibatalkan = true;
    };
  }, []);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    user: getCurrentUser(),
    token: getToken(),
  }));

  useSessionValidation();

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
