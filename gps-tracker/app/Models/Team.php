<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class Team extends Model
{
    use HasSpatial;

    protected $fillable = ['name', 'code', 'area', 'db_sap', 'location', 'is_active'];

    protected $casts = [
        'location'  => Point::class,
        'is_active' => 'boolean',
    ];

    public function members()
    {
        return $this->hasMany(User::class);
    }

    public function hasLocation(): bool
    {
        return $this->location instanceof Point;
    }
}
