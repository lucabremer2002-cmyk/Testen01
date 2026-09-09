/*
 * staff.js - Trainerstab, medizinische Abteilung, Scouting, Nachwuchs.
 *
 * Das Personal ist kein Beiwerk: Co-Trainer heben die Trainingsqualitaet,
 * Physios verkuerzen Ausfallzeiten, Scouts bestimmen, wie genau
 * Beobachtungsberichte sind, und der Sportdirektor verhandelt mit.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;

  var VORNAMEN = D.NAMEN.Deutschland.vor;
  var NACHNAMEN = D.NAMEN.Deutschland.nach;

  function erzeugeMitarbeiter(rng, rolleId, niveau, world) {
    var rolle = D.STAFF_ROLLEN[rolleId];
    var attr = {};
    Object.keys(D.STAFF_ATTR_NAME).forEach(function (k) {
      var wichtig = rolle.attrs.indexOf(k) >= 0;
      attr[k] = U.clamp(Math.round(rng.gauss(wichtig ? niveau : niveau * 0.55, wichtig ? 8 : 12)), 1, 99);
    });
    var alter = rng.int(30, 62);
    var gehalt = Math.round((Math.pow(Math.max(1, niveau - 25) / 45, 2.4) * 14000 + 800) / 100) * 100;
    return {
      id: U.nextId('s'),
      vorname: rng.pick(VORNAMEN),
      nachname: rng.pick(NACHNAMEN),
      rolle: rolleId,
      alter: alter,
      attr: attr,
      clubId: null,
      vertragBis: world ? world.tag + rng.int(1, 4) * 365 : 0,
      gehalt: gehalt,                       // EUR pro Woche
      ruf: U.clamp(Math.round(niveau + rng.gauss(0, 6)), 5, 99)
    };
  }

  /** Kompetenzwert eines Mitarbeiters fuer seine Rolle. */
  function koennen(m) {
    var rolle = D.STAFF_ROLLEN[m.rolle];
    if (!rolle) return 40;
    var s = 0;
    rolle.attrs.forEach(function (k) { s += m.attr[k] || 1; });
    return s / rolle.attrs.length;
  }

  /** Baut den kompletten Stab eines Vereins auf. */
  function erzeugeStab(rng, club, world) {
    var basis = club.liga === 1 ? 30 + club.ruf * 0.52
      : club.liga === 2 ? 24 + club.ruf * 0.50
        : 18 + club.ruf * 0.45;
    var stab = [];
    Object.keys(D.STAFF_ROLLEN).forEach(function (rolleId) {
      var rolle = D.STAFF_ROLLEN[rolleId];
      // Kleine Vereine leisten sich weniger Personal.
      var anzahl = rolle.anzahl;
      if (club.liga >= 2) anzahl = Math.max(1, Math.round(anzahl * 0.7));
      if (club.liga >= 3) anzahl = Math.max(1, Math.round(anzahl * 0.45));
      for (var i = 0; i < anzahl; i++) {
        var m = erzeugeMitarbeiter(rng, rolleId, U.clamp(basis + rng.gauss(i === 0 ? 4 : -4, 7), 15, 92), world);
        m.clubId = club.id;
        stab.push(m);
      }
    });
    return stab;
  }

  /**
   * Aggregierte Kennzahlen des Stabs. Wird von Training, Verletzungen,
   * Scouting und Transfers ausgewertet.
   */
  function stabWerte(world, clubId) {
    var club = world.vereine[clubId];
    var stab = world.stabVon(clubId);
    function mittel(rolleId, fallback) {
      var liste = stab.filter(function (m) { return m.rolle === rolleId; });
      if (!liste.length) return fallback;
      // Der beste zaehlt am staerksten, die anderen ergaenzen.
      var sortiert = U.sortBy(liste, koennen, true);
      var s = 0, g = 0;
      sortiert.forEach(function (m, i) {
        var w = Math.pow(0.55, i);
        s += koennen(m) * w; g += w;
      });
      return s / g;
    }
    var co = mittel('cotrainer', 35);
    var athletik = mittel('athletiktrainer', 35);
    var tw = mittel('torwarttrainer', 35);
    var analyst = mittel('analyst', 30);
    var physio = mittel('physio', 35);
    var arzt = mittel('arzt', 35);
    var chefscout = mittel('chefscout', 30);
    var scout = mittel('scout', 30);
    var jugend = mittel('nachwuchsleiter', 30);
    var sd = mittel('sportdirektor', 35);

    return {
      cotrainer: co,
      athletik: athletik,
      torwarttrainer: tw,
      analyst: analyst,
      physio: physio,
      arzt: arzt,
      chefscout: chefscout,
      scout: scout,
      nachwuchsleiter: jugend,
      sportdirektor: sd,
      // abgeleitete Groessen
      trainingsqualitaet: U.clamp(co * 0.45 + athletik * 0.20 + analyst * 0.10
        + (club ? club.trainingszentrum * 0.25 : 12), 10, 99),
      verletzungsschutz: U.clamp((athletik * 0.45 + physio * 0.25 + arzt * 0.15
        + (club ? club.medizin * 0.15 : 8)) / 100, 0.15, 0.99),
      rehaTempo: U.clamp(0.72 + (physio * 0.6 + arzt * 0.4) / 260, 0.72, 1.45),
      scoutingGenauigkeit: U.clamp((chefscout * 0.45 + scout * 0.35
        + (club ? club.scoutingnetz * 0.20 : 8)) / 100, 0.15, 0.99),
      verhandlung: U.clamp(sd / 100, 0.15, 0.99),
      taktikBonus: U.clamp(0.965 + (co * 0.5 + analyst * 0.5) / 2400, 0.96, 1.045),
      jugendQualitaet: U.clamp((jugend * 0.55 + (club ? club.akademie * 0.45 : 15)) / 100, 0.12, 0.99)
    };
  }

  /** Erzeugt Bewerber fuer eine offene Stelle. */
  function bewerber(rng, world, rolleId, clubId, anzahl) {
    var club = world.vereine[clubId];
    var basis = club.liga === 1 ? 28 + club.ruf * 0.52 : 22 + club.ruf * 0.50;
    var liste = [];
    for (var i = 0; i < (anzahl || 5); i++) {
      var m = erzeugeMitarbeiter(rng, rolleId,
        U.clamp(basis + rng.gauss(0, 12), 12, 95), world);
      liste.push(m);
    }
    return U.sortBy(liste, koennen, true);
  }

  var ROLLE_REIHENFOLGE = ['sportdirektor', 'cotrainer', 'torwarttrainer', 'athletiktrainer',
    'analyst', 'arzt', 'physio', 'chefscout', 'scout', 'nachwuchsleiter'];

  FM.staff = {
    erzeugeMitarbeiter: erzeugeMitarbeiter,
    erzeugeStab: erzeugeStab,
    stabWerte: stabWerte,
    koennen: koennen,
    bewerber: bewerber,
    ROLLE_REIHENFOLGE: ROLLE_REIHENFOLGE
  };

})(typeof window !== 'undefined' ? window : globalThis);
