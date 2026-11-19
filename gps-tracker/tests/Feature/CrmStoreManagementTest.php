<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\SapCoordinateSync;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Services\Stores\StoreCoordinateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Pagination\LengthAwarePaginator;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CrmStoreManagementTest extends TestCase
{
    use RefreshDatabase;

    private Team $branchA;
    private Team $branchB;
    private User $admin;
    private User $manager;
    private User $spv;
    private User $superadmin;
    private Store $storeA;
    private Store $storeB;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['admin', 'manager', 'spv', 'superadmin'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $this->branchA = $this->team('CRM-COORD-A');
        $this->branchB = $this->team('CRM-COORD-B');
        $this->admin = $this->user('admin', $this->branchA);
        $this->manager = $this->user('manager');
        $this->spv = $this->user('spv', $this->branchA);
        $this->superadmin = $this->user('superadmin');
        $this->storeA = $this->store('BP-A', 'Toko A', $this->branchA);
        $this->storeB = $this->store('BP-B', 'Toko B', $this->branchB);
    }

    public function test_list_searches_all_master_stores_without_a_dashboard_date_filter_and_scopes_branch(): void
    {
        $this->actingAs($this->admin)
            ->get('/crm/stores?q=BP-A')
            ->assertOk()
            ->assertViewHas('stores', fn ($stores) => $stores instanceof LengthAwarePaginator
                && $stores->total() === 1
                && $stores->first()->id === $this->storeA->id);

        $this->get('/crm/stores')
            ->assertOk()
            ->assertViewHas('stores', fn ($stores) => $stores->total() === 1);

        $this->actingAs($this->manager)
            ->get('/crm/stores')
            ->assertOk()
            ->assertViewHas('stores', fn ($stores) => $stores->total() === 2);
    }

    public function test_branch_scope_applies_to_detail_and_update_even_with_a_direct_url(): void
    {
        $payload = $this->payload();

        $this->actingAs($this->admin)
            ->get('/crm/stores/'.$this->storeB->id)
            ->assertNotFound();
        $this->patch('/crm/stores/'.$this->storeB->id, $payload)
            ->assertNotFound();
        $this->assertNull($this->storeB->fresh()->location);

        $this->actingAs($this->spv)
            ->get('/crm/stores/'.$this->storeA->id)
            ->assertOk()
            ->assertViewHas('canEdit', false);
        $this->actingAs($this->manager)
            ->patch('/crm/stores/'.$this->storeA->id, $payload)
            ->assertForbidden();
        $this->actingAs($this->spv)
            ->patch('/crm/stores/'.$this->storeA->id, $payload)
            ->assertForbidden();
    }

    public function test_admin_can_save_manual_coordinate_and_superadmin_can_edit_another_branch(): void
    {
        $this->actingAs($this->admin)
            ->patch('/crm/stores/'.$this->storeA->id, $this->payload())
            ->assertRedirect('/crm/stores/'.$this->storeA->id);

        $this->assertEqualsWithDelta(-7.973899, $this->storeA->fresh()->location->latitude, 0.000001);
        $this->assertSame(30, (int) $this->storeA->fresh()->geofence_radius);
        $this->assertDatabaseHas('store_coordinate_changes', [
            'store_id' => $this->storeA->id,
            'actor_user_id' => $this->admin->id,
            'source' => 'crm_manual',
        ]);

        $this->actingAs($this->superadmin)
            ->patch('/crm/stores/'.$this->storeB->id, $this->payload())
            ->assertRedirect('/crm/stores/'.$this->storeB->id);
        $this->assertNotNull($this->storeB->fresh()->location);
    }

    public function test_invalid_coordinate_radius_and_reason_cannot_change_store(): void
    {
        $this->actingAs($this->admin);

        foreach ([
            ['latitude' => 91],
            ['longitude' => 181],
            ['geofence_radius' => 51],
            ['geofence_radius' => 0],
            ['reason' => 'singkat'],
        ] as $invalid) {
            $this->patch('/crm/stores/'.$this->storeA->id, array_replace($this->payload(), $invalid))
                ->assertSessionHasErrors(array_key_first($invalid));
        }

        $this->assertNull($this->storeA->fresh()->location);
        $this->assertDatabaseCount('store_coordinate_changes', 0);
    }

    public function test_photo_must_belong_to_the_same_store_and_have_a_location(): void
    {
        $photo = $this->photoFor($this->storeB, new Point(-7.9, 112.7));
        $this->actingAs($this->admin)
            ->patch('/crm/stores/'.$this->storeA->id, $this->payload() + ['photo_id' => $photo->id])
            ->assertSessionHasErrors('photo_id');

        $withoutPoint = $this->photoFor($this->storeA, null);
        $this->patch('/crm/stores/'.$this->storeA->id, $this->payload() + ['photo_id' => $withoutPoint->id])
            ->assertSessionHasErrors('photo_id');

        $this->assertNull($this->storeA->fresh()->location);
        $this->assertDatabaseCount('store_coordinate_changes', 0);
    }

    public function test_master_store_pages_show_unvisited_store_and_link_from_dashboard(): void
    {
        $this->actingAs($this->admin)
            ->get('/crm/stores')
            ->assertOk()
            ->assertSee('Toko A')
            ->assertSee('BP-A')
            ->assertSee('Belum ada koordinat');

        $this->get('/crm')
            ->assertOk()
            ->assertSee('Master Toko')
            ->assertSee(route('crm.stores.index'), false);
    }

    public function test_detail_shows_photo_candidate_manual_history_and_sap_status(): void
    {
        $photo = $this->photoFor($this->storeA, new Point(-7.973899, 112.748395));
        app(StoreCoordinateService::class)->setManual(
            $this->storeA, $this->admin, $photo->location, 30,
            'Foto tampak depan diperiksa admin.', $photo,
        );
        SapCoordinateSync::create([
            'team_id' => $this->branchA->id,
            'store_id' => $this->storeA->id,
            'db_sap' => 'TEST',
            'cardcode' => 'BP-A',
            'latitude' => -7.973899,
            'longitude' => 112.748395,
            'source' => 'visit_observation',
            'status' => 'no_change',
        ]);

        $this->actingAs($this->admin)
            ->get('/crm/stores/'.$this->storeA->id)
            ->assertOk()
            ->assertSee('-7.973899')
            ->assertSee('Akurasi GPS foto lama tidak tersedia')
            ->assertSee('Gunakan titik foto')
            ->assertSee('Foto tampak depan diperiksa admin.')
            ->assertSee('no_change')
            ->assertSee('name="latitude"', false)
            ->assertSee('Simpan Koreksi');
    }

    public function test_manager_can_review_master_without_an_edit_form(): void
    {
        $this->actingAs($this->manager)
            ->get('/crm/stores/'.$this->storeA->id)
            ->assertOk()
            ->assertSee('Titik master')
            ->assertDontSee('Simpan Koreksi')
            ->assertDontSee('name="latitude"', false);
    }

    private function payload(): array
    {
        return [
            'latitude' => -7.973899,
            'longitude' => 112.748395,
            'geofence_radius' => 30,
            'reason' => 'Titik diperiksa dari foto depan toko.',
        ];
    }

    private function team(string $code): Team
    {
        return Team::create([
            'code' => $code,
            'name' => $code,
            'location' => new Point(-7.9, 112.7),
            'is_active' => true,
        ]);
    }

    private function user(string $role, ?Team $team = null): User
    {
        $user = User::factory()->create(['team_id' => $team?->id]);
        $user->assignRole($role);

        return $user;
    }

    private function store(string $code, string $name, Team $team): Store
    {
        return Store::create([
            'team_id' => $team->id,
            'code' => $code,
            'external_bp_code' => $code,
            'name' => $name,
            'status' => 'active',
            'master_source' => 'sap_outstanding_receivable',
            'geofence_radius' => 50,
            'location' => null,
        ]);
    }

    private function photoFor(Store $store, ?Point $point): VisitPhoto
    {
        $visit = VisitLog::create([
            'store_id' => $store->id,
            'user_id' => $this->admin->id,
            'checkin_at' => now(),
        ]);

        return VisitPhoto::create([
            'visit_log_id' => $visit->id,
            'path' => 'visits/evidence.jpg',
            'type' => 'other',
            'location' => $point,
        ]);
    }
}
