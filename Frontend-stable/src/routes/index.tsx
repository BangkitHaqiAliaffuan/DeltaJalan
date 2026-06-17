import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <div className="fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
          style={{ backgroundImage: "url('/background.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af]/80 to-[#0f2b6d]/90" />
      </div>

      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] animate-fade-in">
          <div className="animate-slide-up">
            <div
              className="bg-white rounded-2xl overflow-hidden border-2 border-[#1e40af]"
              style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}
            >

              <div className="flex flex-col items-center pt-8 pb-6 px-8">
                <div className="w-16 h-16 rounded-xl bg-white shadow-md flex items-center justify-center mb-4">
                  <img src="/logo.png" alt="DeltaJalan" className="w-10 h-10" />
                </div>
                <h1 className="font-headline-lg text-headline-lg font-extrabold bg-gradient-to-r from-[#1e40af] to-[#2e68d8] bg-clip-text text-transparent tracking-tight">
                  DeltaJalan
                </h1>
                <p className="text-center mt-2 font-body-sm text-body-sm text-[#475569] max-w-[280px] leading-relaxed">
                  Sistem Informasi Jalan Raya — Dinas PU Bina Marga
                </p>
              </div>

              <div className="px-8 pb-6">
                {error && (
                  <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                    <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">{error}</p>
                  </div>
                )}

                <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]" htmlFor="email">
                      Email
                    </label>
                    <div className="relative flex items-center">
                      <Icon name="mail" className="absolute left-3.5 text-[#757684] !text-[18px] pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@domain.com"
                        autoComplete="email"
                        className="w-full h-11 pl-10 pr-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200"
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-label-md text-label-md font-semibold text-[#0F172A]" htmlFor="password">
                        Kata Sandi
                      </label>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        id="password"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full h-11 pl-4 pr-11 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200"
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
                    <div className="flex justify-end pt-0.5">
                      <a className="text-[12px] font-medium text-[#475569] hover:text-[#1e40af] transition-colors" href="#">
                        Lupa Password?
                      </a>
                    </div>
                  </div>

                  <button
                    type="submit"
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 mt-1 hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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

            <p className="text-center mt-6 text-[11px] text-white/50 font-medium tracking-wider">
              Dinas PU Bina Marga & SDA — Kab. Sidoarjo
            </p>
            <p className="text-center mt-1 text-[10px] text-white/30">
              &copy; 2024 DeltaJalan Infrastructure Suite. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
