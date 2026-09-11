/**
 * Kabine: Hierarchie, Gruppen und Klima einer Mannschaft.
 *
 * Eine Mannschaft ist keine Liste von Zahlen. Ein paar Spieler geben den
 * Ton an - wer sie gegen sich hat, hat die Kabine gegen sich. Und Spieler
 * schliessen sich zusammen: nach Herkunft, nach Alter, nach Charakter.
 *
 * Gerechnet wird nur fuer den Verein des Nutzers und nur, wenn die
 * Ansicht es braucht. Fuer 36 Vereine waere das jede Woche Ballast ohne
 * sichtbaren Nutzen.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  // ------------------------------------------------------------ Einfluss

  /**
   * Wie viel Gewicht die Stimme eines Spielers in der Kabine hat.
   * Fuehrung und Erfahrung zaehlen am meisten, dann Klasse und Einsatzzeit.
   */
  function einfluss(world, p, kader) {
    var st = P.gesamt(p);
    var w = 0;
    w += p.attr.fuehrung * 0.42;
    w += p.attr.teamwork * 0.10;
    w += st * 0.22;
    w += Math.min(12, p.alter - 17) * 1.5;                  // Erfahrung im Verein
    w += Math.min(40, (p.laenderspiele || 0)) * 0.25;
    if (p.kapitaen) w += 18;
    if (p.eigengewaechs) w += 4;
    var gespielt = p.clubId ? Math.max(1, world.spieltageGespielt(p.clubId)) : 1;
    w += U.clamp(p.stats.minuten / (gespielt * 90), 0, 1) * 14;
    if (P.hatMerkmal(p, 'antreiber')) w += 10;
    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
    if (pers && pers.id === 'fuehrer') w += 12;
    if (pers && (pers.id === 'launisch' || pers.id === 'nervoes')) w -= 6;
    return Math.max(1, w);
  }

  // Eine Kabine hat wenige Wortfuehrer, nicht ein Viertel der Mannschaft.
  var STUFEN = [
    { ab: 0.00, name: 'Wortführer', kurz: 'Wortführer' },
    { ab: 0.09, name: 'Führungsspieler', kurz: 'Führung' },
    { ab: 0.32, name: 'Fester Bestandteil', kurz: 'Kern' },
    { ab: 0.74, name: 'Randfigur', kurz: 'Rand' }
  ];

  function stufeFuer(anteil) {
    var s = STUFEN[0];
    for (var i = 0; i < STUFEN.length; i++) if (anteil >= STUFEN[i].ab) s = STUFEN[i];
    return s;
  }

  // ------------------------------------------------------------ Gruppen

  /**
   * Gruppen bilden sich entlang dessen, was Menschen verbindet: gleiche
   * Sprache, gleiches Alter, gleiche Haltung zum Beruf. Gezeigt werden
   * nur Gruppen ab drei Spielern - alles darunter ist keine Gruppe.
   */
  function gruppen(kader) {
    var raus = [];

    var nachNation = U.groupBy(kader, function (p) { return p.nation; });
    Object.keys(nachNation).forEach(function (nation) {
      if (nachNation[nation].length < 3) return;
      raus.push({
        art: 'herkunft', name: nation + '-Gruppe',
        text: 'Spieler aus ' + nation + ' halten zusammen.',
        spieler: nachNation[nation]
      });
    });

    var jung = kader.filter(function (p) { return p.alter <= 21; });
    if (jung.length >= 3) {
      raus.push({
        art: 'alter', name: 'Die Jungen',
        text: 'Der Nachwuchs steckt zusammen.',
        spieler: jung
      });
    }
    var alt = kader.filter(function (p) { return p.alter >= 30; });
    if (alt.length >= 3) {
      raus.push({
        art: 'alter', name: 'Die Erfahrenen',
        text: 'Die alten Hasen unter sich.',
        spieler: alt
      });
    }

    var profis = kader.filter(function (p) {
      return p.persoenlichkeit === 'profi' || p.persoenlichkeit === 'entschlossen' ||
        p.persoenlichkeit === 'ehrgeizig';
    });
    if (profis.length >= 4) {
      raus.push({
        art: 'haltung', name: 'Die Ernsthaften',
        text: 'Spieler, die Training als Beruf verstehen.',
        spieler: profis
      });
    }
    var unruhe = kader.filter(function (p) {
      return p.persoenlichkeit === 'launisch' || p.persoenlichkeit === 'temperament' ||
        p.persoenlichkeit === 'skrupellos' || p.persoenlichkeit === 'geldgierig';
    });
    if (unruhe.length >= 3) {
      raus.push({
        art: 'haltung', name: 'Die Unruhigen',
        text: 'Charaktere, die schnell laut werden.',
        spieler: unruhe, warnung: true
      });
    }
    return raus;
  }

  // ------------------------------------------------------------ Analyse

  /**
   * Das Gesamtbild der Kabine. `klima` ist die nach Einfluss gewichtete
   * Stimmung: Ein unzufriedener Wortfuehrer wiegt schwerer als drei
   * zufriedene Ergaenzungsspieler.
   */
  function analyse(world, clubId) {
    var kader = world.kaderVon(clubId);
    if (!kader.length) {
      return { hierarchie: [], gruppen: [], klima: 60, spannungen: [], schnittMoral: 60 };
    }

    var bewertet = kader.map(function (p) {
      return { p: p, einfluss: einfluss(world, p, kader) };
    });
    bewertet.sort(function (a, b) { return b.einfluss - a.einfluss; });
    var summe = bewertet.reduce(function (a, x) { return a + x.einfluss; }, 0);
    bewertet.forEach(function (x, i) {
      x.anteil = i / bewertet.length;
      x.stufe = stufeFuer(x.anteil);
      x.gewicht = x.einfluss / summe;
    });

    var klima = bewertet.reduce(function (a, x) { return a + x.p.moral * x.gewicht; }, 0);
    var schnitt = kader.reduce(function (a, p) { return a + p.moral; }, 0) / kader.length;

    // Spannungen: einflussreiche Spieler, die unzufrieden sind
    var spannungen = [];
    bewertet.slice(0, Math.max(4, Math.round(kader.length * 0.25))).forEach(function (x) {
      var p = x.p;
      var grund = null;
      if (p.unzufriedenheit.spielzeit > 50) grund = 'zu wenig Einsatzzeit';
      else if (p.unzufriedenheit.gehalt > 55) grund = 'sein Gehalt';
      else if (p.unzufriedenheit.ambition > 55) grund = 'die sportliche Perspektive';
      else if (p.wechselwunsch > 55) grund = 'einen Wechselwunsch';
      if (!grund) return;
      spannungen.push({
        spielerId: p.id, name: p.vorname + ' ' + p.nachname,
        stufe: x.stufe.name, grund: grund,
        gewicht: x.gewicht
      });
    });

    return {
      hierarchie: bewertet,
      gruppen: gruppen(kader),
      klima: Math.round(klima),
      schnittMoral: Math.round(schnitt),
      spannungen: spannungen
    };
  }

  // Bei diesem Klima ist der Faktor genau 1. Der Wert entspricht der
  // ueblichen Stimmung einer Mannschaft - sonst waere die Kabine eine
  // dauerhafte Strafe statt eines Auf und Ab.
  var NEUTRAL = 76;

  /**
   * Wie sich die Kabine auf die Mannschaft auswirkt. 1,0 ist neutral;
   * eine zerrissene Kabine kostet spuerbar, eine geschlossene traegt.
   */
  function klimaFaktor(world, clubId) {
    var a = analyse(world, clubId);
    return {
      klima: a.klima,
      faktor: U.clamp(1 + (a.klima - NEUTRAL) / 260, 0.93, 1.06),
      spannungen: a.spannungen.length
    };
  }

  /**
   * Das Klima aller Vereine. Wird woechentlich neu gerechnet und nicht
   * gespeichert - der Wert ergibt sich jederzeit wieder aus dem Kader.
   * Nur so wirkt die Kabine bei allen gleich und nicht nur beim Nutzer.
   */
  function alleKlimawerte(world) {
    var raus = {};
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      raus[clubId] = klimaFaktor(world, clubId);
    });
    return raus;
  }

  /** Kurzer Satz, der die Lage beschreibt. */
  function stimmungstext(a) {
    if (a.klima >= 78) return 'Die Kabine steht geschlossen hinter Ihnen.';
    if (a.klima >= 66) return 'Die Stimmung ist gut.';
    if (a.klima >= 54) return 'Die Stimmung ist ordentlich, aber nicht mehr.';
    if (a.klima >= 42) return 'In der Kabine rumort es.';
    return 'Die Kabine ist zerrissen.';
  }

  FM.kabine = {
    analyse: analyse,
    einfluss: einfluss,
    klimaFaktor: klimaFaktor,
    alleKlimawerte: alleKlimawerte,
    NEUTRAL: NEUTRAL,
    stimmungstext: stimmungstext,
    STUFEN: STUFEN
  };

})(typeof window !== 'undefined' ? window : globalThis);
