import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
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

interface StatsData {
  total_reports: number;
  completed_reports: number;
  in_progress: number;
  kecamatan_count: number;
  kecamatan: string[];
  recent_reports: {
    report_code: string;
    road_name: string;
    district: string;
    status: string;
    description: string;
    updated_at: string;
  }[];
}

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

const aboutFeatures = [
  {
    icon: "speed",
    title: "Respon Cepat",
    desc: "Laporan langsung diteruskan ke tim satgas yang membawahi wilayah terkait.",
  },
  {
    icon: "visibility",
    title: "Transparan",
    desc: "Pantau status penanganan laporan secara real-time dari awal hingga selesai.",
  },
  {
    icon: "precision",
    title: "Berbasis AI",
    desc: "Deteksi dan klasifikasi jenis kerusakan jalan secara otomatis menggunakan kecerdasan buatan.",
  },
  {
    icon: "map",
    title: "Terintegrasi GIS",
    desc: "Setiap laporan dilengkapi koordinat GPS dan ditampilkan pada peta interaktif.",
  },
];

const faqData = [
  {
    q: "Bagaimana cara melaporkan kerusakan jalan?",
    a: "Cukup ambil foto kerusakan, isi form lokasi dan deskripsi melalui website atau aplikasi DeltaJalan. Anda bisa melapor tanpa perlu login terlebih dahulu.",
  },
  {
    q: "Apakah laporan saya akan ditindaklanjuti?",
    a: "Ya. Setiap laporan yang masuk akan diverifikasi oleh petugas dan diteruskan ke Unit Pelaksana (UPR) terkait untuk penanganan lebih lanjut.",
  },
  {
    q: "Berapa lama proses penanganan kerusakan?",
    a: "Waktu penanganan bervariasi tergantung tingkat kerusakan dan ketersediaan sumber daya. Anda dapat memantau perkembangan laporan melalui fitur Lacak Laporan.",
  },
  {
    q: "Apakah saya harus login untuk melapor?",
    a: "Anda dapat melapor tanpa login sebagai warga. Cukup masukkan nomor telepon dan nama Anda. Namun dengan login, Anda dapat memantau riwayat laporan dengan lebih mudah.",
  },
  {
    q: "Wilayah mana saja yang bisa dilaporkan?",
    a: "Saat ini DeltaJalan melayani seluruh wilayah Kabupaten Sidoarjo yang terdiri dari 18 kecamatan.",
  },
  {
    q: "Bagaimana jika lokasi kerusakan di luar Sidoarjo?",
    a: "Sistem kami hanya memproses laporan di wilayah Kabupaten Sidoarjo. Untuk lokasi di luar wilayah, silakan hubungi dinas PU setempat.",
  },
];

function CounterCell({ target, suffix, label, icon }: { target: number; suffix: string; label: string; icon: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 2,
      ease: "power3.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = Math.round(obj.v).toLocaleString() + suffix;
      },
    });
  }, [target, suffix]);

  return (
    <div className="stat-card bg-[#f8fafc] rounded-xl p-5 md:p-6 text-center border border-[#e2e8f0] hover:border-[#1e40af]/20 hover:shadow-md transition-all">
      <Icon name={icon} className="!text-[28px] text-[#1e40af] mb-3" />
      <p ref={ref} className="font-headline-lg text-headline-lg font-extrabold text-[#0F172A]">
        0
      </p>
      <p className="font-label-sm text-label-sm text-[#475569] mt-1">{label}</p>
    </div>
  );
}

