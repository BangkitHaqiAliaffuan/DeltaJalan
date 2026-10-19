# PLAN — Replikasi 1:1 Tampilan Login Frontend-stable → android-native (Compose)

**Tanggal:** 2026-09-29
**Tujuan:** Layar login `android-native` (Jetpack Compose) identik 100% dengan
`Frontend-stable/src/routes/login-petugas.tsx` — background gambar + overlay
gradient biru, kartu putih border biru, layout & tipografi sama.

---

## 0. Kesimpulan Analisis Kelayakan

**Bisa 100% sama? YA — dengan catatan pada 4 hal.** Compose sanggup mereplikasi
seluruh struktur (background image + gradient overlay + card + form + footer).
Tidak ada blocker teknis. 4 catatan penting **SETELAH CROSSCHECK**:

| # | Temuan | Dampak | Keputusan |
|---|--------|--------|-----------|
| 1 | `background.jpg` **bukan JPEG** — isinya **WebP 1360×765 RGB** (ekstensi menipu) | Android API <14 tak dukung WebP lossy secara native; minSdk 24 | Konversi ke **JPEG asli** ✅ sudah diuji: PIL baca WebP → simpan JPEG 1360×765 OK |
| 2 | Ikon `badge` (field email) **TIDAK ADA di ICON_MAP** → `Icon` mengembalikan `null` | Di frontend, field email **tanpa ikon** — TAPI padding `pl-10` (40px) tetap berlaku | Replikasi: field email **tanpa ikon, teks mulai x=40px** |
| 3 | Font `Manrope` (headline) & `Inter` (body) dimuat via webfont browser | Di Android harus eksplisit | Unduh TTF dari **fontsource CDN** (✅ diuji 200 OK) → `res/font/`, daftarkan FontFamily |
| 4 | ~~Konteks berbeda: frontend cek `role=="warga"` tolak & redirect per-role~~ | **Gap perilaku** — perlu diputuskan apakah direplikasi | Lihat §9 (di luar scope visual; catat sebagai TODO terpisah) |

**"100% sama"** = struktur, warna, ukuran, spacing, teks, gradient, radius, shadow
identik pada dimensi 360px card. Pixel-diff tak mungkin karena beda renderer
(browser vs Skia/Compose) & densitas layar, tapi secara desain akan **identik**.

---

## 1. Sumber Kebenaran (analisis file:line)

### Frontend-stable/src/routes/login-petugas.tsx
- **L86-93** Background: `fixed inset-0`, img `bg-cover bg-center` url `/background.jpg`
  + overlay `bg-gradient-to-b from-[#1e40af]/80 to-[#0f2b6d]/90`
- **L95-96** Wrapper: `min-h-[100dvh] flex items-center justify-center p-4`
  → konten: `w-full max-w-[360px]` + `animate-fade-in`
- **L97** Inner: `animate-slide-up` (fade + translateY 24px→0, 0.6s ease-out)
- **L98-101** Card: `bg-white rounded-2xl overflow-hidden border-2 border-[#1e40af]`
  boxShadow `0 25px 60px rgba(0,0,0,0.3)`
- **L102-112** Header: `pt-8 pb-6 px-8`, kolom center
  - Logo box: `w-16 h-16 rounded-xl bg-white shadow-md` + `img /icons/logo.png w-10 h-10`
  - Judul: `DeltaJalan` — Manrope, `text-headline-lg` (32px), **extrabold**,
    gradient text `from-[#1e40af] to-[#2e68d8]`, tracking-tight
  - Subjudul: `Masuk sebagai Petugas — Dinas PU Bina Marga` — Inter 14px,
    `#475569`, max-w 280px, center, leading-relaxed
- **L114** Body: `px-8 pb-6`
- **L115-122** Error box (kondisional): `bg-red-50 border border-red-200 rounded-lg px-4 py-3`,
  ikon `error` (=AlertCircle) `#E11D48` 18px + teks `#E11D48` 14px
