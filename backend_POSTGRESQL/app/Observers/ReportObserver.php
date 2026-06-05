<?php

namespace App\Observers;

use App\Models\Report;
use App\Models\StatusLog;
use App\Models\User;
use App\Notifications\ReportCreatedNotification;

class ReportObserver
{
    public function created(Report $report): void
    {
        StatusLog::create([
            'report_id'  => $report->id,
            'old_status' => null,
            'new_status' => $report->status,
            'actor_name' => auth()->user()?->name ?? $report->reporter_name,
            'actor_role' => auth()->user()?->role ?? 'system',
            'notes'      => 'Laporan dibuat',
        ]);

        // Notifikasi ke semua supervisor
        try {
            $supervisors = User::where('role', 'supervisor')->get();
            foreach ($supervisors as $supervisor) {
                $supervisor->notify(new ReportCreatedNotification($report));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Gagal mengirim notifikasi laporan baru: ' . $e->getMessage());
        }
    }

    public function updated(Report $report): void
    {
        if (!$report->isDirty('status')) {
            return;
        }

        $oldStatus = $report->getOriginal('status');

        $notes = null;
        if ($report->isDirty('system_notes')) {
            $old  = (string) $report->getOriginal('system_notes');
            $new  = (string) $report->system_notes;
            $diff = substr($new, strlen($old));
            $notes = trim($diff, " \t\n\r\0\x0B|");
        }

        StatusLog::create([
            'report_id'  => $report->id,
            'old_status' => $oldStatus,
            'new_status' => $report->status,
            'actor_name' => auth()->user()?->name,
            'actor_role' => auth()->user()?->role,
            'notes'      => $notes ?: ($report->catatan_petugas ?? null),
        ]);
    }
}
