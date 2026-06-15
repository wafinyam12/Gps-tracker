<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Store;
use App\Models\VisitSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduleManagementController extends Controller
{
    /**
     * Assign jadwal kunjungan ke sales (bulk)
     * Role: spv, admin
     */
    public function assign(Request $request)
    {
        $request->validate([
            'user_id'    => 'required|exists:users,id',
            'visit_date' => 'required|date_format:Y-m-d|after_or_equal:today',
            'stores'     => 'required|array|min:1',
            'stores.*'   => 'exists:stores,id',
        ]);

        $user = User::whereHas('roles', fn($q) => $q->whereIn('name', ['sales', 'spv']))
            ->findOrFail($request->user_id);

        // Cek apakah stores ada yang sudah dijadwalkan di hari yang sama
        $existing = VisitSchedule::where('user_id', $user->id)
            ->whereDate('visit_date', $request->visit_date)
            ->whereIn('store_id', $request->stores)
            ->pluck('store_id')
            ->toArray();

        if (! empty($existing)) {
            $storeNames = Store::whereIn('id', $existing)->pluck('name');
            return response()->error(
                'Beberapa toko sudah dijadwalkan di hari ini.',
                422,
                ['stores' => $storeNames]
            );
        }

        DB::transaction(function () use ($request, $user) {
            // Ambil sequence terakhir untuk hari itu
            $lastSeq = VisitSchedule::where('user_id', $user->id)
                ->whereDate('visit_date', $request->visit_date)
                ->max('sequence') ?? 0;

            foreach ($request->stores as $index => $storeId) {
                VisitSchedule::create([
                    'user_id'     => $user->id,
                    'store_id'    => $storeId,
                    'visit_date'  => $request->visit_date,
                    'sequence'    => $lastSeq + $index + 1,
                    'status'      => 'pending',
                    'assigned_by' => $request->user()->id,
                ]);
            }
        });

        return response()->success([
            'total'   => count($request->stores),
        ], 'Jadwal berhasil diassign.', 201);
    }

    /**
     * Assign jadwal bulk untuk banyak sales sekaligus
     * Role: admin
     */
    public function bulkAssign(Request $request)
    {
        $request->validate([
            'visit_date'  => 'required|date_format:Y-m-d|after_or_equal:today',
            'assignments' => 'required|array|min:1',
            'assignments.*.user_id'  => 'required|exists:users,id',
            'assignments.*.store_ids' => 'required|array|min:1',
            'assignments.*.store_ids.*' => 'exists:stores,id',
        ]);

        $created = 0;
        $skipped = 0;

        DB::transaction(function () use ($request, &$created, &$skipped) {
            foreach ($request->assignments as $assignment) {
                $lastSeq = VisitSchedule::where('user_id', $assignment['user_id'])
                    ->whereDate('visit_date', $request->visit_date)
                    ->max('sequence') ?? 0;

                foreach ($assignment['store_ids'] as $index => $storeId) {
                    $exists = VisitSchedule::where('user_id', $assignment['user_id'])
                        ->whereDate('visit_date', $request->visit_date)
                        ->where('store_id', $storeId)
                        ->exists();

                    if ($exists) {
                        $skipped++;
                        continue;
                    }

                    VisitSchedule::create([
                        'user_id'     => $assignment['user_id'],
                        'store_id'    => $storeId,
                        'visit_date'  => $request->visit_date,
                        'sequence'    => $lastSeq + $index + 1,
                        'status'      => 'pending',
                        'assigned_by' => $request->user()->id,
                    ]);

                    $created++;
                }
            }
        });

        return response()->success([
            'created' => $created,
            'skipped' => $skipped,
        ], 'Bulk assign selesai.', 201);
    }

    /**
     * Update urutan sequence kunjungan
     * Role: spv, admin
     */
    public function reorder(Request $request)
    {
        $request->validate([
            'schedules'          => 'required|array|min:1',
            'schedules.*.id'     => 'required|exists:visit_schedules,id',
            'schedules.*.sequence' => 'required|integer|min:1',
        ]);

        DB::transaction(function () use ($request) {
            foreach ($request->schedules as $item) {
                VisitSchedule::where('id', $item['id'])
                    ->update(['sequence' => $item['sequence']]);
            }
        });

        return response()->success(null, 'Urutan kunjungan diupdate.');
    }

    /**
     * Hapus jadwal yang belum dikunjungi
     * Role: spv, admin
     */
    public function destroy(VisitSchedule $schedule)
    {
        if (! in_array($schedule->status, ['pending', 'rescheduled'])) {
            return response()->error(
                'Hanya jadwal dengan status pending yang bisa dihapus.',
                422
            );
        }

        $schedule->delete();

        return response()->success(null, 'Jadwal berhasil dihapus.');
    }

    /**
     * Summary kunjungan per sales untuk 1 hari (SPV dashboard)
     * Role: spv, admin
     */
    public function summary(Request $request)
    {
        $request->validate([
            'date'    => 'required|date_format:Y-m-d',
            'team_id' => 'nullable|exists:teams,id',
        ]);

        $salesList = User::with(['schedules' => function ($q) use ($request) {
                $q->whereDate('visit_date', $request->date)
                  ->with('visitLog');
            }])
            ->whereHas('roles', fn($q) => $q->whereIn('name', ['sales', 'spv']))
            ->where('is_active', true)
            ->when($request->team_id, fn($q) => $q->where('team_id', $request->team_id))
            ->get()
            ->map(function ($user) {
                $schedules   = $user->schedules;
                $total       = $schedules->count();
                $completed   = $schedules->where('status', 'completed')->count();
                $inProgress  = $schedules->where('status', 'in_progress')->count();
                $pending     = $schedules->where('status', 'pending')->count();
                $skipped     = $schedules->where('status', 'skipped')->count();

                // Hitung valid vs invalid checkin
                $validCheckins = $schedules->filter(
                    fn($s) => $s->visitLog?->checkin_valid === true
                )->count();

                $mockDetected = $schedules->filter(
                    fn($s) => $s->visitLog?->is_mock_location === true
                )->count();

                return [
                    'user_id'        => $user->id,
                    'name'           => $user->name,
                    'employee_id'    => $user->employee_id,
                    'last_seen_at'   => $user->last_seen_at?->toISOString(),
                    'is_online'      => $user->last_seen_at
                                         ? $user->last_seen_at->diffInMinutes(now()) <= 10
                                         : false,
                    'summary'        => [
                        'total'          => $total,
                        'completed'      => $completed,
                        'in_progress'    => $inProgress,
                        'pending'        => $pending,
                        'skipped'        => $skipped,
                        'valid_checkins' => $validCheckins,
                        'mock_detected'  => $mockDetected,
                        'completion_pct' => $total > 0
                                             ? round(($completed / $total) * 100)
                                             : 0,
                    ],
                ];
            });

        return response()->success([
            'date'  => $request->date,
            'total_sales' => $salesList->count(),
            'team_summary' => [
                'total_schedules' => $salesList->sum('summary.total'),
                'total_completed' => $salesList->sum('summary.completed'),
                'total_skipped'   => $salesList->sum('summary.skipped'),
                'avg_completion'  => $salesList->avg('summary.completion_pct'),
            ],
            'sales' => $salesList,
        ]);
    }
}
