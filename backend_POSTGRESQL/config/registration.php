<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Verifikasi OTP Pendaftaran Warga
    |--------------------------------------------------------------------------
    |
    | Angka-angka di bawah mengatur alur OTP email saat pendaftaran warga
    | (manual maupun lewat Google). Challenge disimpan di Cache — lihat
    | App\Services\RegistrationOtpService.
    |
    */

    /** Masa berlaku kode OTP (menit). Menyamai TTL onboarding Google. */
    'otp_ttl_minutes' => (int) env('REGISTRATION_OTP_TTL_MINUTES', 15),

    /** Panjang kode OTP (digit). */
    'otp_length' => (int) env('REGISTRATION_OTP_LENGTH', 6),

    /** Maksimal percobaan verifikasi salah sebelum challenge dibuang. */
    'otp_max_attempts' => (int) env('REGISTRATION_OTP_MAX_ATTEMPTS', 5),

    /** Jeda minimum antar pengiriman ulang kode (detik). */
    'otp_resend_cooldown_seconds' => (int) env('REGISTRATION_OTP_RESEND_COOLDOWN', 60),

    /** Batas jumlah pengiriman ulang per challenge (anti-abuse email bomb). */
    'otp_max_sends' => (int) env('REGISTRATION_OTP_MAX_SENDS', 3),

];