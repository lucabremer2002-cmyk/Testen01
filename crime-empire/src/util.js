/* ---------------------------------------------------------------------
   Werkzeugkasten: Zufall, Formate, kleine Helfer.

   Der Zufall ist bewusst *nicht* Math.random. Ein Spielstand speichert
   seinen Zufallszustand mit; wer laedt, bekommt dieselbe Zukunft wie
   vorher. Das macht Fehler reproduzierbar und erlaubt Tests ohne Browser.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  /* ----------------------------------------------------------- Zufall */

  /* Mulberry32 - 32 Bit Zustand, gute Verteilung, drei Zeilen. */
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
  /* [min,max) als Gleitkomma */
  Rng.prototype.range = function (min, max) { return min + this.next() * (max - min); };
  /* [min,max] als ganze Zahl */
  Rng.prototype.int = function (min, max) { return Math.floor(min + this.next() * (max - min + 1)); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  /* Gewichtete Wahl: Liste von {w: Gewicht, ...}. Null bei leerer Liste. */
  Rng.prototype.weighted = function (arr, weightOf) {
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += Math.max(0, weightOf ? weightOf(arr[i]) : arr[i].w);
    if (total <= 0) return null;
    var r = this.next() * total;
    for (i = 0; i < arr.length; i++) {
      var w = Math.max(0, weightOf ? weightOf(arr[i]) : arr[i].w);
      if (r < w) return arr[i];
      r -= w;
    }
    return arr[arr.length - 1];
  };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /* Glockenkurve ohne Ausreisser: Mittel dreier Ziehungen. */
  Rng.prototype.bell = function (min, max) {
    var a = (this.next() + this.next() + this.next()) / 3;
    return min + a * (max - min);
  };

  /* --------------------------------------------------------- Formate */

  /* Geld immer mit Vorzeichen-Logik der Anzeige: 1.234.567 -> $1.23M.
     Bis 100.000 in voller Laenge, damit fruehe Betraege genau lesbar sind. */
  function money(n) {
    var neg = n < 0;
    var v = Math.abs(Math.round(n));
    var s;
    if (v >= 1e9) s = trimZero((v / 1e9).toFixed(2)) + 'B';
    else if (v >= 1e6) s = trimZero((v / 1e6).toFixed(2)) + 'M';
    else if (v >= 1e5) s = trimZero((v / 1e3).toFixed(1)) + 'K';
    else s = group(v);
    return (neg ? '-$' : '$') + s;
  }
  function moneySigned(n) {
    var r = money(n);
    return n > 0 ? '+' + r : r;
  }
  function trimZero(s) { return s.replace(/\.?0+$/, ''); }
  function group(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(n, digits) { return (n * 100).toFixed(digits === undefined ? 0 : digits) + '%'; }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* Tag 0 ist der 1. Maerz eines Startjahres - reine Anzeige, die Logik
     rechnet ausschliesslich in Tagen seit Spielbeginn. */
  function dateLabel(day) {
    var y = Math.floor(day / 364);
    var rest = day % 364;
    var m = Math.floor(rest / 30.333);
    if (m > 11) m = 11;
    var d = Math.floor(rest - m * 30.333) + 1;
    return MONTHS[m] + ' ' + d + ', ' + (2027 + y);
  }
  function weekOf(day) { return Math.floor(day / 7) + 1; }

  /* ----------------------------------------------------------- Helfer */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function sum(arr, f) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += f ? f(arr[i], i) : arr[i];
    return t;
  }
  /* Tiefe Kopie ueber JSON - der Spielstand enthaelt nur schlichte Daten,
     deshalb reicht das und ist schneller als jede Handarbeit. */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Fortlaufende Kennungen je Spielstand, damit Verweise stabil bleiben. */
  function nextId(state, prefix) {
    state.idc = (state.idc || 0) + 1;
    return prefix + state.idc;
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Text sicher machen - alles, was aus Namen kommt, laeuft hier durch,
     bevor es als HTML gesetzt wird. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  CE.util = {
    Rng: Rng, money: money, moneySigned: moneySigned, pct: pct, group: group,
    dateLabel: dateLabel, weekOf: weekOf, clamp: clamp, sum: sum, clone: clone,
    nextId: nextId, byId: byId, esc: esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
