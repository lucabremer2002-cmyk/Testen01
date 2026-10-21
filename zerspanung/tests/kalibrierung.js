/*
 * Kalibrierlauf: gibt typische Kennwerte aus, damit man sie mit
 * Erfahrungswerten vergleichen kann.  Aufruf: node tests/kalibrierung.js
 */
'use strict';

var H = require('./helfer.js');
var DAT = H.DAT, PH = H.PH;

function zeile(t) { console.log(t); }
function nf(v, s) { return (v === undefined || v === null || isNaN(v)) ? '-' : v.toFixed(s === undefined ? 2 : s); }

function bohr(titel, o, bed) {
  var sim = H.bohrSim(o);
  var r = H.handBohren(sim, bed);
  var res = sim.lochAbschliessen();
  zeile(titel);
  zeile('   gebrochen=' + r.gebrochen + (r.bruch ? ' (' + r.bruch.art + ')' : '') + (r.unfall ? ' UNFALL ' + r.unfall.art : '') +
    '  zeit=' + nf(r.zeit, 1) + 's  maxM=' + nf(res.maxM) + 'Nm  mBruch=' + nf(sim.anzeige().mBruch) +
    '  maxF=' + nf(res.maxF, 0) + 'N  maxT=' + nf(res.maxT, 0) + '  maxPhi=' + nf(res.maxPhi) + '  maxR=' + nf(res.maxR) +
    '  f=' + nf(res.fMittel, 3) + '  VB=' + nf(res.VB, 3));
  zeile('   d=' + nf(res.d, 3) + ' tiefe=' + nf(res.tiefe, 2) + ' Ra=' + nf(res.ra, 2) + ' grat=' + nf(res.grat, 3) + ' lage=' + nf(res.lage, 3) +
    ' notizen=' + res.notizen.join(' | '));
  r.log.filter(function (e) { return e.schwere !== 'info' || e.typ === 'durchbruch'; }).slice(0, 4).forEach(function (e) {
    zeile('   [' + e.typ + '] ' + e.text);
  });
  return { sim: sim, r: r, res: res };
}

zeile('=== BOHREN ===');
var b6 = DAT.bohrer('HSS', 6);
bohr('A) Ø6 HSS, S235, 10 mm durch, n=1400 (vc 26), f≈0.10, Emulsion', { def: b6, mat: 'S235', param: { n: 1400 } }, { f: 0.10, tiefe: 13 });
bohr('B) Ø6 HSS, C45, Sackloch 40 tief, ohne Entspanen, n=1000', { def: b6, mat: 'C45', param: { n: 1000 }, op: { dicke: 60, durch: false } }, { f: 0.09, tiefe: 42, entspanen: 0 });
bohr('B2) wie B, aber Entspanen bei phi>0.75', { def: b6, mat: 'C45', param: { n: 1000 }, op: { dicke: 60, durch: false } }, { f: 0.09, tiefe: 42 });
bohr('B3) wie B, trocken, ohne Entspanen', { def: b6, mat: 'C45', param: { n: 1000, kss: 'trocken' }, op: { dicke: 60, durch: false } }, { f: 0.09, tiefe: 42, entspanen: 0, kss: false });
var b3 = DAT.bohrer('HSS', 3);
bohr('C) Ø3 HSS, S235, voll draufdrücken (kraft 1.0)', { def: b3, mat: 'S235', param: { n: 2800 } }, { f: 0.06, tiefe: 13, konstantKraft: 1.0 });
bohr('C2) Ø3 HSS, S235, maßvoll f≈0.05', { def: b3, mat: 'S235', param: { n: 2800 } }, { f: 0.05, tiefe: 13 });
bohr('C3) Ø3 HSS, S235, konstant 25 % Kraft (Durchbruch?)', { def: b3, mat: 'S235', param: { n: 2800 } }, { f: 0.05, tiefe: 13, konstantKraft: 0.25 });
bohr('D) Ø6 HSS, S235, n=2800 (vc 53) trocken', { def: b6, mat: 'S235', param: { n: 2800, kss: 'trocken' } }, { f: 0.1, tiefe: 13, kss: false });
bohr('D2) Ø6 HSS, S235, n=2000 (vc 38) Emulsion', { def: b6, mat: 'S235', param: { n: 2000 } }, { f: 0.1, tiefe: 13 });
var b8 = DAT.bohrer('HSS', 8);
bohr('E) Ø8 HSS, Messing 10 mm, konstante Kraft 30 %', { def: b8, mat: 'CuZn39Pb3', param: { n: 2000 } }, { f: 0.15, tiefe: 14, konstantKraft: 0.3 });
bohr('E2) Ø8 HSS, Messing, Hand gehalten, konstante Kraft 30 %', { def: b8, mat: 'CuZn39Pb3', param: { n: 2000, spann: 'hand' } }, { f: 0.15, tiefe: 14, konstantKraft: 0.3 });
var b14 = DAT.bohrer('HSS', 14);
bohr('F) Ø14 HSS, S235 15 mm, ohne Vorbohren, n=500', { def: b14, mat: 'S235', param: { n: 500 }, op: { dicke: 15 } }, { f: 0.18, tiefe: 20 });
bohr('F2) Ø14 HSS, S235 15 mm, vorgebohrt Ø5, n=500', { def: b14, mat: 'S235', param: { n: 500 }, op: { dicke: 15 }, vor: [{ d: 5.04, durch: true, tiefe: 15, spitze: 17, lageX: 0, lageY: 0 }] }, { f: 0.18, tiefe: 20 });
bohr('F3) Ø14 HSS, Schraubstock lose, vorgebohrt', { def: b14, mat: 'S235', param: { n: 500, spann: 'lose' }, op: { dicke: 15 }, vor: [{ d: 5.04, durch: true, tiefe: 15, spitze: 17, lageX: 0, lageY: 0 }] }, { f: 0.18, tiefe: 20 });
bohr('G) Ø8 HSS (Typ N) in 1.4301, n=355 (vc 9), f 0.08', { def: b8, mat: '1.4301', param: { n: 355 } }, { f: 0.08, tiefe: 14 });
bohr('G2) Ø8 HSS in 1.4301, n=1000 (vc 25)', { def: b8, mat: '1.4301', param: { n: 1000 } }, { f: 0.08, tiefe: 14 });
var v6 = DAT.bohrer('VHM5I', 6);
bohr('H) VHM Ø6 IKZ in C45 auf BAZ, Sackloch 30, n=4800 (vc 90), Hand-Simulator', { def: v6, mat: 'C45', masch: 'baz', param: { n: 4800, kss: 'ikz' }, op: { dicke: 50, durch: false } }, { f: 0.15, tiefe: 32, entspanen: 0 });

