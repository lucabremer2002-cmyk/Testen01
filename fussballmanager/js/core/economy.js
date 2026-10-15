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
    infra: 'Infrastruktur', other: 'Sonstiges'
  };

  var MIN_COMMERCIAL = { bl: 8e6, bl2: 2.5e6, l3: 0.6e6, rl: 0.2e6 };

  function tvAndOps(club) {
    var rep = club.rep, l = club.league, tv, ops;
    if (l === 'bl') { tv = 25e6 + (rep - 50) * 0.7e6; ops = 14e6 + (rep - 50) * 0.5e6; }
    else if (l === 'bl2') { tv = 9e6 + (rep - 50) * 0.25e6; ops = 4e6 + (rep - 50) * 0.1e6; }
    else if (l === 'l3') { tv = 1.6e6 + (rep - 40) * 0.03e6; ops = 1.3e6 + (rep - 40) * 0.03e6; }
    else { tv = 0.2e6; ops = 0.35e6; }
    return { tv: Math.max(0.1e6, tv), ops: Math.max(0.2e6, ops) };
  }

  /* Sponsoring/Marketing wird beim Spielstart so kalibriert, dass jeder Verein mit
     seinem echten Kader wirtschaftlich solide (leichter Ueberschuss) startet. */
  /* Erwartete Auslastung und Zuschauereinnahmen einer Saison (Liga-Heimspiele) */
  FM.expectedFill = function (club, cap) {
    var fill = 0.55 + (club.rep - 40) / 100 + ({ bl: 0.25, bl2: 0.12, l3: 0, rl: -0.1 }[club.league] || 0);
    if (club.league !== 'bl') fill *= Math.min(1, 45000 / (cap || club.cap) + 0.25);
    return FM.clamp(fill, 0.25, 1);
  };
  FM.expectedTickets = function (club, cap) {
    cap = cap || club.cap;
    var homeGames = club.league === 'l3' ? 19 : 17;
    return cap * FM.expectedFill(club, cap) * (FM.ticketPrice[club.league] || 10) * homeGames;
  };

  FM.calibrateCommercial = function (state, club) {
    var base = tvAndOps(club);
    var tickets = FM.expectedTickets(club);
    var wages = FM.annualWages(state, club);
    var need = (wages + base.ops + (FM.facUpkeep ? FM.facUpkeep(club) : 0)) * 1.03 - base.tv - tickets;
    club.commercial = Math.round(Math.max(MIN_COMMERCIAL[club.league] || 0.2e6, need));
  };

  FM.annualPlan = function (club) {
    var b = tvAndOps(club);
    var sponsor = (club.commercial || MIN_COMMERCIAL[club.league] || 0.2e6) * (FM.facCommercial ? FM.facCommercial(club) : 1);
    return { tv: b.tv, sponsor: sponsor, ops: b.ops, upkeep: FM.facUpkeep ? FM.facUpkeep(club) : 0 };
  };

  /* Ligawechsel/Erfolg wirken sich auf die Vermarktung aus */
  FM.adjustCommercial = function (club, oldLeague, newLeague, repDelta) {
    var lv = { bl: 1, bl2: 2, l3: 3, rl: 4 };
    var f = 1 + (repDelta || 0) * 0.02;
    if (lv[newLeague] < lv[oldLeague]) f *= 1.45;
    if (lv[newLeague] > lv[oldLeague]) f *= 0.62;
    club.commercial = Math.round(Math.max(MIN_COMMERCIAL[newLeague] || 0.2e6, (club.commercial || 0) * f));
  };

  FM.ticketPrice = { bl: 36, bl2: 24, l3: 15, rl: 10 };

  FM.attendance = function (state, homeId, awayId, comp) {
    var c = state.clubs[homeId], a = state.clubs[awayId];
    var boost = { bl: 0.25, bl2: 0.12, l3: 0, rl: -0.1 }[c.league];
    var fill = 0.55 + (c.rep - 40) / 100 + boost + (a.rep - 60) / 400;
    if (comp === 'cup' || comp === 'po1' || comp === 'po2') fill += 0.15;
    var cap = FM.effectiveCap ? FM.effectiveCap(c) : c.cap;
    if (c.league !== 'bl') fill *= Math.min(1, 45000 / cap + 0.25);
    fill = FM.clamp(fill + R.range(-0.04, 0.04), 0.25, 1);
    return Math.round(cap * fill);
  };

  FM.book = function (club, key, amount) {
    club.money += amount;
    club.fin[key] = (club.fin[key] || 0) + amount;
  };

  /* Gehaltslast: eigene Spieler, bei Leihen anteilig fuer Leih- und Stammverein */
  FM.annualWages = function (state, club) {
    var sum = 0;
    club.squad.forEach(function (pid) { var p = state.players[pid]; if (p) sum += p.contract.wage * (p.loan ? p.loan.share : 1); });
    (club.loanedOut || []).forEach(function (pid) { var p = state.players[pid]; if (p && p.loan) sum += p.contract.wage * (1 - p.loan.share); });
    return sum;
  };
  FM.weeklyWages = function (state, club) { return FM.annualWages(state, club) / 52; };

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
      if (plan.upkeep) FM.book(club, 'infra', -plan.upkeep / 12);
      // KI-Vereine investieren hohe Ruecklagen (Infrastruktur, Nachwuchs, Schulden)
      if (cid !== state.user.club) {
        var reserve = Math.max(FM.annualWages(state, club) * 0.6, plan.tv * 0.5);
        if (club.money > reserve) FM.book(club, 'other', -(club.money - reserve) * 0.06);
      }
    });
  };

  /* ---------- Vorstand ---------- */
  var EXPECT = {
    bl: [[1, 1, 'Deutsche Meisterschaft'], [4, 4, 'Champions-League-Platz'], [6, 6, 'Europapokal-Teilnahme'], [10, 10, 'Gesichertes Mittelfeld'], [18, 15, 'Klassenerhalt']],
    bl2: [[3, 2, 'Aufstieg in die Bundesliga'], [7, 6, 'Obere Tabellenhälfte'], [12, 11, 'Gesichertes Mittelfeld'], [18, 15, 'Klassenerhalt']],
    l3: [[3, 2, 'Aufstieg in die 2. Bundesliga'], [8, 7, 'Obere Tabellenhälfte'], [14, 13, 'Gesichertes Mittelfeld'], [20, 16, 'Klassenerhalt']]
  };

  FM.computeExpectations = function (state) {
    ['bl', 'bl2', 'l3'].forEach(function (lid) {
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
    if (fx.comp === 'bl' || fx.comp === 'bl2' || fx.comp === 'l3') {
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
    if (p.wants) f -= 0.15;
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
    if (p.wants) v += 12;
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

  /* ---------- Transfer ausfuehren ----------
     opts: inst (Raten 1-3), sellOn (Weiterverkaufsanteil fuer den Abgeber), swap (Spieler-ID im Tausch),
           role, clause (Ausstiegsklausel), bonus (Handgeld) */
  FM.executeTransfer = function (state, p, toId, fee, wage, years, opts) {
    opts = opts || {};
    var fromId = p.club;
    var to = state.clubs[toId], uc = state.user.club;
    var inst = fee ? FM.clamp(opts.inst || 1, 1, 3) : 1;
    var nowPart = inst > 1 ? Math.round(fee / inst) : fee;
    if (p.loan) FM.endLoan(state, p, true);
    fromId = p.club;
    if (fromId) {
      var from = state.clubs[fromId];
      FM.detachPlayer(state, p);
      if (fee) {
        // Weiterverkaufsbeteiligung eines frueheren Vereins
        var cut = 0;
        if (p.sellOn && p.sellOn.club !== toId && state.clubs[p.sellOn.club]) {
          cut = Math.round(fee * p.sellOn.pct);
          FM.book(state.clubs[p.sellOn.club], 'sales', cut);
          if (p.sellOn.club === uc) {
            FM.creditSale(state, state.clubs[uc], cut);
            FM.addNews(state, { type: 'market', title: 'Weiterverkauf: ' + p.name, body: p.name + ' wechselt für ' + FM.fmtMoney(fee) + ' zu ' + to.name + '. Dank der Weiterverkaufsbeteiligung erhältst du ' + FM.fmtMoney(cut) + '.' });
          }
        }
        FM.book(from, 'sales', nowPart - cut);
        if (fromId === uc) FM.creditSale(state, from, nowPart - cut);
      }
    } else {
      state.free = state.free.filter(function (id) { return id !== p.id; });
    }
    if (fee) {
      FM.book(to, 'buys', -nowPart);
      if (inst > 1 && fromId) {
        state.payments = state.payments || [];
        for (var i = 1; i < inst; i++) {
          state.payments.push({ from: toId, to: fromId, amount: Math.round(fee / inst), due: D.iso(state.season.year + i, 7, 1), name: p.name + ', Rate ' + (i + 1) + '/' + inst });
        }
      }
    }
    if (toId === uc) {
      // Nebenkosten: Beraterhonorar bei Abloese, Handgeld (verhandelt oder pauschal bei Vereinslosen)
      var agent = fromId ? Math.round(fee * FM.AGENT_FEE) : 0;
      var bonus = opts.bonus != null ? opts.bonus : fromId ? 0 : Math.round((wage || 0) * FM.SIGNING_BONUS);
      if (agent + bonus) FM.book(to, 'fees', -(agent + bonus));
      FM.spendBudget(state, to, nowPart + agent + bonus);
    }
    to.squad.push(p.id);
    p.club = toId;
    p.listed = false;
    p.loanList = false;
    p.wants = false;
    p.unhappy = 0;
    p.pre = null;
    p.joined = state.season.year;
    p.joinDate = state.date;
    p.sellOn = fee && opts.sellOn && fromId ? { club: fromId, pct: opts.sellOn } : fee ? null : p.sellOn || null;
    p.contract = { until: state.season.year + (years || 3), wage: wage || FM.wageDemand(p, to.league) };
    if (opts.role) p.contract.role = opts.role;
    if (opts.clause) p.contract.clause = opts.clause;
    p.mor = Math.min(100, p.mor + 10);
    var rec = { date: state.date, pid: p.id, name: p.name, from: fromId, to: toId, fee: fee || 0, ovr: p.ovr, age: p.age, pos: p.pos[0] };
    // Tauschspieler geht zum abgebenden Verein
    if (opts.swap && fromId && state.players[opts.swap]) {
      var sw = state.players[opts.swap];
      var left = Math.max(1, sw.contract.until - state.season.year);
      FM.executeTransfer(state, sw, fromId, 0, sw.contract.wage, left);
      state.transfers[0].swapFor = p.id;
      rec.swap = sw.id;
    }
    state.transfers.unshift(rec);
    if (state.transfers.length > 400) state.transfers.length = 400;
    state.offers = state.offers.filter(function (o) { return o.pid !== p.id; });
    if (state.talks) delete state.talks[p.id];
    return rec;
  };

  FM.releasePlayer = function (state, p) {
    if (p.loan) { FM.endLoan(state, p); return 0; }
    var club = state.clubs[p.club];
    var left = Math.max(0, p.contract.until - state.season.year);
    var cost = Math.round(p.contract.wage * Math.max(0.5, left) * 0.5);
    FM.book(club, 'other', -cost);
    if (club.id === state.user.club && club.budget) club.budget.transfer = Math.max(0, club.budget.transfer - cost);
    club.squad = club.squad.filter(function (id) { return id !== p.id; });
    if (club.lineup) {
      club.lineup.slots.forEach(function (s) { if (s.pid === p.id) s.pid = null; });
      club.lineup.bench = (club.lineup.bench || []).filter(function (id) { return id !== p.id; });
    }
    p.club = null; p.listed = false; p.loanList = false; p.wants = false; p.pre = null; p.sellOn = null;
    p.contract = { until: state.season.year + 1, wage: FM.wageDemand(p, 'bl2') };
    state.free.push(p.id);
    return cost;
  };

  /* ---------- Angebote fuer Spieler des Nutzers ---------- */
  FM.generateOffersForUser = function (state) {
    if (!FM.isWindowOpen(state)) return;
    var uc = state.user.club, me = state.clubs[uc];
    var deadline = FM.isDeadlineDay(state);
    FM.clubPlayers(state, uc).forEach(function (p) {
      if (p.loan || p.pre) return;
      var open = state.offers.filter(function (o) { return o.pid === p.id && o.status === 'open'; });
      if (open.length >= 2) return;
      // Leihanfragen fuer Spieler auf der Leihliste
      if (p.loanList && !open.length) {
        if (!R.chance(deadline ? 0.16 : 0.08)) return;
        var lenders = Object.keys(state.clubs).filter(function (cid) {
          var c = state.clubs[cid];
          return cid !== uc && !c.reserve && c.league !== 'rl' && FM.levelOf(state, cid) >= FM.levelOf(state, uc) && c.squad.length < 32 && FM.expectedRole(state, p, cid) !== 'squad';
        });
        if (!lenders.length) return;
        var lc = R.pick(lenders);
        var lo = { id: 'o' + (state.offerSeq = (state.offerSeq || 0) + 1), type: 'loan', pid: p.id, from: lc, fee: 0, share: R.pick([0.5, 0.75, 1]), option: R.chance(0.3) ? FM.niceRound(FM.marketValue(p) * R.range(1.1, 1.4)) : 0, date: state.date, expires: D.add(state.date, 6), status: 'open' };
        state.offers.push(lo);
        FM.addNews(state, { type: 'offer', important: true, title: 'Leihanfrage für ' + p.name, body: state.clubs[lc].name + ' möchte ' + p.name + ' bis Saisonende ausleihen und ' + Math.round(lo.share * 100) + ' % seines Gehalts zahlen' + (lo.option ? ', mit Kaufoption über ' + FM.fmtMoney(lo.option) : '') + '. Als ' + FM.ROLE_LABEL[FM.expectedRole(state, p, lc)] + ' bekäme er dort Spielpraxis.', action: { kind: 'offer', id: lo.id } });
        return;
      }
      var hot = p.listed || p.wants;
      var chance = hot ? 0.09 : (p.ovr >= 78 ? 0.005 : 0.0015);
      if (open.length) chance = 0.07;      // Bieterwettstreit
      if (deadline) chance *= 2;
      if (!R.chance(chance)) return;
      var value = FM.marketValue(p);
      var buyers = Object.keys(state.clubs).filter(function (cid) {
        var c = state.clubs[cid];
        return cid !== uc && c.league !== 'rl' && !c.reserve && c.money > value * 1.1 &&
          (hot ? Math.abs(c.rep - me.rep) < 25 : c.rep >= me.rep - 3) && FM.interest(state, p, cid) >= 40 &&
          !open.some(function (o) { return o.from === cid; });
      });
      if (!buyers.length) return;
      var buyer = R.pick(buyers);
      var fee = FM.niceRound(value * (hot ? R.range(0.72, 1.05) : R.range(1.05, 1.5)) * (deadline && hot ? 0.9 : 1));
      if (open.length) fee = FM.niceUp(Math.max(fee, open[0].fee * R.range(1.05, 1.15)));
      var offer = { id: 'o' + (state.offerSeq = (state.offerSeq || 0) + 1), type: 'buy', pid: p.id, from: buyer, fee: fee, max: Math.round(fee * (hot ? R.range(1, 1.15) : R.range(1.05, 1.35))), rounds: 0, date: state.date, expires: D.add(state.date, 6), status: 'open' };
      state.offers.push(offer);
      FM.addNews(state, {
        type: 'offer', important: true,
        title: (open.length ? 'Bieterwettstreit um ' : 'Angebot für ') + p.name,
        body: state.clubs[buyer].name + ' bietet ' + FM.fmtMoney(fee) + ' für ' + p.name + ' (Marktwert ' + FM.fmtMoney(value) + ')' +
          (open.length ? ' und überbietet damit ' + state.clubs[open[0].from].short : '') + '. Das Angebot gilt bis ' + D.fmt(offer.expires) + '.',
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
    if (!p || p.club !== state.user.club || p.loan) { o.status = 'expired'; return { ok: false, msg: 'Der Spieler gehört nicht mehr zu deinem Kader.' }; }
    var buyer = state.clubs[o.from];
    if (o.type === 'loan') {
      FM.executeLoan(state, p, o.from, o.share, o.option);
      o.status = 'accepted';
      FM.addNews(state, { type: 'transfer', title: p.name + ' verliehen', body: p.name + ' spielt bis Saisonende auf Leihbasis für ' + buyer.name + '.' });
      return { ok: true, msg: p.name + ' ist an ' + buyer.short + ' verliehen.' };
    }
    if (buyer.money < o.fee) { o.status = 'expired'; return { ok: false, msg: buyer.short + ' kann die Summe nicht mehr aufbringen.' }; }
    FM.executeTransfer(state, p, o.from, o.fee, FM.wageDemand(p, buyer.league), R.int(2, 4));
    o.status = 'accepted';
    FM.addNews(state, { type: 'transfer', title: p.name + ' verlässt den Verein', body: p.name + ' wechselt für ' + FM.fmtMoney(o.fee) + ' zu ' + buyer.name + '.' });
    return { ok: true, msg: p.name + ' wurde an ' + buyer.short + ' verkauft.' };
  };

  /* Nachverhandeln: mehr Geld fuer den eigenen Spieler verlangen */
  FM.counterOffer = function (state, offerId, ask) {
    var o = state.offers.filter(function (x) { return x.id === offerId; })[0];
    if (!o || o.status !== 'open' || o.type === 'loan') return { ok: false, msg: 'Das Angebot ist nicht mehr gültig.' };
    var buyer = state.clubs[o.from];
    ask = Math.round(ask);
    if (ask <= o.fee) return FM.respondOffer(state, offerId, true);
    o.rounds = (o.rounds || 0) + 1;
    if (ask <= (o.max || o.fee) && buyer.money >= ask) {
      o.fee = ask;
      var r = FM.respondOffer(state, offerId, true);
      if (r.ok) r.msg = buyer.short + ' akzeptiert ' + FM.fmtMoney(ask) + '. ' + r.msg;
      return r;
    }
    if (o.rounds >= 2 || R.chance(0.35)) {
      o.status = 'declined';
      return { ok: false, msg: buyer.short + ' ist das zu teuer und zieht das Angebot zurück.' };
    }
    o.fee = FM.niceRound(Math.min(o.max || o.fee, (o.fee + ask) / 2));
    return { ok: false, improved: true, msg: buyer.short + ' bessert auf ' + FM.fmtMoney(o.fee) + ' nach – mehr ist kaum drin.' };
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
      return cid !== userClub && c.league !== 'rl' && !c.reserve;
    }));
    var deals = 0;
    var allPlayers = Object.keys(state.players).map(function (k) { return state.players[k]; });
    for (var i = 0; i < clubs.length && deals < maxDeals; i++) {
      var cid = clubs[i], club = state.clubs[cid];
      if (!R.chance(0.35)) continue;
      var budget = Math.max(0, Math.min(club.money * 0.45, club.money - FM.cashReserve(state, club)));
      var weak = weakestSlot(state, cid);
      if (!weak) continue;
      var need = weak.v + 2;
      var best = null, bestScore = -1;
      for (var k = 0; k < allPlayers.length; k++) {
        var p = allPlayers[k];
        if (p.club === cid || p.club === userClub || p.injury || p.loan || p.pre) continue;
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
      if (!best) {
        if (R.chance(0.35) && aiLoan(state, cid, weak, allPlayers)) deals++;
        continue;
      }
      var rec = FM.executeTransfer(state, best.p, cid, best.price, best.wage, R.int(2, 4));
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

  /* KI leiht einen Spieler aus, wenn fuer einen Kauf das Geld fehlt */
  function aiLoan(state, cid, weak, allPlayers) {
    var club = state.clubs[cid], userClub = state.user.club;
    var loaned = FM.clubPlayers(state, cid).filter(function (x) { return x.loan; }).length;
    if (loaned >= 2 || club.squad.length >= 30) return false;
    var best = null;
    for (var k = 0; k < allPlayers.length; k++) {
      var p = allPlayers[k];
      if (!p.club || p.club === cid || p.club === userClub || p.injury || p.age > 24) continue;
      if (!FM.loanable(state, p) || state.clubs[p.club].rep <= club.rep) continue;
      if (FM.positionPenalty(p, weak.pos) > 2) continue;
      var eff = p.ovr - FM.positionPenalty(p, weak.pos);
      if (eff < weak.v + 2) continue;
      if (!best || eff > best.eff) best = { p: p, eff: eff };
    }
    if (!best) return false;
    var p = best.p, owner = state.clubs[p.club];
    var option = R.chance(0.3) ? FM.niceRound(FM.askingPrice(state, p) * 1.2) : 0;
    FM.executeLoan(state, p, cid, R.pick([0.5, 0.75, 1]), option);
    var ul = state.clubs[userClub].league;
    if (club.league === ul || owner.league === ul) {
      FM.addNews(state, { type: 'market', quiet: true, title: 'Leihe: ' + p.name + ' → ' + club.short, body: p.name + ' wird bis Saisonende von ' + owner.name + ' an ' + club.name + ' verliehen' + (option ? ' (Kaufoption ' + FM.fmtMoney(option) + ')' : '') + '.' });
    }
    return true;
  }

  FM.aiTrimSquad = function (state, cid) {
    var club = state.clubs[cid];
    if (club.squad.length <= 30) return;
    var players = FM.clubPlayers(state, cid).sort(function (a, b) { return (a.ovr + (a.age < 21 ? 6 : 0)) - (b.ovr + (b.age < 21 ? 6 : 0)); });
    while (club.squad.length > 30) {
      var p = players.shift();
      if (!p) break;
      if (p.loan) continue;
      if (FM.isGK(p) && FM.clubPlayers(state, cid).filter(FM.isGK).length <= 2) continue;
      FM.releasePlayer(state, p);
    }
  };
})();
