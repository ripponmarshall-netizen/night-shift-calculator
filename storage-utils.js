/**
 * Safely reads a localStorage value.
 * @param {string} key
 * @returns {string|null}
 */
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely writes a localStorage value.
 * @param {string} key
 * @param {string} value
 */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/**
 * Safely removes a localStorage value.
 * @param {string} key
 */
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

window.NSStorage = { safeGet, safeSet, safeRemove };
