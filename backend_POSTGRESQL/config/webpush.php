<?php

return [
    'vapid' => [
        'subject'    => env('VAPID_SUBJECT', 'mailto:admin@dispu.binamarga.go.id'),
        'publicKey'  => env('VAPID_PUBLIC_KEY'),
        'privateKey' => env('VAPID_PRIVATE_KEY'),
    ],
];
