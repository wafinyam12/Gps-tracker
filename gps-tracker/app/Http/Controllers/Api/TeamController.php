<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TeamRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use Illuminate\Http\Request;
use MatanYadaev\EloquentSpatial\Objects\Point;

class TeamController extends Controller
{
    /**
     * List semua cabang
     * Role: admin, manager, spv
     */
    public function index(Request $request)
    {
        $perPage = max(1, min((int) ($request->per_page ?? 20), 100));

        $teams = Team::withCount('members')
            ->when($request->search, function ($q) use ($request) {
                $search = $request->search;

                $q->where(function ($nested) use ($search) {
                    $nested->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('area', 'like', "%{$search}%");
                });
            })
            ->when($request->user()?->hasRole('spv') && ! $request->user()?->hasAnyRole(['manager', 'admin']), fn ($q) =>
                $q->where('id', $request->user()->team_id)
            )
            ->when(! is_null($request->is_active), fn($q) =>
                $q->where('is_active', $request->boolean('is_active'))
            )
            ->orderBy('name')
            ->paginate($perPage);

        return response()->success(TeamResource::collection($teams));
    }

    /**
     * Detail cabang
     * Role: admin, manager, spv
     */
    public function show(Request $request, Team $team)
    {
        if (! $this->canViewTeam($request, $team)) {
            return response()->error('Anda hanya dapat melihat cabang sendiri.', 403);
        }

        return response()->success(new TeamResource($team->loadCount('members')));
    }

    /**
     * Buat cabang baru
     * Role: admin
     */
    public function store(TeamRequest $request)
    {
        // Admin only can create teams
        if (! $request->user()->hasRole('admin')) {
            return response()->error('Unauthorized action.', 403);
        }
        $team = Team::create([
            'name'      => $request->name,
            'code'      => $request->code,
            'area'      => $request->area,
            'location'  => new Point(
                latitude: (float) $request->latitude,
                longitude: (float) $request->longitude,
            ),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->success(new TeamResource($team->loadCount('members')), 'Cabang berhasil dibuat.', 201);
    }

    /**
     * Update cabang
     * Role: admin
     */
    public function update(TeamRequest $request, Team $team)
    {
        // Admin only can update teams
        if (! $request->user()->hasRole('admin')) {
            return response()->error('Unauthorized action.', 403);
        }

        $team->update([
            'name'      => $request->name,
            'code'      => $request->code,
            'area'      => $request->area,
            'location'  => new Point(
                latitude: (float) $request->latitude,
                longitude: (float) $request->longitude,
            ),
            'is_active' => $request->boolean('is_active', $team->is_active),
        ]);

        return response()->success(new TeamResource($team->loadCount('members')), 'Cabang berhasil diupdate.');
    }

    /**
     * Toggle active status cabang
     * Role: admin
     */
    public function toggleActive(Team $team)
    {
        // Admin only can toggle status
        if (! auth()->user()->hasRole('admin')) {
            return response()->error('Unauthorized action.', 403);
        }

        $team->update(['is_active' => ! $team->is_active]);

        return response()->success([
            'is_active' => $team->is_active,
        ], 'Status cabang diupdate.');
    }

    /**
     * Hapus cabang
     * Role: admin
     */
    public function destroy(Team $team)
    {
        // Cek jika masih ada anggota
        if ($team->members()->exists()) {
            return response()->error('Tidak bisa menghapus cabang yang masih memiliki anggota.', 422);
        }

        $team->delete();

        return response()->success(null, 'Cabang berhasil dihapus.');
    }

    private function canViewTeam(Request $request, Team $team): bool
    {
        $viewer = $request->user();

        if ($viewer?->hasAnyRole(['admin', 'manager'])) {
            return true;
        }

        if ($viewer?->hasRole('spv')) {
            return $viewer->team_id !== null && (int) $viewer->team_id === (int) $team->id;
        }

        return false;
    }
}
