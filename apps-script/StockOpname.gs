/**
 * StockOpname.gs
 * -----------------------------------------------------------------------------
 * Core SO operations:
 *   - getProductBySku      (lookup + read current stock/count)
 *   - searchProducts       (manual search)
 *   - savePhysicalCount    (validate + write + log, with locking)
 *   - getProductsNotChecked
 *   - getProductsWithDifference
 *   - resetSO              (admin, protected)
 *   - getSOStatus
 */

/**
 * Lookup a product by SKU and return its current state from the source sheet.
 * @param {string} rawSku
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
function getProductBySku(rawSku) {
  try {
    var product = findProductInMaster_(rawSku);
    if (!product) {
      return errorResponse_('SKU tidak ditemukan. Silakan scan ulang atau cari produk secara manual.');
    }
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(product.sheet);
    if (!sheet) {
      return errorResponse_('Sheet kategori "' + product.sheet + '" tidak ditemukan.');
    }
    var row = Number(product.baris);
    if (!row || row < 2) {
      return errorResponse_('Baris sumber tidak valid untuk SKU ini.');
    }
    var col = CONFIG.COLUMNS;
    // Read A..F for this single source row.
    var rowValues = sheet.getRange(row, 1, 1, col.STATUS).getValues()[0];
    var systemStock = parseSystemStock_(rowValues[col.FISIK_SISTEM - 1]);
    var physicalRaw = rowValues[col.FISIK_HITUNG - 1];
    var physicalCount = parsePhysicalCount_(physicalRaw);
    var checked = (physicalCount !== null); // 0 is checked
    var st = computeStatus_(physicalCount, systemStock);

    return successResponse_({
      sku: product.sku,
      produk: product.produk,
      kategori: product.kategori,
      sheet: product.sheet,
      baris: product.baris,
      fisikSistem: systemStock,
      fisikHitung: checked ? physicalCount : null,
      checked: checked,
      selisih: st.selisih,
      status: st.status
    });
  } catch (err) {
    return handleError_('Gagal mencari produk.', err);
  }
}

/**
 * Search products by SKU or name.
 * @param {string} query
 * @returns {{success: boolean, data?: {results: Array}}}
 */
function searchProducts(query) {
  try {
    var results = searchMasterProduk_(query);
    return successResponse_({ results: results });
  } catch (err) {
    return handleError_('Gagal mencari produk.', err);
  }
}

/**
 * Save a physical count. This is the most critical write operation.
 *
 * Rules:
 *   - Lock before read/write (LockService).
 *   - Validate SKU, product, sheet, and physical count >= 0.
 *   - Physical count REPLACES previous (not additive).
 *   - 0 is a valid checked count.
 *   - Compute Selisih = Fisik Hitung - Fisik Sistem.
 *   - Update category sheet columns D (Fisik Hitung), E (Selisih), F (Status).
 *   - Do NOT modify A (SKU), B (Produk), C (Fisik Sistem).
 *   - Append ONE log row to LOG_SO (audit trail; not one per unit).
 *
 * @param {Object} data { sku, fisikHitung, user? }
 * @returns {{success: boolean, data?: Object, message?: string}}
 */
