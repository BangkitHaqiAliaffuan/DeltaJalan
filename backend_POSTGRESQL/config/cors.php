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
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost',
        'capacitor://localhost',
        env('FRONTEND_URL'),
        env('NGROK_URL'),
        'https://delta-jalan.vercel.app',
    ])),

    'allowed_origins_patterns' => [
        '#^https?://[a-z0-9-]+\.vercel\.app$#',
        '#^capacitor://localhost$#',
    ],

    /*
    |--------------------------------------------------------------------------
    | Header yang Diizinkan
    |--------------------------------------------------------------------------
    */
    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Device-ID',
        'Accept',
        'Origin',
    ],

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
    'max_age' => 600,

    /*
    |--------------------------------------------------------------------------
    | Izinkan Credentials (Cookie, Authorization Header)
    |--------------------------------------------------------------------------
    |
    | Set ke true jika frontend mengirim cookie atau Authorization header.
    | Jika true, allowed_origins TIDAK boleh menggunakan wildcard '*'.
    |
    */
    'supports_credentials' => true,

];
