<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeviceReset extends Command
{
    protected $signature = 'device:reset
        {--type= : Filter by type: device_id or fingerprint (default: both)}
        {--hash= : Reset specific hash only}
        {--force : Skip confirmation}';

    protected $description = 'Reset daily upload counters for device ID and/or fingerprint';

    public function handle(): int
    {
        $type = $this->option('type');
        $hash = $this->option('hash');
        $force = $this->option('force');

        $query = DB::table('daily_upload_counters');

        if ($type && in_array($type, ['device_id', 'fingerprint'])) {
            $query->where('identifier_type', $type);
        }

        if ($hash) {
            $query->where('identifier_hash', $hash);
        }

        $count = $query->count();

        if ($count === 0) {
            $this->info('Tidak ada data yang cocok untuk di-reset.');
            return self::SUCCESS;
        }

        $typeLabel = $type ?? 'semua tipe';
        $hashLabel = $hash ? " hash \"{$hash}\"" : '';
        $this->warn("Akan menghapus {$count} baris dari daily_upload_counters ({$typeLabel}{$hashLabel}).");

        if (! $force && ! $this->confirm('Lanjutkan?')) {
            $this->info('Dibatalkan.');
            return self::SUCCESS;
        }

        $query->delete();

        $this->info("Berhasil menghapus {$count} baris.");

        return self::SUCCESS;
    }
}
