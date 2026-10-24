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
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Token kedaluwarsa atau tidak valid. Silakan login kembali.'
      });
    }

    // Default safe user object from verified JWT claims
    const safeUser = {
      ID: decoded.id,
      Nama: decoded.nama,
      Username: decoded.username,
      Role: decoded.role,
      Aktif: true
    };

    // Auto-migrate legacy names if token was issued prior to renaming
    if (safeUser.Nama && safeUser.Nama.includes('Budi')) {
      safeUser.Nama = 'Risman (Kepala Keluarga)';
      safeUser.Username = 'risman';
    } else if (safeUser.Nama && safeUser.Nama.includes('Rahayu')) {
      safeUser.Nama = 'Siti Julaeha (Anggota Keluarga)';
      safeUser.Username = 'sitijulaeha';
    }

    // If database is initialized and accessible, verify that user is not disabled
    try {
      const user = await getUserById(decoded.id);
      if (user) {
        if (!user.Aktif) {
          return res.status(403).json({
            success: false,
            message: 'Akun ini telah dinonaktifkan oleh Admin.'
          });
        }
        const { Password, ...dbSafeUser } = user;
        req.user = dbSafeUser;
        return next();
      }
    } catch (dbErr) {
      // Graceful fallback during cold starts or transient DB initialization
      console.warn('[AUTH] Database check skipped, relying on verified JWT:', dbErr.message);
    }

    // Authenticate with verified JWT payload
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada verifikasi autentikasi server.'
    });
  }
}

module.exports = authMiddleware;

