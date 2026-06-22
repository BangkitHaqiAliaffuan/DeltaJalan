<?php

namespace App\Services;

/**
 * TrustScoreService
 *
 * Menghitung trust score (0-100) untuk setiap laporan kerusakan jalan
 * berdasarkan lima faktor verifikasi.
 *
 * Trust score adalah alat bantu triase untuk supervisor — bukan gatekeeper.
 * Laporan dengan score rendah tetap bisa diproses, hanya perlu review lebih teliti.
 *
 * Faktor penilaian:
 * - GPS EXIF tersedia          : +30 poin
 * - Nama jalan cocok geocode   : +20 poin
 * - AI deteksi kerusakan       : +20 poin
 * - Konteks visual valid       : +15 poin
 * - Tidak ada indikasi fake GPS: +15 poin
 *
 * Label:
 * - hijau  >= 75 : Kredibel
 * - kuning 45-74 : Perlu review manual
 * - merah  < 45  : Sangat diragukan
 */
class TrustScoreService
{
    /**
     * Hitung trust score dari data laporan.
     *
     * @param  array  $data  Data laporan yang sudah diproses
     * @return array{score: int, label: string, breakdown: array}
     */
    public function calculate(array $data): array
    {
        $score = 0;
        $breakdown = [];

        // ── GPS EXIF tersedia (+30) ───────────────────────────────────────
        if (! empty($data['exif_lat']) && ! empty($data['exif_lng'])) {
            $score += 30;
            $breakdown['exif_gps'] = ['nilai' => 30, 'status' => 'ada'];
        } else {
            $breakdown['exif_gps'] = ['nilai' => 0, 'status' => 'tidak_ada'];
        }

        // ── Nama jalan cocok dengan reverse geocode (+20) ─────────────────
        if (! empty($data['road_name_matched'])) {
            $score += 20;
            $breakdown['nama_jalan'] = ['nilai' => 20, 'status' => 'cocok'];
        } else {
            $breakdown['nama_jalan'] = ['nilai' => 0, 'status' => 'tidak_cocok'];
        }

        // ── AI deteksi kerusakan berhasil (+20) ───────────────────────────
        if (! empty($data['ai_detections']) && count($data['ai_detections']) > 0) {
            $score += 20;
            $breakdown['ai_deteksi'] = ['nilai' => 20, 'status' => 'berhasil'];
        } else {
            $breakdown['ai_deteksi'] = ['nilai' => 0, 'status' => 'gagal'];
        }

        // ── Konteks visual valid — ada elemen jalan di foto (+15) ─────────
        if (! empty($data['ai_context_valid'])) {
            $score += 15;
            $breakdown['konteks_visual'] = ['nilai' => 15, 'status' => 'valid'];
        } else {
            $breakdown['konteks_visual'] = ['nilai' => 0, 'status' => 'tidak_valid'];
        }

        // ── Tidak ada indikasi fake GPS (+15) ─────────────────────────────
        if (empty($data['fake_gps_suspected'])) {
            $score += 15;
            $breakdown['fake_gps'] = ['nilai' => 15, 'status' => 'aman'];
        } else {
            $breakdown['fake_gps'] = ['nilai' => 0, 'status' => 'dicurigai'];
        }

        // ── Tentukan label ────────────────────────────────────────────────
        $label = match (true) {
            $score >= 75 => 'hijau',
            $score >= 45 => 'kuning',
            default => 'merah',
        };

        return [
            'score' => $score,
            'label' => $label,
            'breakdown' => $breakdown,
        ];
    }
}
