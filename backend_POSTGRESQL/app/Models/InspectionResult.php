<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class InspectionResult extends Model
{
    use HasUuids;

    protected $fillable = ['survey_task_report_id', 'report_id', 'inspector_id', 'result', 'condition', 'notes', 'kerusakan_panjang', 'kerusakan_lebar', 'kerusakan_kedalaman', 'latitude', 'longitude', 'idempotency_key', 'reviewed_by', 'review_notes', 'reviewed_at', 'request_fingerprint'];

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
