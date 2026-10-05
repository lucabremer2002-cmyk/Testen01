/* Ansichten: Tabellen, Spielplan, Statistiken, Vereinsprofil, Spielbericht. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var ALL_TABS = [['bl', 'Bundesliga'], ['bl2', '2. Bundesliga'], ['l3', '3. Liga'], ['rlw', 'RL West']];
  var LEAGUE_TABS = ALL_TABS;
  function tabs() { LEAGUE_TABS = ALL_TABS.filter(function (t) { return FM.state.leagues[t[0]]; }); return LEAGUE_TABS; }
  function ownLeague(st) { var l = st.clubs[st.user.club].league; return FM.isSimLeague(l) ? l : 'l3'; }

  /* ================= Tabellen ================= */
  UI.views.table = {
    title: 'Tabellen',
    render: function () {
      var st = FM.state;
      tabs();
      var s = UI.vs('table', { lid: ownLeague(st), mode: 'all' });
      var t = FM.table(st, s.lid, { mode: s.mode === 'all' ? '' : s.mode });
      var zones = FM.ZONES[s.lid];
      var rows = t.map(function (r, i) {
        var pos = i + 1;
        return '<tr class="' + (r.club === st.user.club ? 'me' : '') + '"><td class="zone ' + (s.mode === 'all' ? zones(pos) : '') + '"></td><td class="num">' + pos + '</td><td>' + UI.clubLink(r.club, { full: true }) + '</td>' +
          '<td class="num">' + r.p + '</td><td class="num hide-xs">' + r.w + '</td><td class="num hide-xs">' + r.d + '</td><td class="num hide-xs">' + r.l + '</td>' +
          '<td class="num hide-sm">' + r.gf + ':' + r.ga + '</td><td class="num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="num strong">' + r.pts + '</td><td class="hide-sm">' + UI.formDots(r.form) + '</td></tr>';
      }).join('');
      var legendKeys = s.lid === 'bl' ? ['cl', 'el', 'ecl', 'po', 'down'] : ['up', 'poUp', 'po', 'down'];
      if (s.lid === 'l3') legendKeys = ['up', 'poUp', 'down'];
      if (s.lid === 'rlw') legendKeys = ['up', 'down'];
      var colors = { cl: '#2b67c9', el: '#e08a00', ecl: '#18a39a', up: 'var(--good)', poUp: '#7cc79c', po: '#f0a24a', down: 'var(--bad)' };
      var legend = '<div class="legend">' + legendKeys.map(function (k) { return '<span><i style="background:' + colors[k] + '"></i>' + (s.lid === 'rlw' && k === 'up' ? 'Aufstieg in die 3. Liga' : s.lid === 'rlw' && k === 'down' ? 'Abstieg in die Oberliga' : FM.ZONE_LABEL[k]) + '</span>'; }).join('') +
        (s.lid === 'l3' ? '<span class="muted">Reserveteams dürfen nicht aufsteigen</span>' : '') +
        (s.lid === 'rlw' ? '<span class="muted">Die Zahl der Absteiger hängt davon ab, wie viele Westvereine aus der 3. Liga absteigen (meist zwei bis vier). Reserveteams steigen nur auf, wenn die Profis höher als in der 3. Liga spielen.</span>' : '') + '</div>';
      var round = FM.playedRounds(st, s.lid);
      return '<div class="page-h"><div><h1>' + esc(st.leagues[s.lid].name) + '</h1><div class="sub">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + ' · ' + round + '. Spieltag gespielt</div></div>' +
        '<div class="row wrap">' + UI.seg('lid', LEAGUE_TABS, s.lid) + UI.seg('mode', [['all', 'Gesamt'], ['home', 'Heim'], ['away', 'Auswärts']], s.mode) + '</div></div>' +
        '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="zone"></th><th class="num">#</th><th>Verein</th><th class="num">Sp</th><th class="num hide-xs">S</th><th class="num hide-xs">U</th><th class="num hide-xs">N</th><th class="num hide-sm">Tore</th><th class="num">Diff</th><th class="num">Pkt</th><th class="hide-sm">Form</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + legend + '</div>';
    }
  };

  /* ================= Spielplan ================= */
  function resultTag(fx, cid) {
    if (!fx.res) return '<span class="muted tnum">–:–</span>';
    var w = FM.fixtureWinner(fx), gf = fx.home === cid ? fx.res.hg : fx.res.ag, ga = fx.home === cid ? fx.res.ag : fx.res.hg;
    var k = w ? (w === cid ? 'good' : 'bad') : (gf > ga ? 'good' : gf < ga ? 'bad' : '');
    if (!w && fx.comp !== 'cup' && !fx.leg) k = gf > ga ? 'good' : gf < ga ? 'bad' : '';
    return '<span class="tag ' + k + ' tnum">' + esc(FM.scoreText(fx)) + '</span>';
  }

  UI.views.fixtures = {
    title: 'Spielplan',
    render: function () {
      var st = FM.state, uc = st.user.club;
      tabs();
      var s = UI.vs('fixtures', { tab: 'mine', lid: ownLeague(st), round: null });
      var html = '<div class="page-h"><div><h1>Spielplan</h1><div class="sub">Saison ' + st.season.year + '/' + String(st.season.year + 1).slice(2) + '</div></div>' +
        UI.seg('tab', [['mine', 'Meine Spiele'], ['rounds', 'Spieltage'], ['cup', 'DFB-Pokal']], s.tab) + '</div>';
      if (s.tab === 'mine') {
        var list = FM.userFixtures(st);
        html += '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Wettbewerb</th><th></th><th>Gegner</th><th class="num">Ergebnis</th></tr></thead><tbody>' +
          list.map(function (f) {
            var home = f.home === uc, opp = home ? f.away : f.home;
            var clickable = f.res && f.res.pl;
            return '<tr class="' + (clickable ? 'click' : '') + (f.date === st.date && !f.res ? ' me' : '') + '"' + (clickable ? ' data-action="matchReport" data-id="' + f.id + '"' : '') + '><td class="nowrap">' + D.fmtLong(f.date) + '</td><td class="small dim">' + esc(UI.compLabel(f)) + '</td>' +
              '<td><span class="tag">' + (f.neutral ? 'N' : home ? 'H' : 'A') + '</span></td><td>' + UI.clubLink(opp, { full: true }) + '</td><td class="num">' + resultTag(f, uc) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
        return html;
      }
      if (s.tab === 'rounds') {
        var maxR = st.leagues[s.lid].rounds || 34;
        var played = FM.playedRounds(st, s.lid);
        var round = s.round || Math.max(1, Math.min(maxR, played || 1));
        if (round > maxR) round = maxR;
        var fx = Object.keys(st.fixtures).map(function (k) { return st.fixtures[k]; }).filter(function (f) { return f.comp === s.lid && f.round === round; });
        html += '<div class="filters">' + UI.seg('lid', LEAGUE_TABS, s.lid) +
          '<div class="row"><button class="btn sm icon" data-action="setUi" data-k="round" data-v="' + Math.max(1, round - 1) + '" aria-label="Vorheriger Spieltag">' + UI.icon('back') + '</button>' +
          '<span class="strong" style="min-width:110px;text-align:center">' + round + '. Spieltag</span>' +
          '<button class="btn sm icon" data-action="setUi" data-k="round" data-v="' + Math.min(maxR, round + 1) + '" aria-label="Nächster Spieltag">' + UI.icon('next') + '</button></div></div>';
        html += '<div class="card"><div class="list">' + fx.map(function (f) {
          return '<div class="li' + (f.res && f.res.pl ? ' click" data-action="matchReport" data-id="' + f.id : '') + '"><span class="muted small nowrap hide-xs" style="width:84px">' + D.fmtShort(f.date) + ' ' + D.weekdayName(f.date).slice(0, 2) + '</span>' +
            '<div class="grow row" style="justify-content:flex-end;text-align:right">' + clubMini(f.home) + '</div>' +
            '<div style="min-width:64px;text-align:center" class="strong tnum">' + (f.res ? f.res.hg + ' : ' + f.res.ag : '– : –') + '</div>' +
            '<div class="grow row">' + clubMini(f.away, true) + '</div></div>';
        }).join('') + '</div></div>';
        return html;
      }
      // Pokal
      var cup = st.cup;
      if (!cup) return html + '<div class="empty">Kein Pokalwettbewerb.</div>';
      html += cup.rounds.slice().reverse().map(function (r, idx) {
        var ri = cup.rounds.length - idx;
        return '<div class="card"><div class="card-h"><h3>' + FM.CUP_ROUNDS[ri - 1] + '</h3><span class="muted small">' + D.fmtLong(r.date) + '</span></div><div class="list">' +
          r.fx.map(function (fid) {
            var f = st.fixtures[fid], w = FM.fixtureWinner(f);
            return '<div class="li' + (f.home === uc || f.away === uc ? '" style="background:var(--accent-soft)' : '') + '"><div class="grow row" style="justify-content:flex-end;text-align:right">' + clubMini(f.home, false, w && w !== f.home) + '</div>' +
              '<div style="min-width:110px;text-align:center" class="strong tnum">' + (f.res ? esc(FM.scoreText(f)) : '– : –') + '</div><div class="grow row">' + clubMini(f.away, true, w && w !== f.away) + '</div></div>';
          }).join('') + (r.byes && r.byes.length ? '<div class="li muted small">Freilos: ' + r.byes.map(function (c) { return esc(st.clubs[c].short); }).join(', ') + '</div>' : '') + '</div></div>';
      }).join('');
      if (cup.winner) html = html.replace('<div class="card">', '<div class="note good" style="margin-bottom:16px"><b>Pokalsieger:</b> ' + esc(st.clubs[cup.winner].name) + '</div><div class="card">');
      return html;
    }
  };

  function clubMini(cid, left, out) {
    var c = FM.state.clubs[cid];
    var name = '<span class="ellipsis' + (cid === FM.state.user.club ? ' strong' : '') + '" style="' + (out ? 'opacity:.5' : '') + '">' + esc(c.short) + '</span>';
    return '<span class="club-cell" data-action="club" data-id="' + cid + '" style="cursor:pointer;' + (left ? '' : 'flex-direction:row-reverse') + '">' + UI.badge(c, 22) + name + '</span>';
  }
  UI.clubMini = clubMini;

  /* ================= Statistiken ================= */
  UI.views.stats = {
    title: 'Statistiken',
    render: function () {
      var st = FM.state;
      tabs();
      var s = UI.vs('stats', { lid: ownLeague(st) });
      function board(kind, title, fmt) {
        var list = FM.leagueLeaders(st, s.lid, kind, 12);
        return '<div class="card"><div class="card-h"><h3>' + title + '</h3></div><div class="card-b flush">' + (list.length ? '<table class="tbl compact"><tbody>' + list.map(function (x, i) {
          var p = x.p;
          return '<tr class="click' + (p.club === st.user.club ? ' me' : '') + '" data-action="player" data-id="' + p.id + '"><td class="num muted" style="width:28px">' + (i + 1) + '</td><td><div class="pname">' + esc(p.name) + '</div><div class="muted tiny">' + esc(st.clubs[p.club].short) + ' · ' + FM.POS_LABEL[p.pos[0]] + '</div></td><td class="num muted small">' + p.st.apps + ' Sp.</td><td class="num strong">' + fmt(x, p) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Noch keine Daten.</div>') + '</div></div>';
      }
      return '<div class="page-h"><div><h1>Statistiken</h1><div class="sub">' + esc(st.leagues[s.lid].name) + ' · Liga-Statistiken der laufenden Saison</div></div>' + UI.seg('lid', LEAGUE_TABS, s.lid) + '</div>' +
        '<div class="grid g3">' +
        board('goals', 'Torjäger', function (x) { return x.v; }) +
        board('assists', 'Vorlagen', function (x) { return x.v; }) +
        board('points', 'Scorerpunkte', function (x, p) { return x.v + ' <span class="muted small">(' + p.st.goals + '/' + p.st.assists + ')</span>'; }) +
        board('grade', 'Beste Ø-Note', function (x) { return UI.grade(FM.round1(-x.v)); }) +
        board('cs', 'Weiße Westen', function (x) { return x.v; }) +
        board('cards', 'Karten', function (x, p) { return '<span class="card-y"></span> ' + p.st.yc + (p.st.rc ? ' <span class="card-r"></span> ' + p.st.rc : ''); }) +
        '</div>';
    }
  };

  /* ================= Vereinsprofil ================= */
  UI.actions.club = function (el) { UI.clubModal(el.getAttribute('data-id')); };
  UI.clubModal = function (cid) {
    var st = FM.state, c = st.clubs[cid];
    if (!c) return;
    var players = FM.clubPlayers(st, cid).sort(function (a, b) { return FM.posGroup(a.pos[0]) === FM.posGroup(b.pos[0]) ? b.ovr - a.ovr : ({ GK: 0, DEF: 1, MID: 2, ATT: 3 }[FM.posGroup(a.pos[0])] - { GK: 0, DEF: 1, MID: 2, ATT: 3 }[FM.posGroup(b.pos[0])]); });
    var pos = FM.clubPosition(st, cid);
    var recent = Object.keys(st.fixtures).map(function (k) { return st.fixtures[k]; }).filter(function (f) { return f.res && (f.home === cid || f.away === cid); }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
    var value = FM.sum(players, function (p) { return FM.marketValue(p); });
    var head = '<div class="modal-h">' + UI.badge(c, 44) + '<div class="grow"><h2>' + esc(c.name) + '</h2><div class="muted small">' + esc(st.leagues[c.league].name) + (pos ? ' · Platz ' + pos : '') + ' · ' + esc(c.stadium) + ' (' + FM.fmtInt(c.cap) + ')</div></div>' +
      '<button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
    var body = '<div class="grid g4" style="gap:8px;margin-bottom:14px">' +
      '<div class="stat"><div class="label">Kaderstärke</div><div class="value">' + FM.teamStrength(st, cid).toFixed(1) + '</div></div>' +
      '<div class="stat"><div class="label">Reputation</div><div class="value">' + c.rep + '</div></div>' +
      '<div class="stat"><div class="label">Marktwert</div><div class="value" style="font-size:18px">' + FM.fmtMoney(value) + '</div></div>' +
      '<div class="stat"><div class="label">Formation</div><div class="value" style="font-size:18px">' + esc(c.formation || '–') + '</div></div></div>';
    if (recent.length) body += '<div class="row wrap" style="margin-bottom:14px;gap:6px">' + recent.map(function (f) {
      var opp = f.home === cid ? f.away : f.home;
      return '<span class="tag" title="' + esc(UI.compLabel(f)) + '">' + (f.home === cid ? 'H' : 'A') + ' ' + esc(st.clubs[opp].short) + ' ' + resultTag(f, cid) + '</span>';
    }).join('') + '</div>';
    body += '<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Pos</th><th>Name</th><th class="num">Alter</th><th class="num">Stärke</th><th class="num hide-xs">Tore</th><th class="num hide-xs">Marktwert</th></tr></thead><tbody>' +
      players.map(function (p) {
        return '<tr class="click" data-action="player" data-id="' + p.id + '"><td>' + UI.posTag(p.pos[0]) + '</td><td><span class="pname">' + esc(p.name) + '</span>' + UI.srcMark(p) + ' ' + UI.status(p) + '</td><td class="num">' + p.age + '</td><td class="num">' + UI.pill(p.ovr) + '</td><td class="num hide-xs">' + p.st.goals + '</td><td class="num hide-xs">' + FM.fmtMoney(FM.marketValue(p)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    UI.modal(head + '<div class="modal-b">' + body + '</div>', { size: 'wide' });
  };

  /* ================= Spielbericht ================= */
  UI.actions.matchReport = function (el) { UI.matchReport(el.getAttribute('data-id')); };

  UI.eventText = function (e, P, clubs) {
    var p = e.p && P[e.p] ? P[e.p].name : '';
    var a = e.a && P[e.a] ? P[e.a].name : '';
    switch (e.t) {
      case 'goal':
        if (e.og) return '<b>Eigentor</b> von ' + esc(p) + ' – ' + e.score[0] + ':' + e.score[1];
        return '<b>Tor! ' + esc(p) + '</b> ' + (e.pen ? 'verwandelt den Elfmeter' : a ? '(Vorlage ' + esc(a) + ')' : '') + ' – ' + e.score[0] + ':' + e.score[1];
      case 'yc': return 'Gelbe Karte für ' + esc(p);
      case 'yc2': return 'Gelb-Rot für ' + esc(p) + ' – Platzverweis!';
      case 'rc': return '<b>Rote Karte</b> für ' + esc(p) + '!';
      case 'inj': return esc(p) + ' verletzt sich und muss behandelt werden.';
      case 'sub': return 'Wechsel: ' + esc(p) + ' kommt für ' + esc(e.out && P[e.out] ? P[e.out].name : '');
      case 'penMiss': return esc(p) + ' vergibt den Elfmeter' + (e.saved ? ' – pariert!' : '!');
      case 'pen': return 'Elfmeterschießen: ' + esc(p) + (e.ok ? ' trifft' : ' verschießt') + ' (' + e.score[0] + ':' + e.score[1] + ')';
      default: return '';
    }
  };

  UI.matchReport = function (fid) {
    var st = FM.state, f = st.fixtures[fid];
    if (!f || !f.res) return;
    var r = f.res, h = st.clubs[f.home], a = st.clubs[f.away];
    var head = '<div class="modal-h"><div class="grow"><h2>' + esc(h.short) + ' ' + esc(FM.scoreText(f)) + ' ' + esc(a.short) + '</h2><div class="muted small">' + esc(UI.compLabel(f)) + ' · ' + D.fmtLong(f.date) + (r.att ? ' · ' + FM.fmtInt(r.att) + ' Zuschauer' : '') + '</div></div>' +
      '<button class="btn ghost icon" data-action="closeModal" aria-label="Schließen">' + UI.icon('x') + '</button></div>';
    var KEEP = { goal: 1, yc: 1, yc2: 1, rc: 1, inj: 1, sub: 1, penMiss: 1, pen: 1 };
    var events = r.ev.filter(function (e) { return KEEP[e.t]; }).map(function (e) {
      return '<div class="tk ' + (e.t === 'goal' ? 'goal' : '') + '"><span class="min">' + e.m + '\'</span><span class="ic">' + UI.eventIcon(e) + '</span><span class="txt">' + UI.eventText(e, st.players) + ' <span class="muted small">· ' + esc(st.clubs[e.s === 0 ? f.home : f.away].short) + '</span></span></div>';
    }).join('');
    var body = '<div class="grid g2"><div class="card"><div class="card-h"><h3>Spielverlauf</h3></div><div class="ticker">' + (events || '<div class="empty">Keine besonderen Ereignisse.</div>') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>Statistik</h3></div>' + UI.statsBlock(r.stats) + '</div></div>';
    if (r.pl) {
      body += '<div class="grid g2" style="margin-top:16px">' + [0, 1].map(function (si) {
        var club = si === 0 ? h : a;
        var rows = Object.keys(r.pl).filter(function (pid) { return r.pl[pid].s === si && r.pl[pid].mi > 0; }).map(function (pid) { return { p: st.players[pid], r: r.pl[pid], pid: pid }; })
          .sort(function (x, y) { return (y.r.st - x.r.st) || (FM.POS_ORDER.indexOf(x.r.pos) - FM.POS_ORDER.indexOf(y.r.pos)); });
        return '<div class="card"><div class="card-h"><div class="row">' + UI.badge(club, 22) + '<h3>' + esc(club.short) + '</h3></div></div><div class="card-b flush"><table class="tbl compact"><tbody>' +
          rows.map(function (x) {
            var name = x.p ? x.p.name : '(ehemaliger Spieler)';
            return '<tr' + (x.p ? ' class="click" data-action="player" data-id="' + x.pid + '"' : '') + '><td>' + UI.posTag(x.r.pos) + '</td><td>' + esc(name) + (r.motm === x.pid ? ' <span class="tag accent" title="Spieler des Spiels">★</span>' : '') +
              (x.r.gl ? ' ' + UI.goalMark(x.r.gl) : '') + (x.r.yc ? ' <span class="card-y"></span>' : '') + (x.r.rc ? ' <span class="card-r"></span>' : '') + '</td><td class="num muted small">' + Math.min(x.r.mi, r.aet ? 120 : 90) + '\'</td><td class="num">' + UI.grade(x.r.g) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
      }).join('') + '</div>';
    }
    UI.modal(head + '<div class="modal-b">' + body + '</div>', { size: 'wide' });
  };

  UI.eventIcon = function (e) {
    if (e.t === 'goal') return UI.goalMark(1);
    if (e.t === 'yc') return '<span class="card-y" title="Gelb"></span>';
    if (e.t === 'yc2' || e.t === 'rc') return '<span class="card-r" title="Rot"></span>';
    if (e.t === 'inj') return '<span class="bad">' + UI.icon('medic').replace('<svg', '<svg width="16" height="16"') + '</span>';
    if (e.t === 'sub') return '<span class="dim">' + UI.icon('swap').replace('<svg', '<svg width="15" height="15"') + '</span>';
    if (e.t === 'penMiss' || (e.t === 'pen' && !e.ok)) return '<span class="bad">✕</span>';
    if (e.t === 'pen') return '<span class="good">●</span>';
    if (e.t === 'save' || e.t === 'miss') return '<span class="muted">○</span>';
    return '';
  };

  UI.statsBlock = function (s) {
    function row(label, h, a, fmt) {
      var tot = (h + a) || 1;
      return '<div class="statrow"><span class="v">' + (fmt ? fmt(h) : h) + '</span><div><div class="l">' + label + '</div><div class="duo"><i class="h" style="width:' + (h / tot * 100) + '%"></i><i class="a" style="width:' + (a / tot * 100) + '%"></i></div></div><span class="v r">' + (fmt ? fmt(a) : a) + '</span></div>';
    }
    return '<div style="padding-bottom:10px">' + row('Ballbesitz', s.poss[0], s.poss[1], function (v) { return v + ' %'; }) +
      row('Torschüsse', s.shots[0], s.shots[1]) + row('Aufs Tor', s.sot[0], s.sot[1]) +
      row('Expected Goals (xG)', s.xg[0], s.xg[1], function (v) { return FM.fmtDec(v); }) +
      row('Ecken', s.corners[0], s.corners[1]) + row('Fouls', s.fouls[0], s.fouls[1]) + row('Gelbe Karten', s.yc[0], s.yc[1]) + '</div>';
  };
})();
