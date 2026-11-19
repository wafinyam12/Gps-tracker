<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VisitPhotoCoordinateSeedTest extends TestCase
{
    use RefreshDatabase;

    private User $sales;
    private Store $store;
    private VisitLog $visit;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'sales', 'guard_name' => 'web']);
        $this->sales = User::factory()->create(['is_active' => true]);
        $this->sales->assignRole('sales');
        $this->store = Store::create([
            'code' => 'PHOTO-SEED-01',
            'name' => 'Toko Foto',
            'status' => 'active',
            'master_source' => 'sap_outstanding_receivable',
            'geofence_radius' => 50,
            'location' => null,
        ]);
        $this->visit = VisitLog::create([
            'user_id' => $this->sales->id,
            'store_id' => $this->store->id,
            'checkin_at' => now()->subMinutes(2),
            'checkin_location' => new Point(-7.973920, 112.748402),
            'checkin_accuracy' => 34.1,
            'checkin_valid' => true,
            'geofence_radius_meters' => 50,
        ]);
        Storage::fake('visit_photos');
        $this->actingAs($this->sales, 'sanctum');
    }

    public function test_eligible_photo_fills_empty_master_and_open_visit_reference(): void
    {
        $response = $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_metadata' => [$this->metadata()],
        ]));

        $response->assertStatus(201);
        $photo = VisitPhoto::firstOrFail();
        $this->assertSame('photo_capture', $photo->location_source);
        $this->assertSame(12.0, (float) $photo->location_accuracy);
        $this->assertEqualsWithDelta(-7.973899, $photo->location->latitude, 0.000001);
        $this->assertEqualsWithDelta(-7.973899, $this->store->fresh()->location->latitude, 0.000001);
        $this->assertSame('photo', $this->store->fresh()->coordinate_source);
        $this->assertSame('photo', $this->visit->fresh()->geofence_reference_source);
        $this->assertEqualsWithDelta(-7.973899, $this->visit->fresh()->geofence_center->latitude, 0.000001);
        $this->assertDatabaseHas('store_coordinate_changes', [
            'store_id' => $this->store->id,
            'photo_id' => $photo->id,
            'source' => 'photo',
            'actor_user_id' => null,
        ]);
    }

    public function test_each_photo_keeps_its_own_location_and_time(): void
    {
        $second = $this->metadata();
        $second['latitude'] = -7.973910;
        $second['longitude'] = 112.748410;
        $second['taken_at'] = now()->addSeconds(5)->toISOString();
        $second['location_recorded_at'] = now()->addSeconds(5)->toISOString();

        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photos' => [$this->image('one.jpg'), $this->image('two.jpg')],
            'photo_metadata' => [$this->metadata(), $second],
        ]))->assertStatus(201);

        $photos = VisitPhoto::orderBy('id')->get();
        $this->assertCount(2, $photos);
        $this->assertEqualsWithDelta(-7.973899, $photos[0]->location->latitude, 0.000001);
        $this->assertEqualsWithDelta(-7.973910, $photos[1]->location->latitude, 0.000001);
        $this->assertNotEquals($photos[0]->taken_at->timestamp, $photos[1]->taken_at->timestamp);
    }

    public function test_legacy_shared_location_and_missing_gps_never_seed_master(): void
    {
        $this->postJson('/api/v1/visit/photos', $this->payload([
            'latitude' => -7.973899,
            'longitude' => 112.748395,
        ]))->assertStatus(201);
        $legacy = VisitPhoto::firstOrFail();
        $this->assertSame('legacy_shared', $legacy->location_source);
        $this->assertNull($legacy->location_accuracy);
        $this->assertNull($this->store->fresh()->location);

        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_metadata' => [[
                'taken_at' => now()->toISOString(),
            ]],
        ]))->assertStatus(201);
        $missingGps = VisitPhoto::latest('id')->firstOrFail();
        $this->assertNull($missingGps->location);
        $this->assertNull($this->store->fresh()->location);
    }

    public function test_invalid_or_misaligned_photo_metadata_is_rejected_before_storing(): void
    {
        $invalid = $this->metadata();
        $invalid['accuracy'] = -1;
        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_metadata' => [$invalid],
        ]))->assertStatus(422);

        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_metadata' => [$this->metadata(), $this->metadata()],
        ]))->assertStatus(422);

        $this->assertDatabaseCount('visit_photos', 0);
        $this->assertNull($this->store->fresh()->location);
    }

    public function test_inaccurate_mock_or_distant_photo_remains_evidence_only(): void
    {
        foreach ([
            ['accuracy' => 34.1],
            ['is_mock_location' => true],
            ['is_mock_location' => null],
            ['taken_at' => null],
            [
                'taken_at' => now()->addMinutes(5)->toISOString(),
                'location_recorded_at' => now()->addMinutes(5)->toISOString(),
            ],
            ['latitude' => -7.975000],
        ] as $override) {
            $this->postJson('/api/v1/visit/photos', $this->payload([
                'photo_metadata' => [array_replace($this->metadata(), $override)],
            ]))->assertStatus(201);
        }

        $this->assertDatabaseCount('visit_photos', 6);
        $this->assertNull($this->store->fresh()->location);
    }

    public function test_offline_photo_uploaded_after_checkout_can_seed_master_without_rewriting_checkout(): void
    {
        $this->visit->update([
            'checkout_at' => now()->subSeconds(20),
            'checkout_radius_status' => 'uncertain',
            'checkout_distance' => null,
        ]);
        $metadata = $this->metadata();
        $metadata['taken_at'] = now()->subMinute()->toISOString();
        $metadata['location_recorded_at'] = now()->subMinute()->toISOString();

        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_metadata' => [$metadata],
        ]))->assertStatus(201);

        $this->assertNotNull($this->store->fresh()->location);
        $this->assertNull($this->visit->fresh()->geofence_center);
        $this->assertSame('uncertain', $this->visit->fresh()->checkout_radius_status);
        $this->assertNull($this->visit->fresh()->checkout_distance);
    }

    public function test_replayed_photo_uuid_does_not_create_another_observation(): void
    {
        $uuid = '08bfb0e8-1cff-47ef-b719-807b518c532a';
        $payload = $this->payload([
            'photo_client_uuids' => [$uuid],
            'photo_metadata' => [$this->metadata()],
        ]);
        $this->postJson('/api/v1/visit/photos', $payload)->assertStatus(201);
        $this->postJson('/api/v1/visit/photos', $this->payload([
            'photo_client_uuids' => [$uuid],
            'photo_metadata' => [$this->metadata()],
        ]))->assertOk();

        $this->assertDatabaseCount('visit_photos', 1);
        $this->assertDatabaseCount('store_coordinate_changes', 1);
    }

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'visit_log_id' => $this->visit->id,
            'type' => 'other',
            'photos' => [$this->image()],
        ], $overrides);
    }

    private function metadata(): array
    {
        return [
            'latitude' => -7.973899,
            'longitude' => 112.748395,
            'accuracy' => 12,
            'location_recorded_at' => now()->toISOString(),
            'taken_at' => now()->toISOString(),
            'is_mock_location' => false,
        ];
    }

    private function image(string $name = 'visit.jpg'): UploadedFile
    {
        return UploadedFile::fake()->image($name, 600, 500);
    }
}
