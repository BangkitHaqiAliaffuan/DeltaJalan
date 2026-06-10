<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('type', 20)->default('string');
            $table->string('description', 255)->nullable();
            $table->timestamps();
        });

        DB::table('settings')->insert([
            ['key' => 'deadline_review', 'value' => '48', 'type' => 'integer', 'description' => 'Batas waktu review dalam jam'],
            ['key' => 'deadline_resolusi', 'value' => '168', 'type' => 'integer', 'description' => 'Batas waktu resolusi dalam jam'],
            ['key' => 'warning_hours', 'value' => '24', 'type' => 'integer', 'description' => 'Peringatan mendekati deadline (jam sebelum)'],
            ['key' => 'app_name', 'value' => 'DeltaJalan', 'type' => 'string', 'description' => 'Nama aplikasi'],
            ['key' => 'max_photo_age_days', 'value' => '2', 'type' => 'integer', 'description' => 'Maksimal usia foto dalam hari'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
