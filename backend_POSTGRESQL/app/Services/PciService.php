<?php

namespace App\Services;

use App\Models\Report;

class PciService
{
    private const SEVERITY_WEIGHT = 50;
    private const COVERAGE_WEIGHT = 30;
    private const COUNT_PENALTY_MAX = 10;
    private const DIVERSITY_PENALTY_MAX = 10;
    private const COVERAGE_MAX = 30;

    private const CONDITION_MAP = [
        'Baik' => ['min' => 86, 'max' => 100],
        'Rusak Ringan' => ['min' => 71, 'max' => 85],
        'Rusak Sedang' => ['min' => 56, 'max' => 70],
        'Rusak Berat' => ['min' => 41, 'max' => 55],
        'Kritis' => ['min' => 0, 'max' => 40],
    ];

    private const CONDITION_COLORS = [
        'Baik' => '#22c55e',
        'Rusak Ringan' => '#86efac',
        'Rusak Sedang' => '#eab308',
        'Rusak Berat' => '#f97316',
        'Kritis' => '#ef4444',
    ];

    public function calculateFromReport(Report $report): ?float
    {
        $raw = $report->ai_raw_output;
        $totalDetections = $report->total_detections ?? 0;

        if (empty($raw)) {
            return null;
        }

        if (is_array($raw) && array_is_list($raw)) {
            $raw = [
                'detections' => $raw,
                'overall_severity' => $report->overall_severity,
            ];
        }

        return $this->calculate($raw, $totalDetections);
    }

    public function calculateFromRawOutput(array $aiRawOutput, int $totalDetections): ?float
    {
        if (empty($aiRawOutput)) {
            return null;
        }

        return $this->calculate($aiRawOutput, $totalDetections);
    }

    private function calculate(array $raw, int $totalDetections): float
    {
        $deduction = 0.0;

        $deduction += $this->severityDeduction($raw);
        $deduction += $this->coverageDeduction($raw);
        $deduction += $this->countDeduction($totalDetections);
        $deduction += $this->diversityDeduction($raw);

        return max(0, min(100, round(100 - $deduction, 2)));
    }

    private function severityDeduction(array $raw): float
    {
        $score = $raw['severity_score'] ?? null;
        if ($score !== null && is_numeric($score)) {
            $score = min((float) $score, 4.0);
            return ($score / 4.0) * self::SEVERITY_WEIGHT;
        }

        $severity = $raw['overall_severity'] ?? null;
        if ($severity) {
            $map = [
                'Baik' => 0,
                'Rusak Ringan' => 1.0,
                'Rusak Sedang' => 2.0,
                'Rusak Berat' => 3.5,
            ];
            return ($map[$severity] / 4.0) * self::SEVERITY_WEIGHT;
        }

        return 0;
    }

    private function coverageDeduction(array $raw): float
    {
        $totalArea = 0.0;
        $detections = $raw['detections'] ?? [];

        if (empty($detections)) {
            $coverage = $raw['severity_detail']['area'] ?? null;
            if ($coverage && preg_match('/cov=(\d+\.?\d*)%/', $coverage, $m)) {
                return min((float) $m[1], self::COVERAGE_MAX);
            }
            return 0;
        }

        foreach ($detections as $d) {
            $bbox = $d['bbox'] ?? null;
            if ($bbox) {
                $w = ($bbox['x2'] ?? 0) - ($bbox['x1'] ?? 0);
                $h = ($bbox['y2'] ?? 0) - ($bbox['y1'] ?? 0);
                $totalArea += max(0, $w * $h);
            }
        }

        $totalArea = min($totalArea, 1.0);
        $coveragePct = min($totalArea * 100, self::COVERAGE_MAX);

        return $coveragePct;
    }

    private function countDeduction(int $totalDetections): float
    {
        return min($totalDetections * 2, self::COUNT_PENALTY_MAX);
    }

    private function diversityDeduction(array $raw): float
    {
        $detections = $raw['detections'] ?? [];
        if (empty($detections)) {
            return 0;
        }

        $classes = array_unique(array_column($detections, 'class'));

        return min(count($classes) * 5, self::DIVERSITY_PENALTY_MAX);
    }

    public function conditionLabel(float $pci): string
    {
        foreach (self::CONDITION_MAP as $label => $range) {
            if ($pci >= $range['min'] && $pci <= $range['max']) {
                return $label;
            }
        }
        return 'Kritis';
    }

    public function conditionColor(float $pci): string
    {
        $label = $this->conditionLabel($pci);
        return self::CONDITION_COLORS[$label] ?? '#6b7280';
    }
}
