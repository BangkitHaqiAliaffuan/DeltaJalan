<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportPhoto extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'report_photos';

    protected $fillable = [
        'report_id',
        'reporter_name',
        'image_original_path',
        'image_result_path',
        'image_hash',
        'latitude',
        'longitude',
        'koordinat_sumber',
        'ai_jenis_kerusakan',
        'ai_severity',
        'ai_confidence',
        'ai_raw_output',
        'total_detections',
        'kerusakan_panjang',
        'kerusakan_lebar',
        'system_notes',
        'sort_order',
        'original_filename',
    ];

    protected $casts = [
        'ai_raw_output' => 'array',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'ai_confidence' => 'decimal:3',
        'total_detections' => 'integer',
        'kerusakan_panjang' => 'decimal:2',
        'kerusakan_lebar' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    public function getImageOriginalUrlAttribute(): ?string
    {
        if (! $this->image_original_path) {
            return null;
        }

        return asset('storage/'.$this->image_original_path);
    }

    public function getImageResultUrlAttribute(): ?string
    {
        if (! $this->image_result_path) {
            return null;
        }

        return asset('storage/'.$this->image_result_path);
    }
}
