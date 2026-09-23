/* ---------------------------------------------------------------------
   Spielhuelle des Prototyps.

   Bewusst duenn: keine Menues, keine Medaillen, keine Statistik. Nur Uhr,
   Tempo, Dash-Vorrat - und ein Neustart, der sofort greift.

   Der wichtigste Unterschied zum grossen Spiel: ein Sturz beendet den Lauf
   nicht. Er setzt die Figur an der letzten festen Stelle ab und kostet
   Zeit. Wer jedesmal von vorne anfangen muss, uebt nur die ersten zehn
   Sekunden und sieht den Rest des Levels nie gut genug, um ihn zu moegen.
   Die Uhr bestraft den Fehler, nicht der Fortschrittsverlust.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var M = root.MR.math;
  var Move = root.MR.protoMove;
  var Track = root.MR.protoTrack;

  var FIXED = 1 / 120;
  var FALL_PENALTY = 1.5;      /* Sekunden Aufschlag je Sturz */
  var FALL_FREEZE = 0.35;      /* so lange ist die Figur nach dem Sturz starr */

  function $(id) { return document.getElementById(id); }

  function fmt(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  /* ------------------------------------------------------------- Spiel */

  function Proto(canvas) {
    this.canvas = canvas;
    this.gfx = root.MR.render.create(canvas);
    if (!this.gfx) throw new Error('WebGL2 ist nicht verfuegbar.');
    this.input = root.MR.input.create(canvas);
    if (this.gfx.shadowQuality) this.gfx.shadowQuality(this.input.isTouch ? 1024 : 2048);

    this.level = Track.build();
    this.player = Move.create(this.level);
    this.cam = Move.createCamera();

    this.staticChunks = [];
    this.glassChunks = [];
    this.dynBatch = this.gfx.createBatch(true);
    this.dynGlass = this.gfx.createBatch(true);

    this.state = 'ready';
    this.simTime = 0;
    this.runTime = 0;
    this.accumulator = 0;
    this.lastFrame = 0;
    this.freeze = 0;
    this.falls = 0;
    this.gems = 0;
    this.best = null;
    this.pendJump = false;
    this.pendDash = false;
    this.topSpeed = 0;
    this.slowTime = 0;
    this.splits = [];
    this.taught = false;      /* hat der Spieler die Rutschlandung schon einmal getroffen? */

    try {
      var raw = root.localStorage.getItem('gipfelsprint.proto.v1');
      if (raw) this.best = JSON.parse(raw).time || null;
    } catch (e) { /* ohne Speicher spielt es sich genauso */ }

    /* Der Renderer haelt Nebel, Himmel und Sonnenfarbe in gfx.env. Ohne
       das Setzen bleibt alles auf den Werkseinstellungen und das Bild war
       vollstaendig ausgewaschen. Der Prototyp hat nur eine Stimmung, also
       wird sie einmal gesetzt statt jedes Bild geblendet. */
    var want = this.level.envAt(0, 0), env = this.gfx.env;
    ['fogCol', 'zenith', 'horizon', 'skyCol', 'groundCol', 'sunCol'].forEach(function (k) {
      env[k][0] = want[k][0]; env[k][1] = want[k][1]; env[k][2] = want[k][2];
    });
    env.fogDensity = want.fogDensity;

    this.buildStatics();
    this.bindUi();
    this.reset();
  }

  /* Statik in Felder zerlegen, damit nicht jedes Bild alles gezeichnet wird. */
  Proto.prototype.chunk = function (list) {
    var CH = 260, map = Object.create(null), out = [], i;
    for (i = 0; i < list.length; i++) {
      var e = list[i], m = e.m;
      var key = Math.floor(m[12] / CH) + ':' + Math.floor(m[14] / CH);
      var bt = map[key];
      if (!bt) { bt = map[key] = this.gfx.createBatch(false); out.push(bt); }
      bt.add(e.mesh, m, e.mat);
    }
    for (i = 0; i < out.length; i++) out[i].upload().measure();
    return out;
  };

  Proto.prototype.buildStatics = function () {
    this.staticChunks = this.chunk(this.level.visuals);
    this.glassChunks = this.chunk(this.level.glass);
  };

  Proto.prototype.reset = function () {
    var lvl = this.level, p = this.player;
    lvl.reset();
    p.spawnAt(lvl.spawn);
    this.runTime = 0;
    this.accumulator = 0;
    this.freeze = 0;
    this.falls = 0;
    this.gems = 0;
    this.topSpeed = 0;
    this.slowTime = 0;
    this.splits = [];
    this.pendJump = false;
    this.pendDash = false;
    this.cam.manualTimer = 0;
    this.cam.yaw = lvl.spawn.yaw;
    this.cam.snap(p);
    this.state = 'run';
    $('protoResult').hidden = true;
    $('protoHelp').className = 'proto-help';
  };

  /* Sturz: an der letzten festen Stelle wieder absetzen, Zeit aufschlagen. */
  Proto.prototype.fall = function () {
    var p = this.player;
    this.falls++;
    this.runTime += FALL_PENALTY;
    this.freeze = FALL_FREEZE;
    p.x = p.lastGroundX;
    p.y = p.lastGroundY + 0.6;
    p.z = p.lastGroundZ;
    p.vx = p.vy = p.vz = 0;
    p.grounded = false;
    p.dashCharge = 1;
    p.jumps = 2;
    p.sliding = false;
    this.cam.shake = 0.35;
    this.flash();
  };

  Proto.prototype.flash = function () {
    var f = $('protoFlash');
    f.className = 'flash';
    void f.offsetWidth;
    f.className = 'flash hit';
  };

  Proto.prototype.finish = function () {
    this.state = 'finish';
    this.input.releasePointer();
    var t = this.runTime;
    var isBest = this.best === null || t < this.best;
    if (isBest) {
      this.best = t;
      try {
        root.localStorage.setItem('gipfelsprint.proto.v1', JSON.stringify({ time: t }));
      } catch (e) { /* egal */ }
    }
    $('protoResultTime').textContent = fmt(t);
    $('protoResultBest').textContent = this.best === null ? '--:--.--' : fmt(this.best);
    $('protoResultNew').hidden = !isBest;
    $('protoResultRows').innerHTML =
      '<div><span>Stuerze</span><b>' + this.falls + ' (+' + (this.falls * FALL_PENALTY).toFixed(1) + ' s)</b></div>' +
      '<div><span>Kristalle</span><b>' + this.gems + '/' + this.level.gems.length + '</b></div>' +
      '<div><span>Hoechsttempo</span><b>' + Math.round(this.topSpeed * 3.6) + ' km/h</b></div>' +
      '<div><span>langsamer als 20</span><b>' + this.slowTime.toFixed(1) + ' s</b></div>' +
      this.splits.map(function (s) {
        return '<div><span>' + s.name + '</span><b>' + fmt(s.t) + '</b></div>';
      }).join('');
    $('protoResult').hidden = false;
  };

  /* ------------------------------------------------------ Simulationsschritt */

  Proto.prototype.fixedStep = function (dt, cmd) {
    var p = this.player, lvl = this.level, i;
    this.simTime += dt;
    lvl.update(this.simTime, dt, p);

    if (this.freeze > 0) { this.freeze -= dt; return; }

    var ev = p.step(dt, cmd);
    for (i = 0; i < ev.length; i++) {
      if (ev[i] === 'slideland') { this.taught = true; this.cam.fovPunch = 0.3; this.cam.shake = 0.1; }
      else if (ev[i] === 'walljump') this.cam.fovPunch = 0.16;
      else if (ev[i] === 'dash') this.cam.fovPunch = 0.22;
    }

    if (p.speed < 20) this.slowTime += dt;
    if (p.topSpeed > this.topSpeed) this.topSpeed = p.topSpeed;

    /* Kristalle sind Dash-Ladungen. */
    for (i = 0; i < lvl.gems.length; i++) {
      var g = lvl.gems[i];
      if (g.taken) continue;
      var dx = g.x - p.x, dy = g.y - p.y, dz = g.z - p.z;
      if (dx * dx + dy * dy + dz * dz < 9) {
        g.taken = true;
        this.gems++;
        p.giveDash(1);
        this.cam.fovPunch = 0.06;
      }
    }

    /* Zwischenzeiten */
    for (i = 0; i < lvl.gates.length; i++) {
      var gt = lvl.gates[i];
      if (gt.passed) continue;
      var gx = gt.x - p.x, gz = gt.z - p.z;
      if (gx * gx + gz * gz < 64 && Math.abs(gt.y - p.y) < 12) {
        gt.passed = true;
        gt.flash = 1;
        this.splits.push({ name: gt.name, t: this.runTime });
        this.bigMsg(gt.name);
        /* Der Hilfetext hat seine Arbeit getan und verschwindet. */
        $('protoHelp').className = 'proto-help faded';
      }
    }

    /* Ziel */
    var f = lvl.finish;
    if (f) {
      var fx = f.x - p.x, fz = f.z - p.z;
      if (fx * fx + fz * fz < f.r * f.r && Math.abs(f.y - p.y) < 14) { this.finish(); return; }
    }

    /* Absturz */
    if (p.y < lvl.floorAt(p.x, p.z)) this.fall();
  };

  Proto.prototype.bigMsg = function (text) {
    var el = $('protoMsg');
    el.textContent = text;
    el.className = 'bigmsg';
    void el.offsetWidth;
    el.className = 'bigmsg show';
  };

  /* --------------------------------------------------------------- Bild */

  Proto.prototype.frame = function (now) {
    var dtReal = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0.016;
    this.lastFrame = now;

    var input = this.input;
    var cmd = { wishX: 0, wishZ: 0, slide: false, dash: false, jumpPressed: false, jumpHeld: false };

    if (this.state === 'run') {
      var ax = input.axis();
      this.cam.wish(ax.x, ax.y, this.wish || (this.wish = [0, 0]));
      cmd.wishX = this.wish[0];
      cmd.wishZ = this.wish[1];
      /* Am Handy rutscht der ganz durchgedrueckte Schiebeknopf. */
      cmd.slide = input.down('sprint') || (ax.fromTouch && ax.len > 0.8);
      /* Tastendruecke merken, bis ein Schritt sie verbraucht hat. */
      if (input.hit('dash')) this.pendDash = true;
      if (input.hit('jump')) this.pendJump = true;
      cmd.dash = !!this.pendDash;
      cmd.jumpPressed = !!this.pendJump;
      cmd.jumpHeld = input.down('jump');
    }

    if (this.state === 'run' || this.state === 'finish') {
      this.accumulator += dtReal;
      var steps = 0;
      while (this.accumulator >= FIXED && steps < 8) {
        this.accumulator -= FIXED;
        steps++;
        if (this.state === 'run') this.runTime += FIXED;
        this.fixedStep(FIXED, cmd);
        if (cmd.jumpPressed) this.pendJump = false;
        if (cmd.dash) this.pendDash = false;
        cmd.jumpPressed = false;
        cmd.dash = false;
      }
      if (steps >= 8) this.accumulator = 0;
    }

    this.cam.update(dtReal, this.player, input, this.level.world, false);
    this.updateHud();
    this.render();
    input.endFrame();
  };

  Proto.prototype.updateHud = function () {
    var p = this.player;
    $('protoTime').textContent = fmt(this.runTime);
    $('protoBest').textContent = this.best === null ? 'PB --:--.--' : 'PB ' + fmt(this.best);

    /* Tempo ist die wichtigste Zahl des Spiels, also steht sie gross da
       und faerbt sich, sobald man ueber der Laufgeschwindigkeit liegt. */
    var kmh = Math.round(p.speed * 3.6);
    var sv = $('protoSpeed');
    sv.textContent = kmh;
    sv.className = 'proto-speed__v' + (p.speed > 30 ? ' hot' : (p.speed > 20 ? ' warm' : ''));
    $('protoSpeedBar').style.width = Math.min(100, p.speed / 46 * 100) + '%';

    var dots = '';
    for (var i = 0; i < 3; i++) dots += '<i class="' + (i < p.dashCharge ? 'on' : '') + '"></i>';
    $('protoDash').innerHTML = dots;
    $('protoSlide').className = 'proto-slide' + (p.sliding ? ' on' : '');

    /* Die eine Sache, die man verstanden haben muss. Wer faellt und nicht
       rutscht, verschenkt die Haelfte des Spiels - und merkt es nicht, weil
       nichts passiert. Also sagt es das Spiel im Moment des Fallens, nicht
       in einem Hilfetext, und hoert damit auf, sobald es einmal gesessen
       hat. */
    var hint = $('protoTeach');
    var show = !this.taught && this.state === 'run' && !p.grounded && p.vy < -14 && !p.sliding;
    hint.className = 'proto-teach' + (show ? ' show' : '');
  };

  Proto.prototype.render = function () {
    var gfx = this.gfx;
    if (gfx.width !== Math.round(this.canvas.clientWidth * gfx.dpr) ||
        gfx.height !== Math.round(this.canvas.clientHeight * gfx.dpr)) {
      this.resize();
    }
    var dyn = this.dynBatch.clear();
    var glass = this.dynGlass.clear();
    var t = this.simTime;

    this.level.render(dyn, glass, t);
    this.player.render(dyn, glass, t, null);
    dyn.upload();
    glass.upload();

    var aspect = Math.max(0.2, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.cam.buildMatrices(aspect);
    var p = this.player;
    if (gfx.setShadowFocus) {
      gfx.setShadowFocus(p.x + Math.sin(this.cam.yaw) * 9, p.y + 1, p.z + Math.cos(this.cam.yaw) * 9);
    }
    var op = this.opaqueList || (this.opaqueList = []);
    op.length = 0;
    op.push.apply(op, this.staticChunks);
    op.push(dyn);
    var tr = this.glassList || (this.glassList = []);
    tr.length = 0;
    tr.push.apply(tr, this.glassChunks);
    tr.push(glass);
    gfx.render(this.cam.viewProj, this.cam.invViewProj, this.cam.pos, t, op, tr, op);
  };

  Proto.prototype.resize = function () {
    var cap = this.input.isTouch ? 1.2 : 2;
    this.gfx.resize(Math.min(root.devicePixelRatio || 1, cap));
  };

  Proto.prototype.bindUi = function () {
    var self = this;
    root.addEventListener('resize', function () { self.resize(); });
    $('protoRetry').addEventListener('click', function () { self.reset(); self.input.grabPointer(); });
    root.addEventListener('keydown', function (e) {
      if (e.code === 'KeyR') { self.reset(); self.input.grabPointer(); }
      if (e.code === 'Enter' && self.state === 'finish') { self.reset(); self.input.grabPointer(); }
    });
    self.canvas.addEventListener('pointerdown', function () {
      if (self.state === 'run') self.input.grabPointer();
    });
  };

  /* --------------------------------------------------------------- Start */

  function boot() {
    var canvas = $('view');
    var game;
    try {
      game = new Proto(canvas);
    } catch (err) {
      $('protoFatal').hidden = false;
      $('protoFatalMsg').textContent = String(err && err.message || err);
      return;
    }
    root.PROTO = game;
    $('protoLoading').hidden = true;
    game.resize();
    function loop(now) { game.frame(now); root.requestAnimationFrame(loop); }
    root.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
