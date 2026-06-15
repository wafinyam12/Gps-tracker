<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    protected $fillable = ['name', 'code', 'area', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function members()
    {
        return $this->hasMany(User::class);
    }
}