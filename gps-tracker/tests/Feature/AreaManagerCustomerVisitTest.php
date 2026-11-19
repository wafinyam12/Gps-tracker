<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AreaManagerCustomerVisitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['web', 'sanctum'] as $guard) {
            foreach (['sales', 'spv'] as $role) {
                Role::firstOrCreate(['name' => $role, 'guard_name' => $guard]);
            }
        }

        Http::preventStrayRequests();
    }

    private function branch(string $code): Team
    {
        return Team::create([
            'code' => $code,
            'name' => 'Cabang '.$code,
            'area' => 'Jakarta',
            'db_sap' => 'SAP_'.$code,
            'is_active' => true,
        ]);
    }

    private function user(string $role, ?Team $branch, ?string $salesCode = null, bool $active = true): User
    {
        $user = User::factory()->create([
            'team_id' => $branch?->id,
            'slpCode' => $salesCode,
            'is_active' => $active,
        ]);
        $user->assignRole($role);

        return $user;
    }

    private function customer(string $code, ?Team $branch, ?string $salesCode, string $source = 'sap_outstanding_receivable'): Store
    {
        return Store::create([
            'team_id' => $branch?->id,
            'code' => $code,
            'external_bp_code' => $code,
            'sap_slp_code' => $salesCode,
            'name' => 'Customer '.$code,
            'status' => 'active',
            'master_source' => $source,
            'geofence_radius' => 50,
            'location' => new Point(-6.2, 106.8),
        ]);
    }

    public function test_area_manager_lists_only_customers_of_active_sales_in_own_branch(): void
    {
        $own = $this->branch('OWN-01');
        $other = $this->branch('OTHER-01');
        $manager = $this->user('spv', $own);
        $owner47 = $this->user('sales', $own, '47');
        $owner47->update(['name' => 'Sales Satu']);
        $secondOwner47 = $this->user('sales', $own, '47');
        $secondOwner47->update(['name' => 'Sales Dua']);
        $owner48 = $this->user('sales', $own, '48');
        $owner48->update(['name' => 'Sales Tiga']);
        $this->user('sales', $own, '49', false);
        $this->user('spv', $own, '50');
        $outsideOwner = $this->user('sales', $other, '47');
        $outsideOwner->update(['name' => 'Sales Luar']);

        $first = $this->customer('OWN-47', $own, '47');
        $second = $this->customer('OWN-48', $own, '48');
        $this->customer('INACTIVE-49', $own, '49');
        $this->customer('NONSALES-50', $own, '50');
        $this->customer('UNMATCHED-047', $own, '047');
        $this->customer('OTHER-47', $other, '47');
        $this->customer('DUMMY', null, null, 'sap_dummy');

        $this->actingAs($manager, 'sanctum');

        $page = $this->getJson('/api/v1/stores/available?page=1&per_page=25')
            ->assertOk()
            ->assertJsonCount(2, 'data.items');
        $ownerLabel = $page->json('data.items.0.sales_owner_name');
        $this->assertIsString($ownerLabel);
        $this->assertStringContainsString('Sales Satu', $ownerLabel);
        $this->assertStringContainsString('Sales Dua', $ownerLabel);
        $this->assertStringNotContainsString('Sales Luar', $ownerLabel);
        $page->assertJsonPath('data.items.1.sales_owner_name', 'Sales Tiga');

        $plain = collect($this->getJson('/api/v1/stores/available')->assertOk()->json('data'));
        $this->assertSame($ownerLabel, $plain->firstWhere('external_bp_code', 'OWN-47')['sales_owner_name']);
        $codes = $plain
            ->pluck('external_bp_code')->all();
        $this->assertEqualsCanonicalizing([$first->external_bp_code, $second->external_bp_code], $codes);

        $this->getJson('/api/v1/stores/available?search=OWN-47')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $first->id);

        $this->getJson('/api/v1/stores/map-markers?south=-6.3&north=-6.1&west=106.7&east=106.9&zoom=15')
            ->assertOk()
            ->assertJsonPath('data.meta.visible_stores', 2);

        Http::assertNothingSent();
    }

    public function test_sales_customer_list_does_not_include_other_sales_owner_names(): void
    {
        $sales = $this->user('sales', null);

        $stores = $this->actingAs($sales, 'sanctum')
            ->getJson('/api/v1/stores/available')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($stores);
        $this->assertArrayNotHasKey('sales_owner_name', $stores[0]);
        Http::assertNothingSent();
    }

    public function test_area_manager_without_branch_has_no_customer_access(): void
    {
        $branch = $this->branch('OWN-01');
        $manager = $this->user('spv', null);
        $this->user('sales', $branch, '47');
        $customer = $this->customer('OWN-47', $branch, '47');

        $this->actingAs($manager, 'sanctum');
        $this->getJson('/api/v1/stores/available')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/visit/start', [
            'store_id' => $customer->id,
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 10,
        ])->assertStatus(422);
        $this->assertDatabaseCount('visit_logs', 0);
        Http::assertNothingSent();
    }

    public function test_area_manager_without_branch_cannot_read_other_branches_target_summary(): void
    {
        $branch = $this->branch('OTHER-01');
        $manager = $this->user('spv', null);
        $sales = $this->user('sales', $branch, '47');
        $customer = $this->customer('OTHER-47', $branch, '47');
        $date = now('Asia/Jakarta')->toDateString();
        VisitLog::create([
            'user_id' => $sales->id,
            'store_id' => $customer->id,
            'visit_date' => $date,
            'checkin_at' => now('Asia/Jakarta'),
            'checkin_valid' => true,
            'counted_as_target' => true,
        ]);

        $this->actingAs($manager, 'sanctum')
            ->getJson("/api/v1/target/summary?date_from={$date}&date_to={$date}&team_id={$branch->id}")
            ->assertOk()
            ->assertJsonPath('data.overview.total_sales', 0)
            ->assertJsonPath('data.overview.total_visits', 0);
    }

    public function test_area_manager_can_start_visit_to_own_sales_customer_without_changing_assignment(): void
    {
        $branch = $this->branch('OWN-01');
        $manager = $this->user('spv', $branch);
        $sales = $this->user('sales', $branch, '47');
        $customer = $this->customer('OWN-47', $branch, '47');

        $this->actingAs($manager, 'sanctum')->postJson('/api/v1/visit/start', [
            'store_id' => $customer->id,
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 10,
        ])->assertStatus(201)
            ->assertJsonPath('data.store.id', $customer->id);

        $visit = VisitLog::sole();
        $this->assertSame($manager->id, $visit->user_id);
        $this->assertSame($customer->id, $visit->store_id);
        $this->assertFalse($visit->counted_as_target);
        $this->assertSame('47', $customer->fresh()->sap_slp_code);
        $this->assertNotSame($sales->id, $visit->user_id);

        $this->postJson('/api/v1/visit/checkout', [
            'visit_log_id' => $visit->id,
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 10,
            'visit_result' => 'no_order',
        ])->assertOk()
            ->assertJsonPath('data.visit.counted_as_target', false);
        $this->assertNotNull($visit->fresh()->checkout_at);
        $this->assertSame('47', $customer->fresh()->sap_slp_code);
        Http::assertNothingSent();
    }

    public function test_area_manager_can_start_visit_by_customer_code(): void
    {
        $branch = $this->branch('OWN-01');
        $manager = $this->user('spv', $branch);
        $this->user('sales', $branch, '47');
        $customer = $this->customer('OWN-47', $branch, '47');

        $this->actingAs($manager, 'sanctum')->postJson('/api/v1/visit/start', [
            'external_bp_code' => 'OWN-47',
            'store_name' => 'Customer OWN-47',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'accuracy' => 10,
        ])->assertStatus(201)
            ->assertJsonPath('data.store.id', $customer->id);

        $this->assertSame($manager->id, VisitLog::sole()->user_id);
        Http::assertNothingSent();
    }

    public function test_area_manager_cannot_start_visit_for_other_branch_or_ineligible_sales(): void
    {
        $own = $this->branch('OWN-01');
        $other = $this->branch('OTHER-01');
        $manager = $this->user('spv', $own);
        $this->user('sales', $own, '47');
        $this->user('sales', $own, '49', false);
        $this->user('spv', $own, '50');
        $this->user('sales', $other, '47');
        $otherBranch = $this->customer('OTHER-47', $other, '47');
        $inactiveSales = $this->customer('INACTIVE-49', $own, '49');
        $nonSales = $this->customer('NONSALES-50', $own, '50');
        $dummy = $this->customer('DUMMY', null, null, 'sap_dummy');

        $this->actingAs($manager, 'sanctum');

        foreach ([$otherBranch, $inactiveSales, $nonSales, $dummy] as $customer) {
            $this->postJson('/api/v1/visit/start', [
                'store_id' => $customer->id,
                'latitude' => -6.2,
                'longitude' => 106.8,
                'accuracy' => 10,
            ])->assertStatus(422);

            $this->postJson('/api/v1/visit/start', [
                'external_bp_code' => $customer->external_bp_code,
                'store_name' => $customer->name,
                'latitude' => -6.2,
                'longitude' => 106.8,
                'accuracy' => 10,
            ])->assertStatus(422);
        }

        $this->assertDatabaseCount('visit_logs', 0);
        Http::assertNothingSent();
    }
}
