/**
 * RST Family Finance - Settings, Cloud Sync, & Notifications Module
 */

async function loadSettingsPage() {
  try {
    const [syncRes, notifRes, logsRes] = await Promise.all([
      API.get('/api/sync/status'),
      API.get('/api/notifications/settings').catch(() => ({ data: {} })),
      API.get('/api/notifications/log').catch(() => ({ data: [] }))
    ]);

    // Cloud Sync UI
    if (syncRes.success && syncRes.data) {
      const s = syncRes.data;
      const elStatus = document.getElementById('setting-sync-status-badge');
      const elLastSync = document.getElementById('setting-last-sync-time');
      const elLocalPath = document.getElementById('setting-local-path');

      if (elStatus) {
        if (s.status === 'synced') {
          elStatus.innerHTML = `<span class="badge-pill badge-active">☁️ Tersinkronisasi Google Drive</span>`;
        } else if (s.status === 'local_active') {
          elStatus.innerHTML = `<span class="badge-pill" style="background:#e0f2fe; color:#0369a1;">💾 Penyimpanan Excel Lokal Aktif</span>`;
        } else {
          elStatus.innerHTML = `<span class="badge-pill badge-inactive">${s.status}</span>`;
        }
      }

      if (elLastSync) {
        elLastSync.textContent = s.lastSync ? new Date(s.lastSync).toLocaleString('id-ID') : 'Belum pernah';
      }

      if (elLocalPath) {
        elLocalPath.textContent = s.localFilePath;
      }

      const permBox = document.getElementById('setting-permanent-sync-box');
      const refreshToken = s.refreshToken || API.getGoogleRefreshToken();
      if (permBox) {
        permBox.style.display = (s.isConfigured || refreshToken) ? 'block' : 'none';
      }
    }

    // Notification Settings
    if (notifRes.success && notifRes.data) {
      const n = notifRes.data;
      const chkDaily = document.getElementById('setting-notif-daily-enabled');
      const selTime = document.getElementById('setting-notif-daily-time');
      const selChannel = document.getElementById('setting-notif-channel');

      if (chkDaily) chkDaily.checked = n.notif_daily_enabled;
      if (selTime) selTime.value = n.notif_daily_time || '20:00';
      if (selChannel) selChannel.value = n.notif_channel || 'both';
    }

    // Notification Logs
    if (logsRes.success && logsRes.data) {
      const logBody = document.getElementById('setting-notif-logs-body');
      if (logBody) {
        const logs = logsRes.data;
        if (logs.length === 0) {
          logBody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada riwayat pengiriman notifikasi.</td></tr>`;
        } else {
          logBody.innerHTML = logs.slice(0, 10).map(l => `
            <tr>
              <td style="font-size: 12px; color: var(--text-muted);">${new Date(l['Waktu Kirim']).toLocaleString('id-ID')}</td>
              <td><strong>${l.Tipe}</strong></td>
              <td><span class="user-role-badge">${l.Channel}</span></td>
              <td>${l.Penerima}</td>
              <td>
                <span class="badge-pill ${l.Status === 'sent' ? 'badge-active' : (l.Status === 'simulated' ? 'badge-active' : 'badge-inactive')}" style="${l.Status === 'simulated' ? 'background:#fef3c7; color:#b45309;' : ''}">
                  ${l.Status}
                </span>
              </td>
            </tr>
          `).join('');
        }
      }
    }

  } catch (err) {
    console.error('Error loading settings:', err);
    showToast('Gagal memuat pengaturan: ' + err.message, 'error');
  }
}

// Trigger manual sync now
async function triggerManualSync() {
  const btn = document.getElementById('btn-manual-sync');
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '🔄 Menyinkronkan...';
    }

    const res = await API.post('/api/sync');
    if (res.success) {
      showToast('✅ ' + res.data.message, 'success');
      loadSettingsPage();
      updateGlobalSyncIndicator();
    }
  } catch (err) {
    showToast('Gagal sinkronisasi: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 Sinkronkan Sekarang';
    }
  }
}

// Trigger test notification
async function triggerTestNotification() {
  const btn = document.getElementById('btn-test-notif');
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Mengirim...';
    }

    const res = await API.post('/api/notifications/test', { channel: 'both' });
    if (res.success) {
      showToast('🧪 Notifikasi uji coba berhasil dikirim & dicatat di log!', 'success');
      loadSettingsPage();
    }
  } catch (err) {
    showToast('Gagal uji coba: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🚀 Kirim Notifikasi Uji Coba';
    }
  }
}

// Download Excel file directly
function downloadExcelFile() {
  const token = API.getToken();
  if (!token) {
    showToast('Silakan login terlebih dahulu untuk mengunduh Excel', 'warning');
    return;
  }
  showToast('Memulai download file Excel (.xlsx)...', 'info');
  // Open direct download link with token authorization
  fetch('/api/export', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (!res.ok) throw new Error('Gagal mengunduh file');
    return res.blob();
  })
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan_keluarga_rst_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('✅ File Excel berhasil diunduh!', 'success');
  })
  .catch(err => {
    showToast(err.message, 'error');
  });
}

// Save Notification Settings
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-notification-settings');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const notif_daily_enabled = document.getElementById('setting-notif-daily-enabled').checked;
      const notif_daily_time = document.getElementById('setting-notif-daily-time').value;
      const notif_channel = document.getElementById('setting-notif-channel').value;
      const telegram_bot_token = document.getElementById('setting-telegram-token')?.value || '';

      try {
        const res = await API.put('/api/notifications/settings', {
          notif_daily_enabled,
          notif_daily_time,
          notif_channel,
          telegram_bot_token
        });

        if (res.success) {
          showToast('✅ Pengaturan notifikasi berhasil disimpan!', 'success');
        }
      } catch (err) {
        showToast(err.message || 'Gagal menyimpan pengaturan', 'error');
      }
    });
  }
});

async function confirmClearAllTransactions() {
  const confirmed = confirm('PERHATIAN: Apakah Anda yakin ingin mengosongkan SEMUA data transaksi?\n\nSemua riwayat transaksi akan dihapus dan saldo akan di-reset ke Rp 0. Tindakan ini tidak dapat dibatalkan.');
  if (!confirmed) return;

  const btn = document.getElementById('btn-clear-all-tx');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Membersihkan transaksi...';
    }

    const res = await API.delete('/api/transactions/clear-all');
    if (res.success) {
      showToast('🎉 Semua data transaksi berhasil dibersihkan! Saldo sekarang Rp 0.', 'success', 5000);
      if (typeof loadTransactionsTable === 'function') await loadTransactionsTable(1);
      if (typeof loadDashboard === 'function') await loadDashboard();
      if (typeof loadMonthlyReport === 'function') await loadMonthlyReport();
    }
  } catch (err) {
    showToast('Gagal membersihkan transaksi: ' + (err.message || 'Terjadi kesalahan'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🗑️ Bersihkan & Kosongkan Semua Transaksi';
    }
  }
}

function copyGoogleRefreshToken() {
  const token = API.getGoogleRefreshToken();
  if (!token) {
    showToast('Token belum tersedia di browser. Silakan klik "Hubungkan Akun Google Drive" terlebih dahulu.', 'warning');
    return;
  }
  navigator.clipboard.writeText(token).then(() => {
    showToast('📋 GOOGLE_REFRESH_TOKEN berhasil disalin ke clipboard!', 'success', 5000);
  }).catch(() => {
    prompt('Salin GOOGLE_REFRESH_TOKEN berikut:', token);
  });
}

window.loadSettingsPage = loadSettingsPage;
window.triggerManualSync = triggerManualSync;
window.triggerTestNotification = triggerTestNotification;
window.downloadExcelFile = downloadExcelFile;
window.confirmClearAllTransactions = confirmClearAllTransactions;
window.copyGoogleRefreshToken = copyGoogleRefreshToken;
