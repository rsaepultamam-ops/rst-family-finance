const express = require('express');
const router = express.Router();
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { getExcelFilePath, initExcel } = require('../services/excelService');

router.use(authMiddleware);

/**
 * GET /api/export - Download Excel file
 */
router.get('/', async (req, res) => {
  try {
    await initExcel();
    const filePath = getExcelFilePath();

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File Excel tidak ditemukan.'
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `keuangan_keluarga_rst_${todayStr}.xlsx`;

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
