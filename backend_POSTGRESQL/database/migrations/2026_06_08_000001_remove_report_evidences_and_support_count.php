<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('report_evidences');

        if (Schema::hasColumn('reports', 'support_count')) {
            Schema::table('reports', function (Blueprint $table) {
                $table->dropColumn('support_count');
            });
        }

        if (! Schema::hasColumn('report_photos', 'reporter_name')) {
            Schema::table('report_photos', function (Blueprint $table) {
                $table->string('reporter_name', 100)->nullable()->after('report_id');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('report_photos', 'reporter_name')) {
            Schema::table('report_photos', function (Blueprint $table) {
                $table->dropColumn('reporter_name');
            });
        }

        if (! Schema::hasColumn('reports', 'support_count')) {
            Schema::table('reports', function (Blueprint $table) {
                $table->integer('support_count')->default(0);
            });
        }

        DB::statement('
            CREATE TABLE report_evidences (
                id UUID PRIMARY KEY,
                report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
                image_path VARCHAR(500) NOT NULL,
                image_hash VARCHAR(64) NULL,
                reporter_name VARCHAR(100) NOT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL
            )
        ');
    }
};
