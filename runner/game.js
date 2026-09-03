/*
 * DRUCKLAUF - 2D-Endlosrunner ohne Framework und ohne Abhaengigkeiten.
 *
 * Die Darstellung ist als Risographie-Druck gebaut: Papier als Grund, zwei
 * Schmuckfarben je Zone, versetzte Druckplatten, Rasterpunkte und Papierkorn.
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
  var MAX_FALL = 1350;          // Endgeschwindigkeit im Fall - darunter bleibt
                                // auch ein tiefer Sturz noch steuerbar
  var HIT_X = 5;                // Nachsicht am Trefferkoerper: die Figur wird
  var HIT_Y = 4;                // schmaler geprueft, als sie gezeichnet wird
  var APEX_VY = 190;            // Geschwindigkeitsfenster um den Scheitelpunkt
  var APEX_GRAVITY = 0.62;      // dort haengt die Figur laenger in der Luft
  var FALL_GRAVITY = 1.25;      // dafuer faellt sie danach zackiger

  var LEAN_BACK = 95;           // so weit laesst sich die Figur zuruecknehmen
  var LEAN_FWD = 205;           // und so weit nach vorn schieben
  var LEAN_SPEED = 360;         // px/s beim Lenken
  var LEAN_HOME = 175;          // px/s zurueck auf die Grundposition

  var SPEED_MIN = 310;          // gemuetlicher Start
  var SPEED_MAX = 980;
  var SPEED_RAMP = 34000;       // Weltpixel bis zur Hoechstgeschwindigkeit

  var DASH_TIME = 0.26;
  var DASH_CD = 1.05;
  var DASH_BOOST = 640;

  var SLIDE_BOOST = 140;        // Rutschen schiebt spuerbar an
  var SLIDE_MIN = 0.20;         // kuerzestes Rutschen, damit ein Tipp nicht zuckt
  var SLIDE_MAX = 1.20;         // laenger nur, solange etwas ueber dem Kopf haengt
  var SLIDE_CD = 0.20;

  var PW = 36;                  // Breite der Figur
  var PH = 48;                  // Hoehe stehend
  var PH_SLIDE = 26;            // Hoehe rutschend

  var SPRING_V = 1280;          // Absprunggeschwindigkeit einer Sprungfeder
  var LIFT_AMP = 62;            // Ausschlag einer Hebebuehne
  var CRUMBLE_FUSE = 0.45;      // so lange traegt eine broeckelnde Plattform

  var HYPER_TIME = 7;
  var HYPER_PER_COIN = 2.4;     // Prozent Ladung pro Muenze
  var HYPER_PER_NEAR = 5;

  var ZONE_LENGTH = 650;        // Meter pro Zone
  var MEILENSTEIN = 250;        // Meter zwischen zwei Zwischenrufen

  // Jede Hindernisart wird einzeln eingefuehrt und einmal erklaert, bevor sie
  // sich unter die anderen mischt. Der Anfang bleibt dadurch ruhig und die
  // Strecke wird ueber die ersten drei Kilometer stetig voller.
  var STUFEN = [
    { ab: 120,  art: 'spike',   name: 'STACHELN',        hinweis: 'Drueberspringen' },
    { ab: 280,  art: 'pit',     name: 'GRUBEN',          hinweis: 'Taste halten springt weiter' },
    { ab: 460,  art: 'crate',   name: 'KISTEN',          hinweis: 'Der Dash zerlegt sie' },
    { ab: 680,  art: 'drone',   name: 'DROHNEN',         hinweis: 'Drunter durchrutschen' },
    { ab: 950,  art: 'spring',  name: 'SPRUNGFEDERN',    hinweis: 'Hoch zu den Muenzen' },
    { ab: 1250, art: 'saw',     name: 'SAEGEN',          hinweis: 'Den richtigen Moment abwarten' },
    { ab: 1600, art: 'gate',    name: 'TORE',            hinweis: 'Durch die Luecke oder durchdashen' },
    { ab: 2000, art: 'lift',    name: 'HEBEBUEHNEN',     hinweis: 'Mitfahren' },
    { ab: 2450, art: 'crumble', name: 'MUERBE ABSAETZE', hinweis: 'Nicht stehenbleiben' },
    { ab: 3000, art: 'mix',     name: 'ALLES AUF EINMAL', hinweis: 'Viel Glueck' }
  ];

  function freigeschaltet(art) {
    for (var i = 0; i < STUFEN.length; i++) {
      if (STUFEN[i].art === art) return G.dist >= STUFEN[i].ab;
    }
    return true;
  }
  var MAX_PARTS = 420;

  // Riso-Schmuckfarben. Jede Zone ist ein eigener Druckgang aus zwei Tinten
  // auf einem leicht anders getoenten Papier.
  var INKS = {
    pink:    { hex: '#ff4f9a', hue: 336 },
    orange:  { hex: '#ff6b2c', hue: 19 },
    gelb:    { hex: '#ffc61e', hue: 44 },
    gruen:   { hex: '#3f9e4d', hue: 129 },
    aqua:    { hex: '#00a6a0', hue: 178 },
    kobalt:  { hex: '#2f4bd8', hue: 230 },
    violett: { hex: '#7a4bd8', hue: 262 }
  };

  var ZONES = [
    { name: 'WEIDELAND',  a: 'gruen',   b: 'gelb',    paper: '#f3ecd9' },
    { name: 'STEINBRUCH', a: 'orange',  b: 'kobalt',  paper: '#f4e7d5' },
    { name: 'NEBELTAL',   a: 'aqua',    b: 'violett', paper: '#eeeade' },
    { name: 'DUENENZUG',  a: 'gelb',    b: 'pink',    paper: '#f6edd8' },
    { name: 'HOCHMOOR',   a: 'kobalt',  b: 'gruen',   paper: '#edeade' },
    { name: 'SALZSEE',    a: 'pink',    b: 'aqua',    paper: '#f4ebe2' },
    { name: 'ASCHEFELD',  a: 'violett', b: 'orange',  paper: '#eee8dc' }
  ];

  var PAPER_DARK = '#22201e';   // die dunkle Tinte, nie reines Schwarz

  var POWERS = {
    shield: { label: 'SCHILD',   dur: 0,  hue: 178, ink: '#00a6a0' },
    magnet: { label: 'MAGNET',   dur: 9,  hue: 336, ink: '#ff4f9a' },
    x2:     { label: 'X2',       dur: 10, hue: 44,  ink: '#ffc61e' },
    slow:   { label: 'ZEITLUPE', dur: 6,  hue: 262, ink: '#7a4bd8' }
  };

  var STORE_BEST = 'drucklauf.best';
  var STORE_DIST = 'drucklauf.dist';
  var STORE_COINS = 'drucklauf.coins';
  var STORE_MUTE = 'drucklauf.mute';

  // ------------------------------------------------------------ Hilfsfunktionen

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }

  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
  }

  // Ordnet einem Farbwinkel die naechstgelegene Schmuckfarbe zu. So bleiben alle
  // vorhandenen Aufrufe mit Farbwinkeln gueltig, drucken aber in echten Tinten.
  function inkFromHue(h) {
    h = ((h % 360) + 360) % 360;
    var beste = null, abstand = 999;
    for (var k in INKS) {
      var d = Math.abs(((INKS[k].hue - h + 540) % 360) - 180);
      if (d < abstand) { abstand = d; beste = INKS[k].hex; }
    }
    return beste;
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
      spring: function () { tone(170, 0.3, 'sine', 0.32, 940); noise(0.1, 0.1); },
      crumble: function () { noise(0.3, 0.16); tone(140, 0.26, 'triangle', 0.16, 60); },
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
    bestWrap: document.getElementById('bestWrap'),
    bestFill: document.getElementById('bestFill'),
    toast: document.getElementById('toast'),
    overlay: document.getElementById('overlay'),
    ovTitle: document.getElementById('ovTitle'),
    ovText: document.getElementById('ovText'),
    ovStats: document.getElementById('ovStats'),
    ovExtra: document.getElementById('ovExtra'),
    ovBtn: document.getElementById('ovBtn'),
    touch: document.getElementById('touch'),
    fsBtn: document.getElementById('fsBtn'),
    drehen: document.getElementById('drehen'),
    sheet: document.querySelector('.sheet'),
    btnHyper: document.getElementById('btnHyper'),
    zonen: document.getElementById('zonen'),
    soundState: document.getElementById('soundState')
  };

  var records = {
    best: parseInt(load(STORE_BEST, '0'), 10) || 0,
    dist: parseInt(load(STORE_DIST, '0'), 10) || 0,
    coins: parseInt(load(STORE_COINS, '0'), 10) || 0,
    meter: parseInt(load('drucklauf.meter', '0'), 10) || 0,
    rang: parseInt(load('drucklauf.rang', '0'), 10) || 0
  };

  // Wie oft eine Hindernisart schon erklaert wurde - nach dreimal reicht es.
  function zaehlerLesen(art) {
    return parseInt(load('drucklauf.gesehen.' + art, '0'), 10) || 0;
  }

  function zaehlerSchreiben(art, wert) {
    save('drucklauf.gesehen.' + art, wert);
  }

  // ---------------------------------------------------------------- Auftraege
  //
  // Drei Auftraege laufen immer mit und ueberdauern den Tod. Sie geben jedem
  // Lauf ein Ziel ausser der Punktzahl: Auch ein missratener Lauf bringt einen
  // Auftrag ein Stueck weiter. Erfuellte werden durch etwas groessere ersetzt.
  var AUFTRAGSARTEN = [
    { id: 'muenzen', feld: 'coins',      basis: 22,   wachstum: 10,  text: 'Sammle {z} Muenzen in einem Lauf' },
    { id: 'strecke', feld: 'dist',       basis: 350,  wachstum: 170, text: 'Komm {z} Meter weit' },
    { id: 'knapp',   feld: 'nearMisses', basis: 3,    wachstum: 2,   text: 'Weiche {z}-mal knapp aus' },
    { id: 'kombo',   feld: 'bestCombo',  basis: 10,   wachstum: 5,   text: 'Halte eine Kombo von {z}' },
    { id: 'hyper',   feld: 'hyperUses',  basis: 1,    wachstum: 1,   text: 'Zuende {z}-mal den Hyper-Modus' },
    { id: 'federn',  feld: 'springs',    basis: 3,    wachstum: 2,   text: 'Nutze {z} Sprungfedern' },
    { id: 'dash',    feld: 'dashBreaks', basis: 3,    wachstum: 2,   text: 'Zerlege {z} Kisten per Dash' },
    { id: 'punkte',  feld: 'score',      basis: 1500, wachstum: 800, text: 'Hole {z} Punkte in einem Lauf' },
    { id: 'gmuenzen', feld: 'coins', gesamt: true, basis: 120, wachstum: 90,  text: 'Sammle {z} Muenzen insgesamt' },
    { id: 'gmeter',   feld: 'meter', gesamt: true, basis: 2500, wachstum: 1800, text: 'Lauf {z} Meter insgesamt' }
  ];

  var RAENGE = ['ANLEGER', 'SETZER', 'DRUCKER', 'FARBMISCHER',
                'ANDRUCKMEISTER', 'DRUCKMEISTER', 'SCHWARZKUENSTLER'];
  // Mit jedem Rang bekommt die Figur eine neue Tinte - sichtbarer Fortschritt.
  var FIGUR_TINTEN = ['#2f4bd8', '#7a4bd8', '#00a6a0', '#3f9e4d', '#ff6b2c'];

  function rangStufe() { return Math.floor(records.rang / 3); }
  function rangName() { return RAENGE[Math.min(RAENGE.length - 1, rangStufe())]; }
  function figurTinte() { return FIGUR_TINTEN[Math.min(FIGUR_TINTEN.length - 1, rangStufe())]; }

  function auftragArt(id) {
    for (var i = 0; i < AUFTRAGSARTEN.length; i++) {
      if (AUFTRAGSARTEN[i].id === id) return AUFTRAGSARTEN[i];
    }
    return AUFTRAGSARTEN[0];
  }

  var auftraege = [];

  function auftragWuerfeln(vermeiden) {
    var frei = [];
    for (var i = 0; i < AUFTRAGSARTEN.length; i++) {
      if (vermeiden.indexOf(AUFTRAGSARTEN[i].id) < 0) frei.push(AUFTRAGSARTEN[i]);
    }
    if (!frei.length) frei = AUFTRAGSARTEN;
    var art = pick(frei);
    var stufe = rangStufe();
    return {
      id: art.id,
      ziel: Math.round(art.basis + art.wachstum * stufe),
      start: art.gesamt ? records[art.feld] : 0,
      fertig: false
    };
  }

  function auftraegeLaden() {
    try {
      var roh = JSON.parse(load('drucklauf.auftraege', 'null'));
      if (roh && roh.length === 3) {
        auftraege = roh;
        // Erfuellte gleich ersetzen, sonst wuerde ein Neuladen den Rang
        // ein zweites Mal vergeben.
        auftraegeNachziehen();
        return;
      }
    } catch (e) { /* neu wuerfeln */ }
    auftraege = [];
    while (auftraege.length < 3) {
      var ids = auftraege.map(function (a) { return a.id; });
      auftraege.push(auftragWuerfeln(ids));
    }
    auftraegeSichern();
  }

  function auftraegeSichern() {
    try { save('drucklauf.auftraege', JSON.stringify(auftraege)); } catch (e) { /* egal */ }
  }

  function auftragStand(a) {
    var art = auftragArt(a.id);
    if (art.gesamt) return Math.max(0, records[art.feld] - a.start);
    if (!G) return 0;
    return Math.floor(G[art.feld] || 0);
  }

  function auftraegePruefen(still) {
    for (var i = 0; i < auftraege.length; i++) {
      var a = auftraege[i];
      if (a.fertig) continue;
      if (auftragStand(a) < a.ziel) continue;
      a.fertig = true;
      records.rang++;
      save('drucklauf.rang', records.rang);
      auftraegeSichern();
      if (still) continue;      // am Laufende nur vermerken, nicht feiern
      var bonus = 400 * multiplier();
      G.score += bonus;
      G.meter = Math.min(100, G.meter + 12);
      toast('AUFTRAG ERFUELLT', INKS.gruen.hue, auftragArt(a.id).text.replace('{z}', a.ziel));
      rumpeln([30, 50, 60]);
      floatText(G.worldX + G.screenX, G.py - 40, '+' + bonus, INKS.gruen.hue, 26);
      flash(0.35, INKS.gruen.hue);
      Sound.hyper();
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 50, {
        minSpeed: 120, maxSpeed: 480, grav: 300, hue: INKS.gruen.hue, hueSpread: 90, maxLife: 1
      });
    }
  }

  // Erfuellte Auftraege werden erst nach dem Lauf ersetzt, damit die Meldung
  // im Lauf stehen bleibt.
  function auftraegeNachziehen() {
    var neu = false;
    for (var i = 0; i < auftraege.length; i++) {
      if (!auftraege[i].fertig) continue;
      var ids = auftraege.map(function (a) { return a.id; });
      auftraege[i] = auftragWuerfeln(ids);
      neu = true;
    }
    if (neu) auftraegeSichern();
  }

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
      squash: 0,                // >0 gestaucht (Landung), <0 gestreckt (Absprung)
      fastFall: false,
      rutschVorher: false,
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
      lastRegenChunk: -99,
      letzterChunk: '',
      regenAnkuendigen: false,
      stufeIndex: 0,
      meilenstein: 0,
      springs: 0,
      dashBreaks: 0,
      rekordGeknackt: false,
      zone: 0,
      hue: INKS[ZONES[0].a].hue,
      hueTarget: INKS[ZONES[0].a].hue,
      paper: hex2rgb(ZONES[0].paper),
      paperT: hex2rgb(ZONES[0].paper),
      inkA: hex2rgb(INKS[ZONES[0].a].hex),
      inkAT: hex2rgb(INKS[ZONES[0].a].hex),
      inkB: hex2rgb(INKS[ZONES[0].b].hex),
      inkBT: hex2rgb(INKS[ZONES[0].b].hex),
      versatz: [2.4, -1.6],     // Fehlregister der zweiten Druckplatte

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

  function ledge(x, y, w, broeckelt) {
    G.platforms.push({ x: x, y: y, w: w, h: 18, solid: false, crumble: !!broeckelt, fuse: -1 });
  }

  // Fester Riegel - baut Tore und alles, was nicht Kiste ist.
  function block(x, y, w, h) {
    G.obstacles.push({ type: 'block', x: x, y: y, w: w, h: h, dead: 0, gap: 999, passed: false });
  }

  // Hebebuehne: ein Absatz, der auf und ab faehrt.
  function hebebuehne(x, y, w, amp) {
    G.platforms.push({ x: x, y: y, w: w, h: 18, solid: false, crumble: false, fuse: -1,
                       basis: y, amp: amp, spd: rand(0.9, 1.5), phase: Math.random() * 6.283 });
  }

  function spring(x) {
    G.obstacles.push({ type: 'spring', x: x, y: GROUND_Y - 20, w: 56, h: 20,
                       used: -9, dead: 0, gap: 999, passed: true });
  }

  // Verhindert, dass zwei Hindernisse so dicht stehen, dass keine Loesung bleibt.
  function frei(x, w, abstand) {
    if (abstand === undefined) abstand = 86;
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      var ox = o.type === 'saw' ? o.x - o.r : o.x;
      var ow = o.type === 'saw' ? o.r * 2 : o.w;
      if (x < ox + ow + abstand && x + w + abstand > ox) return false;
    }
    return true;
  }

  // Streut zusaetzliche Stacheln in die freien Luecken eines Abschnitts.
  function streue(x, len, anzahl) {
    if (!freigeschaltet('spike')) return;
    for (var i = 0; i < anzahl; i++) {
      for (var versuch = 0; versuch < 8; versuch++) {
        var sx = x + rand(150, len - 110);
        if (frei(sx, 30)) { spike(sx); break; }
      }
    }
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
    // Die Schwierigkeit zieht erst nach den ersten hundert Metern an und
    // braucht danach fast drei Kilometer bis zum Anschlag.
    var d = clamp((G.dist - 100) / 2800, 0, 1);
    var i = G.chunk++;

    if (i < 1) { chunkStart(560); return; }
    if (i - G.lastPowerChunk >= 6) { chunkTreasure(d); return; }
    if (G.dist > 320 && i - G.lastRegenChunk >= 13) { chunkMuenzregen(d); return; }

    // In den Topf kommt nur, was die Strecke schon freigeschaltet hat. Die
    // Bausteine, die eine eigene Bewegung verlangen - rutschen, abwarten,
    // treffen - liegen doppelt darin, sonst kaemen sie zu selten dran.
    var topf = ['flat'];
    if (freigeschaltet('spike')) topf.push('rhythmus');
    if (freigeschaltet('pit')) topf.push('pit', 'pit');
    if (freigeschaltet('crate')) topf.push('crates', 'crates');
    if (freigeschaltet('drone')) topf.push('drones', 'drones');
    if (freigeschaltet('spring')) topf.push('springs');
    if (freigeschaltet('saw')) topf.push('saws', 'saws');
    if (freigeschaltet('gate')) topf.push('tore', 'tore');
    if (freigeschaltet('lift')) topf.push('lifte');
    if (G.dist > 520) topf.push('stairs');
    if (freigeschaltet('mix')) topf.push('gauntlet', 'gauntlet');
    topf.push('treasure');

    // Nie zweimal dasselbe hintereinander - das faellt sofort auf.
    var wahl = pick(topf);
    if (wahl === G.letzterChunk && topf.length > 3) wahl = pick(topf);
    G.letzterChunk = wahl;
    if (wahl === 'flat') chunkFlat(rand(330, 440), d);
    else if (wahl === 'rhythmus') chunkRhythmus(d);
    else if (wahl === 'pit') chunkPit(d);
    else if (wahl === 'stairs') chunkStairs(d);
    else if (wahl === 'drones') chunkDrones(d);
    else if (wahl === 'saws') chunkSaws(d);
    else if (wahl === 'crates') chunkCrates(d);
    else if (wahl === 'springs') chunkSprings(d);
    else if (wahl === 'tore') chunkTore(d);
    else if (wahl === 'lifte') chunkLifte(d);
    else if (wahl === 'gauntlet') chunkGauntlet(d);
    else chunkTreasure(d);
  }

  // Die ersten Meter bleiben leer: die Figur startet bei x = PLAYER_X und
  // braucht Anlauf, bevor das erste Hindernis auftauchen darf.
  function chunkStart(len) {
    ground(G.genX, len);
    coinLine(G.genX + 340, GROUND_Y - 60, 8, 36);
    G.genX += len;
  }

  function chunkFlat(len, d) {
    var x = G.genX;
    ground(x, len);
    streue(x, len, 1 + Math.round(d * 2));
    if (freigeschaltet('crate') && Math.random() < 0.45) crate(x + rand(180, len - 120), false);
    if (Math.random() < 0.5) ledge(x + rand(120, len - 220), GROUND_Y - rand(150, 210), rand(120, 190));
    coinLine(x + 80, GROUND_Y - 60, randInt(5, 9), 38);
    G.genX += len;
  }

  // Gleichmaessiger Takt: identische Hindernisse in festem Abstand. Das laesst
  // sich einrhythmisieren und fuehlt sich beim Treffen richtig gut an.
  function chunkRhythmus(d) {
    var x = G.genX;
    var abstand = rand(190, 250) - d * 30;
    var n = randInt(3, 5);
    var len = abstand * n + 260;
    ground(x, len);
    for (var i = 0; i < n; i++) {
      var sx = x + 170 + i * abstand;
      spike(sx);
      coinArc(sx - 46, GROUND_Y - 96, 3, 92, 34);
    }
    G.genX += len;
  }

  function chunkPit(d) {
    var x = G.genX;
    var lead = rand(160, 230);
    ground(x, lead);
    // Die Luecke bleibt immer springbar: Flugzeit mal aktuelle Geschwindigkeit.
    var maxGap = Math.min(330, G.speed * 0.44);
    var gap = clamp(rand(115, 145 + d * 200), 105, maxGap);
    var pits = 1 + (Math.random() < 0.25 + d * 0.4 ? 1 : 0) + (Math.random() < d * 0.35 ? 1 : 0);
    var cursor = x + lead;

    for (var p = 0; p < pits; p++) {
      coinArc(cursor + 14, GROUND_Y - 74, 5, gap - 28, 56);
      if (gap > 190 && freigeschaltet('crumble') && Math.random() < 0.45) {
        ledge(cursor + gap * 0.3, GROUND_Y - 150, gap * 0.4, true);
      }
      cursor += gap;
      var island = p === pits - 1 ? rand(260, 360) : rand(150, 210);
      ground(cursor, island);
      // Die ersten 120 px einer Insel bleiben frei - dort landet man.
      if (island > 240) streue(cursor + 120, island - 120, Math.random() < 0.4 + d * 0.4 ? 1 : 0);
      cursor += island;
    }
    G.genX = cursor;
  }

  function chunkStairs(d) {
    var x = G.genX;
    var len = rand(520, 700);
    ground(x, len);
    var steps = randInt(3, 5);
    var y = GROUND_Y - 108;
    var cx = x + 110;
    for (var i = 0; i < steps; i++) {
      var w = rand(100, 150);
      ledge(cx, y, w, freigeschaltet('crumble') && d > 0.4 && Math.random() < 0.35);
      coinLine(cx + 24, y - 44, Math.max(2, Math.round(w / 40)), 38);
      cx += w + rand(55, 95);
      y -= i < steps / 2 ? 74 : -74;
      y = clamp(y, 150, GROUND_Y - 96);
    }
    streue(x, len, 1 + Math.round(d * 2));
    G.genX += len;
  }

  function chunkDrones(d) {
    var x = G.genX;
    var len = rand(480, 640);
    ground(x, len);
    var n = randInt(2, 3 + Math.round(d * 2));
    var cx = x + 160;
    for (var i = 0; i < n; i++) {
      drone(cx);
      coinLine(cx - 6, GROUND_Y - 16, 4, 22);   // Muenzen belohnen das Rutschen
      cx += rand(150, 215);
      if (cx > x + len - 80) break;
    }
    streue(x, len, 1 + Math.round(d * 2));
    G.genX += len;
  }

  function chunkSaws(d) {
    var x = G.genX;
    var len = rand(500, 660);
    ground(x, len);
    var n = randInt(2, 3 + Math.round(d * 2));
    var cx = x + 170;
    for (var i = 0; i < n; i++) {
      var floating = Math.random() < 0.5;
      saw(cx, floating ? GROUND_Y - rand(120, 200) : GROUND_Y - 34, floating ? rand(40, 90) : 0);
      coinArc(cx - 60, GROUND_Y - 100, 5, 120, 40);
      cx += rand(170, 240);
      if (cx > x + len - 90) break;
    }
    streue(x, len, Math.round(d * 2));
    G.genX += len;
  }

  function chunkCrates(d) {
    var x = G.genX;
    var len = rand(460, 620);
    ground(x, len);
    var n = randInt(2, 3 + Math.round(d));
    var cx = x + 150;
    for (var i = 0; i < n; i++) {
      var tall = Math.random() < 0.35 + d * 0.3;
      crate(cx, tall);
      coinArc(cx - 70, GROUND_Y - (tall ? 150 : 120), 5, 150, 44);
      cx += rand(160, 230);
      if (cx > x + len - 80) break;
    }
    if (Math.random() < 0.7) {
      ledge(x + 200, GROUND_Y - 190, rand(180, 240));
      coinLine(x + 230, GROUND_Y - 238, 5, 38);
    }
    streue(x, len, Math.round(d * 2));
    G.genX += len;
  }

  function chunkSprings(d) {
    var x = G.genX;
    var len = rand(520, 680);
    ground(x, len);
    var cx = x + 170;
    var n = randInt(1, 2);
    for (var i = 0; i < n; i++) {
      spring(cx);
      coinLine(cx - 20, GROUND_Y - 200, 6, 34);
      coinLine(cx + 10, GROUND_Y - 330, 5, 34);
      if (Math.random() < 0.6) {
        ledge(cx + 120, GROUND_Y - 260, rand(140, 200), freigeschaltet('crumble') && d > 0.3);
      }
      cx += rand(230, 300);
      if (cx > x + len - 110) break;
    }
    streue(x, len, 1 + Math.round(d * 2));
    G.genX += len;
  }

  // Tor: unten ein Riegel, oben ein Sturz. Dazwischen bleibt eine Luecke, die
  // man mit der richtigen Sprunghoehe trifft - oder man dasht einfach hindurch.
  function chunkTore(d) {
    var x = G.genX;
    var len = rand(520, 700);
    ground(x, len);
    var n = randInt(1, 2 + Math.round(d));
    var cx = x + 180;
    for (var i = 0; i < n; i++) {
      var unten = 44 + d * 14;                       // Hoehe des Bodenriegels
      var luecke = 116 - d * 22;                     // lichte Weite darueber
      block(cx, GROUND_Y - unten, 40, unten);
      block(cx, 0, 40, GROUND_Y - unten - luecke);
      coinLine(cx + 4, GROUND_Y - unten - luecke * 0.5, 1, 0);
      coinArc(cx - 130, GROUND_Y - unten - luecke * 0.5, 4, 110, 12);
      cx += rand(240, 320);
      if (cx > x + len - 120) break;
    }
    streue(x, len, Math.round(d));
    G.genX += len;
  }

  // Hebebuehnen ueber einer breiten Grube: mitfahren statt springen.
  function chunkLifte(d) {
    var x = G.genX;
    var lead = rand(180, 240);
    ground(x, lead);
    var kluft = rand(300, 380);
    var cx = x + lead;
    hebebuehne(cx + 40, GROUND_Y - 130, 120, LIFT_AMP);
    coinLine(cx + 60, GROUND_Y - 200, 4, 34);
    if (kluft > 340) {
      hebebuehne(cx + 200, GROUND_Y - 190, 110, LIFT_AMP * 0.8);
      coinLine(cx + 215, GROUND_Y - 260, 3, 34);
    }
    cx += kluft;
    var insel = rand(280, 360);
    ground(cx, insel);
    streue(cx + 120, insel - 120, Math.round(d));
    G.genX = cx + insel;
  }

  function chunkGauntlet(d) {
    var x = G.genX;
    var len = rand(620, 820);
    ground(x, len);
    var cx = x + 150;
    var arten = ['spike', 'crate', 'drone', 'saw'];
    while (cx < x + len - 120) {
      var art = pick(arten);
      if (art === 'spike') spike(cx);
      else if (art === 'crate') crate(cx, Math.random() < 0.4);
      else if (art === 'drone') { drone(cx); coinLine(cx - 6, GROUND_Y - 16, 4, 22); }
      else saw(cx, Math.random() < 0.5 ? GROUND_Y - rand(130, 190) : GROUND_Y - 34, rand(30, 80));
      cx += rand(145, 205);
    }
    coinWave(x + 120, GROUND_Y - 150, 12, 40, 50);
    if (Math.random() < 0.5) ledge(x + 180, GROUND_Y - 230, rand(160, 220));
    G.genX += len;
  }

  // Muenzregen: kurze Belohnungsstrecke ohne Gefahr, aber randvoll.
  function chunkMuenzregen(d) {
    var x = G.genX;
    var len = rand(560, 680);
    ground(x, len);
    G.lastRegenChunk = G.chunk;
    G.regenAnkuendigen = true;
    for (var reihe = 0; reihe < 4; reihe++) {
      coinWave(x + 90 + reihe * 18, GROUND_Y - 60 - reihe * 52, 13, 36, 26);
    }
    if (Math.random() < 0.5) spring(x + len * 0.5);
    G.genX += len;
  }

  function chunkTreasure(d) {
    var x = G.genX;
    var len = rand(560, 720);
    ground(x, len);
    G.lastPowerChunk = G.chunk;

    var kinds = ['shield', 'magnet', 'x2', 'slow'];
    pickup(x + len * 0.5, GROUND_Y - rand(110, 190), pick(kinds));

    var style = Math.random();
    if (style < 0.34) coinWave(x + 100, GROUND_Y - 130, 15, 36, 54);
    else if (style < 0.67) coinArc(x + 100, GROUND_Y - 60, 14, len - 220, 150);
    else {
      for (var row = 0; row < 3; row++) coinLine(x + 120 + row * 16, GROUND_Y - 70 - row * 44, 9, 38);
    }
    streue(x, len, Math.round(d * 2));
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
    // Gleiche Meldung kurz hintereinander wuerde sich nur uebereinanderlegen.
    var letzte = G.texts[G.texts.length - 1];
    if (letzte && letzte.text === text && letzte.life < 0.25) return;
    G.texts.push({ x: x, y: y, text: text, hue: hue, size: size || 20, life: 0, max: 0.9 });
  }

  var toastTimer = null;
  function toast(text, hue, unterzeile) {
    if (unterzeile) {
      el.toast.innerHTML = '<b></b><small></small>';
      el.toast.firstChild.textContent = text;
      el.toast.lastChild.textContent = unterzeile;
    } else {
      el.toast.textContent = text;
    }
    el.toast.style.color = inkFromHue(hue === undefined ? G.hue : hue);
    el.toast.classList.remove('show');
    void el.toast.offsetWidth;                 // Animation neu starten
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
  }

  function shake(amount) { G.shake = Math.max(G.shake, amount); }

  // Kurzes Ruetteln auf Geraeten, die das koennen - nur bei den wenigen
  // Momenten, die es tragen, nicht bei jedem Sprung.
  function rumpeln(muster) {
    if (!Sound.isOn() || !navigator.vibrate) return;
    try { navigator.vibrate(muster); } catch (e) { /* egal */ }
  }
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
      G.squash = -0.35;                  // beim Absprung streckt sie sich
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
      G.squash = -0.28;
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
    rumpeln([25, 40, 25, 40, 60]);
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
    if (G.squash !== 0) {
      G.squash += (0 - G.squash) * Math.min(1, dt * 11);
      if (Math.abs(G.squash) < 0.005) G.squash = 0;
    }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.4);

    // --- Vorwaertsbewegung
    var ramp = clamp(G.worldX / SPEED_RAMP, 0, 1);
    G.speed = lerp(SPEED_MIN, SPEED_MAX, ramp * ramp * 0.55 + ramp * 0.45);
    var speed = G.speed + (G.dashT > 0 ? DASH_BOOST : 0) + (G.hyperT > 0 ? 340 : 0)
              + (G.sliding ? SLIDE_BOOST : 0);
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
    // Schnellfall nur, wenn die Taste in der Luft frisch gedrueckt wird. Sonst
    // wuerde ein Daumen, der auf der Rutschzone liegen bleibt, jeden Sprung
    // sofort wieder zu Boden ziehen.
    var rutschJetzt = held('slide');
    if (!G.onGround && rutschJetzt && !G.rutschVorher) G.fastFall = true;
    if (G.onGround || !rutschJetzt) G.fastFall = false;
    G.rutschVorher = rutschJetzt;

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
      if (!G.onGround && G.fastFall) g = GRAVITY * FAST_FALL;
      G.vy += g * dt;
      if (G.vy > MAX_FALL) G.vy = MAX_FALL;
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
          if (p.crumble && p.fuse < 0) { p.fuse = CRUMBLE_FUSE; Sound.crumble(); }
        }
      }
      if (landed) {
        if (!G.onGround) {
          // Je haerter der Aufprall, desto staerker staucht die Figur.
          G.squash = clamp(G.vy / 1100, 0, 1) * 0.55;
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
    updatePlatforms(dt);
    updateCoins(dt, px);
    updatePickups(px);
    updateObstacles(px);
    updateParticles(dt);
    updateZone(dt);
    updateStufen();
    auftraegePruefen();
  }

  function cull() {
    var left = G.worldX - 260;
    var keep = function (o) { return (o.x + (o.w || o.r * 2 || 40)) > left; };
    G.platforms = G.platforms.filter(function (p) { return p.x + p.w > left; });
    G.obstacles = G.obstacles.filter(function (o) { return !o.dead && keep(o); });
    G.coinList = G.coinList.filter(function (c) { return !c.got && c.x + 20 > left; });
    G.pickups = G.pickups.filter(function (p) { return !p.got && p.x + 30 > left; });
  }

  // Broeckelnde Absaetze halten nur kurz, nachdem jemand darauf gelandet ist.
  function updatePlatforms(dt) {
    var out = [];
    for (var i = 0; i < G.platforms.length; i++) {
      var p = G.platforms[i];
      if (p.amp) p.y = p.basis + Math.sin(G.time * p.spd + p.phase) * p.amp;
      if (p.fuse > 0) {
        p.fuse -= dt;
        if (p.fuse <= 0) {
          burst(p.x + p.w / 2, p.y + 6, 22, {
            minSpeed: 30, maxSpeed: 180, grav: 1100, hue: G.hue + 160,
            hueSpread: 40, square: true, maxLife: 0.9
          });
          continue;
        }
      }
      out.push(p);
    }
    G.platforms = out;
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
    // Der Trefferkoerper ist etwas kleiner als die gezeichnete Figur. Damit
    // toetet nicht mehr, was nur die Ecke streift - der haeufigste Grund fuer
    // ein "das war doch gar nicht getroffen".
    var box = { x: px + HIT_X, y: G.py + HIT_Y, w: PW - HIT_X * 2, h: G.h - HIT_Y * 2 };

    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (o.dead) continue;
      if (o.x > G.worldX + W + 120) continue;

      var b = obstacleBox(o);

      // Sprungfedern sind nie toedlich, sie schleudern nur nach oben.
      if (o.type === 'spring') {
        if (aabb(box, b) && G.vy > -60 && G.time - o.used > 0.25 && G.hyperT <= 0) {
          o.used = G.time;
          G.vy = -SPRING_V;
          G.jumps = 1;
          G.onGround = false;
          G.cutArmed = false;            // ein Federsprung wird nie gekappt
          endSlide();
          G.springs++;
          G.score += 25 * multiplier();
          G.meter = Math.min(100, G.meter + 2);
          Sound.spring();
          shake(5);
          floatText(o.x, o.y - 20, 'BOING!', 96, 22);
          burst(o.x + o.w / 2, o.y, 20, {
            angle: -Math.PI / 2, spread: 0.9, minSpeed: 140, maxSpeed: 420,
            grav: 500, hue: 96, hueSpread: 40
          });
        }
        continue;
      }

      // Beinahe-Treffer merken, solange das Hindernis in der Naehe ist.
      if (Math.abs(b.x - px) < 260) o.gap = Math.min(o.gap, rectGap(box, b));

      if (aabb(box, b)) {
        if (G.hyperT > 0) {
          killObstacle(o, G.time * 260);
          G.score += 60 * multiplier();
          floatText(b.x, b.y - 10, 'ZERLEGT +' + (60 * multiplier()), (G.time * 260) % 360, 20);
          continue;
        }
        if (G.dashT > 0 && (o.type === 'crate' || o.type === 'block')) {
          killObstacle(o, 30);
          G.dashBreaks++;
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

  // Neue Hindernisart, Meilenstein, Bestmarke - alles, was den Lauf gliedert.
  function updateStufen() {
    while (G.stufeIndex < STUFEN.length && G.dist >= STUFEN[G.stufeIndex].ab) {
      var stufe = STUFEN[G.stufeIndex++];
      var gesehen = zaehlerLesen(stufe.art);
      if (gesehen < 3) {
        zaehlerSchreiben(stufe.art, gesehen + 1);
        toast('NEU: ' + stufe.name, INKS.pink.hue, stufe.hinweis);
      } else {
        toast(stufe.name, INKS.pink.hue);
      }
      flash(0.25, INKS.pink.hue);
      Sound.power();
    }

    var m = Math.floor(G.dist / MEILENSTEIN);
    if (m > G.meilenstein) {
      G.meilenstein = m;
      var bonus = 50 * multiplier();
      G.score += bonus;
      floatText(G.worldX + G.screenX, G.py - 30, m * MEILENSTEIN + ' M  +' + bonus, INKS.aqua.hue, 24);
      Sound.near();
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 16, {
        minSpeed: 90, maxSpeed: 300, grav: 400, hue: INKS.aqua.hue, hueSpread: 60
      });
    }

    if (G.regenAnkuendigen) {
      G.regenAnkuendigen = false;
      toast('MUENZREGEN', INKS.gelb.hue);
    }

    // Bestmarke des bisher weitesten Laufs
    if (!G.rekordGeknackt && records.dist > 60 && G.dist >= records.dist) {
      G.rekordGeknackt = true;
      toast('BESTMARKE!', INKS.gelb.hue, 'ab hier ist alles neu');
      rumpeln([20, 30, 20, 30, 90]);
      flash(0.5, INKS.gelb.hue);
      shake(10);
      G.score += 300 * multiplier();
      Sound.hyper();
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 60, {
        minSpeed: 140, maxSpeed: 520, grav: 200, hue: INKS.gelb.hue, hueSpread: 120, maxLife: 1
      });
    }
  }

  function updateZone(dt) {
    var z = Math.floor(G.dist / ZONE_LENGTH) % ZONES.length;
    if (z !== G.zone) {
      G.zone = z;
      var Z = ZONES[z];
      G.hueTarget = INKS[Z.a].hue;
      G.paperT = hex2rgb(Z.paper);
      G.inkAT = hex2rgb(INKS[Z.a].hex);
      G.inkBT = hex2rgb(INKS[Z.b].hex);
      // Beim Zonenwechsel verrutscht die zweite Platte neu.
      G.versatz = [rand(1.6, 3.4) * (Math.random() < 0.5 ? -1 : 1), rand(-2.4, 2.4)];
      toast('DRUCKGANG ' + (z + 1) + ' — ' + Z.name, INKS[Z.a].hue);
      flash(0.3, INKS[Z.a].hue);
      el.zone.textContent = Z.name + ' · ' + Z.a + '/' + Z.b;
      burst(G.worldX + G.screenX + PW / 2, G.py + G.h / 2, 40, {
        minSpeed: 160, maxSpeed: 520, grav: 0, hue: INKS[Z.a].hue, hueSpread: 90, maxLife: 0.9
      });
    }
    var t = Math.min(1, dt * 1.6);
    G.paper = mixRgb(G.paper, G.paperT, t);
    G.inkA = mixRgb(G.inkA, G.inkAT, t);
    G.inkB = mixRgb(G.inkB, G.inkBT, t);
    var d = ((G.hueTarget - G.hue + 540) % 360) - 180;
    G.hue += d * t;
  }

  function die(cause) {
    if (state !== 'play') return;
    state = 'over';
    Sound.hit();
    shake(24);
    rumpeln([40, 60, 120]);
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
    records.meter += dist;
    save('drucklauf.meter', records.meter);
    auftraegePruefen(true);

    showOver(score, dist, isBest, cause);
  }

  // ------------------------------------------------------------------ Zeichnen
  //
  // Alles ist wie ein Risographie-Druck aufgebaut: Papier als Grund, darauf
  // zwei Schmuckfarben im Multiplikationsmodus, die zweite Druckplatte leicht
  // verrutscht, Flaechen mit Rasterpunkten statt Verlaeufen und Papierkorn
  // ueber allem. Leuchteffekte gibt es keine - Tinte leuchtet nicht.

  var ctx = ctx2d;

  // Die Welt wechselt mit jedem Druckgang die Farbe, die Akteure nie: was
  // gefaehrlich ist, ist immer pink, Muenzen immer gelb, die Figur immer blau.
  var GELB = '#ffc61e';
  var PINK = '#ff4f9a';
  var GRUEN = '#3f9e4d';
  var FIGUR = '#2f4bd8';

  function papier(a) { return rgba(G.paper, a); }
  function tinteA(a) { return rgba(G.inkA, a); }
  function tinteB(a) { return rgba(G.inkB, a); }
  function tinte(a) { return 'rgba(34,32,30,' + (a === undefined ? 1 : a) + ')'; }

  // Zwei Tinten uebereinander multiplizieren sich. Fuer den Hintergrund rechnen
  // wir das Ergebnis vorweg aus und zeichnen deckend - das spart pro Bild
  // dutzende Wechsel des Mischmodus, die auf Telefonen teuer sind.
  function multRgb(a, b) {
    return [a[0] * b[0] / 255, a[1] * b[1] / 255, a[2] * b[2] / 255];
  }

  function aufPapierFarbe(ink, deckung) {
    return multRgb(G.paper, mixRgb([255, 255, 255], ink, deckung));
  }

  // Rasterfuellung als Muster: eine Flaeche, ein Fuellvorgang.
  var musterVorrat = {};
  function rasterFuellung(grund, punkt) {
    var key = (grund[0] | 0) + '_' + (grund[1] | 0) + '_' + (grund[2] | 0) + '_'
            + (punkt[0] | 0) + '_' + (punkt[1] | 0) + '_' + (punkt[2] | 0);
    var vorhanden = musterVorrat[key];
    if (vorhanden) return vorhanden;
    var c = document.createElement('canvas');
    c.width = c.height = 6;
    var g = c.getContext('2d');
    g.fillStyle = rgba(grund, 1);
    g.fillRect(0, 0, 6, 6);
    g.fillStyle = rgba(punkt, 1);
    g.beginPath();
    g.arc(3, 3, 1.75, 0, 6.2832);
    g.fill();
    var muster = ctx.createPattern(c, 'repeat');
    // Der Vorrat bleibt klein: bei einem Zonenwechsel kommen wenige Toene dazu.
    var anzahl = 0;
    for (var k in musterVorrat) anzahl++;
    if (anzahl > 40) musterVorrat = {};
    musterVorrat[key] = muster;
    return muster;
  }

  function multiplizieren() { ctx.globalCompositeOperation = 'multiply'; }
  function normalModus() { ctx.globalCompositeOperation = 'source-over'; }

  // Zweifarbiger Druck: die zweite Platte liegt um den Registerfehler versetzt.
  function gedruckt(pfad, farbe, zweitfarbe) {
    multiplizieren();
    if (zweitfarbe) {
      ctx.save();
      ctx.translate(G.versatz[0], G.versatz[1]);
      ctx.fillStyle = zweitfarbe;
      pfad();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = farbe;
    pfad();
    ctx.fill();
    normalModus();
  }

  // Vordergrund: erst Papier aussparen, dann Tinte darauf drucken. So bleibt
  // die Figur gleich hell, egal welche Huegel hinter ihr liegen.
  function aufPapier(pfad, farbe, zweitfarbe) {
    normalModus();
    ctx.fillStyle = papier(1);
    pfad();
    ctx.fill();
    gedruckt(pfad, farbe, zweitfarbe);
  }

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

  // ---- Sparmodus

  // Auf schwachen Geraeten fallen zuerst die teuren Zierden weg.
  var sparsam = false;
  var langsameBilder = 0;

  function tempoPruefen(dt) {
    if (dt > 0.030) langsameBilder++;
    else if (langsameBilder > 0) langsameBilder--;
    if (!sparsam && langsameBilder > 40) sparsam = true;
    else if (sparsam && langsameBilder === 0) sparsam = false;
  }

  // ---- Farben dieses Bildes, einmal vorweg berechnet

  var F = {};
  function farbenSetzen() {
    F.papier = rgba(G.paper, 1);
    F.fern = aufPapierFarbe(G.inkB, 0.4);
    F.mittel = aufPapierFarbe(G.inkA, 0.5);
    F.baum = aufPapierFarbe(G.inkA, 0.76);
    F.nah = aufPapierFarbe(G.inkA, 0.8);
    F.erde = aufPapierFarbe(G.inkA, 0.34);
    F.wolke = rgba(aufPapierFarbe(G.inkA, 0.16), 1);
    F.sonne = aufPapierFarbe(G.inkB, 0.8);
  }

  // ---- Hintergrund

  // Silhouette einer Huegelkette an der Stelle x.
  function huegelY(x, scroll, baseY, amp, wl, seed) {
    var wx = (x + scroll) / wl;
    return baseY - amp * (0.5 + 0.5 * Math.sin(wx + seed) * Math.cos(wx * 0.41 + seed * 1.7));
  }

  function huegelPfad(scroll, baseY, amp, wl, seed, schritt) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += schritt) ctx.lineTo(x, huegelY(x, scroll, baseY, amp, wl, seed));
    ctx.lineTo(W, huegelY(W, scroll, baseY, amp, wl, seed));
    ctx.lineTo(W, H);
    ctx.closePath();
  }

  function drawPaper() {
    ctx.fillStyle = F.papier;
    ctx.fillRect(0, 0, W, H);

    // Sonne als grosse Rasterscheibe
    var cx = W * 0.76, cy = GROUND_Y - 215, r = 92;
    ctx.fillStyle = rasterFuellung(F.sonne, G.paper);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = tinte(0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (sparsam) return;

    // Alle Wolken in einem einzigen Zug
    var wolkeScroll = G.worldX * 0.05;
    ctx.fillStyle = F.wolke;
    ctx.beginPath();
    for (var i = 0; i < 7; i++) {
      var wx = (i * 340 - wolkeScroll % 2380 + 2380) % 2380 - 120;
      var wy = 60 + hash(i * 3.7) * 130;
      var ws = 0.7 + hash(i + 21) * 0.7;
      ctx.moveTo(wx + 34 * ws, wy);
      ctx.arc(wx, wy, 34 * ws, 0, 6.2832);
      ctx.moveTo(wx + 64 * ws, wy + 6 * ws);
      ctx.arc(wx + 38 * ws, wy + 6 * ws, 26 * ws, 0, 6.2832);
      ctx.moveTo(wx - 12 * ws, wy + 8 * ws);
      ctx.arc(wx - 34 * ws, wy + 8 * ws, 22 * ws, 0, 6.2832);
    }
    ctx.fill();

    // Voegel ebenfalls in einem Zug
    ctx.strokeStyle = tinte(0.42);
    ctx.lineWidth = 2;
    ctx.beginPath();
    var vScroll = G.worldX * 0.09;
    for (var v = 0; v < 5; v++) {
      var vx = (v * 260 - vScroll % 1300 + 1300) % 1300 - 60;
      var vy = 70 + hash(v + 55) * 90 + Math.sin(G.time * 1.6 + v) * 5;
      var vs = 5 + hash(v + 8) * 4;
      ctx.moveTo(vx - vs, vy);
      ctx.quadraticCurveTo(vx, vy - vs * 0.8, vx + vs, vy);
    }
    ctx.stroke();
  }

  function drawHills() {
    var schritt = sparsam ? 30 : 16;

    huegelPfad(G.worldX * 0.06, GROUND_Y + 10, 150, 260, 1.3, schritt);
    ctx.fillStyle = rasterFuellung(F.fern, G.paper);
    ctx.fill();

    var scroll = G.worldX * 0.16;
    huegelPfad(scroll, GROUND_Y + 26, 96, 175, 4.1, schritt);
    ctx.fillStyle = rgba(F.mittel, 1);
    ctx.fill();

    // Baumreihe: ein Pfad, ein Fuellvorgang
    if (!sparsam) {
      ctx.fillStyle = rgba(F.baum, 1);
      ctx.beginPath();
      for (var i = -1; i < 22; i++) {
        var bx = i * 76 - (scroll % 76);
        var idx = Math.floor((scroll + bx) / 76);
        if (hash(idx * 1.7) < 0.42) continue;
        var by = huegelY(bx, scroll, GROUND_Y + 26, 96, 175, 4.1);
        var hoehe = 26 + hash(idx + 3) * 26;
        ctx.moveTo(bx, by + 4);
        ctx.lineTo(bx + 7, by - hoehe);
        ctx.lineTo(bx + 14, by + 4);
        ctx.closePath();
        ctx.moveTo(bx + 6, by);
        ctx.rect(bx + 6, by, 3, 6);
      }
      ctx.fill();
    }

    huegelPfad(G.worldX * 0.36, GROUND_Y + 46, 62, 130, 8.4, schritt);
    ctx.fillStyle = rgba(F.nah, 1);
    ctx.fill();
  }

  function drawGround() {
    var erdMuster = rasterFuellung(F.erde, G.paper);
    for (var i = 0; i < G.platforms.length; i++) {
      var p = G.platforms[i];
      var x = p.x - G.worldX;
      if (x > W + 40 || x + p.w < -40) continue;

      if (p.solid) {
        // Erdflaeche: ein Pfad, eine Rasterfuellung
        // Ein Pixel Ueberstand an beiden Seiten, sonst blitzt an der Naht
        // zweier Bodenstuecke eine helle Linie durch.
        ctx.beginPath();
        ctx.moveTo(x - 1, H);
        ctx.lineTo(x - 1, p.y);
        for (var sx = 0; sx <= p.w; sx += 16) {
          ctx.lineTo(x + sx, p.y + Math.sin((p.x + sx) * 0.021) * 2.2);
        }
        ctx.lineTo(x + p.w + 1, p.y + Math.sin((p.x + p.w) * 0.021) * 2.2);
        ctx.lineTo(x + p.w + 1, H);
        ctx.closePath();
        ctx.fillStyle = erdMuster;
        ctx.fill();

        // Kraeftige Tintenkante als Strich statt als Flaeche
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (var kx = 0; kx <= p.w; kx += 16) {
          ctx.lineTo(x + kx, p.y + Math.sin((p.x + kx) * 0.021) * 2.2);
        }
        ctx.stroke();

        // Grasbueschel gebuendelt in einem Zug
        if (!sparsam) {
          ctx.strokeStyle = tinte(0.5);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          var schritt = 46;
          var erste = Math.ceil(p.x / schritt) * schritt;
          for (var gx = erste; gx < p.x + p.w; gx += schritt) {
            var hh = hash(gx * 0.013);
            if (hh < 0.45) continue;
            var sxx = gx - G.worldX;
            ctx.moveTo(sxx, p.y + 1);
            ctx.lineTo(sxx + (hh - 0.5) * 8, p.y - 6 - hh * 5);
          }
          ctx.stroke();
        }
      } else {
        // Absatz: Tintenbalken mit versetzter Zweitplatte
        var wackel = p.fuse > 0 ? Math.sin(G.time * 60) * 2.5 : 0;
        var rest = p.fuse > 0 ? p.fuse / CRUMBLE_FUSE : 1;
        ctx.globalAlpha = p.fuse > 0 ? 0.4 + rest * 0.6 : 1;
        var px = x + wackel;
        aufPapier(function () { roundRect(px, p.y, p.w, p.h, 4); },
                  tinte(0.88), p.crumble ? PINK : tinteB(0.7));
        ctx.fillStyle = papier(0.85);
        for (var lx = 7; lx < p.w - 9; lx += 14) ctx.fillRect(px + lx, p.y + 7, 7, 2.5);
        if (p.crumble) {
          ctx.fillStyle = PINK;
          ctx.fillRect(px, p.y + p.h - 3, p.w * rest, 3);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // Die Bestmarke steht dort, wo der bisher weiteste Lauf endete.
  function drawBestmarke() {
    if (records.dist <= 60) return;
    var x = records.dist * PX_PER_M - G.worldX;
    if (x < -40 || x > W + 40) return;

    ctx.strokeStyle = tinte(0.5);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x, GROUND_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    var wimpel = function () {
      ctx.beginPath();
      ctx.moveTo(x, 52);
      ctx.lineTo(x + 66, 70);
      ctx.lineTo(x, 88);
      ctx.closePath();
    };
    aufPapier(wimpel, GELB, tinteB(0.5));
    ctx.strokeStyle = tinte(0.9);
    ctx.lineWidth = 2.5;
    wimpel();
    ctx.stroke();
    ctx.fillStyle = tinte(0.9);
    ctx.font = '700 12px "Azeret Mono", ui-monospace, monospace';
    ctx.fillText('BEST', x + 9, 75);
  }

  function drawCoins() {
    for (var i = 0; i < G.coinList.length; i++) {
      var c = G.coinList[i];
      var x = c.x - G.worldX;
      if (x < -40 || x > W + 40 || c.got) continue;
      var y = c.y + Math.sin(G.time * 3 + c.phase) * 3;
      var breite = c.r * (0.3 + Math.abs(Math.cos(G.time * 3.4 + c.phase)) * 0.7);

      aufPapier(function () { ctx.beginPath(); ctx.ellipse(x, y, breite, c.r, 0, 0, 6.2832); },
                GELB, tinteB(0.3));
      ctx.strokeStyle = tinte(0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, breite, c.r, 0, 0, 6.2832);
      ctx.stroke();
      if (breite > 5) {
        ctx.fillStyle = tinte(0.8);
        ctx.fillRect(x - 1.5, y - 4, 3, 8);
      }
    }
  }

  function drawPickups() {
    for (var i = 0; i < G.pickups.length; i++) {
      var p = G.pickups[i];
      var x = p.x - G.worldX;
      if (x < -60 || x > W + 60 || p.got) continue;
      var y = p.y + Math.sin(G.time * 2.4 + p.phase) * 8;
      var def = POWERS[p.kind];
      var kipp = Math.sin(G.time * 1.3 + p.phase) * 0.24;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(kipp);
      aufPapier(function () { roundRect(-p.r, -p.r, p.r * 2, p.r * 2, 5); }, def.ink, tinte(0.3));
      ctx.strokeStyle = tinte(0.9);
      ctx.lineWidth = 2.5;
      roundRect(-p.r, -p.r, p.r * 2, p.r * 2, 5);
      ctx.stroke();
      ctx.fillStyle = papier(1);
      ctx.font = '700 17px "Azeret Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'shield' ? 'S' : (p.kind === 'magnet' ? 'M' : (p.kind === 'x2' ? '2' : 'Z')), 0, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();

      // Strichkranz wie ein Stempel
      ctx.strokeStyle = tinte(0.4);
      ctx.lineWidth = 2;
      for (var k = 0; k < 8; k++) {
        var a = k / 8 * 6.2832 + G.time * 0.8;
        var rr = p.r + 9;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        ctx.lineTo(x + Math.cos(a) * (rr + 5), y + Math.sin(a) * (rr + 5));
        ctx.stroke();
      }
    }
  }

  function drawObstacles() {
    for (var i = 0; i < G.obstacles.length; i++) {
      var o = G.obstacles[i];
      if (o.dead) continue;
      var b = obstacleBox(o);
      var x = o.x - G.worldX;
      if (x < -140 || x > W + 140) continue;

      if (o.type === 'spike') {
        var stachel = function () {
          ctx.beginPath();
          ctx.moveTo(x - 3, GROUND_Y + 2);
          ctx.lineTo(x + o.w / 2, GROUND_Y - o.h - 4);
          ctx.lineTo(x + o.w + 3, GROUND_Y + 2);
          ctx.closePath();
        };
        aufPapier(stachel, PINK, tinteB(0.4));
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2.5;
        stachel();
        ctx.stroke();
        ctx.fillStyle = papier(0.9);
        ctx.beginPath();
        ctx.moveTo(x + o.w / 2, GROUND_Y - o.h + 4);
        ctx.lineTo(x + o.w * 0.66, GROUND_Y - o.h * 0.35);
        ctx.lineTo(x + o.w * 0.38, GROUND_Y - o.h * 0.35);
        ctx.closePath();
        ctx.fill();

      } else if (o.type === 'crate') {
        aufPapier(function () { roundRect(x, o.y, o.w, o.h, 3); }, PINK, tinteB(0.5));
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2.5;
        roundRect(x, o.y, o.w, o.h, 3);
        ctx.stroke();
        ctx.strokeStyle = tinte(0.75);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 6, o.y + 6);
        ctx.lineTo(x + o.w - 6, o.y + o.h - 6);
        ctx.moveTo(x + o.w - 6, o.y + 6);
        ctx.lineTo(x + 6, o.y + o.h - 6);
        ctx.stroke();

      } else if (o.type === 'block') {
        aufPapier(function () { roundRect(x, o.y, o.w, o.h, 2); }, PINK, tinteB(0.5));
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2.5;
        roundRect(x, o.y, o.w, o.h, 2);
        ctx.stroke();
        // Schraffur wie ein gedruckter Balken
        ctx.strokeStyle = tinte(0.55);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var sh = 8; sh < o.h; sh += 14) {
          ctx.moveTo(x + 4, o.y + sh);
          ctx.lineTo(x + o.w - 4, o.y + sh - 8);
        }
        ctx.stroke();

      } else if (o.type === 'saw') {
        var cy = o.cy;
        ctx.save();
        ctx.translate(x, cy);
        ctx.rotate(G.time * 7);
        var zaehne = function () {
          ctx.beginPath();
          for (var t = 0; t < 12; t++) {
            var a = (t / 12) * 6.2832;
            ctx.lineTo(Math.cos(a) * o.r * 0.62, Math.sin(a) * o.r * 0.62);
            ctx.lineTo(Math.cos(a + 0.19) * o.r, Math.sin(a + 0.19) * o.r);
            ctx.lineTo(Math.cos(a + 0.38) * o.r * 0.62, Math.sin(a + 0.38) * o.r * 0.62);
          }
          ctx.closePath();
        };
        aufPapier(zaehne, PINK, tinteB(0.45));
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2;
        zaehne();
        ctx.stroke();
        ctx.fillStyle = papier(1);
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.3, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

      } else if (o.type === 'spring') {
        var stauch = Math.max(0, 1 - (G.time - o.used) * 4);
        var py2 = o.y + stauch * 12;
        aufPapier(function () { roundRect(x, py2, o.w, o.h - stauch * 12, 4); }, GRUEN, tinteB(0.4));
        ctx.strokeStyle = tinte(0.85);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (var z = 0; z < 4; z++) {
          ctx.moveTo(x + 6 + z * 12, GROUND_Y);
          ctx.lineTo(x + 13 + z * 12, py2 + 4);
        }
        ctx.stroke();
        ctx.strokeRect(x, py2, o.w, Math.max(4, o.h - stauch * 12));

      } else if (o.type === 'drone') {
        var dy = b.y;
        aufPapier(function () { roundRect(x, dy, o.w, o.h, 10); }, PINK, tinteB(0.5));
        ctx.strokeStyle = tinte(0.9);
        ctx.lineWidth = 2.5;
        roundRect(x, dy, o.w, o.h, 10);
        ctx.stroke();
        ctx.fillStyle = papier(1);
        ctx.beginPath();
        ctx.arc(x + o.w * 0.5, dy + o.h * 0.5, 6.5, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = tinte(0.9);
        ctx.beginPath();
        ctx.arc(x + o.w * 0.5, dy + o.h * 0.5, 3.4 + Math.sin(G.time * 6 + o.phase), 0, 6.2832);
        ctx.fill();
        // Suchstrahl als Punktreihe
        ctx.fillStyle = tinte(0.28);
        for (var s2 = 0; s2 < 7; s2++) {
          var t2 = s2 / 6;
          var yy = dy + o.h + t2 * (GROUND_Y - dy - o.h);
          ctx.beginPath();
          ctx.arc(x + o.w * 0.5, yy, 1.5 + t2 * 3, 0, 6.2832);
          ctx.fill();
        }
      }
    }
  }

  function drawParticles() {
    multiplizieren();
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      var t = 1 - p.life / p.max;
      var x = p.x - G.worldX;
      if (x < -40 || x > W + 40) continue;
      ctx.globalAlpha = Math.min(1, t * 1.2);
      ctx.fillStyle = inkFromHue(p.hue);
      var s = p.size * (0.5 + t * 0.5);
      if (p.square) ctx.fillRect(x - s, p.y - s, s * 2, s * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, p.y, s, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    normalModus();
  }

  function drawPlayer() {
    var x = G.screenX, y = G.py, h = G.h;
    var hyper = G.hyperT > 0;
    // Im Hyper-Modus laeuft die Druckplatte durch alle Tinten.
    var koerper = hyper ? inkFromHue(G.time * 700) : figurTinte();

    // Nachziehende Spur als Geisterdrucke
    multiplizieren();
    var abVon = sparsam ? Math.max(0, G.trail.length - 4) : 0;
    for (var i = abVon; i < G.trail.length; i++) {
      var tr = G.trail[i];
      var a = (i / G.trail.length) * (hyper ? 0.4 : (G.dashT > 0 ? 0.35 : 0.12));
      ctx.globalAlpha = a;
      ctx.fillStyle = hyper ? inkFromHue(G.time * 700 + i * 40) : tinteB(1);
      roundRect(tr.x - G.worldX, tr.y, PW, tr.h, 8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    normalModus();

    // Beine
    if (!G.sliding && G.onGround) {
      ctx.strokeStyle = tinte(0.9);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (var l = 0; l < 2; l++) {
        var ph = G.run + l * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 11 + l * 14, y + h - 4);
        ctx.lineTo(x + 11 + l * 14 + Math.cos(ph) * 10, y + h + 7 + Math.abs(Math.sin(ph)) * 2);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    ctx.save();
    if (G.inv > 0 && !hyper && Math.floor(G.time * 22) % 2 === 0) ctx.globalAlpha = 0.4;

    // Stauchen und Strecken: die Fuesse bleiben stehen, der Koerper gibt nach.
    var sq = clamp(G.squash, -0.45, 0.6);
    var bw = PW * (1 + sq * 0.45);
    var bh = h * (1 - sq * 0.45);
    var bx = x - (bw - PW) / 2;
    var by = y + h - bh;

    aufPapier(function () { roundRect(bx, by, bw, bh, 8); }, koerper, tinteB(0.45));
    ctx.strokeStyle = tinte(0.92);
    ctx.lineWidth = 2.5;
    roundRect(bx, by, bw, bh, 8);
    ctx.stroke();

    // Augen als ausgesparte Papierflaechen, sie wandern mit dem Koerper
    var ey = by + bh * (G.sliding ? 0.28 : 0.3);
    var ax = bx + bw * 0.28, bx2 = bx + bw * 0.61;
    ctx.fillStyle = papier(1);
    ctx.fillRect(ax, ey, 8, 10);
    ctx.fillRect(bx2, ey, 8, 10);
    ctx.fillStyle = tinte(0.92);
    var blick = clamp(G.vy / 900, -1, 1) * 2;
    ctx.fillRect(ax + 2, ey + 3 + blick, 4, 5);
    ctx.fillRect(bx2 + 2, ey + 3 + blick, 4, 5);
    ctx.restore();

    // Schild als Stempelkranz
    if (G.shield > 0) {
      ctx.strokeStyle = POWERS.shield.ink;
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(x + PW / 2, y + h / 2, 38 + Math.sin(G.time * 5) * 2, 0, 6.2832);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Magnetfeld als konzentrische Rasterringe
    if (G.powers.magnet > 0) {
      ctx.strokeStyle = rgba(hex2rgb(POWERS.magnet.ink), 0.4);
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 9]);
      for (var m = 0; m < 3; m++) {
        ctx.beginPath();
        ctx.arc(x + PW / 2, y + h / 2, 58 + m * 38 + Math.sin(G.time * 3 + m) * 6, 0, 6.2832);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    for (var i = 0; i < G.texts.length; i++) {
      var f = G.texts[i];
      var t = 1 - f.life / f.max;
      var x = f.x - G.worldX;
      if (x < -160 || x > W + 160) continue;
      x = clamp(x, 96, W - 96);
      ctx.font = f.size + 'px Anton, "Arial Black", system-ui, sans-serif';
      ctx.globalAlpha = Math.min(1, t * 1.6);
      // Zweitplatte versetzt: typischer Fehldruck
      ctx.fillStyle = inkFromHue(f.hue);
      ctx.fillText(f.text, x + 2.5, f.y + 2);
      ctx.fillStyle = tinte(0.9);
      ctx.fillText(f.text, x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function drawPrintFx() {
    // Tempo als Tintenstriche, gebuendelt in einem Pfad
    var sf = clamp((G.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1)
           + (G.dashT > 0 ? 0.6 : 0) + (G.hyperT > 0 ? 0.7 : 0);
    if (sf > 0.2 && !sparsam) {
      ctx.fillStyle = tinte(0.1 + 0.1 * Math.min(1, sf));
      ctx.beginPath();
      for (var i = 0; i < 12; i++) {
        var seed = Math.floor(G.time * 20) + i * 13;
        var y = hash(seed) * H;
        var len = 40 + hash(seed + 1) * 160 * sf;
        var x = hash(seed + 2) * (W + 300) - (G.time * 800 % (W + 300));
        ctx.rect(x, y, len, 2);
      }
      ctx.fill();
    }

    // Waschungen: selten genug, um den Mischmodus zu rechtfertigen
    var wasch = null, staerke = 0;
    if (G.flash > 0) { wasch = inkFromHue(G.flashHue); staerke = Math.min(0.45, G.flash * 0.5); }
    else if (G.hyperT > 0) { wasch = inkFromHue(G.time * 700); staerke = 0.12; }
    else if (G.powers.slow > 0 || G.slowT > 0) { wasch = POWERS.slow.ink; staerke = 0.1; }
    if (wasch) {
      multiplizieren();
      ctx.fillStyle = rgba(hex2rgb(wasch), staerke);
      ctx.fillRect(0, 0, W, H);
      normalModus();
    }
    // Papierkorn und Plattenkante liegen als CSS-Ebene ueber der Flaeche -
    // das erledigt der Compositor und kostet kein Bild pro Sekunde.
  }

  function render() {
    farbenSetzen();
    ctx.save();
    if (G.shake > 0.2) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    drawPaper();
    drawHills();
    drawGround();
    drawBestmarke();
    drawParticles();
    drawCoins();
    drawPickups();
    drawObstacles();
    drawPlayer();
    drawTexts();
    ctx.restore();
    drawPrintFx();
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

    // Wie weit bin ich im Vergleich zum bisher besten Lauf?
    if (el.bestWrap) {
      if (records.dist > 60) {
        el.bestWrap.hidden = false;
        var anteil = Math.min(100, G.dist / records.dist * 100);
        el.bestFill.style.width = anteil.toFixed(1) + '%';
        el.bestWrap.classList.toggle('voll', G.dist >= records.dist);
      } else {
        el.bestWrap.hidden = true;
      }
    }

    if (el.zonen) el.zonen.classList.toggle('an', state === 'play' && G.dist < 55);

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
          html += '<span class="pill" style="--ink:#22201e">DASH ' + parts[i][1] + '</span>';
        } else {
          var def = POWERS[kind];
          html += '<span class="pill" style="--ink:' + def.ink + '">' + def.label +
                  (parts[i][1] ? ' ' + parts[i][1] : '') + '</span>';
        }
      }
      el.powers.innerHTML = html;
    }
  }

  // ----------------------------------------------------------- Zustandswechsel

  function auftraegeHtml() {
    var html = '<h2 class="auftraege__titel">Auftr&auml;ge &middot; Rang ' + rangName() + '</h2>';
    for (var i = 0; i < auftraege.length; i++) {
      var a = auftraege[i];
      var art = auftragArt(a.id);
      var stand = Math.min(a.ziel, Math.floor(auftragStand(a)));
      var anteil = Math.max(0, Math.min(100, Math.round(stand / a.ziel * 100)));
      html += '<div class="auftrag' + (a.fertig ? ' fertig' : '') + '">'
            + '<span>' + art.text.replace('{z}', a.ziel) + '</span>'
            + '<b>' + (a.fertig ? 'erf&uuml;llt' : stand + ' / ' + a.ziel) + '</b>'
            + '<i style="width:' + anteil + '%"></i></div>';
    }
    return html;
  }

  function showOverlay(title, text, btn, statsHtml, extraHtml) {
    el.ovTitle.innerHTML = title;
    el.ovText.textContent = text;
    el.ovBtn.textContent = btn;
    if (statsHtml) {
      el.ovStats.innerHTML = statsHtml;
      el.ovStats.hidden = false;
    } else {
      el.ovStats.hidden = true;
    }
    if (el.ovExtra) {
      el.ovExtra.innerHTML = extraHtml || '';
      el.ovExtra.hidden = !extraHtml;
    }
    el.overlay.hidden = false;
  }

  function hideOverlay() { el.overlay.hidden = true; }

  function showReady() {
    state = 'ready';
    showOverlay('DRUCK<span>LAUF</span>', 'Leertaste oder Tippen zum Starten',
                'Andruck starten', null, auftraegeHtml());
  }

  function showPause() {
    showOverlay('PAUSE', 'Weiter mit P, Enter oder Leertaste', 'Weiterdrucken', null);
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
      isBest ? 'BESTER<span> ANDRUCK</span>' : 'MAKULATUR!',
      reason + ' Nochmal?',
      'Neuer Andruck',
      stat('Punkte', score.toLocaleString('de-DE'), isBest) +
      stat('Strecke', dist + ' m') +
      stat('Münzen', G.coins) +
      stat('Beste Kombo', G.bestCombo) +
      stat('Knapp vorbei', G.nearMisses) +
      stat('Hyper', G.hyperUses + 'x') +
      stat('Bestwert', records.best.toLocaleString('de-DE')) +
      stat('Münzen gesamt', records.coins),
      auftraegeHtml()
    );
  }

  function startGame() {
    auftraegeNachziehen();
    releaseAll();
    newGame();
    lastPowerKey = '';
    el.zone.textContent = ZONES[0].name + ' · ' + ZONES[0].a + '/' + ZONES[0].b;
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

  // Beruehrung: zwei Zonen statt vieler Knoepfe.
  //
  // Die beiden Bewegungen, die im Takt sitzen muessen - springen und rutschen -
  // bekommen je eine Bildschirmhaelfte. Das sind die groessten denkbaren
  // Trefferflaechen, sie loesen beim Aufsetzen des Fingers aus (keine
  // Verzoegerung durch Gestenerkennung) und lassen sich mit beiden Daumen
  // gleichzeitig halten. Die selteneren Befehle bleiben kleine Knoepfe.
  var zeiger = {};

  function zonenAnteil(e) {
    var rechteck = canvas.getBoundingClientRect();
    if (!rechteck.width) return 1;
    return (e.clientX - rechteck.left) / rechteck.width;
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    // Mit der Maus bleibt die ganze Flaeche der Sprungknopf.
    var links = e.pointerType === 'touch' && zonenAnteil(e) < 0.45;
    var zone = links ? 'slide' : 'jump';
    zeiger[e.pointerId] = { zone: zone, x: e.clientX, y: e.clientY, gewischt: false };
    if (zone === 'jump') primaryAction();
    else { Sound.resume(); press('slide'); }
  });

  canvas.addEventListener('pointermove', function (e) {
    var z = zeiger[e.pointerId];
    if (!z || z.gewischt || state !== 'play') return;
    var dx = e.clientX - z.x;
    var dy = e.clientY - z.y;
    if (dx > 64 && dx > Math.abs(dy)) {
      z.gewischt = true;
      press('dash');
      release('dash');
    } else if (-dy > 78 && -dy > Math.abs(dx)) {
      z.gewischt = true;
      press('hyper');
      release('hyper');
    } else if (z.zone === 'jump' && dy > 54 && dy > Math.abs(dx)) {
      // Nach unten gewischt: vom Sprung aufs Rutschen wechseln.
      z.gewischt = true;
      release('jump');
      z.zone = 'slide';
      press('slide');
    }
  });

  function zeigerEnde(e) {
    var z = zeiger[e.pointerId];
    if (!z) return;
    release(z.zone);
    delete zeiger[e.pointerId];
  }

  // Am Fenster, nicht an der Flaeche: sonst bleibt eine Taste haengen, wenn
  // der Finger ueber den Rand hinausrutscht.
  window.addEventListener('pointerup', zeigerEnde);
  window.addEventListener('pointercancel', zeigerEnde);

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

  // ------------------------------------------------------------------ Vollbild
  //
  // Auf dem Telefon ist Querformat im Vollbild der einzige Weg zu einem
  // Bild, auf dem man wirklich etwas sieht. Wo der Browser das nicht erlaubt
  // (etwa in einem eingebetteten Rahmen oder auf iPhones), verschwindet der
  // Knopf, und es bleibt beim Hinweis aufs Drehen.
  var vollbildMoeglich = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  function imVollbild() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function vollbildUmschalten() {
    var ziel = el.sheet || document.documentElement;
    if (imVollbild()) {
      var raus = document.exitFullscreen || document.webkitExitFullscreen;
      if (raus) { try { raus.call(document); } catch (e) { /* egal */ } }
      return;
    }
    var rein = ziel.requestFullscreen || ziel.webkitRequestFullscreen;
    if (!rein) { el.fsBtn.hidden = true; return; }
    var versprechen;
    try { versprechen = rein.call(ziel, { navigationUI: 'hide' }); } catch (e) { versprechen = null; }
    var danach = function () {
      // Querformat festhalten, wo der Browser es zulaesst.
      if (screen.orientation && screen.orientation.lock) {
        try {
          var l = screen.orientation.lock('landscape');
          if (l && l.catch) l.catch(function () { /* nicht erlaubt, kein Problem */ });
        } catch (e) { /* egal */ }
      }
    };
    if (versprechen && versprechen.then) versprechen.then(danach, function () { el.fsBtn.hidden = true; });
    else danach();
  }

  function vollbildKnopfPflegen() {
    if (!el.fsBtn) return;
    el.fsBtn.hidden = !vollbildMoeglich;
    el.fsBtn.textContent = imVollbild() ? 'Vollbild verlassen' : 'Vollbild & quer';
    if (el.drehen) el.drehen.hidden = imVollbild();
  }

  if (el.fsBtn) {
    el.fsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      vollbildUmschalten();
    });
    el.fsBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    document.addEventListener('fullscreenchange', function () { vollbildKnopfPflegen(); resize(); });
    document.addEventListener('webkitfullscreenchange', function () { vollbildKnopfPflegen(); resize(); });
  }

  el.ovBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    Sound.resume();
    if (state === 'pause') togglePause();
    else startGame();
  });

  // Ein Tippen irgendwo auf das Overlay startet ebenfalls.
  el.overlay.addEventListener('pointerdown', function (e) {
    if (e.target === el.ovBtn || e.target === el.fsBtn) return;
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
    // Auf Telefonen kostet jede zusaetzliche Bildpunktebene spuerbar Tempo,
    // und die Flaeche rechnet ohnehin schon mit 960 Punkten Breite.
    var grob = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, grob ? 1.25 : 2);
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
    tempoPruefen(dt);

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

  // Papierkorn einmal erzeugen und als CSS-Ebene ueber die Flaeche legen.
  (function kornEbene() {
    var ziel = document.getElementById('korn');
    if (!ziel) return;
    var c = document.createElement('canvas');
    c.width = c.height = 96;
    var g = c.getContext('2d');
    var bild = g.createImageData(96, 96);
    for (var i = 0; i < bild.data.length; i += 4) {
      var v = 255 - Math.floor(Math.random() * 40);
      bild.data[i] = bild.data[i + 1] = bild.data[i + 2] = v;
      bild.data[i + 3] = 255;
    }
    g.putImageData(bild, 0, 0);
    try { ziel.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')'; } catch (e) { /* egal */ }
  }());

  auftraegeLaden();
  resize();
  vollbildKnopfPflegen();
  newGame();
  el.zone.textContent = ZONES[0].name + ' · ' + ZONES[0].a + '/' + ZONES[0].b;
  el.best.textContent = records.best.toLocaleString('de-DE');
  el.soundState.textContent = Sound.isOn() ? 'an' : 'aus';
  showReady();
  requestAnimationFrame(frame);
}());
