<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Perlebar kolom image_hash dari VARCHAR(32) ke VARCHAR(64).
 *
 * Alasan: image_hash sebelumnya menyimpan MD5 (32 karakter hex).
 * Sekarang menggunakan SHA-256 (64 karakter hex) yang lebih aman.
 *
 * Berlaku untuk tabel reports dan report_evidences.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Tabel reports — hapus unique constraint dulu, ubah tipe, buat ulang
        DB::statement('ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_image_hash_unique');
        DB::statement('ALTER TABLE reports ALTER COLUMN image_hash TYPE VARCHAR(64)');
        DB::statement('ALTER TABLE reports ADD CONSTRAINT reports_image_hash_unique UNIQUE (image_hash)');

        // Tabel report_evidences — tidak ada unique constraint, cukup ubah tipe
        // report_evidences sudah dihapus di migration 2026_06_08, jadi cek dulu
        if (Schema::hasTable('report_evidences')) {
            DB::statement('ALTER TABLE report_evidences ALTER COLUMN image_hash TYPE VARCHAR(64)');
        }
    }

    public function down(): void
    {
        // Potong nilai yang lebih panjang dari 32 karakter sebelum mengecilkan kolom
        DB::statement('UPDATE reports SET image_hash = LEFT(image_hash, 32) WHERE LENGTH(image_hash) > 32');
        DB::statement('ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_image_hash_unique');
        DB::statement('ALTER TABLE reports ALTER COLUMN image_hash TYPE VARCHAR(32)');
        DB::statement('ALTER TABLE reports ADD CONSTRAINT reports_image_hash_unique UNIQUE (image_hash)');

        if (Schema::hasTable('report_evidences')) {
            DB::statement('UPDATE report_evidences SET image_hash = LEFT(image_hash, 32) WHERE LENGTH(image_hash) > 32');
            DB::statement('ALTER TABLE report_evidences ALTER COLUMN image_hash TYPE VARCHAR(32)');
        }
    }
};
