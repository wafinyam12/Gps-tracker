@extends('crm.layout')

@section('title', 'Detail Master Toko')

@push('styles')
<style>
    .master-head, .master-actions, .master-meta, .master-grid, .master-form-grid { display: flex; gap: 14px; }
    .master-head { justify-content: space-between; align-items: flex-start; flex-wrap: wrap; margin-bottom: 20px; }
    .master-head h1 { margin: 5px 0; font-size: 27px; }
    .master-head p, .master-muted { color: var(--muted); margin: 0; }
    .master-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 16px; }
    .master-panel { padding: 18px; min-width: 0; }
    .master-panel h2 { font-size: 16px; margin: 0 0 14px; }
    .master-panel h3 { font-size: 14px; margin: 0 0 10px; }
    .master-kv { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr); gap: 8px; margin: 8px 0; }
    .master-kv span { color: var(--muted); }
    .master-kv strong { overflow-wrap: anywhere; }
    .master-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .master-field { display: grid; gap: 6px; color: var(--text-soft); font-size: 12px; font-weight: 700; }
    .master-field input, .master-field textarea { width: 100%; min-height: 40px; padding: 9px 11px; color: var(--text); background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 7px; }
    .master-field textarea { min-height: 88px; resize: vertical; }
    .master-field-wide { grid-column: 1 / -1; }
    .master-form { display: grid; gap: 15px; }
    .master-errors { border: 1px solid var(--danger); background: var(--danger-soft); padding: 12px; border-radius: 7px; color: var(--text); }
    .master-success { border: 1px solid var(--success); background: var(--success-soft); padding: 12px; border-radius: 7px; margin-bottom: 16px; }
    .master-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
    .master-photo { min-width: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface-2); }
    .master-photo img { display: block; width: 100%; height: 145px; object-fit: cover; }
    .master-photo-body { display: grid; gap: 7px; padding: 11px; font-size: 12px; }
    .master-photo-body .btn { width: 100%; white-space: normal; }
    .master-photo-body a { color: var(--primary); }
    .master-table { overflow-x: auto; }
    .master-table table { min-width: 700px; }
    .master-section { margin-top: 16px; }
    @media (max-width: 850px) { .master-grid { grid-template-columns: 1fr; } }
    @media (max-width: 580px) { .master-form-grid { grid-template-columns: 1fr; } }
</style>
@endpush

