<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LocationPing;
use App\Models\User;
use Illuminate\Http\Request;
use MatanYadaev\EloquentSpatial\Objects\Point;

class LocationController extends Controller
{
    /**
     * Terima ping lokasi dari mobile (dipanggil tiap interval)
     * Role: sales
     */
    public function ping(Request $request)
    {
        $request->validate([
            'latitude'        => 'required|numeric|between:-90,90',
            'longitude'       => 'required|numeric|between:-180,180',
            'accuracy'        => 'nullable|numeric|min:0',
            'speed'           => 'nullable|numeric',
            'bearing'         => 'nullable|numeric',
            'battery'         => 'nullable|integer|between:0,100',
            'is_moving'       => 'nullable|boolean',
            'is_mock_location' => 'nullable|boolean',
            'recorded_at'     => 'nullable|date',
        ]);

        $user = $request->user();

        // Sanitize speed - Expo may send negative or null, convert to 0 or null
        $speed = $request->speed;
        if ($speed !== null && $speed < 0) {
            $speed = 0;
        }

        $bearing = $request->bearing;
        if ($bearing !== null && ($bearing < 0 || $bearing > 360)) {
            $bearing = null;
        }

        // Simpan ping
        $ping = LocationPing::create([
            'user_id'          => $user->id,
            'location'         => new Point(
                                    latitude: $request->latitude,
                                    longitude: $request->longitude,
                                 ),
            'accuracy'         => $request->accuracy,
            'speed'            => $speed,
            'bearing'          => $bearing,
            'battery'          => $request->battery,
            'is_moving'        => $request->boolean('is_moving', false),
            'is_mock_location' => $request->boolean('is_mock_location', false),
            'recorded_at'      => $request->recorded_at ?? now(),
        ]);

        // Update last_location & last_seen_at di user
        $user->update([
            'last_location' => new Point(
                                   latitude: $request->latitude,
                                   longitude: $request->longitude,
                               ),
            'last_seen_at'  => now(),
        ]);

        return response()->success([
            'ping_id' => $ping->id,
        ], 'Location recorded.', 201);
    }

    /**
     * Ambil posisi terbaru semua sales (untuk SPV dashboard)
     * Role: spv, admin
     */
    public function liveSales(Request $request)
    {
        try {
            $users = User::where('is_active', true)
                ->whereHas('roles', fn($q) => $q->whereIn('name', ['sales', 'spv']))
                ->when($request->team_id, fn($q) => $q->where('team_id', $request->team_id))
                ->get();

            $salesData = $users->map(function ($user) {
                // Get latest ping manually to avoid relasi issues
                $ping = LocationPing::where('user_id', $user->id)
                    ->latest('recorded_at')
                    ->first();

                return [
                    'user_id'      => $user->id,
                    'name'         => $user->name,
                    'employee_id'  => $user->employee_id,
                    'phone'        => $user->phone,
                    'photo'        => $user->photo ? asset('storage/'.$user->photo) : null,
                    'team'         => $user->team?->name,
                    'last_seen_at' => $user->last_seen_at?->toISOString(),
                    'is_online'    => $user->last_seen_at
                                        ? $user->last_seen_at->diffInMinutes(now()) <= 10
                                        : false,
                    'location'     => $ping ? [
                        'latitude'    => $ping->location->latitude,
                        'longitude'   => $ping->location->longitude,
                        'accuracy'    => $ping->accuracy,
                        'speed'       => $ping->speed,
                        'bearing'     => $ping->bearing,
                        'battery'     => $ping->battery,
                        'is_moving'   => $ping->is_moving,
                        'recorded_at' => $ping->recorded_at?->toISOString(),
                    ] : null,
                ];
            });

            return response()->success($salesData, 'OK', 200);
        } catch (\Exception $e) {
            \Log::error('LiveSales error: ' . $e->getMessage(), ['exception' => $e]);
            return response()->success([], 'OK', 200);
        }
    }

    /**
     * Ambil riwayat perjalanan sales dalam 1 hari (breadcrumb)
     * Role: spv, admin
     */
    public function history(Request $request, User $user)
    {
        $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        $pings = LocationPing::where('user_id', $user->id)
            ->whereDate('recorded_at', $request->date)
            ->orderBy('recorded_at')
            ->get()
            ->map(fn($ping) => [
                'latitude'    => $ping->location->latitude,
                'longitude'   => $ping->location->longitude,
                'accuracy'    => $ping->accuracy,
                'speed'       => $ping->speed,
                'bearing'     => $ping->bearing,
                'battery'     => $ping->battery,
                'is_moving'   => $ping->is_moving,
                'recorded_at' => $ping->recorded_at->toISOString(),
            ]);

        return response()->json([
            'user_id' => $user->id,
            'name'    => $user->name,
            'date'    => $request->date,
            'total'   => $pings->count(),
            'trail'   => $pings,
        ]);
    }

    /**
     * Ambil posisi terbaru 1 sales spesifik
     * Role: spv, admin
     */
    public function salesLocation(User $user)
    {
        $ping = $user->latestPing;

        if (! $ping) {
            return response()->json([
                'message' => 'Belum ada data lokasi untuk user ini.',
            ], 404);
        }

        return response()->json([
            'user_id'      => $user->id,
            'name'         => $user->name,
            'last_seen_at' => $user->last_seen_at?->toISOString(),
            'is_online'    => $user->last_seen_at
                                ? $user->last_seen_at->diffInMinutes(now()) <= 10
                                : false,
            'location' => [
                'latitude'    => $ping->location->latitude,
                'longitude'   => $ping->location->longitude,
                'accuracy'    => $ping->accuracy,
                'speed'       => $ping->speed,
                'battery'     => $ping->battery,
                'is_moving'   => $ping->is_moving,
                'recorded_at' => $ping->recorded_at->toISOString(),
            ],
        ]);
    }
}
