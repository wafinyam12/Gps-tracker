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
            'email'       => $this->email,
            'phone'       => $this->phone,
            'employee_id' => $this->employee_id,
            'photo'       => $this->photo
                                ? asset('storage/'.$this->photo)
                                : null,
            'role'        => $this->roles->first()?->name,
            'permissions' => $this->getAllPermissions()->pluck('name'),
            'team'        => $this->whenLoaded('team', fn() => [
                'id'   => $this->team->id,
                'name' => $this->team->name,
                'area' => $this->team->area,
            ]),
            'is_active'   => $this->is_active,
            'last_seen_at' => $this->last_seen_at?->toISOString(),
        ];
    }
}