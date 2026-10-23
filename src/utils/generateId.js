/**
 * Generate unique transaction ID with format TRX-YYYYMMDD-XXXX
 * @param {Date} date 
 * @returns {string}
 */
function generateTransactionId(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString().slice(-3);
  return `TRX-${year}${month}${day}-${timestamp}${randomSuffix}`;
}

/**
 * Generate User ID with format USR-XXX
 * @param {number} sequence 
 * @returns {string}
 */
function generateUserId(sequence = 1) {
  return `USR-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate Category ID with format CAT-XXX
 * @param {number} sequence 
 * @returns {string}
 */
function generateCategoryId(sequence = 1) {
  return `CAT-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate Log ID with format LOG-YYYYMMDD-XXXX
 */
function generateLogId() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOG-${dateStr}-${rand}`;
}

module.exports = {
  generateTransactionId,
  generateUserId,
  generateCategoryId,
  generateLogId
};
