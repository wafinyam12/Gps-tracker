<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CrmAuthController extends Controller
{
    public function showLogin()
    {
        if (Auth::check() && $this->canAccessCrm(Auth::user())) {
            return redirect()->route('crm.dashboard');
        }

        return view('crm.login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim($credentials['username']);
        $user = User::query()
            ->where('email', $identifier)
            ->orWhere('username', $identifier)
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'username' => 'Username/email atau password tidak sesuai.',
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => 'Akun tidak aktif. Hubungi administrator.',
            ]);
        }

        if (! $this->canAccessCrm($user)) {
            throw ValidationException::withMessages([
                'username' => 'Akun ini tidak memiliki akses CRM web.',
            ]);
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return redirect()->intended(route('crm.dashboard'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('crm.login');
    }

    private function canAccessCrm(User $user): bool
    {
        return $user->hasAnyRole(['manager', 'admin', 'superadmin']);
    }
}
