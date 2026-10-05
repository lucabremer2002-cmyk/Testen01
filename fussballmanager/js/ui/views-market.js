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
      var html = '<div class="page-h"><div><div class="eyebrow"><span class="tag ' + (open ? 'good' : '') + '">' + esc(FM.windowLabel(st)) + '</span></div><h1>Transfermarkt</h1></div>' +
        UI.seg('tab', [['search', 'Spielersuche'], ['offers', 'Angebote'], ['mine', 'Meine Transferliste'], ['log', 'Transferticker']], s.tab) + '</div>';
      html += UI.budgetStrip(club);

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

  /* Budgetleiste fuer Transfermarkt und Dialoge */
  UI.budgetStrip = function (club) {
    var st = FM.state, b = FM.budget(st, club), room = b.wage - FM.annualWages(st, club);
    function fig(k, v, sub, cls) { return '<div class="bs-fig"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div><div class="s">' + sub + '</div></div>'; }
    return '<div class="budget-strip">' +
      fig('Transferbudget', b.austerity ? 'Sparkurs' : FM.fmtMoney(b.transfer), 'Ablöse + Beraterhonorar', b.austerity ? 'bad' : '') +
      fig('Gehaltsspielraum', FM.fmtMoney(room), 'pro Jahr, Budget ' + FM.fmtMoney(b.wage), room < 0 ? 'bad' : '') +
      fig('Beraterhonorar', Math.round(FM.agentRate(club) * 100) + ' %', 'Scouting Stufe ' + FM.facLevel(club, 'scouting')) +
      fig('Kader', club.squad.length + '/34', 'Spieler unter Vertrag') +
      '<button class="btn sm" data-action="go" data-view="finances">' + UI.icon('wallet') + ' Budget verwalten</button></div>';
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
          '<td class="num hide-sm">' + FM.fmtMoney(FM.marketValue(p)) + '</td><td class="num strong">' + (p.club ? FM.fmtMoney(price(p)) : '<span class="muted">ablösefrei</span>') + '</td><td class="hide-xs"><span class="tag ' + il.c + '">' + il.t + '</span></td></tr>';
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

  /* ================= Finanzen & Budget ================= */
  UI.views.finances = {
    title: 'Finanzen & Budget',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var b = FM.budget(st, club);
      var wages = FM.annualWages(st, club), room = b.wage - wages;
      var html = '<div class="page-h"><div><div class="eyebrow">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + '</div><h1>Finanzen & Budget</h1></div>' +
        '<div class="row wrap"><span class="tag' + (club.money < 0 ? ' bad' : '') + '">Kontostand ' + FM.fmtMoney(club.money) + '</span></div></div>';
      if (b.austerity) html += '<div class="note bad" style="margin-bottom:16px"><b>Sparkurs.</b> Das Konto steht im Minus. Das Transferbudget ist eingefroren, Investitionen sind gesperrt und von Verkaufserlösen fließt nur ein Viertel ins Budget.</div>';
      html += '<div class="budget-hero">' + transferPanel(club, b) + wagePanel(club, b, wages, room) + '</div>';
      html += '<div class="grid dash"><div class="stack">' + shiftCard(club, b, room) + derivationCard(club, b) + forecastCard(club) + balanceChart(club) + '</div>' +
        '<div class="stack">' + rulesCard(club, b) + logCard(b) + ledgerCard(club) + '</div></div>';
      return html;
    },
    mount: function (el) { mountChart(el); mountShift(el); }
  };

  function transferPanel(club, b) {
    var st = FM.state;
    var total = b.start + b.earned + b.extra;
    var rows = [['Zum Saisonstart', b.start], ['Aus Verkäufen', b.earned], ['Nachschlag des Vorstands', b.extra], ['Ausgegeben', -b.spent], ['Für Infrastruktur gekürzt', -b.infra]]
      .filter(function (r, i) { return i === 0 || r[1]; });
    var shifted = b.transfer - (total - b.spent - b.infra);
    if (Math.abs(shifted) >= 1000) rows.push(['Umgeschichtet / Winter', shifted]);
    var req = b.requested ? '<span class="muted small">Nachschlag in dieser Halbserie bereits beantragt.</span>' :
      '<button class="btn sm" data-action="requestBudget"' + (b.austerity ? ' disabled' : '') + '>' + UI.icon('board') + ' Nachschlag beantragen</button>';
    void st;
    return '<section class="bpanel"><div class="bp-k">Transferbudget</div><div class="bp-v' + (b.austerity ? ' bad' : '') + '">' + FM.fmtMoney(b.transfer) + '</div>' +
      '<div class="bp-s">verfügbar für Ablösen, Beraterhonorare und Handgelder</div>' +
      '<dl class="bp-rows">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd class="' + (r[1] < 0 ? 'neg' : '') + '">' + (r[1] > 0 && r[0] !== 'Zum Saisonstart' ? '+' : '') + FM.fmtMoney(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="bp-a">' + req + '</div></section>';
  }

  function wagePanel(club, b, wages, room) {
    var pct = wages / Math.max(1, b.wage) * 100;
    return '<section class="bpanel"><div class="bp-k">Gehaltsbudget</div><div class="bp-v' + (room < 0 ? ' bad' : '') + '">' + FM.fmtMoney(room) + '<small> frei pro Jahr</small></div>' +
      '<div class="bp-s">' + FM.fmtMoney(wages) + ' von ' + FM.fmtMoney(b.wage) + ' sind durch Verträge gebunden (' + Math.round(pct) + ' %)</div>' +
      UI.meter(Math.min(100, pct), room < 0 ? 'bad' : room < b.wage * 0.02 ? 'warn' : '', true) +
      '<dl class="bp-rows"><dt>Budget zum Saisonstart</dt><dd>' + FM.fmtMoney(b.wageStart || b.wage) + '</dd>' +
      (Math.abs(b.wage - (b.wageStart || b.wage)) >= 1000 ? '<dt>Durch Umschichten</dt><dd>' + (b.wage > b.wageStart ? '+' : '') + FM.fmtMoney(b.wage - b.wageStart) + '</dd>' : '') +
      '<dt>Gehälter pro Woche</dt><dd>' + FM.fmtMoney(wages / 52) + '</dd></dl>' +
      '<div class="bp-a"><span class="muted small">Neue Verträge und Gehaltserhöhungen müssen in den Spielraum passen.</span></div></section>';
  }

  function shiftCard(club, b, room) {
    var st = FM.state;
    var maxT = Math.max(0, b.transfer), maxW = Math.max(0, room);
    var rate = FM.shiftRate(st);
    if (!maxT && !maxW) return '<section class="card"><div class="card-h"><h3>Budget umschichten</h3></div><div class="card-b muted small">Weder Transferbudget noch Gehaltsspielraum frei.</div></section>';
    var step = maxT + maxW > 2e7 ? 250000 : maxT + maxW > 2e6 ? 50000 : 10000;
    return '<section class="card"><div class="card-h"><h3>Budget umschichten</h3><span class="muted small">' + FM.WAGE_SHIFT_COST + ' € Transfer = 1 € Gehalt/Jahr</span></div><div class="card-b">' +
      '<div class="shift" id="shift" data-maxt="' + maxT + '" data-maxw="' + maxW + '" data-rate="' + rate + '">' +
      '<div class="shift-ends"><span>← in Transferbudget</span><span>in Gehaltsbudget →</span></div>' +
      '<input type="range" id="shift-range" min="' + (-Math.floor(maxW / step) * step) + '" max="' + (Math.floor(maxT / step) * step) + '" step="' + step + '" value="0" aria-label="Betrag zum Umschichten">' +
      '<div class="shift-out" id="shift-out" aria-live="polite">Regler bewegen, um Geld zwischen den Budgets zu verschieben.</div>' +
      '<div class="row between"><span class="muted small">Gehalt → Transfer derzeit 1 € → ' + FM.fmtDec(rate, 2) + ' € (nur der Rest der Saison wird gespart)</span><button class="btn sm club" id="shift-ok" disabled>Umschichten</button></div></div></div></section>';
  }

  function mountShift(root) {
    var box = root.querySelector('#shift');
    if (!box) return;
    var range = box.querySelector('#shift-range'), out = box.querySelector('#shift-out'), ok = box.querySelector('#shift-ok');
    var rate = +box.getAttribute('data-rate');
    function upd() {
      var v = +range.value;
      ok.disabled = !v;
      if (!v) { out.textContent = 'Regler bewegen, um Geld zwischen den Budgets zu verschieben.'; return; }
      if (v > 0) out.innerHTML = '<b>−' + FM.fmtMoney(v) + '</b> Transferbudget → <b>+' + FM.fmtMoney(v / FM.WAGE_SHIFT_COST) + '</b> Gehaltsspielraum pro Jahr';
      else out.innerHTML = '<b>−' + FM.fmtMoney(-v) + '</b> Gehaltsspielraum pro Jahr → <b>+' + FM.fmtMoney(-v * rate) + '</b> Transferbudget';
    }
    range.addEventListener('input', upd);
    ok.addEventListener('click', function () {
      var v = +range.value;
      var r = FM.shiftBudget(FM.state, v > 0 ? 'wage' : 'transfer', Math.abs(v));
      UI.toast(r.msg, r.ok ? 'good' : 'bad');
      UI.refresh();
    });
  }

  function derivationCard(club, b) {
    var p = b.plan || {};
    var conf = p.conf != null ? p.conf : Math.round(FM.state.user.conf);
    var rows = [
      ['Kontostand', p.money, ''],
      ['Liquiditätsreserve (drei Monate Fixkosten)', -p.reserve, ''],
      [p.counted >= 0 ? 'Hälfte des erwarteten Überschusses' + (p.winter ? ' (Rest der Saison)' : '') : 'Erwarteter Fehlbetrag' + (p.winter ? ' (Rest der Saison)' : ''), p.counted, ''],
      ['Freie Mittel', p.free, 'sum'],
      ['Freigabequote ' + Math.round((p.quote || 0) * 100) + ' % (Vertrauen ' + conf + ')', null, 'q'],
      [p.winter ? 'Neu ermitteltes Transferbudget' : 'Transferbudget', p.transfer != null ? p.transfer : p.free > 0 ? Math.round(p.free * p.quote) : 0, 'sum']
    ];
    return '<section class="card"><div class="card-h"><h3>So rechnet der Vorstand</h3><span class="muted small">' + (p.winter ? 'Neubewertung im Winter' : 'Festlegung zum Saisonstart') + '</span></div>' +
      '<div class="card-b"><table class="calc"><tbody>' + rows.map(function (r) {
        return '<tr class="' + r[2] + '"><td>' + r[0] + '</td><td class="num">' + (r[1] == null ? '× ' + FM.fmtDec(p.quote || 0, 2) : FM.fmtMoney(r[1] || 0)) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (p.winter ? '<p class="muted small" style="margin-top:8px">Zum Winter gibt der Vorstand die Hälfte des Zuwachses gegenüber dem verbliebenen Budget frei. Liegt der neue Wert darunter, wird das Budget auf ihn gekürzt.</p>' : '') +
      (p.cashLimited ? '<p class="muted small" style="margin-top:8px">Begrenzt durch den Kontostand: Der Überschuss kommt erst im Saisonverlauf herein, die halbe Reserve muss immer auf dem Konto bleiben. Zum Wintertransferfenster rechnet der Vorstand neu.</p>' : '') +
      '<p class="muted small" style="margin-top:8px">Gehaltsbudget: aktuelle Gehälter plus 3 %, höchstens aber ' + ({ bl: 58, bl2: 62, l3: 66, rl: 70 }[club.league] || 60) + ' % der erwarteten Einnahmen, falls das mehr ist. Bei erwartetem Fehlbetrag gibt es keine Erhöhung.</p></div></section>';
  }

  function forecastCard(club) {
    var st = FM.state, fc = FM.seasonForecast(st, club);
    function r(k, v) { return '<tr><td>' + k + '</td><td class="num' + (v < 0 ? ' neg' : '') + '">' + FM.fmtMoney(v) + '</td></tr>'; }
    return '<section class="card"><div class="card-h"><h3>Saisonprognose</h3><span class="muted small">ohne Transfers und Prämien</span></div><div class="card-b"><table class="calc"><tbody>' +
      r('TV-Gelder', fc.tv) + r('Sponsoring & Marketing', fc.sponsor) + r('Zuschauer (Ø ' + FM.fmtInt(FM.expectedAttendance(club)) + ' × ' + FM.homeGames(club) + ' Heimspiele)', fc.tickets) +
      r('Gehälter', -fc.wages) + r('Betriebskosten', -fc.ops) + (fc.upkeep ? r('Unterhalt Infrastruktur-Ausbau', -fc.upkeep) : '') +
      '<tr class="sum"><td>Erwartetes Ergebnis</td><td class="num ' + (fc.result >= 0 ? 'good' : 'bad') + '">' + FM.fmtMoney(fc.result, { sign: true }) + '</td></tr></tbody></table></div></section>';
  }

  function rulesCard(club, b) {
    var st = FM.state, share = FM.salesShare(st, club);
    var items = [
      ['Beraterhonorar', Math.round(FM.agentRate(club) * 100) + ' % auf jede Ablöse', 'Sinkt mit besserem Scouting (Stufe ' + FM.facLevel(club, 'scouting') + ').'],
      ['Handgeld', Math.round(FM.SIGNING_BONUS * 100) + ' % eines Jahresgehalts', 'Für vereinslose Spieler, aus dem Transferbudget.'],
      ['Verkaufserlöse', Math.round(share * 100) + ' % zurück ins Budget', b.austerity ? 'Sparkurs: nur ein Viertel.' : 'Abhängig vom Vertrauen des Vorstands.'],
      ['Nachschlag', b.requested ? 'bereits beantragt' : 'einmal pro Halbserie', 'Nur bei Vertrauen ab 40 und Saisonziel in Reichweite. Bewilligt kostet er 4 Punkte Vertrauen, abgelehnt 2 bis 3.'],
      ['Investitionen', 'aus den freien Mitteln', 'Bauen über das nicht verplante Geld hinaus kürzt das Transferbudget.']
    ];
    return '<section class="card"><div class="card-h"><h3>Regeln des Vorstands</h3></div><div class="list">' + items.map(function (it) {
      return '<div class="li"><div class="grow"><div class="row between"><span class="strong">' + it[0] + '</span><span class="small">' + it[1] + '</span></div><div class="muted small">' + it[2] + '</div></div></div>';
    }).join('') + '</div></section>';
  }

  function logCard(b) {
    var log = (b.log || []).slice(0, 14);
    return '<section class="card"><div class="card-h"><h3>Budgetbewegungen</h3></div><div class="list">' + (log.length ? log.map(function (l) {
      return '<div class="li"><span class="muted small nowrap tnum" style="width:46px">' + D.fmtShort(l.d) + '</span><div class="grow small">' + esc(l.t) + '</div><span class="small strong tnum ' + (l.a < 0 ? 'bad' : l.a > 0 ? 'good' : '') + '">' + (l.a > 0 ? '+' : '') + FM.fmtMoney(l.a) + '</span></div>';
    }).join('') : '<div class="empty">Noch keine Bewegungen.</div>') + '</div></section>';
  }

  function ledgerCard(club) {
    var fin = club.fin, prev = club.finPrev;
    var inc = ['tv', 'sponsor', 'tickets', 'prize', 'sales'], exp = ['wages', 'ops', 'buys', 'fees', 'infra', 'other'];
    var sumIn = FM.sum(inc, function (k) { return fin[k] || 0; }), sumOut = FM.sum(exp, function (k) { return fin[k] || 0; });
    function line(k) {
      return '<tr><td>' + FM.LEDGER_LABEL[k] + '</td><td class="num">' + FM.fmtMoney(fin[k] || 0) + '</td>' + (prev ? '<td class="num muted hide-xs">' + FM.fmtMoney(prev[k] || 0) + '</td>' : '') + '</tr>';
    }
    return '<section class="card"><div class="card-h"><h3>Einnahmen & Ausgaben</h3><span class="muted small">bisher in dieser Saison</span></div><div class="card-b flush"><table class="tbl"><thead><tr><th></th><th class="num">Saison</th>' + (prev ? '<th class="num hide-xs">Vorsaison</th>' : '') + '</tr></thead><tbody>' +
      '<tr class="group"><td colspan="3">Einnahmen</td></tr>' + inc.map(line).join('') +
      '<tr class="group"><td colspan="3">Ausgaben</td></tr>' + exp.map(line).join('') +
      '<tr><td class="strong">Saldo</td><td class="num strong ' + (sumIn + sumOut >= 0 ? 'good' : 'bad') + '">' + FM.fmtMoney(sumIn + sumOut) + '</td>' + (prev ? '<td class="num muted hide-xs"></td>' : '') + '</tr></tbody></table></div></section>';
  }

  UI.actions.requestBudget = function () {
    var r = FM.requestBudget(FM.state);
    FM.save(UI.slot || 1);
    UI.refresh();
    UI.modal(UI.modalHead(r.ok ? 'Nachschlag bewilligt' : 'Nachschlag abgelehnt', 'Antwort des Vorstands') + '<div class="modal-b"><p>' + esc(r.msg) + '</p></div><div class="modal-f"><button class="btn club" data-action="closeModal">Verstanden</button></div>', { size: 'narrow' });
  };

  /* Einzelne Zeitreihe (Kontostand) als SVG-Linie mit Fadenkreuz-Tooltip */
  function balanceChart(club) {
    var pts = (club.bal || []).slice(-60);
    if (pts.length < 2) return '<section class="card"><div class="card-h"><h3>Kontostand</h3></div><div class="empty">Der Verlauf erscheint nach den ersten Wochen.</div></section>';
    return '<section class="card"><div class="card-h"><h3>Kontostand</h3><span class="muted small">wöchentlich, letzte ' + pts.length + ' Wochen</span></div>' +
      '<div class="card-b"><div class="chart-wrap" id="bal-chart" data-points=\'' + JSON.stringify(pts) + '\'></div>' +
      '<details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Als Tabelle anzeigen</summary><div class="tbl-wrap" style="max-height:240px;overflow:auto;margin-top:8px"><table class="tbl compact"><tbody>' +
      pts.slice().reverse().map(function (p) { return '<tr><td>' + D.fmt(p[0]) + '</td><td class="num">' + FM.fmtMoney(p[1]) + '</td></tr>'; }).join('') + '</tbody></table></div></details></div></section>';
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
      '<path d="' + area + '" fill="var(--club-text)" opacity=".1"/><path d="' + line + '" fill="none" stroke="var(--club-text)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + lx + '" cy="' + ly + '" r="4" fill="var(--club-text)" stroke="var(--surface)" stroke-width="2"/>' + labels +
      '<line id="bal-x" y1="' + pt + '" y2="' + (H - pb) + '" stroke="var(--text-3)" stroke-width="1" visibility="hidden"/>' +
      '<circle id="bal-dot" r="4" fill="var(--club-text)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>' +
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
