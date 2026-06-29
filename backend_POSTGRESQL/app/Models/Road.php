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
        'osm_id',
        'nama_ruas',
        'kecamatan',
        'panjang_km',
        'polyline',
        'sumber_polyline',
        'highway_type',
        'surface',
    ];

    protected $casts = [
        'panjang_km' => 'decimal:3',
        'polyline' => 'array',
    ];

    public static function normalizeName(string $name): string
    {
        $name = trim($name);
        $name = preg_replace('/\s+/', ' ', $name);
        $name = preg_replace('/\s*-\s*/', ' - ', $name);
        $name = str_replace(['Jl. ', 'Jln. ', 'Jln ', 'Jl '], 'Jalan ', $name);
        $name = preg_replace('/^Jalan\s+/i', 'Jalan ', $name);

        return trim($name);
    }
}
