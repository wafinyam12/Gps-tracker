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
            Role::firstOrCreate(['name' => 'sales', 'guard_name' => $guard]);
            Role::firstOrCreate(['name' => 'spv', 'guard_name' => $guard]);
        }

        $this->team = Team::create([
            'code' => 'TEST01',
            'name' => 'Test Team',
            'area' => 'Test Area',
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
                '*' => ['id', 'name', 'email', 'is_active', 'role', 'team']
            ],
            'links', 'meta'
        ]);
    }

    /** @test */
    public function it_can_create_a_team_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->postJson('/api/v1/teams', [
            'code' => 'TEST02',
            'name' => 'Another Team',
            'area' => 'Test Area 2',
            'is_active' => true,
        ]);
        $response->assertStatus(201);
    }

    /** @test */
    public function it_can_fetch_teams_as_admin()
    {
        Sanctum::actingAs($this->adminUser);
        $response = $this->getJson('/api/v1/teams');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'data' => [
                'data' => [
                    '*' => ['id', 'name', 'code', 'area', 'is_active', 'members_count']
                ]
            ]
        ]);
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
                '*' => ['user_id', 'name', 'location', 'is_online']
            ]
        ]);
    }
}
