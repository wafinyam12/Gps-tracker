<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreCoordinateChange extends Model
{
    protected $fillable = [
        'store_id', 'actor_user_id', 'actor_name', 'photo_id', 'source', 'reason',
        'old_latitude', 'old_longitude', 'new_latitude', 'new_longitude',
        'old_radius', 'new_radius',
    ];

    protected $casts = [
        'old_latitude' => 'float',
        'old_longitude' => 'float',
        'new_latitude' => 'float',
        'new_longitude' => 'float',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function photo()
    {
        return $this->belongsTo(VisitPhoto::class, 'photo_id');
    }
}
