<?php

namespace Tests\Feature;

use App\Models\Store;
use App\Models\User;
use App\Models\VisitLocationSample;
use App\Models\VisitLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitSampleRetentionTest extends TestCase
{
    use RefreshDatabase;

    public function test_pruning_removes_only_old_raw_samples_and_keeps_visit_summary(): void
    {
        $sales = User::factory()->create();
        $store = Store::create([
            'code' => 'RETENTION-01', 'external_bp_code' => 'RETENTION-01',
            'name' => 'Retention', 'status' => 'active', 'master_source' => 'sap_dummy',
        ]);
        $visit = VisitLog::create([
            'user_id' => $sales->id, 'store_id' => $store->id,
            'visit_date' => now()->toDateString(), 'inside_radius_seconds' => 180,
            'outside_radius_seconds' => 0, 'unmeasured_seconds' => 60,
            'presence_status' => 'complete',
        ]);
        foreach ([31, 1] as $days) {
            $sample = VisitLocationSample::create([
                'visit_log_id' => $visit->id,
                'client_uuid' => sprintf('12345678-1234-4123-8123-%012d', $days),
                'latitude' => -6.2, 'longitude' => 106.8, 'accuracy' => 10,
                'recorded_at' => now()->subDays($days), 'classification' => 'inside',
            ]);
            $sample->created_at = now()->subDays($days);
            $sample->save();
        }

        $this->artisan('visits:prune-location-samples')->assertSuccessful();
        $this->assertDatabaseCount('visit_location_samples', 1);
        $this->assertSame(180, (int) $visit->fresh()->inside_radius_seconds);
    }
}
