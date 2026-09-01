/* stadion-grafik.js - Zeichnet das Stadion als Draufsicht.
 *
 * Die Darstellung liest sich direkt aus den Daten: Die Tiefe der Tribünen
 * folgt der Kapazität, die Zahl der Ränge ebenso, die Ausstattung erscheint
 * als eigene Bauteile, und eine laufende Baumaßnahme wird als Baustelle auf
 * der betroffenen Seite gezeigt.
 */
(function (g) {
  'use strict';

  var B = 420, H = 320;               /* Zeichenfläche */
  var RASEN_B = 176, RASEN_H = 116;   /* Spielfeld in der Mitte */

  function tribuenenTiefe(kapazitaet) {
    var k = Math.max(500, kapazitaet);
    return Util.clamp(7 + (Math.log(k) / Math.LN10 - 3) * 25, 7, 56);
  }

  function raenge(kapazitaet) {
    if (kapazitaet >= 60000) return 4;
    if (kapazitaet >= 34000) return 3;
    if (kapazitaet >= 12000) return 2;
    return 1;
  }

  function heller(hex, f) {
    var r = parseInt(hex.substr(1, 2), 16), gg = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    function m(v) { return Math.round(v + (255 - v) * f); }
    function h(v) { return ('0' + Math.min(255, v).toString(16)).slice(-2); }
    return '#' + h(m(r)) + h(m(gg)) + h(m(b));
  }
  function dunkler(hex, f) {
    var r = parseInt(hex.substr(1, 2), 16), gg = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    function h(v) { return ('0' + Math.max(0, Math.round(v)).toString(16)).slice(-2); }
    return '#' + h(r * f) + h(gg * f) + h(b * f);
  }

  /* Eine Tribünenseite als gestapelte Ränge. */
  function tribuene(x, y, breite, hoehe, anzahlRaenge, farbe, richtung, extra) {
    var teile = [];
    var luecke = 1.5;
    var rangHoehe = (hoehe - luecke * (anzahlRaenge - 1)) / anzahlRaenge;
    for (var i = 0; i < anzahlRaenge; i++) {
      /* Obere Ränge springen leicht zurück – wie eine echte Tribünenschale. */
      var einzug = i * (richtung === 'horizontal' ? 5 : 4);
      var rx = richtung === 'horizontal' ? x + einzug : x;
      var rb = richtung === 'horizontal' ? breite - einzug * 2 : breite;
      var ry = y + i * (rangHoehe + luecke);
      var ton = i === 0 ? farbe : (i === 1 ? dunkler(farbe, 0.82) : dunkler(farbe, 0.66));
      teile.push('<rect x="' + rx.toFixed(1) + '" y="' + ry.toFixed(1) + '" width="' + rb.toFixed(1) +
        '" height="' + rangHoehe.toFixed(1) + '" rx="2" fill="' + ton + '"/>');
      /* Sitzreihen andeuten */
      if (rangHoehe > 7) {
        var linien = Math.min(4, Math.floor(rangHoehe / 4));
        for (var l = 1; l <= linien; l++) {
          var ly = ry + rangHoehe * (l / (linien + 1));
          teile.push('<line x1="' + (rx + 3).toFixed(1) + '" y1="' + ly.toFixed(1) +
            '" x2="' + (rx + rb - 3).toFixed(1) + '" y2="' + ly.toFixed(1) +
            '" stroke="' + heller(ton, 0.35) + '" stroke-width="0.7" opacity="0.55"/>');
        }
      }
    }
    if (extra) teile.push(extra);
    return teile.join('');
  }

  function flutlichtmast(x, y) {
    return '<g><line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - 14) +
      '" stroke="#8a8d94" stroke-width="2"/>' +
      '<rect x="' + (x - 9) + '" y="' + (y - 21) + '" width="18" height="8" rx="1.5" fill="#c9ccd4"/>' +
      '<circle cx="' + (x - 5) + '" cy="' + (y - 17) + '" r="1.6" fill="#fff8d8"/>' +
      '<circle cx="' + x + '" cy="' + (y - 17) + '" r="1.6" fill="#fff8d8"/>' +
      '<circle cx="' + (x + 5) + '" cy="' + (y - 17) + '" r="1.6" fill="#fff8d8"/></g>';
  }

  function kran(x, y) {
    return '<g opacity="0.95">' +
      '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - 40) + '" stroke="#e8a13a" stroke-width="3"/>' +
      '<line x1="' + (x - 22) + '" y1="' + (y - 38) + '" x2="' + (x + 30) + '" y2="' + (y - 38) + '" stroke="#e8a13a" stroke-width="3"/>' +
      '<line x1="' + (x + 22) + '" y1="' + (y - 38) + '" x2="' + (x + 22) + '" y2="' + (y - 24) + '" stroke="#b9b9bf" stroke-width="1.2"/>' +
      '<rect x="' + (x + 17) + '" y="' + (y - 24) + '" width="10" height="7" rx="1" fill="#c9ccd4"/></g>';
  }

  /* opt: {vorschau: {sektor, plaetze}} zeigt einen geplanten Ausbau an. */
  function svg(klub, stadion, opt) {
    opt = opt || {};
    var sek = stadion.sektoren;
    var kapazitaet = sek.steh.plaetze + sek.sitz.plaetze + sek.vip.plaetze;
    var geplant = opt.vorschau && opt.vorschau.plaetze > 0 ? opt.vorschau.plaetze : 0;
    var kapNeu = kapazitaet + geplant;

    var tiefe = tribuenenTiefe(kapNeu);
    var rangZahl = raenge(kapNeu);
    var farbe = klub.c1 === '#ffffff' ? klub.c2 : klub.c1;
    var zweit = klub.c2 === '#ffffff' ? heller(farbe, 0.55) : klub.c2;

    var mx = B / 2, my = H / 2 + 6;
    var px = mx - RASEN_B / 2, py = my - RASEN_H / 2;
    var aussenX = px - tiefe, aussenY = py - tiefe;
    var aussenB = RASEN_B + tiefe * 2, aussenH = RASEN_H + tiefe * 2;

    var t = [];

    /* Umgebung */
    t.push('<rect x="0" y="0" width="' + B + '" height="' + H + '" fill="none"/>');
    if (stadion.module.parkhaus) {
      t.push('<g opacity="0.85"><rect x="8" y="' + (H - 62) + '" width="70" height="52" rx="4" fill="#d9dbe1"/>');
      for (var pz = 0; pz < 3; pz++) {
        t.push('<line x1="16" y1="' + (H - 52 + pz * 14) + '" x2="70" y2="' + (H - 52 + pz * 14) +
          '" stroke="#b3b6bf" stroke-width="1.2"/>');
      }
      t.push('<text x="43" y="' + (H - 14) + '" text-anchor="middle" font-size="8" fill="#6f727a" ' +
        'font-family="system-ui,sans-serif">Parkhaus</text></g>');
    }
    if (stadion.module.fanshop) {
      t.push('<g><rect x="' + (B - 74) + '" y="' + (H - 50) + '" width="60" height="34" rx="4" fill="' + farbe + '"/>' +
        '<rect x="' + (B - 70) + '" y="' + (H - 34) + '" width="52" height="14" rx="2" fill="' + heller(farbe, 0.72) + '"/>' +
        '<text x="' + (B - 44) + '" y="' + (H - 24) + '" text-anchor="middle" font-size="8" fill="#3d3f45" ' +
        'font-family="system-ui,sans-serif">Fanshop</text></g>');
    }

    /* Stadionschale */
    t.push('<rect x="' + (aussenX - 6) + '" y="' + (aussenY - 6) + '" width="' + (aussenB + 12) +
      '" height="' + (aussenH + 12) + '" rx="' + (18 + tiefe * 0.25) + '" fill="' + dunkler(farbe, 0.35) + '" opacity="0.16"/>');

    /* Vier Tribünen */
    var vip = sek.vip.plaetze > 0;
    /* Nord (oben) */
    t.push(tribuene(px, aussenY, RASEN_B, tiefe, rangZahl, farbe, 'horizontal'));
    /* Süd (unten) */
    t.push(tribuene(px, py + RASEN_H, RASEN_B, tiefe, rangZahl, farbe, 'horizontal'));
    /* West (links) – trägt die VIP-Logen */
    t.push(tribuene(aussenX, py, tiefe, RASEN_H, rangZahl, vip ? zweit : farbe, 'vertikal'));
    /* Ost (rechts) */
    t.push(tribuene(px + RASEN_B, py, tiefe, RASEN_H, rangZahl, farbe, 'vertikal'));
    /* Ecken füllen */
    [[aussenX, aussenY], [px + RASEN_B, aussenY], [aussenX, py + RASEN_H], [px + RASEN_B, py + RASEN_H]]
      .forEach(function (e) {
        t.push('<rect x="' + e[0] + '" y="' + e[1] + '" width="' + tiefe + '" height="' + tiefe +
          '" rx="3" fill="' + dunkler(farbe, 0.72) + '" opacity="0.9"/>');
      });

    if (vip) {
      t.push('<rect x="' + (aussenX + 1) + '" y="' + (py + RASEN_H * 0.3) + '" width="' + (tiefe - 2) +
        '" height="' + (RASEN_H * 0.4) + '" rx="2" fill="' + heller(zweit, 0.5) + '" opacity="0.95"/>');
      if (tiefe > 20) {
        t.push('<text x="' + (aussenX + tiefe / 2) + '" y="' + (my + 3) + '" text-anchor="middle" ' +
          'font-size="8" fill="#33353b" font-family="system-ui,sans-serif">VIP</text>');
      }
    }

    /* Videowand am Nordende */
    if (stadion.module.videowand) {
      t.push('<rect x="' + (mx - 34) + '" y="' + (aussenY - 11) + '" width="68" height="10" rx="1.5" fill="#2a2c31"/>' +
        '<rect x="' + (mx - 31) + '" y="' + (aussenY - 9.2) + '" width="62" height="6.4" rx="1" fill="#4e7fb5"/>');
    }

    /* Spielfeld */
    t.push('<rect x="' + px + '" y="' + py + '" width="' + RASEN_B + '" height="' + RASEN_H +
      '" rx="2" fill="#5fae7f"/>');
    for (var s = 0; s < 8; s++) {
      if (s % 2 === 0) continue;
      t.push('<rect x="' + (px + s * (RASEN_B / 8)) + '" y="' + py + '" width="' + (RASEN_B / 8) +
        '" height="' + RASEN_H + '" fill="#59a878"/>');
    }
    var w = 'stroke="rgba(255,255,255,.85)" stroke-width="1.1" fill="none"';
    t.push('<rect x="' + (px + 4) + '" y="' + (py + 4) + '" width="' + (RASEN_B - 8) + '" height="' + (RASEN_H - 8) + '" ' + w + '/>');
    t.push('<line x1="' + mx + '" y1="' + (py + 4) + '" x2="' + mx + '" y2="' + (py + RASEN_H - 4) + '" ' + w + '/>');
    t.push('<circle cx="' + mx + '" cy="' + my + '" r="17" ' + w + '/>');
    t.push('<rect x="' + (px + 4) + '" y="' + (my - 26) + '" width="26" height="52" ' + w + '/>');
    t.push('<rect x="' + (px + RASEN_B - 30) + '" y="' + (my - 26) + '" width="26" height="52" ' + w + '/>');

    /* Flutlicht */
    if (stadion.module.flutlicht) {
      t.push(flutlichtmast(aussenX - 2, aussenY + 2));
      t.push(flutlichtmast(aussenX + aussenB + 2, aussenY + 2));
      t.push(flutlichtmast(aussenX - 2, aussenY + aussenH + 20));
      t.push(flutlichtmast(aussenX + aussenB + 2, aussenY + aussenH + 20));
    }

    /* Baustelle: laufender Ausbau oder Vorschau */
    var bau = opt.vorschau ? { sektor: opt.vorschau.sektor, vorschau: true }
                           : (stadion.ausbau && stadion.ausbau.art === 'sektor'
                              ? { sektor: stadion.ausbau.sektor } : null);
    if (bau || (stadion.ausbau && stadion.ausbau.art === 'modul')) {
      var bx, by, bb, bh;
      if (bau && bau.sektor === 'vip') { bx = aussenX - 8; by = py; bb = tiefe + 8; bh = RASEN_H; }
      else if (bau && bau.sektor === 'steh') { bx = px; by = py + RASEN_H; bb = RASEN_B; bh = tiefe + 8; }
      else { bx = px; by = aussenY - 8; bb = RASEN_B; bh = tiefe + 8; }
      t.push('<rect x="' + bx + '" y="' + by + '" width="' + bb + '" height="' + bh +
        '" rx="3" fill="url(#bauschraffur)" stroke="#e8a13a" stroke-width="1.5" stroke-dasharray="5 3"/>');
      t.push(kran(bx + bb - 14, by - 4));
    }

    var beschriftung = opt.beschriftung === false ? '' :
      '<text x="' + mx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" ' +
      'fill="var(--text-2, #63656b)" font-family="system-ui,sans-serif">' +
      Util.esc(stadion.name) + ' · ' + Fmt.num(kapNeu) + ' Plätze' +
      (geplant ? ' (geplant, +' + Fmt.num(geplant) + ')' : '') + '</text>';

    return '<svg class="stadionbild" viewBox="0 0 ' + B + ' ' + H + '" width="100%" ' +
      'role="img" aria-label="Draufsicht des Stadions" preserveAspectRatio="xMidYMid meet">' +
      '<defs><pattern id="bauschraffur" width="8" height="8" patternUnits="userSpaceOnUse" ' +
      'patternTransform="rotate(45)">' +
      '<rect width="8" height="8" fill="rgba(232,161,58,.16)"/>' +
      '<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(232,161,58,.5)" stroke-width="3"/>' +
      '</pattern></defs>' + t.join('') + beschriftung + '</svg>';
  }

  g.StadionGrafik = {
    svg: svg,
    tribuenenTiefe: tribuenenTiefe,
    raenge: raenge
  };
})(typeof window !== 'undefined' ? window : globalThis);
