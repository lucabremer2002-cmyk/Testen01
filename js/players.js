/* players.js - Spielergenerierung, Marktwert, Gehalt, Entwicklung. */
(function (g) {
  'use strict';

  var POSITIONEN = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LA', 'RA', 'ST'];

  var GRUPPE = {
    TW: 'TW', IV: 'ABW', LV: 'ABW', RV: 'ABW',
    DM: 'MIT', ZM: 'MIT', OM: 'MIT', LM: 'MIT', RM: 'MIT',
    LA: 'ANG', RA: 'ANG', ST: 'ANG'
  };

  /* Wie gut ein Spieler auf einer fremden Position zurechtkommt (0-1). */
  var EIGNUNG = {
    TW: { TW: 1 },
    IV: { IV: 1, LV: 0.8, RV: 0.8, DM: 0.78, ZM: 0.6 },
    LV: { LV: 1, RV: 0.85, IV: 0.82, LM: 0.85, DM: 0.7, LA: 0.7 },
    RV: { RV: 1, LV: 0.85, IV: 0.82, RM: 0.85, DM: 0.7, RA: 0.7 },
    DM: { DM: 1, ZM: 0.92, IV: 0.8, OM: 0.72, LM: 0.7, RM: 0.7 },
    ZM: { ZM: 1, DM: 0.9, OM: 0.9, LM: 0.82, RM: 0.82 },
    OM: { OM: 1, ZM: 0.88, LA: 0.85, RA: 0.85, LM: 0.82, RM: 0.82, ST: 0.8 },
    LM: { LM: 1, RM: 0.85, LA: 0.9, ZM: 0.82, LV: 0.78, OM: 0.8 },
    RM: { RM: 1, LM: 0.85, RA: 0.9, ZM: 0.82, RV: 0.78, OM: 0.8 },
    LA: { LA: 1, RA: 0.88, LM: 0.9, OM: 0.85, ST: 0.8 },
    RA: { RA: 1, LA: 0.88, RM: 0.9, OM: 0.85, ST: 0.8 },
    ST: { ST: 1, LA: 0.8, RA: 0.8, OM: 0.78 }
  };

  /* Attributsgewichte je Position - daraus ergibt sich die Staerke. */
  var GEWICHTE = {
    TW: { reflexe: 3.2, stellungsspiel: 2.0, technik: 0.6, passspiel: 0.8, zweikampf: 0.6, tempo: 0.3, abschluss: 0.1, kondition: 0.6, uebersicht: 0.8 },
    IV: { zweikampf: 3.0, stellungsspiel: 2.4, kopfball: 1.8, tempo: 1.2, passspiel: 1.2, technik: 0.8, kondition: 1.2, uebersicht: 1.0, abschluss: 0.3, reflexe: 0 },
    LV: { tempo: 2.4, zweikampf: 2.0, kondition: 2.0, passspiel: 1.4, technik: 1.4, stellungsspiel: 1.6, uebersicht: 1.0, kopfball: 0.6, abschluss: 0.4, reflexe: 0 },
    RV: { tempo: 2.4, zweikampf: 2.0, kondition: 2.0, passspiel: 1.4, technik: 1.4, stellungsspiel: 1.6, uebersicht: 1.0, kopfball: 0.6, abschluss: 0.4, reflexe: 0 },
    DM: { zweikampf: 2.6, passspiel: 2.2, uebersicht: 2.0, stellungsspiel: 2.0, kondition: 1.6, technik: 1.2, tempo: 0.8, kopfball: 0.8, abschluss: 0.4, reflexe: 0 },
    ZM: { passspiel: 2.6, uebersicht: 2.4, technik: 2.0, kondition: 1.8, zweikampf: 1.4, tempo: 1.0, abschluss: 0.8, stellungsspiel: 1.0, kopfball: 0.4, reflexe: 0 },
    OM: { technik: 2.6, uebersicht: 2.4, passspiel: 2.2, abschluss: 1.8, tempo: 1.4, kondition: 1.0, zweikampf: 0.6, stellungsspiel: 0.6, kopfball: 0.3, reflexe: 0 },
    LM: { kondition: 2.2, tempo: 2.2, passspiel: 1.8, technik: 1.8, zweikampf: 1.2, uebersicht: 1.4, abschluss: 0.9, stellungsspiel: 0.8, kopfball: 0.3, reflexe: 0 },
    RM: { kondition: 2.2, tempo: 2.2, passspiel: 1.8, technik: 1.8, zweikampf: 1.2, uebersicht: 1.4, abschluss: 0.9, stellungsspiel: 0.8, kopfball: 0.3, reflexe: 0 },
    LA: { tempo: 3.0, technik: 2.6, abschluss: 1.8, passspiel: 1.4, uebersicht: 1.2, kondition: 1.4, zweikampf: 0.5, kopfball: 0.4, stellungsspiel: 0.4, reflexe: 0 },
    RA: { tempo: 3.0, technik: 2.6, abschluss: 1.8, passspiel: 1.4, uebersicht: 1.2, kondition: 1.4, zweikampf: 0.5, kopfball: 0.4, stellungsspiel: 0.4, reflexe: 0 },
    ST: { abschluss: 3.4, stellungsspiel: 2.2, kopfball: 1.8, technik: 1.6, tempo: 1.6, zweikampf: 1.0, kondition: 1.0, passspiel: 0.8, uebersicht: 0.8, reflexe: 0 }
  };

  var ATTR_NAMEN = {
    tempo: 'Tempo', technik: 'Technik', zweikampf: 'Zweikampf', passspiel: 'Passspiel',
    abschluss: 'Abschluss', kopfball: 'Kopfball', kondition: 'Kondition',
    uebersicht: 'Übersicht', stellungsspiel: 'Stellungsspiel', reflexe: 'Reflexe'
  };

  var ALTERS_FAKTOR = {
    16: 0.62, 17: 0.74, 18: 0.88, 19: 1.00, 20: 1.08, 21: 1.13, 22: 1.16, 23: 1.16,
    24: 1.13, 25: 1.10, 26: 1.05, 27: 1.00, 28: 0.90, 29: 0.79, 30: 0.67, 31: 0.55,
    32: 0.44, 33: 0.34, 34: 0.25, 35: 0.18, 36: 0.13, 37: 0.09, 38: 0.06, 39: 0.04, 40: 0.03
  };

  var lfdId = 0;

  function altersFaktor(alter) {
    return ALTERS_FAKTOR[Math.min(40, Math.max(16, Math.round(alter)))] || 0.03;
  }

  /* Reiner Leistungswert ohne Vertrags-, Form- und Potenzialaufschlag.
     Grundlage fuer die Gehaltsberechnung. */
  function leistungswert(staerke, alter) {
    return Math.pow(1.15, staerke) * 220 * altersFaktor(alter);
  }

  function marktwert(p, saison) {
    var basis = Math.pow(1.15, p.staerke) * 220;
    var af = altersFaktor(p.alter);
    var restJahre = Math.max(0, p.vertragBis - saison);
    var vf = restJahre <= 0 ? 0.35 : (restJahre === 1 ? 0.72 : (restJahre === 2 ? 0.93 : 1.0));
    var pf = 1 + Math.max(0, p.potenzial - p.staerke) / 100 * (p.alter < 24 ? 2.0 : 0.5);
    var ff = 0.92 + (p.form / 100) * 0.16;
    var w = basis * af * vf * pf * ff;
    /* auf saubere Stufen runden */
    if (w > 5000000) return Math.round(w / 250000) * 250000;
    if (w > 500000) return Math.round(w / 50000) * 50000;
    if (w > 50000) return Math.round(w / 5000) * 5000;
    return Math.max(4000, Math.round(w / 1000) * 1000);
  }

  /* Wochengehalt. Ueber alle vier Ligen kalibriert: ein Bundesliga-Star
     landet bei rund 20 Mio. im Jahr, ein Regionalliga-Profi bei rund 40.000. */
  function gehaltsBasis(staerke, klubRuf, alter) {
    var lw = leistungswert(staerke, alter === undefined ? 26 : alter);
    var jahr = Math.pow(lw, 0.80) * 10;
    var rf = 0.55 + Math.pow(klubRuf / 100, 1.3) * 0.75;
    return Math.max(120, Math.round(jahr * rf / 52));
  }

  function attributeErzeugen(rng, pos, staerke) {
    var gw = GEWICHTE[pos];
    var attrs = {};
    var keys = Object.keys(ATTR_NAMEN);
    /* Zuerst Rohwerte um die Staerke streuen, gewichtsabhaengig verschoben. */
    var maxGw = 0;
    keys.forEach(function (k) { if ((gw[k] || 0) > maxGw) maxGw = gw[k] || 0; });
    keys.forEach(function (k) {
      var w = gw[k] || 0;
      var bias = (w / maxGw) * 12 - 6;           /* wichtige Attribute hoeher */
      var v = rng.gauss(staerke + bias, 7, 4, 99);
      attrs[k] = Math.round(v);
    });
    if (pos !== 'TW') { attrs.reflexe = Math.round(rng.int(4, 18)); }
    else { attrs.abschluss = Math.round(rng.int(4, 25)); }
    /* Staerke aus den Attributen zurueckrechnen, damit beides zusammenpasst. */
    var summe = 0, gsum = 0;
    keys.forEach(function (k) {
      var w = gw[k] || 0;
      summe += attrs[k] * w; gsum += w;
    });
    var berechnet = summe / gsum;
    var diff = staerke - berechnet;
    keys.forEach(function (k) {
      if ((gw[k] || 0) > 0) attrs[k] = Math.round(Util.clamp(attrs[k] + diff, 3, 99));
    });
    return attrs;
  }

  function staerkeAus(attrs, pos) {
    var gw = GEWICHTE[pos], s = 0, gs = 0;
    Object.keys(gw).forEach(function (k) {
      s += (attrs[k] || 0) * gw[k]; gs += gw[k];
    });
    return Util.clamp(Math.round(s / gs), 1, 99);
  }

  function spielerErzeugen(rng, opt) {
    var pos = opt.pos;
    var alter = opt.alter !== undefined ? opt.alter : rng.int(18, 34);
    var staerke = Util.clamp(Math.round(opt.staerke), 8, 99);
    var potenzial = Util.clamp(Math.round(
      staerke + Math.max(0, rng.gauss(alter < 21 ? 12 : (alter < 24 ? 7 : (alter < 27 ? 3 : 0)), 6, -4, 30))
    ), staerke, 99);
    var nation = opt.nation;
    var nm = Names.name(rng, nation);
    var saison = opt.saison;
    var p = {
      id: 'p' + (++lfdId),
      vorname: nm.vorname,
      nachname: nm.nachname,
      name: nm.vorname + ' ' + nm.nachname,
      nation: nation,
      pos: pos,
      gruppe: GRUPPE[pos],
      alter: alter,
      staerke: staerke,
      potenzial: potenzial,
      attrs: attributeErzeugen(rng, pos, staerke),
      form: Math.round(rng.gauss(50, 14, 15, 90)),
      fitness: rng.int(88, 100),
      moral: Math.round(rng.gauss(68, 12, 25, 98)),
      klubId: opt.klubId,
      vertragBis: saison + rng.int(1, 4),
      gehalt: 0,
      marktwert: 0,
      transferliste: false,
      verletztBis: 0,
      verletzung: null,
      sperre: 0,
      wechselwunsch: false,
      spielt: false,
      stats: { spiele: 0, tore: 0, vorlagen: 0, gelb: 0, rot: 0, noten: [], minuten: 0 },
      karriere: []
    };
    p.staerke = staerkeAus(p.attrs, pos);
    p.gehalt = Math.round(gehaltsBasis(p.staerke, opt.klubRuf, p.alter) * rng.float(0.86, 1.16));
    p.marktwert = marktwert(p, saison);
    return p;
  }

  /* Kaderaufbau: feste Positionsverteilung, Staerke um den Klubschnitt gestreut. */
  var KADER_PLAN = [
    ['TW', 3], ['IV', 4], ['LV', 2], ['RV', 2],
    ['DM', 2], ['ZM', 4], ['OM', 2], ['LM', 1], ['RM', 1],
    ['LA', 2], ['RA', 2], ['ST', 3]
  ];

  function kaderErzeugen(rng, klub, basisStaerke, saison, nationFn) {
    var kader = [];
    var belegt = {};
    KADER_PLAN.forEach(function (eintrag) {
      var pos = eintrag[0], anzahl = eintrag[1];
      for (var i = 0; i < anzahl; i++) {
        /* Erster Spieler je Position ist der Stammspieler und staerker. */
        var rang = i === 0 ? rng.float(2, 6) : (i === 1 ? rng.float(-3, 2) : rng.float(-12, -4));
        var st = rng.gauss(basisStaerke + rang, 3.5, 8, 99);
        var alter;
        var r = rng.next();
        if (r < 0.14) alter = rng.int(17, 20);
        else if (r < 0.55) alter = rng.int(21, 25);
        else if (r < 0.85) alter = rng.int(26, 30);
        else alter = rng.int(31, 36);
        /* Zwei Spieler mit demselben Nachnamen wirken im Kader verwirrend. */
        var neuerSpieler = null;
        for (var versuch = 0; versuch < 14; versuch++) {
          neuerSpieler = spielerErzeugen(rng, {
            pos: pos, alter: alter, staerke: st, nation: nationFn(rng),
            klubId: klub.id, klubRuf: klub.ruf, saison: saison
          });
          if (!belegt[neuerSpieler.nachname]) break;
        }
        belegt[neuerSpieler.nachname] = true;
        kader.push(neuerSpieler);
      }
    });
    return kader;
  }

  /* Saisonentwicklung: junge Spieler steigern sich, alte bauen ab. */
  function entwickeln(rng, p, trainingsQualitaet, einsatzquote) {
    var alt = p.staerke;
    var delta = 0;
    var luecke = p.potenzial - p.staerke;
    if (p.alter <= 23) {
      delta = rng.gauss(1.6 + luecke * 0.16 + trainingsQualitaet * 1.4 + einsatzquote * 1.8, 1.4, -1, 9);
    } else if (p.alter <= 27) {
      delta = rng.gauss(0.3 + luecke * 0.08 + trainingsQualitaet * 0.8 + einsatzquote * 0.9, 1.2, -3, 5);
    } else if (p.alter <= 30) {
      delta = rng.gauss(-0.7 + trainingsQualitaet * 0.6 + einsatzquote * 0.5, 1.2, -4, 3);
    } else if (p.alter <= 33) {
      delta = rng.gauss(-2.4 + trainingsQualitaet * 0.5, 1.3, -7, 1);
    } else {
      delta = rng.gauss(-4.2 + trainingsQualitaet * 0.4, 1.5, -9, 0);
    }
    delta = Math.round(delta);
    if (delta > 0) delta = Math.min(delta, Math.max(0, p.potenzial - p.staerke));
    if (delta === 0) return 0;
    var gw = GEWICHTE[p.pos];
    Object.keys(p.attrs).forEach(function (k) {
      var w = gw[k] || 0;
      if (w <= 0) return;
      p.attrs[k] = Util.clamp(Math.round(p.attrs[k] + delta * (0.6 + rng.next() * 0.8)), 3, 99);
    });
    p.staerke = staerkeAus(p.attrs, p.pos);
    return p.staerke - alt;
  }

  var VERLETZUNGEN = [
    ['Muskelfaserriss', 14, 32], ['Bänderriss', 42, 90], ['Zerrung', 5, 14],
    ['Prellung', 3, 9], ['Meniskusschaden', 35, 80], ['Kreuzbandriss', 150, 260],
    ['Mittelfußbruch', 45, 95], ['Sprunggelenksverletzung', 12, 30],
    ['Schulterverletzung', 18, 40], ['Gehirnerschütterung', 7, 16],
    ['Adduktorenprobleme', 8, 20], ['Achillessehnenreizung', 20, 45]
  ];

  function verletzen(rng, p, heute) {
    var v = rng.pick(VERLETZUNGEN);
    var tage = rng.int(v[1], v[2]);
    /* aeltere Spieler brauchen laenger */
    if (p.alter > 30) tage = Math.round(tage * 1.25);
    p.verletzung = v[0];
    p.verletztBis = heute + tage;
    return { art: v[0], tage: tage };
  }

  g.Players = {
    POSITIONEN: POSITIONEN,
    GRUPPE: GRUPPE,
    EIGNUNG: EIGNUNG,
    GEWICHTE: GEWICHTE,
    ATTR_NAMEN: ATTR_NAMEN,
    ALTERS_FAKTOR: ALTERS_FAKTOR,
    marktwert: marktwert,
    gehaltsBasis: gehaltsBasis,
    leistungswert: leistungswert,
    altersFaktor: altersFaktor,
    spielerErzeugen: spielerErzeugen,
    kaderErzeugen: kaderErzeugen,
    staerkeAus: staerkeAus,
    entwickeln: entwickeln,
    verletzen: verletzen,
    eignung: function (spielerPos, slotPos) {
      var e = EIGNUNG[spielerPos];
      return (e && e[slotPos]) || 0.55;
    },
    setIdZaehler: function (n) { lfdId = n; },
    getIdZaehler: function () { return lfdId; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
