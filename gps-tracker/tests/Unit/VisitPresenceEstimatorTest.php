<?php

namespace Tests\Unit;

use App\Services\VisitPresenceEstimator;
use Carbon\Carbon;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Tests\TestCase;

class VisitPresenceEstimatorTest extends TestCase
{
    public function test_two_consistent_inside_samples_count_only_the_covered_interval(): void
    {
        $estimator = new VisitPresenceEstimator;
        $start = Carbon::parse('2026-11-17T09:00:00+07:00');
        $end = Carbon::parse('2026-11-17T09:05:00+07:00');

        $summary = $estimator->summarize($start, $end, new Point(-6.2, 106.8), 50, [
            $this->sample('09:00:00', -6.2, 106.8, 10),
            $this->sample('09:01:00', -6.2, 106.8, 10),
            $this->sample('09:02:00', -6.2, 106.8, 10),
            $this->sample('09:05:00', -6.2, 106.8, 10),
        ]);

        $this->assertSame(120, $summary['inside_seconds']);
        $this->assertSame(0, $summary['outside_seconds']);
        $this->assertSame(180, $summary['unmeasured_seconds']);
    }

    public function test_transition_and_noisy_accuracy_are_unmeasured(): void
    {
        $estimator = new VisitPresenceEstimator;
        $start = Carbon::parse('2026-11-17T09:00:00+07:00');
        $end = Carbon::parse('2026-11-17T09:04:00+07:00');

        $summary = $estimator->summarize($start, $end, new Point(-6.2, 106.8), 50, [
            $this->sample('09:00:00', -6.2, 106.8, 10),
            $this->sample('09:01:00', -6.2, 106.8, 60),
            $this->sample('09:02:00', -6.1988, 106.8, 10),
            $this->sample('09:03:00', -6.1988, 106.8, 10),
            $this->sample('09:04:00', -6.1988, 106.8, 10),
        ]);

        $this->assertSame(0, $summary['inside_seconds']);
        $this->assertSame(120, $summary['outside_seconds']);
        $this->assertSame(120, $summary['unmeasured_seconds']);
    }

    public function test_no_samples_leave_the_entire_session_unmeasured(): void
    {
        $summary = (new VisitPresenceEstimator)->summarize(
            Carbon::parse('2026-11-17T09:00:00+07:00'),
            Carbon::parse('2026-11-17T09:45:00+07:00'),
            new Point(-6.2, 106.8), 50, [],
        );

        $this->assertSame(0, $summary['inside_seconds']);
        $this->assertSame(2700, $summary['unmeasured_seconds']);
    }

    private function sample(string $time, float $latitude, float $longitude, float $accuracy): array
    {
        return [
            'recorded_at' => Carbon::parse("2026-11-17T{$time}+07:00"),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
        ];
    }
}
