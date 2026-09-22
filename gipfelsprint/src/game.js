/*
 * Spielablauf: ein Lauf vom Start bis ins Ziel, keine Checkpoints.
 *
 * Wer stuerzt, beginnt sofort neu - ohne Menue, ohne Ladezeit. Die Physik
 * laeuft mit konstant 120 Hz, unabhaengig von der Bildrate, damit Zeiten
 * zwischen zwei Rechnern vergleichbar bleiben.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var Physics = root.MR.physics;
  var LevelMod = root.MR.level;
  var MAT = LevelMod.MAT;
  var Audio = root.MR.audio;
  var Ghost = root.MR.ghost;

  var FIXED = 1 / 120;
  var STORE_KEY = 'gipfelsprint.record.v3';
  var ROUTE_NAMES = ['Sicher', 'Schnell', 'Irre'];
  var ROUTE_CLASS = ['safe', 'fast', 'insane'];
  var FLOW_NAMES = ['Flow', 'Flow II', 'Flow III', 'Im Rausch'];

  function $(id) { return document.getElementById(id); }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var ms = Math.floor(sec * 1000);
    var m = Math.floor(ms / 60000);
    var s = Math.floor(ms / 1000) % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + (ms % 1000)).slice(-3);
  }

  function formatDelta(sec) {
    return (sec >= 0 ? '+' : '-') + Math.abs(sec).toFixed(2).replace('.', ',');
  }

  /* --------------------------------------------------------- Partikel */

  function Particles(max) {
    this.max = max;
    this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.z = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.max_life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.grav = new Float32Array(max);
    this.mesh = [];
    this._m = new Float32Array(16);
    this._mat = { color: [0, 0, 0], accent: [0, 0, 0], emissive: 0.5, pattern: 0, patternScale: 1, alpha: 1 };
  }

  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, life, size, col, grav, mesh) {
    var i;
    if (this.n < this.max) { i = this.n++; }
    else { i = (this._rr = ((this._rr || 0) + 1) % this.max); }
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max_life[i] = life;
    this.size[i] = size;
    this.col[i * 3] = col[0]; this.col[i * 3 + 1] = col[1]; this.col[i * 3 + 2] = col[2];
    this.grav[i] = grav === undefined ? -24 : grav;
    this.mesh[i] = mesh || 'box';
  };

  Particles.prototype.burst = function (x, y, z, count, opts) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = opts.speed * (0.4 + Math.random() * 0.8);
      this.spawn(
        x + (Math.random() - 0.5) * (opts.spread || 0.6),
        y + (Math.random() - 0.5) * (opts.spread || 0.6) * 0.5,
        z + (Math.random() - 0.5) * (opts.spread || 0.6),
        Math.cos(a) * sp + (opts.vx || 0),
        (opts.up || 0) * (0.3 + Math.random()) + (opts.vy || 0),
        Math.sin(a) * sp + (opts.vz || 0),
        opts.life * (0.6 + Math.random() * 0.6),
        opts.size * (0.6 + Math.random() * 0.8),
        opts.color, opts.grav, opts.mesh
      );
    }
  };

  /* Ring aus Partikeln - fuer Doppelsprung, Tore und Bestzeiten. */
  Particles.prototype.ring = function (x, y, z, n, radius, speed, col, size, life) {
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      this.spawn(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius,
        Math.cos(a) * speed, 1.2, Math.sin(a) * speed, life || 0.5, size || 0.26, col, -5, 'box');
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vy[i] += this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      this.vx[i] *= 1 - 1.4 * dt;
      this.vz[i] *= 1 - 1.4 * dt;
    }
  };

  Particles.prototype.render = function (batch, t) {
    var mat = this._mat, m = this._m;
    for (var i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      var f = this.life[i] / this.max_life[i];
      var s = this.size[i] * (0.3 + f * 0.9);
      mat.color[0] = this.col[i * 3]; mat.color[1] = this.col[i * 3 + 1]; mat.color[2] = this.col[i * 3 + 2];
      mat.accent[0] = mat.color[0]; mat.accent[1] = mat.color[1]; mat.accent[2] = mat.color[2];
      mat.alpha = Math.min(1, f * 1.6);
      m4.compose(m, this.x[i], this.y[i], this.z[i], t * 3 + i, t * 2.3 + i, 0, s, s, s);
      batch.add(this.mesh[i], m, mat);
    }
  };

  /* ------------------------------------------------------------- Spiel */

  function Game(canvas) {
    this.canvas = canvas;
    this.gfx = root.MR.render.create(canvas);
    if (!this.gfx) throw new Error('WebGL2 ist nicht verfuegbar.');
    this.input = root.MR.input.create(canvas);
    this.level = LevelMod.build();
    this.player = root.MR.player.create(this.level);
    this.cam = root.MR.player.createCamera();
    this.particles = new Particles(760);

    this.staticBatch = this.gfx.createBatch(false);
    this.staticGlass = this.gfx.createBatch(false);
    this.dynBatch = this.gfx.createBatch(true);
    this.dynGlass = this.gfx.createBatch(true);

    this.state = 'menu';
    this.simTime = 0;
    this.runTime = 0;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.qualityChecked = 0;

    this.ghostRec = new Ghost.Recorder(Ghost.HZ);
    this.ghostPlay = null;
    this.ghostVisible = true;
    this.ghostAvatar = {
      x: 0, y: 0, z: 0, yaw: 0, height: this.player.height,
      squash: 1, lean: 0, runCycle: 0, speed: 0, grounded: true
    };
    this.ghostMat = LevelMod.mat([0.30, 0.78, 1.0], [0.70, 0.95, 1.0], { emissive: 0.5 });

    this.store = this.loadStore();
    this.record = this.store.best || null;

    this.resetRunState();
    this.buildStatics();
    this.bindUi();
    this.resetRun();
    this.updateMenu();
  }

  Game.prototype.buildStatics = function () {
    var v = this.level.visuals, i;
    for (i = 0; i < v.length; i++) this.staticBatch.add(v[i].mesh, v[i].m, v[i].mat);
    this.staticBatch.upload();
    var g = this.level.glass;
    for (i = 0; i < g.length; i++) this.staticGlass.add(g[i].mesh, g[i].m, g[i].mat);
    this.staticGlass.upload();
  };

  /* ----------------------------------------------------- Dauerhafte Daten */

  Game.prototype.loadStore = function () {
    var empty = {
      best: null, bestSplits: [], bestGems: 0, bestChain: 0,
      bestStreak: 0, runs: 0, finished: 0, bestFlow: 0
    };
    try {
      var raw = root.localStorage.getItem(STORE_KEY);
      if (!raw) return empty;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return empty;
      for (var k in empty) if (s[k] === undefined) s[k] = empty[k];
      return s;
    } catch (e) { return empty; }
  };

  Game.prototype.saveStore = function () {
    try { root.localStorage.setItem(STORE_KEY, JSON.stringify(this.store)); } catch (e) { /* privater Modus */ }
  };

  Game.prototype.medalFor = function (time) {
    var m = this.level.medals;
    for (var i = 0; i < m.length; i++) if (time <= m[i].time) return m[i];
    return null;
  };

  Game.prototype.nextMedalFor = function (time) {
    var m = this.level.medals;
    for (var i = m.length - 1; i >= 0; i--) if (time <= m[i].time) return m[i];
    return null;
  };

  Game.prototype.medalHtml = function (highlightTime) {
    var m = this.level.medals, out = '';
    var best = this.record ? this.record.time : Infinity;
    for (var i = m.length - 1; i >= 0; i--) {
      var earned = best <= m[i].time;
      var target = highlightTime !== undefined && highlightTime <= m[i].time;
      out += '<div class="medal medal--' + m[i].key + (earned ? ' earned' : '') + (target ? ' target' : '') + '">' +
        '<div class="medal__dot"></div><div class="medal__name">' + m[i].name + '</div>' +
        '<div class="medal__time">' + formatTime(m[i].time) + '</div></div>';
    }
    return out;
  };

  /* ------------------------------------------------------------- UI */

  Game.prototype.bindUi = function () {
    var self = this;
    $('btnStart').addEventListener('click', function () {
      Audio.unlock();
      if (self.input.isTouch && !document.fullscreenElement) self.toggleFullscreen();
      self.startRun(false);
    });
    $('btnRetry').addEventListener('click', function () { self.startRun(true); });
    $('btnMenu').addEventListener('click', function () { self.toMenu(); });
    $('btnResume').addEventListener('click', function () { self.setPaused(false); });
    $('btnRestart').addEventListener('click', function () { self.startRun(true); });
    $('btnQuit').addEventListener('click', function () { self.toMenu(); });

    this.canvas.addEventListener('mousedown', function () {
      if (self.state === 'run' || self.state === 'countdown') Audio.unlock();
    });

    this.input.onKey = function (code) {
      if (code === 'KeyM') {
        self.toast(Audio.toggleMute() ? 'Ton aus' : 'Ton an');
        return;
      }
      if (code === 'KeyG') {
        self.ghostVisible = !self.ghostVisible;
        self.toast(self.ghostVisible ? 'Geist an' : 'Geist aus');
        return;
      }
      if (self.state === 'menu') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'KeyR') {
          Audio.unlock();
          self.startRun(false);
        }
        return;
      }
      if (code === 'KeyR') { self.startRun(true); return; }
      if (self.state === 'finish') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') self.startRun(true);
        if (code === 'Escape') self.toMenu();
        return;
      }
      if (code === 'Escape' || code === 'KeyP') { self.setPaused(self.state !== 'pause'); return; }
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === 'run') self.setPaused(true);
    });
    root.addEventListener('resize', function () { self.resize(); });
    root.addEventListener('orientationchange', function () {
      root.setTimeout(function () { self.resize(); }, 250);
    });

    var rc = $('rotateClose');
    if (rc) rc.addEventListener('click', function () { $('rotate').hidden = true; });

    if (this.input.isTouch) this.bindTouch();
    else {
      /* Falls doch ein Finger kommt (Tablet, Hybridgeraet), wird die
         Bedienoberflaeche nachgereicht. */
      this.input.onFirstTouch = function () {
        if (!self.touchBound) self.bindTouch();
      };
    }
  };

  /* Bildschirmsteuerung: Schiebeknopf links, Knoepfe rechts. */
  Game.prototype.bindTouch = function () {
    var self = this;
    if (this.touchBound) return;
    this.touchBound = true;
    this.input.wantPointerLock = false;
    document.body.classList.add('touch');
    $('touchUI').hidden = false;
    $('btnFullscreen').hidden = false;

    function press(el, onDown, onUp) {
      var start = function (e) {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('held');
        onDown();
      };
      var end = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        el.classList.remove('held');
        if (onUp) onUp();
      };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    }

    press($('tBtnJump'),
      function () { Audio.unlock(); self.input.setVirtual('jump', true); },
      function () { self.input.setVirtual('jump', false); });
    press($('tBtnDash'),
      function () { Audio.unlock(); self.input.setVirtual('dash', true); },
      function () { self.input.setVirtual('dash', false); });
    press($('tBtnRestart'), function () { self.startRun(true); });
    press($('tBtnPause'), function () { self.setPaused(self.state !== 'pause'); });

    /* Der Schiebeknopf erscheint dort, wo der Daumen aufsetzt. */
    var stick = $('stick'), knob = $('stickKnob');
    this.input.onStick = function (active, ox, oy, dx, dy) {
      if (!active) { stick.classList.remove('on'); return; }
      stick.classList.add('on');
      stick.style.left = ox + 'px';
      stick.style.top = oy + 'px';
      knob.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
    };

    $('btnFullscreen').addEventListener('click', function () { self.toggleFullscreen(); });
  };

  Game.prototype.toggleFullscreen = function () {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { /* iOS kann das nicht - dann eben ohne */ }
  };

  Game.prototype.updateMenu = function () {
    $('menuMedals').innerHTML = this.medalHtml();
    $('gemTotal').textContent = this.level.gems.length;
    $('pbLine').textContent = this.record ? 'PB ' + formatTime(this.record.time) : 'PB --:--.---';

    var s = this.store;
    var cards = [
      ['Bestzeit', this.record ? formatTime(this.record.time) : '--:--.---'],
      ['Beste Route', this.record && this.record.route ? this.routeLabel(this.record.route) : '-'],
      ['Kristalle', s.bestGems + '/' + this.level.gems.length],
      ['Beste Kette', s.bestChain + 'x'],
      ['Laengster Lauf', s.bestStreak ? formatTime(s.bestStreak) : '-'],
      ['Flow-Rekord', Math.round(s.bestFlow)],
      ['Laeufe', s.runs],
      ['Im Ziel', s.finished]
    ];
    $('menuStats').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span>' + c[0] + '</span><b>' + c[1] + '</b></div>';
    }).join('');
  };

  Game.prototype.routeLabel = function (route) {
    if (!route) return '-';
    var out = [];
    for (var i = 0; i < route.length; i++) out.push(ROUTE_NAMES[route[i]] || '?');
    return out.join(' / ');
  };

  Game.prototype.toast = function (text, cls) {
    this.trick(text, cls || '');
  };

  /* Trickmeldung rechts im Bild. */
  Game.prototype.trick = function (text, cls, sub) {
    var el = document.createElement('div');
    el.className = 'trick' + (cls ? ' trick--' + cls : '');
    el.innerHTML = text + (sub ? '<small>' + sub + '</small>' : '');
    var box = $('tricks');
    box.appendChild(el);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    root.setTimeout(function () { if (el.parentNode) el.remove(); }, 1600);
  };

  Game.prototype.bigMessage = function (text, cls) {
    var el = $('bigMessage');
    el.className = 'bigmsg';
    el.textContent = text;
    void el.offsetWidth;
    el.className = 'bigmsg show' + (cls ? ' ' + cls : '');
  };

  /* -------------------------------------------------------- Zustaende */

  Game.prototype.toMenu = function () {
    this.state = 'menu';
    this.input.releasePointer();
    $('menu').hidden = false;
    $('result').hidden = true;
    $('pause').hidden = true;
    $('hud').hidden = true;
    this.updateMenu();
    this.resetRun();
    Audio.stopMusic();
  };

  Game.prototype.resetRunState = function () {
    this.runTime = 0;
    this.gems = 0;
    this.splits = [];
    this.route = [0, 0, 0];
    this.routeSeen = [false, false, false];
    this.flow = 0;
    this.flowLevel = 0;
    this.flowScore = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.bestChainThisRun = 0;
    this.airActions = 0;
    this.groundTime = 0;
    this.fastTimer = 0;
    this.speedStreakArmed = true;
    this.liveDelta = null;
    this.deltaTimer = 0;
  };

  Game.prototype.resetRun = function () {
    this.level.reset();
    this.level.update(0, 0, null);
    this.resetRunState();
    this.player.spawnAt(this.level.spawn);
    this.player.events.length = 0;
    this.cam.manualTimer = 0;
    this.cam.yaw = this.level.spawn.yaw;
    this.cam.snap(this.player);
    this.particles.n = 0;
    this.ghostRec.reset();
    this.ghostPlay = this.record && this.record.ghost ? new Ghost.Playback(this.record.ghost) : null;
    $('routeBadge').className = 'route-badge';
    $('timerDelta').className = 'timer__delta';
    $('speedlines').className = 'speedlines';
    var box = $('tricks');
    while (box.firstChild) box.removeChild(box.firstChild);
  };

  /* instant = sofort losrennen (Neustart nach Sturz oder mit R). */
  Game.prototype.startRun = function (instant) {
    $('menu').hidden = true;
    $('result').hidden = true;
    $('pause').hidden = true;
    $('hud').hidden = false;
    this.resetRun();
    this.store.runs++;   /* gespeichert wird beim Sturz oder im Ziel */
    if (instant) {
      this.state = 'run';
      this.cam.dist = 8.2;
      this.cam.manualTimer = 0;
      this.bigMessage('LOS!', 'go');
      Audio.sfx.restart();
    } else {
      this.state = 'countdown';
      this.countdown = 2.6;
      this.countStep = -1;
    }
    this.updateHud();
    Audio.startMusic();
    this.input.grabPointer();
  };

  Game.prototype.setPaused = function (on) {
    if (on && this.state === 'run') {
      this.state = 'pause';
      $('pause').hidden = false;
      this.input.releasePointer();
    } else if (!on && this.state === 'pause') {
      this.state = 'run';
      $('pause').hidden = true;
      this.lastFrame = 0;
    }
  };

  /* ------------------------------------------------------- Sturz = Ende */

  Game.prototype.die = function (reason) {
    if (this.state !== 'run') return;
    this.state = 'dying';
    this.dyingTimer = 0.3;
    Audio.sfx.hit();
    this.cam.shake = 0.7;
    var f = $('flash');
    f.className = 'flash';
    void f.offsetWidth;
    f.className = 'flash hit';
    var p = this.player;
    this.particles.burst(p.x, p.y, p.z, 34, {
      speed: 10, up: 8, life: 0.7, size: 0.34, color: [1, 0.42, 0.38], grav: -26, spread: 0.8, mesh: 'box'
    });
    if (this.runTime > this.store.bestStreak) this.store.bestStreak = this.runTime;
    this.saveStore();
  };

  Game.prototype.finishRun = function () {
    this.state = 'finish';
    this.input.releasePointer();
    var time = this.runTime;
    var medal = this.medalFor(time);
    var prev = this.record ? this.record.time : null;
    var isBest = !this.record || time < this.record.time;

    this.store.finished++;
    if (this.gems > this.store.bestGems) this.store.bestGems = this.gems;
    if (this.bestChainThisRun > this.store.bestChain) this.store.bestChain = this.bestChainThisRun;
    if (this.flowScore > this.store.bestFlow) this.store.bestFlow = this.flowScore;
    if (time > this.store.bestStreak) this.store.bestStreak = time;

    var i;
    for (i = 0; i < this.splits.length; i++) {
      if (this.store.bestSplits[i] === undefined || this.splits[i] < this.store.bestSplits[i]) {
        this.store.bestSplits[i] = this.splits[i];
      }
    }

    if (isBest) {
      this.record = {
        time: time, gems: this.gems, route: this.route.slice(),
        splits: this.splits.slice(), flow: Math.round(this.flowScore),
        ghost: this.ghostRec.finish(time)
      };
      this.store.best = this.record;
    }
    this.saveStore();

    $('resultTitle').textContent = medal ? 'ZIEL - ' + medal.name : 'ZIEL';
    $('resultTime').textContent = formatTime(time);
    $('resultBest').textContent = formatTime(this.record.time);
    $('resultGems').textContent = this.gems + '/' + this.level.gems.length;
    $('resultRoute').textContent = this.routeLabel(this.route);
    $('resultFlow').textContent = Math.round(this.flowScore);
    $('resultNew').hidden = !isBest;

    var diff = $('resultDiff');
    if (prev !== null) {
      var d = time - prev;
      diff.textContent = formatDelta(d) + ' s';
      diff.className = 'result__diff ' + (d <= 0 ? 'ahead' : 'behind');
    } else {
      diff.textContent = 'Erster Lauf im Ziel';
      diff.className = 'result__diff';
    }

    var html = '';
    for (i = 0; i < this.splits.length; i++) {
      var name = this.level.gates[i] ? this.level.gates[i].name : ('Abschnitt ' + (i + 1));
      var segNow = this.splits[i] - (i > 0 ? this.splits[i - 1] : 0);
      var refAll = this.record && this.record.splits ? this.record.splits : null;
      var cls = '';
      var txt = formatTime(segNow);
      if (prev !== null && refAll && refAll[i] !== undefined && this.record.time !== time) {
        var segRef = refAll[i] - (i > 0 ? refAll[i - 1] : 0);
        var sd = segNow - segRef;
        cls = sd <= 0 ? ' ahead' : ' behind';
        txt += ' <b>' + formatDelta(sd) + '</b>';
      }
      html += '<div class="split' + cls + '"><small>' + name + '</small>' + txt + '</div>';
    }
    $('resultSplits').innerHTML = html;

    var big = $('resultMedalBig');
    big.className = 'medal-big' + (medal ? ' show ' + medal.key : '');
    $('resultMedals').innerHTML = this.medalHtml(time);
    $('result').hidden = false;
    this.updateMenu();

    Audio.sfx.finish(!!medal);
    if (isBest) root.setTimeout(function () { Audio.sfx.newBest(); }, 420);
    this.cam.shake = 0.5;
    var fin = this.level.finish;
    for (i = 0; i < 6; i++) {
      this.particles.burst(fin.x + (Math.random() - 0.5) * 10, fin.y + 4 + Math.random() * 6, fin.z + (Math.random() - 0.5) * 10,
        26, { speed: 10, up: 7, life: 1.6, size: 0.42, color: isBest ? [1, 0.85, 0.3] : [0.7, 0.9, 1], grav: -9, spread: 1.5, mesh: 'box' });
    }
  };

  /* ---------------------------------------------------- Flow und Tricks */

  var FLOW_GAIN = { crystal: 0.15, trick: 0.2, dash: 0.05, djump: 0.04, stomp: 0.12, gate: 0.3 };

  Game.prototype.addFlow = function (amount, points) {
    var before = this.flowLevel;
    this.flow = Math.min(1, this.flow + amount);
    this.flowLevel = Math.min(3, Math.floor(this.flow * 4));
    this.flowScore += (points || 0) * (1 + this.flowLevel * 0.5);
    if (this.flowLevel > before) {
      Audio.sfx.flowUp(this.flowLevel);
      this.trick(FLOW_NAMES[this.flowLevel], 'pink');
      var p = this.player;
      this.particles.ring(p.x, p.y - 0.6, p.z, 16, 1.4, 6, [0.8, 0.5, 1.0], 0.3, 0.6);
    }
  };

  Game.prototype.award = function (name, cls, points, sub) {
    this.trick(name, cls || 'cyan', sub);
    Audio.sfx.trick(this.flowLevel);
    this.addFlow(FLOW_GAIN.trick, points || 100);
    var p = this.player;
    this.particles.burst(p.x, p.y + 0.4, p.z, 10, {
      speed: 5, up: 3, life: 0.5, size: 0.26,
      color: cls === 'gold' ? [1, 0.85, 0.3] : (cls === 'pink' ? [1, 0.55, 0.85] : [0.5, 0.9, 1]),
      grav: -8, spread: 0.7, mesh: 'box'
    });
  };

  /* ----------------------------------------------------- Simulation */

  Game.prototype.fixedStep = function (dt, cmd) {
    var p = this.player, lvl = this.level, i;
    this.simTime += dt;
    lvl.update(this.simTime, dt, p);

    if (this.state === 'dying') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) this.startRun(true);
      return;
    }

    p.events.length = 0;
    var wasGrounded = p.grounded;
    p.step(dt, cmd);

    if (p.grounded) {
      this.groundTime += dt;
      if (!wasGrounded) this.airActions = 0;
    } else {
      this.groundTime = 0;
    }

    /* ---------------------------------------------- Ereignisse der Figur */
    for (i = 0; i < p.events.length; i++) {
      var ev = p.events[i];
      if (ev === 'jump') {
        Audio.sfx.jump();
        this.particles.burst(p.x, p.y - 0.85, p.z, 7, { speed: 3.4, up: 1.5, life: 0.35, size: 0.22, color: [0.95, 0.95, 0.85], grav: -14, spread: 0.5 });
        /* Sofort nach der Landung wieder abgesprungen: sauberer Rhythmus. */
        if (this.groundTime > 0 && this.groundTime < 0.14) {
          this.award('Perfekter Absprung', 'lime', 120);
        }
        this.airActions = 1;
      } else if (ev === 'doublejump') {
        Audio.sfx.doubleJump();
        this.particles.ring(p.x, p.y - 0.6, p.z, 14, 0.8, 4.5, [0.55, 0.9, 1.0], 0.24, 0.4);
        this.addFlow(FLOW_GAIN.djump, 20);
        this.airActions++;
      } else if (ev === 'dash') {
        Audio.sfx.dash();
        this.cam.shake = 0.16;
        this.cam.fovPunch = 0.22;
        this.particles.burst(p.x, p.y, p.z, 14, { speed: 2.5, up: 0.5, life: 0.4, size: 0.3, color: [0.7, 0.95, 1.0], grav: -2, spread: 0.7 });
        this.addFlow(FLOW_GAIN.dash, 30);
        this.airActions++;
        if (this.airActions >= 3) this.award('Luftkombo', 'pink', 220);
      } else if (ev === 'land' || ev === 'land_hard') {
        Audio.sfx.land(ev === 'land_hard');
        this.cam.landPunch = ev === 'land_hard' ? 0.55 : 0.2;
        if (ev === 'land_hard') this.cam.shake = 0.2;
        this.particles.burst(p.x, p.y - 0.85, p.z, ev === 'land_hard' ? 16 : 8, {
          speed: 5, up: 1.2, life: 0.4, size: 0.26, color: [0.9, 0.88, 0.78], grav: -20, spread: 0.7
        });
        this.checkCloseCall();
      } else if (ev === 'bounce') {
        Audio.sfx.bounce();
        this.cam.fovPunch = 0.12;
        this.particles.burst(p.x, p.y - 0.9, p.z, 18, { speed: 7, up: 3, life: 0.5, size: 0.3, color: [1, 0.5, 0.45], grav: -16, spread: 0.9 });
        this.airActions = 1;
      } else if (ev === 'boost') {
        Audio.sfx.boost();
        this.cam.shake = 0.14;
        this.cam.fovPunch = 0.18;
        this.addFlow(0.1, 60);
        this.trick('Schub', 'gold');
      } else if (ev === 'hazard') {
        this.die('hazard');
        return;
      }
    }

    if (this.state !== 'run') return;

    /* ------------------------------------------------------------ Gegner */
    var feet = p.y - p.height * 0.5;
    for (i = 0; i < lvl.enemies.length; i++) {
      var e = lvl.enemies[i];
      if (!e.alive) continue;
      var dx = p.x - e.x, dz = p.z - e.z, dy = p.y - e.y;
      var rr = e.r + p.radius + 0.1;
      if (dx * dx + dz * dz > rr * rr) continue;
      if (Math.abs(dy) > e.r + p.height * 0.5) continue;
      if (p.vy < -1.5 && feet > e.y - 0.15) {
        e.alive = false;
        e.squash = 1;
        p.vy = 15;
        p.jumps = 1;
        p.dashCharge = 1;
        Audio.sfx.stomp();
        this.cam.shake = 0.2;
        this.addFlow(FLOW_GAIN.stomp, 80);
        this.particles.burst(e.x, e.y, e.z, 18, { speed: 6, up: 3, life: 0.6, size: 0.3, color: e.mat.accent, grav: -18, spread: 0.8 });
      } else {
        this.die('enemy');
        return;
      }
    }

    /* -------------------------------------------------------- Kristalle */
    for (i = 0; i < lvl.gems.length; i++) {
      var g = lvl.gems[i];
      if (g.taken) continue;
      var gx = p.x - g.x, gy = p.y - g.y, gz = p.z - g.z;
      if (gx * gx + gy * gy + gz * gz > 3.4 * 3.4) continue;
      g.taken = true;
      this.gems++;
      this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
      this.chainTimer = 2.6;
      if (this.chain > this.bestChainThisRun) this.bestChainThisRun = this.chain;
      Audio.sfx.chain(this.chain);
      this.addFlow(FLOW_GAIN.crystal, 50 + this.chain * 25);
      this.particles.burst(g.x, g.y, g.z, 18, {
        speed: 5, up: 3.5, life: 0.7, size: 0.26, color: [1, 0.85, 0.3], grav: -10, spread: 0.5
      });
      this.particles.ring(g.x, g.y, g.z, 10, 0.8, 5, [1, 0.92, 0.5], 0.2, 0.4);
      var box = $('crystalBox');
      box.classList.remove('pop');
      void box.offsetWidth;
      box.classList.add('pop');
      if (this.chain >= 3) this.trick('Kette x' + this.chain, 'gold');
      if (this.gems === lvl.gems.length) this.award('Alle Kristalle', 'gold', 600);
    }

    /* ------------------------------------------- Routen und Zeittore */
    var hits = p.contact.hits;
    for (i = 0; i < hits.length; i++) {
      var c = hits[i];
      if (c.tag === 'route' && !this.routeSeen[c.fork]) {
        this.routeSeen[c.fork] = true;
        this.route[c.fork] = c.branch;
        var badge = $('routeBadge');
        badge.textContent = 'Route: ' + ROUTE_NAMES[c.branch];
        badge.className = 'route-badge show route-badge--' + ROUTE_CLASS[c.branch];
        if (c.branch === 2) this.award('Irre Route', 'pink', 300);
        else if (c.branch === 1) this.addFlow(0.12, 120);
      }
    }

    for (i = 0; i < lvl.gates.length; i++) {
      var gate = lvl.gates[i];
      if (gate.passed) continue;
      var cdx = p.x - gate.x, cdz = p.z - gate.z;
      if (Math.abs(p.y - gate.y) > 7) continue;
      if (cdx * cdx + cdz * cdz > gate.w * gate.w) continue;
      gate.passed = true;
      gate.flash = 1;
      this.splits[i] = this.runTime;
      this.addFlow(FLOW_GAIN.gate, 150);
      var ref = this.record && this.record.splits ? this.record.splits[i] : undefined;
      var ahead = ref !== undefined && this.runTime < ref;
      Audio.sfx.gate(ahead);
      if (ref !== undefined) {
        var d2 = this.runTime - ref;
        this.trick(gate.name, d2 <= 0 ? 'lime' : '', formatDelta(d2) + ' s');
      } else {
        this.trick(gate.name, 'cyan');
      }
      this.particles.ring(gate.x, gate.y + 1.5, gate.z, 20, 4, 9, ahead ? [0.6, 1, 0.7] : [1, 0.9, 0.5], 0.3, 0.7);
    }

    /* --------------------------------------------------------- Tempo */
    if (p.speed > 24) {
      this.fastTimer += dt;
      if (this.fastTimer > 3.2 && this.speedStreakArmed) {
        this.speedStreakArmed = false;
        this.award('Vollgas', 'gold', 260);
      }
    } else {
      this.fastTimer = 0;
      this.speedStreakArmed = true;
    }

    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }

    /* Tempo haelt den Flow am Leben, Stehenbleiben laesst ihn einbrechen. */
    if (p.speed > 19.5) this.flow = Math.min(1, this.flow + 0.028 * dt);
    else this.flow = Math.max(0, this.flow - (p.speed < 12 ? 0.12 : 0.03) * dt);
    this.flowLevel = Math.min(3, Math.floor(this.flow * 4));

    /* ------------------------------------------------------------- Ziel */
    var f = lvl.finish;
    if (f) {
      var fdx = p.x - f.x, fdz = p.z - f.z;
      if (Math.abs(p.y - f.y) < 9 && fdx * fdx + fdz * fdz < f.r * f.r) {
        this.finishRun();
        return;
      }
    }

    /* ----------------------------------------------------------- Absturz */
    if (p.y < lvl.floorAt(p.x, p.z)) this.die('fall');

    this.ghostRec.sample(this.runTime, p);
  };

  /* Knapp an der Kante gelandet? Das gibt Punkte. */
  var _hit = Physics.makeHit();
  Game.prototype.checkCloseCall = function () {
    var p = this.player;
    var world = this.level.world;
    var open = 0;
    for (var a = 0; a < 4; a++) {
      var ang = a * Math.PI / 2;
      var ox = p.x + Math.cos(ang) * 1.15;
      var oz = p.z + Math.sin(ang) * 1.15;
      if (!Physics.raycast(world, ox, p.y - 0.4, oz, 0, -1, 0, 2.2, _hit)) open++;
    }
    if (open >= 2 && p.speed > 10) this.award('Knapp', 'cyan', 150);
  };

  /* --------------------------------------------------------------- HUD */

  Game.prototype.updateHud = function () {
    var p = this.player;
    $('timer').textContent = formatTime(this.runTime);

    var d = $('timerDelta');
    if (this.liveDelta !== null && this.record) {
      d.textContent = formatDelta(this.liveDelta);
      d.className = 'timer__delta show ' + (this.liveDelta <= 0 ? 'ahead' : 'behind');
    } else {
      d.className = 'timer__delta';
    }

    $('gemCount').textContent = this.gems;
    var kmh = Math.round(p.speed * 3.1);
    $('speedValue').textContent = kmh;
    $('speedFill').style.width = Math.min(100, p.speed / 40 * 100) + '%';
    $('flowFill').style.width = (this.flow * 100).toFixed(1) + '%';
    $('flowLabel').textContent = this.flow > 0.02 ? FLOW_NAMES[this.flowLevel] : 'Flow';
    $('flowMult').textContent = 'x' + (1 + this.flowLevel * 0.5).toFixed(1);
    $('hud').className = 'hud flow--l' + this.flowLevel;
    var jumpReady = p.jumps > 0 || p.grounded;
    var dashReady = p.dashCharge > 0 && p.dashCooldown <= 0;
    $('abJump').className = 'ability' + (jumpReady ? ' ready' : ' used');
    $('abDash').className = 'ability' + (dashReady ? ' ready' : ' used');
    if (this.input.isTouch) {
      var bj = $('tBtnJump'), bd = $('tBtnDash');
      bj.classList.toggle('ready', jumpReady);
      bj.classList.toggle('used', !jumpReady);
      bd.classList.toggle('ready', dashReady);
      bd.classList.toggle('used', !dashReady);
    }
    $('speedlines').className = 'speedlines' + (p.speed > 26 ? ' on' : '');
  };

  /* ------------------------------------------------------------- Umwelt */

  Game.prototype.updateEnvironment = function (dt) {
    var p = this.player;
    var want = this.level.envAt(p.x, p.z);
    var env = this.gfx.env;
    var k = 1 - Math.exp(-2.2 * dt);
    var keys = ['fogCol', 'zenith', 'horizon', 'skyCol', 'groundCol', 'sunCol'];
    for (var i = 0; i < keys.length; i++) {
      var a = env[keys[i]], b = want[keys[i]];
      a[0] += (b[0] - a[0]) * k;
      a[1] += (b[1] - a[1]) * k;
      a[2] += (b[2] - a[2]) * k;
    }
    env.fogDensity += (want.fogDensity - env.fogDensity) * k;
    this.ambient = want.ambient;
    this.zoneName = want.zone;
  };

  var AMBIENT = {
    pollen: { color: [1.0, 0.95, 0.6], size: 0.18, life: 2.6, rate: 0.16, rise: 0.5, spread: 26, grav: 0.4 },
    leaves: { color: [0.45, 0.72, 0.30], size: 0.30, life: 3.4, rate: 0.13, rise: -0.6, spread: 24, grav: -1.6 },
    spray: { color: [0.85, 0.96, 1.0], size: 0.22, life: 1.4, rate: 0.08, rise: 1.2, spread: 20, grav: -6 },
    dust: { color: [0.90, 0.74, 0.52], size: 0.20, life: 2.4, rate: 0.12, rise: 0.4, spread: 24, grav: 0.3 },
    sparks: { color: [0.85, 0.55, 1.0], size: 0.16, life: 1.8, rate: 0.07, rise: 0.9, spread: 16, grav: 0.6 },
    snow: { color: [1.0, 1.0, 1.0], size: 0.24, life: 3.6, rate: 0.07, rise: -0.4, spread: 30, grav: -1.1 }
  };

  Game.prototype.updateAmbient = function (dt) {
    var p = this.player;
    var ps = this.particles;

    this._dustTimer = (this._dustTimer || 0) - dt;
    if (p.grounded && p.speed > 11 && this._dustTimer <= 0) {
      this._dustTimer = 0.06;
      var back = -1 / Math.max(p.speed, 0.01);
      var hot = this.flowLevel >= 2;
      ps.spawn(p.x + p.vx * back * 0.7, p.y - 0.82, p.z + p.vz * back * 0.7,
        (Math.random() - 0.5) * 2 - p.vx * 0.06, 1.4 + Math.random(), (Math.random() - 0.5) * 2 - p.vz * 0.06,
        0.38, 0.26, hot ? [0.75, 0.55, 1.0] : [0.88, 0.84, 0.74], -7, 'box');
    }

    /* Tempospur bei hohem Tempo */
    if (p.speed > 26) {
      this._trailTimer = (this._trailTimer || 0) - dt;
      if (this._trailTimer <= 0) {
        this._trailTimer = 0.03;
        ps.spawn(p.x + (Math.random() - 0.5) * 0.8, p.y + (Math.random() - 0.5) * 1.2, p.z + (Math.random() - 0.5) * 0.8,
          -p.vx * 0.12, 0.4, -p.vz * 0.12, 0.3, 0.2, [0.7, 0.95, 1.0], 0, 'box');
      }
    }

    var cfg = AMBIENT[this.ambient];
    if (cfg) {
      this._ambTimer = (this._ambTimer || 0) - dt;
      if (this._ambTimer <= 0) {
        this._ambTimer = cfg.rate;
        var a = Math.random() * Math.PI * 2;
        var dd = 6 + Math.random() * cfg.spread;
        ps.spawn(p.x + Math.cos(a) * dd, p.y + 3 + Math.random() * 14, p.z + Math.sin(a) * dd,
          (Math.random() - 0.5) * 1.6, cfg.rise, (Math.random() - 0.5) * 1.6,
          cfg.life, cfg.size, cfg.color, cfg.grav, 'box');
      }
    }

    var sp = this.level.sprayPoints;
    if (sp && sp.length) {
      this._sprayTimer = (this._sprayTimer || 0) - dt;
      if (this._sprayTimer <= 0) {
        this._sprayTimer = 0.05;
        for (var i = 0; i < sp.length; i++) {
          var s = sp[i];
          var dx = s.x - p.x, dz = s.z - p.z;
          if (dx * dx + dz * dz > 3600) continue;
          ps.spawn(s.x + (Math.random() - 0.5) * s.w * 1.6, s.y + Math.random() * 2, s.z + (Math.random() - 0.5) * s.w,
            (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4,
            1.0 + Math.random(), 0.3, [0.9, 0.97, 1.0], -9, 'box');
        }
      }
    }
  };

  /* ------------------------------------------------------------- Frame */

  Game.prototype.resize = function () {
    /* Handys haben oft dreifache Pixeldichte - das kostet mehr Leistung als
       es bringt. Deshalb deutlich niedriger deckeln. */
    var cap = this.lowQuality ? 1 : (this.input.isTouch ? 1.2 : 2);
    var dpr = Math.min(root.devicePixelRatio || 1, cap);
    this.gfx.resize(dpr);
  };

  Game.prototype.frame = function (now) {
    var dtReal = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.fps = this.fps * 0.92 + (1 / Math.max(dtReal, 0.001)) * 0.08;

    var input = this.input;
    var cmd = { wishX: 0, wishZ: 0, sprint: false, dash: false, jumpPressed: false, jumpHeld: false };
    var playing = this.state === 'run' || this.state === 'countdown' || this.state === 'dying';

    if (this.state === 'run') {
      var ax = input.axis();
      this.cam.wish(ax.x, ax.y, this.wish || (this.wish = [0, 0]));
      cmd.wishX = this.wish[0];
      cmd.wishZ = this.wish[1];
      /* Am Handy gibt es keine Sprinttaste: wer den Knopf ganz durchdrueckt,
         sprintet. */
      cmd.sprint = input.down('sprint') || (ax.fromTouch && ax.len > 0.78);
      cmd.dash = input.hit('dash');
      cmd.jumpPressed = input.hit('jump');
      cmd.jumpHeld = input.down('jump');
    }

    if (this.state === 'countdown') {
      this.countdown -= dtReal;
      var k = M.clamp(this.countdown / 2.6, 0, 1);
      this.cam.manualTimer = 0.2;
      this.cam.yaw = this.level.spawn.yaw + k * k * 1.5;
      this.cam.pitch = 0.2 + k * 0.1;
      this.cam.dist = 8.2 + k * 4.0;
      var stepIndex = Math.ceil(this.countdown / 0.8);
      if (stepIndex !== this.countStep) {
        this.countStep = stepIndex;
        if (stepIndex === 3) { this.bigMessage('3'); Audio.sfx.countdown(false); }
        else if (stepIndex === 2) { this.bigMessage('2'); Audio.sfx.countdown(false); }
        else if (stepIndex === 1) { this.bigMessage('1'); Audio.sfx.countdown(false); }
      }
      if (this.countdown <= 0) {
        this.state = 'run';
        this.cam.dist = 8.2;
        this.cam.manualTimer = 0;
        this.bigMessage('LOS!', 'go');
        Audio.sfx.countdown(true);
      }
    }

    if (playing || this.state === 'finish') {
      this.accumulator += dtReal;
      var steps = 0;
      while (this.accumulator >= FIXED && steps < 8) {
        this.accumulator -= FIXED;
        steps++;
        if (this.state === 'run') this.runTime += FIXED;
        this.fixedStep(FIXED, cmd);
        cmd.jumpPressed = false;
        cmd.dash = false;
      }
      if (steps >= 8) this.accumulator = 0;
      this.particles.update(dtReal);
    }

    /* Live-Rueckstand gegen den Geist */
    if (this.state === 'run' && this.ghostPlay) {
      this.deltaTimer -= dtReal;
      if (this.deltaTimer <= 0) {
        this.deltaTimer = 0.2;
        var near = this.ghostPlay.nearestTimeTo(this.player.x, this.player.z, this.runTime);
        this.liveDelta = (near && near.dist < 22) ? this.runTime - near.time : null;
      }
    } else if (this.state !== 'run') {
      this.liveDelta = null;
    }

    if (this.state === 'menu') {
      this.cam.manualTimer = 1;
      this.cam.yaw += dtReal * 0.12;
      this.cam.update(dtReal, this.player, null, this.level.world);
    } else {
      this.cam.update(dtReal, this.player, this.state === 'run' ? input : null, this.level.world);
    }

    if (playing) this.updateHud();
    this.updateEnvironment(dtReal);
    if (playing) this.updateAmbient(dtReal);
    Audio.setMusicIntensity(Math.min(1, this.player.speed / 26 + this.flowLevel * 0.2));

    this.render(dtReal);
    input.endFrame();

    if (!this.lowQuality && this.state === 'run') {
      if (this.fps < 40) {
        this.qualityChecked += dtReal;
        if (this.qualityChecked > 2.5) {
          this.lowQuality = true;
          this.gfx.bloom = false;
          this.resize();
          this.toast('Effekte reduziert');
        }
      } else {
        this.qualityChecked = Math.max(0, this.qualityChecked - dtReal * 0.5);
      }
    }
  };

  Game.prototype.render = function (dt) {
    var gfx = this.gfx;
    if (gfx.width !== Math.round(this.canvas.clientWidth * gfx.dpr) ||
        gfx.height !== Math.round(this.canvas.clientHeight * gfx.dpr)) {
      this.resize();
    }

    var dyn = this.dynBatch.clear();
    var glass = this.dynGlass.clear();
    var t = this.simTime;

    this.level.render(dyn, glass, t);

    /* Geist des Bestlaufs */
    if (this.ghostVisible && this.ghostPlay && (this.state === 'run' || this.state === 'dying')) {
      var gs = this.ghostPlay.at(this.runTime);
      if (gs && !gs.done) {
        var av = this.ghostAvatar;
        av.x = gs.x; av.y = gs.y; av.z = gs.z; av.yaw = gs.yaw;
        av.speed = gs.speed; av.grounded = gs.grounded;
        av.runCycle = this.runTime * 14;
        this.player.render.call(av, dyn, glass, t, { alpha: 0.34, mat: this.ghostMat, shadow: false });
      }
    }

    if (this.state !== 'dying') this.player.render(dyn, glass, t, null);
    this.particles.render(dyn, t);
    dyn.upload();
    glass.upload();

    var aspect = Math.max(0.2, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.cam.buildMatrices(aspect);
    gfx.render(this.cam.viewProj, this.cam.invViewProj, this.cam.pos, t,
      [this.staticBatch, dyn], [this.staticGlass, glass]);
  };

  /* -------------------------------------------------------------- Start */

  function boot() {
    var canvas = $('view');
    var game;
    try {
      game = new Game(canvas);
    } catch (err) {
      $('loading').hidden = true;
      $('fatal').hidden = false;
      $('fatalMsg').textContent = (err && err.message) || String(err);
      throw err;
    }
    root.GAME = game;
    $('loading').hidden = true;
    game.resize();

    function loop(now) {
      game.frame(now);
      root.requestAnimationFrame(loop);
    }
    root.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  root.MR = root.MR || {};
  root.MR.game = { Game: Game, formatTime: formatTime };
})(window);
