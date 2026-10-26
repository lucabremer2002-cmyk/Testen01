/*
 * Darstellung der Bearbeitung auf dem Canvas.
 *
 *   BohrSzene   Saeulenbohrmaschine/BAZ im Schnitt: Werkstueck schraffiert,
 *               Bohrer mit drehenden Spannuten, Spaene, KSS, Anlauffarben
 *   DrehSzene   Drehmaschine von oben: Futter mit Backen, Werkstueckkontur aus
 *               der Simulation, Klemmhalter mit Wendeschneidplatte, Reitstock
 *   FraesSzene  Fraesmaschine von oben: Hoehenkarte des Werkstuecks,
 *               Schaftfraeser, Schraubstock und Seitenansicht als Einblendung
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  var PH = ZM.physik;

  var F = {
    hg1: '#20262a', hg2: '#121618',
    masch: '#5d7466', maschD: '#3e4d45', maschH: '#7f9488',
    stahlH: '#d4d9dd', stahl: '#9aa2a9', stahlD: '#5b636a',
    backe: '#4a5056', gelb: '#f2b100', rot: '#d92d20',
    schrift: '#d8e0dc', schriftD: '#8b9792'
  };
  var SCHRIFT = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  var MONO = "'Share Tech Mono', 'Consolas', monospace";

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function zufall(a, b) { return a + Math.random() * (b - a); }

  // ------------------------------------------------------------- Partikel
  function Partikelsystem(max) {
    this.p = [];
    this.liegen = [];
    this.max = max || 500;
  }
  Partikelsystem.prototype.add = function (o) {
    if (this.p.length >= this.max) { this.p.shift(); }
    o.t = 0;
    o.rot = o.rot || zufall(0, 6.28);
    o.vr = o.vr === undefined ? zufall(-8, 8) : o.vr;
    this.p.push(o);
  };
  Partikelsystem.prototype.update = function (dt, boden, g) {
    var i, q, neu = [];
    g = g === undefined ? 900 : g;
    for (i = 0; i < this.p.length; i++) {
      q = this.p[i];
      q.t += dt;
      q.vy += (q.g === undefined ? g : q.g) * dt;
      q.vx *= 1 - (q.luft || 0.4) * dt;
      q.vy *= 1 - (q.luft || 0.4) * dt * 0.3;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.wachs) { q.len = Math.min(q.lenMax, (q.len || 2) + q.wachs * dt); }
      if (q.t > q.leben) { continue; }
      if (boden !== null && q.y > boden(q.x) && q.liegt !== false && q.vy > 0) {
        if (q.bleibt) {
          q.vx = 0; q.vy = 0; q.vr = 0;
          q.y = boden(q.x) - zufall(0, 4);
          this.liegen.push(q);
          if (this.liegen.length > 220) { this.liegen.shift(); }
        }
        continue;
      }
      neu.push(q);
    }
    this.p = neu;
  };

  function zeichneSpan(ctx, q, s) {
    var a = q.alpha === undefined ? 1 : q.alpha * (1 - clamp((q.t - q.leben * 0.7) / (q.leben * 0.3), 0, 1));
    if (q.typ === 'rauch') {
      a = (q.alpha || 0.25) * (1 - q.t / q.leben);
      ctx.fillStyle = 'rgba(200,205,210,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * (1 + q.t * 1.5), 0, 6.283);
      ctx.fill();
      return;
    }
    if (q.typ === 'kss') {
      ctx.fillStyle = q.farbe;
      ctx.globalAlpha = 0.55 * (1 - q.t / q.leben);
      ctx.fillRect(q.x, q.y, q.r, q.r * 1.6);
      ctx.globalAlpha = 1;
      return;
    }
    if (q.typ === 'funke') {
      ctx.strokeStyle = q.farbe;
      ctx.globalAlpha = 1 - q.t / q.leben;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - q.vx * 0.02, q.y - q.vy * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.rot);
    ctx.globalAlpha = a;
    ctx.strokeStyle = q.farbe;
    ctx.fillStyle = q.farbe;
    var gr = q.r * (s || 1);
    if (q.typ === 'staub') {
      ctx.fillRect(-gr / 2, -gr / 2, gr, gr);
    } else if (q.typ === 'broeckel') {
      ctx.beginPath();
      ctx.moveTo(-gr, -gr * 0.4);
      ctx.lineTo(gr * 0.6, -gr);
      ctx.lineTo(gr, gr * 0.5);
      ctx.lineTo(-gr * 0.4, gr);
      ctx.closePath();
      ctx.fill();
    } else if (q.typ === 'locke') {
      ctx.lineWidth = Math.max(1, gr * 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, 4.3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(0.5, gr * 0.12);
      ctx.beginPath();
      ctx.arc(0, 0, gr * 0.92, 0.4, 2.2);
      ctx.stroke();
    } else if (q.typ === 'band') {
      // Wendelspan: Schraubenfeder in Seitenansicht, mit Glanzkante
      var win = Math.max(2, Math.round((q.len || 10) / 6)), t, steig = gr * 0.55;
      ctx.lineWidth = Math.max(1, gr * 0.26);
      ctx.beginPath();
      for (t = 0; t <= win * 6.283; t += 0.35) {
        var px = t / 6.283 * steig + Math.cos(t) * gr * 0.35;
        var py = Math.sin(t) * gr;
        if (t === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = Math.max(0.5, gr * 0.08);
      ctx.stroke();
    } else if (q.typ === 'dick') {
      ctx.fillRect(-gr, -gr * 0.6, gr * 2, gr * 1.2);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function spanFarbe(mat, T) {
    var basis = mat.spanFarbe;
    if (mat.iso === 'N' || mat.iso === 'K') { return basis; }
    return PH.anlaufFarbe(T * 0.62, basis);
  }

  function spanTyp(mat) {
    if (mat.id === 'GJL250') { return 'staub'; }
    if (mat.span === 'broeckel') { return 'broeckel'; }
    return 'band';
  }

  function resize(cv) {
    var dpr = root.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function hintergrund(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, F.hg1);
    g.addColorStop(1, F.hg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function metall(ctx, x0, x1, hell, mitte, dunkel) {
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, dunkel);
    g.addColorStop(0.32, hell);
    g.addColorStop(0.55, mitte);
    g.addColorStop(1, dunkel);
    return g;
  }

  function metallV(ctx, y0, y1, hell, mitte, dunkel) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, dunkel);
    g.addColorStop(0.3, hell);
    g.addColorStop(0.5, mitte);
    g.addColorStop(1, dunkel);
    return g;
  }

  function schraffur(ctx, x, y, w, h, ab, farbe) {
    var i;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = farbe;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = -h; i < w + h; i += ab) {
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function mischFarbe(a, b, t) {
    function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
    var x = hex(a), y = hex(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }

  function gluehen(T) {
    if (T < 520) { return null; }
    var a = clamp((T - 520) / 400, 0, 0.9);
    return 'rgba(255,' + Math.round(clamp(120 - (T - 520) * 0.2, 30, 120)) + ',30,' + a.toFixed(2) + ')';
  }

  // =====================================================================
  //                               BOHREN
  // =====================================================================
  // Lackierung aus dem Profil auf die Maschinenfarben uebertragen
  function lackFarben() {
    var hex = ZM.optik && ZM.optik.lack;
    if (!hex) { return; }
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    function t(k, add) { return 'rgb(' + [r, g, b].map(function (c) { return Math.round(clamp(c * k + add, 0, 255)); }).join(',') + ')'; }
    F.masch = hex; F.maschD = t(0.65, 0); F.maschH = t(1, 34);
  }

  function BohrSzene(sim, op) {
    lackFarben();
    this.sim = sim;
    this.op = op;
    this.teile = new Partikelsystem(420);
    this.winkel = 0;
    this.schuettel = 0;
    this.blitz = 0;
    this.bruch = null;
    this.kssPhase = 0;
  }

  BohrSzene.prototype.ereignis = function (e) {
    if (e.typ === 'bruch') {
      var w = this.sim.w;
      this.bruch = { z: this.sim.z, L: w.bruch ? w.bruch.bruchstelle : this.sim.def.d, steckt: w.bruch && w.bruch.steckt };
      this.schuettel = 0.5;
      this.blitz = 0.6;
      this.funken = 18;
    }
    if (e.typ === 'unfall') { this.schuettel = 0.8; this.blitz = 1; }
  };

  BohrSzene.prototype.neuesLoch = function () {
    this.bruch = null;
  };

  BohrSzene.prototype.zeichne = function (cv, dt, a) {
    var r = resize(cv), ctx = r.ctx, W = r.w, H = r.h;
    var sim = this.sim, def = sim.def, w = sim.w, mat = sim.mat;
    var d = def.d, R = d / 2;
    var dicke = sim.dicke;
    var dickeSicht = Math.min(dicke, 70);
    this.winkel += (sim.nEff / 60) * Math.PI * 2 * dt * sim.richtung;

    // Kamera: Schnittzone im Blick, Futter und Pinole ragen oben aus dem Bild
    var oben = Math.max(40, Math.min(70, 30 + 3 * d));
    var unten = dickeSicht + 22;
    var breiteMm = Math.max(64, d * 6.5);
    var s = Math.min(H * 0.95 / (oben + unten), W * 0.64 / breiteMm);
    s = Math.min(s, 14);
    var X0 = W * 0.44;
    var Y0 = H * 0.03 + oben * s;
    var sx = this.schuettel > 0 ? zufall(-1, 1) * this.schuettel * 8 : 0;
    var sy = this.schuettel > 0 ? zufall(-1, 1) * this.schuettel * 8 : 0;
    this.schuettel = Math.max(0, this.schuettel - dt);

    hintergrund(ctx, W, H);
    ctx.save();
    ctx.translate(sx, sy);
    function X(mm) { return X0 + mm * s; }
    function Y(mm) { return Y0 + mm * s; }

    // Saeule im Hintergrund
    ctx.fillStyle = metall(ctx, W * 0.8, W * 0.97, '#6b8073', F.masch, F.maschD);
    ctx.fillRect(W * 0.8, 0, W * 0.17, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(W * 0.8, 0, 3, H);

    // Tisch, Schraubstock, Parallelunterlagen
    var halb = breiteMm / 2;
    var wsB = Math.min(halb - 14, Math.max(22, d * 3));
    var tischY = dickeSicht + 18;
    ctx.fillStyle = metallV(ctx, Y(tischY), Y(tischY + 30), '#77857d', F.masch, F.maschD);
    ctx.fillRect(0, Y(tischY), W, H - Y(tischY));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    var tn;
    for (tn = -2; tn <= 2; tn++) { ctx.fillRect(X(tn * 28) - 5 * s / 2, Y(tischY), 10 * s / 2, 12 * s / 2); }
    // Schraubstockkoerper
    ctx.fillStyle = metallV(ctx, Y(dickeSicht + 8), Y(tischY), '#59616a', '#474e55', '#2f3439');
    ctx.fillRect(X(-wsB - 22), Y(dickeSicht + 8), (2 * wsB + 44) * s, (tischY - dickeSicht - 8) * s);
    // Parallelunterlagen an den Raendern (Bohrer laeuft frei durch)
    ctx.fillStyle = '#b9c0c6';
    ctx.fillRect(X(-wsB), Y(dickeSicht), 7 * s, 8 * s);
    ctx.fillRect(X(wsB - 7), Y(dickeSicht), 7 * s, 8 * s);
    // Backen
    var bk = function (x0, x1) {
      ctx.fillStyle = metall(ctx, X(x0), X(x1), '#7a8189', '#5a6168', '#383d42');
      ctx.fillRect(X(x0), Y(-4), (x1 - x0) * s, (dickeSicht + 12) * s);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      var yy;
      for (yy = -3; yy < dickeSicht + 6; yy += 2) {
        ctx.beginPath();
        ctx.moveTo(X(x0 < 0 ? x1 - 2 : x0), Y(yy));
        ctx.lineTo(X(x0 < 0 ? x1 : x0 + 2), Y(yy + 1));
        ctx.stroke();
      }
    };
    bk(-wsB - 18, -wsB);
    bk(wsB, wsB + 18);

    // ----------------------------------------------- Werkstueck im Schnitt
    var xl = X(-wsB), xr = X(wsB), yt = Y(0), yb = Y(dickeSicht);
    ctx.fillStyle = mischFarbe(mat.farbe, '#202428', 0.1);
    ctx.fillRect(xl, yt, xr - xl, yb - yt);
    schraffur(ctx, xl, yt, xr - xl, yb - yt, Math.max(5, 2.2 * s), 'rgba(20,24,28,0.55)');
    ctx.strokeStyle = '#1a1d20';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(xl, yt, xr - xl, yb - yt);
    if (dicke > dickeSicht) {
      ctx.fillStyle = F.schriftD;
      ctx.font = '11px ' + SCHRIFT;
      ctx.fillText('Werkstück ' + Math.round(dicke) + ' mm (gekürzt)', xl + 4, yb - 4);
    }

    // Bohrung (Rueckwand der Bohrung sichtbar)
    var vl = sim.vorLoch;
    var holeR = sim.typ === 'gewinde' ? sim.r0 : Math.max(sim.r0, sim.zMax > 0 ? R : 0);
    var zCyl = sim.typ === 'bohrer' ? sim.zMax - sim.lp : sim.zMax;
    var spitzeVor = vl ? (vl.durch ? 1e9 : vl.spitze) : 0;
    var lochFuell = function (r0, zc, zt) {
      if (r0 <= 0 || zt <= 0) { return; }
      ctx.save();
      ctx.beginPath();
      ctx.rect(xl, yt, xr - xl, yb - yt);
      ctx.clip();
      var gr = ctx.createLinearGradient(X(-r0), 0, X(r0), 0);
      gr.addColorStop(0, '#2c3136');
      gr.addColorStop(0.35, '#6f777e');
      gr.addColorStop(0.7, '#3e444a');
      gr.addColorStop(1, '#25292d');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(X(-r0), Y(0));
      ctx.lineTo(X(-r0), Y(Math.max(0, zc)));
      ctx.lineTo(X(0), Y(zt));
      ctx.lineTo(X(r0), Y(Math.max(0, zc)));
      ctx.lineTo(X(r0), Y(0));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    if (vl && sim.r0 > 0) {
      lochFuell(sim.r0, vl.durch ? 1e3 : vl.tiefe, vl.durch ? 1e3 : vl.spitze);
    }
    if (sim.typ !== 'gewinde' && sim.zMax > 0) {
      lochFuell(R, zCyl, sim.zMax);
    }
    // Gewindeprofil an den Bohrungswaenden
    if (sim.typ === 'gewinde' && sim.gew.zMax > 0) {
      var P = def.P, gz = Math.min(sim.gew.zMax, dickeSicht), yy2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(xl, yt, xr - xl, yb - yt);
      ctx.clip();
      ctx.fillStyle = '#2b3035';
      ctx.beginPath();
      for (yy2 = 0; yy2 < gz; yy2 += P) {
        var tiefeR = yy2 > gz - def.anschnitt ? (gz - yy2) / def.anschnitt : 1;
        var ra = sim.r0 + (R - sim.r0) * clamp(tiefeR, 0, 1);
        ctx.moveTo(X(-sim.r0), Y(yy2));
        ctx.lineTo(X(-ra), Y(yy2 + P / 2));
        ctx.lineTo(X(-sim.r0), Y(yy2 + P));
        ctx.moveTo(X(sim.r0), Y(yy2));
        ctx.lineTo(X(ra), Y(yy2 + P / 2));
        ctx.lineTo(X(sim.r0), Y(yy2 + P));
      }
      ctx.fill();
      ctx.restore();
    }
    // Grat am Austritt
    if (sim.durchbruch && sim.st.fAustritt > 0.02 && mat.duktil > 0.3 && dicke <= dickeSicht) {
      var gh = clamp(mat.duktil * (0.04 + 0.9 * sim.st.fAustritt), 0.05, 1.2) * s;
      ctx.fillStyle = mischFarbe(mat.farbe, '#ffffff', 0.15);
      ctx.beginPath();
      ctx.moveTo(X(-R - 0.6), yb);
      ctx.lineTo(X(-R), yb + gh);
      ctx.lineTo(X(-R + 0.4), yb);
      ctx.moveTo(X(R + 0.6), yb);
      ctx.lineTo(X(R), yb + gh);
      ctx.lineTo(X(R - 0.4), yb);
      ctx.fill();
    }

    // ----------------------------------------------- Werkzeug
    var zT = sim.z;
    var gebrochen = w.gebrochen;
    var zSpitzeOben = gebrochen && this.bruch ? sim.zQ - this.bruch.L : null;
    if (gebrochen && this.bruch && this.bruch.steckt) {
      this.zeichneWerkzeug(ctx, X, Y, s, this.bruch.z, this.bruch.z - this.bruch.L, true, 'unten');
    }
    var oberkanteSpitze = gebrochen ? (zSpitzeOben !== null ? zSpitzeOben : sim.zQ - d) : zT;
    var futterZ = (gebrochen ? sim.zQ : zT) - def.frei;
    this.zeichneWerkzeug(ctx, X, Y, s, gebrochen ? oberkanteSpitze : zT, futterZ, gebrochen, gebrochen ? 'oben' : 'ganz');
    this.zeichneFutter(ctx, X, Y, s, futterZ, W);

    // Spaene in der Bohrung (Spanraumfuellung)
    if (sim.phi > 0.25 && sim.z > 0.5 && !gebrochen) {
      var dicht = clamp((sim.phi - 0.25) * 30, 0, 50);
      var k;
      ctx.fillStyle = spanFarbe(mat, w.T);
      for (k = 0; k < dicht; k++) {
        var hz = Math.random() * Math.min(sim.z, dickeSicht);
        var hx = (Math.random() * 2 - 1) * R * 0.85;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(X(hx), Y(hz), Math.max(1.5, s * 0.5), Math.max(1.5, s * 0.35));
      }
      ctx.globalAlpha = 1;
    }

    // ----------------------------------------------- Spaene und Effekte
    var schneidet = sim.f > 0.002 && sim.nEff > 5 && sim.z > 0 && !gebrochen;
    if (schneidet) {
      var rate = clamp(sim.f * sim.nEff / 60 * d * d * 0.35, 4, 140);
      var nNeu = rate * dt;
      var typ = spanTyp(mat);
      if (sim.typ === 'reibahle' || sim.typ === 'gewinde') { typ = 'staub'; nNeu *= 0.4; }
      while (nNeu > 0) {
        if (Math.random() < nNeu) {
          var seite = Math.random() < 0.5 ? -1 : 1;
          var auswurf = sim.z < dicke ? 1 : 0.4;
          this.teile.add({
            typ: typ, x: X(seite * (R + 0.3)), y: Y(-0.5),
            vx: seite * zufall(60, 200) * auswurf, vy: -zufall(40, 220) * auswurf,
            r: typ === 'staub' ? zufall(1, 2.2) : clamp(d * s * 0.07 + zufall(1, 3), 2, 9), len: zufall(6, 26),
            farbe: spanFarbe(mat, w.T), leben: 4, bleibt: typ !== 'staub' || Math.random() < 0.3
          });
          if (sim.durchbruch && sim.z > dicke - 1) {
            this.teile.add({
              typ: typ, x: X(seite * R * 0.6), y: Y(dickeSicht + 0.5), vx: seite * zufall(10, 60), vy: zufall(20, 80),
              r: 2, len: 10, farbe: spanFarbe(mat, w.T), leben: 2, bleibt: false
            });
          }
        }
        nNeu -= 1;
      }
      if (w.T > 380 && Math.random() < dt * (w.T - 350) / 40) {
        this.teile.add({ typ: 'rauch', x: X(zufall(-R, R)), y: Y(-1), vx: zufall(-10, 10), vy: -zufall(20, 50), g: -20, r: zufall(3, 7), leben: 2.2, alpha: clamp((w.T - 350) / 500, 0.08, 0.4), luft: 0.2 });
      }
    }
    if (this.funken > 0) {
      var fi;
      for (fi = 0; fi < this.funken; fi++) {
        this.teile.add({ typ: 'funke', x: X(0), y: Y(Math.max(0, this.bruch ? this.bruch.z - this.bruch.L : 0)), vx: zufall(-500, 500), vy: zufall(-500, 50), farbe: '#ffd27a', leben: 0.35, g: 600 });
      }
      this.funken = 0;
    }

    // KSS
    this.kss(ctx, X, Y, s, dt, a);

    var bodenY = Y(tischY) - 2;
    this.teile.update(dt, function () { return bodenY; }, 900);
    var i;
    for (i = 0; i < this.teile.liegen.length; i++) { zeichneSpan(ctx, this.teile.liegen[i], 1); }
    for (i = 0; i < this.teile.p.length; i++) { zeichneSpan(ctx, this.teile.p[i], 1); }

    // Tiefenmassstab links vom Werkstueck
    this.skala(ctx, X, Y, s, xl, dickeSicht);
    ctx.restore();

    // Uebersicht der Bohrpositionen
    this.karte(ctx, W, H);

    if (this.blitz > 0) {
      ctx.fillStyle = 'rgba(217,45,32,' + (this.blitz * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 1.5);
    }
  };

  // Werkzeug von Spitze zTip bis Futter zTop (mm, nach unten positiv)
  BohrSzene.prototype.zeichneWerkzeug = function (ctx, X, Y, s, zTip, zTop, gebrochen, teil) {
    var sim = this.sim, def = sim.def, w = sim.w;
    var R = def.d / 2;
    var lp = sim.typ === 'bohrer' ? sim.lp : (sim.typ === 'reibahle' ? 0.4 : def.anschnitt);
    var stoff = ZM.daten.schneidstoffe[def.stoff];
    var basis = stoff.farbe;
    var nutEnde = teil === 'unten' ? zTop : Math.max(zTop, zTip - def.l2);
    var schaftR = sim.typ === 'gewinde' ? R * 0.78 : R;
    ctx.save();
    // Schaft
    if (teil !== 'unten') {
      ctx.fillStyle = metall(ctx, X(-schaftR), X(schaftR), F.stahlH, F.stahl, F.stahlD);
      ctx.fillRect(X(-schaftR), Y(zTop), 2 * schaftR * s, (nutEnde - zTop) * s);
    }
    // Schneidenteil
    var oben = teil === 'oben' ? nutEnde : nutEnde;
    var unten = zTip;
    var koerper = ctx.createLinearGradient(X(-R), 0, X(R), 0);
    var hell = basis === '#d9b13b' ? '#f2d27a' : '#e2e6ea';
    koerper.addColorStop(0, '#4c5257');
    koerper.addColorStop(0.3, hell);
    koerper.addColorStop(0.55, basis);
    koerper.addColorStop(1, '#3a3f44');
    ctx.fillStyle = koerper;
    ctx.beginPath();
    if (teil === 'oben') {
      // gebrochene Kante unten
      ctx.moveTo(X(-R), Y(oben));
      ctx.lineTo(X(-R), Y(unten - 0.4));
      ctx.lineTo(X(-R * 0.4), Y(unten + 0.6));
      ctx.lineTo(X(0), Y(unten - 0.3));
      ctx.lineTo(X(R * 0.5), Y(unten + 0.8));
      ctx.lineTo(X(R), Y(unten));
      ctx.lineTo(X(R), Y(oben));
    } else {
      var obenK = teil === 'unten' ? zTop : oben;
      if (teil === 'unten') {
        ctx.moveTo(X(-R), Y(obenK + 0.4));
        ctx.lineTo(X(-R * 0.4), Y(obenK - 0.5));
        ctx.lineTo(X(0), Y(obenK + 0.3));
        ctx.lineTo(X(R * 0.5), Y(obenK - 0.7));
        ctx.lineTo(X(R), Y(obenK));
      } else {
        ctx.moveTo(X(-R), Y(obenK));
        ctx.lineTo(X(R), Y(obenK));
      }
      if (sim.typ === 'bohrer') {
        ctx.lineTo(X(R), Y(unten - lp));
        ctx.lineTo(X(0), Y(unten));
        ctx.lineTo(X(-R), Y(unten - lp));
      } else if (sim.typ === 'reibahle') {
        ctx.lineTo(X(R), Y(unten - 0.4));
        ctx.lineTo(X(R - 0.4), Y(unten));
        ctx.lineTo(X(-R + 0.4), Y(unten));
        ctx.lineTo(X(-R), Y(unten - 0.4));
      } else {
        ctx.lineTo(X(R), Y(unten - lp));
        ctx.lineTo(X(R * 0.78), Y(unten));
        ctx.lineTo(X(-R * 0.78), Y(unten));
        ctx.lineTo(X(-R), Y(unten - lp));
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    // Spannuten bzw. Gewindeprofil
    var lead = sim.typ === 'bohrer' ? Math.PI * def.d / Math.tan(30 * Math.PI / 180) : 1e9;
    var nuten = sim.typ === 'bohrer' ? 2 : sim.typ === 'reibahle' ? def.z : 3;
    var k, z, ph;
    ctx.strokeStyle = 'rgba(25,28,32,0.55)';
    ctx.lineWidth = Math.max(1.5, R * s * 0.35);
    for (k = 0; k < nuten; k++) {
      ctx.beginPath();
      var erster = true;
      for (z = unten; z > oben - 1; z -= 0.6) {
        ph = this.winkel + k * Math.PI * 2 / nuten - (z / lead) * Math.PI * 2;
        var c = Math.cos(ph), sn = Math.sin(ph);
        if (sn < 0) { erster = true; continue; }
        var xx = X(c * R * 0.92);
        if (erster) { ctx.moveTo(xx, Y(z)); erster = false; } else { ctx.lineTo(xx, Y(z)); }
      }
      ctx.stroke();
    }
    if (sim.typ === 'gewinde') {
      ctx.strokeStyle = 'rgba(20,22,25,0.5)';
      ctx.lineWidth = 1;
      var P = def.P;
      for (z = unten; z > oben; z -= P) {
        ctx.beginPath();
        ctx.moveTo(X(-R), Y(z));
        ctx.lineTo(X(R), Y(z - P * 0.5));
        ctx.stroke();
      }
    }
    // Anlauffarben (bleibend) und Gluehen (aktuell)
    var maxT = w.maxT;
    if (maxT > 420) {
      var anl = PH.anlaufFarbe(Math.min(maxT - 180, 360), basis);
      var hoehe = clamp(def.d * 0.4 + (maxT - 420) / 60, 1, def.d * 2);
      var g2 = ctx.createLinearGradient(0, Y(unten), 0, Y(unten - hoehe));
      g2.addColorStop(0, anl);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = g2;
      ctx.fillRect(X(-R), Y(unten - hoehe), 2 * R * s, hoehe * s);
      ctx.globalAlpha = 1;
    }
    var gl = gluehen(w.T);
    if (gl && teil !== 'oben') {
      var g3 = ctx.createLinearGradient(0, Y(unten), 0, Y(unten - def.d));
      g3.addColorStop(0, gl);
      g3.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g3;
      ctx.fillRect(X(-R), Y(unten - def.d), 2 * R * s, def.d * s);
    }
    // Verschleiss: abgerundete Schneidecken dunkel
    if (w.VB > 0.15 && teil !== 'oben') {
      ctx.fillStyle = 'rgba(30,30,30,' + clamp(w.VB, 0, 0.8).toFixed(2) + ')';
      ctx.fillRect(X(-R), Y(unten - lp - 0.6), 0.8 * s, 1.2 * s);
      ctx.fillRect(X(R - 0.8), Y(unten - lp - 0.6), 0.8 * s, 1.2 * s);
    }
    ctx.restore();
  };

  BohrSzene.prototype.zeichneFutter = function (ctx, X, Y, s, zFutter, W) {
    var sim = this.sim;
    var cnc = sim.m.cnc;
    var br = cnc ? 16 : 22, hoehe = cnc ? 50 : 46;
    // Bohrfutter bzw. Schrumpffutter
    ctx.fillStyle = metall(ctx, X(-br), X(br), '#cfd5da', '#8e969d', '#4c5258');
    ctx.beginPath();
    ctx.moveTo(X(-br * 0.55), Y(zFutter));
    ctx.lineTo(X(br * 0.55), Y(zFutter));
    ctx.lineTo(X(br), Y(zFutter - hoehe * 0.35));
    ctx.lineTo(X(br), Y(zFutter - hoehe));
    ctx.lineTo(X(-br), Y(zFutter - hoehe));
    ctx.lineTo(X(-br), Y(zFutter - hoehe * 0.35));
    ctx.closePath();
    ctx.fill();
    if (!cnc) {
      // Raendelung, dreht mit
      ctx.save();
      ctx.beginPath();
      ctx.rect(X(-br), Y(zFutter - hoehe * 0.95), 2 * br * s, hoehe * 0.5 * s);
      ctx.clip();
      ctx.strokeStyle = 'rgba(30,34,38,0.5)';
      ctx.lineWidth = 1;
      var k;
      for (k = 0; k < 24; k++) {
        var ph = this.winkel + k * Math.PI * 2 / 24;
        if (Math.sin(ph) < 0) { continue; }
        var xx = X(Math.cos(ph) * br);
        ctx.beginPath();
        ctx.moveTo(xx, Y(zFutter - hoehe * 0.95));
        ctx.lineTo(xx, Y(zFutter - hoehe * 0.45));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Pinole bzw. Spindelnase
    var pw = cnc ? 26 : 15;
    ctx.fillStyle = metall(ctx, X(-pw), X(pw), '#c1c7cc', '#8a9299', '#4e555b');
    ctx.fillRect(X(-pw), 0, 2 * pw * s, Y(zFutter - hoehe) - 0 + 1);
    if (!cnc) {
      // Skala auf der Pinole
      ctx.fillStyle = F.schrift;
      ctx.font = Math.max(9, 2.6 * s) + 'px ' + MONO;
      ctx.textAlign = 'left';
      var mmB = Math.ceil((-zFutter + hoehe) / 5) * 5, mm;
      for (mm = 0; mm < 160; mm += 5) {
        var yPx = Y(zFutter - hoehe - 4 - (mm - (sim.zQ + 10)));
        if (yPx < 0 || yPx > Y(zFutter - hoehe)) { continue; }
        ctx.fillRect(X(pw) - (mm % 10 === 0 ? 8 : 4), yPx, mm % 10 === 0 ? 8 : 4, 1);
      }
      // Gehaeuse des Bohrkopfs
      ctx.fillStyle = metallV(ctx, 0, Y(zFutter - hoehe - 30), F.maschH, F.masch, F.maschD);
      var kopfUnten = Math.min(Y(-Math.max(0, -sim.zQ) - 120), Y(zFutter - hoehe - 32));
      if (kopfUnten > 0) {
        ctx.fillRect(X(-60), 0, 120 * s, kopfUnten);
      }
    } else {
      ctx.fillStyle = metallV(ctx, 0, Y(zFutter - hoehe - 30), '#8796a0', '#5f6d76', '#3d474e');
      var ku = Y(zFutter - hoehe - 20);
      if (ku > 0) { ctx.fillRect(X(-48), 0, 96 * s, ku); }
    }
  };

  BohrSzene.prototype.kss = function (ctx, X, Y, s, dt, a) {
    var sim = this.sim;
    if (!a.kss || sim.p.kss === 'trocken') { return; }
    var art = sim.p.kss;
    var ikz = art === 'ikz' && sim.def.ikz;
    this.kssPhase += dt;
    if (ikz) {
      if (sim.nEff > 10) {
        var aus = sim.z > 0.5 ? Y(-0.5) : Y(sim.z);
        var k;
        for (k = 0; k < 3; k++) {
          this.teile.add({ typ: 'kss', x: X(zufall(-sim.R, sim.R)), y: aus, vx: zufall(-180, 180), vy: -zufall(40, 220), r: zufall(1.2, 2.5), farbe: '#cfe3ea', leben: 0.6, g: 700 });
        }
      }
      return;
    }
    // Duese mit Gelenkschlauch von links oben
    var dx = X(-34), dy = Y(-28);
    ctx.strokeStyle = '#2b6fb3';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(-70), Y(-70));
    ctx.quadraticCurveTo(X(-40), Y(-60), dx, dy);
    ctx.stroke();
    ctx.strokeStyle = '#f39200';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    var farbe = art === 'oel' ? 'rgba(196,150,52,0.75)' : 'rgba(225,236,240,0.55)';
    var zielX = X(-sim.R * 0.6), zielY = Y(Math.max(-2, Math.min(sim.z, 0) - 1));
    ctx.strokeStyle = farbe;
    ctx.lineWidth = art === 'oel' ? 2 : 4;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.quadraticCurveTo((dx + zielX) / 2, dy - 4, zielX, zielY);
    ctx.stroke();
    if (Math.random() < (art === 'oel' ? 0.3 : 0.9)) {
      this.teile.add({ typ: 'kss', x: zielX, y: zielY, vx: zufall(-80, 120), vy: -zufall(0, 80), r: zufall(1.5, 3), farbe: art === 'oel' ? '#c49634' : '#dfeaee', leben: 0.5 });
    }
  };

  BohrSzene.prototype.skala = function (ctx, X, Y, s, xl, dickeSicht) {
    ctx.fillStyle = F.schriftD;
    ctx.strokeStyle = F.schriftD;
    ctx.font = '10px ' + MONO;
    ctx.textAlign = 'right';
    var mm, schritt = s > 6 ? 2 : 5;
    var x = xl - 30 * s / 6 - 4;
    for (mm = 0; mm <= dickeSicht; mm += schritt) {
      ctx.fillRect(x, Y(mm), mm % 10 === 0 ? 7 : 4, 1);
      if (mm % 10 === 0) { ctx.fillText(String(mm), x - 2, Y(mm) + 3); }
    }
    // Tiefenanschlag
    var za = this.sim.p.zAnschlag;
    if (za !== null && za !== undefined && za <= dickeSicht + 10 && !this.sim.m.cnc) {
      ctx.fillStyle = F.gelb;
      ctx.beginPath();
      ctx.moveTo(x + 8, Y(za));
      ctx.lineTo(x + 15, Y(za) - 4);
      ctx.lineTo(x + 15, Y(za) + 4);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  };

  BohrSzene.prototype.karte = function (ctx, W, H) {
    var sim = this.sim, op = this.op;
    if (!op.pos || op.pos.length < 2) { return; }
    var B = 0, Hh = 0;
    op.pos.forEach(function (p) { B = Math.max(B, p[0]); Hh = Math.max(Hh, p[1]); });
    B += 15; Hh += 15;
    var kw = 120, kh = Math.max(40, Math.min(90, kw * Hh / B));
    var x0 = W - kw - 12, y0 = 12;
    ctx.fillStyle = 'rgba(10,12,13,0.7)';
    ctx.fillRect(x0 - 6, y0 - 6, kw + 12, kh + 26);
    ctx.strokeStyle = F.schriftD;
    ctx.strokeRect(x0, y0, kw, kh);
    op.pos.forEach(function (p, i) {
      var px = x0 + p[0] / B * kw, py = y0 + kh - p[1] / Hh * kh;
      var e = sim.ergebnisse[i];
      ctx.fillStyle = i === sim.idx && !sim.fertig ? F.gelb : e ? (e.defekt ? F.rot : '#4cc38a') : '#59636a';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, 6.283);
      ctx.fill();
    });
    ctx.fillStyle = F.schrift;
    ctx.font = '12px ' + SCHRIFT;
    ctx.fillText('Bohrung ' + Math.min(sim.idx + 1, op.pos.length) + ' / ' + op.pos.length, x0, y0 + kh + 15);
  };

  // =====================================================================
  //                               DREHEN
  // =====================================================================
  function DrehSzene(sim) {
    this.sim = sim;
    this.teile = new Partikelsystem(380);
    this.winkel = 0;
    this.schuettel = 0;
    this.blitz = 0;
    this.flecken = [];
    var i;
    for (i = 0; i < 160; i++) { this.flecken.push({ z: Math.random(), ph: Math.random() * 6.283, g: zufall(0.6, 2.2) }); }
    this.wirrPunkte = [];
    this.messAnzeige = null;
  }

  DrehSzene.prototype.ereignis = function (e) {
    if (e.typ === 'bruch' || e.typ === 'kollision') { this.schuettel = e.typ === 'kollision' ? 0.9 : 0.4; this.blitz = 0.6; this.funken = 26; }
    if (e.typ === 'unfall') { this.schuettel = 1; this.blitz = 1; }
  };

  DrehSzene.prototype.messung = function (z) { this.messAnzeige = { z: z, t: 2.5 }; };

  DrehSzene.prototype.zeichne = function (cv, dt, a) {
    var r = resize(cv), ctx = r.ctx, W = r.w, H = r.h;
    var sim = this.sim, mat = sim.mat, w = sim.w, def = sim.def;
    var L = sim.L, D0 = sim.D0;
    this.winkel += sim.nEff / 60 * Math.PI * 2 * dt;
    var links = 58, rechts = sim.reitstock ? 62 : 34;
    var s = Math.min(W * 0.94 / (L + links + rechts), H * 0.6 / (D0 + 32));
    var Z0 = W * 0.02 + links * s;
    var C = H * 0.38;
    var sx = this.schuettel > 0 ? zufall(-1, 1) * this.schuettel * 10 : 0;
    this.schuettel = Math.max(0, this.schuettel - dt);
    function Z(mm) { return Z0 + mm * s; }
    function Yr(mm) { return C + mm * s; }

    hintergrund(ctx, W, H);
    ctx.save();
    ctx.translate(sx, 0);

    // Drehmaschinenbett mit Fuehrungsbahnen
    var bettY = C + (D0 / 2 + 22) * s;
    ctx.fillStyle = metallV(ctx, bettY, H, '#6e8378', F.masch, F.maschD);
    ctx.fillRect(0, bettY, W, H - bettY);
    ctx.fillStyle = 'rgba(210,220,215,0.35)';
    ctx.fillRect(0, bettY + 6, W, 3);
    ctx.fillRect(0, H - 34, W, 3);
    // Zugspindel
    var zsY = H - 18;
    ctx.fillStyle = '#9aa2a9';
    ctx.fillRect(0, zsY - 4, W, 8);
    ctx.strokeStyle = 'rgba(40,44,48,0.6)';
    var ph = (a.vorschub ? this.winkel * 0.2 : this.zsPhase || 0) % 1;
    this.zsPhase = ph;
    var xx;
    for (xx = -20 + (ph * 10); xx < W; xx += 10) {
      ctx.beginPath();
      ctx.moveTo(xx, zsY - 4);
      ctx.lineTo(xx + 4, zsY + 4);
      ctx.stroke();
    }

    // Spindelkasten und Futter
    ctx.fillStyle = metallV(ctx, 0, bettY, F.maschH, F.masch, F.maschD);
    ctx.fillRect(0, 0, Z(-46), bettY);
    var fR = ZM.daten.maschinen.drehKonv.futter.D / 2;
    var fRs = Math.min(fR * s, C - 6);
    ctx.fillStyle = metallV(ctx, C - fRs, C + fRs, '#c9cfd4', '#8b939a', '#3f454b');
    ctx.fillRect(Z(-46), C - fRs, 26 * s, 2 * fRs);
    // ----------------------------------------------- Werkstueck
    var i, N = sim.N;
    var schritt = Math.max(1, Math.floor(N / 500));
    ctx.beginPath();
    ctx.moveTo(Z(-20), Yr(-D0 / 2));
    for (i = 0; i < N; i += schritt) { ctx.lineTo(Z(i * PH.DZ), Yr(-sim.D[i] / 2)); }
    ctx.lineTo(Z(L), Yr(-sim.D[N - 1] / 2));
    ctx.lineTo(Z(L), Yr(sim.D[N - 1] / 2));
    for (i = N - 1; i >= 0; i -= schritt) { ctx.lineTo(Z(i * PH.DZ), Yr(sim.D[i] / 2)); }
    ctx.lineTo(Z(-20), Yr(D0 / 2));
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, Yr(-D0 / 2), 0, Yr(D0 / 2));
    grad.addColorStop(0, '#41474d');
    grad.addColorStop(0.22, mischFarbe(mat.farbe, '#ffffff', 0.45));
    grad.addColorStop(0.45, mat.farbe);
    grad.addColorStop(1, '#2a2f34');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Rohoberflaeche (Walzhaut) und drehende Flecken
    var roh0 = -1, z0;
    ctx.fillStyle = mat.roh;
    ctx.globalAlpha = 0.85;
    for (i = 0; i <= N; i++) {
      var istRoh = i < N && !sim.bearb[i];
      if (istRoh && roh0 < 0) { roh0 = i; }
      if ((!istRoh || i === N) && roh0 >= 0) {
        z0 = roh0 * PH.DZ;
        ctx.fillRect(Z(z0), Yr(-D0 / 2 - 1), (i - roh0) * PH.DZ * s, (D0 + 2) * s);
        roh0 = -1;
      }
    }
    ctx.fillRect(Z(-20), Yr(-D0 / 2 - 1), 20 * s, (D0 + 2) * s);
    ctx.globalAlpha = 1;
    var hl = ctx.createLinearGradient(0, Yr(-D0 / 2), 0, Yr(D0 / 2));
    hl.addColorStop(0, 'rgba(0,0,0,0.45)');
    hl.addColorStop(0.25, 'rgba(255,255,255,0.18)');
    hl.addColorStop(0.5, 'rgba(255,255,255,0)');
    hl.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = hl;
    ctx.fillRect(Z(-20), Yr(-D0 / 2), (L + 20) * s, D0 * s);
    for (i = 0; i < this.flecken.length; i++) {
      var f = this.flecken[i];
      var zz = f.z * L;
      var iz = sim.idx(zz);
      var rr = sim.D[iz] / 2;
      var pw = f.ph + this.winkel;
      var sv = Math.sin(pw);
      if (sv < 0.1) { continue; }
      ctx.fillStyle = sim.bearb[iz] ? 'rgba(255,255,255,' + (0.08 * sv).toFixed(3) + ')' : 'rgba(10,12,14,' + (0.35 * sv).toFixed(3) + ')';
      ctx.fillRect(Z(zz), Yr(Math.cos(pw) * rr) - f.g, f.g * 2.2 * s / 3 + 1, f.g * sv);
    }
    // Rattermarken
    ctx.strokeStyle = 'rgba(20,22,25,0.35)';
    ctx.lineWidth = 1;
    for (i = 0; i < N; i += 2) {
      if (sim.ratter[i] > 3) {
        ctx.beginPath();
        ctx.moveTo(Z(i * PH.DZ), Yr(-sim.D[i] / 2));
        ctx.lineTo(Z(i * PH.DZ), Yr(sim.D[i] / 2));
        ctx.stroke();
      }
    }
    ctx.restore();
    // Backen (drei, 120 Grad versetzt)
    var bH = ZM.daten.maschinen.drehKonv.futter.backenH;
    var k;
    for (k = 0; k < 3; k++) {
      var wk = this.winkel + k * Math.PI * 2 / 3;
      var sn = Math.sin(wk);
      if (sn < -0.2) { continue; }
      var yb = Math.cos(wk) * (D0 / 2 + bH / 2);
      var hb = (bH + 4) * Math.max(0.35, Math.abs(Math.cos(wk)) * 0.4 + 0.6);
      ctx.fillStyle = mischFarbe('#3a4046', '#9aa2a9', clamp(sn, 0, 1));
      ctx.fillRect(Z(-20), Yr(yb - hb / 2), 20 * s, hb * s);
    }

    // Mittellinie
    ctx.strokeStyle = 'rgba(242,177,0,0.35)';
    ctx.setLineDash([16, 4, 3, 4]);
    ctx.beginPath();
    ctx.moveTo(Z(-40), C);
    ctx.lineTo(Z(L + 50), C);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reitstock
    if (sim.reitstock) {
      ctx.fillStyle = metall(ctx, 0, 0, '#b8bfc5', '#8e969d', '#596066');
      ctx.fillStyle = '#9aa2a9';
      ctx.beginPath();
      ctx.moveTo(Z(L - 3), C);
      ctx.lineTo(Z(L + 8), Yr(-6));
      ctx.lineTo(Z(L + 8), Yr(6));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = metallV(ctx, Yr(-14), Yr(14), '#c9cfd4', '#8e969d', '#4c5258');
      ctx.fillRect(Z(L + 8), Yr(-14), 30 * s, 28 * s);
      ctx.fillStyle = metallV(ctx, Yr(-40), bettY, F.maschH, F.masch, F.maschD);
      ctx.fillRect(Z(L + 38), Yr(-40), W, bettY - Yr(-40));
    }

    // ----------------------------------------------- Werkzeug
    var tz = sim.z, tx = sim.x;
    var xs = Z(tz), ys = Yr(tx);
    var amp = sim.amp / 1000 * s * 20;
    var jit = amp > 0.2 ? zufall(-amp, amp) : 0;
    ys += jit;
    // Bettschlitten und Planschlitten
    ctx.fillStyle = metallV(ctx, ys + 24 * s, bettY + 30, F.maschH, F.masch, F.maschD);
    ctx.fillRect(xs - 50 * s, Math.max(ys + 26 * s, C + 4), 100 * s, H);
    // Klemmhalter
    ctx.fillStyle = metall(ctx, xs - 2 * s, xs + 20 * s, '#7d858c', '#5b6268', '#3a4045');
    ctx.fillRect(xs - 2 * s, ys + 3 * s, 20 * s, H);
    // Wendeschneidplatte
    var spitz = def.form === 'D' ? 55 : def.form === 'V' ? 35 : 80;
    var lp = (def.form === 'V' ? 16 : def.form === 'D' ? 15 : 12) * s;
    var plattenFarbe = def.stoff === 'HMPOL' ? '#c6ccd2' : '#23242a';
    ctx.save();
    ctx.translate(xs, ys);
    ctx.rotate(-(95 - 90) * Math.PI / 180);
    var hw = lp * Math.tan(spitz / 2 * Math.PI / 180);
    ctx.fillStyle = plattenFarbe;
    ctx.beginPath();
    if (w.gebrochen) {
      ctx.moveTo(2 * s, 2 * s);
      ctx.lineTo(lp * 0.6, -hw * 0.2 + lp * 0.5);
      ctx.lineTo(lp * 0.4, lp * 0.9);
      ctx.lineTo(-hw * 0.2, lp);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(lp * 0.75, lp * 0.3);
      ctx.lineTo(lp * 0.6, lp);
      ctx.lineTo(-hw * 0.3, lp * 0.8);
    }
    ctx.closePath();
    ctx.fill();
    if (def.stoff === 'HMCVD') {
      ctx.strokeStyle = 'rgba(214,170,60,0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    var gl = gluehen(w.T);
    if (gl) {
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(0, 0, 3 * s, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();

    // ----------------------------------------------- Spaene
    var schneidet = sim.ap > 0.005 && sim.nEff > 5 && sim.f > 0;
    if (schneidet) {
      var rate = clamp(sim.ap * sim.f * sim.vc * 0.25, 4, 90);
      var form = sim.spanForm;
      var n = rate * dt;
      while (n > 0) {
        if (Math.random() < n) {
          var typ = form === 'kurz' ? 'locke' : form === 'band' ? 'band' : form === 'broeckel' ? (mat.id === 'GJL250' ? 'staub' : 'broeckel') : form === 'gestaucht' ? 'dick' : 'locke';
          this.teile.add({
            typ: typ, x: xs, y: ys - 2, vx: zufall(-120, 160), vy: zufall(-40, 260),
            r: typ === 'staub' ? 1.4 : clamp(sim.f * 18 * s / 3 + 2, 2, 8), len: zufall(10, 30), lenMax: 60,
            farbe: spanFarbe(mat, w.T), leben: 3, bleibt: typ !== 'staub', g: 700
          });
        }
        n -= 1;
      }
      if (w.T > 600 && Math.random() < dt * 4) {
        this.teile.add({ typ: 'rauch', x: xs, y: ys - 3, vx: zufall(-10, 10), vy: -zufall(20, 40), g: -10, r: zufall(3, 6), leben: 1.8, alpha: 0.2 });
      }
    }
    if (this.funken) {
      for (k = 0; k < this.funken; k++) {
        this.teile.add({ typ: 'funke', x: xs, y: ys, vx: zufall(-600, 600), vy: zufall(-400, 300), farbe: '#ffcf70', leben: 0.4, g: 500 });
      }
      this.funken = 0;
    }
    // Wirrspaene um den Halter
    if (sim.wirr > 0.3) {
      var anz = Math.min(40, Math.round(sim.wirr * 16));
      while (this.wirrPunkte.length < anz) {
        this.wirrPunkte.push({ dx: zufall(-30, 30), dy: zufall(-8, 30), r: zufall(4, 14), a: zufall(0, 6.28) });
      }
      ctx.strokeStyle = spanFarbe(mat, w.T * 0.8);
      ctx.lineWidth = 1.2;
      this.wirrPunkte.slice(0, anz).forEach(function (p) {
        ctx.beginPath();
        ctx.ellipse(xs + p.dx * s / 2, ys + p.dy * s / 2, p.r * s / 2, p.r * s / 5, p.a, 0, 6.283);
        ctx.stroke();
      });
    } else {
      this.wirrPunkte = [];
    }
    // KSS
    if (a.kss && sim.p.kss !== 'trocken') {
      var dx = xs + 40 * s, dyy = C - (D0 / 2 + 30) * s;
      ctx.strokeStyle = '#2b6fb3';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dx + 60, dyy - 50);
      ctx.quadraticCurveTo(dx + 20, dyy - 30, dx, dyy);
      ctx.stroke();
      ctx.strokeStyle = '#f39200';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(225,236,240,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dx, dyy);
      ctx.quadraticCurveTo(xs + 10 * s, dyy, xs + 2, ys - 4);
      ctx.stroke();
      if (Math.random() < 0.8) { this.teile.add({ typ: 'kss', x: xs, y: ys - 2, vx: zufall(-80, 80), vy: zufall(-60, 60), r: zufall(1.5, 3), farbe: '#dfeaee', leben: 0.4 }); }
    }

    this.teile.update(dt, function () { return bettY + 4; }, 700);
    for (i = 0; i < this.teile.liegen.length; i++) { zeichneSpan(ctx, this.teile.liegen[i], 1); }
    for (i = 0; i < this.teile.p.length; i++) { zeichneSpan(ctx, this.teile.p[i], 1); }

    // Laengsanschlag
    var za = sim.p.zAnschlag;
    if (za !== null && za !== undefined) {
      ctx.fillStyle = F.gelb;
      ctx.fillRect(Z(za) - 3, bettY - 2, 6, 14);
      ctx.fillStyle = F.schrift;
      ctx.font = '11px ' + SCHRIFT;
      ctx.fillText('Anschlag', Z(za) + 5, bettY + 11);
    }
    // Messschraube
    if (this.messAnzeige && this.messAnzeige.t > 0) {
      var mz = Z(this.messAnzeige.z), dm = sim.D[sim.idx(this.messAnzeige.z)];
      ctx.strokeStyle = F.gelb;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mz, Yr(-dm / 2) - 4);
      ctx.lineTo(mz, Yr(-dm / 2) - 30);
      ctx.lineTo(mz + 40, Yr(-dm / 2) - 30);
      ctx.lineTo(mz + 40, Yr(dm / 2) + 30);
      ctx.lineTo(mz, Yr(dm / 2) + 30);
      ctx.lineTo(mz, Yr(dm / 2) + 4);
      ctx.stroke();
      this.messAnzeige.t -= dt;
    }
    // Massstab z
    ctx.fillStyle = F.schriftD;
    ctx.font = '10px ' + MONO;
    var mm;
    for (mm = 0; mm <= L; mm += 10) {
      ctx.fillRect(Z(mm), 8, 1, mm % 50 === 0 ? 8 : 4);
      if (mm % 50 === 0) { ctx.fillText(String(mm), Z(mm) + 2, 24); }
    }
    ctx.restore();
    if (this.blitz > 0) {
      ctx.fillStyle = 'rgba(217,45,32,' + (this.blitz * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 1.5);
    }
  };

  // =====================================================================
  //                               FRAESEN
  // =====================================================================
  function FraesSzene(sim) {
    this.sim = sim;
    this.teile = new Partikelsystem(300);
    this.winkel = 0;
    this.schuettel = 0;
    this.blitz = 0;
    this.karte = document.createElement('canvas');
    this.karte.width = sim.NX;
    this.karte.height = sim.NY;
    this.kctx = this.karte.getContext('2d');
    this.bild = this.kctx.createImageData(sim.NX, sim.NY);
    this.tKarte = 0;
  }

  FraesSzene.prototype.ereignis = function (e) {
    if (e.typ === 'bruch') { this.schuettel = 0.4; this.blitz = 0.6; this.funken = 22; }
    if (e.typ === 'unfall') { this.schuettel = 1; this.blitz = 1; }
  };

  FraesSzene.prototype.aktualisiereKarte = function () {
    var sim = this.sim, d = this.bild.data, NX = sim.NX, NY = sim.NY;
    var mat = sim.mat;
    var hex = function (c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; };
    var roh = hex(mat.roh), blank = hex(mat.farbe);
    var ix, iy, tMax = 0.5;
    for (ix = 0; ix < NX * NY; ix++) { if (sim.tiefe[ix] > tMax) { tMax = sim.tiefe[ix]; } }
    for (ix = 0; ix < NX; ix++) {
      for (iy = 0; iy < NY; iy++) {
        var t = sim.tiefe[ix * NY + iy];
        var p = ((NY - 1 - iy) * NX + ix) * 4;
        if (t < 0.01) {
          d[p] = roh[0]; d[p + 1] = roh[1]; d[p + 2] = roh[2];
        } else {
          var k = 1.12 - 0.55 * (t / Math.max(tMax, sim.H * 0.6));
          var riefen = (ix % 3 === 0) ? 0.93 : 1;
          d[p] = clamp(blank[0] * k * riefen, 0, 255);
          d[p + 1] = clamp(blank[1] * k * riefen, 0, 255);
          d[p + 2] = clamp(blank[2] * k * riefen, 0, 255);
        }
        d[p + 3] = 255;
      }
    }
    this.kctx.putImageData(this.bild, 0, 0);
  };

  FraesSzene.prototype.zeichne = function (cv, dt, a) {
    var r = resize(cv), ctx = r.ctx, W = r.w, H = r.h;
    var sim = this.sim, mat = sim.mat, w = sim.w, def = sim.def;
    var L = sim.L, B = sim.B, R = sim.R;
    this.winkel += sim.nEff / 60 * Math.PI * 2 * dt;
    var breitBild = W > 760;
    var s = breitBild ? Math.min(W * 0.6 / (L + 46), H * 0.84 / (B + 56)) : Math.min(W * 0.9 / (L + 46), H * 0.6 / (B + 56));
    var X0 = breitBild ? W * 0.05 + 23 * s : (W - L * s) / 2;
    var Y0 = (breitBild ? H * 0.06 : H * 0.04) + (B + 30) * s;
    var sx = this.schuettel > 0 ? zufall(-1, 1) * this.schuettel * 8 : 0;
    this.schuettel = Math.max(0, this.schuettel - dt);
    function X(mm) { return X0 + mm * s; }
    function Y(mm) { return Y0 - mm * s; }

    hintergrund(ctx, W, H);
    ctx.save();
    ctx.translate(sx, 0);
    // Maschinentisch mit T-Nuten
    ctx.fillStyle = metallV(ctx, Y(B + 30), Y(-30), '#7a8a82', F.masch, F.maschD);
    ctx.fillRect(0, Y(B + 34), W, (B + 68) * s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    var tn;
    for (tn = -1; tn <= 3; tn++) { ctx.fillRect(0, Y(tn * (B + 20) / 3) - 3, W, 6); }
    // Schraubstock: feste Backe oben, bewegliche unten
    ctx.fillStyle = metallV(ctx, Y(B + 22), Y(B), '#8a9198', '#61686f', '#3c4146');
    ctx.fillRect(X(-12), Y(B + 22), (L + 24) * s, 22 * s);
    ctx.fillStyle = metallV(ctx, Y(0), Y(-22), '#8a9198', '#61686f', '#3c4146');
    ctx.fillRect(X(-12), Y(0), (L + 24) * s, 22 * s);
    // Werkstueck (Hoehenkarte)
    this.tKarte -= dt;
    if (this.tKarte <= 0) { this.aktualisiereKarte(); this.tKarte = 0.08; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.karte, X(0), Y(B), L * s, B * s);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(0), Y(B), L * s, B * s);

    // Fraeser
    var amp = sim.amp / 1000 * s * 25;
    var jx = amp > 0.2 ? zufall(-amp, amp) : 0, jy = amp > 0.2 ? zufall(-amp, amp) : 0;
    var tx = X(sim.x) + jx, ty = Y(sim.y) + jy;
    var stoff = ZM.daten.schneidstoffe[def.stoff];
    // Spannzange/Schrumpffutter angedeutet
    ctx.fillStyle = 'rgba(160,168,175,0.18)';
    ctx.beginPath();
    ctx.arc(tx, ty, (R + 8) * s, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = w.gebrochen ? '#3a3f44' : stoff.farbe;
    ctx.beginPath();
    ctx.arc(tx, ty, R * s, 0, 6.283);
    ctx.fill();
    if (!w.gebrochen) {
      ctx.strokeStyle = 'rgba(15,17,19,0.7)';
      ctx.lineWidth = Math.max(1.5, R * s * 0.12);
      var k;
      for (k = 0; k < def.z; k++) {
        var wk = -this.winkel + k * Math.PI * 2 / def.z;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(wk) * R * s * 0.45, ty + Math.sin(wk) * R * s * 0.45, R * s * 0.55, wk - 1.4, wk + 0.4);
        ctx.stroke();
      }
      if (w.aufschweiss > 0.3) {
        ctx.fillStyle = 'rgba(230,234,238,' + clamp(w.aufschweiss * 0.4, 0, 0.7).toFixed(2) + ')';
        for (k = 0; k < def.z; k++) {
          var wk2 = -this.winkel + k * Math.PI * 2 / def.z + 0.6;
          ctx.beginPath();
          ctx.arc(tx + Math.cos(wk2) * R * s * 0.6, ty + Math.sin(wk2) * R * s * 0.6, R * s * 0.22, 0, 6.283);
          ctx.fill();
        }
      }
      var gl = gluehen(w.T);
      if (gl) {
        ctx.strokeStyle = gl;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tx, ty, R * s, 0, 6.283);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = '#b8bec4';
      ctx.beginPath();
      ctx.moveTo(tx - R * s * 0.7, ty - R * s * 0.2);
      ctx.lineTo(tx - R * s * 0.1, ty + R * s * 0.4);
      ctx.lineTo(tx + R * s * 0.5, ty - R * s * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#20252a';
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2, R * s * 0.12), 0, 6.283);
    ctx.fill();

    // Spaene: tangential an der Eingriffsseite
    var schneidet = sim.apE > 0.01 && sim.ae > 0.01 && sim.nEff > 5;
    if (schneidet) {
      var rate = clamp(sim.apE * sim.ae * (sim.fz * def.z * sim.nEff) / 600, 6, 120);
      var n = rate * dt;
      var typ = spanTyp(mat) === 'band' ? 'locke' : spanTyp(mat);
      while (n > 0) {
        if (Math.random() < n) {
          var ang = ((sim.p.richtung || 1) > 0 ? 0 : Math.PI) + zufall(-1.5, 1.5);
          var px = tx + Math.cos(ang) * R * s, py = ty + Math.sin(ang) * R * s;
          var tang = ang + Math.PI / 2;
          var v = zufall(150, 380);
          this.teile.add({ typ: typ, x: px, y: py, vx: Math.cos(tang) * v, vy: Math.sin(tang) * v, r: clamp(sim.fz * 60 + 1.5, 1.5, 5), len: 10, farbe: spanFarbe(mat, w.T), leben: 1.2, g: 0, luft: 2.5, bleibt: false });
        }
        n -= 1;
      }
    }
    if (this.funken) {
      var fi;
      for (fi = 0; fi < this.funken; fi++) { this.teile.add({ typ: 'funke', x: tx, y: ty, vx: zufall(-600, 600), vy: zufall(-600, 600), farbe: '#ffcf70', leben: 0.4, g: 0 }); }
      this.funken = 0;
    }
    if (a.kss && sim.p.kss !== 'trocken') {
      if (sim.p.kss === 'ikz') {
        if (sim.nEff > 10 && Math.random() < 0.9) { this.teile.add({ typ: 'kss', x: tx, y: ty, vx: zufall(-200, 200), vy: zufall(-200, 200), r: 2, farbe: '#dfeaee', leben: 0.4, g: 0, luft: 3 }); }
      } else {
        ctx.strokeStyle = '#2b6fb3';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx - 90, ty - 80);
        ctx.quadraticCurveTo(tx - 60, ty - 70, tx - 34, ty - 34);
        ctx.stroke();
        ctx.strokeStyle = '#f39200';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(225,236,240,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tx - 34, ty - 34);
        ctx.lineTo(tx - R * s * 0.7, ty - R * s * 0.7);
        ctx.stroke();
      }
    }
    this.teile.update(dt, null, 0);
    var i;
    for (i = 0; i < this.teile.p.length; i++) { zeichneSpan(ctx, this.teile.p[i], 1); }
    ctx.restore();

    this.seitenansicht(ctx, W, H);
    if (this.blitz > 0) {
      ctx.fillStyle = 'rgba(217,45,32,' + (this.blitz * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      this.blitz = Math.max(0, this.blitz - dt * 1.5);
    }
  };

  // Seitenansicht: Schnitt in Fraeserachse entlang X
  // Seitenansicht in X-Z, nicht massstaeblich: X und Z getrennt skaliert
  FraesSzene.prototype.seitenansicht = function (ctx, W, H) {
    var sim = this.sim, def = sim.def;
    var L = sim.L, Hw = sim.H;
    var breitBild = W > 760;
    var bw = breitBild ? Math.min(W * 0.3, 340) : Math.min(W - 24, 420);
    var bh = breitBild ? Math.min(H * 0.42, 210) : Math.min(H * 0.3, 150);
    var x0 = breitBild ? W - bw - 12 : 12, y0 = breitBild ? 12 : H - bh - 12;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,13,0.82)';
    ctx.fillRect(x0, y0, bw, bh);
    ctx.strokeStyle = 'rgba(140,150,146,0.5)';
    ctx.strokeRect(x0, y0, bw, bh);
    ctx.beginPath();
    ctx.rect(x0 + 1, y0 + 18, bw - 2, bh - 19);
    ctx.clip();
    var sichtH = Math.min(Hw, Math.max(def.lc, 20)) + 6;
    var sx = (bw - 30) / (L + 2 * def.d + 16);
    var sz = (bh - 28) / (sichtH + def.lc + 14);
    var ox = x0 + 15 + (def.d + 8) * sx, oy = y0 + 22 + (def.lc + 12) * sz;
    var iy = clamp(Math.floor(sim.y / PH.FY), 0, sim.NY - 1);
    ctx.fillStyle = sim.mat.farbe;
    ctx.beginPath();
    ctx.moveTo(ox, oy + sichtH * sz);
    var ix;
    for (ix = 0; ix < sim.NX; ix++) { ctx.lineTo(ox + ix * PH.FX * sx, oy + Math.min(sichtH, sim.tiefe[ix * sim.NY + iy]) * sz); }
    ctx.lineTo(ox + L * sx, oy + sichtH * sz);
    ctx.closePath();
    ctx.fill();
    schraffur(ctx, ox, oy, L * sx, sichtH * sz, 6, 'rgba(20,24,28,0.25)');
    var fx = ox + sim.x * sx, fz = oy + (sim.zT + sim.auszug) * sz;
    if (!sim.w.gebrochen) {
      ctx.fillStyle = ZM.daten.schneidstoffe[def.stoff].farbe;
      ctx.fillRect(fx - def.d / 2 * sx, fz - def.lc * sz, def.d * sx, def.lc * sz);
      ctx.strokeStyle = 'rgba(10,12,14,0.6)';
      var k;
      for (k = 1; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(fx - def.d / 2 * sx, fz - def.lc * sz * k / 5 + 4);
        ctx.lineTo(fx + def.d / 2 * sx, fz - def.lc * sz * k / 5 - 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#b4bbc1';
      ctx.fillRect(fx - def.d / 2 * sx, fz - (sim.auskrag + 6) * sz, def.d * sx, (sim.auskrag - def.lc + 6) * sz);
      ctx.fillStyle = '#6f777e';
      ctx.fillRect(fx - (def.d / 2 + 8) * sx, fz - (sim.auskrag + 30) * sz, (def.d + 16) * sx, 24 * sz);
    }
    ctx.restore();
    ctx.fillStyle = F.schrift;
    ctx.font = '11px ' + SCHRIFT;
    ctx.fillText('Seitenansicht, nicht maßstäblich', x0 + 8, y0 + 13);
    ctx.fillStyle = F.gelb;
    ctx.font = '11px ' + MONO;
    ctx.textAlign = 'right';
    ctx.fillText('ap ' + (sim.zT + sim.auszug).toFixed(2) + ' mm', x0 + bw - 8, y0 + 13);
    ctx.textAlign = 'left';
  };

  ZM.szenen = {
    BohrSzene: BohrSzene, DrehSzene: DrehSzene, FraesSzene: FraesSzene, resize: resize,
    // Gemeinsame Helfer fuer die Szenen in eigenen Dateien (szene-dreh.js, szene-fraes.js)
    hilfen: {
      F: F, SCHRIFT: SCHRIFT, MONO: MONO, clamp: clamp, zufall: zufall, Partikelsystem: Partikelsystem,
      zeichneSpan: zeichneSpan, spanFarbe: spanFarbe, spanTyp: spanTyp, resize: resize, hintergrund: hintergrund,
      metall: metall, metallV: metallV, schraffur: schraffur, mischFarbe: mischFarbe, gluehen: gluehen
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
