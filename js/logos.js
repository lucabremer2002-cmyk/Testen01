/* logos.js - Erzeugt fuer jeden Verein ein eigenes Wappen als SVG.
 *
 * Die echten Vereinswappen sind geschuetzte Grafiken und werden hier bewusst
 * NICHT verwendet. Stattdessen wird aus den echten Vereinsfarben, einem
 * Trikotmuster und dem Vereinskuerzel ein eigenstaendiges Wappen gezeichnet.
 */
(function (g) {
  'use strict';

  function luminanz(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255;
    var gg = parseInt(hex.substr(3, 2), 16) / 255;
    var b = parseInt(hex.substr(5, 2), 16) / 255;
    function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  }

  function kontrast(hex) { return luminanz(hex) > 0.45 ? '#101418' : '#ffffff'; }

  function abdunkeln(hex, f) {
    var r = Math.round(parseInt(hex.substr(1, 2), 16) * f);
    var gg = Math.round(parseInt(hex.substr(3, 2), 16) * f);
    var b = Math.round(parseInt(hex.substr(5, 2), 16) * f);
    function h(v) { return ('0' + Math.min(255, v).toString(16)).slice(-2); }
    return '#' + h(r) + h(gg) + h(b);
  }

  var FORMEN = {
    schild: 'M50 4 L92 18 L92 52 C92 78 72 92 50 98 C28 92 8 78 8 52 L8 18 Z',
    wappen: 'M50 4 L92 14 C92 48 88 74 50 98 C12 74 8 48 8 14 Z',
    rund: 'M50 4 A46 46 0 1 1 49.9 4 Z',
    raute: 'M50 2 L96 50 L50 98 L4 50 Z',
    sechseck: 'M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z'
  };

  function muster(id, art, c1, c2) {
    var s = '<rect x="0" y="0" width="100" height="100" fill="' + c1 + '"/>';
    switch (art) {
      case 'streifen':
        for (var x = 0; x < 100; x += 25) {
          s += '<rect x="' + (x + 12.5) + '" y="0" width="12.5" height="100" fill="' + c2 + '"/>';
        }
        break;
      case 'halb':
        s += '<rect x="50" y="0" width="50" height="100" fill="' + c2 + '"/>';
        break;
      case 'schraeg':
        s += '<path d="M0 100 L100 0 L100 40 L40 100 Z" fill="' + c2 + '"/>';
        break;
      case 'ring':
        s += '<circle cx="50" cy="50" r="34" fill="none" stroke="' + c2 + '" stroke-width="13"/>';
        break;
      case 'balken':
        s += '<rect x="0" y="38" width="100" height="24" fill="' + c2 + '"/>';
        break;
      case 'voll':
      default:
        break;
    }
    return s;
  }

  /* Textfarbe abhaengig davon, welche Farbe hinter der Mitte liegt. */
  function mittenFarbe(art, c1, c2) {
    if (art === 'halb' || art === 'schraeg' || art === 'ring' || art === 'balken') {
      return c2;
    }
    if (art === 'streifen') return c2;
    return c1;
  }

  var cache = {};

  var Logos = {
    /* Liefert ein vollstaendiges <svg> als String. */
    svg: function (club, groesse) {
      var key = club.id + '|' + (groesse || 100);
      if (cache[key]) return cache[key];
      var s = groesse || 100;
      var form = FORMEN[club.form] || FORMEN.schild;
      var cid = 'clip_' + club.id;
      var gid = 'glanz_' + club.id;
      var txt = kontrast(mittenFarbe(club.muster, club.c1, club.c2));
      var rand = abdunkeln(club.c1 === '#ffffff' ? club.c2 : club.c1, 0.55);
      var kurz = (club.kurz || club.name.substr(0, 3)).toUpperCase();
      var fs = kurz.length >= 4 ? 26 : 33;

      var out =
        '<svg class="wappen" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="Wappen ' + club.name + '">' +
        '<defs>' +
          '<clipPath id="' + cid + '"><path d="' + form + '"/></clipPath>' +
          '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>' +
            '<stop offset="55%" stop-color="#ffffff" stop-opacity="0.05"/>' +
            '<stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<g clip-path="url(#' + cid + ')">' +
          muster(club.id, club.muster, club.c1, club.c2) +
          '<rect x="0" y="0" width="100" height="100" fill="url(#' + gid + ')"/>' +
        '</g>' +
        '<path d="' + form + '" fill="none" stroke="' + rand + '" stroke-width="4"/>' +
        '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ' +
          'font-family="Georgia, serif" font-weight="700" font-size="' + fs + '" ' +
          'fill="' + txt + '" letter-spacing="1">' + kurz + '</text>' +
        '</svg>';
      cache[key] = out;
      return out;
    },
    /* Kleines Wappen fuer Tabellen/Listen. */
    mini: function (club) { return Logos.svg(club, 22); },
    kontrast: kontrast,
    abdunkeln: abdunkeln
  };

  g.Logos = Logos;
})(typeof window !== 'undefined' ? window : globalThis);
