<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Login — return token
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'       => 'required|email',
            'password'    => 'required|string',
            'device_name' => 'required|string', // e.g. "Samsung Galaxy A54"
        ]);

        $user = User::with('roles')->where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password salah.'],
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
}