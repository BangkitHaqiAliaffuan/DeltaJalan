<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $priorities = ['Tinggi', 'Sedang', 'Rendah'];
        $config = config('deadline');

        foreach ($priorities as $priority) {
            $hours = $config[$priority]['review_hours'] ?? 72;
            DB::statement("
                UPDATE reports
                SET deadline_review = created_at + INTERVAL '{$hours} hours'
                WHERE deadline_review IS NULL
                  AND (status = 'Menunggu Review' OR status = 'Ditinjau')
                  AND priority = ?
            ", [$priority]);
        }

        // Fallback: untuk report tanpa priority atau priority tidak dikenal
        DB::statement("
            UPDATE reports
            SET deadline_review = created_at + INTERVAL '72 hours'
            WHERE deadline_review IS NULL
              AND (status = 'Menunggu Review' OR status = 'Ditinjau')
        ");
    }

    public function down(): void
    {
        // Tidak bisa di-rollback — tidak mungkin tahu mana yang di-backfill
    }
};
