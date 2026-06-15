<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitSchedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    /**
     * Daftar jadwal kunjungan sales hari ini
     * Role: sales
     */
    public function today(Request $request)
    {
        $schedules = VisitSchedule::with(['store', 'visitLog'])
            ->where('user_id', $request->user()->id)
            ->whereDate('visit_date', today())
            ->orderBy('sequence')
            ->get()
            ->map(fn($schedule) => [
                'id'       => $schedule->id,
                'sequence' => $schedule->sequence,
                'status'   => $schedule->status,
                'store'    => [
                    'id'               => $schedule->store->id,
                    'name'             => $schedule->store->name,
                    'address'          => $schedule->store->address,
                    'latitude'         => $schedule->store->location->latitude,
                    'longitude'        => $schedule->store->location->longitude,
                    'geofence_radius'  => $schedule->store->geofence_radius,
                    'pic_name'         => $schedule->store->pic_name,
                    'pic_phone'        => $schedule->store->pic_phone,
                ],
                'visit_log' => $schedule->visitLog ? [
                    'id'               => $schedule->visitLog->id,
                    'checkin_at'       => $schedule->visitLog->checkin_at?->toISOString(),
                    'checkout_at'      => $schedule->visitLog->checkout_at?->toISOString(),
                    'checkin_valid'    => $schedule->visitLog->checkin_valid,
                    'checkin_distance' => $schedule->visitLog->checkin_distance,
                    'duration_minutes' => $schedule->visitLog->duration_minutes,
                    'visit_result'     => $schedule->visitLog->visit_result,
                    'notes'            => $schedule->visitLog->notes,
                    'form_data'        => $schedule->visitLog->form_data,
                ] : null,
            ]);

        $summary = [
            'total'       => $schedules->count(),
            'pending'     => $schedules->where('status', 'pending')->count(),
            'in_progress' => $schedules->where('status', 'in_progress')->count(),
            'completed'   => $schedules->where('status', 'completed')->count(),
            'skipped'     => $schedules->where('status', 'skipped')->count(),
        ];

        return response()->success([
            'date'      => today()->toDateString(),
            'summary'   => $summary,
            'schedules' => $schedules,
        ]);
    }

    /**
     * Daftar jadwal by tanggal (untuk SPV lihat jadwal team)
     * Role: spv, admin
     */
    public function byDate(Request $request)
    {
        $request->validate([
            'date'    => 'required|date_format:Y-m-d',
            'user_id' => 'nullable|exists:users,id',
            'team_id' => 'nullable|exists:teams,id',
        ]);

        $schedules = VisitSchedule::with(['store', 'user', 'visitLog'])
            ->whereDate('visit_date', $request->date)
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->team_id, fn($q) => $q->whereHas('user', function ($q) use ($request) {
                $q->where('team_id', $request->team_id);
            }))
            ->orderBy('user_id')
            ->orderBy('sequence')
            ->get()
            ->map(fn($schedule) => [
                'id'         => $schedule->id,
                'sequence'   => $schedule->sequence,
                'status'     => $schedule->status,
                'skip_reason' => $schedule->skip_reason,
                'user'       => [
                    'id'   => $schedule->user->id,
                    'name' => $schedule->user->name,
                ],
                'store'      => [
                    'id'               => $schedule->store->id,
                    'name'             => $schedule->store->name,
                    'address'          => $schedule->store->address,
                    'latitude'         => $schedule->store->location->latitude,
                    'longitude'        => $schedule->store->location->longitude,
                    'geofence_radius'  => $schedule->store->geofence_radius,
                    'pic_name'         => $schedule->store->pic_name,
                    'pic_phone'        => $schedule->store->pic_phone,
                ],
                'visit_log'  => $schedule->visitLog ? [
                    'id'               => $schedule->visitLog->id,
                    'checkin_at'       => $schedule->visitLog->checkin_at?->toISOString(),
                    'checkout_at'      => $schedule->visitLog->checkout_at?->toISOString(),
                    'checkin_valid'    => $schedule->visitLog->checkin_valid,
                    'checkin_distance' => $schedule->visitLog->checkin_distance,
                    'duration_minutes' => $schedule->visitLog->duration_minutes,
                    'visit_result'     => $schedule->visitLog->visit_result,
                ] : null,
            ]);

        return response()->success([
            'date'      => $request->date,
            'total'     => $schedules->count(),
            'schedules' => $schedules,
        ]);
    }
}
