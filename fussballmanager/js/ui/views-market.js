/* Ansichten: Transfermarkt und Finanzen. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  /* ================= Transfermarkt ================= */
  var PAGE = 40;
  UI.views.transfers = {
    title: 'Transfermarkt',
    render: function () {
      var st = FM.state, uc = st.user.club, club = st.clubs[uc];
      var s = UI.vs('transfers', { tab: 'search', q: '', grp: 'all', pos: 'all', league: 'all', minOvr: 0, maxAge: 40, maxPrice: 0, onlyListed: false, free: false, sort: 'ovr', dir: -1, page: 0 });
      var open = FM.isWindowOpen(st);
      var html = '<div class="page-h"><div><h1>Transfermarkt</h1><div class="sub"><span class="tag ' + (open ? 'good' : '') + '">' + esc(FM.windowLabel(st)) + '</span> · Kontostand ' + FM.fmtMoney(club.money) + ' · Kader ' + club.squad.length + '/34</div></div>' +
        UI.seg('tab', [['search', 'Spielersuche'], ['offers', 'Angebote'], ['mine', 'Meine Transferliste'], ['log', 'Transferticker']], s.tab) + '</div>';

      if (s.tab === 'search') return html + searchView(s);
      if (s.tab === 'offers') return html + offersView();
      if (s.tab === 'mine') return html + myListView();
      return html + logView();
    },
    mount: function (el) {
      var s = UI.vs('transfers');
      var q = el.querySelector('#t-q');
      if (q) {
        var timer;
        q.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { s.q = q.value; s.page = 0; UI.refresh(); var nq = document.getElementById('t-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 250);
        });
      }
      el.querySelectorAll('[data-filter]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var k = inp.getAttribute('data-filter');
          var numeric = { minOvr: 1, maxAge: 1, maxPrice: 1 };
          s[k] = inp.type === 'checkbox' ? inp.checked : numeric[k] ? +inp.value : inp.value;
          s.page = 0;
          UI.refresh();
        });
      });
    }
  };

  function searchView(s) {
    var st = FM.state, uc = st.user.club;
    var q = (s.q || '').toLowerCase().trim();
    var list = [];
    Object.keys(st.players).forEach(function (pid) {
      var p = st.players[pid];
      if (p.club === uc) return;
      if (s.free && p.club) return;
      if (p.club && st.clubs[p.club].league === 'rl' && s.league !== 'rl' && s.league !== 'all') return;
      if (s.league !== 'all' && (!p.club || st.clubs[p.club].league !== s.league)) return;
      if (s.grp !== 'all' && FM.mainGroup(p) !== s.grp) return;
      if (s.pos !== 'all' && p.pos.indexOf(s.pos) < 0) return;
      if (p.ovr < s.minOvr || p.age > s.maxAge) return;
      if (s.onlyListed && !p.listed) return;
      if (q && p.name.toLowerCase().indexOf(q) < 0 && !(p.club && st.clubs[p.club].name.toLowerCase().indexOf(q) >= 0)) return;
      list.push(p);
    });
    var price = function (p) { return p.club ? FM.askingPrice(st, p) : 0; };
    if (s.maxPrice) list = list.filter(function (p) { return price(p) <= s.maxPrice; });
    var key = { ovr: function (p) { return p.ovr; }, pot: function (p) { return p.pot; }, age: function (p) { return p.age; }, value: function (p) { return FM.marketValue(p); }, price: price, name: function (p) { return p.name; } }[s.sort] || function (p) { return p.ovr; };
    list.sort(function (a, b) { var x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (s.dir || -1) || b.ovr - a.ovr; });
    var total = list.length, page = Math.min(s.page || 0, Math.max(0, Math.ceil(total / PAGE) - 1));
    var rows = list.slice(page * PAGE, page * PAGE + PAGE);
    var posOpts = [['all', 'Alle Positionen']].concat(FM.POS_ORDER.map(function (p) { return [p, FM.POS_NAME[p]]; }));
    var filters = '<div class="card" style="margin-bottom:14px"><div class="card-b" style="padding-top:14px"><div class="filters" style="margin-bottom:0">' +
      '<div class="field" style="min-width:200px;flex:1"><label for="t-q">Suche</label><input class="input" id="t-q" placeholder="Spieler oder Verein" value="' + esc(s.q) + '"></div>' +
      sel('Position', 'pos', posOpts, s.pos) +
      sel('Liga', 'league', [['all', 'Alle Ligen'], ['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rl', 'Regionalliga']], s.league) +
      sel('Stärke ab', 'minOvr', [[0, 'beliebig'], [60, '60+'], [65, '65+'], [70, '70+'], [75, '75+'], [80, '80+'], [85, '85+']], s.minOvr) +
      sel('Alter bis', 'maxAge', [[40, 'beliebig'], [21, '21'], [23, '23'], [25, '25'], [28, '28'], [31, '31']], s.maxAge) +
      sel('Ablöse bis', 'maxPrice', [[0, 'beliebig'], [250000, '250 Tsd.'], [1000000, '1 Mio.'], [3000000, '3 Mio.'], [10000000, '10 Mio.'], [25000000, '25 Mio.'], [60000000, '60 Mio.']], s.maxPrice) +
      '<div class="field"><label>&nbsp;</label><div class="row" style="height:36px;gap:14px"><label class="check"><input type="checkbox" data-filter="onlyListed"' + (s.onlyListed ? ' checked' : '') + '> Transferliste</label><label class="check"><input type="checkbox" data-filter="free"' + (s.free ? ' checked' : '') + '> Vereinslos</label></div></div>' +
      '</div></div></div>';
    var th = function (k, l, cls) { return UI.sortTh('transfers', k, l, s.sort, s.dir, cls); };
    var table = '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pos</th>' + th('name', 'Spieler') + '<th class="hide-sm">Verein</th>' + th('age', 'Alter', 'num') + th('ovr', 'Stärke', 'num') + th('pot', 'Pot.', 'num hide-xs') + th('value', 'Marktwert', 'num hide-sm') + th('price', 'Ablöse', 'num') + '<th class="hide-xs">Interesse</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (p) {
        var il = FM.interestLabel(FM.interest(st, p, uc));
        return '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td><span class="pname">' + esc(p.name) + '</span>' + UI.srcMark(p) + (p.listed ? ' <span class="tag info">gelistet</span>' : '') + (p.injury ? ' <span class="tag bad">verletzt</span>' : '') + '<div class="muted tiny show-sm">' + (p.club ? esc(st.clubs[p.club].short) : 'vereinslos') + '</div></td>' +
          '<td class="hide-sm">' + (p.club ? UI.clubLink(p.club) : '<span class="tag">vereinslos</span>') + '</td><td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="num hide-xs">' + UI.potRange(p) + '</td>' +
          '<td class="num hide-sm">' + FM.fmtMoney(FM.marketValue(p)) + '</td><td class="num strong">' + (p.club ? FM.fmtMoney(price(p)) : 'ablösefrei') + '</td><td class="hide-xs"><span class="tag ' + il.c + '">' + il.t + '</span></td></tr>';
      }).join('') : '<tr><td colspan="9"><div class="empty">Keine Spieler gefunden.</div></td></tr>') + '</tbody></table></div>' +
      '<div class="modal-f" style="justify-content:space-between;align-items:center"><span class="muted small">' + FM.fmtInt(total) + ' Spieler · Seite ' + (page + 1) + ' von ' + Math.max(1, Math.ceil(total / PAGE)) + '</span><div class="row">' +
      '<button class="btn sm" data-action="setUi" data-k="page" data-v="' + Math.max(0, page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>' + UI.icon('back') + ' Zurück</button>' +
      '<button class="btn sm" data-action="setUi" data-k="page" data-v="' + (page + 1) + '"' + ((page + 1) * PAGE >= total ? ' disabled' : '') + '>Weiter ' + UI.icon('next') + '</button></div></div></div>';
    return filters + table;
  }

  function sel(label, key, opts, cur) {
    return '<div class="field"><label>' + label + '</label><select class="input" data-filter="' + key + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></div>';
  }

  function offersView() {
    var st = FM.state;
    var open = st.offers.filter(function (o) { return o.status === 'open'; });
    var past = st.offers.filter(function (o) { return o.status !== 'open'; }).slice(-15).reverse();
    function row(o, act) {
      var p = st.players[o.pid];
      return '<div class="li">' + UI.badge(st.clubs[o.from], 30) + '<div class="grow"><div class="strong">' + esc(st.clubs[o.from].name) + ' bietet ' + FM.fmtMoney(o.fee) + '</div><div class="muted small">für ' + (p ? UI.playerLink(p) + ' (Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + ')' : 'ehemaligen Spieler') + ' · ' + (act ? 'gültig bis ' + D.fmt(o.expires) : ({ accepted: 'angenommen', declined: 'abgelehnt', expired: 'abgelaufen' }[o.status])) + '</div></div>' +
        (act ? '<button class="btn sm" data-action="offerRespond" data-id="' + o.id + '" data-ok="0">Ablehnen</button><button class="btn sm primary" data-action="offerRespond" data-id="' + o.id + '" data-ok="1">Annehmen</button>' : '') + '</div>';
    }
    return '<div class="card"><div class="card-h"><h3>Offene Angebote für deine Spieler</h3></div><div class="list">' + (open.length ? open.map(function (o) { return row(o, true); }).join('') : '<div class="empty">Keine offenen Angebote. Setze Spieler auf die Transferliste, um Interessenten anzulocken.</div>') + '</div></div>' +
      (past.length ? '<div class="card"><div class="card-h"><h3>Frühere Angebote</h3></div><div class="list">' + past.map(function (o) { return row(o, false); }).join('') + '</div></div>' : '');
  }

  function myListView() {
    var st = FM.state;
    var mine = FM.clubPlayers(st, st.user.club).filter(function (p) { return p.listed; });
    return '<div class="card"><div class="card-h"><h3>Auf der Transferliste</h3></div><div class="list">' + (mine.length ? mine.map(function (p) {
      return '<div class="li click" data-action="player" data-id="' + p.id + '">' + UI.posTag(p.pos[0]) + '<div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="muted small">' + p.age + ' Jahre · Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + '</div></div>' + UI.pill(p.ovr) + '</div>';
    }).join('') : '<div class="empty">Kein Spieler gelistet. Öffne ein Spielerprofil im Kader, um ihn anzubieten.</div>') + '</div></div>' +
      '<p class="muted small" style="margin-top:10px">Gelistete Spieler erhalten während geöffneter Transferfenster regelmäßig Angebote. Sie sind etwas günstiger zu haben – andere Vereine wissen das.</p>';
  }

  function logView() {
    var st = FM.state;
    var list = st.transfers.slice(0, 80);
    return '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Spieler</th><th class="hide-sm">Von</th><th>Nach</th><th class="num">Ablöse</th></tr></thead><tbody>' +
      (list.length ? list.map(function (t) {
        var p = st.players[t.pid];
        return '<tr' + (t.to === st.user.club || t.from === st.user.club ? ' class="me"' : '') + '><td class="nowrap small">' + D.fmt(t.date) + '</td><td>' + (p ? UI.playerLink(p) : esc(t.name)) + ' <span class="muted small">' + FM.POS_LABEL[t.pos] + ' · ' + t.ovr + '</span></td>' +
          '<td class="hide-sm">' + (t.from ? UI.clubLink(t.from) : '<span class="muted">vereinslos</span>') + '</td><td>' + UI.clubLink(t.to) + '</td><td class="num">' + (t.fee ? FM.fmtMoney(t.fee) : '<span class="muted">ablösefrei</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="5"><div class="empty">Noch keine Transfers.</div></td></tr>') + '</tbody></table></div></div>';
  }

  /* ================= Finanzen ================= */
  UI.views.finances = {
    title: 'Finanzen',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var plan = FM.annualPlan(club);
      var wages = FM.annualWages(st, club);
      var fin = club.fin, prev = club.finPrev;
      var inc = ['tv', 'sponsor', 'tickets', 'prize', 'sales'], exp = ['wages', 'ops', 'buys', 'other'];
      var sumIn = FM.sum(inc, function (k) { return fin[k] || 0; }), sumOut = FM.sum(exp, function (k) { return fin[k] || 0; });
      function line(k) {
        return '<tr><td>' + FM.LEDGER_LABEL[k] + '</td><td class="num">' + FM.fmtMoney(fin[k] || 0) + '</td>' + (prev ? '<td class="num muted hide-xs">' + FM.fmtMoney(prev[k] || 0) + '</td>' : '') + '</tr>';
      }
      var html = '<div class="page-h"><div><h1>Finanzen</h1><div class="sub">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + ' – alle Beträge in Euro</div></div></div>';
      html += '<div class="grid g4" style="margin-bottom:16px">' +
        tile('Kontostand', FM.fmtMoney(club.money), club.money < 0 ? '<span class="bad">Im Minus – der Vorstand wird nervös</span>' : 'Verfügbar für Transfers') +
        tile('Saisonbilanz', FM.fmtMoney(sumIn + sumOut, { sign: true }), 'Einnahmen ' + FM.fmtMoney(sumIn)) +
        tile('Gehaltskosten', FM.fmtMoney(wages), FM.fmtMoney(wages / 52) + ' pro Woche') +
        tile('Planbare Einnahmen', FM.fmtMoney(plan.tv + plan.sponsor), 'TV ' + FM.fmtMoneyShort(plan.tv) + ' · Sponsoring ' + FM.fmtMoneyShort(plan.sponsor)) + '</div>';
      html += '<div class="grid dash"><div class="stack">' + balanceChart(club) + '</div><div class="stack">' +
        '<div class="card"><div class="card-h"><h3>Einnahmen & Ausgaben</h3></div><div class="card-b flush"><table class="tbl"><thead><tr><th></th><th class="num">Diese Saison</th>' + (prev ? '<th class="num hide-xs">Vorsaison</th>' : '') + '</tr></thead><tbody>' +
        '<tr class="group"><td colspan="3">Einnahmen</td></tr>' + inc.map(line).join('') +
        '<tr class="group"><td colspan="3">Ausgaben</td></tr>' + exp.map(line).join('') +
        '<tr><td class="strong">Saldo</td><td class="num strong ' + (sumIn + sumOut >= 0 ? 'good' : 'bad') + '">' + FM.fmtMoney(sumIn + sumOut) + '</td>' + (prev ? '<td class="num muted hide-xs"></td>' : '') + '</tr></tbody></table></div></div>' +
        '<div class="card"><div class="card-h"><h3>Jahresplanung</h3></div><div class="card-b"><dl class="kv">' +
        '<dt>TV-Gelder</dt><dd>' + FM.fmtMoney(plan.tv) + '</dd><dt>Sponsoring & Marketing</dt><dd>' + FM.fmtMoney(plan.sponsor) + '</dd><dt>Betriebskosten</dt><dd>' + FM.fmtMoney(-plan.ops) + '</dd>' +
        '<dt>Gehälter</dt><dd>' + FM.fmtMoney(-wages) + '</dd><dt>Ticketpreis Ø</dt><dd>' + (FM.ticketPrice[club.league] || 0) + ' €</dd></dl>' +
        '<p class="muted small" style="margin-top:10px">TV und Sponsoring werden von August bis Mai monatlich ausgezahlt, Gehälter wöchentlich. Zuschauereinnahmen gibt es bei jedem Heimspiel.</p></div></div></div></div>';
      return html;
    },
    mount: function (el) { mountChart(el); }
  };

  function tile(label, value, meta) {
    return '<div class="card stat"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="meta">' + meta + '</div></div>';
  }

  /* Einzelne Zeitreihe (Kontostand) als SVG-Linie mit Fadenkreuz-Tooltip */
  function balanceChart(club) {
    var pts = (club.bal || []).slice(-60);
    if (pts.length < 2) return '<div class="card"><div class="card-h"><h3>Kontostand</h3></div><div class="empty">Der Verlauf erscheint nach den ersten Wochen.</div></div>';
    return '<div class="card"><div class="card-h"><h3>Kontostand</h3><span class="muted small">wöchentlich, letzte ' + pts.length + ' Wochen</span></div>' +
      '<div class="card-b"><div class="chart-wrap" id="bal-chart" data-points=\'' + JSON.stringify(pts) + '\'></div>' +
      '<details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Als Tabelle anzeigen</summary><div class="tbl-wrap" style="max-height:240px;overflow:auto;margin-top:8px"><table class="tbl compact"><tbody>' +
      pts.slice().reverse().map(function (p) { return '<tr><td>' + D.fmt(p[0]) + '</td><td class="num">' + FM.fmtMoney(p[1]) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div></div>';
  }

  function mountChart(root) {
    var host = root.querySelector('#bal-chart');
    if (!host) return;
    var pts = JSON.parse(host.getAttribute('data-points'));
    var W = Math.max(280, host.clientWidth || 600), H = 220, pl = 56, pr = 14, pt = 12, pb = 26;
    var vals = pts.map(function (p) { return p[1]; });
    var mn = Math.min.apply(null, vals.concat([0])), mx = Math.max.apply(null, vals);
    if (mx === mn) mx = mn + 1;
    var step = niceStep((mx - mn) / 4);
    mn = Math.floor(mn / step) * step; mx = Math.ceil(mx / step) * step;
    var x = function (i) { return pl + (W - pl - pr) * i / (pts.length - 1); };
    var y = function (v) { return pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn)); };
    var grid = '';
    for (var v = mn; v <= mx + 1; v += step) {
      grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (pl - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--text-3)" style="font-variant-numeric:tabular-nums">' + FM.fmtMoneyShort(v) + '</text>';
    }
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + y(Math.max(mn, 0)).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(Math.max(mn, 0)).toFixed(1) + ' Z';
    var labels = '';
    [0, Math.floor(pts.length / 2), pts.length - 1].forEach(function (i) {
      labels += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '" font-size="11" fill="var(--text-3)">' + D.fmtShort(pts[i][0]) + D.year(pts[i][0]).toString().slice(2) + '</text>';
    });
    var last = pts[pts.length - 1];
    var lx = x(pts.length - 1), ly = y(last[1]);
    host.innerHTML = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verlauf des Kontostands">' + grid +
      (mn < 0 ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="var(--line-strong)" stroke-width="1"/>' : '') +
      '<path d="' + area + '" fill="var(--accent)" opacity=".1"/><path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + lx + '" cy="' + ly + '" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>' + labels +
      '<line id="bal-x" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--text-3)" stroke-width="1" visibility="hidden"/>' +
      '<circle id="bal-dot" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>' +
      '<rect x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '" fill="transparent" id="bal-hit" tabindex="0"/></svg>' +
      '<div class="chart-tip" id="bal-tip"></div>';
    var svg = host.querySelector('svg'), hit = host.querySelector('#bal-hit'), xl = host.querySelector('#bal-x'), dot = host.querySelector('#bal-dot'), tip = host.querySelector('#bal-tip');
    function show(i) {
      i = FM.clamp(i, 0, pts.length - 1);
      var px = x(i), py = y(pts[i][1]);
      xl.setAttribute('x1', px); xl.setAttribute('x2', px); xl.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
      var r = svg.getBoundingClientRect(), sx = r.width / W;
      tip.style.display = 'block';
      tip.style.left = (px * sx) + 'px';
      tip.style.top = (py * sx) + 'px';
      tip.textContent = '';
      var b = document.createElement('b'); b.textContent = FM.fmtMoney(pts[i][1]);
      var d = document.createElement('div'); d.className = 'muted'; d.textContent = 'Kontostand · ' + D.fmt(pts[i][0]);
      tip.appendChild(b); tip.appendChild(d);
    }
    function hide() { xl.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; }
    var cur = pts.length - 1;
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      var vx = (e.clientX - r.left) / r.width * W;
      cur = Math.round((vx - pl) / (W - pl - pr) * (pts.length - 1));
      show(cur);
    });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', function () { show(cur); });
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { cur = Math.max(0, cur - 1); show(cur); }
      if (e.key === 'ArrowRight') { cur = Math.min(pts.length - 1, cur + 1); show(cur); }
    });
  }

  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
    var n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
})();