- **L124-130** Form: `flex flex-col gap-4` (16px)
- **L131-154** Field email:
  - Label: `Email` — Inter 14px **semibold** `#0F172A`, gap 1.5 (6px)
  - Input: `h-11` (44px), `pl-10 pr-4` (ikon kiri 40px), `border #c4c5d5 rounded-lg`,
    text `#0F172A`, placeholder `#757684`, focus ring `#1e40af/20` + border `#1e40af`
  - **Ikon `badge` TIDAK render** (tidak ada di ICON_MAP) → efektif kosong di kiri
- **L156-186** Field password:
  - Label: `Kata Sandi` — Inter 14px semibold `#0F172A`
  - Input: `h-11 pl-4 pr-11`, placeholder `••••••••`
  - Toggle mata: `absolute right-3.5`, `visibility`/`visibility_off` 20px `#757684`
- **L188-205** Tombol Masuk:
  - `w-full h-11 rounded-lg` gradient `from-[#1e40af] to-[#2e68d8]`, teks putih
    Inter 14px semibold, `gap-2`, `mt-1`
  - Loading: spinner `w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin`
    + "Memverifikasi..."
  - Idle: ikon `login` (=LogIn) 20px + "Masuk"
- **L208-216** Link: `Kembali ke halaman masuk warga` — Inter 12px `#475569`,
  ikon `arrow_back` (=ArrowLeft) 16px, `mt-6`
- **L220-225** Footer (di luar card):
  - `Dinas PU Bina Marga & SDA — Kab. Sidoarjo` — 11px `white/50` tracking-wider, mt-6
  - `© 2024 DeltaJalan Infrastructure Suite. All Rights Reserved.` — 10px `white/30`, mt-1

### Frontend-stable/src/styles.css
- **L270-271** `animate-fade-in: fade-in 0.6s ease-out`, `animate-slide-up: slide-up 0.6s ease-out`
- **L274-292** keyframes: fade-in (opacity 0→1), slide-up (opacity 0→1 + translateY 24px→0)
- **L240,249-251,254,263-264** tipografi: headline-lg=32px/Manrope, body-sm=14px/Inter, label-md=14px/Inter, label-sm=12px/Inter

### Frontend-stable/src/components/jk/Icon.tsx
- **L300-303** `ICON_MAP[name]` undef → `return null`
- mapping: `error`→AlertCircle, `login`→LogIn, `arrow_back`→ArrowLeft, `visibility`→Eye, `visibility_off`→EyeOff, `badge`**→(tidak ada)**

### Aset
- `Frontend-stable/public/background.jpg` — **WebP 1360×765 RGB** (266 KB)
- `Frontend-stable/public/icons/logo.png` — PNG 512×512 RGBA (152 KB)

---

## 2. Pemetaan Nilai Desain (referensi implementasi) — TERVERIFIKASI

