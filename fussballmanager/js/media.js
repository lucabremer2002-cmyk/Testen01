/*
 * media.js - Pressearbeit, Vorstand, Fans und Kabine.
 *
 * Alles, was ein Trainer neben dem Platz zu erledigen hat: Pressekonferenzen
 * vor und nach dem Spiel, Gespraeche mit einzelnen Spielern, Anfragen an den
 * Vorstand und der staendige Blick auf das eigene Standing.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  // ------------------------------------------------------------ Pressekonferenz

  /**
   * Erzeugt die Fragen der Pressekonferenz vor einem Spiel.
   * Jede Antwort wirkt auf Moral, Fanstimmung, Vorstand und Gegner.
   */
  function pkVorSpiel(world, spiel) {
    var eigen = world.nutzerVerein();
    var gegnerId = spiel.heimId === eigen.id ? spiel.gastId : spiel.heimId;
    var gegner = world.vereine[gegnerId];
    var heim = spiel.heimId === eigen.id;
    var fragen = [];

    var eigenTab = world.tabellenPlatz(eigen.id);
    var gegnerTab = world.tabellenPlatz(gegnerId);
    var favorit = gegner.ruf < eigen.ruf - 6;

    fragen.push({
      id: 'erwartung',
      frage: 'Sie treffen ' + (heim ? 'zu Hause auf ' : 'auswärts auf ') + gegner.name +
        '. Wie gehen Sie in dieses Spiel?',
      optionen: [
        { text: 'Wir gewinnen dieses Spiel. Punkt.', moral: +5, fans: +5, gegnerMoral: +6, vorstand: +1, risiko: true },
        { text: 'Eine schwere Aufgabe, aber wir sind vorbereitet.', moral: +2, fans: +1, gegnerMoral: 0, vorstand: +1 },
        { text: 'Wir konzentrieren uns nur auf uns selbst.', moral: +1, fans: 0, gegnerMoral: 0, vorstand: 0 },
        { text: favorit ? 'Auch so ein Gegner kann jeden schlagen.' : 'Der Gegner ist klarer Favorit.',
          moral: -1, fans: -3, gegnerMoral: +3, vorstand: -1 }
      ]
    });

    if (eigenTab && eigenTab.spiele >= 4) {
      var lauf = eigenTab.form.slice(-4).join('');
      var schlecht = (lauf.match(/N/g) || []).length >= 2;
      fragen.push({
        id: 'form',
        frage: schlecht
          ? 'Zuletzt lief es nicht rund. Woran hakt es?'
          : 'Die Mannschaft ist in guter Form. Was macht sie derzeit aus?',
        optionen: schlecht ? [
          { text: 'Die Mannschaft arbeitet hart, das wird sich auszahlen.', moral: +4, fans: +1, vorstand: +1 },
          { text: 'Wir hatten schlicht Pech in entscheidenden Situationen.', moral: +2, fans: -2, vorstand: -1 },
          { text: 'Einige Spieler müssen deutlich mehr investieren.', moral: -6, fans: +3, vorstand: +2 },
          { text: 'Die Verantwortung dafür trage ich.', moral: +6, fans: +2, vorstand: -2 }
        ] : [
          { text: 'Wir haben hart dafür gearbeitet, das ist der Lohn.', moral: +4, fans: +2, vorstand: +1 },
          { text: 'Der Zusammenhalt in der Kabine ist herausragend.', moral: +5, fans: +2, vorstand: 0 },
          { text: 'Das war erst der Anfang, da geht noch mehr.', moral: +3, fans: +4, vorstand: +1, gegnerMoral: +3 },
          { text: 'Wir bleiben bescheiden, die Liga ist lang.', moral: +1, fans: 0, vorstand: +2 }
        ]
      });
    }

    // Frage zu einem konkreten Spieler
    var kader = world.kaderVon(eigen.id);
    var auffaellig = U.sortBy(kader.filter(function (p) { return p.stats.spiele >= 3; }),
      function (p) { return P.schnitt(p.stats); });
    if (auffaellig.length) {
      var star = auffaellig[0];
      var sorge = auffaellig[auffaellig.length - 1];
      var wechselWillige = kader.filter(function (p) { return p.wechselwunsch > 60; });
      if (wechselWillige.length && world.rng.chance(0.5)) {
        var ww = wechselWillige[0];
        fragen.push({
          id: 'wechselwunsch',
          frage: 'Es heißt, ' + ww.nachname + ' wolle den Verein verlassen. Stimmt das?',
          optionen: [
            { text: 'Er hat einen Vertrag, damit ist alles gesagt.', moral: 0, spielerMoral: { id: ww.id, wert: -6 }, fans: +3, vorstand: +2 },
            { text: 'Wir führen Gespräche, alles Weitere intern.', moral: +1, spielerMoral: { id: ww.id, wert: +2 }, fans: 0, vorstand: +1 },
            { text: 'Wer nicht hier sein will, kann gehen.', moral: -3, spielerMoral: { id: ww.id, wert: -12 }, fans: +5, vorstand: -1 },
            { text: 'Er ist ein wichtiger Spieler, wir wollen ihn halten.', moral: +2, spielerMoral: { id: ww.id, wert: +8 }, fans: +1, vorstand: 0 }
          ]
        });
      } else if (world.rng.chance(0.6)) {
        fragen.push({
          id: 'spieler',
          frage: 'Wie bewerten Sie die Leistungen von ' + star.vorname + ' ' + star.nachname + '?',
          optionen: [
            { text: 'Er ist im Moment einer der besten der Liga.', moral: +1, spielerMoral: { id: star.id, wert: +10 }, fans: +2, vorstand: 0 },
            { text: 'Solide, aber da geht noch deutlich mehr.', moral: 0, spielerMoral: { id: star.id, wert: -5 }, fans: 0, vorstand: +1 },
            { text: 'Er profitiert vor allem von der Mannschaft.', moral: +4, spielerMoral: { id: star.id, wert: -8 }, fans: 0, vorstand: 0 },
            { text: 'Über Einzelne rede ich grundsätzlich nicht.', moral: 0, spielerMoral: null, fans: -1, vorstand: +1 }
          ]
        });
      }
    }

    return {
      typ: 'vor', spielId: spiel.id, gegnerId: gegnerId,
      fragen: fragen.slice(0, 3), beantwortet: false
    };
  }

  function pkNachSpiel(world, spiel, ergebnis) {
    var eigen = world.nutzerVerein();
    var heim = spiel.heimId === eigen.id;
    var eigeneTore = heim ? ergebnis.heimTore : ergebnis.gastTore;
    var gegnerTore = heim ? ergebnis.gastTore : ergebnis.heimTore;
    var sieg = eigeneTore > gegnerTore;
    var remis = eigeneTore === gegnerTore;
    var fragen = [];

    if (sieg) {
      fragen.push({
        id: 'sieg',
        frage: 'Ein Sieg mit ' + eigeneTore + ':' + gegnerTore + '. Ihre erste Einschätzung?',
        optionen: [
          { text: 'Ein absolut verdienter Erfolg der Mannschaft.', moral: +5, fans: +3, vorstand: +2 },
          { text: 'Wir haben es uns unnötig schwer gemacht.', moral: -2, fans: 0, vorstand: +1 },
          { text: 'Das war eine Reaktion, auf die ich stolz bin.', moral: +6, fans: +4, vorstand: +1 },
          { text: 'Ein Sieg ist ein Sieg, weiter geht es.', moral: +2, fans: 0, vorstand: +1 }
        ]
      });
    } else if (remis) {
      fragen.push({
        id: 'remis',
        frage: 'Ein Unentschieden. Zufrieden?',
        optionen: [
          { text: 'Ein Punkt, den wir mitnehmen.', moral: +2, fans: 0, vorstand: 0 },
          { text: 'Zu wenig. Wir wollten hier gewinnen.', moral: -3, fans: +2, vorstand: +1 },
          { text: 'Die Chancenverwertung war unser Problem.', moral: -1, fans: 0, vorstand: 0 },
          { text: 'Wir haben uns den Punkt hart erkämpft.', moral: +3, fans: +1, vorstand: 0 }
        ]
      });
    } else {
      fragen.push({
        id: 'niederlage',
        frage: 'Eine Niederlage mit ' + eigeneTore + ':' + gegnerTore + '. Was ist schiefgelaufen?',
        optionen: [
          { text: 'Die Verantwortung liegt allein bei mir.', moral: +7, fans: +2, vorstand: -2 },
          { text: 'Die Mannschaft hat nicht das umgesetzt, was wir trainiert haben.', moral: -8, fans: +2, vorstand: +1 },
          { text: 'Der Gegner war heute schlicht besser.', moral: +1, fans: -2, vorstand: 0 },
          { text: 'Über die Schiedsrichterleistung möchte ich mich nicht äußern.', moral: +2, fans: +3, vorstand: -3, geldstrafe: 0.35 }
        ]
      });
    }

    return { typ: 'nach', spielId: spiel.id, fragen: fragen, beantwortet: false };
  }

  /** Wendet eine gegebene Antwort an. */
  function antworten(world, pk, frageIndex, optionIndex) {
    var frage = pk.fragen[frageIndex];
    if (!frage) return null;
    var opt = frage.optionen[optionIndex];
    if (!opt) return null;
    var eigen = world.nutzerVerein();
    var kader = world.kaderVon(eigen.id);

    if (opt.moral) {
      kader.forEach(function (p) {
        p.moral = U.clamp(p.moral + opt.moral, 5, 99);
      });
      world.manager.mannschaftsvertrauen = U.clamp(world.manager.mannschaftsvertrauen + opt.moral * 0.4, 0, 100);
    }
    if (opt.spielerMoral && opt.spielerMoral.id) {
      var sp = world.spieler[opt.spielerMoral.id];
      if (sp) sp.moral = U.clamp(sp.moral + opt.spielerMoral.wert, 5, 99);
    }
    if (opt.fans) {
      eigen.fanstimmung = U.clamp(eigen.fanstimmung + opt.fans, 0, 100);
      world.manager.fanvertrauen = U.clamp(world.manager.fanvertrauen + opt.fans * 0.6, 0, 100);
    }
    if (opt.vorstand) {
      world.manager.vorstandsvertrauen = U.clamp(world.manager.vorstandsvertrauen + opt.vorstand, 0, 100);
    }
    if (opt.gegnerMoral && pk.gegnerId) {
      world.kaderVon(pk.gegnerId).forEach(function (p) {
        p.moral = U.clamp(p.moral + opt.gegnerMoral, 5, 99);
      });
    }
    if (opt.geldstrafe && world.rng.chance(opt.geldstrafe)) {
      var strafe = Math.round(Math.pow(eigen.ruf / 55, 2) * 12000 / 1000) * 1000;
      FM.finance.buche(world, eigen.id, 'aus', 'sonstige', strafe, 'Geldstrafe des DFB-Sportgerichts');
      world.nachricht({
        typ: 'verband', prioritaet: 2,
        titel: 'Geldstrafe des DFB-Sportgerichts',
        text: 'Ihre Äußerungen zur Schiedsrichterleistung kosten den Verein ' + U.money(strafe) + '.'
      });
    }
    frage.antwort = optionIndex;
    return opt;
  }

  // ------------------------------------------------------------ Spielergespraeche

  var GESPRAECHSTHEMEN = {
    lob: {
      name: 'Leistung loben',
      pruefen: function (world, p) { return P.schnitt(p.stats) > 0 && P.schnitt(p.stats) <= 3.2; },
      wirkung: function (world, p, rng) {
        var passt = P.schnitt(p.stats) <= 3.2 && p.stats.spiele >= 2;
        if (passt) {
          p.moral = U.clamp(p.moral + rng.int(6, 14), 5, 99);
          p.form = U.clamp(p.form + rng.int(2, 6), 5, 99);
          return { erfolg: true, text: p.nachname + ' freut sich sichtlich über die Anerkennung.' };
        }
        p.moral = U.clamp(p.moral - 4, 5, 99);
        return { erfolg: false, text: p.nachname + ' findet das Lob unangebracht - so gut war er zuletzt nicht.' };
      }
    },
    kritik: {
      name: 'Leistung kritisieren',
      pruefen: function () { return true; },
      wirkung: function (world, p, rng) {
        var schlecht = P.schnitt(p.stats) >= 3.9 || p.trainingsleistung < 42;
        var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
        var stabil = pers ? pers.moralStabil : 1;
        if (schlecht && rng.chance(0.45 + stabil * 0.20)) {
          p.moral = U.clamp(p.moral - 4, 5, 99);
          p.form = U.clamp(p.form + rng.int(4, 10), 5, 99);
          p.trainingsleistung = U.clamp(p.trainingsleistung + 8, 1, 99);
          return { erfolg: true, text: p.nachname + ' nimmt die Kritik an und will es besser machen.' };
        }
        p.moral = U.clamp(p.moral - rng.int(8, 18), 5, 99);
        p.unzufriedenheit.ambition = U.clamp(p.unzufriedenheit.ambition + 8, 0, 100);
        return { erfolg: false, text: p.nachname + ' reagiert gereizt auf die Kritik.' };
      }
    },
    rueckendeckung: {
      name: 'Rückendeckung geben',
      pruefen: function (world, p) { return p.moral < 55 || p.form < 45; },
      wirkung: function (world, p, rng) {
        p.moral = U.clamp(p.moral + rng.int(8, 16), 5, 99);
        p.unzufriedenheit.spielzeit = U.clamp(p.unzufriedenheit.spielzeit - 12, 0, 100);
        return { erfolg: true, text: p.nachname + ' bedankt sich für das Vertrauen.' };
      }
    },
    spielzeit: {
      name: 'Mehr Spielzeit versprechen',
      pruefen: function (world, p) { return p.unzufriedenheit.spielzeit > 25; },
      wirkung: function (world, p, rng) {
        p.moral = U.clamp(p.moral + 10, 5, 99);
        p.unzufriedenheit.spielzeit = U.clamp(p.unzufriedenheit.spielzeit - 30, 0, 100);
        p.versprechen = { typ: 'spielzeit', bis: world.tag + 60, anteil: 0.5 };
        return { erfolg: true, text: 'Sie sichern ' + p.nachname + ' mehr Einsatzzeit zu. Halten Sie das Versprechen.' };
      }
    },
    wechselwunsch: {
      name: 'Über Wechselwunsch sprechen',
      pruefen: function (world, p) { return p.wechselwunsch > 40; },
      wirkung: function (world, p, rng) {
        var fuehrung = world.manager.menschenfuehrung + world.manager.ruf * 0.3;
        if (rng.chance(U.clamp(0.25 + fuehrung / 240, 0.2, 0.75))) {
          p.wechselwunsch = U.clamp(p.wechselwunsch - rng.int(20, 45), 0, 100);
          p.unzufriedenheit.ambition = U.clamp(p.unzufriedenheit.ambition - 20, 0, 100);
          p.moral = U.clamp(p.moral + 6, 5, 99);
          return { erfolg: true, text: p.nachname + ' lässt sich überzeugen und bleibt vorerst.' };
        }
        p.moral = U.clamp(p.moral - 5, 5, 99);
        return { erfolg: false, text: p.nachname + ' bleibt bei seinem Wunsch, den Verein zu verlassen.' };
      }
    },
    kapitaen: {
      name: 'Zum Kapitän machen',
      pruefen: function (world, p) { return !p.kapitaen; },
      wirkung: function (world, p, rng) {
        var kader = world.kaderVon(p.clubId);
        kader.forEach(function (x) { x.kapitaen = false; });
        p.kapitaen = true;
        p.moral = U.clamp(p.moral + 14, 5, 99);
        var taktik = world.taktikVon(p.clubId);
        taktik.kapitaen = p.id;
        // Andere Fuehrungsspieler koennen pikiert reagieren
        var kritisch = kader.filter(function (x) {
          return x.id !== p.id && x.attr.fuehrung > p.attr.fuehrung + 8;
        });
        kritisch.forEach(function (x) { x.moral = U.clamp(x.moral - 6, 5, 99); });
        return { erfolg: true,
          text: p.nachname + ' ist neuer Kapitän.' + (kritisch.length ? ' Nicht jeder in der Kabine sieht das gern.' : '') };
      }
    }
  };

  function gespraechFuehren(world, spielerId, themaId) {
    var p = world.spieler[spielerId];
    var thema = GESPRAECHSTHEMEN[themaId];
    if (!p || !thema) return { fehler: 'Ungültiges Gespräch.' };
    if (p.clubId !== world.nutzerClubId) return { fehler: 'Kein eigener Spieler.' };
    if (p.letztesGespraech && world.tag - p.letztesGespraech < 7) {
      return { fehler: 'Sie haben erst vor wenigen Tagen mit ihm gesprochen.' };
    }
    p.letztesGespraech = world.tag;
    return thema.wirkung(world, p, world.rng);
  }

  // ------------------------------------------------------------ Vorstand

  var VORSTANDSANFRAGEN = {
    transferbudget: {
      name: 'Transferbudget erhöhen',
      pruefen: function (world) { return true; },
      stellen: function (world, betrag) {
        var f = world.finanzen[world.nutzerClubId];
        var club = world.nutzerVerein();
        var m = world.manager;
        var maximal = Math.max(0, f.kontostand * 0.55 - f.transferbudget);
        var bereitschaft = (m.vorstandsvertrauen / 100) * 1.2;
        var tab = world.tabellenPlatz(club.id);
        if (tab && m.saisonziel && tab.platz <= m.saisonziel.platz) bereitschaft += 0.2;
        var gewaehrt = Math.min(betrag, maximal * bereitschaft);
        if (gewaehrt < betrag * 0.25) {
          return { ok: false, text: 'Der Vorstand lehnt ab: Die finanzielle Lage lässt das nicht zu.' };
        }
        f.transferbudget += Math.round(gewaehrt / 100000) * 100000;
        m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen - 3, 0, 100);
        return { ok: true, betrag: Math.round(gewaehrt / 100000) * 100000,
          text: 'Der Vorstand stellt zusätzlich ' + U.money(Math.round(gewaehrt / 100000) * 100000) + ' bereit.' };
      }
    },
    gehaltsbudget: {
      name: 'Gehaltsbudget erhöhen',
      stellen: function (world, betrag) {
        var f = world.finanzen[world.nutzerClubId];
        var m = world.manager;
        var prognose = FM.finance.jahresPrognose(world, world.nutzerClubId);
        var obergrenze = prognose * 0.68 / 52;
        if (f.gehaltsbudget + betrag > obergrenze) {
          return { ok: false, text: 'Der Vorstand verweist auf die Vorgaben der DFL zur Lohnquote und lehnt ab.' };
        }
        if (m.vorstandsvertrauen < 45) {
          return { ok: false, text: 'Bei der aktuellen sportlichen Lage sieht der Vorstand keinen Spielraum.' };
        }
        f.gehaltsbudget += Math.round(betrag / 500) * 500;
        m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen - 2, 0, 100);
        return { ok: true, text: 'Das wöchentliche Gehaltsbudget steigt auf ' + U.money(f.gehaltsbudget) + '.' };
      }
    },
    umwandeln: {
      name: 'Gehaltsbudget in Transferbudget umwandeln',
      stellen: function (world, betrag) {
        var f = world.finanzen[world.nutzerClubId];
        var lohn = FM.finance.wochenLohnsumme(world, world.nutzerClubId);
        var frei = f.gehaltsbudget - lohn;
        var wochen = betrag / Math.max(1, frei);
        if (frei <= 0) return { ok: false, text: 'Das Gehaltsbudget ist bereits ausgeschöpft.' };
        var moeglich = frei * 52;
        if (betrag > moeglich) return { ok: false, text: 'So viel lässt sich nicht umwandeln. Maximal ' + U.money(moeglich) + '.' };
        f.gehaltsbudget -= Math.round(betrag / 52 / 500) * 500;
        f.transferbudget += Math.round(betrag / 100000) * 100000;
        return { ok: true, text: 'Umgewandelt. Neues Transferbudget: ' + U.money(f.transferbudget) + '.' };
      }
    },
    kredit: {
      name: 'Kredit aufnehmen',
      stellen: function (world, betrag) {
        var f = world.finanzen[world.nutzerClubId];
        var club = world.nutzerVerein();
        var prognose = FM.finance.jahresPrognose(world, club.id);
        var maximal = prognose * 0.4 - f.kredit.betrag;
        if (betrag > maximal) {
          return { ok: false, text: 'Die Banken geben maximal ' + U.money(Math.max(0, maximal)) + ' frei.' };
        }
        f.kredit.betrag += betrag;
        f.kredit.zins = U.clamp(0.075 - club.finanz / 2000, 0.028, 0.085);
        f.kredit.rateWoche = Math.round(betrag / (5 * 52));
        f.kontostand += betrag;
        FM.finance.buche(world, club.id, 'ein', 'sonstige', 0, 'Kreditaufnahme ' + U.money(betrag));
        return { ok: true, text: 'Kredit über ' + U.money(betrag) + ' zu ' +
          U.num(f.kredit.zins * 100, 1) + ' % Zinsen aufgenommen.' };
      }
    }
  };

  /** Baumassnahme beim Vorstand beantragen. */
  function bauprojektBeantragen(world, projektId) {
    var club = world.nutzerVerein();
    var f = world.finanzen[club.id];
    var projekt = FM.finance.AUSBAU_PROJEKTE[projektId];
    if (!projekt) return { ok: false, text: 'Unbekanntes Projekt.' };
    if (club.bauprojekt) return { ok: false, text: 'Es läuft bereits eine Baumaßnahme.' };
    var kosten = projekt.kosten(club);
    var m = world.manager;
    if (f.kontostand < kosten * 0.55) {
      return { ok: false, text: 'Der Vorstand sieht die Finanzierung nicht gesichert. Kosten: ' + U.money(kosten) + '.' };
    }
    if (m.vorstandsvertrauen < 55) {
      return { ok: false, text: 'Der Vorstand will erst sportliche Ergebnisse sehen, bevor investiert wird.' };
    }
    FM.finance.buche(world, club.id, 'aus', 'sonstige', kosten, projekt.name);
    club.bauprojekt = {
      id: projektId, name: projekt.name, fertig: world.tag + projekt.dauer, kosten: kosten
    };
    return { ok: true, text: projekt.name + ' wird umgesetzt. Fertigstellung am ' +
      U.fmtDate(club.bauprojekt.fertig) + '. Kosten: ' + U.money(kosten) + '.' };
  }

  function bauprojekteTick(world) {
    world.vereinIds.forEach(function (id) {
      var club = world.vereine[id];
      if (!club.bauprojekt) return;
      if (club.bauprojekt.fertig > world.tag) return;
      var projekt = FM.finance.AUSBAU_PROJEKTE[club.bauprojekt.id];
      if (projekt) projekt.anwenden(club);
      var name = club.bauprojekt.name;
      club.bauprojekt = null;
      world.stabCacheLeeren();
      if (world.istNutzerVerein(id)) {
        world.nachricht({
          typ: 'verein', prioritaet: 2,
          titel: 'Baumaßnahme abgeschlossen: ' + name,
          text: 'Die Arbeiten sind beendet. Die Verbesserung wirkt sich ab sofort aus.'
        });
      }
    });
  }

  // ------------------------------------------------------------ Vertrauen

  /**
   * Aktualisiert das Vorstandsvertrauen nach einem Spiel und prueft, ob
   * eine Entlassung droht.
   */
  function vertrauenNachSpiel(world, spiel, ergebnis) {
    var m = world.manager;
    var club = world.nutzerVerein();
    if (!club) return;
    var heim = spiel.heimId === club.id;
    var eigene = heim ? ergebnis.heimTore : ergebnis.gastTore;
    var fremde = heim ? ergebnis.gastTore : ergebnis.heimTore;
    var gegnerId = heim ? spiel.gastId : spiel.heimId;
    var gegner = world.vereine[gegnerId];
    var erwartung = gegner ? U.clamp(0.5 + (club.ruf - gegner.ruf) / 90 + (heim ? 0.10 : -0.10), 0.12, 0.88) : 0.5;

    var ergebnisWert = eigene > fremde ? 1 : eigene === fremde ? 0.45 : 0;
    var delta = (ergebnisWert - erwartung) * 9;
    if (spiel.wettbewerb === 'pokal') delta *= 0.8;
    if (spiel.wettbewerb === 'test') delta *= 0.15;
    if (spiel.wettbewerb === 'europa') delta *= 0.6;

    m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen + delta * 0.8, 0, 100);
    m.fanvertrauen = U.clamp(m.fanvertrauen + delta * 1.25, 0, 100);
    club.fanstimmung = U.clamp(club.fanstimmung + delta * 0.9, 0, 100);
    m.mannschaftsvertrauen = U.clamp(m.mannschaftsvertrauen + delta * 0.6, 0, 100);

    m.bilanz.spiele++;
    if (eigene > fremde) m.bilanz.siege++;
    else if (eigene === fremde) m.bilanz.remis++;
    else m.bilanz.niederlagen++;
  }

  /** Vergleicht Tabellenstand mit dem Saisonziel. */
  function zielabgleich(world) {
    var m = world.manager;
    var club = world.nutzerVerein();
    if (!club || !m.saisonziel) return null;
    var tab = world.tabellenPlatz(club.id);
    if (!tab || tab.spiele < 5) return null;
    var abstand = tab.platz - m.saisonziel.platz;
    return { platz: tab.platz, ziel: m.saisonziel.platz, abstand: abstand, tabelle: tab };
  }

  /** Woechentliche Anpassung des Vertrauens anhand des Saisonziels. */
  function vertrauenWoche(world) {
    var m = world.manager;
    var abgleich = zielabgleich(world);
    if (abgleich) {
      var delta = U.clamp(-abgleich.abstand * 0.30, -1.8, 2.0);
      m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen + delta, 0, 100);
    }
    // Finanzielle Schieflage kostet Vertrauen
    var f = world.finanzen[world.nutzerClubId];
    if (f && f.kontostand < 0) {
      m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen - 1.2, 0, 100);
      f.lizenzWarnung += 1;
    } else if (f) {
      f.lizenzWarnung = Math.max(0, f.lizenzWarnung - 1);
    }
    // Kabinenstimmung
    var kader = world.kaderVon(world.nutzerClubId);
    if (kader.length) {
      var moral = U.avg(kader.map(function (p) { return p.moral; }));
      m.mannschaftsvertrauen = U.clamp(m.mannschaftsvertrauen * 0.9 + moral * 0.1, 0, 100);
    }
  }

  /** Prueft, ob der Trainer entlassen wird. */
  function entlassungspruefung(world) {
    var m = world.manager;
    if (!world.nutzerClubId) return null;
    // Schonfrist: in den ersten Wochen einer Amtszeit wird nicht getrennt.
    if (m.bilanz.spiele < 10) return null;
    if (m.vorstandsvertrauen > 22) { m.warnungen = 0; return null; }
    m.warnungen = (m.warnungen || 0) + 1;
    if (m.warnungen === 1) {
      world.nachricht({
        typ: 'vorstand', prioritaet: 3,
        titel: 'Der Vorstand fordert eine Reaktion',
        text: 'Die sportliche Entwicklung entspricht nicht den Erwartungen. Der Vorstand erwartet ' +
          'in den kommenden Wochen eine deutliche Steigerung, sonst wird über Ihre Zukunft gesprochen.'
      });
      return null;
    }
    if (m.vorstandsvertrauen < 12 && m.warnungen >= 3) {
      return { entlassen: true };
    }
    return null;
  }

  // ------------------------------------------------------------ Meldungen

  /** Erzeugt Pressemeldungen zum Spieltag. */
  function spieltagsBericht(world, ligaId, spieltag) {
    var liga = world.ligen[ligaId];
    if (!liga) return null;
    var tab = FM.competitions.sortierteTabelle(liga);
    var spitze = tab[0];
    var text = 'Nach dem ' + spieltag + '. Spieltag führt ' + world.vereine[spitze.clubId].name +
      ' die Tabelle mit ' + (spitze.punkte - spitze.punktabzug) + ' Punkten an.';
    return text;
  }

  FM.media = {
    pkVorSpiel: pkVorSpiel,
    pkNachSpiel: pkNachSpiel,
    antworten: antworten,
    GESPRAECHSTHEMEN: GESPRAECHSTHEMEN,
    gespraechFuehren: gespraechFuehren,
    VORSTANDSANFRAGEN: VORSTANDSANFRAGEN,
    bauprojektBeantragen: bauprojektBeantragen,
    bauprojekteTick: bauprojekteTick,
    vertrauenNachSpiel: vertrauenNachSpiel,
    vertrauenWoche: vertrauenWoche,
    zielabgleich: zielabgleich,
    entlassungspruefung: entlassungspruefung,
    spieltagsBericht: spieltagsBericht
  };

})(typeof window !== 'undefined' ? window : globalThis);
