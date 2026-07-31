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
        // ── TRUST SCORE [NONAKTIF] — trust_score, trust_label, trust_breakdown
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
        // Team assignment
        'assigned_team_id',
        'assigned_supervisor_id',
        'assigned_at',
        'ditugaskan_at',
        'assignor_name',
        'catatan_petugas',
        // Dimensi kerusakan
        'kerusakan_panjang',
        'kerusakan_lebar',
        // Prioritas penanganan
        'priority',
        // Estimasi hari pengerjaan
        'estimasi_hari',
        // Deadline & breach flags
        'deadline_review',
        'deadline_resolusi',
        'terlambat_review',
        'terlambat_resolusi',
        // Survey task link
        'survey_task_id',
        // Source & description (warga)
        'source',
        'description',
        // Reverse geocoded full address
        'full_address',
        // AI analysis tracking
        'ai_analyzed_at',
        'ai_analysis_count',
        // PCI (Pavement Condition Index)
        'pci_score',
        'pci_calculated_at',
        // Rating kepuasan warga
        'rating',
        'rating_comment',
        'rated_at',
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
        // ── TRUST SCORE [NONAKTIF] — 'trust_breakdown' => 'array', 'trust_score' => 'integer',
        'latitude' => 'decimal:8',  // Presisi 8 desimal
        'longitude' => 'decimal:8',  // Presisi 8 desimal
        'total_detections' => 'integer',

        'ai_confidence' => 'decimal:3',
        'perbaikan_dimulai_at' => 'datetime',
        'perbaikan_selesai_at' => 'datetime',
        'assigned_at' => 'datetime',
        'ditugaskan_at' => 'datetime',
        'deadline_review' => 'datetime',
        'deadline_resolusi' => 'datetime',
        'terlambat_review' => 'boolean',
        'terlambat_resolusi' => 'boolean',

        'ai_analyzed_at' => 'datetime',
        'ai_analysis_count' => 'integer',

        'pci_score' => 'decimal:2',
        'pci_calculated_at' => 'datetime',

        'rating' => 'integer',
        'rated_at' => 'datetime',
    ];

    /**
     * Buang field `image_result` (base64 JPEG) dari ai_raw_output.
     *
     * FastAPI/Lambda menyertakan gambar hasil deteksi sebagai base64 di
     * `ai_raw_output.image_result` (±500-700 KB per foto). Frontend hanya
     * membutuhkan `detections` dan menampilkan gambar lewat `image_result_url`,
     * jadi base64 ini hanya membengkakkan payload JSON saat diserialisasi.
     */
    public static function trimAiRawOutput(?array $raw): ?array
    {
        if (! is_array($raw)) {
            return $raw;
        }

        $clean = [];
        foreach ($raw as $key => $value) {
            if ($key === 'image_result') {
                continue;
            }
            $clean[$key] = is_array($value) ? self::trimAiRawOutput($value) : $value;
        }

        return $clean;
    }

    /**
     * Nilai default untuk kolom-kolom tertentu.
     * Ini sebagai fallback di sisi PHP, meskipun database juga punya default.
     */
    protected $attributes = [
        'total_detections' => 0,
        'status' => 'Menunggu Review',
        'source' => 'petugas',
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
     * Relasi ke tim satgas yang ditugaskan.
     */
    public function assignedTeam()
    {
        return $this->belongsTo(Team::class, 'assigned_team_id');
    }

    public function assignedSupervisor()
    {
        return $this->belongsTo(User::class, 'assigned_supervisor_id');
    }

    /**
     * Accessor: URL publik foto after.
     */
    public function getAfterPhotoUrlAttribute(): ?string
    {
        if (! $this->after_photo_path) {
            return null;
        }

        return '/storage/'.$this->after_photo_path;
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
        'Hasil AI',
        'Ditugaskan',
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

        return '/storage/'.$this->image_original_path;
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

        return '/storage/'.$this->image_result_path;
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

    /**
     * Nama tim satgas yang ditugaskan (dari relasi assignedTeam).
     */
    public function getAssignedTeamNameAttribute(): ?string
    {
        return $this->assignedTeam?->name;
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
     * Agregasi deteksi AI dari semua foto batch ke dalam satu payload
     * yang kompatibel dengan PciService (format single report).
     *
     * Deteksi per-foto disimpan di `report_photos.ai_raw_output` dengan skema:
     *   [{ 'type': '...', 'confidence': ..., 'bbox': [x1, y1, x2, y2] }]
     *
     * Sedangkan PciService mengharapkan format single:
     *   [{ 'class': '...', 'confidence': ..., 'bbox': {x1, y1, x2, y2} }]
     *
     * @return array|null null jika tidak ada foto yang punya deteksi AI
     */
    public function aggregateAiRawFromPhotos(): ?array
    {
        $rawOutputs = [];
        foreach ($this->photos as $photo) {
            $rawOutputs[] = $photo->ai_raw_output;
        }

        return self::aggregateDetectionsFromPhotoOutputs($rawOutputs);
    }

    /**
     * Gabungkan payload ai_raw_output beberapa foto menjadi satu list deteksi
     * dengan normalisasi skema batch → single (dipakai di storeBatch & recalculate).
     *
     * @param  array  $photoRawOutputs  list `ai_raw_output` per foto (mungkin null/[]).
     * @return array|null null jika tidak ada deteksi yang valid
     */
    public static function aggregateDetectionsFromPhotoOutputs(array $photoRawOutputs): ?array
    {
        $detections = [];

        foreach ($photoRawOutputs as $raw) {
            if (empty($raw) || ! is_array($raw)) {
                continue;
            }

            foreach ($raw as $d) {
                if (! is_array($d)) {
                    continue;
                }

                $bbox = $d['bbox'] ?? null;
                if (is_array($bbox) && array_is_list($bbox) && count($bbox) >= 4) {
                    $bbox = [
                        'x1' => (float) $bbox[0],
                        'y1' => (float) $bbox[1],
                        'x2' => (float) $bbox[2],
                        'y2' => (float) $bbox[3],
                    ];
                }

                $detections[] = [
                    'class' => $d['type'] ?? $d['class'] ?? 'Unknown',
                    'confidence' => (float) ($d['confidence'] ?? 0),
                    'bbox' => is_array($bbox) ? $bbox : [],
                ];
            }
        }

        return empty($detections) ? null : $detections;
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
     * Update progress (foto + catatan) selama pengerjaan.
     */
    public function progressUpdates(): HasMany
    {
        return $this->hasMany(ReportProgressUpdate::class, 'report_id')->orderBy('created_at');
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
     * Gabungkan foto utama level-report ke daftar photos bila belum terwakili.
     *
     * Alur warga menyimpan foto utama (index 0) hanya di kolom `image_original_path`
     * pada baris `reports`, sedangkan `report_photos` hanya berisi foto 2..N.
     * Akibatnya halaman detail yang membaca `report.photos` kehilangan foto utama.
     * Helper ini prepend entry sintetis foto utama (sort_order 0) ke daftar photos,
     * dengan dedup agar alur Telegram (yang menyimpan foto yang sama di kedua tempat)
     * tidak terduplikasi.
     */
    public static function ensurePrimaryPhotoInPhotos(array $photos, self $report): array
    {
        $primaryUrl = $report->image_original_url;
        if (! $primaryUrl) {
            return $photos;
        }

        $alreadyPresent = collect($photos)->contains(
            fn ($p) => ($p['image_original_url'] ?? null) === $primaryUrl
                || ($report->image_hash && ($p['image_hash'] ?? null) === $report->image_hash)
        );

        if ($alreadyPresent) {
            return $photos;
        }

        array_unshift($photos, [
            'id' => 'primary-'.$report->id,
            'reporter_name' => $report->reporter_name,
            'ai_jenis_kerusakan' => $report->ai_jenis_kerusakan,
            'ai_severity' => $report->ai_severity ?? $report->overall_severity,
            'ai_confidence' => $report->ai_confidence !== null ? (float) $report->ai_confidence : null,
            'total_detections' => $report->total_detections,
            'ai_raw_output' => self::trimAiRawOutput($report->ai_raw_output),
            'latitude' => $report->latitude !== null ? (float) $report->latitude : null,
            'longitude' => $report->longitude !== null ? (float) $report->longitude : null,
            'image_original_url' => $primaryUrl,
            'image_result_url' => $report->image_result_url,
            'system_notes' => $report->system_notes,
            'sort_order' => 0,
            'kerusakan_panjang' => $report->kerusakan_panjang !== null ? (float) $report->kerusakan_panjang : null,
            'kerusakan_lebar' => $report->kerusakan_lebar !== null ? (float) $report->kerusakan_lebar : null,
            'created_at' => $report->created_at?->toIso8601String(),
        ]);

        return $photos;
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
