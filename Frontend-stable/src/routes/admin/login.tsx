import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useState, useEffect } from "react";
import { saveAuth, isLoggedIn, getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { isAdminRole } from "@/lib/adminGuard";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
  beforeLoad: () => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      if (isAdminRole(user?.role ?? "")) {
        throw redirect({ to: "/admin/dashboard" });
      }
    }
  },
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      if (isAdminRole(user?.role ?? "")) {
        navigate({ to: "/admin/dashboard" });
      }
    }
  }, [navigate]);

  async function handleLogin() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      if (!email || !password) {
        setError("Email dan kata sandi harus diisi.");
        return;
      }

      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message ?? "Login gagal. Periksa email dan kata sandi.");
        return;
      }

      if (!isAdminRole(data.user.role)) {
        setError("Akun ini tidak memiliki akses admin.");
        return;
      }

      saveAuth(data.user, data.token);
      navigate({ to: "/admin/dashboard" });
    } catch {
      setError("Tidak dapat terhubung ke server. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full">
      <div className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/background.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af]/80 to-[#0f2b6d]/90" />
      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] max-h-[90dvh] bg-white/95 rounded-2xl border border-white/20 overflow-y-auto"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08)" }}>
          <div className="relative flex flex-col items-center pt-8 pb-4 px-8 border-b border-[#E2E8F0]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#1e40af] rounded-b-full" />
            <div className="w-14 h-14 rounded-xl bg-[#1e40af] flex items-center justify-center mb-3">
              <Icon name="shield" className="text-white !text-[32px]" />
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-[#0F172A] tracking-tight">
              Admin Panel
            </h1>
            <p className="font-label-sm text-label-sm text-[#475569] mt-2 text-center leading-relaxed max-w-[280px]">
              Dinas PU Bina Marga &amp; SDA — Kab. Sidoarjo
            </p>
          </div>

          <div className="px-8 pt-5 pb-5">
            <div className="mb-4">
              <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                Masuk sebagai Admin
              </h2>
              <p className="font-body-sm text-body-sm text-[#475569] mt-1">
                Gunakan akun administrator Anda.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md font-semibold text-[#0F172A]">Email</label>
                <div className="relative flex items-center">
                  <Icon name="mail" className="absolute left-3.5 text-[#757684] !text-[18px] pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pu.sidoarjokab.go.id"
                    autoComplete="email"
                    className="w-full h-11 pl-10 pr-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md font-semibold text-[#0F172A]">Kata Sandi</label>
                <div className="relative flex items-center">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    className="w-full h-11 pl-4 pr-11 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3.5 text-[#757684] hover:text-[#475569] transition-colors"
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    <Icon name={showPw ? "visibility_off" : "visibility"} className="!text-[20px]" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-11 bg-[#1e40af] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 mt-1 hover:bg-[#173bab] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <Icon name="login" className="!text-[20px]" />
                    Masuk
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="px-8 py-3 bg-white border-t border-[#E2E8F0] flex items-center justify-center">
            <Link to="/" className="font-label-sm text-label-sm text-[#475569] hover:text-[#1e40af] transition-colors flex items-center gap-1">
              <Icon name="arrow_back" className="!text-[16px]" />
              Kembali ke halaman masuk petugas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
