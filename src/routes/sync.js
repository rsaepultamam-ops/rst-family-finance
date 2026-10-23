const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getSyncStatus, triggerSync } = require('../services/googleDriveService');

router.use(authMiddleware);

/**
 * GET /api/sync/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/sync - Trigger sync
 */
router.post('/', async (req, res) => {
  try {
    const result = await triggerSync();
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
