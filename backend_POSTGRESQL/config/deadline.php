<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Deadlines (Batas Waktu) per Prioritas
    |--------------------------------------------------------------------------
    |
    | Menentukan batas waktu (dalam jam) untuk setiap prioritas laporan.
    | - review_hours: batas waktu supervisor melakukan review (approve/tolak)
    |   sejak laporan dibuat (created_at).
    | - resolution_hours: batas waktu perbaikan selesai sejak laporan
    |   ditugaskan (ditugaskan_at).
    | - assignment_start_hours: batas waktu tim satgas mulai bekerja
    |   sejak ditugaskan (dalam jam).
    | - warning_hours_before: waktu peringatan dikirim sebelum deadline (dalam jam).
    |
    */

    'Tinggi' => [
        'review_hours' => 24,
        'resolution_hours' => 72,
        'assignment_start_hours' => 48,
        'warning_hours_before' => 8,
    ],

    'Sedang' => [
        'review_hours' => 72,
        'resolution_hours' => 168, // 7 hari
        'assignment_start_hours' => 48,
        'warning_hours_before' => 24,
    ],

    'Rendah' => [
        'review_hours' => 168, // 7 hari
        'resolution_hours' => 336, // 14 hari
        'assignment_start_hours' => 48,
        'warning_hours_before' => 48,
    ],
];
