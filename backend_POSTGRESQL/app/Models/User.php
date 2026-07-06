<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
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
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
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
        $words = explode(' ', trim($this->name));
        if (count($words) >= 2) {
            return strtoupper(substr($words[0], 0, 1).substr($words[1], 0, 1));
        }

        return strtoupper(substr($this->name, 0, 2));
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
}
