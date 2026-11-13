/* Ansicht: Europapokal – Tabelle der Ligaphase, Spieltage, K.-o.-Runden, deutsche Teilnehmer. */
(function () {
  'use strict';
  var FM = window.FM, UI = FM.ui, esc = FM.esc, D = FM.date;

  var COMP_TABS = [['cl', 'Champions League'], ['el', 'Europa League'], ['ecl', 'Conference League']];
  var REACH = { league: 'Ligaphase', po: 'Play-offs', r16: 'Achtelfinale', qf: 'Viertelfinale', sf: 'Halbfinale', f: 'Finale', w: 'Sieger' };
  UI.EU_REACH = REACH;

  function natOf(c) { return c.eu ? c.nat : 'GER'; }
  function season(st) { return st.eu.year + '/' + String(st.eu.year + 1).slice(2); }

  function phaseText(st, k) {
    var c = st.eu.comps[k], E = FM.EU[k];
    if (c.phase === 'done') return 'Sieger: ' + st.clubs[c.winner].name;
    if (c.phase === 'league') return c.md ? c.md + '. von ' + E.md + ' Spieltagen der Ligaphase gespielt' : 'Ligaphase ab ' + D.fmt(c.dates.lg[0]);
    return FM.EU_ROUNDS[c.phase];
  }

  /* Eine Partie als Zeile; bei Rueckspielen mit Hinspielergebnis und Sieger */
  function gameLine(st, g, uc) {
    var fx = g.fid ? st.fixtures[g.fid] : null;
    var click = fx && fx.res && fx.res.pl;
    var mine = g.h === uc || g.a === uc;
    var score = g.r ? g.r[0] + ' : ' + g.r[1] : '– : –';
    var note = g.first ? '<span class="muted tiny nowrap">Hin ' + g.first[0] + ':' + g.first[1] + '</span>' : '';
    return '<div class="li' + (click ? ' click" data-action="matchReport" data-id="' + fx.id : '') + '"' + (mine ? ' style="background:var(--accent-soft)"' : '') + '>' +
      '<div class="grow row" style="justify-content:flex-end;text-align:right">' + UI.clubMini(g.h, false, g.w && g.w !== g.h) + '</div>' +
      '<div style="min-width:74px;text-align:center" class="strong tnum">' + score + (g.pen ? '<div class="muted tiny">i. E.</div>' : '') + '</div>' +
      '<div class="grow row">' + UI.clubMini(g.a, true, g.w && g.w !== g.a) + '</div>' + note + '</div>';
  }

  /* Ergebnisse des Europapokalabends (fuer den Nachbericht) */
  UI.euroDayHtml = function (fx) {
    var st = FM.state, c = st.eu && st.eu.comps[fx.comp], uc = st.user.club;
    if (!c) return '<div class="empty">Keine weiteren Spiele.</div>';
    var rounds = FM.euroRounds(st, fx.comp);
    var key = fx.euKo ? (fx.euKo === 'f' ? 'f' : fx.euKo + (fx.leg || 1)) : 'md' + fx.round;
    var rd = rounds.filter(function (r) { return r.key === key; })[0];
    var games = rd ? rd.games.filter(function (g) { return g.fid !== fx.id && g.r; }) : [];
    if (!games.length) return '<div class="empty">Keine weiteren Spiele.</div>';
    var w = function (g) { return (st.clubs[g.h].eu && st.clubs[g.a].eu ? 0 : 100) + FM.euStr(st, g.h) + FM.euStr(st, g.a); };
    return games.sort(function (a, b) { return w(b) - w(a); }).map(function (g) {
      return '<div class="li"><div class="grow row" style="justify-content:flex-end;text-align:right">' + UI.clubMini(g.h) + '</div><span class="sc">' + g.r[0] + ':' + g.r[1] + '</span><div class="grow row">' + UI.clubMini(g.a, true) + '</div></div>';
    }).join('');
  };

  /* Kurzstatus eines Vereins in seinem Wettbewerb */
  UI.euroStatus = function (st, k, cid) {
    var c = st.eu.comps[k], reach = FM.euroReached(st, k, cid);
    if (reach === 'w') return FM.EU[k].name + '-Sieger';
    if (c.phase === 'league') {
      var t = FM.euroTable(st, k), i = t.findIndex(function (r) { return r.club === cid; });
      return c.md ? 'Platz ' + (i + 1) + ' · ' + t[i].pts + ' Punkte' : 'Ligaphase';
    }
    var last = c.ko[c.ko.length - 1];
    var alive = last && last.ties.some(function (t) { return (t.a === cid || t.b === cid) && (!t.w || t.w === cid); });
    if (reach === 'league') return 'Ligaphase · Platz ' + (c.final.indexOf(cid) + 1) + ' (ausgeschieden)';
    return REACH[reach] + (alive || c.phase === 'done' && c.winner === cid ? '' : ' (ausgeschieden)');
  };

  function tableHtml(st, k) {
    var t = FM.euroTable(st, k), uc = st.user.club;
    var rows = t.map(function (r, i) {
      var c = st.clubs[r.club], ger = !c.eu;
      return '<tr class="' + (r.club === uc ? 'me' : '') + '"><td class="zone ' + (i < 8 ? 'cl' : i < 24 ? 'po' : '') + '"></td><td class="num">' + (i + 1) + '</td>' +
        '<td>' + UI.clubLink(r.club, { full: true }) + ' <span class="' + (ger ? 'tag info' : 'muted tiny') + '">' + esc(natOf(c)) + '</span></td>' +
        '<td class="num">' + r.p + '</td><td class="num hide-xs">' + r.w + '</td><td class="num hide-xs">' + r.d + '</td><td class="num hide-xs">' + r.l + '</td>' +
        '<td class="num hide-sm">' + r.gf + ':' + r.ga + '</td><td class="num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="num strong">' + r.pts + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="zone"></th><th class="num">#</th><th>Verein</th><th class="num">Sp</th><th class="num hide-xs">S</th><th class="num hide-xs">U</th><th class="num hide-xs">N</th><th class="num hide-sm">Tore</th><th class="num">Diff</th><th class="num">Pkt</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="legend"><span><i style="background:#1d5bb8"></i>Platz 1–8: direkt im Achtelfinale</span><span><i style="background:#e69a3f"></i>Platz 9–24: Play-offs</span><span class="muted">ab Platz 25 ausgeschieden</span></div></div>';
  }

  function gamesHtml(st, k, s) {
    var rounds = FM.euroRounds(st, k), uc = st.user.club;
    var idx = -1;
    rounds.forEach(function (r, i) { if (r.key === s.rd) idx = i; });
    if (idx < 0) {
      // aktuelle Runde: die erste mit offenen Partien, sonst die letzte
      idx = rounds.length - 1;
      for (var i = 0; i < rounds.length; i++) if (rounds[i].games.some(function (g) { return !g.r; })) { idx = i; break; }
    }
    var rd = rounds[idx];
    var firstLeg = rd.key.slice(-1) === '2' && idx > 0 ? rounds[idx - 1] : null;
    var games = rd.games.map(function (g, gi) {
      var x = Object.assign({}, g);
      if (firstLeg && firstLeg.games[gi] && firstLeg.games[gi].r) x.first = [firstLeg.games[gi].r[1], firstLeg.games[gi].r[0]];
      return x;
    });
    var nav = '<div class="filters"><div class="row"><button class="btn sm icon" data-action="setUi" data-k="rd" data-v="' + rounds[Math.max(0, idx - 1)].key + '" aria-label="Vorherige Runde">' + UI.icon('back') + '</button>' +
      '<span class="strong" style="min-width:230px;text-align:center">' + esc(rd.label) + '</span>' +
      '<button class="btn sm icon" data-action="setUi" data-k="rd" data-v="' + rounds[Math.min(rounds.length - 1, idx + 1)].key + '" aria-label="Nächste Runde">' + UI.icon('next') + '</button></div>' +
      '<span class="muted small">' + D.fmtLong(rd.date) + '</span></div>';
    var w = function (g) { return (g.h === uc || g.a === uc ? 1000 : 0) + (st.clubs[g.h].eu && st.clubs[g.a].eu ? 0 : 100) + FM.euStr(st, g.h) + FM.euStr(st, g.a); };
    return nav + '<div class="card"><div class="list">' + games.sort(function (a, b) { return w(b) - w(a); }).map(function (g) { return gameLine(st, g, uc); }).join('') + '</div></div>';
  }

  function koHtml(st, k) {
    var c = st.eu.comps[k], uc = st.user.club, E = FM.EU[k];
    if (!c.ko.length) {
      return '<div class="card"><div class="card-h"><h3>So geht es weiter</h3></div><div class="card-b"><p class="dim" style="margin:0 0 10px">Nach dem ' + E.md + '. Spieltag stehen die ersten acht der Tabelle direkt im Achtelfinale. Die Plätze 9 bis 24 spielen in Hin- und Rückspiel die übrigen acht Plätze aus, wobei die besser Platzierten im Rückspiel Heimrecht haben. Ab Platz 25 ist Schluss.</p>' +
        '<p class="dim" style="margin:0">Achtel-, Viertel- und Halbfinale werden mit Hin- und Rückspiel ausgetragen, das Finale steigt am ' + D.fmt(c.dates.fin) + ' – ' + esc(c.venue) + '.</p></div></div>';
    }
    return c.ko.slice().reverse().map(function (rd) {
      var head = '<div class="card-h"><h3>' + FM.EU_ROUNDS[rd.r] + '</h3><span class="muted small">' + (rd.r === 'f' ? D.fmtLong(rd.date) + ' · ' + esc(c.venue) : D.fmt(rd.dates[0]) + ' und ' + D.fmt(rd.dates[1])) + '</span></div>';
      var body = rd.ties.map(function (t) {
        var mine = t.a === uc || t.b === uc;
        var res = rd.r === 'f' ? (t.r1 ? t.r1[0] + ' : ' + t.r1[1] : '– : –') :
          (t.r1 ? t.r1[0] + ':' + t.r1[1] : '–:–') + ' <span class="muted">|</span> ' + (t.r2 ? t.r2[1] + ':' + t.r2[0] : '–:–');
        return '<div class="li"' + (mine ? ' style="background:var(--accent-soft)"' : '') + '><div class="grow row" style="justify-content:flex-end;text-align:right">' + UI.clubMini(t.a, false, t.w && t.w !== t.a) + '</div>' +
          '<div style="min-width:112px;text-align:center" class="strong tnum">' + res + (t.pen ? '<div class="muted tiny">i. E.</div>' : '') + '</div><div class="grow row">' + UI.clubMini(t.b, true, t.w && t.w !== t.b) + '</div></div>';
      }).join('');
      return '<div class="card">' + head + '<div class="list">' + body + '</div></div>';
    }).join('');
  }

  /* Alle deutschen Teilnehmer auf einen Blick */
  function germansCard(st) {
    var uc = st.user.club, rows = [];
    FM.EU_COMPS.forEach(function (k) {
      st.eu.comps[k].teams.forEach(function (id) {
        if (st.clubs[id].eu) return;
        rows.push('<div class="li click" data-action="setUi" data-k="k" data-v="' + k + '">' + UI.badge(st.clubs[id], 26) + '<div class="grow" style="min-width:0"><div class="' + (id === uc ? 'strong ' : '') + 'ellipsis">' + esc(st.clubs[id].name) + '</div>' +
          '<div class="muted small">' + FM.EU[k].short + ' · ' + esc(UI.euroStatus(st, k, id)) + '</div></div>' +
          '<div class="num small tnum nowrap">' + FM.fmtMoneyShort((st.eu.money || {})[id] || 0) + ' €</div></div>');
      });
    });
    return '<div class="card"><div class="card-h"><h3>Deutsche Teilnehmer</h3><span class="muted small">UEFA-Prämien bisher</span></div><div class="list">' + rows.join('') + '</div></div>';
  }

  function moneyCard(k) {
    var E = FM.EU[k], m = FM.fmtMoney;
    return '<div class="card"><div class="card-h"><h3>Prämien der UEFA</h3></div><div class="card-b"><dl class="kv">' +
      '<dt>Startgeld</dt><dd>' + m(E.start) + '</dd>' +
      '<dt>Marktwertanteil</dt><dd>' + m(E.value) + ' bis ' + m(E.value * 36) + '</dd>' +
      '<dt>Sieg / Remis (Ligaphase)</dt><dd>' + m(E.win) + ' / ' + m(E.draw) + '</dd>' +
      '<dt>Platzierung</dt><dd>' + m(E.share) + ' je Rang, Top 8 +' + m(E.top8) + '</dd>' +
      '<dt>Achtelfinale</dt><dd>' + m(E.ko.r16) + '</dd><dt>Viertelfinale</dt><dd>' + m(E.ko.qf) + '</dd>' +
      '<dt>Halbfinale</dt><dd>' + m(E.ko.sf) + '</dd><dt>Finale / Titel</dt><dd>' + m(E.ko.f) + ' / +' + m(E.ko.w) + '</dd></dl></div></div>';
  }

  UI.views.europe = {
    title: 'Europapokal',
    render: function () {
      var st = FM.state, uc = st.user.club, eu = st.eu;
      if (!eu) {
        return '<div class="page-h"><div><h1>Europapokal</h1><div class="sub">Champions League, Europa League und Conference League</div></div></div>' +
          '<div class="note">Die europäischen Wettbewerbe starten mit der nächsten Saison. Qualifiziert sind die ersten vier der Bundesliga (Champions League), Platz 5 und der DFB-Pokalsieger (Europa League) sowie der nächste Tabellenplatz (Conference League).</div>';
      }
      var mine = FM.euroCompOf(st, uc);
      var s = UI.vs('europe', { k: mine || 'cl', tab: 'table', rd: null });
      var k = s.k, c = eu.comps[k], E = FM.EU[k];
      var html = '<div class="page-h"><div><h1>' + E.name + '</h1><div class="sub">Saison ' + season(st) + ' · ' + esc(phaseText(st, k)) + '</div></div>' +
        '<div class="row wrap">' + UI.seg('k', COMP_TABS, k) + UI.seg('tab', [['table', 'Tabelle'], ['games', 'Spiele'], ['ko', 'K.-o.-Runde']], s.tab) + '</div></div>';
      if (c.winner) html += '<div class="note good" style="margin-bottom:16px"><b>' + esc(st.clubs[c.winner].name) + '</b> gewinnt die ' + E.name + ' ' + season(st) + '.</div>';
      if (mine === k) {
        var t = FM.euroTable(st, k), i = t.findIndex(function (r) { return r.club === uc; }), r = t[i];
        var next = FM.userFixtures(st).filter(function (f) { return f.comp === k && !f.res; })[0];
        var tile = function (label, value, meta) { return '<div class="card stat"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="meta">' + meta + '</div></div>'; };
        html += '<div class="grid g4" style="margin-bottom:16px">' +
          tile('Dein Stand', esc(c.phase === 'league' ? (c.md ? (i + 1) + '.' : '–') : REACH[FM.euroReached(st, k, uc)]), esc(UI.euroStatus(st, k, uc))) +
          tile('Bilanz Ligaphase', r.w + ' – ' + r.d + ' – ' + r.l, r.gf + ':' + r.ga + ' Tore · ' + r.pts + ' Punkte') +
          tile('UEFA-Prämien', FM.fmtMoneyShort((eu.money || {})[uc] || 0) + ' €', 'in dieser Saison') +
          tile('Nächstes Spiel', next ? '<span style="font-size:21px;overflow-wrap:anywhere">' + esc(st.clubs[next.home === uc ? next.away : next.home].short) + '</span>' : '–', next ? D.fmt(next.date) + ' · ' + (next.neutral ? 'Finale' : next.home === uc ? 'Heim' : 'Auswärts') : 'kein Spiel angesetzt') +
          '</div>';
      } else if (!mine && k === s.k) {
        html += '<div class="note" style="margin-bottom:16px">Dein Verein spielt in dieser Saison nicht europäisch. Über die Bundesliga (Platz 1–4 Champions League, 5 Europa League, 6 Conference League) oder den DFB-Pokal führt der Weg nach Europa.</div>';
      }
      html += '<div class="grid dash"><div class="stack">' + (s.tab === 'table' ? tableHtml(st, k) : s.tab === 'games' ? gamesHtml(st, k, s) : koHtml(st, k)) + '</div>' +
        '<div class="stack">' + germansCard(st) + moneyCard(k) + '</div></div>';
      return html;
    }
  };
})();
