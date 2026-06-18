<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CoreApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['web', 'sanctum'] as $guard) {
            Role::firstOrCreate(['name' => 'sales', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'spv', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'admin', 'guard_name' => $guard]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'sales@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'sales@example.com',
            'password' => 'password',
            'device_name' => 'Test Device',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'token',
                    'user',
                ],
            ]);
    }

    public function test_sales_can_see_dummy_available_stores(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/stores/available');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $stores = $response->json('data');
        $this->assertIsArray($stores);
        $this->assertNotEmpty($stores);
        $this->assertTrue(collect($stores)->contains(fn ($store) => ($store['external_bp_code'] ?? null) === 'SAP-DMY-0001'));
    }

    public function test_sales_can_see_today_target_progress(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/target/today');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.period.date', '2026-06-16')
            ->assertJsonPath('data.stats.target_visits', 5)
            ->assertJsonPath('data.stats.unique_visits', 0)
            ->assertJsonPath('data.stats.remaining_visits', 5);
    }

    public function test_spv_can_set_daily_target_for_sales(): void
    {
        $spv = User::factory()->create(['is_active' => true]);
        $spv->assignRole('spv');
        $token = $spv->createToken('test-spv')->plainTextToken;

        $sales = User::factory()->create(['is_active' => true]);
        $sales->assignRole('sales');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/target/set', [
                'user_id' => $sales->id,
                'target_date' => '2026-06-16',
                'target_visits' => 7,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.target.user_id', $sales->id)
            ->assertJsonPath('data.target.target_visits', 7);

        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $sales->id,
            'target_date' => '2026-06-16',
            'target_visits' => 7,
            'set_by' => $spv->id,
        ]);
    }

    public function test_admin_can_bulk_set_daily_targets(): void
    {
        $admin = User::factory()->create(['is_active' => true]);
        $admin->assignRole('admin');
        $token = $admin->createToken('test-admin')->plainTextToken;

        $salesA = User::factory()->create(['is_active' => true]);
        $salesA->assignRole('sales');
        $salesB = User::factory()->create(['is_active' => true]);
        $salesB->assignRole('sales');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/target/bulk-set', [
                'target_date' => '2026-06-16',
                'target_visits' => 6,
                'user_ids' => [$salesA->id, $salesB->id],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.targets.0.user_id', $salesA->id)
            ->assertJsonPath('data.targets.1.user_id', $salesB->id);

        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $salesA->id,
            'target_date' => '2026-06-16',
            'target_visits' => 6,
            'set_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $salesB->id,
            'target_date' => '2026-06-16',
            'target_visits' => 6,
            'set_by' => $admin->id,
        ]);
    }

    public function test_sales_first_valid_visit_saves_store_location_and_counts_target(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-0001',
                'store_name' => 'Toko Dummy Sudirman',
                'store_address' => 'Jl. Jenderal Sudirman Kav. 10, Jakarta Pusat',
                'branch' => 'Jakarta Pusat',
                'latitude' => -6.21462,
                'longitude' => 106.82172,
                'accuracy' => 10,
                'is_mock_location' => false,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.is_duplicate', false)
            ->assertJsonPath('data.counted_as_target', true);

        $visitDate = Carbon::now('Asia/Jakarta')->toDateString();

        $this->assertDatabaseHas('visit_logs', [
            'user_id' => $user->id,
            'visit_date' => $visitDate,
            'is_duplicate' => 0,
            'counted_as_target' => 1,
        ]);

        $store = Store::where('external_bp_code', 'SAP-DMY-0001')->first();
        $this->assertNotNull($store);
        $this->assertTrue($store->hasLocation());
    }

    public function test_duplicate_visit_same_day_is_flagged_and_not_counted(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $basePayload = [
            'external_bp_code' => 'SAP-DMY-0002',
            'store_name' => 'Toko Dummy Thamrin',
            'store_address' => 'Jl. M.H. Thamrin No. 15, Jakarta Pusat',
            'branch' => 'Jakarta Pusat',
            'latitude' => -6.19445,
            'longitude' => 106.82292,
            'accuracy' => 10,
            'is_mock_location' => false,
        ];

        $first = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', $basePayload);

        $first->assertStatus(201)
            ->assertJsonPath('data.is_duplicate', false);

        $visitLogId = $first->json('data.visit_log_id');

        $checkout = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/checkout', [
                'visit_log_id' => $visitLogId,
                'latitude' => -6.19445,
                'longitude' => 106.82292,
                'visit_result' => 'closed',
                'notes' => 'Pertama selesai',
                'form_data' => [
                    'notes' => 'Pertama selesai',
                ],
            ]);

        $checkout->assertStatus(200);

        $second = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', $basePayload);

        $second->assertStatus(201)
            ->assertJsonPath('data.is_duplicate', true)
            ->assertJsonPath('data.counted_as_target', false);

        $this->assertDatabaseCount('visit_logs', 2);
        $this->assertDatabaseHas('visit_logs', [
            'user_id' => $user->id,
            'is_duplicate' => 1,
            'counted_as_target' => 0,
        ]);
    }

    public function test_sales_can_checkout_using_visit_log_id(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        $startResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-0003',
                'store_name' => 'Toko Dummy Kuningan',
                'store_address' => 'Jl. HR Rasuna Said, Jakarta Selatan',
                'branch' => 'Jakarta Selatan',
                'latitude' => -6.21957,
                'longitude' => 106.83245,
                'accuracy' => 10,
                'is_mock_location' => false,
            ]);

        $visitLogId = $startResponse->json('data.visit_log_id');

        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 17, 0, 'Asia/Jakarta'));

        $checkoutResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/checkout', [
                'visit_log_id' => $visitLogId,
                'latitude' => -6.21957,
                'longitude' => 106.83245,
                'visit_result' => 'order_taken',
                'notes' => 'Checkout test',
                'form_data' => [
                    'notes' => 'Checkout test',
                ],
            ]);

        $checkoutResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.visit_log_id', $visitLogId)
            ->assertJsonPath('data.duration_minutes', 17);

        $this->assertDatabaseHas('visit_logs', [
            'id' => $visitLogId,
            'visit_result' => 'order_taken',
            'duration_minutes' => 17,
        ]);
    }

    public function test_sales_can_upload_visit_photos(): void
    {
        Storage::fake('visit_photos');

        Carbon::setTestNow(Carbon::create(2026, 6, 16, 10, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $store = Store::create([
            'code' => 'STORE-PHOTO-001',
            'external_bp_code' => 'SAP-DMY-PHOTO-001',
            'name' => 'Toko Dummy Foto',
            'address' => 'Jl. Foto No. 1, Jakarta',
            'branch' => 'Jakarta Pusat',
            'location' => new \MatanYadaev\EloquentSpatial\Objects\Point(
                latitude: -6.20010,
                longitude: 106.81660,
            ),
            'geofence_radius' => 100,
            'status' => 'active',
            'master_source' => 'sap_dummy',
            'master_payload' => ['source' => 'test'],
            'last_synced_at' => now('Asia/Jakarta'),
        ]);

        $visitLog = VisitLog::create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'visit_date' => '2026-06-16',
            'checkin_at' => now('Asia/Jakarta'),
            'checkin_location' => new \MatanYadaev\EloquentSpatial\Objects\Point(
                latitude: -6.20010,
                longitude: 106.81660,
            ),
            'checkin_valid' => true,
            'counted_as_target' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/photos', [
                'visit_log_id' => $visitLog->id,
                'type' => 'checkin',
                'latitude' => -6.20010,
                'longitude' => 106.81660,
                'taken_at' => '2026-06-16T10:00:00+07:00',
                'photos' => [
                    UploadedFile::fake()->image('visit-photo.jpg', 1200, 900),
                ],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.photos.0.type', 'checkin');

        $photo = VisitPhoto::first();
        $this->assertNotNull($photo);

        $filePath = Storage::disk('visit_photos')->path($photo->path);
        Storage::disk('visit_photos')->assertExists($photo->path);

        $exif = exif_read_data($filePath, null, true);
        $this->assertIsArray($exif);
        $this->assertSame('S', $exif['GPS']['GPSLatitudeRef'] ?? null);
        $this->assertSame('E', $exif['GPS']['GPSLongitudeRef'] ?? null);
        $this->assertSame('2026:06:16', $exif['GPS']['GPSDateStamp'] ?? null);
        $this->assertNotEmpty($exif['GPS']['GPSLatitude'] ?? null);
        $this->assertNotEmpty($exif['GPS']['GPSLongitude'] ?? null);
    }

    public function test_spv_visit_summary_reports_warning_for_under_target_day(): void
    {
        $spv = User::factory()->create(['is_active' => true]);
        $spv->assignRole('spv');
        $token = $spv->createToken('test-spv')->plainTextToken;

        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        $stores = [
            ['SAP-DMY-0001', 'Toko Dummy Sudirman', 'Jl. Jenderal Sudirman Kav. 10, Jakarta Pusat', 'Jakarta Pusat', -6.21462, 106.82172],
            ['SAP-DMY-0002', 'Toko Dummy Thamrin', 'Jl. M.H. Thamrin No. 15, Jakarta Pusat', 'Jakarta Pusat', -6.19445, 106.82292],
            ['SAP-DMY-0003', 'Toko Dummy Kuningan', 'Jl. HR Rasuna Said, Jakarta Selatan', 'Jakarta Selatan', -6.21957, 106.83245],
            ['SAP-DMY-0004', 'Toko Dummy Kelapa Gading', 'Jl. Boulevard Raya, Jakarta Utara', 'Jakarta Utara', -6.15886, 106.90718],
        ];

        $currentTime = Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta');

        foreach ($stores as [$code, $name, $address, $branch, $lat, $lng]) {
            Carbon::setTestNow($currentTime);

            $startResponse = $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson('/api/v1/visit/start', [
                    'external_bp_code' => $code,
                    'store_name' => $name,
                    'store_address' => $address,
                    'branch' => $branch,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'accuracy' => 10,
                    'is_mock_location' => false,
                ])
                ->assertStatus(201);

            $visitLogId = $startResponse->json('data.visit_log_id');

            Carbon::setTestNow($currentTime->copy()->addMinutes(10));

            $this->withHeader('Authorization', 'Bearer '.$token)
                ->postJson('/api/v1/visit/checkout', [
                    'visit_log_id' => $visitLogId,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'visit_result' => 'closed',
                    'notes' => 'Daily visit selesai',
                    'form_data' => [
                        'notes' => 'Daily visit selesai',
                    ],
                ])
                ->assertStatus(200);

            $currentTime = $currentTime->copy()->addMinutes(20);
        }

        Carbon::setTestNow(Carbon::create(2026, 6, 17, 9, 0, 0, 'Asia/Jakarta'));

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/target/summary?date_from=2026-06-16&date_to=2026-06-16');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.overview.unique_visits', 4)
            ->assertJsonPath('data.overview.warning_count', 1);

        $warnings = $response->json('data.warnings');
        $this->assertNotEmpty($warnings);
        $this->assertStringContainsString('4 dari 5', $warnings[0]['message']);

    }
}
