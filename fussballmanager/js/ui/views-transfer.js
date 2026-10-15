/* Ansichten: Transfermarkt, Verhandlungen, Scouting, Leihen und Transferbilanz. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;
  var PAGE = 40;

  /* ================= Transfermarkt ================= */
  UI.views.transfers = {
    title: 'Transfermarkt',
    render: function () {
      var st = FM.state, uc = st.user.club, club = st.clubs[uc];
      var s = UI.vs('transfers', { tab: 'search', q: '', grp: 'all', pos: 'all', league: 'all', minOvr: 0, maxAge: 40, maxPrice: 0, onlyListed: false, free: false, expiring: false, clause: false, loanable: false, sort: 'ovr', dir: -1, page: 0 });
      var left = FM.windowDaysLeft(st);
      var chip = left == null ? '<span class="tag">Fenster geschlossen</span>' : left <= 1 ? '<span class="tag deadline">Deadline Day</span>' : '<span class="tag good">Fenster offen · noch ' + left + ' Tage</span>';
      var nTalks = Object.keys(st.talks || {}).filter(function (k) { return FM.talkOf(st, k); }).length;
      var nOffers = st.offers.filter(function (o) { return o.status === 'open'; }).length;
      var count = function (n) { return n ? ' <b>' + n + '</b>' : ''; };
      var html = '<div class="page-h"><div><div class="eyebrow">' + esc(FM.windowLabel(st)) + '</div><h1>Transfermarkt</h1>' +
        '<div class="sub">' + chip + ' · Kader ' + club.squad.length + '/34 · Vereinslose jederzeit, Vorverträge ab Januar</div></div></div>' +
        UI.budgetPanel() +
        '<div class="tabs">' + [['search', 'Spielersuche'], ['watch', 'Beobachtung' + count((st.shortlist || []).length)], ['scout', 'Scouting'], ['talks', 'Verhandlungen' + count(nTalks)],
          ['offers', 'Angebote' + count(nOffers)], ['loans', 'Leihen'], ['balance', 'Bilanz'], ['log', 'Ticker']].map(function (t) {
          return '<button data-action="setUi" data-k="tab" data-v="' + t[0] + '" class="' + (s.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>';
      var body = { search: searchView, watch: watchView, scout: scoutView, talks: talksView, offers: offersView, loans: loansView, balance: balanceView, log: logView }[s.tab] || searchView;
      return html + body(s);
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

  function sel(label, key, opts, cur) {
    return '<div class="field"><label>' + label + '</label><select class="input" data-filter="' + key + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></div>';
  }
  function check(key, label, on) {
    return '<label class="check"><input type="checkbox" data-filter="' + key + '"' + (on ? ' checked' : '') + '> ' + label + '</label>';
  }

  UI.starBtn = function (p) {
    var on = FM.onShortlist(FM.state, p.id);
    return '<button class="star-btn' + (on ? ' on' : '') + '" data-action="watch" data-id="' + p.id + '" title="' + (on ? 'Von der Beobachtungsliste nehmen' : 'Beobachten') + '" aria-label="Beobachten">★</button>';
  };

  function priceCell(st, p) {
    if (p.loan) return '<span class="muted">verliehen</span>';
    if (p.pre) return '<span class="muted">Vorvertrag</span>';
    if (!p.club) return 'ablösefrei';
    return FM.fmtMoney(FM.askingPrice(st, p)) + (p.contract.clause ? ' <span class="tag info" title="Ausstiegsklausel ' + FM.fmtMoney(p.contract.clause) + '">K</span>' : '');
  }

  function playerTable(list, s, scope, extraHead, extraCell) {
    var st = FM.state, uc = st.user.club, y = st.season.year;
    var th = function (k, l, cls) { return s ? UI.sortTh(scope, k, l, s.sort, s.dir, cls) : '<th class="' + (cls || '') + '">' + l + '</th>'; };
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="star-col"></th>' + (extraHead || '') + '<th>Pos</th>' + th('name', 'Spieler') + '<th class="hide-sm">Verein</th>' + th('age', 'Alter', 'num') +
      th('ovr', 'Stärke', 'num') + th('pot', 'Pot.', 'num hide-xs') + '<th class="num hide-sm">Vertrag</th>' + th('value', 'Marktwert', 'num hide-sm') + th('price', 'Ablöse', 'num') + '<th class="hide-xs">Interesse</th></tr></thead><tbody>' +
      (list.length ? list.map(function (p) {
        var il = FM.interestLabel(FM.interest(st, p, uc));
        var ending = p.club && p.contract.until <= y + 1;
        return '<tr class="click" data-action="player" data-id="' + p.id + '"><td class="star-col">' + UI.starBtn(p) + '</td>' + (extraCell ? extraCell(p) : '') + '<td>' + UI.posTag(p.pos[0]) + '</td>' +
          '<td><span class="pname">' + esc(p.name) + '</span>' + UI.srcMark(p) + (p.listed ? ' <span class="tag info">gelistet</span>' : '') + (p.wants ? ' <span class="tag warn">will weg</span>' : '') + (p.injury ? ' <span class="tag bad">verletzt</span>' : '') +
          '<div class="muted tiny show-sm">' + (p.club ? esc(st.clubs[p.club].short) : 'vereinslos') + '</div></td>' +
          '<td class="hide-sm">' + (p.club ? UI.clubLink(p.club) : '<span class="tag">vereinslos</span>') + '</td><td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="num hide-xs">' + UI.potRange(p) + '</td>' +
          '<td class="num hide-sm ' + (ending ? 'warn strong' : '') + '">' + (p.club ? p.contract.until : '–') + '</td>' +
          '<td class="num hide-sm">' + FM.fmtMoney(FM.marketValue(p)) + '</td><td class="num strong">' + priceCell(st, p) + '</td><td class="hide-xs"><span class="tag ' + il.c + '">' + il.t + '</span></td></tr>';
      }).join('') : '<tr><td colspan="11"><div class="empty">Keine Spieler gefunden.</div></td></tr>') + '</tbody></table></div>';
  }

  function searchView(s) {
    var st = FM.state, uc = st.user.club, y = st.season.year;
    var q = (s.q || '').toLowerCase().trim();
    var list = [];
    Object.keys(st.players).forEach(function (pid) {
      var p = st.players[pid];
      if (p.club === uc) return;
      if (s.free && p.club) return;
      if (p.club && st.clubs[p.club].guest) return;
      if (p.club && st.clubs[p.club].league === 'rl' && s.league !== 'rl' && s.league !== 'all') return;
      if (s.league !== 'all' && (!p.club || st.clubs[p.club].league !== s.league)) return;
      if (s.grp !== 'all' && FM.mainGroup(p) !== s.grp) return;
      if (s.pos !== 'all' && p.pos.indexOf(s.pos) < 0) return;
      if (p.ovr < s.minOvr || p.age > s.maxAge) return;
      if (s.onlyListed && !p.listed && !p.wants) return;
      if (s.expiring && !(p.club && !p.loan && !p.pre && p.contract.until <= y + 1)) return;
      if (s.clause && !(p.club && p.contract.clause)) return;
      if (s.loanable && !FM.loanable(st, p)) return;
      if (q && p.name.toLowerCase().indexOf(q) < 0 && !(p.club && st.clubs[p.club].name.toLowerCase().indexOf(q) >= 0)) return;
      list.push(p);
    });
    var price = function (p) { return p.club ? FM.askingPrice(st, p) : 0; };
    if (s.maxPrice) list = list.filter(function (p) { return price(p) <= s.maxPrice; });
    var key = { ovr: function (p) { return p.ovr; }, pot: function (p) { return p.pot; }, age: function (p) { return p.age; }, value: function (p) { return FM.marketValue(p); }, price: price, name: function (p) { return p.name; } }[s.sort] || function (p) { return p.ovr; };
    list.sort(function (a, b) { var x = key(a), z = key(b); return (x < z ? -1 : x > z ? 1 : 0) * (s.dir || -1) || b.ovr - a.ovr; });
    var total = list.length, page = Math.min(s.page || 0, Math.max(0, Math.ceil(total / PAGE) - 1));
    var rows = list.slice(page * PAGE, page * PAGE + PAGE);
    var posOpts = [['all', 'Alle Positionen']].concat(FM.POS_ORDER.map(function (p) { return [p, FM.POS_NAME[p]]; }));
    var filters = '<div class="card" style="margin-bottom:14px"><div class="card-b" style="padding-top:14px"><div class="filters" style="margin-bottom:10px">' +
      '<div class="field" style="min-width:200px;flex:1"><label for="t-q">Suche</label><input class="input" id="t-q" placeholder="Spieler oder Verein" value="' + esc(s.q) + '"></div>' +
      sel('Position', 'pos', posOpts, s.pos) +
      sel('Liga', 'league', [['all', 'Alle Ligen'], ['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rl', 'Regionalliga']], s.league) +
      sel('Stärke ab', 'minOvr', [[0, 'beliebig'], [60, '60+'], [65, '65+'], [70, '70+'], [75, '75+'], [80, '80+'], [85, '85+']], s.minOvr) +
      sel('Alter bis', 'maxAge', [[40, 'beliebig'], [19, '19'], [21, '21'], [23, '23'], [25, '25'], [28, '28'], [31, '31']], s.maxAge) +
      sel('Ablöse bis', 'maxPrice', [[0, 'beliebig'], [250000, '250 Tsd.'], [1000000, '1 Mio.'], [3000000, '3 Mio.'], [10000000, '10 Mio.'], [25000000, '25 Mio.'], [60000000, '60 Mio.']], s.maxPrice) +
      '</div><div class="row wrap" style="gap:16px">' + check('onlyListed', 'Transferliste / Wechselwunsch', s.onlyListed) + check('free', 'Vereinslos', s.free) +
      check('expiring', 'Vertrag läuft aus (Vorvertrag)', s.expiring) + check('clause', 'Ausstiegsklausel', s.clause) + check('loanable', 'Ausleihbar', s.loanable) + '</div>' +
      '</div></div>';
    return filters + '<div class="card">' + playerTable(rows, s, 'transfers') +
      '<div class="modal-f" style="justify-content:space-between;align-items:center"><span class="muted small">' + FM.fmtInt(total) + ' Spieler · Seite ' + (page + 1) + ' von ' + Math.max(1, Math.ceil(total / PAGE)) + '</span><div class="row">' +
      '<button class="btn sm" data-action="setUi" data-k="page" data-v="' + Math.max(0, page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>' + UI.icon('back') + ' Zurück</button>' +
      '<button class="btn sm" data-action="setUi" data-k="page" data-v="' + (page + 1) + '"' + ((page + 1) * PAGE >= total ? ' disabled' : '') + '>Weiter ' + UI.icon('next') + '</button></div></div></div>';
  }

  function watchView() {
    var st = FM.state;
    var list = (st.shortlist || []).map(function (id) { return st.players[id]; }).filter(function (p) { return p && p.club !== st.user.club; });
    return '<div class="card"><div class="card-h"><h3>Beobachtungsliste</h3><span class="muted small">Mit ★ in jeder Spielerliste hinzufügen</span></div>' +
      (list.length ? playerTable(list, null) : '<div class="empty">Noch niemand auf der Liste. Markiere interessante Spieler mit dem Stern – hier siehst du dann Preis, Vertrag und Wechselbereitschaft auf einen Blick.</div>') + '</div>';
  }

  /* ---------- Scouting ---------- */
  function scoutView() {
    var st = FM.state, club = st.clubs[st.user.club];
    var f = UI.vs('scoutForm', { grp: 'all', maxAge: 40, league: 'all', maxPrice: 0, style: 'best' });
    var busy = (st.scouts || []).filter(function (x) { return !x.res; }).length, slots = FM.scoutSlots(club);
    var posOpts = [['all', 'Alle Positionen'], ['GK', 'Torhüter'], ['DEF', 'Abwehr'], ['MID', 'Mittelfeld'], ['ATT', 'Angriff']].concat(FM.POS_ORDER.map(function (p) { return ['p:' + p, FM.POS_NAME[p]]; }));
    var opt = function (id, opts, cur) { return '<select class="input" id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
    var form = '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Scout losschicken</h3><span class="muted small">' + (slots - busy) + ' von ' + slots + ' Scouts frei · Bericht nach ' + FM.scoutDays(club) + ' Tagen</span></div>' +
      '<div class="card-b"><div class="filters" style="margin-bottom:0">' +
      '<div class="field"><label>Position</label>' + opt('sc-pos', posOpts, f.grp) + '</div>' +
      '<div class="field"><label>Alter bis</label>' + opt('sc-age', [[40, 'beliebig'], [19, '19'], [21, '21'], [23, '23'], [26, '26'], [29, '29']], f.maxAge) + '</div>' +
      '<div class="field"><label>Liga</label>' + opt('sc-league', [['all', 'Alle Ligen'], ['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rl', 'Regionalliga']], f.league) + '</div>' +
      '<div class="field"><label>Ablöse bis</label>' + opt('sc-price', [[0, 'beliebig'], [500000, '500 Tsd.'], [2000000, '2 Mio.'], [5000000, '5 Mio.'], [10000000, '10 Mio.'], [25000000, '25 Mio.']], f.maxPrice) + '</div>' +
      '<div class="field"><label>Schwerpunkt</label>' + opt('sc-style', [['best', 'Beste Verstärkung'], ['young', 'Talente'], ['cheap', 'Schnäppchen']], f.style) + '</div>' +
      '<div class="field"><label>&nbsp;</label><button class="btn primary" data-action="scoutGo"' + (busy >= slots ? ' disabled' : '') + '>' + UI.icon('search') + ' Losschicken</button></div>' +
      '</div><p class="muted small" style="margin-top:10px">Scouts empfehlen bis zu acht Spieler, die zu den Vorgaben, deinem Budget und deinem Kader passen. Ihr Potenzial ist danach genau bekannt. Mehr Scouts und schnellere Berichte gibt es mit einer besseren <a href="#" data-action="go" data-view="infra">Scoutingabteilung</a>.</p></div></div>';
    var reports = (st.scouts || []).map(function (x) {
      var head = '<div class="card-h"><h3>' + esc(FM.scoutLabel(x.f)) + '</h3><div class="row">' +
        (x.res ? '<span class="muted small">Bericht vom ' + D.fmt(x.ready) + '</span><button class="btn sm ghost icon" data-action="scoutDel" data-id="' + x.id + '" aria-label="Bericht löschen">' + UI.icon('trash') + '</button>' :
          '<span class="tag info">unterwegs · Bericht am ' + D.fmt(x.ready) + '</span>') + '</div></div>';
      if (!x.res) return '<div class="card">' + head + '</div>';
      var list = x.res.map(function (id) { return st.players[id]; }).filter(Boolean);
      return '<div class="card">' + head + (list.length ? playerTable(list, null, null, '<th>Note</th>', function (p) {
        var r = FM.scoutReport(st, p);
        return '<td><span class="grade-badge ' + r.grade + '" title="' + esc(r.tag) + '">' + r.grade + '</span> <span class="small dim hide-sm">' + esc(r.tag) + '</span></td>';
      }) : '<div class="empty">Kein passender Spieler gefunden.</div>') + '</div>';
    }).join('');
    return form + (reports || '<div class="empty">Noch keine Scoutberichte.</div>');
  }

  UI.actions.scoutGo = function () {
    var st = FM.state, f = UI.vs('scoutForm');
    var pos = document.getElementById('sc-pos').value;
    f.grp = pos;
    f.maxAge = +document.getElementById('sc-age').value;
    f.league = document.getElementById('sc-league').value;
    f.maxPrice = +document.getElementById('sc-price').value;
    f.style = document.getElementById('sc-style').value;
    var filter = { grp: pos.indexOf('p:') === 0 ? 'all' : pos, pos: pos.indexOf('p:') === 0 ? pos.slice(2) : 'all', maxAge: f.maxAge, league: f.league, maxPrice: f.maxPrice, style: f.style };
    var r = FM.startScout(st, filter);
    UI.toast(r.msg, r.ok ? 'good' : 'bad');
    FM.save(UI.slot || 1);
    UI.refresh();
  };
  UI.actions.scoutDel = function (el) {
    var st = FM.state, id = el.getAttribute('data-id');
    st.scouts = (st.scouts || []).filter(function (x) { return x.id !== id; });
    UI.refresh();
  };

  UI.actions.watch = function (el, e) {
    if (e) e.stopPropagation();
    var on = FM.toggleShortlist(FM.state, el.getAttribute('data-id'));
    UI.toast(on ? 'Auf die Beobachtungsliste gesetzt.' : 'Von der Beobachtungsliste genommen.');
    if (UI.modalOpen) { var pid = el.getAttribute('data-id'); UI.refresh(); UI.playerModal(pid); } else UI.refresh();
  };

  /* ---------- Laufende Verhandlungen ---------- */
  function patience(cur, max) {
    var s = '';
    for (var i = 0; i < max; i++) s += '<i class="' + (i < cur ? 'on' : '') + '"></i>';
    return '<span class="patience" title="Geduld ' + cur + ' von ' + max + '">' + s + '</span>';
  }
  UI.patience = patience;

  function talksView() {
    var st = FM.state;
    var list = Object.keys(st.talks || {}).map(function (k) { return FM.talkOf(st, k); }).filter(Boolean);
    return '<div class="card"><div class="card-h"><h3>Laufende Verhandlungen</h3><span class="muted small">Gespräche verfallen nach zwei Wochen ohne Abschluss</span></div><div class="list">' +
      (list.length ? list.map(function (t) {
        var p = st.players[t.pid];
        if (!p) return '';
        var club = t.stage === 'club';
        return '<div class="li click" data-action="negotiate" data-id="' + p.id + '">' + UI.pill(p.ovr) + '<div class="grow"><div class="strong">' + esc(p.name) + ' <span class="tag">' + FM.DEAL_LABEL[t.kind] + '</span></div>' +
          '<div class="muted small">' + (club ? 'Verhandlung mit ' + esc(st.clubs[p.club].short) : 'Vertragsgespräch mit dem Spieler') + ' · läuft bis ' + D.fmt(t.expires) + '</div></div>' +
          patience(club ? t.pat : t.ppat, club ? t.max : t.pmax) + '<button class="btn sm">Fortsetzen</button></div>';
      }).join('') : '<div class="empty">Keine laufenden Gespräche. Öffne ein Spielerprofil und klicke auf „Verhandeln“.</div>') + '</div></div>';
  }

  /* ---------- Angebote fuer eigene Spieler ---------- */
  function offersView() {
    var st = FM.state;
    var open = st.offers.filter(function (o) { return o.status === 'open'; });
    var past = st.offers.filter(function (o) { return o.status !== 'open'; }).slice(-15).reverse();
    function row(o, act) {
      var p = st.players[o.pid], c = st.clubs[o.from];
      var what = o.type === 'loan' ? 'möchte ' + (p ? esc(p.name) : 'den Spieler') + ' ausleihen · ' + Math.round(o.share * 100) + ' % Gehalt' + (o.option ? ' · Kaufoption ' + FM.fmtMoney(o.option) : '') :
        'bietet ' + FM.fmtMoney(o.fee);
      return '<div class="li">' + UI.badge(c, 30) + '<div class="grow"><div class="strong">' + esc(c.name) + ' ' + what + '</div><div class="muted small">' +
        (o.type === 'loan' ? 'Leihe bis Saisonende' : 'für ' + (p ? UI.playerLink(p) + ' (Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + ')' : 'ehemaligen Spieler')) + ' · ' +
        (act ? 'gültig bis ' + D.fmt(o.expires) : ({ accepted: 'angenommen', declined: 'abgelehnt', expired: 'abgelaufen' }[o.status])) + '</div></div>' +
        (act ? '<div class="row wrap"><button class="btn sm" data-action="offerRespond" data-id="' + o.id + '" data-ok="0">Ablehnen</button>' +
          (o.type !== 'loan' ? '<button class="btn sm" data-action="offerCounter" data-id="' + o.id + '">Mehr verlangen</button>' : '') +
          '<button class="btn sm primary" data-action="offerRespond" data-id="' + o.id + '" data-ok="1">Annehmen</button></div>' : '') + '</div>';
    }
    return '<div class="card"><div class="card-h"><h3>Offene Angebote für deine Spieler</h3></div><div class="list">' + (open.length ? open.map(function (o) { return row(o, true); }).join('') :
      '<div class="empty">Keine offenen Angebote. Setze Spieler auf die Transfer- oder Leihliste, um Interessenten anzulocken.</div>') + '</div></div>' +
      (past.length ? '<div class="card"><div class="card-h"><h3>Frühere Angebote</h3></div><div class="list">' + past.map(function (o) { return row(o, false); }).join('') + '</div></div>' : '') +
      myListView();
  }

  function myListView() {
    var st = FM.state;
    var mine = FM.clubPlayers(st, st.user.club).filter(function (p) { return p.listed || p.wants; });
    return '<div class="card"><div class="card-h"><h3>Transferliste & Wechselwünsche</h3></div><div class="list">' + (mine.length ? mine.map(function (p) {
      return '<div class="li click" data-action="player" data-id="' + p.id + '">' + UI.posTag(p.pos[0]) + '<div class="grow"><div class="pname">' + esc(p.name) + (p.wants ? ' <span class="tag warn">will weg</span>' : '') + '</div><div class="muted small">' + p.age + ' Jahre · Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + '</div></div>' + UI.pill(p.ovr) + '</div>';
    }).join('') : '<div class="empty">Niemand gelistet. Im Spielerprofil kannst du Spieler auf die Transfer- oder Leihliste setzen.</div>') + '</div></div>';
  }

  UI.actions.offerCounter = function (el) {
    var st = FM.state, o = st.offers.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (!o) return;
    var p = st.players[o.pid], c = st.clubs[o.from];
    UI.modal(UI.modalHead('Mehr verlangen', esc(c.name) + ' bietet ' + FM.fmtMoney(o.fee) + ' für ' + esc(p.name)) +
      '<div class="modal-b"><div class="stack"><p class="dim small">Nenne deinen Preis. Liegt er im Rahmen, nimmt ' + esc(c.short) + ' an und der Transfer ist sofort perfekt. Ist er zu hoch, bessert der Verein nach – oder zieht sein Angebot zurück.</p>' +
      '<div class="field"><label>Deine Forderung (€)</label><input class="input" id="oc-fee" type="number" step="50000" value="' + FM.niceRound(o.fee * 1.2) + '"></div><div id="oc-msg"></div></div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn primary" id="oc-ok">Forderung stellen</button></div>',
      { size: 'narrow', mount: function (m) {
        m.querySelector('#oc-ok').addEventListener('click', function () {
          var r = FM.counterOffer(st, o.id, +m.querySelector('#oc-fee').value);
          FM.save(UI.slot || 1);
          if (r.improved) { m.querySelector('#oc-msg').innerHTML = '<div class="note warn">' + esc(r.msg) + '</div>'; UI.refresh(); return; }
          UI.closeModal(); UI.toast(r.msg, r.ok ? 'good' : 'bad'); UI.refresh();
        });
      } });
  };

  /* ---------- Leihen ---------- */
  function loansView() {
    var st = FM.state, uc = st.user.club, club = st.clubs[uc];
    var inn = FM.clubPlayers(st, uc).filter(function (p) { return p.loan; });
    var out = (club.loanedOut || []).map(function (id) { return st.players[id]; }).filter(function (p) { return p && p.loan; });
    var listed = FM.clubPlayers(st, uc).filter(function (p) { return p.loanList; });
    var card = function (title, sub, inner) { return '<div class="card"><div class="card-h"><h3>' + title + '</h3><span class="muted small">' + sub + '</span></div>' + inner + '</div>'; };
    var inTbl = inn.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Von</th><th class="num">Dein Gehaltsanteil</th><th class="num hide-xs">Einsätze</th><th class="num">Kaufoption</th><th></th></tr></thead><tbody>' +
      inn.map(function (p) {
        return '<tr><td>' + UI.posTag(p.pos[0]) + ' ' + UI.playerLink(p) + ' ' + UI.pill(p.ovr) + '</td><td>' + UI.clubLink(p.loan.from) + '</td><td class="num">' + Math.round(p.loan.share * 100) + ' % · ' + FM.fmtMoneyShort(p.contract.wage * p.loan.share) + '</td>' +
          '<td class="num hide-xs">' + p.st.apps + '</td><td class="num">' + (p.loan.option ? FM.fmtMoney(p.loan.option) : '<span class="muted">keine</span>') + '</td>' +
          '<td class="num">' + (p.loan.option ? '<button class="btn sm primary" data-action="exerciseOpt" data-id="' + p.id + '">Ziehen</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Keine Leihspieler. Ausleihbare Spieler findest du in der Suche mit dem Filter „Ausleihbar“.</div>';
    var outTbl = out.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Spieler</th><th>Bei</th><th class="num">Sp</th><th class="num hide-xs">Min</th><th class="num">Tore</th><th class="num">Stärke</th></tr></thead><tbody>' +
      out.map(function (p) {
        var d = p.ovr0 != null ? p.ovr - p.ovr0 : 0;
        return '<tr><td>' + UI.posTag(p.pos[0]) + ' ' + UI.playerLink(p) + '</td><td>' + UI.clubLink(p.club) + '</td><td class="num">' + p.st.apps + '</td><td class="num hide-xs">' + p.st.mins + '</td><td class="num">' + p.st.goals + '</td>' +
          '<td class="num">' + UI.pill(p.ovr) + (d ? ' <span class="tiny ' + (d > 0 ? 'good' : 'bad') + '">' + (d > 0 ? '+' : '') + d + '</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Kein Spieler verliehen. Junge Spieler entwickeln sich mit Spielpraxis schneller – setze sie im Spielerprofil auf die Leihliste.</div>';
    var listTbl = listed.length ? '<div class="list">' + listed.map(function (p) {
      return '<div class="li click" data-action="player" data-id="' + p.id + '">' + UI.posTag(p.pos[0]) + '<div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="muted small">' + p.age + ' Jahre · wartet auf Leihanfragen</div></div>' + UI.pill(p.ovr) + '</div>';
    }).join('') + '</div>' : '<div class="empty">Niemand auf der Leihliste.</div>';
    return '<div class="stack">' + card('Bei dir ausgeliehen', 'Leihe endet zum Saisonende', inTbl) + card('Verliehen', 'Spielpraxis bei anderen Vereinen', outTbl) + card('Leihliste', 'Andere Vereine fragen während des Transferfensters an', listTbl) + '</div>';
  }

  UI.actions.exerciseOpt = function (el) {
    var st = FM.state, p = st.players[el.getAttribute('data-id')];
    if (!p || !p.loan) return;
    UI.confirm('Kaufoption ziehen?', p.name + ' wird für <b>' + FM.fmtMoney(p.loan.option) + '</b> (plus 10 % Beraterhonorar) fest verpflichtet. Sein Gehalt von ' + FM.fmtMoney(p.contract.wage) + ' zahlst du dann komplett.', 'Kaufoption ziehen', function () {
      var r = FM.exerciseOption(st, p);
      UI.toast(r.msg, r.ok ? 'good' : 'bad');
      FM.save(UI.slot || 1);
      UI.refresh();
    });
  };

  /* ---------- Bilanz ---------- */
  function balanceView() {
    var st = FM.state, uc = st.user.club, since = D.iso(st.season.year, 7, 1);
    var mine = st.transfers.filter(function (t) { return t.date >= since && (t.to === uc || t.from === uc); });
    var ins = mine.filter(function (t) { return t.to === uc; }), outs = mine.filter(function (t) { return t.from === uc; });
    var spend = FM.sum(ins, function (t) { return t.fee; }), earn = FM.sum(outs, function (t) { return t.fee; });
    var label = function (t) { return t.loan ? '<span class="tag info">Leihe</span>' : t.pre ? '<span class="tag">Vorvertrag</span>' : t.option ? '<span class="tag">Kaufoption</span>' : t.fee ? FM.fmtMoney(t.fee) : '<span class="muted">ablösefrei</span>'; };
    var tbl = function (list, other) {
      return list.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + list.map(function (t) {
        var p = st.players[t.pid];
        return '<tr><td class="small nowrap">' + D.fmtShort(t.date) + '</td><td>' + (p ? UI.playerLink(p) : esc(t.name)) + ' <span class="muted small">' + FM.POS_LABEL[t.pos] + ' · ' + t.ovr + '</span></td><td class="hide-sm">' + (t[other] ? UI.clubLink(t[other]) : '<span class="muted">vereinslos</span>') + '</td><td class="num">' + label(t) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty">Keine.</div>';
    };
    var pays = (st.payments || []).filter(function (x) { return x.from === uc || x.to === uc; });
    var paysHtml = pays.length ? '<div class="list">' + pays.map(function (x) {
      return '<div class="li"><div class="grow"><div class="strong">' + esc(x.name) + '</div><div class="muted small">fällig am ' + D.fmt(x.due) + ' · ' + (x.from === uc ? 'an ' + esc(st.clubs[x.to].short) : 'von ' + esc(st.clubs[x.from].short)) + '</div></div><span class="strong ' + (x.from === uc ? 'bad' : 'good') + '">' + (x.from === uc ? '−' : '+') + FM.fmtMoney(x.amount) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">Keine offenen Raten.</div>';
    return '<div class="grid g3" style="margin-bottom:16px">' +
      '<div class="card stat"><div class="label">Ablösen bezahlt</div><div class="value">' + FM.fmtMoney(spend) + '</div><div class="meta">' + ins.length + ' Zugänge</div></div>' +
      '<div class="card stat"><div class="label">Ablösen erhalten</div><div class="value">' + FM.fmtMoney(earn) + '</div><div class="meta">' + outs.length + ' Abgänge</div></div>' +
      '<div class="card stat"><div class="label">Transfersaldo</div><div class="value ' + (earn - spend >= 0 ? 'good' : 'bad') + '">' + FM.fmtMoney(earn - spend, { sign: true }) + '</div><div class="meta">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + '</div></div></div>' +
      '<div class="grid g2"><div class="card"><div class="card-h"><h3>Zugänge</h3></div>' + tbl(ins, 'from') + '</div><div class="card"><div class="card-h"><h3>Abgänge</h3></div>' + tbl(outs, 'to') + '</div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Offene Raten</h3><span class="muted small">Fällige Raten erhöhen die Liquiditätsreserve</span></div>' + paysHtml + '</div>';
  }

  function logView() {
    var st = FM.state;
    var list = st.transfers.slice(0, 80);
    return '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Spieler</th><th class="hide-sm">Von</th><th>Nach</th><th class="num">Ablöse</th></tr></thead><tbody>' +
      (list.length ? list.map(function (t) {
        var p = st.players[t.pid];
        return '<tr' + (t.to === st.user.club || t.from === st.user.club ? ' class="me"' : '') + '><td class="nowrap small">' + D.fmt(t.date) + '</td><td>' + (p ? UI.playerLink(p) : esc(t.name)) + ' <span class="muted small">' + FM.POS_LABEL[t.pos] + ' · ' + t.ovr + '</span></td>' +
          '<td class="hide-sm">' + (t.from ? UI.clubLink(t.from) : '<span class="muted">vereinslos</span>') + '</td><td>' + UI.clubLink(t.to) + '</td><td class="num">' +
          (t.loan ? '<span class="tag info">Leihe</span>' : t.pre ? '<span class="tag">Vorvertrag</span>' : t.fee ? FM.fmtMoney(t.fee) : '<span class="muted">ablösefrei</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="5"><div class="empty">Noch keine Transfers.</div></td></tr>') + '</tbody></table></div></div>';
  }

  /* ================= Verhandlungsdialog ================= */
  UI.actions.negotiate = function (el) { UI.negotiate(el.getAttribute('data-id'), el.getAttribute('data-k')); };
  UI.actions.negKind = function (el) { UI.negotiate(el.getAttribute('data-id'), el.getAttribute('data-k')); };

  UI.negotiate = function (pid, kind) {
    var st = FM.state, p = st.players[pid];
    if (!p) return;
    var kinds = FM.dealKinds(st, p);
    if (!kinds.length) { UI.toast('Mit diesem Spieler ist gerade kein Geschäft möglich.', 'bad'); return; }
    var t = FM.talkOf(st, pid);
    if (!kind || kinds.indexOf(kind) < 0) kind = t && kinds.indexOf(t.kind) >= 0 ? t.kind : kinds[0];
    t = FM.startTalk(st, pid, kind);
    if (t.error) { UI.toast(t.error, 'bad'); return; }
    renderNeg(pid);
  };

  function kindSeg(st, p, t) {
    var kinds = FM.dealKinds(st, p).filter(function (k) { return k !== 'renew'; });
    if (kinds.length < 2 || (t.stage === 'player' && t.deal && t.kind !== 'clause')) return '';
    return '<div class="seg" style="margin-bottom:14px">' + kinds.map(function (k) {
      return '<button data-action="negKind" data-id="' + p.id + '" data-k="' + k + '" class="' + (t.kind === k ? 'on' : '') + '">' + FM.DEAL_LABEL[k] + '</button>';
    }).join('') + '</div>';
  }

  function renderNeg(pid, msg) {
    var st = FM.state, p = st.players[pid], t = FM.talkOf(st, pid), uc = st.user.club, club = st.clubs[uc];
    if (!t) { UI.closeModal(); return; }
    t.ui = t.ui || {};
    var seller = p.club && p.club !== uc ? st.clubs[p.club] : null;
    var clubStage = t.stage === 'club';
    var steps = (t.kind === 'buy' || t.kind === 'loan') ? '<div class="steps"><span class="' + (clubStage ? 'on' : 'done') + '">1 · Verein</span>' + (t.kind === 'buy' ? '<span class="' + (clubStage ? '' : 'on') + '">2 · Spieler</span>' : '') + '</div>' : '';
    var head = '<div class="modal-h"><div class="ph" style="flex:1;min-width:0">' + UI.pill(p.ovr, 'lg') + '<div class="info"><div class="eyebrow" style="margin:0">' + (t.kind === 'renew' ? 'Vertragsverlängerung' : 'Verhandlung · ' + FM.DEAL_LABEL[t.kind]) + '</div>' +
      '<div class="name ellipsis" style="font-size:26px">' + esc(p.name) + '</div><div class="row wrap small dim" style="gap:6px;margin-top:2px">' + p.pos.map(UI.posTag).join(' ') + ' ' + p.age + ' J. · ' +
      (seller ? UI.badge(seller, 16) + ' ' + esc(seller.short) : p.club === uc ? 'dein Spieler' : 'vereinslos') + ' · Marktwert ' + FM.fmtMoney(FM.marketValue(p)) + '</div></div></div>' +
      '<button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
    var form = clubStage ? (t.kind === 'loan' ? loanForm(st, p, t) : buyForm(st, p, t)) : playerForm(st, p, t);
    var pat = clubStage ? patience(t.pat, t.max) : patience(t.ppat, t.pmax);
    var who = clubStage ? seller.short : p.name.split(' ').slice(-1)[0];
    var side = '<aside class="neg-side"><div class="row between"><span class="eyebrow" style="margin:0;color:var(--text-3)">Geduld ' + esc(who) + '</span>' + pat + '</div>' +
      '<div class="neg-log">' + t.log.slice().reverse().map(function (l) { return '<div class="' + (l.me ? 'me' : 'them') + '"><b>' + (l.me ? 'Du' : '') + '</b>' + esc(l.text) + '</div>'; }).join('') + '</div></aside>';
    var btn = clubStage ? (t.kind === 'loan' ? 'Leihe anfragen' : 'Angebot senden') : t.kind === 'renew' ? 'Vertrag anbieten' : t.kind === 'pre' ? 'Vorvertrag anbieten' : 'Vertrag anbieten';
    UI.modal(head + '<div class="modal-b">' + steps + kindSeg(st, p, t) + '<div class="neg-grid"><div class="stack">' + form + '<div id="n-msg">' + (msg ? '<div class="note ' + msg.cls + '">' + esc(msg.text) + '</div>' : '') + '</div></div>' + side + '</div></div>' +
      '<div class="modal-f"><button class="btn ghost danger" data-action="negCancel" data-id="' + pid + '" style="margin-right:auto">Gespräche beenden</button><button class="btn" data-action="closeModal">Später</button><button class="btn primary" id="n-go">' + btn + '</button></div>',
      { size: 'wide', mount: function (m) { mountNeg(m, pid); } });
  }

  function buyForm(st, p, t) {
    var uc = st.user.club, u = t.ui;
    var fee = u.fee != null ? u.fee : t.counter || t.ask;
    var swaps = FM.clubPlayers(st, uc).filter(function (x) { return !x.loan && !x.pre; }).sort(function (a, b) { return FM.marketValue(b) - FM.marketValue(a); });
    var o = function (v, l, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + l + '</option>'; };
    return (t.star ? '<div class="note warn">Leistungsträger: ' + esc(st.clubs[p.club].short) + ' verkauft nur für deutlich mehr als den Marktwert.</div>' : '') +
      '<div class="field"><label>Ablöse (€)</label><div class="row"><input class="input" id="n-fee" type="number" step="50000" min="0" value="' + Math.round(fee) + '" style="flex:1">' +
      '<button class="btn sm" data-fee="' + t.ask + '" type="button">Forderung</button>' + (t.counter ? '<button class="btn sm" data-fee="' + t.counter + '" type="button">Gegenangebot</button>' : '') + '</div>' +
      '<div class="row wrap" style="gap:6px;margin-top:6px">' + [-20, -10, -5, 5, 10].map(function (x) { return '<button class="btn sm ghost" data-pct="' + x + '" type="button">' + (x > 0 ? '+' : '−') + Math.abs(x) + ' %</button>'; }).join('') + '</div></div>' +
      '<div class="grid g2"><div class="field"><label>Zahlung</label><select class="input" id="n-inst">' + o(1, 'Sofort komplett', u.inst) + o(2, '2 Jahresraten', u.inst) + o(3, '3 Jahresraten', u.inst) + '</select></div>' +
      '<div class="field"><label>Weiterverkaufsbeteiligung</label><select class="input" id="n-sell">' + o(0, 'keine', u.sellOn) + o(0.1, '10 % für den Verkäufer', u.sellOn) + o(0.2, '20 % für den Verkäufer', u.sellOn) + '</select></div></div>' +
      '<div class="field"><label>Spieler im Tausch</label><select class="input" id="n-swap"><option value="">kein Tausch</option>' + swaps.map(function (x) {
        return o(x.id, esc(x.name) + ' (' + FM.POS_LABEL[x.pos[0]] + ', ' + x.ovr + ') · MW ' + FM.fmtMoneyShort(FM.marketValue(x)), u.swap || '');
      }).join('') + '</select></div>' +
      '<p class="muted small">Raten und Weiterverkaufsbeteiligung senken, was du jetzt zahlen musst. Für junge Talente ist dem Verkäufer eine Beteiligung viel wert. Tauschspieler rechnet er nach seinem Bedarf an.</p>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  function loanForm(st, p, t) {
    var uc = st.user.club, u = t.ui;
    var role = FM.expectedRole(st, p, uc);
    var share = u.share != null ? u.share : t.counterShare != null ? t.counterShare : 0.5;
    return '<div class="note">Leihe bis Saisonende. Bei dir wäre ' + esc(p.name) + ' <b>' + FM.ROLE_LABEL[role] + '</b>. Spieler ohne Einsatzchancen lehnen ab.</div>' +
      '<div class="field"><label>Dein Anteil am Gehalt: <b id="n-share-l"></b></label><input type="range" id="n-share" min="0" max="100" step="10" value="' + Math.round(share * 100) + '"></div>' +
      '<div class="field"><label>Kaufoption (€, 0 = keine)</label><input class="input" id="n-opt" type="number" step="50000" min="0" value="' + (u.option || 0) + '"><span class="muted small">Richtwert: ab etwa ' + FM.fmtMoney(FM.niceUp(FM.askingPrice(st, p) * 1.15)) + '</span></div>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  function playerForm(st, p, t) {
    var u = t.ui, uc = st.user.club;
    var role = u.role || t.expRole;
    var d = FM.playerDemand(st, t, role);
    var mv = FM.marketValue(p);
    var wage = u.wage != null ? u.wage : d.wage, bonus = u.bonus != null ? u.bonus : d.bonus;
    var years = u.years || Math.min(d.maxYears, t.kind === 'renew' ? 2 : 3);
    var clauseOpts = [[0, 'keine']].concat([1.5, 2, 2.5, 3].map(function (f) { var v = FM.niceRound(mv * f); return [v, FM.fmtMoney(v) + ' (' + String(f).replace('.', ',') + '× MW)']; }));
    if (d.clause && !clauseOpts.some(function (c) { return c[0] === d.clause; })) clauseOpts.splice(1, 0, [d.clause, FM.fmtMoney(d.clause) + ' (Wunsch)']);
    var clause = u.clause != null ? u.clause : 0;
    var o = function (v, l, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + l + '</option>'; };
    var note = '';
    if (t.kind === 'clause') note = '<div class="note">Ausstiegsklausel: ' + esc(st.clubs[p.club].short) + ' muss ' + FM.fmtMoney(t.deal.fee) + ' akzeptieren. Jetzt entscheidet nur noch der Spieler.</div>';
    if (t.kind === 'pre') note = '<div class="note">Vorvertrag: ' + esc(p.name) + ' wechselt zum 1. Juli ablösefrei. Das Handgeld wird sofort fällig.</div>';
    if (t.kind === 'renew') note = '<div class="note">Aktueller Vertrag bis ' + p.contract.until + ', ' + FM.fmtMoney(p.contract.wage) + ' pro Jahr als ' + FM.ROLE_LABEL[FM.roleOf(st, p)] + '.' + (p.wants ? ' Er hat einen Wechselwunsch – mit einer größeren Rolle lässt er sich eher halten.' : '') + '</div>';
    if (t.rival) note += '<div class="note warn">Auch ' + esc(st.clubs[t.rival].name) + ' wirbt um ' + esc(p.name) + ' – er verlangt mehr.</div>';
    return note +
      '<div class="grid g2"><div class="field"><label>Rolle im Kader</label><select class="input" id="n-role">' + FM.ROLES.filter(function (r) { return r !== 'prospect' || p.age <= 21; }).map(function (r) {
        return o(r, FM.ROLE_LABEL[r] + (r === t.expRole ? ' – erwartet' : ''), role);
      }).join('') + '</select></div>' +
      '<div class="field"><label>Laufzeit</label><select class="input" id="n-years">' + [1, 2, 3, 4, 5].filter(function (y) { return y <= d.maxYears; }).map(function (y) { return o(y, y + ' Jahr' + (y > 1 ? 'e' : '') + ' (bis ' + (st.season.year + y + (t.kind === 'pre' ? 1 : 0)) + ')', years); }).join('') + '</select></div></div>' +
      '<div class="grid g2"><div class="field"><label>Jahresgehalt (€)</label><input class="input" id="n-wage" type="number" step="10000" min="0" value="' + wage + '"></div>' +
      '<div class="field"><label>Handgeld (€)</label><input class="input" id="n-bonus" type="number" step="10000" min="0" value="' + bonus + '"></div></div>' +
      '<div class="field"><label>Ausstiegsklausel</label><select class="input" id="n-clause">' + clauseOpts.map(function (c) { return o(c[0], c[1], clause); }).join('') + '</select></div>' +
      '<div class="small dim" id="n-demand"></div>' +
      '<p class="muted small">Eine größere Rolle senkt die Gehaltsforderung, muss aber mit Einsatzzeit eingelöst werden – sonst wird er unzufrieden. Mehr Handgeld senkt das geforderte Gehalt. Eine Ausstiegsklausel macht ihn günstiger, erlaubt anderen Vereinen aber, ihn zu holen.</p>' +
      '<dl class="cost" id="n-cost"></dl>';
  }

  function mountNeg(m, pid) {
    var st = FM.state, p = st.players[pid], t = FM.talkOf(st, pid), uc = st.user.club, club = st.clubs[uc];
    var b = FM.budget(st, club);
    var $ = function (id) { return m.querySelector('#' + id); };
    function readUi() {
      if (t.stage === 'club' && t.kind === 'buy') {
        t.ui.fee = +$('n-fee').value || 0; t.ui.inst = +$('n-inst').value; t.ui.sellOn = +$('n-sell').value; t.ui.swap = $('n-swap').value || null;
      } else if (t.stage === 'club') {
        t.ui.share = +$('n-share').value / 100; t.ui.option = +$('n-opt').value || 0;
      } else {
        t.ui.role = $('n-role').value; t.ui.years = +$('n-years').value; t.ui.wage = +$('n-wage').value || 0; t.ui.bonus = +$('n-bonus').value || 0; t.ui.clause = +$('n-clause').value || 0;
      }
    }
    function cost() {
      readUi();
      var u = t.ui, c = $('n-cost'), html = '';
      if (t.stage === 'club' && t.kind === 'buy') {
        var now = FM.dealUpfront({ fee: u.fee, inst: u.inst }), agent = Math.round(u.fee * FM.AGENT_FEE);
        html = '<dt>Jetzt fällig</dt><dd>' + FM.fmtMoney(now) + '</dd><dt>Beraterhonorar 10 %</dt><dd>' + FM.fmtMoney(agent) + '</dd>' +
          (u.inst > 1 ? '<dt>Spätere Raten</dt><dd>' + FM.fmtMoney(u.fee - now) + '</dd>' : '') +
          (u.swap && st.players[u.swap] ? '<dt>Tauschspieler (Marktwert)</dt><dd>' + FM.fmtMoney(FM.marketValue(st.players[u.swap])) + '</dd>' : '') +
          '<dt class="sum">Belastet Transferbudget jetzt</dt><dd class="sum ' + (now + agent > b.transfer ? 'bad' : '') + '">' + FM.fmtMoney(now + agent) + ' / ' + FM.fmtMoney(b.transfer) + '</dd>';
      } else if (t.stage === 'club') {
        $('n-share-l').textContent = Math.round(u.share * 100) + ' %';
        var w = p.contract.wage * u.share, room = FM.wageRoom(st, club);
        html = '<dt>Gehalt des Spielers</dt><dd>' + FM.fmtMoney(p.contract.wage) + '</dd><dt class="sum">Davon zahlst du</dt><dd class="sum ' + (w > room ? 'bad' : '') + '">' + FM.fmtMoney(w) + ' / ' + FM.fmtMoney(Math.max(0, room)) + ' Spielraum</dd>' +
          (u.option ? '<dt>Kaufoption</dt><dd>' + FM.fmtMoney(u.option) + ' (später, freiwillig)</dd>' : '');
      } else {
        var d = FM.playerDemand(st, t, u.role);
        var clauseOk = !d.clause || (u.clause && u.clause <= d.clause);
        $('n-demand').innerHTML = 'Erwartung als <b>' + FM.ROLE_LABEL[u.role] + '</b>: rund ' + FM.fmtMoney(Math.round(d.wage * (clauseOk ? 1 : 1.08))) + ' pro Jahr, ' + FM.fmtMoney(d.bonus) + ' Handgeld' +
          (d.clause ? ', Klausel höchstens ' + FM.fmtMoney(d.clause) + (clauseOk ? ' ✓' : ' (sonst 8 % mehr Gehalt)') : '') + (d.interest < 30 ? ' – <span class="bad">in dieser Rolle sieht er keine Perspektive</span>' : '');
        var deal = t.deal || { fee: 0, inst: 1 };
        var upfront = FM.dealUpfront(deal) + Math.round((deal.fee || 0) * FM.AGENT_FEE) + u.bonus;
        var roomP = t.kind === 'pre' ? FM.wageRoom(st, club) + FM.expiringWages(st, club) : FM.wageRoom(st, club) + (t.kind === 'renew' ? p.contract.wage : 0);
        html = (deal.fee ? '<dt>Ablöse jetzt + Berater</dt><dd>' + FM.fmtMoney(FM.dealUpfront(deal) + Math.round(deal.fee * FM.AGENT_FEE)) + '</dd>' : '') +
          '<dt>Handgeld</dt><dd>' + FM.fmtMoney(u.bonus) + '</dd><dt class="sum">Belastet Transferbudget</dt><dd class="sum ' + (upfront > b.transfer ? 'bad' : '') + '">' + FM.fmtMoney(upfront) + ' / ' + FM.fmtMoney(b.transfer) + '</dd>' +
          '<dt>Gehalt vom Spielraum' + (t.kind === 'pre' ? ' (ab Juli)' : '') + '</dt><dd class="' + (u.wage > roomP ? 'bad' : '') + '">' + FM.fmtMoney(u.wage) + ' / ' + FM.fmtMoney(Math.max(0, roomP)) + '</dd>';
      }
      c.innerHTML = html;
    }
    m.querySelectorAll('input, select').forEach(function (i) { i.addEventListener('input', cost); i.addEventListener('change', cost); });
    m.querySelectorAll('[data-fee]').forEach(function (bt) { bt.addEventListener('click', function () { $('n-fee').value = bt.getAttribute('data-fee'); cost(); }); });
    m.querySelectorAll('[data-pct]').forEach(function (bt) { bt.addEventListener('click', function () { var f = +$('n-fee').value || t.ask; $('n-fee').value = FM.niceRound(f * (1 + +bt.getAttribute('data-pct') / 100)); cost(); }); });
    var roleSel = $('n-role');
    if (roleSel) roleSel.addEventListener('change', function () {
      var d = FM.playerDemand(st, t, roleSel.value);
      $('n-wage').value = d.wage; $('n-bonus').value = d.bonus;
      cost();
    });
    cost();
    $('n-go').addEventListener('click', function () {
      readUi();
      var u = t.ui, r;
      if (t.stage === 'club') r = FM.clubOffer(st, pid, t.kind === 'loan' ? { wageShare: u.share, option: u.option } : { fee: u.fee, inst: u.inst, sellOn: u.sellOn, swap: u.swap });
      else r = FM.playerOffer(st, pid, { role: u.role, years: u.years, wage: u.wage, bonus: u.bonus, clause: u.clause });
      if (r.status === 'error') { $('n-msg').innerHTML = '<div class="note bad">' + esc(r.msg) + '</div>'; return; }
      FM.save(UI.slot || 1);
      if (r.status === 'done') { UI.closeModal(); UI.toast(r.msg, 'good'); UI.refresh(); return; }
      if (r.status === 'broken') { UI.closeModal(); UI.toast(r.msg, 'bad'); UI.refresh(); return; }
      if (r.status === 'counter') {
        if (r.wage) t.ui.wage = r.wage;
        if (r.share != null) t.counterShare = r.share;
        if (r.option) t.ui.option = r.option;
        renderNeg(pid, { cls: 'warn', text: r.msg });
        return;
      }
      // Verein einverstanden -> Vertragsgespraech
      t.ui = {};
      renderNeg(pid, { cls: 'good', text: r.msg });
    });
  }

  UI.actions.negCancel = function (el) {
    var st = FM.state, pid = el.getAttribute('data-id');
    FM.cancelTalk(st, pid);
    UI.closeModal();
    UI.toast('Gespräche beendet.');
    UI.refresh();
  };
})();
