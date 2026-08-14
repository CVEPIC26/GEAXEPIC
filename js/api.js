/* api.js — Frontend API client for the EPIC x GEA Stock Opname Apps Script backend.
 * Talks to the Apps Script Web App (exec URL) via JSONP-free fetch + no-cors
 * GET for idempotent reads, and POST for writes.
 *
 * Apps Script ContentService returns JSON; fetch with `redirect: 'follow'`.
 * Reads use GET (with action + params). Writes use POST (JSON body).
 */

const SO_API = (function () {
  const STORAGE_KEY = 'epic_gea_so_api_url';
  let apiUrl = localStorage.getItem(STORAGE_KEY) || '';

  function setApiUrl(url) {
    apiUrl = (url || '').trim();
    if (apiUrl) localStorage.setItem(STORAGE_KEY, apiUrl);
    else localStorage.removeItem(STORAGE_KEY);
  }
  function getApiUrl() { return apiUrl; }
  function isConfigured() { return !!apiUrl; }

  function withParam(url, key, val) {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + encodeURIComponent(key) + '=' + encodeURIComponent(val);
  }

  /**
   * Call the backend. GET for reads, POST for writes.
   * @param {string} action
   * @param {Object} params  payload (sent as JSON for POST, query for GET)
   * @param {Object} opts { method?: 'GET'|'POST', timeoutMs?: number }
   */
  async function call(action, params, opts) {
    opts = opts || {};
    if (!apiUrl) throw new ApiError('API belum dikonfigurasi. Buka Pengaturan untuk mengatur URL Web App.');
    params = params || {};
    params.action = action;
    const usePost = (opts.method || 'POST').toUpperCase() === 'POST' || action === 'savePhysicalCount';

    try {
      let res;
      const ctrl = new AbortController();
      const timeoutMs = opts.timeoutMs || 25000;
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        if (usePost) {
          // Send ALL params as query string AND as JSON body.
          // The JSON body is the primary payload for the current backend
          // (parseBody_). The query string is a fallback so that older
          // deployed backends — which only parse application/json bodies and
          // would ignore our text/plain body — still receive every field
          // (action, sku, fisikHitung, ...) via e.parameter. This makes the
          // client work against any backend version without a CORS preflight.
          var postUrl = apiUrl;
          Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null) postUrl = withParam(postUrl, k, params[k]);
          });
          res = await fetch(postUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(params),
            signal: ctrl.signal
          });
        } else {
          let url = apiUrl;
          Object.keys(params).forEach((k) => {
            if (params[k] !== undefined && params[k] !== null) url = withParam(url, k, params[k]);
          });
          res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
        }
      } finally {
        clearTimeout(t);
      }

      if (!res.ok) {
        // Google Apps Script /exec URLs redirect to script.googleusercontent.com;
        // a 404/401/403 there means the deployment or authorization is wrong,
        // not that our code is broken. Give an actionable message.
        var hint = '';
        if (res.status === 404 || res.status === 401 || res.status === 403) {
          hint = ' Web App belum ter-deploy atau belum diotorisasi. Di Apps Script: Deploy → Manage deployments → pastikan ada deployment "Web app" (Execute as: Me, Access: Anyone with the link), lalu tempel URL yang berakhiran /exec.';
        }
        throw new ApiError('Server merespons kesalahan (' + res.status + ').' + hint);
      }
      const text = await res.text();
      let json;
      // Apps Script may wrap errors in an HTML page when not authorized.
      if (text && text.trim().charAt(0) !== '{' && text.trim().charAt(0) !== '[') {
        var authHint = /sign in|authorize|permission|need permission|masuk|otorisasi/i.test(text)
          ? ' Akses Web App belum diotorisasi. Buka URL /exec langsung di browser, izinkan akses, lalu coba lagi.'
          : '';
        throw new ApiError('Respons server tidak valid (bukan JSON).' + authHint);
      }
      try { json = JSON.parse(text); }
      catch (e) { throw new ApiError('Respons server tidak valid (JSON rusak).'); }

      if (json && json.success === false) {
        var msg = json.message || 'Operasi gagal.';
        // Backend returns "Action tidak dikenal" when the deployed Apps Script
        // is outdated and doesn't recognize the requested action. Give the user
        // a clear, actionable hint instead of a confusing error.
        if (/tidak dikenal/i.test(msg)) {
          msg += '\n\nKemungkinan: code Apps Script yang ter-deploy belum versi terbaru. Jalankan clasp push lalu Deploy → Manage deployments → New version → Deploy, lalu coba lagi.';
        }
        throw new ApiError(msg);
      }
      return json ? json.data : null;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') throw new ApiError('Permintaan timeout. Periksa koneksi lalu coba lagi.');
      throw new ApiError('Gagal terhubung ke server. Periksa koneksi jaringan dan URL Web App.');
    }
  }

  class ApiError extends Error {
    constructor(msg) { super(msg); this.name = 'ApiError'; }
  }

  return {
    setApiUrl, getApiUrl, isConfigured,
    ApiError,
    // Lightweight connectivity + authorization check. Calls getSOStatus.
    // Resolves to { ok: true, data } or rejects with an ApiError hint.
    testConnection: () => call('getSOStatus', {}, { method: 'GET' }),
    getProductBySku: (sku) => call('getProductBySku', { sku }, { method: 'GET' }),
    searchProducts: (query) => call('searchProducts', { query }, { method: 'GET' }),
    savePhysicalCount: (data) => call('savePhysicalCount', data, { method: 'POST' }),
    getDashboard: () => call('getDashboard', {}, { method: 'GET' }),
    getProductsNotChecked: () => call('getProductsNotChecked', {}, { method: 'GET' }),
    getProductsWithDifference: (category) => call('getProductsWithDifference', { category: category || '' }, { method: 'GET' }),
    getCategories: () => call('getCategories', {}, { method: 'GET' }),
    syncMasterProduk: () => call('syncMasterProduk', {}, { method: 'POST' }),
    resetSO: () => call('resetSO', { confirm: true }, { method: 'POST' }),
    getSOStatus: () => call('getSOStatus', {}, { method: 'GET' }),
    startSession: (sessionId) => call('startSession', { sessionId: sessionId || '' }, { method: 'POST' }),
    endSession: () => call('endSession', {}, { method: 'POST' }),
    getSessions: () => call('getSessions', {}, { method: 'GET' }),
    setSpreadsheetId: (spreadsheetId) => call('setSpreadsheetId', { spreadsheetId: spreadsheetId || '' }, { method: 'POST' }),
    clearSpreadsheetId: () => call('clearSpreadsheetId', {}, { method: 'POST' }),
    getSpreadsheetInfo: () => call('getSpreadsheetInfo', {}, { method: 'GET' })
  };
})();
