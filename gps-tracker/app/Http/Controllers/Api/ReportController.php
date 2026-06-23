<?php

namespace App\Http\Controllers\Api;

use App\Exports\SalesSummaryExport;
use App\Exports\VisitReportExport;
use App\Http\Controllers\Controller;
use App\Models\VisitLog;
use App\Services\Visits\VisitAnalyticsService;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    public function __construct(
        private readonly VisitAnalyticsService $analytics,
    ) {
    }

    public function perSales(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'team_id'   => 'nullable|exists:teams,id',
            'user_id'   => 'nullable|exists:users,id',
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

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'total_sales' => $sales->count(),
            'data'        => $sales,
        ]);
    }

    public function perStore(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'branch'    => 'nullable|string',
        ]);

        $logs = $this->analytics->loadVisits(
            dateFrom: $request->date_from,
            dateTo: $request->date_to,
            viewer: $request->user(),
        );

        if ($request->filled('branch')) {
            $logs = $logs->filter(function (VisitLog $visitLog) use ($request) {
                return str_contains(mb_strtolower((string) ($visitLog->store?->branch ?? '')), mb_strtolower($request->branch));
            })->values();
        }

        $stores = $this->analytics->summarizeByStore($logs);

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'total_stores' => $stores->count(),
            'data'         => $stores,
        ]);
    }

    public function exportVisits(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'user_id'   => 'nullable|exists:users,id',
            'team_id'   => 'nullable|exists:teams,id',
        ]);

        $filename = 'laporan-kunjungan-'.$request->date_from.'-sd-'.$request->date_to.'.xlsx';

        return Excel::download(
            new VisitReportExport(
                dateFrom: $request->date_from,
                dateTo: $request->date_to,
                viewer: $request->user(),
                userId: $request->user_id,
                teamId: $request->team_id,
            ),
            $filename,
        );
    }

    public function exportSalesSummary(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'team_id'   => 'nullable|exists:teams,id',
        ]);

        $filename = 'summary-sales-'.$request->date_from.'-sd-'.$request->date_to.'.xlsx';

        return Excel::download(
            new SalesSummaryExport(
                dateFrom: $request->date_from,
                dateTo: $request->date_to,
                viewer: $request->user(),
                teamId: $request->team_id,
            ),
            $filename,
        );
    }
}
