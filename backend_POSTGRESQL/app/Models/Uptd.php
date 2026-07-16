<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Uptd extends Model
{
    use HasUuids;

    protected $table = 'uptd';

    protected $fillable = [
        'nama',
        'kecamatan_wilayah',
    ];

    protected $casts = [
        'kecamatan_wilayah' => 'array',
    ];

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class, 'uptd_id');
    }

    public function supervisors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'supervisor_uptd', 'uptd_id', 'user_id')
            ->where('role', 'supervisor')
            ->withPivot('priority')
            ->withTimestamps();
    }

    public static function resolveTeamIdByDistrict(string $district): ?string
    {
        $uptd = self::whereJsonContains('kecamatan_wilayah', $district)->first();

        if (! $uptd) {
            return null;
        }

        $team = $uptd->teams()->first();

        return $team?->id;
    }
}
