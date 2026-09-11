/*
 * finance.js - Haushalt eines Vereins.
 *
 * Einnahmen entstehen aus Spieltagserloesen, Fernsehgeld, Sponsoring,
 * Merchandising, Preisgeldern und Transfers. Dagegen stehen Gehaelter,
 * Spielbetrieb, Nachwuchs, Verwaltung und Ablosezahlungen. Am Ende zaehlt
 * die Liquiditaet: Wer sie verliert, bekommt Probleme mit der Lizenz.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;

  // TV-Geld pro Saison in Euro, gestaffelt nach Liga und Platzierung.
  // Angelehnt an die Verteilung der DFL: Bundesliga rund 1,1 Mrd., 2. Liga rund 240 Mio.
  function tvGeld(liga, platz, fuenfJahresWert) {
    if (liga === 1) {
      var basis = 78e6 - (platz - 1) * 2.6e6;          // Platz 1: 78 Mio., Platz 18: 33 Mio.
      basis += (fuenfJahresWert || 0) * 1.1e5;
      return Math.max(28e6, Math.round(basis));
    }
    if (liga === 2) {
      return Math.max(6.5e6, Math.round(17.5e6 - (platz - 1) * 0.62e6));
    }
    return Math.max(0.8e6, Math.round(2.4e6 - (platz - 1) * 0.06e6));
  }

  /** Preisgelder im DFB-Pokal je erreichter Runde. */
  var POKAL_PRAEMIE = {
    1: 209000, 2: 419000, 3: 837000, 4: 1.674e6, 5: 3.349e6, 6: 6.7e6, sieger: 4.32e6
  };

  /** UEFA-Praemien (vereinfacht). */
  var EUROPA_PRAEMIE = {
    CL: { start: 18.62e6, sieg: 2.1e6, remis: 700000, achtel: 11e6, viertel: 12.5e6, halb: 15e6, finale: 18.5e6, titel: 6.5e6 },
    EL: { start: 4.31e6, sieg: 450000, remis: 150000, achtel: 1.75e6, viertel: 2.5e6, halb: 4.4e6, finale: 7e6, titel: 4e6 },
    ECL: { start: 3.17e6, sieg: 400000, remis: 133000, achtel: 800000, viertel: 1.3e6, halb: 2.5e6, finale: 4e6, titel: 3e6 }
  };

  function erzeugeSponsoren(rng, club) {
    // Derselbe Ligafaktor wie beim spaeteren Neuverhandeln: ein Zweitligist
    // bekommt nicht die Vertraege eines Erstligisten.
    var ligaFaktor = club.liga === 1 ? 1 : club.liga === 2 ? 0.42 : 0.14;
    var faktor = Math.pow(club.ruf / 60, 3.1) * (club.fans / 60) * ligaFaktor;
    function betrag(basis, streu) {
      return Math.round(basis * faktor * rng.range(1 - streu, 1 + streu) / 50000) * 50000;
    }
    return {
      trikot: { partner: rng.pick(D.SPONSOREN.trikot), betrag: Math.max(300000, betrag(8.5e6, 0.28)), bis: 0, bonusMeister: 0 },
      aermel: { partner: rng.pick(D.SPONSOREN.aermel), betrag: Math.max(80000, betrag(2.2e6, 0.30)), bis: 0 },
      ausruester: { partner: rng.pick(D.SPONSOREN.ausruester), betrag: Math.max(150000, betrag(5.5e6, 0.35)), bis: 0 },
      stadion: { partner: rng.pick(D.SPONSOREN.stadion), betrag: Math.max(0, betrag(3.2e6, 0.4)), bis: 0 },
      premium: rng.sample(D.SPONSOREN.premium, 4).map(function (n) {
        return { partner: n, betrag: Math.max(50000, betrag(0.9e6, 0.4)) };
      })
    };
  }

  function neueFinanzen(rng, club, world) {
    var sponsoren = erzeugeSponsoren(rng, club);
    var kontostand = Math.round(Math.pow(club.finanz / 55, 3.1) * 12e6 * rng.range(0.55, 1.6) / 100000) * 100000;
    var ticketpreis = club.liga === 1 ? Math.round(28 + club.ruf * 0.32) : club.liga === 2 ? Math.round(17 + club.ruf * 0.20) : 12;

    return {
      kontostand: kontostand,
      transferbudget: 0,
      gehaltsbudget: 0,
      sponsoren: sponsoren,
      ticketpreis: ticketpreis,
      dauerkarten: Math.round(club.kapazitaet * U.clamp(0.35 + club.fans / 260, 0.25, 0.72)),
      merchandisingNiveau: U.clamp(Math.round(club.fans * 0.8 + club.ruf * 0.3), 10, 99),
      raten: [],                 // offene Ablosezahlungen
      forderungen: [],           // erwartete Einnahmen aus Verkaeufen
      buch: [],                  // Buchungen der laufenden Saison
      saisonstart: kontostand,
      umsatzStand: 0,
      jahresbilanz: leereBilanz(),
      letzteSaison: null,
      kredit: { betrag: 0, zins: 0.045, rateWoche: 0 },
      lizenzWarnung: 0
    };
  }

  // Anteil des Umsatzes, der als laufender Geschaeftsaufwand abfliesst.
  var UMSATZKOSTEN = 0.24;

  function leereBilanz() {
    return {
      einnahmen: {
        tv: 0, ticketing: 0, sponsoring: 0, merchandising: 0,
        preisgelder: 0, transfers: 0, sonstige: 0
      },
      ausgaben: {
        spielergehaelter: 0, personalgehaelter: 0, ablosen: 0, spielbetrieb: 0,
        stadion: 0, nachwuchs: 0, verwaltung: 0, scouting: 0, geschaeft: 0,
        zinsen: 0, sonstige: 0
      }
    };
  }

  function buche(world, clubId, art, kategorie, betrag, text) {
    var f = world.finanzen[clubId];
    if (!f) return;
    betrag = Math.round(betrag);
    f.kontostand += art === 'ein' ? betrag : -betrag;
    if (art === 'ein') f.jahresbilanz.einnahmen[kategorie] = (f.jahresbilanz.einnahmen[kategorie] || 0) + betrag;
    else f.jahresbilanz.ausgaben[kategorie] = (f.jahresbilanz.ausgaben[kategorie] || 0) + betrag;
    f.buch.push({ tag: world.tag, art: art, kategorie: kategorie, betrag: betrag, text: text });
    if (f.buch.length > 400) f.buch.shift();
  }

  /** Woechentliche Gehaelter und laufende Kosten. */
  function wocheAbrechnen(world, clubId) {
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    if (!f || !club) return;

    var kader = world.kaderVon(clubId);
    var spielerLohn = 0;
    kader.forEach(function (p) {
      if (!p.vertrag) return;
      var anteil = 1;
      if (p.leihe && p.leihe.vonClubId && p.leihe.gehaltsanteil !== undefined) {
        anteil = p.leihe.gehaltsanteil;
      }
      spielerLohn += p.vertrag.gehalt * anteil;
    });
    // Gehaltsanteile fuer verliehene Spieler
    world.alleSpieler().forEach(function (p) {
      if (p.leihe && p.leihe.vonClubId === clubId && p.clubId !== clubId) {
        spielerLohn += p.vertrag ? p.vertrag.gehalt * (1 - p.leihe.gehaltsanteil) : 0;
      }
    });

    var stabLohn = 0;
    world.stabVon(clubId).forEach(function (m) { stabLohn += m.gehalt; });

    buche(world, clubId, 'aus', 'spielergehaelter', spielerLohn, 'Spielergehälter');
    buche(world, clubId, 'aus', 'personalgehaelter', stabLohn, 'Gehälter Trainerstab und Mitarbeiter');

    // Laufender Betrieb. Der vom Ruf getriebene Teil - Geschaeftsstelle,
    // Marketing, Spielbetrieb - faellt in den unteren Ligen deutlich
    // kleiner aus: ein Zweitligist unterhaelt keinen Erstligaapparat.
    var ligaKosten = club.liga === 1 ? 1 : club.liga === 2 ? 0.55 : 0.30;
    var betrieb = club.kapazitaet * 1.05 + club.ruf * 2400 * ligaKosten;
    var nachwuchs = club.akademie * (club.liga === 1 ? 2100 : club.liga === 2 ? 950 : 320);
    var verwaltung = club.ruf * 2900 * ligaKosten + 22000;
    var scouting = club.scoutingnetz * 620;
    buche(world, clubId, 'aus', 'stadion', betrieb, 'Stadion- und Spielbetrieb');
    buche(world, clubId, 'aus', 'nachwuchs', nachwuchs, 'Nachwuchsleistungszentrum');
    buche(world, clubId, 'aus', 'verwaltung', verwaltung, 'Verwaltung und Geschäftsstelle');
    buche(world, clubId, 'aus', 'scouting', scouting, 'Scoutingnetzwerk');

    // TV-Gelder fliessen als Monatsraten, nicht als Einmalzahlung am
    // Saisonende - sonst waeren alle Vereine die ganze Saison ueber klamm.
    var platz = letzterPlatz(world, clubId);
    var tv = tvGeld(club.liga, platz, club.europapokal);
    buche(world, clubId, 'ein', 'tv', tv / 52, 'Medienerlöse (Wochenanteil)');

    // Sponsoring und Merchandising werden woechentlich anteilig gutgeschrieben.
    var sp = f.sponsoren;
    var jahresSponsoring = sp.trikot.betrag + sp.aermel.betrag + sp.ausruester.betrag + sp.stadion.betrag
      + sp.premium.reduce(function (a, b) { return a + b.betrag; }, 0);
    buche(world, clubId, 'ein', 'sponsoring', jahresSponsoring / 52, 'Sponsoring (Wochenanteil)');

    var merch = Math.pow(f.merchandisingNiveau / 55, 2.4) * 320000
      * (club.liga === 1 ? 1 : club.liga === 2 ? 0.35 : 0.12);
    // Erfolg treibt den Fanartikelverkauf
    var tab = world.tabellenPlatz(clubId);
    if (tab) merch *= U.clamp(1.35 - tab.platz * 0.035, 0.6, 1.4);
    buche(world, clubId, 'ein', 'merchandising', merch / 4.33, 'Merchandising (Wochenanteil)');

    // Kredit
    if (f.kredit.betrag > 0) {
      var zins = f.kredit.betrag * f.kredit.zins / 52;
      var tilgung = Math.min(f.kredit.betrag, f.kredit.rateWoche);
      buche(world, clubId, 'aus', 'zinsen', zins, 'Kreditzinsen');
      if (tilgung > 0) {
        f.kredit.betrag -= tilgung;
        buche(world, clubId, 'aus', 'sonstige', tilgung, 'Kredittilgung');
      }
    }

    // Umsatzabhaengige Kosten: Vertrieb und Marketing, Reisen, Beraterhonorare,
    // Abschreibungen auf Abloesen und Abgaben. Dieser Block waechst mit dem
    // Geschaeft - wer mehr einnimmt, gibt auch mehr aus. Ohne ihn haetten
    // Vereine Jahr fuer Jahr zweistellige Millionenueberschuesse.
    var umsatzJetzt = 0;
    Object.keys(f.jahresbilanz.einnahmen).forEach(function (k) {
      if (k !== 'transfers') umsatzJetzt += f.jahresbilanz.einnahmen[k];
    });
    if (f.umsatzStand === undefined) f.umsatzStand = umsatzJetzt;   // aeltere Spielstaende
    var zuwachs = Math.max(0, umsatzJetzt - f.umsatzStand);
    f.umsatzStand = umsatzJetzt;
    if (zuwachs > 0) {
      buche(world, clubId, 'aus', 'geschaeft', zuwachs * UMSATZKOSTEN,
        'Vertrieb, Reisen, Berater und Abschreibungen');
    }

    // Faellige Ablosezahlungen
    f.raten = f.raten.filter(function (r) {
      if (r.faellig <= world.tag) {
        buche(world, clubId, 'aus', 'ablosen', r.betrag, 'Ablöserate: ' + r.text);
        return false;
      }
      return true;
    });
    f.forderungen = f.forderungen.filter(function (r) {
      if (r.faellig <= world.tag) {
        buche(world, clubId, 'ein', 'transfers', r.betrag, 'Ablöserate erhalten: ' + r.text);
        return false;
      }
      return true;
    });
  }

  /**
   * Platzierung, nach der sich die Medienerloese richten: solange die
   * laufende Saison jung ist, zaehlt die Abschlusstabelle der Vorsaison.
   */
  function letzterPlatz(world, clubId) {
    var eintrag = world.tabellenPlatz(clubId);
    if (eintrag && eintrag.spiele >= 10) return eintrag.platz;
    var vor = world.letzteAbschlussTabelle ? world.letzteAbschlussTabelle(clubId) : null;
    if (vor) return vor.platz;
    return eintrag ? eintrag.platz : 10;
  }

  /** Spieltagseinnahmen inklusive Gaesteanteil und Catering. */
  function spieltagseinnahmen(world, clubId, zuschauer, wettbewerb) {
    var f = world.finanzen[clubId];
    var club = world.vereine[clubId];
    if (!f) return 0;
    var dauerkarten = Math.min(f.dauerkarten, zuschauer);
    var tageskarten = Math.max(0, zuschauer - dauerkarten);
    // Dauerkarten sind bereits vorab bezahlt, werden hier anteilig gebucht.
    var preis = f.ticketpreis;
    var faktor = wettbewerb === 'pokal' ? 1.15 : wettbewerb === 'europa' ? 1.45 : 1;
    var ticket = (dauerkarten * preis * 0.82 + tageskarten * preis) * faktor;
    var catering = zuschauer * 6.2;
    var hospitality = Math.min(zuschauer * 0.04, club.kapazitaet * 0.04) * 95;
    var gesamt = ticket + catering + hospitality;
    buche(world, clubId, 'ein', 'ticketing', gesamt,
      'Spieltagserlöse (' + U.num(zuschauer) + ' Zuschauer)');
    return gesamt;
  }

  /**
   * Zuschauerzahl: Kapazitaet, Erfolg, Gegner, Wetter, Ticketpreis und
   * Wochentag bestimmen, wie voll es wird.
   */
  function zuschauer(world, spiel, wetter, rng) {
    var heim = world.vereine[spiel.heimId];
    var gast = world.vereine[spiel.gastId];
    var f = world.finanzen[spiel.heimId];
    if (!heim) return 0;

    var basis = U.clamp(0.42 + heim.fans / 190, 0.35, 0.98);
    // Sportlicher Erfolg
    var tab = world.tabellenPlatz(spiel.heimId);
    if (tab) {
      var liga = world.ligaVon(spiel.heimId);
      var teams = liga ? liga.teams.length : 18;
      basis *= U.clamp(1.22 - (tab.platz / teams) * 0.42, 0.80, 1.20);
      if (tab.spiele >= 4) {
        var punkteSchnitt = tab.punkte / tab.spiele;
        basis *= U.clamp(0.86 + punkteSchnitt * 0.13, 0.86, 1.14);
      }
    }
    // Attraktivitaet des Gegners
    if (gast) basis *= U.clamp(0.86 + gast.ruf / 380, 0.86, 1.16);
    // Preisgestaltung
    if (f) {
      var normal = heim.liga === 1 ? 28 + heim.ruf * 0.32 : 17 + heim.ruf * 0.20;
      basis *= U.clamp(1.28 - (f.ticketpreis / Math.max(1, normal)) * 0.28, 0.55, 1.16);
    }
    // Wettbewerb
    if (spiel.wettbewerb === 'europa') basis *= 1.10;
    if (spiel.wettbewerb === 'pokal') basis *= 0.94;
    // Derby: ausverkauft ist die Regel, nicht die Ausnahme
    var riv = D.rivalitaet(spiel.heimId, spiel.gastId);
    if (riv) basis *= 1 + riv.stufe * 0.045;
    // Wetter und Anstosszeit
    if (wetter) basis *= wetter.zuschauer;
    var wt = U.weekday(spiel.tag);
    if (wt === 1 || wt === 2 || wt === 3) basis *= 0.94;   // englische Wochen
    basis *= rng ? rng.range(0.96, 1.04) : 1;

    return Math.min(heim.kapazitaet, Math.max(500, Math.round(heim.kapazitaet * U.clamp(basis, 0.12, 1))));
  }

  /** Budgetvorgabe des Vorstands zu Saisonbeginn. */
  function setzeBudgets(world, clubId) {
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    if (!f) return;
    var erwarteteEinnahmen = jahresPrognose(world, clubId);
    var lohnkosten = wochenLohnsumme(world, clubId) * 52;
    var spielraum = erwarteteEinnahmen * (1 - UMSATZKOSTEN) - lohnkosten
      - laufendeKosten(world, clubId) * 52;
    var transfer = Math.max(0, spielraum * 0.55 + f.kontostand * 0.30);
    // Vorsichtige Vereine halten mehr zurueck.
    transfer *= U.clamp(club.finanz / 70, 0.45, 1.35);
    // Wer im Minus steht, darf nicht weiter einkaufen.
    if (f.kontostand < 0) transfer *= U.clamp(1 + f.kontostand / Math.max(1e6, erwarteteEinnahmen * 0.3), 0, 1);
    f.transferbudget = Math.round(Math.max(0, transfer) / 100000) * 100000;
    // Der Gehaltsrahmen richtet sich danach, was der Verein traegt, nicht
    // danach, was er bisher gezahlt hat. Sonst schreibt sich jede Ueberzahlung
    // Jahr fuer Jahr fort und der Verein rutscht immer tiefer ins Minus.
    var tragbar = erwarteteEinnahmen * 0.50 / 52;
    f.gehaltsbudget = Math.round(Math.max(tragbar, lohnkosten / 52 * 0.90) / 500) * 500;
  }

  function wochenLohnsumme(world, clubId) {
    var s = 0;
    world.kaderVon(clubId).forEach(function (p) {
      if (p.vertrag) s += p.vertrag.gehalt * (p.leihe && p.leihe.vonClubId ? p.leihe.gehaltsanteil : 1);
    });
    world.stabVon(clubId).forEach(function (m) { s += m.gehalt; });
    return s;
  }

  function laufendeKosten(world, clubId) {
    var club = world.vereine[clubId];
    var ligaKosten = club.liga === 1 ? 1 : club.liga === 2 ? 0.55 : 0.30;
    return club.kapazitaet * 1.05 + club.ruf * 2400 * ligaKosten
      + club.akademie * (club.liga === 1 ? 2100 : club.liga === 2 ? 950 : 320)
      + club.ruf * 2900 * ligaKosten + 22000 + club.scoutingnetz * 620;
  }

  function jahresPrognose(world, clubId) {
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    var tab = world.tabellenPlatz(clubId);
    var platz = tab ? tab.platz : 10;
    var tv = tvGeld(club.liga, platz, club.europapokal);
    var sp = f.sponsoren;
    var sponsoring = sp.trikot.betrag + sp.aermel.betrag + sp.ausruester.betrag + sp.stadion.betrag
      + sp.premium.reduce(function (a, b) { return a + b.betrag; }, 0);
    var heimspiele = club.liga <= 2 ? 17 : 19;
    var schnittZuschauer = club.kapazitaet * U.clamp(0.45 + club.fans / 200, 0.3, 0.95);
    var ticketing = heimspiele * schnittZuschauer * (f.ticketpreis * 0.9 + 6.2);
    var merch = Math.pow(f.merchandisingNiveau / 55, 2.4) * 320000 * 12
      * (club.liga === 1 ? 1 : club.liga === 2 ? 0.35 : 0.12);
    // Praemien aus dem Europapokal sind fuer die Spitzenvereine ein
    // erheblicher Posten. Der Haushalt rechnet mit dem Vorjahr; ohne
    // Vorjahr dient der Fuenfjahreswert als Anhalt.
    var praemien = 0;
    if (f.letzteSaison && f.letzteSaison.einnahmen) {
      praemien = (f.letzteSaison.einnahmen.preisgelder || 0) * 0.85;
    } else if (club.europapokal) {
      praemien = Math.min(75e6, club.europapokal * 1.05e6);
    }
    return tv + sponsoring + ticketing + merch + praemien;
  }

  /** Neuverhandlung der Sponsorenvertraege (jaehrlich im Sommer). */
  function sponsorenNeuVerhandeln(world, clubId, rng) {
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    var tab = world.letzteAbschlussTabelle ? world.letzteAbschlussTabelle(clubId) : null;
    var erfolg = tab ? U.clamp(1.30 - tab.platz * 0.032, 0.72, 1.30) : 1;
    var ligaFaktor = club.liga === 1 ? 1 : club.liga === 2 ? 0.42 : 0.14;
    var faktor = erfolg * rng.range(0.94, 1.10);

    ['trikot', 'aermel', 'ausruester', 'stadion'].forEach(function (k) {
      var alt = f.sponsoren[k].betrag;
      var basisFaktor = Math.pow(club.ruf / 60, 3.1) * (club.fans / 60) * ligaFaktor;
      var basis = { trikot: 8.5e6, aermel: 2.2e6, ausruester: 5.5e6, stadion: 3.2e6 }[k];
      var neu = basis * basisFaktor * faktor;
      // Vertraege veraendern sich nur gedaempft.
      f.sponsoren[k].betrag = Math.max(k === 'stadion' ? 0 : 50000,
        Math.round((alt * 0.55 + neu * 0.45) / 50000) * 50000);
      if (rng.chance(0.22)) f.sponsoren[k].partner = rng.pick(D.SPONSOREN[k === 'ausruester' ? 'ausruester' : k]);
    });
    return f.sponsoren;
  }

  /** Ausbau von Stadion und Infrastruktur. */
  var AUSBAU_PROJEKTE = {
    stadion: {
      name: 'Stadionausbau', beschreibung: 'Erweitert die Kapazität um 20 %.',
      kosten: function (club) { return Math.round(club.kapazitaet * 0.20 * 3200); },
      dauer: 420,
      anwenden: function (club) { club.kapazitaet = Math.round(club.kapazitaet * 1.20); }
    },
    trainingszentrum: {
      name: 'Trainingszentrum modernisieren', beschreibung: 'Bessere Trainingsergebnisse für den gesamten Kader.',
      kosten: function (club) { return Math.round((110 - club.trainingszentrum) * 240000 + 2e6); },
      dauer: 300,
      anwenden: function (club) { club.trainingszentrum = U.clamp(club.trainingszentrum + 12, 1, 99); }
    },
    akademie: {
      name: 'Nachwuchsleistungszentrum ausbauen', beschreibung: 'Stärkere Jahrgänge aus der eigenen Jugend.',
      kosten: function (club) { return Math.round((110 - club.akademie) * 210000 + 1.6e6); },
      dauer: 365,
      anwenden: function (club) { club.akademie = U.clamp(club.akademie + 12, 1, 99); }
    },
    medizin: {
      name: 'Medizinische Abteilung ausbauen', beschreibung: 'Kürzere Ausfallzeiten, weniger Rückschläge.',
      kosten: function (club) { return Math.round((110 - club.medizin) * 150000 + 900000); },
      dauer: 210,
      anwenden: function (club) { club.medizin = U.clamp(club.medizin + 12, 1, 99); }
    },
    scouting: {
      name: 'Scoutingnetzwerk erweitern', beschreibung: 'Mehr und genauere Berichte über Spieler weltweit.',
      kosten: function (club) { return Math.round((110 - club.scoutingnetz) * 120000 + 700000); },
      dauer: 180,
      anwenden: function (club) { club.scoutingnetz = U.clamp(club.scoutingnetz + 12, 1, 99); }
    }
  };

  FM.finance = {
    neueFinanzen: neueFinanzen,
    leereBilanz: leereBilanz,
    buche: buche,
    wocheAbrechnen: wocheAbrechnen,
    spieltagseinnahmen: spieltagseinnahmen,
    zuschauer: zuschauer,
    tvGeld: tvGeld,
    letzterPlatz: letzterPlatz,
    setzeBudgets: setzeBudgets,
    wochenLohnsumme: wochenLohnsumme,
    laufendeKosten: laufendeKosten,
    jahresPrognose: jahresPrognose,
    sponsorenNeuVerhandeln: sponsorenNeuVerhandeln,
    erzeugeSponsoren: erzeugeSponsoren,
    POKAL_PRAEMIE: POKAL_PRAEMIE,
    EUROPA_PRAEMIE: EUROPA_PRAEMIE,
    AUSBAU_PROJEKTE: AUSBAU_PROJEKTE
  };

})(typeof window !== 'undefined' ? window : globalThis);
