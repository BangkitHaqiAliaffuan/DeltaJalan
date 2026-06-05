<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('status_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->foreign('report_id')->references('id')->on('reports')->onDelete('cascade');
            $table->string('old_status')->nullable();
            $table->string('new_status');
            $table->string('actor_name')->nullable();
            $table->string('actor_role')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('status_logs');
    }
};
