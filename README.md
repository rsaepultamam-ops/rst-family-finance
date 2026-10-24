# 💰 RST Family Finance — Pencatatan Keuangan Keluarga

Aplikasi web **multi-user** modern untuk pencatatan keuangan keluarga sehari-hari dengan **basis data file Excel (`.xlsx`)**, sinkronisasi cloud Google Drive, laporan bulanan visual interaktif, dan notifikasi pengingat otomatis.

---

## ✨ Fitur Utama

1. **📊 Dashboard Modern (Light Theme)**
   - Ringkasan Saldo Bulan Ini, Total Pemasukan, Total Pengeluaran, dan Pengeluaran Hari Ini.
   - Perbandingan pengeluaran vs bulan lalu (indikator persentase kenaikan/penurunan).
   - Daftar transaksi terkini dengan info pencatat (anggota keluarga).
   - Tombol catat kilat pengeluaran & pemasukan.

2. **📝 Pencatatan & Riwayat Transaksi (CRUD)**
   - Input pengeluaran & pemasukan dengan tanggal, kategori, nominal, dan keterangan.
   - Pilihan nominal cepat (10rb, 25rb, 50rb, 100rb, 500rb, 1jt).
   - Filter lengkap: pencarian teks, filter tipe, filter kategori, filter anggota keluarga, dan rentang tanggal.
   - Edit dan hapus transaksi langsung terupdate ke file Excel.

3. **📈 Laporan Keuangan Bulanan & Visualisasi**
   - Navigasi bulan & tahun mudah (bulan lalu / bulan berikutnya).
   - Rata-rata pengeluaran per hari dan hari pengeluaran tertinggi.
   - **Donut Chart**: Proporsi pengeluaran per kategori.
   - **Bar Chart**: Perbandingan nominal pengeluaran terbesar.
   - **Line Chart**: Tren pengeluaran & pemasukan harian sepanjang bulan.
   - Tabel detail breakdown kategori dengan persentase dan bar visual.

4. **🏷️ Kelola Kategori Custom**
   - Kategori bawaan lengkap (12 pengeluaran + 5 pemasukan).
   - Tambah kategori custom dengan emoji picker dan swatch warna yang menarik.
   - Nonaktifkan/aktifkan kembali kategori.

5. **👥 Multi-User & Manajemen Anggota Keluarga**
   - Multi-user dengan pembagian peran: **Kepala Keluarga (Admin)** dan **Anggota**.
   - Admin dapat menambahkan akun anggota keluarga baru, mengatur role, dan mereset password.
   - Anggota keluarga dapat login dari HP masing-masing dan mencatat transaksi secara bersamaan.

6. **📁 Basis Data Excel & Cloud Sync**
   - Semua data (Transaksi, Kategori, Users, Log Notifikasi, dan Settings) disimpan rapi di `data/keuangan_keluarga.xlsx`.
   - Tombol download langsung file `.xlsx` kapan saja untuk backup atau analisa di Excel.
   - Arsitektur sinkronisasi Google Drive untuk menjaga data selalu sama di semua perangkat.

7. **🔔 Notifikasi & Pengingat Otomatis**
   - Pengingat harian otomatis pada jam tertentu (default: 20:00 WIB).
   - Dukungan saluran Email (Gmail SMTP) dan Bot Telegram.
   - Tombol uji coba pengiriman notifikasi langsung dari menu pengaturan.

8. **📱 Desain Responsif & Estetis**
   - Tampilan bersih modern dengan latar dominan terang (*clean light theme*).
   - Penggunaan font modern Google Fonts (*Plus Jakarta Sans* & *Inter*).
   - Di smartphone: dilengkapi *Bottom Navigation Bar* dan *Floating Action Button (FAB)*.
   - Di laptop/desktop: dilengkapi sidebar navigasi yang elegan.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js (versi 18 ke atas)
- npm

### 2. Jalankan Server
Buka terminal di folder proyek dan jalankan:

```bash
npm start
```
Atau untuk mode development dengan auto-reload:
```bash
npm run dev
```

### 3. Buka Aplikasi di Browser
Buka browser dan akses:
```
http://localhost:3000
```

---

## 🔑 Kredensial Login Bawaan

Saat pertama kali dijalankan, sistem otomatis membuat file Excel dengan 2 akun bawaan:

| Peran | Nama | Username | Password |
|---|---|---|---|
| **Kepala Keluarga (Admin)** | Risman (Kepala Keluarga) | `risman` (atau `admin`) | `admin123` / `risman123` |
| **Anggota Keluarga** | Siti Julaeha (Anggota Keluarga) | `sitijulaeha` (atau `siti`) | `siti123` |

*Di halaman login tersedia tombol cepat untuk mengisi akun otomatis.*

---

## 📂 Struktur Proyek

```
RST Family/
├── data/
│   └── keuangan_keluarga.xlsx   # File database utama Excel
├── public/                      # Frontend SPA (HTML, CSS, JS)
│   ├── css/style.css            # Desain responsif modern light theme
│   ├── js/                      # Modul frontend modular
│   │   ├── api.js               # Client fetch & JWT
│   │   ├── dashboard.js         # Logika dashboard KPI
│   │   ├── transactions.js      # Riwayat & filter transaksi
│   │   ├── reports.js           # Laporan bulanan & Chart.js
│   │   ├── categories.js        # Kategori custom & emoji picker
│   │   ├── users.js             # Manajemen anggota keluarga
│   │   ├── settings.js          # Pengaturan cloud & notifikasi
│   │   └── app.js               # Router utama SPA
│   ├── index.html               # Halaman utama aplikasi
│   └── login.html               # Halaman login
├── src/
│   ├── middleware/              # Auth JWT & Role Check
│   ├── routes/                  # REST API Express
│   ├── services/                # Excel SheetJS, Google Drive, Notifikasi
│   └── utils/                   # Hashing & formatting helpers
├── server.js                    # Server Express utama
├── package.json
└── README.md
```
