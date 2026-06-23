<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->date('tanggal_patroli')->nullable()->after('kecamatan');
            $table->string('alasan_tugas', 50)->nullable()->default('rutin')->after('priority');
            $table->timestamp('selesai_at')->nullable()->after('updated_at');
        });

        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->index(['kecamatan', 'tanggal_patroli'], 'idx_survey_tasks_kecamatan_tanggal');
        });
    }

    public function down(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropIndex('idx_survey_tasks_kecamatan_tanggal');
        });

        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropColumn(['tanggal_patroli', 'alasan_tugas', 'selesai_at']);
        });
    }
};
