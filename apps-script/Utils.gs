/**
 * Utils.gs
 * -----------------------------------------------------------------------------
 * Shared helpers: normalization, validation, sheet access, response building,
 * status computation, and user/email capture.
 */

/**
 * Build a standard success response object.
 * @param {Object} data
 * @returns {{success: boolean, data: Object}}
 */
function successResponse_(data) {
  return { success: true, data: data || {} };
}

/**
 * Build a standard error response object. Never exposes stack traces.
 * @param {string} message
 * @returns {{success: boolean, message: string}}
 */
function errorResponse_(message) {
  return { success: false, message: message || 'Terjadi kesalahan.' };
}

/**
 * Normalize a SKU/barcode to a safe comparable string.
 * Trims whitespace, collapses internal spaces, removes zero-width chars.
 * Returns empty string if input is null/undefined/NaN.
 * @param {*} sku
 * @returns {string}
 */
function normalizeSku_(sku) {
  if (sku === null || sku === undefined || sku === '') return '';
  var s = String(sku)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ')
    .trim();
  // Preserve original format; do NOT force uppercase (some SKUs are case-sensitive).
  return s;
}

/**
 * Parse a value into a non-negative integer physical count.
 * Accepts numbers or numeric strings. Returns null if invalid/negative.
 * @param {*} value
 * @returns {number|null}
 */
function parsePhysicalCount_(value) {
  if (value === null || value === undefined || value === '') return null;
  // Reject booleans and objects outright.
  if (typeof value === 'boolean' || typeof value === 'object') return null;
  var n = Number(value);
  if (!isFinite(n)) return null;
  // Must be a whole number (allow trailing .0).
  if (Math.floor(n) !== n) return null;
  if (n < 0) return null;
  return n;
}

/**
 * Parse a value into a non-negative integer system stock.
 * Treats empty/invalid as 0 (system stock should exist; fallback to 0).
 * @param {*} value
 * @returns {number}
 */
function parseSystemStock_(value) {
  if (value === null || value === undefined || value === '') return 0;
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Compute difference and status from physical count vs system stock.
 * @param {number} physicalCount  (must be a valid >=0 integer, null = belum cek)
 * @param {number} systemStock
 * @returns {{selisih: number|null, status: string}}
 */
function computeStatus_(physicalCount, systemStock) {
  if (physicalCount === null) {
    return { selisih: null, status: CONFIG.STATUS.BELUM_CEK };
  }
  var selisih = physicalCount - systemStock;
  var status;
  if (selisih === 0) status = CONFIG.STATUS.SESUAI;
  else if (selisih < 0) status = CONFIG.STATUS.KEKURANGAN;
  else status = CONFIG.STATUS.KELEBIHAN;
  return { selisih: selisih, status: status };
}

/**
 * Get a sheet by name, creating it with headers if missing.
 * @param {Spreadsheet} ss
 * @param {string} name
 * @param {Array<string>} headers  optional headers to set on creation
 * @returns {Sheet|null}
 */
function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  if (headers && headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Get the list of actual category sheet names by inspecting spreadsheet tabs.
 * Excludes reserved sheets. A "category sheet" is any non-reserved sheet that
 * looks like a product sheet (has a header row with SKU / Produk).
 * @param {Spreadsheet} ss
 * @returns {Array<string>}
 */
function discoverCategorySheets_(ss) {
  var sheets = ss.getSheets();
  var reserved = {};
  for (var i = 0; i < CONFIG.RESERVED_SHEETS.length; i++) {
    reserved[CONFIG.RESERVED_SHEETS[i].toUpperCase()] = true;
  }
  var result = [];
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (reserved[name.toUpperCase()]) continue;
    // Heuristic: must have a header row matching SKU/Produk to be a category sheet.
    var lastCol = sheets[s].getLastColumn();
    if (lastCol < 2) continue;
    var header = sheets[s].getRange(1, 1, 1, Math.min(lastCol, 2)).getValues()[0];
    var h0 = String(header[0] || '').toLowerCase();
    var h1 = String(header[1] || '').toLowerCase();
    if (h0.indexOf('sku') !== -1 || h1.indexOf('produk') !== -1) {
      result.push(name);
    }
  }
  return result;
}

/**
 * Get the active user email (Session effective email) or 'Anonymous'.
 * @returns {string}
 */
function getUserEmail_() {
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (email && email.length > 0) return email;
  } catch (e) {
    // Some executions cannot resolve the email.
  }
  return 'Anonymous';
}

/**
 * Log a JSON response to the Apps Script console (for debugging).
 * @param {*} obj
 */
function log_(obj) {
  if (typeof obj === 'object') {
    Logger.log(JSON.stringify(obj));
  } else {
    Logger.log(obj);
  }
}

/**
 * Generic catch wrapper: returns an error response and logs the exception.
 * Never exposes raw stack to users.
 * @param {string} friendlyMessage
 * @param {Error} err
 * @returns {{success: boolean, message: string}}
 */
function handleError_(friendlyMessage, err) {
  log_('ERROR: ' + friendlyMessage + ' :: ' + (err && err.message ? err.message : err));
  return errorResponse_(friendlyMessage);
}
