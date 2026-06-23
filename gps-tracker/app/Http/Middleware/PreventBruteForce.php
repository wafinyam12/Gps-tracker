<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PreventBruteForce
{
    private int $maxAttempts = 5;
    private int $decayMinutes = 15;

    public function handle(Request $request, Closure $next)
    {
        $username = strtolower(trim((string) $request->input('username', '')));
        $key = 'login_attempts_'.$request->ip().'_'.md5($username !== '' ? $username : 'guest');

        $attempts = Cache::get($key, 0);

        if ($attempts >= $this->maxAttempts) {
            $remainingSeconds = Cache::getTimeToLive($key);

            return response()->error(
                'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.',
                429,
                ['retry_after_seconds' => $remainingSeconds]
            );
        }

        $response = $next($request);

        // Kalau login gagal (401/422), increment counter
        if (in_array($response->getStatusCode(), [401, 422])) {
            Cache::put($key, $attempts + 1, now()->addMinutes($this->decayMinutes));
        }

        // Kalau login sukses, reset counter
        if ($response->getStatusCode() === 200) {
            Cache::forget($key);
        }

        return $response;
    }
}
