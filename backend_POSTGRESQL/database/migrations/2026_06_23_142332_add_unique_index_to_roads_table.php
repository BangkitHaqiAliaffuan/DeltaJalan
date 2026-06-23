<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roads', function (Blueprint $table) {
            $table->unique(['nama_ruas', 'kecamatan']);
        });
    }

    public function down(): void
    {
        Schema::table('roads', function (Blueprint $table) {
            $table->dropUnique(['nama_ruas', 'kecamatan']);
        });
    }
};
