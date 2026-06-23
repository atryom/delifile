<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // 2FA poll вызывается каждые 2-3 сек во время ожидания — нужен отдельный лимит,
        // чтобы не блокироваться общим throttle:auth (10/мин).
        RateLimiter::for('2fa-poll', function (Request $request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
