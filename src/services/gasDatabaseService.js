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
// HEALTH & DIAGNOSTICS
// ============================================

async function setupDatabase() {
  return sendGasRequest('setup');
}


async function ping() {
  return sendGasRequest('ping', {}, 10000);
}

// ============================================
// TRANSAKSI
// ============================================

async function getTransactions(filters = {}) {
  const list = await sendGasRequest('getTransactions', { params: filters });
  return Array.isArray(list) ? list : [];
}

async function getTransactionById(id) {
  return sendGasRequest('getTransactionById', { id });
}

async function addTransaction(data) {
  return sendGasRequest('addTransaction', { data });
}

async function updateTransaction(id, updateData) {
  return sendGasRequest('updateTransaction', { id, data: updateData });
}

async function deleteTransaction(id) {
  return sendGasRequest('deleteTransaction', { id });
}

async function clearAllTransactions() {
  return sendGasRequest('clearAllTransactions');
}

// ============================================
// KATEGORI
// ============================================

async function getCategories(includeInactive = false) {
  const list = await sendGasRequest('getCategories', { includeInactive });
  return Array.isArray(list) ? list : [];
}

async function addCategory(data) {
  return sendGasRequest('addCategory', { data });
}

async function updateCategory(id, data) {
  return sendGasRequest('updateCategory', { id, data });
}

async function deleteCategory(id) {
  return sendGasRequest('deleteCategory', { id });
}

// ============================================
// USERS
// ============================================

async function getUsers() {
  const list = await sendGasRequest('getUsers');
  return Array.isArray(list) ? list : [];
}

async function getUserByUsername(username) {
  return sendGasRequest('getUserByUsername', { username });
}

async function getUserById(id) {
  return sendGasRequest('getUserById', { id });
}

async function addUser(data) {
  return sendGasRequest('addUser', { data });
}

async function updateUser(id, updateData) {
  return sendGasRequest('updateUser', { id, data: updateData });
}

async function deleteUser(id) {
  return sendGasRequest('deleteUser', { id });
}

// ============================================
// SETTINGS
// ============================================

async function getSettings() {
  const settings = await sendGasRequest('getSettings');
  return settings || {};
}

async function updateSetting(key, value) {
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
  return sendGasRequest('batchImport', { data: bundle }, 60000);
}

module.exports = {
  isGasConfigured,
  ping,
  setupDatabase,
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
