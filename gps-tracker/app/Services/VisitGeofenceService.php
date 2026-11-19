<?php

namespace App\Services;

use App\Models\Store;
use App\Models\VisitLog;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitGeofenceService
{
    public function effectiveRadius(?Store $store): int
    {
        $radius = (int) ($store?->geofence_radius ?: 50);

        return min(50, max(1, $radius));
    }

    public function distanceMeters(Point $a, Point $b): float
    {
        $lat = deg2rad($b->latitude - $a->latitude);
        $lon = deg2rad($b->longitude - $a->longitude);
        $h = sin($lat / 2) ** 2
            + cos(deg2rad($a->latitude)) * cos(deg2rad($b->latitude)) * sin($lon / 2) ** 2;

        return 6371000 * 2 * atan2(sqrt($h), sqrt(max(0, 1 - $h)));
    }

    /** @return array{center:?Point,radius_meters:int,distance_meters:?float,source:string,status:string,reject:bool,countable:bool} */
    public function startDecision(
        Store $store,
        Point $gps,
        ?float $accuracy,
        bool $offlineSync,
        ?array $capturedReference,
    ): array {
        $radius = $this->effectiveRadius($store);
        $center = $store->location instanceof Point ? $store->location : null;
        $distance = $center ? $this->distanceMeters($center, $gps) : null;
        $source = $center ? 'store' : 'none';

        if ($offlineSync && $this->referenceChanged($center, $radius, $capturedReference)) {
            $status = 'reference_changed';
        } elseif ($center) {
            $status = $accuracy === null || $accuracy > $radius
                ? 'uncertain'
                : ($distance <= $radius ? 'inside_radius' : 'outside_radius');
        } elseif ($accuracy !== null && $accuracy <= 25) {
            $center = $gps;
            $source = 'initial_checkin';
            $status = 'initial_reference';
        } else {
            $status = 'uncertain';
        }

        return [
            'center' => $center,
            'radius_meters' => $radius,
            'distance_meters' => $distance === null ? null : round($distance, 2),
            'source' => $source,
            'status' => $status,
            'reject' => ! $offlineSync && $center instanceof Point && ! in_array($status, ['inside_radius', 'initial_reference'], true),
            // Preserve the pilot's historical target decision for an unknown
            // customer with a poor first point; it cannot seed the master.
            'countable' => in_array($status, ['inside_radius', 'initial_reference'], true)
                || ($center === null && $status === 'uncertain' && ! $offlineSync),
        ];
    }

    /** @return array{distance_meters:?float,status:string} */
    public function checkoutDecision(VisitLog $visit, Point $gps, ?float $accuracy): array
    {
        $center = $visit->geofence_center;
        if (! $center instanceof Point) {
            return ['distance_meters' => null, 'status' => $visit->checkin_radius_status ? 'uncertain' : 'legacy_unverified'];
        }

        $distance = $this->distanceMeters($center, $gps);
        $radius = (int) ($visit->geofence_radius_meters ?: 50);
        $status = $accuracy === null || $accuracy > $radius
            ? 'uncertain'
            : ($distance <= $radius ? 'inside_radius' : 'outside_radius');

        return ['distance_meters' => round($distance, 2), 'status' => $status];
    }

    private function referenceChanged(?Point $center, int $radius, ?array $reference): bool
    {
        if ($reference === null) {
            return false; // Older offline clients did not send a snapshot.
        }

        $capturedHasLocation = (bool) ($reference['has_location'] ?? false);
        if ($capturedHasLocation !== ($center instanceof Point)) {
            return true;
        }

        if ((int) ($reference['radius'] ?? $radius) !== $radius) {
            return true;
        }

        if (! $capturedHasLocation) {
            return false;
        }

        if (! is_numeric($reference['latitude'] ?? null) || ! is_numeric($reference['longitude'] ?? null)) {
            return true;
        }

        return $this->distanceMeters($center, new Point(
            (float) $reference['latitude'],
            (float) $reference['longitude'],
        )) > 5;
    }
}
