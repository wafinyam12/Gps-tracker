<?php

namespace App\Services\MasterData;

use App\Models\Store;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class StoreCatalogSyncService
{
    public function __construct(
        private readonly LocalSapBusinessPartnerProvider $provider,
    ) {
    }

    public function sync(bool $onlyActive = false): Collection
    {
        $now = now('Asia/Jakarta');

        $partners = $onlyActive
            ? $this->provider->active()
            : $this->provider->all();

        return $partners->map(function (array $partner) use ($now) {
            $externalCode = (string) $partner['external_bp_code'];
            $existing = Store::withTrashed()
                ->where('external_bp_code', $externalCode)
                ->first();

            $payload = [
                'code'             => $externalCode,
                'external_bp_code' => $externalCode,
                'name'             => $partner['name'] ?? $externalCode,
                'address'          => $partner['address'] ?? null,
                'area'             => $partner['area'] ?? null,
                'branch'           => $partner['branch'] ?? $partner['area'] ?? $partner['city'] ?? null,
                'city'             => $partner['city'] ?? null,
                'geofence_radius'  => (int) ($partner['geofence_radius'] ?? 100),
                'pic_name'         => $partner['pic_name'] ?? null,
                'pic_phone'        => $partner['pic_phone'] ?? null,
                'status'           => $partner['status'] ?? 'active',
                'is_priority'      => (bool) ($partner['is_priority'] ?? false),
                'tags'             => array_values(array_unique(array_filter(array_merge(
                    $partner['tags'] ?? [],
                    ['sap_business_partner', 'local_dummy']
                )))),
                'master_source'    => 'sap_dummy',
                'master_payload'   => $partner,
                'last_synced_at'   => $now,
            ];

            if ($existing?->location) {
                $payload['location'] = $existing->location;
            }

            if ($existing) {
                if ($existing->trashed()) {
                    $existing->restore();
                }

                $existing->fill($payload)->save();

                return $existing->fresh();
            }

            return Store::create($payload);
        });
    }

    public function activeStores(): Collection
    {
        $this->sync(false);

        return Store::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get();
    }

    public function allStores(): Collection
    {
        $this->sync(false);

        return Store::query()
            ->orderBy('name')
            ->get();
    }

    public function findByExternalCode(string $externalCode): ?Store
    {
        $this->sync(false);

        return Store::query()
            ->where('external_bp_code', $externalCode)
            ->first();
    }

    public function normalizeExternalCode(?string $value): ?string
    {
        if (! filled($value)) {
            return null;
        }

        $value = trim($value);

        return Str::upper($value);
    }
}
