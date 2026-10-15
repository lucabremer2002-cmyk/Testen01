/* Spielplan: Doppelrunden, Kalender, Pokal-Auslosung, Relegation. */
(function () {
  'use strict';
  var FM = window.FM;
  var D = FM.date;
  var R = FM.rng;

  FM.COMP_NAME = { bl: 'Bundesliga', bl2: '2. Bundesliga', l3: '3. Liga', cup: 'DFB-Pokal', po1: 'Relegation', po2: 'Relegation' };
  FM.CUP_ROUNDS = ['1. Runde', '2. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  /* DFB-Praemien 2025/26 (offizieller Verteilerschluessel): jeder Teilnehmer einer Runde erhaelt den
     Betrag dieser Runde; im Finale 4,32 Mio. fuer den Sieger und 2,88 Mio. fuer den Finalisten. */
  FM.CUP_PRIZE = [211886, 423772, 847544, 1695088, 3390175];
  FM.CUP_FINAL = { winner: 4320000, runnerUp: 2880000 };

  /* Kreismethode: Hin- und Rueckrunde, Heim/Auswaerts wechselnd */
  FM.roundRobin = function (teams) {
    var t = teams.slice();
    if (t.length % 2) t.push(null);
    var n = t.length, rounds = [];
    var fixed = t[0], rot = t.slice(1);
    for (var r = 0; r < n - 1; r++) {
      var arr = [fixed].concat(rot), games = [];
      for (var i = 0; i < n / 2; i++) {
        var a = arr[i], b = arr[n - 1 - i];
        if (a == null || b == null) continue;
        var home = (i === 0) ? (r % 2 === 0 ? a : b) : ((r + i) % 2 === 0 ? a : b);
        games.push([home, home === a ? b : a]);
      }
      rounds.push(games);
      rot.unshift(rot.pop());
    }
    var second = rounds.map(function (g) { return g.map(function (x) { return [x[1], x[0]]; }); });
    return rounds.concat(second);
  };

  function firstWeekdayOnOrAfter(iso, wd) {
    var d = iso;
    while (D.weekday(d) !== wd) d = D.add(d, 1);
    return d;
  }

  /* Rahmenterminkalender nach dem Muster der Saison 2026/27 (DFB/DFL, veroeffentlicht Nov. 2025):
     2. und 3. Liga starten am ersten Augustwochenende (2026: 7. August), die Bundesliga drei Wochen
     spaeter (28. August). DFB-Pokal: 1. Runde 21.–24.8., 2. Runde 27./28.10., Achtelfinale 1./2.12.,
     Viertelfinale Anfang Februar, Halbfinale Ende April, Finale 29.5. in Berlin.
     Laenderspielpausen 21.9.–6.10. und 9.–17.11. sowie Ende Maerz (die 3. Liga spielt durch).
     Winterpause ab 20.12.; Bundesliga zurueck am 8.–10.1. mit Englischer Woche am 12./13.1.,
     2. und 3. Liga ab 15.1. Der 1. Mai ist spielfrei, Saisonende am 22./23. Mai. */
  FM.seasonFrame = function (y) {
    var sat = function (m, d, yy) { return firstWeekdayOnOrAfter(D.iso(yy || y, m, d), 6); };
    var tue = function (m, d, yy) { return firstWeekdayOnOrAfter(D.iso(yy || y, m, d), 2); };
    var start2 = sat(8, 6), startBL = sat(8, 27), cupR1 = sat(8, 20);
    var winterA = D.iso(y, 12, 20);
    var blBack = sat(1, 8, y + 1), lowBack = sat(1, 15, y + 1);
    var endAll = sat(5, 21, y + 1);
    var breaks = [sat(9, 25), sat(10, 2), sat(11, 13), sat(3, 26, y + 1)];
    var mayFree = sat(4, 30, y + 1);           // Wochenende um den 1. Mai
    var sats = [];
    for (var d = start2; d <= endAll; d = D.add(d, 7)) sats.push(d);
    var free = function (x) { return x !== cupR1 && x !== mayFree; };
    var pro = function (x) { return free(x) && breaks.indexOf(x) < 0; };
    return {
      s0: start2, cupR1: cupR1,
      bl: { pre: sats.filter(function (x) { return x >= startBL && x < winterA && pro(x); }),
        post: sats.filter(function (x) { return x >= blBack && pro(x); }), midweek: [tue(1, 12, y + 1)] },
      bl2: { pre: sats.filter(function (x) { return x < winterA && pro(x); }),
        post: sats.filter(function (x) { return x >= lowBack && pro(x); }), midweek: [] },
      l3: { pre: sats.filter(function (x) { return x < winterA && free(x); }),
        post: sats.filter(function (x) { return x >= lowBack && free(x); }), midweek: [] },
      cup: [cupR1, tue(10, 27), tue(12, 1), tue(2, 2, y + 1), tue(4, 20, y + 1), sat(5, 27, y + 1)]
    };
  };

  /* n Termine aus einer Liste von Wochenenden; fehlende als Englische Wochen (dienstags) ergaenzt */
  function pickDates(list, n, extra, avoid) {
    var l = list.slice(0, n);
    (extra || []).forEach(function (x) { if (l.length < n && l.indexOf(x) < 0) l.push(x); });
    l.sort();
    var k = 0;
    while (l.length < n && k < 60) {
      var base = l[Math.min(l.length - 1, 3 + k * 3)] || l[l.length - 1];
      var t = D.add(base, 3);
      if ((!avoid || avoid.indexOf(t) < 0) && l.indexOf(t) < 0) l.push(t);
      l.sort();
      k++;
    }
    return l;
  }

  /* Alle Termine einer Saison: die Hinrunde kann (wie in der Bundesliga 2026/27 mit nur
     14 Spieltagen vor Weihnachten) bis in den Januar reichen. */
  FM.leagueDates = function (frame, leagueId, half) {
    var f = frame[leagueId] || frame.l3;
    var all = f.pre.concat(f.post).concat(f.midweek).sort();
    return pickDates(all, half * 2, [], frame.cup);
  };

  FM.newFixture = function (state, f) {
    var id = 'f' + (state.fxSeq = (state.fxSeq || 0) + 1);
    f.id = id; f.res = null;
    state.fixtures[id] = f;
    return f;
  };

  FM.addCalendar = function (state, date, comp, round, fids, label) {
    state.calendar.push({ date: date, comp: comp, round: round, fx: fids, label: label || '' });
    state.calendar.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  };

  /* Ligaspielplaene einer Saison anlegen */
  FM.buildLeagueSchedules = function (state) {
    var y = state.season.year;
    var frame = FM.seasonFrame(y);
    state.frame = frame;
    ['bl', 'bl2', 'l3'].forEach(function (lid) {
      var clubs = R.shuffle(state.leagues[lid].clubs.slice());
      var rr = FM.roundRobin(clubs);
      var half = rr.length / 2;
      var dates = FM.leagueDates(frame, lid, half);
      rr.forEach(function (games, ri) {
        var date = dates[ri];
        var fids = games.map(function (g) {
          return FM.newFixture(state, { comp: lid, round: ri + 1, date: date, home: g[0], away: g[1] }).id;
        });
        FM.addCalendar(state, date, lid, ri + 1, fids, (ri + 1) + '. Spieltag');
      });
      state.leagues[lid].rounds = rr.length;
      state.leagues[lid].lastDate = dates[dates.length - 1];
    });
  };

  /* ---------- DFB-Pokal ---------- */
  FM.cupEligible = function (state) {
    var ids = [];
    ['bl', 'bl2', 'l3', 'rl'].forEach(function (lid) {
      state.leagues[lid].clubs.forEach(function (cid) { if (!state.clubs[cid].reserve) ids.push(cid); });
    });
    return ids;
  };

  function levelOf(state, cid) {
    var l = state.clubs[cid].league;
    return { bl: 1, bl2: 2, l3: 3, rl: 4 }[l] || 5;
  }
  FM.levelOf = levelOf;

  FM.drawCupRound1 = function (state) {
    var all = FM.cupEligible(state);
    var size = 1; while (size < all.length) size *= 2;
    var byes = Math.max(0, size - all.length);
    var bl = state.leagues.bl.clubs.slice().sort(function (a, b) { return state.clubs[b].rep - state.clubs[a].rep; });
    var byeClubs = bl.slice(0, byes);
    var rest = all.filter(function (c) { return byeClubs.indexOf(c) < 0; });
    var potA = R.shuffle(rest.filter(function (c) { return levelOf(state, c) <= 2; }));
    var potB = R.shuffle(rest.filter(function (c) { return levelOf(state, c) >= 3; }));
    var pairs = [];
    while (potA.length && potB.length) pairs.push([potB.pop(), potA.pop()]);
    var left = R.shuffle(potA.concat(potB));
    while (left.length >= 2) pairs.push([left.pop(), left.pop()]);
    var date = state.frame.cup[0];
    var fids = pairs.map(function (p) { return FM.newFixture(state, { comp: 'cup', round: 1, date: date, home: p[0], away: p[1] }).id; });
    state.cup = { round: 1, byes: byeClubs, alive: all.slice(), winner: null, rounds: [{ date: date, fx: fids, byes: byeClubs }] };
    FM.addCalendar(state, date, 'cup', 1, fids, FM.CUP_ROUNDS[0]);
    // Freilose erhalten die Antrittspraemie der 1. Runde
    byeClubs.forEach(function (c) { FM.book(state.clubs[c], 'prize', FM.CUP_PRIZE[0]); });
  };

  FM.drawNextCupRound = function (state) {
    var cup = state.cup, cur = cup.rounds[cup.round - 1];
    var winners = cur.fx.map(function (fid) { return FM.fixtureWinner(state.fixtures[fid]); }).concat(cur.byes || []);
    cup.alive = winners.slice();
    if (winners.length === 1) { cup.winner = winners[0]; return; }
    var next = cup.round + 1;
    var date = state.frame.cup[Math.min(next - 1, 5)];
    var pool = R.shuffle(winners.slice());
    var fids = [];
    for (var i = 0; i + 1 < pool.length; i += 2) {
      var a = pool[i], b = pool[i + 1];
      var la = levelOf(state, a), lb = levelOf(state, b);
      var home = la > lb ? a : lb > la ? b : a, away = home === a ? b : a;
      var fx = { comp: 'cup', round: next, date: date, home: home, away: away };
      if (next === 6) fx.neutral = true;
      fids.push(FM.newFixture(state, fx).id);
    }
    cup.round = next;
    cup.rounds.push({ date: date, fx: fids, byes: [] });
    FM.addCalendar(state, date, 'cup', next, fids, FM.CUP_ROUNDS[next - 1]);
    return fids;
  };

  FM.fixtureWinner = function (fx) {
    if (!fx || !fx.res) return null;
    var r = fx.res;
    if (fx.leg === 2 && fx.agg) {
      var h = fx.agg[0] + r.hg, a = fx.agg[1] + r.ag;
      if (h !== a) return h > a ? fx.home : fx.away;
    } else if (r.hg !== r.ag) return r.hg > r.ag ? fx.home : fx.away;
    if (r.pen) return r.pen[0] > r.pen[1] ? fx.home : fx.away;
    return null;
  };

  /* ---------- Relegation ---------- */
  FM.createPlayoff = function (state, comp, upperClub, lowerClub) {
    var last = comp === 'po1' ? state.leagues.bl.lastDate : state.leagues.l3.lastDate;
    if (comp === 'po1' && state.leagues.bl2.lastDate > last) last = state.leagues.bl2.lastDate;
    var d1 = D.add(last, comp === 'po1' ? 5 : 3);
    var d2 = D.add(last, comp === 'po1' ? 9 : 9);
    var f1 = FM.newFixture(state, { comp: comp, round: 1, leg: 1, date: d1, home: upperClub, away: lowerClub });
    var f2 = FM.newFixture(state, { comp: comp, round: 2, leg: 2, date: d2, home: lowerClub, away: upperClub, first: f1.id });
    FM.addCalendar(state, d1, comp, 1, [f1.id], 'Relegation – Hinspiel');
    FM.addCalendar(state, d2, comp, 2, [f2.id], 'Relegation – Rückspiel');
    state.playoffs = state.playoffs || {};
    state.playoffs[comp] = { upper: upperClub, lower: lowerClub, fx: [f1.id, f2.id] };
  };
})();
