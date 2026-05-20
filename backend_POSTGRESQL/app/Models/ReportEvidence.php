<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Model Eloquent untuk tabel 'report_evidences'.
 *
 * Merepresentasikan satu foto bukti tambahan yang dilampirkan ke laporan
 * yang sudah ada melalui fitur "Dukung Laporan".
 *
 * @property string      $id             UUID primary key
 * @property string      $report_id      UUID laporan yang didukung
 * @property string      $image_path     Path foto bukti di storage
 * @property string|null $image_hash     MD5 hash foto bukti
 * @property string      $reporter_name  Nama petugas yang mengirim bukti
 * @property string|null $notes          Catatan tambahan
 */
class ReportEvidence extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'report_evidences';

    protected $fillable = [
        'report_id',
        'image_path',
        'image_hash',
        'reporter_name',
        'notes',
    ];

    protected $casts = [];

    // ── Relationships ─────────────────────────────────────────────────────

    /**
     * Evidence ini milik satu laporan.
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    // ── Accessor ──────────────────────────────────────────────────────────

    /**
     * URL publik foto bukti.
     */
    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return asset('storage/' . $this->image_path);
    }
}
