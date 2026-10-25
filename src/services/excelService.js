const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { hashPassword } = require('../utils/hashPassword');
const {
  generateTransactionId,
  generateUserId,
  generateCategoryId,
  generateLogId
} = require('../utils/generateId');
const gasDb = require('./gasDatabaseService');

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '../../data');
const EXCEL_PATH = process.env.EXCEL_FILE_PATH || path.join(DATA_DIR, 'keuangan_keluarga.xlsx');

// In-memory write queue to avoid race conditions during Excel file writes
let writeLock = Promise.resolve();

function withWriteLock(fn) {
  const result = writeLock.then(fn);
  writeLock = result.catch(() => {});
  return result;
}

// Ensure directory exists
const targetDir = path.dirname(EXCEL_PATH);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Default Categories definition
const DEFAULT_CATEGORIES = [
  // Pengeluaran
  { id: 'CAT-001', nama: 'Makanan & Minuman', tipe: 'Pengeluaran', ikon: '🍚', warna: '#FF6B6B', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-002', nama: 'Transportasi', tipe: 'Pengeluaran', ikon: '🚗', warna: '#4ECDC4', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-003', nama: 'Rumah Tangga', tipe: 'Pengeluaran', ikon: '🏠', warna: '#45B7D1', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-004', nama: 'Listrik & Air', tipe: 'Pengeluaran', ikon: '💡', warna: '#FFA726', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-005', nama: 'Pulsa & Internet', tipe: 'Pengeluaran', ikon: '📱', warna: '#AB47BC', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-006', nama: 'Kesehatan', tipe: 'Pengeluaran', ikon: '🏥', warna: '#EF5350', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-007', nama: 'Pendidikan', tipe: 'Pengeluaran', ikon: '🎓', warna: '#5C6BC0', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-008', nama: 'Pakaian', tipe: 'Pengeluaran', ikon: '👕', warna: '#EC407A', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-009', nama: 'Hiburan', tipe: 'Pengeluaran', ikon: '🎉', warna: '#FFA000', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-010', nama: 'Sosial & Sumbangan', tipe: 'Pengeluaran', ikon: '🤝', warna: '#66BB6A', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-011', nama: 'Tabungan & Investasi', tipe: 'Pengeluaran', ikon: '💰', warna: '#26A69A', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-012', nama: 'Lain-lain', tipe: 'Pengeluaran', ikon: '📦', warna: '#78909C', aktif: true, custom: false, dibuatOleh: 'system' },
  // Pemasukan
  { id: 'CAT-101', nama: 'Gaji', tipe: 'Pemasukan', ikon: '💼', warna: '#10B981', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-102', nama: 'Bonus', tipe: 'Pemasukan', ikon: '💵', warna: '#059669', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-103', nama: 'Usaha', tipe: 'Pemasukan', ikon: '🏪', warna: '#0D9488', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-104', nama: 'Hadiah/Transfer', tipe: 'Pemasukan', ikon: '🎁', warna: '#14B8A6', aktif: true, custom: false, dibuatOleh: 'system' },
  { id: 'CAT-105', nama: 'Lain-lain', tipe: 'Pemasukan', ikon: '📦', warna: '#6B7280', aktif: true, custom: false, dibuatOleh: 'system' }
];

let initPromise = null;

/**
 * Create default workbook synchronously so that readWorkbook never fails
 */
function createDefaultWorkbookSync() {
  if (fs.existsSync(EXCEL_PATH)) return;

  const adminPasswordHash = '$2a$10$GZNoRJFZnmBWLWvJY2ZuK./hZIVJ4V0.pw/jc/dsGkWJO8K7NxCHm'; // admin123
  const sitiPasswordHash = '$2a$10$rsPoQxkpVD7e1fYROtqRK.mFSsae7uJta5JNfvUF8biWhx6mHh/mq'; // siti123

  const defaultUsers = [
    {
      ID: 'USR-001',
      Nama: 'Risman (Kepala Keluarga)',
      Username: 'risman',
      Password: adminPasswordHash,
      Role: 'admin',
      Email: 'risman@keluarga.rst',
      'Telegram Chat ID': '',
      Aktif: true,
      Dibuat: new Date().toISOString()
    },
    {
      ID: 'USR-002',
      Nama: 'Siti Julaeha (Anggota Keluarga)',
      Username: 'sitijulaeha',
      Password: sitiPasswordHash,
      Role: 'anggota',
      Email: 'siti@keluarga.rst',
      'Telegram Chat ID': '',
      Aktif: true,
      Dibuat: new Date().toISOString()
    }
  ];

  const categoriesData = DEFAULT_CATEGORIES.map(c => ({
    ID: c.id,
    Nama: c.nama,
    Tipe: c.tipe,
    Ikon: c.ikon,
    Warna: c.warna,
    Aktif: c.aktif,
    Custom: c.custom,
    'Dibuat Oleh': c.dibuatOleh
  }));

  const emptyTransactions = [];

  const defaultSettings = [
    { Key: 'cloud_sync_enabled', Value: 'false', Diubah: new Date().toISOString() },
    { Key: 'last_sync_timestamp', Value: '', Diubah: new Date().toISOString() },
    { Key: 'sync_status', Value: 'local_ready', Diubah: new Date().toISOString() },
    { Key: 'notif_daily_enabled', Value: 'true', Diubah: new Date().toISOString() },
    { Key: 'notif_daily_time', Value: '20:00', Diubah: new Date().toISOString() },
    { Key: 'notif_channel', Value: 'both', Diubah: new Date().toISOString() },
    { Key: 'telegram_bot_token', Value: '', Diubah: new Date().toISOString() }
  ];

  const emptyLogs = [];

  const wb = XLSX.utils.book_new();

  const wsTransaksi = XLSX.utils.json_to_sheet(emptyTransactions, {
    header: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan', 'User', 'Dibuat', 'Diubah']
  });
  const wsKategori = XLSX.utils.json_to_sheet(categoriesData);
  const wsUsers = XLSX.utils.json_to_sheet(defaultUsers);
  const wsNotif = XLSX.utils.json_to_sheet(emptyLogs, {
    header: ['ID', 'Tipe', 'Channel', 'Penerima', 'Status', 'Waktu Kirim']
  });
  const wsSettings = XLSX.utils.json_to_sheet(defaultSettings);

  XLSX.utils.book_append_sheet(wb, wsTransaksi, 'Transaksi');
  XLSX.utils.book_append_sheet(wb, wsKategori, 'Kategori');
  XLSX.utils.book_append_sheet(wb, wsUsers, 'Users');
  XLSX.utils.book_append_sheet(wb, wsNotif, 'Notifikasi_Log');
  XLSX.utils.book_append_sheet(wb, wsSettings, 'Settings');

  XLSX.writeFile(wb, EXCEL_PATH);
}

function migrateDefaultUsers(wb) {
  let changed = false;

  const wsUsers = wb.Sheets['Users'];
  if (wsUsers) {
    let users = XLSX.utils.sheet_to_json(wsUsers) || [];
    users = users.map(u => {
      if (u.ID === 'USR-001' && (String(u.Nama).includes('Budi') || String(u.Username).toLowerCase() === 'admin')) {
        u.Nama = 'Risman (Kepala Keluarga)';
        u.Username = 'risman';
        u.Email = 'risman@keluarga.rst';
        changed = true;
      }
      if (u.ID === 'USR-002' && (String(u.Nama).includes('Rahayu') || String(u.Username).toLowerCase() === 'siti')) {
        u.Nama = 'Siti Julaeha (Anggota Keluarga)';
        u.Username = 'sitijulaeha';
        u.Email = 'siti@keluarga.rst';
        changed = true;
      }
      return u;
    });

    if (changed) {
      wb.Sheets['Users'] = XLSX.utils.json_to_sheet(users);
    }
  }

  const wsTrx = wb.Sheets['Transaksi'];
  if (wsTrx) {
    let trxList = XLSX.utils.sheet_to_json(wsTrx) || [];
    let trxChanged = false;
    trxList = trxList.map(t => {
      if (t.User && String(t.User).includes('Budi')) {
        t.User = 'Risman (Kepala Keluarga)';
        trxChanged = true;
      }
      if (t.User && String(t.User).includes('Rahayu')) {
        t.User = 'Siti Julaeha (Anggota Keluarga)';
        trxChanged = true;
      }
      return t;
    });
    if (trxChanged) {
      wb.Sheets['Transaksi'] = XLSX.utils.json_to_sheet(trxList);
      changed = true;
    }
  }

  return changed;
}

/**
 * Initialize default Excel file if it does not exist or sync from Google Drive
 */
async function initExcel() {
  if (gasDb.isGasConfigured()) {
    return;
  }

  // If local file exists, it is ready immediately without blocking on network
  if (fs.existsSync(EXCEL_PATH)) {
    return;
  }

  const { hasSyncedInInstance, downloadFromDrive } = require('./googleDriveService');

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Check if we can sync from Google Drive
      if (!hasSyncedInInstance()) {
        try {
          const downloaded = await downloadFromDrive();
          if (downloaded) {
            // Check migration on downloaded file
            try {
              const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
              if (migrateDefaultUsers(wb)) {
                await writeWorkbook(wb, true);
              }
            } catch (err) {}
            return;
          }
        } catch (e) {
          console.warn('[INIT] Tidak dapat mengunduh dari Drive saat ini:', e.message);
        }
      }

      // If file already exists (from earlier or default), check migration and return
      if (fs.existsSync(EXCEL_PATH)) {
        try {
          const wb = XLSX.readFile(EXCEL_PATH, { cellDates: false });
          if (migrateDefaultUsers(wb)) {
            await writeWorkbook(wb, true);
          }
        } catch (err) {}
        return;
      }

      // Otherwise create initial default workbook
      createDefaultWorkbookSync();
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Read all data from workbook
 */
function readWorkbook() {
  if (!fs.existsSync(EXCEL_PATH)) {
    createDefaultWorkbookSync();
  }
  return XLSX.readFile(EXCEL_PATH, { cellDates: false });
}

let isSyncingToDrive = false;

/**
 * Write workbook to disk safely and auto sync to Google Drive (Awaited for serverless compatibility)
 */
async function writeWorkbook(wb, syncToDrive = true) {
  XLSX.writeFile(wb, EXCEL_PATH);

  // Auto upload to Google Drive if credentials exist
  if (syncToDrive) {
    try {
      const { uploadToDrive } = require('./googleDriveService');
      await uploadToDrive();
    } catch (err) {
      console.error('[DRIVE AUTO-SYNC ERROR]', err.message);
    }
  }
}

// ============================================
// TRANSAKSI SERVICES
// ============================================

async function getTransactions(filters = {}) {
  let list = [];
  if (gasDb.isGasConfigured()) {
    list = await gasDb.getAllTransactionsCached();
  } else {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Transaksi'];
    if (!ws) return [];
    list = XLSX.utils.sheet_to_json(ws) || [];
  }

  // Filter by search (keterangan)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(t => (t.Keterangan || '').toLowerCase().includes(q) || (t.Kategori || '').toLowerCase().includes(q));
  }

  // Filter by tipe
  if (filters.tipe && filters.tipe !== 'Semua') {
    list = list.filter(t => t.Tipe === filters.tipe);
  }

  // Filter by category
  if (filters.kategori && filters.kategori !== 'Semua') {
    list = list.filter(t => t.Kategori === filters.kategori);
  }

  // Filter by user
  if (filters.user && filters.user !== 'Semua') {
    list = list.filter(t => t.User === filters.user);
  }

  // Filter by date range (dari - sampai)
  if (filters.startDate) {
    list = list.filter(t => t.Tanggal >= filters.startDate);
  }
  if (filters.endDate) {
    list = list.filter(t => t.Tanggal <= filters.endDate);
  }

  // Filter by month & year
  if (filters.month && filters.year) {
    const mStr = String(filters.month).padStart(2, '0');
    const prefix = `${filters.year}-${mStr}`;
    list = list.filter(t => (t.Tanggal || '').startsWith(prefix));
  }

  // Sort: default newest first
  list.sort((a, b) => {
    const dDiff = new Date(b.Tanggal) - new Date(a.Tanggal);
    if (dDiff !== 0) return dDiff;
    return (b.Dibuat || '').localeCompare(a.Dibuat || '');
  });

  return list;
}

async function getTransactionById(id) {
  if (gasDb.isGasConfigured()) {
    return gasDb.getTransactionById(id);
  }

  const transactions = await getTransactions();
  return transactions.find(t => t.ID === id) || null;
}

async function addTransaction(data) {
  if (gasDb.isGasConfigured()) {
    return gasDb.addTransaction(data);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Transaksi'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const newTrx = {
      ID: generateTransactionId(data.tanggal),
      Tanggal: data.tanggal,
      Tipe: data.tipe,
      Kategori: data.kategori,
      Jumlah: Number(data.jumlah) || 0,
      Keterangan: data.keterangan || '',
      User: data.user,
      Dibuat: new Date().toISOString(),
      Diubah: new Date().toISOString()
    };

    list.push(newTrx);
    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Transaksi'] = newWs;
    await writeWorkbook(wb);
    return newTrx;
  });
}

