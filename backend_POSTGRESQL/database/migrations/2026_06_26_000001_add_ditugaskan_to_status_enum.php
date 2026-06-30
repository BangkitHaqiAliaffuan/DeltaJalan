<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE status_enum ADD VALUE IF NOT EXISTS 'Ditugaskan'");
    }

    public function down(): void
    {
        // PostgreSQL does not support removing values from an enum.
        // The value will simply remain unused if we roll back.
    }
};
