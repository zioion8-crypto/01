/* Speak & Show — static phrases, full-screen line, copy with a selection fallback. */
(function () {
  'use strict';
  var H = window.HUB, $ = H.qs;
  var P = window.KTB_PHRASES || [];
  var GROUPS = ['restaurant', 'allergy', 'taxi', 'hotel', 'pharmacy', 'pay', 'emergency'];

  var el = {
    chips: $('#groupChips'), list: $('#list'),
    ov: $('#ov'), kr: $('#ovKr'), mean: $('#ovMean'), rom: $('#ovRom'),
    close: $('#ovClose'), copy: $('#ovCopy'), note: $('#ovNote')
  };
  var st = { g: '', cur: null, lastFocus: null };

  function T(k, v) { return H.t(k, v); }
  function meaning(p) {
    var l = H.lang();
    /* cn falls back to the Traditional line before English, so a Simplified reader
       never lands on an English meaning if only one Chinese text exists. */
    if (l === 'cn') return p.cn || p.zh || p.en;
    if (l === 'zh') return p.zh || p.cn || p.en;
    return p[l] || p.en;
  }

  function buildChips() {
    var html = '<button class="chip' + (st.g === '' ? ' on' : '') + '" type="button" data-g="" aria-pressed="' + (st.g === '') + '">' +
      T('cat.all') + ' <span class="n">' + P.length + '</span></button>';
    GROUPS.forEach(function (g) {
      var n = P.filter(function (p) { return p.g === g; }).length;
      if (!n) return;
      html += '<button class="chip' + (st.g === g ? ' on' : '') + '" type="button" data-g="' + g + '" aria-pressed="' + (st.g === g) + '">' +
        T('sp.g.' + g) + ' <span class="n">' + n + '</span></button>';
    });
    el.chips.innerHTML = html;
  }

  function render() {
    var rows = P.map(function (p, i) { return { p: p, i: i }; })
      .filter(function (r) { return !st.g || r.p.g === st.g; });
    el.list.innerHTML = rows.map(function (r) {
      var p = r.p;
      return '<li class="ph"><button type="button" data-i="' + r.i + '">' +
        '<span class="hint">' + T('sp.hint') + '</span>' +
        '<p class="k" lang="ko">' + H.esc(p.kr) + '</p>' +
        '<p class="r">' + H.esc(p.rom) + '</p>' +
        '<p class="e">' + H.esc(meaning(p)) + '</p>' +
        '</button></li>';
    }).join('');
  }

  el.chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    st.g = b.getAttribute('data-g') || '';
    buildChips();
    render();
  });

  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]');
    if (!b) return;
    open(Number(b.getAttribute('data-i')), b);
  });

  function open(i, from) {
    var p = P[i];
    if (!p) return;
    st.cur = p;
    st.lastFocus = from || null;
    el.kr.textContent = p.kr;
    el.mean.textContent = meaning(p);
    el.rom.textContent = p.rom;
    el.note.hidden = true;
    el.copy.textContent = T('sp.copy');
    el.ov.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    el.close.focus();
  }

  function close() {
    el.ov.hidden = true;
    document.documentElement.style.overflow = '';
    if (st.lastFocus && st.lastFocus.focus) st.lastFocus.focus();
  }

  el.close.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.ov.hidden) close();
  });

  el.copy.addEventListener('click', function () {
    if (!st.cur) return;
    var text = st.cur.kr;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        el.copy.textContent = T('sp.copied');
        el.note.hidden = true;
        setTimeout(function () { el.copy.textContent = T('sp.copy'); }, 1600);
      }, failCopy);
    } else {
      failCopy();
    }
  });

  function failCopy() {
    try {
      var r = document.createRange();
      r.selectNodeContents(el.kr);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) {}
    el.note.textContent = T('sp.copyFail');
    el.note.hidden = false;
  }

  H.onLangChange = function () {
    buildChips();
    render();
    if (st.cur) {
      el.mean.textContent = meaning(st.cur);
      el.rom.textContent = st.cur.rom;
      el.copy.textContent = T('sp.copy');
    }
    H.money($('#moneyHost'), 'speak', ['map', 'kit']);
  };

  buildChips();
  render();
  H.money($('#moneyHost'), 'speak', ['map', 'kit']);
  H.gate($('#moneyHost'), $('#ctaSentinel'), [el.list, el.chips]);
})();
