<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->timestamp('ai_analyzed_at')->nullable()->after('quality_scores');
            $table->unsignedSmallInteger('ai_analysis_count')->default(0)->after('ai_analyzed_at');
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->timestamp('ai_analyzed_at')->nullable();
            $table->unsignedSmallInteger('ai_analysis_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->dropColumn(['ai_analyzed_at', 'ai_analysis_count']);
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['ai_analyzed_at', 'ai_analysis_count']);
        });
    }
};
