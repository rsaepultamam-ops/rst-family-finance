const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getSyncStatus,
  triggerSync,
  generateAuthUrl,
  handleOAuth2Callback
} = require('../services/googleDriveService');

function getDynamicRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}/api/sync/oauth2callback`;
}

/**
 * GET /api/sync/auth - Start Google OAuth flow
 */
router.get('/auth', (req, res) => {
  try {
    const redirectUri = getDynamicRedirectUri(req);
    const authUrl = generateAuthUrl(redirectUri);
    res.redirect(authUrl);
  } catch (err) {
    const currentHost = req.headers['x-forwarded-host'] || req.headers.host || 'rst-family-finance.vercel.app';
    const redirectUrlExample = `https://${currentHost}/api/sync/oauth2callback`;
    
    res.status(400).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gagal Memulai Koneksi Google - RST Family Finance</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .card { background: #ffffff; max-width: 620px; width: 100%; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; text-align: left; }
          h2 { color: #dc2626; margin-top: 0; font-size: 22px; display: flex; align-items: center; gap: 8px; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 8px; font-weight: 500; margin-bottom: 20px; font-size: 14px; }
          .steps-title { font-weight: 700; margin-bottom: 8px; color: #0f172a; font-size: 15px; }
          ol { padding-left: 20px; margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: #334155; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #0284c7; }
          .code-block { background: #0f172a; color: #38bdf8; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 13px; margin: 10px 0; overflow-x: auto; line-height: 1.6; }
          .btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; }
          .btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ Gagal Memulai Koneksi Google</h2>
          <div class="alert-box">${err.message}</div>
          
          <div class="steps-title">Cara Mengatasi di Vercel:</div>
          <ol>
            <li>Buka dashboard <strong>Vercel</strong> &gt; pilih project <strong>rst-family-finance</strong> &gt; buka tab <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
            <li>Tambahkan variabel berikut:
              <div class="code-block">
                GOOGLE_CLIENT_ID=&lt;Google Client ID Anda&gt;<br/>
                GOOGLE_CLIENT_SECRET=&lt;Google Client Secret Anda&gt;<br/>
                GOOGLE_REDIRECT_URI=${redirectUrlExample}
              </div>
            </li>
            <li>Di <strong>Google Cloud Console</strong> &gt; <strong>APIs &amp; Services</strong> &gt; <strong>Credentials</strong> &gt; klik <strong>OAuth 2.0 Client ID</strong> Anda, lalu tambahkan redirect URI ini ke <strong>Authorized redirect URIs</strong>:<br/>
              <code>${redirectUrlExample}</code>
            </li>
            <li>Lakukan <strong>Redeploy</strong> project Anda di Vercel agar perubahan aktif.</li>
          </ol>
          <div style="text-align: center; margin-top: 20px;">
            <a href="/" class="btn">← Kembali ke Aplikasi</a>
          </div>
        </div>
      </body>
      </html>
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

    const redirectUri = getDynamicRedirectUri(req);
    const tokens = await handleOAuth2Callback(code, redirectUri);
    const refreshToken = (tokens && tokens.refresh_token) || process.env.GOOGLE_REFRESH_TOKEN || '';
    const refreshTokenParam = refreshToken ? `&refreshToken=${encodeURIComponent(refreshToken)}` : '';

    // Redirect to frontend with query flag and refresh token
    res.redirect(`/?sync=success${refreshTokenParam}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Gagal Menghubungkan Google Drive</title>
        <style>
          body { font-family: sans-serif; background: #f8fafc; padding: 40px; text-align: center; }
          .card { background: white; max-width: 500px; margin: 40px auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
          h2 { color: #dc2626; }
          p { color: #475569; font-size: 15px; }
          a { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Gagal Menghubungkan Google Drive</h2>
          <p>${err.message}</p>
          <a href="/">← Kembali ke Aplikasi</a>
        </div>
      </body>
      </html>
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
