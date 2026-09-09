/*
 * world.js - Die Spielwelt.
 *
 * Haelt Vereine, Spieler, Personal, Finanzen, Wettbewerbe und den
 * Kalender. Alle anderen Module greifen ueber die hier definierten
 * Zugriffsmethoden auf den Zustand zu.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;
  var T = FM.tactics;
  var C = FM.competitions;
  var F = FM.finance;
  var S = FM.staff;

  // ------------------------------------------------------------ Zielvorgaben

  function saisonziel(club, liga) {
    if (liga === 1) {
      if (club.ruf >= 90) return { text: 'Deutscher Meister werden', platz: 1, punkte: 0 };
      if (club.ruf >= 82) return { text: 'Champions-League-Platz erreichen', platz: 4 };
      if (club.ruf >= 74) return { text: 'Europapokalplatz erreichen', platz: 6 };
      if (club.ruf >= 67) return { text: 'Einstelliger Tabellenplatz', platz: 9 };
      if (club.ruf >= 61) return { text: 'Gesichertes Mittelfeld', platz: 12 };
      return { text: 'Klassenerhalt sichern', platz: 15 };
    }
    if (liga === 2) {
      if (club.ruf >= 60) return { text: 'Direkter Wiederaufstieg', platz: 2 };
      if (club.ruf >= 53) return { text: 'Um den Aufstieg mitspielen', platz: 5 };
      if (club.ruf >= 47) return { text: 'Oberes Tabellendrittel', platz: 8 };
      return { text: 'Klassenerhalt sichern', platz: 15 };
    }
    return { text: 'Klassenerhalt sichern', platz: 16 };
  }

  // ------------------------------------------------------------ Welt erzeugen

  function neueWelt(opts) {
    opts = opts || {};
    var seed = opts.seed || Math.floor(Math.random() * 2e9);
    U.resetIds(0);

    var world = {
      version: 1,
      seed: seed,
      rng: new U.Rng(seed),
      saison: opts.saison || 2025,
      tag: U.toDay(opts.saison || 2025, 7, 1),
      saisonStartTag: U.toDay(opts.saison || 2025, 7, 1),
      vereine: {},
      vereinIds: [],
      spieler: {},
      spielerIds: [],
      stab: {},
      stabIds: [],
      finanzen: {},
      taktiken: {},
      ligen: {},
      ligaIds: [],
      pokal: null,
      europa: {},
      supercup: null,
      relegation: [],
      spiele: [],
      spielIndex: {},
      nutzerClubId: opts.clubId || null,
      manager: null,
      inbox: [],
      inboxZaehler: 0,
      transfer: null,
      trainingsplan: null,
      historie: { saisons: [], titel: {} },
      statistik: { torschuetzen: {}, vorlagen: {} },
      einstellungen: { autoAufstellung: false, simGeschwindigkeit: 2 },
      protokoll: [],
      nachrichtenIds: 0,
      transferfenster: { offen: true, bis: 0 },
      pause: null
    };

    methodenAnhaengen(world);

    // ---- Vereine
    var alleClubs = D.VEREINE.concat(D.DRITTE_LIGA).concat(D.AMATEURE);
    alleClubs.forEach(function (c) {
      var club = U.clone(c);
      club.gruendung = 1900 + (club.id.charCodeAt(0) % 30);
      club.mitglieder = Math.round(club.fans * club.fans * 12 + 2000);
      club.fanstimmung = 60 + Math.round((club.ruf - 50) * 0.2);
      club.rasen = 85;
      club.bauprojekt = null;
      world.vereine[club.id] = club;
      world.vereinIds.push(club.id);
    });

    // ---- Kader, Stab, Finanzen, Taktik
    world.vereinIds.forEach(function (id) {
      var club = world.vereine[id];
      var kader = P.erzeugeKader(world.rng, club, world);
      kader.forEach(function (p) { world.fuegeSpielerHinzu(p); });

      var stab = S.erzeugeStab(world.rng, club, world);
      stab.forEach(function (m) { world.stab[m.id] = m; world.stabIds.push(m.id); });
      world.stabIndexVerwerfen();

      world.finanzen[id] = F.neueFinanzen(world.rng, club, world);
      var taktik = T.neueTaktik(standardFormationFuer(world.rng, club));
      world.taktiken[id] = taktik;
      T.autoAufstellung(world, club, taktik);
    });

    // ---- Transfermarkt und vertragslose Spieler
    world.transfer = FM.transfers.neueTransferdaten();
    erzeugeVertragslose(world, 55);

    // ---- Ligen
    ligenAnlegen(world);

    // ---- Manager
    world.manager = {
      name: opts.managerName || 'Trainer',
      alter: opts.managerAlter || 42,
      nationalitaet: 'Deutschland',
      clubId: opts.clubId || null,
      ruf: 40,
      taktik: 55,
      menschenfuehrung: 55,
      training: 55,
      vertragBis: world.tag + 3 * 365,
      gehalt: 0,
      vorstandsvertrauen: 70,
      fanvertrauen: 65,
      mannschaftsvertrauen: 65,
      saisonziel: null,
      karriere: [],
      bilanz: { spiele: 0, siege: 0, remis: 0, niederlagen: 0 },
      titel: []
    };

    if (opts.clubId) vereinUebernehmen(world, opts.clubId, opts.managerName);

    // ---- Saison aufbauen
    starteSaison(world, true);

    return world;
  }

  function standardFormationFuer(rng, club) {
    var kandidaten = club.ruf >= 78
      ? ['4-2-3-1', '4-3-3', '4-2-3-1', '3-4-3', '4-1-4-1']
      : club.ruf >= 62
        ? ['4-2-3-1', '4-4-2', '4-3-3', '3-5-2', '4-1-4-1', '4-2-2-2']
        : ['4-4-2', '4-1-4-1', '5-3-2', '3-5-2', '4-2-3-1', '5-2-3'];
    return rng.pick(kandidaten);
  }

  function vereinUebernehmen(world, clubId, managerName) {
    var club = world.vereine[clubId];
    world.nutzerClubId = clubId;
    world.manager.clubId = clubId;
    if (managerName) world.manager.name = managerName;
    world.manager.vertragBis = world.tag + 3 * 365;
    world.manager.gehalt = Math.round(Math.pow(club.ruf / 55, 2.6) * 12000 / 500) * 500;
    world.manager.saisonziel = saisonziel(club, club.liga);
    world.manager.vorstandsvertrauen = 70;
    world.manager.fanvertrauen = 62;
    world.manager.mannschaftsvertrauen = 62;
    world.trainingsplan = FM.training ? FM.training.standardPlan() : null;
  }

  function erzeugeVertragslose(world, anzahl) {
    for (var i = 0; i < anzahl; i++) {
      var alter = world.rng.next() < 0.35 ? world.rng.int(31, 38) : world.rng.int(19, 30);
      var ziel = U.clamp(world.rng.gauss(44, 9), 22, 68);
      var p = P.erzeugeSpieler(world.rng, {
        ziel: ziel, alter: alter, auslandsquote: 0.5
      });
      p.clubId = null;   // vertragslos, wird ueber fuegeSpielerHinzu indiziert
      p.vertrag = null;
      p.scoutwissen = U.clamp(world.rng.range(0.25, 0.6), 0, 1);
      p.marktwert = P.marktwert(p, world);
      world.fuegeSpielerHinzu(p);
    }
  }

  function ligenAnlegen(world) {
    var bl1 = D.VEREINE.filter(function (c) { return c.liga === 1; }).map(function (c) { return c.id; });
    var bl2 = D.VEREINE.filter(function (c) { return c.liga === 2; }).map(function (c) { return c.id; });
    var l3 = D.DRITTE_LIGA.map(function (c) { return c.id; }).slice(0, 20);

    world.ligen.bl1 = C.neueLiga('bl1', 'Bundesliga', 'BL', 1, bl1, 0, 2);
    world.ligen.bl2 = C.neueLiga('bl2', '2. Bundesliga', '2. BL', 2, bl2, 2, 2);
    world.ligen.l3 = C.neueLiga('l3', '3. Liga', '3. L', 3, l3, 2, 4);
    world.ligaIds = ['bl1', 'bl2', 'l3'];
  }

  // ------------------------------------------------------------ Saison aufbauen

  function starteSaison(world, ersteSaison) {
    var jahr = world.saison;
    world.saisonStartTag = U.toDay(jahr, 7, 1);
    world.spiele = [];
    world.spielIndex = {};
    world.relegation = [];
    world.statistik = { torschuetzen: {}, vorlagen: {} };

    // ---- Ligen
    world.ligaIds.forEach(function (lid) {
      var liga = world.ligen[lid];
      liga.spieltage = [];
      liga.aktuellerSpieltag = 0;
      liga.abgeschlossen = false;
      C.initTabelle(liga);

      var runden = C.rundenTurnier(liga.teams, world.rng);
      var englisch = lid === 'bl1' ? [9, 25] : lid === 'bl2' ? [11, 27] : [];
      var termine = C.spieltagsTermine(jahr, runden.length, englisch);

      runden.forEach(function (paarungen, i) {
        var termin = termine[i] || termine[termine.length - 1];
        var verteilt = C.verteileAnstoesse(paarungen, termin, liga.stufe, world.rng);
        var spieltag = { nummer: i + 1, spiele: [] };
        verteilt.forEach(function (v) {
          var spiel = neuesSpiel(world, {
            wettbewerb: 'liga', ligaId: lid, runde: i + 1,
            rundeName: (i + 1) + '. Spieltag',
            tag: v.tag, zeit: v.zeit,
            heimId: v.paar[0], gastId: v.paar[1]
          });
          spieltag.spiele.push(spiel.id);
        });
        liga.spieltage.push(spieltag);
      });
    });

    // ---- DFB-Pokal
    pokalAnlegen(world, jahr);

    // ---- Europapokal
    europaAnlegen(world, jahr, ersteSaison);

    // ---- Supercup
    supercupAnlegen(world, jahr, ersteSaison);

    // ---- Vorbereitung: Testspiele
    testspieleAnlegen(world, jahr);

    // ---- Budgets
    world.vereinIds.forEach(function (id) {
      var f = world.finanzen[id];
      f.jahresbilanz = F.leereBilanz();
      f.saisonstart = f.kontostand;
      F.setzeBudgets(world, id);
    });

    // ---- Saisonziel des Nutzers aktualisieren
    if (world.nutzerClubId) {
      var club = world.vereine[world.nutzerClubId];
      world.manager.saisonziel = saisonziel(club, club.liga);
    }

    // ---- Transferfenster
    world.transferfenster = { offen: true, bis: U.toDay(jahr, 9, 1), fenster: 'sommer' };

    world.spiele.sort(function (a, b) { return a.tag - b.tag; });
    indexAufbauen(world);
  }

  function neuesSpiel(world, cfg) {
    var spiel = {
      id: U.nextId('m'),
      wettbewerb: cfg.wettbewerb,
      ligaId: cfg.ligaId || null,
      europaId: cfg.europaId || null,
      runde: cfg.runde || 0,
      rundeName: cfg.rundeName || '',
      tag: cfg.tag,
      zeit: cfg.zeit || '20:30',
      heimId: cfg.heimId,
      gastId: cfg.gastId,
      neutral: !!cfg.neutral,
      hinspielId: cfg.hinspielId || null,
      verlaengerung: !!cfg.verlaengerung,
      elfmeterschiessen: !!cfg.elfmeterschiessen,
      gespielt: false,
      ergebnis: null,
      bericht: null,
      seed: world.rng.int(1, 2e9)
    };
    world.spiele.push(spiel);
    world.spielIndex[spiel.id] = spiel;
    return spiel;
  }

  function indexAufbauen(world) {
    world.spielIndex = {};
    world.spieleNachTag = {};
    world.spiele.forEach(function (s) {
      world.spielIndex[s.id] = s;
      (world.spieleNachTag[s.tag] = world.spieleNachTag[s.tag] || []).push(s);
    });
  }

  // ------------------------------------------------------------ Pokal

  function pokalAnlegen(world, jahr) {
    var profis = world.ligen.bl1.teams.concat(world.ligen.bl2.teams);
    var drittliga = world.ligen.l3.teams.slice(0, 4);
    var amateure = D.AMATEURE.map(function (c) { return c.id; }).slice(0, 24)
      .concat(drittliga);
    var termine = C.pokalTermine(jahr);

    world.pokal = {
      id: 'dfb', name: 'DFB-Pokal', jahr: jahr,
      runden: [], aktuelleRunde: 0, termine: termine,
      teilnehmer: profis.concat(amateure),
      sieger: null, ausgeschieden: {}
    };

    var paarungen = C.pokalErsteRunde(world.rng, profis, amateure);
    var runde = { nr: 1, name: '1. Hauptrunde', tag: termine[0], spiele: [] };
    paarungen.forEach(function (pa, i) {
      // Runde 1 wird auf Freitag bis Montag verteilt
      var offset = i % 4 === 0 ? 0 : i % 4 === 1 ? 1 : i % 4 === 2 ? 2 : 3;
      var s = neuesSpiel(world, {
        wettbewerb: 'pokal', runde: 1, rundeName: '1. Hauptrunde',
        tag: termine[0] + offset, zeit: i % 4 < 2 ? '18:00' : '20:45',
        heimId: pa.heimId, gastId: pa.gastId,
        verlaengerung: true, elfmeterschiessen: true
      });
      runde.spiele.push(s.id);
    });
    world.pokal.runden.push(runde);
  }

  /** Setzt die naechste Pokalrunde an (nachdem die vorige komplett ist). */
  function pokalNaechsteRunde(world) {
    var pokal = world.pokal;
    var idx = pokal.runden.length - 1;
    var letzte = pokal.runden[idx];
    var sieger = [];
    var vollstaendig = true;
    letzte.spiele.forEach(function (sid) {
      var s = world.spielIndex[sid];
      if (!s || !s.gespielt) { vollstaendig = false; return; }
      sieger.push(s.ergebnis.sieger);
    });
    if (!vollstaendig) return null;
    if (sieger.length === 1) {
      pokal.sieger = sieger[0];
      return null;
    }
    var naechsteNr = letzte.nr + 1;
    var def = C.POKAL_RUNDEN[naechsteNr - 1];
    if (!def) return null;
    var tag = pokal.termine[naechsteNr - 1];
    var paarungen = naechsteNr === 6
      ? [{ heimId: sieger[0], gastId: sieger[1] }]
      : C.pokalAuslosung(world.rng, sieger, world);

    var runde = { nr: naechsteNr, name: def.name, tag: tag, spiele: [] };
    paarungen.forEach(function (pa, i) {
      var s = neuesSpiel(world, {
        wettbewerb: 'pokal', runde: naechsteNr, rundeName: def.name,
        tag: naechsteNr >= 5 ? tag + (i % 2) : tag + (i % 2),
        zeit: i % 2 === 0 ? '18:00' : '20:45',
        heimId: pa.heimId, gastId: pa.gastId,
        neutral: naechsteNr === 6,
        verlaengerung: true, elfmeterschiessen: true
      });
      runde.spiele.push(s.id);
    });
    pokal.runden.push(runde);
    indexAufbauen(world);
    return runde;
  }

  // ------------------------------------------------------------ Europapokal

  /** Erzeugt einen auslaendischen Gegner mit eigenem Kader. */
  function auslandsVerein(world, vorlage, wettbewerb) {
    var id = 'eu_' + vorlage.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
      + '_' + world.rng.int(100, 999);
    var club = {
      id: id, name: vorlage.name, kurz: vorlage.kurz || vorlage.name.slice(0, 3).toUpperCase(),
      stadt: vorlage.land, stadion: vorlage.name + ' Stadion',
      kapazitaet: Math.round(12000 + vorlage.ruf * 620), liga: 0,
      ruf: vorlage.ruf, finanz: vorlage.ruf, fans: vorlage.ruf,
      farbe: '#455066', farbe2: '#ffffff',
      akademie: vorlage.ruf, trainingszentrum: vorlage.ruf, medizin: vorlage.ruf,
      scoutingnetz: vorlage.ruf, tradition: vorlage.ruf, europapokal: vorlage.ruf,
      auslaendisch: true, land: vorlage.land,
      fanstimmung: 70, rasen: 88, mitglieder: 0, bauprojekt: null
    };
    world.vereine[id] = club;
    world.vereinIds.push(id);

    // Verkleinerter Kader (18 Spieler), reicht fuer die Simulation.
    var niveau = 14 + vorlage.ruf * 0.68;
    var schema = [['TW', 2], ['IV', 3], ['LV', 1], ['RV', 1], ['DM', 2], ['ZM', 3], ['OM', 1], ['LF', 1], ['RF', 1], ['ST', 2]];
    var kader = [];
    schema.forEach(function (e) {
      for (var i = 0; i < e[1]; i++) {
        var p = P.erzeugeSpieler(world.rng, {
          pos: e[0], ziel: U.clamp(niveau + (i === 0 ? 3 : -3) + world.rng.gauss(0, 3), 25, 95),
          alter: world.rng.int(20, 33), clubId: id, auslandsquote: 0.85
        });
        p.vertrag = P.vertragErzeugen(world.rng, p, club, world, 3);
        p.nummer = kader.length + 1;
        kader.push(p);
        world.fuegeSpielerHinzu(p);
      }
    });
    world.finanzen[id] = F.neueFinanzen(world.rng, club, world);
    world.stabIds.push.apply(world.stabIds, []);
    var taktik = T.neueTaktik(standardFormationFuer(world.rng, club));
    world.taktiken[id] = taktik;
    T.autoAufstellung(world, club, taktik);
    return club;
  }

  function europaAnlegen(world, jahr, ersteSaison) {
    world.europa = {};
    var qualifikanten = ermittleEuropaTeilnehmer(world, ersteSaison);

    Object.keys(qualifikanten).forEach(function (wb) {
      var deutsche = qualifikanten[wb];
      if (!deutsche.length) return;
      var def = C.EUROPA_WETTBEWERBE[wb];
      var spieltage = def.spiele;
      var termine = C.europaTermine(jahr, spieltage);

      // Gegnerpool passend zum Niveau des Wettbewerbs
      var pool = D.EUROPA.filter(function (e) {
        return wb === 'CL' ? e.ruf >= 68 : wb === 'EL' ? (e.ruf >= 58 && e.ruf < 92) : e.ruf < 78;
      });
      if (pool.length < 12) pool = D.EUROPA.slice();

      var wettbewerb = {
        id: wb, name: def.name, kurz: def.kurz,
        deutsche: deutsche.slice(),
        gegner: {},           // clubId -> Liste der Gegner
        spieltage: [],
        tabelle: {},
        koRunden: [],
        ausgeschieden: {},
        sieger: null,
        termine: termine
      };

      deutsche.forEach(function (clubId) {
        var vorlagen = world.rng.sample(pool, spieltage);
        var gegnerIds = vorlagen.map(function (v) {
          return auslandsVerein(world, v, wb).id;
        });
        wettbewerb.gegner[clubId] = gegnerIds;
        wettbewerb.tabelle[clubId] = C.leererTabelleneintrag(clubId);
        gegnerIds.forEach(function (gid) {
          wettbewerb.tabelle[gid] = C.leererTabelleneintrag(gid);
        });

        gegnerIds.forEach(function (gid, i) {
          var heim = i % 2 === 0;
          var s = neuesSpiel(world, {
            wettbewerb: 'europa', europaId: wb, runde: i + 1,
            rundeName: (i + 1) + '. Spieltag ' + def.kurz,
            tag: termine[i] + (i % 3),
            zeit: wb === 'CL' ? '21:00' : '18:45',
            heimId: heim ? clubId : gid,
            gastId: heim ? gid : clubId
          });
          if (!wettbewerb.spieltage[i]) wettbewerb.spieltage[i] = { nummer: i + 1, spiele: [] };
          wettbewerb.spieltage[i].spiele.push(s.id);
        });
      });
      world.europa[wb] = wettbewerb;
    });
    indexAufbauen(world);
  }

  /** Wer spielt europaeisch? In der ersten Saison nach Ruf, danach nach Tabelle. */
  function ermittleEuropaTeilnehmer(world, ersteSaison) {
    var bl1 = world.ligen.bl1.teams.slice();
    var rang;
    if (ersteSaison || !world.historie.saisons.length) {
      rang = U.sortBy(bl1, function (id) { return -world.vereine[id].ruf; });
    } else {
      var letzte = world.historie.saisons[world.historie.saisons.length - 1];
      rang = (letzte.bl1 || []).map(function (e) { return e.clubId; })
        .filter(function (id) { return bl1.indexOf(id) >= 0; });
      bl1.forEach(function (id) { if (rang.indexOf(id) < 0) rang.push(id); });
    }
    var out = { CL: rang.slice(0, 4), EL: rang.slice(4, 6), ECL: rang.slice(6, 7) };
    // Pokalsieger der Vorsaison bekommt einen EL-Platz
    if (!ersteSaison && world.historie.saisons.length) {
      var letzteS = world.historie.saisons[world.historie.saisons.length - 1];
      var ps = letzteS.pokalsieger;
      if (ps && bl1.indexOf(ps) >= 0 && out.CL.indexOf(ps) < 0 && out.EL.indexOf(ps) < 0) {
        out.EL = [ps].concat(out.EL).slice(0, 2);
        out.ECL = rang.slice(6, 7);
      }
    }
    return out;
  }

  function supercupAnlegen(world, jahr, ersteSaison) {
    var bl1 = world.ligen.bl1.teams;
    var meister, pokalsieger;
    if (ersteSaison || !world.historie.saisons.length) {
      var rang = U.sortBy(bl1, function (id) { return -world.vereine[id].ruf; });
      meister = rang[0]; pokalsieger = rang[1];
    } else {
      var letzte = world.historie.saisons[world.historie.saisons.length - 1];
      meister = letzte.meister;
      pokalsieger = letzte.pokalsieger;
      if (!pokalsieger || pokalsieger === meister) {
        pokalsieger = (letzte.bl1 && letzte.bl1[1]) ? letzte.bl1[1].clubId : bl1[1];
      }
    }
    if (!meister || !pokalsieger || meister === pokalsieger) return;
    if (!world.vereine[meister] || !world.vereine[pokalsieger]) return;
    var s = neuesSpiel(world, {
      wettbewerb: 'supercup', runde: 1, rundeName: 'DFL-Supercup',
      tag: U.toDay(jahr, 8, 9), zeit: '20:30',
      heimId: meister, gastId: pokalsieger,
      elfmeterschiessen: true
    });
    world.supercup = { spielId: s.id, sieger: null };
  }

  function testspieleAnlegen(world, jahr) {
    // Zwei bis drei Vorbereitungsspiele fuer jeden Profiverein
    var profis = world.ligen.bl1.teams.concat(world.ligen.bl2.teams);
    var termine = [U.toDay(jahr, 7, 12), U.toDay(jahr, 7, 19), U.toDay(jahr, 7, 26), U.toDay(jahr, 8, 2)];
    var gegnerPool = world.ligen.l3.teams.concat(D.AMATEURE.map(function (c) { return c.id; }));
    profis.forEach(function (id, idx) {
      termine.forEach(function (tag, i) {
        if (i === 3 && idx % 2) return;
        var gegner;
        if (i < 2) gegner = world.rng.pick(gegnerPool);
        else {
          var andere = profis.filter(function (x) { return x !== id; });
          gegner = world.rng.pick(andere);
        }
        if (gegner === id) return;
        var heim = i % 2 === 0;
        neuesSpiel(world, {
          wettbewerb: 'test', runde: i + 1, rundeName: 'Testspiel',
          tag: tag + (idx % 3), zeit: '18:00',
          heimId: heim ? id : gegner, gastId: heim ? gegner : id
        });
      });
    });
  }

  // ------------------------------------------------------------ Zugriffsmethoden

  function methodenAnhaengen(world) {

    // Kader- und Stabszugriffe laufen ueber einen Index. Ohne ihn wuerde
    // jeder Aufruf alle Spieler der Welt durchgehen - bei ueber 3000
    // Spielern und taeglichen Trainings- und Finanzlaeufen ist das der
    // mit Abstand teuerste Teil der Simulation.
    var kaderIndex = null;
    var stabIndex = null;

    function kaderIndexAufbauen() {
      kaderIndex = {};
      for (var i = 0; i < world.spielerIds.length; i++) {
        var p = world.spieler[world.spielerIds[i]];
        if (!p || !p.clubId) continue;
        (kaderIndex[p.clubId] = kaderIndex[p.clubId] || []).push(p);
      }
    }

    function stabIndexAufbauen() {
      stabIndex = {};
      for (var i = 0; i < world.stabIds.length; i++) {
        var m = world.stab[world.stabIds[i]];
        if (!m || !m.clubId) continue;
        (stabIndex[m.clubId] = stabIndex[m.clubId] || []).push(m);
      }
    }

    /** Muss nach jeder Vereinszugehoerigkeits-Aenderung aufgerufen werden. */
    world.kaderIndexVerwerfen = function () { kaderIndex = null; };
    world.stabIndexVerwerfen = function () { stabIndex = null; };

    /** Einzige Stelle, an der die Vereinszugehoerigkeit gesetzt wird. */
    world.setzeVerein = function (p, clubId) {
      p.clubId = clubId;
      kaderIndex = null;
    };

    world.fuegeSpielerHinzu = function (p) {
      world.spieler[p.id] = p;
      world.spielerIds.push(p.id);
      kaderIndex = null;
    };

    world.entferneSpieler = function (id) {
      delete world.spieler[id];
      var i = world.spielerIds.indexOf(id);
      if (i >= 0) world.spielerIds.splice(i, 1);
      kaderIndex = null;
    };

    world.alleSpieler = function () {
      return world.spielerIds.map(function (id) { return world.spieler[id]; }).filter(Boolean);
    };

    world.kaderVon = function (clubId) {
      if (!kaderIndex) kaderIndexAufbauen();
      return kaderIndex[clubId] || [];
    };

    world.stabVon = function (clubId) {
      if (!stabIndex) stabIndexAufbauen();
      return stabIndex[clubId] || [];
    };

    world.vertragslose = function () {
      return world.alleSpieler().filter(function (p) { return !p.clubId; });
    };

    world.taktikVon = function (clubId) {
      if (!world.taktiken[clubId]) {
        var club = world.vereine[clubId];
        var t = T.neueTaktik('4-4-2');
        world.taktiken[clubId] = t;
        if (club) T.autoAufstellung(world, club, t);
      }
      return world.taktiken[clubId];
    };

    world.istNutzerVerein = function (clubId) {
      return clubId === world.nutzerClubId;
    };

    world.nutzerVerein = function () {
      return world.nutzerClubId ? world.vereine[world.nutzerClubId] : null;
    };

    world.ligaVon = function (clubId) {
      for (var i = 0; i < world.ligaIds.length; i++) {
        var l = world.ligen[world.ligaIds[i]];
        if (l.teams.indexOf(clubId) >= 0) return l;
      }
      return null;
    };

    world.tabellenPlatz = function (clubId) {
      var liga = world.ligaVon(clubId);
      if (!liga) return null;
      var tab = C.sortierteTabelle(liga);
      for (var i = 0; i < tab.length; i++) if (tab[i].clubId === clubId) return tab[i];
      return null;
    };

    world.spieltageGespielt = function (clubId) {
      var e = world.tabellenPlatz(clubId);
      return e ? e.spiele : 0;
    };

    world.staffBonus = function (clubId, art) {
      var w = world.stabWerteVon(clubId);
      if (art === 'taktik') return w.taktikBonus;
      return 1;
    };

    // Die Stabswerte aendern sich nur, wenn Personal wechselt oder eine
    // Baumassnahme fertig wird. Deshalb wird hier bewusst nicht taeglich
    // neu gerechnet, sondern nur nach ausdruecklicher Verwerfung.
    var stabCache = {};
    world.stabWerteVon = function (clubId) {
      if (!stabCache[clubId]) stabCache[clubId] = S.stabWerte(world, clubId);
      return stabCache[clubId];
    };
    world.stabCacheLeeren = function () { stabCache = {}; stabIndex = null; };

    world.berechneZuschauer = function (spiel, wetter, rng) {
      return F.zuschauer(world, spiel, wetter, rng);
    };

    world.spieleAmTag = function (tag) {
      if (!world.spieleNachTag) indexAufbauen(world);
      return world.spieleNachTag[tag] || [];
    };

    world.spieleVon = function (clubId, nurOffen) {
      return world.spiele.filter(function (s) {
        return (s.heimId === clubId || s.gastId === clubId) && (!nurOffen || !s.gespielt);
      });
    };

    world.naechstesSpiel = function (clubId) {
      var liste = world.spiele.filter(function (s) {
        return (s.heimId === clubId || s.gastId === clubId) && !s.gespielt && s.tag >= world.tag;
      });
      liste.sort(function (a, b) { return a.tag - b.tag; });
      return liste[0] || null;
    };

    world.letztesSpiel = function (clubId) {
      var liste = world.spiele.filter(function (s) {
        return (s.heimId === clubId || s.gastId === clubId) && s.gespielt;
      });
      liste.sort(function (a, b) { return b.tag - a.tag; });
      return liste[0] || null;
    };

    world.letzteAbschlussTabelle = function (clubId) {
      if (!world.historie.saisons.length) return null;
      var letzte = world.historie.saisons[world.historie.saisons.length - 1];
      var alle = (letzte.bl1 || []).concat(letzte.bl2 || []);
      for (var i = 0; i < alle.length; i++) if (alle[i].clubId === clubId) return alle[i];
      return null;
    };

    world.nachricht = function (nachricht) {
      nachricht.id = 'n' + (++world.nachrichtenIds);
      nachricht.tag = nachricht.tag || world.tag;
      nachricht.gelesen = false;
      world.inbox.unshift(nachricht);
      if (world.inbox.length > 300) world.inbox.pop();
      return nachricht;
    };

    world.ungeleseneNachrichten = function () {
      return world.inbox.filter(function (n) { return !n.gelesen; }).length;
    };

    world.datum = function (stil) { return U.fmtDate(world.tag, stil); };

    world.indexAufbauen = function () { indexAufbauen(world); };
    world.neuesSpiel = function (cfg) { return neuesSpiel(world, cfg); };
    world.pokalNaechsteRunde = function () { return pokalNaechsteRunde(world); };
    world.auslandsVerein = function (v, wb) { return auslandsVerein(world, v, wb); };
    world.starteSaison = function (erste) { return starteSaison(world, erste); };
    world.saisonziel = function (club, liga) { return saisonziel(club, liga); };
  }

  FM.world = {
    neueWelt: neueWelt,
    methodenAnhaengen: methodenAnhaengen,
    starteSaison: starteSaison,
    vereinUebernehmen: vereinUebernehmen,
    saisonziel: saisonziel,
    pokalNaechsteRunde: pokalNaechsteRunde,
    ermittleEuropaTeilnehmer: ermittleEuropaTeilnehmer,
    indexAufbauen: indexAufbauen,
    erzeugeVertragslose: erzeugeVertragslose,
    auslandsVerein: auslandsVerein
  };

})(typeof window !== 'undefined' ? window : globalThis);
