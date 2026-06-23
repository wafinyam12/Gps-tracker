<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') === true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id;

        return [
            'code'             => 'required|string|max:50|unique:stores,code,'.$storeId,
            'name'             => 'required|string|max:255',
            'address'          => 'nullable|string|max:1000',
            'area'             => 'nullable|string|max:100',
            'city'             => 'nullable|string|max:100',
            'latitude'         => 'required|numeric|between:-90,90',
            'longitude'        => 'required|numeric|between:-180,180',
            'geofence_radius'  => 'nullable|integer|min:50|max:1000',
            'pic_name'         => 'nullable|string|max:255',
            'pic_phone'        => 'nullable|string|max:20',
            'status'           => 'nullable|in:active,inactive',
            'is_priority'      => 'nullable|boolean',
            'tags'             => 'nullable|array',
            'tags.*'           => 'string|max:50',
        ];
    }
}
