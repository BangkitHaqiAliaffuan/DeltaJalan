<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->uuid('survey_task_id')->nullable()->after('assigned_upr_id');
            $table->foreign('survey_task_id')
                ->references('id')->on('survey_tasks')->onDelete('set null');
            $table->index('survey_task_id');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['survey_task_id']);
            $table->dropIndex(['survey_task_id']);
            $table->dropColumn('survey_task_id');
        });
    }
};
