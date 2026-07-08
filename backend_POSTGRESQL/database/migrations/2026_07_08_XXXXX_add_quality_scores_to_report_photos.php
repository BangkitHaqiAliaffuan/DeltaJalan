<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->jsonb('quality_scores')->nullable()->after('mobileclip_label');
        });
    }

    public function down(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->dropColumn('quality_scores');
        });
    }
};
