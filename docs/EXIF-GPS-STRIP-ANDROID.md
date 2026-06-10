# EXIF GPS Stripped on Android Chrome — Analisis & Solusi

## Project Context

**Aplikasi:** JalanKita — Web app pelaporan kerusakan jalan (React + Vite + TanStack Start + Laravel backend)

**Target user:** Petugas lapangan Dinas PU Bina Marga Sidoarjo

**Device utama:** Samsung Galaxy A21 (Android 11+), juga digunakan di Oppo, Xiaomi, dan berbagai Android lain

**Input foto:** `<input type="file" accept="image/jpeg,image/png,image/jpg" capture="environment">`

**Fitur kritis:** Batch upload hingga 20 foto sekaligus, tiap foto harus punya koordinat GPS (latitude/longitude)

---

## The Problem

**GPS EXIF data is stripped when photos are uploaded via Chrome on Android.** This broke around Android 10 (2019) when Google introduced the `ACCESS_MEDIA_LOCATION` permission.

### Cause

1. **Android 10+ (API 29)** — OS introduces `ACCESS_MEDIA_LOCATION` permission
2. **`MediaStore` redaction** — when any app (including Chrome) reads a file through `MediaStore`, GPS EXIF tags (`GPSLatitude`, `GPSLongitude`) are zeroed out **unless** the app has explicitly declared and requested `ACCESS_MEDIA_LOCATION`
3. **Chrome never requests `ACCESS_MEDIA_LOCATION`** — this is a browser-level limitation, not a bug
4. **New Android Photo Picker (Android 13+)** — uses `PickVisualMedia` contract which strips EXIF GPS **by design**. Even `MediaStore.setRequireOriginal()` throws `UnsupportedOperationException` for these URIs — no recovery path

### Impact

- `exifr.gps(file)` (client-side JavaScript) → **null** (data already gone from File object)
- Server upload + PHP `exif_read_data` + PEL library → **null** (data gone before upload)
- Batch upload: all 20 photos lose their individual GPS coordinates

---

## What We've Tried So Far

### 1. Client-side EXIF (exifr)

```js
const gps = await exifr.gps(file);
```

Works on desktop, fails on Android Chrome 10+.

### 2. Server-side fallback (PHP + PEL)

Upload photo to Laravel backend → `exif_read_data()` (native) → `fileeye/pel` library (pure PHP fallback).

Fails because the bytes received by the server already have GPS zeroed out. The stripping happens in the browser before the upload request is sent.

### 3. Accept attribute workaround

```html
accept="image/jpeg,image/png,image/jpg,text/plain"
```

**Result:**
- ✅ **Samsung (One UI)** — Forces `ACTION_GET_CONTENT` → Samsung's custom file manager → **EXIF preserved**
- ❌ **Oppo (Google Files / DocumentsUI)** — Still uses stock Android DocumentsProvider → **EXIF stripped**
- ❌ **Pixel / stock Android** — Same as Oppo
- ❌ **Android 13+ Photo Picker** — Strips by design, no recovery

This works **only** because Samsung's One UI file manager implementation doesn't enforce `ACCESS_MEDIA_LOCATION`. All other OEMs using AOSP DocumentsUI or the new Android Photo Picker still strip GPS.

### 4. PEL library (fileeye/pel)

Installed as fallback for PHP `exif_read_data` bug (returns zeros for Samsung A21 photos). Helps when EXIF is present but native PHP can't parse it. **Does not help when EXIF is already stripped by the browser.**

### 5. Eruda debug console

Added floating button to inspect console/browser behavior on device during testing.

---

## Findings from Research

### Key Reference: [exif_picker_lab](https://github.com/warting/exif_picker_lab)

Android reference app testing 5 pickers × 4 EXIF read methods. Key findings:

| Picker Contract | EXIF GPS | Notes |
|:---|---:|:---|
| `PickVisualMedia` (Android Photo Picker) | ❌ Strip | `setRequireOriginal()` throws `UnsupportedOperationException` |
| `ACTION_GET_CONTENT` (legacy) | ✅ Intact | Samsung uses this → works |
| `ACTION_OPEN_DOCUMENT` (SAF) | ✅ Intact | But goes through DocumentsUI which enforces redaction |
| `ACTION_IMAGE_CAPTURE` (camera) | ⚠️ Depends | Camera app must have "Save location" ON |

### Chrome doesn't control this