async function updateTransaction(id, updateData) {
  if (gasDb.isGasConfigured()) {
    return gasDb.updateTransaction(id, updateData);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Transaksi'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(t => t.ID === id);
    if (index === -1) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    list[index] = {
      ...list[index],
      Tanggal: updateData.tanggal !== undefined ? updateData.tanggal : list[index].Tanggal,
      Tipe: updateData.tipe !== undefined ? updateData.tipe : list[index].Tipe,
      Kategori: updateData.kategori !== undefined ? updateData.kategori : list[index].Kategori,
      Jumlah: updateData.jumlah !== undefined ? Number(updateData.jumlah) : list[index].Jumlah,
      Keterangan: updateData.keterangan !== undefined ? updateData.keterangan : list[index].Keterangan,
      Diubah: new Date().toISOString()
    };

    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Transaksi'] = newWs;
    await writeWorkbook(wb);
    return list[index];
  });
}

async function deleteTransaction(id) {
  if (gasDb.isGasConfigured()) {
    return gasDb.deleteTransaction(id);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Transaksi'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(t => t.ID === id);
    if (index === -1) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    const [deleted] = list.splice(index, 1);
    const newWs = XLSX.utils.json_to_sheet(list, {
      header: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan', 'User', 'Dibuat', 'Diubah']
    });
    wb.Sheets['Transaksi'] = newWs;
    await writeWorkbook(wb);
    return deleted;
  });
}

