<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\Team;
use App\Models\LocationPing;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use MatanYadaev\EloquentSpatial\Objects\Point;

class ApiTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    protected $adminUser;
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
    public function it_can_create_a_team_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->postJson('/api/v1/teams', [
            'code' => 'TEST02',
            'name' => 'Another Team',
            'area' => 'Test Area 2',
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
    public function it_can_fetch_teams_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->getJson('/api/v1/teams');
        $response->assertStatus(200);

        $payload = $response->json('data');
        $teams = is_array($payload) && array_key_exists('data', $payload) && is_array($payload['data'])
            ? $payload['data']
            : $payload;

        $this->assertIsArray($teams);
        $this->assertNotEmpty($teams);
        $this->assertArrayHasKey('id', $teams[0]);
        $this->assertArrayHasKey('name', $teams[0]);
        $this->assertArrayHasKey('code', $teams[0]);
        $this->assertArrayHasKey('latitude', $teams[0]);
        $this->assertArrayHasKey('longitude', $teams[0]);
        $this->assertArrayHasKey('location', $teams[0]);
        $this->assertArrayHasKey('has_location', $teams[0]);
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
