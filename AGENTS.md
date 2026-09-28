# AGENTS.md — DeltaJalan (JalanKita)

Road damage reporting app for Dinas PU Bina Marga Kab. Sidoarjo. Roles: `petugas`, `supervisor`, `admin`, `warga` (self-registers via `POST /auth/register`, never seeded).
`petugas_eksekusi` was merged into `petugas`; UPR removed → `teams` (migration `2026_06_23_000007_remove_upr_and_merge_petugas_eksekusi_role`). No `GET /uprs`.

## Layout

```
Frontend-stable/        React 19 + TanStack Start SSR + Tailwind v4, Vite 7
backend_POSTGRESQL/     Laravel 13 REST API (PHP 8.3, Sanctum, PostgreSQL 16)
backend_AI/             FastAPI dev (server.py :8000) / Lambda prod (lambda/handler.py, onnxruntime — no PyTorch)
scripts/                start-android.sh, start-dev-with-ngrok.sh, start-ubuntu.sh, start-dev-ubuntu.sh,
                        deploy-laravel.sh, update-lambda.sh, deltajalan.nginx.conf, deltajalan-worker.conf
docker-compose.yml      PHP 8.3 + PostgreSQL 16 (Ubuntu Docker path; Windows uses native PHP)
```

3 independent services, no workspaces. Prod API: `https://api.deltajalan.web.id` (Lightsail `47.131.39.245`, Ubuntu 24.04, PHP-FPM + PG16 + Supervisor 3 workers). Frontend `VITE_API_BASE_URL` points at prod API; Laravel forwards AI calls via `config('services.fastapi.url')` (`FASTAPI_URL` in backend `.env`).

## Mandatory rules

- **Never** start dev servers (`php artisan serve`, `npm run dev`, `vite`) or Android builds (`build:mobile`, `npx cap`, `python build.py`, `gradlew`). User runs those.
- **Never** run `migrate:fresh`, `migrate:reset`, `db:wipe`, or `DROP` — even if you think consent exists. Allowed without asking: `migrate`, `db:seed`, `cache:clear`, `config:clear`. New DB columns only via migration, never alter existing ones.
- **Never** commit/push unless user literally says "commit"/"push"/"commit dan push". Staging is fine.
- Commit messages in **Bahasa Indonesia**, `tipe: pesan singkat` (`fix:`, `feat:`, `refactor:` …).
- Before SSH to prod (`ubuntu@47.131.39.245`, key `~/.ssh/LightsailDefaultKey-ap-southeast-1.pem`), present the exact command plan and get approval.
- Warn before any command expected to take 10s+.
- For library/framework code, resolve docs via Context7 MCP (`resolve-library-id` → `query-docs`) and cite sources.

## Pre-commit security check (no pre-commit hook in repo — do it manually)

1. `git status --short` — inspect every new/changed file.
2. Scan tracked files for tokens/keys/PEM:
```bash
rtk grep -rnE '[0-9]{8,10}:[A-Za-z0-9_-]{35}' --include='*.md' --include='*.php' --include='*.ts' --include='*.tsx' --include='*.sh' --include='*.yml' . 2>/dev/null | grep -v -e node_modules -e vendor -e '.git/' -e dist/ -e android/
rtk grep -rnE '(LOCATIONIQ_KEY|_SECRET=|_TOKEN=|_KEY=|_PASSWORD=|PRIVATE_KEY)' --include='*.md' --include='*.php' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.sh' --include='*.yml' . 2>/dev/null | grep -v -e node_modules -e vendor -e '.git/' -e dist/ -e android/ -e '.env.example'
rtk grep -rn '-----BEGIN' --include='*.md' --include='*.php' --include='*.ts' --include='*.json' --include='*.sh' --include='*.yml' . 2>/dev/null | grep -v -e node_modules -e vendor -e '.git/'
```
3. `docs/*.md` must contain only placeholders (`xxxxxxxx`/`[REDACTED]`), never live secrets.
4. `.env*`, `*.pem`, `*.key`, `opencode.json` are gitignored — must never appear in `git status`. If unsure about any file, STOP and ask.

## Commands

