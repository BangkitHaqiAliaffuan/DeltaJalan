<?php

namespace App\Services;

use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SupervisorRouterService
{
    /**
     * Cari supervisor dengan prioritas tertinggi (angka terkecil)
     * yang UPTD-nya mencakup kecamatan tertentu.
     */
    public function resolveByDistrict(string $district): ?User
    {
        $row = DB::table('supervisor_uptd')
            ->join('uptd', 'supervisor_uptd.uptd_id', '=', 'uptd.id')
            ->join('users', 'supervisor_uptd.user_id', '=', 'users.id')
            ->where('users.role', 'supervisor')
            ->whereJsonContains('uptd.kecamatan_wilayah', $district)
            ->orderBy('supervisor_uptd.priority')
            ->orderBy('users.email')
            ->select('users.id')
            ->first();

        if (! $row) {
            return null;
        }

        return User::find($row->id);
    }

    /**
     * Assign report ke supervisor yang tepat berdasarkan district.
     * Skip jika sudah di-assign sebelumnya.
     */
    public function assignReport(Report $report): void
    {
        if ($report->assigned_supervisor_id !== null) {
            return;
        }

        if (empty($report->district)) {
            return;
        }

        $supervisor = $this->resolveByDistrict($report->district);

        if (! $supervisor) {
            Log::info("Auto-salur: tidak ada supervisor untuk kecamatan '{$report->district}'");

            return;
        }

        $report->assigned_supervisor_id = $supervisor->id;
        $report->saveQuietly();
    }
}
