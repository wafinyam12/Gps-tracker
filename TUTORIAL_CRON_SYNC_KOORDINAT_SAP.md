# Tutorial Cron Sync Koordinat Customer ke SAP

Dokumen ini menjelaskan cara menjalankan sinkronisasi koordinat customer dari Sales Daily ke SAP secara terjadwal. Proses ini terdiri dari dua bagian yang **wajib** berjalan:

1. **Laravel Scheduler** menjalankan command `sap:sync-customer-coordinates` pada jadwal yang ditentukan.
2. **Queue worker** memproses job yang dimasukkan command tersebut ke queue `sap-coordinate-sync` dan mengirimkannya ke API SAP.

Menjalankan scheduler/cron tanpa queue worker hanya membuat job menumpuk. Sebaliknya, queue worker tanpa scheduler tidak akan otomatis mengambil record koordinat yang masih `pending` atau `retry`.

## 1. Cara kerja sinkronisasi

Alurnya sebagai berikut:

```text
Visit selesai dengan GPS valid
        ↓
Observasi koordinat dibuat
        ↓
Record sap_coordinate_syncs dibuat: pending
        ↓
Scheduler menjalankan sap:sync-customer-coordinates
        ↓
Job masuk ke queue sap-coordinate-sync
        ↓
Queue worker membandingkan / mengirim koordinat ke SAP
```

Satu record hanya layak dibuat dari visit yang memenuhi seluruh syarat berikut:

- Check-in berada di dalam geofence toko.
- Bukan lokasi palsu/mock GPS.
- Bukan visit duplicate.
- Akurasi GPS check-in maksimal 25 m (nilai default, dapat dikonfigurasi).
- Toko sudah mempunyai titik koordinat, memiliki `external_bp_code`, dan cabang memiliki `db_sap`.

Ini bukan proses bulk seluruh toko. Proses hanya mengirim koordinat yang memiliki record `pending` atau `retry` pada tabel `sap_coordinate_syncs`.

## 2. Jadwal yang sudah tersedia di aplikasi

Konfigurasi saat ini ada di `gps-tracker/routes/console.php`:

```php
Schedule::command(SyncSapCustomerCoordinatesCommand::class)
    ->dailyAt('16:00')
    ->timezone('Asia/Jakarta')
    ->name('sync-sap-customer-coordinates')
    ->withoutOverlapping();
```

Artinya Laravel akan melakukan **dispatch job setiap hari pukul 16.00 WIB**. Cron server tetap perlu memanggil `php artisan schedule:run` setiap menit agar Laravel dapat mendeteksi waktu 16.00 tersebut.

> Jika kebutuhan operasional mengharuskan retry diproses lebih cepat dari satu hari, ubah `dailyAt('16:00')` menjadi `everyFifteenMinutes()` atau jadwal lain yang disetujui, kemudian jalankan `php artisan optimize:clear` dan restart queue worker.

## 3. Prasyarat

Lakukan pemeriksaan ini di folder backend `D:\gps tracker\gps-tracker` (atau path deployment server).

### 3.1 Migrasi dan queue

```powershell
php artisan migrate --force
php artisan queue:failed-table
php artisan migrate --force
```

`queue:failed-table` hanya diperlukan bila tabel `failed_jobs` belum ada. Jangan jalankan command tersebut berulang pada database yang sudah memiliki migration-nya.

Pastikan `.env` menggunakan queue persisten, misalnya:

```dotenv
QUEUE_CONNECTION=database
```

Untuk Redis, gunakan `QUEUE_CONNECTION=redis` dan sesuaikan command worker pada bagian berikutnya.

### 3.2 Konfigurasi API SAP

Atur nilai berikut di `.env` server. Gunakan kredensial nyata dari administrator SAP dan jangan memasukkan nilainya ke Git atau dokumen ini.

