<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Response;
use App\Support\SpatialBlueprint;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        SpatialBlueprint::registerMacros();
        $this->configureRateLimiting();
        $this->configureResponseMacros();
    }

    private function configureRateLimiting(): void
    {
        // Login — ketat, prevent brute force
        RateLimiter::for('login', function (Request $request) {
            $username = strtolower(trim((string) $request->input('username', '')));

            return [
                Limit::perMinute(5)->by($request->ip()),
                Limit::perMinute(3)->by($username !== '' ? $username : $request->ip()),
            ];
        });

        // Location ping — longgar karena dipanggil tiap interval
        RateLimiter::for('location-ping', function (Request $request) {
            return Limit::perMinute(30)->by($request->user()?->id ?? $request->ip());
        });

        // Check-in/out — moderate
        RateLimiter::for('checkin', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?? $request->ip());
        });

        // Upload foto — limit per user
        RateLimiter::for('photo-upload', function (Request $request) {
            return Limit::perMinute(20)->by($request->user()?->id ?? $request->ip());
        });

        // Export — berat, limit ketat
        RateLimiter::for('export', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?? $request->ip());
        });

        // General API — default semua endpoint
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?? $request->ip());
        });
    }

    private function configureResponseMacros(): void
    {
        Response::macro('success', function ($data = null, string $message = 'OK', int $code = 200) {
            $response = [
                'success' => true,
                'message' => $message,
            ];

            if (! is_null($data)) {
                $response['data'] = $data;
            }

            return response()->json($response, $code);
        });

        Response::macro('error', function (string $message, int $code = 400, array $errors = []) {
            $response = [
                'success' => false,
                'message' => $message,
            ];

            if (! empty($errors)) {
                $response['errors'] = $errors;
            }

            return response()->json($response, $code);
        });
    }
}
