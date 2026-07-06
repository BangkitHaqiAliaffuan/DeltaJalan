<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('source', 20)->default('petugas')->after('status');
            $table->text('description')->nullable()->after('catatan_petugas');

            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex(['source']);
            $table->dropColumn(['source', 'description']);
        });
    }
};
