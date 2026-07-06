<?php

namespace App\Http\Controllers\Web;

use App\Exports\SalesSummaryExport;
use App\Exports\VisitReportExport;
use App\Http\Controllers\Controller;
use App\Services\Crm\CrmAnalyticsService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class CrmDashboardController extends Controller
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private readonly CrmAnalyticsService $crmAnalytics,
    ) {
    }

    public function index(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $viewer = $request->user();

        $dashboard = $this->crmAnalytics->dashboard($viewer, $filters);
        $teams = $this->crmAnalytics->visibleTeams($viewer);
        $salesOptions = $this->crmAnalytics->visibleUsers($viewer, $filters['team_id'] ?? null);

        return view('crm.dashboard', [
            'dashboard' => $dashboard,
            'filters' => $filters,
            'teams' => $teams,
            'salesOptions' => $salesOptions,
            'viewer' => $viewer,
        ]);
    }

    public function exportVisits(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $filename = 'crm-laporan-kunjungan-'.$filters['date_from'].'-sd-'.$filters['date_to'].'.xlsx';

        return Excel::download(
            new VisitReportExport(
                dateFrom: $filters['date_from'],
                dateTo: $filters['date_to'],
                viewer: $request->user(),
                userId: $filters['user_id'] ?? null,
                teamId: $filters['team_id'] ?? null,
            ),
            $filename,
        );
    }

    public function exportSalesSummary(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $filename = 'crm-summary-sales-'.$filters['date_from'].'-sd-'.$filters['date_to'].'.xlsx';

        return Excel::download(
            new SalesSummaryExport(
                dateFrom: $filters['date_from'],
                dateTo: $filters['date_to'],
                viewer: $request->user(),
                teamId: $filters['team_id'] ?? null,
                userId: $filters['user_id'] ?? null,
            ),
            $filename,
        );
    }

    private function validatedFilters(Request $request): array
    {
        $today = now(self::LOCAL_TIMEZONE);
        $defaults = [
            'date_from' => $today->copy()->startOfMonth()->toDateString(),
            'date_to' => $today->toDateString(),
            'team_id' => null,
            'user_id' => null,
        ];

        $validated = $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $filters = array_merge($defaults, array_filter($validated, fn ($value) => $value !== null && $value !== ''));

        if (! isset($filters['date_to']) || ! $filters['date_to']) {
            $filters['date_to'] = Carbon::parse($filters['date_from'], self::LOCAL_TIMEZONE)->toDateString();
        }

        return $filters;
    }
}
