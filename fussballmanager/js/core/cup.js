/* DFB-Pokal: Teilnehmer nach DFB-Regel, Landespokale und Amateurvereine als Pokalgaeste.
   64 Teams = 36 Vereine aus 1. und 2. Bundesliga der Vorsaison + Top 4 der 3. Liga + 24 Startplaetze
   der Landesverbaende. Topf 1: Bundesliga + 2. Liga Platz 1–14, Topf 2 (mit Heimrecht): der Rest.
   2026/27 gilt die echte Auslosung vom 6. Juni 2026. Grundlage: data-src/amateurs.py */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;

  function data() { return window.FM_DATA || {}; }
  var amMap = null, lvMap = null;
  function amateur(id) {
    if (!amMap) { amMap = {}; (data().amateurs || []).forEach(function (a) { amMap[a.id] = a; }); }
    return amMap[id] || null;
  }
  /* Landesverband eines Vereins (Profis aus den Stammdaten, Gaeste aus dem Amateur-Pool) */
  FM.clubLv = function (cid) {
    if (!lvMap) { lvMap = {}; (data().clubs || []).forEach(function (c) { lvMap[c.id] = c.lv; }); }
    var a = amateur(cid);
    return a ? a.lv : lvMap[cid] || null;
  };
  FM.lvName = function (lv) { var l = (data().lv || {})[lv]; return l ? l.name : ''; };

  /* Ligaangabe fuer Anzeigen; Pokalgaeste spielen in keiner Liga des Spiels */
  FM.leagueName = function (state, c, short) {
    if (c.guest) return short ? 'Amateure' : c.div;
    var l = state.leagues[c.league];
    return l ? (short ? l.short : l.name) : '';
  };

  /* Staerke wie in den Stammdaten: Schnitt der besten 14 */
  function top14(state, cid) {
    var o = FM.clubPlayers(state, cid).map(function (p) { return p.ovr; }).sort(function (a, b) { return b - a; }).slice(0, 14);
    return o.length ? FM.avg(o) : 50;
  }

  /* ---------- Pokalgaeste ---------- */
  var GUEST_POS = ['GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST'];
  var SPREAD = [5, 4, 3, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -3, -4, -5, -6, -7];

  /* Kader der Vorsaison loeschen; das Vereinsobjekt bleibt (Spielberichte, Historie) */
  FM.clearGuests = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!c.guest) return;
      c.squad.forEach(function (pid) { delete state.players[pid]; });
      c.squad = [];
      c.lineup = null;
    });
  };

  FM.makeGuest = function (state, a, taken) {
    var c = state.clubs[a.id];
    if (!c) {
      c = state.clubs[a.id] = {
        id: a.id, name: a.name, short: a.short, abbr: a.abbr, colors: a.colors, stadium: a.stadium, cap: a.cap,
        rep: FM.clamp(Math.round(20 + (a.ovr - 43) * 1.6), 15, 40), league: 'am', guest: true, div: a.div, lv: a.lv,
        reserve: null, money: 0, squad: [], formation: null, tactics: FM.defaultTactics(), lineup: null,
        hist: [], fin: FM.emptyLedger(), finPrev: null, expect: null, loanedOut: [],
        prof: { founded: null, nick: '', kind: ['amateur'], nlz: 1, att: null, attL: 'am', tvReal: null, pay: null },
        rivals: [], pat: 1, owner: 0, debt: 0, debt0: 0, fans: a.fans, tvScore: 0, tvCur: 0
      };
    }
    c.fin = FM.emptyLedger();
    if (!c.squad.length) {
      var y = state.season.year, spread = R.shuffle(SPREAD.slice());
      GUEST_POS.forEach(function (pos, i) {
        var name = FM.randomName(taken);
        taken[name] = 1;
        var ovr = FM.clamp(a.ovr + spread[i] + R.int(-1, 1), 38, 68), age = R.int(18, 33);
        var p = {
          id: FM.newPlayerId(), name: name, club: c.id, pos: [pos], ovr: ovr, s: FM.deriveStats(pos, ovr, name),
          age: age, src: 'a', ageEst: false, pot: FM.initialPotential(name, age, ovr),
          form: 0, fit: 100, mor: 75, contract: null, injury: null, susp: 0, yel: 0,
          st: FM.emptyStats(), cst: { apps: 0, goals: 0 }, hist: [], prog: 0, listed: false,
          joined: y, minutesRecent: 0
        };
        p.contract = { until: y + 3, wage: FM.wageDemand(p, 'am') };
        state.players[p.id] = p;
        c.squad.push(p.id);
      });
    }
    c.formation = FM.bestFormation(FM.clubPlayers(state, c.id));
    return c;
  };

  /* ---------- Qualifikation ---------- */
  /* Am Saisonende: Toepfe fuer die naechste Pokalsaison aus den Abschlusstabellen */
  FM.cupSeedFromTables = function (state, tables, year) {
    var ids = function (t) { return (t || []).map(function (r) { return r.club; }); };
    var bl2 = ids(tables.bl2);
    var l3 = ids(tables.l3).filter(function (cid) { return !state.clubs[cid].reserve; }).slice(0, 4);
    state.cupSeed = { year: year + 1, pot1: ids(tables.bl).concat(bl2.slice(0, 14)), pro2: bl2.slice(14).concat(l3) };
  };

  /* Ersatz ohne Vorsaison-Tabellen (alte Spielstaende): aktuelle Ligen, 2. Liga nach Fuenfjahreswertung */
  function fallbackSeed(state) {
    var bl2 = state.leagues.bl2.clubs.slice().sort(function (a, b) { return (state.clubs[b].tvScore || 0) - (state.clubs[a].tvScore || 0); });
    var l3 = state.leagues.l3.clubs.filter(function (cid) { return !state.clubs[cid].reserve; })
      .sort(function (a, b) { return state.clubs[b].rep - state.clubs[a].rep; }).slice(0, 4);
    return { pot1: state.leagues.bl.clubs.concat(bl2.slice(0, 14)), pro2: bl2.slice(14).concat(l3) };
  }

  /* Landespokale: je Landesverband ein Sieger (Bayern, Niedersachsen, Westfalen: zwei Startplaetze).
     Es spielen alle nicht qualifizierten Vereine aus 3. Liga und Regionalliga plus die Amateure. */
  function landespokal(state, qualified) {
    var q = {};
    qualified.forEach(function (cid) { q[cid] = 1; });
    var lvs = data().lv || {}, out = [];
    Object.keys(lvs).forEach(function (lv) {
      var cands = [];
      ['l3', 'rl'].forEach(function (lid) {
        state.leagues[lid].clubs.forEach(function (cid) {
          if (!state.clubs[cid].reserve && !q[cid] && FM.clubLv(cid) === lv) cands.push({ id: cid, s: top14(state, cid) });
        });
      });
      (data().amateurs || []).forEach(function (a) { if (a.lv === lv) cands.push({ id: a.id, s: a.ovr }); });
      for (var k = 0; k < lvs[lv].slots && cands.length; k++) {
        var w = R.weighted(cands, function (c) { return Math.exp((c.s - 50) / 6); });
        out.push(w.id);
        cands.splice(cands.indexOf(w), 1);
      }
    });
    return out;
  }

  function realDraw(state) {
    var d = data();
    if (state.season.year !== d.startYear || !d.cupDraw) return null;
    var ok = d.cupDraw.every(function (p) { return p.every(function (id) { return state.clubs[id] || amateur(id); }); });
    return ok ? d.cupDraw.map(function (p) { return p.slice(); }) : null;
  }

  /* ---------- 1. Hauptrunde ---------- */
  FM.drawCupRound1 = function (state) {
    FM.clearGuests(state);
    var uc = state.user.club, user = state.clubs[uc];
    var pairs = realDraw(state), lpWin = null;
    if (!pairs) {
      var seed = state.cupSeed && state.cupSeed.year === state.season.year ? state.cupSeed : fallbackSeed(state);
      var pot1 = seed.pot1.filter(function (cid) { return state.clubs[cid]; });
      var pro2 = seed.pro2.filter(function (cid) { return state.clubs[cid]; });
      var lp = landespokal(state, pot1.concat(pro2));
      if (lp.indexOf(uc) >= 0) lpWin = true;
      else if (FM.levelOf(state, uc) >= 3 && pot1.concat(pro2).indexOf(uc) < 0) lpWin = false;
      pot1 = R.shuffle(pot1);
      var pot2 = R.shuffle(pro2.concat(lp));
      while (pot1.length > pot2.length + 1) pot2.push(pot1.pop());
      while (pot2.length > pot1.length + 1) pot1.push(pot2.pop());
      pairs = [];
      while (pot1.length && pot2.length) pairs.push([pot2.pop(), pot1.pop()]);
    }
    var taken = {};
    Object.keys(state.players).forEach(function (k) { taken[state.players[k].name] = 1; });
    var all = [];
    pairs.forEach(function (p) {
      p.forEach(function (cid) {
        var a = amateur(cid);
        if (a) FM.makeGuest(state, a, taken);
        all.push(cid);
      });
    });
    var date = state.frame.cup[0];
    var fids = pairs.map(function (p) { return FM.newFixture(state, { comp: 'cup', round: 1, date: date, home: p[0], away: p[1] }).id; });
    state.cup = { round: 1, byes: [], alive: all, winner: null, rounds: [{ date: date, fx: fids, byes: [] }] };
    FM.addCalendar(state, date, 'cup', 1, fids, FM.CUP_ROUNDS[0]);

    var lvn = FM.lvName(FM.clubLv(uc));
    if (lpWin === true) {
      FM.addNews(state, { type: 'cup', important: true, title: 'Landespokalsieger!', body: user.name + ' gewinnt den Landespokal ' + lvn + ' und ist damit im DFB-Pokal dabei.' });
    } else if (all.indexOf(uc) < 0) {
      FM.addNews(state, {
        type: 'cup', title: 'DFB-Pokal ohne uns', body: lpWin === false
          ? user.name + ' ist im Landespokal ' + lvn + ' ausgeschieden und verpasst den DFB-Pokal. Qualifiziert sind die 36 Erst- und Zweitligisten, die Top 4 der 3. Liga und die Landespokalsieger.'
          : user.name + ' hat sich nicht für den DFB-Pokal ' + state.season.year + '/' + String(state.season.year + 1).slice(2) + ' qualifiziert. Dabei sind die 36 Erst- und Zweitligisten, die Top 4 der 3. Liga und die Landespokalsieger.'
      });
    }
  };
})();
