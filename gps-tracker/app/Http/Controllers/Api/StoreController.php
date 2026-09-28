<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use App\Services\MasterData\StoreCatalogSyncService;

class StoreController extends Controller
{
    private const MAP_MARKER_LIMIT = 100;
    private const MAP_CANDIDATE_LIMIT = 2000;

    public function index(Request $request, StoreCatalogSyncService $catalog)
    {
        $catalog->sync(false, $request->user());
        $perPage = max(1, min((int) ($request->per_page ?? 20), 100));

        $query = $catalog->scopeQuery(Store::query(), $request->user())
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($nested) use ($search) {
                    $nested->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('external_bp_code', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->when($request->branch, fn ($q) => $q->where('branch', $request->branch))
            ->when($request->area, fn ($q) => $q->where('area', $request->area))
            ->when($request->city, fn ($q) => $q->where('city', $request->city))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->is_priority, fn ($q) => $q->where('is_priority', true));

        if ($request->filled('paginate') || $request->filled('per_page')) {
            $stores = $query->orderBy('name')
                ->paginate($perPage);

            return response()->success(
                $stores->getCollection()->map(
                    fn (Store $store) => (new StoreResource($store))->toArray($request)
                )->values()->all()
            );
        }

        $stores = $query
            ->orderBy('name')
            ->get();

        return response()->success(
            $stores->map(fn (Store $store) => (new StoreResource($store))->toArray($request))->values()->all()
        );
    }

    public function available(Request $request, StoreCatalogSyncService $catalog)
    {
        $catalog->ensureCatalog(true, $request->user());

        $search = trim((string) $request->search);
        $page = max(1, (int) ($request->page ?? 1));
        $perPage = max(1, min((int) ($request->per_page ?? 25), 100));
        $shouldPaginate = $request->filled('paginate') || $request->filled('per_page') || $request->filled('page');

        $query = $catalog->scopeQuery(Store::query(), $request->user(), true)
            ->select([
                'id',
                'team_id',
                'code',
                'external_bp_code',
                'sap_slp_code',
                'name',
                'address',
                'area',
                'branch',
                'city',
                'location',
                'geofence_radius',
                'pic_name',
                'pic_phone',
                'status',
                'is_priority',
                'tags',
                'master_source',
                'last_synced_at',
                'assignment_synced_at',
                'created_at',
            ]);

        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $nested->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('external_bp_code', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('branch', 'like', "%{$search}%");
            });
        }

        if ($shouldPaginate) {
            $stores = $query
                ->orderBy('name')
                ->orderBy('id')
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->success([
                'items' => $stores->getCollection()
                    ->map(fn (Store $store) => (new StoreResource($store))->toArray($request))
                    ->values()
                    ->all(),
                'meta' => [
                    'current_page' => $stores->currentPage(),
                    'per_page' => $stores->perPage(),
                    'last_page' => $stores->lastPage(),
                    'total' => $stores->total(),
                    'from' => $stores->firstItem(),
                    'to' => $stores->lastItem(),
                    'has_more' => $stores->hasMorePages(),
                ],
            ]);
        }

