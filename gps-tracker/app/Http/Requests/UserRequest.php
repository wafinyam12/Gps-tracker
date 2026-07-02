<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['admin', 'superadmin']) === true;
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;
        $role = $this->input('role');
        $actor = $this->user();
        $isSuperAdmin = $actor?->hasRole('superadmin') === true;
        $isBranchAdmin = $actor?->hasRole('admin') === true;
        $allowedRoles = $isSuperAdmin
            ? ['sales', 'spv', 'manager', 'admin', 'superadmin']
            : ['sales'];

        return [
            'name'        => 'required|string|max:255',
            'username'    => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($userId)],
            'email'       => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password'    => $userId ? 'nullable|string|min:8|max:255' : 'required|string|min:8|max:255',
            'phone'       => 'nullable|string|max:30',
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_id')->ignore($userId)],
            'slpCode'     => [
                Rule::requiredIf(fn () => $role === 'sales'),
                Rule::excludeIf(fn () => $role !== 'sales'),
                'nullable',
                'string',
                'max:50',
                Rule::unique('users', 'slpCode')->ignore($userId),
            ],
            'team_id'     => [
                Rule::requiredIf(fn () => $isSuperAdmin && in_array($role, ['sales', 'spv', 'admin'], true)),
                Rule::excludeIf(fn () => $isBranchAdmin && ! $isSuperAdmin),
                'nullable',
                'exists:teams,id',
            ],
            'role'        => 'required|in:'.implode(',', $allowedRoles),
            'is_active'   => 'nullable|boolean',
        ];
    }
}
