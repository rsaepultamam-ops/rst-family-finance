const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');
const {
  getUsers,
  addUser,
  updateUser,
  deleteUser
} = require('../services/excelService');

// All user routes require authentication and admin privileges
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/users - List all users
 */
router.get('/', async (req, res) => {
  try {
    const users = await getUsers();
    const safeUsers = users.map(u => {
      const { Password, ...rest } = u;
      return rest;
    });
    res.json({ success: true, data: safeUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/users - Add family member
 */
router.post('/', async (req, res) => {
  try {
    const { nama, username, password, role, email, telegramChatId } = req.body;
    if (!nama || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, dan password wajib diisi.'
      });
    }

    const newUser = await addUser({
      nama,
      username,
      password,
      role: role || 'anggota',
      email: email || '',
      telegramChatId: telegramChatId || ''
    });

    res.status(201).json({
      success: true,
      message: 'Anggota keluarga baru berhasil didaftarkan.',
      data: newUser
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/users/:id - Edit user / reset password
 */
router.put('/:id', async (req, res) => {
  try {
    const { nama, role, email, telegramChatId, password, aktif } = req.body;
    const updated = await updateUser(req.params.id, {
      nama,
      role,
      email,
      telegramChatId,
      password,
      aktif
    });

    res.json({
      success: true,
      message: 'Data anggota keluarga berhasil diperbarui.',
      data: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/users/:id - Soft-delete/deactivate user
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.ID) {
      return res.status(400).json({
        success: false,
        message: 'Anda tidak dapat menonaktifkan akun Anda sendiri.'
      });
    }

    const result = await deleteUser(req.params.id);
    res.json({ success: true, message: 'User berhasil dinonaktifkan.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
