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
        $catalog->sync();

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
                ->paginate((int) ($request->per_page ?? 20));

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
        $stores = $catalog->activeStores()
            ->when($request->search, function ($collection) use ($request) {
                $search = mb_strtolower(trim((string) $request->search));

                return $collection->filter(function (Store $store) use ($search) {
                    $fields = [
                        $store->name,
                        $store->code,
                        $store->external_bp_code,
                        $store->address,
                        $store->branch,
                    ];

                    foreach ($fields as $field) {
                        if ($field && str_contains(mb_strtolower($field), $search)) {
                            return true;
                        }
                    }

                    return false;
                })->values();
            })
            ->values();

        return response()->success(
            $stores->map(fn (Store $store) => (new StoreResource($store))->toArray($request))->values()->all()
        );
    }

    public function show(StoreCatalogSyncService $catalog, Store $store)
    {
        $catalog->sync();

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
        return response()->error('Status master toko dikelola dari SAP/dummy master data.', 403);
    }

    public function destroy()
    {
        return response()->error('Master data toko tidak bisa dihapus manual.', 403);
    }

    public function filters(StoreCatalogSyncService $catalog)
    {
        $catalog->sync();

        return response()->success([
            'branches' => Store::distinct()->pluck('branch')->filter()->values(),
            'areas'    => Store::distinct()->pluck('area')->filter()->values(),
            'cities'   => Store::distinct()->pluck('city')->filter()->values(),
        ]);
    }
}
