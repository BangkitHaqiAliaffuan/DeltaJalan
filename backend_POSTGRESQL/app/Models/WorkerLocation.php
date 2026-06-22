<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkerLocation extends Model
{
    protected $table = 'worker_locations';

    protected $fillable = [
        'user_id',
        'latitude',
        'longitude',
        'battery_level',
        'tracked_at',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'double',
            'longitude' => 'double',
            'battery_level' => 'integer',
            'tracked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
