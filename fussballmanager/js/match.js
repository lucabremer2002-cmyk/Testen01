/*
 * match.js - Spielsimulation.
 *
 * Der Ablauf ist minutenweise. Jede Minute wird der Ballbesitz verteilt,
 * daraus koennen Chancen, Fouls, Karten und Verletzungen entstehen. Der
 * Zustand ist so aufgebaut, dass ein Spiel entweder in einem Rutsch
 * durchgerechnet (KI-Partien) oder Minute fuer Minute abgerufen werden
 * kann (Live-Ansicht des eigenen Spiels).
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;
  var T = FM.tactics;

  // ------------------------------------------------------------ Chancentypen

  var CHANCEN = {
    kombination: { xg: 0.205, name: 'Kombination durch die Mitte' },
    steilpass: { xg: 0.240, name: 'Steilpass in die Tiefe' },
    flanke: { xg: 0.118, name: 'Flanke von der Seite' },
    dribbling: { xg: 0.140, name: 'Alleingang' },
    fernschuss: { xg: 0.048, name: 'Distanzschuss' },
    konter: { xg: 0.255, name: 'Konter' },
    standard: { xg: 0.088, name: 'Standardsituation' },
    ecke: { xg: 0.075, name: 'Ecke' },
    abstauber: { xg: 0.330, name: 'Nachschuss' },
    elfmeter: { xg: 0.780, name: 'Elfmeter' }
  };

  // ------------------------------------------------------------ Aufbau

  function leereStatistik() {
    return {
      tore: 0, schuesse: 0, aufsTor: 0, danebenn: 0, geblockt: 0, pfosten: 0,
      ecken: 0, fouls: 0, gelb: 0, gelbrot: 0, rot: 0, abseits: 0,
      ballbesitz: 0, paesse: 0, paesseAn: 0, zweikaempfe: 0, zweikaempfeGew: 0,
      xg: 0, grosschancen: 0, paraden: 0, elfmeter: 0
    };
  }

  function seitenObjekt(world, club, taktik, heim, ctx) {
    var kopie = U.clone(taktik);
    var f = T.formation(kopie);
    var aufDemPlatz = [];
    for (var i = 0; i < f.slots.length; i++) {
      var id = kopie.aufstellung[i];
      if (!id) continue;
      var p = world.spieler[id];
      if (!p) continue;
      aufDemPlatz.push({ id: id, slot: i, pos: f.slots[i].pos, rolle: kopie.rollen[i] });
    }
    return {
      club: club,
      taktik: kopie,
      heim: heim,
      elf: aufDemPlatz,
      bank: kopie.bank.slice(),
      wechselKontingent: 5,
      wechselFenster: 3,
      wechselGemacht: 0,
      fensterGenutzt: 0,
      letztesFensterMinute: -10,
      stat: leereStatistik(),
      werte: null,
      startFitness: {},
      spielerDaten: {},
      ausgewechselt: [],
      verletztRaus: []
    };
  }

  function spielerDaten(seite, p) {
    if (!seite.spielerDaten[p.id]) {
      seite.spielerDaten[p.id] = {
        id: p.id, minuten: 0, tore: 0, vorlagen: 0, schuesse: 0, aufsTor: 0,
        gelb: 0, rot: false, note: 3.5, notenPunkte: 0, paraden: 0,
        zweikaempfe: 0, zweikaempfeGew: 0, paesse: 0, paesseAn: 0,
        xg: 0, xa: 0, grosschancenVergeben: 0, gegentore: 0, eingewechselt: 0,
        ausgewechselt: 0, km: 0
      };
    }
    return seite.spielerDaten[p.id];
  }

  /**
   * Legt ein Spiel an. opts: { wetter, schiedsrichter, zuschauer, neutralerPlatz,
   * verlaengerung, elfmeterschiessen, hinspiel }
   */
  function erstelle(world, spiel, opts) {
    opts = opts || {};
    var rng = new U.Rng(spiel.seed || (world.rng.int(1, 2e9)));
    var heimClub = world.vereine[spiel.heimId];
    var gastClub = world.vereine[spiel.gastId];

    // Vor dem Anpfiff wird die Aufstellung geprueft: KI-Vereine stellen neu
    // auf, beim Nutzer werden nur ausgefallene Spieler ersetzt.
    var heimAuto = !world.istNutzerVerein(spiel.heimId) || !!opts.autoHeim;
    var gastAuto = !world.istNutzerVerein(spiel.gastId) || !!opts.autoGast;
    var heimTaktik = T.aufstellungVorbereiten(world, spiel.heimId, spiel.wettbewerb, heimAuto);
    var gastTaktik = T.aufstellungVorbereiten(world, spiel.gastId, spiel.wettbewerb, gastAuto);

    var wetter = opts.wetter || waehleWetter(rng, world);
    var schiri = opts.schiedsrichter || rng.pick(D.SCHIEDSRICHTER);

    var state = {
      spiel: spiel,
      rng: rng,
      world: world,
      minute: 0,
      nachspielzeit1: rng.int(1, 4),
      nachspielzeit2: rng.int(2, 7),
      phase: 'vor',
      wetter: wetter,
      schiedsrichter: schiri,
      ereignisse: [],
      log: [],
      neutral: opts.neutralerPlatz !== undefined ? !!opts.neutralerPlatz : !!spiel.neutral,
      verlaengerungMoeglich: opts.verlaengerung !== undefined ? !!opts.verlaengerung : !!spiel.verlaengerung,
      elfmeterschiessenMoeglich: opts.elfmeterschiessen !== undefined
        ? !!opts.elfmeterschiessen : !!spiel.elfmeterschiessen,
      hinspiel: opts.hinspiel || hinspielErgebnis(world, spiel),
      tore: { heim: 0, gast: 0 },
      toreVerlaengerung: { heim: 0, gast: 0 },
      elfmeterschiessen: null,
      beendet: false,
      zuschauer: 0,
      stimmung: 0.75,
      momentum: 0,          // -1 (Gast dominiert) .. +1 (Heim dominiert)
      druckphase: 0
    };

    state.heim = seitenObjekt(world, heimClub, heimTaktik, true, state);
    state.gast = seitenObjekt(world, gastClub, gastTaktik, false, state);

    // Tagesform der Mannschaft. Ohne diesen Faktor waere die Trefferzahl
    // gleichmaessiger verteilt als im echten Fussball: es gaebe zu wenige
    // Kantersiege und zu viele Unentschieden.
    state.heim.tagesform = U.clamp(rng.gauss(1, 0.21), 0.52, 1.58);
    state.gast.tagesform = U.clamp(rng.gauss(1, 0.21), 0.52, 1.58);

    // Nicht jede Bank reagiert auf den Spielstand. Wuerde jede Mannschaft
    // beim Rueckstand alles nach vorn werfen, glichen sich die Ergebnisse zu
    // stark an und es gaebe deutlich zu viele Unentschieden.
    state.heim.reagiertAufStand = rng.chance(0.6);
    state.gast.reagiertAufStand = rng.chance(0.6);

    // Zuschauer und Stimmung
    var zs = opts.zuschauer !== undefined ? opts.zuschauer
      : world.berechneZuschauer ? world.berechneZuschauer(spiel, wetter, rng) : Math.round(heimClub.kapazitaet * 0.8);
    state.zuschauer = zs;
    state.stimmung = U.clamp(zs / Math.max(1, heimClub.kapazitaet), 0.2, 1) * (state.neutral ? 0.5 : 1);

    // Startfitness sichern, damit sie nach dem Spiel korrekt fortgeschrieben wird
    [state.heim, state.gast].forEach(function (s) {
      s.elf.forEach(function (e) {
        var p = world.spieler[e.id];
        s.startFitness[e.id] = p.fitness;
        spielerDaten(s, p);
      });
    });

    neuBewerten(state, state.heim, state.gast);
    neuBewerten(state, state.gast, state.heim);

    ereignis(state, 0, 'anpfiff', null, null,
      'Anpfiff im ' + (state.neutral ? 'Stadion' : heimClub.stadion) + '. ' +
      U.num(zs) + ' Zuschauer, ' + wetter.name.toLowerCase() + '. Schiedsrichter: ' + schiri.name + '.');
    state.phase = '1hz';
    return state;
  }

  /** Ergebnis des Hinspiels, falls dieses Spiel das Rueckspiel eines Duells ist. */
  function hinspielErgebnis(world, spiel) {
    if (!spiel.hinspielId) return null;
    var hin = world.spielIndex[spiel.hinspielId];
    if (!hin || !hin.gespielt || !hin.ergebnis) return null;
    // Im Hinspiel war der heutige Gast zu Hause.
    return { heimTore: hin.ergebnis.heimTore, gastTore: hin.ergebnis.gastTore };
  }

  function waehleWetter(rng, world) {
    var monat = U.fromDay(world.tag).m;
    var gewichte = {
      sonnig: [1, 1, 2, 3, 5, 7, 8, 8, 5, 3, 1, 1][monat - 1],
      bewoelkt: 5, regen: [4, 4, 4, 4, 3, 3, 3, 3, 4, 5, 6, 5][monat - 1],
      starkregen: 1.4, wind: 2.2,
      schnee: [3, 2.5, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2.5][monat - 1],
      hitze: [0, 0, 0, 0.5, 1.5, 3, 4, 4, 1.5, 0, 0, 0][monat - 1],
      kalt: [4, 3.5, 2, 1, 0, 0, 0, 0, 0, 1, 3, 4][monat - 1]
    };
    return rng.weighted(D.WETTER, function (w) { return gewichte[w.id] || 1; });
  }

  /** Rechnet die Mannschaftswerte einer Seite neu (nach Wechsel, Taktikaenderung, Ermuedung). */
  function neuBewerten(state, seite, gegner) {
    // Aufstellung im Taktik-Objekt auf den aktuellen Stand bringen
    var f = T.formation(seite.taktik);
    var auf = new Array(f.slots.length).fill(null);
    var rollen = seite.taktik.rollen.slice();
    seite.elf.forEach(function (e) { auf[e.slot] = e.id; rollen[e.slot] = e.rolle; });
    seite.taktik.aufstellung = auf;
    seite.taktik.rollen = rollen;

    seite.werte = T.bewerteMannschaft({
      world: state.world,
      club: seite.club,
      taktik: seite.taktik,
      heim: seite.heim && !state.neutral,
      wetter: state.wetter,
      stimmung: state.stimmung,
      staffBonus: state.world.staffBonus ? state.world.staffBonus(seite.club.id, 'taktik') : 1
    });
  }

  // ------------------------------------------------------------ Ereignisse

  function ereignis(state, minute, typ, seite, spielerId, text, extra) {
    var e = {
      minute: minute, typ: typ,
      teamId: seite ? seite.club.id : null,
      heim: seite ? seite.heim : null,
      spielerId: spielerId || null,
      text: text
    };
    if (extra) for (var k in extra) e[k] = extra[k];
    state.ereignisse.push(e);
    return e;
  }

  function nm(world, id) {
    var p = world.spieler[id];
    return p ? p.nachname : '?';
  }

  // ------------------------------------------------------------ Minutenlauf

  /** Ein Spielminuten-Schritt. Liefert die in dieser Minute erzeugten Ereignisse. */
  function tick(state) {
    if (state.beendet) return [];
    var vorher = state.ereignisse.length;

    if (state.phase === 'pause') {
      state.phase = '2hz';
      state.minute = 45;
      pausenEffekt(state);
      return state.ereignisse.slice(vorher);
    }
    if (state.phase === 'pauseVerlaengerung') {
      state.phase = 'verl2';
      state.minute = 105;
      return state.ereignisse.slice(vorher);
    }

    state.minute += 1;
    var m = state.minute;

    // Halbzeit- und Spielende pruefen
    var maxErsteHz = 45 + state.nachspielzeit1;
    var maxZweiteHz = 90 + state.nachspielzeit2;

    spielMinute(state, m);

    if (state.phase === '1hz' && m >= maxErsteHz) {
      ereignis(state, 45, 'halbzeit', null, null,
        'Halbzeit. ' + stand(state) + (state.nachspielzeit1 ? ' (' + state.nachspielzeit1 + ' Minuten Nachspielzeit)' : ''));
      state.phase = 'pause';
      return state.ereignisse.slice(vorher);
    }
    if (state.phase === '2hz' && m >= maxZweiteHz) {
      return abpfiffRegulaer(state, vorher);
    }
    if (state.phase === 'verl1' && m >= 105) {
      ereignis(state, 105, 'halbzeit', null, null, 'Seitenwechsel in der Verlängerung. ' + stand(state));
      state.phase = 'pauseVerlaengerung';
      return state.ereignisse.slice(vorher);
    }
    if (state.phase === 'verl2' && m >= 120) {
      return abpfiffVerlaengerung(state, vorher);
    }
    return state.ereignisse.slice(vorher);
  }

  function stand(state) {
    return state.heim.club.kurz + ' ' + state.tore.heim + ':' + state.tore.gast + ' ' + state.gast.club.kurz;
  }

  function abpfiffRegulaer(state, vorher) {
    if (state.tore.heim === state.tore.gast && state.verlaengerungMoeglich && !unentschiedenReicht(state)) {
      ereignis(state, 90, 'abpfiff90', null, null,
        'Nach 90 Minuten steht es ' + state.tore.heim + ':' + state.tore.gast + ' - es geht in die Verlängerung.');
      state.phase = 'verl1';
      state.minute = 90;
      [state.heim, state.gast].forEach(function (s) {
        s.wechselKontingent += 1; s.wechselFenster += 1;
        s.elf.forEach(function (e) {
          var p = state.world.spieler[e.id];
          p.fitness = U.clamp(p.fitness + 4, 0, 100);
        });
      });
      return state.ereignisse.slice(vorher);
    }
    ereignis(state, 90, 'abpfiff', null, null, 'Abpfiff. Endstand: ' + stand(state) + '.');
    beende(state);
    return state.ereignisse.slice(vorher);
  }

  /** Bei Hinspielrueckstand entscheidet das Gesamtergebnis. */
  function unentschiedenReicht(state) {
    if (!state.hinspiel) return false;
    var gesamtHeim = state.tore.heim + state.hinspiel.gastTore;
    var gesamtGast = state.tore.gast + state.hinspiel.heimTore;
    return gesamtHeim !== gesamtGast;
  }

  function abpfiffVerlaengerung(state, vorher) {
    if (state.tore.heim === state.tore.gast && state.elfmeterschiessenMoeglich && !unentschiedenReicht(state)) {
      ereignis(state, 120, 'abpfiff120', null, null, 'Auch nach Verlängerung ' + state.tore.heim + ':' + state.tore.gast + ' - Elfmeterschießen.');
      elfmeterschiessen(state);
    } else {
      ereignis(state, 120, 'abpfiff', null, null, 'Abpfiff nach Verlängerung: ' + stand(state) + '.');
    }
    beende(state);
    return state.ereignisse.slice(vorher);
  }

  function pausenEffekt(state) {
    // Kurze Erholung und Wirkung der Halbzeitansprache
    [state.heim, state.gast].forEach(function (s) {
      s.elf.forEach(function (e) {
        var p = state.world.spieler[e.id];
        p.fitness = U.clamp(p.fitness + 5, 0, 100);
      });
      s.fensterGenutzt = Math.max(0, s.fensterGenutzt - 1);   // Pause kostet kein Fenster
    });
    ereignis(state, 45, 'anpfiff2', null, null, 'Weiter geht es. ' + stand(state));
  }

  // ------------------------------------------------------------ Kernlogik einer Minute

  function spielMinute(state, m) {
    var world = state.world;
    var rng = state.rng;
    var H = state.heim, G = state.gast;

    // Alle fuenf Minuten neu bewerten - das faengt Ermuedung und Wechsel ein.
    if (m % 5 === 1) {
      neuBewerten(state, H, G);
      neuBewerten(state, G, H);
    }

    var wH = H.werte, wG = G.werte;
    var dl = T.duell(wH, wG);

    // ---- Kondition
    kondition(state, H, m);
    kondition(state, G, m);

    // ---- Ballbesitz dieser Minute
    var midH = Math.pow(wH.mid * wH.mod.ballbesitz, 1.35);
    var midG = Math.pow(wG.mid * wG.mod.ballbesitz, 1.35);
    var anteilH = midH / (midH + midG);
    // Fuehrende Mannschaften ziehen sich spaet zurueck
    if (m > 70) {
      var diff = state.tore.heim - state.tore.gast;
      if (diff > 0) anteilH -= 0.03 * Math.min(2, diff) * (H.taktik.anweisungen.zeitspiel === 'ein' ? 0.4 : 1);
      if (diff < 0) anteilH += 0.03 * Math.min(2, -diff);
    }
    anteilH = U.clamp(anteilH + state.momentum * 0.05, 0.15, 0.85);
    var heimHatBall = rng.chance(anteilH);
    H.stat.ballbesitz += anteilH;
    G.stat.ballbesitz += 1 - anteilH;

    // Paesse (nur fuer die Statistik)
    var passH = Math.round(rng.range(5, 9) * anteilH * 2);
    var passG = Math.round(rng.range(5, 9) * (1 - anteilH) * 2);
    H.stat.paesse += passH;
    G.stat.paesse += passG;
    H.stat.paesseAn += Math.round(passH * U.clamp(0.62 + wH.aufbau / 600, 0.55, 0.93));
    G.stat.paesseAn += Math.round(passG * U.clamp(0.62 + wG.aufbau / 600, 0.55, 0.93));

    // Zweikaempfe
    var zk = rng.int(2, 5);
    var quoteH = wH.def + wH.mid;
    var quoteG = wG.def + wG.mid;
    var gewH = 0;
    for (var z = 0; z < zk; z++) if (rng.chance(quoteH * wH.mod.zweikampf / (quoteH * wH.mod.zweikampf + quoteG * wG.mod.zweikampf))) gewH++;
    H.stat.zweikaempfe += zk; G.stat.zweikaempfe += zk;
    H.stat.zweikaempfeGew += gewH; G.stat.zweikaempfeGew += zk - gewH;

    // ---- Chancen
    versucheChance(state, H, G, anteilH, dl.attA, dl.konterA, m);
    versucheChance(state, G, H, 1 - anteilH, dl.attB, dl.konterB, m);

    // ---- Fouls, Karten, Verletzungen
    fouls(state, H, G, m);
    fouls(state, G, H, m);
    verletzungspruefung(state, H, m);
    verletzungspruefung(state, G, m);

    // ---- Momentum klingt ab
    state.momentum *= 0.90;

    // ---- Automatische Wechsel der KI
    if (m >= 46) {
      if (!state.world.istNutzerVerein(H.club.id) || state.autoWechselHeim) kiWechsel(state, H, G, m);
      if (!state.world.istNutzerVerein(G.club.id) || state.autoWechselGast) kiWechsel(state, G, H, m);
    }
    // Taktische Reaktion der KI
    if ((m === 60 || m === 75) ) {
      if (H.reagiertAufStand && !state.world.istNutzerVerein(H.club.id)) kiTaktik(state, H, state.tore.heim - state.tore.gast);
      if (G.reagiertAufStand && !state.world.istNutzerVerein(G.club.id)) kiTaktik(state, G, state.tore.gast - state.tore.heim);
    }
  }

  function kondition(state, seite, m) {
    var world = state.world;
    var bedarf = seite.werte.mod.konditionsbedarf;
    seite.elf.forEach(function (e) {
      var p = world.spieler[e.id];
      var d = spielerDaten(seite, p);
      d.minuten += 1;
      var basis = 0.355 * (1.32 - p.attr.ausdauer / 150);
      basis *= bedarf;
      basis *= 0.85 + (p.attr.arbeitsrate / 100) * 0.35;
      if (m > 75) basis *= 1.12;
      p.fitness = U.clamp(p.fitness - basis, 0, 100);
      d.km += 0.115 * (0.8 + p.attr.arbeitsrate / 250);
    });
  }

  /** Wuerfelt, ob eine Mannschaft in dieser Minute zu einer Chance kommt. */
  function versucheChance(state, an, ab, ballanteil, attMod, konterMod, m) {
    var rng = state.rng;
    var wA = an.werte, wD = ab.werte;

    // Das Kraefteverhaeltnis wird oberhalb von 1,40 gestaucht. Auch eine klar
    // ueberlegene Mannschaft kommt nicht beliebig oft durch: der Gegner steht
    // tiefer, die Raeume werden enger. Ohne diese Stauchung enden Pokalspiele
    // gegen unterklassige Vereine regelmaessig zweistellig.
    var roh = wA.att / Math.max(8, (wD.def * 0.72 + wD.tw * 0.28));
    var verhaeltnis = roh > 1.40 ? 1.40 + (roh - 1.40) * 0.30 : roh;
    verhaeltnis = U.clamp(verhaeltnis, 0.62, 1.62);
    var rate = 0.145 * (0.55 + ballanteil * 0.90) * wA.mod.chancen * Math.pow(verhaeltnis, 1.05) * attMod * an.tagesform;
    if (m > 80 && state.tore[an.heim ? 'heim' : 'gast'] < state.tore[an.heim ? 'gast' : 'heim']) rate *= 1.06;
    rate *= wA.mod.tempoSpaet !== 1 && m > 75 ? wA.mod.tempoSpaet : 1;
    rate *= state.wetter.tempo;

    if (!rng.chance(rate)) return;

    var typ = waehleChancentyp(state, an, ab, konterMod);
    chanceAusspielen(state, an, ab, typ, m, verhaeltnis);
  }

  function waehleChancentyp(state, an, ab, konterMod) {
    var rng = state.rng;
    var wA = an.werte, wD = ab.werte;
    var g = {
      kombination: 22 * (wA.kreativ / 90) * wA.mod.zentrum,
      steilpass: 14 * (wA.tempo / 80) * (wD.mod.konterAnfaellig),
      flanke: 20 * wA.mod.flanken * (wA.kopfball / 80),
      dribbling: 12 * (wA.tempo / 80),
      fernschuss: 14 * (wD.def > wA.att ? 1.6 : 0.9),
      konter: 10 * konterMod * (wA.konter / 55) * wD.mod.konterAnfaellig,
      standard: 8 * (wA.mid / 72),
      ecke: 56 * (wA.mid / 72)
    };
    var typen = Object.keys(g);
    return rng.weighted(typen, function (t) { return Math.max(0.5, g[t]); });
  }

  /** Fuehrt eine Chance zu Ende: Schuetze, Qualitaet, Ausgang. */
  function chanceAusspielen(state, an, ab, typ, m, verhaeltnis) {
    var rng = state.rng, world = state.world;

    // Ecke wird eigenstaendig gezaehlt und fuehrt nur manchmal zum Abschluss
    if (typ === 'ecke') {
      an.stat.ecken += 1;
      ereignis(state, m, 'ecke', an, null, 'Ecke für ' + an.club.name + '.');
      if (!rng.chance(0.36)) return;
    }

    // Elfmeterentscheidung aus einer Strafraumaktion
    if ((typ === 'kombination' || typ === 'dribbling' || typ === 'steilpass') && rng.chance(0.035)) {
      return elfmeter(state, an, ab, m);
    }

    var schuetze = waehleSchuetzen(state, an, typ);
    if (!schuetze) return;
    var vorbereiter = waehleVorbereiter(state, an, schuetze, typ);

    var basis = CHANCEN[typ].xg;
    var xg = basis;
    // Abschlussqualitaet des Schuetzen
    var abschlusswert = typ === 'flanke' || typ === 'ecke' || typ === 'standard'
      ? schuetze.attr.kopfball * 0.6 + schuetze.attr.abschluss * 0.4
      : typ === 'fernschuss'
        ? schuetze.attr.weitschuss * 0.8 + schuetze.attr.abschluss * 0.2
        : schuetze.attr.abschluss * 0.75 + schuetze.attr.technik * 0.25;
    xg *= 0.674;                                   // Kalibrierung auf reale Trefferquoten
    xg *= 1 + (abschlusswert - 55) / 190;
    xg *= 1 + (verhaeltnis - 1) * 0.55;
    xg *= state.wetter.fehler > 1 ? (1 - (state.wetter.fehler - 1) * 0.25) : 1;
    xg = U.clamp(xg, 0.012, 0.72);

    an.stat.schuesse += 1;
    an.stat.xg += xg;
    if (xg >= 0.22) an.stat.grosschancen += 1;
    var sd = spielerDaten(an, schuetze);
    sd.schuesse += 1; sd.xg += xg;

    // Abseits?
    if ((typ === 'steilpass' || typ === 'konter') && rng.chance(0.14 * ab.werte.mod.abseits)) {
      an.stat.abseits += 1;
      ereignis(state, m, 'abseits', an, schuetze.id,
        schuetze.nachname + ' läuft in die Abseitsfalle.');
      return;
    }

    // Torwart des Gegners
    var tw = torwartVon(state, ab);
    var twKlasse = tw ? P.tagesform(tw, 'TW') : 40;
    var twFaktor = U.clamp((twKlasse - 62) / 240, -0.16, 0.16);

    var pTor = U.clamp(xg * (1 - twFaktor), 0.01, 0.92);
    var wurf = rng.next();

    if (wurf < pTor) {
      tor(state, an, ab, schuetze, vorbereiter, typ, m, xg);
      return;
    }

    // Kein Tor: geblockt, gehalten, daneben oder Pfosten
    var rest = rng.next();
    if (rest < 0.30) {
      an.stat.geblockt += 1;
      ereignis(state, m, 'geblockt', an, schuetze.id,
        'Der Schuss von ' + schuetze.nachname + ' wird geblockt.' + (rng.chance(0.4) ? ' Ecke.' : ''));
      if (rng.chance(0.4)) an.stat.ecken += 1;
    } else if (rest < 0.33) {
      an.stat.pfosten += 1;
      ereignis(state, m, 'pfosten', an, schuetze.id,
        pfostenText(rng, schuetze));
    } else if (rest < 0.60) {
      an.stat.aufsTor += 1;
      sd.aufsTor += 1;
      if (tw) {
        var td = spielerDaten(ab, tw);
        td.paraden += 1; ab.stat.paraden += 1;
        td.notenPunkte -= xg >= 0.22 ? 0.22 : 0.09;
      }
      ereignis(state, m, 'parade', an, schuetze.id,
        paradeText(rng, schuetze, tw));
      if (rng.chance(0.24)) {
        // Nachschuss nach der Parade
        var nachschuetze = waehleSchuetzen(state, an, 'abstauber');
        if (nachschuetze) {
          an.stat.schuesse += 1;
          an.stat.xg += CHANCEN.abstauber.xg;
          spielerDaten(an, nachschuetze).schuesse += 1;
          spielerDaten(an, nachschuetze).xg += CHANCEN.abstauber.xg;
          if (rng.chance(CHANCEN.abstauber.xg)) {
            tor(state, an, ab, nachschuetze, null, 'abstauber', m, CHANCEN.abstauber.xg);
          } else {
            an.stat.ecken += 1;
          }
        }
      }
    } else {
      an.stat.danebenn += 1;
      if (xg >= 0.22) { sd.grosschancenVergeben += 1; sd.notenPunkte += 0.32; }
      ereignis(state, m, 'daneben', an, schuetze.id, danebenText(rng, schuetze, typ, xg));
    }
    state.momentum += (an.heim ? 1 : -1) * 0.10;
  }

  function pfostenText(rng, s) {
    return rng.pick([
      s.nachname + ' trifft nur den Pfosten!',
      'Aluminium! ' + s.nachname + ' scheitert am Innenpfosten.',
      s.nachname + ' knallt den Ball an die Latte.'
    ]);
  }

  function paradeText(rng, s, tw) {
    var t = tw ? tw.nachname : 'Der Torhüter';
    return rng.pick([
      t + ' pariert den Versuch von ' + s.nachname + '.',
      s.nachname + ' zieht ab - ' + t + ' ist zur Stelle.',
      'Starke Parade von ' + t + ' gegen ' + s.nachname + '!',
      t + ' lenkt den Ball von ' + s.nachname + ' um den Pfosten.'
    ]);
  }

  function danebenText(rng, s, typ, xg) {
    if (xg >= 0.25) {
      return rng.pick([
        'Riesenchance vergeben! ' + s.nachname + ' schießt aus kurzer Distanz vorbei.',
        'Das muss das Tor sein - ' + s.nachname + ' setzt den Ball neben den Pfosten.',
        s.nachname + ' verstolpert die beste Gelegenheit der bisherigen Partie.'
      ]);
    }
    if (typ === 'fernschuss') {
      return rng.pick([
        s.nachname + ' zieht aus der Distanz ab, deutlich drüber.',
        'Weitschuss von ' + s.nachname + ' - kein Problem für den Keeper.'
      ]);
    }
    return rng.pick([
      s.nachname + ' zielt zu ungenau.',
      'Der Abschluss von ' + s.nachname + ' geht vorbei.',
      s.nachname + ' bekommt den Ball nicht richtig unter Kontrolle.'
    ]);
  }

  function tor(state, an, ab, schuetze, vorbereiter, typ, m, xg) {
    var seiteKey = an.heim ? 'heim' : 'gast';
    state.tore[seiteKey] += 1;
    an.stat.tore += 1;
    an.stat.aufsTor += 1;

    var sd = spielerDaten(an, schuetze);
    sd.tore += 1; sd.aufsTor += 1;
    sd.notenPunkte -= (typ === 'elfmeter' ? 0.55 : 0.95);

    if (vorbereiter) {
      var vd = spielerDaten(an, vorbereiter);
      vd.vorlagen += 1; vd.xa += xg;
      vd.notenPunkte -= 0.50;
    }

    // Gegentor belastet Abwehr und Torwart
    var tw = torwartVon(state, ab);
    if (tw) { spielerDaten(ab, tw).gegentore += 1; spielerDaten(ab, tw).notenPunkte += 0.16; }
    ab.elf.forEach(function (e) {
      var p = state.world.spieler[e.id];
      if (D.POS_GRUPPE[e.pos] === 'ABW') spielerDaten(ab, p).notenPunkte += 0.14;
    });

    state.momentum = U.clamp(state.momentum + (an.heim ? 0.45 : -0.45), -1, 1);

    ereignis(state, m, 'tor', an, schuetze.id, torText(state, an, schuetze, vorbereiter, typ),
      { vorlage: vorbereiter ? vorbereiter.id : null, chancentyp: typ,
        standHeim: state.tore.heim, standGast: state.tore.gast });
  }

  function torText(state, an, s, v, typ) {
    var rng = state.rng;
    var kern;
    switch (typ) {
      case 'elfmeter': kern = s.nachname + ' verwandelt vom Punkt'; break;
      case 'kopfball':
      case 'flanke': kern = s.nachname + ' köpft die Flanke ein'; break;
      case 'ecke': kern = s.nachname + ' trifft nach einer Ecke'; break;
      case 'fernschuss': kern = s.nachname + ' trifft aus der Distanz'; break;
      case 'konter': kern = s.nachname + ' schließt den Konter ab'; break;
      case 'dribbling': kern = s.nachname + ' setzt sich durch und trifft'; break;
      case 'abstauber': kern = s.nachname + ' staubt ab'; break;
      case 'standard': kern = s.nachname + ' trifft nach einem Standard'; break;
      case 'steilpass': kern = s.nachname + ' läuft allein aufs Tor zu und trifft'; break;
      default: kern = s.nachname + ' trifft';
    }
    var vorlage = v && typ !== 'elfmeter' && typ !== 'fernschuss' ? ' Vorarbeit: ' + v.nachname + '.' : '';
    return 'TOR für ' + an.club.name + '! ' + kern + ' - ' +
      state.tore.heim + ':' + state.tore.gast + '.' + vorlage;
  }

  function elfmeter(state, an, ab, m) {
    var rng = state.rng;
    an.stat.elfmeter += 1;
    var schuetzeId = an.taktik.standards.elfmeter;
    var schuetze = schuetzeId ? state.world.spieler[schuetzeId] : null;
    if (!schuetze || !aufDemPlatz(an, schuetze.id)) {
      schuetze = besterAufDemPlatz(state, an, function (p) {
        return p.attr.elfmeter * 1.4 + p.attr.nervenstaerke * 0.8;
      });
    }
    if (!schuetze) return;

    ereignis(state, m, 'elfmeterpfiff', an, schuetze.id,
      'Elfmeter für ' + an.club.name + '! ' + schuetze.nachname + ' legt sich den Ball zurecht.');

    var tw = torwartVon(state, ab);
    var p = 0.76 + (schuetze.attr.elfmeter - 55) / 380 + (schuetze.attr.nervenstaerke - 55) / 600;
    if (tw) p -= (tw.attr.reflexe + tw.attr.einsgegeneins - 110) / 700;
    p = U.clamp(p, 0.45, 0.94);

    an.stat.schuesse += 1; an.stat.xg += 0.78;
    spielerDaten(an, schuetze).schuesse += 1;
    spielerDaten(an, schuetze).xg += 0.78;

    if (rng.chance(p)) {
      tor(state, an, ab, schuetze, null, 'elfmeter', m, 0.78);
    } else {
      an.stat.aufsTor += 1;
      spielerDaten(an, schuetze).notenPunkte += 0.75;
      if (tw && rng.chance(0.62)) {
        spielerDaten(ab, tw).paraden += 1;
        spielerDaten(ab, tw).notenPunkte -= 0.85;
        ab.stat.paraden += 1;
        ereignis(state, m, 'elfmeterGehalten', an, schuetze.id,
          tw.nachname + ' hält den Elfmeter von ' + schuetze.nachname + '!');
      } else {
        ereignis(state, m, 'elfmeterVerschossen', an, schuetze.id,
          schuetze.nachname + ' vergibt vom Punkt!');
      }
    }
  }

  function aufDemPlatz(seite, id) {
    for (var i = 0; i < seite.elf.length; i++) if (seite.elf[i].id === id) return true;
    return false;
  }

  function besterAufDemPlatz(state, seite, fn) {
    var best = null, bw = -1e9;
    seite.elf.forEach(function (e) {
      var p = state.world.spieler[e.id];
      if (!p) return;
      var w = fn(p, e);
      if (w > bw) { bw = w; best = p; }
    });
    return best;
  }

  function torwartVon(state, seite) {
    for (var i = 0; i < seite.elf.length; i++) {
      if (seite.elf[i].pos === 'TW') return state.world.spieler[seite.elf[i].id];
    }
    return null;
  }

  /** Waehlt den Abschlussspieler abhaengig von Chancentyp und Position. */
  function waehleSchuetzen(state, seite, typ) {
    var rng = state.rng, world = state.world;
    var kandidaten = seite.elf.filter(function (e) { return e.pos !== 'TW'; });
    if (!kandidaten.length) return null;
    var gewaehlt = rng.weighted(kandidaten, function (e) {
      var p = world.spieler[e.id];
      if (!p) return 0;
      var g = D.POS_GRUPPE[e.pos];
      var basis = g === 'ANG' ? 10 : g === 'MIT' ? 4 : 1.1;
      if (typ === 'flanke' || typ === 'ecke' || typ === 'standard') {
        basis = g === 'ANG' ? 8 : g === 'MIT' ? 3.5 : 3.2;   // Innenverteidiger bei Standards
        basis *= 0.5 + p.attr.kopfball / 90;
      } else if (typ === 'fernschuss') {
        basis = g === 'ANG' ? 5 : g === 'MIT' ? 7 : 1.6;
        basis *= 0.5 + p.attr.weitschuss / 90;
      } else if (typ === 'konter' || typ === 'steilpass') {
        basis *= 0.6 + p.attr.tempo / 100;
      } else {
        basis *= 0.6 + p.attr.abschluss / 110;
      }
      basis *= 0.7 + p.form / 250;
      return basis;
    });
    return gewaehlt ? world.spieler[gewaehlt.id] : null;
  }

  function waehleVorbereiter(state, seite, schuetze, typ) {
    var rng = state.rng, world = state.world;
    if (typ === 'fernschuss' && rng.chance(0.6)) return null;
    if (typ === 'dribbling' && rng.chance(0.75)) return null;
    var kandidaten = seite.elf.filter(function (e) { return e.id !== schuetze.id && e.pos !== 'TW'; });
    if (!kandidaten.length) return null;
    if (rng.chance(0.12)) return null;
    var gewaehlt2 = rng.weighted(kandidaten, function (e) {
      var p = world.spieler[e.id];
      if (!p) return 0;
      var g = D.POS_GRUPPE[e.pos];
      var basis = g === 'MIT' ? 6 : g === 'ANG' ? 5 : 1.5;
      if (typ === 'flanke') {
        basis = (e.pos === 'LM' || e.pos === 'RM' || e.pos === 'LF' || e.pos === 'RF'
          || e.pos === 'LV' || e.pos === 'RV') ? 10 : 2;
        basis *= 0.5 + p.attr.flanken / 90;
      } else if (typ === 'ecke' || typ === 'standard') {
        basis = p.id === seite.taktik.standards.ecken ? 30 : 1;
      } else {
        basis *= 0.5 + (p.attr.uebersicht * 0.6 + p.attr.passen * 0.4) / 90;
      }
      return basis;
    });
    return gewaehlt2 ? world.spieler[gewaehlt2.id] : null;
  }

  // ------------------------------------------------------------ Fouls und Karten

  function fouls(state, seite, gegner, m) {
    var rng = state.rng, world = state.world;
    if (!seite.elf.length) return;
    var rate = 0.112 * seite.werte.mod.foulneigung;
    if (state.wetter.fehler > 1.1) rate *= 1.08;
    if (!rng.chance(rate)) return;

    seite.stat.fouls += 1;
    var taeterWahl = rng.weighted(seite.elf, function (e) {
      var p = world.spieler[e.id];
      if (!p) return 0;
      var g = D.POS_GRUPPE[e.pos];
      var basis = g === 'ABW' ? 3.2 : g === 'MIT' ? 3.0 : 1.6;
      if (e.pos === 'TW') basis = 0.25;
      basis *= 0.5 + p.attr.aggressivitaet / 90;
      basis *= 1.4 - p.attr.disziplin / 160;
      if (p.fitness < 55) basis *= 1.25;
      // Wer schon Gelb hat, geht deutlich vorsichtiger in die Zweikaempfe.
      var sd = seite.spielerDaten[e.id];
      if (sd && sd.gelb >= 1) basis *= 0.45;
      return basis;
    });
    var taeter = taeterWahl ? world.spieler[taeterWahl.id] : null;
    if (!taeter) return;

    var d = spielerDaten(seite, taeter);

    // Bei einem bereits verwarnten Spieler drueckt der Schiedsrichter meist
    // ein Auge zu - Gelb-Rot bleibt die Ausnahme.
    if (d.gelb >= 1 && !rng.chance(0.145)) {
      if (rng.chance(0.30) && rng.chance(0.35)) chanceAusspielen(state, gegner, seite, 'standard', m, 1);
      return;
    }

    var kartenChance = 0.162 * seite.werte.mod.kartenrisiko * state.schiedsrichter.streng
      * (1.35 - taeter.attr.disziplin / 150);
    if (m > 70) kartenChance *= 1.10;

    if (!rng.chance(kartenChance)) {
      if (rng.chance(0.30)) {
        // Freistoss in gefaehrlicher Position
        if (rng.chance(0.35)) chanceAusspielen(state, gegner, seite, 'standard', m, 1);
      }
      return;
    }

    // Rote Karte direkt (Notbremse, grobes Foul)
    if (rng.chance(0.028)) {
      d.rot = true;
      seite.stat.rot += 1;
      platzverweis(state, seite, taeter, m, 'rot',
        'ROTE KARTE! ' + taeter.nachname + ' sieht Rot - ' +
        rng.pick(['Notbremse', 'grobes Foulspiel', 'Tätlichkeit im Zweikampf']) + '.');
      return;
    }

    d.gelb += 1;
    seite.stat.gelb += 1;
    d.notenPunkte += 0.22;
    if (d.gelb >= 2) {
      seite.stat.gelbrot += 1;
      d.rot = true;
      platzverweis(state, seite, taeter, m, 'gelbrot',
        'Gelb-Rot für ' + taeter.nachname + '! ' + seite.club.kurz + ' nur noch zu zehnt.');
    } else {
      ereignis(state, m, 'gelb', seite, taeter.id,
        'Gelbe Karte für ' + taeter.nachname + ' nach einem Foul an ' +
        (besterAufDemPlatz(state, gegner, function () { return Math.random(); }) || { nachname: 'dem Gegenspieler' }).nachname + '.');
    }
  }

  function platzverweis(state, seite, spieler, m, typ, text) {
    seite.elf = seite.elf.filter(function (e) { return e.id !== spieler.id; });
    spielerDaten(seite, spieler).notenPunkte += typ === 'rot' ? 1.4 : 1.0;
    ereignis(state, m, typ, seite, spieler.id, text);
    // Formation neu ordnen: die KI stellt bei Unterzahl defensiver
    if (!state.world.istNutzerVerein(seite.club.id)) {
      seite.taktik.anweisungen.mentalitaet = 'abwartend';
      seite.taktik.anweisungen.pressing = 'tief';
    }
    neuBewerten(state, seite, seite === state.heim ? state.gast : state.heim);
  }

  // ------------------------------------------------------------ Verletzungen

  function verletzungspruefung(state, seite, m) {
    var rng = state.rng, world = state.world;
    var basis = 0.00011 * (state.wetter.id === 'schnee' || state.wetter.id === 'starkregen' ? 1.25 : 1);
    seite.elf.forEach(function (e) {
      var p = world.spieler[e.id];
      if (!p) return;
      var r = basis;
      r *= 0.55 + p.verletzungsneigung / 90;
      r *= p.fitness < 55 ? 1.9 : p.fitness < 70 ? 1.35 : 1.0;
      r *= p.alter >= 32 ? 1.30 : p.alter <= 20 ? 1.10 : 1.0;
      var med = world.vereine[seite.club.id];
      r *= med ? U.clamp(1.25 - med.medizin / 250, 0.75, 1.25) : 1;
      if (!rng.chance(r)) return;

      var v = rng.weighted(D.VERLETZUNGEN, function (x) { return x.gewicht; });
      var tage = rng.int(v.min, v.max);
      p.verletzung = { name: v.name, tage: tage, schwere: v.schwere, seit: world.tag };
      ereignis(state, m, 'verletzung', seite, p.id,
        p.nachname + ' muss behandelt werden - ' + v.name + '.');
      seite.verletztRaus.push(p.id);
      // Sofort auswechseln, wenn moeglich
      if (seite.wechselKontingent > 0 && seite.bank.length) {
        var ersatz = ersatzFuer(state, seite, e);
        if (ersatz) fuehreWechselDurch(state, seite, p.id, ersatz, m, true);
        else seite.elf = seite.elf.filter(function (x) { return x.id !== p.id; });
      } else {
        seite.elf = seite.elf.filter(function (x) { return x.id !== p.id; });
        ereignis(state, m, 'info', seite, p.id,
          seite.club.kurz + ' hat keine Wechsel mehr - ' + p.nachname + ' beißt auf die Zähne.');
      }
    });
  }

  // ------------------------------------------------------------ Wechsel

  function ersatzFuer(state, seite, slotEintrag) {
    var world = state.world;
    var beste = null, bw = -1e9;
    seite.bank.forEach(function (id) {
      var p = world.spieler[id];
      if (!p || p.verletzung) return;
      if (slotEintrag.pos === 'TW' && p.pos !== 'TW') return;
      if (slotEintrag.pos !== 'TW' && p.pos === 'TW') return;
      var w = P.tagesform(p, slotEintrag.pos);
      if (w > bw) { bw = w; beste = id; }
    });
    return beste;
  }

  function fuehreWechselDurch(state, seite, rausId, reinId, m, wegenVerletzung) {
    var world = state.world;
    var idx = -1;
    for (var i = 0; i < seite.elf.length; i++) if (seite.elf[i].id === rausId) idx = i;
    if (idx < 0) return false;
    if (seite.bank.indexOf(reinId) < 0) return false;
    if (seite.wechselKontingent <= 0) return false;

    var raus = world.spieler[rausId];
    var rein = world.spieler[reinId];
    if (!raus || !rein) return false;

    seite.elf[idx] = { id: reinId, slot: seite.elf[idx].slot, pos: seite.elf[idx].pos, rolle: seite.elf[idx].rolle };
    seite.bank = seite.bank.filter(function (id) { return id !== reinId; });
    seite.wechselKontingent -= 1;
    seite.wechselGemacht += 1;
    seite.ausgewechselt.push(rausId);

    // Wechselfenster: mehrere Wechsel in derselben Minute kosten nur eines
    if (m - seite.letztesFensterMinute > 1) {
      seite.fensterGenutzt += 1;
      seite.letztesFensterMinute = m;
    }

    spielerDaten(seite, raus).ausgewechselt = m;
    var rd = spielerDaten(seite, rein);
    rd.eingewechselt = m;
    seite.startFitness[reinId] = rein.fitness;

    ereignis(state, m, 'wechsel', seite, reinId,
      'Wechsel bei ' + seite.club.kurz + ': ' + rein.nachname + ' kommt für ' + raus.nachname +
      (wegenVerletzung ? ' (verletzt)' : '') + '.', { raus: rausId });
    neuBewerten(state, seite, seite === state.heim ? state.gast : state.heim);
    return true;
  }

  /** Automatische Wechsel: muede Spieler raus, bei Rueckstand offensiver. */
  function kiWechsel(state, seite, gegner, m) {
    if (seite.wechselKontingent <= 0 || !seite.bank.length) return;
    if (seite.fensterGenutzt >= seite.wechselFenster && m - seite.letztesFensterMinute > 1) return;
    var world = state.world;
    var rng = state.rng;
    var rueckstand = (seite.heim ? state.tore.gast - state.tore.heim : state.tore.heim - state.tore.gast);

    // Wann wird gewechselt?
    var wechselChance = 0;
    if (m >= 55 && m <= 85) wechselChance = 0.16;
    if (m >= 60 && rueckstand > 0) wechselChance = 0.24;
    if (m >= 70) wechselChance += 0.10;
    if (!rng.chance(wechselChance)) return;

    // Kandidat: schlechteste Kombination aus Fitness und Leistung
    var kandidat = null, schlecht = -1e9;
    seite.elf.forEach(function (e) {
      var p = world.spieler[e.id];
      if (!p) return;
      if (e.pos === 'TW') return;
      var d = spielerDaten(seite, p);
      var w = (100 - p.fitness) * 1.2 + d.notenPunkte * 30;
      if (d.gelb >= 1 && m >= 60) w += 22;      // Gelb-Rot-Gefahr vermeiden
      if (rueckstand > 0 && D.POS_GRUPPE[e.pos] === 'ABW') w -= 25;
      if (rueckstand < 0 && D.POS_GRUPPE[e.pos] === 'ANG') w -= 15;
      if (w > schlecht) { schlecht = w; kandidat = e; }
    });
    if (!kandidat || schlecht < 24) return;

    var ersatz = ersatzFuer(state, seite, kandidat);
    if (!ersatz) return;
    var raus = world.spieler[kandidat.id];
    var rein = world.spieler[ersatz];
    // Nur wechseln, wenn der Frische-Vorteil den Qualitaetsverlust rechtfertigt
    if (P.tagesform(rein, kandidat.pos) < P.tagesform(raus, kandidat.pos) - 6 && raus.fitness > 55) return;
    fuehreWechselDurch(state, seite, kandidat.id, ersatz, m, false);
  }

  /** Taktische Reaktion der KI auf den Spielstand. */
  function kiTaktik(state, seite, diff) {
    var an = seite.taktik.anweisungen;
    var vorher = an.mentalitaet;
    if (diff <= -2) { an.mentalitaet = 'allesoderNichts'; an.pressing = 'hoch'; an.tempo = 'schnell'; }
    else if (diff === -1 && state.minute >= 75) { an.mentalitaet = 'offensiv'; an.tempo = 'schnell'; }
    else if (diff >= 2) { an.mentalitaet = 'abwartend'; an.zeitspiel = 'ein'; an.pressing = 'tief'; }
    else if (diff === 1 && state.minute >= 75) { an.zeitspiel = 'ein'; an.mentalitaet = 'abwartend'; }
    if (an.mentalitaet !== vorher) {
      neuBewerten(state, seite, seite === state.heim ? state.gast : state.heim);
      ereignis(state, state.minute, 'taktik', seite, null,
        seite.club.kurz + ' stellt um: ' + T.anweisung('mentalitaet', an.mentalitaet).name + '.');
    }
  }

  // ------------------------------------------------------------ Elfmeterschiessen

  function elfmeterschiessen(state) {
    var rng = state.rng, world = state.world;
    var reihenfolge = [state.heim, state.gast];
    var schuetzen = reihenfolge.map(function (s) {
      // Nach Platzverweisen kann die Feldspielerliste kurz sein - dann
      // tritt notfalls auch der Torwart an.
      var feld = s.elf.filter(function (e) { return e.pos !== 'TW'; });
      if (!feld.length) feld = s.elf.slice();
      return U.sortBy(feld, function (e) {
        var p = world.spieler[e.id];
        if (!p) return 0;
        return -(p.attr.elfmeter * 1.5 + p.attr.nervenstaerke * 1.0 + p.attr.abschluss * 0.5);
      }).map(function (e) { return e.id; });
    });
    if (!schuetzen[0].length || !schuetzen[1].length) {
      // Kein Schuetze vorhanden: Entscheidung per Los, damit das Spiel endet.
      var glueck = rng.chance(0.5) ? 0 : 1;
      state.elfmeterschiessen = {
        heim: glueck === 0 ? 1 : 0, gast: glueck === 1 ? 1 : 0,
        versuche: { heim: [], gast: [] }
      };
      return;
    }
    var treffer = [0, 0];
    var versuche = [[], []];
    var runde = 0;
    var beginner = rng.chance(0.5) ? 0 : 1;

    function schiessen(seiteIdx, nr) {
      var s = reihenfolge[seiteIdx];
      var g = reihenfolge[1 - seiteIdx];
      var liste = schuetzen[seiteIdx];
      var id = liste[nr % liste.length];
      var p = world.spieler[id];
      if (!p) { versuche[seiteIdx].push({ spielerId: id, getroffen: false }); return false; }
      var tw = torwartVon(state, g);
      var chance = 0.755 + (p.attr.elfmeter - 55) / 360 + (p.attr.nervenstaerke - 55) / 480;
      if (tw) chance -= (tw.attr.reflexe + tw.attr.einsgegeneins - 110) / 640;
      chance = U.clamp(chance, 0.40, 0.93);
      var getroffen = rng.chance(chance);
      if (getroffen) treffer[seiteIdx] += 1;
      versuche[seiteIdx].push({ spielerId: id, getroffen: getroffen });
      ereignis(state, 120, 'elfmeterschiessen', s, id,
        p.nachname + ' ' + (getroffen ? 'verwandelt' : (tw && rng.chance(0.6) ? 'scheitert an ' + tw.nachname : 'verschießt')) +
        ' (' + treffer[0] + ':' + treffer[1] + ')');
      return getroffen;
    }

    // Erste fuenf Schuetzen je Team
    for (runde = 0; runde < 5; runde++) {
      schiessen(beginner, runde);
      if (entschieden(treffer, versuche, runde)) break;
      schiessen(1 - beginner, runde);
      if (entschieden(treffer, versuche, runde)) break;
    }
    // K.o.-Modus
    var sicherung = 0;
    while (treffer[0] === treffer[1] && sicherung < 25) {
      sicherung++;
      schiessen(beginner, 5 + sicherung);
      schiessen(1 - beginner, 5 + sicherung);
    }

    state.elfmeterschiessen = {
      heim: treffer[0], gast: treffer[1],
      versuche: { heim: versuche[0], gast: versuche[1] }
    };
    ereignis(state, 120, 'ende', null, null,
      'Elfmeterschießen: ' + state.heim.club.kurz + ' ' + treffer[0] + ':' + treffer[1] + ' ' + state.gast.club.kurz);
  }

  function entschieden(treffer, versuche, runde) {
    var rest0 = 5 - versuche[0].length;
    var rest1 = 5 - versuche[1].length;
    if (treffer[0] > treffer[1] + rest1) return true;
    if (treffer[1] > treffer[0] + rest0) return true;
    return false;
  }

  // ------------------------------------------------------------ Abschluss

  function beende(state) {
    if (state.beendet) return;
    state.beendet = true;
    state.phase = 'ende';
    noten(state, state.heim, state.gast);
    noten(state, state.gast, state.heim);
    state.statistik = {
      heim: normalisiereStat(state.heim.stat, state.minute),
      gast: normalisiereStat(state.gast.stat, state.minute)
    };
    state.spielerDesSpiels = spielerDesSpiels(state);
  }

  function normalisiereStat(stat, minuten) {
    var s = U.clone(stat);
    var total = stat.ballbesitz;
    s.ballbesitzProzent = 0;
    s.minuten = minuten;
    return s;
  }

  /**
   * Kicker-Noten von 1,0 (überragend) bis 6,0 (ungenügend).
   * Ausgangspunkt ist 3,5, davon werden die gesammelten Punkte abgezogen.
   */
  function noten(state, seite, gegner) {
    var world = state.world;
    var eigene = seite.stat.tore;
    var gegentore = gegner.stat.tore;
    var ergebnisBonus = eigene > gegentore ? -0.30 : eigene < gegentore ? 0.22 : 0;
    var toreDiff = eigene - gegentore;
    ergebnisBonus += U.clamp(-toreDiff * 0.06, -0.30, 0.30);

    Object.keys(seite.spielerDaten).forEach(function (id) {
      var d = seite.spielerDaten[id];
      var p = world.spieler[id];
      if (!p || d.minuten < 1) { d.note = null; return; }
      var note = 3.5 + d.notenPunkte + ergebnisBonus;

      // Torwart: Gegentore und Paraden
      if (p.pos === 'TW') {
        note += d.gegentore * 0.22 - d.paraden * 0.13;
        if (d.gegentore === 0 && d.minuten >= 80) note -= 0.45;
      } else if (D.POS_GRUPPE[p.pos] === 'ABW') {
        if (gegentore === 0 && d.minuten >= 70) note -= 0.40;
      }

      // Klasse des Spielers wirkt leicht mit
      note -= (P.gesamt(p) - 60) / 130;
      // Kurzeinsaetze bewegen sich naeher an der Mitte
      if (d.minuten < 30) note = 3.5 + (note - 3.5) * (0.45 + d.minuten / 60);
      note += state.rng.gauss(0, 0.22);

      d.note = U.clamp(Math.round(note * 10) / 10, 1.0, 6.0);
      p.letzteNoten.push(d.note);
      if (p.letzteNoten.length > 12) p.letzteNoten.shift();
    });
  }

  function spielerDesSpiels(state) {
    var beste = null, bw = 99;
    [state.heim, state.gast].forEach(function (s) {
      Object.keys(s.spielerDaten).forEach(function (id) {
        var d = s.spielerDaten[id];
        if (d.note === null || d.minuten < 25) return;
        var w = d.note - d.tore * 0.15;
        if (w < bw) { bw = w; beste = { spielerId: id, teamId: s.club.id, note: d.note }; }
      });
    });
    return beste;
  }

  // ------------------------------------------------------------ Komplettlauf

  function bisEnde(state, maxSchritte) {
    var n = 0;
    while (!state.beendet && n < (maxSchritte || 400)) { tick(state); n++; }
    if (!state.beendet) beende(state);
    return state;
  }

  function simuliere(world, spiel, opts) {
    var state = erstelle(world, spiel, opts);
    return bisEnde(state);
  }

  /** Ergebnisobjekt, das in die Tabelle und Historie wandert. */
  function ergebnis(state) {
    return {
      spielId: state.spiel.id,
      heimId: state.heim.club.id,
      gastId: state.gast.club.id,
      heimTore: state.tore.heim,
      gastTore: state.tore.gast,
      elfmeterschiessen: state.elfmeterschiessen,
      zuschauer: state.zuschauer,
      minute: state.minute
    };
  }

  FM.match = {
    erstelle: erstelle,
    tick: tick,
    bisEnde: bisEnde,
    simuliere: simuliere,
    ergebnis: ergebnis,
    fuehreWechselDurch: fuehreWechselDurch,
    neuBewerten: neuBewerten,
    torwartVon: torwartVon,
    spielerDaten: spielerDaten,
    CHANCEN: CHANCEN
  };

})(typeof window !== 'undefined' ? window : globalThis);
