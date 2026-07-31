<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batch_analyses', function (Blueprint $table) {
            $table->jsonb('photo_paths')->nullable()->after('analyses');
        });
    }

    public function down(): void
    {
        Schema::table('batch_analyses', function (Blueprint $table) {
            $table->dropColumn('photo_paths');
        });
    }
};
