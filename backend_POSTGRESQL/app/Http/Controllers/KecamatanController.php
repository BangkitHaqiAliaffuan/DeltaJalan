<?php

namespace App\Http\Controllers;

use App\Models\SurveyTask;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KecamatanController extends Controller
{
    public function patrolStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = SurveyTask::query()
            ->select(
                'survey_tasks.kecamatan',
                DB::raw('MAX(survey_tasks.tanggal_patroli) as terakhir_patroli'),
                DB::raw('DATEDIFF(CURDATE(), MAX(survey_tasks.tanggal_patroli)) as hari_sejak_patroli')
            )
            ->join('teams', 'survey_tasks.team_id', '=', 'teams.id')
            ->where('survey_tasks.status', '!=', 'dibatalkan')
            ->whereNotNull('survey_tasks.tanggal_patroli')
            ->groupBy('survey_tasks.kecamatan')
            ->orderBy('hari_sejak_patroli', 'desc');

        if ($user->role !== 'admin') {
            $teamIds = Team::where('uptd_id', $user->team?->uptd_id)->pluck('id');
            $query->whereIn('survey_tasks.team_id', $teamIds);
        }

        $results = $query->get();

        $patrolStatus = $results->map(function ($item) {
            $hari = (int) $item->hari_sejak_patroli;
            $status = match (true) {
                $hari > 14 => 'overdue',
                $hari >= 8 => 'soon',
                default => 'ok',
            };

            $lastTask = SurveyTask::where('kecamatan', $item->kecamatan)
                ->where('status', '!=', 'dibatalkan')
                ->whereNotNull('tanggal_patroli')
                ->orderBy('tanggal_patroli', 'desc')
                ->first();

            return [
                'kecamatan' => $item->kecamatan,
                'terakhir_patroli' => $item->terakhir_patroli,
                'hari_sejak_patroli' => $hari,
                'status' => $status,
                'total_laporan_terakhir' => $lastTask?->reports()->count() ?? 0,
                'alasan_terakhir' => $lastTask?->alasan_tugas ?? null,
            ];
        });

        return response()->json($patrolStatus);
    }
}
