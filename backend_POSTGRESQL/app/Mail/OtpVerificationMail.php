<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email berisi kode OTP pendaftaran warga.
 *
 * SENGAJA TIDAK ShouldQueue: ini jalur paling kritis (user menunggu di layar
 * OTP). Dengan QUEUE_CONNECTION=database tanpa `queue:work` berjalan, mailable
 * ber-queue tidak akan pernah terkirim — kegagalan diam yang sulit dilacak.
 * Pengiriman inline membuat OTP tiba seketika; dengan MAIL_MAILER=log kode
 * langsung muncul di storage/logs/laravel.log sehingga alur bisa diuji lokal.
 */
class OtpVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $code,
        public readonly string $recipientName,
        public readonly int $ttlMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Kode Verifikasi Pendaftaran DeltaJalan',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp-verification',
            with: [
                'code' => $this->code,
                'recipientName' => $this->recipientName,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }
}