# Fixing 403 Forbidden Error on Storage Images

The root cause of the `403 Forbidden` error when trying to fetch images from `/storage/reports/...` is a known limitation of the **PHP built-in web server** (which runs behind `php artisan serve`) on **Windows environments**. 

When the PHP development server encounters a request to a symlinked/junction directory (like [public/storage](file:///c:/DeltaJalan/backend_POSTGRESQL/public/storage)), it blocks access and returns a `403 Forbidden` for security reasons instead of serving the file or returning a `404 Not Found`.

## Proposed Changes

We will implement a fallback route in the Laravel application to manually serve the files if they are requested via the [/storage](file:///c:/DeltaJalan/backend_POSTGRESQL/public/storage) URL. This bypasses the PHP server's symlink block by intercepting the request inside Laravel and outputting the file content directly.

### backend_POSTGRESQL
#### [MODIFY] routes/web.php
Add a custom GET route that catches `/storage/{path}`:
```php
// Tambahan untuk Bypass 403 Forbidden symlink di local dev (Windows)
if (app()->environment('local')) {
    Route::get('/storage/{path}', function ($path) {
        $fullPath = storage_path('app/public/' . $path);
        
        if (!file_exists($fullPath)) {
            // Optional: return a placeholder image here if desired for mock data,
            // or standard 404. 
            abort(404);
        }
        
        return response()->file($fullPath);
    })->where('path', '.*');
}
```

## Side Note on Missing Mock Files
During investigation, it was discovered that the specific file `1a4f1da1-784f-430a-b88e-0293d45ef805.jpg` actually does **not** exist in `storage/app/public/reports/` (the folder only contains `originals` and `results` subfolders). Because of the 403 symlink block, the server threw 403 instead of 404. After this fix, it will correctly return a **404 Not Found** for missing mock files. We can also optionally inject a basic placeholder image for missing files so the dashboard doesn't show broken thumbnails.

## User Review Required
> [!IMPORTANT]
> Would you like me to add logic to return a **placeholder image** if the requested file doesn't exist? Since this is local mock data, it might improve the dashboard UI during development if missing files display a dummy image instead of a broken image icon.

## Verification Plan

### Automated / API Tests
- Use `Invoke-WebRequest -Method Head` against the local Laravel server to confirm that an existing file returns `200 OK` and a missing file returns `404 Not Found` (instead of `403 Forbidden`).

### Manual Verification
1. User reloads the Supervisor Dashboard. The thumbnails will no longer receive `403 Forbidden` errors.
2. If placeholders are enabled, the UI will successfully display a placeholder image for missing mock files.
