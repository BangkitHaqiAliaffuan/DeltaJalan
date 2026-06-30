# Android File Read Error — "The requested file could not be read"

## Error

```
DOMException: The requested file could not be read, typically due to permission
problems that have occurred after a reference to a file was acquired.
```

**Environment:** Android (Capacitor WebView), batch photo upload flow.
**Frequency:** Intermittent but reproducible.

---

## Symptoms

- User selects multiple photos from gallery via `<input type="file" multiple>`
- Preview thumbnails appear normally
- User fills dimension fields and clicks "Analisis Semua"
- Error appears in the UI (caught and shown via `setError`)
- Upload fails

---

## Previous Investigation & Fixes

### Initial Hypothesis: Content:// URI Permission Expiry

On Android WebView, `<input type="file">` returns `File` objects backed by
`content://` URIs with temporary read permissions. These permissions can expire
when:

- Activity is destroyed/recreated (rotation, background kill)
- Too much time passes between file selection and file reading
- ContentProvider backing the URI revokes access

This is a well-known Android issue (Scoped Storage).

### Three Code Paths Fixed

All three entry points that receive Files from `<input>` were patched to read the
file data **immediately** (synchronously after onChange) into an in-memory `File`
via `arrayBuffer()` + `new File()`:

| Function            | File             | Status                                                        |
| ------------------- | ---------------- | ------------------------------------------------------------- |
| `handleBatchSelect` | `upload.tsx:134` | Reads `f.arrayBuffer()` immediately, creates in-memory `File` |
| `handleFilePicked`  | `upload.tsx:87`  | Same pattern                                                  |
| `handleReplaceFile` | `upload.tsx:441` | Same pattern, converted to async                              |

The pattern:

```typescript
const buf = await file.arrayBuffer();
const safeFile = new File([buf], file.name, { type: file.type });
// Store safeFile instead of original file
```

### Why This Should Work

In-memory `File` objects are backed by `ArrayBuffer` in Chromium's renderer
process blob registry. They are NOT backed by `content://` URIs with temporary
permissions. Reading them should never fail unless:

1. Chromium blob storage quota is exceeded (our files < 5MB, unlikely)
2. Renderer process runs out of memory (5MB files, unlikely on modern devices)
3. Blob data is paged to disk and disk cache cleared (edge case)

---

## Error STILL Persists

Despite all three fixes above, the error still occurs. This means:

1. The `content://` permission expiry hypothesis is **NOT the sole root cause**
2. OR the fix is not being applied correctly at build time
3. OR there is another code path not covered

### Potential Alternative Causes

#### 1. Chromium Blob Storage Volatility on Android

Chromium's blob storage on Android WebView works differently than on desktop
Chrome. The blob data exists in the renderer process's memory space. Under
memory pressure, Android may signal WebView to trim memory, potentially
invalidating blob data.

**Suggested investigation:** Test with explicit blob retention (keep references,
verify blob lives across microtask boundaries).

#### 2. Race in Blob Construction

`new File([buf], ...)` should copy the ArrayBuffer data synchronously per spec,
but Chromium may defer transport to the browser process. If the ArrayBuffer is
GC'd before transport completes, the File's data may be lost.

**Suggested investigation:** Keep the `buf` ArrayBuffer reference alive until
the File is first read.

```typescript
// Defensive pattern to test:
const files: { file: File; buf: ArrayBuffer }[] = [];
for (const f of fileArr) {
  const buf = await f.arrayBuffer();
  const safeFile = new File([buf], f.name, { type: f.type });
  files.push({ file: safeFile, buf }); // Keep buf alive
}
// Use files[i].file downstream
```

#### 3. FormData + `_originalFetch` Issue

When `window.fetch` is called with `FormData` body, the request goes through:

```
setupNativeFetch → apiFetch → _originalFetch (native WebView fetch)
```

