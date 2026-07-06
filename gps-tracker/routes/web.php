<?php

use App\Http\Controllers\Web\CrmAuthController;
use App\Http\Controllers\Web\CrmDashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('crm.dashboard');
    }

    return view('crm.login');
});

Route::get('/login', fn () => redirect()->route('crm.login'))->name('login');

Route::prefix('crm')->name('crm.')->group(function () {
    Route::get('login', [CrmAuthController::class, 'showLogin'])->name('login');
    Route::post('login', [CrmAuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('login.submit');

    Route::post('logout', [CrmAuthController::class, 'logout'])
        ->middleware('auth')
        ->name('logout');

    Route::middleware(['auth', 'role:manager|admin|superadmin'])->group(function () {
        Route::get('/', [CrmDashboardController::class, 'index'])->name('dashboard');
        Route::get('reports/visits/export', [CrmDashboardController::class, 'exportVisits'])
            ->middleware('throttle:export')
            ->name('export.visits');
        Route::get('reports/sales-summary/export', [CrmDashboardController::class, 'exportSalesSummary'])
            ->middleware('throttle:export')
            ->name('export.sales-summary');
    });
});