/**
 * Clear all transaction records
 */
async function clearAllTransactions() {
  if (gasDb.isGasConfigured()) {
    return gasDb.clearAllTransactions();
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const emptyTransactions = [];
    wb.Sheets['Transaksi'] = XLSX.utils.json_to_sheet(emptyTransactions, {
      header: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan', 'User', 'Dibuat', 'Diubah']
    });
    await writeWorkbook(wb, true);
    return { success: true };
  });
}

// ============================================
// KATEGORI SERVICES
// ============================================

async function getCategories(includeInactive = false) {
  if (gasDb.isGasConfigured()) {
    try {
      let list = await gasDb.getCategories(includeInactive);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }

      // Jika kategori di Google Spreadsheet masih kosong, otomatis seed 17 kategori bawaan
      console.log('[CATEGORIES] Sheet kategori di Google Apps Script masih kosong. Otomatis seeding default categories...');
      const defaultCategoriesFormatted = DEFAULT_CATEGORIES.map(c => ({
        ID: c.id,
        Nama: c.nama,
        Tipe: c.tipe,
        Ikon: c.ikon,
        Warna: c.warna,
        Aktif: c.aktif,
        Custom: c.custom,
        'Dibuat Oleh': c.dibuatOleh
      }));

      // Kirim batchImport ke GAS agar tersimpan permanen di Google Spreadsheet
      try {
        await gasDb.batchImport({ categories: defaultCategoriesFormatted });
        const refreshed = await gasDb.getCategories(includeInactive);
        if (Array.isArray(refreshed) && refreshed.length > 0) {
          return refreshed;
        }
      } catch (importErr) {
        console.warn('[CATEGORIES] Gagal auto-seed ke Google Apps Script:', importErr.message);
      }

      // Fallback agar frontend tidak pernah kosong
      return defaultCategoriesFormatted.filter(c => includeInactive || c.Aktif);
    } catch (err) {
      console.warn('[CATEGORIES] Gagal mengambil dari Google Apps Script, menggunakan fallback default:', err.message);
      return DEFAULT_CATEGORIES.map(c => ({
        ID: c.id,
        Nama: c.nama,
        Tipe: c.tipe,
        Ikon: c.ikon,
        Warna: c.warna,
        Aktif: c.aktif,
        Custom: c.custom,
        'Dibuat Oleh': c.dibuatOleh
      })).filter(c => includeInactive || c.Aktif);
    }
  }

  await initExcel();
  const wb = readWorkbook();
  const ws = wb.Sheets['Kategori'];
  if (!ws) return [];

  let list = XLSX.utils.sheet_to_json(ws) || [];
  // normalize boolean values
  list = list.map(c => ({
    ...c,
    Aktif: c.Aktif === true || c.Aktif === 'true' || c.Aktif === 1,
    Custom: c.Custom === true || c.Custom === 'true' || c.Custom === 1
  }));

  if (!includeInactive) {
    list = list.filter(c => c.Aktif);
  }
  return list;
}

