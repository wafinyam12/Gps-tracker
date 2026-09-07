<?php

namespace Tests\Feature;

use App\Jobs\SyncSapCustomerCoordinate;
use App\Models\CustomerCoordinateObservation;
use App\Models\SapCoordinateSync;
use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use App\Services\Sap\BpCoordinateService;
use App\Services\Sap\CustomerCoordinateSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Tests\TestCase;

class SapCoordinateSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_completed_qualified_visit_creates_observation_and_initial_sync(): void
    {
        [$team, $user, $store] = $this->makeCustomer();
        $visit = VisitLog::create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'visit_date' => now('Asia/Jakarta')->toDateString(),
            'checkin_at' => now('Asia/Jakarta'),
            'checkin_location' => new Point(latitude: -7.2726588, longitude: 112.7421401),
            'checkin_accuracy' => 12,
            'checkin_valid' => true,
            'is_mock_location' => false,
            'is_duplicate' => false,
            'counted_as_target' => true,
            'checkout_at' => now('Asia/Jakarta'),
        ]);

        app(CustomerCoordinateSyncService::class)->recordCompletedVisit(
            $visit,
            $store,
            $visit->checkin_location,
        );

        $this->assertDatabaseHas('customer_coordinate_observations', [
            'visit_log_id' => $visit->id,
            'store_id' => $store->id,
            'is_eligible' => true,
        ]);
        $this->assertDatabaseHas('sap_coordinate_syncs', [
            'team_id' => $team->id,
            'store_id' => $store->id,
            'db_sap' => 'SIMULASI_UDMW',
            'cardcode' => 'C000002',
            'status' => SapCoordinateSync::STATUS_PENDING,
        ]);
    }

    public function test_missing_bp_is_created_without_listing_all_sap_customers(): void
    {
        [, $user, $store] = $this->makeCustomer();
        $visit = VisitLog::create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'visit_date' => now('Asia/Jakarta')->toDateString(),
            'checkin_at' => now('Asia/Jakarta'),
            'checkin_location' => new Point(latitude: -7.2726588, longitude: 112.7421401),
            'checkin_accuracy' => 10,
            'checkin_valid' => true,
            'is_mock_location' => false,
            'is_duplicate' => false,
            'counted_as_target' => true,
            'checkout_at' => now('Asia/Jakarta'),
        ]);
        app(CustomerCoordinateSyncService::class)->recordCompletedVisit($visit, $store, $visit->checkin_location);
        $sync = SapCoordinateSync::firstOrFail();

        config([
            'sap.bp_coordinate_base_url' => 'https://sap.test/bp-coordinate',
            'sap.bp_coordinate_get_url_template' => '{base}/{db}/{cardcode}',
        ]);
        Http::fake(function (HttpRequest $request) {
            if ($request->method() === 'GET') {
                return Http::response(['message' => 'Not found'], 404);
            }

            return Http::response(['status' => 'success', 'data' => ['queued' => true]], 201);
        });

        (new SyncSapCustomerCoordinate($sync->id))->handle(
            app(BpCoordinateService::class),
            app(CustomerCoordinateSyncService::class),
        );

        $this->assertSame(SapCoordinateSync::STATUS_SYNCED, $sync->fresh()->status);
        $this->assertSame('post', $sync->fresh()->sync_method);
        Http::assertSent(function (HttpRequest $request) {
            return $request->method() === 'GET'
                && $request->url() === 'https://sap.test/bp-coordinate/SIMULASI_UDMW/C000002';
        });
        Http::assertSent(function (HttpRequest $request) {
            return $request->method() === 'POST'
                && $request->url() === 'https://sap.test/bp-coordinate'
                && $request['db'] === 'SIMULASI_UDMW'
                && $request['cardcode'] === 'C000002';
        });
    }

    private function makeCustomer(): array
    {
        $team = Team::create([
            'name' => 'Surabaya',
            'code' => 'SBY',
            'db_sap' => 'SIMULASI_UDMW',
            'is_active' => true,
        ]);
        $user = User::factory()->create(['team_id' => $team->id, 'is_active' => true]);
        $store = Store::create([
            'team_id' => $team->id,
            'code' => 'C000002',
            'external_bp_code' => 'C000002',
            'name' => 'Customer Test',
            'location' => new Point(latitude: -7.2726588, longitude: 112.7421401),
            'status' => 'active',
            'master_source' => 'sap_outstanding_receivable',
        ]);

        return [$team, $user, $store];
    }
}
