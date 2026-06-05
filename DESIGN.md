# DeltaJalan — Design System (Civic Precision)

## 1. Stack & Tools

| Layer | Technology |
|---|---|
| Framework | React 19 + TanStack Start (SSR) |
| Styling | Tailwind CSS v4 + `tw-animate-css` |
| Design tokens | Inline `@theme` block in `src/styles.css` |
| Icons | **Material Symbols Outlined** (variable fonts, Google Fonts) |
| Fonts | **Manrope** (headlines — display, heading levels), **Inter** (body, labels, buttons), **JetBrains Mono** (codes) |
| Maps | Leaflet 1.9.4 (`react-leaflet` 5.0, dynamic import) |
| Route | TanStack Router (file-based, `routeTree.gen.ts` auto-generated) |
| Build | Vite 7 + `@lovable.dev/vite-tanstack-config` (bundles TanStack Start + React + Tailwind plugins — do NOT add Vite plugins manually) |

Tailwind v4 is configured exclusively via CSS (`@import "tailwindcss"` in `styles.css`) — no `tailwind.config.*` or `postcss.config.*` file exists.

> **Font pairing:** Manrope untuk headlines (geometric, modern, premium) + Inter untuk body/labels (legibility di data-dense UI). Berasal dari Stitch design system "Civic Precision" (proyek DeltaJalan Redesign).

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
| `--color-primary` | `#1e40af` | Primary buttons, links, active nav |
| `--color-on-primary` | `#ffffff` | Text on primary bg |
| `--color-primary-container` | `#1e40af` | Same as primary (container alias) |
| `--color-on-primary-container` | `#ffffff` | Text on primary container |
| `--color-primary-fixed` | `#dde1ff` | Light variant |
| `--color-primary-fixed-dim` | `#b8c4ff` | Dimmer variant |
| `--color-secondary` | `#735c00` | Gold-toned secondary (dari PU logo) |
| `--color-on-secondary` | `#ffffff` | Text on secondary bg |
| `--color-secondary-container` | `#fed01b` | Gold/yellow container |
| `--color-surface` | `#f7f9fb` | Page background — slate sangat terang |
| `--color-on-surface` | `#0F172A` | Primary text — hampir hitam, kontras tinggi |
| `--color-on-surface-variant` | `#475569` | Secondary text, muted — slate |
| `--color-surface-bright` | `#ffffff` | Brightest surface |
| `--color-surface-dim` | `#d8dadc` | Dimmed surface |
| `--color-surface-container-lowest` | `#ffffff` | Card backgrounds, white |
| `--color-surface-container-low` | `#F1F5F9` | Hover, subtle containers, greeting bg |
| `--color-surface-container` | `#eceef0` | General container |
| `--color-bg-surface` | `#f7f9fb` | Global app bg (used in AppLayout) |
| `--color-background` | `#f7f9fb` | Root background |
| `--color-on-background` | `#191c1e` | Text on background |

### Outline & Border

| Token | Hex | Usage |
|---|---|---|
| `--color-outline` | `#757684` | Active outlines |
| `--color-outline-variant` | `#c4c5d5` | Subtle outlines |
| `--color-border-subtle` | `#E2E8F0` | Card borders, dividers, table borders |

### Error / Alert

| Token | Hex | Usage |
|---|---|---|
| `--color-error` | `#E11D48` | Error text, icons — rose red |
| `--color-on-error` | `#ffffff` | Text on error bg |
| `--color-error-container` | `#ffdad6` | Light error bg |
| `--color-on-error-container` | `#93000a` | Text on error container |

### Status Semantic Colors

