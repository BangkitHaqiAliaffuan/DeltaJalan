<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['deadline_mulai', 'terlambat_mulai']);
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->timestamp('deadline_mulai')->nullable()->after('ditugaskan_at');
            $table->boolean('terlambat_mulai')->default(false)->after('deadline_mulai');
        });
    }
};
