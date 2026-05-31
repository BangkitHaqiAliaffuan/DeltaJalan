import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useState, useEffect } from "react";
import { saveAuth, isLoggedIn, getCurrentUser } from "@/lib/auth";

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
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Jika sudah login, redirect langsung
  useEffect(() => {
    if (isLoggedIn()) {
      const user = getCurrentUser();
      navigate({
        to:
          user?.role === "supervisor"
            ? "/supervisor"
            : user?.role === "petugas_eksekusi"
              ? "/petugas-eksekusi"
              : "/home",
      });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
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

      if (data.user.role === "supervisor") {
        navigate({ to: "/supervisor" });
      } else if (data.user.role === "petugas_eksekusi") {
        navigate({ to: "/petugas-eksekusi" });
      } else {
        navigate({ to: "/home" });
      }
    } catch {
      setError("Tidak dapat terhubung ke server. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-y-auto"
      style={{
        backgroundImage: "url('/background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      <div className="relative z-10 min-h-full flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-[400px] bg-white rounded-xl border border-[#D0DAE8] overflow-hidden shadow-lg">
          <div className="flex flex-col items-center pt-6 pb-4 px-8 border-b border-[#D0DAE8]">
            <img src="/logo.png" alt="DeltaJalan" className="w-20 h-20 object-contain mb-3" />
            <h1 className="text-[20px] font-bold text-on-surface leading-tight">DeltaJalan</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Sistem Pelaporan Kerusakan Jalan
            </p>
          </div>

          <div className="px-8 pt-5 pb-6">
            <div className="mb-4">
              <h2 className="text-[18px] font-bold text-on-surface">Selamat Datang</h2>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                Masuk dengan akun Dinas PU Bina Marga Anda
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
                <Icon name="error" className="text-[#991B1B] !text-[18px] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#991B1B] leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[13px] font-semibold text-on-surface">Email</label>
                <div className="relative flex items-center">
                  <Icon name="mail" className="absolute left-3 text-[#8FA3B8] !text-[18px]" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@pu.sidoarjokab.go.id"
                    autoComplete="email"
                    className="w-full py-2.5 pl-10 pr-4 border border-[#C0CEDF] rounded-lg text-[14px] text-on-surface placeholder:text-[#8FA3B8] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[13px] font-semibold text-on-surface">
                  Kata Sandi
                </label>
                <div className="relative flex items-center">
                  <input
                    required
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    className="w-full py-2.5 pl-4 pr-11 border border-[#C0CEDF] rounded-lg text-[14px] text-on-surface placeholder:text-[#8FA3B8] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 text-[#8FA3B8] hover:text-[#5A6A7E] transition-colors"
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    <Icon
                      name={showPw ? "visibility_off" : "visibility"}
                      className="!text-[20px]"
                    />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 mt-1 hover:bg-[#163F6E] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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

          <div className="px-8 py-3 bg-white border-t border-[#D0DAE8]">
            <p className="text-[11px] text-[#5A6A7E] text-center">
              &copy; Dinas PU Bina Marga Kabupaten Sidoarjo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