// CNC-Zyklus
(function () {
  var sim = H.bohrSim({ def: DAT.bohrer('VHM5I', 5), mat: 'Ti6Al4V', masch: 'baz', param: { n: 2500, fAuto: 0.08, kss: 'ikz', zyklus: { art: 'G81', Z: 15 + 2.5 / Math.tan(70 * Math.PI / 180) } }, op: { dicke: 30, durch: false } });
  sim.zyklusStart();
  var t = 0, dt = 1 / 480;
  while (t < 30 && sim.zyk.aktiv && !sim.w.gebrochen) { sim.step(dt, { spindel: true, kss: true }); t += dt; }
  var res = sim.lochAbschliessen();
  zeile('I) CNC G81 VHM Ø5 IKZ, Ti6Al4V, vc 39, f 0.08: zeit=' + nf(t, 1) + ' gebrochen=' + sim.w.gebrochen + ' maxM=' + nf(res.maxM) + ' maxT=' + nf(res.maxT, 0) + ' VB=' + nf(res.VB, 3) + ' tiefe=' + nf(res.tiefe));
  sim.ev.holen().forEach(function (e) { if (e.schwere !== 'info') { zeile('   [' + e.typ + '] ' + e.text); } });
})();

zeile('');
zeile('=== GEWINDE ===');
function gew(titel, gw, form, kern, kss, o) {
  o = o || {};
  var rng = new PH.Zufall(5);
  var def = DAT.gewindebohrer(gw, form);
  var sim = new PH.BohrSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: new PH.Werkzeug(def, rng), masch: DAT.maschinen.saeule,
    param: { n: o.n || 355, kss: kss, zAnschlag: o.stop || 12, spann: 'fest', pos: 'anreissen', rutsch: o.rutsch || null },
    op: { dicke: o.dicke || 12, durch: o.durch !== false, anzahl: 1 },
    vor: [{ d: kern + 0.03, durch: o.durch !== false, tiefe: o.vorTiefe || 12, spitze: (o.vorTiefe || 12) + kern * 0.3, lageX: 0, lageY: 0 }],
    rng: rng
  });
  var t = 0, dt = 1 / 480;
  while (t < 30 && !sim.w.gebrochen && sim.gew.phase !== 'fertig') {
    sim.step(dt, { spindel: true, kss: kss !== 'trocken', kraft: sim.gew.phase === 'bereit' ? 0.1 : 0, umsteuern: sim.gew.phase === 'rutscht' });
    t += dt;
  }
  var res = sim.lochAbschliessen();
  zeile(titel + ': gebrochen=' + sim.w.gebrochen + ' maxM=' + nf(res.maxM) + 'Nm (Bruch ' + nf(def.mBruch / 1000) + ') nutz=' + nf(res.nutzLaenge) +
    ' gut=' + res.gutLehre + ' aus=' + res.ausLehre + ' kernOk=' + res.kernOk + ' ' + res.notizen.join(' | '));
  sim.ev.holen().forEach(function (e) { if (e.schwere !== 'info') { zeile('   [' + e.typ + '] ' + e.text); } });
}
gew('M8 Form B, Kern 6.8, Öl, durch 12', 'M8', 'B', 6.8, 'oel');
gew('M8 Form B, Kern 6.8, trocken, durch 12', 'M8', 'B', 6.8, 'trocken');
gew('M8 Form B, Kern 6.5, trocken, durch 12', 'M8', 'B', 6.5, 'trocken');
gew('M8 Form B, Kern 6.5, Öl, durch 12', 'M8', 'B', 6.5, 'oel');
gew('M8 Form C, Kern 7.0, Öl', 'M8', 'C', 7.0, 'oel');
gew('M8 Form B Grundloch 18 tief, Gewinde 14, Öl', 'M8', 'B', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 18, stop: 14 });
gew('M8 Form C Grundloch 18 tief, Gewinde 14, Öl', 'M8', 'C', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 18, stop: 14 });
gew('M8 Form C Grundloch 14 tief, Anschlag 16 (Boden!)', 'M8', 'C', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 14, stop: 16 });
gew('M8 Form C Grundloch 14 tief, Anschlag 16, Rutschkupplung 9 Nm', 'M8', 'C', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 14, stop: 16, rutsch: 9 });
gew('M6 Form B, Kern 5.0, Emulsion, 1.4301', 'M6', 'B', 5.0, 'emulsion', { mat: '1.4301', n: 250 });

