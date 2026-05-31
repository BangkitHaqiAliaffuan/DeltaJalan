<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('upr_id')->nullable()->constrained('uprs')->nullOnDelete()->after('nip');
        });

        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('petugas', 'supervisor', 'petugas_eksekusi'))");

        $uprs = DB::table('uprs')->get();

        foreach ($uprs as $upr) {
            $wilayah = $upr->wilayah ? explode(', ', $upr->wilayah)[0] : 'Sidoarjo';
            $email = 'eksekusi.' . strtolower(str_replace(' ', '', $upr->name)) . '@jalankita.test';
            $name = 'Tim ' . $upr->name;

            DB::table('users')->insert([
                'name'     => $name,
                'email'    => $email,
                'password' => Hash::make('password'),
                'role'     => 'petugas_eksekusi',
                'wilayah'  => $wilayah,
                'nip'      => null,
                'upr_id'   => $upr->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'petugas_eksekusi')->delete();

        DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('petugas', 'supervisor'))");

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['upr_id']);
            $table->dropColumn('upr_id');
        });
    }
};
