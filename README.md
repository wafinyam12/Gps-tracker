# GPS Tracker App

## Ringkasan Mobile Apps

Aplikasi **GPS Tracker** adalah solusi mobile yang dirancang untuk memantau dan mencatat lokasi perangkat secara real-time. Aplikasi ini sangat berguna untuk berbagai skenario, seperti pelacakan armada kendaraan, pemantauan aset, keamanan pribadi, atau bahkan untuk mencatat jejak perjalanan. Dengan antarmuka yang intuitif, pengguna dapat dengan mudah melihat posisi terkini dari perangkat yang dipantau, melihat riwayat perjalanan, dan menerima notifikasi penting.

### Kegunaan Utama:
- **Pelacakan Real-time:** Menampilkan lokasi perangkat yang dipantau di peta secara instan.
- **Riwayat Perjalanan:** Menyimpan dan menampilkan rute perjalanan sebelumnya dengan detail waktu dan lokasi.
- **Geofencing:** Fitur yang memungkinkan pembuatan zona geografis virtual. Pengguna akan menerima notifikasi saat perangkat masuk atau keluar dari zona tersebut.
- **Manajemen Perangkat:** Menambahkan, mengelola, dan mengonfigurasi beberapa perangkat yang akan dipantau.
- **Notifikasi:** Peringatan otomatis untuk peristiwa tertentu, seperti perangkat keluar jalur, baterai rendah, atau kecepatan berlebih.

## Tech Stack

Proyek ini dikembangkan menggunakan kombinasi teknologi modern untuk backend, database, dan, asumsi, frontend mobile.

### Backend:
- **PHP 8.x:** Bahasa pemrograman utama.
- **Laravel 10.x:** Framework PHP yang powerful dan elegan untuk membangun API RESTful.
- **Laravel Sanctum:** Untuk otentikasi API yang ringan dan token-based.

### Database:
- **MySQL 8.x (atau PostgreSQL/SQLite):** Sistem manajemen database relasional untuk menyimpan data lokasi, informasi pengguna, dan konfigurasi perangkat.

### Frontend (asumsi untuk aplikasi mobile, bisa diganti sesuai implementasi aktual):
- **React Native (atau Flutter/Native Android/iOS):** Framework untuk membangun aplikasi mobile cross-platform (jika ini adalah aplikasi mobile hybrid).

## Instalasi Proyek (Backend & Database)

Ikuti langkah-langkah di bawah ini untuk menginstal dan menjalankan proyek backend secara lokal.

### Prasyarat:
Pastikan Anda memiliki perangkat lunak berikut terinstal di sistem Anda:
- PHP >= 8.1
- Composer
- Node.js & npm (atau Yarn) - jika ada dependensi frontend di dalam proyek Laravel
- MySQL Server (atau PostgreSQL/SQLite)
- Git

### Langkah-langkah Instalasi:

1.  **Kloning Repositori:**
    Buka terminal atau command prompt Anda dan kloning repositori proyek:
    ```bash
    git clone <URL_REPOSITORI_ANDA>
    cd gps-tracker
    ```
    *(Ganti `<URL_REPOSITORI_ANDA>` dengan URL repositori Git Anda)*

2.  **Instal Dependensi PHP:**
    Gunakan Composer untuk menginstal semua dependensi PHP yang dibutuhkan oleh Laravel:
    ```bash
    composer install
    ```

3.  **Konfigurasi Environment:**
    Salin file `.env.example` untuk membuat file konfigurasi `.env`. File ini akan berisi pengaturan database, kunci aplikasi, dan konfigurasi lainnya.
    ```bash
    cp .env.example .env
    ```

4.  **Atur Kunci Aplikasi:**
    Generate kunci aplikasi Laravel yang unik. Ini penting untuk keamanan sesi dan enkripsi.
    ```bash
    php artisan key:generate
    ```

5.  **Konfigurasi Database:**
    Buka file `.env` yang baru saja Anda buat dan sesuaikan detail koneksi database Anda. Contoh untuk MySQL:
    ```dotenv
    DB_CONNECTION=mysql
    DB_HOST=127.0.0.1
    DB_PORT=3306
    DB_DATABASE=nama_database_anda
    DB_USERNAME=user_database_anda
    DB_PASSWORD=password_database_anda
    ```
    *(Ganti `nama_database_anda`, `user_database_anda`, dan `password_database_anda` dengan kredensial database Anda. Pastikan database dengan nama yang sesuai sudah dibuat di server MySQL Anda.)*

    Jika backend memakai integrasi SAP outstanding receivable, pastikan variabel berikut juga tersedia di `.env`:
    ```dotenv
    SAP_OUTSTANDING_RECEIVABLE_BASE_URL=https://ite-sap.utomodeck.com/sap/api/v1/cs-outstanding-receivable
    SAP_OUTSTANDING_RECEIVABLE_TIMEOUT=15
    SAP_OUTSTANDING_RECEIVABLE_CACHE_MINUTES=10
    ```
    Jika endpoint SAP di environment produksi berbeda, cukup ubah variabel ini tanpa perlu mengubah kode.
    Setelah mengubah `.env` di server produksi, jalankan `php artisan optimize:clear` atau minimal `php artisan config:clear` supaya nilai baru terbaca.

