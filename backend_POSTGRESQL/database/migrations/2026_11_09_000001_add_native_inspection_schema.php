<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('patrol_schedules', 'schedule_type')) {
            Schema::table('patrol_schedules', function (Blueprint $table) {
                $table->string('schedule_type', 40)->default('patrol')->index();
            });
        }
        if (! Schema::hasColumn('survey_tasks', 'patrol_schedule_id')) {
            Schema::table('survey_tasks', function (Blueprint $table) {
                $table->uuid('patrol_schedule_id')->nullable()->index();
                $table->foreign('patrol_schedule_id')->references('id')->on('patrol_schedules')->nullOnDelete();
            });
        }

        Schema::create('inspection_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('survey_task_id')->nullable();
            $table->uuid('patrol_schedule_id')->nullable();
            $table->uuid('team_id');
            $table->unsignedBigInteger('started_by');
            $table->string('schedule_type', 40)->default('report_inspection');
            $table->string('status', 20)->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->foreign('survey_task_id')->references('id')->on('survey_tasks')->nullOnDelete();
            $table->foreign('patrol_schedule_id')->references('id')->on('patrol_schedules')->nullOnDelete();
            $table->foreign('team_id')->references('id')->on('teams')->restrictOnDelete();
            $table->foreign('started_by')->references('id')->on('users')->restrictOnDelete();
            $table->index(['team_id', 'status']);
        });

        Schema::create('survey_task_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('survey_task_id')->nullable();
            $table->uuid('inspection_session_id');
            $table->uuid('report_id');
            $table->uuid('team_id');
            $table->string('status', 25)->default('assigned');
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->foreign('survey_task_id')->references('id')->on('survey_tasks')->nullOnDelete();
            $table->foreign('inspection_session_id')->references('id')->on('inspection_sessions')->cascadeOnDelete();
            $table->foreign('report_id')->references('id')->on('reports')->cascadeOnDelete();
            $table->foreign('team_id')->references('id')->on('teams')->restrictOnDelete();
            $table->unique(['inspection_session_id', 'report_id']);
            $table->index(['report_id', 'status']);
        });

        Schema::create('inspection_results', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('survey_task_report_id');
            $table->uuid('report_id');
            $table->unsignedBigInteger('inspector_id');
            $table->string('result', 30)->default('submitted');
            $table->string('condition', 40)->nullable();
            $table->text('notes')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('idempotency_key', 120);
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->foreign('survey_task_report_id')->references('id')->on('survey_task_reports')->cascadeOnDelete();
            $table->foreign('report_id')->references('id')->on('reports')->cascadeOnDelete();
            $table->foreign('inspector_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->unique('survey_task_report_id');
            $table->unique(['inspector_id', 'idempotency_key']);
            $table->index(['result', 'created_at']);
        });

        Schema::create('inspection_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('inspection_result_id');
            $table->string('path', 500);
            $table->string('sha256', 64)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamp('taken_at')->nullable();
            $table->timestamps();
            $table->foreign('inspection_result_id')->references('id')->on('inspection_results')->cascadeOnDelete();
            $table->index('inspection_result_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_photos');
        Schema::dropIfExists('inspection_results');
        Schema::dropIfExists('survey_task_reports');
        Schema::dropIfExists('inspection_sessions');
        if (Schema::hasColumn('survey_tasks', 'patrol_schedule_id')) Schema::table('survey_tasks', fn (Blueprint $t) => $t->dropForeign(['patrol_schedule_id'])->dropColumn('patrol_schedule_id'));
        if (Schema::hasColumn('patrol_schedules', 'schedule_type')) Schema::table('patrol_schedules', fn (Blueprint $t) => $t->dropColumn('schedule_type'));
    }
};
