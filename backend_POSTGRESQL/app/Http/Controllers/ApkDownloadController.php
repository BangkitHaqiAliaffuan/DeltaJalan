<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ApkDownloadController extends Controller
{
    public function download()
    {
        $path = Storage::disk('public')->path('apk/DeltaJalan.apk');

        if (!file_exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'APK tidak tersedia saat ini.'
            ], 404);
        }

        return response()->download($path, 'DeltaJalan.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }
}
