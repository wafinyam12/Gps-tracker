<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'code'          => $this->code,
            'area'          => $this->area,
            'db_sap'        => $this->db_sap,
            'udportal_username' => $this->udportal_username,
            'has_udportal_password' => filled($this->udportal_password),
            'latitude'      => $this->location?->latitude,
            'longitude'     => $this->location?->longitude,
            'location'      => $this->location ? [
                'latitude'  => $this->location->latitude,
                'longitude' => $this->location->longitude,
            ] : null,
            'has_location'  => $this->hasLocation(),
            'is_active'     => $this->is_active,
            'members_count' => $this->members_count ?? 0,
            'created_at'    => $this->created_at?->toISOString(),
            'updated_at'    => $this->updated_at?->toISOString(),
        ];
    }
}
