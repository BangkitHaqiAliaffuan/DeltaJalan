<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SurveyTaskReport extends Model
{
    use HasUuids;

    protected $fillable = ['survey_task_id', 'inspection_session_id', 'report_id', 'team_id', 'status', 'assigned_at', 'started_at', 'submitted_at'];

    protected $casts = ['assigned_at' => 'datetime', 'started_at' => 'datetime', 'submitted_at' => 'datetime'];

    public function session()
    {
        return $this->belongsTo(InspectionSession::class, 'inspection_session_id');
    }

    public function report()
    {
        return $this->belongsTo(Report::class);
    }

    public function result()
    {
        // Hasil inspeksi terbaru untuk assignment ini.
        //
        // Sengaja TIDAK memakai `ofMany()`/`latestOfMany()`: keduanya membuat
        // agregat `max(id)` dan `id` di sini UUID, yang tidak didukung PostgreSQL
        // (SQLite tetap lolos sehingga bug-nya hanya muncul di produksi).
        //
        // `hasOne` + urutan menurun: eager load mengambil baris pertama per
        // foreign key (`HasOneOrMany::matchOne()`), lazy load memakai `first()`,
        // jadi keduanya konsisten mengembalikan hasil terbaru.
        return $this->hasOne(InspectionResult::class)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }
}