zeile('');
zeile('=== REIBEN ===');
function reib(titel, stoff, d, vor, n, f, kss, mat) {
  var rng = new PH.Zufall(3);
  var def = DAT.reibahle(stoff, d);
  var sim = new PH.BohrSim({
    mat: DAT.werkstoffe[mat || 'C45'], wkz: new PH.Werkzeug(def, rng), masch: DAT.maschinen.saeule,
    param: { n: n, fAuto: f, kss: kss, zAnschlag: 14, spann: 'fest', pos: 'anreissen' },
    op: { dicke: 12, durch: true, anzahl: 1 },
    vor: [{ d: vor, durch: true, tiefe: 12, spitze: 15, lageX: 0, lageY: 0 }],
    rng: rng
  });
  var t = 0, dt = 1 / 480;
  while (t < 40 && !sim.w.gebrochen && sim.z < 13.5) { sim.step(dt, { spindel: true, kss: kss !== 'trocken', auto: true }); sim.anzeige(); t += dt; }
  while (t < 60 && sim.z > -5) { sim.step(dt, { spindel: true, kss: true, kraft: -1 }); t += dt; }
  var res = sim.lochAbschliessen();
  var tol = DAT.toleranz(d, 'H7');
  zeile(titel + ': d=' + nf(res.d, 4) + ' (H7: ' + nf(d + tol.u, 3) + '…' + nf(d + tol.o, 3) + ') Ra=' + nf(res.ra) + ' maxM=' + nf(res.maxM) + ' zeit=' + nf(t, 1) + ' ' + res.notizen.join(' | '));
}
reib('10H7 HSS-E, vor 9.83, n=250 (vc 7.9), f=0.25, Öl', 'HSSE', 10, 9.83, 250, 0.2, 'oel');
reib('10H7 HSS-E, vor 9.83, n=710 (vc 22), f=0.2, Öl', 'HSSE', 10, 9.83, 710, 0.2, 'oel');
reib('10H7 HSS-E, vor 9.03, n=250, f=0.2, Öl', 'HSSE', 10, 9.03, 250, 0.2, 'oel');
reib('10H7 HSS-E, vor 9.95, n=250, f=0.2, Öl', 'HSSE', 10, 9.95, 250, 0.2, 'oel');
reib('10H7 HSS-E, vor 9.83, n=250, f=0.2, trocken', 'HSSE', 10, 9.83, 250, 0.2, 'trocken');

