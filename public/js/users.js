/**
 * RST Family Finance - Family Members (Users) Module
 */

async function loadUsersPage() {
  const container = document.getElementById('users-table-body');
  if (!container) return;

  try {
    const res = await API.get('/api/users');
    const users = res.data || [];

    const currentUser = API.getCurrentUser() || {};

    container.innerHTML = users.map(u => {
      const isAdmin = u.Role === 'admin';
      const isSelf = (currentUser.ID && currentUser.ID === u.ID) || (currentUser.Username && currentUser.Username.toLowerCase() === (u.Username || '').toLowerCase());

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="user-avatar" style="width: 34px; height: 34px; font-size: 13px;">
                ${u.Nama.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>${u.Nama}</strong>
                ${isSelf ? '<span style="font-size: 10px; color: var(--primary); font-weight: 700; margin-left: 4px;">(Anda)</span>' : ''}
                <div style="font-size: 12px; color: var(--text-muted);">@${u.Username}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="user-role-badge ${isAdmin ? 'admin' : ''}">
              ${isAdmin ? '👑 Kepala Keluarga (Admin)' : '👤 Anggota'}
            </span>
          </td>
          <td style="font-size: 13px; color: var(--text-secondary);">${u.Email || '—'}</td>
          <td style="font-size: 13px; color: var(--text-secondary);">${u['Telegram Chat ID'] || '—'}</td>
          <td>
            <span class="badge-pill ${u.Aktif ? 'badge-active' : 'badge-inactive'}">
              ${u.Aktif ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td style="text-align: center;">
            <button class="btn-icon-action" title="Edit Anggota" onclick="openEditUserModal('${u.ID}', '${u.Nama}', '${u.Role}', '${u.Email || ''}', '${u['Telegram Chat ID'] || ''}')">✏️</button>
            ${!isSelf ? `
              <button class="btn-icon-action delete" title="Nonaktifkan" onclick="deleteUserPrompt('${u.ID}', '${u.Nama}')">🚫</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading users:', err);
    if (err.message.includes('Akses ditolak')) {
      container.innerHTML = `<tr><td colspan="6" class="empty-state">Hanya Admin yang dapat mengakses manajemen anggota keluarga.</td></tr>`;
    } else {
      showToast('Gagal memuat daftar anggota: ' + err.message, 'error');
    }
  }
}

function openAddUserModal() {
  const form = document.getElementById('form-add-user');
  if (form) form.reset();
  openModal('modal-add-user');
}

function openEditUserModal(id, nama, role, email, telegramId) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-nama').value = nama;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-email').value = email;
  document.getElementById('edit-user-telegram').value = telegramId;
  document.getElementById('edit-user-password').value = ''; // empty unless changed
  openModal('modal-edit-user');
}

async function deleteUserPrompt(id, name) {
  if (!confirm(`Apakah Anda yakin ingin menonaktifkan akun ${name}? Data transaksi mereka tetap aman di Excel, namun mereka tidak akan bisa login lagi.`)) {
    return;
  }

  try {
    const res = await API.delete(`/api/users/${id}`);
    if (res.success) {
      showToast(`Akun ${name} dinonaktifkan`, 'info');
      loadUsersPage();
    }
  } catch (err) {
    showToast(err.message || 'Gagal menonaktifkan user', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const addForm = document.getElementById('form-add-user');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = document.getElementById('modal-user-nama').value.trim();
      const username = document.getElementById('modal-user-username').value.trim();
      const password = document.getElementById('modal-user-password').value;
      const role = document.getElementById('modal-user-role').value;
      const email = document.getElementById('modal-user-email').value.trim();
      const telegramChatId = document.getElementById('modal-user-telegram').value.trim();

      try {
        const res = await API.post('/api/users', {
          nama,
          username,
          password,
          role,
          email,
          telegramChatId
        });

        if (res.success) {
          showToast(`Anggota keluarga "${nama}" berhasil didaftarkan!`, 'success');
          closeModal('modal-add-user');
          addForm.reset();
          loadUsersPage();
        }
      } catch (err) {
        showToast(err.message || 'Gagal mendaftarkan user', 'error');
      }
    });
  }

  const editForm = document.getElementById('form-edit-user');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-user-id').value;
      const nama = document.getElementById('edit-user-nama').value.trim();
      const role = document.getElementById('edit-user-role').value;
      const email = document.getElementById('edit-user-email').value.trim();
      const telegramChatId = document.getElementById('edit-user-telegram').value.trim();
      const password = document.getElementById('edit-user-password').value;

      try {
        const payload = { nama, role, email, telegramChatId };
        if (password) payload.password = password;

        const res = await API.put(`/api/users/${id}`, payload);
        if (res.success) {
          showToast(`Data anggota keluarga berhasil diperbarui`, 'success');
          closeModal('modal-edit-user');
          loadUsersPage();
        }
      } catch (err) {
        showToast(err.message || 'Gagal memperbarui user', 'error');
      }
    });
  }
});

window.loadUsersPage = loadUsersPage;
window.openAddUserModal = openAddUserModal;
window.openEditUserModal = openEditUserModal;
window.deleteUserPrompt = deleteUserPrompt;
