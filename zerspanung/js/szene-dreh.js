/*
 * Drehmaschine in 2.5D (ersetzt die Draufsicht aus szenen.js).
 *
 * Orthografische Kamera schraeg von oben: an der LZ 200 von vorn rechts
 * (Blick des Bedieners, psi 25, p 25 Grad), an der CT 250 durch die Tuer-
 * scheibe steiler von oben (psi 20, p 45 Grad), weil die Schneide dort hinten
 * oben am Werkstueck sitzt (Revolver hinter der Drehmitte, M4).
 *
 * Weltsystem in mm: a axial ab Backenflaeche (= sim.z), u waagerecht zum
 * Bediener, v nach oben. Die Drehachse ist die a-Achse.
 *
 * Werkstueck als Rotationskoerper aus materialRadius() und stirn[], Glanz ueber
 * vorgerechnete Lichtstreifen (LUT) je Rauheitsklasse, Futter mit Bewegungs-
 * unschaerfe statt Wagenrad-Effekt, Spaene und Funken in Welt-mm mit echter
 * Geschwindigkeit. Funken nur, wo die Physik sie liefert (sim.funken,
 * sim.funkenPuffer), Ruckeln nur aus sim.ruck/ruckFreq.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  if (!ZM.szenen || !ZM.szenen.hilfen || !ZM.physik) { return; }
  var PH = ZM.physik, HF = ZM.szenen.hilfen;
  var SCHRIFT = HF.SCHRIFT, MONO = HF.MONO, clamp = HF.clamp, zufall = HF.zufall;
  var DZ = PH.DZ, DR = PH.DR;
  var TAU = Math.PI * 2, DEG = Math.PI / 180;
  var TB = 1 / 30;          // Integrationszeit des Auges (Bewegungsunschaerfe), s
  var TS = 1 / 60;          // Strichlaenge fliegender Teilchen, s
  var G = 9810;             // Erdbeschleunigung, mm/s^2
  var BACKE_A = 28;         // Backen ragen 28 mm vor die Futterplanflaeche

  function jetzt() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }

  // ------------------------------------------------------------ Licht
  // Hallenlicht von rechts vorn oben (hinter dem Bediener), normiert in (a, u, v)
  var LA = 0.30, LU = 0.45, LV = 0.84;
  (function () { var l = Math.sqrt(LA * LA + LU * LU + LV * LV); LA /= l; LU /= l; LV /= l; })();
  function licht(nA, nU, nV) { var x = nA * LA + nU * LU + nV * LV; return x > 0 ? x : 0; }

  // ------------------------------------------------------------ Farben
  var RGB = {};
  function rgb(hex) {
    var c = RGB[hex];
    if (!c) { c = RGB[hex] = [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)]; }
    return c;
  }
  function css(c, k, al) {
    var f = k === undefined ? 1 : k;
    var r = Math.round(clamp(c[0] * f, 0, 255)), g = Math.round(clamp(c[1] * f, 0, 255)), b = Math.round(clamp(c[2] * f, 0, 255));
    return al === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + clamp(al, 0, 1).toFixed(3) + ')';
  }
  function misch(c1, c2, t) { return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; }
  // Lackierte bzw. matte Flaeche: Umgebungsanteil plus diffuses Hallenlicht
  function lack(c, nA, nU, nV, amb) { var a = amb === undefined ? 0.3 : amb; return css(c, a + (1 - a) * licht(nA, nU, nV)); }
  function glatt(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function lcg(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul ? Math.imul(s, 1664525) : s * 1664525) + 1013904223 >>> 0; return s / 4294967296; };
  }

  // Anlauffarben von Stahl (nach dem Abkuehlen sichtbar) und Gluehfarben (Werkstatthelligkeit)
  var ANLAUF = [[200, '#e8dca0'], [220, '#d9bd6a'], [240, '#c08a3c'], [255, '#a8603a'], [270, '#8a4f86'],
    [285, '#6a4a9a'], [300, '#3d5fae'], [320, '#5d86b8'], [340, '#6f8296'], [360, '#7b8790']];
  var GLUT = [[550, '#4a0c00'], [630, '#7a1600'], [680, '#a01c04'], [740, '#c0260a'], [780, '#d8300c'], [850, '#f04812'],
    [950, '#ff6a1c'], [1000, '#ff8226'], [1100, '#ffa040'], [1200, '#ffc468'], [1300, '#ffe6a8'], [1400, '#fff6e0']];
  function tabelle(tab, T) {
    if (T <= tab[0][0]) { return rgb(tab[0][1]); }
    for (var i = 1; i < tab.length; i++) {
      if (T <= tab[i][0]) { return misch(rgb(tab[i - 1][1]), rgb(tab[i][1]), (T - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0])); }
    }
    return rgb(tab[tab.length - 1][1]);
  }
  function anlaufRGB(T, basis) {
    if (T < 180) { return basis; }
    var c = tabelle(ANLAUF, T);
    return T < 200 ? misch(basis, c, (T - 180) / 20) : c;
  }
  // Sichtbarkeit des Gluehens in heller Halle (ab etwa 600 Grad C)
  function glutAlpha(T) { var x = (T - 550) / 450; return T < 560 ? 0 : Math.min(1, x * x * 1.6); }

  // Aussehen des Werkstoffs: blank gedreht und Rohoberflaeche
  var BLANK = { S235: '#a3aab0', C45: '#a3aab0', '42CrMo4': '#a3aab0', '1.4301': '#b3b8bc', AlMgSi1: '#c9ced3',
    CuZn39Pb3: '#c8a650', Ti6Al4V: '#979ca2', GJL250: '#757c82' };
  function aussehen(mat) {
    var id = mat.id;
    var walz = id === 'S235' || id === 'C45' || id === '42CrMo4';
    var guss = id === 'GJL250';
    return {
      blank: rgb(BLANK[id] || mat.farbe || '#a3aab0'),
      roh: rgb(mat.roh || '#3b4248'),
      walz: walz, guss: guss,
      gRoh: walz ? 0.05 : guss ? 0 : id === 'Ti6Al4V' ? 0.15 : 0.32,
      gMax: guss ? 0.35 : 1,
      ks: id === 'Ti6Al4V' ? 0.6 : 1,
      mMax: id === 'AlMgSi1' ? 60 : 9999,
      spitze: id === 'CuZn39Pb3' ? rgb('#fff0b0') : [255, 255, 255],
      anlauf: mat.iso === 'P' || mat.iso === 'M' || mat.iso === 'S',
      span: rgb(mat.spanFarbe || '#c9ced3'),
      funke: mat.funke || { f: 0, farbe: '#ffd27a', stern: 0, leben: 0.3 },
      lam: id === 'AlMgSi1' ? 1.8 : id === 'Ti6Al4V' ? 1.2 : id === 'CuZn39Pb3' || guss ? 1.6 : 2.5
    };
  }
  var STAHL = { gMax: 1, ks: 1, mMax: 9999 };
  var WEISS = [255, 255, 255];

  // ------------------------------------------------------------ Kamera
  function Kamera(psi, p) { this.s = 4; this.X0 = 0; this.Y0 = 0; this.winkel(psi, p); }
  Kamera.prototype.winkel = function (psi, p) {
    var cps = Math.cos(psi), sps = Math.sin(psi), cp = Math.cos(p), sp = Math.sin(p);
    this.psi = psi; this.p = p;
    // Richtung zur Kamera hin
    this.dA = sps * cp; this.dU = cps * cp; this.dV = sp;
    // Bildvektoren je mm bei s = 1
    this.aX = cps; this.aY = sps * sp; this.uX = -sps; this.uY = cps * sp; this.vY = -cp;
    // Einheitsnormale N zur Achse im Bild (zeigt nach oben) und Lage des sichtbaren Mantelscheitels
    this.la = Math.sqrt(this.aX * this.aX + this.aY * this.aY);
    this.nX = this.aY / this.la; this.nY = -this.aX / this.la;
    this.thc = Math.atan2(sp, cps * cp);
    var hA = LA + this.dA, hU = LU + this.dU, hV = LV + this.dV, hl = Math.sqrt(hA * hA + hU * hU + hV * hV);
    this.H = [hA / hl, hU / hl, hV / hl];
  };
  Kamera.prototype.X = function (a, u) { return this.X0 + this.s * (a * this.aX + u * this.uX); };
  Kamera.prototype.Y = function (a, u, v) { return this.Y0 + this.s * (a * this.aY + u * this.uY + v * this.vY); };
  Kamera.prototype.sicht = function (nA, nU, nV) { return nA * this.dA + nU * this.dU + nV * this.dV; };
  Kamera.prototype.tiefe = function (a, u, v) { return a * this.dA + u * this.dU + v * this.dV; };

  // ------------------------------------------------------------ Glanz
  var G_KLASSE = [0.8, 0.6, 0.4, 0.2, 0.06];
  function raKlasse(ra) { return ra <= 1.1 ? 0 : ra <= 2.2 ? 1 : ra <= 4.5 ? 2 : ra <= 9 ? 3 : 4; }
  function glanzParam(A, g, nass) {
    var p = { g: Math.min(g, A.gMax), ks: 0, m: 0, bk: 1 };
    p.ks = 0.9 * p.g * A.ks;
    p.m = Math.min(A.mMax, 20 + 300 * p.g * p.g);
    if (nass) { p.m *= 2; p.bk = 0.85; p.ks += 0.15; }
    return p;
  }
  // Helligkeit einer Metallflaeche mit Normale n: diffus, gespiegelte Umgebung
  // (oben helle Halle, unten dunkles Bett) und Glanzpunkt
  function glanzPixel(k, basis, spitze, p, nA, nU, nV, out) {
    var diff = licht(nA, nU, nV);
    var nd = nA * k.dA + nU * k.dU + nV * k.dV;
    var rV = 2 * nd * nV - k.dV;
    var env = 0.12 + 0.78 * glatt(-0.15, 0.55, rV);
    var nh = nA * k.H[0] + nU * k.H[1] + nV * k.H[2];
    var spec = nh > 0 ? p.ks * Math.pow(nh, p.m) : 0;
    var g = p.g, f = (1 - g) * (0.30 + 0.70 * diff) + g * (0.15 * diff + 0.85 * env);
    out[0] = basis[0] * p.bk * f + spitze[0] * g * spec;
    out[1] = basis[1] * p.bk * f + spitze[1] * g * spec;
    out[2] = basis[2] * p.bk * f + spitze[2] * g * spec;
    return out;
  }
  // Lichtstreifen 1 x 256 quer ueber den Zylinder: Zeile i entspricht sin(theta - thc) = 1 - 2i/255
  function baueLUT(k, basis, spitze, p) {
    var cv = document.createElement('canvas');
    cv.width = 1; cv.height = 256;
    var c = cv.getContext('2d'), img = c.createImageData(1, 256), d = img.data, o = [0, 0, 0], i, th;
    for (i = 0; i < 256; i++) {
      th = k.thc + Math.asin(1 - 2 * i / 255);
      glanzPixel(k, basis, spitze, p, 0, Math.cos(th), Math.sin(th), o);
      d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  function musterAusrichten(pat, k, a0, r) {
    var s = k.s, cx = k.X(a0, 0), cy = k.Y(a0, 0, 0);
    if (!pat.setTransform || typeof DOMMatrix === 'undefined') { return; }
    pat.setTransform(new DOMMatrix([k.aX / k.la, k.aY / k.la, -2 * r * s * k.nX / 256, -2 * r * s * k.nY / 256, cx + r * s * k.nX, cy + r * s * k.nY]));
  }

  // ------------------------------------------------------------ Grundkoerper
  // Mantel eines Zylinders (a0..a1, Radius r): Parallelogramm plus vordere Randellipse links
  function mantelPfad(ctx, k, a0, a1, r) {
    var s = k.s, x0 = k.X(a0, 0), y0 = k.Y(a0, 0, 0), x1 = k.X(a1, 0), y1 = k.Y(a1, 0, 0);
    var ox = r * s * k.nX, oy = r * s * k.nY;
    ctx.moveTo(x0 + ox, y0 + oy);
    ctx.lineTo(x1 + ox, y1 + oy);
    ctx.lineTo(x1 - ox, y1 - oy);
    ctx.lineTo(x0 - ox, y0 - oy);
    ctx.save();
    ctx.transform(k.uX * s * r, k.uY * s * r, 0, k.vY * s * r, x0, y0);
    ctx.arc(0, 0, 1, k.thc - Math.PI / 2, k.thc + Math.PI / 2, false);
    ctx.restore();
    ctx.closePath();
  }
  // Rahmen einer Kreisscheibe in der u-v-Ebene bei a (lokal: x = u, y = v, Einheit r)
  function scheibenRahmen(ctx, k, a, r) {
    var s = k.s * r;
    ctx.transform(k.uX * s, k.uY * s, 0, k.vY * s, k.X(a, 0), k.Y(a, 0, 0));
  }
  function ringPfad(ctx, k, a, r0, r1) {
    if (r1 <= 0) { return; }
    ctx.save();
    scheibenRahmen(ctx, k, a, 1);
    ctx.moveTo(r1, 0);
    ctx.arc(0, 0, r1, 0, TAU);
    if (r0 > 0) { ctx.moveTo(r0, 0); ctx.arc(0, 0, r0, 0, TAU, true); }
    ctx.restore();
  }
  // Ringsektor (Lichtbalken, Spuren) in der Stirnebene, Winkel w0..w1
  function sektorPfad(ctx, r0, r1, w0, w1) {
    ctx.moveTo(r1 * Math.cos(w0), r1 * Math.sin(w0));
    ctx.arc(0, 0, r1, w0, w1, false);
    if (r0 > 0) { ctx.arc(0, 0, r0, w1, w0, true); } else { ctx.lineTo(0, 0); }
    ctx.closePath();
  }
  // Kreis in beliebiger Ebene (Mitte M, Achsen e1, e2) als Pfad
  function kreis3(ctx, k, M, e1, e2, r) {
    var s = k.s * r;
    ctx.save();
    ctx.transform((e1[0] * k.aX + e1[1] * k.uX) * s, (e1[0] * k.aY + e1[1] * k.uY + e1[2] * k.vY) * s,
      (e2[0] * k.aX + e2[1] * k.uX) * s, (e2[0] * k.aY + e2[1] * k.uY + e2[2] * k.vY) * s, k.X(M[0], M[1]), k.Y(M[0], M[1], M[2]));
    ctx.moveTo(1, 0);
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.restore();
  }

  // Quader im lokalen Rahmen O + x e1 + y e2 + z e3; nur die zur Kamera zeigenden Flaechen
  var QF = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
  var QX = new Float64Array(8), QY = new Float64Array(8);
  function quader(ctx, k, O, e1, e2, e3, x0, x1, y0, y1, z0, z1, farben, amb) {
    var i, f;
    for (i = 0; i < 8; i++) {
      var x = i & 1 ? x1 : x0, y = i & 2 ? y1 : y0, z = i & 4 ? z1 : z0;
      var a = O[0] + x * e1[0] + y * e2[0] + z * e3[0];
      var u = O[1] + x * e1[1] + y * e2[1] + z * e3[1];
      var v = O[2] + x * e1[2] + y * e2[2] + z * e3[2];
      QX[i] = k.X(a, u); QY[i] = k.Y(a, u, v);
    }
    var einzeln = typeof farben[0] === 'number';
    for (f = 0; f < 6; f++) {
      var e = f < 2 ? e1 : f < 4 ? e2 : e3, sg = f & 1 ? 1 : -1;
      var nA = e[0] * sg, nU = e[1] * sg, nV = e[2] * sg;
      if (k.sicht(nA, nU, nV) <= 0.002) { continue; }
      var c = einzeln ? farben : farben[f];
      if (!c) { continue; }
      var q = QF[f];
      ctx.fillStyle = lack(c, nA, nU, nV, amb);
      ctx.beginPath();
      ctx.moveTo(QX[q[0]], QY[q[0]]);
      ctx.lineTo(QX[q[1]], QY[q[1]]);
      ctx.lineTo(QX[q[2]], QY[q[2]]);
      ctx.lineTo(QX[q[3]], QY[q[3]]);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Prisma: Umriss pts = [x0, y0, x1, y1, ...] gegen den Uhrzeigersinn in der e1-e2-Ebene,
  // ausgezogen von z0 bis z1 entlang e3. fo: Oberseite, fs: Seiten (rgb oder Funktion(i)), fu: Unterseite
  function prisma(ctx, k, O, e1, e2, e3, pts, z0, z1, fo, fs, fu, amb) {
    var n = pts.length / 2, i, j, bx = [], by = [], tx = [], ty = [], seiten = [];
    for (i = 0; i < n; i++) {
      var x = pts[2 * i], y = pts[2 * i + 1];
      var a = O[0] + x * e1[0] + y * e2[0], u = O[1] + x * e1[1] + y * e2[1], v = O[2] + x * e1[2] + y * e2[2];
      bx.push(k.X(a + z0 * e3[0], u + z0 * e3[1])); by.push(k.Y(a + z0 * e3[0], u + z0 * e3[1], v + z0 * e3[2]));
      tx.push(k.X(a + z1 * e3[0], u + z1 * e3[1])); ty.push(k.Y(a + z1 * e3[0], u + z1 * e3[1], v + z1 * e3[2]));
    }
    var obenSicht = k.sicht(e3[0], e3[1], e3[2]);
    function flaeche(xs, ys, c, nA, nU, nV) {
      ctx.fillStyle = typeof c === 'string' ? c : lack(c, nA, nU, nV, amb);
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (var m = 1; m < xs.length; m++) { ctx.lineTo(xs[m], ys[m]); }
      ctx.closePath();
      ctx.fill();
    }
    if (obenSicht < 0 && fu) { flaeche(bx, by, fu, -e3[0], -e3[1], -e3[2]); }
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      var dx = pts[2 * j] - pts[2 * i], dy = pts[2 * j + 1] - pts[2 * i + 1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var lx = dy / l, ly = -dx / l;
      var nA = lx * e1[0] + ly * e2[0], nU = lx * e1[1] + ly * e2[1], nV = lx * e1[2] + ly * e2[2];
      if (k.sicht(nA, nU, nV) <= 0.002) { continue; }
      var mx = (pts[2 * i] + pts[2 * j]) / 2, my = (pts[2 * i + 1] + pts[2 * j + 1]) / 2;
      var tief = k.tiefe(O[0] + mx * e1[0] + my * e2[0], O[1] + mx * e1[1] + my * e2[1], O[2] + mx * e1[2] + my * e2[2]);
      seiten.push({ i: i, j: j, t: tief, nA: nA, nU: nU, nV: nV });
    }
    seiten.sort(function (p, q) { return p.t - q.t; });
    for (i = 0; i < seiten.length; i++) {
      var sd = seiten[i];
      var c = typeof fs === 'function' ? fs(sd.i) : fs;
      flaeche([bx[sd.i], bx[sd.j], tx[sd.j], tx[sd.i]], [by[sd.i], by[sd.j], ty[sd.j], ty[sd.i]], c, sd.nA, sd.nU, sd.nV);
    }
    if (obenSicht > 0 && fo) { flaeche(tx, ty, fo, e3[0], e3[1], e3[2]); }
    return { tx: tx, ty: ty, bx: bx, by: by };
  }

  // Kegel mit Spitze bei aSp und Grundkreis (Radius R) bei aG: konvexe Huelle aus Spitze und Ellipse
  function kegelPfad(ctx, k, aSp, aG, R) {
    var pts = [[k.X(aSp, 0), k.Y(aSp, 0, 0)]], i, w, s = k.s * R, cx = k.X(aG, 0), cy = k.Y(aG, 0, 0);
    for (i = 0; i < 40; i++) {
      w = i / 40 * TAU;
      pts.push([cx + (k.uX * Math.cos(w)) * s, cy + (k.uY * Math.cos(w) + k.vY * Math.sin(w)) * s]);
    }
    var h = huelle(pts);
    ctx.moveTo(h[0][0], h[0][1]);
    for (i = 1; i < h.length; i++) { ctx.lineTo(h[i][0], h[i][1]); }
    ctx.closePath();
  }
  function huelle(p) {
    p.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function kr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], hi = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && kr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) { lo.pop(); } lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (hi.length >= 2 && kr(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) { hi.pop(); } hi.push(p[i]); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  // Leinwand mit begrenzter Pixeldichte (hoechstens 2)
  function groesse(cv) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
    if (!w || !h) { return null; }
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }

  // Leuchtfleck (radialer Verlauf) als vorgerendertes Sprite je Farbe
  var SPRITES = {};
  function sprite(c) {
    var key = Math.round(c[0] / 8) + ',' + Math.round(c[1] / 8) + ',' + Math.round(c[2] / 8);
    var sp = SPRITES[key];
    if (sp) { return sp; }
    sp = document.createElement('canvas');
    sp.width = sp.height = 64;
    var x = sp.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.18, css(c, 1, 0.9));
    g.addColorStop(0.5, css(c, 1, 0.28));
    g.addColorStop(1, css(c, 1, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    SPRITES[key] = sp;
    return sp;
  }

  // Maschinenfarben
  var LACK = rgb('#5f7560'), LACK_H = rgb('#82987f'), LACK_D = rgb('#3b4a3c');
  var RAL7035 = rgb('#c5c9c4'), RAL7016 = rgb('#383e42');
  var BLANKSTAHL = rgb('#9ea6ac'), BRUENIERT = rgb('#2e3338'), FUEHRUNG = rgb('#aab2b8');

  // =====================================================================
  //                              SZENE
  // =====================================================================
  function DrehSzene(sim) {
    this.sim = sim;
    this.cnc = !!sim.cnc;
    this.A = aussehen(sim.mat);
    this.kam = this.cnc ? new Kamera(20 * DEG, 45 * DEG) : new Kamera(25 * DEG, 25 * DEG);
    this.lupeKam = new Kamera(55 * DEG, 14 * DEG);
    this.mCache = {};
    this.fCache = {};
    this.kamBereit = false;
    this.t = 0;
    this.tSim = sim.zeit || 0;
    this.geo = null; this.geoV = -1; this.geoS = -1;
    this.spaene = []; this.baender = []; this.funken = []; this.rauch = []; this.tropfen = [];
    this.haufen = []; this.aufSchlitten = []; this.scheibe = [];
    this.stoesse = []; this.blitz = 0;
    this.mess = null; this.lupeZeit = 0;
    this.wAlt = sim.w; this.revDreh = 0;
    this.nass = 0; this.zsPhi = 0;
    this.stossZeit = 0; this.klicksAlt = sim.klicks || 0; this.ratsch = 0;
    this.zAlt = sim.z; this.xAlt = sim.x; this.vz = 0; this.vx = 0;
    this.nwMerk = 0; this.fPlan = 0;
    this.ruckOff = 0; this.zustandObj = {};
    this.bandPhase = 0; this.bandNeu = 0;
    this.ms = 0; this.msMax = 0;
    this.zufall = lcg(Math.round(sim.D0 * 131 + sim.L * 7 + 3));
    this.flecken = this.fleckenBauen();
    this.ringTex = null;
    this.haufenCv = null;
  }

  // Walzhaut: Zunderflecken, Rost, helle Zunderschuppen (drehen sich mit)
  DrehSzene.prototype.fleckenBauen = function () {
    var A = this.A, sim = this.sim, r = this.zufall, list = [], i;
    var n = A.walz ? 110 : A.guss ? 140 : 30;
    for (i = 0; i < n; i++) {
      var typ = A.walz ? (r() < 0.22 ? 1 : r() < 0.45 ? 2 : 0) : A.guss ? 4 : 3;
      list.push({ a: -BACKE_A + r() * (sim.L + BACKE_A), th: r() * TAU, wa: (A.walz ? 1.2 + r() * 7 : A.guss ? 0.6 + r() * 1.6 : 2 + r() * 12),
        wt: A.walz ? 0.06 + r() * 0.32 : A.guss ? 0.03 + r() * 0.08 : 0.02 + r() * 0.05, typ: typ });
    }
    return list;
  };
  var FLECK = [['#171b1e', 0.6], ['#6e4a2e', 0.55], ['#727b82', 0.4], ['#ffffff', 0.13], ['#25292c', 0.5]];

  DrehSzene.prototype.ereignis = function (e) {
    switch (e.typ) {
      case 'bruch': this.stoss(3.5, 0.08, 22); this.splitter(10); this.stossZeit = 0.35; break;
      case 'kollision': this.stoss(10, 0.2, 19); this.splitter(18); this.stossZeit = 0.35; this.blitz = 0.45; break;
      case 'unfall': this.stoss(15, 0.3, 18); this.blitz = 1; break;
      case 'abgewuergt': this.stoss(1.6, 0.15, 21); break;
      case 'kupplung': this.stoss(0.9, 0.06, 24); break;
      case 'riemen': this.stoss(0.6, 0.1, 20); break;
      case 'zapfen': this.lupeZeit = Math.max(this.lupeZeit, 6); break;
      case 'mitte': this.lupeZeit = Math.max(this.lupeZeit, 4); break;
      case 'thermoschock': this.dampfStoss = 1; break;
      default: break;
    }
  };

  DrehSzene.prototype.messung = function (z) { this.mess = { z: z, t: 2.5 }; };

  // Gedaempfter Kamera-Stoss (nur bei Ereignissen), Frequenz unter der Bild-Nyquistgrenze
  DrehSzene.prototype.stoss = function (A, tau, f) {
    this.stoesse.push({ A: A, tau: tau, f: f, t: 0, px: Math.random() * TAU, py: Math.random() * TAU });
  };
  DrehSzene.prototype.schuetteln = function (dt) {
    var x = 0, y = 0, i, s;
    for (i = this.stoesse.length - 1; i >= 0; i--) {
      s = this.stoesse[i];
      s.t += dt;
      var e = s.A * Math.exp(-s.t / s.tau);
      if (e < 0.05) { this.stoesse.splice(i, 1); continue; }
      x += e * Math.sin(TAU * s.f * s.t + s.px);
      y += e * Math.sin(TAU * 1.3 * s.f * s.t + s.py);
    }
    return [x, y];
  };

  // ------------------------------------------------------------ Kamera nachfuehren
  DrehSzene.prototype.rahmen = function (W, H, dt) {
    var sim = this.sim, k = this.kam;
    var hs = this.cnc ? 0 : Math.round(clamp(H * 0.12, 40, 76));
    var Hm = H - hs;
    var R0 = sim.D0 / 2, bH = (sim.m.futter && sim.m.futter.backenH) || 24;
    var rho = R0 + bH + 6;
    var aMin = -32, aMax = sim.L + (sim.reitstock ? 74 : 40);
    var xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
    function rein(a, u, v) {
      var x = a * k.aX + u * k.uX, y = a * k.aY + u * k.uY + v * k.vY;
      if (x < xmin) { xmin = x; } if (x > xmax) { xmax = x; }
      if (y < ymin) { ymin = y; } if (y > ymax) { ymax = y; }
    }
    var i, j, w;
    for (j = 0; j < 2; j++) {
      for (i = 0; i < 16; i++) { w = i / 16 * TAU; rein(j ? aMax : aMin, rho * Math.cos(w), rho * Math.sin(w)); }
    }
    if (this.cnc) { rein(sim.L * 0.5, -(R0 + 85) * 0.707, (R0 + 85) * 0.707); }
    else { rein(sim.L * 0.6, R0 + 70, -28); }
    var s = Math.min(W * 0.92 / (xmax - xmin), Hm * 0.9 / (ymax - ymin));
    s = clamp(s, 0.5, 16);
    var X0 = W / 2 - s * (xmin + xmax) / 2, Y0 = Hm / 2 - s * (ymin + ymax) / 2;
    if (!this.kamBereit || this.kamW !== W || this.kamH !== H) {
      k.s = s; k.X0 = X0; k.Y0 = Y0;
      this.kamBereit = true; this.kamW = W; this.kamH = H;
    } else if (dt > 0) {
      var f = 1 - Math.exp(-dt / 0.5);
      k.s += (s - k.s) * f; k.X0 += (X0 - k.X0) * f; k.Y0 += (Y0 - k.Y0) * f;
      if (Math.abs(s - k.s) < 0.002 * s && Math.abs(X0 - k.X0) < 0.3 && Math.abs(Y0 - k.Y0) < 0.3) { k.s = s; k.X0 = X0; k.Y0 = Y0; }
    }
    this.hs = hs; this.Hm = Hm;
  };

  // ------------------------------------------------------------ Glanzmuster
  DrehSzene.prototype.muster = function (ctx, key, basis, spitze, g, nass, A) {
    var m = this.mCache[key];
    if (!m || m.ctx !== ctx) {
      var cv = baueLUT(this.kam, basis, spitze || WEISS, glanzParam(A || this.A, g, nass));
      m = { cv: cv, pat: ctx.createPattern(cv, 'repeat-x'), ctx: ctx };
      this.mCache[key] = m;
    }
    return m.pat;
  };
  DrehSzene.prototype.mantelMuster = function (ctx, run, nass) {
    var A = this.A;
    if (run.roh && !run.fleckig) { return this.muster(ctx, 'roh' + (nass ? 'n' : ''), A.roh, WEISS, A.gRoh, nass); }
    var cls = run.roh ? 3 : run.cls;
    return this.muster(ctx, 'k' + cls + (nass ? 'n' : ''), A.blank, A.spitze, G_KLASSE[cls], nass);
  };
  // Farbe einer ebenen Stirn- oder Absatzflaeche (Normale +a)
  DrehSzene.prototype.flaechenFarbe = function (stil, cls, nass) {
    var key = stil + cls + (nass ? 'n' : ''), c = this.fCache[key];
    if (c) { return c; }
    var A = this.A, basis, g;
    if (stil === 'saege') { basis = misch(A.blank, A.roh, 0.18); g = 0.12; }
    else if (stil === 'roh') { basis = A.blank; g = 0.25; }
    else { basis = A.blank; g = G_KLASSE[clamp(cls, 0, 4)]; }
    var p = glanzParam(A, g, nass), o = [0, 0, 0];
    glanzPixel(this.kam, basis, A.spitze, p, 1, 0, 0, o);
    // Stirnflaechen sehen zusaetzlich das helle Innere der Maschine (nicht nur den dunklen Boden)
    o = misch(o, basis, 0.22);
    c = this.fCache[key] = css(o);
    return c;
  };

  // ------------------------------------------------------------ Geometrie (Laeufe und Flaechen)
  DrehSzene.prototype.geometrie = function () {
    var sim = this.sim, k = this.kam;
    var sKey = Math.round(k.s * 4);
    if (this.geo && this.geoV === sim.geoVersion && this.geoS === sKey) { return this.geo; }
    this.geoV = sim.geoVersion; this.geoS = sKey;
    var N = sim.N, i, r, run, runs = [];
    var tol = Math.max(0.02, 0.4 / k.s);
    var aB = -Math.min(sim.spannL || 40, BACKE_A);
    var R0 = sim.D0 / 2;
    var iEnd = N - 1;
    while (iEnd > 0 && sim.materialRadius(iEnd) <= 0.001) { iEnd--; }
    run = { a0: aB, a1: 0, r: R0, roh: true, fleckig: false, cls: -1, i0: -1, i1: -1, ratter: 0, ruck: 0, zonen: null };
    runs.push(run);
    for (i = 0; i <= iEnd; i++) {
      r = sim.materialRadius(i);
      if (r <= 0.001) { run = null; continue; }
      var roh = !sim.bearb[i];
      var fleck = roh && sim.D[i] < sim.D0 - 0.03;
      var cls = roh ? -1 : Math.min(4, raKlasse(sim.Ra[i]) + (sim.ratter[i] > 3 ? 2 : 0));
      if (run && Math.abs(r - run.r) < tol && run.roh === roh && run.cls === cls && run.fleckig === fleck) {
        run.a1 = (i + 1) * DZ; run.i1 = i;
        if (sim.ratter[i] > run.ratter) { run.ratter = sim.ratter[i]; }
        if (sim.ruckSpur[i] > run.ruck) { run.ruck = sim.ruckSpur[i]; }
        continue;
      }
      run = { a0: i * DZ, a1: (i + 1) * DZ, r: r, roh: roh, fleckig: fleck, cls: cls, i0: i, i1: i, ratter: sim.ratter[i], ruck: sim.ruckSpur[i], zonen: null };
      runs.push(run);
    }
    // Rechte Endflaechen: sichtbarer Ring zwischen dem naechsten (kleineren) Lauf und diesem
    var j;
    for (j = 0; j < runs.length; j++) {
      var nx = runs[j + 1];
      var rN = nx && Math.abs(nx.a0 - runs[j].a1) < 1e-6 ? nx.r : 0;
      runs[j].rIn = rN;
      if (rN < runs[j].r - 1e-4) {
        var iN = runs[j].i1 + 1 < N ? runs[j].i1 + 1 : runs[j].i1;
        var raN = iN >= 0 && sim.bearb[iN] ? sim.Ra[iN] : (runs[j].i1 >= 0 ? sim.Ra[runs[j].i1] : 6.3);
        runs[j].zonen = this.zonen(runs[j], rN, raN);
      }
    }
    var last = runs[runs.length - 1];
    this.geo = { runs: runs, zFace: sim.laengeZ(), zMax: last ? last.a1 : sim.L, rEnd: last ? last.r : R0 };
    return this.geo;
  };

  // Zonen einer Endflaeche: plangedreht (stirnBearb), Saegeschnitt, roh oder Absatz vom Laengsdrehen
  DrehSzene.prototype.zonen = function (run, r0, raSchulter) {
    var sim = this.sim, z = [], j, cur = null;
    var j0 = Math.max(0, Math.floor(r0 / DR)), j1 = Math.min(sim.NR - 1, Math.ceil(run.r / DR) - 1);
    var tolZ = Math.max(0.4, 1.2 / this.kam.s);
    for (j = j0; j <= j1; j++) {
      var st = sim.stirn[j], stil, ra;
      if (Math.abs(st - run.a1) <= tolZ) {
        if (sim.stirnBearb[j]) { stil = 'plan'; ra = sim.stirnRa[j]; }
        else { stil = sim.saege ? 'saege' : 'roh'; ra = sim.stirnRa[j]; }
      } else { stil = 'schulter'; ra = raSchulter; }
      var cls = stil === 'saege' || stil === 'roh' ? -1 : raKlasse(ra);
      var ri = Math.max(j * DR, r0), ro = Math.min(run.r, (j + 1) * DR);
      if (cur && cur.stil === stil && cur.cls === cls) { cur.r1 = ro; cur.raS += ra; cur.n++; }
      else { cur = { r0: ri, r1: ro, stil: stil, cls: cls, raS: ra, n: 1 }; z.push(cur); }
    }
    for (j = 0; j < z.length; j++) { z[j].ra = z[j].raS / z[j].n; }
    if (z.length) { z[z.length - 1].r1 = run.r; z[0].r0 = r0; }
    return z;
  };

  // ------------------------------------------------------------ Zustand je Bild
  DrehSzene.prototype.zustand = function (dt, dtS, a) {
    var sim = this.sim, z = this.zustandObj;
    z.dir = this.cnc ? (sim.drehrichtung || 4) : 3;
    z.rot = z.dir === 3 ? 1 : -1;
    z.om = TAU * Math.max(0, sim.nEff) / 60;
    z.dphi = z.om * TB;
    // Riemen-Stick-Slip: die Spindel ruckt im Riemenumlauf (5,4 Hz); sichtbar nur bei kleiner Drehzahl
    var riemen = !this.cnc && sim.riemenHaft === false && sim.nEff > 1;
    var jerk = riemen ? Math.min(0.25, z.om * 0.16 * (sim.ruck || 0) / (TAU * 5.4)) * Math.sin(TAU * 5.4 * this.t) : 0;
    z.phi = -z.rot * (sim.phiU || 0) + jerk;
    z.riemen = riemen;
    // Kuehlschmierung und Naesse (trocknet nach etwa 3 s ab)
    z.kss = !!a.kss && sim.p.kss !== 'trocken';
    if (z.kss && sim.nEff > 5) { this.nass = 1; } else if (dt > 0) { this.nass = Math.max(0, this.nass - dt / 3); }
    z.nass = this.nass > 0.35;
    // Bewegung der Schneide (Richtung des Spanablaufs)
    if (dtS > 0) {
      var vz = (sim.z - this.zAlt) / dtS, vx = (sim.x - this.xAlt) / dtS;
      this.vz += (vz - this.vz) * 0.3; this.vx += (vx - this.vx) * 0.3;
    }
    this.zAlt = sim.z; this.xAlt = sim.x;
    if (sim.modus === 'plan' && sim.f > 0) { this.fPlan = sim.f; }
    if (sim.amp > 3 && sim.nEff > 5) { this.nwMerk = sim.fnAkt / (sim.nEff / 60); }
    // Ruckeln: bis 20 Hz echter Versatz von Schlitten und Werkzeug, darueber feiner Zufallsjitter
    var ruck = sim.ruck || 0, rf = sim.ruckFreq || 0;
    if (dt > 0) {
      var off = 0;
      if (ruck > 0.04 && sim.nEff > 0.3) {
        var Apx = (1 + 4 * ruck) * clamp((ruck - 0.04) / 0.1, 0, 1);
        off = rf > 0 && rf <= 20 ? Apx * Math.sin(sim.ruckPhase || 0) : (Math.random() - 0.5) * Apx;
      }
      this.ruckOff = off;
    }
    z.ruckMM = this.ruckOff / this.kam.s;
    // Zittern beim Rattern und Spanhaemmern: Unschaerfe statt abgetasteter Schwingung
    z.zittern = sim.nEff > 1 && sim.ap > 0 ? Math.min(2, 0.05 * (sim.amp || 0) + 1.2 * (sim.puls || 0) * clamp((sim.rS || 0) * 3, 0, 1)) : 0;
    z.tw = this.werkzeugRahmen(z);
    return z;
  };

  // Werkzeugrahmen: Schneidenecke, radiale Richtung er (vom Werkstueck weg), Spanflaechennormale en
  DrehSzene.prototype.werkzeugRahmen = function (z) {
    var sim = this.sim, th = this.cnc ? 135 * DEG : 0;
    var er = [0, Math.cos(th), Math.sin(th)];
    var en = [0, -z.rot * Math.sin(th), z.rot * Math.cos(th)];
    var x = sim.x, h = sim.h || 0, aOff = 0, rOff = 0;
    if (z.ruckMM) { if (sim.modus === 'plan') { rOff = z.ruckMM; } else { aOff = z.ruckMM; } }
    var tw = this.tw || (this.tw = {});
    tw.a = sim.z + aOff;
    tw.u = (x + rOff) * er[1] + h * en[1];
    tw.v = (x + rOff) * er[2] + h * en[2];
    tw.a0 = sim.z; tw.u0 = x * er[1] + h * en[1]; tw.v0 = x * er[2] + h * en[2];
    tw.er = er; tw.en = en; tw.ea = [1, 0, 0]; tw.th = th;
    // Linksschneidend, wenn an der konventionellen Maschine zum Reitstock gedreht wird
    tw.sa = !this.cnc && sim.p.richtung === 1 ? -1 : 1;
    return tw;
  };

  // =====================================================================
  //                              ZEICHNEN
  // =====================================================================
  DrehSzene.prototype.zeichne = function (cv, dt, a) {
    var t0 = jetzt();
    var gr = groesse(cv);
    if (!gr) { return; }
    var ctx = gr.ctx, W = gr.w, H = gr.h, sim = this.sim, k = this.kam;
    a = a || {};
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    var dtS = dt > 0 ? clamp((sim.zeit || 0) - this.tSim, 0, 0.25) : 0;
    this.tSim = sim.zeit || 0;
    this.t += dt;
    this.rahmen(W, H, dt);
    var st = this.statisch(W, H, gr.dpr);
    var Gm = this.geometrie();
    var z = this.zustand(dt, dtS, a);
    var tw = z.tw;
    // Werkzeugwechsel am Revolver: Schaltbewegung 45 Grad in 0,8 s
    if (sim.w !== this.wAlt) { this.wAlt = sim.w; if (this.cnc) { this.revDreh = 1; } }
    if (this.revDreh > 0 && dt > 0) { this.revDreh = Math.max(0, this.revDreh - dt / 0.8); }
    if (this.stossZeit > 0) { this.stossZeit -= dt; }
    if (this.lupeZeit > 0) { this.lupeZeit -= dt; }
    if (sim.wirr < 0.05 && this.wirrAlt > 0.3) { this.aufSchlitten.length = 0; }
    this.wirrAlt = sim.wirr;

    // Teilchen erzeugen und bewegen (Raten je Simulationszeit, Bewegung in Echtzeit)
    if (dt > 0) {
      this.spaeneErzeugen(dtS, z);
      this.funkenErzeugen(dtS, z);
      this.rauchErzeugen(dtS, z);
      this.kssTropfen(dtS, z);
      this.bewegen(dt, z);
    }

    var sh = this.schuetteln(dt);
    ctx.fillStyle = '#121618';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sh[0], sh[1]);
    ctx.drawImage(st, 0, 0, W, H);
    if (this.haufenCv) { ctx.drawImage(this.haufenCv, 0, 0, W, H); }

    // Futter hinten, Werkstueck, Futter vorn
    this.futterKoerper(ctx, k, z);
    this.backen(ctx, k, z, true);
    this.werkstueck(ctx, k, Gm, z);
    this.backen(ctx, k, z, false);
    if (sim.reitstock) { this.reitstock(ctx, k, Gm, z); }
    if (this.cnc) { this.revolver(ctx, k, z); } else { this.support(ctx, k, z); }
    this.wirrspan(ctx, k, Gm, z);
    this.kssZeichnen(ctx, k, z);
    this.spaeneZeichnen(ctx, k, z);
    this.funkenZeichnen(ctx, k, z);
    this.rauchZeichnen(ctx, k);
    if (this.cnc) { this.tuerScheibe(ctx, W, H, dt, z); } else { this.bettStreifen(ctx, W, H, k, z, dtS); }
    ctx.restore();

    // Einblendungen ohne Erschuetterung
    this.messbuegel(ctx, k, dt);
    this.lupe(ctx, W, H, k, Gm, z);
    this.status(ctx, W, H, z);
    if (this.blitz > 0) {
      ctx.fillStyle = 'rgba(217,45,32,' + (this.blitz * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 1.5);
    }
    var ms = jetzt() - t0;
    this.ms = this.ms ? this.ms * 0.9 + ms * 0.1 : ms;
    this.msLetzt = ms;
  };

  // ------------------------------------------------------------ Statische Ebene
  DrehSzene.prototype.statisch = function (W, H, dpr) {
    var k = this.kam;
    var key = W + 'x' + H + '@' + dpr + ':' + k.s.toFixed(4) + ',' + k.X0.toFixed(2) + ',' + k.Y0.toFixed(2);
    if (this.stKey === key && this.stCv) { return this.stCv; }
    var cv = this.stCv || (this.stCv = document.createElement('canvas'));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.cnc) { this.innenraumCNC(c, W, H); } else { this.umgebungKonv(c, W, H); }
    this.stKey = key;
    this.haufenNeu(W, H, dpr);
    return cv;
  };

  function polyWelt(c, k, P) {
    c.beginPath();
    c.moveTo(k.X(P[0][0], P[0][1]), k.Y(P[0][0], P[0][1], P[0][2]));
    for (var i = 1; i < P.length; i++) { c.lineTo(k.X(P[i][0], P[i][1]), k.Y(P[i][0], P[i][1], P[i][2])); }
    c.closePath();
  }

  DrehSzene.prototype.umgebungKonv = function (c, W, H) {
    var k = this.kam, sim = this.sim, g, i;
    g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#262d2c'); g.addColorStop(1, '#121616');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Spritzwand hinter dem Bett (Ebene u = -330), von der Maschinenleuchte beleuchtet
    var uW = -330, aL = -900, aR = 2400;
    polyWelt(c, k, [[aL, uW, -200], [aR, uW, -200], [aR, uW, 700], [aL, uW, 700]]);
    var lx = k.X(sim.L * 0.4, 0), ly = k.Y(sim.L * 0.4, 0, 0);
    g = c.createRadialGradient(lx, ly - 40, 10, lx, ly, Math.max(W, H) * 0.75);
    g.addColorStop(0, css(LACK, 0.78)); g.addColorStop(0.55, css(LACK, 0.52)); g.addColorStop(1, css(LACK_D, 0.42));
    c.fillStyle = g;
    c.fill();
    // Blechstoesse und Schmutzlauf
    c.strokeStyle = 'rgba(0,0,0,0.28)';
    c.lineWidth = 1;
    c.beginPath();
    for (i = -800; i < 2400; i += 420) { c.moveTo(k.X(i, uW), k.Y(i, uW, -200)); c.lineTo(k.X(i, uW), k.Y(i, uW, 700)); }
    c.stroke();
    g = c.createLinearGradient(0, k.Y(0, uW, 40), 0, k.Y(0, uW, -200));
    g.addColorStop(0, 'rgba(20,24,22,0)'); g.addColorStop(1, 'rgba(20,24,22,0.55)');
    polyWelt(c, k, [[aL, uW, -200], [aR, uW, -200], [aR, uW, 40], [aL, uW, 40]]);
    c.fillStyle = g;
    c.fill();
    // Spaenewanne zwischen Spritzwand und Bett
    polyWelt(c, k, [[aL, uW, -200], [aR, uW, -200], [aR, -240, -200], [aL, -240, -200]]);
    c.fillStyle = '#161a19';
    c.fill();
    // Bett: hintere Flachfuehrung, Spalt, vordere Prismenfuehrung (geschabt, geoelt)
    polyWelt(c, k, [[-150, -240, -200], [aR, -240, -200], [aR, -180, -200], [-150, -180, -200]]);
    c.fillStyle = lack(FUEHRUNG, 0, 0, 1, 0.35);
    c.fill();
    polyWelt(c, k, [[-150, -240, -200], [aR, -240, -200], [aR, -240, -230], [-150, -240, -230]]);
    c.fillStyle = css(LACK_D, 0.7);
    c.fill();
    polyWelt(c, k, [[-150, -180, -200], [aR, -180, -200], [aR, 95, -200], [-150, 95, -200]]);
    c.fillStyle = '#0f1312';
    c.fill();
    polyWelt(c, k, [[-150, 95, -200], [aR, 95, -200], [aR, 125, -182], [-150, 125, -182]]);
    c.fillStyle = lack(FUEHRUNG, 0, -0.7, 0.7, 0.35);
    c.fill();
    polyWelt(c, k, [[-150, 125, -182], [aR, 125, -182], [aR, 155, -200], [-150, 155, -200]]);
    c.fillStyle = lack(FUEHRUNG, 0, 0.7, 0.7, 0.35);
    c.fill();
    // Oelfilm-Glanz auf den Fuehrungen
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(k.X(-150, -210), k.Y(-150, -210, -200)); c.lineTo(k.X(aR, -210), k.Y(aR, -210, -200));
    c.moveTo(k.X(-150, 125), k.Y(-150, 125, -182)); c.lineTo(k.X(aR, 125), k.Y(aR, 125, -182));
    c.stroke();
    // Spindelstock (Kasten) mit Lagerdeckel
    quader(c, k, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], -900, -150, -250, 210, -200, 260, LACK, 0.32);
    c.beginPath();
    ringPfad(c, k, -150, 0, 92);
    c.fillStyle = lack(LACK_H, 1, 0, 0, 0.35);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.stroke();
    // Vignette
    g = c.createRadialGradient(W * 0.55, H * 0.45, Math.min(W, H) * 0.35, W * 0.55, H * 0.45, Math.max(W, H) * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  };

  DrehSzene.prototype.innenraumCNC = function (c, W, H) {
    var k = this.kam, sim = this.sim, g, i;
    c.fillStyle = '#16191b';
    c.fillRect(0, 0, W, H);
    // Schraegbett-Abdeckung (45 Grad): Ebene (u + v) / sqrt2 = -230, Teleskopbleche quer zu a
    var es = [0, -0.7071, 0.7071], ns = [0, 0.7071, 0.7071], d0 = -230;
    function P(a, s) { return [a, d0 * ns[1] + s * es[1], d0 * ns[2] + s * es[2]]; }
    var aL = -150, aR = sim.L + 450;
    polyWelt(c, k, [P(aL, -260), P(aR, -260), P(aR, 520), P(aL, 520)]);
    var y0 = k.Y(0, P(0, 520)[1], P(0, 520)[2]), y1 = k.Y(0, P(0, -260)[1], P(0, -260)[2]);
    g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#5d6266'); g.addColorStop(0.45, '#8c9296'); g.addColorStop(0.7, '#a7adb1'); g.addColorStop(1, '#5a5f63');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 1;
    for (i = aL + 40; i < aR; i += 115) {
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      var p0 = P(i, -260), p1 = P(i, 520);
      c.moveTo(k.X(p0[0], p0[1]), k.Y(p0[0], p0[1], p0[2])); c.lineTo(k.X(p1[0], p1[1]), k.Y(p1[0], p1[1], p1[2]));
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.moveTo(k.X(p0[0], p0[1]) + 1.5, k.Y(p0[0], p0[1], p0[2])); c.lineTo(k.X(p1[0], p1[1]) + 1.5, k.Y(p1[0], p1[1], p1[2]));
      c.stroke();
    }
    // Spaenefoerderer unten (Scharnierband) und Rinne
    polyWelt(c, k, [[aL, 40, -330], [aR, 40, -330], [aR, -180, -330], [aL, -180, -330]]);
    c.fillStyle = '#1d2124';
    c.fill();
    c.strokeStyle = 'rgba(120,128,134,0.25)';
    c.beginPath();
    for (i = aL; i < aR; i += 38) { c.moveTo(k.X(i, 40), k.Y(i, 40, -330)); c.lineTo(k.X(i, -180), k.Y(i, -180, -330)); }
    c.stroke();
    // Spindelstockwand links (a = -150) mit Spindelnase
    polyWelt(c, k, [[-150, -400, -330], [-150, 200, -330], [-150, 200, 520], [-150, -400, 520]]);
    c.fillStyle = lack(RAL7035, 1, 0, 0, 0.22);
    c.fill();
    c.beginPath();
    ringPfad(c, k, -150, 0, 110);
    c.fillStyle = lack(RAL7016, 1, 0, 0, 0.4);
    c.fill();
    // Rechte Wand
    polyWelt(c, k, [[aR, -400, -330], [aR, 200, -330], [aR, 200, 520], [aR, -400, 520]]);
    c.fillStyle = lack(RAL7035, -1, 0, 0, 0.18);
    c.fill();
    // Kaltweisse LED-Leuchte oben im Arbeitsraum
    g = c.createLinearGradient(0, 0, 0, H * 0.35);
    g.addColorStop(0, 'rgba(225,240,255,0.22)'); g.addColorStop(1, 'rgba(225,240,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H * 0.35);
    g = c.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.3, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  };

  // ------------------------------------------------------------ Futter
  DrehSzene.prototype.futterKoerper = function (ctx, k, z) {
    var sim = this.sim, RF = (sim.m.futter && sim.m.futter.D ? sim.m.futter.D : 200) / 2;
    var aF = -BACKE_A, aH = aF - 85, R = sim.D0 / 2, bH = sim.m.futter.backenH || 24, i, kk;
    // Spindelnase
    ctx.beginPath();
    mantelPfad(ctx, k, aH - 37, aH, RF * 0.62);
    var pat = this.muster(ctx, 'nase', rgb('#4b5258'), WEISS, 0.3, false, STAHL);
    musterAusrichten(pat, k, aH - 37, RF * 0.62);
    ctx.fillStyle = pat;
    ctx.fill();
    // Futterkoerper
    ctx.beginPath();
    mantelPfad(ctx, k, aH, aF, RF);
    pat = this.muster(ctx, 'futter', rgb('#7d858c'), WEISS, 0.45, false, STAHL);
    musterAusrichten(pat, k, aH, RF);
    ctx.fillStyle = pat;
    ctx.fill();
    // Ringnut am Umfang
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.save();
    scheibenRahmen(ctx, k, aF - 14, RF);
    ctx.moveTo(Math.cos(k.thc - 1.57), Math.sin(k.thc - 1.57));
    ctx.arc(0, 0, 1, k.thc - 1.57, k.thc + 1.57);
    ctx.restore();
    ctx.stroke();
    // Vierkant-Schluessel-Loecher am Umfang (zwischen den Backen)
    var c = z.dphi < 0.6 ? 1 - z.dphi / 0.6 : 0;
    if (c > 0.02) {
      ctx.fillStyle = 'rgba(14,16,18,' + (0.85 * c).toFixed(3) + ')';
      for (kk = 0; kk < 3; kk++) {
        var w = z.phi + TAU / 6 + kk * TAU / 3;
        if (Math.cos(w - k.thc) < 0.15) { continue; }
        var dw = 6 / RF;
        ctx.beginPath();
        var pA = [[aF - 21, w - dw], [aF - 9, w - dw], [aF - 9, w + dw], [aF - 21, w + dw]];
        for (i = 0; i < 4; i++) {
          var X = k.X(pA[i][0], RF * Math.cos(pA[i][1])), Y = k.Y(pA[i][0], RF * Math.cos(pA[i][1]), RF * Math.sin(pA[i][1]));
          if (i) { ctx.lineTo(X, Y); } else { ctx.moveTo(X, Y); }
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    // Planflaeche des Futters mit Lichtbalken und Fase
    ctx.beginPath();
    ringPfad(ctx, k, aF, 0, RF);
    ctx.fillStyle = lack(rgb('#a9b0b6'), 1, 0, 0, 0.42);
    ctx.fill();
    ctx.save();
    scheibenRahmen(ctx, k, aF, 1);
    var bet = Math.atan2(k.H[2], k.H[1]);
    ctx.beginPath();
    sektorPfad(ctx, R + bH, RF - 3, bet - 0.13, bet + 0.13);
    sektorPfad(ctx, R + bH, RF - 3, bet + Math.PI - 0.13, bet + Math.PI + 0.13);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.beginPath();
    ringPfad(ctx, k, aF, RF - 3.5, RF);
    ctx.fillStyle = 'rgba(230,236,240,0.35)';
    ctx.fill();
    // Backenfuehrungsnuten: drehen sich mit, ab etwa 600 1/min ein dunkler Ring
    var nut0 = R + bH, nut1 = RF - 7;
    if (nut1 > nut0 + 2) {
      var wRing = clamp((z.dphi - 1.6) / 0.5, 0, 1);
      ctx.save();
      scheibenRahmen(ctx, k, aF, 1);
      if (wRing < 1) {
        var m = z.dphi < 0.15 ? 1 : Math.min(5, Math.ceil(z.dphi / 0.25)), j;
        ctx.fillStyle = 'rgba(16,18,20,' + ((1 - wRing) * 0.9 / m).toFixed(3) + ')';
        for (j = 0; j < m; j++) {
          for (kk = 0; kk < 3; kk++) {
            var wn = z.phi + kk * TAU / 3 + z.rot * j * z.dphi / Math.max(1, m);
            var cw = Math.cos(wn), sw = Math.sin(wn), b = 11;
            ctx.beginPath();
            ctx.moveTo(nut0 * cw - b * sw, nut0 * sw + b * cw);
            ctx.lineTo(nut1 * cw - b * sw, nut1 * sw + b * cw);
            ctx.lineTo(nut1 * cw + b * sw, nut1 * sw - b * cw);
            ctx.lineTo(nut0 * cw + b * sw, nut0 * sw - b * cw);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      if (wRing > 0) {
        ctx.beginPath();
        ctx.moveTo(nut1, 0); ctx.arc(0, 0, nut1, 0, TAU); ctx.moveTo(nut0, 0); ctx.arc(0, 0, nut0, 0, TAU, true);
        ctx.fillStyle = 'rgba(16,18,20,' + (wRing * 0.9 * 3 * 22 / (TAU * (nut0 + nut1) / 2)).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // Drei Stufenbacken; hinten vor dem Werkstueck zeichnen, vorn danach
  DrehSzene.prototype.backen = function (ctx, k, z, hinten) {
    var sim = this.sim, R = sim.D0 / 2, bH = sim.m.futter.backenH || 24;
    var wRing = clamp((z.dphi - 1.6) / 0.5, 0, 1);
    var cov = clamp(3 * 22 / (TAU * (R + bH / 2)), 0.05, 0.9);
    var j, kk;
    if (wRing < 1) {
      var m = z.dphi < 0.15 ? 1 : Math.min(5, Math.ceil(z.dphi / 0.25));
      ctx.globalAlpha = (1 - wRing) / m + (m > 1 ? 0.06 : 0);
      for (j = 0; j < m; j++) {
        for (kk = 0; kk < 3; kk++) {
          var w = z.phi + kk * TAU / 3 + z.rot * j * z.dphi / Math.max(1, m);
          var vorn = Math.cos(w - k.thc) >= 0;
          if (vorn === hinten) { continue; }
          this.backe(ctx, k, w, R, bH);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (wRing > 0) {
      // Geisterscheibe: Deckungsgrad der Backen, leichtes Flimmern
      var al = cov * wRing * (1 + 0.03 * Math.sin(this.t * 37)) * (z.riemen ? 1 + 0.12 * Math.sin(TAU * 5.4 * this.t) : 1);
      var st = [[0, R, R + 8], [-9, R + 8, R + 16], [-18, R + 16, R + 24]], i;
      var t0 = hinten ? k.thc + Math.PI / 2 : k.thc - Math.PI / 2, t1 = t0 + Math.PI;
      for (i = 0; i < 3; i++) {
        ctx.save();
        scheibenRahmen(ctx, k, st[i][0], 1);
        ctx.beginPath();
        sektorPfad(ctx, st[i][1], st[i][2], t0, t1);
        ctx.restore();
        ctx.fillStyle = css(rgb('#9aa2a8'), 0.55 + 0.45 * licht(1, 0, 0), al);
        ctx.fill();
        if (!hinten) {
          ctx.beginPath();
          mantelPfad(ctx, k, i === 0 ? -9 : i === 1 ? -18 : -BACKE_A, st[i][0], st[i][2]);
          ctx.fillStyle = css(rgb('#8a9298'), 0.75, al * 0.9);
          ctx.fill();
        }
      }
    }
  };

  var FB_VORN = rgb('#9aa2a8'), FB_STUFE = rgb('#c9cfd4'), FB_FLANKE = rgb('#2b2f33');
  DrehSzene.prototype.backe = function (ctx, k, w, R, bH) {
    var e1 = [1, 0, 0], e2 = [0, Math.cos(w), Math.sin(w)], e3 = [0, -Math.sin(w), Math.cos(w)], O = [0, 0, 0];
    var farben = [null, FB_VORN, FB_FLANKE, FB_STUFE, FB_FLANKE, FB_FLANKE];
    var st = [[-BACKE_A, 0, R, R + 8], [-BACKE_A, -9, R + 8, R + 16], [-BACKE_A, -18, R + 16, R + bH]];
    var vorn = Math.cos(w - k.thc) >= 0, i;
    for (i = 0; i < 3; i++) {
      var q = st[vorn ? i : 2 - i];
      quader(ctx, k, O, e1, e2, e3, q[0], q[1], q[2], q[3], -11, 11, farben, 0.28);
    }
    // Grundbacke in der Fuehrungsnut und Spannschrauben
    quader(ctx, k, O, e1, e2, e3, -BACKE_A - 2, -BACKE_A + 4, R + bH, R + bH + 26, -11, 11, FB_FLANKE, 0.3);
  };

  // ------------------------------------------------------------ Werkstueck
  DrehSzene.prototype.werkstueck = function (ctx, k, Gm, z) {
    var runs = Gm.runs, i, run, sim = this.sim;
    var beta = clamp((z.dphi - 0.3) / 2.5, 0, 1);
    for (i = 0; i < runs.length; i++) {
      run = runs[i];
      if (run.r * k.s < 0.2 || run.a1 <= run.a0) { continue; }
      var pat = this.mantelMuster(ctx, run, z.nass);
      musterAusrichten(pat, k, run.a0, run.r);
      ctx.beginPath();
      mantelPfad(ctx, k, run.a0, run.a1, run.r);
      ctx.fillStyle = pat;
      ctx.fill();
      if (run.roh) { this.walzhaut(ctx, k, run, z, beta); }
      if (run.ruck > 0.12 && !run.roh) { this.ruckRinge(ctx, k, run); }
      if (run.ratter > 3 && sim.nEff < 1 && this.nwMerk > 0) { this.ratterMarken(ctx, k, run, z); }
      if (run.zonen) { this.endflaeche(ctx, k, run, z, i === runs.length - 1); }
    }
  };

  // Walzhaut-Flecken drehen sich mit; schnell verwischen sie zu ruhenden Ringen
  DrehSzene.prototype.walzhaut = function (ctx, k, run, z, beta) {
    var fl = this.flecken, i, f, s = k.s, j;
    var dichte = run.fleckig ? 1.6 : 1;
    if (beta > 0) {
      var tex = this.ringTextur(ctx);
      if (tex) {
        var L = this.sim.L + BACKE_A + 2;
        var cx = k.X(-BACKE_A, 0), cy = k.Y(-BACKE_A, 0, 0), sc = L * s / 512;
        tex.setTransform(new DOMMatrix([k.aX * sc, k.aY * sc, k.nX, k.nY, cx, cy]));
        ctx.save();
        ctx.beginPath();
        mantelPfad(ctx, k, run.a0, run.a1, run.r);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, beta * dichte);
        ctx.fillStyle = tex;
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    if (beta >= 1) { return; }
    var m = z.dphi < 0.3 ? 1 : Math.min(4, Math.ceil(z.dphi / 0.5));
    var r = run.r, cth = k.thc;
    for (j = 0; j < m; j++) {
      for (i = 0; i < fl.length; i++) {
        f = fl[i];
        if (f.a + f.wa < run.a0 || f.a > run.a1) { continue; }
        var th = f.th + z.phi + z.rot * j * z.dphi / m;
        var c = Math.cos(th - cth);
        if (c < 0.05) { continue; }
        var a0 = Math.max(run.a0, f.a), a1 = Math.min(run.a1, f.a + f.wa);
        var t0 = th - f.wt / 2, t1 = th + f.wt / 2;
        var fc = FLECK[f.typ];
        ctx.fillStyle = fc[0];
        ctx.globalAlpha = fc[1] * (1 - beta) * dichte / m * Math.min(1, c * 2.5);
        ctx.beginPath();
        ctx.moveTo(k.X(a0, r * Math.cos(t0)), k.Y(a0, r * Math.cos(t0), r * Math.sin(t0)));
        ctx.lineTo(k.X(a1, r * Math.cos(t0)), k.Y(a1, r * Math.cos(t0), r * Math.sin(t0)));
        ctx.lineTo(k.X(a1, r * Math.cos(th)), k.Y(a1, r * Math.cos(th), r * Math.sin(th)));
        ctx.lineTo(k.X(a1, r * Math.cos(t1)), k.Y(a1, r * Math.cos(t1), r * Math.sin(t1)));
        ctx.lineTo(k.X(a0, r * Math.cos(t1)), k.Y(a0, r * Math.cos(t1), r * Math.sin(t1)));
        ctx.lineTo(k.X(a0, r * Math.cos(th)), k.Y(a0, r * Math.cos(th), r * Math.sin(th)));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  // Ringstreifen der Walzhaut fuer schnelle Drehung (Deckungsgrad je axialer Lage)
  DrehSzene.prototype.ringTextur = function (ctx) {
    if (this.ringTex && this.ringTex.ctx === ctx) { return this.ringTex.pat; }
    var L = this.sim.L + BACKE_A + 2, n = 512, i, x, f;
    var acc = [], cv = document.createElement('canvas');
    cv.width = n; cv.height = 1;
    for (i = 0; i < n; i++) { acc.push([0, 0, 0, 0]); }
    for (i = 0; i < this.flecken.length; i++) {
      f = this.flecken[i];
      var c = rgb(FLECK[f.typ][0]), al = FLECK[f.typ][1] * f.wt / TAU * 2.4;
      var x0 = Math.floor((f.a + BACKE_A) / L * n), x1 = Math.ceil((f.a + f.wa + BACKE_A) / L * n);
      for (x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) {
        var q = acc[x];
        q[0] += c[0] * al; q[1] += c[1] * al; q[2] += c[2] * al; q[3] += al;
      }
    }
    var c2 = cv.getContext('2d'), img = c2.createImageData(n, 1), d = img.data;
    for (i = 0; i < n; i++) {
      var w = acc[i][3];
      if (w > 0) { d[i * 4] = acc[i][0] / w; d[i * 4 + 1] = acc[i][1] / w; d[i * 4 + 2] = acc[i][2] / w; }
      d[i * 4 + 3] = Math.round(clamp(w, 0, 0.5) * 255);
    }
    c2.putImageData(img, 0, 0);
    this.ringTex = { ctx: ctx, pat: ctx.createPattern(cv, 'repeat-y') };
    return this.ringTex.pat;
  };

  // Ruckspur: unregelmaessige Vorschubriefen und Halteringe (stehen still)
  DrehSzene.prototype.ruckRinge = function (ctx, k, run) {
    var sim = this.sim, i, dunkel = [], hell = [];
    var schritt = Math.max(1, Math.ceil(1.4 / (DZ * k.s * k.la)));
    for (i = run.i0; i <= run.i1; i += schritt) {
      var rs = sim.ruckSpur[i];
      if (rs < 0.12) { continue; }
      var hsh = ((i * 2654435761) >>> 0) / 4294967296;
      if (hsh > rs * 0.55) { continue; }
      (hsh < rs * 0.3 ? dunkel : hell).push(i);
    }
    var listen = [[dunkel, 'rgba(10,12,14,0.35)'], [hell, 'rgba(255,255,255,0.16)']], l, r = run.r;
    ctx.lineWidth = 0.9;
    for (l = 0; l < 2; l++) {
      if (!listen[l][0].length) { continue; }
      ctx.beginPath();
      for (i = 0; i < listen[l][0].length; i++) {
        var a = (listen[l][0][i] + 0.5) * DZ;
        ctx.save();
        scheibenRahmen(ctx, k, a, r);
        ctx.moveTo(Math.cos(k.thc - 1.57), Math.sin(k.thc - 1.57));
        ctx.arc(0, 0, 1, k.thc - 1.57, k.thc + 1.57);
        ctx.restore();
      }
      ctx.strokeStyle = listen[l][1];
      ctx.stroke();
    }
  };

  // Rattermarken: achsparallele Facetten, nach dem Spindelstopp deutlich sichtbar
  DrehSzene.prototype.ratterMarken = function (ctx, k, run, z) {
    var Nw = Math.min(90, Math.max(3, Math.round(this.nwMerk))), i, r = run.r;
    var al = clamp(run.ratter / 25, 0.15, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(12,14,16,' + al.toFixed(3) + ')';
    ctx.beginPath();
    for (i = 0; i < Nw; i++) {
      var th = z.phi + i * TAU / Nw;
      if (Math.cos(th - k.thc) < 0.1) { continue; }
      var u = r * Math.cos(th), v = r * Math.sin(th);
      ctx.moveTo(k.X(run.a0, u), k.Y(run.a0, u, v));
      ctx.lineTo(k.X(run.a1, u), k.Y(run.a1, u, v));
    }
    ctx.stroke();
  };

  // Rechte Endflaeche eines Laufs: plangedreht mit stehendem Lichtbalken und Riefen,
  // Saegeschnitt (dreht sich mit), Absatz vom Laengsdrehen, Zentrierbohrung
  DrehSzene.prototype.endflaeche = function (ctx, k, run, z, istEnde) {
    var zo = run.zonen, i, zz, a1 = run.a1, sim = this.sim;
    var bet = Math.atan2(k.H[2], k.H[1]);
    for (i = 0; i < zo.length; i++) {
      zz = zo[i];
      ctx.beginPath();
      ringPfad(ctx, k, a1, zz.r0, zz.r1);
      ctx.fillStyle = this.flaechenFarbe(zz.stil, zz.cls, z.nass);
      ctx.fill();
    }
    ctx.save();
    scheibenRahmen(ctx, k, a1, 1);
    for (i = 0; i < zo.length; i++) {
      zz = zo[i];
      if (zz.stil === 'plan' || zz.stil === 'schulter') {
        // Stehender Lichtbalken: anisotrope Spiegelung an den konzentrischen Drehriefen
        var ra = zz.ra, al = Math.min(25, 3 + 2.5 * ra) * DEG, I = (0.1 + 0.55 * Math.exp(-ra / 3)) * (zz.stil === 'schulter' ? 0.6 : 1);
        ctx.beginPath();
        sektorPfad(ctx, zz.r0, zz.r1, bet - al, bet + al);
        sektorPfad(ctx, zz.r0, zz.r1, bet + Math.PI - al, bet + Math.PI + al);
        ctx.fillStyle = 'rgba(255,255,255,' + (I * (z.nass ? 0.9 : 0.7)).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
    // Drehriefen (stehen still), Abstand mindestens 3 Pixel gegen Moire
    var fPl = this.cnc ? (this.fPlan || 0.2) : (sim.p.f || 0.2) * 0.5;
    for (i = 0; i < zo.length; i++) {
      zz = zo[i];
      if (zz.stil !== 'plan') { continue; }
      var dr = Math.max(fPl, 3 / (k.s * 0.45)), r, n = 0;
      ctx.beginPath();
      ctx.save();
      scheibenRahmen(ctx, k, a1, 1);
      for (r = zz.r1 - dr * 0.5; r > zz.r0 && n < 120; r -= dr) { ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, TAU); n++; }
      ctx.restore();
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(0,0,0,' + clamp(0.04 + 0.02 * zz.ra, 0.04, 0.25).toFixed(3) + ')';
      ctx.stroke();
    }
    // Saegeschnitt: parallele, leicht gebogene Riefen, drehen sich mit, verwischen schnell
    var bl = clamp((z.dphi - 0.15) / 0.6, 0, 1);
    for (i = 0; i < zo.length; i++) {
      zz = zo[i];
      if (zz.stil !== 'saege' || bl >= 1) { continue; }
      ctx.save();
      scheibenRahmen(ctx, k, a1, 1);
      ctx.beginPath();
      ctx.arc(0, 0, zz.r1, 0, TAU);
      if (zz.r0 > 0) { ctx.moveTo(zz.r0, 0); ctx.arc(0, 0, zz.r0, 0, TAU, true); }
      ctx.clip();
      ctx.rotate(z.phi + 0.6);
      var y, R = zz.r1;
      ctx.beginPath();
      for (y = -R * 0.92; y < R; y += R / 6.5) {
        var xx = Math.sqrt(Math.max(0, R * R - y * y));
        ctx.moveTo(-xx, y);
        ctx.quadraticCurveTo(0, y + R * 0.07, xx, y);
      }
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.22 * (1 - bl)).toFixed(3) + ')';
      ctx.stroke();
      // Abbruchgrat am Rand
      ctx.save();
      scheibenRahmen(ctx, k, a1, 1);
      ctx.rotate(z.phi + 2.2);
      ctx.beginPath();
      ctx.moveTo(R * 0.94, -R * 0.06); ctx.lineTo(R * 1.03, 0); ctx.lineTo(R * 0.94, R * 0.06);
      ctx.restore();
      ctx.fillStyle = 'rgba(210,214,218,' + (0.6 * (1 - bl)).toFixed(3) + ')';
      ctx.fill();
    }
    // Zentrierbohrung (DIN 332) fuer die Koernerspitze
    if (istEnde && sim.reitstock && run.r > 4) {
      ctx.beginPath();
      ringPfad(ctx, k, a1, 0, 3.15);
      ctx.fillStyle = 'rgba(25,28,30,0.85)';
      ctx.fill();
      ctx.save();
      scheibenRahmen(ctx, k, a1, 1);
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, bet - 0.9, bet + 0.9);
      ctx.restore();
      ctx.strokeStyle = 'rgba(230,235,240,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  };

  // ------------------------------------------------------------ Reitstock
  DrehSzene.prototype.reitstock = function (ctx, k, Gm, z) {
    var aS = Gm.zMax, pat;
    // Mitlaufende Koernerspitze (60 Grad) in der Zentrierbohrung
    ctx.beginPath();
    kegelPfad(ctx, k, aS - 1.8, aS + 13, 15 * Math.tan(30 * DEG));
    pat = this.muster(ctx, 'spitze', rgb('#b8bfc5'), WEISS, 0.7, false, STAHL);
    musterAusrichten(pat, k, aS + 13, 8.7);
    ctx.fillStyle = pat;
    ctx.fill();
    // Lagergehaeuse, Pinole, Reitstockoberteil
    var teile = [[aS + 13, aS + 44, 17, 'rsLager', '#7f878e', 0.5], [aS + 44, aS + 140, 27, 'rsPinole', '#aab1b7', 0.75]];
    var i;
    for (i = 0; i < teile.length; i++) {
      var t = teile[i];
      ctx.beginPath();
      mantelPfad(ctx, k, t[0], t[1], t[2]);
      pat = this.muster(ctx, t[3], rgb(t[4]), WEISS, t[5], false, STAHL);
      musterAusrichten(pat, k, t[0], t[2]);
      ctx.fillStyle = pat;
      ctx.fill();
      ctx.beginPath();
      ringPfad(ctx, k, t[1], 0, t[2]);
      ctx.fillStyle = lack(rgb(t[4]), 1, 0, 0, 0.4);
      ctx.fill();
    }
    // Skala auf der Pinole
    ctx.strokeStyle = 'rgba(20,22,24,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (i = 0; i < 9; i++) {
      var aa = aS + 60 + i * 8, th = k.thc + 0.3;
      ctx.moveTo(k.X(aa, 27 * Math.cos(th)), k.Y(aa, 27 * Math.cos(th), 27 * Math.sin(th)));
      ctx.lineTo(k.X(aa, 27 * Math.cos(th + 0.12)), k.Y(aa, 27 * Math.cos(th + 0.12), 27 * Math.sin(th + 0.12)));
    }
    ctx.stroke();
    // Reitstockkoerper
    var farbe = this.cnc ? RAL7016 : LACK;
    quader(ctx, k, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], aS + 100, aS + 360, -120, 110, -200, -40, farbe, 0.3);
    ctx.beginPath();
    mantelPfad(ctx, k, aS + 100, aS + 360, 50);
    pat = this.muster(ctx, this.cnc ? 'rsGehC' : 'rsGeh', farbe, WEISS, 0.1, false, STAHL);
    musterAusrichten(pat, k, aS + 100, 50);
    ctx.fillStyle = pat;
    ctx.fill();
    ctx.beginPath();
    ringPfad(ctx, k, aS + 100, 27.5, 50);
    ctx.fillStyle = lack(farbe, 1, 0, 0, 0.35);
    ctx.fill();
  };

  // ------------------------------------------------------------ Werkzeug: Platte und Halter
  var PLATTE = { HMCVD: ['#1e1f23', '#b8962e'], HMPVD: ['#5b4f72', '#5b4f72'], HMPOL: ['#b9bfc5', '#aeb4ba'], HSS: ['#9aa2a8', '#9aa2a8'] };
  function plattenForm(def) {
    var eps = { C: 80, D: 55, V: 35, W: 80, T: 60, S: 90 }[def.form] || 80;
    var kap = def.kappa || 95, l = def.l || 12.9;
    var w1 = (180 - kap) * DEG, w2 = (180 - kap - eps) * DEG;
    var e1x = Math.cos(w1), e1y = Math.sin(w1), e2x = Math.cos(w2), e2y = Math.sin(w2);
    var d = def.form === 'C' && l < 11 ? 3.97 : def.form === 'D' ? 6.35 : 4.76;
    return { e1: [e1x, e1y], e2: [e2x, e2y], l: l, eps: eps, dicke: d,
      pts: [0, 0, l * e2x, l * e2y, l * (e1x + e2x), l * (e1y + e2y), l * e1x, l * e1y] };
  }

  // Zeichnet Halter und Platte im Werkzeugrahmen (Ursprung Schneidenecke, e1 = a, e2 = er, e3 = en)
  DrehSzene.prototype.werkzeugKopf = function (ctx, k, tw, schaftL, schaftB, alphaGeist) {
    var sim = this.sim, w = sim.w, def = w.def, P = plattenForm(def), sa = tw.sa;
    var O = [tw.a, tw.u, tw.v], e1 = [sa, 0, 0], e2 = tw.er, e3 = tw.en, i;
    var l = P.l, t = P.dicke;
    function sp(p) { if (sa > 0) { return p; } var q = [], j; for (j = p.length - 2; j >= 0; j -= 2) { q.push(p[j], p[j + 1]); } return q; }
    // Klemmhalter: Kopf unter der Platte, zurueckgesetzt von den Schneiden, dann Schaft
    var aS0 = 5, aS1 = 5 + schaftB;
    var kopf = [1.6, 1.9, l * P.e2[0] - 0.4, l * P.e2[1] + 1.4, aS1, Math.max(4, l * 0.35), aS1, schaftL, aS0, schaftL, aS0, l * 1.1, 0.9, l * P.e1[1] * 0.9];
    var halter = BRUENIERT, blank = sim.halterSchaden > 0;
    prisma(ctx, k, O, e1, e2, e3, sp(kopf), -t - schaftB, -t, halter, halter, null, 0.3);
    if (blank) {
      // Halterkopf blank angeschliffen
      var sch = clamp(sim.halterSchaden / 3, 0.2, 1);
      ctx.fillStyle = 'rgba(214,220,226,' + (0.75 * sch).toFixed(3) + ')';
      ctx.beginPath();
      var pk = [[0, 0, -t], [6 * sch + 2, 0, -t], [6 * sch + 2, 0, -t - 6], [0, 0, -t - 6]];
      for (i = 0; i < 4; i++) {
        var q = pk[i], a = O[0] + q[0] * e1[0] + q[1] * e2[0] + q[2] * e3[0], u = O[1] + q[0] * e1[1] + q[1] * e2[1] + q[2] * e3[1], v = O[2] + q[0] * e1[2] + q[1] * e2[2] + q[2] * e3[2];
        if (i) { ctx.lineTo(k.X(a, u), k.Y(a, u, v)); } else { ctx.moveTo(k.X(a, u), k.Y(a, u, v)); }
      }
      ctx.closePath();
      ctx.fill();
    }
    // Wendeschneidplatte
    var fb = PLATTE[def.stoff] || PLATTE.HMCVD;
    var pts = P.pts.slice();
    if (w.gebrochen) {
      // Ecke fehlt: gezackte Bruchkante
      var b = 0.42 * l;
      pts = [b * P.e2[0] * 1.1, b * P.e2[1] + 0.3, l * P.e2[0], l * P.e2[1], l * (P.e1[0] + P.e2[0]), l * (P.e1[1] + P.e2[1]),
        l * P.e1[0], l * P.e1[1], b * P.e1[0] + 0.5, b * P.e1[1] * 1.05, b * 0.55, b * 0.62, b * 0.75, b * 0.35];
    }
    if (alphaGeist) { ctx.globalAlpha = alphaGeist; }
    var r = prisma(ctx, k, O, e1, e2, e3, sp(pts), -t, 0, rgb(fb[0]), rgb(fb[1]), null, 0.32);
    // Spanleitstufe als hellere Fase entlang der Schneiden, Befestigungsloch mit Schraube
    if (!alphaGeist) {
      var M = [O[0] + sa * (l * (P.e1[0] + P.e2[0]) / 2), O[1] + (l * (P.e1[1] + P.e2[1]) / 2) * e2[1], O[2] + (l * (P.e1[1] + P.e2[1]) / 2) * e2[2]];
      ctx.beginPath();
      kreis3(ctx, k, M, e1, e2, l * 0.2);
      ctx.fillStyle = '#0d0e10';
      ctx.fill();
      ctx.beginPath();
      kreis3(ctx, k, M, e1, e2, l * 0.13);
      ctx.fillStyle = '#4a4f55';
      ctx.fill();
      // Schneidkanten fein heller
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(r.tx[0], r.ty[0]);
      for (i = 1; i < r.tx.length; i++) { ctx.lineTo(r.tx[i], r.ty[i]); }
      ctx.closePath();
      ctx.stroke();
      this.verschleiss(ctx, k, O, e1, e2, e3, P, w);
    }
    ctx.globalAlpha = 1;
  };

  // Verschleissmarke VB (4-fach ueberhoeht) an der Hauptschneide, Ausbrueche als Kerben
  DrehSzene.prototype.verschleiss = function (ctx, k, O, e1, e2, e3, P, w) {
    if (w.gebrochen) { return; }
    var i;
    function pkt(x, y) {
      var a = O[0] + x * e1[0] + y * e2[0], u = O[1] + x * e1[1] + y * e2[1], v = O[2] + x * e1[2] + y * e2[2];
      return [k.X(a, u), k.Y(a, u, v)];
    }
    var lEdge = Math.min(P.l * 0.75, (this.sim.ap || 2) + 1.5);
    if (w.VB > 0.02) {
      var b = Math.max(1 / k.s, 4 * w.VB);
      var nx = P.e1[1], ny = -P.e1[0];   // nach innen auf die Platte
      if (nx * P.e2[0] + ny * P.e2[1] < 0) { nx = -nx; ny = -ny; }
      var p0 = pkt(0, 0), p1 = pkt(lEdge * P.e1[0], lEdge * P.e1[1]), p2 = pkt(lEdge * P.e1[0] + b * nx, lEdge * P.e1[1] + b * ny), p3 = pkt(b * nx, b * ny);
      ctx.fillStyle = 'rgba(216,221,226,0.85)';
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
      ctx.closePath();
      ctx.fill();
    }
    var n = w.ausbruch > 0.04 ? Math.min(3, Math.ceil(w.ausbruch * 3)) : 0;
    ctx.fillStyle = '#08090a';
    for (i = 0; i < n; i++) {
      var tt = (0.18 + 0.27 * i) * lEdge, gr = 0.35 + w.ausbruch * 0.9;
      var q0 = pkt((tt - gr) * P.e1[0], (tt - gr) * P.e1[1]), q1 = pkt((tt + gr) * P.e1[0], (tt + gr) * P.e1[1]);
      var q2 = pkt(tt * P.e1[0] + gr * 0.8 * P.e2[0], tt * P.e1[1] + gr * 0.8 * P.e2[1]);
      ctx.beginPath();
      ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q1[0], q1[1]);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Konventioneller Support: Bettschlitten, Planschlitten, Oberschlitten, Schnellwechselhalter
  DrehSzene.prototype.support = function (ctx, k, z) {
    var sim = this.sim, tw = z.tw, zc = tw.a, x = tw.u, O = [0, 0, 0], A = [1, 0, 0], U = [0, 1, 0], V = [0, 0, 1];
    var hell = rgb('#a7aeb4');
    // Bettschlitten (Querbalken ueber dem Bett) und Planschlitten
    quader(ctx, k, O, A, U, V, zc - 110, zc + 190, -240, 175, -200, -165, [LACK, LACK, LACK, LACK, LACK, hell], 0.3);
    quader(ctx, k, O, A, U, V, zc - 60, zc + 120, -175, x + 260, -165, -132, [LACK, LACK, LACK, LACK, LACK, hell], 0.3);
    // Oberschlitten mit Drehteil
    quader(ctx, k, O, A, U, V, zc - 25, zc + 105, x + 38, x + 215, -132, -112, LACK_D, 0.3);
    quader(ctx, k, O, A, U, V, zc - 20, zc + 98, x + 40, x + 210, -112, -84, [LACK, LACK, LACK, LACK, LACK, hell], 0.3);
    // Spaene, die auf dem Schlitten liegen
    this.schlittenSpaene(ctx, k, tw);
    // Schnellwechsel-Stahlhalter (Multifix) mit Klemmhebel
    quader(ctx, k, O, A, U, V, zc + 30, zc + 98, x + 50, x + 132, -84, -6, BLANKSTAHL, 0.28);
    var hz = zc + 64, hu = x + 91;
    quader(ctx, k, O, A, U, V, hz - 6, hz + 6, hu - 6, hu + 6, -6, 10, BRUENIERT, 0.3);
    var hw = 0.6;
    // Klemmhebel sitzt oben auf dem Zapfen und zeigt schraeg zum Bediener
    quader(ctx, k, [hz, hu, 0], [Math.cos(hw), Math.sin(hw), 0], [-Math.sin(hw), Math.cos(hw), 0], V, 0, 70, -4, 4, 6, 12, BRUENIERT, 0.3);
    quader(ctx, k, O, A, U, V, zc + 2, zc + 30, x + 46, x + 128, -42, 1, BLANKSTAHL, 0.3);
    // Klemmschrauben des Werkzeughalters
    ctx.fillStyle = '#1a1d20';
    var i;
    for (i = 0; i < 2; i++) {
      ctx.beginPath();
      kreis3(ctx, k, [zc + 16, x + 70 + i * 34, 1.2], A, U, 4.2);
      ctx.fill();
    }
    // Klemmhalter und Platte (Ruckeln und Zittern bewegen nur Werkzeug und Schlitten)
    this.werkzeugMitZittern(ctx, k, z, 130, 20);
  };

  DrehSzene.prototype.werkzeugMitZittern = function (ctx, k, z, L, B) {
    var tw = z.tw;
    if (z.zittern > 0.4) {
      // Zwei Geisterkopien bei +-A statt abgetasteter Schwingung (Rattern, Spanhaemmern)
      var d = z.zittern / k.s, sv = tw.u, sw = tw.v;
      tw.u = sv + d * tw.er[1]; tw.v = sw + d * tw.er[2];
      this.werkzeugKopf(ctx, k, tw, L, B, 0.35);
      tw.u = sv - d * tw.er[1]; tw.v = sw - d * tw.er[2];
      this.werkzeugKopf(ctx, k, tw, L, B, 0.35);
      tw.u = sv; tw.v = sw;
    }
    this.werkzeugKopf(ctx, k, tw, L, B, 0);
    this.schneidenGlut(ctx, k, z);
  };

  // Schneide glueht erst bei sehr heisser Schneide (Kontaktzone liegt sonst unter dem Span)
  DrehSzene.prototype.schneidenGlut = function (ctx, k, z) {
    var sim = this.sim, w = sim.w, tw = z.tw, X = k.X(tw.a, tw.u), Y = k.Y(tw.a, tw.u, tw.v);
    var aw = w.T > 700 ? clamp((w.T - 700) / 450, 0, 0.9) : 0;
    var ag = sim.ap > 0 && sim.nEff > 1 ? (sim.glut || 0) : 0;
    if (aw <= 0.01 && ag <= 0.01) { return; }
    ctx.globalCompositeOperation = 'lighter';
    if (ag > 0.01) {
      // Spanwurzel glueht (Spanunterseite)
      var c = tabelle(GLUT, sim.Tsicht || 650), r = (2 + 2 * ag) * k.s;
      var pX = X + (tw.en[1] * k.uX) * k.s * 1.5, pY = Y + (tw.en[1] * k.uY + tw.en[2] * k.vY) * k.s * 1.5;
      ctx.globalAlpha = Math.min(1, ag * 1.2);
      ctx.drawImage(sprite(c), pX - r, pY - r, 2 * r, 2 * r);
    }
    if (aw > 0.01) {
      var c2 = tabelle(GLUT, w.T), r2 = 3 * k.s;
      ctx.globalAlpha = aw;
      ctx.drawImage(sprite(c2), X - r2, Y - r2, 2 * r2, 2 * r2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  // ------------------------------------------------------------ CNC-Revolver hinter der Drehmitte
  DrehSzene.prototype.revolver = function (ctx, k, z) {
    var sim = this.sim, tw = z.tw, i;
    var rc = 60 + 138.6;
    // Revolvermitte in (u, v), Schaltdrehung beim Werkzeugwechsel
    var cu = tw.u + rc * tw.er[1], cv = tw.v + rc * tw.er[2];
    var dreh = this.revDreh > 0 ? -Math.PI / 4 * (1 - (1 - this.revDreh) * (1 - this.revDreh) * (3 - 2 * (1 - this.revDreh))) : 0;
    dreh = this.revDreh > 0 ? -Math.PI / 4 * glatt(0, 1, this.revDreh) : 0;
    var b0 = Math.atan2(-tw.er[2], -tw.er[1]) + dreh;
    var a0 = tw.a + 4, a1 = tw.a + 94, Rv = 150;
    // X-Schlitten hinter dem Revolver (auf dem Schraegbett)
    var es = [0, Math.cos(b0 + Math.PI), Math.sin(b0 + Math.PI)], et = [0, -Math.sin(b0 + Math.PI), Math.cos(b0 + Math.PI)];
    quader(ctx, k, [0, cu, cv], [1, 0, 0], es, et, tw.a + 60, tw.a + 260, 40, 230, -120, 120, RAL7016, 0.3);
    // Achteckscheibe: Umfangsflaechen, Werkzeugbloecke, Stirnseite
    var vx = [], vy = [], j;
    for (i = 0; i < 8; i++) {
      var w = b0 + Math.PI / 8 + i * Math.PI / 4;
      vx.push(cu + Rv * Math.cos(w)); vy.push(cv + Rv * Math.sin(w));
    }
    var stahl = rgb('#7b848b');
    for (i = 0; i < 8; i++) {
      j = (i + 1) % 8;
      var wn = b0 + Math.PI / 4 + i * Math.PI / 4;
      var nU = Math.cos(wn), nV = Math.sin(wn);
      if (k.sicht(0, nU, nV) <= 0) { continue; }
      ctx.fillStyle = lack(stahl, 0, nU, nV, 0.3);
      ctx.beginPath();
      ctx.moveTo(k.X(a0, vx[i]), k.Y(a0, vx[i], vy[i]));
      ctx.lineTo(k.X(a0, vx[j]), k.Y(a0, vx[j], vy[j]));
      ctx.lineTo(k.X(a1, vx[j]), k.Y(a1, vx[j], vy[j]));
      ctx.lineTo(k.X(a1, vx[i]), k.Y(a1, vx[i], vy[i]));
      ctx.closePath();
      ctx.fill();
    }
    var bloecke = [];
    for (i = 0; i < 8; i++) {
      var wb = b0 + i * Math.PI / 4;
      bloecke.push({ w: wb, t: k.tiefe(tw.a, cu + 150 * Math.cos(wb), cv + 150 * Math.sin(wb)), i: i });
    }
    bloecke.sort(function (p, q) { return p.t - q.t; });
    for (i = 0; i < 8; i++) {
      var bl = bloecke[i], ew = [0, Math.cos(bl.w), Math.sin(bl.w)], et2 = [0, -Math.sin(bl.w), Math.cos(bl.w)];
      quader(ctx, k, [0, cu, cv], [1, 0, 0], ew, et2, tw.a - 2, tw.a + 56, 138.6, 176, -32, 32, BRUENIERT, 0.32);
      if (bl.i !== 0 && bl.i % 2 === 1) {
        // weitere Aussenhalter mit Platte (vereinfacht)
        quader(ctx, k, [0, cu, cv], [1, 0, 0], ew, et2, tw.a + 4, tw.a + 29, 176, 196, -14, 11, BRUENIERT, 0.3);
      } else if (bl.i === 4 || bl.i === 2) {
        // Bohrstange axial
        quader(ctx, k, [0, cu, cv], [1, 0, 0], ew, et2, tw.a - 70, tw.a - 2, 150, 166, -8, 8, rgb('#5b6268'), 0.3);
      }
    }
    // Stirnseite der Scheibe mit Schraubenkreis
    ctx.beginPath();
    ctx.moveTo(k.X(a1, vx[0]), k.Y(a1, vx[0], vy[0]));
    for (i = 1; i < 8; i++) { ctx.lineTo(k.X(a1, vx[i]), k.Y(a1, vx[i], vy[i])); }
    ctx.closePath();
    ctx.fillStyle = lack(stahl, 1, 0, 0, 0.36);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,22,24,0.7)';
    for (i = 0; i < 8; i++) {
      var ws = b0 + i * Math.PI / 4;
      ctx.beginPath();
      kreis3(ctx, k, [a1, cu + 112 * Math.cos(ws), cv + 112 * Math.sin(ws)], [0, 1, 0], [0, 0, 1], 6);
      ctx.fill();
    }
    ctx.beginPath();
    kreis3(ctx, k, [a1, cu, cv], [0, 1, 0], [0, 0, 1], 55);
    ctx.fillStyle = lack(RAL7016, 1, 0, 0, 0.4);
    ctx.fill();
    // Aktiver Halter mit Platte (waehrend der Schaltdrehung mitgedreht)
    if (dreh !== 0) {
      var cd = Math.cos(dreh), sd = Math.sin(dreh), du = tw.u - cu, dv = tw.v - cv;
      var sv = [tw.u, tw.v, tw.er, tw.en];
      tw.u = cu + du * cd - dv * sd; tw.v = cv + du * sd + dv * cd;
      tw.er = [0, tw.er[1] * cd - tw.er[2] * sd, tw.er[1] * sd + tw.er[2] * cd];
      tw.en = [0, tw.en[1] * cd - tw.en[2] * sd, tw.en[1] * sd + tw.en[2] * cd];
      this.werkzeugKopf(ctx, k, tw, 45, 25, 0);
      tw.u = sv[0]; tw.v = sv[1]; tw.er = sv[2]; tw.en = sv[3];
    } else {
      this.werkzeugMitZittern(ctx, k, z, 45, 25);
    }
  };

  // ------------------------------------------------------------ Kuehlschmierstoff
  DrehSzene.prototype.kssZeichnen = function (ctx, k, z) {
    var sim = this.sim, tw = z.tw;
    if (!z.kss) { return; }
    var oel = sim.p.kss === 'oel';
    var cJ = oel ? 'rgba(200,150,46,0.55)' : 'rgba(232,238,236,0.72)';
    var P = [tw.a, tw.u, tw.v], i, n = [], du, dv;
    if (this.cnc) {
      // Duese am Werkzeugblock, Strahl von hinten oben auf die Schneide
      n = [tw.a + 30, tw.u + 40 * tw.er[1] + 22 * tw.en[1], tw.v + 40 * tw.er[2] + 22 * tw.en[2]];
    } else {
      // Gelenkschlauch vom Oberschlitten zur Duese ueber der Schneide
      n = [tw.a + 16, tw.u + 22, tw.v + 26];
      var b0 = [tw.a + 86, tw.u + 48, -84], b1 = [tw.a + 95, tw.u + 60, 20], b2 = [tw.a + 46, tw.u + 44, 46];
      var perl = [], m = 13;
      for (i = 0; i <= m; i++) {
        var t = i / m, mt = 1 - t;
        var q = [mt * mt * mt * b0[0] + 3 * mt * mt * t * b1[0] + 3 * mt * t * t * b2[0] + t * t * t * n[0],
          mt * mt * mt * b0[1] + 3 * mt * mt * t * b1[1] + 3 * mt * t * t * b2[1] + t * t * t * n[1],
          mt * mt * mt * b0[2] + 3 * mt * mt * t * b1[2] + 3 * mt * t * t * b2[2] + t * t * t * n[2]];
        perl.push(q);
      }
      var rP = 6.5 * k.s;
      for (i = 0; i < perl.length; i++) {
        var X = k.X(perl[i][0], perl[i][1]), Y = k.Y(perl[i][0], perl[i][1], perl[i][2]);
        var gr = ctx.createRadialGradient(X - rP * 0.35, Y - rP * 0.4, rP * 0.1, X, Y, rP);
        gr.addColorStop(0, '#6fa6dc'); gr.addColorStop(0.6, '#2a64a8'); gr.addColorStop(1, '#173a63');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(X, Y, rP * (i === perl.length - 1 ? 0.7 : 1), 0, TAU);
        ctx.fill();
      }
    }
    var nX = k.X(n[0], n[1]), nY = k.Y(n[0], n[1], n[2]), pX = k.X(P[0], P[1]), pY = k.Y(P[0], P[1], P[2]);
    var lw = Math.max(3, (this.cnc ? 6 : 5) * k.s * 0.55);
    ctx.lineCap = 'round';
    ctx.strokeStyle = cJ;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(nX, nY);
    ctx.quadraticCurveTo((nX + pX) / 2, (nY + pY) / 2 + 1.5, pX, pY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nX - lw * 0.2, nY - lw * 0.25);
    ctx.lineTo(pX - lw * 0.2, pY - lw * 0.25);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Sprühfahne an der ablaufenden Seite (tangential mit der Oberflaeche nach unten bzw. hinten)
    if (sim.nEff > 5) {
      var tA = -tw.en[0], tU = -tw.en[1] + 0.35 * tw.er[1], tV = -tw.en[2] + 0.35 * tw.er[2];
      var Lf = (45 + 30 * Math.min(1, sim.nEff / 1500)) * k.s;
      var dx = (tA * k.aX + tU * k.uX), dy = (tA * k.aY + tU * k.uY + tV * k.vY), dl = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= dl; dy /= dl;
      var wj = (Math.random() - 0.5) * 6 * DEG, o = 12 * DEG;
      var c1 = Math.cos(wj - o), s1 = Math.sin(wj - o), c2 = Math.cos(wj + o), s2 = Math.sin(wj + o);
      var g = ctx.createLinearGradient(pX, pY, pX + dx * Lf, pY + dy * Lf);
      g.addColorStop(0, oel ? 'rgba(210,160,60,0.32)' : 'rgba(235,240,240,0.34)');
      g.addColorStop(1, 'rgba(235,240,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pX, pY);
      ctx.lineTo(pX + (dx * c1 - dy * s1) * Lf, pY + (dx * s1 + dy * c1) * Lf);
      ctx.lineTo(pX + (dx * c2 - dy * s2) * Lf, pY + (dx * s2 + dy * c2) * Lf);
      ctx.closePath();
      ctx.fill();
    }
    du = dv = 0;
  };

  // ------------------------------------------------------------ Teilchen: Erzeugen
  DrehSzene.prototype.richtung = function (z, plan) {
    var tw = z.tw, sg = this.vz > 0.05 ? -1 : 1;
    if (this.cnc && this.vz > 0.05) { sg = -1; }
    var ca = plan ? 0.2 : 0.45 * sg, cr = plan ? 0.9 : 0.75, cn = plan ? 0.4 : 0.45;
    var d = [ca * tw.ea[0] + cr * tw.er[0] + cn * tw.en[0], ca * tw.ea[1] + cr * tw.er[1] + cn * tw.en[1], ca * tw.ea[2] + cr * tw.er[2] + cn * tw.en[2]];
    var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    return [d[0] / l, d[1] / l, d[2] / l];
  };
  function streu(d, w) {
    var x = d[0] + (Math.random() - 0.5) * 2 * w, y = d[1] + (Math.random() - 0.5) * 2 * w, z = d[2] + (Math.random() - 0.5) * 2 * w;
    var l = Math.sqrt(x * x + y * y + z * z) || 1;
    return [x / l, y / l, z / l];
  }

  DrehSzene.prototype.spaeneErzeugen = function (dtS, z) {
    var sim = this.sim, A = this.A, tw = z.tw;
    var schneidet = sim.ap > 0.005 && sim.nEff > 3 && sim.f > 0 && (sim.modus === 'laengs' || sim.modus === 'plan');
    this.schneidet = schneidet;
    if (!schneidet || dtS <= 0) { return; }
    var form = sim.spanForm, plan = sim.modus === 'plan';
    var lam = A.lam + 1.2 * (sim.rS || 0);
    var vch = Math.max(80, sim.vc * 1000 / 60 / lam);
    var d = this.richtung(z, plan);
    var Tspan = sim.Tspan || 20, kssF = z.kss ? 0.8 : 1;
    var basis = A.span;
    var farbe = A.anlauf ? anlaufRGB(Tspan * 0.7 * kssF, basis) : basis;
    if (form === 'gestaucht' && A.anlauf) { farbe = misch(farbe, [40, 38, 60], 0.35); }
    var h = Math.max(0.03, sim.f * (plan ? 0.7 : 0.99));
    var dicke = clamp(h * lam, 0.05, 2.5);
    var kAb = z.kss ? 1500 : 40 * 0.6 / Math.max(0.15, dicke);
    var T0 = sim.glut > 0 && !z.kss ? sim.Tsicht : Tspan;
    var rate, typ, l = 15;
    if (form === 'broeckel') { rate = this.sim.mat.id === 'GJL250' ? 90 : 55; typ = this.sim.mat.id === 'GJL250' ? 'staub' : 'broeckel'; }
    // Spanzahl je Sekunde = Spanablaufgeschwindigkeit / Spanlaenge (gestaucht etwa 6 mm,
    // C-Spaene etwa 20 mm, Wendelstuecke etwa 90 mm), gedeckelt fuer die Bildrate
    else if (form === 'gestaucht') { rate = Math.min(150, vch / 6); typ = 'dick'; }
    else if (form === 'wendel') { rate = Math.min(14, vch / 90); typ = 'wendel'; l = 45; }
    else if (form === 'band') { rate = 0; typ = 'band'; }
    else { rate = Math.min(80, vch / 20); typ = 'kurz'; }
    var n = rate * dtS, guard = 0;
    while (n > 0 && guard++ < 16) {
      if (n >= 1 || Math.random() < n) {
        var dd = streu(d, typ === 'broeckel' || typ === 'staub' ? 0.5 : 0.3);
        var vf = vch * zufall(0.6, 1.0) * (typ === 'dick' ? 1.5 : typ === 'staub' ? 0.7 : 1);
        this.spaene.push({ typ: typ, a: tw.a0 + d[0] * 1.5, u: tw.u0 + d[1] * 1.5, v: tw.v0 + d[2] * 1.5,
          va: dd[0] * vf, vu: dd[1] * vf, vv: dd[2] * vf, t: 0, leben: typ === 'staub' ? 0.6 : 2.2,
          T: T0, kAb: kAb, farbe: farbe, dicke: dicke, gr: typ === 'dick' ? 3 + h * 6 : typ === 'wendel' ? 4 + Math.random() * 3 : typ === 'kurz' ? 2.5 + Math.random() * 2.5 : 0.8,
          lang: typ === 'wendel' ? l * zufall(0.6, 1.2) : 0, rot: Math.random() * TAU, om: zufall(10, 40) * (Math.random() < 0.5 ? -1 : 1), prall: false });
      }
      n -= 1;
    }
    if (this.spaene.length > 420) { this.spaene.splice(0, this.spaene.length - 420); }
    // Fliessspan als zusammenhaengendes Band (Punkte werden an der Schneide ausgestossen)
    if (form === 'band' || form === 'wendel') {
      if (!this.bandAkt || this.bandAkt.alter > this.bandAkt.ende) {
        this.bandAkt = { p: [], alter: 0, ende: zufall(0.4, 1.1), farbe: farbe, dicke: dicke, breite: clamp(sim.ap, 0.5, 4) };
        this.baender.push(this.bandAkt);
        if (this.baender.length > 5) { this.baender.shift(); }
      }
      var b = this.bandAkt;
      b.alter += dtS;
      this.bandPhase += dtS * 14;
      var cw = Math.cos(this.bandPhase), sw = Math.sin(this.bandPhase);
      var q = [d[0] + 0.45 * (cw * tw.ea[0] + sw * tw.en[0]), d[1] + 0.45 * (cw * tw.ea[1] + sw * tw.en[1]), d[2] + 0.45 * (cw * tw.ea[2] + sw * tw.en[2])];
      var vb = vch * (form === 'wendel' ? 0.35 : 0.5);
      b.p.push({ a: tw.a0, u: tw.u0, v: tw.v0, va: q[0] * vb, vu: q[1] * vb, vv: q[2] * vb, t: 0 });
      if (b.p.length > 40) { b.p.shift(); }
    }
  };

  // Splitter beim Plattenbruch: Hartmetallstuecke; bei Alu/Messing graue Werkstoffsplitter statt Funken
  DrehSzene.prototype.splitter = function (n) {
    var tw = this.tw;
    if (!tw) { return; }
    var i, keineFunken = !(this.A.funke && this.A.funke.f > 0);
    for (i = 0; i < n; i++) {
      var d = streu([tw.er[0], tw.er[1] * 0.6 + tw.en[1] * 0.5, tw.er[2] * 0.6 + tw.en[2] * 0.5], 0.8), vf = zufall(900, 3200);
      var hm = i % 3 !== 0 || !keineFunken;
      this.spaene.push({ typ: 'splitter', a: tw.a0, u: tw.u0, v: tw.v0, va: d[0] * vf, vu: d[1] * vf, vv: d[2] * vf, t: 0, leben: 1.6,
        T: 20, kAb: 0, farbe: hm ? [52, 54, 58] : misch(this.A.blank, [255, 255, 255], 0.2), dicke: 0.6, gr: zufall(0.6, 1.8), rot: Math.random() * TAU, om: zufall(-50, 50), prall: false });
    }
  };

  DrehSzene.prototype.funkenErzeugen = function (dtS, z) {
    var sim = this.sim, A = this.A, fk = A.funke, tw = z.tw;
    var n = 0;
    if (fk.f > 0) {
      n = Math.floor((sim.funken || 0) * dtS + Math.random());
      if ((sim.funken || 0) <= 0) { n = 0; }
      n += Math.round(sim.funkenPuffer || 0);
    }
    if (sim.funkenPuffer) { sim.funkenPuffer = 0; }
    if (n <= 0) { return; }
    n = Math.min(n, 60);
    var stoss = this.stossZeit > 0;
    var vc = Math.max(20, sim.vc) * 1000 / 60;
    var T0min = 900, T0max = 1100, tau = 0.08;
    if (sim.mat.iso === 'M') { T0min = 850; T0max = 1000; }
    else if (sim.mat.iso === 'S') { T0min = 1500; T0max = 1700; tau = 0.24; }
    else if (sim.mat.iso === 'K') { T0min = 700; T0max = 850; tau = 0.05; }
    var i, tA = -tw.en[0], tU = -tw.en[1], tV = -tw.en[2];
    for (i = 0; i < n && this.funken.length < 300; i++) {
      var d, vf;
      if (stoss) { d = streu([tw.er[0] * 0.8 + tA * 0.6, tw.er[1] * 0.8 + tU * 0.6, tw.er[2] * 0.8 + tV * 0.6], 0.75); vf = zufall(3000, 9000); }
      else { d = streu([tA + 0.35 * tw.er[0], tU + 0.35 * tw.er[1], tV + 0.35 * tw.er[2]], 0.35); vf = vc * zufall(0.6, 1.2); }
      var ax = sim.halterReibt ? 4 : 0;
      this.funken.push({ a: tw.a0 + ax, u: tw.u0, v: tw.v0, va: d[0] * vf, vu: d[1] * vf, vv: d[2] * vf, t: 0,
        leben: (fk.leben || 0.3) * zufall(0.5, 1.15), T0: zufall(T0min, T0max), tau: tau * zufall(0.7, 1.4), T: 1000,
        stern: Math.random() < (fk.stern || 0), ast: false, prall: false });
    }
  };

  DrehSzene.prototype.rauchErzeugen = function (dtS, z) {
    var sim = this.sim, tw = z.tw, w = sim.w, rate = 0, typ = 'rauch';
    if (dtS <= 0) { return; }
    if (z.kss && this.schneidet && (sim.Tspan || 0) > 380) { rate = 8 * (sim.Tspan - 380) / 200; typ = 'dampf'; }
    if (this.dampfStoss) { rate += 120 * this.dampfStoss; typ = 'dampf'; this.dampfStoss = Math.max(0, this.dampfStoss - dtS * 3); }
    if (!z.kss && w.T > 760) { rate += (w.T - 760) / 200 * 6; }
    if (sim.halterReibt) { rate += 22; typ = 'rauch'; }
    if (this.schneidet && sim.mat.id === 'GJL250') { rate += 10 * Math.min(2, sim.ap * sim.f * 4); typ = 'graphit'; }
    if (sim.brand > 0) { rate += 40; typ = 'brand'; }
    var n = rate * dtS, guard = 0;
    while (n > 0 && guard++ < 8 && this.rauch.length < 70) {
      if (n >= 1 || Math.random() < n) {
        this.rauch.push({ a: tw.a0 + zufall(-2, 6), u: tw.u0 + zufall(-2, 4), v: tw.v0 + zufall(0, 4), va: zufall(-20, 30), vu: zufall(-20, 40), vv: zufall(60, 160),
          r0: typ === 'graphit' ? 2.5 : 3.5, t: 0, leben: typ === 'brand' ? 2.2 : 1.5, typ: typ });
      }
      n -= 1;
    }
  };

  DrehSzene.prototype.kssTropfen = function (dtS, z) {
    var sim = this.sim, tw = z.tw;
    if (!z.kss || sim.nEff < 5 || dtS <= 0) { return; }
    var n = Math.min(10, 150 * Math.min(1, sim.nEff / 800) * dtS * 0.4), i;
    for (i = 0; i < n || (i === 0 && Math.random() < n); i++) {
      if (i >= n && Math.random() >= n) { break; }
      var d = streu([-tw.en[0], -tw.en[1] + 0.4 * tw.er[1], -tw.en[2] + 0.4 * tw.er[2]], 0.35), vf = zufall(1000, 4000);
      this.tropfen.push({ a: tw.a0 + zufall(-2, 3), u: tw.u0, v: tw.v0, va: d[0] * vf, vu: d[1] * vf, vv: d[2] * vf, t: 0, leben: 0.5 });
    }
    if (this.tropfen.length > 120) { this.tropfen.splice(0, this.tropfen.length - 120); }
    // CNC: Spritzer auf der Tuerscheibe
    if (this.cnc && Math.random() < dtS * 6 && this.scheibe.length < 60) {
      this.scheibe.push({ x: Math.random(), y: Math.random() * 0.8, r: zufall(1.5, 5), v: zufall(6, 22), al: zufall(0.35, 0.7) });
    }
  };

  // ------------------------------------------------------------ Teilchen: Bewegen
  // Bodenhoehe fuer Spaene: Schlitten (bewegt sich mit), Bettfuehrungen, sonst faellt der Span weg
  DrehSzene.prototype.boden = function (a, u, tw) {
    if (this.cnc) {
      if ((u + a * 0) * 0.7071 + 0 > 1e9) { return -1e9; }
      return -330;
    }
    var zc = tw.a, x = tw.u;
    if (a > zc - 20 && a < zc + 98 && u > x + 40 && u < x + 210) { return -84; }
    if (a > zc - 60 && a < zc + 120 && u > -175 && u < x + 260) { return -132; }
    if (a > zc - 110 && a < zc + 190 && u > -240 && u < 175) { return -165; }
    if ((u > -240 && u < -180) || (u > 95 && u < 155)) { return -200; }
    return -2000;
  };

  DrehSzene.prototype.bewegen = function (dt, z) {
    var i, q, n, tw = z.tw, K = 2.5, sim = this.sim;
    var neu = [];
    for (i = 0; i < this.spaene.length; i++) {
      q = this.spaene[i];
      q.t += dt;
      var kk = q.typ === 'staub' ? 8 : K;
      q.va -= kk * q.va * dt; q.vu -= kk * q.vu * dt; q.vv += (-G - kk * q.vv) * dt;
      q.a += q.va * dt; q.u += q.vu * dt; q.v += q.vv * dt;
      q.rot += q.om * dt;
      if (q.T > 20) { q.T = Math.max(20, q.T - q.kAb * dt); }
      if (q.t > q.leben) { continue; }
      // Schraegbettabdeckung der CNC: Spaene rutschen in den Foerderer
      var unter = this.cnc ? (q.u + q.v) * 0.7071 < -230 || q.v < -330 : q.v < this.boden(q.a, q.u, tw);
      if (unter) {
        var bo = this.cnc ? null : this.boden(q.a, q.u, tw);
        if (bo !== null && bo < -1000) { continue; }
        var sp = Math.sqrt(q.va * q.va + q.vu * q.vu + q.vv * q.vv);
        if (!q.prall && sp > 300 && q.typ !== 'staub') {
          q.prall = true;
          q.vv = Math.abs(q.vv) * 0.15; q.va *= 0.3; q.vu *= 0.3;
          if (!this.cnc) { q.v = bo; }
          neu.push(q);
          continue;
        }
        if (q.typ !== 'staub') { this.ablegen(q, tw, bo); }
        continue;
      }
      neu.push(q);
    }
    this.spaene = neu;
    for (i = 0; i < this.baender.length; i++) {
      var b = this.baender[i], pn = [];
      for (n = 0; n < b.p.length; n++) {
        q = b.p[n];
        q.t += dt;
        q.va -= K * q.va * dt; q.vu -= K * q.vu * dt; q.vv += (-G * 0.6 - K * q.vv) * dt;
        q.a += q.va * dt; q.u += q.vu * dt; q.v += q.vv * dt;
        if (q.t < 0.55) { pn.push(q); }
      }
      b.p = pn;
    }
    this.baender = this.baender.filter(function (bb) { return bb.p.length > 1 || bb === this.bandAkt; }, this);
    if (!this.schneidet) { this.bandAkt = null; }
    neu = [];
    for (i = 0; i < this.funken.length; i++) {
      q = this.funken[i];
      q.t += dt;
      q.va -= 1.2 * q.va * dt; q.vu -= 1.2 * q.vu * dt; q.vv += (-G - 1.2 * q.vv) * dt;
      q.a += q.va * dt; q.u += q.vu * dt; q.v += q.vv * dt;
      q.T = 20 + (q.T0 - 20) * Math.exp(-q.t / (q.tau * 3));
      var tot = q.t > q.leben || q.T < 600;
      if (tot) {
        // Kohlenstoff-Sternchen am Lebensende
        if (q.stern && !q.ast && this.funken.length < 300) {
          var j, m = 3 + Math.floor(Math.random() * 3);
          for (j = 0; j < m; j++) {
            var dd = streu([q.va, q.vu, q.vv], 1.4), vf = zufall(300, 900);
            neu.push({ a: q.a, u: q.u, v: q.v, va: dd[0] * vf, vu: dd[1] * vf, vv: dd[2] * vf, t: 0, leben: zufall(0.03, 0.07), T0: q.T0 * 0.95, tau: 0.5, T: q.T0, stern: false, ast: true, prall: true });
          }
        }
        continue;
      }
      var bo2 = this.cnc ? -330 : this.boden(q.a, q.u, tw);
      if (q.v < bo2 && bo2 > -1000) {
        if (q.prall) { continue; }
        q.prall = true; q.v = bo2; q.vv = Math.abs(q.vv) * 0.3; q.va *= 0.5; q.vu *= 0.5;
      }
      neu.push(q);
    }
    this.funken = neu;
    neu = [];
    for (i = 0; i < this.rauch.length; i++) {
      q = this.rauch[i];
      q.t += dt;
      q.a += q.va * dt; q.u += q.vu * dt; q.v += q.vv * dt;
      q.vv += 40 * dt;
      if (q.t < q.leben) { neu.push(q); }
    }
    this.rauch = neu;
    neu = [];
    for (i = 0; i < this.tropfen.length; i++) {
      q = this.tropfen[i];
      q.t += dt;
      q.va -= 1.5 * q.va * dt; q.vu -= 1.5 * q.vu * dt; q.vv += (-G - 1.5 * q.vv) * dt;
      q.a += q.va * dt; q.u += q.vu * dt; q.v += q.vv * dt;
      if (q.t < q.leben && q.v > -400) { neu.push(q); }
    }
    this.tropfen = neu;
    for (i = this.scheibe.length - 1; i >= 0; i--) {
      q = this.scheibe[i];
      q.y += q.v * dt / 600;
      if (q.y > 1.05) { this.scheibe.splice(i, 1); }
    }
    if (this.mess) { this.mess.t -= dt; if (this.mess.t <= 0) { this.mess = null; } }
    n = sim;
  };

  // Gelandeter Span: auf dem Schlitten mitfuehren, im Bett bzw. Foerderer in den Haufen einbacken
  DrehSzene.prototype.ablegen = function (q, tw, bo) {
    var farbe = q.farbe;
    if (!this.cnc && bo > -199) {
      this.aufSchlitten.push({ da: q.a - tw.a, du: q.u - tw.u, v: bo, typ: q.typ, gr: q.gr, rot: q.rot, farbe: farbe, dicke: q.dicke });
      if (this.aufSchlitten.length > 140) { this.aufSchlitten.shift(); }
      return;
    }
    var h = { a: q.a, u: q.u, v: this.cnc ? Math.max(q.v, -330) : bo, typ: q.typ, gr: q.gr, rot: q.rot, farbe: farbe, dicke: q.dicke };
    this.haufen.push(h);
    if (this.haufen.length > 700) { this.haufen.splice(0, 200); this.haufenNeu(this.kamW, this.kamH, this.hDpr || 1); return; }
    if (this.haufenCv) {
      var c = this.haufenCv.getContext('2d');
      this.spanFormZeichnen(c, this.kam, h);
    }
  };

  DrehSzene.prototype.haufenNeu = function (W, H, dpr) {
    if (!W || !H) { return; }
    var cv = this.haufenCv || (this.haufenCv = document.createElement('canvas'));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    this.hDpr = dpr;
    var c = cv.getContext('2d'), i;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (i = 0; i < this.haufen.length; i++) { this.spanFormZeichnen(c, this.kam, this.haufen[i]); }
  };

  // Liegender Span als kleine Locke (in Bildkoordinaten)
  DrehSzene.prototype.spanFormZeichnen = function (c, k, h) {
    var X = k.X(h.a, h.u), Y = k.Y(h.a, h.u, h.v), r = Math.max(0.8, h.gr * k.s * 0.5);
    c.strokeStyle = css(h.farbe, 0.8);
    c.fillStyle = css(h.farbe, 0.8);
    c.lineWidth = Math.max(0.8, h.dicke * k.s * 0.35);
    c.beginPath();
    if (h.typ === 'staub' || h.typ === 'broeckel' || h.typ === 'splitter') {
      c.arc(X, Y, Math.max(0.6, r * 0.5), 0, TAU);
      c.fill();
      return;
    }
    c.ellipse(X, Y, r, r * 0.6, h.rot, 0, h.typ === 'dick' ? 3.6 : 5.2);
    c.stroke();
  };

  DrehSzene.prototype.schlittenSpaene = function (ctx, k, tw) {
    var i, h, l = this.aufSchlitten;
    for (i = 0; i < l.length; i++) {
      h = l[i];
      var X = k.X(tw.a + h.da, tw.u + h.du), Y = k.Y(tw.a + h.da, tw.u + h.du, h.v), r = Math.max(0.8, h.gr * k.s * 0.5);
      ctx.strokeStyle = css(h.farbe, 0.85);
      ctx.lineWidth = Math.max(0.8, h.dicke * k.s * 0.35);
      ctx.beginPath();
      ctx.ellipse(X, Y, r, r * 0.6, h.rot, 0, h.typ === 'dick' ? 3.6 : 5.2);
      ctx.stroke();
    }
  };

  // ------------------------------------------------------------ Teilchen: Zeichnen
  DrehSzene.prototype.spaeneZeichnen = function (ctx, k, z) {
    var sim = this.sim, tw = z.tw, s = k.s, i, q, j;
    var spX = function (q) { return k.X(q.a, q.u); }, spY = function (q) { return k.Y(q.a, q.u, q.v); };
    // Spanwurzel: die gerade entstehende Locke an der Spanflaeche
    if (this.schneidet && sim.spanForm !== 'broeckel') {
      this.spanWurzel(ctx, k, z);
    }
    // Fliessspanbaender
    for (i = 0; i < this.baender.length; i++) {
      var b = this.baender[i];
      if (b.p.length < 2) { continue; }
      ctx.beginPath();
      ctx.moveTo(spX(b.p[0]), spY(b.p[0]));
      for (j = 1; j < b.p.length; j++) { ctx.lineTo(spX(b.p[j]), spY(b.p[j])); }
      if (b === this.bandAkt && this.schneidet) { ctx.lineTo(k.X(tw.a0, tw.u0), k.Y(tw.a0, tw.u0, tw.v0)); }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = css(b.farbe, 0.75);
      ctx.lineWidth = clamp(b.breite * s * 0.35, 1.2, 6);
      ctx.stroke();
      ctx.strokeStyle = css(misch(b.farbe, [255, 255, 255], 0.45), 1, 0.7);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // Fliegende Spaene: schnelle als Bewegungsstrich, langsame als Locke bzw. Wendel
    var glueh = [];
    for (i = 0; i < this.spaene.length; i++) {
      q = this.spaene[i];
      var X = spX(q), Y = spY(q);
      var vx = (q.va * k.aX + q.vu * k.uX) * s, vy = (q.va * k.aY + q.vu * k.uY + q.vv * k.vY) * s;
      var vl = Math.sqrt(vx * vx + vy * vy) * TS;
      var lw = Math.max(0.9, q.dicke * s * (q.typ === 'dick' ? 0.6 : 0.35));
      var al = Math.min(1, (q.leben - q.t) * 4);
      ctx.globalAlpha = al;
      ctx.strokeStyle = css(q.farbe, q.typ === 'splitter' ? 1 : 0.9);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (q.typ === 'staub') {
        ctx.fillRect(X, Y, Math.max(1, s * 0.4), Math.max(1, s * 0.4));
        continue;
      }
      if (vl > 6) {
        ctx.moveTo(X - vx * TS, Y - vy * TS);
        ctx.lineTo(X, Y);
        ctx.stroke();
      } else if (q.typ === 'broeckel' || q.typ === 'splitter') {
        var g = Math.max(1.2, q.gr * s * 0.5), c = Math.cos(q.rot), sn = Math.sin(q.rot);
        ctx.moveTo(X + g * c, Y + g * sn);
        ctx.lineTo(X - g * sn * 0.6, Y + g * c * 0.6);
        ctx.lineTo(X - g * c * 0.8, Y - g * sn * 0.8);
        ctx.closePath();
        ctx.fill();
      } else if (q.typ === 'wendel') {
        var n = 5, rr = Math.max(1.2, q.gr * s * 0.5), Lx = Math.cos(q.rot) * q.lang * s * 0.5, Ly = Math.sin(q.rot) * q.lang * s * 0.5;
        for (j = 0; j <= n * 6; j++) {
          var t = j / (n * 6), ph = t * n * TAU + q.rot * 3;
          var px = X - Lx / 2 + Lx * t - Math.sin(q.rot) * rr * Math.cos(ph) * 0.9;
          var py = Y - Ly / 2 + Ly * t + Math.cos(q.rot) * rr * Math.cos(ph);
          if (j) { ctx.lineTo(px, py); } else { ctx.moveTo(px, py); }
        }
        ctx.stroke();
      } else {
        var r = Math.max(1.2, q.gr * s * 0.5);
        ctx.arc(X, Y, r, q.rot, q.rot + (q.typ === 'dick' ? 3.4 : 4.6));
        if (q.typ !== 'dick') { ctx.arc(X + r * 0.35 * Math.cos(q.rot), Y + r * 0.35 * Math.sin(q.rot), r * 0.6, q.rot + 4.6, q.rot + 7.5); }
        ctx.stroke();
        if (q.typ !== 'dick' && r > 2.5) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.arc(X, Y, r * 0.95, q.rot + 0.4, q.rot + 2);
          ctx.stroke();
        }
      }
      if (q.T > 600) { glueh.push(q); }
    }
    ctx.globalAlpha = 1;
    // Gluehende Spanstuecke additiv
    if (glueh.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < glueh.length; i++) {
        q = glueh[i];
        var X2 = spX(q), Y2 = spY(q), r2 = Math.max(2, q.gr * s * 0.7);
        ctx.globalAlpha = glutAlpha(q.T) * 0.85;
        ctx.drawImage(sprite(tabelle(GLUT, q.T)), X2 - r2, Y2 - r2, 2 * r2, 2 * r2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // KSS-Tropfen
    if (this.tropfen.length) {
      ctx.strokeStyle = this.sim.p.kss === 'oel' ? 'rgba(214,170,70,0.6)' : 'rgba(236,242,242,0.65)';
      ctx.lineWidth = Math.max(1, 0.8 * s * 0.4);
      ctx.beginPath();
      for (i = 0; i < this.tropfen.length; i++) {
        q = this.tropfen[i];
        var Xt = spX(q), Yt = spY(q);
        var tvx = (q.va * k.aX + q.vu * k.uX) * s * TS * 0.6, tvy = (q.va * k.aY + q.vu * k.uY + q.vv * k.vY) * s * TS * 0.6;
        ctx.moveTo(Xt - tvx, Yt - tvy);
        ctx.lineTo(Xt, Yt);
      }
      ctx.stroke();
    }
  };

  // Gerade entstehender Span an der Spanflaeche (Phase je Bild zufaellig: Spanbildung ist schneller als die Bildrate)
  DrehSzene.prototype.spanWurzel = function (ctx, k, z) {
    var sim = this.sim, tw = z.tw, A = this.A, form = sim.spanForm;
    var d = this.richtung(z, sim.modus === 'plan');
    var farbe = A.anlauf ? anlaufRGB((sim.Tspan || 20) * 0.7 * (z.kss ? 0.8 : 1), A.span) : A.span;
    var s = k.s, h = Math.max(0.05, sim.f);
    var dicke = clamp(h * A.lam, 0.1, 2.5);
    var R = form === 'gestaucht' ? 2.2 + h * 4 : form === 'kurz' ? 2.4 + h * 4 : 3.5 + h * 3;
    var phase = Math.random();
    var n = form === 'band' ? 0.7 : form === 'wendel' ? 1.6 : 0.9 * phase + 0.35;
    // Kreisbogen in der Ebene aus Spanrichtung und Spanflaechennormale, beginnt an der Schneide
    var e1 = d, e2 = tw.en, i, m = 14;
    ctx.beginPath();
    for (i = 0; i <= m; i++) {
      var w = i / m * n * TAU;
      var ax = R * Math.sin(w), ay = R * (1 - Math.cos(w));
      var off = form === 'wendel' ? i / m * 2.5 * h * 10 : 0;
      var a = tw.a0 + e1[0] * ax + e2[0] * ay + off * tw.ea[0] * 0.3;
      var u = tw.u0 + e1[1] * ax + e2[1] * ay;
      var v = tw.v0 + e1[2] * ax + e2[2] * ay;
      if (i) { ctx.lineTo(k.X(a, u), k.Y(a, u, v)); } else { ctx.moveTo(k.X(a, u), k.Y(a, u, v)); }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(farbe, form === 'gestaucht' ? 0.65 : 0.85);
    ctx.lineWidth = Math.max(1, dicke * s * 0.45);
    ctx.stroke();
    ctx.strokeStyle = css(misch(farbe, [255, 255, 255], 0.5), 1, 0.55);
    ctx.lineWidth = Math.max(0.6, dicke * s * 0.12);
    ctx.stroke();
    ctx.lineCap = 'butt';
  };

  // Wirrspaene: Baender um Werkstueck und Halter, drehen mit; schnell als Wolke
  DrehSzene.prototype.wirrspan = function (ctx, k, Gm, z) {
    var sim = this.sim;
    if ((sim.wirr || 0) < 0.3) { return; }
    var tw = z.tw, n = Math.min(30, Math.round(sim.wirr * 12)), i;
    var A = this.A, farbe = A.anlauf ? anlaufRGB((sim.Tspan || 200) * 0.6, A.span) : A.span;
    var rnd = lcg(77), R = Math.max(5, Math.abs(sim.x));
    var wolke = z.dphi > 1;
    ctx.lineWidth = Math.max(0.8, 0.3 * k.s);
    ctx.strokeStyle = css(farbe, 0.85, wolke ? 0.35 : 0.9);
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      var a = tw.a0 + (rnd() - 0.25) * 30, rw = R + 3 + rnd() * 12, w0 = rnd() * TAU + (wolke ? 0 : z.phi), sp = wolke ? TAU : 1 + rnd() * 2.2;
      ctx.save();
      scheibenRahmen(ctx, k, a, rw);
      ctx.moveTo(Math.cos(w0), Math.sin(w0));
      ctx.arc(0, 0, 1, w0, w0 + sp);
      ctx.restore();
    }
    // Schlingen um den Halter
    for (i = 0; i < Math.min(8, n / 3); i++) {
      var M = [tw.a0 + 8 + rnd() * 10, tw.u0 + (10 + rnd() * 30) * tw.er[1], tw.v0 + (10 + rnd() * 30) * tw.er[2]];
      kreis3(ctx, k, M, [0.6, 0, 0.8], tw.er, 6 + rnd() * 8);
    }
    ctx.stroke();
  };

  DrehSzene.prototype.funkenZeichnen = function (ctx, k, z) {
    if (!this.funken.length) { return; }
    var s = k.s, i, q, stufen = [[], [], [], [], [], []];
    for (i = 0; i < this.funken.length; i++) {
      q = this.funken[i];
      var st = q.T > 1300 ? 5 : q.T > 1100 ? 4 : q.T > 950 ? 3 : q.T > 820 ? 2 : q.T > 700 ? 1 : 0;
      stufen[st].push(q);
    }
    var hot = rgb(this.A.funke.farbe || '#ffd27a');
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    var T = [650, 760, 880, 1000, 1180, 1400];
    for (i = 0; i < 6; i++) {
      var l = stufen[i];
      if (!l.length) { continue; }
      var c = i >= 3 ? misch(tabelle(GLUT, T[i]), hot, (i - 2) / 3.2) : tabelle(GLUT, T[i]);
      var al = glutAlpha(T[i]);
      ctx.beginPath();
      for (var j = 0; j < l.length; j++) {
        q = l[j];
        var X = k.X(q.a, q.u), Y = k.Y(q.a, q.u, q.v);
        var vx = (q.va * k.aX + q.vu * k.uX) * s * TS, vy = (q.va * k.aY + q.vu * k.uY + q.vv * k.vY) * s * TS;
        ctx.moveTo(X - vx, Y - vy);
        ctx.lineTo(X, Y);
      }
      // Halo, dann heller Kern
      ctx.strokeStyle = css(c, 1, 0.25 * al);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = css(misch(c, [255, 255, 255], 0.35), 1, al);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
  };

  DrehSzene.prototype.rauchZeichnen = function (ctx, k) {
    var i, q;
    for (i = 0; i < this.rauch.length; i++) {
      q = this.rauch[i];
      var f = q.t / q.leben, r = q.r0 * (1 + 2.5 * q.t) * k.s;
      var X = k.X(q.a, q.u), Y = k.Y(q.a, q.u, q.v);
      var al = 0.16 * (1 - f) * Math.min(1, q.t * 8);
      if (q.typ === 'brand' && q.t < 0.35) {
        // Titanbrand: grell weisse Flamme
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.35 - q.t) * 2.2;
        var rs = (3 + 6 * Math.random()) * k.s;
        ctx.drawImage(sprite([255, 240, 210]), X - rs, Y - rs * 1.4, 2 * rs, 2.6 * rs);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = q.typ === 'dampf' ? 'rgba(236,240,240,' + (al * 1.2).toFixed(3) + ')' :
        q.typ === 'graphit' ? 'rgba(38,40,43,' + (al * 1.5).toFixed(3) + ')' :
        q.typ === 'brand' ? 'rgba(240,240,236,' + (al * 1.8).toFixed(3) + ')' : 'rgba(150,156,166,' + al.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(X, Y, r, 0, TAU);
      ctx.fill();
    }
  };

  // ------------------------------------------------------------ Bett vorn: Leit- und Zugspindel
  // Die Bettvorderseite liegt weit unter dem Bildausschnitt; sie wird als Streifen
  // am unteren Rand gezeigt (Bruchkante), axial deckungsgleich mit dem Bild darueber.
  DrehSzene.prototype.bettStreifen = function (ctx, W, H, k, z, dtS) {
    var sim = this.sim, hs = this.hs, y0 = H - hs, tw = z.tw, i;
    var g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, css(LACK_H, 0.62)); g.addColorStop(0.18, css(LACK, 0.62)); g.addColorStop(1, css(LACK_D, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(-20, y0, W + 40, hs + 20);
    // Bruchkante
    ctx.fillStyle = '#0d1010';
    ctx.beginPath();
    ctx.moveTo(-20, y0 - 3);
    for (i = -20; i <= W + 20; i += 14) { ctx.lineTo(i + 7, y0 - 1 + ((i / 14) % 2 ? 2 : -1)); }
    ctx.lineTo(W + 20, y0 + 2);
    ctx.lineTo(-20, y0 + 2);
    ctx.closePath();
    ctx.fill();
    // Zahnstange unter der vorderen Fuehrung
    var yZ = y0 + hs * 0.13;
    ctx.fillStyle = 'rgba(20,22,22,0.55)';
    ctx.fillRect(-20, yZ, W + 40, Math.max(2, hs * 0.07));
    ctx.strokeStyle = 'rgba(180,186,190,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = (k.X0 % 5); i < W; i += 5) { ctx.moveTo(i, yZ); ctx.lineTo(i, yZ + Math.max(2, hs * 0.07)); }
    ctx.stroke();
    var xS = function (a) { return k.X(a, 0); };
    // Leitspindel (Trapezgewinde, steht beim Laengsdrehen)
    var yL = y0 + hs * 0.36, rL = Math.max(3, hs * 0.075);
    this.stange(ctx, -20, W + 20, yL, rL, '#c3c9ce');
    ctx.strokeStyle = 'rgba(30,34,36,0.55)';
    ctx.beginPath();
    var step = Math.max(3, 6 * k.s * k.aX);
    for (i = (k.X0 % step) - step; i < W + step; i += step) { ctx.moveTo(i, yL - rL); ctx.lineTo(i + rL * 0.9, yL + rL); }
    ctx.stroke();
    // Zugspindel mit Laengsnut: dreht immer mit der Spindel (n_ZS = 0,29 n f), auch wenn die Kupplung ratscht
    var yZS = y0 + hs * 0.66, rZ = Math.max(2.5, hs * 0.065);
    var nZS = 0.29 * Math.max(0, sim.nEff) * (sim.p.f || 0.2);
    this.zsPhi += TAU * nZS / 60 * dtS;
    this.stange(ctx, -20, W + 20, yZS, rZ, '#b4bbc1');
    var dph = TAU * nZS / 60 * TB;
    var nutX0 = -20, nutX1 = W + 20;
    if (dph < 1.2) {
      var cph = Math.cos(this.zsPhi);
      if (cph > 0) {
        ctx.strokeStyle = 'rgba(15,17,19,' + (0.85 * cph).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, rZ * 0.4 * cph);
        ctx.beginPath();
        ctx.moveTo(nutX0, yZS + rZ * Math.sin(this.zsPhi) * 0.85);
        ctx.lineTo(nutX1, yZS + rZ * Math.sin(this.zsPhi) * 0.85);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(15,17,19,0.22)';
      ctx.fillRect(nutX0, yZS - rZ * 0.8, nutX1 - nutX0, rZ * 1.6);
    }
    // Laengsanschlag auf der Fuehrung (Schlosskasten stoesst bei zAnschlag an)
    var za = sim.p.zAnschlag;
    if (za !== null && za !== undefined && !this.cnc) {
      var xa = xS(za - 70);
      ctx.fillStyle = '#d6a400';
      ctx.fillRect(xa - 10, y0 + 2, 10, hs * 0.22);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(xa - 10, y0 + 2 + hs * 0.22, 10, 3);
    }
    // Schlosskasten mit Handrad und Vorschubhebel
    var xl = xS(tw.a - 70), xr = xS(tw.a + 150), yb = H - 3;
    g = ctx.createLinearGradient(xl, 0, xr, 0);
    g.addColorStop(0, css(LACK, 0.55)); g.addColorStop(0.5, css(LACK_H, 0.7)); g.addColorStop(1, css(LACK, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(xl, y0 + 1, xr - xl, yb - y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeRect(xl + 0.5, y0 + 1.5, xr - xl - 1, yb - y0 - 1);
    // Handrad dreht mit dem Bettschlitten (eine Umdrehung je etwa 20 mm)
    var hx = xS(tw.a - 25), hy = y0 + hs * 0.52, hr = hs * 0.36, hw = -tw.a / 20 * TAU;
    ctx.strokeStyle = '#c7cdd2';
    ctx.lineWidth = Math.max(2, hr * 0.16);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, hr * 0.1);
    ctx.beginPath();
    for (i = 0; i < 3; i++) { var wi = hw + i * TAU / 3; ctx.moveTo(hx, hy); ctx.lineTo(hx + hr * Math.cos(wi), hy + hr * Math.sin(wi)); }
    ctx.stroke();
    ctx.fillStyle = '#1b1d1f';
    ctx.beginPath();
    ctx.arc(hx + hr * Math.cos(hw + 0.5), hy + hr * Math.sin(hw + 0.5), Math.max(2, hr * 0.17), 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9aa1a6';
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(2, hr * 0.2), 0, TAU);
    ctx.fill();
    // Vorschubhebel: eingerueckt nach unten
    var vxh = xS(tw.a + 75), vyh = y0 + hs * 0.3, an = !!(sim.modus !== '-' && (this.vz < -0.01 || this.vx < -0.01)) || sim.kupplung > 0.1;
    ctx.strokeStyle = '#2a2d30';
    ctx.lineWidth = Math.max(2, hs * 0.05);
    ctx.beginPath();
    ctx.moveTo(vxh, vyh);
    ctx.lineTo(vxh + hs * 0.18, vyh + (an ? hs * 0.3 : -hs * 0.05));
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(vxh + hs * 0.18, vyh + (an ? hs * 0.3 : -hs * 0.05), Math.max(2.5, hs * 0.06), 0, TAU);
    ctx.fill();
    // Ueberlastkupplung ratscht: Klickmarken am Eintritt der Zugspindel
    var kl = sim.klicks || 0;
    if (kl !== this.klicksAlt) { this.ratsch = 1; this.klicksAlt = kl; }
    if (this.ratsch > 0) {
      var rx = xr + 2, ry = yZS;
      ctx.strokeStyle = 'rgba(255,214,90,' + (0.9 * this.ratsch).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (i = 0; i < 4; i++) {
        var wr = -0.9 + i * 0.6;
        ctx.moveTo(rx + rZ * 1.6 * Math.cos(wr), ry + rZ * 1.6 * Math.sin(wr));
        ctx.lineTo(rx + rZ * 3.2 * Math.cos(wr), ry + rZ * 3.2 * Math.sin(wr));
      }
      ctx.stroke();
      this.ratsch = Math.max(0, this.ratsch - 0.25);
    }
    // Beschriftung klein am linken Rand
    ctx.font = '10px ' + SCHRIFT;
    ctx.fillStyle = 'rgba(220,228,224,0.55)';
    ctx.textBaseline = 'middle';
    ctx.fillText('Leitspindel', 6, yL - rL - 5);
    ctx.fillText('Zugspindel', 6, yZS + rZ + 6);
    ctx.textBaseline = 'alphabetic';
  };

  DrehSzene.prototype.stange = function (ctx, x0, x1, y, r, farbe) {
    var g = ctx.createLinearGradient(0, y - r, 0, y + r), c = rgb(farbe);
    g.addColorStop(0, css(c, 0.55)); g.addColorStop(0.3, css(c, 1.05)); g.addColorStop(0.6, css(c, 0.75)); g.addColorStop(1, css(c, 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y - r, x1 - x0, 2 * r);
  };

  // ------------------------------------------------------------ CNC: Tuerscheibe und Alarm
  DrehSzene.prototype.tuerScheibe = function (ctx, W, H, dt, z) {
    var i, q, sim = this.sim;
    // Leicht gruenliche Polycarbonatscheibe mit Reflexstreifen
    ctx.fillStyle = 'rgba(170,200,190,0.07)';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(W * 0.15, 0, W * 0.55, H);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.055)'); g.addColorStop(0.55, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Tropfen auf der Scheibe rinnen langsam nach unten
    for (i = 0; i < this.scheibe.length; i++) {
      q = this.scheibe[i];
      var X = q.x * W, Y = q.y * H;
      ctx.fillStyle = 'rgba(225,235,235,' + (q.al * 0.35).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(X, Y, q.r, q.r * 1.25, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (q.al * 0.8).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(X - q.r * 0.35, Y - q.r * 0.4, Math.max(0.6, q.r * 0.25), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(225,235,235,' + (q.al * 0.18).toFixed(3) + ')';
      ctx.lineWidth = q.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(X, Y - q.r);
      ctx.lineTo(X, Y - q.r - q.v * 1.5);
      ctx.stroke();
    }
    // Tuerrahmen (Fensterausschnitt mit runden Ecken)
    var b = 12, rr = 18;
    ctx.fillStyle = css(RAL7016, 0.9);
    ctx.beginPath();
    ctx.rect(-30, -30, W + 60, H + 60);
    ctx.moveTo(b + rr, b);
    ctx.arcTo(W - b, b, W - b, H - b, rr);
    ctx.arcTo(W - b, H - b, b, H - b, rr);
    ctx.arcTo(b, H - b, b, b, rr);
    ctx.arcTo(b, b, W - b, b, rr);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b + rr, b + 1);
    ctx.arcTo(W - b - 1, b + 1, W - b - 1, H - b - 1, rr);
    ctx.arcTo(W - b - 1, H - b - 1, b + 1, H - b - 1, rr);
    ctx.arcTo(b + 1, H - b - 1, b + 1, b + 1, rr);
    ctx.arcTo(b + 1, b + 1, W - b - 1, b + 1, rr);
    ctx.stroke();
    // Alarmzeile
    if (sim.alarm) {
      var y = H - b - 30;
      var blink = 0.75 + 0.25 * Math.sin(this.t * 6);
      ctx.fillStyle = 'rgba(160,20,16,' + (0.88 * blink).toFixed(3) + ')';
      ctx.fillRect(b + 6, y, W - 2 * b - 12, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px ' + MONO;
      ctx.textBaseline = 'middle';
      var txt = sim.alarm, maxW = W - 2 * b - 32;
      while (ctx.measureText(txt).width > maxW && txt.length > 10) { txt = txt.slice(0, -2); }
      if (txt !== sim.alarm) { txt += '…'; }
      ctx.fillText(txt, b + 16, y + 12);
      ctx.textBaseline = 'alphabetic';
      // Signalleuchte rot
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = blink * 0.8;
      ctx.drawImage(sprite([255, 40, 30]), W - b - 40, b - 6, 34, 34);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  // ------------------------------------------------------------ Einblendungen
  // Buegelmessschraube an der Messstelle (2,5 s)
  DrehSzene.prototype.messbuegel = function (ctx, k, dt) {
    var m = this.mess;
    if (!m) { return; }
    var sim = this.sim, z = m.z, r = sim.materialRadius(sim.idx(z));
    if (r <= 0) { r = sim.D[sim.idx(z)] / 2; }
    var al = Math.min(1, m.t / 0.3, (2.5 - m.t) / 0.25 + 0.2);
    var cx = k.X(z, 0), cy = k.Y(z, 0, 0), s = k.s, nx = k.nX, ny = k.nY;
    var ax = k.aX / k.la, ay = k.aY / k.la;
    var top = [cx + nx * r * s, cy + ny * r * s], bot = [cx - nx * r * s, cy - ny * r * s];
    var amb = 6 * s + 8, bw = Math.max(26, 18 * s);
    ctx.save();
    ctx.globalAlpha = al;
    // Buegel (C-Form) seitlich neben dem Werkstueck
    var p1 = [top[0] + nx * amb, top[1] + ny * amb], p2 = [bot[0] - nx * amb, bot[1] - ny * amb];
    ctx.strokeStyle = '#d7dde2';
    ctx.lineWidth = Math.max(6, 2.6 * s);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p1[0] + ax * bw, p1[1] + ay * bw);
    ctx.lineTo(p2[0] + ax * bw, p2[1] + ay * bw);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = Math.max(3, 1.4 * s);
    ctx.beginPath();
    ctx.moveTo(p1[0] + ax * bw * 0.6 + nx * 3, p1[1] + ay * bw * 0.6 + ny * 3);
    ctx.lineTo(p2[0] + ax * bw * 0.6 - nx * 3, p2[1] + ay * bw * 0.6 - ny * 3);
    ctx.stroke();
    // Amboss und Messspindel beruehren die Silhouette
    ctx.strokeStyle = '#eef2f5';
    ctx.lineWidth = Math.max(3, 1.6 * s);
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(top[0], top[1]);
    ctx.moveTo(p2[0], p2[1]); ctx.lineTo(bot[0], bot[1]);
    ctx.stroke();
    // Skalenhuelse und Trommel
    var tL = Math.max(26, 14 * s), tx0 = p2[0] - nx * 2, ty0 = p2[1] - ny * 2;
    ctx.strokeStyle = '#b7bec4';
    ctx.lineWidth = Math.max(5, 2.2 * s);
    ctx.beginPath();
    ctx.moveTo(tx0, ty0); ctx.lineTo(tx0 - nx * tL, ty0 - ny * tL);
    ctx.stroke();
    ctx.strokeStyle = '#8d959b';
    ctx.lineWidth = Math.max(7, 3 * s);
    ctx.beginPath();
    ctx.moveTo(tx0 - nx * tL * 0.55, ty0 - ny * tL * 0.55); ctx.lineTo(tx0 - nx * tL, ty0 - ny * tL);
    ctx.stroke();
    ctx.restore();
  };

  // Lupe auf die Drehmitte beim Plandrehen: Butzen und Schneidenhoehe sichtbar machen
  DrehSzene.prototype.lupe = function (ctx, W, H, k, Gm, z) {
    var sim = this.sim, tw = z.tw;
    var rE = sim.rEff ? sim.rEff() : Math.abs(sim.x);
    var zF = Gm.zFace;
    var nahe = rE < 3.2 && Math.abs(sim.z - zF) < 4;
    if (nahe && (sim.modus === 'plan' || (sim.reib || 0) > 0)) { this.lupeZeit = Math.max(this.lupeZeit, 2.5); }
    if (this.lupeZeit <= 0) { return; }
    var R = Math.round(clamp(Math.min(W, H) * 0.17, 56, 96));
    var cx = W - R - 18, cy = R + 18 + (this.cnc ? 10 : 0);
    var L = this.lupeKam, i, j;
    L.s = R / 3.2;
    L.X0 = cx - L.s * (zF * L.aX);
    L.Y0 = cy - L.s * (zF * L.aY);
    var al = clamp(this.lupeZeit / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = al;
    // Fuehrungslinie zur Drehmitte
    var mx = k.X(zF, 0), my = k.Y(zF, 0, 0), dx = mx - cx, dy = my - cy, dl = Math.sqrt(dx * dx + dy * dy) || 1;
    ctx.strokeStyle = 'rgba(242,177,0,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + dx / dl * R, cy + dy / dl * R);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#1a1e20';
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    // Ringgruppen der Stirnflaeche um die Mitte (bis 4 mm), tiefste zuerst
    var NR = Math.min(sim.NR, Math.ceil(4.2 / DR)), gr = [], cur = null;
    for (j = 0; j < NR; j++) {
      var zj = sim.stirn[j], bj = sim.stirnBearb[j];
      if (cur && Math.abs(zj - cur.z) < 0.012 && cur.b === bj) { cur.r1 = (j + 1) * DR; cur.raS += sim.stirnRa[j]; cur.n++; }
      else { cur = { r0: j * DR, r1: (j + 1) * DR, z: zj, b: bj, raS: sim.stirnRa[j], n: 1 }; gr.push(cur); }
    }
    gr[gr.length - 1].r1 = 6;
    var ord = gr.slice().sort(function (p, q) { return p.z - q.z; });
    var bet = Math.atan2(L.H[2], L.H[1]);
    for (i = 0; i < ord.length; i++) {
      var g = ord[i], idx = gr.indexOf(g), aussen = gr[idx + 1];
      var ra = g.raS / g.n;
      // Wand des hoeheren inneren Rings (Butzen bzw. ungeplante Mitte)
      if (aussen && g.z > aussen.z + 0.005) {
        ctx.beginPath();
        mantelPfad(ctx, L, aussen.z, g.z, g.r1);
        var gx = L.X(g.z, 0), gy = L.Y(g.z, 0, 0);
        var lg = ctx.createLinearGradient(gx + L.nX * g.r1 * L.s, gy + L.nY * g.r1 * L.s, gx - L.nX * g.r1 * L.s, gy - L.nY * g.r1 * L.s);
        lg.addColorStop(0, '#4b5156'); lg.addColorStop(0.35, '#9aa1a7'); lg.addColorStop(0.7, '#6d747a'); lg.addColorStop(1, '#2c3135');
        ctx.fillStyle = lg;
        ctx.fill();
      }
      ctx.beginPath();
      ringPfad(ctx, L, g.z, 0, g.r1);
      var stil = g.b ? 'plan' : (sim.saege ? 'saege' : 'roh');
      ctx.fillStyle = this.flaechenFarbe(stil, raKlasse(ra), z.nass);
      ctx.fill();
      ctx.save();
      scheibenRahmen(ctx, L, g.z, 1);
      if (g.b) {
        var alw = Math.min(25, 3 + 2.5 * ra) * DEG, I = 0.1 + 0.55 * Math.exp(-ra / 3);
        ctx.beginPath();
        sektorPfad(ctx, 0, g.r1, bet - alw, bet + alw);
        sektorPfad(ctx, 0, g.r1, bet + Math.PI - alw, bet + Math.PI + alw);
        ctx.fillStyle = 'rgba(255,255,255,' + (I * 0.7).toFixed(3) + ')';
        ctx.fill();
        // Drehriefen in der Lupe sichtbar
        var fPl = this.cnc ? (this.fPlan || 0.2) : (sim.p.f || 0.2) * 0.5, rr, n = 0;
        ctx.beginPath();
        for (rr = g.r1; rr > g.r0 && n < 80; rr -= Math.max(fPl, 2.5 / (L.s * 0.6))) { ctx.moveTo(rr, 0); ctx.arc(0, 0, rr, 0, TAU); n++; }
        ctx.restore();
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.stroke();
      } else {
        // abgerissene Oberflaeche des Butzens bzw. ungeplante Flaeche
        ctx.restore();
        if (g.r1 < 3) {
          ctx.fillStyle = 'rgba(30,32,35,0.35)';
          var rn = lcg(Math.round(g.z * 1000));
          for (j = 0; j < 12; j++) {
            var pw = rn() * TAU, pr = Math.sqrt(rn()) * g.r1;
            ctx.beginPath();
            kreis3(ctx, L, [g.z, pr * Math.cos(pw), pr * Math.sin(pw)], [0, 1, 0], [0, 0, 1], 0.05 + rn() * 0.08);
            ctx.fill();
          }
        }
      }
    }
    // Schneide in der Lupe (zeigt die Lage zur Mitte, auch die Spitzenhoehe)
    var saveTw = { a: tw.a, u: tw.u, v: tw.v };
    tw.a = tw.a0; tw.u = tw.u0; tw.v = tw.v0;
    this.werkzeugKopf(ctx, L, tw, 60, this.cnc ? 25 : 20, 0);
    tw.a = saveTw.a; tw.u = saveTw.u; tw.v = saveTw.v;
    // Quietschen beim Reiben am Butzen: Schallboegen (keine Funken, vc ist dort fast null)
    if ((sim.reib || 0) > 0) {
      var qx = L.X(tw.a0, tw.u0), qy = L.Y(tw.a0, tw.u0, tw.v0);
      ctx.strokeStyle = 'rgba(255,214,90,0.85)';
      ctx.lineWidth = 1.5;
      for (j = 0; j < 3; j++) {
        var rq = 8 + j * 7 + (this.t * 40) % 7;
        ctx.beginPath();
        ctx.arc(qx, qy, rq, -2.4, -1.1);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Rahmen
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2b3034';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(242,177,0,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3, 0, TAU);
    ctx.stroke();
    ctx.font = '11px ' + SCHRIFT;
    ctx.fillStyle = 'rgba(232,238,234,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('Drehmitte, Lupe ×' + Math.round(L.s / k.s), cx, cy + R + 16);
    if ((sim.reib || 0) > 0) {
      ctx.fillStyle = '#ffd65a';
      ctx.fillText('quietscht – Freifläche drückt am Butzen', cx, cy + R + 30);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  };

  // Kleine Statusmarke links oben
  DrehSzene.prototype.status = function (ctx, W, H, z) {
    var sim = this.sim;
    var name = ((sim.m.name || '').match(/[A-Z]{2,3}\s?\d{2,4}/) || [this.cnc ? 'CNC' : 'LZ 200'])[0];
    var mod = { laengs: 'Längsdrehen', plan: 'Plandrehen', steht: 'Schneide steht im Schnitt' }[sim.modus] ||
      (sim.nEff > 1 ? 'Spindel läuft' : 'Spindel steht');
    var txt = name + ' · ' + mod + (this.cnc && sim.nEff > 1 ? ' · M' + z.dir : '');
    var x = this.cnc ? 22 : 10, y = this.cnc ? 22 : 10;
    ctx.font = '600 11px ' + SCHRIFT;
    var w = ctx.measureText(txt).width + 14;
    ctx.fillStyle = 'rgba(10,12,13,0.55)';
    ctx.fillRect(x, y, w, 19);
    ctx.fillStyle = sim.modus === 'laengs' || sim.modus === 'plan' ? '#f2b100' : 'rgba(220,228,224,0.85)';
    ctx.fillRect(x, y, 3, 19);
    ctx.fillStyle = 'rgba(232,238,234,0.92)';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + 9, y + 10);
    ctx.textBaseline = 'alphabetic';
  };

  ZM.szenen.DrehSzene = DrehSzene;
})(typeof window !== 'undefined' ? window : globalThis);
