# AGENTS.md — DeltaJalan (JalanKita)

Internal road damage reporting app for Dinas PU Bina Marga Kabupaten Sidoarjo. 3 roles: `petugas`, `petugas_eksekusi`, `supervisor`.

## Architecture

```
Frontend-stable/          React 19 + TanStack Start SSR + Tailwind v4, Vite 7
backend_POSTGRESQL/       Laravel 13 REST API (PHP 8.3, Sanctum, PostgreSQL)
  ├─ Dockerfile            PHP 8.3 container build (Ubuntu Docker)
backend_AI/               FastAPI dev / Lambda production (4 damage classes)
scripts/                  Dev/tunnel scripts
  ├─ start-tunnel.ps1         Windows (PowerShell)
  ├─ start-android.sh         Linux native PHP
  ├─ start-dev-with-ngrok.sh  Linux native PHP
  ├─ start-ubuntu.sh          Ubuntu Docker (new)
  └─ start-dev-ubuntu.sh      Ubuntu Docker dev helper (new)
docker-compose.yml        PHP 8.3 + PostgreSQL 16 containers (Ubuntu Docker)
```

Production server (AWS Lightsail Ubuntu 24.04):
  IP: 47.131.39.245
  API: https://api.deltajalan.web.id (Let's Encrypt SSL)
  Nginx (worker_processes auto) + PHP 8.3 FPM + PostgreSQL 16
  Supervisor: 3 queue workers
  Backup harian (7 hari retensi)
  UFW: port 22, 80, 443

Frontend `VITE_API_BASE_URL` langsung ke production API (`https://api.deltajalan.web.id/api`). Gambar (storage) diproses via `resolveImageUrl()` yang prepend API origin. Laravel forwards AI requests ke Lambda Function URL.

**Dual boot note**: Ubuntu uses Docker for PHP+PostgreSQL; Windows uses native PHP.
Scripts & `.env` are OS-specific — no cross-contamination.

## Mandatory rules

- **Never** run `php artisan serve`, `npm run dev`, `vite`, or any dev server. User handles startup.
- **Never** run `build:mobile`, `npx cap`, `python build.py`, `gradlew`, or any Android build. User runs `bash scripts/start-android.sh` or `bash scripts/start-ubuntu.sh` exclusively.
- **Never** run `migrate:fresh`, `migrate:reset`, `db:wipe`, or `DROP` without asking. Allowed: `migrate`, `db:seed`, `cache:clear`, `config:clear`.
- **Never** run `migrate:fresh`, `migrate:reset`, `db:wipe`, or `DROP` even if you think you have user consent — always wait for the user to explicitly type the command before proceeding.
- **Never** commit or push unless the user explicitly says "commit", "push", or "commit dan push". You may stage files.
- **Production SSH key**: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA8xwr8n4igJxAtnDakuFYbfePqVKqzhOatluUhPhlWy deploy@deltajalan.web.id` (terdaftar di GitHub → BangkitHaqiAliaffuan)
- Before any 10s+ command, warn the user with estimated duration.
- Before writing code involving any library/framework, use Context7 MCP (`resolve-library-id` → `query-docs`) and cite sources. See "Context7" section below.

## Dev commands

```bash
# Frontend (Frontend-stable/)
npm install && npm run dev           # Vite on :5173
npm run lint                         # eslint
npm run format                       # prettier --write .
npm run build                        # SSR production build
npm run build:mobile                 # SPA build for Capacitor (python build.py)

# Laravel (backend_POSTGRESQL/)
composer install && php artisan serve --port=8080
composer run dev                     # artisan :8080 + queue + logs + Vite (concurrently)
composer run test                    # php artisan config:clear && php artisan test
php vendor/bin/pint                  # Laravel Pint (PHP lint)

# AI server (backend_AI/) — production via Lambda
cd backend_AI && pip install -r requirements.txt && python server.py  # :8000 (development only)

# Lambda AI — rebuild & deploy after handler.py changes
# FASTAPI_URL di .env sudah指向 Lambda — rebuild jika handler.py diubah
bash scripts/update-lambda.sh               # build + push + update + test
bash scripts/update-lambda.sh --skip-test   # build + push + update only