async function addCategory(data) {
  if (gasDb.isGasConfigured()) {
    return gasDb.addCategory(data);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Kategori'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    // Check duplicate name
    const exists = list.some(c => c.Nama.toLowerCase() === data.nama.trim().toLowerCase() && c.Tipe === data.tipe);
    if (exists) {
      throw new Error(`Kategori "${data.nama}" untuk ${data.tipe} sudah ada.`);
    }

    const nextId = generateCategoryId(list.length + 1);
    const newCategory = {
      ID: nextId,
      Nama: data.nama.trim(),
      Tipe: data.tipe,
      Ikon: data.ikon || '📁',
      Warna: data.warna || '#3B82F6',
      Aktif: true,
      Custom: true,
      'Dibuat Oleh': data.dibuatOleh || 'admin'
    };

    list.push(newCategory);
    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Kategori'] = newWs;
    await writeWorkbook(wb);
    return newCategory;
  });
}

async function updateCategory(id, data) {
  if (gasDb.isGasConfigured()) {
    return gasDb.updateCategory(id, data);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Kategori'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(c => c.ID === id);
    if (index === -1) {
      throw new Error('Kategori tidak ditemukan.');
    }

    list[index] = {
      ...list[index],
      Nama: data.nama !== undefined ? data.nama.trim() : list[index].Nama,
      Ikon: data.ikon !== undefined ? data.ikon : list[index].Ikon,
      Warna: data.warna !== undefined ? data.warna : list[index].Warna,
      Aktif: data.aktif !== undefined ? data.aktif : list[index].Aktif
    };

    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Kategori'] = newWs;
    await writeWorkbook(wb);
    return list[index];
  });
}

