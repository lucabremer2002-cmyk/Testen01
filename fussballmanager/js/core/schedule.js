/* Spielplan: Doppelrunden, Kalender, Pokal-Auslosung, Relegation. */
(function () {
  'use strict';
  var FM = window.FM;
  var D = FM.date;
  var R = FM.rng;

  FM.COMP_NAME = { bl: 'Bundesliga', bl2: '2. Bundesliga', l3: '3. Liga', rlw: 'Regionalliga West', rlsw: 'Regionalliga Südwest', rl: 'Regionalliga', olw: 'Oberliga', olsw: 'Oberliga', cup: 'DFB-Pokal', po1: 'Relegation', po2: 'Relegation' };
  FM.LEVEL = { bl: 1, bl2: 2, l3: 3, rlw: 4, rlsw: 4, rl: 4, olw: 5, olsw: 5 };
  /* Simulierte Regionalliga-Staffeln: Region ihrer Vereine und zugehoeriger Oberliga-Pool */
  FM.REGIONAL = {
    rlw: { region: 'west', ol: 'olw', name: 'Regionalliga West', short: 'RL West', area: 'Westvereine' },
    rlsw: { region: 'suedwest', ol: 'olsw', name: 'Regionalliga Südwest', short: 'RL Südwest', area: 'Südwestvereine' }
  };
  /* Simulierte Ligen (Regionalligen fehlen in Spielstaenden aelterer Versionen) */
  FM.SIM = ['bl', 'bl2', 'l3', 'rlw', 'rlsw'];
  FM.simLeagues = function (state) { return FM.SIM.filter(function (l) { return state.leagues[l] && state.leagues[l].clubs.length; }); };
  FM.isSimLeague = function (lid) { return FM.SIM.indexOf(lid) >= 0; };
  FM.isRegional = function (lid) { return !!FM.REGIONAL[lid]; };
  FM.isOberliga = function (lid) { return lid === 'olw' || lid === 'olsw'; };
  /* Halbprofi-/Amateurbereich: alle Ligen unterhalb der 3. Liga */
  FM.isAmateurLeague = function (lid) { return (FM.LEVEL[lid] || 5) >= 4; };
  FM.regionals = function (state) {
    return Object.keys(FM.REGIONAL).filter(function (l) { return state.leagues[l] && state.leagues[l].clubs.length; });
  };
  /* Regionalliga, in die ein Verein aus der 3. Liga absteigt: die simulierte Staffel seiner
     Region, sonst der Pool der uebrigen Staffeln */
  FM.regionLeague = function (state, club) {
    var regs = FM.regionals(state);
    for (var i = 0; i < regs.length; i++) if (club && club.region === FM.REGIONAL[regs[i]].region) return regs[i];
    return 'rl';
  };
  FM.CUP_ROUNDS = ['1. Runde', '2. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  FM.CUP_PRIZE = [210000, 420000, 840000, 1700000, 3400000, 4300000];

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

  /* Rahmenterminkalender einer Saison (Startjahr y) */
  FM.seasonFrame = function (y) {
    var s0 = firstWeekdayOnOrAfter(D.iso(y, 8, 6), 6);
    var end = D.iso(y + 1, 5, 24);
    var winterA = D.iso(y, 12, 18), winterB = D.iso(y + 1, 1, 14);
    var sats = [];
    for (var d = s0; d <= end; d = D.add(d, 7)) {
      if (d > winterA && d < winterB) continue;
      sats.push(d);
    }
    var cupR1 = sats[1];
    var league = sats.filter(function (x) { return x !== cupR1; });
    var pre = league.filter(function (x) { return x < winterA; });
    var post = league.filter(function (x) { return x > winterB; });
    return {
      s0: s0, cupR1: cupR1, pre: pre, post: post,
      cup: [
        cupR1,
        firstWeekdayOnOrAfter(D.iso(y, 10, 27), 2),
        firstWeekdayOnOrAfter(D.iso(y, 12, 1), 2),
        firstWeekdayOnOrAfter(D.iso(y + 1, 2, 2), 2),
        firstWeekdayOnOrAfter(D.iso(y + 1, 4, 20), 2),
        firstWeekdayOnOrAfter(D.iso(y + 1, 5, 27), 6)
      ]
    };
  };

  /* Termine fuer n Spieltage pro Halbserie aus einer Liste von Samstagen (+ Dienstage bei Bedarf) */
  function pickDates(list, n, skipFirst, avoid) {
    var l = list.slice(skipFirst ? 1 : 0);
    if (l.length > n) l = l.slice(0, n);
    var k = 0;
    while (l.length < n && k < 40) {
      var base = l[Math.min(l.length - 1, 4 + k * 3)] || l[l.length - 1];
      var tue = D.add(base, 3);
      if ((!avoid || avoid.indexOf(tue) < 0) && l.indexOf(tue) < 0) l.push(tue);
      l.sort();
      k++;
    }
    return l;
  }

  FM.leagueDates = function (frame, leagueId, half) {
    var rounds = half;
    var cupAvoid = frame.cup;
    if (leagueId === 'bl') {
      return pickDates(frame.pre, rounds, true, cupAvoid).concat(pickDates(frame.post.slice(1), rounds, false, cupAvoid));
    }
    if (leagueId === 'bl2' || FM.isRegional(leagueId)) {
      return pickDates(frame.pre, rounds, false, cupAvoid).concat(pickDates(frame.post.slice(1), rounds, false, cupAvoid));
    }
    return pickDates(frame.pre, rounds, false, cupAvoid).concat(pickDates(frame.post, rounds, false, cupAvoid));
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
    FM.simLeagues(state).forEach(function (lid) {
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
  /* Teilnehmer: alle Profivereine (ohne Reserveteams), die staerksten Regionalligisten der
     nicht simulierten Staffeln und abwechselnd die bestplatzierten Vereine der simulierten
     Regionalligen der Vorsaison (stellvertretend fuer die Landespokalsieger), bis 64 Teams. */
  FM.cupEligible = function (state) {
    var ids = [];
    function first(cid) { return !state.clubs[cid].reserve; }
    ['bl', 'bl2', 'l3'].forEach(function (lid) {
      state.leagues[lid].clubs.forEach(function (cid) { if (first(cid)) ids.push(cid); });
    });
    var regs = FM.regionals(state);
    var others = state.leagues.rl.clubs.filter(first).sort(function (a, b) { return state.clubs[b].rep - state.clubs[a].rep; });
    ids = ids.concat(others.slice(0, regs.length === 0 ? others.length : regs.length === 1 ? 4 : 2));
    var orders = regs.map(function (lid) { return FM.regCupOrder(state, lid); });
    for (var k = 0; ids.length < 64 && orders.some(function (o) { return o.length > k; }); k++) {
      orders.forEach(function (o) { if (ids.length < 64 && o[k]) ids.push(o[k]); });
    }
    return ids;
  };

  /* Reihenfolge einer Staffel fuer die Pokalplaetze: Platzierung der Vorsaison, Absteiger aus
     der 3. Liga zuerst, Aufsteiger aus der Oberliga zuletzt; in der ersten Saison nach Staerke. */
  FM.regCupOrder = function (state, lid) {
    var seeds = state.regSeed || (state.rlwSeed ? { rlw: state.rlwSeed } : {});
    var seed = seeds[lid] || null;
    function key(cid) {
      var c = state.clubs[cid];
      if (seed && seed[cid] != null) return seed[cid];
      if (seed) return c.prevLeague === 'l3' ? 0 : 50;
      return 30 - FM.teamStrength(state, cid) / 3 - c.rep / 20;
    }
    return state.leagues[lid].clubs.filter(function (cid) { return !state.clubs[cid].reserve; })
      .sort(function (a, b) { return key(a) - key(b); });
  };

  function levelOf(state, cid) {
    return FM.LEVEL[state.clubs[cid].league] || 5;
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
