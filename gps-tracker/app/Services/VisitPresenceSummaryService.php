<?php

namespace App\Services;

use App\Models\VisitLog;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPresenceSummaryService
{
    public function __construct(private readonly VisitPresenceEstimator $estimator)
    {
    }

    public function recalculate(VisitLog $visit): void
    {
        if (! $visit->checkin_at || ! $visit->checkout_at) {
            $visit->presence_status = 'provisional';
            $visit->save();

            return;
        }

        if ($visit->checkout_at->timestamp < $visit->checkin_at->timestamp) {
            $visit->fill([
                'inside_radius_seconds' => null,
                'outside_radius_seconds' => null,
                'unmeasured_seconds' => null,
                'presence_status' => 'invalid_time',
            ])->save();

            return;
        }

        $samples = $visit->locationSamples()->orderBy('recorded_at')->orderBy('id')->get()
            ->map(fn ($sample) => [
                'recorded_at' => $sample->recorded_at,
                'latitude' => $sample->latitude,
                'longitude' => $sample->longitude,
                'accuracy' => $sample->accuracy,
            ])->all();

        if ($visit->checkin_location instanceof Point) {
            $samples[] = [
                'recorded_at' => $visit->checkin_at,
                'latitude' => $visit->checkin_location->latitude,
                'longitude' => $visit->checkin_location->longitude,
                'accuracy' => $visit->checkin_accuracy,
            ];
        }
        if ($visit->checkout_location instanceof Point) {
            $samples[] = [
                'recorded_at' => $visit->checkout_at,
                'latitude' => $visit->checkout_location->latitude,
                'longitude' => $visit->checkout_location->longitude,
                'accuracy' => $visit->checkout_accuracy,
            ];
        }

        $summary = $this->estimator->summarize(
            $visit->checkin_at, $visit->checkout_at, $visit->geofence_center,
            (int) ($visit->geofence_radius_meters ?: 50), $samples,
        );
        $visit->fill([
            'inside_radius_seconds' => $summary['inside_seconds'],
            'outside_radius_seconds' => $summary['outside_seconds'],
            'unmeasured_seconds' => $summary['unmeasured_seconds'],
            'presence_status' => $visit->samples_finalized_at ? 'complete' : 'provisional',
        ])->save();
    }

    public function response(VisitLog $visit): array
    {
        return [
            'inside_seconds' => $visit->inside_radius_seconds,
            'outside_seconds' => $visit->outside_radius_seconds,
            'unmeasured_seconds' => $visit->unmeasured_seconds,
            'status' => $visit->presence_status ?? 'legacy_unverified',
        ];
    }
}
