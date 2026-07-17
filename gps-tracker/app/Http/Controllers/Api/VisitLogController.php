<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\User;
use App\Models\VisitLog;
use App\Services\Sap\OutstandingReceivableService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitLogController extends Controller
{
    private const VISIT_RESULTS = [
        'order_taken',
        'no_order',
        'closed',
        'not_found',
        'postponed',
    ];

    public function __construct(
        private readonly OutstandingReceivableService $outstandingReceivableService,
    ) {
    }

    public function index(Request $request)
    {
        $request->validate([
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to'   => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
            'user_id'   => 'nullable|exists:users,id',
            'store_id'  => 'nullable|exists:stores,id',
            'status'    => 'nullable|in:open,completed',
        ]);

        $user = $request->user();
        $query = VisitLog::with(['store', 'user', 'photos']);

        if ($user->hasRole('sales')) {
            $query->where('user_id', $user->id);
        } elseif ($user->isBranchAdmin()) {
            $query->whereHas('user', function ($nested) use ($user) {
                $nested->where('team_id', $user->team_id)
                    ->whereHas('roles', fn ($roleQuery) => $roleQuery->where('name', 'sales'));
            });
        } elseif ($user->hasRole('spv')) {
            $query->whereHas('user', function ($nested) use ($user) {
                $nested->where('team_id', $user->team_id);
            });
        }

        $visits = $query
            ->when($request->user_id && ! $user->hasRole('sales'), fn ($query) => $query->where('user_id', $request->user_id))
            ->when($request->store_id, fn ($query) => $query->where('store_id', $request->store_id))
            ->when($request->date_from, function ($query) use ($request) {
                $query->whereBetween('visit_date', [$request->date_from, $request->date_to ?? $request->date_from]);
            })
            ->when($request->status === 'open', fn ($query) => $query->whereNull('checkout_at'))
            ->when($request->status === 'completed', fn ($query) => $query->whereNotNull('checkout_at'))
            ->latest('checkin_at')
            ->get()
            ->map(fn (VisitLog $visitLog) => $this->formatVisit($visitLog, false));

        return response()->success([
            'total'  => $visits->count(),
            'visits' => $visits,
        ]);
    }

    public function show(Request $request, VisitLog $visitLog)
    {
        $visitLog->loadMissing('user');
        if (! $this->canAccess($request, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        $visitLog->load(['store', 'user', 'photos']);

        return response()->success([
            'visit' => $this->formatVisit($visitLog),
        ]);
    }

    public function update(Request $request, VisitLog $visitLog)
    {
        $visitLog->loadMissing('user');
        if (! $this->canAccess($request, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        $request->validate([
            'latitude'                   => 'nullable|numeric|between:-90,90',
            'longitude'                  => 'nullable|numeric|between:-180,180',
            'notes'                      => 'nullable|string|max:1000',
            'visit_result'               => ['nullable', Rule::in(self::VISIT_RESULTS)],
            'form_data'                  => 'nullable|array',
            'submitted_at'               => 'nullable|date',
            'submitted_by_user_id'       => 'nullable|integer',
            'submitted_by_username'      => 'nullable|string|max:255',
        ]);

        $payload = [];

        if ($request->has('notes')) {
            $payload['notes'] = $request->notes;
        }

        if ($request->has('visit_result')) {
            $payload['visit_result'] = $request->visit_result;
        }

        if ($request->has('form_data')) {
            $formData = $request->input('form_data');
            $payload['form_data'] = $this->withSubmissionMeta($request, is_array($formData) ? $formData : []);
        }

        if ($request->filled('latitude') && $request->filled('longitude')) {
            $payload['checkout_location'] = new Point(
                latitude: $request->latitude,
                longitude: $request->longitude,
            );
        }

        if (empty($payload)) {
            return response()->error('Tidak ada data kunjungan yang diubah.', 422);
        }

        $visitLog->update($payload);
        $visitLog->load(['store', 'user', 'photos']);

        return response()->success([
            'visit' => $this->formatVisit($visitLog),
        ], 'Data kunjungan berhasil diperbarui.');
    }

    public function destroy(Request $request, VisitLog $visitLog)
    {
        $visitLog->loadMissing('user');
        if (! $this->canAccess($request, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        if (! $request->user()->hasRole('superadmin') && $visitLog->checkout_at !== null) {
            return response()->error('Kunjungan selesai tidak bisa dihapus oleh sales.', 422);
        }

        DB::transaction(function () use ($visitLog) {
            $photoPaths = $visitLog->photos()->pluck('path')->all();

            if (! empty($photoPaths)) {
                Storage::disk('visit_photos')->delete($photoPaths);
            }

            $visitLog->delete();
        });

        return response()->success(null, 'Data kunjungan berhasil dihapus.');
    }

    private function canAccess(Request $request, VisitLog $visitLog): bool
    {
        $user = $request->user();

        if ($user->canAccessAllBranches()) {
            return true;
        }

        if ($user->isBranchAdmin()) {
            return $user->team_id !== null
                && (int) $user->team_id === (int) $visitLog->user?->team_id
                && $visitLog->user?->hasRole('sales');
        }

        if ($user->hasRole('spv')) {
            return $user->team_id !== null && (int) $user->team_id === (int) $visitLog->user?->team_id;
        }

        return $visitLog->user_id === $user->id;
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

    private function formatVisit(VisitLog $visitLog, bool $includeSap = true): array
    {
        return [
            'id'                 => $visitLog->id,
            'visit_date'         => $visitLog->visit_date?->toDateString(),
            'user'               => [
                'id'       => $visitLog->user?->id,
                'name'     => $visitLog->user?->name,
                'username' => $visitLog->user?->name,
            ],
            'store'              => $this->formatStore($visitLog->store, $visitLog->user, $includeSap),
            'checkin_at'         => $visitLog->checkin_at?->toISOString(),
            'checkout_at'        => $visitLog->checkout_at?->toISOString(),
            'duration_minutes'   => $visitLog->duration_minutes,
            'notes'              => $visitLog->notes,
            'form_data'          => $visitLog->form_data,
            'visit_result'       => $visitLog->visit_result,
            'checkin_valid'      => $visitLog->checkin_valid,
            'checkin_distance'   => $visitLog->checkin_distance,
            'is_mock_location'   => $visitLog->is_mock_location,
            'is_duplicate'       => $visitLog->is_duplicate,
            'counted_as_target'  => $visitLog->counted_as_target,
            'duplicate_reason'   => $visitLog->duplicate_reason,
            'photos_count'       => $visitLog->photos?->count() ?? 0,
            'photos_preview'     => $this->formatPhotoPreviews($visitLog, 3),
        ];
    }

    private function formatStore(?Store $store, ?User $salesUser = null, bool $includeSap = true): array
    {
        $storeData = [
            'id'      => $store?->id,
            'code'    => $store?->code,
            'external_bp_code' => $store?->external_bp_code,
            'name'    => $store?->name,
            'address' => $store?->address,
            'branch'  => $store?->branch,
            'pic_name' => $store?->pic_name,
            'pic_phone' => $store?->pic_phone,
            'latitude' => $store?->location?->latitude,
            'longitude' => $store?->location?->longitude,
            'has_location' => $store?->hasLocation() ?? false,
        ];

        if ($includeSap) {
            $storeData['sap_outstanding_receivable'] = $this->outstandingReceivableService->forStore($store, $salesUser);
        }

        return $storeData;
    }

    private function formatPhotoPreviews(VisitLog $visitLog, int $limit = 3): array
    {
        return $visitLog->photos
            ?->sortBy('taken_at')
            ->take($limit)
            ->values()
            ->map(fn ($photo) => [
                'id'        => $photo->id,
                'url'       => $this->photoUrl($photo->path),
                'type'      => $photo->type,
                'taken_at'  => $photo->taken_at?->toISOString(),
            ])
            ->all() ?? [];
    }

    private function photoUrl(string $path): string
    {
        return Storage::disk('visit_photos')->url($path);
    }
}
