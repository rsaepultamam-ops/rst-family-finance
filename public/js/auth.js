/**
 * RST Family Finance - Auth UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorAlert = document.getElementById('login-error-alert');

  // If already logged in, redirect to index.html from login.html
  if (window.location.pathname.endsWith('login.html')) {
    if (API.getToken() && API.getCurrentUser()) {
      window.location.href = '/';
      return;
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-login');
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        showError('Username dan password wajib diisi.');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Masuk...';
        hideError();

        const res = await API.post('/api/auth/login', { username, password });

        if (res.success && res.token) {
          API.setSession(res.token, res.user);
          showToast(`Selamat datang kembali, ${res.user.Nama}! 👋`, 'success');
          setTimeout(() => {
            window.location.href = '/';
          }, 400);
        }
      } catch (err) {
        showError(err.message || 'Gagal login. Periksa kembali username dan password Anda.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Masuk ke Aplikasi';
      }
    });
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function hideError() {
    if (errorAlert) {
      errorAlert.style.display = 'none';
    }
  }
});

// Logout handler
function logoutUser() {
  if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
    API.clearSession();
    window.location.href = '/login.html';
  }
}

window.logoutUser = logoutUser;
