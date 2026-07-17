import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCurrentUser, isLoggedIn } from "@/lib/auth";
import gsap from "gsap";
import Counter from "@/components/ui/Counter";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import SplitText from "@/components/reactbits/SplitText";
import DecryptedText from "@/components/reactbits/DecryptedText";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import BlurText from "@/components/reactbits/BlurText";
import GradientText from "@/components/reactbits/GradientText";
import Particles from "@/components/reactbits/Particles";
import Marquee from "@/components/reactbits/Marquee";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "DeltaJalan \u2014 Deteksi Cepat, Penanganan Tepat" },
      {
        name: "description",
        content: "Sistem pelaporan kerusakan jalan Kabupaten Sidoarjo \u2014 Dinas PU Bina Marga.",
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
    color: "from-[#1e40af] to-[#3b82f6]",
    bg: "#eff6ff",
    badge: "#dbeafe",
    badgeText: "#1e40af",
  },
  {
    icon: "grid_on",
    title: "Retak Kulit Buaya",
    desc: "Serangkaian retak saling terhubung membentuk pola poligonal menyerupai kulit buaya akibat kelelahan beban.",
    color: "from-[#4338ca] to-[#6366f1]",
    bg: "#eef2ff",
    badge: "#e0e7ff",
    badgeText: "#3730a3",
  },
  {
    icon: "view_column",
    title: "Retak Memanjang",
    desc: "Retakan yang sejajar dengan sumbu tengah jalan, biasanya disebabkan oleh sambungan konstruksi yang kurang sempurna.",
    color: "from-[#0d9488] to-[#14b8a6]",
    bg: "#f0fdfa",
    badge: "#ccfbf1",
    badgeText: "#0d9488",
  },
  {
    icon: "view_stream",
    title: "Retak Melintang",
    desc: "Retakan yang melintasi lebar jalan secara tegak lurus, sering terjadi karena perubahan suhu ekstrim.",
    color: "from-[#b45309] to-[#f59e0b]",
    bg: "#fffbeb",
    badge: "#fef3c7",
    badgeText: "#92400e",
  },
];

const steps = [
  {
    icon: "photo_camera",
    title: "Ambil Foto",
    desc: "Potret kondisi jalan yang rusak secara jelas untuk mempermudah identifikasi dan klasifikasi oleh AI.",
    number: "01",
    accent: "#1e40af",
  },
  {
    icon: "description",
    title: "Isi Laporan",
    desc: "Lengkapi data lokasi GPS otomatis dan deskripsi singkat. AI kami akan mendeteksi jenis kerusakan secara otomatis.",
    number: "02",
    accent: "#4338ca",
  },
  {
    icon: "track_changes",
    title: "Pantau Status",
    desc: "Ikuti perkembangan perbaikan laporan Anda secara real-time dari penugasan hingga selesai.",
    number: "03",
    accent: "#6366f1",
  },
];

const aboutFeatures = [
  {
    icon: "speed",
    title: "Respon Cepat",
    desc: "Laporan langsung diteruskan ke tim satgas yang membawahi wilayah terkait.",
    span: "col-span-1",
    big: false,
  },
  {
    icon: "smart_toy",
    title: "Berbasis AI",
    desc: "Deteksi dan klasifikasi jenis kerusakan jalan secara otomatis menggunakan model YOLOv8 yang dilatih khusus untuk 4 kelas kerusakan jalan.",
    span: "col-span-1 md:col-span-2",
    big: true,
  },
  {
    icon: "visibility",
    title: "Transparan",
    desc: "Pantau status penanganan laporan secara real-time dari awal hingga selesai.",
    span: "col-span-1",
    big: false,
  },
  {
    icon: "map",
    title: "Terintegrasi GIS",
    desc: "Setiap laporan dilengkapi koordinat GPS dan ditampilkan pada peta interaktif Kabupaten Sidoarjo.",
    span: "col-span-1 md:col-span-2",
    big: true,
  },
  {
    icon: "group",
    title: "Multi-Role",
    desc: "Tiga level akses: petugas, supervisor, dan eksekutor untuk pengelolaan laporan yang terstruktur.",
    span: "col-span-1",
    big: false,
  },
];

