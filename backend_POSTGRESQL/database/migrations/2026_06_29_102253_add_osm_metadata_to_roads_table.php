<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roads', function (Blueprint $table) {
            $table->string('osm_id', 50)->nullable()->after('kode_ruas');
            $table->string('highway_type', 30)->nullable()->after('sumber_polyline');
            $table->string('surface', 30)->nullable()->after('highway_type');
        });
    }

    public function down(): void
    {
        Schema::table('roads', function (Blueprint $table) {
            $table->dropColumn(['osm_id', 'highway_type', 'surface']);
        });
    }
};
