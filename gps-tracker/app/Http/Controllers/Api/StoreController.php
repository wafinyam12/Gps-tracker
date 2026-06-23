<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Request;
use App\Services\MasterData\StoreCatalogSyncService;

class StoreController extends Controller
{
    public function index(Request $request, StoreCatalogSyncService $catalog)
    {
        $catalog->sync(false, $request->user());
        $perPage = max(1, min((int) ($request->per_page ?? 20), 100));

        $query = Store::query()
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

        $source = filled($request->user()?->db_sap) && filled($request->user()?->slpCode)
            ? 'sap_outstanding_receivable'
            : 'sap_dummy';

        $search = trim((string) $request->search);
        $limit = $request->filled('limit') ? max(1, min((int) $request->limit, 500)) : null;

        $query = Store::query()
            ->select([
                'id',
                'code',
                'external_bp_code',
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
                'created_at',
            ])
            ->where('master_source', $source)
            ->where('status', 'active');

        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $nested->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('external_bp_code', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhere('branch', 'like', "%{$search}%");
            });
        }

        if ($limit) {
            $query->limit($limit);
        }

        $stores = $query->orderBy('name')->get();

        return response()->success(
            $stores->map(fn (Store $store) => (new StoreResource($store))->toArray($request))->values()->all()
        );
    }

    public function show(StoreCatalogSyncService $catalog, Store $store)
    {
        $catalog->sync(false, request()->user());

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

        return response()->success([
            'branches' => Store::distinct()->pluck('branch')->filter()->values(),
            'areas'    => Store::distinct()->pluck('area')->filter()->values(),
            'cities'   => Store::distinct()->pluck('city')->filter()->values(),
        ]);
    }
}
