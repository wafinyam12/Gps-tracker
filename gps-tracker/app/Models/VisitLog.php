<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitLog extends Model
{
    use HasSpatial;

    protected $fillable = [
        'visit_schedule_id', 'user_id', 'store_id',
        'checkin_at', 'checkin_location', 'checkin_accuracy',
        'checkin_valid', 'checkin_distance', 'is_mock_location',
        'checkout_at', 'checkout_location', 'duration_minutes',
        'notes', 'form_data', 'visit_result',
    ];

    protected $casts = [
        'checkin_location'  => Point::class,
        'checkout_location' => Point::class,
        'form_data'         => 'array',
        'checkin_valid'     => 'boolean',
        'is_mock_location'  => 'boolean',
        'checkin_at'        => 'datetime',
        'checkout_at'       => 'datetime',
    ];

    public function schedule()
    {
        return $this->belongsTo(VisitSchedule::class, 'visit_schedule_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function photos()
    {
        return $this->hasMany(VisitPhoto::class);
    }
}