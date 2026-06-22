<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Model Eloquent untuk tabel 'reports'.
 *
 * Merepresentasikan satu laporan kerusakan jalan yang dikirimkan
 * oleh petugas lapangan Dinas Perhubungan Kabupaten Sidoarjo.
 *
 * @property string $id UUID primary key
 * @property string $report_code Kode unik laporan (LP-2026-XXXXX)
 * @property string $reporter_name Nama petugas lapangan
 * @property string $road_name Nama ruas jalan
 * @property string $district Kecamatan di Sidoarjo
 * @property float $latitude Koordinat GPS lintang
 * @property float $longitude Koordinat GPS bujur
 * @property string|null $image_original_path Path foto asli di storage
 * @property string|null $image_result_path Path foto hasil AI di storage
 * @property int $total_detections Jumlah objek kerusakan terdeteksi
 * @property string $overall_severity Tingkat keparahan terparah
 * @property array|null $ai_raw_output Payload deteksi lengkap dari FastAPI
 * @property string $status Status workflow laporan
 * @property string|null $system_notes Catatan internal sistem
 * @property string|null $image_hash MD5 hash foto asli (anti-duplikasi)
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
        'user_id',
        'report_code',
        'reporter_name',
        'road_name',
        'district',
        'latitude',
        'longitude',
        'image_original_path',
        'image_result_path',
        'image_hash',
        'total_detections',
        'overall_severity',
        'ai_raw_output',
        'status',
        'system_notes',
        // Batch grouping
        'batch_id',
        // Trust score
        'trust_score',
        'trust_label',
        'trust_breakdown',
        // Koordinat sumber
        'koordinat_sumber',
        // AI results (batch)
        'ai_jenis_kerusakan',
        'ai_severity',
        'ai_confidence',
        // After photo & closing
        'after_photo_path',
        'after_photo_hash',
        'after_photo_notes',
        'perbaikan_dimulai_at',
        'perbaikan_selesai_at',
        'pelaksana',
        // UPR assignment
        'assigned_upr_id',
        'assigned_at',
        'catatan_petugas',
        // Dimensi kerusakan
        'kerusakan_panjang',
        'kerusakan_lebar',
        // Prioritas penanganan
        'priority',
        // Deadline & breach flags
        'deadline_review',
        'deadline_resolusi',
        'terlambat_review',
        'terlambat_resolusi',
        // Survey task link
        'survey_task_id',
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
        'ai_raw_output' => 'array',      // JSONB ↔ PHP array
        'trust_breakdown' => 'array',      // JSONB ↔ PHP array
        'latitude' => 'decimal:8',  // Presisi 8 desimal
        'longitude' => 'decimal:8',  // Presisi 8 desimal
        'total_detections' => 'integer',
        'trust_score' => 'integer',

        'ai_confidence' => 'decimal:3',
        'perbaikan_dimulai_at' => 'datetime',
        'perbaikan_selesai_at' => 'datetime',
        'assigned_at' => 'datetime',
        'deadline_review' => 'datetime',
        'deadline_resolusi' => 'datetime',
        'terlambat_review' => 'boolean',
        'terlambat_resolusi' => 'boolean',
    ];

    /**
     * Nilai default untuk kolom-kolom tertentu.
     * Ini sebagai fallback di sisi PHP, meskipun database juga punya default.
     */
    protected $attributes = [
        'total_detections' => 0,
        'overall_severity' => 'Baik',
        'status' => 'Menunggu Review',
        'priority' => 'Sedang',
    ];

    /**
     * Relasi ke user (petugas) yang membuat laporan.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relasi ke UPR (tim satgas) yang ditugaskan.
     */
    public function assignedUpr()
    {
        return $this->belongsTo(Upr::class, 'assigned_upr_id');
    }

    /**
     * Accessor: URL publik foto after.
     */
    public function getAfterPhotoUrlAttribute(): ?string
    {
        if (! $this->after_photo_path) {
            return null;
        }

        return asset('storage/'.$this->after_photo_path);
    }

    // ── Konstanta Enum ────────────────────────────────────────────────────

    /**
     * Daftar nilai valid untuk kolom 'priority'.
     * Harus sinkron dengan tipe ENUM di migration.
     */
    public const PRIORITY_VALUES = [
        'Rendah',
        'Sedang',
        'Tinggi',
    ];

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
        'Disetujui',
        'Ditolak',
        'Sedang Diperbaiki',
        'Selesai',
        'Ditinjau',
        'Diedit',
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

        return asset('storage/'.$this->image_original_path);
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

        return asset('storage/'.$this->image_result_path);
    }

    /**
     * Mendapatkan label warna untuk tingkat keparahan.
     * Berguna untuk response API yang dikonsumsi frontend.
     */
    public function getSeverityColorAttribute(): string
    {
        return match ($this->overall_severity) {
            'Rusak Berat' => '#EF4444',
            'Rusak Sedang' => '#F97316',
            'Rusak Ringan' => '#F59E0B',
            default => '#10B981', // Baik
        };
    }

    // ── Relationships ─────────────────────────────────────────────────────

    /**
     * Foto-foto batch yang terkait dengan laporan ini.
     */
    public function photos(): HasMany
    {
        return $this->hasMany(ReportPhoto::class, 'report_id')->orderBy('sort_order');
    }

    /**
     * Riwayat perubahan status laporan ini.
     */
    public function statusLogs(): HasMany
    {
        return $this->hasMany(StatusLog::class, 'report_id')->orderBy('created_at');
    }

    /**
     * Foto pertama (untuk thumbnail preview di dashboard).
     */
    public function firstPhoto(): HasOne
    {
        return $this->hasOne(ReportPhoto::class, 'report_id')->orderBy('sort_order');
    }

    /**
     * Foto-foto after (setelah perbaikan) yang terkait dengan laporan ini.
     */
    public function afterPhotos(): HasMany
    {
        return $this->hasMany(ReportAfterPhoto::class, 'report_id')->orderBy('sort_order');
    }

    /**
     * Relasi duplikasi — laporan ini terindikasi duplikat dari laporan lain.
     */
    public function duplicateOf(): HasOne
    {
        return $this->hasOne(ReportDuplicate::class, 'report_id')
            ->with('originalReport');
    }

    /**
     * URL gambar pertama — foto utama jika ada, fallback ke sub-photo pertama batch.
     */
    public function getFirstPhotoUrlAttribute(): ?string
    {
        if ($this->image_original_path) {
            return $this->image_original_url;
        }
        if ($this->relationLoaded('firstPhoto') && $this->firstPhoto) {
            return $this->firstPhoto->image_original_url;
        }

        return null;
    }

    /**
     * Hitung deadline review berdasarkan priority.
     */
    public static function hitungDeadlineReview(string $priority): Carbon
    {
        $hours = config("deadline.{$priority}.review_hours", 72);

        return now()->addHours((int) $hours);
    }

    /**
     * Hitung deadline resolusi berdasarkan priority.
     */
    public static function hitungDeadlineResolusi(string $priority): Carbon
    {
        $hours = config("deadline.{$priority}.resolution_hours", 168);

        return now()->addHours((int) $hours);
    }

    /**
     * Set deadline pada laporan (dipakai saat create & update priority).
     */
    public function setDeadline(?string $priority = null): void
    {
        $priority = $priority ?? $this->priority ?? 'Sedang';
        $this->deadline_review = static::hitungDeadlineReview($priority);

        // Resolution deadline hanya relevan jika sudah disetujui
        if (in_array($this->status, ['Disetujui', 'Sedang Diperbaiki', 'Selesai'])) {
            $approvedAt = $this->perbaikan_dimulai_at ?? $this->updated_at ?? $this->created_at;
            $this->deadline_resolusi = Carbon::parse($approvedAt)
                ->addHours((int) config("deadline.{$priority}.resolution_hours", 168));
        }
    }

    /**
     * Statis: cek apakah image_hash sudah ada di reports atau report_photos.
     */
    public static function imageHashExists(string $hash): bool
    {
        return static::where('image_hash', $hash)->exists()
            || ReportPhoto::where('image_hash', $hash)->exists();
    }
}
