<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Model Eloquent untuk tabel 'reports'.
 *
 * Merepresentasikan satu laporan kerusakan jalan yang dikirimkan
 * oleh petugas lapangan Dinas Perhubungan Kabupaten Sidoarjo.
 *
 * @property string $id                  UUID primary key
 * @property string $report_code         Kode unik laporan (LP-2026-XXXXX)
 * @property string $reporter_name       Nama petugas lapangan
 * @property string $road_name           Nama ruas jalan
 * @property string $district            Kecamatan di Sidoarjo
 * @property float  $latitude            Koordinat GPS lintang
 * @property float  $longitude           Koordinat GPS bujur
 * @property string|null $image_original_path  Path foto asli di storage
 * @property string|null $image_result_path    Path foto hasil AI di storage
 * @property int    $total_detections    Jumlah objek kerusakan terdeteksi
 * @property string $overall_severity    Tingkat keparahan terparah
 * @property array|null $ai_raw_output   Payload deteksi lengkap dari FastAPI
 * @property string $status              Status workflow laporan
 * @property string|null $system_notes   Catatan internal sistem
 * @property string|null $image_hash     MD5 hash foto asli (anti-duplikasi)
 * @property int    $support_count       Jumlah petugas yang mendukung laporan ini
 */
class Report extends Model
{
    use HasFactory, HasUuids;

    /**
     * Nama tabel di database.
     * Eksplisit ditulis agar tidak bergantung pada konvensi penamaan.
     */
    protected $table = 'reports';

    /**
     * Kolom yang boleh diisi secara massal (mass assignment).
     * Semua kolom yang akan di-set via create() atau fill() harus ada di sini.
     */
    protected $fillable = [
        'report_code',
        'reporter_name',
        'road_name',
        'district',
        'latitude',
        'longitude',
        'image_original_path',
        'image_result_path',
        'image_hash',
        'support_count',
        'total_detections',
        'overall_severity',
        'ai_raw_output',
        'status',
        'system_notes',
    ];

    /**
     * Cast tipe data kolom.
     *
     * Laravel akan otomatis mengkonversi tipe data saat membaca/menulis:
     * - 'array' → JSONB di PostgreSQL akan di-decode menjadi PHP array
     * - 'decimal' → memastikan presisi koordinat GPS tidak hilang
     * - 'integer' → pastikan total_detections selalu integer
     */
    protected $casts = [
        'ai_raw_output'    => 'array',      // JSONB ↔ PHP array
        'latitude'         => 'decimal:8',  // Presisi 8 desimal
        'longitude'        => 'decimal:8',  // Presisi 8 desimal
        'total_detections' => 'integer',
        'support_count'    => 'integer',
    ];

    /**
     * Nilai default untuk kolom-kolom tertentu.
     * Ini sebagai fallback di sisi PHP, meskipun database juga punya default.
     */
    protected $attributes = [
        'total_detections' => 0,
        'overall_severity' => 'Baik',
        'status'           => 'Menunggu Review',
        'support_count'    => 0,
    ];

    // ── Konstanta Enum ────────────────────────────────────────────────────

    /**
     * Daftar nilai valid untuk kolom 'overall_severity'.
     * Harus sinkron dengan tipe ENUM di migration.
     */
    public const SEVERITY_VALUES = [
        'Baik',
        'Rusak Ringan',
        'Rusak Sedang',
        'Rusak Berat',
    ];

    /**
     * Daftar nilai valid untuk kolom 'status'.
     * Harus sinkron dengan tipe ENUM di migration.
     */
    public const STATUS_VALUES = [
        'Menunggu Review',
        'Sedang Diperbaiki',
        'Selesai',
    ];

    // ── Accessor (Getter Tambahan) ────────────────────────────────────────

    /**
     * Mendapatkan URL publik foto asli.
     * Mengembalikan null jika path belum tersimpan.
     */
    public function getImageOriginalUrlAttribute(): ?string
    {
        if (! $this->image_original_path) {
            return null;
        }

        return asset('storage/' . $this->image_original_path);
    }

    /**
     * Mendapatkan URL publik foto hasil analisis AI (dengan bounding box).
     * Mengembalikan null jika path belum tersimpan.
     */
    public function getImageResultUrlAttribute(): ?string
    {
        if (! $this->image_result_path) {
            return null;
        }

        return asset('storage/' . $this->image_result_path);
    }

    /**
     * Mendapatkan label warna untuk tingkat keparahan.
     * Berguna untuk response API yang dikonsumsi frontend.
     */
    public function getSeverityColorAttribute(): string
    {
        return match ($this->overall_severity) {
            'Rusak Berat'  => '#EF4444',
            'Rusak Sedang' => '#F97316',
            'Rusak Ringan' => '#F59E0B',
            default        => '#10B981', // Baik
        };
    }

    // ── Relationships ─────────────────────────────────────────────────────

    /**
     * Laporan ini memiliki banyak foto bukti tambahan.
     */
    public function evidences(): HasMany
    {
        return $this->hasMany(ReportEvidence::class, 'report_id');
    }
}
