<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE status_enum ADD VALUE IF NOT EXISTS 'Disetujui'");
        DB::statement("ALTER TYPE status_enum ADD VALUE IF NOT EXISTS 'Ditolak'");
    }

    public function down(): void
    {
        // PostgreSQL tidak mendukung penghapusan nilai dari ENUM secara langsung.
        // Untuk rollback, perlu recreate tipe ENUM tanpa nilai yang dihapus.
        // Lewati karena ini development — cukup drop & recreate database.
    }
};
