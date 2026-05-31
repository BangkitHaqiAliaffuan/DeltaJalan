<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Upr;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class ReportExportController extends Controller
{
    private const BULAN_INDONESIA = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    public function exportMonthlyPdf(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'supervisor') {
            abort(403, 'Hanya supervisor yang dapat mengunduh laporan rekap bulanan.');
        }

        $month = (int) $request->query('month', now()->month);
        $year  = (int) $request->query('year', now()->year);

        if ($month < 1 || $month > 12) {
            abort(400, 'Bulan tidak valid. Gunakan 1–12.');
        }
        if ($year < 2020 || $year > now()->year + 1) {
            abort(400, 'Tahun tidak valid.');
        }

        $bulanNama   = self::BULAN_INDONESIA[$month] ?? "Bulan {$month}";
        $bulanTahun  = "{$bulanNama} {$year}";
        $tanggalCetak = now()->locale('id')->isoFormat('D MMMM Y');

        $query = Report::whereYear('created_at', $year)
            ->whereMonth('created_at', $month);

        $totalLaporan = (clone $query)->count();

        $ringkasanStatus = $this->buildRingkasanStatus(clone $query);
        $trustBreakdown  = $this->buildTrustBreakdown(clone $query);
        $uprBreakdown    = $this->buildUprBreakdown(clone $query);
        $severityBreakdown  = $this->buildSeverityBreakdown(clone $query);
        $districtBreakdown  = $this->buildDistrictBreakdown(clone $query);

        $pdf = Pdf::loadView('pdf.rekap-bulanan', compact(
            'bulanTahun',
            'tanggalCetak',
            'totalLaporan',
            'ringkasanStatus',
            'trustBreakdown',
            'uprBreakdown',
            'severityBreakdown',
            'districtBreakdown',
        ));

        $filename = "rekap-bulanan-{$year}-{$month}.pdf";

        return $pdf->download($filename);
    }

    private function buildRingkasanStatus($query): array
    {
        $statuses = ['Menunggu Review', 'Disetujui', 'Ditolak', 'Sedang Diperbaiki', 'Selesai'];
        $total    = (clone $query)->count();
        $result   = [];

        foreach ($statuses as $status) {
            $jumlah = (clone $query)->where('status', $status)->count();
            $result[] = [
                'label'  => $status,
                'jumlah' => $jumlah,
                'persen' => $total > 0 ? number_format(($jumlah / $total) * 100, 1) . '%' : '0%',
            ];
        }

        return $result;
    }

    private function buildTrustBreakdown($query): array
    {
        $total  = (clone $query)->count();
        $labels = [
            'hijau' => 'Kredibel',
            'kuning' => 'Perlu Review',
            'merah'  => 'Diragukan',
        ];
        $result = [];

        foreach ($labels as $key => $label) {
            $jumlah = (clone $query)->where('trust_label', $key)->count();
            $result[] = [
                'label'  => $label,
                'jumlah' => $jumlah,
                'persen' => $total > 0 ? number_format(($jumlah / $total) * 100, 1) . '%' : '0%',
            ];
        }

        return $result;
    }

    private function buildUprBreakdown($query): array
    {
        $uprs = Upr::where('is_active', true)->get();
        $result = [];

        foreach ($uprs as $upr) {
            $q = clone $query;
            $q->where('assigned_upr_id', $upr->id);

            $total      = (clone $q)->count();
            $diperbaiki = (clone $q)->where('status', 'Sedang Diperbaiki')->count();
            $selesai    = (clone $q)->where('status', 'Selesai')->count();
            $panjang    = (clone $q)->whereNotNull('kerusakan_panjang')->sum('kerusakan_panjang');
            $luas       = (clone $q)
                ->whereNotNull('kerusakan_panjang')
                ->whereNotNull('kerusakan_lebar')
                ->selectRaw('COALESCE(SUM(kerusakan_panjang * kerusakan_lebar), 0) as total_luas')
                ->value('total_luas');

            $result[] = [
                'upr_id'            => $upr->id,
                'upr_name'          => $upr->name,
                'total'             => $total,
                'sedang_diperbaiki' => $diperbaiki,
                'selesai'           => $selesai,
                'total_panjang_m'   => round((float) $panjang, 1),
                'total_luas_m2'     => round((float) $luas, 1),
            ];
        }

        return $result;
    }

    private function buildSeverityBreakdown($query): array
    {
        $total  = (clone $query)->count();
        $levels = ['Rusak Ringan', 'Rusak Sedang', 'Rusak Berat'];
        $result = [];

        foreach ($levels as $level) {
            $jumlah = (clone $query)->where('overall_severity', $level)->count();
            $result[] = [
                'label'  => $level,
                'jumlah' => $jumlah,
                'persen' => $total > 0 ? number_format(($jumlah / $total) * 100, 1) . '%' : '0%',
            ];
        }

        return $result;
    }

    private function buildDistrictBreakdown($query): array
    {
        $rows = (clone $query)
            ->selectRaw('district, COUNT(*) as jumlah')
            ->groupBy('district')
            ->orderByDesc('jumlah')
            ->get();

        $total = $rows->sum('jumlah');
        $result = [];

        foreach ($rows as $row) {
            $result[] = [
                'kecamatan' => $row->district,
                'jumlah'    => (int) $row->jumlah,
                'persen'    => $total > 0 ? number_format(((int) $row->jumlah / $total) * 100, 1) . '%' : '0%',
            ];
        }

        return $result;
    }
}
