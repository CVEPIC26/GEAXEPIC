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
          // Apps Script accepts POST JSON; text/plain avoids preflight CORS.
          res = await fetch(apiUrl, {
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

      if (!res.ok) throw new ApiError('Server merespons kesalahan (' + res.status + ').');
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch (e) { throw new ApiError('Respons server tidak valid.'); }

      if (json && json.success === false) {
        throw new ApiError(json.message || 'Operasi gagal.');
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
    getSessions: () => call('getSessions', {}, { method: 'GET' })
  };
})();
