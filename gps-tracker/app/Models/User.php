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

    /**
     * Roles and permissions are seeded for the web guard. Sanctum authenticates
     * API requests, but must not change the guard used by Spatie to resolve roles.
     */
    protected $guard_name = 'web';

    protected $fillable = [
        'name', 'username', 'email', 'password', 'phone', 'photo',
        'employee_id', 'team_id', 'is_active', 'last_seen_at', 'last_location','slpCode','db_sap'
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

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('superadmin');
    }

    public function isBranchAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isBranchScopedAdmin(): bool
    {
        return $this->hasAnyRole(['admin', 'spv']);
    }

    public function canAccessAllBranches(): bool
    {
        return $this->hasAnyRole(['superadmin', 'manager']);
    }

    public function managedTeamId(): ?int
    {
        if ($this->canAccessAllBranches()) {
            return null;
        }

        if ($this->isBranchScopedAdmin()) {
            return $this->team_id ? (int) $this->team_id : null;
        }

        return null;
    }

    public function canManageUsersInOwnBranch(): bool
    {
        return $this->hasAnyRole(['superadmin', 'admin']);
    }

    public function canAccessTeamId(?int $teamId): bool
    {
        if ($this->canAccessAllBranches()) {
            return true;
        }

        if ($teamId === null || ! $this->isBranchScopedAdmin()) {
            return false;
        }

        return $this->team_id !== null && (int) $this->team_id === (int) $teamId;
    }

    public function canAccessUserRecord(User $target): bool
    {
        if ($this->canAccessAllBranches()) {
            return true;
        }

        if ($this->isBranchAdmin()) {
            return $this->team_id !== null
                && (int) $this->team_id === (int) $target->team_id
                && $target->hasRole('sales');
        }

        if ($this->hasRole('spv')) {
            return $this->team_id !== null && (int) $this->team_id === (int) $target->team_id;
        }

        return $this->id === $target->id;
    }

    public function sapDatabase(): ?string
    {
        // SAP database is owned by the branch/team, never by an individual
        // account. This keeps all customer lookups inside the user's branch.
        return $this->team?->db_sap ?: null;
    }

    public function sapSalesCode(): ?string
    {
        $value = trim((string) $this->slpCode);

        return $value !== '' ? $value : null;
    }

    public function dailyTargets()
    {
        return $this->hasMany(DailyTarget::class);
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

    public function latestTrustedPing()
    {
        return $this->hasOne(LocationPing::class)->ofMany([
            'recorded_at' => 'max',
            'id' => 'max',
        ], function ($query) {
            $query->where('is_mock_location', false);
        });
    }
}
