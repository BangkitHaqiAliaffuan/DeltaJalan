<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyUploadCounter extends Model
{
    protected $table = 'daily_upload_counters';

    protected $fillable = [
        'identifier_type',
        'identifier_hash',
        'report_date',
        'count',
    ];

    protected $casts = [
        'report_date' => 'date',
        'count' => 'integer',
    ];
}
