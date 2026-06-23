<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->string('jam_mulai', 5)->default('07:00');
            $table->string('jam_selesai', 5)->default('16:00');
        });
    }

    public function down(): void
    {
        Schema::table('survey_tasks', function (Blueprint $table) {
            $table->dropColumn(['jam_mulai', 'jam_selesai']);
        });
    }
};
