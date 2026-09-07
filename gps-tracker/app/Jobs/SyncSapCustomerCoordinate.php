<?php

namespace App\Jobs;

use App\Models\SapCoordinateSync;
use App\Services\Sap\BpCoordinateService;
use App\Services\Sap\CustomerCoordinateSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SyncSapCustomerCoordinate implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $uniqueFor = 1800;

    public function __construct(public readonly int $syncId)
    {
    }

    public function uniqueId(): string
    {
        return (string) $this->syncId;
    }

    public function backoff(): array
    {
        return [300, 900, 3600];
    }

    public function handle(BpCoordinateService $sap, CustomerCoordinateSyncService $observations): void
    {
        $sync = SapCoordinateSync::query()->with('store.team')->find($this->syncId);

        if (! $sync || ! in_array($sync->status, [SapCoordinateSync::STATUS_PENDING, SapCoordinateSync::STATUS_RETRY], true)) {
            return;
        }

        if ($sync->next_attempt_at?->isFuture()) {
            return;
        }

        if (! $sync->store || ! $sync->store->team || ! $sync->store->team->is_active) {
            $this->finish($sync, SapCoordinateSync::STATUS_SKIPPED, ['last_error' => 'Store atau cabang tidak aktif.']);
            return;
        }

        $sync->forceFill([
            'status' => SapCoordinateSync::STATUS_PROCESSING,
            'attempts' => $sync->attempts + 1,
            'next_attempt_at' => null,
        ])->save();

        try {
            $remote = $sap->find($sync->db_sap, $sync->cardcode);
            $remoteFields = [
                'last_http_status' => $remote['status'],
                'last_response' => $remote['payload'],
                'remote_latitude' => $remote['latitude'],
                'remote_longitude' => $remote['longitude'],
            ];

            if (! $remote['found']) {
                $result = $sap->create($this->payload($sync));
                $this->finish($sync, SapCoordinateSync::STATUS_SYNCED, [
                    ...$remoteFields,
                    'sync_method' => 'post',
                    'last_http_status' => $result['status'],
                    'last_response' => $result['payload'],
                ]);
                return;
            }

            if ($remote['latitude'] === null || $remote['longitude'] === null) {
                $result = $sap->update($this->payload($sync));
                $this->finish($sync, SapCoordinateSync::STATUS_SYNCED, [
                    ...$remoteFields,
                    'sync_method' => 'patch',
                    'last_http_status' => $result['status'],
                    'last_response' => $result['payload'],
                ]);
                return;
            }

            $distance = $this->distanceMeters(
                $sync->latitude,
                $sync->longitude,
                $remote['latitude'],
                $remote['longitude'],
            );
            $remoteFields['distance_meters'] = round($distance, 2);

            if ($distance <= $this->matchTolerance()) {
                $this->finish($sync, SapCoordinateSync::STATUS_NO_CHANGE, $remoteFields);
                return;
            }

            if ($distance > $this->verificationThreshold() || ! $observations->hasCorroboratingObservations($sync->store_id)) {
                $this->finish($sync, SapCoordinateSync::STATUS_VERIFICATION_REQUIRED, $remoteFields + [
                    'last_error' => 'Perbedaan koordinat perlu verifikasi observasi/admin.',
                ]);
                return;
            }

            $result = $sap->update($this->payload($sync));
            $this->finish($sync, SapCoordinateSync::STATUS_SYNCED, [
                ...$remoteFields,
                'sync_method' => 'patch',
                'last_http_status' => $result['status'],
                'last_response' => $result['payload'],
            ]);
        } catch (Throwable $exception) {
            $sync->forceFill([
                'status' => SapCoordinateSync::STATUS_RETRY,
                'last_error' => mb_substr($exception->getMessage(), 0, 65535),
                'next_attempt_at' => now()->addMinutes(15),
            ])->save();

            throw $exception;
        }
    }

    public function failed(Throwable $exception): void
    {
        SapCoordinateSync::query()->whereKey($this->syncId)->update([
            'status' => SapCoordinateSync::STATUS_RETRY,
            'last_error' => mb_substr($exception->getMessage(), 0, 65535),
            'next_attempt_at' => now()->addHour(),
            'updated_at' => now(),
        ]);
    }

    private function payload(SapCoordinateSync $sync): array
    {
        return [
            'db' => $sync->db_sap,
            'cardcode' => $sync->cardcode,
            'latitude' => number_format((float) $sync->latitude, 7, '.', ''),
            'longitude' => number_format((float) $sync->longitude, 7, '.', ''),
        ];
    }

    private function finish(SapCoordinateSync $sync, string $status, array $values = []): void
    {
        $sync->forceFill([
            ...$values,
            'status' => $status,
            'last_error' => $values['last_error'] ?? null,
            'next_attempt_at' => null,
            'processed_at' => now(),
        ])->save();
    }

    private function matchTolerance(): float
    {
        return max(1, (float) config('sap.coordinate_match_tolerance_meters', 50));
    }

    private function verificationThreshold(): float
    {
        return max($this->matchTolerance(), (float) config('sap.coordinate_verification_threshold_meters', 100));
    }

    private function distanceMeters(float $latitudeA, float $longitudeA, float $latitudeB, float $longitudeB): float
    {
        $earthRadius = 6371000;
        $latitudeDelta = deg2rad($latitudeB - $latitudeA);
        $longitudeDelta = deg2rad($longitudeB - $longitudeA);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($latitudeA)) * cos(deg2rad($latitudeB)) * sin($longitudeDelta / 2) ** 2;

        return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
    }
}
