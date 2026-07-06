<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TelegramSession extends Model
{
    protected $table = 'telegram_sessions';

    protected $fillable = [
        'chat_id',
        'state',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];
}
