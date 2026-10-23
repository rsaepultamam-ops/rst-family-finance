const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getUserByUsername } = require('../services/excelService');
const { comparePassword } = require('../utils/hashPassword');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'rst_family_finance_super_secret_key_2026_jwt_token_secure';

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.'
      });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password tidak sesuai.'
      });
    }

    if (!user.Aktif) {
      return res.status(403).json({
        success: false,
        message: 'Akun ini telah dinonaktifkan oleh Admin.'
      });
    }

    const isMatch = await comparePassword(password, user.Password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password tidak sesuai.'
      });
    }

    // Generate JWT token (expires in 7 days)
    const token = jwt.sign(
      {
        id: user.ID,
        username: user.Username,
        role: user.Role,
        nama: user.Nama
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { Password, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server: ' + err.message
    });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Logout berhasil.'
  });
});

module.exports = router;
