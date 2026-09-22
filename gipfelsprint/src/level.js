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
    stone: mat([0.52, 0.55, 0.60], [0.72, 0.76, 0.81], { pattern: 1, patternScale: 0.45 }),
    templeTrim: mat([0.30, 0.42, 0.40], [0.48, 0.70, 0.64], { pattern: 1, patternScale: 0.9 }),
    gold: mat([0.86, 0.66, 0.16], [1.0, 0.92, 0.55], { emissive: 0.55 }),
    vine: mat([0.17, 0.38, 0.18], [0.32, 0.60, 0.27], { pattern: 5, patternScale: 1.4 }),

    /* --- Gipfel: Schnee, Eis --- */
    snow: mat([0.74, 0.80, 0.88], [0.99, 1.0, 1.0], { pattern: 3, patternScale: 0.3 }),
    snowDeep: mat([0.66, 0.73, 0.84], [0.93, 0.96, 1.0], { pattern: 3, patternScale: 0.5 }),
    ice: mat([0.38, 0.68, 0.84], [0.76, 0.94, 1.0], { emissive: 0.18, pattern: 6, patternScale: 1.6, alpha: 0.9 }),
    iceSolid: mat([0.46, 0.72, 0.86], [0.82, 0.96, 1.0], { emissive: 0.12, pattern: 6, patternScale: 1.2 }),

    /* --- Canyon: warmer roter Fels --- */
    canyon: mat([0.58, 0.26, 0.18], [0.82, 0.45, 0.27], { pattern: 3, patternScale: 0.30 }),
    canyonDark: mat([0.38, 0.18, 0.14], [0.54, 0.28, 0.20], { pattern: 3, patternScale: 0.40 }),
    canyonLight: mat([0.72, 0.42, 0.26], [0.92, 0.66, 0.40], { pattern: 3, patternScale: 0.55 }),
    mesa: mat([0.64, 0.33, 0.22], [0.88, 0.58, 0.34], { pattern: 1, patternScale: 0.22 }),

    /* --- Kristallhoehle --- */
    crystalRock: mat([0.17, 0.14, 0.26], [0.26, 0.22, 0.38], { pattern: 3, patternScale: 0.5 }),
    crystalGlow: mat([0.62, 0.28, 0.95], [1.0, 0.76, 1.0], { emissive: 1.0, pattern: 6, patternScale: 2.6 }),
    crystalGlow2: mat([0.20, 0.78, 0.95], [0.72, 1.0, 1.0], { emissive: 1.0, pattern: 6, patternScale: 2.6 }),

    /* --- Routenfarben: gruen sicher, gold schnell, rot irre --- */
    routeSafe: mat([0.16, 0.72, 0.44], [0.62, 1.0, 0.80], { emissive: 0.95 }),
    routeFast: mat([0.95, 0.72, 0.14], [1.0, 0.95, 0.60], { emissive: 0.95 }),
    routeInsane: mat([0.92, 0.20, 0.36], [1.0, 0.58, 0.68], { emissive: 0.95 }),

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

  /* Wegpunkt eines einzelnen Astes - dient der Auswertung und den Testlaeufen,
     nicht der Streckenlaenge. */
  Builder.prototype.routeMark = function (fork, branch, lx, ly, lz) {
    this.routePaths = this.routePaths || {};
    var key = fork + ':' + branch;
    (this.routePaths[key] = this.routePaths[key] || []).push(this.toWorld(lx, ly, lz, [0, 0, 0]));
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

  /* ------------------------------------------------------------- Zeittor */
  /*
   * Kein Checkpoint: hier wird nur die Zwischenzeit genommen. Wer stuerzt,
   * faengt trotzdem am Start wieder an.
   */
  B.gate = function (lx, ly, lz, o) {
    o = o || {};
    var p = this.toWorld(lx, ly, lz, [0, 0, 0]);
    var g = {
      x: p[0], y: p[1], z: p[2],
      yaw: this.cursor.yaw,
      name: o.name || ('Tor ' + (this.checkpoints.length + 1)),
      index: this.checkpoints.length,
      passed: false,
      w: o.w || 11
    };
    this.checkpoints.push(g);
    return g;
  };

  /* Unsichtbarer Melder: erkennt, welchen Weg der Spieler genommen hat. */
  B.routeZone = function (fork, branch, lx, ly, lz, w, h, d) {
    var c = this.block(lx, ly, lz, w, h, d, null, { trigger: true, tag: 'route' });
    c.fork = fork;
    c.branch = branch;
    return c;
  };

  /* Wegweiser in der Routenfarbe - die Abzweige sollen sichtbar sein. */
  var ROUTE_MAT = ['routeSafe', 'routeFast', 'routeInsane'];
  var ROUTE_NAME = ['SICHER', 'SCHNELL', 'IRRE'];
  B.routeSign = function (lx, ly, lz, branch, o) {
    o = o || {};
    var m = MAT[ROUTE_MAT[branch]];
    var yaw = o.yaw || 0;
    this.deco('box', lx, ly + 2.4, lz, 0.3, 4.8, 0.3, MAT.beam, [0, yaw, 0]);
    this.deco('box', lx, ly + 4.6, lz, 3.2, 0.9, 0.3, m, [0, yaw, 0]);
    /* Pfeilspitze nach vorne */
    this.deco('crystal', lx, ly + 4.6, lz + 1.1, 1.4, 1.6, 1.4, m, [Math.PI / 2, yaw, 0]);
    for (var i = 0; i < branch + 1; i++) {
      this.deco('sphere', lx - 0.9 + i * 0.9, ly + 5.7, lz, 0.5, 0.5, 0.5, m, [0, yaw, 0]);
    }
  };
  B.ROUTE_NAME = ROUTE_NAME;

  /* Schwebendes Tor als Wegmarke an Routeneingaengen. */
  B.routeArch = function (lx, ly, lz, w, h, branch) {
    var m = MAT[ROUTE_MAT[branch]];
    this.deco('box', lx - w / 2, ly + h / 2, lz, 0.6, h, 0.6, m);
    this.deco('box', lx + w / 2, ly + h / 2, lz, 0.6, h, 0.6, m);
    this.deco('box', lx, ly + h, lz, w + 1.2, 0.6, 0.6, m);
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
 * Aufbau als Parcours mit drei Abzweigen. An jedem Abzweig stehen drei
 * Wege nebeneinander und sind von der Kante aus zu sehen:
 *   gruen  SICHER   breit, wenig Risiko, laengster Weg
 *   gold   SCHNELL  schmale Pfeiler, Sprintspruenge am Limit
 *   rot    IRRE     Luecken jenseits des einfachen Sprungs, braucht
 *                   Doppelsprung oder Dash - spart mehrere Sekunden
 * Danach laufen alle drei wieder zusammen.
 *
 * Reichweiten der Figur (gemessen): Laufsprung 10,4 m | Sprintsprung
 * 14,5 m | kurz getippt 9,1 m | Doppelsprung 23,6 m | Dash-Sprung 23,9 m
 * | Dash + Doppelsprung 35 m.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var L = root.MR.level;
  var MAT = L.MAT;

  /* ------------------------------------------------------ 0 - Start */

  function areaStart(b) {
    var r = b.rand, i;
    b.zone('Start', 46, 150, {
      fogCol: [0.74, 0.86, 0.96], fogDensity: 0.0014,
      zenith: [0.15, 0.45, 0.88], horizon: [0.80, 0.91, 0.99],
      skyCol: [0.54, 0.72, 0.96], groundCol: [0.34, 0.40, 0.24],
      sunCol: [1.10, 1.02, 0.86], ambient: 'pollen'
    });

    b.start = { x: b.toWorldX(0, 6), y: b.cursor.y + 0.1, z: b.toWorldZ(0, 6), yaw: b.cursor.yaw };
    b.plat(0, 0, 12, 26, 42, MAT.meadowLush, { thickness: 2.4 });   /* -9 .. 33 */
    b.mass(0, -2.4, 12, 24, 44, 40, MAT.dirt);
    b.arch(0, 0, 16, 12, 6.5, MAT.beam);
    b.deco('box', 0, 7.5, 16, 15, 1.5, 0.5, MAT.flagAlt);
    b.deco('box', 0, 7.5, 16, 10, 1.0, 0.56, MAT.flag);
    b.hut(-14, 0, 8, 1.0, { yaw: 0.8, roof: MAT.roofRed });
    b.fence(10, 0, 4, 20, { yaw: 0 });
    b.fence(-9, 0, 26, 14, { yaw: 0, gap: 4 });
    b.flowers(-5, 0, 22, 8, 18);
    b.flowers(7, 0, 26, 6, 12);
    b.grassTufts(0, 0, 18, 11, 18);
    b.tree(-11, 0, 28, 1.2, { kind: 'broad' });
    b.tree(12, 0, 20, 1.0, { kind: 'fir' });
    b.lantern(-7, 0, 14, 1.0);
    b.lantern(7, 0, 14, 1.0);
    b.sign(9, 0, 30, { yaw: -0.4, second: true });
    b.mark(0, 0, 6);

    /* Sofort Bewegung: zwei versetzte Spruenge und ein Tempofeld */
    b.plat(-5, 1.2, 46, 11, 13, MAT.meadow);      /* 39,5 .. 52,5 */
    b.mass(-5, -0.2, 46, 9, 30, 11, MAT.dirt);
    b.plat(5, 2.4, 62, 11, 13, MAT.meadow);       /* 55,5 .. 68,5 */
    b.mass(5, 1.0, 62, 9, 30, 11, MAT.dirt);
    b.boostPad(5, 2.4, 64, 6, 8, { speed: 34 });
    b.gem(0, 4.2, 54, { hint: 'zwischen den Stufen' });
    b.rock(-9, 1.2, 44, 0.9, { kind: 'flat' });
    b.mark(-5, 1.2, 46);
    b.mark(5, 2.4, 62);

    /* Abzweigplatz: von hier sieht man alle drei Wege in den Canyon */
    b.plat(0, 3.2, 84, 26, 20, MAT.meadow, { thickness: 2.4 });     /* 74 .. 94 */
    b.mass(0, 0.8, 84, 24, 40, 18, MAT.dirt);
    b.routeSign(-12, 3.2, 88, 0);
    b.routeSign(0, 3.2, 90, 1);
    b.routeSign(11, 3.2, 88, 2);
    b.bouncePad(11, 3.2, 92, { power: 33, mat: MAT.routeInsane });
    b.routeMark(0, 2, 11, 3.2, 92);
    b.flowers(-8, 3.2, 78, 4, 8);
    b.mark(0, 3.2, 84);
    return { len: 94, rise: 3.2, turn: 0 };
  }

  /* --------------------------------------- 1 - Abzweig A: Roter Canyon */

  function forkCanyon(b) {
    var r = b.rand, i;
    b.zone('Canyon', 60, 150, {
      fogCol: [0.86, 0.68, 0.56], fogDensity: 0.0022,
      zenith: [0.22, 0.44, 0.80], horizon: [0.96, 0.78, 0.60],
      skyCol: [0.70, 0.58, 0.48], groundCol: [0.42, 0.24, 0.16],
      sunCol: [1.15, 0.94, 0.70], ambient: 'dust'
    });

    /* Canyonwaende */
    for (i = 0; i < 10; i++) {
      var wz = -6 + i * 22;
      b.deco('box', -40 - r() * 6, 4 + r() * 10, wz, 26, 60 + r() * 30, 22, MAT.canyon, [0, (r() - 0.5) * 0.2, 0]);
      b.deco('box', 40 + r() * 6, 4 + r() * 10, wz, 26, 60 + r() * 30, 22, MAT.canyonDark, [0, (r() - 0.5) * 0.2, 0]);
      b.deco('box', -34, 14 + r() * 8, wz + 8, 10, 26, 12, MAT.mesa, [0, (r() - 0.5) * 0.3, 0]);
      b.deco('box', 34, 12 + r() * 8, wz - 8, 10, 26, 12, MAT.canyonLight, [0, (r() - 0.5) * 0.3, 0]);
    }
    for (i = 0; i < 10; i++) {
      b.rock(-28 + r() * 8, -2, r() * 180, 1.2 + r() * 1.4, { mat: MAT.canyon, kind: 'shard' });
      b.rock(26 + r() * 8, -2, r() * 180, 1.2 + r() * 1.4, { mat: MAT.canyonLight, kind: 'stack' });
    }

    /* ---- SICHER: breiter Bogen links, zwei bewegliche Hindernisse ---- */
    b.routeZone(0, 0, -14, 3, 8, 16, 10, 16);
    b.routeArch(-14, 0, 6, 10, 6, 0);
    b.plat(-14, 0, 12, 12, 26, MAT.plank, { thickness: 1.2 });       /* -1 .. 25 */
    b.routeMark(0, 0, -14, 0, 12);
    b.plat(-26, 0.6, 40, 11, 22, MAT.plank, { thickness: 1.2 });     /* 29 .. 51 */
    b.routeMark(0, 0, -26, 0.6, 40);
    b.pendulum(-26, 2.2, 40, { swing: 7, period: 2.5, rope: 8, d: 8, w: 2.2, h: 2.2 });
    b.plat(-29, 1.2, 68, 11, 24, MAT.plank, { thickness: 1.2 });     /* 56 .. 80 */
    b.spinner(-29, 2.0, 68, { len: 14, period: 3.4, h: 1.5, pillar: false });
    b.plat(-28, 1.8, 96, 11, 24, MAT.plank, { thickness: 1.2 });     /* 84 .. 108 */
    b.routeMark(0, 0, -29, 1.2, 68);
    b.routeMark(0, 0, -28, 1.8, 96);
    b.pendulum(-28, 3.4, 96, { swing: 7, period: 2.2, phase: 0.4, rope: 8, d: 8, w: 2.2, h: 2.2 });
    b.plat(-22, 2.4, 124, 11, 24, MAT.plank, { thickness: 1.2 });    /* 112 .. 136 */
    b.pendulum(-22, 4.0, 124, { swing: 7, period: 2.0, phase: 0.2, rope: 8, d: 8, w: 2.2, h: 2.2 });
    b.plat(-11, 3.0, 152, 12, 24, MAT.plank, { thickness: 1.2 });    /* 140 .. 164 */
    b.spinner(-11, 3.8, 152, { len: 14, period: 2.8, h: 1.5, pillar: false });
    b.routeMark(0, 0, -22, 2.4, 124);
    b.routeMark(0, 0, -11, 3.0, 152);
    b.gem(-17, 2.4, 40, { hint: 'sichere Route' });
    /* keine Wegpunkte auf den Nebenaesten - die Kette folgt der schnellen Route */
    for (i = 0; i < 4; i++) {
      b.deco('cylinder', -16 + i * 1.5, -14, 14 + i * 36, 2.4, 30, 2.4, MAT.canyonDark);
    }

    /* ---- SCHNELL: sieben Felspfeiler, Sprintsprung am Limit ---- */
    b.routeZone(0, 1, 2, 3, 6, 12, 10, 12);
    b.routeArch(2, 3, 2, 9, 6, 1);
    for (i = 0; i < 10; i++) {
      var pz = 6 + i * 16;
      var py = 1.0 + i * 0.4;
      var px = 2 + Math.sin(i * 1.1) * 1.6;
      b.plat(px, py, pz, 7, 8, MAT.canyonLight, { thickness: 1.2 });
      b.deco('cylinder', px, py - 16, pz, 6.4, 32, 6.4, MAT.canyon);
      if (i === 1 || i === 3 || i === 5) b.gem(px, py + 1.6, pz, { hint: 'Pfeiler' });
      b.mark(px, py, pz);
      b.routeMark(0, 1, px, py, pz);
    }

    /* ---- IRRE: Hochplateaus, Luecken nur mit Doppelsprung oder Dash ---- */
    b.routeZone(0, 2, 17, 12, 12, 10, 8, 14);
    for (i = 0; i < 7; i++) {
      var iz = 12 + i * 24;
      var iy = 11 + i * 0.5;
      b.plat(17, iy, iz, 7, 9, MAT.mesa, { thickness: 1.4 });
      b.routeMark(0, 2, 17, iy, iz);
      b.deco('cylinder', 17, iy - 20, iz, 6, 40, 6, MAT.canyonDark);
      if (i < 4) b.gem(17, iy + 2.6, iz + 12, { hint: 'im Sprungbogen' });
      if (i === 1) b.gem(17, iy + 1.6, iz, { hint: 'Hochplateau' });
    }
    b.routeArch(17, 11, 6, 8, 5, 2);

    /* ---- Zusammenfuehrung ---- */
    b.plat(0, 4, 180, 28, 22, MAT.mesa, { thickness: 2.4 });         /* 169 .. 191 */
    b.mass(0, 1.6, 180, 26, 44, 20, MAT.canyon);
    b.gate(0, 4, 180, { name: 'Canyon' });
    b.rock(-11, 4, 186, 1.4, { mat: MAT.canyonLight, kind: 'stack' });
    b.mark(0, 4, 180);
    return { len: 191, rise: 4, turn: -18 };
  }

  /* ------------------------------------------- 2 - Tempo-Abfahrt */

  function speedRun(b) {
    var r = b.rand, i;
    b.zone('Abfahrt', 50, 130, {
      fogCol: [0.80, 0.84, 0.92], fogDensity: 0.0018,
      zenith: [0.18, 0.46, 0.86], horizon: [0.86, 0.90, 0.98],
      skyCol: [0.58, 0.72, 0.94], groundCol: [0.36, 0.36, 0.28],
      sunCol: [1.10, 1.02, 0.88], ambient: 'dust'
    });

    b.plat(0, 0, 10, 18, 24, MAT.scree, { thickness: 2.0 });         /* -2 .. 22 */
    b.mass(0, -2, 10, 16, 40, 22, MAT.canyon);
    b.boostPad(0, 0, 8, 8, 10, { speed: 36 });
    b.spinner(0, 1.5, 18, { len: 12, period: 2.8, h: 0.9 });
    b.gem(0, 1.6, 14);
    b.mark(0, 0, 10);

    b.plat(0, -2, 38, 18, 22, MAT.scree, { thickness: 2.0 });        /* 27 .. 49 */
    b.mass(0, -4, 38, 16, 40, 20, MAT.canyon);
    b.boostPad(0, -2, 36, 8, 10, { speed: 36 });
    b.spinner(0, -0.6, 44, { len: 12, period: 2.4, h: 0.9, dir: -1 });
    b.gem(0, -0.4, 40);
    b.mark(0, -2, 38);

    b.plat(0, -4, 62, 18, 22, MAT.scree, { thickness: 2.0 });        /* 51 .. 73 */
    b.mass(0, -6, 62, 16, 40, 20, MAT.canyon);
    b.spinner(0, -2.6, 62, { len: 12, period: 2.2, h: 0.9 });
    b.mark(0, -4, 62);
    b.plat(0, -6, 88, 18, 22, MAT.scree, { thickness: 2.0 });        /* 77 .. 99 */
    b.mass(0, -8, 88, 16, 40, 20, MAT.canyon);
    b.boostPad(0, -6, 94, 10, 10, { speed: 38 });
    b.gem(0, -4.4, 84);
    b.mark(0, -6, 88);

    /* Grosser Sprung ueber die Schlucht - mit Tempofeld locker zu schaffen */
    b.plat(0, -5, 124, 22, 24, MAT.scree, { thickness: 2.4 });       /* 112 .. 136 */
    b.mass(0, -7.4, 124, 20, 44, 22, MAT.canyon);
    b.gem(0, 0.2, 106, { hint: 'im Sprungbogen' });
    b.gate(0, -5, 126, { name: 'Abfahrt' });
    b.mark(0, -5, 124);
    return { len: 136, rise: -5, turn: 22 };
  }

  /* --------------------------------------- 3 - Abzweig B: Wasserfall */

  function forkFalls(b) {
    var r = b.rand, i;
    b.zone('Wasserfall', 60, 150, {
      fogCol: [0.66, 0.80, 0.86], fogDensity: 0.0030,
      zenith: [0.14, 0.42, 0.78], horizon: [0.74, 0.88, 0.94],
      skyCol: [0.46, 0.68, 0.82], groundCol: [0.24, 0.32, 0.34],
      sunCol: [1.02, 0.98, 0.90], ambient: 'spray'
    });

    /* Fluss und Wasserfall */
    b.waterBody(0, -11, 80, 60, 180, { bed: false, foam: 14, mat: MAT.water });
    b.deco('box', -30, 6, 60, 20, 60, 140, MAT.cliff);
    b.waterfall(-22, 6, 34, 9, 34);
    b.deco('box', 30, 6, 60, 20, 60, 140, MAT.cliffWarm);
    b.routeSign(-7, 0, -6, 0);
    b.routeSign(8, 0, -6, 1);
    b.routeSign(-17, 0, -6, 2);

    /* ---- SICHER: Steinbruecke und breite Absaetze ---- */
    b.routeZone(1, 0, -6, 3, 8, 12, 8, 14);
    b.plat(-6, 0, 22, 10, 46, MAT.stone, { thickness: 1.4 });        /* -1 .. 45 */
    b.routeMark(1, 0, -6, 0, 10);
    b.routeMark(1, 0, -6, 0, 36);
    for (i = 0; i < 6; i++) {
      b.deco('cylinder', -6, -6, 2 + i * 9, 2.2, 14, 2.2, MAT.stone);
      b.deco('box', -10.6, 0.9, 2 + i * 9, 0.5, 1.6, 0.5, MAT.stone);
      b.deco('box', -1.4, 0.9, 2 + i * 9, 0.5, 1.6, 0.5, MAT.stone);
    }
    b.plat(-12, 0.6, 58, 10, 20, MAT.stone, { thickness: 1.4 });     /* 48 .. 68 */
    b.spinner(-12, 2.0, 58, { len: 13, period: 3.0, h: 1.5, pillar: false });
    b.plat(-15, 1.2, 84, 11, 22, MAT.stone, { thickness: 1.4 });     /* 73 .. 95 */
    b.plat(-12, 1.8, 112, 11, 22, MAT.stone, { thickness: 1.4 });    /* 101 .. 123 */
    b.spinner(-12, 3.2, 112, { len: 14, period: 2.6, h: 1.5, pillar: false });
    b.plat(-6, 2.4, 140, 11, 22, MAT.stone, { thickness: 1.4 });     /* 129 .. 151 */
    b.routeMark(1, 0, -12, 0.6, 58);
    b.routeMark(1, 0, -15, 1.2, 84);
    b.routeMark(1, 0, -12, 1.8, 112);
    b.routeMark(1, 0, -6, 2.4, 140);
    b.gem(-12, 2.2, 58, { hint: 'sichere Route' });

    /* ---- SCHNELL: Flusssteine, jeder Sprung sitzt ---- */
    b.routeZone(1, 1, 8, 3, 8, 12, 8, 14);
    for (i = 0; i < 9; i++) {
      var sz = 8 + i * 17;
      var sx = 8 + Math.sin(i * 1.3) * 2.2;
      b.plat(sx, 0.5 + i * 0.3, sz, 8, 9, MAT.rockDark, { thickness: 1.2 });
      b.deco('blob', sx, -1.6, sz, 9, 5, 9, MAT.rockDark, [0, r() * 6.28, 0]);
      b.deco('blob', sx + 3, 0.4, sz + 3, 3, 1.2, 3, MAT.foam, [0, r() * 6.28, 0]);
      if (i === 1 || i === 3 || i === 5) b.gem(sx, 2.1 + i * 0.3, sz, { hint: 'Flussstein' });
      b.mark(sx, 0.5 + i * 0.3, sz);
      b.routeMark(1, 1, sx, 0.5 + i * 0.3, sz);
    }

    /* ---- IRRE: Dash durch den Wasserfall in den Tunnel ---- */
    b.routeZone(1, 2, -20, 4, 30, 9, 10, 16);
    b.plat(-20, 1.5, 30, 8, 14, MAT.rockDark, { thickness: 1.4 });   /* 23 .. 37 */
    b.routeMark(1, 2, -20, 1.5, 30);
    b.caveShell(-20, 1.5, 58, 12, 8, 46, { mat: MAT.crystalRock });
    b.plat(-20, 2.5, 76, 8, 76, MAT.crystalRock, { thickness: 1.4 });/* 38 .. 114 */
    for (i = 0; i < 6; i++) {
      b.gem(-20, 4.0, 44 + i * 13, { hint: 'Wasserfalltunnel' });
      b.crystalCluster(-24 + (i % 2) * 8, 2.5, 46 + i * 13, 1.0);
    }
    b.plat(-16, 4, 130, 9, 22, MAT.crystalRock, { thickness: 1.4 }); /* 119 .. 141 */
    b.routeMark(1, 2, -20, 2.5, 60);
    b.routeMark(1, 2, -20, 2.5, 100);
    b.routeMark(1, 2, -16, 4, 130);
    b.routeArch(-20, 1.5, 24, 8, 6, 2);

    /* ---- Zusammenfuehrung ---- */
    b.plat(0, 5, 168, 26, 22, MAT.stone, { thickness: 2.4 });        /* 157 .. 179 */
    b.mass(0, 2.6, 168, 24, 44, 20, MAT.cliff);
    b.gate(0, 5, 168, { name: 'Wasserfall' });
    b.mark(0, 5, 168);
    return { len: 179, rise: 5, turn: -20 };
  }

  /* --------------------------------------- 4 - Kristallhoehle */

  function caveRush(b) {
    var r = b.rand, i;
    b.zone('Kristallhoehle', 40, 110, {
      fogCol: [0.24, 0.18, 0.36], fogDensity: 0.0090,
      zenith: [0.08, 0.06, 0.18], horizon: [0.30, 0.20, 0.44],
      skyCol: [0.30, 0.22, 0.48], groundCol: [0.14, 0.10, 0.22],
      sunCol: [0.80, 0.70, 1.00], ambient: 'sparks'
    });

    b.deco('blob', -9, 6, -2, 16, 18, 14, MAT.crystalRock, [0.2, 0.4, 0]);
    b.deco('blob', 9, 6, -2, 16, 18, 14, MAT.crystalRock, [0.1, 2.2, 0]);
    b.deco('blob', 0, 13, 2, 26, 10, 14, MAT.crystalRock);

    /* Enge S-Kurve: bei Tempo muss gelenkt werden */
    b.plat(0, 0, 12, 11, 28, MAT.crystalRock, { thickness: 1.6 });   /* -2 .. 26 */
    b.caveShell(0, 0, 12, 15, 9, 30, { mat: MAT.crystalRock });
    b.plat(-8, 0.5, 40, 10, 24, MAT.crystalRock, { thickness: 1.6 });/* 28 .. 52 */
    b.caveShell(-8, 0.5, 40, 14, 9, 26, { mat: MAT.crystalRock });
    b.plat(5, 1.0, 66, 10, 24, MAT.crystalRock, { thickness: 1.6 }); /* 54 .. 78 */
    b.caveShell(5, 1.0, 66, 14, 9, 26, { mat: MAT.crystalRock });
    b.plat(-6, 1.5, 92, 10, 24, MAT.crystalRock, { thickness: 1.6 });/* 80 .. 104 */
    b.caveShell(-6, 1.5, 92, 14, 9, 26, { mat: MAT.crystalRock });
    b.boostPad(-6, 1.5, 96, 7, 9, { speed: 36 });

    for (i = 0; i < 12; i++) {
      var cx = (i % 3 - 1) * 7, cz = i * 9;
      b.crystalCluster(cx + (r() - 0.5) * 4, 0.4, cz, 0.8 + r() * 0.9);
      b.deco('crystal', cx, 7.5, cz + 3, 1.2, 3.4, 1.2,
        i % 2 ? MAT.crystalGlow : MAT.crystalGlow2, [Math.PI, r() * 6.28, 0]);
    }
    b.gem(-8, 2.0, 40, { hint: 'Hoehle' });
    b.gem(5, 2.5, 66, { hint: 'Hoehle' });
    b.gate(-6, 1.5, 100, { name: 'Hoehle' });
    b.mark(0, 0, 12);
    b.mark(-8, 0.5, 40);
    b.mark(5, 1.0, 70);
    b.mark(-6, 1.5, 92);
    return { len: 104, rise: 1.5, turn: 24 };
  }

  /* --------------------------------------- 5 - Abzweig C: Tempel */

  function forkTemple(b) {
    var r = b.rand, i;
    b.zone('Tempel', 60, 150, {
      fogCol: [0.86, 0.78, 0.62], fogDensity: 0.0022,
      zenith: [0.26, 0.48, 0.80], horizon: [0.96, 0.86, 0.66],
      skyCol: [0.66, 0.64, 0.62], groundCol: [0.42, 0.36, 0.24],
      sunCol: [1.16, 1.02, 0.78], ambient: 'dust'
    });

    b.plat(0, 0, 2, 30, 18, MAT.sandstoneWorn, { thickness: 2.0 });  /* -7 .. 11 */
    b.mass(0, -2, 2, 28, 40, 16, MAT.cliffWarm);
    b.routeSign(-10, 0, 8, 0);
    b.routeSign(4, 0, 8, 1);
    b.routeSign(12, 0, 9, 2);
    b.bouncePad(12, 0, 4, { power: 34, mat: MAT.routeInsane });
    b.routeMark(2, 2, 12, 0, 4);

    /* ---- SICHER: Freitreppe und breite Hoefe ---- */
    b.routeZone(2, 0, -10, 3, 16, 12, 10, 14);
    b.stairs(-10, 0, 12, 14, { w: 11, rise: 0.4, run: 1.3, mat: MAT.sandstone, rail: true });
    b.plat(-10, 5.6, 40, 13, 26, MAT.marble, { thickness: 2.0 });    /* 27 .. 53 */
    b.routeMark(2, 0, -10, 2.8, 18);
    b.routeMark(2, 0, -10, 5.6, 40);
    b.plat(-22, 6.2, 70, 13, 26, MAT.marble, { thickness: 2.0 });    /* 57 .. 83 */
    b.plat(-24, 6.8, 98, 13, 24, MAT.marble, { thickness: 2.0 });    /* 86 .. 110 */
    b.spinner(-24, 8.2, 98, { len: 16, period: 3.2, h: 1.5, pillar: false, mat: MAT.metal });
    b.plat(-20, 7.4, 128, 13, 26, MAT.marble, { thickness: 2.0 });   /* 115 .. 141 */
    b.plat(-9, 8.0, 158, 13, 24, MAT.marble, { thickness: 2.0 });    /* 146 .. 170 */
    b.routeMark(2, 0, -22, 6.2, 70);
    b.routeMark(2, 0, -24, 6.8, 98);
    b.routeMark(2, 0, -20, 7.4, 128);
    b.routeMark(2, 0, -9, 8.0, 158);
    for (i = 0; i < 5; i++) {
      b.column(-17, 5.6, 30 + i * 14, 5 + r() * 2, { r: 1.2, mat: MAT.sandstone });
      b.column(-4, 5.6, 34 + i * 14, 4 + r() * 2, { r: 1.2, mat: MAT.sandstone });
    }
    b.pendulum(-22, 8.0, 70, { swing: 7, period: 2.4, rope: 7, d: 8, w: 2.2, h: 2.2, mat: MAT.metal });
    b.gem(-10, 7.0, 40, { hint: 'sichere Route' });

    /* ---- SCHNELL: Saeulenkoepfe ---- */
    b.routeZone(2, 1, 4, 3, 16, 10, 10, 14);
    for (i = 0; i < 10; i++) {
      var cz = 16 + i * 16;
      var cx = 4 + Math.sin(i * 1.2) * 1.8;
      var cy = 2.2 + i * 0.7;
      b.column(cx, cy - 5.7, cz, 4.4, { r: 2.8, platform: true, mat: MAT.sandstone, capMat: MAT.templeTrim });
      if (i === 1 || i === 3 || i === 5) b.gem(cx, cy + 1.8, cz, { hint: 'Saeulenkopf' });
      b.mark(cx, cy, cz);
      b.routeMark(2, 1, cx, cy, cz);
    }

    /* ---- IRRE: Aquaedukt in der Hoehe ---- */
    b.routeZone(2, 2, 18, 13, 12, 10, 8, 16);
    for (i = 0; i < 6; i++) {
      var az = 10 + i * 34;
      b.plat(18, 12 + i * 0.5, az, 5.5, 18, MAT.sandstone, { thickness: 1.2 });
      b.routeMark(2, 2, 18, 12 + i * 0.5, az);
      for (var q = 0; q < 3; q++) {
        b.deco('box', 18, 4 + i * 0.5, az - 6 + q * 6, 4.6, 16, 1.6, MAT.sandstoneWorn);
      }
      b.gem(18, 14.6 + i * 0.5, az, { hint: 'Aquaedukt' });
      if (i < 5) b.gem(18, 16.5, az + 17, { hint: 'im Sprungbogen' });
    }
    b.routeArch(18, 12, 4, 7, 5, 2);

    /* ---- Zusammenfuehrung auf dem Turm ---- */
    b.plat(0, 8, 186, 26, 22, MAT.marble, { thickness: 2.4 });       /* 175 .. 197 */
    b.mass(0, 5.6, 186, 24, 44, 20, MAT.cliffWarm);
    b.ruinWall(-12, 8, 190, 14, 5, { yaw: Math.PI / 2 });
    b.ruinWall(12, 8, 190, 14, 5, { yaw: Math.PI / 2 });
    b.gate(0, 8, 186, { name: 'Tempel' });
    b.mark(0, 8, 186);
    return { len: 197, rise: 8, turn: 26 };
  }

  /* --------------------------------------- 6 - Schlussabfahrt */

  function finale(b) {
    var r = b.rand, i;
    b.zone('Gipfel', 60, 160, {
      fogCol: [0.88, 0.93, 1.0], fogDensity: 0.0026,
      zenith: [0.10, 0.36, 0.84], horizon: [0.90, 0.95, 1.0],
      skyCol: [0.62, 0.78, 0.99], groundCol: [0.50, 0.56, 0.64],
      sunCol: [1.14, 1.08, 0.98], ambient: 'snow'
    });

    b.plat(0, 0, 10, 20, 24, MAT.snow, { thickness: 2.2 });          /* -2 .. 22 */
    b.mass(0, -2.2, 10, 18, 44, 22, MAT.cliff);
    b.boostPad(0, 0, 12, 9, 10, { speed: 38 });
    b.mark(0, 0, 10);
    b.snowDrift(-8, 0, 4, 1.2);
    b.iceSpike(9, 0, 6, 1.0);

    b.plat(0, -2, 38, 18, 22, MAT.iceSolid, { thickness: 2.0 });     /* 27 .. 49 */
    b.mass(0, -4, 38, 16, 44, 20, MAT.cliff);
    b.spinner(0, -0.6, 38, { len: 13, period: 2.5, h: 0.9 });
    b.gem(0, -0.4, 44);
    b.mark(0, -2, 38);

    b.plat(0, -4, 64, 18, 22, MAT.snow, { thickness: 2.0 });         /* 53 .. 75 */
    b.mass(0, -6, 64, 16, 44, 20, MAT.cliff);
    b.iceSpike(-8, -4, 58, 1.2);
    b.mark(0, -4, 64);

    b.plat(0, -6, 92, 18, 22, MAT.iceSolid, { thickness: 2.0 });     /* 81 .. 103 */
    b.mass(0, -8, 92, 16, 44, 20, MAT.cliff);
    b.spinner(0, -4.6, 92, { len: 13, period: 2.2, h: 0.9, dir: -1 });
    b.boostPad(0, -6, 98, 14, 10, { speed: 40 });

    /* Schlusssprung durch drei Ringe auf das Zielplateau */
    for (i = 0; i < 3; i++) {
      b.deco('torus', 0, -1.5 + i * 0.8, 112 + i * 6, 9, 9, 9, MAT.gold, [Math.PI / 2, 0, 0]);
    }
    b.gem(0, 1.0, 118, { hint: 'Schlusssprung' });
    b.mark(0, -6, 96);
    b.plat(0, -4, 134, 30, 28, MAT.snow, { thickness: 3.0 });        /* 120 .. 148 */
    b.mass(0, -7, 134, 28, 54, 26, MAT.cliff);
    b.deco('cone', -11, -4, 142, 10, 8, 10, MAT.snow);
    b.deco('cone', 11.5, -4, 139, 8, 7, 8, MAT.snow);
    b.snowDrift(0, -4, 146, 1.8);

    var p = b.toWorld(0, -4, 132, [0, 0, 0]);
    b.finish = { x: p[0], y: p[1], z: p[2], yaw: b.cursor.yaw, r: 8.0 };
    b.arch(0, -4, 132, 14, 8, MAT.gold);
    b.deco('box', 0, 4.9, 132, 16.4, 1.6, 0.6, MAT.flag);
    for (i = 0; i < 7; i++) {
      b.deco('box', -7 + i * 2.3, 3.8, 132, 1.8, 1.2, 0.3, i % 2 ? MAT.flagAlt : MAT.flag);
    }
    b.mark(0, -4, 134);
    return { len: 148, rise: -4, turn: 0 };
  }

  root.MR.level.SECTIONS = [areaStart, forkCanyon, speedRun, forkFalls, caveRush, forkTemple, finale];
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
    if (zoneName === 'Canyon' || zoneName === 'Abfahrt') {
      if (k < 0.5) b.rock(0, 0, 0, 0.9 + r() * 1.8, { kind: r() > 0.5 ? 'shard' : 'stack', mat: MAT.canyon });
      else if (k < 0.72) b.rock(0, 0, 0, 1.0 + r() * 1.6, { kind: 'slab', mat: MAT.canyonLight });
      else if (k < 0.86) b.tree(0, 0, 0, 0.4 + r() * 0.4, { kind: 'dead' });
      else b.rock(0, 0, 0, 0.8 + r() * 1.2, { kind: 'sharp', mat: MAT.mesa });
    } else if (zoneName === 'Kristallhoehle') {
      if (k < 0.55) b.crystalCluster(0, 0, 0, 0.8 + r() * 1.3);
      else b.rock(0, 0, 0, 0.9 + r() * 1.6, { kind: 'shard', mat: MAT.crystalRock });
    } else if (zoneName === 'Wasserfall') {
      if (k < 0.45) b.rock(0, 0, 0, 0.9 + r() * 1.5, { kind: 'round', mat: MAT.rockDark });
      else if (k < 0.7) b.tree(0, 0, 0, 0.6 + r() * 0.7, { kind: 'pine' });
      else if (k < 0.86) b.bush(0, 0, 0, 0.8 + r() * 0.8, { mat: MAT.moss });
      else b.rock(0, 0, 0, 1.0 + r() * 1.4, { kind: 'slab', mat: MAT.scree });
    } else if (zoneName === 'Wald') {
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

  var HILL_MAT = {
    'Start': MAT.meadowLush, 'Canyon': MAT.canyon, 'Abfahrt': MAT.canyonDark,
    'Wasserfall': MAT.cliff, 'Kristallhoehle': MAT.crystalRock,
    'Tempel': MAT.cliffWarm, 'Gipfel': MAT.snow
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
      gates: b.checkpoints,
      zones: b.zones,
      sprayPoints: b.sprayPoints || [],
      finish: b.finish,
      start: b.start,
      bounds: bounds,
      spine: b.spine,
      routePaths: b.routePaths || {},
      pathLength: pathLen,
      medals: medals,
      time: 0
    };

    level.spawn = {
      x: b.start.x, y: b.start.y, z: b.start.z, yaw: b.start.yaw, name: 'Start'
    };
    for (var c2 = 0; c2 < level.gates.length; c2++) level.gates[c2].index = c2;

    /* Absturzgrenze: 24 Einheiten unter dem naechstgelegenen Streckenpunkt.
       Es gibt keine Checkpoints - wer darunter faellt, hat den Lauf beendet. */
    level._floorHint = 0;
    level.floorAt = function (x, z) {
      var sp = this.spine, best = this._floorHint, bd = 1e18;
      for (var i = 0; i < sp.length; i++) {
        var dx = sp[i][0] - x, dz = sp[i][2] - z;
        var d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      this._floorHint = best;
      return sp[best][1] - 24;
    };

    level.reset = function () {
      for (var i2 = 0; i2 < this.ents.length; i2++) if (this.ents[i2].reset) this.ents[i2].reset();
      for (var g = 0; g < this.gems.length; g++) this.gems[g].taken = false;
      for (var e = 0; e < this.enemies.length; e++) {
        this.enemies[e].alive = true;
        this.enemies[e].squash = 0;
      }
      for (var k = 0; k < this.gates.length; k++) {
        this.gates[k].passed = false;
        this.gates[k].flash = 0;
      }
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

      /* Zeittore: reine Zwischenzeit, kein Wiedereinstieg. */
      for (i6 = 0; i6 < this.gates.length; i6++) {
        var gt = this.gates[i6];
        if (gt.flash > 0) gt.flash = Math.max(0, gt.flash - 0.016);
        var lit = gt.passed ? 1 : 0;
        var pulse = 1 + (gt.flash > 0 ? gt.flash * 0.25 : Math.sin(t * 3 + i6) * 0.03);
        var gmat = gt.passed ? MAT.ringOn : MAT.ringOff;
        for (var sgn2 = -1; sgn2 <= 1; sgn2 += 2) {
          var px2 = gt.x + Math.cos(gt.yaw) * sgn2 * 5.2;
          var pz2 = gt.z - Math.sin(gt.yaw) * sgn2 * 5.2;
          m4.composeYaw(TMP, px2, gt.y + 4.2 * pulse, pz2, gt.yaw, 0.55, 8.4 * pulse, 0.55);
          batch.add('box', TMP, gmat);
        }
        m4.composeYaw(TMP, gt.x, gt.y + 8.4 * pulse, gt.z, gt.yaw, 11.4, 0.55, 0.55);
        batch.add('box', TMP, gmat);
        /* Lichtvorhang im Tor */
        m4.composeYaw(TMP, gt.x, gt.y + 4.2, gt.z, gt.yaw, 10.4, 8.4, 0.12);
        glass.add('box', TMP, {
          color: gmat.color, accent: gmat.accent, emissive: 1,
          pattern: 0, patternScale: 1, alpha: (gt.passed ? 0.08 : 0.16) + gt.flash * 0.4
        });
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
