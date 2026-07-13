<?php

use App\Http\Controllers\TelegramWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/telegram/webhook', [TelegramWebhookController::class, 'handle']);

Route::get('/', function () {
    return view('welcome');
});

if (app()->environment('local')) {
    Route::get('/storage/{path}', function (string $path) {
        $fullPath = storage_path('app/public/'.$path);

        if (! file_exists($fullPath)) {
            abort(404);
        }

        return response()->file($fullPath);
    })->where('path', '.*');
}
