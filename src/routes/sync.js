const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const gasDb = require('../services/gasDatabaseService');

/**
 * GET /api/sync/auth - Redirect to settings with info (Google Cloud OAuth is retired)
 */
router.get('/auth', (req, res) => {
  res.redirect('/settings.html?tab=sync');
});

/**
 * GET /api/sync/status - Cek status koneksi Google Apps Script / Drive
 */
router.get('/status', async (req, res) => {
  try {
    if (gasDb.isGasConfigured()) {
      try {
        const pingRes = await gasDb.ping();
        return res.json({
          success: true,
          data: {
            mode: 'google_apps_script',
            status: 'synced',
            isConfigured: true,
            spreadsheetName: pingRes.spreadsheetName || 'RST Family Finance Database',
            spreadsheetUrl: pingRes.spreadsheetUrl || '',
            lastSync: pingRes.serverTime || new Date().toISOString(),
            message: 'Terkoneksi langsung ke Google Drive via Google Apps Script (Tanpa Google Cloud).'
          }
        });
      } catch (pingErr) {
        return res.json({
          success: true,
          data: {
            mode: 'google_apps_script',
            status: 'error',
            isConfigured: true,
            error: pingErr.message,
            message: 'Gagal terhubung ke Google Apps Script: ' + pingErr.message
          }
        });
      }
    }

    // Fallback: Mode Lokal
    res.json({
      success: true,
      data: {
        mode: 'local',
        status: 'local_active',
        isConfigured: false,
        message: 'Menggunakan database Excel lokal. Sambungkan Google Apps Script untuk cloud sync otomatis.'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint selanjutnya memerlukan autentikasi login
router.use(authMiddleware);

/**
 * POST /api/sync - Tes koneksi sinkronisasi Google Apps Script
 */
router.post('/', async (req, res) => {
  try {
    if (!gasDb.isGasConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script belum dikonfigurasi. Silakan isi GAS_WEB_APP_URL di file .env atau Vercel Environment Variables.'
      });
    }

    const pingRes = await gasDb.ping();
    res.json({
      success: true,
      message: 'Koneksi ke Google Drive (Apps Script) aktif dan siap digunakan!',
      data: {
        status: 'synced',
        spreadsheetName: pingRes.spreadsheetName,
        spreadsheetUrl: pingRes.spreadsheetUrl,
        lastSync: pingRes.serverTime
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal sinkronisasi: ' + err.message });
  }
});

module.exports = router;
