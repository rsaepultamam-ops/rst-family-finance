const nodemailer = require('nodemailer');
const { addNotificationLog } = require('./excelService');

/**
 * Send an email notification
 * @param {Object} options { to, subject, html, text, username }
 */
async function sendEmailNotification({ to, subject, html, text, username = 'user' }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'RST Family Finance <noreply@rstfamily.com>';

  // If SMTP is not yet configured, gracefully log and return success simulation
  if (!host || !user || !pass) {
    console.log(`[SIMULASI EMAIL] Kepada: ${to} | Subjek: ${subject}`);
    await addNotificationLog({
      tipe: 'Email Notification',
      channel: 'email',
      penerima: username + ` (${to || 'no-email'})`,
      status: 'simulated'
    });
    return {
      success: true,
      simulated: true,
      message: 'Simulasi pengiriman email berhasil (SMTP belum dikonfigurasi di .env)'
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || '',
      html: html || text
    });

    await addNotificationLog({
      tipe: subject,
      channel: 'email',
      penerima: username + ` (${to})`,
      status: 'sent'
    });

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error('Email error:', err);
    await addNotificationLog({
      tipe: subject,
      channel: 'email',
      penerima: username + ` (${to})`,
      status: 'failed'
    });
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  sendEmailNotification
};