# Deploy Laravel (via SSH di server)
bash scripts/deploy-laravel.sh              # pull + migrate + cache + restart worker
bash scripts/deploy-laravel.sh --force       # skip konfirmasi

# All stacked (Linux native)
bash scripts/start-android.sh                       # Laravel + ngrok + .env update
bash scripts/start-android.sh --rebuild              # + rebuild Capacitor APK
bash scripts/start-dev-with-ngrok.sh --ngrok         # desktop dev + tunnel

# Ubuntu (Docker) — pakai jika PHP 8.3 tidak tersedia native
bash scripts/start-ubuntu.sh                        # Docker PHP + PostgreSQL + ngrok
bash scripts/start-ubuntu.sh --rebuild               # + rebuild Capacitor APK
bash scripts/start-dev-ubuntu.sh                    # desktop dev (FastAPI + Vite)
bash scripts/start-dev-ubuntu.sh --ngrok             # + ngrok tunnel to Vite
docker compose exec php php artisan {command}        # artisan via Docker
docker compose logs php                              # Laravel logs
docker compose exec php composer {command}           # composer via Docker
```

## Production server (AWS Lightsail)

| Item | Value |
|---|---|
| IP | `47.131.39.245` |
| Domain | `api.deltajalan.web.id` |
| SSL | Let's Encrypt (exp: 10 Okt 2026, auto-renew via systemd timer) |
| OS | Ubuntu 24.04 LTS |
| PHP | 8.3.6 (FPM, pm.dynamic, max_children=12) |
| PostgreSQL | 16 (shared_buffers=256MB, effective_cache_size=768MB) |
| Queue | Supervisor 3 workers (`jalankita-worker:0-2`) |
| Backup | Harian 03:00 UTC, retensi 7 hari |
| Firewall | UFW: 22, 80, 443 only |

### Deployment file configs

- `scripts/deltajalan.nginx.conf` — Nginx site config
- `scripts/deltajalan-worker.conf` — Supervisor queue workers
- `scripts/backup-jalankita` — Backup script
- `scripts/logrotate-jalankita` — Log rotation

### Services

| Service | URL |
|---|---|
| API (Laravel) | `https://api.deltajalan.web.id` |
| Frontend (Vercel) | `https://delta-jalan.vercel.app` |
| AI Detection (Lambda) | Via `.env.FASTAPI_URL` (AWS Lambda URL) |

### Telegram Bot

Webhook endpoint: `POST /telegram/webhook` (no `/api` prefix) — di `routes/web.php`.
Dikecualikan dari CSRF via `$middleware->validateCsrfTokens()` di `bootstrap/app.php`.
Set webhook via:
```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://api.deltajalan.web.id/telegram/webhook" \
  -d "secret_token=jalankita-telegram-2026"
```

## AI Detection (Lambda)

Laravel delegates AI inference (damage class + severity + quality check) to an AWS Lambda function URL via `config('services.fastapi.url')`.

### Architecture

```
backend_AI/lambda/
  Dockerfile              FROM public.ecr.aws/lambda/python:3.12
  handler.py              Lambda entry point (onnxruntime, no PyTorch)
  requirements.txt        4 deps: onnxruntime, opencv-python-headless, numpy, Pillow
  models/
    best.onnx              ~2.9 MB — main detection model
    best_stable.onnx       ~11 MB  — ensemble model (WBF)

GitHub Actions CI         deploy-ai.yml → push main → build + push to ECR → update Lambda
```

### Key facts

- **No PyTorch / ultralytics** on Lambda — uses raw `onnxruntime` for cold start < 150 MB image
- **WBF ensemble** — merges output from both ONNX models via Weighted Box Fusion
- **No MobileCLIP relevance guard** — too heavy for Lambda, hardcoded `relevant: true`
- **Cold start**: ~3-6 detik (memuat 2 model ONNX)
- **Warm invoke**: ~1-3 detik
- **Payload limit**: 6 MB (Lambda Function URL default)
- **Timeout**: 15 detik (default Lambda container timeout)

### Dev vs Production

