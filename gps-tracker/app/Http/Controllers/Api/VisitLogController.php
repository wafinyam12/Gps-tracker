<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitLog;
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

        $visits = VisitLog::with(['schedule', 'store', 'user', 'photos'])
            ->when($user->hasRole('sales'), fn ($query) => $query->where('user_id', $user->id))
            ->when($request->user_id && ! $user->hasRole('sales'), fn ($query) => $query->where('user_id', $request->user_id))
            ->when($request->store_id, fn ($query) => $query->where('store_id', $request->store_id))
            ->when($request->date_from, function ($query) use ($request) {
                $query->whereHas('schedule', fn ($schedule) => $schedule
                    ->whereBetween('visit_date', [$request->date_from, $request->date_to ?? $request->date_from]));
            })
            ->when($request->status === 'open', fn ($query) => $query->whereNull('checkout_at'))
            ->when($request->status === 'completed', fn ($query) => $query->whereNotNull('checkout_at'))
            ->latest('checkin_at')
            ->get()
            ->map(fn (VisitLog $visitLog) => $this->formatVisit($visitLog));

        return response()->success([
            'total'  => $visits->count(),
            'visits' => $visits,
        ]);
    }

    public function show(Request $request, VisitLog $visitLog)
    {
        if (! $this->canAccess($request, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        $visitLog->load(['schedule', 'store', 'user', 'photos']);

        return response()->success([
            'visit' => $this->formatVisit($visitLog),
        ]);
    }

    public function update(Request $request, VisitLog $visitLog)
    {
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
        $visitLog->load(['schedule', 'store', 'user', 'photos']);

        return response()->success([
            'visit' => $this->formatVisit($visitLog),
        ], 'Data kunjungan berhasil diperbarui.');
    }

    public function destroy(Request $request, VisitLog $visitLog)
    {
        if (! $this->canAccess($request, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        if (! $request->user()->hasRole('admin') && $visitLog->checkout_at !== null) {
            return response()->error('Kunjungan selesai tidak bisa dihapus oleh sales.', 422);
        }

        DB::transaction(function () use ($visitLog) {
            $schedule = $visitLog->schedule;
            $photoPaths = $visitLog->photos()->pluck('path')->all();

            if (! empty($photoPaths)) {
                Storage::disk('visit_photos')->delete($photoPaths);
            }

            $visitLog->delete();

            if ($schedule) {
                $schedule->update([
                    'status'      => 'pending',
                    'skip_reason' => null,
                ]);
            }
        });

        return response()->success(null, 'Data kunjungan berhasil dihapus.');
    }

    private function canAccess(Request $request, VisitLog $visitLog): bool
    {
        $user = $request->user();

        return ! $user->hasRole('sales') || $visitLog->user_id === $user->id;
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

    private function formatVisit(VisitLog $visitLog): array
    {
        return [
            'id'                 => $visitLog->id,
            'visit_schedule_id'  => $visitLog->visit_schedule_id,
            'user'               => [
                'id'       => $visitLog->user?->id,
                'name'     => $visitLog->user?->name,
                'username' => $visitLog->user?->name,
            ],
            'store'              => [
                'id'      => $visitLog->store?->id,
                'name'    => $visitLog->store?->name,
                'address' => $visitLog->store?->address,
            ],
            'schedule'           => $visitLog->schedule ? [
                'id'         => $visitLog->schedule->id,
                'visit_date' => $visitLog->schedule->visit_date?->toDateString(),
                'sequence'   => $visitLog->schedule->sequence,
                'status'     => $visitLog->schedule->status,
            ] : null,
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
}
