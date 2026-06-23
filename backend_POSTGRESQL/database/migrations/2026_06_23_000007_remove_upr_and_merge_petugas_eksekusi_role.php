<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Hapus foreign key ke uprs di reports ────────────────
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['assigned_upr_id']);
        });

        // ── 2. Drop column + add uuid assigned_team_id ──────────────
        //    (tipe BIGINT dari foreignId() tidak cocok untuk UUID teams.id)
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('assigned_upr_id');
        });
        Schema::table('reports', function (Blueprint $table) {
            $table->uuid('assigned_team_id')->nullable()->after('pelaksana');
        });

        // ── 3. Hapus foreign key upr_id di users ────────────────────
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['upr_id']);
            $table->dropColumn('upr_id');
        });

        // ── 4. Drop tabel uprs ──────────────────────────────────────
        Schema::dropIfExists('uprs');

        // ── 5. Migrasi user petugas_eksekusi → petugas ──────────────
        DB::table('users')
            ->where('role', 'petugas_eksekusi')
            ->update(['role' => 'petugas']);

        // ── 6. Update role constraint — hapus petugas_eksekusi ──────
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('petugas', 'supervisor', 'admin'))");
    }

    public function down(): void
    {
        // ── Reverse: restore uprs table ─────────────────────────────
        Schema::create('uprs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('wilayah', 100)->nullable();
            $table->string('leader_name', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Reverse: restore upr_id on users ────────────────────────
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('upr_id')->nullable()->constrained('uprs')->nullOnDelete();
        });

        // ── Reverse: drop assigned_team_id, restore assigned_upr_id ─
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn('assigned_team_id');
            $table->foreignId('assigned_upr_id')->nullable()->constrained('uprs')->nullOnDelete();
        });

        // ── Reverse: restore role constraint ────────────────────────
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('petugas', 'supervisor', 'petugas_eksekusi'))");

        // ── Note: petugas → petugas_eksekusi tidak di-reverse
        //    karena tidak bisa membedakan mana yang asli petugas vs hasil migrasi.
    }
};
