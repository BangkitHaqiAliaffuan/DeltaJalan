<?php

namespace App\Services;

/**
 * Penjaga lokasi foto hasil inspeksi.
 *
 * Sebelum ini petugas bisa mengirim 1 foto asli di lokasi kerusakan lalu
 * menambahkan 4 foto dari rumahnya: `NativeInspectionController` hanya
 * memeriksa "masih di dalam Sidoarjo", yang luasnya ~714 km² sehingga praktis
 * tidak membatasi apa pun. Koordinat hasil hanya diambil dari foto PERTAMA.
 *
 * Dua sumbu yang dijaga:
 *   1. Jarak foto ke titik laporan warga (identitas lokasi).
 *   2. Jarak antar foto (satu kunjungan, bukan campuran foto lama).
 *
 * Angka ambang TIDAK ketat. Penelitian akurasi GPS foto ber-geotag menunjukkan
 * galat rata-rata 4 m sampai ~50 m tergantung perangkat
 * (Szafarczyk dkk., 2025, Cuadernos de Investigación Geográfica) dan 7-13 m di
 * lingkungan urban (Merry & Bettinger, 2019, PLOS ONE). Ambang belasan meter
 * akan menolak pekerjaan yang benar, jadi batas bawahnya diletakkan jauh di
 * atas derau tersebut.
 *
 * Peringatan lunak disimpan di catatan sistem laporan (pola yang sama dengan
 * `ReportController::store`), karena supervisor tetap menjadi penentu akhir.
 */
class InspectionPhotoGuard
{
    /** Jarak foto ke titik laporan yang langsung ditolak (meter). */
    public const MAX_DISTANCE_FROM_REPORT_M = 1000.0;

    /** Jarak foto ke titik laporan yang dicatat sebagai peringatan (meter). */
    public const WARN_DISTANCE_FROM_REPORT_M = 300.0;

    /** Sebaran maksimum antar foto dalam satu kiriman (meter). */
    public const MAX_SPREAD_M = 200.0;

    /**
     * Periksa sebaran lokasi foto.
     *
     * @param  array<int, array{lat: float|null, lng: float|null}>  $photos
     *                                                                       Koordinat tiap foto berurutan; `null` bila foto tanpa GPS EXIF.
     * @return array{reject: string|null, warnings: array<int, string>}
     */
    public function review(?float $reportLat, ?float $reportLng, array $photos): array
    {
        $warnings = [];
        $geo = new GeographicService;

        $punyaTitikLaporan = $reportLat !== null && $reportLng !== null;

        if (! $punyaTitikLaporan) {
            // Laporan lama bisa belum punya koordinat. Tidak boleh menolak
            // pekerjaan yang sah hanya karena data laporan tidak lengkap.
            $warnings[] = '[INFO] Titik laporan tidak tersedia; jarak foto inspeksi tidak dapat diverifikasi.';
        }

        // ── Sumbu 1: jarak setiap foto ke titik laporan ──────────────────
        if ($punyaTitikLaporan) {
            foreach ($photos as $i => $p) {
                if ($p['lat'] === null || $p['lng'] === null) {
                    $warnings[] = '[INFO] Foto ke-'.($i + 1).' tidak memuat GPS EXIF; lokasinya tidak terverifikasi.';

                    continue;
                }

                $jarak = $geo->haversineDistance($reportLat, $reportLng, $p['lat'], $p['lng']);

                if ($jarak > self::MAX_DISTANCE_FROM_REPORT_M) {
                    return [
                        'reject' => 'Foto ke-'.($i + 1).' diambil '.round($jarak).' m dari lokasi kerusakan '
                            .'(batas '.self::MAX_DISTANCE_FROM_REPORT_M.' m). Pastikan foto diambil di lokasi laporan.',
                        'warnings' => $warnings,
                    ];
                }

                if ($jarak > self::WARN_DISTANCE_FROM_REPORT_M) {
                    $warnings[] = '[PERINGATAN] Foto ke-'.($i + 1).' berjarak '.round($jarak)
                        .' m dari titik laporan; perlu diverifikasi supervisor.';
                }
            }
        }

        // ── Sumbu 2: sebaran antar foto ─────────────────────────────────
        // Foto pertama yang punya GPS menjadi jangkar. Tanpa ini, semua foto
        // hanya diuji ke titik laporan dan empat foto dari lokasi berbeda
        // tetap lolos selama masing-masing masih dekat titik laporan.
        $jangkar = null;
        $jangkarIndex = null;
        foreach ($photos as $i => $p) {
            if ($p['lat'] !== null && $p['lng'] !== null) {
                $jangkar = $p;
                $jangkarIndex = $i;

                break;
            }
        }

        if ($jangkar !== null) {
            foreach ($photos as $i => $p) {
                if ($i === $jangkarIndex || $p['lat'] === null || $p['lng'] === null) {
                    continue;
                }

                $jarak = $geo->haversineDistance($jangkar['lat'], $jangkar['lng'], $p['lat'], $p['lng']);

                if ($jarak > self::MAX_SPREAD_M) {
                    return [
                        'reject' => 'Foto ke-'.($i + 1).' berjarak '.round($jarak).' m dari foto pertama '
                            .'(batas '.self::MAX_SPREAD_M.' m). Semua foto harus dari lokasi yang sama.',
                        'warnings' => $warnings,
                    ];
                }
            }
        }

        return ['reject' => null, 'warnings' => array_values(array_unique($warnings))];
    }
}
