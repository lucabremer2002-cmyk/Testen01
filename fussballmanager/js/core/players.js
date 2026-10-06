/* Spielermodell: Erstellung, Marktwert, Gehalt, Potenzial, Entwicklung. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;

  FM.STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  FM.STAT_LABEL = ['TEM', 'SCH', 'PAS', 'DRI', 'DEF', 'PHY'];
  FM.GK_STAT_LABEL = ['HEC', 'HAL', 'ABS', 'REF', 'SCH', 'STE'];
  FM.STAT_NAME = ['Tempo', 'Schuss', 'Passspiel', 'Dribbling', 'Defensive', 'Physis'];
  FM.GK_STAT_NAME = ['Hechten', 'Halten', 'Abstoß', 'Reflexe', 'Schnelligkeit', 'Stellungsspiel'];

  FM.SRC_LABEL = {
    v: 'EA SPORTS FC 27 – Gesamtwert und Kartenwerte',
    o: 'EA SPORTS FC 27 – Gesamtwert (Kartenwerte abgeleitet)',
    f: 'EA SPORTS FC 26 – letzter verfügbarer Datenstand',
    e: 'Geschätzt (echter Kaderspieler 2026/27, Wert nicht in der FC-27-Datenbank gefunden)',
    y: 'Nachwuchsspieler aus der Vereinsakademie (fiktiv)'
  };

  var LEAGUE_WAGE = { bl: 1, bl2: 0.72, l3: 0.5, rl: 0.32 };

  /* Kartenwerte aus Position + Gesamtwert ableiten (gleiche Logik wie im Build-Skript) */
  FM.deriveStats = function (pos, ovr, seedName) {
    var o = ovr, b;
    switch (pos) {
      case 'GK': b = [o + 1, o - 2, o - 7, o + 2, 38, o - 1]; break;
      case 'ST': b = [o + 2, o + 3, o - 12, o - 2, 33, o + 3]; break;
      case 'LW': case 'RW': case 'LM': case 'RM': b = [o + 9, o - 4, o - 4, o + 3, 38, o - 10]; break;
      case 'CAM': b = [o - 2, o - 3, o + 2, o + 3, 45, o - 12]; break;
      case 'CM': b = [o - 4, o - 8, o + 1, o, o - 8, o - 2]; break;
      case 'CDM': b = [o - 9, o - 15, o - 4, o - 6, o + 1, o + 5]; break;
      case 'CB': b = [o - 6, 35, o - 15, o - 13, o + 1, o + 5]; break;
      case 'LB': case 'RB': b = [o + 5, 45, o - 6, o - 4, o - 3, o]; break;
      default: b = [o, o, o, o, o, o];
    }
    var h = FM.hash(seedName || String(Math.random()));
    return b.map(function (v, i) { return FM.clamp(Math.round(v + ((h >>> (i * 4)) % 7) - 3), 15, 99); });
  };

  function potentialGrowth(age) {
    if (age <= 17) return 17;
    if (age === 18) return 15;
    if (age === 19) return 12.5;
    if (age === 20) return 10;
    if (age === 21) return 8;
    if (age === 22) return 6;
    if (age === 23) return 4;
    if (age === 24) return 2.5;
    if (age === 25) return 1.5;
    if (age === 26) return 0.7;
    return 0;
  }

  FM.initialPotential = function (name, age, ovr) {
    var h = FM.hash(name + '|pot');
    var f = 0.45 + (h % 1000) / 1000 * 1.0; // 0.45 .. 1.45
    var pot = Math.round(ovr + potentialGrowth(age) * f);
    if (ovr >= 80 && age <= 21) pot += 2;
    return FM.clamp(Math.max(pot, ovr), ovr, 95);
  };

  FM.ageValueFactor = function (age) {
    if (age <= 19) return 1.5;
    if (age <= 21) return 1.45;
    if (age <= 23) return 1.35;
    if (age <= 25) return 1.15;
    if (age <= 27) return 1.0;
    if (age <= 29) return 0.85;
    if (age === 30) return 0.75;
    if (age === 31) return 0.62;
    if (age === 32) return 0.52;
    if (age === 33) return 0.42;
    if (age === 34) return 0.32;
    return 0.22;
  };

  function niceRound(v) {
    if (v >= 1e8) return Math.round(v / 5e6) * 5e6;
    if (v >= 1e7) return Math.round(v / 1e6) * 1e6;
    if (v >= 1e6) return Math.round(v / 1e5) * 1e5;
    if (v >= 1e5) return Math.round(v / 2.5e4) * 2.5e4;
    return Math.max(10000, Math.round(v / 5e3) * 5e3);
  }
  FM.niceRound = niceRound;

  FM.marketValue = function (p) {
    var v = 0.25e6 * Math.pow(1.23, p.ovr - 60) * FM.ageValueFactor(p.age);
    if (p.age <= 24 && p.pot > p.ovr) v *= 1 + (p.pot - p.ovr) * 0.035;
    if (p.contract && p.contract.until - FM.seasonYear() <= 1) v *= 0.8;
    if (p.injury && p.injury.days > 60) v *= 0.85;
    return niceRound(v);
  };

  /* Jahresgehalt, das ein Spieler fuer sein Niveau verlangt (abhaengig von der Liga des Vereins) */
  FM.wageDemand = function (p, leagueId) {
    var lf = LEAGUE_WAGE[leagueId] != null ? LEAGUE_WAGE[leagueId] : 0.6;
    var w = 0.13e6 * Math.pow(1.19, p.ovr - 60) * lf;
    if (p.age >= 30) w *= 1.08;
    if (p.age <= 20) w *= 0.75;
    return niceRound(Math.max(25000, w));
  };

  FM.seasonYear = function () { return FM.state ? FM.state.season.year : 2026; };

  var pid = 0;
  FM.newPlayerId = function () { pid++; return 'p' + Date.now().toString(36).slice(-4) + pid.toString(36); };

  FM.makePlayer = function (row, clubId, leagueId, year, idPrefix, idx) {
    var name = row[0], pos = row[1].split('/'), ovr = row[2], stats = row[3].slice(), age = row[4];
    var src = row[5].charAt(0), ageEst = row[5].indexOf('?') >= 0;
    var p = {
      id: idPrefix + idx,
      name: name,
      club: clubId,
      pos: pos,
      ovr: ovr,
      s: stats,
      age: age,
      src: src,
      ageEst: ageEst,
      pot: FM.initialPotential(name, age, ovr),
      form: 0,
      fit: 100,
      mor: 70,
      contract: null,
      injury: null,
      susp: 0,
      yel: 0,
      st: FM.emptyStats(),
      cst: { apps: 0, goals: 0 },
      hist: [],
      prog: 0,
      listed: false,
      joined: year,
      minutesRecent: 0
    };
    var h = FM.hash(name + '|contract');
    var years = age >= 32 ? 1 + (h % 2) : age <= 22 ? 2 + (h % 4) : 1 + (h % 4);
    p.contract = { until: year + years, wage: FM.wageDemand(p, leagueId) };
    return p;
  };

  FM.emptyStats = function () {
    return { apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, gsum: 0, gn: 0, yc: 0, rc: 0, motm: 0, cs: 0 };
  };

  FM.avgGrade = function (p) { return p.st.gn ? p.st.gsum / p.st.gn : null; };

  /* Staerke eines Spielers auf einer Position inkl. Tagesform, Fitness und Moral */
  FM.effectiveRating = function (p, slotPos, fitOverride) {
    var fit = fitOverride != null ? fitOverride : p.fit;
    var r = p.ovr - FM.positionPenalty(p, slotPos || p.pos[0]);
    r += p.form * 0.7;
    if (fit < 90) r -= (90 - fit) * 0.16;
    r += (p.mor - 65) / 25;
    return r;
  };

  /* Verfuegbarkeit; FM.matchComp bestimmt, welche Sperre gilt (Liga oder Pokal) */
  FM.matchComp = null;
  FM.isAvailable = function (p, comp) {
    if (p.injury) return false;
    comp = comp || FM.matchComp;
    if (comp === 'cup') return !(p.suspCup > 0);
    return !(p.susp > 0);
  };

  /* Nachwuchsspieler (fiktiv) */
  FM.makeYouth = function (club, state, opts) {
    opts = opts || {};
    var lvl = { bl: [54, 64], bl2: [49, 60], l3: [46, 57], rl: [42, 52] }[club.league] || [46, 56];
    var yb = FM.facYouthBonus ? FM.facYouthBonus(club) : 0;
    var ovr = R.int(lvl[0], lvl[1]) + Math.round((club.rep - 60) / 15) + yb;
    var age = opts.age || R.int(16, 18);
    var pos = opts.pos || R.weighted(['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'],
      function (x) { return { GK: 1, CB: 2, LB: 1, RB: 1, CDM: 1, CM: 1.6, CAM: 1, LM: 0.8, RM: 0.8, LW: 0.8, RW: 0.8, ST: 1.4 }[x]; });
    var taken = {};
    Object.keys(state.players).forEach(function (k) { taken[state.players[k].name] = 1; });
    var name = FM.randomName(taken);
    var p = {
      id: FM.newPlayerId(),
      name: name,
      club: club.id,
      pos: [pos],
      ovr: FM.clamp(ovr, 40, 70),
      s: null,
      age: age,
      src: 'y',
      ageEst: false,
      pot: 0,
      form: 0, fit: 100, mor: 75,
      contract: null, injury: null, susp: 0, yel: 0,
      st: FM.emptyStats(), cst: { apps: 0, goals: 0 }, hist: [], prog: 0, listed: false,
      joined: state.season.year, minutesRecent: 0, youth: true
    };
    var talent = R.next();
    var potGain = (talent > 0.97 - yb * 0.01 ? R.int(26, 34) : talent > 0.85 - yb * 0.03 ? R.int(18, 26) : R.int(8, 20)) + yb;
    p.pot = FM.clamp(p.ovr + potGain, p.ovr, 93);
    p.s = FM.deriveStats(pos, p.ovr, name);
    p.contract = { until: state.season.year + 3, wage: Math.max(20000, Math.round(FM.wageDemand(p, club.league) * 0.6 / 5000) * 5000) };
    return p;
  };

  /* OVR-Aenderung auf Kartenwerte uebertragen */
  FM.applyOvrChange = function (p, delta) {
    if (!delta) return;
    p.ovr = FM.clamp(p.ovr + delta, 30, 99);
    var pos = p.pos[0], focus;
    if (pos === 'GK') focus = [0, 1, 3, 5];
    else if (pos === 'CB') focus = [4, 5, 0];
    else if (pos === 'LB' || pos === 'RB') focus = [0, 4, 2, 3];
    else if (pos === 'CDM') focus = [4, 2, 5];
    else if (pos === 'CM') focus = [2, 3, 4];
    else if (pos === 'CAM') focus = [2, 3, 1];
    else if (pos === 'ST') focus = [1, 0, 5, 3];
    else focus = [0, 3, 1, 2];
    var steps = Math.abs(delta) * 2;
    for (var i = 0; i < steps; i++) {
      var k = delta < 0 && p.age >= 30 && R.chance(0.45) ? (pos === 'GK' ? 4 : R.chance(0.5) ? 0 : 5) : focus[i % focus.length];
      p.s[k] = FM.clamp(p.s[k] + (delta > 0 ? 1 : -1), 15, 99);
    }
  };

  /* Woechentliche Entwicklung (Training, Spielzeit, Alter) */
  FM.developWeekly = function (p, trainingFactor) {
    var gap = p.pot - p.ovr, gain = 0;
    var playFactor = p.minutesRecent > 200 ? 1.3 : p.minutesRecent > 60 ? 1.05 : 0.7;
    if (gap > 0) {
      var rate = p.age <= 20 ? 0.0075 : p.age <= 23 ? 0.0065 : p.age <= 27 ? 0.004 : 0.002;
      gain = gap * rate * playFactor * trainingFactor;
      gain = Math.max(gain, 0.004);
    }
    var decline = 0;
    if (p.age >= 31) decline = (p.age - 30) * 0.019 + (p.age >= 34 ? 0.03 : 0);
    p.prog += gain - decline + (R.next() - 0.5) * 0.02;
    if (p.prog >= 1) { p.prog -= 1; FM.applyOvrChange(p, 1); if (p.ovr > p.pot) p.pot = p.ovr; return 1; }
    if (p.prog <= -1) { p.prog += 1; FM.applyOvrChange(p, -1); if (p.pot > p.ovr + 2 && p.age >= 30) p.pot = p.ovr + 1; return -1; }
    return 0;
  };

  FM.isGK = function (p) { return p.pos[0] === 'GK'; };
  FM.mainGroup = function (p) { return FM.posGroup(p.pos[0]); };

  FM.statLabels = function (p) { return FM.isGK(p) ? FM.GK_STAT_LABEL : FM.STAT_LABEL; };
  FM.statNames = function (p) { return FM.isGK(p) ? FM.GK_STAT_NAME : FM.STAT_NAME; };
})();
