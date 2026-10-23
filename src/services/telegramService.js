const { addNotificationLog } = require('./excelService');

/**
 * Send a message via Telegram Bot API
 * @param {Object} options { chatId, text, username, parseMode }
 */
async function sendTelegramNotification({ chatId, text, username = 'user', parseMode = 'HTML' }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !chatId) {
    console.log(`[SIMULASI TELEGRAM] ChatID: ${chatId || 'Kosong'} | Pesan: ${text.slice(0, 80)}...`);
    await addNotificationLog({
      tipe: 'Telegram Reminder',
      channel: 'telegram',
      penerima: username + ` (${chatId || 'no-chat-id'})`,
      status: 'simulated'
    });
    return {
      success: true,
      simulated: true,
      message: 'Simulasi notifikasi Telegram berhasil tercatat di log (Bot Token / Chat ID belum diatur).'
    };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
      })
    });

    const data = await response.json();
    if (data.ok) {
      await addNotificationLog({
        tipe: 'Telegram Message',
        channel: 'telegram',
        penerima: username + ` (${chatId})`,
        status: 'sent'
      });
      return { success: true, result: data.result };
    } else {
      await addNotificationLog({
        tipe: 'Telegram Message',
        channel: 'telegram',
        penerima: username + ` (${chatId})`,
        status: 'failed'
      });
      return { success: false, error: data.description };
    }
  } catch (err) {
    console.error('Telegram API error:', err);
    await addNotificationLog({
      tipe: 'Telegram Message',
      channel: 'telegram',
      penerima: username + ` (${chatId})`,
      status: 'failed'
    });
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendTelegramNotification
};
