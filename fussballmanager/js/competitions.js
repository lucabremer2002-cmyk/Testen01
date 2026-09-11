/*
 * competitions.js - Spielplaene, Tabellen, Pokal und Europapokal.
 *
 * Die Bundesliga und die 2. Bundesliga laufen als doppelte Rundenturniere
 * ueber 34 Spieltage, verteilt auf Freitag, Samstag und Sonntag. Dazu
 * kommen DFB-Pokal (K.o. ueber sechs Runden), Europapokal (Ligaphase mit
 * anschliessender K.o.-Phase), Supercup und Relegation.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;

  // ------------------------------------------------------------ Rundenturnier

  /**
   * Erzeugt die Paarungen eines doppelten Rundenturniers nach dem
   * Kreisverfahren. Rueckgabe: Array von Spieltagen, je ein Array von
   * Paaren [heimId, gastId].
   */
  function rundenTurnier(teamIds, rng) {
    var teams = teamIds.slice();
    rng.shuffle(teams);
    var n = teams.length;
    var dummy = null;
    if (n % 2 === 1) { teams.push(dummy); n++; }

    var runden = [];
    var liste = teams.slice();
    for (var r = 0; r < n - 1; r++) {
      var runde = [];
      for (var i = 0; i < n / 2; i++) {
        var a = liste[i];
        var b = liste[n - 1 - i];
        if (a === dummy || b === dummy) continue;
        // Heimrecht abwechseln, damit keine Mannschaft nur zu Hause spielt
        if ((r + i) % 2 === 0) runde.push([a, b]);
        else runde.push([b, a]);
      }
      runden.push(runde);
      // Rotation: erstes Element bleibt fix
      liste = [liste[0]].concat([liste[n - 1]]).concat(liste.slice(1, n - 1));
    }

    // Rueckrunde mit vertauschtem Heimrecht
    var rueck = runden.map(function (runde) {
      return runde.map(function (p) { return [p[1], p[0]]; });
    });
    return runden.concat(rueck);
  }

  // ------------------------------------------------------------ Termine

  var ANSTOSS_BL1 = [
    { tag: 4, zeit: '20:30', anzahl: 1 },      // Freitag
    { tag: 5, zeit: '15:30', anzahl: 5 },      // Samstag
    { tag: 5, zeit: '18:30', anzahl: 1 },
    { tag: 6, zeit: '15:30', anzahl: 1 },      // Sonntag
    { tag: 6, zeit: '17:30', anzahl: 1 }
  ];
  var ANSTOSS_BL2 = [
    { tag: 4, zeit: '18:30', anzahl: 2 },
    { tag: 5, zeit: '13:00', anzahl: 3 },
    { tag: 5, zeit: '20:30', anzahl: 1 },
    { tag: 6, zeit: '13:30', anzahl: 3 }
  ];
  var ANSTOSS_ENGLISCH = [
    { tag: 1, zeit: '18:30', anzahl: 4 },      // Dienstag
    { tag: 2, zeit: '20:30', anzahl: 5 }       // Mittwoch
  ];

  /**
   * Die Laenderspielfenster einer Saison. Sie haengen am Kalender, nicht
   * an der Spieltagsnummer - nur so liegen sie in allen Ligen gleich.
   * Jeweils die erste volle Woche im September, Oktober, November und
   * Maerz, wie in der Wirklichkeit.
   */
  function laenderspielKalender(jahr) {
    function fenster(y, monat) {
      var montag = U.nextWeekday(U.toDay(y, monat, 1), 0);
      return { von: montag, bis: montag + 8 };
    }
    return [
      fenster(jahr, 9), fenster(jahr, 10), fenster(jahr, 11), fenster(jahr + 1, 3)
    ];
  }

  function inFenster(tag, fenster) {
    for (var i = 0; i < fenster.length; i++) {
      if (tag >= fenster[i].von && tag <= fenster[i].bis) return fenster[i];
    }
    return null;
  }

  /**
   * Verteilt 34 Spieltage auf Kalendertermine. Die Hinrunde laeuft von
   * Mitte August bis zur Winterpause, die Rueckrunde ab Mitte Januar.
   * Termine, die in ein Laenderspielfenster fallen, ruecken dahinter.
   */
  function spieltagsTermine(jahr, anzahl, englischeWochen, fenster) {
    fenster = fenster || laenderspielKalender(jahr);
    var termine = [];
    var start = U.nextWeekday(U.toDay(jahr, 8, 15), 5);       // erster Samstag ab 15.08.
    var hin = Math.ceil(anzahl / 2);

    function frei(t) {
      var f = inFenster(t, fenster);
      return f ? U.nextWeekday(f.bis + 1, 5) : t;
    }

    var t = frei(start);
    for (var i = 0; i < hin; i++) {
      var englisch = englischeWochen.indexOf(i + 1) >= 0;
      termine.push({ samstag: t, englisch: englisch });
      t += englisch ? 4 : 7;
      if (englisch) t = U.nextWeekday(t, 5);
      t = frei(t);
    }
    // Rueckrunde: zweiter Freitag im Januar
    var r = frei(U.nextWeekday(U.toDay(jahr + 1, 1, 8), 5));
    for (i = hin; i < anzahl; i++) {
      var e2 = englischeWochen.indexOf(i + 1) >= 0;
      termine.push({ samstag: r, englisch: e2 });
      r += e2 ? 4 : 7;
      if (e2) r = U.nextWeekday(r, 5);
      r = frei(r);
    }
    return termine;
  }

  /** Verteilt die Partien eines Spieltags auf Wochentage und Anstosszeiten. */
  function verteileAnstoesse(paarungen, termin, liga, rng) {
    var muster = termin.englisch ? ANSTOSS_ENGLISCH : (liga === 1 ? ANSTOSS_BL1 : ANSTOSS_BL2);
    var slots = [];
    muster.forEach(function (m) {
      for (var i = 0; i < m.anzahl; i++) slots.push(m);
    });
    // Falls zu wenige Slots definiert sind, mit dem Hauptslot auffuellen
    while (slots.length < paarungen.length) slots.push(muster[1] || muster[0]);
    var reihenfolge = rng.shuffle(paarungen.slice());
    return reihenfolge.map(function (p, i) {
      var s = slots[i];
      // termin.samstag ist ein Samstag (Wochentag 5)
      var offset = s.tag - 5;
      return { paar: p, tag: termin.samstag + offset, zeit: s.zeit };
    });
  }

  // ------------------------------------------------------------ Ligen anlegen

  function neueLiga(id, name, kurz, stufe, teamIds, aufstieg, abstieg) {
    return {
      id: id, name: name, kurz: kurz, stufe: stufe,
      teams: teamIds.slice(),
      spieltage: [],
      aktuellerSpieltag: 0,
      aufstiegsplaetze: aufstieg,
      abstiegsplaetze: abstieg,
      tabelle: {},
      abgeschlossen: false
    };
  }

  function leererTabelleneintrag(clubId) {
    return {
      clubId: clubId, spiele: 0, siege: 0, remis: 0, niederlagen: 0,
      tore: 0, gegentore: 0, punkte: 0, platz: 0, punktabzug: 0,
      form: [], heimSiege: 0, heimRemis: 0, heimNiederlagen: 0, heimTore: 0, heimGegentore: 0,
      auswSiege: 0, auswRemis: 0, auswNiederlagen: 0, auswTore: 0, auswGegentore: 0
    };
  }

  function initTabelle(liga) {
    liga.tabelle = {};
    liga.teams.forEach(function (id) { liga.tabelle[id] = leererTabelleneintrag(id); });
  }

  function verbucheErgebnis(liga, heimId, gastId, heimTore, gastTore) {
    var h = liga.tabelle[heimId], g = liga.tabelle[gastId];
    if (!h || !g) return;
    h.spiele++; g.spiele++;
    h.tore += heimTore; h.gegentore += gastTore;
    g.tore += gastTore; g.gegentore += heimTore;
    h.heimTore += heimTore; h.heimGegentore += gastTore;
    g.auswTore += gastTore; g.auswGegentore += heimTore;
    if (heimTore > gastTore) {
      h.siege++; h.punkte += 3; h.heimSiege++; g.niederlagen++; g.auswNiederlagen++;
      h.form.push('S'); g.form.push('N');
    } else if (heimTore < gastTore) {
      g.siege++; g.punkte += 3; g.auswSiege++; h.niederlagen++; h.heimNiederlagen++;
      h.form.push('N'); g.form.push('S');
    } else {
      h.punkte++; g.punkte++; h.remis++; g.remis++; h.heimRemis++; g.auswRemis++;
      h.form.push('U'); g.form.push('U');
    }
    if (h.form.length > 6) h.form.shift();
    if (g.form.length > 6) g.form.shift();
  }

  /** Sortiert die Tabelle nach Punkten, Tordifferenz und erzielten Toren. */
  function sortierteTabelle(liga) {
    var liste = liga.teams.map(function (id) { return liga.tabelle[id]; }).filter(Boolean);
    liste.sort(function (a, b) {
      var pa = a.punkte - a.punktabzug, pb = b.punkte - b.punktabzug;
      if (pb !== pa) return pb - pa;
      var da = a.tore - a.gegentore, db = b.tore - b.gegentore;
      if (db !== da) return db - da;
      if (b.tore !== a.tore) return b.tore - a.tore;
      return a.clubId < b.clubId ? -1 : 1;
    });
    liste.forEach(function (e, i) { e.platz = i + 1; });
    return liste;
  }

  // ------------------------------------------------------------ DFB-Pokal

  var POKAL_RUNDEN = [
    { nr: 1, name: '1. Hauptrunde', teams: 64 },
    { nr: 2, name: '2. Hauptrunde', teams: 32 },
    { nr: 3, name: 'Achtelfinale', teams: 16 },
    { nr: 4, name: 'Viertelfinale', teams: 8 },
    { nr: 5, name: 'Halbfinale', teams: 4 },
    { nr: 6, name: 'Finale', teams: 2 }
  ];

  function pokalTermine(jahr) {
    return [
      U.nextWeekday(U.toDay(jahr, 8, 8), 4),        // 1. Runde: Freitag Mitte August
      U.nextWeekday(U.toDay(jahr, 10, 26), 1),      // 2. Runde: Ende Oktober
      U.nextWeekday(U.toDay(jahr + 1, 2, 2), 1),    // Achtelfinale: Anfang Februar
      U.nextWeekday(U.toDay(jahr + 1, 3, 2), 1),    // Viertelfinale: Anfang März
      U.nextWeekday(U.toDay(jahr + 1, 4, 20), 1),   // Halbfinale: Ende April
      U.toDay(jahr + 1, 5, 24)                      // Finale in Berlin
    ];
  }

  /**
   * Auslosung der 1. Hauptrunde: Amateure und Drittligisten werden
   * bevorzugt gegen Profivereine gelost und haben Heimrecht.
   */
  function pokalErsteRunde(rng, profis, amateure) {
    var a = rng.shuffle(amateure.slice());
    var p = rng.shuffle(profis.slice());
    var paarungen = [];
    while (a.length && p.length) {
      paarungen.push({ heimId: a.pop(), gastId: p.pop(), amateurHeim: true });
    }
    // Uebrige Profis untereinander
    while (p.length >= 2) {
      paarungen.push({ heimId: p.pop(), gastId: p.pop(), amateurHeim: false });
    }
    // Uebrige Amateure untereinander
    while (a.length >= 2) {
      paarungen.push({ heimId: a.pop(), gastId: a.pop(), amateurHeim: true });
    }
    return paarungen;
  }

  /** Freie Auslosung der Folgerunden. Der zuerst Gezogene hat Heimrecht. */
  function pokalAuslosung(rng, teilnehmer, world) {
    var liste = rng.shuffle(teilnehmer.slice());
    var paarungen = [];
    while (liste.length >= 2) {
      var a = liste.pop(), b = liste.pop();
      // Kleinerer Verein bekommt Heimrecht, wenn zwei Ligastufen dazwischen liegen
      var ca = world.vereine[a], cb = world.vereine[b];
      if (ca && cb && cb.liga - ca.liga >= 2) { var t = a; a = b; b = t; }
      paarungen.push({ heimId: a, gastId: b });
    }
    return paarungen;
  }

  // ------------------------------------------------------------ Europapokal

  var EUROPA_WETTBEWERBE = {
    CL: { id: 'CL', name: 'UEFA Champions League', kurz: 'CL', teilnehmer: 36, spiele: 8, minRuf: 74 },
    EL: { id: 'EL', name: 'UEFA Europa League', kurz: 'EL', teilnehmer: 36, spiele: 8, minRuf: 62 },
    ECL: { id: 'ECL', name: 'UEFA Conference League', kurz: 'ECL', teilnehmer: 36, spiele: 6, minRuf: 48 }
  };

  function europaTermine(jahr, anzahlSpieltage, fenster) {
    // Ligaphase: September bis Januar, jeweils Dienstag/Mittwoch/Donnerstag
    fenster = fenster || laenderspielKalender(jahr);
    var basis = [
      U.toDay(jahr, 9, 16), U.toDay(jahr, 10, 1), U.toDay(jahr, 10, 22),
      U.toDay(jahr, 11, 5), U.toDay(jahr, 11, 26), U.toDay(jahr, 12, 10),
      U.toDay(jahr + 1, 1, 20), U.toDay(jahr + 1, 1, 28)
    ];
    return basis.slice(0, anzahlSpieltage).map(function (t) {
      var d = U.nextWeekday(t, 1);
      var f = inFenster(d, fenster);
      return f ? U.nextWeekday(f.bis + 1, 1) : d;
    });
  }

  var EUROPA_KO_TERMINE = function (jahr) {
    return {
      playoffHin: U.nextWeekday(U.toDay(jahr + 1, 2, 10), 1),
      playoffRueck: U.nextWeekday(U.toDay(jahr + 1, 2, 17), 1),
      achtelHin: U.nextWeekday(U.toDay(jahr + 1, 3, 3), 1),
      achtelRueck: U.nextWeekday(U.toDay(jahr + 1, 3, 10), 1),
      viertelHin: U.nextWeekday(U.toDay(jahr + 1, 4, 7), 1),
      viertelRueck: U.nextWeekday(U.toDay(jahr + 1, 4, 14), 1),
      halbHin: U.nextWeekday(U.toDay(jahr + 1, 4, 28), 1),
      halbRueck: U.nextWeekday(U.toDay(jahr + 1, 5, 5), 1),
      finale: U.toDay(jahr + 1, 5, 30)
    };
  };

  // ------------------------------------------------------------ Relegation

  function relegationTermine(jahr) {
    return {
      hin: U.toDay(jahr + 1, 5, 21),
      rueck: U.toDay(jahr + 1, 5, 25)
    };
  }

  // ------------------------------------------------------------ Hilfen

  /** Zwei-Spiel-Duell auswerten: Gesamttore entscheiden. */
  function duellSieger(hinHeim, hinGast, rueckHeim, rueckGast, hinHeimId, hinGastId, elfmeter) {
    // Rueckspiel: hinGastId ist Heim
    var toreA = hinHeim + rueckGast;      // hinHeimId gesamt
    var toreB = hinGast + rueckHeim;      // hinGastId gesamt
    if (toreA > toreB) return hinHeimId;
    if (toreB > toreA) return hinGastId;
    if (elfmeter) return elfmeter;
    return null;
  }

  function formText(form) {
    return form.map(function (f) { return f; }).join('');
  }

  FM.competitions = {
    rundenTurnier: rundenTurnier,
    spieltagsTermine: spieltagsTermine,
    laenderspielKalender: laenderspielKalender,
    verteileAnstoesse: verteileAnstoesse,
    neueLiga: neueLiga,
    initTabelle: initTabelle,
    leererTabelleneintrag: leererTabelleneintrag,
    verbucheErgebnis: verbucheErgebnis,
    sortierteTabelle: sortierteTabelle,
    POKAL_RUNDEN: POKAL_RUNDEN,
    pokalTermine: pokalTermine,
    pokalErsteRunde: pokalErsteRunde,
    pokalAuslosung: pokalAuslosung,
    EUROPA_WETTBEWERBE: EUROPA_WETTBEWERBE,
    europaTermine: europaTermine,
    EUROPA_KO_TERMINE: EUROPA_KO_TERMINE,
    relegationTermine: relegationTermine,
    duellSieger: duellSieger,
    formText: formText,
    ANSTOSS_BL1: ANSTOSS_BL1,
    ANSTOSS_BL2: ANSTOSS_BL2
  };

})(typeof window !== 'undefined' ? window : globalThis);
