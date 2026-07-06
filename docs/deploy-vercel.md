# Deploy Frontend ke Vercel — Panduan Lengkap

## Arsitektur

```
                              INTERNET                          LOCAL NETWORK
┌──────────────────┐                        ┌──────────────────────────────────┐
│   Vercel (CDN)   │   HTTPS                │  Local Machine (Windows)         │
│                  │───────────────────────▶│                                  │
│  Frontend SPA    │   API call             │  ┌────────────┐  ┌────────────┐  │
│  (static files)  │   /api/reports, dll    │  │  Laravel   │  │ PostgreSQL │  │
│                  │                        │  │  :8080     │◀─▶│  :5432     │  │
│                  │                        │  └─────┬──────┘  └────────────┘  │
│                  │                        │        │                          │
│  image_original_ │                        │  ┌─────┴──────┐                  │
│  _url dari API   │                        │  │  FastAPI   │                  │
│  → load image    │   HTTPS                │  │  AI :8000  │                  │
│  dari tunnel     │───────────────────────▶│  └────────────┘                  │
│                  │                        │                                  │
│                  │                        │  Tunnel (ngrok/playit)           │
│                  │                        │  expose :8080 → public URL       │
└──────────────────┘                        └──────────────────────────────────┘
```

### Alur Data

| Dari | Ke | Melalui |
|---|---|---|
| Vercel (browser) | Laravel API | Tunnel → `:8080` |
| Vercel (browser) | Storage images | Tunnel → `:8080/storage/...` |
| Laravel | FastAPI AI | Local network → `localhost:8000` |
| Laravel | PostgreSQL | Localhost → `:5432` |
| Telegram | Laravel | Tunnel → `/telegram/webhook` |

### Kenapa Tunnel?

Laravel + PostgreSQL + FastAPI tetap local. Tunnel (ngrok/playit) mengekspos port 8080 ke publik dengan URL tetap (`https://xxx.ngrok.io`), sehingga Vercel dan Telegram bot bisa mengakses API.

---

## Opsi A: Static SPA (Rekomendasi) ✅

TanStack Start punya SPA mode bawaan: SSR dimatikan, build output hanya static files (HTML, JS, CSS). Cocok untuk Vercel — gratis, cepat, tanpa serverless function.

### A.1 Perubahan File

#### 1. `Frontend-stable/vite.config.ts`

Tambahkan SPA mode yang aktif hanya saat build di Vercel (Vercel set `process.env.VERCEL = '1'` otomatis):

```ts
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

function injectLeafletGlobalPlugin(): Plugin {
  return {
    name: "inject-leaflet-for-markercluster",
    transform(code: string, id: string) {
      if (id.includes("leaflet.markercluster") && id.endsWith(".js")) {
        return {
          code: `import L from 'leaflet';\n` + code,
          map: null,
        };
      }
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Detect build environment
// ────────────────────────────────────────────────────────────────────────────
const isVercel = process.env.VERCEL === "1";

export default defineConfig({
  // Nonaktifkan Cloudflare plugin di Vercel (konflik dengan SPA mode)
  cloudflare: !isVercel,

  tanstackStart: isVercel
    ? {
        // SPA mode — no SSR, static output for Vercel
        spa: { enabled: true },
      }
    : {
        // SSR for local dev
        server: { entry: "server" },
      },
  plugins: [
    injectLeafletGlobalPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      devOptions: { enabled: true },
      manifest: {
        name: "DeltaJalan - Sistem Pelaporan Kerusakan Jalan",
        short_name: "DeltaJalan",
        description: "Sistem pelaporan dan penanganan kerusakan jalan",
        theme_color: "#2563EB",
        background_color: "#FFFFFF",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "id",
        icons: [
          { src: "/logo.png", sizes: "248x247", type: "image/png" },
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/",
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
      },
    }),
  ],
  vite: {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: ["polite-socks-live.loca.lt"],
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
        "/storage": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["Access-Control-Allow-Origin"] = "*";
              proxyRes.headers["Cross-Origin-Resource-Policy"] = "cross-origin";
            });
          },
        },
      },
    },
  },
});
```

