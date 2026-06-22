<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('name', 255);
            $table->date('start_date');
            $table->date('end_date');

            $table->uuid('team_id');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('restrict');

            $table->text('notes')->nullable();
            $table->string('status', 20)->default('aktif');

            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->timestamps();

            $table->index('team_id');
            $table->index('status');
            $table->index('created_at');
        });

        DB::statement("ALTER TABLE survey_periods ADD CONSTRAINT survey_periods_status_check CHECK (status IN ('aktif', 'selesai', 'dibatalkan'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_periods');
    }
};