zeile('');
zeile('=== DREHEN ===');
function dreh(titel, o) {
  var rng = new PH.Zufall(9);
  var def = DAT.platte(o.platte || 'CNMG120408-PM');
  var w = new PH.Werkzeug(Object.assign({ typ: 'platte' }, def), rng);
  var sim = new PH.DrehSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: w, masch: DAT.maschinen.drehKonv,
    param: { n: o.n, f: o.f, kss: o.kss || 'emulsion', reitstock: !!o.reitstock, zAnschlag: o.anschlag !== undefined ? o.anschlag : 2 },
    op: { wst: { D: o.D, L: o.L, spannL: o.spannL || 40 } }, rng: rng
  });
  var dt = 1 / 480, t = 0;
  // Zustellen
  var xZiel = o.D - 2 * o.ap;
  while (t < 3) { sim.step(dt, { spindel: true, kss: true, xZiel: xZiel }); t += dt; }
  var maxAmp = 0, maxLast = 0;
  while (t < 300 && !sim.unfall && !sim.anschlagAus) {
    sim.step(dt, { spindel: true, kss: true, vorschub: true, xZiel: xZiel });
    t += dt;
    var a = sim.anzeige();
    if (a.amp > maxAmp) { maxAmp = a.amp; }
    if (a.last > maxLast) { maxLast = a.last; }
  }
  var b = sim.bereich(5, o.L - 2);
  var a2 = sim.anzeige();
  zeile(titel + ': zeit=' + nf(t, 1) + ' Ø ' + nf(b.min, 3) + '…' + nf(b.max, 3) + ' (Soll ' + nf(xZiel, 2) + ') Ra=' + nf(b.ra) +
    ' maxAmp=' + nf(maxAmp, 1) + 'µm bLim=' + nf(a2.bLim) + ' fn=' + nf(sim.fn, 0) + ' k=' + nf(sim.k, 0) + ' maxLast=' + nf(maxLast) +
    ' T=' + nf(sim.w.maxT, 0) + ' VB=' + nf(sim.w.VB, 3) + ' Twst=' + nf(sim.Twst, 1) + ' span=' + a2.spanForm + ' bruch=' + sim.w.gebrochen);
  sim.ev.holen().forEach(function (e) { if (e.schwere !== 'info') { zeile('   [' + e.typ + '] ' + e.text); } });
  return sim;
}
dreh('Ø40 S235 L=70, ap=2, f=0.25, n=1800 (vc 226)', { D: 40, L: 70, ap: 2, f: 0.25, n: 1800 });
dreh('Ø40 S235 L=70, ap=2, f=0.25, n=630 (vc 79)', { D: 40, L: 70, ap: 2, f: 0.25, n: 630 });
dreh('Ø40 S235 L=70, ap=0.3, f=0.08, n=1800 Schlichten mit PM (Band?)', { D: 40, L: 70, ap: 0.3, f: 0.08, n: 1800 });
dreh('Ø40 S235 L=70, ap=0.3, f=0.1, n=1800 Schlichten mit PF', { D: 40, L: 70, ap: 0.3, f: 0.1, n: 1800, platte: 'CNMG120404-PF' });
dreh('Ø25 C45 L=180, ap=1, f=0.2, n=2500, ohne Reitstock', { mat: 'C45', D: 25, L: 180, ap: 1, f: 0.2, n: 2500, spannL: 30 });
dreh('Ø25 C45 L=180, ap=1, f=0.2, n=2500, mit Reitstock', { mat: 'C45', D: 25, L: 180, ap: 1, f: 0.2, n: 2500, reitstock: true, spannL: 30 });
dreh('Ø25 C45 L=180, ap=0.3, f=0.12, n=2500, ohne Reitstock', { mat: 'C45', D: 25, L: 180, ap: 0.3, f: 0.12, n: 2500, spannL: 30 });
dreh('Ø60 C45 L=50, ap=5, f=0.5, n=900 (Last?)', { mat: 'C45', D: 60, L: 50, ap: 5, f: 0.5, n: 900 });
dreh('Ø40 S235 L=70, ap=2, f=0.63 (Platte?)', { D: 40, L: 70, ap: 2, f: 0.63, n: 1250 });
dreh('Ø50 C45 L=60, ap=2.5, f=0.25 n=1250 trocken', { mat: 'C45', D: 50, L: 60, ap: 2.5, f: 0.25, n: 1250, kss: 'trocken' });

