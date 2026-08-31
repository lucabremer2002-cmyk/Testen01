/* core.js - Zufallsgenerator, Formatierung, kleine Helfer */
(function (g) {
  'use strict';

  /* Deterministischer PRNG (mulberry32) - damit Spielstaende reproduzierbar sind. */
  function RNG(seed) {
    this.s = (seed >>> 0) || 1;
  }
  RNG.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  };
  RNG.prototype.float = function (min, max) {
    return min + this.next() * (max - min);
  };
  RNG.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };
  RNG.prototype.chance = function (p) {
    return this.next() < p;
  };
  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  /* Normalverteilung (Box-Muller), auf min/max begrenzt. */
  RNG.prototype.gauss = function (mean, sd, min, max) {
    var u = 1 - this.next(), v = this.next();
    var n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    var val = mean + n * sd;
    if (min !== undefined && val < min) val = min;
    if (max !== undefined && val > max) val = max;
    return val;
  };

  var Fmt = {
    money: function (v) {
      var neg = v < 0;
      v = Math.abs(Math.round(v));
      var s;
      if (v >= 1000000000) s = (v / 1000000000).toFixed(2).replace('.', ',') + ' Mrd.';
      else if (v >= 1000000) s = (v / 1000000).toFixed(v >= 10000000 ? 1 : 2).replace('.', ',') + ' Mio.';
      else if (v >= 1000) s = (v / 1000).toFixed(0) + ' Tsd.';
      else s = String(v);
      return (neg ? '-' : '') + s + ' €';
    },
    moneyExact: function (v) {
      var neg = v < 0;
      v = Math.abs(Math.round(v));
      return (neg ? '-' : '') + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
    },
    num: function (v) {
      return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },
    pct: function (v) { return Math.round(v * 100) + ' %'; },
    date: function (day, season) {
      /* Tag 0 = 1. Juli der Saison. */
      var d = new Date(Date.UTC(season, 6, 1));
      d.setUTCDate(d.getUTCDate() + day);
      var mn = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      return d.getUTCDate() + '. ' + mn[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    },
    weekday: function (day, season) {
      var d = new Date(Date.UTC(season, 6, 1));
      d.setUTCDate(d.getUTCDate() + day);
      return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getUTCDay()];
    },
    signed: function (v) { return (v > 0 ? '+' : '') + v; }
  };

  var Util = {
    clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sum: function (arr, fn) {
      var t = 0;
      for (var i = 0; i < arr.length; i++) t += fn ? fn(arr[i], i) : arr[i];
      return t;
    },
    byId: function (list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid: function (prefix, n) { return prefix + '_' + n; }
  };

  g.RNG = RNG;
  g.Fmt = Fmt;
  g.Util = Util;
})(typeof window !== 'undefined' ? window : globalThis);