```dotenv
SAP_BP_COORDINATE_BASE_URL=https://alamat-gateway-sap/api/v1/bp-coordinate
SAP_BP_COORDINATE_GET_URL_TEMPLATE={base}/{db}/{cardcode}
SAP_BP_COORDINATE_TIMEOUT=15
SAP_BP_COORDINATE_TOKEN=<token-jika-dipakai>
SAP_BP_COORDINATE_API_KEY=<api-key-jika-dipakai>

SAP_COORDINATE_MATCH_TOLERANCE_METERS=50
SAP_COORDINATE_VERIFICATION_THRESHOLD_METERS=100
SAP_COORDINATE_MAX_OBSERVATION_ACCURACY_METERS=25
SAP_COORDINATE_OBSERVATION_AGREEMENT_METERS=30
```

Setelah mengubah `.env`:

```powershell
php artisan optimize:clear
```

Pastikan server dapat menjangkau endpoint SAP melalui HTTPS, dan cabang terkait memiliki `db_sap`, sementara toko memiliki `external_bp_code` (CardCode SAP).

### 3.3 Verifikasi command dan jadwal

```powershell
php artisan schedule:list
php artisan sap:sync-customer-coordinates --limit=1
```

Command kedua hanya memasukkan maksimal satu record `pending`/`retry` ke queue; command tersebut tidak langsung mengirim data ke SAP. Jika output menunjukkan `0 BP coordinate sync job(s) queued`, berarti belum ada record yang menunggu, atau belum ada yang waktunya eligible untuk retry.

## 4. Setup production Linux

Contoh berikut menggunakan project di `/var/www/sales-daily`, user web `www-data`, dan PHP CLI di `/usr/bin/php`. Sesuaikan dengan server sebenarnya.

### 4.1 Tambahkan cron Laravel scheduler

Buka crontab user yang menjalankan aplikasi:

```bash
crontab -e
```

Tambahkan satu baris berikut:

```cron
* * * * * cd /var/www/sales-daily && /usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

Jangan membuat cron terpisah yang langsung menjalankan command koordinat pukul 16.00, karena jadwal tersebut sudah dikelola Laravel. Cukup satu cron `schedule:run` per menit untuk semua scheduler Laravel.

### 4.2 Jalankan queue worker dengan Supervisor

Buat file `/etc/supervisor/conf.d/sales-daily-sap-coordinate.conf`:

```ini
[program:sales-daily-sap-coordinate]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php /var/www/sales-daily/artisan queue:work database --queue=sap-coordinate-sync,default --sleep=3 --tries=3 --timeout=90
directory=/var/www/sales-daily
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/sales-daily/storage/logs/sap-coordinate-worker.log
stopwaitsecs=3600
```

Jika memakai Redis, ganti `database` menjadi `redis` pada parameter command.

Aktifkan konfigurasi:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start sales-daily-sap-coordinate:*
sudo supervisorctl status
```

Setelah deployment kode atau perubahan `.env`, lakukan:

```bash
cd /var/www/sales-daily
php artisan optimize:clear
php artisan queue:restart
sudo supervisorctl status
```

## 5. Setup Windows / Laragon

Bagian ini sesuai untuk server Windows atau mesin staging yang menjalankan Laragon. Ganti lokasi `php.exe` dengan versi PHP Laragon di server.

### 5.1 Buat tugas Laravel Scheduler di Task Scheduler

1. Buka **Task Scheduler** → **Create Task**.
2. Tab **General**:
   - Name: `Sales Daily - Laravel Scheduler`
   - Pilih **Run whether user is logged on or not**.
   - Pilih **Run with highest privileges** bila diperlukan oleh policy server.
3. Tab **Triggers** → **New**:
   - Begin the task: `On a schedule`, Daily.
   - Repeat task every: `1 minute`.
   - For a duration of: `Indefinitely`.
   - Enabled: aktif.
4. Tab **Actions** → **New** → Start a program:
   - **Program/script**: `C:\laragon\bin\php\php-<versi>\php.exe`
   - **Add arguments**: `"D:\gps tracker\gps-tracker\artisan" schedule:run`
   - **Start in**: `D:\gps tracker\gps-tracker`
