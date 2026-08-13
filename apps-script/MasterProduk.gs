/**
 * MasterProduk.gs
 * -----------------------------------------------------------------------------
 * MASTER_PRODUK is an indexed lookup table. The category sheets remain the
 * single source of truth for product data. This module builds/refreshes the
 * index by scanning all category sheets.
 */

/**
 * Ensure the MASTER_PRODUK sheet exists with headers.
 * @param {Spreadsheet} ss
 * @returns {Sheet}
 */
function ensureMasterSheet_(ss) {
  var headers = ['SKU', 'Produk', 'Kategori', 'Sheet', 'Baris'];
  return getOrCreateSheet_(ss, CONFIG.MASTER_SHEET, headers);
}

/**
 * Synchronize MASTER_PRODUK from all category sheets.
 * For each category sheet, reads columns A (SKU) and B (Produk) starting at
 * row 2, and writes one index row per product: SKU, Produk, Kategori(sheet name),
 * Sheet (same), Baris (source row number).
 *
 * Uses a single batch read per sheet and a single batch write to MASTER_PRODUK.
 * @returns {{success: boolean, data: {count: number, categories: Array}}}
 */
function syncMasterProduk() {
  try {
    var ss = getSpreadsheet_();
    var master = ensureMasterSheet_(ss);
    var categoryNames = discoverCategorySheets_(ss);

    var indexRows = [];
    var col = CONFIG.COLUMNS;

    for (var i = 0; i < categoryNames.length; i++) {
      var sheetName = categoryNames[i];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue; // header only
      // Read SKU (A) and Produk (B), rows 2..lastRow.
      var range = sheet.getRange(2, col.SKU, lastRow - 1, 2);
      var values = range.getValues();
      for (var r = 0; r < values.length; r++) {
        var sku = normalizeSku_(values[r][0]);
        var produk = values[r][1];
        if (!sku) continue; // skip blank rows
        var sourceRow = r + 2; // 1-based, header is row 1
        indexRows.push([sku, produk, sheetName, sheetName, sourceRow]);
      }
    }

    // Batch rewrite of MASTER_PRODUK (preserve header).
    var masterLastRow = master.getLastRow();
    if (masterLastRow > 1) {
      master.getRange(2, 1, masterLastRow - 1, CONFIG.MASTER_COLUMNS.BARIS).clearContent();
    }
    if (indexRows.length > 0) {
      master.getRange(2, 1, indexRows.length, indexRows[0].length).setValues(indexRows);
    }

    return successResponse_({
      count: indexRows.length,
      categories: categoryNames
    });
  } catch (err) {
    return handleError_('Gagal menyinkronkan MASTER_PRODUK.', err);
  }
}

/**
 * Find a product in MASTER_PRODUK by normalized SKU.
 * Returns { sku, produk, kategori, sheet, baris } or null.
 * Uses the in-memory index for fast O(n) lookup (single batch read).
 * @param {string} rawSku
 * @returns {Object|null}
 */
function findProductInMaster_(rawSku) {
  var ss = getSpreadsheet_();
  var master = ss.getSheetByName(CONFIG.MASTER_SHEET);
  if (!master) return null;
  var target = normalizeSku_(rawSku);
  if (!target) return null;

  var lastRow = master.getLastRow();
  if (lastRow < 2) return null;
  var mc = CONFIG.MASTER_COLUMNS;
  var values = master.getRange(2, 1, lastRow - 1, mc.BARIS).getValues();
  for (var i = 0; i < values.length; i++) {
    var sku = normalizeSku_(values[i][mc.SKU - 1]);
    if (sku === target) {
      return {
        sku: values[i][mc.SKU - 1],
        produk: values[i][mc.PRODUK - 1],
        kategori: values[i][mc.KATEGORI - 1],
        sheet: values[i][mc.SHEET - 1],
        baris: values[i][mc.BARIS - 1]
      };
    }
  }
  return null;
}

/**
 * Search MASTER_PRODUK by SKU or product name (case-insensitive, substring).
 * @param {string} query
 * @returns {Array<Object>} list of { sku, produk, kategori, sheet, baris }
 */
function searchMasterProduk_(query) {
  var ss = getSpreadsheet_();
  var master = ss.getSheetByName(CONFIG.MASTER_SHEET);
  if (!master) return [];
  var q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  var lastRow = master.getLastRow();
  if (lastRow < 2) return [];
  var mc = CONFIG.MASTER_COLUMNS;
  var values = master.getRange(2, 1, lastRow - 1, mc.BARIS).getValues();
  var results = [];
  for (var i = 0; i < values.length; i++) {
    var sku = String(values[i][mc.SKU - 1] || '');
    var produk = String(values[i][mc.PRODUK - 1] || '');
    if (sku.toLowerCase().indexOf(q) !== -1 || produk.toLowerCase().indexOf(q) !== -1) {
      results.push({
        sku: sku,
        produk: produk,
        kategori: values[i][mc.KATEGORI - 1],
        sheet: values[i][mc.SHEET - 1],
        baris: values[i][mc.BARIS - 1]
      });
    }
  }
  return results;
}
