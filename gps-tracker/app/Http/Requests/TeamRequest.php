<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasAnyRole(['admin', 'superadmin']) === true;
    }

    public function rules(): array
    {
        $team = $this->route('team');
        $teamId = $team?->id;
        $hasStoredUdportalPassword = filled($team?->udportal_password);

        return [
            'name'      => 'required|string|max:255|unique:teams,name,' . $teamId,
            'code'      => 'required|string|max:50|unique:teams,code,' . $teamId,
            'area'      => 'nullable|string|max:255',
            'db_sap'    => ['required', 'string', 'max:100', Rule::unique('teams', 'db_sap')->ignore($teamId)],
            'udportal_username' => [
                Rule::requiredIf(fn () => filled($this->input('udportal_password'))),
                'nullable',
                'string',
                'max:100',
            ],
            'udportal_password' => [
                Rule::requiredIf(fn () => filled($this->input('udportal_username')) && ! $hasStoredUdportalPassword),
                'nullable',
                'string',
                'max:255',
            ],
            'latitude'  => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'is_active' => 'nullable|boolean',
        ];
    }
}
