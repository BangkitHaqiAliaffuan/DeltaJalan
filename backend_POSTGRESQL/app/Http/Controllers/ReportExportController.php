<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Upr;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

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

    /**
     * GET /api/reports/export/monthly-excel
     * Export rekap bulanan ke format Excel (.xlsx).
     * Query params: ?month=5&year=2026
     */
    public function exportMonthlyExcel(Request $request)
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

        $bulanNama  = self::BULAN_INDONESIA[$month] ?? "Bulan {$month}";
        $bulanTahun = "{$bulanNama} {$year}";

        $query = Report::whereYear('created_at', $year)
            ->whereMonth('created_at', $month);

        $totalLaporan       = (clone $query)->count();
        $ringkasanStatus    = $this->buildRingkasanStatus(clone $query);
        $trustBreakdown     = $this->buildTrustBreakdown(clone $query);
        $uprBreakdown       = $this->buildUprBreakdown(clone $query);
        $severityBreakdown  = $this->buildSeverityBreakdown(clone $query);
        $districtBreakdown  = $this->buildDistrictBreakdown(clone $query);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle("Rekap {$bulanNama} {$year}");

        // ── Header ──
        $sheet->setCellValue('A1', "Rekap Bulanan Laporan Kerusakan Jalan");
        $sheet->mergeCells('A1:D1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->setCellValue('A2', "Periode: {$bulanTahun}");
        $sheet->mergeCells('A2:D2');

        $row = 4;

        // ── Ringkasan Status ──
        $sheet->setCellValue("A{$row}", 'Ringkasan Status');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $row++;
        $sheet->setCellValue("A{$row}", 'Status');
        $sheet->setCellValue("B{$row}", 'Jumlah');
        $sheet->setCellValue("C{$row}", 'Persentase');
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true);
        $row++;

        foreach ($ringkasanStatus as $s) {
            $sheet->setCellValue("A{$row}", $s['label']);
            $sheet->setCellValue("B{$row}", $s['jumlah']);
            $sheet->setCellValue("C{$row}", $s['persen']);
            $row++;
        }

        $row++;

        // ── Severity Breakdown ──
        $sheet->setCellValue("A{$row}", 'Tingkat Kerusakan');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $row++;
        $sheet->setCellValue("A{$row}", 'Severity');
        $sheet->setCellValue("B{$row}", 'Jumlah');
        $sheet->setCellValue("C{$row}", 'Persentase');
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true);
        $row++;

        foreach ($severityBreakdown as $s) {
            $sheet->setCellValue("A{$row}", $s['label']);
            $sheet->setCellValue("B{$row}", $s['jumlah']);
            $sheet->setCellValue("C{$row}", $s['persen']);
            $row++;
        }

        $row++;

        // ── Trust Breakdown ──
        $sheet->setCellValue("A{$row}", 'Kredibilitas Laporan');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $row++;
        $sheet->setCellValue("A{$row}", 'Label');
        $sheet->setCellValue("B{$row}", 'Jumlah');
        $sheet->setCellValue("C{$row}", 'Persentase');
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true);
        $row++;

        foreach ($trustBreakdown as $s) {
            $sheet->setCellValue("A{$row}", $s['label']);
            $sheet->setCellValue("B{$row}", $s['jumlah']);
            $sheet->setCellValue("C{$row}", $s['persen']);
            $row++;
        }

        $row++;

        // ── Per Kecamatan ──
        $sheet->setCellValue("A{$row}", 'Per Kecamatan');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $row++;
        $sheet->setCellValue("A{$row}", 'Kecamatan');
        $sheet->setCellValue("B{$row}", 'Jumlah');
        $sheet->setCellValue("C{$row}", 'Persentase');
        $sheet->getStyle("A{$row}:C{$row}")->getFont()->setBold(true);
        $row++;

        foreach ($districtBreakdown as $s) {
            $sheet->setCellValue("A{$row}", $s['kecamatan']);
            $sheet->setCellValue("B{$row}", $s['jumlah']);
            $sheet->setCellValue("C{$row}", $s['persen']);
            $row++;
        }

        $row++;

        // ── Per UPR ──
        $sheet->setCellValue("A{$row}", 'Kinerja UPR');
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
        $row++;
        $sheet->setCellValue("A{$row}", 'UPR');
        $sheet->setCellValue("B{$row}", 'Total');
        $sheet->setCellValue("C{$row}", 'Sedang Diperbaiki');
        $sheet->setCellValue("D{$row}", 'Selesai');
        $sheet->setCellValue("E{$row}", 'Total Panjang (m)');
        $sheet->setCellValue("F{$row}", 'Total Luas (m²)');
        $sheet->getStyle("A{$row}:F{$row}")->getFont()->setBold(true);
        $row++;

        foreach ($uprBreakdown as $s) {
            $sheet->setCellValue("A{$row}", $s['upr_name']);
            $sheet->setCellValue("B{$row}", $s['total']);
            $sheet->setCellValue("C{$row}", $s['sedang_diperbaiki']);
            $sheet->setCellValue("D{$row}", $s['selesai']);
            $sheet->setCellValue("E{$row}", $s['total_panjang_m']);
            $sheet->setCellValue("F{$row}", $s['total_luas_m2']);
            $row++;
        }

        // Auto-size columns
        foreach (range('A', 'F') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = "rekap-bulanan-{$year}-{$month}.xlsx";

        $tempFile = tempnam(sys_get_temp_dir(), 'export_');
        $writer->save($tempFile);

        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function buildRingkasanStatus($query): array
    {
        $rows = (clone $query)
            ->selectRaw('status, COUNT(*) as jumlah')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $allStatuses = ['Menunggu Review', 'Disetujui', 'Ditolak', 'Sedang Diperbaiki', 'Selesai'];
        $total = $rows->sum('jumlah');
        $result = [];

        foreach ($allStatuses as $status) {
            $jumlah = (int) ($rows[$status]->jumlah ?? 0);
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
        $rows = (clone $query)
            ->selectRaw('trust_label, COUNT(*) as jumlah')
            ->groupBy('trust_label')
            ->get()
            ->keyBy('trust_label');

        $total = $rows->sum('jumlah');
        $labels = [
            'hijau' => 'Kredibel',
            'kuning' => 'Perlu Review',
            'merah'  => 'Diragukan',
        ];
        $result = [];

        foreach ($labels as $key => $label) {
            $jumlah = (int) ($rows[$key]->jumlah ?? 0);
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
        $rows = (clone $query)
            ->selectRaw("
                assigned_upr_id,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Sedang Diperbaiki' THEN 1 ELSE 0 END) as sedang_diperbaiki,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
                COALESCE(SUM(NULLIF(kerusakan_panjang, 0)), 0) as total_panjang,
                COALESCE(SUM(NULLIF(kerusakan_panjang, 0) * NULLIF(kerusakan_lebar, 0)), 0) as total_luas
            ")
            ->whereNotNull('assigned_upr_id')
            ->groupBy('assigned_upr_id')
            ->get()
            ->keyBy('assigned_upr_id');

        $uprs = Upr::where('is_active', true)->get();
        $result = [];

        foreach ($uprs as $upr) {
            $r = $rows[$upr->id] ?? null;
            $result[] = [
                'upr_id'            => $upr->id,
                'upr_name'          => $upr->name,
                'total'             => (int) ($r->total ?? 0),
                'sedang_diperbaiki' => (int) ($r->sedang_diperbaiki ?? 0),
                'selesai'           => (int) ($r->selesai ?? 0),
                'total_panjang_m'   => round((float) ($r->total_panjang ?? 0), 1),
                'total_luas_m2'     => round((float) ($r->total_luas ?? 0), 1),
            ];
        }

        return $result;
    }

    private function buildSeverityBreakdown($query): array
    {
        $rows = (clone $query)
            ->selectRaw('overall_severity, COUNT(*) as jumlah')
            ->groupBy('overall_severity')
            ->get()
            ->keyBy('overall_severity');

        $total = $rows->sum('jumlah');
        $levels = ['Rusak Ringan', 'Rusak Sedang', 'Rusak Berat'];
        $result = [];

        foreach ($levels as $level) {
            $jumlah = (int) ($rows[$level]->jumlah ?? 0);
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
