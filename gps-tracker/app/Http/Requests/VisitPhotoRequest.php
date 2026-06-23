<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VisitPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['sales', 'spv', 'admin']) === true;
    }

    public function rules(): array
    {
        return [
            'visit_log_id' => 'required|exists:visit_logs,id',
            'photos'       => 'required|array|min:1|max:5',
            'photos.*'     => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120', // 5MB per foto
            ],
            'type'         => 'nullable|in:checkin,checkout,product,other',
            'latitude'     => 'nullable|numeric|between:-90,90',
            'longitude'    => 'nullable|numeric|between:-180,180',
            'taken_at'     => 'nullable|date',
            'submitted_by_user_id'  => 'nullable|integer',
            'submitted_by_username' => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'photos.*.max'   => 'Ukuran foto maksimal 5MB.',
            'photos.*.mimes' => 'Format foto harus jpg, jpeg, png, atau webp.',
            'photos.max'     => 'Maksimal 5 foto sekali upload.',
        ];
    }
}