| Environment | Implementasi | Cara deploy |
|---|---|---|
| **Development** | `backend_AI/server.py` (FastAPI, port 8000) | `python server.py` manual |
| **Production** | `backend_AI/lambda/handler.py` (Lambda Function URL) | `bash scripts/update-lambda.sh` |

### Rebuild & deploy

```bash
bash scripts/update-lambda.sh               # build + push + update + test
bash scripts/update-lambda.sh --skip-test   # build + push + update only
```

Triggered via `FASTAPI_URL` in `.env`:
```
FASTAPI_URL=https://sxhryovsbl4g6kbsvageizvane0tiqat.lambda-url.ap-southeast-1.on.aws
```

## Key structural facts

- **`vite.config.ts`** uses `@lovable.dev/vite-tanstack-config` — do NOT add Vite plugins manually (TanStack Start, React, Tailwind already bundled).
- **`routeTree.gen.ts`** is auto-generated by TanStack Router — do not edit.
- **Tailwind v4** is CSS-only (`@import "tailwindcss"` in `src/styles.css`) — no `tailwind.config.*` or `postcss.config.*`.
- **3 independent services**, each with its own deps and build system. No npm workspaces, no Turborepo.
- **AI detection in production uses AWS Lambda** (ONNX runtime via Lambda Function URL), not FastAPI dev server.
- **Capacitor config**: app ID `com.jalankita.app`, `androidScheme: "http"`, `cleartext: true`.
- **Laravel tests** use SQLite `:memory:` (see `phpunit.xml`).
- **`build.py`** handles SPA build + HTML patching (splash CSS, error script) for Capacitor. Run `python build.py --build-only` after code changes.
- **No frontend test framework** is configured.
- **CI/CD workflows** exist under `.github/workflows/` — deploy-backend (SSH), deploy-ai (ECR + Lambda), health-check (cron).
- **Always add new DB columns via migration** — never modify existing columns or tables.
- **Store photos on disk** (`storage/app/public/`) — never base64 in DB.
- **Never use emoji as UI labels/icons** — always use the `<Icon>` component with Material icon names instead of emoji characters.

### Login test accounts

| Role | Name | Email | Team |
|---|---|---|---|
| `petugas` | Agus Setiawan | agus.setiawan@dispu.binamarga.go.id | Tim Satgas Utara |
| `petugas` | Rizky Firmansyah | rizky.firmansyah@dispu.binamarga.go.id | Tim Satgas Pusat |
| `petugas` | Dewi Rahayu | dewi.rahayu@dispu.binamarga.go.id | Tim Satgas Barat |
| `petugas` | Bambang Eko | bambang.eko@dispu.binamarga.go.id | Tim Satgas Selatan |
| `petugas` | Dodi Kurniawan | dodi.kurniawan@dispu.binamarga.go.id | Tim Satgas Timur |
| `supervisor` | Budi Santoso | budi.santoso@dispu.binamarga.go.id | — |
| `supervisor` | Siti Marlina | siti.marlina@dispu.binamarga.go.id | — |
| `supervisor` | Hendra Kusuma | hendra.kusuma@dispu.binamarga.go.id | — |
| `supervisor` | Fajar Nugroho | fajar.nugroho@dispu.binamarga.go.id | — |
| `admin` | Admin Utama | admin@dispu.binamarga.go.id | — |

Password for all: `password123`

## VITE_API_BASE_URL is build-time embedded

`VITE_API_BASE_URL` is baked into the JS bundle at build time. Changing `.env` alone does NOT update a running app. After changing `.env`, rebuild: `npm run build:mobile`.

## TanStack Router gotchas

### Child routes require `<Outlet />` in parent
`foo.detail.tsx` (dot notation) creates a **child route** of `foo.tsx`. For the child to render, `foo.tsx` MUST have `<Outlet />`. Without it, navigating to `/foo/detail` renders only the parent component — the child never mounts.

### Index route pattern for list + detail
A page with a list view and a detail sub-view needs 3 files:
```
routes/supervisor/
  foo.tsx               ← layout: <PageLayout><Outlet /></PageLayout>
  foo/
    index.tsx           ← index route (list page)
  foo.detail.tsx        ← child route (detail page, no PageLayout — parent provides it)
```
The index route (`foo/index.tsx`) renders when the URL exactly matches `/foo`; child routes like `/foo/detail` render when their path matches inside the parent's `<Outlet />`.

