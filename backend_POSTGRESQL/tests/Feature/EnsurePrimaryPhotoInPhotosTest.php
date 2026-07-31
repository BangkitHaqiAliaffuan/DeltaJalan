<?php

namespace Tests\Feature;

use App\Models\Report;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class EnsurePrimaryPhotoInPhotosTest extends TestCase
{
    private function makeReport(array $attrs = []): Report
    {
        $report = new Report();
        $report->forceFill(array_merge([
            'id' => '019fb5fe-8ec1-72c0-b18a-2580b803357e',
            'reporter_name' => 'Warga Tes',
            'image_original_path' => null,
            'image_result_path' => null,
            'image_hash' => null,
            'ai_jenis_kerusakan' => null,
            'ai_severity' => 'Rusak Ringan',
            'ai_confidence' => 0.87,
            'total_detections' => 2,
            'ai_raw_output' => [
                'total' => 2,
                'overall_severity' => 'Rusak Ringan',
                'image_result' => 'data:image/jpeg;base64,XXX',
                'detections' => [
                    ['class' => 'Lubang', 'score' => 0.92],
                ],
            ],
            'latitude' => -7.45,
            'longitude' => 112.71,
            'system_notes' => null,
            'kerusakan_panjang' => 1.5,
            'kerusakan_lebar' => 0.5,
            'created_at' => Carbon::parse('2026-07-30 10:00:00'),
            'overall_severity' => 'Rusak Ringan',
        ], $attrs));

        return $report;
    }

    private function photo(array $attrs = []): array
    {
        return array_merge([
            'id' => 'uuid-photo',
            'reporter_name' => 'Warga Tes',
            'ai_jenis_kerusakan' => null,
            'ai_severity' => 'Rusak Ringan',
            'ai_confidence' => 0.85,
            'total_detections' => 1,
            'ai_raw_output' => null,
            'latitude' => -7.45,
            'longitude' => 112.71,
            'image_original_url' => null,
            'image_result_url' => null,
            'system_notes' => null,
            'sort_order' => 1,
            'kerusakan_panjang' => null,
            'kerusakan_lebar' => null,
            'photo_taken_at' => null,
            'created_at' => '2026-07-30T10:01:00+00:00',
            'mobileclip_score' => null,
            'mobileclip_label' => null,
            'quality_scores' => null,
            'image_hash' => null,
        ], $attrs);
    }

    public function test_prepends_primary_photo_for_warga_batch_report(): void
    {
        $report = $this->makeReport([
            'image_original_path' => 'warga/a.jpg',
            'image_hash' => 'hash-a',
            'image_result_path' => 'warga/a_ai.jpg',
        ]);
        $photos = [
            $this->photo(['id' => 'b', 'image_original_url' => '/storage/warga/b.jpg', 'image_hash' => 'hash-b']),
            $this->photo(['id' => 'c', 'image_original_url' => '/storage/warga/c.jpg', 'image_hash' => 'hash-c']),
        ];

        $result = Report::ensurePrimaryPhotoInPhotos($photos, $report);

        $this->assertCount(3, $result);
        $this->assertSame('primary-'.$report->id, $result[0]['id']);
        $this->assertSame('/storage/warga/a.jpg', $result[0]['image_original_url']);
        $this->assertSame('/storage/warga/a_ai.jpg', $result[0]['image_result_url']);
        $this->assertSame(0, $result[0]['sort_order']);
        $this->assertSame('b', $result[1]['id']);
        $this->assertSame('c', $result[2]['id']);
    }

    public function test_does_not_duplicate_primary_for_telegram_report(): void
    {
        $report = $this->makeReport([
            'source' => 'telegram',
            'image_original_path' => 'tg/a.jpg',
            'image_hash' => 'hash-a',
        ]);
        $photos = [
            $this->photo(['id' => 'real', 'image_original_url' => '/storage/tg/a.jpg', 'image_hash' => 'hash-a', 'sort_order' => 0]),
        ];

        $result = Report::ensurePrimaryPhotoInPhotos($photos, $report);

        $this->assertCount(1, $result);
        $this->assertSame('real', $result[0]['id']);
    }

    public function test_keeps_photos_untouched_for_petugas_batch_without_primary(): void
    {
        $report = $this->makeReport(['source' => 'petugas']);
        $photos = [
            $this->photo(['id' => 'a', 'image_original_url' => '/storage/petugas/a.jpg', 'image_hash' => 'hash-a', 'sort_order' => 0]),
            $this->photo(['id' => 'b', 'image_original_url' => '/storage/petugas/b.jpg', 'image_hash' => 'hash-b', 'sort_order' => 1]),
            $this->photo(['id' => 'c', 'image_original_url' => '/storage/petugas/c.jpg', 'image_hash' => 'hash-c', 'sort_order' => 2]),
        ];

        $result = Report::ensurePrimaryPhotoInPhotos($photos, $report);

        $this->assertSame(['a', 'b', 'c'], array_column($result, 'id'));
    }

    public function test_adds_synthetic_primary_for_single_photo_report(): void
    {
        $report = $this->makeReport([
            'image_original_path' => 'single/a.jpg',
            'image_hash' => 'hash-a',
        ]);

        $result = Report::ensurePrimaryPhotoInPhotos([], $report);

        $this->assertCount(1, $result);
        $this->assertSame('primary-'.$report->id, $result[0]['id']);
        $this->assertSame('/storage/single/a.jpg', $result[0]['image_original_url']);
        $this->assertSame(-7.45, $result[0]['latitude']);
        $this->assertSame(1.5, $result[0]['kerusakan_panjang']);
    }

    public function test_primary_photo_ai_raw_output_has_image_result_stripped(): void
    {
        $report = $this->makeReport([
            'image_original_path' => 'warga/a.jpg',
            'image_hash' => 'hash-a',
        ]);

        $result = Report::ensurePrimaryPhotoInPhotos([], $report);

        $this->assertArrayNotHasKey('image_result', $result[0]['ai_raw_output']);
        $this->assertSame('Lubang', $result[0]['ai_raw_output']['detections'][0]['class']);
        $this->assertSame(2, $result[0]['ai_raw_output']['total']);
    }

    public function test_noop_when_report_has_no_primary_photo(): void
    {
        $report = $this->makeReport(['source' => 'petugas']);

        $result = Report::ensurePrimaryPhotoInPhotos([], $report);

        $this->assertSame([], $result);
    }
}
