<?php

namespace App\Services;

class GeographicService
{
    private const EARTH_RADIUS_M = 6371000;

    private const KECAMATAN_BBOX = [
        'Porong' => [-7.559, 112.659, -7.503, 112.808],
        'Tanggulangin' => [-7.535, 112.662, -7.476, 112.782],
        'Waru' => [-7.370, 112.708, -7.337, 112.828],
        'Gedangan' => [-7.415, 112.697, -7.364, 112.758],
        'Sidoarjo' => [-7.526, 112.660, -7.422, 112.824],
        'Candi' => [-7.519, 112.660, -7.452, 112.804],
        'Buduran' => [-7.480, 112.693, -7.406, 112.819],
        'Sedati' => [-7.485, 112.745, -7.330, 112.842],
        'Taman' => [-7.390, 112.615, -7.336, 112.720],
        'Krian' => [-7.438, 112.558, -7.368, 112.632],
        'Balongbendo' => [-7.439, 112.472, -7.397, 112.577],
        'Wonoayu' => [-7.455, 112.588, -7.401, 112.671],
        'Sukodono' => [-7.430, 112.625, -7.367, 112.706],
        'Krembung' => [-7.556, 112.605, -7.477, 112.672],
        'Tulangan' => [-7.510, 112.611, -7.442, 112.684],
        'Tarik' => [-7.471, 112.457, -7.425, 112.565],
        'Prambon' => [-7.504, 112.540, -7.432, 112.622],
        'Jabon' => [-7.577, 112.704, -7.493, 112.880],
    ];

    public static function detectKecamatan(float $lat, float $lng): ?string
    {
        foreach (self::KECAMATAN_BBOX as $name => [$s, $w, $n, $e]) {
            if ($lat >= $s && $lat <= $n && $lng >= $w && $lng <= $e) {
                return $name;
            }
        }

        return null;
    }

    public function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $dlat = deg2rad($lat2 - $lat1);
        $dlng = deg2rad($lng2 - $lng1);

        $a = sin($dlat / 2) ** 2
            + cos($lat1Rad) * cos($lat2Rad) * sin($dlng / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function pointToSegmentDistance(
        float $px, float $py,
        float $ax, float $ay,
        float $bx, float $by
    ): float {
        $dx = $bx - $ax;
        $dy = $by - $ay;
        $lengthSq = $dx * $dx + $dy * $dy;

        if ($lengthSq === 0.0) {
            return $this->haversineDistance($px, $py, $ax, $ay);
        }

        $t = (($px - $ax) * $dx + ($py - $ay) * $dy) / $lengthSq;
        $t = max(0, min(1, $t));

        $projX = $ax + $t * $dx;
        $projY = $ay + $t * $dy;

        return $this->haversineDistance($px, $py, $projX, $projY);
    }

    public function isPointOnRoad(
        float $lat,
        float $lng,
        array $geometry,
        float $thresholdMeters = 100
    ): array {
        if (count($geometry) < 2) {
            return ['inBounds' => false, 'distance' => PHP_FLOAT_MAX];
        }

        $minDist = PHP_FLOAT_MAX;

        for ($i = 0; $i < count($geometry) - 1; $i++) {
            $dist = $this->pointToSegmentDistance(
                $lat, $lng,
                $geometry[$i][0], $geometry[$i][1],
                $geometry[$i + 1][0], $geometry[$i + 1][1]
            );
            if ($dist < $minDist) {
                $minDist = $dist;
            }
        }

        return [
            'inBounds' => $minDist <= $thresholdMeters,
            'distance' => round($minDist, 2),
        ];
    }
}
