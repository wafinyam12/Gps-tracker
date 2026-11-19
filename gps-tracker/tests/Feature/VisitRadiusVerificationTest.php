<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\User;
use App\Models\VisitLog;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VisitRadiusVerificationTest extends TestCase
{
    use RefreshDatabase;

    private function sales(): User
    {
        foreach (['web', 'sanctum'] as $guard) {
            Role::firstOrCreate(['name' => 'sales', 'guard_name' => $guard]);
        }

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');

        return $user;
    }

    private function store(): Store
    {
        return Store::create([
            'code' => 'PILOT-RADIUS-01',
            'external_bp_code' => 'PILOT-RADIUS-01',
            'name' => 'Pilot Radius',
            'status' => 'active',
            'master_source' => 'sap_dummy',
            'geofence_radius' => 50,
            'location' => new Point(-6.2, 106.8),
        ]);
    }

    public function test_online_start_outside_radius_is_rejected_without_a_visit(): void
    {
        $sales = $this->sales();
        $store = $this->store();

        $this->actingAs($sales, 'sanctum')->postJson('/api/v1/visit/start', [
            'store_id' => $store->id,
            'latitude' => -6.1988,
            'longitude' => 106.8,
            'accuracy' => 10,
        ])->assertStatus(422);

        $this->assertDatabaseCount('visit_logs', 0);
    }

    public function test_inside_start_and_outside_checkout_keep_target_but_show_audit(): void
    {
        $sales = $this->sales();
        $store = $this->store();
        $this->actingAs($sales, 'sanctum');

        $start = $this->postJson('/api/v1/visit/start', [
            'store_id' => $store->id,
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 10,
        ])->assertStatus(201)
            ->assertJsonPath('data.visit.checkin_radius_status', 'inside_radius');

        $id = $start->json('data.visit_log_id');
        $checkout = $this->postJson('/api/v1/visit/checkout', [
            'visit_log_id' => $id,
            'latitude' => -6.1988,
            'longitude' => 106.8,
            'accuracy' => 10,
            'visit_result' => 'no_order',
        ])->assertStatus(200)
            ->assertJsonPath('data.visit.checkout_radius_status', 'outside_radius')
            ->assertJsonPath('data.visit.counted_as_target', true);

        $this->assertGreaterThan(100, $checkout->json('data.visit.checkout_distance'));
        $this->assertSame(-6.1988, $checkout->json('data.visit.checkout_latitude'));
        $this->assertSame('store', VisitLog::findOrFail($id)->geofence_reference_source);
        $this->patchJson("/api/v1/visits/{$id}", ['latitude' => -6.2, 'longitude' => 106.8])
            ->assertStatus(422);
    }

    public function test_first_checkin_without_customer_coordinates_is_allowed(): void
    {
        $sales = $this->sales();
        $store = $this->store();
        $store->location = null;
        $store->save();

        $this->actingAs($sales, 'sanctum')->postJson('/api/v1/visit/start', [
            'store_id' => $store->id,
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 20,
        ])->assertStatus(201)
            ->assertJsonPath('data.visit.checkin_radius_status', 'initial_reference')
            ->assertJsonPath('data.counted_as_target', true);
    }

    public function test_checkout_uses_original_customer_center_after_master_point_changes(): void
    {
        $sales = $this->sales();
        $store = $this->store();
        $this->actingAs($sales, 'sanctum');
        $start = $this->postJson('/api/v1/visit/start', [
            'store_id' => $store->id, 'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
        ])->assertStatus(201);

        $store->location = new Point(-6.3, 106.8);
        $store->save();
        $this->postJson('/api/v1/visit/checkout', [
            'visit_log_id' => $start->json('data.visit_log_id'),
            'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
            'visit_result' => 'no_order',
        ])->assertStatus(200)
            ->assertJsonPath('data.visit.checkout_radius_status', 'inside_radius');
    }

    public function test_offline_changed_customer_reference_is_saved_for_review_without_target_count(): void
    {
        $sales = $this->sales();
        $store = $this->store();
        $this->actingAs($sales, 'sanctum')->postJson('/api/v1/visit/start', [
            'store_id' => $store->id, 'latitude' => -6.2, 'longitude' => 106.8,
            'accuracy' => 10, 'offline_sync' => true,
            'location_recorded_at' => now()->toISOString(),
            'captured_store_has_location' => true,
            'captured_store_latitude' => -6.3,
            'captured_store_longitude' => 106.8,
            'captured_store_radius' => 50,
        ])->assertStatus(201)
            ->assertJsonPath('data.visit.checkin_radius_status', 'reference_changed')
            ->assertJsonPath('data.counted_as_target', false)
            ->assertJsonPath('data.warning', 'Titik lokasi customer berubah sejak data offline disimpan. Kunjungan perlu ditinjau dan belum dihitung ke target.');
    }

    public function test_checkout_time_before_checkin_is_not_reported_as_zero_presence(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-17T09:10:00+07:00'));
        try {
            $sales = $this->sales();
            $store = $this->store();
            $this->actingAs($sales, 'sanctum');
            $start = $this->postJson('/api/v1/visit/start', [
                'store_id' => $store->id, 'latitude' => -6.2, 'longitude' => 106.8,
                'accuracy' => 10, 'offline_sync' => true,
                'location_recorded_at' => '2026-11-17T09:05:00+07:00',
            ])->assertStatus(201);

            $this->postJson('/api/v1/visit/checkout', [
                'visit_log_id' => $start->json('data.visit_log_id'),
                'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
                'visit_result' => 'no_order', 'offline_sync' => true,
                'location_recorded_at' => '2026-11-17T09:00:00+07:00',
            ])->assertStatus(200)
                ->assertJsonPath('data.visit.duration_minutes', null)
                ->assertJsonPath('data.visit.presence.status', 'invalid_time');
        } finally {
            Carbon::setTestNow();
        }
    }
}
