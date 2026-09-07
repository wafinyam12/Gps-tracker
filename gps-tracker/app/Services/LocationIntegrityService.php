<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use MatanYadaev\EloquentSpatial\Objects\Point;

class LocationIntegrityService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';
    private const MAX_VISIT_ACCURACY_METERS = 300;
    private const MAX_LOCATION_AGE_MINUTES = 5;
    private const MAX_LOCATION_FUTURE_SKEW_MINUTES = 1;
    private const MAX_TRUSTED_REFERENCE_AGE_MINUTES = 90;
    private const MAX_TRAVEL_SPEED_METERS_PER_SECOND = 45; // 162 km/h, deliberately generous.
    private const TELEPORT_DISTANCE_BUFFER_METERS = 500;

    public function visitLocationIntegrityError(Request $request, bool $allowStaleLocation = false): ?array
    {
        if ($request->boolean('is_mock_location', false)) {
            return $this->error(
                'mock_location',
                'Terdeteksi menggunakan fake GPS. Matikan mock location lalu ambil ulang lokasi.'
            );
        }

        $accuracy = $request->filled('accuracy') ? (float) $request->input('accuracy') : null;

        if ($accuracy !== null && $accuracy > self::MAX_VISIT_ACCURACY_METERS) {
            return $this->error(
                'low_accuracy',
                'Lokasi belum cukup akurat. Aktifkan GPS presisi lalu coba lagi.'
            );
        }

        $recordedAt = null;
        if ($request->filled('location_recorded_at')) {
            $recordedAt = Carbon::parse($request->input('location_recorded_at'))->setTimezone(self::LOCAL_TIMEZONE);
            $now = now(self::LOCAL_TIMEZONE);

            if ($recordedAt->gt($now->copy()->addMinutes(self::MAX_LOCATION_FUTURE_SKEW_MINUTES))) {
                return $this->error(
                    'future_location',
                    'Waktu lokasi perangkat tidak valid. Periksa jam perangkat lalu coba lagi.'
                );
            }

            if (! $allowStaleLocation && $recordedAt->lt($now->copy()->subMinutes(self::MAX_LOCATION_AGE_MINUTES))) {
                return $this->error(
                    'stale_location',
                    'Lokasi terlalu lama. Ambil ulang lokasi sebelum melanjutkan visit.'
                );
            }
        }

        return $this->impossibleTravelError(
            $request->user(),
            (float) $request->input('latitude'),
            (float) $request->input('longitude'),
            $accuracy,
            $recordedAt,
        );
    }

    public function pingIntegrity(
        User $user,
        float $latitude,
        float $longitude,
        ?float $accuracy,
        ?Carbon $recordedAt,
        bool $reportedMock
    ): array {
        if ($reportedMock) {
            return [
                'trusted' => false,
                'reason'  => 'mock_location',
                'message' => 'Perangkat melaporkan lokasi mock/fake GPS.',
            ];
        }

        $travelError = $this->impossibleTravelError($user, $latitude, $longitude, $accuracy, $recordedAt);

        if ($travelError) {
            return [
                'trusted' => false,
                'reason'  => $travelError['reason'],
                'message' => $travelError['message'],
                'errors'  => $travelError['errors'],
            ];
        }

        return [
            'trusted' => true,
            'reason'  => null,
            'message' => null,
        ];
    }

    private function impossibleTravelError(
        ?User $user,
        float $latitude,
        float $longitude,
        ?float $accuracy,
        ?Carbon $recordedAt
    ): ?array {
        if (! $user) {
            return null;
        }

        $trustedPing = $user->latestTrustedPing()->first();
        if (! $trustedPing || ! ($trustedPing->location instanceof Point) || ! $trustedPing->recorded_at) {
            return null;
        }

        $now = now(self::LOCAL_TIMEZONE);
        $trustedAt = Carbon::parse($trustedPing->recorded_at)->setTimezone(self::LOCAL_TIMEZONE);

        if ($trustedAt->lt($now->copy()->subMinutes(self::MAX_TRUSTED_REFERENCE_AGE_MINUTES))) {
            return null;
        }

        $incomingAt = ($recordedAt ?? $now)->copy()->setTimezone(self::LOCAL_TIMEZONE);
        $elapsedSeconds = $incomingAt->timestamp - $trustedAt->timestamp;

        if ($elapsedSeconds <= 0) {
            $elapsedSeconds = max(1, $now->timestamp - $trustedAt->timestamp);
        }

        $distanceMeters = $this->calculateDistance(
            $trustedPing->location->latitude,
            $trustedPing->location->longitude,
            $latitude,
            $longitude,
        );

        $accuracyBuffer = min(
            500,
            max(0, (float) ($trustedPing->accuracy ?? 0)) + max(0, (float) ($accuracy ?? 0))
        );
        $allowedDistance = self::TELEPORT_DISTANCE_BUFFER_METERS
            + ($elapsedSeconds * self::MAX_TRAVEL_SPEED_METERS_PER_SECOND)
            + $accuracyBuffer;

        if ($distanceMeters <= $allowedDistance) {
            return null;
        }

        return $this->error(
            'impossible_travel',
            'Lokasi berpindah terlalu jauh dalam waktu singkat. Ambil ulang lokasi di titik asli sebelum melanjutkan visit.',
            [
                'distance_meters' => round($distanceMeters, 2),
                'allowed_distance_meters' => round($allowedDistance, 2),
                'elapsed_seconds' => $elapsedSeconds,
                'latest_trusted_recorded_at' => $trustedAt->toISOString(),
            ]
        );
    }

    private function calculateDistance(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2
    ): float {
        $earthRadius = 6371000;

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($dLon / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    private function error(string $reason, string $message, array $meta = []): array
    {
        return [
            'reason'  => $reason,
            'message' => $message,
            'errors'  => array_merge(['reason' => $reason], $meta),
        ];
    }
}
