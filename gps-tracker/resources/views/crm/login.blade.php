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
                <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
            </div>
            <label class="remember">
                <input type="checkbox" name="remember" value="1">
                Ingat sesi login
            </label>
            <button class="btn btn-primary" type="submit" style="width: 100%;">Masuk</button>
        </form>
    </section>
</main>
@endsection
