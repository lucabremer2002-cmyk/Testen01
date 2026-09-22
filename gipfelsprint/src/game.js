/*
 * Spielablauf: Zustaende, feste Simulationsschritte, HUD, Bestzeiten.
 *
 * Die Physik laeuft mit konstant 120 Hz, unabhaengig von der Bildrate -
 * sonst waeren Zeiten zwischen zwei Rechnern nicht vergleichbar.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var Physics = root.MR.physics;
  var LevelMod = root.MR.level;
  var MAT = LevelMod.MAT;
  var Audio = root.MR.audio;

  var FIXED = 1 / 120;
  var STORE_KEY = 'gipfelsprint.record.v1';

  function $(id) { return document.getElementById(id); }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var ms = Math.floor(sec * 1000);
    var m = Math.floor(ms / 60000);
    var s = Math.floor(ms / 1000) % 60;
    var milli = ms % 1000;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + ('00' + milli).slice(-3);
  }

  function formatDelta(sec) {
    var sign = sec >= 0 ? '+' : '-';
    var a = Math.abs(sec);
    return sign + a.toFixed(2).replace('.', ',');
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
      var up = (opts.up || 0) * (0.3 + Math.random());
      this.spawn(
        x + (Math.random() - 0.5) * (opts.spread || 0.6),
        y + (Math.random() - 0.5) * (opts.spread || 0.6) * 0.5,
        z + (Math.random() - 0.5) * (opts.spread || 0.6),
        Math.cos(a) * sp + (opts.vx || 0), up + (opts.vy || 0), Math.sin(a) * sp + (opts.vz || 0),
        opts.life * (0.6 + Math.random() * 0.6),
        opts.size * (0.6 + Math.random() * 0.8),
        opts.color, opts.grav, opts.mesh
      );
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
    this.particles = new Particles(640);

    this.staticBatch = this.gfx.createBatch(false);
    this.staticGlass = this.gfx.createBatch(false);
    this.dynBatch = this.gfx.createBatch(true);
    this.dynGlass = this.gfx.createBatch(true);

    this.state = 'menu';
    this.simTime = 0;
    this.runTime = 0;
    this.deaths = 0;
    this.gems = 0;
    this.countdown = 0;
    this.respawnTimer = 0;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.qualityChecked = 0;
    this.splits = [];
    this.record = this.loadRecord();
    this.wish = [0, 0];
    this.checkpoint = this.level.spawn;

    this.buildStatics();
    this.bindUi();
    this.resetRun(true);
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

  /* ------------------------------------------------------- Bestzeiten */

  Game.prototype.loadRecord = function () {
    try {
      var raw = root.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var r = JSON.parse(raw);
      if (!r || typeof r.time !== 'number') return null;
      return r;
    } catch (e) { return null; }
  };

  Game.prototype.saveRecord = function (r) {
    try { root.localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (e) { /* privater Modus */ }
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
        '<div class="medal__dot"></div>' +
        '<div class="medal__name">' + m[i].name + '</div>' +
        '<div class="medal__time">' + formatTime(m[i].time) + '</div></div>';
    }
    return out;
  };

  /* ------------------------------------------------------------- UI */

  Game.prototype.bindUi = function () {
    var self = this;
    $('btnStart').addEventListener('click', function () { Audio.unlock(); self.startRun(); });
    $('btnRetry').addEventListener('click', function () { self.startRun(); });
    $('btnMenu').addEventListener('click', function () { self.toMenu(); });
    $('btnResume').addEventListener('click', function () { self.setPaused(false); });
    $('btnRestart').addEventListener('click', function () { self.startRun(); });
    $('btnQuit').addEventListener('click', function () { self.toMenu(); });

    this.canvas.addEventListener('mousedown', function () {
      if (self.state === 'run' || self.state === 'countdown') Audio.unlock();
    });

    this.input.onKey = function (code) {
      if (code === 'KeyM') {
        var muted = Audio.toggleMute();
        self.toast(muted ? 'Ton aus' : 'Ton an');
        return;
      }
      if (self.state === 'menu') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { Audio.unlock(); self.startRun(); }
        return;
      }
      if (code === 'KeyR') { self.startRun(); return; }
      if (self.state === 'finish') {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') self.startRun();
        if (code === 'Escape') self.toMenu();
        return;
      }
      if (code === 'Escape' || code === 'KeyP') { self.setPaused(self.state !== 'pause'); return; }
      if (code === 'KeyK' && self.state === 'run') { self.respawn(true); return; }
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === 'run') self.setPaused(true);
    });

    root.addEventListener('resize', function () { self.resize(); });
  };

  Game.prototype.updateMenu = function () {
    $('menuMedals').innerHTML = this.medalHtml();
    $('resultMedals').innerHTML = this.medalHtml();
    var el = $('menuBest');
    if (this.record) {
      var med = this.medalFor(this.record.time);
      el.textContent = 'Deine Bestzeit: ' + formatTime(this.record.time) +
        (med ? ' (' + med.name + ')' : '') +
        '  -  Kristalle: ' + (this.record.gems || 0) + '/' + this.level.gems.length;
    } else {
      el.textContent = 'Noch keine Bestzeit - Gold liegt bei ' + formatTime(this.level.medals[1].time) + '.';
    }
    $('gemTotal').textContent = this.level.gems.length;
    $('bestTime').textContent = this.record ? formatTime(this.record.time) : '--:--.---';
  };

  Game.prototype.toast = function (text, cls) {
    var el = document.createElement('div');
    el.className = 'toast' + (cls ? ' toast--' + cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    root.setTimeout(function () { el.remove(); }, 2200);
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
    this.resetRun(true);
    Audio.stopMusic();
  };

  Game.prototype.resetRun = function (toStart) {
    this.level.reset();
    this.level.update(0, 0, null);
    this.runTime = 0;
    this.deaths = 0;
    this.gems = 0;
    this.splits = [];
    this.checkpoint = this.level.spawn;
    this.player.spawnAt(this.level.spawn);
    this.player.events.length = 0;
    this.cam.manualTimer = 0;
    this.cam.snap(this.player);
    this.particles.n = 0;
    if (toStart) this.cam.yaw = this.level.spawn.yaw;
  };

  Game.prototype.startRun = function () {
    $('menu').hidden = true;
    $('result').hidden = true;
    $('pause').hidden = true;
    $('hud').hidden = false;
    this.resetRun(true);
    this.state = 'countdown';
    this.countdown = 3.2;
    this.countStep = -1;
    this.updateHud();
    Audio.startMusic();
    if (this.input.wantPointerLock && !this.input.mouse.locked && this.canvas.requestPointerLock) {
      /* Nur nach einem Klick erlaubt; scheitert es, bleibt Tastatursteuerung. */
      try { this.canvas.requestPointerLock(); } catch (e) { /* egal */ }
    }
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

  Game.prototype.finishRun = function () {
    this.state = 'finish';
    this.input.releasePointer();
    var time = this.runTime;
    var medal = this.medalFor(time);
    var isBest = !this.record || time < this.record.time;

    $('resultTime').textContent = formatTime(time);
    $('resultGems').textContent = this.gems + '/' + this.level.gems.length;
    $('resultDeaths').textContent = this.deaths;
    $('resultNew').hidden = !isBest;
    $('resultTitle').textContent = medal ? 'FINISH! ' + medal.name : 'FINISH!';

    var big = $('resultMedalBig');
    big.className = 'medal-big' + (medal ? ' show ' + medal.key : '');

    if (isBest) {
      this.record = {
        time: time, gems: this.gems, deaths: this.deaths,
        medal: medal ? medal.key : null, splits: this.splits.slice()
      };
      this.saveRecord(this.record);
    }
    $('resultBest').textContent = formatTime(this.record.time);
    $('resultMedals').innerHTML = this.medalHtml(time);
    $('result').hidden = false;
    this.updateMenu();

    Audio.sfx.finish(!!medal && (medal.key === 'gold' || medal.key === 'platin'));
    this.cam.shake = 0.5;
    var f = this.level.finish;
    for (var i = 0; i < 5; i++) {
      this.particles.burst(f.x + (Math.random() - 0.5) * 8, f.y + 4 + Math.random() * 5, f.z + (Math.random() - 0.5) * 8,
        26, { speed: 9, up: 6, life: 1.5, size: 0.42, color: [1, 0.85, 0.3], grav: -9, spread: 1.4, mesh: 'box' });
    }
  };

  /* ------------------------------------------------------------ Tod */

  Game.prototype.kill = function () {
    if (this.state !== 'run' || this.respawnTimer > 0) return;
    this.deaths++;
    this.respawnTimer = 0.32;
    Audio.sfx.hit();
    this.cam.shake = 0.6;
    $('vignette').classList.add('hit');
    var p = this.player;
    this.particles.burst(p.x, p.y, p.z, 26, {
      speed: 8, up: 7, life: 0.8, size: 0.34, color: [1, 0.45, 0.4], grav: -26, spread: 0.7, mesh: 'box'
    });
  };

  Game.prototype.respawn = function (manual) {
    var cp = this.checkpoint;
    this.player.spawnAt(cp);
    this.level.softReset();
    this.cam.snap(this.player);
    this.respawnTimer = 0;
    $('vignette').classList.remove('hit');
    if (manual) { this.deaths++; Audio.sfx.hit(); }
    this.particles.burst(this.player.x, this.player.y, this.player.z, 18, {
      speed: 6, up: 4, life: 0.5, size: 0.3, color: [0.6, 0.95, 1], grav: -12, spread: 0.6, mesh: 'box'
    });
  };

  /* ----------------------------------------------------- Simulation */

  Game.prototype.fixedStep = function (dt, cmd) {
    var p = this.player, lvl = this.level, i;
    this.simTime += dt;
    lvl.update(this.simTime, dt, p);

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawn(false);
      return;
    }

    p.events.length = 0;
    p.step(dt, cmd);

    /* --------------------------------------------------- Spielerereignisse */
    for (i = 0; i < p.events.length; i++) {
      var ev = p.events[i];
      if (ev === 'jump') {
        Audio.sfx.jump();
        this.particles.burst(p.x, p.y - 0.85, p.z, 7, { speed: 3.4, up: 1.5, life: 0.35, size: 0.22, color: [0.95, 0.95, 0.85], grav: -14, spread: 0.5 });
      } else if (ev === 'doublejump') {
        Audio.sfx.doubleJump();
        for (var d = 0; d < 14; d++) {
          var a = d / 14 * Math.PI * 2;
          this.particles.spawn(p.x + Math.cos(a) * 0.8, p.y - 0.6, p.z + Math.sin(a) * 0.8,
            Math.cos(a) * 4.5, 1.6, Math.sin(a) * 4.5, 0.4, 0.24, [0.55, 0.9, 1.0], -6, 'box');
        }
      } else if (ev === 'dash') {
        Audio.sfx.dash();
        this.cam.shake = 0.16;
        this.cam.fovPunch = 0.20;
        this.particles.burst(p.x, p.y, p.z, 12, { speed: 2.5, up: 0.5, life: 0.35, size: 0.3, color: [0.7, 0.95, 1.0], grav: -2, spread: 0.7 });
      } else if (ev === 'land' || ev === 'land_hard') {
        Audio.sfx.land(ev === 'land_hard');
        this.cam.landPunch = ev === 'land_hard' ? 0.55 : 0.22;
        if (ev === 'land_hard') this.cam.shake = 0.22;
        this.particles.burst(p.x, p.y - 0.85, p.z, ev === 'land_hard' ? 16 : 8, {
          speed: 5, up: 1.2, life: 0.4, size: 0.26, color: [0.9, 0.88, 0.78], grav: -20, spread: 0.7
        });
      } else if (ev === 'bounce') {
        Audio.sfx.bounce();
        this.cam.fovPunch = 0.10;
        this.particles.burst(p.x, p.y - 0.9, p.z, 18, { speed: 7, up: 3, life: 0.5, size: 0.3, color: [1, 0.5, 0.45], grav: -16, spread: 0.9 });
      } else if (ev === 'boost') {
        Audio.sfx.boost();
        this.cam.shake = 0.14;
        this.cam.fovPunch = 0.16;
        this.toast('TEMPO!', 'gold');
      } else if (ev === 'hazard') {
        this.kill();
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
        p.vy = 14.5;
        p.jumps = 1;
        p.dashCharge = 1;
        Audio.sfx.stomp();
        this.cam.shake = 0.2;
        this.particles.burst(e.x, e.y, e.z, 18, {
          speed: 6, up: 3, life: 0.6, size: 0.3, color: e.mat.accent, grav: -18, spread: 0.8
        });
      } else {
        this.kill();
        return;
      }
    }

    /* -------------------------------------------------------- Kristalle */
    for (i = 0; i < lvl.gems.length; i++) {
      var g = lvl.gems[i];
      if (g.taken) continue;
      var gx = p.x - g.x, gy = p.y - g.y, gz = p.z - g.z;
      if (gx * gx + gy * gy + gz * gz > 3.2 * 3.2) continue;
      g.taken = true;
      this.gems++;
      Audio.sfx.gem(this.gems);
      this.particles.burst(g.x, g.y, g.z, 20, {
        speed: 5, up: 3.5, life: 0.7, size: 0.26, color: [1, 0.85, 0.3], grav: -10, spread: 0.5
      });
      var pill = $('pillGems');
      pill.classList.remove('flash');
      void pill.offsetWidth;
      pill.classList.add('flash');
      if (this.gems === lvl.gems.length) this.toast('Alle Kristalle!', 'gold');
    }

    /* ------------------------------------------------------ Checkpoints */
    for (i = 0; i < lvl.checkpoints.length; i++) {
      var cp = lvl.checkpoints[i];
      if (cp.active) continue;
      var cdx = p.x - cp.x, cdz = p.z - cp.z, cdy = p.y - cp.y;
      if (Math.abs(cdy) > 6) continue;
      if (cdx * cdx + cdz * cdz > cp.w * cp.w) continue;
      cp.active = true;
      this.checkpoint = cp;
      this.splits[i] = this.runTime;
      Audio.sfx.checkpoint();
      this.showSplit(i);
      this.particles.burst(cp.x, cp.y + 2, cp.z, 24, {
        speed: 6, up: 5, life: 0.9, size: 0.3, color: [1, 0.85, 0.35], grav: -8, spread: 2.5
      });
    }

    /* ------------------------------------------------------------- Ziel */
    var f = lvl.finish;
    if (f) {
      var fdx = p.x - f.x, fdz = p.z - f.z;
      if (Math.abs(p.y - f.y) < 8 && fdx * fdx + fdz * fdz < f.r * f.r) {
        this.finishRun();
        return;
      }
    }

    /* ----------------------------------------------------------- Absturz */
    if (p.y < this.checkpoint.floorY) this.kill();
  };

  Game.prototype.showSplit = function (i) {
    var el = $('timerDelta');
    var best = this.record && this.record.splits ? this.record.splits[i] : null;
    var name = this.level.checkpoints[i].name;
    if (typeof best === 'number') {
      var d = this.runTime - best;
      el.textContent = name + '  ' + formatDelta(d);
      el.className = 'timer__delta show ' + (d <= 0 ? 'ahead' : 'behind');
      this.toast(d <= 0 ? 'Checkpoint ' + formatDelta(d) : 'Checkpoint ' + formatDelta(d), d <= 0 ? 'good' : '');
    } else {
      el.textContent = name;
      el.className = 'timer__delta show';
      this.toast('Checkpoint!', 'good');
    }
    var self = this;
    root.clearTimeout(this._splitTimer);
    this._splitTimer = root.setTimeout(function () { $('timerDelta').className = 'timer__delta'; }, 3200);
  };

  /* --------------------------------------------------------------- HUD */

  Game.prototype.updateHud = function () {
    var t = this.runTime;
    var el = $('timer');
    el.textContent = formatTime(t);
    var next = this.nextMedalFor(t);
    el.classList.toggle('hot', !!next && (next.key === 'platin' || next.key === 'gold'));
    $('nextMedal').textContent = next ? next.name : 'Ziel';
    $('gemCount').textContent = this.gems;
    var p = this.player;
    var kmh = Math.round(p.speed * 3.1);
    $('speedValue').textContent = kmh;
    $('speedFill').style.width = Math.min(100, p.speed / 40 * 100) + '%';
    $('abJump').className = 'ability' + (p.jumps > 0 && !p.grounded ? ' ready' : (p.grounded ? ' ready' : ' used'));
    $('abDash').className = 'ability' + (p.dashCharge > 0 && p.dashCooldown <= 0 ? ' ready' : ' used');
  };

  /* ------------------------------------------------------------- Frame */

  Game.prototype.resize = function () {
    var dpr = Math.min(root.devicePixelRatio || 1, this.lowQuality ? 1 : 2);
    this.gfx.resize(dpr);
  };

  Game.prototype.frame = function (now) {
    var dtReal = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;
    this.fps = this.fps * 0.92 + (1 / Math.max(dtReal, 0.001)) * 0.08;

    var input = this.input;
    var cmd = { wishX: 0, wishZ: 0, sprint: false, dash: false, jumpPressed: false, jumpHeld: false };
    var playing = this.state === 'run' || this.state === 'countdown';

    if (this.state === 'run') {
      var ax = input.axis();
      this.cam.wish(ax.x, ax.y, this.wish);
      cmd.wishX = this.wish[0];
      cmd.wishZ = this.wish[1];
      cmd.sprint = input.down('sprint');
      cmd.dash = input.hit('dash');
      cmd.jumpPressed = input.hit('jump');
      cmd.jumpHeld = input.down('jump');
    }

    if (this.state === 'countdown') {
      this.countdown -= dtReal;
      /* Kleiner Kameraflug: von schraeg vorne hinter die Figur. */
      var k = M.clamp(this.countdown / 3.2, 0, 1);
      this.cam.manualTimer = 0.2;
      this.cam.yaw = this.level.spawn.yaw + k * k * 1.6;
      this.cam.pitch = 0.2 + k * 0.1;
      this.cam.dist = 8.2 + k * 4.5;
      var stepIndex = Math.ceil(this.countdown / 0.8);
      if (stepIndex !== this.countStep) {
        this.countStep = stepIndex;
        if (stepIndex === 4) this.bigMessage('BEREIT?');
        else if (stepIndex === 3) { this.bigMessage('3'); Audio.sfx.countdown(false); }
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

    /* Kamera */
    if (this.state === 'menu') {
      this.cam.manualTimer = 1;
      this.cam.yaw += dtReal * 0.12;
      this.cam.update(dtReal, this.player, null, this.level.world);
    } else {
      this.cam.update(dtReal, this.player, this.state === 'run' ? input : null, this.level.world);
    }

    if (this.state === 'run' || this.state === 'countdown') this.updateHud();
    this.updateEnvironment(dtReal);
    if (playing) this.updateAmbient(dtReal);
    Audio.setMusicIntensity(Math.min(1, this.player.speed / 26));

    this.render(dtReal);
    input.endFrame();

    /* Bei schwacher Bildrate einmalig Effekte reduzieren. */
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

  /* Nebel, Himmel und Licht wandern weich von Zone zu Zone mit. */
  Game.prototype.updateEnvironment = function (dt) {
    var p = this.player;
    var want = this.level.envAt(p.x, p.z);
    var env = this.gfx.env;
    var k = 1 - Math.exp(-2.2 * dt);
    var keys = ['fogCol', 'zenith', 'horizon', 'skyCol', 'groundCol', 'sunCol'];
    for (var i = 0; i < keys.length; i++) {
      var a = env[keys[i]], bb = want[keys[i]];
      a[0] += (bb[0] - a[0]) * k;
      a[1] += (bb[1] - a[1]) * k;
      a[2] += (bb[2] - a[2]) * k;
    }
    env.fogDensity += (want.fogDensity - env.fogDensity) * k;
    this.ambient = want.ambient;
    this.zoneName = want.zone;
  };

  var AMBIENT = {
    pollen: { color: [1.0, 0.95, 0.6], size: 0.18, life: 2.6, rate: 0.16, rise: 0.5, spread: 26, grav: 0.4 },
    leaves: { color: [0.45, 0.72, 0.30], size: 0.30, life: 3.4, rate: 0.13, rise: -0.6, spread: 24, grav: -1.6 },
    spray: { color: [0.85, 0.96, 1.0], size: 0.22, life: 1.4, rate: 0.08, rise: 1.2, spread: 20, grav: -6 },
    dust: { color: [0.86, 0.78, 0.58], size: 0.20, life: 2.4, rate: 0.14, rise: 0.4, spread: 24, grav: 0.3 },
    snow: { color: [1.0, 1.0, 1.0], size: 0.24, life: 3.6, rate: 0.07, rise: -0.4, spread: 30, grav: -1.1 }
  };

  /* Staub beim Rennen, Blaetter im Wald, Schnee am Gipfel, Gischt am Wasser. */
  Game.prototype.updateAmbient = function (dt) {
    var p = this.player;
    var ps = this.particles;

    this._dustTimer = (this._dustTimer || 0) - dt;
    if (p.grounded && p.speed > 11 && this._dustTimer <= 0) {
      this._dustTimer = 0.07;
      var back = -1 / Math.max(p.speed, 0.01);
      ps.spawn(p.x + p.vx * back * 0.7, p.y - 0.82, p.z + p.vz * back * 0.7,
        (Math.random() - 0.5) * 2 - p.vx * 0.06, 1.4 + Math.random(), (Math.random() - 0.5) * 2 - p.vz * 0.06,
        0.38, 0.26, [0.88, 0.84, 0.74], -7, 'box');
    }

    var cfg = AMBIENT[this.ambient];
    if (cfg) {
      this._ambTimer = (this._ambTimer || 0) - dt;
      if (this._ambTimer <= 0) {
        this._ambTimer = cfg.rate;
        var a = Math.random() * Math.PI * 2;
        var d = 6 + Math.random() * cfg.spread;
        ps.spawn(p.x + Math.cos(a) * d, p.y + 3 + Math.random() * 14, p.z + Math.sin(a) * d,
          (Math.random() - 0.5) * 1.6, cfg.rise, (Math.random() - 0.5) * 1.6,
          cfg.life, cfg.size, cfg.color, cfg.grav, 'box');
      }
    }

    /* Gischt an Wasserfaellen in der Naehe */
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
    if (this.respawnTimer <= 0) this.player.render(dyn, glass, t, null);
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