function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const tentangRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const damageRef = useRef<HTMLDivElement>(null);
  const wilayahRef = useRef<HTMLDivElement>(null);
  const testimoniRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const [testiIndex, setTestiIndex] = useState(0);

  const { data: statsRes } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => apiFetch("/api/public/stats").then<{ success: boolean; data: StatsData }>((r) => r.json()),
    refetchInterval: 120_000,
  });

  const stats = statsRes?.data;

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

      gsap.from(".tentang-card", {
        scrollTrigger: { trigger: tentangRef.current, start: "top 80%", toggleActions: "play none none none" },
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

      gsap.from(".wilayah-item", {
        scrollTrigger: { trigger: wilayahRef.current, start: "top 85%", toggleActions: "play none none none" },
        scale: 0, opacity: 0, stagger: 0.04, duration: 0.4, ease: "back.out(2)",
      });

      gsap.from(".testi-card", {
        scrollTrigger: { trigger: testimoniRef.current, start: "top 80%", toggleActions: "play none none none" },
        y: 40, opacity: 0, duration: 0.8, ease: "power3.out",
      });

      gsap.from(".faq-item", {
        scrollTrigger: { trigger: faqRef.current, start: "top 85%", toggleActions: "play none none none" },
        y: 30, opacity: 0, stagger: 0.1, duration: 0.6, ease: "power3.out",
      });

      gsap.from(".cta-content", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 85%", toggleActions: "play none none none" },
        y: 40, opacity: 0, duration: 0.8, ease: "power3.out",
      });
    });

    return () => ctx.revert();
  }, []);

  const testimonials = stats?.recent_reports ?? [];
  const activeTesti = testimonials[testiIndex] ?? null;

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
              to="/lapor"
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
          <CounterCell target={stats?.kecamatan_count ?? 18} suffix="" label="Kecamatan" icon="location_city" />
          <CounterCell target={stats?.total_reports ?? 0} suffix="+" label="Laporan" icon="description" />
          <CounterCell target={stats?.completed_reports ?? 0} suffix="+" label="Selesai" icon="check_circle" />
          <CounterCell target={stats?.in_progress ?? 0} suffix="+" label="Proses Aktif" icon="engineering" />
        </div>
      </section>

      {/* ── TENTANG DELTAJALAN ── */}
      <section ref={tentangRef} className="py-16 md:py-24 px-6 bg-[#f8fafc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Tentang DeltaJalan
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-2xl mx-auto">
              DeltaJalan adalah sistem informasi pelaporan dan monitoring kerusakan jalan terpadu
              milik Dinas PU Bina Marga dan SDA Kabupaten Sidoarjo. Diciptakan untuk mempercepat
              deteksi dan penanganan kerusakan jalan di seluruh wilayah Sidoarjo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aboutFeatures.map((f) => (
              <div key={f.title} className="tentang-card bg-white rounded-xl p-6 text-center border border-[#e2e8f0] hover:border-[#1e40af]/20 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#2e68d8] flex items-center justify-center mx-auto mb-4">
                  <Icon name={f.icon} className="!text-[22px] text-white" />
                </div>
                <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-2">{f.title}</h3>
                <p className="font-body-sm text-body-sm text-[#475569]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARA MELAPOR ── */}
      <section ref={stepsRef} className="py-16 md:py-24 px-6 bg-white">
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
              <div key={s.title} className="step-card bg-[#f8fafc] rounded-xl p-6 md:p-8 text-center border border-[#e2e8f0] relative">
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
              to="/lapor"
              className="inline-flex items-center gap-2 font-label-md text-label-md font-semibold text-[#1e40af] hover:text-[#2e68d8] transition-colors"
            >
              Mulai Laporkan Sekarang
              <Icon name="arrow_forward" className="!text-[18px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── KLASIFIKASI KERUSAKAN ── */}
      <section ref={damageRef} className="py-16 md:py-24 px-6 bg-[#f8fafc]">
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
              <div key={d.title} className="damage-card flex gap-5 bg-white rounded-xl p-6 border border-[#e2e8f0] hover:border-[#1e40af]/20 hover:shadow-md transition-all">
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

      {/* ── CAKUPAN WILAYAH ── */}
      <section ref={wilayahRef} className="py-16 md:py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Cakupan Wilayah
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-lg mx-auto">
              DeltaJalan melayani seluruh wilayah Kabupaten Sidoarjo yang terdiri dari 18 kecamatan.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {(stats?.kecamatan ?? []).map((k) => (
              <div key={k} className="wilayah-item bg-[#f8fafc] rounded-lg px-3 py-2.5 text-center border border-[#e2e8f0] hover:border-[#1e40af]/30 hover:bg-[#1e40af]/5 transition-all">
                <span className="font-label-sm text-label-sm text-[#0F172A] font-medium">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONI / LAPORAN TERAKHIR ── */}
      <section ref={testimoniRef} className="py-16 md:py-24 px-6 bg-[#f8fafc]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Laporan Terakhir
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-lg mx-auto">
              Beberapa laporan yang telah berhasil ditangani oleh tim kami.
            </p>
          </div>

          <div className="testi-card max-w-2xl mx-auto">
            {activeTesti ? (
              <div className="bg-white rounded-2xl p-8 border border-[#e2e8f0] shadow-sm">
                <div className="flex items-center gap-2 text-[#10b981] mb-4">
                  <Icon name="check_circle" className="!text-[18px]" />
                  <span className="font-label-sm text-label-sm font-medium">{activeTesti.status}</span>
                </div>
                <p className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-2">
                  {activeTesti.road_name}
                </p>
                <p className="font-body-sm text-body-sm text-[#475569] mb-4 line-clamp-3">
                  {activeTesti.description || "Tidak ada deskripsi."}
                </p>
                <div className="flex items-center justify-between text-[#94a3b8] font-body-sm text-body-sm">
                  <span className="flex items-center gap-1">
                    <Icon name="location_on" className="!text-[14px]" />
                    {activeTesti.district}
                  </span>
                  <span>{activeTesti.report_code}</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-[#e2e8f0] shadow-sm text-center">
                <Icon name="sentiment_satisfied" className="!text-[40px] text-[#94a3b8] mx-auto mb-3" />
                <p className="font-body-md text-body-md text-[#475569]">Belum ada laporan yang selesai ditangani.</p>
              </div>
            )}

            {testimonials.length > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setTestiIndex((p) => (p === 0 ? testimonials.length - 1 : p - 1))}
                  className="w-10 h-10 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center hover:bg-[#f8fafc] hover:border-[#1e40af]/30 transition-all active:scale-95"
                >
                  <Icon name="chevron_left" className="!text-[18px] text-[#475569]" />
                </button>
                <span className="font-body-sm text-body-sm text-[#94a3b8]">
                  {testiIndex + 1} / {testimonials.length}
                </span>
                <button
                  type="button"
                  onClick={() => setTestiIndex((p) => (p === testimonials.length - 1 ? 0 : p + 1))}
                  className="w-10 h-10 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center hover:bg-[#f8fafc] hover:border-[#1e40af]/30 transition-all active:scale-95"
                >
                  <Icon name="chevron_right" className="!text-[18px] text-[#475569]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section ref={faqRef} className="py-16 md:py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A]">
              Pertanyaan Umum
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#475569] max-w-lg mx-auto">
              Temukan jawaban atas pertanyaan yang sering diajukan tentang DeltaJalan.
            </p>
          </div>

          <div className="space-y-3">
            {faqData.map((item) => (
              <details key={item.q} className="faq-item group bg-[#f8fafc] rounded-xl border border-[#e2e8f0] open:border-[#1e40af]/20 open:shadow-sm transition-all">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer font-label-md text-label-md font-medium text-[#0F172A] list-none">
                  {item.q}
                  <Icon name="expand_more" className="!text-[20px] text-[#94a3b8] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4">
                  <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
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
                to="/lapor"
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
              <div className="flex items-center gap-4 mt-4">
                <span className="font-body-sm text-body-sm flex items-center gap-1.5">
                  <Icon name="location_on" className="!text-[14px]" />
                  Jl. Gubernur Suryo, Sidoarjo
                </span>
                <span className="font-body-sm text-body-sm flex items-center gap-1.5">
                  <Icon name="alternate_email" className="!text-[14px]" />
                  pu@binamarga.sidoarjokab.go.id
                </span>
              </div>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-4">Layanan</h4>
              <ul className="space-y-3">
                <li><Link to="/lapor" className="font-body-sm text-body-sm hover:text-white transition-colors">Pelaporan</Link></li>
                <li><Link to="/lacak" className="font-body-sm text-body-sm hover:text-white transition-colors">Cek Status</Link></li>
                <li><Link to="/warga/peta" className="font-body-sm text-body-sm hover:text-white transition-colors">Peta Jalan</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-4">Kontak & Bantuan</h4>
              <ul className="space-y-3">
                <li><Link to="/lacak" className="font-body-sm text-body-sm hover:text-white transition-colors">Pusat Bantuan</Link></li>
                <li><span className="font-body-sm text-body-sm cursor-default flex items-center gap-1.5">
                  <Icon name="phone" className="!text-[14px]" />
                  031-8961100
                </span></li>
                <li><span className="font-body-sm text-body-sm cursor-default">Syarat & Ketentuan</span></li>
                <li><span className="font-body-sm text-body-sm cursor-default">Kebijakan Privasi</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body-sm text-body-sm">
              &copy; 2024 DeltaJalan — Dinas PU Bina Marga & SDA Kab. Sidoarjo. Hak Cipta Dilindungi.
            </p>
            <span className="font-body-sm text-body-sm flex items-center gap-1">
              <Icon name="public" className="!text-[14px]" />
              Kab. Sidoarjo
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
