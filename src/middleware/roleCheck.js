function requireAdmin(req, res, next) {
  if (!req.user || req.user.Role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Fitur ini hanya dapat diakses oleh Admin (Kepala Keluarga).'
    });
  }
  next;
  next();
}

module.exports = {
  requireAdmin
};
