/* Matchplan – Grundfunktionen: Namespace, Zufall, Formatierung, Datum. */
(function () {
  'use strict';
  var FM = (window.FM = window.FM || {});

  /* ---------- Zufall (seedbar, Zustand wird mitgespeichert) ---------- */
  var rngState = (Date.now() ^ 0x9e3779b9) >>> 0;

  function next() {
    rngState = (rngState + 0x6d2b79f5) >>> 0;
    var t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  FM.rng = {
    seed: function (s) { rngState = s >>> 0; },
    get state() { return rngState; },
    set state(v) { rngState = v >>> 0; },
    next: next,
    int: function (min, max) { return min + Math.floor(next() * (max - min + 1)); },
    range: function (min, max) { return min + next() * (max - min); },
    chance: function (p) { return next() < p; },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    normal: function (mean, sd) {
      var u = 1 - next(), v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: function (items, weightFn) {
      var total = 0, i, w = [];
      for (i = 0; i < items.length; i++) { w[i] = Math.max(0, weightFn(items[i], i)); total += w[i]; }
      if (total <= 0) return items[Math.floor(next() * items.length)];
      var r = next() * total;
      for (i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    },
    shuffle: function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1)), t = arr[i];
        arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  };

  /* Deterministischer Hash (fuer stabile Startwerte) */
  FM.hash = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* ---------- Allgemeine Helfer ---------- */
  FM.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  FM.round1 = function (v) { return Math.round(v * 10) / 10; };
  FM.sum = function (arr, fn) { var s = 0; for (var i = 0; i < arr.length; i++) s += fn ? fn(arr[i]) : arr[i]; return s; };
  FM.avg = function (arr, fn) { return arr.length ? FM.sum(arr, fn) / arr.length : 0; };
  FM.byKey = function (key, desc) {
    return function (a, b) {
      var x = typeof key === 'function' ? key(a) : a[key];
      var y = typeof key === 'function' ? key(b) : b[key];
      if (x < y) return desc ? 1 : -1;
      if (x > y) return desc ? -1 : 1;
      return 0;
    };
  };
  FM.uid = (function () {
    var n = 0;
    return function (prefix) { n++; return (prefix || 'id') + Date.now().toString(36) + n.toString(36) + Math.floor(Math.random() * 1e6).toString(36); };
  })();

  FM.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* "beim FC …", "bei der SG …", "bei den Sportfreunden …", "bei Borussia …" */
  FM.atClub = function (name) {
    if (/^(SG|TSG|SpVgg)\b/.test(name)) return 'bei der ' + name;
    if (/^Sportfreunde\b/.test(name)) return 'bei den ' + name.replace(/^Sportfreunde/, 'Sportfreunden');
    if (/^(1\. )?(FC|SC|SV|VfB|VfL|VfR|TSV|FSV|KFC|SSV|MSV|BSC|KSV|SGV|TuS|FK)\b/.test(name) || /\b(SV|SC)$/.test(name)) return 'beim ' + name;
    if (/ Kickers$/.test(name)) return 'bei den ' + name;
    return 'bei ' + name;
  };

  /* ---------- Formatierung (deutsch) ---------- */
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  FM.fmtInt = function (v) { return nf0.format(v); };
  FM.fmtDec = function (v, d) { return (d === 2 ? nf2 : nf1).format(v); };

  /* Betraege werden intern in Euro gefuehrt */
  FM.fmtMoney = function (eur, opts) {
    var neg = eur < 0, a = Math.abs(eur), s;
    if (a >= 1e6) s = (a >= 1e8 ? nf0.format(a / 1e6) : nf1.format(a / 1e6).replace(/,0$/, '')) + ' Mio. €';
    else if (a >= 1e3) s = nf0.format(a / 1e3) + ' Tsd. €';
    else s = nf0.format(a) + ' €';
    if (opts && opts.sign && !neg && eur > 0) return '+' + s;
    return (neg ? '−' : '') + s;
  };
  FM.fmtMoneyShort = function (eur) {
    var a = Math.abs(eur), s;
    if (a >= 1e6) s = (a >= 1e8 ? nf0.format(a / 1e6) : nf1.format(a / 1e6).replace(/,0$/, '')) + ' Mio.';
    else if (a >= 1e3) s = nf0.format(a / 1e3) + ' Tsd.';
    else s = nf0.format(a);
    return (eur < 0 ? '−' : '') + s;
  };

  /* Kicker-Note 1,0 – 6,0 */
  FM.fmtGrade = function (g) { return g == null ? '–' : nf1.format(g); };

  /* ---------- Datum (ISO-Strings YYYY-MM-DD, UTC-basiert) ---------- */
  function parse(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function toIso(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  FM.date = {
    parse: parse,
    iso: function (y, m, d) { return y + '-' + pad(m) + '-' + pad(d); },
    add: function (iso, days) { return toIso(parse(iso) + days * 86400000); },
    diff: function (a, b) { return Math.round((parse(b) - parse(a)) / 86400000); },
    weekday: function (iso) { return new Date(parse(iso)).getUTCDay(); },
    year: function (iso) { return +iso.slice(0, 4); },
    month: function (iso) { return +iso.slice(5, 7); },
    fmt: function (iso) {
      var d = new Date(parse(iso));
      return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
    },
    fmtShort: function (iso) {
      var d = new Date(parse(iso));
      return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.';
    },
    fmtLong: function (iso) {
      var d = new Date(parse(iso));
      var wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getUTCDay()];
      return wd + ', ' + pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
    },
    weekdayName: function (iso) {
      return ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][new Date(parse(iso)).getUTCDay()];
    },
    monthName: function (iso) {
      return ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][+iso.slice(5, 7) - 1];
    }
  };
})();
