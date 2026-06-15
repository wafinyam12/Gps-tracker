<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Store;
use App\Models\VisitSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;

class CoreApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup Role
        Role::create(['name' => 'sales']);
        Role::create(['name' => 'admin']);
    }

    public function test_user_can_login()
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
                    'user'
                ]
            ]);
    }

    public function test_sales_can_ping_location()
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/location/ping', [
                'latitude' => -6.200000,
                'longitude' => 106.816666,
                'accuracy' => 10,
                'speed' => 0,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Location recorded.'
            ]);

        $this->assertDatabaseHas('location_pings', [
            'user_id' => $user->id,
            'accuracy' => 10,
        ]);
    }

    public function test_sales_can_checkin_at_store()
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('sales');
        $token = $user->createToken('test')->plainTextToken;

        $store = Store::create([
            'code' => 'STORE001',
            'name' => 'Test Store',
            'location' => new Point(-6.200000, 106.816666),
            'geofence_radius' => 100,
            'status' => 'active',
        ]);

        $schedule = VisitSchedule::create([
            'user_id' => $user->id,
            'store_id' => $store->id,
            'visit_date' => today(),
            'sequence' => 1,
            'status' => 'pending',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/visit/checkin', [
                'visit_schedule_id' => $schedule->id,
                'latitude' => -6.200000,
                'longitude' => 106.816666,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertEquals('in_progress', $schedule->fresh()->status);
    }
}
