# Setup Guide — EPIC x GEA Stock Opname Scanner

Step-by-step from a blank Google Spreadsheet to a working app on a mobile phone.

```
Google Spreadsheet
      ↓
Category Sheets
      ↓
Apps Script
      ↓
Deploy Web App
      ↓
Frontend
      ↓
Mobile phone
```

---

## Step 1 — Create the Google Spreadsheet

1. Go to <https://sheets.google.com> and create a new spreadsheet.
2. Name it e.g. `EPIC GEA Stock Opname`.
3. Note its **Spreadsheet ID**: the long string in the URL between `/d/` and `/edit`.
   Example: `https://docs.google.com/spreadsheets/d/`**`1AbCdEf...`**`/edit`

## Step 2 — Create category sheets

Create one tab per product category, e.g. `MODUL`, `SERAGAM`, `PANDUAN`,
`POSTER`, `TAS`, `LAIN-LAIN`. You can add more later.

**Every category sheet must use this exact header row (row 1):**

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| SKU | Produk | Fisik Sistem | Fisik Hitung | Selisih | Status |

- Fill column **A (SKU)**, **B (Produk)**, and **C (Fisik Sistem)** with your data.
- Leave **D (Fisik Hitung)**, **E (Selisih)**, **F (Status)** empty — the app fills them.

Example (rows 2+):

| SKU | Produk | Fisik Sistem | Fisik Hitung | Selisih | Status |
|-----|--------|--------------|--------------|---------|--------|
| 100042 | Modul Expro MD Level 1.1 | 196 | | | |
| 100043 | Modul Expro MD Level 1.2 | 185 | | | |

> Do not rename these columns or change their order. The app relies on this exact
> structure across all category sheets.

## Step 3 — Open Apps Script

1. In the spreadsheet: **Extensions → Apps Script**.
2. This opens the Apps Script editor bound to your spreadsheet.

## Step 4 — Add the backend code

For each file in `apps-script/`, create a file with the same name in the editor
and paste the contents:

- `Code.gs`
- `Config.gs`
- `Api.gs`
- `MasterProduk.gs`
- `StockOpname.gs`
- `Dashboard.gs`
- `Utils.gs`

(Use the **+ → Script** button to add files. Delete the default `Code.gs`
placeholder first if needed.)

### (Optional) Use `clasp` instead

If you have Node.js + `clasp` installed:

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>     # or create a new project
# copy apps-script/*.gs into the cloned folder
clasp push
```

## Step 5 — Configure Spreadsheet ID

In `Config.gs`:

```js
SPREADSHEET_ID: '',   // '' = use the bound spreadsheet (recommended)
```

- For a **bound** project (created from Extensions → Apps Script), leave it as `''`.
- For a **standalone** project, paste your Spreadsheet ID here.

## Step 6 — Run setup once

1. In the Apps Script editor, select the function **`setupSheets`** in the toolbar.
2. Click **Run**.
3. Authorize the scopes when prompted (SpreadsheetApp access).

This creates: `MASTER_PRODUK`, `LOG_SO`, `SO_SESSION`, `DASHBOARD_SO`.

## Step 7 — Build the product index

1. Select **`syncMasterProduk`** in the toolbar.
2. Click **Run**.

This reads every category sheet and populates `MASTER_PRODUK` (SKU, Produk,
Kategori, Sheet, Baris). Run this again whenever you add/change products in the
category sheets.

> Tip: a custom menu **EPIC x GEA SO** appears in the spreadsheet (after a reload)
> with quick actions.

## Step 8 — Deploy the Web App

1. **Deploy → New deployment → Web app**.
2. Description: `EPIC GEA Stock Opname`.
3. **Execute as:** Me.
4. **Who has access:** Anyone with the link (or restrict to your domain).
5. Click **Deploy** and authorize.
6. Copy the Web App URL ending in `/exec`.

## Step 9 — Host the frontend

The frontend is static HTML/CSS/JS — no build step needed.

Option A — local test:
```bash
npm run serve
# open http://localhost:8080
```

Option B — static hosting (GitHub Pages, Netlify, Vercel, etc.):
- Publish the `frontend/` directory (root of the site must serve `index.html`).

> **Camera requires a secure context.** `localhost` works for desktop testing, but
> real phones need **HTTPS**. Use a host that provides HTTPS.

## Step 10 — Configure the app on the phone

1. Open the hosted frontend URL on your phone (Chrome/Safari).
2. Tap the **bottom nav → Scan** (home).
3. If the banner "API belum dikonfigurasi" appears, tap **Konfigurasi**.
4. Paste the Web App `/exec` URL from Step 8.
5. Tap **Simpan URL**.
6. The URL is stored in the browser's `localStorage` on that device.

## Step 11 — Start an SO session

- Open **Pengaturan → Mulai Sesi SO Baru**.
- This creates a session row (e.g. `SO-2026-08-13`) with status `Aktif`.
- The active session ID appears in the header.

## Step 12 — Start scanning

- Tap **Scan Produk** → grant camera permission → point at a barcode.
- The scanner stops after one successful read and shows the product detail.
- Enter the physical count (0 is valid and means "checked, count is zero").
- Tap **Simpan Hasil** → see the result → tap **Scan Produk Berikutnya**.

---

## Configuration still required by you

| Item | Where | Value |
|------|-------|-------|
| Spreadsheet ID (standalone only) | `apps-script/Config.gs` `SPREADSHEET_ID` | your sheet ID (or `''` for bound) |
| Web App URL | app **Pengaturan** page | the `/exec` URL |
| Category sheets | Google Spreadsheet | create with the exact headers |
| Logo | `frontend/assets/logo-epic-gea.png` | replace with official logo |

The application contains **no fake production data** and **no hard-coded products**;
it reads the actual spreadsheet dynamically.

---

## Troubleshooting

- **"API belum dikonfigurasi"** → paste the Web App URL in Pengaturan.
- **"SKU tidak ditemukan"** → run `syncMasterProduk` again.
- **"MASTER belum siap"** → run `setupSheets` then `syncMasterProduk`.
- **Camera won't start** → grant permission; use HTTPS; use **Input SKU Manual**.
- **Save fails** → input stays on screen; just retry (network/app issue).
- **Dashboard empty** → ensure category sheets have headers in row 1.
