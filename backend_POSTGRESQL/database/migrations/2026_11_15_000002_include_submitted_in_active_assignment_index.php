<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Assignment yang sudah `submitted` masih menunggu review supervisor, jadi
 * laporan tersebut belum boleh masuk antrean inspeksi baru. Partial unique
 * index sebelumnya hanya menjaga `assigned`/`started`, sehingga dua rantai
 * inspeksi untuk satu laporan masih bisa lolos di level database.
 *
 * Constraint aplikasi (`NativeInspectionController::BLOCKING`) diperluas di
 * commit yang sama; index ini adalah jaring pengaman terakhir untuk request
 * bersamaan.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS survey_task_reports_one_active_report_unique');
        DB::statement("CREATE UNIQUE INDEX survey_task_reports_one_active_report_unique ON survey_task_reports (report_id) WHERE status IN ('assigned', 'started', 'submitted')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS survey_task_reports_one_active_report_unique');
        DB::statement("CREATE UNIQUE INDEX survey_task_reports_one_active_report_unique ON survey_task_reports (report_id) WHERE status IN ('assigned', 'started')");
    }
};
