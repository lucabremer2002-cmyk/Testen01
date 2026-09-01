/* finance.js - Vereinsfinanzen: Sponsoring, Stadion, Zuschauer, Bankkredite.
 * Die Sponsorennamen sind frei erfunden. */
(function (g) {
  'use strict';

  var SPONSOR_NAMEN = {
    haupt: ['Nordheim Bank', 'Vertiga Energie', 'Kaufring24', 'Wesertal Versicherung', 'BluePeak Mobility',
      'Stadtwerke Union', 'Cortexa Software', 'Hansa Logistik', 'Ferrostark AG', 'Nova Telekom',
      'Alpenglück Molkerei', 'Rheinmark Immobilien', 'Titanwerk Stahl', 'Solaris Energie', 'PrimeCar Leasing',
      'Kranzberg Brauerei', 'Vitalis Krankenkasse', 'Elbfracht Spedition', 'Auroris Pharma', 'Dachsberg Baustoffe'],
    aermel: ['Frischgold', 'Meridian Reisen', 'Bitwerk', 'Sparhaus', 'Kraftquell', 'Vulcan Tools',
      'Ostwind Versicherung', 'Copperline', 'Sanolis', 'Weststrom', 'Pixelbau', 'Feldmann Küchen'],
    ausruester: ['Kestros', 'Aveno Sport', 'Torlinie', 'Rapidus', 'Volanta', 'Panthero', 'Nordwind Athletics',
      'Grenzstein Sports', 'Fabrio', 'Ultima Sportswear'],
    stadionname: ['Nordheim Arena', 'Vertiga Park', 'Solaris Stadion', 'BluePeak Arena', 'Hansa Park',
      'Kranzberg Arena', 'Titanwerk Stadion', 'Meridian Arena', 'Weststrom Park', 'Auroris Arena']
  };

  var SLOTS = [
    { id: 'haupt', name: 'Hauptsponsor (Trikotbrust)', anteil: 1.00 },
    { id: 'aermel', name: 'Ärmelsponsor', anteil: 0.22 },
    { id: 'ausruester', name: 'Ausrüster', anteil: 0.35 },
    { id: 'stadionname', name: 'Stadionname', anteil: 0.30 }
  ];

  var MODULE = [
    { id: 'rasenheizung', name: 'Rasenheizung', kosten: 650000, tage: 45, unterhalt: 1200,
      text: 'Pflicht für die Lizenz ab der 3. Liga. Verhindert Spielausfälle.' },
    { id: 'videowand', name: 'Videowand', kosten: 1400000, tage: 40, unterhalt: 900,
      text: '+3 % Zuschauer, bessere Stimmung im Stadion.' },
    { id: 'gastronomie', name: 'Gastronomie-Ausbau', kosten: 2800000, tage: 70, unterhalt: 2600,
      text: '+12 % Einnahmen an Heimspieltagen.' },
    { id: 'parkhaus', name: 'Parkhaus', kosten: 4500000, tage: 110, unterhalt: 2200,
      text: '+5 % Zuschauer, +4 % Spieltagseinnahmen.' },
    { id: 'fanshop', name: 'Großer Fanshop', kosten: 1900000, tage: 55, unterhalt: 1800,
      text: '+25 % Merchandising.' },
    { id: 'logen', name: 'Business-Logen', kosten: 6200000, tage: 130, unterhalt: 4200,
      text: 'Wandelt 3 % der Plätze in hochpreisige VIP-Plätze um.' },
    { id: 'trainingszentrum', name: 'Leistungszentrum', kosten: 8500000, tage: 180, unterhalt: 9000,
      text: 'Bessere Spielerentwicklung und weniger Verletzungen.' },
    { id: 'flutlicht', name: 'Modernes Flutlicht', kosten: 900000, tage: 35, unterhalt: 700,
      text: 'Pflicht für Abendspiele in den Profiligen.' }
  ];

  /* Referenzpreise je Ligastufe (Steh / Sitz / VIP). */
  var PREIS_REFERENZ = {
    1: { steh: 16, sitz: 42, vip: 210 },
    2: { steh: 13, sitz: 30, vip: 150 },
    3: { steh: 10, sitz: 20, vip: 85 },
    4: { steh: 8, sitz: 13, vip: 45 }
  };

  function sponsorWert(ruf, slotAnteil, stufe) {
    var basis = 150000000 * Math.pow(Math.max(12, ruf) / 96, 6.6);
    var stufenBonus = stufe === 1 ? 1.0 : (stufe === 2 ? 0.82 : (stufe === 3 ? 0.7 : 0.6));
    return basis * slotAnteil * stufenBonus;
  }

  function grundNachfrage(ruf) {
    return 90000 * Math.pow(Math.max(10, ruf) / 96, 2.87);
  }

  function stadionAufsetzen(klub) {
    var kap = klub.kapazitaet;
    var steh = Math.round(kap * 0.38), vip = Math.round(kap * 0.03);
    var sitz = kap - steh - vip;
    var ref = PREIS_REFERENZ[klub.stufe] || PREIS_REFERENZ[4];
    return {
      name: klub.stadion,
      originalName: klub.stadion,
      sektoren: {
        steh: { plaetze: steh, preis: ref.steh },
        sitz: { plaetze: sitz, preis: ref.sitz },
        vip: { plaetze: vip, preis: ref.vip }
      },
      module: {},
      ausbau: null,
      zuletztZuschauer: 0
    };
  }

  function kapazitaet(stadion) {
    var s = stadion.sektoren;
    return s.steh.plaetze + s.sitz.plaetze + s.vip.plaetze;
  }

  function finanzenAufsetzen(rng, klub, stufe) {
    klub.stufe = stufe;
    var jahresUmsatz = sponsorWert(klub.ruf, 1.87, stufe) + grundNachfrage(klub.ruf) * 17 * 22;
    return {
      /* Kleine Vereine brauchen im Verhaeltnis mehr Rücklage, weil ein
         einzelner ausgefallener Heimspieltag sie sonst umwirft. */
      kontostand: Math.round(jahresUmsatz * rng.float(0.10, 0.22) *
        (stufe >= 4 ? 1.9 : (stufe === 3 ? 1.45 : 1))),
      transferbudget: 0,
      gehaltsbudget: 0,
      sponsoren: { haupt: null, aermel: null, ausruester: null, stadionname: null },
      sponsorAngebote: {},
      stadion: stadionAufsetzen(klub),
      kredite: [],
      verpflichtungen: [],
      buchungen: [],
      saison: { einnahmen: {}, ausgaben: {} },
      gesamt: { einnahmen: 0, ausgaben: 0 },
      dispoTage: 0,
      punktabzugGedroht: false
    };
  }

  function buchen(fin, tag, art, text, betrag, kategorie) {
    fin.kontostand += betrag;
    fin.buchungen.push({ tag: tag, art: art, text: text, betrag: Math.round(betrag) });
    if (fin.buchungen.length > 400) fin.buchungen.shift();
    var topf = betrag >= 0 ? fin.saison.einnahmen : fin.saison.ausgaben;
    var k = kategorie || art;
    topf[k] = (topf[k] || 0) + Math.abs(betrag);
    if (betrag >= 0) fin.gesamt.einnahmen += betrag; else fin.gesamt.ausgaben += -betrag;
  }

  /* ---- Sponsoring ---------------------------------------------------- */

  function angeboteErzeugen(rng, klub, fin, slotId, saison, stufe, erfolgsfaktor) {
    var slot = Util.byId(SLOTS, slotId);
    var basis = sponsorWert(klub.ruf, slot.anteil, stufe) * (erfolgsfaktor || 1);
    var namen = SPONSOR_NAMEN[slotId].slice();
    rng.shuffle(namen);
    var angebote = [];
    var profile = [
      { jahre: 1, fix: 1.12, bonus: 0.5, label: 'kurz & hoch' },
      { jahre: 3, fix: 1.00, bonus: 1.0, label: 'ausgewogen' },
      { jahre: 5, fix: 0.88, bonus: 1.7, label: 'lang & erfolgsabhängig' }
    ];
    profile.forEach(function (pf, i) {
      var fix = Math.round(basis * pf.fix * rng.float(0.88, 1.14) / 1000) * 1000;
      var siegBonus = Math.round(fix * 0.012 * pf.bonus / 100) * 100;
      angebote.push({
        id: slotId + '_' + saison + '_' + i,
        slot: slotId,
        firma: namen[i],
        jahre: pf.jahre,
        fixJahr: fix,
        siegBonus: siegBonus,
        titelBonus: Math.round(fix * 0.35 * pf.bonus / 1000) * 1000,
        aufstiegBonus: Math.round(fix * 0.55 * pf.bonus / 1000) * 1000,
        label: pf.label,
        bisSaison: saison + pf.jahre
      });
    });
    return angebote;
  }

  function sponsorAbschliessen(fin, angebot, saison, tag) {
    fin.sponsoren[angebot.slot] = {
      firma: angebot.firma,
      fixJahr: angebot.fixJahr,
      siegBonus: angebot.siegBonus,
      titelBonus: angebot.titelBonus,
      aufstiegBonus: angebot.aufstiegBonus,
      seitSaison: saison,
      bisSaison: angebot.bisSaison
    };
    delete fin.sponsorAngebote[angebot.slot];
    if (angebot.slot === 'stadionname') fin.stadion.name = angebot.firma;
    /* Einstandszahlung: ein Viertel der Jahressumme sofort. */
    buchen(fin, tag, 'Sponsoring', 'Einstandszahlung ' + angebot.firma, Math.round(angebot.fixJahr * 0.25), 'Sponsoring');
  }

  function sponsorEinnahmenWoche(fin) {
    var s = 0;
    Object.keys(fin.sponsoren).forEach(function (k) {
      var sp = fin.sponsoren[k];
      if (sp) s += sp.fixJahr / 52;
    });
    return s;
  }

  /* ---- Zuschauer und Spieltagseinnahmen ------------------------------ */

  function zuschauer(rng, klub, fin, ctx) {
    /* ctx: {gegnerRuf, platz, teams, form (0-1), stufe, pflichtspiel} */
    var st = fin.stadion;
    var kap = kapazitaet(st);
    var basis = grundNachfrage(klub.ruf);
    var tabellenFaktor = 1;
    if (ctx.platz && ctx.teams) {
      var rel = 1 - (ctx.platz - 1) / (ctx.teams - 1);   /* 1 = Tabellenführer */
      tabellenFaktor = 0.80 + rel * 0.42;
    }
    var formFaktor = 0.90 + (ctx.form === undefined ? 0.5 : ctx.form) * 0.22;
    var gegnerFaktor = 0.88 + Util.clamp((ctx.gegnerRuf || 40) / 100, 0, 1) * 0.34;
    var ref = PREIS_REFERENZ[ctx.stufe] || PREIS_REFERENZ[4];
    var schnittPreis = (st.sektoren.steh.preis * st.sektoren.steh.plaetze +
                        st.sektoren.sitz.preis * st.sektoren.sitz.plaetze) /
                       Math.max(1, st.sektoren.steh.plaetze + st.sektoren.sitz.plaetze);
    var refPreis = (ref.steh * st.sektoren.steh.plaetze + ref.sitz * st.sektoren.sitz.plaetze) /
                   Math.max(1, st.sektoren.steh.plaetze + st.sektoren.sitz.plaetze);
    var preisFaktor = Util.clamp(Math.pow(refPreis / Math.max(1, schnittPreis), 0.85), 0.25, 1.45);
    var modulFaktor = 1 +
      (st.module.videowand ? 0.03 : 0) +
      (st.module.parkhaus ? 0.05 : 0) +
      (st.module.gastronomie ? 0.02 : 0);
    var nachfrage = basis * tabellenFaktor * formFaktor * gegnerFaktor * preisFaktor * modulFaktor;
    nachfrage *= rng.float(0.92, 1.08);
    var besucher = Math.min(kap, Math.round(nachfrage));
    return Math.max(Math.round(kap * 0.06), besucher);
  }

  function spieltagEinnahmen(fin, besucherZahl) {
    var st = fin.stadion;
    var kap = kapazitaet(st);
    var quote = kap > 0 ? besucherZahl / kap : 0;
    var s = st.sektoren;
    /* VIP und Sitzplaetze fuellen sich zuerst. */
    var vipBes = Math.min(s.vip.plaetze, Math.round(s.vip.plaetze * Math.min(1, quote * 1.25)));
    var sitzBes = Math.min(s.sitz.plaetze, Math.round(s.sitz.plaetze * Math.min(1, quote * 1.08)));
    var stehBes = Math.max(0, besucherZahl - vipBes - sitzBes);
    stehBes = Math.min(s.steh.plaetze, stehBes);
    var ticket = vipBes * s.vip.preis + sitzBes * s.sitz.preis + stehBes * s.steh.preis;
    var catering = besucherZahl * 6.5 * (st.module.gastronomie ? 1.75 : 1) * (st.module.parkhaus ? 1.08 : 1);
    return {
      ticket: Math.round(ticket),
      catering: Math.round(catering),
      gesamt: Math.round(ticket + catering),
      vip: vipBes, sitz: sitzBes, steh: stehBes
    };
  }

  function merchandisingWoche(klub, fin, erfolg) {
    var basis = grundNachfrage(klub.ruf) * 1.6;
    var shop = fin.stadion.module.fanshop ? 1.25 : 1;
    return basis * shop * (0.8 + (erfolg || 0.5) * 0.5);
  }

  /* ---- Stadionausbau -------------------------------------------------- */

  var AUSBAU_KOSTEN = { steh: 1100, sitz: 2400, vip: 11000 };

  function ausbauKosten(sektor, plaetze) {
    var k = AUSBAU_KOSTEN[sektor] * plaetze;
    return Math.round(k * 1.18);   /* Nebenkosten */
  }

  function ausbauDauer(plaetze) {
    return Util.clamp(Math.round(45 + plaetze / 45), 45, 420);
  }

  function ausbauStarten(fin, tag, sektor, plaetze, verfuegbar) {
    if (fin.stadion.ausbau) return { ok: false, grund: 'Es läuft bereits eine Baumaßnahme.' };
    var kosten = ausbauKosten(sektor, plaetze);
    var grenze = verfuegbar === undefined ? fin.kontostand : verfuegbar;
    if (kosten > grenze) {
      return { ok: false, grund: 'Dafür reicht das freie Guthaben nicht. Verfügbar sind ' +
        Fmt.money(grenze) + ' – der Rest ist Betriebsreserve.' };
    }
    var dauer = ausbauDauer(plaetze);
    fin.stadion.ausbau = {
      art: 'sektor', sektor: sektor, plaetze: plaetze,
      kosten: kosten, startTag: tag, fertigTag: tag + dauer
    };
    buchen(fin, tag, 'Stadion', 'Baubeginn: ' + plaetze + ' neue ' + sektorName(sektor), -kosten, 'Stadionausbau');
    return { ok: true, dauer: dauer, kosten: kosten };
  }

  function modulBauen(fin, tag, modulId, verfuegbar) {
    if (fin.stadion.ausbau) return { ok: false, grund: 'Es läuft bereits eine Baumaßnahme.' };
    var m = Util.byId(MODULE, modulId);
    if (!m) return { ok: false, grund: 'Unbekanntes Bauvorhaben.' };
    if (fin.stadion.module[modulId]) return { ok: false, grund: 'Bereits vorhanden.' };
    var grenze2 = verfuegbar === undefined ? fin.kontostand : verfuegbar;
    if (m.kosten > grenze2) {
      return { ok: false, grund: 'Dafür reicht das freie Guthaben nicht. Verfügbar sind ' +
        Fmt.money(grenze2) + ' – der Rest ist Betriebsreserve.' };
    }
    fin.stadion.ausbau = {
      art: 'modul', modul: modulId, name: m.name,
      kosten: m.kosten, startTag: tag, fertigTag: tag + m.tage
    };
    buchen(fin, tag, 'Stadion', 'Baubeginn: ' + m.name, -m.kosten, 'Stadionausbau');
    return { ok: true, dauer: m.tage };
  }

  function sektorName(s) {
    return s === 'steh' ? 'Stehplätze' : (s === 'sitz' ? 'Sitzplätze' : 'VIP-Plätze');
  }

  function ausbauPruefen(fin, tag) {
    var a = fin.stadion.ausbau;
    if (!a || tag < a.fertigTag) return null;
    fin.stadion.ausbau = null;
    if (a.art === 'sektor') {
      fin.stadion.sektoren[a.sektor].plaetze += a.plaetze;
      return { text: 'Ausbau fertig: ' + a.plaetze + ' neue ' + sektorName(a.sektor) + '. Kapazität jetzt ' +
        Fmt.num(kapazitaet(fin.stadion)) + '.' };
    }
    fin.stadion.module[a.modul] = true;
    if (a.modul === 'logen') {
      var s = fin.stadion.sektoren;
      var um = Math.round(s.sitz.plaetze * 0.03);
      s.sitz.plaetze -= um;
      s.vip.plaetze += um;
    }
    return { text: 'Fertiggestellt: ' + a.name + '.' };
  }

  function unterhaltWoche(fin, stufe) {
    var kap = kapazitaet(fin.stadion);
    var stufenFaktor = stufe === 1 ? 1.0 : (stufe === 2 ? 0.8 : (stufe === 3 ? 0.5 : 0.32));
    var basis = kap * 0.42 * stufenFaktor;   /* Betriebskosten je Platz und Woche */
    var mod = 0;
    Object.keys(fin.stadion.module).forEach(function (k) {
      var m = Util.byId(MODULE, k);
      if (m && fin.stadion.module[k]) mod += m.unterhalt;
    });
    return basis + mod;
  }

  /* ---- Bank ----------------------------------------------------------- */

  function jahresUmsatzSchaetzung(klub, fin, stufe) {
    var sp = 0;
    Object.keys(fin.sponsoren).forEach(function (k) { if (fin.sponsoren[k]) sp += fin.sponsoren[k].fixJahr; });
    if (!sp) sp = sponsorWert(klub.ruf, 1.2, stufe);
    var zuschauerUmsatz = grundNachfrage(klub.ruf) * 17 * ((PREIS_REFERENZ[stufe] || PREIS_REFERENZ[4]).sitz * 0.7 + 7);
    var tv = (stufe === 1 ? 45000000 : stufe === 2 ? 12000000 : stufe === 3 ? 1300000 : 180000);
    return sp + zuschauerUmsatz + tv;
  }

  function restschuld(fin) {
    return Util.sum(fin.kredite, function (k) { return k.restschuld; });
  }

  /* Offene Ratenzahlungen aus Transfers - zaehlen wie Schulden. */
  function offeneRaten(fin) {
    return Util.sum(fin.verpflichtungen || [], function (v) {
      return v.art === 'rate' ? v.wocheBetrag * v.restWochen : 0;
    });
  }

  /* Woechentliche Abwicklung der Transfer-Ratenzahlungen. */
  function verpflichtungenWoche(fin, tag, state) {
    var offen = [];
    var summe = 0;
    (fin.verpflichtungen || []).forEach(function (v) {
      if (v.art !== 'rate') { offen.push(v); return; }
      if (v.restWochen <= 0) return;
      summe += v.wocheBetrag;
      v.restWochen--;
      /* Der Empfaenger bekommt sein Geld gutgeschrieben. */
      if (state && v.anKlubId && state.klubs[v.anKlubId] && state.klubs[v.anKlubId].finanzen) {
        buchen(state.klubs[v.anKlubId].finanzen, tag, 'Transfer', 'Ratenzahlung ' + v.text, v.wocheBetrag, 'Transfererlöse');
      }
      if (v.restWochen > 0) offen.push(v);
    });
    fin.verpflichtungen = offen;
    if (summe > 0) buchen(fin, tag, 'Transfer', 'Transfer-Ratenzahlungen', -Math.round(summe), 'Transferraten');
    return summe;
  }

  function bonitaet(klub, fin, stufe) {
    var umsatz = jahresUmsatzSchaetzung(klub, fin, stufe);
    var schulden = restschuld(fin);
    var quote = (schulden + offeneRaten(fin) * 0.6) / Math.max(1, umsatz);
    var liquid = fin.kontostand / Math.max(1, umsatz);
    var note = 100 - quote * 85 + liquid * 45;
    return Util.clamp(Math.round(note), 5, 100);
  }

  function kreditRahmen(klub, fin, stufe) {
    var umsatz = jahresUmsatzSchaetzung(klub, fin, stufe);
    var b = bonitaet(klub, fin, stufe);
    var max = umsatz * (0.25 + (b / 100) * 0.45);
    return Math.max(0, Math.round((max - restschuld(fin)) / 10000) * 10000);
  }

  var ZWECKE = {
    betrieb: { name: 'Betriebsmittel', aufschlag: 0,
      text: 'Fließt auf das Konto und deckt laufende Kosten, Bauvorhaben oder Gehälter.' },
    transfer: { name: 'Transferkredit', aufschlag: 0.008,
      text: 'Fließt auf das Konto und erhöht zusätzlich das Transferbudget um denselben Betrag. ' +
            'Die Bank lässt sich das Risiko mit einem Aufschlag bezahlen.' }
  };

  function zinssatz(klub, fin, stufe, jahre, zweck) {
    var b = bonitaet(klub, fin, stufe);
    var basis = 0.031 + (100 - b) / 100 * 0.115;
    basis += (jahre - 1) * 0.0032;
    if (stufe >= 3) basis += 0.012;
    if (stufe === 4) basis += 0.010;
    basis += (ZWECKE[zweck] || ZWECKE.betrieb).aufschlag;
    return Math.round(basis * 10000) / 10000;
  }

  var kreditZaehler = 0;

  function kreditAufnehmen(klub, fin, stufe, betrag, jahre, tag, zweck) {
    betrag = Math.round(betrag);
    if (betrag <= 0) return { ok: false, grund: 'Ungültiger Betrag.' };
    zweck = ZWECKE[zweck] ? zweck : 'betrieb';
    var rahmen = kreditRahmen(klub, fin, stufe);
    if (betrag > rahmen) return { ok: false, grund: 'Die Bank gewährt höchstens ' + Fmt.money(rahmen) + '.' };
    var z = zinssatz(klub, fin, stufe, jahre, zweck);
    var wochen = jahre * 52;
    /* Annuitaet auf Wochenbasis */
    var iw = z / 52;
    var rate = betrag * iw / (1 - Math.pow(1 + iw, -wochen));
    var kredit = {
      id: 'k' + (++kreditZaehler),
      betrag: betrag,
      restschuld: betrag,
      zinssatz: z,
      jahre: jahre,
      wochen: wochen,
      restWochen: wochen,
      rate: Math.round(rate),
      aufgenommenTag: tag,
      gezahlteZinsen: 0,
      zweck: zweck
    };
    fin.kredite.push(kredit);
    buchen(fin, tag, 'Bank', ZWECKE[zweck].name + ' (' + jahre + ' Jahre, ' +
      (z * 100).toFixed(2).replace('.', ',') + ' %)', betrag, 'Kredite');
    /* Der zweckgebundene Kredit erhöht auch den Rahmen für Ablösesummen. */
    if (zweck === 'transfer') fin.transferbudget += betrag;
    return { ok: true, kredit: kredit };
  }

  function sondertilgung(fin, kreditId, betrag, tag) {
    var k = Util.byId(fin.kredite, kreditId);
    if (!k) return { ok: false, grund: 'Kredit nicht gefunden.' };
    betrag = Math.min(Math.round(betrag), k.restschuld);
    if (betrag <= 0) return { ok: false, grund: 'Ungültiger Betrag.' };
    if (betrag > fin.kontostand) return { ok: false, grund: 'Nicht genug Geld auf dem Konto.' };
    var gebuehr = Math.round(betrag * 0.01);
    k.restschuld -= betrag;
    buchen(fin, tag, 'Bank', 'Sondertilgung', -(betrag + gebuehr), 'Kredittilgung');
    if (k.restschuld <= 0) {
      fin.kredite = fin.kredite.filter(function (x) { return x.id !== k.id; });
      return { ok: true, abgeloest: true };
    }
    /* Rate neu berechnen */
    var iw = k.zinssatz / 52;
    k.rate = Math.round(k.restschuld * iw / (1 - Math.pow(1 + iw, -Math.max(1, k.restWochen))));
    return { ok: true, abgeloest: false };
  }

  function kreditWoche(fin, tag) {
    var zinsen = 0, tilgung = 0;
    var fertig = [];
    fin.kredite.forEach(function (k) {
      if (k.restschuld <= 0) { fertig.push(k.id); return; }
      var z = k.restschuld * (k.zinssatz / 52);
      var rate = Math.min(k.rate, k.restschuld + z);
      var t = rate - z;
      k.restschuld = Math.max(0, k.restschuld - t);
      k.restWochen = Math.max(0, k.restWochen - 1);
      k.gezahlteZinsen += z;
      zinsen += z; tilgung += t;
      if (k.restschuld <= 0.5) fertig.push(k.id);
    });
    if (fertig.length) {
      fin.kredite = fin.kredite.filter(function (k) { return fertig.indexOf(k.id) < 0; });
    }
    return { zinsen: zinsen, tilgung: tilgung, abgeloest: fertig.length };
  }

  var DISPO_ZINS = 0.145;

  g.Finance = {
    SLOTS: SLOTS,
    MODULE: MODULE,
    PREIS_REFERENZ: PREIS_REFERENZ,
    DISPO_ZINS: DISPO_ZINS,
    sponsorWert: sponsorWert,
    grundNachfrage: grundNachfrage,
    finanzenAufsetzen: finanzenAufsetzen,
    stadionAufsetzen: stadionAufsetzen,
    kapazitaet: kapazitaet,
    buchen: buchen,
    angeboteErzeugen: angeboteErzeugen,
    sponsorAbschliessen: sponsorAbschliessen,
    sponsorEinnahmenWoche: sponsorEinnahmenWoche,
    zuschauer: zuschauer,
    spieltagEinnahmen: spieltagEinnahmen,
    merchandisingWoche: merchandisingWoche,
    ausbauKosten: ausbauKosten,
    ausbauDauer: ausbauDauer,
    ausbauStarten: ausbauStarten,
    modulBauen: modulBauen,
    ausbauPruefen: ausbauPruefen,
    sektorName: sektorName,
    unterhaltWoche: unterhaltWoche,
    jahresUmsatzSchaetzung: jahresUmsatzSchaetzung,
    restschuld: restschuld,
    offeneRaten: offeneRaten,
    verpflichtungenWoche: verpflichtungenWoche,
    bonitaet: bonitaet,
    kreditRahmen: kreditRahmen,
    ZWECKE: ZWECKE,
    zinssatz: zinssatz,
    kreditAufnehmen: kreditAufnehmen,
    sondertilgung: sondertilgung,
    kreditWoche: kreditWoche,
    setKreditZaehler: function (n) { kreditZaehler = n; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
