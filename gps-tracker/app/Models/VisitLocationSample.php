<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VisitLocationSample extends Model
{
    protected $fillable = [
        'visit_log_id', 'client_uuid', 'latitude', 'longitude', 'accuracy',
        'recorded_at', 'classification', 'distance_meters',
    ];

    protected $casts = [
        'latitude' => 'float', 'longitude' => 'float', 'accuracy' => 'float',
        'distance_meters' => 'float', 'recorded_at' => 'datetime',
    ];

    public function visitLog()
    {
        return $this->belongsTo(VisitLog::class);
    }
}
