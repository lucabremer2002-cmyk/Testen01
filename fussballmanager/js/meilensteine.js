/*
 * meilensteine.js - Langfristige Ziele einer Trainerlaufbahn.
 *
 * Eine Saison hat ihr Saisonziel, aber eine Laufbahn braucht mehr: Zahlen,
 * die ueber Jahre wachsen, und Vorhaben, an denen man ueber mehrere
 * Spielzeiten arbeitet. Jeder Meilenstein kennt sein Ziel und seinen
 * aktuellen Stand; erreicht man ihn, wird der Tag festgehalten.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var P = FM.players;

  function m(world) { return world.manager; }

  /** Summe aller Pflichtspiele der Laufbahn, unabhaengig vom Verein. */
  function gesamt(world) {
    var g = m(world).gesamtbilanz;
    return g || { spiele: 0, siege: 0, remis: 0, niederlagen: 0 };
  }

  function titelZahl(world, muster) {
    return m(world).titel.filter(function (t) {
      return !muster || muster.test(t.titel);
    }).length;
  }

  /** Meister und Pokal in derselben Spielzeit. */
  function doubleGeschafft(world) {
    var jahre = {};
    m(world).titel.forEach(function (t) {
      jahre[t.saison] = jahre[t.saison] || { meister: 0, pokal: 0 };
      if (/Deutscher Meister/.test(t.titel)) jahre[t.saison].meister = 1;
      if (/Pokalsieger/.test(t.titel)) jahre[t.saison].pokal = 1;
    });
    return Object.keys(jahre).some(function (j) {
      return jahre[j].meister && jahre[j].pokal;
    }) ? 1 : 0;
  }

  /** Zwei Meisterschaften in aufeinanderfolgenden Spielzeiten. */
  function titelVerteidigt(world) {
    var jahre = m(world).titel
      .filter(function (t) { return /Deutscher Meister/.test(t.titel); })
      .map(function (t) { return t.saison; })
      .sort(function (a, b) { return a - b; });
    for (var i = 1; i < jahre.length; i++) {
      if (jahre[i] === jahre[i - 1] + 1) return 1;
    }
    return 0;
  }

  /** Laengste Amtszeit am Stueck bei einem Verein, in abgeschlossenen Saisons. */
  function laengsteAmtszeit(world) {
    var k = m(world).karriere;
    var beste = 0, lauf = 0, letzter = null;
    k.forEach(function (e) {
      if (e.clubId === letzter) lauf++; else { lauf = 1; letzter = e.clubId; }
      if (lauf > beste) beste = lauf;
    });
    return beste;
  }

  function eigenerKader(world) {
    return world.nutzerClubId ? world.kaderVon(world.nutzerClubId) : [];
  }

  function bestesEigengewaechs(world) {
    var beste = 0;
    eigenerKader(world).forEach(function (p) {
      if (!p.eigengewaechs) return;
      beste = Math.max(beste, P.gesamt(p));
    });
    return Math.round(beste);
  }

  function bestesTalent(world) {
    var beste = 0;
    eigenerKader(world).forEach(function (p) {
      if (p.alter > 21) return;
      beste = Math.max(beste, P.gesamt(p));
    });
    return Math.round(beste);
  }

  function kaderwert(world) {
    var s = 0;
    eigenerKader(world).forEach(function (p) { s += p.marktwert || 0; });
    return s;
  }

  function bestenTorschuetze(world) {
    var beste = 0;
    eigenerKader(world).forEach(function (p) { beste = Math.max(beste, p.stats.tore); });
    return beste;
  }

  function aufstiege(world) {
    return m(world).karriere.filter(function (e) { return e.aufgestiegen; }).length;
  }

  /**
   * Der Katalog. Reihenfolge ist die Anzeigereihenfolge; die Gruppe
   * buendelt verwandte Vorhaben.
   */
  var KATALOG = [
    // ---- Erfolge auf dem Platz
    { id: 'sieg1', gruppe: 'Auf dem Platz', name: 'Der erste Sieg', ziel: 1,
      text: 'Das erste Pflichtspiel als Trainer gewonnen.',
      wert: function (w) { return gesamt(w).siege; } },
    { id: 'siege50', gruppe: 'Auf dem Platz', name: '50 Siege', ziel: 50,
      text: 'Fünfzig Pflichtspiele gewonnen.',
      wert: function (w) { return gesamt(w).siege; } },
    { id: 'siege150', gruppe: 'Auf dem Platz', name: '150 Siege', ziel: 150,
      text: 'Einhundertfünfzig Pflichtspiele gewonnen.',
      wert: function (w) { return gesamt(w).siege; } },
    { id: 'siege400', gruppe: 'Auf dem Platz', name: '400 Siege', ziel: 400,
      text: 'Vierhundert Pflichtspiele gewonnen - eine Trainerlaufbahn, die zählt.',
      wert: function (w) { return gesamt(w).siege; } },
    { id: 'spiele300', gruppe: 'Auf dem Platz', name: '300 Spiele an der Linie', ziel: 300,
      text: 'Dreihundert Pflichtspiele als Trainer erlebt.',
      wert: function (w) { return gesamt(w).spiele; } },
    { id: 'serie10', gruppe: 'Auf dem Platz', name: 'Zehn ohne Niederlage', ziel: 10,
      text: 'Zehn Pflichtspiele in Folge ungeschlagen geblieben.',
      wert: function (w) { return (w.rekorde && w.rekorde.besteSerieUngeschlagen) || 0; } },
    { id: 'serieSieg6', gruppe: 'Auf dem Platz', name: 'Sechs Siege am Stück', ziel: 6,
      text: 'Sechs Pflichtspiele hintereinander gewonnen.',
      wert: function (w) { return (w.rekorde && w.rekorde.besteSerieSiege) || 0; } },

    // ---- Titel
    { id: 'titel1', gruppe: 'Titel', name: 'Der erste Titel', ziel: 1,
      text: 'Eine Trophäe im Schrank.',
      wert: function (w) { return titelZahl(w); } },
    { id: 'meister', gruppe: 'Titel', name: 'Deutscher Meister', ziel: 1,
      text: 'Die Schale geholt.',
      wert: function (w) { return titelZahl(w, /Deutscher Meister/); } },
    { id: 'pokal', gruppe: 'Titel', name: 'Pokalsieger', ziel: 1,
      text: 'Den DFB-Pokal gewonnen.',
      wert: function (w) { return titelZahl(w, /Pokalsieger/); } },
    { id: 'double', gruppe: 'Titel', name: 'Das Double', ziel: 1,
      text: 'Meisterschaft und Pokal in einer Spielzeit.',
      wert: doubleGeschafft },
    { id: 'verteidigt', gruppe: 'Titel', name: 'Titel verteidigt', ziel: 1,
      text: 'Zwei Meisterschaften in aufeinanderfolgenden Jahren.',
      wert: titelVerteidigt },
    { id: 'titel5', gruppe: 'Titel', name: 'Fünf Titel', ziel: 5,
      text: 'Fünf Trophäen in der eigenen Laufbahn.',
      wert: function (w) { return titelZahl(w); } },
    { id: 'europa', gruppe: 'Titel', name: 'Europapokalsieger', ziel: 1,
      text: 'International einen Wettbewerb gewonnen.',
      wert: function (w) { return titelZahl(w, /Champions|Europa League|Conference/); } },
    { id: 'aufstieg', gruppe: 'Titel', name: 'Aufstieg geschafft', ziel: 1,
      text: 'Einen Verein in die Bundesliga geführt.',
      wert: aufstiege },

    // ---- Aufbauarbeit
    { id: 'eigen75', gruppe: 'Aufbauarbeit', name: 'Eigengewächs auf 75', ziel: 75,
      text: 'Ein Spieler aus der eigenen Jugend erreicht Stärke 75.',
      wert: bestesEigengewaechs, alsWert: true },
    { id: 'eigen85', gruppe: 'Aufbauarbeit', name: 'Eigengewächs auf 85', ziel: 85,
      text: 'Ein Spieler aus der eigenen Jugend wird zum Star.',
      wert: bestesEigengewaechs, alsWert: true },
    { id: 'talent80', gruppe: 'Aufbauarbeit', name: 'Ein Talent mit 80', ziel: 80,
      text: 'Ein Spieler unter 22 Jahren erreicht Stärke 80.',
      wert: bestesTalent, alsWert: true },
    { id: 'torjaeger25', gruppe: 'Aufbauarbeit', name: '25 Tore in einer Saison', ziel: 25,
      text: 'Ein eigener Spieler trifft fünfundzwanzig Mal in einer Spielzeit.',
      wert: bestenTorschuetze },
    { id: 'kaderwert', gruppe: 'Aufbauarbeit', name: 'Kaderwert 200 Mio.', ziel: 200e6,
      text: 'Der Kader ist zweihundert Millionen wert.',
      wert: kaderwert, geld: true },

    // ---- Amtszeit
    { id: 'saison3', gruppe: 'Amtszeit', name: 'Drei Spielzeiten', ziel: 3,
      text: 'Drei Saisons als Trainer abgeschlossen.',
      wert: function (w) { return m(w).karriere.length; } },
    { id: 'saison10', gruppe: 'Amtszeit', name: 'Zehn Spielzeiten', ziel: 10,
      text: 'Zehn Saisons als Trainer abgeschlossen.',
      wert: function (w) { return m(w).karriere.length; } },
    { id: 'treue5', gruppe: 'Amtszeit', name: 'Fünf Jahre ein Verein', ziel: 5,
      text: 'Fünf Spielzeiten am Stück bei demselben Verein.',
      wert: laengsteAmtszeit },
    { id: 'ruf85', gruppe: 'Amtszeit', name: 'Ein großer Name', ziel: 85,
      text: 'Der eigene Trainerruf erreicht 85.',
      wert: function (w) { return Math.round(m(w).ruf); }, alsWert: true },
    { id: 'konto100', gruppe: 'Amtszeit', name: 'Hundert Millionen auf dem Konto', ziel: 100e6,
      text: 'Der Verein steht finanziell glänzend da.',
      wert: function (w) {
        var f = w.nutzerClubId ? w.finanzen[w.nutzerClubId] : null;
        return f ? Math.max(0, f.kontostand) : 0;
      }, geld: true }
  ];

  function stand(world) {
    if (!m(world).meilensteine) m(world).meilensteine = {};
    return m(world).meilensteine;
  }

  /**
   * Bestwerte. Viele Groessen fallen wieder - der Torjaeger wechselt den
   * Verein, die Saisontore werden zurueckgesetzt. Der Fortschritt eines
   * Vorhabens soll aber nie wieder kleiner werden.
   */
  function bestwerte(world) {
    if (!m(world).bestwerte) m(world).bestwerte = {};
    return m(world).bestwerte;
  }

  function aktuellerWert(world, e) {
    var wert = 0;
    try { wert = e.wert(world) || 0; } catch (err) { wert = 0; }
    var best = bestwerte(world);
    if (!(best[e.id] > wert)) best[e.id] = wert;
    return best[e.id];
  }

  /** Alle Meilensteine mit ihrem aktuellen Stand. */
  function uebersicht(world) {
    var erreicht = stand(world);
    return KATALOG.map(function (e) {
      var wert = aktuellerWert(world, e);
      return {
        id: e.id, gruppe: e.gruppe, name: e.name, text: e.text,
        ziel: e.ziel, wert: wert, geld: !!e.geld, alsWert: !!e.alsWert,
        anteil: U.clamp(wert / e.ziel, 0, 1),
        erreicht: !!erreicht[e.id], tag: erreicht[e.id] || 0
      };
    });
  }

  /**
   * Prueft, was seit dem letzten Durchlauf dazugekommen ist. Rueckgabe:
   * die neu erreichten Meilensteine.
   */
  function pruefe(world) {
    if (!world.nutzerClubId) return [];
    var erreicht = stand(world);
    var neu = [];
    KATALOG.forEach(function (e) {
      var wert = aktuellerWert(world, e);
      if (erreicht[e.id]) return;
      if (wert < e.ziel) return;
      erreicht[e.id] = world.tag;
      neu.push(e);
    });
    neu.forEach(function (e) {
      world.nachricht({
        typ: 'karriere', prioritaet: 3,
        titel: 'Meilenstein: ' + e.name,
        text: e.text + ' Erreicht am ' + U.fmtDate(world.tag, 'lang') + '.'
      });
    });
    return neu;
  }

  /** Wie viele Meilensteine stehen schon? */
  function bilanz(world) {
    var erreicht = stand(world);
    var n = 0;
    KATALOG.forEach(function (e) { if (erreicht[e.id]) n++; });
    return { erreicht: n, gesamt: KATALOG.length };
  }

  /** Die naechsten drei Vorhaben, die realistisch in Reichweite sind. */
  function naechste(world, anzahl) {
    return U.sortBy(uebersicht(world).filter(function (e) {
      return !e.erreicht && e.anteil > 0;
    }), function (e) { return -e.anteil; }).slice(0, anzahl || 3);
  }

  FM.meilensteine = {
    KATALOG: KATALOG,
    uebersicht: uebersicht,
    pruefe: pruefe,
    bilanz: bilanz,
    naechste: naechste
  };

})(typeof window !== 'undefined' ? window : globalThis);
