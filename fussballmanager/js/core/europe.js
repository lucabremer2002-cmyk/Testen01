/* Europapokal: Champions League, Europa League und Conference League.
   Ligaphase mit 36 Teams (acht bzw. sechs Spiele), Play-offs, Achtelfinale bis Finale.
   Auslandsvereine sind Gastvereine (wie die Pokal-Amateure): Sie haben echte Namen und eine geschaetzte
   Staerke; Stars der groessten Klubs stehen mit ihren FC-27-Werten im Spiel, der Rest des Kaders wird
   erst erzeugt, wenn der eigene Verein auf den Gegner trifft. Alle anderen Partien werden aus den
   Mannschaftsstaerken berechnet. Grundlage: data-src/europe.py */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  /* UEFA-Verteilerschluessel 2024–27 (Startgeld, Praemien je Sieg/Remis, Platzierungsanteile, Rundenpraemien)
     und Marktwertsaeule als Anteil je Rang im Teilnehmerfeld */
  FM.EU_COMPS = ['cl', 'el', 'ecl'];
  FM.EU = {
    cl: { name: 'Champions League', short: 'CL', md: 8, pots: 4, start: 18.62e6, win: 2.1e6, draw: 0.7e6, share: 275e3, top8: 2e6, top16: 1e6,
      ko: { po: 1e6, r16: 11e6, qf: 12.5e6, sf: 15e6, f: 18.5e6, w: 6.5e6 }, value: 1.28e6, price: 1.4, pull: 1.2, cap: 1, caps: { ENG: 5, ESP: 5, ITA: 4, FRA: 3, POR: 3, NED: 2, BEL: 2, TUR: 2 } },
    el: { name: 'Europa League', short: 'EL', md: 8, pots: 4, start: 4.31e6, win: 0.45e6, draw: 0.15e6, share: 75e3, top8: 0.6e6, top16: 0.3e6,
      ko: { po: 0.3e6, r16: 1.75e6, qf: 2.5e6, sf: 4.2e6, f: 7e6, w: 6e6 }, value: 0.212e6, price: 1.15, pull: 1.1, cap: 2, caps: { ENG: 3, ITA: 3, FRA: 3, ESP: 2 } },
    ecl: { name: 'Conference League', short: 'ECL', md: 6, pots: 6, start: 3.17e6, win: 0.4e6, draw: 0.133e6, share: 28e3, top8: 0.4e6, top16: 0.2e6,
      ko: { po: 0.2e6, r16: 0.8e6, qf: 1.3e6, sf: 2.5e6, f: 4e6, w: 3e6 }, value: 0.086e6, price: 1, pull: 1, cap: 2, caps: { ENG: 1, ESP: 1, ITA: 1, FRA: 1 } }
  };
  FM.EU_ROUNDS = { po: 'Play-offs', r16: 'Achtelfinale', qf: 'Viertelfinale', sf: 'Halbfinale', f: 'Finale' };
  var NEXT = { po: 'r16', r16: 'qf', qf: 'sf', sf: 'f' };
  /* Endspielorte: 2027 Madrid, Frankfurt und Istanbul (UEFA), danach wechselnd */
  var VENUES = {
    cl: [['Metropolitano, Madrid', 70460], ['Wembley, London', 90000], ['Allianz Arena, München', 75000], ['San Siro, Mailand', 75817], ['Stade de France, Paris', 80698], ['Puskás Aréna, Budapest', 67215]],
    el: [['Deutsche Bank Park, Frankfurt', 58000], ['San Mamés, Bilbao', 53331], ['Johan-Cruyff-Arena, Amsterdam', 55865], ['Estádio da Luz, Lissabon', 64642], ['Hampden Park, Glasgow', 51866]],
    ecl: [['Beşiktaş Park, Istanbul', 42590], ['Red Bull Arena, Leipzig', 47069], ['Stadion Wrocław, Breslau', 42771], ['OPAP Arena, Athen', 32500], ['Fortuna Arena, Prag', 19370]]
  };

  function data() { return (window.FM_DATA || {}).eu || { clubs: [], stars: {}, names: {}, natPool: {}, league: {}, country: {}, pots: {}, draw: {} }; }
  var rawMap = null;
  function raw(id) {
    if (!rawMap) { rawMap = {}; data().clubs.forEach(function (c) { rawMap[c.id] = c; }); }
    return rawMap[id] || null;
  }
  FM.euRaw = raw;
  FM.euCountry = function (nat) { return data().country[nat] || nat || ''; };
  FM.isEuComp = function (comp) { return !!FM.EU[comp]; };
  function repOf(str) { return FM.clamp(Math.round((str - 50) * 2.6 + 2), 25, 99); }

  /* ---------- Auslandsvereine ---------- */
  FM.euClub = function (state, id) {
    var c = state.clubs[id];
    if (c) return c;
    var d = raw(id);
    if (!d) return null;
    c = state.clubs[id] = {
      id: d.id, name: d.name, short: d.short, abbr: d.abbr, colors: d.colors, stadium: d.stadium, cap: d.cap,
      rep: repOf(d.str), league: 'eu', guest: true, eu: true, nat: d.nat, div: data().league[d.nat] || 'Ausland', str: d.str,
      reserve: null, money: 0, squad: [], formation: null, tactics: FM.defaultTactics(), lineup: null,
      hist: [], fin: FM.emptyLedger(), finPrev: null, expect: null, loanedOut: [],
      prof: { founded: null, nick: '', kind: [], nlz: 3, att: null, attL: 'eu', tvReal: null, pay: null },
      rivals: [], pat: 1, owner: 0, debt: 0, debt0: 0, fans: Math.round(d.cap * 0.93), tvScore: 0, tvCur: 0
    };
    return c;
  };

  /* Staerke fuer berechnete Partien: deutsche Klubs nach ihrer besten Elf, Auslandsvereine nach Datenstand */
  FM.euStr = function (state, id) {
    var c = state.clubs[id];
    if (c && !c.eu) return FM.teamStrength(state, id);
    return c ? c.str : (raw(id) || { str: 70 }).str;
  };

  /* ---------- Spieler auslaendischer Vereine ---------- */
  FM.euName = function (nat, taken, world) {
    var d = data(), key = world ? 'wo' : d.natPool[nat] || 'ea', n = '';
    for (var i = 0; i < 40; i++) {
      var p = key === 'de' ? [FM.NAMES.first, FM.NAMES.last] : d.names[key] || d.names.ea || [FM.NAMES.first, FM.NAMES.last];
      n = R.pick(p[0]) + ' ' + R.pick(p[1]);
      if (!taken[n]) break;
    }
    if (taken[n]) n += ' ' + R.pick(['Jr.', 'II', 'III']);
    taken[n] = 1;
    return n;
  };

  /* o: { name, pos ('ST/LW'), ovr, age, keep (bleibt dauerhaft im Spiel), world (internationaler Name) } */
  FM.euMakePlayer = function (state, club, o, taken) {
    var pos = o.pos.split('/'), y = state.season.year;
    var name = o.name || FM.euName(club.nat, taken, o.world);
    var p = {
      id: FM.newPlayerId(), name: name, club: club.id, pos: pos, ovr: o.ovr, s: FM.deriveStats(pos[0], o.ovr, name),
      age: o.age, src: o.name ? 'o' : 'x', ageEst: !o.name, pot: FM.initialPotential(name, o.age, o.ovr),
      form: 0, fit: 100, mor: 75, contract: null, injury: null, susp: 0, yel: 0,
      st: FM.emptyStats(), cst: { apps: 0, goals: 0 }, hist: [], prog: 0, listed: false, joined: y, minutesRecent: 0
    };
    if (o.keep) p.abroad = true; else p.gen = true;
    if (o.name) p.real = true;
    p.contract = { until: y + R.int(2, 4), wage: FM.wageDemand(p, 'eu') };
    state.players[p.id] = p;
    club.squad.push(p.id);
    return p;
  };

  function takenNames(state) {
    var t = {};
    Object.keys(state.players).forEach(function (k) { t[state.players[k].name] = 1; });
    return t;
  }

  FM.euTaken = takenNames;

  /* Stars der groessten Auslandsvereine (FC-27-Werte) – einmalig beim Spielstart */
  FM.euInitStars = function (state) {
    var d = data(), taken = takenNames(state);
    Object.keys(d.stars || {}).forEach(function (cid) {
      var club = FM.euClub(state, cid);
      if (!club) return;
      d.stars[cid].forEach(function (s) {
        if (taken[s[0]]) return;       // steht im Datenstand noch bei einem deutschen Verein
        taken[s[0]] = 1;
        FM.euMakePlayer(state, club, { name: s[0], pos: s[1], ovr: s[2], age: s[3], keep: true }, taken);
      });
    });
    state.euStars = 1;
  };

  /* Kader fuer ein Duell mit dem eigenen Verein: vorhandene Spieler (Stars, Zugaenge) plus generierte Ergaenzung,
     sodass die beste Elf der hinterlegten Vereinsstaerke entspricht */
  var XI = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'];
  var BENCH = ['GK', 'CB', 'LB', 'CM', 'CM', 'RM', 'ST'];
  FM.euSquad = function (state, cid) {
    var club = state.clubs[cid] || FM.euClub(state, cid);
    if (!club || !club.eu) return club;
    var have = FM.clubPlayers(state, cid);
    if (have.length >= 18 && have.filter(FM.isGK).length >= 2 && have.some(function (p) { return p.gen; })) return club;
    var slots = XI.concat(BENCH), filled = [], used = {};
    var pool = have.slice().sort(function (a, b) { return b.ovr - a.ovr; });
    slots.forEach(function (pos, i) {
      var best = null;
      pool.forEach(function (p) {
        if (used[p.id] || FM.positionPenalty(p, pos) > 1) return;
        if (i < 11 && p.ovr < club.str - 4) return;             // Talente und Reservisten gehoeren nicht in die erste Elf
        if (!best || p.ovr > best.ovr) best = p;
      });
      if (best) { used[best.id] = 1; filled[i] = best; }
    });
    var n = 0, sum = 0;
    for (var i = 0; i < 11; i++) if (filled[i]) { n++; sum += filled[i].ovr; }
    var lvl = n < 11 ? FM.clamp((club.str * 11 - sum) / (11 - n), club.str - 9, club.str + 2) : club.str;
    var taken = takenNames(state);
    var big = ['ENG', 'ESP', 'ITA', 'FRA'].indexOf(club.nat) >= 0 || club.str >= 78;
    slots.forEach(function (pos, j) {
      if (filled[j]) return;
      var starter = j < 11;
      var ovr = Math.round(starter ? lvl + R.range(-1.5, 1.5) : club.str - R.range(4, 8));
      FM.euMakePlayer(state, club, { pos: pos, ovr: FM.clamp(ovr, 45, 92), age: starter ? R.int(22, 31) : R.int(18, 33), world: R.chance(big ? 0.4 : 0.15) }, taken);
    });
    club.formation = FM.bestFormation(FM.clubPlayers(state, cid));
    return club;
  };

  /* ---------- Berechnete Partien ---------- */
  function pois(l) { var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R.next(); } while (p > L); return k - 1; }
  /* An der Match-Engine geeicht (gleiche Torschnitte und Siegquoten je Staerkeunterschied, Saettigung ab ~7 Punkten) */
  FM.EU_QUICK = { base: 1.47, k: 0.075, home: 0.5, cap: 7.5 };
  FM.euQuick = function (sh, sa, neutral) {
    var q = FM.EU_QUICK, d = FM.clamp(sh - sa + (neutral ? 0 : q.home), -q.cap, q.cap);
    return [Math.min(9, pois(q.base * Math.exp(q.k * d))), Math.min(9, pois(q.base * Math.exp(-q.k * d)))];
  };

  /* Belastung und Zuschauereinnahmen deutscher Klubs, deren Europapokalspiel nur berechnet wird */
  function quickSide(state, k, cid, home, opp) {
    var club = state.clubs[cid];
    if (!club || club.eu) return;
    var xi = FM.clubPlayers(state, cid).filter(function (p) { return !p.injury; }).sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 11);
    xi.forEach(function (p) { p.fit = Math.max(35, p.fit - R.int(13, 19)); p.minutesRecent += 90; });
    if (home) {
      var att = FM.attendanceFor(state, club, state.clubs[opp] || club, k, null);
      FM.book(club, 'tickets', att * (FM.ticketPrice[club.league] || 15) * FM.EU[k].price);
    }
  }

  /* ---------- Termine ---------- */
  function onOrAfter(iso, wd) { while (D.weekday(iso) !== wd) iso = D.add(iso, 1); return iso; }
  function euroDates(state) {
    var y = state.season.year, busy = {};
    state.calendar.forEach(function (c) { if (c.comp !== 'fr') busy[c.date] = 1; });
    (state.frame.cup || []).forEach(function (d) { busy[d] = 1; });
    var near = function (d) { return busy[D.add(d, -1)] || busy[d] || busy[D.add(d, 1)] || busy[D.add(d, 2)]; };
    var wed = function (m, day, yy) {
      var d = onOrAfter(D.iso(yy || y, m, day), 3);
      for (var i = 0; i < 3 && near(d); i++) d = D.add(d, 7);
      return d;
    };
    var lg = [wed(9, 8), wed(10, 13), wed(10, 20), wed(11, 3), wed(11, 24), wed(12, 8), wed(1, 19, y + 1), wed(1, 26, y + 1)];
    for (var i = 1; i < lg.length; i++) if (D.diff(lg[i - 1], lg[i]) < 7) lg[i] = D.add(lg[i - 1], 7);
    var ko = [[wed(2, 16, y + 1), null], [wed(3, 9, y + 1), null], [wed(4, 6, y + 1), null], [wed(4, 27, y + 1), null]];
    ko.forEach(function (p) { p[1] = D.add(p[0], 7); });
    var fin = state.frame.cup[5];
    var plus = function (arr) { return arr.map(function (d) { return D.add(d, 1); }); };
    var koThu = ko.map(plus);
    return {
      cl: { lg: lg, ko: ko, fin: D.add(fin, 7) },
      el: { lg: plus(lg), ko: koThu, fin: D.add(fin, -3) },
      ecl: { lg: plus(lg.slice(1, 6)).concat([D.add(lg[5], 8)]), ko: koThu, fin: D.add(fin, 4) }
    };
  }

  /* ---------- Teilnehmerfeld (ab der zweiten Saison) ---------- */
  function fallbackQual(state) {
    var t = state.leagues.bl.clubs.slice().sort(function (a, b) { return state.clubs[b].rep - state.clubs[a].rep; });
    return { cl: t.slice(0, 4), el: t.slice(4, 6), ecl: t.slice(6, 7) };
  }

  /* Auslandsvereine nach Staerke und Tagesform auf die drei Wettbewerbe verteilen (Obergrenze je Verband) */
  function pickForeign(state, qual) {
    var out = { cl: [], el: [], ecl: [] }, cnt = { cl: {}, el: {}, ecl: {} };
    var need = {};
    FM.EU_COMPS.forEach(function (k) { need[k] = 36 - qual[k].length; });
    var list = data().clubs.map(function (d) {
      var c = FM.euClub(state, d.id);
      return { id: d.id, nat: d.nat, v: c.str + R.normal(0, 2.2) };
    }).sort(function (a, b) { return b.v - a.v; });
    list.forEach(function (x) {
      for (var i = 0; i < 3; i++) {
        var k = FM.EU_COMPS[i];
        var E = FM.EU[k], cap = E.caps && E.caps[x.nat] != null ? E.caps[x.nat] : E.cap;
        if (out[k].length >= need[k] || (cnt[k][x.nat] || 0) >= cap) continue;
        out[k].push(x.id);
        cnt[k][x.nat] = (cnt[k][x.nat] || 0) + 1;
        return;
      }
    });
    // Feld auffuellen, falls die Obergrenzen zu viele Vereine ausgeschlossen haben
    FM.EU_COMPS.forEach(function (k) {
      list.forEach(function (x) {
        if (out[k].length >= need[k]) return;
        if (out.cl.indexOf(x.id) < 0 && out.el.indexOf(x.id) < 0 && out.ecl.indexOf(x.id) < 0) out[k].push(x.id);
      });
    });
    return out;
  }

  /* Spielplan-Schablone: der Plan 2026/27, auf Topfplaetze umgerechnet */
  var tmpl = {};
  function template(k) {
    if (tmpl[k]) return tmpl[k];
    var d = data(), flat = [].concat.apply([], d.pots[k]), idx = {};
    flat.forEach(function (t, i) { idx[t] = i; });
    tmpl[k] = d.draw[k].map(function (f) { return [idx[f[0]], idx[f[1]], f[2]]; });
    return tmpl[k];
  }

  function natOf(state, id) { var c = state.clubs[id]; return c && c.eu ? c.nat : 'GER'; }

  /* Vereine nach Staerke in Toepfe setzen und innerhalb der Toepfe auf die Schablone losen */
  function drawLeague(state, k, ids) {
    var E = FM.EU[k], size = 36 / E.pots, fx = template(k);
    var seeded = ids.map(function (id) { return { id: id, v: FM.euStr(state, id) + R.normal(0, 1.2) }; })
      .sort(function (a, b) { return b.v - a.v; }).map(function (x) { return x.id; });
    var pots = [];
    for (var p = 0; p < E.pots; p++) pots.push(seeded.slice(p * size, (p + 1) * size));
    // Verstoesse zaehlen: Duelle innerhalb eines Verbands, mehr als zwei Gegner aus einem Verband
    var cost = function (teams) {
      var bad = 0, cnt = {};
      for (var i = 0; i < fx.length; i++) {
        var h = fx[i][0], a = fx[i][1], nh = natOf(state, teams[h]), na = natOf(state, teams[a]);
        if (nh === na) bad += nh === 'GER' ? 1000 : 10;
        var kh = h + '|' + na, ka = a + '|' + nh;
        cnt[kh] = (cnt[kh] || 0) + 1; cnt[ka] = (cnt[ka] || 0) + 1;
        if (cnt[kh] === 3) bad++;
        if (cnt[ka] === 3) bad++;
      }
      return bad;
    };
    var teams = [];
    pots.forEach(function (pot) { teams = teams.concat(R.shuffle(pot.slice())); });
    var bad = cost(teams);
    // Plaetze innerhalb eines Topfs tauschen, solange es die Auslosung regelkonformer macht
    for (var it = 0; it < 2500 && bad > 0; it++) {
      var pot = R.int(0, E.pots - 1), i = pot * size + R.int(0, size - 1), j = pot * size + R.int(0, size - 1);
      if (i === j) continue;
      var t = teams[i]; teams[i] = teams[j]; teams[j] = t;
      var nb = cost(teams);
      if (nb <= bad) bad = nb;
      else { t = teams[i]; teams[i] = teams[j]; teams[j] = t; }
    }
    return { teams: teams, fx: fx, bad: bad };
  }

  /* Erwartete UEFA-Einnahmen einer Saison (Startgeld, Marktwertanteil, durchschnittliche Praemien) –
     Grundlage fuer Budgetplanung und die Kalibrierung der Vermarktung beim Spielstart */
  FM.euExpected = function (k, rank) {
    var E = FM.EU[k];
    if (!E) return 0;
    return E.start + E.value * (36 - (rank || 18)) + E.md * (E.win + E.draw) * 0.45 + E.share * 18 + (E.ko.po + E.ko.r16) * 0.5;
  };
  FM.euExpectedIncome = function (state, cid) {
    var eu = state.eu, k = null;
    if (eu) k = FM.euroCompOf(state, cid);
    else if ((window.FM_DATA || {}).startYear === state.season.year) {
      FM.EU_COMPS.forEach(function (x) { if ([].concat.apply([], data().pots[x] || []).indexOf(cid) >= 0) k = x; });
    }
    if (!k) return 0;
    var teams = eu ? eu.comps[k].teams : [].concat.apply([], data().pots[k]);
    var mine = eu ? FM.euStr(state, cid) : FM.teamStrength(state, cid);
    var rank = 1 + teams.filter(function (id) { return id !== cid && (eu ? FM.euStr(state, id) : (raw(id) || { str: 76 }).str) > mine; }).length;
    return FM.euExpected(k, rank);
  };

  /* ---------- Saisonstart: Auslosung ---------- */
  FM.euroStart = function (state) {
    var d = data(), y = state.season.year;
    if (!d.clubs.length || !d.draw || !d.draw.cl) { state.eu = null; return; }
    var first = y === (window.FM_DATA || {}).startYear;
    var qual = first ? null : state.euQual && state.euQual.year === y ? state.euQual : fallbackQual(state);
    var foreign = first ? null : pickForeign(state, qual);
    var dates = euroDates(state);
    var eu = state.eu = { year: y, comps: {} };
    FM.EU_COMPS.forEach(function (k) {
      var teams, fx;
      if (first) {
        teams = [].concat.apply([], d.pots[k]);
        fx = template(k);
      } else {
        var r = drawLeague(state, k, qual[k].concat(foreign[k]));
        teams = r.teams; fx = r.fx;
      }
      teams.forEach(function (t) { if (!state.clubs[t]) FM.euClub(state, t); });
      var v = VENUES[k][(y - 2026) % VENUES[k].length];
      eu.comps[k] = { teams: teams, fx: fx, res: fx.map(function () { return null; }), fid: {}, dates: dates[k], md: 0, phase: 'league', ko: [], winner: null, venue: v[0], vcap: v[1] };
    });
    FM.euroUserFixtures(state);
    var uc = state.user.club;
    FM.EU_COMPS.forEach(function (k) {
      var c = eu.comps[k], ui = c.teams.indexOf(uc);
      if (ui < 0) return;
      var opp = c.fx.filter(function (f) { return f[0] === ui || f[1] === ui; }).sort(function (a, b) { return a[2] - b[2]; })
        .map(function (f) { return state.clubs[c.teams[f[0] === ui ? f[1] : f[0]]].short + (f[0] === ui ? ' (H)' : ' (A)'); });
      FM.addNews(state, {
        type: 'cup', important: true, title: FM.EU[k].name + ': Auslosung der Ligaphase',
        body: 'Deine Gegner: ' + opp.join(', ') + '. Die ersten acht der Tabelle stehen direkt im Achtelfinale, die Plätze 9 bis 24 spielen Play-offs. ' +
          'Zum ersten Spieltag überweist die UEFA Startgeld und Marktwertanteil.'
      });
    });
  };

  /* Eigene Partien als echte Spiele anlegen (Ligaphase und K.-o.-Runden) */
  FM.euroUserFixtures = function (state) {
    var eu = state.eu, uc = state.user.club;
    if (!eu) return;
    FM.EU_COMPS.forEach(function (k) {
      var c = eu.comps[k], ui = c.teams.indexOf(uc), E = FM.EU[k];
      if (ui < 0) return;
      c.fx.forEach(function (f, i) {
        if (c.res[i] || c.fid[i] || (f[0] !== ui && f[1] !== ui)) return;
        var date = c.dates.lg[f[2] - 1];
        if (date < state.date) return;
        var h = c.teams[f[0]], a = c.teams[f[1]];
        FM.euSquad(state, h === uc ? a : h);
        var fx = FM.newFixture(state, { comp: k, round: f[2], date: date, home: h, away: a, eu: i });
        c.fid[i] = fx.id;
        FM.addCalendar(state, date, k, f[2], [fx.id], E.name + ' – ' + f[2] + '. Spieltag');
      });
      c.ko.forEach(function (rd) {
        rd.ties.forEach(function (t, ti) {
          if (t.w || (t.a !== uc && t.b !== uc) || t.f1 || t.f2) return;
          FM.euSquad(state, t.a === uc ? t.b : t.a);
          if (rd.r === 'f') {
            var ff = FM.newFixture(state, { comp: k, round: 0, date: rd.date, home: t.a, away: t.b, neutral: true, ko: true, euKo: 'f', euTie: ti, venue: c.venue, cap: c.vcap });
            t.f1 = ff.id;
            FM.addCalendar(state, rd.date, k, 0, [ff.id], E.name + ' – Finale');
            return;
          }
          if (!t.r1 && rd.dates[0] >= state.date) {
            var f1 = FM.newFixture(state, { comp: k, round: 0, leg: 1, date: rd.dates[0], home: t.a, away: t.b, euKo: rd.r, euTie: ti });
            t.f1 = f1.id;
            FM.addCalendar(state, rd.dates[0], k, 0, [f1.id], E.name + ' – ' + FM.EU_ROUNDS[rd.r] + ', Hinspiel');
          }
          if (!t.r2 && rd.dates[1] >= state.date) {
            var f2 = FM.newFixture(state, { comp: k, round: 0, leg: 2, date: rd.dates[1], home: t.b, away: t.a, euKo: rd.r, euTie: ti, first: t.f1 || null });
            if (t.r1) f2.agg = [t.r1[1], t.r1[0]];
            t.f2 = f2.id;
            FM.addCalendar(state, rd.dates[1], k, 0, [f2.id], E.name + ' – ' + FM.EU_ROUNDS[rd.r] + ', Rückspiel');
          }
        });
      });
    });
  };

  /* ---------- Tabelle der Ligaphase ---------- */
  FM.euroTable = function (state, k) {
    var c = state.eu && state.eu.comps[k];
    if (!c) return [];
    var rows = c.teams.map(function (id) { return { club: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    c.fx.forEach(function (f, i) {
      var r = c.res[i];
      if (!r) return;
      var h = rows[f[0]], a = rows[f[1]];
      h.p++; a.p++; h.gf += r[0]; h.ga += r[1]; a.gf += r[1]; a.ga += r[0];
      if (r[0] > r[1]) { h.w++; h.pts += 3; a.l++; } else if (r[0] < r[1]) { a.w++; a.pts += 3; h.l++; } else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    rows.forEach(function (r) { r.gd = r.gf - r.ga; });
    rows.sort(function (x, y) { return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || (state.clubs[x.club].name < state.clubs[y.club].name ? -1 : 1); });
    return rows;
  };

  /* In welchem Wettbewerb spielt der Verein (noch)? */
  FM.euroCompOf = function (state, cid) {
    if (!state.eu) return null;
    for (var i = 0; i < 3; i++) if (state.eu.comps[FM.EU_COMPS[i]].teams.indexOf(cid) >= 0) return FM.EU_COMPS[i];
    return null;
  };
  /* Wie weit ist der Verein gekommen? 'league' | 'po' | 'r16' | 'qf' | 'sf' | 'f' | 'w' */
  FM.euroReached = function (state, k, cid) {
    var c = state.eu && state.eu.comps[k], out = 'league';
    if (!c || c.teams.indexOf(cid) < 0) return null;
    c.ko.forEach(function (rd) { if (rd.ties.some(function (t) { return t.a === cid || t.b === cid; })) out = rd.r; });
    return c.winner === cid ? 'w' : out;
  };
  FM.euroDone = function (state) {
    return !state.eu || FM.EU_COMPS.every(function (k) { return state.eu.comps[k].phase === 'done'; });
  };

  function german(state, id) { var c = state.clubs[id]; return c && !c.eu; }
  function pay(state, id, amount) {
    if (!german(state, id) || !amount) return;
    FM.book(state.clubs[id], 'prize', amount);
    var m = state.eu.money = state.eu.money || {};
    m[id] = (m[id] || 0) + amount;
  }
  function sc(state, id) { return state.clubs[id].short; }

  /* Ergebnis eines Ligaphasenspiels festhalten, Praemien buchen */
  function record(state, k, c, i, hg, ag, quick) {
    var f = c.fx[i], h = c.teams[f[0]], a = c.teams[f[1]], E = FM.EU[k];
    c.res[i] = [hg, ag];
    pay(state, h, hg > ag ? E.win : hg === ag ? E.draw : 0);
    pay(state, a, ag > hg ? E.win : hg === ag ? E.draw : 0);
    if (quick) { quickSide(state, k, h, true, a); quickSide(state, k, a, false, h); }
  }

  function startMoney(state, k, c) {
    var E = FM.EU[k], uc = state.user.club;
    var rank = c.teams.slice().sort(function (a, b) { return FM.euStr(state, b) - FM.euStr(state, a); });
    c.teams.forEach(function (id) {
      if (!german(state, id)) return;
      var sum = Math.round(E.start + E.value * (36 - rank.indexOf(id)));
      pay(state, id, sum);
      if (id === uc) FM.addNews(state, { type: 'board', title: E.name + ': UEFA-Startgeld', body: 'Die UEFA überweist ' + FM.fmtMoney(sum) + ' Startgeld und Marktwertanteil. Dazu kommen ' + FM.fmtMoney(E.win) + ' je Sieg und ' + FM.fmtMoney(E.draw) + ' je Remis in der Ligaphase.' });
    });
    c.paid = true;
  }

  function leagueDay(state, k, c, md) {
    var E = FM.EU[k];
    if (!c.paid) startMoney(state, k, c);
    var lines = [];
    c.fx.forEach(function (f, i) {
      if (f[2] !== md) return;
      var h = c.teams[f[0]], a = c.teams[f[1]];
      if (!c.res[i]) {
        var fx = c.fid[i] && state.fixtures[c.fid[i]];
        if (fx && fx.res) record(state, k, c, i, fx.res.hg, fx.res.ag, false);
        else if (fx) return;                                   // eigenes Spiel steht noch aus
        else { var q = c.pre && c.pre[i] ? c.pre[i].r : FM.euQuick(FM.euStr(state, h), FM.euStr(state, a), false); record(state, k, c, i, q[0], q[1], true); }
      }
      if (german(state, h) || german(state, a)) lines.push(sc(state, h) + ' – ' + sc(state, a) + ' ' + c.res[i][0] + ':' + c.res[i][1]);
    });
    c.md = md;
    c.pre = null;
    if (lines.length) FM.addNews(state, { type: 'cup', quiet: true, title: E.name + ', ' + md + '. Spieltag', body: lines.join(' · ') + '.' });
    if (md === E.md) finishLeague(state, k, c);
  }

  function newTie(a, b, g) { return { a: a, b: b, g: g, r1: null, r2: null, w: null, pen: false, f1: null, f2: null }; }

  function finishLeague(state, k, c) {
    var E = FM.EU[k], t = FM.euroTable(state, k), uc = state.user.club;
    c.final = t.map(function (r) { return r.club; });
    t.forEach(function (r, i) { pay(state, r.club, E.share * (36 - i) + (i < 8 ? E.top8 : i < 16 ? E.top16 : 0)); });
    var ties = [];
    [[9, 10, 23, 24], [11, 12, 21, 22], [13, 14, 19, 20], [15, 16, 17, 18]].forEach(function (g, gi) {
      var s = R.shuffle([c.final[g[0] - 1], c.final[g[1] - 1]]), u = R.shuffle([c.final[g[2] - 1], c.final[g[3] - 1]]);
      ties.push(newTie(u[0], s[0], gi), newTie(u[1], s[1], gi));      // der Gesetzte hat im Rueckspiel Heimrecht
    });
    c.phase = 'po';
    c.ko.push({ r: 'po', dates: c.dates.ko[0], ties: ties, done: false });
    ties.forEach(function (x) { pay(state, x.a, E.ko.po); pay(state, x.b, E.ko.po); });
    var ger = c.teams.filter(function (id) { return german(state, id); });
    if (ger.length) {
      var txt = ger.map(function (id) {
        var p = c.final.indexOf(id) + 1;
        return sc(state, id) + ' Platz ' + p + (p <= 8 ? ' (direkt im Achtelfinale)' : p <= 24 ? ' (Play-offs)' : ' (ausgeschieden)');
      }).join(', ');
      FM.addNews(state, { type: 'cup', quiet: ger.indexOf(uc) < 0, important: ger.indexOf(uc) >= 0, title: E.name + ': Ligaphase beendet', body: 'Abschlusstabelle: ' + sc(state, c.final[0]) + ' gewinnt die Ligaphase. ' + txt + '.' });
    }
    FM.euroUserFixtures(state);
    drawNews(state, k, c);
  }

  function drawNews(state, k, c) {
    var rd = c.ko[c.ko.length - 1], uc = state.user.club;
    var mine = rd.ties.filter(function (t) { return t.a === uc || t.b === uc; })[0];
    if (!mine) return;
    var opp = state.clubs[mine.a === uc ? mine.b : mine.a];
    FM.addNews(state, {
      type: 'cup', important: true, title: FM.EU[k].name + ': ' + FM.EU_ROUNDS[rd.r] + ' gegen ' + opp.short,
      body: rd.r === 'f' ? 'Das Finale steigt am ' + D.fmt(rd.date) + ' (' + c.venue + ') gegen ' + opp.name + '.' :
        'Hinspiel am ' + D.fmt(rd.dates[0]) + (mine.a === uc ? ' zuhause' : ' auswärts') + ', Rückspiel am ' + D.fmt(rd.dates[1]) + '. Gegner: ' + opp.name + ' (' + FM.euCountry(opp.nat || 'GER') + ').'
    });
  }

  /* Entscheidung eines berechneten Duells nach Hin- und Rueckspiel */
  function decide(state, t) {
    var a = t.r1[0] + t.r2[1], b = t.r1[1] + t.r2[0];
    if (a !== b) { t.w = a > b ? t.a : t.b; return; }
    t.pen = true;
    t.w = R.chance(FM.clamp(0.53 + (FM.euStr(state, t.b) - FM.euStr(state, t.a)) * 0.012, 0.2, 0.8)) ? t.b : t.a;
  }

  function koDay(state, k, c, rd, date) {
    var E = FM.EU[k];
    if (rd.done) return;
    if (rd.r === 'f') {
      if (date !== rd.date) return;
      var ft = rd.ties[0];
      if (!ft.w) {
        if (ft.f1 && state.fixtures[ft.f1]) return;            // eigenes Finale steht noch aus
        ft.r1 = FM.euQuick(FM.euStr(state, ft.a), FM.euStr(state, ft.b), true);
        quickSide(state, k, ft.a, false, ft.b); quickSide(state, k, ft.b, false, ft.a);
        if (ft.r1[0] !== ft.r1[1]) ft.w = ft.r1[0] > ft.r1[1] ? ft.a : ft.b;
        else { ft.pen = true; ft.w = R.chance(0.5 + (FM.euStr(state, ft.a) - FM.euStr(state, ft.b)) * 0.012) ? ft.a : ft.b; }
      }
      rd.done = true;
      finishComp(state, k, c, ft);
      return;
    }
    var leg = date === rd.dates[0] ? 1 : date === rd.dates[1] ? 2 : 0;
    if (!leg) return;
    rd.ties.forEach(function (t) {
      if (leg === 1 && !t.r1 && !(t.f1 && state.fixtures[t.f1])) {
        t.r1 = t.p1 ? t.p1.r : FM.euQuick(FM.euStr(state, t.a), FM.euStr(state, t.b), false);
        delete t.p1;
        quickSide(state, k, t.a, true, t.b); quickSide(state, k, t.b, false, t.a);
      }
      if (leg === 2 && !t.r2 && !(t.f2 && state.fixtures[t.f2])) {
        if (!t.r1) t.r1 = FM.euQuick(FM.euStr(state, t.a), FM.euStr(state, t.b), false);
        t.r2 = t.p2 ? t.p2.r : FM.euQuick(FM.euStr(state, t.b), FM.euStr(state, t.a), false);
        delete t.p2;
        quickSide(state, k, t.b, true, t.a); quickSide(state, k, t.a, false, t.b);
        decide(state, t);
      }
    });
    if (leg !== 2 || !rd.ties.every(function (t) { return t.w; })) return;
    rd.done = true;
    var lines = rd.ties.filter(function (t) { return german(state, t.a) || german(state, t.b); }).map(function (t) {
      return sc(state, t.a) + ' – ' + sc(state, t.b) + ' ' + t.r1[0] + ':' + t.r1[1] + ' und ' + t.r2[1] + ':' + t.r2[0] + (t.pen ? ' n. E.' : '') + ' → ' + sc(state, t.w) + ' weiter';
    });
    if (lines.length) FM.addNews(state, { type: 'cup', quiet: true, title: E.name + ': ' + FM.EU_ROUNDS[rd.r], body: lines.join(' · ') + '.' });
    nextRound(state, k, c, rd);
  }

  function nextRound(state, k, c, rd) {
    var E = FM.EU[k], nr = NEXT[rd.r], ties = [];
    var w = rd.ties.map(function (t) { return t.w; });
    if (rd.r === 'po') {
      // Gruppe 3 (Plaetze 15–18) trifft auf die Ersten und Zweiten der Ligaphase usw.
      [[7, 8], [5, 6], [3, 4], [1, 2]].forEach(function (seed, gi) {
        var s = R.shuffle([c.final[seed[0] - 1], c.final[seed[1] - 1]]);
        var u = R.shuffle(rd.ties.filter(function (t) { return t.g === gi; }).map(function (t) { return t.w; }));
        ties.push(newTie(u[0], s[0], gi), newTie(u[1], s[1], gi));
      });
    } else {
      R.shuffle(w);
      for (var i = 0; i + 1 < w.length; i += 2) ties.push(newTie(w[i], w[i + 1], 0));
    }
    var next = { r: nr, ties: ties, done: false };
    if (nr === 'f') next.date = c.dates.fin;
    else next.dates = c.dates.ko[{ r16: 1, qf: 2, sf: 3 }[nr]];
    c.phase = nr;
    c.ko.push(next);
    ties.forEach(function (t) { pay(state, t.a, E.ko[nr]); pay(state, t.b, E.ko[nr]); });
    FM.euroUserFixtures(state);
    drawNews(state, k, c);
  }

  function finishComp(state, k, c, t) {
    var E = FM.EU[k], uc = state.user.club, wc = state.clubs[t.w], lc = state.clubs[t.w === t.a ? t.b : t.a];
    c.winner = t.w;
    c.phase = 'done';
    pay(state, t.w, E.ko.w);
    FM.addNews(state, {
      type: 'cup', important: german(state, t.w) || german(state, lc.id), quiet: !german(state, t.w) && !german(state, lc.id) && uc !== t.w,
      title: wc.name + ' gewinnt die ' + E.name,
      body: 'Finale in ' + c.venue.split(', ').pop() + ': ' + wc.short + ' – ' + lc.short + ' ' + (t.w === t.a ? t.r1[0] + ':' + t.r1[1] : t.r1[1] + ':' + t.r1[0]) + (t.pen ? ' nach Elfmeterschießen' : '') + '.'
    });
  }

  /* Konferenz: die uebrigen Partien des Abends vorab berechnen (Ergebnis und Torminuten), damit sie
     waehrend des eigenen Spiels mitlaufen. Die Ergebnisse gelten danach unveraendert. */
  function goalMinutes(q) {
    var g = [];
    for (var s = 0; s < 2; s++) for (var i = 0; i < q[s]; i++) g.push([R.int(1, 90), s]);
    return g.sort(function (a, b) { return a[0] - b[0]; });
  }
  FM.euroLive = function (state, fx) {
    var c = state.eu && state.eu.comps[fx.comp], out = [];
    if (!c) return out;
    if (!fx.euKo) {
      c.pre = c.pre || {};
      c.fx.forEach(function (f, i) {
        if (f[2] !== fx.round || c.res[i] || c.fid[i]) return;
        var h = c.teams[f[0]], a = c.teams[f[1]];
        if (!c.pre[i]) { var q = FM.euQuick(FM.euStr(state, h), FM.euStr(state, a), false); c.pre[i] = { r: q, g: goalMinutes(q) }; }
        out.push({ h: h, a: a, r: c.pre[i].r, g: c.pre[i].g });
      });
    } else if (fx.euKo !== 'f') {
      var rd = c.ko.filter(function (x) { return x.r === fx.euKo; })[0], second = fx.leg === 2, key = second ? 'p2' : 'p1';
      if (rd) rd.ties.forEach(function (t) {
        if (t.f1 || t.f2 || (second ? t.r2 : t.r1)) return;
        var h = second ? t.b : t.a, a = second ? t.a : t.b;
        if (!t[key]) { var q = FM.euQuick(FM.euStr(state, h), FM.euStr(state, a), false); t[key] = { r: q, g: goalMinutes(q) }; }
        out.push({ h: h, a: a, r: t[key].r, g: t[key].g, first: second && t.r1 ? [t.r1[1], t.r1[0]] : null });
      });
    }
    // deutsche Klubs zuerst, danach die Spitzenspiele
    var w = function (x) { return (german(state, x.h) || german(state, x.a) ? 100 : 0) + FM.euStr(state, x.h) + FM.euStr(state, x.a); };
    return out.sort(function (x, y) { return w(y) - w(x); });
  };

  /* ---------- Tagesverarbeitung ---------- */
  FM.euroAfterDate = function (state, date) {
    var eu = state.eu;
    if (!eu) return;
    FM.EU_COMPS.forEach(function (k) {
      var c = eu.comps[k];
      if (c.phase === 'done') return;
      if (c.phase === 'league') {
        if (c.md < FM.EU[k].md && c.dates.lg[c.md] === date) leagueDay(state, k, c, c.md + 1);
      } else koDay(state, k, c, c.ko[c.ko.length - 1], date);
    });
  };

  /* Ergebnis eines gespielten Europapokalspiels (eigener Verein) uebernehmen */
  FM.euroApplyResult = function (state, fx, res) {
    var c = state.eu && state.eu.comps[fx.comp];
    if (!c) return;
    if (!fx.euKo) { if (fx.eu != null && !c.res[fx.eu]) record(state, fx.comp, c, fx.eu, res.hg, res.ag, false); return; }
    var rd = c.ko.filter(function (x) { return x.r === fx.euKo; })[0], t = rd && rd.ties[fx.euTie];
    if (!t) return;
    if (rd.r === 'f' || fx.leg !== 2) t.r1 = [res.hg, res.ag];
    else t.r2 = [res.hg, res.ag];
    if (rd.r === 'f' || fx.leg === 2) { t.w = FM.fixtureWinner(fx); t.pen = !!res.pen; }
  };

  /* Spieltage/Runden eines Wettbewerbs fuer die Anzeige: [{label, date, games: [{h, a, r, note}]}] */
  FM.euroRounds = function (state, k) {
    var c = state.eu && state.eu.comps[k], out = [];
    if (!c) return out;
    for (var md = 1; md <= FM.EU[k].md; md++) {
      var games = [];
      c.fx.forEach(function (f, i) { if (f[2] === md) games.push({ h: c.teams[f[0]], a: c.teams[f[1]], r: c.res[i], fid: c.fid[i] || null }); });
      out.push({ key: 'md' + md, label: md + '. Spieltag', date: c.dates.lg[md - 1], games: games });
    }
    c.ko.forEach(function (rd) {
      if (rd.r === 'f') {
        var t = rd.ties[0];
        out.push({ key: 'f', label: 'Finale · ' + c.venue, date: rd.date, games: [{ h: t.a, a: t.b, r: t.r1, w: t.w, pen: t.pen, fid: t.f1 }] });
        return;
      }
      out.push({ key: rd.r + '1', label: FM.EU_ROUNDS[rd.r] + ' · Hinspiele', date: rd.dates[0], games: rd.ties.map(function (t) { return { h: t.a, a: t.b, r: t.r1, fid: t.f1 }; }) });
      out.push({ key: rd.r + '2', label: FM.EU_ROUNDS[rd.r] + ' · Rückspiele', date: rd.dates[1], games: rd.ties.map(function (t) { return { h: t.b, a: t.a, r: t.r2, w: t.w, pen: t.pen, fid: t.f2 }; }) });
    });
    return out;
  };

  /* ---------- Saisonende: Qualifikation, Reputation, Staerkeentwicklung im Ausland ---------- */
  FM.euroSeasonEnd = function (state, summary, tBL) {
    var y = state.season.year, eu = state.eu, ids = tBL.map(function (r) { return r.club; });
    var cupW = state.cup && state.cup.winner;
    var cl = ids.slice(0, 4), rest = ids.slice(4), el = [rest.shift()];
    if (cupW && state.clubs[cupW] && !state.clubs[cupW].guest && cl.indexOf(cupW) < 0 && el.indexOf(cupW) < 0) el.push(cupW);
    else el.push(rest.shift());
    rest = rest.filter(function (x) { return el.indexOf(x) < 0; });
    var ecl = [rest.shift()];
    if (eu && eu.year === y) {
      summary.awards.eu = {};
      FM.EU_COMPS.forEach(function (k) {
        var c = eu.comps[k], w = c.winner;
        summary.awards.eu[k] = w ? { club: w, name: state.clubs[w].name } : null;
        // Titelverteidiger und Europa-League-Sieger spielen in der Champions League
        if (w && german(state, w) && k !== 'ecl' && cl.indexOf(w) < 0) {
          cl.push(w);
          el = el.filter(function (x) { return x !== w; });
          ecl = ecl.filter(function (x) { return x !== w; });
        }
        c.teams.forEach(function (id) {
          if (!german(state, id)) return;
          var reach = FM.euroReached(state, k, id), club = state.clubs[id];
          var add = reach === 'w' ? (k === 'cl' ? 4 : 3) : reach === 'f' ? 2 : (reach === 'sf' || reach === 'qf') && k !== 'ecl' ? 1 : reach === 'r16' && k === 'cl' ? 1 : 0;
          club.rep = Math.min(99, club.rep + add);
        });
      });
    }
    state.euQual = { year: y + 1, cl: cl, el: el, ecl: ecl };
    // Auslandsvereine: Staerke schwankt um den Ausgangswert
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid], d = c.eu ? raw(cid) : null;
      if (!d) return;
      c.str = FM.round1(FM.clamp(c.str + (d.str - c.str) * 0.2 + R.normal(0, 0.7), d.str - 4, d.str + 4));
      c.rep = repOf(c.str);
    });
    return state.euQual;
  };
})();