async function deleteCategory(id) {
  if (gasDb.isGasConfigured()) {
    return gasDb.deleteCategory(id);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Kategori'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(c => c.ID === id);
    if (index === -1) {
      throw new Error('Kategori tidak ditemukan.');
    }

    // Default categories can only be disabled, not removed
    if (!list[index].Custom) {
      list[index].Aktif = false;
    } else {
      // Soft delete: toggle inactive
      list[index].Aktif = false;
    }

    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Kategori'] = newWs;
    await writeWorkbook(wb);
    return list[index];
  });
}

// ============================================
// USERS SERVICES
// ============================================

async function getUsers() {
  if (gasDb.isGasConfigured()) {
    return gasDb.getUsers();
  }

  await initExcel();
  const wb = readWorkbook();
  const ws = wb.Sheets['Users'];
  if (!ws) return [];

  let list = XLSX.utils.sheet_to_json(ws) || [];
  return list.map(u => ({
    ...u,
    Aktif: u.Aktif === true || u.Aktif === 'true' || u.Aktif === 1
  }));
}

async function getUserByUsername(username) {
  if (gasDb.isGasConfigured()) {
    return gasDb.getUserByUsername(username);
  }

  const users = await getUsers();
  const q = (username || '').toLowerCase().trim();
  return users.find(u => {
    const uName = (u.Username || '').toLowerCase().trim();
    if (uName === q) return true;
    if (q === 'admin' && uName === 'risman') return true;
    if (q === 'risman' && uName === 'admin') return true;
    if (q === 'siti' && (uName === 'sitijulaeha' || uName === 'siti')) return true;
    if (q === 'sitijulaeha' && (uName === 'siti' || uName === 'sitijulaeha')) return true;
    return false;
  }) || null;
}

async function getUserById(id) {
  if (gasDb.isGasConfigured()) {
    return gasDb.getUserById(id);
  }

  const users = await getUsers();
  return users.find(u => u.ID === id) || null;
}

async function addUser(data) {
  if (gasDb.isGasConfigured()) {
    const hashedPassword = await hashPassword(data.password);
    return gasDb.addUser({
      ...data,
      password: hashedPassword
    });
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Users'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const existing = list.find(u => u.Username.toLowerCase() === data.username.toLowerCase());
    if (existing) {
      throw new Error(`Username "${data.username}" sudah digunakan.`);
    }

    const hashedPassword = await hashPassword(data.password);
    const newUserId = generateUserId(list.length + 1);

    const newUser = {
      ID: newUserId,
      Nama: data.nama,
      Username: data.username.toLowerCase().trim(),
      Password: hashedPassword,
      Role: data.role || 'anggota',
      Email: data.email || '',
      'Telegram Chat ID': data.telegramChatId || '',
      Aktif: true,
      Dibuat: new Date().toISOString()
    };

    list.push(newUser);
    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Users'] = newWs;
    await writeWorkbook(wb);

    const { Password, ...safeUser } = newUser;
    return safeUser;
  });
}