| Token | Hex | Semantic |
|---|---|---|
| `--color-status-critical` | `#E11D48` | Severe damage / critical |
| `--color-status-success` | `#10B981` | Completed / success |
| `--color-status-warning` | `#F59E0B` | Warning / pending |
| `--color-rusak-berat` | `#E11D48` | Severe damage |
| `--color-rusak-sedang` | `#F97316` | Moderate damage |
| `--color-rusak-ringan` | `#F59E0B` | Minor damage |
| `--color-selesai` | `#10B981` | Completed |

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
| Headlines (display, heading) | **Manrope** (600–700 weight) | Dashboard greeting, section titles, page headings |
| Body (semua teks fungsional) | **Inter** (400–500 weight) | Labels, buttons, navigation, descriptions |
| Code / IDs | **JetBrains Mono** | Report codes (`LP-2026-00042`), technical labels |

> **Mengapa Manrope + Inter?** Manrope memberikan geometric modern character untuk elemen headline — membuat UI terasa "designed" tanpa menjadi dekoratif. Inter digunakan untuk functional text karena legibility tinggi di data-dense views. Ini adalah font pairing dari Stitch design system "Civic Precision".

### Type Scale (dari `@theme`)

| Token | Size | Font | Weight Convention |
|---|---|---|---|
| `--text-display-lg` | 48px | Manrope | `font-bold` (700), tracking -0.02em |
| `--text-headline-lg` | 32px | Manrope | `font-bold` (700) |
| `--text-headline-md` | 24px | Manrope | `font-semibold` (600) |
| `--text-headline-sm` | 18px | Manrope | `font-semibold` (600) |
| `--text-headline-lg-mobile` | 24px | Manrope | `font-bold` (700) |
| `--text-headline-md-mobile` | 20px | Manrope | `font-bold` (700) |
| `--text-headline-sm-mobile` | 17px | Manrope | `font-semibold` (600) |
| `--text-body-lg` | 18px | Inter | `font-normal` (400) |
| `--text-body-md` | 16px | Inter | `font-normal` (400) |
| `--text-body-sm` | 14px | Inter | `font-normal` (400) |
| `--text-label-md` | 14px | Inter | `font-semibold` (600), letter-spacing 0.05em |
| `--text-label-sm` | 12px | Inter | `font-medium` (500) |
| `--text-id-code` | 12px | JetBrains Mono | `font-normal` (400) |

### Usage Pattern in Components

