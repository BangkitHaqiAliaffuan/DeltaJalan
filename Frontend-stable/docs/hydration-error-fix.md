# Hydration Error #418 — Root Cause & Fix

## Problem

App DeltaJalan (Capacitor + TanStack Start v1 SPA) menampilkan **blank white screen** di Android WebView setelah production build.

**Gejala CDP:**

- `document.body.innerHTML = ""` (body kosong)
- `document.scripts.length = 0`
- `document.head.querySelectorAll("script").length = 0`
- CSS pseudo-element splash (logo + gradient) terlihat, tapi tidak pernah fade out

---

## Root Cause #1 (Sudah Diperbaiki): Missing `</style>` in build.py

### Analisis

`build.py` menyuntikkan CSS dan script ke `<head>` dengan kode:

```python
content = content.replace("</head>", f"<style>{SPLASH_CSS}\n{ERROR_SCRIPT}\n</head>")
```

Hasil HTML:

```html
<style>
body::before { ... }
body::after { ... }

<script>
console.log('[DeltaJalan] html loaded', ...);
window.__jkError = function(m) { ... };
</script>

</head>
```

**`<style>` TIDAK pernah ditutup dengan `</style>`.** Browser HTML5 parser masuk ke RAWTEXT state dan memperlakukan SEMUA konten setelahnya (termasuk `<script>`, `</head>`, `<body>`) sebagai CSS text. Akibatnya:

- Semua `<script>` element tidak dibuat (hanya teks di dalam style)
- `<body>` tidak memiliki children karena parser sudah mengkonsumsi semuanya
- Tidak ada kode JavaScript yang dieksekusi

### Fix

Tambahkan `</style>` sebelum `</head>`:

```python
content = content.replace("</head>", f"<style>{SPLASH_CSS}\n</style>\n{ERROR_SCRIPT}\n</head>")
```

---

## Root Cause #2 (Masih Ada): TanStack Self-Removing Scripts → Hydration Mismatch

Setelah fix #1, app muncul tapi ada React error #418 di console.

### Diagnosa Detail

**React Error #418:**

> "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client."

Argumen `args[]=HTML` berarti React mengharapkan **HTML element** (seperti `<script>`, `<div>`) di posisi DOM tertentu, tapi menemukan node yang berbeda (comment node).

**Mekanisme:**

TanStack Start menyuntikkan dua script ke `<body>` yang memanggil `document.currentScript.remove()`:

1. **Scroll restoration script:**

   ```js
   document.currentScript.remove();
   ```

2. **Stream barrier script (`$tsr-stream-barrier`):**
   ```js
   $_TSR.e();
   document.currentScript.remove();
   ```

Kedua script ini **menghapus diri mereka sendiri dari DOM secara sinkronus** selama parsing HTML — SEBELUM React memulai hidrasi.

**Tree React (dari `RootShell` di `__root.tsx`):**

```
<body suppressHydrationWarning>
  {children}  ← SSR content dari TanStack
    <!--$-->              [0] comment
    <!--$-->              [1] comment
    <!--/$-->             [2] comment
    <script>scroll</script>  [3] ← React expects SCRIPT
    <!--/$-->             [4] comment
    <script class="$tsr">stream barrier</script>  [5] ← React expects SCRIPT
  <Scripts />
    <script type="module">import(...)</script>  [6]
  <Toaster />
    <section>...</section>  [7]
```

**DOM aktual saat React hidrasi** (setelah `document.currentScript.remove()`):

```
  <!--$-->              [0] comment ✓
  <!--$-->              [1] comment ✓
  <!--/$-->             [2] comment ✓
  <!--/$-->             [3] comment ✗ ➜ React expects SCRIPT
  <script type="module">import(...)</script>  [4] (shifted)
  <section>...</section>  [5] (shifted)
```

React berjalan ke posisi [3], mengharapkan `<script>` tapi menemukan `<!--/$-->`. Error #418 terlempar. React fallback ke client rendering, aplikasi tetap muncul dengan benar.

### Dampak

- **Aplikasi tetap berfungsi penuh** — login page muncul, pseudo-element splash fade out via `app-ready` class
- Error hanya muncul di console production (minified)
- React 19 graceful recovery

---

## Opsi Fix

| #     | Opsi                                                                                                                                          | Effort     | Kelebihan                                                | Kekurangan                                 | Status         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------- | ------------------------------------------ | -------------- |
| A     | Do nothing                                                                                                                                    | 0          | Tidak perlu perubahan                                    | Error di console (invisible ke user)       | ❌ Ditolak     |
| **B** | **Patch `document.currentScript.remove()` via build.py**                                                                                      | **Rendah** | **Root cause fixed, hydration bersih**                   | **Perlu maintenance tiap update TanStack** | **✅ DIPILIH** |
| C     | Ganti `hydrateRoot(document, ...)` jadi `createRoot()`                                                                                        | Sedang     | Tidak ada hydration sama sekali                          | Perlu modifikasi built JS tiap build       | ❌ Ditolak     |
| D     | Wrap content di `<div id="app-root">` + replace `hydrateRoot(document,` dengan `hydrateRoot(document.getElementById('app-root'),` di built JS | Sedang     | Hydration terisolasi di div, script luar tidak tersentuh | Sama seperti C                             | ❌ Ditolak     |

### Implementasi Fix (Opsi B)

Tambahkan satu baris `re.sub` di `build.py` setelah inject splash CSS:

```python
# Patch: strip document.currentScript.remove() from TanStack inline scripts.
# These self-removals delete script nodes from DOM *before* React hydration starts,
# causing React Error #418 (hydration mismatch: expected SCRIPT node, found COMMENT).
# By keeping the script nodes in DOM, React finds the expected structure and hydrates cleanly.
content = re.sub(r';?\s*document\.currentScript\.remove\(\)', '', content)
print("Patched: stripped document.currentScript.remove() from TanStack inline scripts")
```

---

## File yang Relevan

| File                                   | Peran                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `build.py`                             | Build script — inject CSS, error handlers. **SUDAH DIFIX** (missing `</style>`)                                          |
| `src/routes/__root.tsx`                | Root shell + component. `RootComponent` punya `useEffect(() => document.documentElement.classList.add("app-ready"), [])` |
| `src/routes/admin/dashboard.tsx`       | Butuh fix import: `import { isLoggedIn, getCurrentUser } from "@/lib/auth"`. **SUDAH DIFIX**                             |
| `dist/client/index.html`               | Built HTML output                                                                                                        |
| `dist/client/assets/index-BIlj-GEL.js` | react-dom bundle — berisi fungsi `Ya()` yang throw error #418                                                            |
| `vite.config.capacitor.ts`             | Vite config dengan TanStack Start SPA mode                                                                               |

---

## State Saat Ini

- [x] `</style>` bug di `build.py` — FIXED
- [x] Missing `getCurrentUser` import di `dashboard.tsx` — FIXED
- [x] React error #418 akibat self-removing scripts — **FIXED** (Opsi B: `re.sub` di `build.py` strip `document.currentScript.remove()`)

---

## Cara Reproduce

1. `python build.py` — build SPA
2. `npx cap run android --target 127.0.0.1:7555` — deploy ke emulator
3. `adb forward tcp:9224 localabstract:webview_devtools_remote_{PID}` — forward CDP
4. Buka `http://localhost:9224/json` — cek page
5. Connect via WebSocket ke `webSocketDebuggerUrl`
6. Kirim `Runtime.evaluate` dengan `document.body.innerHTML` — verifikasi body tidak kosong
7. Cek console via `Runtime.enable` + `Log.enable` — lihat error #418
