<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->uuid('assigned_supervisor_id')
                ->nullable()
                ->after('assigned_team_id')
                ->index();

            $table->foreign('assigned_supervisor_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['assigned_supervisor_id']);
            $table->dropColumn('assigned_supervisor_id');
        });
    }
};
