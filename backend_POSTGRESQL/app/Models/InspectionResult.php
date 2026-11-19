<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class InspectionResult extends Model
{
    use HasUuids;

    protected $fillable = ['survey_task_report_id', 'report_id', 'inspector_id', 'result', 'condition', 'notes', 'kerusakan_panjang', 'kerusakan_lebar', 'kerusakan_kedalaman', 'jenis_perkerasan', 'kepadatan_lalu_lintas', 'latitude', 'longitude', 'idempotency_key', 'reviewed_by', 'review_notes', 'reviewed_at', 'request_fingerprint'];

    /**
     * Pilihan jenis perkerasan. Menentukan MATERIAL perbaikan.
     *
     * "Aspal" saja tidak cukup: banyak jalan daerah sudah beton atau
     * paving block, dan memaksa petugas memilih "Aspal" akan menghasilkan
     * data salah.
     */
    public const JENIS_PERKERASAN = ['aspal', 'beton', 'paving', 'kerikil_tanah'];

    /**
     * Pilihan kepadatan lalu lintas. Menentukan PRIORITAS penanganan.
     */
    public const KEPADATAN_LALU_LINTAS = ['sepi', 'sedang', 'padat'];

    /**
     * Pemetaan kepadatan lalu lintas → prioritas laporan.
     *
     * Dipakai saat supervisor `accept`: karakteristik lokasi yang diamati
     * petugas di lapangan menggantikan tebakan. Nilai harus salah satu dari
     * `Report::PRIORITY_VALUES`.
     */
    public const KEPADATAN_KE_PRIORITAS = [
        'sepi' => 'Rendah',
        'sedang' => 'Sedang',
        'padat' => 'Tinggi',
    ];

    /** Label yang bisa dibaca operator untuk tiap jenis perkerasan. */
    public const JENIS_PERKERASAN_LABEL = [
        'aspal' => 'Aspal',
        'beton' => 'Beton',
        'paving' => 'Paving Block',
        'kerikil_tanah' => 'Kerikil / Tanah',
    ];

    /** Label yang bisa dibaca operator untuk tiap tingkat kepadatan. */
    public const KEPADATAN_LABEL = [
        'sepi' => 'Sepi',
        'sedang' => 'Sedang',
        'padat' => 'Padat',
    ];

    protected $casts = ['latitude' => 'decimal:8', 'longitude' => 'decimal:8', 'kerusakan_panjang' => 'decimal:2', 'kerusakan_lebar' => 'decimal:2', 'kerusakan_kedalaman' => 'decimal:2', 'reviewed_at' => 'datetime'];

    public function assignment()
    {
        return $this->belongsTo(SurveyTaskReport::class, 'survey_task_report_id');
    }

    /** Petugas yang mengirim hasil pengukuran ini. */
    public function inspector()
    {
        return $this->belongsTo(User::class, 'inspector_id');
    }

    /** Supervisor yang memutuskan hasil ini (null selama belum direview). */
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function photos()
    {
        return $this->hasMany(InspectionPhoto::class);
    }

    public function report()
    {
        return $this->belongsTo(Report::class);
    }
}
