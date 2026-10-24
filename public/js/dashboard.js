/**
 * RST Family Finance - Dashboard Module
 */

let allCategoriesCache = [];

async function loadDashboard() {
  try {
    const today = new Date();
    const curMonth = today.getMonth() + 1;
    const curYear = today.getFullYear();
    const todayStr = today.toISOString().slice(0, 10);

    // Fetch monthly report, daily report, and recent transactions in parallel
    const [monthlyRes, dailyRes, txRes, catRes] = await Promise.all([
      API.get('/api/reports/monthly', { month: curMonth, year: curYear }),
      API.get('/api/reports/daily', { date: todayStr }),
      API.get('/api/transactions', { limit: 8 }),
      API.get('/api/categories')
    ]);

    allCategoriesCache = catRes.data || [];

    // Render KPI Cards
    if (monthlyRes.success && monthlyRes.data) {
      const summary = monthlyRes.data.summary;
      const comparison = monthlyRes.data.comparison;

      const elSaldo = document.getElementById('dash-saldo');
      const elPemasukan = document.getElementById('dash-pemasukan');
      const elPengeluaran = document.getElementById('dash-pengeluaran');
      const elComparison = document.getElementById('dash-comparison-badge');

      if (elSaldo) elSaldo.textContent = formatCurrency(summary.balance);
      if (elPemasukan) elPemasukan.textContent = formatCurrency(summary.totalIncome);
      if (elPengeluaran) elPengeluaran.textContent = formatCurrency(summary.totalExpense);

      if (elComparison) {
        const pct = comparison.expenseChangePercent;
        if (pct > 0) {
          elComparison.innerHTML = `<span class="text-danger">▲ +${pct}% vs bln lalu</span>`;
        } else if (pct < 0) {
          elComparison.innerHTML = `<span class="text-success">▼ ${pct}% vs bln lalu</span>`;
        } else {
          elComparison.innerHTML = `<span>0% vs bln lalu</span>`;
        }
      }
    }

    // Render Today KPI
    if (dailyRes.success && dailyRes.data) {
      const elHariIni = document.getElementById('dash-hari-ini');
      const elCountHariIni = document.getElementById('dash-count-hari-ini');
      if (elHariIni) elHariIni.textContent = formatCurrency(dailyRes.data.totalExpense);
      if (elCountHariIni) elCountHariIni.textContent = `${dailyRes.data.count} transaksi hari ini`;
    }

    // Render Recent Transactions List
    const txContainer = document.getElementById('dash-recent-transactions');
    if (txContainer) {
      const txs = txRes.data || [];
      if (txs.length === 0) {
        txContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <p>Belum ada transaksi bulan ini.</p>
            <button class="btn-primary" style="margin-top: 10px;" onclick="openTransactionModal()">+ Tambah Transaksi Pertama</button>
          </div>
        `;
      } else {
        txContainer.innerHTML = txs.map(t => renderTransactionItem(t)).join('');
      }
    }

    // Populate Category dropdown in Add Modal
    populateCategorySelect('modal-tx-kategori', 'Pengeluaran');

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Gagal memuat ringkasan dashboard: ' + err.message, 'error');
  }
}

function renderTransactionItem(t) {
  const isExpense = t.Tipe === 'Pengeluaran';
  const prefix = isExpense ? '- ' : '+ ';
  const amountClass = isExpense ? 'pengeluaran' : 'pemasukan';
  const cat = allCategoriesCache.find(c => c.Nama.toLowerCase() === (t.Kategori || '').toLowerCase()) || {};
  const icon = cat.Ikon || (isExpense ? '💸' : '💰');
  const color = cat.Warna || (isExpense ? '#ef4444' : '#10b981');

  const currentUser = API.getCurrentUser() || {};
  const uRole = String(currentUser.Role || currentUser.role || '').toLowerCase();
  const uName = String(currentUser.Username || currentUser.username || '').toLowerCase();
  const tUser = String(t.User || '').toLowerCase();
  const canEdit = uRole === 'admin' || uName === 'admin' || uName === 'risman' || uName === tUser || (uName === 'sitijulaeha' && tUser === 'siti') || (uName === 'risman' && (tUser === 'admin' || tUser.includes('budi')));

  return `
    <div class="transaction-item" id="tx-item-${t.ID}">
      <div class="tx-left">
        <div class="tx-icon-pill" style="background-color: ${color}20; color: ${color};">
          ${icon}
        </div>
        <div class="tx-details">
          <div class="tx-category">
            ${t.Kategori}
            <span class="tx-user-tag">👤 ${t.User}</span>
          </div>
          <div class="tx-note" title="${t.Keterangan || ''}">
            ${t.Keterangan ? t.Keterangan : '<span style="color:#cbd5e1">—</span>'}
          </div>
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${amountClass}">
          ${prefix}${formatCurrency(t.Jumlah)}
        </div>
        <div class="tx-date">${formatDate(t.Tanggal)}</div>
        ${canEdit ? `
          <div class="tx-actions">
            <button class="btn-icon-action" title="Ubah" onclick="editTransactionPrompt('${t.ID}')">✏️</button>
            <button class="btn-icon-action delete" title="Hapus" onclick="deleteTransactionPrompt('${t.ID}')">🗑️</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function populateCategorySelect(selectId, type = 'Pengeluaran') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const filtered = allCategoriesCache.filter(c => c.Tipe === type);
  select.innerHTML = filtered.map(c => `
    <option value="${c.Nama}">${c.Ikon} ${c.Nama}</option>
  `).join('');
}

// Open modal for adding transaction
function openTransactionModal(defaultType = 'Pengeluaran') {
  const form = document.getElementById('form-add-transaction');
  if (form) form.reset();

  const dateInput = document.getElementById('modal-tx-tanggal');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  setModalTxType(defaultType);
  openModal('modal-add-transaction');
}

function setModalTxType(type) {
  const btnExp = document.getElementById('btn-type-pengeluaran');
  const btnInc = document.getElementById('btn-type-pemasukan');
  const typeHidden = document.getElementById('modal-tx-tipe');

  if (typeHidden) typeHidden.value = type;

  if (type === 'Pengeluaran') {
    if (btnExp) btnExp.classList.add('active', 'pengeluaran');
    if (btnInc) btnInc.classList.remove('active', 'pemasukan');
  } else {
    if (btnInc) btnInc.classList.add('active', 'pemasukan');
    if (btnExp) btnExp.classList.remove('active', 'pengeluaran');
  }

  populateCategorySelect('modal-tx-kategori', type);
}

function setPresetAmount(val) {
  const input = document.getElementById('modal-tx-jumlah');
  if (input) {
    input.value = val;
    input.dispatchEvent(new Event('input'));
  }
}

// Save transaction handler
document.addEventListener('DOMContentLoaded', () => {
  // Ensure amount inputs allow any round integer or currency value
  const fixStep = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('step', 'any');
      el.setAttribute('min', '0');
    }
  };
  fixStep('modal-tx-jumlah');
  fixStep('edit-tx-jumlah');

  const form = document.getElementById('form-add-transaction');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      const tipe = document.getElementById('modal-tx-tipe').value;
      const jumlah = document.getElementById('modal-tx-jumlah').value;
      const kategori = document.getElementById('modal-tx-kategori').value;
      const tanggal = document.getElementById('modal-tx-tanggal').value;
      const keterangan = document.getElementById('modal-tx-keterangan').value;

      if (!jumlah || Number(jumlah) <= 0) {
        showToast('Jumlah nominal harus lebih dari 0', 'warning');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';

        const res = await API.post('/api/transactions', {
          tipe,
          jumlah: Number(jumlah),
          kategori,
          tanggal,
          keterangan
        });

        if (res.success) {
          showToast('✅ Transaksi berhasil disimpan ke Excel!', 'success');
          closeModal('modal-add-transaction');
          form.reset();

          // Refresh current page data
          loadDashboard();
          if (typeof loadTransactionsTable === 'function') loadTransactionsTable();
          if (typeof loadMonthlyReport === 'function') loadMonthlyReport();
        }
      } catch (err) {
        showToast(err.message || 'Gagal menyimpan transaksi', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Transaksi';
      }
    });
  }
});

window.loadDashboard = loadDashboard;
window.renderTransactionItem = renderTransactionItem;
window.openTransactionModal = openTransactionModal;
window.setModalTxType = setModalTxType;
window.setPresetAmount = setPresetAmount;
