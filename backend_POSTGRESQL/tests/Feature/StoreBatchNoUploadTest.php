<?php

namespace Tests\Feature;

use App\Http\Controllers\ReportController;
use App\Models\BatchAnalysis;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StoreBatchNoUploadTest extends TestCase
{
    public function test_batch_analysis_photo_paths_is_fillable_and_cast_to_array(): void
    {
        $model = new BatchAnalysis;
        $model->batch_id = '019fb700-0000-0000-0000-000000000002';
        $model->photo_paths = ['batch-tmp/abc/0.jpg'];

        $this->assertTrue($model->isFillable('photo_paths'));
        $this->assertSame(['batch-tmp/abc/0.jpg'], $model->photo_paths);
        $this->assertIsArray($model->photo_paths);
    }

    public function test_save_photo_from_path_copies_file_to_public_disk(): void
    {
        $source = UploadedFile::fake()->image('foto.jpg', 50, 50);
        $sourcePath = $source->getPathname();
        $this->assertFileExists($sourcePath);

        $method = new \ReflectionMethod(ReportController::class, 'savePhotoFromPath');
        $method->setAccessible(true);

        $controller = app(ReportController::class);
        $relativePath = $method->invoke($controller, $sourcePath, 'uuid-batch-test.jpg');

        $this->assertSame('reports/originals/uuid-batch-test.jpg', $relativePath);
        $this->assertFileExists(storage_path('app/public/reports/originals/uuid-batch-test.jpg'));

        Storage::disk('public')->delete('reports/originals/uuid-batch-test.jpg');
    }

    public function test_save_photo_from_path_returns_null_when_source_missing(): void
    {
        $method = new \ReflectionMethod(ReportController::class, 'savePhotoFromPath');
        $method->setAccessible(true);

        $controller = app(ReportController::class);
        $relativePath = $method->invoke($controller, '/tmp/tidak-ada-foto.jpg', 'uuid-batch-test.jpg');

        $this->assertNull($relativePath);
    }
}
