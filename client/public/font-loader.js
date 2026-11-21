// Loads the Google Fonts stylesheet without blocking the first paint.
// This is an external file (not an inline onload="" attribute) because the Content-Security-Policy
// forbids inline event handlers (script-src-attr 'none').
(function () {
  var preload = document.querySelector('link[rel="preload"][as="style"]');
  if (!preload) return;
  var sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = preload.href;
  document.head.appendChild(sheet);
})();
