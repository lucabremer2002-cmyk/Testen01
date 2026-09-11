/*
 * save.js - Speichern und Laden.
 *
 * Eine komplette Spielwelt umfasst über 3000 Spieler und mehr als 1200
 * Partien. Als schlichtes JSON wären das rund 12 MB - deutlich mehr, als
 * der Browserspeicher hergibt. Deshalb wird der Stand vor dem Schreiben
 * verdichtet: grosse Teilobjekte werden in Arrays gepackt, Kommazahlen
 * gerundet und Spielberichte nur für die eigenen Partien behalten.
 *
 * Gespeichert wird bevorzugt in der IndexedDB (mehrere hundert MB), mit
 * localStorage als Rückfallebene.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;

  var DB_NAME = 'bundesliga-manager';
  var DB_STORE = 'staende';
  var DB_KEY = 'aktuell';
  var LS_KEY = 'bundesliga-manager-stand';
  var LS_KOPF = 'bundesliga-manager-kopf';
  var FORMAT = 5;

  var FELDER = ['version', 'seed', 'saison', 'tag', 'saisonStartTag', 'vereine', 'vereinIds',
    'stab', 'stabIds', 'finanzen', 'taktiken', 'ligen', 'ligaIds',
    'pokal', 'europa', 'supercup', 'relegation', 'nutzerClubId', 'manager',
    'inbox', 'nachrichtenIds', 'transfer', 'trainingsplan', 'historie', 'statistik',
    'einstellungen', 'transferfenster'];

  // Reihenfolge der gepackten Statistikfelder - darf sich nie ändern.
  var STAT_FELDER = ['spiele', 'startelf', 'minuten', 'tore', 'vorlagen', 'gelb', 'gelbrot', 'rot',
    'notenSumme', 'notenAnzahl', 'gegentore', 'zuNull', 'schuesse', 'schuesseAufsTor',
    'zweikaempfe', 'zweikaempfeGewonnen', 'paesse', 'paesseAngekommen', 'kmGelaufen',
    'xG', 'xA', 'paraden'];

  var UNZUFRIEDEN = ['spielzeit', 'gehalt', 'ambition', 'taktik'];

  // ------------------------------------------------------------ Packen

  function r(v, stellen) {
    if (typeof v !== 'number') return v;
    var f = Math.pow(10, stellen === undefined ? 2 : stellen);
    return Math.round(v * f) / f;
  }

  function packStats(s) {
    return STAT_FELDER.map(function (k) { return r(s[k] || 0, 2); });
  }
  function entpackStats(a) {
    var s = FM.players.leereStats();
    STAT_FELDER.forEach(function (k, i) { s[k] = a && a[i] !== undefined ? a[i] : 0; });
    return s;
  }

  function packSpieler(p) {
    return [
      p.id, p.vorname, p.nachname, p.nation, p.alter, p.geburtstag, p.pos, p.nebenpos, p.fuss,
      D.ALLE_ATTRIBUTE.map(function (k) { return p.attr[k] || 1; }),
      p.potenzial, r(p.form, 1), r(p.moral, 1), r(p.fitness, 1),
      p.verletzung, p.verletzungsneigung, p.persoenlichkeit, p.clubId, p.nummer,
      p.kapitaen ? 1 : 0, p.vertrag, p.leihe, p.marktwert, r(p.wechselwunsch, 1),
      UNZUFRIEDEN.map(function (k) { return r(p.unzufriedenheit[k] || 0, 1); }),
      p.transferliste ? 1 : 0, p.leihliste ? 1 : 0, p.trainingsfokus, p.trainingsleistung,
      p.sperre, p.sperreGrund, p.sperreWettbewerb || null, p.gelbeSaison,
      packStats(p.stats), packStats(p.karriere),
      (p.historie || []).slice(-8), r(p.scoutwissen, 3),
      (p.letzteNoten || []).slice(-8).map(function (n) { return r(n, 1); }),
      p.eigengewaechs ? 1 : 0, p.exClubId || null, p.versprechen || null,
      p.gemeldetWechsel || 0, p.letztesGespraech || 0,
      p.merkmale || [], p.kaderrolle || 'rotation', p.rollenSeit || 0,
      (p.ehrungen || []).slice(-20)
    ];
  }

  function entpackSpieler(a) {
    var attr = {};
    D.ALLE_ATTRIBUTE.forEach(function (k, i) { attr[k] = a[9][i]; });
    var unz = {};
    UNZUFRIEDEN.forEach(function (k, i) { unz[k] = a[24][i]; });
    return {
      id: a[0], vorname: a[1], nachname: a[2], nation: a[3], alter: a[4], geburtstag: a[5],
      pos: a[6], nebenpos: a[7], fuss: a[8], attr: attr,
      potenzial: a[10], form: a[11], moral: a[12], fitness: a[13], frische: 100,
      verletzung: a[14], verletzungsneigung: a[15], persoenlichkeit: a[16], clubId: a[17],
      nummer: a[18], kapitaen: !!a[19], vertrag: a[20], leihe: a[21], marktwert: a[22],
      wechselwunsch: a[23], unzufriedenheit: unz,
      transferliste: !!a[25], leihliste: !!a[26], trainingsfokus: a[27], trainingsleistung: a[28],
      sperre: a[29], sperreGrund: a[30], sperreWettbewerb: a[31], gelbeSaison: a[32],
      stats: entpackStats(a[33]), karriere: entpackStats(a[34]),
      historie: a[35] || [], scoutwissen: a[36], letzteNoten: a[37] || [],
      eigengewaechs: !!a[38], exClubId: a[39], versprechen: a[40],
      gemeldetWechsel: a[41], letztesGespraech: a[42],
      merkmale: a[43] || [], kaderrolle: a[44] || 'rotation', rollenSeit: a[45] || 0,
      ehrungen: a[46] || []
    };
  }

  /** Spiele verdichten: Berichte nur für die eigenen jüngsten Partien. */
  function packSpiele(world) {
    var eigene = [];
    world.spiele.forEach(function (s) {
      if (s.gespielt && s.bericht &&
        (s.heimId === world.nutzerClubId || s.gastId === world.nutzerClubId)) eigene.push(s);
    });
    eigene = U.sortBy(eigene, function (s) { return -s.tag; }).slice(0, 12);
    var behalten = {};
    eigene.forEach(function (s) { behalten[s.id] = true; });

    return world.spiele.map(function (s) {
      var kopie = {
        id: s.id, wettbewerb: s.wettbewerb, ligaId: s.ligaId, europaId: s.europaId,
        runde: s.runde, rundeName: s.rundeName, tag: s.tag, zeit: s.zeit,
        heimId: s.heimId, gastId: s.gastId, neutral: s.neutral, hinspielId: s.hinspielId,
        verlaengerung: s.verlaengerung, elfmeterschiessen: s.elfmeterschiessen,
        gespielt: s.gespielt, ergebnis: s.ergebnis, seed: s.seed,
        bericht: behalten[s.id] ? s.bericht : null
      };
      return kopie;
    });
  }

  /** Finanzen verdichten: das Buchungsjournal nur beim eigenen Verein behalten. */
  function packFinanzen(world) {
    var out = {};
    Object.keys(world.finanzen).forEach(function (id) {
      var f = world.finanzen[id];
      var kopie = {};
      Object.keys(f).forEach(function (k) { kopie[k] = f[k]; });
      kopie.kontostand = Math.round(f.kontostand);
      kopie.buch = id === world.nutzerClubId ? f.buch.slice(-60) : [];
      return (out[id] = kopie);
    });
    return out;
  }

  /** Wandelt die Welt in ein kompaktes Datenobjekt. */
  function serialisiere(world) {
    var daten = { format: FORMAT, gespeichert: Date.now(), idZaehler: U.currentId() };
    FELDER.forEach(function (k) { if (world[k] !== undefined) daten[k] = world[k]; });
    daten.finanzen = packFinanzen(world);
    daten.spieler = world.spielerIds.map(function (id) {
      return packSpieler(world.spieler[id]);
    });
    daten.spiele = packSpiele(world);
    daten.rngZustand = world.rng.s;

    // Kommazahlen werden beim Schreiben gerundet - das spart bei
    // Zehntausenden Werten sehr viel Platz.
    return JSON.stringify(daten, function (k, v) {
      if (k.charAt(0) === '_') return undefined;
      if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 1000) / 1000;
      return v;
    });
  }

  function deserialisiere(text) {
    var daten = typeof text === 'string' ? JSON.parse(text) : text;
    if (!daten || !daten.spieler) throw new Error('Der Spielstand ist unvollständig.');
    if (daten.format !== FORMAT) {
      throw new Error('Dieser Spielstand stammt aus einer älteren Programmversion und lässt sich nicht laden.');
    }
    var world = {};
    FELDER.forEach(function (k) { world[k] = daten[k]; });
    world.finanzen = daten.finanzen;
    world.spiele = daten.spiele;
    world.spieler = {};
    world.spielerIds = [];
    daten.spieler.forEach(function (a) {
      var p = entpackSpieler(a);
      world.spieler[p.id] = p;
      world.spielerIds.push(p.id);
    });
    world.rng = new U.Rng(daten.rngZustand || 1);
    U.resetIds(daten.idZaehler || 500000);

    world.spielIndex = {};
    world.spieleNachTag = {};
    world.protokoll = [];
    world.inboxZaehler = world.inbox ? world.inbox.length : 0;
    world.pause = null;

    FM.world.methodenAnhaengen(world);
    FM.world.indexAufbauen(world);
    world.stabCacheLeeren();
    return world;
  }

  function kopfdaten(world, groesse) {
    return {
      verein: world.nutzerClubId && world.vereine[world.nutzerClubId]
        ? world.vereine[world.nutzerClubId].name : '-',
      trainer: world.manager ? world.manager.name : '-',
      datum: U.fmtDate(world.tag),
      saison: world.saison,
      gespeichert: Date.now(),
      groesse: groesse
    };
  }

  // ------------------------------------------------------------ IndexedDB

  function db() {
    return new global.Promise(function (aufloesen, ablehnen) {
      if (!global.indexedDB) { ablehnen(new Error('IndexedDB steht nicht zur Verfügung.')); return; }
      var anfrage = global.indexedDB.open(DB_NAME, 1);
      anfrage.onupgradeneeded = function () {
        var d = anfrage.result;
        if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
      };
      anfrage.onsuccess = function () { aufloesen(anfrage.result); };
      anfrage.onerror = function () { ablehnen(anfrage.error || new Error('IndexedDB nicht erreichbar.')); };
    });
  }

  function dbSchreiben(text, kopf) {
    return db().then(function (d) {
      return new global.Promise(function (aufloesen, ablehnen) {
        var tx = d.transaction(DB_STORE, 'readwrite');
        var store = tx.objectStore(DB_STORE);
        store.put(text, DB_KEY);
        store.put(kopf, DB_KEY + '-kopf');
        tx.oncomplete = function () { d.close(); aufloesen(true); };
        tx.onerror = function () { d.close(); ablehnen(tx.error || new Error('Schreiben fehlgeschlagen.')); };
      });
    });
  }

  function dbLesen(schluessel) {
    return db().then(function (d) {
      return new global.Promise(function (aufloesen, ablehnen) {
        var tx = d.transaction(DB_STORE, 'readonly');
        var anfrage = tx.objectStore(DB_STORE).get(schluessel);
        anfrage.onsuccess = function () { d.close(); aufloesen(anfrage.result); };
        anfrage.onerror = function () { d.close(); ablehnen(anfrage.error); };
      });
    });
  }

  function dbLoeschen() {
    return db().then(function (d) {
      return new global.Promise(function (aufloesen) {
        var tx = d.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(DB_KEY);
        tx.objectStore(DB_STORE).delete(DB_KEY + '-kopf');
        tx.oncomplete = function () { d.close(); aufloesen(true); };
        tx.onerror = function () { d.close(); aufloesen(false); };
      });
    });
  }

  // ------------------------------------------------------------ localStorage

  function lsVerfuegbar() {
    try {
      global.localStorage.setItem('__t__', '1');
      global.localStorage.removeItem('__t__');
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------ Öffentlich

  /** Speichert asynchron. fertig(fehler, info) */
  function speichern(world, fertig) {
    var text, kopf;
    try {
      text = serialisiere(world);
      kopf = kopfdaten(world, text.length);
    } catch (e) {
      if (fertig) fertig(e);
      return;
    }
    dbSchreiben(text, kopf).then(function () {
      try {
        global.localStorage.setItem(LS_KOPF, JSON.stringify(kopf));
        global.localStorage.removeItem(LS_KEY);
      } catch (e) { /* Kopfdaten sind nur Beiwerk */ }
      if (fertig) fertig(null, kopf);
    }).catch(function () {
      // Rückfallebene: localStorage
      try {
        global.localStorage.setItem(LS_KEY, text);
        global.localStorage.setItem(LS_KOPF, JSON.stringify(kopf));
        if (fertig) fertig(null, kopf);
      } catch (e2) {
        if (fertig) fertig(new Error('Der Spielstand passt nicht in den Browserspeicher (' +
          Math.round(text.length / 1024) + ' KB). Nutzen Sie den Export in eine Datei.'));
      }
    });
  }

  /** Lädt asynchron. fertig(fehler, world) */
  function laden(fertig) {
    dbLesen(DB_KEY).then(function (text) {
      if (!text) {
        text = global.localStorage ? global.localStorage.getItem(LS_KEY) : null;
      }
      if (!text) { fertig(new Error('Es ist kein gespeicherter Stand vorhanden.')); return; }
      try { fertig(null, deserialisiere(text)); }
      catch (e) { fertig(e); }
    }).catch(function () {
      var text = null;
      try { text = global.localStorage.getItem(LS_KEY); } catch (e) { /* egal */ }
      if (!text) { fertig(new Error('Es ist kein gespeicherter Stand vorhanden.')); return; }
      try { fertig(null, deserialisiere(text)); }
      catch (e) { fertig(e); }
    });
  }

  function standInfo() {
    try {
      var kopf = global.localStorage.getItem(LS_KOPF);
      return kopf ? JSON.parse(kopf) : null;
    } catch (e) { return null; }
  }

  function loeschen() {
    try {
      global.localStorage.removeItem(LS_KEY);
      global.localStorage.removeItem(LS_KOPF);
    } catch (e) { /* egal */ }
    dbLoeschen().catch(function () { /* egal */ });
  }

  /**
   * Wohin die Exportdatei geht. Standard ist der Download des Browsers.
   * Wer das Spiel einbettet, kann hier einen eigenen Weg setzen - etwa
   * einen Dateidialog der Umgebung.
   */
  var exportWeg = null;

  function setzeExportWeg(fn) { exportWeg = fn; }

  function exportName(world) {
    var club = world.nutzerClubId && world.vereine[world.nutzerClubId]
      ? world.vereine[world.nutzerClubId].kurz : 'karriere';
    return 'bl-manager-' + club.toLowerCase() + '-' +
      U.fmtDate(world.tag).replace(/\./g, '-') + '.json';
  }

  function browserDownload(name, text, fertig) {
    var blob = new global.Blob([text], { type: 'application/json' });
    var url = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url;
    a.download = name;
    global.document.body.appendChild(a);
    a.click();
    global.document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
    fertig(null, 'gespeichert');
  }

  /**
   * Schreibt den Spielstand als Datei heraus. Der Rueckruf bekommt
   * (fehlertext, status) mit status 'gespeichert' oder 'abgebrochen'.
   */
  function exportieren(world, fertig) {
    var text = serialisiere(world);
    var melde = fertig || function () { };
    var einmal = false;
    function abschluss(fehler, status) {
      if (einmal) return;
      einmal = true;
      melde(fehler, status);
    }
    (exportWeg || browserDownload)(exportName(world), text, abschluss);
    return text.length;
  }

  function importieren(datei, fertig) {
    var leser = new global.FileReader();
    leser.onload = function () {
      try { fertig(null, deserialisiere(leser.result)); }
      catch (e) { fertig(e); }
    };
    leser.onerror = function () { fertig(new Error('Die Datei konnte nicht gelesen werden.')); };
    leser.readAsText(datei);
  }

  FM.save = {
    serialisiere: serialisiere,
    deserialisiere: deserialisiere,
    speichern: speichern,
    laden: laden,
    standInfo: standInfo,
    loeschen: loeschen,
    exportieren: exportieren,
    setzeExportWeg: setzeExportWeg,
    importieren: importieren,
    verfuegbar: lsVerfuegbar
  };

})(typeof window !== 'undefined' ? window : globalThis);
