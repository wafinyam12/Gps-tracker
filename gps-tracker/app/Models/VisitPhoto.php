<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPhoto extends Model
{
    use HasSpatial;

    protected $fillable = [
        'visit_log_id', 'client_uuid', 'path', 'type', 'location', 'taken_at',
        'location_accuracy', 'location_recorded_at', 'location_is_mock', 'location_source',
    ];

    protected $casts = [
        'location' => Point::class,
        'taken_at' => 'datetime',
        'location_accuracy' => 'float',
        'location_recorded_at' => 'datetime',
        'location_is_mock' => 'boolean',
    ];

    public function visitLog()
    {
        return $this->belongsTo(VisitLog::class);
    }
}
