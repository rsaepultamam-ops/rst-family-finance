const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { getSettings, updateSetting, getExcelFilePath } = require('./excelService');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive'
];

/**
 * Get OAuth2 Client instance
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/sync/oauth2callback';

  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth 2.0 Consent URL
 */
function generateAuthUrl() {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    throw new Error('GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di file .env');
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  });
}

/**
 * Exchange auth code for tokens and save refresh_token to settings
 */
async function handleOAuth2Callback(code) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) throw new Error('OAuth2 Client belum siap.');

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (tokens.refresh_token) {
    await updateSetting('google_refresh_token', tokens.refresh_token);
  }
  if (tokens.access_token) {
    await updateSetting('google_access_token', tokens.access_token);
  }

  await updateSetting('cloud_sync_enabled', 'true');
  await updateSetting('sync_status', 'synced');
  await updateSetting('last_sync_timestamp', new Date().toISOString());

  // Trigger initial upload / sync
  try {
    await uploadToDrive();
  } catch (err) {
    console.error('Initial sync error:', err.message);
  }

  return tokens;
}

/**
 * Initialize Google Drive Client (Supports OAuth 2.0 or Service Account)
 */
async function getDriveClient() {
  const settings = await getSettings();

  // Option 1: OAuth 2.0 with stored refresh token (Most user-friendly!)
  const refreshToken = settings.google_refresh_token;
  if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Option 2: Service Account Environment Variables
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (email && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: SCOPES
    });
    return google.drive({ version: 'v3', auth });
  }

  // Option 3: Key file path (local JSON)
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath && fs.existsSync(keyFilePath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
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
  const hasOAuth = Boolean(settings.google_refresh_token && process.env.GOOGLE_CLIENT_ID);
  const hasServiceAccount = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))
  );

  const isConfigured = Boolean((hasOAuth || hasServiceAccount));
  const lastSync = settings.last_sync_timestamp || null;
  const status = isConfigured ? (settings.sync_status || 'synced') : 'local_active';

  return {
    isConfigured,
    authType: hasOAuth ? 'OAuth 2.0' : (hasServiceAccount ? 'Service Account' : 'None'),
    status,
    lastSync,
    folderId: folderId || 'Root / Custom Folder',
    provider: 'Google Drive (.xlsx)',
    localFilePath: getExcelFilePath()
  };
}

/**
 * Find existing file in Google Drive
 */
async function findFileInFolder(drive, folderId, fileName = 'keuangan_keluarga.xlsx') {
  try {
    let query = `name = '${fileName}' and trashed = false`;
    if (folderId && folderId !== 'root') {
      query = `'${folderId}' in parents and ${query}`;
    }

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive'
    });
    const files = res.data.files;
    return files && files.length > 0 ? files[0] : null;
  } catch (err) {
    console.error('Error finding file in Google Drive:', err.message);
    return null;
  }
}

/**
 * Download file from Google Drive to local Excel path
 */
async function downloadFromDrive() {
  const drive = await getDriveClient();
  if (!drive) return false;

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const targetPath = getExcelFilePath();
  const existing = await findFileInFolder(drive, folderId);

  if (!existing) {
    console.log('[DRIVE] File belum ada di Google Drive. Akan dibuat saat pertama kali dicatat.');
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
  const drive = await getDriveClient();
  if (!drive) return null;

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
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
    // Create new file in Google Drive
    console.log('[DRIVE] Mengunggah file baru ke Google Drive...');
    const requestBody = { name: 'keuangan_keluarga.xlsx' };
    if (folderId && folderId !== 'root') {
      requestBody.parents = [folderId];
    }

    const res = await drive.files.create({
      requestBody,
      media,
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
  const drive = await getDriveClient();
  const now = new Date().toISOString();

  if (!drive) {
    await updateSetting('last_sync_timestamp', now);
    await updateSetting('sync_status', 'local_active');
    return {
      success: true,
      mode: 'local',
      message: 'Penyimpanan lokal aktif. Untuk mengaktifkan sinkronisasi otomatis Google Drive, klik tombol "Hubungkan Akun Google" di bawah.',
      syncedAt: now
    };
  }

  try {
    await updateSetting('sync_status', 'syncing');
    const result = await uploadToDrive();
    return {
      success: true,
      mode: 'cloud',
      message: 'Sinkronisasi dengan Google Drive berhasil! File keuangan_keluarga.xlsx terupdate di Google Drive.',
      fileId: result ? result.id : null,
      syncedAt: now
    };
  } catch (err) {
    await updateSetting('sync_status', 'error');
    throw new Error('Gagal sinkronisasi Google Drive: ' + err.message);
  }
}

module.exports = {
  getOAuth2Client,
  generateAuthUrl,
  handleOAuth2Callback,
  getSyncStatus,
  triggerSync,
  downloadFromDrive,
  uploadToDrive
};
