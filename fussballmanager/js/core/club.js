/* Vorstandsbudgets (Transfer- und Gehaltsbudget) sowie Infrastruktur. */
(function () {
  'use strict';
  var FM = window.FM;

  var LEAGUE_SCALE = { bl: 1, bl2: 0.35, l3: 0.12, rl: 0.06 };
  var WAGE_RATIO = { bl: 0.58, bl2: 0.62, l3: 0.66, rl: 0.7 };
  FM.AGENT_FEE = 0.1;      // Beraterhonorar auf Abloesen
  FM.SIGNING_BONUS = 0.25; // Handgeld bei Vereinslosen (Anteil Jahresgehalt)

  /* ================= Budgets ================= */

  function revenueEstimate(state, club) {
    var plan = FM.annualPlan(club);
    var tickets = FM.expectedTickets(club, FM.effectiveCap(club));
    return { total: plan.tv + plan.sponsor + tickets, plan: plan, tickets: tickets };
  }
  FM.revenueEstimate = revenueEstimate;

  /* Liquiditaetsreserve: muss laut Lizenzauflagen auf dem Konto bleiben */
  FM.cashReserve = function (state, club) {
    var plan = FM.annualPlan(club);
    return Math.round(FM.annualWages(state, club) * 0.15 + plan.ops * 0.2);
  };

  /* Vorstand legt zu Saisonbeginn (und im Winter) die Budgets fest */
  FM.setBudgets = function (state, club, winter) {
    var wages = FM.annualWages(state, club);
    var rev = revenueEstimate(state, club);
    var reserve = FM.cashReserve(state, club);
    var free = club.money - reserve;
    var conf = club.id === state.user.club ? state.user.conf : 60;
    var share = FM.clamp(0.55 + (conf - 50) / 250, 0.4, 0.75);
    // Gehaltsbudget: Anteil am Umsatz, aber hoechstens 25 % ueber dem aktuellen Gehaltsniveau
    var wageBudget = FM.niceRound(Math.max(wages * 1.05, Math.min(rev.total * (WAGE_RATIO[club.league] || 0.6), wages * 1.25)));
    var transfer = free > 0 ? FM.niceRound(free * share * (winter ? 0.6 : 1)) : 0;
    var old = club.budget;
    if (winter && old) { transfer = Math.max(old.transfer, transfer); wageBudget = Math.max(old.wage, wageBudget); }
    club.budget = {
      transfer: transfer,
      wage: wageBudget,
      reserve: reserve,
      salesShare: free > 0 ? 0.7 : 0.4,
      austerity: free <= 0,
      requested: false,
      start: transfer,
      spent: winter && old ? old.spent : 0,
      earned: winter && old ? old.earned : 0
    };
    return club.budget;
  };

  FM.budgetNews = function (state, winter) {
    var club = state.clubs[state.user.club], b = club.budget;
    FM.addNews(state, {
      type: 'board', important: !winter, title: winter ? 'Vorstand: Budget für die Winterpause' : 'Vorstand: Budgets für die neue Saison',
      body: (b.austerity ? 'Der Verein steht unter Sparzwang – es gibt kein Transferbudget. Verkäufe fließen nur zu 40 % zurück ins Budget. ' :
        'Transferbudget: ' + FM.fmtMoney(b.transfer) + '. ') +
        'Gehaltsbudget: ' + FM.fmtMoney(b.wage) + ' pro Jahr (aktuell gebunden: ' + FM.fmtMoney(FM.annualWages(state, club)) + '). ' +
        'Auf dem Konto müssen mindestens ' + FM.fmtMoney(b.reserve) + ' Liquiditätsreserve bleiben.'
    });
  };

  FM.budget = function (state, club) {
    if (!club.budget) FM.setBudgets(state, club);
    return club.budget;
  };

  FM.wageRoom = function (state, club) {
    return FM.budget(state, club).wage - FM.annualWages(state, club);
  };

  /* Gesamtkosten eines Transfers fuer das Budget */
  FM.transferCost = function (p, fee, wage) {
    if (p.club) return Math.round(fee * (1 + FM.AGENT_FEE));
    return Math.round(wage * FM.SIGNING_BONUS);
  };

  /* Pruefung gegen beide Budgets; liefert Fehlermeldung oder null */
  FM.checkBudget = function (state, club, cost, addWage, subtractWage) {
    var b = FM.budget(state, club);
    if (cost > b.transfer) return 'Das Transferbudget reicht nicht: benötigt ' + FM.fmtMoney(cost) + ' inklusive Nebenkosten, verfügbar ' + FM.fmtMoney(b.transfer) + '.';
    if (cost > club.money - b.reserve) return 'Der Vorstand gibt das Geld nicht frei: Die Liquiditätsreserve von ' + FM.fmtMoney(b.reserve) + ' muss auf dem Konto bleiben.';
    var room = b.wage - FM.annualWages(state, club) + (subtractWage || 0);
    if (addWage > room) return 'Das Gehaltsbudget ist ausgeschöpft: Spielraum ' + FM.fmtMoney(Math.max(0, room)) + ' pro Jahr, gefordert ' + FM.fmtMoney(addWage) + '.';
    return null;
  };

  FM.spendBudget = function (state, club, cost) {
    var b = FM.budget(state, club);
    b.transfer = Math.max(0, b.transfer - cost);
    b.spent += cost;
  };

  FM.creditSale = function (state, club, fee) {
    var b = FM.budget(state, club);
    var add = Math.round(fee * b.salesShare);
    b.transfer += add;
    b.earned += add;
    return add;
  };

  /* Umschichten zwischen Transfer- und Gehaltsbudget (1 € Ablöse = 1 € Jahresgehalt) */
  FM.shiftBudget = function (state, club, amount) {
    var b = FM.budget(state, club);
    if (amount > 0) { amount = Math.min(amount, b.transfer); b.transfer -= amount; b.wage += amount; }
    else { amount = Math.max(amount, -Math.max(0, FM.wageRoom(state, club))); b.transfer -= amount; b.wage += amount; }
    return amount;
  };

  /* Nachschlag beim Vorstand anfragen (einmal pro Transferfenster) */
  FM.requestBudget = function (state) {
    var club = state.clubs[state.user.club], b = FM.budget(state, club);
    if (b.requested) return { ok: false, msg: 'Der Vorstand hat in diesem Transferfenster bereits entschieden.' };
    b.requested = true;
    var free = club.money - b.reserve - b.transfer;
    var conf = state.user.conf;
    if (b.austerity || free <= 0) {
      state.user.conf = Math.max(0, conf - 2);
      return { ok: false, msg: 'Abgelehnt. Der Verein ist auf Sparkurs – erst müssen Spieler verkauft werden.' };
    }
    if (conf < 45) {
      state.user.conf = Math.max(0, conf - 3);
      return { ok: false, msg: 'Abgelehnt. Erst müssen die Ergebnisse stimmen, dann gibt es mehr Geld.' };
    }
    var add = FM.niceRound(Math.min(free * (conf >= 70 ? 0.45 : 0.25), Math.max(b.start * 0.4, free * 0.1)));
    if (add < 10000) return { ok: false, msg: 'Abgelehnt. Es ist kein zusätzliches Geld verfügbar.' };
    b.transfer += add;
    return { ok: true, msg: 'Der Vorstand gibt zusätzlich ' + FM.fmtMoney(add) + ' frei.' };
  };

  /* ================= Infrastruktur ================= */

  FM.FACILITIES = {
    stadium: { name: 'Stadion', icon: 'stadium', text: 'Mehr Plätze bringen mehr Zuschauereinnahmen. Während des Ausbaus fehlen rund 8 % der Kapazität.' },
    training: { name: 'Trainingszentrum', icon: 'training', base: 6e6, upkeep: 0.8e6, text: 'Bessere Plätze und Geräte: Spieler entwickeln sich schneller, Trainingsverletzungen werden seltener.' },
    youth: { name: 'Nachwuchsleistungszentrum', icon: 'youth', base: 5e6, upkeep: 0.6e6, text: 'Stärkere Talente mit höherem Potenzial; ab Stufe 4 ein zusätzlicher Jahrgangsspieler.' },
    medical: { name: 'Medizinische Abteilung', icon: 'medic', base: 3e6, upkeep: 0.4e6, text: 'Verletzungen heilen schneller, Spieler erholen sich besser zwischen den Spielen.' },
    scouting: { name: 'Scoutingabteilung', icon: 'search', base: 2e6, upkeep: 0.3e6, text: 'Genauere Einschätzung des Potenzials fremder Spieler – auf Stufe 5 kennst du es exakt.' },
    commercial: { name: 'Marketing & Fanshop', icon: 'euro', base: 2.5e6, upkeep: 0.3e6, text: 'Jede neue Stufe erhöht die Sponsoring- und Merchandising-Einnahmen um 8 %.' }
  };
  FM.FAC_KEYS = ['stadium', 'training', 'youth', 'medical', 'scouting', 'commercial'];
  FM.FAC_MAX = 5;

  FM.initFacilities = function (club) {
    var lvl = FM.clamp(Math.round((club.rep - 22) / 16), 1, 5);
    club.fac = { training: lvl, youth: lvl, medical: lvl, scouting: Math.max(1, lvl - 1), commercial: lvl, stadium: 0 };
    club.builds = [];
    club.facBase = { commercial: club.fac.commercial };
  };

  FM.facLevel = function (club, key) { return club && club.fac ? club.fac[key] || 1 : 3; };

  /* Effekte */
  /* Alle Effekte sind auf Stufe 3 neutral (Faktor 1) */
  FM.facTrainingDev = function (club) { return 0.85 + 0.05 * FM.facLevel(club, 'training'); };
  FM.facTrainingInj = function (club) { return 1.3 - 0.1 * FM.facLevel(club, 'training'); };
  FM.facInjuryDays = function (club) { return 1.27 - 0.09 * FM.facLevel(club, 'medical'); };
  FM.facRegen = function (club) { return 0.94 + 0.02 * FM.facLevel(club, 'medical'); };
  FM.facYouthBonus = function (club) { return FM.facLevel(club, 'youth') - 3; };
  FM.facCommercial = function (club) {
    if (!club.fac) return 1;
    return 1 + 0.08 * (club.fac.commercial - (club.facBase ? club.facBase.commercial : club.fac.commercial));
  };
  FM.facScoutSpread = function (club) { return [8, 6, 4, 2, 0][FM.facLevel(club, 'scouting') - 1]; };
  FM.effectiveCap = function (club) {
    var building = (club.builds || []).some(function (b) { return b.fac === 'stadium'; });
    return Math.round(club.cap * (building ? 0.92 : 1));
  };

  FM.facUpkeep = function (club) {
    if (!club.fac) return 0;
    var s = LEAGUE_SCALE[club.league] || 0.1, sum = 0;
    FM.FAC_KEYS.forEach(function (k) {
      var f = FM.FACILITIES[k];
      if (f.upkeep) sum += f.upkeep * club.fac[k] * s;
    });
    return sum;
  };

  /* Angebot fuer die naechste Ausbaustufe */
  FM.facQuote = function (club, key) {
    var s = LEAGUE_SCALE[club.league] || 0.1;
    if (key === 'stadium') {
      var seats = FM.clamp(Math.round(club.cap * 0.1 / 500) * 500, 1000, 8000);
      if (club.cap + seats > 90000) seats = 90000 - club.cap;
      if (seats <= 0) return null;
      var perSeat = { bl: 3500, bl2: 2600, l3: 1800, rl: 1500 }[club.league] || 1800;
      var gain = FM.expectedTickets(club, club.cap + seats) - FM.expectedTickets(club);
      return { cost: FM.niceRound(seats * perSeat), weeks: Math.round(26 + seats / 400), seats: seats, upkeep: 0, gain: gain };
    }
    var lvl = club.fac[key];
    if (lvl >= FM.FAC_MAX) return null;
    var f = FM.FACILITIES[key];
    var q = { cost: FM.niceRound(f.base * lvl * s), weeks: 8 + 6 * lvl, upkeep: f.upkeep * s, toLevel: lvl + 1 };
    if (key === 'commercial') q.gain = (club.commercial || 0) * 0.08;
    return q;
  };

  FM.facBuilding = function (club, key) {
    return (club.builds || []).filter(function (b) { return b.fac === key; })[0] || null;
  };

  FM.startBuild = function (state, key) {
    var club = state.clubs[state.user.club];
    if (FM.facBuilding(club, key)) return { ok: false, msg: 'Hier wird bereits gebaut.' };
    var q = FM.facQuote(club, key);
    if (!q) return { ok: false, msg: 'Die höchste Ausbaustufe ist erreicht.' };
    var reserve = FM.cashReserve(state, club);
    if (club.money - q.cost < reserve) {
      return { ok: false, msg: 'Der Vorstand lehnt ab: Nach dem Bau läge der Kontostand unter der Liquiditätsreserve von ' + FM.fmtMoney(reserve) + '.' };
    }
    FM.book(club, 'infra', -q.cost);
    var b = FM.budget(state, club);
    // Baukosten senken den freien Spielraum: Transferbudget wird gekappt
    b.transfer = Math.max(0, Math.min(b.transfer, club.money - reserve));
    club.builds.push({ fac: key, weeks: q.weeks, total: q.weeks, seats: q.seats || 0, toLevel: q.toLevel || 0, cost: q.cost });
    return { ok: true, msg: FM.FACILITIES[key].name + ': Ausbau gestartet, Fertigstellung in ' + q.weeks + ' Wochen.' };
  };

  FM.progressBuilds = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      if (!club.builds || !club.builds.length) return;
      club.builds = club.builds.filter(function (b) {
        b.weeks--;
        if (b.weeks > 0) return true;
        if (b.fac === 'stadium') { club.cap += b.seats; club.fac.stadium = (club.fac.stadium || 0) + 1; }
        else club.fac[b.fac] = b.toLevel;
        if (cid === state.user.club) {
          FM.addNews(state, {
            type: 'board', important: true, title: FM.FACILITIES[b.fac].name + ' fertiggestellt',
            body: b.fac === 'stadium' ? 'Das Stadion fasst jetzt ' + FM.fmtInt(club.cap) + ' Zuschauer.' : FM.FACILITIES[b.fac].name + ' ist jetzt auf Stufe ' + b.toLevel + '.'
          });
        }
        return false;
      });
    });
  };

  /* Monatliche Unterhaltskosten */
  FM.payUpkeep = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      var u = FM.facUpkeep(club);
      if (u) FM.book(club, 'infra', -u / 12);
    });
  };

})();
