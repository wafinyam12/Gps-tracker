<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SapCoordinateSync extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_RETRY = 'retry';
    public const STATUS_SYNCED = 'synced';
    public const STATUS_NO_CHANGE = 'no_change';
    public const STATUS_VERIFICATION_REQUIRED = 'verification_required';
    public const STATUS_SKIPPED = 'skipped';

    protected $fillable = [
        'team_id',
        'store_id',
        'coordinate_observation_id',
        'db_sap',
        'cardcode',
        'latitude',
        'longitude',
        'source',
        'status',
        'sync_method',
        'remote_latitude',
        'remote_longitude',
        'distance_meters',
        'attempts',
        'last_http_status',
        'last_error',
        'last_response',
        'next_attempt_at',
        'processed_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'remote_latitude' => 'float',
        'remote_longitude' => 'float',
        'distance_meters' => 'float',
        'last_response' => 'array',
        'next_attempt_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    public function team()
    {
        return $this->belongsTo(Team::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function observation()
    {
        return $this->belongsTo(CustomerCoordinateObservation::class, 'coordinate_observation_id');
    }
}
