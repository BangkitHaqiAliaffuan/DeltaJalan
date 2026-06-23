<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('uptd', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nama', 100);
            $table->json('kecamatan_wilayah');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uptd');
    }
};
