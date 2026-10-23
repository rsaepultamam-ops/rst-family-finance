/**
 * Format number to Indonesian Rupiah (e.g., Rp 1.500.000)
 * @param {number|string} amount 
 * @returns {string}
 */
function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Format Date to Indonesian format: 23 Oktober 2026
 * @param {string|Date} date 
 * @returns {string}
 */
function formatDateIndo(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format Date to short format: 23/10/2026
 * @param {string|Date} date 
 * @returns {string}
 */
function formatDateShort(date) {
  if (!date) return '-';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = {
  formatRupiah,
  formatDateIndo,
  formatDateShort
};
