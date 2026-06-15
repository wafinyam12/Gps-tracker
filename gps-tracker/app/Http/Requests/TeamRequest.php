<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $teamId = $this->route('team')?->id;

        return [
            'name'      => 'required|string|max:255|unique:teams,name,' . $teamId,
            'code'      => 'required|string|max:50|unique:teams,code,' . $teamId,
            'area'      => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ];
    }
}
