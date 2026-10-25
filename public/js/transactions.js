/**
 * RST Family Finance - Transactions History Module
 */

let currentTxPage = 1;
const TX_PER_PAGE = 15;
let txEditingId = null;

async function loadTransactionsTable(page = 1) {
  currentTxPage = page;
  const tbody = document.getElementById('tx-table-body');
  const emptyContainer = document.getElementById('tx-empty-state');
  const summaryBox = document.getElementById('tx-filter-summary');

  // Read filters
  const search = document.getElementById('filter-search')?.value.trim() || '';
  const tipe = document.getElementById('filter-tipe')?.value || 'Semua';
  const kategori = document.getElementById('filter-kategori')?.value || 'Semua';
  const user = document.getElementById('filter-user')?.value || 'Semua';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';

  try {
    const params = {
      page: currentTxPage,
      limit: TX_PER_PAGE,
      _t: Date.now()
    };
    if (search) params.search = search;
    if (tipe && tipe !== 'Semua') params.tipe = tipe;
    if (kategori && kategori !== 'Semua') params.kategori = kategori;
    if (user && user !== 'Semua') params.user = user;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const res = await API.get('/api/transactions', params);
    const txs = res.data || [];
    const meta = res.meta || {};

    if (summaryBox) {
      summaryBox.innerHTML = `
        <span>Ditemukan: <strong>${meta.totalItems} transaksi</strong></span> • 
        <span>Masuk: <strong class="text-success">${formatCurrency(meta.totalPemasukan)}</strong></span> • 
        <span>Keluar: <strong class="text-danger">${formatCurrency(meta.totalPengeluaran)}</strong></span> • 
        <span>Saldo: <strong>${formatCurrency(meta.saldo)}</strong></span>
      `;
    }

    if (txs.length === 0) {
      if (tbody) tbody.innerHTML = '';
      if (emptyContainer) emptyContainer.style.display = 'block';
      renderPagination(0, 1);
      return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';

    const currentUser = API.getCurrentUser() || {};

    if (tbody) {
      tbody.innerHTML = txs.map(t => {
        const isExp = t.Tipe === 'Pengeluaran';
        const colorClass = isExp ? 'text-danger' : 'text-success';
        const uRole = String(currentUser.Role || currentUser.role || '').toLowerCase();
        const uName = String(currentUser.Username || currentUser.username || '').toLowerCase();
        const tUser = String(t.User || '').toLowerCase();
        const canManage = uRole === 'admin' || uName === 'admin' || uName === 'risman' || uName === tUser || (uName === 'sitijulaeha' && tUser === 'siti') || (uName === 'risman' && (tUser === 'admin' || tUser.includes('budi')));

        return `
          <tr>
            <td style="white-space: nowrap; font-size: 13px; color: var(--text-muted);">${formatDate(t.Tanggal)}</td>
            <td>
              <span class="badge-pill ${isExp ? 'badge-inactive' : 'badge-active'}">
                ${t.Tipe}
              </span>
            </td>
            <td>
              <strong>${t.Kategori}</strong>
            </td>
            <td>${t.Keterangan || '<span style="color:#cbd5e1">—</span>'}</td>
            <td>
              <span class="tx-user-tag">👤 ${t.User}</span>
            </td>
            <td style="text-align: right; font-weight: 700;" class="${colorClass}">
              ${prefix}${formatCurrency(t.Jumlah)}
            </td>
            <td style="text-align: center; white-space: nowrap;">
              ${canManage ? `
                <button class="btn-icon-action" title="Edit" onclick="editTransactionPrompt('${t.ID}')">✏️</button>
                <button class="btn-icon-action delete" title="Hapus" onclick="deleteTransactionPrompt('${t.ID}')">🗑️</button>
              ` : '<span style="color:#cbd5e1">—</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    renderPagination(meta.totalItems, meta.totalPages);

  } catch (err) {
    console.error('Error loading transactions table:', err);
    showToast('Gagal memuat riwayat transaksi: ' + err.message, 'error');
  }
}

function renderPagination(totalItems, totalPages) {
  const container = document.getElementById('tx-pagination-controls');
  const info = document.getElementById('tx-pagination-info');
  if (!container) return;

  if (info) {
    info.textContent = `Halaman ${currentTxPage} dari ${totalPages || 1} (${totalItems} total)`;
  }

  let html = `
    <button class="btn-page" ${currentTxPage <= 1 ? 'disabled' : ''} onclick="loadTransactionsTable(${currentTxPage - 1})">← Sebelumnya</button>
  `;

  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `
      <button class="btn-page ${i === currentTxPage ? 'active' : ''}" onclick="loadTransactionsTable(${i})">${i}</button>
    `;
  }

  html += `
    <button class="btn-page" ${currentTxPage >= totalPages ? 'disabled' : ''} onclick="loadTransactionsTable(${currentTxPage + 1})">Berikutnya →</button>
  `;

  container.innerHTML = html;
}

// Prompt for delete
async function deleteTransactionPrompt(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
    return;
  }

  try {
    const res = await API.delete(`/api/transactions/${id}`);
    if (res.success) {
      showToast('✅ Transaksi berhasil dihapus!', 'success');
      if (typeof refreshCurrentActiveView === 'function') {
        refreshCurrentActiveView();
      } else {
        loadTransactionsTable(1);
      }
    }
  } catch (err) {
    showToast(err.message || 'Gagal menghapus transaksi', 'error', 6000);
  }
}

// Prompt for edit
async function editTransactionPrompt(id) {
  try {
    const res = await API.get(`/api/transactions/${id}`);
    if (!res.success || !res.data) return;

    const t = res.data;
    txEditingId = t.ID;

    document.getElementById('edit-tx-id').value = t.ID;
    document.getElementById('edit-tx-tipe').value = t.Tipe;
    document.getElementById('edit-tx-jumlah').value = t.Jumlah;
    document.getElementById('edit-tx-tanggal').value = t.Tanggal;
    document.getElementById('edit-tx-keterangan').value = t.Keterangan || '';

    // Populate category dropdown
    const select = document.getElementById('edit-tx-kategori');
    if (select) {
      const cats = window.allCategoriesCache || [];
      const filtered = cats.filter(c => c.Tipe === t.Tipe);
      select.innerHTML = filtered.map(c => `
        <option value="${c.Nama}" ${c.Nama === t.Kategori ? 'selected' : ''}>${c.Ikon} ${c.Nama}</option>
      `).join('');
    }

    openModal('modal-edit-transaction');
  } catch (err) {
    showToast('Gagal memuat detail transaksi: ' + err.message, 'error');
  }
}

// Populate filters in history tab
async function initTransactionFilters() {
  try {
    const [catRes, userRes] = await Promise.all([
      API.get('/api/categories'),
      API.get('/api/users').catch(() => ({ data: [] }))
    ]);

    // Categories filter dropdown
    const catSelect = document.getElementById('filter-kategori');
    if (catSelect && catRes.data) {
      let html = '<option value="Semua">Semua Kategori</option>';
      catRes.data.forEach(c => {
        html += `<option value="${c.Nama}">${c.Ikon} ${c.Nama}</option>`;
      });
      catSelect.innerHTML = html;
    }

    // Users filter dropdown
    const userSelect = document.getElementById('filter-user');
    if (userSelect && userRes.data) {
      let html = '<option value="Semua">Semua Anggota</option>';
      userRes.data.forEach(u => {
        html += `<option value="${u.Username}">${u.Nama}</option>`;
      });
      userSelect.innerHTML = html;
    }
  } catch (err) {
    console.error('Error init filters:', err);
  }
}

// Save edited transaction
document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('form-edit-transaction');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-tx-id').value;
      const jumlah = document.getElementById('edit-tx-jumlah').value;
      const kategori = document.getElementById('edit-tx-kategori').value;
      const tanggal = document.getElementById('edit-tx-tanggal').value;
      const keterangan = document.getElementById('edit-tx-keterangan').value;

      try {
        const res = await API.put(`/api/transactions/${id}`, {
          jumlah: Number(jumlah),
          kategori,
          tanggal,
          keterangan
        });

        if (res.success) {
          showToast('✅ Transaksi berhasil diperbarui', 'success');
          closeModal('modal-edit-transaction');
          if (typeof refreshCurrentActiveView === 'function') {
            refreshCurrentActiveView();
          } else {
            loadTransactionsTable(currentTxPage);
          }
        }
      } catch (err) {
        showToast(err.message || 'Gagal mengubah transaksi', 'error');
      }
    });
  }
});

window.loadTransactionsTable = loadTransactionsTable;
window.initTransactionFilters = initTransactionFilters;
window.deleteTransactionPrompt = deleteTransactionPrompt;
window.editTransactionPrompt = editTransactionPrompt;
