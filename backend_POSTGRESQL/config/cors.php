<?php

/*
|--------------------------------------------------------------------------
| CORS Configuration — DeltaJalan
|--------------------------------------------------------------------------
|
| Konfigurasi Cross-Origin Resource Sharing untuk mengizinkan frontend
| React mengakses API Laravel dari port yang berbeda.
|
| Di production, ganti allowed_origins dengan domain frontend yang spesifik.
| Contoh: ['https://jalankita.dishub-sidoarjo.go.id']
|
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Paths yang Diizinkan CORS
    |--------------------------------------------------------------------------
    |
    | Hanya route yang cocok dengan pola ini yang akan mendapat header CORS.
    | 'api/*' mencakup semua endpoint API kita.
    |
    */
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    /*
    |--------------------------------------------------------------------------
    | Metode HTTP yang Diizinkan
    |--------------------------------------------------------------------------
    */
    'allowed_methods' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Origin yang Diizinkan
    |--------------------------------------------------------------------------
    |
    | Daftar origin (domain + port) yang boleh mengakses API.
    | Tambahkan FRONTEND_URL di .env untuk production.
    | URL ngrok untuk development diambil dari .env agar tidak di-hardcode di sini.
    |
    */
    'allowed_origins' => array_filter(array_unique([
        '*',
        env('FRONTEND_URL'),
        env('NGROK_URL'),
        'https://delta-jalan.vercel.app',
    ])),

    'allowed_origins_patterns' => [
        '#^https?://.*\.vercel\.app$#',
    ],

    /*
    |--------------------------------------------------------------------------
    | Header yang Diizinkan
    |--------------------------------------------------------------------------
    */
    'allowed_headers' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Header yang Diekspos ke Browser
    |--------------------------------------------------------------------------
    */
    'exposed_headers' => [],

    /*
    |--------------------------------------------------------------------------
    | Durasi Cache Preflight (detik)
    |--------------------------------------------------------------------------
    |
    | Browser akan meng-cache hasil preflight OPTIONS request selama ini.
    | 0 = tidak di-cache (berguna saat development).
    |
    */
    'max_age' => 0,

    /*
    |--------------------------------------------------------------------------
    | Izinkan Credentials (Cookie, Authorization Header)
    |--------------------------------------------------------------------------
    |
    | Set ke true jika frontend mengirim cookie atau Authorization header.
    | Jika true, allowed_origins TIDAK boleh menggunakan wildcard '*'.
    |
    */
    'supports_credentials' => false,

];
