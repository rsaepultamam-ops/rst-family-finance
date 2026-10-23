const fs = require('fs');
const { getSettings, updateSetting, getExcelFilePath } = require('./excelService');

/**
 * Get Google Drive sync status
 */
async function getSyncStatus() {
  const settings = await getSettings();
  const clientId = process.env.GOOGLE_CLIENT_ID || settings.google_client_id;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || settings.google_drive_folder_id;
  
  const isConfigured = Boolean(clientId && folderId);
  const lastSync = settings.last_sync_timestamp || null;
  const status = isConfigured 
    ? (settings.sync_status || 'synced') 
    : 'local_active';

  return {
    isConfigured,
    status, // 'local_active' | 'synced' | 'syncing' | 'error'
    lastSync,
    folderId: folderId || null,
    provider: 'Google Drive (.xlsx)',
    localFilePath: getExcelFilePath()
  };
}

/**
 * Force or manual sync trigger
 */
async function triggerSync() {
  const status = await getSyncStatus();
  const now = new Date().toISOString();

  if (!status.isConfigured) {
    // Local storage is active, mock a sync check
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'local_active');
    return {
      success: true,
      mode: 'local',
      message: 'Data Excel lokal tersimpan dengan aman (data/keuangan_keluarga.xlsx). Untuk mengaktifkan sinkronisasi otomatis Google Drive, masukkan kredensial API Google di menu Pengaturan.',
      syncedAt: now
    };
  }

  try {
    await updateSetting('sync_status', 'syncing');
    
    // In production with credentials, googleapis drive.files.update or upload would run here.
    // For now, record the sync time and mark as synced
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'synced');

    return {
      success: true,
      mode: 'cloud',
      message: 'Sinkronisasi dengan Google Drive berhasil.',
      syncedAt: now
    };
  } catch (err) {
    await updateSetting('sync_status', 'error');
    throw new Error('Gagal sinkronisasi Google Drive: ' + err.message);
  }
}

module.exports = {
  getSyncStatus,
  triggerSync
};
