<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\Team;
use App\Models\LocationPing;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Models\User;
use App\Services\MasterData\StoreCatalogSyncService;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
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
            Role::firstOrCreate(['name' => 'superadmin', 'guard_name' => $guard]);
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

    public function test_authenticated_user_can_update_own_profile(): void
    {
        $user = User::factory()->create([
            'username' => 'profile-user',
            'email' => 'profile@example.com',
            'phone' => '081200000001',
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/auth/profile', [
            'name' => 'Profile User Updated',
            'username' => 'profile-updated',
            'email' => 'profile-updated@example.com',
            'phone' => '+6281299990000',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user.name', 'Profile User Updated')
            ->assertJsonPath('data.user.username', 'profile-updated')
            ->assertJsonPath('data.user.email', 'profile-updated@example.com')
            ->assertJsonPath('data.user.phone', '+6281299990000');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'username' => 'profile-updated',
            'email' => 'profile-updated@example.com',
        ]);
    }

    public function test_authenticated_user_can_change_own_password(): void
    {
        $user = User::factory()->create([
            'username' => 'password-user',
            'email' => 'password@example.com',
            'password' => bcrypt('old-password'),
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/change-password', [
            'current_password' => 'old-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

        $response->assertStatus(200);

        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
    }

    public function test_authenticated_user_can_update_profile_photo(): void
    {
        Storage::fake('public');

        $user = User::factory()->create([
            'username' => 'photo-user',
            'email' => 'photo@example.com',
            'is_active' => true,
        ]);
        $user->assignRole('sales');

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/auth/profile/photo', [
            'photo' => UploadedFile::fake()->image('profile.jpg', 480, 480),
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user.id', $user->id);

        $photoPath = $user->fresh()->photo;
        $this->assertNotNull($photoPath);
        Storage::disk('public')->assertExists($photoPath);
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
        $branch = Team::create([
            'code' => 'KLS-01',
            'name' => 'Cabang Kalsel',
            'area' => 'Kalimantan Selatan',
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -3.320000, longitude: 114.590000),
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
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
                        'PIC Name' => 'Budi Santoso',
                        'Cellular' => '081234567890',
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
        $this->assertSame('Budi Santoso', $store['pic_name'] ?? null);
        $this->assertSame('+6281234567890', $store['pic_phone'] ?? null);
        $this->assertSame('sap_outstanding_receivable', $store['master_source'] ?? null);

        Http::assertSentCount(1);
    }

    public function test_sales_can_paginate_sap_available_stores(): void
    {
        $branch = Team::create([
            'code' => 'KLS-01',
            'name' => 'Cabang Kalsel',
            'area' => 'Kalimantan Selatan',
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -3.320000, longitude: 114.590000),
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
            'slpCode' => '48',
        ]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SIMULASI_UDMW/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'A00000001',
                        'Customer Name' => 'Alpha Store',
                        'Customer Address' => 'Jl. Alpha No. 1',
                        'Invoices' => [],
                    ]),
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'A00000002',
                        'Customer Name' => 'Beta Store',
                        'Customer Address' => 'Jl. Beta No. 2',
                        'Invoices' => [],
                    ]),
                ]),
                200
            ),
        ]);

        $pageOne = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/stores/available?page=1&per_page=1');

        $pageOne->assertStatus(200)
            ->assertJsonPath('data.meta.current_page', 1)
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonPath('data.meta.last_page', 2)
            ->assertJsonPath('data.meta.has_more', true)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.external_bp_code', 'A00000001');

        $pageTwo = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/stores/available?page=2&per_page=1');

        $pageTwo->assertStatus(200)
            ->assertJsonPath('data.meta.current_page', 2)
            ->assertJsonPath('data.meta.per_page', 1)
            ->assertJsonPath('data.meta.last_page', 2)
            ->assertJsonPath('data.meta.has_more', false)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.external_bp_code', 'A00000002');

        Http::assertSentCount(1);
    }

    public function test_sap_customers_are_scoped_by_team_and_sales_code(): void
    {
        $surabaya = Team::create([
            'code' => 'SBY-01',
            'name' => 'Cabang Surabaya',
            'area' => 'Surabaya',
            'db_sap' => 'SAP_SURABAYA',
            'is_active' => true,
        ]);
        $bandung = Team::create([
            'code' => 'BDG-01',
            'name' => 'Cabang Bandung',
            'area' => 'Bandung',
            'db_sap' => 'SAP_BANDUNG',
            'is_active' => true,
        ]);

        $surabayaSales = User::factory()->create([
            'is_active' => true,
            'team_id' => $surabaya->id,
            'slpCode' => '47',
        ]);
        $surabayaSales->assignRole('sales');

        $bandungSales = User::factory()->create([
            'is_active' => true,
            'team_id' => $bandung->id,
            'slpCode' => '48',
        ]);
        $bandungSales->assignRole('sales');

        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SAP_SURABAYA/47' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'C0001',
                        'Customer Name' => 'Customer Surabaya',
                    ]),
                ]),
                200,
            ),
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SAP_BANDUNG/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'C0001',
                        'Customer Name' => 'Customer Bandung',
                    ]),
                ]),
                200,
            ),
        ]);

        $surabayaResponse = $this->actingAs($surabayaSales, 'sanctum')
            ->getJson('/api/v1/stores/available');
        $surabayaResponse->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Customer Surabaya');

        $bandungResponse = $this->actingAs($bandungSales, 'sanctum')
            ->getJson('/api/v1/stores/available');
        $bandungResponse->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Customer Bandung');

        $this->assertDatabaseHas('stores', [
            'team_id' => $surabaya->id,
            'external_bp_code' => 'C0001',
            'sap_slp_code' => '47',
        ]);
        $this->assertDatabaseHas('stores', [
            'team_id' => $bandung->id,
            'external_bp_code' => 'C0001',
            'sap_slp_code' => '48',
        ]);
        $this->assertSame(2, Store::where('external_bp_code', 'C0001')->count());
    }

    public function test_sap_sales_reassignment_preserves_the_store_and_local_location(): void
    {
        $team = Team::create([
            'code' => 'SBY-01',
            'name' => 'Cabang Surabaya',
            'area' => 'Surabaya',
            'db_sap' => 'SAP_SURABAYA',
            'is_active' => true,
        ]);
        $sales47 = User::factory()->create([
            'is_active' => true,
            'team_id' => $team->id,
            'slpCode' => '47',
        ]);
        $sales48 = User::factory()->create([
            'is_active' => true,
            'team_id' => $team->id,
            'slpCode' => '48',
        ]);

        $catalog = app(StoreCatalogSyncService::class);
        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SAP_SURABAYA/47' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'C0001',
                        'Customer Name' => 'Customer Pindah Sales',
                    ]),
                ]),
                200,
            ),
        ]);
        $catalog->sync(false, $sales47, true);

        $store = Store::query()
            ->where('team_id', $team->id)
            ->where('external_bp_code', 'C0001')
            ->firstOrFail();
        $store->update([
            'location' => new Point(latitude: -7.257472, longitude: 112.752090),
        ]);
        $storeId = $store->id;

        Cache::flush();
        Http::fake([
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SAP_SURABAYA/47' => Http::response(
                $this->sapOutstandingResponse([]),
                200,
            ),
            'https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable/SAP_SURABAYA/48' => Http::response(
                $this->sapOutstandingResponse([
                    $this->sapOutstandingCustomer([
                        'Customer Code' => 'C0001',
                        'Customer Name' => 'Customer Pindah Sales',
                    ]),
                ]),
                200,
            ),
        ]);

        $catalog->sync(false, $sales47, true);
        $this->assertDatabaseHas('stores', [
            'id' => $storeId,
            'team_id' => $team->id,
            'status' => 'inactive',
            'sap_slp_code' => null,
        ]);

        $catalog->sync(false, $sales48, true);

        $reassignedStore = Store::findOrFail($storeId);
        $this->assertSame('48', $reassignedStore->sap_slp_code);
        $this->assertSame('active', $reassignedStore->status);
        $this->assertSame(-7.257472, $reassignedStore->location?->latitude);
        $this->assertSame(112.752090, $reassignedStore->location?->longitude);
        $this->assertSame(1, Store::where('team_id', $team->id)
            ->where('external_bp_code', 'C0001')
            ->count());
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
            'db_sap' => 'SIMULASI_UDMW',
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

    public function test_branch_admin_can_bulk_set_daily_targets(): void
    {
        $branch = Team::create([
            'code' => 'BULK-01',
            'name' => 'Cabang Bulk',
            'area' => 'Jakarta',
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $admin = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
        ]);
        $admin->assignRole('admin');
        $token = $admin->createToken('test-admin')->plainTextToken;

        $salesA = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
        ]);
        $salesA->assignRole('sales');
        $salesB = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
        ]);
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

    public function test_superadmin_can_bulk_set_daily_targets_across_branches(): void
    {
        $branchA = Team::create([
            'code' => 'SUPER-01',
            'name' => 'Cabang Super A',
            'area' => 'Jakarta',
            'db_sap' => 'SIMULASI_UDMW_A',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $branchB = Team::create([
            'code' => 'SUPER-02',
            'name' => 'Cabang Super B',
            'area' => 'Bandung',
            'db_sap' => 'SIMULASI_UDMW_B',
            'location' => new Point(latitude: -6.914744, longitude: 107.609810),
            'is_active' => true,
        ]);

        $superadmin = User::factory()->create(['is_active' => true]);
        $superadmin->assignRole('superadmin');
        $token = $superadmin->createToken('test-superadmin')->plainTextToken;

        $salesA = User::factory()->create([
            'is_active' => true,
            'team_id' => $branchA->id,
        ]);
        $salesA->assignRole('sales');

        $salesB = User::factory()->create([
            'is_active' => true,
            'team_id' => $branchB->id,
        ]);
        $salesB->assignRole('sales');

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/target/bulk-set', [
                'target_date' => '2026-06-16',
                'target_visits' => 8,
                'user_ids' => [$salesA->id, $salesB->id],
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.targets.0.user_id', $salesA->id)
            ->assertJsonPath('data.targets.1.user_id', $salesB->id);

        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $salesA->id,
            'target_date' => '2026-06-16',
            'target_visits' => 8,
            'set_by' => $superadmin->id,
        ]);
        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $salesB->id,
            'target_date' => '2026-06-16',
            'target_visits' => 8,
            'set_by' => $superadmin->id,
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

    public function test_sales_cannot_start_visit_with_mock_location(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-FAKE-001',
                'store_name' => 'Toko Fake GPS',
                'store_address' => 'Jl. Contoh Fake',
                'branch' => 'Jakarta Pusat',
                'latitude' => -6.21462,
                'longitude' => 106.82172,
                'accuracy' => 10,
                'is_mock_location' => true,
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.reason', 'mock_location');

        $this->assertDatabaseCount('visit_logs', 0);
    }

    public function test_sales_cannot_start_visit_after_impossible_location_jump(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        LocationPing::create([
            'user_id' => $user->id,
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'accuracy' => 18,
            'is_mock_location' => false,
            'recorded_at' => now('Asia/Jakarta')->subMinute(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-TELEPORT-001',
                'store_name' => 'Toko Teleport',
                'store_address' => 'Jl. Contoh Teleport',
                'branch' => 'Surabaya',
                'latitude' => -7.250445,
                'longitude' => 112.768845,
                'accuracy' => 5,
                'is_mock_location' => false,
                'location_recorded_at' => now('Asia/Jakarta')->toISOString(),
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.reason', 'impossible_travel');

        $this->assertDatabaseCount('visit_logs', 0);
    }

    public function test_sales_can_start_visit_using_sap_synced_store_data(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 20, 9, 0, 0, 'Asia/Jakarta'));

        $branch = Team::create([
            'code' => 'KLS-01',
            'name' => 'Cabang Kalsel',
            'area' => 'Kalimantan Selatan',
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -3.320000, longitude: 114.590000),
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
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
                        'PIC Name' => 'Budi Santoso',
                        'Cellular' => '081234567890',
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
            ->assertJsonPath('data.store.pic_name', 'Budi Santoso')
            ->assertJsonPath('data.store.pic_phone', '+6281234567890')
            ->assertJsonPath('data.counted_as_target', true);

        $store = Store::where('external_bp_code', 'A00000001')->first();
        $this->assertNotNull($store);
        $this->assertSame('SETIAWAN FITRI WANGI', $store->name);
        $this->assertSame('JL. YOS SUDARSO KM.05 KALIPURO, KALIPURO', $store->address);
        $this->assertSame('Budi Santoso', $store->pic_name);
        $this->assertSame('+6281234567890', $store->pic_phone);
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
                    'activity_type' => 'kirim_penawaran',
                    'customer_response' => 'Minta follow up minggu depan',
                    'notes' => 'Checkout test',
                    'pic_name' => 'Budi Santoso',
                    'pic_phone' => '+6281234567890',
                ],
            ]);

        $checkoutResponse->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.visit_log_id', $visitLogId)
            ->assertJsonPath('data.duration_minutes', 17)
            ->assertJsonPath('data.visit.form_data.activity_type', 'kirim_penawaran')
            ->assertJsonPath('data.visit.form_data.customer_response', 'Minta follow up minggu depan')
            ->assertJsonPath('data.visit.form_data.pic_name', 'Budi Santoso')
            ->assertJsonPath('data.visit.form_data.pic_phone', '+6281234567890');

        $visitLog = VisitLog::findOrFail($visitLogId);
        $this->assertSame('kirim_penawaran', $visitLog->form_data['activity_type'] ?? null);
        $this->assertSame('Minta follow up minggu depan', $visitLog->form_data['customer_response'] ?? null);
        $this->assertSame('Budi Santoso', $visitLog->form_data['pic_name'] ?? null);
        $this->assertSame('+6281234567890', $visitLog->form_data['pic_phone'] ?? null);

        $this->assertDatabaseHas('visit_logs', [
            'id' => $visitLogId,
            'visit_result' => 'order_taken',
            'duration_minutes' => 17,
        ]);
    }

    public function test_sales_cannot_checkout_with_mock_location(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $startResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/start', [
                'external_bp_code' => 'SAP-DMY-0004',
                'store_name' => 'Toko Dummy Kelapa Gading',
                'store_address' => 'Jl. Boulevard Raya, Jakarta Utara',
                'branch' => 'Jakarta Utara',
                'latitude' => -6.15886,
                'longitude' => 106.90718,
                'accuracy' => 10,
                'is_mock_location' => false,
            ]);

        $startResponse->assertStatus(201);
        $visitLogId = $startResponse->json('data.visit_log_id');

        $checkoutResponse = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/visit/checkout', [
                'visit_log_id' => $visitLogId,
                'latitude' => -6.15886,
                'longitude' => 106.90718,
                'accuracy' => 10,
                'is_mock_location' => true,
                'visit_result' => 'order_taken',
                'notes' => 'Checkout fake GPS',
            ]);

        $checkoutResponse->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.reason', 'mock_location');

        $this->assertDatabaseHas('visit_logs', [
            'id' => $visitLogId,
            'checkout_at' => null,
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

        $branch = Team::create([
            'code' => 'KLS-01',
            'name' => 'Cabang Kalsel',
            'area' => 'Kalimantan Selatan',
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -3.320000, longitude: 114.590000),
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'is_active' => true,
            'team_id' => $branch->id,
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
            'pic_name' => 'Siti Rahma',
            'pic_phone' => '081299988877',
            'location' => new \MatanYadaev\EloquentSpatial\Objects\Point(
                latitude: -6.20010,
                longitude: 106.81660,
            ),
            'geofence_radius' => 50,
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
                        'PIC Name' => 'Budi Santoso',
                        'Cellular' => '081234567890',
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
            ->assertJsonPath('data.visit.store.pic_name', 'Siti Rahma')
            ->assertJsonPath('data.visit.store.pic_phone', '081299988877')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.status', 'success')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.card_code', 'A00000001')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.card_name', 'SETIAWAN FITRI WANGI')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.pic_name', 'Budi Santoso')
            ->assertJsonPath('data.visit.store.sap_outstanding_receivable.pic_phone', '+6281234567890')
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
            'geofence_radius' => 50,
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

        $previewUrl = $response->json('data.photos.0.url');
        $this->assertIsString($previewUrl);
        $this->assertStringContainsString("/api/v1/visit/photos/{$photo->id}/preview", $previewUrl);
        $this->assertStringContainsString('signature=', $previewUrl);

        $filePath = Storage::disk('visit_photos')->path($photo->path);
        Storage::disk('visit_photos')->assertExists($photo->path);

        $previewResponse = $this->get($previewUrl);
        $previewResponse->assertOk();
        $previewResponse->assertHeader('Content-Type', 'image/jpeg');
        $this->assertStringStartsWith("\xFF\xD8", $previewResponse->streamedContent());

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
            'db_sap' => 'SIMULASI_UDMW',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $otherTeam = Team::create([
            'code' => 'SPV-OUT',
            'name' => 'Cabang Lain',
            'area' => 'Bandung',
            'db_sap' => 'SIMULASI_UDMW',
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
            'geofence_radius' => 50,
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
