@extends('crm.layout')

@section('title', 'Login CRM')

@push('styles')
<style>
    .login-wrap {
        min-height: calc(100vh - 68px);
        display: grid;
        place-items: center;
        padding: 24px;
    }
    .login-panel {
        width: min(100%, 420px);
        padding: 28px;
        background: var(--surface);
    }
    .login-title {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
    }
    .login-copy {
        margin: 8px 0 24px;
        color: var(--muted);
        line-height: 1.5;
    }
    .field { margin-bottom: 16px; }
    .label {
        display: block;
        margin-bottom: 7px;
        font-size: 13px;
        font-weight: 650;
    }
    .input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 8px;
        min-height: 44px;
        padding: 10px 12px;
        background: var(--bg-elevated);
        color: var(--text);
    }
    .input:focus {
        outline: 2px solid rgba(15, 118, 110, 0.18);
        border-color: var(--primary);
    }
    .password-field { position: relative; }
    .password-field .input { padding-right: 52px; }
    .password-toggle {
        position: absolute;
        top: 0;
        right: 4px;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
    }
    .password-toggle svg { width: 20px; height: 20px; }
    .password-toggle .eye-off,
    .password-toggle[aria-pressed="true"] .eye-open { display: none; }
    .password-toggle[aria-pressed="true"] .eye-off { display: block; }
    .password-toggle:focus-visible { outline: 2px solid var(--primary); border-radius: 6px; }
    .error {
        margin: 0 0 16px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--danger-soft);
        color: var(--danger);
        font-size: 13px;
        font-weight: 800;
    }
    .remember {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        color: var(--muted);
        font-size: 13px;
    }
</style>
@endpush

@section('content')
<main class="login-wrap">
    <section class="panel login-panel">
        <h1 class="login-title">Masuk CRM</h1>
        <p class="login-copy">Akses web untuk audit kunjungan, analisis performa sales, dan penarikan laporan manajemen.</p>

        @if ($errors->any())
            <div class="error">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="{{ route('crm.login.submit') }}">
            @csrf
            <div class="field">
                <label class="label" for="username">Username atau Email</label>
                <input class="input" id="username" name="username" value="{{ old('username') }}" autocomplete="username" required autofocus>
            </div>
            <div class="field">
                <label class="label" for="password">Password</label>
                <div class="password-field">
                    <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
                    <button class="password-toggle" id="password-visibility-toggle" type="button" aria-label="Tampilkan password" aria-controls="password" aria-pressed="false">
                        <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                        <svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a16.7 16.7 0 0 1-3.2 4.2M6.5 6.5C3.6 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></svg>
                    </button>
                </div>
            </div>
            <label class="remember">
                <input type="checkbox" name="remember" value="1">
                Ingat sesi login
            </label>
            <button class="btn btn-primary" type="submit" style="width: 100%;">Masuk</button>
        </form>
    </section>
</main>
<script>
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-visibility-toggle');

    passwordToggle.addEventListener('click', () => {
        const visible = passwordInput.type === 'password';
        passwordInput.type = visible ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(visible));
        passwordToggle.setAttribute('aria-label', visible ? 'Sembunyikan password' : 'Tampilkan password');
    });
</script>
@endsection
