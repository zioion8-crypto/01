/* Find nearby — filters, sorting and one-time location read. Coordinates never leave memory. */
(function () {
  'use strict';
  var H = window.HUB, $ = H.qs;
  var KEY_FAV = 'ktbhub.favs.v1';
  var KEY_FIL = 'ktbhub.filters.nearby.v1';

  var CATORDER = ['food', 'cafe', 'market', 'culture', 'indoor', 'beauty', 'kpop', 'transit'];
  var CITYORDER = { Seoul: 1, Busan: 2, Jeju: 3 };

  var st = {
    all: [], groups: {}, favs: {},
    city: '', grp: '', cat: '', q: '',
    sort: 'area', savedOnly: false, shown: 12,
    dist: null, ready: false, located: false,
    msg: null
  };

  var el = {
    list: $('#list'), count: $('#count'), sorted: $('#sorted'), empty: $('#empty'),
    more: $('#btnMore'), q: $('#q'), chips: $('#catChips'), city: $('#selCity'),
    area: $('#selArea'), sort: $('#selSort'), saved: $('#btnSaved'), clear: $('#btnClear'),
    locate: $('#btnLocate'), areaBtn: $('#btnArea'),
    msgOk: $('#msgOk'), msgWarn: $('#msgWarn'), msgInfo: $('#msgInfo')
  };

  function T(k, v) { return H.t(k, v); }
  function catName(c) { return T('cat.' + c); }
  function cityName(c) { return T('city.' + c); }

  /* ---------- boot ---------- */
  loadFavs();
  H.onLangChange = onLangChange;
  paintLocate();
  fetch('../data/spots.json', { cache: 'force-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      st.all = data.spots || [];
      st.groups = data.groups || {};
      st.ready = true;
      buildChips();
      buildAreas();
      restoreFilters();
      bind();
      H.money($('#moneyHost'), 'nearby', ['map', 'kit', 'guide']);
      H.gate($('#moneyHost'), $('#ctaSentinel'), [el.locate, el.areaBtn, el.q, el.city, el.area, el.sort, el.saved, el.list]);
      render();
    })
    .catch(function (e) {
      el.list.innerHTML = '<li class="empty">' + H.esc(e.message) + ' — <a href="https://koreatravelbible.com/free/">free sample</a></li>';
    });

  /* ---------- favourites (ids only) ---------- */
  function loadFavs() {
    var a = H.get(KEY_FAV, []);
    if (Object.prototype.toString.call(a) !== '[object Array]') a = [];
    st.favs = {};
    a.forEach(function (n) { st.favs[n] = true; });
    paintSaved();
  }
  function saveFavs() {
    H.set(KEY_FAV, Object.keys(st.favs).map(Number));
    paintSaved();
  }
  function paintSaved() {
    var n = Object.keys(st.favs).length;
    el.saved.textContent = T('nb.savedN', { n: n });
    el.saved.setAttribute('aria-pressed', st.savedOnly ? 'true' : 'false');
    el.saved.classList.toggle('on', st.savedOnly);
  }

  /* ---------- chips ---------- */
  function buildChips() {
    var counts = {};
    st.all.forEach(function (s) { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    var on = st.cat === '';
    var html = '<button class="chip' + (on ? ' on' : '') + '" type="button" data-cat="" aria-pressed="' + on + '">' +
      T('cat.all') + ' <span class="n">' + st.all.length + '</span></button>';
    CATORDER.forEach(function (c) {
      if (!counts[c]) return;
      var sel = st.cat === c;
      html += '<button class="chip' + (sel ? ' on' : '') + '" type="button" data-cat="' + c + '" aria-pressed="' + sel + '">' +
        catName(c) + ' <span class="n">' + counts[c] + '</span></button>';
    });
    el.chips.innerHTML = html;
  }

  function buildAreas() {
    var html = '<option value="">' + T('nb.allAreas') + '</option>';
    var cities = Object.keys(st.groups).sort(function (a, b) { return CITYORDER[a] - CITYORDER[b]; });
    if (st.city) {
      var g = st.groups[st.city] || {};
      Object.keys(g).sort().forEach(function (name) {
        html += '<option value="' + H.esc(name) + '">' + H.esc(name) + ' (' + g[name] + ')</option>';
      });
    } else {
      cities.forEach(function (c) {
        html += '<optgroup label="' + H.esc(cityName(c)) + '">';
        Object.keys(st.groups[c]).sort().forEach(function (name) {
          html += '<option value="' + H.esc(name) + '">' + H.esc(name) + ' (' + st.groups[c][name] + ')</option>';
        });
        html += '</optgroup>';
      });
    }
    el.area.innerHTML = html;
    el.area.value = st.grp || '';
    /* city labels follow the interface language */
    H.qsa('#selCity option[value]').forEach(function (o) {
      var v = o.value;
      if (v) o.textContent = cityName(v);
      else o.textContent = T('nb.allCities');
    });
  }

  /* ---------- saved filters (city/area/category only) ---------- */
  function restoreFilters() {
    var f = H.get(KEY_FIL, null);
    if (!f || typeof f !== 'object') return;
    if (f.city && st.groups[f.city]) { st.city = f.city; el.city.value = f.city; }
    buildAreas();
    if (f.grp && st.groups[st.city] && st.groups[st.city][f.grp]) { st.grp = f.grp; el.area.value = f.grp; }
    if (f.cat) st.cat = f.cat;
    buildChips();
    if (f.q) { st.q = String(f.q); el.q.value = st.q; }
  }
  function saveFilters() {
    H.set(KEY_FIL, { city: st.city, grp: st.grp, cat: st.cat, q: st.q });
  }

  /* ---------- events ---------- */
  function bind() {
    el.chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      st.cat = b.getAttribute('data-cat') || '';
      st.shown = 12;
      buildChips(); saveFilters(); render();
    });

    el.city.addEventListener('change', function () {
      st.city = el.city.value;
      st.grp = '';
      buildAreas();
      st.shown = 12; saveFilters(); render();
    });

    el.area.addEventListener('change', function () {
      st.grp = el.area.value;
      if (!st.city && st.grp) {
        var found = '';
        Object.keys(st.groups).forEach(function (c) { if (st.groups[c][st.grp]) found = c; });
        if (found) { st.city = found; el.city.value = found; buildAreas(); el.area.value = st.grp; }
      }
      st.shown = 12; saveFilters(); render();
    });

    var t;
    el.q.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        st.q = el.q.value.trim().toLowerCase();
        st.shown = 12; saveFilters(); render();
      }, 120);
    });

    el.sort.addEventListener('change', function () {
      if (el.sort.value === 'near' && !st.dist) { el.sort.value = st.sort; return; }
      st.sort = el.sort.value;
      st.shown = 12; render();
    });

    el.saved.addEventListener('click', function () {
      st.savedOnly = !st.savedOnly;
      st.shown = 12;
      paintSaved(); render();
    });

    el.more.addEventListener('click', function () { st.shown += 12; render(); });
    el.locate.addEventListener('click', locate);
    el.areaBtn.addEventListener('click', function () {
      el.city.focus();
      el.city.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setMsg('info', 'nb.chooseInfo');
    });

    el.clear.addEventListener('click', function () {
      H.del(KEY_FAV); H.del(KEY_FIL);
      st.favs = {}; st.city = ''; st.grp = ''; st.cat = ''; st.q = '';
      el.q.value = ''; el.city.value = '';
      buildAreas(); buildChips(); paintSaved();
      st.savedOnly = false; st.shown = 12;
      setMsg('info', 'nb.cleared');
      render();
    });

    el.list.addEventListener('click', function (e) {
      var fav = e.target.closest('.fav');
      if (!fav) return;
      var no = Number(fav.getAttribute('data-no'));
      if (st.favs[no]) { delete st.favs[no]; fav.setAttribute('aria-pressed', 'false'); }
      else { st.favs[no] = true; fav.setAttribute('aria-pressed', 'true'); }
      saveFavs();
      if (st.savedOnly) render();
    });
  }

  /* ---------- location: one read, on tap only, then dropped ---------- */
  function locate() {
    if (!navigator.geolocation) {
      paintLocate();
      setMsg('warn', 'nb.msgNoGeo');
      el.city.focus();
      return;
    }
    el.locate.classList.add('is-off');
    el.locate.textContent = T('nb.locating');
    clearMsg();
    try {
      navigator.geolocation.getCurrentPosition(onFix, onFail, {
        enableHighAccuracy: false, timeout: 9000, maximumAge: 0
      });
    } catch (e) {
      onFail(e);
    }
  }

  function onFix(p) {
    /* coordinates live in these locals only — nothing reaches localStorage, the URL or the DOM */
    var lat = p.coords.latitude, lng = p.coords.longitude;
    var d = {};
    st.all.forEach(function (s) { d[s.no] = H.km(lat, lng, s.lat, s.lng); });
    lat = null; lng = null; p = null;
    st.dist = d;
    st.located = true;
    st.sort = 'near';
    var o = el.sort.querySelector('option[value="near"]');
    o.disabled = false;
    el.sort.value = 'near';
    st.shown = 12;
    paintLocate();
    setMsg('ok', 'nb.msgOk');
    render();
  }

  function onFail(err) {
    paintLocate();
    var code = err && err.code;
    setMsg('warn', code === 1 ? 'nb.msgDenied' : (code === 3 ? 'nb.msgTimeout' : 'nb.msgOther'));
    el.city.focus();
  }

  function paintLocate() {
    el.locate.classList.remove('is-off');
    el.locate.textContent = T(st.dist ? 'nb.locateAgain' : 'nb.locate');
  }

  /* ---------- messages ---------- */
  function setMsg(kind, key) {
    st.msg = { kind: kind, key: key };
    paintMsg();
  }
  function clearMsg() {
    st.msg = null;
    paintMsg();
  }
  function paintMsg() {
    [el.msgOk, el.msgWarn, el.msgInfo].forEach(function (n) { n.hidden = true; n.textContent = ''; });
    if (!st.msg) return;
    var node = st.msg.kind === 'ok' ? el.msgOk : (st.msg.kind === 'warn' ? el.msgWarn : el.msgInfo);
    node.textContent = T(st.msg.key);
    node.hidden = false;
  }

  /* ---------- language change ---------- */
  function onLangChange() {
    paintLocate();
    paintSaved();
    paintMsg();
    if (!st.ready) return;
    buildChips();
    buildAreas();
    render();
    H.money($('#moneyHost'), 'nearby', ['map', 'kit', 'guide']);
  }

  /* ---------- render ---------- */
  function render() {
    var q = st.q;
    var rows = st.all.filter(function (s) {
      if (st.city && s.city !== st.city) return false;
      if (st.grp && s.grp !== st.grp) return false;
      if (st.cat && s.cat !== st.cat) return false;
      if (st.savedOnly && !st.favs[s.no]) return false;
      if (q) {
        var hay = (s.en + ' ' + s.kr + ' ' + s.area + ' ' + s.grp + ' ' + cityName(s.city) + ' ' + s.addr + ' ' + catName(s.cat)).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (st.sort === 'near' && st.dist) {
      rows.sort(function (a, b) { return st.dist[a.no] - st.dist[b.no]; });
    } else if (st.sort === 'az') {
      rows.sort(function (a, b) { return a.en.localeCompare(b.en); });
    } else {
      rows.sort(function (a, b) {
        return (CITYORDER[a.city] - CITYORDER[b.city]) || a.grp.localeCompare(b.grp) || a.en.localeCompare(b.en);
      });
    }

    el.count.innerHTML = T(rows.length === 1 ? 'nb.countOne' : 'nb.count', { n: rows.length }) +
      (rows.length !== st.all.length ? T('nb.countOf', { t: st.all.length }) : '');
    el.sorted.textContent = st.sort === 'near' ? T('nb.sortedNear') : (st.sort === 'az' ? T('nb.sortedAz') : T('nb.sortedArea'));

    el.list.innerHTML = rows.slice(0, st.shown).map(card).join('');
    el.empty.hidden = rows.length !== 0;
    el.more.hidden = rows.length <= st.shown;
    if (!el.more.hidden) {
      el.more.textContent = T('nb.more', { n: Math.min(12, rows.length - st.shown), left: rows.length - st.shown });
    }
    paintSaved();
  }

  function card(s) {
    var d = st.dist && st.dist[s.no];
    return '<li class="spot">' +
      '<div class="top">' +
      '<span class="cat">' + H.esc(catName(s.cat)) + '</span>' +
      (d != null ? '<span class="dist" title="' + H.esc(T('nb.straight')) + '">' + H.dist(d) + '</span>' : '') +
      '<button class="fav" type="button" data-no="' + s.no + '" aria-pressed="' + (st.favs[s.no] ? 'true' : 'false') +
      '" aria-label="' + H.esc(T('nb.save', { name: s.en })) + '">★</button>' +
      '</div>' +
      '<h3>' + H.esc(s.en) + '</h3>' +
      '<p class="kr">' + H.esc(s.kr) + '</p>' +
      '<p class="meta">' + H.esc(s.grp) + ' · ' + H.esc(cityName(s.city)) + '</p>' +
      '<p class="addr">' + H.esc(s.addr) + '</p>' +
      '<p class="links">' +
      '<a href="' + H.esc(s.naver) + '" target="_blank" rel="noopener">' + T('nb.naver') + '</a>' +
      '<a href="' + H.esc(s.google) + '" target="_blank" rel="noopener">' + T('nb.google') + '</a>' +
      '<span class="v">' + H.esc(T('nb.checked', { d: s.verified })) + '</span>' +
      '</p></li>';
  }
})();
