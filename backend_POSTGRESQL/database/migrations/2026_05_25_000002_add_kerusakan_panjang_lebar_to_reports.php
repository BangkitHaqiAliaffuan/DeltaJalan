<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->decimal('kerusakan_panjang', 8, 2)->nullable()->after('catatan_petugas');
            $table->decimal('kerusakan_lebar', 8, 2)->nullable()->after('kerusakan_panjang');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['kerusakan_panjang', 'kerusakan_lebar']);
        });
    }
};
