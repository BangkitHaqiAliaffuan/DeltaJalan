# JalanKita — Design System

## 1. Stack & Tools

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Start (SSR) |
| Styling | Tailwind CSS v4 + `tw-animate-css` |
| Design tokens | Inline `@theme` block in `src/styles.css` |
| Icons | **Material Symbols Outlined** (variable fonts, Google Fonts) |
| Fonts | **Inter** (semua teks — headlines, body, labels), **JetBrains Mono** (codes) |
| Maps | Leaflet 1.9.4 (`react-leaflet` 5.0, dynamic import) |
| Route | TanStack Router (file-based, `routeTree.gen.ts` auto-generated) |
| Build | Vite 7 + `@lovable.dev/vite-tanstack-config` (bundles TanStack Start + React + Tailwind plugins — do NOT add Vite plugins manually) |

Tailwind v4 is configured exclusively via CSS (`@import "tailwindcss"` in `styles.css`) — no `tailwind.config.*` or `postcss.config.*` file exists.

> **Font change:** Plus Jakarta Sans dihapus. Inter dipakai untuk semua teks termasuk heading — lebih netral, sangat terbaca untuk data-dense UI instansi. Update `__root.tsx` font link accordingly.

---

## 2. Color Palette

Defined in `@theme` block in `src/styles.css`. All colors use Tailwind v4's `--color-*` convention.

Referensi: GOV.UK Design System (`#1d70b8`), Primer GitHub (`#0969da`), Linear (`#0f172a` sidebar).

### Design Philosophy

Warna dipakai **hanya untuk fungsi**, bukan dekorasi:
- Biru tua (`#1A4F8A`) = aksi utama, navigasi aktif, sidebar
- Abu netral = surface, border, teks sekunder
- Merah/oranye/hijau = **status saja** (kerusakan, workflow)
- Tidak ada gradien, tidak ada shadow tebal, tidak ada warna dekoratif

### Brand & Surface

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#1A4F8A` | Primary buttons, links, active nav, sidebar bg |
| `--color-on-primary` | `#ffffff` | Text on primary bg |
| `--color-primary-container` | `#1A4F8A` | Same as primary (container alias) |
| `--color-on-primary-container` | `#ffffff` | Text on primary container |
| `--color-primary-fixed` | `#C8DEFF` | Light variant, subtle primaries — lebih biru, tidak ungu |
| `--color-primary-fixed-dim` | `#93BBF7` | Dimmer variant |
| `--color-secondary` | `#2C5F9E` | Secondary actions — biru satu ramp lebih terang dari primary |
| `--color-secondary-container` | `#C8DEFF` | Container variant |
| `--color-surface` | `#F5F7FA` | Page background — abu sangat terang, bukan ungu |
| `--color-on-surface` | `#0F1623` | Primary text — hampir hitam, kontras tinggi |
| `--color-on-surface-variant` | `#3D4A5C` | Secondary text, muted — abu biru gelap |
| `--color-surface-variant` | `#D6E4F7` | Variant surface — biru muda |
| `--color-surface-bright` | `#FFFFFF` | Brightest surface |
| `--color-surface-dim` | `#C9D8EC` | Dimmed surface |
| `--color-surface-container-lowest` | `#FFFFFF` | Card backgrounds, white |
| `--color-surface-container-low` | `#EEF3FA` | Hover, subtle containers |
| `--color-surface-container` | `#E4EBF5` | General container |
| `--color-surface-container-high` | `#D6E0EF` | Elevated containers |
| `--color-surface-container-highest` | `#C8D6EB` | Highest container |
| `--color-bg-surface` | `#F5F7FA` | Global app bg (used in AppLayout) |
| `--color-background` | `#F5F7FA` | Root background |
| `--color-on-background` | `#0F1623` | Text on background |

### Outline & Border

| Token | Hex | Usage |
|---|---|---|
| `--color-outline` | `#5A6A7E` | Active outlines — abu biru, bukan abu netral |
| `--color-outline-variant` | `#C0CEDF` | Subtle outlines |
| `--color-border-subtle` | `#D0DAE8` | Card borders, dividers — lebih biru dari sebelumnya (`#E2E8F0`) |

> **Catatan border:** Border kini `#D0DAE8` (bukan `#E2E8F0`). Lebih terlihat pada background putih tanpa terasa berat. Konsisten dengan Primer GitHub.

### Error / Alert

