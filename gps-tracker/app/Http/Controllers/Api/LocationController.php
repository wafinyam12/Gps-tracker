<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LocationPing;
use App\Models\Store;
use App\Models\Team;
use App\Models\User;
use App\Services\LocationIntegrityService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use MatanYadaev\EloquentSpatial\Objects\Point;

class LocationController extends Controller
{
    private const LIVE_SALES_LIMIT = 50;
    private const CUSTOMER_MARKER_LIMIT = 100;
    private const CUSTOMER_CANDIDATE_LIMIT = 2000;
    private const ONLINE_WINDOW_MINUTES = 10;

    public function __construct(
        private readonly LocationIntegrityService $locationIntegrity,
    ) {
    }

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

        $reportedMockLocation = $request->boolean('is_mock_location', false);
        $recordedAt = $request->filled('recorded_at')
            ? Carbon::parse($request->recorded_at)
            : now();
        $accuracy = $request->filled('accuracy') ? (float) $request->accuracy : null;
        $integrity = $this->locationIntegrity->pingIntegrity(
            $user,
            (float) $request->latitude,
            (float) $request->longitude,
            $accuracy,
            $recordedAt,
            $reportedMockLocation,
        );
        $isMockLocation = ! $integrity['trusted'];

        $ping = LocationPing::create([
            'user_id'          => $user->id,
            'location'         => new Point(
                latitude: $request->latitude,
                longitude: $request->longitude,
            ),
            'accuracy'         => $accuracy,
            'speed'            => $speed,
            'bearing'          => $bearing,
            'battery'          => $request->battery,
            'is_moving'        => $request->boolean('is_moving', false),
            'is_mock_location' => $isMockLocation,
            'recorded_at'      => $recordedAt,
        ]);

        $userPayload = [
            'last_seen_at' => now(),
        ];

        // Fake/mock GPS tetap disimpan sebagai audit, tetapi tidak menggeser posisi trusted user.
        if (! $isMockLocation) {
            $userPayload['last_location'] = new Point(
                latitude: $request->latitude,
                longitude: $request->longitude,
            );
        }

        $user->update($userPayload);

