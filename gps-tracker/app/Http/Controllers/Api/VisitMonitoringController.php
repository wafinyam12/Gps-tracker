<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VisitLog;
use App\Services\Visits\VisitAnalyticsService;
use Illuminate\Http\Request;

class VisitMonitoringController extends Controller
{
    public function __construct(
        private readonly VisitAnalyticsService $analytics,
    ) {
    }

    public function summary(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'user_id'   => 'nullable|exists:users,id',
            'team_id'   => 'nullable|exists:teams,id',
        ]);

        $users = $this->analytics->scopeUsers(
            viewer: $request->user(),
            userId: $request->user_id,
            teamId: $request->team_id,
        );

        $logs = $this->analytics->loadVisits(
            dateFrom: $request->date_from,
            dateTo: $request->date_to,
            viewer: $request->user(),
            userId: $request->user_id,
            teamId: $request->team_id,
        );

        $sales = $this->analytics->summarizeByUser($users, $logs, $request->date_from, $request->date_to);
        $daily = $this->analytics->summarizeByDate($users, $logs, $request->date_from, $request->date_to);
        $warnings = $daily->pluck('warnings')->flatten(1)->values();

        $overviewTarget = $sales->sum(fn (array $item) => $item['summary']['target_visits'] ?? 0);
        $overviewUnique = $sales->sum(fn (array $item) => $item['summary']['unique_visits'] ?? 0);
        $overviewDuplicate = $sales->sum(fn (array $item) => $item['summary']['duplicate_visits'] ?? 0);

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'overview' => [
                'target_visits'    => $overviewTarget,
                'unique_visits'    => $overviewUnique,
                'duplicate_visits' => $overviewDuplicate,
                'completion_pct'   => $overviewTarget > 0
                    ? round(($overviewUnique / $overviewTarget) * 100, 1)
                    : 0,
                'warning_count'    => $warnings->count(),
                'total_sales'      => $sales->count(),
                'total_visits'     => $logs->count(),
            ],
            'team_summary' => [
                'total_target'     => $overviewTarget,
                'total_unique'     => $overviewUnique,
                'total_duplicate'  => $overviewDuplicate,
                'avg_completion'   => $overviewTarget > 0
                    ? round(($overviewUnique / $overviewTarget) * 100, 1)
                    : 0,
                'warning_count'    => $warnings->count(),
            ],
            'daily'    => $daily,
            'sales'    => $sales,
            'warnings' => $warnings,
        ]);
    }

    public function detail(Request $request, User $user)
    {
        $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        if (! $this->canViewUser($request->user(), $user)) {
            return response()->error('Anda hanya dapat melihat cabang sendiri.', 403);
        }

        $users = $this->analytics->scopeUsers(
            viewer: $request->user(),
            userId: $user->id
        );

        $logs = $this->analytics->loadVisits(
            dateFrom: $request->date,
            dateTo: $request->date,
            viewer: $request->user(),
            userId: $user->id,
        );

        $sales = $this->analytics->summarizeByUser($users, $logs, $request->date, $request->date)->first() ?? [];
        $openVisit = VisitLog::with(['store', 'user', 'photos'])
            ->where('user_id', $user->id)
            ->whereNull('checkout_at')
            ->latest('checkin_at')
            ->first();

        return response()->success([
            'period' => [
                'date' => $request->date,
            ],
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'employee_id' => $user->employee_id,
                'branch' => $user->team?->name,
                'team' => $user->team?->name,
            ],
            'stats' => $sales['summary'] ?? [
                'target_visits'    => 0,
                'unique_visits'    => 0,
                'duplicate_visits' => 0,
                'completion_pct'   => 0,
                'last_visit_at'    => null,
                'remaining_visits' => 0,
            ],
            'visits' => $logs->map(function (VisitLog $visitLog) {
                return [
                    'id'                => $visitLog->id,
                    'visit_date'        => $visitLog->visit_date?->toDateString(),
                    'store'             => [
                        'id'               => $visitLog->store?->id,
                        'code'             => $visitLog->store?->code,
                        'external_bp_code' => $visitLog->store?->external_bp_code,
                        'name'             => $visitLog->store?->name,
                        'address'          => $visitLog->store?->address,
                        'branch'           => $visitLog->store?->branch,
                    ],
                    'checkin_at'        => $visitLog->checkin_at?->toISOString(),
                    'checkout_at'       => $visitLog->checkout_at?->toISOString(),
                    'is_duplicate'      => $visitLog->is_duplicate,
                    'counted_as_target' => $visitLog->counted_as_target,
                    'visit_result'      => $visitLog->visit_result,
                    'notes'             => $visitLog->notes,
                    'duration_minutes'  => $visitLog->duration_minutes,
                ];
            }),
            'open_visit' => $openVisit ? [
                'visit_log_id' => $openVisit->id,
                'store'        => [
                    'id'               => $openVisit->store?->id,
                    'code'             => $openVisit->store?->code,
                    'external_bp_code' => $openVisit->store?->external_bp_code,
                    'name'             => $openVisit->store?->name,
                    'address'          => $openVisit->store?->address,
                    'branch'           => $openVisit->store?->branch,
                ],
                'checkin_at'   => $openVisit->checkin_at?->toISOString(),
            ] : null,
            'warnings' => $sales['warnings'] ?? [],
        ]);
    }

    private function canViewUser(User $viewer, User $target): bool
    {
        if ($viewer->canAccessAllBranches()) {
            return true;
        }

        if ($viewer->isBranchAdmin()) {
            return $viewer->team_id !== null
                && (int) $viewer->team_id === (int) $target->team_id
                && $target->hasRole('sales');
        }

        if ($viewer->hasRole('spv')) {
            return $viewer->team_id !== null && (int) $viewer->team_id === (int) $target->team_id;
        }

        return $viewer->id === $target->id;
    }
}
