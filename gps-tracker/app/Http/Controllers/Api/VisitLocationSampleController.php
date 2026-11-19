<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisitLog;
use App\Services\VisitPresenceEstimator;
use App\Services\VisitPresenceSummaryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VisitLocationSampleController extends Controller
{
    public function __construct(
        private readonly VisitPresenceEstimator $estimator,
        private readonly VisitPresenceSummaryService $summaries,
    ) {
    }

    public function store(Request $request, VisitLog $visitLog)
    {
        if ((int) $visitLog->user_id !== (int) $request->user()->id) {
            return response()->error('Unauthorized.', 403);
        }

        $data = $request->validate([
            'samples' => 'present|array|max:100',
            'samples.*.client_uuid' => 'required|uuid',
            'samples.*.latitude' => 'required|numeric|between:-90,90',
            'samples.*.longitude' => 'required|numeric|between:-180,180',
            'samples.*.accuracy' => 'required|numeric|between:0,300',
            'samples.*.recorded_at' => 'required|date',
            'samples.*.is_mock_location' => 'required|boolean',
            'final_batch' => 'sometimes|boolean',
        ]);

        if ($data['samples'] === [] && ! ($data['final_batch'] ?? false)) {
            return response()->error('Batch kosong hanya boleh untuk menyelesaikan pengukuran kunjungan.', 422);
        }

        $now = now();
        $start = $visitLog->checkin_at?->timestamp;
        $end = $visitLog->checkout_at?->timestamp ?? $now->timestamp;
        foreach ($data['samples'] as $sample) {
            $at = Carbon::parse($sample['recorded_at']);
            if ($sample['is_mock_location'] || $at->lt($now->copy()->subDays(3))
                || $at->gt($now->copy()->addMinute())
                || $start === null || $at->timestamp < $start || $at->timestamp > $end) {
                return response()->error('Sampel GPS tidak valid untuk kunjungan ini.', 422);
            }
        }

        $result = DB::transaction(function () use ($visitLog, $data) {
            $locked = VisitLog::query()->lockForUpdate()->findOrFail($visitLog->id);
            $accepted = 0;
            foreach ($data['samples'] as $sample) {
                $existing = $locked->locationSamples()->where('client_uuid', $sample['client_uuid'])->first();
                if ($existing) {
                    if (abs($existing->latitude - (float) $sample['latitude']) > 0.0000001
                        || abs($existing->longitude - (float) $sample['longitude']) > 0.0000001
                        || abs($existing->accuracy - (float) $sample['accuracy']) > 0.01
                        || $existing->recorded_at->timestamp !== Carbon::parse($sample['recorded_at'])->timestamp) {
                        abort(409, 'UUID sampel GPS telah dipakai untuk titik yang berbeda.');
                    }
                    continue;
                }

                $classification = $this->estimator->classify(
                    $locked->geofence_center, (int) ($locked->geofence_radius_meters ?: 50),
                    (float) $sample['latitude'], (float) $sample['longitude'], (float) $sample['accuracy'],
                );
                $locked->locationSamples()->create([
                    'client_uuid' => $sample['client_uuid'],
                    'latitude' => $sample['latitude'],
                    'longitude' => $sample['longitude'],
                    'accuracy' => $sample['accuracy'],
                    'recorded_at' => Carbon::parse($sample['recorded_at']),
                    'classification' => $classification['status'],
                    'distance_meters' => $classification['distance_meters'],
                ]);
                $accepted++;
            }

            if ($data['final_batch'] ?? false) {
                $locked->samples_finalized_at = now();
                $locked->save();
            }
            $this->summaries->recalculate($locked);

            return ['accepted' => $accepted, 'summary' => $this->summaries->response($locked)];
        });

        return response()->success($result);
    }
}
