<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchAnalysis extends Model
{
    protected $table = 'batch_analyses';

    public $timestamps = false;

    protected $fillable = [
        'batch_id',
        'analyses',
        'photo_paths',
    ];

    protected function casts(): array
    {
        return [
            'analyses' => 'array',
            'photo_paths' => 'array',
        ];
    }
}
