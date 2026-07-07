# ERR_BLOCKED_BY_ORB pada Gambar — Analisis & Fix

## TL;DR

`ERR_BLOCKED_BY_ORB` (Opaque Response Blocking) muncul karena Service Worker (SW) menyimpan response 404 HTML untuk gambar di cache, lalu menyajikannya terus walau server sudah benar. Ditambah TanStack Query cache yang menyimpan data API lama dengan URL gambar yang salah.

## Detail

### Arsitektur

Frontend: TanStack Start SSR, Vite 7, VitePWA (Workbox)
Backend: Laravel 13 (REST API, `php artisan serve` port 8080)
Dev setup: Vite proxy `/api/*` dan `/storage/*` ke port 8080

### Alur Request Gambar

1. Browser minta halaman supervisor di `localhost:5173`
2. Halaman fetch data API via `/api/reports?...` → Vite proxy → Laravel :8080
3. API return JSON dengan `first_photo_url`: `http://localhost:5173/storage/reports/...` (dari `asset()`)
4. Browser render `<img src="http://localhost:5173/storage/reports/...">`
5. Vite proxy meneruskan ke `http://localhost:8080/storage/reports/...`
6. Laravel serve dari `public/storage/reports/...` (symlink ke `storage/app/public/reports/...`)

### Kenapa ORB Terjadi

**Opaque Response Blocking (ORB)** adalah mekanisme Chrome yang menggantikan CORB (Cross-Origin Read Blocking). ORB memblokir response **cross-origin no-cors** jika MIME type tidak sesuai dengan konteks. Untuk `<img>` tag:

- `image/*` → allowed
- `application/octet-stream` → allowed (bisa sniff)
- `text/html` → **blocked** (karena tidak bisa di-sniff sebagai gambar)

ORB hanya berlaku untuk **cross-origin** requests (`no-cors` mode). Same-origin requests tidak kena ORB.

### Rantai Penyebab

**1. APP_URL di `.env` awalnya `http://localhost:8080`**

   - `asset('storage/'.$path)` menghasilkan `http://localhost:8080/storage/...`
   - Frontend di `localhost:5173` memuat gambar dari `localhost:8080` → **cross-origin**
   - Untuk `<img>` tag cross-origin dengan Content-Type `image/jpeg`, ORB tidak blokir (sesuai spesifikasi)

**2. Tapi... file gambar belum ada atau path-nya salah**

   Saat pertama kali report dibuat, mungkin path file yang disimpan di DB tidak cocok dengan file aktual di disk. Laravel return 404 (HTML) → cross-origin + `text/html` → **ORB blokir**

**3. TanStack Query cache data lama**

   Query client di halaman supervisor punya `staleTime: 15000` (15 detik). Dalam 15 detik itu, data API dari session sebelumnya (dengan URL `:8080`) masih dipakai. Gambar cross-origin tetap gagal.

**4. Service Worker menyimpan response 404**

   VitePWA aktif di dev mode (`devOptions: { enabled: true }`). Service Worker menggunakan **CacheFirst** untuk semua gambar:

   ```ts
   registerRoute(
     /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
     new CacheFirst({
       cacheName: "images-v1",
       plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 2592000 })],
     }),
   );
   ```

   Response 404 (HTML) untuk gambar yang tidak ditemukan di-cache oleh SW dan disajikan **selamanya** (30 hari). Setelah server diperbaiki (APP_URL diubah, file tersedia), SW tetap menyajikan 404 HTML dari cache → cross-origin + `text/html` → **ORB blokir terus**.

**5. VitePWA gagal inject registrasi SW di dev mode**

   HTML tidak mengandung `<script>` registrasi SW. SW hanya terdaftar karena kompilasi build sebelumnya atau manual. Perubahan di `src/sw.ts` tidak otomatis ter-compile ulang.

### Visual Flow

