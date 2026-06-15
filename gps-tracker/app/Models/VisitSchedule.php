<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VisitSchedule extends Model
{
    protected $fillable = [
        'user_id', 'store_id', 'visit_date', 'sequence',
        'status', 'skip_reason', 'assigned_by',
    ];

    protected $casts = [
        'visit_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function visitLog()
    {
        return $this->hasOne(VisitLog::class);
    }
}