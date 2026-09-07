<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\VisitLog;
use App\Services\LocationIntegrityService;
use App\Services\MasterData\StoreCatalogSyncService;
use App\Services\Sap\CustomerCoordinateSyncService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\Point;

class CheckInController extends Controller
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';
    private const MAX_VISIT_GEOFENCE_RADIUS_METERS = 50;

    public function __construct(
        private readonly StoreCatalogSyncService $catalog,
        private readonly LocationIntegrityService $locationIntegrity,
        private readonly CustomerCoordinateSyncService $coordinateSync,
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
            'client_uuid' => 'nullable|uuid',
            'offline_sync' => 'nullable|boolean',
        ]);

        $offlineSync = $request->boolean('offline_sync', false);
        if ($offlineError = $this->offlineTimestampError($request, $offlineSync)) {
            return response()->error($offlineError, 422, ['offline_sync' => [$offlineError]]);
        }

        if ($integrityError = $this->locationIntegrity->visitLocationIntegrityError($request, $offlineSync)) {
            return response()->error($integrityError['message'], 422, $integrityError['errors']);
        }

        $user = $request->user();
        $visitLog = $this->resolveVisitLog($request, $user->id);

        if (! $visitLog) {
            return response()->error('Data kunjungan tidak ditemukan.', 404);
        }

        if ($visitLog->checkout_at !== null
            && filled($request->client_uuid)
            && hash_equals((string) $visitLog->checkout_client_uuid, (string) $request->client_uuid)) {
            return $this->checkoutResponse($visitLog->load(['store', 'user']), true);
        }

        if ($visitLog->checkout_at !== null) {
            return response()->error('Kunjungan ini sudah selesai.', 422);
        }

        $checkoutAt = $this->recordedAt($request);
        $durationMinutes = null;

        if ($visitLog->checkin_at) {
            $checkinAt = Carbon::parse(
                $visitLog->getRawOriginal('checkin_at'),
                self::LOCAL_TIMEZONE
            );

            $durationMinutes = max(0, (int) floor(($checkoutAt->timestamp - $checkinAt->timestamp) / 60));
        }

        $rawFormData = $request->input('form_data');
        $formData = $this->withSubmissionMeta($request, is_array($rawFormData) ? $rawFormData : []);
        $checkinLocation = $visitLog->checkin_location;
        $shouldRecordCoordinateObservation = ! $visitLog->is_mock_location
            && $visitLog->checkin_valid
            && $checkinLocation instanceof Point;
        $shouldSaveStoreLocation = $shouldRecordCoordinateObservation
            && $visitLog->checkin_accuracy !== null
            && (float) $visitLog->checkin_accuracy <= (float) config('sap.coordinate_max_observation_accuracy_meters', 25);

        DB::transaction(function () use (
            $request,
            $visitLog,
            $checkoutAt,
            $durationMinutes,
            $formData,
            $checkinLocation,
            $shouldRecordCoordinateObservation,
            $shouldSaveStoreLocation,
            $offlineSync,
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
                'checkout_client_uuid' => $request->client_uuid,
                'is_offline_sync' => $offlineSync || $visitLog->is_offline_sync,
                'offline_received_at' => $offlineSync ? now(self::LOCAL_TIMEZONE) : $visitLog->offline_received_at,
            ]);

            // A visit/start only opens a draft visit form. Persist a previously
            // unknown store location only after the visit is actually submitted.
            // Use the check-in point, not the checkout point, because it records
            // the sales' location when they first arrived at the customer.
            if ($shouldRecordCoordinateObservation) {
                $store = Store::query()
                    ->lockForUpdate()
                    ->find($visitLog->store_id);

                if ($shouldSaveStoreLocation && $store && ! $store->hasLocation()) {
                    $store->forceFill([
                        'location' => $checkinLocation,
                    ])->save();
                }

                if ($store) {
                    $store->loadMissing('team');
                    $this->coordinateSync->recordCompletedVisit($visitLog, $store, $checkinLocation);
                }
            }
        });

        $visitLog->load(['store', 'user']);

        return $this->checkoutResponse($visitLog);
    }

    private function checkoutResponse(VisitLog $visitLog, bool $replayed = false)
    {
        $meta = is_array($visitLog->form_data) ? ($visitLog->form_data['_meta'] ?? []) : [];

        return response()->success([
            'visit_log_id'      => $visitLog->id,
            'duration_minutes'  => $visitLog->duration_minutes,
            'visit_result'      => $visitLog->visit_result,
            'submitted_at'      => $meta['timestamp'] ?? $visitLog->checkout_at?->toISOString(),
            'submitted_by'      => [
                'user_id'  => $meta['user_id'] ?? $visitLog->user_id,
                'username' => $meta['username'] ?? $visitLog->user?->name,
            ],
            'store'             => $this->formatStore($visitLog->store),
            'visit'             => $this->formatVisit($visitLog),
            'replayed' => $replayed,
        ], $replayed ? 'Check-out sudah tersimpan sebelumnya.' : 'Check-out berhasil.');
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
            'client_uuid' => 'nullable|uuid',
            'offline_sync' => 'nullable|boolean',
        ]);

        $user = $request->user();
        if ($request->filled('client_uuid')) {
            $existing = VisitLog::query()
                ->where('user_id', $user->id)
                ->where('client_uuid', $request->client_uuid)
                ->with(['store', 'user', 'photos'])
                ->first();

            if ($existing) {
                return $this->startResponse($existing, true);
            }
        }

        $offlineSync = $request->boolean('offline_sync', false);
        if ($offlineError = $this->offlineTimestampError($request, $offlineSync)) {
            return response()->error($offlineError, 422, ['offline_sync' => [$offlineError]]);
        }

        if ($integrityError = $this->locationIntegrity->visitLocationIntegrityError($request, $offlineSync)) {
            return response()->error($integrityError['message'], 422, $integrityError['errors']);
        }

        $isMock = $request->boolean('is_mock_location', false);
        $checkinAt = $this->recordedAt($request);
        $visitDate = $checkinAt->toDateString();
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

        $geofenceRadius = $this->effectiveGeofenceRadius($store);
        $distanceMeters = null;
        $isValidLocation = ! $isMock;

        if ($store->location instanceof Point) {
            $distanceMeters = $this->calculateDistance(
                $request->latitude,
                $request->longitude,
                $store->location->latitude,
                $store->location->longitude,
            );

            $isValidLocation = $distanceMeters <= $geofenceRadius && ! $isMock;
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
            $checkinAt,
            $offlineSync,
            &$visitLog
        ) {
            $visitLog = VisitLog::create([
                'user_id'           => $user->id,
                'store_id'          => $store->id,
                'client_uuid'       => $request->client_uuid,
                'visit_date'        => $visitDate,
                'checkin_at'        => $checkinAt,
                'checkin_location'  => $salesLocation,
                'checkin_accuracy'  => $request->accuracy,
                'checkin_valid'     => $isValidLocation,
                'checkin_distance'  => $distanceMeters !== null ? round($distanceMeters, 2) : null,
                'is_mock_location'  => $isMock,
                'is_offline_sync'   => $offlineSync,
                'offline_received_at' => $offlineSync ? now(self::LOCAL_TIMEZONE) : null,
                'is_duplicate'      => $isDuplicate,
                'counted_as_target' => $isValidLocation && ! $isDuplicate,
                'duplicate_reason'  => $isDuplicate ? 'store_already_visited_today' : null,
                'form_data'         => $this->withSubmissionMeta($request, [
                    'started_from' => 'mobile_self_service',
                    'duplicate'    => $isDuplicate,
                ]),
            ]);

        });

        $store = $store->fresh();
        $visitLog->loadMissing(['store', 'user']);

        return $this->startResponse($visitLog);
    }

    private function startResponse(VisitLog $visitLog, bool $replayed = false)
    {
        $store = $visitLog->store;
        $warnings = [];
        if ($visitLog->is_mock_location) {
            $warnings[] = 'Terdeteksi menggunakan fake GPS.';
        }

        if ($visitLog->is_duplicate) {
            $warnings[] = 'Kunjungan ini tercatat sebagai duplicate dan tidak dihitung ke target.';
        }

        if (! $visitLog->checkin_valid) {
            $warnings[] = 'Lokasi di luar radius toko dan tidak dihitung ke target.';
        }

        $message = $warnings
            ? implode(' ', $warnings)
            : 'Kunjungan mandiri berhasil dimulai.';

        return response()->success([
            'visit_log_id'      => $visitLog->id,
            'is_valid_location'  => $visitLog->checkin_valid,
            'distance_meters'    => $visitLog->checkin_distance,
            'geofence_radius'    => $this->effectiveGeofenceRadius($store),
            'is_duplicate'       => $visitLog->is_duplicate,
            'counted_as_target'  => $visitLog->counted_as_target,
            'store'              => $this->formatStore($store),
            'visit'              => $this->formatVisit($visitLog),
            'replayed'           => $replayed,
            'warning'            => $warnings ? implode(' ', $warnings) : null,
        ], $message, $replayed ? 200 : 201);
    }

    private function resolveStore(Request $request): ?Store
    {
        if ($request->filled('store_id')) {
            return $this->catalog->findById(
                $request->integer('store_id'),
                $request->user(),
            );
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
            'geofence_radius' => $this->effectiveGeofenceRadius($store),
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

    private function effectiveGeofenceRadius(?Store $store): int
    {
        $radius = (int) ($store?->geofence_radius ?: self::MAX_VISIT_GEOFENCE_RADIUS_METERS);

        if ($radius <= 0) {
            return self::MAX_VISIT_GEOFENCE_RADIUS_METERS;
        }

        return min($radius, self::MAX_VISIT_GEOFENCE_RADIUS_METERS);
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
            'offline_sync'      => $request->boolean('offline_sync', false),
            'client_uuid'       => $request->input('client_uuid'),
        ];

        return $formData;
    }

    private function recordedAt(Request $request): Carbon
    {
        if ($request->filled('location_recorded_at')) {
            return Carbon::parse($request->input('location_recorded_at'))->setTimezone(self::LOCAL_TIMEZONE);
        }

        return now(self::LOCAL_TIMEZONE);
    }

    private function offlineTimestampError(Request $request, bool $offlineSync): ?string
    {
        if (! $offlineSync) {
            return null;
        }

        if (! $request->filled('location_recorded_at')) {
            return 'Waktu GPS wajib dikirim untuk data offline.';
        }

        $recordedAt = $this->recordedAt($request);
        if ($recordedAt->lt(now(self::LOCAL_TIMEZONE)->subDays(3))) {
            return 'Data kunjungan offline lebih dari 3 hari harus diverifikasi admin.';
        }

        return null;
    }
}
