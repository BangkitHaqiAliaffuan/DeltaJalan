<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Road extends Model
{
    use HasUuids;

    protected $table = 'roads';

    protected $fillable = [
        'kode_ruas',
        'nama_ruas',
        'kecamatan',
        'panjang_km',
        'polyline',
        'sumber_polyline',
    ];

    protected $casts = [
        'panjang_km' => 'decimal:3',
        'polyline' => 'array',
    ];
}
