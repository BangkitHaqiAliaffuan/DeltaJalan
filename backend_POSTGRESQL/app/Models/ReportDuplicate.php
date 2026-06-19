<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportDuplicate extends Model
{
    protected $fillable = [
        'report_id',
        'duplicate_of_id',
        'score',
        'match_type',
    ];

    public function report()
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    public function originalReport()
    {
        return $this->belongsTo(Report::class, 'duplicate_of_id');
    }
}
