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
            'name'            => $this->name,
            'address'         => $this->address,
            'area'            => $this->area,
            'city'            => $this->city,
            'latitude'        => $this->location->latitude,
            'longitude'       => $this->location->longitude,
            'geofence_radius' => $this->geofence_radius,
            'pic_name'        => $this->pic_name,
            'pic_phone'       => $this->pic_phone,
            'status'          => $this->status,
            'is_priority'     => $this->is_priority,
            'tags'            => $this->tags ?? [],
            'created_at'      => $this->created_at->toDateString(),
        ];
    }
}