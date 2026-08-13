# EPIC x GEA — Stock Opname Scanner

A mobile-first **Stock Opname (Stock Counting)** web application for internal use by
**EPIC x GEA**. The operator scans a product barcode **once**, then manually enters
the physical quantity they counted. The system computes the difference against the
system stock and records the result. The app is designed for warehouse staff on
Android phones.

> **Core rule:** One scan identifies **one SKU**. The operator does **not** scan every
> physical unit — they scan once, then type the physical count.

---

## 1. Project Overview

| Item | Value |
|------|-------|
| Frontend | Static HTML + CSS + vanilla JS (mobile-first, no build step) |
| Scanner | `@zxing/browser` (camera-based barcode/QR, rear camera by default) |
| Backend | Google Apps Script Web App |
| Database | Google Sheets (category sheets are the source of truth) |
| UI language | Indonesian |
| Logo | Original placeholder `frontend/assets/logo-epic-gea.png` (replace later) |

---

## 2. Architecture

```
Android phone (browser)
     |  fetch (GET reads / POST writes)
     v
Google Apps Script Web App (doGet / doPost)   <-- apps-script/*.gs
     |  SpreadsheetApp
     v
Google Spreadsheet
   ├── MODUL, SERAGAM, PANDUAN, POSTER, TAS, LAIN-LAIN  (category sheets = source of truth)
   ├── MASTER_PRODUK   (indexed lookup table, synced from category sheets)
   ├── LOG_SO          (audit trail; one row per save result, NOT per unit)
   ├── DASHBOARD_SO    (placeholder; dashboard computed live from category sheets)
   └── SO_SESSION      (SO session history)
```

- **MASTER_PRODUK** is an indexed lookup table so the app does **not** read the entire
  spreadsheet on every scan — it reads the index once per lookup.
- The **category sheets** remain the single source of product data. Users do not
  maintain product data twice.
- All category sheets share the **same column structure** (A=SKU, B=Produk,
  C=Fisik Sistem, D=Fisik Hitung, E=Selisih, F=Status).

---

## 3. Features

- Camera barcode/QR scan (rear camera), stops after a successful scan, no duplicates.
- Manual SKU input + product name search as fallback.
- Product detail screen: SKU, Produk, Kategori, Fisik Sistem, Jumlah Fisik (numeric).
- **0 is a valid checked physical count** (not interpreted as "not checked").
- Save computes `Selisih = Fisik Hitung - Fisik Sistem` and status
  (`Sesuai` / `Kekurangan` / `Kelebihan`). "Belum Cek" means not yet checked.
- Re-scanning the same SKU pre-fills the **previous** physical count; saving
  **replaces** (not adds).
- One **LOG_SO** audit row per save (never one row per physical unit).
- Dashboard: overall summary + per-category breakdown + progress %.
- **Produk Belum Cek** (products with blank physical count; 0 excluded).
- **Produk Selisih** (only Kekurangan/Kelebihan, filter by category).
- **Riwayat** (LOG_SO session history).
- SO session concept (e.g. `SO-2026-08-13`); historical data is preserved.
- Admin **Reset SO** with explicit confirmation modal (clears D/E/F only;
  preserves SKU/Produk/Fisik Sistem; never touches LOG_SO history).
- LockService concurrency protection on save & reset.
- Friendly Indonesian error messages; network/camera permission handling.
- Never clears user input before a successful server save (retry-safe).

---

## 4. Repository Structure

```
GEAXEPIC/
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   ├── logo-epic-gea.png      # placeholder logo (replace later)
│   │   └── generate_logo.py       # script that generated the placeholder
│   ├── css/
│   │   └── app.css
│   └── js/
│       ├── api.js                 # backend client
│       ├── scanner.js            # camera scanner wrapper
│       ├── dashboard.js          # rendering helpers
│       └── app.js                 # main controller
├── apps-script/
│   ├── Code.gs                   # top-level, custom menu, setup
│   ├── Config.gs                 # centralized configuration
│   ├── Api.gs                    # doGet/doPost + action dispatch
│   ├── MasterProduk.gs           # MASTER_PRODUK sync + lookup
│   ├── StockOpname.gs            # core SO operations (lookup/save/lists/reset)
│   ├── Dashboard.gs              # dashboard + sessions
│   └── Utils.gs                  # shared helpers
├── docs/
│   └── setup.md                  # step-by-step setup guide
├── README.md
├── .gitignore
└── package.json
```

---

## 5. Google Sheet Structure

### Category sheets (e.g. `MODUL`, `SERAGAM`, …) — identical structure

| Col | Header        | Meaning                          |
|-----|---------------|----------------------------------|
| A   | SKU           | Product / barcode SKU            |
| B   | Produk        | Product name                     |
| C   | Fisik Sistem  | System stock (read-only)         |
| D   | Fisik Hitung  | Physical count (written by app)  |
| E   | Selisih       | Difference (written by app)      |
| F   | Status        | Sesuai/Kekurangan/Kelebihan/Belum Cek |

### MASTER_PRODUK (indexed lookup table)

| A SKU | B Produk | C Kategori | D Sheet | E Baris |
|-------|----------|------------|---------|---------|

### LOG_SO (audit trail)

| A Timestamp | B SKU | C Produk | D Kategori | E Fisik Sistem | F Fisik Hitung | G Selisih | H Status | I User |
|------------|-------|----------|------------|----------------|----------------|-----------|----------|--------|

### SO_SESSION

| A Session ID | B Start Time | C End Time | D Status | E User |
|--------------|--------------|------------|----------|--------|

### DASHBOARD_SO

