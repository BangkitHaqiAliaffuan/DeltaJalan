<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class InspectionPhoto extends Model
{
    use HasUuids;

    protected $fillable = [
        'inspection_result_id',
        'path',
        'sha256',
        'sort_order',
        'latitude',
        'longitude',
        'taken_at',
    ];

    protected $appends = ['url'];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'taken_at' => 'datetime',
    ];

    public function getUrlAttribute(): ?string
    {
        if (! $this->path) {
            return null;
        }

        if (str_starts_with($this->path, 'http://') || str_starts_with($this->path, 'https://')) {
            return $this->path;
        }

        $clean = ltrim($this->path, '/');

        return str_starts_with($clean, 'storage/') ? '/'.$clean : '/storage/'.$clean;
    }

    public function result()
    {
        return $this->belongsTo(InspectionResult::class, 'inspection_result_id');
    }
}

