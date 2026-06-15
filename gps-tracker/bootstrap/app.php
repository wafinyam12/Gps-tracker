<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();

        // Global middleware — jalan di semua request
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
        $middleware->append(\App\Http\Middleware\SanitizeInput::class);

        // Alias
        $middleware->alias([
            'active'             => \App\Http\Middleware\EnsureUserIsActive::class,
            'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'brute.force'        => \App\Http\Middleware\PreventBruteForce::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {

        // Model not found — 404 yang clean
        $exceptions->render(function (
            \Illuminate\Database\Eloquent\ModelNotFoundException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Data tidak ditemukan.',
                ], 404);
            }
        });

        // Unauthorized
        $exceptions->render(function (
            \Illuminate\Auth\AuthenticationException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Unauthenticated. Silakan login terlebih dahulu.',
                ], 401);
            }
        });

        // Forbidden
        $exceptions->render(function (
            \Spatie\Permission\Exceptions\UnauthorizedException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Akses ditolak. Anda tidak memiliki izin.',
                ], 403);
            }
        });

        // Validation error — format konsisten
        $exceptions->render(function (
            \Illuminate\Validation\ValidationException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Data yang dikirim tidak valid.',
                    'errors'  => $e->errors(),
                ], 422);
            }
        });

        // Rate limit
        $exceptions->render(function (
            \Illuminate\Http\Exceptions\ThrottleRequestsException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message'     => 'Terlalu banyak request. Coba lagi sebentar.',
                    'retry_after' => $e->getHeaders()['Retry-After'] ?? null,
                ], 429);
            }
        });

        // Route not found
        $exceptions->render(function (
            \Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e,
            \Illuminate\Http\Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Endpoint tidak ditemukan.',
                ], 404);
            }
        });
    })->create();
