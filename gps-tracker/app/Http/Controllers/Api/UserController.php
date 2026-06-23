<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Http\Resources\UserResource;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * List semua user
     * Role: admin
     */
    public function index(Request $request)
    {
        $perPage = max(1, min((int) ($request->per_page ?? 20), 100));
        $search = trim((string) $request->search);

        $users = User::with(['roles', 'team'])
            ->when($request->role, fn ($q) => $q->role($request->role))
            ->when($request->team_id, fn ($q) => $q->where('team_id', $request->team_id))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($nested) use ($search) {
                    $nested->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('employee_id', 'like', "%{$search}%");
                });
            })
            ->when(! is_null($request->is_active), fn($q) =>
                $q->where('is_active', $request->boolean('is_active'))
            )
            ->orderBy('name')
            ->paginate($perPage);

        return UserResource::collection($users);
    }

    /**
     * Detail user
     * Role: admin
     */
    public function show(User $user)
    {
        return new UserResource($user->load(['roles', 'team']));
    }

    /**
     * Buat user baru
     * Role: admin
     */
    public function store(UserRequest $request)
    {
        $teamId = $request->role === 'manager' ? null : $request->team_id;
        $username = strtolower(trim((string) $request->username));

        $user = User::create([
            'name'        => $request->name,
            'username'    => $username,
            'email'       => $request->email,
            'password'    => Hash::make($request->password),
            'phone'       => $request->phone,
            'employee_id' => $request->employee_id,
            'team_id'     => $teamId,
            'is_active'   => $request->boolean('is_active', true),
        ]);

        $user->assignRole($request->role);

        return response()->success([
            'user'    => new UserResource($user->load(['roles', 'team'])),
        ], 'User berhasil dibuat.', 201);
    }

    /**
     * Update user
     * Role: admin
     */
    public function update(UserRequest $request, User $user)
    {
        $teamId = $request->role === 'manager' ? null : $request->team_id;
        $username = strtolower(trim((string) $request->username));

        $data = [
            'name'        => $request->name,
            'username'    => $username,
            'email'       => $request->email,
            'phone'       => $request->phone,
            'employee_id' => $request->employee_id,
            'team_id'     => $teamId,
            'is_active'   => $request->boolean('is_active', $user->is_active),
        ];

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        // Update role kalau berubah
        if ($user->getRoleNames()->first() !== $request->role) {
            $user->syncRoles([$request->role]);
        }

        return response()->success([
            'user'    => new UserResource($user->fresh()->load(['roles', 'team'])),
        ], 'User berhasil diupdate.');
    }

    /**
     * Toggle active status
     * Role: admin
     */
    public function toggleActive(User $user)
    {
        // Prevent menonaktifkan diri sendiri
        if ($user->id === request()->user()->id) {
            return response()->error('Tidak bisa menonaktifkan akun sendiri.', 422);
        }

        $user->update(['is_active' => ! $user->is_active]);

        // Revoke semua token kalau dinonaktifkan
        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return response()->success([
            'is_active' => $user->is_active,
        ], 'Status user diupdate.');
    }

    /**
     * Hapus user (soft delete)
     * Role: admin
     */
    public function destroy(User $user)
    {
        if ($user->id === request()->user()->id) {
            return response()->error('Tidak bisa menghapus akun sendiri.', 422);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->success(null, 'User berhasil dihapus.');
    }

    /**
     * List teams
     * Role: admin, spv
     */
    public function teams()
    {
        $teams = Team::withCount(['members' => fn($q) => $q->where('is_active', true)])
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->success(TeamResource::collection($teams));
    }
}
