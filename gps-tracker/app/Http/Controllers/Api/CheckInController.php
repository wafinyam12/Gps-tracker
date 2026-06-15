<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\VisitLog;
use App\Models\VisitSchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\Point;

class CheckInController extends Controller
{
    /**
     * Mulai kunjungan mandiri dari mobile tanpa jadwal admin/SPV.
     * Sistem tetap membuat visit_schedule agar laporan harian tetap konsisten.
     */
    public function start(Request $request)
    {
        $request->validate([
            'store_id'         => 'nullable|exists:stores,id',
            'store_code'       => 'required_without:store_id|nullable|string|max:100',
            'store_name'       => 'required_without:store_id|nullable|string|max:255',
            'store_address'    => 'nullable|string|max:1000',
            'store_latitude'   => 'nullable|numeric|between:-90,90',
            'store_longitude'  => 'nullable|numeric|between:-180,180',
            'latitude'         => 'required|numeric|between:-90,90',
            'longitude'        => 'required|numeric|between:-180,180',
            'accuracy'         => 'nullable|numeric|min:0',
            'is_mock_location' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $isMock = $request->boolean('is_mock_location', false);
        $salesLocation = new Point(
            latitude: $request->latitude,
            longitude: $request->longitude,
        );

        $store = null;
        $schedule = null;
        $visitLog = null;
        $distanceMeters = 0;
        $isValidLocation = ! $isMock;

        DB::transaction(function () use (
            $request,
            $user,
            $isMock,
            $salesLocation,
            &$store,
            &$schedule,
            &$visitLog,
            &$distanceMeters,
            &$isValidLocation
        ) {
            if ($request->filled('store_id')) {
                $store = Store::findOrFail($request->store_id);
            } else {
                $store = Store::firstOrCreate(
                    ['code' => $request->store_code],
                    [
                        'name'             => $request->store_name,
                        'address'          => $request->store_address,
                        'location'         => new Point(
                            latitude: $request->input('store_latitude', $request->latitude),
                            longitude: $request->input('store_longitude', $request->longitude),
                        ),
                        'geofence_radius'  => 100,
                        'status'           => 'active',
                        'is_priority'      => false,
                        'tags'             => ['dummy_sap_store'],
                    ]
                );
            }

            $existingSchedule = VisitSchedule::with(['store', 'visitLog'])
                ->where('user_id', $user->id)
                ->where('store_id', $store->id)
                ->whereDate('visit_date', today())
                ->lockForUpdate()
                ->first();

            if ($existingSchedule) {
                if ($existingSchedule->status === 'in_progress' && $existingSchedule->visitLog) {
                    $schedule = $existingSchedule;
                    $visitLog = $existingSchedule->visitLog;
                    return;
                }

                if ($existingSchedule->status !== 'pending') {
                    abort(response()->error('Toko ini sudah memiliki kunjungan hari ini.', 422));
                }

                $schedule = $existingSchedule;
            } else {
                $nextSequence = ((int) VisitSchedule::where('user_id', $user->id)
                    ->whereDate('visit_date', today())
                    ->max('sequence')) + 1;

                $schedule = VisitSchedule::create([
                    'user_id'     => $user->id,
                    'store_id'    => $store->id,
                    'visit_date'  => today(),
                    'sequence'    => min($nextSequence, 255),
                    'status'      => 'pending',
                    'assigned_by' => $user->id,
                ]);
            }

            $distanceMeters = $this->calculateDistance(
                $request->latitude,
                $request->longitude,
                $store->location->latitude,
                $store->location->longitude,
            );

            $isValidLocation = $distanceMeters <= $store->geofence_radius && ! $isMock;

            $visitLog = VisitLog::create([
                'visit_schedule_id' => $schedule->id,
                'user_id'           => $user->id,
                'store_id'          => $store->id,
                'checkin_at'        => now(),
                'checkin_location'  => $salesLocation,
                'checkin_accuracy'  => $request->accuracy,
                'checkin_valid'     => $isValidLocation,
                'checkin_distance'  => round($distanceMeters, 2),
                'is_mock_location'  => $isMock,
                'form_data'         => $this->withSubmissionMeta($request, [
                    'started_from' => 'mobile_self_service',
                ]),
            ]);

            $schedule->update(['status' => 'in_progress']);
        });

        $schedule->load(['store', 'visitLog']);

        return response()->success([
            'visit_log_id'      => $visitLog?->id,
            'is_valid_location' => $isValidLocation,
            'distance_meters'   => round($distanceMeters, 2),
            'geofence_radius'   => $store->geofence_radius,
            'schedule'          => $this->formatSchedule($schedule),
            'store'             => [
                'id'      => $store->id,
                'name'    => $store->name,
                'address' => $store->address,
            ],
            'warning'           => $isMock ? 'Terdeteksi menggunakan fake GPS.' : null,
        ], $isValidLocation
            ? 'Kunjungan mandiri berhasil dimulai.'
            : 'Kunjungan tercatat, namun lokasi di luar radius toko.'
        , 201);
    }

    /**
     * Check-in ke toko
     * Role: sales
     */
    public function checkIn(Request $request)
    {
        $request->validate([
            'visit_schedule_id' => 'required|exists:visit_schedules,id',
            'latitude'          => 'required|numeric|between:-90,90',
            'longitude'         => 'required|numeric|between:-180,180',
            'accuracy'          => 'nullable|numeric|min:0',
            'is_mock_location'  => 'nullable|boolean',
        ]);

        $user     = $request->user();
        $schedule = VisitSchedule::with('store')
            ->where('id', $request->visit_schedule_id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        // Cek schedule milik user yang login
        if ($schedule->user_id !== $user->id) {
            return response()->error('Unauthorized.', 403);
        }

        // Cek status — jangan double check-in
        if ($schedule->status === 'in_progress') {
            return response()->error('Sudah check-in di toko ini.', 422);
        }

        if ($schedule->status === 'completed') {
            return response()->error('Kunjungan sudah selesai.', 422);
        }

        // Hitung jarak sales ke toko
        $store         = $schedule->store;
        $salesLocation = new Point(
            latitude: $request->latitude,
            longitude: $request->longitude,
        );

        $distanceMeters = $this->calculateDistance(
            $request->latitude,
            $request->longitude,
            $store->location->latitude,
            $store->location->longitude,
        );

        $isValidLocation = $distanceMeters <= $store->geofence_radius;
        $isMock          = $request->boolean('is_mock_location', false);

        $visitLog = null;

        DB::transaction(function () use (
            $request, $user, $schedule, $store,
            $salesLocation, $distanceMeters, $isValidLocation, $isMock,
            &$visitLog
        ) {
            // Buat visit log
            $visitLog = VisitLog::create([
                'visit_schedule_id' => $schedule->id,
                'user_id'           => $user->id,
                'store_id'          => $store->id,
                'checkin_at'        => now(),
                'checkin_location'  => $salesLocation,
                'checkin_accuracy'  => $request->accuracy,
                'checkin_valid'     => $isValidLocation && ! $isMock,
                'checkin_distance'  => round($distanceMeters, 2),
                'is_mock_location'  => $isMock,
            ]);

            // Update status schedule
            $schedule->update(['status' => 'in_progress']);
        });

        return response()->success([
            'visit_log_id'       => $visitLog?->id,
            'is_valid_location' => $isValidLocation && ! $isMock,
            'distance_meters'  => round($distanceMeters, 2),
            'geofence_radius'  => $store->geofence_radius,
            'store'            => [
                'id'   => $store->id,
                'name' => $store->name,
            ],
            'warning' => $isMock ? 'Terdeteksi menggunakan fake GPS.' : null,
        ], $isValidLocation
            ? 'Check-in berhasil.'
            : 'Check-in tercatat, namun lokasi di luar radius toko.'
        , 201);
    }

    /**
     * Check-out dari toko
     * Role: sales
     */
    public function checkOut(Request $request)
    {
        $request->validate([
            'visit_schedule_id' => 'required|exists:visit_schedules,id',
            'latitude'          => 'required|numeric|between:-90,90',
            'longitude'         => 'required|numeric|between:-180,180',
            'notes'             => 'nullable|string|max:1000',
            'visit_result'      => 'required|in:order_taken,no_order,closed,not_found,postponed',
            'form_data'         => 'nullable|array',
            'submitted_at'      => 'nullable|date',
            'submitted_by_user_id'  => 'nullable|integer',
            'submitted_by_username' => 'nullable|string|max:255',
        ]);

        $user     = $request->user();
        $schedule = VisitSchedule::where('id', $request->visit_schedule_id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($schedule->status !== 'in_progress') {
            return response()->error('Belum melakukan check-in untuk kunjungan ini.', 422);
        }

        $visitLog = VisitLog::where('visit_schedule_id', $schedule->id)
            ->whereNull('checkout_at')
            ->latest()
            ->firstOrFail();

        $checkoutAt      = now();
        $durationMinutes = (int) $visitLog->checkin_at->diffInMinutes($checkoutAt);

        $rawFormData = $request->input('form_data');
        $formData = $this->withSubmissionMeta($request, is_array($rawFormData) ? $rawFormData : []);

        DB::transaction(function () use (
            $request, $schedule, $visitLog, $checkoutAt, $durationMinutes, $formData
        ) {
            $visitLog->update([
                'checkout_at'       => $checkoutAt,
                'checkout_location' => new Point(
                                           latitude: $request->latitude,
                                           longitude: $request->longitude,
                                       ),
                'duration_minutes'  => $durationMinutes,
                'notes'             => $request->notes,
                'visit_result'      => $request->visit_result,
                'form_data'         => $formData,
            ]);

            $schedule->update(['status' => 'completed']);
        });

        return response()->success([
            'visit_log_id'      => $visitLog->id,
            'duration_minutes' => $durationMinutes,
            'visit_result'     => $request->visit_result,
            'submitted_at'     => $formData['_meta']['timestamp'],
            'submitted_by'     => [
                'user_id'  => $formData['_meta']['user_id'],
                'username' => $formData['_meta']['username'],
            ],
            'store'            => [
                'id'   => $visitLog->store_id,
                'name' => $schedule->store->name,
            ],
        ], 'Check-out berhasil.');
    }

    /**
     * Skip kunjungan (toko tutup / tidak bisa dikunjungi)
     * Role: sales
     */
    public function skip(Request $request)
    {
        $request->validate([
            'visit_schedule_id' => 'required|exists:visit_schedules,id',
            'skip_reason'       => 'required|string|max:500',
        ]);

        $schedule = VisitSchedule::where('id', $request->visit_schedule_id)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->firstOrFail();

        $schedule->update([
            'status'      => 'skipped',
            'skip_reason' => $request->skip_reason,
        ]);

        return response()->success(null, 'Kunjungan ditandai sebagai skip.');
    }

    /**
     * Haversine formula — hitung jarak 2 koordinat dalam meter
     */
    private function calculateDistance(
        float $lat1, float $lon1,
        float $lat2, float $lon2
    ): float {
        $earthRadius = 6371000; // meter

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
           * sin($dLon / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    private function withSubmissionMeta(Request $request, array $formData): array
    {
        $user = $request->user();

        $formData['_meta'] = [
            'timestamp'        => now()->toISOString(),
            'user_id'          => $user->id,
            'username'         => $user->name,
            'client_timestamp' => $request->input('submitted_at'),
            'client_user_id'   => $request->input('submitted_by_user_id'),
            'client_username'  => $request->input('submitted_by_username'),
        ];

        return $formData;
    }

    private function formatSchedule(VisitSchedule $schedule): array
    {
        return [
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
        ];
    }
}