zeile('');
zeile('=== FRÄSEN ===');
function fraes(titel, o) {
  var rng = new PH.Zufall(4);
  var def = DAT.fraeser(o.typ, o.d);
  var w = new PH.Werkzeug(def, rng);
  var sim = new PH.FraesSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: w, masch: DAT.maschinen[o.masch || 'baz'],
    param: { n: o.n, vf: o.vf, kss: o.kss || 'emulsion', richtung: o.richtung || 1, auskragung: o.auskrag },
    op: { wst: { L: 80, B: 40, H: 30 }, y: o.y === undefined ? 20 : o.y }, rng: rng
  });
  var dt = 1 / 480, t = 0;
  while (t < 4) { sim.step(dt, { spindel: true, kss: true, zZiel: o.ap }); t += dt; }
  var maxR = 0, maxAmp = 0;
  while (t < 120 && !sim.w.gebrochen && sim.x < 80 + sim.R + 2) {
    sim.step(dt, { spindel: true, kss: true, vorschub: true, zZiel: o.ap });
    t += dt;
    var a = sim.anzeige();
    if (a.r > maxR) { maxR = a.r; }
    if (a.amp > maxAmp) { maxAmp = a.amp; }
  }
  var q = sim.querschnitt(40, o.ap * 0.5);
  var a2 = sim.anzeige();
  zeile(titel + ': zeit=' + nf(t, 1) + ' gebrochen=' + sim.w.gebrochen + ' maxR=' + nf(maxR) + ' amp=' + nf(maxAmp, 1) + ' bLim=' + nf(a2.bLim) + ' fn=' + nf(sim.fn, 0) +
    ' P=' + nf(sim.st.maxP) + 'kW breite=' + (q.y0 !== null ? nf(q.y1 - q.y0, 2) : '-') + ' tiefe=' + nf(q.tiefe) + ' T=' + nf(sim.w.maxT, 0) + ' VB=' + nf(sim.w.VB, 3) + ' aufschw=' + nf(sim.w.aufschweiss));
  sim.ev.holen().forEach(function (e) { if (e.schwere !== 'info') { zeile('   [' + e.typ + '] ' + e.text); } });
}
fraes('VHM Z4 Ø10, S235 Nut ap=5, n=5000 (vc 157), vf=1000 (fz .05)', { typ: 'VHMZ4', d: 10, n: 5000, vf: 1000, ap: 5 });
fraes('VHM Z4 Ø10, S235 Nut ap=10, n=5000, vf=800', { typ: 'VHMZ4', d: 10, n: 5000, vf: 800, ap: 10 });
fraes('VHM Z4 Ø10, S235 Nut ap=20, n=5000, vf=800', { typ: 'VHMZ4', d: 10, n: 5000, vf: 800, ap: 20, auskrag: 35 });
fraes('HSS Z4 Ø10, S235 Nut ap=5, konv. n=1000 vf=160 (fz .04)', { typ: 'HSSZ4', d: 10, n: 1000, vf: 160, ap: 5, masch: 'fraesKonv' });
fraes('HSS Z4 Ø10, S235 Nut ap=10, konv. n=1000 vf=400 (fz .1)', { typ: 'HSSZ4', d: 10, n: 1000, vf: 400, ap: 10, masch: 'fraesKonv' });
fraes('HSS Z4 Ø10, Absatz ae=3 Gleichlauf konv. n=1000 vf=160', { typ: 'HSSZ4', d: 10, n: 1000, vf: 160, ap: 5, masch: 'fraesKonv', y: 38 });
fraes('HSS Z4 Ø10, Absatz ae=3 Gegenlauf konv. n=1000 vf=160', { typ: 'HSSZ4', d: 10, n: 1000, vf: 160, ap: 5, masch: 'fraesKonv', y: 2 });
fraes('VHM Z3 Alu Ø12, AlMgSi Nut ap=12, n=12000 vf=3600, Emulsion', { typ: 'VHMZ3AL', d: 12, n: 12000, vf: 3600, ap: 12, mat: 'AlMgSi1' });
fraes('VHM Z4 TiAlN Ø12, AlMgSi Nut ap=12, n=12000 vf=3600, trocken', { typ: 'VHMZ4', d: 12, n: 12000, vf: 3600, ap: 12, mat: 'AlMgSi1', kss: 'trocken' });
