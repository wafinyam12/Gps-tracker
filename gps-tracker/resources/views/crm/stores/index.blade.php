@extends('crm.layout')

@section('title', 'Master Toko')

@push('styles')
<style>
    .store-head, .store-filter-actions, .store-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .store-head { margin-bottom: 20px; }
    .store-head h1 { margin: 5px 0; font-size: 27px; }
    .store-head p, .store-note { color: var(--muted); margin: 0; }
    .store-filters { padding: 18px; display: grid; grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(150px, 1fr)) auto; gap: 14px; align-items: end; margin-bottom: 18px; }
    .store-filters label { display: grid; gap: 6px; color: var(--text-soft); font-size: 12px; font-weight: 700; }
    .store-filters input, .store-filters select { width: 100%; min-height: 40px; padding: 8px 10px; color: var(--text); background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 7px; }
    .store-list { overflow: hidden; }
    .store-list .store-toolbar { padding: 16px 18px; border-bottom: 1px solid var(--line); }
    .store-list table { min-width: 880px; }
    .store-list .store-name { font-weight: 700; }
    .store-list .store-code { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .store-list .store-action { color: var(--primary); font-weight: 700; }
    .store-pagination { padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    @media (max-width: 850px) { .store-filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 550px) { .store-filters { grid-template-columns: 1fr; } }
</style>
@endpush

@section('content')
<main class="page">
    <div data-crm-live-root>
        <div class="store-head">
            <div>
                <a class="store-note" href="{{ route('crm.dashboard') }}#stores">← Analisis Toko</a>
                <h1>Master Toko</h1>
                <p>Cari toko dan periksa titik koordinat yang dipakai untuk kunjungan berikutnya.</p>
            </div>
            <span class="badge" data-crm-live-status>Memuat data terbaru otomatis</span>
        </div>

        <form class="panel store-filters" method="GET" action="{{ route('crm.stores.index') }}">
            <label>Cari nama, kode, atau BP
                <input type="search" name="q" value="{{ $filters['q'] ?? '' }}" placeholder="Contoh: HADI ISMANTO atau C00007670">
            </label>
            <label>Cabang
                <select name="team_id">
                    <option value="">Semua cabang yang diizinkan</option>
                    @foreach ($teams as $team)
                        <option value="{{ $team->id }}" @selected((int) ($filters['team_id'] ?? 0) === $team->id)>{{ $team->name }}</option>
                    @endforeach
                </select>
            </label>
            <label>Koordinat
                <select name="location_status">
                    <option value="all" @selected(($filters['location_status'] ?? 'all') === 'all')>Semua</option>
                    <option value="filled" @selected(($filters['location_status'] ?? '') === 'filled')>Sudah ada</option>
                    <option value="empty" @selected(($filters['location_status'] ?? '') === 'empty')>Belum ada</option>
                </select>
            </label>
            <button class="btn btn-primary" type="submit">Cari Toko</button>
        </form>

        <div class="panel store-list">
            <div class="store-toolbar">
                <strong>{{ number_format($stores->total(), 0, ',', '.') }} toko</strong>
                <span class="store-note">Daftar master tidak dibatasi periode dashboard</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Toko</th><th>Cabang</th><th>Koordinat master</th><th>Radius</th><th>Sumber titik</th><th></th></tr></thead>
                    <tbody>
                        @forelse ($stores as $store)
                            <tr>
                                <td><div class="store-name">{{ $store->name }}</div><div class="store-code">{{ $store->code }} / {{ $store->external_bp_code ?: '-' }}</div></td>
                                <td>{{ $store->team?->name ?: $store->branch ?: '-' }}</td>
                                <td>
                                    @if ($store->location)
                                        {{ number_format($store->location->latitude, 6, '.', '') }}, {{ number_format($store->location->longitude, 6, '.', '') }}
                                    @else
                                        <span class="badge badge-medium">Belum ada koordinat</span>
                                    @endif
                                </td>
                                <td>{{ min((int) ($store->geofence_radius ?: 50), 50) }} m</td>
                                <td>{{ match ($store->coordinate_source) { 'crm_manual' => 'Koreksi CRM', 'photo' => 'Foto visit', default => $store->location ? 'Check-in / master lama' : '-' } }}</td>
                                <td><a class="store-action" href="{{ route('crm.stores.show', $store) }}">Lihat dan atur →</a></td>
                            </tr>
                        @empty
                            <tr><td colspan="6" class="store-note">Tidak ada toko sesuai pencarian.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            <div class="store-pagination">
                <span class="store-note">Halaman {{ $stores->currentPage() }} dari {{ max(1, $stores->lastPage()) }}</span>
                <div class="store-filter-actions">
                    @if ($stores->previousPageUrl()) <a class="btn" href="{{ $stores->previousPageUrl() }}">← Sebelumnya</a> @endif
                    @if ($stores->nextPageUrl()) <a class="btn" href="{{ $stores->nextPageUrl() }}">Berikutnya →</a> @endif
                </div>
            </div>
        </div>
    </div>
</main>
@endsection
