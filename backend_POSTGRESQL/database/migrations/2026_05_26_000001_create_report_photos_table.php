<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('report_id');
            $table->foreign('report_id')->references('id')->on('reports')->onDelete('cascade');
            $table->string('image_original_path', 500)->nullable();
            $table->string('image_result_path', 500)->nullable();
            $table->string('image_hash', 64)->nullable()->index();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('koordinat_sumber', 20)->nullable();
            $table->string('ai_jenis_kerusakan', 100)->nullable();
            $table->string('ai_severity', 20)->nullable();
            $table->decimal('ai_confidence', 4, 3)->nullable();
            $table->jsonb('ai_raw_output')->nullable();
            $table->integer('total_detections')->default(0);
            $table->text('system_notes')->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('original_filename', 255)->nullable();
            $table->timestamps();
        });

        // Migrate existing sub-report data into report_photos
        $subReports = DB::table('reports')->where('is_batch_sub', true)->get();
        foreach ($subReports as $sub) {
            DB::table('report_photos')->insert([
                'id' => Str::uuid()->toString(),
                'report_id' => $sub->parent_report_id,
                'image_original_path' => $sub->image_original_path,
                'image_result_path' => $sub->image_result_path,
                'image_hash' => $sub->image_hash,
                'latitude' => $sub->latitude,
                'longitude' => $sub->longitude,
                'koordinat_sumber' => $sub->koordinat_sumber,
                'ai_jenis_kerusakan' => $sub->ai_jenis_kerusakan,
                'ai_severity' => $sub->ai_severity,
                'ai_confidence' => $sub->ai_confidence,
                'total_detections' => $sub->total_detections ?? 0,
                'system_notes' => $sub->system_notes,
                'sort_order' => 0,
                'created_at' => $sub->created_at,
                'updated_at' => $sub->updated_at,
            ]);
        }

        // Hapus sub-report yang sudah dipindahkan
        DB::table('reports')->where('is_batch_sub', true)->delete();

        // Drop kolom yang tidak diperlukan lagi
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['is_batch_main', 'is_batch_sub', 'parent_report_id']);
        });
    }

    public function down(): void
    {
        // Restore columns
        Schema::table('reports', function (Blueprint $table) {
            $table->boolean('is_batch_sub')->default(false)->after('batch_id');
            $table->boolean('is_batch_main')->default(false)->after('batch_id');
            $table->uuid('parent_report_id')->nullable()->after('batch_id');
        });

        // Migrate report_photos back to reports as sub-reports
        $photos = DB::table('report_photos')->get();
        foreach ($photos as $photo) {
            $mainReport = DB::table('reports')->find($photo->report_id);
            if (! $mainReport) {
                continue;
            }

            $reportCode = $this->generateReportCode();
            DB::table('reports')->insert([
                'id' => Str::uuid()->toString(),
                'report_code' => $reportCode,
                'reporter_name' => $mainReport->reporter_name,
                'road_name' => $mainReport->road_name,
                'district' => $mainReport->district,
                'latitude' => $photo->latitude ?? $mainReport->latitude,
                'longitude' => $photo->longitude ?? $mainReport->longitude,
                'koordinat_sumber' => $photo->koordinat_sumber ?? $mainReport->koordinat_sumber ?? 'manual',
                'status' => $mainReport->status,
                'batch_id' => $mainReport->batch_id,
                'is_batch_sub' => true,
                'is_batch_main' => false,
                'parent_report_id' => $mainReport->id,
                'trust_score' => $mainReport->trust_score,
                'trust_label' => $mainReport->trust_label,
                'ai_jenis_kerusakan' => $photo->ai_jenis_kerusakan,
                'ai_severity' => $photo->ai_severity,
                'ai_confidence' => $photo->ai_confidence,
                'total_detections' => $photo->total_detections ?? 0,
                'image_original_path' => $photo->image_original_path,
                'image_result_path' => $photo->image_result_path,
                'image_hash' => $photo->image_hash,
                'system_notes' => $photo->system_notes,
                'created_at' => $photo->created_at,
                'updated_at' => $photo->updated_at,
            ]);
        }

        Schema::dropIfExists('report_photos');
    }

    private function generateReportCode(): string
    {
        $year = date('Y');
        $last = DB::table('reports')
            ->where('report_code', 'like', "LP-{$year}-%")
            ->orderBy('report_code', 'desc')
            ->first();
        $next = $last ? ((int) substr($last->report_code, -5)) + 1 : 1;

        return sprintf('LP-%s-%05d', $year, $next);
    }
};
