<?php

namespace App\Jobs;

use App\Models\Report;
use App\Models\ReportPhoto;
use App\Services\PciService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AnalyzeReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public $timeout = 120;

    public string $reportId;

    public function __construct(string $reportId)
    {
        $this->reportId = $reportId;
    }

    public function handle(): void
    {
        $report = Report::find($this->reportId);
        if (! $report) {
            Log::warning('AnalyzeReportJob: Report not found', ['report_id' => $this->reportId]);

            return;
        }

        $photo = ReportPhoto::where('report_id', $report->id)->orderBy('id')->first();
        if (! $photo || ! $photo->image_original_path) {
            Log::warning('AnalyzeReportJob: No photo found for report', ['report_id' => $report->id]);

            return;
        }

        $fullPath = Storage::disk('public')->path($photo->image_original_path);
        if (! file_exists($fullPath)) {
            Log::warning('AnalyzeReportJob: Photo file not found on disk', [
                'report_id' => $report->id,
                'path' => $fullPath,
            ]);

            return;
        }

        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze';

        try {
            $response = Http::timeout(30)
                ->attach(
                    'file',
                    fopen($fullPath, 'r'),
                    basename($photo->image_original_path)
                )
                ->post($endpoint);

            if (! $response->successful()) {
                Log::error('AnalyzeReportJob: FastAPI returned error', [
                    'report_id' => $report->id,
                    'status' => $response->status(),
                ]);

                return;
            }

            $data = $response->json();

            if (! isset($data['overall_severity'])) {
                Log::error('AnalyzeReportJob: FastAPI response missing overall_severity', [
                    'report_id' => $report->id,
                ]);

                return;
            }

            $resultPath = null;
            if (! empty($data['result_image'])) {
                $resultPath = $this->saveResultImage($data['result_image']);
            }

            $report->update([
                'ai_jenis_kerusakan' => $data['detection_type'] ?? $data['overall_severity'],
                'ai_severity' => $data['overall_severity'],
                'overall_severity' => $data['overall_severity'],
                'ai_confidence' => $data['confidence'] ?? $data['max_confidence'] ?? null,
                'total_detections' => $data['total_detections'] ?? 0,
                'ai_raw_output' => $data['detections'] ?? $data,
                'image_result_path' => $resultPath,
                'system_notes' => $report->system_notes
                    ? $report->system_notes.' | [AI] Analisis otomatis selesai.'
                    : '[AI] Analisis otomatis selesai.',
            ]);

            // ── Hitung PCI ──
            $pci = app(PciService::class)->calculateFromReport($report);
            if ($pci !== null) {
                $report->pci_score = $pci;
                $report->pci_calculated_at = now();
                $report->saveQuietly();
            }

            Log::info('AnalyzeReportJob: AI analysis completed', [
                'report_id' => $report->id,
                'severity' => $data['overall_severity'],
            ]);

        } catch (ConnectionException $e) {
            Log::error('AnalyzeReportJob: Cannot connect to FastAPI', [
                'report_id' => $report->id,
                'error' => $e->getMessage(),
            ]);
        } catch (\Exception $e) {
            Log::error('AnalyzeReportJob: Unexpected error', [
                'report_id' => $report->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function saveResultImage(string $base64String): ?string
    {
        try {
            if (str_contains($base64String, ',')) {
                $base64String = explode(',', $base64String, 2)[1];
            }

            $imageData = base64_decode($base64String, strict: true);
            if ($imageData === false) {
                Log::warning('AnalyzeReportJob: Failed to decode base64 result image.');

                return null;
            }

            $filename = Str::uuid()->toString().'-result-'.time().'.jpg';
            $path = 'reports/results/'.$filename;

            Storage::disk('public')->put($path, $imageData);

            return $path;
        } catch (\Exception $e) {
            Log::warning('AnalyzeReportJob: Failed to save result image.', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
