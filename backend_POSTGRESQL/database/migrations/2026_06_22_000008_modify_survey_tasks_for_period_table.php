<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->uuid('period_id')->nullable()->after('id');

            $table->foreign('period_id')
                ->references('id')->on('survey_periods')->onDelete('cascade');
            $table->index('period_id');
        });

        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN assigned_to DROP NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN assigned_by DROP NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN priority DROP NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN status DROP NOT NULL');

        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN priority SET DEFAULT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN status SET DEFAULT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN status SET NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN priority SET NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN assigned_by SET NOT NULL');
        DB::statement('ALTER TABLE survey_tasks ALTER COLUMN assigned_to SET NOT NULL');

        DB::statement("ALTER TABLE survey_tasks ALTER COLUMN priority SET DEFAULT 'Sedang'");
        DB::statement("ALTER TABLE survey_tasks ALTER COLUMN status SET DEFAULT 'aktif'");

        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropForeign(['period_id']);
            $table->dropIndex(['period_id']);
            $table->dropColumn('period_id');
        });
    }
};
