<?php

namespace App\Providers;

use App\Models\Report;
use App\Notifications\Channels\FcmChannel;
use App\Notifications\Channels\WebPushChannel;
use App\Observers\ReportObserver;
use App\Services\FcmPushService;
use App\Services\WebPushService;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(WebPushService::class);
        $this->app->singleton(FcmPushService::class);
    }

    public function boot(): void
    {
        URL::useOrigin(config('app.url'));

        Report::observe(ReportObserver::class);

        Notification::resolved(function (ChannelManager $manager) {
            $manager->extend('webpush', function ($app) {
                return new WebPushChannel($app->make(WebPushService::class));
            });
            $manager->extend('fcm', function ($app) {
                return new FcmChannel($app->make(FcmPushService::class));
            });
        });
    }
}
