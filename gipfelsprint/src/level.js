/*
 * Levelbau.
 *
 * Der Parcours entsteht ueber einen "Cursor": jeder Abschnitt wird in
 * lokalen Koordinaten beschrieben (z = vorwaerts, x = seitlich, y = hoch)
 * und dann an der aktuellen Cursorposition/-drehung in die Welt gesetzt.
 * So laesst sich die Strecke wie ein Band um den Berg legen, ohne dass
 * man beim Entwerfen mit Weltkoordinaten rechnen muss.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var Physics = root.MR.physics;

  /* ----------------------------------------------------------- Material */

  function mat(color, accent, opts) {
    var o = opts || {};
    return {
      color: color,
      accent: accent || color,
      emissive: o.emissive || 0,
      pattern: o.pattern || 0,
      patternScale: o.patternScale || 1,
      alpha: o.alpha === undefined ? 1 : o.alpha
    };
  }

  var MAT = {
    grass: mat([0.42, 0.33, 0.22], [0.36, 0.72, 0.30], { pattern: 5, patternScale: 0.5 }),
    grassDark: mat([0.30, 0.24, 0.17], [0.24, 0.55, 0.24], { pattern: 5, patternScale: 0.5 }),
    rock: mat([0.47, 0.48, 0.52], [0.62, 0.64, 0.68], { pattern: 3, patternScale: 0.45 }),
    rockWarm: mat([0.52, 0.44, 0.38], [0.64, 0.56, 0.48], { pattern: 3, patternScale: 0.4 }),
    cliff: mat([0.33, 0.34, 0.39], [0.40, 0.42, 0.46], { pattern: 3, patternScale: 0.25 }),
    stone: mat([0.55, 0.57, 0.62], [0.74, 0.77, 0.82], { pattern: 1, patternScale: 0.5 }),
    wood: mat([0.44, 0.28, 0.16], [0.68, 0.45, 0.24], { pattern: 2, patternScale: 0.55 }),
    woodLight: mat([0.55, 0.37, 0.21], [0.80, 0.58, 0.33], { pattern: 2, patternScale: 0.7 }),
    snow: mat([0.72, 0.78, 0.86], [0.97, 0.99, 1.0], { pattern: 3, patternScale: 0.3 }),
    ice: mat([0.45, 0.72, 0.85], [0.80, 0.95, 1.0], { emissive: 0.12, pattern: 6, patternScale: 2 }),
    caveRock: mat([0.24, 0.24, 0.31], [0.32, 0.33, 0.42], { pattern: 3, patternScale: 0.5 }),
    caveGlow: mat([0.25, 0.85, 0.95], [0.75, 1.0, 1.0], { emissive: 0.85, pattern: 6, patternScale: 3 }),
    water: mat([0.10, 0.45, 0.72], [0.55, 0.88, 1.0], { pattern: 4, patternScale: 0.35, alpha: 0.78 }),
    fall: mat([0.55, 0.82, 0.95], [1.0, 1.0, 1.0], { pattern: 8, patternScale: 0.16, alpha: 0.62, emissive: 0.25 }),
    leaf: mat([0.16, 0.45, 0.22], [0.34, 0.72, 0.32], { pattern: 5, patternScale: 0.9 }),
    leafWarm: mat([0.48, 0.42, 0.13], [0.82, 0.68, 0.22], { pattern: 5, patternScale: 0.9 }),
    trunk: mat([0.30, 0.20, 0.12], [0.40, 0.28, 0.17], { pattern: 2, patternScale: 1.6 }),
    gem: mat([0.95, 0.72, 0.10], [1.0, 0.96, 0.62], { emissive: 0.8, pattern: 6, patternScale: 2.4 }),
    bounce: mat([0.78, 0.18, 0.24], [1.0, 0.45, 0.42], { emissive: 0.25 }),
    bounceStem: mat([0.92, 0.90, 0.82], [1.0, 1.0, 0.96]),
    boost: mat([0.10, 0.14, 0.26], [1.0, 0.82, 0.22], { pattern: 9, patternScale: 0.35, emissive: 0.55 }),
    hazard: mat([0.36, 0.16, 0.42], [0.85, 0.35, 0.95], { emissive: 0.5, pattern: 6, patternScale: 2 }),
    enemy: mat([0.45, 0.25, 0.65], [0.72, 0.48, 0.95], { emissive: 0.1 }),
    enemyAlt: mat([0.70, 0.30, 0.22], [0.95, 0.55, 0.35], { emissive: 0.1 }),
    eye: mat([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], { emissive: 0.4 }),
    pupil: mat([0.05, 0.05, 0.1], [0.05, 0.05, 0.1]),
    ringOff: mat([0.25, 0.55, 0.75], [0.55, 0.90, 1.0], { emissive: 0.6 }),
    ringOn: mat([0.95, 0.70, 0.12], [1.0, 0.95, 0.55], { emissive: 1.0 }),
    flag: mat([0.90, 0.20, 0.25], [1.0, 0.55, 0.45], { emissive: 0.2 }),
    flagAlt: mat([0.98, 0.98, 1.0], [1.0, 1.0, 1.0], { emissive: 0.15 }),
    cloud: mat([0.86, 0.90, 0.97], [1.0, 1.0, 1.0], { emissive: 0.08 }),
    far: mat([0.33, 0.43, 0.58], [0.72, 0.80, 0.92], { pattern: 3, patternScale: 0.04 }),
    shadow: mat([0.02, 0.05, 0.09], null, { pattern: 7, alpha: 0.4 }),
    rope: mat([0.28, 0.22, 0.16], [0.36, 0.28, 0.20]),
    goal: mat([0.95, 0.78, 0.18], [1.0, 0.97, 0.70], { emissive: 0.75 })
  };

  /* ------------------------------------------------------------ Builder */

  function Builder() {
    this.world = new Physics.World();
    this.visuals = [];        /* {mesh, m, mat} - einmalig hochgeladen */
    this.glass = [];          /* transparente Deko */
    this.ents = [];           /* bewegliche Objekte mit update/render */
    this.gems = [];
    this.enemies = [];
    this.checkpoints = [];
    this.spine = [];          /* grobe Wegpunkte fuer Laengenberechnung */
    this.cursor = { x: 0, y: 0, z: 0, yaw: 0 };
    this.rand = M.rng(20260921);
    this.finish = null;
    this.start = null;
  }

  Builder.prototype.toWorldX = function (lx, lz) {
    return this.cursor.x + Math.cos(this.cursor.yaw) * lx + Math.sin(this.cursor.yaw) * lz;
  };
  Builder.prototype.toWorldZ = function (lx, lz) {
    return this.cursor.z - Math.sin(this.cursor.yaw) * lx + Math.cos(this.cursor.yaw) * lz;
  };
  Builder.prototype.toWorld = function (lx, ly, lz, out) {
    out = out || [0, 0, 0];
    out[0] = this.toWorldX(lx, lz);
    out[1] = this.cursor.y + ly;
    out[2] = this.toWorldZ(lx, lz);
    return out;
  };

  Builder.prototype.advance = function (len) {
    this.cursor.x += Math.sin(this.cursor.yaw) * len;
    this.cursor.z += Math.cos(this.cursor.yaw) * len;
    return this;
  };
  Builder.prototype.turn = function (deg) { this.cursor.yaw += deg * Math.PI / 180; return this; };
  Builder.prototype.lift = function (dy) { this.cursor.y += dy; return this; };
  Builder.prototype.mark = function (lx, ly, lz) {
    var p = this.toWorld(lx, ly, lz, [0, 0, 0]);
    this.spine.push(p);
    return this;
  };

  /* Sichtbares Objekt ohne Kollision. */
  Builder.prototype.deco = function (mesh, lx, ly, lz, sx, sy, sz, material, rot) {
    var m = new Float32Array(16);
    var x = this.toWorldX(lx, lz), z = this.toWorldZ(lx, lz), y = this.cursor.y + ly;
    if (rot && (rot[0] || rot[2])) {
      m4.compose(m, x, y, z, rot[0], this.cursor.yaw + (rot[1] || 0), rot[2], sx, sy, sz);
    } else {
      m4.composeYaw(m, x, y, z, this.cursor.yaw + (rot ? rot[1] : 0), sx, sy, sz);
    }
    var entry = { mesh: mesh, m: m, mat: material };
    if (material.alpha < 1) this.glass.push(entry); else this.visuals.push(entry);
    return entry;
  };

  /* Quader mit Kollision; Position ist der Mittelpunkt. */
  Builder.prototype.block = function (lx, ly, lz, w, h, d, material, opts) {
    opts = opts || {};
    var c = this.world.add({
      x: this.toWorldX(lx, lz), y: this.cursor.y + ly, z: this.toWorldZ(lx, lz),
      hx: w / 2, hy: h / 2, hz: d / 2,
      yaw: this.cursor.yaw + (opts.yaw || 0),
      tag: opts.tag || 'solid',
      dynamic: !!opts.dynamic,
      noCollide: !!opts.noCollide,
      trigger: !!opts.trigger,
      data: opts.data || null
    });
    if (material) {
      var m = new Float32Array(16);
      m4.composeYaw(m, c.x, c.y, c.z, c.yaw, w, h, d);
      var entry = { mesh: opts.mesh || 'box', m: m, mat: material, col: c };
      c.visual = entry;
      if (!opts.dynamic) {
        if (material.alpha < 1) this.glass.push(entry); else this.visuals.push(entry);
      }
    }
    return c;
  };

  /* Plattform; ly ist die Oberkante, das ist beim Entwerfen viel praktischer. */
  Builder.prototype.plat = function (lx, ly, lz, w, d, material, opts) {
    opts = opts || {};
    var t = opts.thickness || 1.4;
    return this.block(lx, ly - t / 2, lz, w, t, d, material || MAT.grass, opts);
  };

  root.MR = root.MR || {};
  root.MR.level = { MAT: MAT, mat: mat, Builder: Builder };
})(window);

