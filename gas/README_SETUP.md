# 🚀 Panduan Setup Database Google Drive (Google Apps Script)

Ikuti langkah-langkah mudah berikut untuk mengaktifkan database berbasis Google Drive tanpa perlu Google Cloud Console:

---

### Langkah 1: Buat Spreadsheet di Google Drive
1. Buka [Google Drive](https://drive.google.com/) menggunakan akun Google Anda.
2. Klik tombol **+ Baru (+ New)** > pilih **Google Spreadsheet**.
3. Beri nama file spreadsheet tersebut: `RST Family Finance Database`.

---

### Langkah 2: Buka Google Apps Script
1. Di halaman spreadsheet tersebut, klik menu atas: **Extensions (Ekstensi)** > **Apps Script**.
2. Editor kode Google Apps Script akan terbuka di tab baru.
3. Hapus semua tulisan bawaan di dalam editor.

---

### Langkah 3: Tempel Kode `Code.gs`
1. Buka file [gas/Code.gs](file:///d:/App%20by%20AI/RST%20Family/gas/Code.gs) di proyek ini.
2. Salin seluruh kodenya, lalu tempel (*paste*) ke dalam editor Apps Script.
3. (Opsional) Di baris 26: Anda bisa mengganti `SECRET_KEY` atau membiarkan nilai bawaan:
   ```javascript
   var SECRET_KEY = "rst_family_secure_token_2026";
   ```
4. Klik tombol **Simpan (ikon Disket / Ctrl + S)**.

---

### Langkah 4: Jalankan Inisialisasi Otomatis (1 Klik)
1. Di bar navigasi atas editor Apps Script, cari menu dropdown fungsi (biasanya tertulis `myFunction` atau `doPost`).
2. Pilih fungsi **`setupDatabase`**.
3. Klik tombol **▶ Run (Jalankan)**.
4. Google akan meminta izin akses (*Authorization Required*):
   - Klik **Review Permissions** (Tinjau Izin).
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced (Lanjutan)** di kiri bawah > klik **Go to Untitled project (unsafe)**.
   - Klik **Allow (Izinkan)**.
5. Selesai! Script akan otomatis membuat 5 sheet dengan header rapi dan data akun bawaan (*Risman & Siti*).

---

### Langkah 5: Deploy sebagai Web App
1. Di pojok kanan atas editor Apps Script, klik tombol biru **Deploy (Terapkan)** > pilih **New deployment (Penerapan baru)**.
2. Klik ikon gerigi ⚙️ di sebelah kiri (*Select type*) > pilih **Web app**.
3. Isi kolom pengaturan:
   - **Description**: `RST Family DB Engine v1`
   - **Execute as**: **Me (email@gmail.com)**
   - **Who has access**: **Anyone (Siapa saja)** *(Wajib "Anyone" agar server Vercel/Node.js bisa mengakses database).*
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (bentuknya: `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Langkah 6: Sambungkan ke Aplikasi RST Family
1. Buka file `.env` di proyek ini (atau pengaturan *Environment Variables* di Vercel jika dideploy ke Vercel).
2. Tambahkan / perbarui variabel berikut:
   ```env
   GAS_WEB_APP_URL=https://script.google.com/macros/s/AKfycb.../exec
   GAS_SECRET_KEY=rst_family_secure_token_2026
   ```
3. Restart server aplikasi:
   ```bash
   npm run dev
   ```
4. Buka menu **Pengaturan** di aplikasi. Database Anda sekarang 100% tersambung ke Google Drive! 🎉
