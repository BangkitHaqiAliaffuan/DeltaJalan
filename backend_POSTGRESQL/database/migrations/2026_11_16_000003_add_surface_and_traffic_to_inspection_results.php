<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Karakteristik lokasi hasil inspeksi: jenis perkerasan & kepadatan lalu lintas.
 *
 * ── Mengapa dua kolom ini ─────────────────────────────────────────────────
 * Jenis perkerasan menentukan MATERIAL perbaikan: jalan aspal ditambal
 * hotmix, jalan beton dipatch dengan beton, paving block diangkat dan
 * dipasang ulang. Tanpa data ini, tim perbaikan harus menebak dari foto.
 *
 * Kepadatan lalu lintas menentukan PRIORITAS: lubang yang sama besar di
 * jalan arteri yang dilewati truk jauh lebih mendesak daripada di jalan
 * kampung yang sepi. Nilai ini dipakai untuk mengisi `reports.priority`
 * saat supervisor menyetujui hasil inspeksi, bukan sekadar disimpan.
 *
 * ── Semua nullable ────────────────────────────────────────────────────────
 * Petugas tidak boleh dipaksa memilih bila ragu. Kosong berarti "belum
 * dicatat", dan prioritas laporan tetap seperti sebelumnya (tidak berubah).
 *
 * ── Mengapa string, bukan enum PostgreSQL ─────────────────────────────────
 * Daftar pilihan bisa berkembang (mis. "Paving" → "Paving Beton" /
 * "Paving Plastik"). Enum PostgreSQL menuntut ALTER TYPE yang merepotkan di
 * produksi; validasi daftar nilai dilakukan di lapisan aplikasi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_results', function (Blueprint $table) {
            $table->string('jenis_perkerasan', 32)->nullable()->after('kerusakan_kedalaman');
            $table->string('kepadatan_lalu_lintas', 16)->nullable()->after('jenis_perkerasan');
        });
    }

    public function down(): void
    {
        Schema::table('inspection_results', function (Blueprint $table) {
            $table->dropColumn([
                'jenis_perkerasan',
                'kepadatan_lalu_lintas',
            ]);
        });
    }
};
