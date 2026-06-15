<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class LocationPing extends Model
{
    use HasSpatial;

    protected $fillable = [
        'user_id', 'location', 'accuracy', 'speed',
        'bearing', 'battery', 'is_moving', 'recorded_at',
    ];

    protected $casts = [
        'location'    => Point::class,
        'is_moving'   => 'boolean',
        'recorded_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}