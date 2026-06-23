<?php

namespace App\Services\MasterData;

use App\Models\Store;
use App\Models\User;
use App\Services\Sap\OutstandingReceivableService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

class StoreCatalogSyncService
{
    private const CACHE_PREFIX = 'store-catalog:v2';

    public function __construct(
        private readonly LocalSapBusinessPartnerProvider $fallbackProvider,
        private readonly OutstandingReceivableService $outstandingReceivableService,
    ) {
    }

    public function sync(bool $onlyActive = false, ?User $user = null, bool $force = false): Collection
    {
        $this->ensureCatalog($onlyActive, $user, $force);

        return $this->queryStores($this->resolveSourceKey($user), $onlyActive);
    }

    public function activeStores(?User $user = null): Collection
    {
        return $this->sync(true, $user);
    }

    public function allStores(?User $user = null): Collection
    {
        return $this->sync(false, $user);
    }

    public function findByExternalCode(string $externalCode, ?User $user = null): ?Store
    {
        $normalizedCode = $this->normalizeExternalCode($externalCode);
        if (! $normalizedCode) {
            return null;
        }

        $source = $this->resolveSourceKey($user);
        $this->ensureCatalog(false, $user);

        return Store::query()
            ->select($this->storeColumns())
            ->where('master_source', $source)
            ->where('external_bp_code', $normalizedCode)
            ->first();
    }

    public function warm(?User $user = null, bool $onlyActive = false): void
    {
        if (! $this->hasSapCredentials($user)) {
            return;
        }

        $this->sync($onlyActive, $user, true);
    }

    public function ensureCatalog(bool $onlyActive = false, ?User $user = null, bool $force = false): void
    {
        $identity = $this->resolveCatalogIdentity($user);
        $source = $this->resolveSourceKey($user);

        if (! $force && $this->hasFreshCatalog($identity) && $this->hasCatalogRows($source)) {
            return;
        }

        if (! $force && $this->hasCatalogRows($source)) {
            $this->scheduleWarmup($user, $onlyActive);

            return;
        }

        $this->refreshCatalog($user, $onlyActive);
    }

    private function scheduleWarmup(?User $user, bool $onlyActive): void
    {
        if (! $this->hasSapCredentials($user)) {
            return;
        }

        $identity = $this->resolveCatalogIdentity($user);
        if ($this->hasPendingWarmup($identity)) {
            return;
        }

        $pendingSeconds = max(10, (int) config('sap.store_catalog_warmup_seconds', 30));
        Cache::put($this->warmupPendingKey($identity), true, now()->addSeconds($pendingSeconds));

        app()->terminating(function () use ($user, $onlyActive, $identity) {
            try {
                $this->sync($onlyActive, $user, true);
            } catch (Throwable $throwable) {
                Log::warning('Failed to warm SAP store catalog', [
                    'user_id' => $user?->id,
                    'db_sap' => $user?->db_sap,
                    'slp_code' => $user?->slpCode,
                    'error' => $throwable->getMessage(),
                ]);
            } finally {
                $this->clearWarmupPending($identity);
            }
        });
    }

    public function normalizeExternalCode(?string $value): ?string
    {
        if (! filled($value)) {
            return null;
        }

        $value = trim($value);

        return $value !== '' ? strtoupper($value) : null;
    }

    private function resolveSourceData(?User $user): array
    {
        if ($this->hasSapCredentials($user)) {
            try {
                $partners = $this->outstandingReceivableService->customers($user)
                    ->map(fn (array $customer) => $this->mapSapCustomerToStorePartner($customer))
                    ->filter(fn (array $partner) => filled($partner['external_bp_code'] ?? null))
                    ->unique('external_bp_code')
                    ->values();

                return [
                    'source' => 'sap_outstanding_receivable',
                    'partners' => $partners,
                    'should_reconcile' => true,
                ];
            } catch (Throwable $throwable) {
                Log::warning('Failed to sync SAP store catalog', [
                    'user_id' => $user?->id,
                    'db_sap' => $user?->db_sap,
                    'slp_code' => $user?->slpCode,
                    'error' => $throwable->getMessage(),
                ]);

                return [
                    'source' => 'sap_outstanding_receivable',
                    'partners' => collect(),
                    'should_reconcile' => false,
                ];
            }
        }

        return [
            'source' => 'sap_dummy',
            'partners' => $this->fallbackProvider->all(),
            'should_reconcile' => true,
        ];
    }

