<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\VisitLog;
use App\Services\LocationIntegrityService;
use App\Services\MasterData\StoreCatalogSyncService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\Point;

class CheckInController extends Controller
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private readonly StoreCatalogSyncService $catalog,
        private readonly LocationIntegrityService $locationIntegrity,
    ) {
    }

    /**
     * Mulai kunjungan mandiri.
     * Alias lama check-in tetap diarahkan ke alur yang sama agar client lama tidak patah.
     */
    public function start(Request $request)
    {
        return $this->createVisit($request);
    }

    public function checkIn(Request $request)
    {
        return $this->createVisit($request);
    }

    public function checkOut(Request $request)
    {
        $request->validate([
            'visit_log_id'      => 'nullable|exists:visit_logs,id',
            'latitude'          => 'required|numeric|between:-90,90',
            'longitude'         => 'required|numeric|between:-180,180',
            'accuracy'          => 'nullable|numeric|min:0',
            'is_mock_location'  => 'nullable|boolean',
            'location_recorded_at' => 'nullable|date',
            'notes'             => 'nullable|string|max:1000',
            'visit_result'      => 'required|in:order_taken,no_order,closed,not_found,postponed',
            'form_data'         => 'nullable|array',
            'submitted_at'      => 'nullable|date',
            'submitted_by_user_id'  => 'nullable|integer',
            'submitted_by_username' => 'nullable|string|max:255',
        ]);

        if ($integrityError = $this->locationIntegrity->visitLocationIntegrityError($request)) {
            return response()->error($integrityError['message'], 422, $integrityError['errors']);
        }

        $user = $request->user();
        $visitLog = $this->resolveVisitLog($request, $user->id);

        if (! $visitLog) {
            return response()->error('Data kunjungan tidak ditemukan.', 404);
        }

        if ($visitLog->checkout_at !== null) {
            return response()->error('Kunjungan ini sudah selesai.', 422);
        }

        $checkoutAt = now(self::LOCAL_TIMEZONE);
        $durationMinutes = null;

        if ($visitLog->checkin_at) {
            $checkinAt = Carbon::parse(
                $visitLog->getRawOriginal('checkin_at'),
                self::LOCAL_TIMEZONE
            );

            $durationMinutes = (int) floor(($checkoutAt->timestamp - $checkinAt->timestamp) / 60);
        }

        $rawFormData = $request->input('form_data');
        $formData = $this->withSubmissionMeta($request, is_array($rawFormData) ? $rawFormData : []);

        DB::transaction(function () use ($request, $visitLog, $checkoutAt, $durationMinutes, $formData) {
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
        });

        $visitLog->loadMissing(['store', 'user']);

        return response()->success([
            'visit_log_id'      => $visitLog->id,
            'duration_minutes'  => $durationMinutes,
            'visit_result'      => $request->visit_result,
            'submitted_at'      => $formData['_meta']['timestamp'],
            'submitted_by'      => [
                'user_id'  => $formData['_meta']['user_id'],
                'username' => $formData['_meta']['username'],
            ],
            'store'             => $this->formatStore($visitLog->store),
            'visit'             => $this->formatVisit($visitLog),
        ], 'Check-out berhasil.');
    }

    private function createVisit(Request $request)
    {
        $request->validate([
            'store_id'          => 'nullable|exists:stores,id',
            'external_bp_code'  => 'required_without:store_id|nullable|string|max:100',
            'store_name'        => 'required_without:store_id|nullable|string|max:255',
            'store_address'     => 'nullable|string|max:1000',
            'branch'            => 'nullable|string|max:255',
            'latitude'          => 'required|numeric|between:-90,90',
            'longitude'         => 'required|numeric|between:-180,180',
            'accuracy'          => 'nullable|numeric|min:0',
            'is_mock_location'  => 'nullable|boolean',
            'location_recorded_at' => 'nullable|date',
        ]);

        if ($integrityError = $this->locationIntegrity->visitLocationIntegrityError($request)) {
            return response()->error($integrityError['message'], 422, $integrityError['errors']);
        }

        $user = $request->user();
        $isMock = $request->boolean('is_mock_location', false);
        $visitDate = now(self::LOCAL_TIMEZONE)->toDateString();
        $salesLocation = new Point(
            latitude: $request->latitude,
            longitude: $request->longitude,
        );

        $store = $this->resolveStore($request);
        if (! $store) {
            return response()->error('Toko tidak tersedia di master data.', 422);
        }

        $openVisit = VisitLog::where('user_id', $user->id)
            ->whereNull('checkout_at')
            ->latest('checkin_at')
            ->first();

        if ($openVisit) {
            return response()->error('Masih ada kunjungan aktif. Selesaikan check-out terlebih dahulu.', 409, [
                'visit_log_id' => $openVisit->id,
            ]);
        }

        $isDuplicate = VisitLog::where('user_id', $user->id)
            ->where('store_id', $store->id)
            ->whereDate('visit_date', $visitDate)
            ->exists();

        $distanceMeters = null;
        $isValidLocation = ! $isMock;

        if ($store->location instanceof Point) {
            $distanceMeters = $this->calculateDistance(
                $request->latitude,
                $request->longitude,
                $store->location->latitude,
                $store->location->longitude,
            );

            $isValidLocation = $distanceMeters <= $store->geofence_radius && ! $isMock;
        }

        $visitLog = null;

        DB::transaction(function () use (
            $request,
            $user,
            $store,
            $visitDate,
            $salesLocation,
            $distanceMeters,
            $isValidLocation,
            $isMock,
            $isDuplicate,
            &$visitLog
        ) {
            $visitLog = VisitLog::create([
                'user_id'           => $user->id,
                'store_id'          => $store->id,
                'visit_date'        => $visitDate,
                'checkin_at'        => now(self::LOCAL_TIMEZONE),
                'checkin_location'  => $salesLocation,
                'checkin_accuracy'  => $request->accuracy,
                'checkin_valid'     => $isValidLocation,
                'checkin_distance'  => $distanceMeters !== null ? round($distanceMeters, 2) : null,
                'is_mock_location'  => $isMock,
                'is_duplicate'      => $isDuplicate,
                'counted_as_target' => $isValidLocation && ! $isDuplicate,
                'duplicate_reason'  => $isDuplicate ? 'store_already_visited_today' : null,
                'form_data'         => $this->withSubmissionMeta($request, [
                    'started_from' => 'mobile_self_service',
                    'duplicate'    => $isDuplicate,
                ]),
            ]);

            if (! $isMock && ! ($store->location instanceof Point)) {
                $store->forceFill([
                    'location'       => $salesLocation,
                    'last_synced_at'  => now(self::LOCAL_TIMEZONE),
                ])->save();
            }
        });

        $store = $store->fresh();
        $visitLog->loadMissing(['store', 'user']);

        $warnings = [];
        if ($isMock) {
            $warnings[] = 'Terdeteksi menggunakan fake GPS.';
        }

        if ($isDuplicate) {
            $warnings[] = 'Kunjungan ini tercatat sebagai duplicate dan tidak dihitung ke target.';
        }

        if (! $isValidLocation) {
            $warnings[] = 'Lokasi di luar radius toko dan tidak dihitung ke target.';
        }

        $message = $warnings
            ? implode(' ', $warnings)
            : 'Kunjungan mandiri berhasil dimulai.';

        return response()->success([
            'visit_log_id'      => $visitLog->id,
            'is_valid_location'  => $isValidLocation,
            'distance_meters'    => $distanceMeters !== null ? round($distanceMeters, 2) : null,
            'geofence_radius'    => $store->geofence_radius,
            'is_duplicate'       => $isDuplicate,
            'counted_as_target'  => $isValidLocation && ! $isDuplicate,
            'store'              => $this->formatStore($store),
            'visit'              => $this->formatVisit($visitLog),
            'warning'            => $warnings ? implode(' ', $warnings) : null,
        ], $message, 201);
    }

    private function resolveStore(Request $request): ?Store
    {
        if ($request->filled('store_id')) {
            $store = Store::find($request->store_id);

            return $store?->status === 'active' ? $store : null;
        }

        $externalCode = $this->catalog->normalizeExternalCode($request->input('external_bp_code'));
        if (! $externalCode) {
            return null;
        }

        $store = $this->catalog->findByExternalCode($externalCode, $request->user());

        return $store?->status === 'active' ? $store : null;
    }

    private function resolveVisitLog(Request $request, int $userId): ?VisitLog
    {
        if ($request->filled('visit_log_id')) {
            return VisitLog::where('id', $request->visit_log_id)
                ->where('user_id', $userId)
                ->first();
        }

        return null;
    }

    private function formatStore(?Store $store): array
    {
        return [
            'id'              => $store?->id,
            'code'            => $store?->code,
            'external_bp_code'=> $store?->external_bp_code,
            'name'            => $store?->name,
            'address'         => $store?->address,
            'branch'          => $store?->branch,
            'pic_name'        => $store?->pic_name,
            'pic_phone'       => $store?->pic_phone,
            'latitude'        => $store?->location?->latitude,
            'longitude'       => $store?->location?->longitude,
            'geofence_radius' => $store?->geofence_radius,
            'status'          => $store?->status,
        ];
    }

    private function formatVisit(VisitLog $visitLog): array
    {
        $visitLog->loadMissing(['store', 'user', 'photos']);

        return [
            'id'                => $visitLog->id,
            'visit_date'         => $visitLog->visit_date?->toDateString(),
            'is_duplicate'       => $visitLog->is_duplicate,
            'counted_as_target'  => $visitLog->counted_as_target,
            'duplicate_reason'   => $visitLog->duplicate_reason,
            'user'               => [
                'id'       => $visitLog->user?->id,
                'name'     => $visitLog->user?->name,
                'username' => $visitLog->user?->name,
            ],
            'store'              => $this->formatStore($visitLog->store),
            'checkin_at'         => $visitLog->checkin_at?->toISOString(),
            'checkout_at'        => $visitLog->checkout_at?->toISOString(),
            'duration_minutes'   => $visitLog->duration_minutes,
            'notes'              => $visitLog->notes,
            'form_data'          => $visitLog->form_data,
            'visit_result'       => $visitLog->visit_result,
            'checkin_valid'      => $visitLog->checkin_valid,
            'checkin_distance'   => $visitLog->checkin_distance,
            'is_mock_location'   => $visitLog->is_mock_location,
            'photos_count'       => $visitLog->photos?->count() ?? 0,
        ];
    }

    private function calculateDistance(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2
    ): float {
        $earthRadius = 6371000;

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
            'timestamp'        => now(self::LOCAL_TIMEZONE)->toISOString(),
            'user_id'          => $user->id,
            'username'         => $user->name,
            'client_timestamp' => $request->input('submitted_at'),
            'client_user_id'   => $request->input('submitted_by_user_id'),
            'client_username'  => $request->input('submitted_by_username'),
            'location_recorded_at' => $request->input('location_recorded_at'),
            'location_accuracy' => $request->input('accuracy'),
            'is_mock_location'  => $request->boolean('is_mock_location', false),
        ];

        return $formData;
    }
}
