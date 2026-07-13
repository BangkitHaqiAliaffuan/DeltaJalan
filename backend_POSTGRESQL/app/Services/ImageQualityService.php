<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImageQualityService
{
    private const FASTAPI_TIMEOUT = 10;

    public function analyzeQuality(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze-quality';

        try {
            $response = Http::timeout(self::FASTAPI_TIMEOUT)
                ->attach('file', fopen($filePath, 'r'), $fileName)
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'status' => $data['status'] ?? 'analysis_error',
                    'blurScore' => $data['blurScore'] ?? 0,
                    'meanBrightness' => $data['meanBrightness'] ?? 0,
                    'brightnessStdDev' => $data['brightnessStdDev'] ?? 0,
                ];
            }

            Log::warning('[ImageQualityService] FastAPI responded with non-success', [
                'endpoint' => $endpoint,
                'status' => $response->status(),
            ]);

            return [
                'success' => false,
                'status' => 'analysis_error',
                'error' => "FastAPI responded with HTTP {$response->status()}",
            ];
        } catch (ConnectionException $e) {
            Log::warning('[ImageQualityService] FastAPI /analyze-quality tidak dapat dijangkau (connection timeout/refused)', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'status' => 'analysis_error',
                'error' => 'Connection failed: '.$e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::warning('[ImageQualityService] FastAPI /analyze-quality unexpected error', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'status' => 'analysis_error',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function checkBlocking(string $filePath, string $fileName): ?array
    {
        $result = $this->analyzeQuality($filePath, $fileName);
        if (! $result['success']) {
            return null;
        }

        $status = $result['status'];
        $blockingStatuses = ['blurry', 'too_dark'];

        return [
            'blocked' => in_array($status, $blockingStatuses, true),
            'status' => $status,
            'blurScore' => $result['blurScore'],
            'meanBrightness' => $result['meanBrightness'],
            'brightnessStdDev' => $result['brightnessStdDev'],
        ];
    }
}
