/*
 * Fraesmaschine in 2.5D (ersetzt ZM.szenen.FraesSzene aus szenen.js).
 *
 * Orthografische Kamera schraeg von vorn rechts oben (psi = 30 Grad, p = 42 Grad).
 * Weltsystem in mm: x nach rechts (Tischlaengsrichtung, Vorschub), y vom
 * Bediener weg, z nach oben; Werkstueckoberseite z = 0, Tiefe positiv nach unten.
 *
 *   Werkstueck  Quader im Maschinenschraubstock auf Parallelunterlagen. Die
 *               Hoehenkarte der Simulation ist Textur der Oberseite; Nutboeden
 *               liegen als eigene Ebenen um tiefe*s*cos(p) Pixel tiefer,
 *               Rueckwaende und Stirnprofil sind Polygone (Malerprinzip).
 *   Fraeser     Zylinder mit Spannuten und Drall; ab etwa 450 1/min (z = 4)
 *               ruhender Kern mit halbdurchsichtigem Schneidenring
 *   Effekte     Spaene, Funken, KSS und Rauch in Welt-mm mit echter
 *               Geschwindigkeit. Funken nur aus der Physik (sim.funken) und
 *               beim Bruch in Eisenwerkstoffen; Tischsprung, Haemmern und
 *               Abdraengung zwanzigfach ueberhoeht und beschriftet.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  if (!ZM.szenen || !ZM.szenen.hilfen || !ZM.physik) { return; }
  var HF = ZM.szenen.hilfen;
  var PH = ZM.physik;
  var F = HF.F, SCHRIFT = HF.SCHRIFT, MONO = HF.MONO;
  var clamp = HF.clamp, zufall = HF.zufall;
  var FX = PH.FX, FY = PH.FY;
  var PI = Math.PI, PI2 = 2 * Math.PI, DEG = Math.PI / 180;
  var EPS = 0.01;          // ab dieser Tiefe (mm) gilt eine Zelle als bearbeitet
  var V = 20;              // Ueberhoehung fuer Tischbewegung und Abdraengung
  var TB = 1 / 30;         // Integrationszeit des Auges (Bewegungsunschaerfe)
  var TBS = 1 / 120;       // Belichtung fuer Spanstriche
  var TBF = 1 / 60;        // Belichtung fuer Funkenstriche
  var MAX_EBENEN = 8;
  var G_MM = 9810;         // Erdbeschleunigung mm/s^2

  // ------------------------------------------------------------- Kamera
  var PSI = 30 * DEG, PNEIG = 42 * DEG;
  var CPS = Math.cos(PSI), SPS = Math.sin(PSI), CP = Math.cos(PNEIG), SP = Math.sin(PNEIG);
  // Bildvektoren je mm (ohne Massstab), Canvas-Y nach unten
  var EXX = CPS, EXY = SPS * SP, EYX = SPS, EYY = -CPS * SP, EZY = -CP;
  // Richtung zur Kamera und Hallenlicht von rechts vorn oben
  var DX = SPS * CP, DY = -CPS * CP, DZ = SP;
  var LX = 0.30, LY = -0.45, LZ = 0.84;
  var HX, HY, HZ, HH, HHX, HHY;
  (function () {
    var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
    LX /= l; LY /= l; LZ /= l;
    HX = LX + DX; HY = LY + DY; HZ = LZ + DZ;
    l = Math.sqrt(HX * HX + HY * HY + HZ * HZ);
    HX /= l; HY /= l; HZ /= l;
    HH = Math.sqrt(HX * HX + HY * HY);
    HHX = HX / HH; HHY = HY / HH;
  })();
  // Dreiton-Schattierung der ebenen Flaechen
  var I_OBEN = 0.22 + 0.78 * LZ, I_VORN = 0.22 + 0.78 * Math.max(0, -LY), I_RECHTS = 0.22 + 0.78 * Math.max(0, LX);

  // ------------------------------------------------------------- Farben
  function sq(v) { return v * v; }
  var hexCache = {};
  function hexRgb(c) {
    var r = hexCache[c];
    if (r) { return r; }
    if (c && c.charAt(0) === '#' && c.length === 7) {
      r = [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
    } else {
      var m = /rgba?\(([^)]+)\)/.exec(c || '');
      r = m ? m[1].split(',').map(function (v) { return parseFloat(v); }).slice(0, 3) : [128, 128, 128];
    }
    hexCache[c] = r;
    return r;
  }
  function rgb(c, k) {
    k = k === undefined ? 1 : k;
    return 'rgb(' + Math.round(clamp(c[0] * k, 0, 255)) + ',' + Math.round(clamp(c[1] * k, 0, 255)) + ',' + Math.round(clamp(c[2] * k, 0, 255)) + ')';
  }
  function rgba(c, a, k) {
    k = k === undefined ? 1 : k;
    return 'rgba(' + Math.round(clamp(c[0] * k, 0, 255)) + ',' + Math.round(clamp(c[1] * k, 0, 255)) + ',' + Math.round(clamp(c[2] * k, 0, 255)) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }
  function misch(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // Gluehfarben nach Temperatur (Hallenlicht)
  var GLUEH = [[550, [74, 12, 0]], [630, [122, 22, 0]], [680, [160, 28, 4]], [740, [192, 38, 10]], [780, [216, 48, 12]],
    [850, [240, 72, 18]], [950, [255, 106, 28]], [1000, [255, 130, 38]], [1100, [255, 160, 64]], [1200, [255, 196, 104]],
    [1300, [255, 230, 168]], [1400, [255, 246, 224]]];
  function gluehRgb(T) {
    var i;
    if (T <= GLUEH[0][0]) { return GLUEH[0][1]; }
    for (i = 1; i < GLUEH.length; i++) {
      if (T < GLUEH[i][0]) { return misch(GLUEH[i - 1][1], GLUEH[i][1], (T - GLUEH[i - 1][0]) / (GLUEH[i][0] - GLUEH[i - 1][0])); }
    }
    return GLUEH[GLUEH.length - 1][1];
  }
  // sechs Temperaturstufen fuer gebuendelte Funkenstriche
  var FUNKEN_STUFEN = [640, 720, 820, 940, 1100, 1350];
  var FUNKEN_FARBEN = FUNKEN_STUFEN.map(function (T) { return rgb(gluehRgb(T + 40)); });

  var anlaufCache = {};
  function anlaufRgb(T, basis) {
    var key = Math.round(T / 5) + basis;
    var c = anlaufCache[key];
    if (!c) { c = anlaufCache[key] = hexRgb(PH.anlaufFarbe(T, basis)); }
    return c;
  }

  // Wertrauschen fuer Walzhaut, Gusshaut, Saegeriefen
  function hash2(i, j) {
    var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function wert(x, y) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    var a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // Optik des Werkstoffs: Farben, Glanz, Art der Rohoberflaeche
  function matOptik(mat) {
    var o = { blank: hexRgb(mat.farbe), roh: hexRgb(mat.roh), span: hexRgb(mat.spanFarbe), glanz: 1, art: 'walz', rost: false };
    if (mat.iso === 'K') { o.art = 'guss'; o.glanz = 0.35; }
    else if (mat.iso === 'N' && mat.kleben > 0.5) { o.art = 'strang'; o.glanz = 1.1; }
    else if (mat.iso === 'N') { o.art = 'messing'; }
    else if (mat.iso === 'M') { o.art = 'gebeizt'; o.glanz = 0.9; }
    else if (mat.iso === 'S') { o.art = 'titan'; o.glanz = 0.6; }
    else { o.rost = mat.id === 'S235'; }
    return o;
  }

  // Spiegelbild der Halle auf senkrechten Zylindern: dunkel - hell - mittel - dunkel - hell
  function umgebung(q) {
    return 0.16 + 0.80 * Math.exp(-sq((q - 0.42) / 0.16)) + 0.30 * Math.exp(-sq((q + 0.12) / 0.3)) + 0.40 * Math.exp(-sq((q + 0.86) / 0.09));
  }
  // Farbverlauf quer ueber einen senkrechten Zylinder (q = -1 linker, +1 rechter Rand)
  function zylStops(c, g, ks) {
    var st = [], i;
    for (i = 0; i <= 16; i++) {
      var q = -1 + i / 8;
      var phi = PSI - Math.acos(clamp(q, -1, 1));
      var nx = Math.cos(phi), ny = Math.sin(phi);
      var diff = Math.max(0, nx * LX + ny * LY);
      // Linienglanz eines Zylinders: Normale parallel zum waagrechten Halbvektor
      var spec = Math.pow(Math.max(0, nx * HHX + ny * HHY), 6 + 90 * g * g);
      var k = (1 - g) * (0.30 + 0.70 * diff) + g * (0.15 * diff + 0.85 * umgebung(q));
      k *= 0.62 + 0.38 * Math.sqrt(Math.max(0, 1 - q * q));
      var sp = 255 * ks * g * spec;
      st.push('rgb(' + Math.round(clamp(c[0] * k + sp, 0, 255)) + ',' + Math.round(clamp(c[1] * k + sp, 0, 255)) + ',' + Math.round(clamp(c[2] * k + sp, 0, 255)) + ')');
    }
    return st;
  }
  function verlauf(ctx, st, xl, xr) {
    var g = ctx.createLinearGradient(xl, 0, Math.max(xl + 0.5, xr), 0), i, n = st.length - 1;
    for (i = 0; i <= n; i++) { g.addColorStop(i / n, st[i]); }
    return g;
  }

  // Senkrechter Kegelstumpf (oder Zylinder) als Pfad: Unterkante Yu mit Radius ru,
  // Oberkante Yo mit Radius ro (px). Unten vordere, oben hintere Halbellipse.
  function stumpfPfad(ctx, X, Yu, ru, Yo, ro) {
    ru = Math.max(0.01, ru);
    ro = Math.max(0.01, ro);
    ctx.beginPath();
    ctx.moveTo(X - ro, Yo);
    ctx.lineTo(X - ru, Yu);
    ctx.ellipse(X, Yu, ru, ru * SP, 0, PI, 0, true);
    ctx.lineTo(X + ro, Yo);
    ctx.ellipse(X, Yo, ro, ro * SP, 0, 0, PI, true);
    ctx.closePath();
  }

  function texturNeu(w, h) {
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    return { cv: cv, ctx: ctx, img: img, d: img.data, k: 0 };
  }

  function groesse(cv) {
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }

  var jetzt = root.performance && root.performance.now ? function () { return root.performance.now(); } : function () { return Date.now(); };

  // Kategorien liegender Teile: wo im Malerprinzip sie gezeichnet werden
  var K_HINTEN = 0, K_VORN = 1, K_OBEN = 2, K_NUT = 3;

  // =====================================================================
  //                               SZENE
  // =====================================================================
  function FraesSzene(sim) {
    var i;
    this.sim = sim;
    this.mo = matOptik(sim.mat);
    this.NX = sim.NX;
    this.NY = sim.NY;
    var N = this.NX * this.NY;
    this.tK = new Float32Array(N);         // Kopie der Hoehenkarte (erkennt neu geschnittene Zellen)
    this.passY = new Float32Array(N);      // Fraesermitte quer beim Schnitt (Bogenrichtung)
    this.ratter = new Uint8Array(N);       // Ratteramplitude beim Schnitt (um)
    this.richt = new Int8Array(N);         // Vorschubrichtung beim Schnitt
    this.marke = new Uint8Array(N);        // Marke vom Tischsprung
    this.brand = new Uint16Array(N);       // Anlauffarbe durch Reiben im Stillstand (Grad C)
    this.schmier = new Uint8Array(N);      // verschmiertes Aluminium (Aufschweissung)
    this.lvl = new Uint8Array(N);          // Ebene der Zelle (0 = Oberseite)
    this.rohC = new Uint8ClampedArray(N * 3);
    this.wandY = [];
    this.wandX = [];
    for (i = 0; i < this.NX; i++) { this.wandY.push([]); this.wandX.push([]); }
    this.ebenen = [];
    this.ebIdx = {};
    this.ebReihe = [];
    this.kStep = 1;
    this.oben = null;
    this.W = 0; this.H = 0; this.dpr = 1; this.s = 0;
    this.geoV = -1;
    this.xGeo = sim.x;
    this.geomSchraubstock();
    this.rohBerechnen();
    this.seitenTexturen();
    this.gluehSprite = this.spriteNeu();

    this.winkel = 0;
    this.dphi = 0;
    this.zeitAlt = sim.zeit;
    this.uhr = 0;
    this.flug = [];        // fliegende Spaene, Splitter, Tropfen, Bruchstuecke
    this.fk = [];          // Funken
    this.dunst = [];       // Rauch, Dampf, Nebel, Graphitstaub
    this.nutSp = [];       // Spaene in der Nut (Spaenestau)
    this.liegO = [];       // liegende Spaene auf Werkstueck und Backen
    this.liegW = [];       // alle eingebackenen Spaene (fuer Neuaufbau nach Groessenaenderung)
    this.stuecke = [];     // liegende Bruchstuecke
    this.stoesse = [];
    this.blitz = 0;
    this.blitzFarbe = [217, 45, 32];
    this.eTief = 0; this.kick = 0; this.geist = 0; this.phZE = 0; this.phRuck = 0;
    this.ox = 0; this.oy = 0;
    this.vs = 0;
    this.spanAkku = 0; this.funkenAkku = 0; this.tropfAkku = 0; this.rauchAkku = 0; this.nebelAkku = 0;
    this.nass = 0; this.nassStufe = 0;
    this.wRef = sim.w;
    this.bruch = null;
    this.markeZeit = 0;
    this.klackAlt = sim.tischKlack || 0;
    this.verweil = 0; this.xAlt = sim.x; this.brandZeit = 0;
    this.obenDirty = false; this.obenZeit = 0;
    this.dirAkt = sim.p.richtung || 1;
    this.alarmZeit = 0;
    this.dauer = 0;
    this.G = {};
    this.jag = [];
    for (i = 0; i < 9; i++) { this.jag.push(zufall(-1, 1)); }
    this.cvO = null;
  }

  // ------------------------------------------------------- Geometrie fest
  FraesSzene.prototype.geomSchraubstock = function () {
    var sim = this.sim, H = sim.H;
    var tief = sim.op && sim.op.tiefe ? sim.op.tiefe : 0;
    // Werkstueck steht mindestens Nuttiefe + 5 mm ueber die Backen
    var ue = Math.max(H * 0.5, Math.min(H - 6, 20), tief + 6);
    ue = clamp(ue, Math.min(4, H * 0.8), Math.max(4, H - 3));
    this.ue = ue;
    this.zJ = -ue;                         // Backenoberkante
    this.zB = Math.min(this.zJ - 40, -H);  // Schraubstockbett
    this.zT = this.zB - 95;                // Maschinentisch
    this.xm = sim.L / 2;                   // Backenmitte
  };

  FraesSzene.prototype.bx = function (x, y) { return this.X0 + this.s * (x * EXX + y * EYX); };
  FraesSzene.prototype.by = function (x, y, z) { return this.Y0 + this.s * (x * EXY + y * EYY + z * EZY); };

  // Massstab aus der Huelle von Werkstueck, Fraeserweg und vorderer Backe
  FraesSzene.prototype.layout = function (W, H, dpr) {
    var sim = this.sim, L = sim.L, B = sim.B, R = Math.max(3, sim.R || 5);
    this.W = W; this.H = H; this.dpr = dpr;
    var P = [-R - 9, 0, 0, -R - 9, B, 0, L + R + 9, 0, 0, L + R + 9, B, 0, 0, 0, -this.ue - 4, L, 0, -this.ue - 4,
      L, -16, this.zJ, L * 0.5, sim.y, 34, L * 0.5, sim.y, -sim.H * 0.4];
    var uMin = 1e9, uMax = -1e9, vMin = 1e9, vMax = -1e9, i;
    for (i = 0; i < P.length; i += 3) {
      var u = P[i] * EXX + P[i + 1] * EYX, v = P[i] * EXY + P[i + 1] * EYY + P[i + 2] * EZY;
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
    }
    var m = W < 600 ? 10 : 24;
    var s = Math.min((W - 2 * m) / (uMax - uMin), (H - 2 * m) / (vMax - vMin));
    this.s = Math.max(0.5, s);
    this.X0 = (W - this.s * (uMax + uMin)) / 2;
    this.Y0 = (H - this.s * (vMax + vMin)) / 2 + (H - 2 * m - this.s * (vMax - vMin)) * 0.1;
    this.statischZeichnen();
    this.kStep = 1;
    this.vollNeu();
    this.werkzeugFarben();
    this.liegendNeuBacken();
  };

  // ------------------------------------------------------- Rohoberflaeche
  FraesSzene.prototype.rohBerechnen = function () {
    var mo = this.mo, NX = this.NX, NY = this.NY, d = this.rohC, ix, iy, c, x, y, k, n1, n2, n3, r, g, b, tr;
    var roh = mo.roh, rost = [116, 72, 44], art = mo.art;
    for (ix = 0; ix < NX; ix++) {
      x = (ix + 0.5) * FX;
      for (iy = 0; iy < NY; iy++) {
        y = (iy + 0.5) * FY;
        c = ix * NY + iy;
        n1 = wert(x * 0.16, y * 0.16);
        n2 = wert(x * 0.7 + 31, y * 0.7 + 7);
        r = roh[0]; g = roh[1]; b = roh[2];
        if (art === 'walz') {
          // Walzhaut: fleckig, laengs leicht gestreift, bei S235 Flugrost
          k = 0.84 + 0.22 * n1 + 0.1 * n2;
          k *= 0.97 + 0.05 * hash2(3, iy >> 2);
          if (mo.rost) {
            n3 = wert(x * 0.09 + 50, y * 0.12 + 13);
            if (n3 > 0.7) {
              tr = clamp((n3 - 0.7) * 3.5, 0, 0.75) * (0.55 + 0.45 * n2);
              r += (rost[0] - r) * tr; g += (rost[1] - g) * tr; b += (rost[2] - b) * tr;
            }
          }
        } else if (art === 'strang') {
          k = 0.92 + 0.09 * wert(3.1, y * 2.3) + 0.05 * n1;
        } else if (art === 'guss') {
          k = 0.78 + 0.16 * hash2(ix, iy) + 0.16 * n1;
        } else if (art === 'messing') {
          k = 0.88 + 0.14 * n1 + 0.06 * wert(5, y * 1.7);
        } else {
          k = 0.9 + 0.12 * n1 + 0.04 * n2;
        }
        k *= I_OBEN;
        d[c * 3] = r * k; d[c * 3 + 1] = g * k; d[c * 3 + 2] = b * k;
      }
    }
  };

  // Vorderseite (Walzhaut bzw. Pressprofil) und gesaegte Stirnseite als kleine Texturen
  FraesSzene.prototype.seitenTexturen = function () {
    var mo = this.mo, i, j, k, w = 256, h = 64;
    var tv = texturNeu(w, h), d = tv.d, p;
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        p = (j * w + i) * 4;
        var n1 = wert(i * 0.07, j * 0.15), n2 = wert(i * 0.4 + 9, j * 0.6 + 3);
        if (mo.art === 'strang') { k = 0.93 + 0.08 * wert(2.2, j * 0.9) + 0.04 * n1; }
        else if (mo.art === 'guss') { k = 0.8 + 0.2 * hash2(i, j) + 0.12 * n1; }
        else { k = 0.85 + 0.2 * n1 + 0.08 * n2; }
        k *= I_VORN * (1 - 0.18 * Math.pow(j / h, 2));
        var c = mo.roh;
        if (mo.rost && wert(i * 0.05 + 20, j * 0.12) > 0.74) { c = misch(c, [116, 72, 44], 0.5); }
        d[p] = c[0] * k; d[p + 1] = c[1] * k; d[p + 2] = c[2] * k; d[p + 3] = 255;
      }
    }
    tv.ctx.putImageData(tv.img, 0, 0);
    this.texVorn = tv.cv;
    // Saegeschnitt: leicht gebogene, parallele Riefen, Rand mit Zunder
    var ts = texturNeu(128, 64);
    d = ts.d;
    var basis = mo.art === 'guss' ? mo.blank : misch(mo.blank, mo.roh, 0.22);
    for (j = 0; j < 64; j++) {
      for (i = 0; i < 128; i++) {
        p = (j * 128 + i) * 4;
        var u = i + 0.004 * sq(j - 32) * 3;
        var riefe = 0.92 + 0.08 * Math.sin(u * 1.9) + 0.05 * hash2(Math.floor(u * 1.3), 7);
        k = I_RECHTS * riefe * (0.92 + 0.12 * wert(i * 0.1, j * 0.1));
        var rand = Math.min(i, 127 - i, j, 63 - j);
        var cc = rand < 2 ? misch(basis, mo.roh, 0.7) : basis;
        d[p] = cc[0] * k; d[p + 1] = cc[1] * k; d[p + 2] = cc[2] * k; d[p + 3] = 255;
      }
    }
    ts.ctx.putImageData(ts.img, 0, 0);
    this.texStirn = ts.cv;
  };

  FraesSzene.prototype.spriteNeu = function () {
    var cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,214,140,1)');
    g.addColorStop(0.25, 'rgba(255,120,40,0.75)');
    g.addColorStop(0.6, 'rgba(200,40,10,0.25)');
    g.addColorStop(1, 'rgba(120,10,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return cv;
  };

  // ------------------------------------------------------- Werkzeugfarben
  FraesSzene.prototype.werkzeugFarben = function () {
    var def = this.sim.def, st = ZM.daten && ZM.daten.schneidstoffe ? ZM.daten.schneidstoffe[def.stoff] : null;
    var c = hexRgb(st ? st.farbe : '#9ea4aa'), g = 0.7;
    if (def.stoff === 'VHMTIALN') { c = hexRgb('#4f465f'); g = 0.5; }
    if (def.al) { c = hexRgb('#d0d5da'); g = 0.95; }
    if (def.stoff === 'HSSTIN') { g = 0.6; }
    if (def.stoff === 'HSS' || def.stoff === 'HSSE') { c = hexRgb('#b8bec4'); g = 0.65; }
    this.wkzRgb = c;
    this.stopsWkz = zylStops(c, g, 0.85);
    // beschichtete VHM-Fraeser haben einen blanken, geschliffenen Schaft
    this.stopsSchaft = def.stoff === 'VHMTIALN' ? zylStops(hexRgb('#9ea4aa'), 0.75, 0.9) : this.stopsWkz;
    this.stopsAl = zylStops(hexRgb('#c4cad0'), 0.25, 0.4);
    this.stopsVB = zylStops(hexRgb('#e4e8ec'), 0.9, 1);
    this.stopsStahl = zylStops(hexRgb('#b4bbc1'), 0.8, 0.9);
    this.stopsDunkel = zylStops(hexRgb('#3a3f44'), 0.35, 0.5);
    this.stopsNase = zylStops(hexRgb('#2e3337'), 0.45, 0.5);
    this.stopsPinole = zylStops(hexRgb('#bfc5ca'), 0.9, 1);
    this.stopsMutter = zylStops(hexRgb('#c2c8cd'), 0.75, 0.9);
    this.dDef = def;
  };

  // =====================================================================
  //                     HOEHENKARTE: TEXTUREN UND EBENEN
  // =====================================================================
  FraesSzene.prototype.kVon = function (t) {
    var st = this.kStep;
    return Math.round(t * this.s * CP / st) * st;
  };

  FraesSzene.prototype.ebeneFuer = function (k) {
    var i = this.ebIdx[k];
    if (i !== undefined) { return i; }
    if (this.ebenen.length >= MAX_EBENEN) { this.kStep *= 2; this.neuBauen = true; return 0; }
    var e = texturNeu(this.NX, this.NY);
    e.k = k;
    this.ebenen.push(e);
    i = this.ebenen.length - 1;
    this.ebIdx[k] = i;
    this.ebReihe = this.ebenen.slice().sort(function (a, b) { return b.k - a.k; });
    return i;
  };

  // Spalten a..b der Texturen neu schattieren und hochladen
  FraesSzene.prototype.spaltenNeu = function (a, b) {
    var sim = this.sim, NX = this.NX, NY = this.NY, tK = this.tK, lvl = this.lvl;
    a = Math.max(0, a); b = Math.min(NX - 1, b);
    if (b < a || !this.oben) { return; }
    var ix, iy, c, t, li, e, p;
    for (ix = a; ix <= b; ix++) {
      for (iy = 0; iy < NY; iy++) {
        c = ix * NY + iy;
        t = tK[c];
        lvl[c] = t < EPS ? 0 : this.ebeneFuer(this.kVon(t)) + 1;
      }
    }
    if (this.neuBauen) { return; }
    var eb = this.ebenen, ne = eb.length, od = this.oben.d, mo = this.mo, roh = this.rohC, blank = mo.blank;
    var R = Math.max(0.5, sim.R), nass = this.nassStufe * 0.5;
    var duktil = clamp(sim.mat.duktil, 0, 1.4), VB = sim.w ? sim.w.VB : 0;
    var gratN = Math.round(1 + duktil * 1.6 + VB * 3);
    // Ratterschuppen: Wellenlaenge entlang der Schneidbahn und Baender in Vorschubrichtung
    var vcMm = Math.max(1, (sim.vc || 0) * 1000 / 60), fn = Math.max(200, sim.fn || 1500);
    var lam = clamp(vcMm / fn, 0.5, 6);
    var fZE = sim.fZE || Math.max(1, sim.nEff * sim.def.z / 60);
    var vfS = Math.max(0.01, (sim.fz || 0) * sim.def.z * sim.nEff / 60);
    var schweb = Math.abs(fn - Math.round(fn / fZE) * fZE);
    var dxR = clamp(vfS / Math.max(0.5, schweb), 0.3, 5);
    var wetK = 1 - 0.13 * nass, wetS = 1 + 0.9 * nass;
    for (ix = a; ix <= b; ix++) {
      var x = (ix + 0.5) * FX;
      var wl = sim.wandL[ix], wr = sim.wandR[ix], hatWand = wr > wl;
      for (iy = 0; iy < NY; iy++) {
        c = ix * NY + iy;
        t = tK[c];
        li = lvl[c];
        p = ((NY - 1 - iy) * NX + ix) * 4;
        var r, g, bb;
        if (li === 0) {
          // Oberseite: Rohflaeche, an den Nutkanten heller Grat
          r = roh[c * 3]; g = roh[c * 3 + 1]; bb = roh[c * 3 + 2];
          var grat = 0, j;
          for (j = 1; j <= gratN; j++) {
            if ((iy + j < NY && tK[c + j] >= EPS) || (iy - j >= 0 && tK[c - j] >= EPS)) { grat = 1 - (j - 1) / (gratN + 1); break; }
          }
          if (!grat && ((ix + 1 < NX && tK[c + NY] >= EPS) || (ix > 0 && tK[c - NY] >= EPS))) { grat = 0.55; }
          if (grat > 0) {
            var gk = I_OBEN * (1.0 + 0.35 * hash2(ix * 3 + 1, iy)) * (0.7 + 0.3 * duktil);
            var ga = grat * (0.55 + 0.35 * Math.min(1, duktil));
            r += (blank[0] * gk - r) * ga; g += (blank[1] * gk - g) * ga; bb += (blank[2] * gk - bb) * ga;
          }
          if (nass > 0) { r = r * wetK; g = g * wetK; bb = bb * wetK; }
          od[p] = r; od[p + 1] = g; od[p + 2] = bb; od[p + 3] = 255;
          for (e = 0; e < ne; e++) { eb[e].d[p + 3] = 0; }
        } else {
          // Nutboden: Schummerung, Ra-Glanz, Schneidenboegen, Rattern, Marken
          var y = (iy + 0.5) * FY;
          var tl = ix > 0 && lvl[c - NY] === li ? tK[c - NY] : t;
          var tr = ix < NX - 1 && lvl[c + NY] === li ? tK[c + NY] : t;
          var tu = iy > 0 && lvl[c - 1] === li ? tK[c - 1] : t;
          var to = iy < NY - 1 && lvl[c + 1] === li ? tK[c + 1] : t;
          var gx = clamp((tr - tl) / (2 * FX), -0.3, 0.3) * 5, gy = clamp((to - tu) / (2 * FY), -0.3, 0.3) * 5;
          var nL = (gx * LX + gy * LY + LZ) / Math.sqrt(1 + gx * gx + gy * gy);
          var ra = sim.raBoden[c] || 1.6;
          var gl = clamp(1 - Math.log(ra / 0.4) / Math.LN2 / 5, 0, 1) * mo.glanz;
          var ao = 1;
          if (hatWand) {
            var dw = Math.min(y - wl, wr - y);
            if (dw > -0.5) { ao = 1 - 0.38 * Math.exp(-Math.max(0, dw) / (0.45 * t + 0.25)); }
          }
          var k = (0.22 + 0.78 * Math.max(0, nL)) * ao * (1 - 0.2 * clamp(ra / 6.3, 0, 1));
          var sa = clamp((y - this.passY[c]) / R, -0.98, 0.98), ca = Math.sqrt(1 - sa * sa), dr = this.richt[c] || 1;
          var w1 = -dr * sa * HHX + ca * HHY, w2 = dr * sa * HHX + ca * HHY;
          var br = 0.12 + 0.4 * (1 - gl);
          var spec = 0.7 * Math.exp(-w1 * w1 / (br * br)) + 0.35 * Math.exp(-w2 * w2 / (br * br));
          var am = this.ratter[c];
          if (am > 2) {
            var ph = PI2 * (R * Math.asin(sa) / lam + x / dxR), ar = Math.min(1, am / 20);
            k *= 1 + 0.12 * ar * Math.sin(ph);
            spec *= 1 + 0.8 * ar * Math.sin(ph + 1.2);
          }
          var mk = this.marke[c];
          if (mk) { k *= 1 - 0.38 * mk / 255; spec *= 0.3; }
          var sm = this.schmier[c];
          if (sm) { k *= 1 - 0.22 * sm / 255 * (0.6 + 0.8 * hash2(ix, iy >> 1)); spec *= 1 - 0.75 * sm / 255; }
          var kSp = 255 * gl * (0.06 + 0.42 * spec) * wetS * ao;
          k *= wetK;
          r = blank[0] * k + kSp; g = blank[1] * k + kSp; bb = blank[2] * k + kSp;
          var tb = this.brand[c];
          if (tb > 200) {
            var af = anlaufRgb(Math.min(tb, 590), '#808080'), at = clamp((tb - 200) / 150, 0.3, 0.75);
            r += (af[0] * k * 1.1 - r) * at; g += (af[1] * k * 1.1 - g) * at; bb += (af[2] * k * 1.1 - bb) * at;
          }
          od[p + 3] = 0;
          for (e = 0; e < ne; e++) {
            var dd = eb[e].d;
            if (e === li - 1) { dd[p] = r; dd[p + 1] = g; dd[p + 2] = bb; dd[p + 3] = 255; } else { dd[p + 3] = 0; }
          }
        }
      }
    }
    var w = b - a + 1;
    this.oben.ctx.putImageData(this.oben.img, 0, 0, a, 0, w, NY);
    for (e = 0; e < ne; e++) { eb[e].ctx.putImageData(eb[e].img, 0, 0, a, 0, w, NY); }
  };

  FraesSzene.prototype.vollNeu = function () {
    var v;
    if (!this.oben) { this.oben = texturNeu(this.NX, this.NY); }
    for (v = 0; v < 6; v++) {
      this.ebenen = [];
      this.ebIdx = {};
      this.ebReihe = [];
      this.neuBauen = false;
      this.spaltenNeu(0, this.NX - 1);
      if (!this.neuBauen) { break; }
    }
    this.waendeNeu(0, this.NX - 1);
    this.pfadeBauen();
  };

  // Hoehenkarte nachfuehren: neu geschnittene Zellen erkennen und Schnittzustand merken
  FraesSzene.prototype.geometrie = function () {
    var sim = this.sim;
    if (sim.geoVersion === this.geoV) { return; }
    var NX = this.NX, NY = this.NY, T = sim.tiefe, tK = this.tK;
    var voll = this.geoV < 0;
    this.geoV = sim.geoVersion;
    var a = 0, b = NX - 1;
    if (!voll) {
      var xa = Math.min(this.xGeo, sim.x) - sim.R - 2, xb = Math.max(this.xGeo, sim.x) + sim.R + 2;
      a = Math.max(0, Math.floor(xa / FX)); b = Math.min(NX - 1, Math.ceil(xb / FX));
    }
    this.xGeo = sim.x;
    var yp = sim.y + (sim.deltaY || 0), am = clamp(Math.round(sim.amp || 0), 0, 255);
    var dir = this.dirAkt, mk = this.markeZeit > 0 ? 255 : 0;
    var sm = sim.mat.kleben > 0.5 && sim.w ? clamp(Math.round((sim.w.aufschweiss - 0.5) * 200), 0, 255) : 0;
    var dmin = NX, dmax = -1, ix, iy, c, durchlauf;
    for (durchlauf = 0; durchlauf < 2; durchlauf++) {
      for (ix = a; ix <= b; ix++) {
        for (iy = 0; iy < NY; iy++) {
          c = ix * NY + iy;
          if (T[c] !== tK[c]) {
            if (T[c] > tK[c]) {
              this.passY[c] = yp; this.ratter[c] = am; this.richt[c] = dir;
              this.marke[c] = mk; this.schmier[c] = sm; this.brand[c] = 0;
            }
            tK[c] = T[c];
            if (ix < dmin) { dmin = ix; }
            if (ix > dmax) { dmax = ix; }
          }
        }
      }
      // Aenderung ausserhalb des Fraeserwegs: einmal alles pruefen
      if (dmax >= 0 || (a === 0 && b === NX - 1)) { break; }
      a = 0; b = NX - 1;
    }
    if (dmax >= 0) { this.spaltenAkt(dmin - 1, dmax + 1); }
  };

  FraesSzene.prototype.spaltenAkt = function (a, b) {
    this.spaltenNeu(a, b);
    if (this.neuBauen) { this.vollNeu(); return; }
    this.waendeNeu(a - 1, b + 1);
    this.pfadeBauen();
  };

  // Waende aus der Hoehenkarte: Stufen nach +y (Rueckwand, zur Kamera) und nach +x
  FraesSzene.prototype.waendeNeu = function (a, b) {
    var sim = this.sim, NX = this.NX, NY = this.NY, tK = this.tK, ix, iy, c, t0, t1;
    a = Math.max(0, a); b = Math.min(NX - 1, b);
    for (ix = a; ix <= b; ix++) {
      var wy = [], wx = [], wr = sim.wandR[ix];
      for (iy = 0; iy < NY - 1; iy++) {
        c = ix * NY + iy;
        t0 = tK[c]; t1 = tK[c + 1];
        if (t0 > t1 + 0.03 && t0 >= EPS) {
          var y = (iy + 1) * FY;
          if (wr > -1e8 && Math.abs(wr - y) < 0.3) { y = wr; }
          wy.push(y, -t1, -t0);
        }
      }
      if (ix < NX - 1) {
        var start = -1, za = 0, zb = 0;
        for (iy = 0; iy <= NY; iy++) {
          var ist = false, ta = 0, tb = 0;
          if (iy < NY) { ta = tK[ix * NY + iy]; tb = tK[(ix + 1) * NY + iy]; ist = tb > ta + 0.03; }
          if (start >= 0 && (!ist || Math.abs(ta - za) > 0.03 || Math.abs(tb - zb) > 0.03)) { wx.push(start * FY, iy * FY, -za, -zb); start = -1; }
          if (ist && start < 0) { start = iy; za = ta; zb = tb; }
        }
      }
      this.wandY[ix] = wy;
      this.wandX[ix] = wx;
    }
  };

  FraesSzene.prototype.ebeneZuTiefe = function (t) {
    var i = this.ebIdx[this.kVon(t)];
    return i === undefined ? null : this.ebenen[i];
  };

  FraesSzene.prototype.quadY = function (P, x0, x1, y, zt, zb) {
    P.moveTo(this.bx(x0, y), this.by(x0, y, zt));
    P.lineTo(this.bx(x1, y), this.by(x1, y, zt));
    P.lineTo(this.bx(x1, y), this.by(x1, y, zb));
    P.lineTo(this.bx(x0, y), this.by(x0, y, zb));
    P.closePath();
  };
  FraesSzene.prototype.quadX = function (P, x, y0, y1, zt, zb) {
    P.moveTo(this.bx(x, y0), this.by(x, y0, zt));
    P.lineTo(this.bx(x, y1), this.by(x, y1, zt));
    P.lineTo(this.bx(x, y1), this.by(x, y1, zb));
    P.lineTo(this.bx(x, y0), this.by(x, y0, zb));
    P.closePath();
  };

  // Wandpfade je Ebene (Bildkoordinaten ohne Tischversatz)
  FraesSzene.prototype.pfadeBauen = function () {
    var eb = this.ebenen, i, ix, j, NX = this.NX;
    for (i = 0; i < eb.length; i++) { eb[i].pw = new Path2D(); eb[i].pa = new Path2D(); eb[i].px = new Path2D(); eb[i].pk = new Path2D(); eb[i].hatW = false; }
    for (ix = 0; ix < NX; ix++) {
      var x0 = ix * FX - 0.05, x1 = (ix + 1) * FX + 0.05, wy = this.wandY[ix], wx = this.wandX[ix];
      for (j = 0; j < wy.length; j += 3) {
        var e = this.ebeneZuTiefe(-wy[j + 2]);
        if (!e) { continue; }
        var zt = wy[j + 1], zb = wy[j + 2], y = wy[j];
        this.quadY(e.pw, x0, x1, y, zt, zb);
        var ha = Math.min(1.4, 0.35 * (zt - zb));
        this.quadY(e.pa, x0, x1, y, zb + ha, zb);
        if (zt > -EPS) {
          // obere Kante: frisch geschnittene Kante faengt Licht
          e.pk.moveTo(this.bx(x0, y), this.by(x0, y, zt));
          e.pk.lineTo(this.bx(x1, y), this.by(x1, y, zt));
        }
        e.hatW = true;
      }
      for (j = 0; j < wx.length; j += 4) {
        var e2 = this.ebeneZuTiefe(-wx[j + 3]);
        if (!e2) { continue; }
        this.quadX(e2.px, (ix + 1) * FX, wx[j] - 0.02, wx[j + 1] + 0.02, wx[j + 2], wx[j + 3]);
        e2.hatW = true;
      }
    }
  };

  // =====================================================================
  //                       STATISCHE EBENEN (Tisch, Schraubstock)
  // =====================================================================
  FraesSzene.prototype.flaeche = function (c, P, stil) {
    var i;
    c.beginPath();
    for (i = 0; i < P.length; i += 3) {
      var X = this.bx(P[i], P[i + 1]), Y = this.by(P[i], P[i + 1], P[i + 2]);
      if (i === 0) { c.moveTo(X, Y); } else { c.lineTo(X, Y); }
    }
    c.closePath();
    c.fillStyle = stil;
    c.fill();
  };

  // Quader mit den sichtbaren Flaechen oben, vorn (-y) und rechts (+x)
  FraesSzene.prototype.quader = function (c, x0, x1, y0, y1, z0, z1, farbe, o) {
    o = o || {};
    var kt = o.kt || 1, kv = o.kv || 1, kr = o.kr || 1;
    if (!o.ohneRechts) { this.flaeche(c, [x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1], rgb(farbe, I_RECHTS * kr)); }
    if (!o.ohneVorn) {
      var g = c.createLinearGradient(0, this.by(x0, y0, z1), 0, this.by(x0, y0, z0));
      g.addColorStop(0, rgb(farbe, I_VORN * kv * 1.08));
      g.addColorStop(1, rgb(farbe, I_VORN * kv * 0.78));
      this.flaeche(c, [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], g);
    }
    if (!o.ohneOben) { this.flaeche(c, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], rgb(farbe, I_OBEN * kt)); }
    if (o.kante !== false) {
      c.strokeStyle = 'rgba(255,255,255,' + (o.kante || 0.18) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(this.bx(x0, y0), this.by(x0, y0, z1));
      c.lineTo(this.bx(x1, y0), this.by(x1, y0, z1));
      c.lineTo(this.bx(x1, y1), this.by(x1, y1, z1));
      c.moveTo(this.bx(x1, y0), this.by(x1, y0, z1));
      c.lineTo(this.bx(x1, y0), this.by(x1, y0, z0));
      c.stroke();
    }
  };

  FraesSzene.prototype.statischZeichnen = function () {
    var W = this.W, H = this.H, dpr = this.dpr;
    if (!this.stH) { this.stH = document.createElement('canvas'); this.stV = document.createElement('canvas'); this.cvO = document.createElement('canvas'); }
    var arr = [this.stH, this.stV, this.cvO], i;
    for (i = 0; i < 3; i++) {
      arr[i].width = Math.max(1, Math.round(W * dpr));
      arr[i].height = Math.max(1, Math.round(H * dpr));
    }
    var c = this.stH.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hintergrundMalen(c);
    this.tischMalen(c);
    this.schraubstockHinten(c);
    c = this.stV.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    this.schraubstockVorn(c);
    c = this.cvO.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  FraesSzene.prototype.hintergrundMalen = function (c) {
    var W = this.W, H = this.H, cnc = !!this.sim.m.cnc, sim = this.sim;
    var g = c.createLinearGradient(0, 0, 0, H);
    if (cnc) {
      // Arbeitsraum des BAZ: Rueckwand RAL 7035, kaltes LED-Licht von oben
      g.addColorStop(0, '#9aa09c');
      g.addColorStop(0.45, '#6e7471');
      g.addColorStop(1, '#2c3032');
    } else {
      g.addColorStop(0, '#232a2c');
      g.addColorStop(1, '#101314');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    var yb = sim.B + 175;
    if (cnc) {
      // Blechfugen der Rueckwand
      c.strokeStyle = 'rgba(40,44,46,0.35)';
      c.lineWidth = 1;
      var x;
      for (x = -400; x < 600; x += 160) {
        c.beginPath();
        c.moveTo(this.bx(x, yb + 260), this.by(x, yb + 260, 400));
        c.lineTo(this.bx(x, yb + 260), this.by(x, yb + 260, this.zT - 200));
        c.stroke();
      }
      var lg = c.createRadialGradient(W * 0.55, -H * 0.1, 10, W * 0.55, -H * 0.1, H * 0.9);
      lg.addColorStop(0, 'rgba(235,244,255,0.35)');
      lg.addColorStop(1, 'rgba(235,244,255,0)');
      c.fillStyle = lg;
      c.fillRect(0, 0, W, H);
    } else {
      // Staender der Konsolfraesmaschine hinter dem Tisch (Resedagruen) mit Fuehrungsbahnen
      var gr = hexRgb('#5f7560'), yS = yb + 70, xa = -700, xb = sim.L + 700;
      var gg = c.createLinearGradient(0, this.by(0, yS, 300), 0, this.by(0, yS, this.zT - 100));
      gg.addColorStop(0, rgb(gr, I_VORN * 1.1));
      gg.addColorStop(1, rgb(gr, I_VORN * 0.55));
      this.flaeche(c, [xa, yS, this.zT - 300, xb, yS, this.zT - 300, xb, yS, 600, xa, yS, 600], gg);
      var fx;
      for (fx = -1; fx <= 1; fx += 2) {
        var xf = this.xm + fx * 150;
        var gf = c.createLinearGradient(this.bx(xf - 28, yS), 0, this.bx(xf + 28, yS), 0);
        gf.addColorStop(0, 'rgba(70,76,78,0.9)');
        gf.addColorStop(0.4, 'rgba(150,158,160,0.9)');
        gf.addColorStop(1, 'rgba(60,66,68,0.9)');
        this.flaeche(c, [xf - 28, yS - 1, this.zT - 300, xf + 28, yS - 1, this.zT - 300, xf + 28, yS - 1, 600, xf - 28, yS - 1, 600], gf);
      }
      var vg = c.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.3, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = vg;
      c.fillRect(0, 0, W, H);
    }
  };

  FraesSzene.prototype.tischMalen = function (c) {
    var sim = this.sim, zt = this.zT, xa = -900, xb = sim.L + 900, ya = -165, yb = sim.B + 175;
    var tisch = hexRgb('#8d9399');
    // Schatten des Tisches auf dem Staender
    this.quader(c, xa, xb, ya, yb, zt - 75, zt, tisch, { kv: 0.85, kante: 0.25 });
    // Schabebild der Tischoberseite
    var i, r = 0.37;
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (i = 0; i < 520; i++) {
      r = (r * 9301 + 49297) % 233280 / 233280;
      var x = xa + 300 + r * (xb - xa - 600);
      r = (r * 9301 + 49297) % 233280 / 233280;
      var y = ya + r * (yb - ya);
      var Xp = this.bx(x, y), Yp = this.by(x, y, zt);
      c.fillRect(Xp, Yp, 3 + r * 4, 1.2);
    }
    // T-Nuten laengs
    var ys, w = 14;
    for (ys = ya + 38; ys < yb - w - 10; ys += 63) {
      var x0 = xa, x1 = xb;
      var g = c.createLinearGradient(0, this.by(0, ys + w, zt), 0, this.by(0, ys, zt));
      g.addColorStop(0, rgb(tisch, I_VORN * 0.5));
      g.addColorStop(1, '#141618');
      this.flaeche(c, [x0, ys, zt, x1, ys, zt, x1, ys + w, zt, x0, ys + w, zt], g);
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.beginPath();
      c.moveTo(this.bx(x0, ys), this.by(x0, ys, zt));
      c.lineTo(this.bx(x1, ys), this.by(x1, ys, zt));
      c.stroke();
    }
    // KSS-Rinne an der Vorderkante
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = Math.max(1, this.s * 2);
    c.beginPath();
    c.moveTo(this.bx(xa, ya), this.by(xa, ya, zt - 25));
    c.lineTo(this.bx(xb, ya), this.by(xb, ya, zt - 25));
    c.stroke();
  };

  FraesSzene.prototype.schraubstockHinten = function (c) {
    var sim = this.sim, xm = this.xm, B = sim.B, zJ = this.zJ, zB = this.zB, zT = this.zT;
    var blau = hexRgb('#3e5c74'), backe = hexRgb('#c3c9ce'), stahl = hexRgb('#a9b0b6');
    // weicher Schatten des Schraubstocks auf dem Tisch
    var sx = -LX / LZ * 40, sy = -LY / LZ * 40;
    this.flaeche(c, [xm - 84 + sx, -152 + sy, zT, xm + 84 + sx, -152 + sy, zT, xm + 84 + sx, B + 82 + sy, zT, xm - 84 + sx, B + 82 + sy, zT], 'rgba(0,0,0,0.25)');
    this.quader(c, xm - 82, xm + 82, -150, B + 80, zT, zT + 22, blau, { kante: 0.15 });
    this.quader(c, xm - 70, xm + 70, -132, B + 68, zT + 22, zB, blau, { kante: 0.15 });
    // geschliffene Fuehrungsbahnen und Spindelschlitz im Bett
    this.flaeche(c, [xm - 70, -14, zB, xm + 70, -14, zB, xm + 70, B + 14, zB, xm - 70, B + 14, zB], rgb(stahl, I_OBEN * 0.95));
    this.flaeche(c, [xm - 16, -14, zB, xm + 16, -14, zB, xm + 16, B + 14, zB, xm - 16, B + 14, zB], 'rgba(15,18,20,0.85)');
    // feste Backe: Grundkoerper und gehaertete Backenplatte mit Senkschrauben
    this.quader(c, xm - 70, xm + 70, B + 12, B + 55, zB, zJ, blau, { kante: 0.2 });
    this.quader(c, xm - 62.5, xm + 62.5, B, B + 12, zB + 2, zJ, backe, { kante: 0.3, kv: 0.95 });
    var sx2;
    for (sx2 = -1; sx2 <= 1; sx2 += 2) {
      var xs = xm + sx2 * 40, zs = (zJ + zB) / 2 + 6;
      c.fillStyle = 'rgba(25,28,30,0.85)';
      c.beginPath();
      c.ellipse(this.bx(xs, B), this.by(xs, B, zs), 4.5 * this.s * Math.sqrt(EXX * EXX + EXY * EXY), 4.5 * this.s * CP, 0, 0, PI2);
      c.fill();
    }
    // Parallelunterlagen (hinten zuerst)
    if (-sim.H > zB + 0.5) {
      this.quader(c, xm - 75, xm + 75, B - 9, B - 3, zB, -sim.H, stahl, { kante: 0.35, kt: 1.08 });
      this.quader(c, xm - 75, xm + 75, 3, 9, zB, -sim.H, stahl, { kante: 0.35, kt: 1.08 });
    }
  };

  FraesSzene.prototype.schraubstockVorn = function (c) {
    var xm = this.xm, zJ = this.zJ, zB = this.zB, zT = this.zT;
    var blau = hexRgb('#3e5c74'), backe = hexRgb('#c3c9ce');
    this.quader(c, xm - 62.5, xm + 62.5, -12, 0, zB + 2, zJ, backe, { kante: 0.3, ohneVorn: true });
    this.quader(c, xm - 70, xm + 70, -58, -12, zB, zJ, blau, { kante: 0.22 });
    // Druckstueck und Spindel vorn mit Sechskant (Kurbel abgezogen)
    this.quader(c, xm - 30, xm + 30, -132 - 10, -132, zT + 30, zB - 6, blau, { kante: 0.15 });
    var Xh = this.bx(xm, -150), Yh = this.by(xm, -150, zT + 52), rh = 11 * this.s;
    c.fillStyle = verlauf(c, zylStops(hexRgb('#9aa1a7'), 0.6, 0.6), Xh - rh, Xh + rh);
    c.beginPath();
    var i;
    for (i = 0; i < 6; i++) {
      var a = i * PI / 3 + 0.3;
      var X = Xh + Math.cos(a) * rh, Y = Yh + Math.sin(a) * rh * 0.92;
      if (i === 0) { c.moveTo(X, Y); } else { c.lineTo(X, Y); }
    }
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.stroke();
  };

  // =====================================================================
  //                               ZEICHNEN
  // =====================================================================
  FraesSzene.prototype.zeichne = function (cv, dt, a) {
    var t0 = jetzt();
    a = a || {};
    var r = groesse(cv), ctx = r.ctx, W = r.w, H = r.h;
    if (W < 20 || H < 20) { return; }
    var sim = this.sim;
    dt = Math.max(0, dt || 0);
    // Darstellung in Simulationszeit (Zeitraffer, Pause); steht die Physik, in Echtzeit
    var dts = sim.zeit - this.zeitAlt;
    this.zeitAlt = sim.zeit;
    if (!(dts > 0)) { dts = dt > 0 && this.sim.unfall ? dt : 0; }
    dts = Math.min(dts, 0.1);
    this.uhr += dt;
    if (this.W !== W || this.H !== H || this.dpr !== r.dpr) { this.layout(W, H, r.dpr); }
    this.werkzeugPruefen();
    this.zustand(dts, dt, a);
    this.geometrie();
    var G = this.werkzeugGeo();
    this.emittieren(dts, G, a);
    this.bewegen(dts);
    var sh = this.schuetteln(dt);

    ctx.save();
    ctx.translate(sh[0], sh[1]);
    var ox = this.ox, oy = this.oy;
    // 1. Tisch, Schraubstock hinten, eingebackene Spaene
    ctx.drawImage(this.stH, ox, oy, W, H);
    if (this.geist > 0.02) { this.geisterTisch(ctx, this.stH, W, H); }
    // 2. Werkstueck: Boeden und Waende von unten nach oben, dann Oberseite und Seiten
    var wox = ox + this.s * this.vs * EXX, woy = oy + this.s * this.vs * EXY;
    this.werkstueckUnten(ctx, wox, woy, G);
    this.fraeserZeichnen(ctx, G, -1e9, 0);
    this.stueckStehend(ctx, -1e9, 0);
    this.werkstueckOben(ctx, wox, woy, G);
    this.fraeserVorne(ctx, G);
    // 3. bewegliche Backe, liegende Spaene oben
    ctx.drawImage(this.stV, ox, oy, W, H);
    if (this.obenDirty) { this.obenBacken(); }
    ctx.drawImage(this.cvO, ox, oy, W, H);
    this.stueckeLiegend(ctx, ox, oy);
    // 4. Fraeser oberhalb der Oberflaeche, Aufnahme, Spindel, KSS
    this.schattenWerkzeug(ctx, wox, woy, G);
    this.fraeserZeichnen(ctx, G, 0, 1e9);
    this.stueckStehend(ctx, 0, 1e9);
    this.aufnahmeZeichnen(ctx, G);
    this.kssZeichnen(ctx, G, a);
    // 5. Effekte
    this.teileZeichnen(ctx);
    this.funkenZeichnen(ctx, G);
    this.dunstZeichnen(ctx);
    ctx.restore();
    this.hud(ctx, W, H, G);
    if (this.blitz > 0) {
      ctx.fillStyle = rgba(this.blitzFarbe, this.blitz * 0.35);
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 1.6);
    }
    this.dauer = jetzt() - t0;
  };

  // ------------------------------------------------------- Zustand je Bild
  FraesSzene.prototype.werkzeugPruefen = function () {
    var sim = this.sim;
    if (sim.w !== this.wRef || sim.def !== this.dDef) {
      this.wRef = sim.w;
      this.bruch = null;
      this.werkzeugFarben();
    }
    if (sim.w && sim.w.gebrochen && !this.bruch) { this.bruchSetzen(false); }
  };

  FraesSzene.prototype.zustand = function (dts, dt, a) {
    var sim = this.sim, m = sim.m, cnc = !!m.cnc;
    // Richtung der Tischbewegung (Werkzeug relativ zum Werkstueck)
    var dx = sim.x - this.xAlt;
    if (Math.abs(dx) > 1e-4) { this.dirAkt = dx > 0 ? 1 : -1; }
    this.vs = sim.verschub || 0;
    // Drehwinkel M03 (von oben im Uhrzeigersinn); Riemenschlupf laesst die Drehzahl schwanken
    var om = PI2 * Math.max(0, sim.nEff) / 60;
    if (sim.riemenGleitet) { om *= 1 + 0.16 * Math.sin(PI2 * 5 * sim.zeit); }
    this.winkel = (this.winkel - om * dts) % PI2;
    this.dphi = om * TB;
    // Tisch im Umkehrspiel: Sprung als abklingender Ruck, Haemmern als Unschaerfe
    var sU = m.umkehrspiel || 0;
    var e = cnc ? 0 : (sim.tischE || 0);
    this.eTief += (e - this.eTief) * Math.min(1, dts / 0.12);
    var kick = V * (e - this.eTief);
    var hammer = cnc ? 0 : clamp(sim.hammer || 0, 0, 1);
    var fZE = sim.fZE || sim.nEff * sim.def.z / 60;
    var AT = hammer * Math.max(sU, 0.05) / 2;
    this.geist = 0;
    if (AT > 0) {
      if (fZE < 20) { this.phZE += PI2 * fZE * dts; kick += V * AT * Math.sin(this.phZE); }
      else { this.geist = V * AT; }
    }
    var ruck = cnc ? 0 : clamp(sim.ruck || 0, 0, 1), rf = sim.ruckFreq || 0;
    if (ruck > 0 && rf > 0) {
      if (rf <= 20) {
        this.phRuck += rf * dts;
        var fr = this.phRuck % 1;
        kick += V * ruck * Math.max(sU, 0.05) * 0.5 * (fr < 0.8 ? fr / 0.8 : (1 - fr) / 0.2);
      } else { this.geist = Math.max(this.geist, V * ruck * Math.max(sU, 0.05) * 0.3); }
    }
    this.kick = kick;
    this.hammer = hammer;
    this.ox = -this.dirAkt * kick * this.s * EXX;
    this.oy = -this.dirAkt * kick * this.s * EXY;
    // Tischanschlaege (Klack) aus der Physik
    var kl = sim.tischKlack || 0;
    if (kl > this.klackAlt) {
      this.stoss(2.5, 0.05, 21);
      this.markeZeit = 0.05;
    }
    this.klackAlt = kl;
    this.markeZeit = Math.max(0, this.markeZeit - dts);
    // Naesse durch Kuehlschmierstoff
    var flut = a.kss && sim.p.kss !== 'trocken';
    if (flut) { this.nass = Math.min(1, this.nass + dts * 1.2); } else { this.nass = Math.max(0, this.nass - dts * 0.04); }
    var stufe = this.nass > 0.66 ? 2 : this.nass > 0.2 ? 1 : 0;
    if (stufe !== this.nassStufe && this.oben) { this.nassStufe = stufe; this.vollNeu(); }
    // Reiben im Stillstand (Kupplung rutscht, Stumpf reibt): Anlauffarbe am Boden
    var reibt = sim.nEff > 20 && (sim.apE > 0.01 || sim.stumpfReibt) && Math.abs(dx) < 0.004;
    this.verweil = reibt ? this.verweil + dts : 0;
    this.brandZeit -= dts;
    if (this.verweil > 0.3 && this.brandZeit <= 0) { this.brandMalen(); this.brandZeit = 0.25; }
    this.xAlt = sim.x;
    if (sim.alarm) { this.alarmZeit += dt; } else { this.alarmZeit = 0; }
  };

  FraesSzene.prototype.brandMalen = function () {
    var sim = this.sim, NY = this.NY, R = sim.R + 0.3, xc = sim.x, yc = sim.y;
    var T = Math.max(sim.Tspan || 0, sim.w ? sim.w.T : 0);
    if (T < 220) { return; }
    var a = Math.max(0, Math.floor((xc - R) / FX)), b = Math.min(this.NX - 1, Math.floor((xc + R) / FX));
    var ix, iy, neu = false;
    for (ix = a; ix <= b; ix++) {
      var px = (ix + 0.5) * FX, hw = Math.sqrt(Math.max(0, R * R - sq(px - xc)));
      var y0 = Math.max(0, Math.floor((yc - hw) / FY)), y1 = Math.min(NY - 1, Math.floor((yc + hw) / FY));
      for (iy = y0; iy <= y1; iy++) {
        var c = ix * NY + iy;
        if (this.tK[c] >= EPS && this.brand[c] < T - 10) { this.brand[c] = Math.min(65000, T); neu = true; }
      }
    }
    if (neu) { this.spaltenNeu(a, b); }
  };

  FraesSzene.prototype.werkzeugGeo = function () {
    var sim = this.sim, def = sim.def, G = this.G;
    G.r = def.d / 2; G.lc = def.lc; G.z = def.z; G.drall = def.drall || 30; G.kern = def.kern || 0.75;
    G.xc = sim.x + this.vs; G.yc = sim.y;
    G.zTip = -(sim.zT + (sim.auszug || 0));
    G.zN = -sim.zT + sim.auskrag;
    G.Lfrei = Math.max(1, G.zN - G.zTip);
    G.Xa = this.bx(G.xc, G.yc);
    G.Ya = this.by(G.xc, G.yc, 0);
    // Abdraengung zwanzigfach: entgegen dem Vorschub und quer (sim.deltaY)
    var d = sim.delta || 0, dy = sim.deltaY || 0;
    var dxm = -this.dirAkt * Math.sqrt(Math.max(0, d * d - dy * dy));
    var bxm = V * dxm, bym = V * dy, bm = Math.sqrt(bxm * bxm + bym * bym);
    if (bm > 2.5) { bxm *= 2.5 / bm; bym *= 2.5 / bm; bm = 2.5; }
    G.bX = this.s * (bxm * EXX + bym * EYX);
    G.bY = this.s * (bxm * EXY + bym * EYY);
    G.bend = bm * this.s > 0.6;
    G.bendMm = bm;
    G.gebrochen = !!(sim.w && sim.w.gebrochen);
    G.hB = G.gebrochen && this.bruch ? this.bruch.zB : 0;
    return G;
  };

  // Biegelinie des Kragarms: Anteil der Spitzenauslenkung in Hoehe h ueber der Spitze
  function biege(G, h) {
    if (!G.bend || h >= G.Lfrei) { return 0; }
    var xi = 1 - h / G.Lfrei;
    return xi * xi * (3 - xi) / 2;
  }

  // ------------------------------------------------------- Werkstueck
  FraesSzene.prototype.texTransform = function (ctx, ox, oy, kpx) {
    var s = this.s, B = this.sim.B;
    ctx.transform(s * FX * EXX, s * FX * EXY, -s * FY * EYX, -s * FY * EYY, this.bx(0, B) + ox, this.by(0, B, 0) + oy + kpx);
  };

  FraesSzene.prototype.werkstueckUnten = function (ctx, ox, oy, G) {
    var eb = this.ebReihe, i, mo = this.mo;
    var wandF = rgb(mo.blank, I_VORN * 1.08), wandX = rgb(mo.blank, I_RECHTS * 1.05);
    ctx.imageSmoothingEnabled = true;
    for (i = 0; i < eb.length; i++) {
      var e = eb[i];
      ctx.save();
      this.texTransform(ctx, ox, oy, e.k);
      ctx.drawImage(e.cv, 0, 0);
      ctx.restore();
      if (e.hatW) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.fillStyle = wandF;
        ctx.fill(e.pw);
        ctx.fillStyle = wandX;
        ctx.fill(e.px);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fill(e.pa);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke(e.pk);
        ctx.restore();
      }
    }
    // Kontaktschatten unter dem Fraeser und Spaene in der Nut
    if (G.zTip < -0.05 && G.xc + G.r > 0 && G.xc - G.r < this.sim.L) {
      var X = this.bx(G.xc - 0.8, G.yc + 1.2) + this.G.bX, Y = this.by(G.xc - 0.8, G.yc + 1.2, G.zTip) + this.G.bY;
      var rr = (G.r + 2.5) * this.s;
      var g = ctx.createRadialGradient(X, Y, rr * 0.3, X, Y, rr);
      g.addColorStop(0, 'rgba(0,0,0,0.38)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(X, Y, rr, rr * SP, 0, 0, PI2);
      ctx.fill();
    }
    this.nutSpaeneZeichnen(ctx, ox, oy);
  };

  FraesSzene.prototype.werkstueckOben = function (ctx, ox, oy, G) {
    var sim = this.sim, L = sim.L, B = sim.B, H = sim.H, NX = this.NX, NY = this.NY, tK = this.tK;
    var s = this.s, self = this;
    // Oberseite
    ctx.save();
    this.texTransform(ctx, ox, oy, 0);
    ctx.drawImage(this.oben.cv, 0, 0);
    ctx.restore();
    function P(x, y, z, erst) {
      var X = self.bx(x, y) + ox, Y = self.by(x, y, z) + oy;
      if (erst) { ctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); }
    }
    // Stirnseite x = L mit Nutprofil
    var base = (NX - 1) * NY, iy, t, tPrev, wl = sim.wandL[NX - 1], wr = sim.wandR[NX - 1];
    ctx.beginPath();
    P(L, 0, -H, true);
    P(L, B, -H);
    tPrev = tK[base + NY - 1];
    P(L, B, -tPrev);
    var kerbe = [];
    for (iy = NY - 2; iy >= 0; iy--) {
      t = tK[base + iy];
      if (Math.abs(t - tPrev) > 0.005) {
        var y = (iy + 1) * FY;
        if (wr > -1e8 && Math.abs(wr - y) < 0.3) { y = wr; } else if (wl < 1e8 && Math.abs(wl - y) < 0.3) { y = wl; }
        P(L, y, -tPrev);
        P(L, y, -t);
        kerbe.push(y, -tPrev, y, -t);
        tPrev = t;
      }
    }
    P(L, 0, -tPrev);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.clip();
    ctx.transform(s * EYX * B / 128, s * EYY * B / 128, 0, s * CP * H / 64, this.bx(L, 0) + ox, this.by(L, 0, 0) + oy);
    ctx.drawImage(this.texStirn, 0, 0);
    ctx.restore();
    // Austrittsgrat an der Nutkerbe (zaehe Werkstoffe)
    if (kerbe.length && sim.mat.duktil > 0.45 && G.xc - G.r > L - 0.5) { this.austrittsGrat(ctx, kerbe, ox, oy); }
    // Vorderseite y = 0
    ctx.beginPath();
    P(0, 0, -H, true);
    P(L, 0, -H);
    var ix;
    tPrev = tK[(NX - 1) * NY];
    P(L, 0, -tPrev);
    for (ix = NX - 2; ix >= 0; ix--) {
      t = tK[ix * NY];
      if (Math.abs(t - tPrev) > 0.005) { P((ix + 1) * FX, 0, -tPrev); P((ix + 1) * FX, 0, -t); tPrev = t; }
    }
    P(0, 0, -tPrev);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.transform(s * EXX * L / 256, s * EXY * L / 256, 0, s * CP * H / 64, this.bx(0, 0) + ox, this.by(0, 0, 0) + oy);
    ctx.drawImage(this.texVorn, 0, 0);
    ctx.restore();
    // Kanten: blank gebrochen, fangen Licht
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    P(0, 0, -tK[0], true);
    P(L, 0, -tK[(NX - 1) * NY]);
    P(L, B, -tK[base + NY - 1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    P(L, 0, -tK[(NX - 1) * NY], true);
    P(L, 0, -H);
    ctx.stroke();
    // Hammern: Werkstueckumriss doppelt (Bewegungsunschaerfe statt Zittern)
    if (this.geist > 0.02) {
      var gpx = this.geist * s * EXX, gpy = this.geist * s * EXY, k;
      ctx.strokeStyle = 'rgba(210,220,225,0.32)';
      ctx.lineWidth = 1.5;
      for (k = -1; k <= 1; k += 2) {
        ctx.beginPath();
        var qx = ox + k * gpx, qy = oy + k * gpy;
        ctx.moveTo(this.bx(0, B) + qx, this.by(0, B, 0) + qy);
        ctx.lineTo(this.bx(L, B) + qx, this.by(L, B, 0) + qy);
        ctx.lineTo(this.bx(L, 0) + qx, this.by(L, 0, 0) + qy);
        ctx.lineTo(this.bx(0, 0) + qx, this.by(0, 0, 0) + qy);
        ctx.closePath();
        ctx.moveTo(this.bx(L, 0) + qx, this.by(L, 0, 0) + qy);
        ctx.lineTo(this.bx(L, 0) + qx, this.by(L, 0, -H) + qy);
        ctx.stroke();
      }
    }
  };

  FraesSzene.prototype.austrittsGrat = function (ctx, kerbe, ox, oy) {
    var sim = this.sim, L = sim.L, i, j, s = this.s;
    var hoehe = (0.15 + 0.5 * clamp(sim.mat.duktil - 0.4, 0, 1)) * (1 + 1.5 * (sim.w ? sim.w.VB : 0));
    ctx.fillStyle = rgb(this.mo.blank, 1.1);
    ctx.beginPath();
    // Grat entlang Waenden und Boden der Kerbe: kleine Zacken nach +x
    var pts = [];
    for (i = 0; i < kerbe.length; i += 2) { pts.push(kerbe[i], kerbe[i + 1]); }
    for (i = 0; i + 3 < pts.length; i += 2) {
      var y0 = pts[i], z0 = pts[i + 1], y1 = pts[i + 2], z1 = pts[i + 3];
      var len = Math.sqrt(sq(y1 - y0) + sq(z1 - z0)), n = Math.max(1, Math.ceil(len / 0.6));
      for (j = 0; j < n; j++) {
        var u = (j + 0.5) / n, y = y0 + (y1 - y0) * u, z = z0 + (z1 - z0) * u;
        var hz = hoehe * (0.4 + 0.9 * hash2(Math.round(y * 7), Math.round(z * 7)));
        var X = this.bx(L, y) + ox, Y = this.by(L, y, z) + oy;
        var tx = (y1 - y0) / len * 0.3, tz = (z1 - z0) / len * 0.3;
        ctx.moveTo(this.bx(L, y - tx) + ox, this.by(L, y - tx, z - tz) + oy);
        ctx.lineTo(X + hz * s * EXX, Y + hz * s * EXY);
        ctx.lineTo(this.bx(L, y + tx) + ox, this.by(L, y + tx, z + tz) + oy);
      }
    }
    ctx.fill();
  };

  // Fraeser vor der Stirn- bzw. Vorderseite (x > L oder y < 0) noch einmal darueber
  FraesSzene.prototype.fraeserVorne = function (ctx, G) {
    var sim = this.sim, L = sim.L;
    if (G.zTip >= 0) { return; }
    var xR = G.xc + G.r + Math.abs(G.bendMm), yU = G.yc - G.r - Math.abs(G.bendMm);
    if (xR <= L && yU >= 0) { return; }
    var i, n = 32, xmin = 1e9, xmax = -1e9;
    for (i = 0; i <= n; i++) {
      var a = -PI + PI * i / n, phi = a + PSI;
      var x = G.xc + G.r * Math.cos(phi), y = G.yc + G.r * Math.sin(phi);
      if (x > L + this.vs || y < 0) {
        var X = G.Xa + G.r * this.s * Math.cos(a);
        xmin = Math.min(xmin, X); xmax = Math.max(xmax, X);
      }
    }
    if (xmax < xmin) { return; }
    var rp = G.r * this.s;
    if (xmax > G.Xa + rp - 1) { xmax = G.Xa + rp + Math.abs(G.bX) + 4; }
    if (xmin < G.Xa - rp + 1) { xmin = G.Xa - rp - Math.abs(G.bX) - 4; }
    ctx.save();
    ctx.beginPath();
    ctx.rect(xmin, 0, xmax - xmin, this.H);
    ctx.clip();
    this.fraeserZeichnen(ctx, G, -1e9, 0);
    this.stueckStehend(ctx, -1e9, 0);
    ctx.restore();
  };

  // Schatten von Fraeser und Aufnahme auf der Oberseite (Licht von rechts vorn oben)
  FraesSzene.prototype.schattenWerkzeug = function (ctx, ox, oy, G) {
    var sim = this.sim, L = sim.L, B = sim.B;
    if (G.xc < -G.r - 60 || G.xc > L + 60) { return; }
    var self = this, sx = -LX / LZ, sy = -LY / LZ;
    var teile = this.teileListe(G), i, zu = Math.max(0, G.zTip), z = G.zN;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.bx(0, 0) + ox, this.by(0, 0, 0) + oy);
    ctx.lineTo(this.bx(L, 0) + ox, this.by(L, 0, 0) + oy);
    ctx.lineTo(this.bx(L, B) + ox, this.by(L, B, 0) + oy);
    ctx.lineTo(this.bx(0, B) + ox, this.by(0, B, 0) + oy);
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    function kapsel(r, h0, h1) {
      var x0 = G.xc + sx * h0, y0 = G.yc + sy * h0, x1 = G.xc + sx * h1, y1 = G.yc + sy * h1;
      var ux = x1 - x0, uy = y1 - y0, ul = Math.sqrt(ux * ux + uy * uy) || 1, j;
      ux /= ul; uy /= ul;
      var nx = -uy, ny = ux;
      for (j = 0; j <= 6; j++) {
        var a = PI * j / 6, cx = Math.cos(a), sn = Math.sin(a);
        var px = x1 + r * (nx * cx + ux * sn), py = y1 + r * (ny * cx + uy * sn);
        if (j === 0) { ctx.moveTo(self.bx(px, py) + ox, self.by(px, py, 0) + oy); } else { ctx.lineTo(self.bx(px, py) + ox, self.by(px, py, 0) + oy); }
      }
      for (j = 0; j <= 6; j++) {
        var a2 = PI + PI * j / 6, cx2 = Math.cos(a2), sn2 = Math.sin(a2);
        var qx = x0 + r * (nx * cx2 + ux * sn2), qy = y0 + r * (ny * cx2 + uy * sn2);
        ctx.lineTo(self.bx(qx, qy) + ox, self.by(qx, qy, 0) + oy);
      }
      ctx.closePath();
    }
    if (G.zN > zu) { kapsel(G.r, zu, G.zN); }
    for (i = 0; i < teile.length && i < 6; i++) {
      kapsel(Math.max(teile[i].r0, teile[i].r1), z, z + teile[i].dz);
      z += teile[i].dz;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();
    ctx.restore();
  };

  // ------------------------------------------------------- Fraeser
  FraesSzene.prototype.fraeserZeichnen = function (ctx, G, zLo, zHi) {
    var h0 = G.gebrochen ? G.hB : 0;
    var a = Math.max(h0, zLo - G.zTip), b = Math.min(G.Lfrei, zHi - G.zTip);
    if (b <= a) { return; }
    var rp = G.r * this.s;
    var unten = a === h0 ? (G.gebrochen ? 'bruch' : 'rund') : 'rund';
    var hF = Math.min(b, G.lc);
    if (hF > a) { this.schneidteil(ctx, G, a, hF, unten); }
    if (b > G.lc) { this.segment(ctx, G, Math.max(a, G.lc), b, rp, this.stopsSchaft, 1, Math.max(a, G.lc) === h0 && G.gebrochen ? 'bruch' : 'rund'); }
  };

  // Zylinderabschnitt mit Biegelinie zwischen den Hoehen hA..hB ueber der Spitze
  FraesSzene.prototype.segment = function (ctx, G, hA, hB, rp, stops, alpha, unten, oben) {
    var s = this.s, n = G.bend ? 5 : 1, i, h, f, X, Y;
    ctx.beginPath();
    for (i = n; i >= 0; i--) {
      h = hA + (hB - hA) * i / n;
      f = biege(G, h);
      X = G.Xa + G.bX * f - rp;
      Y = G.Ya - (G.zTip + h) * CP * s + G.bY * f;
      if (i === n) { ctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); }
    }
    f = biege(G, hA);
    var Xu = G.Xa + G.bX * f, Yu = G.Ya - (G.zTip + hA) * CP * s + G.bY * f;
    if (unten === 'bruch') { this.bruchKante(ctx, Xu, Yu, rp, 1); } else { ctx.ellipse(Xu, Yu, Math.max(0.01, rp), Math.max(0.01, rp * SP), 0, PI, 0, true); }
    for (i = 0; i <= n; i++) {
      h = hA + (hB - hA) * i / n;
      f = biege(G, h);
      ctx.lineTo(G.Xa + G.bX * f + rp, G.Ya - (G.zTip + h) * CP * s + G.bY * f);
    }
    f = biege(G, hB);
    var Xo = G.Xa + G.bX * f, Yo = G.Ya - (G.zTip + hB) * CP * s + G.bY * f;
    if (oben === 'bruch') { this.bruchKante(ctx, Xo, Yo, rp, -1); } else { ctx.ellipse(Xo, Yo, Math.max(0.01, rp), Math.max(0.01, rp * SP), 0, 0, PI, true); }
    ctx.closePath();
    var Xm = G.Xa + G.bX * biege(G, (hA + hB) / 2);
    ctx.fillStyle = verlauf(ctx, stops, Xm - rp, Xm + rp);
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  // gezackte Bruchkante; seite 1: unten von links nach rechts, -1: oben von rechts nach links
  FraesSzene.prototype.bruchKante = function (ctx, X, Y, rp, seite) {
    var i, n = 8;
    for (i = 1; i < n; i++) {
      var u = i / n, xs = seite > 0 ? -1 + 2 * u : 1 - 2 * u;
      var yEll = rp * SP * Math.sqrt(Math.max(0, 1 - xs * xs)) * (seite > 0 ? 0.7 : -0.7);
      ctx.lineTo(X + xs * rp, Y + yEll + this.jag[i] * rp * 0.45);
    }
    ctx.lineTo(X + (seite > 0 ? rp : -rp), Y);
  };

  FraesSzene.prototype.schneidteil = function (ctx, G, hA, hB, unten) {
    var sim = this.sim, w = sim.w, z = G.z, rp = G.r * this.s, teil = PI2 / z;
    var beta = clamp((this.dphi - 0.75 * teil) / (0.5 * teil), 0, 1);
    var auf = clamp((w.aufschweiss || 0) / 1.2, 0, 1);
    var cz = z <= 2 ? 0.35 : z === 3 ? 0.45 : 0.5;
    if (G.stehend) { beta = 0; }
    // Rattern und Zahnstoesse: Geisterkopien (Unschaerfe statt Zittern)
    var amp = sim.amp || 0, puls = sim.pulsGrad || 0;
    var Ag = Math.min(2, 0.05 * amp + 0.8 * puls * Math.min(1, (sim.Fc || 0) / 1500));
    if (Ag > 0.4 && !G.stehend && !G.gebrochen) {
      var Xa = G.Xa, k;
      for (k = -1; k <= 1; k += 2) {
        G.Xa = Xa + k * Ag;
        this.segment(ctx, G, hA, hB, rp, this.stopsWkz, 0.3, unten);
      }
      G.Xa = Xa;
    }
    var ring = cz + (1 - cz) * Math.max(1 - beta, auf * 0.85);
    if (beta > 0.5) { ring *= 1 + 0.03 * Math.sin(this.uhr * 37); }
    this.segment(ctx, G, hA, hB, rp, auf > 0.4 && beta > 0.5 ? this.stopsAl : this.stopsWkz, ring, unten);
    if (beta > 0) { this.segment(ctx, G, hA, hB, rp * G.kern, this.stopsWkz, 1, unten); }
    if (beta < 1) { this.spannuten(ctx, G, hA, hB, rp, 1 - beta, auf); }
    // Verschleissmarke: blanker Streif an der Schneidenecke (vierfach ueberhoeht)
    if (w.VB > 0.04 && hA < 0.5 && !G.gebrochen) {
      var hv = Math.min(hB, Math.max(1.2 / this.s, 4 * w.VB));
      this.segment(ctx, G, hA, hv, rp * 1.01, this.stopsVB, clamp(0.35 + w.VB, 0.4, 0.85), unten);
    }
  };

  // Spannuten mit Drall (Rechtsdrall): Nutband dunkel, Schneidkante hell
  FraesSzene.prototype.spannuten = function (ctx, G, hA, hB, rp, alpha, auf) {
    var z = G.z, s = this.s, Lh = PI * 2 * G.r / Math.tan(G.drall * DEG), wB = 0.38 * PI2 / z;
    var m = 1, dphi = G.stehend ? 0 : this.dphi;
    if (dphi >= 0.15) { m = Math.min(8, Math.ceil(dphi / 0.12)); }
    var J = Math.max(3, Math.ceil((hB - hA) / 1.6)), cp, k, j;
    var lo = [], hi = [], kanten = new Path2D(), baender = new Path2D();
    var th0 = G.stehend ? G.winkel0 : this.winkel;
    for (cp = 0; cp < m; cp++) {
      var th = th0 + cp * dphi / m;
      for (k = 0; k < z; k++) {
        lo.length = 0; hi.length = 0;
        var kanteOffen = false;
        for (j = 0; j <= J + 1; j++) {
          var vis = false, h = 0, cx = 0, cy = 0, a1 = 0, a2 = 0, l = 0, u = 0;
          if (j <= J) {
            h = hA + (hB - hA) * j / J;
            var f = biege(G, h);
            cx = G.Xa + G.bX * f;
            cy = G.Ya - (G.zTip + h) * CP * s + G.bY * f;
            a1 = th + k * PI2 / z + PI2 * h / Lh - PSI;
            a1 -= PI2 * Math.ceil(a1 / PI2);
            a2 = a1 + wB;
            l = Math.max(a1, -PI);
            u = Math.min(a2, 0);
            vis = l < u;
          }
          if (vis) {
            lo.push(cx + rp * Math.cos(l), cy - rp * SP * Math.sin(l));
            hi.push(cx + rp * Math.cos(u), cy - rp * SP * Math.sin(u));
            if (a2 < -0.05 && a2 > -PI + 0.05) {
              if (!kanteOffen) { kanten.moveTo(cx + rp * Math.cos(a2), cy - rp * SP * Math.sin(a2)); kanteOffen = true; }
              else { kanten.lineTo(cx + rp * Math.cos(a2), cy - rp * SP * Math.sin(a2)); }
            } else { kanteOffen = false; }
          } else {
            kanteOffen = false;
            if (lo.length >= 4) {
              var q;
              baender.moveTo(lo[0], lo[1]);
              for (q = 2; q < lo.length; q += 2) { baender.lineTo(lo[q], lo[q + 1]); }
              for (q = hi.length - 2; q >= 0; q -= 2) { baender.lineTo(hi[q], hi[q + 1]); }
              baender.closePath();
            }
            lo.length = 0; hi.length = 0;
          }
        }
      }
    }
    var ac = Math.min(1, alpha * (m > 1 ? 1.8 / m : 1));
    ctx.globalAlpha = ac;
    ctx.fillStyle = 'rgba(14,16,20,0.86)';
    ctx.fill(baender);
    if (auf > 0.05) {
      // aufgeschweisstes Aluminium setzt die Spanraeume zu
      ctx.fillStyle = 'rgba(198,204,210,' + (0.9 * auf).toFixed(3) + ')';
      ctx.fill(baender);
    }
    ctx.strokeStyle = 'rgba(240,244,248,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke(kanten);
    ctx.globalAlpha = 1;
  };

  // Aufnahme von unten nach oben: Futter, Bund, Spindelnase, Pinole bzw. Gehaeuse
  FraesSzene.prototype.teileListe = function (G) {
    var sim = this.sim, d = G.r * 2, T = [];
    if (sim.m.cnc) {
      T.push({ dz: 36, r0: d / 2 + 4.5, r1: d / 2 + 7.3, st: 'stahl' });
      T.push({ dz: 22, r0: 21, r1: 22, st: 'stahl' });
      T.push({ dz: 5, r0: 26, r1: 26, st: 'dunkel' });
      T.push({ dz: 14, r0: 31.5, r1: 31.5, st: 'stahl', marken: 2, mb: 0.16 });
      T.push({ dz: 24, r0: 60, r1: 60, st: 'nase', marken: 0 });
    } else if (sim.p.weldon) {
      T.push({ dz: 55, r0: 20, r1: 20, st: 'stahl', schraube: true });
      T.push({ dz: 5, r0: 26, r1: 26, st: 'dunkel' });
      T.push({ dz: 16, r0: 31.75, r1: 31.75, st: 'stahl', marken: 2, mb: 0.16 });
      T.push({ dz: 14, r0: 38, r1: 38, st: 'nase' });
      T.push({ dz: 80, r0: 42.5, r1: 42.5, st: 'pinole' });
    } else {
      T.push({ dz: 22, r0: 25, r1: 25, st: 'mutter', marken: 4, mb: 0.1 });
      T.push({ dz: 26, r0: 20, r1: 22, st: 'stahl' });
      T.push({ dz: 4, r0: 27, r1: 27, st: 'dunkel' });
      T.push({ dz: 16, r0: 31.75, r1: 31.75, st: 'stahl', marken: 2, mb: 0.16 });
      T.push({ dz: 14, r0: 38, r1: 38, st: 'nase' });
      T.push({ dz: 80, r0: 42.5, r1: 42.5, st: 'pinole' });
    }
    return T;
  };

  FraesSzene.prototype.aufnahmeZeichnen = function (ctx, G) {
    var sim = this.sim, s = this.s, T = this.teileListe(G), i, z = G.zN;
    var X = G.Xa, Y0 = G.Ya, W = this.W;
    var stile = { stahl: this.stopsStahl, dunkel: this.stopsDunkel, nase: this.stopsNase, pinole: this.stopsPinole, mutter: this.stopsMutter };
    for (i = 0; i < T.length; i++) {
      var t = T[i], Yu = Y0 - z * CP * s, Yo = Y0 - (z + t.dz) * CP * s;
      if (Yu < -40) { z += t.dz; continue; }
      var rm = Math.max(t.r0, t.r1) * s;
      stumpfPfad(ctx, X, Yu, t.r0 * s, Yo, t.r1 * s);
      ctx.fillStyle = verlauf(ctx, stile[t.st], X - rm, X + rm);
      ctx.fill();
      // Deckflaeche (nur sichtbar, wo das naechste Teil schmaler ist)
      ctx.fillStyle = t.st === 'nase' || t.st === 'dunkel' ? '#4a5055' : '#c9cfd4';
      ctx.beginPath();
      ctx.ellipse(X, Yo, t.r1 * s, t.r1 * s * SP, 0, 0, PI2);
      ctx.fill();
      if (t.marken) { this.marken(ctx, X, Yu, Yo, t.r0 * s, t.marken, t.mb); }
      if (t.schraube) {
        ctx.fillStyle = '#25292d';
        ctx.beginPath();
        ctx.ellipse(X + t.r0 * s * 0.35, (Yu + Yo) / 2 + t.r0 * s * SP * 0.9, 3.5 * s, 3.2 * s, 0, 0, PI2);
        ctx.fill();
      }
      z += t.dz;
    }
    // Spindelkopf: Pinole im Gehaeuse (konventionell) bzw. Spindelgehaeuse BAZ
    var cnc = !!sim.m.cnc;
    var x0 = G.xc - 125, x1 = G.xc + 125, y0 = G.yc - 115, zK = z;
    var farbe = cnc ? hexRgb('#3a4046') : hexRgb('#5f7560');
    var Yk = this.by(x0, y0, zK);
    if (Yk > -10) {
      var P = [x0, y0, zK, x1, y0, zK, x1, y0, zK + 700, x0, y0, zK + 700];
      var g = ctx.createLinearGradient(0, Yk, 0, Yk - 220 * s * CP);
      g.addColorStop(0, rgb(farbe, I_VORN * 0.8));
      g.addColorStop(1, rgb(farbe, I_VORN * 1.15));
      this.flaeche(ctx, P, g);
      this.flaeche(ctx, [x1, y0, zK, x1, G.yc + 160, zK, x1, G.yc + 160, zK + 700, x1, y0, zK + 700], rgb(farbe, I_RECHTS));
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(this.bx(x0, y0), Yk);
      ctx.lineTo(this.bx(x1, y0), this.by(x1, y0, zK));
      ctx.lineTo(this.bx(x1, G.yc + 160), this.by(x1, G.yc + 160, zK));
      ctx.stroke();
      if (cnc) {
        // LED-Leiste am Spindelkopf
        ctx.fillStyle = 'rgba(230,240,255,0.85)';
        ctx.fillRect(this.bx(x0 + 30, y0), Yk - 9 * s * CP, (x1 - x0 - 60) * s * EXX, Math.max(2, 2 * s));
      }
    }
    if (G.Xa > W + 400) { return; }
  };

  // drehende Nuten/Mitnehmer am Umfang mit Bewegungsunschaerfe
  FraesSzene.prototype.marken = function (ctx, X, Yu, Yo, rp, k, breite) {
    var dphi = this.dphi, teil = PI2 / k;
    if (dphi >= teil) {
      // ruhender, dunkler Ring
      var c = k * breite;
      ctx.fillStyle = 'rgba(20,22,25,' + (0.55 * c).toFixed(3) + ')';
      stumpfPfad(ctx, X, Yu, rp, Yo, rp);
      ctx.fill();
      return;
    }
    var m = dphi < 0.15 ? 1 : Math.min(8, Math.ceil(dphi / 0.12)), i, j;
    ctx.fillStyle = 'rgba(20,22,25,' + (0.85 / m).toFixed(3) + ')';
    ctx.beginPath();
    for (j = 0; j < m; j++) {
      for (i = 0; i < k; i++) {
        var a = this.winkel + j * dphi / m + i * teil - PSI;
        a -= PI2 * Math.ceil(a / PI2);
        var a2 = a + breite * PI2;
        var l = Math.max(a, -PI), u = Math.min(a2, 0);
        if (l >= u) { continue; }
        var xl = X + rp * Math.cos(l), xu = X + rp * Math.cos(u);
        var yl = -rp * SP * Math.sin(l), yu = -rp * SP * Math.sin(u);
        ctx.moveTo(xl, Yo + yl);
        ctx.lineTo(xu, Yo + yu);
        ctx.lineTo(xu, Yu + yu);
        ctx.lineTo(xl, Yu + yl);
        ctx.closePath();
      }
    }
    ctx.fill();
  };

  // ------------------------------------------------------- Bruch
  FraesSzene.prototype.bruchSetzen = function (mitEffekt) {
    var sim = this.sim, def = sim.def, w = sim.w;
    var vhm = /^(VHM|HM)/.test(def.stoff);
    var ap = sim.apE || 0, zB, bleibt = false;
    if (sim.bruchZ !== undefined && sim.bruchZ !== null) { zB = sim.bruchZ; bleibt = zB < ap; }
    else if (vhm && ap > 0.3) { zB = clamp(zufall(0.5, 1.2) * ap, 0.6, def.lc * 0.9); bleibt = zB < ap; }
    else { zB = def.lc; }
    var G = this.werkzeugGeo();
    this.bruch = { zB: zB, bleibt: bleibt, x: G.xc - this.vs, y: G.yc, zTip: G.zTip, winkel: this.winkel, t: 0 };
    var i;
    for (i = 0; i < 9; i++) { this.jag[i] = zufall(-1, 1); }
    if (!bleibt) {
      // Bruchstueck fliegt weg bzw. faellt herunter
      var vc = Math.max(0, sim.vc || 0) * 1000 / 60, a = zufall(0, PI2);
      var v = vc * zufall(0.25, 0.5) + 150;
      this.flug.push({ typ: 'stueck', x: G.xc, y: G.yc, z: G.zTip + zB / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, vz: 300 + v * 0.3,
        t: 0, leben: 8, rot: 0, vr: zufall(-25, 25), len: zB, rr: G.r, luft: 0.3, bo: 0 });
    }
    if (!mitEffekt) { return; }
    var mat = sim.mat, vcm = sim.vc || 0;
    this.stoss(4, 0.08, 23);
    this.blitz = 0.55;
    this.blitzFarbe = [217, 45, 32];
    var x = G.xc, y = G.yc, zz = Math.max(G.zTip + zB, -2);
    // Bruchschauer: Funken nur bei Eisenwerkstoffen und Titan mit vc > 60 m/min
    if (mat.funke && mat.funke.f > 0 && vcm > 60) {
      var nF = Math.round(clamp(5 * vcm / 60 * (vhm ? 1.5 : 1) * mat.funke.f, 6, 60));
      for (i = 0; i < nF; i++) { this.funkeNeu(x, y, zz, zufall(0, PI2), zufall(3000, 9000), 0.5 + Math.random() * 0.6); }
    }
    // Splitter in Schneidstofffarbe, Spaene
    var nS = vhm ? 3 + Math.floor(Math.random() * 6) : 2 + Math.floor(Math.random() * 3);
    for (i = 0; i < nS; i++) {
      var a2 = zufall(0, PI2), v2 = zufall(1500, 5000);
      this.flug.push({ typ: 'splitter', x: x, y: y, z: zz, vx: Math.cos(a2) * v2, vy: Math.sin(a2) * v2, vz: zufall(500, 2500),
        t: 0, leben: 4, rot: zufall(0, PI2), vr: zufall(-40, 40), rr: zufall(0.5, 1.4), farbe: rgb(this.wkzRgb, 0.75), luft: 0.6, bo: 0 });
    }
    var aus = this.austritt(G);
    for (i = 0; i < 10; i++) { this.spanNeu(G, aus, true); }
  };

  // stehendes Bruchstueck (VHM bricht im Eingriff: Stumpf steckt in der Nut)
  FraesSzene.prototype.stueckStehend = function (ctx, zLo, zHi) {
    var b = this.bruch;
    if (!b || !b.bleibt) { return; }
    var G0 = this.G, S = this.Gs || (this.Gs = {});
    S.r = G0.r; S.lc = G0.lc; S.z = G0.z; S.drall = G0.drall; S.kern = G0.kern;
    S.xc = b.x + this.vs; S.yc = b.y; S.zTip = b.zTip;
    S.Xa = this.bx(S.xc, S.yc) + this.ox; S.Ya = this.by(S.xc, S.yc, 0) + this.oy;
    S.Lfrei = b.zB; S.bend = false; S.bX = 0; S.bY = 0; S.stehend = true; S.winkel0 = b.winkel; S.gebrochen = true;
    var a = Math.max(0, zLo - S.zTip), e = Math.min(b.zB, zHi - S.zTip);
    if (e <= a) { return; }
    var rp = S.r * this.s;
    this.segment(ctx, S, a, e, rp, this.stopsWkz, 1, 'rund', e >= b.zB - 1e-6 ? 'bruch' : 'rund');
    this.spannuten(ctx, S, a, e, rp, 1, 0);
  };

  FraesSzene.prototype.stueckeLiegend = function (ctx, ox, oy) {
    var i, s = this.s;
    for (i = 0; i < this.stuecke.length; i++) {
      var q = this.stuecke[i];
      var c = Math.cos(q.rot), sn = Math.sin(q.rot), hl = q.len / 2;
      var x0 = q.x - c * hl, y0 = q.y - sn * hl, x1 = q.x + c * hl, y1 = q.y + sn * hl;
      var X0 = this.bx(x0, y0) + (q.kat === K_OBEN || q.kat === K_VORN ? ox : 0), Y0 = this.by(x0, y0, q.z + q.rr) + oy;
      var X1 = this.bx(x1, y1) + (q.kat === K_OBEN || q.kat === K_VORN ? ox : 0), Y1 = this.by(x1, y1, q.z + q.rr) + oy;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgb(this.wkzRgb, 0.8);
      ctx.lineWidth = Math.max(2, q.rr * 2 * s * 0.9);
      ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, q.rr * s * 0.3);
      ctx.beginPath(); ctx.moveTo(X0, Y0 - q.rr * s * 0.4); ctx.lineTo(X1, Y1 - q.rr * s * 0.4); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  };

  // ------------------------------------------------------- Kuehlschmierstoff
  FraesSzene.prototype.kssZeichnen = function (ctx, G, a) {
    var sim = this.sim, kss = sim.p.kss, s = this.s;
    if (kss === 'trocken' || !kss) { return; }
    var cnc = !!sim.m.cnc, an = !!a.kss;
    var emul = kss !== 'oel';
    var strahlF = emul ? 'rgba(232,238,236,0.62)' : 'rgba(205,150,50,0.55)';
    var self = this;
    function X(x, y) { return self.bx(x, y); }
    function Y(x, y, z) { return self.by(x, y, z); }
    var ziel = [G.xc - G.r * 0.55, G.yc - G.r * 0.75, Math.max(G.zTip + 1.5, 1.5)];
    var duesen = [];
    if (kss === 'ikz') {
      return;
    }
    if (cnc) {
      // zwei starre Duesen am Spindelkopf
      var zD = G.zN + 70, k;
      for (k = 0; k < 2; k++) {
        var ang = (-115 - k * 50) * DEG, ra = 52;
        var p0 = [G.xc + ra * Math.cos(ang), G.yc + ra * Math.sin(ang), zD];
        var dxv = ziel[0] - p0[0], dyv = ziel[1] - p0[1], dzv = ziel[2] - p0[2], dl = Math.sqrt(dxv * dxv + dyv * dyv + dzv * dzv);
        var p1 = [p0[0] + dxv / dl * 38, p0[1] + dyv / dl * 38, p0[2] + dzv / dl * 38];
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#7d858c';
        ctx.lineWidth = Math.max(2, 3.5 * s);
        ctx.beginPath(); ctx.moveTo(X(p0[0], p0[1]), Y(p0[0], p0[1], p0[2])); ctx.lineTo(X(p1[0], p1[1]), Y(p1[0], p1[1], p1[2])); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = Math.max(1, 1 * s);
        ctx.stroke();
        duesen.push(p1);
      }
    } else {
      // Gelenkschlauch (Loc-Line) vom Fraeskopf herunter
      var A = [G.xc - 95, G.yc - 85, G.zN + 120], D = [G.xc - G.r - 26, G.yc - G.r - 20, Math.max(G.zTip, 0) + 16];
      var ax = ziel[0] - D[0], ay = ziel[1] - D[1], az = ziel[2] - D[2], al = Math.sqrt(ax * ax + ay * ay + az * az);
      ax /= al; ay /= al; az /= al;
      var C1 = [A[0], A[1] - 25, A[2] - 70], C2 = [D[0] - ax * 55, D[1] - ay * 55, D[2] - az * 55 + 20];
      var n = 18, i, pts = [];
      for (i = 0; i <= n; i++) {
        var t = i / n, u = 1 - t;
        var b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
        var px = b0 * A[0] + b1 * C1[0] + b2 * C2[0] + b3 * D[0], py = b0 * A[1] + b1 * C1[1] + b2 * C2[1] + b3 * D[1], pz = b0 * A[2] + b1 * C1[2] + b2 * C2[2] + b3 * D[2];
        pts.push(X(px, py), Y(px, py, pz));
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2d5d93';
      ctx.lineWidth = Math.max(3, 4.2 * s);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (i = 2; i < pts.length; i += 2) { ctx.lineTo(pts[i], pts[i + 1]); }
      ctx.stroke();
      // Kugelglieder
      ctx.strokeStyle = 'rgba(15,30,50,0.55)';
      ctx.lineWidth = 1;
      for (i = 2; i < pts.length - 2; i += 2) {
        ctx.beginPath();
        ctx.ellipse(pts[i], pts[i + 1], 2.1 * s, 2.1 * s, 0, 0, PI2);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(190,215,240,0.45)';
      ctx.lineWidth = Math.max(1, 1.1 * s);
      ctx.beginPath();
      ctx.moveTo(pts[0] - 1.2 * s, pts[1] - 1.2 * s);
      for (i = 2; i < pts.length; i += 2) { ctx.lineTo(pts[i] - 1.2 * s, pts[i + 1] - 1.2 * s); }
      ctx.stroke();
      // Flachduese orange
      var Xd = pts[pts.length - 2], Yd = pts[pts.length - 1];
      var Xe = X(D[0] + ax * 9, D[1] + ay * 9), Ye = Y(D[0] + ax * 9, D[1] + ay * 9, D[2] + az * 9);
      ctx.strokeStyle = '#e2832b';
      ctx.lineWidth = Math.max(2.5, 3.2 * s);
      ctx.beginPath(); ctx.moveTo(Xd, Yd); ctx.lineTo(Xe, Ye); ctx.stroke();
      duesen.push([D[0] + ax * 9, D[1] + ay * 9, D[2] + az * 9]);
    }
    ctx.lineCap = 'butt';
    if (!an) { return; }
    // Strahl: praktisch gerade, glaenzend, auf die Schneide
    var j;
    for (j = 0; j < duesen.length; j++) {
      var d0 = duesen[j], x0 = X(d0[0], d0[1]), y0 = Y(d0[0], d0[1], d0[2]);
      var x1 = X(ziel[0], ziel[1]), y1 = Y(ziel[0], ziel[1], ziel[2]);
      var fl = 1 + 0.06 * Math.sin(this.uhr * 41 + j);
      ctx.lineCap = 'round';
      ctx.strokeStyle = strahlF;
      ctx.lineWidth = Math.max(2.5, (cnc ? 2.2 : 3.4) * s * fl);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 - 0.6 * s, y0 - 0.6 * s); ctx.lineTo(x1 - 0.6 * s, y1 - 0.6 * s); ctx.stroke();
      ctx.lineCap = 'butt';
    }
  };

  // ------------------------------------------------------- Teilchen
  // Austrittsstelle des Zahns aus dem Material (M03: Zahn laeuft mit fallendem Winkel)
  FraesSzene.prototype.austritt = function (G) {
    var sim = this.sim, NY = this.NY, R = G.r + 0.5, zt = sim.zT + (sim.auszug || 0) - 0.1;
    var dir = this.dirAkt, n = 40, i, best = null, start = dir > 0 ? -PI / 2 : PI / 2;
    var xw = G.xc - this.vs;
    var mat = [];
    for (i = 0; i <= n; i++) {
      var phi = start + PI * i / n;
      var px = xw + R * Math.cos(phi), py = G.yc + R * Math.sin(phi);
      var m = false;
      if ((px - xw) * dir > 0.25 && px >= 0 && px < sim.L && py >= 0 && py < sim.B) {
        m = this.tK[Math.floor(px / FX) * NY + Math.floor(py / FY)] < zt;
      }
      mat.push(m);
    }
    for (i = 0; i <= n; i++) {
      if (mat[i] && (i === 0 || !mat[i - 1])) { best = start + PI * i / n; break; }
    }
    if (best === null) { best = start; }
    var cnt = 0;
    for (i = 0; i <= n; i++) { if (mat[i]) { cnt++; } }
    return { phi: best, anteil: cnt / (n + 1) };
  };

  FraesSzene.prototype.spanTemp = function () {
    var sim = this.sim, w = sim.w;
    var T = sim.Tspan && sim.Tspan > 25 ? sim.Tspan : 20 + 0.85 * ((w ? w.T : 20) - 20);
    return T;
  };

  FraesSzene.prototype.spanNeu = function (G, aus, wild) {
    var sim = this.sim, mat = sim.mat, s = this.s;
    var phi = aus.phi + zufall(-0.3, 0.3);
    var vc = Math.max(1, sim.vc || 0) * 1000 / 60;
    var c = Math.cos(phi), sn = Math.sin(phi);
    var x = G.xc + G.r * c, y = G.yc + G.r * sn;
    var ap = Math.max(0.2, sim.apE || 0.5);
    var z = -Math.min(ap, 2.5) * zufall(0.2, 0.9);
    var art = Math.random();
    // Spaenestau: in der tiefen Vollnut ohne Spuelung bleibt ein Teil liegen
    var flut = sim.p.kss && sim.p.kss !== 'trocken' && this.kssAn;
    var stau = sim.eingriffAkt && sim.eingriffAkt.beide && ap > 0.8 * sim.def.d && !flut;
    var T = this.spanTemp() * (flut ? 0.8 : 1) + zufall(-35, 35);
    var farbe = this.spanFarbe(T);
    var typ = mat.id === 'GJL250' ? 'staub' : (mat.span === 'broeckel' ? 'kruemel' : 'locke');
    var rr = clamp(0.12 * sim.def.d + 0.5, 0.7, 2.4) * (mat.kleben > 0.5 ? 1.35 : 1) * zufall(0.75, 1.2);
    if (typ === 'kruemel') { rr *= 0.5; }
    if (typ === 'staub') { rr = zufall(0.2, 0.5); }
    var lw = clamp(s * (0.25 + 4 * (sim.hm || 0.03)), 1, 3);
    if (stau && art < 0.4 && !wild) {
      var xr = x - this.dirAkt * zufall(G.r * 0.6, G.r * 3) - this.vs;
      this.nutAblegen({ x: xr, y: G.yc + zufall(-G.r * 0.8, G.r * 0.8), rr: rr, lw: lw, farbe: farbe, rot: zufall(0, PI2), typ: typ });
      return;
    }
    var v, vx, vy, vz;
    if (art < 0.35 && !wild) {
      // Spaene, die an der Wand abprallen und in der Naehe landen
      v = zufall(250, 900);
      var a2 = phi + PI / 2 * -1 + zufall(-1.2, 1.2);
      vx = Math.cos(a2) * v; vy = Math.sin(a2) * v; vz = zufall(300, 1300);
    } else {
      v = vc * zufall(0.5, 1.0);
      var sp = zufall(-0.35, 0.35), tx = sn, ty = -c;
      var rx = tx * Math.cos(sp) - ty * Math.sin(sp), ry = tx * Math.sin(sp) + ty * Math.cos(sp);
      vx = rx * v + c * 0.15 * v; vy = ry * v + sn * 0.15 * v; vz = 0.3 * vc * zufall(0.4, 1.1);
    }
    var gl = (sim.glut || 0) > Math.random();
    this.flug.push({ typ: typ, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, t: 0, leben: 4, rot: zufall(0, PI2), vr: zufall(-35, 35),
      rr: rr, lw: lw, farbe: farbe, T0: gl ? zufall(650, 900) : 0, tau: 0.15 + 0.6 * (sim.hm || 0.03), luft: typ === 'staub' ? 8 : 2.5, bo: 0 });
    if (this.flug.length > 260) { this.flug.splice(0, this.flug.length - 260); }
  };

  // Spaene sind nie gleich hell: Ober- und Unterseite (rau bzw. blank), Oelfilm, Lage zum Licht
  FraesSzene.prototype.spanFarbe = function (T) {
    var mat = this.sim.mat, mo = this.mo, j = zufall(0.58, 1.0);
    if (mat.iso === 'N' || mat.iso === 'K') { return rgb(mo.span, j); }
    return rgb(anlaufRgb(Math.min(T, 590), mat.spanFarbe), j * 0.92);
  };

  FraesSzene.prototype.funkeNeu = function (x, y, z, ang, v, lebenF) {
    var mat = this.sim.mat, f = mat.funke || { f: 1, stern: 0.1, leben: 0.4 };
    var ti = mat.iso === 'S', guss = mat.iso === 'K', edel = mat.iso === 'M';
    var T0 = ti ? zufall(1500, 1700) : guss ? zufall(700, 850) : edel ? zufall(850, 1000) : zufall(900, 1100);
    var tau = (f.leben || 0.3) * zufall(0.15, 0.4) * (ti ? 3 : 1) * (lebenF || 1);
    if (this.fk.length >= 300) { return; }
    this.fk.push({ x: x, y: y, z: z, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vz: zufall(-0.2, 0.6) * v, t: 0, T0: T0, tau: tau, stern: Math.random() < (f.stern || 0) });
  };

  FraesSzene.prototype.emittieren = function (dts, G, a) {
    var sim = this.sim, mat = sim.mat, w = sim.w, i;
    this.kssAn = !!a.kss;
    if (dts <= 0) { return; }
    var schneidet = (sim.apE || 0) > 0.01 && (sim.ae || 0) > 0.01 && sim.nEff > 5 && !(w && w.gebrochen);
    var aus = null;
    if (schneidet) {
      aus = this.austritt(G);
      var rate = sim.def.z * sim.nEff / 60;
      var k = Math.max(1, Math.ceil(rate / 70));
      this.spanAkku += rate * dts;
      var nMax = 12;
      while (this.spanAkku >= k && nMax-- > 0) { this.spanAkku -= k; this.spanNeu(G, aus); }
      if (this.spanAkku > k * 3) { this.spanAkku = 0; }
      // Graphitstaub (Grauguss)
      if (mat.iso === 'K') { this.rauchAkku += 25 * dts; }
    } else { this.spanAkku = 0; }
    // Funken: nur was die Physik meldet (Rate je Sekunde und Einzelfunken)
    var fr = sim.funken || 0, puf = sim.funkenPuffer || 0;
    if (fr > 0 || puf > 0) {
      if (!aus) { aus = this.austritt(G); }
      var vc = Math.max(1, sim.vc || 0) * 1000 / 60, xs, ys, zs;
      var reib = !!sim.stumpfReibt;
      this.funkenAkku += fr * dts;
      var nf = Math.floor(this.funkenAkku) + Math.round(Math.min(80, puf));
      this.funkenAkku -= Math.floor(this.funkenAkku);
      if (puf > 0) { sim.funkenPuffer = 0; }
      for (i = 0; i < nf && i < 60; i++) {
        var phi = reib ? (this.dirAkt > 0 ? 0 : PI) + zufall(-1, 1) : aus.phi + zufall(-0.3, 0.3);
        xs = G.xc + G.r * Math.cos(phi); ys = G.yc + G.r * Math.sin(phi);
        zs = reib ? Math.max(G.zTip + G.hB, -1.5) : Math.max(-(sim.apE || 0) * 0.5, -2);
        var tang = phi - PI / 2 + zufall(-0.6, 0.6);
        this.funkeNeu(xs, ys, zs, tang, vc * zufall(0.6, 1.2), 1);
      }
    }
    // Rauch: reibender Stumpf, Oel auf heisser Zone, Dampf ueber Emulsion
    var Tsp = this.spanTemp(), flut = this.kssAn && sim.p.kss !== 'trocken';
    if (sim.stumpfReibt) { this.rauchAkku += 22 * dts; }
    if (schneidet && flut && sim.p.kss === 'oel' && Tsp > 250) { this.rauchAkku += clamp((Tsp - 250) / 150, 0, 1) * 12 * dts; }
    if (schneidet && flut && sim.p.kss !== 'oel' && Tsp > 380) { this.rauchAkku += clamp((Tsp - 380) / 200, 0, 1) * 14 * dts; }
    while (this.rauchAkku >= 1 && this.dunst.length < 70) {
      this.rauchAkku -= 1;
      var dampf = flut && sim.p.kss !== 'oel' && !sim.stumpfReibt, staub = mat.iso === 'K' && schneidet;
      var px = G.xc + zufall(-G.r, G.r) * 1.2, py = G.yc + zufall(-G.r, G.r);
      this.dunst.push({ x: px, y: py, z: Math.max(G.zTip + G.hB, 0) + 1, vx: zufall(-30, 30), vy: zufall(-30, 30), vz: staub ? zufall(20, 80) : zufall(90, 170),
        r0: staub ? zufall(1.5, 3) : zufall(2, 4), t: 0, leben: staub ? 1.1 : zufall(1.2, 1.8), a0: staub ? 0.22 : dampf ? 0.16 : 0.2,
        farbe: staub ? [40, 42, 44] : dampf ? [235, 240, 242] : [170, 178, 190] });
    }
    if (this.rauchAkku > 5) { this.rauchAkku = 0; }
    // KSS: Tropfen vom drehenden Fraeser, Nebel; IKZ als Schirm aus der Spitze
    if (flut && sim.nEff > 50) {
      var ikz = sim.p.kss === 'ikz';
      this.tropfAkku += (ikz ? 120 : 70) * dts;
      var omR = PI2 * sim.nEff / 60 * G.r;
      while (this.tropfAkku >= 1) {
        this.tropfAkku -= 1;
        if (this.flug.length > 300) { break; }
        var ph = zufall(0, PI2), vt = Math.min(5000, omR * zufall(0.4, 1));
        var zt = ikz ? Math.max(G.zTip, 0) + zufall(0, 2) : zufall(0, 6) + Math.max(G.zTip, 0);
        this.flug.push({ typ: 'tropfen', x: G.xc + G.r * Math.cos(ph), y: G.yc + G.r * Math.sin(ph), z: zt,
          vx: Math.sin(ph) * vt + Math.cos(ph) * vt * 0.3, vy: -Math.cos(ph) * vt + Math.sin(ph) * vt * 0.3, vz: zufall(100, 900),
          t: 0, leben: 0.5, rr: zufall(0.3, 0.8), luft: 1.5, bo: 0 });
      }
      this.nebelAkku += 6 * dts;
      while (this.nebelAkku >= 1 && this.dunst.length < 70) {
        this.nebelAkku -= 1;
        this.dunst.push({ x: G.xc + zufall(-G.r, G.r) * 2, y: G.yc + zufall(-G.r, G.r) * 2, z: Math.max(G.zTip, 0) + zufall(0, 8), vx: zufall(-60, 60), vy: zufall(-60, 60), vz: zufall(10, 60),
          r0: zufall(3, 6), t: 0, leben: 1.5, a0: 0.07, farbe: sim.p.kss === 'oel' ? [210, 190, 150] : [235, 240, 242] });
      }
    }
    if (this.bruch) { this.bruch.t += dts; }
  };

  // Hoehe der Auflageflaeche an (x, y) und Zeichenebene liegender Teile
  FraesSzene.prototype.hoehe = function (x, y) {
    var sim = this.sim, xm = this.xm, B = sim.B, xw = x - this.vs;
    if (xw >= 0 && xw < sim.L && y >= 0 && y < sim.B) {
      var t = this.tK[Math.floor(xw / FX) * this.NY + Math.floor(y / FY)];
      this._hz = -t; this._kat = t > 0.05 ? K_NUT : K_OBEN;
      return;
    }
    var ax = Math.abs(x - xm);
    if (ax < 70 && y >= -58 && y < 0) { this._hz = this.zJ; this._kat = K_OBEN; return; }
    if (ax < 70 && y >= B && y < B + 55) { this._hz = this.zJ; this._kat = K_HINTEN; return; }
    if (ax < 75 && y >= 0 && y < B) {
      this._hz = ((y >= 3 && y < 9) || (y >= B - 9 && y < B - 3)) && -sim.H > this.zB ? -sim.H : this.zB;
      this._kat = K_HINTEN;
      return;
    }
    if (ax < 70 && y >= -132 && y < B + 68) { this._hz = this.zB; this._kat = y < -58 ? K_VORN : K_HINTEN; return; }
    if (ax < 82 && y >= -150 && y < B + 80) { this._hz = this.zT + 22; this._kat = y < -58 ? K_VORN : K_HINTEN; return; }
    this._hz = this.zT;
    this._kat = y < -58 ? K_VORN : K_HINTEN;
  };

  FraesSzene.prototype.bewegen = function (dts) {
    if (dts <= 0) { return; }
    var arr = this.flug, n = 0, i, q, k, st;
    for (i = 0; i < arr.length; i++) {
      q = arr[i];
      q.t += dts;
      if (q.t > q.leben) { continue; }
      var sp = Math.abs(q.vx) + Math.abs(q.vy) + Math.abs(q.vz);
      var ns = Math.min(4, Math.max(1, Math.ceil(sp * dts / 12))), d = dts / ns, gelandet = false;
      for (st = 0; st < ns; st++) {
        k = q.luft || 2;
        q.vx -= q.vx * k * d;
        q.vy -= q.vy * k * d;
        q.vz -= (G_MM + q.vz * k) * d;
        q.x += q.vx * d; q.y += q.vy * d; q.z += q.vz * d;
        q.rot += (q.vr || 0) * d;
        this.hoehe(q.x, q.y);
        if (q.z <= this._hz && q.vz < 0) {
          if (q.typ === 'tropfen') { gelandet = true; break; }
          var v = Math.sqrt(q.vx * q.vx + q.vy * q.vy + q.vz * q.vz);
          q.z = this._hz;
          if (v > 400 && q.bo < 2) { q.vz *= -0.2; q.vx *= 0.35; q.vy *= 0.35; q.bo++; q.vr = (q.vr || 0) * 0.5; }
          else { this.ablegen(q, this._kat); gelandet = true; break; }
        }
      }
      if (gelandet || q.z < this.zT - 300) { continue; }
      arr[n++] = q;
    }
    arr.length = n;
    // Funken: Abkuehlung T = 20 + (T0 - 20) e^(-t/tau), erloschen unter 600 Grad C
    var fk = this.fk, m = 0, neu = [];
    for (i = 0; i < fk.length; i++) {
      q = fk[i];
      q.t += dts;
      q.vx -= q.vx * 1.5 * dts; q.vy -= q.vy * 1.5 * dts; q.vz -= (G_MM + q.vz * 1.5) * dts;
      q.x += q.vx * dts; q.y += q.vy * dts; q.z += q.vz * dts;
      q.T = 20 + (q.T0 - 20) * Math.exp(-q.t / q.tau);
      if (q.stern && !q.geteilt && q.t > q.tau * 0.6) {
        // Kohlenstoff-Sternchen: der Funke zerplatzt in kurze Aeste
        q.geteilt = true;
        var j, na = 3 + Math.floor(Math.random() * 3);
        for (j = 0; j < na; j++) {
          var aa = zufall(0, PI2), vv = zufall(400, 1200);
          neu.push({ x: q.x, y: q.y, z: q.z, vx: q.vx * 0.3 + Math.cos(aa) * vv, vy: q.vy * 0.3 + Math.sin(aa) * vv, vz: q.vz * 0.3 + zufall(-400, 400), t: 0, T0: q.T + 120, tau: q.tau * 0.25, stern: false });
        }
      }
      this.hoehe(q.x, q.y);
      if (q.T < 600 || q.z < this._hz - 0.5) { continue; }
      fk[m++] = q;
    }
    fk.length = m;
    for (i = 0; i < neu.length && fk.length < 300; i++) { fk.push(neu[i]); }
    // Rauch und Dampf steigen auf, wachsen, verblassen
    var du = this.dunst;
    m = 0;
    for (i = 0; i < du.length; i++) {
      q = du[i];
      q.t += dts;
      if (q.t > q.leben) { continue; }
      q.x += q.vx * dts; q.y += q.vy * dts; q.z += q.vz * dts;
      du[m++] = q;
    }
    du.length = m;
    // KSS spuelt liegende Spaene weg, der Fraeser raeumt die Nut
    this.spuelen(dts);
  };

  FraesSzene.prototype.ablegen = function (q, kat) {
    if (q.typ === 'stueck') {
      this.stuecke.push({ x: q.x, y: q.y, z: this._hz, rot: q.rot, len: q.len, rr: q.rr, kat: kat });
      if (this.stuecke.length > 6) { this.stuecke.shift(); }
      return;
    }
    var p = { x: q.x - (kat === K_NUT || kat === K_OBEN ? this.vs : 0), y: q.y, z: this._hz, rr: q.rr, lw: q.lw || 1, farbe: q.farbe || '#808080', rot: q.rot, typ: q.typ, kat: kat };
    if (kat === K_NUT) { this.nutAblegen(p); return; }
    if (kat === K_OBEN) {
      this.liegO.push(p);
      if (this.liegO.length > 500) { this.liegO.splice(0, 100); this.obenDirty = true; return; }
      if (this.cvO) { this.spanBacken(this.cvO.getContext('2d'), p); }
      return;
    }
    this.liegW.push(p);
    if (this.liegW.length > 2000) { this.liegW.shift(); }
    if (this.stH) { this.spanBacken((kat === K_VORN ? this.stV : this.stH).getContext('2d'), p); }
  };

  FraesSzene.prototype.nutAblegen = function (p) {
    p.kat = K_NUT;
    this.hoehe(p.x + this.vs, p.y);
    p.z = this._hz;
    this.nutSp.push(p);
    if (this.nutSp.length > 160) { this.nutSp.shift(); }
  };

  FraesSzene.prototype.spuelen = function (dts) {
    var sim = this.sim, G = this.G, i, n = 0, raus = 0, R2 = sq(G.r + 0.8), xw = G.xc - this.vs;
    var flut = this.kssAn && sim.p.kss !== 'trocken';
    var arr = this.nutSp;
    for (i = 0; i < arr.length; i++) {
      var q = arr[i];
      if (sq(q.x - xw) + sq(q.y - G.yc) < R2 && G.zTip < q.z + 0.5 && sim.nEff > 20) { raus++; continue; }
      if (flut && Math.random() < 0.6 * dts) { continue; }
      arr[n++] = q;
    }
    arr.length = n;
    // vom Fraeser erfasste Spaene fliegen wieder heraus
    if (raus > 0 && sim.nEff > 20) {
      var aus = this.austritt(G);
      for (i = 0; i < Math.min(raus, 4); i++) { this.spanNeu(G, aus, true); }
    }
    // Spaene auf dem Werkstueck: Flut spuelt sie herunter, der Fraeser schiebt sie weg
    this.obenZeit -= dts;
    if (this.obenZeit <= 0 && this.liegO.length) {
      this.obenZeit = 0.3;
      var o = this.liegO, m = 0, weg = 0;
      for (i = 0; i < o.length; i++) {
        var p = o[i];
        if (sq(p.x - xw) + sq(p.y - G.yc) < sq(G.r + 1.5) && G.zTip < 1) { weg++; continue; }
        if (flut && Math.random() < 0.2) { weg++; continue; }
        o[m++] = p;
      }
      o.length = m;
      if (weg) { this.obenDirty = true; }
    }
  };

  FraesSzene.prototype.obenBacken = function () {
    this.obenDirty = false;
    if (!this.cvO) { return; }
    var c = this.cvO.getContext('2d'), i;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    for (i = 0; i < this.liegO.length; i++) { this.spanBacken(c, this.liegO[i]); }
  };

  FraesSzene.prototype.liegendNeuBacken = function () {
    var i, p;
    for (i = 0; i < this.liegW.length; i++) {
      p = this.liegW[i];
      this.spanBacken((p.kat === K_VORN ? this.stV : this.stH).getContext('2d'), p);
    }
    this.obenBacken();
  };

  // Kommaspan: beim Fraesen waechst die Spandicke laengs des Spans von null auf hmax,
  // der Span rollt sich zur Locke. Gefuellte Sichel (dickes Ende aussen) statt Kreisbogen.
  // ry/rx: Verkuerzung der Rollebene, bogen: Rollwinkel, dick: Spandicke am dicken Ende (px)
  function kommaPfad(c, X, Y, rx, ry, rot, bogen, dick) {
    var n = 10, j, a, r;
    c.beginPath();
    for (j = 0; j <= n; j++) {
      a = rot + bogen * j / n;
      r = rx * (1 - 0.28 * j / n);
      c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r * ry);
    }
    for (j = n; j >= 0; j--) {
      a = rot + bogen * j / n;
      r = rx * (1 - 0.28 * j / n) - dick * (1 - j / n) - 0.35;
      c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r * ry);
    }
    c.closePath();
  }

  // Glanzlicht auf dem Ruecken der Locke
  function kommaGlanz(c, X, Y, rx, ry, rot, bogen, lw) {
    c.strokeStyle = 'rgba(255,255,255,0.32)';
    c.lineWidth = Math.max(0.5, lw * 0.3);
    c.beginPath();
    c.ellipse(X, Y, rx * 0.97, Math.max(0.3, rx * 0.97 * ry), 0, rot + bogen * 0.1, rot + bogen * 0.45);
    c.stroke();
  }

  // liegender Span: flachgedrueckte Locke bzw. Kruemel, Staub
  FraesSzene.prototype.spanBacken = function (c, p) {
    var X = this.bx(p.x, p.y), Y = this.by(p.x, p.y, p.z), rr = Math.max(0.6, p.rr * this.s);
    c.strokeStyle = p.farbe;
    c.fillStyle = p.farbe;
    if (p.typ === 'staub') { c.fillRect(X, Y, Math.max(1, rr), Math.max(1, rr * SP)); return; }
    if (p.typ === 'kruemel') {
      c.lineWidth = Math.max(1, p.lw * 0.8);
      c.beginPath();
      c.moveTo(X - Math.cos(p.rot) * rr, Y - Math.sin(p.rot) * rr * SP);
      c.lineTo(X + Math.cos(p.rot) * rr, Y + Math.sin(p.rot) * rr * SP);
      c.stroke();
      return;
    }
    // Locken liegen schraeg: Rollebene zufaellig gekippt, Kontaktschatten darunter
    var ry = SP * (0.45 + 0.55 * Math.abs(Math.sin(p.rot * 1.7))), bogen = 3.4 + 1.6 * Math.abs(Math.cos(p.rot * 2.3));
    var dick = Math.max(0.9, p.lw * 1.15);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    kommaPfad(c, X + 0.8, Y + 1.2, rr, ry, p.rot, bogen, dick);
    c.fill();
    c.fillStyle = p.farbe;
    kommaPfad(c, X, Y, rr, ry, p.rot, bogen, dick);
    c.fill();
    kommaGlanz(c, X, Y, rr, ry, p.rot, bogen, p.lw);
  };

  FraesSzene.prototype.nutSpaeneZeichnen = function (ctx, ox, oy) {
    var arr = this.nutSp, i;
    if (!arr.length) { return; }
    ctx.save();
    ctx.translate(ox, oy);
    for (i = 0; i < arr.length; i++) { this.spanBacken(ctx, arr[i]); }
    ctx.restore();
  };

  FraesSzene.prototype.teileZeichnen = function (ctx) {
    var arr = this.flug, i, s = this.s, q;
    ctx.lineCap = 'round';
    for (i = 0; i < arr.length; i++) {
      q = arr[i];
      if (q.typ === 'stueck') { this.stueckFliegend(ctx, q); continue; }
      var X = this.bx(q.x, q.y), Y = this.by(q.x, q.y, q.z);
      if (X < -50 || X > this.W + 50 || Y < -50 || Y > this.H + 50) { continue; }
      if (q.typ === 'tropfen') {
        ctx.strokeStyle = this.sim.p.kss === 'oel' ? 'rgba(210,160,70,0.6)' : 'rgba(236,242,244,0.7)';
        ctx.lineWidth = Math.max(1, q.rr * s);
        ctx.beginPath();
        ctx.moveTo(this.bx(q.x - q.vx * TBS, q.y - q.vy * TBS), this.by(q.x - q.vx * TBS, q.y - q.vy * TBS, q.z - q.vz * TBS));
        ctx.lineTo(X, Y);
        ctx.stroke();
        continue;
      }
      var farbe = q.farbe;
      if (q.T0) {
        var Tq = 20 + (q.T0 - 20) * Math.exp(-q.t / q.tau);
        if (Tq > 600) { continue; }   // noch gluehend: im Funkenschritt
      }
      ctx.strokeStyle = farbe;
      ctx.fillStyle = farbe;
      var v = Math.sqrt(q.vx * q.vx + q.vy * q.vy + q.vz * q.vz), lp = v * TBS * s, rr = Math.max(0.7, q.rr * s);
      if (lp > 6) {
        ctx.globalAlpha = clamp(4 * rr / lp, 0.3, 1);
        ctx.lineWidth = q.typ === 'staub' ? 1 : q.lw || 1;
        ctx.beginPath();
        ctx.moveTo(this.bx(q.x - q.vx * TBS, q.y - q.vy * TBS), this.by(q.x - q.vx * TBS, q.y - q.vy * TBS, q.z - q.vz * TBS));
        ctx.lineTo(X, Y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (q.typ === 'staub' || q.typ === 'splitter') {
        ctx.beginPath();
        ctx.moveTo(X + Math.cos(q.rot) * rr, Y + Math.sin(q.rot) * rr);
        ctx.lineTo(X + Math.cos(q.rot + 2.3) * rr * 0.7, Y + Math.sin(q.rot + 2.3) * rr * 0.7);
        ctx.lineTo(X + Math.cos(q.rot + 4.1) * rr * 0.8, Y + Math.sin(q.rot + 4.1) * rr * 0.8);
        ctx.closePath();
        ctx.fill();
      } else if (q.typ === 'kruemel') {
        ctx.lineWidth = q.lw || 1;
        ctx.beginPath();
        ctx.ellipse(X, Y, rr, rr * (0.3 + 0.7 * Math.abs(Math.cos(q.rot * 0.7))), q.rot, 0, 1.6);
        ctx.stroke();
      } else {
        // taumelnde Locke: die Rollebene dreht sich im Flug
        var fry = 0.25 + 0.75 * Math.abs(Math.cos(q.rot * 0.7));
        kommaPfad(ctx, X, Y, rr, fry, q.rot, 3.6, Math.max(0.9, (q.lw || 1) * 1.15));
        ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
  };

  FraesSzene.prototype.stueckFliegend = function (ctx, q) {
    var s = this.s, c = Math.cos(q.rot), sn = Math.sin(q.rot), hl = q.len / 2;
    var X0 = this.bx(q.x - c * hl * 0.3, q.y), Y0 = this.by(q.x - c * hl * 0.3, q.y, q.z - sn * hl);
    var X1 = this.bx(q.x + c * hl * 0.3, q.y), Y1 = this.by(q.x + c * hl * 0.3, q.y, q.z + sn * hl);
    ctx.strokeStyle = rgb(this.wkzRgb, 0.85);
    ctx.lineWidth = Math.max(2, q.rr * 2 * s * 0.9);
    ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
  };

  // Funken und gluehende Spaene: additive Striche in sechs Temperaturstufen
  FraesSzene.prototype.funkenZeichnen = function (ctx, G) {
    var sim = this.sim, s = this.s, i, k, q, fk = this.fk;
    var glut = clamp(sim.glut || 0, 0, 1);
    var nGl = 0;
    for (i = 0; i < this.flug.length; i++) { if (this.flug[i].T0) { nGl++; } }
    if (!fk.length && glut < 0.02 && !nGl && !(sim.stumpfReibt && sim.nEff > 20)) { return; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // Gluehen an der Schnittstelle bzw. am reibenden Stumpf
    var gl = Math.max(glut, sim.stumpfReibt && sim.nEff > 20 ? clamp(((sim.w ? sim.w.T : 0) - 450) / 300, 0.15, 1) : 0);
    if (gl > 0.02) {
      var aus = this.austritt(G), rg = (G.r * 1.3 + 2) * s;
      var xg = G.xc + G.r * Math.cos(aus.phi) * 0.8, yg = G.yc + G.r * Math.sin(aus.phi) * 0.8;
      var zg = sim.stumpfReibt ? Math.max(G.zTip + G.hB, -2) : Math.max(-(sim.apE || 0) * 0.4, -2);
      ctx.globalAlpha = gl * (0.75 + 0.25 * Math.sin(this.uhr * 29));
      ctx.drawImage(this.gluehSprite, this.bx(xg, yg) - rg, this.by(xg, yg, zg) - rg, 2 * rg, 2 * rg);
      ctx.globalAlpha = 1;
    }
    var stufen = [], h;
    for (k = 0; k < 6; k++) { stufen.push(new Path2D()); }
    function stufe(T) { var j; for (j = 0; j < 5; j++) { if (T < FUNKEN_STUFEN[j]) { return j; } } return 5; }
    for (i = 0; i < fk.length; i++) {
      q = fk[i];
      h = stufen[stufe(q.T)];
      h.moveTo(this.bx(q.x - q.vx * TBF, q.y - q.vy * TBF), this.by(q.x - q.vx * TBF, q.y - q.vy * TBF, q.z - q.vz * TBF));
      h.lineTo(this.bx(q.x, q.y), this.by(q.x, q.y, q.z));
    }
    // gluehende Spansegmente kuehlen im Flug ab
    for (i = 0; i < this.flug.length; i++) {
      q = this.flug[i];
      if (!q.T0) { continue; }
      var Tq = 20 + (q.T0 - 20) * Math.exp(-q.t / q.tau);
      if (Tq < 600) { continue; }
      h = stufen[stufe(Tq)];
      h.moveTo(this.bx(q.x - q.vx * TBS, q.y - q.vy * TBS), this.by(q.x - q.vx * TBS, q.y - q.vy * TBS, q.z - q.vz * TBS));
      h.lineTo(this.bx(q.x, q.y) + 0.5, this.by(q.x, q.y, q.z) + 0.5);
    }
    for (k = 0; k < 6; k++) {
      ctx.strokeStyle = FUNKEN_FARBEN[k];
      ctx.globalAlpha = 0.25 * Math.min(1, 0.4 + k * 0.15);
      ctx.lineWidth = 3;
      ctx.stroke(stufen[k]);
      ctx.globalAlpha = Math.min(1, 0.55 + k * 0.1);
      ctx.lineWidth = 1.1;
      ctx.stroke(stufen[k]);
    }
    ctx.restore();
  };

  FraesSzene.prototype.dunstZeichnen = function (ctx) {
    var du = this.dunst, i, q, s = this.s;
    for (i = 0; i < du.length; i++) {
      q = du[i];
      var a = q.a0 * (1 - q.t / q.leben), r = q.r0 * (1 + 2.5 * q.t) * s;
      ctx.fillStyle = rgba(q.farbe, a);
      ctx.beginPath();
      ctx.arc(this.bx(q.x, q.y), this.by(q.x, q.y, q.z), r, 0, PI2);
      ctx.fill();
    }
  };

  // ------------------------------------------------------- Schuetteln
  FraesSzene.prototype.stoss = function (A, tau, f) {
    this.stoesse.push({ A: A, tau: tau, f: f, t: 0, px: Math.random() * PI2, py: Math.random() * PI2 });
    if (this.stoesse.length > 8) { this.stoesse.shift(); }
  };

  // gedaempfte Sinusstoesse unter der Nyquist-Grenze statt Zufallsrauschen
  FraesSzene.prototype.schuetteln = function (dt) {
    var ox = 0, oy = 0, i, n = 0, st;
    for (i = 0; i < this.stoesse.length; i++) {
      st = this.stoesse[i];
      st.t += dt;
      if (st.t > 6 * st.tau) { continue; }
      var e = st.A * Math.exp(-st.t / st.tau);
      ox += e * Math.sin(PI2 * st.f * st.t + st.px);
      oy += e * Math.sin(PI2 * 1.3 * st.f * st.t + st.py);
      this.stoesse[n++] = st;
    }
    this.stoesse.length = n;
    // Haemmern und ratschende Kupplung: geringes Dauerschuetteln
    var Ad = 1.5 * (this.hammer || 0) + 0.6 * clamp(this.sim.kupplung || 0, 0, 1);
    if (Ad > 0.05) {
      ox += Ad * (0.6 * Math.sin(PI2 * 11.3 * this.uhr) + 0.4 * Math.sin(PI2 * 17.1 * this.uhr + 1));
      oy += Ad * 0.5 * Math.sin(PI2 * 13.7 * this.uhr + 2);
    }
    return [ox, oy];
  };

  FraesSzene.prototype.geisterTisch = function (ctx, cv, W, H) {
    var g = this.geist * this.s, k;
    ctx.globalAlpha = 0.18;
    for (k = -1; k <= 1; k += 2) { ctx.drawImage(cv, this.ox + k * g * EXX, this.oy + k * g * EXY, W, H); }
    ctx.globalAlpha = 1;
  };

  // ------------------------------------------------------- Beschriftung
  FraesSzene.prototype.hud = function (ctx, W, H, G) {
    var sim = this.sim, s = this.s;
    ctx.font = '11px ' + SCHRIFT;
    ctx.textBaseline = 'middle';
    // Abdraengung
    if (G.bend && Math.abs(G.bX) + Math.abs(G.bY) > 1.5 && G.zTip < 30) {
      var Xb = G.Xa + G.r * s + 10, Yb = G.Ya - (G.zN - 6) * CP * s;
      this.etikett(ctx, Xb, Yb, 'Abdrängung ×20', F.gelb);
    }
    // Tischsprung / Haemmern
    if (Math.abs(this.kick) * s > 1.2 || this.geist > 0.02) {
      var Xt = this.bx(this.xm + 70, -58) + this.ox + 8, Yt = this.by(this.xm + 70, -58, this.zJ) + this.oy + 14;
      this.etikett(ctx, Math.min(Xt, W - 150), Math.min(Yt, H - 14), this.geist > 0.02 ? 'Tisch hämmert – Bewegung ×20' : 'Tischsprung ×20', F.gelb);
    }
    if (Math.abs(this.vs) > 0.05) {
      var Xv = this.bx(sim.L, 0) + this.ox + 10, Yv = this.by(sim.L, 0, -sim.H * 0.5) + this.oy;
      this.etikett(ctx, Math.min(Xv, W - 170), Yv, 'Werkstück verrutscht ' + PH.nf(this.vs, 2) + ' mm', F.rot);
    }
    // Massstab 10 mm
    var x0 = 14, y0 = H - 14, l10 = 10 * s * EXX;
    ctx.strokeStyle = 'rgba(216,224,220,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0); ctx.lineTo(x0 + l10, y0); ctx.lineTo(x0 + l10, y0 - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(216,224,220,0.8)';
    ctx.fillText('10 mm', x0 + l10 + 6, y0 - 2);
    // CNC: Alarmzeile der Steuerung
    if (sim.alarm && sim.m.cnc) {
      var blink = Math.floor(this.alarmZeit * 2) % 2 === 0;
      ctx.fillStyle = 'rgba(20,6,6,0.88)';
      ctx.fillRect(0, 0, W, 22);
      ctx.fillStyle = blink ? '#ff4a3d' : '#b8302a';
      ctx.fillRect(0, 21, W, 1);
      ctx.font = '12px ' + MONO;
      ctx.fillStyle = blink ? '#ff6a5a' : '#e05a50';
      ctx.fillText('⚠ ' + sim.alarm, 10, 11);
    }
    ctx.textBaseline = 'alphabetic';
  };

  FraesSzene.prototype.etikett = function (ctx, X, Y, text, farbe) {
    var w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(10,12,13,0.72)';
    ctx.fillRect(X, Y - 8, w, 16);
    ctx.fillStyle = farbe;
    ctx.fillRect(X, Y - 8, 2, 16);
    ctx.fillStyle = '#e8eee9';
    ctx.fillText(text, X + 6, Y);
  };

  // ------------------------------------------------------- Ereignisse
  FraesSzene.prototype.ereignis = function (e) {
    if (!e) { return; }
    var t = e.typ;
    if (t === 'bruch') {
      if (!this.bruch) { this.bruchSetzen(true); }
    } else if (t === 'tischZieht') {
      this.stoss(3, 0.05, 21);
      this.markeZeit = Math.max(this.markeZeit, 0.06);
      if (!this.sim.tischE) { this.eTief = -(this.sim.m.umkehrspiel || 0.15); }
    } else if (t === 'rutscht' || t === 'rutsch') {
      this.stoss(4, 0.15, 19);
    } else if (t === 'kupplung') {
      this.stoss(1.2, 0.1, 13);
    } else if (t === 'kollision') {
      this.stoss(10, 0.2, 18);
      this.blitz = 0.8;
      this.blitzFarbe = [217, 45, 32];
    } else if (t === 'unfall') {
      this.stoss(15, 0.3, 17);
      this.blitz = 1;
      this.blitzFarbe = [217, 45, 32];
    } else if (t === 'alarm') {
      this.alarmZeit = 0;
    } else if (t === 'spanbrand') {
      // Titanspaene entzuenden sich: grellweisse Flammen und Rauch
      var G = this.G, i;
      for (i = 0; i < 30; i++) { this.funkeNeu(G.xc + zufall(-G.r, G.r), G.yc + zufall(-G.r, G.r), 0.5, zufall(0, PI2), zufall(200, 900), 3); }
      this.rauchAkku += 12;
      this.blitz = 0.35;
      this.blitzFarbe = [255, 240, 210];
    }
  };

  ZM.szenen.FraesSzene = FraesSzene;
})(typeof window !== 'undefined' ? window : globalThis);
