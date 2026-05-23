<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Menambahkan kolom batch upload, trust score, koordinat sumber,
 * dan AI results ke tabel reports.
 *
 * Sesuai solution.md — Task Database Migration.
 * Hanya menambah kolom baru, tidak mengubah kolom yang sudah ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // ── Batch Upload ──────────────────────────────────────────────
            $table->uuid('batch_id')->nullable()->index()->after('id');
            $table->boolean('is_batch_main')->default(false)->after('batch_id');
            $table->boolean('is_batch_sub')->default(false)->after('is_batch_main');
            // parent_report_id harus UUID agar cocok dengan reports.id (UUID PK)
            $table->uuid('parent_report_id')->nullable()->after('is_batch_sub');

            // ── Trust Score ───────────────────────────────────────────────
            $table->unsignedTinyInteger('trust_score')->default(0)->after('status');
            $table->jsonb('trust_breakdown')->nullable()->after('trust_score');

            // ── Koordinat Sumber ──────────────────────────────────────────
            $table->string('koordinat_sumber', 20)->default('manual')->after('longitude');

            // ── AI Results (tambahkan jika belum ada) ─────────────────────
            $table->string('ai_jenis_kerusakan', 100)->nullable()->after('ai_raw_output');
            $table->string('ai_severity', 20)->nullable()->after('ai_jenis_kerusakan');
            $table->decimal('ai_confidence', 4, 3)->nullable()->after('ai_severity');
        });

        // trust_label menggunakan string biasa karena PostgreSQL ENUM butuh CREATE TYPE
        // dan kita tidak ingin konflik dengan tipe yang sudah ada
        DB::statement("ALTER TABLE reports ADD COLUMN trust_label VARCHAR(10) NOT NULL DEFAULT 'merah'");

        // Foreign key untuk parent_report_id (self-referencing UUID → UUID)
        DB::statement("
            ALTER TABLE reports
            ADD CONSTRAINT reports_parent_report_id_foreign
            FOREIGN KEY (parent_report_id)
            REFERENCES reports(id)
            ON DELETE SET NULL
        ");
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // Hapus foreign key dulu sebelum drop kolom
            $table->dropForeign('reports_parent_report_id_foreign');
            $table->dropIndex(['batch_id']);
            $table->dropColumn([
                'batch_id',
                'is_batch_main',
                'is_batch_sub',
                'parent_report_id',
                'trust_score',
                'trust_breakdown',
                'koordinat_sumber',
                'ai_jenis_kerusakan',
                'ai_severity',
                'ai_confidence',
            ]);
        });

        DB::statement("ALTER TABLE reports DROP COLUMN IF EXISTS trust_label");
    }
};