| Token | Hex | Usage |
|---|---|---|
| `--color-error` | `#C0392B` | Error text, icons — merah lebih tua, lebih serius |
| `--color-on-error` | `#ffffff` | Text on error bg |
| `--color-error-container` | `#FDECEA` | Light error bg |
| `--color-on-error-container` | `#7B1111` | Text on error container |

### Inverse

| Token | Hex |
|---|---|
| `--color-inverse-surface` | `#1A2A3D` |
| `--color-inverse-primary` | `#93BBF7` |

### Damage Severity (Custom)

Tidak ada perubahan — warna status harus tetap intuitif dan universal.

| Token | Hex | Semantic |
|---|---|---|
| `--color-rusak-berat` | `#EF4444` | Severe damage (red) |
| `--color-rusak-sedang` | `#F97316` | Moderate damage (orange) |
| `--color-rusak-ringan` | `#F59E0B` | Minor damage (amber) |
| `--color-selesai` | `#10B981` | Completed status (green) |

### Trust Score Colors (Inline)

Used in `TrustBadge.tsx` — not in `@theme`:

| Label | Background | Text | Border |
|---|---|---|---|
| Hijau (≥75) | `bg-green-50` | `text-green-800` | `border-green-300` |
| Kuning (45–74) | `bg-amber-50` | `text-amber-800` | `border-amber-300` |
| Merah (<45) | `bg-red-50` | `text-red-800` | `border-red-300` |

---

## 3. Typography

### Font Families

| Role | Font | Usage |
|---|---|---|
| Semua teks | **Inter** (400–700 weight) | Headlines, body, labels, buttons, navigation |
| Code / IDs | **JetBrains Mono** | Report codes (`LP-2026-00042`), technical labels |

> **Mengapa Inter untuk semua?** Inter dirancang khusus untuk layar dan data-dense interfaces (Linear, Vercel, GitHub semuanya pakai Inter). Plus Jakarta Sans terlalu dekoratif untuk konteks instansi pemerintah — terasa seperti startup app, bukan internal tool yang serius.

### Type Scale (dari `@theme`)

Ukuran sama, hanya font family yang berubah ke Inter semua.

| Token | Size | Weight Convention |
|---|---|---|
| `--text-headline-lg` | 28px | `font-bold` (700) |
| `--text-headline-md` | 24px | `font-bold` (700) |
| `--text-headline-sm` | 20px | `font-semibold` (600) — naik dari 18px |
| `--text-headline-lg-mobile` | 22px | `font-bold` (700) |
| `--text-headline-md-mobile` | 20px | `font-bold` (700) |
| `--text-headline-sm-mobile` | 17px | `font-semibold` (600) |
| `--text-body-lg` | 16px | `font-medium` (500) |
| `--text-body-md` | 14px | `font-normal` (400) |
| `--text-label-md` | 13px | `font-semibold` (600) — naik dari 12px |
| `--text-label-sm` | 12px | `font-medium` (500) — naik dari 11px |
| `--text-id-code` | 12px | `font-normal` (JetBrains Mono) — naik dari 11px |

> **Mengapa label naik ukuran?** 11–12px terlalu kecil untuk pengguna yang tidak terbiasa UI digital (petugas lapangan, staf dinas). Minimum teks actionable = 13px. Lihat referensi GOV.UK yang menetapkan minimum 16px body.

### Usage Pattern in Components

```tsx
// Page title / brand
<h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
  JalanKita
</h1>

// Section heading
<h2 className="text-headline-sm font-semibold text-on-surface">
  Laporan Terbaru
</h2>

// Card title
<h4 className="text-label-md font-semibold text-on-surface">
  Nama Jalan / Title
</h4>

// Body text
<p className="text-body-md text-on-surface-variant leading-relaxed">
  Deskripsi atau info tambahan
</p>

// Report codes (monospace)
<p className="font-id-code text-id-code text-on-surface-variant">
  LP-2026-00042
</p>

// Timestamp / metadata
<span className="text-label-sm text-on-surface-variant">
  Kec. Sidoarjo
</span>
```

### Font Loading

