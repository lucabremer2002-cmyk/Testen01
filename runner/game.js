/*
 * NEON DASH - 2D-Endlosrunner ohne Framework und ohne Abhaengigkeiten.
 *
 * Enthalten sind unter anderem:
 *   - endlos erzeugte Strecke aus Bausteinen (Gruben, Treppen, Saegen, Drohnen)
 *   - Sprung mit variabler Hoehe, Doppelsprung, Coyote-Time und Sprungpuffer
 *   - Rutschen, Dash (zerlegt Kisten), Schnellfall
 *   - Power-ups: Schild, Magnet, doppelte Punkte, Zeitlupe
 *   - Hyper-Modus: Leiste fuellen, dann als unverwundbarer Regenbogenkomet fliegen
 *   - Kombo-Zaehler, Beinahe-Treffer-Bonus, Zonen mit wechselnder Farbwelt
 *   - Partikel, Bildschirmwackeln, Zeitlupe und prozedurale Musik per WebAudio
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Konstanten

  var W = 960;                  // logische Breite der Zeichenflaeche
  var H = 540;                  // logische Hoehe
  var GROUND_Y = 424;           // Oberkante des Bodens
  var PLAYER_X = 210;           // Grundposition der Figur auf dem Bildschirm
  var STEP = 1 / 120;           // fester Physikschritt in Sekunden
  var PX_PER_M = 12;            // Weltpixel pro Meter

  var GRAVITY = 2500;
  var JUMP_V = 860;             // ergibt rund 152 px Sprunghoehe
  var JUMP_CUT = 0.42;          // Restimpuls beim fruehen Loslassen
  var MIN_JUMP_HOLD = 0.055;    // vorher wird nie gekappt - jeder Tipp huepft sichtbar
  var COYOTE = 0.12;            // Gnadenfrist nach dem Verlassen der Kante
  var INPUT_BUFFER = 0.15;      // so lange wartet ein zu frueh gedrueckter Knopf
  var FAST_FALL = 2.6;
  var APEX_VY = 190;            // Geschwindigkeitsfenster um den Scheitelpunkt
  var APEX_GRAVITY = 0.62;      // dort haengt die Figur laenger in der Luft
  var FALL_GRAVITY = 1.25;      // dafuer faellt sie danach zackiger

  var LEAN_BACK = 95;           // so weit laesst sich die Figur zuruecknehmen
  var LEAN_FWD = 205;           // und so weit nach vorn schieben
  var LEAN_SPEED = 360;         // px/s beim Lenken
  var LEAN_HOME = 175;          // px/s zurueck auf die Grundposition

  var SPEED_MIN = 360;
  var SPEED_MAX = 960;
  var SPEED_RAMP = 26000;       // Weltpixel bis zur Hoechstgeschwindigkeit

  var DASH_TIME = 0.26;
  var DASH_CD = 1.05;
  var DASH_BOOST = 640;

  var SLIDE_MIN = 0.20;         // kuerzestes Rutschen, damit ein Tipp nicht zuckt
  var SLIDE_MAX = 1.20;         // laenger nur, solange etwas ueber dem Kopf haengt
  var SLIDE_CD = 0.20;

  var PW = 36;                  // Breite der Figur
  var PH = 48;                  // Hoehe stehend
  var PH_SLIDE = 26;            // Hoehe rutschend

  var HYPER_TIME = 7;
  var HYPER_PER_COIN = 2.4;     // Prozent Ladung pro Muenze
  var HYPER_PER_NEAR = 5;

  var ZONE_LENGTH = 650;        // Meter pro Zone
  var MAX_PARTS = 420;

  var ZONES = [
    { name: 'NEONSTADT',    hue: 288 },
    { name: 'KRISTALLTAL',  hue: 190 },
    { name: 'LAVAFELD',     hue: 8 },
    { name: 'GIFTDSCHUNGEL', hue: 122 },
    { name: 'TIEFSEE',      hue: 218 },
    { name: 'SONNENSTURM',  hue: 42 },
    { name: 'MAGENTAWUESTE', hue: 322 }
  ];

  var POWERS = {
    shield: { label: 'SCHILD',  dur: 0,  hue: 190 },
    magnet: { label: 'MAGNET',  dur: 9,  hue: 330 },
    x2:     { label: 'X2',      dur: 10, hue: 48 },
    slow:   { label: 'ZEITLUPE', dur: 6, hue: 265 }
  };

  var STORE_BEST = 'neondash.best';
  var STORE_DIST = 'neondash.dist';
  var STORE_COINS = 'neondash.coins';
  var STORE_MUTE = 'neondash.mute';

  // ------------------------------------------------------------ Hilfsfunktionen

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function hsl(h, s, l, a) {
    h = ((h % 360) + 360) % 360;
    if (a === undefined) a = 1;
    return 'hsla(' + h.toFixed(1) + ',' + s + '%,' + l + '%,' + a + ')';
  }

  // Stabiler Pseudozufall fuer die Hintergrundebenen: gleicher Index, gleiche Form.
  function hash(n) {
    var x = Math.sin(n * 127.1 + 11.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Kuerzester Abstand zweier Rechtecke (0 bei Ueberlappung).
  function rectGap(a, b) {
    var dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
    var dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function load(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function save(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (e) { /* egal */ }
  }

  // -------------------------------------------------------------------- Audio

  var Sound = (function () {
    var ctx = null, master = null, musicGain = null, noiseBuf = null;
    var enabled = load(STORE_MUTE, '0') !== '1';
    var nextNote = 0, stepIndex = 0;

    // Basslauf in Halbtoenen ueber dem Grundton, 16 Achtel lang.
    var SEQ = [0, 0, 7, 0, 5, 5, 0, 5, 3, 3, 10, 3, 7, 7, 5, 3];

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.24;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.32;
      musicGain.connect(master);

      var n = ctx.sampleRate * 0.4;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    function tone(freq, dur, type, vol, glide, when, dest) {
      if (!enabled) return;
      var c = ensure();
      if (!c) return;
      var t = when || c.currentTime;
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq), t);
      if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol === undefined ? 0.3 : vol), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(dest || master);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    function noise(dur, vol, when, dest) {
      if (!enabled) return;
      var c = ensure();
      if (!c) return;
      var t = when || c.currentTime;
      var s = c.createBufferSource();
      s.buffer = noiseBuf;
      var f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2400;
      var g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest || master);
      s.start(t);
      s.stop(t + dur + 0.02);
    }

    return {
      isOn: function () { return enabled; },
      resume: function () {
        var c = ensure();
        if (c && c.state === 'suspended') c.resume();
      },
      toggle: function () {
        enabled = !enabled;
        save(STORE_MUTE, enabled ? '0' : '1');
        if (enabled) this.resume();
        return enabled;
      },
      jump:   function () { tone(320, 0.16, 'square', 0.26, 620); },
      dJump:  function () { tone(480, 0.18, 'triangle', 0.26, 900); noise(0.08, 0.08); },
      land:   function () { tone(150, 0.08, 'sine', 0.2, 90); },
      slide:  function () { noise(0.22, 0.14); tone(220, 0.2, 'sawtooth', 0.1, 90); },
      dash:   function () { tone(180, 0.22, 'sawtooth', 0.24, 900); noise(0.16, 0.14); },
      coin:   function (combo) {
        var step = Math.min(combo, 16);
        tone(660 * Math.pow(2, step / 24), 0.1, 'triangle', 0.24, 1320 * Math.pow(2, step / 24));
      },
      power:  function () {
        tone(520, 0.1, 'square', 0.22, 780);
        tone(780, 0.18, 'square', 0.2, 1180, ensure() ? ctx.currentTime + 0.09 : 0);
      },
      near:   function () { tone(1200, 0.09, 'sine', 0.16, 1900); },
      hyper:  function () {
        var c = ensure();
        if (!c) return;
        for (var i = 0; i < 7; i++) {
          tone(220 * Math.pow(2, i / 4), 0.22, 'sawtooth', 0.2, 440 * Math.pow(2, i / 4), c.currentTime + i * 0.055);
        }
      },
      hit: function () {
        tone(220, 0.5, 'sawtooth', 0.3, 40);
        noise(0.4, 0.22);
      },
      // Einfacher Sequencer: plant Noten bis 150 ms im Voraus.
      music: function (speedFactor, hyper, running) {
        if (!enabled) return;
        var c = ensure();
        if (!c) return;
        if (!running) { nextNote = 0; return; }
        var bpm = 116 + speedFactor * 46 + (hyper ? 34 : 0);
        var dur = 30 / bpm;
        if (nextNote < c.currentTime) nextNote = c.currentTime + 0.03;
        var guard = 0;
        while (nextNote < c.currentTime + 0.15 && guard++ < 16) {
          var s = stepIndex % 16;
          var root = hyper ? 82.4 : 55;
          var f = root * Math.pow(2, SEQ[s] / 12);
          tone(f, dur * 0.92, 'sawtooth', 0.16, 0, nextNote, musicGain);
          if (s % 4 === 0) noise(0.05, 0.09, nextNote, musicGain);
          if (s % 8 === 4) tone(f * 2, dur * 0.5, 'square', 0.05, 0, nextNote, musicGain);
          if (hyper && s % 2 === 1) tone(f * 4, dur * 0.4, 'square', 0.05, 0, nextNote, musicGain);
          nextNote += dur;
          stepIndex++;
        }
      }
    };
  }());

  // ------------------------------------------------------------------ Zustand

  var canvas = document.getElementById('game');
  var ctx2d = canvas.getContext('2d');

  var el = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    meters: document.getElementById('meters'),
    zone: document.getElementById('zone'),
    coins: document.getElementById('coins'),
    combo: document.getElementById('combo'),
    powers: document.getElementById('powers'),
    hyperWrap: document.getElementById('hyperWrap'),
    hyperFill: document.getElementById('hyperFill'),
    hyperLabel: document.getElementById('hyperLabel'),
    toast: document.getElementById('toast'),
    overlay: document.getElementById('overlay'),
    ovTitle: document.getElementById('ovTitle'),
    ovText: document.getElementById('ovText'),
    ovStats: document.getElementById('ovStats'),
    ovBtn: document.getElementById('ovBtn'),
    touch: document.getElementById('touch'),
    btnHyper: document.getElementById('btnHyper'),
    soundState: document.getElementById('soundState')
  };

  var records = {
    best: parseInt(load(STORE_BEST, '0'), 10) || 0,
    dist: parseInt(load(STORE_DIST, '0'), 10) || 0,
    coins: parseInt(load(STORE_COINS, '0'), 10) || 0
  };

  var state = 'ready';          // ready | play | pause | over
  var G = null;                 // Laufender Spielzustand

  // Tastatur, Beruehrung und Gamepad melden alle dieselben Aktionen an. Jede
  // merkt sich, ob sie gehalten wird und wann sie zuletzt gedrueckt wurde -
  // daraus entsteht der Eingabepuffer, der zu fruehe Druecke aufhebt.
  var ACTIONS = ['jump', 'slide', 'dash', 'hyper', 'left', 'right'];
  var input = {};
  (function () {
    for (var i = 0; i < ACTIONS.length; i++) input[ACTIONS[i]] = { held: false, buffer: 0 };
  }());

  function press(name) {
    var a = input[name];
    if (!a) return;
    a.buffer = INPUT_BUFFER;
    a.held = true;
  }

  function release(name) {
    var a = input[name];
    if (a) a.held = false;
  }

  function held(name) { return input[name].held; }

  function releaseAll() {
    for (var i = 0; i < ACTIONS.length; i++) {
      input[ACTIONS[i]].held = false;
      input[ACTIONS[i]].buffer = 0;
    }
  }

  function newGame() {
    G = {
      time: 0,
      worldX: 0,
      speed: SPEED_MIN,
      dist: 0,
      score: 0,
      coins: 0,
      combo: 0,
      comboTimer: 0,
      bestCombo: 0,
      nearMisses: 0,

      py: GROUND_Y - PH,
      vy: 0,
      h: PH,
      onGround: true,
      coyote: COYOTE,
      jumps: 0,
      sliding: false,
      slideT: 0,
      slideCD: 0,
      dashT: 0,
      dashCD: 0,
      inv: 0,
      shield: 0,
      run: 0,                   // Laufanimation
      screenX: PLAYER_X,        // Bildschirmposition, per Lenken verschiebbar
      lean: 0,
      jumpAge: 9,               // Zeit seit dem letzten Absprung
      cutArmed: false,          // darf der laufende Sprung noch gekappt werden?

      hyperT: 0,
      meter: 0,
      hyperUses: 0,
      powers: {},

      platforms: [],
      obstacles: [],
      coinList: [],
      pickups: [],
      parts: [],
      texts: [],
      trail: [],

      genX: 0,
      chunk: 0,
      lastPowerChunk: -99,
      zone: 0,
      hue: ZONES[0].hue,
      hueTarget: ZONES[0].hue,

      shake: 0,
      flash: 0,
      flashHue: 0,
      timeScale: 1,
      slowT: 0
    };
    buildWorld();
  }

  // ------------------------------------------------------- Streckenerzeugung

  function ground(x, w) {
    G.platforms.push({ x: x, y: GROUND_Y, w: w, h: H - GROUND_Y + 120, solid: true });
  }

  function ledge(x, y, w) {
    G.platforms.push({ x: x, y: y, w: w, h: 18, solid: false });
  }

  function coin(x, y) {
    G.coinList.push({ x: x, y: y, r: 11, got: false, vx: 0, vy: 0, phase: Math.random() * 6.283 });
  }

  function coinLine(x, y, n, gap) {
    for (var i = 0; i < n; i++) coin(x + i * gap, y);
  }

  function coinArc(x, y, n, width, height) {
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      coin(x + t * width, y - Math.sin(t * Math.PI) * height);
    }
  }

  function coinWave(x, y, n, gap, amp) {
    for (var i = 0; i < n; i++) coin(x + i * gap, y + Math.sin(i * 0.7) * amp);
  }

  function spike(x) {
    G.obstacles.push({ type: 'spike', x: x, y: GROUND_Y - 30, w: 30, h: 30, dead: 0, gap: 999, passed: false });
  }

  function crate(x, tall) {
    var h = tall ? 96 : 64;
    G.obstacles.push({ type: 'crate', x: x, y: GROUND_Y - h, w: 46, h: h, dead: 0, gap: 999, passed: false });
  }

  function saw(x, y, amp) {
    G.obstacles.push({
      type: 'saw', x: x, y: y, r: 30, w: 60, h: 60,
      amp: amp || 0, spd: rand(1.6, 2.6), phase: Math.random() * 6.283,
      dead: 0, gap: 999, passed: false
    });
  }

  function drone(x) {
    G.obstacles.push({
      type: 'drone', x: x, y: GROUND_Y - 68, w: 58, h: 30,
      phase: Math.random() * 6.283, dead: 0, gap: 999, passed: false
    });
  }

  function pickup(x, y, kind) {
    G.pickups.push({ x: x, y: y, r: 20, kind: kind, got: false, phase: Math.random() * 6.283 });
  }

  // Ein Baustein der Strecke; jeder setzt G.genX weiter.
  function buildWorld() {
    var guard = 0;
    while (G.genX < G.worldX + W + 900 && guard++ < 40) buildChunk();
  }

  function buildChunk() {
    var d = clamp(G.dist / 2600, 0, 1);          // Schwierigkeit 0..1
    var i = G.chunk++;

    if (i < 2) { chunkStart(760); return; }      // ruhiger, hindernisfreier Einstieg

    // Alle paar Bausteine gibt es garantiert etwas zu holen.
    if (i - G.lastPowerChunk >= 7) { chunkTreasure(d); return; }

    var r = Math.random();
    if (r < 0.20) chunkFlat(rand(420, 620), d);
    else if (r < 0.38) chunkPit(d);
    else if (r < 0.52) chunkStairs(d);
    else if (r < 0.66) chunkDrones(d);
    else if (r < 0.79) chunkSaws(d);
    else if (r < 0.90) chunkCrates(d);
    else chunkTreasure(d);
  }

  // Die ersten Bausteine bleiben leer: die Figur startet bei x = PLAYER_X und
  // braucht Anlauf, bevor das erste Hindernis auftauchen darf.
  function chunkStart(len) {
    ground(G.genX, len);
    coinLine(G.genX + 420, GROUND_Y - 60, 6, 40);
    G.genX += len;
  }

  function chunkFlat(len, d) {
    var x = G.genX;
    ground(x, len);
    var n = Math.round(rand(0, 1 + d * 2));
    for (var i = 0; i < n; i++) spike(x + rand(140, len - 90));
    if (Math.random() < 0.8) coinLine(x + 90, GROUND_Y - 60, randInt(4, 8), 40);
    G.genX += len;
  }

  function chunkPit(d) {
    var x = G.genX;
    var lead = rand(200, 280);
    ground(x, lead);
    // Die Luecke bleibt immer springbar: Flugzeit mal aktuelle Geschwindigkeit.
    var maxGap = Math.min(330, G.speed * 0.44);
    var gap = clamp(rand(120, 150 + d * 200), 110, maxGap);
    var pits = Math.random() < 0.25 + d * 0.3 ? 2 : 1;
    var cursor = x + lead;

    for (var p = 0; p < pits; p++) {
      coinArc(cursor + 14, GROUND_Y - 74, 5, gap - 28, 56);
      cursor += gap;
      var island = p === pits - 1 ? rand(300, 420) : rand(150, 210);
      ground(cursor, island);
      if (p === pits - 1 && Math.random() < 0.5) spike(cursor + rand(120, island - 60));
      cursor += island;
    }
    G.genX = cursor;
  }

  function chunkStairs(d) {
    var x = G.genX;
    var len = rand(620, 820);
    ground(x, len);
    var steps = randInt(3, 4);
    var y = GROUND_Y - 108;
    var cx = x + 120;
    for (var i = 0; i < steps; i++) {
      var w = rand(110, 160);
      ledge(cx, y, w);
      coinLine(cx + 26, y - 46, Math.max(2, Math.round(w / 42)), 40);
      cx += w + rand(60, 110);
      y -= i < steps / 2 ? 74 : -74;
      y = clamp(y, 150, GROUND_Y - 96);
    }
    if (d > 0.3) spike(x + rand(200, len - 120));
    G.genX += len;
  }

  function chunkDrones(d) {
    var x = G.genX;
    var len = rand(560, 760);
    ground(x, len);
    var n = randInt(2, 2 + Math.round(d * 2));
    var cx = x + 180;
    for (var i = 0; i < n; i++) {
      drone(cx);
      coinLine(cx - 6, GROUND_Y - 16, 4, 22);   // Muenzen belohnen das Rutschen
      cx += rand(190, 260);
      if (cx > x + len - 90) break;
    }
    G.genX += len;
  }

  function chunkSaws(d) {
    var x = G.genX;
    var len = rand(600, 800);
    ground(x, len);
    var n = randInt(2, 2 + Math.round(d * 2));
    var cx = x + 190;
    for (var i = 0; i < n; i++) {
      var floating = Math.random() < 0.5;
      saw(cx, floating ? GROUND_Y - rand(120, 200) : GROUND_Y - 34, floating ? rand(40, 90) : 0);
      coinArc(cx - 60, GROUND_Y - 100, 5, 120, 40);
      cx += rand(210, 290);
      if (cx > x + len - 100) break;
    }
    G.genX += len;
  }

  function chunkCrates(d) {
    var x = G.genX;
    var len = rand(560, 740);
    ground(x, len);
    var n = randInt(2, 3);
    var cx = x + 170;
    for (var i = 0; i < n; i++) {
      var tall = Math.random() < 0.35 + d * 0.3;
      crate(cx, tall);
      coinArc(cx - 70, GROUND_Y - (tall ? 150 : 120), 5, 150, 44);
      cx += rand(200, 280);
      if (cx > x + len - 90) break;
    }
    // Ein Absatz darueber belohnt den, der oben bleibt.
    if (Math.random() < 0.6) {
      ledge(x + 220, GROUND_Y - 190, 220);
      coinLine(x + 250, GROUND_Y - 238, 5, 40);
    }
    G.genX += len;
  }

  function chunkTreasure(d) {
    var x = G.genX;
    var len = rand(660, 820);
    ground(x, len);
    G.lastPowerChunk = G.chunk;

    var kinds = ['shield', 'magnet', 'x2', 'slow'];
    pickup(x + len * 0.5, GROUND_Y - rand(110, 190), pick(kinds));

    var style = Math.random();
    if (style < 0.34) coinWave(x + 110, GROUND_Y - 130, 16, 38, 54);
    else if (style < 0.67) coinArc(x + 110, GROUND_Y - 60, 14, len - 240, 150);
    else {
      for (var row = 0; row < 3; row++) coinLine(x + 130 + row * 16, GROUND_Y - 70 - row * 44, 9, 40);
    }
    if (d > 0.45) spike(x + rand(160, len - 140));
    G.genX += len;
  }

  // ------------------------------------------------------------------ Effekte

  function burst(x, y, n, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      if (G.parts.length >= MAX_PARTS) break;
      var a = opt.angle === undefined ? rand(0, 6.283) : opt.angle + rand(-opt.spread, opt.spread);
      var s = rand(opt.minSpeed || 60, opt.maxSpeed || 320);
      G.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * s + (opt.vx || 0),
        vy: Math.sin(a) * s + (opt.vy || 0),
        life: 0, max: rand(opt.minLife || 0.25, opt.maxLife || 0.7),
        size: rand(opt.minSize || 2, opt.maxSize || 6),
        hue: (opt.hue === undefined ? G.hue : opt.hue) + rand(-(opt.hueSpread || 40), opt.hueSpread || 40),
        grav: opt.grav === undefined ? 900 : opt.grav,
        square: !!opt.square
      });
    }
  }

  function floatText(x, y, text, hue, size) {
    G.texts.push({ x: x, y: y, text: text, hue: hue, size: size || 20, life: 0, max: 0.9 });
  }

  var toastTimer = null;
  function toast(text, hue) {
    el.toast.textContent = text;
    el.toast.style.color = hsl(hue === undefined ? G.hue + 40 : hue, 100, 72);
    el.toast.classList.remove('show');
    void el.toast.offsetWidth;                 // Animation neu starten
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }

  function shake(amount) { G.shake = Math.max(G.shake, amount); }
  function flash(amount, hue) { G.flash = Math.max(G.flash, amount); G.flashHue = hue === undefined ? G.hue : hue; }
  function slowmo(seconds) { G.slowT = Math.max(G.slowT, seconds); }

  // ------------------------------------------------------------------ Eingabe

  function multiplier() {
    var m = 1 + Math.floor(G.combo / 8);
    if (m > 8) m = 8;
    if (G.powers.x2 > 0) m *= 2;
    if (G.hyperT > 0) m *= 3;
    return m;
  }

  function doJump() {
    if (G.hyperT > 0) return;
    if (G.onGround || G.coyote > 0) {
      G.vy = -JUMP_V;
      G.jumps = 1;
      G.onGround = false;
      G.coyote = 0;
      G.jumpAge = 0;
      G.cutArmed = true;
      endSlide();
      Sound.jump();
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h, 10, {
        angle: Math.PI / 2, spread: 0.9, minSpeed: 60, maxSpeed: 180, grav: 400, hue: G.hue + 160
      });
    } else if (G.jumps < 2) {
      G.vy = -JUMP_V * 0.9;
      G.jumps = 2;
      G.jumpAge = 0;
      G.cutArmed = true;
      endSlide();
      Sound.dJump();
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 18, {
        minSpeed: 90, maxSpeed: 260, grav: 260, hue: G.hue + 200, hueSpread: 70, square: true
      });
    }
  }

  // Steht etwas ueber der rutschenden Figur, darf sie nicht aufstehen.
  function canStand() {
    if (!G.sliding) return true;
    var box = { x: G.worldX + G.screenX, y: G.py + G.h - PH, w: PW, h: PH };
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (o.dead || o.x > G.worldX + W || o.x + 120 < G.worldX + G.screenX) continue;
      if (aabb(box, obstacleBox(o))) return false;
    }
    return true;
  }

  function startSlide() {
    if (G.sliding) return;
    G.sliding = true;
    G.slideT = 0;
    G.py += G.h - PH_SLIDE;
    G.h = PH_SLIDE;
    Sound.slide();
    burst(G.worldX + G.screenX, GROUND_Y, 12, {
      angle: Math.PI, spread: 0.6, minSpeed: 120, maxSpeed: 300, grav: 700, hue: G.hue + 120
    });
  }

  function endSlide() {
    if (!G.sliding) return;
    G.sliding = false;
    G.py -= PH - PH_SLIDE;
    G.h = PH;
    G.slideCD = SLIDE_CD;
    G.slideT = 0;
  }

  function doDash() {
    if (G.dashCD > 0 || G.hyperT > 0) return;
    G.dashT = DASH_TIME;
    G.dashCD = DASH_CD;
    G.inv = Math.max(G.inv, DASH_TIME + 0.05);
    endSlide();
    Sound.dash();
    shake(7);
    burst(G.worldX + G.screenX, G.py + G.h / 2, 22, {
      angle: Math.PI, spread: 0.7, minSpeed: 200, maxSpeed: 520, grav: 0,
      hue: G.hue + 190, hueSpread: 60, maxLife: 0.5
    });
  }

  function doHyper() {
    if (G.meter < 100 || G.hyperT > 0) return;
    G.meter = 0;
    G.hyperT = HYPER_TIME;
    G.hyperUses++;
    G.vy = -180;
    endSlide();
    Sound.hyper();
    shake(16);
    flash(0.85, G.hue + 180);
    toast('HYPER!', 55);
    burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 90, {
      minSpeed: 200, maxSpeed: 720, grav: 0, hueSpread: 180, maxLife: 0.9, maxSize: 9
    });
  }

  // -------------------------------------------------------- Kollisionskoerper

  function obstacleBox(o) {
    if (o.type === 'saw') {
      o.cy = o.y + (o.amp ? Math.sin(G.time * o.spd + o.phase) * o.amp : 0);
      return { x: o.x - o.r * 0.72, y: o.cy - o.r * 0.72, w: o.r * 1.44, h: o.r * 1.44 };
    }
    if (o.type === 'drone') {
      o.dy = Math.sin(G.time * 2.2 + o.phase) * 5;
      return { x: o.x, y: o.y + o.dy, w: o.w, h: o.h };
    }
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  }

  function killObstacle(o, hue) {
    o.dead = 1;
    var b = obstacleBox(o);
    burst(b.x + b.w / 2, b.y + b.h / 2, 26, {
      minSpeed: 120, maxSpeed: 460, grav: 700, hue: hue, hueSpread: 60, maxSize: 8, square: true
    });
    shake(6);
  }

  // -------------------------------------------------------------- Spiellogik

  function update(dt) {
    G.time += dt;

    // --- Zeitgeber
    if (G.dashT > 0) G.dashT -= dt;
    if (G.dashCD > 0) G.dashCD -= dt;
    if (G.inv > 0) G.inv -= dt;
    if (G.slideCD > 0) G.slideCD -= dt;
    if (G.slowT > 0) G.slowT -= dt;
    if (G.hyperT > 0) {
      G.hyperT -= dt;
      if (G.hyperT <= 0) { toast('HYPER VORBEI', 200); G.vy = 0; }
    }
    for (var key in G.powers) {
      if (G.powers[key] > 0) {
        G.powers[key] -= dt;
        if (G.powers[key] <= 0) { G.powers[key] = 0; toast(POWERS[key].label + ' ENDET', POWERS[key].hue); }
      }
    }
    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0 && G.combo > 0) G.combo = 0;
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.4);

    // --- Vorwaertsbewegung
    var ramp = clamp(G.worldX / SPEED_RAMP, 0, 1);
    G.speed = lerp(SPEED_MIN, SPEED_MAX, ramp * ramp * 0.55 + ramp * 0.45);
    var speed = G.speed + (G.dashT > 0 ? DASH_BOOST : 0) + (G.hyperT > 0 ? 340 : 0);
    var moved = speed * dt;
    G.worldX += moved;
    G.dist = G.worldX / PX_PER_M;
    G.run += moved * 0.05;

    var baseMult = (G.powers.x2 > 0 ? 2 : 1) * (G.hyperT > 0 ? 3 : 1);
    G.score += (moved / PX_PER_M) * baseMult;

    // --- Eingabe: erst die Puffer altern lassen, dann auswerten
    for (var ai = 0; ai < ACTIONS.length; ai++) {
      var slot = input[ACTIONS[ai]];
      if (slot.buffer > 0) slot.buffer = Math.max(0, slot.buffer - dt);
    }

    // Springen: ein gepufferter Druck loest aus, sobald er darf. Damit gehen
    // weder zu frueh gedrueckte noch knapp verpasste Spruenge verloren.
    G.jumpAge += dt;
    if (input.jump.buffer > 0 && (G.onGround || G.coyote > 0 || G.jumps < 2)) {
      input.jump.buffer = 0;
      doJump();
    }
    // Gekappt wird erst nach der Mindesthaltezeit. So huepft auch ein ganz
    // kurzer Tipp sichtbar - egal ob von Taste, Finger oder Gamepad.
    if (G.cutArmed) {
      if (G.vy >= 0 || G.hyperT > 0) G.cutArmed = false;
      else if (!held('jump') && G.jumpAge >= MIN_JUMP_HOLD) {
        G.vy *= JUMP_CUT;
        G.cutArmed = false;
      }
    }

    // Rutschen: der Druck darf schon in der Luft kommen und greift bei der
    // Landung. Gehalten wird weitergerutscht, losgelassen steht die Figur auf -
    // aber nur, wenn ueber ihr Platz ist.
    if ((input.slide.buffer > 0 || held('slide')) &&
        G.onGround && !G.sliding && G.slideCD <= 0 && G.hyperT <= 0) {
      input.slide.buffer = 0;
      startSlide();
    }
    if (G.sliding) {
      G.slideT += dt;
      var blockiert = !canStand();
      if (!G.onGround) endSlide();
      else if (!blockiert && (G.slideT >= SLIDE_MAX || (G.slideT >= SLIDE_MIN && !held('slide')))) endSlide();
    }

    // Dash und Hyper warten im Puffer, bis sie verfuegbar sind.
    if (input.dash.buffer > 0 && G.dashCD <= 0 && G.hyperT <= 0) {
      input.dash.buffer = 0;
      doDash();
    }
    if (input.hyper.buffer > 0 && G.meter >= 100 && G.hyperT <= 0) {
      input.hyper.buffer = 0;
      doHyper();
    }

    // --- Lenken: die Figur laesst sich zuruecknehmen und nach vorn schieben
    var leanDir = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    var leanZiel = PLAYER_X + (leanDir > 0 ? LEAN_FWD : (leanDir < 0 ? -LEAN_BACK : 0));
    var leanTempo = (leanDir === 0 ? LEAN_HOME : LEAN_SPEED) * dt;
    if (G.screenX < leanZiel) G.screenX = Math.min(leanZiel, G.screenX + leanTempo);
    else if (G.screenX > leanZiel) G.screenX = Math.max(leanZiel, G.screenX - leanTempo);
    G.lean = (G.screenX - PLAYER_X) / LEAN_FWD;

    // --- Senkrechte Bewegung
    var prevBottom = G.py + G.h;
    if (G.hyperT > 0) {
      var want = (held('jump') ? -1 : 0) + (held('slide') ? 1 : 0);
      G.vy = lerp(G.vy, want * 430, Math.min(1, dt * 9));
      G.py += G.vy * dt;
      G.py = clamp(G.py, 46, GROUND_Y - G.h);
      G.onGround = false;
      G.jumps = 0;
    } else if (G.dashT > 0) {
      G.vy = 0;                                  // Der Dash haelt die Hoehe
    } else {
      var g = GRAVITY;
      if (Math.abs(G.vy) < APEX_VY) g *= APEX_GRAVITY;   // laengerer Scheitelpunkt
      else if (G.vy > 0) g *= FALL_GRAVITY;              // danach zackiger Fall
      if (!G.onGround && held('slide')) g = GRAVITY * FAST_FALL;
      G.vy += g * dt;
      G.py += G.vy * dt;
    }

    // --- Landung auf Boden und Absaetzen
    var px = G.worldX + G.screenX;
    if (G.hyperT <= 0) {
      var landed = false;
      for (var i = 0; i < G.platforms.length; i++) {
        var p = G.platforms[i];
        if (px + PW <= p.x || px >= p.x + p.w) continue;
        if (G.vy >= 0 && prevBottom <= p.y + 6 && G.py + G.h >= p.y) {
          G.py = p.y - G.h;
          landed = true;
        }
      }
      if (landed) {
        if (!G.onGround) {
          Sound.land();
          burst(px + PW / 2, G.py + G.h, 8, {
            angle: -Math.PI / 2, spread: 1.2, minSpeed: 40, maxSpeed: 160, grav: 800, hue: G.hue + 150
          });
          if (G.vy > 900) shake(4);
        }
        G.vy = 0;
        G.onGround = true;
        G.coyote = COYOTE;
        G.jumps = 0;
      } else {
        G.onGround = false;
        if (G.coyote > 0) G.coyote -= dt;
      }
    }

    // --- Sturz in eine Grube
    if (G.py > H + 90) { die('grube'); return; }

    // --- Nachziehende Spur
    G.trail.push({ x: px, y: G.py, h: G.h });
    if (G.trail.length > 14) G.trail.shift();

    buildWorld();
    cull();
    updateCoins(dt, px);
    updatePickups(px);
    updateObstacles(px);
    updateParticles(dt);
    updateZone(dt);
  }

  function cull() {
    var left = G.worldX - 260;
    var keep = function (o) { return (o.x + (o.w || o.r * 2 || 40)) > left; };
    G.platforms = G.platforms.filter(function (p) { return p.x + p.w > left; });
    G.obstacles = G.obstacles.filter(function (o) { return !o.dead && keep(o); });
    G.coinList = G.coinList.filter(function (c) { return !c.got && c.x + 20 > left; });
    G.pickups = G.pickups.filter(function (p) { return !p.got && p.x + 30 > left; });
  }

  function updateCoins(dt, px) {
    var pbx = px + PW / 2, pby = G.py + G.h / 2;
    var magnet = G.powers.magnet > 0 ? 230 : 0;
    if (G.hyperT > 0) magnet = Math.max(magnet, 320);

    for (var i = 0; i < G.coinList.length; i++) {
      var c = G.coinList[i];
      if (c.got) continue;
      if (c.x < G.worldX - 100 || c.x > G.worldX + W + 200) continue;

      var dx = pbx - c.x, dy = pby - c.y;
      var dist2 = dx * dx + dy * dy;

      if (magnet && dist2 < magnet * magnet) {
        var d = Math.sqrt(dist2) || 1;
        var pull = (1 - d / magnet) * 2200;
        c.vx += (dx / d) * pull * dt;
        c.vy += (dy / d) * pull * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }

      if (dist2 < (c.r + 22) * (c.r + 22)) collectCoin(c);
    }
  }

  function collectCoin(c) {
    c.got = true;
    G.coins++;
    G.combo++;
    G.comboTimer = 2.6;
    if (G.combo > G.bestCombo) G.bestCombo = G.combo;
    if (G.hyperT <= 0) G.meter = Math.min(100, G.meter + HYPER_PER_COIN);

    var m = multiplier();
    G.score += 10 * m;
    Sound.coin(G.combo);
    burst(c.x, c.y, 8, {
      minSpeed: 60, maxSpeed: 240, grav: 500, hue: 48, hueSpread: 26, maxLife: 0.5, maxSize: 5
    });

    if (G.combo > 0 && G.combo % 10 === 0) {
      floatText(c.x, c.y - 26, 'KOMBO x' + m, 96, 24);
      flash(0.22, 96);
      Sound.power();
      if (G.combo % 30 === 0) toast('SERIE ' + G.combo + '!', 96);
    }
  }

  function updatePickups(px) {
    var box = { x: px, y: G.py, w: PW, h: G.h };
    for (var i = 0; i < G.pickups.length; i++) {
      var p = G.pickups[i];
      if (p.got) continue;
      var pb = { x: p.x - p.r, y: p.y - p.r + Math.sin(G.time * 2.4 + p.phase) * 8, w: p.r * 2, h: p.r * 2 };
      if (!aabb(box, pb)) continue;

      p.got = true;
      var def = POWERS[p.kind];
      if (p.kind === 'shield') { G.shield = 1; }
      else { G.powers[p.kind] = def.dur; }
      G.score += 120 * multiplier();
      G.meter = Math.min(100, G.meter + 8);
      Sound.power();
      flash(0.4, def.hue);
      shake(6);
      toast(def.label + '!', def.hue);
      floatText(p.x, p.y - 30, '+' + (120 * multiplier()), def.hue, 22);
      burst(p.x, p.y, 34, {
        minSpeed: 120, maxSpeed: 420, grav: 0, hue: def.hue, hueSpread: 50, maxLife: 0.8, maxSize: 8
      });
    }
  }

  function updateObstacles(px) {
    var box = { x: px, y: G.py, w: PW, h: G.h };

    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (o.dead) continue;
      if (o.x > G.worldX + W + 120) continue;

      var b = obstacleBox(o);

      // Beinahe-Treffer merken, solange das Hindernis in der Naehe ist.
      if (Math.abs(b.x - px) < 260) o.gap = Math.min(o.gap, rectGap(box, b));

      if (aabb(box, b)) {
        if (G.hyperT > 0) {
          killObstacle(o, G.time * 260);
          G.score += 60 * multiplier();
          floatText(b.x, b.y - 10, 'ZERLEGT +' + (60 * multiplier()), (G.time * 260) % 360, 20);
          continue;
        }
        if (G.dashT > 0 && o.type === 'crate') {
          killObstacle(o, 30);
          G.score += 40 * multiplier();
          G.meter = Math.min(100, G.meter + 3);
          floatText(b.x, b.y - 10, 'DASH +' + (40 * multiplier()), 30, 20);
          continue;
        }
        if (G.inv > 0) continue;
        if (G.shield > 0) {
          G.shield = 0;
          G.inv = 1.1;
          killObstacle(o, 190);
          flash(0.6, 190);
          shake(12);
          toast('SCHILD ZERBROCHEN', 190);
          continue;
        }
        die(o.type);
        return;
      }

      // Knapp vorbei: erst werten, wenn das Hindernis hinter der Figur liegt.
      if (!o.passed && b.x + b.w < px) {
        o.passed = true;
        if (o.gap < 26 && G.hyperT <= 0) {
          G.nearMisses++;
          var m = multiplier();
          G.score += 75 * m;
          G.meter = Math.min(100, G.meter + HYPER_PER_NEAR);
          Sound.near();
          slowmo(0.22);
          flash(0.16, 190);
          floatText(px - 20, G.py - 16, 'KNAPP! +' + (75 * m), 190, 22);
          burst(b.x + b.w / 2, b.y + b.h / 2, 10, {
            minSpeed: 80, maxSpeed: 260, grav: 0, hue: 190, hueSpread: 40, maxLife: 0.4
          });
        }
      }
    }
  }

  function updateParticles(dt) {
    var out = [];
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      out.push(p);
    }
    G.parts = out;

    var t = [];
    for (var j = 0; j < G.texts.length; j++) {
      var f = G.texts[j];
      f.life += dt;
      if (f.life >= f.max) continue;
      f.y -= 60 * dt;
      t.push(f);
    }
    G.texts = t;
  }

  function updateZone(dt) {
    var z = Math.floor(G.dist / ZONE_LENGTH) % ZONES.length;
    if (z !== G.zone) {
      G.zone = z;
      G.hueTarget = ZONES[z].hue;
      toast('ZONE: ' + ZONES[z].name, ZONES[z].hue);
      flash(0.35, ZONES[z].hue);
      el.zone.textContent = ZONES[z].name;
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 40, {
        minSpeed: 160, maxSpeed: 520, grav: 0, hue: ZONES[z].hue, hueSpread: 90, maxLife: 0.9
      });
    }
    var d = ((G.hueTarget - G.hue + 540) % 360) - 180;
    G.hue += d * Math.min(1, dt * 1.6);
  }

  function die(cause) {
    if (state !== 'play') return;
    state = 'over';
    Sound.hit();
    shake(24);
    flash(0.8, 0);
    var px = G.worldX + G.screenX + PW / 2;
    burst(px, G.py + G.h / 2, 80, {
      minSpeed: 140, maxSpeed: 620, grav: 1100, hueSpread: 120, maxLife: 1.1, maxSize: 9, square: true
    });

    var score = Math.floor(G.score);
    var dist = Math.floor(G.dist);
    var isBest = score > records.best;
    if (isBest) { records.best = score; save(STORE_BEST, score); }
    if (dist > records.dist) { records.dist = dist; save(STORE_DIST, dist); }
    records.coins += G.coins;
    save(STORE_COINS, records.coins);

    showOver(score, dist, isBest, cause);
  }

  // ------------------------------------------------------------------ Zeichnen

  var ctx = ctx2d;

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function noGlow() { ctx.shadowBlur = 0; }

  function drawSky() {
    var h = G.hue;
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hsl(h + 200, 70, 8));
    sky.addColorStop(0.45, hsl(h + 20, 68, 18));
    sky.addColorStop(0.78, hsl(h, 80, 30));
    sky.addColorStop(1, hsl(h + 40, 85, 16));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sterne
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (var i = 0; i < 70; i++) {
      var sx = (hash(i) * W * 3 - G.worldX * 0.03) % (W + 40);
      if (sx < 0) sx += W + 40;
      var sy = hash(i + 99) * (GROUND_Y - 130);
      var tw = 0.4 + 0.6 * Math.abs(Math.sin(G.time * 1.6 + i));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillRect(sx - 20, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Sonne mit Ringen
    var cx = W * 0.74, cy = GROUND_Y - 190;
    var sun = ctx.createRadialGradient(cx, cy, 6, cx, cy, 120);
    sun.addColorStop(0, hsl(h + 60, 100, 78, 1));
    sun.addColorStop(0.4, hsl(h + 30, 100, 62, 0.55));
    sun.addColorStop(1, hsl(h + 10, 100, 50, 0));
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, 6.2832);
    ctx.fill();

    ctx.strokeStyle = hsl(h + 70, 100, 70, 0.5);
    ctx.lineWidth = 2;
    for (var r = 0; r < 3; r++) {
      var rr = 74 + r * 26 + Math.sin(G.time * 1.2 + r) * 5;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, 6.2832);
      ctx.stroke();
    }
  }

  function drawRange(scroll, step, baseY, minH, maxH, color, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    var start = Math.floor(scroll / step) - 1;
    var end = start + Math.ceil(W / step) + 3;
    ctx.moveTo(start * step - scroll, H);
    for (var i = start; i <= end; i++) {
      var x = i * step - scroll;
      var hh = minH + hash(i + seed) * (maxH - minH);
      ctx.lineTo(x + step * 0.5, baseY - hh);
      ctx.lineTo(x + step, baseY);
    }
    ctx.lineTo(end * step - scroll + step, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawSkyline(scroll, step, baseY, color, winHue, seed) {
    for (var i = Math.floor(scroll / step) - 1; i <= Math.floor(scroll / step) + Math.ceil(W / step) + 1; i++) {
      var x = i * step - scroll;
      var w = step * (0.55 + hash(i + seed) * 0.3);
      var hh = 70 + hash(i + seed + 3) * 170;
      ctx.fillStyle = color;
      ctx.fillRect(x, baseY - hh, w, hh);

      // Fenster
      ctx.fillStyle = hsl(winHue, 100, 66, 0.75);
      var cols = Math.max(1, Math.floor(w / 14));
      var rows = Math.max(1, Math.floor(hh / 20));
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          if (hash(i * 91 + c * 7 + r * 31 + seed) < 0.45) continue;
          ctx.fillRect(x + 5 + c * 14, baseY - hh + 8 + r * 20, 5, 8);
        }
      }
    }
  }

  function drawBackground() {
    drawSky();
    var h = G.hue;
    drawRange(G.worldX * 0.08, 260, GROUND_Y - 40, 90, 220, hsl(h + 190, 55, 14), 5);
    drawSkyline(G.worldX * 0.18, 96, GROUND_Y - 10, hsl(h + 210, 60, 10), h + 60, 17);
    drawRange(G.worldX * 0.34, 190, GROUND_Y + 10, 50, 130, hsl(h + 230, 55, 8), 41);

    // Horizontglut
    var glowGrad = ctx.createLinearGradient(0, GROUND_Y - 90, 0, GROUND_Y + 10);
    glowGrad.addColorStop(0, hsl(h + 40, 100, 60, 0));
    glowGrad.addColorStop(1, hsl(h + 40, 100, 62, 0.32));
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, GROUND_Y - 90, W, 100);
  }

  function drawGround() {
    var h = G.hue;
    for (var i = 0; i < G.platforms.length; i++) {
      var p = G.platforms[i];
      var x = p.x - G.worldX;
      if (x > W + 40 || x + p.w < -40) continue;

      if (p.solid) {
        var g = ctx.createLinearGradient(0, p.y, 0, H);
        g.addColorStop(0, hsl(h + 250, 62, 16));
        g.addColorStop(1, hsl(h + 260, 70, 6));
        ctx.fillStyle = g;
        ctx.fillRect(x, p.y, p.w, H - p.y);

        // Gitterlinien in der Bodenflaeche
        ctx.strokeStyle = hsl(h + 60, 100, 62, 0.18);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var yy = p.y + 24; yy < H; yy += 26) {
          ctx.moveTo(x, yy);
          ctx.lineTo(x + p.w, yy);
        }
        var off = -(G.worldX % 60);
        for (var xx = off; xx < p.w + 60; xx += 60) {
          var sx = x + xx;
          if (sx < x || sx > x + p.w) continue;
          ctx.moveTo(sx, p.y);
          ctx.lineTo(sx + (H - p.y) * 0.35, H);
        }
        ctx.stroke();

        glow(hsl(h + 60, 100, 60), 22);
        ctx.fillStyle = hsl(h + 60, 100, 66);
        ctx.fillRect(x, p.y - 4, p.w, 5);
        noGlow();

        // Laufende Leuchtstreifen
        ctx.fillStyle = hsl(h + 130, 100, 72, 0.55);
        var s0 = -((G.worldX * 1.4) % 90);
        for (var s = s0; s < p.w + 90; s += 90) {
          var px2 = x + s;
          if (px2 + 34 < x || px2 > x + p.w) continue;
          ctx.fillRect(Math.max(px2, x), p.y - 3, Math.min(34, x + p.w - Math.max(px2, x)), 3);
        }
      } else {
        glow(hsl(h + 160, 100, 62), 18);
        ctx.fillStyle = hsl(h + 160, 90, 58);
        roundRect(x, p.y, p.w, p.h, 8);
        ctx.fill();
        noGlow();
        ctx.fillStyle = hsl(h + 160, 100, 82, 0.9);
        ctx.fillRect(x + 6, p.y + 3, p.w - 12, 3);
      }
    }
  }

  function drawCoins() {
    for (var i = 0; i < G.coinList.length; i++) {
      var c = G.coinList[i];
      var x = c.x - G.worldX;
      if (x < -40 || x > W + 40 || c.got) continue;
      var y = c.y + Math.sin(G.time * 3 + c.phase) * 3;
      var squash = Math.abs(Math.cos(G.time * 3.4 + c.phase));

      glow('#ffd53c', 16);
      ctx.fillStyle = '#ffd53c';
      ctx.beginPath();
      ctx.ellipse(x, y, c.r * (0.25 + squash * 0.75), c.r, 0, 0, 6.2832);
      ctx.fill();
      noGlow();

      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.ellipse(x - c.r * 0.18 * squash, y - 3, c.r * 0.18 * squash + 0.6, c.r * 0.42, 0, 0, 6.2832);
      ctx.fill();
    }
  }

  function drawPickups() {
    for (var i = 0; i < G.pickups.length; i++) {
      var p = G.pickups[i];
      var x = p.x - G.worldX;
      if (x < -60 || x > W + 60 || p.got) continue;
      var y = p.y + Math.sin(G.time * 2.4 + p.phase) * 8;
      var def = POWERS[p.kind];
      var rot = G.time * 1.3 + p.phase;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(rot) * 0.35);
      glow(hsl(def.hue, 100, 62), 26);
      ctx.fillStyle = hsl(def.hue, 95, 55);
      roundRect(-p.r, -p.r, p.r * 2, p.r * 2, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      noGlow();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 19px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var sign = p.kind === 'shield' ? '●' : (p.kind === 'magnet' ? 'U' : (p.kind === 'x2' ? '2' : '◔'));
      ctx.fillText(sign, x, y + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Leuchtring
      ctx.strokeStyle = hsl(def.hue, 100, 70, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, p.r + 10 + Math.sin(G.time * 4 + p.phase) * 4, 0, 6.2832);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    var h = G.hue;
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (o.dead) continue;
      var b = obstacleBox(o);
      var x = o.x - G.worldX;
      if (x < -120 || x > W + 120) continue;

      if (o.type === 'spike') {
        glow('#ff2d6f', 20);
        ctx.fillStyle = '#ff2d6f';
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + o.w / 2, GROUND_Y - o.h);
        ctx.lineTo(x + o.w, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        noGlow();
        ctx.fillStyle = 'rgba(255,255,255,.65)';
        ctx.beginPath();
        ctx.moveTo(x + o.w / 2, GROUND_Y - o.h);
        ctx.lineTo(x + o.w * 0.62, GROUND_Y - o.h * 0.35);
        ctx.lineTo(x + o.w * 0.42, GROUND_Y - o.h * 0.35);
        ctx.closePath();
        ctx.fill();

      } else if (o.type === 'crate') {
        glow(hsl(h + 30, 100, 60), 18);
        ctx.fillStyle = hsl(h + 20, 70, 24);
        roundRect(x, o.y, o.w, o.h, 6);
        ctx.fill();
        ctx.strokeStyle = hsl(h + 40, 100, 66);
        ctx.lineWidth = 3;
        ctx.stroke();
        noGlow();
        ctx.strokeStyle = hsl(h + 40, 100, 66, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 5, o.y + 5);
        ctx.lineTo(x + o.w - 5, o.y + o.h - 5);
        ctx.moveTo(x + o.w - 5, o.y + 5);
        ctx.lineTo(x + 5, o.y + o.h - 5);
        ctx.stroke();

      } else if (o.type === 'saw') {
        var cy = o.cy;
        ctx.save();
        ctx.translate(x + o.r * 0.0, cy);
        ctx.rotate(G.time * 9);
        glow('#ff4bd8', 24);
        ctx.fillStyle = '#2b0b2b';
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.62, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#ff4bd8';
        for (var t = 0; t < 10; t++) {
          var a = (t / 10) * 6.2832;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * o.r * 0.5, Math.sin(a) * o.r * 0.5);
          ctx.lineTo(Math.cos(a + 0.16) * o.r, Math.sin(a + 0.16) * o.r);
          ctx.lineTo(Math.cos(a + 0.42) * o.r * 0.5, Math.sin(a + 0.42) * o.r * 0.5);
          ctx.closePath();
          ctx.fill();
        }
        noGlow();
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.28, 0, 6.2832);
        ctx.stroke();
        ctx.restore();

      } else if (o.type === 'drone') {
        var dy = b.y;
        glow('#43e8ff', 20);
        ctx.fillStyle = '#0d2b3d';
        roundRect(x, dy, o.w, o.h, 12);
        ctx.fill();
        ctx.strokeStyle = '#43e8ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        noGlow();

        var eye = 0.5 + 0.5 * Math.sin(G.time * 6 + o.phase);
        ctx.fillStyle = 'rgba(255,80,120,' + (0.6 + eye * 0.4) + ')';
        ctx.beginPath();
        ctx.arc(x + o.w * 0.5, dy + o.h * 0.5, 6, 0, 6.2832);
        ctx.fill();

        // Suchstrahl nach unten
        var beam = ctx.createLinearGradient(0, dy + o.h, 0, GROUND_Y);
        beam.addColorStop(0, 'rgba(67,232,255,.35)');
        beam.addColorStop(1, 'rgba(67,232,255,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(x + o.w * 0.35, dy + o.h);
        ctx.lineTo(x + o.w * 0.65, dy + o.h);
        ctx.lineTo(x + o.w * 0.95, GROUND_Y);
        ctx.lineTo(x + o.w * 0.05, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      var t = 1 - p.life / p.max;
      var x = p.x - G.worldX;
      if (x < -40 || x > W + 40) continue;
      ctx.fillStyle = hsl(p.hue, 100, 62, t);
      var s = p.size * t;
      if (p.square) ctx.fillRect(x - s, p.y - s, s * 2, s * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, p.y, s, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPlayer() {
    var x = G.screenX, y = G.py, h = G.h;
    var hyper = G.hyperT > 0;
    var hue = hyper ? (G.time * 700) % 360 : (G.hue + 165) % 360;

    // Nachziehende Spur
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.trail.length; i++) {
      var t = G.trail[i];
      var a = (i / G.trail.length) * (hyper ? 0.42 : (G.dashT > 0 ? 0.4 : 0.16));
      ctx.fillStyle = hsl(hue + i * 6, 100, 62, a);
      roundRect(t.x - G.worldX, t.y, PW, t.h, 10);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Beine
    if (!G.sliding && G.onGround) {
      ctx.strokeStyle = hsl(hue, 90, 45);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (var l = 0; l < 2; l++) {
        var ph = G.run + l * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 10 + l * 14, y + h - 6);
        ctx.lineTo(x + 10 + l * 14 + Math.cos(ph) * 10, y + h + 6 + Math.abs(Math.sin(ph)) * 2);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // Koerper
    ctx.save();
    if (G.inv > 0 && !hyper && Math.floor(G.time * 24) % 2 === 0) ctx.globalAlpha = 0.35;
    var body = ctx.createLinearGradient(x, y, x + PW, y + h);
    body.addColorStop(0, hsl(hue, 100, 68));
    body.addColorStop(1, hsl(hue + 60, 100, 52));
    glow(hsl(hue, 100, 60), hyper ? 40 : 22);
    ctx.fillStyle = body;
    roundRect(x, y, PW, h, 10);
    ctx.fill();
    noGlow();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Augen
    var ey = y + (G.sliding ? 9 : 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 14, ey, 7, 9);
    ctx.fillRect(x + 25, ey, 7, 9);
    ctx.fillStyle = '#160a2a';
    var look = clamp(G.vy / 900, -1, 1) * 2;
    ctx.fillRect(x + 17, ey + 2 + look, 4, 5);
    ctx.fillRect(x + 28, ey + 2 + look, 4, 5);
    ctx.restore();

    // Schild
    if (G.shield > 0) {
      var pulse = 0.6 + 0.4 * Math.sin(G.time * 6);
      ctx.strokeStyle = hsl(190, 100, 70, pulse);
      ctx.lineWidth = 3;
      glow(hsl(190, 100, 65), 20);
      ctx.beginPath();
      ctx.arc(x + PW / 2, y + h / 2, 40, 0, 6.2832);
      ctx.stroke();
      noGlow();
    }

    // Magnetfeld
    if (G.powers.magnet > 0) {
      ctx.strokeStyle = hsl(330, 100, 70, 0.35);
      ctx.lineWidth = 2;
      for (var m = 0; m < 3; m++) {
        var rr = 60 + m * 40 + Math.sin(G.time * 3 + m) * 8;
        ctx.beginPath();
        ctx.arc(x + PW / 2, y + h / 2, rr, 0, 6.2832);
        ctx.stroke();
      }
    }
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Chakra Petch", system-ui, sans-serif';
    for (var i = 0; i < G.texts.length; i++) {
      var f = G.texts[i];
      var t = 1 - f.life / f.max;
      var x = f.x - G.worldX;
      if (x < -160 || x > W + 160) continue;
      x = clamp(x, 96, W - 96);            // nie am Bildrand abschneiden
      ctx.font = '700 ' + f.size + 'px "Chakra Petch", system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,' + (t * 0.7) + ')';
      ctx.strokeText(f.text, x, f.y);
      ctx.fillStyle = hsl(f.hue, 100, 70, t);
      ctx.fillText(f.text, x, f.y);
    }
    ctx.textAlign = 'left';
  }

  function drawOverlayFx() {
    // Geschwindigkeitslinien
    var sf = clamp((G.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1) + (G.dashT > 0 ? 0.6 : 0) + (G.hyperT > 0 ? 0.7 : 0);
    if (sf > 0.15) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 16; i++) {
        var seed = Math.floor(G.time * 22) + i * 13;
        var y = hash(seed) * H;
        var len = 60 + hash(seed + 1) * 200 * sf;
        var x = (hash(seed + 2) * (W + 300) - (G.time * 900 % (W + 300)));
        ctx.fillStyle = hsl(G.hue + 160, 100, 75, 0.05 + 0.1 * sf);
        ctx.fillRect(x, y, len, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    if (G.hyperT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      var hg = ctx.createLinearGradient(0, 0, W, H);
      hg.addColorStop(0, hsl(G.time * 700, 100, 60, 0.1));
      hg.addColorStop(0.5, hsl(G.time * 700 + 120, 100, 60, 0.06));
      hg.addColorStop(1, hsl(G.time * 700 + 240, 100, 60, 0.1));
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (G.powers.slow > 0 || G.slowT > 0) {
      ctx.fillStyle = hsl(265, 100, 60, 0.07);
      ctx.fillRect(0, 0, W, H);
    }

    if (G.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hsl(G.flashHue, 100, 65, Math.min(0.75, G.flash));
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Vignette
    var vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function render() {
    ctx.save();
    if (G.shake > 0.2) {
      ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    }
    drawBackground();
    drawGround();
    drawParticles();
    drawCoins();
    drawPickups();
    drawObstacles();
    drawPlayer();
    drawTexts();
    ctx.restore();
    drawOverlayFx();
  }

  // ---------------------------------------------------------------------- HUD

  var lastPowerKey = '';

  function updateHud() {
    el.score.textContent = Math.floor(G.score).toLocaleString('de-DE');
    el.best.textContent = records.best.toLocaleString('de-DE');
    el.meters.textContent = Math.floor(G.dist) + ' m';
    el.coins.textContent = G.coins;

    var m = multiplier();
    el.combo.textContent = G.combo > 1 ? ('KOMBO ' + G.combo + '  x' + m) : (m > 1 ? 'x' + m : '');

    el.hyperFill.style.width = G.meter.toFixed(1) + '%';
    if (G.hyperT > 0) {
      el.hyperLabel.textContent = 'HYPER ' + G.hyperT.toFixed(1) + 's';
      el.hyperFill.style.width = (G.hyperT / HYPER_TIME * 100) + '%';
      el.hyperWrap.classList.add('ready');
    } else {
      el.hyperLabel.textContent = G.meter >= 100 ? 'HYPER BEREIT - TASTE E' : 'HYPER ' + Math.floor(G.meter) + '%';
      el.hyperWrap.classList.toggle('ready', G.meter >= 100);
    }
    el.btnHyper.classList.toggle('armed', G.meter >= 100 || G.hyperT > 0);

    var parts = [];
    if (G.shield > 0) parts.push(['shield', '']);
    for (var k in G.powers) if (G.powers[k] > 0) parts.push([k, G.powers[k].toFixed(1) + 's']);
    if (G.dashCD > 0) parts.push(['_dash', G.dashCD.toFixed(1) + 's']);

    var key = parts.map(function (p) { return p[0] + p[1]; }).join('|');
    if (key !== lastPowerKey) {
      lastPowerKey = key;
      var html = '';
      for (var i = 0; i < parts.length; i++) {
        var kind = parts[i][0];
        if (kind === '_dash') {
          html += '<span class="pill" style="--h:0">DASH ' + parts[i][1] + '</span>';
        } else {
          var def = POWERS[kind];
          html += '<span class="pill" style="--h:' + def.hue + '">' + def.label +
                  (parts[i][1] ? ' ' + parts[i][1] : '') + '</span>';
        }
      }
      el.powers.innerHTML = html;
    }
  }

  // ----------------------------------------------------------- Zustandswechsel

  function showOverlay(title, text, btn, statsHtml) {
    el.ovTitle.innerHTML = title;
    el.ovText.textContent = text;
    el.ovBtn.textContent = btn;
    if (statsHtml) {
      el.ovStats.innerHTML = statsHtml;
      el.ovStats.hidden = false;
    } else {
      el.ovStats.hidden = true;
    }
    el.overlay.hidden = false;
  }

  function hideOverlay() { el.overlay.hidden = true; }

  function showReady() {
    state = 'ready';
    showOverlay('NEON<span>DASH</span>', 'Leertaste oder Tippen zum Starten', 'Los geht’s', null);
  }

  function showPause() {
    showOverlay('PAUSE', 'Weiter mit P, Enter oder Leertaste', 'Weiter', null);
  }

  function stat(label, value, hi) {
    return '<div><span>' + label + '</span><b' + (hi ? ' class="hi"' : '') + '>' + value + '</b></div>';
  }

  function showOver(score, dist, isBest, cause) {
    var reason = cause === 'grube' ? 'In die Tiefe gestürzt.' :
                 cause === 'saw' ? 'Von der Säge erwischt.' :
                 cause === 'drone' ? 'Die Drohne hat dich getroffen.' :
                 cause === 'spike' ? 'In die Stacheln gelaufen.' : 'Gegen die Kiste gekracht.';
    showOverlay(
      isBest ? 'NEUER<span> REKORD</span>' : 'AUS!',
      reason + ' Nochmal?',
      'Neuer Versuch',
      stat('Punkte', score.toLocaleString('de-DE'), isBest) +
      stat('Strecke', dist + ' m') +
      stat('Münzen', G.coins) +
      stat('Beste Kombo', G.bestCombo) +
      stat('Knapp vorbei', G.nearMisses) +
      stat('Hyper', G.hyperUses + 'x') +
      stat('Bestwert', records.best.toLocaleString('de-DE')) +
      stat('Münzen gesamt', records.coins)
    );
  }

  function startGame() {
    releaseAll();
    newGame();
    lastPowerKey = '';
    el.zone.textContent = ZONES[0].name;
    state = 'play';
    hideOverlay();
    Sound.resume();
  }

  function togglePause() {
    if (state === 'play') { state = 'pause'; showPause(); }
    else if (state === 'pause') { state = 'play'; hideOverlay(); }
  }

  // Ein Druck auf die Sprungtaste startet, entpausiert oder springt.
  function primaryAction() {
    Sound.resume();
    if (state === 'ready' || state === 'over') startGame();
    else if (state === 'pause') togglePause();
    else press('jump');
  }

  // ------------------------------------------------------------------ Eingabe

  var KEY_ACTION = {
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
    ArrowDown: 'slide', KeyS: 'slide',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash',
    KeyE: 'hyper', KeyQ: 'hyper'
  };

  window.addEventListener('keydown', function (e) {
    var code = e.code;
    if (KEY_ACTION[code] || code === 'KeyP' || code === 'Escape' ||
        code === 'KeyR' || code === 'KeyM' || code === 'Enter') {
      e.preventDefault();
    }
    if (e.repeat) return;

    var action = KEY_ACTION[code];
    if (action) {
      if (action === 'jump') primaryAction();
      else { Sound.resume(); press(action); }
      return;
    }

    switch (code) {
      case 'Enter': primaryAction(); break;
      case 'KeyP': case 'Escape': togglePause(); break;
      case 'KeyR': startGame(); break;
      case 'KeyM': el.soundState.textContent = Sound.toggle() ? 'an' : 'aus'; break;
    }
  });

  window.addEventListener('keyup', function (e) {
    var action = KEY_ACTION[e.code];
    if (action) release(action);
  });

  // Beim Fensterwechsel keine haengenden Tasten zuruecklassen.
  window.addEventListener('blur', releaseAll);

  // -------------------------------------------------------------- Beruehrung

  function bindTouch(btn) {
    var action = btn.getAttribute('data-act');
    var down = function (e) {
      e.preventDefault();
      // Der Zeiger wird festgehalten: rutscht der Finger vom Knopf, bleibt die
      // Taste trotzdem gedrueckt, statt den Sprung mitten im Flug zu kappen.
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* nicht schlimm */ }
      }
      btn.classList.add('down');
      if (action === 'jump') primaryAction();
      else { Sound.resume(); press(action); }
    };
    var up = function (e) {
      e.preventDefault();
      btn.classList.remove('down');
      release(action);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  var touchButtons = el.touch.querySelectorAll('button');
  for (var b = 0; b < touchButtons.length; b++) bindTouch(touchButtons[b]);

  // Die gesamte Spielflaeche ist die Sprungtaste: der Sprung loest beim
  // Aufsetzen des Fingers aus, laenger halten springt hoeher. Wischen loest
  // zusaetzlich Rutschen, Dash oder Hyper aus.
  var swipe = null;

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nicht schlimm */ }
    }
    swipe = { x: e.clientX, y: e.clientY, action: 'jump' };
    primaryAction();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!swipe || swipe.action !== 'jump' || state !== 'play') return;
    var dx = e.clientX - swipe.x;
    var dy = e.clientY - swipe.y;
    if (dy > 46 && dy > Math.abs(dx)) {
      release('jump');
      swipe.action = 'slide';
      press('slide');
    } else if (dx > 64 && dx > Math.abs(dy)) {
      release('jump');
      swipe.action = 'dash';
      press('dash');
      release('dash');
    } else if (-dy > 76 && -dy > Math.abs(dx)) {
      release('jump');
      swipe.action = 'hyper';
      press('hyper');
      release('hyper');
    }
  });

  function endSwipe() {
    if (swipe) release(swipe.action);
    else release('jump');
    swipe = null;
  }

  canvas.addEventListener('pointerup', endSwipe);
  canvas.addEventListener('pointercancel', endSwipe);

  // ----------------------------------------------------------------- Gamepad

  var PAD_BUTTONS = [
    [0, 'jump'], [12, 'jump'],
    [2, 'slide'], [13, 'slide'], [4, 'slide'], [6, 'slide'],
    [1, 'dash'], [5, 'dash'], [7, 'dash'],
    [3, 'hyper'],
    [14, 'left'], [15, 'right']
  ];
  var padPrev = {};
  var padKnown = false;

  function pollPad() {
    if (!navigator.getGamepads) return;
    var pads;
    try { pads = navigator.getGamepads(); } catch (e) { return; }
    if (!pads) return;

    var now = {};
    for (var i = 0; i < pads.length; i++) {
      var gp = pads[i];
      if (!gp || !gp.connected) continue;
      for (var m = 0; m < PAD_BUTTONS.length; m++) {
        var b = gp.buttons[PAD_BUTTONS[m][0]];
        if (b && (b.pressed || b.value > 0.4)) now[PAD_BUTTONS[m][1]] = true;
      }
      var ax = gp.axes.length ? gp.axes[0] : 0;
      if (ax < -0.4) now.left = true;
      if (ax > 0.4) now.right = true;
      if (gp.buttons[9] && gp.buttons[9].pressed) now.pause = true;
      if (gp.buttons[8] && gp.buttons[8].pressed) now.restart = true;
    }

    // Nur Flanken melden, damit das Gamepad die Tastatur nicht ueberschreibt.
    for (var k = 0; k < ACTIONS.length; k++) {
      var name = ACTIONS[k];
      var on = !!now[name];
      if (on && !padPrev[name]) {
        if (name === 'jump') primaryAction();
        else { Sound.resume(); press(name); }
      } else if (!on && padPrev[name]) {
        release(name);
      }
      padPrev[name] = on;
    }
    if (now.pause && !padPrev.pause) togglePause();
    padPrev.pause = !!now.pause;
    if (now.restart && !padPrev.restart) startGame();
    padPrev.restart = !!now.restart;
  }

  window.addEventListener('gamepadconnected', function () {
    if (padKnown) return;
    padKnown = true;
    toast('GAMEPAD BEREIT', 140);
  });

  el.ovBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    Sound.resume();
    if (state === 'pause') togglePause();
    else startGame();
  });

  // Ein Tippen irgendwo auf das Overlay startet ebenfalls.
  el.overlay.addEventListener('pointerdown', function (e) {
    if (e.target === el.ovBtn) return;
    e.preventDefault();
    Sound.resume();
    if (state === 'pause') togglePause();
    else if (state === 'ready' || state === 'over') startGame();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') { releaseAll(); togglePause(); }
  });

  // ------------------------------------------------------------------- Schleife

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  window.addEventListener('resize', resize);

  var lastFrame = 0;
  var acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastFrame) lastFrame = now;
    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (dt > 0.25) dt = 0.25;

    // Zeitlupe: kurzer Effekt bei Beinahe-Treffern, laenger per Power-up
    var target = 1;
    if (G.slowT > 0) target = 0.4;
    else if (G.powers.slow > 0) target = 0.68;
    G.timeScale += (target - G.timeScale) * Math.min(1, dt * 8);

    if (state === 'play') {
      acc += dt * G.timeScale;
      if (acc > 0.4) acc = 0.4;
      var guard = 0;
      while (acc >= STEP && guard++ < 10) {
        update(STEP);
        acc -= STEP;
        if (state !== 'play') { acc = 0; break; }
      }
    } else {
      // Auch in Menues laufen Partikel und Farben weiter.
      G.time += dt * 0.35;
      updateParticles(dt);
      if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
      if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.4);
    }

    pollPad();
    Sound.music(clamp((G.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1), G.hyperT > 0, state === 'play');

    render();
    updateHud();
  }

  // -------------------------------------------------------------------- Start

  resize();
  newGame();
  el.zone.textContent = ZONES[0].name;
  el.best.textContent = records.best.toLocaleString('de-DE');
  el.soundState.textContent = Sound.isOn() ? 'an' : 'aus';
  showReady();
  requestAnimationFrame(frame);
}());
