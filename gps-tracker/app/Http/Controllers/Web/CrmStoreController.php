<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\SapCoordinateSync;
use App\Models\Store;
use App\Models\Team;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Services\Stores\StoreCoordinateService;
use App\Services\Visits\VisitPhotoUrlService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use MatanYadaev\EloquentSpatial\Objects\Point;

class CrmStoreController extends Controller
{
    public function __construct(
        private readonly StoreCoordinateService $coordinates,
        private readonly VisitPhotoUrlService $photoUrls,
    ) {
    }

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
            'location_status' => ['nullable', 'in:all,filled,empty'],
        ]);
        $viewer = $request->user();
        $query = $this->visibleStores($request);
        $search = trim((string) ($filters['q'] ?? ''));

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search) {
                $query->where('name', 'like', '%'.$search.'%')
                    ->orWhere('code', 'like', '%'.$search.'%')
                    ->orWhere('external_bp_code', 'like', '%'.$search.'%');
            });
        }

        if (! empty($filters['team_id'])) {
            abort_unless($viewer->canAccessTeamId((int) $filters['team_id']), 403);
            $query->where('team_id', (int) $filters['team_id']);
        }

        $locationStatus = $filters['location_status'] ?? 'all';
        if ($locationStatus === 'filled') {
            $query->whereNotNull('location');
        } elseif ($locationStatus === 'empty') {
            $query->whereNull('location');
        }

        $stores = $query->with('team')
            ->orderBy('name')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();
        $teams = Team::query()
            ->when(! $viewer->canAccessAllBranches(), fn (Builder $query) => $query->where('id', $viewer->team_id ?? 0))
            ->orderBy('name')
            ->get();

        return view('crm.stores.index', compact('stores', 'filters', 'teams', 'viewer'));
    }

    public function show(Request $request, Store $store)
    {
        $viewer = $request->user();
        $this->assertVisible($viewer, $store);

        $recentVisits = VisitLog::query()
            ->where('store_id', $store->id)
            ->with('user')
            ->latest('checkin_at')
            ->limit(8)
            ->get();
        $recentPhotos = VisitPhoto::query()
            ->whereHas('visitLog', fn (Builder $query) => $query->where('store_id', $store->id))
            ->with('visitLog.user')
            ->latest('taken_at')
            ->latest('id')
            ->limit(12)
            ->get();
        $photoPreviewUrls = $recentPhotos->mapWithKeys(fn (VisitPhoto $photo) => [
            $photo->id => $this->photoUrls->temporaryPreviewUrl($photo),
        ]);
        $coordinateChanges = $store->coordinateChanges()
            ->with(['actor', 'photo'])
            ->latest('id')
            ->limit(20)
            ->get();
        $sapSync = SapCoordinateSync::query()
            ->where('store_id', $store->id)
            ->latest('id')
            ->first();
        $canEdit = $viewer->hasAnyRole(['admin', 'superadmin']);

        return view('crm.stores.show', compact(
            'store', 'viewer', 'recentVisits', 'recentPhotos', 'photoPreviewUrls', 'coordinateChanges', 'sapSync', 'canEdit',
        ));
    }

    public function update(Request $request, Store $store)
    {
        $viewer = $request->user();
        $this->assertVisible($viewer, $store);
        abort_unless($viewer->hasAnyRole(['admin', 'superadmin']), 403);

        $values = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'geofence_radius' => ['required', 'integer', 'between:1,50'],
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'photo_id' => ['nullable', 'integer', 'exists:visit_photos,id'],
        ]);

        $photo = null;
        if (! empty($values['photo_id'])) {
            $photo = VisitPhoto::query()->with('visitLog')->findOrFail($values['photo_id']);
            if ((int) $photo->visitLog?->store_id !== (int) $store->id || ! $photo->location) {
                throw ValidationException::withMessages([
                    'photo_id' => 'Foto harus berasal dari toko ini dan memiliki koordinat.',
                ]);
            }
        }

        $this->coordinates->setManual(
            $store,
            $viewer,
            new Point((float) $values['latitude'], (float) $values['longitude']),
            (int) $values['geofence_radius'],
            $values['reason'],
            $photo,
        );

        return redirect()->route('crm.stores.show', $store)
            ->with('status', 'Koordinat master toko berhasil disimpan.');
    }

    private function visibleStores(Request $request): Builder
    {
        $viewer = $request->user();

        return Store::query()
            ->when(! $viewer->canAccessAllBranches(), fn (Builder $query) => $query->where('team_id', $viewer->team_id ?? 0));
    }

    private function assertVisible($viewer, Store $store): void
    {
        abort_unless($viewer->canAccessTeamId($store->team_id), 404);
    }
}
