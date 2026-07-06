<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE reports ALTER COLUMN overall_severity DROP NOT NULL');
        DB::statement('ALTER TABLE reports ALTER COLUMN overall_severity DROP DEFAULT');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE reports ALTER COLUMN overall_severity SET DEFAULT 'Baik'");
        DB::statement('ALTER TABLE reports ALTER COLUMN overall_severity SET NOT NULL');
    }
};
