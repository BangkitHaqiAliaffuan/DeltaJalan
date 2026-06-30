<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->timestamp('ditugaskan_at')->nullable()->after('assigned_at');
            $table->timestamp('deadline_mulai')->nullable()->after('ditugaskan_at');
            $table->boolean('terlambat_mulai')->default(false)->after('deadline_mulai');
            $table->string('assignor_name', 100)->nullable()->after('terlambat_mulai');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['ditugaskan_at', 'deadline_mulai', 'terlambat_mulai', 'assignor_name']);
        });
    }
};
