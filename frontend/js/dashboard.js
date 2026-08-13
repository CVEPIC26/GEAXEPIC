/* dashboard.js — Dashboard & list rendering helpers.
 * Pure rendering functions; data fetching happens in app.js.
 */

const SODashboard = (function () {
  function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '0';
    const num = Number(n);
    if (!isFinite(num)) return String(n);
    return num.toLocaleString('id-ID');
  }

  function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'belum', label = status || 'Belum Cek';
    if (s === 'sesuai') cls = 'sesuai';
    else if (s === 'kekurangan') cls = 'kekurangan';
    else if (s === 'kelebihan') cls = 'kelebihan';
    return '<span class="badge-status ' + cls + '">' + escapeHtml(label) + '</span>';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Render the general summary + category table. */
  function renderSummary(container, data) {
    if (!container) return;
    if (!data || !data.summary) { container.innerHTML = '<div class="empty">Belum ada data.</div>'; return; }
    const s = data.summary;
    const cards = [
      card('Total SKU', fmtNum(s.totalSku), 'full'),
      card('Sudah Cek', fmtNum(s.sudahCek), 'green'),
      card('Belum Cek', fmtNum(s.belumCek)),
      card('Sesuai', fmtNum(s.sesuai), 'green'),
      card('Kekurangan', fmtNum(s.kekurangan), 'red'),
      card('Kelebihan', fmtNum(s.kelebihan), 'amber'),
      card('Progress SO', s.progress + '%', 'full')
    ];
    container.innerHTML = cards.join('');
  }

  function card(label, value, extra) {
    const cls = ['stat']; if (extra) { if (extra === 'full') cls.push('full'); else cls.push(extra); }
    return '<div class="' + cls.join(' ') + '"><div class="stat-label">' + escapeHtml(label) +
      '</div><div class="stat-value">' + escapeHtml(value) + '</div></div>';
  }

  function renderCategoryTable(tbody, emptyEl, data) {
    if (!tbody) return;
    const cats = (data && data.categories) || [];
    if (!cats.length) { tbody.innerHTML = ''; if (emptyEl) emptyEl.classList.remove('hidden'); return; }
    if (emptyEl) emptyEl.classList.add('hidden');
    tbody.innerHTML = cats.map(function (c) {
      return '<tr>' +
        '<td>' + escapeHtml(c.kategori) + '</td>' +
        '<td class="num">' + fmtNum(c.totalSku) + '</td>' +
        '<td class="num">' + fmtNum(c.sudahCek) + '</td>' +
        '<td class="num">' + fmtNum(c.belumCek) + '</td>' +
        '<td class="num">' + fmtNum(c.sesuai) + '</td>' +
        '<td class="num">' + fmtNum(c.kurang) + '</td>' +
        '<td class="num">' + fmtNum(c.lebih) + '</td>' +
        '<td><div class="prog-bar"><span style="width:' + clamp(c.progress) + '%"></span></div> ' + c.progress + '%</td>' +
        '</tr>';
    }).join('');
  }

  function clamp(p) { p = Number(p) || 0; return Math.max(0, Math.min(100, p)); }

  /** Render list of products (not checked). Each item clickable -> onSelect(sku). */
  function renderProductList(container, emptyEl, products, onSelect) {
    if (!container) return;
    if (!products || !products.length) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    container.innerHTML = products.map(function (p) {
      return '<div class="result-item" data-sku="' + escapeHtml(p.sku) + '">' +
        '<div class="ri-main">' +
        '<div class="ri-sku">' + escapeHtml(p.sku) + '</div>' +
        '<div class="ri-name">' + escapeHtml(p.produk) + '</div>' +
        '<div class="ri-cat">' + escapeHtml(p.kategori || '') + '</div>' +
        '</div>' +
        (p.fisikSistem !== undefined ? '<div class="ri-stock">Sis: ' + fmtNum(p.fisikSistem) + '</div>' : '') +
        '</div>';
    }).join('');
    container.querySelectorAll('.result-item').forEach(function (el) {
      el.addEventListener('click', function () {
        if (onSelect) onSelect(el.getAttribute('data-sku'));
      });
    });
  }

  /** Render search results similarly. */
  function renderSearchResults(container, results, onSelect) {
    if (!container) return;
    if (!results || !results.length) {
      container.innerHTML = '<div class="empty">Tidak ada produk cocok.</div>';
      return;
    }
    container.innerHTML = results.map(function (p) {
      return '<div class="result-item" data-sku="' + escapeHtml(p.sku) + '">' +
        '<div class="ri-main">' +
        '<div class="ri-sku">' + escapeHtml(p.sku) + '</div>' +
        '<div class="ri-name">' + escapeHtml(p.produk) + '</div>' +
        '<div class="ri-cat">' + escapeHtml(p.kategori || '') + '</div>' +
        '</div></div>';
    }).join('');
    container.querySelectorAll('.result-item').forEach(function (el) {
      el.addEventListener('click', function () {
        if (onSelect) onSelect(el.getAttribute('data-sku'));
      });
    });
  }

  /** Render difference table. */
  function renderDifference(tbody, emptyEl, products) {
    if (!tbody) return;
    if (!products || !products.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    tbody.innerHTML = products.map(function (p) {
      return '<tr>' +
        '<td>' + escapeHtml(p.sku) + '</td>' +
        '<td>' + escapeHtml(p.produk) + '</td>' +
        '<td class="num">' + fmtNum(p.sistem) + '</td>' +
        '<td class="num">' + fmtNum(p.fisik) + '</td>' +
        '<td class="num">' + fmtNum(p.selisih) + '</td>' +
        '<td>' + statusBadge(p.status) + '</td>' +
        '</tr>';
    }).join('');
  }

  /** Render history table (LOG_SO). */
  function renderHistory(tbody, emptyEl, sessions) {
    if (!tbody) return;
    if (!sessions || !sessions.length) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    tbody.innerHTML = sessions.map(function (l) {
      return '<tr>' +
        '<td>' + escapeHtml(formatTime(l.timestamp || l.waktu)) + '</td>' +
        '<td>' + escapeHtml(l.sku) + '</td>' +
        '<td>' + escapeHtml(l.produk) + '</td>' +
        '<td class="num">' + fmtNum(l.fisikSistem) + '</td>' +
        '<td class="num">' + fmtNum(l.fisikHitung) + '</td>' +
        '<td class="num">' + fmtNum(l.selisih) + '</td>' +
        '<td>' + statusBadge(l.status) + '</td>' +
        '<td>' + escapeHtml(l.user || '') + '</td>' +
        '</tr>';
    }).join('');
  }

  function formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    const pad = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  return {
    fmtNum, escapeHtml, statusBadge, formatTime,
    renderSummary, renderCategoryTable, renderProductList,
    renderSearchResults, renderDifference, renderHistory
  };
})();
