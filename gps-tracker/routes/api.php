<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DailyTargetController;
use App\Http\Controllers\Api\CheckInController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\VisitMonitoringController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VisitLogController;
use App\Http\Controllers\Api\VisitPhotoController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::middleware(['throttle:login', 'brute.force'])->group(function () {
        Route::post('auth/login', [AuthController::class, 'login']);
    });

    Route::middleware(['auth:sanctum', 'active', 'throttle:api'])->group(function () {
        Route::prefix('auth')->group(function () {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('logout', [AuthController::class, 'logout']);
            Route::post('logout-all', [AuthController::class, 'logoutAll']);
            Route::post('refresh', [AuthController::class, 'refresh']);
        });

        Route::middleware('role:sales|spv')->group(function () {
            Route::post('location/ping', [LocationController::class, 'ping'])
                ->middleware('throttle:location-ping');

            Route::post('visit/checkin', [CheckInController::class, 'checkIn'])
                ->middleware('throttle:checkin');
            Route::post('visit/start', [CheckInController::class, 'start'])
                ->middleware('throttle:checkin');
            Route::post('visit/checkout', [CheckInController::class, 'checkOut'])
                ->middleware('throttle:checkin');

            Route::post('visit/photos', [VisitPhotoController::class, 'upload'])
                ->middleware('throttle:photo-upload');

            Route::get('target/today', [DailyTargetController::class, 'today']);
        });

        Route::middleware('role:sales|spv|manager|admin')->group(function () {
            Route::get('stores/available', [StoreController::class, 'available']);
        });

        Route::middleware('role:sales|spv|admin')->group(function () {
            Route::get('stores', [StoreController::class, 'index']);
            Route::get('stores/filters', [StoreController::class, 'filters']);
            Route::get('stores/{store}', [StoreController::class, 'show']);

            Route::get('visits', [VisitLogController::class, 'index']);
            Route::get('visits/{visitLog}', [VisitLogController::class, 'show']);
            Route::patch('visits/{visitLog}', [VisitLogController::class, 'update']);
            Route::delete('visits/{visitLog}', [VisitLogController::class, 'destroy']);

            Route::get('visit/{visitLog}/photos', [VisitPhotoController::class, 'index']);
            Route::delete('visit/photos/{photo}', [VisitPhotoController::class, 'destroy']);
        });

        Route::middleware('role:spv|manager|admin')->group(function () {
            Route::get('location/live', [LocationController::class, 'liveSales']);
            Route::get('location/history/{user}', [LocationController::class, 'history']);
            Route::get('location/{user}', [LocationController::class, 'salesLocation']);

            Route::get('teams', [TeamController::class, 'index']);
            Route::get('teams/{team}', [TeamController::class, 'show']);

            Route::get('target/summary', [VisitMonitoringController::class, 'summary']);
            Route::get('target/detail/{user}', [VisitMonitoringController::class, 'detail']);
            Route::post('target/set', [DailyTargetController::class, 'set'])
                ->middleware('role:spv|admin');

            Route::get('reports/per-sales', [ReportController::class, 'perSales']);
            Route::get('reports/per-store', [ReportController::class, 'perStore']);

            Route::get('reports/export-visits', [ReportController::class, 'exportVisits'])
                ->middleware('throttle:export');
            Route::get('reports/export-sales-summary', [ReportController::class, 'exportSalesSummary'])
                ->middleware('throttle:export');
        });

        Route::middleware('role:admin')->group(function () {
            Route::post('target/bulk-set', [DailyTargetController::class, 'bulkSet']);

            Route::get('users', [UserController::class, 'index']);
            Route::get('users/{user}', [UserController::class, 'show']);
            Route::post('users', [UserController::class, 'store']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::patch('users/{user}/toggle-active', [UserController::class, 'toggleActive']);
            Route::delete('users/{user}', [UserController::class, 'destroy']);

            Route::post('teams', [TeamController::class, 'store']);
            Route::put('teams/{team}', [TeamController::class, 'update']);
            Route::patch('teams/{team}/toggle-active', [TeamController::class, 'toggleActive']);
            Route::delete('teams/{team}', [TeamController::class, 'destroy']);
        });
    });
});
