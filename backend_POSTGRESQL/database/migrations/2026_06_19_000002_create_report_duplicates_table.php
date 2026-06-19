<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_duplicates', function (Blueprint $table) {
            $table->id();
            $table->uuid('report_id');
            $table->uuid('duplicate_of_id');
            $table->decimal('score', 4, 3)->nullable();
            $table->string('match_type', 20)->nullable();
            $table->timestamps();

            $table->foreign('report_id')
                  ->references('id')
                  ->on('reports')
                  ->onDelete('cascade');

            $table->foreign('duplicate_of_id')
                  ->references('id')
                  ->on('reports')
                  ->onDelete('cascade');

            $table->index('report_id');
            $table->index('duplicate_of_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_duplicates');
    }
};
