<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('kode_ruas', 20)->nullable();
            $table->string('nama_ruas', 255);
            $table->string('kecamatan', 100);
            $table->decimal('panjang_km', 8, 3)->nullable();
            $table->json('polyline')->nullable();
            $table->string('sumber_polyline', 20)->default('osm');
            $table->timestamps();

            $table->index('kecamatan');
            $table->index('nama_ruas');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roads');
    }
};
