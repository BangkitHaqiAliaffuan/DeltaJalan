import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "DeltaJalan — Deteksi Cepat, Penanganan Tepat" },
      {
        name: "description",
        content:
          "Sistem pelaporan kerusakan jalan Kabupaten Sidoarjo — Dinas PU Bina Marga.",
      },
    ],
  }),
});

const damageTypes = [
  {
    icon: "landslide",
    title: "Lubang",
    desc: "Depresi lokal di permukaan perkerasan dengan diameter bervariasi, seringkali disebabkan oleh infiltrasi air.",
  },
  {
    icon: "grid_on",
    title: "Retak Kulit Buaya",
    desc: "Serangkaian retak saling terhubung membentuk pola poligonal menyerupai kulit buaya akibat kelelahan beban.",
  },
  {
    icon: "view_column",
    title: "Retak Memanjang",
    desc: "Retakan yang sejajar dengan sumbu tengah jalan, biasanya disebabkan oleh sambungan konstruksi yang kurang sempurna.",
  },
  {
    icon: "view_stream",
    title: "Retak Melintang",
    desc: "Retakan yang melintasi lebar jalan secara tegak lurus, sering terjadi karena perubahan suhu ekstrim.",
  },
];

const steps = [
  {
    icon: "photo_camera",
    title: "Ambil Foto",
    desc: "Potret kondisi jalan yang rusak secara jelas untuk mempermudah identifikasi.",
  },
  {
    icon: "description",
    title: "Isi Laporan",
    desc: "Lengkapi data lokasi GPS dan deskripsi singkat mengenai tingkat kerusakan.",
  },
  {
    icon: "track_changes",
    title: "Pantau Status",
    desc: "Ikuti perkembangan perbaikan laporan Anda secara real-time melalui sistem kami.",
  },
];

