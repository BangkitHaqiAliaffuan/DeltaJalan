<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_after_photos', function (Blueprint $table) {
            $table->id();
            $table->uuid('report_id');
            $table->string('file_path', 500);
            $table->string('file_hash', 64)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('report_id')
                  ->references('id')
                  ->on('reports')
                  ->onDelete('cascade');

            $table->index('report_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_after_photos');
    }
};
