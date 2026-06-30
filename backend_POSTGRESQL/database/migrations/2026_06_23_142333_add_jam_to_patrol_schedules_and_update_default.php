<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patrol_schedules', function (Blueprint $table) {
            $table->string('jam_mulai', 5)->default('09:00');
            $table->string('jam_selesai', 5)->default('16:00');
        });

        DB::statement("ALTER TABLE survey_tasks ALTER COLUMN jam_mulai SET DEFAULT '09:00'");
    }

    public function down(): void
    {
        Schema::table('patrol_schedules', function (Blueprint $table) {
            $table->dropColumn(['jam_mulai', 'jam_selesai']);
        });

        DB::statement("ALTER TABLE survey_tasks ALTER COLUMN jam_mulai SET DEFAULT '07:00'");
    }
};
