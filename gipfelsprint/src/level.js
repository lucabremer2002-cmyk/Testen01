/*
 * Levelbau.
 *
 * Der Parcours entsteht ueber einen "Cursor": jeder Abschnitt wird in
 * lokalen Koordinaten beschrieben (z = vorwaerts, x = seitlich, y = hoch)
 * und dann an der aktuellen Cursorposition/-drehung in die Welt gesetzt.
 * So laesst sich die Strecke wie ein Band durch die Landschaft legen, ohne
 * beim Entwerfen mit Weltkoordinaten zu rechnen.
 *
 * Fuenf Abschnitte mit eigener Farbwelt, eigenem Material und eigenem
 * Spielgefuehl: Almwiese, Wald, Bergschlucht, Ruinen, Gipfel.
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
    /* --- Almwiese: warmes Gruen, helles Holz --- */
    meadow: mat([0.46, 0.35, 0.22], [0.46, 0.76, 0.31], { pattern: 5, patternScale: 0.55 }),
    meadowLush: mat([0.42, 0.33, 0.20], [0.55, 0.83, 0.34], { pattern: 5, patternScale: 0.8 }),
    meadowDry: mat([0.50, 0.40, 0.24], [0.76, 0.78, 0.36], { pattern: 5, patternScale: 0.6 }),
    dirt: mat([0.42, 0.31, 0.20], [0.56, 0.42, 0.26], { pattern: 3, patternScale: 0.6 }),
    plank: mat([0.55, 0.36, 0.20], [0.80, 0.57, 0.31], { pattern: 2, patternScale: 0.6 }),
    plankPale: mat([0.62, 0.46, 0.28], [0.88, 0.71, 0.45], { pattern: 2, patternScale: 0.75 }),
    beam: mat([0.38, 0.24, 0.14], [0.52, 0.34, 0.19], { pattern: 2, patternScale: 1.2 }),
    roofRed: mat([0.52, 0.17, 0.15], [0.80, 0.30, 0.24], { pattern: 2, patternScale: 1.4 }),
    roofBlue: mat([0.17, 0.26, 0.45], [0.30, 0.44, 0.70], { pattern: 2, patternScale: 1.4 }),
    wall: mat([0.78, 0.72, 0.60], [0.92, 0.88, 0.78], { pattern: 3, patternScale: 0.8 }),
    hay: mat([0.66, 0.52, 0.18], [0.90, 0.78, 0.32], { pattern: 5, patternScale: 1.6 }),

    /* --- Wald: kuehles, dichtes Gruen --- */
    forestFloor: mat([0.28, 0.21, 0.14], [0.26, 0.46, 0.22], { pattern: 5, patternScale: 0.7 }),
    moss: mat([0.20, 0.30, 0.16], [0.34, 0.62, 0.26], { pattern: 5, patternScale: 1.1 }),
    bark: mat([0.28, 0.19, 0.13], [0.38, 0.27, 0.18], { pattern: 2, patternScale: 1.4 }),
    barkPale: mat([0.72, 0.70, 0.64], [0.90, 0.89, 0.84], { pattern: 2, patternScale: 1.8 }),
    barkDark: mat([0.19, 0.14, 0.11], [0.27, 0.20, 0.15], { pattern: 2, patternScale: 1.2 }),
    leafDark: mat([0.10, 0.31, 0.16], [0.20, 0.50, 0.23], { pattern: 5, patternScale: 1.0 }),
    leafMid: mat([0.15, 0.41, 0.19], [0.30, 0.65, 0.28], { pattern: 5, patternScale: 1.0 }),
    leafLight: mat([0.26, 0.52, 0.21], [0.48, 0.78, 0.33], { pattern: 5, patternScale: 1.0 }),
    leafAutumn: mat([0.55, 0.33, 0.10], [0.88, 0.60, 0.20], { pattern: 5, patternScale: 1.0 }),
    shroomCap: mat([0.62, 0.16, 0.18], [0.92, 0.32, 0.28], { emissive: 0.05 }),
    shroomCap2: mat([0.30, 0.42, 0.62], [0.52, 0.70, 0.92], { emissive: 0.05 }),
    shroomStem: mat([0.86, 0.82, 0.72], [0.98, 0.96, 0.90]),

    /* --- Schlucht: Fels, Wasser --- */
    cliff: mat([0.36, 0.37, 0.41], [0.47, 0.49, 0.53], { pattern: 3, patternScale: 0.26 }),
    cliffWarm: mat([0.46, 0.39, 0.33], [0.58, 0.50, 0.42], { pattern: 3, patternScale: 0.35 }),
    rock: mat([0.45, 0.46, 0.50], [0.60, 0.62, 0.66], { pattern: 3, patternScale: 0.45 }),
    rockDark: mat([0.26, 0.27, 0.31], [0.35, 0.36, 0.42], { pattern: 3, patternScale: 0.5 }),
    scree: mat([0.50, 0.47, 0.44], [0.66, 0.64, 0.60], { pattern: 3, patternScale: 0.9 }),
    caveRock: mat([0.21, 0.22, 0.29], [0.29, 0.31, 0.40], { pattern: 3, patternScale: 0.5 }),
    caveGlow: mat([0.22, 0.82, 0.92], [0.72, 1.0, 1.0], { emissive: 0.9, pattern: 6, patternScale: 3 }),
    water: mat([0.09, 0.42, 0.68], [0.52, 0.86, 1.0], { pattern: 4, patternScale: 0.35, alpha: 0.76 }),
    waterShallow: mat([0.18, 0.56, 0.72], [0.66, 0.94, 1.0], { pattern: 4, patternScale: 0.6, alpha: 0.62 }),
    fall: mat([0.58, 0.84, 0.96], [1.0, 1.0, 1.0], { pattern: 8, patternScale: 0.16, alpha: 0.6, emissive: 0.3 }),
    foam: mat([0.88, 0.95, 1.0], [1.0, 1.0, 1.0], { emissive: 0.25, alpha: 0.8 }),

    /* --- Ruinen: Sandstein, Gold --- */
    sandstone: mat([0.64, 0.56, 0.40], [0.84, 0.76, 0.58], { pattern: 1, patternScale: 0.4 }),
    sandstoneWorn: mat([0.56, 0.48, 0.35], [0.74, 0.66, 0.50], { pattern: 3, patternScale: 0.55 }),
    marble: mat([0.74, 0.72, 0.68], [0.94, 0.93, 0.90], { pattern: 1, patternScale: 0.5 }),
    templeTrim: mat([0.30, 0.42, 0.40], [0.48, 0.70, 0.64], { pattern: 1, patternScale: 0.9 }),
    gold: mat([0.86, 0.66, 0.16], [1.0, 0.92, 0.55], { emissive: 0.55 }),
    vine: mat([0.17, 0.38, 0.18], [0.32, 0.60, 0.27], { pattern: 5, patternScale: 1.4 }),

    /* --- Gipfel: Schnee, Eis --- */
    snow: mat([0.74, 0.80, 0.88], [0.99, 1.0, 1.0], { pattern: 3, patternScale: 0.3 }),
    snowDeep: mat([0.66, 0.73, 0.84], [0.93, 0.96, 1.0], { pattern: 3, patternScale: 0.5 }),
    ice: mat([0.38, 0.68, 0.84], [0.76, 0.94, 1.0], { emissive: 0.18, pattern: 6, patternScale: 1.6, alpha: 0.9 }),
    iceSolid: mat([0.46, 0.72, 0.86], [0.82, 0.96, 1.0], { emissive: 0.12, pattern: 6, patternScale: 1.2 }),

    /* --- Gemeinsam --- */
    gem: mat([0.95, 0.72, 0.10], [1.0, 0.96, 0.62], { emissive: 0.85, pattern: 6, patternScale: 2.4 }),
    bounce: mat([0.78, 0.18, 0.24], [1.0, 0.45, 0.42], { emissive: 0.3 }),
    bounceStem: mat([0.92, 0.90, 0.82], [1.0, 1.0, 0.96]),
    boost: mat([0.10, 0.14, 0.26], [1.0, 0.82, 0.22], { pattern: 9, patternScale: 0.35, emissive: 0.6 }),
    hazard: mat([0.40, 0.14, 0.40], [0.92, 0.32, 0.92], { emissive: 0.55, pattern: 6, patternScale: 2 }),
    spike: mat([0.55, 0.52, 0.48], [0.82, 0.80, 0.76], { emissive: 0.05 }),
    enemy: mat([0.45, 0.25, 0.65], [0.76, 0.50, 0.98], { emissive: 0.12 }),
    enemyAlt: mat([0.72, 0.30, 0.20], [0.98, 0.58, 0.34], { emissive: 0.12 }),
    enemyForest: mat([0.28, 0.50, 0.24], [0.52, 0.82, 0.38], { emissive: 0.1 }),
    eye: mat([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], { emissive: 0.4 }),
    pupil: mat([0.05, 0.05, 0.1], [0.05, 0.05, 0.1]),
    ringOff: mat([0.25, 0.60, 0.80], [0.60, 0.94, 1.0], { emissive: 0.7 }),
    ringOn: mat([0.95, 0.70, 0.12], [1.0, 0.95, 0.55], { emissive: 1.0 }),
    flag: mat([0.90, 0.20, 0.25], [1.0, 0.55, 0.45], { emissive: 0.2 }),
    flagAlt: mat([0.98, 0.98, 1.0], [1.0, 1.0, 1.0], { emissive: 0.15 }),
    lantern: mat([1.0, 0.86, 0.45], [1.0, 0.98, 0.80], { emissive: 1.0 }),
    metal: mat([0.32, 0.34, 0.38], [0.52, 0.55, 0.60]),
    rope: mat([0.42, 0.33, 0.20], [0.56, 0.45, 0.28]),
    cloud: mat([0.88, 0.92, 0.98], [1.0, 1.0, 1.0], { emissive: 0.1 }),
    shaft: mat([1.0, 0.96, 0.80], [1.0, 1.0, 0.94], { emissive: 1.0, alpha: 0.055 }),
    far: mat([0.36, 0.45, 0.60], [0.74, 0.82, 0.93], { pattern: 3, patternScale: 0.04 }),
    farWarm: mat([0.42, 0.44, 0.50], [0.80, 0.84, 0.90], { pattern: 3, patternScale: 0.05 }),
    shadow: mat([0.02, 0.05, 0.09], null, { pattern: 7, alpha: 0.4 })
  };

  /* Blumenfarben fuer die Wiese */
  var FLOWERS = [
    [0.95, 0.85, 0.25], [0.92, 0.35, 0.45], [0.75, 0.45, 0.92],
    [0.98, 0.98, 0.98], [0.95, 0.55, 0.20], [0.45, 0.65, 0.98]
  ];

  /* ------------------------------------------------------------ Builder */

  function Builder() {
    this.world = new Physics.World();
    this.visuals = [];        /* {mesh, m, mat} - einmalig hochgeladen */
    this.glass = [];          /* transparente Deko */
    this.ents = [];           /* bewegliche Objekte mit update/render */
    this.gems = [];
    this.enemies = [];
    this.checkpoints = [];
    this.zones = [];          /* Stimmung pro Abschnitt */
    this.spine = [];          /* Wegpunkte fuer Laenge und Tests */
    this.cursor = { x: 0, y: 0, z: 0, yaw: 0 };
    this.rand = M.rng(20260922);
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
  Builder.prototype.dirX = function (lx, lz) { return Math.cos(this.cursor.yaw) * lx + Math.sin(this.cursor.yaw) * lz; };
  Builder.prototype.dirZ = function (lx, lz) { return -Math.sin(this.cursor.yaw) * lx + Math.cos(this.cursor.yaw) * lz; };

  Builder.prototype.advance = function (len) {
    this.cursor.x += Math.sin(this.cursor.yaw) * len;
    this.cursor.z += Math.cos(this.cursor.yaw) * len;
    return this;
  };
  Builder.prototype.turn = function (deg) { this.cursor.yaw += deg * Math.PI / 180; return this; };
  Builder.prototype.lift = function (dy) { this.cursor.y += dy; return this; };
  Builder.prototype.mark = function (lx, ly, lz) {
    this.spine.push(this.toWorld(lx, ly, lz, [0, 0, 0]));
    return this;
  };

  /* Stimmungszone: Nebel, Himmel und Umgebungslicht dieses Abschnitts. */
  Builder.prototype.zone = function (name, lz, radius, env) {
    var p = this.toWorld(0, 0, lz, [0, 0, 0]);
    this.zones.push({
      name: name, x: p[0], y: p[1], z: p[2], radius: radius,
      fogCol: env.fogCol, fogDensity: env.fogDensity,
      zenith: env.zenith, horizon: env.horizon,
      skyCol: env.skyCol, groundCol: env.groundCol,
      sunCol: env.sunCol, ambient: env.ambient || 'none'
    });
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

  /* Wie deco, aber mit eigener Farbe (fuer Blumen, Kristalle, Varianten). */
  Builder.prototype.decoTint = function (mesh, lx, ly, lz, sx, sy, sz, base, color, rot) {
    var m2 = mat(color, color, {
      emissive: base.emissive, pattern: base.pattern,
      patternScale: base.patternScale, alpha: base.alpha
    });
    return this.deco(mesh, lx, ly, lz, sx, sy, sz, m2, rot);
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

  /* Plattform; ly ist die Oberkante - beim Entwerfen viel praktischer. */
  Builder.prototype.plat = function (lx, ly, lz, w, d, material, opts) {
    opts = opts || {};
    var t = opts.thickness || 1.4;
    return this.block(lx, ly - t / 2, lz, w, t, d, material || MAT.meadow, opts);
  };

  /* Felssockel unter einer Plattform, damit nichts in der Luft haengt. */
  Builder.prototype.mass = function (lx, ly, lz, w, h, d, material, yaw) {
    this.deco('pillar', lx, ly - h / 2, lz, w * 1.02, h, d * 1.02, material || MAT.cliff, [0, yaw || 0, 0]);
    this.block(lx, ly - h / 2, lz, w * 0.8, h, d * 0.8, null, { noCollide: true, yaw: yaw || 0 });
  };

  root.MR = root.MR || {};
  root.MR.level = { MAT: MAT, FLOWERS: FLOWERS, mat: mat, Builder: Builder };
})(window);

/*
 * Bewegliche Objekte, Gegner, Sammelkristalle.
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
  L.emitCol = emitCol;

  /* ------------------------------------------------- bewegliche Plattform */

  B.mover = function (lx, ly, lz, w, d, o) {
    var c = this.plat(lx, ly, lz, w, d, o.mat || MAT.plank, { dynamic: true, thickness: o.thickness || 1.2 });
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
    if (o.rail !== false) {
      this.deco('box', lx + (o.dx || 0) * 0.5, ly - 1.4, lz + (o.dz || 0) * 0.5,
        Math.abs(o.dx || 0) + 0.4, 0.22, Math.abs(o.dz || 0) + 0.4, MAT.metal);
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
      var c = this.plat(lx, ly, lz, o.w || 4.5, o.d || 4.5, o.mat || MAT.sandstone, { dynamic: true });
      arms.push({ col: c, off: i / count });
    }
    if (o.pillar !== false) {
      this.deco('cylinder', lx, ly - 7, lz, 3.0, 16, 3.0, o.pillarMat || MAT.sandstoneWorn);
      this.deco('box', lx, ly + 0.4, lz, 4.2, 1.0, 4.2, o.pillarMat || MAT.sandstone);
    }
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
    var c = this.block(lx, ly, lz, len, o.h || 0.9, o.thick || 0.9, o.mat || MAT.beam, { dynamic: true });
    var period = o.period || 3.2;
    var phase = o.phase || 0;
    var baseYaw = this.cursor.yaw;
    var cx = c.x, cz = c.z;
    if (o.pillar !== false) this.deco('cylinder', lx, ly - 2.4, lz, 1.2, 5, 1.2, o.pillarMat || MAT.sandstoneWorn);
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
    var c = this.block(lx, ly, lz, o.w || 1.4, o.h || 1.4, o.d || 6, o.mat || MAT.beam, { dynamic: true, yaw: o.yaw || 0 });
    var bx = c.x, bz = c.z, by = c.y;
    var ax = this.dirX(swing, 0), az = this.dirZ(swing, 0);
    var ropeLen = o.rope || 8;
    var anchorY = this.cursor.y + ly + ropeLen;
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
        var lift = ropeLen - Math.sqrt(Math.max(0, ropeLen * ropeLen - s * s * swing * swing));
        c.y = by + lift;
        var dx = c.x - ropeX, dz = c.z - ropeZ, dy = anchorY - c.y;
        var len = Math.hypot(dx, dy, dz);
        m4.compose(rope.m, (ropeX + c.x) / 2, (anchorY + c.y) / 2, (ropeZ + c.z) / 2,
          Math.atan2(Math.hypot(dx, dz), dy), Math.atan2(dx, dz), 0, 0.28, len, 0.28);
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
    var c = this.plat(lx, ly, lz, w, d, o.mat || MAT.sandstoneWorn, { dynamic: true, thickness: 1.0 });
    var bx = c.x, by = c.y, bz = c.z;
    var ent = {
      kind: 'crumble',
      col: c,
      state: 0,
      timer: 0,
      update: function (t, dt, player) {
        if (this.state === 0) {
          if (player && player.groundCollider === c) { this.state = 1; this.timer = 0.4; }
        } else if (this.state === 1) {
          this.timer -= dt;
          c.x = bx + Math.sin(this.timer * 62) * 0.1;
          c.z = bz + Math.cos(this.timer * 49) * 0.1;
          if (this.timer <= 0) { this.state = 2; this.timer = 0; this.vy = 0; }
        } else if (this.state === 2) {
          this.vy = (this.vy || 0) - 40 * dt;
          c.y += this.vy * dt;
          c.active = false;
          if (c.y < by - 26) { this.state = 3; this.timer = 1.4; }
        } else {
          this.timer -= dt;
          if (this.timer <= 0) this.reset();
        }
      },
      render: function (batch) {
        if (this.state === 3) return;
        emitCol(batch, c, this.state === 1 ? MAT.hazard : null);
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
      update: function (t) {
        var u = ((t / period + phase) % 1) * period;
        var hold = period * 0.28;
        if (u < hold) {
          c.x = bx + Math.sin(u * 40) * 0.08;
          c.y = by;
        } else {
          var f = u - hold;
          c.x = bx;
          c.y = by - 0.5 * 44 * f * f;
          if (c.y <= groundY) c.y = groundY;
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
    /* Ragt 0,25 ueber die Plattform - sonst liegt die Oberkante exakt auf
       Fusshoehe und wird beim Darueberlaufen nie beruehrt. */
    var c = this.block(lx, ly - 0.25, lz, r * 2, 1.0, r * 2, null, { tag: 'bounce' });
    c.power = o.power || 24;
    var capMat = o.mat || MAT.bounce;
    this.deco('cylinder', lx, ly - 1.5, lz, r * 0.5, 2.4, r * 0.5, MAT.bounceStem);
    this.deco('sphere', lx, ly - 0.1, lz, r * 2, 1.7, r * 2, capMat);
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
    c.boostSpeed = o.speed || 34;
    for (var i = 0; i < 3; i++) {
      var z = lz - d / 2 + 1.6 + i * (d - 3) / 2;
      this.deco('box', lx, ly + 0.2, z, w * 0.55, 0.12, 0.9, MAT.gold);
      this.deco('box', lx, ly + 0.2, z + 0.7, w * 0.3, 0.12, 0.9, MAT.gold);
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
      floorY: p[1] - (o.floor || 28),
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
      mat: o.mat || MAT.enemy,
      squash: 0,
      yaw: 0
    };
    this.enemies.push(e);
    return e;
  };

  root.MR.level.emitCol = emitCol;
})(window);

/*
 * Requisiten.
 *
 * Alles hier ist eine Variante - Groesse, Neigung, Farbton und Aufbau
 * streuen ueber den Zufallsgenerator des Builders, damit nichts wie eine
 * kopierte Vorlage aussieht. Was begehbar ist (Stamm, Kiste, Pilzhut,
 * Huettendach, Saeulenstumpf), bekommt zusaetzlich einen Kollider.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var L = root.MR.level;
  var MAT = L.MAT;
  var FLOWERS = L.FLOWERS;
  var B = L.Builder.prototype;

  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function vary(r, c, amt) {
    return [
      M.clamp(c[0] + (r() - 0.5) * amt, 0, 1),
      M.clamp(c[1] + (r() - 0.5) * amt, 0, 1),
      M.clamp(c[2] + (r() - 0.5) * amt, 0, 1)
    ];
  }

  /* --------------------------------------------------------------- Baeume */

  var LEAF_SETS = {
    fir: [MAT.leafDark, MAT.leafMid],
    pine: [MAT.leafMid, MAT.leafDark],
    broad: [MAT.leafLight, MAT.leafMid],
    birch: [MAT.leafLight],
    autumn: [MAT.leafAutumn]
  };

  /*
   * kind: fir | pine | broad | birch | autumn | dead
   * Ohne Angabe wird passend zur Zone gewuerfelt.
   */
  B.tree = function (lx, ly, lz, s, o) {
    o = o || {};
    var r = this.rand;
    s = s || 1;
    var kind = o.kind || pick(r, ['fir', 'fir', 'pine', 'broad', 'birch', 'autumn']);
    var tilt = (r() - 0.5) * (o.tilt === undefined ? 0.07 : o.tilt);
    var spin = r() * 6.28;
    var leafMat = pick(r, LEAF_SETS[kind] || LEAF_SETS.fir);
    var leafCol = vary(r, leafMat.color, 0.09);
    var accCol = vary(r, leafMat.accent, 0.09);
    var leaf = L.mat(leafCol, accCol, { pattern: leafMat.pattern, patternScale: leafMat.patternScale });

    if (kind === 'dead') {
      this.deco('cylinder', lx, ly + 3.4 * s, lz, 0.8 * s, 7 * s, 0.8 * s, MAT.barkDark, [tilt, spin, tilt * 0.6]);
      for (var d = 0; d < 4; d++) {
        var a = spin + d * 1.6;
        this.deco('cylinder', lx + Math.cos(a) * 1.2 * s, ly + (4 + d * 0.8) * s, lz + Math.sin(a) * 1.2 * s,
          0.3 * s, 3.2 * s, 0.3 * s, MAT.barkDark, [0.9, a, 0.5]);
      }
      return;
    }

    var trunkMat = kind === 'birch' ? MAT.barkPale : MAT.bark;
    var th = (kind === 'pine' ? 7.5 : kind === 'birch' ? 6.0 : 4.4) * s;
    var tw = (kind === 'pine' ? 0.72 : kind === 'birch' ? 0.52 : 0.85) * s;
    this.deco('cylinder', lx, ly + th * 0.5, lz, tw, th, tw, trunkMat, [tilt, spin, tilt * 0.5]);

    if (kind === 'broad' || kind === 'autumn') {
      var cw = (4.6 + r() * 2.2) * s;
      this.deco('blob', lx, ly + (th + cw * 0.36), lz, cw, cw * 0.9, cw * 0.95, leaf, [0, spin, 0]);
      this.deco('blob', lx + cw * 0.28, ly + (th + cw * 0.12), lz - cw * 0.2, cw * 0.62, cw * 0.55, cw * 0.6, leaf, [0, spin + 1, 0]);
      this.deco('blob', lx - cw * 0.3, ly + (th + cw * 0.2), lz + cw * 0.22, cw * 0.55, cw * 0.5, cw * 0.55, leaf, [0, spin + 2, 0]);
    } else if (kind === 'birch') {
      for (var b = 0; b < 3; b++) {
        this.deco('cylinder', lx, ly + (2.4 + b * 1.6) * s, lz, tw * 1.02, 0.12 * s, tw * 1.02, MAT.barkDark, [tilt, spin, 0]);
      }
      var bw = (3.0 + r() * 1.2) * s;
      this.deco('blob', lx, ly + th + bw * 0.4, lz, bw, bw * 1.15, bw, leaf, [0, spin, 0]);
    } else {
      /* Nadelbaum: gestapelte Kegel, oben schmaler */
      var levels = kind === 'pine' ? 3 : 3 + Math.floor(r() * 2);
      var base = (4.4 + r() * 1.8) * s;
      var top = th * (kind === 'pine' ? 0.75 : 0.55);
      for (var i = 0; i < levels; i++) {
        var f = i / levels;
        this.deco('cone', lx + tilt * (top + i * 2) * 0.4, ly + top + i * 2.1 * s, lz,
          base * (1 - f * 0.62), (4.2 - f * 1.2) * s, base * (1 - f * 0.62), leaf, [0, spin + i * 0.4, 0]);
      }
    }
  };

  /* Riesenbaum als Kletter-Setpiece: Stamm plus Astplattformen. */
  B.giantTree = function (lx, ly, lz, o) {
    o = o || {};
    var r = this.rand;
    var trunkR = o.trunkR || 6;
    var h = o.height || 44;
    this.deco('cylinder', lx, ly + h * 0.5, lz, trunkR * 2, h, trunkR * 2, MAT.bark);
    this.deco('pillar', lx, ly + 2.5, lz, trunkR * 2.9, 6, trunkR * 2.9, MAT.bark);
    /* Wurzeln */
    for (var w = 0; w < 7; w++) {
      var a = w / 7 * Math.PI * 2 + r() * 0.3;
      this.deco('blob', lx + Math.cos(a) * trunkR * 1.25, ly + 0.6, lz + Math.sin(a) * trunkR * 1.25,
        3.4, 2.6, 5.6, MAT.bark, [0.35, a + Math.PI / 2, 0]);
    }
    /* Krone */
    for (var c = 0; c < 9; c++) {
      var ca = r() * 6.28, cd = r() * 12;
      this.deco('blob', lx + Math.cos(ca) * cd, ly + h - 2 + r() * 10, lz + Math.sin(ca) * cd,
        14 + r() * 10, 10 + r() * 6, 14 + r() * 10, r() > 0.5 ? MAT.leafDark : MAT.leafMid, [0, ca, 0]);
    }
    /* Kollider fuer die Kamera, damit sie nicht in den Stamm faehrt */
    this.block(lx, ly + h * 0.5, lz, trunkR * 1.5, h, trunkR * 1.5, null, { noCollide: true });
  };

  /* --------------------------------------------------------------- Felsen */

  B.rock = function (lx, ly, lz, s, o) {
    o = o || {};
    var r = this.rand;
    var kind = o.kind || pick(r, ['round', 'flat', 'flat', 'sharp', 'stack', 'slab', 'shard']);
    var m = o.mat || MAT.rock;
    /* Kraeftige Farbstreuung, sonst sehen benachbarte Felsen aus wie Kopien. */
    var col = L.mat(vary(r, m.color, 0.15), vary(r, m.accent, 0.15), { pattern: m.pattern, patternScale: m.patternScale * (0.7 + r() * 0.8) });
    var spin = r() * 6.28;
    if (kind === 'sharp') {
      this.deco('crystal', lx, ly + 1.6 * s, lz, 1.7 * s, 3.8 * s, 1.7 * s, col, [(r() - 0.5) * 0.3, spin, (r() - 0.5) * 0.3]);
      this.deco('crystal', lx + s * 0.9, ly + 0.9 * s, lz + s * 0.4, 1.0 * s, 2.2 * s, 1.0 * s, col, [(r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4]);
    } else if (kind === 'shard') {
      /* Kantiger Splitter: schraeg stehender Quader */
      this.deco('box', lx, ly + 1.3 * s, lz, 1.6 * s, 3.4 * s, 1.3 * s, col, [(r() - 0.5) * 0.5, spin, (r() - 0.5) * 0.5]);
      this.deco('box', lx + s, ly + 0.5 * s, lz - s * 0.6, 1.2 * s, 1.4 * s, 1.1 * s, col, [(r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6]);
    } else if (kind === 'slab') {
      /* Flache Felsplatte, leicht gekippt */
      this.deco('box', lx, ly + 0.4 * s, lz, 4.2 * s, 0.9 * s, 3.0 * s, col, [(r() - 0.5) * 0.25, spin, (r() - 0.5) * 0.25]);
    } else if (kind === 'flat') {
      this.deco('blob', lx, ly + 0.3 * s, lz, 3.8 * s, 0.85 * s, 2.6 * s, col, [(r() - 0.5) * 0.2, spin, (r() - 0.5) * 0.2]);
      if (r() > 0.5) this.deco('blob', lx + 1.4 * s, ly + 0.2 * s, lz + 0.8 * s, 1.8 * s, 0.6 * s, 1.5 * s, col, [0, r() * 6.28, 0]);
    } else if (kind === 'stack') {
      var yy = ly;
      for (var i = 0; i < 3; i++) {
        var sc = (1.9 - i * 0.45) * s;
        this.deco('blob', lx + (r() - 0.5) * 0.6, yy + sc * 0.4, lz + (r() - 0.5) * 0.6,
          sc * (1.5 + r() * 0.6), sc * 0.8, sc * (1.4 + r() * 0.5), col, [0, r() * 6.28, 0]);
        yy += sc * 0.75;
      }
    } else {
      /* "Rund" heisst hier: unregelmaessig, nie eine saubere Kugel. */
      this.deco('blob', lx, ly + 0.7 * s, lz,
        2.8 * s * (0.75 + r() * 0.6), 1.5 * s * (0.7 + r() * 0.7), 2.4 * s * (0.75 + r() * 0.6),
        col, [(r() - 0.5) * 0.4, spin, (r() - 0.5) * 0.4]);
      this.deco('blob', lx + s * 0.8, ly + 0.35 * s, lz - s * 0.5, 1.5 * s, 0.9 * s, 1.4 * s, col, [0, r() * 6.28, 0]);
    }
  };

  B.rockField = function (lx, ly, lz, spread, n, o) {
    var r = this.rand;
    for (var i = 0; i < n; i++) {
      var a = r() * 6.28, d = r() * spread;
      this.rock(lx + Math.cos(a) * d, ly, lz + Math.sin(a) * d, 0.35 + r() * 0.9, o);
    }
  };

  /* ----------------------------------------------------- Kleinzeug / Gruen */

  B.bush = function (lx, ly, lz, s, o) {
    var r = this.rand;
    var m = (o && o.mat) || MAT.leafMid;
    var col = L.mat(vary(r, m.color, 0.08), vary(r, m.accent, 0.08), { pattern: 5, patternScale: 1.2 });
    this.deco('blob', lx, ly + 0.55 * s, lz, 2.5 * s, 1.9 * s, 2.4 * s, col, [0, r() * 6.28, 0]);
    this.deco('blob', lx + 1.0 * s, ly + 0.3 * s, lz + 0.6 * s, 1.6 * s, 1.3 * s, 1.5 * s, col, [0, r() * 6.28, 0]);
  };

  B.flowers = function (lx, ly, lz, spread, n) {
    var r = this.rand;
    for (var i = 0; i < n; i++) {
      var a = r() * 6.28, d = r() * spread;
      var x = lx + Math.cos(a) * d, z = lz + Math.sin(a) * d;
      var c = FLOWERS[Math.floor(r() * FLOWERS.length)];
      this.deco('box', x, ly + 0.2, z, 0.07, 0.4, 0.07, MAT.leafLight);
      this.decoTint('sphere', x, ly + 0.46, z, 0.52, 0.34, 0.52, MAT.gem, c);
      this.decoTint('sphere', x, ly + 0.52, z, 0.2, 0.2, 0.2, MAT.gem, [1, 0.96, 0.7]);
    }
  };

  B.grassTufts = function (lx, ly, lz, spread, n, o) {
    var r = this.rand;
    var m = (o && o.mat) || MAT.meadowLush;
    for (var i = 0; i < n; i++) {
      var a = r() * 6.28, d = r() * spread;
      var s = 0.7 + r() * 0.8;
      this.deco('crystal', lx + Math.cos(a) * d, ly + 0.3 * s, lz + Math.sin(a) * d,
        0.9 * s, 0.75 * s, 0.9 * s, m, [(r() - 0.5) * 0.25, r() * 6.28, (r() - 0.5) * 0.25]);
    }
  };

  /* Pilz; ab groesse 1.6 mit begehbarem Hut. */
  B.mushroom = function (lx, ly, lz, s, o) {
    o = o || {};
    var r = this.rand;
    var cap = o.mat || (r() > 0.5 ? MAT.shroomCap : MAT.shroomCap2);
    var h = 1.5 * s;
    this.deco('cylinder', lx, ly + h * 0.5, lz, 0.7 * s, h, 0.7 * s, MAT.shroomStem);
    this.deco('sphere', lx, ly + h, lz, 2.6 * s, 1.5 * s, 2.6 * s, cap);
    for (var i = 0; i < 4; i++) {
      var a = r() * 6.28;
      this.decoTint('sphere', lx + Math.cos(a) * 0.7 * s, ly + h + 0.42 * s, lz + Math.sin(a) * 0.7 * s,
        0.42 * s, 0.2 * s, 0.42 * s, MAT.shroomStem, [1, 1, 1]);
    }
    if (o.platform) {
      this.plat(lx, ly + h + 0.25 * s, lz, 3.2 * s, 3.2 * s, null, { thickness: 0.6 });
    }
  };

  /* Liegender Stamm: Huerde und Sprungbrett zugleich. */
  B.log = function (lx, ly, lz, len, o) {
    o = o || {};
    var r = o.r || 1.1;
    var yaw = o.yaw || 0;
    this.deco('cylinder', lx, ly + r, lz, r * 2, len, r * 2, o.mat || MAT.bark, [Math.PI / 2, yaw, 0]);
    this.deco('cylinder', lx, ly + r, lz, r * 2.1, 0.3, r * 2.1, MAT.barkDark, [Math.PI / 2, yaw, 0]);
    /* Kollider: flacher Quader auf Stammhoehe, damit man oben laufen kann */
    this.block(lx, ly + r * 0.72, lz, r * 1.7, r * 1.45, len, null, { yaw: yaw });
    if (o.moss !== false) {
      this.deco('blob', lx, ly + r * 1.55, lz, r * 1.6, 0.35, len * 0.4, MAT.moss, [0, yaw, 0]);
    }
  };

  B.stump = function (lx, ly, lz, s, o) {
    o = o || {};
    var h = 1.1 * s;
    this.deco('cylinder', lx, ly + h * 0.5, lz, 1.9 * s, h, 1.9 * s, MAT.bark);
    this.deco('cylinder', lx, ly + h, lz, 1.75 * s, 0.14, 1.75 * s, MAT.barkPale);
    if (o.platform) this.plat(lx, ly + h, lz, 1.8 * s, 1.8 * s, null, { thickness: 0.5 });
  };

  /* -------------------------------------------------------- Holz und Wege */

  B.fence = function (lx, ly, lz, len, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var n = Math.max(2, Math.round(len / 3.2));
    var dx = Math.sin(yaw), dz = Math.cos(yaw);
    for (var i = 0; i <= n; i++) {
      var f = (i / n - 0.5) * len;
      if (o.gap && Math.abs(f) < o.gap * 0.5) continue;
      this.deco('box', lx + dx * f, ly + 0.85, lz + dz * f, 0.26, 1.7, 0.26, MAT.beam, [0, yaw, 0]);
    }
    for (var b = 0; b < 2; b++) {
      var y = ly + 0.6 + b * 0.62;
      if (o.gap) {
        var half = (len - o.gap) / 4;
        var off = (o.gap + half * 2) / 2;
        this.deco('box', lx - dx * off, y, lz - dz * off, 0.16, 0.18, half * 2, MAT.plank, [0, yaw, 0]);
        this.deco('box', lx + dx * off, y, lz + dz * off, 0.16, 0.18, half * 2, MAT.plank, [0, yaw, 0]);
      } else {
        this.deco('box', lx, y, lz, 0.16, 0.18, len, MAT.plank, [0, yaw, 0]);
      }
    }
  };

  B.crate = function (lx, ly, lz, s, o) {
    o = o || {};
    var r = this.rand;
    var yaw = (o.yaw === undefined ? r() * 0.7 : o.yaw);
    this.block(lx, ly + s * 0.5, lz, s, s, s, MAT.plankPale, { yaw: yaw });
    this.deco('box', lx, ly + s * 0.5, lz, s * 1.04, s * 0.14, s * 1.04, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx, ly + s * 0.94, lz, s * 1.04, s * 0.12, s * 1.04, MAT.beam, [0, yaw, 0]);
  };

  B.barrel = function (lx, ly, lz, s) {
    var r = this.rand;
    this.block(lx, ly + s * 0.6, lz, s * 1.0, s * 1.2, s * 1.0, MAT.plank, { mesh: 'cylinder', yaw: r() });
    this.deco('cylinder', lx, ly + s * 0.35, lz, s * 1.06, s * 0.14, s * 1.06, MAT.metal);
    this.deco('cylinder', lx, ly + s * 0.9, lz, s * 1.06, s * 0.14, s * 1.06, MAT.metal);
  };

  B.lantern = function (lx, ly, lz, s) {
    s = s || 1;
    this.deco('box', lx, ly + 1.6 * s, lz, 0.22 * s, 3.2 * s, 0.22 * s, MAT.beam);
    this.deco('box', lx, ly + 3.3 * s, lz, 0.9 * s, 0.24 * s, 0.9 * s, MAT.beam);
    this.deco('sphere', lx, ly + 2.95 * s, lz, 0.85 * s, 0.95 * s, 0.85 * s, MAT.lantern);
  };

  B.sign = function (lx, ly, lz, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    this.deco('box', lx, ly + 1.1, lz, 0.24, 2.2, 0.24, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx + 0.5, ly + 2.0, lz, 2.4, 0.7, 0.18, MAT.plankPale, [0, yaw + 0.25, 0]);
    if (o.second) this.deco('box', lx - 0.5, ly + 1.3, lz, 2.0, 0.6, 0.18, MAT.plankPale, [0, yaw - 0.4, 0]);
  };

  /* Almhuette; das Dach ist begehbar. */
  B.hut = function (lx, ly, lz, s, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var w = 7 * s, d = 6 * s, h = 3.4 * s;
    this.block(lx, ly + h / 2, lz, w, h, d, MAT.wall, { yaw: yaw });
    /* Fachwerk */
    this.deco('box', lx, ly + h * 0.55, lz + d * 0.5, w * 1.01, 0.22 * s, 0.2, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx - w * 0.34, ly + h * 0.5, lz + d * 0.5, 0.22 * s, h, 0.2, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx + w * 0.34, ly + h * 0.5, lz + d * 0.5, 0.22 * s, h, 0.2, MAT.beam, [0, yaw, 0]);
    /* Tuer und Fenster */
    this.deco('box', lx, ly + 1.1 * s, lz + d * 0.51, 1.5 * s, 2.2 * s, 0.14, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx + w * 0.3, ly + 2.1 * s, lz + d * 0.51, 1.2 * s, 1.1 * s, 0.14, MAT.plankPale, [0, yaw, 0]);
    /* Dach - Kollider flach, Optik als Giebel */
    var roofY = ly + h;
    this.block(lx, roofY + 1.0 * s, lz, w * 1.24, 0.7 * s, d * 1.24, null, { yaw: yaw });
    this.deco('prism', lx, roofY + 1.3 * s, lz, w * 1.3, 2.4 * s, d * 1.3,
      o.roof || MAT.roofRed, [0, yaw + Math.PI / 2, 0]);
    this.deco('box', lx, roofY + 0.2 * s, lz, w * 1.34, 0.3 * s, d * 1.34, MAT.beam, [0, yaw, 0]);
  };

  /* Treppe aus flachen Stufen - laeuft sich ohne Springen. */
  B.stairs = function (lx, ly, lz, steps, o) {
    o = o || {};
    var w = o.w || 8;
    var rise = o.rise || 0.36;
    var run = o.run || 1.1;
    var m = o.mat || MAT.sandstone;
    for (var i = 0; i < steps; i++) {
      this.plat(lx, ly + (i + 1) * rise, lz + i * run, w, run + 0.1, m, { thickness: 1.2 + rise });
    }
    if (o.rail) {
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        this.deco('box', lx + sgn * (w / 2 + 0.4), ly + steps * rise * 0.5 + 0.8, lz + steps * run * 0.5,
          0.5, steps * rise + 1.2, steps * run, o.railMat || MAT.sandstoneWorn);
      }
    }
    return { top: ly + steps * rise, endZ: lz + (steps - 1) * run + run / 2 };
  };

  /* --------------------------------------------------------- Ruinenteile */

  B.column = function (lx, ly, lz, h, o) {
    o = o || {};
    var r = this.rand;
    var rad = o.r || 1.5;
    var m = o.mat || MAT.sandstone;
    this.deco('cylinder', lx, ly + 0.3, lz, rad * 2.5, 0.6, rad * 2.5, m);
    var segs = Math.max(1, Math.round(h / 2.4));
    for (var i = 0; i < segs; i++) {
      this.deco('cylinder', lx + (r() - 0.5) * 0.12, ly + 0.6 + (i + 0.5) * (h / segs), lz + (r() - 0.5) * 0.12,
        rad * 2 * (1 - i * 0.015), h / segs - 0.1, rad * 2 * (1 - i * 0.015), m);
    }
    if (o.capital !== false) {
      this.deco('box', lx, ly + h + 0.9, lz, rad * 2.9, 0.8, rad * 2.9, o.capMat || MAT.marble);
    }
    if (o.platform) this.plat(lx, ly + h + 1.3, lz, rad * 2.7, rad * 2.7, null, { thickness: 0.8 });
    this.block(lx, ly + h * 0.5, lz, rad * 1.8, h, rad * 1.8, null, { noCollide: true });
  };

  B.ruinWall = function (lx, ly, lz, w, h, o) {
    o = o || {};
    var r = this.rand;
    var yaw = o.yaw || 0;
    var m = o.mat || MAT.sandstoneWorn;
    var n = Math.max(2, Math.round(w / 3));
    for (var i = 0; i < n; i++) {
      var f = (i / (n - 1) - 0.5) * w;
      var hh = h * (0.45 + r() * 0.65);
      this.block(lx + Math.sin(yaw) * f, ly + hh / 2, lz + Math.cos(yaw) * f, w / n + 0.2, hh, o.d || 1.6, m, { yaw: yaw });
      if (r() > 0.6) {
        this.deco('blob', lx + Math.sin(yaw) * f, ly + hh + 0.2, lz + Math.cos(yaw) * f, 1.6, 0.8, 1.6, MAT.vine, [0, r() * 6.28, 0]);
      }
    }
  };

  B.arch = function (lx, ly, lz, w, h, material, o) {
    o = o || {};
    var m = material || MAT.beam;
    this.deco('box', lx - w / 2, ly + h / 2, lz, 1.0, h, 1.0, m);
    this.deco('box', lx + w / 2, ly + h / 2, lz, 1.0, h, 1.0, m);
    this.deco('box', lx, ly + h + 0.4, lz, w + 2.2, 1.0, 1.4, m);
    if (o.beam !== false) this.deco('box', lx, ly + h + 1.3, lz, w + 0.6, 0.6, 1.0, m);
  };

  /* ---------------------------------------------------------------- Wasser */

  B.waterBody = function (lx, ly, lz, w, d, o) {
    o = o || {};
    this.block(lx, ly - 0.8, lz, w, 1.6, d, o.mat || MAT.water, { tag: 'hazard', trigger: true });
    if (o.bed !== false) {
      this.deco('box', lx, ly - 3.4, lz, w * 0.96, 4, d * 0.96, o.bedMat || MAT.rockDark);
    }
    if (o.foam) {
      var r = this.rand;
      for (var i = 0; i < o.foam; i++) {
        this.deco('blob', lx + (r() - 0.5) * w * 0.9, ly + 0.1, lz + (r() - 0.5) * d * 0.9,
          1.6 + r() * 2.4, 0.3, 1.4 + r() * 2, MAT.foam, [0, r() * 6.28, 0]);
      }
    }
  };

  B.waterfall = function (lx, ly, lz, w, h, o) {
    o = o || {};
    this.deco('box', lx, ly - h / 2, lz, w, h, 0.7, MAT.fall);
    this.deco('box', lx, ly - h / 2, lz + 0.6, w * 0.72, h, 0.7, MAT.fall);
    this.deco('box', lx, ly - h / 2, lz - 0.6, w * 0.5, h, 0.5, MAT.fall);
    this.deco('sphere', lx, ly - h + 0.6, lz, w * 1.7, 2.2, w * 1.5, MAT.foam);
    if (o.top !== false) this.deco('box', lx, ly + 0.2, lz, w * 1.1, 0.6, 2.2, MAT.waterShallow);
    var p = this.toWorld(lx, ly - h + 1, lz, [0, 0, 0]);
    this.sprayPoints = this.sprayPoints || [];
    this.sprayPoints.push({ x: p[0], y: p[1], z: p[2], w: w });
  };

  /* ------------------------------------------------------------ Gipfelzeug */

  B.iceSpike = function (lx, ly, lz, s) {
    var r = this.rand;
    this.deco('crystal', lx, ly + 2.2 * s, lz, 1.5 * s, 5 * s, 1.5 * s, MAT.ice, [(r() - 0.5) * 0.2, r() * 6.28, (r() - 0.5) * 0.2]);
    this.deco('crystal', lx + s, ly + 1.2 * s, lz + s * 0.5, 0.9 * s, 3 * s, 0.9 * s, MAT.ice, [(r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3]);
  };

  B.snowDrift = function (lx, ly, lz, s) {
    var r = this.rand;
    this.deco('blob', lx, ly + 0.5 * s, lz, 5 * s, 1.6 * s, 3.4 * s, MAT.snow, [0, r() * 6.28, 0]);
  };

  B.cloudPuff = function (lx, ly, lz, s) {
    var r = this.rand;
    for (var i = 0; i < 4; i++) {
      this.deco('blob', lx + (r() - 0.5) * s * 2.4, ly + (r() - 0.5) * s * 0.4, lz + (r() - 0.5) * s * 1.6,
        s * (0.9 + r() * 0.8), s * (0.45 + r() * 0.25), s * (0.8 + r() * 0.6), MAT.cloud);
    }
  };

  /* Lichtbalken: billige Volumenoptik, additiv und sehr durchsichtig. */
  B.lightShaft = function (lx, ly, lz, w, h, o) {
    o = o || {};
    var r = this.rand;
    this.deco('box', lx, ly + h / 2, lz, w, h, w * 0.7, MAT.shaft, [o.tilt === undefined ? 0.22 : o.tilt, r() * 6.28, 0.1]);
  };

  /* Hoehlenroehre */
  B.caveShell = function (lx, ly, lz, w, h, d, o) {
    o = o || {};
    var m = o.mat || MAT.caveRock;
    var t = 4;
    this.block(lx - w / 2 - t / 2, ly + h / 2 - 1, lz, t, h + 6, d, m);
    this.block(lx + w / 2 + t / 2, ly + h / 2 - 1, lz, t, h + 6, d, m);
    this.block(lx, ly + h + 1.2, lz, w + t * 2, 3.2, d, m);
    for (var i = 0; i < 3; i++) {
      var f = (i + 0.5) / 3;
      this.deco('blob', lx - w / 2 + 1, ly + h * 0.75, lz - d / 2 + f * d, 5, 4, 5, m, [0, i, 0.2]);
      this.deco('blob', lx + w / 2 - 1, ly + h * 0.45, lz - d / 2 + f * d, 5, 5, 5, m, [0, i + 2, -0.2]);
      this.deco('crystal', lx + (i % 2 ? 1 : -1) * (w / 2 - 1.5), ly + h - 1.2, lz - d / 2 + f * d,
        1.0, 2.6, 1.0, MAT.caveGlow, [Math.PI, i, 0]);
    }
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
})(window);

/*
 * Die Strecke.
 *
 * Abstaende sind auf die gemessene Reichweite der Figur abgestimmt:
 *   Laufsprung 10,4 m | Sprintsprung 14,5 m | kurz getippt 9,1 m
 *   Doppelsprung 23,6 m | Dash-Sprung 23,9 m | Dash + Doppel 35 m
 * Luecken bis 8 m sind Tempo-Huepfer, 9-13 m verlangen Sprint,
 * ab 16 m braucht es den Doppelsprung. Landeflaechen sind mindestens
 * 10 Einheiten tief, damit ein frueher wie ein spaeter Absprung traegt.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var L = root.MR.level;
  var MAT = L.MAT;

  /* --------------------------------------------- 1 - Almwiese */

  function sectionMeadow(b) {
    var r = b.rand, i;
    b.zone('Almwiese', 60, 200, {
      fogCol: [0.72, 0.84, 0.94], fogDensity: 0.0013,
      zenith: [0.16, 0.46, 0.86], horizon: [0.78, 0.90, 0.99],
      skyCol: [0.52, 0.70, 0.94], groundCol: [0.34, 0.40, 0.24],
      sunCol: [1.08, 1.0, 0.84], ambient: 'pollen'
    });

    b.start = { x: b.toWorldX(0, 8), y: b.cursor.y + 0.1, z: b.toWorldZ(0, 8), yaw: b.cursor.yaw };

    /* Startwiese mit Huette, Zaun und Tor */
    b.plat(0, 0, 10, 24, 32, MAT.meadow, { thickness: 2.4 });
    b.mass(0, -2.4, 10, 22, 40, 30, MAT.dirt);
    b.arch(0, 0, 18, 11, 6.5, MAT.beam);
    b.deco('box', 0, 7.5, 18, 14, 1.5, 0.5, MAT.flagAlt);
    b.deco('box', 0, 7.5, 18, 9, 1.0, 0.56, MAT.flag);
    b.hut(-13, 0, 16, 1.0, { yaw: 0.9, roof: MAT.roofRed });
    b.fence(-6, 0, -5, 14, { yaw: Math.PI / 2 });
    b.fence(9, 0, 4, 18, { yaw: 0 });
    b.sign(5, 0, 12, { yaw: -0.3, second: true });
    b.lantern(-6, 0, 14, 1.0);
    b.flowers(-4, 0, 8, 7, 14);
    b.flowers(6, 0, 20, 6, 10);
    b.grassTufts(0, 0, 14, 10, 16);
    b.tree(-10, 0, 20, 1.1, { kind: 'broad' });
    b.tree(10, 0, -2, 0.9, { kind: 'fir' });
    b.crate(8, 0, 16, 1.6);
    b.crate(8, 1.6, 16, 1.3);
    b.mark(0, 0, 8);

    /* Sanft ansteigende Wiese */
    b.plat(0, 0.4, 36, 20, 20, MAT.meadowLush, { thickness: 2.0 });
    b.mass(0, -1.6, 36, 18, 30, 18, MAT.dirt);
    b.plat(-1, 0.8, 55, 18, 18, MAT.meadowLush, { thickness: 2.0 });
    b.mass(-1, -1.2, 55, 16, 30, 16, MAT.dirt);
    b.flowers(-5, 0.4, 32, 7, 16);
    b.flowers(4, 0.8, 52, 6, 12);
    b.grassTufts(2, 0.4, 40, 8, 14);
    b.tree(-8, 0.4, 30, 0.85, { kind: 'birch' });
    b.tree(7, 0.8, 50, 1.0, { kind: 'broad' });
    b.rock(6, 0.4, 34, 0.8, { kind: 'flat' });
    b.stump(-6, 0.8, 58, 1.0, { platform: true });
    b.mark(0, 0.6, 46);

    /* Bach mit Bruecke - daneben die schnellere Trittsteinlinie */
    b.waterBody(0, -1.4, 75, 44, 24, { foam: 5, bedMat: MAT.dirt });
    b.plat(0, 1.4, 75, 6, 24, MAT.plankPale, { thickness: 0.7 });
    for (i = 0; i < 7; i++) {
      var bz = 64.5 + i * 3.5;
      b.deco('box', -3.1, 2.2, bz, 0.3, 1.6, 0.3, MAT.beam);
      b.deco('box', 3.1, 2.2, bz, 0.3, 1.6, 0.3, MAT.beam);
    }
    b.deco('box', -3.1, 3.0, 75, 0.2, 0.2, 24, MAT.rope);
    b.deco('box', 3.1, 3.0, 75, 0.2, 0.2, 24, MAT.rope);
    b.plat(9.5, 1.0, 68, 4.5, 4.5, MAT.rock);
    b.plat(9.5, 1.3, 78, 4.5, 4.5, MAT.rock);
    b.gem(9.5, 2.8, 73, { hint: 'Trittsteine' });
    b.enemy(1.7, 2.4, 75, { axis: 'z', range: 8, speed: 0.34, mat: MAT.enemy });
    b.checkpoint(0, 1.4, 64, { name: 'Bachbruecke' });
    b.mark(0, 1.4, 75);

    /* Weide mit zweiter Huette - das Dach ist eine Abkuerzung */
    b.plat(0, 1.2, 94, 18, 20, MAT.meadow, { thickness: 2.0 });
    b.mass(0, -0.8, 94, 16, 30, 18, MAT.dirt);
    b.hut(11, 1.2, 96, 1.1, { yaw: -0.4, roof: MAT.roofBlue });
    b.gem(11, 7.4, 96, { hint: 'Huettendach' });
    b.fence(-2, 1.2, 86, 16, { yaw: 0, gap: 5 });
    b.deco('blob', -7, 2.4, 98, 4.5, 3.4, 4.5, MAT.hay, [0, 0.4, 0]);
    b.deco('blob', -7, 4.2, 98, 3.0, 2.2, 3.0, MAT.hay, [0, 1.2, 0]);
    b.flowers(3, 1.2, 100, 6, 12);
    b.grassTufts(-3, 1.2, 92, 8, 12);
    b.tree(-9, 1.2, 102, 1.0, { kind: 'fir' });
    b.mark(0, 1.2, 94);

    /* Sprung ueber den Teich auf das hoehere Ufer */
    b.waterBody(0, -0.6, 112, 30, 18, { foam: 3, bedMat: MAT.dirt });
    b.plat(0, 2.6, 122, 16, 18, MAT.meadowLush, { thickness: 2.2 });
    b.mass(0, 0.4, 122, 14, 30, 16, MAT.dirt);
    b.rockField(-6, 2.6, 126, 4, 3, { mat: MAT.rock });
    b.tree(7, 2.6, 126, 1.2, { kind: 'broad' });
    b.mark(0, 2.6, 122);

    /* Treppe zum Waldrand */
    b.stairs(0, 2.6, 133, 8, { w: 12, rise: 0.36, run: 1.4, mat: MAT.dirt });
    b.plat(0, 5.5, 148, 14, 14, MAT.meadow, { thickness: 2.0 });
    b.mass(0, 3.5, 148, 12, 30, 12, MAT.dirt);
    b.arch(0, 5.5, 152, 12, 7, MAT.beam);
    b.tree(-8, 5.5, 150, 1.3, { kind: 'fir' });
    b.tree(8, 5.5, 152, 1.2, { kind: 'fir' });
    b.lantern(-5.5, 5.5, 146, 1.0);
    b.checkpoint(0, 5.5, 146, { name: 'Waldrand' });
    b.mark(0, 5.5, 148);
    return { len: 154, rise: 5.5, turn: -26 };
  }

  /* --------------------------------------------- 2 - Wald */

  function sectionForest(b) {
    var r = b.rand, i;
    b.zone('Wald', 80, 170, {
      fogCol: [0.42, 0.56, 0.50], fogDensity: 0.0052,
      zenith: [0.20, 0.42, 0.62], horizon: [0.56, 0.68, 0.62],
      skyCol: [0.38, 0.54, 0.50], groundCol: [0.18, 0.24, 0.14],
      sunCol: [1.0, 0.96, 0.78], ambient: 'leaves'
    });

    b.plat(0, 0, 5, 16, 24, MAT.forestFloor, { thickness: 2.2 });
    b.mass(0, -2.2, 5, 14, 30, 22, MAT.dirt);
    /* Dichter Waldsaum - viele Varianten, damit nichts kopiert wirkt */
    for (i = 0; i < 26; i++) {
      var side = i % 2 ? 1 : -1;
      var tz = -8 + i * 3.4;
      b.tree(side * (9 + r() * 7), 0, tz, 0.8 + r() * 0.9, {});
    }
    b.lightShaft(-5, 2, 10, 4, 22, { tilt: 0.24 });
    b.lightShaft(6, 2, 24, 5, 24, { tilt: 0.18 });
    b.mushroom(-5, 0, 2, 0.7);
    b.mushroom(5.5, 0, 12, 0.9);
    b.bush(-6, 0, 14, 1.1, { mat: MAT.leafDark });
    b.mark(0, 0, 6);

    b.plat(0, 0.4, 26, 14, 20, MAT.forestFloor, { thickness: 2.0 });
    b.mass(0, -1.6, 26, 12, 30, 18, MAT.dirt);
    b.log(-1, 0.4, 28, 10, { yaw: Math.PI / 2, r: 0.95 });
    b.mushroom(-4, 0.4, 20, 1.0);
    b.mushroom(4, 0.4, 33, 0.8);
    b.grassTufts(0, 0.4, 24, 6, 10, { mat: MAT.moss });
    b.enemy(3, 1.6, 31, { range: 4, speed: 0.5, mat: MAT.enemyForest });
    b.mark(0, 0.4, 26);

    /* Lichtung - links zweigt ein versteckter Pfad ab */
    b.plat(0, 1.0, 53, 16, 18, MAT.moss, { thickness: 2.0 });
    b.mass(0, -1.0, 53, 14, 30, 16, MAT.dirt);
    b.lightShaft(0, 3, 53, 7, 26, { tilt: 0.1 });
    b.flowers(-3, 1.0, 50, 5, 8);
    b.mushroom(6, 1.0, 58, 1.2);
    b.stump(-6, 1.0, 48, 1.2, { platform: true });
    b.plat(-12, 1.4, 56, 5, 22, MAT.moss, { thickness: 1.2 });
    b.gem(-12, 2.9, 49, { hint: 'versteckter Pfad' });
    b.gem(-12, 2.9, 63, { hint: 'versteckter Pfad' });
    for (i = 0; i < 6; i++) b.tree(-17 - r() * 4, 1.0, 46 + i * 5, 0.7 + r() * 0.5, { kind: 'pine' });
    b.mushroom(-12, 1.4, 68, 1.5, { platform: true });
    b.mark(0, 1.0, 53);

    b.plat(1, 2.0, 79, 12, 16, MAT.forestFloor, { thickness: 2.0 });
    b.mass(1, 0, 79, 10, 30, 14, MAT.dirt);
    b.enemy(-2, 3.2, 77, { range: 3.5, speed: 0.55, mat: MAT.enemyForest, phase: 0.3 });
    b.checkpoint(1, 2.0, 79, { name: 'Lichtung' });
    b.rock(5, 2.0, 84, 1.0, { kind: 'round', mat: MAT.rock });
    b.tree(-5, 2.0, 84, 1.0, { kind: 'dead' });
    b.mark(1, 2.0, 79);

    /* ------------------- Setpiece: der Riesenbaum ------------------- */
    b.giantTree(0, -1, 112, { trunkR: 6, height: 46 });
    /* Aufstieg ueber zwei Riesenpilze */
    b.mushroom(-5, 2.4, 92, 1.2, { platform: true });
    b.mushroom(2, 4.0, 99, 1.3, { platform: true });
    b.mark(-5, 4.5, 92);
    b.mark(2, 6.3, 99);
    /* Astspirale: startet auf der Anlaufseite und steigt in 2,4er Schritten */
    for (i = 0; i < 9; i++) {
      var a = -Math.PI / 2 + i * 0.8;
      var px = Math.cos(a) * 10.5, pz = 112 + Math.sin(a) * 10.5;
      var py = 5.5 + i * 2.4;
      b.plat(px, py, pz, 5.6, 5.6, MAT.bark, { thickness: 1.0, yaw: -a });
      b.deco('cylinder', px * 0.62, py - 0.8, 112 + (pz - 112) * 0.62, 1.5, 1.4, 9, MAT.bark, [Math.PI / 2, -a + Math.PI / 2, 0]);
      if (i === 3) b.gem(px, py + 1.6, pz, { hint: 'Astspirale' });
      if (i === 6) b.enemy(px, py + 1.2, pz, { range: 1.8, speed: 0.7, mat: MAT.enemyForest });
      if (i === 4) b.checkpoint(px, py, pz, { name: 'Astspirale', w: 5 });
      if (i % 3 === 0) b.mushroom(px, py, pz + 1.8, 0.5);
      b.mark(px, py, pz);
    }
    /* Baumhaus */
    b.plat(0, 26.2, 112, 17, 17, MAT.plank, { thickness: 1.2 });
    b.fence(0, 26.2, 104, 16, { yaw: 0 });
    b.deco('box', 8, 28.2, 112, 0.4, 4, 17, MAT.beam);
    b.lantern(-7, 26.2, 108, 1.0);
    b.lantern(7, 26.2, 116, 1.0);
    b.gem(0, 27.8, 112, { hint: 'Baumhaus' });
    b.checkpoint(0, 26.2, 110, { name: 'Riesenbaum' });
    b.mark(0, 26.2, 112);

    /* Aststeg hinaus */
    b.plat(0, 25.6, 134, 4.2, 26, MAT.bark, { thickness: 1.0 });
    b.deco('cylinder', 0, 24.6, 134, 2.6, 28, 2.6, MAT.bark, [Math.PI / 2, 0, 0]);
    b.gem(0, 27.2, 134, { hint: 'Aststeg' });
    for (i = 0; i < 5; i++) b.tree(-13 + (i % 2) * 26, 4, 120 + i * 9, 1.4 + r() * 0.5, { kind: 'pine' });

    b.plat(0, 25.0, 156, 15, 16, MAT.forestFloor, { thickness: 2.0 });
    b.mass(0, 23.0, 156, 13, 34, 14, MAT.cliffWarm);
    b.rockField(-5, 25.0, 158, 4, 3, { mat: MAT.rock });
    b.mark(0, 25.0, 156);
    return { len: 164, rise: 25.0, turn: 30 };
  }

  /* --------------------------------------------- 3 - Bergschlucht */

  function sectionGorge(b) {
    var r = b.rand, i;
    b.zone('Bergschlucht', 90, 190, {
      fogCol: [0.64, 0.72, 0.80], fogDensity: 0.0026,
      zenith: [0.18, 0.44, 0.78], horizon: [0.74, 0.82, 0.90],
      skyCol: [0.48, 0.62, 0.80], groundCol: [0.26, 0.28, 0.30],
      sunCol: [1.0, 0.95, 0.86], ambient: 'spray'
    });

    b.plat(0, 0, 4, 14, 20, MAT.scree, { thickness: 2.2 });
    b.mass(0, -2.2, 4, 12, 40, 18, MAT.cliff);
    b.rockField(4, 0, 2, 5, 4, { mat: MAT.rock });
    b.sign(-5, 0, 8, { yaw: 0.4 });
    b.mark(0, 0, 4);

    /* Schmaler Sims an der Felswand */
    b.plat(-2.5, 0, 26, 4.2, 24, MAT.scree, { thickness: 1.4 });
    b.mass(-2.5, -1.4, 26, 3.6, 40, 22, MAT.cliff);
    b.block(3.2, 8, 26, 5, 34, 30, MAT.cliff);
    b.fallingRock(-2.5, 14, 20, { groundY: 0, period: 2.5, size: 2.0 });
    b.fallingRock(-2.5, 15, 32, { groundY: 0, period: 2.5, phase: 0.45, size: 2.2 });
    b.gem(-2.5, 1.6, 26, { hint: 'Sims' });
    b.mark(-2.5, 0, 26);

    b.plat(-1, -1, 56, 12, 18, MAT.scree, { thickness: 2.0 });
    b.mass(-1, -3, 56, 10, 40, 16, MAT.cliff);
    b.checkpoint(-1, -1, 54, { name: 'Schlucht' });
    b.mark(-1, -1, 56);

    /* ---------------- Setpiece: Haengebruecke ueber den Fluss ---------------- */
    b.waterBody(0, -17, 88, 34, 100, { bed: false, foam: 8 });
    b.plat(0, -1, 88, 5.4, 44, MAT.plank, { thickness: 0.7 });
    for (i = 0; i < 13; i++) {
      var bz = 67 + i * 3.6;
      b.deco('box', -2.9, -0.2, bz, 0.3, 1.7, 0.3, MAT.beam);
      b.deco('box', 2.9, -0.2, bz, 0.3, 1.7, 0.3, MAT.beam);
    }
    b.deco('box', -2.9, 0.7, 88, 0.22, 0.22, 44, MAT.rope);
    b.deco('box', 2.9, 0.7, 88, 0.22, 0.22, 44, MAT.rope);
    b.deco('box', 0, 4.5, 66, 9, 1.2, 1.2, MAT.beam);
    b.deco('box', 0, 4.5, 110, 9, 1.2, 1.2, MAT.beam);
    b.deco('box', -4, 2.2, 66, 1.0, 7, 1.0, MAT.beam);
    b.deco('box', 4, 2.2, 66, 1.0, 7, 1.0, MAT.beam);
    b.deco('box', -4, 2.2, 110, 1.0, 7, 1.0, MAT.beam);
    b.deco('box', 4, 2.2, 110, 1.0, 7, 1.0, MAT.beam);
    b.spinner(0, 0.6, 88, { len: 8, period: 3.6, h: 0.8, mat: MAT.beam, pillar: false });

    /* Risikolinie: Felsbrocken unten im Fluss, zwei Kristalle, dann Aufzug */
    for (i = 0; i < 5; i++) {
      b.plat(-6 + (i % 2) * 12, -13 + i * 0.4, 70 + i * 9, 5.5, 6, MAT.rockDark);
      if (i === 1 || i === 3) b.gem(-6 + (i % 2) * 12, -11.4 + i * 0.4, 70 + i * 9, { hint: 'Flussfelsen' });
    }
    b.mover(0, -12, 112, 6, 6, { dy: 11.5, period: 5.5, mat: MAT.plank, rail: false });
    b.deco('cylinder', 0, -6, 112, 1.0, 24, 1.0, MAT.beam);
    b.mark(0, -1, 88);

    b.plat(0, -1, 122, 14, 20, MAT.scree, { thickness: 2.0 });
    b.mass(0, -3, 122, 12, 40, 18, MAT.cliff);
    b.rockField(5, -1, 124, 4, 3, { mat: MAT.rock });
    b.mark(0, -1, 122);

    /* ---------------- Setpiece: Wasserfall mit Durchgang ---------------- */
    b.deco('box', -19, 6, 146, 12, 48, 44, MAT.cliff);
    b.waterfall(-14.5, 6, 146, 7, 30);
    b.waterBody(-14, -1.6, 146, 16, 20, { foam: 6, bedMat: MAT.rockDark });
    /* Hinter dem Wasserfall entlang - Abkuerzung durch die Hoehle */
    b.plat(-13, 0, 146, 4.5, 26, MAT.rockDark, { thickness: 1.4 });
    b.gem(-13, 1.6, 140, { hint: 'hinter dem Wasserfall' });
    b.caveShell(-13, 0, 162, 11, 8, 22, { mat: MAT.caveRock });
    b.plat(-13, 0.6, 165, 6.5, 24, MAT.caveRock, { thickness: 1.4 });
    b.crystalCluster(-16, 0.6, 162, 1.2);
    b.crystalCluster(-10, 0.6, 170, 1.0);
    b.gem(-13, 2.2, 166, { hint: 'Hoehle' });

    /* Normalweg: bewegliche Platten ueber dem Becken */
    b.mover(-6, 0.4, 140, 6, 6, { dx: 12, period: 4.2, mat: MAT.plank });
    b.mover(6, 1.6, 154, 6, 6, { dx: -12, period: 4.6, phase: 0.3, mat: MAT.plank });
    b.plat(2, 3.0, 170, 11, 14, MAT.scree, { thickness: 1.8 });
    b.mass(2, 1.2, 170, 9, 40, 12, MAT.cliff);
    b.mark(0, 1.5, 155);

    b.plat(0, 4.0, 186, 16, 16, MAT.scree, { thickness: 2.2 });
    b.mass(0, 1.8, 186, 14, 40, 14, MAT.cliff);
    b.checkpoint(0, 4.0, 185, { name: 'Wasserfall' });
    b.rockField(-6, 4.0, 188, 4, 3, { mat: MAT.rock, kind: 'sharp' });
    b.mark(0, 4.0, 186);
    return { len: 194, rise: 4.0, turn: -24 };
  }

  /* --------------------------------------------- 4 - Ruinen */

  function sectionRuins(b) {
    var r = b.rand, i;
    b.zone('Ruinen', 80, 180, {
      fogCol: [0.80, 0.74, 0.62], fogDensity: 0.0022,
      zenith: [0.24, 0.46, 0.78], horizon: [0.92, 0.84, 0.68],
      skyCol: [0.62, 0.62, 0.66], groundCol: [0.40, 0.34, 0.24],
      sunCol: [1.12, 1.0, 0.78], ambient: 'dust'
    });

    b.plat(0, 0, 4, 18, 20, MAT.sandstoneWorn, { thickness: 2.2 });
    b.mass(0, -2.2, 4, 16, 40, 18, MAT.cliffWarm);
    b.column(-7, 0, -2, 5, { r: 1.3 });
    b.column(7, 0, -2, 3.2, { r: 1.3, capital: false });
    b.log(5, 0, 8, 9, { yaw: 0.5, r: 1.2, mat: MAT.sandstoneWorn, moss: false });
    b.ruinWall(-10, 0, 8, 16, 3.4, { yaw: Math.PI / 2, d: 1.6 });
    b.ruinWall(10, 0, 8, 12, 2.6, { yaw: Math.PI / 2, d: 1.6 });
    b.deco('blob', -8, 0.6, 10, 4, 1.4, 4, MAT.vine, [0, 0.7, 0]);
    b.mark(0, 0, 4);

    /* Grosse Freitreppe */
    b.stairs(0, 0, 14.2, 18, { w: 15, rise: 0.4, run: 1.3, mat: MAT.sandstone, rail: true, railMat: MAT.sandstoneWorn });
    for (i = 0; i < 5; i++) {
      b.column(-9.5, 0.4 + i * 1.4, 18 + i * 4.4, 4 + r() * 2, { r: 1.2, mat: MAT.sandstone });
      b.column(9.5, 0.4 + i * 1.4, 18 + i * 4.4, 4 + r() * 2, { r: 1.2, mat: MAT.sandstone });
    }
    b.mark(0, 4, 28);

    /* Tempelhof mit Fallen */
    b.plat(0, 7.2, 51, 20, 24, MAT.marble, { thickness: 2.2 });
    b.mass(0, 5.0, 51, 18, 40, 22, MAT.cliffWarm);
    for (i = 0; i < 4; i++) {
      b.column(-8, 7.2, 42 + i * 6, 6.5, { r: 1.4, mat: MAT.sandstone });
      b.column(8, 7.2, 42 + i * 6, 6.5, { r: 1.4, mat: MAT.sandstone });
    }
    b.deco('box', 0, 16.4, 48, 20, 1.6, 26, MAT.sandstoneWorn);
    b.pendulum(0, 10.0, 46, { swing: 6.5, period: 2.3, rope: 6, d: 7, mat: MAT.metal });
    b.block(0, 6.0, 57, 12, 1.4, 3.4, MAT.hazard, { tag: 'hazard', trigger: true });
    for (i = 0; i < 7; i++) {
      b.deco('crystal', -5 + i * 1.7, 6.6, 57, 0.7, 1.8, 0.7, MAT.spike, [0, i, 0]);
    }
    b.gem(0, 12.0, 51, { hint: 'Tempelhof' });
    b.checkpoint(0, 7.2, 43, { name: 'Tempelhof' });
    b.enemy(-4, 8.4, 61, { range: 4, speed: 0.6, mat: MAT.enemyAlt });
    b.mark(0, 7.2, 51);

    /* Saeulenstuempfe als Plattformen */
    var cz = [72, 80, 88, 96, 104];
    for (i = 0; i < cz.length; i++) {
      var cx = (i % 2 ? 4.5 : -4.5);
      b.column(cx, 3.0 + i * 1.1, cz[i], 4.4, { r: 2.0, platform: true, mat: MAT.sandstone, capMat: MAT.templeTrim });
      if (i === 2) b.gem(cx, 10.6, cz[i], { hint: 'Saeulen' });
    }
    b.mark(-4.5, 9.8, 72);
    b.mark(4.5, 12.0, 96);

    /* Innenhof mit Karussell */
    b.plat(0, 12.2, 120, 18, 18, MAT.marble, { thickness: 2.0 });
    b.mass(0, 10.2, 120, 16, 40, 16, MAT.cliffWarm);
    b.crumble(-4, 12.2, 113, 5, 5, { mat: MAT.sandstoneWorn });
    b.crumble(4, 12.2, 120, 5, 5, { mat: MAT.sandstoneWorn });
    b.checkpoint(0, 12.2, 119, { name: 'Innenhof' });
    b.rotator(0, 13.4, 136, { radius: 8.5, count: 3, period: 8.5, w: 6, d: 6, mat: MAT.sandstone, pillarMat: MAT.sandstoneWorn });
    b.ruinWall(-11, 12.2, 126, 14, 5, { yaw: Math.PI / 2 });
    b.ruinWall(11, 12.2, 126, 14, 5, { yaw: Math.PI / 2 });
    b.mark(0, 12.2, 120);

    /* Galerie: unten sicher, oben riskant */
    b.plat(0, 14.0, 154, 13, 18, MAT.marble, { thickness: 2.0 });
    b.mass(0, 12.0, 154, 11, 40, 16, MAT.cliffWarm);
    b.plat(-10, 19.0, 154, 5.5, 18, MAT.sandstone, { thickness: 1.2 });
    b.gem(-10, 20.6, 148, { hint: 'Galerie' });
    b.gem(-10, 20.6, 160, { hint: 'Galerie' });
    b.column(-10, 14.0, 145, 4, { r: 1.4, platform: true, mat: MAT.sandstone });
    b.spinner(0, 15.4, 154, { len: 10, period: 3.2, h: 0.8, mat: MAT.metal, pillarMat: MAT.sandstoneWorn });
    b.mark(0, 14.0, 154);

    /* Eingestuerzter Turm */
    b.plat(-3, 15.4, 170, 6, 8, MAT.sandstoneWorn);
    b.plat(4, 17.0, 180, 6, 8, MAT.sandstoneWorn);
    b.plat(-3, 18.6, 190, 6, 8, MAT.sandstoneWorn);
    b.deco('cylinder', 10, 12, 182, 9, 26, 9, MAT.sandstoneWorn, [0.06, 0.3, 0.04]);
    b.ruinWall(8, 18.6, 192, 12, 6, { yaw: 0.3 });
    b.mark(-3, 15.4, 170);
    b.mark(4, 17.0, 180);
    b.mark(-3, 18.6, 190);

    b.plat(0, 20.0, 204, 16, 18, MAT.marble, { thickness: 2.2 });
    b.mass(0, 17.8, 204, 14, 40, 16, MAT.cliffWarm);
    b.arch(0, 20.0, 210, 11, 7, MAT.sandstone);
    b.checkpoint(0, 20.0, 202, { name: 'Tempel' });
    b.mark(0, 20.0, 204);
    return { len: 212, rise: 20.0, turn: 28 };
  }

  /* --------------------------------------------- 5 - Gipfel */

  function sectionSummit(b) {
    var r = b.rand, i;
    b.zone('Gipfel', 80, 200, {
      fogCol: [0.86, 0.92, 0.99], fogDensity: 0.0030,
      zenith: [0.10, 0.36, 0.82], horizon: [0.88, 0.94, 1.0],
      skyCol: [0.60, 0.76, 0.98], groundCol: [0.50, 0.56, 0.64],
      sunCol: [1.12, 1.06, 0.98], ambient: 'snow'
    });

    b.plat(0, 0, 4, 16, 20, MAT.snow, { thickness: 2.4 });
    b.mass(0, -2.4, 4, 14, 40, 18, MAT.cliff);
    b.snowDrift(-6, 0, 2, 1.2);
    b.snowDrift(6, 0, 8, 1.0);
    b.iceSpike(-7, 0, 10, 1.0);
    b.mark(0, 0, 4);

    /* Schmaler Grat */
    b.plat(0, 0.6, 23, 5.5, 18, MAT.snow, { thickness: 1.6 });
    b.mass(0, -1.0, 23, 4.6, 40, 17, MAT.cliff);
    b.iceSpike(3.5, 0.6, 18, 0.8);
    b.iceSpike(-3.5, 0.6, 28, 0.9);
    b.boostPad(0, 0.6, 26, 4.6, 7, { speed: 34 });
    b.mark(0, 0.6, 23);

    b.plat(0, 1.4, 49, 12, 16, MAT.iceSolid, { thickness: 1.8 });
    b.mass(0, -0.4, 49, 10, 40, 14, MAT.cliff);
    b.snowDrift(4, 1.4, 52, 1.0);
    b.mark(0, 1.4, 49);

    b.plat(2, 2.2, 74, 10, 16, MAT.snow, { thickness: 1.8 });
    b.mass(2, 0.4, 74, 8, 40, 14, MAT.cliff);
    b.gem(2, 3.8, 74, { hint: 'Grat' });
    b.checkpoint(2, 2.2, 73, { name: 'Eisgrat' });
    b.mark(2, 2.2, 74);

    /* Grosse Sprungsequenz ueber den Wolken */
    b.plat(-3, 3.2, 93, 8, 11, MAT.iceSolid, { thickness: 1.4 });
    b.checkpoint(-3, 3.2, 93, { name: 'Wolkensprung' });
    b.plat(4, 4.0, 110, 8, 11, MAT.iceSolid, { thickness: 1.4 });
    b.gem(0.5, 7.4, 102, { hint: 'ueber den Wolken' });
    b.plat(-2, 4.8, 127, 8, 11, MAT.iceSolid, { thickness: 1.4 });
    b.cloudPuff(-10, -2, 100, 7);
    b.cloudPuff(9, -4, 118, 8);
    b.cloudPuff(0, -6, 136, 9);
    b.mark(-3, 3.2, 93);
    b.mark(4, 4.0, 110);
    b.mark(-2, 4.8, 127);

    /* Schneepilz als Absprung auf den Gipfel */
    b.plat(0, 4.8, 142, 9, 12, MAT.snow, { thickness: 1.6 });
    b.mass(0, 3.2, 142, 7, 40, 10, MAT.cliff);
    b.bouncePad(0, 4.8, 142, { power: 30, mat: MAT.iceSolid });
    b.gem(0, 12.0, 150, { hint: 'im Sprungbogen' });

    /* Gipfelplateau mit Ziel */
    b.plat(0, 14.0, 165, 24, 28, MAT.snow, { thickness: 3.0 });
    b.mass(0, 11.0, 165, 22, 50, 26, MAT.cliff);
    b.deco('cone', -9, 14.0, 174, 9, 7, 9, MAT.snow);
    b.deco('cone', 9.5, 14.0, 170, 7, 6, 7, MAT.snow);
    b.iceSpike(-7, 14.0, 158, 1.4);
    b.iceSpike(7, 14.0, 160, 1.2);
    b.snowDrift(0, 14.0, 176, 1.6);
    b.mark(0, 14.0, 165);

    var p = b.toWorld(0, 14.0, 165, [0, 0, 0]);
    b.finish = { x: p[0], y: p[1], z: p[2], yaw: b.cursor.yaw, r: 7.0 };
    b.arch(0, 14.0, 165, 13, 8, MAT.gold);
    b.deco('box', 0, 22.9, 165, 15.4, 1.6, 0.6, MAT.flag);
    for (i = 0; i < 7; i++) {
      b.deco('box', -6.6 + i * 2.2, 21.8, 165, 1.7, 1.2, 0.3, i % 2 ? MAT.flagAlt : MAT.flag);
    }
    b.deco('box', 0, 17.5, 165, 4.5, 0.6, 0.3, MAT.gold);
    return { len: 181, rise: 14.0, turn: 0 };
  }

  root.MR.level.SECTIONS = [sectionMeadow, sectionForest, sectionGorge, sectionRuins, sectionSummit];
})(window);

/*
 * Landschaft ringsum, Aufbau und Laufzeit des Levels.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var m4 = M.m4;
  var L = root.MR.level;
  var MAT = L.MAT;

  /* Passende Streudeko je nach Zone - die Umgebung soll zum Abschnitt passen. */
  function scatter(b, zoneName, x, y, z, r) {
    b.cursor.x = x; b.cursor.z = z; b.cursor.y = y; b.cursor.yaw = 0;
    var k = r();
    if (zoneName === 'Wald') {
      if (k < 0.72) b.tree(0, 0, 0, 0.7 + r() * 1.0, { kind: r() > 0.3 ? 'pine' : 'fir' });
      else if (k < 0.85) b.rock(0, 0, 0, 0.6 + r() * 1.0, { kind: 'round', mat: MAT.rockDark });
      else if (k < 0.94) b.bush(0, 0, 0, 0.9 + r() * 0.8, { mat: MAT.leafDark });
      else b.tree(0, 0, 0, 0.8 + r() * 0.6, { kind: 'dead' });
    } else if (zoneName === 'Bergschlucht') {
      if (k < 0.62) b.rock(0, 0, 0, 0.8 + r() * 1.6, { kind: r() > 0.5 ? 'round' : 'stack', mat: MAT.rock });
      else if (k < 0.8) b.rock(0, 0, 0, 0.7 + r() * 1.2, { kind: 'sharp', mat: MAT.cliff });
      else if (k < 0.92) b.tree(0, 0, 0, 0.5 + r() * 0.5, { kind: 'pine' });
      else b.rock(0, 0, 0, 1.2 + r() * 1.4, { kind: 'flat', mat: MAT.scree });
    } else if (zoneName === 'Ruinen') {
      if (k < 0.45) b.rock(0, 0, 0, 0.8 + r() * 1.4, { kind: 'round', mat: MAT.sandstoneWorn });
      else if (k < 0.62) b.column(0, 0, 0, 2 + r() * 4, { r: 1.0 + r() * 0.5, mat: MAT.sandstoneWorn, capital: r() > 0.5 });
      else if (k < 0.78) b.ruinWall(0, 0, 0, 6 + r() * 8, 2 + r() * 3, { yaw: r() * 3 });
      else if (k < 0.9) b.bush(0, 0, 0, 0.8 + r() * 0.7, { mat: MAT.vine });
      else b.tree(0, 0, 0, 0.6 + r() * 0.7, { kind: 'dead' });
    } else if (zoneName === 'Gipfel') {
      if (k < 0.5) b.rock(0, 0, 0, 0.9 + r() * 1.8, { kind: 'round', mat: MAT.snowDeep });
      else if (k < 0.74) b.iceSpike(0, 0, 0, 0.7 + r() * 1.1);
      else if (k < 0.9) b.snowDrift(0, 0, 0, 0.8 + r() * 1.2);
      else b.rock(0, 0, 0, 0.8 + r() * 1.0, { kind: 'sharp', mat: MAT.ice });
    } else {
      if (k < 0.34) b.tree(0, 0, 0, 0.7 + r() * 0.9, { kind: r() > 0.5 ? 'broad' : 'fir' });
      else if (k < 0.5) b.bush(0, 0, 0, 0.8 + r() * 0.8, {});
      else if (k < 0.68) b.flowers(0, 0, 0, 3 + r() * 3, 5 + Math.floor(r() * 7));
      else if (k < 0.82) b.grassTufts(0, 0, 0, 3, 5 + Math.floor(r() * 6), {});
      else if (k < 0.92) b.rock(0, 0, 0, 0.5 + r() * 0.9, { kind: 'flat', mat: MAT.rock });
      else b.stump(0, 0, 0, 0.8 + r() * 0.5, {});
    }
  }

  function nearestZone(zones, x, z) {
    var best = zones[0], bd = 1e18;
    for (var i = 0; i < zones.length; i++) {
      var dx = zones[i].x - x, dz = zones[i].z - z;
      var d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = zones[i]; }
    }
    return best;
  }

  var GROUND_MAT = {
    'Almwiese': MAT.meadow, 'Wald': MAT.forestFloor, 'Bergschlucht': MAT.scree,
    'Ruinen': MAT.sandstoneWorn, 'Gipfel': MAT.snowDeep
  };
  var HILL_MAT = {
    'Almwiese': MAT.meadowLush, 'Wald': MAT.moss, 'Bergschlucht': MAT.cliff,
    'Ruinen': MAT.cliffWarm, 'Gipfel': MAT.snow
  };

  /* Gelaende neben der Strecke: Haenge, Kuppen und Streudeko je Zone. */
  function terrain(b, spine, zones, bounds) {
    var r = M.rng(90210);
    var saved = { x: b.cursor.x, y: b.cursor.y, z: b.cursor.z, yaw: b.cursor.yaw };
    var cx = (bounds.minX + bounds.maxX) / 2;
    var cz = (bounds.minZ + bounds.maxZ) / 2;
    var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    var floorY = bounds.minY - 62;

    b.cursor.x = 0; b.cursor.y = 0; b.cursor.z = 0; b.cursor.yaw = 0;

    /* Talboden - der Blick nach unten soll Tiefe haben, nicht Leere. */
    b.deco('cylinder', cx, floorY - 26, cz, span * 2.2, 52, span * 2.2, MAT.forestFloor);
    for (var i = 0; i < 110; i++) {
      var a = r() * Math.PI * 2, d = span * (0.1 + r() * 0.95);
      var px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
      if (r() > 0.4) {
        var sc = 2.2 + r() * 2.8;
        b.deco('cylinder', px, floorY + 2.4 * sc, pz, 1.6 * sc, 5 * sc, 1.6 * sc, MAT.bark);
        b.deco('cone', px, floorY + 6.5 * sc, pz, 7 * sc, 8 * sc, 7 * sc, r() > 0.75 ? MAT.leafAutumn : MAT.leafDark);
      } else {
        b.deco('blob', px, floorY + r() * 4, pz, 8 + r() * 24, 6 + r() * 16, 8 + r() * 22,
          r() > 0.5 ? MAT.rock : MAT.moss, [0, r() * 6.28, 0]);
      }
    }

    /* Haenge links und rechts der Strecke, dazu Streudeko in Wegnaehe. */
    for (var k = 0; k < spine.length; k++) {
      var p0 = spine[Math.max(0, k - 1)], p1 = spine[Math.min(spine.length - 1, k + 1)];
      var dx = p1[0] - p0[0], dz = p1[2] - p0[2];
      var l = Math.hypot(dx, dz) || 1;
      var nx = dz / l, nz = -dx / l;
      var cur = spine[k];
      var zone = nearestZone(zones, cur[0], cur[2]);

      for (var side = -1; side <= 1; side += 2) {
        var width = 26 + r() * 34;
        var off = width * 0.5 + 12 + r() * 14;
        var down = 12 + r() * 20;
        b.cursor.x = 0; b.cursor.y = 0; b.cursor.z = 0; b.cursor.yaw = 0;
        b.deco('blob', cur[0] + nx * side * off, cur[1] - down, cur[2] + nz * side * off,
          width * (1.0 + r() * 0.5), width * (0.34 + r() * 0.30), width * (0.9 + r() * 0.6),
          HILL_MAT[zone.name] || MAT.cliff, [(r() - 0.5) * 0.18, r() * 6.28, (r() - 0.5) * 0.18]);
        if (r() > 0.55) {
          b.deco('blob', cur[0] + nx * side * (off + width * 0.35), cur[1] - down - width * 0.1,
            cur[2] + nz * side * (off + width * 0.35),
            width * 0.7, width * (0.3 + r() * 0.3), width * 0.65,
            HILL_MAT[zone.name] || MAT.cliff, [0, r() * 6.28, 0]);
        }

        /* Kuppe der Kulisse bekommt passende Deko */
        for (var q = 0; q < 3; q++) {
          var ox = cur[0] + nx * side * (off - width * 0.3 + (r() - 0.5) * width * 0.5);
          var oz = cur[2] + nz * side * (off - width * 0.3 + (r() - 0.5) * width * 0.5);
          var oy = cur[1] - down + width * (0.35 + r() * 0.2);
          scatter(b, zone.name, ox, Math.min(oy, cur[1] + 2), oz, r);
        }
      }

      /* Kleinzeug direkt am Weg */
      for (var s2 = 0; s2 < 2; s2++) {
        var sgn = r() > 0.5 ? 1 : -1;
        scatter(b, zone.name, cur[0] + nx * sgn * (9 + r() * 7), cur[1] - 0.4,
          cur[2] + nz * sgn * (9 + r() * 7), r);
      }
    }

    b.cursor.x = saved.x; b.cursor.y = saved.y; b.cursor.z = saved.z; b.cursor.yaw = saved.yaw;
  }

  function backdrop(b, bounds) {
    var cx = (bounds.minX + bounds.maxX) / 2;
    var cz = (bounds.minZ + bounds.maxZ) / 2;
    var span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    var r = M.rng(4711);
    b.cursor.x = 0; b.cursor.y = 0; b.cursor.z = 0; b.cursor.yaw = 0;

    for (var i = 0; i < 30; i++) {
      var a = i / 30 * Math.PI * 2 + r() * 0.12;
      var dist = span * (0.60 + r() * 0.8);
      var h = 70 + r() * 170;
      var w = h * (1.05 + r() * 0.7);
      var px = cx + Math.cos(a) * dist, pz = cz + Math.sin(a) * dist;
      b.deco('cone', px, bounds.minY - 30 + h / 2, pz, w, h, w, r() > 0.5 ? MAT.far : MAT.farWarm);
      if (h > 120) b.deco('cone', px, bounds.minY - 30 + h - h * 0.11, pz, w * 0.26, h * 0.22, w * 0.26, MAT.snow);
    }
    for (var j = 0; j < 20; j++) {
      var a2 = r() * Math.PI * 2;
      var d2 = span * (0.45 + r() * 0.3);
      b.deco('blob', cx + Math.cos(a2) * d2, bounds.minY - 22 + r() * 14, cz + Math.sin(a2) * d2,
        60 + r() * 60, 30 + r() * 30, 60 + r() * 60, MAT.far, [0, r() * 6.28, 0]);
    }
    for (var c = 0; c < 44; c++) {
      var ca = r() * Math.PI * 2;
      var cd = span * (0.12 + r() * 0.9);
      var cxp = cx + Math.cos(ca) * cd, czp = cz + Math.sin(ca) * cd;
      var cy = bounds.minY + 30 + r() * (bounds.maxY - bounds.minY + 90);
      var s = 9 + r() * 18;
      for (var q2 = 0; q2 < 4; q2++) {
        b.deco('blob', cxp + (r() - 0.5) * s * 1.8, cy + (r() - 0.5) * s * 0.3, czp + (r() - 0.5) * s * 1.2,
          s * (0.8 + r() * 0.8), s * (0.45 + r() * 0.2), s * (0.7 + r() * 0.5), MAT.cloud);
      }
    }
  }

  /* --------------------------------------------------------------- Aufbau */

  function build() {
    var b = new L.Builder();
    var SECTIONS = L.SECTIONS;
    var totalRise = 0;

    for (var i = 0; i < SECTIONS.length; i++) {
      var info = SECTIONS[i](b);
      totalRise += Math.max(0, info.rise);
      b.advance(info.len);
      b.lift(info.rise);
      b.turn(info.turn);
    }

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
    terrain(b, b.spine, b.zones, bounds);
    backdrop(b, bounds);

    /* Richtwert aus Streckenlaenge und Hoehenmetern. Ein Testlauf ohne
       Optimierung braucht rund 52 s, ein sauberer Lauf deutlich weniger -
       Platin soll genau da liegen. */
    var base = pathLen / 19 + totalRise / 12;
    var medals = [
      { name: 'Platin', key: 'platin', time: Math.round(base * 1.00 * 10) / 10 },
      { name: 'Gold', key: 'gold', time: Math.round(base * 1.19 * 10) / 10 },
      { name: 'Silber', key: 'silber', time: Math.round(base * 1.45 * 10) / 10 },
      { name: 'Bronze', key: 'bronze', time: Math.round(base * 1.90 * 10) / 10 }
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
      zones: b.zones,
      sprayPoints: b.sprayPoints || [],
      finish: b.finish,
      start: b.start,
      bounds: bounds,
      spine: b.spine,
      pathLength: pathLen,
      medals: medals,
      time: 0
    };

    level.spawn = {
      x: b.start.x, y: b.start.y, z: b.start.z, yaw: b.start.yaw,
      floorY: b.start.y - 16, index: -1, name: 'Start'
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
      for (var i3 = 0; i3 < this.ents.length; i3++) {
        var e = this.ents[i3];
        if (e.kind === 'crumble' && e.reset) e.reset();
      }
    };

    /* Stimmung am Ort des Spielers: die Zonen werden weich ineinander geblendet. */
    var envOut = {
      fogCol: [0, 0, 0], fogDensity: 0, zenith: [0, 0, 0], horizon: [0, 0, 0],
      skyCol: [0, 0, 0], groundCol: [0, 0, 0], sunCol: [0, 0, 0], ambient: 'none'
    };
    level.envAt = function (x, z) {
      var zs = this.zones, total = 0, i4, w;
      var keys = ['fogCol', 'zenith', 'horizon', 'skyCol', 'groundCol', 'sunCol'];
      for (i4 = 0; i4 < keys.length; i4++) {
        envOut[keys[i4]][0] = 0; envOut[keys[i4]][1] = 0; envOut[keys[i4]][2] = 0;
      }
      envOut.fogDensity = 0;
      var bestW = -1;
      for (i4 = 0; i4 < zs.length; i4++) {
        var dx = zs[i4].x - x, dz = zs[i4].z - z;
        var d = Math.sqrt(dx * dx + dz * dz);
        w = 1 / Math.pow(Math.max(d, 1) / zs[i4].radius, 4);
        total += w;
        if (w > bestW) { bestW = w; envOut.ambient = zs[i4].ambient; envOut.zone = zs[i4].name; }
        for (var kk = 0; kk < keys.length; kk++) {
          var src = zs[i4][keys[kk]];
          var dst = envOut[keys[kk]];
          dst[0] += src[0] * w; dst[1] += src[1] * w; dst[2] += src[2] * w;
        }
        envOut.fogDensity += zs[i4].fogDensity * w;
      }
      if (total > 0) {
        for (var k2 = 0; k2 < keys.length; k2++) {
          var t2 = envOut[keys[k2]];
          t2[0] /= total; t2[1] /= total; t2[2] /= total;
        }
        envOut.fogDensity /= total;
      }
      return envOut;
    };

    level.update = function (t, dt, player) {
      this.time = t;
      var i5;
      for (i5 = 0; i5 < this.ents.length; i5++) {
        var ent = this.ents[i5];
        var c3 = ent.col;
        if (c3) { c3.px = c3.x; c3.py = c3.y; c3.pz = c3.z; c3.pyaw = c3.yaw; }
        if (ent.arms) {
          for (var a2 = 0; a2 < ent.arms.length; a2++) {
            var ac = ent.arms[a2].col;
            ac.px = ac.x; ac.py = ac.y; ac.pz = ac.z; ac.pyaw = ac.yaw;
          }
        }
        ent.update(t, dt, player);
      }
      for (i5 = 0; i5 < this.enemies.length; i5++) {
        var en = this.enemies[i5];
        if (!en.alive) { en.squash = Math.max(0, en.squash - dt * 3); continue; }
        var u = (t * en.speed + en.phase) % 1;
        var sn = Math.sin(u * Math.PI * 2);
        en.x = en.baseX + en.hx * sn;
        en.z = en.baseZ + en.hz * sn;
        var hop = Math.abs(Math.sin((t * en.speed * 4 + en.phase) * Math.PI * 2));
        en.y = en.baseY + hop * 0.55;
        en.squash = 1 - hop * 0.35;
        en.yaw = Math.atan2(en.hx * Math.cos(u * Math.PI * 2), en.hz * Math.cos(u * Math.PI * 2));
      }
    };

    var TMP = new Float32Array(16);

    level.render = function (batch, glass, t) {
      var i6;
      for (i6 = 0; i6 < this.ents.length; i6++) this.ents[i6].render(batch, t);

      for (i6 = 0; i6 < this.gems.length; i6++) {
        var g2 = this.gems[i6];
        if (g2.taken) continue;
        var spin = t * 2.2 + g2.spin;
        var bob = Math.sin(t * 2.0 + g2.spin) * 0.22;
        m4.compose(TMP, g2.x, g2.y + bob + 0.42, g2.z, 0, spin, 0, 1.0, 1.1, 1.0);
        batch.add('crystal', TMP, MAT.gem);
        m4.compose(TMP, g2.x, g2.y + bob - 0.36, g2.z, Math.PI, spin, 0, 1.0, 0.8, 1.0);
        batch.add('crystal', TMP, MAT.gem);
        m4.compose(TMP, g2.x, g2.y + bob, g2.z, Math.PI / 2, spin * 0.6, 0, 2.4, 2.4, 2.4);
        glass.add('torus', TMP, {
          color: MAT.gem.color, accent: MAT.gem.accent, emissive: 1,
          pattern: 0, patternScale: 1, alpha: 0.35
        });
      }

      for (i6 = 0; i6 < this.enemies.length; i6++) {
        var e2 = this.enemies[i6];
        if (!e2.alive && e2.squash <= 0) continue;
        var sq = e2.alive ? e2.squash : 0.25 * e2.squash;
        var w2 = e2.r * 2 * (2 - sq) * 0.62;
        m4.compose(TMP, e2.x, e2.y, e2.z, 0, e2.yaw, 0, w2, e2.r * 2 * sq, w2);
        batch.add('blob', TMP, e2.mat);
        if (!e2.alive) continue;
        var fw = Math.sin(e2.yaw), fwz = Math.cos(e2.yaw);
        for (var s3 = -1; s3 <= 1; s3 += 2) {
          var ex = e2.x + fw * e2.r * 0.62 - fwz * s3 * e2.r * 0.34;
          var ez = e2.z + fwz * e2.r * 0.62 + fw * s3 * e2.r * 0.34;
          m4.compose(TMP, ex, e2.y + e2.r * 0.28, ez, 0, 0, 0, 0.42, 0.42, 0.42);
          batch.add('sphere', TMP, MAT.eye);
          m4.compose(TMP, ex + fw * 0.14, e2.y + e2.r * 0.28, ez + fwz * 0.14, 0, 0, 0, 0.2, 0.2, 0.2);
          batch.add('sphere', TMP, MAT.pupil);
        }
        m4.compose(TMP, e2.x, e2.y + e2.r * 0.95, e2.z, 0, t * 2 + e2.phase, 0, 0.3, 0.9, 0.3);
        batch.add('crystal', TMP, MAT.leafMid);
      }

      for (i6 = 0; i6 < this.checkpoints.length; i6++) {
        var cp = this.checkpoints[i6];
        var mt = cp.active ? MAT.ringOn : MAT.ringOff;
        var pulse = cp.active ? 1 : 0.9 + Math.sin(t * 3 + i6) * 0.06;
        m4.compose(TMP, cp.x, cp.y + 3.4, cp.z, Math.PI / 2, cp.yaw, 0, 7.6 * pulse, 7.6 * pulse, 7.6 * pulse);
        batch.add('torus', TMP, mt);
        for (var sgn2 = -1; sgn2 <= 1; sgn2 += 2) {
          var px2 = cp.x + Math.cos(cp.yaw) * sgn2 * 3.6;
          var pz2 = cp.z - Math.sin(cp.yaw) * sgn2 * 3.6;
          m4.composeYaw(TMP, px2, cp.y + 1.6, pz2, cp.yaw, 0.6, 3.2, 0.6);
          batch.add('box', TMP, MAT.beam);
        }
        if (cp.active) {
          m4.composeYaw(TMP, cp.x, cp.y + 5.6, cp.z, cp.yaw + Math.sin(t * 3) * 0.12, 3.4, 2.0, 0.2);
          batch.add('box', TMP, MAT.flag);
        }
      }

      var f = this.finish;
      if (f) {
        for (var r2 = 0; r2 < 3; r2++) {
          var sc = 7.5 + r2 * 2.4 + Math.sin(t * 2 - r2 * 0.6) * 0.5;
          m4.compose(TMP, f.x, f.y + 4.4, f.z, Math.PI / 2, f.yaw, 0, sc, sc, sc);
          glass.add('torus', TMP, {
            color: MAT.gold.color, accent: MAT.gold.accent, emissive: 1,
            pattern: 0, patternScale: 1, alpha: 0.42 - r2 * 0.1
          });
        }
      }
    };

    return level;
  }

  root.MR.level.build = build;
})(window);
