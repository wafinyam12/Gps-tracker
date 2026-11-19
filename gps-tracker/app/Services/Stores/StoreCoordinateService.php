<?php

namespace App\Services\Stores;

use App\Models\Store;
use App\Models\StoreCoordinateChange;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use MatanYadaev\EloquentSpatial\Objects\Point;

class StoreCoordinateService
{
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
