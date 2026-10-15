/* Ansicht: Finanzen. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  /* ================= Finanzen ================= */
  UI.views.finances = {
    title: 'Finanzen',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var plan = FM.annualPlan(club);
      var wages = FM.annualWages(st, club);
      var fin = club.fin, prev = club.finPrev;
      var inc = ['tv', 'sponsor', 'tickets', 'prize', 'sales', 'owner'], exp = ['wages', 'ops', 'buys', 'fees', 'infra', 'debt', 'other'];
      var sumIn = FM.sum(inc, function (k) { return fin[k] || 0; }), sumOut = FM.sum(exp, function (k) { return fin[k] || 0; });
      function line(k) {
        return '<tr><td>' + FM.LEDGER_LABEL[k] + '</td><td class="num">' + FM.fmtMoney(fin[k] || 0) + '</td>' + (prev ? '<td class="num muted hide-xs">' + FM.fmtMoney(prev[k] || 0) + '</td>' : '') + '</tr>';
      }
      var html = '<div class="page-h"><div><div class="eyebrow">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + '</div><h1>Finanzen & Budget</h1><div class="sub">Der Vorstand legt zu Saisonbeginn und im Januar fest, wie viel Geld für Ablösen und Gehälter bereitsteht. Verkaufserlöse fließen zu ' + Math.round(FM.budget(st, club).salesShare * 100) + ' % zurück ins Transferbudget.</div></div></div>' +
        UI.budgetPanel();
      html += '<div class="grid g4" style="margin-bottom:16px">' +
        tile('Kontostand', FM.fmtMoney(club.money), club.money < 0 ? '<span class="bad">Im Minus – der Vorstand wird nervös</span>' : 'davon frei: ' + FM.fmtMoney(Math.max(0, club.money - FM.cashReserve(st, club)))) +
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
        '<dt>Gehälter</dt><dd>' + FM.fmtMoney(-wages) + '</dd><dt>Unterhalt Infrastruktur</dt><dd>' + FM.fmtMoney(-plan.upkeep) + '</dd>' +
        (club.debt ? '<dt>Zins & Tilgung</dt><dd>' + FM.fmtMoney(-FM.debtService(club)) + '</dd><dt>Restschuld</dt><dd class="bad">' + FM.fmtMoney(club.debt) + '</dd>' : '') +
        '<dt>Ticketpreis Ø</dt><dd>' + (FM.ticketPrice[club.league] || 0) + ' €</dd></dl>' +
        '<p class="muted small" style="margin-top:10px">TV-Geld nach dem DFL-Schlüssel (2026/27 die veröffentlichten Beträge, danach Fünfjahreswertung) und Sponsoring werden von August bis Mai monatlich ausgezahlt, Gehälter wöchentlich. Zuschauereinnahmen gibt es bei jedem Heimspiel, Pokalprämien nach dem DFB-Verteilerschlüssel.</p></div></div></div></div>';
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
