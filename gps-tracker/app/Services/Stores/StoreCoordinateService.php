<?php

namespace App\Services\Stores;

use App\Models\Store;
use App\Models\StoreCoordinateChange;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Services\VisitGeofenceService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use MatanYadaev\EloquentSpatial\Objects\Point;

class StoreCoordinateService
{
    public function __construct(private readonly VisitGeofenceService $geofence)
    {
    }

    public function setManual(
        Store $store,
        User $actor,
        Point $point,
        int $radius,
        string $reason,
        ?VisitPhoto $photo = null,
    ): StoreCoordinateChange {
        if ($radius < 1 || $radius > 50) {
            throw new InvalidArgumentException('Radius geofence harus 1 sampai 50 meter.');
        }

        if (trim($reason) === '') {
            throw new InvalidArgumentException('Alasan koreksi wajib diisi.');
        }

        if ($photo && ((int) $photo->visitLog?->store_id !== (int) $store->id || ! $photo->location)) {
            throw new InvalidArgumentException('Foto tidak berasal dari toko yang dipilih.');
        }

        return DB::transaction(function () use ($store, $actor, $point, $radius, $reason, $photo) {
            $locked = Store::query()->lockForUpdate()->findOrFail($store->id);
            $previous = $locked->location;
            $previousRadius = (int) $locked->geofence_radius;

            $locked->forceFill([
                'location' => $point,
                'geofence_radius' => $radius,
                'coordinate_source' => 'crm_manual',
            ])->save();

            $change = StoreCoordinateChange::create([
                'store_id' => $locked->id,
                'actor_user_id' => $actor->id,
                'actor_name' => $actor->name,
                'photo_id' => $photo?->id,
                'source' => 'crm_manual',
                'reason' => trim($reason),
                'old_latitude' => $previous?->latitude,
                'old_longitude' => $previous?->longitude,
                'new_latitude' => $point->latitude,
                'new_longitude' => $point->longitude,
                'old_radius' => $previousRadius,
                'new_radius' => $radius,
            ]);

            $this->seedOpenVisitCenters($locked, $point, $radius, 'crm_manual');

            return $change;
        });
    }

    public function seedFromPhoto(VisitPhoto $photo): bool
    {
        $photo->loadMissing('visitLog');
        $visit = $photo->visitLog;
        $point = $photo->location;
        $checkin = $visit?->checkin_location;
        $accuracy = $photo->location_accuracy;
        $recordedAt = $photo->location_recorded_at;
        $takenAt = $photo->taken_at;

        if ($photo->location_source !== 'photo_capture'
            || ! $point instanceof Point
            || $accuracy === null || $accuracy < 0 || $accuracy > 25
            || ! $recordedAt || ! $takenAt
            || $photo->location_is_mock !== false
            || ! $visit?->checkin_valid || $visit->is_mock_location || $visit->is_duplicate
            || ! $checkin instanceof Point || ! $visit->checkin_at
            || abs($recordedAt->timestamp - $takenAt->timestamp) > 60
            || $recordedAt->timestamp > now()->timestamp + 60
            || $takenAt->timestamp < $visit->checkin_at->timestamp - 60
            || ($visit->checkout_at && $takenAt->timestamp > $visit->checkout_at->timestamp + 60)
            || $this->geofence->distanceMeters($checkin, $point) > 100) {
            return false;
        }

        return DB::transaction(function () use ($photo, $visit, $point) {
            $store = Store::query()->lockForUpdate()->find($visit->store_id);
            if (! $store || $store->hasLocation()) {
                return false;
            }

            $radius = min(50, max(1, (int) ($store->geofence_radius ?: 50)));
            $store->forceFill([
                'location' => $point,
                'coordinate_source' => 'photo',
            ])->save();

            StoreCoordinateChange::create([
                'store_id' => $store->id,
                'photo_id' => $photo->id,
                'source' => 'photo',
                'reason' => 'GPS foto kunjungan memenuhi syarat pengisian master kosong.',
                'new_latitude' => $point->latitude,
                'new_longitude' => $point->longitude,
                'old_radius' => $radius,
                'new_radius' => $radius,
            ]);

            $this->seedOpenVisitCenters($store, $point, $radius, 'photo');

            return true;
        });
    }

    private function seedOpenVisitCenters(Store $store, Point $point, int $radius, string $source): void
    {
        VisitLog::query()
            ->where('store_id', $store->id)
            ->whereNull('checkout_at')
            ->whereNull('geofence_center')
            ->lockForUpdate()
            ->get()
            ->each(function (VisitLog $visit) use ($point, $radius, $source) {
                $visit->forceFill([
                    'geofence_center' => $point,
                    'geofence_radius_meters' => $radius,
                    'geofence_reference_source' => $source,
                ])->save();
            });
    }
}
