/* Ansichten: Kader, Spielerprofil, Taktik & Aufstellung, Training. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc;

  /* ================= Kader ================= */
  var GROUP_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
  function posOrder(p) { return GROUP_ORDER[FM.mainGroup(p)] * 100 + FM.POS_ORDER.indexOf(p.pos[0]); }

  UI.formArrow = function (f) {
    if (f > 1.2) return '<span class="good" title="Starke Form">▲▲</span>';
    if (f > 0.4) return '<span class="good" title="Gute Form">▲</span>';
    if (f < -1.2) return '<span class="bad" title="Formkrise">▼▼</span>';
    if (f < -0.4) return '<span class="bad" title="Schwache Form">▼</span>';
    return '<span class="muted" title="Normale Form">●</span>';
  };
  UI.morale = function (m) {
    if (m >= 80) return '<span class="good">Bestens</span>';
    if (m >= 62) return '<span class="good">Zufrieden</span>';
    if (m >= 45) return '<span class="dim">Okay</span>';
    if (m >= 28) return '<span class="warn">Unzufrieden</span>';
    return '<span class="bad">Frustriert</span>';
  };

  UI.views.squad = {
    title: 'Kader',
    render: function () {
      var st = FM.state, uc = st.user.club;
      var s = UI.vs('squad', { g: 'all', mode: 'over', sort: 'pos', dir: 1 });
      var players = FM.clubPlayers(st, uc).filter(function (p) { return s.g === 'all' || FM.mainGroup(p) === s.g; });
      var key = {
        pos: posOrder, name: function (p) { return p.name; }, age: function (p) { return p.age; }, ovr: function (p) { return p.ovr; },
        pot: function (p) { return p.pot; }, fit: function (p) { return p.fit; }, value: function (p) { return FM.marketValue(p); },
        apps: function (p) { return p.st.apps; }, goals: function (p) { return p.st.goals; }, assists: function (p) { return p.st.assists; },
        grade: function (p) { var g = FM.avgGrade(p); return g == null ? 9 : -g; }, wage: function (p) { return p.contract.wage; },
        until: function (p) { return p.contract.until; }, mins: function (p) { return p.st.mins; }, form: function (p) { return p.form; }
      }[s.sort] || posOrder;
      players.sort(function (a, b) {
        var x = key(a), y = key(b);
        var r = x < y ? -1 : x > y ? 1 : 0;
        if (s.sort === 'pos') return r || b.ovr - a.ovr;
        return r * (s.dir || -1) || b.ovr - a.ovr;
      });
      var wages = FM.annualWages(st, st.clubs[uc]);
      var value = FM.sum(FM.clubPlayers(st, uc), function (p) { return FM.marketValue(p); });
      var html = '<div class="page-h"><div><h1>Kader</h1><div class="sub">' + FM.clubPlayers(st, uc).length + ' Spieler · Ø Alter ' + FM.avg(FM.clubPlayers(st, uc), function (p) { return p.age; }).toFixed(1) +
        ' · Gesamtmarktwert ' + FM.fmtMoney(value) + ' · Gehälter ' + FM.fmtMoney(wages) + '/Jahr</div></div>' +
        '<div class="row wrap">' + UI.seg('g', [['all', 'Alle'], ['GK', 'Tor'], ['DEF', 'Abwehr'], ['MID', 'Mittelfeld'], ['ATT', 'Angriff']], s.g) +
        UI.seg('mode', [['over', 'Übersicht'], ['stats', 'Statistik'], ['contract', 'Verträge']], s.mode) + '</div></div>';
      var th = function (k, l, cls) { return UI.sortTh('squad', k, l, s.sort, s.dir, cls); };
      var head = '<tr>' + th('pos', 'Pos') + th('name', 'Name');
      if (s.mode === 'over') head += th('age', 'Alter', 'num') + th('ovr', 'Stärke', 'num') + th('pot', 'Pot.', 'num hide-xs') + th('form', 'Form', 'num hide-xs') + th('fit', 'Fitness', 'hide-xs') + '<th class="hide-sm">Moral</th>' + th('value', 'Marktwert', 'num hide-xs');
      else if (s.mode === 'stats') head += th('apps', 'Sp', 'num') + th('mins', 'Min', 'num hide-xs') + th('goals', 'Tore', 'num') + th('assists', 'Vorl.', 'num') + th('grade', 'Ø Note', 'num') + '<th class="num hide-xs">Gelb</th><th class="num hide-xs">Rot</th><th class="num hide-xs">Pokal</th>';
      else head += th('age', 'Alter', 'num') + th('ovr', 'Stärke', 'num') + th('until', 'Vertrag bis', 'num') + th('wage', 'Gehalt/Jahr', 'num') + th('value', 'Marktwert', 'num hide-xs');
      head += '</tr>';
      var lastGroup = null, cols = s.mode === 'stats' ? 10 : 9;
      var body = players.map(function (p) {
        var grp = '';
        if (s.sort === 'pos' && FM.mainGroup(p) !== lastGroup) {
          lastGroup = FM.mainGroup(p);
          grp = '<tr class="group"><td colspan="' + cols + '">' + FM.GROUP_LABEL[lastGroup] + '</td></tr>';
        }
        var row = '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td><div class="row" style="gap:6px;flex-wrap:wrap"><span class="pname">' + esc(p.name) + '</span>' + UI.srcMark(p) + ' ' + UI.status(p) + '</div>' +
          '<div class="muted tiny">' + p.pos.map(function (x) { return FM.POS_LABEL[x]; }).join(' · ') + '</div></td>';
        if (s.mode === 'over') {
          row += '<td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + delta(p) + '</td><td class="num hide-xs">' + p.pot + '</td><td class="num hide-xs">' + UI.formArrow(p.form) + '</td>' +
            '<td class="hide-xs">' + UI.fit(p.fit) + ' <span class="muted small tnum">' + Math.round(p.fit) + '</span></td><td class="hide-sm small">' + UI.morale(p.mor) + '</td><td class="num hide-xs">' + FM.fmtMoney(FM.marketValue(p)) + '</td>';
        } else if (s.mode === 'stats') {
          var g = FM.avgGrade(p);
          row += '<td class="num">' + p.st.apps + '</td><td class="num hide-xs">' + p.st.mins + '</td><td class="num">' + p.st.goals + '</td><td class="num">' + p.st.assists + '</td><td class="num">' + UI.grade(g == null ? null : FM.round1(g)) + '</td>' +
            '<td class="num hide-xs">' + p.st.yc + '</td><td class="num hide-xs">' + p.st.rc + '</td><td class="num hide-xs">' + p.cst.apps + '/' + p.cst.goals + '</td>';
        } else {
          var ending = p.contract.until <= st.season.year + 1;
          row += '<td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="num ' + (ending ? 'warn strong' : '') + '">' + p.contract.until + '</td><td class="num">' + FM.fmtMoney(p.contract.wage) + '</td><td class="num hide-xs">' + FM.fmtMoney(FM.marketValue(p)) + '</td>';
        }
        return grp + row + '</tr>';
      }).join('');
      html += '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
      html += '<p class="muted small" style="margin-top:10px">≈ = geschätzter Wert · ²⁶ = FC-26-Datenstand · Akademie = fiktiver Nachwuchsspieler. Klick auf einen Spieler öffnet das Profil.</p>';
      return html;
    }
  };

  function delta(p) {
    if (p.ovr0 == null || p.ovr0 === p.ovr) return '';
    var d = p.ovr - p.ovr0;
    return ' <span class="tiny ' + (d > 0 ? 'good' : 'bad') + '">' + (d > 0 ? '+' : '') + d + '</span>';
  }

  /* ================= Spielerprofil ================= */
  UI.actions.player = function (el) { UI.playerModal(el.getAttribute('data-id')); };

  UI.playerModal = function (pid) {
    var st = FM.state, p = st.players[pid];
    if (!p) { UI.toast('Spieler nicht mehr verfügbar.'); return; }
    var own = p.club === st.user.club;
    var club = p.club ? st.clubs[p.club] : null;
    var labels = FM.statLabels(p), names = FM.statNames(p);
    var attrs = p.s.map(function (v, i) {
      var c = v >= 80 ? 'var(--good)' : v >= 65 ? 'var(--accent)' : v >= 50 ? 'var(--warn)' : 'var(--bad)';
      return '<div class="attr" title="' + esc(names[i]) + '"><span class="k">' + labels[i] + '</span><div class="bar"><i style="width:' + v + '%;background:' + c + '"></i></div><span class="v">' + v + '</span></div>';
    }).join('');
    var value = FM.marketValue(p);
    var ask = p.club && !own ? FM.askingPrice(st, p) : null;
    var interest = !own ? FM.interest(st, p, st.user.club) : null;
    var il = interest != null ? FM.interestLabel(interest) : null;
    var g = FM.avgGrade(p);
    var info = '<dl class="kv">' +
      '<dt>Verein</dt><dd>' + (club ? UI.clubLink(club.id) : 'vereinslos') + '</dd>' +
      '<dt>Alter</dt><dd>' + p.age + (p.ageEst ? ' <span class="muted" title="Alter geschätzt">≈</span>' : '') + '</dd>' +
      '<dt>Positionen</dt><dd>' + p.pos.map(function (x) { return FM.POS_LABEL[x]; }).join(', ') + '</dd>' +
      '<dt>Potenzial</dt><dd>' + UI.potRange(p) + '</dd>' +
      '<dt>Marktwert</dt><dd>' + FM.fmtMoney(value) + '</dd>' +
      (ask ? '<dt>Ablöseforderung</dt><dd>' + FM.fmtMoney(ask) + '</dd>' : '') +
      '<dt>Vertrag bis</dt><dd>' + (p.club ? 'Juni ' + p.contract.until : '–') + '</dd>' +
      '<dt>Gehalt</dt><dd>' + (p.club ? FM.fmtMoney(p.contract.wage) + '/Jahr' : 'Forderung ' + FM.fmtMoney(FM.contractWageDemand(st, p, st.user.club, interest || 50))) + '</dd>' +
      '<dt>Form</dt><dd>' + UI.formArrow(p.form) + '</dd>' +
      '<dt>Fitness</dt><dd>' + UI.fit(p.fit) + ' ' + Math.round(p.fit) + ' %</dd>' +
      (own ? '<dt>Moral</dt><dd>' + UI.morale(p.mor) + '</dd>' : '') +
      (il ? '<dt>Wechselbereitschaft</dt><dd><span class="tag ' + il.c + '">' + il.t + '</span></dd>' : '') +
      '</dl>';
    var seasonStats = '<div class="grid g4" style="gap:8px">' +
      mini('Spiele', p.st.apps) + mini('Tore', p.st.goals) + mini('Vorlagen', p.st.assists) + mini('Ø Note', g == null ? '–' : FM.fmtGrade(FM.round1(g))) + '</div>' +
      '<div class="muted small" style="margin-top:6px">' + p.st.mins + ' Minuten · ' + p.st.yc + ' Gelb · ' + p.st.rc + ' Rot' + (FM.isGK(p) ? ' · ' + p.st.cs + ' Spiele ohne Gegentor' : '') + ' · Pokal: ' + p.cst.apps + ' Spiele, ' + p.cst.goals + ' Tore</div>';
    var hist = p.hist.length ? '<table class="tbl compact"><thead><tr><th>Saison</th><th>Verein</th><th class="num">Sp</th><th class="num">T</th><th class="num">V</th><th class="num">Ø</th><th class="num">Stärke</th></tr></thead><tbody>' +
      p.hist.slice().reverse().map(function (h) { return '<tr><td>' + h.y + '/' + String(h.y + 1).slice(2) + '</td><td>' + (h.club ? UI.clubLink(h.club) : '–') + '</td><td class="num">' + h.apps + '</td><td class="num">' + h.goals + '</td><td class="num">' + h.assists + '</td><td class="num">' + UI.grade(h.avg) + '</td><td class="num">' + h.ovr + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="muted small">Noch keine abgeschlossene Saison im Spiel.</div>';
    var src = '<div class="note small" style="margin-top:12px"><b>Datenquelle:</b> ' + esc(FM.SRC_LABEL[p.src] || '') + '</div>';
    var actions = '';
    if (own) {
      actions = '<button class="btn" data-action="toggleList" data-id="' + p.id + '">' + (p.listed ? 'Von Transferliste nehmen' : 'Auf Transferliste setzen') + '</button>' +
        '<button class="btn" data-action="contractDlg" data-id="' + p.id + '">Vertrag verlängern</button>' +
        '<button class="btn danger" data-action="releaseDlg" data-id="' + p.id + '">Vertrag auflösen</button>';
    } else {
      var can = !p.club || FM.isWindowOpen(st);
      actions = '<span class="muted small" style="margin-right:auto">' + (can ? '' : FM.windowLabel(st)) + '</span>' +
        '<button class="btn primary" data-action="bidDlg" data-id="' + p.id + '"' + (can ? '' : ' disabled') + '>' + (p.club ? 'Angebot abgeben' : 'Verpflichten') + '</button>';
    }
    var head = '<div class="modal-h"><div class="ph" style="flex:1;min-width:0">' + UI.pill(p.ovr, 'xl') +
      '<div class="info"><div class="name ellipsis">' + esc(p.name) + '</div><div class="row wrap" style="gap:6px;margin-top:4px">' + p.pos.map(UI.posTag).join(' ') +
      '<span class="muted small">' + p.age + ' Jahre</span>' + (club ? UI.badge(club, 18) + '<span class="small dim">' + esc(club.short) + '</span>' : '<span class="tag">vereinslos</span>') + UI.status(p) + '</div></div></div>' +
      '<button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
    UI.modal(head + '<div class="modal-b"><div class="grid g2"><div><h4 style="margin-bottom:6px">' + (FM.isGK(p) ? 'Torwartwerte' : 'Kartenwerte') + ' (FC-27-Skala)</h4>' + attrs + src + '</div><div>' + info + '</div></div>' +
      '<h4 style="margin:18px 0 8px">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + ' (Liga)</h4>' + seasonStats +
      '<h4 style="margin:18px 0 8px">Karriere im Spiel</h4>' + hist + '</div>' +
      '<div class="modal-f">' + actions + '</div>');
  };
  function mini(l, v) { return '<div class="card stat" style="padding:10px 12px"><div class="label">' + l + '</div><div class="value" style="font-size:18px">' + v + '</div></div>'; }

  UI.actions.toggleList = function (el) {
    var p = FM.state.players[el.getAttribute('data-id')];
    p.listed = !p.listed;
    UI.toast(p.listed ? p.name + ' steht auf der Transferliste.' : p.name + ' ist nicht mehr gelistet.');
    UI.playerModal(p.id);
    if (UI.view === 'squad' || UI.view === 'transfers') { var keep = UI.modalOpen; UI.refresh(); if (keep) UI.playerModal(p.id); }
  };

  UI.actions.releaseDlg = function (el) {
    var st = FM.state, p = st.players[el.getAttribute('data-id')];
    var left = Math.max(0, p.contract.until - st.season.year);
    var cost = Math.round(p.contract.wage * Math.max(0.5, left) * 0.5);
    UI.confirm('Vertrag von ' + p.name + ' auflösen?', 'Die Abfindung beträgt ' + FM.fmtMoney(cost) + ' und wird vom Transferbudget abgezogen. Das Gehalt von ' + FM.fmtMoney(p.contract.wage) + ' wird im Gehaltsbudget frei. Der Spieler wird vereinslos.', 'Auflösen', function () {
      FM.releasePlayer(st, p);
      UI.toast(p.name + ' wurde freigestellt.');
      UI.refresh();
    }, true);
  };

  UI.actions.contractDlg = function (el) {
    var st = FM.state, p = st.players[el.getAttribute('data-id')];
    var demand = FM.contractWageDemand(st, p, p.club, 70);
    var years = p.age >= 33 ? 1 : 3;
    UI.modal(UI.modalHead('Vertrag verlängern', esc(p.name) + ' · aktuell bis ' + p.contract.until + ', ' + FM.fmtMoney(p.contract.wage) + '/Jahr') +
      '<div class="modal-b"><div class="grid g2"><div class="field"><label>Jahresgehalt (€)</label><input class="input" id="c-wage" type="number" step="10000" min="0" value="' + demand + '"></div>' +
      '<div class="field"><label>Laufzeit</label><select class="input" id="c-years">' + [1, 2, 3, 4, 5].map(function (y) { return '<option value="' + y + '"' + (y === years ? ' selected' : '') + '>' + y + ' Jahr' + (y > 1 ? 'e' : '') + ' (bis ' + (st.season.year + y) + ')</option>'; }).join('') + '</select></div></div>' +
      '<p class="muted small" style="margin-top:10px">Gehaltsvorstellung des Spielers: ca. ' + FM.fmtMoney(demand) + ' pro Jahr. Spielraum im Gehaltsbudget für diesen Vertrag: ' + FM.fmtMoney(Math.max(0, FM.wageRoom(st, st.clubs[p.club]) + p.contract.wage)) + '.</p><div id="c-msg" style="margin-top:10px"></div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn primary" id="c-ok">Angebot machen</button></div>',
      { size: 'narrow', mount: function (m) {
        m.querySelector('#c-ok').addEventListener('click', function () {
          var r = FM.extendContract(st, p, +m.querySelector('#c-wage').value, +m.querySelector('#c-years').value);
          if (r.ok) { UI.closeModal(); UI.toast(p.name + ': ' + r.msg, 'good'); UI.refresh(); }
          else { m.querySelector('#c-msg').innerHTML = '<div class="note warn">' + esc(r.msg) + '</div>'; if (r.wageCounter) m.querySelector('#c-wage').value = r.wageCounter; }
        });
      } });
  };

  UI.actions.bidDlg = function (el) {
    var st = FM.state, p = st.players[el.getAttribute('data-id')];
    var buyer = st.clubs[st.user.club];
    var interest = FM.interest(st, p, buyer.id);
    var ask = p.club ? FM.askingPrice(st, p) : 0;
    var demand = FM.contractWageDemand(st, p, buyer.id, interest);
    var il = FM.interestLabel(interest);
    var bud = FM.budget(st, buyer), room = FM.wageRoom(st, buyer);
    UI.modal(UI.modalHead(p.club ? 'Angebot für ' + esc(p.name) : esc(p.name) + ' verpflichten', p.club ? esc(st.clubs[p.club].name) + ' · Marktwert ' + FM.fmtMoney(FM.marketValue(p)) : 'Vereinslos – keine Ablöse') +
      '<div class="modal-b"><div class="stack">' +
      '<div class="row wrap"><span class="tag ' + il.c + '">' + il.t + '</span><span class="muted small">Transferbudget ' + FM.fmtMoney(bud.transfer) + ' · Gehaltsspielraum ' + FM.fmtMoney(Math.max(0, room)) + '</span></div>' +
      (p.club ? '<div class="field"><label>Ablöse (€) – Forderung ca. ' + FM.fmtMoney(ask) + '</label><input class="input" id="b-fee" type="number" step="50000" min="0" value="' + ask + '"></div>' : '') +
      '<div class="grid g2"><div class="field"><label>Jahresgehalt (€) – Forderung ca. ' + FM.fmtMoney(demand) + '</label><input class="input" id="b-wage" type="number" step="10000" min="0" value="' + demand + '"></div>' +
      '<div class="field"><label>Vertragslaufzeit</label><select class="input" id="b-years">' + [1, 2, 3, 4, 5].map(function (y) { return '<option value="' + y + '"' + (y === 3 ? ' selected' : '') + '>' + y + ' Jahr' + (y > 1 ? 'e' : '') + '</option>'; }).join('') + '</select></div></div>' +
      '<dl class="cost" id="b-cost"></dl><div id="b-msg"></div></div></div>' +
      '<div class="modal-f"><button class="btn" data-action="closeModal">Abbrechen</button><button class="btn primary" id="b-ok">' + (p.club ? 'Angebot senden' : 'Vertrag anbieten') + '</button></div>',
      { size: 'narrow', mount: function (m) {
        function cost() {
          var fee = p.club ? +m.querySelector('#b-fee').value || 0 : 0, wage = +m.querySelector('#b-wage').value || 0;
          var extra = p.club ? Math.round(fee * FM.AGENT_FEE) : Math.round(wage * FM.SIGNING_BONUS), total = fee + extra;
          m.querySelector('#b-cost').innerHTML =
            (p.club ? '<dt>Ablöse</dt><dd>' + FM.fmtMoney(fee) + '</dd><dt>Beraterhonorar 10 %</dt><dd>' + FM.fmtMoney(extra) + '</dd>' : '<dt>Handgeld (25 % Jahresgehalt)</dt><dd>' + FM.fmtMoney(extra) + '</dd>') +
            '<dt class="sum">Belastet Transferbudget</dt><dd class="sum ' + (total > bud.transfer ? 'bad' : '') + '">' + FM.fmtMoney(total) + '</dd>' +
            '<dt>Gehalt vom Spielraum</dt><dd class="' + (wage > room ? 'bad' : '') + '">' + FM.fmtMoney(wage) + ' / ' + FM.fmtMoney(Math.max(0, room)) + '</dd>';
        }
        m.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', cost); });
        cost();
        m.querySelector('#b-ok').addEventListener('click', function () {
          var fee = p.club ? +m.querySelector('#b-fee').value : 0;
          var r = FM.userBid(st, p, fee, +m.querySelector('#b-wage').value, +m.querySelector('#b-years').value);
          if (r.ok) { UI.closeModal(); UI.toast(r.msg, 'good'); FM.save(UI.slot || 1); UI.refresh(); return; }
          m.querySelector('#b-msg').innerHTML = '<div class="note warn">' + esc(r.msg) + '</div>';
          if (r.counter && m.querySelector('#b-fee')) m.querySelector('#b-fee').value = r.counter;
          if (r.wageCounter) m.querySelector('#b-wage').value = r.wageCounter;
          cost();
        });
      } });
  };

  /* ================= Taktik & Aufstellung ================= */
  function ensureLineup() {
    var st = FM.state, club = st.clubs[st.user.club];
    if (!club.lineup || !club.lineup.slots || club.lineup.slots.length !== 11) club.lineup = FM.autoLineup(st, club.id, club.formation);
    var ids = {};
    club.squad.forEach(function (id) { ids[id] = 1; });
    club.lineup.slots.forEach(function (s) { if (s.pid && !ids[s.pid]) s.pid = null; });
    club.lineup.bench = (club.lineup.bench || []).filter(function (id) { return ids[id]; });
    return club.lineup;
  }
  UI.ensureLineup = ensureLineup;

  UI.views.tactics = {
    title: 'Taktik & Aufstellung',
    render: function () {
      var st = FM.state, club = st.clubs[st.user.club];
      var lu = ensureLineup();
      var s = UI.vs('tactics', { sel: null });
      var formation = FM.FORMATIONS[lu.formation];
      var inXI = {}, onBench = {};
      lu.slots.forEach(function (x) { if (x.pid) inXI[x.pid] = 1; });
      lu.bench.forEach(function (x) { onBench[x] = 1; });
      var reserves = FM.clubPlayers(st, club.id).filter(function (p) { return !inXI[p.id] && !onBench[p.id]; }).sort(function (a, b) { return posOrder(a) - posOrder(b) || b.ovr - a.ovr; });
      var t = club.tactics || FM.defaultTactics();

      var slotsHtml = formation.map(function (f, i) {
        var sl = lu.slots[i], p = sl && sl.pid ? st.players[sl.pid] : null;
        var cls = 'slot', pen = p ? FM.positionPenalty(p, f[0]) : 0;
        if (s.sel === 's' + i) cls += ' sel';
        if (!p) cls += ' empty';
        else if (!FM.isAvailable(p, 'league') || pen >= 9) cls += ' bad';
        else if (pen >= 4 || p.fit < 75) cls += ' warn';
        var c1 = club.colors[0], ink = UI.ink(c1);
        return '<div class="' + cls + '" style="left:' + f[1] + '%;bottom:' + f[2] + '%" data-action="tacSel" data-k="s' + i + '">' +
          '<div class="shirt" style="background:' + (p ? c1 : '') + ';color:' + (p ? ink : '') + '">' + (p ? Math.round(FM.effectiveRating(p, f[0])) : '+') + '</div>' +
          '<div class="nm">' + (p ? esc(UI.shortName(p.name)) : 'frei') + '</div>' +
          (p ? '<div class="fit"><i style="width:' + Math.round(p.fit) + '%"></i></div>' : '') +
          '<div class="lbl">' + FM.POS_LABEL[f[0]] + '</div></div>';
      }).join('');

      var pitch = '<div class="pitch">' + pitchLines() + slotsHtml + '</div>';
      function prow(p, key, extra) {
        var sel = s.sel === key ? ' sel' : '';
        return '<div class="li click' + sel + '" data-action="tacSel" data-k="' + key + '">' + UI.posTag(p.pos[0]) +
          '<div class="grow"><div class="row" style="gap:6px"><span class="pname ellipsis">' + esc(p.name) + '</span>' + UI.status(p) + '</div><div class="muted tiny">' + p.pos.map(function (x) { return FM.POS_LABEL[x]; }).join(' · ') + ' · ' + p.age + ' J.</div></div>' +
          UI.fit(p.fit) + UI.pill(p.ovr) + (extra || '') + '</div>';
      }
      var bench = lu.bench.map(function (pid, i) { var p = st.players[pid]; return p ? prow(p, 'b' + i) : ''; }).join('');
      var res = reserves.map(function (p) { return prow(p, 'r' + p.id); }).join('');
      var strength = lineupStrength(lu);

      var html = '<div class="page-h"><div><h1>Taktik & Aufstellung</h1><div class="sub">Tippe einen Spieler an und dann einen zweiten, um sie zu tauschen.</div></div>' +
        '<div class="row wrap"><select class="input" id="formation" aria-label="Formation">' + FM.FORMATION_KEYS.map(function (k) { return '<option' + (k === lu.formation ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
        '<button class="btn" data-action="autoLineup">' + UI.icon('star') + ' Beste Elf</button></div></div>';
      html += '<div class="tactics-grid"><div class="stack">' + pitch +
        '<div class="card"><div class="card-b" style="padding-top:14px"><div class="grid g3" style="gap:8px">' +
        mini('Angriff', strength.att.toFixed(1)) + mini('Mittelfeld', strength.mid.toFixed(1)) + mini('Abwehr', strength.def.toFixed(1)) + '</div>' +
        '<p class="muted small" style="margin-top:8px">Werte inkl. Positionseignung, Form und Fitness. Gelb/rot markierte Spieler stehen nicht auf ihrer Stammposition, sind müde oder fehlen.</p></div></div></div>';
      html += '<div class="stack"><div class="card"><div class="card-h"><h3>Spielweise</h3></div><div class="card-b stack" style="gap:12px">' +
        tacRow('Mentalität', 'mentality', FM.MENTALITY.map(function (m) { return [m.id, m.label]; }), t.mentality) +
        tacRow('Pressing', 'pressing', FM.PRESSING.map(function (m) { return [m.id, m.label]; }), t.pressing) +
        tacRow('Tempo', 'tempo', FM.TEMPO.map(function (m) { return [m.id, m.label]; }), t.tempo) +
        '<p class="muted small">Offensiv erhöht die eigene Torgefahr, öffnet aber Räume. Hohes Pressing und schnelles Tempo kosten mehr Kraft.</p></div></div>';
      html += '<div class="card"><div class="card-h"><h3>Ersatzbank</h3><span class="muted small">' + lu.bench.length + ' / 9</span></div><div class="list pick-list">' + (bench || '<div class="empty">Keine Ersatzspieler.</div>') + '</div></div>';
      html += '<div class="card"><div class="card-h"><h3>Nicht im Kader</h3><span class="muted small">' + reserves.length + '</span></div><div class="list pick-list">' + (res || '<div class="empty">Alle Spieler sind nominiert.</div>') + '</div></div></div></div>';
      return html;
    },
    mount: function (el) {
      var sel = el.querySelector('#formation');
      if (sel) sel.addEventListener('change', function () { changeFormation(sel.value); });
    }
  };

  function tacRow(label, key, opts, cur) {
    return '<div><div class="small strong" style="margin-bottom:6px">' + label + '</div><div class="seg">' + opts.map(function (o) {
      return '<button data-action="setTactic" data-k="' + key + '" data-v="' + o[0] + '" class="' + (o[0] === cur ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div></div>';
  }

  function pitchLines() {
    return '<svg class="lines" viewBox="0 0 68 100" preserveAspectRatio="none" fill="none" stroke="var(--pitch-line)" stroke-width=".35">' +
      '<rect x="2" y="2" width="64" height="96"/><line x1="2" y1="50" x2="66" y2="50"/><circle cx="34" cy="50" r="8.5"/>' +
      '<rect x="15" y="2" width="38" height="15"/><rect x="25" y="2" width="18" height="5.5"/><rect x="15" y="83" width="38" height="15"/><rect x="25" y="92.5" width="18" height="5.5"/>' +
      '<path d="M27 17a8 8 0 0 0 14 0M27 83a8 8 0 0 1 14 0"/></svg>';
  }
  UI.pitchLines = pitchLines;

  function lineupStrength(lu) {
    var st = FM.state;
    var att = 0, mid = 0, def = 0, wa = 0, wm = 0, wd = 0;
    lu.slots.forEach(function (s) {
      var w = FM.ROLE_WEIGHTS[s.pos]; wa += w.att; wm += w.mid; wd += w.def;
      var p = s.pid && st.players[s.pid];
      if (!p || !FM.isAvailable(p, 'league')) return;
      var e = FM.effectiveRating(p, s.pos);
      att += w.att * e; mid += w.mid * e; def += w.def * e;
    });
    return { att: att / wa, mid: mid / wm, def: def / wd };
  }
  UI.lineupStrength = lineupStrength;

  function changeFormation(f) {
    var st = FM.state, club = st.clubs[st.user.club], lu = ensureLineup();
    var xi = lu.slots.map(function (s) { return s.pid && st.players[s.pid]; }).filter(Boolean);
    var a = FM.assignFormation(xi, f);
    var used = {};
    a.slots.forEach(function (s) { if (s.pid) used[s.pid] = 1; });
    var rest = FM.clubPlayers(st, club.id).filter(function (p) { return !used[p.id] && lu.bench.indexOf(p.id) < 0 && FM.isAvailable(p, 'league'); });
    a.slots.forEach(function (s) {
      if (s.pid) return;
      var best = null, bv = -99;
      rest.forEach(function (p) { if (used[p.id]) return; var v = FM.effectiveRating(p, s.pos); if (v > bv) { bv = v; best = p; } });
      if (best) { s.pid = best.id; used[best.id] = 1; }
    });
    // Spieler, die aus der Elf fallen, wandern auf die Bank (falls Platz)
    xi.forEach(function (p) { if (!used[p.id] && lu.bench.length < 9) lu.bench.push(p.id); });
    lu.bench = lu.bench.filter(function (id) { return !used[id]; });
    lu.formation = f;
    lu.slots = a.slots.map(function (s) { return { pos: s.pos, pid: s.pid }; });
    club.formation = f;
    UI.vs('tactics').sel = null;
    UI.refresh();
  }

  UI.actions.autoLineup = function () {
    var st = FM.state, club = st.clubs[st.user.club];
    FM.matchComp = 'league';
    club.lineup = FM.autoLineup(st, club.id, club.lineup ? club.lineup.formation : null);
    FM.matchComp = null;
    UI.vs('tactics').sel = null;
    UI.toast('Beste verfügbare Elf aufgestellt.');
    UI.refresh();
  };

  UI.actions.setTactic = function (el) {
    var club = FM.state.clubs[FM.state.user.club];
    club.tactics = club.tactics || FM.defaultTactics();
    club.tactics[el.getAttribute('data-k')] = +el.getAttribute('data-v');
    UI.refresh();
  };

  /* Auswahl & Tausch: s<i> = Slot, b<i> = Bank, r<pid> = Reserve */
  UI.actions.tacSel = function (el) {
    var s = UI.vs('tactics');
    var k = el.getAttribute('data-k');
    if (!s.sel) { s.sel = k; UI.refresh(); return; }
    if (s.sel === k) { s.sel = null; UI.refresh(); return; }
    var a = s.sel, b = k;
    s.sel = null;
    if (a.charAt(0) === 'r' && b.charAt(0) === 'r') { s.sel = b; UI.refresh(); return; }
    swap(a, b);
    UI.refresh();
  };

  function getRef(lu, k) {
    var t = k.charAt(0), v = k.slice(1);
    if (t === 's') return { get: function () { return lu.slots[+v].pid; }, set: function (pid) { lu.slots[+v].pid = pid; } };
    if (t === 'b') return { get: function () { return lu.bench[+v]; }, set: function (pid) { if (pid) lu.bench[+v] = pid; else lu.bench.splice(+v, 1); } };
    return { get: function () { return v; }, set: function () { /* Reserve: nichts zu speichern */ } };
  }
  function swap(a, b) {
    var lu = ensureLineup();
    var ra = getRef(lu, a), rb = getRef(lu, b);
    var pa = ra.get(), pb = rb.get();
    if (a.charAt(0) === 'r') { rb.set(pa); return; }
    if (b.charAt(0) === 'r') { ra.set(pb); return; }
    ra.set(pb); rb.set(pa);
  }

  /* ================= Training ================= */
  var FOCUS_TEXT = {
    balanced: 'Solide Mischung aus allem – keine Schwächen, keine besonderen Stärken.',
    fitness: 'Mehr Ausdauer: Spieler erholen sich schneller zwischen den Spielen.',
    tactics: 'Abläufe einschleifen: stabilisiert die Form der Mannschaft.',
    technique: 'Individuelle Förderung: junge Spieler entwickeln sich schneller.',
    recovery: 'Belastung runter: maximale Erholung, weniger Verletzungen – aber kaum Entwicklung.'
  };
  UI.views.training = {
    title: 'Training',
    render: function () {
      var st = FM.state, tr = st.training;
      var cards = Object.keys(FM.TRAINING).map(function (k) {
        var t = FM.TRAINING[k];
        return '<button class="club-card ' + (tr.focus === k ? 'sel' : '') + '" data-action="setTraining" data-k="focus" data-v="' + k + '" style="align-items:flex-start"><div class="news-ico ' + (tr.focus === k ? 'match' : '') + '">' + UI.icon(k === 'recovery' ? 'medic' : k === 'tactics' ? 'tactics' : k === 'technique' ? 'star' : 'training') + '</div>' +
          '<div><div class="n">' + t.label + '</div><div class="s" style="line-height:1.45">' + FOCUS_TEXT[k] + '</div></div></button>';
      }).join('');
      var players = FM.clubPlayers(st, st.user.club);
      var dev = players.filter(function (p) { return p.ovr0 != null && p.ovr !== p.ovr0; }).sort(function (a, b) { return (b.ovr - b.ovr0) - (a.ovr - a.ovr0); });
      var talents = players.filter(function (p) { return p.age <= 21; }).sort(function (a, b) { return b.pot - a.pot; });
      var html = '<div class="page-h"><div><h1>Training</h1><div class="sub">Trainingsschwerpunkt und -intensität gelten für die ganze Mannschaft.</div></div></div>';
      html += '<div class="card"><div class="card-h"><h3>Schwerpunkt</h3></div><div class="card-b"><div class="club-grid">' + cards + '</div></div></div>';
      html += '<div class="card"><div class="card-h"><h3>Intensität</h3></div><div class="card-b"><div class="seg">' + FM.INTENSITY.map(function (it, i) {
        return '<button data-action="setTraining" data-k="intensity" data-v="' + i + '" class="' + (tr.intensity === i ? 'on' : '') + '">' + it.label + '</button>';
      }).join('') + '</div><p class="muted small" style="margin-top:10px">Hart: schnellere Entwicklung, aber langsamere Erholung und höheres Verletzungsrisiko. Leicht: das Gegenteil.</p></div></div>';
      html += '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="card-h"><h3>Entwicklung seit Saisonstart</h3></div><div class="card-b flush">' +
        (dev.length ? '<table class="tbl compact"><tbody>' + dev.slice(0, 12).map(function (p) {
          var d = p.ovr - p.ovr0;
          return '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td class="pname">' + esc(p.name) + '</td><td class="num muted">' + p.age + ' J.</td><td class="num">' + p.ovr0 + ' → ' + UI.pill(p.ovr) + '</td><td class="num strong ' + (d > 0 ? 'good' : 'bad') + '">' + (d > 0 ? '+' : '') + d + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Noch keine Veränderungen in dieser Saison.</div>') + '</div></div>';
      html += '<div class="card"><div class="card-h"><h3>Talente (≤ 21 Jahre)</h3></div><div class="card-b flush">' +
        (talents.length ? '<table class="tbl compact"><thead><tr><th></th><th>Name</th><th class="num">Alter</th><th class="num">Stärke</th><th class="num">Potenzial</th></tr></thead><tbody>' + talents.slice(0, 12).map(function (p) {
          return '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td class="pname">' + esc(p.name) + UI.srcMark(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="num strong">' + p.pot + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Keine jungen Spieler im Kader.</div>') + '</div></div></div>';
      return html;
    }
  };
  UI.actions.setTraining = function (el) {
    var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
    FM.state.training[k] = k === 'intensity' ? +v : v;
    UI.refresh();
  };
})();
