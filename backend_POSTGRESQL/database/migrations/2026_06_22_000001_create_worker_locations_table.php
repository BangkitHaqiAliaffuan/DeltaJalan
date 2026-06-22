<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worker_locations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->double('latitude', 10, 7);
            $table->double('longitude', 10, 7);
            $table->integer('battery_level')->nullable();
            $table->timestamp('tracked_at');
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')->on('users')->onDelete('cascade');
            $table->index('user_id');
            $table->index('tracked_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_locations');
    }
};
