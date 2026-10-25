/**
 * RST Family Finance - Categories Management Module
 */

let selectedCategoryEmoji = '📁';
let selectedCategoryColor = '#3B82F6';

const POPULAR_EMOJIS = [
  '🍚', '🍔', '☕', '🚗', '⛽', '🏠', '💡', '📱', '🏥', '💊',
  '🎓', '📚', '👕', '🛍️', '🎉', '🎮', '🤝', '💰', '💵', '💼',
  '🏪', '🎁', '🏖️', '✈️', '🛒', '👶', '🐾', '🧹', '📦', '⭐'
];

const CURATED_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', '#AB47BC', '#EF5350',
  '#5C6BC0', '#EC407A', '#FFA000', '#66BB6A', '#26A69A', '#78909C',
  '#10B981', '#059669', '#3B82F6', '#8B5CF6'
];

async function loadCategoriesPage() {
  const expGrid = document.getElementById('cat-grid-pengeluaran');
  const incGrid = document.getElementById('cat-grid-pemasukan');

  // Loading state
  if (expGrid && (!expGrid.children.length || expGrid.innerText.includes('Belum ada'))) {
    expGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 16px; grid-column: 1 / -1;">⏳ Memuat kategori pengeluaran...</div>';
  }
  if (incGrid && (!incGrid.children.length || incGrid.innerText.includes('Belum ada'))) {
    incGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 16px; grid-column: 1 / -1;">⏳ Memuat kategori pemasukan...</div>';
  }

  try {
    const res = await API.get('/api/categories?includeInactive=true');
    const categories = res.data || [];
    window.allCategoriesCache = categories;
    if (typeof allCategoriesCache !== 'undefined') {
      allCategoriesCache = categories;
    }

    const expenses = categories.filter(c => c.Tipe === 'Pengeluaran');
    const incomes = categories.filter(c => c.Tipe === 'Pemasukan');

    if (expGrid) {
      if (expenses.length > 0) {
        expGrid.innerHTML = expenses.map(c => renderCategoryCard(c)).join('');
      } else {
        expGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-light); border-radius: var(--radius-md);">
            <p style="margin-bottom: 8px;">Belum ada kategori pengeluaran.</p>
            <button type="button" class="btn-secondary" style="font-size: 12px; padding: 4px 12px;" onclick="loadCategoriesPage()">🔄 Muat Ulang</button>
          </div>
        `;
      }
    }

    if (incGrid) {
      if (incomes.length > 0) {
        incGrid.innerHTML = incomes.map(c => renderCategoryCard(c)).join('');
      } else {
        incGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-light); border-radius: var(--radius-md);">
            <p style="margin-bottom: 8px;">Belum ada kategori pemasukan.</p>
            <button type="button" class="btn-secondary" style="font-size: 12px; padding: 4px 12px;" onclick="loadCategoriesPage()">🔄 Muat Ulang</button>
          </div>
        `;
      }
    }

  } catch (err) {
    console.error('Error loading categories:', err);
    showToast('Gagal memuat kategori: ' + err.message, 'error');
    if (expGrid) expGrid.innerHTML = '<div style="color: var(--danger); font-size: 13px; padding: 12px; grid-column: 1 / -1;">Gagal memuat data kategori.</div>';
    if (incGrid) incGrid.innerHTML = '<div style="color: var(--danger); font-size: 13px; padding: 12px; grid-column: 1 / -1;">Gagal memuat data kategori.</div>';
  }
}


function renderCategoryCard(c) {
  const isCustom = c.Custom;
  const isActive = c.Aktif;

  return `
    <div class="category-card" style="border: 1px solid var(--border-light); background: var(--bg-surface); border-radius: var(--radius-md); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; opacity: ${isActive ? '1' : '0.5'};">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 42px; height: 42px; border-radius: 10px; background: ${c.Warna}20; color: ${c.Warna}; display: flex; align-items: center; justify-content: center; font-size: 20px;">
          ${c.Ikon}
        </div>
        <div>
          <strong style="font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            ${c.Nama}
            ${isCustom ? '<span style="font-size: 10px; background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 99px;">Custom</span>' : ''}
            ${!isActive ? '<span style="font-size: 10px; background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 99px;">Nonaktif</span>' : ''}
          </strong>
          <span style="font-size: 11px; color: var(--text-muted); display: block;">${c.Tipe}</span>
        </div>
      </div>
      <div>
        ${isActive ? `
          <button class="btn-icon-action delete" title="Nonaktifkan Kategori" onclick="deactivateCategoryPrompt('${c.ID}', '${c.Nama}')">🚫</button>
        ` : `
          <button class="btn-icon-action" title="Aktifkan Kembali" onclick="reactivateCategory('${c.ID}')">🔄</button>
        `}
      </div>
    </div>
  `;
}