5. Tab **Settings**: aktifkan restart on failure, misalnya restart tiap 1 menit hingga 3 kali.
6. Simpan, lalu pilih task tersebut → **Run**. Pastikan History task tidak menampilkan error.

Task ini berjalan setiap menit, tetapi command sync koordinat hanya melakukan dispatch pada pukul 16.00 WIB sesuai konfigurasi Laravel.

### 5.2 Jalankan queue worker sebagai service

Queue worker adalah proses jangka panjang, sehingga jangan hanya menjalankannya di jendela terminal yang bisa tertutup. Pilihan yang disarankan di Windows adalah menjalankannya sebagai Windows Service menggunakan NSSM (Non-Sucking Service Manager), jika tersedia di server.

Contoh command instalasi service dari Command Prompt **Run as Administrator**:

```bat
nssm install SalesDailySapCoordinateWorker "C:\laragon\bin\php\php-<versi>\php.exe"
nssm set SalesDailySapCoordinateWorker AppParameters "D:\gps tracker\gps-tracker\artisan" queue:work database --queue=sap-coordinate-sync,default --sleep=3 --tries=3 --timeout=90
nssm set SalesDailySapCoordinateWorker AppDirectory "D:\gps tracker\gps-tracker"
nssm set SalesDailySapCoordinateWorker Start SERVICE_AUTO_START
nssm set SalesDailySapCoordinateWorker AppStdout "D:\gps tracker\gps-tracker\storage\logs\sap-coordinate-worker.log"
nssm set SalesDailySapCoordinateWorker AppStderr "D:\gps tracker\gps-tracker\storage\logs\sap-coordinate-worker-error.log"
nssm start SalesDailySapCoordinateWorker
```

Jika NSSM tidak tersedia, buat task kedua di Task Scheduler:

- Name: `Sales Daily - SAP Coordinate Worker`
- Trigger: `At startup`, dengan restart on failure.
- Program/script: path lengkap `php.exe`.
- Add arguments: `"D:\gps tracker\gps-tracker\artisan" queue:work database --queue=sap-coordinate-sync,default --sleep=3 --tries=3 --timeout=90 --max-time=3600`
- Start in: `D:\gps tracker\gps-tracker`.

Untuk alternatif Task Scheduler, jadwalkan restart worker setiap jam karena opsi `--max-time=3600` menghentikan worker setelah satu jam. Untuk production, Windows Service/NSSM lebih stabil.

## 6. Uji end-to-end pertama kali

Jalankan di environment staging terlebih dahulu.

1. Buat satu kunjungan valid di mobile: GPS akurat, di dalam radius toko, bukan fake GPS, bukan duplicate, lalu lakukan checkout.
2. Pastikan toko memiliki `external_bp_code` dan cabangnya memiliki `db_sap`.
3. Cari record baru yang berstatus `pending` pada tabel `sap_coordinate_syncs`.
4. Dispatch satu record secara manual:

   ```powershell
   php artisan sap:sync-customer-coordinates --limit=1
   ```

5. Untuk membuktikan worker tanpa menunggu service, proses satu job di terminal lain:

   ```powershell
   php artisan queue:work database --queue=sap-coordinate-sync --once --tries=3 --timeout=90
   ```

6. Periksa status record dan respons SAP. Jika hasil benar, biarkan scheduler dan worker production bekerja otomatis.

Contoh query pemeriksaan database:

```sql
SELECT status, COUNT(*) AS total
FROM sap_coordinate_syncs
GROUP BY status;

SELECT id, store_id, cardcode, status, sync_method, distance_meters,
       attempts, last_http_status, last_error, next_attempt_at, processed_at
FROM sap_coordinate_syncs
ORDER BY id DESC
LIMIT 20;

SELECT queue, COUNT(*) AS queued_jobs
FROM jobs
GROUP BY queue;
```

Jika tabel `failed_jobs` digunakan, periksa kegagalan worker:

