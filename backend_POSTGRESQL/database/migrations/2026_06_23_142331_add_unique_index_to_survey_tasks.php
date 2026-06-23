<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            DELETE FROM survey_tasks
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY team_id, kecamatan, tanggal_patroli
                               ORDER BY created_at, id
                           ) AS rn
                    FROM survey_tasks
                    WHERE status = 'aktif'
                ) dups
                WHERE rn > 1
            )
        ");

        DB::statement("
            CREATE UNIQUE INDEX idx_survey_tasks_team_kecamatan_tgl
            ON survey_tasks (team_id, kecamatan, tanggal_patroli)
            WHERE status = 'aktif'
        ");
    }

    public function down(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropIndex('idx_survey_tasks_team_kecamatan_tgl');
        });
    }
};
