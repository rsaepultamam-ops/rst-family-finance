/**
 * RST Family Finance - Main Application Controller
 */

let currentActiveTab = 'dashboard';

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth session
  const token = API.getToken();
  const user = API.getCurrentUser();

  if (!token || !user) {
    window.location.href = '/login.html';
    return;
  }

  // Clean stale names from local storage if present
  if (user.Nama && user.Nama.includes('Budi')) {
    user.Nama = 'Risman (Kepala Keluarga)';
    user.Username = 'risman';
    API.setSession(token, user);
  } else if (user.Nama && user.Nama.includes('Rahayu')) {
    user.Nama = 'Siti Julaeha (Anggota Keluarga)';
    user.Username = 'sitijulaeha';
    API.setSession(token, user);
  }

  // Populate User Information in Header & Sidebar
  populateUserInfo(user);

  // Synchronize latest user profile from server dynamically
  refreshCurrentUserProfile();

  // Initialize Navigation Click Handlers
  initNavigation();

  // Initialize Selectors & Filters
  if (typeof initReportSelectors === 'function') initReportSelectors();
  if (typeof initTransactionFilters === 'function') initTransactionFilters();

  // Check if redirected from Google OAuth
  const urlParams = new URLSearchParams(window.location.search);
  const refreshTokenFromUrl = urlParams.get('refreshToken');
  if (refreshTokenFromUrl) {
    API.setGoogleRefreshToken(refreshTokenFromUrl);
  }
  if (urlParams.get('sync') === 'success') {
    showToast('🎉 Google Drive berhasil terhubung! Data keuangan keluarga otomatis tersinkronisasi.', 'success', 6000);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Initial Sync Status Check
  updateGlobalSyncIndicator();

  // Set today's date in header
  const dateBox = document.getElementById('header-current-date');
  if (dateBox) {
    dateBox.textContent = formatDate(new Date());
  }

  // Load Initial Tab
  switchTab('dashboard');

  // Periodic background check for sync status (every 30 seconds)
  setInterval(updateGlobalSyncIndicator, 30000);
});

function populateUserInfo(user) {
  const u = user || {};
  let nama = u.Nama || u.nama || 'Pengguna';
  let role = String(u.Role || u.role || 'anggota').toLowerCase();

  // Instant client migration if localStorage still holds stale name
  if (nama.includes('Budi') || u.Username === 'admin' || u.username === 'admin') {
    nama = 'Risman (Kepala Keluarga)';
    u.Nama = nama;
  } else if (nama.includes('Rahayu') || u.Username === 'siti' || u.username === 'siti') {
    nama = 'Siti Julaeha (Anggota Keluarga)';
    u.Nama = nama;
  }

  // Sidebar user card
  const elAvatar = document.getElementById('user-sidebar-avatar');
  const elName = document.getElementById('user-sidebar-name');
  const elRole = document.getElementById('user-sidebar-role');

  if (elAvatar) elAvatar.textContent = nama.charAt(0).toUpperCase();
  if (elName) {
    elName.textContent = nama;
    elName.title = nama;
  }
  if (elRole) {
    if (role === 'admin') {
      elRole.textContent = 'Kepala Keluarga (Admin)';
      elRole.className = 'user-role-badge admin';
    } else {
      elRole.textContent = 'Anggota Keluarga';
      elRole.className = 'user-role-badge';
    }
  }

  // Header user pill
  const elHeaderAvatar = document.getElementById('header-user-avatar');
  const elHeaderName = document.getElementById('header-user-name');
  if (elHeaderAvatar) elHeaderAvatar.textContent = nama.charAt(0).toUpperCase();
  if (elHeaderName) elHeaderName.textContent = nama.split(' ')[0];

  // Show/hide Admin only navigation
  const adminOnlyNav = document.querySelectorAll('.admin-only');
  adminOnlyNav.forEach(el => {
    el.style.display = role === 'admin' ? '' : 'none';
  });
}

async function refreshCurrentUserProfile() {
  try {
    const res = await API.get('/api/auth/me');
    if (res && res.success && res.user) {
      const token = API.getToken();
      API.setSession(token, res.user);
      populateUserInfo(res.user);
    }
  } catch (err) {
    console.warn('Gagal memuat profil user terbaru:', err.message);
  }
}

function initNavigation() {
  // Sidebar items
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      if (target) {
        switchTab(target);
        closeMobileSidebar();
      }
    });
  });

  // Mobile bottom bar items
  document.querySelectorAll('.bottom-nav-bar .bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      if (target) {
        switchTab(target);
      }
    });
  });

  // Mobile menu toggle
  const mobileToggle = document.getElementById('btn-mobile-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileSidebar);
  }
}

function switchTab(tabId) {
  currentActiveTab = tabId;

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.add('active');

  // Update nav item active classes
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update Page Title
  const titles = {
    dashboard: 'Dashboard Ringkasan',
    transactions: 'Riwayat Transaksi',
    reports: 'Laporan Keuangan Bulanan',
    categories: 'Kelola Kategori',
    users: 'Anggota Keluarga',
    settings: 'Pengaturan & Cloud Sync'
  };
  const titleBox = document.getElementById('current-page-title');
  if (titleBox && titles[tabId]) {
    titleBox.textContent = titles[tabId];
  }

  // Load data for specific tab
  if (tabId === 'dashboard' && typeof loadDashboard === 'function') {
    loadDashboard();
  } else if (tabId === 'transactions' && typeof loadTransactionsTable === 'function') {
    loadTransactionsTable(1);
  } else if (tabId === 'reports' && typeof loadMonthlyReport === 'function') {
    loadMonthlyReport();
  } else if (tabId === 'categories' && typeof loadCategoriesPage === 'function') {
    loadCategoriesPage();
  } else if (tabId === 'users' && typeof loadUsersPage === 'function') {
    loadUsersPage();
  } else if (tabId === 'settings' && typeof loadSettingsPage === 'function') {
    loadSettingsPage();
  }

  // Automatically close mobile sidebar if open
  closeMobileSidebar();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) {
    const isOpen = sidebar.classList.toggle('mobile-open');
    if (overlay) overlay.classList.toggle('active', isOpen);
  }
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
}

async function updateGlobalSyncIndicator() {
  const badge = document.getElementById('header-sync-badge');
  const dot = document.getElementById('header-sync-dot');
  const text = document.getElementById('header-sync-text');
  if (!badge) return;

  try {
    const res = await API.get('/api/sync/status');
    if (res.success && res.data) {
      const s = res.data;
      if (s.refreshToken) {
        API.setGoogleRefreshToken(s.refreshToken);
      }
      if (s.status === 'synced') {
        if (dot) dot.className = 'sync-dot';
        if (text) text.textContent = 'Drive Synced';
        badge.title = 'Tersinkronisasi dengan Google Drive';
      } else if (s.status === 'local_active') {
        if (dot) dot.className = 'sync-dot local';
        if (text) text.textContent = 'Excel Lokal';
        badge.title = 'Basis data: data/keuangan_keluarga.xlsx';
      } else if (s.status === 'syncing') {
        if (dot) dot.className = 'sync-dot syncing';
        if (text) text.textContent = 'Syncing...';
      } else {
        if (dot) dot.className = 'sync-dot error';
        if (text) text.textContent = 'Sync Error';
      }
    }
  } catch (err) {
    if (dot) dot.className = 'sync-dot local';
    if (text) text.textContent = 'Offline / Lokal';
  }
}

window.switchTab = switchTab;
window.toggleMobileSidebar = toggleMobileSidebar;
window.updateGlobalSyncIndicator = updateGlobalSyncIndicator;
