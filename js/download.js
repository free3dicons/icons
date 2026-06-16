/**
 * Free3Dicons — Download System
 * Canvas-based resize runs entirely in browser
 * No server calls. No storage cost.
 */

(function () {
  'use strict';

  let selectedFormat = 'png';
  let selectedSize   = 256;

  window.addEventListener('DOMContentLoaded', function () {
    initSizeButtons();
    initFormatButtons();
    initCustomSize();
    initMainDownload();
  });

  // ── Size button selection ─────────────────────────────────────────────────
  function initSizeButtons() {
    document.querySelectorAll('.f3d-size-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.f3d-size-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
        selectedSize = parseInt(this.dataset.size, 10);
      });
    });
  }

  // ── Format button selection ───────────────────────────────────────────────
  function initFormatButtons() {
    document.querySelectorAll('.f3d-fmt-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.f3d-fmt-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');
        selectedFormat = this.dataset.format;
      });
    });
  }

  // ── Custom size input ─────────────────────────────────────────────────────
  function initCustomSize() {
    var btn = document.getElementById('f3dCustomDownload');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.getElementById('f3dCustomSize');
      var size  = parseInt(input.value, 10);
      if (!size || size < 16 || size > 2048) {
        showToast('Enter a size between 16 and 2048px', 'error');
        input.focus();
        return;
      }
      triggerDownload(size, selectedFormat);
    });
  }

  // ── Main download button ──────────────────────────────────────────────────
  function initMainDownload() {
    var btn = document.getElementById('f3dMainDownload');
    if (!btn) return;
    btn.addEventListener('click', function () {
      triggerDownload(selectedSize, selectedFormat);
    });
  }

  // ── Core download function ────────────────────────────────────────────────
  function triggerDownload(size, format) {
    var masterUrl = document.getElementById('f3dMasterUrl');
    var iconSlug  = document.getElementById('f3dIconSlug');
    if (!masterUrl || !iconSlug) return;

    downloadIcon(masterUrl.value, iconSlug.value, size, format);
  }

  // ── Canvas resize + download ──────────────────────────────────────────────
  window.downloadIcon = function (masterUrl, iconSlug, size, format) {
    format = format || selectedFormat || 'png';

    var btn = document.getElementById('f3dMainDownload');
    if (btn) {
      btn.disabled     = true;
      btn.textContent  = 'Preparing...';
    }

    var img       = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = function () {
      var canvas    = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      var ctx       = canvas.getContext('2d');

      // Transparent background for PNG
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);

      var mimeMap = { png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg', jpg: 'image/jpeg' };
      var extMap  = { png: 'png', webp: 'webp', jpeg: 'jpg', jpg: 'jpg' };
      var mime    = mimeMap[format] || 'image/png';
      var ext     = extMap[format]  || 'png';

      var link      = document.createElement('a');
      link.download = iconSlug + '-' + size + 'px.' + ext;
      link.href     = canvas.toDataURL(mime, 0.95);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Downloaded ' + size + 'px ' + format.toUpperCase() + ' ✓', 'success');

      // GA4 tracking
      if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
          icon_slug:   iconSlug,
          icon_size:   size,
          icon_format: format,
        });
      }

      if (btn) {
        btn.disabled    = false;
        btn.textContent = '⬇ Download ' + size + 'px ' + format.toUpperCase();
      }
    };

    img.onerror = function () {
      showToast('Failed to load image. Please try again.', 'error');
      if (btn) {
        btn.disabled    = false;
        btn.textContent = '⬇ Download';
      }
    };

    img.src = masterUrl + (masterUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
  };

  // ── Toast notification ────────────────────────────────────────────────────
  function showToast(message, type) {
    var existing = document.getElementById('f3dToast');
    if (existing) existing.remove();

    var toast     = document.createElement('div');
    toast.id      = 'f3dToast';
    toast.className = 'f3d-toast ' + (type || '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }
})();
