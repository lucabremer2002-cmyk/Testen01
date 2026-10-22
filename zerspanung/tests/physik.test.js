/*
 * Regressionstests fuer die Prozessphysik.  Aufruf: node --test tests/
 *
 * Geprueft wird Verhalten, das jeder Zerspaner aus der Praxis kennt:
 * richtig eingestellte Werkzeuge halten, falsch eingestellte brechen.
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var H = require('./helfer.js');
var DAT = H.DAT, PH = H.PH;

function gewindeLauf(gw, form, kern, kss, o) {
  o = o || {};
  var rng = new PH.Zufall(5);
  var def = DAT.gewindebohrer(gw, form);
  var sim = new PH.BohrSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: new PH.Werkzeug(def, rng), masch: DAT.maschinen.saeule,
    param: { n: 355, kss: kss, zAnschlag: o.stop || 20, spann: 'fest', pos: 'anreissen', rutsch: o.rutsch || null },
    op: { dicke: o.dicke || 12, durch: o.durch !== false, anzahl: 1 },
    vor: [{ d: kern + 0.03, durch: o.durch !== false, tiefe: o.vorTiefe || 12, spitze: (o.vorTiefe || 12) + kern * 0.3, lageX: 0, lageY: 0 }],
    rng: rng
  });
  var t = 0, dt = 1 / 480;
  while (t < 30 && !sim.w.gebrochen && sim.gew.phase !== 'fertig') {
    sim.step(dt, { spindel: true, kss: kss !== 'trocken', kraft: sim.gew.phase === 'bereit' ? 0.1 : 0, umsteuern: sim.gew.phase === 'rutscht' });
    t += dt;
  }
  return { sim: sim, res: sim.lochAbschliessen() };
}

function drehLauf(o) {
  var rng = new PH.Zufall(9);
  var w = new PH.Werkzeug(Object.assign({ typ: 'platte' }, DAT.platte(o.platte || 'CNMG120408-PM')), rng);
  var sim = new PH.DrehSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: w, masch: DAT.maschinen.drehKonv,
    param: { n: o.n, f: o.f, kss: 'emulsion', reitstock: !!o.reitstock, zAnschlag: 2 },
    op: { wst: { D: o.D, L: o.L, spannL: o.spannL || 40 } }, rng: rng
  });
  var dt = 1 / 480, t = 0, xZiel = o.D - 2 * o.ap, maxAmp = 0;
  while (t < 3) { sim.step(dt, { spindel: true, kss: true, xZiel: xZiel }); t += dt; }
  while (t < 300 && !sim.unfall && !sim.anschlagAus) {
    sim.step(dt, { spindel: true, kss: true, vorschub: true, xZiel: xZiel });
    t += dt;
    maxAmp = Math.max(maxAmp, sim.amp);
  }
  return { sim: sim, maxAmp: maxAmp, b: sim.bereich(5, o.L - 2) };
}

function fraesLauf(o) {
  var rng = new PH.Zufall(4);
  var w = new PH.Werkzeug(DAT.fraeser(o.typ, o.d), rng);
  var sim = new PH.FraesSim({
    mat: DAT.werkstoffe[o.mat || 'S235'], wkz: w, masch: DAT.maschinen[o.masch || 'baz'],
    param: { n: o.n, vf: o.vf, kss: 'emulsion', richtung: 1, auskragung: o.auskrag },
    op: { wst: { L: 80, B: 40, H: 30 }, y: 20 }, rng: rng
  });
  var dt = 1 / 480, t = 0;
  while (t < 4) { sim.step(dt, { spindel: true, kss: true, zZiel: o.ap }); t += dt; }
  while (t < 120 && !sim.w.gebrochen && sim.x < 80 + sim.R + 2) {
    sim.step(dt, { spindel: true, kss: true, vorschub: true, zZiel: o.ap });
    t += dt;
  }
  return { sim: sim, q: sim.querschnitt(40, o.ap * 0.5) };
}

test('Bohren Ø6 HSS in S235 mit Richtwerten hält und trifft das Maß', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 6), mat: 'S235', param: { n: 1400 } });
  var r = H.handBohren(sim, { f: 0.1, tiefe: 13 });
  var res = sim.lochAbschliessen();
  assert.strictEqual(r.gebrochen, false);
  assert.ok(res.durch, 'Bohrung muss durch sein');
  assert.ok(res.d > 6.0 && res.d < 6.08, 'Durchmesser ' + res.d);
  assert.ok(res.maxM > 1.0 && res.maxM < 4, 'Moment ' + res.maxM);
});

test('Tiefe Bohrung ohne Entspanen bricht durch Spänestau', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 6), mat: 'C45', param: { n: 1000 }, op: { dicke: 60, durch: false } });
  var r = H.handBohren(sim, { f: 0.09, tiefe: 42, entspanen: 0 });
  assert.strictEqual(r.gebrochen, true);
  assert.strictEqual(r.bruch.art, 'spaene');
  assert.ok(sim.z > 18 && sim.z < 40, 'Bruch bei ' + sim.z);
});

test('Mit Entspanen schafft derselbe Bohrer 40 mm Tiefe', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 6), mat: 'C45', param: { n: 1000 }, op: { dicke: 60, durch: false } });
  var r = H.handBohren(sim, { f: 0.09, tiefe: 42 });
  var res = sim.lochAbschliessen();
  assert.strictEqual(r.gebrochen, false);
  assert.ok(res.tiefe > 39, 'Tiefe ' + res.tiefe);
});

test('Ø3-Bohrer mit voller Hebelkraft bricht', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 3), mat: 'S235', param: { n: 2800 } });
  var r = H.handBohren(sim, { f: 0.06, tiefe: 13, konstantKraft: 1.0 });
  assert.strictEqual(r.gebrochen, true);
});

test('Von Hand gehaltenes Messingteil wird mitgerissen', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 8), mat: 'CuZn39Pb3', param: { n: 2000, spann: 'hand' } });
  var r = H.handBohren(sim, { f: 0.15, tiefe: 14, konstantKraft: 0.3 });
  assert.ok(r.unfall && r.unfall.art === 'mitgerissen');
});

test('V2A mit zu hoher Drehzahl: HSS-Bohrer glüht aus', function () {
  var sim = H.bohrSim({ def: DAT.bohrer('HSS', 8), mat: '1.4301', param: { n: 1000 } });
  var r = H.handBohren(sim, { f: 0.08, tiefe: 14 });
  assert.strictEqual(r.gebrochen, true);
  assert.strictEqual(r.bruch.art, 'hitze');
});

test('Gewinde M8 mit Kernloch 6,8 und Öl ist gut', function () {
  var x = gewindeLauf('M8', 'B', 6.8, 'oel');
  assert.strictEqual(x.sim.w.gebrochen, false);
  assert.ok(x.res.gutLehre && !x.res.ausLehre && x.res.kernOk);
  assert.ok(x.res.maxM > 3 && x.res.maxM < 8, 'Moment ' + x.res.maxM);
  assert.ok(x.res.nutzLaenge >= 11.9, 'Gewindelänge ' + x.res.nutzLaenge);
});

test('Gewinde Form B im Grundloch bricht durch Späne', function () {
  var x = gewindeLauf('M8', 'B', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 18, stop: 14 });
  assert.strictEqual(x.sim.w.gebrochen, true);
  assert.strictEqual(x.sim.w.bruch.art, 'spaene');
});

test('Rutschkupplung rettet den Gewindebohrer am Bohrungsgrund', function () {
  var ohne = gewindeLauf('M8', 'C', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 14, stop: 16 });
  var mit = gewindeLauf('M8', 'C', 6.8, 'oel', { durch: false, dicke: 30, vorTiefe: 14, stop: 16, rutsch: 9 });
  assert.strictEqual(ohne.sim.w.gebrochen, true);
  assert.strictEqual(mit.sim.w.gebrochen, false);
});

test('Reiben Ø10 H7 mit richtigen Werten liegt in der Toleranz', function () {
  var rng = new PH.Zufall(3);
  var def = DAT.reibahle('HSSE', 10);
  var sim = new PH.BohrSim({
    mat: DAT.werkstoffe.C45, wkz: new PH.Werkzeug(def, rng), masch: DAT.maschinen.saeule,
    param: { n: 250, fAuto: 0.2, kss: 'oel', zAnschlag: 14, spann: 'fest', pos: 'anreissen' },
    op: { dicke: 12, durch: true, anzahl: 1 },
    vor: [{ d: 9.83, durch: true, tiefe: 12, spitze: 15, lageX: 0, lageY: 0 }], rng: rng
  });
  var t = 0, dt = 1 / 480;
  while (t < 40 && sim.z < 13.5) { sim.step(dt, { spindel: true, kss: true, auto: true }); sim.anzeige(); t += dt; }
  while (t < 60 && sim.z > -5) { sim.step(dt, { spindel: true, kss: true, kraft: -1 }); t += dt; }
  var res = sim.lochAbschliessen();
  assert.ok(res.d >= 10.0 && res.d <= 10.015, 'Ø ' + res.d);
  assert.ok(res.ra < 1.6, 'Ra ' + res.ra);
});

test('Schlanke Welle ohne Reitstock rattert und wird kegelig, mit Reitstock nicht', function () {
  var ohne = drehLauf({ mat: 'C45', D: 25, L: 180, ap: 0.3, f: 0.12, n: 2500, spannL: 30 });
  var mit = drehLauf({ mat: 'C45', D: 25, L: 180, ap: 0.3, f: 0.12, n: 2500, spannL: 30, reitstock: true });
  assert.ok(ohne.b.max - ohne.b.min > 0.03, 'Kegel ohne Reitstock ' + (ohne.b.max - ohne.b.min));
  assert.ok(mit.b.max - mit.b.min < 0.03, 'Kegel mit Reitstock ' + (mit.b.max - mit.b.min));
  assert.ok(ohne.maxAmp > mit.maxAmp);
});

test('Zu hoher Vorschub zerstört die Wendeschneidplatte', function () {
  var x = drehLauf({ D: 40, L: 70, ap: 2, f: 0.63, n: 1250 });
  assert.strictEqual(x.sim.w.gebrochen, true);
});

test('Drehen mit Richtwerten: Maß und Rauheit wie berechnet', function () {
  var x = drehLauf({ D: 40, L: 70, ap: 0.3, f: 0.1, n: 1800, platte: 'CNMG120404-PF' });
  assert.strictEqual(x.sim.w.gebrochen, false);
  assert.ok(Math.abs(x.b.min - 39.4) < 0.01, 'Ø ' + x.b.min);
  // Ra,th = f^2 / (32 r) = 0,78 µm
  assert.ok(x.b.ra > 0.7 && x.b.ra < 1.3, 'Ra ' + x.b.ra);
});

test('HSS-Fräser mit fz 0,1 bei Vollnut 1×D bricht', function () {
  var x = fraesLauf({ typ: 'HSSZ4', d: 10, n: 1000, vf: 400, ap: 10, masch: 'fraesKonv' });
  assert.strictEqual(x.sim.w.gebrochen, true);
});

test('VHM-Fräser mit Richtwerten fräst eine maßhaltige Nut', function () {
  var x = fraesLauf({ typ: 'VHMZ4', d: 10, n: 5000, vf: 1000, ap: 5 });
  assert.strictEqual(x.sim.w.gebrochen, false);
  var b = x.q.y1 - x.q.y0;
  assert.ok(b >= 10 && b <= 10.2, 'Breite ' + b);
  assert.ok(Math.abs(x.q.tiefe - 5) < 0.02, 'Tiefe ' + x.q.tiefe);
});

test('ISO-Toleranzen nach ISO 286', function () {
  var k6 = DAT.toleranz(45, 'k6');
  assert.ok(Math.abs(k6.u - 0.002) < 1e-9 && Math.abs(k6.o - 0.018) < 1e-9);
  var H7 = DAT.toleranz(10, 'H7');
  assert.ok(H7.u === 0 && Math.abs(H7.o - 0.015) < 1e-9);
  var h7 = DAT.toleranz(20, 'h7');
  assert.ok(h7.o === 0 && Math.abs(h7.u + 0.021) < 1e-9);
  var h11 = DAT.toleranz(36, 'h11');
  assert.ok(Math.abs(h11.u + 0.16) < 1e-9);
});

test('Missionsdaten sind in sich stimmig', function () {
  require('../js/missionen.js');
  var MIS = globalThis.ZM.missionen;
  assert.strictEqual(MIS.liste.length, 18);
  MIS.liste.forEach(function (m) {
    assert.ok(DAT.werkstoffe[m.mat], m.id + ' Werkstoff');
    m.ops.forEach(function (op, i) {
      assert.ok(DAT.maschinen[op.maschine], m.id + ' Maschine ' + op.maschine);
      if (op.vor !== undefined) {
        assert.ok(op.vor < i, m.id + ' Verweis auf späteren Arbeitsgang');
        assert.deepStrictEqual(m.ops[op.vor].pos, op.pos, m.id + ' Positionen passen nicht zur Vorbohrung');
      }
      if (op.typ === 'gewinde') { assert.ok(DAT.gewinde[op.gw], m.id + ' Gewinde'); }
      if (op.typ === 'drehen') {
        var K = DAT.drehKontur(op);
        assert.ok(K.stufen.length || K.plan, m.id + ' Drehen ohne Merkmale');
        K.stufen.forEach(function (st, k) {
          assert.ok(st.d < op.wst.D && st.bis < op.wst.L, m.id + ' Drehmaße');
          if (k) { assert.ok(st.d > K.stufen[k - 1].d && st.bis > K.stufen[k - 1].bis, m.id + ' Kontur steigt nicht'); }
          assert.ok(DAT.toleranz(st.d, st.tol), m.id + ' Toleranz ' + st.tol);
        });
        if (K.plan) { assert.ok(K.plan.gesamt < op.wst.L + op.wst.spannL, m.id + ' Planzugabe fehlt'); }
      }
    });
    var wz = m.werkzeuge || {};
    (wz.platten || []).forEach(function (id) { assert.ok(DAT.platte(id), m.id + ' Platte ' + id); });
    (wz.bohrer || []).forEach(function (t) { assert.ok(DAT.bohrerTypen[t], m.id + ' Bohrertyp ' + t); });
    (wz.fraeser || []).forEach(function (t) { assert.ok(DAT.fraeserTypen[t], m.id + ' Fräsertyp ' + t); });
  });
});

// ------------------------------------------------------------ Plandrehen und CNC-Drehen
require('../js/nc.js');
var NC = globalThis.ZM.nc;

function planSim(o) {
  var rng = new PH.Zufall(o.seed || 9);
  var w = new PH.Werkzeug(Object.assign({ typ: 'platte' }, DAT.platte(o.platte || 'CNMG120408-PM')), rng);
  return new PH.DrehSim({
    mat: DAT.werkstoffe[o.mat || 'C45'], wkz: w, masch: DAT.maschinen.drehKonv,
    param: { n: o.n || 630, f: o.f || 0.2, kss: 'emulsion', zAnschlag: null, spitzenhoehe: o.h || 0, planAnschlag: true },
    op: { wst: { D: 50, L: 60, spannL: 40, saege: o.saege !== false } }, rng: rng
  });
}

function planen(sim, zZiel, klemmen) {
  var dt = 1 / 480, t = 0;
  while (t < 8) { sim.step(dt, { spindel: true, kss: true, xZiel: 54, zZiel: t < dt * 1.5 ? zZiel : undefined }); t += dt; }
  while (t < 90 && !sim.planAus && !sim.w.gebrochen) { sim.step(dt, { spindel: true, kss: true, plan: true, klemmen: klemmen }); t += dt; }
  return sim.stirnflaeche();
}

test('Plandrehen mit geklemmtem Bettschlitten: eben, auf Maß, ohne Butzen', function () {
  var sim = planSim({});
  var sf = planen(sim, 59.5, true);
  assert.ok(!sim.w.gebrochen, 'Platte gebrochen');
  assert.ok(Math.abs(sf.z - 59.5) < 0.02, 'Lage ' + sf.z);
  assert.ok(sf.eben < 0.01, 'Ebenheit ' + sf.eben);
  assert.ok(!sf.roh, 'Sägeschnitt stehen geblieben');
  assert.strictEqual(sf.zapfenH, 0);
});

test('Ungeklemmter Bettschlitten: Teil zu lang und Fläche nicht eben', function () {
  var sim = planSim({});
  var sf = planen(sim, 58, false);
  assert.ok(sf.z > 58.005, 'Länge ' + sf.z);
  assert.ok(sf.eben > 0.01, 'Ebenheit ' + sf.eben);
});

test('Schneide unter Mitte läßt einen Butzen stehen, über Mitte reibt sie', function () {
  var unter = planSim({ h: -0.3 });
  var sf = planen(unter, 59.5, true);
  assert.ok(sf.zapfenH > 0.3 && Math.abs(sf.zapfenR - 0.3) < 0.11, JSON.stringify(sf));
  var ueber = planSim({ h: 0.3 });
  planen(ueber, 59.5, true);
  assert.ok(ueber.st.mitteGerieben, 'Reiben am Butzen nicht erkannt');
  assert.strictEqual(ueber.funken, 0, 'In der Drehmitte (vc 0) darf es nicht funken');
});

function cncLauf(o) {
  var rng = new PH.Zufall(3);
  function wkz(id) { return new PH.Werkzeug(Object.assign({ typ: 'platte' }, DAT.platte(id)), rng); }
  var T = { 1: wkz('CNMG120408-PM'), 2: wkz('CNMG120404-PF') };
  var K = DAT.drehKontur({ kontur: [{ d: 30, tol: 'h9', bis: 20 }, { d: 40, tol: 'h11', bis: 45 }], fase: 1 });
  var prog = o.prog || NC.erzeugen({ kontur: K, D0: 50, aufmassZ: 3, vc1: 220, f1: 0.3, ap1: 2.5, vc2: 260, f2: 0.12, smax: o.smax === undefined ? 3000 : o.smax, kss: true, mDir: o.mDir });
  var sim = new PH.DrehSim({ mat: DAT.werkstoffe.C45, wkz: T[1], masch: DAT.maschinen.drehCNC, param: { kss: 'emulsion', zW: 60 },
    op: { wst: { D: 50, L: 63, spannL: 40, saege: true } }, rng: rng });
  sim.x = 100;
  sim.z = 210;
  var lauf = new NC.Lauf(prog, { zW: 60, werkzeug: function (nr) { return T[nr] || null; } });
  lauf.halt = false;
  var inp = {}, dt = 1 / 480, t = 0, maxN = 0;
  while (t < 300 && !lauf.fertig && !sim.w.gebrochen && !sim.alarm) {
    lauf.tick(sim, inp, dt);
    sim.step(dt, inp);
    t += dt;
    if (sim.modus === 'plan' && sim.nEff > maxN) { maxN = sim.nEff; }
  }
  return { sim: sim, lauf: lauf, t: t, maxN: maxN, fehler: NC.uebersetzen(prog).fehler };
}

test('CNC: erzeugtes Programm fertigt den Stufenbolzen in Toleranz', function () {
  var r = cncLauf({});
  assert.deepStrictEqual(r.fehler, []);
  assert.ok(r.lauf.fertig, 'Programm nicht fertig, Zeit ' + r.t + ' ' + (r.sim.alarm || ''));
  var sim = r.sim, zF = sim.laengeZ();
  assert.ok(Math.abs(sim.spannL + zF - 100) < 0.05, 'Gesamtlänge ' + (sim.spannL + zF));
  var b30 = sim.bereich(zF - 19, zF - 1.5), b40 = sim.bereich(zF - 44, zF - 21);
  assert.ok(b30.min >= 29.948 && b30.max <= 30, 'Ø30 h9: ' + b30.min + '…' + b30.max);
  assert.ok(b40.min >= 39.84 && b40.max <= 40, 'Ø40 h11: ' + b40.min + '…' + b40.max);
  assert.ok(Math.abs(sim.absatz(35) - 20) < 0.1, 'Schulter ' + sim.absatz(35));
  assert.ok(b30.ra < 1.6, 'Ra ' + b30.ra);
});

test('CNC: G96 dreht zur Mitte hoch und hält die Begrenzung G92', function () {
  var r = cncLauf({ smax: 2500 });
  assert.ok(r.maxN > 2300 && r.maxN <= 2500.5, 'nMax beim Plandrehen ' + r.maxN);
});

test('CNC: Mit M3 statt M4 bricht die Platte bei der ersten Berührung', function () {
  var r = cncLauf({ mDir: 'M3' });
  assert.ok(r.sim.w.gebrochen && r.sim.w.bruch.art === 'drehrichtung');
});

function ueberlast(o) {
  var rng = new PH.Zufall(5);
  var w = new PH.Werkzeug(Object.assign({ typ: 'platte' }, DAT.platte(o.platte || 'CNMG120408-PM')), rng);
  if (o.VB) { w.VB = o.VB; }
  var sim = new PH.DrehSim({ mat: DAT.werkstoffe[o.mat || 'C45'], wkz: w, masch: DAT.maschinen.drehKonv,
    param: { n: o.n, f: o.f, kss: 'emulsion', zAnschlag: 15 }, op: { wst: { D: 50, L: 60, spannL: 40 } }, rng: rng });
  var dt = 1 / 480, t = 0, xZ = 50 - 2 * o.ap, st = { minN: 1e9, kupplung: 0, ruck: 0, funken: 0 };
  while (t < 3) { sim.step(dt, { spindel: true, kss: true, xZiel: xZ }); t += dt; }
  while (t < (o.dauer || 15) && !sim.anschlagAus && !(o.bisBruch === false && sim.w.gebrochen)) {
    sim.step(dt, { spindel: true, kss: true, vorschub: true, xZiel: xZ });
    t += dt;
    if (t > 4) { st.minN = Math.min(st.minN, sim.nEff); }
    st.kupplung = Math.max(st.kupplung, sim.kupplung);
    st.ruck = Math.max(st.ruck, sim.ruck);
    st.funken = Math.max(st.funken, sim.funken);
  }
  st.sim = sim;
  return st;
}

test('Überlast: zu hohe Drehzahlstufe würgt die Spindel über den Riemen ab', function () {
  var st = ueberlast({ n: 1250, f: 0.63, ap: 2.5, dauer: 8 });
  assert.ok(st.minN < 50, 'Spindel läuft noch: ' + st.minN);
  assert.ok(!st.sim.riemenHaft, 'Riemen rutscht nicht');
});

test('Überlast: stumpfe Schneide läßt die Kupplung ratschen, der Schlitten ruckelt', function () {
  var st = ueberlast({ n: 450, f: 0.5, ap: 3, VB: 0.45, dauer: 10 });
  assert.ok(st.kupplung > 0.4, 'Kupplung ' + st.kupplung);
  assert.ok(st.ruck > 0.4, 'Ruck ' + st.ruck);
});

test('Funken gibt es bei Stahl nach dem Plattenbruch, bei Aluminium nie', function () {
  var stahl = ueberlast({ platte: 'CNMG120404-PF', n: 1250, f: 0.5, ap: 1, dauer: 30, bisBruch: true });
  assert.ok(stahl.sim.w.gebrochen, 'C45 sollte brechen');
  assert.ok(stahl.funken > 50, 'Funken ' + stahl.funken);
  var alu = ueberlast({ mat: 'AlMgSi1', platte: 'CCGT09T304-AL', n: 2500, f: 0.63, ap: 2, dauer: 30, bisBruch: true });
  assert.strictEqual(alu.funken, 0);
});
