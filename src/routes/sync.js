const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getSyncStatus,
  triggerSync,
  generateAuthUrl,
  handleOAuth2Callback
} = require('../services/googleDriveService');

/**
 * GET /api/sync/auth - Start Google OAuth flow
 */
router.get('/auth', (req, res) => {
  try {
    const authUrl = generateAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    res.status(400).send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #ef4444;">Gagal Memulai Koneksi Google</h2>
        <p>${err.message}</p>
        <p>Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di file .env</p>
        <a href="/" style="color: #2563eb;">← Kembali ke Aplikasi</a>
      </div>
    `);
  }
});

/**
 * GET /api/sync/oauth2callback - Callback from Google OAuth
 */
router.get('/oauth2callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) {
      throw new Error('Akses Google ditolak: ' + error);
    }
    if (!code) {
      throw new Error('Kode otorisasi Google tidak ditemukan.');
    }

    await handleOAuth2Callback(code);

    // Redirect to frontend with query flag
    res.redirect('/?sync=success');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`
      <div style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #ef4444;">Gagal Menghubungkan Google Drive</h2>
        <p>${err.message}</p>
        <a href="/" style="color: #2563eb;">← Kembali ke Aplikasi</a>
      </div>
    `);
  }
});

// The remaining routes require user auth
router.use(authMiddleware);

/**
 * GET /api/sync/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/sync - Trigger sync
 */
router.post('/', async (req, res) => {
  try {
    const result = await triggerSync();
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
