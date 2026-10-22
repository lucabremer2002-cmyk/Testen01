/*
 * NC-Programme fuer die CNC-Drehmaschine: Einlesen (DIN 66025, PAL-nah) und
 * Abarbeiten Satz fuer Satz gegen die Drehsimulation.
 *
 * Koordinaten im Programm: X als Durchmesser, Z vom Werkstuecknullpunkt W auf
 * der fertigen Stirnflaeche (minus in Richtung Futter). Die Simulation rechnet
 * mit dem Radius und mit z ab der Backenflaeche; zW ist die Lage von W darin.
 *
 * Unterstuetzt: G0 G1 G2 G3 (mit R) G4 G18 G40 G41 G42 G53 G54 G90 G91 G94 G95
 * G96 G97, Drehzahlbegrenzung G92 S (PAL), G50 S (Fanuc) bzw. LIMS= (Siemens),
 * M0 M1 M3 M4 M5 M8 M9 M17 M30, T0101 bzw. T1 D1, F S X Z U W (inkrementell) R P.
 * Kommentare in Klammern oder nach Semikolon.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  var G_ERLAUBT = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 18: 1, 40: 1, 41: 1, 42: 1, 50: 1, 53: 1, 54: 1, 90: 1, 91: 1, 92: 1, 94: 1, 95: 1, 96: 1, 97: 1 };
  var M_ERLAUBT = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 8: 1, 9: 1, 17: 1, 30: 1 };

  function fmt(v) {
    var s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }

  // ------------------------------------------------------------ Einlesen
  function lesen(text) {
    var zeilen = String(text || '').split(/\r?\n/);
    var saetze = [], fehler = [];
    zeilen.forEach(function (roh, i) {
      var z = roh.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, '').toUpperCase().trim();
      if (!z || z.charAt(0) === '%' || /^O\d+\s*$/.test(z)) { return; }
      var s = { zeile: i, text: roh.trim(), g: [], m: [] };
      z = z.replace(/LIMS\s*=\s*([\d.]+)/, function (_, v) { s.lims = parseFloat(v); return ' '; });
      var re = /([A-Z])\s*([+-]?(?:\d+\.?\d*|\.\d+))/g, mm;
      var rest = z.replace(re, '').replace(/\s+/g, '');
      if (rest) { fehler.push({ zeile: i, text: 'Zeile ' + (i + 1) + ': Syntaxfehler bei „' + rest.slice(0, 8) + '“' }); }
      while ((mm = re.exec(z)) !== null) {
        var b = mm[1], v = parseFloat(mm[2]);
        switch (b) {
          case 'N': s.n = v; break;
          case 'G':
            if (!G_ERLAUBT[v]) { fehler.push({ zeile: i, text: 'Zeile ' + (i + 1) + ': G' + v + ' kennt die Steuerung nicht' }); }
            s.g.push(v);
            break;
          case 'M':
            if (!M_ERLAUBT[v]) { fehler.push({ zeile: i, text: 'Zeile ' + (i + 1) + ': M' + v + ' kennt die Steuerung nicht' }); }
            s.m.push(v);
            break;
          case 'T': s.t = mm[2].replace(/^[+-]/, ''); break;
          case 'X': s.x = v; break;
          case 'Z': s.z = v; break;
          case 'U': s.u = v; break;
          case 'W': s.w = v; break;
          case 'F': s.f = v; break;
          case 'S': s.s = v; break;
          case 'R': s.r = v; break;
          case 'P': s.p = v; break;
          case 'D': s.d = v; break;
          default:
            fehler.push({ zeile: i, text: 'Zeile ' + (i + 1) + ': Adresse ' + b + ' unbekannt' });
        }
      }
      saetze.push(s);
    });
    return { saetze: saetze, fehler: fehler };
  }

  // Werkzeugnummer aus T0101 (Fanuc) oder T1 (Siemens/PAL)
  function werkzeugNr(t) {
    if (t === undefined) { return null; }
    var v = parseInt(t, 10);
    if (t.length >= 3) { return Math.floor(v / 100); }
    return v;
  }

  // Kreis im Radius-Z-Bild (Z nach rechts, X nach oben): G2 im Uhrzeigersinn
  function kreis(x0, z0, x1, z1, R, g2) {
    var p0 = { a: z0, b: x0 / 2 }, p1 = { a: z1, b: x1 / 2 };
    var da = p1.a - p0.a, db = p1.b - p0.b, c = Math.sqrt(da * da + db * db);
    if (c < 1e-6) { return { fehler: 'Kreis ohne Weg' }; }
    var r = Math.abs(R);
    if (r < c / 2 - 1e-6) { return { fehler: 'Kreisradius R' + fmt(r) + ' zu klein für den Weg' }; }
    var hh = Math.sqrt(Math.max(0, r * r - c * c / 4));
    var ma = (p0.a + p1.a) / 2, mb = (p0.b + p1.b) / 2;
    var s = g2 ? 1 : -1;
    if (R < 0) { s = -s; }
    var ca = ma + s * hh * db / c, cb = mb - s * hh * da / c;
    var w0 = Math.atan2(p0.b - cb, p0.a - ca), w1 = Math.atan2(p1.b - cb, p1.a - ca);
    var dw = w1 - w0;
    if (g2) { while (dw > 0) { dw -= 2 * Math.PI; } } else { while (dw < 0) { dw += 2 * Math.PI; } }
    var nSeg = Math.max(4, Math.ceil(Math.abs(dw) * r / 0.2));
    var pkt = [], k;
    for (k = 1; k <= nSeg; k++) {
      var w = w0 + dw * k / nSeg;
      pkt.push({ x: 2 * (cb + r * Math.sin(w)), z: ca + r * Math.cos(w) });
    }
    return { punkte: pkt };
  }

  // Satzfolge in einen Ablauf aus Einzelschritten uebersetzen (modal)
  function uebersetzen(text) {
    var gelesen = lesen(text);
    var st = { mot: 0, abs: true, g95: true, g96: false, x: null, z: null, f: 0, s: 0 };
    var ab = [], fehler = gelesen.fehler.slice();
    gelesen.saetze.forEach(function (s, idx) {
      var gs = s.g;
      var dwell = gs.indexOf(4) >= 0;
      gs.forEach(function (g) {
        if (g <= 3) { st.mot = g; }
        else if (g === 90) { st.abs = true; }
        else if (g === 91) { st.abs = false; }
        else if (g === 94) { st.g95 = false; }
        else if (g === 95) { st.g95 = true; }
        else if (g === 96) { st.g96 = true; }
        else if (g === 97) { st.g96 = false; }
      });
      if (s.f !== undefined && !dwell) { st.f = s.f; }
      var z = s.zeile;
      if (s.t !== undefined) { ab.push({ zeile: z, art: 'werkzeug', nr: werkzeugNr(s.t) }); }
      if (gs.indexOf(92) >= 0 || gs.indexOf(50) >= 0) {
        if (s.s === undefined) { fehler.push({ zeile: z, text: 'Zeile ' + (z + 1) + ': Drehzahlbegrenzung (G92/G50) ohne S-Wert' }); }
        else { ab.push({ zeile: z, art: 'smax', wert: s.s }); }
      } else if (s.s !== undefined) {
        st.s = s.s;
        ab.push({ zeile: z, art: 'drehzahl', g96: st.g96, s: s.s });
      } else if (gs.indexOf(96) >= 0 || gs.indexOf(97) >= 0) {
        ab.push({ zeile: z, art: 'drehzahl', g96: st.g96, s: st.s });
      }
      if (s.lims) { ab.push({ zeile: z, art: 'smax', wert: s.lims }); }
      s.m.forEach(function (m) {
        if (m === 3 || m === 4) { ab.push({ zeile: z, art: 'spindel', dir: m }); }
        if (m === 8) { ab.push({ zeile: z, art: 'kss', an: true }); }
      });
      if (dwell) {
        var t = s.f !== undefined ? s.f : s.p !== undefined ? s.p / 1000 : s.x !== undefined ? s.x : 0;
        ab.push({ zeile: z, art: 'warte', t: t });
      } else if (s.x !== undefined || s.z !== undefined || s.u !== undefined || s.w !== undefined) {
        var nx = st.x, nz = st.z;
        if (s.x !== undefined) { nx = st.abs ? s.x : (st.x === null ? s.x : st.x + s.x); }
        if (s.z !== undefined) { nz = st.abs ? s.z : (st.z === null ? s.z : st.z + s.z); }
        if (s.u !== undefined) { nx = (st.x === null ? 0 : st.x) + s.u; }
        if (s.w !== undefined) { nz = (st.z === null ? 0 : st.z) + s.w; }
        if (nx === null || nz === null) {
          // Erste Bewegung muss beide Achsen kennen: fehlende Achse bleibt stehen
          ab.push({ zeile: z, art: st.mot === 0 ? 'eil' : 'lin', x: nx, z: nz, f: st.f, g95: st.g95, teil: true });
        } else if (st.mot === 2 || st.mot === 3) {
          if (s.r === undefined) { fehler.push({ zeile: z, text: 'Zeile ' + (z + 1) + ': G' + st.mot + ' braucht einen Radius R' }); }
          else if (st.x === null || st.z === null) { fehler.push({ zeile: z, text: 'Zeile ' + (z + 1) + ': Kreis ohne Startpunkt' }); }
          else {
            var k = kreis(st.x, st.z, nx, nz, s.r, st.mot === 2);
            if (k.fehler) { fehler.push({ zeile: z, text: 'Zeile ' + (z + 1) + ': ' + k.fehler }); }
            else { k.punkte.forEach(function (p) { ab.push({ zeile: z, art: 'lin', x: p.x, z: p.z, f: st.f, g95: st.g95 }); }); }
          }
        } else {
          if (st.mot === 1 && !(st.f > 0)) { fehler.push({ zeile: z, text: 'Zeile ' + (z + 1) + ': G1 ohne Vorschub F' }); }
          ab.push({ zeile: z, art: st.mot === 0 ? 'eil' : 'lin', x: nx, z: nz, f: st.f, g95: st.g95 });
        }
        st.x = nx;
        st.z = nz;
      }
      s.m.forEach(function (m) {
        if (m === 5) { ab.push({ zeile: z, art: 'spindel', dir: 0 }); }
        if (m === 9) { ab.push({ zeile: z, art: 'kss', an: false }); }
        if (m === 0 || m === 1) { ab.push({ zeile: z, art: 'halt' }); }
        if (m === 30 || m === 2 || m === 17) { ab.push({ zeile: z, art: 'ende' }); }
      });
      if (idx === gelesen.saetze.length - 1 && !ab.some(function (a) { return a.art === 'ende'; })) {
        fehler.push({ zeile: z, text: 'Programmende M30 fehlt' });
      }
    });
    return { ab: ab, fehler: fehler, saetze: gelesen.saetze };
  }

  // ------------------------------------------------------------ Abarbeiten
  // opt: { zW, werkzeug(nr) -> Werkzeug oder null, wechselZeit }
  function Lauf(text, opt) {
    var p = uebersetzen(text);
    this.ab = p.ab;
    this.fehler = p.fehler;
    this.opt = opt;
    this.k = 0;
    this.halt = true;
    this.fertig = false;
    this.einzelsatz = false;
    this.warten = 0;
    this.zustand = { dir: 0, g96: false, s: 0, smax: null, kss: false, tnr: opt.tnr || 1 };
    this.ziel = null;
    this.meldungen = [];
  }

  Lauf.prototype.zeile = function () {
    var a = this.ab[Math.min(this.k, this.ab.length - 1)];
    return a ? a.zeile : -1;
  };

  Lauf.prototype.melden = function (text, art) { this.meldungen.push({ text: text, art: art || 'info' }); };

  // Solldrehzahl, die die Steuerung gerade ausgibt
  Lauf.prototype.nSoll = function (sim) {
    var zs = this.zustand, m = sim.m;
    if (!zs.dir) { return 0; }
    if (zs.g96) {
      var d = Math.max(2 * sim.rEff(), 0.5);
      return Math.min(zs.smax || m.nMax, m.nMax, zs.s * 1000 / (Math.PI * d));
    }
    return Math.min(zs.s, m.nMax);
  };

  Lauf.prototype.weiter = function () {
    var alt = this.ab[this.k];
    this.k += 1;
    this.ziel = null;
    var neu = this.ab[this.k];
    if (this.einzelsatz && alt && neu && neu.zeile !== alt.zeile) { this.halt = true; }
  };

  // Ein Simulationsschritt: setzt die Eingaben fuer die Drehsimulation
  Lauf.prototype.tick = function (sim, inp, dt) {
    var zs = this.zustand;
    inp.spindel = zs.dir !== 0;
    inp.kss = zs.kss;
    inp.g96 = zs.g96 ? { vc: zs.s, smax: zs.smax } : null;
    inp.n = zs.g96 ? undefined : zs.s;
    inp.bahn = null;
    if (this.fertig || this.halt || sim.alarm || inp.notaus) { return; }
    var schritte = 0;
    while (schritte++ < 20 && this.k < this.ab.length) {
      var a = this.ab[this.k];
      if (a.art === 'drehzahl') { zs.g96 = a.g96; zs.s = a.s; this.weiter(); continue; }
      if (a.art === 'smax') { zs.smax = a.wert; this.weiter(); continue; }
      if (a.art === 'spindel') {
        zs.dir = a.dir;
        if (a.dir === 3) { sim.drehrichtung = 3; }
        if (a.dir === 4) { sim.drehrichtung = 4; }
        this.weiter();
        continue;
      }
      if (a.art === 'kss') { zs.kss = a.an; this.weiter(); continue; }
      if (a.art === 'halt') { this.halt = true; this.weiter(); this.melden('M0: Programmierter Halt. Weiter mit NC-Start.'); return; }
      if (a.art === 'ende') {
        zs.dir = 0;
        zs.kss = false;
        this.fertig = true;
        inp.spindel = false;
        inp.kss = false;
        this.melden('M30: Programmende.', 'ende');
        return;
      }
      if (a.art === 'warte') {
        if (this.warten <= 0 && !this.ziel) { this.warten = a.t; this.ziel = true; }
        this.warten -= dt;
        if (this.warten <= 0) { this.warten = 0; this.weiter(); continue; }
        break;
      }
      if (a.art === 'werkzeug') {
        if (!this.ziel) {
          this.ziel = true;
          // Revolver schaltet auf dem kuerzesten Weg: 0,25 s plus 0,1 s je weitere Station
          var plaetze = sim.m.revolver || 12, dSt = Math.abs(a.nr - zs.tnr);
          dSt = Math.min(dSt, plaetze - dSt);
          this.warten = dSt ? (this.opt.wechselZeit || 0.25) + 0.1 * (dSt - 1) : 0.05;
          if (sim.revolverKollision && sim.revolverKollision()) { this.halt = true; return; }
        }
        this.warten -= dt;
        if (this.warten > 0) { break; }
        var w = this.opt.werkzeug ? this.opt.werkzeug(a.nr) : null;
        if (!w) {
          sim.alarmSetzen('Alarm: Werkzeug T' + a.nr + ' ist im Revolver nicht bestückt.');
          this.ziel = null;
          return;
        }
        if (w !== sim.w) { sim.werkzeugWechsel(w); }
        zs.tnr = a.nr;
        this.melden('Revolver auf T' + a.nr + ': ' + (w.def.name || ''));
        this.weiter();
        continue;
      }
      if (a.art === 'eil' || a.art === 'lin') {
        var tx = a.x === null ? sim.x * 2 : a.x + (this.korrX || 0);
        var tz = a.z === null ? sim.z : this.opt.zW + a.z;
        if (a.art === 'lin') {
          if (!zs.dir) {
            if (!this.wartetSpindel) { this.melden('Vorschub wartet: Die Spindel ist nicht eingeschaltet (M3/M4 fehlt).', 'warn'); }
            this.wartetSpindel = true;
            break;
          }
          if (sim.nEff < 0.85 * this.nSoll(sim) && a.g95) { break; }
        }
        this.wartetSpindel = false;
        inp.bahn = { x: tx, z: tz, eil: a.art === 'eil', f: a.g95 ? a.f : 0, fmin: a.g95 ? 0 : a.f };
        if (Math.abs(sim.x * 2 - tx) < 2e-4 && Math.abs(sim.z - tz) < 1e-4) {
          inp.bahn = null;
          this.weiter();
          continue;
        }
        break;
      }
      this.weiter();
    }
  };

  // ------------------------------------------------------------ Programmgenerator
  // Erzeugt ein Programm fuer eine Drehkontur mit Planen, Schruppen und Schlichten.
  // c: { kontur (DAT.drehKontur), D0, aufmassZ (Rohteil ueber Z0), t1, t2, vc1, f1, ap1, vc2, f2,
  //      smax, xAuf, zAuf, apPlan, kss, name, nr }
  function erzeugen(c) {
    var z = [], nr = 10;
    function satz(t) { z.push('N' + nr + ' ' + t); nr += 10; }
    var D0 = c.D0, xs = D0 + 4, k = c.kontur, st = k.stufen;
    var mDir = c.mDir || 'M4';
    z.push('%O' + (c.nr || 2000) + ' (' + (c.name || 'DREHTEIL').toUpperCase() + ')');
    satz('G18 G54 G90 G95');
    satz('G0 X200 Z150');
    satz('T0101 (' + (c.t1 ? c.t1.toUpperCase() : 'SCHRUPPEN') + ')');
    if (c.smax) { satz('G92 S' + Math.round(c.smax)); }
    satz('G96 S' + Math.round(c.vc1 || 0) + ' ' + mDir);
    if (c.kss) { satz('M8'); }
    // Planschruppen in Ebenen bis auf das Planaufmass, jede Ebene von aussen zur Mitte
    var aufZ = c.aufmassZ || 0;
    var xAuf = c.xAuf === undefined ? 0.4 : c.xAuf, zAuf = c.zAuf === undefined ? 0.1 : c.zAuf;
    var apP = c.apPlan || c.ap1 || 2;
    if (aufZ > zAuf + 0.01) {
      var zp = aufZ, ebenen = 0;
      satz('G0 X' + fmt(xs) + ' Z' + fmt(aufZ + 2));
      while (zp > zAuf + 1e-6 && ebenen < 20) {
        zp = Math.max(zAuf, zp - apP);
        ebenen++;
        if (ebenen > 1) { satz('G0 X' + fmt(xs)); }
        satz('G0 Z' + fmt(zp));
        satz('G1 X-1.6 F' + fmt(c.f1));
        satz('G0 Z' + fmt(zp + 2));
      }
    }
    // Laengsschruppen mit Aufmass, Ebene fuer Ebene von aussen
    var ap = c.ap1 || 2, k2;
    // Stuetzstellen: Rohdurchmesser und jede Stufe mit Schlichtaufmass; dazwischen gleich tiefe Schnitte
    var stuetz = [D0];
    st.map(function (s) { return s.d + 2 * xAuf; }).sort(function (p, q) { return q - p; }).forEach(function (t) {
      if (t < stuetz[stuetz.length - 1] - 0.05) { stuetz.push(t); }
    });
    var ebenenX = [], i2;
    for (i2 = 1; i2 < stuetz.length; i2++) {
      var oben = stuetz[i2 - 1], unten = stuetz[i2], nS = Math.max(1, Math.ceil((oben - unten) / (2 * ap) - 1e-6)), j2;
      for (j2 = 1; j2 <= nS; j2++) { ebenenX.push(oben - (oben - unten) * j2 / nS); }
    }
    ebenenX.slice(0, 60).forEach(function (x) {
      // Laenge dieser Ebene: bis zur ersten Schulter, deren Durchmesser (mit Aufmass) groesser ist
      var bis = 0;
      for (k2 = 0; k2 < st.length; k2++) {
        if (st[k2].d + 2 * xAuf <= x + 1e-6) { bis = st[k2].bis; } else { break; }
      }
      if (bis <= 0) { return; }
      satz('G0 X' + fmt(x) + ' Z2');
      satz('G1 Z' + fmt(-(bis - zAuf)) + ' F' + fmt(c.f1));
      satz('G1 X' + fmt(x + 1.5));
      satz('G0 Z2');
    });
    satz('G0 X200 Z150 M9');
    // Schlichten mit T2
    satz('T0202 (' + (c.t2 ? c.t2.toUpperCase() : 'SCHLICHTEN') + ')');
    satz('G96 S' + Math.round(c.vc2 || c.vc1 || 0) + ' ' + mDir);
    if (c.kss) { satz('M8'); }
    // Plan schlichten auf Z0, dann die Kontur mit Fase von der Stirnseite zum Futter
    var f2 = c.f2 || c.f1, fa = k.fase || 0;
    satz('G0 X' + fmt(xs) + ' Z2');
    satz('G0 Z0');
    satz('G1 X-1.6 F' + fmt(f2));
    satz('G0 Z1');
    if (st.length) {
      var s0 = st[0];
      satz('G0 X' + fmt(Math.max(0, s0.d - 2 * fa - 2)));
      satz('G1 Z0');
      satz('G1 X' + fmt(s0.d - 2 * fa));
      if (fa > 0) { satz('G1 X' + fmt(s0.d) + ' Z' + fmt(-fa)); }
      st.forEach(function (s, i) {
        satz('G1 Z' + fmt(-s.bis));
        var naechst = i + 1 < st.length ? st[i + 1].d : D0 + 1;
        satz('G1 X' + fmt(naechst));
      });
    }
    satz('G0 X' + fmt(xs));
    satz('G0 X200 Z150 M9');
    satz('M30');
    return z.join('\n');
  }

  ZM.nc = { lesen: lesen, uebersetzen: uebersetzen, Lauf: Lauf, erzeugen: erzeugen, fmt: fmt };
})(typeof window !== 'undefined' ? window : globalThis);
