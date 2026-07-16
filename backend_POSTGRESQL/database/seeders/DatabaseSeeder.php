<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            TeamSeeder::class,
            UptdSeeder::class,
            LinkTeamsToUptdSeeder::class,
            SupervisorUptdSeeder::class,
            TeamRoadSeeder::class,
            ReportSeeder::class,
        ]);
    }

    /**
     * Restore production backup (di-jalankan manual via --class).
     *
     *     php artisan db:seed --class=DatabaseSeeder -- --backup
     */
    public function restoreBackup(): void
    {
        $this->call([
            UserSeeder::class,
            ReportBackupSeeder::class,
        ]);
    }
}
