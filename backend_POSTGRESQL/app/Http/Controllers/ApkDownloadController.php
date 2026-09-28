<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ApkDownloadController extends Controller
{
    public function download()
    {
        $path = Storage::disk('public')->path('apk/DeltaJalan.apk');

        if (! file_exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'APK tidak tersedia saat ini.',
            ], 404);
        }

        return response()->download($path, 'DeltaJalan.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * GET /api/app/version?platform=android&version_code=N
     * Metadata versi untuk force-update aplikasi native.
     * Config-based (config/mobile.php) — tanpa migrasi database.
     */
    public function version(Request $request)
    {
        $platform = strtolower((string) $request->query('platform', 'android'));

        if ($platform !== 'android') {
            return response()->json([
                'success' => false,
                'message' => 'Platform tidak didukung.',
            ], 422);
        }

        $minVersion = (int) config('mobile.android_min_version_code');
        $latestVersion = (int) config('mobile.android_latest_version_code');
        $installedVersion = (int) $request->query('version_code', 0);

        return response()->json([
            'success' => true,
            'data' => [
                'min_version_code' => $minVersion,
                'latest_version_code' => $latestVersion,
                'apk_url' => url('/api/public/download-apk'),
                'force_update' => $installedVersion < $minVersion,
            ],
        ]);
    }
}
