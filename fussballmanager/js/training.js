/*
 * training.js - Wochenplan, Entwicklung, Fitness, Verletzungen und Reha.
 *
 * Die Trainingswoche besteht aus 14 Einheiten (7 Tage, Vormittag und
 * Nachmittag). Jede Einheit kostet Frische und bringt Entwicklung in
 * bestimmten Attributgruppen. Wer zu hart trainiert, riskiert Ausfaelle.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  var TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  // belastung = Faktor auf den Frischeverlust, erholung = Faktor auf die Regeneration
  var INTENSITAETEN = {
    schonend: { name: 'Schonend', entwicklung: 0.72, belastung: 0.58, erholung: 1.18, verletzung: 0.55, moral: 0.3 },
    normal: { name: 'Normal', entwicklung: 1.00, belastung: 1.00, erholung: 1.00, verletzung: 1.00, moral: 0 },
    intensiv: { name: 'Intensiv', entwicklung: 1.26, belastung: 1.45, erholung: 0.92, verletzung: 1.55, moral: -0.4 },
    hart: { name: 'Am Limit', entwicklung: 1.45, belastung: 2.00, erholung: 0.85, verletzung: 2.30, moral: -1.0 }
  };

  var GRUNDERHOLUNG = 7.0;   // Frischepunkte pro trainingsfreiem Tagesanteil

  /** Typische Trainingswoche mit Samstagsspiel. */
  function standardPlan() {
    return {
      einheiten: [
        ['regeneration', 'frei'],          // Montag
        ['kondition', 'technik'],          // Dienstag
        ['spielformen', 'taktik_def'],     // Mittwoch
        ['taktik_off', 'abschluss'],       // Donnerstag
        ['standards', 'video'],            // Freitag
        ['frei', 'frei'],                  // Samstag (Spieltag)
        ['regeneration', 'frei']           // Sonntag
      ],
      intensitaet: 'normal',
      torwartEinheiten: 4,
      trainingslager: null
    };
  }

  function vorbereitungsPlan() {
    return {
      einheiten: [
        ['kondition', 'technik'],
        ['kondition', 'spielformen'],
        ['taktik_def', 'zweikampf'],
        ['kondition', 'abschluss'],
        ['taktik_off', 'spielformen'],
        ['standards', 'frei'],
        ['regeneration', 'frei']
      ],
      intensitaet: 'intensiv',
      torwartEinheiten: 5,
      trainingslager: null
    };
  }

  /** Alle Einheiten eines Wochentags (0 = Montag). */
  function einheitenAmTag(plan, wochentag) {
    var e = plan.einheiten[wochentag] || ['frei', 'frei'];
    return e.filter(function (x) { return x && x !== 'frei'; });
  }

  /**
   * Tageseffekt fuer einen Verein: Frische, Verletzungsrisiko, Reha.
   * Wird jeden Tag fuer jeden Verein aufgerufen.
   */
  function tagesEffekt(world, clubId, plan) {
    var club = world.vereine[clubId];
    if (!club) return;
    var rng = world.rng;
    var stab = world.stabWerteVon(clubId);
    var wochentag = U.weekday(world.tag);
    var einheiten = einheitenAmTag(plan, wochentag);
    var intens = INTENSITAETEN[plan.intensitaet] || INTENSITAETEN.normal;

    // Spieltag? Dann wird nicht trainiert.
    var hatSpiel = world.spieleAmTag(world.tag).some(function (s) {
      return s.heimId === clubId || s.gastId === clubId;
    });

    var kader = world.kaderVon(clubId);
    kader.forEach(function (p) {
      // ---- Reha und Genesung
      if (p.verletzung) {
        var tempo = stab.rehaTempo;
        p.verletzung.tage -= tempo;
        if (p.verletzung.tage <= 0) {
          var name = p.verletzung.name;
          p.verletzung = null;
          p.fitness = U.clamp(p.fitness, 25, 62);
          p.form = U.clamp(p.form - 8, 5, 99);
          if (world.istNutzerVerein(clubId)) {
            world.nachricht({
              typ: 'medizin', prioritaet: 1,
              titel: p.vorname + ' ' + p.nachname + ' ist wieder fit',
              text: 'Die medizinische Abteilung gibt ' + p.nachname + ' nach überstandener ' +
                name + ' wieder für das Mannschaftstraining frei. Die Spielfitness fehlt noch.',
              spielerId: p.id
            });
          }
        } else {
          // Rueckschlagsrisiko bei schweren Verletzungen
          if (p.verletzung.schwere >= 4 && rng.chance(0.004 * (1.3 - club.medizin / 160))) {
            p.verletzung.tage += rng.int(8, 25);
            if (world.istNutzerVerein(clubId)) {
              world.nachricht({
                typ: 'medizin', prioritaet: 2,
                titel: 'Rückschlag bei ' + p.nachname,
                text: p.nachname + ' hat bei der Reha einen Rückschlag erlitten. Die Ausfallzeit verlängert sich.',
                spielerId: p.id
              });
            }
          }
        }
        p.fitness = U.clamp(p.fitness + 0.6, 0, 78);
        return;
      }

      // ---- Frische
      if (hatSpiel) {
        // Am Spieltag selbst nur minimale Regeneration fuer Nichtspieler.
        // Wer spielt, verliert seine Frische in der Simulation selbst.
        p.fitness = U.clamp(p.fitness + 2.0, 0, 100);
        return;
      }
      // Regeneration wirkt umso staerker, je erschoepfter ein Spieler ist.
      var erholung = GRUNDERHOLUNG * U.clamp((100 - p.fitness) / 32, 0.12, 1.35) * intens.erholung;
      var belastung = 0;
      einheiten.forEach(function (id) {
        var e = D.TRAININGSEINHEITEN[id];
        if (!e) return;
        if (e.nurTW && p.pos !== 'TW') return;
        if (e.fitness >= 0) erholung += e.fitness * 0.55;
        else belastung += -e.fitness * intens.belastung;
      });
      erholung *= 0.80 + p.attr.ausdauer / 250;
      erholung += (stab.athletik - 50) / 55;
      if (p.alter >= 32) erholung -= 0.6;
      if (p.alter <= 21) erholung += 0.4;
      p.fitness = U.clamp(p.fitness + erholung - belastung, 5, 100);

      // ---- Verletzungsrisiko im Training
      var risiko = 0.0016;
      einheiten.forEach(function (id) {
        var e = D.TRAININGSEINHEITEN[id];
        if (e) risiko += e.verletzung * 0.0011;
      });
      risiko *= intens.verletzung;
      risiko *= 0.55 + p.verletzungsneigung / 90;
      risiko *= p.fitness < 55 ? 1.8 : p.fitness < 70 ? 1.3 : 1;
      risiko *= (1.30 - stab.verletzungsschutz * 0.45);
      risiko *= p.alter >= 32 ? 1.25 : 1;
      if (rng.chance(risiko)) {
        verletze(world, p, clubId, rng, 'Training');
      } else if (rng.chance(0.0006)) {
        var k = rng.pick(D.KRANKHEITEN);
        p.verletzung = { name: k.name, tage: rng.int(k.min, k.max), schwere: 1, seit: world.tag, krankheit: true };
        if (world.istNutzerVerein(clubId)) {
          world.nachricht({
            typ: 'medizin', prioritaet: 1,
            titel: p.nachname + ' fällt krankheitsbedingt aus',
            text: p.nachname + ' laboriert an einem ' + k.name.toLowerCase() +
              ' und fehlt voraussichtlich ' + p.verletzung.tage + ' Tage.',
            spielerId: p.id
          });
        }
      }
    });
  }

  function verletze(world, p, clubId, rng, ursache) {
    var v = rng.weighted(D.VERLETZUNGEN, function (x) {
      // Im Training sind schwere Verletzungen seltener als im Spiel.
      return x.gewicht * (x.schwere >= 4 ? 0.4 : 1.2);
    });
    var tage = rng.int(v.min, v.max);
    p.verletzung = { name: v.name, tage: tage, schwere: v.schwere, seit: world.tag, ursache: ursache };
    p.moral = U.clamp(p.moral - (v.schwere * 3), 5, 99);
    if (world.istNutzerVerein(clubId)) {
      world.nachricht({
        typ: 'medizin', prioritaet: v.schwere >= 3 ? 3 : 2,
        titel: p.nachname + ' verletzt sich im Training',
        text: p.vorname + ' ' + p.nachname + ' hat sich im Training eine ' + v.name +
          ' zugezogen. Die Ärzte rechnen mit einer Ausfallzeit von rund ' + tage + ' Tagen.',
        spielerId: p.id
      });
    }
  }

  /**
   * Wochenabschluss: Entwicklung, Formdrift, Zufriedenheit.
   * Wird jeden Montag ausgefuehrt.
   */
  function wochenEffekt(world, clubId, plan) {
    var club = world.vereine[clubId];
    if (!club) return [];
    var rng = world.rng;
    var stab = world.stabWerteVon(clubId);
    var intens = INTENSITAETEN[plan.intensitaet] || INTENSITAETEN.normal;

    var alleEinheiten = [];
    plan.einheiten.forEach(function (tag) {
      tag.forEach(function (id) { if (id && id !== 'frei') alleEinheiten.push(id); });
    });

    var kader = world.kaderVon(clubId);
    var gespielt = Math.max(1, world.spieltageGespielt(clubId));
    var meldungen = [];

    kader.forEach(function (p) {
      var vorher = P.gesamt(p);
      var anteil = U.clamp(p.stats.minuten / (gespielt * 90), 0, 1);

      var qualitaet = stab.trainingsqualitaet;
      if (p.pos === 'TW') qualitaet = qualitaet * 0.5 + stab.torwarttrainer * 0.5;
      qualitaet *= intens.entwicklung;

      P.entwickle(p, {
        rng: rng,
        trainingsqualitaet: U.clamp(qualitaet, 5, 99),
        einheiten: alleEinheiten,
        spielanteil: anteil,
        world: world
      });
      P.formDrift(p, rng);
      p.moral = U.clamp(p.moral + intens.moral, 5, 99);

      var nachher = P.gesamt(p);
      if (Math.round(nachher) > Math.round(vorher)) {
        meldungen.push({ spielerId: p.id, von: Math.round(vorher), auf: Math.round(nachher) });
      }

      // Junge Spieler praegen im Training neue Eigenheiten aus.
      var neuesMerkmal = P.merkmaleFortschreiben(rng, p);
      if (neuesMerkmal) {
        meldungen.push({ spielerId: p.id, merkmal: neuesMerkmal.name });
      }

      // Umschulung auf eine neue Position
      var fertig = P.umschulungsSchritt(p, qualitaet);
      if (fertig) {
        meldungen.push({ spielerId: p.id, umschulung: fertig.pos });
      }
      p.marktwert = P.marktwert(p, world);
    });

    return meldungen;
  }

  /** Trainingslager in der Vorbereitung oder Winterpause. */
  var TRAININGSLAGER = [
    { id: 'inland', name: 'Inland (Sportschule)', kosten: 120000, fitness: 8, entwicklung: 1.05, moral: 1, tage: 7 },
    { id: 'oesterreich', name: 'Österreich (Höhentraining)', kosten: 320000, fitness: 14, entwicklung: 1.12, moral: 3, tage: 10 },
    { id: 'spanien', name: 'Spanien (Marbella)', kosten: 480000, fitness: 12, entwicklung: 1.15, moral: 6, tage: 10 },
    { id: 'katar', name: 'Katar (Winter)', kosten: 850000, fitness: 15, entwicklung: 1.18, moral: 8, tage: 12 },
    { id: 'usa', name: 'USA-Reise (Marketing)', kosten: -1200000, fitness: 2, entwicklung: 0.95, moral: 2, tage: 12, einnahme: true }
  ];

  function fuehreTrainingslagerDurch(world, clubId, lagerId) {
    var lager = TRAININGSLAGER.filter(function (l) { return l.id === lagerId; })[0];
    if (!lager) return null;
    var f = world.finanzen[clubId];
    if (lager.kosten > 0) {
      if (f.kontostand < lager.kosten) return { fehler: 'Nicht genug Geld auf dem Konto.' };
      FM.finance.buche(world, clubId, 'aus', 'sonstige', lager.kosten, 'Trainingslager: ' + lager.name);
    } else {
      FM.finance.buche(world, clubId, 'ein', 'sonstige', -lager.kosten, 'Erlöse Reise: ' + lager.name);
    }
    world.kaderVon(clubId).forEach(function (p) {
      if (p.verletzung) return;
      p.fitness = U.clamp(p.fitness + lager.fitness, 5, 100);
      p.moral = U.clamp(p.moral + lager.moral, 5, 99);
      p.form = U.clamp(p.form + Math.round(lager.moral * 0.8), 5, 99);
    });
    var taktik = world.taktikVon(clubId);
    taktik.einspielgrad = U.clamp(taktik.einspielgrad + 8, 0, 100);
    return { ok: true, lager: lager };
  }

  /** Zusammenfassung des Wochenplans fuer die Anzeige. */
  function planAuswertung(plan) {
    var zaehler = {};
    var belastung = 0;
    plan.einheiten.forEach(function (tag) {
      tag.forEach(function (id) {
        if (!id || id === 'frei') return;
        zaehler[id] = (zaehler[id] || 0) + 1;
        var e = D.TRAININGSEINHEITEN[id];
        if (e) belastung += -Math.min(0, e.fitness);
      });
    });
    var intens = INTENSITAETEN[plan.intensitaet] || INTENSITAETEN.normal;
    return {
      zaehler: zaehler,
      belastung: belastung * intens.verletzung,
      schwerpunkte: U.sortBy(Object.keys(zaehler), function (k) { return -zaehler[k]; }).slice(0, 3)
    };
  }

  FM.training = {
    standardPlan: standardPlan,
    vorbereitungsPlan: vorbereitungsPlan,
    einheitenAmTag: einheitenAmTag,
    tagesEffekt: tagesEffekt,
    wochenEffekt: wochenEffekt,
    verletze: verletze,
    planAuswertung: planAuswertung,
    fuehreTrainingslagerDurch: fuehreTrainingslagerDurch,
    INTENSITAETEN: INTENSITAETEN,
    TRAININGSLAGER: TRAININGSLAGER,
    TAGE: TAGE
  };

})(typeof window !== 'undefined' ? window : globalThis);
