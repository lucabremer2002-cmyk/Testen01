/* ---------------------------------------------------------------------
   Klang, prozedural. Keine Dateien, kein Nachladen - alles aus
   Oszillatoren und Rauschen.

   Sparsam eingesetzt: Klick, Geld, Warnung, Erfolg, Ereignis. Ein
   Verwaltungsspiel, das bei jedem Mauszeiger piept, wird in zehn
   Minuten unertraeglich.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  var ctx = null, master = null, on = true;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function resume() {
    var c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!on) return;
    var c = ensure();
    if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, hp) {
    if (!on) return;
    var c = ensure();
    if (!c) return;
    var t = c.currentTime;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    var g = c.createGain(); g.gain.value = vol || 0.1;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  var S = {
    click:  function () { tone(660, 0.045, 'square', 0.035); },
    tap:    function () { tone(420, 0.05, 'triangle', 0.045); },
    cash:   function () { tone(880, 0.07, 'triangle', 0.10); setTimeout(function () { tone(1320, 0.11, 'triangle', 0.08); }, 55); },
    spend:  function () { tone(330, 0.09, 'sine', 0.09, 180); },
    good:   function () { [523, 659, 784].forEach(function (f, i) { setTimeout(function () { tone(f, 0.13, 'triangle', 0.075); }, i * 65); }); },
    bad:    function () { tone(190, 0.22, 'sawtooth', 0.07, 90); noise(0.14, 0.05, 400); },
    warn:   function () { tone(440, 0.10, 'square', 0.05); setTimeout(function () { tone(370, 0.14, 'square', 0.05); }, 110); },
    event:  function () { tone(294, 0.16, 'sine', 0.08); setTimeout(function () { tone(392, 0.22, 'sine', 0.07); }, 120); },
    rank:   function () { [392, 523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'triangle', 0.08); }, i * 85); }); },
    week:   function () { tone(523, 0.08, 'sine', 0.05); },
    open:   function () { tone(300, 0.12, 'sine', 0.05, 520); },
    close:  function () { tone(520, 0.09, 'sine', 0.04, 280); }
  };

  CE.audio = {
    play: function (name) { if (on && S[name]) { resume(); S[name](); } },
    setEnabled: function (v) { on = !!v; if (on) resume(); },
    enabled: function () { return on; },
    resume: resume
  };
})(typeof window !== 'undefined' ? window : globalThis);