@section('content')
<main class="page">
    <div data-crm-live-root>
        <div class="master-head">
            <div>
                <a class="master-muted" href="{{ route('crm.stores.index') }}">← Master Toko</a>
                <h1>{{ $store->name }}</h1>
                <p>{{ $store->code }} / {{ $store->external_bp_code ?: '-' }} · {{ $store->team?->name ?: $store->branch ?: 'Tanpa cabang' }}</p>
            </div>
            <span class="badge" data-crm-live-status>Memuat data terbaru otomatis</span>
        </div>

        @if (session('status')) <div class="master-success" role="status">{{ session('status') }}</div> @endif

        <div class="master-grid">
            <div class="panel master-panel">
                <h2>Titik master</h2>
                <div class="master-kv"><span>Koordinat</span><strong>
                    @if ($store->location)
                        @php $masterMap = 'https://www.google.com/maps?q='.$store->location->latitude.','.$store->location->longitude; @endphp
                        <a href="{{ $masterMap }}" target="_blank" rel="noopener">{{ number_format($store->location->latitude, 6, '.', '') }}, {{ number_format($store->location->longitude, 6, '.', '') }}</a>
                    @else
                        Belum ada koordinat
                    @endif
                </strong></div>
                <div class="master-kv"><span>Radius geofence</span><strong>{{ min((int) ($store->geofence_radius ?: 50), 50) }} m</strong></div>
                <div class="master-kv"><span>Sumber koordinat</span><strong>{{ match ($store->coordinate_source) { 'crm_manual' => 'Koreksi manual CRM', 'photo' => 'GPS foto visit', default => $store->location ? 'Check-in / master lama' : '-' } }}</strong></div>
                <div class="master-kv"><span>Sumber katalog</span><strong>{{ $store->master_source ?: '-' }}</strong></div>
                <div class="master-kv"><span>Alamat</span><strong>{{ $store->address ?: '-' }}</strong></div>
            </div>
            <div class="panel master-panel">
                <h2>Status SAP</h2>
                <div class="master-kv"><span>Rekonsiliasi terakhir</span><strong>{{ $sapSync?->status ?? 'Belum ada' }}</strong></div>
                <div class="master-kv"><span>Koordinat terakhir dikirim</span><strong>{{ $sapSync ? number_format($sapSync->latitude, 6, '.', '').', '.number_format($sapSync->longitude, 6, '.', '') : '-' }}</strong></div>
                <p class="master-muted">Koreksi manual di CRM belum otomatis dikirim ke SAP.</p>
            </div>
        </div>

        @if ($canEdit)
            <div class="panel master-panel master-section">
                <h2>Koreksi koordinat dan radius</h2>
                <p class="master-muted" style="margin-bottom: 16px;">Pilih titik dari foto di bawah atau isi lat long sendiri. Perubahan pada kunjungan terbuka hanya diterapkan jika pusat geofence belum ada.</p>
                @if ($errors->any())
                    <div class="master-errors" role="alert">
                        @foreach ($errors->all() as $error) <div>{{ $error }}</div> @endforeach
                    </div>
                @endif
                <form class="master-form" data-coordinate-form method="POST" action="{{ route('crm.stores.update', $store) }}">
                    @csrf
                    @method('PATCH')
                    <div class="master-form-grid">
                        <label class="master-field">Latitude
                            <input name="latitude" type="number" step="any" min="-90" max="90" required value="{{ old('latitude', $store->location?->latitude) }}">
                        </label>
                        <label class="master-field">Longitude
                            <input name="longitude" type="number" step="any" min="-180" max="180" required value="{{ old('longitude', $store->location?->longitude) }}">
                        </label>
                        <label class="master-field">Radius geofence (meter)
                            <input name="geofence_radius" type="number" step="1" min="1" max="50" required value="{{ old('geofence_radius', min((int) ($store->geofence_radius ?: 50), 50)) }}">
                        </label>
                        <label class="master-field master-field-wide">Alasan koreksi
                            <textarea name="reason" maxlength="500" minlength="10" required placeholder="Jelaskan alasan memilih titik ini">{{ old('reason') }}</textarea>
                        </label>
                    </div>
                    <input name="photo_id" type="hidden" value="{{ old('photo_id') }}">
                    <div class="master-actions"><button class="btn btn-primary" type="submit">Simpan Koreksi</button><span class="master-muted" data-selected-photo>{{ old('photo_id') ? 'Foto #'.old('photo_id').' dipilih' : 'Belum memilih foto' }}</span></div>
                </form>
            </div>
        @endif

        <div class="panel master-panel master-section">
            <h2>Foto kandidat titik toko</h2>
            <div class="master-photos">
                @forelse ($recentPhotos as $photo)
                    <div class="master-photo">
                        <a href="{{ $photoPreviewUrls[$photo->id] }}" target="_blank" rel="noopener"><img src="{{ $photoPreviewUrls[$photo->id] }}" alt="Foto visit #{{ $photo->visit_log_id }}" loading="lazy"></a>
                        <div class="master-photo-body">
                            <strong>Visit #{{ $photo->visit_log_id }} · {{ $photo->type }}</strong>
                            <span>{{ $photo->taken_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i') ?: '-' }}</span>
                            @if ($photo->location)
                                <span>{{ number_format($photo->location->latitude, 6, '.', '') }}, {{ number_format($photo->location->longitude, 6, '.', '') }}</span>
                                <span class="master-muted">{{ $photo->location_accuracy !== null ? 'Akurasi GPS: '.number_format($photo->location_accuracy, 1, ',', '.').' m' : 'Akurasi GPS foto lama tidak tersedia' }}</span>
                                <a href="{{ 'https://www.google.com/maps?q='.$photo->location->latitude.','.$photo->location->longitude }}" target="_blank" rel="noopener">Lihat titik di peta ↗</a>
                                @if ($canEdit)
                                    <button class="btn" type="button" data-photo-point data-photo-id="{{ $photo->id }}" data-latitude="{{ $photo->location->latitude }}" data-longitude="{{ $photo->location->longitude }}">Gunakan titik foto</button>
                                @endif
                            @else
                                <span class="master-muted">Foto tidak memiliki titik GPS</span>
                            @endif
                        </div>
                    </div>
                @empty
                    <p class="master-muted">Belum ada foto kunjungan untuk toko ini.</p>
                @endforelse
            </div>
        </div>

        <div class="panel master-panel master-section">
            <h2>Kunjungan terbaru</h2>
            <div class="master-table"><table>
                <thead><tr><th>Visit</th><th>Sales</th><th>Check-in</th><th>GPS check-in</th><th>Status</th></tr></thead>
                <tbody>
                    @forelse ($recentVisits as $visit)
                        <tr>
                            <td>#{{ $visit->id }}</td><td>{{ $visit->user?->name ?: '-' }}</td>
                            <td>{{ $visit->checkin_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i') ?: '-' }}</td>
                            <td>{{ $visit->checkin_location ? number_format($visit->checkin_location->latitude, 6, '.', '').', '.number_format($visit->checkin_location->longitude, 6, '.', '') : '-' }}<br><span class="master-muted">{{ $visit->checkin_accuracy !== null ? number_format($visit->checkin_accuracy, 1, ',', '.').' m' : 'Akurasi tidak ada' }}</span></td>
                            <td>{{ $visit->checkout_at ? 'Selesai' : 'Terbuka' }} · {{ $visit->geofence_reference_source ?: 'Tanpa acuan' }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="master-muted">Belum ada kunjungan.</td></tr>
                    @endforelse
                </tbody>
            </table></div>
        </div>

        <div class="panel master-panel master-section">
            <h2>Riwayat perubahan titik</h2>
            <div class="master-table"><table>
                <thead><tr><th>Waktu</th><th>Oleh</th><th>Dari</th><th>Menjadi</th><th>Alasan / foto</th></tr></thead>
                <tbody>
                    @forelse ($coordinateChanges as $change)
                        <tr>
                            <td>{{ $change->created_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i') }}</td>
                            <td>{{ $change->actor_name ?: 'Otomatis' }}<br><span class="master-muted">{{ $change->source }}</span></td>
                            <td>{{ $change->old_latitude !== null ? number_format($change->old_latitude, 6, '.', '').', '.number_format($change->old_longitude, 6, '.', '') : 'Belum ada' }}<br><span class="master-muted">Radius {{ $change->old_radius ?: '-' }} m</span></td>
                            <td>{{ number_format($change->new_latitude, 6, '.', '') }}, {{ number_format($change->new_longitude, 6, '.', '') }}<br><span class="master-muted">Radius {{ $change->new_radius }} m</span></td>
                            <td>{{ $change->reason ?: '-' }} @if ($change->photo_id) <br><span class="master-muted">Foto #{{ $change->photo_id }}</span> @endif</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="master-muted">Belum ada koreksi titik.</td></tr>
                    @endforelse
                </tbody>
            </table></div>
        </div>
    </div>
</main>
<script>
    document.addEventListener('click', function (event) {
        const button = event.target.closest('[data-photo-point]');
        if (!button) return;
        const form = document.querySelector('[data-coordinate-form]');
        if (!form) return;
        form.elements.latitude.value = button.dataset.latitude;
        form.elements.longitude.value = button.dataset.longitude;
        form.elements.photo_id.value = button.dataset.photoId;
        const selected = document.querySelector('[data-selected-photo]');
        if (selected) selected.textContent = 'Foto #' + button.dataset.photoId + ' dipilih';
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
</script>
@endsection
