<?php

namespace App\Services\Sap;

use App\Models\CustomerCoordinateObservation;
use App\Models\SapCoordinateSync;
use App\Models\Store;
use App\Models\VisitLog;
use Illuminate\Support\Collection;
use MatanYadaev\EloquentSpatial\Objects\Point;

class CustomerCoordinateSyncService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    /**
     * Records every trustworthy completed visit as an observation. A sync record
     * is created only for a store that has never completed its initial SAP
     * coordinate reconciliation. This keeps the SAP workload proportional to
     * visited customers, rather than all customers in a branch.
     */
    public function recordCompletedVisit(VisitLog $visitLog, Store $store, Point $checkinLocation): void
    {
        $accuracy = $visitLog->checkin_accuracy === null ? null : (float) $visitLog->checkin_accuracy;
        $isEligible = $visitLog->checkin_valid
            && ! $visitLog->is_mock_location
            && ! $visitLog->is_duplicate
            && $accuracy !== null
            && $accuracy <= $this->maxObservationAccuracy();

        $observation = CustomerCoordinateObservation::updateOrCreate(
            ['visit_log_id' => $visitLog->id],
            [
                'team_id' => $store->team_id,
                'store_id' => $store->id,
                'user_id' => $visitLog->user_id,
                'location' => $checkinLocation,
                'accuracy_meters' => $accuracy,
                'observed_at' => $visitLog->checkin_at ?? now(self::LOCAL_TIMEZONE),
                'is_eligible' => $isEligible,
            ]
        );

        if (! $isEligible || ! $store->hasLocation() || ! filled($store->external_bp_code) || ! filled($store->team?->db_sap)) {
            return;
        }

        $openSync = SapCoordinateSync::query()
            ->where('store_id', $store->id)
            ->whereIn('status', [
                SapCoordinateSync::STATUS_PENDING,
                SapCoordinateSync::STATUS_PROCESSING,
                SapCoordinateSync::STATUS_RETRY,
                SapCoordinateSync::STATUS_VERIFICATION_REQUIRED,
            ])
            ->latest('id')
            ->first();

        if ($openSync) {
            // A second qualified visit can satisfy the evidence requirement for
            // a 50-100m discrepancy found in a prior SAP comparison.
            if ($openSync->status === SapCoordinateSync::STATUS_VERIFICATION_REQUIRED
                && $this->hasCorroboratingObservations($store->id)) {
                $openSync->forceFill([
                    'status' => SapCoordinateSync::STATUS_PENDING,
                    'coordinate_observation_id' => $observation->id,
                    'next_attempt_at' => null,
                    'last_error' => null,
                ])->save();
            }

            return;
        }

        $alreadyReconciled = SapCoordinateSync::query()
            ->where('store_id', $store->id)
            ->whereIn('status', [SapCoordinateSync::STATUS_SYNCED, SapCoordinateSync::STATUS_NO_CHANGE])
            ->exists();

        if ($alreadyReconciled) {
            return;
        }

        SapCoordinateSync::create([
            'team_id' => $store->team_id,
            'store_id' => $store->id,
            'coordinate_observation_id' => $observation->id,
            'db_sap' => trim((string) $store->team->db_sap),
            'cardcode' => trim((string) $store->external_bp_code),
            'latitude' => $store->location->latitude,
            'longitude' => $store->location->longitude,
            'source' => 'visit_observation',
            'status' => SapCoordinateSync::STATUS_PENDING,
        ]);
    }

    public function hasCorroboratingObservations(int $storeId): bool
    {
        $observations = CustomerCoordinateObservation::query()
            ->where('store_id', $storeId)
            ->where('is_eligible', true)
            ->orderByDesc('observed_at')
            ->limit(10)
            ->get();

        return $this->findCorroboratingPair($observations) !== null;
    }

    private function findCorroboratingPair(Collection $observations): ?array
    {
        foreach ($observations as $index => $observation) {
            if (! $observation->location instanceof Point) {
                continue;
            }

            foreach ($observations->slice($index + 1) as $other) {
                if (! $other->location instanceof Point) {
                    continue;
                }

                if ($this->distanceMeters($observation->location, $other->location) <= $this->observationAgreementMeters()) {
                    return [$observation, $other];
                }
            }
        }

        return null;
    }

    private function maxObservationAccuracy(): float
    {
        return max(1, (float) config('sap.coordinate_max_observation_accuracy_meters', 25));
    }

    private function observationAgreementMeters(): float
    {
        return max(1, (float) config('sap.coordinate_observation_agreement_meters', 30));
    }

    private function distanceMeters(Point $first, Point $second): float
    {
        $earthRadius = 6371000;
        $latitudeDelta = deg2rad($second->latitude - $first->latitude);
        $longitudeDelta = deg2rad($second->longitude - $first->longitude);

        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($first->latitude)) * cos(deg2rad($second->latitude)) * sin($longitudeDelta / 2) ** 2;

        return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
    }
}
