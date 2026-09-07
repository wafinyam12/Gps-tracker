<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;

class CustomerCoordinateObservation extends Model
{
    use HasSpatial;

    protected $fillable = [
        'team_id',
        'store_id',
        'visit_log_id',
        'user_id',
        'location',
        'accuracy_meters',
        'observed_at',
        'is_eligible',
        'requires_verification',
    ];

    protected $casts = [
        'location' => Point::class,
        'observed_at' => 'datetime',
        'accuracy_meters' => 'float',
        'is_eligible' => 'boolean',
        'requires_verification' => 'boolean',
    ];

    public function team()
    {
        return $this->belongsTo(Team::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function visitLog()
    {
        return $this->belongsTo(VisitLog::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
