<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
$app->instance('request', request());

// Check the cache via Laravel's cache facade
$cachedGlobal = Cache::get('map_global_stats');
$cachedDistricts = Cache::get('map_districts');
echo 'global_stats from Cache::get: ' . ($cachedGlobal ? 'found (' . get_class($cachedGlobal) . ')' : 'NOT FOUND') . PHP_EOL;
echo 'districts from Cache::get: ' . ($cachedDistricts ? 'found (' . get_class($cachedDistricts) . ')' : 'NOT FOUND') . PHP_EOL;

// Also check DB directly
$rows = DB::table('cache')->select('key', 'expiration')->where('key', 'like', 'map_%')->get();
echo 'DB cache rows: ' . $rows->count() . PHP_EOL;
foreach ($rows as $row) {
    echo '  key: ' . $row->key . ', expires: ' . $row->expiration . PHP_EOL;
}
