<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SanitizeInput
{
    // Field yang tidak perlu di-sanitize (password, koordinat, dll)
    private array $except = [
        'password',
        'password_confirmation',
        'latitude',
        'longitude',
    ];

    public function handle(Request $request, Closure $next)
    {
        $input = $request->except($this->except);
        $clean = $this->sanitize($input);
        $request->merge($clean);

        return $next($request);
    }

    private function sanitize(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->sanitize($value);
            } elseif (is_string($value)) {
                // Strip tags, trim whitespace
                $data[$key] = strip_tags(trim($value));
            }
        }

        return $data;
    }
}