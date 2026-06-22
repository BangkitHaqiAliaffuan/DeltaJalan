<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Tabel master UPR (Unit Pelaksana / Tim Satgas) ──────────────
        Schema::create('uprs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('wilayah', 100)->nullable();
            $table->string('leader_name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Kolom baru di tabel reports ─────────────────────────────────
        Schema::table('reports', function (Blueprint $table) {
            // After photo & completion
            $table->string('after_photo_path', 500)->nullable();
            $table->string('after_photo_hash', 64)->nullable();
            $table->string('after_photo_notes', 500)->nullable();

            // Timestamps eksekusi
            $table->timestamp('perbaikan_dimulai_at')->nullable();
            $table->timestamp('perbaikan_selesai_at')->nullable();

            // Pelaksana (nama tim / kontraktor)
            $table->string('pelaksana', 100)->nullable();

            // UPR assignment
            $table->foreignId('assigned_upr_id')->nullable()->constrained('uprs')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();

            // Catatan petugas saat melengkapi laporan
            $table->text('catatan_petugas')->nullable();
        });

        // ── Seed data: 4 Satgas Jalan sesuai struktur Dinas PU ──────────
        DB::table('uprs')->insert([
            [
                'name' => 'Satgas Wilayah Utara',
                'wilayah' => 'Waru, Sedati, Buduran, Gedangan',
                'leader_name' => null,
                'phone' => null,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Satgas Wilayah Selatan',
                'wilayah' => 'Porong, Krembung, Tulangan, Tanggulangin, Jabon',
                'leader_name' => null,
                'phone' => null,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Satgas Wilayah Barat',
                'wilayah' => 'Taman, Krian, Balongbendo, Wonoayu, Sukodono',
                'leader_name' => null,
                'phone' => null,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Satgas Wilayah Timur',
                'wilayah' => 'Candi, Sidoarjo, Tarik, Prambon',
                'leader_name' => null,
                'phone' => null,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['assigned_upr_id']);
            $table->dropColumn([
                'after_photo_path',
                'after_photo_hash',
                'after_photo_notes',
                'perbaikan_dimulai_at',
                'perbaikan_selesai_at',
                'pelaksana',
                'assigned_upr_id',
                'assigned_at',
                'catatan_petugas',
            ]);
        });

        Schema::dropIfExists('uprs');
    }
};