```
[Browser :5173]
    │
    ├─ GET /api/reports → Vite proxy → Laravel :8080
    │     └─ JSON: { first_photo_url: "http://:5173/storage/...jpg" }
    │                                 (sebelum fix: "http://:8080/...")
    │
    └─ <img src="http://:5173/storage/...jpg">
          │
          ├─ (same-origin → ORB tidak berlaku)
          │
          ├─ Vite proxy → Laravel :8080 → file exists? → 200 image/jpeg ✅
          │                                            → 404 text/html → (jalan rusak)
          │
          └─ Service Worker CacheFirst:
                ├─ Cache hit? → serve cached response
                │    └─ jika cached response = 404 HTML → ORB blokir
                └─ Cache miss? → fetch network → cache & return
```

### Fix

**1. Service Worker (`src/sw.ts`)**

   - Ganti `CacheFirst` → `NetworkFirst` untuk gambar (selalu fetch dari network, cache sebagai fallback)
   - Ganti cache name dari `images-v1` → `images-v2` (force cache baru)
   - Tambah `activate` event listener untuk hapus cache lama (`-v1`)
   - Tambah `self.clients.claim()` agar SW baru langsung mengontrol semua tab

   ```ts
   const OLD_CACHE_PATTERNS = [/^api-v1$/, /^images-v1$/, /^static-v1$/, /^cdn-v1$/];

   self.addEventListener("activate", (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(
           keys
             .filter((key) => OLD_CACHE_PATTERNS.some((p) => p.test(key)))
             .map((key) => caches.delete(key)),
         )
       ).then(() => self.clients.claim()),
     );
   });

   registerRoute(
     /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
     new NetworkFirst({
       cacheName: "images-v2",
       plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 2592000 })],
     }),
   );
   ```

**2. Supervisor page (`src/routes/supervisor/index.tsx`)**

   - Invalidate TanStack Query cache on mount: `queryClient.invalidateQueries({ queryKey: ["reports"] })`
   - Tambah `refetchOnMount: 'always'` di useQuery paginated reports

**3. Vite proxy (`vite.config.ts`)**

   - Tambah CORS headers safety net di proxy `/storage`:
     - `Access-Control-Allow-Origin: *`
     - `Cross-Origin-Resource-Policy: cross-origin`

   ```ts
   configure: (proxy) => {
     proxy.on("proxyRes", (proxyRes) => {
       proxyRes.headers["Access-Control-Allow-Origin"] = "*";
       proxyRes.headers["Cross-Origin-Resource-Policy"] = "cross-origin";
     });
   },
   ```

**4. Registrasi Service Worker manual (`src/client.tsx`)**

   VitePWA gagal inject registrasi di dev mode. Registrasi manual:

   ```ts
   if ("serviceWorker" in navigator && !(window.Capacitor?.isNativePlatform?.() === true)) {
     window.addEventListener("load", () => {
       navigator.serviceWorker.register("/sw.js", { scope: "/" });
     });
   }
   ```

### Kesimpulan

| Lapisan | Masalah | Fix |
|---|---|---|
| Service Worker | CacheFirst menyimpan 404 HTML | Ganti ke NetworkFirst + hapus cache lama |
| TanStack Query | Cache data dengan URL :8080 | Invalidate on mount |
| VitePWA | Gagal inject registrasi SW | Manual register di client.tsx |
| Vite proxy | Cross-origin tanpa CORS safety net | Inject CORS headers |
| APP_URL | URL gambar cross-origin dari :8080 | Ubah ke :5173 (same-origin via Vite proxy) |

### Sumber Referensi

- [ORB Spec (annevk/orb)](https://github.com/annevk/orb/blob/main/README.md)
- [Chrome Intent to Ship: ORB v0.2](https://groups.google.com/a/chromium.org/g/blink-dev/c/RcuAzHEI2CU/m/7PsOrCjUAAAJ)
- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
- [VitePWA injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest.html)