| Elemen | Nilai frontend | Compose |
|--------|----------------|---------|
| Biru utama | `#1e40af` | `Color(0xFF1E40AF)` |
| Biru terang | `#2e68d8` | `Color(0xFF2E68D8)` |
| Biru gelap gradient | `#0f2b6d` | `Color(0xFF0F2B6D)` |
| Overlay atas/bawah | `#1e40af`@80% → `#0f2b6d`@90% | `Brush.verticalGradient(listOf(c.copy(alpha=.8f), c.copy(alpha=.9f)))` |
| Teks gelap | `#0F172A` | `Color(0xFF0F172A)` |
| Subjudul/abu | `#475569` | `Color(0xFF475569)` |
| Placeholder | `#757684` | `Color(0xFF757684)` |
| Border input | `#c4c5d5` | `Color(0xFFC4C5D5)` |
| Error teks/ikon | `#E11D48` | `Color(0xFFE11D48)` |
| Error bg (red-50) | `#fef2f2` | `Color(0xFFFEF2F2)` |
| Error border (red-200) | `#fecaca` | `Color(0xFFFECACA)` |
| Radius card | rounded-2xl = 16px | `RoundedCornerShape(16.dp)` |
| Radius logo box | rounded-xl = **12px** | `RoundedCornerShape(12.dp)` |
| Radius input/btn | rounded-lg = 8px | `RoundedCornerShape(8.dp)` |
| Tinggi input/btn | h-11 = 44px | `height(44.dp)` |
| Logo box | w-16 h-16 = 64px | `size(64.dp)` |
| Logo gambar | w-10 h-10 = 40px | `size(40.dp)` |
| Card max width | 360px | `widthIn(max = 360.dp)` |
| Subjudul max width | 280px | `widthIn(max = 280.dp)` |
| Padding card hdr | pt-8 pb-6 px-8 → 32/24/32px | `padding(top=32, bottom=24, start/end=32)` |
| Body | px-8 pb-6 → 32/24px | `padding(start/end=32, bottom=24)` |
| Gap form | gap-4 = 16px | `Arrangement.spacedBy(16.dp)` |
| Gap label→input | gap-1.5 = 6px | `6.dp` |
| Email input kiri | **pl-10 = 40px** (walau ikon null) | `padding(start = 40.dp)` |
| Password input kanan | pr-11 = 44px | `padding(end = 44.dp)` |
| Ikon toggle mata | right-3.5 = 14px | `padding(end = 14.dp)` |
| Wrapper luar | p-4 = 16px | `padding(16.dp)` |
| Margin link | mt-6 = 24px | `24.dp` |
| Margin tombol | mt-1 = 4px | `4.dp` |
| Border card | border-2 = 2px | `border(2.dp, color, shape)` |
| Line-height subjudul | leading-relaxed = **1.625** | `lineHeight = 14.sp * 1.625 ≈ 22.75.sp` |
| Line-height judul | (tidak di-set → normal) | biarkan default |
| Shadow card | 0 25px 60px rgba(0,0,0,.3) | `Modifier.shadow(elevation=24.dp, shape, ambientColor=Black30, spotColor=Black30)` ≈ |

**Skala spacing terverifikasi (Tailwind v4, 1 unit = 4px):** p-4=16, px-8=32, pt-8=32,
pb-6=24, gap-4=16, gap-1.5=6, gap-2=8, h-11=44, w-16/h-16=64, w-10/h-10=40,
mt-6=24, mt-1=4, mt-2=8, left/right-3.5=14, pl-10=40, pr-11=44, border-2=2.

---

## 3. Perubahan yang Dibutuhkan

### 3.1 Aset (konversi & salin) — URL & ukuran TERVERIFIKASI
| Aksi | Dari | Ke |
|------|------|-----|
| Konversi WebP→JPEG (quality 88, RGB) | `public/background.jpg` (WebP 1360×765) | `res/drawable-nodpi/background_login.jpg` (✅ PIL OK, ~393 KB) |
| Salin logo + resize 120×120 | `public/icons/logo.png` (512×512 RGBA) | `res/drawable-nodpi/logo_deltajalan.png` |
| Unduh Manrope 700 & 800 (latin) | `cdn.jsdelivr.net/fontsource/fonts/manrope@latest/latin-{700,800}-normal.ttf` (✅ 200 OK, ~36 KB) | `res/font/manrope_bold.ttf`, `manrope_extrabold.ttf` |
| Unduh Inter 400 & 600 (latin) | `cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-{400,600}-normal.ttf` (✅ 200 OK, ~67 KB) | `res/font/inter_regular.ttf`, `inter_semibold.ttf` |

> Font yang benar-benar dipakai: judul = Manrope **800** (extrabold). Body/label =
> Inter **400** (regular), Inter **500/600** (medium/semibold untuk label & tombol).
> Minimal unduh: Manrope 800, Inter 400, Inter 600 (3 TTF). Manrope 700 & Inter 500 opsional.

