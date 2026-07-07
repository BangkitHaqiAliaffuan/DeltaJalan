<?php

$singleDet = 0;
$singleDetTwoClass = 0;
DB::table('report_photos')->whereNotNull('ai_raw_output')->where('ai_raw_output', '!=', '[]')->whereRaw("ai_raw_output::text != 'null'")->orderBy('id')->chunk(100, function ($photos) use (&$singleDet) {
    foreach ($photos as $p) {
        $raw = json_decode($p->ai_raw_output, true);
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        $d = $raw['detections'] ?? $raw;
        if (! is_array($d)) {
            continue;
        }
        if (count($d) === 1) {
            $singleDet++;
        }
    }
});
echo "Photos with exactly 1 detection: $singleDet\n";
