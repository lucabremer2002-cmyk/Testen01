/*
 * Maschinengeraeusche, vollstaendig mit der Web Audio API synthetisiert.
 *
 *   Motor      Brummen mit doppelter Netzfrequenz, sinkt unter Last (Schlupf)
 *   Getriebe   Zahneingriffsfrequenz proportional zur Spindeldrehzahl
 *   Schnitt    bandbegrenztes Rauschen, moduliert mit der Schneidenfrequenz
 *   Rattern    Ton bei der Eigenfrequenz des schwingenden Systems
 *   Quietschen reibende, stumpfe Schneide
 *   KSS        Plaetschern des Kuehlschmierstoffs
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  function Klang() {
    this.ctx = null;
    this.an = true;
    this.vol = 0.6;
    this.bereit = false;
  }

  Klang.prototype.start = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { this.ctx.resume(); }
      return;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { return; }
    try {
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    var c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.an ? this.vol : 0;
    var komp = c.createDynamicsCompressor();
    komp.threshold.value = -14;
    komp.ratio.value = 4;
    this.master.connect(komp);
    komp.connect(c.destination);

    // Rauschpuffer (2 s, weiss)
    var len = c.sampleRate * 2;
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
    this.rauschen = buf;

    // Motor
    this.motorOsc = c.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.value = 100;
    var motorLp = c.createBiquadFilter();
    motorLp.type = 'lowpass';
    motorLp.frequency.value = 380;
    this.motorGain = c.createGain();
    this.motorGain.gain.value = 0;
    this.motorOsc.connect(motorLp);
    motorLp.connect(this.motorGain);
    this.motorGain.connect(this.master);
    this.motorOsc.start();

    // Getriebe / Spindel
    this.getrOsc = c.createOscillator();
    this.getrOsc.type = 'triangle';
    this.getrGain = c.createGain();
    this.getrGain.gain.value = 0;
    this.getrOsc.connect(this.getrGain);
    this.getrGain.connect(this.master);
    this.getrOsc.start();

    // Schnittgeraeusch mit Amplitudenmodulation durch die Schneiden
    this.schnittQ = c.createBufferSource();
    this.schnittQ.buffer = buf;
    this.schnittQ.loop = true;
    this.schnittBp = c.createBiquadFilter();
    this.schnittBp.type = 'bandpass';
    this.schnittBp.frequency.value = 1200;
    this.schnittBp.Q.value = 0.9;
    this.schnittGain = c.createGain();
    this.schnittGain.gain.value = 0;
    this.amGain = c.createGain();
    this.amGain.gain.value = 0.6;
    this.amOsc = c.createOscillator();
    this.amOsc.frequency.value = 30;
    this.amTiefe = c.createGain();
    this.amTiefe.gain.value = 0.4;
    this.amOsc.connect(this.amTiefe);
    this.amTiefe.connect(this.amGain.gain);
    this.schnittQ.connect(this.schnittBp);
    this.schnittBp.connect(this.amGain);
    this.amGain.connect(this.schnittGain);
    this.schnittGain.connect(this.master);
    this.schnittQ.start();
    this.amOsc.start();

    // Rattern
    this.ratterOsc = c.createOscillator();
    this.ratterOsc.type = 'sine';
    this.ratterOsc.frequency.value = 900;
    this.ratterOsc2 = c.createOscillator();
    this.ratterOsc2.type = 'square';
    this.ratterOsc2.frequency.value = 1800;
    var ratterBp = c.createBiquadFilter();
    ratterBp.type = 'bandpass';
    ratterBp.Q.value = 6;
    ratterBp.frequency.value = 1800;
    this.ratterBp = ratterBp;
    this.ratterGain = c.createGain();
    this.ratterGain.gain.value = 0;
    this.ratterOsc.connect(this.ratterGain);
    this.ratterOsc2.connect(ratterBp);
    var r2g = c.createGain();
    r2g.gain.value = 0.25;
    ratterBp.connect(r2g);
    r2g.connect(this.ratterGain);
    this.ratterGain.connect(this.master);
    this.ratterOsc.start();
    this.ratterOsc2.start();

    // Quietschen
    this.quiOsc = c.createOscillator();
    this.quiOsc.type = 'sawtooth';
    this.quiOsc.frequency.value = 2600;
    var quiBp = c.createBiquadFilter();
    quiBp.type = 'bandpass';
    quiBp.frequency.value = 2600;
    quiBp.Q.value = 12;
    this.quiGain = c.createGain();
    this.quiGain.gain.value = 0;
    this.quiOsc.connect(quiBp);
    quiBp.connect(this.quiGain);
    this.quiGain.connect(this.master);
    this.quiOsc.start();

    // Kuehlschmierstoff
    var kq = c.createBufferSource();
    kq.buffer = buf;
    kq.loop = true;
    kq.playbackRate.value = 0.7;
    var khp = c.createBiquadFilter();
    khp.type = 'highpass';
    khp.frequency.value = 2500;
    this.kssGain = c.createGain();
    this.kssGain.gain.value = 0;
    kq.connect(khp);
    khp.connect(this.kssGain);
    this.kssGain.connect(this.master);
    kq.start();

    this.bereit = true;
  };

  Klang.prototype.setAn = function (an) {
    this.an = an;
    if (this.master) { this.master.gain.setTargetAtTime(an ? this.vol : 0, this.ctx.currentTime, 0.05); }
  };

  Klang.prototype.setVol = function (v) {
    this.vol = v;
    if (this.master && this.an) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  };

  function ziel(param, wert, t, tau) {
    param.setTargetAtTime(wert, t, tau || 0.06);
  }

  // z: { n, nMax, last, schnitt (0..1), vc, schneiden, ratter (µm), ratterF, quietsch (0..1), kss }
  Klang.prototype.update = function (z) {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    var lauf = Math.min(1, z.n / Math.max(z.nMax || 1000, 1) * 4);
    var motor = z.n > 1 ? 1 : 0;
    ziel(this.motorOsc.frequency, 100 * (1 - 0.06 * Math.min(1.5, z.last || 0)), t, 0.1);
    ziel(this.motorGain.gain, motor * (0.05 + 0.03 * Math.min(1, z.last || 0)) * Math.max(0.25, lauf), t, 0.15);
    ziel(this.getrOsc.frequency, Math.max(20, z.n / 60 * 23), t, 0.05);
    ziel(this.getrGain.gain, motor * 0.018 * lauf, t, 0.1);
    var s = Math.min(1, z.schnitt || 0);
    ziel(this.schnittGain.gain, 0.32 * Math.sqrt(s), t, 0.04);
    ziel(this.schnittBp.frequency, 500 + Math.min(4500, (z.vc || 0) * 14), t, 0.08);
    ziel(this.amOsc.frequency, Math.max(2, z.n / 60 * (z.schneiden || 2)), t, 0.05);
    var ra = Math.min(1, (z.ratter || 0) / 30);
    var rf = z.ratterF || 900;
    while (rf > 3200) { rf /= 2; }
    while (rf < 350) { rf *= 2; }
    ziel(this.ratterOsc.frequency, rf, t, 0.05);
    ziel(this.ratterOsc2.frequency, rf * 2, t, 0.05);
    ziel(this.ratterBp.frequency, rf * 2, t, 0.05);
    ziel(this.ratterGain.gain, 0.22 * ra, t, 0.05);
    var q = Math.min(1, z.quietsch || 0);
    ziel(this.quiOsc.frequency, 2300 + 600 * Math.sin(t * 7), t, 0.05);
    ziel(this.quiGain.gain, 0.05 * q, t, 0.08);
    ziel(this.kssGain.gain, z.kss ? 0.03 : 0, t, 0.2);
  };

  Klang.prototype.stille = function () {
    this.update({ n: 0, last: 0, schnitt: 0 });
  };

  function ping(c, ziel, f, dauer, lautst, start) {
    var o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    var g = c.createGain();
    g.gain.setValueAtTime(lautst, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
    o.connect(g);
    g.connect(ziel);
    o.start(start);
    o.stop(start + dauer + 0.05);
  }

  function burst(self, dauer, f0, f1, lautst) {
    var c = self.ctx, t = c.currentTime;
    var q = c.createBufferSource();
    q.buffer = self.rauschen;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, t);
    lp.frequency.exponentialRampToValueAtTime(f1, t + dauer);
    var g = c.createGain();
    g.gain.setValueAtTime(lautst, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(lp);
    lp.connect(g);
    g.connect(self.master);
    q.start(t);
    q.stop(t + dauer + 0.05);
  }

  // Werkzeugbruch: trockener Knall mit metallischem Nachklang
  Klang.prototype.bruch = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    burst(this, 0.22, 9000, 600, 0.9);
    ping(this.ctx, this.master, 2340, 0.7, 0.22, t);
    ping(this.ctx, this.master, 3871, 0.5, 0.16, t);
    ping(this.ctx, this.master, 5233, 0.35, 0.12, t);
    ping(this.ctx, this.master, 7410, 0.25, 0.08, t + 0.01);
  };

  Klang.prototype.kollision = function () {
    if (!this.bereit) { return; }
    var c = this.ctx, t = c.currentTime;
    burst(this, 0.6, 4000, 200, 1.0);
    var o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    var g = c.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
    ping(c, this.master, 1220, 1.2, 0.2, t + 0.02);
    ping(c, this.master, 1910, 0.9, 0.15, t + 0.02);
  };

  Klang.prototype.klick = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    ping(this.ctx, this.master, 1800, 0.05, 0.08, t);
  };

  Klang.prototype.alarm = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime, i;
    for (i = 0; i < 3; i++) {
      ping(this.ctx, this.master, 880, 0.12, 0.12, t + i * 0.25);
      ping(this.ctx, this.master, 660, 0.12, 0.12, t + i * 0.25 + 0.12);
    }
  };

  Klang.prototype.erfolg = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    ping(this.ctx, this.master, 523, 0.5, 0.12, t);
    ping(this.ctx, this.master, 659, 0.5, 0.12, t + 0.1);
    ping(this.ctx, this.master, 784, 0.8, 0.12, t + 0.2);
  };

  ZM.Klang = Klang;
})(typeof window !== 'undefined' ? window : globalThis);
