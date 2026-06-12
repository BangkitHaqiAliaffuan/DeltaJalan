import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useState, useEffect } from "react";
import { saveAuth, isLoggedIn, getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Masuk — DeltaJalan" },
      {
        name: "description",
        content:
          "Masuk ke DeltaJalan — sistem pelaporan kerusakan jalan Dinas PU Bina Marga Sidoarjo.",
      },
    ],
  }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      const path =
        user?.role === "admin"
          ? "/admin/dashboard"
          : user?.role === "supervisor"
            ? "/supervisor"
            : user?.role === "petugas_eksekusi"
              ? "/petugas-eksekusi"
              : "/home";
      navigate({ to: path });
    }
  }, [navigate]);

  async function handleLogin() {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
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

      saveAuth(data.user, data.token);

      const path =
        data.user.role === "admin"
          ? "/admin/dashboard"
          : data.user.role === "supervisor"
            ? "/supervisor"
            : data.user.role === "petugas_eksekusi"
              ? "/petugas-eksekusi"
              : "/home";
      navigate({ to: path });
    } catch {
      setError("Tidak dapat terhubung ke server. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Panel — background.jpg + blue overlay + branding (desktop only) */}
      <div className="hidden md:flex w-1/2 relative flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/background.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af]/85 to-[#00288e]/95" />
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="mb-8 bg-white p-4 rounded-2xl shadow-lg">
            <img
              src="/logo.png"
              alt="DeltaJalan"
              className="w-28 h-28 md:w-40 md:h-40"
            />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-primary tracking-tight mb-2">
            DeltaJalan
          </h1>
          <p className="text-on-primary/80 font-label-md text-label-md max-w-sm">
            Sistem Informasi Jalan Raya — Dinas PU Bina Marga
          </p>
          <div className="mt-12 h-1 w-24 bg-on-primary/30 rounded-full" />
        </div>
        <div className="absolute bottom-8 left-8 right-8 text-center md:text-left">
          <p className="text-xs font-medium text-on-primary/60 uppercase tracking-widest">
            Dinas PU Bina Marga & SDA — Kab. Sidoarjo
          </p>
          <p className="text-[10px] text-on-primary/40 mt-1">
            &copy; 2024 DeltaJalan Infrastructure Suite. All Rights Reserved.
          </p>
        </div>
      </div>

      {/* Right Panel — login form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-surface px-6 py-6 md:py-0 relative overflow-hidden">
        <div
          className="w-full max-w-[420px] rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden"
          style={{ backgroundColor: "var(--color-surface-container-low)" }}
        >
          <div className="h-1.5 w-full bg-[#1e40af]" />
          <div className="p-6 md:p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="bg-white p-2 rounded-xl shadow-sm mb-3">
                <img
                  src="/logo.png"
                  alt="DeltaJalan"
                  className="w-10 h-10"
                />
              </div>
              <h2 className="text-[24px] leading-8 font-headline-md text-on-surface mb-1">
                Masuk
              </h2>
              <p className="text-on-surface-variant font-body-sm text-body-sm">
                Silakan masuk menggunakan akun Anda
              </p>
            </div>

            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                  <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-label-md font-semibold text-on-surface" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@domain.com"
                  autoComplete="email"
                  className="w-full h-12 px-4 rounded-lg border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all duration-200"
                  style={{ backgroundColor: "var(--color-surface-container-high)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-label-md font-semibold text-on-surface" htmlFor="password">
                    Kata Sandi
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-12 px-4 pr-11 rounded-lg border border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all duration-200"
                    style={{ backgroundColor: "var(--color-surface-container-high)" }}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    <Icon
                      name={showPw ? "visibility_off" : "visibility"}
                      className="!text-xl"
                    />
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <a className="text-[12px] font-medium text-on-surface-variant hover:text-primary transition-colors" href="#">
                    Lupa Password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-12 bg-[#1e40af] text-white font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-md shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
