/**
 * Auszeichnungen: Spieler und Trainer des Monats, Ehrungen zum
 * Saisonende und die Elf der Saison.
 *
 * Bewertet wird immer der Zeitraum, nicht die Gesamtsaison. Dafuer wird
 * zu Monatsbeginn ein Stand der Statistiken festgehalten und am Monatsende
 * die Differenz gebildet - so zaehlt fuer die Ehrung des Monats nur, was
 * in diesem Monat auch passiert ist.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  var LIGEN = [
    { id: 'bl1', name: '1. Bundesliga' },
    { id: 'bl2', name: '2. Bundesliga' }
  ];

  // ------------------------------------------------------------ Grundlage

  function stelleDatenBereit(world) {
    var st = world.statistik;
    if (!st.auszeichnungen) st.auszeichnungen = [];
    if (!st.monatsBasis) st.monatsBasis = {};
    if (st.monatsMarke === undefined) st.monatsMarke = null;
    return st;
  }

  /** Alle Spieler der beiden Bundesligen. */
  function ligaSpieler(world, ligaId) {
    var liga = world.ligen[ligaId];
    if (!liga) return [];
    var raus = [];
    liga.teams.forEach(function (clubId) {
      world.kaderVon(clubId).forEach(function (p) { raus.push(p); });
    });
    return raus;
  }

  function standVon(p) {
    // Auch der Monatsvergleich zaehlt nur Ligaspiele.
    var st = p.ligaStats || p.stats;
    return [st.spiele, st.tore, st.vorlagen, st.notenSumme, st.notenAnzahl, st.zuNull];
  }

  function standSichern(world) {
    var st = stelleDatenBereit(world);
    st.monatsBasis = {};
    LIGEN.forEach(function (l) {
      ligaSpieler(world, l.id).forEach(function (p) {
        st.monatsBasis[p.id] = standVon(p);
      });
    });
    st.monatsMarke = U.fromDay(world.tag).m;
  }

  /** Was ein Spieler seit der letzten Marke geleistet hat. */
  function differenz(world, p) {
    var basis = world.statistik.monatsBasis[p.id] || [0, 0, 0, 0, 0, 0];
    var jetzt = standVon(p);
    return {
      spiele: jetzt[0] - basis[0],
      tore: jetzt[1] - basis[1],
      vorlagen: jetzt[2] - basis[2],
      notenSumme: jetzt[3] - basis[3],
      notenAnzahl: jetzt[4] - basis[4],
      zuNull: jetzt[5] - basis[5]
    };
  }

  // ------------------------------------------------------------ Monat

  /**
   * Prueft bei jedem Tageswechsel, ob ein Monat zu Ende gegangen ist.
   * Beim ersten Aufruf wird nur die Marke gesetzt.
   */
  function tagesPruefung(world) {
    var st = stelleDatenBereit(world);
    var monat = U.fromDay(world.tag).m;
    if (st.monatsMarke === null) { standSichern(world); return null; }
    if (monat === st.monatsMarke) return null;
    var vergangen = st.monatsMarke;
    var ergebnisse = monatsAbschluss(world, vergangen);
    standSichern(world);
    return ergebnisse;
  }

  /** Kuert Spieler und Trainer des Monats in beiden Ligen. */
  function monatsAbschluss(world, monat) {
    var raus = [];
    LIGEN.forEach(function (l) {
      var spieler = spielerDesMonats(world, l.id);
      if (spieler) raus.push(vermerke(world, {
        typ: 'spielerDesMonats', ligaId: l.id, ligaName: l.name, monat: monat,
        spielerId: spieler.p.id, clubId: spieler.p.clubId,
        titel: 'Spieler des Monats ' + U.MONATE[monat - 1] + ' (' + l.name + ')',
        text: spieler.p.vorname + ' ' + spieler.p.nachname + ' (' +
          world.vereine[spieler.p.clubId].name + ') - ' + spieler.d.spiele + ' Spiele, ' +
          spieler.d.tore + ' Tore, ' + spieler.d.vorlagen + ' Vorlagen, Note ' +
          U.note(spieler.schnitt) + '.'
      }));
      var trainer = trainerDesMonats(world, l.id, monat);
      if (trainer) raus.push(vermerke(world, {
        typ: 'trainerDesMonats', ligaId: l.id, ligaName: l.name, monat: monat,
        clubId: trainer.clubId,
        titel: 'Trainer des Monats ' + U.MONATE[monat - 1] + ' (' + l.name + ')',
        text: world.vereine[trainer.clubId].name + ' holte ' + trainer.punkte +
          ' Punkte aus ' + trainer.spiele + ' Spielen.'
      }));
    });
    return raus;
  }

  function spielerDesMonats(world, ligaId) {
    var beste = null;
    ligaSpieler(world, ligaId).forEach(function (p) {
      var d = differenz(world, p);
      if (d.spiele < 2 || d.notenAnzahl < 2) return;
      var schnitt = d.notenSumme / d.notenAnzahl;
      // Deutsche Notenskala: kleiner ist besser.
      var punkte = (4.0 - schnitt) * 10 + d.tore * 3.2 + d.vorlagen * 1.8;
      if (p.pos === 'TW') punkte += d.zuNull * 2.6;
      if (!beste || punkte > beste.punkte) {
        beste = { p: p, d: d, schnitt: schnitt, punkte: punkte };
      }
    });
    return beste;
  }

  function trainerDesMonats(world, ligaId, monat) {
    var liga = world.ligen[ligaId];
    if (!liga) return null;
    var konto = {};
    liga.teams.forEach(function (id) { konto[id] = { punkte: 0, spiele: 0, tore: 0 }; });
    world.spiele.forEach(function (s) {
      if (!s.gespielt || s.wettbewerb !== 'liga' || s.ligaId !== ligaId) return;
      if (U.fromDay(s.tag).m !== monat) return;
      var h = konto[s.heimId], g = konto[s.gastId];
      if (!h || !g) return;
      h.spiele += 1; g.spiele += 1;
      h.tore += s.ergebnis.heimTore - s.ergebnis.gastTore;
      g.tore += s.ergebnis.gastTore - s.ergebnis.heimTore;
      if (s.ergebnis.heimTore > s.ergebnis.gastTore) h.punkte += 3;
      else if (s.ergebnis.heimTore < s.ergebnis.gastTore) g.punkte += 3;
      else { h.punkte += 1; g.punkte += 1; }
    });
    var beste = null;
    Object.keys(konto).forEach(function (id) {
      var k = konto[id];
      if (k.spiele < 2) return;
      var club = world.vereine[id];
      if (!club) return;
      // Gemessen wird an der Erwartung: ein Aussenseiter braucht weniger
      // Punkte fuer dieselbe Leistung als ein Titelanwaerter.
      var erwartet = k.spiele * (0.9 + club.ruf / 100);
      var wert = k.punkte - erwartet + k.tore * 0.12;
      if (!beste || wert > beste.wert) beste = { clubId: id, wert: wert, punkte: k.punkte, spiele: k.spiele };
    });
    return beste;
  }

  // ------------------------------------------------------------ Saison

  /** Alle Ehrungen zum Saisonende. */
  function saisonAuszeichnungen(world) {
    var raus = [];
    LIGEN.forEach(function (l) {
      var kandidaten = [];
      ligaSpieler(world, l.id).forEach(function (p) {
        // Ehrungen einer Liga richten sich nach Ligaspielen, nicht nach
        // Pokal- und Europapokalpartien.
        var st = p.ligaStats || p.stats;
        if (st.spiele < 12 || st.notenAnzahl < 10) return;
        var schnitt = st.notenSumme / st.notenAnzahl;
        var punkte = (4.0 - schnitt) * 12 + st.tore * 1.6 + st.vorlagen * 1.0;
        if (p.pos === 'TW') punkte += st.zuNull * 1.8;
        kandidaten.push({ p: p, st: st, punkte: punkte, schnitt: schnitt });
      });
      if (!kandidaten.length) return;
      kandidaten.sort(function (a, b) { return b.punkte - a.punkte; });

      raus.push(ehre(world, kandidaten[0].p, {
        typ: 'spielerDerSaison', ligaId: l.id, ligaName: l.name,
        titel: 'Spieler der Saison (' + l.name + ')'
      }));

      var tw = kandidaten.filter(function (k) { return k.p.pos === 'TW'; })[0];
      if (tw) raus.push(ehre(world, tw.p, {
        typ: 'torwartDerSaison', ligaId: l.id, ligaName: l.name,
        titel: 'Torwart der Saison (' + l.name + ')'
      }));

      var jung = kandidaten.filter(function (k) { return k.p.alter <= 21; })[0];
      if (jung) raus.push(ehre(world, jung.p, {
        typ: 'nachwuchsDerSaison', ligaId: l.id, ligaName: l.name,
        titel: 'Bester Nachwuchsspieler (' + l.name + ')'
      }));

      var torjaeger = kandidaten.slice().sort(function (a, b) {
        return b.st.tore - a.st.tore;
      })[0];
      if (torjaeger && torjaeger.st.tore > 0) raus.push(ehre(world, torjaeger.p, {
        typ: 'torjaeger', ligaId: l.id, ligaName: l.name,
        titel: 'Torjägerkanone (' + l.name + ')',
        zusatz: U.pl(torjaeger.st.tore, 'Tor', 'Tore')
      }));

      var elf = elfDerSaison(world, l.id);
      if (elf.length === 11) {
        vermerke(world, {
          typ: 'elfDerSaison', ligaId: l.id, ligaName: l.name,
          titel: 'Elf der Saison (' + l.name + ')',
          text: elf.map(function (p) { return p.nachname; }).join(', '),
          spielerIds: elf.map(function (p) { return p.id; })
        });
        elf.forEach(function (p) {
          notiereEhrung(world, p, 'Elf der Saison (' + l.name + ')');
        });
      }
    });
    return raus;
  }

  /**
   * Stellt die beste Elf der Saison in einem 4-3-3 auf: je Zone die
   * Spieler mit der besten Saisonbewertung.
   */
  function elfDerSaison(world, ligaId) {
    var schema = [['TW', 1], ['ABW', 4], ['MIT', 3], ['ANG', 3]];
    var bewertet = [];
    ligaSpieler(world, ligaId).forEach(function (p) {
      var st = p.ligaStats || p.stats;
      if (st.spiele < 10 || st.notenAnzahl < 8) return;
      var schnitt = st.notenSumme / st.notenAnzahl;
      var punkte = (4.0 - schnitt) * 12 + st.tore * 1.4 + st.vorlagen * 0.9;
      if (p.pos === 'TW') punkte += st.zuNull * 1.8;
      bewertet.push({ p: p, punkte: punkte, gruppe: p.pos === 'TW' ? 'TW' : D.POS_GRUPPE[p.pos] });
    });
    bewertet.sort(function (a, b) { return b.punkte - a.punkte; });
    var elf = [];
    schema.forEach(function (teil) {
      var n = 0;
      for (var i = 0; i < bewertet.length && n < teil[1]; i++) {
        if (bewertet[i].gruppe !== teil[0]) continue;
        if (elf.indexOf(bewertet[i].p) >= 0) continue;
        elf.push(bewertet[i].p);
        n++;
      }
    });
    return elf;
  }

  // ------------------------------------------------------------ Ablage

  function vermerke(world, eintrag) {
    var st = stelleDatenBereit(world);
    eintrag.saison = world.saison;
    eintrag.tag = world.tag;
    st.auszeichnungen.unshift(eintrag);
    if (st.auszeichnungen.length > 200) st.auszeichnungen.pop();

    var betrifftNutzer = eintrag.clubId && world.istNutzerVerein(eintrag.clubId);
    if (!betrifftNutzer && eintrag.spielerId) {
      var sp = world.spieler[eintrag.spielerId];
      betrifftNutzer = sp && world.istNutzerVerein(sp.clubId);
    }
    // Nur melden, was den eigenen Verein angeht. Alles andere steht in
    // der Ehrentafel unter Statistik - im Postfach waere es Rauschen.
    if (betrifftNutzer) {
      world.nachricht({
        typ: 'medien', prioritaet: 3,
        titel: eintrag.titel, text: eintrag.text || ''
      });
    }
    return eintrag;
  }

  function ehre(world, p, opts) {
    var club = p.clubId ? world.vereine[p.clubId] : null;
    var text = p.vorname + ' ' + p.nachname + (club ? ' (' + club.name + ')' : '') +
      (opts.zusatz ? ' - ' + opts.zusatz : '') + '.';
    notiereEhrung(world, p, opts.titel);
    return vermerke(world, {
      typ: opts.typ, ligaId: opts.ligaId, ligaName: opts.ligaName,
      spielerId: p.id, clubId: p.clubId, titel: opts.titel, text: text
    });
  }

  function notiereEhrung(world, p, titel) {
    if (!p.ehrungen) p.ehrungen = [];
    p.ehrungen.push({ saison: world.saison, titel: titel });
    if (p.ehrungen.length > 40) p.ehrungen.shift();
  }

  /** Auszeichnungen eines Vereins oder Spielers, neueste zuerst. */
  function auszeichnungenVon(world, opts) {
    var st = stelleDatenBereit(world);
    return st.auszeichnungen.filter(function (a) {
      if (opts.ligaId && a.ligaId !== opts.ligaId) return false;
      if (opts.clubId && a.clubId !== opts.clubId) return false;
      if (opts.spielerId && a.spielerId !== opts.spielerId) return false;
      if (opts.saison !== undefined && a.saison !== opts.saison) return false;
      if (opts.typ && a.typ !== opts.typ) return false;
      return true;
    });
  }

  FM.awards = {
    tagesPruefung: tagesPruefung,
    monatsAbschluss: monatsAbschluss,
    saisonAuszeichnungen: saisonAuszeichnungen,
    elfDerSaison: elfDerSaison,
    auszeichnungenVon: auszeichnungenVon,
    standSichern: standSichern
  };

})(typeof window !== 'undefined' ? window : globalThis);
