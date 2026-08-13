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
 * Resolve the active spreadsheet (bound or standalone via SPREADSHEET_ID).
 * @returns {Spreadsheet}
 */
function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.length > 0) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}
