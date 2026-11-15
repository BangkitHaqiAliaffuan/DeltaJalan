# AGENTS.md — DeltaJalan (JalanKita)

Road damage reporting app for Dinas PU Bina Marga Kab. Sidoarjo. Roles: `petugas`, `supervisor`, `admin`, `warga` (self-registers via `POST /auth/register` or Google onboarding — **never seeded**, so there is no warga test account in `docs/akun-testing.md`).
`petugas_eksekusi` merged into `petugas`; UPR removed → `teams` (migration `2026_06_23_000007_remove_upr_and_merge_petugas_eksekusi_role`). Teams belong to a `uptd`; supervisors are mapped to UPTDs via `supervisor_uptd`, and reports carry `assigned_team_id`/`assigned_supervisor_id`. No `GET /uprs` (UPTD is only reachable via `teams` → `->with('uptd')`). (`User.php getRoleLabelAttribute` still maps `petugas_eksekusi` → display-only leftover, not an active role; don't re-add.)

## Layout

```
Frontend-stable/        React 19 + TanStack Start + Tailwind v4, Vite 7 (Capacitor webDir: dist/client)
backend_POSTGRESQL/     Laravel 13 REST API (PHP 8.3, Sanctum, PostgreSQL 16)
backend_AI/             FastAPI dev (server.py :8000, ultralytics + optional MobileCLIP2 guard) / Lambda prod
                        (lambda/handler.py, onnxruntime — no PyTorch; models on /opt, MobileCLIP from S3)
scripts/                deploy-laravel.sh (manual fallback), update-lambda.sh, deltajalan.nginx.conf, deltajalan-worker.conf,
                        build-install-android.sh (native APK build+verify+install), start-android.sh (Capacitor APK — user-run),
                        start-*.sh / start-tunnel.ps1 (user-run dev/tunnel helpers — never run these)
android-native/         separate Kotlin/Compose app (same `com.jalankita.app`, Hilt + MapLibre + Firebase Auth)
docker-compose.yml      PHP 8.3 + PostgreSQL 16 (Ubuntu Docker path; Windows uses native PHP)
```

3 independent services + native app, no workspaces. Ports: Vite `:5173` (proxies `/api` + `/storage` → `:8080`, see `vite.config.dev.ts`) → Laravel (`:8080` Docker, `php artisan serve --port=8080` natively per `README.md`) → FastAPI `:8000`; PG `:5432`. Prod API: `https://api.deltajalan.web.id` (Lightsail, PHP-FPM + PG16, Supervisor workers per `deltajalan-worker.conf`). Laravel forwards AI calls via `config('services.fastapi.url')` (`FASTAPI_URL` in backend `.env`, default `http://127.0.0.1:8000` — Docker Compose overrides to `http://host.docker.internal:8000`).

## Mandatory rules

- **Bahasa komunikasi agen:** selalu gunakan Bahasa Indonesia dalam laporan, status, pertanyaan, dan penjelasan kepada pengguna. Jangan gunakan Bahasa Rusia atau bahasa lain kecuali pengguna memintanya secara eksplisit.
- **Never** start dev servers (`php artisan serve`, `npm run dev`, `vite`, `composer run dev` — it launches 5 concurrent processes). User runs those.
- **Android builds are allowed by explicit user authorization**: the agent MAY run `gradlew` in `android-native/` (e.g. `./gradlew assembleDebug`; APK at `android-native/app/build/outputs/apk/debug/app-debug.apk`) and `adb install` that APK. (`android-native/README.md` still says agents are forbidden `gradlew` — stale, overridden by this authorization.) Capacitor builds (`build:mobile`, `npx cap`, `python build.py`, `scripts/start-android.sh`) remain user-run. Native build needs `google-services.json` copied into `android-native/app/` (same file as the Capacitor copy); `LOCATIONIQ_KEY` comes from `local.properties` → `BuildConfig` (empty ⇒ tier skipped, build still works).
- **Device/emulator testing requires explicit per-session permission**: after install, any `adb` action that *interacts with a running app/device* — launching, `input` (tap/swipe/key/text), `am start`, wake/unlock, `screencap`, logcat scraping, `connectedDebugAndroidTest` — needs per-session approval. Ask first with exact device + actions. (`adb install` of a locally-built APK is allowed under the build authorization above; `scripts/build-install-android.sh` does build+verify+install but **not** launch unless you pass `--launch`.)
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
4. `.env*`, `*.pem`, `*.key`, `opencode.json`, `android-native/app/google-services.json`, `android-native/local.properties` are gitignored — must never appear in `git status`. If unsure about any file, STOP and ask.

## Commands

```bash
# Frontend (Frontend-stable/)
npm run lint                             # eslint
npm run format                           # prettier --write .
npm run build                            # SW prebuild + Vite build (SPA on Vercel, SSR locally — see vite.config.ts)
npm run build:mobile                     # SW prebuild + build.py --build-only for Capacitor (user-run)
# No frontend test/typecheck script; `vite build` does NOT typecheck (use `npx tsc --noEmit` manually if needed).

# Laravel (backend_POSTGRESQL/) — on Ubuntu Docker prefix artisan with `docker compose exec php` (container serves :8080)
composer run test                        # config:clear + phpunit, SQLite :memory: (phpunit.xml) — no Postgres needed
php artisan test --filter=NamaTest        # single test class/file
php vendor/bin/pint                      # PHP lint
# Tests use SQLite, so PostgreSQL-only SQL/constraint errors can pass locally and fail in prod.

# Android native (build allowed; APK path above)
cd android-native && ./gradlew assembleDebug
bash scripts/build-install-android.sh    # build + verify signature/metadata + adb install (--build-only/--install-only/--launch/--serial/--clean)
# Tests are instrumented only (`app/src/androidTest`); `connectedDebugAndroidTest` needs device permission.

# AI dev: `cd backend_AI && python server.py` (:8000). No root requirements.txt — install
#   fastapi ultralytics pillow python-multipart uvicorn opencv-python
#   (MobileCLIP guard optional: open_clip + torch + timm; absent ⇒ pass-through).
#   Sample fixtures for the pipeline live in `Image For Testing/{original,fresh,detected,analyze}` at repo root.
# Prod after handler.py changes (default self-test image is gitignored/absent → `--skip-test`):
bash scripts/update-lambda.sh            # or `--skip-test`

# Backend deploy: CI `.github/workflows/deploy-backend.yml` (push main touching backend_POSTGRESQL/; self-hosted prod runner runs `deltajalan-deploy` + worker restart + php-fpm reload + `/api/app/version` verify).
# AI deploy: CI `.github/workflows/deploy-ai.yml` (push main touching backend_AI/lambda/**; builds ECR image → updates Lambda → health-checks Function URL).
# Fallback manual on server: `bash scripts/deploy-laravel.sh` (pull + install + migrate --force + cache + restart workers)
# APK upload: `bash scripts/deploy-apk.sh [path]` (SSH to prod — get approval). Its default path is the old Capacitor APK;
# pass `android-native/app/build/outputs/apk/debug/app-debug.apk` explicitly for the native app.
# `DEPLOY.md` is stale (old AWS EC2 + Cloudflare-tunnel plan) — do not follow it. `health-check.yml` sidoarjo.go.id URLs are stale — trust `deploy-backend.yml` verify endpoint.
```

## Pendaftaran warga & OTP email

- **Akun warga baru lewat daftar manual wajib verifikasi OTP 6 digit** ke emailnya. Akun **tidak** dibuat di langkah 1; baris `users` lahir di `POST /api/auth/register/verify`, yang juga menerbitkan token Sanctum (langsung login, tanpa kembali ke layar Login). Jalur **Google tidak memakai OTP** — klaim `email_verified` Firebase sudah membuktikan kepemilikan email.
- Pembuatan baris warga (manual OTP & Google) ada di **satu tempat**: `App\Services\WargaRegistrationService::create()` — cek email `LOWER()`/phone diulang dalam `DB::transaction` + `lockForUpdate()`, idempotensi `firebase_uid`, dan `email_verified_at` diisi. Jangan duplikasi aturan ini di controller.
- Rute: `POST /api/auth/register` (validasi + kirim OTP, **tanpa** buat user) → `200 {needs_verification:true, registration_token, email}`; `POST /api/auth/register/verify` (`{registration_token, code}`) → `200 {token, user}` **bentuk sama dengan `login()`**; `POST /api/auth/register/resend` (`{registration_token}`) mengirim ulang tanpa mengubah token. Ketiganya `throttle:10,1`.
- Challenge di **Cache**, bukan tabel/migrasi (`App\Services\RegistrationOtpService`): key `registration:<sha256(token)>`, TTL 15 menit, `Str::random(64)` untuk token. Password masuk cache **sudah** `Hash::make`; kode disimpan sebagai HMAC-SHA256 `APP_KEY` dan dibandingkan `hash_equals()`. `cache:clear` membunuh challenge yang sedang berjalan (sama seperti `google_onboarding`).
- `error_code`: `OTP_INVALID` (422), `OTP_EXPIRED` (422), `OTP_ATTEMPTS_EXCEEDED` (429), `OTP_RESEND_COOLDOWN` (429), `OTP_SEND_LIMIT` (429), `EMAIL_SEND_FAILED` (503), `MAIL_NOT_CONFIGURED` (503), `REGISTRATION_CONFLICT` (422 — email/phone diklaim orang lain antara langkah 1 dan 2; dicek ulang dalam `DB::transaction` + `lockForUpdate()`).
- Email dikirim **inline** (`Mail::to()->send()`, bukan `ShouldQueue`) — `QUEUE_CONNECTION=database` tanpa `queue:work` berarti OTP tidak akan pernah terkirim. Gagal kirim → challenge dibuang (`discard` di `finally` controller), bukan token hidup tanpa kode. Angka-angka di `config/registration.php` (`REGISTRATION_OTP_*`).
- **Produksi wajib `MAIL_MAILER=smtp`** — default `log` hanya menulis kode ke `storage/logs/laravel.log`. `AuthController::sendOtpOrFail` menolak `503 MAIL_NOT_CONFIGURED` bila `APP_ENV=production` + `mail.default=log` (gagal keras, bukan 200 palsu). Prasyarat go-live, bukan opsional.
- `User` cast `'password' => 'hashed'` **idempoten** (`Hash::isHashed` mendeteksi bcrypt) — hash dari cache tidak di-hash dua kali. Jalur buat user memakai `forceFill`, bukan mass-assign.
- `App\Support\WargaAccountGuard` (aturan `GOOGLE_WARGA_ONLY`/`ACCOUNT_BANNED`/`FIREBASE_UID_CONFLICT`/`PHONE_ALREADY_SET`) + `App\Support\ApiError` (`{success:false, message, error_code}`) dipakai bersama jalur Google dan jalur OTP — **satu tempat**, jangan duplikasi aturannya.
- `UserPayload` mengirim `email_verified` (`email_verified_at != null`) dan `needs_phone`.
- **Sengaja tanpa OTP:** `WargaReportController::storePublic` dan Telegram membuat baris warga dengan email sintetis + password acak 32 karakter (tidak bisa login). Memaksa OTP di sana akan mematikan pelaporan anonim.
- **Web sudah mendukung alur ini**: `Frontend-stable/src/routes/daftar.tsx` = form → langkah OTP inline (tanpa route baru, token tidak masuk URL) → `saveAuth` → `/warga`; helper `verifyRegistration`/`resendRegistration` di `src/lib/auth.ts`. Jangan pernah menampilkan "Registrasi berhasil" sebelum `/auth/register/verify` mengembalikan token.

## Google / Firebase auth (warga only)

- `POST /api/auth/google` — body `{firebase_token}`; `POST /api/auth/google/complete` — body `{onboarding_token, phone, password, password_confirmation}`; `POST /api/auth/phone` — completes a phone for an already-authenticated-but-phone-less session. All throttled `10,1`.
- Token verification sits behind the `App\Contracts\FirebaseTokenVerifier` contract; `AppServiceProvider` binds it to `KreaitFirebaseTokenVerifier` as a singleton — **swap the binding in tests**, don't mock the concrete class (`backend_POSTGRESQL/tests/Feature/GoogleAuthTest.php` has 18 cases covering this).
- Google login is **warga-only** — `petugas`/`supervisor`/`admin` get `403 GOOGLE_WARGA_ONLY`; banned → `ACCOUNT_BANNED`; a `firebase_uid` already linked to a different Google account → `409 FIREBASE_UID_CONFLICT`.
- New/unmatched email is **not** written to DB at login: it returns an `onboarding_token` (Cache, 15 min TTL) that `complete` exchanges for an account (`WargaRegistrationService`) plus token Sanctum. Duplicate phone must not consume the token (see `test_phone_duplikat_tidak_menghapus_onboarding_token`).
- `complete` bercabang: akun **baru** (`is_new_user`) → **langsung dibuat** oleh `WargaRegistrationService` (tanpa OTP) dan dibalas `{token, user}`; akun **lama** yang cuma kurang phone → juga `{token, user}`. `onboarding_token` dibuang setelah sukses. Tidak ada email OTP di jalur Google; karena itu SMTP mati tidak mematikan pendaftaran Google (hanya daftar manual).
- `users.firebase_uid` — unique, nullable, added by migration `2026_10_21_000000_add_firebase_uid_to_users_table`. Phone format: `PhoneNumber::VALIDATION_REGEX` (`+62|62|0` + `8[1-9]` + 6–9 digits), normalized to `08…`.
- Native app uses Firebase Auth + googleid (`android-native/gradle/libs.versions.toml`) → `google-services.json` is mandatory for the native build. The Capacitor/web frontend has **no** Google auth client yet.

## Gotchas that bite

- `VITE_API_BASE_URL` is baked at build time — changing `.env` alone does nothing; rebuild (`build:mobile`/Vercel).
- `vite.config.ts` + `vite.config.capacitor.ts` use `@lovable.dev/vite-tanstack-config` — don't re-add the plugins it already bundles (header lists them). `vite.config.ts` intentionally adds `injectLeafletGlobalPlugin` (markercluster needs global `L`) and `VitePWA` — don't remove them. Four configs: `vite.config.ts` (main: SPA on Vercel, SSR locally), `vite.config.dev.ts` (standalone, used by `npm run dev`), `vite.config.capacitor.ts` (SPA), `vite.config.sw.ts` (prebuild); `build:mobile` = SW build + `build.py --build-only`, which patches `dist` HTML (splash CSS, error script) — don't bypass it.
- `src/routeTree.gen.ts` is auto-generated — do not edit.
- Tailwind v4 is CSS-only (`@import "tailwindcss"`); no `tailwind.config.*`.
- TanStack child routes (`foo.detail.tsx`) only mount if parent `foo.tsx` renders `<Outlet />`. List+detail pattern: `foo.tsx` layout + `foo/index.tsx` + `foo.detail.tsx`.
- No web frontend test framework. Native tests are instrumented only (`app/src/androidTest`), so plain `./gradlew test` verifies nothing there.
- Native app uses MapLibre (CARTO Positron style) + Compose; web maps use Leaflet. Don't port Leaflet/markercluster patterns or `fitBounds` assumptions to `android-native`. Native package layout: `feature/<screen>/` (UI screens), `ui/components/` (shared widgets, e.g. `GoogleSignInButton.kt`), `core/{auth,network,data,util,worker,notify}/`.
- Native `BuildConfig.API_BASE_URL` is hard-coded to `https://api.deltajalan.web.id/api` in `defaultConfig` (no debug override) — debug builds hit production; edit `android-native/app/build.gradle.kts` deliberately if testing locally.
- Capacitor `com.jalankita.app`, `androidScheme: http`, `cleartext: true`. Custom `PhotoExifGps` plugin (`Frontend-stable/capacitor-exif-gps/`); `android/` is gitignored/generated (absent locally — verify registration on the machine that built it). Detect native by *calling* `isNativePlatform()` with `=== true` (canonical helper in `src/hooks/useLocationFromPhoto.ts`) — never a bare `window.Capacitor` presence check.
- Native photo pick may return `lat/lng: null` (DocumentsProvider, Android 14+) — GPS fallback chain in `useLocationFromPhoto.ts`: native `PhotoExifGps.pickPhotos()` → JS `exifr.gps(file)` → server `readExifGpsFromServer(file)` (PHP PEL) → browser geolocation.
- Reverse geocoding 5-tier chain (`useLocationFromPhoto.ts`): Nominatim → LocationIQ → OSRM nearest → Overpass → Wilayah-id. Duplicated in Android `core/util/ReverseGeocoder.kt` — keep both in sync. Road-name autocomplete is `useRoadSearch.ts` (LocationIQ, Sidoarjo viewbox filter); API tolerates manual input, supervisor reviews.
- All `map.fitBounds(...)` calls need `{ animate: false }` — zoom animation races unmount and crashes.
- `resolveImageUrl()` (`src/lib/imageUrl.ts`) prepends API origin for `/storage/...` paths. Don't "fix" cross-origin `<img>` — only ngrok HTML warnings triggered ORB, not prod.
- Telegram webhook is `POST /telegram/webhook` in `routes/web.php` (no `/api` prefix), CSRF-exempt in `bootstrap/app.php`.
- Trust score is OFF — code kept behind `// ── TRUST SCORE [NONAKTIF] ──` markers (`App\Services\TrustScoreService` is dead code). Don't re-add trust fields to responses.
- Batch upload is two-step: `POST /api/analyze-batch` (≤20 files, 5 MB each) caches analyses + temp `photo_paths` in `batch_analyses`; `POST /api/reports/batch` then reuses `batch_id` without re-uploading, and deletes the row/temp dir on success. A scheduler purges rows older than 24 h — don't delete them manually.
- Upload rules (backend-enforced): petugas EXIF date ≤2 days (`ReportController::MAX_PHOTO_AGE_DAYS`), **warga ≤7 days** (`WargaReportController::MAX_PHOTO_AGE_DAYS`; deliberate exception, keep web/Telegram/native in sync). `AIController` reads `config('app.max_photo_age_days', 2)`, but that key is **not defined in `config/app.php`** and `settings.max_photo_age_days` is not wired — the admin setting does NOT change upload enforcement. Missing/future EXIF rejected (single) or skipped (batch); SHA-256 dedup silently skips (toggle: `DEDUP_ENABLED` env → `config('app.dedup_enabled')`); per-photo GPS EXIF with form-coordinate fallback; coordinates must be inside Sidoarjo (`isInSidoarjo` / `sidoarjoBounds`).
- Photos live on disk (`storage/app/public/`), never base64 in DB. UI icons go through `components/jk/Icon.tsx` (Material Symbols names mapped to lucide-react); don't add raw SVGs/emoji for new UI.
- PostgreSQL: no `DB::raw` counters inside `updateOrCreate` (column refs illegal in `VALUES`). Use `lockForUpdate()` + `increment()`, else `create([... 'count' => 1])` in a transaction.
- Lambda has no PyTorch (onnxruntime only). `backend_AI/lambda/models/*.onnx` are tracked despite the root `*.onnx` gitignore rule; MobileCLIP ONNX/text embeds come from S3 in the Dockerfile (not git). Rebuild via `update-lambda.sh`/CI after any `handler.py` change.
- MobileCLIP relevance guard (threshold 0.15) differs by runtime: dev `server.py` rejects `/analyze` with 422 `not_relevant`; Lambda `/analyze` does NOT gate (only `/analyze-relevance`), and only Telegram calls `MobileClipService` — don't assume parity.

## References (read, don't duplicate)

- Test accounts + password (`password123`): `docs/akun-testing.md` (5 petugas, 4 supervisor, 1 admin; no warga). Full route list: `backend_POSTGRESQL/routes/api.php`.
- Landing-page style: `DESIGN.md` (Civic Precision tokens + Anti-Slop rules).
- Native Android plan: `docs/rencana-native-android.md`; feature-gap analysis + improvement plan: `docs/analisis-fitur-android-native.md`, `docs/plan-penambahan-dan-perbaikan-android.md`; map fix plan: `docs/plan-fix-peta-interaktif-android.md`; `android-native/README.md` for build (gradlew ban there is stale — this file authorizes agent builds; Capacitor path stays user-run). Per-feature plans live as `android-native/PLAN-*.md`.
- Fresh Ubuntu/Docker setup: `docs/setup-ubuntu-fresh.md` (Ubuntu 26+ has no PHP 8.3 → use Docker).
- `README.md` is stale on roles (still lists `petugas_eksekusi`/UPR), EXIF age (says 7 days; code enforces 2 for petugas / 7 for warga), and AI setup (`pip install -r requirements.txt` — there is no root requirements file). `backend_AI/CARA_JALANKAN.md` is stale too (Windows paths, frontend port :8080) — trust Commands + code.
