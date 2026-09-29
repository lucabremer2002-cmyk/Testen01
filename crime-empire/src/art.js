/* ---------------------------------------------------------------------
   Bildzeug: Symbole und Portraits.

   Alles als SVG im Code erzeugt, kein einziges Bild von aussen. Die
   Portraits sind deterministisch aus einer Zahl gebaut - derselbe
   Mensch sieht nach dem Laden wieder gleich aus, ohne dass ein Pixel
   gespeichert werden muss.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  /* Pfade auf 24x24. Bewusst kantig und schlicht - kleine Symbole
     ueberleben keine Details. */
  var P = {
    cash:      'M3 7h18v10H3z M3 10h18 M7 12h2',
    rep:       'M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.2l5.9-.9z',
    heat:      'M12 3c0 4-5 5-5 9a5 5 0 0010 0c0-4-5-5-5-9z',
    influence: 'M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19',
    strength:  'M4 12h3l2-5 3 10 2-7 2 4h4',
    crew:      'M8 11a3 3 0 100-6 3 3 0 000 6z M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 11a3 3 0 100-6 3 3 0 000 6z M16 14c3.3 0 6 2.7 6 6',
    biz:       'M3 9l2-5h14l2 5 M3 9v11h18V9 M3 9h18 M9 20v-6h6v6',
    rank:      'M12 2l3 6 6 1-4.5 4.4 1 6.6-5.5-3-5.5 3 1-6.6L3 9l6-1z',

    /* Bildschirme */
    grid:      'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
    map:       'M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2z M9 3v16 M15 5v16',
    building:  'M4 21V6l7-3 7 3v15 M9 21v-5h4v5 M8 9h2 M14 9h2 M8 13h2 M14 13h2',
    people:    'M8 11a3 3 0 100-6 3 3 0 000 6z M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 11a3 3 0 100-6 3 3 0 000 6z M16 14c3.3 0 6 2.7 6 6',
    org:       'M12 3v4 M6 21v-6h12v6 M12 7v8 M4 21h4 M16 21h4 M9 11h6',
    swords:    'M14 3h7v7 M21 3l-9 9 M3 14l7 7 M10 21l-7-7 M7 10L3 6V3h3l4 4',
    chart:     'M3 3v18h18 M7 15l4-5 3 3 5-7',
    bell:      'M12 3a5 5 0 00-5 5v4l-2 3h14l-2-3V8a5 5 0 00-5-5z M10 18a2 2 0 004 0',
    trophy:    'M7 4h10v5a5 5 0 01-10 0z M5 4h2v3a2 2 0 01-2-2z M19 4h-2v3a2 2 0 002-2z M10 14h4v4h-4z M8 20h8',

    /* Betriebe */
    diner:     'M5 3v8a3 3 0 006 0V3 M8 11v10 M17 3c-1 3-1 5 0 7v11',
    garage:    'M3 10l2-5h14l2 5v10H3z M6 14h3 M15 14h3 M3 10h18',
    club:      'M8 18V6l10-3v12 M8 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z M18 15a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
    car:       'M4 15l1.5-5h13L20 15 M3 15h18v4H3z M6 19v2 M18 19v2 M7 15h2 M15 15h2',
    truck:     'M2 7h11v9H2z M13 10h4l3 3v3h-7 M6 19a2 2 0 100-4 2 2 0 000 4z M17 19a2 2 0 100-4 2 2 0 000 4z',
    crane:     'M5 21V4h2l12 3 M7 7l10 2.5 M12 8v13 M5 21h14 M17 9.5v4',
    hotel:     'M4 21V3h16v18 M8 7h2 M14 7h2 M8 11h2 M14 11h2 M10 21v-5h4v5',
    chips:     'M12 8a8 3.5 0 100 7 8 3.5 0 000-7z M4 11.5v4c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-4',
    market:    'M3 7l2-3h14l2 3 M4 7v13h16V7 M9 12h6 M9 16h6',
    dice:      'M4 8l8-4 8 4v8l-8 4-8-4z M12 4v16 M4 8l8 4 8-4',
    crate:     'M3 6h18v14H3z M3 10h18 M8 6v14 M16 6v14',
    ship:      'M3 17l2-6h14l2 6 M12 11V5 M8 8h8 M3 20h18',
    web:       'M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4 M12 12m-8 0a8 8 0 1016 0 8 8 0 10-16 0',

    /* Rollen */
    boss:      'M4 18l2-9 4 4 2-7 2 7 4-4 2 9z M4 21h16',
    operator:  'M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
    manager:   'M6 20V9l6-4 6 4v11 M10 20v-5h4v5 M9 11h2 M13 11h2',
    enforcer:  'M6 4h12v6a6 6 0 01-12 0z M12 16v5 M8 21h8',
    accountant:'M5 3h14v18H5z M8 7h8 M8 11h3 M13 11h3 M8 15h3 M13 15h3',
    lawyer:    'M12 3v18 M5 21h14 M3 8h18 M6 8l-3 5h6zM18 8l-3 5h6z',
    driver:    'M12 4a8 8 0 100 16 8 8 0 000-16z M12 8a4 4 0 100 8 4 4 0 000-8z M12 4v4 M8.5 14L5 17 M15.5 14l3.5 3',
    informant: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 15a3 3 0 100-6 3 3 0 000 6z',
    security:  'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',

    /* Ausbauten */
    house:     'M3 11l9-7 9 7 M6 10v10h12V10 M10 20v-6h4v6',
    scales:    'M12 3v18 M5 21h14 M3 8h18 M6 8l-3 5h6zM18 8l-3 5h6z',
    wash:      'M4 3h16v18H4z M12 16a4 4 0 100-8 4 4 0 000 8z M7 6h2',
    eye:       'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 15a3 3 0 100-6 3 3 0 000 6z',
    fleet:     'M2 7h11v9H2z M13 10h4l3 3v3h-7 M6 19a2 2 0 100-4 2 2 0 000 4z M17 19a2 2 0 100-4 2 2 0 000 4z',
    net:       'M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4',

    lock:      'M6 11V8a6 6 0 1112 0v3 M4 11h16v10H4z M12 15v3',
    check:     'M4 12l5 5L20 6',
    clock:     'M12 3a9 9 0 100 18 9 9 0 000-18z M12 7v5l3 2',
    warn:      'M12 3l10 18H2z M12 9v5 M12 18h.01',
    plus:      'M12 5v14 M5 12h14',
    arrow:     'M5 12h14 M13 6l6 6-6 6'
  };

  function icon(name, cls) {
    var d = P[name] || P.biz;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') +
      ' aria-hidden="true">' +
      d.split(' M').map(function (seg, i) { return '<path d="' + (i ? 'M' + seg : seg) + '"/>'; }).join('') +
      '</svg>';
  }

  /* -------------------------------------------------------- Portraits

     Kein Foto, keine Zeichnung - eine Silhouette aus wenigen Formen.
     Aus dem Zahlenwert werden Hautton, Haar, Kleidung und ein paar
     Merkmale abgeleitet. Das reicht, damit man Gesichter wiedererkennt,
     und kostet nichts.
  */
  var SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#6b4226', '#a56d3a', '#d9a066'];
  var HAIR = ['#151515', '#2b1d10', '#4a3520', '#6e5230', '#8a8a8a', '#d8cfa8', '#5a1f1f'];
  var CLOTH = ['#1d2430', '#2a1f2e', '#22302a', '#302520', '#1f2a38', '#33242c', '#2c2c34'];

  function portrait(seed, size) {
    var r = seed >>> 0;
    function n(m) { r = (r * 1664525 + 1013904223) >>> 0; return r % m; }
    var skin = SKIN[n(SKIN.length)];
    var hair = HAIR[n(HAIR.length)];
    var cloth = CLOTH[n(CLOTH.length)];
    var bald = n(6) === 0;
    var beard = n(3) === 0;
    var glasses = n(4) === 0;
    var hat = n(7) === 0;
    var long = n(3) === 0;
    var bg1 = n(3);
    var bgs = ['#12141c', '#181320', '#101a1c'];

    var s = size || 48;
    var o = ['<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" aria-hidden="true">'];
    o.push('<rect width="48" height="48" fill="' + bgs[bg1] + '"/>');
    /* Lichtkegel von oben, wie in einem Verhoerraum. */
    o.push('<path d="M14 0 L34 0 L44 48 L4 48 Z" fill="rgba(255,255,255,.035)"/>');
    /* Schultern */
    o.push('<path d="M5 48 Q7 33 24 31 Q41 33 43 48 Z" fill="' + cloth + '"/>');
    o.push('<path d="M24 31 L20 48 M24 31 L28 48" stroke="rgba(0,0,0,.35)" stroke-width="1" fill="none"/>');
    /* Hals + Kopf */
    o.push('<rect x="20" y="26" width="8" height="8" fill="' + shade(skin, -22) + '"/>');
    o.push('<ellipse cx="24" cy="19" rx="9.2" ry="10.6" fill="' + skin + '"/>');
    /* Haar */
    if (long) o.push('<path d="M14 20 Q13 33 16 34 L16 18 Z M34 20 Q35 33 32 34 L32 18 Z" fill="' + hair + '"/>');
    if (!bald) o.push('<path d="M14.8 15 Q16 7.5 24 7.5 Q32 7.5 33.2 15 Q29 11.5 24 11.8 Q19 11.5 14.8 15 Z" fill="' + hair + '"/>');
    if (hat) o.push('<path d="M12 13 L36 13 L34 8 Q24 4.5 14 8 Z" fill="#14151b"/><rect x="10" y="12.5" width="28" height="2.2" rx="1" fill="#0e0f14"/>');
    /* Augen */
    o.push('<circle cx="20.6" cy="19" r="1.15" fill="#0b0b0f"/><circle cx="27.4" cy="19" r="1.15" fill="#0b0b0f"/>');
    if (glasses) {
      o.push('<g stroke="#c9ccd6" stroke-width=".8" fill="none" opacity=".85">' +
        '<circle cx="20.6" cy="19" r="3.1"/><circle cx="27.4" cy="19" r="3.1"/>' +
        '<path d="M23.7 19h.6M17.5 18.3l-2 -.6M30.5 18.3l2 -.6"/></g>');
    }
    /* Mund und Bart */
    if (beard) o.push('<path d="M17 22.5 Q24 31 31 22.5 Q30 28 24 28.6 Q18 28 17 22.5 Z" fill="' + hair + '" opacity=".92"/>');
    o.push('<path d="M21.6 24.6 Q24 26.2 26.4 24.6" stroke="' + shade(skin, -40) + '" stroke-width="1" fill="none" stroke-linecap="round"/>');
    /* Schatten der Kante */
    o.push('<ellipse cx="24" cy="19" rx="9.2" ry="10.6" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1"/>');
    o.push('</svg>');
    return o.join('');
  }

  function shade(hex, amt) {
    var v = parseInt(hex.slice(1), 16);
    var r2 = Math.max(0, Math.min(255, (v >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((v >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (v & 255) + amt));
    return '#' + ((1 << 24) + (r2 << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* Wappen eines Rivalen: zwei Buchstaben auf Hausfarbe. */
  function crest(name, color) {
    var words = name.replace(/^(The|Los)\s+/i, '').split(/\s+/);
    /* Ein Wort ("Halcones") ergibt sonst nur ein einzelnes H im Wappen. */
    var ini = words.length > 1
      ? words.map(function (w) { return w.charAt(0); }).join('').slice(0, 2)
      : words[0].slice(0, 2);
    return { initials: ini.toUpperCase(), color: color };
  }

  CE.art = { icon: icon, portrait: portrait, crest: crest, shade: shade, PATHS: P };
})(typeof window !== 'undefined' ? window : globalThis);
