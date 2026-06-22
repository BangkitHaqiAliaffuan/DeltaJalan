<?php

namespace App\Services;

class GeographicService
{
    private const EARTH_RADIUS_M = 6371000;

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
