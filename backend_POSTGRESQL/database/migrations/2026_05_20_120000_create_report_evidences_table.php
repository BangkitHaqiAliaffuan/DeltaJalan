<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Membuat tabel report_evidences.
 *
 * Tabel ini menyimpan foto bukti tambahan yang dikirim oleh petugas
 * melalui fitur "Dukung Laporan" (Add Evidence API).
 *
 * Alih-alih membuat laporan baru, petugas yang menemukan kerusakan yang sama
 * dapat menambahkan foto bukti ke laporan yang sudah ada.
 *
 * Requirement 10: Add Evidence API
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_evidences', function (Blueprint $table) {
            // Primary Key — UUID
            $table->uuid('id')->primary();

            // Foreign key ke tabel reports
            $table->uuid('report_id');
            $table->foreign('report_id')
                  ->references('id')
                  ->on('reports')
                  ->onDelete('cascade'); // Hapus evidence jika laporan dihapus

            // Path foto bukti di storage
            $table->string('image_path', 500);

            // MD5 hash foto bukti — untuk mencegah upload foto identik
            // nullable karena jika hashing gagal, evidence tetap bisa disimpan
            $table->string('image_hash', 32)->nullable();

            // Nama petugas yang mengirim bukti
            $table->string('reporter_name', 100);

            // Catatan tambahan dari petugas (opsional)
            $table->text('notes')->nullable();

            // Timestamps
            $table->timestamps();

            // Indexes
            $table->index('report_id');
            $table->index('image_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_evidences');
    }
};
