<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_upload_counters', function (Blueprint $table) {
            $table->id();
            $table->string('identifier_type', 20);
            $table->string('identifier_hash', 64);
            $table->date('report_date');
            $table->integer('count')->default(0);
            $table->timestamps();

            $table->unique(['identifier_type', 'identifier_hash', 'report_date'], 'upload_counters_unique');
            $table->index(['identifier_type', 'identifier_hash', 'report_date'], 'upload_counters_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_upload_counters');
    }
};
