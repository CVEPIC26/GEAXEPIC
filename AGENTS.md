# GEAXEPIC — Project Memory

## Overview
EPIC x GEA Stock Opname scanner. Mobile-first static frontend (HTML/CSS/JS) +
Google Apps Script backend (Google Sheets as database).

## Structure
- `index.html` — single-page app, pages toggled via `data-page` + `.active`.
- `js/api.js` — `SO_API` client. Talks to Apps Script `/exec` URL (stored in
  localStorage key `epic_gea_so_api_url`). GET for reads, POST (text/plain JSON
  body to avoid CORS preflight) for writes.
- `js/scanner.js` — `SOScanner` wrapper around `@zxing/browser`. Generic
  `start(videoEl, onCode)`; stops after one detection. Reusable on any video.
- `js/app.js` — main controller (IIFE). Wires UI, scan flow, settings.
- `js/dashboard.js` — `SODashboard` render helpers.
- `css/app.css` — all styles. `.hidden = display:none !important`.
- `apps-script/*.gs` — backend. `Api.gs` dispatches `action` param to
  `ACTIONS` map. `Config.gs` holds `CONFIG` + `getSpreadsheet_()`.
  `StockOpname.gs`, `MasterProduk.gs`, `Dashboard.gs` = business logic.

## Conventions
- UI labels in Indonesian.
- Cache-bust: append `?v=YYYYMMDDx` to JS/CSS in `index.html` on changes
  (last: `?v=20260821a`).
- Backend response shape: `{ success: boolean, data?|message? }`.
- `getSpreadsheet_()` lookup order: runtime Script Property `SPREADSHEET_ID`
  → `CONFIG.SPREADSHEET_ID` → bound/active spreadsheet.

## Features (notable)
- Startup flow: splash logo (~1.4s) → `setup` page (wajib scan/input URL API
  setiap buka; localStorage URL dibuang saat init, nilai lama hanya jadi
  prefill) → koneksi di-test dulu (`testConnection`) baru masuk app. Nav
  di-guard flag `connected` di app.js.
- Scan Apps Script Web App URL from QR/barcode (`scanApiUrlBtn` + reusable
  `openUrlScanner` modal in app.js).
- Switch active Spreadsheet at runtime via `setSpreadsheetId` (accepts bare ID
  or `docs.google.com/.../d/<ID>/edit` URL). Persisted in Script Properties.
- Reset spreadsheet override via `clearSpreadsheetId`.

## Validation
- JS syntax: `node --check js/*.js`; for `.gs` copy to temp `.js` first
  (node rejects `.gs` extension).
- Local smoke test: `python3 -m http.server 8099` → load `index.html`,
  verify no console errors, assets return 200.

## Git
- Remote: github.com/CVEPIC26/GEAXEPIC (token in GITHUB_TOKEN).
- Commit co-author: `openhands <openhands@all-hands.dev>`.