## Non-obvious conventions

- **Trust score is NONAKTIF** — see `docs/reactivate-trust-score.md` to re-enable. All code preserved with `// ── TRUST SCORE [NONAKTIF] ──` markers.
- **Batch upload**: each sub-report gets its own GPS EXIF coordinate if available, falls back to form coordinate.
- **EXIF date validation**: photos >2 days old or future-dated are rejected (single) or skipped per-file (batch).
- **Image dedup**: SHA-256 hash on file content. Duplicates silently skipped.
- **Road name**: must be selected from autocomplete (LocationIQ). API still accepts manual input but supervisor can review mismatches.
- **Coordinate boundary**: all coordinates validated within Sidoarjo / Indonesia bounds.
- **`auth.ts`** stores token + user in `localStorage` (known XSS risk, not mitigated).
- **`solution.md`** is the original implementation spec — do not delete.
- **`SECURITY_ANALYSIS.md`** documents known vs fixed security issues.

## Capacitor plugin gotchas

### Register custom plugins in `MainActivity.java`
Local `file:` dependencies (`@jalankita/capacitor-exif-gps`) are not auto-discovered by Capacitor's annotation scanner. Always register explicitly:
```java
registerPlugin(PhotoExifGpsPlugin.class);
// Call before super.onCreate()
```

### `isNativePlatform()` required
`typeof window.Capacitor !== 'undefined'` is `true` even in browser (side effect of `@capacitor/core` import). Always use:
```ts
window.Capacitor.isNativePlatform?.() === true
```

### Native batch upload needs JS `readExifGps` fallback
`PhotoExifGps.pickPhotos()` returns `lat: null, lng: null` for DocumentsProvider URIs on Android 14+. Mirror the web batch fallback:
```ts
(r.lat != null && r.lng != null)
  ? Promise.resolve({ latitude: r.lat, longitude: r.lng })
  : readExifGps(r.file)
```

### Check ALL permission aliases
`ACCESS_MEDIA_LOCATION` is auto-granted (normal permission) but `READ_MEDIA_IMAGES` requires a dialog. Check both:
```java
getPermissionState("accessMediaLocation") == GRANTED
&& getPermissionState("readMediaImages") == GRANTED
```

### Process `getData()` AND `getClipData()`
They are not mutually exclusive. Both may contain URIs (with overlap). Process independently with dedup.

## Leaflet fitBounds race condition
Conditionally-rendered Leaflet maps that use `fitBounds` can crash on unmount during CSS zoom animation. Always pass `animate: false`:
```ts
map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16, animate: false });
```

## API key endpoints

| Endpoint | Notes |
|---|---|
| `POST /auth/login` | Public, throttled 10/min |
| `POST /reports` | Single report |
| `POST /reports/batch` | Batch (main + sub-reports) |
| `POST /analyze` | Single photo AI (forward to FastAPI) |
| `POST /analyze-batch` | Batch AI (max 20 photos) |
| `GET /v1/reports/check-duplicate` | Public, spatial (15m) + textual dedup |
| `POST /reports/{id}/mulai` | Assign UPR + start work |
| `POST /reports/{id}/complete` | Requires `after_photo` |
| `GET /uprs` | List active UPR/satgas |

## Detection

4 damage classes: Lubang, Retak Kulit Buaya, Retak Memanjang, Retak Melintang. Severity levels: Baik, Rusak Ringan, Rusak Sedang, Rusak Berat.

## AWS Production Mode (Juli 2026)

Frontend local dev (`npm run dev`) sekarang langsung menggunakan API production AWS, tanpa Laravel lokal:

| Service | URL |
|---|---|
| API (Laravel) | `https://api.deltajalan.web.id/api` |
| AI Detection | Lambda Function URL (via `config('services.fastapi.url')`) |
| Storage | `https://api.deltajalan.web.id/storage/...` |

### Implikasi

