<?php

namespace Tests\Feature;

use App\Models\DailyTarget;
use App\Models\LocationPing;
use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CrmWebTest extends TestCase
{
    use RefreshDatabase;

    private Team $branchA;
    private Team $branchB;
    private User $manager;
    private User $adminA;
    private User $salesA;
    private User $salesB;
    private Store $storeA;
    private Store $storeB;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['manager', 'admin', 'sales', 'spv', 'superadmin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $this->branchA = Team::create([
            'code' => 'CRM-A',
            'name' => 'Cabang A',
            'area' => 'Area A',
            'location' => new Point(latitude: -6.2, longitude: 106.8),
            'is_active' => true,
        ]);

        $this->branchB = Team::create([
            'code' => 'CRM-B',
            'name' => 'Cabang B',
            'area' => 'Area B',
            'location' => new Point(latitude: -7.2, longitude: 112.7),
            'is_active' => true,
        ]);

        $this->manager = $this->makeUser('Manager CRM', 'manager-crm@example.com');
        $this->manager->assignRole('manager');

        $this->adminA = $this->makeUser('Admin Cabang A', 'admin-a@example.com', $this->branchA->id);
        $this->adminA->assignRole('admin');

        $this->salesA = $this->makeUser('Sales A', 'sales-a@example.com', $this->branchA->id);
        $this->salesA->assignRole('sales');

        $this->salesB = $this->makeUser('Sales B', 'sales-b@example.com', $this->branchB->id);
        $this->salesB->assignRole('sales');

        $this->storeA = Store::create([
            'code' => 'STORE-A',
            'external_bp_code' => 'BP-A',
            'name' => 'Toko A',
            'address' => 'Jl. A',
            'area' => 'Area A',
            'branch' => 'Cabang A',
            'city' => 'Jakarta',
            'location' => new Point(latitude: -6.21, longitude: 106.81),
            'geofence_radius' => 50,
            'status' => 'active',
            'master_source' => 'sap_dummy',
        ]);

        $this->storeB = Store::create([
            'code' => 'STORE-B',
            'external_bp_code' => 'BP-B',
            'name' => 'Toko B',
            'address' => 'Jl. B',
            'area' => 'Area B',
            'branch' => 'Cabang B',
            'city' => 'Surabaya',
            'location' => new Point(latitude: -7.25, longitude: 112.75),
            'geofence_radius' => 50,
            'status' => 'active',
            'master_source' => 'sap_dummy',
        ]);

        $this->seedCrmActivity();
    }

    public function test_manager_can_open_crm_dashboard_across_branches(): void
    {
        $response = $this->actingAs($this->manager)
            ->get('/crm?date_from=2026-06-16&date_to=2026-06-16');

        $response->assertOk()
            ->assertSee('Sales Daily Dashboard', false)
            ->assertSee('Cabang A')
            ->assertSee('Cabang B')
            ->assertSee('Sales A')
            ->assertSee('Sales B')
            ->assertSee('Exception Audit')
            ->assertSee('fake GPS ping');
    }

    public function test_branch_admin_only_sees_own_branch_in_crm(): void
    {
        $response = $this->actingAs($this->adminA)
            ->get('/crm?date_from=2026-06-16&date_to=2026-06-16');

        $response->assertOk()
            ->assertSee('Cabang A')
            ->assertSee('Sales A')
            ->assertDontSee('Cabang B')
            ->assertDontSee('Sales B')
            ->assertDontSee('Toko B');
    }

    public function test_sales_user_cannot_access_crm_web(): void
    {
        $this->actingAs($this->salesA)
            ->get('/crm')
            ->assertForbidden();
    }

    private function makeUser(string $name, string $email, ?int $teamId = null): User
    {
        return User::create([
            'name' => $name,
            'username' => str_replace('@example.com', '', $email),
            'email' => $email,
            'password' => Hash::make('password'),
            'team_id' => $teamId,
            'is_active' => true,
        ]);
    }

    private function seedCrmActivity(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 16, 9, 0, 0, 'Asia/Jakarta'));

        DailyTarget::setTarget($this->salesA->id, '2026-06-16', 2, $this->adminA->id);
        DailyTarget::setTarget($this->salesB->id, '2026-06-16', 1, $this->manager->id);

        VisitLog::create([
            'user_id' => $this->salesA->id,
            'store_id' => $this->storeA->id,
            'visit_date' => '2026-06-16',
            'checkin_at' => Carbon::create(2026, 6, 16, 9, 15, 0, 'Asia/Jakarta'),
            'checkin_location' => new Point(latitude: -6.21, longitude: 106.81),
            'checkin_valid' => true,
            'is_mock_location' => false,
            'is_duplicate' => false,
            'counted_as_target' => true,
            'checkout_at' => Carbon::create(2026, 6, 16, 9, 35, 0, 'Asia/Jakarta'),
            'duration_minutes' => 20,
            'visit_result' => 'order_taken',
        ]);

        VisitLog::create([
            'user_id' => $this->salesA->id,
            'store_id' => $this->storeA->id,
            'visit_date' => '2026-06-16',
            'checkin_at' => Carbon::create(2026, 6, 16, 10, 15, 0, 'Asia/Jakarta'),
            'checkin_location' => new Point(latitude: -6.5, longitude: 106.5),
            'checkin_valid' => false,
            'is_mock_location' => true,
            'is_duplicate' => true,
            'counted_as_target' => false,
            'duplicate_reason' => 'Toko sudah dikunjungi hari ini.',
            'visit_result' => 'no_order',
        ]);

        VisitLog::create([
            'user_id' => $this->salesB->id,
            'store_id' => $this->storeB->id,
            'visit_date' => '2026-06-16',
            'checkin_at' => Carbon::create(2026, 6, 16, 11, 0, 0, 'Asia/Jakarta'),
            'checkin_location' => new Point(latitude: -7.25, longitude: 112.75),
            'checkin_valid' => true,
            'is_mock_location' => false,
            'is_duplicate' => false,
            'counted_as_target' => true,
            'checkout_at' => Carbon::create(2026, 6, 16, 11, 18, 0, 'Asia/Jakarta'),
            'duration_minutes' => 18,
            'visit_result' => 'closed',
        ]);

        LocationPing::create([
            'user_id' => $this->salesA->id,
            'location' => new Point(latitude: -6.5, longitude: 106.5),
            'accuracy' => 5,
            'is_moving' => false,
            'is_mock_location' => true,
            'recorded_at' => Carbon::create(2026, 6, 16, 10, 10, 0, 'Asia/Jakarta'),
        ]);

        Carbon::setTestNow();
    }
}
