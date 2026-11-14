/* Transfersystem: Verhandlungen mit Verein und Spieler, Leihen, Ausstiegsklauseln,
   Vorvertraege, Ratenzahlungen, Scouting und Kaderrollen. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  /* ================= Kaderrollen ================= */
  FM.ROLES = ['key', 'start', 'rot', 'squad', 'prospect'];
  FM.ROLE_LABEL = { key: 'Schlüsselspieler', start: 'Stammspieler', rot: 'Rotationsspieler', squad: 'Ergänzungsspieler', prospect: 'Perspektivspieler' };
  var ROLE_RANK = { key: 0, start: 1, rot: 2, squad: 3, prospect: 3 };
  // erwarteter Anteil an den moeglichen Spielminuten
  var ROLE_SHARE = { key: 0.65, start: 0.45, rot: 0.12, squad: 0, prospect: 0 };
  var SLOTS = { GK: 1, DEF: 4, MID: 4, ATT: 2 };

  /* Rolle, die ein Spieler in einem Kader realistisch erwarten kann */
  FM.expectedRole = function (state, p, clubId) {
    var others = FM.clubPlayers(state, clubId).filter(function (x) { return x.id !== p.id; });
    var g = FM.mainGroup(p);
    var better = function (x) { return x.ovr > p.ovr || (x.ovr === p.ovr && x.age < p.age); };
    var rG = others.filter(function (x) { return FM.mainGroup(x) === g && better(x); }).length + 1;
    var rAll = others.filter(better).length + 1;
    var s = SLOTS[g] || 3;
    if (rG <= s) return rAll <= 3 ? 'key' : 'start';
    if (p.age <= 21) return 'prospect';
    if (g !== 'GK' && rG <= Math.round(s * 1.75)) return 'rot';
    return 'squad';
  };

  FM.roleOf = function (state, p) {
    if (p.loan && p.loan.role) return p.loan.role;
    return (p.contract && p.contract.role) || (p.club ? FM.expectedRole(state, p, p.club) : 'squad');
  };

  /* Startrollen: nach der aktuellen Aufstellung (Startelf, Bank), sonst nach Kaderrang */
  FM.assignRoles = function (state, clubId) {
    var club = state.clubs[clubId], lu = club.lineup;
    var xi = lu && lu.slots ? lu.slots.map(function (s) { return s.pid; }).filter(Boolean) : [];
    // nur die vier staerksten Feldspieler der Bank gelten als Rotationsspieler
    var bench = (lu && lu.bench ? lu.bench : []).map(function (id) { return state.players[id]; })
      .filter(function (p) { return p && !FM.isGK(p) && p.age > 21; }).sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 4).map(function (p) { return p.id; });
    var top = xi.map(function (id) { return state.players[id]; }).filter(Boolean).sort(function (a, b) { return b.ovr - a.ovr; }).slice(0, 3).map(function (p) { return p.id; });
    FM.clubPlayers(state, clubId).forEach(function (p) {
      if (p.loan || p.contract.role) return;
      if (!xi.length) p.contract.role = FM.expectedRole(state, p, clubId);
      else if (xi.indexOf(p.id) >= 0) p.contract.role = top.indexOf(p.id) >= 0 ? 'key' : 'start';
      else if (p.age <= 21) p.contract.role = 'prospect';
      else if (bench.indexOf(p.id) >= 0) p.contract.role = 'rot';
      else p.contract.role = 'squad';
    });
  };

  /* Monatlich: Einsatzzeit gegen versprochene Rolle pruefen (nur eigener Kader) */
  FM.monthlyRoles = function (state) {
    var uc = state.user.club, games = state.user.mg || 0;
    state.user.mg = 0;
    FM.clubPlayers(state, uc).forEach(function (p) {
      var mm = p.mm || 0;
      p.mm = 0;
      if (games < 2 || p.injury) return;
      if (p.joinDate && D.diff(p.joinDate, state.date) < 25) return;
      var role = FM.roleOf(state, p), need = ROLE_SHARE[role];
      if (!need) return;
      var share = mm / (90 * games);
      if (share < need * 0.55) {
        p.mor = Math.max(5, p.mor - 7);
        p.unhappy = (p.unhappy || 0) + 1;
        if (p.unhappy === 2 && !p.wants) {
          FM.addNews(state, { type: 'board', title: p.name + ' ist unzufrieden', body: 'Als ' + FM.ROLE_LABEL[role] + ' erwartet ' + p.name + ' mehr Einsatzzeit – zuletzt stand er nur ' + Math.round(share * 100) + ' % der möglichen Minuten auf dem Platz.' });
        }
        if (p.unhappy >= 4 && p.mor < 40 && !p.wants && !p.loan) {
          p.wants = true;
          FM.addNews(state, { type: 'board', important: true, title: 'Wechselwunsch: ' + p.name, body: p.name + ' fühlt sich als ' + FM.ROLE_LABEL[role] + ' nicht ernst genommen und möchte den Verein verlassen. Andere Klubs wissen das – die Angebote werden niedriger ausfallen. Mehr Einsatzzeit oder ein neuer Vertrag mit größerer Rolle können ihn umstimmen.' });
        }
      } else {
        p.mor = Math.min(100, p.mor + 3);
        p.unhappy = Math.max(0, (p.unhappy || 0) - 1);
        if (p.wants && p.unhappy === 0 && p.mor >= 65) {
          p.wants = false;
          FM.addNews(state, { type: 'board', quiet: true, title: p.name + ' bleibt gern', body: p.name + ' hat seinen Wechselwunsch zurückgezogen.' });
        }
      }
    });
  };

  /* ================= Hilfen ================= */
  function niceUp(v) {
    var r = FM.niceRound(v);
    if (r >= v) return r;
    var step = v >= 1e8 ? 5e6 : v >= 1e7 ? 1e6 : v >= 1e6 ? 1e5 : v >= 1e5 ? 2.5e4 : 5e3;
    return r + step;
  }
  FM.niceUp = niceUp;

  FM.windowDaysLeft = function (state) {
    var m = D.month(state.date), y = D.year(state.date);
    if (m === 7 || m === 8) return D.diff(state.date, D.iso(y, 8, 31));
    if (m === 1) return D.diff(state.date, D.iso(y, 1, 31));
    return null;
  };
  FM.isDeadlineDay = function (state) {
    var left = FM.windowDaysLeft(state);
    return left != null && left <= 1;
  };

  FM.loanable = function (state, p) {
    if (!p.club || p.loan || p.pre || state.clubs[p.club].reserve || state.clubs[p.club].guest) return false;
    var r = FM.squadRank(state, p);
    return r > 15 || (p.age <= 21 && r > 11);
  };

  FM.preContractOpen = function (state, p) {
    var m = D.month(state.date);
    return !!p.club && !p.loan && !p.pre && p.contract.until <= state.season.year + 1 && m >= 1 && m <= 6;
  };

  /* Welche Arten von Geschaeft sind mit diesem Spieler gerade moeglich? */
  FM.dealKinds = function (state, p) {
    var uc = state.user.club;
    if (p.club === uc) return p.loan || p.pre ? [] : ['renew'];
    if (p.pre) return [];
    if (!p.club) return ['free'];
    var seller = state.clubs[p.club];
    if (p.loan || (seller.guest && !(seller.eu && p.abroad))) return [];
    var out = [];
    if (FM.isWindowOpen(state)) {
      out.push('buy');
      if (FM.loanable(state, p)) out.push('loan');
      if (p.contract.clause) out.push('clause');
    }
    if (!seller.eu && FM.preContractOpen(state, p)) out.push('pre');
    return out;
  };
  FM.DEAL_LABEL = { buy: 'Kauf', loan: 'Leihe', clause: 'Klausel ziehen', pre: 'Vorvertrag', free: 'Verpflichten', renew: 'Verlängerung' };

  /* ================= Verhandlungen ================= */
  function talks(state) { state.talks = state.talks || {}; return state.talks; }
  FM.talkOf = function (state, pid) {
    var t = talks(state)[pid];
    if (t && t.expires < state.date) { delete state.talks[pid]; return null; }
    return t || null;
  };
  FM.talkBlocked = function (state, pid) {
    var b = (state.talkBlock || {})[pid];
    return b && b > state.date ? b : null;
  };
  function endTalk(state, t, blockDays) {
    delete talks(state)[t.pid];
    if (blockDays) {
      state.talkBlock = state.talkBlock || {};
      state.talkBlock[t.pid] = D.add(state.date, blockDays);
    }
  }
  function say(t, me, text) { t.log.push({ me: me ? 1 : 0, d: t.round, text: text }); }

  /* Gespraeche selbst beenden; nach echten Verhandlungsrunden fuenf Tage Pause */
  FM.cancelTalk = function (state, pid) {
    var t = FM.talkOf(state, pid);
    if (t) endTalk(state, t, t.round > 0 ? 5 : 0);
  };

  FM.startTalk = function (state, pid, kind) {
    var p = state.players[pid], uc = state.user.club;
    if (!p) return { error: 'Spieler nicht gefunden.' };
    var t = FM.talkOf(state, pid);
    if (t && t.kind === kind) return t;
    var blocked = FM.talkBlocked(state, pid);
    if (blocked) return { error: 'Die Gespräche sind abgebrochen. Ein neuer Anlauf ist ab ' + D.fmt(blocked) + ' möglich.' };
    if (FM.dealKinds(state, p).indexOf(kind) < 0) return { error: 'Diese Art von Geschäft ist gerade nicht möglich.' };
    var old = t;
    t = { pid: pid, kind: kind, stage: kind === 'buy' || kind === 'loan' ? 'club' : 'player', log: [], round: 0, started: state.date, expires: D.add(state.date, 14) };
    if (t.stage === 'club') {
      var seller = state.clubs[p.club], buyer = state.clubs[uc];
      var base = FM.askingPrice(state, p);
      var star = !p.mkt && FM.squadRank(state, p) <= 3 && seller.rep > buyer.rep + 12;
      t.ask = FM.niceRound(base * (star ? 1.75 : 1));
      t.min = Math.round(base * (star ? 1.6 : R.range(0.86, 0.98)) * (FM.isDeadlineDay(state) ? 0.92 : 1));
      t.pat = t.max = p.listed || p.wants ? 5 : star ? 2 : seller.league === buyer.league ? 3 : 4;
      t.star = star;
      // Wechsel der Geschaeftsart setzt die Geduld des Vereins nicht zurueck
      if (old && old.stage === 'club' && old.round > 0) t.pat = Math.min(t.pat, old.pat);
      say(t, false, star ? seller.short + ': „' + p.name + ' ist ein Leistungsträger. Unter ' + FM.fmtMoney(t.ask) + ' brauchen wir gar nicht zu reden."' :
        seller.short + ' stellt sich eine Ablöse um ' + FM.fmtMoney(t.ask) + ' vor.');
    }
    if (kind === 'clause') t.deal = { fee: p.contract.clause, inst: 1, sellOn: 0, swap: null, seller: p.club };
    talks(state)[pid] = t;
    if (t.stage === 'player') initPlayerStage(state, t);
    return t;
  };

  function initPlayerStage(state, t) {
    var p = state.players[t.pid], uc = state.user.club;
    t.stage = 'player';
    t.ppat = t.pmax = t.kind === 'renew' ? 3 : 4;
    t.expRole = FM.expectedRole(state, p, uc);
    t.greed = R.range(0.97, 1.06);
    if (t.kind !== 'renew' && p.ovr >= 74 && R.chance(0.35)) {
      var me = state.clubs[uc];
      var rivals = Object.keys(state.clubs).filter(function (cid) {
        var c = state.clubs[cid];
        return cid !== uc && cid !== p.club && c.rep > me.rep && c.league !== 'rl' && !c.reserve && !c.guest;
      });
      if (rivals.length) t.rival = R.pick(rivals);
    }
    var d = FM.playerDemand(state, t, t.expRole);
    say(t, false, (t.kind === 'renew' ? p.name + ' möchte als ' : 'Der Berater von ' + p.name + ' sieht ihn als ') + FM.ROLE_LABEL[t.expRole] +
      ' und erwartet rund ' + FM.fmtMoney(d.wage) + ' pro Jahr' + (d.bonus ? ' plus ' + FM.fmtMoney(d.bonus) + ' Handgeld' : '') +
      (d.clause ? '. Er wünscht eine Ausstiegsklausel von höchstens ' + FM.fmtMoney(d.clause) : '') + '.' +
      (t.rival ? ' Auch ' + state.clubs[t.rival].name + ' wirbt um ihn.' : ''));
  }

  /* Forderungen des Spielers fuer eine angebotene Rolle */
  FM.playerDemand = function (state, t, role) {
    var p = state.players[t.pid], uc = state.user.club;
    var interest;
    if (t.kind === 'renew') interest = 62 + (p.mor - 60) * 0.5 - (p.wants ? 25 : 0);
    else interest = FM.interest(state, p, uc) + (t.kind === 'pre' ? 10 : 0);
    var diff = ROLE_RANK[role] - ROLE_RANK[t.expRole];
    if (role === 'prospect' && p.age > 21) diff = Math.max(diff, 1);
    interest += diff < 0 ? 8 * Math.min(2, -diff) : -15 * diff;
    var base = FM.contractWageDemand(state, p, uc, FM.clamp(interest, 0, 100));
    var f = diff < 0 ? Math.pow(0.93, Math.min(2, -diff)) : Math.pow(1.12, diff);
    if (t.rival) f *= 1.1;
    f *= t.greed || 1;
    var wage = FM.niceRound(base * f);
    var bonusShare = t.kind === 'free' || t.kind === 'pre' ? 0.3 : t.kind === 'renew' ? 0.05 : 0.1;
    var level = FM.levelOf(state, uc);
    var wantsClause = t.kind === 'renew' ? p.ovr >= 78 && level > 1 : t.expRole === 'key' || (level > 1 && p.ovr >= 76);
    return {
      interest: interest,
      wage: wage,
      bonus: FM.niceRound(wage * bonusShare),
      clause: wantsClause ? FM.niceRound(FM.marketValue(p) * 2.2) : 0,
      maxYears: p.age >= 32 ? 2 : p.age >= 30 ? 3 : 5
    };
  };

  function upfront(deal) {
    if (!deal || !deal.fee) return 0;
    return Math.round(deal.fee / (deal.inst || 1));
  }
  FM.dealUpfront = upfront;

  /* Wert eines Tauschspielers aus Sicht des abgebenden Vereins */
  FM.swapValue = function (state, swap, sellerId) {
    var role = FM.expectedRole(state, swap, sellerId);
    return Math.round(FM.marketValue(swap) * (ROLE_RANK[role] <= 2 ? 0.85 : 0.55));
  };
  var INST_FACTOR = [1, 1, 0.95, 0.91];

  /* Stufe 1: Angebot an den Verein (Kauf oder Leihe) */
  FM.clubOffer = function (state, pid, o) {
    var t = FM.talkOf(state, pid), p = state.players[pid], uc = state.user.club, buyer = state.clubs[uc];
    if (!t || t.stage !== 'club') return { status: 'error', msg: 'Keine laufende Verhandlung mit dem Verein.' };
    if (!FM.isWindowOpen(state)) return { status: 'error', msg: 'Das Transferfenster ist geschlossen.' };
    if (!p.club || p.club === uc || p.loan) return { status: 'error', msg: 'Der Spieler ist nicht mehr verfügbar.' };
    var seller = state.clubs[p.club];
    if (t.kind === 'loan') return loanOffer(state, t, p, seller, o);

    var fee = Math.max(0, Math.round(o.fee || 0)), inst = FM.clamp(o.inst || 1, 1, 3), sellOn = FM.clamp(o.sellOn || 0, 0, 0.3);
    var swap = o.swap ? state.players[o.swap] : null;
    if (swap && (swap.club !== uc || swap.loan || swap.pre)) return { status: 'error', msg: 'Dieser Tauschspieler ist nicht verfügbar.' };
    if (swap && FM.interest(state, swap, seller.id) < 40) return { status: 'error', msg: swap.name + ' möchte nicht zu ' + seller.short + ' wechseln.' };
    var now = upfront({ fee: fee, inst: inst }) + Math.round(fee * FM.AGENT_FEE);
    var b = FM.budget(state, buyer);
    if (now > b.transfer) return { status: 'error', msg: 'Das übersteigt dein Transferbudget: sofort fällig wären ' + FM.fmtMoney(now) + ' inklusive Beraterhonorar, verfügbar sind ' + FM.fmtMoney(b.transfer) + '.' };
    if (buyer.squad.length >= 34 && !swap) return { status: 'error', msg: 'Dein Kader ist voll (34 Spieler).' };
    if (!seller.eu && seller.squad.length <= 18 && !swap) {
      endTalk(state, t, 14);
      return { status: 'broken', msg: seller.short + ' hat zu wenige Spieler und gibt niemanden ab – außer im Tausch.' };
    }
    t.round++;
    var swapVal = swap ? FM.swapValue(state, swap, seller.id) : 0;
    var k = p.age <= 23 && p.pot - p.ovr >= 6 ? 0.9 : p.age <= 26 ? 0.5 : 0.25;
    var required = t.min * (1 - sellOn * k);
    var value = fee * INST_FACTOR[inst] + swapVal;
    say(t, true, FM.fmtMoney(fee) + (inst > 1 ? ' in ' + inst + ' Raten' : '') + (sellOn ? ', ' + Math.round(sellOn * 100) + ' % Weiterverkaufsbeteiligung' : '') + (swap ? ' plus ' + swap.name + ' im Tausch' : ''));
    if (value >= required) {
      t.deal = { fee: fee, inst: inst, sellOn: sellOn, swap: swap ? swap.id : null, seller: seller.id };
      say(t, false, seller.short + ' ist einverstanden. Jetzt geht es um den Vertrag.');
      initPlayerStage(state, t);
      return { status: 'accepted', msg: seller.short + ' nimmt das Angebot an. Jetzt verhandelst du mit ' + p.name + '.' };
    }
    var ratio = value / required;
    t.pat -= ratio < 0.7 ? 2 : 1;
    if (t.pat <= 0) {
      say(t, false, seller.short + ' bricht die Gespräche ab.');
      endTalk(state, t, 21);
      return { status: 'broken', msg: seller.short + ' hat genug. Die Gespräche über ' + p.name + ' ruhen drei Wochen.' };
    }
    // Gegenangebot: sinkt mit schwindender Geduld, liegt nie ueber der Ausgangsforderung
    var target = Math.max(required, Math.min(required * (1 + 0.05 * t.pat), t.ask * (1 - sellOn * k)));
    var counter = niceUp(Math.max(0, (target - swapVal) / INST_FACTOR[inst]));
    t.counter = counter;
    var mood = ratio < 0.7 ? 'Das ist kein ernsthaftes Angebot.' : ratio < 0.9 ? 'Das reicht nicht.' : 'Wir sind nah dran.';
    say(t, false, seller.short + ': „' + mood + ' Für ' + FM.fmtMoney(counter) + (inst > 1 || sellOn || swap ? ' zu diesen Bedingungen' : '') + ' machen wir es."');
    return { status: 'counter', counter: counter, msg: seller.short + ' will ' + FM.fmtMoney(counter) + '.' };
  };

  function loanOffer(state, t, p, seller, o) {
    var uc = state.user.club, buyer = state.clubs[uc];
    if (!FM.loanable(state, p)) return { status: 'error', msg: seller.short + ' verleiht ' + p.name + ' nicht – er ist fest eingeplant.' };
    if (buyer.squad.length >= 34) return { status: 'error', msg: 'Dein Kader ist voll (34 Spieler).' };
    var share = FM.clamp(+o.wageShare || 0, 0, 1), option = Math.max(0, Math.round(o.option || 0));
    var err = FM.checkBudget(state, buyer, 0, p.contract.wage * share, 0);
    if (err) return { status: 'error', msg: err };
    t.round++;
    var role = FM.expectedRole(state, p, uc);
    var need = 0.6 - (ROLE_RANK[role] <= 1 ? 0.2 : 0) - (FM.levelOf(state, uc) > FM.levelOf(state, seller.id) ? 0.1 : 0) - (p.listed ? 0.1 : 0);
    need = Math.round(FM.clamp(need, 0.2, 1) * 10) / 10;
    var optMin = option ? niceUp(FM.askingPrice(state, p) * 1.15) : 0;
    say(t, true, 'Leihe bis Saisonende, du zahlst ' + Math.round(share * 100) + ' % des Gehalts' + (option ? ', Kaufoption ' + FM.fmtMoney(option) : ''));
    if (share + 1e-9 >= need && (!option || option >= optMin)) {
      var pi = FM.interest(state, p, uc) + (ROLE_RANK[role] <= 1 ? 15 : ROLE_RANK[role] === 2 ? 5 : -15);
      if (pi < 40) {
        say(t, false, p.name + ' lehnt ab: zu wenig Einsatzchancen.');
        endTalk(state, t, 14);
        return { status: 'broken', msg: seller.short + ' wäre einverstanden, aber ' + p.name + ' lehnt ab – bei dir sieht er zu wenig Spielzeit.' };
      }
      FM.executeLoan(state, p, uc, share, option, role);
      delete talks(state)[t.pid];
      FM.addNews(state, { type: 'transfer', title: p.name + ' kommt per Leihe', body: p.name + ' wechselt bis Saisonende von ' + seller.name + ' zu ' + buyer.name + '. Du zahlst ' + Math.round(share * 100) + ' % seines Gehalts' + (option ? ', Kaufoption: ' + FM.fmtMoney(option) : '') + '.' });
      return { status: 'done', msg: p.name + ' ist ausgeliehen!' };
    }
    t.pat -= 1;
    if (t.pat <= 0) {
      endTalk(state, t, 21);
      return { status: 'broken', msg: seller.short + ' hat kein Interesse mehr an einer Leihe.' };
    }
    var msg = share + 1e-9 < need ? 'Ihr müsst mindestens ' + Math.round(need * 100) + ' % seines Gehalts übernehmen.' : 'Die Kaufoption muss mindestens ' + FM.fmtMoney(optMin) + ' betragen.';
    say(t, false, seller.short + ': „' + msg + '"');
    return { status: 'counter', share: need, option: optMin, msg: msg };
  }

  /* Stufe 2: Vertragsangebot an den Spieler */
  FM.playerOffer = function (state, pid, o) {
    var t = FM.talkOf(state, pid), p = state.players[pid], uc = state.user.club, club = state.clubs[uc];
    if (!t || t.stage !== 'player') return { status: 'error', msg: 'Keine laufende Verhandlung mit dem Spieler.' };
    if ((t.kind === 'buy' || t.kind === 'clause') && !FM.isWindowOpen(state)) return { status: 'error', msg: 'Das Transferfenster ist geschlossen.' };
    var role = FM.ROLES.indexOf(o.role) >= 0 ? o.role : t.expRole;
    var years = FM.clamp(Math.round(o.years || 3), 1, 5), wage = Math.max(0, Math.round(o.wage || 0)), bonus = Math.max(0, Math.round(o.bonus || 0));
    var clause = Math.max(0, Math.round(o.clause || 0));
    var dem = FM.playerDemand(state, t, role);
    if (years > dem.maxYears) return { status: 'error', msg: 'Mit ' + p.age + ' Jahren unterschreibt ' + p.name + ' höchstens für ' + dem.maxYears + ' Jahre.' };
    // Budget
    var deal = t.deal || { fee: 0, inst: 1 };
    var now = upfront(deal) + Math.round((deal.fee || 0) * FM.AGENT_FEE) + bonus;
    var oldWage = t.kind === 'renew' ? p.contract.wage : 0;
    var err;
    if (t.kind === 'pre') {
      var b = FM.budget(state, club);
      var room = FM.wageRoom(state, club) + FM.expiringWages(state, club);
      if (bonus > b.transfer) err = 'Das Handgeld übersteigt dein Transferbudget (' + FM.fmtMoney(b.transfer) + ').';
      else if (wage > room) err = 'Auch mit den Gehältern auslaufender Verträge reicht das Gehaltsbudget nicht: Spielraum ' + FM.fmtMoney(Math.max(0, room)) + '.';
    } else {
      err = FM.checkBudget(state, club, now, wage, oldWage);
    }
    if (err) return { status: 'error', msg: err };
    t.round++;
    var need = dem.wage * (dem.clause && (!clause || clause > dem.clause) ? 1.08 : 1);
    var eff = wage + (bonus - dem.bonus) * 0.8 / years;
    say(t, true, FM.ROLE_LABEL[role] + ', ' + FM.fmtMoney(wage) + ' pro Jahr, ' + years + ' J.' + (bonus ? ', Handgeld ' + FM.fmtMoney(bonus) : '') + (clause ? ', Klausel ' + FM.fmtMoney(clause) : ''));
    if (dem.interest >= 30 && eff >= need * 0.97) {
      completeDeal(state, t, { role: role, years: years, wage: wage, bonus: bonus, clause: clause });
      return { status: 'done', msg: t.kind === 'renew' ? p.name + ' hat verlängert.' : t.kind === 'pre' ? p.name + ' kommt im Sommer!' : p.name + ' ist verpflichtet!' };
    }
    t.ppat -= dem.interest < 30 || eff < need * 0.8 ? 2 : 1;
    if (t.ppat <= 0) {
      endTalk(state, t, 21);
      return { status: 'broken', msg: p.name + (t.kind === 'renew' ? ' will vorerst nicht mehr über einen neuen Vertrag reden.' : ' bricht die Gespräche ab' + (t.rival ? ' und schaut sich bei ' + state.clubs[t.rival].short + ' um.' : '.')) };
    }
    var ask = niceUp(need * (1 + 0.03 * t.ppat) - (bonus - dem.bonus) * 0.8 / years);
    var msg;
    if (dem.interest < 30) msg = 'Als ' + FM.ROLE_LABEL[role] + ' sieht ' + p.name + ' keine Perspektive. Biete ihm eine größere Rolle an.';
    else msg = p.name + ' will mindestens ' + FM.fmtMoney(ask) + ' pro Jahr' + (dem.clause && (!clause || clause > dem.clause) ? ' – oder eine Ausstiegsklausel bis ' + FM.fmtMoney(dem.clause) : '') + '.';
    say(t, false, msg);
    return { status: 'counter', wage: ask, msg: msg };
  };

  function completeDeal(state, t, o) {
    var p = state.players[t.pid], uc = state.user.club, club = state.clubs[uc];
    var y = state.season.year;
    if (t.kind === 'renew') {
      p.contract = { until: y + o.years, wage: o.wage, role: o.role, clause: o.clause || 0 };
      if (o.bonus) { FM.book(club, 'fees', -o.bonus); FM.spendBudget(state, club, o.bonus); }
      p.mor = Math.min(100, p.mor + 10);
      p.unhappy = 0;
      if (p.wants && ROLE_RANK[o.role] <= 1) p.wants = false;
      FM.addNews(state, { type: 'transfer', quiet: true, title: p.name + ' verlängert', body: p.name + ' bleibt bis ' + p.contract.until + ' als ' + FM.ROLE_LABEL[o.role] + '. Jahresgehalt ' + FM.fmtMoney(o.wage) + '.' });
    } else if (t.kind === 'pre') {
      p.pre = { club: uc, wage: o.wage, years: o.years, role: o.role, clause: o.clause || 0 };
      if (o.bonus) { FM.book(club, 'fees', -o.bonus); FM.spendBudget(state, club, o.bonus); }
      FM.addNews(state, { type: 'transfer', title: 'Vorvertrag: ' + p.name, body: p.name + ' wechselt im Sommer ablösefrei von ' + state.clubs[p.club].name + ' zu ' + club.name + '. Vertrag bis ' + (y + 1 + o.years) + ', Jahresgehalt ' + FM.fmtMoney(o.wage) + '.' });
    } else {
      var deal = t.deal || {};
      var from = p.club;
      var rec = FM.executeTransfer(state, p, uc, deal.fee || 0, o.wage, o.years, { inst: deal.inst, sellOn: deal.sellOn, swap: deal.swap, role: o.role, clause: o.clause, bonus: o.bonus });
      FM.addNews(state, {
        type: 'transfer', title: p.name + ' unterschreibt',
        body: p.name + ' wechselt ' + (from ? 'von ' + state.clubs[from].name + ' ' : 'ablösefrei ') + 'zu ' + club.name +
          (rec.fee ? ' (Ablöse ' + FM.fmtMoney(rec.fee) + (deal.inst > 1 ? ' in ' + deal.inst + ' Raten' : '') + ')' : '') +
          (rec.swap ? '. Im Tausch geht ' + state.players[rec.swap].name + ' den umgekehrten Weg' : '') +
          '. Vertrag bis ' + p.contract.until + ' als ' + FM.ROLE_LABEL[o.role] + ', Jahresgehalt ' + FM.fmtMoney(o.wage) + '.'
      });
    }
    delete talks(state)[t.pid];
  }

  /* Gehaelter der eigenen Spieler, deren Vertrag zum Saisonende auslaeuft */
  FM.expiringWages = function (state, club) {
    var y = state.season.year;
    return FM.sum(FM.clubPlayers(state, club.id), function (p) { return !p.loan && p.contract.until <= y + 1 ? p.contract.wage : 0; });
  };

  /* ================= Leihen ================= */
  function detach(state, p) {
    var club = state.clubs[p.club];
    if (!club) return;
    club.squad = club.squad.filter(function (id) { return id !== p.id; });
    if (club.lineup) {
      club.lineup.slots.forEach(function (s) { if (s.pid === p.id) s.pid = null; });
      club.lineup.bench = (club.lineup.bench || []).filter(function (id) { return id !== p.id; });
    }
  }
  FM.detachPlayer = detach;

  FM.executeLoan = function (state, p, toId, share, option, role) {
    var from = state.clubs[p.club], to = state.clubs[toId];
    detach(state, p);
    from.loanedOut = (from.loanedOut || []).concat([p.id]);
    to.squad.push(p.id);
    p.loan = { from: from.id, until: state.season.year + 1, share: share, option: option || 0, role: role || FM.expectedRole(state, p, toId) };
    p.club = toId;
    p.listed = false;
    p.loanList = false;
    p.joinDate = state.date;
    var rec = { date: state.date, pid: p.id, name: p.name, from: from.id, to: toId, fee: 0, loan: true, ovr: p.ovr, age: p.age, pos: p.pos[0] };
    state.transfers.unshift(rec);
    if (state.transfers.length > 400) state.transfers.length = 400;
    state.offers = state.offers.filter(function (o) { return o.pid !== p.id; });
    return rec;
  };

  /* Leihe beenden (Saisonende) – KI-Vereine ziehen ggf. die Kaufoption */
  FM.endLoan = function (state, p, noOption) {
    var l = p.loan;
    if (!l) return;
    var holder = state.clubs[p.club], owner = state.clubs[l.from];
    if (!noOption && l.option && holder && holder.id !== state.user.club && owner) {
      var mates = FM.clubPlayers(state, holder.id).map(function (x) { return x.ovr; }).sort(function (a, b) { return b - a; });
      var median = mates[Math.floor(mates.length / 2)] || 0;
      if (p.ovr >= median && holder.money - FM.cashReserve(state, holder) >= l.option) {
        FM.exerciseOption(state, p, true);
        return;
      }
    }
    detach(state, p);
    p.loan = null;
    if (!owner) { p.club = null; state.free.push(p.id); return; }
    owner.loanedOut = (owner.loanedOut || []).filter(function (id) { return id !== p.id; });
    owner.squad.push(p.id);
    p.club = owner.id;
    p.joinDate = state.date;
  };

  /* Kaufoption ziehen */
  FM.exerciseOption = function (state, p, ai) {
    var l = p.loan;
    if (!l || !l.option) return { ok: false, msg: 'Keine Kaufoption vereinbart.' };
    var holder = state.clubs[p.club], owner = state.clubs[l.from];
    if (!ai) {
      var cost = l.option + Math.round(l.option * FM.AGENT_FEE);
      var err = FM.checkBudget(state, holder, cost, p.contract.wage * (1 - l.share), 0);
      if (err) return { ok: false, msg: err };
      FM.spendBudget(state, holder, cost);
      FM.book(holder, 'fees', -Math.round(l.option * FM.AGENT_FEE));
    }
    FM.book(holder, 'buys', -l.option);
    FM.book(owner, 'sales', l.option);
    if (owner.id === state.user.club) FM.creditSale(state, owner, l.option);
    owner.loanedOut = (owner.loanedOut || []).filter(function (id) { return id !== p.id; });
    if (l.role && holder.id === state.user.club) p.contract.role = l.role;
    p.loan = null;
    p.joined = state.season.year;
    var rec = { date: state.date, pid: p.id, name: p.name, from: owner.id, to: holder.id, fee: l.option, option: true, ovr: p.ovr, age: p.age, pos: p.pos[0] };
    state.transfers.unshift(rec);
    if (owner.id === state.user.club || holder.id === state.user.club) {
      FM.addNews(state, { type: 'transfer', title: 'Kaufoption gezogen: ' + p.name, body: holder.name + ' übernimmt ' + p.name + ' fest von ' + owner.name + ' für ' + FM.fmtMoney(l.option) + '.' });
    }
    return { ok: true, msg: p.name + ' gehört jetzt fest zum Kader.' };
  };

  /* ================= Ratenzahlungen ================= */
  FM.pendingPayments = function (state, clubId, days) {
    var limit = D.add(state.date, days || 400);
    return FM.sum(state.payments || [], function (x) { return x.from === clubId && x.due <= limit ? x.amount : 0; });
  };

  function processPayments(state) {
    if (!state.payments || !state.payments.length) return;
    state.payments = state.payments.filter(function (x) {
      if (x.due > state.date) return true;
      var from = state.clubs[x.from], to = state.clubs[x.to];
      if (from) FM.book(from, 'buys', -x.amount);
      if (to) FM.book(to, 'sales', x.amount);
      if (to && x.to === state.user.club) FM.creditSale(state, to, x.amount);
      if (x.from === state.user.club || x.to === state.user.club) {
        FM.addNews(state, { type: 'market', quiet: true, title: 'Rate fällig: ' + x.name, body: (x.from === state.user.club ? 'Du zahlst ' : 'Du erhältst ') + FM.fmtMoney(x.amount) + ' (' + x.name + ').' });
      }
      return false;
    });
  }

  /* ================= Scouting ================= */
  FM.scoutSlots = function (club) { return 1 + Math.floor(FM.facLevel(club, 'scouting') / 2); };
  FM.scoutDays = function (club) { return 16 - 2 * FM.facLevel(club, 'scouting'); };

  FM.isKnown = function (state, p) { return !!(state.known && state.known[p.id]); };
  function know(state, pid) {
    state.known = state.known || {};
    state.known[pid] = 1;
    var keys = Object.keys(state.known);
    if (keys.length > 500) delete state.known[keys[0]];
  }

  FM.toggleShortlist = function (state, pid) {
    state.shortlist = state.shortlist || [];
    var i = state.shortlist.indexOf(pid);
    if (i >= 0) { state.shortlist.splice(i, 1); return false; }
    state.shortlist.unshift(pid);
    if (state.shortlist.length > 60) state.shortlist.length = 60;
    return true;
  };
  FM.onShortlist = function (state, pid) { return (state.shortlist || []).indexOf(pid) >= 0; };

  FM.startScout = function (state, f) {
    var club = state.clubs[state.user.club];
    state.scouts = state.scouts || [];
    var busy = state.scouts.filter(function (s) { return !s.res; }).length;
    if (busy >= FM.scoutSlots(club)) return { ok: false, msg: 'Alle Scouts sind unterwegs. Mehr Scouts gibt es mit einer besseren Scoutingabteilung.' };
    var days = FM.scoutDays(club);
    state.scoutSeq = (state.scoutSeq || 0) + 1;
    state.scouts.unshift({ id: 's' + state.scoutSeq, f: f, start: state.date, ready: D.add(state.date, days), res: null });
    if (state.scouts.length > 8) state.scouts.length = 8;
    return { ok: true, msg: 'Der Scout ist unterwegs. Bericht in ' + days + ' Tagen.' };
  };
  FM.scoutLabel = function (f) {
    var parts = [f.pos && f.pos !== 'all' ? FM.POS_NAME[f.pos] : f.grp && f.grp !== 'all' ? FM.GROUP_LABEL[f.grp] : 'Alle Positionen'];
    if (f.maxAge && f.maxAge < 40) parts.push('bis ' + f.maxAge + ' J.');
    if (f.league && f.league !== 'all') parts.push(f.league === 'eu' ? 'Ausland' : FM.COMP_NAME[f.league] || 'Regionalliga');
    if (f.maxPrice) parts.push('bis ' + FM.fmtMoneyShort(f.maxPrice) + ' €');
    if (f.style === 'young') parts.push('Talente');
    if (f.style === 'cheap') parts.push('Schnäppchen');
    return parts.join(' · ');
  };

  /* Referenzniveau der eigenen Stammspieler in einer Positionsgruppe */
  FM.groupLevel = function (state, clubId, g) {
    var vals = FM.clubPlayers(state, clubId).filter(function (x) { return FM.mainGroup(x) === g; }).map(function (x) { return x.ovr; }).sort(function (a, b) { return b - a; });
    var n = SLOTS[g] || 3;
    return vals.length ? FM.avg(vals.slice(0, n)) : 55;
  };

  FM.scoutSearch = function (state, f) {
    var uc = state.user.club, club = state.clubs[uc];
    var budget = Math.max(250000, FM.budget(state, club).transfer);
    var refs = {};
    var out = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (p.club === uc || p.loan || (p.pre && p.pre.club !== uc)) return;
      var c = p.club ? state.clubs[p.club] : null;
      // Ausland: nur Spieler, die dort auf dem Markt sind
      if (c && (c.reserve || (c.guest && !(c.eu && p.mkt)))) return;
      if (f.league && f.league !== 'all') { if (!c || c.league !== f.league) return; }
      if (f.pos && f.pos !== 'all') { if (p.pos.indexOf(f.pos) < 0) return; }
      else if (f.grp && f.grp !== 'all' && FM.mainGroup(p) !== f.grp) return;
      if (f.maxAge && p.age > f.maxAge) return;
      var price = p.club ? FM.askingPrice(state, p) : 0;
      if (f.maxPrice && price > f.maxPrice) return;
      var interest = FM.interest(state, p, uc);
      if (interest < 35) return;
      var g = FM.mainGroup(p);
      if (refs[g] == null) refs[g] = FM.groupLevel(state, uc, g);
      var young = p.age <= 23 ? (p.pot - p.ovr) * (f.style === 'young' ? 2 : 1.1) : 0;
      var cheap = f.style === 'cheap' ? (FM.marketValue(p) - price) / Math.max(1, FM.marketValue(p)) * 12 : 0;
      var score = (p.ovr - refs[g]) * 3 + young + cheap - price / budget * 5 + (interest - 50) / 10 + R.range(0, 4);
      out.push({ id: pid, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 8).map(function (x) { return x.id; });
  };

  /* Scoutbericht: Note, Einordnung, Staerken */
  FM.scoutReport = function (state, p) {
    var uc = state.user.club, g = FM.mainGroup(p);
    var ref = FM.groupLevel(state, uc, g);
    var price = p.club ? FM.askingPrice(state, p) : 0, value = FM.marketValue(p);
    var grade, tag;
    if (p.ovr >= ref + 3) { grade = 'A'; tag = 'Sofortverstärkung'; }
    else if (p.age <= 21 && p.pot >= ref + 8) { grade = 'A'; tag = 'Toptalent'; }
    else if (p.ovr >= ref) { grade = 'B'; tag = 'Verstärkung'; }
    else if (p.age <= 22 && p.pot >= ref + 3) { grade = 'B'; tag = 'Perspektivspieler'; }
    else if (p.ovr >= ref - 3 && (!p.club || price <= value * 0.8)) { grade = 'B'; tag = 'Schnäppchen'; }
    else if (p.ovr >= ref - 5) { grade = 'C'; tag = 'Kaderspieler'; }
    else { grade = 'D'; tag = 'Keine Verstärkung'; }
    var names = FM.statNames(p);
    var idx = p.s.map(function (v, i) { return i; }).sort(function (a, b) { return p.s[b] - p.s[a]; });
    return {
      grade: grade, tag: tag,
      strengths: idx.slice(0, 2).map(function (i) { return names[i]; }),
      weakness: names[idx[idx.length - 1]],
      ref: Math.round(ref)
    };
  };

  function scoutTick(state) {
    (state.scouts || []).forEach(function (s) {
      if (s.res || s.ready > state.date) return;
      s.res = FM.scoutSearch(state, s.f);
      s.res.forEach(function (pid) { know(state, pid); });
      FM.addNews(state, { type: 'scout', title: 'Scoutbericht: ' + FM.scoutLabel(s.f), body: s.res.length ? 'Dein Scout empfiehlt ' + s.res.length + ' Spieler. Ihr Potenzial ist jetzt genau bekannt. Details im Transfermarkt unter „Merkliste & Scouting".' : 'Dein Scout hat niemanden gefunden, der zu den Vorgaben passt.' });
    });
  }

  /* ================= KI: Klauseln und Vorvertraege ================= */
  function aiClauseRaids(state) {
    var uc = state.user.club, me = state.clubs[uc];
    FM.clubPlayers(state, uc).forEach(function (p) {
      if (!p.contract.clause || p.loan || p.pre || !R.chance(0.004)) return;
      var clause = p.contract.clause;
      var buyers = Object.keys(state.clubs).filter(function (cid) {
        var c = state.clubs[cid];
        return cid !== uc && !c.reserve && !c.guest && c.league !== 'rl' && c.rep >= me.rep - 2 &&
          c.money - FM.cashReserve(state, c) >= clause * 1.05 && FM.interest(state, p, cid) >= 55 && ROLE_RANK[FM.expectedRole(state, p, cid)] <= 2;
      });
      // Klubs aus dem Ausland zahlen Klauseln aus der Portokasse
      if (FM.foreignBuyers && clause <= FM.marketValue(p) * 2.6) buyers = buyers.concat(FM.foreignBuyers(state, p, 2).filter(function (id) { return state.clubs[id].rep >= me.rep - 2 && FM.interest(state, p, id) >= 55; }));
      if (!buyers.length) return;
      var cid = R.pick(buyers), c = state.clubs[cid];
      FM.executeTransfer(state, p, cid, clause, FM.wageDemand(p, c.league), R.int(3, 5));
      FM.addNews(state, { type: 'transfer', important: true, title: 'Ausstiegsklausel gezogen: ' + p.name, body: c.name + ' hat die Ausstiegsklausel von ' + FM.fmtMoney(clause) + ' gezogen. ' + p.name + ' verlässt den Verein – du konntest nichts tun.' });
    });
  }

  function aiPreContracts(state) {
    var m = D.month(state.date);
    if (m < 1 || m > 5) return;
    var y = state.season.year, uc = state.user.club, me = state.clubs[uc];
    FM.clubPlayers(state, uc).forEach(function (p) {
      if (p.loan || p.pre || p.contract.until > y + 1) return;
      if (p.ovr < 68 && !(p.age <= 22 && p.pot >= 75)) return;
      if (!R.chance(0.03)) return;
      var buyers = Object.keys(state.clubs).filter(function (cid) {
        var c = state.clubs[cid];
        return cid !== uc && !c.reserve && !c.guest && c.league !== 'rl' && c.rep >= me.rep - 5 && FM.interest(state, p, cid) >= 55 && ROLE_RANK[FM.expectedRole(state, p, cid)] <= 2;
      });
      if (!buyers.length) return;
      var cid = R.pick(buyers), c = state.clubs[cid];
      p.pre = { club: cid, wage: FM.wageDemand(p, c.league), years: R.int(2, 4) };
      FM.addNews(state, { type: 'transfer', important: true, title: p.name + ' unterschreibt bei ' + c.short, body: p.name + ' hat einen Vorvertrag bei ' + c.name + ' unterschrieben und wechselt im Sommer ablösefrei. Wer verlängern will, sollte es vor dem Januar tun.' });
    });
  }

  /* ================= Taeglicher Ablauf ================= */
  FM.transferDaily = function (state) {
    processPayments(state);
    scoutTick(state);
    if (FM.isWindowOpen(state)) aiClauseRaids(state);
    if (D.weekday(state.date) === 3) aiPreContracts(state);
    if (state.talkBlock) {
      Object.keys(state.talkBlock).forEach(function (k) { if (state.talkBlock[k] <= state.date) delete state.talkBlock[k]; });
    }
  };

  /* ================= Zuweisung der Ausstiegsklauseln bei Spielstart ================= */
  FM.seedClauses = function (state) {
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid], c = p.club ? state.clubs[p.club] : null;
      if (!c || c.rep >= 88 || c.reserve || p.age > 29 || p.ovr < 70) return;
      if (R.chance(0.12)) p.contract.clause = FM.niceRound(FM.marketValue(p) * R.range(1.8, 3));
    });
  };

  /* ================= Kaderplaner und Empfehlungen ================= */
  var SLOT_PRIO = { GK: 0, CB: 1, ST: 2, CDM: 3, LB: 4, RB: 4, CM: 5, CAM: 6, LW: 7, RW: 7, LM: 8, RM: 8 };

  /* Besetzung der eigenen Formation: Stammspieler, Ersatz und Bedarf je Position.
     Verletzte und Gesperrte zaehlen mit – geplant wird der Kader, nicht der naechste Spieltag. */
  FM.squadNeeds = function (state) {
    var uc = state.user.club, club = state.clubs[uc], y = state.season.year;
    var f = (club.lineup && club.lineup.formation) || club.formation || '4-4-2';
    var form = FM.FORMATIONS[f] || FM.FORMATIONS['4-4-2'];
    var players = FM.clubPlayers(state, uc);
    var eff = function (p, pos) { return p.ovr - FM.positionPenalty(p, pos); };
    var order = form.map(function (s, i) { return i; }).sort(function (a, b) { return SLOT_PRIO[form[a][0]] - SLOT_PRIO[form[b][0]]; });
    var used = {}, slots = form.map(function (s, i) { return { i: i, pos: s[0], x: s[1], y: s[2], starter: null, eff: 0, backup: null, beff: 0 }; });
    var pick = function (pos, maxPen) {
      var best = null, bv = -99;
      players.forEach(function (p) {
        if (used[p.id] || FM.positionPenalty(p, pos) > maxPen) return;
        var v = eff(p, pos);
        if (v > bv) { bv = v; best = p; }
      });
      if (best) used[best.id] = 1;
      return best;
    };
    order.forEach(function (i) { var s = slots[i], p = pick(s.pos, 6); if (p) { s.starter = p; s.eff = eff(p, s.pos); } });
    order.forEach(function (i) { var s = slots[i], p = pick(s.pos, 2); if (p) { s.backup = p; s.beff = eff(p, s.pos); } });
    var ref = FM.ZONES[club.league] && FM.leagueStrength ? FM.leagueStrength(state, club.league) : FM.avg(slots, function (s) { return s.eff; });
    slots.forEach(function (s) {
      var st = s.starter, flags = [];
      var need = st ? ref - s.eff : 12;
      if (!st) flags.push('unbesetzt');
      if (!s.backup) { need += 2.5; flags.push('kein Ersatz'); }
      else if (s.eff - s.beff > 7) { need += 1; flags.push('Ersatz fällt stark ab'); }
      if (st && st.age >= 32) { need += 1.5; flags.push(st.age + ' Jahre'); }
      if (st && (st.pre || (!st.loan && st.contract.until <= y + 1))) { need += 1.2; flags.push(st.pre ? 'geht im Sommer' : 'Vertrag endet'); }
      if (st && st.loan) { need += 0.8; flags.push('nur geliehen'); }
      s.need = need;
      s.flags = flags;
      s.level = need >= 3.2 ? 'bad' : need >= 0.8 ? 'warn' : 'ok';
    });
    return { formation: f, ref: ref, slots: slots };
  };

  /* Wo und um wie viel waere der Spieler besser als die aktuelle Besetzung? */
  FM.upgradeFor = function (state, p, needs) {
    var best = null;
    (needs || FM.squadNeeds(state)).slots.forEach(function (s) {
      var pen = FM.positionPenalty(p, s.pos);
      if (pen > 1) return;
      var d = p.ovr - pen - (s.starter ? s.eff : 45);
      if (!best || d > best.delta) best = { pos: s.pos, delta: d, starter: s.starter, slot: s };
    });
    return best;
  };

  /* Sichtbares Potenzial eines fremden Spielers (Spanne je nach Scoutingabteilung) */
  FM.potView = function (state, p) {
    var uc = state.user.club;
    if (p.club === uc || p.age >= 27 || FM.isKnown(state, p)) return { lo: p.pot, hi: p.pot };
    var spread = Math.round((p.age <= 20 ? 1 : 0.5) * FM.facScoutSpread(state.clubs[uc]));
    var h = FM.hash(p.id + 'scout') % (spread + 1);
    var lo = Math.max(p.ovr, p.pot - h);
    return { lo: lo, hi: Math.min(95, lo + spread) };
  };

  /* Was ein Spieler den eigenen Verein kosten wuerde und ob das Budget reicht */
  FM.affordOf = function (state, p, interest) {
    var uc = state.user.club, club = state.clubs[uc], b = FM.budget(state, club);
    var price = p.club ? FM.askingPrice(state, p) : 0;
    var wage = FM.contractWageDemand(state, p, uc, interest != null ? interest : FM.interest(state, p, uc));
    var cost = price + Math.round(price * FM.AGENT_FEE) + (p.club ? 0 : Math.round(wage * FM.SIGNING_BONUS));
    var room = Math.max(0, FM.wageRoom(state, club));
    var level = cost <= b.transfer && wage <= room ? 'ok' : cost <= b.transfer * 1.4 + 1 && wage <= room * 1.25 + 50000 ? 'near' : 'no';
    return { price: price, wage: wage, cost: cost, level: level, why: cost > b.transfer ? 'fee' : wage > room ? 'wage' : '' };
  };

  /* Darf der Spieler ueberhaupt auf dem Markt erscheinen? */
  FM.onMarket = function (state, p, abroad) {
    var uc = state.user.club;
    if (p.club === uc) return false;
    var c = p.club ? state.clubs[p.club] : null;
    if (c && c.guest) return !!(c.eu && p.abroad && (abroad || p.mkt));
    return true;
  };

  /* Empfehlungen: die besten erreichbaren Verstaerkungen fuer die groessten Baustellen */
  FM.marketPicks = function (state, n) {
    var uc = state.user.club, needs = FM.squadNeeds(state), out = [];
    Object.keys(state.players).forEach(function (pid) {
      var p = state.players[pid];
      if (!FM.onMarket(state, p, false) || p.loan || p.pre || p.injury) return;
      var up = FM.upgradeFor(state, p, needs);
      if (!up) return;
      var pot = FM.potView(state, p);
      var talent = p.age <= 21 && pot.lo >= (up.starter ? up.slot.eff : 50) + 3;
      if (up.delta < 1 && !talent) return;
      var interest = FM.interest(state, p, uc);
      if (interest < 45) return;
      var a = FM.affordOf(state, p, interest);
      if (a.level === 'no') return;
      var score = Math.min(8, up.delta) * 3 + up.slot.need * 1.6 + (p.listed || p.wants ? 2 : 0) + (p.club ? 0 : 2.5) + (talent ? (pot.lo - p.ovr) * 0.35 : 0) +
        (a.level === 'ok' ? 3 : 0) + (interest - 50) / 12 - (p.age >= 31 ? (p.age - 30) * 1.2 : 0);
      out.push({ p: p, up: up, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    var perPos = {}, res = [];
    for (var i = 0; i < out.length && res.length < (n || 6); i++) {
      var k = out[i].up.pos;
      if ((perPos[k] || 0) >= 2) continue;
      perPos[k] = (perPos[k] || 0) + 1;
      res.push(out[i]);
    }
    return res;
  };

  /* Einschaetzung des Sportdirektors: Wie nah liegt das Angebot an dem, was der Verkaeufer akzeptiert?
     Sie ist nie ganz genau – eine gute Scoutingabteilung macht sie verlaesslicher. */
  FM.offerRead = function (state, pid, o) {
    var t = FM.talkOf(state, pid), p = state.players[pid];
    if (!t || !p || t.stage !== 'club' || t.kind !== 'buy') return null;
    var swap = o.swap ? state.players[o.swap] : null;
    var k = p.age <= 23 && p.pot - p.ovr >= 6 ? 0.9 : p.age <= 26 ? 0.5 : 0.25;
    var required = t.min * (1 - (o.sellOn || 0) * k);
    var value = (o.fee || 0) * INST_FACTOR[o.inst || 1] + (swap ? FM.swapValue(state, swap, p.club) : 0);
    var spread = 0.015 + 0.01 * FM.facScoutSpread(state.clubs[state.user.club]);
    var off = ((FM.hash(pid + '|read') % 2001) / 1000 - 1) * spread;
    var ratio = value / Math.max(1, required * (1 + off));
    return { ratio: ratio, band: ratio >= 1 ? 3 : ratio >= 0.9 ? 2 : ratio >= 0.7 ? 1 : 0, spread: spread };
  };

  /* Wie steht der Spieler zum Vertragsangebot? (seine Forderung liegt offen auf dem Tisch) */
  FM.contractRead = function (state, pid, o) {
    var t = FM.talkOf(state, pid);
    if (!t || t.stage !== 'player') return null;
    var dem = FM.playerDemand(state, t, o.role || t.expRole);
    var need = dem.wage * (dem.clause && (!o.clause || o.clause > dem.clause) ? 1.08 : 1);
    var eff = (o.wage || 0) + ((o.bonus || 0) - dem.bonus) * 0.8 / Math.max(1, o.years || 3);
    var ratio = eff / Math.max(1, need * 0.97);
    return { ratio: ratio, interest: dem.interest, band: dem.interest < 30 ? 0 : ratio >= 1 ? 3 : ratio >= 0.9 ? 2 : ratio >= 0.8 ? 1 : 0, dem: dem };
  };

  /* Rekordabloese eines Vereins: bisherige Bestmarke oder ein Richtwert nach Renommee */
  FM.recordFee = function (club, key) {
    var r = club[key];
    var floor = FM.niceRound(0.25e6 * Math.pow(1.23, 46.5 + 0.396 * club.rep - 57) * 1.3);
    return Math.max(r ? r.fee : 0, floor);
  };
})();