function openAddCategoryModal() {
  const form = document.getElementById('form-add-category');
  if (form) form.reset();

  selectedCategoryEmoji = '📁';
  selectedCategoryColor = '#3B82F6';
  updateCategoryPreview();

  // Render emoji picker palette
  const emojiPalette = document.getElementById('emoji-palette');
  if (emojiPalette) {
    emojiPalette.innerHTML = POPULAR_EMOJIS.map(e => `
      <button type="button" class="btn-emoji-select ${e === selectedCategoryEmoji ? 'active' : ''}" onclick="selectEmoji('${e}', this)">
        ${e}
      </button>
    `).join('');
  }

  // Render color picker palette
  const colorPalette = document.getElementById('color-palette');
  if (colorPalette) {
    colorPalette.innerHTML = CURATED_COLORS.map(col => `
      <button type="button" class="btn-color-select ${col === selectedCategoryColor ? 'active' : ''}" style="background-color: ${col};" onclick="selectColor('${col}', this)">
      </button>
    `).join('');
  }

  openModal('modal-add-category');
}

function selectEmoji(emoji, btn) {
  selectedCategoryEmoji = emoji;
  document.querySelectorAll('.btn-emoji-select').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateCategoryPreview();
}

function selectColor(color, btn) {
  selectedCategoryColor = color;
  document.querySelectorAll('.btn-color-select').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateCategoryPreview();
}

function updateCategoryPreview() {
  const nameInput = document.getElementById('modal-cat-nama');
  const name = nameInput?.value || 'Nama Kategori';
  const previewBox = document.getElementById('cat-preview-box');

  if (previewBox) {
    previewBox.innerHTML = `
      <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 99px; background: ${selectedCategoryColor}15; border: 1.5px solid ${selectedCategoryColor};">
        <span style="font-size: 20px;">${selectedCategoryEmoji}</span>
        <strong style="color: ${selectedCategoryColor}; font-size: 14px;">${name}</strong>
      </div>
    `;
  }
}

async function deactivateCategoryPrompt(id, name) {
  if (!confirm(`Apakah Anda yakin ingin menonaktifkan kategori "${name}"? Kategori ini tidak akan muncul lagi di pilihan transaksi baru.`)) {
    return;
  }

  try {
    const res = await API.delete(`/api/categories/${id}`);
    if (res.success) {
      showToast(`Kategori "${name}" berhasil dinonaktifkan`, 'info');
      loadCategoriesPage();
    }
  } catch (err) {
    showToast(err.message || 'Gagal menonaktifkan kategori', 'error');
  }
}

async function reactivateCategory(id) {
  try {
    const res = await API.put(`/api/categories/${id}`, { aktif: true });
    if (res.success) {
      showToast('Kategori berhasil diaktifkan kembali', 'success');
      loadCategoriesPage();
    }
  } catch (err) {
    showToast(err.message || 'Gagal mengaktifkan kategori', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const catForm = document.getElementById('form-add-category');
  const nameInput = document.getElementById('modal-cat-nama');

  if (nameInput) {
    nameInput.addEventListener('input', updateCategoryPreview);
  }

  if (catForm) {
    catForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = nameInput.value.trim();
      const tipe = document.getElementById('modal-cat-tipe').value;

      if (!nama) {
        showToast('Nama kategori wajib diisi', 'warning');
        return;
      }

      try {
        const res = await API.post('/api/categories', {
          nama,
          tipe,
          ikon: selectedCategoryEmoji,
          warna: selectedCategoryColor
        });

        if (res.success) {
          showToast(`Kategori "${nama}" berhasil ditambahkan!`, 'success');
          closeModal('modal-add-category');
          catForm.reset();
          loadCategoriesPage();
          if (typeof loadDashboard === 'function') loadDashboard();
        }
      } catch (err) {
        showToast(err.message || 'Gagal menambahkan kategori', 'error');
      }
    });
  }
});

window.loadCategoriesPage = loadCategoriesPage;
window.openAddCategoryModal = openAddCategoryModal;
window.selectEmoji = selectEmoji;
window.selectColor = selectColor;
window.deactivateCategoryPrompt = deactivateCategoryPrompt;
window.reactivateCategory = reactivateCategory;
