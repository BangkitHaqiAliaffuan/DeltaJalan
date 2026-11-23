<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotensi laporan warga.
 *
 * Masalah yang diselesaikan: aplikasi Android menyimpan laporan ke antrean saat
 * sinyal hilang, padahal permintaan sebelumnya bisa saja **sudah** tersimpan di
 * server (respons hilang di jalan). Tanpa kunci idempotensi, percobaan ulang
 * membuat laporan kedua — atau ditolak 422 DUPLICATE_IMAGE sehingga pengguna
 * diberi tahu "gagal" padahal laporannya ada.
 *
 * Kolom nullable: laporan dari Telegram, batch petugas, dan data lama tidak
 * mengirim kunci ini. Indeks unik parsial `(user_id, idempotency_key)` hanya
 * berlaku untuk baris yang punya kunci (pola sama dengan
 * `2026_11_09_000002_harden_native_inspection_idempotency`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('idempotency_key', 120)->nullable()->after('user_id');
        });

        DB::statement(
            'CREATE UNIQUE INDEX reports_user_idempotency_unique ON reports (user_id, idempotency_key) '.
            'WHERE idempotency_key IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS reports_user_idempotency_unique');

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('idempotency_key');
        });
    }
};
