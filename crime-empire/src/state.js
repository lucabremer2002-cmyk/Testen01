/* ---------------------------------------------------------------------
   Spielstand und abgeleitete Werte.

   Zwei Dinge leben hier:

   1. newGame()  - der Anfangszustand. Alles, was das Spiel je braucht,
                   steht danach im Objekt; nichts wird spaeter erfunden.
   2. derive()   - jede abgeleitete Zahl an *einer* Stelle. Einkommen,
                   Ausgaben, Staerke, Rang: die Oberflaeche rechnet nie
                   selbst, sie liest nur. Sonst zeigt der Bildschirm etwas
                   anderes an als die Wochenabrechnung abbucht.

   derive() ist frei von Nebenwirkungen und wird oft aufgerufen.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util;

  var SAVE_VERSION = 1;

  /* ------------------------------------------------------- Neues Spiel */

  function newGame(opts) {
    opts = opts || {};
    var seed = opts.seed || (Date.now() >>> 0);
    var s = {
      v: SAVE_VERSION,
      seed: seed,
      rngState: seed >>> 0,
      idc: 0,
      name: opts.name || 'Unknown',
      difficulty: opts.difficulty || 'normal',
      created: Date.now(),
      played: 0,              /* Millisekunden Spielzeit */

      day: 0,
      speed: 0,               /* 0 = Pause */
      cash: 3500,
      rep: 4,
      heat: 0,
      rankSeen: 0,            /* hoechster bereits gefeierter Rang */

      districts: {},
      businesses: [],
      crew: [],
      recruits: [],           /* Bewerberliste, woechentlich erneuert */
      ops: [],                /* laufende Auftraege */
      offers: {},             /* offene Auftraege je Bezirk */
      rivals: [],
      org: {},                /* Ausbaustufe je Ausbau-ID */
      achievements: {},
      log: [],                /* Ereignisprotokoll, neuestes zuerst */
      ledger: [],             /* Wochenabrechnungen, neueste zuerst */
      history: [],            /* {week, cash, income, expense, heat, rep, infl} */
      event: null,            /* offene Entscheidung */
      eventSeen: {},          /* wie oft ein Ereignis schon kam */
      pending: [],            /* geplante Nachwirkungen: {day, kind, ...} */
      flags: {},
      stats: { earned: 0, spent: 0, opsRun: 0, opsWon: 0, raids: 0, fines: 0 }
    };

    /* Schwierigkeit: nur drei Zahlen, aber sie greifen ueberall. */
    var diff = { easy: 1.25, normal: 1.0, hard: 0.8 }[s.difficulty] || 1;
    s.mods = {
      income: diff,
      heat: s.difficulty === 'hard' ? 1.25 : (s.difficulty === 'easy' ? 0.8 : 1),
      rivalSpeed: s.difficulty === 'hard' ? 1.35 : (s.difficulty === 'easy' ? 0.75 : 1)
    };
    if (s.difficulty === 'easy') s.cash = 6000;
    if (s.difficulty === 'hard') s.cash = 2500;

    /* Bezirke. Old Town ist von Anfang an offen - der Spieler soll in der
       ersten Minute etwas tun koennen, nicht erst sparen. */
    D.DISTRICTS.forEach(function (d) {
      s.districts[d.id] = { id: d.id, open: d.id === 'oldtown', mine: d.id === 'oldtown' ? 6 : 0, unrest: 0 };
    });

    /* Rivalen mit ihren Startgebieten. */
    D.RIVALS.forEach(function (r) {
      var infl = {};
      D.DISTRICTS.forEach(function (d) { infl[d.id] = r.home[d.id] || 0; });
      s.rivals.push({
        id: r.id, cash: r.cash, strength: r.strength, infl: infl,
        relation: 0, allied: false, truceUntil: -1, biz: Math.max(2, Math.round(r.strength / 18)),
        lastAct: '', heat: 0
      });
    });

    D.ORG_UPGRADES.forEach(function (u) { s.org[u.id] = 0; });

    /* Der Spieler selbst steht in der Mannschaft. Das ist kein Trick der
       Anzeige: er laesst sich auf Auftraege schicken, sammelt Erfahrung und
       ist in der ersten Woche der einzige Mensch, den man hat. Gehalt null,
       zaehlt nicht gegen die Mannschaftsgrenze, unkuendbar. */
    s.crew.push({
      id: 'you', player: true, name: opts.name || 'You', role: 'boss',
      skill: 4, xp: 0, loyalty: 100, salary: 0, traits: [], post: null,
      busyUntil: -1, hired: 0, face: 0, potential: 10, mood: ''
    });

    return s;
  }

  /* ------------------------------------------------------ Hilfsgroessen */

  /* Einkommen eines Betriebes, aufgeschluesselt - dieselbe Funktion
     speist die Betriebskarte und die Wochenabrechnung. */
  function bizFinance(s, b) {
    var def = D.byId(D.BUSINESSES, b.type);
    var dist = D.byId(D.DISTRICTS, b.district);
    var lvl = b.level - 1;
    var mul = D.UPGRADE.income[lvl];

    var gross = def.income * mul * dist.econ;
    var upkeep = def.upkeep * D.UPGRADE.upkeep[lvl] * (0.85 + dist.econ * 0.15);

    /* Personal: jeder zugewiesene Kopf bringt Prozente nach Rolle und
       Faehigkeit. Leere Plaetze kosten Ertrag - ein Betrieb ohne Leitung
       laeuft auf Sparflamme. */
    var slots = def.staff + D.UPGRADE.staff[lvl];
    var staffBonus = 0, upkeepBonus = 0, heatBonus = 0, filled = 0;
    for (var i = 0; i < s.crew.length; i++) {
      var c = s.crew[i];
      if (c.post !== b.id) continue;
      filled++;
      var role = D.byId(D.ROLES, c.role);
      var eff = effectiveSkill(c);
      staffBonus += (role.incomeMul || 0) * eff * (0.55 + c.loyalty / 160);
      upkeepBonus += (role.upkeepMul || 0) * eff;
      if (hasTrait(c, 'meticulous')) upkeepBonus += -0.04;
      if (hasTrait(c, 'discreet')) heatBonus -= 0.35;
      if (hasTrait(c, 'reckless')) heatBonus += 0.5;
    }
    var understaffed = Math.max(0, slots - filled);
    var staffPenalty = understaffed * 0.07;

    /* Einfluss im Bezirk schuetzt und verdient: wer die Strasse haelt,
       wird nicht bestohlen. */
    var dd = s.districts[b.district];
    var inflBonus = (dd.mine / 100) * 0.22;

    /* Sonderwirkungen anderer Betriebe. */
    var perk = 0;
    if (!def.legal) {
      if (hasPerk(s, b.district, 'smuggle') && (b.type === 'smuggling' || b.type === 'contraband')) perk += 0.18;
    }
    if (def.perk === 'launder') perk += 0.05;

    /* Dauerhafte Aufwertung aus Ereignissen ("More Than It Can Hold"). */
    var boost = b.boost || 0;

    var mods = s.mods || { income: 1, heat: 1 };
    gross *= (1 + staffBonus + inflBonus + perk + boost - staffPenalty) * mods.income;
    upkeep *= (1 + upkeepBonus);
    if (upkeep < 0) upkeep = 0;

    var heat = 0;
    if (def.heat) {
      heat = def.heat * D.UPGRADE.heat[lvl] * dist.lawEye * mods.heat;
      heat *= (1 + heatBonus / 4);
      heat *= Math.max(0.25, 1 - (s.org.lookouts || 0) * 0.14);
      heat *= Math.max(0.5, 1 - (dd.mine / 100) * 0.30);   /* eigenes Gebiet deckt */
    }

    var infl = def.infl * D.UPGRADE.infl[lvl];

    return {
      gross: gross, upkeep: upkeep, net: gross - upkeep, heat: heat, infl: infl,
      slots: slots, filled: filled, understaffed: understaffed,
      staffBonus: staffBonus, inflBonus: inflBonus, perkBonus: perk, staffPenalty: staffPenalty,
      boost: boost,
      legal: def.legal, def: def
    };
  }

  function hasPerk(s, district, perk) {
    for (var i = 0; i < s.businesses.length; i++) {
      var b = s.businesses[i];
      if (b.district !== district) continue;
      var def = D.byId(D.BUSINESSES, b.type);
      if (def.perk === perk) return true;
    }
    return false;
  }

  function hasTrait(c, id) { return c.traits.indexOf(id) >= 0; }

  /* Wirksame Faehigkeit: Grundwert plus Erfahrung, gedeckelt. */
  function effectiveSkill(c) {
    var cap = 10 + (hasTrait(c, 'veteran') ? 2 : 0);
    return U.clamp(c.skill + Math.floor(c.xp / 100), 1, cap);
  }

  /* ------------------------------------------------------------ derive */

  function derive(s) {
    var d = {
      grossIncome: 0, upkeep: 0, salaries: 0, orgUpkeep: 0, districtCost: 0,
      launderCap: 0, dirtyGross: 0, cleanGross: 0, launderLoss: 0,
      heatGain: 0, heatDecay: 0, strength: 0, influenceGain: {},
      totalInfluence: 0, rivalInfluence: {}, netWorth: 0, bizValue: 0,
      byDistrict: {}, fineMul: 1, raidCut: 0, opSpeed: 0, opBonus: 0,
      sabotageCut: 0, crewCap: 4, intel: 0, repDrift: 0, notoriety: 0, rank: 0,
      opBonusUpgrade: 0, opSpeedUpgrade: 0
    };

    var i, j, b, c, def, role;

    /* --- Betriebe --- */
    for (i = 0; i < s.businesses.length; i++) {
      b = s.businesses[i];
      var f = bizFinance(s, b);
      b._f = f;                                   /* Zwischenspeicher fuer die Anzeige */
      d.upkeep += f.upkeep;
      d.heatGain += f.heat;
      if (f.legal) { d.cleanGross += f.gross; d.launderCap += f.gross * f.def.launder; }
      else d.dirtyGross += f.gross;
      d.bizValue += bizValue(s, b);
      if (!d.byDistrict[b.district]) d.byDistrict[b.district] = { gross: 0, upkeep: 0, heat: 0, count: 0, infl: 0 };
      var bd = d.byDistrict[b.district];
      bd.gross += f.gross; bd.upkeep += f.upkeep; bd.heat += f.heat; bd.count++; bd.infl += f.infl;
    }

    /* --- Mannschaft --- */
    for (i = 0; i < s.crew.length; i++) {
      c = s.crew[i];
      role = D.byId(D.ROLES, c.role);
      d.salaries += c.salary;
      var eff = effectiveSkill(c);
      if (role.slot === 'org' || !c.post) {
        d.strength += (role.strength || 0) * (0.6 + eff / 14);
        d.heatDecay += (role.heatCut || 0) * (0.6 + eff / 14);
        d.launderCap += (role.launder || 0) * (0.6 + eff / 12);
        d.opSpeed += (role.opSpeed || 0) * (0.6 + eff / 14);
        d.opBonus += (role.opBonus || 0) * (0.6 + eff / 14);
        d.sabotageCut += (role.sabotageCut || 0) * (0.6 + eff / 14);
        d.fineMul -= (role.fineCut || 0);
        d.intel += (role.intel || 0);
        if (role.expenseCut) d.expenseCut = (d.expenseCut || 0) + role.expenseCut * (0.6 + eff / 12);
      }
      if (hasTrait(c, 'ruthless')) { d.strength += 5; d.repDrift -= 0.04; }
      if (hasTrait(c, 'charming')) d.repDrift += 0.06;
      if (hasTrait(c, 'connected')) d.opBonus += 0.03;
      d.strength += eff * 0.6;
    }

    /* --- Ausbauten --- */
    for (i = 0; i < D.ORG_UPGRADES.length; i++) {
      var up = D.ORG_UPGRADES[i];
      var lv = s.org[up.id] || 0;
      if (!lv) continue;
      for (j = 0; j < lv; j++) d.orgUpkeep += up.upkeep[j];
      d.crewCap += (up.crewCap || 0) * lv;
      d.heatDecay += (up.heatCut || 0) * lv;
      d.fineMul -= (up.fineCut || 0) * lv;
      d.launderCap += (up.launder || 0) * lv;
      d.raidCut += (up.raidCut || 0) * lv;
      d.opSpeed += (up.opSpeed || 0) * lv;
      d.opBonus += (up.opBonus || 0) * lv;
      /* Getrennt gefuehrt: ops.js darf nur den Ausbau-Anteil zaehlen,
         sonst wirkt ein Mann zweimal - einmal als Mannschaft im Auftrag,
         einmal ueber die Organisationssumme. */
      d.opBonusUpgrade = (d.opBonusUpgrade || 0) + (up.opBonus || 0) * lv;
      d.opSpeedUpgrade = (d.opSpeedUpgrade || 0) + (up.opSpeed || 0) * lv;
    }
    d.fineMul = U.clamp(d.fineMul, 0.25, 1);

    /* --- Bezirkskosten: wer Gebiet haelt, zahlt dafuer --- */
    for (var k in s.districts) {
      var dd = s.districts[k];
      if (!dd.open) continue;
      var ddef = D.byId(D.DISTRICTS, k);
      d.districtCost += 140 * ddef.tier + dd.mine * 4.5 * ddef.tier * 0.35;
      d.totalInfluence += dd.mine;
    }

    /* Grundkapazitaet: Bargeschaefte auf der Strasse, die niemand zaehlt.
       Ohne sie waere der erste Untergrundbetrieb sofort im Minus, und der
       Spieler lernte die Regel durch Bestrafung statt durch Planung. */
    d.launderCap += 3000;

    /* --- Geldwaesche: schmutziges Geld ueber der Kapazitaet verliert --- */
    var over = Math.max(0, d.dirtyGross - d.launderCap);
    d.launderLoss = over * 0.42;
    d.grossIncome = d.cleanGross + d.dirtyGross - d.launderLoss;

    /* --- Ausgaben --- */
    var expenseCut = U.clamp(d.expenseCut || 0, 0, 0.35);
    d.upkeep *= (1 - expenseCut);
    d.salaries *= (1 - expenseCut * 0.5);
    d.expenses = d.upkeep + d.salaries + d.orgUpkeep + d.districtCost;
    d.net = d.grossIncome - d.expenses;

    /* --- Hitze --- */
    d.heatDecay += 1.3 + (s.rep / 100) * 0.8;
    if (s.heat > 60) d.heatDecay += (s.heat - 60) * 0.03;     /* Aufmerksamkeit ebbt ab */
    d.heatNet = d.heatGain - d.heatDecay;

    /* Hitzefolgen auf das Einkommen - immer sichtbar, nie stumm. */
    d.heatPenalty = heatPenalty(s.heat);
    if (d.heatPenalty > 0) {
      d.heatLoss = d.grossIncome * d.heatPenalty;
      d.grossIncome -= d.heatLoss;
      d.net = d.grossIncome - d.expenses;
    } else d.heatLoss = 0;

    /* --- Staerke --- */
    d.strength += s.businesses.length * 2.5 + d.totalInfluence * 0.25;
    d.strength = Math.round(d.strength);

    /* --- Rivalen --- */
    for (i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i], t = 0;
      for (k in r.infl) t += r.infl[k];
      d.rivalInfluence[r.id] = t;
    }

    /* --- Einfluss je Woche --- */
    for (k in s.districts) {
      if (!s.districts[k].open) continue;
      var g = 0.35;                                   /* Grundwachstum durch Praesenz */
      if (d.byDistrict[k]) g += d.byDistrict[k].infl;
      g += d.strength / 260;
      d.influenceGain[k] = g;
    }

    /* --- Vermoegen, Bekanntheit, Rang --- */
    d.netWorth = s.cash + d.bizValue;
    var districtsOpen = 0;
    for (k in s.districts) if (s.districts[k].open) districtsOpen++;
    d.notoriety = Math.round(
      s.rep * 1.1 +
      d.totalInfluence * 0.55 +
      s.businesses.length * 7 +
      districtsOpen * 9 +
      Math.pow(Math.max(0, d.netWorth) / 1000, 0.72) * 1.6 +
      s.crew.length * 2.5
    );
    d.rank = 0;
    for (i = D.RANKS.length - 1; i >= 0; i--) {
      if (d.notoriety >= D.RANKS[i].at) { d.rank = i; break; }
    }
    d.rankName = D.RANKS[d.rank].name;
    d.nextRank = D.RANKS[d.rank + 1] || null;
    d.rankProgress = d.nextRank
      ? U.clamp((d.notoriety - D.RANKS[d.rank].at) / (d.nextRank.at - D.RANKS[d.rank].at), 0, 1)
      : 1;
    d.crewCap = Math.round(d.crewCap);
    d.districtsOpen = districtsOpen;
    return d;
  }

  /* Hitzestrafe auf den Ertrag - stufenweise, damit sie planbar bleibt. */
  function heatPenalty(heat) {
    if (heat < 40) return 0;
    if (heat < 60) return 0.06;
    if (heat < 75) return 0.16;
    if (heat < 90) return 0.32;
    return 0.55;
  }

  /* Was ein Betrieb wert ist: Kaufpreis plus investierte Ausbauten,
     abzueglich Abschlag - die Zahl fuer Vermoegen und Verkauf. */
  function bizValue(s, b) {
    var def = D.byId(D.BUSINESSES, b.type);
    var dist = D.byId(D.DISTRICTS, b.district);
    var base = def.cost * dist.econ;
    var v = base;
    for (var l = 1; l < b.level; l++) v += base * D.UPGRADE.priceMul[l];
    return Math.round(v);
  }

  function upgradeCost(s, b) {
    if (b.level >= D.UPGRADE.max) return null;
    var def = D.byId(D.BUSINESSES, b.type);
    var dist = D.byId(D.DISTRICTS, b.district);
    return Math.round(def.cost * dist.econ * D.UPGRADE.priceMul[b.level]);
  }

  function buyCost(district, typeId) {
    var def = D.byId(D.BUSINESSES, typeId);
    var dist = D.byId(D.DISTRICTS, district);
    return Math.round(def.cost * dist.econ);
  }

  /* Hitzestufe als Text - erscheint an jeder Stelle, die Hitze zeigt. */
  function heatBand(heat) {
    if (heat < 15) return { key: 'calm', name: 'Quiet', desc: 'Nobody downtown is looking at you.' };
    if (heat < 40) return { key: 'noted', name: 'Noted', desc: 'Your name is in a file somewhere.' };
    if (heat < 60) return { key: 'watched', name: 'Watched', desc: 'Investigations are opening. Income down 6-14%.' };
    if (heat < 75) return { key: 'pressure', name: 'Under Pressure', desc: 'Fines and seizures. Income down sharply.' };
    if (heat < 90) return { key: 'hunted', name: 'Task Force', desc: 'A dedicated unit is on your organisation. Raids likely.' };
    return { key: 'critical', name: 'Critical', desc: 'They are coming. Anything you own can be taken.' };
  }

  CE.state = {
    SAVE_VERSION: SAVE_VERSION,
    newGame: newGame, derive: derive, bizFinance: bizFinance, bizValue: bizValue,
    upgradeCost: upgradeCost, buyCost: buyCost, effectiveSkill: effectiveSkill,
    hasTrait: hasTrait, heatBand: heatBand, heatPenalty: heatPenalty
  };
})(typeof window !== 'undefined' ? window : globalThis);
