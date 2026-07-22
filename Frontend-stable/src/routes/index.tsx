import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { useRef, useEffect, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { resolveImageUrl } from "@/lib/imageUrl";
import { getCurrentUser, isLoggedIn } from "@/lib/auth";
import { motion, useMotionValue, useSpring } from "motion/react";
import Counter from "@/components/ui/Counter";

const AnimatedContent = lazy(() => import("@/components/reactbits/AnimatedContent"));
const SpotlightCard = lazy(() => import("@/components/reactbits/SpotlightCard"));
const BlurText = lazy(() => import("@/components/reactbits/BlurText"));
const GradientText = lazy(() => import("@/components/reactbits/GradientText"));
const Marquee = lazy(() => import("@/components/reactbits/Marquee"));
const LandingMapPreview = lazy(() => import("@/components/jk/LandingMapPreview"));

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
    photo_url?: string;
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
        <span
          className={`font-label-md text-label-md font-semibold transition-colors ${open ? "text-[#1e40af]" : "text-[#0F172A]"}`}
        >
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
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 font-body-sm text-body-sm text-[#3730a3] leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Main Landing Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatsTiltCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { damping: 30, stiffness: 100, mass: 2 });
  const ry = useSpring(useMotionValue(0), { damping: 30, stiffness: 100, mass: 2 });
  const sc = useSpring(1, { damping: 30, stiffness: 100, mass: 2 });

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const ox = e.clientX - rect.left - rect.width / 2;
    const oy = e.clientY - rect.top - rect.height / 2;
    rx.set((oy / (rect.height / 2)) * -10);
    ry.set((ox / (rect.width / 2)) * 10);
  }

  function handleEnter() {
    sc.set(1.03);
  }

  function handleLeave() {
    sc.set(1);
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className="bg-white/8 backdrop-blur border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 ease-out hover:bg-white/15 hover:border-white/20 hover:shadow-lg hover:shadow-white/5 [transform-style:preserve-3d]"
      style={{ rotateX: rx, rotateY: ry, scale: sc }}
      onMouseMove={handleMouse}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="px-4 py-5 md:px-6 md:py-6 text-center" style={{ transform: "translateZ(20px)" }}>
        <div className="font-headline-lg text-headline-lg md:text-[36px] font-extrabold text-white flex items-baseline justify-center gap-0.5">
          <Counter value={value} fontSize={32} textColor="white" fontWeight={800} />
          <span className="text-[28px] md:text-[32px] font-extrabold text-white">{suffix}</span>
        </div>
        <p className="font-label-sm text-label-sm text-white/70 font-medium mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

function LandingPage() {
  // ── Capacitor guard: redirect without rendering ──
  if (
    typeof window !== "undefined" &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  ) {
    const user = getCurrentUser();
    if (user) {
      const map: Record<string, string> = {
        admin: "/admin/dashboard",
        supervisor: "/supervisor",
        warga: "/warga",
        petugas: "/home",
      };
      return <Navigate to={map[user.role] ?? "/masuk"} />;
    }
    return <Navigate to="/masuk" />;
  }

  const navRef = useRef<HTMLElement>(null);
  const statsBarRef = useRef<HTMLDivElement>(null);
  const tentangSectionRef = useRef<HTMLDivElement>(null);
  const tentangParallaxRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [testiIndex, setTestiIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState<Record<string, boolean>>({});
  const [activeFaqIdx] = useState<number | null>(null);

  const { data: statsRes } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () =>
      apiFetch("/api/public/stats").then<{ success: boolean; data: StatsData }>((r) => r.json()),
    refetchInterval: 120_000,
  });

  const stats = statsRes?.data;

  const { data: mapOverviewRes } = useQuery({
    queryKey: ["public-map-overview"],
    queryFn: () =>
      apiFetch("/api/public/reports/map-overview").then<{
        success: boolean;
        data: { district_stats: unknown[]; recent_markers: unknown[] };
      }>((r) => r.json()),
    staleTime: 60_000,
  });
  const mapOverviewData = mapOverviewRes?.data;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Parallax "Tentang" — GSAP ScrollTrigger (dynamic import)
  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (!tentangParallaxRef.current || !tentangSectionRef.current) return;
      ctx = gsap.context(() => {
        gsap.to(tentangParallaxRef.current, {
          y: -80,
          ease: "none",
          scrollTrigger: {
            trigger: tentangSectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          },
        });
      });
    })();
    return () => ctx?.revert();
  }, []);

  // Parallax "Stats Bar" — GSAP ScrollTrigger
  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (!statsBarRef.current) return;
      ctx = gsap.context(() => {
        gsap.to(statsBarRef.current, {
          y: -30,
          ease: "none",
          scrollTrigger: {
            trigger: statsBarRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          },
        });
      });
    })();
    return () => ctx?.revert();
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
    "Sidoarjo",
    "Candi",
    "Porong",
    "Jabon",
    "Krembung",
    "Tulangan",
    "Tanggulangin",
    "Gedangan",
    "Sedati",
    "Waru",
    "Taman",
    "Sukodono",
    "Krian",
    "Balongbendo",
    "Tarik",
    "Prambon",
    "Wonoayu",
    "Buduran",
  ];

  // unused variable suppression
  void activeFaqIdx;

  return (
    <Suspense fallback={null}>
      <div className="w-full overflow-x-hidden bg-[#f8f9ff]">
      {/* â”€â”€ NAVBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-400 ${
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
      <section className="relative min-h-[100dvh] flex flex-col overflow-hidden pt-16">
        {/* Static background image + overlays (replaces video for LCP) */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url("/background.jpg")' }}
          />
          {/* Layered gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/88 via-[#1e40af]/70 to-[#0f2b6d]/95" />
          {/* Mesh dots pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center px-6 max-w-4xl mx-auto">
            {/* Headline */}
            <h1 className="font-headline-lg text-headline-lg md:text-[58px] md:leading-[68px] font-extrabold text-white tracking-tight mb-2">
              Deteksi Cepat,
              <br />
              Penanganan Tepat
            </h1>

            {/* Subtitle */}
            <p className="text-white/80 font-body-lg text-body-lg md:text-[18px] leading-relaxed max-w-2xl mx-auto mb-10">
              Bersama meningkatkan kualitas infrastruktur jalan di Sidoarjo. Laporkan kerusakan jalan
              di sekitar Anda dan pantau penanganannya secara real-time.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
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
                className="inline-flex items-center gap-2 border-2 border-white/20 text-white/60 font-label-sm text-label-sm font-medium px-5 py-3 rounded-2xl hover:bg-white/10 hover:border-white/40 hover:text-white/90 active:scale-[0.97] transition-all"
              >
                <Icon name="search" className="!text-[16px]" />
                Lacak Laporan
              </Link>
            </div>

          </div>
        </div>

        {/* Stats bottom bar — 3 cards + parallax */}
        <div ref={statsBarRef} className="relative z-10 pb-6 md:pb-10">
          <div className="max-w-4xl mx-auto px-6">
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              {[
                { value: stats?.total_reports ?? 0, suffix: "+", label: "Total Laporan" },
                { value: stats?.completed_reports ?? 0, suffix: "+", label: "Selesai Ditangani" },
                { value: stats?.kecamatan_count ?? 18, suffix: "", label: "Kecamatan Aktif" },
              ].map((item) => <StatsTiltCard key={item.label} {...item} />)}
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ TENTANG â€” Bento Grid + parallax background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatedContent distance={60} duration={0.85}>
        <section ref={tentangSectionRef} className="py-20 md:py-28 px-6 bg-[#f8f9ff] relative">
          {/* Parallax decorative blob */}
          <div
            ref={tentangParallaxRef}
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-bl from-[#e0e7ff] to-transparent opacity-40 pointer-events-none"
          />
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
                milik{" "}
                <strong className="text-[#1e40af]">
                  Dinas PU Bina Marga dan SDA Kabupaten Sidoarjo
                </strong>
                .
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
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-3">
                  Berbasis AI
                </h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed max-w-sm">
                  Deteksi dan klasifikasi jenis kerusakan jalan secara otomatis menggunakan model
                  YOLOv8 yang dilatih khusus untuk{" "}
                  <strong className="text-[#1e40af]">4 kelas kerusakan</strong>: Lubang, Retak Kulit
                  Buaya, Retak Memanjang, dan Retak Melintang.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["YOLOv8", "ONNX Runtime", "WBF Ensemble", "AWS Lambda"].map((t) => (
                    <span
                      key={t}
                      className="bg-[#eef2ff] text-[#3730a3] text-xs font-semibold px-3 py-1 rounded-full border border-[#e0e7ff]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </SpotlightCard>

              {/* Small cards */}
              <SpotlightCard className="bento-card p-7" spotlightColor="rgba(30, 64, 175, 0.08)">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center mb-5">
                  <Icon name="speed" className="!text-[24px] text-[#1e40af]" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-2">
                  Respon Cepat
                </h3>
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
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-3">
                  Terintegrasi GIS
                </h3>
                <p className="font-body-sm text-body-sm text-[#475569] leading-relaxed max-w-sm">
                  Setiap laporan dilengkapi{" "}
                  <strong className="text-[#3730a3]">koordinat GPS otomatis</strong> dan ditampilkan
                  pada peta interaktif seluruh 18 kecamatan Kabupaten Sidoarjo.
                </p>
              </SpotlightCard>

              {/* Small card â€” Transparan */}
              <SpotlightCard className="bento-card p-7" spotlightColor="rgba(30, 64, 175, 0.08)">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe] flex items-center justify-center mb-5">
                  <Icon name="visibility" className="!text-[24px] text-[#1e40af]" />
                </div>
                <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-2">
                  Transparan
                </h3>
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
                    <span className="font-headline-md text-headline-md font-black text-white">
                      {s.number}
                    </span>
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
                  <p className="font-body-sm text-body-sm text-[#64748b] leading-relaxed">
                    {s.desc}
                  </p>
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

      {/* ── 3 CARA MELAPOR ── */}
      <section className="py-16 md:py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-14">
            <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
              <Icon name="grid_view" className="!text-[14px]" />
              Platform
            </span>
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2">
              3 Cara Melapor
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#64748b] max-w-lg mx-auto">
              Pilih platform yang paling nyaman untuk Anda melaporkan kerusakan jalan.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            {/* Telegram */}
            <div className="bg-white border border-[#e0e7ff] rounded-2xl p-6 md:p-7 text-center hover:shadow-lg hover:shadow-[#1e40af]/5 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="send" className="!text-[26px] text-[#1e40af]" />
              </div>
              <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-1">
                Telegram Bot
              </h3>
              <p className="text-xs text-[#64748B] mb-3 font-mono">@DeltaJalanBot</p>
              <p className="font-body-sm text-body-sm text-[#475569]">
                Cukup kirim foto dan lokasi ke bot Telegram. Cepat, praktis, tanpa perlu install
                aplikasi tambahan.
              </p>
            </div>

            {/* Website */}
            <div className="bg-white border border-[#e0e7ff] rounded-2xl p-6 md:p-7 text-center hover:shadow-lg hover:shadow-[#1e40af]/5 transition-all duration-300">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="language" className="!text-[26px] text-[#4338ca]" />
              </div>
              <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-1">
                Website
              </h3>
              <p className="font-body-sm text-body-sm text-[#475569]">
                Lapor melalui website di{" "}
                <span className="font-semibold text-[#1e40af]">deltajalan.web.id/lapor</span>. Bisa
                login untuk riwayat lengkap, atau tanpa login langsung kirim laporan.
              </p>
            </div>

            {/* Aplikasi Android */}
            <div className="bg-white border border-[#e0e7ff] rounded-2xl p-6 md:p-7 text-center hover:shadow-lg hover:shadow-[#1e40af]/5 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="android" className="!text-[26px] text-[#1e40af]" />
              </div>
              <h3 className="font-headline-md text-headline-md font-extrabold text-[#0F172A] mb-1">
                Aplikasi Android
              </h3>
              <p className="font-body-sm text-body-sm text-[#475569] mb-4">
                Download aplikasi DeltaJalan untuk pengalaman terbaik. GPS otomatis, notifikasi
                real-time, dan fitur lengkap.
              </p>
              <div className="flex flex-col items-center gap-3">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https%3A%2F%2Fapi.deltajalan.web.id%2Fapi%2Fpublic%2Fdownload-apk"
                  alt="QR Code download DeltaJalan"
                  className="w-[120px] h-[120px] rounded-lg border border-[#e0e7ff]"
                  loading="lazy"
                />
                <span className="font-label-sm text-label-sm text-[#94a3b8]">Scan QR dengan HP</span>
                <a
                  href="https://api.deltajalan.web.id/api/public/download-apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e40af] hover:text-[#2e68d8] transition-colors"
                >
                  <Icon name="file_download" className="!text-[16px]" />
                  Download APK (22 MB)
                </a>
              </div>
            </div>
          </div>
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
                  langsung dari foto yang Anda ambil. Tidak perlu keahlian teknis â€” cukup foto dan
                  sistem kami yang bekerja.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { icon: "bolt", text: "Deteksi < 3 detik", color: "#f59e0b" },
                    {
                      icon: "check_circle",
                      text: "Akurasi tinggi dengan WBF Ensemble",
                      color: "#10b981",
                    },
                    { icon: "cloud", text: "Diproses di AWS Lambda", color: "#3b82f6" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <Icon
                        name={item.icon}
                        className="!text-[18px] flex-shrink-0"
                        style={{ color: item.color }}
                      />
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
                      <h3 className="font-headline-md text-headline-md font-bold text-[#0F172A] mb-1">
                        {d.title}
                      </h3>
                      <p className="font-body-sm text-body-sm text-[#64748b] leading-relaxed line-clamp-2">
                        {d.desc}
                      </p>
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

                  {activeTesti.photo_url ? (
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-5 bg-gray-100">
                      {!imgLoaded[activeTesti.report_code] && (
                        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                      )}
                      <img
                        src={resolveImageUrl(activeTesti.photo_url) ?? ""}
                        alt={activeTesti.road_name}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          imgLoaded[activeTesti.report_code] ? "opacity-100" : "opacity-0"
                        }`}
                        onLoad={() =>
                          setImgLoaded((prev) => ({
                            ...prev,
                            [activeTesti.report_code]: true,
                          }))
                        }
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const placeholder = parent.querySelector("[data-placeholder]");
                            if (placeholder) {
                              (placeholder as HTMLElement).style.display = "flex";
                            }
                          }
                        }}
                      />
                      <div
                        data-placeholder
                        className="absolute inset-0 flex-col items-center justify-center text-[#94a3b8] hidden"
                      >
                        <Icon name="broken_image" className="!text-[32px] mb-1" />
                        <span className="font-label-sm text-label-sm">Gagal memuat foto</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-5 bg-gray-100 flex flex-col items-center justify-center text-[#94a3b8]">
                      <Icon name="photo_camera" className="!text-[32px] mb-1" />
                      <span className="font-label-sm text-label-sm">Tidak ada foto</span>
                    </div>
                  )}

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
                  <Icon
                    name="sentiment_satisfied"
                    className="!text-[44px] text-[#6366f1] mx-auto mb-3"
                  />
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
                  backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
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
                  Mari Wujudkan Sidoarjo <br className="hidden md:block" />
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
                  Kontribusi Anda sangat berharga bagi keselamatan jutaan pengendara. Laporkan
                  sekarang demi kenyamanan bersama.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <Link
                    to={loggedIn ? "/warga/lapor" : "/lapor"}
                    className="group inline-flex items-center gap-2.5 bg-white text-[#1e40af] font-label-md text-label-md font-bold px-8 py-4 rounded-2xl hover:shadow-2xl hover:shadow-black/20 active:scale-[0.97] transition-all"
                  >
                    <Icon name="add_circle" className="!text-[20px]" />
                    Mulai Lapor Sekarang
                  </Link>
                  <Link
                    to="/lacak"
                    className="inline-flex items-center gap-2 border-2 border-white/20 text-white/60 font-label-sm text-label-sm font-medium px-5 py-3 rounded-2xl hover:bg-white/10 hover:border-white/40 hover:text-white/90 active:scale-[0.97] transition-all"
                  >
                    <Icon name="search" className="!text-[16px]" />
                    Lacak Laporan
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedContent>

      {/* ── PETA PERSEBARAN ── */}
      <section className="py-16 md:py-20 px-6 bg-[#f8f9ff]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 bg-[#eef2ff] text-[#3730a3] rounded-full px-4 py-1.5 font-label-sm text-label-sm font-semibold mb-5">
              <Icon name="map" className="!text-[14px]" />
              Peta Persebaran
            </span>
            <h2 className="font-headline-lg text-headline-lg md:text-[36px] md:leading-[44px] font-extrabold text-[#0F172A] mt-2">
              Persebaran Kerusakan Jalan di Sidoarjo
            </h2>
            <p className="mt-3 font-body-md text-body-md text-[#64748b] max-w-lg mx-auto">
              Visualisasi sebaran laporan kerusakan jalan di seluruh 18 kecamatan Kabupaten Sidoarjo.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Suspense
              fallback={
                <div className="w-full rounded-xl bg-slate-100 flex items-center justify-center" style={{ height: "350px" }}>
                  <span className="w-6 h-6 border-2 border-[#1e40af]/30 border-t-[#1e40af] rounded-full animate-spin" />
                </div>
              }
            >
              <LandingMapPreview data={mapOverviewData} />
            </Suspense>
          </div>

          <div className="text-center mt-8">
            {loggedIn ? (
              <Link
                to="/map"
                className="inline-flex items-center gap-2 bg-[#1e40af] text-white font-label-md text-label-md font-semibold px-7 py-3.5 rounded-2xl hover:bg-[#1730a0] shadow-lg shadow-[#1e40af]/25 hover:shadow-xl hover:shadow-[#1e40af]/30 transition-all active:scale-[0.97]"
              >
                <Icon name="open_in_new" className="!text-[18px]" />
                Lihat Secara Detail
              </Link>
            ) : (
              <div>
                <p className="text-sm text-[#64748b] mb-3">
                  Login untuk melihat data persebaran kerusakan secara detail dan interaktif.
                </p>
                <Link
                  to="/masuk"
                  className="inline-flex items-center gap-2 bg-[#1e40af] text-white font-label-md text-label-md font-semibold px-7 py-3.5 rounded-2xl hover:bg-[#1730a0] shadow-lg shadow-[#1e40af]/25 hover:shadow-xl hover:shadow-[#1e40af]/30 transition-all active:scale-[0.97]"
                >
                  <Icon name="login" className="!text-[18px]" />
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#0a1628] text-white/55 px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center p-1">
                  <img
                    src="/logo.png"
                    alt="Dinas PU Bina Marga"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-headline-md text-headline-md font-bold text-white">
                  DeltaJalan
                </span>
              </div>
              <p className="font-body-sm text-body-sm leading-relaxed max-w-sm mb-5">
                Sistem informasi pelaporan dan monitoring kerusakan jalan terpadu untuk seluruh
                wilayah Kabupaten Sidoarjo.
              </p>
              <div className="flex flex-col gap-2">
                <span className="font-body-sm text-body-sm flex items-center gap-2">
                  <Icon name="location_on" className="!text-[14px] text-[#6366f1]" />
                  Jl. Gubernur Suryo, Sidoarjo
                </span>
                <a
                  href="mailto:pu@binamarga.sidoarjokab.go.id"
                  className="font-body-sm text-body-sm flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Icon name="alternate_email" className="!text-[14px] text-[#6366f1]" />
                  pu@binamarga.sidoarjokab.go.id
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-5 tracking-wide">
                Layanan
              </h4>
              <ul className="space-y-3">
                {[
                  { to: loggedIn ? "/warga/lapor" : "/lapor", label: "Pelaporan" },
                  { to: "/lacak", label: "Lacak Status" },
                  { to: "/warga/peta", label: "Peta Jalan" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="font-body-sm text-body-sm hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-label-md text-label-md font-semibold text-white mb-5 tracking-wide">
                Kontak
              </h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="tel:031-8961100"
                    className="font-body-sm text-body-sm flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <Icon name="phone" className="!text-[13px] text-[#6366f1]" />
                    031-8961100
                  </a>
                </li>
                <li>
                  <span className="font-body-sm text-body-sm cursor-default">
                    Syarat & Ketentuan
                  </span>
                </li>
                <li>
                  <span className="font-body-sm text-body-sm cursor-default">
                    Kebijakan Privasi
                  </span>
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
    </Suspense>
  );
}
