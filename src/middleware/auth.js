const jwt = require('jsonwebtoken');
const { getUserById } = require('../services/excelService');

const JWT_SECRET = process.env.JWT_SECRET || 'rst_family_finance_super_secret_key_2026_jwt_token_secure';

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token autentikasi tidak ditemukan.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(decoded.id);
    if (!user || !user.Aktif) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna tidak valid atau sudah dinonaktifkan.'
      });
    }

    // Attach user (without password)
    const { Password, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token kedaluwarsa atau tidak valid. Silakan login kembali.'
    });
  }
}

module.exports = authMiddleware;
