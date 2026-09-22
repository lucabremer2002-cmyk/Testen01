/*
 * Geist: zeichnet den Bestlauf auf und spielt ihn im naechsten Lauf ab.
 *
 * Aufgezeichnet wird mit fester Rate (20 Hz) die Position und Blickrichtung.
 * Das reicht fuer eine fluessige Wiedergabe und bleibt klein genug fuer den
 * localStorage: ein 70-Sekunden-Lauf sind rund 1400 Bilder a vier Zahlen.
 */
(function (root) {
  'use strict';

  var HZ = 20;
  var STRIDE = 4;

  function round2(v) { return Math.round(v * 100) / 100; }

  function Recorder(hz) {
    this.dt = 1 / (hz || HZ);
    this.hz = hz || HZ;
    this.next = 0;
    this.data = [];
  }

  Recorder.prototype.reset = function () {
    this.next = 0;
    this.data.length = 0;
  };

  /* Wird mit der Laufzeit aufgerufen; fuellt Luecken auf, damit der
     Zeitindex exakt bleibt. */
  Recorder.prototype.sample = function (t, p) {
    var guard = 0;
    while (t >= this.next && guard++ < 240) {
      this.data.push(round2(p.x), round2(p.y), round2(p.z), round2(p.yaw));
      this.next += this.dt;
    }
  };

  Recorder.prototype.finish = function (time) {
    return { hz: this.hz, time: time, n: this.data.length / STRIDE, d: this.data.slice() };
  };

  function Playback(rec) {
    this.rec = rec;
    this.hz = (rec && rec.hz) || HZ;
    this.frames = rec ? rec.n : 0;
    this.out = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, grounded: true, done: false };
  }

  /* Zustand des Geistes zum Zeitpunkt t (lineare Interpolation). */
  Playback.prototype.at = function (t) {
    var o = this.out;
    if (!this.rec || this.frames < 2) { o.done = true; return null; }
    var f = t * this.hz;
    var i = Math.floor(f);
    if (i >= this.frames - 1) {
      i = this.frames - 2;
      o.done = true;
    } else {
      o.done = false;
    }
    if (i < 0) i = 0;
    var k = Math.min(1, Math.max(0, f - i));
    var d = this.rec.d;
    var a = i * STRIDE, b = a + STRIDE;
    o.x = d[a] + (d[b] - d[a]) * k;
    o.y = d[a + 1] + (d[b + 1] - d[a + 1]) * k;
    o.z = d[a + 2] + (d[b + 2] - d[a + 2]) * k;
    var y0 = d[a + 3], y1 = d[b + 3];
    var dy = y1 - y0;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    o.yaw = y0 + dy * k;
    var dx = d[b] - d[a], dz = d[b + 2] - d[a + 2];
    o.speed = Math.hypot(dx, dz) * this.hz;
    o.grounded = Math.abs(d[b + 1] - d[a + 1]) < 0.06;
    return o;
  };

  /* Wie weit war der Geist zum Zeitpunkt t entlang der Strecke? Wird fuer
     den Live-Rueckstand benutzt. */
  Playback.prototype.nearestTimeTo = function (x, z, hintTime) {
    if (!this.rec || this.frames < 2) return null;
    var d = this.rec.d;
    var best = -1, bestD = 1e18;
    var from = 0, to = this.frames;
    if (hintTime !== undefined) {
      var c = Math.round(hintTime * this.hz);
      from = Math.max(0, c - Math.round(this.hz * 6));
      to = Math.min(this.frames, c + Math.round(this.hz * 6));
    }
    for (var i = from; i < to; i++) {
      var a = i * STRIDE;
      var dx = d[a] - x, dz = d[a + 2] - z;
      var dd = dx * dx + dz * dz;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best < 0) return null;
    return { time: best / this.hz, dist: Math.sqrt(bestD) };
  };

  root.MR = root.MR || {};
  root.MR.ghost = {
    HZ: HZ,
    Recorder: Recorder,
    Playback: Playback
  };
})(window);
