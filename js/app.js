/* app.js — Main application controller for EPIC x GEA Stock Opname.
 * Handles page navigation, scan flow, product lookup, save, and lists.
 * UI labels are in Indonesian. Never clears user input before successful save.
 */

(function () {
  'use strict';

  // ---- State -------------------------------------------------------------
  let currentProduct = null; // product detail being edited
  let isSaving = false;
  let isScanning = false;
  let connected = false; // true only after a successful connection this session

  // ---- DOM helpers -------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const pages = document.querySelectorAll('.page');

  function showPage(name) {
    pages.forEach((p) => p.classList.toggle('active', p.getAttribute('data-page') === name));
    // Bottom nav active state
    document.querySelectorAll('.nav-item').forEach((n) =>
      n.classList.toggle('active', n.getAttribute('data-target') === name));
    window.scrollTo(0, 0);
  }

  function showLoading(text) {
    $('loadingText').textContent = text || 'Memproses...';
    $('loadingOverlay').classList.remove('hidden');
  }
  function hideLoading() { $('loadingOverlay').classList.add('hidden'); }

  let toastTimer = null;
  function toast(msg, type) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 2600);
  }

  function requireApi() {
    if (!SO_API.isConfigured()) {
      $('configBanner').classList.remove('hidden');
      toast('Atur URL Web App di Pengaturan terlebih dahulu.', 'error');
      showPage('more');
      return false;
    }
    return true;
  }

  function updateConfigBanner() {
    $('configBanner').classList.toggle('hidden', SO_API.isConfigured() || !connected);
  }

  // ---- Navigation --------------------------------------------------------
  document.querySelectorAll('[data-target]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const t = el.getAttribute('data-target');
      if (t) {
        e.preventDefault();
        if (!connected) {
          showPage('setup');
          toast('Hubungkan ke server terlebih dahulu.', 'error');
          return;
        }
        showPage(t);
        if (t === 'dashboard') loadDashboard();
      }
    });
  });

  // Bottom nav extra page loads
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.addEventListener('click', () => {
      if (!connected) return; // blocked by the data-target guard above
      const t = n.getAttribute('data-target');
      if (t === 'notchecked') loadNotChecked();
      if (t === 'difference') loadDifference();
      if (t === 'history') loadHistory();
    });
  });

  // ---- Scanner flow ------------------------------------------------------
  $('scanBtn').addEventListener('click', startScanner);
  $('cancelScanBtn').addEventListener('click', () => { SOScanner.stop(); showPage('scan'); });
  $('enterSkuBtn').addEventListener('click', () => { SOScanner.stop(); showPage('manual'); });
  $('retryScanBtn').addEventListener('click', startScanner);
  $('manualSearchBtn').addEventListener('click', () => showPage('manual'));
  $('notFoundScanUlang').addEventListener('click', startScanner);
  $('notFoundManual').addEventListener('click', () => showPage('manual'));

  async function startScanner() {
    if (!requireApi()) return;
    SOScanner.resetLast();
    showPage('scanner');
    $('scannerError').classList.add('hidden');
    $('retryScanBtn').classList.add('hidden');
    $('scannerVideo').classList.remove('hidden');
    try {
      await SOScanner.start($('scannerVideo'), handleScanned);
      isScanning = true;
    } catch (err) {
      showScannerError(err && err.message ? err.message : 'Gagal memulai kamera.');
    }
  }

  function showScannerError(msg) {
    isScanning = false;
    $('scannerVideo').classList.add('hidden');
    const box = $('scannerError');
    box.textContent = msg;
    box.classList.remove('hidden');
    $('retryScanBtn').classList.remove('hidden');
  }

  async function handleScanned(code) {
    isScanning = false;
    toast('Barcode terbaca: ' + code, 'success');
    await lookupAndShowProduct(code);
  }

  // ---- Product lookup ----------------------------------------------------
  async function lookupAndShowProduct(sku) {
    showLoading('Mencari produk...');
    try {
      const data = await SO_API.getProductBySku(sku);
      if (!data) { hideLoading(); toast('SKU tidak ditemukan.', 'error'); showNotFound(); return; }
      renderProductDetail(data);
      hideLoading();
      showPage('product');
    } catch (err) {
      hideLoading();
      if (err && err.message && err.message.indexOf('tidak ditemukan') !== -1) {
        showNotFound();
      } else {
        toast(err.message || 'Gagal mencari produk.', 'error');
        showPage('scan');
      }
    }
  }

  function showNotFound() {
    $('productInfo').classList.add('hidden');
    $('productForm').classList.add('hidden');
    $('productNotFound').classList.remove('hidden');
    showPage('product');
  }

  function renderProductDetail(data) {
    currentProduct = data;
    $('productNotFound').classList.add('hidden');
    const info = $('productInfo');
    const checked = !!data.checked || data.fisikHitung !== null && data.fisikHitung !== undefined;
    info.innerHTML = `
      <div class="pi-row"><span class="pi-label">SKU</span><span class="pi-value sku">${esc(data.sku)}</span></div>
      <div class="pi-row"><span class="pi-label">Produk</span><span class="pi-value pi-big">${esc(data.produk)}</span></div>
      <div class="pi-row"><span class="pi-label">Kategori</span><span class="pi-value">${esc(data.kategori)}</span></div>
      <div class="pi-row"><span class="pi-label">Fisik Sistem</span><span class="pi-value pi-big">${SODashboard.fmtNum(data.fisikSistem)}</span></div>
    `;
    info.classList.remove('hidden');

    const input = $('physicalInput');
    // Pre-fill previous physical count when re-scanning (replacement semantics).
    if (data.checked && data.fisikHitung !== null && data.fisikHitung !== undefined) {
      input.value = String(data.fisikHitung);
    } else {
      input.value = '';
    }
    $('saveError').classList.add('hidden');
    $('productForm').classList.remove('hidden');
    updatePreview();
    setTimeout(() => input.focus(), 80);
  }

  function updatePreview() {
    if (!currentProduct) return;
    const sistem = Number(currentProduct.fisikSistem) || 0;
    const raw = $('physicalInput').value;
    const fisik = raw === '' ? null : Number(raw);
    const valid = (raw !== '' && /^\d+$/.test(raw) && fisik >= 0);
    $('prevSistem').textContent = SODashboard.fmtNum(sistem);
    if (raw === '') {
      $('prevFisik').textContent = '–';
      $('prevSelisih').textContent = '–';
      $('prevStatus').textContent = 'Belum Cek';
    } else if (!valid) {
      $('prevFisik').textContent = 'tidak valid';
      $('prevSelisih').textContent = '–';
      $('prevStatus').textContent = '–';
    } else {
      const selisih = fisik - sistem;
      let status = 'Sesuai';
      if (selisih < 0) status = 'Kekurangan';
      else if (selisih > 0) status = 'Kelebihan';
      $('prevFisik').textContent = SODashboard.fmtNum(fisik);
      $('prevSelisih').textContent = (selisih > 0 ? '+' : '') + SODashboard.fmtNum(selisih);
      $('prevStatus').textContent = status;
    }
  }

  $('physicalInput').addEventListener('input', () => {
    // Strip non-numeric and prevent negative in real time.
    const v = $('physicalInput').value.replace(/[^\d]/g, '');
    $('physicalInput').value = v;
    updatePreview();
  });

  // ---- Save --------------------------------------------------------------
  $('saveBtn').addEventListener('click', saveCurrent);

  async function saveCurrent() {
    if (!currentProduct) return;
    if (isSaving) return;
    if (!requireApi()) return;
    const raw = $('physicalInput').value;
    const fisik = raw === '' ? null : Number(raw);
    if (raw === '' || fisik === null || !/^\d+$/.test(raw) || fisik < 0) {
      showError('Jumlah fisik tidak valid. Masukkan angka 0 atau lebih besar.');
      return;
    }
    isSaving = true;
    $('saveBtn').disabled = true;
    showLoading('Menyimpan hasil...');
    try {
      const res = await SO_API.savePhysicalCount({
        sku: currentProduct.sku,
        fisikHitung: fisik,
        user: currentUser
      });
      renderSaved(res);
      hideLoading();
      showPage('saved');
    } catch (err) {
      hideLoading();
      // IMPORTANT: never clear the form before successful server confirmation.
      showError(err.message || 'Gagal menyimpan hasil. Input tetap di layar, coba lagi.');
      toast(err.message || 'Gagal menyimpan.', 'error');
    } finally {
      isSaving = false;
      $('saveBtn').disabled = false;
    }
  }

  function showError(msg) {
    const el = $('saveError');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function renderSaved(res) {
    let status = res.status || 'Sesuai';
    const selisih = res.selisih;
    $('savedDetail').innerHTML = `
      <div class="sd-row"><span class="sd-label">SKU</span><span class="sd-value">${esc(res.sku)}</span></div>
      <div class="sd-row"><span class="sd-label">Produk</span><span class="sd-value">${esc(res.produk)}</span></div>
      <div class="sd-row"><span class="sd-label">Sistem</span><span class="sd-value">${SODashboard.fmtNum(res.fisikSistem)}</span></div>
      <div class="sd-row"><span class="sd-label">Fisik</span><span class="sd-value">${SODashboard.fmtNum(res.fisikHitung)}</span></div>
      <div class="sd-row"><span class="sd-label">Selisih</span><span class="sd-value">${(selisih > 0 ? '+' : '') + SODashboard.fmtNum(selisih)}</span></div>
      <div class="sd-row"><span class="sd-label">Status</span><span class="sd-value">${SODashboard.statusBadge(status)}</span></div>
    `;
  }

  $('nextScanBtn').addEventListener('click', startScanner);

  // ---- Manual lookup / search -------------------------------------------
  $('lookupSkuBtn').addEventListener('click', () => {
    const sku = $('skuInput').value.trim();
    if (!sku) { toast('Masukkan SKU terlebih dahulu.', 'error'); return; }
    if (!requireApi()) return;
    lookupAndShowProduct(sku);
  });
  $('skuInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lookupSkuBtn').click(); });

  $('searchBtn').addEventListener('click', doSearch);
  $('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  async function doSearch() {
    const q = $('searchInput').value.trim();
    if (!q) { toast('Masukkan kata kunci.', 'error'); return; }
    if (!requireApi()) return;
    showLoading('Mencari produk...');
    try {
      const data = await SO_API.searchProducts(q);
      SODashboard.renderSearchResults($('searchResults'), data && data.results, (sku) => {
        lookupAndShowProduct(sku);
      });
      hideLoading();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Gagal mencari.', 'error');
    }
  }

  // ---- Dashboard ---------------------------------------------------------
  async function loadDashboard() {
    if (!requireApi()) return;
    showLoading('Memuat dashboard...');
    try {
      const data = await SO_API.getDashboard();
      SODashboard.renderSummary($('dashboardSummary'), data);
      SODashboard.renderCategoryTable($('dashboardBody'), $('dashboardEmpty'), data);
      hideLoading();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Gagal memuat dashboard.', 'error');
    }
  }

  // ---- Products not checked ----------------------------------------------
  let notCheckedCache = [];
  async function loadNotChecked() {
    if (!requireApi()) return;
    showLoading('Memuat produk belum cek...');
    try {
      const data = await SO_API.getProductsNotChecked();
      notCheckedCache = (data && data.products) || [];
      $('notCheckedCount').textContent = String(notCheckedCache.length);
      applyNotCheckedFilter();
      hideLoading();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Gagal memuat produk belum cek.', 'error');
    }
  }
  $('notCheckedSearch').addEventListener('input', applyNotCheckedFilter);
  function applyNotCheckedFilter() {
    const q = $('notCheckedSearch').value.toLowerCase().trim();
    const list = !q ? notCheckedCache : notCheckedCache.filter((p) =>
      String(p.sku).toLowerCase().indexOf(q) !== -1 || String(p.produk).toLowerCase().indexOf(q) !== -1);
    SODashboard.renderProductList($('notCheckedList'), $('notCheckedEmpty'), list, (sku) => {
      lookupAndShowProduct(sku);
    });
  }

  // ---- Products with difference -----------------------------------------
  async function loadDifference() {
    if (!requireApi()) return;
    showLoading('Memuat produk selisih...');
    try {
      const data = await SO_API.getProductsWithDifference($('diffCategoryFilter').value);
      const prods = (data && data.products) || [];
      $('diffCount').textContent = String(prods.length);
      SODashboard.renderDifference($('diffBody'), $('diffEmpty'), prods);
      hideLoading();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Gagal memuat produk selisih.', 'error');
    }
  }
  $('diffCategoryFilter').addEventListener('change', loadDifference);

  // ---- History -----------------------------------------------------------
  async function loadHistory() {
    if (!requireApi()) return;
    showLoading('Memuat riwayat...');
    try {
      const data = await SO_API.getSessions();
      SODashboard.renderHistory($('historyBody'), $('historyEmpty'), data && data.sessions);
      hideLoading();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Gagal memuat riwayat.', 'error');
    }
  }

  // ---- Setup (wajib setiap buka aplikasi) ---------------------------------
  const API_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/;
  const USER_STORAGE_KEY = 'epic_gea_so_user';
  let currentUser = ''; // nama petugas + perangkat, dikirim ke LOG_SO

  // Label perangkat dari userAgent, mis. "Android/Chrome", "iPhone/Safari".
  function getDeviceLabel() {
    const ua = navigator.userAgent || '';
    let os = 'Perangkat';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone/i.test(ua)) os = 'iPhone';
    else if (/ipad/i.test(ua)) os = 'iPad';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os/i.test(ua)) os = 'Mac';
    else if (/linux/i.test(ua)) os = 'Linux';
    let br = '';
    if (/edg\//i.test(ua)) br = 'Edge';
    else if (/chrome\//i.test(ua)) br = 'Chrome';
    else if (/firefox\//i.test(ua)) br = 'Firefox';
    else if (/safari\//i.test(ua)) br = 'Safari';
    return br ? os + '/' + br : os;
  }

  function setSetupStatus(msg, isError) {
    const el = $('setupStatus');
    el.textContent = msg || '';
    el.style.color = isError ? 'var(--red)' : 'var(--muted)';
  }

  function enterApp() {
    connected = true;
    updateConfigBanner();
    showPage('scan');
    loadSOStatus();
    loadSpreadsheetInfo();
    loadCategories();
  }

  async function connectFromSetup() {
    const name = $('setupUserInput').value.trim();
    const url = $('setupApiUrlInput').value.trim();
    if (!name) { setSetupStatus('Isi nama petugas terlebih dahulu (tercatat di LOG_SO).', true); $('setupUserInput').focus(); return; }
    if (!url) { setSetupStatus('Masukkan URL Web App atau scan kodenya.', true); return; }
    if (!API_URL_RE.test(url)) {
      setSetupStatus('URL harus berformat: https://script.google.com/macros/s/.../exec', true);
      return;
    }
    const btn = $('setupConnectBtn');
    btn.disabled = true;
    setSetupStatus('Menghubungkan ke server...', false);
    SO_API.setApiUrl(url);
    try {
      await SO_API.testConnection();
      currentUser = name + ' · ' + getDeviceLabel();
      localStorage.setItem(USER_STORAGE_KEY, name);
      toast('Terhubung ke server. Petugas: ' + name, 'success');
      setSetupStatus('', false);
      enterApp();
    } catch (err) {
      // Buang URL yang gagal agar tidak dipakai lagi sesi ini.
      SO_API.setApiUrl('');
      setSetupStatus(err.message || 'Koneksi gagal. Periksa URL lalu coba lagi.', true);
    } finally {
      btn.disabled = false;
    }
  }

  $('setupConnectBtn').addEventListener('click', connectFromSetup);
  $('setupApiUrlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); connectFromSetup(); }
  });

  $('setupScanBtn').addEventListener('click', () => {
    openUrlScanner('Pindai URL Web App', (code) => {
      const url = String(code).trim();
      $('setupApiUrlInput').value = url;
      if (!API_URL_RE.test(url)) {
        setSetupStatus('Kode bukan URL Web App yang valid. Periksa kembali.', true);
        return false; // keep scanner open so the user can try again
      }
      connectFromSetup();
      return true; // close scanner
    });
  });

  // ---- Settings / admin --------------------------------------------------
  $('openConfigBtn').addEventListener('click', () => showPage('more'));
  $('saveApiUrlBtn').addEventListener('click', () => {
    const url = $('apiUrlInput').value.trim();
    if (!url) { toast('Masukkan URL Web App.', 'error'); return; }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
      toast('URL harus berformat: https://script.google.com/macros/s/.../exec', 'error');
      return;
    }
    SO_API.setApiUrl(url);
    updateConfigBanner();
    toast('URL disimpan.', 'success');
    loadSOStatus();
    loadSpreadsheetInfo();
  });

  // Scan Apps Script Web App URL from a QR/barcode.
  $('scanApiUrlBtn').addEventListener('click', () => {
    openUrlScanner('Pindai URL Web App', (code) => {
      const url = String(code).trim();
      $('apiUrlInput').value = url;
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
        toast('Kode bukan URL Web App yang valid. Periksa kembali.', 'error');
        return false; // keep scanner open so the user can try again
      }
      SO_API.setApiUrl(url);
      updateConfigBanner();
      toast('URL tersimpan dari scan.', 'success');
      loadSOStatus();
      loadSpreadsheetInfo();
      return true; // close scanner
    });
  });

  $('testConnBtn').addEventListener('click', async () => {
    if (!requireApi()) return;
    const btn = $('testConnBtn');
    btn.disabled = true;
    showLoading('Menguji koneksi ke server...');
    try {
      const data = await SO_API.testConnection();
      hideLoading();
      connected = true;
      updateConfigBanner();
      toast('✓ Koneksi berhasil. Server merespons.', 'success');
      loadSOStatus();
    } catch (err) {
      hideLoading();
      toast(err.message || 'Koneksi gagal.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
  $('apiUrlInput').value = SO_API.getApiUrl();

  // ---- Spreadsheet switching ---------------------------------------------
  $('saveSpreadsheetBtn').addEventListener('click', async () => {
    if (!requireApi()) return;
    const raw = $('spreadsheetInput').value.trim();
    if (!raw) { toast('Masukkan ID atau URL Google Sheets.', 'error'); return; }
    showLoading('Mengganti spreadsheet...');
    try {
      const data = await SO_API.setSpreadsheetId(raw);
      hideLoading();
      toast('Spreadsheet diganti: ' + (data.title || data.spreadsheetId), 'success');
      renderSpreadsheetInfo(data);
      loadSOStatus();
    } catch (err) { hideLoading(); toast(err.message || 'Gagal mengganti spreadsheet.', 'error'); }
  });

  $('scanSpreadsheetBtn').addEventListener('click', () => {
    if (!requireApi()) return;
    openUrlScanner('Pindai URL Spreadsheet', (code) => {
      const raw = String(code).trim();
      if (!/\/d\/[a-zA-Z0-9_-]{20,}/.test(raw) && !/^[a-zA-Z0-9_-]{20,}$/.test(raw)) {
        toast('Kode bukan ID/URL spreadsheet yang valid.', 'error');
        return false;
      }
      $('spreadsheetInput').value = raw;
      toast('Kode terbaca. Tekan "Ganti Spreadsheet" untuk menerapkan.', 'success');
      return true;
    });
  });

  $('resetSpreadsheetBtn').addEventListener('click', async () => {
    if (!requireApi()) return;
    showLoading('Mereset spreadsheet...');
    try {
      await SO_API.clearSpreadsheetId();
      hideLoading();
      toast('Spreadsheet dikembalikan ke default.', 'success');
      $('spreadsheetInput').value = '';
      loadSpreadsheetInfo();
      loadSOStatus();
    } catch (err) { hideLoading(); toast(err.message || 'Gagal meriset spreadsheet.', 'error'); }
  });

  function renderSpreadsheetInfo(data) {
    const el = $('spreadsheetInfo');
    if (!data) { el.innerHTML = '&mdash;'; return; }
    const title = data.title ? esc(data.title) : '(tanpa nama)';
    const id = data.spreadsheetId ? esc(String(data.spreadsheetId)) : '';
    const tag = data.overridden ? ' <span class="badge">aktif</span>' : '';
    el.innerHTML = title + (id ? ' &middot; <small>' + id + '</small>' : '') + tag;
  }

  async function loadSpreadsheetInfo() {
    if (!SO_API.isConfigured()) { renderSpreadsheetInfo(null); return; }
    try {
      const data = await SO_API.getSpreadsheetInfo();
      renderSpreadsheetInfo(data);
    } catch (e) { renderSpreadsheetInfo(null); }
  }

  // ---- Reusable URL/QR scanner modal -------------------------------------
  // openUrlScanner(title, onCode): onCode(code) returns true to close the
  // scanner, or false to keep it open for another attempt.
  function openUrlScanner(title, onCode) {
    const modal = $('urlScanModal');
    const video = $('urlScanVideo');
    const errBox = $('urlScanError');
    $('urlScanTitle').textContent = title || 'Pindai Kode';
    errBox.classList.add('hidden');
    video.classList.remove('hidden');
    modal.classList.remove('hidden');

    SOScanner.resetLast();
    SOScanner.start(video, (code) => {
      const done = onCode ? onCode(code) : true;
      if (done) closeUrlScanner();
    }).catch((err) => {
      showUrlScanError(err && err.message ? err.message : 'Gagal memulai kamera.');
    });
  }

  function showUrlScanError(msg) {
    const video = $('urlScanVideo');
    const box = $('urlScanError');
    video.classList.add('hidden');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function closeUrlScanner() {
    SOScanner.stop();
    $('urlScanModal').classList.add('hidden');
  }

  $('urlScanCancel').addEventListener('click', closeUrlScanner);

  $('syncMasterBtn').addEventListener('click', async () => {
    if (!requireApi()) return;
    showLoading('Menyinkronkan MASTER_PRODUK...');
    try {
      const data = await SO_API.syncMasterProduk();
      hideLoading();
      toast('MASTER_PRODUK tersinkron: ' + (data.count) + ' produk.', 'success');
      loadCategories();
    } catch (err) { hideLoading(); toast(err.message || 'Gagal sinkron.', 'error'); }
  });

  $('startSessionBtn').addEventListener('click', async () => {
    if (!requireApi()) return;
    showLoading('Memulai sesi SO...');
    try {
      const data = await SO_API.startSession();
      hideLoading();
      toast('Sesi SO dimulai: ' + data.sessionId, 'success');
      loadSOStatus();
    } catch (err) { hideLoading(); toast(err.message || 'Gagal memulai sesi.', 'error'); }
  });

  // Reset flow (modal confirmation)
  $('resetBtn').addEventListener('click', () => { $('resetModal').classList.remove('hidden'); });
  $('resetCancel').addEventListener('click', () => { $('resetModal').classList.add('hidden'); });
  $('resetConfirm').addEventListener('click', async () => {
    if (!requireApi()) { $('resetModal').classList.add('hidden'); return; }
    $('resetModal').classList.add('hidden');
    showLoading('Meriset SO...');
    try {
      await SO_API.resetSO();
      hideLoading();
      toast('SO berhasil direset.', 'success');
      loadSOStatus();
    } catch (err) { hideLoading(); toast(err.message || 'Gagal meriset SO.', 'error'); }
  });

  // ---- Categories for filter ---------------------------------------------
  async function loadCategories() {
    if (!requireApi()) return;
    try {
      const data = await SO_API.getCategories();
      const cats = (data && data.categories) || [];
      const sel = $('diffCategoryFilter');
      const cur = sel.value;
      sel.innerHTML = '<option value="">Semua Kategori</option>' +
        cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
      sel.value = cur;
    } catch (e) { /* silent; non-critical */ }
  }

  // ---- SO status header --------------------------------------------------
  async function loadSOStatus() {
    if (!SO_API.isConfigured()) { $('sessionLabel').innerHTML = '&mdash;'; updateConfigBanner(); return; }
    try {
      const data = await SO_API.getSOStatus();
      let label = '&mdash;';
      if (data && data.session && data.session.sessionId) {
        label = data.session.sessionId + (data.session.status ? ' &middot; ' + esc(data.session.status) : '');
      } else if (data && data.masterReady === false) {
        label = 'MASTER belum siap';
      }
      $('sessionLabel').innerHTML = label;
      const hint = $('soStatusHint');
      if (data && data.masterReady === false) {
        hint.innerHTML = 'MASTER_PRODUK belum dibuat. Buka Pengaturan &rarr; Sinkronkan MASTER_PRODUK.';
        hint.style.color = 'var(--amber)';
      } else {
        hint.innerHTML = '';
      }
      updateConfigBanner();
    } catch (e) {
      $('sessionLabel').innerHTML = '&mdash;';
      updateConfigBanner();
      // Surface backend errors at startup so the user knows the Apps Script
      // deployment is misconfigured/outdated instead of silently looking fine.
      if (SO_API.isConfigured()) {
        toast(e.message || 'Gagal terhubung ke server.', 'error');
      }
    }
  }

  // ---- utils -------------------------------------------------------------
  function esc(s) { return SODashboard.escapeHtml(s); }

  // ---- Init --------------------------------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { SOScanner.stop(); if (!$('urlScanModal').classList.contains('hidden')) $('urlScanModal').classList.add('hidden'); }
  });
  window.addEventListener('beforeunload', () => { SOScanner.stop(); });

  // Splash: tampilkan logo sebentar, lalu hilang.
  function dismissSplash() {
    const splash = $('splash');
    if (!splash) return;
    setTimeout(() => {
      splash.classList.add('fade-out');
      setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
    }, 1400);
  }
  if (document.readyState === 'complete') dismissSplash();
  else window.addEventListener('load', dismissSplash);

  // Reset setiap kali aplikasi dibuka: URL API tersimpan dibuang agar user
  // selalu scan/input ulang (menghindari bug URL lama yang tidak terhubung).
  const prevApiUrl = SO_API.getApiUrl();
  SO_API.setApiUrl('');
  if (prevApiUrl) {
    $('setupApiUrlInput').value = prevApiUrl;
    setSetupStatus('URL sesi sebelumnya sudah terisi. Isi nama, lalu tekan "Hubungkan" atau scan ulang.', false);
  }
  const prevUser = localStorage.getItem(USER_STORAGE_KEY);
  if (prevUser) $('setupUserInput').value = prevUser;

  updateConfigBanner();
  showPage('setup');
})();
