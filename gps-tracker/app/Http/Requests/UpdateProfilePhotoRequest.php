<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfilePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.required' => 'Foto profile wajib diisi.',
            'photo.image'    => 'File harus berupa gambar.',
            'photo.max'      => 'Ukuran foto maksimal 5MB.',
            'photo.mimes'    => 'Format foto harus jpg, jpeg, png, atau webp.',
        ];
    }
}
