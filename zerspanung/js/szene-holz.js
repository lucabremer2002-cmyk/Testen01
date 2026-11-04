/*
 * Drechselbank in der Seitenansicht: Werkstattwand mit Lichteinfall, Bett,
 * Spindelstock mit Mitnehmer, Reitstock mit mitlaufender Spitze, Handauflage.
 *
 * Das Werkstueck wird pixelweise schattiert (Rotationskoerper): Normale aus
 * Hoehe und Steigung des Profils, Jahrringe aus dem Abstand zum Mark. Dreht
 * die Spindel, mittelt das Auge ueber den Umfang (Ringe als Baender entlang
 * der Kontur); steht sie, sieht man das Kantholz und die Flammen der Ringe.
 * Neu gerechnet werden nur die Spalten, an denen gedrechselt wurde.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  if (!ZM.holz) { return; }
  var HZ = ZM.holz, DZ = HZ.DZ;
  var TAU = Math.PI * 2, SQ2 = Math.SQRT2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function glatt(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function zufall(a, b) { return a + Math.random() * (b - a); }
  function rgb(c, k, al) {
    k = k === undefined ? 1 : k;
    var r = Math.round(clamp(c[0] * k, 0, 255)), g = Math.round(clamp(c[1] * k, 0, 255)), b = Math.round(clamp(c[2] * k, 0, 255));
    return al === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + al.toFixed(3) + ')';
  }
  function hexRgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }

  // Licht von links oben vorn, Blick entlang +x (zum Betrachter)
  var L = (function () { var v = [-0.36, 0.56, 0.75], l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  var HV = (function () { var v = [L[0], L[1], L[2] + 1], l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();

  var OBERFLAECHE = {
    roh: { glanz: 0.05, haerte: 10, satt: 1 },
    oel: { glanz: 0.3, haerte: 26, satt: 1.28 },
    wachs: { glanz: 0.6, haerte: 60, satt: 1.14 },
    lack: { glanz: 0.95, haerte: 120, satt: 1.2 }
  };
  var BEIZEN = {
    rot: { name: 'Rot', rgb: [205, 40, 48] }, blau: { name: 'Blau', rgb: [40, 98, 214] }, gruen: { name: 'Grün', rgb: [36, 160, 84] },
    lila: { name: 'Lila', rgb: [146, 60, 200] }, schwarz: { name: 'Schwarz', rgb: [46, 40, 38] }, gold: { name: 'Gold', rgb: [236, 186, 62] }
  };
  var REGENBOGEN = [[232, 52, 64], [246, 142, 20], [255, 214, 32], [70, 182, 40], [10, 152, 206], [74, 66, 196], [196, 92, 236]];

  // ============================================================ Pixel-Shader
  // Faerbt die Pixelspalten c0..c1 eines horizontal liegenden Werkstuecks.
  // o: { d (Uint8ClampedArray), w, h, q (px je mm), prof (Radien je DZ), a, holz, seed, mark,
  //      drehend, winkel, rau, brand, oberflaeche, wisch: {pos (mm), art, beize} }
  function spaltenRendern(o, c0, c1) {
    var d = o.d, w = o.w, hp = o.h, q = o.q, prof = o.prof, N = prof.length, a = o.a, holz = o.holz;
    var mitte = hp / 2, Rv0 = a * SQ2;
    var hell = holz.hell, dunkel = holz.dunkel, ring = holz.ring, kon = holz.kontrast;
    var px, py;
    for (px = Math.max(0, c0); px <= Math.min(w - 1, c1); px++) {
      var z = (px + 0.5) / q, fz = z / DZ - 0.5, i = Math.floor(fz), t = fz - i;
      var i0 = clamp(i, 0, N - 1), i1 = clamp(i + 1, 0, N - 1);
      var R = prof[i0] + (prof[i1] - prof[i0]) * t;
      var steig = (prof[clamp(i + 2, 0, N - 1)] - prof[clamp(i - 1, 0, N - 1)]) / (3 * DZ);
      var rau = o.rau ? o.rau[i0] : 0, brand = o.brand ? o.brand[i0] : 0;
      var ob = OBERFLAECHE[o.oberflaeche.art] || OBERFLAECHE.roh, beize = o.oberflaeche.beize;
      if (o.wisch && z < o.wisch.pos) { ob = OBERFLAECHE[o.wisch.art] || ob; beize = o.wisch.beize !== undefined ? o.wisch.beize : beize; }
      // Steht die Spindel, sieht man das echte Holz: Kantholz bzw. die Flammen der Jahrringe
      var stehend = !o.drehend;
      var Rv = Math.min(R, Rv0);
      // Maserung entlang der Achse
      var zn = holz.maser * ((HZ.rauschen1(z * 0.025 + o.seed) - 0.5) * 1.6 + (HZ.rauschen1(z * 0.11 + o.seed * 3) - 0.5) * 0.5);
      var riefe = 1 - rau * 0.16 * (0.5 + 0.5 * Math.sin(z * TAU / 1.3));
      var spalteFarbe = stehend ? null : holzFarbe(holz, Rv, z, zn, o.seed, true);
      for (py = 0; py < hp; py++) {
        var y = (mitte - py - 0.5) / q;        // mm, nach oben positiv
        var ay = Math.abs(y), k = (px + py * w) * 4;
        var alpha, nx, ny, nz, rho, farbe;
        if (!stehend) {
          if (ay > Rv + 0.5 / q) { d[k + 3] = 0; continue; }
          alpha = R <= a || ay <= a ? 1 : 2 - (4 / Math.PI) * Math.asin(Math.min(1, ay / Rv0));
          alpha *= clamp((Rv - ay) * q + 0.5, 0, 1);
          var sn = clamp(y / Rv, -1, 1), cs = Math.sqrt(1 - sn * sn), sl = R <= Rv0 ? steig : 0, nl = 1 / Math.sqrt(1 + sl * sl);
          nx = cs * nl; ny = sn * nl; nz = -sl * nl;
          farbe = spalteFarbe;
        } else {
          // Kantholz steht: vorderster Punkt von (gedrehtem Quadrat ∩ Kreis R) in dieser Hoehe
          var al = o.winkel, ca = Math.cos(al), sa = Math.sin(al);
          var lo = -Infinity, hi = Infinity, nHi = 0;
          var b1 = intervall(ca, y * sa, a), b2 = intervall(-sa, y * ca, a);
          if (b1 === null || b2 === null || ay > R) { d[k + 3] = 0; continue; }
          if (b1[0] > lo) { lo = b1[0]; } if (b1[1] < hi) { hi = b1[1]; nHi = 1; }
          if (b2[0] > lo) { lo = b2[0]; } if (b2[1] < hi) { hi = b2[1]; nHi = 2; }
          var xc = Math.sqrt(Math.max(0, R * R - y * y));
          if (-xc > lo) { lo = -xc; } if (xc < hi) { hi = xc; nHi = 3; }
          if (hi < lo) { d[k + 3] = 0; continue; }
          var xs = hi;
          if (nHi === 3) { var nl3 = 1 / Math.sqrt(1 + steig * steig); nx = xs / R * nl3; ny = y / R * nl3; nz = -steig * nl3; }
          else if (nHi === 1) { nx = b1[2] * ca; ny = b1[2] * sa; nz = 0; }
          else { nx = -b2[2] * sa; ny = b2[2] * ca; nz = 0; }
          alpha = clamp((hi - lo) * q, 0, 1);
          // Punkt im Holz (Spindel zurueckgedreht) und Abstand zum Mark
          var wx = xs * ca + y * sa, wy = -xs * sa + y * ca;
          rho = Math.sqrt((wx - o.mark.x) * (wx - o.mark.x) + (wy - o.mark.y) * (wy - o.mark.y));
          farbe = holzFarbe(holz, rho, z, zn, o.seed, false, wx, wy);
        }
        // Licht: diffus, Glanz (rau = matt), warmes Gegenlicht am Rand
        var dif = nx * L[2] + ny * L[1] + nz * L[0]; if (dif < 0) { dif = 0; }
        var hs = nx * HV[2] + ny * HV[1] + nz * HV[0]; if (hs < 0) { hs = 0; }
        var spec = Math.pow(hs, ob.haerte) * ob.glanz * (1 - rau * 0.85) * 255;
        var rim = Math.pow(1 - nx, 4) * 0.16 * clamp(ny + 0.35, 0, 1);
        var cr = farbe[0], cg = farbe[1], cb = farbe[2];
        if (ob.satt !== 1) { cr = 255 * Math.pow(cr / 255, ob.satt); cg = 255 * Math.pow(cg / 255, ob.satt); cb = 255 * Math.pow(cb / 255, ob.satt); }
        if (beize) { var bz = BEIZEN[beize].rgb; cr = cr * (0.35 + 0.65 * bz[0] / 210); cg = cg * (0.35 + 0.65 * bz[1] / 210); cb = cb * (0.35 + 0.65 * bz[2] / 210); }
        if (brand > 0.02) { var bk = Math.min(1, brand * 1.15); cr += (22 - cr) * bk; cg += (16 - cg) * bk; cb += (12 - cb) * bk; }
        var licht = (0.26 + 0.92 * dif) * riefe;
        d[k] = cr * licht + spec + rim * 255 + (farbe[3] || 0);
        d[k + 1] = cg * licht + spec + rim * 196 + (farbe[3] || 0) * 0.9;
        d[k + 2] = cb * licht + spec * 0.95 + rim * 150 + (farbe[3] || 0) * 1.2;
        d[k + 3] = alpha * 255;
      }
    }
  }

  // Erlaubtes x-Intervall fuer |x*c + yk| <= a, dazu das Vorzeichen der Flaechennormale am oberen Ende
  function intervall(c, yk, a) {
    if (Math.abs(c) < 1e-6) { return Math.abs(yk) <= a ? [-Infinity, Infinity, 0] : null; }
    var u = (a - yk) / c, v = (-a - yk) / c;
    return u > v ? [v, u, 1] : [u, v, -1];
  }

  // Holzfarbe aus dem Abstand zum Mark (Jahrringe), [r, g, b, leuchten]
  var FARBE = [0, 0, 0, 0];
  function holzFarbe(holz, rho, z, zn, seed, gemittelt, wx, wy) {
    var t = rho / holz.ring + zn, c;
    if (holz.regenbogen) {
      var lage = Math.floor(t), fr = t - lage;
      c = REGENBOGEN[((lage + seed) % 7 + 7) % 7];
      var leim = fr < 0.06 || fr > 0.97 ? 0.55 : 1;
      FARBE[0] = c[0] * leim; FARBE[1] = c[1] * leim; FARBE[2] = c[2] * leim; FARBE[3] = 0;
      return FARBE;
    }
    var f = t - Math.floor(t);
    var spaet = holz.streifen ? glatt(0.48, 0.56, f) - glatt(0.92, 0.99, f) : glatt(0.6, 0.8, f) - glatt(0.9, 1, f);
    var k = holz.kontrast * (gemittelt ? 0.85 : 1) * spaet;
    var r = holz.hell[0] + (holz.dunkel[0] - holz.hell[0]) * k, g = holz.hell[1] + (holz.dunkel[1] - holz.hell[1]) * k, b = holz.hell[2] + (holz.dunkel[2] - holz.hell[2]) * k;
    if (!gemittelt) {
      // Fasern und Markstrahlen nur im Stillstand sichtbar
      var faser = HZ.hash1(Math.floor(z * 2.5) * 13 + Math.floor((Math.atan2(wy, wx) + 4) * 40)) - 0.5;
      r *= 1 + faser * 0.07; g *= 1 + faser * 0.07; b *= 1 + faser * 0.07;
    }
    FARBE[3] = 0;
    if (holz.epoxid && HZ.rauschen2(z * 0.045 + seed, rho * 0.22) > 0.6) {
      var m = HZ.rauschen2(z * 0.02 + 9, rho * 0.08);
      r = 20 + 70 * m; g = 200 - 120 * m; b = 225 + 25 * m;
      FARBE[3] = 34;
    }
    FARBE[0] = r; FARBE[1] = g; FARBE[2] = b;
    return FARBE;
  }

  // ============================================================ Szene
  function HolzSzene(sim) {
    this.sim = sim;
    this.W = 0; this.H = 0; this.dpr = 1;
    this.teile = [];
    this.motes = [];
    this.wisch = null;
    this.modusDreh = null; this.winkelGezeichnet = null; this.obKey = '';
    this.heapH = null;
    this.zeit = 0;
    this.blitz = 0;
    this.lack = hexRgb((ZM.optik && ZM.optik.lack) || '#5f7560');
    var i;
    for (i = 0; i < 26; i++) { this.motes.push({ x: Math.random(), y: Math.random(), v: zufall(0.004, 0.012), ph: Math.random() * TAU }); }
  }

  HolzSzene.prototype.layout = function (W, H, dpr) {
    var sim = this.sim, Rv = sim.a * SQ2;
    this.W = W; this.H = H; this.dpr = dpr;
    var pl = clamp(W * 0.13, 64, 170), pr = clamp(W * 0.11, 56, 150);
    this.s = Math.min((W - pl - pr) / sim.L, (H * 0.42) / (2 * Rv));
    this.x0 = pl + ((W - pl - pr) - sim.L * this.s) / 2;
    this.yc = Math.round(H * 0.4);
    this.restY = this.yc + (Rv + 3) * this.s + 6;
    this.bettY = Math.round(H * 0.79);
    // Werkstueck-Puffer in CSS-Pixeln (hoechstens 1,5-fach), wird nur spaltenweise neu gerechnet
    this.q = this.s * Math.min(1.5, dpr);
    var bw = Math.max(2, Math.ceil(sim.L * this.q)), bh = Math.max(2, Math.ceil(2 * Rv * this.q) + 2);
    this.wcv = document.createElement('canvas');
    this.wcv.width = bw; this.wcv.height = bh;
    this.wctx = this.wcv.getContext('2d');
    this.wimg = this.wctx.createImageData(bw, bh);
    this.modusDreh = null;
    // Spaenehaufen auf dem Bett
    this.hcv = document.createElement('canvas');
    this.hcv.width = Math.round(W * dpr); this.hcv.height = Math.round(H * dpr);
    this.hctx = this.hcv.getContext('2d');
    this.hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.heapH = new Float32Array(Math.ceil(W / 4) + 2);
    this.hintergrund();
  };

  // ------------------------------------------------------------ Kulisse (einmal je Groesse)
  HolzSzene.prototype.hintergrund = function () {
    var W = this.W, H = this.H, dpr = this.dpr, sim = this.sim, s = this.s, Rv = sim.a * SQ2;
    var cv = this.bg = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Wand aus Brettern, warmes Licht
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b2c21'); g.addColorStop(0.55, '#2a1f18'); g.addColorStop(1, '#17110d');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var x, k = 0;
    for (x = 0; x < W; x += 46 + (k++ % 3) * 9) {
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(x, 0, 2, this.bettY);
      c.fillStyle = 'rgba(255,220,180,0.035)'; c.fillRect(x + 2, 0, 1, this.bettY);
    }
    // Lochwand mit Werkzeugschatten
    var lx = W * 0.56, ly = H * 0.06, lw = Math.min(W * 0.36, 380), lh = H * 0.22;
    c.fillStyle = '#5a4634'; c.fillRect(lx, ly, lw, lh);
    c.fillStyle = 'rgba(20,12,8,0.55)';
    var yy;
    for (yy = ly + 9; yy < ly + lh - 4; yy += 14) { for (x = lx + 9; x < lx + lw - 4; x += 14) { c.beginPath(); c.arc(x, yy, 1.6, 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(22,15,11,0.85)';
    c.fillRect(lx + lw * 0.1, ly + lh * 0.2, 6, lh * 0.62); c.fillRect(lx + lw * 0.1 - 9, ly + lh * 0.2, 24, 12);
    c.fillRect(lx + lw * 0.3, ly + lh * 0.18, lw * 0.18, 5); c.fillRect(lx + lw * 0.3, ly + lh * 0.18, 5, lh * 0.5);
    [0.58, 0.66, 0.74, 0.82].forEach(function (f, j) { c.fillRect(lx + lw * f, ly + lh * 0.16, 4, lh * (0.5 + j * 0.06)); c.fillRect(lx + lw * f - 2, ly + lh * (0.62 + j * 0.06), 8, lh * 0.14); });
    // Lampe links oben
    var lg = c.createRadialGradient(W * 0.18, -H * 0.05, 10, W * 0.18, -H * 0.05, H * 0.9);
    lg.addColorStop(0, 'rgba(255,200,130,0.28)'); lg.addColorStop(0.5, 'rgba(255,170,90,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    // Lichtschacht vom Fenster
    c.save();
    c.globalCompositeOperation = 'lighter';
    var sg = c.createLinearGradient(W * 0.05, 0, W * 0.45, H);
    sg.addColorStop(0, 'rgba(255,226,170,0.09)'); sg.addColorStop(1, 'rgba(255,226,170,0)');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(W * 0.02, 0); c.lineTo(W * 0.22, 0); c.lineTo(W * 0.62, H); c.lineTo(W * 0.3, H); c.closePath(); c.fill();
    c.restore();
    // Bett (Gusseisen) und Werkbank
    var lack = this.lack, bettY = this.bettY;
    var bg2 = c.createLinearGradient(0, bettY, 0, H);
    bg2.addColorStop(0, '#4c3a2c'); bg2.addColorStop(0.08, '#3a2b20'); bg2.addColorStop(1, '#1d1611');
    c.fillStyle = bg2; c.fillRect(0, bettY + 22, W, H - bettY - 22);
    var xa = this.x0 - Math.min(150, W * 0.13) - 10, xb = this.x0 + sim.L * s + Math.min(140, W * 0.11) + 10;
    var bt = c.createLinearGradient(0, bettY, 0, bettY + 24);
    bt.addColorStop(0, rgb(lack, 1.3)); bt.addColorStop(0.3, rgb(lack, 0.95)); bt.addColorStop(1, rgb(lack, 0.5));
    c.fillStyle = bt; c.fillRect(xa, bettY, xb - xa, 24);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(xa, bettY, xb - xa, 1.5);
    // Handauflage: Stuetze und Auflagestange
    var restY = this.restY, rx0 = this.x0 - 6, rx1 = this.x0 + sim.L * s + 6;
    c.fillStyle = rgb([70, 72, 76]); c.fillRect(this.x0 + sim.L * s * 0.45, restY + 6, 14, bettY - restY - 6);
    c.fillStyle = rgb([58, 60, 64]); c.fillRect(this.x0 + sim.L * s * 0.45 - 30, bettY - 12, 74, 14);
    var rg = c.createLinearGradient(0, restY, 0, restY + 8);
    rg.addColorStop(0, '#d4d8dc'); rg.addColorStop(0.4, '#8c949a'); rg.addColorStop(1, '#4b5157');
    c.fillStyle = rg; c.fillRect(rx0, restY, rx1 - rx0, 7);
    // Spindelstock links
    var hx1 = this.x0 - 6, hx0 = Math.max(4, hx1 - Math.min(150, W * 0.13)), hy0 = this.yc - Math.max(60, Rv * s * 1.8), hy1 = bettY;
    gehaeuse(c, hx0, hy0, hx1 - hx0, hy1 - hy0, lack);
    // Reitstock rechts
    var tx0 = this.x0 + sim.L * s + 26, tx1 = Math.min(W - 4, tx0 + Math.min(120, W * 0.1)), ty0 = this.yc - Math.max(34, Rv * s * 1.05);
    gehaeuse(c, tx0, ty0, tx1 - tx0, bettY - ty0, lack);
    // Pinole des Reitstocks
    var pg = c.createLinearGradient(0, this.yc - 9, 0, this.yc + 9);
    pg.addColorStop(0, '#9aa2a8'); pg.addColorStop(0.45, '#e6eaec'); pg.addColorStop(1, '#5b6268');
    c.fillStyle = pg; c.fillRect(this.x0 + sim.L * s + 8, this.yc - 8, tx0 - (this.x0 + sim.L * s + 8) + 2, 16);
    this.kulisse = { hx0: hx0, hx1: hx1, hy0: hy0, tx0: tx0, tx1: tx1, ty0: ty0 };
  };

  function gehaeuse(c, x, y, w, h, lack) {
    var g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, rgb(lack, 0.62)); g.addColorStop(0.35, rgb(lack, 1.12)); g.addColorStop(1, rgb(lack, 0.72));
    c.fillStyle = g;
    c.beginPath();
    var r = Math.min(14, w / 4);
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 3, y + h * 0.55, w - 6, 2);
  }

  // ------------------------------------------------------------ Werkstueck neu rechnen
  HolzSzene.prototype.werkstueckAktualisieren = function () {
    var sim = this.sim, drehend = sim.nEff > 90 || sim.r[0] === undefined;
    var obKey = sim.oberflaeche.art + '|' + sim.oberflaeche.beize + '|' + (this.wisch ? this.wisch.pos.toFixed(1) : '');
    // Im Stillstand dreht das Kantholz beim Auslaufen noch: hoechstens alle 0,12 s komplett neu
    var dw = Math.abs(sim.winkel - (this.winkelGezeichnet || 0));
    var voll = this.modusDreh !== drehend || obKey !== this.obKey ||
      (!drehend && dw > 0.004 && (this.zeit - (this.letzteVoll || 0) > 0.12 || sim.nEff === 0));
    var o = this.shaderOpt || (this.shaderOpt = {});
    o.d = this.wimg.data; o.w = this.wimg.width; o.h = this.wimg.height; o.q = this.q;
    o.prof = sim.r; o.a = sim.a; o.holz = sim.holz; o.seed = sim.seed; o.mark = sim.mark;
    o.drehend = drehend; o.winkel = sim.winkel; o.rau = sim.rau; o.brand = sim.brand;
    o.oberflaeche = sim.oberflaeche; o.wisch = this.wisch;
    var c0, c1;
    if (voll) {
      c0 = 0; c1 = o.w - 1;
    } else if (sim.version !== sim.gezeichnet) {
      c0 = Math.floor((sim.dirtyA - 3) * DZ * this.q); c1 = Math.ceil((sim.dirtyB + 4) * DZ * this.q);
    } else {
      return;
    }
    c0 = clamp(c0, 0, o.w - 1); c1 = clamp(c1, 0, o.w - 1);
    spaltenRendern(o, c0, c1);
    this.wctx.putImageData(this.wimg, 0, 0, c0, 0, c1 - c0 + 1, o.h);
    if (voll) { this.letzteVoll = this.zeit; }
    sim.gezeichnet = sim.version;
    this.modusDreh = drehend; this.obKey = obKey; this.winkelGezeichnet = sim.winkel;
  };

  // ------------------------------------------------------------ Bild
  HolzSzene.prototype.zeichne = function (cv, dt, eingabe) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
    if (W < 40 || H < 40) { return; }
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var ctx = cv.getContext('2d');
    if (this.W !== W || this.H !== H || this.dpr !== dpr) { this.layout(W, H, dpr); }
    var sim = this.sim, s = this.s, Rv = sim.a * SQ2;
    this.zeit += dt;
    this.wischen(dt);
    this.spaeneErzeugen(dt);
    this.teileBewegen(dt);
    this.werkstueckAktualisieren();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Schuetteln bei grobem Schruppen am Kantholz
    var wack = sim.eckig > 0.3 && sim.rate > 200 ? Math.min(1.6, sim.rate / 2500) : 0;
    var ox = wack ? (Math.random() - 0.5) * wack : 0, oy = wack ? (Math.random() - 0.5) * wack : 0;
    ctx.drawImage(this.bg, 0, 0, W, H);
    ctx.drawImage(this.hcv, 0, 0, W, H);
    this.drehteile(ctx);
    // Schatten auf Auflage und Bett
    ctx.save();
    ctx.globalAlpha = 0.35;
    var sg = ctx.createRadialGradient(this.x0 + sim.L * s / 2, this.bettY + 4, 10, this.x0 + sim.L * s / 2, this.bettY + 4, sim.L * s * 0.6);
    sg.addColorStop(0, 'rgba(0,0,0,0.7)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(this.x0 - 40, this.bettY - 8, sim.L * s + 80, 20);
    ctx.restore();
    // Werkstueck
    ctx.save();
    ctx.translate(ox, oy);
    ctx.imageSmoothingEnabled = true;
    var bh = this.wcv.height / this.q * s;
    ctx.drawImage(this.wcv, this.x0, this.yc - bh / 2, this.wcv.width / this.q * s, bh);
    ctx.restore();
    this.vorlageZeichnen(ctx);
    this.werkzeugZeichnen(ctx, eingabe);
    this.teileZeichnen(ctx);
    this.stimmung(ctx, dt);
    if (this.blitz > 0) {
      ctx.fillStyle = 'rgba(255,240,200,' + (this.blitz * 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 2.5);
    }
  };

  // Mitnehmer, Handrad, mitlaufende Spitze und die Drehzahlanzeige am Spindelstock
  HolzSzene.prototype.drehteile = function (ctx) {
    var sim = this.sim, k = this.kulisse, yc = this.yc, s = this.s, w = sim.winkel, schnell = sim.nEff > 240;
    // Spindelnase und Mitnehmer (vier Zacken im Hirnholz)
    var nx = this.x0;
    var g = ctx.createLinearGradient(0, yc - 16, 0, yc + 16);
    g.addColorStop(0, '#80888e'); g.addColorStop(0.45, '#dde2e5'); g.addColorStop(1, '#4b5157');
    ctx.fillStyle = g; ctx.fillRect(k.hx1, yc - 15, nx - k.hx1 + 2, 30);
    if (schnell) {
      ctx.fillStyle = 'rgba(200,206,210,0.5)'; ctx.fillRect(nx - 2, yc - 13, 6, 26);
    } else {
      ctx.fillStyle = '#b8bfc4';
      var j;
      for (j = 0; j < 4; j++) { var yy = yc + Math.sin(w + j * Math.PI / 2) * 11; ctx.fillRect(nx - 2, yy - 2, 6, 4); }
    }
    // Handrad aussen am Spindelstock
    var hx = k.hx0 + 16, hr = Math.min(26, (k.hx1 - k.hx0) * 0.22), hy = yc;
    ctx.save();
    ctx.fillStyle = '#2b2f33'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#9aa3a9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, hr - 2, 0, TAU); ctx.stroke();
    if (schnell) {
      ctx.fillStyle = 'rgba(160,168,174,0.35)'; ctx.beginPath(); ctx.arc(hx, hy, hr - 4, 0, TAU); ctx.fill();
    } else {
      ctx.lineWidth = 2.4;
      var sp;
      for (sp = 0; sp < 3; sp++) { var an = w + sp * TAU / 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(an) * (hr - 3), hy + Math.sin(an) * (hr - 3)); ctx.stroke(); }
    }
    ctx.restore();
    // Digitale Drehzahlanzeige
    var dw = Math.min(70, (k.hx1 - k.hx0) * 0.62), dx = k.hx1 - dw - 8, dy = k.hy0 + 12;
    if (dx > k.hx0 + 2 * hr + 6 || k.hx1 - k.hx0 > 90) {
      ctx.fillStyle = '#0b0f0d'; ctx.fillRect(dx, dy, dw, 22);
      ctx.fillStyle = sim.nEff > 5 ? '#ff5a3c' : '#5a2a22';
      ctx.font = '600 15px "Share Tech Mono", monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(sim.nEff)), dx + dw - 5, dy + 11.5);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    // Mitlaufende Spitze rechts
    var tx = this.x0 + sim.L * s;
    ctx.fillStyle = '#c5ccd1';
    ctx.beginPath(); ctx.moveTo(tx - 3, yc); ctx.lineTo(tx + 9, yc - 7); ctx.lineTo(tx + 9, yc + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7d868c'; ctx.fillRect(tx + 9, yc - 9, 10, 18);
  };

  // ------------------------------------------------------------ Vorlage als leuchtende Kontur
  HolzSzene.prototype.vorlageZeichnen = function (ctx) {
    var sim = this.sim, rv = sim.rVorlage;
    if (!rv) { return; }
    var s = this.s, yc = this.yc, x0 = this.x0, i, start = true;
    ctx.save();
    // zu tief: rot zwischen Vorlage und Profil
    ctx.fillStyle = 'rgba(255,70,60,0.55)';
    for (i = 0; i < sim.N; i++) {
      var t = rv[i];
      if (isNaN(t) || sim.r[i] >= t - 0.5) { continue; }
      var x = x0 + i * DZ * s;
      ctx.fillRect(x, yc - t * s, DZ * s + 0.5, (t - sim.r[i]) * s);
      ctx.fillRect(x, yc + sim.r[i] * s, DZ * s + 0.5, (t - sim.r[i]) * s);
    }
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(90,209,255,0.8)'; ctx.shadowBlur = 8;
    [-1, 1].forEach(function (sg) {
      ctx.beginPath();
      start = true;
      for (i = 0; i < sim.N; i += 2) {
        var tt = rv[i];
        if (isNaN(tt)) { start = true; continue; }
        var gut = Math.abs(sim.r[i] - tt) <= 0.5;
        var px = x0 + (i + 0.5) * DZ * s, py = yc + sg * tt * s;
        if (start) { ctx.moveTo(px, py); start = false; } else { ctx.lineTo(px, py); }
        if (gut && i % 6 === 0) { ctx.fillStyle = 'rgba(110,231,160,0.9)'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
      }
      ctx.strokeStyle = 'rgba(120,220,255,0.9)';
      ctx.stroke();
    });
    ctx.restore();
  };

  // ------------------------------------------------------------ Werkzeug
  // Schneidenprofil in Weltachsen (mm, h nach unten), dann Schaft und Heft schraeg nach rechts unten
  HolzSzene.prototype.werkzeugZeichnen = function (ctx, eingabe) {
    var sim = this.sim, wz = sim.wz, s = this.s, sp = sim.spitze;
    var X = this.x0 + sp.z * s, Y = this.yc + Math.max(sp.h, -0.5) * s;
    var aktiv = sim.halten;
    ctx.save();
    ctx.globalAlpha = aktiv ? 1 : 0.62;
    var ang = 0.36, dx = Math.sin(ang), dy = Math.cos(ang);
    var tiefe = wz.form === 'rund' ? wz.r + 2 : wz.form === 'perl' ? wz.r + 3 : wz.form === 'spitz' ? 15 : 5;
    var bx = X, by = Y + tiefe * s;
    var breite = wz.form === 'rund' ? wz.r * 1.6 : wz.form === 'flach' ? Math.max(wz.b, 4) : wz.form === 'perl' ? wz.r * 2.4 : wz.form === 'spitz' ? 12 : 8;
    var bpx = Math.max(5, breite * s * 0.8);
    if (wz.form === 'draht') { this.drahtZeichnen(ctx, X, Y); ctx.restore(); return; }
    if (wz.form === 'flaeche') { this.schleifZeichnen(ctx, X, Y, wz); ctx.restore(); return; }
    // Schaft (Stahl) und Heft (Esche) mit Messingzwinge
    var lS = 64 * s, lH = 120 * s;
    stange(ctx, bx, by, dx, dy, lS, bpx, ['#5c646a', '#e3e8eb', '#7b848a']);
    var hx = bx + dx * lS, hy = by + dy * lS;
    stange(ctx, hx, hy, dx, dy, 7 * s, bpx * 1.5, ['#7a5a1c', '#f2d38a', '#9a7426']);
    stange(ctx, hx + dx * 7 * s, hy + dy * 7 * s, dx, dy, lH, bpx * 1.9, ['#7a5130', '#d9a874', '#8a5e38']);
    // Schneide im Profil, genau so, wie sie schneidet
    ctx.beginPath();
    var k, n = 18;
    if (wz.form === 'rund') {
      for (k = 0; k <= n; k++) { var dz = -wz.r + 2 * wz.r * k / n; ctx.lineTo(X + dz * s, Y + (wz.r - Math.sqrt(Math.max(0, wz.r * wz.r - dz * dz))) * s); }
      ctx.lineTo(X + wz.r * s, by + 2); ctx.lineTo(X - wz.r * s, by + 2);
    } else if (wz.form === 'flach') {
      ctx.moveTo(X - wz.b / 2 * s, Y + 0.3 * s); ctx.lineTo(X - (wz.b / 2 - 0.3) * s, Y); ctx.lineTo(X + (wz.b / 2 - 0.3) * s, Y); ctx.lineTo(X + wz.b / 2 * s, Y + 0.3 * s);
      ctx.lineTo(X + wz.b / 2 * s, by + 2); ctx.lineTo(X - wz.b / 2 * s, by + 2);
    } else if (wz.form === 'spitz') {
      var tw = Math.tan(wz.winkel * Math.PI / 180);
      ctx.moveTo(X, Y); ctx.lineTo(X + 9 * s, Y + 9 / tw * s); ctx.lineTo(X + 9 * s, by + 2); ctx.lineTo(X - 9 * s, by + 2); ctx.lineTo(X - 9 * s, Y + 9 / tw * s);
    } else if (wz.form === 'perl') {
      var rr = wz.r;
      ctx.moveTo(X - (rr + 0.8) * s, Y); ctx.lineTo(X - rr * s, Y);
      for (k = 0; k <= n; k++) { var dzp = -rr + 2 * rr * k / n; ctx.lineTo(X + dzp * s, Y + Math.sqrt(Math.max(0, rr * rr - dzp * dzp)) * s); }
      ctx.lineTo(X + (rr + 0.8) * s, Y); ctx.lineTo(X + (rr + 0.8) * s, by + 2); ctx.lineTo(X - (rr + 0.8) * s, by + 2);
    }
    ctx.closePath();
    var sg = ctx.createLinearGradient(X - 10 * s, 0, X + 10 * s, 0);
    sg.addColorStop(0, '#7b848a'); sg.addColorStop(0.5, '#f1f4f6'); sg.addColorStop(1, '#6b747a');
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    // Funkeln an der Schneide, solange sie schneidet
    if (sim.rate > 30 && aktiv) {
      ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(X, Y, 0, X, Y, 14);
      gl.addColorStop(0, 'rgba(255,240,200,0.55)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = gl; ctx.fillRect(X - 14, Y - 14, 28, 28);
    }
    ctx.restore();
  };

  function stange(ctx, x, y, dx, dy, len, breite, stops) {
    var nx = -dy, ny = dx, hb = breite / 2;
    var g = ctx.createLinearGradient(x - nx * hb, y - ny * hb, x + nx * hb, y + ny * hb);
    g.addColorStop(0, stops[0]); g.addColorStop(0.45, stops[1]); g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - nx * hb, y - ny * hb); ctx.lineTo(x + dx * len - nx * hb, y + dy * len - ny * hb);
    ctx.lineTo(x + dx * len + nx * hb, y + dy * len + ny * hb); ctx.lineTo(x + nx * hb, y + ny * hb);
    ctx.closePath(); ctx.fill();
  }

  HolzSzene.prototype.drahtZeichnen = function (ctx, X, Y) {
    var s = this.s, w = 26 * s;
    ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(X - w, Y + 26 * s); ctx.quadraticCurveTo(X, Y - 3, X + w, Y + 26 * s); ctx.stroke();
    [-1, 1].forEach(function (sg) {
      var hx = X + sg * w, hy = Y + 26 * s;
      var g = ctx.createLinearGradient(hx - 6, 0, hx + 6, 0);
      g.addColorStop(0, '#6e4a2c'); g.addColorStop(0.5, '#c99a64'); g.addColorStop(1, '#6e4a2c');
      ctx.fillStyle = g; ctx.fillRect(hx - 6, hy, 12, 34 * s + 10);
    });
    if (this.sim.brennen > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      var gl = ctx.createRadialGradient(X, Y, 0, X, Y, 10);
      gl.addColorStop(0, 'rgba(255,150,60,0.8)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gl; ctx.fillRect(X - 10, Y - 10, 20, 20);
    }
  };

  function rund(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Schleifklotz: Papier oben am Holz, Korkklotz, die Finger halten ihn von unten
  HolzSzene.prototype.schleifZeichnen = function (ctx, X, Y, wz) {
    var s = this.s, b = wz.b * s, pH = 1.4 * s + 1.5, kH = 9 * s + 6, x0 = X - b / 2, i, h1 = HZ.hash1;
    // Schleifpapier mit fester Koernung (flimmert nicht)
    ctx.fillStyle = '#d3b780';
    ctx.fillRect(x0 - 2, Y, b + 4, pH);
    ctx.fillStyle = 'rgba(70,48,22,0.5)';
    for (i = 0; i < 60; i++) { ctx.fillRect(x0 - 2 + h1(i * 3.1) * (b + 4), Y + h1(i * 7.7 + 1) * pH, 1, 1); }
    // Korkklotz, oben heller
    var yk = Y + pH, g = ctx.createLinearGradient(0, yk, 0, yk + kH);
    g.addColorStop(0, '#d0a26b'); g.addColorStop(1, '#8c6239');
    ctx.fillStyle = g;
    rund(ctx, x0, yk, b, kH, Math.min(5, kH * 0.25)); ctx.fill();
    ctx.fillStyle = 'rgba(60,34,14,0.32)';
    for (i = 0; i < 36; i++) {
      ctx.beginPath(); ctx.arc(x0 + 2 + h1(i * 5.3 + 2) * (b - 4), yk + 2 + h1(i * 2.9 + 5) * (kH - 4), 0.5 + h1(i + 0.5) * 1.1, 0, TAU); ctx.fill();
    }
    // Papier an den Seiten umgeschlagen
    ctx.fillStyle = '#bfa06a';
    ctx.fillRect(x0 - 2, yk, 2, kH * 0.55); ctx.fillRect(x0 + b, yk, 2, kH * 0.55);
    // Hand: Ballen unten, vier Finger vorn auf dem Klotz
    var fb = clamp(b / 5.4, 5, 16), fTop = yk + kH * 0.32, fBot = yk + kH + fb * 1.4;
    var hg = ctx.createLinearGradient(0, fTop, 0, fBot + fb);
    hg.addColorStop(0, '#f0bb98'); hg.addColorStop(1, '#c98466');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(X, fBot + fb * 0.4, b * 0.56, fb * 1.25, 0, 0, TAU); ctx.fill();
    for (i = 0; i < 4; i++) {
      var fx = x0 + b * (0.13 + i * 0.235), fw = fb * (i === 3 ? 0.82 : 0.95), ft = fTop + (i === 0 || i === 3 ? fb * 0.35 : 0);
      ctx.fillStyle = hg;
      rund(ctx, fx, ft, fw, fBot - ft, fw * 0.48); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,224,0.55)';
      rund(ctx, fx + fw * 0.2, ft + fw * 0.12, fw * 0.6, fw * 0.55, fw * 0.25); ctx.fill();
      ctx.fillStyle = 'rgba(110,50,30,0.28)';
      ctx.fillRect(fx + fw * 0.15, ft + fw * 1.25, fw * 0.7, 1);
      ctx.fillRect(fx, ft + fw * 0.9, 1, fBot - ft - fw * 1.2);
    }
  };

  // ------------------------------------------------------------ Spaene, Staub, Rauch
  HolzSzene.prototype.spaeneErzeugen = function (dt) {
    var sim = this.sim, k = sim.kontakt;
    if (!k || dt <= 0) { return; }
    var s = this.s, X = this.x0 + k.z * s, Y = this.yc + k.r * s;
    var holz = sim.holz, hell = holz.regenbogen ? [240, 220, 200] : [Math.min(255, holz.hell[0] + 14), Math.min(255, holz.hell[1] + 12), Math.min(255, holz.hell[2] + 10)];
    var n, i;
    if (k.typ === 'staub') { n = Math.random() < dt * 60 ? 2 : 0; }
    else if (k.typ === 'rauch') { n = Math.random() < dt * 30 * sim.brennen ? 1 : 0; }
    else { n = Math.min(10, Math.floor(Math.sqrt(sim.rate) * dt * 2.2 + Math.random())); }
    for (i = 0; i < n && this.teile.length < 650; i++) {
      var typ = k.typ, farbe = hell;
      if (holz.regenbogen) { var REG = REGENBOGEN; farbe = REG[Math.floor(Math.random() * REG.length)]; }
      if (holz.epoxid && Math.random() < 0.25) { farbe = [80, 210, 240]; }
      if (typ === 'grob' && sim.eckig > 0.3) { typ = 'flocke'; } else if (typ === 'grob') { typ = 'band'; }
      if (typ === 'band' && sim.rate < 120) { typ = 'locke'; }
      var v = typ === 'staub' ? zufall(10, 40) : typ === 'rauch' ? zufall(8, 20) : zufall(120, 420);
      var ang = typ === 'rauch' || typ === 'staub' ? zufall(-Math.PI * 0.9, -Math.PI * 0.1) : zufall(0.15, Math.PI - 0.15);
      this.teile.push({ typ: typ, x: X + zufall(-3, 3), y: Y + zufall(-1, 2), vx: Math.cos(ang) * v * (typ === 'band' ? 0.6 : 1), vy: Math.sin(ang) * v - (typ === 'band' ? zufall(0, 120) : 0),
        rot: Math.random() * TAU, vr: zufall(-9, 9), t: 0, leben: typ === 'rauch' ? 2.2 : typ === 'staub' ? 2.6 : 3, g: typ === 'staub' ? 18 : typ === 'rauch' ? -30 : 900,
        groesse: typ === 'flocke' ? zufall(2, 4.5) : typ === 'band' ? zufall(5, 11) : typ === 'locke' ? zufall(3, 6) : typ === 'rauch' ? zufall(5, 9) : zufall(0.6, 1.4),
        farbe: farbe, z: 1 });
    }
    if (k.typ === 'rauch' && Math.random() < dt * 14 * sim.brennen) {
      this.teile.push({ typ: 'glut', x: X, y: Y, vx: zufall(-60, 60), vy: zufall(-120, -30), t: 0, leben: 0.6, g: 300, groesse: 1.2, farbe: [255, 170, 60], z: 1, rot: 0, vr: 0 });
    }
  };

  HolzSzene.prototype.teileBewegen = function (dt) {
    var neu = [], i, p, boden = this.bettY;
    for (i = 0; i < this.teile.length; i++) {
      p = this.teile[i];
      p.t += dt;
      if (p.t > p.leben) { continue; }
      p.vy += p.g * dt;
      var luft = p.typ === 'band' ? 2.4 : p.typ === 'locke' ? 1.6 : p.typ === 'staub' ? 1.2 : p.typ === 'rauch' ? 0.8 : 0.6;
      p.vx -= p.vx * luft * dt; p.vy -= p.vy * (luft * 0.4) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      // Spaene fliegen zum Betrachter: sie werden groesser
      if (p.typ !== 'rauch' && p.typ !== 'staub') { p.z = Math.min(1.9, p.z + dt * 0.5); }
      if (p.typ === 'rauch') { p.groesse += dt * 9; }
      if (p.y > boden - 2 && p.vy > 0 && (p.typ === 'band' || p.typ === 'locke' || p.typ === 'flocke')) { this.ablegen(p); continue; }
      neu.push(p);
    }
    this.teile = neu;
  };

  // Gelandeter Span wird in den Haufen gemalt (Hoehenkarte, damit er sich stapelt)
  HolzSzene.prototype.ablegen = function (p) {
    var k = Math.floor(p.x / 4);
    if (k < 0 || k >= this.heapH.length) { return; }
    var hh = this.heapH[k];
    if (hh > 46) { return; }
    var c = this.hctx, y = this.bettY - hh + 2;
    c.save();
    c.translate(p.x, y);
    c.rotate(p.rot);
    c.strokeStyle = rgb(p.farbe, 0.8 + Math.random() * 0.25);
    c.fillStyle = c.strokeStyle;
    c.lineWidth = p.typ === 'band' ? 1.8 : 1.3;
    if (p.typ === 'flocke') { c.fillRect(-p.groesse / 2, -p.groesse / 3, p.groesse, p.groesse * 0.6); }
    else { c.beginPath(); c.ellipse(0, 0, p.groesse * 0.9, p.groesse * 0.45, 0, 0, Math.PI * 1.6); c.stroke(); }
    c.restore();
    var dh = p.typ === 'band' ? 0.9 : p.typ === 'flocke' ? 0.7 : 0.5, j;
    for (j = -1; j <= 1; j++) { if (k + j >= 0 && k + j < this.heapH.length) { this.heapH[k + j] += dh * (j === 0 ? 1 : 0.5); } }
  };

  HolzSzene.prototype.fegen = function () {
    this.hctx.clearRect(0, 0, this.W, this.H);
    if (this.heapH) { this.heapH.fill(0); }
  };

  HolzSzene.prototype.teileZeichnen = function (ctx) {
    var i, p;
    for (i = 0; i < this.teile.length; i++) {
      p = this.teile[i];
      var al = clamp((p.leben - p.t) * 2, 0, 1), g = p.groesse * p.z;
      if (p.typ === 'rauch') {
        ctx.fillStyle = 'rgba(150,140,130,' + (0.22 * al).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, g, 0, TAU); ctx.fill();
        continue;
      }
      if (p.typ === 'glut') {
        ctx.fillStyle = 'rgba(255,170,60,' + al.toFixed(3) + ')'; ctx.fillRect(p.x, p.y, 2, 2);
        continue;
      }
      if (p.typ === 'staub') {
        ctx.fillStyle = rgb(p.farbe, 1, 0.55 * al); ctx.fillRect(p.x, p.y, g + 0.6, g + 0.6);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = al;
      ctx.strokeStyle = rgb(p.farbe, 0.95);
      ctx.fillStyle = ctx.strokeStyle;
      if (p.typ === 'flocke') {
        ctx.beginPath(); ctx.moveTo(-g, -g * 0.4); ctx.lineTo(g * 0.8, -g * 0.6); ctx.lineTo(g, g * 0.5); ctx.lineTo(-g * 0.6, g * 0.6); ctx.closePath(); ctx.fill();
      } else {
        // Hobelspan: Spirale, die sich im Flug weiter aufrollt
        ctx.lineWidth = p.typ === 'band' ? 2.2 * p.z : 1.5 * p.z;
        ctx.beginPath();
        var w, n = p.typ === 'band' ? 14 : 9, rr = g;
        for (w = 0; w <= n; w++) {
          var an = w * 0.55, rad = rr * (0.25 + w / n * 0.75);
          var px = Math.cos(an) * rad + (p.typ === 'band' ? w * 0.6 : 0), py = Math.sin(an) * rad * 0.7;
          if (w === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // Staubkoerner im Lichtschacht
  HolzSzene.prototype.stimmung = function (ctx, dt) {
    var W = this.W, H = this.H, i, m, extra = this.sim.schleifen > 0 ? 1 : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < this.motes.length; i++) {
      m = this.motes[i];
      m.y += m.v * dt * (1 + extra * 3); m.ph += dt;
      if (m.y > 1) { m.y = 0; m.x = Math.random(); }
      var x = (0.05 + m.x * 0.5 + m.y * 0.22) * W + Math.sin(m.ph) * 6, y = m.y * H;
      ctx.fillStyle = 'rgba(255,232,190,' + (0.25 + 0.2 * Math.sin(m.ph * 2)).toFixed(3) + ')';
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------ Oel, Wachs, Lack, Beize: Lappen wischt von links nach rechts
  HolzSzene.prototype.oberflaecheAuftragen = function (art, beize, fertig) {
    this.wisch = { pos: -10, art: art, beize: beize === undefined ? this.sim.oberflaeche.beize : beize, fertig: fertig };
  };
  HolzSzene.prototype.wischen = function (dt) {
    var w = this.wisch;
    if (!w) { return; }
    w.pos += dt * (this.sim.L + 20) / 1.3;
    if (w.pos > this.sim.L + 10) {
      this.sim.oberflaeche.art = w.art;
      this.sim.oberflaeche.beize = w.beize;
      this.wisch = null;
      this.blitz = 0.25;
      if (w.fertig) { w.fertig(); }
    }
  };

  // ============================================================ Einzelbild eines fertigen Stuecks (Vitrine)
  // prof: Radien je DZ; liefert ein Canvas, Stueck senkrecht stehend
  function stueckBild(st, breitePx, hoehePx) {
    var holz = HZ.holzVon(st.holz), prof = st.prof, N = prof.length, Lmm = N * DZ, max = 0, i;
    for (i = 0; i < N; i++) { if (prof[i] > max) { max = prof[i]; } }
    var q = Math.min((hoehePx - 8) / Lmm, (breitePx - 8) / (2 * max + 2));
    var w = Math.max(2, Math.ceil(Lmm * q)), h = Math.max(2, Math.ceil((2 * max + 1) * q));
    var tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    var c = tmp.getContext('2d'), img = c.createImageData(w, h);
    var rau = new Float32Array(N), brand = st.brand ? new Float32Array(st.brand) : null;
    for (i = 0; i < N; i++) { rau[i] = st.glaette !== undefined ? 1 - st.glaette : 0.3; }
    spaltenRendern({ d: img.data, w: w, h: h, q: q, prof: new Float32Array(prof), a: max + 0.5, holz: holz, seed: st.seed || 3, mark: { x: 0, y: 0 },
      drehend: true, winkel: 0, rau: rau, brand: brand, oberflaeche: { art: st.art || 'roh', beize: st.beize || null } }, 0, w - 1);
    c.putImageData(img, 0, 0);
    var out = document.createElement('canvas'); out.width = breitePx; out.height = hoehePx;
    var o = out.getContext('2d');
    o.translate(breitePx / 2, hoehePx - 4 - (hoehePx - 8 - w) / 2);
    o.rotate(-Math.PI / 2);
    o.drawImage(tmp, 0, -h / 2);
    return out;
  }

  ZM.szenen = ZM.szenen || {};
  ZM.szenen.HolzSzene = HolzSzene;
  ZM.holz.stueckBild = stueckBild;
  ZM.holz.BEIZEN = BEIZEN;
})(typeof window !== 'undefined' ? window : globalThis);