/*
 * Bewegliche Objekte, Gegner, Sammelkristalle und Deko.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var L = root.MR.level;
  var MAT = L.MAT;
  var B = L.Builder.prototype;
  var TMP = new Float32Array(16);

  function emitCol(batch, c, overrideMat) {
    m4.composeYaw(TMP, c.x, c.y, c.z, c.yaw, c.hx * 2, c.hy * 2, c.hz * 2);
    batch.add(c.visual.mesh, TMP, overrideMat || c.visual.mat);
  }

  B.dirX = function (lx, lz) { return Math.cos(this.cursor.yaw) * lx + Math.sin(this.cursor.yaw) * lz; };
  B.dirZ = function (lx, lz) { return -Math.sin(this.cursor.yaw) * lx + Math.cos(this.cursor.yaw) * lz; };

  /* ------------------------------------------------- bewegliche Plattform */

  B.mover = function (lx, ly, lz, w, d, o) {
    var c = this.plat(lx, ly, lz, w, d, o.mat || MAT.woodLight, { dynamic: true, thickness: o.thickness || 1.2 });
    var bx = c.x, by = c.y, bz = c.z;
    var ax = this.dirX(o.dx || 0, o.dz || 0);
    var az = this.dirZ(o.dx || 0, o.dz || 0);
    var ay = o.dy || 0;
    var period = o.period || 4;
    var phase = o.phase || 0;
    var ent = {
      col: c,
      kind: 'mover',
      update: function (t) {
        var u = (t / period + phase) % 1;
        var s = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
        c.x = bx + ax * s;
        c.y = by + ay * s;
        c.z = bz + az * s;
      },
      render: function (batch) { emitCol(batch, c); },
      reset: function () { this.update(0); c.px = c.x; c.py = c.y; c.pz = c.z; }
    };
    /* Schienen als Orientierungshilfe */
    if (o.rail !== false) {
      this.deco('box', lx + (o.dx || 0) * 0.5, ly - 1.4, lz + (o.dz || 0) * 0.5,
        Math.abs(o.dx || 0) + 0.4, 0.22, Math.abs(o.dz || 0) + 0.4, MAT.rock);
    }
    this.ents.push(ent);
    return ent;
  };

  /* ------------------------------------------------- kreisende Plattform */

  B.rotator = function (lx, ly, lz, o) {
    var count = o.count || 3;
    var radius = o.radius || 7;
    var period = o.period || 7;
    var cx = this.toWorldX(lx, lz), cz = this.toWorldZ(lx, lz), cy = this.cursor.y + ly;
    var arms = [];
    for (var i = 0; i < count; i++) {
      var c = this.plat(lx, ly, lz, o.w || 4.5, o.d || 4.5, o.mat || MAT.stone, { dynamic: true });
      arms.push({ col: c, off: i / count });
    }
    /* Mittelsaeule */
    this.deco('cylinder', lx, ly - 7, lz, 2.6, 16, 2.6, MAT.rockWarm);
    this.deco('cone', lx, ly + 1.6, lz, 3.4, 2.2, 3.4, MAT.leaf);
    var dir = o.dir === undefined ? 1 : o.dir;
    var ent = {
      kind: 'rotator',
      arms: arms,
      update: function (t) {
        for (var i = 0; i < arms.length; i++) {
          var a = (t / period + arms[i].off) * Math.PI * 2 * dir;
          var c = arms[i].col;
          c.x = cx + Math.cos(a) * radius;
          c.z = cz + Math.sin(a) * radius;
          c.y = cy - c.hy;
          c.yaw = -a;
          c.cos = Math.cos(c.yaw);
          c.sin = Math.sin(c.yaw);
        }
      },
      render: function (batch) {
        for (var i = 0; i < arms.length; i++) emitCol(batch, arms[i].col);
      },
      reset: function () {
        this.update(0);
        for (var i = 0; i < arms.length; i++) {
          var c = arms[i].col;
          c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw;
        }
      }
    };
    this.ents.push(ent);
    return ent;
  };

  /* ------------------------------------------------------ Drehender Balken */

  B.spinner = function (lx, ly, lz, o) {
    var len = o.len || 9;
    var c = this.block(lx, ly, lz, len, o.h || 0.9, o.thick || 0.9, o.mat || MAT.wood, { dynamic: true });
    var period = o.period || 3.2;
    var phase = o.phase || 0;
    var baseYaw = this.cursor.yaw;
    var cx = c.x, cz = c.z;
    this.deco('cylinder', lx, ly - 2.4, lz, 1.1, 5, 1.1, MAT.rockWarm);
    var dir = o.dir === undefined ? 1 : o.dir;
    var ent = {
      kind: 'spinner',
      col: c,
      update: function (t) {
        c.yaw = baseYaw + (t / period + phase) * Math.PI * 2 * dir;
        c.cos = Math.cos(c.yaw);
        c.sin = Math.sin(c.yaw);
        c.x = cx; c.z = cz;
      },
      render: function (batch) { emitCol(batch, c); },
      reset: function () { this.update(0); c.pyaw = c.yaw; }
    };
    this.ents.push(ent);
    return ent;
  };

  /* -------------------------------------------------------- Pendel (Stamm) */

  B.pendulum = function (lx, ly, lz, o) {
    var swing = o.swing || 7;
    var period = o.period || 2.8;
    var phase = o.phase || 0;
    var c = this.block(lx, ly, lz, o.w || 1.4, o.h || 1.4, o.d || 6, o.mat || MAT.wood, { dynamic: true, yaw: o.yaw || 0 });
    var bx = c.x, bz = c.z, by = c.y;
    var ax = this.dirX(swing, 0), az = this.dirZ(swing, 0);
    var anchorY = this.cursor.y + ly + (o.rope || 8);
    var ropeX = this.toWorldX(lx, lz), ropeZ = this.toWorldZ(lx, lz);
    var rope = { mesh: 'cylinder', m: new Float32Array(16), mat: MAT.rope };
    this.visuals.push(rope);
    var ent = {
      kind: 'pendulum',
      col: c,
      update: function (t) {
        var s = Math.sin((t / period + phase) * Math.PI * 2);
        c.x = bx + ax * s;
        c.z = bz + az * s;
        c.y = by + (1 - Math.cos(Math.asin(Math.max(-1, Math.min(1, s * swing / (o.rope || 8)))))) * 1.5;
        var dx = c.x - ropeX, dz = c.z - ropeZ, dy = anchorY - c.y;
        var len = Math.hypot(dx, dy, dz);
        m4.compose(rope.m, (ropeX + c.x) / 2, (anchorY + c.y) / 2, (ropeZ + c.z) / 2,
          Math.atan2(Math.hypot(dx, dz), dy) * (dz >= 0 ? 1 : 1), Math.atan2(dx, dz), 0, 0.28, len, 0.28);
      },
      render: function (batch) { emitCol(batch, c); },
      reset: function () { this.update(0); c.px = c.x; c.pz = c.z; c.py = c.y; }
    };
    this.ents.push(ent);
    return ent;
  };

  /* ------------------------------------------------- broeckelnde Plattform */

  B.crumble = function (lx, ly, lz, w, d, o) {
    o = o || {};
    var c = this.plat(lx, ly, lz, w, d, o.mat || MAT.stone, { dynamic: true, thickness: 1.0 });
    var bx = c.x, by = c.y, bz = c.z;
    var ent = {
      kind: 'crumble',
      col: c,
      state: 0,          /* 0 stabil, 1 wackelt, 2 faellt, 3 weg */
      timer: 0,
      update: function (t, dt, player) {
        if (this.state === 0) {
          if (player && player.groundCollider === c) { this.state = 1; this.timer = 0.42; }
        } else if (this.state === 1) {
          this.timer -= dt;
          c.x = bx + Math.sin(this.timer * 60) * 0.09;
          c.z = bz + Math.cos(this.timer * 47) * 0.09;
          if (this.timer <= 0) { this.state = 2; this.timer = 0; this.vy = 0; }
        } else if (this.state === 2) {
          this.vy = (this.vy || 0) - 34 * dt;
          c.y += this.vy * dt;
          c.active = false;
          if (c.y < by - 26) { this.state = 3; this.timer = 1.6; }
        } else {
          this.timer -= dt;
          if (this.timer <= 0) this.reset();
        }
      },
      render: function (batch) {
        if (this.state === 3) return;
        emitCol(batch, c, this.state === 1 ? MAT.rockWarm : null);
      },
      reset: function () {
        this.state = 0; this.timer = 0; this.vy = 0;
        c.x = bx; c.y = by; c.z = bz;
        c.px = bx; c.py = by; c.pz = bz;
        c.active = true;
      }
    };
    this.ents.push(ent);
    return ent;
  };

  /* ---------------------------------------------------------- Steinschlag */

  B.fallingRock = function (lx, ly, lz, o) {
    o = o || {};
    var size = o.size || 2.2;
    var c = this.block(lx, ly, lz, size, size, size, MAT.rock, { dynamic: true, tag: 'hazard', mesh: 'blob' });
    c.visual.mesh = 'blob';
    var bx = c.x, by = c.y, bz = c.z;
    var groundY = this.cursor.y + (o.groundY === undefined ? ly - 14 : o.groundY);
    var period = o.period || 3.0;
    var phase = o.phase || 0;
    var ent = {
      kind: 'rock',
      col: c,
      splash: 0,
      update: function (t) {
        var u = ((t / period + phase) % 1) * period;
        var hold = period * 0.28;
        if (u < hold) {
          c.x = bx + Math.sin(u * 40) * 0.08;
          c.y = by;
          this.splash = 0;
        } else {
          var f = u - hold;
          c.x = bx;
          c.y = by - 0.5 * 40 * f * f;
          if (c.y <= groundY) { c.y = groundY; this.splash = 1; }
        }
        c.z = bz;
        c.active = c.y > groundY + 0.01;
      },
      render: function (batch) {
        if (c.y <= groundY + 0.01) return;
        m4.compose(TMP, c.x, c.y, c.z, c.y * 0.3, c.y * 0.2, 0, c.hx * 2, c.hy * 2, c.hz * 2);
        batch.add('blob', TMP, MAT.rock);
      },
      reset: function () { this.update(0); }
    };
    this.ents.push(ent);
    return ent;
  };

  /* ------------------------------------------------------------- Sprungpilz */

  B.bouncePad = function (lx, ly, lz, o) {
    o = o || {};
    var r = o.r || 2.6;
    /* Der Pilz ragt ein Stueck ueber die Plattform hinaus - sonst liegt seine
       Oberkante exakt auf Fusshoehe und wird beim Darueberlaufen nie beruehrt.
       0,25 liegt unter dem Kapselradius, bremst also nicht. */
    var c = this.block(lx, ly - 0.25, lz, r * 2, 1.0, r * 2, null, { tag: 'bounce' });
    c.power = o.power || 22;
    this.deco('cylinder', lx, ly - 1.5, lz, r * 0.5, 2.4, r * 0.5, MAT.bounceStem);
    this.deco('sphere', lx, ly - 0.1, lz, r * 2, 1.7, r * 2, MAT.bounce);
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2;
      this.deco('sphere', lx + Math.cos(a) * r * 0.5, ly + 0.3, lz + Math.sin(a) * r * 0.5, 0.5, 0.3, 0.5, MAT.bounceStem);
    }
    return c;
  };

  /* --------------------------------------------------------- Tempo-Feld */

  B.boostPad = function (lx, ly, lz, w, d, o) {
    o = o || {};
    var c = this.plat(lx, ly + 0.12, lz, w, d, MAT.boost, { tag: 'boost', thickness: 0.6 });
    c.boostDirX = this.dirX(0, 1);
    c.boostDirZ = this.dirZ(0, 1);
    c.boostSpeed = o.speed || 30;
    for (var i = 0; i < 3; i++) {
      this.deco('box', lx, ly + 0.2, lz - d / 2 + 1.6 + i * (d - 3) / 2, w * 0.55, 0.12, 0.9, MAT.goal, [0, 0, 0]);
      this.deco('box', lx, ly + 0.2, lz - d / 2 + 2.3 + i * (d - 3) / 2, w * 0.3, 0.12, 0.9, MAT.goal, [0, 0, 0]);
    }
    return c;
  };

  /* ------------------------------------------------------------- Kristall */

  B.gem = function (lx, ly, lz, o) {
    o = o || {};
    var p = this.toWorld(lx, ly, lz, [0, 0, 0]);
    var g = { x: p[0], y: p[1], z: p[2], taken: false, spin: this.rand() * 6.28, hint: o.hint || '' };
    this.gems.push(g);
    return g;
  };

  /* ----------------------------------------------------------- Checkpoint */

  B.checkpoint = function (lx, ly, lz, o) {
    o = o || {};
    var p = this.toWorld(lx, ly, lz, [0, 0, 0]);
    var cp = {
      x: p[0], y: p[1], z: p[2],
      yaw: this.cursor.yaw,
      name: o.name || ('Checkpoint ' + (this.checkpoints.length + 1)),
      index: this.checkpoints.length,
      active: false,
      floorY: p[1] - (o.floor || 26),
      w: o.w || 9
    };
    this.checkpoints.push(cp);
    return cp;
  };

  /* -------------------------------------------------------------- Gegner */

  B.enemy = function (lx, ly, lz, o) {
    o = o || {};
    var p = this.toWorld(lx, ly, lz, [0, 0, 0]);
    var range = o.range || 6;
    var e = {
      x: p[0], y: p[1], z: p[2],
      hx: this.dirX(o.axis === 'z' ? 0 : range, o.axis === 'z' ? range : 0),
      hz: this.dirZ(o.axis === 'z' ? 0 : range, o.axis === 'z' ? range : 0),
      baseX: p[0], baseY: p[1], baseZ: p[2],
      r: o.r || 0.95,
      speed: o.speed || 0.35,
      phase: o.phase || this.rand(),
      alive: true,
      hopPhase: this.rand() * 6.28,
      mat: o.alt ? MAT.enemyAlt : MAT.enemy,
      squash: 0,
      yaw: 0
    };
    this.enemies.push(e);
    return e;
  };

  /* ------------------------------------------------------------ Dekoration */

  B.tree = function (lx, ly, lz, s, warm) {
    var r = this.rand;
    this.deco('cylinder', lx, ly + 2.2 * s, lz, 0.75 * s, 4.6 * s, 0.75 * s, MAT.trunk);
    var leaf = warm ? MAT.leafWarm : MAT.leaf;
    this.deco('cone', lx, ly + 5.4 * s, lz, 5.2 * s, 5.0 * s, 5.2 * s, leaf);
    this.deco('cone', lx, ly + 7.8 * s, lz, 3.9 * s, 4.2 * s, 3.9 * s, leaf);
    this.deco('cone', lx, ly + 9.9 * s, lz, 2.6 * s, 3.4 * s, 2.6 * s, leaf);
    if (r() > 0.6) this.deco('sphere', lx + (r() - 0.5) * 3 * s, ly + 0.3, lz + (r() - 0.5) * 3 * s, 1.6 * s, 1.0 * s, 1.6 * s, MAT.leaf);
  };

  B.bush = function (lx, ly, lz, s) {
    this.deco('sphere', lx, ly + 0.5 * s, lz, 2.4 * s, 1.8 * s, 2.4 * s, MAT.leaf);
    this.deco('sphere', lx + 1.1 * s, ly + 0.2 * s, lz + 0.6 * s, 1.6 * s, 1.3 * s, 1.6 * s, MAT.leaf);
  };

  B.rocks = function (lx, ly, lz, s, n) {
    var r = this.rand;
    for (var i = 0; i < (n || 3); i++) {
      var a = r() * 6.28, d = r() * 2.4 * s;
      this.deco('blob', lx + Math.cos(a) * d, ly + 0.2 * s + r() * 0.5, lz + Math.sin(a) * d,
        (0.9 + r() * 1.6) * s, (0.8 + r() * 1.3) * s, (0.9 + r() * 1.5) * s, MAT.rock,
        [r() * 0.5, r() * 6.28, r() * 0.5]);
    }
  };

  /* Felsmasse unter dem Weg, damit der Parcours am Berg klebt. */
  B.mass = function (lx, ly, lz, w, h, d, material, yaw) {
    this.deco('pillar', lx, ly - h / 2, lz, w * 1.02, h, d * 1.02, material || MAT.cliff, [0, yaw || 0, 0]);
    this.block(lx, ly - h / 2, lz, w * 0.8, h, d * 0.8, null, { noCollide: true, yaw: yaw || 0 });
    if (w > 6 && this.rand() > 0.35) {
      this.deco('blob', lx + w * 0.42, ly - 1.4, lz + (this.rand() - 0.5) * d * 0.5,
        w * 0.4, 3.2, w * 0.4, MAT.rock, [0.2, this.rand() * 6.28, 0.1]);
    }
  };

  B.waterfall = function (lx, ly, lz, w, h, o) {
    o = o || {};
    this.deco('box', lx, ly - h / 2, lz, w, h, 0.6, MAT.fall);
    this.deco('box', lx, ly - h / 2, lz + 0.5, w * 0.7, h, 0.6, MAT.fall);
    this.deco('sphere', lx, ly - h + 0.4, lz, w * 1.5, 1.6, w * 1.2, MAT.fall);
    if (o.top !== false) this.deco('box', lx, ly + 0.2, lz, w * 1.1, 0.5, 1.6, MAT.water);
  };

  B.crystalCluster = function (lx, ly, lz, s) {
    var r = this.rand;
    for (var i = 0; i < 4; i++) {
      var a = r() * 6.28;
      this.deco('crystal', lx + Math.cos(a) * s * 0.7, ly + s * (0.7 + r() * 0.6), lz + Math.sin(a) * s * 0.7,
        s * (0.4 + r() * 0.3), s * (1.6 + r() * 1.2), s * (0.4 + r() * 0.3), MAT.caveGlow,
        [(r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5]);
    }
  };

  /* Tunnelabschnitt: zwei Waende und eine Decke aus Fels. */
  B.caveShell = function (lx, ly, lz, w, h, d) {
    var t = 4;
    this.block(lx - w / 2 - t / 2, ly + h / 2 - 1, lz, t, h + 6, d, MAT.caveRock);
    this.block(lx + w / 2 + t / 2, ly + h / 2 - 1, lz, t, h + 6, d, MAT.caveRock);
    this.block(lx, ly + h + 1.2, lz, w + t * 2, 3.2, d, MAT.caveRock);
    for (var i = 0; i < 3; i++) {
      var f = (i + 0.5) / 3;
      this.deco('blob', lx - w / 2 + 1, ly + h * 0.75, lz - d / 2 + f * d, 5, 4, 5, MAT.caveRock, [0, i, 0.2]);
      this.deco('blob', lx + w / 2 - 1, ly + h * 0.45, lz - d / 2 + f * d, 5, 5, 5, MAT.caveRock, [0, i + 2, -0.2]);
      this.deco('crystal', lx + (i % 2 ? 1 : -1) * (w / 2 - 1.5), ly + h - 1.2, lz - d / 2 + f * d,
        1.0, 2.6, 1.0, MAT.caveGlow, [Math.PI, i, 0]);
    }
  };

  /* Torbogen aus zwei Pfosten und einem Querbalken. */
  B.arch = function (lx, ly, lz, w, h, material) {
    this.deco('box', lx - w / 2, ly + h / 2, lz, 1.0, h, 1.0, material || MAT.wood);
    this.deco('box', lx + w / 2, ly + h / 2, lz, 1.0, h, 1.0, material || MAT.wood);
    this.deco('box', lx, ly + h + 0.4, lz, w + 2.2, 1.0, 1.4, material || MAT.wood);
  };

  root.MR.level.emitCol = emitCol;
})(window);

