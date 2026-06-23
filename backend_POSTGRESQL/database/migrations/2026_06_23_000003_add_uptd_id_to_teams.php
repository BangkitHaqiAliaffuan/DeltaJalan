<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->uuid('uptd_id')->nullable()->after('description');
            $table->foreign('uptd_id')->references('id')->on('uptd')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropForeign(['uptd_id']);
            $table->dropColumn('uptd_id');
        });
    }
};