async function updateUser(id, updateData) {
  if (gasDb.isGasConfigured()) {
    const payload = { ...updateData };
    if (payload.password) {
      payload.password = await hashPassword(payload.password);
    }
    return gasDb.updateUser(id, payload);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Users'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(u => u.ID === id);
    if (index === -1) {
      throw new Error('User tidak ditemukan.');
    }

    if (updateData.password) {
      list[index].Password = await hashPassword(updateData.password);
    }
    if (updateData.nama !== undefined) list[index].Nama = updateData.nama;
    if (updateData.role !== undefined) list[index].Role = updateData.role;
    if (updateData.email !== undefined) list[index].Email = updateData.email;
    if (updateData.telegramChatId !== undefined) list[index]['Telegram Chat ID'] = updateData.telegramChatId;
    if (updateData.aktif !== undefined) list[index].Aktif = updateData.aktif;

    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Users'] = newWs;
    await writeWorkbook(wb);

    const { Password, ...safeUser } = list[index];
    return safeUser;
  });
}

async function deleteUser(id) {
  if (gasDb.isGasConfigured()) {
    return gasDb.deleteUser(id);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Users'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(u => u.ID === id);
    if (index === -1) {
      throw new Error('User tidak ditemukan.');
    }

    // Soft delete: set Aktif to false
    list[index].Aktif = false;

    const newWs = XLSX.utils.json_to_sheet(list);
    wb.Sheets['Users'] = newWs;
    await writeWorkbook(wb);
    return { success: true, message: 'User berhasil dinonaktifkan' };
  });
}

// ============================================
// SETTINGS & LOGS SERVICES
// ============================================

async function getSettings(autoInit = true) {
  if (gasDb.isGasConfigured()) {
    return gasDb.getSettings();
  }

  if (!fs.existsSync(EXCEL_PATH)) {
    if (autoInit && !initPromise) {
      await initExcel();
    } else {
      createDefaultWorkbookSync();
    }
  }
  if (!fs.existsSync(EXCEL_PATH)) return {};
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets['Settings'];
    if (!ws) return {};

    const list = XLSX.utils.sheet_to_json(ws) || [];
    const settingsObj = {};
    list.forEach(row => {
      settingsObj[row.Key] = row.Value;
    });
    return settingsObj;
  } catch (err) {
    return {};
  }
}

async function updateSetting(key, value) {
  if (gasDb.isGasConfigured()) {
    return gasDb.updateSetting(key, value);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Settings'];
    let list = XLSX.utils.sheet_to_json(ws) || [];

    const index = list.findIndex(r => r.Key === key);
    if (index >= 0) {
      list[index].Value = String(value);
      list[index].Diubah = new Date().toISOString();
    } else {
      list.push({
        Key: key,
        Value: String(value),
        Diubah: new Date().toISOString()
      });
    }

    wb.Sheets['Settings'] = XLSX.utils.json_to_sheet(list);
    await writeWorkbook(wb, false);
    return { [key]: value };
  });
}

async function getNotificationLogs() {
  if (gasDb.isGasConfigured()) {
    return gasDb.getNotificationLogs();
  }

  await initExcel();
  const wb = readWorkbook();
  const ws = wb.Sheets['Notifikasi_Log'];
  if (!ws) return [];
  const list = XLSX.utils.sheet_to_json(ws) || [];
  return list.reverse(); // newest first
}

async function addNotificationLog(logData) {
  if (gasDb.isGasConfigured()) {
    return gasDb.addNotificationLog(logData);
  }

  return withWriteLock(async () => {
    await initExcel();
    const wb = readWorkbook();
    const ws = wb.Sheets['Notifikasi_Log'];
    const list = XLSX.utils.sheet_to_json(ws) || [];

    const newLog = {
      ID: generateLogId(),
      Tipe: logData.tipe,
      Channel: logData.channel,
      Penerima: logData.penerima,
      Status: logData.status,
      'Waktu Kirim': new Date().toISOString()
    };

    list.push(newLog);
    wb.Sheets['Notifikasi_Log'] = XLSX.utils.json_to_sheet(list);
    await writeWorkbook(wb, false);
    return newLog;
  });
}

function getExcelFilePath() {
  return EXCEL_PATH;
}

module.exports = {
  initExcel,
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  clearAllTransactions,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getUsers,
  getUserByUsername,
  getUserById,
  addUser,
  updateUser,
  deleteUser,
  getSettings,
  updateSetting,
  getNotificationLogs,
  addNotificationLog,
  getExcelFilePath
};