function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const damageRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.config({ ignoreMobileResize: true });

      gsap.from(".hero-title", { y: 80, opacity: 0, duration: 1.2, ease: "power4.out" });
      gsap.from(".hero-sub", { y: 40, opacity: 0, duration: 1, ease: "power4.out", delay: 0.3 });
      gsap.from(".hero-buttons", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out", delay: 0.6 });
      gsap.from(".hero-scroll", { opacity: 0, duration: 0.6, delay: 1.2 });

      gsap.from(".stat-card", {
        scrollTrigger: { trigger: statsRef.current, start: "top 85%", toggleActions: "play none none none" },
        y: 50, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out",
      });

      gsap.from(".step-card", {
        scrollTrigger: { trigger: stepsRef.current, start: "top 80%", toggleActions: "play none none none" },
        y: 60, opacity: 0, stagger: 0.2, duration: 0.8, ease: "power3.out",
      });

      gsap.from(".damage-card", {
        scrollTrigger: { trigger: damageRef.current, start: "top 80%", toggleActions: "play none none none" },
        y: 50, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out",
      });

      gsap.from(".cta-content", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 85%", toggleActions: "play none none none" },
        y: 40, opacity: 0, duration: 0.8, ease: "power3.out",
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="w-full overflow-x-hidden">
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-[#e2e8f0]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DeltaJalan" className="w-8 h-8" />
          <span className={`font-headline-md text-headline-md font-bold tracking-tight transition-colors ${scrolled ? "text-[#0F172A]" : "text-white"}`}>
            DeltaJalan
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/lacak"
            className={`font-label-md text-label-md transition-colors ${scrolled ? "text-[#475569] hover:text-[#1e40af]" : "text-white/80 hover:text-white"}`}
          >
            Lacak Laporan
          </Link>
          <Link
            to="/login-petugas"
            className={`font-label-md text-label-md transition-colors ${scrolled ? "text-[#475569] hover:text-[#1e40af]" : "text-white/80 hover:text-white"}`}
          >
            Petugas
          </Link>
          <Link
            to="/masuk"
            className={`font-label-md text-label-md font-semibold px-5 py-2 rounded-lg transition-all ${
              scrolled
                ? "bg-[#1e40af] text-white hover:bg-[#2e68d8]"
                : "bg-white text-[#1e40af] hover:bg-white/90"
            }`}
          >
            Masuk
          </Link>
        </div>
        <Link
          to="/masuk"
          className={`md:hidden font-label-md text-label-md font-semibold px-4 py-2 rounded-lg transition-all ${
            scrolled
              ? "bg-[#1e40af] text-white"
              : "bg-white text-[#1e40af]"
          }`}
        >
          Masuk
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src="/background%20video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af]/85 via-[#1e40af]/75 to-[#0f2b6d]/95" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <Icon name="verified" className="!text-[14px] text-white/80" />
            <span className="font-label-sm text-label-sm text-white/80">Portal Resmi Kabupaten Sidoarjo</span>
          </div>
          <h1 className="hero-title font-headline-lg text-headline-lg md:text-[56px] md:leading-[64px] font-extrabold text-white tracking-tight">
            Deteksi Cepat,<br />Penanganan Tepat
          </h1>
          <p className="hero-sub mt-5 font-body-lg text-body-lg md:text-[18px] text-white/70 max-w-xl mx-auto leading-relaxed">
            Bersama-sama meningkatkan kualitas infrastruktur jalan di Sidoarjo.
            Laporkan kerusakan jalan di sekitar Anda untuk respon yang lebih sigap.
          </p>
          <div className="hero-buttons mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/masuk"
              className="inline-flex items-center gap-2 bg-white text-[#1e40af] font-label-md text-label-md font-semibold px-7 py-3.5 rounded-xl hover:shadow-xl hover:shadow-black/20 active:scale-[0.97] transition-all"
            >
              <Icon name="add_circle" className="!text-[20px]" />
              Laporkan Kerusakan
            </Link>
            <Link
              to="/lacak"
              className="inline-flex items-center gap-2 border-2 border-white/30 text-white font-label-md text-label-md font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 hover:border-white/50 active:scale-[0.97] transition-all"
            >
              <Icon name="search" className="!text-[20px]" />
              Lacak Laporan
            </Link>
          </div>
        </div>

        <div className="hero-scroll absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
          <span className="font-label-sm text-label-sm">Scroll</span>
          <div className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} className="py-16 md:py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { value: "4", label: "Kecamatan", icon: "location_city" },
            { value: "500+", label: "Laporan", icon: "description" },
            { value: "300+", label: "Selesai", icon: "check_circle" },
            { value: "95%", label: "Kepuasan", icon: "trending_up" },
          ].map((s) => (
            <div key={s.label} className="stat-card bg-[#f8fafc] rounded-xl p-5 md:p-6 text-center border border-[#e2e8f0] hover:border-[#1e40af]/20 hover:shadow-md transition-all">
              <Icon name={s.icon} className="!text-[28px] text-[#1e40af] mb-3" />
              <p className="font-headline-lg text-headline-lg font-extrabold text-[#0F172A]">{s.value}</p>
              <p className="font-label-sm text-label-sm text-[#475569] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CARA MELAPOR ── */}
      <section ref={stepsRef} className="py-16 md:py-24 px-6 bg-[#f8fafc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Cara Melapor
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-lg mx-auto">
              Tiga langkah mudah untuk berkontribusi dalam perbaikan jalan di Sidoarjo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-0.5 bg-gradient-to-r from-[#1e40af]/20 via-[#1e40af]/40 to-[#1e40af]/20" />
            {steps.map((s, i) => (
              <div key={s.title} className="step-card bg-white rounded-xl p-6 md:p-8 text-center border border-[#e2e8f0] relative">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#2e68d8] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#1e40af]/20">
                  <span className="font-headline-md text-headline-md font-bold text-white">{i + 1}</span>
                </div>
                <Icon name={s.icon} className="!text-[32px] text-[#2e68d8] mb-3" />
                <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-2">{s.title}</h3>
                <p className="font-body-sm text-body-sm text-[#475569]">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/masuk"
              className="inline-flex items-center gap-2 font-label-md text-label-md font-semibold text-[#1e40af] hover:text-[#2e68d8] transition-colors"
            >
              Mulai Laporkan Sekarang
              <Icon name="arrow_forward" className="!text-[18px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── KLASIFIKASI KERUSAKAN ── */}
      <section ref={damageRef} className="py-16 md:py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Klasifikasi Kerusakan
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-lg mx-auto">
              Pahami jenis-jenis kerusakan jalan untuk memberikan laporan yang lebih akurat.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {damageTypes.map((d) => (
              <div key={d.title} className="damage-card flex gap-5 bg-[#f8fafc] rounded-xl p-6 border border-[#e2e8f0] hover:border-[#1e40af]/20 hover:shadow-md transition-all">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#2e68d8] flex items-center justify-center shrink-0 shadow-md">
                  <Icon name={d.icon} className="!text-[26px] text-white" />
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-1.5">{d.title}</h3>
                  <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/lacak"
              className="inline-flex items-center gap-2 font-label-md text-label-md font-semibold text-[#1e40af] hover:text-[#2e68d8] transition-colors"
            >
              <Icon name="description" className="!text-[18px]" />
              Panduan Lengkap
              <Icon name="arrow_forward" className="!text-[18px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section ref={ctaRef} className="py-16 md:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="cta-content bg-gradient-to-br from-[#1e40af] to-[#0f2b6d] rounded-2xl p-10 md:p-14 text-center shadow-2xl shadow-[#1e40af]/25">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-white">
              Mari Wujudkan Sidoarjo Tanpa Lubang
            </h2>
            <p className="mt-4 font-body-lg text-body-lg md:text-[18px] text-white/70 max-w-lg mx-auto">
              Kontribusi Anda sangat berharga bagi keselamatan jutaan pengendara. Laporkan sekarang demi kenyamanan bersama.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/masuk"
                className="inline-flex items-center gap-2 bg-white text-[#1e40af] font-label-md text-label-md font-semibold px-7 py-3.5 rounded-xl hover:shadow-xl active:scale-[0.97] transition-all"
              >
                <Icon name="add_circle" className="!text-[20px]" />
                Mulai Lapor Sekarang
              </Link>
              <Link
                to="/lacak"
                className="inline-flex items-center gap-2 border-2 border-white/30 text-white font-label-md text-label-md font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 hover:border-white/50 active:scale-[0.97] transition-all"
              >
                <Icon name="phone" className="!text-[20px]" />
                Hubungi Call Center
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0f172a] text-white/60 px-6 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo.png" alt="DeltaJalan" className="w-8 h-8 brightness-0 invert" />
                <span className="font-headline-md text-headline-md font-bold text-white">DeltaJalan</span>
              </div>
              <p className="font-body-sm text-body-sm leading-relaxed max-w-sm">
                Sistem informasi pelaporan terpadu untuk monitoring dan penanganan kerusakan jalan di wilayah Kabupaten Sidoarjo.
              </p>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-4">Layanan</h4>
              <ul className="space-y-3">
                <li><Link to="/masuk" className="font-body-sm text-body-sm hover:text-white transition-colors">Pelaporan</Link></li>
                <li><Link to="/lacak" className="font-body-sm text-body-sm hover:text-white transition-colors">Cek Status</Link></li>
                <li><Link to="/warga/peta" className="font-body-sm text-body-sm hover:text-white transition-colors">Peta Jalan</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-4">Dukungan</h4>
              <ul className="space-y-3">
                <li><Link to="/lacak" className="font-body-sm text-body-sm hover:text-white transition-colors">Pusat Bantuan</Link></li>
                <li><span className="font-body-sm text-body-sm cursor-default">Syarat & Ketentuan</span></li>
                <li><span className="font-body-sm text-body-sm cursor-default">Kebijakan Privasi</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body-sm text-body-sm">
              &copy; 2024 DeltaJalan — Dinas PU Bina Marga & SDA Kab. Sidoarjo. Hak Cipta Dilindungi.
            </p>
            <div className="flex items-center gap-4">
              <span className="font-body-sm text-body-sm flex items-center gap-1">
                <Icon name="public" className="!text-[14px]" />
                Kab. Sidoarjo
              </span>
              <span className="font-body-sm text-body-sm flex items-center gap-1">
                <Icon name="alternate_email" className="!text-[14px]" />
                pu@binamarga.sidoarjokab.go.id
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
