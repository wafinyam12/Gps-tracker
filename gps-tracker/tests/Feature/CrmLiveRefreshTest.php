<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CrmLiveRefreshTest extends TestCase
{
    use RefreshDatabase;

    public function test_version_route_requires_crm_login_and_returns_token(): void
    {
        $this->get('/crm/live-version')->assertRedirect();

        Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->actingAs($manager)->get('/crm/live-version')
            ->assertOk()->assertJsonStructure(['version']);
    }

    public function test_version_changes_after_mobile_visit_photo_and_master_updates(): void
    {
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $team = Team::create([
            'code' => 'CRM-LIVE', 'name' => 'CRM Live',
            'location' => new Point(-7.9, 112.7), 'is_active' => true,
        ]);
        $admin = User::factory()->create(['team_id' => $team->id]);
        $admin->assignRole('admin');
        $store = Store::create([
            'team_id' => $team->id, 'code' => 'BP-LIVE', 'name' => 'Toko Live',
            'status' => 'active', 'geofence_radius' => 50,
        ]);
        $this->actingAs($admin);
        $first = $this->getJson('/crm/live-version')->json('version');

        $visit = VisitLog::create([
            'store_id' => $store->id, 'user_id' => $admin->id, 'checkin_at' => now(),
        ]);
        $second = $this->getJson('/crm/live-version')->json('version');
        $this->assertNotSame($first, $second);

        VisitPhoto::create([
            'visit_log_id' => $visit->id, 'path' => 'visits/live.jpg', 'type' => 'other',
        ]);
        $third = $this->getJson('/crm/live-version')->json('version');
        $this->assertNotSame($second, $third);

        $this->travel(1)->seconds();
        $store->update(['name' => 'Toko Live Diperbarui']);
        $fourth = $this->getJson('/crm/live-version')->json('version');
        $this->assertNotSame($third, $fourth);
    }

    public function test_crm_pages_include_live_refresh_markup(): void
    {
        Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager = User::factory()->create();
        $manager->assignRole('manager');

        $this->actingAs($manager)->get('/crm')
            ->assertOk()->assertSee('data-crm-live-root', false)
            ->assertSee('crm-live.js');
        $this->get('/crm/stores')
            ->assertOk()->assertSee('data-crm-live-root', false)
            ->assertSee('crm-live.js');
    }
}