```tsx
// Page title / brand
<h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
  DeltaJalan
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
| `--radius` | 0.5rem (8px) |

| Komponen | Radius | Kelas |
|---|---|---|
| Primary buttons, inputs, form fields | 8px | `rounded-lg` |
| Dashboard cards, stat cards | 16px (1rem) | `rounded-xl` atau `rounded-2xl` |
| Badges / chips | pill | `rounded-full` |
| Modals | 12px | `rounded-xl` |
| Login card | 12px | `rounded-xl` |
| Sidebar items | 8px | `rounded-lg` |

> Berdasarkan Stitch "Civic Precision": cards menggunakan `rounded-xl` (1rem/16px) untuk modern enterprise look. Elemen fungsional (buttons, inputs) tetap 8px.

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

Standalone page, no `AppLayout`. Full-screen dengan pendekatan institutional (Stitch "Login - Unified Sidoarjo Identity"):

```
fixed inset-0 w-full h-full overflow-y-auto
  background: bg-[#f7f9fb]
  centered card: max-w-[420px] bg-white rounded-xl border border-[#E2E8F0]
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)
    header: icon container (14x14 rounded-xl bg-[#F1F5F9] + add_road icon)
            "DeltaJalan" (font-headline-lg-mobile)
            "Road Management"
            "Dinas PU Bina Marga & SDA — Kab. Sidoarjo"
    body:
      "Selamat Datang" heading
      "Silakan masuk dengan kredensial petugas Anda."
      error banner (bg-red-50, border-red-200, text-[#E11D48])
      form: email (icon mail prefix) + password (toggle visibility)
      submit button: bg-[#1e40af], hover:bg-[#173bab]
    footer: security icon + "Sistem Keamanan Internal Terenkripsi"
```

> **Perubahan dari versi sebelumnya:** Background foto dihilangkan. Footer keamanan ditambahkan. Form input height 44px (h-11) untuk tap target lebih besar.

### Authenticated Pages (all other routes)

```
<AppLayout>
  <div className="flex flex-col h-screen w-full">    ← h-screen, bukan min-h-screen
    <TopBar />        ← shrink-0, sticky top-0, 56px (h-14), z-40
    <main>             ← flex-1 overflow-y-auto min-h-0 pb-4
      ...
    </main>
    <BottomNav />     ← mobile only (md:hidden), shrink-0
  </div>
</AppLayout>
```

> Layout sticky: TopBar + BottomNav `shrink-0`, konten tengah `flex-1 overflow-y-auto min-h-0`. Tidak menggunakan `position: fixed` untuk menghindari overlay/fixed-position bugs dengan modal dan toast.

**`AppLayout.tsx`:**
```tsx
<div className="h-screen bg-[#F5F7FA] flex overflow-hidden">
  <Sidebar />        
  <div className="flex-1 flex flex-col min-w-0">
    {children}
  </div>
</div>
```

> Menggunakan `h-screen overflow-hidden` untuk sticky layout. Sidebar width 256px (w-64).

**WARNING:** Do NOT add `overflow-hidden`, `transform`, `filter`, or `will-change` to AppLayout or Sidebar — these break `position: fixed` on child modals. Always use `<Portal>` for fixed overlays.

### Dashboard Greeting Section

Setiap halaman dashboard memulai dengan greeting section:

```
<section className="px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
  <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-[#0F172A]">
    Selamat Pagi, Nama Petugas
  </h2>
  <div className="flex items-center gap-1.5 text-[#475569]">
    <Icon name="location_on" className="!text-[16px]" />
    <p className="font-body-md text-body-md">
      Role · Kec. Wilayah
    </p>
  </div>
</section>
```

Untuk petugas eksekusi, tambahan status badge:

```
<div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-[#D1FAE5] border border-[#6EE7B7] self-start">
  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
  <span className="font-label-sm text-label-sm font-semibold text-[#10B981]">
    Status: Aktif Bertugas
  </span>
</div>
```

---

## 7. Navigation

### Sidebar (Desktop: `md:` and above)

- Dark blue bg: `bg-primary` (`#1e40af`)
- Lebar: `w-64` (256px)
- Sticky top, full viewport height
- Hidden on mobile (`hidden md:flex`)
- Brand header: logo bulat putih + "DeltaJalan" (Inter 600) + "Dinas PU Bina Marga" (Inter 400, opacity-75)
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
  head: () => ({ meta: [{ title: "Page Title — DeltaJalan" }] }),
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
| `/` (index) | Public | Login form, background solid `#f7f9fb`, centered card, brand DeltaJalan |
| `/home` | petugas | Dashboard — greeting, 4 stat cards (Prioritas/Selesai/Diproses/Total), quick actions, recent reports table |
| `/upload` | petugas | Photo capture/upload, GPS, road search, duplicate checker, batch upload |
| `/ai-result` | petugas | AI analysis result display, severity, trust score |
| `/my-reports` | all | List of own reports with filters |
| `/reports` | all | All reports list |
| `/review` | all | Detail view of a single report (role-aware actions) |
| `/supervisor` | supervisor | Dashboard with tabs, stats, UPR management |
| `/petugas-eksekusi` | petugas_eksekusi | Dashboard — greeting + status badge, 4 stat cards (Prioritas/Diproses/Selesai/Total), sort dropdown, task cards with photo + badges + detail info |
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
<div className="bg-white rounded-xl border border-[#E2E8F0] p-4"
  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
  <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-3">
    Title
  </h3>
  {/* content */}
</div>
```

> Cards menggunakan `rounded-xl` (1rem/16px) dengan subtle shadow (`0 1px 3px rgba(0,0,0,0.04)`). Shadow ringan ini membuat card terasa "mengambang" di atas background tanpa terasa berat. Berdasarkan Stitch "Civic Precision" yang menggunakan level 1 elevation.

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

Setiap dashboard memiliki 4 stat cards dalam `grid grid-cols-2 gap-4 md:grid-cols-4`. Menggunakan pola label atas + nilai besar + subtitle (Stitch "Civic Precision"):

```tsx
<div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
  <div className="flex items-center justify-between mb-3">
    <span className="font-label-sm text-label-sm font-semibold text-[#E11D48] uppercase tracking-wider">
      Prioritas
    </span>
    <Icon name="warning" className="!text-[18px] text-[#E11D48]" />
  </div>
  <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
    12
  </p>
  <p className="font-label-sm text-label-sm text-[#475569]">Tugas Tertunda</p>
</div>
```

> **Pola:** Label semantic color + icon di baris atas, big number di tengah (`font-headline-lg text-[#0F172A]`), subtitle di bawah. Icon kecil di pojok kanan atas sebagai indikator visual. Tidak ada delta/percent change pada default — hanya muncul untuk card tertentu (Rusak Berat).

### Recent Reports Table (Petugas Lapangan Dashboard)

Berdasarkan Stitch "DeltaJalan - Dashboard Petugas Sidoarjo", recent reports menggunakan layout table dengan grid:

```tsx
<div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
  {/* Desktop: header row */}
  <div className="hidden md:grid grid-cols-[1fr_140px_140px_110px_40px] gap-3 px-5 py-3 bg-[#F1F5F9] border-b border-[#E2E8F0]">
    <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Lokasi / Jalan</span>
    <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Kecamatan</span>
    <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Tanggal</span>
    <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Status</span>
    <span />
  </div>
  {/* Rows */}
  <Link to="/detail-report" search={{ reportId: r.id }}
    className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_110px_40px] gap-2 md:gap-3 px-5 py-4 items-center hover:bg-[#F1F5F9] transition-colors border-b border-[#E2E8F0] last:border-b-0">
    <div>
      <p className="font-id-code text-id-code text-[#475569] mb-0.5">{r.report_code}</p>
      <h4 className="font-body-md text-body-md font-semibold text-[#0F172A] truncate">{r.road_name}</h4>
    </div>
    <span className="font-body-sm text-body-sm text-[#475569]">Kec. Porong</span>
    <span className="font-label-sm text-label-sm text-[#475569]">Hari ini, 08:45</span>
    <div className="flex flex-wrap gap-1.5">
      <span className="badge-berat">Rusak Berat</span>
      <span className="badge-diproses">Disetujui</span>
    </div>
    <Icon name="chevron_right" className="text-[#757684] !text-[18px] hidden md:block" />
  </Link>
</div>
```

> **Mobile:** Single column layout (road name, kecamatan inline, date + badges stacked). **Desktop:** Grid table with 5 columns. Header visible only on desktop (`hidden md:grid`). Each row is a Link ke detail page.

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
<button className="w-full h-11 bg-[#1e40af] text-white rounded-lg font-label-md text-label-md font-semibold
  flex items-center justify-center gap-2 hover:bg-[#173bab] active:scale-[0.98]
  transition-all disabled:opacity-50 disabled:cursor-not-allowed">
  <Icon name="check" className="!text-[18px]" />
  Label
</button>
```

> `hover:bg-[#173bab]` = primary satu ramp lebih gelap. Lebih baik dari `hover:bg-primary/90` yang terasa blur.

### Secondary / Outlined Button

```tsx
<button className="w-full h-11 bg-white text-[#1e40af] border border-[#E2E8F0]
  rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2
  hover:bg-[#F1F5F9] hover:border-[#1e40af] active:scale-[0.98] transition-all">
  Label
</button>
```

### Destructive Button

```tsx
<button className="w-full h-11 bg-[#E11D48] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-2
  hover:bg-[#BE123C] active:scale-[0.98] transition-all">
  <Icon name="delete" className="!text-[18px]" />
  Tolak Laporan
</button>
```

### Ghost / Tertiary Button

```tsx
<button className="h-11 bg-transparent text-[#475569] hover:bg-[#F1F5F9] rounded-lg
  font-label-md text-label-md font-medium px-4 transition-colors">
  Label
</button>
```

### Icon Button (TopBar)

```tsx
<button className="w-9 h-9 flex items-center justify-center rounded-lg
  hover:bg-[#F1F5F9] transition-colors">
  <Icon name="arrow_back" className="text-[#475569] !text-[20px]" />
</button>
```

---

## 16. Form Inputs

```tsx
<input
  className="w-full h-11 pl-10 pr-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md
    text-[#0F172A] placeholder:text-[#757684] bg-white
    focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20
    focus:border-[#1e40af] transition-colors"
/>
```

> - Tinggi input `h-11` (44px) untuk tap target minimum
> - Border idle `#c4c5d5` (outline-variant) — lebih visible
> - Placeholder `#757684` (outline) — lebih terang dari teks
> - Focus ring 2px primary/20 + border primary
> - Font body-md (16px) untuk legibility

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
    style={{ backgroundColor: "rgba(0, 40, 142, 0.5)" }}
    onClick={onClose}>
    <div className="w-full max-w-[400px] bg-white rounded-xl border border-[#E2E8F0]"
      style={{ maxHeight: "90vh", overflowY: "auto" }}
      onClick={(e) => e.stopPropagation()}>
      {/* Modal header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="font-label-md text-label-md font-semibold text-[#0F172A]">Judul Modal</h2>
      </div>
      {/* Modal body */}
      <div className="px-5 py-4">
        {/* content */}
      </div>
      {/* Modal footer */}
      <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
        {/* buttons */}
      </div>
    </div>
  </div>
</Portal>
```

> **Perubahan:**
> - Backdrop: `rgba(0, 40, 142, 0.5)` (primary container dengan opacity) — thematic dengan brand biru
> - Border: `#E2E8F0` (border-subtle) — konsisten dengan warna border sistem

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
<span className="w-5 h-5 border-2 border-[#E2E8F0] border-t-primary rounded-full animate-spin" />
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white border border-[#E2E8F0] rounded-xl">
  <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-4">
    <Icon name="inbox" className="text-[#475569] !text-[22px]" />
  </div>
  <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada laporan</p>
  <p className="font-body-sm text-body-sm text-[#475569]">Laporan yang masuk akan tampil di sini.</p>
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
| Font heading | Inter | Manrope | Stitch "Civic Precision" — Manrope lebih premium untuk headline |
| Font body | Inter | Inter | Tidak berubah |
| Brand | DeltaJalan | DeltaJalan | Konsisten dengan nama domain |
| Primary color | `#1A4F8A` | `#1e40af` | Dinas Blue dari Stitch design system |
| Surface color | `#F5F7FA` | `#f7f9fb` | Slate-50, konsisten dengan Stitch |
| Border warna | `#D0DAE8` | `#E2E8F0` | Kembali ke slate-200, lebih netral |
| Card radius | 8px (`rounded-lg`) | 16px (`rounded-xl`) | Modern enterprise look (Stitch) |
| Card elevation | Border only | Subtle shadow (`0 1px 3px rgba(0,0,0,0.04)`) | Floating card effect |
| Login background | Foto background.jpg → Solid `#F5F7FA` | Solid `#f7f9fb` + card shadow | Lebih institutional |
| Login footer | Copyright only | Security icon + "Sistem Keamanan Internal Terenkripsi" | Trust building |
| Input height | `py-2.5` (~40px) | `h-11` (44px) | Tap target lebih besar |
| Recent reports | List cards with icon | Table with header columns | Lebih scannable (Stitch) |
| Stats card | Icon + value side by side | Label atas + big number + subtitle + icon corner | Lebih scannable |
| Petugas eksekusi | Basic task list | Full dashboard: greeting + status badge + 4 stats + sort + task cards | Feature parity dengan Stitch |
| Status badge | None | "Aktif Bertugas" green pill di petugas eksekusi | Role identity |
| Empty state | Plain text | Card dengan icon container + rounded-xl | Konsisten dengan komponen lain |
