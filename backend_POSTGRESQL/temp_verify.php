<?php

$mixed = 0;
$single = 0;
$classCounts = [];
DB::table('report_photos')->whereNotNull('ai_raw_output')->where('ai_raw_output', '!=', '[]')->whereRaw("ai_raw_output::text != 'null'")->orderBy('id')->chunk(100, function ($photos) use (&$mixed, &$single, &$classCounts) {
    foreach ($photos as $p) {
        $raw = json_decode($p->ai_raw_output, true);
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        $d = $raw['detections'] ?? $raw;
        if (! is_array($d)) {
            continue;
        }
        $classes = array_unique(array_map(function ($det) {
            return $det['class'] ?? 'unknown';
        }, $d));
        if (count($classes) > 1) {
            $mixed++;
        } else {
            $single++;
        }
        foreach ($d as $det) {
            @$classCounts[$det['class'] ?? 'unknown'] += 1;
        }
    }
});
echo "Photos with mixed classes: $mixed\n";
echo "Photos with single class: $single\n";
echo "Class distribution:\n";
print_r($classCounts);

echo "\nSample first 3 photos:\n";
$samples = DB::table('report_photos')->whereNotNull('ai_raw_output')->orderBy('id')->limit(3)->get();
foreach ($samples as $s) {
    $raw = json_decode($s->ai_raw_output, true);
    if (is_string($raw)) {
        $raw = json_decode($raw, true);
    }
    $d = $raw['detections'] ?? [];
    echo "Photo {$s->id}: ";
    foreach ($d as $det) {
        echo "[{$det['class']}/{$det['severity']}] ";
    }
    echo "\n";
}