Created as a placeholder; the dashboard shown in the app is computed live from the
category sheets.

---

## 6. Google Apps Script Setup

See **`docs/setup.md`** for the full step-by-step guide. Summary:

1. Create a Google Spreadsheet and add your category sheets (MODUL, SERAGAM, …)
   with the headers above and your product rows.
2. Open **Extensions → Apps Script**.
3. Create files matching `apps-script/*.gs` and paste the contents (or use `clasp`).
4. In `Config.gs`, set `CONFIG.SPREADSHEET_ID` (or leave `''` for a bound project).
5. Run `setupSheets` once (creates MASTER_PRODUK / LOG_SO / SO_SESSION / DASHBOARD_SO).
6. Run `syncMasterProduk` to build the index from your category sheets.
7. Deploy as a Web App:
   - **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link** (or your domain)
   - Copy the `/exec` URL.

> For manual deployment (without `clasp`), copy each `apps-script/*.gs` file's
> contents into a script file of the same name in the Apps Script editor.

---

## 7. Deployment Instructions (Frontend)

The frontend is static. Host it anywhere (GitHub Pages, Netlify, any static host),
or just open it locally:

```bash
npm run serve
# opens http://localhost:8080
```

Then on your phone: open the hosted URL in a mobile browser (Chrome/Safari).

> Camera access requires a **secure context** (HTTPS or `localhost`). Use HTTPS
> hosting for real phones.

---

## 8. Configure Spreadsheet ID

In `apps-script/Config.gs`:

```js
SPREADSHEET_ID: '',   // '' = use the bound spreadsheet; or paste the ID
```

The Spreadsheet ID is the long string in the sheet URL between `/d/` and `/edit`.

In the **frontend**: open the app → **Pengaturan** → paste the Web App `/exec` URL
into **URL Web App (Apps Script)** → **Simpan URL**. The URL is stored in the
browser's `localStorage`.

---

## 9. Sync MASTER_PRODUK

After adding/editing category sheet products, rebuild the index:

- Apps Script editor: run `syncMasterProduk`, **or**
- In the app: **Pengaturan → Sinkronkan MASTER_PRODUK**, **or**
- Custom menu (bound script): **EPIC x GEA SO → Sinkronkan MASTER_PRODUK**.

This reads SKU + Produk from every category sheet and rewrites MASTER_PRODUK.

---

## 10. Deploy Web App

1. Apps Script editor → **Deploy → New deployment → Web app**.
2. Description: `EPIC GEA Stock Opname`.
3. Execute as: **Me**.
4. Who has access: choose per your policy (e.g. **Anyone with the link**).
5. Authorize the scopes when prompted.
6. Copy the `/exec` URL → paste into the app's **Pengaturan** page.

---

## 11. Replace Logo

Replace the file `frontend/assets/logo-epic-gea.png` with the official logo
(keep the same filename). The app references it by relative path only — no logo
is hard-coded into application logic.

You can regenerate a fresh placeholder with:

```bash
python3 frontend/assets/generate_logo.py
```

---

## 12. Start a New SO

- In the app: **Pengaturan → Mulai Sesi SO Baru**.
- This appends a row to `SO_SESSION` with status `Aktif` (idempotent for the same
  date: `SO-YYYY-MM-DD`).
- Historical LOG_SO rows and prior sessions are **not** destroyed.

---

## 13. Reset SO

- In the app: **Pengaturan → Reset SO** → a confirmation modal appears.
- On confirm, the backend (under LockService) clears columns **D, E, F** on every
  category sheet. Columns **A (SKU), B (Produk), C (Fisik Sistem)** are preserved.
- **LOG_SO history is never deleted.**
- Reset is **never** automatic.

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| "API belum dikonfigurasi" | Open Pengaturan and paste the Web App `/exec` URL. |
| "Gagal terhubung ke server" | Wrong URL, deployment deleted, or no network. Re-deploy Web App. |
| "SKU tidak ditemukan" | Run **Sinkronkan MASTER_PRODUK**, then scan again. |
| "MASTER belum siap" | Run `setupSheets` + `syncMasterProduk` in Apps Script. |
| Camera won't start / "Izin kamera ditolak" | Grant camera permission in browser settings; use HTTPS; use **Input SKU Manual** as fallback. |
| Duplicate scans | Scanner auto-stops after one scan and debounces duplicates. |
| Save fails / input disappears | Input is **never** cleared before a successful save — just retry. |
| Dashboard counts look wrong | Re-run `syncMasterProduk`; ensure category sheets have headers. |
| CORS / preflight errors | The client POSTs as `text/plain` (no preflight). If using a custom proxy, ensure JSON passthrough. |

---

## 15. Security Notes

- **No credentials/secrets are committed.** See `.gitignore`.
- `SPREADSHEET_ID` and the Web App URL are configuration, not secrets.
- Apps Script executes as the deployer ("Me"); access scope is set at deploy time.
- Error responses never expose stack traces to end users.

---

## 16. Business Rules (non-negotiable)

1. One scan = identify one SKU.
2. Do **not** scan every physical unit.
3. Physical quantity is manually entered by the operator.
4. Physical count **replaces** the previous physical count.
5. Physical count = **0** is a valid checked result.
6. Difference = Physical Count − System Stock.
7. Difference = 0 → **Sesuai**.
8. Difference < 0 → **Kekurangan**.
9. Difference > 0 → **Kelebihan**.
10. SKU and Product Name come from the spreadsheet (never hard-coded).
11. Every successful save creates an audit log.
12. Never silently lose user input.
13. Never delete historical LOG_SO records during reset.
14. Never commit secrets.