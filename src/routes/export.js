const express = require('express');
const router = express.Router();
const fs = require('fs');
const XLSX = require('xlsx');
const authMiddleware = require('../middleware/auth');
const {
  getExcelFilePath,
  initExcel,
  getTransactions,
  getCategories,
  getUsers,
  getSettings,
  getNotificationLogs
} = require('../services/excelService');
const gasDb = require('../services/gasDatabaseService');

router.use(authMiddleware);

/**
 * GET /api/export - Download Excel file (.xlsx)
 */
router.get('/', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `keuangan_keluarga_rst_${todayStr}.xlsx`;

    // Jika menggunakan Google Apps Script, buat file Excel langsung dari data cloud terbaru
    if (gasDb.isGasConfigured()) {
      const [transactions, categories, users, settings, logs] = await Promise.all([
        getTransactions(),
        getCategories(true),
        getUsers(),
        getSettings(),
        getNotificationLogs()
      ]);

      const wb = XLSX.utils.book_new();

      const wsTrx = XLSX.utils.json_to_sheet(transactions, {
        header: ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan', 'User', 'Dibuat', 'Diubah']
      });
      const wsCat = XLSX.utils.json_to_sheet(categories);
      const safeUsers = users.map(u => {
        const { Password, ...rest } = u;
        return rest;
      });
      const wsUsers = XLSX.utils.json_to_sheet(safeUsers);
      const settingsList = Object.keys(settings).map(k => ({ Key: k, Value: settings[k] }));
      const wsSettings = XLSX.utils.json_to_sheet(settingsList);
      const wsLogs = XLSX.utils.json_to_sheet(logs);

      XLSX.utils.book_append_sheet(wb, wsTrx, 'Transaksi');
      XLSX.utils.book_append_sheet(wb, wsCat, 'Kategori');
      XLSX.utils.book_append_sheet(wb, wsUsers, 'Users');
      XLSX.utils.book_append_sheet(wb, wsSettings, 'Settings');
      XLSX.utils.book_append_sheet(wb, wsLogs, 'Notifikasi_Log');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    // Mode file lokal
    await initExcel();
    const filePath = getExcelFilePath();

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File Excel tidak ditemukan.'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
