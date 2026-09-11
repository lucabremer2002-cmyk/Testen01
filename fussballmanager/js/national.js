/**
 * Nationalmannschaften und Laenderspielpausen.
 *
 * Viermal in der Saison ruht der Vereinsfussball eine Woche. In dieser
 * Zeit werden die besten Spieler einer Nation nominiert: Sie sammeln
 * Einsaetze und Tore fuer ihr Land, kommen aber mueder zurueck - und
 * gelegentlich verletzt. Wer regelmaessig spielt, gewinnt an Moral und
 * Marktwert.
 *
 * Die Laenderspiele selbst werden nicht Minute fuer Minute simuliert.
 * Was am Verein ankommt, ist das Ergebnis der Reise: Belastung, Form,
 * Stolz - und die Nachricht, wer unterwegs ist.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var P = FM.players;

  var KADERGROESSE = 20;         // je Nation
  var MINDESTSTAERKE = 52;       // darunter nominiert niemand

  function stelleDatenBereit(world) {
    if (!world.national) {
      world.national = { offenesFenster: null, erledigt: [] };
    }
    return world.national;
  }

  /** Das Fenster, in dem der heutige Tag liegt - oder null. */
  function fensterAn(world, tag) {
    var liste = world.laenderspielFenster || [];
    for (var i = 0; i < liste.length; i++) {
      if (tag >= liste[i].von && tag <= liste[i].bis) return liste[i];
    }
    return null;
  }

  /** Laeuft gerade eine Laenderspielpause? */
  function pauseLaeuft(world) {
    return !!fensterAn(world, world.tag);
  }

  // ------------------------------------------------------------ Nominierung

  /**
   * Stellt die Kader aller Nationen zusammen. Nominiert wird, wer zu den
   * Besten seines Landes gehoert, fit ist und nicht gesperrt oder
   * verletzt.
   */
  function nominieren(world) {
    var nachNation = {};
    world.spielerIds.forEach(function (id) {
      var p = world.spieler[id];
      if (!p || !p.clubId) return;
      if (p.verletzung) return;
      var club = world.vereine[p.clubId];
      if (!club) return;
      (nachNation[p.nation] = nachNation[p.nation] || []).push(p);
    });

    var nominiert = [];
    Object.keys(nachNation).forEach(function (nation) {
      var liste = U.sortBy(nachNation[nation], function (p) {
        // Klasse zaehlt, aktuelle Form spuerbar mit.
        return -(P.gesamt(p) * 1.0 + p.form * 0.10);
      });
      var n = 0;
      for (var i = 0; i < liste.length && n < KADERGROESSE; i++) {
        var p = liste[i];
        if (P.gesamt(p) < MINDESTSTAERKE) break;
        // Ein Torwart mehr als noetig muss nicht mit.
        p.nationalelf = true;
        nominiert.push(p);
        n++;
      }
    });
    return nominiert;
  }

  /**
   * Wertet ein abgelaufenes Fenster aus: Einsaetze, Tore, Belastung,
   * Verletzungen.
   */
  function abrechnen(world, nominierte) {
    var rng = world.rng;
    var meldungen = [];
    nominierte.forEach(function (p) {
      p.nationalelf = false;
      if (!p.clubId) return;

      // Zwei Laenderspiele je Fenster; wer nicht gesetzt ist, spielt weniger.
      var stamm = U.clamp((P.gesamt(p) - 58) / 22, 0.15, 0.95);
      var einsaetze = 0;
      if (rng.chance(stamm)) einsaetze++;
      if (rng.chance(stamm * 0.85)) einsaetze++;
      if (!einsaetze) return;

      p.laenderspiele = (p.laenderspiele || 0) + einsaetze;

      var tore = 0;
      var torquote = p.pos === 'ST' || p.pos === 'LF' || p.pos === 'RF' ? 0.22
        : p.pos === 'OM' || p.pos === 'ZM' ? 0.10 : p.pos === 'TW' ? 0 : 0.04;
      for (var i = 0; i < einsaetze; i++) if (rng.chance(torquote)) tore++;
      if (tore) p.laendertore = (p.laendertore || 0) + tore;

      // Reise und Belastung
      p.fitness = U.clamp(p.fitness - einsaetze * rng.range(7, 14), 0, 100);
      p.moral = U.clamp(p.moral + einsaetze * 2 + tore * 3, 5, 99);

      // Verletzungsrisiko auf Reisen
      var risiko = 0.020 * einsaetze * (0.6 + p.verletzungsneigung / 90);
      if (P.hatMerkmal && P.hatMerkmal(p, 'glasknochen')) risiko *= 1.5;
      var verletzt = false;
      if (rng.chance(risiko)) {
        var v = rng.weighted(FM.data.VERLETZUNGEN, function (x) { return x.gewicht; });
        p.verletzung = { name: v.name, tage: rng.int(v.min, v.max), schwere: v.schwere, seit: world.tag };
        verletzt = true;
      }

      if (world.istNutzerVerein(p.clubId)) {
        meldungen.push({ p: p, einsaetze: einsaetze, tore: tore, verletzt: verletzt });
      }
    });
    return meldungen;
  }

  // ------------------------------------------------------------ Tageslauf

  /**
   * Wird taeglich aufgerufen. Beginnt ein Fenster, wird nominiert; endet
   * es, wird abgerechnet.
   */
  function tagesPruefung(world) {
    var st = stelleDatenBereit(world);
    var fenster = fensterAn(world, world.tag);

    if (fenster && !st.offenesFenster) {
      var nominierte = nominieren(world);
      st.offenesFenster = { von: fenster.von, bis: fenster.bis,
        ids: nominierte.map(function (p) { return p.id; }) };
      meldeNominierung(world, nominierte);
      return { status: 'nominiert', anzahl: nominierte.length };
    }

    if (!fenster && st.offenesFenster) {
      var liste = st.offenesFenster.ids
        .map(function (id) { return world.spieler[id]; })
        .filter(Boolean);
      var meldungen = abrechnen(world, liste);
      meldeRueckkehr(world, meldungen);
      st.erledigt.push(st.offenesFenster.von);
      st.offenesFenster = null;
      return { status: 'abgerechnet', anzahl: meldungen.length };
    }
    return null;
  }

  function meldeNominierung(world, nominierte) {
    if (!world.nutzerClubId) return;
    var eigene = nominierte.filter(function (p) { return p.clubId === world.nutzerClubId; });
    if (!eigene.length) return;
    var text = eigene.map(function (p) {
      return p.vorname + ' ' + p.nachname + ' (' + p.nation + ')';
    }).join(', ');
    world.nachricht({
      typ: 'verband', prioritaet: 2,
      titel: 'Nominierungen: ' + eigene.length + ' Spieler abgestellt',
      text: 'Für die Länderspielpause sind abgestellt: ' + text +
        '. Sie kehren belastet zurück.'
    });
  }

  function meldeRueckkehr(world, meldungen) {
    if (!meldungen.length) return;
    var verletzte = meldungen.filter(function (m) { return m.verletzt; });
    var text = meldungen.map(function (m) {
      return m.p.nachname + ': ' + m.einsaetze + ' Einsatz' + (m.einsaetze > 1 ? 'e' : '') +
        (m.tore ? ', ' + m.tore + ' Tor' + (m.tore > 1 ? 'e' : '') : '');
    }).join(' · ');
    world.nachricht({
      typ: 'verband', prioritaet: verletzte.length ? 3 : 1,
      titel: 'Rückkehr aus der Länderspielpause',
      text: text + '.'
    });
    verletzte.forEach(function (m) {
      world.nachricht({
        typ: 'medizin', prioritaet: 3,
        titel: 'Verletzt zurück: ' + m.p.nachname,
        text: m.p.vorname + ' ' + m.p.nachname + ' hat sich im Länderspiel verletzt (' +
          m.p.verletzung.name + ', ' + m.p.verletzung.tage + ' Tage).'
      });
    });
  }

  /** Wer aus einem Kader gerade unterwegs ist. */
  function abgestellte(world, clubId) {
    return world.kaderVon(clubId).filter(function (p) { return p.nationalelf; });
  }

  FM.national = {
    tagesPruefung: tagesPruefung,
    pauseLaeuft: pauseLaeuft,
    fensterAn: fensterAn,
    abgestellte: abgestellte,
    nominieren: nominieren
  };

})(typeof window !== 'undefined' ? window : globalThis);
