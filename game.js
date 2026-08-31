/*
 * Tetris - reine Browser-Umsetzung ohne Abhaengigkeiten.
 *
 * Umgesetzt sind die ueblichen Regeln moderner Tetris-Spiele:
 *   - 7-Bag-Zufallsgenerator (jeder Stein einmal pro Runde)
 *   - SRS-Drehung inklusive Wallkicks
 *   - Hold-Slot (einmal pro Stein), Vorschau auf 5 Steine, Geisterstein
 *   - Lock-Delay mit begrenzter Zahl an Zuruecksetzungen
 *   - T-Spin-, Back-to-Back-, Combo- und Perfect-Clear-Wertung
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Konstanten

  var COLS = 10;
  var VISIBLE_ROWS = 20;
  var HIDDEN_ROWS = 2;            // Puffer oberhalb des Spielfelds
  var ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

  var CELL = 30;                  // Zellengroesse in CSS-Pixeln
  var MINI = 22;                  // Zellengroesse in den Vorschau-Boxen
  var SS = 2;                     // interne Ueberabtastung fuer scharfe Kanten

  var LOCK_DELAY = 500;           // ms, bis ein aufliegender Stein festfriert
  var MAX_LOCK_RESETS = 15;
  var DAS = 150;                  // ms bis zur automatischen Wiederholung
  var ARR = 35;                   // ms zwischen zwei Wiederholungen
  var SOFT_DROP_INTERVAL = 30;    // ms pro Reihe beim sanften Fallen
  var CLEAR_ANIM = 180;           // ms Blinken der vollen Reihen
  var NEXT_COUNT = 5;

  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  var COLORS = {
    I: '#22d3ee',
    O: '#facc15',
    T: '#c084fc',
    S: '#4ade80',
    Z: '#f87171',
    J: '#60a5fa',
    L: '#fb923c'
  };

  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  // Wallkick-Tabellen der Super Rotation System.
  // Die Werte stehen bereits in Bildschirmkoordinaten (y positiv = nach unten).
  var KICKS = {
    JLSTZ: {
      '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
    },
    I: {
      '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
      '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
    },
    O: {
      '0>1': [[0, 0]], '1>0': [[0, 0]], '1>2': [[0, 0]], '2>1': [[0, 0]],
      '2>3': [[0, 0]], '3>2': [[0, 0]], '3>0': [[0, 0]], '0>3': [[0, 0]]
    }
  };

  // ------------------------------------------------------------------- Hilfen

  function rotateCW(m) {
    var n = m.length;
    var out = [];
    for (var y = 0; y < n; y++) {
      out.push([]);
      for (var x = 0; x < n; x++) out[y].push(m[n - 1 - x][y]);
    }
    return out;
  }

  function rotateCCW(m) {
    var n = m.length;
    var out = [];
    for (var y = 0; y < n; y++) {
      out.push([]);
      for (var x = 0; x < n; x++) out[y].push(m[x][n - 1 - y]);
    }
    return out;
  }

  function emptyBoard() {
    var b = [];
    for (var y = 0; y < ROWS; y++) {
      var row = [];
      for (var x = 0; x < COLS; x++) row.push(null);
      b.push(row);
    }
    return b;
  }

  // Zeitabstand der Schwerkraft pro Level (Guideline-Formel).
  function gravityMs(level) {
    var l = Math.min(level, 20);
    return Math.max(16, Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000);
  }

  function shade(hex, amount) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    if (amount > 0) {
      r += (255 - r) * amount;
      g += (255 - g) * amount;
      b += (255 - b) * amount;
    } else {
      r *= (1 + amount);
      g *= (1 + amount);
      b *= (1 + amount);
    }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function formatTime(ms) {
    var total = Math.floor(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // -------------------------------------------------------------------- Sound

  var Sound = (function () {
    var ctx = null;
    var enabled = true;

    function ac() {
      if (!ctx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, duration, type, volume, delay) {
      if (!enabled) return;
      var a = ac();
      if (!a) return;
      var t0 = a.currentTime + (delay || 0);
      var osc = a.createOscillator();
      var gain = a.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(volume || 0.06, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(a.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    return {
      unlock: function () { ac(); },
      toggle: function () { enabled = !enabled; return enabled; },
      isOn: function () { return enabled; },
      move: function () { tone(220, 0.04, 'square', 0.025); },
      rotate: function () { tone(330, 0.05, 'square', 0.03); },
      lock: function () { tone(150, 0.07, 'triangle', 0.05); },
      hold: function () { tone(440, 0.07, 'sine', 0.04); },
      drop: function () { tone(110, 0.09, 'sawtooth', 0.04); },
      clear: function (lines) {
        var base = [0, 523, 587, 659, 784][lines] || 523;
        for (var i = 0; i < lines; i++) tone(base * (1 + i * 0.22), 0.12, 'triangle', 0.06, i * 0.05);
      },
      levelUp: function () {
        [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.1, 'sine', 0.05, i * 0.07); });
      },
      gameOver: function () {
        [440, 392, 330, 262].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.06, i * 0.16); });
      }
    };
  })();

  // ------------------------------------------------------------------ Zeichnen

  var boardCanvas = document.getElementById('board');
  var holdCanvas = document.getElementById('hold');
  var nextCanvas = document.getElementById('next');
  var bctx = boardCanvas.getContext('2d');
  var hctx = holdCanvas.getContext('2d');
  var nctx = nextCanvas.getContext('2d');

  [bctx, hctx, nctx].forEach(function (c) { c.setTransform(SS, 0, 0, SS, 0, 0); });

  var BOARD_W = COLS * CELL;
  var BOARD_H = VISIBLE_ROWS * CELL;

  function drawCell(ctx, px, py, size, color, opts) {
    opts = opts || {};
    var pad = opts.pad === undefined ? 1 : opts.pad;
    var x = px + pad;
    var y = py + pad;
    var s = size - pad * 2;

    if (opts.ghost) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, s, s);
      ctx.globalAlpha = 1;
      return;
    }

    var grad = ctx.createLinearGradient(x, y, x, y + s);
    grad.addColorStop(0, shade(color, 0.22));
    grad.addColorStop(1, shade(color, -0.28));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, s, s);

    // Kanten-Highlights fuer die klassische 3D-Anmutung
    ctx.fillStyle = shade(color, 0.45);
    ctx.fillRect(x, y, s, Math.max(1, s * 0.11));
    ctx.fillRect(x, y, Math.max(1, s * 0.11), s);
    ctx.fillStyle = shade(color, -0.45);
    ctx.fillRect(x, y + s - Math.max(1, s * 0.11), s, Math.max(1, s * 0.11));
    ctx.fillRect(x + s - Math.max(1, s * 0.11), y, Math.max(1, s * 0.11), s);

    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }

  function drawGrid() {
    bctx.fillStyle = '#05070d';
    bctx.fillRect(0, 0, BOARD_W, BOARD_H);

    bctx.strokeStyle = 'rgba(255,255,255,.045)';
    bctx.lineWidth = 1;
    for (var x = 1; x < COLS; x++) {
      bctx.beginPath();
      bctx.moveTo(x * CELL + 0.5, 0);
      bctx.lineTo(x * CELL + 0.5, BOARD_H);
      bctx.stroke();
    }
    for (var y = 1; y < VISIBLE_ROWS; y++) {
      bctx.beginPath();
      bctx.moveTo(0, y * CELL + 0.5);
      bctx.lineTo(BOARD_W, y * CELL + 0.5);
      bctx.stroke();
    }
  }

  // Zeichnet einen Stein mittig in eine Vorschau-Box.
  function drawPreviewPiece(ctx, type, boxX, boxY, boxW, boxH) {
    var m = SHAPES[type];
    var minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (var y = 0; y < m.length; y++) {
      for (var x = 0; x < m.length; x++) {
        if (!m[y][x]) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    var w = (maxX - minX + 1) * MINI;
    var h = (maxY - minY + 1) * MINI;
    var ox = boxX + (boxW - w) / 2 - minX * MINI;
    var oy = boxY + (boxH - h) / 2 - minY * MINI;

    for (var yy = 0; yy < m.length; yy++) {
      for (var xx = 0; xx < m.length; xx++) {
        if (m[yy][xx]) drawCell(ctx, ox + xx * MINI, oy + yy * MINI, MINI, COLORS[type]);
      }
    }
  }

  // --------------------------------------------------------------- Spielobjekt

  var ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    level: document.getElementById('level'),
    lines: document.getElementById('lines'),
    time: document.getElementById('time'),
    overlay: document.getElementById('overlay'),
    ovTitle: document.getElementById('ov-title'),
    ovText: document.getElementById('ov-text'),
    ovBtn: document.getElementById('ov-btn'),
    toast: document.getElementById('toast'),
    soundState: document.getElementById('sound-state')
  };

  var BEST_KEY = 'tetris.bestScore';

  var game = {
    board: emptyBoard(),
    piece: null,
    bag: [],
    queue: [],
    hold: null,
    holdUsed: false,
    score: 0,
    best: 0,
    lines: 0,
    level: 1,
    combo: -1,
    backToBack: false,
    state: 'menu',            // menu | playing | paused | clearing | over
    gravityTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    grounded: false,
    lastMoveWasRotation: false,
    lastKickIndex: 0,
    clearRows: [],
    clearTimer: 0,
    pendingScore: null,
    elapsed: 0
  };

  try {
    game.best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    game.best = 0;
  }

  // ------------------------------------------------------------ Steine ziehen

  function refillBag() {
    var bag = TYPES.slice();
    for (var i = bag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    game.bag = game.bag.concat(bag);
  }

  function nextType() {
    if (game.bag.length === 0) refillBag();
    return game.bag.shift();
  }

  function fillQueue() {
    while (game.queue.length < NEXT_COUNT) game.queue.push(nextType());
  }

  function makePiece(type) {
    var m = SHAPES[type];
    var topOffset = 0;
    for (var y = 0; y < m.length; y++) {
      var filled = m[y].some(function (v) { return v; });
      if (filled) { topOffset = y; break; }
    }
    return {
      type: type,
      matrix: m,
      rotation: 0,
      x: type === 'O' ? 4 : 3,
      y: HIDDEN_ROWS - topOffset
    };
  }

  // ------------------------------------------------------------- Kollisionen

  function collides(piece, offsetX, offsetY, matrix) {
    var m = matrix || piece.matrix;
    var px = piece.x + (offsetX || 0);
    var py = piece.y + (offsetY || 0);

    for (var y = 0; y < m.length; y++) {
      for (var x = 0; x < m.length; x++) {
        if (!m[y][x]) continue;
        var bx = px + x;
        var by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by < 0) continue;                       // oberhalb des Feldes ist frei
        if (game.board[by][bx]) return true;
      }
    }
    return false;
  }

  function isOccupied(x, y) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return !!game.board[y][x];
  }

  // ---------------------------------------------------------------- Bewegungen

  function move(dx) {
    if (!game.piece || collides(game.piece, dx, 0)) return false;
    game.piece.x += dx;
    game.lastMoveWasRotation = false;
    resetLockTimer();
    Sound.move();
    return true;
  }

  function rotate(dir) {
    var p = game.piece;
    if (!p) return false;

    var candidate = dir > 0 ? rotateCW(p.matrix) : rotateCCW(p.matrix);
    var from = p.rotation;
    var to = (from + (dir > 0 ? 1 : 3)) % 4;
    var table = p.type === 'I' ? KICKS.I : (p.type === 'O' ? KICKS.O : KICKS.JLSTZ);
    var kicks = table[from + '>' + to];

    for (var i = 0; i < kicks.length; i++) {
      var kx = kicks[i][0];
      var ky = kicks[i][1];
      if (!collides(p, kx, ky, candidate)) {
        p.matrix = candidate;
        p.rotation = to;
        p.x += kx;
        p.y += ky;
        game.lastMoveWasRotation = true;
        game.lastKickIndex = i;
        resetLockTimer();
        Sound.rotate();
        return true;
      }
    }
    return false;
  }

  function softDrop() {
    if (!game.piece || collides(game.piece, 0, 1)) return false;
    game.piece.y++;
    game.score += 1;
    game.lastMoveWasRotation = false;
    game.gravityTimer = 0;
    resetLockTimer();
    return true;
  }

  function hardDrop() {
    if (!game.piece) return;
    var cells = 0;
    while (!collides(game.piece, 0, 1)) {
      game.piece.y++;
      cells++;
    }
    game.score += cells * 2;
    game.lastMoveWasRotation = game.lastMoveWasRotation && cells === 0;
    Sound.drop();
    lockPiece();
  }

  function holdPiece() {
    if (!game.piece || game.holdUsed) return;
    var current = game.piece.type;
    if (game.hold) {
      game.piece = makePiece(game.hold);
      game.hold = current;
    } else {
      game.hold = current;
      game.piece = null;
      spawn();
    }
    game.holdUsed = true;
    game.lastMoveWasRotation = false;
    resetLockState();
    Sound.hold();
    renderPanels();
  }

  function resetLockTimer() {
    if (!game.grounded) return;
    if (game.lockResets < MAX_LOCK_RESETS) {
      game.lockTimer = 0;
      game.lockResets++;
    }
  }

  function resetLockState() {
    game.grounded = false;
    game.lockTimer = 0;
    game.lockResets = 0;
  }

  // ------------------------------------------------------------------- Ablauf

  function spawn() {
    fillQueue();
    var type = game.queue.shift();
    fillQueue();
    game.piece = makePiece(type);
    game.holdUsed = false;
    game.lastMoveWasRotation = false;
    resetLockState();
    game.gravityTimer = 0;

    if (collides(game.piece, 0, 0)) {
      gameOver();
      return;
    }
    renderPanels();
  }

  // T-Spin-Erkennung ueber die vier Ecken um das Zentrum des T-Steins.
  function detectTSpin() {
    var p = game.piece;
    if (!p || p.type !== 'T' || !game.lastMoveWasRotation) return null;

    var cx = p.x + 1;
    var cy = p.y + 1;
    var corners = [
      [cx - 1, cy - 1],   // 0: oben links
      [cx + 1, cy - 1],   // 1: oben rechts
      [cx + 1, cy + 1],   // 2: unten rechts
      [cx - 1, cy + 1]    // 3: unten links
    ];
    var occupied = corners.map(function (c) { return isOccupied(c[0], c[1]); });
    var total = occupied.filter(Boolean).length;
    if (total < 3) return null;

    // Die beiden "vorderen" Ecken liegen auf der Seite, in die das T zeigt.
    var frontPairs = [[0, 1], [1, 2], [2, 3], [3, 0]];
    var front = frontPairs[p.rotation];
    var frontCount = (occupied[front[0]] ? 1 : 0) + (occupied[front[1]] ? 1 : 0);

    if (frontCount === 2) return 'tspin';
    if (game.lastKickIndex === 4) return 'tspin';   // ueber den letzten Kick gedreht
    return 'mini';
  }

  function lockPiece() {
    var p = game.piece;
    var spin = detectTSpin();
    var lockedAboveField = true;

    for (var y = 0; y < p.matrix.length; y++) {
      for (var x = 0; x < p.matrix.length; x++) {
        if (!p.matrix[y][x]) continue;
        var by = p.y + y;
        var bx = p.x + x;
        if (by >= HIDDEN_ROWS) lockedAboveField = false;
        if (by >= 0 && by < ROWS) game.board[by][bx] = p.type;
      }
    }

    game.piece = null;
    Sound.lock();

    var full = [];
    for (var r = 0; r < ROWS; r++) {
      var complete = true;
      for (var c = 0; c < COLS; c++) {
        if (!game.board[r][c]) { complete = false; break; }
      }
      if (complete) full.push(r);
    }

    if (lockedAboveField && full.length === 0) {
      gameOver();
      return;
    }

    if (full.length > 0) {
      game.pendingScore = { lines: full.length, spin: spin };
      game.clearRows = full;
      game.clearTimer = 0;
      game.state = 'clearing';
      Sound.clear(full.length);
    } else {
      applyScore(0, spin);
      spawn();
    }
  }

  function finishClear() {
    var rows = game.clearRows.slice().sort(function (a, b) { return a - b; });
    for (var i = 0; i < rows.length; i++) {
      game.board.splice(rows[i], 1);
      var fresh = [];
      for (var c = 0; c < COLS; c++) fresh.push(null);
      game.board.unshift(fresh);
    }
    game.clearRows = [];
    applyScore(game.pendingScore.lines, game.pendingScore.spin);
    game.pendingScore = null;
    game.state = 'playing';
    spawn();
  }

  function isBoardEmpty() {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (game.board[y][x]) return false;
      }
    }
    return true;
  }

  function applyScore(lines, spin) {
    var level = game.level;
    var points = 0;
    var label = '';
    var difficult = false;

    if (spin === 'tspin') {
      points = [400, 800, 1200, 1600][lines] || 0;
      label = ['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'][lines] || 'T-SPIN';
      difficult = lines > 0;
    } else if (spin === 'mini') {
      points = [100, 200, 400, 0][lines] || 0;
      label = lines > 0 ? 'T-SPIN MINI' : '';
      difficult = lines > 0;
    } else {
      points = [0, 100, 300, 500, 800][lines] || 0;
      label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][lines] || '';
      difficult = lines === 4;
    }

    var messages = [];

    if (lines > 0) {
      if (difficult && game.backToBack) {
        points = Math.floor(points * 1.5);
        messages.push('BACK-TO-BACK');
      }
      game.backToBack = difficult;
    }

    // Der Levelfaktor gilt fuer die Grundwertung; Combo und Perfect Clear
    // werden danach einmal (und nur einmal) mit dem Level verrechnet.
    var gained = points * level;

    if (lines > 0) {
      game.combo++;
      if (game.combo > 0) {
        gained += 50 * game.combo * level;
        messages.push(game.combo + 'x COMBO');
      }
    } else {
      game.combo = -1;
    }

    game.score += gained;

    if (lines > 0 && isBoardEmpty()) {
      var pc = [0, 800, 1200, 1800, 2000][lines] || 0;
      game.score += pc * level;
      messages.push('PERFECT CLEAR');
    }

    if (label) messages.unshift(label);
    if (messages.length) showToast(messages.join('\n'));

    if (lines > 0) {
      game.lines += lines;
      var newLevel = Math.floor(game.lines / 10) + 1;
      if (newLevel > game.level) {
        game.level = newLevel;
        Sound.levelUp();
        showToast('LEVEL ' + newLevel);
      }
    }

    if (game.score > game.best) {
      game.best = game.score;
      try { localStorage.setItem(BEST_KEY, String(game.best)); } catch (e) { /* egal */ }
    }

    renderStats();
  }

  function gameOver() {
    game.state = 'over';
    game.piece = null;
    Sound.gameOver();
    showOverlay('GAME OVER',
      'Punkte: ' + game.score + '\nReihen: ' + game.lines + '   Level: ' + game.level +
      (game.score >= game.best && game.score > 0 ? '\n\nNeuer Bestwert!' : ''),
      'Nochmal spielen');
  }

  function reset() {
    game.board = emptyBoard();
    game.bag = [];
    game.queue = [];
    game.hold = null;
    game.holdUsed = false;
    game.piece = null;
    game.score = 0;
    game.lines = 0;
    game.level = 1;
    game.combo = -1;
    game.backToBack = false;
    game.clearRows = [];
    game.pendingScore = null;
    game.elapsed = 0;
    resetLockState();
    fillQueue();
  }

  function start() {
    clearInput();
    reset();
    game.state = 'playing';
    hideOverlay();
    Sound.unlock();
    spawn();
    renderStats();
  }

  function togglePause() {
    if (game.state === 'playing' || game.state === 'clearing') {
      game.state = 'paused';
      clearInput();
      showOverlay('PAUSE', 'P oder Enter zum Weiterspielen', 'Weiter');
    } else if (game.state === 'paused') {
      game.state = 'playing';
      hideOverlay();
    }
  }

  // ---------------------------------------------------------------- Anzeige

  function showOverlay(title, text, btn) {
    ui.ovTitle.textContent = title;
    ui.ovText.textContent = text;
    ui.ovBtn.textContent = btn;
    ui.overlay.hidden = false;
  }

  function hideOverlay() {
    ui.overlay.hidden = true;
  }

  var toastTimer = null;
  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.remove('show');
    void ui.toast.offsetWidth;              // Animation neu starten
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('show'); }, 1000);
  }

  function renderStats() {
    ui.score.textContent = game.score;
    ui.best.textContent = game.best;
    ui.level.textContent = game.level;
    ui.lines.textContent = game.lines;
  }

  function renderPanels() {
    var hw = holdCanvas.width / SS;
    var hh = holdCanvas.height / SS;
    hctx.clearRect(0, 0, hw, hh);
    if (game.hold) {
      hctx.globalAlpha = game.holdUsed ? 0.35 : 1;
      drawPreviewPiece(hctx, game.hold, 0, 0, hw, hh);
      hctx.globalAlpha = 1;
    }

    var nw = nextCanvas.width / SS;
    var nh = nextCanvas.height / SS;
    nctx.clearRect(0, 0, nw, nh);
    var slot = nh / NEXT_COUNT;
    for (var i = 0; i < Math.min(NEXT_COUNT, game.queue.length); i++) {
      nctx.globalAlpha = Math.max(0.55, 1 - i * 0.1);
      drawPreviewPiece(nctx, game.queue[i], 0, i * slot, nw, slot);
    }
    nctx.globalAlpha = 1;
  }

  function render() {
    drawGrid();

    // Bereits liegende Steine
    for (var y = HIDDEN_ROWS; y < ROWS; y++) {
      var flashing = game.state === 'clearing' && game.clearRows.indexOf(y) !== -1;
      for (var x = 0; x < COLS; x++) {
        var type = game.board[y][x];
        if (!type) continue;
        var py = (y - HIDDEN_ROWS) * CELL;
        if (flashing) {
          var t = game.clearTimer / CLEAR_ANIM;
          bctx.globalAlpha = 1 - t;
          drawCell(bctx, x * CELL, py, CELL, '#ffffff');
          bctx.globalAlpha = 1;
        } else {
          drawCell(bctx, x * CELL, py, CELL, COLORS[type]);
        }
      }
    }

    if (game.piece && (game.state === 'playing' || game.state === 'paused')) {
      var p = game.piece;

      // Geisterstein
      var gy = 0;
      while (!collides(p, 0, gy + 1)) gy++;
      var i, j;
      for (i = 0; i < p.matrix.length; i++) {
        for (j = 0; j < p.matrix.length; j++) {
          if (!p.matrix[i][j]) continue;
          var ry = p.y + i + gy;
          if (ry < HIDDEN_ROWS) continue;
          drawCell(bctx, (p.x + j) * CELL, (ry - HIDDEN_ROWS) * CELL, CELL, COLORS[p.type], { ghost: true });
        }
      }

      // Aktiver Stein
      for (i = 0; i < p.matrix.length; i++) {
        for (j = 0; j < p.matrix.length; j++) {
          if (!p.matrix[i][j]) continue;
          var by = p.y + i;
          if (by < HIDDEN_ROWS) continue;
          drawCell(bctx, (p.x + j) * CELL, (by - HIDDEN_ROWS) * CELL, CELL, COLORS[p.type]);
        }
      }
    }
  }

  // ---------------------------------------------------------------- Steuerung

  var input = {
    left: { down: false, timer: 0, repeating: false },
    right: { down: false, timer: 0, repeating: false },
    down: { down: false, timer: 0 }
  };

  function handleHorizontal(dt) {
    ['left', 'right'].forEach(function (dir) {
      var st = input[dir];
      if (!st.down) return;
      st.timer += dt;
      if (!st.repeating) {
        if (st.timer >= DAS) {
          st.repeating = true;
          st.timer -= DAS;
          move(dir === 'left' ? -1 : 1);
        }
      } else {
        while (st.timer >= ARR) {
          st.timer -= ARR;
          move(dir === 'left' ? -1 : 1);
        }
      }
    });
  }

  function handleSoftDrop(dt) {
    if (!input.down.down) return;
    input.down.timer += dt;
    while (input.down.timer >= SOFT_DROP_INTERVAL) {
      input.down.timer -= SOFT_DROP_INTERVAL;
      if (!softDrop()) break;
    }
  }

  function clearInput() {
    input.left.down = input.right.down = input.down.down = false;
    input.left.repeating = input.right.repeating = false;
    input.left.timer = input.right.timer = input.down.timer = 0;
  }

  function pressDirection(dir) {
    var st = input[dir];
    if (st.down) return;
    st.down = true;
    st.timer = 0;
    st.repeating = false;
    move(dir === 'left' ? -1 : 1);
  }

  function releaseDirection(dir) {
    input[dir].down = false;
    input[dir].repeating = false;
    input[dir].timer = 0;
  }

  var ACTIONS = {
    left: function () { pressDirection('left'); },
    right: function () { pressDirection('right'); },
    softDrop: function () { input.down.down = true; input.down.timer = 0; softDrop(); },
    hardDrop: hardDrop,
    rotateCW: function () { rotate(1); },
    rotateCCW: function () { rotate(-1); },
    hold: holdPiece
  };

  function keyToAction(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ArrowDown': case 'KeyS': return 'softDrop';
      case 'Space': return 'hardDrop';
      case 'ArrowUp': case 'KeyX': case 'KeyW': return 'rotateCW';
      case 'ControlLeft': case 'ControlRight': case 'KeyY': case 'KeyZ': return 'rotateCCW';
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight': return 'hold';
      default: return null;
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') {
      var on = Sound.toggle();
      if (ui.soundState) ui.soundState.textContent = on ? 'an' : 'aus';
      return;
    }

    if (e.code === 'Enter' || e.code === 'Space') {
      if (game.state === 'menu' || game.state === 'over') {
        e.preventDefault();
        start();
        return;
      }
      if (game.state === 'paused' && e.code === 'Enter') {
        e.preventDefault();
        togglePause();
        return;
      }
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.code === 'KeyR') {
      e.preventDefault();
      start();
      return;
    }

    var action = keyToAction(e);
    if (!action) return;
    e.preventDefault();
    if (game.state !== 'playing') return;
    if (e.repeat) return;               // Wiederholung erledigt die Spielschleife
    ACTIONS[action]();
  });

  window.addEventListener('keyup', function (e) {
    var action = keyToAction(e);
    if (action === 'left') releaseDirection('left');
    else if (action === 'right') releaseDirection('right');
    else if (action === 'softDrop') { input.down.down = false; input.down.timer = 0; }
  });

  // Touch-Bedienung
  var touchBar = document.getElementById('touch');
  if (touchBar) {
    touchBar.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      e.preventDefault();
      btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
      if (game.state === 'menu' || game.state === 'over') { start(); return; }
      if (game.state !== 'playing') return;
      ACTIONS[btn.dataset.act]();
    });

    touchBar.addEventListener('pointerup', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'left') releaseDirection('left');
      else if (act === 'right') releaseDirection('right');
      else if (act === 'softDrop') { input.down.down = false; input.down.timer = 0; }
    });

    touchBar.addEventListener('pointercancel', function () {
      releaseDirection('left');
      releaseDirection('right');
      input.down.down = false;
    });
  }

  // Wischgesten auf dem Spielfeld
  (function () {
    var startX = 0, startY = 0, lastX = 0, lastY = 0, active = false, moved = false, startTime = 0;
    var STEP = 26;

    boardCanvas.addEventListener('pointerdown', function (e) {
      if (game.state === 'menu' || game.state === 'over' || game.state === 'paused') return;
      active = true;
      moved = false;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      startTime = performance.now();
    });

    boardCanvas.addEventListener('pointermove', function (e) {
      if (!active || game.state !== 'playing') return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      if (Math.abs(dx) >= STEP && Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? 1 : -1);
        lastX = e.clientX;
        moved = true;
      } else if (dy >= STEP) {
        softDrop();
        lastY = e.clientY;
        moved = true;
      }
    });

    boardCanvas.addEventListener('pointerup', function (e) {
      if (!active) return;
      active = false;
      if (game.state !== 'playing') return;
      var dy = e.clientY - startY;
      var dx = e.clientX - startX;
      var dt = performance.now() - startTime;
      if (!moved && Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
        rotate(1);                                   // Tippen dreht
      } else if (dy > 90 && dt < 350 && Math.abs(dx) < Math.abs(dy)) {
        hardDrop();                                  // schnelles Wischen nach unten
      }
    });

    boardCanvas.addEventListener('pointercancel', function () { active = false; });
  })();

  ui.ovBtn.addEventListener('click', function () {
    Sound.unlock();
    if (game.state === 'paused') togglePause();
    else start();
  });

  window.addEventListener('blur', clearInput);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.state === 'playing') togglePause();
  });

  // ------------------------------------------------------------ Spielschleife

  var lastTime = 0;

  function update(dt) {
    if (game.state === 'clearing') {
      game.clearTimer += dt;
      game.elapsed += dt;
      if (game.clearTimer >= CLEAR_ANIM) finishClear();
      return;
    }

    if (game.state !== 'playing' || !game.piece) return;

    game.elapsed += dt;
    handleHorizontal(dt);
    handleSoftDrop(dt);

    if (!game.piece) return;

    // Schwerkraft
    game.gravityTimer += dt;
    var step = gravityMs(game.level);
    while (game.gravityTimer >= step) {
      game.gravityTimer -= step;
      if (!collides(game.piece, 0, 1)) {
        game.piece.y++;
        game.lastMoveWasRotation = false;
      } else {
        break;
      }
    }

    // Lock-Delay
    var onGround = collides(game.piece, 0, 1);
    if (onGround) {
      if (!game.grounded) {
        game.grounded = true;
        game.lockTimer = 0;
      }
      game.lockTimer += dt;
      if (game.lockTimer >= LOCK_DELAY) lockPiece();
    } else if (game.grounded) {
      game.grounded = false;
      game.lockTimer = 0;
    }
  }

  function loop(now) {
    var dt = Math.min(now - lastTime || 0, 100);
    lastTime = now;
    update(dt);
    render();
    ui.time.textContent = formatTime(game.elapsed);
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------- Start

  reset();
  renderStats();
  renderPanels();
  render();
  showOverlay('TETRIS', 'Enter oder Leertaste zum Starten', 'Spiel starten');
  requestAnimationFrame(loop);
})();