Chrome simply delegates to Android's file picking mechanism. Which contract Chrome uses depends on:
- Android version
- Chrome version
- OEM customization
- `accept` attribute values

There is **no `chrome://flag`** or web API to request `ACCESS_MEDIA_LOCATION`.

### The real issue is at OS level

```
User takes photo → GPS embedded in JPEG EXIF ✅
  ↓
User picks photo via <input type="file">
  ↓
Chrome calls Android (PickVisualMedia / GetContent / OpenDocument)
  ↓
[!] Android MediaStore → ACCESS_MEDIA_LOCATION not granted
  ↓
[!] GPSLatitude, GPSLongitude → zeroed out (0/0)
  ↓
File object reaches JavaScript → EXIF GPS is already gone
  ↓
Server receives upload → bytes already have no GPS
```

---

## Proposed Solutions

### A. Auto-Geolocation Fallback (PWA) — Quick Win

```js
// Chain: client EXIF → server EXIF → browser geolocation
const gps = await readExifGps(file)               // 1. Try EXIF
  ?? await readExifGpsFromServer(file)             // 2. Try server
  ?? await getBrowserLocation()                    // 3. Use GPS chip
```

- Uses `navigator.geolocation.getCurrentPosition()` as automatic fallback
- Works on ALL devices, ALL Android versions
- **Limitation:** Only 1 coordinate point for the entire batch (where user stands when uploading)
- Can be implemented today, no build changes needed

### B. Capacitor Native Wrapper (APK) — Permanent

Build a thin native Android wrapper with Capacitor that:
1. Declares `ACCESS_MEDIA_LOCATION` in `AndroidManifest.xml`
2. Requests permission at runtime
3. Uses `MediaStore.setRequireOriginal(uri)` when reading photos
4. Uses AndroidX `ExifInterface` to read GPS directly
5. Uses `ACTION_GET_CONTENT` (not PhotoPicker) for file selection

```
User taps "Pilih Foto" → Capacitor native file picker
  → MediaStore.setRequireOriginal(uri) → GPS EXIF INTACT ✅
  → Returns { uri, lat, lng } to JavaScript
```

**Bundle impact:** Only +8 kB (`@capacitor/core`)
**Same codebase:** `Capacitor.isNativePlatform()` check for native vs PWA path

### C. Accept Workaround (already implemented)

Helps Samsung users, doesn't help Oppo/stock Android/Pixel.

---

## Questions for Analysis

1. **Is the Capacitor approach the best permanent solution?** Are there any alternatives we're missing — perhaps a lightweight WebView bridge that doesn't require full Capacitor?

2. **For the PWA path**, is auto-geolocation the only reliable fallback? Is there any known way to read EXIF GPS from a file on Android Chrome in 2025-2026?

3. **Bundle size concern:** We want the web to remain lightweight. `exifr` full bundle is 75 kB. If we switch to Capacitor, can we remove `exifr` entirely for the native path and only load it for desktop/PWA? What's the best code-splitting strategy?

4. **Capacitor vs. alternative approach:** Some apps use a custom TWA (Trusted Web Activity) or WebView with `addJavascriptInterface`. Would that be simpler than full Capacitor for just this one native feature?

5. **Production deployment:** If we go Capacitor:
   - How to handle updates? (CodePush? Play Store updates?)
   - Can we still use the same domain for both PWA and APK?
   - Any issues with TanStack Start SSR + Capacitor?

6. **For batch upload (20 photos):** Each photo has a different GPS coordinate along a road segment. With auto-geolocation we only get 1 point. With Capacitor we can get 20 different GPS points from EXIF. Is there any alternative to Capacitor that gives per-photo GPS in batch mode?

7. **Is there a way to read EXIF GPS from a `content://` URI on Android without `ACCESS_MEDIA_LOCATION`?** Some apps claim to bypass this — is there a legitimate method?

8. **What are the actual stats?** What percentage of Android devices in Indonesia (where our users are) still preserve EXIF GPS? Is this worth a full Capacitor build, or is auto-geolocation sufficient for the user base?

---

## Current Status

| Component | Status |
|:---|---:|
| Accept workaround (`text/plain`) | ✅ Implemented, helps Samsung |
| Server EXIF (PEL fallback) | ✅ Implemented, helps desktop |
| Auto-geolocation | ❌ Not yet implemented |
| Capacitor native | ❌ Not yet started |
| Migration (drop evidences) | ✅ Applied |
| Bundle size | `exifr` full (75 kB) — can switch to mini (29 kB) |
