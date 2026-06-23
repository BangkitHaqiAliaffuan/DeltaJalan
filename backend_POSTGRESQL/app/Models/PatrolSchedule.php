<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatrolSchedule extends Model
{
    use HasUuids;

    protected $table = 'patrol_schedules';

    protected $fillable = [
        'team_id',
        'hari',
        'kecamatan_list',
        'frekuensi',
        'start_date',
        'end_date',
        'alasan_tugas',
        'status',
        'created_by',
    ];

    protected $casts = [
        'hari' => 'array',
        'kecamatan_list' => 'array',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
