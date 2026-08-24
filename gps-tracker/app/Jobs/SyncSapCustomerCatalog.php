<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\MasterData\StoreCatalogSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncSapCustomerCatalog implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $uniqueFor = 900;

    public function __construct(
        public readonly int $userId,
        public readonly int $teamId,
        public readonly string $slpCode,
    ) {
    }

    public function uniqueId(): string
    {
        return $this->teamId.'|'.$this->slpCode;
    }

    public function handle(StoreCatalogSyncService $catalog): void
    {
        $user = User::query()
            ->with('team')
            ->find($this->userId);

        // Do not sync a stale queue message after a user is moved to another
        // branch or receives a different SAP sales code.
        if (! $user
            || ! $user->is_active
            || (int) $user->team_id !== $this->teamId
            || (string) $user->sapSalesCode() !== $this->slpCode) {
            return;
        }

        $catalog->sync(false, $user, true);
    }
}
