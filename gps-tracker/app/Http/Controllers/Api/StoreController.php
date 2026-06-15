<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRequest;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use Illuminate\Http\Request;
use MatanYadaev\EloquentSpatial\Objects\Point;

class StoreController extends Controller
{
    /**
     * List semua toko dengan filter & pagination
     * Role: semua authenticated
     */
    public function index(Request $request)
    {
        $stores = Store::query()
            ->when($request->search, fn($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('code', 'like', "%{$request->search}%")
                  ->orWhere('address', 'like', "%{$request->search}%")
            )
            ->when($request->area, fn($q) =>
                $q->where('area', $request->area)
            )
            ->when($request->city, fn($q) =>
                $q->where('city', $request->city)
            )
            ->when($request->status, fn($q) =>
                $q->where('status', $request->status)
            )
            ->when($request->is_priority, fn($q) =>
                $q->where('is_priority', true)
            )
            ->orderBy('name')
            ->paginate($request->per_page ?? 20);

        return StoreResource::collection($stores);
    }

    /**
     * Detail toko
     */
    public function show(Store $store)
    {
        return new StoreResource($store);
    }

    /**
     * Buat toko baru
     * Role: admin
     */
    public function store(StoreRequest $request)
    {
        $store = Store::create([
            ...$request->validated(),
            'location' => new Point(
                latitude: $request->latitude,
                longitude: $request->longitude,
            ),
        ]);

        return response()->success([
            'store'   => new StoreResource($store),
        ], 'Toko berhasil dibuat.', 201);
    }

    /**
     * Update toko
     * Role: admin
     */
    public function update(StoreRequest $request, Store $store)
    {
        $store->update([
            ...$request->validated(),
            'location' => new Point(
                latitude: $request->latitude,
                longitude: $request->longitude,
            ),
        ]);

        return response()->success([
            'store'   => new StoreResource($store->fresh()),
        ], 'Toko berhasil diupdate.');
    }

    /**
     * Nonaktifkan toko (soft approach via status)
     * Role: admin
     */
    public function toggleStatus(Store $store)
    {
        $store->update([
            'status' => $store->status === 'active' ? 'inactive' : 'active',
        ]);

        return response()->success([
            'status'  => $store->status,
        ], 'Status toko diupdate.');
    }

    /**
     * Hapus toko (soft delete)
     * Role: admin
     */
    public function destroy(Store $store)
    {
        $store->delete();

        return response()->success(null, 'Toko berhasil dihapus.');
    }

    /**
     * List area & kota unik (untuk filter dropdown)
     * Role: semua authenticated
     */
    public function filters()
    {
        return response()->success([
            'areas'  => Store::distinct()->pluck('area')->filter()->values(),
            'cities' => Store::distinct()->pluck('city')->filter()->values(),
        ]);
    }
}
