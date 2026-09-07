<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitLog extends Model
{
    use HasSpatial;

    protected $fillable = [
        'user_id',
        'store_id',
        'client_uuid',
        'checkout_client_uuid',
        'visit_date',
        'checkin_at',
        'checkin_location',
        'checkin_accuracy',
        'checkin_valid',
        'checkin_distance',
        'is_mock_location',
        'is_offline_sync',
        'offline_received_at',
        'is_duplicate',
        'counted_as_target',
        'duplicate_reason',
        'checkout_at',
        'checkout_location',
        'duration_minutes',
        'notes',
        'form_data',
        'visit_result',
    ];

    protected $casts = [
        'checkin_location'  => Point::class,
        'checkout_location' => Point::class,
        'visit_date'        => 'date',
        'form_data'         => 'array',
        'checkin_valid'     => 'boolean',
        'is_mock_location'  => 'boolean',
        'is_offline_sync'   => 'boolean',
        'offline_received_at' => 'datetime',
        'is_duplicate'      => 'boolean',
        'counted_as_target'  => 'boolean',
        'checkin_at'        => 'datetime',
        'checkout_at'       => 'datetime',
    ];

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
