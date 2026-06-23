<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') === true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;
        $role = $this->input('role');

        return [
            'name'        => 'required|string|max:255',
            'username'    => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($userId)],
            'email'       => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password'    => $userId ? 'nullable|string|min:8|max:255' : 'required|string|min:8|max:255',
            'phone'       => 'nullable|string|max:30',
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_id')->ignore($userId)],
            'team_id'     => [
                Rule::requiredIf(fn () => in_array($role, ['sales', 'spv'], true)),
                Rule::excludeIf(fn () => $role === 'manager'),
                'nullable',
                'exists:teams,id',
            ],
            'role'        => 'required|in:sales,spv,manager,admin',
            'is_active'   => 'nullable|boolean',
        ];
    }
}
