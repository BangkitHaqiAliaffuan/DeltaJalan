<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasUuids;

    protected $table = 'teams';

    protected $fillable = [
        'name',
        'description',
        'uptd_id',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(User::class, 'team_id');
    }

    public function uptd(): BelongsTo
    {
        return $this->belongsTo(Uptd::class, 'uptd_id');
    }

    public function surveyTasks(): HasMany
    {
        return $this->hasMany(SurveyTask::class, 'team_id');
    }
}
