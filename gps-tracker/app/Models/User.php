<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;
use MatanYadaev\EloquentSpatial\Objects\Point;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class User extends Authenticatable
{
    use HasApiTokens, HasRoles, HasSpatial, Notifiable, SoftDeletes, HasFactory;

    protected $fillable = [
        'name', 'email', 'password', 'phone', 'photo',
        'employee_id', 'team_id', 'is_active', 'last_seen_at', 'last_location',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_seen_at'      => 'datetime',
        'last_location'     => Point::class,
        'is_active'         => 'boolean',
        'password'          => 'hashed',
    ];

    public function team()
    {
        return $this->belongsTo(Team::class);
    }

    public function schedules()
    {
        return $this->hasMany(VisitSchedule::class);
    }

    public function visitLogs()
    {
        return $this->hasMany(VisitLog::class);
    }

    public function locationPings()
    {
        return $this->hasMany(LocationPing::class);
    }

    public function latestPing()
    {
        return $this->hasOne(LocationPing::class)->latestOfMany('recorded_at');
    }
}