const faqData = [
  {
    q: "Bagaimana cara melaporkan kerusakan jalan?",
    a: "Cukup ambil foto kerusakan, isi form lokasi dan deskripsi melalui website atau aplikasi DeltaJalan. Anda bisa melapor tanpa perlu login terlebih dahulu.",
  },
  {
    q: "Apakah laporan saya akan ditindaklanjuti?",
    a: "Ya. Setiap laporan yang masuk akan diverifikasi oleh petugas dan diteruskan ke Tim Satgas terkait untuk penanganan lebih lanjut.",
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

// â”€â”€ FAQ Accordion Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      const height = el.scrollHeight;
      gsap.fromTo(el, { height: 0, opacity: 0 }, { height, opacity: 1, duration: 0.35, ease: "power2.out" });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.25, ease: "power2.in" });
    }
  }, [open]);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        open ? "border-[#6366f1]/30 shadow-sm bg-white" : "border-[#e0e7ff] bg-[#f8f9ff]"
      }`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`font-label-md text-label-md font-semibold transition-colors ${open ? "text-[#1e40af]" : "text-[#0F172A]"}`}>
          {q}
        </span>
        <span
          className={`ml-4 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            open ? "bg-[#1e40af] text-white rotate-180" : "bg-[#e0e7ff] text-[#3730a3]"
          }`}
        >
          <Icon name="expand_more" className="!text-[18px]" />
        </span>
      </button>
      <div ref={bodyRef} style={{ height: 0, overflow: "hidden", opacity: 0 }}>
        <p className="px-6 pb-5 font-body-sm text-body-sm text-[#3730a3] leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// â”€â”€ Stat Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatCard({
  target,
  suffix,
  label,
  icon,
}: {
  target: number;
  suffix: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl px-6 py-5 text-center shadow-lg shadow-[#1e40af]/8 border border-[#e0e7ff] landing-hover-lift flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] flex items-center justify-center mb-1">
        <Icon name={icon} className="!text-[20px] text-[#1e40af]" />
      </div>
      <div className="font-headline-lg text-headline-lg font-extrabold text-[#0F172A] flex items-baseline gap-0.5">
        <Counter value={target} fontSize={32} textColor="#0F172A" fontWeight={800} />
        <span className="text-[28px] font-extrabold text-[#0F172A]">{suffix}</span>
      </div>
      <p className="font-label-sm text-label-sm text-[#6366f1] font-medium">{label}</p>
    </div>
  );
}

// â”€â”€ Main Landing Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [testiIndex, setTestiIndex] = useState(0);
  const [activeFaqIdx] = useState<number | null>(null);

  const { data: statsRes } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () =>
      apiFetch("/api/public/stats").then<{ success: boolean; data: StatsData }>((r) => r.json()),
    refetchInterval: 120_000,
  });

  const stats = statsRes?.data;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero buttons
      gsap.from(".hero-buttons", { y: 24, opacity: 0, duration: 0.7, ease: "power3.out", delay: 0.7 });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Auto-cycle testimonials
  useEffect(() => {
    const len = stats?.recent_reports?.length ?? 0;
    if (len <= 1) return;
    const t = setInterval(() => setTestiIndex((p) => (p + 1) % len), 4000);
    return () => clearInterval(t);
  }, [stats?.recent_reports?.length]);

  const testimonials = stats?.recent_reports ?? [];
  const activeTesti = testimonials[testiIndex] ?? null;
  const user = getCurrentUser();
  const loggedIn = isLoggedIn();

  function dashboardUrl(role: string) {
    if (role === "warga") return "/warga";
    if (role === "supervisor") return "/supervisor";
    if (role === "admin") return "/admin/dashboard";
    return "/home";
  }

  const kecamatanList = stats?.kecamatan ?? [
    "Sidoarjo", "Candi", "Porong", "Jabon", "Krembung",
    "Tulangan", "Tanggulangin", "Gedangan", "Sedati", "Waru",
    "Taman", "Sukodono", "Krian", "Balongbendo", "Tarik",
    "Prambon", "Wonoayu", "Buduran",
  ];

  // unused variable suppression
  void activeFaqIdx;

  return (
    <div className="w-full overflow-x-hidden bg-[#f8f9ff]">

      {/* â”€â”€ NAVBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-400 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl shadow-sm shadow-[#1e40af]/8 border-b border-[#e0e7ff]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DeltaJalan" className="w-8 h-8" />
          <span
            className={`font-headline-md text-headline-md font-bold tracking-tight transition-colors ${scrolled ? "text-[#0F172A]" : "text-white"}`}
          >
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
          {loggedIn ? (
            <Link
              to={dashboardUrl(user!.role)}
              className={`font-label-md text-label-md transition-colors ${scrolled ? "text-[#475569] hover:text-[#1e40af]" : "text-white/80 hover:text-white"}`}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login-petugas"
              className={`font-label-md text-label-md transition-colors ${scrolled ? "text-[#475569] hover:text-[#1e40af]" : "text-white/80 hover:text-white"}`}
            >
              Petugas
            </Link>
          )}
          {loggedIn ? (
            <Link
              to={dashboardUrl(user!.role)}
              className={`flex items-center gap-2 font-label-md text-label-md font-semibold px-4 py-2 rounded-xl transition-all ${
                scrolled
                  ? "bg-[#1e40af] text-white hover:bg-[#1730a0]"
                  : "bg-white text-[#1e40af] hover:bg-white/90"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-[#e0e7ff] flex items-center justify-center text-[11px] font-bold text-[#1e40af]">
                {user!.initials || user!.name?.charAt(0) || "U"}
              </span>
              {user!.name}
            </Link>
          ) : (
            <Link
              to="/masuk"
              className={`font-label-md text-label-md font-semibold px-5 py-2.5 rounded-xl transition-all ${
                scrolled
                  ? "bg-[#1e40af] text-white hover:bg-[#1730a0] shadow-md shadow-[#1e40af]/20"
                  : "bg-white text-[#1e40af] hover:bg-white/90"
              }`}
            >
              Masuk
            </Link>
          )}
        </div>

        {/* Mobile */}
        {loggedIn ? (
          <Link
            to={dashboardUrl(user!.role)}
            className={`md:hidden w-9 h-9 rounded-full flex items-center justify-center font-label-md text-label-md font-bold transition-all ${
              scrolled ? "bg-[#1e40af] text-white" : "bg-white text-[#1e40af]"
            }`}
          >
            {user!.initials || user!.name?.charAt(0) || "U"}
          </Link>
        ) : (
          <Link
            to="/masuk"
            className={`md:hidden font-label-md text-label-md font-semibold px-4 py-2 rounded-xl transition-all ${
              scrolled ? "bg-[#1e40af] text-white" : "bg-white text-[#1e40af]"
            }`}
          >
            Masuk
          </Link>
        )}
      </nav>

      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        ref={heroRef}
        className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden pt-16"
      >
        {/* Video BG */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/background.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/background%20video.mp4" type="video/mp4" />
          </video>
          {/* Layered gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/88 via-[#1e40af]/70 to-[#0f2b6d]/95" />
          {/* Mesh dots pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Particles */}
        <Particles count={55} color="200,210,255" maxSize={1.8} speed={0.25} />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          {/* Headline */}
          <div className="mb-6 space-y-0">
            <SplitText
              text="Deteksi Cepat,"
              tag="h1"
              splitType="words"
              className="font-headline-lg text-headline-lg md:text-[58px] md:leading-[68px] font-extrabold text-white tracking-tight block !text-white"
              from={{ opacity: 0, y: 50, rotateX: -20 }}
              to={{ opacity: 1, y: 0, rotateX: 0 }}
              duration={1.1}
              delay={50}
              ease="power4.out"
              threshold={1}
            />
            <SplitText
              text="Penanganan Tepat"
              tag="h1"
              splitType="words"
              className="font-headline-lg text-headline-lg md:text-[58px] md:leading-[68px] font-extrabold text-white tracking-tight block !text-white"
              from={{ opacity: 0, y: 50, rotateX: -20 }}
              to={{ opacity: 1, y: 0, rotateX: 0 }}
              duration={1.1}
              delay={70}
              ease="power4.out"
              threshold={1}
            />
          </div>

          {/* Subtitle */}
          <div className="mb-10 max-w-2xl mx-auto">
            <DecryptedText
              text="Bersama meningkatkan kualitas infrastruktur jalan di Sidoarjo. Laporkan kerusakan jalan di sekitar Anda dan pantau penanganannya secara real-time."
              animateOn="view"
              speed={25}
              maxIterations={8}
              sequential={true}
              revealDirection="start"
              className="text-white/80 font-body-lg text-body-lg md:text-[18px] leading-relaxed"
              encryptedClassName="text-white/25 font-body-lg text-body-lg md:text-[18px]"
            />
          </div>

          {/* CTA Buttons */}
          <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={loggedIn ? "/warga/lapor" : "/lapor"}
              className="group relative inline-flex items-center gap-2.5 bg-white text-[#1e40af] font-label-md text-label-md font-bold px-8 py-4 rounded-2xl hover:shadow-2xl hover:shadow-white/20 active:scale-[0.97] transition-all overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-[#dbeafe] to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Icon name="add_circle" className="relative !text-[20px]" />
              <span className="relative">Laporkan Kerusakan</span>
            </Link>
            <Link
              to="/lacak"
              className="inline-flex items-center gap-2.5 border-2 border-white/30 text-white font-label-md text-label-md font-semibold px-8 py-4 rounded-2xl hover:bg-white/10 hover:border-white/60 active:scale-[0.97] transition-all backdrop-blur-sm"
            >
              <Icon name="search" className="!text-[20px]" />
              Lacak Laporan
            </Link>
          </div>

          {/* Trust signal */}
          <div className="mt-12 flex items-center justify-center text-white/45">
            <span className="flex items-center gap-1.5 font-label-sm text-label-sm">
              <Icon name="location_city" className="!text-[14px]" />
              18 Kecamatan Sidoarjo
            </span>
          </div>
        </div>
      </section>

      {/* â”€â”€ STATS â€” floating overlap strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={50} duration={0.9}>
        <section className="relative z-10 -mt-10 px-6 mb-0">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard target={stats?.kecamatan_count ?? 18} suffix="" label="Kecamatan" icon="location_city" />
              <StatCard target={stats?.total_reports ?? 0} suffix="+" label="Total Laporan" icon="description" />
              <StatCard target={stats?.completed_reports ?? 0} suffix="+" label="Selesai Ditangani" icon="check_circle" />
              <StatCard target={stats?.in_progress ?? 0} suffix="+" label="Sedang Dikerjakan" icon="engineering" />
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* â”€â”€ TENTANG â€” Bento Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={60} duration={0.85}>
        <section className="py-20 md:py-28 px-6 bg-[#f8f9ff]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
                <Icon name="info" className="!text-[14px]" />
                Tentang Platform
              </span>
              <BlurText
                text="Sistem Terpadu untuk Jalan Lebih Baik"
                tag="h2"
                className="font-headline-lg text-headline-lg md:text-[38px] md:leading-[46px] font-extrabold text-[#0F172A] mt-2"
              />
              <p className="mt-4 font-body-md text-body-md text-[#64748b] max-w-2xl mx-auto leading-relaxed">
                DeltaJalan adalah sistem informasi pelaporan dan monitoring kerusakan jalan terpadu
                milik <strong className="text-[#1e40af]">Dinas PU Bina Marga dan SDA Kabupaten Sidoarjo</strong>.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Large card â€” AI */}
              <SpotlightCard
                className="md:col-span-2 bento-card p-7 relative overflow-hidden"
                spotlightColor="rgba(99, 102, 241, 0.1)"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#e0e7ff] to-transparent rounded-bl-[80px] opacity-60" />
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#6366f1] flex items-center justify-center mb-5 shadow-lg shadow-[#1e40af]/25">
                  <Icon name="smart_toy" className="!text-[24px] text-white" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-3">Berbasis AI</h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed max-w-sm">
                  Deteksi dan klasifikasi jenis kerusakan jalan secara otomatis menggunakan model
                  YOLOv8 yang dilatih khusus untuk <strong className="text-[#1e40af]">4 kelas kerusakan</strong>: Lubang, Retak Kulit Buaya, Retak Memanjang, dan Retak Melintang.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["YOLOv8", "ONNX Runtime", "WBF Ensemble", "AWS Lambda"].map((t) => (
                    <span key={t} className="bg-[#eef2ff] text-[#3730a3] text-xs font-semibold px-3 py-1 rounded-full border border-[#e0e7ff]">
                      {t}
                    </span>
                  ))}
                </div>
              </SpotlightCard>

              {/* Small cards */}
              <SpotlightCard
                className="bento-card p-7"
                spotlightColor="rgba(30, 64, 175, 0.08)"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center mb-5">
                  <Icon name="speed" className="!text-[24px] text-[#1e40af]" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-2">Respon Cepat</h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed">
                  Laporan langsung diteruskan ke tim satgas yang membawahi wilayah terkait.
                </p>
              </SpotlightCard>

              {/* Large card â€” GIS */}
              <SpotlightCard
                className="md:col-span-2 bento-card p-7 relative overflow-hidden"
                spotlightColor="rgba(99, 102, 241, 0.1)"
              >
                <div className="absolute bottom-0 left-0 w-48 h-24 bg-gradient-to-tr from-[#eef2ff] to-transparent opacity-50" />
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4338ca] to-[#6366f1] flex items-center justify-center mb-5 shadow-lg shadow-[#4338ca]/20">
                  <Icon name="map" className="!text-[24px] text-white" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-3">Terintegrasi GIS</h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed max-w-sm">
                  Setiap laporan dilengkapi <strong className="text-[#3730a3]">koordinat GPS otomatis</strong> dan ditampilkan pada peta interaktif seluruh 18 kecamatan Kabupaten Sidoarjo.
                </p>
              </SpotlightCard>

              {/* Small card â€” Transparan */}
              <SpotlightCard
                className="bento-card p-7"
                spotlightColor="rgba(30, 64, 175, 0.08)"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center mb-5">
                  <Icon name="visibility" className="!text-[24px] text-[#1e40af]" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-2">Transparan</h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed">
                  Pantau status penanganan laporan secara real-time dari penugasan hingga selesai.
                </p>
              </SpotlightCard>
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* â”€â”€ CARA MELAPOR â€” Vertical Timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-20 md:py-28 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimatedContent distance={40} duration={0.7}>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
                <Icon name="route" className="!text-[14px]" />
                Alur Pelaporan
              </span>
              <BlurText
                text="Cara Melapor"
                tag="h2"
                className="font-headline-lg text-headline-lg md:text-[38px] md:leading-[46px] font-extrabold text-[#0F172A] mt-2"
              />
              <p className="mt-4 font-body-md text-body-md text-[#64748b] max-w-lg mx-auto">
                Tiga langkah mudah untuk berkontribusi dalam perbaikan jalan di Sidoarjo.
              </p>
            </div>
          </AnimatedContent>

          {/* Steps */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 relative">
            {/* Desktop connector line */}
            <div className="hidden md:block absolute top-[52px] left-[calc(16.66%+20px)] right-[calc(16.66%+20px)] h-px">
              <div className="w-full h-full bg-gradient-to-r from-[#c7d2fe] via-[#6366f1]/30 to-[#c7d2fe]" />
            </div>

            {steps.map((s, i) => (
              <AnimatedContent key={s.title} distance={40} duration={0.7} delay={i * 0.15}>
                <SpotlightCard
                  className="flex-1 bg-white border border-[#e0e7ff] rounded-2xl p-7 text-center relative landing-hover-lift"
                  spotlightColor="rgba(99, 102, 241, 0.12)"
                >
                  {/* Step number */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative shadow-xl"
                    style={{ background: `linear-gradient(135deg, ${s.accent}ee, ${s.accent})` }}
                  >
                    <span className="font-headline-md text-headline-md font-black text-white">{s.number}</span>
                    {/* Pulse ring */}
                    <span
                      className="absolute inset-0 rounded-2xl opacity-30"
                      style={{
                        border: `2px solid ${s.accent}`,
                        animation: "pulse-ring 2.5s ease-out infinite",
                      }}
                    />
                  </div>
                  <Icon name={s.icon} className="!text-[30px] mb-3" style={{ color: s.accent }} />
                  <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-2">
                    {s.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-[#64748b] leading-relaxed">{s.desc}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>

          <AnimatedContent distance={20} duration={0.5} delay={0.5}>
            <div className="text-center mt-12">
              <Link
                to={loggedIn ? "/warga/lapor" : "/lapor"}
                className="inline-flex items-center gap-2 bg-[#1e40af] text-white font-label-md text-label-md font-semibold px-7 py-3.5 rounded-2xl hover:bg-[#1730a0] shadow-lg shadow-[#1e40af]/25 hover:shadow-xl hover:shadow-[#1e40af]/30 transition-all active:scale-[0.97]"
              >
                <Icon name="add_circle" className="!text-[18px]" />
                Mulai Laporkan Sekarang
              </Link>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* â”€â”€ AI KLASIFIKASI â€” 2-column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-20 md:py-28 px-6 bg-[#f8f9ff]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
            {/* Left: text */}
            <AnimatedContent distance={60} duration={0.8} direction="horizontal" reverse>
              <div>
                <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
                  <Icon name="smart_toy" className="!text-[14px]" />
                  AI Detection
                </span>
                <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2 mb-4">
                  Klasifikasi Kerusakan{" "}
                  <GradientText
                    text="Berbasis AI"
                    className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold"
                    gradient="linear-gradient(135deg, #1e40af 0%, #6366f1 60%, #3b82f6 100%)"
                  />
                </h2>
                <p className="font-body-md text-body-md text-[#64748b] leading-relaxed mb-6">
                  Model YOLOv8 kami mampu mendeteksi dan mengklasifikasikan 4 jenis kerusakan jalan
                  langsung dari foto yang Anda ambil. Tidak perlu keahlian teknis â€” cukup foto dan sistem
                  kami yang bekerja.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { icon: "bolt", text: "Deteksi < 3 detik", color: "#f59e0b" },
                    { icon: "check_circle", text: "Akurasi tinggi dengan WBF Ensemble", color: "#10b981" },
                    { icon: "cloud", text: "Diproses di AWS Lambda", color: "#3b82f6" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <Icon name={item.icon} className="!text-[18px] flex-shrink-0" style={{ color: item.color }} />
                      <span className="font-body-sm text-body-sm text-[#475569]">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedContent>

            {/* Right: cards staggered */}
            <div className="grid grid-cols-1 gap-4">
              {damageTypes.map((d, i) => (
                <AnimatedContent key={d.title} distance={40} duration={0.65} delay={i * 0.12}>
                  <SpotlightCard
                    className="bg-white border border-[#e0e7ff] rounded-2xl p-5 flex gap-4 landing-hover-lift"
                    spotlightColor="rgba(99, 102, 241, 0.1)"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center shrink-0 shadow-md`}
                    >
                      <Icon name={d.icon} className="!text-[22px] text-white" />
                    </div>
                    <div>
                      <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-1">{d.title}</h3>
                      <p className="font-body-sm text-body-sm text-[#64748b] leading-relaxed line-clamp-2">{d.desc}</p>
                    </div>
                  </SpotlightCard>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ CAKUPAN WILAYAH â€” Marquee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-16 md:py-20 bg-white overflow-hidden">
        <AnimatedContent distance={30} duration={0.7}>
          <div className="text-center mb-10 px-6">
            <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
              <Icon name="location_on" className="!text-[14px]" />
              Cakupan Wilayah
            </span>
            <BlurText
              text="18 Kecamatan Kabupaten Sidoarjo"
              tag="h2"
              className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2"
            />
          </div>

          {/* Top marquee */}
          <div className="mb-3">
            <Marquee
              items={kecamatanList.slice(0, 9)}
              speed={25}
              itemClassName="font-label-md text-label-md font-semibold text-[#1e40af] bg-[#eef2ff] border border-[#e0e7ff] rounded-full px-5 py-2.5"
            />
          </div>
          {/* Bottom marquee reversed */}
          <Marquee
            items={kecamatanList.slice(9)}
            speed={20}
            reverse
            itemClassName="font-label-md text-label-md font-semibold text-[#3730a3] bg-[#f5f3ff] border border-[#ede9fe] rounded-full px-5 py-2.5"
          />
        </AnimatedContent>
      </section>

      {/* â”€â”€ LAPORAN TERAKHIR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={60} duration={0.85}>
        <section className="py-20 md:py-28 px-6 bg-[#f8f9ff]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
                <Icon name="history" className="!text-[14px]" />
                Live Activity
              </span>
              <BlurText
                text="Laporan Terakhir"
                tag="h2"
                className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2"
              />
              <p className="mt-3 font-body-md text-body-md text-[#64748b] max-w-lg mx-auto">
                Laporan kerusakan yang telah berhasil ditangani oleh tim satgas kami.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {activeTesti ? (
                <SpotlightCard
                  className="bg-white rounded-2xl p-8 border border-[#e0e7ff] shadow-xl shadow-[#1e40af]/6"
                  spotlightColor="rgba(99, 102, 241, 0.1)"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-2 bg-[#d1fae5] text-[#065f46] rounded-full px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                      <span className="font-label-sm text-label-sm font-semibold">
                        {activeTesti.status}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-[#94a3b8] font-mono">
                      {activeTesti.report_code}
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-2 leading-snug">
                    {activeTesti.road_name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-[#64748b] mb-5 line-clamp-2 leading-relaxed">
                    {activeTesti.description || "Tidak ada deskripsi."}
                  </p>
                  <div className="flex items-center gap-1.5 text-[#6366f1] font-label-sm text-label-sm">
                    <Icon name="location_on" className="!text-[14px]" />
                    {activeTesti.district}
                  </div>
                </SpotlightCard>
              ) : (
                <div className="bg-white rounded-2xl p-10 border border-[#e0e7ff] shadow-sm text-center">
                  <Icon name="sentiment_satisfied" className="!text-[44px] text-[#6366f1] mx-auto mb-3" />
                  <p className="font-body-md text-body-md text-[#64748b]">
                    Belum ada laporan yang selesai ditangani.
                  </p>
                </div>
              )}

              {/* Dots indicator */}
              {testimonials.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTestiIndex(i)}
                      className={`rounded-full transition-all ${
                        i === testiIndex
                          ? "w-6 h-2 bg-[#1e40af]"
                          : "w-2 h-2 bg-[#c7d2fe] hover:bg-[#6366f1]/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={60} duration={0.85}>
        <section className="py-20 md:py-28 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
                <Icon name="help" className="!text-[14px]" />
                FAQ
              </span>
              <BlurText
                text="Pertanyaan Umum"
                tag="h2"
                className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2"
              />
              <p className="mt-3 font-body-md text-body-md text-[#64748b] max-w-lg mx-auto">
                Temukan jawaban atas pertanyaan yang sering diajukan tentang DeltaJalan.
              </p>
            </div>

            <div className="space-y-3">
              {faqData.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={40} duration={0.8}>
        <section className="py-16 md:py-20 px-6 bg-[#f8f9ff]">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3]" />
              {/* Mesh pattern */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #fff 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              {/* Glow accents */}
              <div className="absolute top-[-40px] right-[-40px] w-64 h-64 rounded-full bg-[#6366f1]/20 blur-3xl" />
              <div className="absolute bottom-[-40px] left-[-40px] w-64 h-64 rounded-full bg-[#3b82f6]/20 blur-3xl" />

              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-6">
                  <Icon name="campaign" className="!text-[14px]" />
                  Bergabung Bersama Kami
                </span>
                <h2 className="font-headline-lg text-headline-lg md:text-[40px] md:leading-[48px] font-extrabold text-white mb-4">
                  Mari Wujudkan Sidoarjo{" "}
                  <br className="hidden md:block" />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #93c5fd, #c4b5fd, #93c5fd)",
                      backgroundSize: "200%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      animation: "shimmer 3s linear infinite",
                    }}
                  >
                    Tanpa Lubang
                  </span>
                </h2>
                <p className="font-body-lg text-body-lg md:text-[17px] text-white/70 max-w-lg mx-auto mb-10 leading-relaxed">
                  Kontribusi Anda sangat berharga bagi keselamatan jutaan pengendara.
                  Laporkan sekarang demi kenyamanan bersama.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    to={loggedIn ? "/warga/lapor" : "/lapor"}
                    className="group inline-flex items-center gap-2.5 bg-white text-[#1e40af] font-label-md text-label-md font-bold px-8 py-4 rounded-2xl hover:shadow-2xl hover:shadow-black/20 active:scale-[0.97] transition-all"
                  >
                    <Icon name="add_circle" className="!text-[20px]" />
                    Mulai Lapor Sekarang
                  </Link>
                  <Link
                    to="/lacak"
                    className="inline-flex items-center gap-2.5 border-2 border-white/30 text-white font-label-md text-label-md font-semibold px-8 py-4 rounded-2xl hover:bg-white/10 hover:border-white/60 active:scale-[0.97] transition-all"
                  >
                    <Icon name="search" className="!text-[20px]" />
                    Lacak Laporan
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="bg-[#0a1628] text-white/55 px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-5">
                <img src="/logo.png" alt="DeltaJalan" className="w-8 h-8 brightness-0 invert opacity-90" />
                <span className="font-headline-md text-headline-md font-bold text-white">DeltaJalan</span>
              </div>
              <p className="font-body-sm text-body-sm leading-relaxed max-w-sm mb-5">
                Sistem informasi pelaporan dan monitoring kerusakan jalan terpadu untuk seluruh wilayah
                Kabupaten Sidoarjo.
              </p>
              <div className="flex flex-col gap-2">
                <span className="font-body-sm text-body-sm flex items-center gap-2">
                  <Icon name="location_on" className="!text-[14px] text-[#6366f1]" />
                  Jl. Gubernur Suryo, Sidoarjo
                </span>
                <span className="font-body-sm text-body-sm flex items-center gap-2">
                  <Icon name="alternate_email" className="!text-[14px] text-[#6366f1]" />
                  pu@binamarga.sidoarjokab.go.id
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-5 tracking-wide">Layanan</h4>
              <ul className="space-y-3">
                {[
                  { to: loggedIn ? "/warga/lapor" : "/lapor", label: "Pelaporan" },
                  { to: "/lacak", label: "Lacak Status" },
                  { to: "/warga/peta", label: "Peta Jalan" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="font-body-sm text-body-sm hover:text-white transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-5 tracking-wide">
                Kontak & Bantuan
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/lacak" className="font-body-sm text-body-sm hover:text-white transition-colors">
                    Pusat Bantuan
                  </Link>
                </li>
                <li>
                  <span className="font-body-sm text-body-sm flex items-center gap-1.5">
                    <Icon name="phone" className="!text-[13px] text-[#6366f1]" />
                    031-8961100
                  </span>
                </li>
                <li>
                  <span className="font-body-sm text-body-sm cursor-default">Syarat & Ketentuan</span>
                </li>
                <li>
                  <span className="font-body-sm text-body-sm cursor-default">Kebijakan Privasi</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-body-sm text-body-sm">
              &copy; 2025 DeltaJalan â€” Dinas PU Bina Marga & SDA Kab. Sidoarjo.
            </p>
            <span className="font-body-sm text-body-sm flex items-center gap-1.5">
              <Icon name="public" className="!text-[13px] text-[#6366f1]" />
              Kabupaten Sidoarjo
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