- **Tidak perlu** `php artisan serve` atau Laravel lokal — semua API via production
- **Vite proxy** (`/api/*` → localhost:8080) tidak terpakai karena `VITE_API_BASE_URL` absolute
- **`resolveImageUrl()`**: semua relative path (`/storage/...`) otomatis prepend `https://api.deltajalan.web.id` — di browser maupun native
- **Aman dari ORB**: `api.deltajalan.web.id` return JPEG asli (bukan HTML warning seperti ngrok), jadi `<img>` cross-origin tidak masalah
- **Rebuild required** setelah ganti `.env`: `npm run build:mobile`

## Cross-origin image gotcha (`ERR_BLOCKED_BY_ORB`)

Images can silently fail when `VITE_API_BASE_URL` is set to an absolute ngrok URL.

### The bug chain

1. `.env` has `VITE_API_BASE_URL=https://magnetize...ngrok-free.dev/api`
2. `resolveImageUrl()` in `src/lib/imageUrl.ts` converts relative `/storage/...` → `https://magnetize.../storage/...`
3. Page is at `http://localhost:5173` but image loads from `https://magnetize...` → **cross-origin**
4. `<img>` uses "no-cors" mode by default → response is **opaque**
5. Ngrok returns its HTML browser-warning page instead of the image
6. Chrome's ORB sees HTML for an image request → `net::ERR_BLOCKED_BY_ORB`

### Sekarang: aman prepend API origin bahkan di browser

Sebelumnya `resolveImageUrl()` hanya prepend API origin untuk native (Capacitor). Sekarang, karena `VITE_API_BASE_URL` adalah production domain (`api.deltajalan.web.id`), **browser juga prepend**:

```ts
catch {
  // Relative URL → prepend API origin (browser maupun native)
  const apiOrigin = getApiOrigin();
  if (apiOrigin) {
    const sep = url.startsWith("/") ? "" : "/";
    return `${apiOrigin}${sep}${url}`;
  }
  return url;
}
```

Ini aman karena `api.deltajalan.web.id` return JPEG asli dengan `Content-Type: image/jpeg` — browser tidak akan memblokirnya (tidak seperti ngrok yang return HTML → ORB). `<img>` tag cross-origin tidak butuh CORS untuk display.

Jika `VITE_API_BASE_URL` adalah path relatif (`/api`), `getApiOrigin()` return `""` dan relative path tetap dipertahankan (Vite proxy handle).

### `useBlobImage` re-render cancels in-flight `<img>` requests

In `src/hooks/useBlobImage.ts`, the browser branch called `setBlobUrl(src)` inside a `useEffect`, triggering an unnecessary re-render that cancelled in-flight `<img>` requests. Fix: skip all state management for `!isNative`:

```ts
useEffect(() => {
  if (!isNative) return;  // ← browser: return src directly, no state needed
  ...
}, [src]);
```

The hook already returns `src` directly for browser (line `if (!isNative) return src;`), so `setBlobUrl` was a no-op re-render that cancelled image requests.

## Context7 MCP

Available as a remote MCP server in `opencode.json`. Use these tools for library/framework documentation instead of relying on training data:

| Tool | Usage |
|---|---|
| `resolve-library-id` | Search for a library name to get a Context7-compatible ID (e.g. `/reactjs/react.dev`, `/vercel/next.js`) |
| `query-docs` | Fetch documentation for a specific library ID + question |

**Workflow**: Always call `resolve-library-id` first to get the exact ID, then `query-docs` with that ID. Call `query-docs` max 3x per question. Source: https://context7.com/docs/clients/opencode

## RTK (Rust Token Killer)

RTK v0.43.0 is installed as an OpenCode plugin. It transparently compresses bash command outputs (git, npm, ls, cargo, etc.) by 60-90% before they reach context.

- **Plugin**: `~/.config/opencode/plugins/rtk.ts` — auto-rewrites bash commands
- **Binary**: `~/.local/bin/rtk` — add to PATH via `export PATH="$HOME/.local/bin:$PATH"`
- **Check savings**: `rtk gain` or `rtk gain --history`
- **Config**: `~/.config/rtk/config.toml`

Works on both Linux (native hook) and Windows (CLAUDE.md fallback). Source: https://www.rtk-ai.app/
