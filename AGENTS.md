# AGENTS.md — DeltaJalan (JalanKita)

Road damage reporting app for Dinas PU Bina Marga Kab. Sidoarjo. Roles: `petugas`, `supervisor`, `admin`, `warga` (self-registers via `POST /auth/register`, never seeded).
`petugas_eksekusi` merged into `petugas`; UPR removed → `teams` (migration `2026_06_23_000007_remove_upr_and_merge_petugas_eksekusi_role`). No `GET /uprs`. (`User.php getRoleLabelAttribute` still maps `petugas_eksekusi` → display-only leftover, not an active role; don't re-add.)

## Layout

```
Frontend-stable/        React 19 + TanStack Start + Tailwind v4, Vite 7 (Capacitor webDir: dist/client)
backend_POSTGRESQL/     Laravel 13 REST API (PHP 8.3, Sanctum, PostgreSQL 16)
backend_AI/             FastAPI dev (server.py :8000) / Lambda prod (lambda/handler.py, onnxruntime — no PyTorch; requirements only in lambda/)
scripts/                deploy-laravel.sh (manual fallback), update-lambda.sh, deltajalan.nginx.conf, deltajalan-worker.conf,
                        start-*.sh / start-tunnel.ps1 (user-run dev/tunnel helpers — never run these)
android-native/         separate Kotlin app (same `com.jalankita.app`)
docker-compose.yml      PHP 8.3 + PostgreSQL 16 (Ubuntu Docker path; Windows uses native PHP)
```

3 independent services + native app, no workspaces. Ports: Vite `:5173` (proxies `/api` + `/storage` → `:8080`, see `vite.config.dev.ts`) → Laravel (`:8080` Docker, `php artisan serve --port=8080` natively per `README.md`) → FastAPI `:8000`; PG `:5432`. Prod API: `https://api.deltajalan.web.id` (Lightsail, PHP-FPM + PG16, Supervisor workers per `deltajalan-worker.conf`). Laravel forwards AI calls via `config('services.fastapi.url')` (`FASTAPI_URL` in backend `.env`, default `http://127.0.0.1:8000` — Docker Compose overrides to `http://host.docker.internal:8000`).

## Mandatory rules

- **Never** start dev servers (`php artisan serve`, `npm run dev`, `vite`, `composer run dev` — it launches 5 concurrent processes). User runs those.
- **Android builds are allowed by explicit user authorization**: the agent MAY run `gradlew` in `android-native/` (e.g. `./gradlew assembleDebug`) and `adb install` the resulting APK. (`android-native/README.md` still says agents are forbidden `gradlew` — stale, overridden by this authorization.) Capacitor builds (`build:mobile`, `npx cap`, `python build.py`) remain user-run. Native build needs `google-services.json` copied into `android-native/app/` (same file as the Capacitor copy); `LOCATIONIQ_KEY` comes from `local.properties` → `BuildConfig` (empty ⇒ tier skipped, build still works).
- **Device/emulator testing requires explicit per-session permission**: `adb` actions that *interact with a running device* — launching the app, `input` (tap/swipe/key/text), `am start`, wake/unlock, screenshots (`screencap`), logcat scraping, installing to a physical device — must NOT run until the user authorizes device testing for that session. Ask first, stating exact device + actions. `adb install` of a locally-built APK is covered by the build authorization above; everything beyond installing is not.
- **Never** run `migrate:fresh`, `migrate:reset`, `db:wipe`, or `DROP` — even if you think consent exists. Allowed without asking: `migrate`, `db:seed`, `cache:clear`, `config:clear`. New DB columns only via migration, never alter existing ones.
- **Never** commit/push unless user literally says "commit"/"push"/"commit dan push". Staging is fine.
- Commit messages in **Bahasa Indonesia**, `tipe: pesan singkat` (`fix:`, `feat:`, `refactor:` …).
- Before SSH to prod, present the exact command plan and get approval.
- Warn before any command expected to take 10s+.
- For library/framework code, resolve docs via Context7 MCP (`resolve-library-id` → `query-docs`) and cite sources.

## Pre-commit security check (no pre-commit hook in repo — do it manually)

1. `git status --short` — inspect every new/changed file.
2. Scan tracked files for tokens/keys/PEM (`grep`, not `rg` — `rg` may not be installed):
```bash
grep -rnE '[0-9]{8,10}:[A-Za-z0-9_-]{35}' --include='*.md' --include='*.php' --include='*.ts' --include='*.tsx' --include='*.sh' --include='*.yml' . | grep -v -e node_modules -e vendor -e '.git/' -e dist/ -e android/
grep -rnE '(LOCATIONIQ_KEY|_SECRET=|_TOKEN=|_KEY=|_PASSWORD=|PRIVATE_KEY)' --include='*.md' --include='*.php' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.sh' --include='*.yml' . | grep -v -e node_modules -e vendor -e '.git/' -e dist/ -e android/ -e '.env.example'
grep -rn '-----BEGIN' --include='*.md' --include='*.php' --include='*.ts' --include='*.json' --include='*.sh' --include='*.yml' . | grep -v -e node_modules -e vendor -e '.git/'
```
3. `docs/*.md` must contain only placeholders (`xxxxxxxx`/`[REDACTED]`), never live secrets.
4. `.env*`, `*.pem`, `*.key`, `opencode.json` are gitignored — must never appear in `git status`. If unsure about any file, STOP and ask.

## Commands

```bash
# Frontend (Frontend-stable/)
npm run lint | npm run format            # eslint / prettier --write .
npm run build                            # SW prebuild + Vite build (SPA on Vercel, SSR locally — see vite.config.ts)
npm run build:mobile                     # SW prebuild + build.py --build-only for Capacitor (user-run)

# Laravel (backend_POSTGRESQL/) — on Ubuntu Docker prefix artisan with `docker compose exec php` (container serves :8080)
composer run test                        # config:clear + phpunit, SQLite :memory: (phpunit.xml) — no Postgres needed
php artisan test --filter=NamaTest        # single test file/class
php vendor/bin/pint                      # PHP lint

# AI: dev `cd backend_AI && python server.py` (:8000); prod redeploy after handler.py changes:
bash scripts/update-lambda.sh [--skip-test]

# Backend deploy: CI `.github/workflows/deploy-backend.yml` (push main touching backend_POSTGRESQL/; self-hosted prod runner runs `deltajalan-deploy` + worker restart + php-fpm reload + `/api/app/version` verify).
# AI deploy: CI `.github/workflows/deploy-ai.yml` (push main touching backend_AI/lambda/**; builds ECR image → updates Lambda → health-checks Function URL).
# Fallback manual on server: `bash scripts/deploy-laravel.sh` (pull + install + migrate --force + cache + restart workers)
# `DEPLOY.md` is stale (old AWS EC2 + Cloudflare-tunnel plan) — do not follow it. `health-check.yml` sidoarjo.go.id URLs are stale — trust `deploy-backend.yml` verify endpoint.
```

## Gotchas that bite

- `VITE_API_BASE_URL` is baked at build time — changing `.env` alone does nothing; rebuild (`build:mobile`/Vercel).
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` — never add Vite plugins manually (header lists bundled ones). Four configs: `vite.config.ts` (main: SPA on Vercel, SSR locally), `.dev.ts`, `.capacitor.ts` (SPA), `.sw.ts` (prebuild); `build:mobile` = SW build + `build.py --build-only`, which patches `dist` HTML (splash CSS, error script) — don't bypass it.
- `src/routeTree.gen.ts` is auto-generated — do not edit.
- Tailwind v4 is CSS-only (`@import "tailwindcss"`); no `tailwind.config.*`.
- TanStack child routes (`foo.detail.tsx`) only mount if parent `foo.tsx` renders `<Outlet />`. List+detail pattern: `foo.tsx` layout + `foo/index.tsx` + `foo.detail.tsx`.
- No frontend test framework.
- Capacitor `com.jalankita.app`, `androidScheme: http`, `cleartext: true`. Custom `PhotoExifGps` plugin (`Frontend-stable/capacitor-exif-gps/`); `android/` is gitignored/generated (absent locally — verify registration on the machine that built it). Detect native by *calling* `isNativePlatform()` with `=== true` (canonical helper in `src/hooks/useLocationFromPhoto.ts`) — never a bare `window.Capacitor` presence check.
- Native photo pick may return `lat/lng: null` (DocumentsProvider, Android 14+) — GPS fallback chain in `useLocationFromPhoto.ts`: native `PhotoExifGps.pickPhotos()` → JS `exifr.gps(file)` → server `readExifGpsFromServer(file)` (PHP PEL) → browser geolocation.
- Reverse geocoding 5-tier chain (`useLocationFromPhoto.ts`): Nominatim → LocationIQ → OSRM nearest → Overpass → Wilayah-id. Duplicated in Android `core/util/ReverseGeocoder.kt` — keep both in sync. Road-name autocomplete is `useRoadSearch.ts` (LocationIQ, Sidoarjo viewbox filter); API tolerates manual input, supervisor reviews.
- All `map.fitBounds(...)` calls need `{ animate: false }` — zoom animation races unmount and crashes.
- `resolveImageUrl()` (`src/lib/imageUrl.ts`) prepends API origin for `/storage/...` paths. Don't "fix" cross-origin `<img>` — only ngrok HTML warnings triggered ORB, not prod.
- Telegram webhook is `POST /telegram/webhook` in `routes/web.php` (no `/api` prefix), CSRF-exempt in `bootstrap/app.php`.
- Trust score is OFF — code kept behind `// ── TRUST SCORE [NONAKTIF] ──` markers. Don't re-add trust fields to responses.
- Upload rules (backend-enforced): EXIF date ≤2 days (`ReportController::MAX_PHOTO_AGE_DAYS`, `config('app.max_photo_age_days')` default 2) for petugas, **≤7 days for warga** (`WargaReportController::MAX_PHOTO_AGE_DAYS`, Telegram, web, native — deliberate exception, keep in sync); else reject (single)/skip file (batch); SHA-256 image dedup silently skips; per-photo GPS EXIF with form-coordinate fallback; coordinates validated inside Sidoarjo (`isInSidoarjo` / `sidoarjoBounds`).
- Photos live on disk (`storage/app/public/`), never base64 in DB. UI icons are Material Symbols, never emoji.
- PostgreSQL: no `DB::raw` counters inside `updateOrCreate` (column refs illegal in `VALUES`). Use `lockForUpdate()` + `increment()`, else `create([... 'count' => 1])` in a transaction.
- Lambda has no PyTorch (onnxruntime only); rebuild via `update-lambda.sh` (or CI) after any `handler.py` change.

## References (read, don't duplicate)

- Test accounts + password (`password123`): `docs/akun-testing.md`. Full route list: `backend_POSTGRESQL/routes/api.php`.
- Landing-page style: `DESIGN.md` (Civic Precision tokens + Anti-Slop rules).
- Native Android plan: `docs/rencana-native-android.md`; `android-native/README.md` for build (gradlew ban there is stale — this file authorizes agent builds; Capacitor path stays user-run).
- `README.md` is stale on roles (still lists `petugas_eksekusi`/UPR) and EXIF age (says 7 days; code enforces `max_photo_age_days`, default 2) — trust code + this file.
