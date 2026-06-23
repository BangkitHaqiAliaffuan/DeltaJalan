<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->uuid('road_id')->nullable()->after('survey_task_id');
            $table->foreign('road_id')->references('id')->on('roads')->nullOnDelete();
            $table->integer('sta_meter')->nullable()->after('longitude');
            $table->string('sta_label', 20)->nullable()->after('sta_meter');
            $table->json('road_polyline')->nullable()->after('sta_label');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['road_id']);
            $table->dropColumn(['road_id', 'sta_meter', 'sta_label', 'road_polyline']);
        });
    }
};
