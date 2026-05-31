<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('role', 'petugas_eksekusi')
            ->where('email', 'like', '%@jalankita.test')
            ->update(['password' => Hash::make('password123')]);
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'petugas_eksekusi')
            ->where('email', 'like', '%eksekusi.%')
            ->update(['password' => Hash::make('password')]);
    }
};
