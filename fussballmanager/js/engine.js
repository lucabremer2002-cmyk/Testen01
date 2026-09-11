/*
 * engine.js - Der Spielmotor.
 *
 * Treibt den Kalender voran: simuliert die Partien des Tages, verbucht
 * Ergebnisse, Sperren, Geld und Statistiken, laesst Training und
 * Transfermarkt laufen und wickelt am Ende den Saisonwechsel ab.
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
  var M = FM.match;

  var GELB_SPERRE = 5;         // fünfte Gelbe Karte zieht eine Sperre nach sich

  // ------------------------------------------------------------ Tageslauf

  /**
   * Rueckt einen Tag vor. Liefert ein Objekt, das beschreibt, warum der
   * Vorlauf angehalten hat.
   *   { status: 'ok' }              - Tag ohne Besonderheit
   *   { status: 'spiel', spiel }    - eigenes Spiel steht an
   *   { status: 'saisonende' }      - Saison ist zu Ende
   *   { status: 'entlassen' }       - der Trainer wurde entlassen
   */
  function tagWeiter(world, opts) {
    opts = opts || {};

    // 1) Steht heute ein eigenes Spiel an, das noch nicht gespielt wurde?
    //    Ohne die Option wird an dieser Stelle angehalten, damit der Nutzer
    //    das Spiel selbst leiten kann.
    var eigenes = eigenesSpielHeute(world);
    if (eigenes && !opts.eigenesUeberspringen) {
      return { status: 'spiel', spiel: eigenes };
    }

    // 2) Alle Partien des Tages simulieren - das eigene Spiel eingeschlossen,
    //    wenn der Nutzer es der Simulation ueberlassen hat.
    var heute = world.spieleAmTag(world.tag).slice();
    heute.forEach(function (spiel) {
      if (spiel.gespielt) return;
      var state = M.simuliere(world, spiel);
      verarbeiteSpiel(world, spiel, state);
    });

    // 3) Trainingswirkung fuer alle Vereine
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var plan = clubId === world.nutzerClubId && world.trainingsplan
        ? world.trainingsplan
        : kiTrainingsplan(world, clubId);
      FM.training.tagesEffekt(world, clubId, plan);
    });

    // 4) Wettbewerbe fortschreiben
    pruefePokalrunden(world);
    pruefeEuropa(world);
    pruefeRelegation(world);

    // 5) Transfermarkt
    fensterPruefen(world);
    FM.transfers.scoutingTick(world);
    FM.transfers.kiTick(world);
    FM.transfers.angeboteAufraeumen(world);
    FM.transfers.vertraegePruefen(world);
    leihenPruefen(world);
    FM.media.bauprojekteTick(world);

    // 6) Wochenrhythmus (montags)
    if (U.weekday(world.tag) === 0) {
      wochenlauf(world);
    }

    // 6b) Monatsende: Spieler und Trainer des Monats
    FM.awards.tagesPruefung(world);

    // 6c) Laenderspielpause: Nominierung und Rueckkehr
    FM.national.tagesPruefung(world);

    // 7) Saisonabschluss?
    if (saisonVorbei(world)) {
      return { status: 'saisonende' };
    }

    // 8) Entlassung? Die Prüfung läuft im Wochenrhythmus (siehe wochenlauf),
    //    damit aus drei schlechten Tagen nicht sofort eine Trennung wird.
    //    Der Kalender rueckt trotzdem weiter: bliebe er stehen, liefe die
    //    Wochenpruefung am selben Montag immer wieder und spraeche die
    //    Trennung endlos erneut aus.
    if (world.entlassungAusgesprochen) {
      world.entlassungAusgesprochen = false;
      world.tag += 1;
      return { status: 'entlassen' };
    }

    world.tag += 1;
    return { status: 'ok' };
  }

  function eigenesSpielHeute(world) {
    if (!world.nutzerClubId) return null;
    var liste = world.spieleAmTag(world.tag);
    for (var i = 0; i < liste.length; i++) {
      var s = liste[i];
      if (s.gespielt) continue;
      if (s.heimId === world.nutzerClubId || s.gastId === world.nutzerClubId) return s;
    }
    return null;
  }

  /**
   * Springt so lange vorwaerts, bis etwas Aufmerksamkeit verlangt:
   * ein eigenes Spiel, eine wichtige Nachricht oder das Saisonende.
   */
  function weiterBisEreignis(world, maxTage) {
    maxTage = maxTage || 60;
    var ungelesenVorher = world.ungeleseneNachrichten();
    for (var i = 0; i < maxTage; i++) {
      var r = tagWeiter(world);
      if (r.status !== 'ok') return r;
      var wichtig = world.inbox.filter(function (n) {
        return !n.gelesen && n.prioritaet >= 2 && n.tag === world.tag - 1;
      });
      if (wichtig.length) return { status: 'nachricht', nachrichten: wichtig };
    }
    return { status: 'ok' };
  }

  function kiTrainingsplan(world, clubId) {
    // Vor der Saison wird haerter trainiert.
    var monat = U.fromDay(world.tag).m;
    if (monat === 7 || (monat === 8 && U.fromDay(world.tag).d < 15)) {
      return FM.training.vorbereitungsPlan();
    }
    if (!world._kiPlan) world._kiPlan = FM.training.standardPlan();
    return world._kiPlan;
  }

  // ------------------------------------------------------------ Wochenlauf

  function wochenlauf(world) {
    kaderrollenPflegen(world);
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club) return;
      if (!club.auslaendisch) {
        F.wocheAbrechnen(world, clubId);
        var plan = clubId === world.nutzerClubId && world.trainingsplan
          ? world.trainingsplan : kiTrainingsplan(world, clubId);
        var meldungen = FM.training.wochenEffekt(world, clubId, plan);
        if (clubId === world.nutzerClubId && meldungen.length) {
          var stufen = meldungen.filter(function (m) { return m.auf !== undefined; });
          var neueMerkmale = meldungen.filter(function (m) { return m.merkmal; });
          if (stufen.length) {
            var text = stufen.slice(0, 8).map(function (m) {
              var p = world.spieler[m.spielerId];
              return p.vorname + ' ' + p.nachname + ' (' + m.von + ' → ' + m.auf + ')';
            }).join(', ');
            world.nachricht({
              typ: 'training', prioritaet: 1,
              titel: 'Trainingsbericht der Woche',
              text: 'Die Co-Trainer melden Fortschritte bei: ' + text + '.'
            });
          }
          meldungen.filter(function (m) { return m.umschulung; }).forEach(function (m) {
            var p = world.spieler[m.spielerId];
            if (!p) return;
            world.nachricht({
              typ: 'training', prioritaet: 2,
              titel: 'Umschulung abgeschlossen: ' + p.nachname,
              text: p.vorname + ' ' + p.nachname + ' kann jetzt auch als ' +
                (D.POS_NAME[m.umschulung] || m.umschulung) + ' spielen.'
            });
          });
          neueMerkmale.forEach(function (m) {
            var p = world.spieler[m.spielerId];
            if (!p) return;
            world.nachricht({
              typ: 'training', prioritaet: 2,
              titel: 'Neue Stärke: ' + p.nachname,
              text: p.vorname + ' ' + p.nachname + ' hat sich im Training eine Eigenheit erarbeitet: ' +
                m.merkmal + '.'
            });
          });
        }
        // Zufriedenheit der Spieler
        world.kaderVon(clubId).forEach(function (p) {
          P.pruefeZufriedenheit(p, club, world, world.rng);
        });
      }
    });

    // Kadergroessen einmal woechentlich im Rahmen halten - ohne das
    // blaehen sich Kader zwischen zwei Saisonwechseln auf.
    kaderBereinigen(world);
    kaderAuffuellen(world);

    FM.transfers.kiVerlaengerungen(world);
    FM.media.vertrauenWoche(world);
    var trennung = FM.media.entlassungspruefung(world);
    if (trennung && trennung.entlassen) world.entlassungAusgesprochen = true;
    unzufriedeneSpielerMelden(world);
    lizenzPruefung(world);
    geruechteStreuen(world);
  }

  /**
   * Die KI haelt ihren Kaderstatus laufend aktuell. Beim Verein des
   * Nutzers bleiben dessen Entscheidungen stehen; nur neue Spieler ohne
   * Status bekommen einen zugewiesen.
   */
  function kaderrollenPflegen(world) {
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var kader = world.kaderVon(clubId);
      if (!kader.length) return;
      P.rollenAusrichten(kader, world, world.istNutzerVerein(clubId));
    });
  }

  function unzufriedeneSpielerMelden(world) {
    if (!world.nutzerClubId) return;
    var kader = world.kaderVon(world.nutzerClubId);
    kader.forEach(function (p) {
      if (p.wechselwunsch < 70) return;
      if (p.gemeldetWechsel && world.tag - p.gemeldetWechsel < 45) return;
      p.gemeldetWechsel = world.tag;
      var grund = p.unzufriedenheit.spielzeit > 55 ? 'fehlende Einsatzzeit'
        : p.unzufriedenheit.gehalt > 55 ? 'sein Gehalt'
          : p.unzufriedenheit.ambition > 55 ? 'die sportliche Perspektive'
            : 'die Gesamtsituation';
      world.nachricht({
        typ: 'kabine', prioritaet: 2,
        titel: p.vorname + ' ' + p.nachname + ' will wechseln',
        text: p.nachname + ' hat über seinen Berater einen Wechselwunsch hinterlegt. ' +
          'Als Grund nennt er ' + grund + '. Ein Gespräch könnte helfen.',
        spielerId: p.id, aktion: 'gespraech'
      });
    });
  }

  function lizenzPruefung(world) {
    if (!world.nutzerClubId) return;
    var f = world.finanzen[world.nutzerClubId];
    if (!f) return;
    if (f.lizenzWarnung === 4) {
      world.nachricht({
        typ: 'verband', prioritaet: 3,
        titel: 'DFL mahnt Liquiditätsnachweis an',
        text: 'Der Verein ist seit Wochen im Minus. Die DFL fordert einen Nachweis über die ' +
          'Liquidität bis zum Saisonende. Andernfalls drohen Auflagen bis hin zum Punktabzug.'
      });
    }
    if (f.lizenzWarnung >= 12) {
      var liga = world.ligaVon(world.nutzerClubId);
      if (liga && !f.punktabzugVerhaengt) {
        liga.tabelle[world.nutzerClubId].punktabzug += 3;
        f.punktabzugVerhaengt = true;
        world.nachricht({
          typ: 'verband', prioritaet: 3,
          titel: 'Drei Punkte Abzug wegen Lizenzverstoß',
          text: 'Die DFL verhängt einen Abzug von drei Punkten, weil der Liquiditätsnachweis ' +
            'nicht erbracht wurde.'
        });
      }
    }
  }

  function geruechteStreuen(world) {
    var rng = world.rng;
    if (!rng.chance(0.5)) return;
    var kader = world.nutzerClubId ? world.kaderVon(world.nutzerClubId) : [];
    var kandidaten = kader.filter(function (p) { return P.gesamt(p) >= 65 || p.wechselwunsch > 40; });
    if (!kandidaten.length) return;
    var p = rng.pick(kandidaten);
    var interessenten = world.ligen.bl1.teams.filter(function (id) {
      return id !== world.nutzerClubId && world.vereine[id].ruf > world.vereine[world.nutzerClubId].ruf - 5;
    });
    if (!interessenten.length) return;
    var club = world.vereine[rng.pick(interessenten)];
    world.transfer.geruechte.unshift({
      tag: world.tag, spielerId: p.id, clubId: club.id,
      text: club.name + ' soll Interesse an ' + p.vorname + ' ' + p.nachname + ' haben.'
    });
    if (world.transfer.geruechte.length > 30) world.transfer.geruechte.pop();
  }

  // ------------------------------------------------------------ Ergebnis verbuchen

  function verarbeiteSpiel(world, spiel, state) {
    var erg = M.ergebnis(state);
    spiel.gespielt = true;
    spiel.ergebnis = erg;
    spiel.bericht = {
      ereignisse: state.ereignisse,
      statistik: state.statistik,
      zuschauer: state.zuschauer,
      wetter: state.wetter.name,
      schiedsrichter: state.schiedsrichter.name,
      spielerDesSpiels: state.spielerDesSpiels,
      heimDaten: state.heim.spielerDaten,
      gastDaten: state.gast.spielerDaten,
      heimElf: state.heim.taktik.aufstellung.slice(),
      gastElf: state.gast.taktik.aufstellung.slice(),
      heimFormation: state.heim.taktik.formation,
      gastFormation: state.gast.taktik.formation
    };

    // Sieger bei K.o.-Partien
    if (spiel.wettbewerb === 'pokal' || spiel.wettbewerb === 'supercup' || spiel.wettbewerb === 'europaKo') {
      var s;
      if (state.elfmeterschiessen) {
        s = state.elfmeterschiessen.heim > state.elfmeterschiessen.gast ? spiel.heimId : spiel.gastId;
      } else {
        s = erg.heimTore > erg.gastTore ? spiel.heimId : erg.gastTore > erg.heimTore ? spiel.gastId : null;
      }
      erg.sieger = s;
    }

    // Tabelle
    if (spiel.wettbewerb === 'liga' && spiel.ligaId) {
      C.verbucheErgebnis(world.ligen[spiel.ligaId], spiel.heimId, spiel.gastId, erg.heimTore, erg.gastTore);
    }
    if (spiel.wettbewerb === 'europa' && spiel.europaId) {
      var wb = world.europa[spiel.europaId];
      if (wb && wb.tabelle[spiel.heimId] && wb.tabelle[spiel.gastId]) {
        C.verbucheErgebnis({ tabelle: wb.tabelle }, spiel.heimId, spiel.gastId, erg.heimTore, erg.gastTore);
      }
    }

    // Statistiken der Spieler
    uebernehmeSpielerStats(world, state.heim, spiel, erg.gastTore === 0);
    uebernehmeSpielerStats(world, state.gast, spiel, erg.heimTore === 0);

    // Sperren
    sperrenVerwalten(world, state, spiel);

    // Einspielgrad
    T.aktualisiereEinspielgrad(world.taktikVon(spiel.heimId));
    T.aktualisiereEinspielgrad(world.taktikVon(spiel.gastId));

    // Finanzen
    if (spiel.wettbewerb !== 'test' || true) {
      var wettbewerbsart = spiel.wettbewerb === 'europa' ? 'europa'
        : spiel.wettbewerb === 'pokal' ? 'pokal' : 'liga';
      if (!world.vereine[spiel.heimId].auslaendisch && !spiel.neutral) {
        F.spieltagseinnahmen(world, spiel.heimId, state.zuschauer, wettbewerbsart);
      }
      praemienZahlen(world, state, spiel);
    }

    // Vereinsrekorde fortschreiben
    rekordePruefen(world, spiel, state, erg);

    // Derby: die Mannschaft nimmt Sieg wie Niederlage staerker mit
    derbyNachwirkung(world, spiel, erg);

    // Vertrauen und Nachrichten fuer den Nutzer
    if (world.istNutzerVerein(spiel.heimId) || world.istNutzerVerein(spiel.gastId)) {
      FM.media.vertrauenNachSpiel(world, spiel, erg);
    }
    return erg;
  }

  /**
   * Schreibt die Vereinsrekorde fort: hoechster Sieg, hoechste
   * Niederlage, Zuschauerrekord und die laengste Serie ohne Niederlage.
   * Gefuehrt wird das nur fuer den Verein des Nutzers - fuer alle 36
   * Vereine waere es Ballast im Spielstand ohne sichtbaren Nutzen.
   */
  function rekordePruefen(world, spiel, state, erg) {
    var clubId = world.nutzerClubId;
    if (!clubId) return;
    if (spiel.heimId !== clubId && spiel.gastId !== clubId) return;
    // Testspiele zaehlen nicht: ein 8:0 gegen einen Amateurverein ist
    // kein Vereinsrekord.
    if (spiel.wettbewerb === 'test') return;
    if (!world.rekorde) world.rekorde = leereRekorde();
    var r = world.rekorde;

    var heim = spiel.heimId === clubId;
    var eigene = heim ? erg.heimTore : erg.gastTore;
    var fremde = heim ? erg.gastTore : erg.heimTore;
    var gegnerId = heim ? spiel.gastId : spiel.heimId;
    var eintrag = {
      tag: world.tag, saison: world.saison, gegnerId: gegnerId, heim: heim,
      tore: eigene, gegentore: fremde,
      wettbewerb: spiel.wettbewerb
    };

    if (!r.hoechsterSieg || eigene - fremde > r.hoechsterSieg.tore - r.hoechsterSieg.gegentore ||
      (eigene - fremde === r.hoechsterSieg.tore - r.hoechsterSieg.gegentore && eigene > r.hoechsterSieg.tore)) {
      if (eigene > fremde) r.hoechsterSieg = eintrag;
    }
    if (!r.hoechsteNiederlage || fremde - eigene > r.hoechsteNiederlage.gegentore - r.hoechsteNiederlage.tore ||
      (fremde - eigene === r.hoechsteNiederlage.gegentore - r.hoechsteNiederlage.tore && fremde > r.hoechsteNiederlage.gegentore)) {
      if (fremde > eigene) r.hoechsteNiederlage = eintrag;
    }
    if (heim && state.zuschauer > (r.zuschauerrekord ? r.zuschauerrekord.zahl : 0)) {
      r.zuschauerrekord = { tag: world.tag, saison: world.saison, gegnerId: gegnerId, zahl: state.zuschauer };
    }

    // Serien
    if (fremde < eigene) { r.serieSiege = (r.serieSiege || 0) + 1; } else { r.serieSiege = 0; }
    if (eigene >= fremde) { r.serieUngeschlagen = (r.serieUngeschlagen || 0) + 1; } else { r.serieUngeschlagen = 0; }
    r.besteSerieSiege = Math.max(r.besteSerieSiege || 0, r.serieSiege);
    r.besteSerieUngeschlagen = Math.max(r.besteSerieUngeschlagen || 0, r.serieUngeschlagen);
  }

  function leereRekorde() {
    return {
      hoechsterSieg: null, hoechsteNiederlage: null, zuschauerrekord: null,
      serieSiege: 0, serieUngeschlagen: 0,
      besteSerieSiege: 0, besteSerieUngeschlagen: 0,
      rekordzugang: null, rekordabgang: null
    };
  }

  /**
   * Ein Derby ist kein Spiel wie jedes andere. Sieg und Niederlage wirken
   * staerker auf Moral und Fanstimmung, und der Nutzer bekommt eine
   * Meldung, die den Anlass benennt.
   */
  function derbyNachwirkung(world, spiel, erg) {
    var riv = D.rivalitaet(spiel.heimId, spiel.gastId);
    if (!riv) return;
    var wucht = riv.stufe;
    [[spiel.heimId, erg.heimTore, erg.gastTore], [spiel.gastId, erg.gastTore, erg.heimTore]]
      .forEach(function (e) {
        var clubId = e[0], eigene = e[1], fremde = e[2];
        var club = world.vereine[clubId];
        if (!club || club.auslaendisch) return;
        var aus = eigene > fremde ? 1 : eigene === fremde ? 0 : -1;
        world.kaderVon(clubId).forEach(function (p) {
          p.moral = U.clamp(p.moral + aus * wucht * 1.6, 5, 99);
        });
        club.fans = U.clamp(club.fans + aus * wucht * 0.55, 1, 100);
        if (!world.istNutzerVerein(clubId)) return;
        var gegner = world.vereine[clubId === spiel.heimId ? spiel.gastId : spiel.heimId];
        world.nachricht({
          typ: 'kabine', prioritaet: aus < 0 ? 3 : 2,
          titel: riv.name + ': ' + (aus > 0 ? 'gewonnen' : aus === 0 ? 'geteilt' : 'verloren'),
          text: aus > 0
            ? 'Der Sieg gegen ' + gegner.name + ' hallt nach. Die Kurve feiert, die Mannschaft ist beflügelt.'
            : aus === 0
              ? 'Ein Remis gegen ' + gegner.name + ' nimmt keiner mit nach Hause. Die Fans hätten mehr erwartet.'
              : 'Die Niederlage gegen ' + gegner.name + ' sitzt tief. In der Kurve ist die Stimmung gekippt.'
        });
      });
  }

  function uebernehmeSpielerStats(world, seite, spiel, zuNull) {
    Object.keys(seite.spielerDaten).forEach(function (id) {
      var d = seite.spielerDaten[id];
      var p = world.spieler[id];
      if (!p || d.minuten < 1) return;
      var ziele = [p.stats, p.karriere];
      ziele.forEach(function (st) {
        st.spiele += 1;
        if (d.eingewechselt === 0) st.startelf += 1;
        st.minuten += d.minuten;
        st.tore += d.tore;
        st.vorlagen += d.vorlagen;
        st.gelb += d.gelb >= 1 ? 1 : 0;
        st.rot += d.rot && d.gelb < 2 ? 1 : 0;
        st.gelbrot += d.rot && d.gelb >= 2 ? 1 : 0;
        st.schuesse += d.schuesse;
        st.schuesseAufsTor += d.aufsTor;
        st.xG += d.xg;
        st.xA += d.xa;
        st.paraden += d.paraden;
        st.kmGelaufen += d.km;
        st.gegentore += d.gegentore;
        if (p.pos === 'TW' && zuNull && d.minuten >= 60) st.zuNull += 1;
        if (d.note !== null && d.note !== undefined) {
          st.notenSumme += d.note;
          st.notenAnzahl += 1;
        }
      });
      // Torschuetzenliste der Liga
      if (spiel.wettbewerb === 'liga' && d.tore) {
        world.statistik.torschuetzen[id] = (world.statistik.torschuetzen[id] || 0) + d.tore;
      }
      if (spiel.wettbewerb === 'liga' && d.vorlagen) {
        world.statistik.vorlagen[id] = (world.statistik.vorlagen[id] || 0) + d.vorlagen;
      }
      // Praemien
      if (p.vertrag && p.vertrag.praemien) {
        var pr = p.vertrag.praemien;
        var betrag = (d.minuten >= 45 ? pr.einsatz : 0) + d.tore * pr.tor;
        if (zuNull && (p.pos === 'TW' || D.POS_GRUPPE[p.pos] === 'ABW')) betrag += pr.zuNull || 0;
        if (betrag > 0 && p.clubId) {
          F.buche(world, p.clubId, 'aus', 'spielergehaelter', betrag, 'Prämien ' + p.nachname);
        }
      }
    });
  }

  function praemienZahlen(world, state, spiel) {
    var sieger = state.tore.heim > state.tore.gast ? state.heim
      : state.tore.gast > state.tore.heim ? state.gast : null;
    if (!sieger) return;
    var clubId = sieger.club.id;
    if (world.vereine[clubId].auslaendisch) return;
    var summe = 0;
    Object.keys(sieger.spielerDaten).forEach(function (id) {
      var d = sieger.spielerDaten[id];
      var p = world.spieler[id];
      if (!p || !p.vertrag || d.minuten < 20) return;
      summe += p.vertrag.praemien.sieg || 0;
    });
    if (summe > 0) F.buche(world, clubId, 'aus', 'spielergehaelter', summe, 'Siegprämien');
  }

  function sperrenVerwalten(world, state, spiel) {
    var wettbewerb = spiel.wettbewerb === 'liga' ? 'liga'
      : spiel.wettbewerb === 'europa' ? 'europa' : 'pokal';

    [state.heim, state.gast].forEach(function (seite) {
      // Absitzen der laufenden Sperren aller anderen Spieler
      world.kaderVon(seite.club.id).forEach(function (p) {
        if (p.sperre > 0 && p.sperreWettbewerb === wettbewerb) {
          var gespielt = !!seite.spielerDaten[p.id] && seite.spielerDaten[p.id].minuten > 0;
          if (!gespielt) {
            p.sperre -= 1;
            if (p.sperre <= 0) { p.sperre = 0; p.sperreGrund = ''; }
          }
        }
      });

      Object.keys(seite.spielerDaten).forEach(function (id) {
        var d = seite.spielerDaten[id];
        var p = world.spieler[id];
        if (!p) return;
        if (d.rot) {
          var spiele = d.gelb >= 2 ? 1 : world.rng.int(2, 3);
          p.sperre = spiele;
          p.sperreWettbewerb = wettbewerb;
          p.sperreGrund = d.gelb >= 2 ? 'Gelb-Rote Karte' : 'Rote Karte';
          if (world.istNutzerVerein(seite.club.id)) {
            world.nachricht({
              typ: 'verband', prioritaet: 2,
              titel: 'Sperre für ' + p.nachname,
              text: p.nachname + ' ist nach der ' + p.sperreGrund.toLowerCase() + ' für ' +
                spiele + ' Spiel' + (spiele > 1 ? 'e' : '') + ' gesperrt.',
              spielerId: p.id
            });
          }
        } else if (d.gelb === 1 && wettbewerb === 'liga') {
          p.gelbeSaison += 1;
          if (p.gelbeSaison % GELB_SPERRE === 0) {
            p.sperre = 1;
            p.sperreWettbewerb = 'liga';
            p.sperreGrund = p.gelbeSaison + '. Gelbe Karte';
            if (world.istNutzerVerein(seite.club.id)) {
              world.nachricht({
                typ: 'verband', prioritaet: 2,
                titel: 'Gelbsperre für ' + p.nachname,
                text: p.nachname + ' hat die ' + p.gelbeSaison + '. Gelbe Karte gesehen und ' +
                  'fehlt im nächsten Ligaspiel.',
                spielerId: p.id
              });
            }
          }
        }
      });
    });
  }

  // ------------------------------------------------------------ Pokal / Europa

  function pruefePokalrunden(world) {
    var pokal = world.pokal;
    if (!pokal || pokal.sieger) return;
    var letzte = pokal.runden[pokal.runden.length - 1];
    var alleGespielt = letzte.spiele.every(function (sid) {
      var s = world.spielIndex[sid];
      return s && s.gespielt;
    });
    if (!alleGespielt) return;
    if (letzte.geprueft) return;
    letzte.geprueft = true;

    // Praemien
    letzte.spiele.forEach(function (sid) {
      var s = world.spielIndex[sid];
      if (!s || !s.ergebnis) return;
      [s.heimId, s.gastId].forEach(function (cid) {
        if (world.vereine[cid] && !world.vereine[cid].auslaendisch) {
          F.buche(world, cid, 'ein', 'preisgelder', F.POKAL_PRAEMIE[letzte.nr] || 0,
            'DFB-Pokal ' + letzte.name);
        }
      });
      if (!s.ergebnis.sieger) s.ergebnis.sieger = s.heimId;   // Notfallregel
      var verlierer = s.ergebnis.sieger === s.heimId ? s.gastId : s.heimId;
      world.pokal.ausgeschieden[verlierer] = letzte.nr;
    });

    var neue = FM.world.pokalNaechsteRunde(world);
    if (world.pokal.sieger) {
      var sc = world.vereine[world.pokal.sieger];
      F.buche(world, world.pokal.sieger, 'ein', 'preisgelder', F.POKAL_PRAEMIE.sieger, 'DFB-Pokalsieg');
      world.nachricht({
        typ: 'wettbewerb', prioritaet: 2,
        titel: 'DFB-Pokalsieger: ' + sc.name,
        text: sc.name + ' gewinnt den DFB-Pokal ' + (world.saison + 1) + '.'
      });
      titelVermerken(world, world.pokal.sieger, 'DFB-Pokal');
    } else if (neue && world.istNutzerVerein) {
      var eigen = !world.nutzerClubId ? null
        : neue.spiele.map(function (sid) { return world.spielIndex[sid]; })
          .filter(function (s) { return s && (world.istNutzerVerein(s.heimId) || world.istNutzerVerein(s.gastId)); })[0];
      if (eigen) {
        var gegnerId = world.istNutzerVerein(eigen.heimId) ? eigen.gastId : eigen.heimId;
        world.nachricht({
          typ: 'wettbewerb', prioritaet: 2,
          titel: 'Pokalauslosung: ' + neue.name,
          text: 'Im ' + neue.name + ' geht es ' + (world.istNutzerVerein(eigen.heimId) ? 'zu Hause' : 'auswärts') +
            ' gegen ' + world.vereine[gegnerId].name + ' (' + U.fmtDate(eigen.tag) + ').'
        });
      }
    }
  }

  function pruefeEuropa(world) {
    Object.keys(world.europa).forEach(function (wbId) {
      var wb = world.europa[wbId];
      if (wb.abgeschlossen) return;
      var alleSpiele = [];
      wb.spieltage.forEach(function (st) { if (st) alleSpiele = alleSpiele.concat(st.spiele); });
      var offen = alleSpiele.filter(function (sid) {
        var s = world.spielIndex[sid];
        return s && !s.gespielt;
      });
      if (offen.length) return;
      if (wb.ligaphaseFertig) return;
      wb.ligaphaseFertig = true;

      // Praemien der Ligaphase
      wb.deutsche.forEach(function (clubId) {
        var praemie = F.EUROPA_PRAEMIE[wbId];
        var eintrag = wb.tabelle[clubId];
        var summe = praemie.start + (eintrag ? eintrag.siege * praemie.sieg + eintrag.remis * praemie.remis : 0);
        F.buche(world, clubId, 'ein', 'preisgelder', summe, wb.name + ' (Ligaphase)');
        var club = world.vereine[clubId];
        club.europapokal += eintrag ? eintrag.siege * 2 + eintrag.remis : 0;
      });

      // K.o.-Phase fuer deutsche Teilnehmer, die sich qualifiziert haben
      koPhaseAnsetzen(world, wb);
    });
  }

  function koPhaseAnsetzen(world, wb) {
    var termine = C.EUROPA_KO_TERMINE(world.saison);
    var runden = [
      { key: 'achtel', name: 'Achtelfinale', hin: termine.achtelHin, rueck: termine.achtelRueck },
      { key: 'viertel', name: 'Viertelfinale', hin: termine.viertelHin, rueck: termine.viertelRueck },
      { key: 'halb', name: 'Halbfinale', hin: termine.halbHin, rueck: termine.halbRueck }
    ];
    // Wer kommt weiter? Mindestens 10 Punkte oder positive Bilanz.
    var weiter = wb.deutsche.filter(function (clubId) {
      var e = wb.tabelle[clubId];
      return e && e.punkte >= (wb.spieltage.length >= 8 ? 10 : 8);
    });
    wb.deutsche.forEach(function (clubId) {
      if (weiter.indexOf(clubId) < 0) {
        wb.ausgeschieden[clubId] = 'Ligaphase';
        if (world.istNutzerVerein(clubId)) {
          world.nachricht({
            typ: 'wettbewerb', prioritaet: 2,
            titel: 'Aus in der Ligaphase',
            text: 'Der Verein scheidet in der Ligaphase der ' + wb.name + ' aus.'
          });
        }
      }
    });
    if (!weiter.length) { wb.abgeschlossen = true; return; }

    wb.koRunden = [];
    var pool = D.EUROPA.filter(function (e) { return e.ruf >= (wb.id === 'CL' ? 76 : wb.id === 'EL' ? 64 : 52); });
    weiter.forEach(function (clubId) {
      runden.forEach(function (r, i) {
        var gegner = world.auslandsVerein(world.rng.pick(pool), wb.id);
        var hin = world.neuesSpiel({
          wettbewerb: 'europaKo', europaId: wb.id, runde: i + 1,
          rundeName: r.name + ' (Hinspiel)', tag: r.hin, zeit: '21:00',
          heimId: gegner.id, gastId: clubId
        });
        var rueck = world.neuesSpiel({
          wettbewerb: 'europaKo', europaId: wb.id, runde: i + 1,
          rundeName: r.name + ' (Rückspiel)', tag: r.rueck, zeit: '21:00',
          heimId: clubId, gastId: gegner.id,
          hinspielId: hin.id, verlaengerung: true, elfmeterschiessen: true
        });
        wb.koRunden.push({ runde: r.name, clubId: clubId, hinId: hin.id, rueckId: rueck.id, nr: i + 1 });
      });
    });
    world.indexAufbauen();
  }

  /** Sobald alle Ligaspieltage durch sind, wird die Relegation angesetzt. */
  function pruefeRelegation(world) {
    if (world.relegation.length) return;
    var fertig = ['bl1', 'bl2', 'l3'].every(function (lid) {
      var liga = world.ligen[lid];
      return liga.spieltage.every(function (st) {
        return st.spiele.every(function (sid) {
          var s = world.spielIndex[sid];
          return s && s.gespielt;
        });
      });
    });
    if (!fertig) return;
    relegationAnsetzen(world);
    var eigen = world.relegation.filter(function (r) {
      return r.oben === world.nutzerClubId || r.unten === world.nutzerClubId;
    })[0];
    if (eigen) {
      world.nachricht({
        typ: 'wettbewerb', prioritaet: 3,
        titel: 'Relegation steht an',
        text: 'Es geht in die ' + eigen.name + '. Hin- und Rückspiel entscheiden über die Liga.'
      });
    }
  }

  function leihenPruefen(world) {
    world.alleSpieler().forEach(function (p) {
      if (p.leihe && p.leihe.bis <= world.tag) {
        FM.transfers.leiheBeenden(world, p);
      }
    });
  }

  function fensterPruefen(world) {
    var datum = U.fromDay(world.tag);
    var offenSommer = (datum.m === 7) || (datum.m === 8) || (datum.m === 9 && datum.d === 1);
    var offenWinter = datum.m === 1;
    var offen = offenSommer || offenWinter;
    if (offen !== world.transferfenster.offen) {
      world.transferfenster.offen = offen;
      world.transferfenster.fenster = offenWinter ? 'winter' : 'sommer';
      world.nachricht({
        typ: 'transfer', prioritaet: offen ? 2 : 1,
        titel: offen ? 'Das Transferfenster ist geöffnet' : 'Das Transferfenster ist geschlossen',
        text: offen
          ? 'Ab sofort sind Spielerwechsel möglich. Das Fenster schließt am ' +
            (offenWinter ? '31. Januar' : '1. September') + '.'
          : 'Transfers sind bis zur Öffnung des nächsten Fensters nicht mehr möglich. ' +
            'Vertragslose Spieler können weiterhin verpflichtet werden.'
      });
    }
  }

  // ------------------------------------------------------------ Saisonende

  function saisonVorbei(world) {
    var ligenFertig = ['bl1', 'bl2', 'l3'].every(function (lid) {
      var liga = world.ligen[lid];
      return liga.spieltage.every(function (st) {
        return st.spiele.every(function (sid) {
          var s = world.spielIndex[sid];
          return s && s.gespielt;
        });
      });
    });
    if (!ligenFertig) return false;
    var pokalFertig = !world.pokal || !!world.pokal.sieger;
    var relegationFertig = !world.relegation.length || world.relegation.every(function (r) {
      var h = world.spielIndex[r.hinId], rk = world.spielIndex[r.rueckId];
      return h && h.gespielt && rk && rk.gespielt;
    });
    return pokalFertig && relegationFertig;
  }

  /** Setzt die Relegationsspiele an, sobald die Ligen durch sind. */
  function relegationAnsetzen(world) {
    if (world.relegation.length) return;
    // Die ueblichen Termine gelten nur, solange sie noch in der Zukunft
    // liegen. Laenderspielpausen koennen die Ligen weiter nach hinten
    // schieben als bis zum 21. Mai - dann wuerde ein fest gesetzter
    // Termin in der Vergangenheit liegen und das Spiel nie stattfinden.
    var vorgabe = C.relegationTermine(world.saison);
    var t = {
      hin: Math.max(vorgabe.hin, world.tag + 3),
      rueck: 0
    };
    t.rueck = Math.max(vorgabe.rueck, t.hin + 4);
    var bl1 = C.sortierteTabelle(world.ligen.bl1);
    var bl2 = C.sortierteTabelle(world.ligen.bl2);
    var l3 = C.sortierteTabelle(world.ligen.l3);

    var paare = [
      { name: 'Relegation zur Bundesliga', oben: bl1[15].clubId, unten: bl2[2].clubId },
      { name: 'Relegation zur 2. Bundesliga', oben: bl2[15].clubId, unten: l3[2].clubId }
    ];
    paare.forEach(function (pa) {
      var hin = world.neuesSpiel({
        wettbewerb: 'relegation', runde: 1, rundeName: pa.name + ' (Hinspiel)',
        tag: t.hin, zeit: '20:30', heimId: pa.unten, gastId: pa.oben
      });
      var rueck = world.neuesSpiel({
        wettbewerb: 'relegation', runde: 2, rundeName: pa.name + ' (Rückspiel)',
        tag: t.rueck, zeit: '20:30', heimId: pa.oben, gastId: pa.unten,
        hinspielId: hin.id, verlaengerung: true, elfmeterschiessen: true
      });
      world.relegation.push({ name: pa.name, hinId: hin.id, rueckId: rueck.id, oben: pa.oben, unten: pa.unten });
    });
    world.indexAufbauen();
  }

  function titelVermerken(world, clubId, titel) {
    world.historie.titel[clubId] = world.historie.titel[clubId] || [];
    world.historie.titel[clubId].push({ saison: world.saison, titel: titel });
    if (world.istNutzerVerein(clubId)) {
      world.manager.titel.push({ saison: world.saison, titel: titel });
    }
  }

  /**
   * Wickelt den Saisonwechsel ab: Auf- und Abstieg, Historie, Alterung,
   * Nachwuchsjahrgang, neue Spielplaene.
   */
  function saisonAbschluss(world) {
    var bl1 = C.sortierteTabelle(world.ligen.bl1);
    var bl2 = C.sortierteTabelle(world.ligen.bl2);
    var l3 = C.sortierteTabelle(world.ligen.l3);

    // --- Titel und Preisgelder
    var meister = bl1[0].clubId;
    titelVermerken(world, meister, 'Deutscher Meister');
    // Die Medienerloese sind bereits woechentlich geflossen. Hier gibt es
    // nur noch die erfolgsabhaengige Schlusszahlung der DFL.
    bl1.forEach(function (e, i) {
      var club = world.vereine[e.clubId];
      if (club.auslaendisch) return;
      F.buche(world, e.clubId, 'ein', 'preisgelder',
        Math.round((18 - i) * 420000), 'Leistungsbezogene DFL-Schlusszahlung');
      club.europapokal = Math.max(0, club.europapokal * 0.85 + (18 - i) * 1.2);
    });
    bl2.forEach(function (e, i) {
      F.buche(world, e.clubId, 'ein', 'preisgelder',
        Math.round((18 - i) * 95000), 'Leistungsbezogene DFL-Schlusszahlung');
    });

    // --- Relegationsergebnisse auswerten
    var aufBl1 = [bl2[0].clubId, bl2[1].clubId];
    var abBl1 = [bl1[16].clubId, bl1[17].clubId];
    var aufBl2 = [l3[0].clubId, l3[1].clubId];
    var abBl2 = [bl2[16].clubId, bl2[17].clubId];

    world.relegation.forEach(function (r) {
      var hin = world.spielIndex[r.hinId], rueck = world.spielIndex[r.rueckId];
      if (!hin || !rueck || !hin.gespielt || !rueck.gespielt) return;
      var toreUnten = hin.ergebnis.heimTore + rueck.ergebnis.gastTore;
      var toreOben = hin.ergebnis.gastTore + rueck.ergebnis.heimTore;
      var sieger = toreUnten > toreOben ? r.unten
        : toreOben > toreUnten ? r.oben
          : (rueck.ergebnis.elfmeterschiessen
            ? (rueck.ergebnis.elfmeterschiessen.heim > rueck.ergebnis.elfmeterschiessen.gast ? r.oben : r.unten)
            : r.oben);
      if (r.name.indexOf('zur Bundesliga') >= 0) {
        if (sieger === r.unten) { aufBl1.push(r.unten); abBl1.push(r.oben); }
      } else {
        if (sieger === r.unten) { aufBl2.push(r.unten); abBl2.push(r.oben); }
      }
    });

    // --- Ehrungen der Saison. Muss vor dem Ligenumbau laufen, solange
    //     die Kader noch in ihren Ligen stehen.
    FM.awards.saisonAuszeichnungen(world);

    // --- Historie
    world.historie.saisons.push({
      saison: world.saison,
      meister: meister,
      pokalsieger: world.pokal ? world.pokal.sieger : null,
      bl1: bl1.map(function (e) { return { clubId: e.clubId, platz: e.platz, punkte: e.punkte - e.punktabzug, tore: e.tore, gegentore: e.gegentore }; }),
      bl2: bl2.map(function (e) { return { clubId: e.clubId, platz: e.platz, punkte: e.punkte - e.punktabzug, tore: e.tore, gegentore: e.gegentore }; }),
      torschuetzenkoenig: torschuetzenkoenig(world),
      aufsteiger: aufBl1.slice(), absteiger: abBl1.slice()
    });

    // --- Ligenzugehoerigkeit aktualisieren
    ligenUmbauen(world, aufBl1, abBl1, aufBl2, abBl2);

    // --- Saisonziel-Bilanz des Nutzers
    if (world.nutzerClubId) {
      saisonBilanzNutzer(world, bl1, bl2);
    }

    // --- Spieler altern lassen, Statistiken zuruecksetzen
    world.alleSpieler().forEach(function (p) {
      p.alter += 1;
      p.stats = P.leereStats();
      p.gelbeSaison = 0;
      p.sperre = 0;
      p.letzteNoten = [];
      if (p.alter >= 34 && world.rng.chance((p.alter - 33) * 0.18)) {
        karriereEnde(world, p);
      }
    });

    // --- Nachwuchsjahrgang
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch || club.liga > 3) return;
      var neue = FM.youth.jahrgang(world, clubId);
      if (world.istNutzerVerein(clubId) && neue.length) {
        world.nachricht({
          typ: 'nachwuchs', prioritaet: 2,
          titel: 'Der neue Jahrgang rückt nach',
          text: neue.length + ' Spieler aus der eigenen Jugend stehen ab sofort im Kader. ' +
            'Der Nachwuchsleiter hat seine Einschätzungen hinterlegt.',
          spielerIds: neue.map(function (p) { return p.id; })
        });
      }
    });

    // --- Auslaendische Vereine der Vorsaison entfernen
    entferneAuslandsvereine(world);

    // --- Sponsoren und Finanzen
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var f = world.finanzen[clubId];
      F.sponsorenNeuVerhandeln(world, clubId, world.rng);
      f.letzteSaison = f.jahresbilanz;
      f.jahresbilanz = F.leereBilanz();
      f.punktabzugVerhaengt = false;
      f.lizenzWarnung = 0;
      // Ruf entwickelt sich mit dem Erfolg
      var eintrag = world.letzteAbschlussTabelle(clubId);
      if (eintrag) {
        var erwartet = 10;
        var ziel = club.ruf + U.clamp((erwartet - eintrag.platz) * 0.30, -3, 3);
        club.ruf = U.clamp(Math.round(club.ruf * 0.85 + ziel * 0.15), 20, 99);
      }
    });

    // --- Kaderpflege: zu grosse Kader werden verkleinert
    kaderBereinigen(world);
    kaderAuffuellen(world);

    // --- Vertragslosenmarkt auf eine handhabbare Groesse bringen
    vertragsloseBereinigen(world);
    FM.world.erzeugeVertragslose(world, 20);

    // --- Neue Saison
    world.saison += 1;
    world.tag = U.toDay(world.saison, 7, 1);
    world.pokal = null;
    world.relegation = [];
    world.supercup = null;
    FM.world.starteSaison(world, false);

    world.nachricht({
      typ: 'saison', prioritaet: 3,
      titel: 'Saison ' + world.saison + '/' + String(world.saison + 1).slice(2) + ' beginnt',
      text: 'Die Vorbereitung startet. Der erste Spieltag ist angesetzt, das Transferfenster ist geöffnet.'
    });
    return { neueSaison: world.saison };
  }

  /**
   * KI-Vereine trennen sich von ueberzaehligen Spielern. Ohne das waechst
   * die Spielerzahl der Welt Saison fuer Saison unbegrenzt.
   */
  /**
   * Fuellt zu kleine Kader wieder auf. Ohne diese Gegenkraft bluten
   * Vereine ueber die Jahre aus: Vertraege laufen aus, Spieler treten ab,
   * und niemand zwingt die KI, genug nachzuverpflichten. Zuerst werden
   * vertragslose Spieler genommen, erst danach wird neu erzeugt.
   */
  function kaderAuffuellen(world) {
    var rng = world.rng;
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var minimum = club.liga === 1 ? 24 : club.liga === 2 ? 23 : 22;
      var kader = world.kaderVon(clubId);
      if (kader.length >= minimum) return;

      var fehlend = minimum - kader.length;
      var frei = world.spielerIds
        .map(function (id) { return world.spieler[id]; })
        .filter(function (p) { return p && !p.clubId; });
      frei = U.sortBy(frei, function (p) { return -P.gesamt(p); });

      for (var i = 0; i < fehlend; i++) {
        // Welche Position fehlt am dringendsten?
        var pos = schwaechstePosition(world, clubId);
        var passend = frei.filter(function (p) {
          return p.pos === pos && P.gesamt(p) <= P.niveauFuerVerein(club) + 6;
        })[0];
        if (passend) {
          frei = frei.filter(function (p) { return p.id !== passend.id; });
          world.setzeVerein(passend, clubId);
          passend.vertrag = P.vertragErzeugen(rng, passend, club, world, rng.int(1, 3));
          passend.nummer = FM.transfers.freieNummer(world, clubId, 0);
          passend.kaderrolle = P.vorgeschlageneRolle(passend, world.kaderVon(clubId));
          passend.rollenSeit = world.tag;
          continue;
        }
        // Kein passender Freier: ein neuer Spieler kommt in den Markt.
        var neu = P.erzeugeSpieler(rng, {
          pos: pos,
          alter: rng.int(19, 27),
          ziel: U.clamp(P.niveauFuerVerein(club) + rng.gauss(-6, 5), 14, 90),
          clubId: clubId
        });
        neu.vertrag = P.vertragErzeugen(rng, neu, club, world, rng.int(1, 3));
        world.fuegeSpielerHinzu(neu);
        neu.nummer = FM.transfers.freieNummer(world, clubId, 0);
        neu.kaderrolle = P.vorgeschlageneRolle(neu, world.kaderVon(clubId));
        neu.rollenSeit = world.tag;
      }
      var taktik = world.taktiken[clubId];
      if (taktik) T.autoAufstellung(world, club, taktik);
    });
  }

  /** Die Position, auf der ein Kader am duennsten besetzt ist. */
  function schwaechstePosition(world, clubId) {
    var kader = world.kaderVon(clubId);
    var soll = {};
    (P.KADER_SCHEMA || []).forEach(function (e) { soll[e[0]] = e[1]; });
    var zaehler = {};
    D.POSITIONEN.forEach(function (pos) { zaehler[pos] = 0; });
    kader.forEach(function (p) { zaehler[p.pos] = (zaehler[p.pos] || 0) + 1; });
    var beste = null, wenigste = 99;
    D.POSITIONEN.forEach(function (pos) {
      var mindest = soll[pos] !== undefined ? soll[pos] : (pos === 'TW' ? 3 : 2);
      if (zaehler[pos] < mindest && zaehler[pos] < wenigste) { wenigste = zaehler[pos]; beste = pos; }
    });
    if (beste) return beste;
    // Alles besetzt: die Position mit den wenigsten Spielern.
    var sortiert = U.sortBy(D.POSITIONEN, function (pos) { return zaehler[pos]; });
    return sortiert[0];
  }

  function kaderBereinigen(world) {
    world.vereinIds.forEach(function (clubId) {
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var kader = world.kaderVon(clubId).slice();
      var maximal = club.liga === 1 ? 30 : club.liga === 2 ? 29 : 27;
      if (kader.length <= maximal) return;
      // Die schwaechsten Spieler ohne Perspektive gehen zuerst.
      var rang = U.sortBy(kader, function (p) {
        return P.gesamt(p) + Math.max(0, p.potenzial - P.gesamt(p)) * 0.8
          - (p.alter >= 32 ? 8 : 0) + (p.eigengewaechs ? 3 : 0);
      });
      var zuViel = kader.length - maximal;
      for (var i = 0; i < zuViel && i < rang.length; i++) {
        var p = rang[i];
        if (p.leihe) continue;
        if (world.istNutzerVerein(clubId)) { p.transferliste = true; continue; }
        p.exClubId = clubId;
        world.setzeVerein(p, null);
        p.vertrag = null;
        p.nummer = 0;
        p.kapitaen = false;
      }
      var taktik = world.taktiken[clubId];
      if (taktik) T.autoAufstellung(world, club, taktik);
    });
  }

  /** Vertragslose, die keinen Verein mehr finden, beenden ihre Laufbahn. */
  function vertragsloseBereinigen(world) {
    var frei = world.vertragslose();
    frei.forEach(function (p) {
      var st = P.gesamt(p);
      var weg = (p.alter >= 34)
        || (p.alter >= 30 && st < 48)
        || (p.alter >= 26 && st < 38)
        || (st < 30);
      if (weg) world.entferneSpieler(p.id);
    });
    // Notfalls den Rest kappen, damit die Liste ueberschaubar bleibt.
    frei = world.vertragslose();
    if (frei.length > 140) {
      U.sortBy(frei, function (p) { return P.gesamt(p); })
        .slice(0, frei.length - 140)
        .forEach(function (p) { world.entferneSpieler(p.id); });
    }
  }

  /**
   * Ab- und Aufstieg wirken sich auf die Gehaelter aus: Abstiegsklauseln
   * senken die Bezuege, Aufstiegsklauseln heben sie an.
   */
  function gehaelterAnpassen(world, clubId, richtung) {
    var faktor = richtung === 'ab' ? 0.75 : 1.22;
    world.kaderVon(clubId).forEach(function (p) {
      if (!p.vertrag) return;
      p.vertrag.gehalt = Math.max(2000, Math.round(p.vertrag.gehalt * faktor / 500) * 500);
    });
    world.stabVon(clubId).forEach(function (m) {
      m.gehalt = Math.max(600, Math.round(m.gehalt * faktor / 100) * 100);
    });
  }

  function karriereEnde(world, p) {
    if (p.clubId && world.istNutzerVerein(p.clubId)) {
      world.nachricht({
        typ: 'kabine', prioritaet: 2,
        titel: 'Karriereende: ' + p.vorname + ' ' + p.nachname,
        text: p.nachname + ' beendet mit ' + p.alter + ' Jahren seine Laufbahn. ' +
          'In seiner Karriere kam er auf ' + p.karriere.spiele + ' Pflichtspiele und ' +
          p.karriere.tore + ' Tore.'
      });
    }
    world.entferneSpieler(p.id);
  }

  function torschuetzenkoenig(world) {
    var beste = null, max = 0;
    Object.keys(world.statistik.torschuetzen).forEach(function (id) {
      var t = world.statistik.torschuetzen[id];
      var p = world.spieler[id];
      if (!p) return;
      var liga = p.clubId ? world.ligaVon(p.clubId) : null;
      if (!liga || liga.id !== 'bl1') return;
      if (t > max) { max = t; beste = id; }
    });
    return beste ? { spielerId: beste, tore: max, name: nameVon(world, beste) } : null;
  }

  function nameVon(world, id) {
    var p = world.spieler[id];
    return p ? p.vorname + ' ' + p.nachname : '?';
  }

  function ligenUmbauen(world, aufBl1, abBl1, aufBl2, abBl2) {
    var bl1 = world.ligen.bl1, bl2 = world.ligen.bl2, l3 = world.ligen.l3;
    // Doppelte entfernen
    function eindeutig(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
    aufBl1 = eindeutig(aufBl1); abBl1 = eindeutig(abBl1);
    aufBl2 = eindeutig(aufBl2); abBl2 = eindeutig(abBl2);

    bl1.teams = bl1.teams.filter(function (id) { return abBl1.indexOf(id) < 0; }).concat(aufBl1);
    bl2.teams = bl2.teams.filter(function (id) { return aufBl1.indexOf(id) < 0 && abBl2.indexOf(id) < 0; })
      .concat(abBl1).concat(aufBl2);
    l3.teams = l3.teams.filter(function (id) { return aufBl2.indexOf(id) < 0; }).concat(abBl2);

    // Sicherstellen, dass die Ligagroessen stimmen
    while (bl1.teams.length > 18) bl2.teams.push(bl1.teams.pop());
    while (bl2.teams.length > 18) l3.teams.push(bl2.teams.pop());
    while (bl1.teams.length < 18 && bl2.teams.length) bl1.teams.push(bl2.teams.shift());
    while (bl2.teams.length < 18 && l3.teams.length) bl2.teams.push(l3.teams.shift());

    bl1.teams.forEach(function (id) { world.vereine[id].liga = 1; });
    bl2.teams.forEach(function (id) { world.vereine[id].liga = 2; });
    l3.teams.forEach(function (id) { world.vereine[id].liga = 3; });

    // Abstiegs- und Aufstiegsklauseln in den Vertraegen
    abBl1.concat(abBl2).forEach(function (id) { gehaelterAnpassen(world, id, 'ab'); });
    aufBl1.concat(aufBl2).forEach(function (id) { gehaelterAnpassen(world, id, 'auf'); });

    // Meldungen
    if (world.nutzerClubId) {
      if (abBl1.indexOf(world.nutzerClubId) >= 0 || abBl2.indexOf(world.nutzerClubId) >= 0) {
        world.nachricht({
          typ: 'saison', prioritaet: 3,
          titel: 'Abstieg besiegelt',
          text: 'Der Verein muss den Gang eine Liga tiefer antreten. Der Vorstand erwartet ' +
            'einen Kaderumbau und den sofortigen Wiederaufstieg.'
        });
      }
      if (aufBl1.indexOf(world.nutzerClubId) >= 0 || aufBl2.indexOf(world.nutzerClubId) >= 0) {
        world.nachricht({
          typ: 'saison', prioritaet: 3,
          titel: 'Aufstieg geschafft!',
          text: 'Der Verein spielt in der kommenden Saison eine Liga höher. ' +
            'Der Kader wird verstärkt werden müssen.'
        });
      }
    }
  }

  function saisonBilanzNutzer(world, bl1, bl2) {
    var m = world.manager;
    var club = world.nutzerVerein();
    var tabelle = club.liga === 1 ? bl1 : bl2;
    var eintrag = tabelle.filter(function (e) { return e.clubId === club.id; })[0];
    if (!eintrag || !m.saisonziel) return;
    var erreicht = eintrag.platz <= m.saisonziel.platz;
    m.karriere.push({
      saison: world.saison, clubId: club.id, liga: club.liga,
      platz: eintrag.platz, punkte: eintrag.punkte - eintrag.punktabzug,
      ziel: m.saisonziel.text, erreicht: erreicht
    });
    m.vorstandsvertrauen = U.clamp(m.vorstandsvertrauen + (erreicht ? 15 : -18), 0, 100);
    m.ruf = U.clamp(m.ruf + (erreicht ? 5 : -3) + (eintrag.platz <= 3 ? 5 : 0), 1, 99);
    world.nachricht({
      typ: 'vorstand', prioritaet: 3,
      titel: erreicht ? 'Saisonziel erreicht' : 'Saisonziel verfehlt',
      text: 'Abschlussplatz ' + eintrag.platz + ' mit ' + (eintrag.punkte - eintrag.punktabzug) +
        ' Punkten. Vorgabe war: ' + m.saisonziel.text + '. ' +
        (erreicht ? 'Der Vorstand ist zufrieden.' : 'Der Vorstand erwartet eine deutliche Steigerung.')
    });
  }

  function entferneAuslandsvereine(world) {
    var raus = world.vereinIds.filter(function (id) {
      var c = world.vereine[id];
      return c && c.auslaendisch;
    });
    raus.forEach(function (id) {
      world.kaderVon(id).forEach(function (p) { world.entferneSpieler(p.id); });
      delete world.vereine[id];
      delete world.finanzen[id];
      delete world.taktiken[id];
      var i = world.vereinIds.indexOf(id);
      if (i >= 0) world.vereinIds.splice(i, 1);
    });
    world.kaderIndexVerwerfen();
    world.stabIndexVerwerfen();
  }

  FM.engine = {
    tagWeiter: tagWeiter,
    weiterBisEreignis: weiterBisEreignis,
    verarbeiteSpiel: verarbeiteSpiel,
    saisonVorbei: saisonVorbei,
    saisonAbschluss: saisonAbschluss,
    relegationAnsetzen: relegationAnsetzen,
    torschuetzenkoenig: torschuetzenkoenig,
    leereRekorde: leereRekorde,
    kaderAuffuellen: kaderAuffuellen,
    kaderBereinigen: kaderBereinigen,
    leereRekorde: leereRekorde,
    titelVermerken: titelVermerken,
    GELB_SPERRE: GELB_SPERRE
  };

})(typeof window !== 'undefined' ? window : globalThis);
