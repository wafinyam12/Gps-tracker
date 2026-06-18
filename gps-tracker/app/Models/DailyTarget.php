<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyTarget extends Model
{
    protected $fillable = [
        'user_id',
        'target_date',
        'target_visits',
        'set_by',
    ];

    protected $casts = [
        'target_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function setter()
    {
        return $this->belongsTo(User::class, 'set_by');
    }

    public static function resolveTarget(int $userId, string $date, int $default = 5): self
    {
        return static::firstOrCreate(
            [
                'user_id'     => $userId,
                'target_date' => $date,
            ],
            [
                'target_visits' => $default,
            ],
        );
    }

    public static function setTarget(int $userId, string $date, int $targetVisits, ?int $setBy = null): self
    {
        return static::updateOrCreate(
            [
                'user_id'     => $userId,
                'target_date' => $date,
            ],
            [
                'target_visits' => $targetVisits,
                'set_by'        => $setBy,
            ]
        );
    }
}
