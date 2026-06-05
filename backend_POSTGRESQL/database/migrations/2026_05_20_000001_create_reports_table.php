<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Membuat tabel 'reports' untuk sistem DeltaJalan.
 *
 * Tabel ini menyimpan seluruh data laporan kerusakan jalan,
 * mulai dari informasi petugas, lokasi GPS, foto, hingga
 * hasil analisis AI dari server FastAPI.
 *
 * Catatan teknis PostgreSQL ENUM:
 * Karena Laravel Blueprint tidak mendukung pembuatan tipe ENUM PostgreSQL
 * secara native, kita menggunakan pendekatan dua langkah:
 * 1. Buat tipe ENUM via DB::statement
 * 2. Buat tabel tanpa kolom ENUM terlebih dahulu
 * 3. Tambahkan kolom ENUM via ALTER TABLE
 */
return new class extends Migration
{
    /**
     * Jalankan migration (buat tabel).
     */
    public function up(): void
    {
        // ── Langkah 1: Buat tipe ENUM PostgreSQL native ───────────────────
        DB::statement("CREATE TYPE severity_enum AS ENUM ('Baik', 'Rusak Ringan', 'Rusak Sedang', 'Rusak Berat')");
        DB::statement("CREATE TYPE status_enum AS ENUM ('Menunggu Review', 'Sedang Diperbaiki', 'Selesai')");

        // ── Langkah 2: Buat tabel tanpa kolom ENUM ───────────────────────
        Schema::create('reports', function (Blueprint $table) {
            // Primary Key — UUID
            $table->uuid('id')->primary();

            // Identitas laporan
            $table->string('report_code', 20)->unique();
            $table->string('reporter_name', 100);

            // Informasi lokasi
            $table->string('road_name', 255);
            $table->string('district', 100);
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);

            // Penyimpanan file foto
            $table->string('image_original_path', 500)->nullable();
            $table->string('image_result_path', 500)->nullable();

            // Data hasil analisis AI
            $table->integer('total_detections')->default(0);
            // Kolom overall_severity dan status akan ditambahkan via ALTER TABLE
            // setelah tabel dibuat, agar bisa menggunakan tipe ENUM PostgreSQL native.

            // JSONB untuk menyimpan seluruh payload deteksi dari FastAPI
            $table->jsonb('ai_raw_output')->nullable();

            // Catatan internal sistem
            $table->text('system_notes')->nullable();

            // Timestamps (created_at, updated_at)
            $table->timestamps();

            // Indexes untuk query yang sering digunakan
            $table->index('district');
            $table->index('created_at');
        });

        // ── Langkah 3: Tambahkan kolom ENUM via ALTER TABLE ───────────────
        // Ini adalah cara yang benar untuk menambahkan kolom dengan tipe
        // ENUM PostgreSQL native yang sudah dibuat di langkah 1.
        DB::statement("
            ALTER TABLE reports
            ADD COLUMN overall_severity severity_enum NOT NULL DEFAULT 'Baik'
        ");

        DB::statement("
            ALTER TABLE reports
            ADD COLUMN status status_enum NOT NULL DEFAULT 'Menunggu Review'
        ");

        // Tambahkan index untuk kolom ENUM setelah kolom dibuat
        DB::statement("CREATE INDEX reports_overall_severity_index ON reports (overall_severity)");
        DB::statement("CREATE INDEX reports_status_index ON reports (status)");
    }

    /**
     * Batalkan migration (hapus tabel).
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');

        // Hapus tipe ENUM setelah tabel dihapus
        // (tipe tidak bisa dihapus jika masih digunakan oleh tabel)
        DB::statement('DROP TYPE IF EXISTS severity_enum');
        DB::statement('DROP TYPE IF EXISTS status_enum');
    }
};