The `_originalFetch` must read the FormData's File entries. For in-memory
Files, this should use Chromium's blob storage. But if blob data is lost
(see #1), this fails.

**Suggested investigation:** Test with base64-encoded data instead of File
objects in FormData:

```typescript
const base64 = arrayBufferToBase64(buf);
fd.append("files[]", new Blob([base64], { type: "text/plain" }), f.name);
// Server-side: decode base64 back to binary
```

#### 4. `exifr` Library Internal Read

After the fetch response, `readExifGps(f)` is called on each file
(`upload.tsx:379`). The `exifr` library reads EXIF data using internal
`FileReader` or `file.arrayBuffer()`. If the in-memory File's blob data is
invalidated (see #1), this would throw.

```typescript
// exifr.gps(file) internally does:
// const buffer = await file.arrayBuffer();  // or FileReader
// parseExif(buffer);
```

**Suggested investigation:** Add explicit logging before/after `readExifGps` to
pinpoint exactly which operation throws.

#### 5. Multiple Concurrent Blob Reads

`Promise.all` in `handleBatchSelect` reads multiple Files concurrently. On
Android WebView, each `f.arrayBuffer()` triggers an IPC to the browser process
(ContentResolver). Multiple concurrent IPCs might race.

**Suggested investigation:** Read files sequentially instead of concurrently:

```typescript
const safeFiles = [];
for (const f of fileArr) {
  const buf = await f.arrayBuffer();
  safeFiles.push(new File([buf], f.name, { type: f.type }));
}
```

#### 6. Input Element Reset During Async Read

In `handleGallerySelect`:

```typescript
handleBatchSelect(files); // Async, NOT awaited
galleryInputRef.current.value = ""; // Resets input immediately
```

Resetting the input while an async read is in progress might invalidate the
File references on some Android WebView versions.

**Suggested investigation:** Move the input reset AFTER the async read
completes:

```typescript
await handleBatchSelect(files);
galleryInputRef.current.value = "";
```

---

## Testing Strategy

### Reproduce

1. Android device (API 30+, preferably Google Pixel or Samsung)
2. Select 3-5 photos from gallery (Google Photos or default gallery)
3. Fill in dimensions for all photos
4. Click "Analisis Semua"

### Logging

Add console.warn before/after each file read operation:

```typescript
console.warn("[BATCH] Before arrayBuffer:", f.name, f.size);
const buf = await f.arrayBuffer();
console.warn("[BATCH] After arrayBuffer:", f.name, buf.byteLength);
```

### Verify In-Memory Files

Check that the File objects in state/aiStore are actually in-memory:

```typescript
// In handleBatchAnalyze
fileArr.forEach((f, i) => {
  console.warn(`[BATCH] File ${i}:`, f.name, f.size, f instanceof File, f.constructor.name);
  // Read back to verify:
  f.arrayBuffer()
    .then((b) => console.warn(`[BATCH] File ${i} readable:`, b.byteLength))
    .catch((e) => console.warn(`[BATCH] File ${i} FAILED:`, e.message));
});
```

---

## Code References

| File                                | Key Lines | Description                                            |
| ----------------------------------- | --------- | ------------------------------------------------------ |
| `src/routes/upload.tsx`             | 87-111    | `handleFilePicked` — single file entry                 |
| `src/routes/upload.tsx`             | 134-170   | `handleBatchSelect` — batch file entry                 |
| `src/routes/upload.tsx`             | 270-419   | `handleBatchAnalyze` — batch analyze + upload          |
| `src/routes/upload.tsx`             | 441-471   | `handleReplaceFile` — replace photo in batch           |
| `src/routes/upload.tsx`             | 119-132   | `handleGallerySelect` — onChange handler (NOT awaited) |
| `src/lib/api.ts`                    | 61-123    | `apiFetch` — FormData falls back to `_originalFetch`   |
| `src/lib/api.ts`                    | 125-141   | `setupNativeFetch` — patches `window.fetch`            |
| `src/lib/aiStore.ts`                | 131-136   | `setPendingBatchFiles` / `getPendingBatchFiles`        |
| `src/routes/ai-result.tsx`          | 534-609   | `handleConfirm` — final batch submission               |
| `src/hooks/useLocationFromPhoto.ts` | 331-347   | `readExifGps` — EXIF GPS reader (uses `exifr`)         |
| `src/lib/validatePhotoDate.ts`      | 119-222   | `validatePhotoDate` — EXIF date validator              |

---

## Files That Need Attention

These files check `Capacitor.isNativePlatform()` and might have additional file
read paths that bypass in-memory conversion:

- `src/lib/api.ts:3-6`
- `src/hooks/useBlobImage.ts:5`
- `src/hooks/useLocationFromPhoto.ts:24`

---

## Not Yet Investigated

1. **Android WebView System WebView version** — Different Chromium versions may
   handle blob storage differently
2. **Google Photos vs default gallery** — Different ContentProviders may behave
   differently
3. **Android Photo Picker (API 33+)** — Newer picker API may use different URI
   permission semantics
4. **Memory pressure simulation** — Whether the error correlates with low memory
   conditions
