const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction
} = require('../services/excelService');

router.use(authMiddleware);

/**
 * GET /api/transactions
 * Query params: search, tipe, kategori, user, startDate, endDate, month, year, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      search,
      tipe,
      kategori,
      user,
      startDate,
      endDate,
      month,
      year,
      page = 1,
      limit = 100
    } = req.query;

    const list = await getTransactions({
      search,
      tipe,
      kategori,
      user,
      startDate,
      endDate,
      month,
      year
    });

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum);

    // Compute basic totals for convenience
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    list.forEach(t => {
      const amt = Number(t.Jumlah) || 0;
      if (t.Tipe === 'Pemasukan') totalPemasukan += amt;
      else if (t.Tipe === 'Pengeluaran') totalPengeluaran += amt;
    });

    res.json({
      success: true,
      data: paginated,
      meta: {
        totalItems: list.length,
        currentPage: pageNum,
        totalPages: Math.ceil(list.length / limitNum) || 1,
        totalPemasukan,
        totalPengeluaran,
        saldo: totalPemasukan - totalPengeluaran
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/transactions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await getTransactionById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/transactions
 */
router.post('/', async (req, res) => {
  try {
    const { tanggal, tipe, kategori, jumlah, keterangan } = req.body;

    if (!tanggal || !tipe || !kategori || !jumlah) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal, tipe, kategori, dan jumlah transaksi wajib diisi.'
      });
    }

    const newTx = await addTransaction({
      tanggal,
      tipe,
      kategori,
      jumlah,
      keterangan: keterangan || '',
      user: req.user.Username
    });

    res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dicatat ke Excel.',
      data: newTx
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/transactions/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const existing = await getTransactionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    // Role check: Only author or admin can edit
    if (req.user.Role !== 'admin' && existing.User !== req.user.Username) {
      return res.status(403).json({
        success: false,
        message: 'Anda hanya dapat mengubah transaksi yang Anda catat sendiri.'
      });
    }

    const updated = await updateTransaction(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Transaksi berhasil diperbarui.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/transactions/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const existing = await getTransactionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    // Role check: Only author or admin can delete
    if (req.user.Role !== 'admin' && existing.User !== req.user.Username) {
      return res.status(403).json({
        success: false,
        message: 'Anda hanya dapat menghapus transaksi yang Anda catat sendiri.'
      });
    }

    await deleteTransaction(req.params.id);
    res.json({
      success: true,
      message: 'Transaksi berhasil dihapus dari file Excel.'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
