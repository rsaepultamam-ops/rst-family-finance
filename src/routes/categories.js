const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory
} = require('../services/excelService');

router.use(authMiddleware);

/**
 * GET /api/categories
 */
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await getCategories(includeInactive);
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/categories - Add custom category
 */
router.post('/', async (req, res) => {
  try {
    const { nama, tipe, ikon, warna } = req.body;

    if (!nama || !tipe) {
      return res.status(400).json({
        success: false,
        message: 'Nama dan tipe kategori wajib diisi.'
      });
    }

    const newCat = await addCategory({
      nama,
      tipe,
      ikon: ikon || '🏷️',
      warna: warna || '#3B82F6',
      dibuatOleh: req.user.Username
    });

    res.status(201).json({
      success: true,
      message: 'Kategori baru berhasil ditambahkan.',
      data: newCat
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/categories/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await updateCategory(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Kategori berhasil diperbarui.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteCategory(req.params.id);
    res.json({
      success: true,
      message: 'Kategori berhasil dinonaktifkan.',
      data: deleted
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