/*
 * Der Parcours selbst: sechs Abschnitte, die ohne Pause ineinander laufen.
 * Reihenfolge nach Gefuehl: Laufen -> Sprung -> Plattform -> Gegner ->
 * schmaler Pfad -> Tempo -> Sprungkombination -> Checkpoint -> haerter.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var L = root.MR.level;
  var MAT = L.MAT;

  /*
   * Abstaende sind auf die gemessene Reichweite der Figur abgestimmt:
   *   Laufsprung 11,7 m | Sprintsprung 15,6 m | Doppelsprung 25,6 m
   *   Dash-Sprung 24,3 m | Dash + Doppelsprung 37 m (Expertenrouten)
   * Luecken bis 9 m sind Tempo-Huepfer, 10-14 m verlangen Sprint,
   * ab 16 m braucht es den Doppelsprung.
   */

  /* ------------------------------------------------ 1 - Talstation */

  function sectionValley(b) {
    b.start = { x: b.toWorldX(0, 8), y: b.cursor.y + 0.1, z: b.toWorldZ(0, 8), yaw: b.cursor.yaw };
    b.plat(0, 0, 10, 20, 28, MAT.grass, { thickness: 2.4 });   /* -4 .. 24 */
    b.mass(0, -2.4, 10, 18, 40, 26);
    b.arch(0, 0, 18, 11, 6.5, MAT.wood);
    b.deco('box', 0, 7.5, 18, 14, 1.5, 0.5, MAT.flagAlt);
    b.deco('box', 0, 7.5, 18, 9, 1.0, 0.56, MAT.flag);
    b.tree(-8, 0, 4, 1.0);
    b.tree(8.2, 0, 10, 1.15);
    b.tree(-8.5, 0, 14, 0.9, true);
    b.bush(6.5, 0, 2, 1.0);
    b.rocks(-6, 0, 9, 1.0, 3);
    b.mark(0, 0, 8);

    /* Bach unter den Trittsteinen - hineinfallen kostet Zeit. */
    b.block(0, -4.2, 54, 38, 1.6, 66, MAT.water, { tag: 'hazard', trigger: true });
    b.mass(0, -4.8, 54, 34, 26, 62, MAT.rockWarm);

    b.plat(3, 0.3, 37, 9, 14, MAT.grass);     /* 30 .. 44 */
    b.plat(-3, 0.6, 55, 9, 14, MAT.grass);    /* 48 .. 62 */
    b.plat(2.5, 0.9, 73, 9, 14, MAT.grass);   /* 66 .. 80 */
    b.rocks(3, 0.3, 34, 0.7, 2);
    b.rocks(-3, 0.6, 58, 0.6, 2);
    b.mark(0, 0.6, 55);

    /* Seitenabstecher ueber dem Bach */
    b.plat(11, 2.0, 55, 5, 5, MAT.grass);
    b.gem(11, 3.4, 55);

    /* Haengebruecke */
    b.plat(0, 1.2, 98, 5.4, 26, MAT.woodLight, { thickness: 0.8 });   /* 85 .. 111 */
    for (var i = 0; i < 8; i++) {
      var z = 86.5 + i * 3.4;
      b.deco('box', -2.9, 2.0, z, 0.35, 1.7, 0.35, MAT.wood);
      b.deco('box', 2.9, 2.0, z, 0.35, 1.7, 0.35, MAT.wood);
    }
    b.deco('box', -2.9, 2.9, 98, 0.25, 0.25, 26, MAT.rope);
    b.deco('box', 2.9, 2.9, 98, 0.25, 0.25, 26, MAT.rope);
    b.enemy(0, 2.15, 98, { axis: 'z', range: 9, speed: 0.3 });
    b.gem(0, 3.4, 90);
    b.mark(0, 1.2, 98);

    b.plat(0, 2.6, 123, 13, 14, MAT.grass, { thickness: 2.0 });  /* 116 .. 130 */
    b.mass(0, 0.6, 123, 11, 30, 12);
    b.tree(5.5, 2.6, 127, 1.0);
    b.rocks(-5, 2.6, 126, 1.1, 3);
    b.checkpoint(0, 2.6, 122, { name: 'Talstation' });
    b.mark(0, 2.6, 123);
    return { len: 130, rise: 2.6, turn: -24 };
  }

  /* ------------------------------------------------ 2 - Steinstufen */

  function sectionSteps(b) {
    b.plat(0, 0, 4, 14, 18, MAT.grass, { thickness: 2.0 });      /* -5 .. 13 */
    b.mass(0, -2, 4, 12, 30, 16);
    b.tree(-6, 0, 0, 0.85, true);

    /* Treppe ohne Luecken: schnell hochlaufen, kein Absturzrisiko */
    b.plat(0, 2.2, 19, 9, 12, MAT.stone);     /* 13 .. 25 */
    b.plat(-3, 4.4, 31, 9, 12, MAT.stone);    /* 25 .. 37 */
    b.plat(1.5, 6.6, 43, 9, 12, MAT.stone);   /* 37 .. 49 */
    b.mass(0, 2.2, 19, 7, 20, 10, MAT.rockWarm);
    b.mass(-3, 4.4, 31, 7, 24, 10, MAT.rockWarm);
    b.mass(1.5, 6.6, 43, 7, 28, 10, MAT.rockWarm);
    b.checkpoint(0, 6.6, 45, { name: 'Schlucht' });
    b.mark(0, 4.4, 31);

    /* Schlucht mit zwei gegenlaeufigen Plattformen (Luecken 9 und 8) */
    b.mover(-8, 7.4, 62, 8, 8, { dx: 16, period: 5.0 });         /* 58 .. 66 */
    b.mover(8, 8.6, 78, 8, 8, { dx: -16, period: 4.4, phase: 0.25 });  /* 74 .. 82 */
    b.gem(0, 12.5, 78);
    b.mark(0, 7.4, 62);
    b.mark(0, 8.6, 78);

    b.mark(0, 9.4, 97);
    b.plat(0, 9.4, 97, 11, 14, MAT.stone, { thickness: 1.8 });   /* 90 .. 104 */
    b.mass(0, 7.6, 97, 9, 30, 12);

    /* Schmaler Sims an der Felswand, darueber loest sich Geroell */
    b.plat(-2, 9.4, 112, 3.6, 16, MAT.stone);    /* 104 .. 120 */
    b.plat(-2, 10.4, 128, 3.6, 16, MAT.stone);   /* 120 .. 136 */
    b.block(2.9, 8, 120, 3.4, 26, 34, MAT.cliff);
    b.mass(-2, 9.4, 112, 3.2, 24, 15);
    b.mass(-2, 10.4, 128, 3.2, 26, 15);
    b.fallingRock(-2, 22, 112, { groundY: 9.4, period: 2.6, size: 2.0 });
    b.fallingRock(-2, 23, 128, { groundY: 10.4, period: 2.6, phase: 0.45, size: 2.2 });
    b.gem(-2, 12.0, 120);
    b.mark(-2, 10, 120);

    b.plat(0, 11.4, 147, 12, 14, MAT.grass, { thickness: 2.0 }); /* 140 .. 154 */
    b.mass(0, 9.4, 147, 10, 34, 12);
    b.checkpoint(0, 11.4, 145, { name: 'Steinstufen' });
    b.tree(5, 11.4, 150, 0.9);
    b.mark(0, 11.4, 147);
    return { len: 154, rise: 11.4, turn: 27 };
  }

  /* ------------------------------------------------ 3 - Tempo-Abfahrt */

  function sectionSpeed(b) {
    b.plat(0, 0, 4, 14, 18, MAT.grass, { thickness: 2.0 });
    b.mass(0, -2, 4, 12, 30, 16);

    /* Lange Bahn mit zwei Tempofeldern und einem drehenden Balken */
    b.plat(0, 0, 29, 9, 32, MAT.grass, { thickness: 1.6 });      /* 13 .. 45 */
    b.mass(0, -1.6, 29, 7.5, 28, 30);
    b.boostPad(0, 0, 20, 7, 7);
    b.boostPad(0, 0, 38, 7, 7);
    b.spinner(0, 1.5, 29, { len: 11, period: 3.4 });
    b.mark(0, 0, 16);
    b.mark(0, 0, 42);

    /* Hochroute fuer Mutige: spart den Balken und bringt einen Kristall */
    b.plat(-10.5, 4.0, 22, 5, 8, MAT.stone);
    b.plat(-10.5, 5.5, 34, 5, 8, MAT.stone);
    b.plat(-10.5, 6.6, 46, 5, 8, MAT.stone);
    b.gem(-10.5, 7.2, 34);

    b.plat(0, -1.0, 63, 9, 14, MAT.stone);                       /* 56 .. 70 (Luecke 11) */
    b.mass(0, -2.6, 63, 7.5, 26, 12);
    b.checkpoint(0, -1.0, 64, { name: 'Tempobahn' });
    b.mark(0, -1.0, 63);
    b.plat(0, -1.5, 86, 9, 16, MAT.grass, { thickness: 1.6 });   /* 78 .. 94 (Luecke 8) */
    b.plat(0, -3.0, 107, 9, 14, MAT.grass, { thickness: 1.6 });  /* 100 .. 114 (Luecke 6) */
    b.mass(0, -3.1, 86, 7.5, 30, 14);
    b.mass(0, -4.6, 107, 7.5, 30, 12);
    b.enemy(2.4, -0.4, 84, { range: 3.5, speed: 0.5 });
    b.enemy(-2.4, -1.9, 109, { range: 3.5, speed: 0.55, alt: true, phase: 0.4 });
    b.tree(-5.5, -1.5, 82, 0.8);
    b.mark(0, -2, 96);

    /* Absprung ueber die grosse Schlucht: Pilz plus Doppelsprung */
    b.plat(0, -3.0, 120, 8, 16, MAT.grass);                      /* 112 .. 128, schliesst an */
    b.mass(0, -4.6, 120, 6.5, 30, 14);
    b.mark(0, -3.0, 118);
    b.bouncePad(0, -3.0, 120, { power: 25 });
    b.gem(0, 7.0, 134, { hint: 'im Sprungbogen' });
    b.plat(0, -6.0, 138, 8, 8, MAT.stone);                       /* Rettungsinsel */
    b.gem(0, -4.4, 138);

    b.plat(0, -2.0, 150, 13, 16, MAT.grass, { thickness: 2.0 }); /* 142 .. 158 */
    b.mass(0, -4, 150, 11, 34, 14);
    b.tree(5.5, -2, 155, 1.0);
    b.checkpoint(0, -2.0, 149, { name: 'Abfahrt' });
    b.mark(0, -2, 150);
    return { len: 158, rise: -2.0, turn: -30 };
  }

  /* ------------------------------------------------ 4 - Tropfsteinhoehle */

  function sectionCave(b) {
    b.plat(0, 0, 4, 14, 18, MAT.grassDark, { thickness: 2.0 });
    b.mass(0, -2, 4, 12, 30, 16);
    b.deco('blob', -7.5, 3.5, 14, 10, 14, 10, MAT.cliff, [0.2, 0.4, 0.1]);
    b.deco('blob', 7.5, 3.5, 14, 10, 14, 10, MAT.cliff, [0.1, 2.4, 0.2]);
    b.deco('blob', 0, 10.5, 16, 18, 8, 11, MAT.cliff);

    b.plat(0, 0, 27, 8, 28, MAT.caveRock, { thickness: 1.6 });   /* 13 .. 41 */
    b.mass(0, -1.6, 27, 6.5, 26, 26);
    b.caveShell(0, 0, 27, 14, 9, 30);
    b.caveShell(0, 0, 60, 16, 10, 36);
    b.caveShell(0, 1.0, 103, 18, 12, 28);
    b.caveShell(0, 3.2, 124, 15, 9, 20);
    b.crystalCluster(3.2, 0, 20, 1.0);
    b.crystalCluster(-3.2, 0, 34, 1.2);

    /* Broeckelnde Platten - hier darf man nicht stehenbleiben */
    var zs = [48, 60, 72];
    for (var i = 0; i < zs.length; i++) {
      b.crumble(i % 2 ? 1.8 : -1.8, 0, zs[i], 6, 8, { mat: MAT.caveRock });
    }
    b.mark(0, 0, 60);

    /* Nische mit Kristall */
    b.plat(7.8, 0.2, 60, 5, 6, MAT.caveRock);
    b.gem(7.8, 1.7, 60);
    b.crystalCluster(9, 0.2, 60, 0.8);

    b.mark(0, 0, 72);
    b.plat(0, 0, 85, 9, 14, MAT.caveRock, { thickness: 1.6 });   /* 78 .. 92 */
    b.mass(0, -1.6, 85, 7.5, 26, 12);
    b.enemy(2.6, 1.15, 83, { range: 3, speed: 0.6 });
    b.enemy(-2.6, 1.15, 88, { range: 3, speed: 0.5, phase: 0.5, alt: true });
    b.crystalCluster(4.2, 0, 90, 1.1);
    b.checkpoint(0, 0, 85, { name: 'Tropfstein' });
    b.gem(0, 3.4, 103);

    /* Schmaler Grat ueber spitzen Kristallen */
    b.plat(0, 1.2, 103, 3, 18, MAT.caveRock);                    /* 94 .. 112 */
    b.block(0, -3.2, 103, 12, 1.6, 20, MAT.hazard, { tag: 'hazard', trigger: true });
    for (var k = 0; k < 8; k++) {
      b.deco('crystal', (k % 2 ? 3.4 : -3.6), -2.2, 94 + k * 2.4, 1.3, 3.4, 1.3, MAT.hazard, [0, k, 0]);
    }
    b.mark(0, 1.2, 103);

    b.plat(0, 3.2, 123, 10, 14, MAT.caveRock, { thickness: 1.8 }); /* 116 .. 130 */
    b.mass(0, 1.4, 123, 8.5, 28, 12);
    b.crystalCluster(4, 3.2, 127, 1.3);
    b.checkpoint(0, 3.2, 123, { name: 'Hoehle' });
    b.mark(0, 3.2, 123);
    return { len: 130, rise: 3.2, turn: 25 };
  }

  /* ------------------------------------------------ 5 - Wasserfall */

  function sectionFalls(b) {
    b.plat(0, 0, 4, 14, 18, MAT.grass, { thickness: 2.0 });
    b.mass(0, -2, 4, 12, 30, 16);
    b.waterfall(-12, 13, 24, 6, 26);
    b.deco('blob', -15, 6, 24, 14, 24, 16, MAT.cliff, [0, 0.4, 0.1]);
    b.block(0, -7, 40, 30, 1.6, 44, MAT.water, { tag: 'hazard', trigger: true });

    b.plat(0, 0, 20, 10, 16, MAT.grass);                         /* 12 .. 28, schliesst an */
    b.bouncePad(0, 0, 21, { power: 24 });
    b.plat(0, 7.0, 38, 8, 12, MAT.stone, { thickness: 1.6 });    /* 32 .. 44 */
    b.mass(0, 5.4, 38, 6.5, 22, 10);
    b.plat(-10.5, 7.6, 30, 5, 5, MAT.stone);
    b.gem(-10.5, 9.0, 30, { hint: 'hinter dem Wasserfall' });
    b.mark(0, 7, 38);

    /* Karussell um eine Felsnadel: Arme reichen von z 46,5 bis 61,5 */
    b.rotator(0, 9.0, 54, { radius: 7.5, count: 3, period: 9.0, w: 6.5, d: 6.5 });
    b.mark(0, 9, 54);

    b.mark(0, 11.0, 72);
    b.plat(0, 11.0, 72, 8, 12, MAT.stone, { thickness: 1.6 });   /* 66 .. 78 */
    b.mass(0, 9.4, 72, 6.5, 24, 10);
    b.mover(0, 11.0, 86, 7, 7, { dy: 9.5, period: 6.0, rail: false });
    b.deco('cylinder', 0, 6, 86, 1.2, 24, 1.2, MAT.rockWarm);
    b.gem(0, 23.5, 86);
    b.mark(0, 15, 86);

    b.plat(0, 20.0, 100, 8, 12, MAT.stone, { thickness: 1.6 });  /* 94 .. 106 */
    b.mass(0, 18.4, 100, 6.5, 26, 10);
    b.checkpoint(0, 20.0, 100, { name: 'Aufzug' });
    b.pendulum(0, 22.6, 112, { swing: 7, period: 2.6, rope: 9, d: 7 });
    b.plat(-3.5, 22.0, 115, 7, 10, MAT.stone);                   /* 110 .. 120 */
    b.plat(3, 24.0, 129, 7, 10, MAT.stone);                      /* 124 .. 134 */
    b.plat(-1, 26.0, 143, 7, 10, MAT.stone);                     /* 138 .. 148 */
    b.mark(0, 20, 100);
    b.mark(-3.5, 22, 115);
    b.mark(3, 24, 129);
    b.mark(-1, 26, 143);

    b.plat(0, 27.5, 159, 12, 14, MAT.grass, { thickness: 2.0 }); /* 152 .. 166 */
    b.mass(0, 25.5, 159, 10, 34, 12);
    b.tree(4.8, 27.5, 162, 0.85, true);
    b.checkpoint(0, 27.5, 158, { name: 'Wasserfall' });
    b.mark(0, 27.5, 159);
    return { len: 166, rise: 27.5, turn: -22 };
  }

  /* ------------------------------------------------ 6 - Gipfelgrat */

  function sectionRidge(b) {
    b.plat(0, 0, 4, 13, 18, MAT.snow, { thickness: 2.0 });
    b.mass(0, -2, 4, 11, 30, 16);

    b.plat(0, 0, 25, 5, 18, MAT.snow);        /* 16 .. 34 */
    b.mass(0, -1.4, 25, 4.2, 26, 17);
    b.pendulum(0, 2.2, 25, { swing: 6, period: 2.4, rope: 8, d: 6.5 });

    b.plat(0, 0.5, 46, 5, 16, MAT.snow);      /* 38 .. 54 */
    b.mass(0, -0.9, 46, 4.2, 26, 15);
    b.pendulum(0, 2.7, 46, { swing: 6, period: 2.1, phase: 0.35, rope: 8, d: 6.5 });
    b.mark(0, 0.5, 46);

    /* Zickzack ueber dem Abgrund: seitlich versetzt, also lenken */
    b.plat(-5, 1.5, 67, 7, 10, MAT.snow);     /* 62 .. 72 */
    b.plat(5, 2.5, 83, 7, 10, MAT.snow);      /* 78 .. 88 */
    b.plat(-5, 3.5, 99, 7, 10, MAT.snow);     /* 94 .. 104 */
    b.mark(-5, 1.5, 67);
    b.mark(5, 2.5, 83);
    b.mark(-5, 3.5, 99);
    b.gem(5, 4.0, 83);
    b.checkpoint(-5, 3.5, 99, { name: 'Zickzack' });

    /* Grosse Sprungkombination ueber dem Nichts */
    b.plat(0, 4.5, 121, 8, 10, MAT.snow);     /* 116 .. 126 (Luecke 12) */
    b.plat(0, 5.5, 143, 8, 10, MAT.snow);     /* 138 .. 148 (Luecke 12) */
    b.gem(0, 9.5, 132, { hint: 'ueber dem Abgrund' });
    b.plat(0, 6.0, 163, 8, 10, MAT.snow);     /* 158 .. 168 (Luecke 10) */
    b.mark(0, 4.5, 121);
    b.mark(0, 5.5, 143);
    b.mark(0, 6.0, 163);
    b.mark(0, 6.5, 181);

    b.plat(0, 6.5, 181, 3.4, 18, MAT.snow);   /* 172 .. 190 */
    b.mass(0, 5.1, 181, 3, 26, 17);
    b.spinner(0, 8.0, 181, { len: 9, period: 2.9, h: 0.8 });
    b.gem(0, 8.0, 189);

    b.plat(0, 7.5, 207, 18, 22, MAT.snow, { thickness: 2.4 });   /* 196 .. 218 */
    b.mass(0, 5.1, 207, 16, 40, 20);
    b.deco('cone', -7, 7.5, 214, 7, 6, 7, MAT.snow);
    b.deco('cone', 7.5, 7.5, 212, 6, 5, 6, MAT.snow);
    b.mark(0, 7.5, 207);

    /* Zielbogen */
    var p = b.toWorld(0, 7.5, 204, [0, 0, 0]);
    b.finish = { x: p[0], y: p[1], z: p[2], yaw: b.cursor.yaw, r: 6.5 };
    b.arch(0, 7.5, 204, 12, 8, MAT.goal);
    b.deco('box', 0, 16.4, 204, 14.4, 1.6, 0.6, MAT.flag);
    for (var i = 0; i < 6; i++) {
      b.deco('box', -6 + i * 2.4, 15.3, 204, 1.8, 1.2, 0.3, i % 2 ? MAT.flagAlt : MAT.flag);
    }
    return { len: 218, rise: 7.5, turn: 0 };
  }

  var SECTIONS = [sectionValley, sectionSteps, sectionSpeed, sectionCave, sectionFalls, sectionRidge];

  /* Landschaft um die Strecke: Talboden und Felsrippen neben dem Weg. */
  function terrain(b, spine, bounds) {
    var r = M.rng(90210);
    b.cursor.x = 0; b.cursor.y = 0; b.cursor.z = 0; b.cursor.yaw = 0;
    var cx = (bounds.minX + bounds.maxX) / 2;
    var cz = (bounds.minZ + bounds.maxZ) / 2;
    var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    var floorY = bounds.minY - 58;

    /* Talboden - der Blick nach unten soll Tiefe haben, nicht Leere. */
    b.deco('cylinder', cx, floorY - 26, cz, span * 2.1, 52, span * 2.1, MAT.grassDark);
    for (var i = 0; i < 90; i++) {
      var a = r() * Math.PI * 2, d = span * (0.1 + r() * 0.95);
      var px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
      if (r() > 0.45) {
        var sc = 2.2 + r() * 2.6;
        b.deco('cylinder', px, floorY + 2.4 * sc, pz, 1.6 * sc, 5 * sc, 1.6 * sc, MAT.trunk);
        b.deco('cone', px, floorY + 6.5 * sc, pz, 7 * sc, 8 * sc, 7 * sc, r() > 0.75 ? MAT.leafWarm : MAT.leaf);
      } else {
        b.deco('blob', px, floorY + r() * 4, pz, 8 + r() * 22, 6 + r() * 14, 8 + r() * 20,
          r() > 0.5 ? MAT.rock : MAT.grassDark, [0, r() * 6.28, 0]);
      }
    }

    /* Felsrippen links und rechts der Strecke */
    for (var k = 0; k < spine.length; k++) {
      var p0 = spine[Math.max(0, k - 1)], p1 = spine[Math.min(spine.length - 1, k + 1)];
      var dx = p1[0] - p0[0], dz = p1[2] - p0[2];
      var l = Math.hypot(dx, dz) || 1;
      var nx = dz / l, nz = -dx / l;
      var cur = spine[k];
      for (var side = -1; side <= 1; side += 2) {
        var width = 28 + r() * 36;
        var off = width * 0.5 + 13 + r() * 14;   /* immer neben dem Weg, nie darauf */
        var down = 14 + r() * 20;
        b.deco('blob', cur[0] + nx * side * off, cur[1] - down, cur[2] + nz * side * off,
          width, width * (0.7 + r() * 0.7), width, r() > 0.6 ? MAT.rockWarm : MAT.cliff,
          [r() * 0.3, r() * 6.28, r() * 0.3]);
      }
    }
  }

  /* ----------------------------------------------------------- Hintergrund */

  function backdrop(b, bounds) {
    var cx = (bounds.minX + bounds.maxX) / 2;
    var cz = (bounds.minZ + bounds.maxZ) / 2;
    var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    var r = M.rng(4711);

    b.cursor.x = 0; b.cursor.y = 0; b.cursor.z = 0; b.cursor.yaw = 0;

    /* Berggipfel ringsum */
    for (var i = 0; i < 26; i++) {
      var a = i / 26 * Math.PI * 2 + r() * 0.12;
      var dist = span * (0.62 + r() * 0.75);
      var h = 60 + r() * 150;
      var w = h * (1.1 + r() * 0.7);
      var px = cx + Math.cos(a) * dist, pz = cz + Math.sin(a) * dist;
      b.deco('cone', px, bounds.minY - 30 + h / 2, pz, w, h, w, MAT.far);
      if (h > 120) b.deco('cone', px, bounds.minY - 30 + h - h * 0.11, pz, w * 0.24, h * 0.22, w * 0.24, MAT.snow);
    }
    /* Huegelkette dazwischen */
    for (var j = 0; j < 18; j++) {
      var a2 = r() * Math.PI * 2;
      var d2 = span * (0.45 + r() * 0.3);
      b.deco('blob', cx + Math.cos(a2) * d2, bounds.minY - 22 + r() * 14, cz + Math.sin(a2) * d2,
        60 + r() * 60, 30 + r() * 30, 60 + r() * 60, MAT.far, [0, r() * 6.28, 0]);
    }
    /* Wolken */
    for (var k = 0; k < 34; k++) {
      var ca = r() * Math.PI * 2;
      var cd = span * (0.15 + r() * 0.85);
      var cxp = cx + Math.cos(ca) * cd, czp = cz + Math.sin(ca) * cd;
      var cy = bounds.maxY + 16 + r() * 70;
      var s = 9 + r() * 16;
      for (var q = 0; q < 4; q++) {
        b.deco('blob', cxp + (r() - 0.5) * s * 1.8, cy + (r() - 0.5) * s * 0.3, czp + (r() - 0.5) * s * 1.2,
          s * (0.8 + r() * 0.8), s * (0.45 + r() * 0.2), s * (0.7 + r() * 0.5), MAT.cloud);
      }
    }
  }

  /* --------------------------------------------------------------- Aufbau */

  function build() {
    var b = new L.Builder();
    var totalRise = 0;

    for (var i = 0; i < SECTIONS.length; i++) {
      var info = SECTIONS[i](b);
      totalRise += Math.max(0, info.rise);
      b.advance(info.len);
      b.lift(info.rise);
      b.turn(info.turn);
    }

    /* Kennzahlen fuer Medaillenzeiten aus der tatsaechlichen Streckenlaenge. */
    var pathLen = 0;
    for (var s = 1; s < b.spine.length; s++) {
      var a = b.spine[s - 1], c = b.spine[s];
      pathLen += Math.hypot(c[0] - a[0], c[2] - a[2]);
    }

    var bounds = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 };
    for (var q = 0; q < b.world.all.length; q++) {
      var col = b.world.all[q];
      if (col.x - col.hx < bounds.minX) bounds.minX = col.x - col.hx;
      if (col.x + col.hx > bounds.maxX) bounds.maxX = col.x + col.hx;
      if (col.y - col.hy < bounds.minY) bounds.minY = col.y - col.hy;
      if (col.y + col.hy > bounds.maxY) bounds.maxY = col.y + col.hy;
      if (col.z - col.hz < bounds.minZ) bounds.minZ = col.z - col.hz;
      if (col.z + col.hz > bounds.maxZ) bounds.maxZ = col.z + col.hz;
    }
    terrain(b, b.spine, bounds);
    backdrop(b, bounds);

    var base = pathLen / 15.5 + totalRise / 9;
    var medals = [
      { name: 'Platin', key: 'platin', time: Math.round(base * 1.00 * 10) / 10 },
      { name: 'Gold', key: 'gold', time: Math.round(base * 1.18 * 10) / 10 },
      { name: 'Silber', key: 'silber', time: Math.round(base * 1.42 * 10) / 10 },
      { name: 'Bronze', key: 'bronze', time: Math.round(base * 1.85 * 10) / 10 }
    ];

    var level = {
      name: 'Gipfelsprint',
      world: b.world,
      visuals: b.visuals,
      glass: b.glass,
      ents: b.ents,
      gems: b.gems,
      enemies: b.enemies,
      checkpoints: b.checkpoints,
      finish: b.finish,
      start: b.start,
      bounds: bounds,
      spine: b.spine,
      pathLength: pathLen,
      medals: medals,
      time: 0
    };

    /* Startpunkt als Checkpoint 0, damit Respawn immer eine Quelle hat. */
    level.spawn = {
      x: b.start.x, y: b.start.y, z: b.start.z, yaw: b.start.yaw,
      floorY: b.start.y - 14, index: -1, name: 'Start'
    };
    for (var c2 = 0; c2 < level.checkpoints.length; c2++) level.checkpoints[c2].index = c2;

    level.reset = function () {
      for (var i2 = 0; i2 < this.ents.length; i2++) if (this.ents[i2].reset) this.ents[i2].reset();
      for (var g = 0; g < this.gems.length; g++) this.gems[g].taken = false;
      for (var e = 0; e < this.enemies.length; e++) {
        this.enemies[e].alive = true;
        this.enemies[e].squash = 0;
      }
      for (var k = 0; k < this.checkpoints.length; k++) this.checkpoints[k].active = false;
      this.time = 0;
    };

    level.softReset = function () {
      /* Nach einem Sturz: Fallen und Geroell wieder scharf machen. */
      for (var i3 = 0; i3 < this.ents.length; i3++) {
        var e = this.ents[i3];
        if (e.kind === 'crumble' && e.reset) e.reset();
      }
    };

    level.update = function (t, dt, player) {
      this.time = t;
      var i;
      for (i = 0; i < this.ents.length; i++) {
        var ent = this.ents[i];
        var c = ent.col;
        if (c) { c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw; }
        if (ent.arms) {
          for (var a = 0; a < ent.arms.length; a++) {
            var ac = ent.arms[a].col;
            ac.px = ac.x; ac.py = ac.y; ac.pz = ac.z; ac.pyaw = ac.yaw;
          }
        }
        ent.update(t, dt, player);
      }
      for (i = 0; i < this.enemies.length; i++) {
        var en = this.enemies[i];
        if (!en.alive) { en.squash = Math.max(0, en.squash - dt * 3); continue; }
        var u = (t * en.speed + en.phase) % 1;
        var s = Math.sin(u * Math.PI * 2);
        en.x = en.baseX + en.hx * s;
        en.z = en.baseZ + en.hz * s;
        var hop = Math.abs(Math.sin((t * en.speed * 4 + en.phase) * Math.PI * 2));
        en.y = en.baseY + hop * 0.55;
        en.squash = 1 - hop * 0.35;
        en.yaw = Math.atan2(en.hx * Math.cos(u * Math.PI * 2), en.hz * Math.cos(u * Math.PI * 2));
      }
    };

    var TMP = new Float32Array(16);

    level.render = function (batch, glass, t) {
      var i;
      for (i = 0; i < this.ents.length; i++) this.ents[i].render(batch, t);

      /* Kristalle */
      for (i = 0; i < this.gems.length; i++) {
        var g = this.gems[i];
        if (g.taken) continue;
        var spin = t * 2.2 + g.spin;
        var bob = Math.sin(t * 2.0 + g.spin) * 0.22;
        m4.compose(TMP, g.x, g.y + bob + 0.42, g.z, 0, spin, 0, 1.0, 1.1, 1.0);
        batch.add('crystal', TMP, MAT.gem);
        m4.compose(TMP, g.x, g.y + bob - 0.36, g.z, Math.PI, spin, 0, 1.0, 0.8, 1.0);
        batch.add('crystal', TMP, MAT.gem);
        m4.compose(TMP, g.x, g.y + bob, g.z, Math.PI / 2, spin * 0.6, 0, 2.4, 2.4, 2.4);
        glass.add('torus', TMP, { color: MAT.gem.color, accent: MAT.gem.accent, emissive: 1, pattern: 0, patternScale: 1, alpha: 0.35 });
      }

      /* Gegner */
      for (i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        if (!e.alive && e.squash <= 0) continue;
        var sq = e.alive ? e.squash : 0.25 * e.squash;
        var w = e.r * 2 * (2 - sq) * 0.62;
        m4.compose(TMP, e.x, e.y, e.z, 0, e.yaw, 0, w, e.r * 2 * sq, w);
        batch.add('blob', TMP, e.mat);
        if (!e.alive) continue;
        var fw = Math.sin(e.yaw), fwz = Math.cos(e.yaw);
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          var ex = e.x + fw * e.r * 0.62 - fwz * s2 * e.r * 0.34;
          var ez = e.z + fwz * e.r * 0.62 + fw * s2 * e.r * 0.34;
          m4.compose(TMP, ex, e.y + e.r * 0.28, ez, 0, 0, 0, 0.42, 0.42, 0.42);
          batch.add('sphere', TMP, MAT.eye);
          m4.compose(TMP, ex + fw * 0.14, e.y + e.r * 0.28, ez + fwz * 0.14, 0, 0, 0, 0.2, 0.2, 0.2);
          batch.add('sphere', TMP, MAT.pupil);
        }
        m4.compose(TMP, e.x, e.y + e.r * 0.95, e.z, 0, t * 2 + e.phase, 0, 0.3, 0.9, 0.3);
        batch.add('crystal', TMP, MAT.leaf);
      }

      /* Checkpoint-Tore */
      for (i = 0; i < this.checkpoints.length; i++) {
        var cp = this.checkpoints[i];
        var mt = cp.active ? MAT.ringOn : MAT.ringOff;
        var pulse = cp.active ? 1 : 0.9 + Math.sin(t * 3 + i) * 0.06;
        m4.compose(TMP, cp.x, cp.y + 3.4, cp.z, Math.PI / 2, cp.yaw, 0, 7.6 * pulse, 7.6 * pulse, 7.6 * pulse);
        batch.add('torus', TMP, mt);
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var px = cp.x + Math.cos(cp.yaw) * sgn * 3.6;
          var pz = cp.z - Math.sin(cp.yaw) * sgn * 3.6;
          m4.composeYaw(TMP, px, cp.y + 1.6, pz, cp.yaw, 0.6, 3.2, 0.6);
          batch.add('box', TMP, MAT.wood);
        }
        if (cp.active) {
          m4.composeYaw(TMP, cp.x, cp.y + 5.6, cp.z, cp.yaw + Math.sin(t * 3) * 0.12, 3.4, 2.0, 0.2);
          batch.add('box', TMP, MAT.flag);
        }
      }

      /* Zielbereich */
      var f = this.finish;
      if (f) {
        for (var r2 = 0; r2 < 3; r2++) {
          var sc = 7 + r2 * 2.2 + Math.sin(t * 2 - r2 * 0.6) * 0.5;
          m4.compose(TMP, f.x, f.y + 4.2, f.z, Math.PI / 2, f.yaw, 0, sc, sc, sc);
          glass.add('torus', TMP, {
            color: MAT.goal.color, accent: MAT.goal.accent, emissive: 1,
            pattern: 0, patternScale: 1, alpha: 0.42 - r2 * 0.1
          });
        }
      }
    };

    return level;
  }

  root.MR.level.build = build;
  root.MR.level.SECTIONS = SECTIONS;
})(window);
