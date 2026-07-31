<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_analyses', function (Blueprint $table) {
            $table->id();
            $table->uuid('batch_id')->unique();
            $table->jsonb('analyses');
            $table->timestamp('created_at')->useCurrent();

            $table->index('created_at', 'batch_analyses_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_analyses');
    }
};
