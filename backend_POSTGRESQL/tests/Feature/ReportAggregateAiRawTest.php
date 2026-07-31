<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Services\PciService;
use Tests\TestCase;

class ReportAggregateAiRawTest extends TestCase
{
    public function test_aggregates_detections_from_multiple_photos(): void
    {
        $aggregated = Report::aggregateDetectionsFromPhotoOutputs([
            [
                ['type' => 'Lubang', 'confidence' => 0.92, 'bbox' => [0.1, 0.1, 0.4, 0.3]],
            ],
            [
                ['type' => 'Retak Memanjang', 'confidence' => 0.87, 'bbox' => [0.2, 0.5, 0.8, 0.6]],
                ['type' => 'Retak Kulit Buaya', 'confidence' => 0.71, 'bbox' => [0.5, 0.5, 0.9, 0.9]],
            ],
        ]);

        $this->assertNotNull($aggregated);
        $this->assertCount(3, $aggregated);

        $this->assertSame('Lubang', $aggregated[0]['class']);
        $this->assertSame(0.92, $aggregated[0]['confidence']);
        $this->assertSame([
            'x1' => 0.1,
            'y1' => 0.1,
            'x2' => 0.4,
            'y2' => 0.3,
        ], $aggregated[0]['bbox']);

        $this->assertSame('Retak Memanjang', $aggregated[1]['class']);
        $this->assertSame('Retak Kulit Buaya', $aggregated[2]['class']);
    }

    public function test_handles_class_key_and_assoc_bbox(): void
    {
        $aggregated = Report::aggregateDetectionsFromPhotoOutputs([
            [
                ['class' => 'Retak Melintang', 'confidence' => 0.66, 'bbox' => ['x1' => 0.0, 'y1' => 0.0, 'x2' => 0.3, 'y2' => 0.2]],
            ],
        ]);

        $this->assertCount(1, $aggregated);
        $this->assertSame('Retak Melintang', $aggregated[0]['class']);
        $this->assertSame(['x1' => 0.0, 'y1' => 0.0, 'x2' => 0.3, 'y2' => 0.2], $aggregated[0]['bbox']);
    }

    public function test_returns_null_when_no_detections(): void
    {
        $this->assertNull(Report::aggregateDetectionsFromPhotoOutputs([[], null, []]));
        $this->assertNull(Report::aggregateDetectionsFromPhotoOutputs([]));
    }

    public function test_pci_calculable_from_aggregated_output(): void
    {
        $aggregated = Report::aggregateDetectionsFromPhotoOutputs([
            [
                ['type' => 'Lubang', 'confidence' => 0.95, 'bbox' => [0.2, 0.2, 0.7, 0.6]],
                ['type' => 'Lubang', 'confidence' => 0.90, 'bbox' => [0.1, 0.1, 0.5, 0.4]],
            ],
        ]);

        $report = new Report([
            'ai_raw_output' => $aggregated,
            'total_detections' => count($aggregated),
            'overall_severity' => 'Rusak Berat',
        ]);

        $pci = app(PciService::class)->calculateFromReport($report);

        $this->assertNotNull($pci);
        $this->assertGreaterThanOrEqual(0, $pci);
        $this->assertLessThanOrEqual(100, $pci);
    }
}
