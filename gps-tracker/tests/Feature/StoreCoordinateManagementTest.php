<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Services\Stores\StoreCoordinateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Tests\TestCase;

class StoreCoordinateManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_correction_records_evidence_and_only_seeds_open_visits_without_a_center(): void
    {
        $actor = User::factory()->create();
        $sales = User::factory()->create();
        $store = $this->store('COORD-A', new Point(-7.973920, 112.748402));
        $open = $this->visit($store, $sales);
        $alreadyReferenced = $this->visit($store, $sales, new Point(-7.974000, 112.748400));
        $finished = $this->visit($store, $sales);
        $finished->update(['checkout_at' => now()]);
        $photo = VisitPhoto::create([
            'visit_log_id' => $open->id,
            'path' => 'visits/photo.jpg',
            'type' => 'other',
            'location' => new Point(-7.973899, 112.748395),
            'taken_at' => now(),
        ]);

        $change = app(StoreCoordinateService::class)->setManual(
            $store, $actor, new Point(-7.973899, 112.748395), 30,
            'Diperiksa dari foto tampak depan toko.', $photo,
        );

        $store->refresh();
        $this->assertEqualsWithDelta(-7.973899, $store->location->latitude, 0.000001);
        $this->assertSame(30, (int) $store->geofence_radius);
        $this->assertSame('crm_manual', $store->coordinate_source);
        $this->assertSame($actor->id, $change->actor_user_id);
        $this->assertSame($photo->id, $change->photo_id);
        $this->assertSame('crm_manual', $change->source);
        $this->assertEqualsWithDelta(-7.973920, $change->old_latitude, 0.000001);
        $this->assertEqualsWithDelta(-7.973899, $change->new_latitude, 0.000001);
        $this->assertSame(50, (int) $change->old_radius);
        $this->assertSame(30, (int) $change->new_radius);
        $this->assertSame('crm_manual', $open->fresh()->geofence_reference_source);
        $this->assertEqualsWithDelta(-7.973899, $open->fresh()->geofence_center->latitude, 0.000001);
        $this->assertSame(30, (int) $open->fresh()->geofence_radius_meters);
        $this->assertEqualsWithDelta(-7.974000, $alreadyReferenced->fresh()->geofence_center->latitude, 0.000001);
        $this->assertNull($finished->fresh()->geofence_center);
    }

    public function test_manual_correction_rejects_a_photo_from_another_store(): void
    {
        $actor = User::factory()->create();
        $sales = User::factory()->create();
        $store = $this->store('COORD-B', null);
        $otherStore = $this->store('COORD-C', null);
        $photo = VisitPhoto::create([
            'visit_log_id' => $this->visit($otherStore, $sales)->id,
            'path' => 'visits/other.jpg',
            'type' => 'other',
            'location' => new Point(-7.9, 112.7),
        ]);

        $this->expectException(InvalidArgumentException::class);
        try {
            app(StoreCoordinateService::class)->setManual(
                $store, $actor, new Point(-7.9, 112.7), 50,
                'Foto tersebut milik toko yang berbeda.', $photo,
            );
        } finally {
            $this->assertNull($store->fresh()->location);
            $this->assertDatabaseCount('store_coordinate_changes', 0);
        }
    }

    private function store(string $code, ?Point $location): Store
    {
        return Store::create([
            'code' => $code,
            'name' => $code,
            'status' => 'active',
            'master_source' => 'sap_outstanding_receivable',
            'geofence_radius' => 50,
            'location' => $location,
        ]);
    }

    private function visit(Store $store, User $sales, ?Point $center = null): VisitLog
    {
        return VisitLog::create([
            'store_id' => $store->id,
            'user_id' => $sales->id,
            'checkin_at' => now()->subMinutes(10),
            'checkin_location' => new Point(-7.973920, 112.748402),
            'checkin_accuracy' => 34.1,
            'geofence_center' => $center,
            'geofence_radius_meters' => 50,
        ]);
    }
}
