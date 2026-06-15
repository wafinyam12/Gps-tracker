<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'name'        => 'required|string|max:255',
            'email'       => 'required|email|unique:users,email,'.$userId,
            'password'    => $userId ? 'nullable|string|min:8' : 'required|string|min:8',
            'phone'       => 'nullable|string|max:20',
            'employee_id' => 'nullable|string|max:50|unique:users,employee_id,'.$userId,
            'team_id'     => 'nullable|exists:teams,id',
            'role'        => 'required|in:sales,spv,admin',
            'is_active'   => 'nullable|boolean',
        ];
    }
}