/*
 * Technische Zeichnungen fuer die Auftraege (Canvas).
 *
 * Projektionsmethode 1 (Europa): Seitenansicht von links steht rechts
 * neben der Hauptansicht. Linienarten nach ISO 128: breite Volllinie fuer
 * sichtbare Kanten, schmale Strichlinie fuer verdeckte Kanten,
 * Strich-Punkt-Linie fuer Mittellinien. Schriftfeld nach ISO 7200.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  var SCHRIFT = "'Barlow Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif";
  var BW = 1000, BH = 680;

  function fmt(v) { return ZM.daten.fmtD(v); }

  function Blatt(cv) {
    var dpr = root.devicePixelRatio || 1;
    var w = cv.clientWidth || 800;
    var h = Math.round(w * BH / BW);
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.ctx = cv.getContext('2d');
    this.k = w * dpr / BW;
    this.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.farbe = '#15181c';
  }

  Blatt.prototype.stil = function (art) {
    var c = this.ctx;
    c.strokeStyle = this.farbe;
    c.setLineDash([]);
    switch (art) {
      case 'dick': c.lineWidth = 1.8; break;
      case 'mitte': c.lineWidth = 0.6; c.setLineDash([14, 3, 2, 3]); break;
      case 'verdeckt': c.lineWidth = 0.8; c.setLineDash([5, 3]); break;
      case 'roh': c.lineWidth = 0.6; c.setLineDash([10, 3, 2, 3, 2, 3]); break;
      default: c.lineWidth = 0.6;
    }
  };

  Blatt.prototype.linie = function (x1, y1, x2, y2, art) {
    var c = this.ctx;
    this.stil(art);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };

  Blatt.prototype.rechteck = function (x, y, w, h, art) {
    this.stil(art);
    this.ctx.strokeRect(x, y, w, h);
  };

  Blatt.prototype.kreis = function (x, y, r, art) {
    var c = this.ctx;
    this.stil(art);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  };

  Blatt.prototype.bogen = function (x, y, r, a0, a1, art) {
    var c = this.ctx;
    this.stil(art);
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
  };

  Blatt.prototype.text = function (t, x, y, gr, ausr, basis, winkel) {
    var c = this.ctx;
    c.save();
    c.fillStyle = this.farbe;
    c.font = (gr || 13) + 'px ' + SCHRIFT;
    c.textAlign = ausr || 'left';
    c.textBaseline = basis || 'alphabetic';
    c.translate(x, y);
    if (winkel) { c.rotate(winkel); }
    c.fillText(t, 0, 0);
    c.restore();
  };

  Blatt.prototype.pfeil = function (x, y, winkel) {
    var c = this.ctx, l = 8, b = 2.2;
    c.save();
    c.translate(x, y);
    c.rotate(winkel);
    c.fillStyle = this.farbe;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-l, -b);
    c.lineTo(-l, b);
    c.closePath();
    c.fill();
    c.restore();
  };

  // Mass zwischen zwei Punkten, parallel versetzt um "ab" (senkrecht zur Masslinie)
  Blatt.prototype.mass = function (x1, y1, x2, y2, ab, txt, gr) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) { return; }
    var nx = -dy / len, ny = dx / len;
    var ax = x1 + nx * ab, ay = y1 + ny * ab, bx = x2 + nx * ab, by = y2 + ny * ab;
    var ue = ab > 0 ? 3 : -3;
    this.linie(x1 + nx * 2 * Math.sign(ab), y1 + ny * 2 * Math.sign(ab), ax + nx * ue, ay + ny * ue, 'duenn');
    this.linie(x2 + nx * 2 * Math.sign(ab), y2 + ny * 2 * Math.sign(ab), bx + nx * ue, by + ny * ue, 'duenn');
    var w = Math.atan2(by - ay, bx - ax);
    var eng = len < 26;
    if (eng) {
      this.linie(ax - Math.cos(w) * 14, ay - Math.sin(w) * 14, bx + Math.cos(w) * 14, by + Math.sin(w) * 14, 'duenn');
      this.pfeil(ax, ay, w);
      this.pfeil(bx, by, w + Math.PI);
    } else {
      this.linie(ax, ay, bx, by, 'duenn');
      this.pfeil(ax, ay, w + Math.PI);
      this.pfeil(bx, by, w);
    }
    var mx = (ax + bx) / 2, my = (ay + by) / 2;
    var tw = w;
    if (tw > Math.PI / 2 + 0.01 || tw < -Math.PI / 2 - 0.01) { tw += Math.PI; }
    var off = -3;
    this.text(txt, mx + Math.sin(tw) * -off, my - Math.cos(tw) * -off - 0, gr || 13, 'center', 'bottom', tw);
  };

  // Hinweislinie mit Text
  Blatt.prototype.hinweis = function (x, y, x2, y2, txt) {
    this.linie(x, y, x2, y2, 'duenn');
    var c = this.ctx;
    c.font = '13px ' + SCHRIFT;
    var w = c.measureText(txt).width + 4;
    var rechts = x2 >= x;
    this.linie(x2, y2, rechts ? x2 + w : x2 - w, y2, 'duenn');
    this.text(txt, rechts ? x2 + 2 : x2 - w + 2, y2 - 3, 13);
    var wi = Math.atan2(y - y2, x - x2);
    this.ctx.fillStyle = this.farbe;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    this.ctx.fill();
    return wi;
  };

  // Oberflaechenzeichen (ISO 21920-1): Haken mit Querstrich und Kenngroesse
  Blatt.prototype.rauheit = function (x, y, ra) {
    var c = this.ctx;
    this.stil('duenn');
    c.beginPath();
    c.moveTo(x - 6, y - 7);
    c.lineTo(x, y);
    c.lineTo(x + 12, y - 20);
    c.lineTo(x + 40, y - 20);
    c.moveTo(x - 6, y - 7);
    c.lineTo(x + 6, y - 7);
    c.stroke();
    this.text('Ra ' + fmt(ra), x + 13, y - 23, 12);
  };

  Blatt.prototype.schraffur = function (x, y, w, h, ab) {
    var c = this.ctx, i;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    this.stil('duenn');
    c.beginPath();
    for (i = -h; i < w + h; i += ab || 7) {
      c.moveTo(x + i, y + h);
      c.lineTo(x + i + h, y);
    }
    c.stroke();
    c.restore();
  };

  Blatt.prototype.rahmen = function (m) {
    this.farbe = '#15181c';
    this.rechteck(30, 12, BW - 42, BH - 24, 'dick');
    var SW = 470, SH = 96;
    var sx = BW - 12 - SW, sy = BH - 12 - SH;
    this.ctx.fillStyle = '#f4f3ec';
    this.ctx.fillRect(sx, sy, SW, SH);
    // Schriftfeld
    this.rechteck(sx, sy, SW, SH, 'dick');
    this.linie(sx, sy + 32, sx + SW, sy + 32, 'duenn');
    this.linie(sx, sy + 64, sx + SW, sy + 64, 'duenn');
    this.linie(sx + 170, sy, sx + 170, sy + SH, 'duenn');
    this.linie(sx + 330, sy, sx + 330, sy + SH, 'duenn');
    var klein = 10;
    var zellen = [
      ['Benennung', m.teil.name, 17], ['Werkstoff', ZM.daten.werkstoffe[m.mat].name, 15], ['Zeichnungsnummer', m.auftrag, 15],
      ['Allgemeintoleranz', 'ISO 2768-m', 14], ['Kunde', m.kunde, 14], ['Maßstab', this.massstab || '—', 14],
      ['Projektionsmethode 1', 'Kanten gebr. 0,2 × 45°', 13], ['Gezeichnet', 'AV / Ausbildung', 13], ['Blatt', '1 / 1', 13]
    ];
    var spalten = [sx + 5, sx + 175, sx + 335];
    var i;
    for (i = 0; i < zellen.length; i++) {
      var cx = spalten[i % 3], cy = sy + Math.floor(i / 3) * 32;
      this.text(zellen[i][0], cx, cy + 11, klein);
      this.text(zellen[i][1], cx, cy + 27, zellen[i][2]);
    }
  };

  // Blattbreite 1000 Einheiten = 297 mm (A4 quer): 1 mm auf dem Papier = 3,367 Einheiten
  function massstab(s) {
    var p = BW / 297;
    var stufen = [[5 * p, '5 : 1'], [2 * p, '2 : 1'], [p, '1 : 1'], [p / 2, '1 : 2'], [p / 2.5, '1 : 2,5'], [p / 5, '1 : 5']];
    var i;
    for (i = 0; i < stufen.length; i++) { if (s >= stufen[i][0]) { return stufen[i]; } }
    return [0.2, '1 : 5'];
  }

  // Endbearbeitung je Bohrungsgruppe: der letzte Arbeitsgang mit denselben Positionen
  function bohrGruppen(m) {
    var g = {}, liste = [];
    m.ops.forEach(function (op) {
      if (!op.pos) { return; }
      var key = JSON.stringify(op.pos);
      if (!g[key]) { g[key] = { pos: op.pos, ops: [] }; liste.push(g[key]); }
      g[key].ops.push(op);
    });
    liste.forEach(function (gr) {
      var fin = gr.ops[gr.ops.length - 1];
      gr.fin = fin;
      if (fin.typ === 'gewinde') {
        var gw = ZM.daten.gewinde[fin.gw];
        gr.dSicht = gw.kern;
        gr.dAussen = gw.D;
        gr.label = gr.pos.length + '× ' + fin.gw + (fin.durch ? '' : ' ↧' + fmt(fin.tiefe));
      } else {
        gr.dSicht = fin.d || 6;
        var tol = fin.tol && fin.tol !== '2768-m' ? (fin.tol.indexOf('/') > 0 ? ' ' + fin.tol.replace('/', ' / ') : ' ' + fin.tol) : '';
        gr.label = gr.pos.length + '× Ø' + fmt(fin.d || 6) + tol + (fin.durch ? '' : ' ↧' + fmt(fin.tiefe));
      }
    });
    return liste;
  }

  function zeichnePlatte(b, m) {
    var t = m.teil;
    var B = t.B, H = t.H, T = t.T;
    var nut = null;
    m.ops.forEach(function (op) { if (op.typ === 'fraesen') { nut = op; } });
    var s = Math.min(740 / (B + T), 380 / H);
    var ms = massstab(s);
    s = ms[0];
    b.massstab = ms[1];
    var x0 = 120, y0 = 80;
    var w = B * s, h = H * s;
    // Hauptansicht (Draufsicht auf die bearbeitete Flaeche)
    b.rechteck(x0, y0, w, h, 'dick');
    var gruppen = bohrGruppen(m);
    function px(x) { return x0 + x * s; }
    function py(y) { return y0 + h - y * s; }
    if (nut) {
      var ny0 = py(nut.y + nut.breite / 2), ny1 = py(nut.y - nut.breite / 2);
      b.linie(x0, ny0, x0 + w, ny0, 'dick');
      b.linie(x0, ny1, x0 + w, ny1, 'dick');
    }
    var xs = {}, ys = {};
    gruppen.forEach(function (gr) {
      gr.pos.forEach(function (p) {
        var r = gr.dSicht / 2 * s;
        b.kreis(px(p[0]), py(p[1]), r, 'dick');
        if (gr.dAussen) { b.bogen(px(p[0]), py(p[1]), gr.dAussen / 2 * s, 0.2, Math.PI * 1.7, 'duenn'); }
        var l = Math.max(r + 6, 10);
        b.linie(px(p[0]) - l, py(p[1]), px(p[0]) + l, py(p[1]), 'mitte');
        b.linie(px(p[0]), py(p[1]) - l, px(p[0]), py(p[1]) + l, 'mitte');
        xs[p[0]] = true;
        ys[p[1]] = true;
      });
    });
    // Bemassung: Bezugskanten links und unten
    var xl = Object.keys(xs).map(Number).sort(function (a, c) { return a - c; });
    var yl = Object.keys(ys).map(Number).sort(function (a, c) { return a - c; });
    var ab = 24;
    xl.forEach(function (x) {
      b.mass(x0, y0 + h, px(x), y0 + h, ab, fmt(x));
      ab += 17;
    });
    b.mass(x0, y0 + h, x0 + w, y0 + h, ab + 4, fmt(B));
    var abY = -24;
    yl.forEach(function (y) {
      b.mass(x0, y0 + h, x0, py(y), abY, fmt(y));
      abY -= 17;
    });
    b.mass(x0, y0 + h, x0, y0, abY - 4, fmt(H));
    // Bohrungsangaben
    gruppen.forEach(function (gr, i) {
      var p = gr.pos[gr.pos.length - 1];
      var r = gr.dSicht / 2 * s;
      var hx = px(p[0]) + r * 0.7, hy = py(p[1]) - r * 0.7;
      b.hinweis(hx, hy, hx + 34, y0 - 18 - i * 22 > 30 ? y0 - 18 - i * 22 : hy - 30, gr.label);
    });
    if (nut) {
      b.text('Nut ' + fmt(nut.breite) + ' ' + nut.breiteTol.replace('/', ' / ') + ' × ' + fmt(nut.tiefe) + ' ' + nut.tiefeTol, x0 + w - 4, py(nut.y) + 4, 12, 'right');
    }

    // Seitenansicht von links: Eintrittsflaeche links, Dicke nach rechts
    var sx0 = x0 + w + 70, sw = T * s;
    b.rechteck(sx0, y0, sw, h, 'dick');
    b.text('Seitenansicht', sx0 + sw / 2, y0 - 10, 12, 'center');
    if (nut) {
      var nt = nut.tiefe * s;
      b.ctx.fillStyle = '#f4f3ec';
      b.ctx.fillRect(sx0 - 1, py(nut.y + nut.breite / 2), nt + 1, nut.breite * s);
      b.linie(sx0, py(nut.y + nut.breite / 2), sx0 + nt, py(nut.y + nut.breite / 2), 'dick');
      b.linie(sx0 + nt, py(nut.y + nut.breite / 2), sx0 + nt, py(nut.y - nut.breite / 2), 'dick');
      b.linie(sx0, py(nut.y - nut.breite / 2), sx0 + nt, py(nut.y - nut.breite / 2), 'dick');
      b.mass(sx0, py(nut.y + nut.breite / 2), sx0 + nt, py(nut.y + nut.breite / 2), 16, fmt(nut.tiefe) + ' ' + nut.tiefeTol, 11);
      b.mass(sx0 + sw, py(nut.y + nut.breite / 2), sx0 + sw, py(nut.y - nut.breite / 2), -18, fmt(nut.breite) + ' ' + nut.breiteTol.replace('/', ' / '), 11);
      b.rauheit(sx0 + nt + 2, py(nut.y) + 4, nut.ra);
    }
    var gezeichnet = {};
    gruppen.forEach(function (gr) {
      gr.pos.forEach(function (p) {
        if (gezeichnet[p[1]]) { return; }
        gezeichnet[p[1]] = true;
        var r = gr.dSicht / 2 * s;
        var fin = gr.fin;
        var tiefe = fin.durch ? T : (fin.tiefe || T * 0.6);
        var yy = py(p[1]);
        b.linie(sx0, yy - r, sx0 + tiefe * s, yy - r, 'verdeckt');
        b.linie(sx0, yy + r, sx0 + tiefe * s, yy + r, 'verdeckt');
        if (!fin.durch) {
          var sp = r / Math.tan(59 * Math.PI / 180);
          b.linie(sx0 + tiefe * s, yy - r, sx0 + tiefe * s + sp, yy, 'verdeckt');
          b.linie(sx0 + tiefe * s, yy + r, sx0 + tiefe * s + sp, yy, 'verdeckt');
          b.mass(sx0, yy - r, sx0 + tiefe * s, yy - r, -12 - r, fmt(tiefe) + (fin.tiefeTol ? ' ±' + fmt(fin.tiefeTol) : ''), 11);
        }
        if (gr.dAussen) {
          var ra = gr.dAussen / 2 * s;
          b.linie(sx0, yy - ra, sx0 + tiefe * s, yy - ra, 'verdeckt');
          b.linie(sx0, yy + ra, sx0 + tiefe * s, yy + ra, 'verdeckt');
        }
        b.linie(sx0 - 8, yy, sx0 + sw + 8, yy, 'mitte');
      });
    });
    b.mass(sx0, y0 + h, sx0 + sw, y0 + h, 24, fmt(T));
    // Rauheit allgemein
    var raMin = 99;
    m.ops.forEach(function (op) { if (op.ra && op.ra < raMin) { raMin = op.ra; } });
    b.text('Allgemein:', 60, BH - 70, 12);
    b.rauheit(120, BH - 52, 12.5);
    if (raMin < 12.5) { b.text('( √ Ra ' + fmt(raMin) + ' an gekennzeichneten Flächen )', 175, BH - 60, 12); }
    gruppen.forEach(function (gr) {
      if (gr.fin.ra && gr.fin.ra < 12.5) {
        var p = gr.pos[0];
        b.rauheit(px(p[0]) + gr.dSicht / 2 * s + 4, py(p[1]) + gr.dSicht / 2 * s + 26, gr.fin.ra);
      }
    });
  }

  // Drehteil: Kontur aus Absaetzen vom freien Ende her, Fase, plangedrehte Stirnflaeche
  function zeichneWelle(b, m) {
    var op = m.ops[0];
    var K = ZM.daten.drehKontur(op), st = K.stufen;
    var D = op.wst.D, spannL = op.wst.spannL || 0;
    var Lp = K.plan ? K.plan.gesamt : spannL + op.wst.L;
    var s = Math.min(640 / Lp, 260 / D);
    var ms = massstab(s);
    s = ms[0];
    b.massstab = ms[1];
    var x0 = 150, yc = 235;
    var xE = x0 + Lp * s;
    var fa = K.fase || 0;
    function xs(abStirn) { return xE - abStirn * s; }
    // Profil (obere Haelfte) vom Futterende zum freien Ende
    var pkt = [[x0, D / 2]];
    var i;
    for (i = st.length - 1; i >= 0; i--) {
      var rAlt = pkt[pkt.length - 1][1];
      pkt.push([xs(st[i].bis), rAlt]);
      pkt.push([xs(st[i].bis), st[i].d / 2]);
    }
    var rEnd = pkt[pkt.length - 1][1];
    if (fa > 0 && st.length) {
      pkt.push([xs(fa), rEnd]);
      pkt.push([xE, rEnd - fa]);
    } else {
      pkt.push([xE, rEnd]);
    }
    var c = b.ctx;
    [1, -1].forEach(function (seite) {
      b.stil('dick');
      c.beginPath();
      pkt.forEach(function (p, k) {
        var y = yc - seite * p[1] * s;
        if (k === 0) { c.moveTo(p[0], y); } else { c.lineTo(p[0], y); }
      });
      c.stroke();
    });
    // Senkrechte Kanten: Schultern, Stirnflaechen
    b.linie(x0, yc - D / 2 * s, x0, yc + D / 2 * s, 'dick');
    st.forEach(function (x) { b.linie(xs(x.bis), yc - x.d / 2 * s, xs(x.bis), yc + x.d / 2 * s, 'duenn'); });
    var rStirn = (fa > 0 && st.length ? rEnd - fa : rEnd);
    b.linie(xE, yc - rStirn * s, xE, yc + rStirn * s, 'dick');
    if (fa > 0 && st.length) { b.linie(xs(fa), yc - rEnd * s, xs(fa), yc + rEnd * s, 'duenn'); }
    b.linie(x0 - 20, yc, xE + 24, yc, 'mitte');
    // Spannbereich im Futter
    if (spannL > 0) {
      b.linie(x0 + spannL * s, yc - D / 2 * s - 8, x0 + spannL * s, yc - D / 2 * s + 6, 'duenn');
      b.text('Spannbereich', x0 + spannL * s / 2, yc - D / 2 * s - 12, 11, 'center');
    }
    // Durchmesser
    var dx = 0;
    st.forEach(function (x, k) {
      var von = k === 0 ? 0 : st[k - 1].bis;
      var xm = xs((x.bis + von) / 2) + (k === 0 && fa > 0 ? -8 : 0);
      b.mass(xm, yc + x.d / 2 * s, xm, yc - x.d / 2 * s, 0, 'Ø' + fmt(x.d) + ' ' + x.tol, 13);
      if (x.ra) { b.rauheit(xm - 8 + dx, yc - x.d / 2 * s, x.ra); }
    });
    var xRoh = st.length ? (x0 + xs(st[st.length - 1].bis)) / 2 : (x0 + xE) / 2;
    b.mass(xRoh, yc + D / 2 * s, xRoh, yc - D / 2 * s, 0, 'Ø' + fmt(D), 13);
    // Laengen von der Stirnflaeche (Bezugskante) aus
    var unten = yc + D / 2 * s;
    st.forEach(function (x, k) {
      b.mass(xs(x.bis), unten, xE, unten, 28 + 26 * k, fmt(x.bis) + ' ±' + fmt(K.laengeTol), 13);
    });
    if (K.plan) {
      b.mass(x0, unten, xE, unten, 28 + 26 * st.length, fmt(K.plan.gesamt) + ' ±' + fmt(K.plan.tol), 13);
      b.rauheit(xE + 14, yc - rStirn * s * 0.45, K.plan.ra || 3.2);
      // Ebenheitsrahmen an der Stirnflaeche
      if (K.plan.eben) {
        var fx = xE + 20, fy = yc + rStirn * s * 0.4;
        b.linie(xE, fy, fx, fy, 'duenn');
        b.rechteck(fx, fy - 11, 22, 22, 'duenn');
        b.rechteck(fx + 22, fy - 11, 44, 22, 'duenn');
        b.linie(fx + 5, fy + 4, fx + 17, fy + 4, 'duenn');
        b.linie(fx + 8, fy - 4, fx + 20, fy - 4, 'duenn');
        b.linie(fx + 5, fy + 4, fx + 8, fy - 4, 'duenn');
        b.linie(fx + 17, fy + 4, fx + 20, fy - 4, 'duenn');
        b.text(fmt(K.plan.eben), fx + 44, fy + 5, 13, 'center');
      }
    } else {
      b.mass(x0, unten, xE, unten, 28 + 26 * st.length, fmt(Lp) + ' (Rohteil)', 13);
    }
    if (fa > 0 && st.length) { b.hinweis(xE - fa * s * 0.5, yc - (rEnd - fa * 0.5) * s, xE + 30, yc - D / 2 * s - 30, fmt(fa) + ' × 45°'); }
    // Werkstuecknullpunkt fuer die CNC
    var cnc = ZM.daten.maschinen[op.maschine] && ZM.daten.maschinen[op.maschine].cnc;
    if (cnc) {
      c.save();
      c.strokeStyle = b.farbe;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(xE, yc, 6, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = b.farbe;
      c.beginPath();
      c.moveTo(xE, yc);
      c.arc(xE, yc, 6, 0, Math.PI / 2);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(xE, yc);
      c.arc(xE, yc, 6, Math.PI, Math.PI * 1.5);
      c.closePath();
      c.fill();
      c.restore();
      b.text('W', xE + 9, yc - 8, 13);
    }
    // Text unter der Ansicht
    var ty = 470;
    st.forEach(function (x) {
      var t = ZM.daten.toleranz(x.d, x.tol);
      b.text('Ø' + fmt(x.d) + ' ' + x.tol + ' = ' + fmt(x.d + t.u) + ' … ' + fmt(x.d + t.o) + ' mm', 60, ty, 14);
      ty += 18;
    });
    b.text('Rohteil: Rundstahl Ø' + fmt(D) + (op.wst.saege ? ', gesägt' : '') + ', Länge ' + fmt(spannL + op.wst.L) + ' mm, im Dreibackenfutter gespannt (Spannlänge ' + fmt(spannL) + ' mm)', 60, ty + 2, 13);
    ty += 18;
    if (K.plan) { b.text('Stirnfläche plangedreht, Zapfen in der Mitte nicht zulässig', 60, ty + 2, 13); ty += 18; }
    if (cnc) { b.text('Werkstücknullpunkt W auf der fertigen Stirnfläche in der Drehachse', 60, ty + 2, 13); ty += 18; }
    if (op.reitstockErlaubt) { b.text('Zentrierbohrung DIN 332-A 3,15 am freien Ende (Reitstock möglich)', 60, ty + 2, 13); }
    b.text('Allgemein:', 60, BH - 70, 12);
    b.rauheit(120, BH - 52, 12.5);
  }

  function zeichneNutblock(b, m) {
    var t = m.teil, op = m.ops[0];
    var L = t.L, B = t.B, H = t.H;
    var s = Math.min(700 / (L + B), 380 / (H + B));
    var ms = massstab(s);
    s = ms[0];
    b.massstab = ms[1];
    var x0 = 120, y0 = 80;
    // Vorderansicht (Laenge x Hoehe), Nutgrund verdeckt
    var w = L * s, h = H * s;
    b.rechteck(x0, y0, w, h, 'dick');
    b.text('Vorderansicht', x0 + w / 2, y0 - 10, 12, 'center');
    b.linie(x0, y0 + op.tiefe * s, x0 + w, y0 + op.tiefe * s, 'verdeckt');
    b.mass(x0, y0 + h, x0 + w, y0 + h, 24, fmt(L));
    b.mass(x0, y0 + h, x0, y0, -24, fmt(H));
    // Seitenansicht von links rechts daneben (Breite x Hoehe), Nut sichtbar
    var sx = x0 + w + 80, sw = B * s;
    var ny0 = sx + (op.y - op.breite / 2) * s, ny1 = sx + (op.y + op.breite / 2) * s;
    var c = b.ctx;
    b.stil('dick');
    c.beginPath();
    c.moveTo(sx, y0);
    c.lineTo(ny0, y0);
    c.lineTo(ny0, y0 + op.tiefe * s);
    c.lineTo(ny1, y0 + op.tiefe * s);
    c.lineTo(ny1, y0);
    c.lineTo(sx + sw, y0);
    c.lineTo(sx + sw, y0 + h);
    c.lineTo(sx, y0 + h);
    c.closePath();
    c.stroke();
    b.text('Seitenansicht', sx + sw / 2, y0 - 44, 12, 'center');
    b.linie((ny0 + ny1) / 2, y0 - 12, (ny0 + ny1) / 2, y0 + h + 10, 'mitte');
    b.mass(ny0, y0, ny1, y0, -18, fmt(op.breite) + ' ' + op.breiteTol.replace('/', ' / '), 12);
    b.mass(sx + sw, y0, sx + sw, y0 + op.tiefe * s, -26, fmt(op.tiefe) + ' ' + op.tiefeTol, 12);
    b.linie(ny1, y0 + op.tiefe * s, sx + sw + 4, y0 + op.tiefe * s, 'duenn');
    b.mass(sx, y0 + h, (ny0 + ny1) / 2, y0 + h, 22, fmt(op.y) + ' ±' + fmt(op.lageTol), 12);
    b.mass(sx, y0 + h, sx + sw, y0 + h, 46, fmt(B));
    b.hinweis((ny0 + ny1) / 2 + 2, y0 + op.tiefe * s - 1, sx - 30, y0 + h * 0.55, '');
    b.rauheit(sx - 70, y0 + h * 0.55, op.ra);
    // Draufsicht unter der Vorderansicht
    var dy = y0 + h + 90;
    b.rechteck(x0, dy, w, B * s, 'dick');
    b.text('Draufsicht', x0 + w / 2, dy - 10, 12, 'center');
    b.linie(x0, dy + (B - op.y - op.breite / 2) * s, x0 + w, dy + (B - op.y - op.breite / 2) * s, 'dick');
    b.linie(x0, dy + (B - op.y + op.breite / 2) * s, x0 + w, dy + (B - op.y + op.breite / 2) * s, 'dick');
    b.linie(x0 - 10, dy + (B - op.y) * s, x0 + w + 10, dy + (B - op.y) * s, 'mitte');
    b.mass(x0, dy + B * s, x0, dy, -24, fmt(B));
    b.text('Allgemein:', 60, BH - 70, 12);
    b.rauheit(120, BH - 52, 12.5);
  }

  function zeichne(cv, m) {
    var b = new Blatt(cv);
    var art = m.teil.art;
    var ctx = b.ctx;
    ctx.fillStyle = '#f4f3ec';
    ctx.fillRect(0, 0, BW, BH);
    if (art === 'welle') { zeichneWelle(b, m); }
    else if (art === 'nutblock') { zeichneNutblock(b, m); }
    else { zeichnePlatte(b, m); }
    b.rahmen(m);
  }

  ZM.zeichnung = { zeichne: zeichne };
})(typeof window !== 'undefined' ? window : globalThis);
