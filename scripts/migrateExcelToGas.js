/**
 * Skrip Migrasi Otomatis: Data Excel Lokal -> Google Spreadsheet (Google Apps Script)
 * 
 * Penggunaan:
 * Pastikan GAS_WEB_APP_URL sudah diisi di .env
 * Jalankan: node scripts/migrateExcelToGas.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { isGasConfigured, ping, batchImport } = require('../src/services/gasDatabaseService');

async function runMigration() {
  console.log('\n=============================================================');
  console.log('🚀 RST Family Finance - Migrasi Data ke Google Drive (GAS)');
  console.log('=============================================================\n');

  if (!isGasConfigured()) {
    console.error('❌ ERROR: GAS_WEB_APP_URL belum diatur di file .env');
    console.log('Silakan deploy Google Apps Script terlebih dahulu dan masukkan URL-nya ke .env');
    process.exit(1);
  }

  console.log('1. Menguji koneksi ke Google Apps Script...');
  try {
    const pingRes = await ping();
    console.log('   ✅ Terhubung ke Spreadsheet:', pingRes.spreadsheetName);
    console.log('   🔗 URL:', pingRes.spreadsheetUrl);
  } catch (err) {
    console.error('   ❌ Gagal menghubungi Google Apps Script:', err.message);
    process.exit(1);
  }

  const excelPath = path.join(__dirname, '../data/keuangan_keluarga.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.log('ℹ️ File data/keuangan_keluarga.xlsx tidak ditemukan. Migrasi data lama dilewati.');
    process.exit(0);
  }

  console.log('\n2. Membaca data dari Excel lokal:', excelPath);
  const wb = XLSX.readFile(excelPath, { cellDates: false });

  // Baca Kategori
  const wsCat = wb.Sheets['Kategori'];
  const categories = wsCat ? XLSX.utils.sheet_to_json(wsCat) : [];
  console.log(`   - Kategori: ${categories.length} data`);

  // Baca Users
  const wsUsers = wb.Sheets['Users'];
  const users = wsUsers ? XLSX.utils.sheet_to_json(wsUsers) : [];
  console.log(`   - Users: ${users.length} akun`);

  // Baca Transaksi
  const wsTrx = wb.Sheets['Transaksi'];
  const transactions = wsTrx ? XLSX.utils.sheet_to_json(wsTrx) : [];
  console.log(`   - Transaksi: ${transactions.length} baris`);

  // Baca Settings
  const wsSet = wb.Sheets['Settings'];
  const settingsRows = wsSet ? XLSX.utils.sheet_to_json(wsSet) : [];
  const settings = {};
  settingsRows.forEach(r => {
    if (r.Key) settings[r.Key] = r.Value;
  });
  console.log(`   - Pengaturan: ${Object.keys(settings).length} konfigurasi`);

  console.log('\n3. Mengirim seluruh data ke Google Spreadsheet...');
  try {
    const importRes = await batchImport({
      categories,
      users,
      transactions,
      settings
    });

    console.log('\n🎉 MIGRASI SUKSES!');
    console.log(`   ✅ Kategori tersimpan: ${importRes.categories}`);
    console.log(`   ✅ Pengguna tersimpan: ${importRes.users}`);
    console.log(`   ✅ Transaksi tersimpan: ${importRes.transactions}`);
    console.log(`   ✅ Pengaturan tersimpan: ${importRes.settings}`);
    console.log('\nDatabase Anda di Google Drive sudah siap digunakan sepenuhnya.');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\n❌ Gagal mengirim data migrasi:', err.message);
    process.exit(1);
  }
}

runMigration();
