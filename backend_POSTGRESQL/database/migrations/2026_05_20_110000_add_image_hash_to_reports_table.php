<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Menambahkan kolom image_hash ke tabel reports.
 *
 * Kolom ini menyimpan nilai MD5 hash dari konten biner foto,
 * digunakan untuk mendeteksi dan mencegah upload foto yang identik
 * (Requirement 9: Filter Keamanan Image Hash).
 *
 * Constraint UNIQUE memastikan tidak ada dua laporan dengan foto persis sama.
 * Nullable karena laporan lama tidak memiliki hash, dan jika hashing gagal
 * laporan tetap bisa disimpan (graceful degradation).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // VARCHAR(32) = panjang tepat MD5 hex string
            // nullable = laporan lama & fallback jika hashing gagal
            // unique = tidak boleh ada dua laporan dengan foto identik
            $table->string('image_hash', 32)
                  ->nullable()
                  ->unique()
                  ->after('image_result_path');

            // Index eksplisit untuk query pengecekan hash (meskipun unique sudah buat index)
            // Ini memastikan query WHERE image_hash = ? berjalan cepat
            $table->index('image_hash');

            // Kolom support_count: jumlah petugas yang mendukung laporan ini
            // (Requirement 10: Add Evidence API)
            $table->unsignedInteger('support_count')
                  ->default(0)
                  ->after('image_hash');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex(['image_hash']);
            $table->dropUnique(['image_hash']);
            $table->dropColumn(['image_hash', 'support_count']);
        });
    }
};
