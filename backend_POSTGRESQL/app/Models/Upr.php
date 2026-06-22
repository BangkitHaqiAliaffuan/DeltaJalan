<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model untuk tabel 'uprs' — Unit Pelaksana / Tim Satgas Jalan.
 *
 * Mewakili tim lapangan Dinas PU Bina Marga yang mengeksekusi
 * perbaikan kerusakan jalan di wilayah masing-masing.
 *
 * @property int $id
 * @property string $name Nama satgas (e.g. "Satgas Wilayah Utara")
 * @property string|null $wilayah Wilayah cakupan (e.g. "Waru, Sedati, ...")
 * @property string|null $leader_name Nama koordinator tim
 * @property string|null $phone Nomor kontak
 * @property bool $is_active
 */
class Upr extends Model
{
    protected $table = 'uprs';

    protected $fillable = [
        'name',
        'wilayah',
        'leader_name',
        'leader_user_id',
        'phone',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'leader_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(User::class, 'upr_id');
    }
}
