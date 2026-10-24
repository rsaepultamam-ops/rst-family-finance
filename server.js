require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initExcel } = require('./src/services/excelService');
const { initScheduler } = require('./src/services/notificationScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: Hydrate Google Refresh Token from Client Header if present
app.use((req, res, next) => {
  const headerToken = req.headers['x-google-refresh-token'];
  if (headerToken && typeof headerToken === 'string' && headerToken.trim()) {
    process.env.GOOGLE_REFRESH_TOKEN = headerToken.trim();
  }
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/sync', require('./src/routes/sync'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/export', require('./src/routes/export'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'RST Family Finance',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback for direct browser URL navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan internal server.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server (Hanya jika dijalankan langsung, bukan di-import oleh serverless Vercel)
async function startServer() {
  try {
    // Initialize database Excel file
    console.log('🔄 Memeriksa database Excel...');
    await initExcel();
    console.log('✅ Database Excel siap.');

    if (!process.env.VERCEL) {
      // Initialize notification cron jobs (hanya jika server persistent)
      initScheduler();

      app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 RST Family Finance Server berjalan!`);
        console.log(`🌐 Akses Aplikasi: http://localhost:${PORT}`);
        console.log(`📊 Basis Data: data/keuangan_keluarga.xlsx`);
        console.log(`👤 Akun Default Admin: admin / admin123`);
        console.log(`👤 Akun Default Anggota: siti / siti123`);
        console.log(`==================================================\n`);
      });
    }
  } catch (err) {
    console.error('❌ Gagal inisialisasi server:', err);
    if (!process.env.VERCEL) process.exit(1);
  }
}

startServer();

module.exports = app;
