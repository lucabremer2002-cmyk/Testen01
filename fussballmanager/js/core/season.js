/* Saisonablauf: Tage fortschreiben, Spiele austragen, Tabellen, Saisonende. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  var INJURIES = [
    ['Prellung', 3, 8], ['Muskuläre Probleme', 4, 10], ['Zerrung', 7, 18], ['Bänderdehnung', 10, 24],
    ['Muskelfaserriss', 18, 35], ['Sprunggelenksverletzung', 20, 45], ['Innenbandriss', 35, 70],
    ['Mittelfußbruch', 50, 90], ['Meniskusriss', 45, 100], ['Kreuzbandriss', 180, 260]
  ];
  var INJ_W = [22, 20, 18, 12, 10, 7, 5, 3, 2, 1];

  FM.TRAINING = {
    balanced: { label: 'Ausgewogen', regen: 1, dev: 1, form: 0, inj: 1 },
    fitness: { label: 'Kondition', regen: 1.15, dev: 0.95, form: 0, inj: 1.05 },
    tactics: { label: 'Taktik', regen: 1, dev: 0.95, form: 0.25, inj: 0.95 },
    technique: { label: 'Technik', regen: 0.95, dev: 1.15, form: 0, inj: 1 },
    recovery: { label: 'Regeneration', regen: 1.45, dev: 0.8, form: 0.05, inj: 0.7 }
  };
  FM.INTENSITY = [
    { label: 'Leicht', regen: 1.25, dev: 0.8, inj: 0.7 },
    { label: 'Normal', regen: 1, dev: 1, inj: 1 },
    { label: 'Hart', regen: 0.78, dev: 1.22, inj: 1.45 }
  ];

  /* ---------- Tabellen ---------- */
  var tableCache = {};
  FM.invalidateTables = function () { tableCache = {}; };

  FM.table = function (state, lid, opts) {
    opts = opts || {};
    var key = lid + '|' + (opts.upTo || '') + '|' + (opts.mode || '');
    if (!opts.noCache && tableCache[key]) return tableCache[key];
    var rows = {};
    state.leagues[lid].clubs.forEach(function (cid) {
      rows[cid] = { club: cid, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });
    var fxs = [];
    Object.keys(state.fixtures).forEach(function (fid) {
      var f = state.fixtures[fid];
      if (f.comp !== lid || !f.res) return;
      if (opts.upTo && f.round > opts.upTo) return;
      fxs.push(f);
    });
    fxs.sort(function (a, b) { return a.round - b.round; });
    fxs.forEach(function (f) {
      var h = rows[f.home], a = rows[f.away];
      if (!h || !a) return;
      var hg = f.res.hg, ag = f.res.ag;
      if (opts.mode !== 'away') { h.p++; h.gf += hg; h.ga += ag; }
      if (opts.mode !== 'home') { a.p++; a.gf += ag; a.ga += hg; }
      var hr = hg > ag ? 'S' : hg === ag ? 'U' : 'N', ar = hg > ag ? 'N' : hg === ag ? 'U' : 'S';
      if (opts.mode !== 'away') { if (hr === 'S') { h.w++; h.pts += 3; } else if (hr === 'U') { h.d++; h.pts++; } else h.l++; h.form.push(hr); }
      if (opts.mode !== 'home') { if (ar === 'S') { a.w++; a.pts += 3; } else if (ar === 'U') { a.d++; a.pts++; } else a.l++; a.form.push(ar); }
    });
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.gd = r.gf - r.ga; r.form = r.form.slice(-5); return r; });
    list.sort(function (x, y) {
      return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || (state.clubs[x.club].name < state.clubs[y.club].name ? -1 : 1);
    });
    if (!opts.noCache) tableCache[key] = list;
    return list;
  };

  FM.ZONES = {
    bl: function (pos) { return pos <= 4 ? 'cl' : pos === 5 ? 'el' : pos === 6 ? 'ecl' : pos === 16 ? 'po' : pos >= 17 ? 'down' : ''; },
    bl2: function (pos) { return pos <= 2 ? 'up' : pos === 3 ? 'poUp' : pos === 16 ? 'po' : pos >= 17 ? 'down' : ''; },
    l3: function (pos) { return pos <= 2 ? 'up' : pos === 3 ? 'poUp' : pos >= 17 ? 'down' : ''; }
  };
  FM.ZONE_LABEL = {
    cl: 'Champions League', el: 'Europa League', ecl: 'Conference League', po: 'Relegation', down: 'Abstieg',
    up: 'Aufstieg', poUp: 'Relegation (Aufstieg)'
  };

  FM.clubPosition = function (state, cid) {
    var lid = state.clubs[cid].league;
    if (!FM.ZONES[lid]) return null;
    var t = FM.table(state, lid);
    return t.findIndex(function (r) { return r.club === cid; }) + 1;
  };

  /* ---------- Saisonstart ---------- */
  FM.startSeason = function (state, first) {
    state.season.phase = 'pre';
    state.calendar = [];
    state.fixtures = {};
    state.playoffs = {};
    state.cup = null;
    state.seasonDone = false;
    state.leagueDone = {};
    FM.invalidateTables();
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!first) { c.finPrev = c.fin; c.fin = FM.emptyLedger(); }
      c.formation = c.id === state.user.club ? c.formation : FM.bestFormation(FM.clubPlayers(state, cid), c.formation);
    });
    Object.keys(state.players).forEach(function (pid) { state.players[pid].ovr0 = state.players[pid].ovr; });
    FM.buildLeagueSchedules(state);
    FM.drawCupRound1(state);
    FM.computeExpectations(state);
    if (!first) {
      FM.addNews(state, {
        type: 'board', title: 'Saison ' + state.season.year + '/' + String(state.season.year + 1).slice(2) + ' – die Ziele',
        body: 'Der Vorstand hat die Erwartungen festgelegt. ' + FM.expectationText(state, state.user.club) + ' Das Transferfenster ist geöffnet.'
      });
    }
    var uf = Object.keys(state.fixtures).map(function (k) { return state.fixtures[k]; })
      .filter(function (f) { return f.comp === 'cup' && (f.home === state.user.club || f.away === state.user.club); })[0];
    if (uf) {
      var opp = uf.home === state.user.club ? uf.away : uf.home;
      FM.addNews(state, { type: 'cup', title: 'DFB-Pokal: Los gezogen', body: '1. Runde am ' + D.fmt(uf.date) + ': ' + state.clubs[uf.home].name + ' – ' + state.clubs[uf.away].name + '.' });
    } else if (state.cup && state.cup.byes.indexOf(state.user.club) >= 0) {
      FM.addNews(state, { type: 'cup', title: 'DFB-Pokal: Freilos', body: 'Dein Team steigt erst in der 2. Runde in den DFB-Pokal ein.' });
    }
  };

  /* ---------- Hilfen ---------- */
  FM.fixturesOn = function (state, date) {
    var out = [];
    state.calendar.forEach(function (c) {
      if (c.date !== date) return;
      c.fx.forEach(function (fid) { out.push(state.fixtures[fid]); });
    });
    return out;
  };

  FM.userFixture = function (state, date) {
    var uc = state.user.club;
    return FM.fixturesOn(state, date || state.date).filter(function (f) { return !f.res && (f.home === uc || f.away === uc); })[0] || null;
  };

  FM.nextUserFixture = function (state) {
    var uc = state.user.club, best = null;
    Object.keys(state.fixtures).forEach(function (k) {
      var f = state.fixtures[k];
      if (f.res || (f.home !== uc && f.away !== uc)) return;
      if (!best || f.date < best.date) best = f;
    });
    return best;
  };

  FM.userFixtures = function (state) {
    var uc = state.user.club;
    return Object.keys(state.fixtures).map(function (k) { return state.fixtures[k]; })
      .filter(function (f) { return f.home === uc || f.away === uc; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  };

  function expectedPoints(state, fx) {
    var sh = FM.teamStrength(state, fx.home) + 1.7, sa = FM.teamStrength(state, fx.away);
    var d = (sh - sa);
    var pw = 1 / (1 + Math.exp(-d / 4.2)) * 0.78 + 0.05;
    var pd = 0.27 - Math.min(0.12, Math.abs(d) * 0.012);
    var pl = Math.max(0.02, 1 - pw - pd);
    var hp = pw * 3 + pd, ap = pl * 3 + pd;
    return { home: hp, away: ap };
  }
  FM.expectedPoints = expectedPoints;

  /* ---------- Match vorbereiten / austragen ---------- */
  FM.createMatch = function (state, fx) {
    var uc = state.user.club;
    FM.matchComp = fx.comp === 'cup' ? 'cup' : 'league';
    var home = fx.home === uc ? FM.userLineup(state) : FM.aiLineup(state, fx.home);
    var away = fx.away === uc ? FM.userLineup(state) : FM.aiLineup(state, fx.away);
    FM.matchComp = null;
    var opts = { neutral: !!fx.neutral };
    if (fx.comp === 'cup' || fx.comp === 'po1' || fx.comp === 'po2') opts.knockout = fx.comp === 'cup' || fx.leg === 2;
    if (fx.leg === 2 && fx.agg) opts.agg = fx.agg;
    if (fx.home === uc || fx.away === uc) {
      var ep = expectedPoints(state, fx);
      fx.expPts = fx.home === uc ? ep.home : ep.away;
    }
    return new FM.Match(state.players, home, away, opts);
  };

  FM.simulateFixture = function (state, fx) {
    var m = FM.createMatch(state, fx);
    m.runToEnd();
    var isUser = fx.home === state.user.club || fx.away === state.user.club;
    FM.applyResult(state, fx, m.result(!isUser));
    return m;
  };

  function pickInjury() {
    var t = R.weighted(INJURIES, function (x, i) { return INJ_W[i]; });
    return { type: t[0], days: R.int(t[1], t[2]) };
  }

  FM.applyResult = function (state, fx, res) {
    fx.res = res;
    FM.invalidateTables();
    var uc = state.user.club;
    var isUser = fx.home === uc || fx.away === uc;
    var league = fx.comp === 'bl' || fx.comp === 'bl2' || fx.comp === 'l3';
    var sides = [fx.home, fx.away];

    // Zuschauer & Einnahmen
    var att = FM.attendance(state, fx.home, fx.away, fx.comp);
    res.att = att;
    if (!fx.neutral) {
      var price = FM.ticketPrice[state.clubs[fx.home].league] || 15;
      FM.book(state.clubs[fx.home], 'tickets', att * price);
    } else {
      var share = att * 45 / 2;
      FM.book(state.clubs[fx.home], 'tickets', share);
      FM.book(state.clubs[fx.away], 'tickets', share);
    }

    // Spielerwerte
    Object.keys(res.pl).forEach(function (pid) {
      var p = state.players[pid], r = res.pl[pid];
      if (!p) return;
      var mins = r.mi || 0;
      p.minutesRecent += mins;
      p.fit = FM.clamp(r.fit != null ? r.fit : p.fit, 25, 100);
      if (league) {
        var s = p.st;
        s.apps++; if (r.st) s.starts++;
        s.mins += mins; s.goals += r.gl; s.assists += r.as;
        if (r.g != null) { s.gsum += r.g; s.gn++; }
        if (r.yc) s.yc++;
        if (r.rc) s.rc++;
        if (res.motm === pid) s.motm++;
        if (FM.isGK(p) && mins >= 60 && ((r.s === 0 && res.ag === 0) || (r.s === 1 && res.hg === 0))) s.cs++;
        if (r.yc && !r.rc) {
          p.yel++;
          if (p.yel === 5 || p.yel === 10 || p.yel === 15) p.susp += 1;
        }
        if (r.rc) p.susp += r.yc >= 2 ? 1 : R.int(2, 3);
      } else {
        p.cst.apps++; p.cst.goals += r.gl;
        if (r.rc) p.suspCup = (p.suspCup || 0) + 1;
      }
      if (r.g != null) p.form = FM.clamp(p.form * 0.7 + (3.5 - r.g) * 0.55, -3, 3);
      var gd = r.s === 0 ? res.hg - res.ag : res.ag - res.hg;
      p.mor = FM.clamp(p.mor + (gd > 0 ? 3 : gd < 0 ? -3 : 0) + (r.st ? 1 : 0), 5, 100);
      if (r.inj) {
        var inj = pickInjury();
        p.injury = inj;
        if (p.club === uc) FM.addNews(state, { type: 'injury', title: p.name + ' verletzt', body: p.name + ' fällt mit ' + inj.type + ' voraussichtlich ' + FM.injuryDuration(inj.days) + ' aus.', important: inj.days > 14 });
      }
    });
    // Sperren abbauen (nur Spieler, die in diesem Wettbewerb gesperrt waren und nicht gespielt haben)
    sides.forEach(function (cid) {
      FM.clubPlayers(state, cid).forEach(function (p) {
        if (res.pl[p.id]) return;
        if (league && p.susp > 0) p.susp--;
        if (!league && p.suspCup > 0) p.suspCup--;
      });
    });

    // Pokalpraemien
    if (fx.comp === 'cup') {
      var w = FM.fixtureWinner(fx);
      if (w) FM.book(state.clubs[w], 'prize', FM.CUP_PRIZE[Math.min(fx.round, 5)] || 0);
    }

    // Relegation: Hinspiel -> Rueckspiel vorbereiten
    if (fx.leg === 1) {
      var second = Object.keys(state.fixtures).map(function (k) { return state.fixtures[k]; }).filter(function (f) { return f.first === fx.id; })[0];
      if (second) second.agg = [res.ag, res.hg];
    }

    if (!isUser) delete res.pl;
    if (isUser) {
      var userSide = fx.home === uc ? 0 : 1;
      FM.boardAfterMatch(state, fx, res, userSide);
      FM.addNews(state, FM.matchReportNews(state, fx, res, userSide));
    }
  };

  FM.injuryDuration = function (days) {
    if (days <= 6) return days + ' Tage';
    if (days <= 13) return 'etwa eine Woche';
    if (days <= 45) return 'etwa ' + Math.round(days / 7) + ' Wochen';
    return 'etwa ' + Math.round(days / 30) + ' Monate';
  };

  FM.scoreText = function (fx) {
    if (!fx.res) return '– : –';
    var r = fx.res, s = r.hg + ':' + r.ag;
    if (r.pen) s += ' i.E. (' + r.pen[0] + ':' + r.pen[1] + ')';
    else if (r.aet) s += ' n.V.';
    return s;
  };

  FM.matchReportNews = function (state, fx, res, userSide) {
    var uc = state.user.club, opp = userSide === 0 ? fx.away : fx.home;
    var gf = userSide === 0 ? res.hg : res.ag, ga = userSide === 0 ? res.ag : res.hg;
    var winner = FM.fixtureWinner(fx);
    var outcome = gf > ga ? 'Sieg' : gf < ga ? 'Niederlage' : 'Remis';
    if (res.pen) outcome = winner === uc ? 'Weiter im Elfmeterschießen' : 'Aus im Elfmeterschießen';
    var scorers = res.ev.filter(function (e) { return e.t === 'goal' && e.s === userSide; }).map(function (e) {
      var p = state.players[e.p]; return (p ? p.name.split(' ').slice(-1)[0] : '?') + ' ' + e.m + '.' + (e.og ? ' (ET)' : e.pen ? ' (FE)' : '');
    });
    var comp = fx.comp === 'cup' ? 'DFB-Pokal, ' + FM.CUP_ROUNDS[fx.round - 1] : fx.comp === 'po1' || fx.comp === 'po2' ? 'Relegation' : FM.COMP_NAME[fx.comp] + ', ' + fx.round + '. Spieltag';
    var motm = res.motm && state.players[res.motm] ? state.players[res.motm].name : null;
    return {
      type: 'match', quiet: true, title: outcome + ': ' + state.clubs[fx.home].short + ' ' + FM.scoreText(fx) + ' ' + state.clubs[fx.away].short,
      body: comp + ' gegen ' + state.clubs[opp].name + '. ' + (scorers.length ? 'Tore: ' + scorers.join(', ') + '. ' : '') +
        (motm ? 'Spieler des Spiels: ' + motm + '. ' : '') + FM.fmtInt(res.att) + ' Zuschauer.',
      ref: fx.id
    };
  };

  /* ---------- Tagesverarbeitung ---------- */
  function dailyTick(state) {
    var tr = FM.TRAINING[state.training.focus] || FM.TRAINING.balanced;
    var it = FM.INTENSITY[state.training.intensity] || FM.INTENSITY[1];
    var uc = state.user.club;
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!p.club) return;
      var isUser = p.club === uc;
      var regen = isUser ? tr.regen * it.regen : 1.05;
      p.fit = Math.min(100, p.fit + 5.5 * regen * (p.age >= 32 ? 0.85 : 1));
      if (p.injury) {
        p.injury.days--;
        if (p.injury.days <= 0) {
          p.injury = null; p.fit = Math.min(p.fit, 80);
          if (isUser) FM.addNews(state, { type: 'injury', title: p.name + ' ist wieder fit', body: p.name + ' hat seine Verletzung auskuriert und steht wieder zur Verfügung.' });
        }
      } else if (isUser) {
        // Trainingsverletzungen (selten)
        if (R.chance(0.00035 * tr.inj * it.inj)) {
          var inj = pickInjury(); inj.days = Math.min(inj.days, 21);
          p.injury = inj;
          FM.addNews(state, { type: 'injury', title: 'Trainingsverletzung: ' + p.name, body: p.name + ' hat sich im Training verletzt (' + inj.type + ') und fällt ' + FM.injuryDuration(inj.days) + ' aus.' });
        }
      }
    });
  }

  function weeklyTick(state) {
    var tr = FM.TRAINING[state.training.focus] || FM.TRAINING.balanced;
    var it = FM.INTENSITY[state.training.intensity] || FM.INTENSITY[1];
    var uc = state.user.club;
    var changes = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!p.club) { p.fit = 100; return; }
      var isUser = p.club === uc;
      var f = isUser ? tr.dev * it.dev : 1;
      var d = FM.developWeekly(p, f);
      if (isUser && d) changes.push({ p: p, d: d });
      p.minutesRecent = Math.round(p.minutesRecent * 0.5);
      p.form *= 0.85;
      if (isUser && tr.form) p.form = FM.clamp(p.form + tr.form * 0.4, -3, 3);
      // Moral: Reservisten werden unzufrieden
      if (p.minutesRecent < 30 && p.age > 21) p.mor = Math.max(5, p.mor - 0.8);
      else p.mor = p.mor + (70 - p.mor) * 0.06;
    });
    FM.payWeekly(state);
    var ucl = state.clubs[uc];
    ucl.bal = ucl.bal || [];
    ucl.bal.push([state.date, Math.round(ucl.money)]);
    if (ucl.bal.length > 160) ucl.bal.shift();
    if (changes.length) {
      var ups = changes.filter(function (c) { return c.d > 0; }).map(function (c) { return c.p.name + ' (' + c.p.ovr + ')'; });
      var downs = changes.filter(function (c) { return c.d < 0; }).map(function (c) { return c.p.name + ' (' + c.p.ovr + ')'; });
      if (ups.length || downs.length) {
        FM.addNews(state, {
          type: 'training', quiet: true, title: 'Trainingsbericht',
          body: (ups.length ? 'Verbessert: ' + ups.join(', ') + '. ' : '') + (downs.length ? 'Nachgelassen: ' + downs.join(', ') + '.' : '')
        });
      }
    }
  }

  function windowEvents(state) {
    var d = state.date, m = D.month(d), day = +d.slice(8, 10);
    if (FM.isWindowOpen(state)) {
      if (day % 3 === 0) FM.aiTransferRound(state, m === 1 ? 3 : 4);
      FM.generateOffersForUser(state);
    }
    if (m === 9 && day === 1) FM.addNews(state, { type: 'market', title: 'Transferfenster geschlossen', body: 'Das Sommer-Transferfenster ist geschlossen. Vereinslose Spieler können weiterhin verpflichtet werden.' });
    if (m === 1 && day === 1) FM.addNews(state, { type: 'market', title: 'Wintertransferfenster geöffnet', body: 'Bis zum 31. Januar kannst du Spieler kaufen und verkaufen.', important: false });
    if (m === 2 && day === 1) FM.addNews(state, { type: 'market', title: 'Transferfenster geschlossen', body: 'Das Wintertransferfenster ist geschlossen.' });
    if (m === 4 && day === 1) {
      var exp = FM.clubPlayers(state, state.user.club).filter(function (p) { return p.contract.until <= state.season.year + 1; });
      if (exp.length) FM.addNews(state, { type: 'board', important: true, title: 'Auslaufende Verträge', body: 'Folgende Verträge enden zum Saisonende: ' + exp.map(function (p) { return p.name; }).join(', ') + '. Verlängere rechtzeitig, sonst gehen die Spieler ablösefrei.' });
    }
  }

  /* Nach einem Spieltag: Liga beendet? Pokalrunde komplett? */
  function postDate(state, date) {
    // Pokal
    if (state.cup && !state.cup.winner) {
      var cr = state.cup.rounds[state.cup.round - 1];
      if (cr && cr.date === date && cr.fx.every(function (fid) { return state.fixtures[fid].res; })) {
        var fids = FM.drawNextCupRound(state);
        var uc = state.user.club;
        if (state.cup.winner) {
          var wc = state.clubs[state.cup.winner];
          FM.addNews(state, { type: 'cup', important: state.cup.winner === uc, title: wc.name + ' gewinnt den DFB-Pokal', body: wc.name + ' ist DFB-Pokalsieger ' + (state.season.year + 1) + '.' });
        } else if (fids) {
          var mine = fids.map(function (id) { return state.fixtures[id]; }).filter(function (f) { return f.home === uc || f.away === uc; })[0];
          if (mine) FM.addNews(state, { type: 'cup', title: 'DFB-Pokal: ' + FM.CUP_ROUNDS[state.cup.round - 1] + ' ausgelost', body: state.clubs[mine.home].name + ' – ' + state.clubs[mine.away].name + ' am ' + D.fmt(mine.date) + (mine.neutral ? ' (Olympiastadion Berlin)' : '') + '.' });
        }
      }
    }
    // Ligen abgeschlossen -> Relegation ansetzen
    ['bl', 'bl2', 'l3'].forEach(function (lid) {
      if (state.leagueDone[lid]) return;
      var all = Object.keys(state.fixtures).map(function (k) { return state.fixtures[k]; }).filter(function (f) { return f.comp === lid; });
      if (all.length && all.every(function (f) { return f.res; })) {
        state.leagueDone[lid] = true;
        var t = FM.table(state, lid);
        var champ = state.clubs[t[0].club];
        FM.addNews(state, { type: 'league', quiet: lid !== state.clubs[state.user.club].league, important: t[0].club === state.user.club, title: champ.name + ' ist Meister der ' + FM.COMP_NAME[lid], body: 'Die Saison in der ' + FM.COMP_NAME[lid] + ' ist beendet.' });
      }
    });
    if (state.leagueDone.bl && state.leagueDone.bl2 && !state.playoffs.po1) {
      var tb = FM.table(state, 'bl'), t2 = FM.table(state, 'bl2');
      var up = eligibleUp(state, t2, 3);
      FM.createPlayoff(state, 'po1', tb[15].club, up);
      notePlayoff(state, 'po1');
    }
    if (state.leagueDone.bl2 && state.leagueDone.l3 && !state.playoffs.po2) {
      var u2 = FM.table(state, 'bl2'), u3 = FM.table(state, 'l3');
      FM.createPlayoff(state, 'po2', u2[15].club, eligibleUp(state, u3, 3));
      notePlayoff(state, 'po2');
    }
  }

  function notePlayoff(state, comp) {
    var po = state.playoffs[comp], uc = state.user.club;
    if (po.upper === uc || po.lower === uc) {
      FM.addNews(state, { type: 'league', important: true, title: 'Relegation!', body: state.clubs[po.upper].name + ' trifft in der Relegation auf ' + state.clubs[po.lower].name + '. Hin- und Rückspiel entscheiden über die Ligazugehörigkeit.' });
    }
  }

  /* n-ter aufstiegsberechtigter Verein (Reserveteams duerfen nicht aufsteigen) */
  function eligibleUp(state, table, n) {
    var k = 0;
    for (var i = 0; i < table.length; i++) {
      if (state.clubs[table[i].club].reserve) continue;
      k++;
      if (k === n) return table[i].club;
    }
    return table[n - 1].club;
  }
  FM.eligibleUp = eligibleUp;

  function seasonComplete(state) {
    if (!state.leagueDone.bl || !state.leagueDone.bl2 || !state.leagueDone.l3) return false;
    if (!state.cup || !state.cup.winner) return false;
    if (!state.playoffs.po1 || !state.playoffs.po2) return false;
    return ['po1', 'po2'].every(function (c) { return state.playoffs[c].fx.every(function (fid) { return state.fixtures[fid].res; }); });
  }
  FM.seasonComplete = seasonComplete;

  /* Alle offenen Spiele eines Tages ausser dem des Nutzers simulieren */
  FM.playOtherFixtures = function (state, date, exceptId) {
    FM.fixturesOn(state, date).forEach(function (f) {
      if (f.res || f.id === exceptId) return;
      FM.simulateFixture(state, f);
    });
  };

  FM.finishDay = function (state) {
    FM.playOtherFixtures(state, state.date);
    postDate(state, state.date);
  };

  /* ---------- Hauptschleife "Weiter" ---------- */
  FM.advance = function (state) {
    var uc = state.user.club;
    var guard = 0;
    state.attention = false;
    while (guard++ < 400) {
      if (state.user.fired) return { stop: 'fired' };
      // offene Spiele heute?
      var today = FM.fixturesOn(state, state.date).filter(function (f) { return !f.res; });
      var mine = today.filter(function (f) { return f.home === uc || f.away === uc; })[0];
      if (mine) return { stop: 'match', fixture: mine };
      if (today.length) { FM.finishDay(state); if (state.attention) { return { stop: 'news' }; } }
      else postDate(state, state.date);
      if (seasonComplete(state)) {
        var summary = FM.seasonEnd(state);
        return { stop: 'seasonEnd', summary: summary };
      }
      // naechster Tag
      var prev = state.date;
      state.date = D.add(state.date, 1);
      if (state.season.phase === 'pre' && FM.fixturesOn(state, state.date).length) state.season.phase = 'season';
      dailyTick(state);
      if (D.weekday(state.date) === 1) weeklyTick(state);
      if (state.date.slice(8, 10) === '01') FM.payMonthly(state);
      FM.expireOffers(state);
      windowEvents(state);
      if (state.user.conf < 10 && state.season.phase === 'season' && userLeagueGames(state) >= 6) {
        fireUser(state);
        return { stop: 'fired' };
      }
      var next = FM.fixturesOn(state, state.date).filter(function (f) { return !f.res; });
      var mineNext = next.filter(function (f) { return f.home === uc || f.away === uc; })[0];
      if (mineNext) return { stop: 'match', fixture: mineNext };
      if (state.attention) return { stop: 'news' };
      if (prev.slice(5, 7) !== state.date.slice(5, 7) && (state.date.slice(5) === '09-01' || state.date.slice(5) === '01-01' || state.date.slice(5) === '02-01')) return { stop: 'date' };
    }
    return { stop: 'date' };
  };

  function userLeagueGames(state) {
    var uc = state.user.club, lid = state.clubs[uc].league, n = 0;
    Object.keys(state.fixtures).forEach(function (k) {
      var f = state.fixtures[k];
      if (f.comp === lid && f.res && (f.home === uc || f.away === uc)) n++;
    });
    return n;
  }

  function fireUser(state) {
    state.user.fired = true;
    state.user.firedCount++;
    var c = state.clubs[state.user.club];
    FM.addNews(state, { type: 'board', important: true, title: 'Entlassen', body: 'Der Vorstand von ' + c.name + ' hat dich mit sofortiger Wirkung freigestellt. Das Vertrauen ist aufgebraucht.' });
  }

  /* Jobangebote nach Entlassung */
  FM.jobOffers = function (state) {
    var oldRep = state.clubs[state.user.club].rep;
    var list = Object.keys(state.clubs).map(function (k) { return state.clubs[k]; })
      .filter(function (c) { return c.id !== state.user.club && c.league !== 'rl' && !c.reserve && c.rep <= oldRep - 2 && c.rep >= oldRep - 30; });
    if (list.length < 3) {
      var extra = Object.keys(state.clubs).map(function (k) { return state.clubs[k]; })
        .filter(function (c) { return c.id !== state.user.club && c.league !== 'rl' && !c.reserve && list.indexOf(c) < 0; })
        .sort(function (a, b) { return a.rep - b.rep; }).slice(0, 3 - list.length);
      list = list.concat(extra);
    }
    R.shuffle(list);
    return list.slice(0, 3).map(function (c) { return c.id; });
  };

  FM.takeJob = function (state, cid) {
    state.user.fired = false;
    state.user.club = cid;
    state.user.conf = 60;
    state.user.joined = state.season.year;
    var club = state.clubs[cid];
    club.lineup = FM.autoLineup(state, cid, club.formation);
    FM.addNews(state, { type: 'board', title: 'Neuer Job: ' + club.name, body: 'Du bist neuer Cheftrainer von ' + club.name + '. ' + FM.expectationText(state, cid) });
  };

  /* ---------- Saisonende ---------- */
  FM.seasonEnd = function (state) {
    var y = state.season.year, uc = state.user.club;
    var summary = { year: y, tables: {}, moves: { up: [], down: [] }, awards: {}, user: {} };
    var oldLeague = {};
    Object.keys(state.clubs).forEach(function (cid) { oldLeague[cid] = state.clubs[cid].league; });
    ['bl', 'bl2', 'l3'].forEach(function (lid) {
      var t = FM.table(state, lid, { noCache: true });
      summary.tables[lid] = t.map(function (r) { return { club: r.club, pts: r.pts, gd: r.gd }; });
      t.forEach(function (r, i) { state.clubs[r.club].hist.push({ y: y, league: lid, pos: i + 1, pts: r.pts }); });
      var scorers = FM.topScorers(state, lid, 1)[0];
      if (scorers) summary.awards[lid] = { scorer: scorers.pid, name: state.players[scorers.pid].name, goals: scorers.goals };
    });
    summary.awards.cup = state.cup.winner;

    var tBL = FM.table(state, 'bl', { noCache: true }), t2 = FM.table(state, 'bl2', { noCache: true }), t3 = FM.table(state, 'l3', { noCache: true });
    var po1w = playoffWinner(state, 'po1'), po2w = playoffWinner(state, 'po2');
    var downBL = [tBL[16].club, tBL[17].club];
    if (po1w !== state.playoffs.po1.upper) downBL.push(state.playoffs.po1.upper);
    var upBL = [eligibleUp(state, t2, 1), eligibleUp(state, t2, 2)];
    if (po1w === state.playoffs.po1.lower) upBL.push(state.playoffs.po1.lower);
    var down2 = [t2[16].club, t2[17].club];
    if (po2w !== state.playoffs.po2.upper) down2.push(state.playoffs.po2.upper);
    var up3 = [eligibleUp(state, t3, 1), eligibleUp(state, t3, 2)];
    if (po2w === state.playoffs.po2.lower) up3.push(state.playoffs.po2.lower);
    var down3 = t3.slice(16).map(function (r) { return r.club; });
    // Aufsteiger aus der Regionalliga (nicht simuliert): staerkste Teams des Pools
    var rlPool = state.leagues.rl.clubs.slice().sort(function (a, b) { return FM.teamStrength(state, b) + state.clubs[b].rep / 10 - FM.teamStrength(state, a) - state.clubs[a].rep / 10; });
    var upRL = rlPool.slice(0, down3.length);

    function move(cid, to) {
      var from = state.clubs[cid].league;
      state.leagues[from].clubs = state.leagues[from].clubs.filter(function (x) { return x !== cid; });
      state.leagues[to].clubs.push(cid);
      state.clubs[cid].league = to;
    }
    downBL.forEach(function (c) { move(c, 'bl2'); });
    upBL.forEach(function (c) { move(c, 'bl'); });
    down2.forEach(function (c) { move(c, 'l3'); });
    up3.forEach(function (c) { move(c, 'bl2'); });
    down3.forEach(function (c) { move(c, 'rl'); });
    upRL.forEach(function (c) { move(c, 'l3'); });
    // Reserveteams duerfen nicht in derselben Liga wie die erste Mannschaft spielen
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!c.reserve) return;
      var first = state.clubs[c.reserve];
      if (first && FM.levelOf(state, cid) <= FM.levelOf(state, first.id) && c.league !== 'rl') {
        var swap = state.leagues.rl.clubs.slice().sort(function (a, b) { return state.clubs[b].rep - state.clubs[a].rep; })[0];
        move(cid, 'rl');
        if (swap) move(swap, 'l3');
      }
    });
    summary.moves.up = upBL.concat(up3, upRL);
    summary.moves.down = downBL.concat(down2, down3);
    summary.groups = { toBL: upBL, toBL2: downBL.concat(up3), toL3: down2.concat(upRL), toRL: down3 };

    // Europapokal-Praemien & Reputation
    tBL.forEach(function (r, i) {
      var c = state.clubs[r.club];
      if (i < 4) FM.book(c, 'prize', 28e6 + (i === 0 ? 6e6 : 0));
      else if (i === 4) FM.book(c, 'prize', 9e6);
      else if (i === 5) FM.book(c, 'prize', 5e6);
    });
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid], ol = oldLeague[cid], nl = c.league;
      var lvlOld = { bl: 1, bl2: 2, l3: 3, rl: 4 }[ol], lvlNew = { bl: 1, bl2: 2, l3: 3, rl: 4 }[nl];
      var rep0 = c.rep;
      if (lvlNew < lvlOld) c.rep = Math.min(99, c.rep + 4);
      if (lvlNew > lvlOld) c.rep = Math.max(20, c.rep - 4);
      c._repDelta0 = rep0;
      if (c.expect && FM.ZONES[ol]) {
        var pos = summary.tables[ol].findIndex(function (r) { return r.club === cid; }) + 1;
        if (pos && pos < c.expect.target - 2) c.rep = Math.min(99, c.rep + 1);
        if (pos && pos > c.expect.target + 4) c.rep = Math.max(20, c.rep - 1);
      }
      FM.adjustCommercial(c, ol, nl, c.rep - c._repDelta0);
      delete c._repDelta0;
    });

    // Bewertung des Nutzers
    var ul = oldLeague[uc];
    var upos = summary.tables[ul] ? summary.tables[ul].findIndex(function (r) { return r.club === uc; }) + 1 : null;
    var target = state.clubs[uc].expect ? state.clubs[uc].expect.target : 10;
    var conf = state.user.conf;
    if (upos) {
      conf += (target - upos) * 3.5;
      if (summary.moves.up.indexOf(uc) >= 0) conf += 20;
      if (summary.moves.down.indexOf(uc) >= 0) conf -= 30;
    }
    if (state.cup.winner === uc) conf += 15;
    conf = FM.clamp(conf, 0, 100);
    summary.user = { club: uc, league: ul, pos: upos, target: target, expect: state.clubs[uc].expect ? state.clubs[uc].expect.label : '', conf: conf, promoted: summary.moves.up.indexOf(uc) >= 0, relegated: summary.moves.down.indexOf(uc) >= 0, cupWinner: state.cup.winner === uc };
    state.user.seasons.push({ y: y, club: uc, league: ul, pos: upos, target: target });
    state.user.conf = Math.max(conf, 35);
    if (conf < 18 || (state.clubs[uc].league === 'rl')) {
      summary.user.fired = true;
    }

    // Spielerstatistiken archivieren
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (p.st.apps || p.cst.apps) {
        p.hist.push({ y: y, club: p.club, apps: p.st.apps, goals: p.st.goals, assists: p.st.assists, avg: p.st.gn ? FM.round1(p.st.gsum / p.st.gn) : null, cup: p.cst.apps, ovr: p.ovr });
      }
    });

    state.lastSummary = summary;
    FM.offseason(state, summary);
    if (summary.user.fired) {
      state.user.fired = true;
      state.user.firedCount++;
      FM.addNews(state, { type: 'board', important: true, title: 'Entlassen', body: 'Nach dieser Saison trennt sich ' + state.clubs[uc].name + ' von dir.' });
    }
    return summary;
  };

  function playoffWinner(state, comp) {
    var po = state.playoffs[comp];
    return FM.fixtureWinner(state.fixtures[po.fx[1]]);
  }
  FM.playoffWinner = playoffWinner;

  /* Sommerpause: Vertraege, Alter, Karriereende, Nachwuchs, neue Saison */
  FM.offseason = function (state, summary) {
    var y = state.season.year, uc = state.user.club;
    var left = [], retired = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      // Vertraege
      if (p.club && p.contract.until <= y + 1) {
        var club = state.clubs[p.club];
        if (p.club === uc) {
          left.push(p.name);
          removeFromClub(state, p);
          state.free.push(p.id);
        } else {
          var mates = FM.clubPlayers(state, p.club).sort(function (a, b) { return b.ovr - a.ovr; });
          var rank = mates.indexOf(p) + 1;
          var keep = rank <= 6 && p.age <= 34 ? 0.95 : p.age <= 30 ? (rank <= 18 ? 0.85 : 0.55) : p.age <= 33 ? (rank <= 14 ? 0.65 : 0.3) : 0.25;
          if (R.chance(keep)) p.contract = { until: y + 1 + R.int(1, p.age >= 31 ? 1 : 3), wage: FM.wageDemand(p, club.league) };
          else { removeFromClub(state, p); state.free.push(p.id); }
        }
      }
      // Alter & Karriereende
      p.age++;
      var retire = (p.age >= 38) || (p.age >= 35 && R.chance(p.ovr >= 78 ? 0.25 : 0.5)) || (p.age >= 33 && p.ovr < 62 && R.chance(0.4)) || (!p.club && p.age >= 32 && p.ovr < 72 && R.chance(0.5));
      if (retire) {
        if (p.club === uc) retired.push(p.name);
        if (p.club) removeFromClub(state, p);
        delete state.players[pid];
        return;
      }
      p.st = FM.emptyStats(); p.cst = { apps: 0, goals: 0 };
      p.yel = 0; p.susp = 0; p.suspCup = 0; p.fit = 100; p.form = 0; p.minutesRecent = 0;
      if (p.injury && p.injury.days > 60) p.injury.days -= 40; else p.injury = null;
    });
    state.free = state.free.filter(function (id) { return state.players[id]; });
    if (state.free.length > 220) {
      var fa = state.free.map(function (id) { return state.players[id]; }).sort(function (a, b) { return b.ovr - a.ovr; });
      fa.slice(220).forEach(function (p) { delete state.players[p.id]; });
      state.free = fa.slice(0, 220).map(function (p) { return p.id; });
    }

    // Nachwuchs
    var youthUser = [];
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      var n = R.int(club.league === 'rl' ? 1 : 2, club.rep > 70 ? 4 : 3);
      for (var i = 0; i < n; i++) {
        var p = FM.makeYouth(club, state);
        state.players[p.id] = p;
        club.squad.push(p.id);
        if (cid === uc) youthUser.push(p.name + ' (' + FM.POS_LABEL[p.pos[0]] + ', ' + p.ovr + ')');
      }
      FM.fillSquad(state, cid);
      if (cid !== uc) FM.aiTrimSquad(state, cid);
    });

    if (left.length) FM.addNews(state, { type: 'transfer', title: 'Verträge ausgelaufen', body: 'Ablösefrei gegangen: ' + left.join(', ') + '.' });
    if (retired.length) FM.addNews(state, { type: 'info', title: 'Karriereende', body: retired.join(', ') + ' beende' + (retired.length > 1 ? 'n' : 't') + ' die Karriere.' });
    if (youthUser.length) FM.addNews(state, { type: 'youth', title: 'Neue Talente aus der Akademie', body: 'Der Nachwuchs rückt auf: ' + youthUser.join(', ') + '.' });

    state.season.year = y + 1;
    state.date = D.iso(y + 1, 7, 1);
    var clubLineup = state.clubs[uc];
    if (clubLineup.lineup) clubLineup.lineup = FM.autoLineup(state, uc, clubLineup.lineup.formation);
    FM.startSeason(state, false);
  };

  function removeFromClub(state, p) {
    var club = state.clubs[p.club];
    if (club) {
      club.squad = club.squad.filter(function (id) { return id !== p.id; });
      if (club.lineup) {
        club.lineup.slots.forEach(function (s) { if (s.pid === p.id) s.pid = null; });
        club.lineup.bench = (club.lineup.bench || []).filter(function (id) { return id !== p.id; });
      }
    }
    p.club = null;
    p.listed = false;
  }

  /* ---------- Statistiken ---------- */
  FM.topScorers = function (state, lid, n) {
    var list = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!p.club || state.clubs[p.club].league !== lid) return;
      if (p.st.goals > 0) list.push({ pid: pid, goals: p.st.goals, assists: p.st.assists, apps: p.st.apps });
    });
    list.sort(function (a, b) { return b.goals - a.goals || b.assists - a.assists || a.apps - b.apps; });
    return list.slice(0, n || 20);
  };

  FM.leagueLeaders = function (state, lid, kind, n) {
    var list = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!p.club || state.clubs[p.club].league !== lid) return;
      var v;
      if (kind === 'goals') v = p.st.goals;
      else if (kind === 'assists') v = p.st.assists;
      else if (kind === 'points') v = p.st.goals + p.st.assists;
      else if (kind === 'grade') { if (p.st.gn < Math.max(3, maxGames(state, lid) * 0.4)) return; v = -(p.st.gsum / p.st.gn); }
      else if (kind === 'cs') { if (!FM.isGK(p)) return; v = p.st.cs; }
      else if (kind === 'cards') v = p.st.yc + p.st.rc * 3;
      if (!v && kind !== 'grade') return;
      list.push({ pid: pid, v: v, p: p });
    });
    list.sort(function (a, b) { return b.v - a.v || a.p.st.apps - b.p.st.apps; });
    return list.slice(0, n || 15);
  };

  function maxGames(state, lid) {
    var n = 0;
    Object.keys(state.fixtures).forEach(function (k) { var f = state.fixtures[k]; if (f.comp === lid && f.res && f.round > n) n = f.round; });
    return n;
  }
  FM.playedRounds = maxGames;
})();
