<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patrol_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->uuid('team_id');
            $table->foreign('team_id')->references('id')->on('teams')->onDelete('cascade');

            $table->json('hari');
            $table->json('kecamatan_list');
            $table->string('frekuensi', 20)->default('setiap_minggu');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('alasan_tugas', 50)->default('rutin');
            $table->string('status', 20)->default('aktif');

            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->timestamps();

            $table->index('team_id');
            $table->index('status');
        });

        DB::statement("ALTER TABLE patrol_schedules ADD CONSTRAINT patrol_schedules_frekuensi_check CHECK (frekuensi IN ('setiap_minggu', 'dua_mingguan', 'bulanan'))");
        DB::statement("ALTER TABLE patrol_schedules ADD CONSTRAINT patrol_schedules_status_check CHECK (status IN ('aktif', 'nonaktif'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('patrol_schedules');
    }
};
