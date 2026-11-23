<?php

use App\Jobs\SyncSapCustomerCatalog;
use App\Console\Commands\SyncSapCustomerCoordinatesCommand;
use App\Models\User;
use App\Models\VisitLocationSample;
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
        ->whereHas('roles', fn ($query) => $query->whereIn('name', ['sales', 'spv']))
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
})->everyTenMinutes()->name('sync-active-sap-customer-catalogs')->withoutOverlapping();

Schedule::command(SyncSapCustomerCoordinatesCommand::class)
    ->dailyAt('16:00')
    ->timezone('Asia/Jakarta')
    ->name('sync-sap-customer-coordinates')
    ->withoutOverlapping();

Artisan::command('visits:prune-location-samples', function () {
    $cutoff = now()->subDays(30);
    VisitLocationSample::query()
        ->where('created_at', '<', $cutoff)
        ->chunkById(1000, function ($samples) {
            VisitLocationSample::query()->whereIn('id', $samples->pluck('id'))->delete();
        });
})->purpose('Delete raw visit GPS samples older than 30 days; keep visit summaries');

Schedule::command('visits:prune-location-samples')
    ->dailyAt('02:30')
    ->timezone('Asia/Jakarta')
    ->name('prune-raw-visit-location-samples')
    ->withoutOverlapping();
