<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_sessions', function (Blueprint $table) {
            $table->string('idempotency_key', 120)->nullable();
            $table->string('request_fingerprint', 64)->nullable();
        });
        Schema::table('inspection_results', function (Blueprint $table) {
            $table->string('request_fingerprint', 64)->nullable();
        });
        DB::statement("CREATE UNIQUE INDEX inspection_sessions_task_idempotency_unique ON inspection_sessions (survey_task_id, idempotency_key) WHERE idempotency_key IS NOT NULL");
        DB::statement("CREATE UNIQUE INDEX survey_task_reports_one_active_report_unique ON survey_task_reports (report_id) WHERE status IN ('assigned', 'started')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS survey_task_reports_one_active_report_unique');
        DB::statement('DROP INDEX IF EXISTS inspection_sessions_task_idempotency_unique');
        Schema::table('inspection_results', fn (Blueprint $table) => $table->dropColumn('request_fingerprint'));
        Schema::table('inspection_sessions', function (Blueprint $table) {
            $table->dropColumn(['request_fingerprint', 'idempotency_key']);
        });
    }
};
