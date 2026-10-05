/* Finanzen, Vorstand, Nachrichten, Vertraege und Transfers. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  /* ---------- Nachrichten ---------- */
  FM.addNews = function (state, n) {
    var item = {
      id: 'n' + (state.newsSeq = (state.newsSeq || 0) + 1),
      date: state.date, type: n.type || 'info', title: n.title, body: n.body || '',
      read: !!n.quiet, important: !!n.important, action: n.action || null, ref: n.ref || null
    };
    state.news.unshift(item);
    if (state.news.length > 250) state.news.length = 250;
    if (item.important) state.attention = true;
    return item;
  };
  FM.unreadCount = function (state) { return state.news.filter(function (n) { return !n.read; }).length; };

  /* ---------- Finanzen ---------- */
  FM.emptyLedger = function () {
    return { tv: 0, tickets: 0, sponsor: 0, prize: 0, sales: 0, wages: 0, buys: 0, fees: 0, ops: 0, infra: 0, other: 0 };
  };
  FM.LEDGER_LABEL = {
    tv: 'TV-Gelder', tickets: 'Zuschauereinnahmen', sponsor: 'Sponsoring & Marketing', prize: 'Prämien',
    sales: 'Transfererlöse', wages: 'Gehälter', buys: 'Ablösesummen', fees: 'Berater & Handgelder', ops: 'Betriebskosten',
    infra: 'Infrastruktur (Bau & Unterhalt)', other: 'Sonstiges'
  };

  var MIN_COMMERCIAL = { bl: 8e6, bl2: 2.5e6, l3: 0.6e6, rlw: 0.12e6, rlsw: 0.12e6, rl: 0.2e6, olw: 0.05e6, olsw: 0.05e6 };

  function tvAndOps(club) {
    var rep = club.rep, l = club.league, tv, ops;
    if (l === 'bl') { tv = 25e6 + (rep - 50) * 0.7e6; ops = 14e6 + (rep - 50) * 0.5e6; }
    else if (l === 'bl2') { tv = 9e6 + (rep - 50) * 0.25e6; ops = 4e6 + (rep - 50) * 0.1e6; }
    else if (l === 'l3') { tv = 1.6e6 + (rep - 40) * 0.03e6; ops = 1.3e6 + (rep - 40) * 0.03e6; }
    else if (FM.isRegional(l)) { tv = 0.15e6; ops = 0.26e6 + (rep - 30) * 0.008e6; }
    else if (FM.isOberliga(l)) { tv = 0.02e6; ops = 0.12e6; }
    else { tv = 0.2e6; ops = 0.35e6; }
    return { tv: Math.max(FM.isOberliga(l) ? 0.02e6 : 0.1e6, tv), ops: Math.max(FM.isOberliga(l) || FM.isRegional(l) ? 0.1e6 : 0.2e6, ops) };
  }

  /* Sponsoring/Marketing wird beim Spielstart so kalibriert, dass jeder Verein mit
     seinem echten Kader wirtschaftlich solide (leichter Ueberschuss) startet. */
  FM.calibrateCommercial = function (state, club) {
    var base = tvAndOps(club);
    var tickets = FM.expectedAttendance(club) * (FM.ticketPrice[club.league] || 10) * FM.homeGames(club);
    var wages = FM.annualWages(state, club);
    var need = (wages + base.ops) * 1.03 - base.tv - tickets;
    club.commercial = Math.round(Math.max(MIN_COMMERCIAL[club.league] || 0.2e6, need));
  };

  FM.annualPlan = function (club) {
    var b = tvAndOps(club);
    var sponsor = (club.commercial || MIN_COMMERCIAL[club.league] || 0.2e6) * FM.facCommercial(club);
    return { tv: b.tv, sponsor: Math.round(sponsor), ops: b.ops };
  };

  /* Ligawechsel/Erfolg wirken sich auf die Vermarktung aus */
  FM.adjustCommercial = function (club, oldLeague, newLeague, repDelta) {
    var lv = FM.LEVEL;
    var f = 1 + (repDelta || 0) * 0.02;
    if (lv[newLeague] < lv[oldLeague]) f *= 1.45;
    if (lv[newLeague] > lv[oldLeague]) f *= 0.62;
    club.commercial = Math.round(Math.max(MIN_COMMERCIAL[newLeague] || 0.2e6, (club.commercial || 0) * f));
  };

  FM.ticketPrice = { bl: 36, bl2: 24, l3: 15, rlw: 10, rlsw: 11, rl: 10, olw: 7, olsw: 7 };

  /* Zuschauer = Nachfrage, begrenzt durch die (waehrend eines Ausbaus reduzierte) Kapazitaet */
  FM.attendance = function (state, homeId, awayId, comp) {
    var c = state.clubs[homeId], a = state.clubs[awayId];
    var cap0 = c.cap0 || c.cap;
    var demand = FM.fanDemand(c, a.rep, comp, FM.levelOf(state, homeId) - FM.levelOf(state, awayId)) + cap0 * R.range(-0.04, 0.04);
    return Math.round(FM.clamp(demand, cap0 * 0.12, FM.effectiveCap(c)));
  };

  FM.book = function (club, key, amount) {
    club.money += amount;
    club.fin[key] = (club.fin[key] || 0) + amount;
  };

  FM.weeklyWages = function (state, club) {
    var sum = 0;
    club.squad.forEach(function (pid) { var p = state.players[pid]; if (p) sum += p.contract.wage; });
    return sum / 52;
  };
  FM.annualWages = function (state, club) {
    var sum = 0;
    club.squad.forEach(function (pid) { var p = state.players[pid]; if (p) sum += p.contract.wage; });
    return sum;
  };

  FM.payWeekly = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      FM.book(club, 'wages', -FM.weeklyWages(state, club));
    });
  };

  FM.payMonthly = function (state) {
    var m = D.month(state.date);
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid], plan = FM.annualPlan(club);
      if (m >= 8 || m <= 5) {
        FM.book(club, 'tv', plan.tv / 10);
        FM.book(club, 'sponsor', plan.sponsor / 10);
      }
      FM.book(club, 'ops', -plan.ops / 12);
      // KI-Vereine investieren hohe Ruecklagen (Infrastruktur, Nachwuchs, Schulden)
      if (cid !== state.user.club) {
        var reserve = Math.max(FM.annualWages(state, club) * 0.6, plan.tv * 0.5);
        if (club.money > reserve) FM.book(club, 'other', -(club.money - reserve) * 0.06);
        // Nicht simulierte Pools (andere Regionalligen, Oberliga) haben keine Heimspiele im Spiel:
        // ihre Zuschauereinnahmen werden pauschal angenommen, damit die Kasse nicht ausblutet
        if (!FM.isSimLeague(club.league) && club.money < 0.05e6) FM.book(club, 'tickets', 0.05e6 - club.money);
        // Zweitvertretungen traegt der Profiverein: er gleicht Fehlbetraege aus
        var parent = club.reserve && state.clubs[club.reserve];
        if (parent && club.money < 0 && parent.id !== state.user.club) {
          var gap = -club.money + 0.05e6;
          FM.book(parent, 'other', -gap);
          FM.book(club, 'other', gap);
        }
      }
    });
    FM.payUpkeep(state);
    FM.boardFinanceCheck(state);
  };

  /* ---------- Vorstand ---------- */
  var EXPECT = {
    bl: [[1, 1, 'Deutsche Meisterschaft'], [4, 4, 'Champions-League-Platz'], [6, 6, 'Europapokal-Teilnahme'], [10, 10, 'Gesichertes Mittelfeld'], [18, 15, 'Klassenerhalt']],
    bl2: [[3, 2, 'Aufstieg in die Bundesliga'], [7, 6, 'Obere Tabellenhälfte'], [12, 11, 'Gesichertes Mittelfeld'], [18, 15, 'Klassenerhalt']],
    l3: [[3, 2, 'Aufstieg in die 2. Bundesliga'], [8, 7, 'Obere Tabellenhälfte'], [14, 13, 'Gesichertes Mittelfeld'], [20, 16, 'Klassenerhalt']],
    rlw: [[2, 1, 'Meisterschaft und Aufstieg in die 3. Liga'], [5, 5, 'Spitzengruppe'], [11, 10, 'Gesichertes Mittelfeld'], [18, 14, 'Klassenerhalt']]
  };
  EXPECT.rlsw = EXPECT.rlw;

  FM.computeExpectations = function (state) {
    FM.simLeagues(state).forEach(function (lid) {
      var ranked = state.leagues[lid].clubs.slice().sort(function (a, b) { return FM.teamStrength(state, b) - FM.teamStrength(state, a); });
      ranked.forEach(function (cid, i) {
        var rank = i + 1, table = EXPECT[lid], e = table[table.length - 1];
        for (var k = 0; k < table.length; k++) { if (rank <= table[k][0]) { e = table[k]; break; } }
        state.clubs[cid].expect = { target: e[1], label: e[2], strengthRank: rank };
      });
    });
  };

  FM.expectationText = function (state, cid) {
    var e = state.clubs[cid].expect;
    if (!e) return '';
    return 'Saisonziel: ' + e.label + ' (mindestens Platz ' + e.target + ').';
  };

  FM.boardAfterMatch = function (state, fx, res, userSide) {
    var user = state.user;
    var gf = userSide === 0 ? res.hg : res.ag, ga = userSide === 0 ? res.ag : res.hg;
    var delta = 0;
    if (FM.isSimLeague(fx.comp)) {
      var pts = gf > ga ? 3 : gf === ga ? 1 : 0;
      var exp = fx.expPts != null ? fx.expPts : 1.4;
      delta = (pts - exp) * 2.4;
      var tbl = FM.table(state, fx.comp);
      var pos = tbl.findIndex(function (r) { return r.club === user.club; }) + 1;
      var target = state.clubs[user.club].expect.target;
      if (fx.round >= 6) {
        if (pos > target + 5) delta -= 1.6;
        else if (pos > target + 2) delta -= 0.6;
        else if (pos <= target) delta += 0.5;
      }
    } else if (fx.comp === 'cup') {
      var won = FM.fixtureWinner(fx) === user.club;
      var opp = fx.home === user.club ? fx.away : fx.home;
      var lowerOpp = FM.levelOf(state, opp) > FM.levelOf(state, user.club);
      delta = won ? 1.5 + fx.round * 0.6 : (lowerOpp ? -6 : -1.5);
    }
    user.conf = FM.clamp(user.conf + delta, 0, 100);
  };

  FM.confLabel = function (c) {
    if (c >= 80) return 'Hervorragend';
    if (c >= 62) return 'Gut';
    if (c >= 45) return 'Stabil';
    if (c >= 30) return 'Angespannt';
    if (c >= 15) return 'Kritisch';
    return 'Vor dem Aus';
  };

  /* ---------- Transferfenster ---------- */
  FM.isWindowOpen = function (state) {
    var m = D.month(state.date);
    return m === 7 || m === 8 || m === 1;
  };
  FM.windowLabel = function (state) {
    var m = D.month(state.date);
    if (m === 7 || m === 8) return 'Sommer-Transferfenster bis 31.08.';
    if (m === 1) return 'Winter-Transferfenster bis 31.01.';
    return 'Transferfenster geschlossen';
  };

  /* ---------- Bewertung von Spielern fuer Transfers ---------- */
  FM.squadRank = function (state, p) {
    if (!p.club) return 99;
    var mates = FM.clubPlayers(state, p.club).sort(function (a, b) { return b.ovr - a.ovr; });
    return mates.findIndex(function (x) { return x.id === p.id; }) + 1;
  };

  FM.askingPrice = function (state, p) {
    if (!p.club) return 0;
    var v = FM.marketValue(p), f = 1.15;
    var rank = FM.squadRank(state, p);
    if (rank <= 3) f += 0.35; else if (rank <= 8) f += 0.15;
    if (p.listed) f -= 0.3;
    var left = p.contract.until - state.season.year;
    if (left <= 1) f -= 0.25;
    if (p.age >= 31) f -= 0.1;
    return FM.niceRound(Math.max(v * f, 25000));
  };

  /* Bereitschaft eines Spielers, zu einem Verein zu wechseln (0–100) */
  FM.interest = function (state, p, buyerId) {
    var buyer = state.clubs[buyerId];
    // Vereinslose orientieren sich an ihrem eigenen Niveau
    var curLevel = p.club ? FM.levelOf(state, p.club) : (p.ovr >= 73 ? 1 : p.ovr >= 67 ? 2 : p.ovr >= 60 ? 3 : 4);
    var newLevel = FM.levelOf(state, buyerId);
    var curRep = p.club ? state.clubs[p.club].rep : Math.max(30, p.ovr - 8);
    var v = 55 + (buyer.rep - curRep) * 1.2 + (curLevel - newLevel) * 18;
    if (p.age >= 31) v += 12;
    if (!p.club) v += 15;
    if (p.club && FM.squadRank(state, p) > 14) v += 12;
    if (p.listed) v += 10;
    if (p.ovr >= 80 && buyer.league !== 'bl') v -= 25;
    return FM.clamp(Math.round(v), 0, 100);
  };

  FM.interestLabel = function (v) {
    if (v >= 70) return { t: 'Sehr interessiert', c: 'good' };
    if (v >= 50) return { t: 'Offen', c: 'ok' };
    if (v >= 35) return { t: 'Zögerlich', c: 'warn' };
    return { t: 'Kein Interesse', c: 'bad' };
  };

  FM.contractWageDemand = function (state, p, clubId, interest) {
    var base = FM.wageDemand(p, state.clubs[clubId].league);
    var f = 1 + Math.max(0, (60 - interest)) / 120;
    if (p.club === clubId) f = 1 + Math.max(0, (p.ovr - 70)) / 200;
    return FM.niceRound(base * f);
  };

  /* ---------- Transfer ausfuehren ---------- */
  FM.executeTransfer = function (state, p, toId, fee, wage, years) {
    var fromId = p.club;
    var to = state.clubs[toId];
    wage = wage || FM.wageDemand(p, to.league);
    var cost = FM.transferCost(state, to, p, fee || 0, wage);
    var credited = 0;
    if (fromId) {
      var from = state.clubs[fromId];
      from.squad = from.squad.filter(function (id) { return id !== p.id; });
      if (fee) FM.book(from, 'sales', fee);
      if (fee && fromId === state.user.club) credited = FM.creditSale(state, from, fee, 'Verkauf ' + p.name + ' an ' + to.short);
      if (from.lineup) {
        from.lineup.slots.forEach(function (s) { if (s.pid === p.id) s.pid = null; });
        from.lineup.bench = (from.lineup.bench || []).filter(function (id) { return id !== p.id; });
      }
    } else {
      state.free = state.free.filter(function (id) { return id !== p.id; });
    }
    if (fee) FM.book(to, 'buys', -fee);
    if (cost.agent + cost.bonus) FM.book(to, 'fees', -(cost.agent + cost.bonus));
    to.squad.push(p.id);
    p.club = toId;
    p.listed = false;
    p.joined = state.season.year;
    p.contract = { until: state.season.year + (years || 3), wage: wage };
    p.mor = Math.min(100, p.mor + 10);
    var rec = { date: state.date, pid: p.id, name: p.name, from: fromId, to: toId, fee: fee || 0, ovr: p.ovr, age: p.age, pos: p.pos[0], cost: cost.total, credited: credited };
    state.transfers.unshift(rec);
    if (state.transfers.length > 400) state.transfers.length = 400;
    state.offers = state.offers.filter(function (o) { return o.pid !== p.id; });
    return rec;
  };

  FM.releasePlayer = function (state, p) {
    var club = state.clubs[p.club];
    var left = Math.max(0, p.contract.until - state.season.year);
    var cost = Math.round(p.contract.wage * Math.max(0.5, left) * 0.5);
    FM.book(club, 'other', -cost);
    club.squad = club.squad.filter(function (id) { return id !== p.id; });
    if (club.lineup) {
      club.lineup.slots.forEach(function (s) { if (s.pid === p.id) s.pid = null; });
      club.lineup.bench = (club.lineup.bench || []).filter(function (id) { return id !== p.id; });
    }
    p.club = null; p.listed = false;
    p.contract = { until: state.season.year + 1, wage: FM.wageDemand(p, 'bl2') };
    state.free.push(p.id);
    return cost;
  };

  /* Angebot des Spielers (Nutzer) an einen anderen Verein / Spieler */
  FM.userBid = function (state, p, fee, wage, years) {
    var buyer = state.clubs[state.user.club];
    if (p.club === buyer.id) return { ok: false, msg: 'Der Spieler steht bereits bei dir unter Vertrag.' };
    if (p.club && !FM.isWindowOpen(state)) return { ok: false, msg: 'Das Transferfenster ist geschlossen. Vereinslose Spieler kannst du jederzeit verpflichten.' };
    if (buyer.squad.length >= 34) return { ok: false, msg: 'Dein Kader ist voll (max. 34 Spieler).' };
    var cost = FM.transferCost(state, buyer, p, p.club ? fee : 0, wage);
    var budgetErr = FM.checkBudget(state, buyer, cost, wage);
    if (budgetErr) return { ok: false, msg: budgetErr, budget: true };
    var interest = FM.interest(state, p, buyer.id);
    if (interest < 35) return { ok: false, msg: p.name + ' hat kein Interesse an einem Wechsel zu deinem Verein.' };
    if (p.club) {
      var seller = state.clubs[p.club];
      var ask = FM.askingPrice(state, p);
      var rank = FM.squadRank(state, p);
      if (rank <= 3 && seller.rep > buyer.rep + 12 && fee < ask * 1.6) {
        return { ok: false, msg: seller.short + ' will seinen Leistungsträger nicht abgeben – nicht unter ' + FM.fmtMoney(FM.niceRound(ask * 1.6)) + '.', counter: FM.niceRound(ask * 1.6) };
      }
      if (seller.squad.length <= 18) return { ok: false, msg: seller.short + ' hat einen zu kleinen Kader und gibt niemanden ab.' };
      var accept = ask * R.range(0.93, 1.03);
      if (fee < accept) {
        if (fee >= ask * 0.72) return { ok: false, msg: seller.short + ' lehnt ab, wäre aber bei ' + FM.fmtMoney(ask) + ' gesprächsbereit.', counter: ask };
        return { ok: false, msg: seller.short + ' lehnt das Angebot ab. Die Vorstellungen liegen deutlich höher.' };
      }
    }
    var demand = FM.contractWageDemand(state, p, buyer.id, interest);
    if (wage < demand * 0.95) {
      return { ok: false, msg: p.name + ' fordert mindestens ' + FM.fmtMoney(demand) + ' Jahresgehalt.', wageCounter: demand };
    }
    var rec = FM.executeTransfer(state, p, buyer.id, p.club ? fee : 0, wage, years);
    if (rec.cost) FM.spendBudget(state, buyer, rec.cost, 'Verpflichtung ' + p.name);
    FM.addNews(state, {
      type: 'transfer', title: p.name + ' unterschreibt',
      body: p.name + ' wechselt ' + (rec.from ? 'von ' + state.clubs[rec.from].name + ' ' : 'ablösefrei ') + 'zu ' + buyer.name +
        (rec.fee ? ' (Ablöse ' + FM.fmtMoney(rec.fee) + ')' : '') + '. Vertrag bis ' + p.contract.until + ', Jahresgehalt ' + FM.fmtMoney(wage) + '.' +
        (rec.cost ? ' Belastung des Transferbudgets inklusive ' + (rec.fee ? 'Beraterhonorar' : 'Handgeld') + ': ' + FM.fmtMoney(rec.cost) + '.' : '')
    });
    return { ok: true, msg: p.name + ' ist verpflichtet!' };
  };

  FM.extendContract = function (state, p, wage, years) {
    var demand = FM.contractWageDemand(state, p, p.club, 70);
    if (p.mor < 25) return { ok: false, msg: p.name + ' ist unzufrieden und will nicht verlängern.' };
    if (p.age >= 33 && years > 2) return { ok: false, msg: p.name + ' möchte sich höchstens zwei Jahre binden.' };
    if (wage < demand * 0.95) return { ok: false, msg: p.name + ' fordert ' + FM.fmtMoney(demand) + ' pro Jahr.', wageCounter: demand };
    var club = state.clubs[p.club];
    if (club.id === state.user.club) {
      var raise = wage - p.contract.wage, room = FM.wageRoom(state, club);
      if (raise > 0 && raise > room) {
        return { ok: false, budget: true, msg: 'Das Gehaltsbudget reicht nicht: Die Erhöhung um ' + FM.fmtMoney(raise) + ' übersteigt den Spielraum von ' + FM.fmtMoney(Math.max(0, room)) + ' pro Jahr. Schichte Transferbudget ins Gehaltsbudget um.' };
      }
    }
    p.contract = { until: state.season.year + years, wage: wage };
    p.mor = Math.min(100, p.mor + 8);
    return { ok: true, msg: 'Vertrag bis ' + p.contract.until + ' verlängert.' };
  };

  /* ---------- Angebote fuer Spieler des Nutzers ---------- */
  FM.generateOffersForUser = function (state) {
    if (!FM.isWindowOpen(state)) return;
    var uc = state.clubs[state.user.club];
    FM.clubPlayers(state, uc.id).forEach(function (p) {
      if (state.offers.some(function (o) { return o.pid === p.id && o.status === 'open'; })) return;
      var chance = p.listed ? 0.09 : (p.ovr >= 78 ? 0.005 : 0.0015);
      if (!R.chance(chance)) return;
      var value = FM.marketValue(p);
      var buyers = Object.keys(state.clubs).filter(function (cid) {
        var c = state.clubs[cid];
        return cid !== uc.id && FM.isSimLeague(c.league) && !c.reserve && c.money > value * 1.1 &&
          (p.listed ? Math.abs(c.rep - uc.rep) < 25 : c.rep >= uc.rep - 3) && FM.interest(state, p, cid) >= 40;
      });
      if (!buyers.length) return;
      var buyer = R.pick(buyers);
      var fee = FM.niceRound(value * (p.listed ? R.range(0.72, 1.05) : R.range(1.05, 1.5)));
      var offer = { id: 'o' + (state.offerSeq = (state.offerSeq || 0) + 1), pid: p.id, from: buyer, fee: fee, date: state.date, expires: D.add(state.date, 6), status: 'open' };
      state.offers.push(offer);
      FM.addNews(state, {
        type: 'offer', important: true,
        title: 'Angebot für ' + p.name,
        body: state.clubs[buyer].name + ' bietet ' + FM.fmtMoney(fee) + ' für ' + p.name + ' (Marktwert ' + FM.fmtMoney(value) + '). Das Angebot gilt bis ' + D.fmt(offer.expires) + '.',
        action: { kind: 'offer', id: offer.id }
      });
    });
  };

  FM.respondOffer = function (state, offerId, accept) {
    var o = state.offers.filter(function (x) { return x.id === offerId; })[0];
    if (!o || o.status !== 'open') return { ok: false, msg: 'Das Angebot ist nicht mehr gültig.' };
    var p = state.players[o.pid];
    if (!accept) { o.status = 'declined'; return { ok: true, msg: 'Angebot abgelehnt.' }; }
    if (!FM.isWindowOpen(state)) { o.status = 'expired'; return { ok: false, msg: 'Das Transferfenster ist inzwischen geschlossen.' }; }
    if (!p || p.club !== state.user.club) { o.status = 'expired'; return { ok: false, msg: 'Der Spieler gehört nicht mehr zu deinem Kader.' }; }
    var buyer = state.clubs[o.from];
    if (buyer.money < o.fee) { o.status = 'expired'; return { ok: false, msg: buyer.short + ' kann die Summe nicht mehr aufbringen.' }; }
    var rec = FM.executeTransfer(state, p, o.from, o.fee, FM.wageDemand(p, buyer.league), R.int(2, 4));
    o.status = 'accepted';
    FM.addNews(state, { type: 'transfer', title: p.name + ' verlässt den Verein', body: p.name + ' wechselt für ' + FM.fmtMoney(o.fee) + ' zu ' + buyer.name + '. Davon fließen ' + FM.fmtMoney(rec.credited) + ' ins Transferbudget.' });
    return { ok: true, msg: p.name + ' wurde an ' + buyer.short + ' verkauft. +' + FM.fmtMoney(rec.credited) + ' Transferbudget.' };
  };

  FM.expireOffers = function (state) {
    state.offers.forEach(function (o) { if (o.status === 'open' && o.expires < state.date) o.status = 'expired'; });
    state.offers = state.offers.filter(function (o) { return o.status === 'open' || D.diff(o.date, state.date) < 30; });
  };

  /* ---------- KI-Transfers ---------- */
  function weakestSlot(state, cid) {
    var club = state.clubs[cid];
    var players = FM.clubPlayers(state, cid);
    var a = FM.assignFormation(players, club.formation || '4-4-2');
    var worst = null;
    a.slots.forEach(function (s) {
      var p = s.pid ? state.players[s.pid] : null;
      var v = p ? FM.effectiveRating(p, s.pos) : 0;
      if (!worst || v < worst.v) worst = { pos: s.pos, v: v };
    });
    return worst;
  }

  FM.aiTransferRound = function (state, maxDeals) {
    var userClub = state.user.club;
    var clubs = R.shuffle(Object.keys(state.clubs).filter(function (cid) {
      var c = state.clubs[cid];
      return cid !== userClub && FM.isSimLeague(c.league) && !c.reserve;
    }));
    var deals = 0;
    var allPlayers = Object.keys(state.players).map(function (k) { return state.players[k]; });
    for (var i = 0; i < clubs.length && deals < maxDeals; i++) {
      var cid = clubs[i], club = state.clubs[cid];
      if (!R.chance(0.35)) continue;
      var budget = Math.max(0, club.money * 0.45) + (FM.isRegional(club.league) ? club.aiPot || 0 : 0);
      var weak = weakestSlot(state, cid);
      if (!weak) continue;
      var need = weak.v + 2;
      var best = null, bestScore = -1;
      for (var k = 0; k < allPlayers.length; k++) {
        var p = allPlayers[k];
        if (p.club === cid || p.club === userClub || p.injury) continue;
        if (p.club && state.clubs[p.club].reserve) continue;
        if (FM.positionPenalty(p, weak.pos) > 2) continue;
        var eff = p.ovr - FM.positionPenalty(p, weak.pos);
        if (eff < need) continue;
        var price = p.club ? FM.askingPrice(state, p) : 0;
        var wage = FM.wageDemand(p, club.league);
        if (price > budget) continue;
        if (wage > Math.max(club.money * 0.12, FM.annualPlan(club).tv * 0.18)) continue;
        if (FM.interest(state, p, cid) < 50) continue;
        if (p.club && state.clubs[p.club].squad.length <= 19) continue;
        if (p.club && FM.squadRank(state, p) <= 2 && state.clubs[p.club].rep > club.rep - 8) continue;
        var score = (eff - weak.v) * 10 - price / 1e6 - (p.age > 30 ? (p.age - 30) * 4 : 0) + (p.age < 25 ? 4 : 0);
        if (score > bestScore) { bestScore = score; best = { p: p, price: price, wage: wage }; }
      }
      if (!best) continue;
      var rec = FM.executeTransfer(state, best.p, cid, best.price, best.wage, R.int(2, 4));
      if (club.aiPot && rec.cost) { var sp = Math.min(club.aiPot, rec.cost); club.aiPot -= sp; FM.book(club, 'sponsor', sp); }
      deals++;
      FM.aiTrimSquad(state, cid);
      var ul = state.clubs[userClub].league;
      var touchesLeague = club.league === ul || (rec.from && state.clubs[rec.from].league === ul);
      if (rec.fee >= 15e6 || (touchesLeague && (rec.fee >= 1e6 || best.p.ovr >= 70))) {
        FM.addNews(state, {
          type: 'market', quiet: true, title: 'Transfer: ' + best.p.name + ' → ' + club.short,
          body: best.p.name + ' (' + FM.POS_LABEL[best.p.pos[0]] + ', ' + best.p.ovr + ') wechselt ' + (rec.from ? 'von ' + state.clubs[rec.from].name : 'ablösefrei') + ' zu ' + club.name + (rec.fee ? ' – Ablöse ' + FM.fmtMoney(rec.fee) : '') + '.'
        });
      }
    }
    // Vereinslose Spieler fuer zu kleine Kader
    clubs.forEach(function (cid) {
      var club = state.clubs[cid];
      while (club.squad.length < 21 && state.free.length) {
        var cand = state.free.map(function (id) { return state.players[id]; })
          .filter(function (p) { return p && FM.interest(state, p, cid) >= 40; })
          .sort(function (a, b) { return b.ovr - a.ovr; })[0];
        if (!cand) break;
        FM.executeTransfer(state, cand, cid, 0, FM.wageDemand(cand, club.league), R.int(1, 2));
      }
    });
    return deals;
  };

  FM.aiTrimSquad = function (state, cid) {
    var club = state.clubs[cid];
    if (club.squad.length <= 30) return;
    var players = FM.clubPlayers(state, cid).sort(function (a, b) { return (a.ovr + (a.age < 21 ? 6 : 0)) - (b.ovr + (b.age < 21 ? 6 : 0)); });
    while (club.squad.length > 30) {
      var p = players.shift();
      if (!p) break;
      if (FM.isGK(p) && FM.clubPlayers(state, cid).filter(FM.isGK).length <= 2) continue;
      FM.releasePlayer(state, p);
    }
  };
})();
