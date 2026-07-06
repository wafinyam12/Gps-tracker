@extends('crm.layout')

@section('title', 'Dashboard')

@php
    $overview = $dashboard['overview'];
    $audit = $dashboard['audit'];
    $query = array_filter([
        'date_from' => $filters['date_from'] ?? null,
        'date_to' => $filters['date_to'] ?? null,
        'team_id' => $filters['team_id'] ?? null,
        'user_id' => $filters['user_id'] ?? null,
    ], fn ($value) => $value !== null && $value !== '');

    $fmt = function ($value) {
        $numeric = is_numeric($value) ? (float) $value : 0;
        $decimals = abs($numeric - floor($numeric)) > 0.0001 ? 1 : 0;

        return number_format($numeric, $decimals, ',', '.');
    };

    $completion = min(100, max(0, (float) ($overview['completion_pct'] ?? 0)));
    $riskTotal = ($audit['missing_target_days'] ?? 0)
        + ($audit['duplicate_visits'] ?? 0)
        + ($audit['invalid_checkins'] ?? 0)
        + ($audit['mock_location_pings'] ?? 0)
        + ($audit['open_visits'] ?? 0);
@endphp

@push('styles')
<style>
    .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        align-items: end;
        margin-bottom: 18px;
    }

    .hero h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.2;
        font-weight: 700;
    }

    .hero-copy {
        margin: 8px 0 0;
        max-width: 760px;
        color: var(--muted);
        line-height: 1.5;
    }

    .hero-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
    }

    .filters {
        padding: 16px;
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
        align-items: end;
        margin-bottom: 18px;
    }

    .filter-field { min-width: 0; }

    .filter-field label {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
        text-transform: uppercase;
    }

    .filter-field input,
    .filter-field select {
        width: 100%;
        min-height: 42px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 9px 10px;
        background: var(--bg-elevated);
        color: var(--text);
    }

    .filter-field input:focus,
    .filter-field select:focus {
        outline: 2px solid var(--primary-soft);
        border-color: var(--primary-strong);
    }

    .filter-actions {
        grid-column: span 2;
        display: flex;
        gap: 8px;
    }

    .crm-workspace {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        gap: 18px;
        align-items: start;
    }

    .menu-panel {
        position: sticky;
        top: 88px;
        padding: 14px;
    }

    .menu-title {
        padding: 4px 4px 12px;
        color: var(--text-soft);
        font-size: 13px;
        font-weight: 650;
    }

    .menu-list {
        display: grid;
        gap: 8px;
    }

    .menu-item {
        width: 100%;
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr);
        gap: 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 11px;
        background: transparent;
        color: var(--text-soft);
        text-align: left;
    }

    .menu-item:hover,
    .menu-item.is-active {
        background: var(--surface-2);
        border-color: var(--line);
        color: var(--text);
    }

    .menu-item.is-active {
        box-shadow: inset 0 0 0 1px rgba(92, 201, 189, 0.12);
    }

    .menu-dot {
        width: 8px;
        height: 8px;
        margin-top: 6px;
        border-radius: 999px;
        background: var(--line-strong);
    }

    .menu-item.is-active .menu-dot { background: var(--text-soft); }

    .menu-item strong {
        display: block;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.2;
    }

    .menu-item small {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.35;
    }

    .side-actions {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
        display: grid;
        gap: 8px;
    }

    .workbench {
        min-width: 0;
    }

    .crm-section { display: none; }
    .crm-section.is-active { display: block; }

    .section-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
        margin-bottom: 12px;
    }

    .section-head h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
    }

    .section-head p {
        margin: 5px 0 0;
        color: var(--muted);
        line-height: 1.5;
    }

    .metric-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
    }

    .metric {
        min-height: 126px;
        padding: 16px;
    }

    .metric-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        font-weight: 650;
    }

    .metric-value {
        margin-top: 14px;
        font-size: 24px;
        line-height: 1.15;
        font-weight: 700;
    }

    .metric-note {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
    }

    .metric.is-risk {
        border-color: var(--line-strong);
        background: rgba(18, 24, 27, 0.94);
    }

    .metric.is-good {
        border-color: var(--line-strong);
        background: rgba(18, 24, 27, 0.94);
    }

    .split {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 12px;
        margin-top: 12px;
    }

    .focus-panel {
        padding: 18px;
        min-height: 280px;
        display: grid;
        align-content: center;
        gap: 18px;
    }

    .radial {
        --value: 0%;
        width: 178px;
        aspect-ratio: 1;
        border-radius: 50%;
        margin: 0 auto;
        display: grid;
        place-items: center;
        background:
            radial-gradient(circle at center, var(--surface) 0 58%, transparent 59%),
            conic-gradient(var(--primary-strong) var(--value), var(--surface-3) 0);
        box-shadow: inset 0 0 0 1px var(--line), 0 18px 40px rgba(0, 0, 0, 0.22);
    }

    .radial strong {
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
    }

    .radial span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 11px;
        text-align: center;
        text-transform: uppercase;
        font-weight: 650;
    }

    .insight-list {
        display: grid;
        gap: 10px;
    }

    .insight-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
    }

    .insight-row:last-child { border-bottom: 0; }

    .insight-row span {
        color: var(--muted);
        font-size: 13px;
    }

    .insight-row strong {
        font-size: 15px;
        font-weight: 650;
    }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
    }

    .panel-head h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
    }

    .panel-body { padding: 16px; }

    .risk-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-top: 1px solid var(--line);
        border-left: 1px solid var(--line);
        margin-bottom: 12px;
    }

    .risk-item {
        min-height: 96px;
        padding: 14px;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        background: rgba(20, 32, 30, 0.62);
    }

    .risk-value {
        font-size: 22px;
        font-weight: 700;
    }

    .risk-label {
        margin-top: 7px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
    }

    .progress {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--surface-3);
        margin-top: 7px;
    }

    .progress span {
        display: block;
        height: 100%;
        background: var(--primary-strong);
    }

    .empty {
        padding: 34px 18px;
        text-align: center;
        color: var(--muted);
    }

    .report-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }

    .report-card {
        padding: 18px;
        display: grid;
        gap: 14px;
        min-height: 180px;
    }

    .report-card h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
    }

    .report-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
    }

    @media (max-width: 1180px) {
        .crm-workspace { grid-template-columns: 1fr; }
        .menu-panel { position: static; }
        .menu-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .side-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .split { grid-template-columns: 1fr; }
    }

    @media (max-width: 820px) {
        .hero,
        .section-head {
            grid-template-columns: 1fr;
        }

        .hero-meta { justify-content: flex-start; }
        .filters { grid-template-columns: 1fr; }
        .filter-actions { grid-column: span 1; flex-direction: column; }
        .menu-list { grid-template-columns: 1fr; }
        .side-actions { grid-template-columns: 1fr; }
        .metric-grid,
        .risk-strip,
        .report-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
@endpush

@section('content')
<main class="page">
    <div class="hero">
        <div>
            <h1>CRM Audit & Reporting</h1>
            <p class="hero-copy">Pusat analisis data kunjungan sales untuk manager dan direksi: performa, kepatuhan visit, exception audit, dan laporan siap export.</p>
        </div>
        <div class="hero-meta">
            <span class="badge badge-info">{{ $filters['date_from'] }} - {{ $filters['date_to'] }}</span>
            <span class="badge @if($riskTotal > 0) badge-medium @else badge-good @endif">{{ $fmt($riskTotal) }} audit issue</span>
        </div>
    </div>

    <form class="panel filters" method="GET" action="{{ route('crm.dashboard') }}">
        <div class="filter-field">
            <label for="date_from">Dari Tanggal</label>
            <input id="date_from" name="date_from" type="date" value="{{ $filters['date_from'] }}">
        </div>
        <div class="filter-field">
            <label for="date_to">Sampai Tanggal</label>
            <input id="date_to" name="date_to" type="date" value="{{ $filters['date_to'] }}">
        </div>
        <div class="filter-field">
            <label for="team_id">Cabang</label>
            <select id="team_id" name="team_id">
                <option value="">Semua cabang</option>
                @foreach ($teams as $team)
                    <option value="{{ $team->id }}" @selected((string) ($filters['team_id'] ?? '') === (string) $team->id)>
                        {{ $team->name }}
                    </option>
                @endforeach
            </select>
        </div>
        <div class="filter-field">
            <label for="user_id">Sales</label>
            <select id="user_id" name="user_id">
                <option value="">Semua sales</option>
                @foreach ($salesOptions as $sales)
                    <option value="{{ $sales->id }}" @selected((string) ($filters['user_id'] ?? '') === (string) $sales->id)>
                        {{ $sales->name }}
                    </option>
                @endforeach
            </select>
        </div>
        <div class="filter-actions">
            <button class="btn btn-primary" type="submit">Terapkan Filter</button>
            <a class="btn btn-ghost" href="{{ route('crm.dashboard') }}">Reset</a>
        </div>
    </form>

    <div class="crm-workspace">
        <aside class="panel menu-panel" aria-label="Menu CRM">
            <div class="menu-title">Menu Analisis</div>
            <div class="menu-list">
                <button class="menu-item is-active" type="button" data-crm-tab="summary">
                    <span class="menu-dot"></span>
                    <span><strong>Ringkasan</strong><small>KPI direksi dan tren utama</small></span>
                </button>
                <button class="menu-item" type="button" data-crm-tab="audit">
                    <span class="menu-dot"></span>
                    <span><strong>Audit</strong><small>Exception dan risiko data</small></span>
                </button>
                <button class="menu-item" type="button" data-crm-tab="branches">
                    <span class="menu-dot"></span>
                    <span><strong>Cabang</strong><small>Perbandingan performa area</small></span>
                </button>
                <button class="menu-item" type="button" data-crm-tab="sales">
                    <span class="menu-dot"></span>
                    <span><strong>Sales</strong><small>Ranking dan warning user</small></span>
                </button>
                <button class="menu-item" type="button" data-crm-tab="stores">
                    <span class="menu-dot"></span>
                    <span><strong>Toko</strong><small>Analisis customer yang dikunjungi</small></span>
                </button>
                <button class="menu-item" type="button" data-crm-tab="reports">
                    <span class="menu-dot"></span>
                    <span><strong>Export</strong><small>Tarik file laporan Excel</small></span>
                </button>
            </div>
            <div class="side-actions">
                <a class="btn" href="{{ route('crm.export.visits', $query) }}">Export Kunjungan</a>
                <a class="btn" href="{{ route('crm.export.sales-summary', $query) }}">Export Summary</a>
            </div>
        </aside>

        <div class="workbench">
            <section class="crm-section is-active" data-crm-section="summary">
                <div class="section-head">
                    <div>
                        <h2>Ringkasan Eksekutif</h2>
                        <p>Angka utama untuk membaca capaian dan kualitas data kunjungan dalam periode aktif.</p>
                    </div>
                    <span class="badge badge-info">{{ $fmt($overview['active_sales']) }} sales aktif</span>
                </div>

                <div class="metric-grid">
                    <div class="panel metric is-good">
                        <div class="metric-label">Realisasi Target</div>
                        <div class="metric-value">{{ $fmt($overview['completion_pct']) }}%</div>
                        <div class="metric-note">{{ $fmt($overview['unique_visits']) }} dari {{ $fmt($overview['target_visits']) }} target kunjungan</div>
                    </div>
                    <div class="panel metric">
                        <div class="metric-label">Total Visit</div>
                        <div class="metric-value">{{ $fmt($overview['total_visits']) }}</div>
                        <div class="metric-note">{{ $fmt($overview['visited_stores']) }} toko dikunjungi</div>
                    </div>
                    <div class="panel metric">
                        <div class="metric-label">Order Taken</div>
                        <div class="metric-value">{{ $fmt($overview['order_taken']) }}</div>
                        <div class="metric-note">{{ $fmt($overview['avg_duration_min']) }} menit rata-rata visit</div>
                    </div>
                    <div class="panel metric is-risk">
                        <div class="metric-label">Audit Issue</div>
                        <div class="metric-value">{{ $fmt($riskTotal) }}</div>
                        <div class="metric-note">{{ $fmt($overview['mock_pings']) }} fake GPS ping terdeteksi</div>
                    </div>
                </div>

                <div class="split">
                    <div class="panel focus-panel">
                        <div class="radial" style="--value: {{ $completion }}%;">
                            <div>
                                <strong>{{ $fmt($overview['completion_pct']) }}%</strong>
                                <span>Completion</span>
                            </div>
                        </div>
                        <div class="insight-list">
                            <div class="insight-row"><span>Sales online</span><strong>{{ $fmt($overview['online_sales']) }} / {{ $fmt($overview['active_sales']) }}</strong></div>
                            <div class="insight-row"><span>Foto visit</span><strong>{{ $fmt($overview['photo_count']) }}</strong></div>
                            <div class="insight-row"><span>Visit duplicate</span><strong>{{ $fmt($overview['duplicate_visits']) }}</strong></div>
                        </div>
                    </div>

                    <div class="panel">
                        <div class="panel-head">
                            <h3>Tren Harian</h3>
                            <span class="badge">{{ count($dashboard['daily_trend']) }} hari</span>
                        </div>
                        <div class="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Target</th>
                                        <th>Realisasi</th>
                                        <th>Duplicate</th>
                                        <th>Completion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($dashboard['daily_trend']->take(10) as $day)
                                        <tr>
                                            <td><strong>{{ $day['date'] }}</strong></td>
                                            <td>{{ $fmt($day['target_visits']) }}</td>
                                            <td>{{ $fmt($day['unique_visits']) }}</td>
                                            <td>{{ $fmt($day['duplicate_visits']) }}</td>
                                            <td>
                                                <strong>{{ $fmt($day['completion_pct']) }}%</strong>
                                                <div class="progress"><span style="width: {{ min(100, (float) $day['completion_pct']) }}%"></span></div>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr><td colspan="5" class="empty">Belum ada data tren untuk filter ini.</td></tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>

            <section class="crm-section" data-crm-section="audit">
                <div class="section-head">
                    <div>
                        <h2>Audit & Exception</h2>
                        <p>Fokus untuk menemukan data yang perlu diverifikasi sebelum laporan dipakai manajemen.</p>
                    </div>
                    <span class="badge @if($riskTotal > 0) badge-medium @else badge-good @endif">{{ $fmt($riskTotal) }} temuan</span>
                </div>

                <div class="risk-strip">
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['missing_target_days']) }}</div><div class="risk-label">Target belum tercapai</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['duplicate_visits']) }}</div><div class="risk-label">Visit duplikat</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['invalid_checkins']) }}</div><div class="risk-label">Check-in tidak valid</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['mock_location_pings']) }}</div><div class="risk-label">fake GPS ping</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['open_visits']) }}</div><div class="risk-label">Belum checkout</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['visits_without_photos']) }}</div><div class="risk-label">Visit tanpa foto</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['mock_location_users']) }}</div><div class="risk-label">User terindikasi fake GPS</div></div>
                    <div class="risk-item"><div class="risk-value">{{ $fmt($audit['checkout_missing_pct']) }}%</div><div class="risk-label">Checkout pending</div></div>
                </div>

                <div class="panel">
                    <div class="panel-head">
                        <h3>Daftar Exception Audit</h3>
                        <span class="badge badge-medium">{{ count($dashboard['audit_exceptions']) }} temuan</span>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Severity</th>
                                    <th>Sales</th>
                                    <th>Temuan</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($dashboard['audit_exceptions']->take(25) as $exception)
                                    <tr>
                                        <td>{{ $exception['date'] ?: '-' }}</td>
                                        <td>
                                            <span class="badge @if($exception['severity'] === 'high') badge-high @else badge-medium @endif">
                                                {{ strtoupper($exception['severity']) }}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{{ $exception['sales_name'] }}</strong>
                                            <div class="muted">{{ $exception['team'] }}</div>
                                        </td>
                                        <td>
                                            <strong>{{ $exception['store_name'] ?: str_replace('_', ' ', $exception['type']) }}</strong>
                                            <div class="muted">{{ $exception['message'] }}</div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr><td colspan="4" class="empty">Tidak ada exception untuk periode ini.</td></tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="crm-section" data-crm-section="branches">
                <div class="section-head">
                    <div>
                        <h2>Performa Cabang</h2>
                        <p>Bandingkan capaian target, volume visit, dan risiko audit antar cabang.</p>
                    </div>
                    <span class="badge badge-info">{{ count($dashboard['branch_performance']) }} cabang</span>
                </div>

                <div class="panel">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Cabang</th>
                                    <th>Sales</th>
                                    <th>Target</th>
                                    <th>Realisasi</th>
                                    <th>Completion</th>
                                    <th>Order</th>
                                    <th>Audit</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($dashboard['branch_performance'] as $branch)
                                    @php $branchRisk = $branch['mock_pings'] + $branch['invalid_checkins'] + $branch['duplicate_visits'] + $branch['open_visits']; @endphp
                                    <tr>
                                        <td>
                                            <strong>{{ $branch['team_name'] }}</strong>
                                            <div class="muted">{{ $branch['area'] ?: $branch['team_code'] }}</div>
                                        </td>
                                        <td>{{ $fmt($branch['sales_count']) }}</td>
                                        <td>{{ $fmt($branch['target_visits']) }}</td>
                                        <td>{{ $fmt($branch['unique_visits']) }}</td>
                                        <td>
                                            <strong>{{ $fmt($branch['completion_pct']) }}%</strong>
                                            <div class="progress"><span style="width: {{ min(100, (float) $branch['completion_pct']) }}%"></span></div>
                                        </td>
                                        <td>{{ $fmt($branch['order_taken']) }}</td>
                                        <td>
                                            <span class="badge @if($branchRisk > 0) badge-high @else badge-good @endif">{{ $fmt($branchRisk) }}</span>
                                        </td>
                                    </tr>
                                @empty
                                    <tr><td colspan="7" class="empty">Belum ada data cabang untuk filter ini.</td></tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="crm-section" data-crm-section="sales">
                <div class="section-head">
                    <div>
                        <h2>Performa Sales</h2>
                        <p>Urutan sales ditampilkan dari risiko audit tertinggi agar manager cepat menentukan follow-up.</p>
                    </div>
                    <span class="badge">{{ count($dashboard['sales_performance']) }} sales</span>
                </div>

                <div class="panel">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Sales</th>
                                    <th>Cabang</th>
                                    <th>Target</th>
                                    <th>Realisasi</th>
                                    <th>Order</th>
                                    <th>Completion</th>
                                    <th>Warning</th>
                                    <th>Last Visit</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($dashboard['sales_performance'] as $sales)
                                    <tr>
                                        <td>
                                            <strong>{{ $sales['name'] }}</strong>
                                            <div class="muted">{{ $sales['employee_id'] ?: 'Tanpa employee ID' }}</div>
                                        </td>
                                        <td>{{ $sales['team'] }}</td>
                                        <td>{{ $fmt($sales['target_visits']) }}</td>
                                        <td>{{ $fmt($sales['unique_visits']) }}</td>
                                        <td>{{ $fmt($sales['order_taken']) }}</td>
                                        <td>
                                            <strong>{{ $fmt($sales['completion_pct']) }}%</strong>
                                            <div class="progress"><span style="width: {{ min(100, (float) $sales['completion_pct']) }}%"></span></div>
                                        </td>
                                        <td>
                                            <span class="badge @if($sales['risk_score'] > 0) badge-medium @else badge-good @endif">{{ $fmt($sales['risk_score']) }}</span>
                                        </td>
                                        <td class="muted">{{ $sales['last_visit_at'] ? \Carbon\Carbon::parse($sales['last_visit_at'])->timezone('Asia/Jakarta')->format('d/m/Y H:i') : '-' }}</td>
                                    </tr>
                                @empty
                                    <tr><td colspan="8" class="empty">Belum ada data sales untuk filter ini.</td></tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="crm-section" data-crm-section="stores">
                <div class="section-head">
                    <div>
                        <h2>Analisis Toko</h2>
                        <p>Lihat customer yang paling sering dikunjungi dan kualitas aktivitas visit pada level toko.</p>
                    </div>
                    <span class="badge">{{ count($dashboard['store_analysis']) }} toko</span>
                </div>

                <div class="panel">
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Toko</th>
                                    <th>Cabang</th>
                                    <th>Total Visit</th>
                                    <th>Unique</th>
                                    <th>Duplicate</th>
                                    <th>Avg Durasi</th>
                                    <th>Last Visit</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($dashboard['store_analysis'] as $store)
                                    <tr>
                                        <td>
                                            <strong>{{ $store['store_name'] ?: 'Toko tidak terhubung' }}</strong>
                                            <div class="muted">{{ $store['external_bp_code'] ?: $store['store_code'] ?: '-' }}</div>
                                        </td>
                                        <td>{{ $store['branch'] ?: '-' }}</td>
                                        <td>{{ $fmt($store['total_visits']) }}</td>
                                        <td>{{ $fmt($store['unique_visits']) }}</td>
                                        <td>{{ $fmt($store['duplicate_visits']) }}</td>
                                        <td>{{ $fmt($store['avg_duration_min']) }} mnt</td>
                                        <td class="muted">{{ $store['last_visit_at'] ? \Carbon\Carbon::parse($store['last_visit_at'])->timezone('Asia/Jakarta')->format('d/m/Y H:i') : '-' }}</td>
                                    </tr>
                                @empty
                                    <tr><td colspan="7" class="empty">Belum ada data toko untuk filter ini.</td></tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="crm-section" data-crm-section="reports">
                <div class="section-head">
                    <div>
                        <h2>Export Laporan</h2>
                        <p>File mengikuti filter periode, cabang, dan sales yang sedang aktif pada dashboard.</p>
                    </div>
                    <span class="badge badge-info">{{ $filters['date_from'] }} - {{ $filters['date_to'] }}</span>
                </div>

                <div class="report-grid">
                    <div class="panel report-card">
                        <div>
                            <h3>Laporan Kunjungan</h3>
                            <p>Detail setiap visit, toko, validasi lokasi, duplicate, hasil kunjungan, dan catatan lapangan.</p>
                        </div>
                        <a class="btn btn-primary" href="{{ route('crm.export.visits', $query) }}">Download Excel</a>
                    </div>
                    <div class="panel report-card">
                        <div>
                            <h3>Summary Sales</h3>
                            <p>Rekap target, realisasi, completion, order, durasi, mock GPS, dan warning per sales.</p>
                        </div>
                        <a class="btn btn-primary" href="{{ route('crm.export.sales-summary', $query) }}">Download Excel</a>
                    </div>
                </div>
            </section>
        </div>
    </div>
</main>

<script>
    (function () {
        const tabs = Array.from(document.querySelectorAll('[data-crm-tab]'));
        const sections = Array.from(document.querySelectorAll('[data-crm-section]'));

        function activate(tabName) {
            if (!sections.some((section) => section.dataset.crmSection === tabName)) {
                tabName = 'summary';
            }

            tabs.forEach((tab) => {
                tab.classList.toggle('is-active', tab.dataset.crmTab === tabName);
            });

            sections.forEach((section) => {
                section.classList.toggle('is-active', section.dataset.crmSection === tabName);
            });

            try {
                window.localStorage.setItem('crm.activeTab', tabName);
                history.replaceState(null, '', '#' + tabName);
            } catch (error) {
                return;
            }
        }

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => activate(tab.dataset.crmTab));
        });

        const initial = window.location.hash.replace('#', '') || window.localStorage.getItem('crm.activeTab') || 'summary';
        activate(initial);
    })();
</script>
@endsection
