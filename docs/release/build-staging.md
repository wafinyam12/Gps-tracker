# Build Staging Android

## EAS Environment

Profil build `staging` memakai channel EAS Update `staging` dan EAS Environment
`preview`. Nama environment `staging` kustom tidak tersedia pada paket EAS
saat ini, sedangkan channel tetap dapat bernama `staging`.

Variabel berikut sudah dibuat pada EAS project untuk environment `preview`:

```env
EXPO_PUBLIC_API_BASE_URL=https://crm-sales.utomo-dev.xyz/api/v1
EXPO_PUBLIC_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Android package staging:

```text
xyz.utomodev.salesdaily.staging
```

Current staging version: `1.1.6` (Expo SDK 54)
Current staging `versionCode`: `10`
This APK embeds the restored **Manajemen User** and **Manajemen Cabang** menus;
it does not rely on the SDK 54 `1.1.4` OTA update to show them.

The queue, store cache, KYC drafts, and queued visit photos are encrypted in
SQLCipher. Queued photos are BLOBs in `offline-visits-encrypted.db`. This needs
a **new APK**; an OTA update cannot add SQLCipher to an older APK.

Use the `staging/sdk54-main` checkout of this repository.
Keep its SDK 54 dependencies and lock file together when building.

## Check Project

```bash
npm ci
npm run check
npm run test:offline
```

## Build APK With EAS

From the repository root, enter the mobile app folder before running EAS:

```bash
cd gps-tracker-mobile
```

Login once:

```bash
npx eas-cli login
```

Build installable Android APK:

```bash
npx eas-cli build -p android --profile staging
```

EAS will return an APK download link after the build completes.

If EAS fails while packing `gps-tracker/public/storage`, the command was likely run from the repository root or EAS included backend files. Run the build from `gps-tracker-mobile`; EAS will retrieve the staging values from its `preview` environment.

The mobile API client also defaults to staging when no environment variable is embedded. Local development requires an explicit `EXPO_PUBLIC_API_BASE_URL` override.

Maps use OpenStreetMap tiles through a WebView + Leaflet component, so Android builds do not need a Google Maps API key.

## Publish OTA Update

Build and install the staging APK at least once before sending an OTA update.
Use the staging channel with the matching EAS Environment:

```bash
npx eas-cli update --branch staging --platform android --environment preview --message "Deskripsi perubahan"
```

### Support OTA untuk runtime 1.1.5 dan 1.1.6

Build lama `1.1.5` meminta runtime `1.1.5`; APK staging baru `1.1.6` meminta
runtime `1.1.6`. Konfigurasi saat ini memakai `runtimeVersion.policy=appVersion`,
jadi perintah OTA biasa dari source ini hanya menerbitkan update untuk runtime
`1.1.6`. Channel dan branch tetap `staging`; Expo hanya mengirim update yang
runtime-nya cocok dengan APK terpasang.

Untuk perubahan JavaScript/UI yang kompatibel dengan native code kedua APK,
terbitkan update yang sama dua kali:

1. Di `app.json`, ubah sementara `expo.runtimeVersion` menjadi string
   `"1.1.5"`. Jangan ubah `expo.version` (`1.1.6`) atau `android.versionCode`
   (`10`).
2. Dari folder `gps-tracker-mobile`, terbitkan update untuk runtime lama:

   ```powershell
   npx.cmd eas-cli update --branch staging --platform android --environment preview --message "Deskripsi perubahan - runtime 1.1.5"
   ```

   Pastikan output EAS menyebut runtime `1.1.5`.
3. Kembalikan `expo.runtimeVersion` ke
   `{ "policy": "appVersion" }`. Dengan `expo.version` `1.1.6`, konfigurasi
   ini menghasilkan runtime `1.1.6`.
4. Terbitkan bundle yang sama untuk runtime baru:

   ```powershell
   npx.cmd eas-cli update --branch staging --platform android --environment preview --message "Deskripsi perubahan - runtime 1.1.6"
   ```

   Pastikan output EAS menyebut runtime `1.1.6`.
5. Periksa kedua update di branch staging:

   ```powershell
   npx.cmd eas-cli update:list --branch staging --platform android --runtime-version 1.1.5
   npx.cmd eas-cli update:list --branch staging --platform android --runtime-version 1.1.6
   ```

Jangan commit atau membiarkan override `"1.1.5"` di `app.json`; sebelum build
APK berikutnya, pastikan kembali ada policy `appVersion`. Terapkan proses dua
kali hanya jika bundle tetap kompatibel dengan native code pada APK `1.1.5`
dan `1.1.6`. Perubahan native seperti dependency, permission, atau konfigurasi
native membutuhkan APK baru; jangan kirim JavaScript yang bergantung pada API
native baru ke runtime lama.

Terus layani kedua runtime sampai versi lama resmi dihentikan. Saat rilis baru
membutuhkan instalasi ulang atau native runtime baru, distribusikan APK baru,
beri tahu pengguna agar menyinkronkan kunjungan offline sebelum uninstall
(uninstall menghapus antrean lokal terenkripsi), lalu hentikan publikasi OTA
untuk runtime `1.1.5` dan `1.1.6` setelah pengguna diwajibkan pindah. Kebutuhan
build baru ditentukan oleh kompatibilitas native, bukan semata-mata nomor versi
major.

Referensi: [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
dan [EAS CLI](https://docs.expo.dev/eas/cli/).

Changes to native dependencies, Android permissions, or native configuration
require a new APK because OTA cannot add or change native code. An app-version
change can still receive a compatibility OTA when explicitly published for its
existing runtime. If a release introduces a new runtime, distribute a new APK
for users to move to that runtime.

### OTA kamera visit dan draft form (19 November 2026)

Perubahan JavaScript pada kamera kunjungan menambah pilihan depan/belakang.
Kamera dibuka sebagai layar penuh. Isian form visit yang belum disimpan tetap
ada ketika sales kembali dari kamera; ringkasan foto tetap diperbarui.

Update awal di bawah memakai presentasi modal. Pengguna build 9 melaporkan
indikator kamera menyala tetapi layar kamera tidak tampil. Presentasi modal
kemudian dibatalkan; kedua update awal ini telah digantikan dan **bukan**
update terbaru yang perlu diuji.

- Android `staging`, EAS Environment `preview`, runtime `1.1.5`:
  [update group `ea94173f-ec8e-4b7d-a8b0-b0c56189785b`](https://expo.dev/accounts/nyma/projects/sales-daily/updates/ea94173f-ec8e-4b7d-a8b0-b0c56189785b)
  (update ID `01a1f272-e4ea-7a6d-ab28-5655d2b03156`).
- Android `staging`, EAS Environment `preview`, runtime `1.1.6`:
  [update group `0d918911-dd93-429b-99cc-259c234dc3f5`](https://expo.dev/accounts/nyma/projects/sales-daily/updates/0d918911-dd93-429b-99cc-259c234dc3f5)
  (update ID `01a1f274-7984-7545-932a-f3ede33bcba0`).

Update koreksi terbaru di branch `staging`:

- Runtime `1.1.5`: [group `68c0f295-d938-4f97-a3f0-2bd13a9deada`](https://expo.dev/accounts/nyma/projects/sales-daily/updates/68c0f295-d938-4f97-a3f0-2bd13a9deada)
  (Android update ID `01a1f28b-0684-71b8-812c-572ec5d089b0`).
- Runtime `1.1.6`: [group `e78c97bb-43e4-4710-b691-fae7ee666db8`](https://expo.dev/accounts/nyma/projects/sales-daily/updates/e78c97bb-43e4-4710-b691-fae7ee666db8)
  (Android update ID `01a1f28c-84a7-75a4-b479-92d681b6ecc5`).

Server Expo mengembalikan HTTP 200 dan ID koreksi terbaru untuk kedua runtime.
Tes offline mobile lulus 20/20 dan bundle Android koreksi berhasil dibuat.
Pada 19 November 2026, pengguna melaporkan pengujian langsung di perangkat
sudah aman. Jalur yang terpasang saat uji (OTA atau APK build 10) belum dicatat.
`app.json` telah dikembalikan ke `runtimeVersion.policy=appVersion`.

### Rilis koordinat toko dan pembaruan CRM otomatis (belum dipublikasikan)

Perubahan ini meliputi koreksi titik dan radius master toko dari CRM, pengisian master kosong dari GPS foto baru yang lolos pemeriksaan, GPS terpisah untuk setiap foto mobile, dan penyegaran CRM otomatis. Panduan penggunaan ada di [Koordinat Master Toko di CRM](../operations/store-coordinate-management.md).

Urutan rilis staging:

1. Deploy backend Laravel terlebih dahulu. Jalankan `php artisan migrate --force` untuk menambah tabel audit dan metadata GPS foto, lalu `php artisan optimize:clear`. Periksa `php artisan route:list --path=crm` dan endpoint `/crm/live-version` saat login dengan peran CRM.
2. Di CRM, buka **Master Toko**. Coba koreksi satu toko uji dengan alasan dan periksa riwayat. Buka dashboard di tab lain; setelah mobile mengirim visit/foto, data seharusnya diperbarui otomatis saat tab terlihat tanpa browser refresh. Form koreksi yang belum disimpan harus tetap berisi inputnya.
3. Setelah API baru aktif, terbitkan bundle mobile pada runtime `1.1.5` dan `1.1.6` memakai prosedur dua OTA di atas. Kode ini memakai `expo-camera` dan `expo-location` yang sudah menjadi dependency SDK 54; pastikan kedua APK terpasang memiliki modul native itu sebelum OTA. Jangan kirim bundle ke runtime yang tidak kompatibel.
4. Uji di kedua runtime: ambil dua foto di titik berbeda, periksa titik dan akurasi masing-masing di CRM; ulangi saat offline lalu sinkronkan. Coba tanpa izin GPS: kamera tetap terbuka dan foto tersimpan, tetapi master tidak terisi otomatis. Periksa pilihan kamera depan/belakang dan isian form visit tetap ada saat kembali dari kamera.
5. Untuk kasus foto lama seperti visit #66, pilih titik foto secara manual di CRM setelah memeriksa peta dan bukti. Data lama tidak mempunyai akurasi GPS per foto yang dapat diverifikasi. Kunjungan yang telah selesai tidak dihitung ulang.

Hingga backend dan kedua OTA benar-benar dipublikasikan dan diuji di perangkat, bagian ini adalah prosedur rilis, bukan laporan bahwa fitur sudah tersedia bagi sales.

Karena build 9 di perangkat pengguna belum menampilkan OTA yang diharapkan,
[APK staging 1.1.6 build 10](https://expo.dev/accounts/nyma/projects/sales-daily/builds/d529765d-bcad-438c-99f8-362194d47ebe)
dibuat dengan koreksi tertanam. Build ID `d529765d-bcad-438c-99f8-362194d47ebe`,
channel `staging`, runtime `1.1.6`, dan commit sumber `6e6aa23`. Pasang di atas
build 9 tanpa menghapus aplikasi/data. Setelah terpasang, periksa tombol
"Ambil foto wajib", pilihan kamera depan/belakang, lalu kembalinya isian form.

### Sales visit UI update (17 November 2026)

The Sales visit screens now use a compact dashboard, a list-first store search,
consistent form spacing, and updated camera, history, and location screens.
The Android staging update for runtime `1.1.5` is
[f3325aa2-8a32-432d-9a31-3f2bc2e8068b](https://expo.dev/accounts/nyma/projects/sales-daily/updates/f3325aa2-8a32-432d-9a31-3f2bc2e8068b).
No APK rebuild is needed for this UI update on the installed SDK 54 APK.
Close and reopen the app twice while online to load it. The Sales dashboard and
store search, empty history, location permission denial, and status-bar
contrast were checked on an Infinix X6525B. Full dummy-visit and offline device
checks are still pending.

### Area Manager target range (17 November 2026)

Backend target range starts in commit `db7d87d`, with the final validation fix
in `9bf3e56`. Copy the current `routes/api.php` and
`app/Http/Controllers/Api/DailyTargetController.php` to staging, then run
`php artisan optimize:clear` and `php artisan route:list --path=target` there.
The existing `daily_targets` table is reused; there is no new migration or
Composer change. See the [Area Manager target API](../reference/target-range-api.md) for the contract.

The Area Manager mobile form starts in commit `50a74b7`. The current Android
staging update for runtime `1.1.5` is
[55a324ce-c90c-4001-9b88-a9d9730b5642](https://expo.dev/accounts/nyma/projects/sales-daily/updates/55a324ce-c90c-4001-9b88-a9d9730b5642).
The staging routes were confirmed by SSH. On Infinix X6525B, the AM account
loaded a branch-scoped Sales list, selected a Sales, chose an inclusive
three-day range, opened the keyboard, and reviewed the confirmation without
saving. The backend target API passed 8 new and 6 existing relevant tests.
A write and summary refresh on staging were not attempted because the visible
Sales account is real UAT data and no dummy Sales exists in the AM branch.
Only the isolated local test database was used to verify writes and rollback.
The numeric field stayed visible above the Infinix keyboard. Its native
Android underline is still visible on this device despite the transparent
underline setting; this is a cosmetic item for the next UI pass.
This is a JS-only OTA; no new APK is required. The update also shows visits
above target as an actual percentage (for example, 7/5 = 140%) while keeping
the progress bar capped at 100% width.

## Install APK

Download the APK on the Android device and install it manually, or install with USB debugging:

```bash
adb install path/to/sales-daily.apk
```

## Smoke Test

- Login as superadmin and open **Manajemen User**. Use the `+` button to add a
  sales account with a branch and SAP sales code; confirm the new account can
  log in. **Manajemen Cabang** remains available to prepare the branch first.
- Login with an active sales user.
- Open store list or available stores.
- Send location ping.
- Turn off mobile data and Wi-Fi, then check in and take a photo.
- Force close and reopen the app while offline; confirm the queued visit remains.
- Reconnect, wait for sync, and confirm the visit and photo appear once on the backend.
- Check out and confirm the result on the backend.
- Repeat login and visit access with an admin account.
- On a device with a pending visit/photo from the old SDK 54 APK, install this
  APK over it without clearing data; confirm the old visit syncs once.
- Interrupt that upgrade once during the first launch, reopen, and confirm
  the same queue/photo is still available and can sync.
- Queue several visits with up to five photos each while offline, restart, and
  confirm the queue opens and syncs without freezing or exhausting storage.

Do not clear application data or uninstall an existing APK if it has unsynced
visits. A device with photo files created by the SDK 58 AES implementation
cannot upload them from this SDK 54 APK; leave that data intact and use an
SDK 58 recovery build.
