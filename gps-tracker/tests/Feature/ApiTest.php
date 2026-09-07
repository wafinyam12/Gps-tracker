<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Team;
use App\Models\Store;
use App\Models\VisitLog;
use App\Models\LocationPing;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class ApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $adminUser;
    protected $superAdminUser;
    protected $salesUser;
    protected $team;

    protected function setUp(): void
    {
        parent::setUp();

        // Create roles for both 'web' and 'sanctum' guards
        foreach (['web', 'sanctum'] as $guard) {
            Role::firstOrCreate(['name' => 'admin', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'manager', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'sales', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'spv', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'superadmin', 'guard_name' => $guard]);
        }

        $this->team = Team::create([
            'code' => 'TEST01',
            'name' => 'Test Team',
            'area' => 'Test Area',
            'location' => new Point(latitude: -6.200000, longitude: 106.816666),
            'is_active' => true,
        ]);

        $this->adminUser = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'team_id' => $this->team->id,
            'is_active' => true,
        ]);
        $this->adminUser->assignRole('admin');

        $this->superAdminUser = User::create([
            'name' => 'Super Admin User',
            'email' => 'superadmin@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $this->superAdminUser->assignRole('superadmin');

        $this->salesUser = User::create([
            'name' => 'Sales User',
            'email' => 'sales@example.com',
            'password' => bcrypt('password'),
            'team_id' => $this->team->id,
            'is_active' => true,
        ]);
        $this->salesUser->assignRole('sales');
    }

    /** @test */
    public function it_can_fetch_users_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->getJson('/api/v1/users');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'email', 'is_active', 'role', 'branch', 'team']
            ],
            'links', 'meta'
        ]);
    }

    /** @test */
    public function it_keeps_the_user_search_grouped_with_team_filters()
    {
        $otherTeam = Team::create([
            'code' => 'TEST99',
            'name' => 'Outside Team',
            'area' => 'Outside Area',
            'location' => new Point(latitude: -6.300000, longitude: 106.900000),
            'is_active' => true,
        ]);

        $outsideUser = User::create([
            'name' => 'Outside User',
            'email' => 'outside@example.com',
            'password' => bcrypt('password'),
            'team_id' => $otherTeam->id,
            'is_active' => true,
        ]);
        $outsideUser->assignRole('sales');

        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/v1/users?team_id='.$this->team->id.'&search=outside@example.com');

        $response->assertStatus(200);

        $emails = collect($response->json('data'))->pluck('email')->all();
        $this->assertNotContains('outside@example.com', $emails);
    }

    /** @test */
    public function it_can_create_a_team_as_superadmin()
    {
        Sanctum::actingAs($this->superAdminUser);
        $response = $this->postJson('/api/v1/teams', [
            'code' => 'TEST02',
            'name' => 'Another Team',
            'area' => 'Test Area 2',
            'db_sap' => 'NEW_TEST_DB',
            'latitude' => -6.180000,
            'longitude' => 106.820000,
            'is_active' => true,
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('data.name', 'Another Team');
        $response->assertJsonPath('data.has_location', true);
        $response->assertJsonPath('data.latitude', -6.18);
        $response->assertJsonPath('data.longitude', 106.82);
    }

    /** @test */
    public function it_can_fetch_teams_as_superadmin()
    {
        $otherTeam = Team::create([
            'code' => 'TEST02',
            'name' => 'Test Team B',
            'area' => 'Test Area B',
            'db_sap' => 'TEST_DB_B',
            'location' => new Point(latitude: -6.210000, longitude: 106.830000),
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->superAdminUser);
        $response = $this->getJson('/api/v1/teams');
        $response->assertStatus(200);

        $payload = $response->json('data');
        $teams = is_array($payload) && array_key_exists('data', $payload) && is_array($payload['data'])
            ? $payload['data']
            : $payload;

        $this->assertIsArray($teams);
        $this->assertCount(2, $teams);
        $this->assertArrayHasKey('id', $teams[0]);
        $this->assertArrayHasKey('name', $teams[0]);
        $this->assertArrayHasKey('code', $teams[0]);
        $this->assertArrayHasKey('latitude', $teams[0]);
        $this->assertArrayHasKey('longitude', $teams[0]);
        $this->assertArrayHasKey('location', $teams[0]);
        $this->assertArrayHasKey('has_location', $teams[0]);
        $this->assertContains($this->team->code, collect($teams)->pluck('code')->all());
        $this->assertContains($otherTeam->code, collect($teams)->pluck('code')->all());
    }

    /** @test */
    public function it_gets_403_when_branch_admin_attempts_to_create_team()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->postJson('/api/v1/teams', [
            'code' => 'TEST03',
            'name' => 'Forbidden Team',
            'area' => 'Test Area 3',
            'db_sap' => 'TEST_DB_FORBIDDEN',
            'latitude' => -6.19,
            'longitude' => 106.81,
            'is_active' => true,
        ]);
        $response->assertStatus(403);
    }

    /** @test */
    public function it_can_update_own_team_as_branch_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->putJson('/api/v1/teams/'.$this->team->id, [
            'code' => $this->team->code,
            'name' => 'Test Team Updated',
            'area' => 'Updated Area',
            'db_sap' => 'TEST_DB_UPDATED',
            'latitude' => -6.200000,
            'longitude' => 106.816666,
            'is_active' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.name', 'Test Team Updated')
            ->assertJsonPath('data.db_sap', 'TEST_DB_UPDATED');

        $this->assertDatabaseHas('teams', [
            'id' => $this->team->id,
            'name' => 'Test Team Updated',
            'db_sap' => 'TEST_DB_UPDATED',
        ]);
    }

    /** @test */
    public function it_can_save_udportal_credentials_on_a_team_without_exposing_the_password()
    {
        Sanctum::actingAs($this->superAdminUser);

        $response = $this->postJson('/api/v1/teams', [
            'code' => 'SOLO01',
            'name' => 'Cabang Solo',
            'area' => 'Solo',
            'db_sap' => 'NEW_SOLO',
            'udportal_username' => 'jurtapsolo',
            'udportal_password' => 'password',
            'latitude' => -7.569,
            'longitude' => 110.828,
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.udportal_username', 'jurtapsolo')
            ->assertJsonPath('data.has_udportal_password', true)
            ->assertJsonMissingPath('data.udportal_password');

        $this->assertDatabaseHas('teams', [
            'code' => 'SOLO01',
            'udportal_username' => 'jurtapsolo',
        ]);
    }

    /** @test */
    public function it_forwards_cash_payment_to_udportal_using_the_sales_branch_account()
    {
        config([
            'udportal.api_base_url' => 'https://udportal.example.test/api/v1',
            'udportal.api_token' => null,
            'udportal.api_username' => null,
            'udportal.api_password' => null,
        ]);

        $this->team->forceFill([
            'udportal_username' => 'jurtapsolo',
            'udportal_password' => 'password',
        ])->save();

        $store = Store::create([
            'code' => 'STORE-001',
            'name' => 'Toko Solo',
            'address' => 'Jl. Solo',
            'pic_name' => 'Budi',
            'pic_phone' => '081234567890',
            'status' => 'active',
        ]);

        $visitLog = VisitLog::create([
            'user_id' => $this->salesUser->id,
            'store_id' => $store->id,
            'visit_date' => now()->toDateString(),
            'checkin_at' => now(),
            'form_data' => [],
        ]);

        Http::fake([
            'https://udportal.example.test/api/v1/auth/login' => Http::response([
                'success' => true,
                'data' => ['access_token' => 'branch-token'],
            ]),
            'https://udportal.example.test/api/v1/cash-payments' => Http::response([
                'success' => true,
                'message' => 'Cash payment berhasil disimpan.',
                'data' => [
                    'id' => 10,
                    'sales_name' => 'Sales User',
                    'store_name' => 'Toko Solo',
                ],
            ], 201),
        ]);

        Sanctum::actingAs($this->salesUser);

        $response = $this->post('/api/v1/cash-payments', [
            'visit_log_id' => $visitLog->id,
            'amount' => '150000',
            'payment_type' => 'Tunai',
            'owner_name' => 'Budi',
            'telpon' => '081234567890',
            'invoice' => 'INV-001',
            'latitude' => -7.569,
            'longitude' => 110.828,
            'accuracy' => 12,
            'photo' => UploadedFile::fake()->image('receipt.jpg'),
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201)
            ->assertJsonPath('data.sales_name', 'Sales User')
            ->assertJsonPath('data.store_name', 'Toko Solo');

        Http::assertSent(function ($request) {
            return $request->url() === 'https://udportal.example.test/api/v1/auth/login'
                && $request->data()['username'] === 'jurtapsolo'
                && $request->data()['password'] === 'password';
        });

        Http::assertSent(function ($request) {
            $parts = collect($request->data())->keyBy('name');

            return $request->url() === 'https://udportal.example.test/api/v1/cash-payments'
                && $request->hasHeader('Authorization', 'Bearer branch-token')
                && $parts->get('sales_name')['contents'] === 'Sales User'
                && $parts->get('store_name')['contents'] === 'Toko Solo'
                && $parts->get('amount')['contents'] === '150000'
                && $request->hasFile('photo', filename: 'receipt.jpg');
        });
    }

    /** @test */
    public function it_cannot_toggle_store_status_because_store_master_is_read_only()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->patchJson('/api/v1/stores/999/toggle-status');
        $response->assertStatus(404);
    }

    /** @test */
    public function it_gets_401_when_unauthenticated()
    {
        // Don't call actingAs
        $response = $this->getJson('/api/v1/auth/me');
        $response->assertStatus(401);
    }

    /** @test */
    public function it_gets_403_when_sales_access_admin_route()
    {
        Sanctum::actingAs($this->salesUser);
        $response = $this->postJson('/api/v1/teams', [
            'code' => 'SALESTEST',
            'name' => 'Sales Team',
            'area' => 'Sales Area',
            'latitude' => -6.18,
            'longitude' => 106.82,
            'is_active' => true,
        ]);
        $response->assertStatus(403);
    }

    /** @test */
    public function it_can_fetch_live_locations_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $this->salesUser->update([
            'last_location' => new Point(1.0, 2.0),
            'last_seen_at' => now(),
        ]);

        LocationPing::create([
            'user_id' => $this->salesUser->id,
            'location' => new Point(1.0, 2.0),
            'recorded_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/location/live');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'users' => [
                    '*' => ['user_id', 'name', 'team_id', 'team', 'branch', 'location', 'is_online']
                ],
                'branches' => [
                    '*' => ['id', 'name', 'code', 'area', 'latitude', 'longitude', 'location', 'has_location', 'is_active', 'members_count']
                ],
                'scope' => ['role', 'team_id'],
            ]
        ]);
        $response->assertJsonPath('data.users.0.branch.name', 'Test Team');
        $response->assertJsonPath('data.branches.0.has_location', true);
    }

    /** @test */
    public function it_audits_mock_location_ping_without_trusting_it()
    {
        Sanctum::actingAs($this->salesUser);

        $trustedResponse = $this->postJson('/api/v1/location/ping', [
            'latitude' => -6.200000,
            'longitude' => 106.816666,
            'accuracy' => 12,
            'recorded_at' => now()->subMinute()->toISOString(),
            'is_mock_location' => false,
        ]);

        $trustedResponse->assertStatus(201)
            ->assertJsonPath('data.trusted', true);

        $mockResponse = $this->postJson('/api/v1/location/ping', [
            'latitude' => -7.250445,
            'longitude' => 112.768845,
            'accuracy' => 5,
            'recorded_at' => now()->toISOString(),
            'is_mock_location' => true,
        ]);

        $mockResponse->assertStatus(201)
            ->assertJsonPath('data.trusted', false)
            ->assertJsonPath('data.is_mock_location', true);

        $teleportResponse = $this->postJson('/api/v1/location/ping', [
            'latitude' => -7.250445,
            'longitude' => 112.768845,
            'accuracy' => 5,
            'recorded_at' => now()->toISOString(),
            'is_mock_location' => false,
        ]);

        $teleportResponse->assertStatus(201)
            ->assertJsonPath('data.trusted', false)
            ->assertJsonPath('data.is_mock_location', true)
            ->assertJsonPath('data.integrity_reason', 'impossible_travel');

        $this->assertDatabaseHas('location_pings', [
            'user_id' => $this->salesUser->id,
            'is_mock_location' => 1,
        ]);

        $this->salesUser->refresh();
        $this->assertSame(-6.200000, round($this->salesUser->last_location->latitude, 6));
        $this->assertSame(106.816666, round($this->salesUser->last_location->longitude, 6));

        Sanctum::actingAs($this->adminUser);
        $liveResponse = $this->getJson('/api/v1/location/live');

        $liveResponse->assertStatus(200)
            ->assertJsonPath('data.users.0.location.latitude', -6.2)
            ->assertJsonPath('data.users.0.location.longitude', 106.816666)
            ->assertJsonPath('data.users.0.location.is_mock_location', false);
    }

    /** @test */
    public function it_scopes_live_locations_for_manager_and_spv()
    {
        $branchB = Team::create([
            'code' => 'TEST02',
            'name' => 'Test Team B',
            'area' => 'Test Area B',
            'location' => new Point(latitude: -6.210000, longitude: 106.830000),
            'is_active' => true,
        ]);

        $manager = User::create([
            'name' => 'Manager User',
            'email' => 'manager@example.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $manager->assignRole('manager');

        $spv = User::create([
            'name' => 'SPV User',
            'email' => 'spv@example.com',
            'password' => bcrypt('password'),
            'team_id' => $branchB->id,
            'is_active' => true,
        ]);
        $spv->assignRole('spv');

        Sanctum::actingAs($manager);
        $managerResponse = $this->getJson('/api/v1/location/live');

        $managerResponse->assertStatus(200);
        $this->assertSame('manager', $managerResponse->json('data.scope.role'));
        $this->assertCount(2, $managerResponse->json('data.branches'));
        $managerBranchIds = collect($managerResponse->json('data.branches'))->pluck('id')->all();
        $this->assertContains($this->team->id, $managerBranchIds);
        $this->assertContains($branchB->id, $managerBranchIds);

        Sanctum::actingAs($spv);
        $spvResponse = $this->getJson('/api/v1/location/live');

        $spvResponse->assertStatus(200);
        $this->assertSame('spv', $spvResponse->json('data.scope.role'));
        $this->assertCount(1, $spvResponse->json('data.branches'));
        $this->assertSame($branchB->id, $spvResponse->json('data.branches.0.id'));
    }
}
