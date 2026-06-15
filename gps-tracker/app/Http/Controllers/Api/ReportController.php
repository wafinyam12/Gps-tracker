<?php

namespace App\Http\Controllers\Api;

use App\Exports\SalesSummaryExport;
use App\Exports\VisitReportExport;
use App\Http\Controllers\Controller;
use App\Models\VisitLog;
use App\Models\VisitSchedule;
use App\Models\User;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ReportController extends Controller
{
    /**
     * Rekap kunjungan harian / range tanggal (JSON)
     * Role: spv, admin
     */
    public function visitSummary(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'user_id'   => 'nullable|exists:users,id',
            'team_id'   => 'nullable|exists:teams,id',
        ]);

        $schedules = VisitSchedule::with(['visitLog', 'user', 'store'])
            ->whereBetween('visit_date', [$request->date_from, $request->date_to])
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->team_id, fn($q) => $q->whereHas('user', function ($q) use ($request) {
                $q->where('team_id', $request->team_id);
            }))
            ->get();

        $logs = $schedules->pluck('visitLog')->filter();

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'overview' => [
                'total_schedules'    => $schedules->count(),
                'completed'          => $schedules->where('status', 'completed')->count(),
                'skipped'            => $schedules->where('status', 'skipped')->count(),
                'pending'            => $schedules->whereIn('status', ['pending', 'rescheduled'])->count(),
                'in_progress'        => $schedules->where('status', 'in_progress')->count(),
                'completion_pct'     => $schedules->count() > 0
                    ? round(($schedules->where('status', 'completed')->count() / $schedules->count()) * 100, 1)
                    : 0,
            ],
            'visit_results' => [
                'order_taken' => $logs->where('visit_result', 'order_taken')->count(),
                'no_order'    => $logs->where('visit_result', 'no_order')->count(),
                'closed'      => $logs->where('visit_result', 'closed')->count(),
                'not_found'   => $logs->where('visit_result', 'not_found')->count(),
                'postponed'   => $logs->where('visit_result', 'postponed')->count(),
            ],
            'quality' => [
                'valid_checkins'   => $logs->where('checkin_valid', true)->count(),
                'invalid_checkins' => $logs->where('checkin_valid', false)->count(),
                'mock_detected'    => $logs->where('is_mock_location', true)->count(),
                'avg_duration_min' => round($logs->avg('duration_minutes') ?? 0, 1),
                'avg_distance_m'   => round($logs->avg('checkin_distance') ?? 0, 1),
            ],
        ]);
    }

    /**
     * Rekap per sales (JSON)
     * Role: spv, admin
     */
    public function perSales(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'team_id'   => 'nullable|exists:teams,id',
        ]);

        $salesList = User::with(['team', 'schedules' => function ($q) use ($request) {
                $q->whereBetween('visit_date', [$request->date_from, $request->date_to])
                  ->with('visitLog');
            }])
            ->whereHas('roles', fn($q) => $q->whereIn('name', ['sales', 'spv']))
            ->where('is_active', true)
            ->when($request->team_id, fn($q) => $q->where('team_id', $request->team_id))
            ->orderBy('name')
            ->get()
            ->map(function ($user) {
                $schedules = $user->schedules;
                $logs      = $schedules->pluck('visitLog')->filter();
                $total     = $schedules->count();
                $completed = $schedules->where('status', 'completed')->count();

                return [
                    'user_id'     => $user->id,
                    'name'        => $user->name,
                    'employee_id' => $user->employee_id,
                    'team'        => $user->team?->name,
                    'stats' => [
                        'total'            => $total,
                        'completed'        => $completed,
                        'skipped'          => $schedules->where('status', 'skipped')->count(),
                        'pending'          => $schedules->whereIn('status', ['pending', 'rescheduled'])->count(),
                        'completion_pct'   => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
                        'order_taken'      => $logs->where('visit_result', 'order_taken')->count(),
                        'avg_duration_min' => round($logs->avg('duration_minutes') ?? 0, 1),
                        'mock_detected'    => $logs->where('is_mock_location', true)->count(),
                        'invalid_checkins' => $logs->where('checkin_valid', false)->count(),
                    ],
                ];
            });

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'total_sales' => $salesList->count(),
            'data'        => $salesList,
        ]);
    }

    /**
     * Rekap per toko — toko mana yang paling sering dikunjungi, hasil kunjungannya
     * Role: spv, admin
     */
    public function perStore(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
            'area'      => 'nullable|string',
        ]);

        $data = VisitSchedule::with(['store', 'visitLog'])
            ->whereBetween('visit_date', [$request->date_from, $request->date_to])
            ->when($request->area, fn($q) => $q->whereHas('store', function ($q) use ($request) {
                $q->where('area', $request->area);
            }))
            ->get()
            ->groupBy('store_id')
            ->map(function ($schedules) {
                $store = $schedules->first()->store;
                $logs  = $schedules->pluck('visitLog')->filter();

                return [
                    'store_id'   => $store->id,
                    'store_code' => $store->code,
                    'store_name' => $store->name,
                    'area'       => $store->area,
                    'city'       => $store->city,
                    'stats'      => [
                        'total_scheduled' => $schedules->count(),
                        'completed'       => $schedules->where('status', 'completed')->count(),
                        'skipped'         => $schedules->where('status', 'skipped')->count(),
                        'order_taken'     => $logs->where('visit_result', 'order_taken')->count(),
                        'closed'          => $logs->where('visit_result', 'closed')->count(),
                        'avg_duration_min' => round($logs->avg('duration_minutes') ?? 0, 1),
                    ],
                ];
            })
            ->values();

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'total_stores' => $data->count(),
            'data'         => $data,
        ]);
    }

    /**
     * Export Excel — detail kunjungan
     * Role: spv, admin
     */
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
                userId: $request->user_id,
                teamId: $request->team_id,
            ),
            $filename,
        );
    }

    /**
     * Export Excel — summary per sales
     * Role: spv, admin
     */
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
                teamId: $request->team_id,
            ),
            $filename,
        );
    }

    /**
     * Report kunjungan milik sales sendiri
     * Role: sales
     */
    public function mySummary(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date_format:Y-m-d',
            'date_to'   => 'required|date_format:Y-m-d|after_or_equal:date_from',
        ]);

        $user      = $request->user();
        $schedules = VisitSchedule::with(['store', 'visitLog'])
            ->where('user_id', $user->id)
            ->whereBetween('visit_date', [$request->date_from, $request->date_to])
            ->orderBy('visit_date')
            ->orderBy('sequence')
            ->get();

        $logs  = $schedules->pluck('visitLog')->filter();
        $total = $schedules->count();
        $completed = $schedules->where('status', 'completed')->count();

        return response()->success([
            'period' => [
                'from' => $request->date_from,
                'to'   => $request->date_to,
            ],
            'stats' => [
                'total'            => $total,
                'completed'        => $completed,
                'skipped'          => $schedules->where('status', 'skipped')->count(),
                'pending'          => $schedules->whereIn('status', ['pending', 'rescheduled'])->count(),
                'completion_pct'   => $total > 0 ? round(($completed / $total) * 100, 1) : 0,
                'order_taken'      => $logs->where('visit_result', 'order_taken')->count(),
                'avg_duration_min' => round($logs->avg('duration_minutes') ?? 0, 1),
            ],
            'visits' => $schedules->map(fn($schedule) => [
                'date'         => $schedule->visit_date->format('d/m/Y'),
                'sequence'     => $schedule->sequence,
                'store'        => $schedule->store->name,
                'status'       => $schedule->status,
                'checkin_at'   => $schedule->visitLog?->checkin_at?->format('H:i'),
                'checkout_at'  => $schedule->visitLog?->checkout_at?->format('H:i'),
                'duration_min' => $schedule->visitLog?->duration_minutes,
                'visit_result' => $schedule->visitLog?->visit_result,
                'notes'        => $schedule->visitLog?->notes,
            ]),
        ]);
    }
}
