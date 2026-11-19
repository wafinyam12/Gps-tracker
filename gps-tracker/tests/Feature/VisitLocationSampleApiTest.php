<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VisitLocationSampleApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-17T09:10:00+07:00'));
        foreach (['web', 'sanctum'] as $guard) {
            Role::firstOrCreate(['name' => 'sales', 'guard_name' => $guard]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function completedVisit(): array
    {
        $sales = User::factory()->create(['is_active' => true]);
        $sales->assignRole('sales');
        $store = Store::create([
            'code' => 'PILOT-SAMPLES-01', 'external_bp_code' => 'PILOT-SAMPLES-01',
            'name' => 'Pilot Samples', 'status' => 'active', 'master_source' => 'sap_dummy',
            'geofence_radius' => 50, 'location' => new Point(-6.2, 106.8),
        ]);
        $this->actingAs($sales, 'sanctum');
        $start = $this->postJson('/api/v1/visit/start', [
            'store_id' => $store->id, 'latitude' => -6.2, 'longitude' => 106.8,
            'accuracy' => 10, 'offline_sync' => true,
            'location_recorded_at' => '2026-11-17T09:00:00+07:00',
        ])->assertStatus(201);
        $id = $start->json('data.visit_log_id');
        $this->postJson('/api/v1/visit/checkout', [
            'visit_log_id' => $id, 'latitude' => -6.2, 'longitude' => 106.8,
            'accuracy' => 10, 'visit_result' => 'no_order', 'offline_sync' => true,
            'location_recorded_at' => '2026-11-17T09:05:00+07:00',
        ])->assertStatus(200);

        return [$sales, $id];
    }

    public function test_owner_can_sync_final_batch_once_and_replay_without_double_counting(): void
    {
        [, $id] = $this->completedVisit();
        $samples = [];
        foreach (['09:00:00', '09:01:00', '09:02:00', '09:05:00'] as $index => $time) {
            $samples[] = [
                'client_uuid' => sprintf('12345678-1234-4123-8123-%012d', $index + 1),
                'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
                'recorded_at' => "2026-11-17T{$time}+07:00", 'is_mock_location' => false,
            ];
        }

        $payload = ['samples' => $samples, 'final_batch' => true];
        $this->postJson("/api/v1/visits/{$id}/samples", $payload)->assertStatus(200)
            ->assertJsonPath('data.summary.inside_seconds', 120)
            ->assertJsonPath('data.summary.unmeasured_seconds', 180)
            ->assertJsonPath('data.summary.status', 'complete');
        $this->postJson("/api/v1/visits/{$id}/samples", $payload)->assertStatus(200);
        $this->assertDatabaseCount('visit_location_samples', 4);
        $conflict = $samples[0];
        $conflict['latitude'] = -6.199;
        $this->postJson("/api/v1/visits/{$id}/samples", ['samples' => [$conflict]])
            ->assertStatus(409);
        $this->getJson("/api/v1/visits/{$id}")->assertStatus(200)
            ->assertJsonPath('data.visit.presence.inside_seconds', 120)
            ->assertJsonPath('data.visit.presence.status', 'complete');
    }

    public function test_empty_final_batch_marks_visit_complete_without_inventing_location(): void
    {
        [, $id] = $this->completedVisit();
        $this->postJson("/api/v1/visits/{$id}/samples", [
            'samples' => [], 'final_batch' => true,
        ])->assertStatus(200)
            ->assertJsonPath('data.summary.inside_seconds', 0)
            ->assertJsonPath('data.summary.unmeasured_seconds', 300)
            ->assertJsonPath('data.summary.status', 'complete');
        $this->assertDatabaseCount('visit_location_samples', 0);
    }

    public function test_other_sales_cannot_upload_and_mock_sample_is_rejected(): void
    {
        [, $id] = $this->completedVisit();
        $sample = [
            'client_uuid' => '12345678-1234-4123-8123-000000000001',
            'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
            'recorded_at' => '2026-11-17T09:01:00+07:00', 'is_mock_location' => true,
        ];
        $this->postJson("/api/v1/visits/{$id}/samples", ['samples' => [$sample]])->assertStatus(422);

        $other = User::factory()->create(['is_active' => true]);
        $other->assignRole('sales');
        $this->actingAs($other, 'sanctum')
            ->postJson("/api/v1/visits/{$id}/samples", ['samples' => [$sample]])
            ->assertStatus(403);
        $this->assertDatabaseCount('visit_location_samples', 0);
    }

    public function test_area_manager_sees_only_own_team_visit_detail(): void
    {
        [$sales, $id] = $this->completedVisit();
        $ownTeam = Team::create(['code' => 'OWN', 'name' => 'Own', 'is_active' => true]);
        $otherTeam = Team::create(['code' => 'OTHER', 'name' => 'Other', 'is_active' => true]);
        $sales->team_id = $ownTeam->id;
        $sales->save();
        foreach (['web', 'sanctum'] as $guard) {
            Role::firstOrCreate(['name' => 'spv', 'guard_name' => $guard]);
        }
        $manager = User::factory()->create(['is_active' => true, 'team_id' => $otherTeam->id]);
        $manager->assignRole('spv');
        $this->actingAs($manager, 'sanctum')->getJson("/api/v1/visits/{$id}")->assertStatus(403);

        $manager->team_id = $ownTeam->id;
        $manager->save();
        $this->actingAs($manager, 'sanctum')->getJson("/api/v1/visits/{$id}")
            ->assertStatus(200)
            ->assertJsonPath('data.visit.checkout_radius_status', 'inside_radius')
            ->assertJsonPath('data.visit.presence.status', 'provisional');
        $this->patchJson("/api/v1/visits/{$id}", ['latitude' => -6.1988, 'longitude' => 106.8])
            ->assertStatus(403);
        $this->deleteJson("/api/v1/visits/{$id}")->assertStatus(403);
    }
}
