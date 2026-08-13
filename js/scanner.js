/* scanner.js — Camera barcode/QR scanner wrapper around @zxing/browser.
 *
 * Design:
 *  - Uses rear camera by default ({ facingMode: 'environment' }).
 *  - Stops after a successful scan and prevents duplicate events (debounce).
 *  - Exposes start()/stop() and an onDetected callback.
 *  - Friendly errors for camera permission/unavailable.
 */

const SOScanner = (function () {
  let controls = null;
  let active = false;
  let lastCode = null;
  let lastAt = 0;
  const DEBOUNCE_MS = 1500;
  let onDetected = null;
  let videoElement = null;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.ZXingBrowser !== 'undefined');
  }

  async function start(videoEl, onCode, opts) {
    videoElement = videoEl;
    onDetected = onCode || null;
    opts = opts || {};
    if (!isSupported()) {
      throw new ScanError('Peramban tidak mendukung kamera. Gunakan input SKU manual.');
    }
    stop();
    try {
      const constraints = {
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Release immediately; ZXing will acquire its own stream with hints.
      stream.getTracks().forEach((t) => t.stop());

      const reader = new window.ZXingBrowser.BrowserMultiFormatReader();
      controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result, err, ctrl) => {
        if (result) {
          const code = String(result.getText() || '').trim();
          if (!code) return;
          const now = Date.now();
          // Prevent duplicate / rapid repeated scans of the same code.
          if (code === lastCode && (now - lastAt) < DEBOUNCE_MS) return;
          lastCode = code;
          lastAt = now;
          // Stop after a successful scan.
          try { stop(); } catch (e) {}
          if (onDetected) onDetected(code);
        }
      });
      active = true;
    } catch (err) {
      throw toScanError(err);
    }
  }

  function stop() {
    if (controls) {
      try { controls.stop(); } catch (e) {}
      controls = null;
    }
    active = false;
    if (videoElement && videoElement.srcObject) {
      try { videoElement.srcObject = null; } catch (e) {}
    }
  }

  function resetLast() { lastCode = null; lastAt = 0; }
  function isActive() { return active; }

  function toScanError(err) {
    const name = (err && err.name) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return new ScanError('Izin kamera ditolak. Aktifkan izin kamera di pengaturan peramban, atau gunakan input SKU manual.');
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return new ScanError('Kamera tidak ditemukan pada perangkat ini. Gunakan input SKU manual.');
    }
    if (name === 'NotReadableError' || name === 'NotSupportedError') {
      return new ScanError('Kamera tidak dapat diakses (sedang dipakai aplikasi lain?). Gunakan input SKU manual.');
    }
    return new ScanError('Gagal memulai kamera. Gunakan input SKU manual.');
  }

  class ScanError extends Error {
    constructor(msg) { super(msg); this.name = 'ScanError'; }
  }

  return { start, stop, isSupported, isActive, resetLast, ScanError };
})();
