const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');
const {
  getSettings,
  updateSetting,
  getNotificationLogs
} = require('../services/excelService');
const { sendDailyReminder } = require('../services/notificationScheduler');
const { sendEmailNotification } = require('../services/emailService');
const { sendTelegramNotification } = require('../services/telegramService');

router.use(authMiddleware);

/**
 * GET /api/notifications/settings
 */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      success: true,
      data: {
        notif_daily_enabled: settings.notif_daily_enabled === 'true',
        notif_daily_time: settings.notif_daily_time || '20:00',
        notif_channel: settings.notif_channel || 'both',
        telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN ? '••••••••' : (settings.telegram_bot_token || ''),
        smtp_configured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/notifications/settings
 */
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { notif_daily_enabled, notif_daily_time, notif_channel, telegram_bot_token } = req.body;

    if (notif_daily_enabled !== undefined) {
      await updateSetting('notif_daily_enabled', String(notif_daily_enabled));
    }
    if (notif_daily_time !== undefined) {
      await updateSetting('notif_daily_time', notif_daily_time);
    }
    if (notif_channel !== undefined) {
      await updateSetting('notif_channel', notif_channel);
    }
    if (telegram_bot_token !== undefined && !telegram_bot_token.includes('••••')) {
      await updateSetting('telegram_bot_token', telegram_bot_token);
    }

    res.json({
      success: true,
      message: 'Pengaturan notifikasi berhasil disimpan.'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/notifications/test
 * Test trigger reminder for current user
 */
router.post('/test', async (req, res) => {
  try {
    const { channel = 'both' } = req.body;
    const user = req.user;
    const results = [];

    if (channel === 'email' || channel === 'both') {
      const emailRes = await sendEmailNotification({
        to: user.Email || 'test@example.com',
        subject: '🧪 Uji Coba Notifikasi RST Family Finance',
        html: `<h3>Halo ${user.Nama}!</h3><p>Ini adalah notifikasi uji coba dari aplikasi pencatatan keuangan keluarga Anda.</p>`,
        username: user.Username
      });
      results.push({ channel: 'email', ...emailRes });
    }

    if (channel === 'telegram' || channel === 'both') {
      const tgRes = await sendTelegramNotification({
        chatId: user['Telegram Chat ID'] || '12345678',
        text: `🧪 <b>Uji Coba Notifikasi</b>\nHalo <b>${user.Nama}</b>! Ini adalah pesan uji coba dari sistem RST Family Finance.`,
        username: user.Username
      });
      results.push({ channel: 'telegram', ...tgRes });
    }

    res.json({
      success: true,
      message: 'Uji coba notifikasi telah diproses. Cek log pengiriman.',
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/notifications/log
 */
router.get('/log', requireAdmin, async (req, res) => {
  try {
    const logs = await getNotificationLogs();
    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
