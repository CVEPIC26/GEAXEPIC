/**
 * Api.gs
 * -----------------------------------------------------------------------------
 * HTTP entry points (doGet / doPost). The frontend talks to these.
 *
 * Action dispatch (action query param or JSON body field):
 *   getProductBySku         -> { sku }
 *   searchProducts          -> { query }
 *   savePhysicalCount       -> { sku, fisikHitung, user? }
 *   getDashboard            -> {}
 *   getProductsNotChecked   -> {}
 *   getProductsWithDifference -> { category? }
 *   getCategories           -> {}
 *   syncMasterProduk        -> {}
 *   resetSO                 -> { confirm }
 *   getSOStatus             -> {}
 *   startSession            -> { sessionId? }
 *   endSession              -> {}
 *   getSessions             -> {}
 *
 * All responses are JSON: { success: boolean, data?|message? }
 */

var ACTIONS = {
  'getProductBySku': function (p) { return getProductBySku(p.sku); },
  'searchProducts': function (p) { return searchProducts(p.query); },
  'savePhysicalCount': function (p) { return savePhysicalCount(p); },
  'getDashboard': function (p) { return getDashboard(); },
  'getProductsNotChecked': function (p) { return getProductsNotChecked(); },
  'getProductsWithDifference': function (p) { return getProductsWithDifference(p && p.category); },
  'getCategories': function (p) { return getCategories(); },
  'syncMasterProduk': function (p) { return syncMasterProduk(); },
  'resetSO': function (p) { return resetSO(p && p.confirm === true); },
  'getSOStatus': function (p) { return getSOStatus(); },
  'startSession': function (p) { return startSession(p && p.sessionId); },
  'endSession': function (p) { return endSession(); },
  'getSessions': function (p) { return getSessions(); }
};

/**
 * GET entry point.
 * /exec?action=getDashboard
 * /exec?action=getProductBySku&sku=100042
 */
function doGet(e) {
  return handleRequest_(e, 'get');
}

/**
 * POST entry point. Body may be JSON or form-encoded.
 */
function doPost(e) {
  return handleRequest_(e, 'post');
}

/**
 * Shared request handler.
 */
function handleRequest_(e, method) {
  var params = {};
  try {
    if (method === 'post') {
      var body = e && e.postData && e.postData.contents ? e.postData.contents : '';
      var ctype = e && e.postData && e.postData.type ? e.postData.type : '';
      if (body) {
        if (ctype.indexOf('application/json') !== -1) {
          try { params = JSON.parse(body); } catch (jsonErr) { params = {}; }
        } else {
          // form-encoded
          try { params = parseForm_(body); } catch (fe) { params = {}; }
        }
      }
    }
    // Merge query string params (works for both GET and POST).
    if (e && e.parameter) {
      for (var k in e.parameter) {
        if (e.parameter.hasOwnProperty(k)) params[k] = e.parameter[k];
      }
    }
  } catch (parseErr) {
    return jsonOut_(errorResponse_('Permintaan tidak valid.'));
  }

  var action = params.action;
  if (!action || !ACTIONS[action]) {
    return jsonOut_(errorResponse_('Action tidak dikenal: ' + (action || '(kosong)')));
  }

  var result;
  try {
    result = ACTIONS[action](params);
  } catch (err) {
    result = handleError_('Kesalahan memproses permintaan.', err);
  }
  return jsonOut_(result);
}

/**
 * Serialize a response object as a JSON ContentService output.
 * Uses JSONP-style callback if provided (for dev/fallback).
 */
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Minimal form-encoded body parser.
 */
function parseForm_(body) {
  var out = {};
  if (!body) return out;
  var pairs = String(body).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var eq = pairs[i].indexOf('=');
    if (eq === -1) continue;
    var key = decodeURIComponent(pairs[i].substring(0, eq).replace(/\+/g, ' '));
    var val = decodeURIComponent(pairs[i].substring(eq + 1).replace(/\+/g, ' '));
    out[key] = val;
  }
  return out;
}