Update `__root.tsx` — hapus Plus Jakarta Sans, tambah Inter weight yang cukup:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```

---

## 4. Spacing Scale (dari `@theme`)

Tidak berubah — skala sudah baik.

| Token | Value |
|---|---|
| `--spacing-margin-mobile` | 16px |
| `--spacing-xs` | 4px |
| `--spacing-sm` | 8px |
| `--spacing-md` | 16px |
| `--spacing-lg` | 24px |
| `--spacing-xl` | 32px |
| `--spacing-2xl` | 48px |
| `--spacing-tap-target-min` | 44px (minimum touch target) |

Standard Tailwind v4 spacing (`--spacing-*`) is also available: 0.25rem (1), 0.5rem (2), 0.75rem (3), 1rem (4), etc.

**IMPORTANT:** Due to Tailwind v4's sizing behavior where `max-w-sm`/`md`/`lg` etc. use `--spacing-*` variables, the CSS file **overrides** these with explicit pixel values in a `@layer utilities` block. Always use arbitrary values `[Xrem]` or inline styles for max-width utilities to avoid confusion.

---

## 5. Border Radius

| Token | Value |
|---|---|
| `--radius` | 0.5rem (8px) — turun dari 10px |

Radius lebih kecil = lebih serius, kurang "playful". Referensi: GOV.UK (0), Primer (6px), Linear (6–8px). Kita pilih 8px sebagai kompromi — tetap modern tapi tidak terlalu bulet.

| Komponen | Radius | Kelas |
|---|---|---|
| Cards & containers | 8px | `rounded-lg` |
| Buttons | 8px | `rounded-lg` |
| Badges / chips | pill | `rounded-full` |
| Inputs | 8px | `rounded-lg` |
| Avatars / icons | circle | `rounded-full` |
| Modals | 12px | `rounded-xl` |

> Sebelumnya semua `rounded-xl` (12px). Sekarang turun ke `rounded-lg` (8px) untuk sebagian besar elemen. Modal tetap `rounded-xl`.

---

## 6. Layout Architecture

### Root Structure (`__root.tsx`)

```
<html>
  <head>        ← HeadContent (meta, links)
  <body>
    <QueryClientProvider>   ← from @tanstack/react-query
      <Outlet />           ← route content rendered here
    </QueryClientProvider>
    <Scripts />            ← TanStack Start scripts
  </body>
