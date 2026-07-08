<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->decimal('mobileclip_score', 4, 3)->nullable()->after('photo_taken_at');
            $table->string('mobileclip_label', 50)->nullable()->after('mobileclip_score');
        });
    }

    public function down(): void
    {
        Schema::table('report_photos', function (Blueprint $table) {
            $table->dropColumn(['mobileclip_score', 'mobileclip_label']);
        });
    }
};
