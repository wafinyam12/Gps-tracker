<?php

use App\Jobs\SyncSapCustomerCatalog;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    User::query()
        ->with('team')
        ->where('is_active', true)
        ->whereNotNull('team_id')
        ->whereNotNull('slpCode')
        ->whereHas('roles', fn ($query) => $query->where('name', 'sales'))
        ->orderBy('id')
        ->chunkById(100, function ($users) {
            foreach ($users as $user) {
                if (! filled($user->sapDatabase()) || ! filled($user->sapSalesCode())) {
                    continue;
                }

                SyncSapCustomerCatalog::dispatch(
                    $user->id,
                    (int) $user->team_id,
                    (string) $user->sapSalesCode(),
                )->onQueue('sap-sync');
            }
        });
})->hourly()->name('sync-active-sap-customer-catalogs')->withoutOverlapping();
