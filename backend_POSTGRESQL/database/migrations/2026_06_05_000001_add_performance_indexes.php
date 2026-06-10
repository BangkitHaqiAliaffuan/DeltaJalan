<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // reports table — columns sering difilter
        Schema::table('reports', function (Blueprint $table) {
            $table->index('reporter_name', 'idx_reports_reporter_name');
            $table->index('assigned_upr_id', 'idx_reports_assigned_upr_id');
            $table->index('trust_label', 'idx_reports_trust_label');
        });

        // report_photos — FK query + JOIN
        Schema::table('report_photos', function (Blueprint $table) {
            $table->index('report_id', 'idx_report_photos_report_id');
        });

        // status_logs — FK query + JOIN
        Schema::table('status_logs', function (Blueprint $table) {
            $table->index('report_id', 'idx_status_logs_report_id');
        });

        // users.name — filter by name petugas
        Schema::table('users', function (Blueprint $table) {
            $table->index('name', 'idx_users_name');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex('idx_reports_reporter_name');
            $table->dropIndex('idx_reports_assigned_upr_id');
            $table->dropIndex('idx_reports_trust_label');
        });

        Schema::table('report_photos', function (Blueprint $table) {
            $table->dropIndex('idx_report_photos_report_id');
        });

        Schema::table('status_logs', function (Blueprint $table) {
            $table->dropIndex('idx_status_logs_report_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_name');
        });
    }
};
