<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dimensi kerusakan hasil pengukuran petugas di lapangan.
 *
 * ── Mengapa tabel ini, bukan `reports` ─────────────────────────────────────
 * `reports.kerusakan_panjang/lebar` adalah angka yang diisi PELAPOR (warga),
 * biasanya perkiraan kasar dari foto. Hasil ukur petugas di lapangan adalah
 * fakta yang berbeda dan harus dapat dibandingkan dengan klaim pelapor —
 * karena itu disimpan terpisah di sini, tidak menimpa data warga (keputusan
 * sesi 2026-11-15, "Opsi A").
 *
 * ── Semua nullable ────────────────────────────────────────────────────────
 * Petugas yang tidak membawa meteran tidak boleh dipaksa mengarang angka.
 * Kosong lebih jujur daripada palsu: UI menampilkannya sebagai "tidak diukur".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_results', function (Blueprint $table) {
            $table->decimal('kerusakan_panjang', 8, 2)->nullable()->after('notes');
            $table->decimal('kerusakan_lebar', 8, 2)->nullable()->after('kerusakan_panjang');
            $table->decimal('kerusakan_kedalaman', 8, 2)->nullable()->after('kerusakan_lebar');
        });
    }

    public function down(): void
    {
        Schema::table('inspection_results', function (Blueprint $table) {
            $table->dropColumn([
                'kerusakan_panjang',
                'kerusakan_lebar',
                'kerusakan_kedalaman',
            ]);
        });
    }
};
