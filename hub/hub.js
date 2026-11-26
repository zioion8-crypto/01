/* KTB Hub — shared engine: language, paid/free module, storage, distance.
   No external requests, no tracking, no cookies. */
(function () {
  'use strict';

  var I18N = window.KTB_I18N || { en: {} };
  var KEY_LANG = 'ktbhub.lang.v1';

  /* Four confirmed Creem products; each dynamic paid module stays after the free tool content. */
  var PRODUCTS = {
    map: { price: '$4.99', url: 'https://www.creem.io/product/prod_ZWD2PZT3J2OKTTsO6ba7t' },
    kit: { price: '$12.99', url: 'https://www.creem.io/product/prod_6Djyg7VKiPQwMbplXauout' },
    guide: { price: '$9.99', url: 'https://www.creem.io/product/prod_7rXnDal9fK81tIc7LWyXc' },
    dual: { price: '$14.99', url: 'https://www.creem.io/product/prod_7c1BYTueW3C6459n4Tb92v', i18n: 'kj' }
  };

  var FREE = {
    nearby: { url: 'https://koreatravelbible.com/free/' },
    around: { url: 'https://koreatravelbible.com/tools/subway-cost-calc/' },
    speak: { url: 'https://koreatravelbible.com/tools/order-card/' }
  };

  var HUB = window.HUB = {
    _lang: 'en',

    /* ---------- language ---------- */
    lang: function () { return this._lang; },

    t: function (key, vars) {
      var tab = I18N[this._lang] || I18N.en || {};
      var s = tab[key];
      if (s == null) s = (I18N.en || {})[key];
      if (s == null) s = '';
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          s = s.split('{' + k + '}').join(String(vars[k]));
        });
      }
      return s;
    },

    setLang: function (l) {
      if (!I18N[l]) l = 'en';
      this._lang = l;
      this.set(KEY_LANG, l);
      this.applyLang();
      if (typeof this.onLangChange === 'function') this.onLangChange();
    },

    applyLang: function () {
      var l = this._lang;
      var self = this;
      document.documentElement.lang = (l === 'zh' ? 'zh-Hant' : (l === 'cn' ? 'zh-Hans' : (l === 'ja' ? 'ja' : 'en')));

      var nodes = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var v = self.t(el.getAttribute('data-i18n'));
        if (!v) continue;
        if (el.tagName === 'OPTION') el.textContent = v.replace(/<[^>]+>/g, '');
        else el.innerHTML = v;
      }
      var ph = document.querySelectorAll('[data-i18n-ph]');
      for (var j = 0; j < ph.length; j++) {
        ph[j].setAttribute('placeholder', self.t(ph[j].getAttribute('data-i18n-ph')));
      }
      var ar = document.querySelectorAll('[data-i18n-aria]');
      for (var k = 0; k < ar.length; k++) {
        ar[k].setAttribute('aria-label', self.t(ar[k].getAttribute('data-i18n-aria')));
      }
      var al = document.querySelectorAll('[data-i18n-alt]');
      for (var ai = 0; ai < al.length; ai++) {
        al[ai].setAttribute('alt', self.t(al[ai].getAttribute('data-i18n-alt')));
      }

      var lo = document.querySelectorAll('[data-lang-only]');
      for (var q = 0; q < lo.length; q++) {
        lo[q].hidden = lo[q].getAttribute('data-lang-only').split(/\s+/).indexOf(l) === -1;
      }

      var tk = document.documentElement.getAttribute('data-title-key');
      if (tk) document.title = self.t(tk);

      var lb = document.querySelectorAll('[data-langbar] button');
      for (var b = 0; b < lb.length; b++) {
        lb[b].setAttribute('aria-pressed', lb[b].getAttribute('data-lang') === l ? 'true' : 'false');
      }
      var lbl = document.querySelectorAll('[data-langbar]');
      for (var c = 0; c < lbl.length; c++) lbl[c].setAttribute('aria-label', self.t('c.langLabel'));
    },

    langBar: function () {
      var bars = document.querySelectorAll('[data-langbar]');
      for (var i = 0; i < bars.length; i++) {
        bars[i].innerHTML =
          '<button type="button" data-lang="en">EN</button>' +
          '<button type="button" data-lang="ja">日本語</button>' +
          '<button type="button" data-lang="zh">繁體</button>' +
          '<button type="button" data-lang="cn">简体</button>';
        bars[i].addEventListener('click', function (e) {
          var b = e.target.closest('button[data-lang]');
          if (!b) return;
          HUB.setLang(b.getAttribute('data-lang'));
        });
      }
    },

    /* ---------- free + paid module ---------- */
    money: function (host, kind, order) {
      if (!host) return;
      var self = this;
      var f = FREE[kind] || {};
      var list = order.slice();
      if (list.indexOf('dual') === -1) list.push('dual');

      var html = '<div class="money">' +
        '<p class="diff"><span aria-hidden="true">🔓</span> ' + self.t('m.diff.' + kind) + '</p>' +
        '<div class="free">' +
        '<p class="lb">' + self.t('c.freeLb') + '</p>' +
        '<h3>' + self.t('free.' + kind + '.name') + '</h3>' +
        '<p>' + self.t('free.' + kind + '.sub') + '</p>' +
        '<a class="big" href="' + f.url + '">' + self.t('free.' + kind + '.btn') +
        '<span>' + self.t('c.freeBtnNote') + '</span></a>' +
        '</div>' +
        '<div class="paid">' +
        '<p class="lb">' + self.t('c.paidLb') + '</p>';

      list.forEach(function (key) {
        var p = PRODUCTS[key];
        if (!p) return;
        var labelKey = p.i18n || key;
        html += '<a class="pcard" href="' + p.url + '" target="_blank" rel="noopener">' +
          '<div class="r1"><div>' +
          '<p class="nm">' + self.t('p.' + labelKey + '.name') + '</p>' +
          '<p class="ds">' + self.t('p.' + labelKey + '.sub') + '</p>' +
          '</div><div class="pr"><span class="amt">' + p.price + '</span>' +
          '<span class="tag">' + self.t('c.paidTag') + '</span></div></div>' +
          '<span class="go">' + self.t('c.gumroad') + '</span></a>';
      });

      html += '<p class="price-note">' + self.t('c.priceNote') + '</p></div></div>';
      host.innerHTML = html;
      var paid = host.querySelector('.paid');
      if (paid && host.__unlocked) paid.classList.add('on');
    },

    /* The paid cards appear once the free results have been read or the page has been used. */
    gate: function (host, sentinel, extraUnlock) {
      if (!host || host.__gated) return;
      host.__gated = true;
      function unlock() {
        if (host.__unlocked) return;
        host.__unlocked = true;
        var paid = host.querySelector('.paid');
        if (paid) paid.classList.add('on');
      }
      (extraUnlock || []).forEach(function (el) {
        if (!el) return;
        ['click', 'input', 'change', 'keydown'].forEach(function (t) {
          el.addEventListener(t, unlock, { passive: true });
        });
      });
      if ('IntersectionObserver' in window && sentinel) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) unlock(); });
        }, { rootMargin: '0px 0px -10% 0px' }).observe(sentinel);
      } else {
        unlock();
      }
      window.addEventListener('scroll', function () {
        if (window.innerHeight + window.scrollY > document.body.scrollHeight - 240) unlock();
      }, { passive: true });
    },

    /* ---------- location-safety note (one wording for / and /hub/nearby/) ---------- */
    safety: function (host) {
      if (!host || host.__done) return;
      host.__done = true;
      host.innerHTML =
        '<div class="safe" role="note">' +
        '<p class="sh"><span class="ic" aria-hidden="true">🔒</span>' +
        '<span data-i18n="safe.t">No location sharing needed</span></p>' +
        '<p class="sb" data-i18n="safe.b">Pick your neighbourhood or station and the list opens at once.</p>' +
        '</div>';
    },

    /* ---------- storage: favourites + filters only ---------- */
    get: function (k, d) {
      try {
        var v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    },
    del: function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    },

    /* ---------- distance ---------- */
    km: function (aLat, aLng, bLat, bLng) {
      var R = 6371000, rad = Math.PI / 180;
      var dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
      var s = Math.sin(dLat / 2), t = Math.sin(dLng / 2);
      var h = s * s + Math.cos(aLat * rad) * Math.cos(bLat * rad) * t * t;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    },
    dist: function (m) {
      if (m < 1000) return '~' + (Math.round(m / 10) * 10) + ' m';
      return '~' + (Math.round(m / 100) / 10).toFixed(1) + ' km';
    },

    qs: function (s, r) { return (r || document).querySelector(s); },
    qsa: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }
  };

  /* ---------- boot ---------- */
  /* ?lang= accepts BCP 47 with a dash or an underscore (zh_cn, zh_tw come from older links,
   the cheat sheet and the Blogger hub), plus the plain codes. */
  var qp = (new URLSearchParams(location.search).get('lang') || '').toLowerCase().replace(/_/g, '-');
  if (qp === 'zh-hans' || qp === 'zh-cn' || qp === 'zh-sg' || qp === 'cn') qp = 'cn';
  if (qp === 'zh-hant' || qp === 'zh-tw' || qp === 'zh-hk' || qp === 'tw' || qp === 'zh') qp = 'zh';
  HUB._lang = I18N[qp] ? qp : HUB.get(KEY_LANG, 'en');
  if (!I18N[HUB._lang]) HUB._lang = 'en';
  HUB.langBar();
  HUB.safety(document.getElementById('locSafe'));
  HUB.applyLang();
})();
