const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hash plain password
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain password with hash
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return await bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};