6.  **Jalankan Migrasi Database:**
    Jalankan migrasi untuk membuat tabel database yang diperlukan oleh aplikasi:
    ```bash
    php artisan migrate
    ```

7.  **Seed Database (Opsional):**
    Jika Anda memiliki data dummy atau data awal yang ingin dimasukkan ke database, jalankan seeder:
    ```bash
    php artisan db:seed
    ```

8.  **Instal Dependensi Frontend (jika ada):**
    Jika proyek Laravel Anda menyertakan aset frontend yang dikelola oleh npm atau Yarn (misalnya, untuk Vue.js atau React yang di-bundle), instal dependensinya:
    ```bash
    npm install # atau yarn install
    ```

9. **Kompilasi Aset Frontend (jika ada):**
    Setelah menginstal dependensi frontend, kompilasi aset-aset tersebut:
    ```bash
    npm run dev # Untuk pengembangan
    # atau
    npm run build # Untuk produksi
    ```

10. **Jalankan Server Pengembangan (Backend):**
    Mulai server pengembangan Laravel:
    ```bash
    php artisan serve
    ```
    Aplikasi backend Anda sekarang harus berjalan di `http://127.0.0.1:8000`.

## Instalasi & Penggunaan Aplikasi Mobile (Contoh dengan React Native)

*(Bagian ini bersifat opsional dan perlu disesuaikan jika aplikasi mobile Anda menggunakan teknologi selain React Native atau jika aplikasi mobile berada di repositori terpisah)*

1.  **Navigasi ke Direktori Aplikasi Mobile:**
    ```bash
    cd path/ke/direktori/mobile-app # Sesuaikan dengan lokasi aplikasi mobile Anda
    ```

2.  **Instal Dependensi Node.js:**
    ```bash
    npm install # atau yarn install
    ```

3.  **Konfigurasi API Endpoint:**
    Buka file konfigurasi di aplikasi mobile (misalnya, `config.js` atau sejenisnya) dan atur URL base API ke endpoint backend Anda (misalnya, `http://127.0.0.1:8000/api`).

4.  **Jalankan Aplikasi Mobile:**
    ```bash
    npx react-native run-android # Untuk Android
    # atau
    npx react-native run-ios # Untuk iOS (membutuhkan macOS dan Xcode)
    ```

## API Endpoints (Penting)

Berikut adalah beberapa contoh endpoint API yang mungkin tersedia di backend:

-   `POST /api/register` - Registrasi pengguna baru
-   `POST /api/login` - Otentikasi pengguna
-   `POST /api/logout` - Logout pengguna
-   `POST /api/locations` - Mengirim data lokasi dari perangkat
-   `GET /api/locations/{device_id}` - Mendapatkan riwayat lokasi untuk perangkat tertentu
-   `GET /api/devices` - Mendapatkan daftar perangkat yang dikelola pengguna
-   `POST /api/devices` - Menambahkan perangkat baru

*(Detail lengkap tentang endpoint API dapat ditemukan di dokumentasi API proyek.)*

## Fitur Utama

-   Manajemen pengguna (registrasi, login, logout)
-   Pencatatan dan penyimpanan data lokasi GPS.
-   Visualisasi data lokasi di peta.
-   Riwayat perjalanan.
-   Pengaturan geofencing.
-   Sistem notifikasi.

## Kontribusi

Kami menyambut kontribusi! Jika Anda ingin berkontribusi, silakan ikuti langkah-langkah berikut:
1.  Fork repositori ini.
2.  Buat branch fitur baru (`git checkout -b feature/nama-fitur`).
3.  Lakukan perubahan Anda dan commit (`git commit -m 'Tambahkan fitur baru'`).
4.  Push ke branch Anda (`git push origin feature/nama-fitur`).
5.  Buka Pull Request.

## Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT. Lihat file [LICENSE.md](LICENSE.md) untuk detail lebih lanjut.
