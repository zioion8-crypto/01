/* KTB — free PDF download measure (GA4 event: free_pdf_download).
   This file never loads a tag and never sends anything by itself: the pages
   promise no cookies and no third-party scripts. When a GA4 gtag exists on
   the page it receives the event; otherwise the event is queued in
   window.dataLayer only if that array already exists. */
(function () {
  if (window.__ktbPdfTrack) return;
  window.__ktbPdfTrack = true;

  function fileName(href) {
    try {
      var u = new URL(href, document.location.href);
      if (u.origin !== document.location.origin) return '';
      var n = (u.pathname.split('/').pop() || '');
      return decodeURIComponent(n);
    } catch (e) {
      return '';
    }
  }

  function send(name) {
    var lang = document.documentElement.lang || '';
    var path = document.location.pathname;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'free_pdf_download', {
        file_name: name,
        page_path: path,
        content_language: lang
      });
      return;
    }
    if (Object.prototype.toString.call(window.dataLayer) === '[object Array]') {
      window.dataLayer.push({
        event: 'free_pdf_download',
        file_name: name,
        page_path: path,
        content_language: lang
      });
    }
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target;
    while (el && el !== document && !(el.tagName && el.tagName.toLowerCase() === 'a')) {
      el = el.parentNode;
    }
    if (!el || el === document || !el.getAttribute) return;
    var raw = el.getAttribute('href') || '';
    if (!/\.pdf(?:[?#]|$)/i.test(raw)) return;
    var name = fileName(el.href || raw);
    if (name) send(name);
  }, true);
})();
