<?php

namespace Tests\Feature;

use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class TargetRangeApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['web', 'sanctum'] as $guard) {
            foreach (['sales', 'spv', 'admin', 'superadmin'] as $role) {
                Role::firstOrCreate(['name' => $role, 'guard_name' => $guard]);
            }
        }
    }

    private function branch(string $code): Team
    {
        return Team::create([
            'code' => $code,
            'name' => 'Cabang '.$code,
            'area' => 'Jakarta',
            'db_sap' => 'TEST_'.$code,
            'location' => new Point(latitude: -6.2, longitude: 106.8),
            'is_active' => true,
        ]);
    }

    private function account(string $role, ?Team $branch = null, bool $active = true): User
    {
        $user = User::factory()->create(['team_id' => $branch?->id, 'is_active' => $active]);
        $user->assignRole($role);
        return $user;
    }

    private function authenticate(User $user): void
    {
        $this->withHeader('Authorization', 'Bearer '.$user->createToken('target-range-test')->plainTextToken);
    }

    public function test_target_range_eligible_sales_is_limited_to_active_sales_in_the_area_managers_branch(): void
    {
        $own = $this->branch('OWN-01');
        $other = $this->branch('OTHER-01');
        $spv = $this->account('spv', $own);
        $eligible = $this->account('sales', $own);
        $this->account('sales', $own, false);
        $this->account('sales', $other);
        $this->account('spv', $own);
        $this->authenticate($spv);

        $this->getJson('/api/v1/target/eligible-sales')
            ->assertOk()
            ->assertJsonCount(1, 'data.sales')
            ->assertJsonPath('data.sales.0.id', $eligible->id);
    }

    public function test_target_range_selected_dates_are_inclusive_and_repeat_saves_overwrite_once(): void
    {
        $branch = $this->branch('SELECT-01');
        $spv = $this->account('spv', $branch);
        $sales = $this->account('sales', $branch);
        $this->authenticate($spv);
        $payload = [
            'selection' => 'selected',
            'user_ids' => [$sales->id],
            'date_from' => '2026-11-16',
            'date_to' => '2026-11-18',
            'target_visits' => 7,
        ];

        $this->postJson('/api/v1/target/range-set', $payload)
            ->assertStatus(201)
            ->assertJsonPath('data.sales_count', 1)
            ->assertJsonPath('data.days_count', 3)
            ->assertJsonPath('data.targets_written', 3);
        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $sales->id, 'target_date' => '2026-11-18', 'target_visits' => 7, 'set_by' => $spv->id,
        ]);

        $this->postJson('/api/v1/target/range-set', [...$payload, 'target_visits' => 9])->assertStatus(201);
        $this->assertSame(3, DB::table('daily_targets')->where('user_id', $sales->id)->count());
        $this->assertDatabaseHas('daily_targets', [
            'user_id' => $sales->id, 'target_date' => '2026-11-16', 'target_visits' => 9, 'set_by' => $spv->id,
        ]);
    }

    public function test_target_range_all_mode_uses_only_active_sales_in_own_branch(): void
    {
        $own = $this->branch('ALL-01');
        $other = $this->branch('ALL-02');
        $spv = $this->account('spv', $own);
        $salesA = $this->account('sales', $own);
        $salesB = $this->account('sales', $own);
        $inactive = $this->account('sales', $own, false);
        $outside = $this->account('sales', $other);
        $this->authenticate($spv);

        $this->postJson('/api/v1/target/range-set', [
            'selection' => 'all',
            'date_from' => '2026-11-17', 'date_to' => '2026-11-18', 'target_visits' => 4,
            'user_ids' => 'ignored-even-when-malformed',
        ])->assertStatus(201)
            ->assertJsonPath('data.sales_count', 2)
            ->assertJsonPath('data.days_count', 2)
            ->assertJsonPath('data.targets_written', 4);

        $this->assertSame(2, DB::table('daily_targets')->where('user_id', $salesA->id)->count());
        $this->assertSame(2, DB::table('daily_targets')->where('user_id', $salesB->id)->count());
        $this->assertSame(0, DB::table('daily_targets')->whereIn('user_id', [$inactive->id, $outside->id, $spv->id])->count());
    }

    public function test_target_range_rejects_cross_branch_and_non_sales_ids_before_any_write(): void
    {
        $own = $this->branch('GUARD-01');
        $other = $this->branch('GUARD-02');
        $spv = $this->account('spv', $own);
        $sales = $this->account('sales', $own);
        $outside = $this->account('sales', $other);
        $this->authenticate($spv);
        $payload = [
            'selection' => 'selected', 'date_from' => '2026-11-17', 'date_to' => '2026-11-18', 'target_visits' => 5,
        ];

        $this->postJson('/api/v1/target/range-set', [...$payload, 'user_ids' => [$sales->id, $outside->id]])->assertForbidden();
        $this->postJson('/api/v1/target/range-set', [...$payload, 'user_ids' => [$sales->id, $spv->id]])->assertForbidden();
        $this->assertDatabaseCount('daily_targets', 0);
    }

    public function test_target_range_rejects_invalid_range_and_values_without_writing(): void
    {
        $branch = $this->branch('VALID-01');
        $spv = $this->account('spv', $branch);
        $sales = $this->account('sales', $branch);
        $this->authenticate($spv);
        $payload = ['selection' => 'selected', 'user_ids' => [$sales->id], 'target_visits' => 5];

        $this->postJson('/api/v1/target/range-set', [...$payload, 'date_from' => '2026-11-18', 'date_to' => '2026-11-17'])->assertUnprocessable();
        $this->postJson('/api/v1/target/range-set', [...$payload, 'date_from' => '2026-11-01', 'date_to' => '2026-12-02'])->assertUnprocessable();
        $this->postJson('/api/v1/target/range-set', [...$payload, 'date_from' => '2026-11-17', 'date_to' => '2026-11-17', 'target_visits' => 0])->assertUnprocessable();
        $this->postJson('/api/v1/target/range-set', [...$payload, 'date_from' => '2026-11-17', 'date_to' => '2026-11-17', 'user_ids' => []])->assertUnprocessable();
        $this->assertDatabaseCount('daily_targets', 0);
    }

    public function test_target_range_old_set_endpoint_rejects_non_sales_in_same_branch(): void
    {
        $branch = $this->branch('OLD-01');
        $spv = $this->account('spv', $branch);
        $this->authenticate($spv);

        $this->postJson('/api/v1/target/set', [
            'user_id' => $spv->id, 'target_date' => '2026-11-17', 'target_visits' => 7,
        ])->assertForbidden();
        $this->assertDatabaseCount('daily_targets', 0);
    }

    public function test_target_range_requires_a_scoped_area_manager(): void
    {
        $branch = $this->branch('ROLE-01');
        $sales = $this->account('sales', $branch);
        $this->authenticate($sales);
        $this->getJson('/api/v1/target/eligible-sales')->assertForbidden();
        $this->postJson('/api/v1/target/range-set', [
            'selection' => 'all', 'date_from' => '2026-11-17', 'date_to' => '2026-11-17', 'target_visits' => 5,
        ])->assertForbidden();

        $unassignedSpv = $this->account('spv');
        $this->authenticate($unassignedSpv);
        $this->getJson('/api/v1/target/eligible-sales')->assertForbidden();
        $this->postJson('/api/v1/target/range-set', [
            'selection' => 'all', 'date_from' => '2026-11-17', 'date_to' => '2026-11-17', 'target_visits' => 5,
        ])->assertForbidden();
        $this->assertDatabaseCount('daily_targets', 0);
    }

    public function test_target_range_accepts_exactly_thirty_one_days(): void
    {
        $branch = $this->branch('DAYS-01');
        $spv = $this->account('spv', $branch);
        $sales = $this->account('sales', $branch);
        $this->authenticate($spv);

        $this->postJson('/api/v1/target/range-set', [
            'selection' => 'selected', 'user_ids' => [$sales->id],
            'date_from' => '2026-11-01', 'date_to' => '2026-12-01', 'target_visits' => 5,
        ])->assertStatus(201)->assertJsonPath('data.days_count', 31);
        $this->assertSame(31, DB::table('daily_targets')->where('user_id', $sales->id)->count());
    }
}
