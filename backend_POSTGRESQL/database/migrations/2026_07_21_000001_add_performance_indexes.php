<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // report_after_photos — file_hash sering difilter (dedup)
        Schema::table('report_after_photos', function (Blueprint $table) {
            $table->index('file_hash');
        });

        // reports — assigned_team_id sering difilter (listing by team)
        Schema::table('reports', function (Blueprint $table) {
            $table->index('assigned_team_id');
        });

        // report_progress_updates — FK query + JOIN via report_id
        Schema::table('report_progress_updates', function (Blueprint $table) {
            $table->index('report_id');
        });
    }

    public function down(): void
    {
        Schema::table('report_after_photos', function (Blueprint $table) {
            $table->dropIndex(['file_hash']);
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex(['assigned_team_id']);
        });

        Schema::table('report_progress_updates', function (Blueprint $table) {
            $table->dropIndex(['report_id']);
        });
    }
};
