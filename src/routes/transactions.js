const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getTransactions,
  getTransactionById,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  clearAllTransactions
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
 * Helper to determine if a user has permission to edit or delete a transaction
 */
function canUserManageTransaction(user, txUser) {
  const role = String(user.Role || user.role || '').toLowerCase();
  const username = String(user.Username || user.username || '').toLowerCase();
  const creator = String(txUser || '').toLowerCase();

  // Admin / Kepala Keluarga can manage everything
  if (role === 'admin' || username === 'admin' || username === 'risman') {
    return true;
  }

  // Author can manage their own
  if (creator === username) return true;
  if (username === 'risman' && (creator === 'admin' || creator.includes('risman') || creator.includes('budi'))) return true;
  if (username === 'sitijulaeha' && (creator === 'siti' || creator.includes('julaeha') || creator.includes('rahayu'))) return true;
  if (username === 'siti' && (creator === 'sitijulaeha' || creator.includes('julaeha') || creator.includes('rahayu'))) return true;

  return false;
}

/**
 * PUT /api/transactions/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const existing = await getTransactionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    if (!canUserManageTransaction(req.user, existing.User)) {
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
 * DELETE /api/transactions/clear-all
 * Clear all transaction records (Admin only)
 */
router.delete('/clear-all', async (req, res) => {
  try {
    const role = String(req.user.Role || req.user.role || '').toLowerCase();
    const username = String(req.user.Username || req.user.username || '').toLowerCase();
    const isAdmin = role === 'admin' || username === 'admin' || username === 'risman';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Hanya admin yang dapat mengosongkan semua transaksi.'
      });
    }

    await clearAllTransactions();
    res.json({
      success: true,
      message: 'Semua data transaksi berhasil dibersihkan dan dikosongkan.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    if (!canUserManageTransaction(req.user, existing.User)) {
      return res.status(403).json({
        success: false,
        message: 'Anda hanya dapat menghapus transaksi yang Anda catat sendiri atau login sebagai Kepala Keluarga.'
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
