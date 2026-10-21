<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'firebase_uid',
        'password',
        'role',
        'wilayah',
        'nip',
        'phone',
        'address',
        'registration_ip',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'firebase_uid',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'banned_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function team()
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    public function ledTeam()
    {
        return $this->hasOne(Upr::class, 'leader_user_id');
    }

    public function locations()
    {
        return $this->hasMany(WorkerLocation::class, 'user_id');
    }

    public function getInitialsAttribute(): string
    {
        $name = trim((string) $this->name);
        if ($name === '') {
            return '?';
        }

        $words = preg_split('/\s+/u', $name) ?: [];

        if (count($words) >= 2) {
            return Str::upper(Str::substr($words[0], 0, 1).Str::substr($words[1], 0, 1));
        }

        return Str::upper(Str::substr($name, 0, 2));
    }

    public function getRoleLabelAttribute(): string
    {
        return match ($this->role) {
            'admin' => 'Administrator',
            'supervisor' => 'Supervisor',
            'petugas' => 'Petugas',
            'petugas_eksekusi' => 'Petugas Eksekusi',
            'warga' => 'Warga',
            default => 'Petugas Lapangan',
        };
    }

    public function supervisedUptds(): BelongsToMany
    {
        return $this->belongsToMany(Uptd::class, 'supervisor_uptd', 'user_id', 'uptd_id')
            ->withPivot('priority')
            ->withTimestamps();
    }

    public function getSupervisedDistrictListAttribute(): array
    {
        return $this->supervisedUptds
            ->pluck('kecamatan_wilayah')
            ->flatten()
            ->unique()
            ->values()
            ->toArray();
    }
}
