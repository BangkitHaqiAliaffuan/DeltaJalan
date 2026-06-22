<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasUuids;

    protected $table = 'teams';

    protected $fillable = [
        'name',
        'description',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(User::class, 'team_id');
    }

    public function periods(): HasMany
    {
        return $this->hasMany(SurveyPeriod::class, 'team_id');
    }
}
