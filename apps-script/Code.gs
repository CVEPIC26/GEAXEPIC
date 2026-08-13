/**
 * Code.gs
 * -----------------------------------------------------------------------------
 * Top-level entry file for the EPIC x GEA Stock Opname Apps Script project.
 *
 * HTTP entry points (doGet / doPost) live in Api.gs. This file provides:
 *   - Spreadsheet custom menu (for bound projects)
 *   - One-time setup helper (ensureMasterProduk, ensureLog, ensureSession)
 *   - doNotRequireInstall note
 */

/**
 * Add a custom menu when the script is bound to a spreadsheet.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('EPIC x GEA SO')
      .addItem('Setup / Inisialisasi Sheet', 'setupSheets')
      .addItem('Sinkronkan MASTER_PRODUK', 'runSyncMasterProduk')
      .addItem('Mulai Sesi SO Baru', 'runStartSession')
      .addItem('Akhiri Sesi SO', 'runEndSession')
      .addToUi();
  } catch (e) {
    // getUi() only works for bound projects; ignore in standalone.
  }
}

/**
 * One-time setup: ensure all required sheets exist with headers.
 */
function setupSheets() {
  try {
    var ss = getSpreadsheet_();
    // MASTER_PRODUK
    getOrCreateSheet_(ss, CONFIG.MASTER_SHEET, ['SKU', 'Produk', 'Kategori', 'Sheet', 'Baris']);
    // LOG_SO
    getOrCreateSheet_(ss, CONFIG.LOG_SHEET, ['Timestamp', 'SKU', 'Produk', 'Kategori', 'Fisik Sistem', 'Fisik Hitung', 'Selisih', 'Status', 'User']);
    // SO_SESSION
    getOrCreateSheet_(ss, CONFIG.SESSION_SHEET, ['Session ID', 'Start Time', 'End Time', 'Status', 'User']);
    // DASHBOARD_SO (optional, dashboard is computed live; create placeholder)
    getOrCreateSheet_(ss, CONFIG.DASHBOARD_SHEET, ['Kategori', 'Total SKU', 'Sudah Cek', 'Belum Cek', 'Sesuai', 'Kurang', 'Lebih', 'Progress']);
    return successResponse_({ setup: true });
  } catch (err) {
    return handleError_('Gagal melakukan setup sheet.', err);
  }
}

/** Menu wrappers (return JSON to UI when possible). */
function runSyncMasterProduk() {
  var r = syncMasterProduk();
  try { SpreadsheetApp.getUi().alert('MASTER_PRODUK disinkronkan: ' + (r.success ? r.data.count + ' produk' : r.message)); } catch (e) {}
  return r;
}
function runStartSession() {
  var r = startSession();
  try { SpreadsheetApp.getUi().alert('Sesi SO dimulai: ' + (r.success ? r.data.sessionId : r.message)); } catch (e) {}
  return r;
}
function runEndSession() {
  var r = endSession();
  try { SpreadsheetApp.getUi().alert('Sesi SO diakhiri: ' + (r.success ? 'OK' : r.message)); } catch (e) {}
  return r;
}
