/*
 * Kleine DOM-Helfer, Formatierung und Speicherstand.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // h('div.klasse.andere#id', { attr }, [kinder]) – Kinder: Knoten, Text oder Arrays
  function h(spec, attrs, kinder) {
    if (attrs === null || attrs === undefined || typeof attrs !== 'object' || Array.isArray(attrs) || attrs.nodeType) {
      kinder = attrs;
      attrs = null;
    }
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec);
    var el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) {
      m[2].replace(/([.#])([\w-]+)/g, function (_, art, name) {
        if (art === '.') { el.classList.add(name); } else { el.id = name; }
        return '';
      });
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'onclick' || k === 'oninput' || k === 'onchange' || k === 'onsubmit' || k === 'onkeydown') {
          el.addEventListener(k.substr(2), v);
        } else if (k === 'html') {
          el.innerHTML = v;
        } else if (k === 'text') {
          el.textContent = v;
        } else if (v === true) {
          el.setAttribute(k, '');
        } else {
          el.setAttribute(k, v);
        }
      });
    }
    anhaengen(el, kinder);
    return el;
  }

  function anhaengen(el, kinder) {
    if (kinder === null || kinder === undefined) { return; }
    if (Array.isArray(kinder)) {
      kinder.forEach(function (k) { anhaengen(el, k); });
    } else if (kinder.nodeType) {
      el.appendChild(kinder);
    } else {
      el.appendChild(document.createTextNode(String(kinder)));
    }
  }

  function leeren(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
    return el;
  }

  var aktuelleAnsicht = 'start';
  function zeige(name) {
    $$('.ansicht').forEach(function (v) { v.hidden = v.id !== 'v-' + name; });
    $$('.nav button').forEach(function (b) {
      if (b.getAttribute('data-nav') === name) { b.setAttribute('aria-current', 'page'); }
      else { b.removeAttribute('aria-current'); }
    });
    aktuelleAnsicht = name;
    root.scrollTo(0, 0);
  }

  var toastTimer = null;
  function toast(text) {
    var t = $('#toast');
    t.textContent = text;
    t.classList.add('sichtbar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('sichtbar'); }, 3200);
  }

  // ---------------------------------------------------------- Formatierung
  function zahl(v, stellen) {
    if (v === null || v === undefined || isNaN(v)) { return '–'; }
    return Number(v).toFixed(stellen === undefined ? 1 : stellen).replace('.', ',');
  }

  function geld(v) { return zahl(v, 2) + ' €'; }

  function dauer(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ---------------------------------------------------------- Speicherstand
  var SCHLUESSEL = 'spanwerk.v1';
  function standard() {
    return {
      fortschritt: {},
      einstellungen: { stufe: 'azubi', ton: true, vol: 0.6, alles: false, zeitraffer: true },
      statistik: { werkzeugBruch: 0, bohrerBruch: 0, unfaelle: 0, auftraege: 0, loecher: 0 }
    };
  }

  function laden() {
    var s = standard();
    try {
      var roh = root.localStorage.getItem(SCHLUESSEL);
      if (roh) {
        var d = JSON.parse(roh);
        s.fortschritt = d.fortschritt || {};
        Object.keys(d.einstellungen || {}).forEach(function (k) { s.einstellungen[k] = d.einstellungen[k]; });
        Object.keys(d.statistik || {}).forEach(function (k) { s.statistik[k] = d.statistik[k]; });
      }
    } catch (e) { /* ohne Speicher weiter */ }
    return s;
  }

  function sichern(stand) {
    try { root.localStorage.setItem(SCHLUESSEL, JSON.stringify(stand)); } catch (e) { /* ignorieren */ }
  }

  // Kleines Werkzeugsymbol fuer Auswahllisten
  function werkzeugIcon(def) {
    var cv = document.createElement('canvas');
    var dpr = root.devicePixelRatio || 1;
    cv.width = 46 * dpr;
    cv.height = 46 * dpr;
    var c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#121618';
    c.fillRect(0, 0, 46, 46);
    var st = ZM.daten.schneidstoffe[def.stoff] || ZM.daten.schneidstoffe.HMCVD;
    var g = c.createLinearGradient(16, 0, 30, 0);
    g.addColorStop(0, '#3e444a');
    g.addColorStop(0.4, st.farbe === '#d9b13b' ? '#f2d27a' : '#e1e5e9');
    g.addColorStop(1, '#3e444a');
    c.fillStyle = g;
    c.strokeStyle = 'rgba(20,22,25,0.6)';
    if (def.typ === 'bohrer' || def.typ === 'reibahle' || def.typ === 'gewinde') {
      var b = Math.max(4, Math.min(14, def.d * 1.1));
      c.fillRect(23 - b / 2, 4, b, 30);
      c.beginPath();
      if (def.typ === 'bohrer') { c.moveTo(23 - b / 2, 34); c.lineTo(23, 34 + b * 0.45); c.lineTo(23 + b / 2, 34); }
      else { c.moveTo(23 - b / 2, 34); c.lineTo(23 - b / 2 + 1.5, 38); c.lineTo(23 + b / 2 - 1.5, 38); c.lineTo(23 + b / 2, 34); }
      c.fill();
      var y;
      c.lineWidth = 1.4;
      for (y = 8; y < 34; y += def.typ === 'gewinde' ? 2.5 : 6) {
        c.beginPath();
        if (def.typ === 'reibahle') { c.moveTo(23 - b / 4, y); c.lineTo(23 - b / 4, y + 4); }
        else { c.moveTo(23 - b / 2, y + 3); c.lineTo(23 + b / 2, y); }
        c.stroke();
      }
    } else if (def.typ === 'platte') {
      var sp = def.form === 'D' ? 55 : def.form === 'V' ? 35 : 80;
      var l = 16, w = l * Math.tan(sp / 2 * Math.PI / 180);
      c.save();
      c.translate(23, 23);
      c.rotate(Math.PI / 4);
      c.fillStyle = def.stoff === 'HMPOL' ? '#c6ccd2' : '#2a2b31';
      c.beginPath();
      c.moveTo(0, -l);
      c.lineTo(w, 0);
      c.lineTo(0, l);
      c.lineTo(-w, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = def.stoff === 'HMCVD' ? '#d6aa3c' : '#7d858c';
      c.stroke();
      c.fillStyle = '#121618';
      c.beginPath();
      c.arc(0, 0, 3, 0, 6.283);
      c.fill();
      c.restore();
    } else if (def.typ === 'fraeser') {
      c.fillStyle = st.farbe;
      c.beginPath();
      c.arc(23, 23, 15, 0, 6.283);
      c.fill();
      c.strokeStyle = 'rgba(10,12,14,0.75)';
      c.lineWidth = 2;
      var k;
      for (k = 0; k < def.z; k++) {
        var a = k * Math.PI * 2 / def.z;
        c.beginPath();
        c.arc(23 + Math.cos(a) * 7, 23 + Math.sin(a) * 7, 8, a - 1.4, a + 0.4);
        c.stroke();
      }
    }
    return cv;
  }

  ZM.ui = {
    $: $, $$: $$, h: h, leeren: leeren, zeige: zeige, toast: toast,
    zahl: zahl, geld: geld, dauer: dauer, laden: laden, sichern: sichern,
    werkzeugIcon: werkzeugIcon,
    ansicht: function () { return aktuelleAnsicht; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
