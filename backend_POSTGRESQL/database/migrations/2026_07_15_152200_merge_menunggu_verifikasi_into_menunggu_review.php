<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            UPDATE reports
            SET status = 'Menunggu Review',
                deadline_review = COALESCE(deadline_review, created_at + CASE priority
                    WHEN 'Tinggi' THEN INTERVAL '24 hours'
                    WHEN 'Rendah' THEN INTERVAL '168 hours'
                    ELSE INTERVAL '72 hours'
                END)
            WHERE status = 'Menunggu Verifikasi'
        ");
    }

    public function down(): void
    {
        // Tidak bisa rollback dengan tepat — tidak tahu mana yang di-merge
    }
};
