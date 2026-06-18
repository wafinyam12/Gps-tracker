<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyTarget;
use App\Models\VisitLog;
use App\Services\Visits\VisitAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyTargetController extends Controller
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private readonly VisitAnalyticsService $analytics,
    ) {
    }

    public function today(Request $request)
    {
        $request->validate([
            'date' => 'nullable|date_format:Y-m-d',
        ]);

        $user = $request->user();
        $date = $request->input('date', now(self::LOCAL_TIMEZONE)->toDateString());

        $users = $this->analytics->scopeUsers(userId: $user->id);
        $logs = $this->analytics->loadVisits(
            dateFrom: $date,
            dateTo: $date,
            userId: $user->id,
        );

        $sales = $this->analytics->summarizeByUser($users, $logs, $date, $date)->first() ?? [];
        $openVisit = VisitLog::with(['store', 'user', 'photos'])
            ->where('user_id', $user->id)
            ->whereNull('checkout_at')
            ->latest('checkin_at')
            ->first();

        $summary = $sales['summary'] ?? [
            'target_visits'    => 0,
            'unique_visits'    => 0,
            'duplicate_visits' => 0,
            'completion_pct'   => 0,
            'last_visit_at'    => null,
        ];

        $summary['remaining_visits'] = max(($summary['target_visits'] ?? 0) - ($summary['unique_visits'] ?? 0), 0);

        return response()->success([
            'period' => [
                'date' => $date,
            ],
            'stats' => $summary,
            'visits' => $logs->map(function (VisitLog $visitLog) {
                return [
                    'id'                => $visitLog->id,
                    'visit_date'        => $visitLog->visit_date?->toDateString(),
                    'store'             => [
                        'id'              => $visitLog->store?->id,
                        'code'            => $visitLog->store?->code,
                        'external_bp_code'=> $visitLog->store?->external_bp_code,
                        'name'            => $visitLog->store?->name,
                        'address'         => $visitLog->store?->address,
                        'branch'          => $visitLog->store?->branch,
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
                    'id'              => $openVisit->store?->id,
                    'code'            => $openVisit->store?->code,
                    'external_bp_code'=> $openVisit->store?->external_bp_code,
                    'name'            => $openVisit->store?->name,
                    'address'         => $openVisit->store?->address,
                    'branch'          => $openVisit->store?->branch,
                ],
                'checkin_at'   => $openVisit->checkin_at?->toISOString(),
            ] : null,
            'warnings' => $sales['warnings'] ?? [],
        ]);
    }

    public function set(Request $request)
    {
        $request->validate([
            'user_id'       => 'required|exists:users,id',
            'target_date'   => 'required|date_format:Y-m-d',
            'target_visits' => 'required|integer|min:1|max:100',
        ]);

        $target = DailyTarget::setTarget(
            userId: (int) $request->user_id,
            date: $request->target_date,
            targetVisits: (int) $request->target_visits,
            setBy: $request->user()->id,
        );

        return response()->success([
            'target' => $this->formatTarget($target),
        ], 'Target harian berhasil disimpan.', 201);
    }

    public function bulkSet(Request $request)
    {
        $request->validate([
            'target_date'   => 'required|date_format:Y-m-d',
            'target_visits' => 'required|integer|min:1|max:100',
            'user_ids'      => 'required|array|min:1',
            'user_ids.*'    => 'required|exists:users,id',
        ]);

        $targets = DB::transaction(function () use ($request) {
            return collect($request->user_ids)->map(function ($userId) use ($request) {
                $target = DailyTarget::setTarget(
                    userId: (int) $userId,
                    date: $request->target_date,
                    targetVisits: (int) $request->target_visits,
                    setBy: $request->user()->id,
                );

                return $this->formatTarget($target);
            })->values();
        });

        return response()->success([
            'targets' => $targets,
        ], 'Target harian berhasil diperbarui.', 201);
    }

    private function formatTarget(DailyTarget $target): array
    {
        $target->loadMissing(['user', 'setter']);

        return [
            'id'            => $target->id,
            'user_id'       => $target->user_id,
            'user_name'     => $target->user?->name,
            'target_date'   => $target->target_date?->toDateString(),
            'target_visits' => $target->target_visits,
            'set_by'        => $target->set_by,
            'set_by_name'   => $target->setter?->name,
        ];
    }
}