</html>
```

No global layout wrapper — each route renders its own shell.

### Login Page (`/` — index.tsx)

Standalone page, no `AppLayout`. Full-screen dengan pendekatan lebih institutional:

```
fixed inset-0 w-full h-full overflow-y-auto
  background: bg-[#F5F7FA]  ← bukan background.jpg — terlalu consumer app
  centered card: max-w-[400px] bg-white rounded-xl border border-[#D0DAE8] shadow-sm
    header: logo + "JalanKita" + "Sistem Pelaporan Kerusakan Jalan"
    divider tipis
    form: email + password + submit
    footer: "© Dinas PU Bina Marga Kabupaten Sidoarjo"
```

> **Perubahan besar:** Background foto dihilangkan. Halaman login kini solid `#F5F7FA` dengan card putih dan border tipis. Lebih terasa seperti sistem internal pemerintah (SIMDA, SIPKD, dll.) yang familiar bagi pengguna target.

### Authenticated Pages (all other routes)

```
<AppLayout>
  <div className="flex flex-col min-h-screen w-full">
    <TopBar />        ← sticky top-0, 56px, z-40
    <main>             ← flex-1 content, pb-24 md:pb-8
      ...
    </main>
    <BottomNav />     ← mobile only (md:hidden)
  </div>
</AppLayout>
```

> TopBar turun dari 60px ke 56px — sedikit lebih compact, lebih proporsional dengan konten.

**`AppLayout.tsx`:**
```tsx
<div className="min-h-screen bg-[#F5F7FA] flex">
  <Sidebar />        ← hidden md:flex, w-64 (naik dari w-60)
  <div className="flex-1 flex flex-col min-w-0">
    {children}
  </div>
</div>
```

> Sidebar naik dari `w-60` (240px) ke `w-64` (256px) — sedikit lebih lega untuk label navigasi.

**WARNING:** Do NOT add `overflow-hidden`, `transform`, `filter`, or `will-change` to AppLayout or Sidebar — these break `position: fixed` on child modals. Always use `<Portal>` for fixed overlays.

---

## 7. Navigation

### Sidebar (Desktop: `md:` and above)

- Dark blue bg: `bg-[#1A4F8A]`
- Lebar: `w-64` (256px)
- Sticky top, full viewport height
- Hidden on mobile (`hidden md:flex`)
- Brand header: logo bulat putih + "JalanKita" (Inter 600) + "Dinas PU Bina Marga" (Inter 400, opacity-75)
- **Separator line** antara brand header dan menu: `border-b border-white/15`
- Menu items: padding `px-3 py-2`, rounded-lg, gap antar grup pakai section label kecil
- Active item: `bg-white/15 text-white font-semibold` (bukan warna lain — tetap dalam ramp biru)
- Hover item: `hover:bg-white/10`
- Footer: border atas `border-t border-white/15` + user avatar + nama + role + logout
- Logout button: `text-white/70 hover:text-white hover:bg-white/10`

> **Perubahan:** Opacity-based hover/active (white/10, white/15) lebih bersih dari warna hardcoded. Konsisten dengan pola Linear dan GOV.UK sidebar.

### TopBar (All screen sizes)

- `sticky top-0 z-40`, height `h-14` (56px)
- White bg: `bg-white`
- Bottom border: `border-b border-[#D0DAE8]` — lebih terlihat dari sebelumnya
- Horizontal padding: `px-4`
- Left: back arrow (optional) + page title `text-[15px] font-semibold text-on-surface`
- Right: user avatar dropdown (initials circle, 32px)
- **Tidak ada elemen dekoratif** di TopBar — murni navigasi

### BottomNav (Mobile only: `md:hidden`)

- Fixed to bottom of viewport (`fixed bottom-0`)
- Height: `h-16` (64px)
- Max width 430px, centered with `left-1/2 -translate-x-1/2`
- White bg: `bg-white`
- Top border: `border-t border-[#D0DAE8]`
- Each item: icon (20px) + label (12px) — naik dari 11px
- Active item: `text-primary font-semibold` + top indicator `border-t-2 border-primary`
- Inactive: `text-on-surface-variant`
- Safe area padding: `pb-safe`

### Role-Based Navigation

**Petugas (`petugas`):**
- Sidebar: Beranda, Upload & Analisis, Laporan Saya, Semua Laporan, Pengaturan (disabled)
- BottomNav: Beranda, Upload, Laporan Saya, Semua

**Supervisor (`supervisor`):**
- Sidebar: Dashboard, Review Laporan, Laporan Saya, Statistik (disabled), Pengaturan (disabled)
- BottomNav: Dashboard (single item)

**Petugas Eksekusi (`petugas_eksekusi`):**
- Sidebar: Tugas Saya, Laporan Saya, Pengaturan (disabled)
- BottomNav: Tugas Saya (single item)

---

## 8. Page Structure Patterns

### Common Pattern

Every authenticated page follows this structure:

```tsx
export const Route = createFileRoute("/page-name")({
  component: PageComponent,
  head: () => ({ meta: [{ title: "Page Title — JalanKita" }] }),
});

function PageComponent() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "expected_role") {
      navigate({ to: "/" });
      return;
    }
    loadData();
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
        <TopBar title="Page Title" />
        <main className="flex-1 p-4 md:p-6 flex flex-col gap-4 pb-24 md:pb-8">
          {/* Page content */}
        </main>
        <BottomNav />
      </div>
    </AppLayout>
  );
}
```

> `p-4 md:p-6` — padding desktop sedikit lebih lega.

### Key Pages

| Route | Role | Features |
|---|---|---|
| `/` (index) | Public | Login form, background solid, centered card |
| `/home` | petugas | Dashboard with stats cards, task list, recent reports |
| `/upload` | petugas | Photo capture/upload, GPS, road search, duplicate checker, batch upload |
| `/ai-result` | petugas | AI analysis result display, severity, trust score |
| `/my-reports` | all | List of own reports with filters |
| `/reports` | all | All reports list |
| `/review` | all | Detail view of a single report (role-aware actions) |
| `/supervisor` | supervisor | Dashboard with tabs, stats, UPR management |
| `/petugas-eksekusi` | petugas_eksekusi | Task list for assigned UPR |
| `/complete-report` | petugas_eksekusi | Complete repair (after photo upload) |
| `/edit-report` | petugas | Edit report before supervisor review |
| `/create-report` | supervisor? | Create report manually |

---

## 9. Component Library (`src/components/jk/`)

### Icon (`Icon.tsx`)

Wrapper around Material Symbols Outlined. Supports `filled`, `weight` (font variation), custom `className`.

```tsx
// Standard
<Icon name="home" />
// Filled variant
<Icon name="home" filled />
// Custom weight
<Icon name="home" weight={600} />
// Size via className
<Icon name="home" className="!text-[18px]" />
```

### ImageWithLoading (`ImageWithLoading.tsx`)

Reusable image component with loading spinner and error state. Cached image detection via `imgRef.current?.complete`.

```tsx
<ImageWithLoading
  src={photo.image_result_url ?? photo.image_original_url ?? ""}
  alt="Description"
  wrapperClassName="relative aspect-video bg-slate-100 rounded-lg overflow-hidden"
  className="w-full h-full object-contain"
  loading="lazy"
/>
```

States:
- **Loading:** Centered spinning ring on translucent bg
- **Error:** "Gagal memuat" text on gray bg
- **Loaded:** Image with `object-contain` by default

### ReportMap (`ReportMap.tsx`)

Leaflet map for detail pages. Takes `points[]` with lat/lng + label. Dynamic import of Leaflet with singleton guard. `isolation: isolate` on container to contain Leaflet's high z-index.

- Single point: blue marker (bukan merah — konsisten dengan brand biru), 16 zoom
- Multiple points: numbered blue markers, `fitBounds`
- Click on marker: popup dengan label, koordinat, "Buka di Google Maps" link

### BatchMapPreview (`BatchMapPreview.tsx`)

Leaflet map for the batch upload flow. Numbered markers. Runs `snapToRoadBatch()` asynchronously and re-renders markers when snapped data arrives.

### TrustBadge (`TrustBadge.tsx`)

Displays trust score with color-coded pill badge + optional breakdown details.

```tsx
<TrustBadge score={75} label="hijau" breakdown={...} showDetail />
```

Renders: `75/100 — Kredibel` (tanpa emoji — lebih clean untuk UI instansi).

### DuplicateChecker (`DuplicateChecker.tsx`)

Complex component that combines map view, duplicate report cards, and "Dukung Laporan" (support report) button. Used in upload flow.

### DuplicateMapView (`DuplicateMapView.tsx`)

Leaflet map in the duplicate checker. Shows user location (blue) and duplicate report markers (red).

### FraudWarningModal (`FraudWarningModal.tsx`)

Modal for EXIF validation warnings. Uses `<Portal>` for correct z-index stacking. Two modes: warning-only (allow continue) and blocking (must pick different photo).

### Portal (`Portal.tsx`)

React Portal wrapper for all fixed overlay/modal/drawer components. Renders to `document.body#portal-root`. Auto-cleans container on unmount.

### images (`images.ts`)

Static image URLs used as placeholder/example images (AIDA hosted). Not used in production flow — all real images come from the API's `storage/*` URLs.

---

## 10. Card & Container Patterns

### Standard Card

```tsx
<div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
  <h3 className="text-[15px] font-semibold text-on-surface mb-3">
    Title
  </h3>
  {/* content */}
</div>
```

> `shadow-sm` dihapus — border saja sudah cukup. Shadow membuat UI terasa "berlapis-lapis" dan kurang flat. Referensi: Linear, Primer.

### Info Banner (Success)

```tsx
<div className="flex items-center gap-2.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-4 py-3">
  <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" filled />
  <p className="text-[13px] text-[#065F46]">Success message</p>
</div>
```

### Warning Banner

```tsx
<div className="flex items-start gap-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3">
  <Icon name="warning" className="text-[#92400E] !text-[18px] shrink-0" filled />
  <p className="text-[13px] text-[#92400E] leading-relaxed">Warning message</p>
</div>
```

### Error Banner

```tsx
<div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
  <Icon name="error" className="text-[#991B1B] !text-[18px] shrink-0" />
  <p className="text-[13px] text-[#991B1B] leading-relaxed">Error message</p>
</div>
```

### Info Banner (Informational — baru)

```tsx
<div className="flex items-start gap-2.5 bg-[#EEF3FA] border border-[#C0CEDF] rounded-lg px-4 py-3">
  <Icon name="info" className="text-[#1A4F8A] !text-[18px] shrink-0" />
  <p className="text-[13px] text-[#1A4F8A] leading-relaxed">Info message</p>
</div>
```

### Stats Card (Dashboard)

```tsx
<div className="bg-white border border-[#D0DAE8] p-4 rounded-lg">
  <p className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wide mb-3">
    Total Laporan
  </p>
  <p className="text-[28px] font-bold text-on-surface leading-none mb-1">47</p>
  <p className="text-[12px] text-on-surface-variant">
    <span className="text-[#059669] font-medium">+3</span> dari minggu lalu
  </p>
</div>
```

> **Perubahan besar pada Stats Card:**
> - Label di atas, angka di bawah (bukan icon + angka bersisian) — lebih mudah scan
> - Label uppercase tracking-wide untuk keterbacaan — pola umum di Primer/Linear
> - Delta/perubahan angka di bawah angka utama
> - Tidak ada ikon besar di kanan — kurangi visual noise
> - Tidak ada `shadow-sm`

### List Item (Recent Reports)

```tsx
<div className="px-4 py-3.5 flex items-center justify-between hover:bg-[#EEF3FA] transition-colors border-b border-[#D0DAE8] last:border-b-0">
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-[#EEF3FA] border border-[#D0DAE8] flex items-center justify-center shrink-0 mt-0.5">
      <Icon name="description" className="text-primary !text-[16px]" />
    </div>
    <div>
      <p className="font-id-code text-[12px] text-on-surface-variant mb-0.5">LP-2026-00042</p>
      <h4 className="text-[14px] font-semibold text-on-surface mb-1">Nama Jalan</h4>
      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
        Rusak Berat
      </div>
    </div>
  </div>
  <Icon name="chevron_right" className="text-[#C0CEDF] !text-[18px] shrink-0" />
</div>
```

> - Icon container lebih kecil (36px vs 48px) dengan border
> - Padding vertikal `py-3.5` — sedikit lebih compact
> - Border antar item via `border-b` pada item, bukan container

---

## 11. Progress Bar (Workflow Steps)

Used in `review.tsx` to show report status progression.

```
[● Laporan Masuk] ─── [○ Review] ─── [○ Disposisi] ─── [○ Selesai]
```

- Completed step: green fill `bg-[#10B981]` + white checkmark
- Current step: primary fill `bg-primary` + white dot kecil di tengah
- Incomplete step: border circle `border-2 border-[#D0DAE8] bg-white`
- Rejected step: red fill `bg-[#EF4444]` + white X
- Label di bawah step circle: `text-[11px] font-medium`
- Connector line: `h-[2px]` — tipis, bukan tebal

Status mapping:
- `Menunggu Review` / `Ditinjau` / `Diedit` → Step 1 (Laporan Masuk)
- `Disetujui` → Step 2 (Review)
- `Sedang Diperbaiki` → Step 3 (Disposisi)
- `Selesai` → Step 4 (Selesai)
- `Ditolak` → Rejected state

---

## 12. Severity Badge Conventions

| Value | Class | Color |
|---|---|---|
| `Rusak Berat` / `berat` | `bg-red-50 text-red-700 border border-red-200` | Red |
| `Rusak Sedang` / `sedang` | `bg-orange-50 text-orange-700 border border-orange-200` | Orange |
| `Rusak Ringan` / `ringan` | `bg-amber-50 text-amber-700 border border-amber-200` | Amber |
| `Baik` | `bg-green-50 text-green-700 border border-green-200` | Green |

> Diubah dari opacity modifier (`/10`, `/20`) ke explicit Tailwind color stops — lebih predictable dan konsisten di semua browser.

Badge anatomy:
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold bg-red-50 text-red-700 border border-red-200">
  Rusak Berat
</span>
```

Normalization: `severityBadge(sev)` function tetap maps `undefined`/`null` → gray.

---

## 13. Status Display Conventions

| DB Status | Display Text | Badge Style |
|---|---|---|
| `Menunggu Review` | Menunggu Review | `bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]` |
| `Ditinjau` | Menunggu Review | Same as above |
| `Disetujui` | Disetujui | `bg-green-50 text-green-700 border border-green-200` |
| `Ditolak` | Ditolak | `bg-red-50 text-red-700 border border-red-200` |
| `Sedang Diperbaiki` | Sedang Diperbaiki | `bg-orange-50 text-orange-700 border border-orange-200` |
| `Selesai` | Selesai | `bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]` |
| `Diedit` | (hidden, maps to Ditinjau) | — |

---

## 14. Leaflet Map Conventions

All Leaflet maps share these patterns:
- Dynamic import (`import("leaflet")`) — never static import (SSR compatibility)
- Singleton guard (`isImportingRef`) prevents duplicate imports
- Ref-based syncing (`pointsRef`, `locationsRef`) avoids stale closures
- `isolation: isolate` on container to contain Leaflet's high z-index (400–800)
- OSM tile layer: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Default attribution included
- Custom divIcons (numbered markers for batch, solid blue marker untuk single)
- Click popup shows coordinates + Google Maps link
- `zoomControl: false` to reduce UI clutter
- Container border: `border border-[#D0DAE8] rounded-lg overflow-hidden`

---

## 15. Buttons & Interactive Elements

### Primary Button

```tsx
<button className="w-full h-11 bg-primary text-white rounded-lg text-[14px] font-semibold
  flex items-center justify-center gap-2 hover:bg-[#163F6E] active:scale-[0.98]
  transition-all disabled:opacity-50 disabled:cursor-not-allowed">
  <Icon name="check" className="!text-[18px]" />
  Label
</button>
```

> `hover:bg-[#163F6E]` = primary satu ramp lebih gelap. Lebih baik dari `hover:bg-primary/90` yang terasa blur.

### Secondary / Outlined Button

```tsx
<button className="w-full h-11 bg-white text-primary border border-[#D0DAE8]
  rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2
  hover:bg-[#EEF3FA] hover:border-primary active:scale-[0.98] transition-all">
  Label
</button>
```

> Border netral (`#D0DAE8`) saat idle, border primary saat hover — lebih subtle dari border primary selalu.

### Destructive Button

```tsx
<button className="w-full h-11 bg-white text-red-700 border border-red-200
  rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2
  hover:bg-red-50 active:scale-[0.98] transition-all">
  <Icon name="delete" className="!text-[18px]" />
  Tolak Laporan
</button>
```

### Support Button (Duplicate Checker)

```tsx
<button className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200
  text-amber-800 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
  <Icon name="thumb_up" className="!text-[16px]" />
  Ini Lubang yang Sama (Dukung Laporan)
</button>
```

### Icon Button (TopBar)

```tsx
<button className="w-9 h-9 flex items-center justify-center rounded-lg
  hover:bg-[#EEF3FA] transition-colors">
  <Icon name="arrow_back" className="text-on-surface-variant !text-[20px]" />
</button>
```

> Turun dari `rounded-full` ke `rounded-lg` — konsisten dengan elemen lain.

---

## 16. Form Inputs

```tsx
<input
  className="w-full py-2.5 px-3.5 border border-[#C0CEDF] rounded-lg text-[14px]
    text-on-surface placeholder:text-[#8FA3B8] bg-white
    focus:outline-none focus:ring-2 focus:ring-primary/20
    focus:border-primary transition-colors"
/>
```

> - Border lebih gelap saat idle: `#C0CEDF` (bukan `#E5E7EB`) — lebih visible, konsisten dengan Primer
> - Placeholder lebih terang: `#8FA3B8` (bukan `#9CA3AF`)
> - `py-2.5 px-3.5` — sedikit lebih compact dari `py-3 px-4`

With icon prefix:
```tsx
<div className="relative flex items-center">
  <Icon name="mail" className="absolute left-3 text-[#8FA3B8] !text-[18px]" />
  <input className="w-full py-2.5 pl-10 pr-4 border border-[#C0CEDF] rounded-lg ..." />
</div>
```

### Form Label

```tsx
<label className="block text-[13px] font-semibold text-on-surface mb-1.5">
  Nama Jalan <span className="text-red-500 font-normal">*</span>
</label>
```

> Label 13px semibold, bukan 12px — lebih mudah dibaca. Asterisk wajib dipisah dengan `font-normal`.

---

## 17. Modal / Overlay Conventions

All fixed overlays MUST use `<Portal>`:

```tsx
<Portal>
  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    style={{ backgroundColor: "rgba(15, 22, 35, 0.6)" }}
    onClick={onClose}>
    <div className="w-full max-w-[400px] bg-white rounded-xl border border-[#D0DAE8]"
      style={{ maxHeight: "90vh", overflowY: "auto" }}
      onClick={(e) => e.stopPropagation()}>
      {/* Modal header */}
      <div className="px-5 py-4 border-b border-[#D0DAE8]">
        <h2 className="text-[16px] font-semibold text-on-surface">Judul Modal</h2>
      </div>
      {/* Modal body */}
      <div className="px-5 py-4">
        {/* content */}
      </div>
      {/* Modal footer */}
      <div className="px-5 py-4 border-t border-[#D0DAE8] flex gap-2 justify-end">
        {/* buttons */}
      </div>
    </div>
  </div>
</Portal>
```

> **Perubahan:**
> - Backdrop lebih gelap: `rgba(15, 22, 35, 0.6)` — kontras lebih baik
> - Modal punya header + body + footer sections dengan border antar section
> - Border pada modal card: `border border-[#D0DAE8]` — modal terasa lebih "grounded"
> - Tidak ada `shadow-2xl` — border sudah cukup
> - `max-w-[400px]` (bukan `max-w-sm` yang ambigu di Tailwind v4)

Patterns:
- Escape key to close
- Body scroll lock via `useEffect`
- `aria-modal`, `aria-labelledby`, `aria-describedby` for accessibility

---

## 18. CSS Utilities & Gotchas

### Custom Utilities (in `styles.css`)

```css
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
```

### Material Symbols

```css
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
```

Default icon size is 24px. Override dengan `!text-[18px]` dll. Gunakan `weight={600}` atau `weight={700}` untuk icon yang harus lebih tegas (misalnya di dalam button primary).

### Important Layout Rules (from styles.css comments)

1. **Do NOT use `mx-auto` on flex children** — flex child dengan `margin: auto` collapse ke minimum content width. Gunakan inline `style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}`.

2. **Do NOT add `overflow-hidden`, `transform`, `filter`, atau `will-change` ke AppLayout atau Sidebar** — memutus `position: fixed` pada modal.

3. **Always use `<Portal>` for fixed overlays** — renders ke `document.body`, hindari stacking context issues.

4. **Max-width overrides** — gunakan arbitrary values `[Xrem]` karena `max-w-sm`/`md`/`lg` di Tailwind v4 memakai `--spacing-*`.

---

## 19. Responsive Breakpoints

- **Mobile (default):** `< 768px` — full-width shell, BottomNav visible, Sidebar hidden
- **Desktop (`md:`):** `>= 768px` — Sidebar visible (`w-64`), BottomNav hidden, content area fills remaining width
- All authenticated pages use `min-h-screen` + `pb-24 md:pb-8` to account for BottomNav overlap on mobile.

---

## 20. Misc

### Loading Spinner

```tsx
<span className="w-5 h-5 border-2 border-[#D0DAE8] border-t-primary rounded-full animate-spin" />
```

> Border track lebih jelas: `#D0DAE8` (bukan `primary/30` yang kadang terlalu samar).

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
  <div className="w-12 h-12 rounded-lg bg-[#EEF3FA] border border-[#D0DAE8] flex items-center justify-center mb-4">
    <Icon name="inbox" className="text-[#5A6A7E] !text-[22px]" />
  </div>
  <p className="text-[15px] font-semibold text-on-surface mb-1">Belum ada laporan</p>
  <p className="text-[13px] text-on-surface-variant">Laporan yang masuk akan tampil di sini.</p>
</div>
```

### Section Divider with Label

```tsx
<div className="flex items-center gap-3 my-4">
  <div className="flex-1 h-px bg-[#D0DAE8]" />
  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
    Laporan Terbaru
  </span>
  <div className="flex-1 h-px bg-[#D0DAE8]" />
</div>
```

### `@tanstack/react-query`
Used for server state (wraps the app in `QueryClientProvider`). Many pages use raw `fetch()` with `useEffect` instead of React Query for simplicity.

### Error Boundaries
`__root.tsx` defines `errorComponent` (ErrorComponent) and `notFoundComponent` (404 page).

### Route File Convention
Each route is a file in `src/routes/` matching TanStack Router file conventions. `routeTree.gen.ts` is auto-generated — never edit manually.

### Head Meta
Each route exports `head: () => ({ meta: [{ title: "..." }] })` for SSR SEO / page titles.

---

## 21. Ringkasan Perubahan dari Versi Sebelumnya

| Aspek | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| Font heading | Plus Jakarta Sans | Inter | Inter lebih netral, cocok internal tool |
| Font body | Inter | Inter | Tidak berubah |
| Label min size | 11px | 12–13px | Aksesibilitas, pengguna non-tech |
| Border radius | 10–12px (`rounded-xl`) | 8px (`rounded-lg`) | Lebih serius, kurang playful |
| Border warna | `#E2E8F0` | `#D0DAE8` | Lebih visible, lebih biru |
| Background app | `#faf8ff` (ungu tipis) | `#F5F7FA` (abu netral) | Lebih netral, cocok instansi |
| Surface colors | Ramp ungu-biru | Ramp abu-biru murni | Konsisten dengan primary biru |
| Card shadow | `shadow-sm` ada | Tidak ada shadow | Flat design, border cukup |
| Login background | Foto background.jpg | Solid `#F5F7FA` | Lebih institutional |
| Stats card | Icon kanan + angka besar | Label atas + angka besar + delta | Lebih scannable |
| Modal | `shadow-2xl`, no border | Border `#D0DAE8`, no shadow | Lebih grounded |
| Button hover | `opacity/90` | Hex eksplisit lebih gelap | Lebih predictable |
| Sidebar width | 240px (`w-60`) | 256px (`w-64`) | Lebih lega |
| TopBar height | 60px | 56px (`h-14`) | Lebih compact |
| Emoji di TrustBadge | Ada (🟢🟡🔴) | Tidak ada | Lebih clean, professional |
