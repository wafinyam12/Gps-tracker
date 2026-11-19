<?php

namespace Tests\Unit;

use App\Models\Store;
use App\Models\VisitLog;
use App\Services\VisitGeofenceService;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Tests\TestCase;

class VisitGeofenceServiceTest extends TestCase
{
    public function test_known_customer_requires_an_accurate_point_within_its_radius(): void
    {
        $store = new Store(['geofence_radius' => 50]);
        $store->location = new Point(-6.2, 106.8);
        $service = new VisitGeofenceService;

        $inside = $service->startDecision($store, new Point(-6.2, 106.8), 15, false, null);
        $this->assertSame('inside_radius', $inside['status']);
        $this->assertFalse($inside['reject']);
        $this->assertTrue($inside['countable']);
        $this->assertSame(50, $inside['radius_meters']);

        $outside = $service->startDecision($store, new Point(-6.1988, 106.8), 10, false, null);
        $this->assertSame('outside_radius', $outside['status']);
        $this->assertTrue($outside['reject']);

        $weak = $service->startDecision($store, new Point(-6.2, 106.8), 55, false, null);
        $this->assertSame('uncertain', $weak['status']);
        $this->assertTrue($weak['reject']);
    }

    public function test_unknown_customer_uses_only_a_good_first_point_as_provisional_center(): void
    {
        $service = new VisitGeofenceService;
        $store = new Store(['geofence_radius' => 50]);

        $good = $service->startDecision($store, new Point(0, 0), 25, false, null);
        $this->assertSame('initial_reference', $good['status']);
        $this->assertSame('initial_checkin', $good['source']);
        $this->assertSame(0.0, $good['center']->latitude);

        $poor = $service->startDecision($store, new Point(0, 0), 26, false, null);
        $this->assertSame('uncertain', $poor['status']);
        $this->assertNull($poor['center']);
        $this->assertTrue($poor['countable']);
    }

    public function test_changed_offline_reference_remains_reviewable_without_target_count(): void
    {
        $service = new VisitGeofenceService;
        $store = new Store(['geofence_radius' => 50]);
        $store->location = new Point(-6.2, 106.8);

        $decision = $service->startDecision($store, new Point(-6.2, 106.8), 10, true, [
            'latitude' => -6.3,
            'longitude' => 106.8,
            'radius' => 50,
            'has_location' => true,
        ]);

        $this->assertSame('reference_changed', $decision['status']);
        $this->assertFalse($decision['reject']);
        $this->assertFalse($decision['countable']);
    }

    public function test_checkout_uses_visit_snapshot_and_reports_outside_or_uncertain(): void
    {
        $service = new VisitGeofenceService;
        $visit = new VisitLog(['geofence_radius_meters' => 50]);
        $visit->geofence_center = new Point(-6.2, 106.8);

        $outside = $service->checkoutDecision($visit, new Point(-6.1988, 106.8), 10);
        $this->assertSame('outside_radius', $outside['status']);
        $this->assertGreaterThan(100, $outside['distance_meters']);

        $weak = $service->checkoutDecision($visit, new Point(-6.2, 106.8), 80);
        $this->assertSame('uncertain', $weak['status']);
    }
}
