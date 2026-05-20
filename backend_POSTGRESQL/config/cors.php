<?php

/*
|--------------------------------------------------------------------------
| CORS Configuration — JalanKita
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
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

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
    | Untuk development, kita izinkan semua port localhost yang umum dipakai.
    |
    */
    'allowed_origins' => [
        'http://localhost:3000',   // React default
        'https://af3e-2404-c0-b203-e4b-b039-aeca-3b55-7fd1.ngrok-free.app',
        'https://225a-114-8-223-252.ngrok-free.app',
        'http://localhost:5173',   // Vite default
        'http://localhost:8080',   // Port alternatif
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
    ],

    /*
    |--------------------------------------------------------------------------
    | Pola Origin yang Diizinkan (Regex)
    |--------------------------------------------------------------------------
    |
    | Alternatif dari allowed_origins menggunakan pola regex.
    | Kosongkan jika sudah menggunakan allowed_origins di atas.
    |
    */
    'allowed_origins_patterns' => [],

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