function savePhysicalCount(data) {
  try {
    data = data || {};
    var sku = normalizeSku_(data.sku);
    if (!sku) return errorResponse_('SKU tidak boleh kosong.');

    var physicalCount = parsePhysicalCount_(data.fisikHitung);
    if (physicalCount === null) {
      return errorResponse_('Jumlah fisik tidak valid. Masukkan angka 0 atau lebih besar.');
    }

    var lock = LockService.getScriptLock();
    var acquired = false;
    try {
      acquired = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    } catch (e) {
      return errorResponse_('Gagal mengunci operasi. Coba lagi sebentar.');
    }
    if (!acquired) {
      return errorResponse_('Operasi sedang berlangsung. Coba lagi sebentar.');
    }

    try {
      var product = findProductInMaster_(sku);
      if (!product) {
        return errorResponse_('SKU tidak ditemukan. Sinkronkan MASTER_PRODUK lalu coba lagi.');
      }
      var ss = getSpreadsheet_();
      var sheet = ss.getSheetByName(product.sheet);
      if (!sheet) {
        return errorResponse_('Sheet kategori "' + product.sheet + '" tidak ditemukan.');
      }
      var row = Number(product.baris);
      if (!row || row < 2) {
        return errorResponse_('Baris sumber tidak valid untuk SKU ini.');
      }

      // Read current system stock from source row (authoritative under lock).
      var col = CONFIG.COLUMNS;
      var rowValues = sheet.getRange(row, col.FISIK_SISTEM, 1, 1).getValues()[0];
      var systemStock = parseSystemStock_(rowValues[0]);

      var st = computeStatus_(physicalCount, systemStock);

      // Write only D, E, F (preserve A, B, C).
      sheet.getRange(row, col.FISIK_HITUNG, 1, 1).setValue(physicalCount);
      sheet.getRange(row, col.SELISIH, 1, 1).setValue(st.selisih);
      sheet.getRange(row, col.STATUS, 1, 1).setValue(st.status);

      // Append audit log (one result row).
      var user = data.user && String(data.user).length > 0 ? String(data.user) : getUserEmail_();
      appendLog_(ss, {
        sku: product.sku,
        produk: product.produk,
        kategori: product.kategori,
        fisikSistem: systemStock,
        fisikHitung: physicalCount,
        selisih: st.selisih,
        status: st.status,
        user: user
      });

      return successResponse_({
        sku: product.sku,
        produk: product.produk,
        kategori: product.kategori,
        sheet: product.sheet,
        baris: product.baris,
        fisikSistem: systemStock,
        fisikHitung: physicalCount,
        selisih: st.selisih,
        status: st.status
      });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return handleError_('Gagal menyimpan hasil.', err);
  }
}

/**
 * Append one audit row to LOG_SO.
 * @param {Spreadsheet} ss
 * @param {Object} entry
 */
function appendLog_(ss, entry) {
  var headers = ['Timestamp', 'SKU', 'Produk', 'Kategori', 'Fisik Sistem', 'Fisik Hitung', 'Selisih', 'Status', 'User'];
  var logSheet = getOrCreateSheet_(ss, CONFIG.LOG_SHEET, headers);
  var lc = CONFIG.LOG_COLUMNS;
  var row = [
    new Date(),
    entry.sku,
    entry.produk,
    entry.kategori,
    entry.fisikSistem,
    entry.fisikHitung,
    entry.selisih,
    entry.status,
    entry.user
  ];
  logSheet.appendRow(row);
}

/**
 * Get the full list of products not yet checked (physical count blank/invalid).
 * Products with physical count = 0 are NOT included (0 is checked).
 * @returns {{success: boolean, data?: {products: Array}}}
 */
function getProductsNotChecked() {
  try {
    var ss = getSpreadsheet_();
    var categoryNames = discoverCategorySheets_(ss);
    var col = CONFIG.COLUMNS;
    var products = [];

    for (var i = 0; i < categoryNames.length; i++) {
      var sheet = ss.getSheetByName(categoryNames[i]);
      if (!sheet) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;
      var values = sheet.getRange(2, 1, lastRow - 1, col.STATUS).getValues();
      for (var r = 0; r < values.length; r++) {
        var sku = normalizeSku_(values[r][col.SKU - 1]);
        if (!sku) continue;
        var produk = values[r][col.PRODUK - 1];
        var systemStock = parseSystemStock_(values[r][col.FISIK_SISTEM - 1]);
        var physicalCount = parsePhysicalCount_(values[r][col.FISIK_HITUNG - 1]);
        if (physicalCount === null) {
          // Not yet checked (blank or invalid). 0 is excluded here.
          products.push({
            sku: sku,
            produk: produk,
            kategori: categoryNames[i],
            fisikSistem: systemStock
          });
        }
      }
    }
    return successResponse_({ products: products });
  } catch (err) {
    return handleError_('Gagal memuat produk belum cek.', err);
  }
}

/**
 * Get products with differences (Kekurangan / Kelebihan).
 * Optionally filter by category.
 * @param {string} categoryFilter  optional category name
 * @returns {{success: boolean, data?: {products: Array}}}
 */
function getProductsWithDifference(categoryFilter) {
  try {
    var ss = getSpreadsheet_();
    var categoryNames = discoverCategorySheets_(ss);
    if (categoryFilter && String(categoryFilter).length > 0) {
      var filter = String(categoryFilter);
      categoryNames = categoryNames.filter(function (n) { return n === filter; });
    }
    var col = CONFIG.COLUMNS;
    var products = [];
    for (var i = 0; i < categoryNames.length; i++) {
      var sheet = ss.getSheetByName(categoryNames[i]);
      if (!sheet) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;
      var values = sheet.getRange(2, 1, lastRow - 1, col.STATUS).getValues();
      for (var r = 0; r < values.length; r++) {
        var sku = normalizeSku_(values[r][col.SKU - 1]);
        if (!sku) continue;
        var status = String(values[r][col.STATUS - 1] || '');
        if (status === CONFIG.STATUS.KEKURANGAN || status === CONFIG.STATUS.KELEBIHAN) {
          products.push({
            sku: sku,
            produk: values[r][col.PRODUK - 1],
            kategori: categoryNames[i],
            sistem: parseSystemStock_(values[r][col.FISIK_SISTEM - 1]),
            fisik: parsePhysicalCount_(values[r][col.FISIK_HITUNG - 1]),
            selisih: values[r][col.SELISIH - 1],
            status: status
          });
        }
      }
    }
    return successResponse_({ products: products });
  } catch (err) {
    return handleError_('Gagal memuat produk selisih.', err);
  }
}

/**
 * Reset current SO physical counts. Admin action; NEVER automatic.
 *
 * Clears columns D (Fisik Hitung), E (Selisih), F (Status) on every category
 * sheet. Preserves A (SKU), B (Produk), C (Fisik Sistem). Does NOT touch LOG_SO
 * history.
 *
 * @param {boolean} confirm  must be exactly true to proceed
 * @returns {{success: boolean, data?: {cleared: number}, message?: string}}
 */
function resetSO(confirmFlag) {
  try {
    if (confirmFlag !== true) {
      return errorResponse_('Konfirmasi reset diperlukan. Operasi dibatalkan.');
    }
    var lock = LockService.getScriptLock();
    var acquired = false;
    try {
      acquired = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    } catch (e) {
      return errorResponse_('Gagal mengunci operasi reset.');
    }
    if (!acquired) {
      return errorResponse_('Operasi lain sedang berlangsung. Coba lagi sebentar.');
    }
    try {
      var ss = getSpreadsheet_();
      var categoryNames = discoverCategorySheets_(ss);
      var col = CONFIG.COLUMNS;
      var cleared = 0;
      for (var i = 0; i < categoryNames.length; i++) {
        var sheet = ss.getSheetByName(categoryNames[i]);
        if (!sheet) continue;
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) continue;
        // Clear D..F for all data rows.
        sheet.getRange(2, col.FISIK_HITUNG, lastRow - 1, 3).clearContent();
        cleared += (lastRow - 1);
      }
      return successResponse_({ cleared: cleared, categories: categoryNames });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return handleError_('Gagal mereset SO.', err);
  }
}

/**
 * Get current SO status / metadata (active session + counts summary).
 * @returns {{success: boolean, data?: Object}}
 */
function getSOStatus() {
  try {
    var ss = getSpreadsheet_();
    var session = getActiveSession_(ss);
    var dash = computeDashboardData_(ss);
    return successResponse_({
      session: session,
      masterReady: !!ss.getSheetByName(CONFIG.MASTER_SHEET),
      summary: dash.summary
    });
  } catch (err) {
    return handleError_('Gagal memuat status SO.', err);
  }
}