    private function refreshCatalog(?User $user, bool $onlyActive): Collection
    {
        $now = now('Asia/Jakarta');
        $identity = $this->resolveCatalogIdentity($user);
        $resolved = $this->resolveSourceData($user);
        $source = $resolved['source'];
        $partners = $resolved['partners'];
        $shouldReconcile = $resolved['should_reconcile'];

        if ($shouldReconcile) {
            $syncedCodes = [];

            $partners->each(function (array $partner) use (&$syncedCodes, $now, $source) {
                $store = $this->upsertPartner($partner, $now, $source);

                if ($store) {
                    $syncedCodes[] = $store->external_bp_code;
                }
            });

            $this->deactivateMissingStores($source, $syncedCodes, $now);
        }

        $this->markCatalogFresh($identity);
        $this->clearWarmupPending($identity);

        return $this->queryStores($source, $onlyActive);
    }

    private function queryStores(string $source, bool $onlyActive): Collection
    {
        return Store::query()
            ->select($this->storeColumns())
            ->where('master_source', $source)
            ->when($onlyActive, fn ($q) => $q->where('status', 'active'))
            ->orderBy('name')
            ->get();
    }

    private function resolveSourceKey(?User $user): string
    {
        return $this->hasSapCredentials($user)
            ? 'sap_outstanding_receivable'
            : 'sap_dummy';
    }

    private function resolveCatalogIdentity(?User $user): string
    {
        if ($this->hasSapCredentials($user)) {
            return 'sap_outstanding_receivable:'.sha1(trim((string) $user?->db_sap).'|'.trim((string) $user?->slpCode));
        }

        return 'sap_dummy';
    }

    private function hasSapCredentials(?User $user): bool
    {
        return filled($user?->db_sap) && filled($user?->slpCode);
    }

    private function hasCatalogRows(string $source): bool
    {
        return Store::query()
            ->where('master_source', $source)
            ->exists();
    }

    private function hasFreshCatalog(string $identity): bool
    {
        return Cache::has($this->freshCatalogKey($identity));
    }

    private function hasPendingWarmup(string $identity): bool
    {
        return Cache::has($this->warmupPendingKey($identity));
    }

    private function markCatalogFresh(string $identity): void
    {
        $ttl = max(1, (int) config('sap.store_catalog_refresh_minutes', 15));
        Cache::put($this->freshCatalogKey($identity), now('Asia/Jakarta')->toISOString(), now()->addMinutes($ttl));
    }

    private function mapSapCustomerToStorePartner(array $customer): array
    {
        $externalCode = $this->normalizeExternalCode($customer['card_code'] ?? null);
        $name = trim((string) ($customer['card_name'] ?? ''));
        $address = trim((string) ($customer['address'] ?? ''));

        return [
            'external_bp_code' => $externalCode,
            'code' => $externalCode,
            'name' => $name !== '' ? $name : $externalCode,
            'address' => $address !== '' ? $address : null,
            'area' => null,
            'branch' => null,
            'city' => null,
            'status' => 'active',
            'geofence_radius' => 100,
            'pic_name' => null,
            'pic_phone' => null,
            'is_priority' => false,
            'tags' => ['sap_business_partner', 'sap_outstanding_receivable'],
            'master_source' => 'sap_outstanding_receivable',
            'master_payload' => $this->buildCompactMasterPayload($customer),
        ];
    }

