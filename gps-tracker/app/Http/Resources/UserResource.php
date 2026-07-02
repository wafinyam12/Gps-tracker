<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'username'    => $this->username,
            'email'       => $this->email,
            'phone'       => $this->phone,
            'employee_id' => $this->employee_id,
            'slp_code'    => $this->slpCode,
            'photo'       => $this->photo
                                ? asset('storage/'.$this->photo)
                                : null,
            'role'        => $this->roles->first()?->name,
            'permissions' => $this->getAllPermissions()->pluck('name'),
            'branch'      => $this->whenLoaded('team', fn () => $this->formatBranch()),
            'team'        => $this->whenLoaded('team', fn () => $this->formatBranch()),
            'is_active'   => $this->is_active,
            'last_seen_at' => $this->last_seen_at?->toISOString(),
        ];
    }

    private function formatBranch(): array
    {
        return [
            'id'            => $this->team->id,
            'name'          => $this->team->name,
            'code'          => $this->team->code,
            'area'          => $this->team->area,
            'db_sap'        => $this->team->db_sap,
            'latitude'      => $this->team->location?->latitude,
            'longitude'     => $this->team->location?->longitude,
            'location'      => $this->team->location ? [
                'latitude'  => $this->team->location->latitude,
                'longitude' => $this->team->location->longitude,
            ] : null,
            'has_location'  => $this->team->hasLocation(),
            'is_active'     => $this->team->is_active,
        ];
    }
}
