<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Satu assignment boleh punya lebih dari satu InspectionResult.
 *
 * Alur `return` (supervisor meminta data/bukti dilengkapi) mengembalikan
 * assignment ke status `started`, lalu petugas mengirim hasil baru. Tanpa
 * migrasi ini, unique index lama (`survey_task_report_id`) membuat submit ulang
 * gagal di level database dan satu-satunya alternatif adalah menimpa hasil yang
 * sudah direview — yang menghapus histori inspeksi.
 *
 * Index biasa tetap dipertahankan agar pencarian per assignment tetap cepat.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE inspection_results DROP CONSTRAINT IF EXISTS inspection_results_survey_task_report_id_unique');
            DB::statement('DROP INDEX IF EXISTS inspection_results_survey_task_report_id_unique');
            DB::statement('CREATE INDEX IF NOT EXISTS inspection_results_assignment_index ON inspection_results (survey_task_report_id)');
        } else {
            try {
                \Illuminate\Support\Facades\Schema::table('inspection_results', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropUnique('inspection_results_survey_task_report_id_unique');
                });
            } catch (\Throwable) {
                try {
                    DB::statement('DROP INDEX IF EXISTS inspection_results_survey_task_report_id_unique');
                } catch (\Throwable) {}
            }
            try {
                \Illuminate\Support\Facades\Schema::table('inspection_results', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->index('survey_task_report_id', 'inspection_results_assignment_index');
                });
            } catch (\Throwable) {}
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS inspection_results_assignment_index');
            // Rollback hanya aman bila belum ada assignment dengan lebih dari satu
            // hasil (alur `return`). Kalau ada, constraint unik akan gagal dibuat dan
            // rollback berhenti — itu disengaja, bukan bug.
            DB::statement('ALTER TABLE inspection_results ADD CONSTRAINT inspection_results_survey_task_report_id_unique UNIQUE (survey_task_report_id)');
        } else {
            try {
                \Illuminate\Support\Facades\Schema::table('inspection_results', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropIndex('inspection_results_assignment_index');
                    $table->unique('survey_task_report_id', 'inspection_results_survey_task_report_id_unique');
                });
            } catch (\Throwable) {}
        }
    }
};
