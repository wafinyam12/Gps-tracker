<?php

namespace App\Support;

use App\Models\VisitLog;

class VisitAuditFormatter
{
    public static function summary(VisitLog $visit): array
    {
        return [
            'checkin_radius_status' => $visit->checkin_radius_status ?? 'legacy_unverified',
            'checkout_radius_status' => $visit->checkout_radius_status ?? 'legacy_unverified',
            'duration_verification_status' => $visit->duration_verification_status ?? 'legacy_unverified',
            'presence' => [
                'inside_seconds' => $visit->inside_radius_seconds,
                'outside_seconds' => $visit->outside_radius_seconds,
                'unmeasured_seconds' => $visit->unmeasured_seconds,
                'status' => $visit->presence_status ?? 'legacy_unverified',
            ],
        ];
    }

    public static function detail(VisitLog $visit): array
    {
        return self::summary($visit) + [
            'geofence_radius_meters' => $visit->geofence_radius_meters,
            'geofence_reference_source' => $visit->geofence_reference_source,
            'geofence_center_latitude' => $visit->geofence_center?->latitude,
            'geofence_center_longitude' => $visit->geofence_center?->longitude,
            'checkout_latitude' => $visit->checkout_location?->latitude,
            'checkout_longitude' => $visit->checkout_location?->longitude,
            'checkout_accuracy' => $visit->checkout_accuracy,
            'checkout_distance' => $visit->checkout_distance,
        ];
    }
}
