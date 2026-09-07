<?php

namespace App\Console\Commands;

use App\Jobs\SyncSapCustomerCoordinate;
use App\Models\SapCoordinateSync;
use Illuminate\Console\Command;

class SyncSapCustomerCoordinatesCommand extends Command
{
    protected $signature = 'sap:sync-customer-coordinates {--limit=0 : Maximum queue messages to dispatch}';

    protected $description = 'Queue pending customer-coordinate changes for SAP staging synchronization.';

    public function handle(): int
    {
        $limit = max(0, (int) $this->option('limit'));
        $dispatched = 0;

        SapCoordinateSync::query()
            ->whereIn('status', [SapCoordinateSync::STATUS_PENDING, SapCoordinateSync::STATUS_RETRY])
            ->where(function ($query) {
                $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now());
            })
            ->orderBy('id')
            ->chunkById(100, function ($syncs) use (&$dispatched, $limit) {
                foreach ($syncs as $sync) {
                    if ($limit > 0 && $dispatched >= $limit) {
                        return false;
                    }

                    SyncSapCustomerCoordinate::dispatch($sync->id)->onQueue('sap-coordinate-sync');
                    $dispatched++;
                }

                return $limit === 0 || $dispatched < $limit;
            });

        $this->info("{$dispatched} BP coordinate sync job(s) queued.");

        return self::SUCCESS;
    }
}