**Catatan aset:** `res/font/` hanya boleh huruf kecil/underscore/digit (nama file font).
Ganti `background.jpg` dan `logo.png` ke nama lowercase tanpa tanda hubung.

### 3.2 File baru
- `app/src/main/java/com/jalankita/app/ui/theme/Color.kt` — palet warna
- `app/src/main/java/com/jalankita/app/ui/theme/Type.kt` — FontFamily Manrope/Inter + TextStyles
- `app/src/main/java/com/jalankita/app/ui/theme/Theme.kt` — MaterialTheme (light)
- `app/src/main/java/com/jalankita/app/ui/icon/AppIcons.kt` — 4 ikon (AlertCircle, LogIn, ArrowLeft, Eye/EyeOff)
  → pakai `androidx.compose.material:material-icons-extended` ATAU vector drawable custom
- `app/src/main/res/font/` — TTF font
- `app/src/main/res/drawable-nodpi/` — background + logo

### 3.3 File dimodifikasi
- `feature/auth/LoginScreen.kt` — **tulis ulang total** sesuai desain
- `app/build.gradle.kts` — tambah `material-icons-extended` (utk LogIn/AlertCircle/Eye/EyeOff)
- `MainActivity.kt` — bungkus dengan `DeltaJalanTheme` (bukan `MaterialTheme` polos)
- `res/values/themes.xml` — `windowBackground` gelap/splash (opsional, cegah flash putih)

---

## 4. Detail Implementasi LoginScreen.kt

```
Box(fillMaxSize)
├─ Image(background_login, contentScale=Crop, fillMaxSize)          // bg
├─ Box(fillMaxSize, Brush.verticalGradient(#1e40af 80% → #0f2b6d 90%))  // overlay
└─ Box(fillMaxSize, contentAlignment=Center, padding(16.dp))         // p-4
   └─ Column(widthIn(max=360.dp), animate fade-in + slide-up)
      ├─ Card putih, RoundedCornerShape(16), border 2.dp #1e40af
      │  ├─ Column(center, padding 32/24/32)  // header
      │  │  ├─ Box(64.dp, RoundedCornerShape(12), bg white, shadow) → Image logo 40.dp
      │  │  ├─ Text "DeltaJalan" — Manrope ExtraBold 32sp, gradient brush (#1e40af→#2e68d8)
      │  │  └─ Text "Masuk sebagai Petugas — Dinas PU Bina Marga" — Inter 14sp #475569, center, max 280dp
      │  ├─ Column(padding 32/0/32, gap 16)  // body
      │  │  ├─ [error box jika ada]
      │  │  ├─ Field email:  Label "Email" + OutlinedTextField h44 (tanpa leading icon)
      │  │  ├─ Field pass:   Label "Kata Sandi" + field h44 + toggle mata kanan
      │  │  └─ Button gradient h44 "Masuk"/spinner"Memverifikasi..."
      │  └─ Link "← Kembali ke halaman masuk warga" (center, mt24, Inter 12)
      ├─ Text footer 1 (11sp white 50%) mt24
      └─ Text footer 2 (10sp white 30%) mt4
```

**Catatan gradient text `DeltaJalan`:** Compose butuh
`TextStyle(brush = Brush.horizontalGradient(...))` (Compose 1.7+/BOM 2024.12 mendukung
`TextStyle.brush`) — sudah tersedia di BOM proyek.

**Catatan input style:** frontend pakai `<input>` custom (bukan Material outlined).
Untuk 100% sama, gunakan **`BasicTextField`** + `decorationBox` custom (bukan
`OutlinedTextField` yang punya label melayang & border Material) — supaya label
di atas, border 1px, radius 8, tanpa floating label.

---

## 5. Urutan Pengerjaan (step-by-step)

