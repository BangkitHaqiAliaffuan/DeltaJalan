<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE status_enum ADD VALUE IF NOT EXISTS 'Hasil AI'");
    }

    public function down(): void
    {
        // Cannot remove enum value in PostgreSQL without dropping/recreating the type.
        // Keep 'Hasil AI' even on rollback.
    }
};
