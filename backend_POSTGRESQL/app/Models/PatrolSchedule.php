<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatrolSchedule extends Model
{
    use HasUuids;

    protected $table = 'patrol_schedules';

    private const DAY_MAP = [
        'Minggu' => 0, 'Senin' => 1, 'Selasa' => 2, 'Rabu' => 3,
        'Kamis' => 4, 'Jumat' => 5, 'Sabtu' => 6,
    ];

    protected $fillable = [
        'team_id',
        'hari',
        'kecamatan_list',
        'frekuensi',
        'start_date',
        'end_date',
        'alasan_tugas',
        'status',
        'jam_mulai',
        'jam_selesai',
        'created_by',
    ];

    protected $casts = [
        'hari' => 'array',
        'kecamatan_list' => 'array',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'team_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPatrolDay(Carbon $date): bool
    {
        $dayOfWeek = (int) $date->format('w');

        $match = false;
        foreach ($this->hari ?? [] as $hari) {
            if ((self::DAY_MAP[$hari] ?? -1) === $dayOfWeek) {
                $match = true;
                break;
            }
        }

        if (! $match) {
            return false;
        }

        return match ($this->frekuensi) {
            'dua_mingguan' => $this->weekIndexSinceStart($date) % 2 === 0,
            'bulanan' => $this->isFirstWeekdayInMonth($date),
            default => true,
        };
    }

    private function weekIndexSinceStart(Carbon $date): int
    {
        $startWeekStart = Carbon::parse($this->start_date)->startOfWeek();

        return (int) $startWeekStart->diffInWeeks($date->copy()->startOfWeek());
    }

    private function isFirstWeekdayInMonth(Carbon $date): bool
    {
        $dayOfWeek = (int) $date->format('w');
        $firstOfMonth = $date->copy()->startOfMonth();
        $diff = ($dayOfWeek - (int) $firstOfMonth->format('w') + 7) % 7;
        $firstOccurrence = $firstOfMonth->addDays($diff);

        return $firstOccurrence->format('Y-m-d') === $date->format('Y-m-d');
    }
}
