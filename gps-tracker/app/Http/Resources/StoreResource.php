<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'code'            => $this->code,
            'external_bp_code' => $this->external_bp_code,
            'name'            => $this->name,
            'address'         => $this->address,
            'area'            => $this->area,
            'branch'          => $this->branch ?? $this->area,
            'city'            => $this->city,
            'latitude'        => $this->location?->latitude,
            'longitude'       => $this->location?->longitude,
            'geofence_radius' => $this->geofence_radius,
            'pic_name'        => $this->pic_name,
            'pic_phone'       => $this->pic_phone,
            'status'          => $this->status,
            'is_priority'     => $this->is_priority,
            'tags'            => $this->tags ?? [],
            'master_source'   => $this->master_source,
            'synced_at'       => $this->last_synced_at?->toISOString(),
            'has_location'    => $this->location instanceof \MatanYadaev\EloquentSpatial\Objects\Point,
            'created_at'      => $this->created_at?->toDateString(),
        ];
    }
}
