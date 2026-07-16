<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supervisor_uptd', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('uptd_id');
            $table->unsignedSmallInteger('priority')->default(0);
            $table->timestamps();

            $table->primary(['user_id', 'uptd_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('uptd_id')->references('id')->on('uptd')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supervisor_uptd');
    }
};
