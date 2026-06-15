<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPhoto extends Model
{
    use HasSpatial;

    protected $fillable = [
        'visit_log_id', 'path', 'type', 'location', 'taken_at',
    ];

    protected $casts = [
        'location' => Point::class,
        'taken_at' => 'datetime',
    ];

    public function visitLog()
    {
        return $this->belongsTo(VisitLog::class);
    }
}