1. **Aset** — konversi background WebP→JPEG, salin logo, unduh 5-6 TTF font.
2. **Theme** — buat Color.kt, Type.kt, Theme.kt; wire ke MainActivity.
3. **Ikon** — tambah `material-icons-extended`; sediakan AlertCircle/LogIn/ArrowLeft/Eye/EyeOff.
4. **LoginScreen** — tulis ulang: Box+Image+gradient overlay+card+form+footer.
5. **Animasi** — fade-in (0.6s) + slide-up (0.6s, translateY 24→0) via
   `rememberInfiniteTransition`/`animateFloatAsState` + `Modifier.graphicsLayer`.
6. **Build + install** ke HP (A21s, authorized).
7. **Verifikasi visual** — screenshot HP vs mockup frontend; cek logcat bersih.
8. **Uji login** dengan akun petugas (verifikasi bug `team_id` sudah beres).

**Prinsip verifikasi:** bandingkan screenshot device (diskala ke viewport ~360×800)
dengan render frontend; cocokkan **12 titik checklist** (lihat §6). Bukan diff piksel.

---

## 6. Checklist Verifikasi Akhir (14 poin)

- [ ] Background gambar penuh + overlay biru gradient atas→bawah
- [ ] Card putih max 360px, border biru 2px, radius 16, shadow dalam
- [ ] Logo dalam kotak putih 64px (rounded **12**) di atas, center; img logo 40px
- [ ] Judul "DeltaJalan" gradien biru, extrabold (Manrope 800), ~32sp
- [ ] Subjudul "Masuk sebagai Petugas — Dinas PU Bina Marga" abu 14sp center, max 280px, leading-relaxed
- [ ] Label **"Email"** (BUKAN "Email / nomor HP") & **"Kata Sandi"** abu gelap 14sp semibold
- [ ] Input 44px, border **1px** #c4c5d5, radius 8, placeholder ("email@dispu.binamarga.go.id" & "••••••••")
- [ ] Field email **tanpa ikon** (replikasi badge null) TAPI teks mulai x=**40px** (pl-10); password ada toggle mata kanan
- [ ] Tombol "Masuk" gradien biru, 44px, teks putih + ikon login; loading = spinner + "Memverifikasi..."
- [ ] Link "← Kembali ke halaman masuk warga" 12sp abu (#475569)
- [ ] 2 baris footer putih transparan: "Dinas PU Bina Marga & SDA — Kab. Sidoarjo" (11sp white/50) & "© 2024 DeltaJalan..." (10sp white/30)
- [ ] Error box (jika gagal): bg #fef2f2, border #fecaca, teks+ikon #E11D48 — teks sesuai frontend
- [ ] Animasi masuk (fade-in + slide-up 0.6s) & tidak ada crash di logcat
- [ ] Uji login akun petugas (agus.setiawan@...) sukses → HomeScreen; `team_id` tidak crash

---

## 7. Risiko (CROSSCHECKED)

| Risiko | Mitigasi | Status verifikasi |
|--------|----------|-------------------|
| WebP `background.jpg` tak terbaca di drawable lama | Konversi ke JPEG baseline | ✅ Konversi PIL diuji OK |
| Font TTF gagal unduh (offline) | Fallback: `FontFamily.SansSerif` + catat TODO | ✅ fontsource 200 OK |
| `TextStyle.brush` versi Compose | Didukung BOM 2024.12 (ui 1.7.6) | ✅ `material-icons-extended` 1.7.6 terverifikasi ada di BOM |
| Dimensi (dp vs px) tak sama persis | Nilai dp dipakai apa adanya (360px≈360dp design baseline) | — |
| Bug login `team_id` masih ada | Sudah diperbaiki (Long→String); uji ulang setelah rebuild | ✅ diperbaiki |
| Nama file di `res/font/` salah (huruf besar/dash) | Pakai lowercase+underscore | dicatat §3.1 |
| Referensi dangling `coil.network` setelah edit | Cek grep setelah edit | ✅ sudah dibersihkan di build sebelumnya |

---

## 8. GAP PERILAKU ditemukan saat CROSSCHECK (penting)

Plan awal fokus visual saja. Crosscheck terhadap kode aktual menemukan **perbedaan
logika** antara `login-petugas.tsx` dan `AuthViewModel.kt` yang HARUS diputuskan:

| Aspek | Frontend (`login-petugas.tsx`) | Android (`AuthViewModel.login()`) | Dampak |
|-------|-------------------------------|-----------------------------------|--------|
| Tolak warga | L62-67: `if (role=="warga") setError(...)` | **TIDAK ADA** cek role | Beda perilaku |
| Redirect per-role | admin→/admin/dashboard, supervisor→/supervisor, else /home | Semua → `Authenticated(user)` → HomeScreen | Beda navigasi |
| Pesan error 401 | `data.message ?? "Login gagal..."` | `"Email atau kata sandi salah."` (hardcoded) | Teks beda |
| Pesan error jaringan | "Tidak dapat terhubung ke server..." | `e.message ?: "Login gagal, coba lagi."` | Teks beda |
| Validasi kosong | tidak ada (langsung fetch) | `"Email dan kata sandi wajib diisi."` | Android lebih ketat |
| Field | label "Email" (bukan "Email / nomor HP") | label "Email / nomor HP" | Beda teks label |

**Keputusan yang direkomendasikan (scope plan ini = VISUAL saja):**
- Replikasi **teks label** sesuai frontend: `Email` (bukan "Email / nomor HP") ✅
- Teks error **replikasi frontend** untuk 401 & jaringan ✅
- Cek role "warga" → **TAMBAHKAN** ke `AuthViewModel.login()` (kecil, benar) ✅
- Redirect per-role → **TODO terpisah** (butuh layar admin/supervisor yang belum ada)
  → saat ini semua role → HomeScreen (cukup untuk Fase 1)

> Ini koreksi penting: plan awal tidak menyebut perbedaan label field
> ("Email" vs "Email / nomor HP") dan pesan error. Sudah dimasukkan ke §6 checklist.

---

## 9. Batasan / Non-Goal

- **Bukan** port fitur lain (register, dashboard) — hanya layar login petugas.
- Tidak mengubah kontrak API / backend.
- Font Android relatif ke font Google (bukan embed woff2 asli frontend) —
  metrik visual praktis sama, bukan byte-identik.
- Emoji/varian OS tak dikontrol; fokus pada layout & gaya.

---

## 10. Ringkasan CROSSCHECK (audit plan ini)

| Klaim plan awal | Hasil crosscheck |
|-----------------|------------------|
| "3 catatan penting" | ❌ → **4** (tambah gap perilaku) |
| "rounded-2xl = 16px" | ✅ benar; **tapi** rounded-xl logo = 12px (plan awal tak bedakan) |
| "email tanpa ikon" | ✅ benar; **tapi** pl-10=40px tetap ada (plan awal tak sebut) |
| Error box warna | ⚠️ plan awal salah: border `#FECDD3` → yang benar red-200 = **`#fecaca`** |
| Label field "Email / nomor HP" | ❌ plan awal salah → frontend pakai **"Email"** |
| Font download | ✅ diverifikasi via **fontsource CDN** (bukan GitHub raw yg 302) |
| `material-icons-extended` | ✅ 1.7.6 tersedia di BOM 2024.12.01 |
| Konversi WebP→JPEG | ✅ PIL diuji: 1360×765 → JPEG OK |
| shadow "≈" | ✅ tak bisa persis (beda renderer) — didokumentasikan |
| spacing values | ✅ semua diverifikasi (Tailwind 1 unit = 4px) |
| line-height subjudul | ⚠️ plan awal tak sebut → **leading-relaxed = 1.625** |
