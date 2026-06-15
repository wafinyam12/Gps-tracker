<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TeamRequest;
use App\Models\Team;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    /**
     * List semua team
     * Role: admin, spv
     */
    public function index(Request $request)
    {
        $teams = Team::withCount('members')
            ->when($request->search, fn($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('code', 'like', "%{$request->search}%")
                  ->orWhere('area', 'like', "%{$request->search}%")
            )
            ->when(! is_null($request->is_active), fn($q) =>
                $q->where('is_active', $request->boolean('is_active'))
            )
            ->orderBy('name')
            ->paginate($request->per_page ?? 20);

        return response()->success($teams);
    }

    /**
     * Detail team
     * Role: admin, spv
     */
    public function show(Team $team)
    {
        return response()->success($team->loadCount('members'));
    }

    /**
     * Buat team baru
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
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->success($team, 'Team berhasil dibuat.', 201);
    }

    /**
     * Update team
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
            'is_active' => $request->boolean('is_active', $team->is_active),
        ]);

        return response()->success($team, 'Team berhasil diupdate.');
    }

    /**
     * Toggle active status
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
        ], 'Status team diupdate.');
    }

    /**
     * Hapus team
     * Role: admin
     */
    public function destroy(Team $team)
    {
        // Cek jika masih ada anggota
        if ($team->members()->exists()) {
            return response()->error('Tidak bisa menghapus team yang masih memiliki anggota.', 422);
        }

        $team->delete();

        return response()->success(null, 'Team berhasil dihapus.');
    }
}