> **Apa yang berubah:** Baris `const isVercel = ...` + conditional `tanstackStart` + conditional `cloudflare`. Dev tetap SSR + Cloudflare plugin, Vercel build jadi SPA tanpa Cloudflare.

#### 2. `Frontend-stable/vercel.json`

Buat baru di root frontend:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/client",
  "installCommand": "npm install",
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache"
        }
      ]
    }
  ]
}
```

> **`rewrites`** — Semua request diarahkan ke `index.html` (SPA routing). Vercel serve static files *sebelum* rewrite, jadi file real (`/assets/*`, `/sw.js`) tetap dilayani. API calls ke tunnel tidak kena rewrite karena browser langsung panggil tunnel URL (`VITE_API_BASE_URL`).
>
> ⚠️ **Jangan pakai regex negative lookahead** seperti `"/((?!api/).*)"` — Vercel pakai `path-to-regexp` yang tidak support negative lookahead. `"/(.*)"` aman.
>
> **`outputDirectory`** — `dist/client` karena TanStack Start SPA mode output ke folder itu.

#### 3. `Frontend-stable/package.json` — Build script

TanStack Start SPA mode output `_shell.html` sebagai entry point, tapi Vercel perlu `index.html`. Tambah post-build step copy:

```json
"build": "vite build --config vite.config.sw.ts && vite build && node -e \"require('fs').copyFileSync('dist/client/_shell.html','dist/client/index.html')\""
```

Ini copy `_shell.html` → `index.html` setelah build selesai. Platform-independent (Windows/Linux/Mac).

#### 4. `backend_POSTGRESQL/routes/web.php` — Storage route

Hapus guard `environment('local')` agar route storage bisa diakses via tunnel:

```php
<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/storage/{path}', function (string $path) {
    $fullPath = storage_path('app/public/'.$path);

    if (! file_exists($fullPath)) {
        abort(404);
    }

    return response()->file($fullPath);
})->where('path', '.*');
```

> **Kenapa:** Di local development, route ini cuma jalan kalau `APP_ENV=local`. Saat diakses via tunnel, Laravel perlu menyajikan file tanpa symlink (karena PHP built-in server gak support symlink). Hapus guard `if (app()->environment('local'))`.

#### 5. `backend_POSTGRESQL/.env` — APP_URL

Ubah `APP_URL` ke URL tunnel agar `asset('storage/...')` menghasilkan URL yang benar:

```dotenv
APP_URL=https://your-tunnel-id.ngrok.io
APP_ENV=local
```

> **`APP_ENV=local`** tetap biarkan agar storage route jalan (setelah perubahan di web.php, ini tidak perlu, tapi aman).

#### 6. `backend_POSTGRESQL/config/cors.php` — sudah aman

CORS sudah `'allowed_origins' => ['*']`, jadi domain Vercel apapun bisa akses API. Tidak perlu perubahan.

---

### A.2 Persiapan Tunnel

Ekspos Laravel ke internet. Pilih salah satu:

#### Opsi 1: ngrok (gratis, 1 tunnel)

```bash
# Install: https://ngrok.com/download
ngrok http 8080
# Output: https://abc123.ngrok.io → localhost:8080
```

#### Opsi 2: playit (gratis, URL tetap)

```bash
# Download dari https://playit.gg
playit
# Setup port 8080, TCP
# Dapat URL: https://xxx.playit.gg
```

#### Opsi 3: Cloudflare Tunnel (gratis, perlu domain)

```bash
cloudflared tunnel create jalankita
cloudflared tunnel route dns jalankita api.jalankita.my.id
cloudflared tunnel run jalankita
```

> **Rekomendasi:** playit — paling simple, URL tetap, port forwarding TCP lancar.

### A.2.1 `.env.local` untuk Local Dev (Penting)

Setelah `APP_URL` diubah ke tunnel URL, local dev (`npm run dev`) akan memuat gambar dari tunnel (lambat). Buat file `backend_POSTGRESQL/.env.local` untuk override:

```dotenv
APP_URL=http://localhost:5173
```

Laravel prioritaskan `.env.local` di atas `.env` saat `APP_ENV=local`. Jadi local dev pake localhost, production (via tunnel) pake tunnel URL.

### A.3 Environment Variables di Vercel

Buka project settings di Vercel → Environment Variables → tambah:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://xxx.playit.gg/api` (URL tunnel + `/api`) |
| `VITE_SPA_MODE` | `true` (tidak wajib, hanya untuk deteksi di code) |

> **`VITE_API_BASE_URL`** dipakai di `src/lib/api.ts`. Nilainya **build-time embedded** — di-inject Vite saat `vite build`. Setelah deploy, kalau tunnel URL berubah, harus rebuild & redeploy.

### A.4 Deploy ke Vercel

#### Via Vercel CLI:

```bash
cd Frontend-stable
npm install -g vercel
vercel --prod
```

#### Via GitHub Integration (auto-deploy):

1. Push kode ke GitHub repo
2. Buka [vercel.com/new](https://vercel.com/new)
3. Import GitHub repo → pilih `Frontend-stable` sebagai root directory
4. Vercel auto-detect framework → pilih "Vite"
5. Set environment variables (VITE_API_BASE_URL)
6. Deploy

### A.5 Start Local Services

Setelah semua siap, jalankan ini di local:

```bash
# Terminal 1: Laravel API
cd backend_POSTGRESQL
php artisan serve --port=8080

# Terminal 2: Queue worker (untuk Telegram async)
php artisan queue:work

# Terminal 3: FastAPI AI (optional, hanya jika AI analysis diperlukan)
cd backend_AI
python server.py

# Terminal 4: Tunnel
playit  # atau ngrok http 8080
```

### A.6 Update Webhook Telegram

Setelah tunnel jalan, update webhook Telegram ke URL tunnel + `/telegram/webhook`:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://xxx.playit.gg/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

---

### A.7 Checklist Deploy

| # | Item | Status |
|---|---|---|
| 1 | Tunnel berjalan, URL tetap diketahui | ☐ |
| 2 | `vite.config.ts` — conditional SPA mode via `process.env.VERCEL` | ☐ |
| 3 | `vercel.json` — dibuat dengan `outputDirectory: "dist/client"` | ☐ |
| 4 | `routes/web.php` — guard `environment('local')` dihapus | ☐ |
| 5 | `.env` Laravel — `APP_URL` diisi URL tunnel | ☐ |
| 6 | Vercel env vars — `VITE_API_BASE_URL` diisi URL tunnel + `/api` | ☐ |
| 7 | Deploy frontend ke Vercel | ☐ |
| 8 | Coba akses Vercel URL, pastikan halaman login tampil | ☐ |
| 9 | Login via Vercel URL, pastikan API call berhasil | ☐ |
| 10 | Cek loading gambar dari storage (via tunnel) | ☐ |
| 11 | Update webhook Telegram ke tunnel URL | ☐ |
| 12 | Test Telegram bot via tunnel | ☐ |

---

## Opsi B: SSR dengan Nitro (Alternatif)

Jika ingin tetap SSR di Vercel, gunakan Nitro adapter.

### Perbedaan dengan Opsi A

| Aspek | Opsi A (SPA) | Opsi B (SSR Nitro) |
|---|---|---|
| Build output | `dist/client/` (static) | `.vercel/output/` (serverless) |
| Vercel function | None | Serverless function (cold start) |
| Harga Vercel | Gratis (static) | Usage-based (serverless) |
| SEO | Client-side | Server-side rendered |
| Kompleksitas | Rendah | Medium (Nitro + config) |

### Perubahan untuk Opsi B

#### 1. Install Nitro

```bash
cd Frontend-stable
npm install nitro
```

#### 2. `vite.config.ts`

Tambahkan plugin Nitro. Hati-hati: `@lovable.dev/vite-tanstack-config` sudah include Cloudflare plugin (build-only). Cloudflare dan Nitro mungkin konflik. Solusi: nonaktifkan Cloudflare untuk Vercel build.

```ts
import { nitro } from "nitro/vite";

const isVercel = process.env.VERCEL === "1";

export default defineConfig({
  cloudflare: !isVercel,  // aktifkan cloudflare hanya untuk non-Vercel
  tanstackStart: {
    // Nitro handle SSR di Vercel, tidak perlu SPA mode
    server: { entry: "server" },
  },
  plugins: [
    injectLeafletGlobalPlugin(),
    ...(isVercel ? [nitro()] : []),
    VitePWA({...}),
  ],
  vite: {
    server: {
      proxy: {...},
    },
  },
});
```

#### 3. `vercel.json`

```json
{
  "framework": "vitereact",
  "buildCommand": "npm run build",
  "installCommand": "npm install"
}
```

TanStack Start dengan Nitro output ke format Vercel serverless. Vercel auto-detect.

#### 4. Risiko

- `@lovable.dev/vite-tanstack-config` include Cloudflare plugin (build-only) — mungkin bentrok dengan Nitro
- Serverless function cold start (1-3 detik pertama)
- Build lebih lambat
- Perlu test compatibility

---

## Troubleshooting

### "Failed to load resource: net::ERR_CONNECTION_REFUSED" untuk API calls

**Penyebab:** Tunnel mati atau `VITE_API_BASE_URL` salah.

**Solusi:**
1. Cek tunnel masih jalan (`curl https://xxx.playit.gg/api/ping`)
2. `VITE_API_BASE_URL` harus rebuild — set di Vercel env vars, redeploy

### Gambar tidak muncul (403/404)

**Penyebab 1:** `routes/web.php` masih guard `environment('local')`. Laravel block akses `/storage/*`.

**Solusi:** Hapus guard `if (app()->environment('local'))` di `web.php`.

**Penyebab 2:** `APP_URL` di `.env` masih `localhost:5173`. `asset('storage/...')` generate URL localhost yang tidak bisa diakses dari Vercel.

**Solusi:** Set `APP_URL` ke URL tunnel, restart Laravel.

###  CORS error di browser

**Penyebab:** Vite proxy hanya jalan di dev (`npm run dev`). Di Vercel, tidak ada proxy.

**Solusi:** `config/cors.php` harus allow Vercel domain. Saat ini `'allowed_origins' => ['*']` sudah OK.

### Service Worker error di Vercel

**Penyebab:** SW file di-root tidak served dengan benar.

**Solusi:** `vercel.json` sudah include `headers` untuk `/sw.js` dengan `Cache-Control: no-cache`. Jika masih bermasalah, nonaktifkan SW di Vercel (hapus `VitePWA` plugin dari config untuk Vercel build).

### Webhook Telegram timeout

**Penyebab:** Tunnel lambat atau Laravel tidak respon.

**Solusi:**
1. Cek tunnel latency
2. Pastikan `php artisan serve` berjalan
3. Cek `php artisan queue:work` untuk async processing

---

## Appendix: File yang Diubah (Opsi A Summary)

| File | Perubahan |
|---|---|---|
| `Frontend-stable/vite.config.ts` | Tambah conditional `tanstackStart.spa.enabled` + `cloudflare: !isVercel` based on `process.env.VERCEL` |
| `Frontend-stable/vercel.json` | **NEW** — Vercel config (output dir, rewrites, headers) |
| `Frontend-stable/package.json` | Post-build step: `cp _shell.html → index.html` |
| `backend_POSTGRESQL/.env` | `APP_URL` → tunnel URL |
| `backend_POSTGRESQL/routes/web.php` | Hapus guard `environment('local')` di route storage |
| Vercel Dashboard | Add `VITE_API_BASE_URL` env var |

Tidak ada perubahan di:
- `src/lib/api.ts` — sudah handle `VITE_API_BASE_URL`
- `config/cors.php` — sudah allow `*`
- Models, Controllers — tidak perlu
- Service worker — tetap jalan
- `package.json` — opsional (bisa pakai existing build script)

---

## Rollback Plan

Jika deploy gagal atau ada masalah:

1. **Frontend:** `vercel rollback` ke production terakhir
2. **Laravel `.env`:** Kembalikan `APP_URL=http://localhost:5173`
3. **`routes/web.php`:** Kembalikan guard `environment('local')`
4. **`vite.config.ts`:** Hapus conditional SPA mode
5. **Hapus `vercel.json`**
6. Kembali ke development mode dengan `npm run dev` + Vite proxy
