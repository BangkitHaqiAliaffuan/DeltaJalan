<?php

namespace Tests\Feature;

use App\Models\BatchAnalysis;
use Tests\TestCase;

class BatchAnalysisModelTest extends TestCase
{
    public function test_analyses_is_cast_to_array(): void
    {
        $model = new BatchAnalysis;
        $model->batch_id = '019fb700-0000-0000-0000-000000000001';
        $model->analyses = [
            ['file_index' => 0, 'severity' => 'ringan', 'image_result' => 'base64...'],
        ];

        $this->assertIsArray($model->analyses);
        $this->assertSame('ringan', $model->analyses[0]['severity']);
        $this->assertSame('base64...', $model->analyses[0]['image_result']);
    }

    public function test_model_uses_batch_analyses_table_without_timestamps(): void
    {
        $model = new BatchAnalysis;

        $this->assertSame('batch_analyses', $model->getTable());
        $this->assertFalse($model->usesTimestamps());
    }

    public function test_batch_id_and_analyses_are_fillable(): void
    {
        $model = new BatchAnalysis;

        $this->assertTrue($model->isFillable('batch_id'));
        $this->assertTrue($model->isFillable('analyses'));
    }
}
