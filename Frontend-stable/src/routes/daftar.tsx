import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useState } from "react";
import { registerUser } from "@/lib/auth";
import { validateIndonesianPhone, validateNamaLengkap } from "@/lib/validators";

export const Route = createFileRoute("/daftar")({
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "Daftar Akun Warga — DeltaJalan" },
      {
        name: "description",
        content: "Daftar akun untuk melaporkan kerusakan jalan di Kabupaten Sidoarjo.",
      },
    ],
  }),
});

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  async function handleRegister() {
    if (loading) return;
    setError("");
    setSuccess("");

    const nameResult = validateNamaLengkap(name);
    if (!nameResult.valid) {
      setNameError(nameResult.error!);
      setError("Perbaiki kesalahan pada form.");
      return;
    }
    setNameError("");

    if (password !== passwordConfirmation) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    const phoneResult = validateIndonesianPhone(phone);
    if (!phoneResult.valid) {
      setPhoneError(phoneResult.error!);
      setError("Perbaiki kesalahan pada form.");
      return;
    }
    setPhoneError("");

    setLoading(true);

    try {
      const result = await registerUser({
        name,
        email,
        phone,
        password,
        password_confirmation: passwordConfirmation,
      });

      if (result.success) {
        setSuccess("Registrasi berhasil! Silakan login.");
        setTimeout(() => navigate({ to: "/masuk" }), 2000);
      } else {
        if (result.errors) {
          const firstError = Object.values(result.errors).flat()[0];
          setError(firstError ?? result.message);
        } else {
          setError(result.message);
        }
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  function handleNameBlur() {
    if (!name) {
      setNameError("");
      return;
    }
    const result = validateNamaLengkap(name);
    if (!result.valid) {
      setNameError(result.error!);
    } else {
      setNameError("");
      setName(result.normalized);
    }
  }

  function handlePhoneBlur() {
    if (!phone) {
      setPhoneError("");
      return;
    }
    const result = validateIndonesianPhone(phone);
    if (!result.valid) {
      setPhoneError(result.error!);
    } else {
      setPhoneError("");
      setPhone(result.normalized);
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-y-auto thin-scrollbar">
      <div className="fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
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
                  Daftar Akun
                </h1>
                <p className="text-center mt-2 font-body-sm text-body-sm text-[#475569] max-w-[280px] leading-relaxed">
                  Buat akun untuk melaporkan kerusakan jalan
                </p>
              </div>

              <div className="px-8 pb-6">
                {error && (
                  <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                    <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">
                      {error}
                    </p>
                  </div>
                )}

                {success && (
                  <div className="mb-4 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <Icon
                      name="check_circle"
                      className="text-[#16A34A] !text-[18px] shrink-0 mt-0.5"
                    />
                    <p className="font-body-sm text-body-sm text-[#16A34A] leading-relaxed">
                      {success}
                    </p>
                  </div>
                )}

                <form
                  className="flex flex-col gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRegister();
                  }}
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                      Nama Lengkap
                    </label>
                    <div className="relative flex items-center">
                      <Icon
                        name="person"
                        className="absolute left-3.5 text-[#757684] !text-[18px] pointer-events-none"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setNameError("");
                        }}
                        onBlur={handleNameBlur}
                        placeholder="Nama lengkap"
                        autoComplete="name"
                        required
                        className={`w-full h-11 pl-10 pr-4 border rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200 ${nameError ? "border-[#E11D48]" : "border-[#c4c5d5]"}`}
                      />
                    </div>
                    {nameError && (
                      <p className="text-[11px] text-[#E11D48] flex items-center gap-1">
                        <Icon name="error" className="!text-[12px]" />
                        {nameError}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                      Email
                    </label>
                    <div className="relative flex items-center">
                      <Icon
                        name="mail"
                        className="absolute left-3.5 text-[#757684] !text-[18px] pointer-events-none"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        autoComplete="email"
                        required
                        className="w-full h-11 pl-10 pr-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                      No. Telepon
                    </label>
                    <div className="relative flex items-center">
                      <Icon
                        name="phone"
                        className="absolute left-3.5 text-[#757684] !text-[18px] pointer-events-none"
                      />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setPhoneError("");
                        }}
                        onBlur={handlePhoneBlur}
                        placeholder="08xxxxxxxxxx"
                        autoComplete="tel"
                        required
                        className={`w-full h-11 pl-10 pr-4 border rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 transition-all duration-200 ${phoneError ? "border-[#E11D48]" : "border-[#c4c5d5]"}`}
                      />
                    </div>
                    {phoneError && (
                      <p className="text-[11px] text-[#E11D48] flex items-center gap-1">
                        <Icon name="error" className="!text-[12px]" />
                        {phoneError}
                      </p>
                    )}
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <Icon name="info" className="!text-[12px]" />
                      Contoh: 081234567890 atau +6281234567890
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                      Kata Sandi
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        className="w-full h-11 pl-4 pr-11 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3.5 text-[#757684] hover:text-[#475569] transition-colors"
                        aria-label={showPw ? "Sembunyikan" : "Tampilkan"}
                      >
                        <Icon
                          name={showPw ? "visibility_off" : "visibility"}
                          className="!text-[20px]"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md font-semibold text-[#0F172A]">
                      Konfirmasi Kata Sandi
                    </label>
                    <input
                      type="password"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      autoComplete="new-password"
                      required
                      className="w-full h-11 pl-4 pr-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] transition-all duration-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2 mt-1 hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Mendaftarkan...
                      </>
                    ) : (
                      <>
                        <Icon name="person_add" className="!text-[20px]" />
                        Daftar
                      </>
                    )}
                  </button>
                </form>

                <div className="flex flex-col items-center gap-2 mt-5">
                  <Link
                    to="/masuk"
                    className="font-label-sm text-label-sm text-[#1e40af] hover:text-[#2e68d8] font-semibold transition-colors"
                  >
                    Sudah punya akun? Masuk
                  </Link>
                </div>
              </div>
            </div>

            <p className="text-center mt-6 text-[11px] text-white/50 font-medium tracking-wider">
              Dinas PU Bina Marga & SDA — Kab. Sidoarjo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
