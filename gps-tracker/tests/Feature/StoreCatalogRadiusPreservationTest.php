<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Services\MasterData\StoreCatalogSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use MatanYadaev\EloquentSpatial\Objects\Point;
use ReflectionMethod;
use Tests\TestCase;

class StoreCatalogRadiusPreservationTest extends TestCase
{
    use RefreshDatabase;

    public function test_sap_refresh_preserves_locally_calibrated_radius_and_point(): void
    {
        $store = Store::create([
            'code' => 'RADIUS-01', 'external_bp_code' => 'RADIUS-01',
            'name' => 'Before', 'status' => 'active',
            'master_source' => 'sap_outstanding_receivable',
            'geofence_radius' => 30, 'location' => new Point(-6.2, 106.8),
        ]);

        $upsert = new ReflectionMethod(StoreCatalogSyncService::class, 'upsertPartner');
        $upsert->invoke(app(StoreCatalogSyncService::class), [
            'code' => 'RADIUS-01', 'external_bp_code' => 'RADIUS-01',
            'name' => 'After', 'status' => 'active', 'geofence_radius' => 50,
        ], now(), 'sap_outstanding_receivable', null, null);

        $store->refresh();
        $this->assertSame('After', $store->name);
        $this->assertSame(30, (int) $store->geofence_radius);
        $this->assertEqualsWithDelta(-6.2, $store->location->latitude, 0.000001);
    }
}
