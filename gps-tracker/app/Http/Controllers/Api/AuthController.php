<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\MasterData\StoreCatalogSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login — return token
     */
    public function login(Request $request)
    {
        $request->validate([
            'username'    => 'required|string|max:255',
            'password'    => 'required|string|max:255',
            'device_name' => 'required|string|max:120', // e.g. "Samsung Galaxy A54"
        ]);

        $login = $this->normalizeLoginIdentifier($request->username);
        $user = User::with('roles')
            ->where(function ($query) use ($login) {
                $query->whereRaw('LOWER(username) = ?', [$login])
                    ->orWhereRaw('LOWER(email) = ?', [$login]);
            })
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Username/email atau password salah.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->error('Akun tidak aktif. Hubungi administrator.', 403);
        }

        // Revoke token lama dari device yang sama (prevent duplicate login)
        $user->tokens()->where('name', $request->device_name)->delete();

        $token = $user->createToken($request->device_name, [
            // abilities berdasarkan role
            ...$user->getAllPermissions()->pluck('name')->toArray(),
        ])->plainTextToken;

        $this->warmStoreCatalogAfterLogin($user);

        return response()->success([
            'token'   => $token,
            'user'    => new UserResource($user),
        ], 'Login berhasil.');
    }

    /**
     * Logout — revoke current token
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->success(null, 'Logout berhasil.');
    }

    /**
     * Logout dari semua device
     */
    public function logoutAll(Request $request)
    {
        $request->user()->tokens()->delete();

        return response()->success(null, 'Logout dari semua device berhasil.');
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user()->load(['roles', 'team']);

        return response()->success([
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Refresh token — revoke lama, buat baru
     */
    public function refresh(Request $request)
    {
        $user        = $request->user();
        $deviceName  = $request->user()->currentAccessToken()->name;

        $request->user()->currentAccessToken()->delete();

        $token = $user->createToken($deviceName, [
            ...$user->getAllPermissions()->pluck('name')->toArray(),
        ])->plainTextToken;

        return response()->success([
            'token' => $token,
        ]);
    }

    private function warmStoreCatalogAfterLogin(User $user): void
    {
        if (! $user->hasAnyRole(['sales', 'spv'])) {
            return;
        }

        if (! filled($user->db_sap) || ! filled($user->slpCode)) {
            return;
        }

        $catalog = app(StoreCatalogSyncService::class);

        app()->terminating(function () use ($catalog, $user) {
            try {
                $catalog->warm($user);
            } catch (\Throwable $throwable) {
                Log::warning('Failed to warm SAP store catalog after login', [
                    'user_id' => $user->id,
                    'db_sap' => $user->db_sap,
                    'slp_code' => $user->slpCode,
                    'error' => $throwable->getMessage(),
                ]);
            }
        });
    }

    private function normalizeLoginIdentifier(string $identifier): string
    {
        return Str::lower(trim($identifier));
    }
}
