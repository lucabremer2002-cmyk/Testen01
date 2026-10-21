/*
 * Gemeinsame Helfer fuer Tests: laedt die Module in Node und stellt
 * einfache "Bediener" bereit, die eine Bearbeitung durchfuehren.
 */
'use strict';

require('../js/daten.js');
require('../js/physik.js');

var ZM = globalThis.ZM;
var DAT = ZM.daten;
var PH = ZM.physik;

function werkzeug(def, seed) {
  return new PH.Werkzeug(def, new PH.Zufall(seed || 7));
}

function bohrSim(o) {
  var rng = new PH.Zufall(o.seed || 11);
  var def = o.def;
  var w = o.wkz || new PH.Werkzeug(def, rng);
  return new PH.BohrSim({
    mat: DAT.werkstoffe[o.mat],
    wkz: w,
    masch: DAT.maschinen[o.masch || 'saeule'],
    param: Object.assign({ n: 1000, fAuto: 0.1, kss: 'emulsion', zAnschlag: null, spann: 'fest', pos: 'anreissen', anbohren: false }, o.param || {}),
    op: Object.assign({ dicke: 10, durch: true, anzahl: 1 }, o.op || {}),
    vor: o.vor || [],
    rng: rng
  });
}

// Bediener an der Saeulenbohrmaschine: regelt die Hebelkraft auf einen
// Zielvorschub und entspant, wenn die Spannuten voll werden.
function handBohren(sim, o) {
  var dt = 1 / 480;
  var kraft = 0;
  var zeit = 0;
  var zielF = o.f;
  var phase = 'bohren';
  var entspanAb = o.entspanen === undefined ? 0.75 : o.entspanen;
  var ziel = o.tiefe;
  var log = [];
  var maxM = 0;
  var rueckZeit = 0;
  while (zeit < (o.maxZeit || 60)) {
    var inp = { spindel: true, kss: o.kss !== false, kraft: kraft };
    sim.step(dt, inp);
    zeit += dt;
    var a = sim.anzeige();
    if (a.M > maxM) { maxM = a.M; }
    var ev = sim.ev.holen();
    ev.forEach(function (e) { log.push(e); });
    if (sim.w.gebrochen || sim.unfall) { break; }
    if (phase === 'bohren') {
      if (sim.z > 0.2 && sim.f > 0) {
        kraft += (zielF - sim.f) * 0.02;
      } else if (sim.z <= 0.2) {
        kraft = Math.max(kraft, 0.05);
        kraft += 0.0005;
      }
      if (o.konstantKraft !== undefined) { kraft = o.konstantKraft; }
      kraft = Math.max(0, Math.min(1, kraft));
      if (entspanAb && sim.phi > entspanAb) { phase = 'raus'; }
      if (sim.z >= ziel) { phase = 'ende'; }
    } else if (phase === 'raus') {
      kraft = -1;
      if (sim.z < -1) { rueckZeit += dt; }
      if (rueckZeit > 0.4) { phase = 'bohren'; rueckZeit = 0; kraft = 0.05; }
    } else if (phase === 'ende') {
      kraft = -1;
      if (sim.z < -5) { break; }
    }
  }
  return { zeit: zeit, log: log, maxM: maxM, gebrochen: sim.w.gebrochen, bruch: sim.w.bruch, unfall: sim.unfall };
}

module.exports = { ZM: ZM, DAT: DAT, PH: PH, werkzeug: werkzeug, bohrSim: bohrSim, handBohren: handBohren };
