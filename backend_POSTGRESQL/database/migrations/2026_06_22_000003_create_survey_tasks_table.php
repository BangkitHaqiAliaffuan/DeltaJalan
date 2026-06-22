<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('road_name', 255);
            $table->string('kecamatan', 100)->nullable();
            $table->jsonb('road_geometry')->default('[]');
            $table->decimal('road_length_m', 10, 2)->nullable();

            $table->unsignedBigInteger('assigned_to');
            $table->unsignedBigInteger('assigned_by');

            $table->string('priority', 10)->default('Sedang');
            $table->text('catatan')->nullable();
            $table->string('status', 20)->default('aktif');

            $table->timestamps();

            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('assigned_by')->references('id')->on('users')->onDelete('cascade');

            $table->index('assigned_to');
            $table->index('assigned_by');
            $table->index('status');
            $table->index('created_at');
        });

        DB::statement("ALTER TABLE survey_tasks ADD CONSTRAINT survey_tasks_priority_check CHECK (priority IN ('Tinggi', 'Sedang', 'Rendah'))");
        DB::statement("ALTER TABLE survey_tasks ADD CONSTRAINT survey_tasks_status_check CHECK (status IN ('aktif', 'selesai', 'dibatalkan'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_tasks');
    }
};
