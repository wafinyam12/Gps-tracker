<?php

namespace App\Services\Crm;

use App\Models\LocationPing;
use App\Models\Team;
use App\Models\User;
use App\Models\VisitLog;
use App\Services\Visits\VisitAnalyticsService;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class CrmAnalyticsService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private readonly VisitAnalyticsService $visitAnalytics,
    ) {
    }

    public function dashboard(User $viewer, array $filters): array
    {
        $dateFrom = $filters['date_from'];
        $dateTo = $filters['date_to'];
        $teamId = $filters['team_id'] ?? null;
        $userId = $filters['user_id'] ?? null;

        $users = $this->visitAnalytics->scopeUsers($viewer, $userId, $teamId);
        $logs = $this->visitAnalytics->loadVisits($dateFrom, $dateTo, $viewer, $userId, $teamId);
        $sales = $this->visitAnalytics->summarizeByUser($users, $logs, $dateFrom, $dateTo);
        $daily = $this->visitAnalytics->summarizeByDate($users, $logs, $dateFrom, $dateTo);
        $stores = $this->visitAnalytics->summarizeByStore($logs)
            ->sortByDesc('total_visits')
            ->values();
        $pings = $this->loadLocationPings($users, $dateFrom, $dateTo);
        $warnings = $daily->pluck('warnings')->flatten(1)->values();

        return [
            'period' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'filters' => [
                'team_id' => $teamId,
                'user_id' => $userId,
            ],
            'overview' => $this->overview($sales, $logs, $pings, $warnings),
            'branch_performance' => $this->branchPerformance($viewer, $users, $sales, $logs, $pings, $teamId),
            'sales_performance' => $this->salesPerformance($sales),
            'store_analysis' => $stores,
            'daily_trend' => $daily,
            'audit' => $this->auditSummary($logs, $pings, $warnings),
            'audit_exceptions' => $this->auditExceptions($logs, $pings, $warnings),
        ];
    }

    public function visibleTeams(User $viewer): Collection
    {
        return Team::query()
            ->where('is_active', true)
            ->when($viewer->managedTeamId(), fn ($query, $teamId) => $query->where('id', $teamId))
            ->orderBy('name')
            ->get();
    }

    public function visibleUsers(User $viewer, ?int $teamId = null): Collection
    {
        return $this->visitAnalytics->scopeUsers($viewer, null, $teamId);
    }

    private function overview(Collection $sales, Collection $logs, Collection $pings, Collection $warnings): array
    {
        $targetVisits = $sales->sum(fn (array $item) => $item['summary']['target_visits'] ?? 0);
        $uniqueVisits = $sales->sum(fn (array $item) => $item['summary']['unique_visits'] ?? 0);
        $duplicateVisits = $sales->sum(fn (array $item) => $item['summary']['duplicate_visits'] ?? 0);
        $orderTaken = $sales->sum(fn (array $item) => $item['summary']['order_taken'] ?? 0);
        $avgDuration = round($logs->avg('duration_minutes') ?? 0, 1);

        return [
            'target_visits' => $targetVisits,
            'unique_visits' => $uniqueVisits,
            'total_visits' => $logs->count(),
            'duplicate_visits' => $duplicateVisits,
            'completion_pct' => $targetVisits > 0 ? round(($uniqueVisits / $targetVisits) * 100, 1) : 0,
            'order_taken' => $orderTaken,
            'closed_visits' => $logs->where('visit_result', 'closed')->count(),
            'visited_stores' => $logs->pluck('store_id')->filter()->unique()->count(),
            'active_sales' => $sales->count(),
            'online_sales' => $sales->where('is_online', true)->count(),
            'avg_duration_min' => $avgDuration,
            'photo_count' => $logs->sum(fn (VisitLog $visitLog) => $visitLog->photos->count()),
            'mock_pings' => $pings->where('is_mock_location', true)->count(),
            'warning_count' => $warnings->count(),
        ];
    }

    private function branchPerformance(
        User $viewer,
        Collection $users,
        Collection $sales,
        Collection $logs,
        Collection $pings,
        ?int $teamId = null,
    ): Collection {
        $teams = $this->visibleTeams($viewer)
            ->when($teamId, fn (Collection $collection) => $collection->where('id', $teamId))
            ->values();

        return $teams->map(function (Team $team) use ($users, $sales, $logs, $pings) {
            $teamUserIds = $users
                ->where('team_id', $team->id)
                ->pluck('id')
                ->values();
            $teamSales = $sales->whereIn('user_id', $teamUserIds)->values();
            $teamLogs = $logs->whereIn('user_id', $teamUserIds)->values();
            $teamPings = $pings->whereIn('user_id', $teamUserIds)->values();

            $targetVisits = $teamSales->sum(fn (array $item) => $item['summary']['target_visits'] ?? 0);
            $uniqueVisits = $teamSales->sum(fn (array $item) => $item['summary']['unique_visits'] ?? 0);

            return [
                'team_id' => $team->id,
                'team_name' => $team->name,
                'team_code' => $team->code,
                'area' => $team->area,
                'sales_count' => $teamSales->count(),
                'target_visits' => $targetVisits,
                'unique_visits' => $uniqueVisits,
                'total_visits' => $teamLogs->count(),
                'completion_pct' => $targetVisits > 0 ? round(($uniqueVisits / $targetVisits) * 100, 1) : 0,
                'duplicate_visits' => $teamLogs->where('is_duplicate', true)->count(),
                'mock_pings' => $teamPings->where('is_mock_location', true)->count(),
                'invalid_checkins' => $teamLogs->where('checkin_valid', false)->count(),
                'open_visits' => $teamLogs->whereNull('checkout_at')->count(),
                'order_taken' => $teamLogs->where('visit_result', 'order_taken')->count(),
            ];
        })->sortByDesc('completion_pct')->values();
    }

    private function salesPerformance(Collection $sales): Collection
    {
        return $sales
            ->map(function (array $item) {
                $summary = $item['summary'] ?? [];
                $warnings = $item['warnings'] ?? [];
                $riskScore = count($warnings)
                    + (int) ($summary['duplicate_visits'] ?? 0)
                    + (int) ($summary['mock_detected'] ?? 0)
                    + (int) ($summary['invalid_checkins'] ?? 0);

                return [
                    'user_id' => $item['user_id'] ?? null,
                    'name' => $item['name'] ?? '-',
                    'employee_id' => $item['employee_id'] ?? null,
                    'team' => $item['team'] ?? $item['branch'] ?? '-',
                    'is_online' => (bool) ($item['is_online'] ?? false),
                    'target_visits' => $summary['target_visits'] ?? 0,
                    'unique_visits' => $summary['unique_visits'] ?? 0,
                    'total_visits' => ($summary['unique_visits'] ?? 0) + ($summary['duplicate_visits'] ?? 0),
                    'duplicate_visits' => $summary['duplicate_visits'] ?? 0,
                    'completion_pct' => $summary['completion_pct'] ?? 0,
                    'order_taken' => $summary['order_taken'] ?? 0,
                    'avg_duration_min' => $summary['avg_duration_min'] ?? 0,
                    'mock_detected' => $summary['mock_detected'] ?? 0,
                    'invalid_checkins' => $summary['invalid_checkins'] ?? 0,
                    'warning_count' => count($warnings),
                    'risk_score' => $riskScore,
                    'last_visit_at' => $summary['last_visit_at'] ?? null,
                ];
            })
            ->sortByDesc('risk_score')
            ->values();
    }

    private function auditSummary(Collection $logs, Collection $pings, Collection $warnings): array
    {
        $openVisits = $logs->whereNull('checkout_at')->count();
        $mockPings = $pings->where('is_mock_location', true)->count();
        $mockUsers = $pings->where('is_mock_location', true)->pluck('user_id')->unique()->count();

        return [
            'missing_target_days' => $warnings->count(),
            'duplicate_visits' => $logs->where('is_duplicate', true)->count(),
            'invalid_checkins' => $logs->where('checkin_valid', false)->count(),
            'mock_visit_logs' => $logs->where('is_mock_location', true)->count(),
            'mock_location_pings' => $mockPings,
            'mock_location_users' => $mockUsers,
            'open_visits' => $openVisits,
            'visits_without_photos' => $logs->filter(fn (VisitLog $visitLog) => $visitLog->photos->isEmpty())->count(),
            'checkout_missing_pct' => $logs->count() > 0 ? round(($openVisits / $logs->count()) * 100, 1) : 0,
        ];
    }

    private function auditExceptions(Collection $logs, Collection $pings, Collection $warnings): Collection
    {
        $missingTargets = $warnings->map(fn (array $warning) => [
            'type' => 'missing_target',
            'severity' => 'medium',
            'date' => $warning['date'] ?? null,
            'user_id' => $warning['user_id'] ?? null,
            'sales_name' => $warning['name'] ?? '-',
            'team' => $warning['team'] ?? $warning['branch'] ?? '-',
            'store_name' => null,
            'message' => $warning['message'] ?? 'Target kunjungan belum tercapai.',
        ]);

        $flaggedVisits = $logs
            ->filter(fn (VisitLog $visitLog) => $visitLog->is_duplicate || $visitLog->is_mock_location || ! $visitLog->checkin_valid || $visitLog->checkout_at === null)
            ->map(function (VisitLog $visitLog) {
                $type = 'open_visit';
                $severity = 'medium';
                $message = 'Kunjungan belum checkout.';

                if ($visitLog->is_mock_location) {
                    $type = 'mock_visit';
                    $severity = 'high';
                    $message = 'Visit tercatat dengan indikasi fake GPS.';
                } elseif (! $visitLog->checkin_valid) {
                    $type = 'invalid_checkin';
                    $severity = 'high';
                    $message = 'Check-in berada di luar aturan validasi lokasi.';
                } elseif ($visitLog->is_duplicate) {
                    $type = 'duplicate_visit';
                    $severity = 'medium';
                    $message = $visitLog->duplicate_reason ?: 'Kunjungan duplikat pada toko dan tanggal yang sama.';
                }

                return [
                    'type' => $type,
                    'severity' => $severity,
                    'date' => $visitLog->visit_date?->toDateString(),
                    'user_id' => $visitLog->user_id,
                    'sales_name' => $visitLog->user?->name ?? '-',
                    'team' => $visitLog->user?->team?->name ?? '-',
                    'store_name' => $visitLog->store?->name,
                    'message' => $message,
                    'visit_log_id' => $visitLog->id,
                ];
            });

        $mockPingUsers = $pings
            ->where('is_mock_location', true)
            ->groupBy('user_id')
            ->map(function (Collection $group) {
                $first = $group->first();

                return [
                    'type' => 'mock_location_ping',
                    'severity' => 'high',
                    'date' => $first?->recorded_at?->toDateString(),
                    'user_id' => $first?->user_id,
                    'sales_name' => $first?->user?->name ?? '-',
                    'team' => $first?->user?->team?->name ?? '-',
                    'store_name' => null,
                    'message' => $group->count().' ping lokasi terindikasi fake GPS.',
                    'ping_count' => $group->count(),
                ];
            })
            ->values();

        return $missingTargets
            ->merge($flaggedVisits)
            ->merge($mockPingUsers)
            ->sortBy([
                fn (array $a, array $b) => $this->severityWeight($b['severity']) <=> $this->severityWeight($a['severity']),
                fn (array $a, array $b) => strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? '')),
            ])
            ->values();
    }

    private function loadLocationPings(Collection $users, string $dateFrom, string $dateTo): Collection
    {
        $userIds = $users->pluck('id')->values();

        if ($userIds->isEmpty()) {
            return collect();
        }

        $start = Carbon::parse($dateFrom, self::LOCAL_TIMEZONE)->startOfDay();
        $end = Carbon::parse($dateTo, self::LOCAL_TIMEZONE)->endOfDay();

        return LocationPing::query()
            ->with('user.team')
            ->whereIn('user_id', $userIds)
            ->whereBetween('recorded_at', [$start, $end])
            ->orderByDesc('recorded_at')
            ->get();
    }

    private function severityWeight(string $severity): int
    {
        return match ($severity) {
            'high' => 3,
            'medium' => 2,
            default => 1,
        };
    }
}
