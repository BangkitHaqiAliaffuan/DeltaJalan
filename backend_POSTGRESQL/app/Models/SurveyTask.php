<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurveyTask extends Model
{
    use HasUuids;

    protected $table = 'survey_tasks';

    protected $fillable = [
        'road_name',
        'kecamatan',
        'road_geometry',
        'road_length_m',
        'priority',
        'catatan',
        'status',
        'team_id',
    ];

    protected $casts = [
        'road_geometry' => 'array',
        'road_length_m' => 'decimal:2',
    ];

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'survey_task_id');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'team_id');
    }
}
