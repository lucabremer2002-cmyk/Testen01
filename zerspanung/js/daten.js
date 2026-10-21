/*
 * Stammdaten des Zerspanungsmechaniker-Simulators.
 *
 * Alle Zahlen sind Richtwerte aus der ueblichen Fachliteratur
 * (Tabellenbuch Metall, Herstellerkataloge fuer Hartmetall und HSS):
 *   - spezifische Schnittkraft nach Kienzle (kc1.1 in N/mm^2, Anstieg mc)
 *   - empfohlene Schnittgeschwindigkeiten je Werkstoff und Schneidstoff
 *   - Normlaengen fuer Spiralbohrer (DIN 338 / DIN 340)
 *   - ISO-Toleranzen (ISO 286) und Allgemeintoleranzen (ISO 2768-m)
 *   - Kernlochdurchmesser und Toleranzen fuer metrische Gewinde (6H)
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  // ------------------------------------------------------------ Werkstoffe
  //
  // kc11, mc   Kienzle-Werte (h = 1 mm, b = 1 mm)
  // E, alpha   Elastizitaetsmodul (N/mm^2), Waermeausdehnung (1/K)
  // rho, cp    Dichte (kg/mm^3), spez. Waermekapazitaet (J/kgK)
  // span       Spanform: 'lang' (Fliess-/Bandspan), 'mittel', 'broeckel'
  // therm      Temperaturfaktor (schlechte Waermeleitung -> heisse Schneide)
  // abr        Verschleissfaktor (Abrasivitaet, Karbide, Graphit ...)
  // aufbau     Neigung zur Aufbauschneide (0..1)
  // verfest    Kaltverfestigung beim Reiben/Druecken (0..1)
  // duktil     Gratbildung beim Austritt
  // zieht      Neigung, den Bohrer beim Durchbruch hineinzuziehen
  // kleben     Neigung zum Aufschweissen auf der Schneide (Aluminium)
  // vc         empfohlene Schnittgeschwindigkeiten in m/min
  // fF         Vorschubfaktor gegenueber Baustahl
  var werkstoffe = {
    S235: {
      id: 'S235', name: 'S235JR', nr: '1.0038', art: 'Unlegierter Baustahl', iso: 'P',
      rm: 430, hb: 125, kc11: 1780, mc: 0.17, E: 210000, alpha: 11.5e-6,
      rho: 7.85e-6, cp: 460, span: 'lang', therm: 1.0, abr: 1.0, aufbau: 0.65,
      verfest: 0.0, duktil: 1.0, zieht: 0.15, kleben: 0.1, gamma0: 6, fF: 1.0,
      raMin: 0.3,
      vc: { bohrHSS: 30, bohrVHM: 110, reibHSS: 10, reibVHM: 30, gewHSS: 14,
            drehHM: 250, fraesHSS: 30, fraesVHM: 160 },
      farbe: '#9ba3aa', roh: '#3b4248', spanFarbe: '#c9ced3', preisKg: 1.6,
      text: 'Gut zerspanbar. Bei niedriger Schnittgeschwindigkeit neigt er zur Aufbauschneide, die Späne sind lang.'
    },
    C45: {
      id: 'C45', name: 'C45E (+N)', nr: '1.1191', art: 'Vergütungsstahl, normalgeglüht', iso: 'P',
      rm: 650, hb: 190, kc11: 2220, mc: 0.14, E: 210000, alpha: 11.5e-6,
      rho: 7.85e-6, cp: 460, span: 'lang', therm: 1.12, abr: 1.15, aufbau: 0.5,
      verfest: 0.05, duktil: 0.8, zieht: 0.12, kleben: 0.08, gamma0: 6, fF: 0.9,
      raMin: 0.28,
      vc: { bohrHSS: 22, bohrVHM: 90, reibHSS: 8, reibVHM: 25, gewHSS: 10,
            drehHM: 220, fraesHSS: 25, fraesVHM: 140 },
      farbe: '#959da4', roh: '#383f45', spanFarbe: '#c4c9ce', preisKg: 2.1,
      text: 'Der Standard-Wellenstahl. Fester als S235, deshalb Schnittwerte etwa 20 % niedriger ansetzen.'
    },
    '42CrMo4': {
      id: '42CrMo4', name: '42CrMo4 (+QT)', nr: '1.7225', art: 'Vergütungsstahl, vergütet', iso: 'P',
      rm: 1000, hb: 300, kc11: 2500, mc: 0.26, E: 210000, alpha: 11.1e-6,
      rho: 7.85e-6, cp: 460, span: 'lang', therm: 1.28, abr: 1.35, aufbau: 0.25,
      verfest: 0.1, duktil: 0.6, zieht: 0.1, kleben: 0.05, gamma0: 6, fF: 0.7,
      raMin: 0.25,
      vc: { bohrHSS: 13, bohrVHM: 70, reibHSS: 6, reibVHM: 20, gewHSS: 6,
            drehHM: 160, fraesHSS: 15, fraesVHM: 100 },
      farbe: '#8d949b', roh: '#30363b', spanFarbe: '#b9bec4', preisKg: 3.4,
      text: 'Hochfest (Rm ≈ 1000 N/mm²). Hohe Schnittkräfte und Temperaturen, HSS kommt hier schnell an seine Grenzen.'
    },
    '1.4301': {
      id: '1.4301', name: 'X5CrNi18-10', nr: '1.4301', art: 'Austenitischer Edelstahl (V2A)', iso: 'M',
      rm: 600, hb: 190, kc11: 2350, mc: 0.21, E: 200000, alpha: 16.0e-6,
      rho: 7.9e-6, cp: 500, span: 'lang', therm: 1.45, abr: 1.4, aufbau: 0.45,
      verfest: 1.0, duktil: 1.4, zieht: 0.1, kleben: 0.3, gamma0: 6, fF: 0.8,
      raMin: 0.45,
      vc: { bohrHSS: 11, bohrVHM: 55, reibHSS: 5, reibVHM: 18, gewHSS: 5,
            drehHM: 180, fraesHSS: 15, fraesVHM: 90 },
      farbe: '#a9b0b6', roh: '#8d949a', spanFarbe: '#d2d6da', preisKg: 5.8,
      text: 'Zäh, leitet Wärme schlecht und verfestigt sich, wenn das Werkzeug reibt statt schneidet. Immer unter Span halten.'
    },
    GJL250: {
      id: 'GJL250', name: 'EN-GJL-250', nr: '5.1301', art: 'Gusseisen mit Lamellengraphit', iso: 'K',
      rm: 250, hb: 210, kc11: 1160, mc: 0.26, E: 110000, alpha: 10.0e-6,
      rho: 7.2e-6, cp: 500, span: 'broeckel', therm: 0.8, abr: 1.55, aufbau: 0.0,
      verfest: 0.0, duktil: 0.05, zieht: 0.35, kleben: 0.0, gamma0: 2, fF: 1.3,
      raMin: 0.8,
      vc: { bohrHSS: 22, bohrVHM: 100, reibHSS: 8, reibVHM: 30, gewHSS: 10,
            drehHM: 220, fraesHSS: 22, fraesVHM: 150 },
      farbe: '#6f767c', roh: '#4a4f53', spanFarbe: '#55595d', preisKg: 1.9,
      text: 'Kurzspanend und abrasiv. Wird meist trocken bearbeitet, der Graphit schmiert selbst.'
    },
    AlMgSi1: {
      id: 'AlMgSi1', name: 'EN AW-6082 T6', nr: '3.2315', art: 'Aluminium-Knetlegierung (AlMgSi1)', iso: 'N',
      rm: 310, hb: 95, kc11: 830, mc: 0.23, E: 70000, alpha: 23.0e-6,
      rho: 2.7e-6, cp: 900, span: 'lang', therm: 0.45, abr: 0.4, aufbau: 0.9,
      verfest: 0.0, duktil: 1.2, zieht: 0.4, kleben: 1.0, gamma0: 15, fF: 1.3,
      raMin: 0.35,
      vc: { bohrHSS: 60, bohrVHM: 250, reibHSS: 20, reibVHM: 60, gewHSS: 20,
            drehHM: 600, fraesHSS: 100, fraesVHM: 450 },
      farbe: '#c4cad0', roh: '#aab1b8', spanFarbe: '#e6e9ec', preisKg: 4.2,
      text: 'Weich, aber klebrig. Ohne Kühlschmierung schweißt das Aluminium auf die Schneide auf.'
    },
    CuZn39Pb3: {
      id: 'CuZn39Pb3', name: 'CuZn39Pb3', nr: 'CW614N', art: 'Automatenmessing', iso: 'N',
      rm: 430, hb: 110, kc11: 780, mc: 0.18, E: 97000, alpha: 20.0e-6,
      rho: 8.47e-6, cp: 380, span: 'broeckel', therm: 0.5, abr: 0.5, aufbau: 0.05,
      verfest: 0.0, duktil: 0.3, zieht: 1.0, kleben: 0.1, gamma0: 2, fF: 1.2,
      raMin: 0.25,
      vc: { bohrHSS: 60, bohrVHM: 200, reibHSS: 20, reibVHM: 50, gewHSS: 18,
            drehHM: 350, fraesHSS: 70, fraesVHM: 300 },
      farbe: '#c9a74a', roh: '#a88a3c', spanFarbe: '#e2c35c', preisKg: 7.5,
      text: 'Bröckelt sauber, zieht den Bohrer aber beim Durchbruch gern hinein. Bohrer mit Spanwinkel 0° (Typ H) verwenden.'
    },
    Ti6Al4V: {
      id: 'Ti6Al4V', name: 'Ti6Al4V (Grade 5)', nr: '3.7165', art: 'Titanlegierung', iso: 'S',
      rm: 950, hb: 330, kc11: 1450, mc: 0.23, E: 114000, alpha: 8.6e-6,
      rho: 4.43e-6, cp: 560, span: 'lang', therm: 1.75, abr: 1.8, aufbau: 0.3,
      verfest: 0.3, duktil: 1.1, zieht: 0.1, kleben: 0.4, gamma0: 6, fF: 0.7,
      raMin: 0.4, brennbar: true,
      vc: { bohrHSS: 8, bohrVHM: 40, reibHSS: 4, reibVHM: 15, gewHSS: 3,
            drehHM: 60, fraesHSS: 10, fraesVHM: 60 },
      farbe: '#9aa0a8', roh: '#7c828a', spanFarbe: '#cfd3d8', preisKg: 38,
      text: 'Leitet Wärme kaum ab, die Hitze bleibt an der Schneide. Feine Späne können brennen. Niedrige vc, viel Kühlung.'
    }
  };

  // ------------------------------------------------------- Schneidstoffe
  //
  // tSoft   Temperatur, ab der die Schneide weich wird (Anlass-/Warmhaerte)
  // invN    Kehrwert des Taylor-Exponenten n (vc * T^n = C)
  // tau     Torsionsbruchfestigkeit (N/mm^2)
  // sigma   Biegebruchfestigkeit (N/mm^2)
  // zaeh    Zaehigkeit 0..1 (Hartmetall ist sproede)
  var schneidstoffe = {
    HSS:      { id: 'HSS', name: 'HSS', vcF: 1.0, tSoft: 560, invN: 8.0, tau: 1600, sigma: 3000, E: 217000, zaeh: 1.0, farbe: '#b8bec4' },
    HSSE:     { id: 'HSSE', name: 'HSS-E (Co5)', vcF: 1.15, tSoft: 600, invN: 7.5, tau: 1650, sigma: 3100, E: 220000, zaeh: 0.95, farbe: '#aab0b8' },
    HSSTIN:   { id: 'HSSTIN', name: 'HSS-E TiN', vcF: 1.35, tSoft: 620, invN: 7.0, tau: 1650, sigma: 3100, E: 220000, zaeh: 0.95, farbe: '#d9b13b' },
    VHM:      { id: 'VHM', name: 'VHM unbeschichtet', vcF: 0.75, tSoft: 900, invN: 4.5, tau: 1900, sigma: 3300, E: 600000, zaeh: 0.35, farbe: '#9ea4aa' },
    VHMTIALN: { id: 'VHMTIALN', name: 'VHM TiAlN', vcF: 1.0, tSoft: 1050, invN: 4.0, tau: 1900, sigma: 3300, E: 600000, zaeh: 0.35, alAffin: true, farbe: '#5b4f72' },
    HMCVD:    { id: 'HMCVD', name: 'HM CVD-beschichtet', vcF: 1.0, tSoft: 1100, invN: 3.5, tau: 1900, sigma: 2400, E: 580000, zaeh: 0.45, farbe: '#2b2b30' },
    HMPOL:    { id: 'HMPOL', name: 'HM unbeschichtet, poliert', vcF: 1.0, tSoft: 900, invN: 3.2, tau: 1900, sigma: 2400, E: 580000, zaeh: 0.4, farbe: '#a3a9b0' }
  };

  // ------------------------------------------------------- Kuehlschmierung
  var kss = {
    trocken:  { id: 'trocken', name: 'Trocken', kurz: 'trocken', temp: 1.0, kc: 1.0, bue: 1.0, schmier: 0.0, kuehl: 0.0, reib: 1.0, le: 1.0 },
    emulsion: { id: 'emulsion', name: 'Emulsion 6 % (Überflutung)', kurz: 'Emulsion', temp: 0.78, kc: 0.97, bue: 0.85, schmier: 0.45, kuehl: 1.0, reib: 0.6, le: 1.15 },
    oel:      { id: 'oel', name: 'Schneidöl', kurz: 'Öl', temp: 0.88, kc: 0.92, bue: 0.55, schmier: 1.0, kuehl: 0.4, reib: 0.35, le: 1.1 },
    ikz:      { id: 'ikz', name: 'Innere Kühlmittelzufuhr (IKZ, 40 bar)', kurz: 'IKZ', temp: 0.62, kc: 0.95, bue: 0.8, schmier: 0.5, kuehl: 1.6, reib: 0.55, le: 3.2 }
  };

  // --------------------------------------------------------- Spiralbohrer
  // DIN 338 (kurz): [d, Gesamtlaenge l1, Spannutlaenge l2]
  var DIN338 = [
    [1, 34, 12], [1.5, 40, 18], [2, 49, 24], [2.5, 57, 30], [3, 61, 33], [3.5, 70, 39],
    [4, 75, 43], [4.5, 80, 47], [5, 86, 52], [5.5, 93, 57], [6, 93, 57], [6.5, 101, 63],
    [7, 109, 69], [7.5, 109, 69], [8, 117, 75], [8.5, 117, 75], [9, 125, 81], [9.5, 125, 81],
    [10, 133, 87], [10.5, 133, 87], [11, 142, 94], [12, 151, 101], [13, 151, 101],
    [14, 160, 108], [16, 178, 120], [18, 191, 130], [20, 205, 140]
  ];

  function din338(d) {
    var i;
    if (d <= DIN338[0][0]) { return { l1: DIN338[0][1], l2: DIN338[0][2] }; }
    for (i = 1; i < DIN338.length; i++) {
      if (d <= DIN338[i][0]) {
        var a = DIN338[i - 1], b = DIN338[i];
        var t = (d - a[0]) / (b[0] - a[0]);
        return { l1: Math.round(a[1] + (b[1] - a[1]) * t), l2: Math.round(a[2] + (b[2] - a[2]) * t) };
      }
    }
    var l = DIN338[DIN338.length - 1];
    return { l1: l[1], l2: l[2] };
  }

  var BOHRER_D = [1, 1.5, 2, 2.5, 3, 3.3, 3.5, 4, 4.2, 4.5, 5, 5.5, 6, 6.5, 6.8, 7, 7.5, 7.8,
    8, 8.5, 9, 9.5, 9.8, 10, 10.2, 10.5, 11, 12, 13, 14, 16, 18, 20];

  // Bohrertypen: Schneidstoff, Spitzenwinkel, ausgespitzt, Laenge, Preisfaktor
  var bohrerTypen = {
    HSS:    { name: 'HSS-Spiralbohrer DIN 338 Typ N', stoff: 'HSS', spitze: 118, ausgespitzt: false, laenge: 'kurz', ikz: false, pf: 1.0 },
    HSSL:   { name: 'HSS-Spiralbohrer DIN 340 lang', stoff: 'HSS', spitze: 118, ausgespitzt: false, laenge: 'lang', ikz: false, pf: 1.6 },
    HSSE:   { name: 'HSS-E-Spiralbohrer, 130° ausgespitzt', stoff: 'HSSE', spitze: 130, ausgespitzt: true, laenge: 'kurz', ikz: false, pf: 1.8 },
    HSSEL:  { name: 'HSS-E-Spiralbohrer DIN 340 lang', stoff: 'HSSE', spitze: 130, ausgespitzt: true, laenge: 'lang', ikz: false, pf: 2.6 },
    HSSTIN: { name: 'HSS-E-Spiralbohrer TiN, 135°', stoff: 'HSSTIN', spitze: 135, ausgespitzt: true, laenge: 'kurz', ikz: false, pf: 2.3 },
    VHM3:   { name: 'VHM-Bohrer TiAlN 3×D, 140°', stoff: 'VHMTIALN', spitze: 140, ausgespitzt: true, laenge: 'vhm3', ikz: false, pf: 1.0 },
    VHM5I:  { name: 'VHM-Bohrer TiAlN 5×D mit IKZ', stoff: 'VHMTIALN', spitze: 140, ausgespitzt: true, laenge: 'vhm5', ikz: true, pf: 1.45 },
    VHM8I:  { name: 'VHM-Bohrer TiAlN 8×D mit IKZ', stoff: 'VHMTIALN', spitze: 140, ausgespitzt: true, laenge: 'vhm8', ikz: true, pf: 2.0 }
  };

  function bohrer(typId, d) {
    var t = bohrerTypen[typId];
    var l;
    if (t.laenge === 'kurz') {
      l = din338(d);
    } else if (t.laenge === 'lang') {
      var k = din338(d);
      var l2 = Math.round(k.l2 * 1.6);
      l = { l1: k.l1 + (l2 - k.l2), l2: l2 };
    } else {
      var faktor = t.laenge === 'vhm3' ? 4 : t.laenge === 'vhm5' ? 6 : 9;
      var nut = Math.round(faktor * d + 4);
      l = { l1: nut + 36 + Math.round(d), l2: nut };
    }
    var vhm = t.stoff.indexOf('VHM') === 0;
    var preis = vhm ? (18 + 2.6 * Math.pow(d, 1.5)) * t.pf : (0.6 + 0.12 * Math.pow(d, 1.7)) * t.pf;
    // Freie Laenge: der Schaft steckt zu etwa 80 % im Bohrfutter
    var frei = l.l2 + 0.2 * (l.l1 - l.l2);
    return {
      id: 'bohrer-' + typId + '-' + d, typ: 'bohrer', art: typId, name: t.name, d: d,
      stoff: t.stoff, spitze: t.spitze, ausgespitzt: t.ausgespitzt, ikz: t.ikz,
      l1: l.l1, l2: l.l2, frei: frei, preis: Math.round(preis * 100) / 100,
      bez: 'Ø ' + fmtD(d) + ' mm, ' + t.name
    };
  }

  // ------------------------------------------------------------- Reibahlen
  var REIB_D = [5, 6, 8, 10, 12, 16, 20];
  function reibahle(stoff, d) {
    var vhm = stoff !== 'HSSE';
    var z = d <= 5 ? 4 : d <= 12 ? 6 : 8;
    var preis = vhm ? 60 + 6 * d : 12 + 1.8 * d;
    var l2 = Math.round(14 + 2.4 * d);
    return {
      id: 'reib-' + stoff + '-' + d, typ: 'reibahle', d: d, stoff: vhm ? 'VHM' : 'HSSE', z: z,
      spitze: 90, ausgespitzt: true, l1: Math.round(60 + 7.3 * d), l2: l2, frei: Math.round(l2 + 30 + 2 * d),
      preis: Math.round(preis * 100) / 100,
      name: (vhm ? 'VHM-Maschinenreibahle' : 'HSS-E-Maschinenreibahle DIN 212') + ' H7',
      bez: 'Ø ' + fmtD(d) + ' H7, ' + (vhm ? 'VHM' : 'HSS-E') + ', z = ' + z
    };
  }

  // -------------------------------------------------------------- Gewinde
  // Metrisches ISO-Regelgewinde, Muttergewinde Toleranz 6H
  var gewinde = {
    M3:  { name: 'M3',  D: 3,  P: 0.5,  kern: 2.5,  d1min: 2.459,  d1max: 2.599 },
    M4:  { name: 'M4',  D: 4,  P: 0.7,  kern: 3.3,  d1min: 3.242,  d1max: 3.422 },
    M5:  { name: 'M5',  D: 5,  P: 0.8,  kern: 4.2,  d1min: 4.134,  d1max: 4.334 },
    M6:  { name: 'M6',  D: 6,  P: 1.0,  kern: 5.0,  d1min: 4.917,  d1max: 5.153 },
    M8:  { name: 'M8',  D: 8,  P: 1.25, kern: 6.8,  d1min: 6.647,  d1max: 6.912 },
    M10: { name: 'M10', D: 10, P: 1.5,  kern: 8.5,  d1min: 8.376,  d1max: 8.676 },
    M12: { name: 'M12', D: 12, P: 1.75, kern: 10.2, d1min: 10.106, d1max: 10.441 },
    M16: { name: 'M16', D: 16, P: 2.0,  kern: 14.0, d1min: 13.835, d1max: 14.210 }
  };

  // Form B: Schaelanschnitt, schiebt die Spaene nach vorn (Durchgangsloch)
  // Form C: Spiralnut 35 Grad, foerdert die Spaene nach oben (Grundloch)
  function gewindebohrer(gw, form) {
    var g = gewinde[gw];
    var anschnitt = form === 'B' ? 4.5 : 2.5;
    return {
      id: 'gew-' + gw + '-' + form, typ: 'gewinde', gw: gw, form: form, d: g.D, P: g.P,
      stoff: 'HSSE', anschnitt: anschnitt * g.P, nuten: 3,
      l1: Math.round(50 + 5 * g.D), l2: Math.round(10 + 1.6 * g.D), frei: Math.round(40 + 4 * g.D),
      mBruch: 30 * g.D * g.D * g.D,       // Bruchmoment in Nmm (Herstellerangaben gemittelt)
      preis: Math.round((8 + 1.6 * g.D) * (form === 'C' ? 1.25 : 1) * 100) / 100,
      name: 'HSS-E-Maschinengewindebohrer ' + g.name + ' Form ' + form,
      bez: g.name + ' Form ' + form + (form === 'B' ? ' (Schälanschnitt, für Durchgangslöcher)' : ' (Spiralnut, für Grundlöcher)')
    };
  }

  // ------------------------------------------------------ Wendeschneidplatten
  // fMin..fMax, apMin..apMax: Anwendungsbereich der Spanformstufe
  // hMax: maximal ertragbare Spanungsdicke; kappa: Einstellwinkel mit Halter
  var platten = [
    { id: 'CNMG120408-PM', name: 'CNMG 120408-PM', sorte: 'P25', iso: 'P', stoff: 'HMCVD', form: 'C', re: 0.8, kappa: 95, gamma: 8,
      fMin: 0.15, fMax: 0.45, apMin: 0.8, apMax: 5.0, hMax: 0.5, ecken: 4, preis: 9.8, wiper: false,
      text: 'Universalplatte für mittlere Bearbeitung in Stahl' },
    { id: 'CNMG120404-PF', name: 'CNMG 120404-PF', sorte: 'P15', iso: 'P', stoff: 'HMCVD', form: 'C', re: 0.4, kappa: 95, gamma: 10,
      fMin: 0.07, fMax: 0.25, apMin: 0.25, apMax: 2.0, hMax: 0.3, ecken: 4, preis: 10.4, wiper: false,
      text: 'Schlichtplatte, kleiner Eckenradius, geringer Passivdruck' },
    { id: 'CNMG120412-PR', name: 'CNMG 120412-PR', sorte: 'P35', iso: 'P', stoff: 'HMCVD', form: 'C', re: 1.2, kappa: 95, gamma: 6,
      fMin: 0.25, fMax: 0.6, apMin: 1.5, apMax: 7.0, hMax: 0.7, ecken: 4, preis: 10.9, wiper: false,
      text: 'Schruppplatte mit stabiler Schneidkante' },
    { id: 'CNMG120408-WM', name: 'CNMG 120408-WM (Wiper)', sorte: 'P25', iso: 'P', stoff: 'HMCVD', form: 'C', re: 0.8, kappa: 95, gamma: 8,
      fMin: 0.12, fMax: 0.4, apMin: 0.5, apMax: 4.0, hMax: 0.45, ecken: 4, preis: 13.5, wiper: true,
      text: 'Wiper-Geometrie: halbe Rauheit bei gleichem Vorschub' },
    { id: 'DNMG150608-MM', name: 'DNMG 150608-MM', sorte: 'M25', iso: 'M', stoff: 'HMCVD', form: 'D', re: 0.8, kappa: 93, gamma: 12,
      fMin: 0.12, fMax: 0.35, apMin: 0.5, apMax: 4.0, hMax: 0.4, ecken: 4, preis: 12.2, wiper: false,
      text: 'Für rostfreie Stähle, scharfe positive Schneide' },
    { id: 'CNMG120408-KM', name: 'CNMG 120408-KM', sorte: 'K20', iso: 'K', stoff: 'HMCVD', form: 'C', re: 0.8, kappa: 95, gamma: 2,
      fMin: 0.15, fMax: 0.45, apMin: 0.5, apMax: 5.0, hMax: 0.55, ecken: 4, preis: 9.9, wiper: false,
      text: 'Für Gusseisen, verschleißfeste Al₂O₃-Schicht' },
    { id: 'CCGT09T304-AL', name: 'CCGT 09T304-AL', sorte: 'N10', iso: 'N', stoff: 'HMPOL', form: 'C', re: 0.4, kappa: 95, gamma: 20,
      fMin: 0.05, fMax: 0.25, apMin: 0.3, apMax: 4.0, hMax: 0.25, ecken: 2, preis: 11.5, wiper: false,
      text: 'Polierte, scharfe Platte für Aluminium und Buntmetall' },
    { id: 'VCMT160404-SF', name: 'VCMT 160404-SF', sorte: 'S15', iso: 'S', stoff: 'HMCVD', form: 'V', re: 0.4, kappa: 93, gamma: 14,
      fMin: 0.05, fMax: 0.2, apMin: 0.2, apMax: 2.0, hMax: 0.22, ecken: 2, preis: 14.8, wiper: false,
      text: 'Für Titan und warmfeste Legierungen, sehr scharf' }
  ];

  // Wie gut passt die Sorte (ISO-Gruppe) zum Werkstoff? -> [Verschleissfaktor, vc-Faktor]
  var sortenPassung = {
    P: { P: [1, 1], M: [1.9, 0.75], K: [1.3, 0.9], N: [2.5, 0.6], S: [3.5, 0.5] },
    M: { P: [1.2, 0.95], M: [1, 1], K: [1.5, 0.85], N: [2.0, 0.7], S: [1.8, 0.7] },
    K: { P: [1.6, 0.8], M: [2.4, 0.7], K: [1, 1], N: [2.2, 0.7], S: [3.0, 0.5] },
    N: { P: [5.0, 0.4], M: [5.0, 0.35], K: [3.5, 0.5], N: [1, 1], S: [3.0, 0.6] },
    S: { P: [1.3, 0.9], M: [1.2, 0.9], K: [1.6, 0.8], N: [1.8, 0.7], S: [1, 1] }
  };

  // ---------------------------------------------------------------- Fraeser
  var FRAES_D = [6, 8, 10, 12, 16];
  var fraeserTypen = {
    VHMZ4: { name: 'VHM-Schaftfräser TiAlN, z = 4', stoff: 'VHMTIALN', z: 4, drall: 35, kern: 0.78, pf: 1.0, al: false },
    VHMZ3AL: { name: 'VHM-Alufräser poliert, z = 3', stoff: 'VHM', z: 3, drall: 45, kern: 0.68, pf: 0.9, al: true },
    HSSZ4: { name: 'HSS-E-Schaftfräser, z = 4', stoff: 'HSSE', z: 4, drall: 30, kern: 0.75, pf: 0.3, al: false },
    HSSZ2: { name: 'HSS-E-Langlochfräser, z = 2', stoff: 'HSSE', z: 2, drall: 30, kern: 0.62, pf: 0.28, al: false }
  };

  function fraeser(typId, d) {
    var t = fraeserTypen[typId];
    var lc = Math.round(2 * d + 2);
    var preis = (12 + 0.55 * d * d) * t.pf * (t.stoff === 'HSSE' ? 1 : 1);
    return {
      id: 'fr-' + typId + '-' + d, typ: 'fraeser', art: typId, d: d, z: t.z, drall: t.drall, kern: t.kern,
      stoff: t.stoff, al: t.al, lc: lc, l1: Math.round(lc + 40 + d), preis: Math.round(preis * 100) / 100,
      name: t.name, bez: 'Ø ' + d + ' mm, ' + t.name
    };
  }

  // ---------------------------------------------------------------- Maschinen
  var maschinen = {
    saeule: {
      id: 'saeule', name: 'Säulenbohrmaschine SB 25', art: ['bohren'], cnc: false,
      P: 1.1, eta: 0.8, drehzahlen: [125, 180, 250, 355, 500, 710, 1000, 1400, 2000, 2800],
      vorschuebe: [0.05, 0.10, 0.15, 0.20], kSteif: 2500, rundlauf: 0.03, handkraft: 3000,
      riemen: 1.6, kss: ['trocken', 'emulsion', 'oel'], hub: 120, futter: 16, maxSchub: 6000,
      hochlauf: 0.6, text: 'Konventionell, Handhebel mit Pinolenvorschub, Keilriemen-Stufengetriebe.'
    },
    baz: {
      id: 'baz', name: 'CNC-Bearbeitungszentrum BAZ 650 V', art: ['bohren', 'fraesen'], cnc: true,
      P: 15, eta: 0.9, nMin: 50, nMax: 12000, stufenlos: true, kSteif: 30000, rundlauf: 0.004,
      maxSchub: 12000, mMax: 120, kss: ['trocken', 'emulsion', 'oel', 'ikz'], hochlauf: 1.0,
      umkehrspiel: 0, kHalter: 30000, vfMax: 10000,
      text: 'Kugelgewindetriebe ohne Umkehrspiel, Schrumpffutter, IKZ mit 40 bar.'
    },
    drehKonv: {
      id: 'drehKonv', name: 'Leit- und Zugspindeldrehmaschine LZ 200', art: ['drehen'], cnc: false,
      P: 7.5, eta: 0.8, drehzahlen: [40, 56, 80, 112, 160, 224, 315, 450, 630, 900, 1250, 1800, 2500],
      vorschuebe: [0.04, 0.05, 0.063, 0.08, 0.1, 0.125, 0.16, 0.2, 0.25, 0.315, 0.4, 0.5, 0.63],
      futter: { D: 200, Fsp: 45000, nMax: 3000, backenH: 24 }, kMaschine: 40000, rundlauf: 0.01,
      kss: ['trocken', 'emulsion'], hochlauf: 1.5,
      text: 'Dreibackenfutter Ø 200 mm, Reitstock mit mitlaufender Körnerspitze, Planscheibe mit Skalenring.'
    },
    fraesKonv: {
      id: 'fraesKonv', name: 'Konsolfräsmaschine FK 3', art: ['fraesen'], cnc: false,
      P: 4.0, eta: 0.8, drehzahlen: [45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400, 2000],
      vorschuebeMin: [16, 25, 40, 63, 100, 160, 250, 400, 630], umkehrspiel: 0.15, kHalter: 15000,
      rundlauf: 0.02, kss: ['trocken', 'emulsion'], tischReibung: 350, hochlauf: 1.0,
      text: 'Trapezgewindespindeln mit ca. 0,15 mm Umkehrspiel. Im Gleichlauf kann der Tisch ziehen!'
    }
  };

  var spannmittel = {
    hand: { id: 'hand', name: 'Werkstück von Hand gehalten', mHalt: 6, unfall: true },
    lose: { id: 'lose', name: 'Maschinenschraubstock, lose auf dem Tisch', mHalt: 22, unfall: true },
    fest: { id: 'fest', name: 'Maschinenschraubstock, festgespannt', mHalt: 400, unfall: false }
  };

  var positionierung = {
    anreissen: { id: 'anreissen', name: 'Anreißen und körnen', sigma: 0.08, zeit: 25, koerner: true },
    kreuztisch: { id: 'kreuztisch', name: 'Kreuztisch mit Messuhr', sigma: 0.025, zeit: 55, koerner: false },
    cnc: { id: 'cnc', name: 'CNC-Positionierung', sigma: 0.006, zeit: 2, koerner: false }
  };

  var messmittel = {
    messschieber: { id: 'messschieber', name: 'Messschieber 0,05', aufl: 0.05, fehler: 0.03 },
    digital: { id: 'digital', name: 'Digitaler Messschieber 0,01', aufl: 0.01, fehler: 0.02 },
    buegel: { id: 'buegel', name: 'Bügelmessschraube 0,01', aufl: 0.01, fehler: 0.004 },
    buegelDigital: { id: 'buegelDigital', name: 'Digitale Bügelmessschraube 0,001', aufl: 0.001, fehler: 0.002 }
  };

  // ------------------------------------------------------------ Toleranzen
  var IT_BEREICHE = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250];
  var IT = {
    5:  [4, 5, 6, 8, 9, 11, 13, 15, 18, 20],
    6:  [6, 8, 9, 11, 13, 16, 19, 22, 25, 29],
    7:  [10, 12, 15, 18, 21, 25, 30, 35, 40, 46],
    8:  [14, 18, 22, 27, 33, 39, 46, 54, 63, 72],
    9:  [25, 30, 36, 43, 52, 62, 74, 87, 100, 115],
    10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185],
    11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290],
    12: [100, 120, 150, 180, 210, 250, 300, 350, 400, 460],
    13: [140, 180, 220, 270, 330, 390, 460, 540, 630, 720],
    14: [250, 300, 360, 430, 520, 620, 740, 870, 1000, 1150]
  };
  var K_EI = [0, 1, 1, 1, 2, 2, 2, 3, 3, 4];

  function bereichIndex(nenn) {
    var i;
    for (i = 0; i < IT_BEREICHE.length; i++) { if (nenn <= IT_BEREICHE[i]) { return i; } }
    return IT_BEREICHE.length - 1;
  }

  // Liefert {o, u} (oberes/unteres Abmass in mm) fuer z.B. ('H', 7) oder ('k', 6)
  function iso286(nenn, feld, grad) {
    var i = bereichIndex(nenn);
    var it = IT[grad][i] / 1000;
    switch (feld) {
      case 'H': return { o: it, u: 0 };
      case 'h': return { o: 0, u: -it };
      case 'k': return { o: K_EI[i] / 1000 + it, u: K_EI[i] / 1000 };
      case 'js': return { o: it / 2, u: -it / 2 };
      default: return { o: it / 2, u: -it / 2 };
    }
  }

  // Allgemeintoleranz ISO 2768-m fuer Laengenmasse
  function iso2768m(nenn) {
    if (nenn <= 6) { return 0.1; }
    if (nenn <= 30) { return 0.2; }
    if (nenn <= 120) { return 0.3; }
    if (nenn <= 400) { return 0.5; }
    return 0.8;
  }

  // Toleranzangabe aus Text: '36 h11', '10 H7', '±0.1', '+0.1/-0'
  function toleranz(nenn, angabe) {
    var m, r;
    if (!angabe || angabe === '2768-m') {
      var t = iso2768m(nenn);
      return { nenn: nenn, o: t, u: -t, text: fmtD(nenn) + ' ±' + fmtD(t) };
    }
    m = /^([A-Za-z]{1,2})(\d{1,2})$/.exec(angabe);
    if (m) {
      r = iso286(nenn, m[1], parseInt(m[2], 10));
      return { nenn: nenn, o: r.o, u: r.u, text: fmtD(nenn) + ' ' + angabe, iso: angabe };
    }
    m = /^±([\d.]+)$/.exec(angabe);
    if (m) {
      var a = parseFloat(m[1]);
      return { nenn: nenn, o: a, u: -a, text: fmtD(nenn) + ' ±' + fmtD(a) };
    }
    m = /^([+-][\d.]+)\/([+-][\d.]+)$/.exec(angabe);
    if (m) {
      return { nenn: nenn, o: parseFloat(m[1]), u: parseFloat(m[2]), text: fmtD(nenn) + ' ' + angabe.replace('/', ' / ') };
    }
    return { nenn: nenn, o: 0.1, u: -0.1, text: fmtD(nenn) + ' ±0,1' };
  }

  function fmtD(v) {
    var s = (Math.round(v * 1000) / 1000).toString();
    return s.replace('.', ',');
  }

  // Empfohlener Bohrvorschub (mm/U) fuer HSS in Baustahl, nach Durchmesser
  function bohrVorschub(d, mat, vhm) {
    var f = 0.025 * Math.pow(d, 0.75) * (mat ? mat.fF : 1);
    return vhm ? f * 1.3 : f;
  }

  // Normdrehzahl: naechstkleinere Stufe (bei stufenlos genau)
  function stufeUnter(liste, n) {
    var i, best = liste[0];
    for (i = 0; i < liste.length; i++) { if (liste[i] <= n * 1.04) { best = liste[i]; } }
    return best;
  }

  // ------------------------------------------------------- Katalog aufbauen
  function katalog() {
    var k = { bohrer: [], reibahlen: [], gewindebohrer: [], platten: platten, fraeser: [] };
    Object.keys(bohrerTypen).forEach(function (t) {
      BOHRER_D.forEach(function (d) {
        if (bohrerTypen[t].stoff.indexOf('VHM') === 0 && (d < 2 || d > 16)) { return; }
        if (bohrerTypen[t].laenge === 'lang' && d < 2) { return; }
        k.bohrer.push(bohrer(t, d));
      });
    });
    ['HSSE', 'VHM'].forEach(function (s) {
      REIB_D.forEach(function (d) { k.reibahlen.push(reibahle(s, d)); });
    });
    Object.keys(gewinde).forEach(function (g) {
      k.gewindebohrer.push(gewindebohrer(g, 'B'));
      k.gewindebohrer.push(gewindebohrer(g, 'C'));
    });
    Object.keys(fraeserTypen).forEach(function (t) {
      FRAES_D.forEach(function (d) { k.fraeser.push(fraeser(t, d)); });
    });
    return k;
  }

  ZM.daten = {
    werkstoffe: werkstoffe,
    schneidstoffe: schneidstoffe,
    kss: kss,
    bohrerTypen: bohrerTypen,
    fraeserTypen: fraeserTypen,
    maschinen: maschinen,
    spannmittel: spannmittel,
    positionierung: positionierung,
    messmittel: messmittel,
    gewinde: gewinde,
    sortenPassung: sortenPassung,
    BOHRER_D: BOHRER_D,
    REIB_D: REIB_D,
    FRAES_D: FRAES_D,
    bohrer: bohrer,
    reibahle: reibahle,
    gewindebohrer: gewindebohrer,
    fraeser: fraeser,
    platte: function (id) {
      var i;
      for (i = 0; i < platten.length; i++) { if (platten[i].id === id) { return platten[i]; } }
      return null;
    },
    katalog: katalog,
    toleranz: toleranz,
    iso286: iso286,
    iso2768m: iso2768m,
    bohrVorschub: bohrVorschub,
    stufeUnter: stufeUnter,
    fmtD: fmtD
  };
})(typeof window !== 'undefined' ? window : globalThis);
