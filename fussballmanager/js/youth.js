/*
 * youth.js - Nachwuchsleistungszentrum, Jahrgaenge und Talentfoerderung.
 *
 * Einmal im Jahr rueckt ein Jahrgang aus der U19 nach. Wie viele Spieler
 * das sind und wie gut sie werden koennen, haengt an der Akademie, dem
 * Nachwuchsleiter und dem Ruf des Vereins.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  /** Zieht den neuen Jahrgang. Rueckgabe: Liste der Spieler. */
  function jahrgang(world, clubId) {
    var club = world.vereine[clubId];
    var rng = world.rng;
    var stab = world.stabWerteVon(clubId);
    var qualitaet = stab.jugendQualitaet;      // 0..1

    var anzahl = U.clamp(Math.round(2 + qualitaet * 6 + rng.gauss(0, 1.1)), 1, 9);
    var spieler = [];
    var positionen = ['TW', 'IV', 'IV', 'LV', 'RV', 'DM', 'ZM', 'ZM', 'OM', 'LF', 'RF', 'ST', 'ST'];

    for (var i = 0; i < anzahl; i++) {
      var pos = rng.pick(positionen);
      // Grundniveau eines 17-Jaehrigen
      var basis = 22 + qualitaet * 20 + rng.gauss(0, 4);
      // Das Potenzial ist die eigentliche Waehrung im Nachwuchs.
      var potenzialBonus = rng.gauss(qualitaet * 16, 9);
      // Selten schluepft ein echtes Ausnahmetalent durch.
      if (rng.chance(0.035 + qualitaet * 0.05)) potenzialBonus += rng.range(12, 26);

      var p = P.erzeugeSpieler(rng, {
        pos: pos,
        ziel: U.clamp(basis, 14, 52),
        alter: rng.int(16, 18),
        clubId: clubId,
        auslandsquote: 0.22,
        potenzialBonus: potenzialBonus
      });
      p.eigengewaechs = true;
      p.vertrag = {
        bis: world.tag + rng.int(2, 3) * 365,
        unterschrieben: world.tag,
        gehalt: Math.round((1500 + qualitaet * 2500) / 500) * 500,
        handgeld: 0, ausstiegsklausel: 0,
        praemien: { einsatz: 300, tor: 300, sieg: 200, zuNull: 0 },
        weiterverkauf: 0
      };
      p.nummer = freieNummer(world, clubId, rng);
      p.scoutwissen = 0.55 + qualitaet * 0.35;
      p.marktwert = P.marktwert(p, world);
      world.fuegeSpielerHinzu(p);
      spieler.push(p);
    }
    return spieler;
  }

  function freieNummer(world, clubId, rng) {
    var belegt = {};
    world.kaderVon(clubId).forEach(function (p) { belegt[p.nummer] = true; });
    for (var n = 20; n < 60; n++) if (!belegt[n]) return n;
    return 60;
  }

  /**
   * Einschaetzung des Nachwuchsleiters: je besser er ist, desto genauer
   * beschreibt er das Potenzial eines Talents.
   */
  function einschaetzung(world, clubId, p) {
    var stab = world.stabWerteVon(clubId);
    var genauigkeit = U.clamp(stab.nachwuchsleiter / 100, 0.15, 0.95);
    var spanne = Math.round((1 - genauigkeit) * 22);
    var min = U.clamp(p.potenzial - spanne, 1, 99);
    var max = U.clamp(p.potenzial + spanne, 1, 99);
    return {
      min: min, max: max, genauigkeit: genauigkeit,
      text: beschreibung(Math.round((min + max) / 2))
    };
  }

  function beschreibung(potenzial) {
    if (potenzial >= 82) return 'Kann einmal international spielen';
    if (potenzial >= 74) return 'Traut man die Bundesliga-Startelf zu';
    if (potenzial >= 66) return 'Solider Bundesligaspieler in spe';
    if (potenzial >= 58) return 'Kandidat für den erweiterten Profikader';
    if (potenzial >= 50) return 'Zweitligaperspektive';
    if (potenzial >= 42) return 'Kann in der 3. Liga bestehen';
    return 'Reicht wohl nicht für den Profifußball';
  }

  /**
   * Ohne Spielpraxis verkuemmern Talente. Junge Spieler ohne Einsatzzeit
   * bekommen einen Entwicklungsmalus, Leihen helfen ihnen.
   */
  function entwicklungsHinweise(world, clubId) {
    var hinweise = [];
    var gespielt = Math.max(1, world.spieltageGespielt(clubId));
    if (gespielt < 6) return hinweise;
    world.kaderVon(clubId).forEach(function (p) {
      if (p.alter > 22) return;
      if (p.potenzial - P.gesamt(p) < 8) return;
      var anteil = p.stats.minuten / (gespielt * 90);
      if (anteil < 0.12) {
        hinweise.push({
          spielerId: p.id,
          text: p.vorname + ' ' + p.nachname + ' (' + p.alter + ') kommt kaum zu Einsätzen. ' +
            'Eine Leihe würde seiner Entwicklung helfen.'
        });
      }
    });
    return hinweise;
  }

  /** Beförderung eines Talents in den Profikader (Vertrag anpassen). */
  function befoerdern(world, clubId, spielerId) {
    var p = world.spieler[spielerId];
    var club = world.vereine[clubId];
    if (!p || p.clubId !== clubId) return { fehler: 'Spieler gehört nicht zum Verein.' };
    var neu = P.gehaltsforderung(p, club, world);
    p.vertrag.gehalt = Math.max(p.vertrag.gehalt, Math.round(neu * 0.7 / 500) * 500);
    p.moral = U.clamp(p.moral + 12, 5, 99);
    return { ok: true, gehalt: p.vertrag.gehalt };
  }

  FM.youth = {
    jahrgang: jahrgang,
    einschaetzung: einschaetzung,
    beschreibung: beschreibung,
    entwicklungsHinweise: entwicklungsHinweise,
    befoerdern: befoerdern
  };

})(typeof window !== 'undefined' ? window : globalThis);
