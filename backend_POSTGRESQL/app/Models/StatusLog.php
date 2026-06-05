<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatusLog extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'status_logs';

    const UPDATED_AT = null;

    protected $fillable = [
        'report_id',
        'old_status',
        'new_status',
        'actor_name',
        'actor_role',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }
}
