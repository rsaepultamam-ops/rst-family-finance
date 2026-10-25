/**
 * RST Family Finance - Google Apps Script Database Service Adapter
 * 
 * Menghubungkan backend Node.js Express ke Google Spreadsheet via Google Apps Script (Drive)
 * Tanpa perlu Google Cloud Console, OAuth Client ID, atau Service Account.
 */

require('dotenv').config();

function getGasUrl() {
  return (process.env.GAS_WEB_APP_URL || '').trim();
}

function getGasSecret() {
  return (process.env.GAS_SECRET_KEY || 'rst_family_secure_token_2026').trim();
}

function isGasConfigured() {
  const url = getGasUrl();
  return Boolean(url && url.startsWith('http') && url.includes('/macros/s/'));
}

/**
 * Mengirim request ke Google Apps Script Web App
 */
async function sendGasRequest(action, extraPayload = {}, timeoutMs = 30000, isRetry = false) {
  const url = getGasUrl();
  if (!url) {
    throw new Error('GAS_WEB_APP_URL belum dikonfigurasi di file .env atau Vercel Environment Variables.');
  }

  const payload = {
    action,
    secret: getGasSecret(),
    ...extraPayload
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timer);

    const json = await res.json().catch(err => {
      throw new Error('Gagal memproses respon dari Google Apps Script: ' + err.message);
    });

    if (!json.success) {
      const errMsg = String(json.message || '');
      // Auto-recovery jika tabel/sheet belum dibuat di Google Spreadsheet
      if (!isRetry && action !== 'setup' && (errMsg.includes('tidak ditemukan') || errMsg.includes('Sheet'))) {
        console.log('[GAS] Sheet belum ada di Google Spreadsheet (' + errMsg + '). Menjalankan auto-setup database...');
        try {
          await sendGasRequest('setup', {}, 30000, true);
          console.log('[GAS] Auto-setup database berhasil, mengulangi request: ' + action);
          return await sendGasRequest(action, extraPayload, timeoutMs, true);
        } catch (setupErr) {
          console.warn('[GAS] Auto-setup database gagal:', setupErr.message);
        }
      }

      throw new Error(json.message || 'Terjadi kesalahan pada Google Apps Script database.');
    }

    return json.data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Waktu permintaan ke Google Apps Script habis (timeout setelah ' + (timeoutMs / 1000) + ' detik).');
    }
    throw err;
  }
}

// ============================================
// HIGH-SPEED IN-MEMORY CACHE (Mengurangi Latensi Google Drive)
// ============================================
const memoryCache = new Map();

function getFromCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setToCache(key, data, ttlSeconds = 30) {
  memoryCache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  });
}

function invalidateCache(prefix = null) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}

// ============================================
// HEALTH & DIAGNOSTICS
// ============================================

async function setupDatabase() {
  invalidateCache();
  return sendGasRequest('setup');
}

async function ping() {
  return sendGasRequest('ping', {}, 10000);
}

// ============================================
// TRANSAKSI
// ============================================

async function getAllTransactionsCached() {
  const cached = getFromCache('tx_master');
  if (cached) {
    return cached;
  }

  const list = await sendGasRequest('getTransactions', {});
  const result = Array.isArray(list) ? list : [];
  setToCache('tx_master', result, 30); // Cache 30 detik di memory
  return result;
}

async function getTransactions(filters = {}) {
  // Jika tanpa filter, langsung gunakan master cache
  if (!filters || Object.keys(filters).length === 0) {
    return getAllTransactionsCached();
  }

  const cacheKey = 'tx_' + JSON.stringify(filters);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const list = await sendGasRequest('getTransactions', { params: filters });
  const result = Array.isArray(list) ? list : [];
  setToCache(cacheKey, result, 20);
  return result;
}

async function getTransactionById(id) {
  return sendGasRequest('getTransactionById', { id });
}

async function addTransaction(data) {
  invalidateCache('tx_');
  return sendGasRequest('addTransaction', { data });
}

async function updateTransaction(id, updateData) {
  invalidateCache('tx_');
  return sendGasRequest('updateTransaction', { id, data: updateData });
}

async function deleteTransaction(id) {
  invalidateCache('tx_');
  return sendGasRequest('deleteTransaction', { id });
}

async function clearAllTransactions() {
  invalidateCache('tx_');
  return sendGasRequest('clearAllTransactions');
}

// ============================================
// KATEGORI
// ============================================

async function getCategories(includeInactive = false) {
  const cacheKey = 'cat_' + includeInactive;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const list = await sendGasRequest('getCategories', { includeInactive });
  const result = Array.isArray(list) ? list : [];
  setToCache(cacheKey, result, 60); // Cache 60 detik
  return result;
}

async function addCategory(data) {
  invalidateCache('cat_');
  return sendGasRequest('addCategory', { data });
}

async function updateCategory(id, data) {
  invalidateCache('cat_');
  return sendGasRequest('updateCategory', { id, data });
}

async function deleteCategory(id) {
  invalidateCache('cat_');
  return sendGasRequest('deleteCategory', { id });
}

// ============================================
// USERS
// ============================================

async function getUsers() {
  const cached = getFromCache('users_all');
  if (cached) {
    return cached;
  }

  const list = await sendGasRequest('getUsers');
  const result = Array.isArray(list) ? list : [];
  setToCache('users_all', result, 60); // Cache 60 detik
  return result;
}

async function getUserByUsername(username) {
  return sendGasRequest('getUserByUsername', { username });
}

async function getUserById(id) {
  return sendGasRequest('getUserById', { id });
}

async function addUser(data) {
  invalidateCache('users');
  return sendGasRequest('addUser', { data });
}

async function updateUser(id, updateData) {
  invalidateCache('users');
  return sendGasRequest('updateUser', { id, data: updateData });
}

async function deleteUser(id) {
  invalidateCache('users');
  return sendGasRequest('deleteUser', { id });
}

// ============================================
// SETTINGS
// ============================================

async function getSettings() {
  const cached = getFromCache('settings_all');
  if (cached) {
    return cached;
  }

  const settings = await sendGasRequest('getSettings');
  const result = settings || {};
  setToCache('settings_all', result, 60);
  return result;
}

async function updateSetting(key, value) {
  invalidateCache('settings');
  return sendGasRequest('updateSetting', { key, value });
}

// ============================================
// NOTIFIKASI LOG
// ============================================

async function getNotificationLogs() {
  const logs = await sendGasRequest('getNotificationLogs');
  return Array.isArray(logs) ? logs : [];
}

async function addNotificationLog(logData) {
  return sendGasRequest('addNotificationLog', { data: logData });
}

// ============================================
// BATCH IMPORT
// ============================================

async function batchImport(bundle) {
  invalidateCache(); // Bersihkan semua cache
  return sendGasRequest('batchImport', { data: bundle }, 60000);
}

module.exports = {
  isGasConfigured,
  ping,
  setupDatabase,
  invalidateCache,
  getAllTransactionsCached,
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
  batchImport
};
