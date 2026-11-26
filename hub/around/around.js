/* Get around — airport fares view + point-to-point map links. No route API, no stored coordinates. */
(function () {
  'use strict';
  var H = window.HUB, $ = H.qs;
  var st = { spots: [], useLoc: false, nearest: null, lastRoute: null };
  var el = {
    chAirport: $('#chAirport'), chRoute: $('#chRoute'),
    pAirport: $('#pAirport'), pRoute: $('#pRoute'),
    from: $('#from'), to: $('#to'), mode: $('#mode'), swap: $('#btnSwap'), go: $('#btnGo'),
    myLoc: $('#btnMyLoc'), dl: $('#spotNames'),
    res: $('#result'), line: $('#routeLine'), g: $('#gLink'), n: $('#nLink'), note: $('#routeNote'),
    msgRoute: $('#msgRoute'), msgLoc: $('#msgLoc')
  };

  function T(k, v) { return H.t(k, v); }

  H.onLangChange = function () {
    paintMyLoc();
    if (st.msgKey) showMsg(st.msgKey.kind, st.msgKey.key);
    if (st.lastRoute) paintRoute(st.lastRoute);
    H.money($('#moneyHost'), 'around', ['map', 'kit']);
  };

  H.money($('#moneyHost'), 'around', ['map', 'kit']);
  H.gate($('#moneyHost'), $('#ctaSentinel'), [el.chAirport, el.chRoute, el.from, el.to, el.mode, el.go, el.myLoc, el.g]);

  /* ---------- choice ---------- */
  function choose(which) {
    var air = which === 'air';
    el.pAirport.hidden = !air;
    el.pRoute.hidden = air;
    el.chAirport.setAttribute('aria-pressed', air ? 'true' : 'false');
    el.chRoute.setAttribute('aria-pressed', air ? 'false' : 'true');
  }
  el.chAirport.addEventListener('click', function () { choose('air'); });
  el.chRoute.addEventListener('click', function () { choose('route'); el.to.focus(); });

  /* ---------- destination hints (names only, no coordinates shown) ---------- */
  fetch('../data/spots.json', { cache: 'force-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.spots) return;
      st.spots = d.spots;
      el.dl.innerHTML = d.spots.map(function (s) {
        return '<option value="' + H.esc(s.en) + '">' + H.esc(s.grp + ' · ' + s.kr) + '</option>';
      }).join('');
    })
    .catch(function () {});

  /* ---------- current location, only on tap ---------- */
  function paintMyLoc() {
    el.myLoc.setAttribute('aria-pressed', st.useLoc ? 'true' : 'false');
    el.myLoc.classList.toggle('on', st.useLoc);
    el.from.disabled = st.useLoc;
    if (st.useLoc) el.from.value = '';
  }

  el.myLoc.addEventListener('click', function () {
    if (st.useLoc) {              /* switch it back off */
      st.useLoc = false;
      st.nearest = null;
      paintMyLoc();
      hide(el.msgLoc);
      st.msgKey = null;
      return;
    }
    if (!navigator.geolocation) {
      showMsg('warn', 'ar.locFail');
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        /* one read: keep only the nearest place name, drop the coordinates */
        var lat = p.coords.latitude, lng = p.coords.longitude;
        var best = null, bd = Infinity;
        st.spots.forEach(function (s) {
          var d = H.km(lat, lng, s.lat, s.lng);
          if (d < bd) { bd = d; best = s; }
        });
        lat = null; lng = null; p = null;
        st.useLoc = true;
        st.nearest = best ? { name: best.en, m: H.dist(bd) } : null;
        paintMyLoc();
        showMsg('ok', 'ar.locOk');
      }, function () {
        st.useLoc = false;
        paintMyLoc();
        showMsg('warn', 'ar.locFail');
      }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 0 });
    } catch (e) {
      showMsg('warn', 'ar.locFail');
    }
  });

  /* ---------- swap ---------- */
  el.swap.addEventListener('click', function () {
    var a = el.from.value, b = el.to.value;
    el.from.value = b; el.to.value = a;
  });

  /* ---------- build the two links ---------- */
  el.go.addEventListener('click', build);
  el.to.addEventListener('keydown', function (e) { if (e.key === 'Enter') build(); });

  function findSpot(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    for (var i = 0; i < st.spots.length; i++) {
      if (st.spots[i].en.toLowerCase() === n) return st.spots[i];
    }
    return null;
  }

  function build() {
    var dest = el.to.value.trim();
    if (!dest) { showMsg('warn', 'ar.errNoDest'); el.to.focus(); return; }
    hide(el.msgRoute);

    var mode = el.mode.value;
    var fromText = st.useLoc ? '' : el.from.value.trim();
    var spot = findSpot(dest);
    var fromSpot = fromText ? findSpot(fromText) : null;
    var seg = mode === 'walking' ? 'walk' : (mode === 'driving' ? 'car' : 'transit');

    var g = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest) +
      '&travelmode=' + (mode === 'walking' ? 'walking' : (mode === 'driving' ? 'driving' : 'transit'));
    if (fromText) {
      g = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(fromText) +
        '&destination=' + encodeURIComponent(dest) +
        '&travelmode=' + (mode === 'walking' ? 'walking' : (mode === 'driving' ? 'driving' : 'transit'));
    }

    /* Naver's directions URL needs coordinates at both ends. Public place coordinates from the
       109-pin list are fine; the traveller's own coordinates are never put in a URL, so a route
       that would start from the device falls back to a destination search. */
    var nUrl, naverSearch = false;
    if (spot && fromSpot) {
      nUrl = 'https://map.naver.com/p/directions/' +
        fromSpot.lng + ',' + fromSpot.lat + ',' + encodeURIComponent(fromSpot.en) + '/' +
        spot.lng + ',' + spot.lat + ',' + encodeURIComponent(spot.en) + '/-/' + seg;
    } else {
      naverSearch = true;
      nUrl = 'https://map.naver.com/p/search/' + encodeURIComponent(dest);
    }

    st.lastRoute = {
      from: st.useLoc ? T('ar.myLocShort') : (fromText || ''),
      to: dest, g: g, n: nUrl, omit: st.useLoc, naverSearch: naverSearch
    };
    paintRoute(st.lastRoute);
  }

  function paintRoute(r) {
    el.line.innerHTML = T('ar.resLabel', { a: H.esc(r.from || '—'), b: H.esc(r.to) });
    el.g.href = r.g;
    el.n.href = r.n;
    el.note.textContent = T(r.omit ? 'ar.noteOmit' : 'ar.noteWith') + (r.naverSearch ? ' ' + T('ar.noteNaverSearch') : '');
    el.res.hidden = false;
  }

  /* ---------- messages ---------- */
  function showMsg(kind, key) {
    st.msgKey = { kind: kind, key: key };
    var node = kind === 'ok' ? el.msgLoc : el.msgRoute;
    var other = kind === 'ok' ? el.msgRoute : el.msgLoc;
    hide(other);
    node.textContent = T(key) + (kind === 'ok' && st.nearest
      ? ' (' + st.nearest.name + ' · ' + st.nearest.m + ')' : '');
    node.hidden = false;
  }
  function hide(n) { n.hidden = true; n.textContent = ''; }
})();
