<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class ApiRequestLog
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = (string) $request->header('X-Request-ID', '');
        if (! preg_match('/^[A-Za-z0-9._-]{1,64}$/', $requestId)) {
            $requestId = (string) Str::uuid();
        }

        $request->attributes->set('request_id', $requestId);
        $startedAt = hrtime(true);
        try {
            Log::withContext(['request_id' => $requestId]);
        } catch (Throwable) {
            // Correlation context is best effort and must not block the request.
        }

        try {
            $response = $next($request);
            $response->headers->set('X-Request-ID', $requestId);

            try {
                $route = $request->route();
                $actor = $request->user();
                $status = $response->getStatusCode();
                $body = $response instanceof JsonResponse ? $response->getData(true) : [];
                $validationErrors = is_array($body) && is_array($body['errors'] ?? null)
                    ? array_keys($body['errors'])
                    : [];
                $validationErrors = collect($validationErrors)
                    ->filter(fn ($name) => is_string($name) && preg_match('/^[A-Za-z0-9_.\[\]-]{1,80}$/', $name))
                    ->unique()
                    ->take(50)
                    ->values()
                    ->all();

                $bodyInput = $request->isJson()
                    ? $request->json()->all()
                    : $request->request->all();
                $fieldNames = array_merge(array_keys($bodyInput), array_keys($request->allFiles()));
                $safeFieldNames = collect($fieldNames)
                    ->filter(fn ($name) => is_string($name) && preg_match('/^[A-Za-z0-9_.\[\]-]{1,80}$/', $name))
                    ->unique()
                    ->take(50)
                    ->values()
                    ->all();

                $context = [
                    'request_id' => $requestId,
                    'method' => $request->method(),
                    'route' => $route?->uri() ?? $request->path(),
                    'action' => $route?->getActionName(),
                    'user_id' => $actor?->getAuthIdentifier(),
                    'role' => $actor?->getRoleNames()->first(),
                    'status' => $status,
                    'duration_ms' => round((hrtime(true) - $startedAt) / 1_000_000, 2),
                    'field_names' => $safeFieldNames,
                    'validation_fields' => $validationErrors,
                ];

                $level = $status >= 500 ? 'error' : ($status >= 400 ? 'warning' : 'info');
                Log::log($level, 'api.request.completed', $context);
            } catch (Throwable) {
                // Logging and metadata failures must not change a completed API response.
            }

            return $response;
        } finally {
            try {
                Log::withoutContext();
            } catch (Throwable) {
                // Context cleanup is best effort.
            }
        }
    }
}
