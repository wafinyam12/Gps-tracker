<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TeamResource;
use App\Models\LocationPing;
use App\Models\Team;
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
            'latitude'         => 'required|numeric|between:-90,90',
            'longitude'        => 'required|numeric|between:-180,180',
            'accuracy'         => 'nullable|numeric|min:0',
            'speed'            => 'nullable|numeric',
            'bearing'          => 'nullable|numeric',
            'battery'          => 'nullable|integer|between:0,100',
            'is_moving'        => 'nullable|boolean',
            'is_mock_location' => 'nullable|boolean',
            'recorded_at'      => 'nullable|date',
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
     * Ambil posisi terbaru semua sales untuk dashboard monitoring.
     * Role: spv, manager, admin
     */
    public function liveSales(Request $request)
    {
        try {
            $teamId = $this->resolveTeamScope($request);
            $roles = $request->user()?->isBranchAdmin() ? ['sales'] : ['sales', 'spv'];

            $users = User::query()
                ->with(['team', 'latestPing'])
                ->where('is_active', true)
                ->whereHas('roles', fn ($query) => $query->whereIn('name', $roles))
                ->when($teamId, fn ($query) => $query->where('team_id', $teamId))
                ->orderBy('name')
                ->get();

            $branches = Team::query()
                ->withCount('members')
                ->where('is_active', true)
                ->when($teamId, fn ($query) => $query->where('id', $teamId))
                ->orderBy('name')
                ->get()
                ->map(fn (Team $branch) => (new TeamResource($branch))->toArray($request))
                ->values()
                ->all();

            $salesData = $users->map(function (User $user) {
                return $this->formatLiveUser($user);
            })->values()->all();

            return response()->success([
                'users'   => $salesData,
                'branches'=> $branches,
                'scope'   => [
                    'role'    => $request->user()?->roles->first()?->name,
                    'team_id' => $request->user()?->team_id,
                ],
            ], 'OK', 200);
        } catch (\Exception $e) {
            \Log::error('LiveSales error: ' . $e->getMessage(), ['exception' => $e]);
            return response()->success([
                'users'    => [],
                'branches' => [],
            ], 'OK', 200);
        }
    }

    /**
     * Ambil riwayat perjalanan sales dalam 1 hari (breadcrumb)
     * Role: spv, manager, admin
     */
    public function history(Request $request, User $user)
    {
        $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        if (! $this->canViewUser($request->user(), $user)) {
            return response()->error('Anda hanya dapat melihat cabang sendiri.', 403);
        }

        $pings = LocationPing::where('user_id', $user->id)
            ->whereDate('recorded_at', $request->date)
            ->orderBy('recorded_at')
            ->get()
            ->map(fn ($ping) => [
                'latitude'         => $ping->location->latitude,
                'longitude'        => $ping->location->longitude,
                'accuracy'         => $ping->accuracy,
                'speed'            => $ping->speed,
                'bearing'          => $ping->bearing,
                'battery'          => $ping->battery,
                'is_moving'        => $ping->is_moving,
                'is_mock_location' => $ping->is_mock_location,
                'recorded_at'      => $ping->recorded_at->toISOString(),
            ]);

        return response()->success([
            'user_id' => $user->id,
            'name'    => $user->name,
            'date'    => $request->date,
            'total'   => $pings->count(),
            'trail'   => $pings,
        ]);
    }

    /**
     * Ambil posisi terbaru 1 sales spesifik
     * Role: spv, manager, admin
     */
    public function salesLocation(Request $request, User $user)
    {
        if (! $this->canViewUser($request->user(), $user)) {
            return response()->error('Anda hanya dapat melihat cabang sendiri.', 403);
        }

        $user->loadMissing(['team', 'latestPing']);
        $ping = $user->latestPing;

        if (! $ping) {
            return response()->json([
                'message' => 'Belum ada data lokasi untuk user ini.',
            ], 404);
        }

        return response()->success([
            'user_id'      => $user->id,
            'name'         => $user->name,
            'employee_id'  => $user->employee_id,
            'phone'        => $user->phone,
            'photo'        => $user->photo ? asset('storage/'.$user->photo) : null,
            'team'         => $this->formatBranch($user->team),
            'branch'       => $this->formatBranch($user->team),
            'last_seen_at' => $user->last_seen_at?->toISOString(),
            'is_online'    => $user->last_seen_at
                                ? $user->last_seen_at->diffInMinutes(now()) <= 10
                                : false,
            'location' => [
                'latitude'         => $ping->location->latitude,
                'longitude'        => $ping->location->longitude,
                'accuracy'         => $ping->accuracy,
                'speed'            => $ping->speed,
                'battery'          => $ping->battery,
                'is_moving'        => $ping->is_moving,
                'is_mock_location' => $ping->is_mock_location,
                'recorded_at'      => $ping->recorded_at->toISOString(),
            ],
        ]);
    }

    private function resolveTeamScope(Request $request): ?int
    {
        $viewer = $request->user();

        $managedTeamId = $viewer?->managedTeamId();
        if ($managedTeamId !== null) {
            return $managedTeamId;
        }

        $requestedTeamId = $request->integer('team_id');

        return $requestedTeamId ?: null;
    }

    private function canViewUser(User $viewer, User $target): bool
    {
        if ($viewer->canAccessAllBranches()) {
            return true;
        }

        if ($viewer->isBranchAdmin()) {
            return $viewer->team_id !== null
                && (int) $viewer->team_id === (int) $target->team_id
                && $target->hasRole('sales');
        }

        if ($viewer->hasRole('spv')) {
            return $viewer->team_id !== null && (int) $viewer->team_id === (int) $target->team_id;
        }

        return $viewer->id === $target->id;
    }

    private function formatBranch(?Team $team): ?array
    {
        if (! $team) {
            return null;
        }

        return [
            'id'           => $team->id,
            'name'         => $team->name,
            'code'         => $team->code,
            'area'         => $team->area,
            'latitude'     => $team->location?->latitude,
            'longitude'    => $team->location?->longitude,
            'location'     => $team->location ? [
                'latitude'  => $team->location->latitude,
                'longitude' => $team->location->longitude,
            ] : null,
            'has_location' => $team->hasLocation(),
            'is_active'    => $team->is_active,
        ];
    }

    private function formatLiveUser(User $user): array
    {
        $ping = $user->latestPing;

        return [
            'user_id'      => $user->id,
            'name'         => $user->name,
            'employee_id'  => $user->employee_id,
            'phone'        => $user->phone,
            'photo'        => $user->photo ? asset('storage/'.$user->photo) : null,
            'team_id'      => $user->team_id,
            'team'         => $user->team?->name,
            'branch'       => $this->formatBranch($user->team),
            'last_seen_at' => $user->last_seen_at?->toISOString(),
            'is_online'    => $user->last_seen_at
                                ? $user->last_seen_at->diffInMinutes(now()) <= 10
                                : false,
            'location'     => $ping ? [
                'latitude'         => $ping->location->latitude,
                'longitude'        => $ping->location->longitude,
                'accuracy'         => $ping->accuracy,
                'speed'            => $ping->speed,
                'bearing'          => $ping->bearing,
                'battery'          => $ping->battery,
                'is_moving'        => $ping->is_moving,
                'is_mock_location' => $ping->is_mock_location,
                'recorded_at'      => $ping->recorded_at?->toISOString(),
            ] : null,
        ];
    }
}