        return response()->success([
            'ping_id'          => $ping->id,
            'is_mock_location' => $ping->is_mock_location,
            'trusted'          => ! $isMockLocation,
            'integrity_reason' => $integrity['reason'],
        ], 'Location recorded.', 201);
    }

    /**
     * Ambil posisi terbaru semua sales untuk dashboard monitoring.
     * Role: spv, manager, admin
     */
    public function liveSales(Request $request)
    {
        $request->validate([
            'team_id'     => 'nullable|integer|exists:teams,id',
            'online_only' => 'nullable|boolean',
            'limit'       => 'nullable|integer|min:1|max:'.self::LIVE_SALES_LIMIT,
        ]);

        if ($this->requiresTeamAssignment($request->user()) && ! $request->user()?->team_id) {
            return response()->error('Akun monitoring belum memiliki cabang.', 403);
        }

        try {
            $teamId = $this->resolveTeamScope($request);
            $onlineOnly = $request->boolean('online_only', false);
            $limit = min((int) $request->input('limit', self::LIVE_SALES_LIMIT), self::LIVE_SALES_LIMIT);
            $isGlobalView = $request->user()?->canAccessAllBranches() && $teamId === null;

            $salesQuery = User::query()
                ->with(['team', 'latestTrustedPing'])
                ->where('is_active', true)
                ->whereHas('roles', fn ($query) => $query->where('name', 'sales'))
                ->when($teamId !== null, fn ($query) => $query->where('team_id', $teamId))
                ->when($onlineOnly, fn ($query) => $query
                    ->whereNotNull('last_seen_at')
                    ->where('last_seen_at', '>=', now()->subMinutes(self::ONLINE_WINDOW_MINUTES))
                )
                ->orderBy('name');

            $totalSales = $isGlobalView ? 0 : (clone $salesQuery)->count();
            $users = $isGlobalView
                ? collect()
                : $salesQuery->limit($limit)->get();

            $branchModels = Team::query()
                ->withCount('members')
                ->where('is_active', true)
                ->when($teamId !== null, fn ($query) => $query->where('id', $teamId))
                ->orderBy('name')
                ->get();

            $branchIds = $branchModels->pluck('id')->all();
            $onlineCounts = User::query()
                ->selectRaw('team_id, COUNT(*) as total')
                ->whereIn('team_id', $branchIds)
                ->where('is_active', true)
                ->whereNotNull('last_seen_at')
                ->where('last_seen_at', '>=', now()->subMinutes(self::ONLINE_WINDOW_MINUTES))
                ->whereHas('roles', fn ($query) => $query->where('name', 'sales'))
                ->groupBy('team_id')
                ->pluck('total', 'team_id');

            $branches = $branchModels
                ->map(function (Team $branch) use ($onlineCounts) {
                    return [
                        ...$this->formatBranch($branch),
                        'online_sales_count' => (int) ($onlineCounts[$branch->id] ?? 0),
                    ];
                })
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
                    'team_id' => $teamId,
                    'is_global'=> $isGlobalView,
                    'can_access_all_branches' => $request->user()?->canAccessAllBranches() ?? false,
                ],
                'meta' => [
                    'total_sales' => $totalSales,
                    'limit'       => $limit,
                    'truncated'   => ! $isGlobalView && $totalSales > $users->count(),
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
     * Customer markers scoped to one branch and the current map viewport.
     * Stores are mapped to a branch using the master branch field when present,
     * then the nearest active branch office as a geographic fallback.
     */
    public function customerMarkers(Request $request)
    {
        $request->validate([
            'team_id'   => 'nullable|integer|exists:teams,id',
            'south'     => 'required|numeric|between:-90,90',
            'north'     => 'required|numeric|between:-90,90',
            'west'      => 'required|numeric|between:-180,180',
            'east'      => 'required|numeric|between:-180,180',
            'zoom'      => 'required|integer|min:1|max:19',
            'limit'     => 'nullable|integer|min:1|max:'.self::CUSTOMER_MARKER_LIMIT,
        ]);

        $viewer = $request->user();
        if ($this->requiresTeamAssignment($viewer) && ! $viewer?->team_id) {
            return response()->error('Akun monitoring belum memiliki cabang.', 403);
        }

        $teamId = $this->resolveTeamScope($request);
        if ($teamId === null) {
            return response()->error('Pilih cabang terlebih dahulu untuk memuat marker customer.', 422);
        }

        $south = (float) $request->south;
        $north = (float) $request->north;
        $west = (float) $request->west;
        $east = (float) $request->east;
        if ($south >= $north || $west >= $east) {
            return response()->error('Batas peta tidak valid.', 422);
        }

        $branches = Team::query()
            ->where('is_active', true)
            ->whereNotNull('location')
            ->orderBy('name')
            ->get();
        $selectedTeam = $branches->firstWhere('id', $teamId);

        if (! $selectedTeam) {
            return response()->error('Lokasi kantor cabang belum tersedia atau cabang tidak aktif.', 422);
        }

        $candidateLimit = self::CUSTOMER_CANDIDATE_LIMIT + 1;
        $candidates = Store::query()
            ->select(['id', 'code', 'external_bp_code', 'name', 'address', 'branch', 'location'])
            ->where('status', 'active')
            ->whereNotNull('location')
            ->whereRaw('ST_Y(location) BETWEEN ? AND ?', [$south, $north])
            ->whereRaw('ST_X(location) BETWEEN ? AND ?', [$west, $east])
            ->orderBy('id')
            ->limit($candidateLimit)
            ->get();

        $candidateLimitReached = $candidates->count() > self::CUSTOMER_CANDIDATE_LIMIT;
        if ($candidateLimitReached) {
            $candidates = $candidates->take(self::CUSTOMER_CANDIDATE_LIMIT)->values();
        }

        $stores = $candidates
            ->filter(fn (Store $store) => $this->resolveStoreTeamId($store, $branches) === (int) $selectedTeam->id)
            ->values();
        $markerLimit = min((int) $request->input('limit', self::CUSTOMER_MARKER_LIMIT), self::CUSTOMER_MARKER_LIMIT);
        $zoom = (int) $request->zoom;
        $showIndividualMarkers = $zoom >= 15 && $stores->count() <= $markerLimit && ! $candidateLimitReached;

        if ($showIndividualMarkers) {
            $items = $stores
                ->map(fn (Store $store) => $this->formatCustomerMarker($store))
                ->values()
                ->all();
            $mode = 'markers';
        } else {
            $items = $this->clusterCustomerStores($stores, $zoom);
            $mode = 'clusters';
        }

        return response()->success([
            'team' => $this->formatBranch($selectedTeam),
            'mode' => $mode,
            'items' => $items,
            'meta' => [
                'visible_customers' => $stores->count(),
                'candidate_limit' => self::CUSTOMER_CANDIDATE_LIMIT,
                'candidate_limit_reached' => $candidateLimitReached,
                'marker_limit' => $markerLimit,
                'assignment' => 'master_branch_then_nearest_office',
            ],
        ]);
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

        $user->loadMissing(['team', 'latestTrustedPing']);
        $ping = $user->latestTrustedPing;

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

    private function requiresTeamAssignment(?User $viewer): bool
    {
        return $viewer?->isBranchScopedAdmin() === true;
    }

    private function resolveStoreTeamId(Store $store, Collection $branches): ?int
    {
        $masterBranch = $this->normalizeBranchLabel($store->branch);
        if ($masterBranch !== null) {
            $matchedBranch = $branches->first(function (Team $branch) use ($masterBranch) {
                return in_array($masterBranch, array_filter([
                    $this->normalizeBranchLabel($branch->name),
                    $this->normalizeBranchLabel($branch->code),
                    $this->normalizeBranchLabel($branch->area),
                ]), true);
            });

            if ($matchedBranch) {
                return (int) $matchedBranch->id;
            }
        }

        if (! $store->location) {
            return null;
        }

        return $branches
            ->filter(fn (Team $branch) => $branch->location !== null)
            ->map(fn (Team $branch) => [
                'team_id' => (int) $branch->id,
                'distance' => $this->distanceMeters(
                    (float) $store->location->latitude,
                    (float) $store->location->longitude,
                    (float) $branch->location->latitude,
                    (float) $branch->location->longitude,
                ),
            ])
            ->sortBy('distance')
            ->value('team_id');
    }

    private function clusterCustomerStores(Collection $stores, int $zoom): array
    {
        $baseCellSize = match (true) {
            $zoom <= 10 => 0.5,
            $zoom <= 12 => 0.15,
            $zoom <= 14 => 0.04,
            default => 0.01,
        };

        $clusters = collect();
        foreach ([1, 2, 4, 8, 16] as $multiplier) {
            $cellSize = $baseCellSize * $multiplier;
            $clusters = $stores
                ->groupBy(function (Store $store) use ($cellSize) {
                    $latitude = (float) $store->location->latitude;
                    $longitude = (float) $store->location->longitude;

                    return floor($latitude / $cellSize).':'.floor($longitude / $cellSize);
                })
                ->map(function (Collection $clusterStores, string $key) {
                    $count = $clusterStores->count();

                    return [
                        'id' => 'customer-cluster-'.$key,
                        'kind' => 'customer_cluster',
                        'count' => $count,
                        'latitude' => round((float) $clusterStores->avg(fn (Store $store) => $store->location->latitude), 6),
                        'longitude' => round((float) $clusterStores->avg(fn (Store $store) => $store->location->longitude), 6),
                        'title' => $count.' customer',
                        'description' => 'Perbesar peta untuk melihat marker customer.',
                    ];
                })
                ->sortByDesc('count')
                ->values();

            if ($clusters->count() <= self::CUSTOMER_MARKER_LIMIT) {
                break;
            }
        }

        return $clusters->take(self::CUSTOMER_MARKER_LIMIT)->values()->all();
    }

    private function formatCustomerMarker(Store $store): array
    {
        return [
            'id' => 'customer-'.$store->id,
            'kind' => 'customer_store',
            'store_id' => $store->id,
            'latitude' => (float) $store->location->latitude,
            'longitude' => (float) $store->location->longitude,
            'title' => $store->name ?: 'Customer',
            'description' => $store->branch ?: $store->address ?: $store->external_bp_code ?: $store->code,
        ];
    }

    private function normalizeBranchLabel(?string $value): ?string
    {
        $value = preg_replace('/[^a-z0-9]+/i', ' ', trim((string) $value));
        $value = trim((string) $value);

        return $value !== '' ? strtolower($value) : null;
    }

    private function distanceMeters(float $latitudeA, float $longitudeA, float $latitudeB, float $longitudeB): float
    {
        $earthRadius = 6371000;
        $latitudeDelta = deg2rad($latitudeB - $latitudeA);
        $longitudeDelta = deg2rad($longitudeB - $longitudeA);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($latitudeA)) * cos(deg2rad($latitudeB)) * sin($longitudeDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
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
        $ping = $user->latestTrustedPing;

        return [
            'user_id'      => $user->id,
            'name'         => $user->name,
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