```sql
SELECT id, queue, failed_at, exception
FROM failed_jobs
ORDER BY failed_at DESC
LIMIT 10;
```

## 7. Arti status sinkronisasi

| Status | Arti | Tindakan |
|---|---|---|
| `pending` | Menunggu di-dispatch scheduler. | Pastikan scheduler berjalan dan waktu `next_attempt_at` sudah lewat. |
| `processing` | Sedang diproses queue worker. | Jika terlalu lama, periksa worker dan log. |
| `synced` | Koordinat berhasil dibuat/diubah di SAP. | Tidak ada tindakan. |
| `no_change` | Titik SAP sudah cocok, selisih maksimal 50 m. | Tidak ada tindakan. |
| `verification_required` | Selisih koordinat besar atau bukti observasi belum cukup. | Verifikasi lokasi; lakukan minimal satu observasi valid tambahan yang saling berdekatan (≤30 m) bila selisih 50–100 m. Selisih >100 m memerlukan verifikasi admin. |
| `retry` | Request SAP gagal dan akan dicoba lagi setelah `next_attempt_at`. | Periksa koneksi, endpoint, token/API key, dan log. Jadwal saat ini akan dispatch ulang pada window scheduler berikutnya. |
| `skipped` | Toko/cabang tidak aktif saat job dijalankan. | Aktifkan master data bila memang harus disinkronkan, lalu buat/kelola ulang record sesuai prosedur. |

Logika pembandingannya:

- SAP belum mempunyai BP: aplikasi melakukan `POST`.
- BP ada tetapi titik kosong: aplikasi melakukan `PATCH`.
- Selisih ≤50 m: ditandai `no_change`.
- Selisih 50–100 m: `PATCH` hanya setelah ada dua observasi valid yang saling berjarak maksimal 30 m.
- Selisih >100 m: ditandai `verification_required`, tidak diubah otomatis.

## 8. Troubleshooting singkat

| Gejala | Pemeriksaan dan solusi |
|---|---|
| Tidak ada job yang masuk | Pastikan ada record `pending`/`retry`, `next_attempt_at` tidak di masa depan, dan Scheduler benar-benar berjalan. Uji `php artisan sap:sync-customer-coordinates --limit=1`. |
| Job ada di tabel `jobs` tetapi status tidak berubah | Queue worker mati atau tidak mendengarkan `sap-coordinate-sync`. Jalankan worker dengan `--queue=sap-coordinate-sync,default` lalu periksa log. |
| Status menjadi `retry` | Cek `last_error`, `last_http_status`, konfigurasi URL, jaringan server ke SAP, dan token/API key. Setelah diperbaiki, tunggu/trigger scheduler berikutnya. |
| Status `verification_required` | Ini perlindungan data, bukan error sistem. Validasi lokasi fisik dan kumpulkan observasi GPS tambahan yang memenuhi syarat. |
| SAP tidak menerima koordinat | Pastikan `db_sap` cabang dan `external_bp_code` toko benar, lalu verifikasi format endpoint GET dengan `SAP_BP_COORDINATE_GET_URL_TEMPLATE`. |
| Worker berhenti setelah deploy | Jalankan `php artisan queue:restart`; Supervisor/NSSM harus menjalankan ulang worker. |

## 9. Checklist operasi

- [ ] Migrasi `customer_coordinate_observations` dan `sap_coordinate_syncs` sudah diterapkan.
- [ ] `.env` API SAP dan queue sudah benar; secret tidak bocor ke repository/log.
- [ ] Laravel Scheduler aktif setiap menit.
- [ ] Queue worker aktif dan mendengar `sap-coordinate-sync`.
- [ ] `php artisan schedule:list` menampilkan `sync-sap-customer-coordinates` pukul 16.00 WIB.
- [ ] Pengujian manual `--limit=1` berhasil di staging.
- [ ] Status, log aplikasi, log worker, serta failed jobs dipantau setelah rilis.
