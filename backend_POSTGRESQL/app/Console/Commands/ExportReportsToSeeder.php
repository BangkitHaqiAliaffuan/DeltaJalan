<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExportReportsToSeeder extends Command
{
    protected $signature = 'jalan-kita:export-reports';
    protected $description = 'Export all report data to database/seeders/ReportBackupSeeder.php with file backup';

    public function handle(): int
    {
        $this->info('📦 Exporting report data...');

        // ── 1. Query all data ────────────────────────────────────────────────
        $reports = DB::table('reports')->orderBy('created_at')->get()->toArray();
        $photos = DB::table('report_photos')->orderBy('sort_order')->get()->toArray();
        $statusLogs = DB::table('status_logs')->orderBy('created_at')->get()->toArray();
        $notifications = DB::table('notifications')
            ->where('data', 'like', '%"report_id":"%')
            ->orderBy('created_at')
            ->get()
            ->toArray();

        $this->info("   Found: " . count($reports) . " reports, " . count($photos) . " photos, " . count($statusLogs) . " status_logs, " . count($notifications) . " notifications");

        // ── 2. Collect file paths ────────────────────────────────────────────
        $paths = [];
        $extractPath = function ($record, ...$fields) use (&$paths) {
            foreach ($fields as $f) {
                if (!empty($record->$f)) $paths[] = $record->$f;
            }
        };
        foreach ($reports as $r) $extractPath($r, 'image_original_path', 'image_result_path', 'after_photo_path');
        foreach ($photos as $p) $extractPath($p, 'image_original_path', 'image_result_path');
        $paths = array_values(array_unique(array_filter($paths)));

        $this->info("   Unique file paths in DB: " . count($paths));

        // ── 3. Backup files ─────────────────────────────────────────────────
        $publicDisk = Storage::disk('public');
        $backupRoot = storage_path('backups/reports');
        $copied = 0;
        $failed = 0;

        $this->info('   Copying files to storage/backups/reports/...');
        $bar = $this->output->createProgressBar(count($paths));
        $bar->start();

        foreach ($paths as $path) {
            if ($publicDisk->exists($path)) {
                $destPath = $backupRoot . '/' . $path;
                $destDir = dirname($destPath);
                if (!is_dir($destDir)) {
                    mkdir($destDir, 0755, true);
                }
                copy($publicDisk->path($path), $destPath);
                $copied++;
            } else {
                $failed++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();

        // ── 4. Generate seeder file ─────────────────────────────────────────
        $this->info('   Generating ReportBackupSeeder.php...');

        $seeder = $this->buildSeeder($reports, $photos, $statusLogs, $notifications);

        $seederPath = database_path('seeders/ReportBackupSeeder.php');
        file_put_contents($seederPath, $seeder);

        // ── 5. Summary ──────────────────────────────────────────────────────
        $this->newLine();
        $this->info('✅ Export complete!');
        $this->info("   📄 Reports:       " . count($reports));
        $this->info("   🖼  Photos:        " . count($photos));
        $this->info("   📋 Status Logs:   " . count($statusLogs));
        $this->info("   🔔 Notifications:  " . count($notifications));
        $this->info("   💾 Files backed up: {$copied}");
        if ($failed) {
            $this->warn("   ⚠️  Files missing on disk: {$failed}");
        }
        $this->info("   ✅ Seeder: database/seeders/ReportBackupSeeder.php");

        return Command::SUCCESS;
    }

    private function buildSeeder(array $reports, array $photos, array $statusLogs, array $notifications): string
    {
        $reportsCode = $this->arrayToPHP($reports, 3);
        $photosCode = $this->arrayToPHP($photos, 3);
        $logsCode = $this->arrayToPHP($statusLogs, 3);
        $notifCode = $this->arrayToPHP($notifications, 3);

        $reportCount = count($reports);
        $photoCount = count($photos);
        $logCount = count($statusLogs);
        $notifCount = count($notifications);
        $now = now()->toDateTimeString();

        return '<?php' . "\n\n"
            . 'namespace Database\Seeders;' . "\n\n"
            . 'use Illuminate\Database\Seeder;' . "\n"
            . 'use Illuminate\Support\Facades\DB;' . "\n"
            . 'use Illuminate\Support\Facades\Storage;' . "\n\n"
            . '/**' . "\n"
            . ' * Auto-generated backup seeder — created ' . $now . ' by jalan-kita:export-reports.' . "\n"
            . ' *' . "\n"
            . ' * Contains ' . $reportCount . ' reports, ' . $photoCount . ' photos, ' . $logCount . ' status_logs, ' . $notifCount . ' notifications.' . "\n"
            . ' */' . "\n"
            . 'class ReportBackupSeeder extends Seeder' . "\n"
            . '{' . "\n"
            . '    public function run(): void' . "\n"
            . '    {' . "\n"
            . "        \$this->command?->info('Restoring backup files...');" . "\n"
            . '        $this->restoreFiles();' . "\n"
            . "\n"
            . "        \$this->command?->info('Inserting reports...');" . "\n"
            . '        DB::table(\'reports\')->insert(' . $reportsCode . ');' . "\n"
            . "\n"
            . "        \$this->command?->info('Inserting report_photos...');" . "\n"
            . '        DB::table(\'report_photos\')->insert(' . $photosCode . ');' . "\n"
            . "\n"
            . "        \$this->command?->info('Inserting status_logs...');" . "\n"
            . '        DB::table(\'status_logs\')->insert(' . $logsCode . ');' . "\n"
            . "\n"
            . "        \$this->command?->info('Inserting notifications...');" . "\n"
            . '        DB::table(\'notifications\')->insert(' . $notifCode . ');' . "\n"
            . "\n"
            . "        \$this->command?->info('Backup restored: {$reportCount} reports, {$photoCount} photos, {$logCount} status_logs, {$notifCount} notifications.');" . "\n"
            . '    }' . "\n"
            . "\n"
            . '    private function restoreFiles(): void' . "\n"
            . '    {' . "\n"
            . '        $backupRoot = storage_path(\'backups/reports\');' . "\n"
            . '        if (!is_dir($backupRoot)) {' . "\n"
            . "            \$this->command?->warn('   Backup directory not found: ' . \$backupRoot);" . "\n"
            . '            return;' . "\n"
            . '        }' . "\n"
            . "\n"
            . '        $publicDisk = Storage::disk(\'public\');' . "\n"
            . '        $iterator = new \RecursiveIteratorIterator(' . "\n"
            . '            new \RecursiveDirectoryIterator($backupRoot, \RecursiveDirectoryIterator::SKIP_DOTS)' . "\n"
            . '        );' . "\n"
            . "\n"
            . '        $count = 0;' . "\n"
            . '        foreach ($iterator as $file) {' . "\n"
            . '            if ($file->isFile()) {' . "\n"
            . '                $relativePath = ltrim(substr($file->getPathname(), strlen($backupRoot)), \'\\\\/\');' . "\n"
            . '                $publicDisk->put($relativePath, file_get_contents($file->getPathname()));' . "\n"
            . '                $count++;' . "\n"
            . '            }' . "\n"
            . '        }' . "\n"
            . "\n"
            . '        $this->command?->info("   Restored {$count} files to storage/app/public/");' . "\n"
            . '    }' . "\n"
            . '}' . "\n";
    }

    private function arrayToPHP(array $records, int $indent = 2): string
    {
        if (empty($records)) {
            return '[]';
        }

        $parts = [];
        foreach ($records as $record) {
            $parts[] = $this->recordToPHP((array) $record, $indent + 1);
        }

        $pad = str_repeat(' ', $indent);
        $inner = "[\n" . implode(",\n", $parts) . ",\n" . $pad . ']';

        return $inner;
    }

    private function recordToPHP(array $data, int $indent): string
    {
        $pad = str_repeat(' ', $indent);
        $innerPad = str_repeat(' ', $indent + 1);

        $lines = [];
        $lines[] = $pad . '[';

        foreach ($data as $key => $value) {
            $formatted = $this->valueToPHP($value);
            $lines[] = $innerPad . var_export((string) $key, true) . ' => ' . $formatted . ',';
        }

        $lines[] = $pad . ']';

        return implode("\n", $lines);
    }

    private function valueToPHP(mixed $value): string
    {
        if ($value === null) {
            return 'null';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_int($value) || is_float($value)) {
            return var_export($value, true);
        }

        if (is_string($value)) {
            return var_export($value, true);
        }

        if (is_array($value)) {
            $parts = [];
            foreach ($value as $k => $v) {
                $parts[] = var_export($k, true) . ' => ' . $this->valueToPHP($v);
            }
            return '[' . implode(', ', $parts) . ']';
        }

        return 'null';
    }
}
