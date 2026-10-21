<?php

namespace App\Support;

use App\Models\User;

final class UserPayload
{
    /**
     * Bentuk user yang dipakai konsisten oleh endpoint auth.
     *
     * @return array<string, mixed>
     */
    public static function make(User $user): array
    {
        $user->loadMissing('team');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'role_label' => $user->role_label,
            'wilayah' => $user->wilayah,
            'nip' => $user->nip,
            'initials' => $user->initials,
            'team_id' => $user->team_id,
            'team_name' => $user->team?->name,
            'needs_phone' => blank($user->phone),
        ];
    }
}
