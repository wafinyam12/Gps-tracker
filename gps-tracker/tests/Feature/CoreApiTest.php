<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\Team;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Storage;
use MatanYadaev\EloquentSpatial\Objects\Point;
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
            'username' => 'sales-login',
            'email' => 'sales@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'sales-login',
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

    public function test_user_can_login_with_email_as_identifier(): void
    {
        $user = User::factory()->create([
            'username' => 'sales-login',
            'email' => 'sales@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        $response = $this->postJson('/api/v1/auth/login', [
            'username' => 'sales@example.com',
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
            ])
            ->assertJsonPath('data.user.email', 'sales@example.com');
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

    public function test_sales_with_sap_credentials_can_see_sap_available_stores(): void
    {
        $user = User::factory()->create([
            'is_active' => true,
            'db_sap' => 'SIMULASI_UDMW',
            'slpCode' => '48',
        ]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SIMULASI_UDMW/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'A00000001',
                        'Customer Name' => 'SETIAWAN FITRI WANGI',
                        'Customer Address' => 'JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO',
                        'Current Balance' => '2678551351.090000',
                        'Balance Credit Limit' => '-2678551351.090000',
                        'Invoices' => [],
                    ]),
                ]),
                200
            ),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/stores/available');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $stores = $response->json('data');
        $this->assertIsArray($stores);

        $store = collect($stores)->firstWhere('external_bp_code', 'A00000001');
        $this->assertNotNull($store);
        $this->assertSame('A00000001', $store['code'] ?? null);
        $this->assertSame('SETIAWAN FITRI WANGI', $store['name'] ?? null);
        $this->assertSame('JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO', $store['address'] ?? null);
        $this->assertSame('sap_outstanding_receivable', $store['master_source'] ?? null);

        Http::assertSentCount(1);
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
        $branch = Team::create([
            'code' => 'SPV-01',
            'name' => 'Cabang SPV',
            'area' => 'Jakarta',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $spv = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
        ]);
        $spv->assignRole('spv');
        $token = $spv->createToken('test-spv')->plainTextToken;

        $sales = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
        ]);
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

    public function test_sales_can_start_visit_using_sap_synced_store_data(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 20, 9, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create([
            'is_active' => true,
            'db_sap' => 'SIMULASI_UDMW',
            'slpCode' => '48',
        ]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SIMULASI_UDMW/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'A00000001',
                        'Customer Name' => 'SETIAWAN FITRI WANGI',
                        'Customer Address' => 'JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO',
                        'Current Balance' => '2678551351.090000',
                        'Balance Credit Limit' => '-2678551351.090000',
                        'Invoices' => [],
                    ]),
                ]),
                200
            ),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'A00000001',
                'store_name' => 'Placeholder',
                'store_address' => 'Placeholder',
                'latitude' => -6.20010,
                'longitude' => 106.81660,
                'accuracy' => 10,
                'is_mock_location' => false,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.store.external_bp_code', 'A00000001')
            ->assertJsonPath('data.store.name', 'SETIAWAN FITRI WANGI')
            ->assertJsonPath('data.store.address', 'JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO')
            ->assertJsonPath('data.counted_as_target', true);

        $store = Store::where('external_bp_code', 'A00000001')->first();
        $this->assertNotNull($store);
        $this->assertSame('SETIAWAN FITRI WANGI', $store->name);
        $this->assertSame('JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO', $store->address);
        $this->assertSame('sap_outstanding_receivable', $store->master_source);
        $this->assertTrue($store->hasLocation());

        Http::assertSentCount(1);
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

    public function test_sales_can_cancel_open_visit_and_start_a_new_one(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $startResponse = $this->withHeader('Authorization', 'Bearer '.$token)
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

        $startResponse->assertStatus(201);
        $visitLogId = $startResponse->json('data.visit_log_id');

        $deleteResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson("/api/v1/visits/{$visitLogId}");

        $deleteResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseMissing('visit_logs', [
            'id' => $visitLogId,
        ]);

        $secondStart = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-0002',
                'store_name' => 'Toko Dummy Thamrin',
                'store_address' => 'Jl. M.H. Thamrin No. 15, Jakarta Pusat',
                'branch' => 'Jakarta Pusat',
                'latitude' => -6.19445,
                'longitude' => 106.82292,
                'accuracy' => 10,
                'is_mock_location' => false,
            ]);

        $secondStart->assertStatus(201)
            ->assertJsonPath('data.is_duplicate', false);
    }

    public function test_visit_detail_includes_sap_outstanding_receivable_for_matching_store(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 20, 9, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create([
            'is_active' => true,
            'db_sap' => 'SIMULASI_UDMW',
            'slpCode' => '48',
        ]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $store = Store::create([
            'code' => 'STORE-SAP-001',
            'external_bp_code' => 'A00000001',
            'name' => 'Toko SAP Utama',
            'address' => 'Jl. Contoh No. 1, Jakarta',
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

        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SIMULASI_UDMW/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'A00000001',
                        'Customer Name' => 'SETIAWAN FITRI WANGI',
                        'Customer Address' => 'JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO',
                        'Current Balance' => '2678551351.090000',
                        'Payment Terms' => '30D',
                        'Invoices' => [
                            $this->sapOutstandingInvoice('6569', '24003627', '2024-11-07'),
                            $this->sapOutstandingInvoice('10074', '25001401', '2025-05-13'),
                        ],
                    ]),
                ]),
                200
            ),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson("/api/v1/visits/{$visitLog->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.status', 'success')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.card_code', 'A00000001')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.card_name', 'SETIAWAN FITRI WANGI')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.payment_terms', '30D')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.current_balance', 2678551351.09)
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoice_count', 2)
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.overdue_invoice_count', 2)
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoices.0.document_type', 'AR INVOICE')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoices.0.doc_num', '24003627')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoices.0.doc_date', '2024-11-07')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoices.0.doc_due_date', '2024-12-07')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.invoices.0.is_overdue', true);

        Http::assertSentCount(1);
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

    public function test_spv_cannot_view_visit_photos_outside_their_team(): void
    {
        $spvTeam = Team::create([
            'code' => 'SPV-IN',
            'name' => 'Cabang Sendiri',
            'area' => 'Jakarta',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $otherTeam = Team::create([
            'code' => 'SPV-OUT',
            'name' => 'Cabang Lain',
            'area' => 'Bandung',
            'location' => new Point(latitude: -6.914744, longitude: 107.609810),
            'is_active' => true,
        ]);

        $spv = User::factory()->create([
            'is_active' => true,
            'team_id' => $spvTeam->id,
        ]);
        $spv->assignRole('spv');

        $sales = User::factory()->create([
            'is_active' => true,
            'team_id' => $otherTeam->id,
        ]);
        $sales->assignRole('sales');

        $store = Store::create([
            'code' => 'STORE-SEC-001',
            'external_bp_code' => 'SAP-SEC-001',
            'name' => 'Toko Rahasia',
            'address' => 'Jl. Rahasia No. 1',
            'branch' => 'Bandung',
            'location' => new \MatanYadaev\EloquentSpatial\Objects\Point(
                latitude: -6.914744,
                longitude: 107.609810,
            ),
            'geofence_radius' => 100,
            'status' => 'active',
            'master_source' => 'sap_dummy',
            'master_payload' => ['source' => 'test'],
            'last_synced_at' => now(),
        ]);

        $visitLog = VisitLog::create([
            'user_id' => $sales->id,
            'store_id' => $store->id,
            'visit_date' => '2026-06-16',
            'checkin_at' => now(),
            'checkin_location' => new \MatanYadaev\EloquentSpatial\Objects\Point(
                latitude: -6.914744,
                longitude: 107.609810,
            ),
            'checkin_valid' => true,
            'counted_as_target' => true,
        ]);

        VisitPhoto::create([
            'visit_log_id' => $visitLog->id,
            'path' => '2026/06/16/'.$visitLog->id.'/photo.jpg',
            'type' => 'checkin',
            'taken_at' => now(),
        ]);

        Sanctum::actingAs($spv);

        $response = $this->getJson("/api/v1/visit/{$visitLog->id}/photos");

        $response->assertStatus(403);
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

    private function sapOutstandingResponse(array $customers): array
    {
        return [
            'status' => 'success',
            'data' => $customers,
        ];
    }

    private function sapOutstandingCustomer(array $overrides = []): array
    {
        $customer = [
            'Sales Code' => '48',
            'Sales Name' => 'Nenik',
            'Customer Code' => 'A00000001',
            'Customer Name' => 'SETIAWAN FITRI WANGI',
            'Customer Address' => 'JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO',
            'Payment Terms' => '30D',
            'Credit Limit' => '0.000000',
            'Current Balance' => '2678551351.090000',
            'Balance Credit Limit' => '-2678551351.090000',
            'Total AR Invoice Outstanding' => 0,
            'Total DP Invoice Outstanding' => 0,
            'Total Document Outstanding' => 0,
            'Invoices' => [],
        ];

        $customer = array_merge($customer, $overrides);
        $invoices = is_array($customer['Invoices'] ?? null) ? $customer['Invoices'] : [];
        $invoiceCount = count($invoices);

        if (! array_key_exists('Total AR Invoice Outstanding', $overrides)) {
            $customer['Total AR Invoice Outstanding'] = $invoiceCount;
        }

        if (! array_key_exists('Total DP Invoice Outstanding', $overrides)) {
            $customer['Total DP Invoice Outstanding'] = 0;
        }

        if (! array_key_exists('Total Document Outstanding', $overrides)) {
            $customer['Total Document Outstanding'] = $invoiceCount;
        }

        return $customer;
    }

    private function sapOutstandingInvoice(
        string $docEntry,
        string $invoiceNo,
        string $postingDate,
        string $documentType = 'AR INVOICE'
    ): array {
        return [
            'Document Type' => $documentType,
            'DocEntry' => $docEntry,
            'Invoice No' => $invoiceNo,
            'Posting Date' => $postingDate,
        ];
    }
}
