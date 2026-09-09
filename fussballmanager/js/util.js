/*
 * util.js - Zufallszahlen, Kalender, Formatierung, kleine Helfer.
 * Enthaelt bewusst keinen DOM-Zugriff, damit die Spiellogik auch
 * ausserhalb des Browsers (z.B. in einem Testlauf) laufen kann.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};

  // ------------------------------------------------------------ Zufall

  // mulberry32: schnell, deterministisch, Zustand passt in eine Zahl.
  function Rng(seed) {
    this.s = (seed >>> 0) || 1;
  }

  Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Ganzzahl aus [a, b] einschliesslich beider Grenzen. */
  Rng.prototype.int = function (a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  };

  /** Gleitkommazahl aus [a, b). */
  Rng.prototype.range = function (a, b) {
    return a + this.next() * (b - a);
  };

  Rng.prototype.chance = function (p) {
    return this.next() < p;
  };

  Rng.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };

  /** Normalverteilung ueber Box-Muller, auf +-3 Sigma begrenzt. */
  Rng.prototype.gauss = function (mean, sd) {
    var u = 1 - this.next();
    var v = this.next();
    var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    if (z > 3) z = 3;
    if (z < -3) z = -3;
    return mean + z * sd;
  };

  /** Fisher-Yates, veraendert das uebergebene Array. */
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /** Gewichtete Auswahl. weightFn liefert ein Gewicht >= 0. */
  Rng.prototype.weighted = function (items, weightFn) {
    if (!items || !items.length) return undefined;
    var total = 0, i, w, weights = [];
    for (i = 0; i < items.length; i++) {
      w = Math.max(0, weightFn(items[i], i));
      weights.push(w);
      total += w;
    }
    if (total <= 0) return items[Math.floor(this.next() * items.length)];
    var r = this.next() * total;
    for (i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  /** Zieht n verschiedene Elemente. */
  Rng.prototype.sample = function (arr, n) {
    var copy = arr.slice();
    this.shuffle(copy);
    return copy.slice(0, n);
  };

  // ------------------------------------------------------------ Mathe

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function round(v, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round(v * f) / f;
  }
  function avg(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }
  function sum(arr) {
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s;
  }

  // ------------------------------------------------------------ Kalender
  //
  // Datumsangaben werden intern als fortlaufende Tagesnummer gefuehrt
  // (Tage seit dem 01.01.1970, proleptisch gregorianisch). Das umgeht
  // Zeitzonen- und Sommerzeitprobleme des Date-Objekts vollstaendig.

  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag',
    'Freitag', 'Samstag', 'Sonntag'];
  var WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  /** Tage seit 1970-01-01 (Algorithmus days_from_civil). */
  function toDay(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor((y >= 0 ? y : y - 399) / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }

  /** Umkehrung von toDay. */
  function fromDay(z) {
    z += 719468;
    var era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m: m, d: d };
  }

  /** 0 = Montag ... 6 = Sonntag. */
  function weekday(day) {
    return ((day + 3) % 7 + 7) % 7;
  }

  function fmtDate(day, style) {
    var t = fromDay(day);
    if (style === 'kurz') return t.d + '.' + t.m + '.';
    if (style === 'lang') {
      return WOCHENTAGE[weekday(day)] + ', ' + t.d + '. ' + MONATE[t.m - 1] + ' ' + t.y;
    }
    if (style === 'wt') {
      return WOCHENTAGE_KURZ[weekday(day)] + ' ' + t.d + '.' + MONATE_KURZ[t.m - 1];
    }
    return pad2(t.d) + '.' + pad2(t.m) + '.' + t.y;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /** Naechster Wochentag ab (einschliesslich) day. wd: 0=Mo. */
  function nextWeekday(day, wd) {
    var diff = (wd - weekday(day) + 7) % 7;
    return day + diff;
  }

  // ------------------------------------------------------------ Formate

  /** Geldbetrag in Euro, kompakt: 12,5 Mio. EUR / 850 Tsd. EUR / 4.200 EUR */
  function money(v) {
    var neg = v < 0;
    v = Math.abs(v);
    var s;
    if (v >= 1e9) s = num(v / 1e9, 2) + ' Mrd. €';
    else if (v >= 1e6) s = num(v / 1e6, v >= 1e7 ? 1 : 2) + ' Mio. €';
    else if (v >= 1e4) s = num(Math.round(v / 1e3), 0) + ' Tsd. €';
    else s = num(Math.round(v), 0) + ' €';
    return (neg ? '-' : '') + s;
  }

  /** Zahl mit deutschem Tausendertrennzeichen und Komma. */
  function num(v, digits) {
    digits = digits || 0;
    var s = Math.abs(v).toFixed(digits);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (v < 0 ? '-' : '') + parts.join(',');
  }

  /** Kicker-Note 1,0 bis 6,0 mit deutschem Komma. */
  function note(v) {
    return num(v, 1);
  }

  function pct(v, digits) { return num(v * 100, digits === undefined ? 0 : digits) + ' %'; }

  /** "Max Mustermann" -> "M. Mustermann" */
  function kurzName(p) {
    return p.vorname.charAt(0) + '. ' + p.nachname;
  }

  // ------------------------------------------------------------ Sammlungen

  function sortBy(arr, fn, desc) {
    var copy = arr.slice();
    copy.sort(function (a, b) {
      var va = fn(a), vb = fn(b);
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
    return copy;
  }

  function groupBy(arr, fn) {
    var out = {};
    for (var i = 0; i < arr.length; i++) {
      var k = fn(arr[i]);
      (out[k] = out[k] || []).push(arr[i]);
    }
    return out;
  }

  function byId(arr) {
    var out = {};
    for (var i = 0; i < arr.length; i++) out[arr[i].id] = arr[i];
    return out;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var idCounter = 0;
  function nextId(prefix) {
    idCounter += 1;
    return (prefix || 'x') + idCounter;
  }
  function resetIds(v) { idCounter = v || 0; }
  function currentId() { return idCounter; }

  FM.util = {
    Rng: Rng,
    clamp: clamp, lerp: lerp, round: round, avg: avg, sum: sum,
    toDay: toDay, fromDay: fromDay, weekday: weekday, fmtDate: fmtDate,
    nextWeekday: nextWeekday, pad2: pad2,
    MONATE: MONATE, MONATE_KURZ: MONATE_KURZ,
    WOCHENTAGE: WOCHENTAGE, WOCHENTAGE_KURZ: WOCHENTAGE_KURZ,
    money: money, num: num, note: note, pct: pct, kurzName: kurzName,
    sortBy: sortBy, groupBy: groupBy, byId: byId, clone: clone,
    nextId: nextId, resetIds: resetIds, currentId: currentId
  };

})(typeof window !== 'undefined' ? window : globalThis);