```bash
# Frontend (Frontend-stable/)
npm run lint | npm run format            # eslint / prettier --write .
npm run build                            # SSR prod build (Vercel)
npm run build:mobile                     # SPA for Capacitor (vite.config.sw.ts + build.py --build-only)

# Laravel (backend_POSTGRESQL/) — native; on Ubuntu Docker prefix with `docker compose exec php`
composer run dev                         # serve :8080 + queue + logs + schedule + vite (concurrently)
composer run test                        # config:clear + phpunit (SQLite :memory:, see phpunit.xml)
php vendor/bin/pint                      # PHP lint
docker compose exec php php artisan {command}   # artisan via Docker

# AI: dev `cd backend_AI && python server.py` (:8000); prod redeploy after handler.py changes:
bash scripts/update-lambda.sh [--skip-test]

# Backend deploy: CI `.github/workflows/deploy-backend.yml` (push main touching backend_POSTGRESQL/).
# Fallback manual on server: `bash scripts/deploy-laravel.sh` (pull + install + migrate --force + cache + restart workers)
```

## Gotchas that bite

- `VITE_API_BASE_URL` is baked at build time — changing `.env` alone does nothing; rebuild (`build:mobile`/Vercel).
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` — never add Vite plugins manually. Multiple configs exist (`dev`, `capacitor`, `sw`); mobile build uses `vite.config.sw.ts`.
- `src/routeTree.gen.ts` is auto-generated — do not edit.
- Tailwind v4 is CSS-only (`@import "tailwindcss"`); no `tailwind.config.*`.
- TanStack child routes (`foo.detail.tsx`) only mount if parent `foo.tsx` renders `<Outlet />`. List+detail pattern: `foo.tsx` layout + `foo/index.tsx` + `foo.detail.tsx`.
- No frontend test framework. `build.py` patches HTML (splash CSS, error script) for Capacitor — don't bypass it.
- Capacitor `com.jalankita.app`, `androidScheme: http`, `cleartext: true`. Custom `PhotoExifGps` plugin must be registered explicitly in `MainActivity.java` before `super.onCreate()` (not auto-discovered). Never detect native via `window.Capacitor !== undefined` — use `Capacitor.isNativePlatform?.() === true`.
- Native photo pick may return `lat/lng: null` (DocumentsProvider, Android 14+) — fall back to JS `readExifGps(file)`.
- All `map.fitBounds(...)` calls need `{ animate: false }` — zoom animation races unmount and crashes.
- `resolveImageUrl()` prepends API origin for `/storage/...` paths (safe: prod domain serves real JPEGs). Don't "fix" cross-origin `<img>` — only ngrok HTML warnings triggered ORB, not prod.
- Telegram webhook is `POST /telegram/webhook` in `routes/web.php` (no `/api` prefix), CSRF-exempt in `bootstrap/app.php`.
- Trust score is OFF — code kept behind `// ── TRUST SCORE [NONAKTIF] ──` markers. Don't re-add trust fields to responses.
- Upload rules (backend-enforced): EXIF date ≤2 days, else reject (single)/skip file (batch); SHA-256 image dedup silently skips; per-photo GPS EXIF with form-coordinate fallback; coordinates validated inside Sidoarjo/Indonesia; road name from LocationIQ autocomplete (API tolerates manual input, supervisor reviews).
- Photos live on disk (`storage/app/public/`), never base64 in DB. UI icons via `<Icon>` (Material names), never emoji.
- PostgreSQL: no `DB::raw` counters inside `updateOrCreate` (column refs illegal in `VALUES`). Use `lockForUpdate()` + `increment()`, else `create([... 'count' => 1])` in a transaction.
- Lambda limits: ~6 MB payload, 15 s timeout, 3–6 s cold start. Rebuild via `update-lambda.sh` after any `handler.py` change.

## References (read, don't duplicate)

- Test accounts + password: `docs/akun-testing.md`. Full route list: `backend_POSTGRESQL/routes/api.php`.
- Landing-page style constraints: `DESIGN.md` + "Anti-Slop" rules (no blue-purple accents, no uniform 3-card grids/`rounded-2xl`/`scale-105` hovers, vary spacing/easing per section).
- Stale file: `AGENTS-opencode.md` still describes UPR/`petugas_eksekusi`/FastAPI-prod — do not trust it.
