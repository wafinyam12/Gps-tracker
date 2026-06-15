<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->user()?->is_active) {
            return response()->json([
                'message' => 'Akun tidak aktif.',
            ], 403);
        }

        return $next($request);
    }
}