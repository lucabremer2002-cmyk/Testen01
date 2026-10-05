/* Vorstandsbudgets (Transfer- und Gehaltsbudget) und Infrastruktur. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  /* Kostenniveau je Liga (Bau- und Unterhaltskosten skalieren mit der Liga) */
  var LEAGUE_SCALE = { bl: 1, bl2: 0.35, l3: 0.12, rlw: 0.05, rlsw: 0.05, rl: 0.06, olw: 0.02, olsw: 0.02 };
  /* Anteil der Einnahmen, den der Vorstand hoechstens fuer Gehaelter freigibt */
  var WAGE_RATIO = { bl: 0.58, bl2: 0.62, l3: 0.66, rlw: 0.72, rlsw: 0.72, rl: 0.7, olw: 0.75, olsw: 0.75 };
  FM.WAGE_RATIO = WAGE_RATIO;
  var HOME_GAMES = { bl: 17, bl2: 17, l3: 19, rlw: 17, rlsw: 17, rl: 17, olw: 17, olsw: 17 };

  FM.SIGNING_BONUS = 0.25;   // Handgeld fuer Vereinslose: Anteil eines Jahresgehalts
  FM.WAGE_SHIFT_COST = 2;    // 2 € Transferbudget ergeben 1 € Gehaltsspielraum pro Jahr

  /* ================= Infrastruktur ================= */

  FM.FAC_KEYS = ['stadium', 'training', 'youth', 'medical', 'scouting', 'commercial'];
  FM.FAC_MAX = 5;
  FM.FACILITIES = {
    stadium: { name: 'Stadion', short: 'Stadion', icon: 'stadium' },
    training: { name: 'Trainingszentrum', short: 'Training', icon: 'training', base: 6e6, upkeep: 0.8e6 },
    youth: { name: 'Nachwuchsleistungszentrum', short: 'NLZ', icon: 'youth', base: 5e6, upkeep: 0.6e6 },
    medical: { name: 'Medizinische Abteilung', short: 'Medizin', icon: 'medic', base: 3e6, upkeep: 0.4e6 },
    scouting: { name: 'Scouting-Abteilung', short: 'Scouting', icon: 'search', base: 2e6, upkeep: 0.3e6 },
    commercial: { name: 'Marketing & Fanshop', short: 'Marketing', icon: 'euro' }
  };

  function startLevel(club) { return FM.clamp(Math.round((club.rep - 25) / 15), 1, 5); }

  /* Fehlende Felder anlegen (neues Spiel und aeltere Spielstaende) */
  FM.ensureClub = function (club) {
    // Fanbasis: bei Amateurvereinen aus dem Zuschauerschnitt abgeleitet (grosse alte Stadien bleiben leer)
    if (club.cap0 == null) club.cap0 = club.fans ? Math.round(club.fans / baseFill(club)) : club.cap;
    if (!club.fac) {
      var l = startLevel(club);
      club.fac = { training: l, youth: l, medical: l, scouting: Math.max(1, l - 1), commercial: l };
      club.facBase = { training: club.fac.training, youth: club.fac.youth, medical: club.fac.medical, scouting: club.fac.scouting, commercial: club.fac.commercial };
    }
    if (!club.builds) club.builds = [];
    if (!club.attS) club.attS = { n: 0, sum: 0, full: 0 };
  };

  FM.ensureState = function (state) {
    Object.keys(state.clubs).forEach(function (cid) { FM.ensureClub(state.clubs[cid]); });
    var uc = state.clubs[state.user.club];
    if (uc && !uc.budget) FM.setBudgets(state, uc, 'season');
  };

  FM.facLevel = function (club, key) { return club && club.fac && club.fac[key] ? club.fac[key] : 3; };

  /* Effekte – Stufe 3 ist neutral, darunter schlechter, darueber besser. Gilt fuer alle Vereine. */
  FM.facDev = function (club) { return 1 + 0.08 * (FM.facLevel(club, 'training') - 3); };
  FM.facTrainingInj = function (club) { return 1 - 0.1 * (FM.facLevel(club, 'training') - 3); };
  FM.facInjuryDays = function (club) { return 1 - 0.08 * (FM.facLevel(club, 'medical') - 3); };
  FM.facRegen = function (club) { return 1 + 0.03 * (FM.facLevel(club, 'medical') - 3); };
  FM.facYouthOvr = function (club) { return FM.facLevel(club, 'youth') - 3; };
  FM.facYouthPot = function (club) { return 2 * (FM.facLevel(club, 'youth') - 3); };
  FM.facYouthExtra = function (club) { return FM.facLevel(club, 'youth') >= 4 ? 1 : 0; };
  FM.facScoutSpread = function (club) { return [1.75, 1.25, 1, 0.5, 0][FM.facLevel(club, 'scouting') - 1]; };
  FM.agentRate = function (club) { return 0.14 - 0.02 * FM.facLevel(club, 'scouting'); };
  FM.facCommercial = function (club) {
    if (!club || !club.fac) return 1;
    return 1 + 0.08 * (club.fac.commercial - (club.facBase ? club.facBase.commercial : club.fac.commercial));
  };

  /* ---------- Stadion & Zuschauer ---------- */
  var LEAGUE_FILL = { bl: 0.25, bl2: 0.12, l3: 0, rlw: -0.25, rlsw: -0.25, rl: -0.1, olw: -0.35, olsw: -0.35 };
  function baseFill(club) { return Math.max(0.12, 0.55 + (club.rep - 40) / 100 + (LEAGUE_FILL[club.league] || 0)); }

  /* Zuschauernachfrage: die Fanbasis bemisst sich an der urspruenglichen Stadiongroesse,
     die Auslastung an Reputation, Liga und Gegner. Mehr Plaetze bringen nur etwas,
     wenn die Nachfrage die Kapazitaet uebersteigt. */
  FM.fanDemand = function (club, oppRep, comp, levelGap) {
    var cap0 = club.cap0 || club.cap;
    var fill = 0.55 + (club.rep - 40) / 100 + (LEAGUE_FILL[club.league] || 0);
    if (oppRep != null) fill += (oppRep - 60) / 400;
    if (comp === 'cup' || comp === 'po1' || comp === 'po2') fill += 0.15;
    // Pokalknaller: der Kleine empfaengt einen Klub aus hoeherer Liga
    if (comp === 'cup' && levelGap > 0) fill += 0.22 * levelGap;
    if (club.league !== 'bl') fill *= Math.min(1, 45000 / cap0 + 0.25);
    return cap0 * fill;
  };

  FM.effectiveCap = function (club) {
    var building = (club.builds || []).some(function (b) { return b.fac === 'stadium'; });
    return Math.round(club.cap * (building ? 0.94 : 1));
  };

  /* Erwarteter Zuschauerschnitt in der Liga (fuer Planung und Prognosen) */
  FM.expectedAttendance = function (club, cap) {
    var c = cap != null ? cap : FM.effectiveCap(club);
    var cap0 = club.cap0 || club.cap;
    return Math.round(FM.clamp(FM.fanDemand(club, 60), cap0 * 0.12, c));
  };

  FM.homeGames = function (club) { return HOME_GAMES[club.league] || 17; };

  /* ---------- Kosten, Unterhalt, Angebote ---------- */
  FM.facUpkeep = function (club) {
    if (!club.fac) return 0;
    var s = LEAGUE_SCALE[club.league] || 0.1, sum = 0;
    ['training', 'youth', 'medical', 'scouting'].forEach(function (k) {
      var extra = club.fac[k] - (club.facBase ? club.facBase[k] : club.fac[k]);
      if (extra > 0) sum += FM.FACILITIES[k].upkeep * extra * s;
    });
    var cExtra = club.fac.commercial - (club.facBase ? club.facBase.commercial : club.fac.commercial);
    if (cExtra > 0) sum += (club.commercial || 0) * 0.01 * cExtra;
    return Math.round(sum);
  };

  var SEAT_COST = { bl: 4000, bl2: 3000, l3: 2200, rlw: 1500, rlsw: 1500, rl: 1800, olw: 1200, olsw: 1200 };
  FM.STADIUM_MAX = 85000;

  FM.facQuote = function (club, key) {
    var s = LEAGUE_SCALE[club.league] || 0.1;
    if (key === 'stadium') {
      var seats = FM.clamp(Math.round(club.cap * 0.1 / 500) * 500, 1000, 8000);
      if (club.cap + seats > FM.STADIUM_MAX) seats = FM.STADIUM_MAX - club.cap;
      if (seats < 500) return null;
      return { cost: FM.niceRound(seats * (SEAT_COST[club.league] || 2500)), weeks: Math.round(26 + seats / 400), seats: seats, upkeep: 0 };
    }
    var lvl = club.fac[key];
    if (lvl >= FM.FAC_MAX) return null;
    if (key === 'commercial') {
      var com = club.commercial || 0;
      return { cost: FM.niceRound(com * 0.06 * (4 + lvl * 0.5)), weeks: 6 + 3 * lvl, upkeep: Math.round(com * 0.01), toLevel: lvl + 1 };
    }
    var f = FM.FACILITIES[key];
    return { cost: FM.niceRound(f.base * lvl * s), weeks: 8 + 6 * lvl, upkeep: Math.round(f.upkeep * s), toLevel: lvl + 1 };
  };

  FM.facBuilding = function (club, key) {
    return (club.builds || []).filter(function (b) { return b.fac === key; })[0] || null;
  };

  /* Mehreinnahmen pro Saison durch einen Stadionausbau (bei aktueller Nachfrage) */
  FM.stadiumGain = function (club, seats) {
    var now = FM.expectedAttendance(club, club.cap);
    var after = FM.expectedAttendance(club, club.cap + seats);
    return Math.round((after - now) * (FM.ticketPrice[club.league] || 15) * FM.homeGames(club));
  };

  /* ================= Budgets ================= */

  /* Prognose der laufenden Saison (gesamt, ohne Transfers und Praemien) */
  FM.seasonForecast = function (state, club) {
    var plan = FM.annualPlan(club);
    var tickets = FM.expectedAttendance(club) * (FM.ticketPrice[club.league] || 15) * FM.homeGames(club);
    var wages = FM.annualWages(state, club);
    var upkeep = FM.facUpkeep(club);
    var revenue = plan.tv + plan.sponsor + tickets;
    var costs = wages + plan.ops + upkeep;
    return { tv: plan.tv, sponsor: plan.sponsor, tickets: tickets, revenue: revenue, wages: wages, ops: plan.ops, upkeep: upkeep, costs: costs, result: revenue - costs };
  };

  /* Liquiditaetsreserve: drei Monate Fixkosten muessen auf dem Konto bleiben */
  FM.cashReserve = function (state, club) {
    var fc = FM.seasonForecast(state, club);
    return Math.round((fc.wages + fc.ops + fc.upkeep) * 0.25);
  };

  /* Anteil der Saison, der noch vor dem Verein liegt (Juli = 1, Januar ≈ 0,5) */
  FM.seasonLeft = function (state) {
    var end = D.iso(state.season.year + 1, 6, 30);
    return FM.clamp(D.diff(state.date, end) / 365, 0.15, 1);
  };

  /* Freigabequote fuer freie Mittel – haengt am Vertrauen des Vorstands */
  FM.releaseQuote = function (conf) { return FM.clamp(0.5 + (conf - 50) / 200, 0.35, 0.75); };

  /* Anteil von Verkaufserloesen, der ins Transferbudget zurueckfliesst */
  FM.salesShare = function (state, club) {
    var b = club.budget;
    if (b && b.austerity) return 0.25;
    var conf = club.id === state.user.club ? state.user.conf : 60;
    return conf >= 70 ? 0.75 : conf >= 45 ? 0.6 : 0.45;
  };

  /* Herleitung der Budgets (wird auch in der Oberflaeche angezeigt) */
  FM.budgetPlan = function (state, club, winter) {
    var fc = FM.seasonForecast(state, club);
    var reserve = FM.cashReserve(state, club);
    var left = winter ? FM.seasonLeft(state) : 1;
    var projected = fc.result * left;
    var counted = projected > 0 ? projected * 0.5 : projected;
    var free = club.money - reserve + counted;
    var conf = club.id === state.user.club ? state.user.conf : 60;
    var quote = FM.releaseQuote(conf);
    var transfer = free > 0 ? FM.niceRound(free * quote) : 0;
    if (transfer > free) transfer = Math.max(0, Math.floor(free / 10000) * 10000);
    /* Der Ueberschuss kommt erst im Saisonverlauf herein: ausgegeben werden kann nur, was auf dem
       Konto liegt – mindestens die halbe Reserve bleibt immer stehen. */
    // ... plus die Monatsrate aus TV und Sponsoring, die noch im laufenden Transferfenster eingeht
    var installment = (fc.tv + fc.sponsor) / 10;
    var cashCap = Math.max(0, Math.floor((club.money - reserve * 0.5 + installment) / 10000) * 10000);
    var cashLimited = transfer > cashCap;
    if (cashLimited) transfer = cashCap;
    var ratioCap = fc.revenue * (WAGE_RATIO[club.league] || 0.6);
    var wage = free > 0 || fc.result >= 0 ? Math.max(fc.wages * 1.03, ratioCap) : fc.wages;
    return {
      money: club.money, reserve: reserve, projected: projected, counted: counted, free: free,
      conf: conf, quote: quote, transfer: transfer, cashCap: cashCap, cashLimited: cashLimited, wage: Math.round(wage / 10000) * 10000, forecast: fc
    };
  };

  function logBudget(b, state, kind, amount, text) {
    b.log = b.log || [];
    b.log.unshift({ d: state.date, k: kind, a: Math.round(amount), t: text });
    if (b.log.length > 40) b.log.length = 40;
  }

  /* Vorstand legt die Budgets fest: mode 'season' (Saisonstart/neuer Job) oder 'winter' */
  FM.setBudgets = function (state, club, mode) {
    var winter = mode === 'winter';
    var plan = FM.budgetPlan(state, club, winter);
    var old = club.budget;
    var b;
    if (winter && old) {
      b = old;
      var before = b.transfer, pot = b.pot || 0, regular = b.transfer - pot;
      if (plan.transfer > regular) regular += FM.niceRound((plan.transfer - regular) * 0.5);
      else regular = Math.max(0, Math.min(regular, plan.transfer));
      b.transfer = regular + pot;
      // bereits bezahlter (umgeschichteter) Spielraum bleibt erhalten
      b.wage = Math.max(plan.wage, b.wage);
      b.requested = false;
      b.austerity = club.money < 0;
      if (b.austerity) b.transfer = pot;
      logBudget(b, state, 'winter', b.transfer - before, 'Neubewertung zum Wintertransferfenster');
    } else {
      var potNew = FM.potBase(club);
      b = club.budget = {
        season: state.season.year,
        transfer: plan.transfer + potNew, start: plan.transfer + potNew, wage: plan.wage, wageStart: plan.wage,
        pot: potNew, potStart: potNew,
        spent: 0, earned: 0, extra: 0, infra: 0,
        requested: false, austerity: club.money < 0, log: []
      };
      if (b.austerity) b.transfer = potNew;
      logBudget(b, state, 'start', b.transfer - potNew, 'Budget zum Saisonstart');
      if (potNew) logBudget(b, state, 'pot', potNew, 'Sponsorentopf für die Saison');
    }
    b.plan = {
      reserve: plan.reserve, projected: Math.round(plan.projected), counted: Math.round(plan.counted), free: Math.round(plan.free),
      quote: plan.quote, money: Math.round(plan.money), winter: winter, cashCap: plan.cashCap, cashLimited: plan.cashLimited, conf: Math.round(plan.conf), transfer: plan.transfer
    };
    return b;
  };

  FM.budget = function (state, club) {
    club = club || state.clubs[state.user.club];
    if (!club.budget) FM.setBudgets(state, club, 'season');
    return club.budget;
  };

  FM.wageRoom = function (state, club) {
    return FM.budget(state, club).wage - FM.annualWages(state, club);
  };

  /* Gesamtkosten eines Transfers fuer den Kaeufer */
  FM.transferCost = function (state, buyer, p, fee, wage) {
    if (p.club) {
      var agent = Math.round(fee * FM.agentRate(buyer));
      return { fee: fee, agent: agent, bonus: 0, total: fee + agent };
    }
    var bonus = Math.round((wage || 0) * FM.SIGNING_BONUS);
    return { fee: 0, agent: 0, bonus: bonus, total: bonus };
  };

  /* Pruefung gegen beide Budgets; liefert eine Fehlermeldung oder null */
  FM.checkBudget = function (state, club, cost, addWage, minusWage) {
    var b = FM.budget(state, club);
    if (b.austerity && cost.total > (b.pot || 0)) return 'Der Verein ist auf Sparkurs – nur der Sponsorentopf (' + FM.fmtMoney(b.pot || 0) + ') steht zur Verfügung. Verkaufe zuerst Spieler.';
    if (cost.total > b.transfer) {
      return 'Das Transferbudget reicht nicht: benötigt ' + FM.fmtMoney(cost.total) +
        (cost.agent ? ' (inkl. ' + FM.fmtMoney(cost.agent) + ' Beraterhonorar)' : cost.bonus ? ' (Handgeld)' : '') +
        ', verfügbar ' + FM.fmtMoney(b.transfer) + '.';
    }
    if (cost.total > club.money + (b.pot || 0)) return 'Dafür reicht der Kontostand nicht aus.';
    var room = b.wage - FM.annualWages(state, club) + (minusWage || 0);
    if (addWage > room) {
      return 'Das Gehaltsbudget reicht nicht: Spielraum ' + FM.fmtMoney(Math.max(0, room)) + ' pro Jahr, benötigt ' + FM.fmtMoney(addWage) +
        '. Schichte Transferbudget um oder gib Gehalt ab.';
    }
    return null;
  };

  FM.spendBudget = function (state, club, cost, text) {
    var b = FM.budget(state, club);
    b.transfer = Math.max(0, b.transfer - cost);
    b.spent += cost;
    var fromPot = usePot(state, club, cost);
    logBudget(b, state, 'buy', -cost, (text || 'Transfer') + (fromPot ? ' (Sponsor zahlt ' + FM.fmtMoney(fromPot) + ')' : ''));
  };

  FM.creditSale = function (state, club, fee, text) {
    var b = FM.budget(state, club);
    var add = FM.niceRound(fee * FM.salesShare(state, club));
    if (add > fee) add = fee;
    b.transfer += add;
    b.earned += add;
    logBudget(b, state, 'sale', add, text || 'Verkauf');
    return add;
  };

  /* Umschichten. dir 'wage': Transferbudget -> Gehaltsbudget (2:1).
     dir 'transfer': ungenutzter Gehaltsspielraum -> Transferbudget (anteilig fuer den Rest der Saison). */
  FM.shiftRate = function (state) { return Math.round(FM.seasonLeft(state) * 100) / 100; };
  FM.shiftBudget = function (state, dir, amount) {
    var club = state.clubs[state.user.club], b = FM.budget(state, club);
    amount = Math.max(0, Math.round(amount / 1000) * 1000);
    if (!amount) return { ok: false, msg: 'Kein Betrag gewählt.' };
    if (dir === 'wage') {
      amount = Math.min(amount, b.transfer);
      var gain = Math.round(amount / FM.WAGE_SHIFT_COST);
      b.transfer -= amount; b.wage += gain;
      usePot(state, club, amount);
      logBudget(b, state, 'shift', -amount, 'Umgeschichtet: +' + FM.fmtMoney(gain) + ' Gehaltsbudget pro Jahr');
      return { ok: true, msg: FM.fmtMoney(amount) + ' Transferbudget → +' + FM.fmtMoney(gain) + ' Gehaltsspielraum pro Jahr.' };
    }
    var room = Math.max(0, FM.wageRoom(state, club));
    amount = Math.min(amount, room);
    if (!amount) return { ok: false, msg: 'Es ist kein Gehaltsspielraum frei.' };
    var t = Math.round(amount * FM.shiftRate(state));
    b.wage -= amount; b.transfer += t;
    logBudget(b, state, 'shift', t, 'Umgeschichtet aus ' + FM.fmtMoney(amount) + ' Gehaltsspielraum');
    return { ok: true, msg: FM.fmtMoney(amount) + ' Gehaltsspielraum → +' + FM.fmtMoney(t) + ' Transferbudget.' };
  };

  /* Nachschlag beim Vorstand (einmal pro Halbserie) */
  FM.requestBudget = function (state) {
    var club = state.clubs[state.user.club], b = FM.budget(state, club);
    if (b.requested) return { ok: false, msg: 'Der Vorstand hat in dieser Halbserie bereits über einen Nachschlag entschieden.' };
    b.requested = true;
    var conf = state.user.conf;
    if (b.austerity) {
      state.user.conf = Math.max(0, conf - 2);
      return { ok: false, msg: 'Abgelehnt. Der Verein ist auf Sparkurs – erst müssen Spieler verkauft werden.' };
    }
    var lid = club.league, pos = FM.ZONES[lid] && FM.playedRounds(state, lid) >= 5 ? FM.clubPosition(state, club.id) : null;
    if (pos && club.expect && pos > club.expect.target + 3) {
      state.user.conf = Math.max(0, conf - 2);
      return { ok: false, msg: 'Abgelehnt. Bei Platz ' + pos + ' (Ziel: ' + club.expect.target + ') gibt es kein zusätzliches Geld – erst müssen die Ergebnisse stimmen.' };
    }
    if (conf < 40) {
      state.user.conf = Math.max(0, conf - 3);
      return { ok: false, msg: 'Abgelehnt. Das Vertrauen in deine Arbeit reicht dafür nicht.' };
    }
    var reserve = FM.cashReserve(state, club);
    var unallocated = club.money - reserve - (b.transfer - (b.pot || 0));
    if (unallocated < Math.max(50000, b.start * 0.1)) {
      return { ok: false, msg: 'Abgelehnt. Über dem Transferbudget hinaus ist kein Geld frei – die Liquiditätsreserve von ' + FM.fmtMoney(reserve) + ' bleibt unangetastet.' };
    }
    var share = conf >= 75 ? 0.6 : conf >= 60 ? 0.4 : 0.25;
    var add = FM.niceRound(unallocated * share);
    if (add > unallocated) add = Math.floor(unallocated / 10000) * 10000;
    b.transfer += add; b.extra += add;
    state.user.conf = Math.max(0, conf - 4);
    logBudget(b, state, 'extra', add, 'Nachschlag vom Vorstand');
    return { ok: true, msg: 'Bewilligt. Der Vorstand gibt zusätzlich ' + FM.fmtMoney(add) + ' frei, erwartet dafür aber Ergebnisse: Das Vertrauen sinkt um 4 Punkte.' };
  };

  /* Monatliche Pruefung: Konto im Minus -> Sparkurs */
  FM.boardFinanceCheck = function (state) {
    var club = state.clubs[state.user.club], b = FM.budget(state, club);
    if (club.money < 0) {
      if (!b.austerity) {
        b.austerity = true;
        logBudget(b, state, 'freeze', -(b.transfer - (b.pot || 0)), 'Sparkurs: Transferbudget eingefroren');
        b.transfer = b.pot || 0;
        FM.addNews(state, {
          type: 'board', important: true, title: 'Sparkurs verordnet',
          body: 'Das Vereinskonto steht im Minus (' + FM.fmtMoney(club.money) + '). Der Vorstand friert das Transferbudget ein. Von Verkaufserlösen fließt nur noch ein Viertel ins Budget, bis die Finanzen wieder stimmen.'
        });
      }
      state.user.conf = Math.max(0, state.user.conf - 1.5);
    } else if (b.austerity && club.money > FM.cashReserve(state, club) * 0.5) {
      b.austerity = false;
      FM.addNews(state, { type: 'board', title: 'Sparkurs beendet', body: 'Die Finanzen haben sich erholt. Zum nächsten Transferfenster legt der Vorstand wieder ein reguläres Budget fest.' });
    }
  };

  /* ================= Bauen ================= */

  FM.startBuild = function (state, key) {
    var club = state.clubs[state.user.club];
    if (FM.facBuilding(club, key)) return { ok: false, msg: 'Hier wird bereits gebaut.' };
    var q = FM.facQuote(club, key);
    if (!q) return { ok: false, msg: 'Die höchste Ausbaustufe ist erreicht.' };
    var b = FM.budget(state, club);
    if (b.austerity) return { ok: false, msg: 'Während des Sparkurses genehmigt der Vorstand keine Investitionen.' };
    var reserve = FM.cashReserve(state, club);
    if (club.money - q.cost < reserve) {
      return { ok: false, msg: 'Der Vorstand lehnt ab: Danach läge der Kontostand unter der Liquiditätsreserve von ' + FM.fmtMoney(reserve) + '.' };
    }
    FM.book(club, 'infra', -q.cost);
    var cap = Math.max(0, club.money - reserve) + (b.pot || 0);
    if (b.transfer > cap) {
      var cut = b.transfer - Math.floor(cap / 10000) * 10000;
      b.transfer -= cut; b.infra += cut;
      logBudget(b, state, 'infra', -cut, FM.FACILITIES[key].name + ': Investition mindert das Transferbudget');
    }
    club.builds.push({ fac: key, weeks: q.weeks, total: q.weeks, seats: q.seats || 0, toLevel: q.toLevel || 0, cost: q.cost, start: state.date });
    return { ok: true, msg: FM.FACILITIES[key].name + ': Ausbau gestartet, fertig in ' + q.weeks + ' Wochen.' };
  };

  FM.progressBuilds = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      if (!club.builds || !club.builds.length) return;
      club.builds = club.builds.filter(function (bd) {
        bd.weeks--;
        if (bd.weeks > 0) return true;
        if (bd.fac === 'stadium') club.cap += bd.seats;
        else club.fac[bd.fac] = bd.toLevel;
        if (cid === state.user.club) {
          FM.addNews(state, {
            type: 'board', important: true, title: FM.FACILITIES[bd.fac].name + ' fertiggestellt',
            body: bd.fac === 'stadium' ? 'Der Ausbau ist abgeschlossen: Das ' + club.stadium + ' fasst jetzt ' + FM.fmtInt(club.cap) + ' Zuschauer.' : FM.FACILITIES[bd.fac].name + ' ist jetzt auf Stufe ' + bd.toLevel + '. Die Wirkung setzt sofort ein.'
          });
        }
        return false;
      });
    });
  };

  /* Monatlicher Unterhalt fuer Ausbaustufen ueber dem Ausgangsniveau */
  FM.payUpkeep = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid], u = FM.facUpkeep(club);
      if (u) FM.book(club, 'infra', -u / 12);
    });
  };

  /* KI-Vereine investieren in der Sommerpause gelegentlich in ihre Infrastruktur */
  FM.aiInvest = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      if (cid === state.user.club || club.reserve || !FM.isSimLeague(club.league) || club.builds.length) return;
      if (!R.chance(0.25)) return;
      var opts = ['training', 'youth', 'medical', 'scouting'].filter(function (k) {
        return club.fac[k] < Math.min(FM.FAC_MAX, club.facBase[k] + 2);
      });
      if (!opts.length) return;
      var key = R.pick(opts), q = FM.facQuote(club, key);
      if (!q || club.money - q.cost < FM.cashReserve(state, club) + q.cost * 0.5) return;
      FM.book(club, 'infra', -q.cost);
      club.builds.push({ fac: key, weeks: q.weeks, total: q.weeks, seats: 0, toLevel: q.toLevel, cost: q.cost, start: state.date });
    });
  };

  /* Sponsorentopf der Regionalliga: zweckgebundenes Geld des Hauptsponsors bzw. Foerderkreises.
     Es wird erst ausgezahlt, wenn es fuer Abloesen, Handgelder oder Gehaltsspielraum genutzt wird,
     und verfaellt am Saisonende. */
  FM.potBase = function (club) {
    if (!FM.isRegional(club.league)) return 0;
    if (club.pot != null) return club.pot;
    return Math.round((40 + club.rep * 1.5) / 10) * 10000;
  };
  function usePot(state, club, amount) {
    var b = club.budget;
    if (!b || !b.pot || amount <= 0) return 0;
    var use = Math.min(b.pot, amount);
    b.pot -= use;
    FM.book(club, 'sponsor', use);
    return use;
  }

  /* Kurzfassung fuer Nachrichten */
  FM.budgetText = function (b) {
    if (!b) return '';
    var pot = b.pot ? ' (davon ' + FM.fmtMoney(b.pot) + ' Sponsorentopf)' : '';
    if (b.austerity) return 'Wegen des Kontostands im Minus gilt Sparkurs: Transferbudget nur aus dem Sponsorentopf (' + FM.fmtMoney(b.pot || 0) + '), Gehaltsbudget ' + FM.fmtMoney(b.wage) + ' pro Jahr.';
    return 'Transferbudget: ' + FM.fmtMoney(b.transfer) + pot + ', Gehaltsbudget: ' + FM.fmtMoney(b.wage) + ' pro Jahr.';
  };

  /* Zuschauerstatistik der laufenden Saison */
  FM.recordAttendance = function (club, att) {
    club.attS = club.attS || { n: 0, sum: 0, full: 0 };
    club.attS.n++;
    club.attS.sum += att;
    if (att >= FM.effectiveCap(club) - 1) club.attS.full++;
  };
})();
