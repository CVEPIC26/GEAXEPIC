/**
 * Config.gs
 * -----------------------------------------------------------------------------
 * Centralized configuration for the EPIC x GEA Stock Opname Apps Script backend.
 *
 * NOTE: SPREADSHEET_ID below is a placeholder. Replace it with the ID of your
 * actual Google Spreadsheet before deploying. The ID is the long string in the
 * sheet URL between /d/ and /edit, e.g.:
 *   https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
 *
 * You can also leave SPREADSHEET_ID empty ('') to use the spreadsheet the
 * script is bound to (when deployed as a container-bound script).
 */

var CONFIG = {
  // ---- Spreadsheet ------------------------------------------------------
  // Set to '' to use the bound spreadsheet (container-bound project).
  // Otherwise paste the spreadsheet ID here.
  SPREADSHEET_ID: '',

  // ---- Sheet names ------------------------------------------------------
  MASTER_SHEET: 'MASTER_PRODUK',
  LOG_SHEET: 'LOG_SO',
  DASHBOARD_SHEET: 'DASHBOARD_SO',
  SESSION_SHEET: 'SO_SESSION',

  // ---- Category sheets (source of product data) -------------------------
  // Used as a FALLBACK only. The real category list is discovered at runtime
  // by scanning MASTER_PRODUK / spreadsheet tabs. Do NOT rely on this for
  // production product data.
  FALLBACK_CATEGORIES: [
    'MODUL',
    'SERAGAM',
    'PANDUAN',
    'POSTER',
    'TAS',
    'LAIN-LAIN'
  ],

  // ---- Reserved / non-category sheets (excluded from category discovery) -
  RESERVED_SHEETS: [
    'MASTER_PRODUK',
    'LOG_SO',
    'DASHBOARD_SO',
    'SO_SESSION'
  ],

  // ---- Column layout for category sheets -------------------------------
  // All category sheets MUST share this exact structure.
  COLUMNS: {
    SKU: 1,          // A
    PRODUK: 2,       // B
    FISIK_SISTEM: 3,  // C
    FISIK_HITUNG: 4, // D
    SELISIH: 5,      // E
    STATUS: 6        // F
  },

  // ---- MASTER_PRODUK columns -------------------------------------------
  MASTER_COLUMNS: {
    SKU: 1,        // A
    PRODUK: 2,     // B
    KATEGORI: 3,   // C
    SHEET: 4,      // D
    BARIS: 5       // E
  },

  // ---- LOG_SO columns --------------------------------------------------
  LOG_COLUMNS: {
    TIMESTAMP: 1,    // A
    SKU: 2,          // B
    PRODUK: 3,       // C
    KATEGORI: 4,     // D
    FISIK_SISTEM: 5, // E
    FISIK_HITUNG: 6, // F
    SELISIH: 7,      // G
    STATUS: 8,       // H
    USER: 9          // I
  },

  // ---- SO_SESSION columns ----------------------------------------------
  SESSION_COLUMNS: {
    SESSION_ID: 1,  // A
    START_TIME: 2,   // B
    END_TIME: 3,     // C
    STATUS: 4,       // D
    USER: 5          // E
  },

  // ---- Status values ---------------------------------------------------
  STATUS: {
    BELUM_CEK: 'Belum Cek',
    SESUAI: 'Sesuai',
    KEKURANGAN: 'Kekurangan',
    KELEBIHAN: 'Kelebihan'
  },

  // ---- Locking ---------------------------------------------------------
  // Maximum milliseconds to wait when acquiring a LockService lock.
  LOCK_TIMEOUT_MS: 30000
};

/**
 * Resolve the active spreadsheet.
 *
 * Lookup order:
 *   1. A spreadsheet ID saved at runtime via setSpreadsheetId() (stored in
 *      Script Properties) — lets the operator switch files without redeploying.
 *   2. CONFIG.SPREADSHEET_ID (hard-coded at deploy time).
 *   3. The bound/active spreadsheet (container-bound projects).
 *
 * @returns {Spreadsheet}
 */
function getSpreadsheet_() {
  var storedId = getStoredSpreadsheetId_();
  if (storedId) {
    return SpreadsheetApp.openById(storedId);
  }
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.length > 0) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Read the runtime-overridden spreadsheet ID from Script Properties.
 * @returns {string}
 */
function getStoredSpreadsheetId_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SPREADSHEET_ID');
    return id && String(id).length > 0 ? String(id) : '';
  } catch (e) {
    return '';
  }
}

/**
 * Parse a raw input into a spreadsheet ID. Accepts either a bare ID or a
 * Google Sheets URL (docs.google.com/spreadsheets/d/ID/...). Returns '' if no
 * ID can be extracted.
 * @param {string} raw
 * @returns {string}
 */
function parseSpreadsheetId_(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  if (!s) return '';
  // Full URL form: .../d/<ID>/edit  (or /d/<ID>/export, etc.)
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  // Bare ID form: accept long alphanumeric tokens only.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

/**
 * Switch the backend to a different spreadsheet file at runtime.
 *
 * Accepts a bare spreadsheet ID or a full Google Sheets URL. Validates by
 * opening the file, then persists the ID to Script Properties so every later
 * request uses it. Returns the resolved ID + spreadsheet title.
 *
 * @param {string} raw  spreadsheet ID or URL
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
function setSpreadsheetId(raw) {
  try {
    var id = parseSpreadsheetId_(raw);
    if (!id) {
      return errorResponse_('ID/URL spreadsheet tidak valid. Tempel ID atau URL dari Google Sheets (https://docs.google.com/spreadsheets/d/.../edit).');
    }
    var ss = SpreadsheetApp.openById(id);
    if (!ss) {
      return errorResponse_('Spreadsheet tidak dapat dibuka. Pastikan script punya akses ke file tersebut.');
    }
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
    return successResponse_({
      spreadsheetId: id,
      title: ss.getName(),
      url: ss.getUrl()
    });
  } catch (err) {
    return handleError_('Gagal mengganti spreadsheet. Periksa ID/URL dan otorisasi akses file.', err);
  }
}

/**
 * Clear the runtime spreadsheet override, reverting to CONFIG.SPREADSHEET_ID /
 * the bound spreadsheet.
 * @returns {{success: boolean, data?: Object}}
 */
function clearSpreadsheetId() {
  try {
    PropertiesService.getScriptProperties().deleteProperty('SPREADSHEET_ID');
    return successResponse_({ cleared: true });
  } catch (err) {
    return handleError_('Gagal meriset spreadsheet.', err);
  }
}

/**
 * Return information about the currently active spreadsheet (resolved ID,
 * title, url, and whether it is a runtime override).
 * @returns {{success: boolean, data?: Object}}
 */
function getSpreadsheetInfo() {
  try {
    var storedId = getStoredSpreadsheetId_();
    var ss = getSpreadsheet_();
    return successResponse_({
      spreadsheetId: storedId || (CONFIG.SPREADSHEET_ID || ''),
      title: ss.getName(),
      url: ss.getUrl(),
      overridden: !!storedId
    });
  } catch (err) {
    return handleError_('Gagal memuat info spreadsheet.', err);
  }
}
