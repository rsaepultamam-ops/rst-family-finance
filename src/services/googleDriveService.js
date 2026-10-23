const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getSettings, updateSetting, getExcelFilePath } = require('./excelService');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Initialize Google Drive Client using Service Account
 */
function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  // Option 1: Key file path (local JSON)
  if (keyFilePath && fs.existsSync(keyFilePath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: SCOPES
    });
    return google.drive({ version: 'v3', auth });
  }

  // Option 2: Environment variables (Vercel friendly)
  if (email && privateKey) {
    // Handle escaped newlines in private key
    privateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: SCOPES
    });
    return google.drive({ version: 'v3', auth });
  }

  return null;
}

/**
 * Get Google Drive sync status
 */
async function getSyncStatus() {
  const settings = await getSettings();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || settings.google_drive_folder_id;
  const hasCreds = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))
  );

  const isConfigured = Boolean(hasCreds && folderId);
  const lastSync = settings.last_sync_timestamp || null;
  const status = isConfigured ? (settings.sync_status || 'synced') : 'local_active';

  return {
    isConfigured,
    status,
    lastSync,
    folderId: folderId || null,
    provider: 'Google Drive (.xlsx)',
    localFilePath: getExcelFilePath()
  };
}

/**
 * Find existing file ID in Google Drive folder
 */
async function findFileInFolder(drive, folderId, fileName = 'keuangan_keluarga.xlsx') {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive'
    });
    const files = res.data.files;
    return files && files.length > 0 ? files[0] : null;
  } catch (err) {
    console.error('Error finding file in Google Drive folder:', err);
    throw err;
  }
}

/**
 * Download file from Google Drive to local Excel path
 */
async function downloadFromDrive() {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!drive || !folderId) return false;

  const targetPath = getExcelFilePath();
  const existing = await findFileInFolder(drive, folderId);
  if (!existing) {
    console.log('[DRIVE] File belum ada di Google Drive. Akan dibuat saat upload pertama.');
    return false;
  }

  console.log(`[DRIVE] Mengunduh file dari Google Drive (ID: ${existing.id})...`);
  const dest = fs.createWriteStream(targetPath);
  const res = await drive.files.get(
    { fileId: existing.id, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    res.data
      .pipe(dest)
      .on('finish', () => {
        console.log('[DRIVE] Unduhan file Excel dari Google Drive selesai.');
        resolve(true);
      })
      .on('error', (err) => {
        console.error('[DRIVE] Gagal mengunduh file:', err);
        reject(err);
      });
  });
}

/**
 * Upload or update local Excel file to Google Drive
 */
async function uploadToDrive() {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!drive || !folderId) return null;

  const localPath = getExcelFilePath();
  if (!fs.existsSync(localPath)) return null;

  const existing = await findFileInFolder(drive, folderId);
  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: fs.createReadStream(localPath)
  };

  const now = new Date().toISOString();

  if (existing) {
    // Update existing file
    console.log(`[DRIVE] Memperbarui file di Google Drive (ID: ${existing.id})...`);
    const res = await drive.files.update({
      fileId: existing.id,
      media: media,
      fields: 'id, name, modifiedTime'
    });
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'synced');
    return res.data;
  } else {
    // Create new file in folder
    console.log('[DRIVE] Mengunggah file baru ke folder Google Drive...');
    const res = await drive.files.create({
      requestBody: {
        name: 'keuangan_keluarga.xlsx',
        parents: [folderId]
      },
      media: media,
      fields: 'id, name, modifiedTime'
    });
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'synced');
    return res.data;
  }
}

/**
 * Manual trigger sync button
 */
async function triggerSync() {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const now = new Date().toISOString();

  if (!drive || !folderId) {
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'local_active');
    return {
      success: true,
      mode: 'local',
      message: 'Penyimpanan lokal aktif. Masukkan kredensial Service Account dan GOOGLE_DRIVE_FOLDER_ID untuk mengaktifkan sinkronisasi otomatis Google Drive.',
      syncedAt: now
    };
  }

  try {
    await updateSetting('sync_status', 'syncing');
    const result = await uploadToDrive();
    return {
      success: true,
      mode: 'cloud',
      message: 'Sinkronisasi dengan Google Drive berhasil! File keuangan_keluarga.xlsx terupdate.',
      fileId: result ? result.id : null,
      syncedAt: now
    };
  } catch (err) {
    await updateSetting('sync_status', 'error');
    throw new Error('Gagal sinkronisasi Google Drive: ' + err.message);
  }
}

module.exports = {
  getSyncStatus,
  triggerSync,
  downloadFromDrive,
  uploadToDrive
};
