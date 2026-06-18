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
        'code',
        'external_bp_code',
        'name',
        'address',
        'area',
        'branch',
        'city',
        'location',
        'geofence_radius',
        'pic_name',
        'pic_phone',
        'status',
        'is_priority',
        'tags',
        'master_source',
        'master_payload',
        'last_synced_at',
    ];

    protected $casts = [
        'location'       => Point::class,
        'tags'           => 'array',
        'master_payload' => 'array',
        'is_priority'    => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    public function visitLogs()
    {
        return $this->hasMany(VisitLog::class);
    }

    public function hasLocation(): bool
    {
        return $this->location instanceof Point;
    }
}
