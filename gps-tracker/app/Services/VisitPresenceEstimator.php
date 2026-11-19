<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPresenceEstimator
{
    public function __construct(private readonly VisitGeofenceService $geofence = new VisitGeofenceService)
    {
    }

    /**
     * Count only intervals bounded by two matching, trustworthy points no
     * farther than 150 seconds apart. A long gap is never extrapolated.
     *
     * @param array<int,array{recorded_at:CarbonInterface|string,latitude:float,longitude:float,accuracy:float|null}> $samples
     * @return array{inside_seconds:int,outside_seconds:int,unmeasured_seconds:int,session_seconds:int}
     */
    public function summarize(
        CarbonInterface $checkinAt,
        CarbonInterface $checkoutAt,
        ?Point $center,
        int $radiusMeters,
        array $samples,
    ): array {
        $start = $checkinAt->timestamp;
        $end = $checkoutAt->timestamp;
        $session = max(0, $end - $start);
        $result = [
            'inside_seconds' => 0,
            'outside_seconds' => 0,
            'unmeasured_seconds' => $session,
            'session_seconds' => $session,
        ];

        if ($session === 0 || ! $center) {
            return $result;
        }

        $points = [];
        foreach ($samples as $sample) {
            $at = $sample['recorded_at'] instanceof CarbonInterface
                ? $sample['recorded_at']->timestamp
                : Carbon::parse($sample['recorded_at'])->timestamp;
            if ($at < $start || $at > $end) {
                continue;
            }

            $status = $this->classify($center, $radiusMeters,
                (float) $sample['latitude'], (float) $sample['longitude'], $sample['accuracy'] ?? null,
            )['status'];
            $points[] = ['at' => $at, 'status' => $status];
        }

        usort($points, fn (array $a, array $b) => $a['at'] <=> $b['at']);
        for ($i = 1, $count = count($points); $i < $count; $i++) {
            $seconds = $points[$i]['at'] - $points[$i - 1]['at'];
            if ($seconds <= 0 || $seconds > 150 || $points[$i]['status'] !== $points[$i - 1]['status']) {
                continue;
            }
            if ($points[$i]['status'] === 'inside') {
                $result['inside_seconds'] += $seconds;
            } elseif ($points[$i]['status'] === 'outside') {
                $result['outside_seconds'] += $seconds;
            }
        }

        $result['unmeasured_seconds'] = $session - $result['inside_seconds'] - $result['outside_seconds'];

        return $result;
    }

    /** @return array{status:string,distance_meters:?float} */
    public function classify(?Point $center, int $radiusMeters, float $latitude, float $longitude, ?float $accuracy): array
    {
        if (! $center) {
            return ['status' => 'uncertain', 'distance_meters' => null];
        }

        $distance = $this->geofence->distanceMeters($center, new Point($latitude, $longitude));
        $status = 'uncertain';
        if ($accuracy !== null && $accuracy >= 0 && $accuracy <= 300) {
            if ($distance + $accuracy <= $radiusMeters) {
                $status = 'inside';
            } elseif ($distance - $accuracy > $radiusMeters) {
                $status = 'outside';
            }
        }

        return ['status' => $status, 'distance_meters' => round($distance, 2)];
    }
}
