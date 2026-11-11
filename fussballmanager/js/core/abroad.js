/* Ausland und Weltbalance.
   Die drei Profiligen sind keine Insel: Spitzenspieler wechseln ins Ausland, Vereine holen Verstaerkungen
   von dort. Ein Regler haelt das Niveau der Ligen ueber Jahrzehnte stabil – liegt eine Liga ueber ihrem
   Ausgangsniveau, wandern mehr Leistungstraeger ab; liegt sie darunter, kommen mehr Zugaenge.
   Dazu: Finanzdisziplin der KI-Vereine (Notverkaeufe statt Dauerminus) und ein Auslandsmarkt fuer den Spieler. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  var LEAGUES = ['bl', 'bl2', 'l3'];
  FM.WORLD_BASE = { bl: 77, bl2: 69.8, l3: 63.9 };                  // Schnitt der Mannschaftsstaerken 2026/27
  /* Abgaenge/Zugaenge je Sommerfenster bei ausgeglichenem Niveau und zusaetzlich je Staerkepunkt Abweichung */
  var FLOW = { bl: [4, 10], bl2: [2, 6], l3: [1, 4] };
  /* Anspruch eines Vereins: Mannschaftsstaerke, die zu seinem Renommee passt (Ausgleichsgerade der Startdaten) */
  FM.ambition = function (club) { return 46.5 + 0.396 * club.rep; };
  var NAT_W = { ENG: 4, ESP: 2.4, ITA: 2.2, FRA: 1.6, TUR: 1.2, POR: 1, NED: 1 };   // Kaufkraft der Ligen
  var POS_W = { GK: 1, CB: 2, LB: 1, RB: 1, CDM: 1, CM: 1.6, CAM: 1, LM: 0.6, RM: 0.6, LW: 0.9, RW: 0.9, ST: 1.4 };

  function eu() { return (window.FM_DATA || {}).eu || { clubs: [] }; }

  FM.leagueStrength = function (state, lid) {
    var cl = state.leagues[lid].clubs;
    return cl.length ? FM.avg(cl.map(function (c) { return FM.teamStrength(state, c); })) : 0;
  };
  FM.worldInit = function (state) {
    state.base = {};
    LEAGUES.forEach(function (l) { state.base[l] = Math.round(FM.leagueStrength(state, l) * 100) / 100; });
  };
  FM.worldDelta = function (state, lid) {
    var b = (state.base && state.base[lid]) || FM.WORLD_BASE[lid];
    return FM.leagueStrength(state, lid) - b;
  };

  /* Auslandsverein, bei dem ein Spieler dieser Staerke zum Stamm oder zur Rotation gehoert */
  function foreignFor(state, ovr, below, above) {
    var list = eu().clubs.filter(function (d) {
      var s = state.clubs[d.id] ? state.clubs[d.id].str : d.str;
      return s >= ovr - below && s <= ovr + above;
    });
    if (!list.length) list = eu().clubs.slice().sort(function (a, b) { return Math.abs(a.str - ovr) - Math.abs(b.str - ovr); }).slice(0, 6);
    if (!list.length) return null;
    return FM.euClub(state, R.weighted(list, function (x) { return NAT_W[x.nat] || 0.6; }).id);
  }
  FM.foreignFor = foreignFor;

  function isAi(state, c) { return c && !c.guest && !c.reserve && c.id !== state.user.club; }

  /* ---------- Finanzplanung der KI-Vereine ---------- */
  FM.aiSurplus = function (state, club) {
    var rev = FM.revenueEstimate(state, club);
    return rev.total - FM.annualWages(state, club) - rev.plan.ops - rev.plan.upkeep - (FM.debtService ? FM.debtService(club) : 0);
  };
  /* Was ein KI-Verein fuer Abloesen ausgeben kann: freies Geld oder ein Teil des erwarteten Ueberschusses
     (Aufsteiger investieren das neue TV-Geld, bevor es auf dem Konto ist) */
  FM.aiBudget = function (state, club) {
    var b = Math.max(0, Math.min(club.money * 0.45, club.money - FM.cashReserve(state, club)));
    var sur = FM.aiSurplus(state, club);
    if (sur > 0) b = Math.max(b, Math.min(sur * 0.6, club.money + sur * 0.5));
    return Math.max(0, b);
  };

  function note(state, rec, p, text, minFee) {
    var ul = state.clubs[state.user.club].league;
    var c = state.clubs[rec.from && !state.clubs[rec.from].eu ? rec.from : rec.to];
    if (rec.fee >= (minFee || 15e6) || (c && c.league === ul && (rec.fee >= 1e6 || p.ovr >= 72))) {
      FM.addNews(state, { type: 'market', quiet: true, title: 'Transfer: ' + p.name + ' → ' + state.clubs[rec.to].short, body: text });
    }
  }

  /* ---------- Abgang ins Ausland ---------- */
  FM.exportPlayer = function (state, p, feeFactor, forced) {
    var seller = state.clubs[p.club];
    var buyer = foreignFor(state, p.ovr, 3, 5);
    if (!buyer) return null;
    var fee = FM.niceRound(FM.askingPrice(state, p) * feeFactor), pos = p.pos[0], ovr = p.ovr;
    var rec = FM.executeTransfer(state, p, buyer.id, fee, FM.wageDemand(p, 'eu'), R.int(3, 5));
    note(state, rec, p, p.name + ' (' + FM.POS_LABEL[p.pos[0]] + ', ' + p.ovr + ') verlässt ' + seller.name + ' und wechselt für ' + FM.fmtMoney(fee) + ' zu ' + buyer.name + ' (' + FM.euCountry(buyer.nat) + ')' +
      (forced ? ' – der Verein braucht das Geld.' : '.'));
    if (!forced && FM.ZONES[seller.league]) replace(state, seller, pos, ovr, fee);
    return rec;
  };

  /* Ersatz fuer einen Abgang: Der Verein investiert einen Teil der Abloese in einen juengeren Nachfolger aus dem
     Ausland. Liegt die Liga ueber ihrem Ausgangsniveau, faellt der Ersatz schwaecher aus – und umgekehrt. */
  function replace(state, club, pos, ovr, fee) {
    if (club.squad.length >= 29) return null;
    var d = FM.worldDelta(state, club.league);
    var q = ovr - Math.round(FM.clamp(1 + d * 2.5 + R.range(-1.2, 1.2), -1, 5));
    var age = R.int(21, 27), budget = Math.max(FM.aiBudget(state, club), fee * 0.8);
    var val = function (o) { return 0.25e6 * Math.pow(1.23, o - 60) * FM.ageValueFactor(age) * 1.1; };
    while (val(q) > budget && q > ovr - 6) q--;
    if (val(q) > budget) return null;
    var src = foreignFor(state, q, 2, 4);
    if (!src) return null;
    var p = FM.euMakePlayer(state, src, { pos: pos, ovr: q, age: age, keep: true, world: R.chance(0.3) }, FM.euTaken(state));
    var wage = FM.wageDemand(p, club.league);
    if (FM.annualWages(state, club) + wage > FM.revenueEstimate(state, club).total * 0.78) { FM.removePlayer(state, p); return null; }
    var cost = FM.niceRound(FM.marketValue(p) * R.range(0.9, 1.1));
    var rec = FM.executeTransfer(state, p, club.id, cost, wage, R.int(3, 5));
    note(state, rec, p, club.name + ' reagiert auf den Abgang und holt ' + p.name + ' (' + FM.POS_LABEL[pos] + ', ' + p.ovr + ', ' + p.age + ' J.) von ' + src.name + ' (' + FM.euCountry(src.nat) + ') – Ablöse ' + FM.fmtMoney(cost) + '.', 12e6);
    return rec;
  }

  function exportRound(state, lid, n) {
    var y = state.season.year, cands = [], since = D.iso(y, 7, 1);
    var thr = ((state.base && state.base[lid]) || FM.WORLD_BASE[lid]) + 1;
    var strs = state.leagues[lid].clubs.map(function (c) { return FM.teamStrength(state, c); }).sort(function (a, b) { return b - a; });
    state.leagues[lid].clubs.forEach(function (cid) {
      var club = state.clubs[cid];
      if (!isAi(state, club) || club.squad.length <= 21) return;
      var cs = FM.teamStrength(state, cid);
      // Wer klamm ist, verkauft eher; die Spitzenklubs der Liga halten ihre Stars
      var fin = (club.money < 0 ? 3 : club.money > FM.annualWages(state, club) * 1.5 ? 0.6 : 1) * (cs >= strs[1] ? 0.25 : cs >= strs[3] ? 0.6 : 1);
      FM.clubPlayers(state, cid).forEach(function (p) {
        if (p.loan || p.pre || p.injury || p.age > 30 || p.age < 19 || (p.joinDate && p.joinDate >= since) || p.ovr < thr - 2) return;
        // am ehesten gehen Spieler, die ihrem Verein entwachsen sind
        cands.push({ p: p, w: Math.exp((p.ovr - thr) / 6) * Math.exp(FM.clamp(p.ovr - cs, -3, 6) / 2.5) * (p.age <= 23 ? 1.2 : p.age <= 27 ? 1 : 0.5) * fin });
      });
    });
    var done = 0;
    for (var i = 0; i < n && cands.length; i++) {
      var x = R.weighted(cands, function (c) { return c.w; });
      cands.splice(cands.indexOf(x), 1);
      if (FM.exportPlayer(state, x.p, R.range(1, 1.35))) done++;
    }
    return done;
  }

  /* ---------- Zugang aus dem Ausland ---------- */
  FM.importPlayer = function (state, cid, cap) {
    var club = state.clubs[cid];
    if (club.squad.length >= 29) return null;
    var players = FM.clubPlayers(state, cid);
    var a = FM.assignFormation(players, club.formation || '4-4-2');
    var worst = null;
    a.slots.forEach(function (s) {
      var q = s.pid ? state.players[s.pid] : null, v = q ? q.ovr - FM.positionPenalty(q, s.pos) : 0;
      if (!worst || v < worst.v) worst = { pos: s.pos, v: v };
    });
    var str = FM.teamStrength(state, cid);
    var ovr = Math.round(FM.clamp(worst.v + R.int(2, 5), str - 4, Math.max(str + 3, cap || 0)));
    var age = R.int(21, 29);
    var budget = FM.aiBudget(state, club);
    var value = 0.25e6 * Math.pow(1.23, ovr - 60) * FM.ageValueFactor(age);
    var free = value * 0.9 > budget;
    if (free) { age = R.int(28, 31); ovr = Math.round(FM.clamp(worst.v + R.int(1, 3), str - 4, str + 1)); }   // abloesefrei: erfahrener Mann
    var src = foreignFor(state, ovr, 2, 4);
    if (!src) return null;
    var p = FM.euMakePlayer(state, src, { pos: worst.pos, ovr: ovr, age: age, keep: true, world: R.chance(0.3) }, FM.euTaken(state));
    var wage = FM.wageDemand(p, club.league);
    if (FM.annualWages(state, club) + wage > FM.revenueEstimate(state, club).total * 0.75) { FM.removePlayer(state, p); return null; }
    var fee = free ? 0 : FM.niceRound(FM.marketValue(p) * R.range(0.85, 1.1));
    var rec = FM.executeTransfer(state, p, cid, fee, wage, R.int(2, 4));
    note(state, rec, p, club.name + ' verpflichtet ' + p.name + ' (' + FM.POS_LABEL[p.pos[0]] + ', ' + p.ovr + ', ' + p.age + ' J.) von ' + src.name + ' (' + FM.euCountry(src.nat) + ')' + (fee ? ' – Ablöse ' + FM.fmtMoney(fee) + '.' : ' ablösefrei.'), 12e6);
    FM.aiTrimSquad(state, cid);
    return rec;
  };

  function importRound(state, lid, n) {
    var avg = FM.leagueStrength(state, lid), done = 0;
    var cands = state.leagues[lid].clubs.map(function (cid) { return state.clubs[cid]; }).filter(function (c) { return isAi(state, c); });
    for (var i = 0; i < n && cands.length; i++) {
      // schwaechere Vereine suchen eher im Ausland, wer klamm ist, kann nur abloesefrei zugreifen
      var club = R.weighted(cands, function (c) { return FM.clamp(avg - FM.teamStrength(state, c.id) + 3, 0.5, 8) * (c.money > 0 ? 1 : 0.4); });
      if (FM.importPlayer(state, club.id)) done++;
    }
    // Grosse Namen unter ihrem Anspruch und abgeschlagene Kellerkinder ruesten gezielt auf
    var stamp = state.season.year * 10 + (D.month(state.date) === 1 ? 2 : 1);
    cands.forEach(function (c) {
      var str = FM.teamStrength(state, c.id), want = Math.max(FM.ambition(c) - 1.5, avg - 4.5);
      if (str >= want || !R.chance(0.14)) return;
      // hoechstens ein solcher Transfer je Fenster – wer viel Geld hat, darf dreimal zugreifen
      var b = FM.aiBudget(state, c), max = b > 60e6 ? 3 : b > 20e6 ? 2 : 1;
      if (c.impW !== stamp) { c.impW = stamp; c.impN = 0; }
      if (c.impN >= max) return;
      if (FM.importPlayer(state, c.id, want + 3)) { c.impN++; done++; }
    });
    return done;
  }

  function times(x) { var n = Math.floor(x); return n + (R.chance(x - n) ? 1 : 0); }

  /* Alle drei Tage im Transferfenster: Abgaenge und Zugaenge nach Regler */
  FM.abroadRound = function (state) {
    var summer = D.month(state.date) !== 1, rounds = summer ? 21 : 10, scale = summer ? 1 : 0.3;
    LEAGUES.forEach(function (lid) {
      var d = FM.worldDelta(state, lid), f = FLOW[lid];
      exportRound(state, lid, times((f[0] + f[1] * Math.max(0, d)) * scale / rounds));
      importRound(state, lid, times((1 + f[1] * 1.5 * Math.max(0, -d)) * scale / rounds));
    });
  };

  /* ---------- Finanzdisziplin: Notverkaeufe statt Dauerminus ---------- */
  FM.aiFinance = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      if (!isAi(state, club)) return;
      var sur = FM.aiSurplus(state, club), sold = 0;
      // Saison muss durchfinanziert sein: Kontostand plus erwartetes Ergebnis
      while (club.money + sur < 0 && sold < 4 && club.squad.length > 20) {
        var gks = FM.clubPlayers(state, cid).filter(FM.isGK).length;
        var list = FM.clubPlayers(state, cid).filter(function (p) { return !p.loan && !p.pre && !(FM.isGK(p) && gks <= 2); })
          .sort(function (a, b) { return (b.contract.wage + FM.marketValue(b) * 0.3) - (a.contract.wage + FM.marketValue(a) * 0.3); });
        var p = list[0];
        if (!p) break;
        var wage = p.contract.wage, fee = FM.niceRound(FM.marketValue(p) * R.range(0.7, 0.95));
        // zuerst ein deutscher Abnehmer, sonst das Ausland
        var buyers = Object.keys(state.clubs).filter(function (id) {
          var c = state.clubs[id];
          return id !== cid && isAi(state, c) && c.league !== 'rl' && c.squad.length < 29 && FM.aiBudget(state, c) >= fee && FM.interest(state, p, id) >= 45 &&
            FM.teamStrength(state, id) <= p.ovr + 4 && FM.annualWages(state, c) + FM.wageDemand(p, c.league) <= FM.revenueEstimate(state, c).total * 0.72;
        });
        var rec;
        if (buyers.length) {
          var b = R.pick(buyers);
          rec = FM.executeTransfer(state, p, b, fee, FM.wageDemand(p, state.clubs[b].league), R.int(2, 4));
          note(state, rec, p, club.name + ' muss sparen: ' + p.name + ' (' + FM.POS_LABEL[p.pos[0]] + ', ' + p.ovr + ') wechselt für ' + FM.fmtMoney(fee) + ' zu ' + state.clubs[b].name + '.');
        } else if (p.ovr >= 60 && p.age <= 31) rec = FM.exportPlayer(state, p, R.range(0.7, 0.95), true);
        else { FM.releasePlayer(state, p); rec = true; }
        if (!rec) break;
        sur += wage;
        sold++;
      }
    });
  };

  /* ---------- Auslandsmarkt fuer den Spieler ---------- */
  FM.removePlayer = function (state, p) {
    var c = p.club ? state.clubs[p.club] : null;
    if (c) c.squad = c.squad.filter(function (id) { return id !== p.id; });
    state.free = state.free.filter(function (id) { return id !== p.id; });
    if (state.known) delete state.known[p.id];
    if (state.talks) delete state.talks[p.id];
    state.shortlist = (state.shortlist || []).filter(function (id) { return id !== p.id; });
    delete state.players[p.id];
  };

  /* Zum Fensterbeginn: neue Empfehlungen aus dem Ausland, zugeschnitten auf das Niveau des eigenen Vereins */
  FM.abroadRefresh = function (state) {
    if (!eu().clubs.length) return 0;
    var y = state.season.year, summer = D.month(state.date) !== 1;
    var stamp = y * 10 + (summer ? 1 : 2);
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!p.mkt || p.mkt === stamp || !p.club || !state.clubs[p.club].eu) return;
      if (FM.onShortlist(state, pid) || (state.talks && state.talks[pid]) || p.pre) { p.mkt = stamp; return; }   // beobachtete Spieler bleiben
      FM.removePlayer(state, p);
    });
    var lvl = FM.teamStrength(state, state.user.club), n = summer ? 34 : 16, taken = FM.euTaken(state), made = 0;
    var positions = Object.keys(POS_W);
    for (var i = 0; i < n; i++) {
      var ovr = Math.round(i < n * 0.6 ? lvl + R.normal(0, 3.2) : R.range(60, 84));
      var talent = R.chance(0.3), age = talent ? R.int(18, 21) : R.int(22, 30);
      if (talent) ovr -= R.int(3, 7);
      ovr = FM.clamp(ovr, 52, 88);
      var club = foreignFor(state, ovr, talent ? -2 : 1, talent ? 12 : 5);
      if (!club) continue;
      var p = FM.euMakePlayer(state, club, { pos: R.weighted(positions, function (x) { return POS_W[x]; }), ovr: ovr, age: age, keep: true, world: R.chance(0.3) }, taken);
      if (talent) p.pot = FM.clamp(ovr + R.int(7, 16), ovr, 93);
      p.mkt = stamp;
      p.listed = R.chance(0.55);
      p.contract.until = y + R.int(1, 3);
      made++;
    }
    return made;
  };

  /* Saisonende: Kader der Auslandsvereine klein halten (Stars und beobachtete Spieler bleiben) */
  FM.abroadPrune = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!c.eu) return;
      var list = FM.clubPlayers(state, cid).filter(function (p) { return p.abroad && !p.real && !p.mkt; }).sort(function (a, b) { return b.ovr - a.ovr; });
      list.forEach(function (p, i) {
        if ((i >= 6 || p.ovr < 70 || p.age >= 32) && !FM.onShortlist(state, p.id)) FM.removePlayer(state, p);
      });
    });
  };

  /* Auslaendische Interessenten fuer einen Spieler des eigenen Vereins */
  FM.foreignBuyers = function (state, p, n) {
    var out = [];
    if (p.ovr < 70) return out;
    var list = eu().clubs.filter(function (d) { return d.str >= p.ovr - 3 && d.str <= p.ovr + 4; });
    for (var i = 0; i < (n || 4) && list.length; i++) {
      var d = R.weighted(list, function (x) { return NAT_W[x.nat] || 0.6; });
      list.splice(list.indexOf(d), 1);
      var c = FM.euClub(state, d.id);
      if (FM.interest(state, p, c.id) >= 40) out.push(c.id);
    }
    return out;
  };
})();
