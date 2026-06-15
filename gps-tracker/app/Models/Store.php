<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class Store extends Model
{
    use HasSpatial, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'address', 'area', 'city',
        'location', 'geofence_radius', 'pic_name',
        'pic_phone', 'status', 'is_priority', 'tags',
    ];

    protected $casts = [
        'location'    => Point::class,
        'tags'        => 'array',
        'is_priority' => 'boolean',
    ];

    public function schedules()
    {
        return $this->hasMany(VisitSchedule::class);
    }

    public function visitLogs()
    {
        return $this->hasMany(VisitLog::class);
    }
}