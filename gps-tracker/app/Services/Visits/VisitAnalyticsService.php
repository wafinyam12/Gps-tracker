<?php

namespace App\Services\Visits;

use App\Models\DailyTarget;
use App\Models\User;
use App\Models\VisitLog;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

class VisitAnalyticsService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function targetForUserDate(int $userId, string $date, int $default = 5): int
    {
        return DailyTarget::resolveTarget($userId, $date, $default)->target_visits;
    }

    public function scopeUsers(?User $viewer = null, ?int $userId = null, ?int $teamId = null): Collection
    {
        $resolvedTeamId = $this->resolveTeamScope($viewer, $teamId);
        $roles = $viewer?->isBranchAdmin() ? ['sales'] : ['sales', 'spv'];

        return User::query()
            ->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))
            ->where('is_active', true)
            ->when($userId, fn ($query) => $query->where('id', $userId))
            ->when($resolvedTeamId, fn ($query) => $query->where('team_id', $resolvedTeamId))
            ->with('team')
            ->orderBy('name')
            ->get();
    }

    public function loadVisits(string $dateFrom, string $dateTo, ?User $viewer = null, ?int $userId = null, ?int $teamId = null, ?int $storeId = null): Collection
    {
        $resolvedTeamId = $this->resolveTeamScope($viewer, $teamId);

        return VisitLog::query()
            ->with(['user.team', 'store', 'photos'])
            ->when($userId, fn ($query) => $query->where('user_id', $userId))
            ->when($resolvedTeamId, fn ($query) => $query->whereHas('user', function ($query) use ($resolvedTeamId) {
                $query->where('team_id', $resolvedTeamId);
            }))
            ->when($storeId, fn ($query) => $query->where('store_id', $storeId))
            ->whereBetween('visit_date', [$dateFrom, $dateTo])
            ->orderBy('visit_date')
            ->orderBy('checkin_at')
            ->get();
    }

    public function summarizeByUser(Collection $users, Collection $logs, string $dateFrom, string $dateTo): Collection
    {
        $dates = $this->dateRange($dateFrom, $dateTo);
        $today = now(self::LOCAL_TIMEZONE)->toDateString();

        return $users->map(function (User $user) use ($logs, $dates, $today) {
            $userLogs = $logs->where('user_id', $user->id)->values();
            $uniqueLogs = $userLogs->where('counted_as_target', true);
            $duplicateLogs = $userLogs->where('is_duplicate', true);
            $orderTaken = $userLogs->where('visit_result', 'order_taken')->count();
            $closed = $userLogs->where('visit_result', 'closed')->count();
            $avgDuration = round($userLogs->avg('duration_minutes') ?? 0, 1);
            $mockDetected = $userLogs->where('is_mock_location', true)->count();
            $invalidCheckins = $userLogs->where('checkin_valid', false)->count();

            $targetTotal = 0;
            $warnings = [];
            $daily = [];

            foreach ($dates as $date) {
                $dailyTarget = $this->targetForUserDate($user->id, $date);
                $dailyLogs = $this->filterLogsForDate($userLogs, $date);
                $dailyUnique = $dailyLogs->where('counted_as_target', true)->count();
                $dailyDuplicate = $dailyLogs->where('is_duplicate', true)->count();
                $targetTotal += $dailyTarget;

                $completionPct = $dailyTarget > 0
                    ? round(($dailyUnique / $dailyTarget) * 100, 1)
                    : 0;

                $warning = null;
                if ($date < $today && $dailyUnique < $dailyTarget) {
                    $warning = [
                        'date'             => $date,
                        'user_id'          => $user->id,
                        'name'             => $user->name,
                        'branch'           => $user->team?->name,
                        'team'             => $user->team?->name,
                        'target_visits'    => $dailyTarget,
                        'unique_visits'    => $dailyUnique,
                        'duplicate_visits' => $dailyDuplicate,
                        'missing_visits'   => max($dailyTarget - $dailyUnique, 0),
                        'completion_pct'   => $completionPct,
                        'message'          => "Hari {$date} hanya tercatat {$dailyUnique} dari {$dailyTarget} toko unik.",
                    ];
                    $warnings[] = $warning;
                }

                $daily[] = [
                    'date'             => $date,
                    'target_visits'    => $dailyTarget,
                    'unique_visits'    => $dailyUnique,
                    'duplicate_visits' => $dailyDuplicate,
                    'completion_pct'   => $completionPct,
                    'warning'          => $warning,
                ];
            }

            $progressPct = $targetTotal > 0
                ? round(($uniqueLogs->count() / $targetTotal) * 100, 1)
                : 0;

            return [
                'user_id'          => $user->id,
                'name'             => $user->name,
                'employee_id'      => $user->employee_id,
                'branch'           => $user->team?->name,
                'team'             => $user->team?->name,
                'is_online'        => $user->last_seen_at
                    ? $user->last_seen_at->diffInMinutes(now()) <= 10
                    : false,
                'summary'          => [
                    'target_visits'    => $targetTotal,
                    'unique_visits'    => $uniqueLogs->count(),
                    'duplicate_visits' => $duplicateLogs->count(),
                    'completion_pct'   => $progressPct,
                    'last_visit_at'    => $userLogs->sortByDesc('checkin_at')->first()?->checkin_at?->toISOString(),
                    'order_taken'      => $orderTaken,
                    'closed'           => $closed,
                    'avg_duration_min' => $avgDuration,
                    'mock_detected'    => $mockDetected,
                    'invalid_checkins' => $invalidCheckins,
                ],
                'daily'            => $daily,
                'warnings'         => $warnings,
            ];
        })->values();
    }

    public function summarizeByDate(Collection $users, Collection $logs, string $dateFrom, string $dateTo): Collection
    {
        $dates = $this->dateRange($dateFrom, $dateTo);
        $today = now(self::LOCAL_TIMEZONE)->toDateString();

        return collect($dates)->map(function (string $date) use ($users, $logs, $today) {
            $dailyLogs = $this->filterLogsForDate($logs, $date);
            $uniqueVisits = $dailyLogs->where('counted_as_target', true)->count();
            $duplicateVisits = $dailyLogs->where('is_duplicate', true)->count();

            $targetTotal = $users->sum(fn (User $user) => $this->targetForUserDate($user->id, $date));

            $warnings = $users->map(function (User $user) use ($date, $logs, $today) {
                $dailyTarget = $this->targetForUserDate($user->id, $date);
                $dailyLogs = $this->filterLogsForDate(
                    $logs->where('user_id', $user->id),
                    $date
                );
                $dailyUnique = $dailyLogs->where('counted_as_target', true)->count();
                $dailyDuplicate = $dailyLogs->where('is_duplicate', true)->count();

                if ($date >= $today || $dailyUnique >= $dailyTarget) {
                    return null;
                }

                return [
                    'date'             => $date,
                    'user_id'          => $user->id,
                    'name'             => $user->name,
                    'branch'           => $user->team?->name,
                    'team'             => $user->team?->name,
                    'target_visits'    => $dailyTarget,
                    'unique_visits'    => $dailyUnique,
                    'duplicate_visits' => $dailyDuplicate,
                    'missing_visits'   => max($dailyTarget - $dailyUnique, 0),
                    'completion_pct'   => $dailyTarget > 0 ? round(($dailyUnique / $dailyTarget) * 100, 1) : 0,
                    'message'          => "Hari {$date} hanya tercatat {$dailyUnique} dari {$dailyTarget} toko unik.",
                ];
            })->filter()->values();

            return [
                'date'             => $date,
                'target_visits'    => $targetTotal,
                'unique_visits'    => $uniqueVisits,
                'duplicate_visits' => $duplicateVisits,
                'completion_pct'   => $targetTotal > 0 ? round(($uniqueVisits / $targetTotal) * 100, 1) : 0,
                'warnings'         => $warnings,
            ];
        })->values();
    }

    public function summarizeByStore(Collection $logs): Collection
    {
        return $logs->groupBy('store_id')->map(function (Collection $group) {
            $store = $group->first()?->store;
            $unique = $group->where('counted_as_target', true)->count();
            $duplicate = $group->where('is_duplicate', true)->count();
            $lastVisit = $group->sortByDesc('checkin_at')->first();

            return [
                'store_id'         => $store?->id,
                'store_code'       => $store?->code,
                'external_bp_code' => $store?->external_bp_code,
                'store_name'       => $store?->name,
                'branch'           => $store?->branch,
                'area'             => $store?->area,
                'city'             => $store?->city,
                'unique_visits'    => $unique,
                'duplicate_visits' => $duplicate,
                'total_visits'     => $group->count(),
                'last_visit_at'    => $lastVisit?->checkin_at?->toISOString(),
                'avg_duration_min' => round($group->avg('duration_minutes') ?? 0, 1),
            ];
        })->values();
    }

    private function dateRange(string $dateFrom, string $dateTo): array
    {
        return collect(CarbonPeriod::create($dateFrom, $dateTo))
            ->map(fn ($date) => $date->toDateString())
            ->values()
            ->all();
    }

    private function filterLogsForDate(Collection $logs, string $date): Collection
    {
        return $logs->filter(function (VisitLog $visitLog) use ($date) {
            return $visitLog->visit_date?->toDateString() === $date;
        })->values();
    }

    private function resolveTeamScope(?User $viewer = null, ?int $teamId = null): ?int
    {
        $managedTeamId = $viewer?->managedTeamId();

        if ($managedTeamId !== null) {
            return $managedTeamId;
        }

        return $teamId;
    }
}
