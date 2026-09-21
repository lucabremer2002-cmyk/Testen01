/*
 * Klang komplett aus dem Web-Audio-Synth: keine Dateien, keine Ladezeit.
 * Kurze Effekte plus eine leichte, loopende Begleitung.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var musicGain = null;
  var sfxGain = null;
  var muted = false;
  var started = false;
  var musicTimer = 0;
  var step = 0;
  var nextNoteTime = 0;
  var tempo = 132;
  var noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.connect(master);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(comp);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(comp);

    var len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(opts) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) {
      if (opts.glide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
      else osc.frequency.linearRampToValueAtTime(opts.to, t0 + opts.dur);
    }
    var vol = (opts.vol === undefined ? 0.3 : opts.vol);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack || 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    var node = osc;
    if (opts.filter) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.filter, t0);
      node.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(opts.bus === 'music' ? musicGain : sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  function noise(opts) {
    if (!ensure() || muted) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 900, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + opts.dur);
    f.Q.value = opts.q || 1.2;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(opts.vol === undefined ? 0.25 : opts.vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f);
    f.connect(gain);
    gain.connect(sfxGain);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  /* ------------------------------------------------------------- Effekte */

  var sfx = {
    jump: function () { tone({ type: 'triangle', freq: 420, to: 760, dur: 0.16, vol: 0.3, glide: 'exp' }); },
    doubleJump: function () {
      tone({ type: 'triangle', freq: 620, to: 1080, dur: 0.18, vol: 0.28, glide: 'exp' });
      noise({ freq: 2400, to: 4200, dur: 0.16, vol: 0.12, q: 0.8 });
    },
    dash: function () {
      noise({ freq: 700, to: 3200, dur: 0.26, vol: 0.22, q: 0.7 });
      tone({ type: 'sawtooth', freq: 180, to: 520, dur: 0.2, vol: 0.14, filter: 1600, glide: 'exp' });
    },
    land: function (hard) {
      noise({ type: 'lowpass', freq: hard ? 420 : 300, to: 120, dur: hard ? 0.16 : 0.1, vol: hard ? 0.24 : 0.12 });
    },
    bounce: function () {
      tone({ type: 'sine', freq: 200, to: 900, dur: 0.3, vol: 0.34, glide: 'exp' });
      tone({ type: 'square', freq: 400, to: 1400, dur: 0.22, vol: 0.1, glide: 'exp', delay: 0.01 });
    },
    gem: function (n) {
      var base = 880 * Math.pow(1.0595, (n || 0) % 8 * 2);
      tone({ type: 'sine', freq: base, dur: 0.14, vol: 0.3 });
      tone({ type: 'sine', freq: base * 2, dur: 0.22, vol: 0.18, delay: 0.04 });
    },
    checkpoint: function () {
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        tone({ type: 'triangle', freq: f, dur: 0.34, vol: 0.26, delay: i * 0.07 });
      });
    },
    hit: function () {
      tone({ type: 'sawtooth', freq: 320, to: 70, dur: 0.38, vol: 0.3, filter: 900, glide: 'exp' });
      noise({ freq: 600, to: 120, dur: 0.3, vol: 0.2 });
    },
    stomp: function () {
      tone({ type: 'square', freq: 180, to: 520, dur: 0.14, vol: 0.26, glide: 'exp' });
      noise({ freq: 1400, to: 300, dur: 0.14, vol: 0.18 });
    },
    boost: function () {
      tone({ type: 'sawtooth', freq: 260, to: 880, dur: 0.34, vol: 0.2, filter: 2400, glide: 'exp' });
      noise({ freq: 1200, to: 3600, dur: 0.3, vol: 0.14, q: 0.6 });
    },
    countdown: function (last) {
      tone({ type: 'square', freq: last ? 880 : 520, dur: last ? 0.5 : 0.22, vol: 0.3 });
      if (last) tone({ type: 'square', freq: 1320, dur: 0.5, vol: 0.16, delay: 0.02 });
    },
    finish: function (great) {
      var notes = great ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
      notes.forEach(function (f, i) {
        tone({ type: 'triangle', freq: f, dur: 0.55, vol: 0.3, delay: i * 0.1 });
        tone({ type: 'sine', freq: f * 2, dur: 0.5, vol: 0.14, delay: i * 0.1 });
      });
    },
    ui: function () { tone({ type: 'square', freq: 660, dur: 0.07, vol: 0.18 }); }
  };

  /* -------------------------------------------------------------- Musik */

  /* Zwei Takte in A-Moll-Pentatonik, freundlich und unaufdringlich. */
  var SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
  var MELODY = [0, 4, 2, 5, 3, 5, 6, 4, 2, 4, 0, 3, 5, 4, 2, 1];
  var BASS = [0, 0, 3, 3, 5, 5, 2, 2];

  function scheduleMusic() {
    if (!ctx || muted) return;
    var spb = 60 / tempo / 2;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      var t = nextNoteTime - ctx.currentTime;
      if (t < 0) t = 0;
      var s = step % 16;
      if (s % 2 === 0) {
        tone({ type: 'triangle', freq: SCALE[MELODY[s]] * 2, dur: spb * 1.6, vol: 0.12, delay: t, bus: 'music' });
      }
      if (s % 4 === 0) {
        tone({ type: 'sine', freq: SCALE[BASS[(step >> 1) % 8]] / 2, dur: spb * 3.4, vol: 0.2, delay: t, bus: 'music' });
      }
      if (s % 8 === 4) {
        tone({ type: 'triangle', freq: SCALE[MELODY[(s + 5) % 16]] * 3, dur: spb, vol: 0.05, delay: t, bus: 'music' });
      }
      step++;
      nextNoteTime += spb;
    }
  }

  var api = {
    unlock: function () {
      ensure();
      resume();
      started = true;
    },
    startMusic: function () {
      if (!ensure()) return;
      resume();
      if (musicTimer) return;
      nextNoteTime = ctx.currentTime + 0.1;
      musicTimer = root.setInterval(scheduleMusic, 90);
    },
    stopMusic: function () {
      if (musicTimer) { root.clearInterval(musicTimer); musicTimer = 0; }
    },
    setMusicIntensity: function (x) {
      if (!musicGain || !ctx) return;
      musicGain.gain.setTargetAtTime(0.14 + 0.16 * x, ctx.currentTime, 0.4);
    },
    toggleMute: function () {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.02);
      return muted;
    },
    isMuted: function () { return muted; },
    isReady: function () { return started; },
    sfx: sfx
  };

  root.MR = root.MR || {};
  root.MR.audio = api;
})(window);
