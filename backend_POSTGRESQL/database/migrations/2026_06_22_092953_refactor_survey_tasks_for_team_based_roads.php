<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->uuid('team_id')->nullable()->after('status');
            $table->foreign('team_id')->references('id')->on('teams')->nullOnDelete();
        });

        if (Schema::hasColumn('survey_tasks', 'period_id')) {
            Schema::table('survey_tasks', function (Blueprint $table) {
                $table->dropForeign(['period_id']);
                $table->dropColumn('period_id');
            });
        }

        if (Schema::hasColumn('survey_tasks', 'assigned_to')) {
            Schema::table('survey_tasks', function (Blueprint $table) {
                $table->dropColumn(['assigned_to', 'assigned_by']);
            });
        }

        Schema::dropIfExists('survey_periods');
    }

    public function down(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropForeign(['team_id']);
            $table->dropColumn('team_id');
        });

        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->uuid('period_id')->nullable()->after('status');
            $table->foreign('period_id')->references('id')->on('survey_periods')->nullOnDelete();
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->unsignedBigInteger('assigned_by')->nullable();
        });

        Schema::create('survey_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->uuid('team_id');
            $table->foreign('team_id')->references('id')->on('teams');
            $table->text('notes')->nullable();
            $table->string('status');
            $table->unsignedBigInteger('created_by');
            $table->timestamps();
        });
    }
};
