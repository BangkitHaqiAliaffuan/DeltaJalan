<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Versi minimum & terbaru aplikasi native Android (versionCode)
    |--------------------------------------------------------------------------
    | Dipakai GET /api/app/version untuk force-update. Ubah via .env
    | setiap rilis APK native baru — tanpa migrasi database.
    */
    'android_min_version_code' => (int) env('ANDROID_MIN_VERSION_CODE', 2),
    'android_latest_version_code' => (int) env('ANDROID_LATEST_VERSION_CODE', 2),

];