        $stores = $query
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->success(
            $stores->map(fn (Store $store) => (new StoreResource($store))->toArray($request))->values()->all()
        );
    }

    public function mapMarkers(Request $request, StoreCatalogSyncService $catalog)
    {
        $validated = $request->validate([
            'south' => 'required|numeric|between:-90,90',
            'north' => 'required|numeric|between:-90,90',
            'west' => 'required|numeric|between:-180,180',
            'east' => 'required|numeric|between:-180,180',
            'zoom' => 'required|integer|min:1|max:19',
            'limit' => 'nullable|integer|min:1|max:'.self::MAP_MARKER_LIMIT,
        ]);

        $south = (float) $validated['south'];
        $north = (float) $validated['north'];
        $west = (float) $validated['west'];
        $east = (float) $validated['east'];
        if ($south >= $north || $west >= $east) {
            return response()->error('Batas peta tidak valid.', 422);
        }

        $user = $request->user();
        $catalog->ensureCatalog(true, $user);

        $stores = $catalog->scopeQuery(Store::query(), $user, true)
            ->select(['id', 'code', 'external_bp_code', 'name', 'address', 'branch', 'location'])
            ->whereNotNull('location')
            ->whereRaw('ST_Y(location) BETWEEN ? AND ?', [$south, $north])
            ->whereRaw('ST_X(location) BETWEEN ? AND ?', [$west, $east])
            ->orderBy('id')
            ->limit(self::MAP_CANDIDATE_LIMIT + 1)
            ->get();

        $candidateLimitReached = $stores->count() > self::MAP_CANDIDATE_LIMIT;
        if ($candidateLimitReached) {
            $stores = $stores->take(self::MAP_CANDIDATE_LIMIT)->values();
        }

        $markerLimit = min((int) ($validated['limit'] ?? self::MAP_MARKER_LIMIT), self::MAP_MARKER_LIMIT);
        $zoom = (int) $validated['zoom'];
        $showIndividualMarkers = $zoom >= 15
            && $stores->count() <= $markerLimit
            && ! $candidateLimitReached;

        if ($showIndividualMarkers) {
            $items = $stores->map(fn (Store $store) => $this->formatMapMarker($store))->values()->all();
            $mode = 'markers';
        } else {
            $items = $this->clusterMapStores($stores, $zoom, $markerLimit);
            $mode = 'clusters';
        }

        return response()->success([
            'mode' => $mode,
            'items' => $items,
            'meta' => [
                'visible_stores' => $stores->count(),
                'candidate_limit' => self::MAP_CANDIDATE_LIMIT,
                'candidate_limit_reached' => $candidateLimitReached,
                'marker_limit' => $markerLimit,
            ],
        ]);
    }

    private function clusterMapStores(Collection $stores, int $zoom, int $markerLimit): array
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
                    return floor((float) $store->location->latitude / $cellSize).':'
                        .floor((float) $store->location->longitude / $cellSize);
                })
                ->map(function (Collection $clusterStores, string $key) {
                    $count = $clusterStores->count();

                    return [
                        'id' => 'store-cluster-'.$key,
                        'kind' => 'customer_cluster',
                        'count' => $count,
                        'latitude' => round((float) $clusterStores->avg(fn (Store $store) => $store->location->latitude), 6),
                        'longitude' => round((float) $clusterStores->avg(fn (Store $store) => $store->location->longitude), 6),
                        'title' => $count.' toko',
                        'description' => 'Perbesar peta untuk melihat marker toko.',
                    ];
                })
                ->sortByDesc('count')
                ->values();

            if ($clusters->count() <= $markerLimit) {
                break;
            }
        }

        return $clusters->take($markerLimit)->values()->all();
    }

    private function formatMapMarker(Store $store): array
    {
        return [
            'id' => 'store-'.$store->id,
            'kind' => 'store',
            'store_id' => $store->id,
            'latitude' => (float) $store->location->latitude,
            'longitude' => (float) $store->location->longitude,
            'title' => $store->name ?: 'Toko',
            'description' => $store->branch ?: $store->address ?: $store->external_bp_code ?: $store->code,
        ];
    }

    public function show(StoreCatalogSyncService $catalog, Store $store)
    {
        $catalog->sync(false, request()->user());

        $store = $catalog->findById($store->id, request()->user(), false);
        abort_unless($store, 404);

        return response()->success((new StoreResource($store))->toArray(request()));
    }

    public function store()
    {
        return response()->error('Master data toko berasal dari SAP dan tidak bisa ditambah manual.', 403);
    }

    public function update()
    {
        return response()->error('Master data toko berasal dari SAP dan tidak bisa diubah manual.', 403);
    }

    public function toggleStatus()
    {
        return response()->error('Status master toko dikelola otomatis dan tidak bisa diubah manual.', 403);
    }

    public function destroy()
    {
        return response()->error('Master data toko tidak bisa dihapus manual.', 403);
    }

    public function filters(StoreCatalogSyncService $catalog)
    {
        $catalog->sync(false, request()->user());

        $stores = $catalog->scopeQuery(Store::query(), request()->user());

        return response()->success([
            'branches' => (clone $stores)->distinct()->pluck('branch')->filter()->values(),
            'areas'    => (clone $stores)->distinct()->pluck('area')->filter()->values(),
            'cities'   => (clone $stores)->distinct()->pluck('city')->filter()->values(),
        ]);
    }
}
