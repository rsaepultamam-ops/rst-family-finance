const cron = require('node-cron');
const { getUsers, getTransactions, getSettings } = require('./excelService');
const { sendEmailNotification } = require('./emailService');
const { sendTelegramNotification } = require('./telegramService');
const { formatRupiah, formatDateIndo } = require('../utils/formatCurrency');

/**
 * Send Daily Reminder to all active users
 */
async function sendDailyReminder() {
  const users = await getUsers();
  const todayStr = new Date().toISOString().slice(0, 10);
  const transactionsToday = await getTransactions({ startDate: todayStr, endDate: todayStr });

  const totalExpenseToday = transactionsToday
    .filter(t => t.Tipe === 'Pengeluaran')
    .reduce((sum, t) => sum + Number(t.Jumlah), 0);

  const formattedExpense = formatRupiah(totalExpenseToday);
  const dateFormatted = formatDateIndo(new Date());

  for (const user of users) {
    if (!user.Aktif) continue;

    const emailSubject = `🔔 Reminder Harian Keuangan Keluarga - ${dateFormatted}`;
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #2563eb; margin-top: 0;">Hai, ${user.Nama}! 🔔</h2>
        <p style="color: #475569; font-size: 15px;">Sudah mencatat seluruh pengeluaran keluarga hari ini?</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #64748b; font-size: 13px;">📅 Tanggal: <strong>${dateFormatted}</strong></p>
          <p style="margin: 5px 0; color: #1e293b; font-size: 15px;">💰 Total Pengeluaran Hari Ini: <strong style="color: #ef4444;">${formattedExpense}</strong></p>
          <p style="margin: 5px 0; color: #64748b; font-size: 13px;">📝 Jumlah Transaksi: <strong>${transactionsToday.length} transaksi</strong></p>
        </div>
        <p style="color: #475569; font-size: 14px;">Yuk luangkan 1 menit untuk memastikan catatan keuangan keluarga tetap rapi dan terupdate!</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Salam hangat,<br><strong>RST Family Finance</strong></p>
      </div>
    `;

    const telegramText = `🔔 <b>Hai ${user.Nama}!</b>\n\nSudah catat pengeluaran hari ini?\n📅 <b>${dateFormatted}</b>\n💰 <b>Pengeluaran hari ini:</b> ${formattedExpense} (${transactionsToday.length} transaksi)\n\n<i>Yuk buka aplikasi untuk melengkapi catatan keuangan keluarga!</i>`;

    if (user.Email) {
      await sendEmailNotification({
        to: user.Email,
        subject: emailSubject,
        html: emailHtml,
        username: user.Username
      });
    }

    if (user['Telegram Chat ID']) {
      await sendTelegramNotification({
        chatId: user['Telegram Chat ID'],
        text: telegramText,
        username: user.Username
      });
    }
  }
}

/**
 * Send Weekly Summary
 */
async function sendWeeklySummary() {
  const users = await getUsers();
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startStr = lastWeek.toISOString().slice(0, 10);
  const endStr = now.toISOString().slice(0, 10);

  const txs = await getTransactions({ startDate: startStr, endDate: endStr });
  const totalExpense = txs
    .filter(t => t.Tipe === 'Pengeluaran')
    .reduce((sum, t) => sum + Number(t.Jumlah), 0);

  for (const user of users) {
    if (!user.Aktif) continue;
    const msg = `📊 <b>Ringkasan Mingguan RST Family</b>\nPeriode: ${startStr} s/d ${endStr}\n\n💸 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n📝 <b>Total Transaksi:</b> ${txs.length} transaksi`;
    if (user['Telegram Chat ID']) {
      await sendTelegramNotification({ chatId: user['Telegram Chat ID'], text: msg, username: user.Username });
    }
  }
}

/**
 * Initialize all Cron Schedulers
 */
function initScheduler() {
  const dailyCron = process.env.NOTIF_DAILY_CRON || '0 20 * * *';
  const weeklyCron = process.env.NOTIF_WEEKLY_CRON || '0 8 * * 1';

  cron.schedule(dailyCron, () => {
    console.log('[CRON] Menjalankan Reminder Harian...');
    sendDailyReminder().catch(console.error);
  });

  cron.schedule(weeklyCron, () => {
    console.log('[CRON] Menjalankan Ringkasan Mingguan...');
    sendWeeklySummary().catch(console.error);
  });

  console.log(`[CRON] Notifikasi scheduler aktif (Daily: "${dailyCron}", Weekly: "${weeklyCron}")`);
}

module.exports = {
  initScheduler,
  sendDailyReminder,
  sendWeeklySummary
};
