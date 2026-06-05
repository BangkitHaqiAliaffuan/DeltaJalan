<?php

namespace App\Providers;

use App\Models\Report;
use App\Notifications\Channels\WebPushChannel;
use App\Observers\ReportObserver;
use App\Services\WebPushService;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(WebPushService::class);
    }

    public function boot(): void
    {
        Report::observe(ReportObserver::class);

        Notification::resolved(function (ChannelManager $manager) {
            $manager->extend('webpush', function ($app) {
                return new WebPushChannel($app->make(WebPushService::class));
            });
        });
    }
}
