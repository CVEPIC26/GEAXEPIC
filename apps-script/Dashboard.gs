/**
 * Dashboard.gs
 * -----------------------------------------------------------------------------
 * Dashboard aggregation: overall summary + per-category breakdown.
 * Computed directly from category sheet data (single batch read per sheet).
 */

/**
 * Get the full dashboard: general summary + category breakdown.
 * @returns {{success: boolean, data?: Object}}
 */
function getDashboard() {
  try {
    var ss = getSpreadsheet_();
    var data = computeDashboardData_(ss);
    return successResponse_(data);
  } catch (err) {
    return handleError_('Gagal memuat dashboard.', err);
  }
}

/**
 * Compute dashboard data from category sheets.
 * @param {Spreadsheet} ss
 * @returns {{summary: Object, categories: Array}}
 */
function computeDashboardData_(ss) {
  var categoryNames = discoverCategorySheets_(ss);
  var col = CONFIG.COLUMNS;

  var totals = {
    totalSku: 0,
    sudahCek: 0,
    belumCek: 0,
    sesuai: 0,
    kekurangan: 0,
    kelebihan: 0
  };
  var categories = [];

  for (var i = 0; i < categoryNames.length; i++) {
    var sheet = ss.getSheetByName(categoryNames[i]);
    if (!sheet) continue;
    var lastRow = sheet.getLastRow();
    var cat = {
      kategori: categoryNames[i],
      totalSku: 0,
      sudahCek: 0,
      belumCek: 0,
      sesuai: 0,
      kurang: 0,
      lebih: 0
    };
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, col.STATUS).getValues();
      for (var r = 0; r < values.length; r++) {
        var sku = normalizeSku_(values[r][col.SKU - 1]);
        if (!sku) continue; // skip blank rows
        cat.totalSku++;
        totals.totalSku++;
        var physicalCount = parsePhysicalCount_(values[r][col.FISIK_HITUNG - 1]);
        var status = String(values[r][col.STATUS - 1] || '');
        if (physicalCount === null) {
          cat.belumCek++;
          totals.belumCek++;
        } else {
          cat.sudahCek++;
          totals.sudahCek++;
          if (status === CONFIG.STATUS.SESUAI) { cat.sesuai++; totals.sesuai++; }
          else if (status === CONFIG.STATUS.KEKURANGAN) { cat.kurang++; totals.kekurangan++; }
          else if (status === CONFIG.STATUS.KELEBIHAN) { cat.lebih++; totals.kelebihan++; }
        }
      }
    }
    cat.progress = cat.totalSku > 0 ? round2_((cat.sudahCek / cat.totalSku) * 100) : 0;
    categories.push(cat);
  }

  var summary = {
    totalSku: totals.totalSku,
    sudahCek: totals.sudahCek,
    belumCek: totals.belumCek,
    sesuai: totals.sesuai,
    kekurangan: totals.kekurangan,
    kelebihan: totals.kelebihan,
    progress: totals.totalSku > 0 ? round2_((totals.sudahCek / totals.totalSku) * 100) : 0
  };
  return { summary: summary, categories: categories };
}

/**
 * Round to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function round2_(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Get the list of category names (for filters / fallback).
 * @returns {{success: boolean, data?: {categories: Array}}}
 */
function getCategories() {
  try {
    var ss = getSpreadsheet_();
    var categoryNames = discoverCategorySheets_(ss);
    if (!categoryNames || categoryNames.length === 0) {
      // Fallback to config list if nothing discovered yet.
      categoryNames = CONFIG.FALLBACK_CATEGORIES.slice();
    }
    return successResponse_({ categories: categoryNames });
  } catch (err) {
    return handleError_('Gagal memuat kategori.', err);
  }
}

/**
 * Get SO session list (history).
 * @returns {{success: boolean, data?: {sessions: Array}}}
 */
function getSessions() {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(CONFIG.SESSION_SHEET);
    if (!sheet) return successResponse_({ sessions: [] });
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return successResponse_({ sessions: [] });
    var sc = CONFIG.SESSION_COLUMNS;
    var values = sheet.getRange(2, 1, lastRow - 1, sc.USER).getValues();
    var sessions = [];
    for (var i = 0; i < values.length; i++) {
      sessions.push({
        sessionId: values[i][sc.SESSION_ID - 1],
        startTime: values[i][sc.START_TIME - 1],
        endTime: values[i][sc.END_TIME - 1],
        status: values[i][sc.STATUS - 1],
        user: values[i][sc.USER - 1]
      });
    }
    return successResponse_({ sessions: sessions });
  } catch (err) {
    return handleError_('Gagal memuat sesi SO.', err);
  }
}

/**
 * Get the active (most recent non-ended) session, or the latest session.
 * @param {Spreadsheet} ss
 * @returns {Object|null}
 */
function getActiveSession_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SESSION_SHEET);
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var sc = CONFIG.SESSION_COLUMNS;
  var values = sheet.getRange(2, 1, lastRow - 1, sc.USER).getValues();
  // Return the last row.
  var last = values[values.length - 1];
  return {
    sessionId: last[sc.SESSION_ID - 1],
    startTime: last[sc.START_TIME - 1],
    endTime: last[sc.END_TIME - 1],
    status: last[sc.STATUS - 1],
    user: last[sc.USER - 1]
  };
}

/**
 * Start a new SO session. Idempotent if an active session already exists for
 * the same date; returns the existing one in that case.
 * @param {string} sessionId  optional; auto-generated if omitted (SO-YYYY-MM-DD)
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
function startSession(sessionId) {
  try {
    var ss = getSpreadsheet_();
    var headers = ['Session ID', 'Start Time', 'End Time', 'Status', 'User'];
    var sheet = getOrCreateSheet_(ss, CONFIG.SESSION_SHEET, headers);
    var today = new Date();
    var autoId = 'SO-' + formatYmd_(today);
    var id = (sessionId && String(sessionId).length > 0) ? String(sessionId) : autoId;

    // Avoid duplicate for same id today.
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existing = sheet.getRange(lastRow, 1, 1, 1).getValue();
      var existingStatus = sheet.getRange(lastRow, 4, 1, 1).getValue();
      if (String(existing) === id && String(existingStatus) === 'Aktif') {
        return successResponse_({ sessionId: id, startTime: sheet.getRange(lastRow, 2, 1, 1).getValue(), status: 'Aktif' });
      }
    }
    sheet.appendRow([id, today, '', 'Aktif', getUserEmail_()]);
    return successResponse_({ sessionId: id, startTime: today, status: 'Aktif' });
  } catch (err) {
    return handleError_('Gagal memulai sesi SO.', err);
  }
}

/**
 * End the active session (set End Time + Status = Selesai).
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
function endSession() {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(CONFIG.SESSION_SHEET);
    if (!sheet) return errorResponse_('Belum ada sesi SO.');
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return errorResponse_('Belum ada sesi SO.');
    sheet.getRange(lastRow, 3, 1, 1).setValue(new Date());
    sheet.getRange(lastRow, 4, 1, 1).setValue('Selesai');
    return successResponse_({ ended: true });
  } catch (err) {
    return handleError_('Gagal mengakhiri sesi SO.', err);
  }
}

/**
 * Format a Date as YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
function formatYmd_(d) {
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}
