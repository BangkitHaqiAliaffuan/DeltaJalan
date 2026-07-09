<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class MobileClipService
{
    private const RELEVANCE_THRESHOLD = 0.15;

    private const FASTAPI_TIMEOUT = 10;

    public function analyzeRelevance(string $filePath, string $fileName): array
    {
        $fastApiUrl = rtrim(config('services.fastapi.url', env('FASTAPI_URL', 'http://127.0.0.1:8000')), '/');
        $endpoint = $fastApiUrl.'/analyze-relevance';

        try {
            $response = Http::timeout(self::FASTAPI_TIMEOUT)
                ->attach('file', fopen($filePath, 'r'), $fileName)
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'score'   => $data['score'] ?? null,
                    'label'   => $data['label'] ?? null,
                ];
            }

            return [
                'success' => false,
                'score'   => null,
                'label'   => null,
                'error'   => "FastAPI responded with HTTP {$response->status()}",
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'score'   => null,
                'label'   => null,
                'error'   => 'Connection failed: '.$e->getMessage(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'score'   => null,
                'label'   => null,
                'error'   => $e->getMessage(),
            ];
        }
    }

    public function checkBlocking(string $filePath, string $fileName): ?array
    {
        $result = $this->analyzeRelevance($filePath, $fileName);
        if (!$result['success']) return null;

        $score = (float) ($result['score'] ?? 0);

        return [
            'blocked' => $score < self::RELEVANCE_THRESHOLD,
            'score'   => $result['score'],
            'label'   => $result['label'],
        ];
    }
}