    private function upsertPartner(array $partner, $now, string $source): ?Store
    {
        $externalCode = $this->normalizeExternalCode($partner['external_bp_code'] ?? $partner['code'] ?? null);
        if (! $externalCode) {
            return null;
        }

        $existing = Store::withTrashed()
            ->where('external_bp_code', $externalCode)
            ->first();

        $payload = [
            'code'             => $partner['code'] ?? $externalCode,
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
                [$source]
            )))),
            'master_source'    => $source,
            'master_payload'   => $partner['master_payload'] ?? $partner,
            'last_synced_at'   => $now,
        ];

        if ($existing?->location) {
            $payload['location'] = $existing->location;
        }

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            if ($this->sameCatalogPayload($existing, $payload)) {
                return $existing->fresh();
            }

            $existing->fill($payload)->save();

            return $existing->fresh();
        }

        return Store::create($payload);
    }

    private function deactivateMissingStores(string $source, array $syncedCodes, $now): void
    {
        $query = Store::query()
            ->where('master_source', $source);

        if (! empty($syncedCodes)) {
            $query->whereNotIn('external_bp_code', $syncedCodes);
        }

        $query->update([
            'status' => 'inactive',
            'last_synced_at' => $now,
        ]);
    }

    private function buildCompactMasterPayload(array $customer): array
    {
        return [
            'source' => 'sap_outstanding_receivable',
            'card_code' => $customer['card_code'] ?? $customer['customer_code'] ?? null,
            'card_name' => $customer['card_name'] ?? $customer['customer_name'] ?? null,
            'address' => $customer['address'] ?? $customer['customer_address'] ?? null,
            'payment_terms' => $customer['payment_terms'] ?? null,
            'invoice_count' => (int) ($customer['invoice_count'] ?? $customer['total_document_outstanding'] ?? 0),
            'current_balance' => (float) ($customer['current_balance'] ?? $customer['total_balance'] ?? 0),
        ];
    }

    private function sameCatalogPayload(Store $existing, array $payload): bool
    {
        $existingPayload = $existing->master_payload ?? [];

        return $existing->code === $payload['code']
            && $existing->external_bp_code === $payload['external_bp_code']
            && $existing->name === $payload['name']
            && $existing->address === $payload['address']
            && $existing->area === $payload['area']
            && $existing->branch === $payload['branch']
            && $existing->city === $payload['city']
            && (int) $existing->geofence_radius === (int) $payload['geofence_radius']
            && (bool) $existing->is_priority === (bool) $payload['is_priority']
            && ($existing->status === $payload['status'])
            && ($existingPayload['source'] ?? null) === ($payload['master_payload']['source'] ?? null)
            && ($existingPayload['card_code'] ?? null) === ($payload['master_payload']['card_code'] ?? null)
            && ($existingPayload['card_name'] ?? null) === ($payload['master_payload']['card_name'] ?? null)
            && ($existingPayload['address'] ?? null) === ($payload['master_payload']['address'] ?? null)
            && ($existingPayload['payment_terms'] ?? null) === ($payload['master_payload']['payment_terms'] ?? null)
            && (float) ($existingPayload['current_balance'] ?? 0) === (float) ($payload['master_payload']['current_balance'] ?? 0)
            && (int) ($existingPayload['invoice_count'] ?? 0) === (int) ($payload['master_payload']['invoice_count'] ?? 0);
    }

    private function storeColumns(): array
    {
        return [
            'id',
            'code',
            'external_bp_code',
            'name',
            'address',
            'area',
            'branch',
            'city',
            'location',
            'geofence_radius',
            'pic_name',
            'pic_phone',
            'status',
            'is_priority',
            'tags',
            'master_source',
            'last_synced_at',
            'created_at',
            'updated_at',
            'deleted_at',
        ];
    }

    private function freshCatalogKey(string $identity): string
    {
        return self::CACHE_PREFIX.':fresh:'.$identity;
    }

    private function warmupPendingKey(string $identity): string
    {
        return self::CACHE_PREFIX.':pending:'.$identity;
    }

    private function clearWarmupPending(string $identity): void
    {
        Cache::forget($this->warmupPendingKey($identity));
    }
}
