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

  /* Farbwelt: kraeftig und suess statt naturgetreu. Grundton jeder Flaeche
     ist gesaettigt, die Akzentfarbe deutlich heller - so trennt sich jede
     Plattform vom Hintergrund, auch bei Tempo. Alles Anfassbare (Kristalle,
     Sprungfelder, Tempofelder, Routenmarken) leuchtet zusaetzlich. */
  var MAT = {
    /* --- Almwiese: Limette und Karamell --- */
    meadow: mat([0.58, 0.30, 0.14], [0.19, 0.62, 0.20], { pattern: 5, patternScale: 0.55 }),
    meadowLush: mat([0.52, 0.27, 0.13], [0.15, 0.66, 0.28], { pattern: 5, patternScale: 0.8 }),
    meadowDry: mat([0.62, 0.38, 0.13], [0.66, 0.62, 0.18], { pattern: 5, patternScale: 0.6 }),
    dirt: mat([0.52, 0.29, 0.15], [0.80, 0.50, 0.22], { pattern: 3, patternScale: 0.6 }),
    plank: mat([0.66, 0.33, 0.13], [1.0, 0.68, 0.28], { pattern: 2, patternScale: 0.6 }),
    plankPale: mat([0.78, 0.51, 0.23], [1.0, 0.87, 0.55], { pattern: 2, patternScale: 0.75 }),
    beam: mat([0.46, 0.21, 0.09], [0.70, 0.37, 0.16], { pattern: 2, patternScale: 1.2 }),
    roofRed: mat([0.74, 0.09, 0.22], [1.0, 0.36, 0.31], { pattern: 2, patternScale: 1.4 }),
    roofBlue: mat([0.09, 0.25, 0.68], [0.30, 0.62, 1.0], { pattern: 2, patternScale: 1.4 }),
    wall: mat([0.86, 0.77, 0.60], [1.0, 0.99, 0.90], { pattern: 3, patternScale: 0.8 }),
    hay: mat([0.76, 0.49, 0.09], [1.0, 0.91, 0.32], { pattern: 5, patternScale: 1.6 }),

    /* --- Wald: sattes Blattgruen, kein Graubraun --- */
    forestFloor: mat([0.40, 0.21, 0.11], [0.15, 0.44, 0.16], { pattern: 5, patternScale: 0.7 }),
    moss: mat([0.20, 0.35, 0.13], [0.20, 0.58, 0.20], { pattern: 5, patternScale: 1.1 }),
    bark: mat([0.42, 0.21, 0.12], [0.64, 0.35, 0.18], { pattern: 2, patternScale: 1.4 }),
    barkPale: mat([0.80, 0.71, 0.58], [1.0, 0.99, 0.91], { pattern: 2, patternScale: 1.8 }),
    barkDark: mat([0.26, 0.11, 0.16], [0.41, 0.22, 0.27], { pattern: 2, patternScale: 1.2 }),
    leafDark: mat([0.03, 0.33, 0.19], [0.13, 0.76, 0.32], { pattern: 5, patternScale: 1.0 }),
    leafMid: mat([0.06, 0.43, 0.21], [0.23, 0.94, 0.36], { pattern: 5, patternScale: 1.0 }),
    leafLight: mat([0.17, 0.57, 0.17], [0.56, 1.0, 0.40], { pattern: 5, patternScale: 1.0 }),
    leafAutumn: mat([0.72, 0.21, 0.03], [1.0, 0.68, 0.14], { pattern: 5, patternScale: 1.0 }),
    /* Bonbonfarbene Kronen zwischen den gruenen: ohne sie ist eine Wiese
       voller Baeume eine einzige gruene Flaeche. */
    /* Grasnarbe, die ueber die Felskante haengt: oben Gras, an der
       Unterkante erdig - genau die Kante, an der eine Plattform sonst als
       sauberer Quader endet. */
    /* Abgelaufene Erde im Gras: dieselbe Farbe wie die Plattformseite,
       damit die Flecken wie durchscheinender Untergrund wirken. */
    dirtPatch: mat([0.50, 0.30, 0.16], [0.56, 0.36, 0.19], { pattern: 3, patternScale: 0.7 }),
    turf: mat([0.30, 0.52, 0.16], [0.19, 0.62, 0.20], { pattern: 5, patternScale: 0.9 }),
    turfLush: mat([0.26, 0.54, 0.20], [0.15, 0.66, 0.28], { pattern: 5, patternScale: 1.1 }),
    turfDry: mat([0.46, 0.44, 0.14], [0.66, 0.62, 0.18], { pattern: 5, patternScale: 0.8 }),
    turfCool: mat([0.20, 0.38, 0.14], [0.15, 0.44, 0.16], { pattern: 5, patternScale: 0.9 }),

    /* Muster 10 heisst: dieser Koerper schwingt im Wind und wird vom Grund
       zur Spitze heller. Nur fuer Halme und Buesche, nicht fuer den Boden. */
    grassBlade: mat([0.07, 0.40, 0.14], [0.36, 0.92, 0.26], { pattern: 10 }),
    grassBladeDry: mat([0.30, 0.34, 0.08], [0.82, 0.80, 0.24], { pattern: 10 }),
    grassBladeCool: mat([0.04, 0.30, 0.19], [0.24, 0.80, 0.42], { pattern: 10 }),
    leafBlossom: mat([0.62, 0.09, 0.34], [1.0, 0.52, 0.82], { pattern: 5, patternScale: 1.0 }),
    leafTeal: mat([0.03, 0.41, 0.44], [0.22, 0.95, 0.86], { pattern: 5, patternScale: 1.0 }),
    shroomCap: mat([0.90, 0.09, 0.31], [1.0, 0.36, 0.48], { emissive: 0.14 }),
    shroomCap2: mat([0.21, 0.44, 0.96], [0.52, 0.80, 1.0], { emissive: 0.14 }),
    shroomStem: mat([0.97, 0.93, 0.83], [1.0, 1.0, 0.97]),

    /* --- Schlucht: Fels violett-blau getoent statt neutral grau --- */
    cliff: mat([0.25, 0.26, 0.46], [0.53, 0.57, 0.84], { pattern: 3, patternScale: 0.26 }),
    cliffWarm: mat([0.52, 0.26, 0.13], [0.88, 0.57, 0.31], { pattern: 3, patternScale: 0.35 }),
    rock: mat([0.31, 0.33, 0.55], [0.65, 0.70, 0.94], { pattern: 3, patternScale: 0.45 }),
    rockDark: mat([0.15, 0.16, 0.32], [0.33, 0.36, 0.58], { pattern: 3, patternScale: 0.5 }),
    scree: mat([0.43, 0.39, 0.50], [0.81, 0.76, 0.88], { pattern: 3, patternScale: 0.9 }),
    caveRock: mat([0.12, 0.06, 0.31], [0.30, 0.17, 0.60], { pattern: 3, patternScale: 0.5 }),
    caveGlow: mat([0.12, 0.94, 1.0], [0.78, 1.0, 1.0], { emissive: 1.1, pattern: 6, patternScale: 3 }),
    water: mat([0.02, 0.35, 0.76], [0.38, 0.97, 1.0], { pattern: 4, patternScale: 0.35, alpha: 0.76 }),
    waterShallow: mat([0.05, 0.52, 0.82], [0.62, 1.0, 1.0], { pattern: 4, patternScale: 0.6, alpha: 0.62 }),
    fall: mat([0.30, 0.76, 1.0], [0.92, 1.0, 1.0], { pattern: 8, patternScale: 0.16, alpha: 0.62, emissive: 0.22 }),
    foam: mat([0.92, 0.98, 1.0], [1.0, 1.0, 1.0], { emissive: 0.3, alpha: 0.8 }),

    /* --- Ruinen: Honiggold und Tuerkis --- */
    sandstone: mat([0.74, 0.49, 0.18], [1.0, 0.91, 0.58], { pattern: 1, patternScale: 0.4 }),
    sandstoneWorn: mat([0.63, 0.41, 0.16], [0.99, 0.81, 0.48], { pattern: 3, patternScale: 0.55 }),
    marble: mat([0.71, 0.71, 0.88], [1.0, 1.0, 1.0], { pattern: 1, patternScale: 0.5 }),
    stone: mat([0.37, 0.43, 0.65], [0.77, 0.84, 1.0], { pattern: 1, patternScale: 0.45 }),
    templeTrim: mat([0.05, 0.43, 0.41], [0.34, 0.98, 0.88], { pattern: 1, patternScale: 0.9 }),
    gold: mat([1.0, 0.74, 0.10], [1.0, 0.97, 0.62], { emissive: 0.7 }),
    vine: mat([0.08, 0.37, 0.15], [0.28, 0.90, 0.30], { pattern: 5, patternScale: 1.4 }),

    /* --- Gipfel: Weiss mit kraeftigem Eisblau --- */
    snow: mat([0.57, 0.73, 1.0], [1.0, 1.0, 1.0], { pattern: 3, patternScale: 0.3 }),
    snowDeep: mat([0.47, 0.65, 0.99], [0.96, 0.99, 1.0], { pattern: 3, patternScale: 0.5 }),
    ice: mat([0.09, 0.55, 0.97], [0.76, 1.0, 1.0], { emissive: 0.26, pattern: 6, patternScale: 1.6, alpha: 0.9 }),
    iceSolid: mat([0.17, 0.63, 1.0], [0.84, 1.0, 1.0], { emissive: 0.18, pattern: 6, patternScale: 1.2 }),

    /* --- Canyon: Korallenrot statt Ziegelbraun --- */
    canyon: mat([0.58, 0.18, 0.13], [0.92, 0.52, 0.31], { pattern: 3, patternScale: 0.30 }),
    canyonDark: mat([0.40, 0.09, 0.08], [0.74, 0.27, 0.19], { pattern: 3, patternScale: 0.40 }),
    canyonLight: mat([0.78, 0.34, 0.20], [0.98, 0.76, 0.50], { pattern: 3, patternScale: 0.55 }),
    /* Begehbare Flaechen im Canyon: Seiten im Wandton, Oberseite hell und
       sandfarben. Waren Wand und Weg beide warmrot, sah man im Lauf nicht,
       worauf man treten kann. */
    canyonDeck: mat([0.66, 0.19, 0.11], [0.97, 0.84, 0.60], { pattern: 3, patternScale: 0.5 }),
    mesa: mat([0.66, 0.23, 0.15], [0.94, 0.62, 0.40], { pattern: 1, patternScale: 0.22 }),

    /* --- Kristallhoehle: Magenta und Cyan --- */
    crystalRock: mat([0.11, 0.05, 0.31], [0.31, 0.17, 0.62], { pattern: 3, patternScale: 0.5 }),
    crystalGlow: mat([0.92, 0.16, 1.0], [1.0, 0.74, 1.0], { emissive: 1.2, pattern: 6, patternScale: 2.6 }),
    crystalGlow2: mat([0.08, 0.88, 1.0], [0.72, 1.0, 1.0], { emissive: 1.2, pattern: 6, patternScale: 2.6 }),

    /* --- Routenfarben: gruen sicher, gold schnell, pink irre --- */
    routeSafe: mat([0.08, 0.97, 0.52], [0.66, 1.0, 0.86], { emissive: 1.1 }),
    routeFast: mat([1.0, 0.78, 0.06], [1.0, 0.99, 0.64], { emissive: 1.1 }),
    routeInsane: mat([1.0, 0.11, 0.46], [1.0, 0.60, 0.78], { emissive: 1.1 }),

    /* --- Gemeinsam --- */
    gem: mat([1.0, 0.80, 0.05], [1.0, 1.0, 0.68], { emissive: 1.0, pattern: 6, patternScale: 2.4 }),
    bounce: mat([1.0, 0.13, 0.42], [1.0, 0.53, 0.71], { emissive: 0.5 }),
    bounceStem: mat([1.0, 0.97, 0.89], [1.0, 1.0, 1.0]),
    boost: mat([0.07, 0.09, 0.34], [1.0, 0.87, 0.12], { pattern: 9, patternScale: 0.35, emissive: 0.8 }),
    hazard: mat([0.63, 0.05, 0.74], [1.0, 0.31, 1.0], { emissive: 0.75, pattern: 6, patternScale: 2 }),
    spike: mat([0.70, 0.68, 0.80], [0.95, 0.93, 1.0], { emissive: 0.08 }),
    enemy: mat([0.56, 0.19, 0.94], [0.87, 0.57, 1.0], { emissive: 0.2 }),
    enemyAlt: mat([0.97, 0.26, 0.13], [1.0, 0.61, 0.31], { emissive: 0.2 }),
    enemyForest: mat([0.23, 0.72, 0.19], [0.53, 1.0, 0.37], { emissive: 0.18 }),
    eye: mat([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], { emissive: 0.4 }),
    pupil: mat([0.05, 0.05, 0.1], [0.05, 0.05, 0.1]),
    ringOff: mat([0.14, 0.72, 0.98], [0.62, 0.98, 1.0], { emissive: 0.8 }),
    ringOn: mat([1.0, 0.76, 0.07], [1.0, 0.99, 0.58], { emissive: 1.15 }),
    flag: mat([1.0, 0.13, 0.34], [1.0, 0.57, 0.52], { emissive: 0.3 }),
    flagAlt: mat([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], { emissive: 0.2 }),
    lantern: mat([1.0, 0.88, 0.40], [1.0, 1.0, 0.86], { emissive: 1.1 }),
    metal: mat([0.34, 0.36, 0.50], [0.57, 0.61, 0.78]),
    rope: mat([0.58, 0.40, 0.20], [0.76, 0.57, 0.29]),
    cloud: mat([0.95, 0.97, 1.0], [1.0, 1.0, 1.0], { emissive: 0.14 }),
    shaft: mat([1.0, 0.96, 0.80], [1.0, 1.0, 0.94], { emissive: 1.0, alpha: 0.055 }),
    mist: mat([0.86, 0.95, 1.0], [1.0, 1.0, 1.0], { emissive: 0.25, alpha: 0.10 }),
    far: mat([0.29, 0.37, 0.67], [0.77, 0.87, 1.0], { pattern: 3, patternScale: 0.04 }),
    farWarm: mat([0.43, 0.33, 0.61], [0.93, 0.87, 1.0], { pattern: 3, patternScale: 0.05 }),
    shadow: mat([0.02, 0.05, 0.09], null, { pattern: 7, alpha: 0.4 })
  };

  /* Blumenfarben fuer die Wiese */
  var FLOWERS = [
    [1.0, 0.88, 0.12], [1.0, 0.24, 0.48], [0.76, 0.32, 1.0],
    [1.0, 1.0, 1.0], [1.0, 0.50, 0.10], [0.24, 0.66, 1.0]
  ];

  /* ------------------------------------------------------------ Builder */

  function Builder() {
    this.world = new Physics.World();
    this.visuals = [];        /* {mesh, m, mat} - einmalig hochgeladen */
    /* Kulisse: Wolken und Fernberge. Sie werden gezeichnet, werfen aber
       keinen Schatten - eine Wolke als harter dunkler Fleck auf der Wiese
       sieht falsch aus, und ein Fernberg wuerde die Schattenkarte
       vollstaendig ausfuellen. */
    this.far = [];
    this.farMode = false;
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
  /* Kantenbehandlung einer Plattform: ueberstehende Grasnarbe und ein Saum
     aus Brocken. Rein dekorativ - der Koerper fuer die Physik bleibt der
     Quader darunter, sonst wuerden Spruenge anders ausgehen als gemessen.
     Nur fuer feste Plattformen ab 5 Einheiten Kantenlaenge; bewegliche
     bekommen nichts, ihre Deko wuerde stehenbleiben. */
  var TURF_FOR = null;
  var ROCK_MESHES = ['rock', 'rock2', 'rock3'];

  Builder.prototype.platTrim = function (lx, ly, lz, w, d, m) {
    var r = this.rand;
    /* `pick` liegt im zweiten Modul - hier eine eigene kleine Auswahl. */
    function rockMesh() { return ROCK_MESHES[Math.floor(r() * 3) % 3]; }
    if (!TURF_FOR) {
      TURF_FOR = [
        [MAT.meadow, MAT.turf], [MAT.meadowLush, MAT.turfLush],
        [MAT.meadowDry, MAT.turfDry], [MAT.forestFloor, MAT.turfCool],
        [MAT.moss, MAT.turfCool]
      ];
    }
    var turf = null;
    for (var i = 0; i < TURF_FOR.length; i++) if (TURF_FOR[i][0] === m) { turf = TURF_FOR[i][1]; break; }

    if (turf) {
      /* Narbe leicht ueberstehend und minimal ueber der Oberflaeche. */
      this.deco('box', lx, ly - 0.15, lz, w + 0.8, 0.34, d + 0.8, turf);
      /* Unruhige Kante: kleine Grasbrocken entlang des Randes. */
      var per = Math.round((w + d) * 0.16);
      for (var e = 0; e < per; e++) {
        var side = e % 4, f = r();
        var ex = 0, ez = 0;
        if (side === 0) { ex = (f - 0.5) * w; ez = d / 2 + 0.3; }
        else if (side === 1) { ex = (f - 0.5) * w; ez = -d / 2 - 0.3; }
        else if (side === 2) { ex = w / 2 + 0.3; ez = (f - 0.5) * d; }
        else { ex = -w / 2 - 0.3; ez = (f - 0.5) * d; }
        var es = 0.8 + r() * 1.1;
        this.deco(rockMesh(), lx + ex, ly - 0.2, lz + ez,
          es * 1.5, es * 0.55, es * 1.4, turf, [(r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3]);
      }
    }

    if (turf) {
      /* Abgelaufene Erdstellen: flache Flecken knapp ueber der Oberflaeche.
         Sie muessen flach bleiben - eine Erhebung mitten auf der Lauflinie
         haette keinen Koerper und man liefe sichtbar hindurch. */
      var patches = 2 + Math.floor(r() * 3);
      for (var pI = 0; pI < patches; pI++) {
        var px2 = (r() - 0.5) * w * 0.8, pz2 = (r() - 0.5) * d * 0.8;
        var ps2 = 1.6 + r() * 3.4;
        this.deco('blob', lx + px2, ly + 0.03, lz + pz2, ps2 * 1.6, 0.10, ps2 * 1.3,
          MAT.dirtPatch, [0, r() * 6.28, 0]);
      }
      /* Gelaendewellen ausserhalb der Lauflaeche: Relief, ohne dass jemand
         darauf treten koennte. */
      var mounds = 2 + Math.floor(r() * 2);
      for (var mI2 = 0; mI2 < mounds; mI2++) {
        var ms = 0;
        var mx = 0, mz = 0;
        if (mI2 % 2) { mx = (r() > 0.5 ? 1 : -1) * (w / 2 + 2.5 + r() * 2); mz = (r() - 0.5) * d; }
        else { mz = (r() > 0.5 ? 1 : -1) * (d / 2 + 2.5 + r() * 2); mx = (r() - 0.5) * w; }
        ms = 3 + r() * 4;
        this.deco('blob', lx + mx, ly - 0.7 + r() * 0.5, lz + mz, ms * 2.0, ms * 0.7, ms * 1.7,
          turf, [0, r() * 6.28, 0]);
        this.grassTufts(lx + mx, ly + ms * 0.2, lz + mz, ms * 0.7, 4,
          { mat: MAT.grassBlade, size: 0.9 });
      }
    }

    /* Saum aus Brocken am Fuss der Kante - bricht die gerade Quaderlinie. */
    var rockMat = turf ? MAT.rockDark : null;
    if (!rockMat) {
      if (m === MAT.snow || m === MAT.snowDeep || m === MAT.iceSolid) rockMat = MAT.rock;
      else if (m === MAT.sandstone || m === MAT.sandstoneWorn || m === MAT.marble) rockMat = MAT.sandstoneWorn;
      else if (m === MAT.canyon || m === MAT.canyonLight || m === MAT.mesa) rockMat = MAT.canyonDark;
    }
    if (!rockMat) return;
    var n = Math.round((w + d) * 0.10);
    for (var k = 0; k < n; k++) {
      var sd = k % 4, g = r();
      var gx = 0, gz = 0;
      if (sd === 0) { gx = (g - 0.5) * w * 0.9; gz = d / 2; }
      else if (sd === 1) { gx = (g - 0.5) * w * 0.9; gz = -d / 2; }
      else if (sd === 2) { gx = w / 2; gz = (g - 0.5) * d * 0.9; }
      else { gx = -w / 2; gz = (g - 0.5) * d * 0.9; }
      var gs = 0.9 + r() * 1.3;
      this.deco(rockMesh(), lx + gx, ly - 0.9 - r() * 0.7, lz + gz,
        gs * 1.7, gs * 1.5, gs * 1.6, rockMat, [(r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5]);
    }
  };

  Builder.prototype.deco = function (mesh, lx, ly, lz, sx, sy, sz, material, rot) {
    var m = new Float32Array(16);
    var x = this.toWorldX(lx, lz), z = this.toWorldZ(lx, lz), y = this.cursor.y + ly;
    if (rot && (rot[0] || rot[2])) {
      m4.compose(m, x, y, z, rot[0], this.cursor.yaw + (rot[1] || 0), rot[2], sx, sy, sz);
    } else {
      m4.composeYaw(m, x, y, z, this.cursor.yaw + (rot ? rot[1] : 0), sx, sy, sz);
    }
    var entry = { mesh: mesh, m: m, mat: material };
    if (material.alpha < 1) this.glass.push(entry);
    else if (this.farMode) this.far.push(entry);
    else this.visuals.push(entry);
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
  /* Wiesen- und Waldboeden bekommen von selbst Halme. Das haendisch je
     Plattform zu setzen wurde vergessen, sobald eine dazukam - hier kann
     es nicht mehr auseinanderlaufen. `grass: false` schaltet es ab. */
  var GRASS_FOR = null;

  Builder.prototype.plat = function (lx, ly, lz, w, d, material, opts) {
    opts = opts || {};
    var t = opts.thickness || 1.4;
    var m = material || MAT.meadow;
    var c = this.block(lx, ly - t / 2, lz, w, t, d, m, opts);
    if (!opts.dynamic && opts.trim !== false && w >= 5 && d >= 5) this.platTrim(lx, ly, lz, w, d, m);
    if (opts.grass !== false) {
      if (!GRASS_FOR) {
        GRASS_FOR = [
          [MAT.meadow, MAT.grassBlade, 0.62, 1.0],
          [MAT.meadowLush, MAT.grassBlade, 0.80, 1.1],
          [MAT.meadowDry, MAT.grassBladeDry, 0.50, 0.95],
          [MAT.forestFloor, MAT.grassBladeCool, 0.55, 0.9],
          [MAT.moss, MAT.grassBladeCool, 0.70, 0.85]
        ];
      }
      for (var i = 0; i < GRASS_FOR.length; i++) {
        if (GRASS_FOR[i][0] === m) {
          this.grassField(lx, ly, lz, w, d,
            { mat: GRASS_FOR[i][1], density: opts.grassDensity || GRASS_FOR[i][2], size: GRASS_FOR[i][3] });
          break;
        }
      }
    }
    return c;
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
    broad: [MAT.leafLight, MAT.leafMid, MAT.leafBlossom],
    birch: [MAT.leafLight, MAT.leafBlossom, MAT.leafTeal],
    autumn: [MAT.leafAutumn, MAT.leafBlossom]
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
    /* Stamm aus drei Abschnitten, nach oben duenner und leicht versetzt:
       ein durchgehender Zylinder liest sich sofort als Grundkoerper. */
    var segs = 3, sy = ly, sx = lx, sz = lz, lean = tilt * 2.2;
    for (var t2 = 0; t2 < segs; t2++) {
      var f2 = t2 / segs;
      var sh = th / segs;
      var wTop = tw * (1 - (t2 + 1) / segs * 0.34);
      var wBot = tw * (1 - f2 * 0.34);
      this.deco('pillar', sx, sy + sh * 0.5, sz, wBot * 2, sh, wBot * 2,
        trunkMat, [lean * (0.4 + f2), spin + t2 * 0.7, lean * 0.3]);
      sx += lean * sh * 0.5;
      sz += lean * sh * 0.3;
      sy += sh * 0.98;
      tw = wTop;
    }
    /* Wurzelanlauf: drei Keile am Fuss, damit der Stamm nicht auf einer
       sauberen Kreisflaeche endet. */
    for (var w2 = 0; w2 < 3; w2++) {
      var wa = spin + w2 * 2.1;
      this.deco('rock', lx + Math.cos(wa) * tw * 1.1, ly + 0.22 * s, lz + Math.sin(wa) * tw * 1.1,
        tw * 1.5, 0.7 * s, tw * 1.4, trunkMat, [0, wa, 0]);
    }
    /* Moos- und Grasrand am Stammfuss */
    if (r() > 0.4) this.grassTufts(lx, ly, lz, 1.6 * s, 3, { mat: MAT.grassBladeCool, size: 0.8 * s });
    var topX = sx, topY = sy, topZ = sz;

    /* Krone aus mehreren versetzten Ballen statt eines Koerpers - das gibt
       eine unruhige Silhouette. Die Ballen nutzen die Felskoerper, weil
       deren Hoecker organischer sind als eine glatte Kugel. */
    function crown(self, cx, cy, cz, w, n, flat) {
      for (var c2 = 0; c2 < n; c2++) {
        var ca = r() * 6.28, cd = (c2 === 0 ? 0 : (0.25 + r() * 0.45)) * w;
        var cs = w * (c2 === 0 ? 1 : 0.42 + r() * 0.4);
        self.deco(pick(r, ['rock', 'rock2', 'rock3', 'blob']),
          cx + Math.cos(ca) * cd, cy + (r() - 0.4) * w * 0.28, cz + Math.sin(ca) * cd * 0.8,
          cs, cs * (flat ? 0.62 : 0.86), cs * 0.95, leaf, [(r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3]);
      }
    }

    if (kind === 'broad' || kind === 'autumn') {
      var cw = (4.6 + r() * 2.2) * s;
      crown(this, topX, topY + cw * 0.34, topZ, cw, 5, false);
    } else if (kind === 'birch') {
      for (var b = 0; b < 3; b++) {
        this.deco('cylinder', lx, ly + (2.4 + b * 1.6) * s, lz, tw * 1.3, 0.12 * s, tw * 1.3, MAT.barkDark, [tilt, spin, 0]);
      }
      var bw = (3.0 + r() * 1.2) * s;
      crown(this, topX, topY + bw * 0.4, topZ, bw, 4, false);
    } else {
      /* Nadelbaum: gestapelte Kegel, oben schmaler */
      /* Nadelbaum: gestapelte Kegel, aber jede Etage gedreht, verschoben und
         mit zwei kleinen Ballen am Rand - so wird aus dem Stapel eine
         zerzauste Krone statt eines Christbaums aus der Form. */
      var levels = kind === 'pine' ? 4 : 4 + Math.floor(r() * 2);
      var base = (4.4 + r() * 1.8) * s;
      var top = th * (kind === 'pine' ? 0.62 : 0.45);
      for (var i = 0; i < levels; i++) {
        var f = i / levels;
        var lw = base * (1 - f * 0.66) * (0.88 + r() * 0.24);
        var cxl = lx + lean * (top + i * 2) * 0.35 + (r() - 0.5) * 0.3 * s;
        var czl = lz + (r() - 0.5) * 0.3 * s;
        var cyl = ly + top + i * 1.85 * s;
        this.deco('cone', cxl, cyl, czl, lw, (4.3 - f * 1.3) * s, lw * (0.9 + r() * 0.2),
          leaf, [(r() - 0.5) * 0.10, spin + i * 1.1 + r(), (r() - 0.5) * 0.10]);
        if (i < levels - 1 && r() > 0.35) {
          var ba = r() * 6.28;
          this.deco(pick(r, ['rock2', 'blob']),
            cxl + Math.cos(ba) * lw * 0.42, cyl + 0.7 * s, czl + Math.sin(ba) * lw * 0.42,
            lw * 0.38, lw * 0.3, lw * 0.36, leaf, [0, r() * 6.28, 0]);
        }
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
      var fm = pick(r, ['rock', 'rock2', 'rock3']);
      this.deco(fm, lx, ly + 0.34 * s, lz, 3.8 * s, 1.0 * s, 2.6 * s, col, [(r() - 0.5) * 0.2, spin, (r() - 0.5) * 0.2]);
      /* Kleine Brocken am Fuss: so steht kein Fels auf einer sauberen Kante. */
      for (var g2 = 0; g2 < 3; g2++) {
        var ga = spin + g2 * 2.1 + r();
        var gs = s * (0.28 + r() * 0.3);
        this.deco(pick(r, ['rock', 'rock2', 'rock3']),
          lx + Math.cos(ga) * 1.9 * s, ly + gs * 0.4, lz + Math.sin(ga) * 1.5 * s,
          gs * 2.4, gs * 1.5, gs * 2.2, col, [(r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5]);
      }
    } else if (kind === 'stack') {
      var yy = ly;
      for (var i = 0; i < 3; i++) {
        var sc = (1.9 - i * 0.45) * s;
        this.deco(pick(r, ['rock', 'rock2', 'rock3']), lx + (r() - 0.5) * 0.6, yy + sc * 0.4, lz + (r() - 0.5) * 0.6,
          sc * (1.5 + r() * 0.6), sc * 0.9, sc * (1.4 + r() * 0.5), col, [(r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3]);
        yy += sc * 0.75;
      }
    } else {
      /* "Rund" heisst hier: unregelmaessig, nie eine saubere Kugel. Die
         drei Felskoerper haben feste, aber verschiedene Hoecker - die
         Abwechslung kommt aus Drehung und ungleicher Skalierung. */
      this.deco(pick(r, ['rock', 'rock2', 'rock3']), lx, ly + 0.7 * s, lz,
        2.8 * s * (0.75 + r() * 0.6), 1.7 * s * (0.7 + r() * 0.7), 2.4 * s * (0.75 + r() * 0.6),
        col, [(r() - 0.5) * 0.4, spin, (r() - 0.5) * 0.4]);
      this.deco(pick(r, ['rock', 'rock2', 'rock3']), lx + s * 0.8, ly + 0.35 * s, lz - s * 0.5,
        1.5 * s, 1.0 * s, 1.4 * s, col, [(r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4]);
      for (var g3 = 0; g3 < 2; g3++) {
        var ga3 = spin + g3 * 2.7 + r();
        var gs3 = s * (0.25 + r() * 0.25);
        this.deco(pick(r, ['rock', 'rock2', 'rock3']),
          lx + Math.cos(ga3) * 2.0 * s, ly + gs3 * 0.45, lz + Math.sin(ga3) * 1.7 * s,
          gs3 * 2.3, gs3 * 1.6, gs3 * 2.1, col, [(r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6]);
      }
    }
    /* Moos am Fuss, wo Fels auf Boden trifft. */
    if (o.moss !== false && r() > 0.45) {
      this.grassTufts(lx, ly, lz, 2.2 * s, 3, { mat: MAT.grassBladeCool, size: 0.7 * s });
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

  /* Ein Buechel echter Halme. Groesse, Drehung und Farbton streuen, sonst
     sieht ein Feld aus wie ein Stempelmuster. */
  B.tuft = function (lx, ly, lz, s, m) {
    var r = this.rand;
    var base = m || MAT.grassBlade;
    var col = L.mat(vary(r, base.color, 0.10), vary(r, base.accent, 0.12),
      { pattern: 10, patternScale: 1 });
    /* 0,5 ist die Grundhoehe eines Buechels in Metern - die Figur ist 1,7
       hoch, Gras soll ihr etwa bis zum Knie gehen. */
    var hs = s * 0.5;
    this.deco('tuft', lx, ly, lz, hs * (0.85 + r() * 0.5), hs * (0.8 + r() * 0.9), hs * (0.85 + r() * 0.5),
      col, [0, r() * 6.28, 0]);
  };

  /* Runde Flaeche voller Halme - fuer Raender und Inseln. */
  B.grassTufts = function (lx, ly, lz, spread, n, o) {
    var r = this.rand;
    var m = (o && o.mat) || MAT.grassBlade;
    var s = (o && o.size) || 1;
    for (var i = 0; i < n; i++) {
      var a = r() * 6.28, d = Math.sqrt(r()) * spread;
      this.tuft(lx + Math.cos(a) * d, ly, lz + Math.sin(a) * d, s * (0.8 + r() * 0.7), m);
    }
  };

  /* Rechteckige Flaeche: deckt eine Plattform ab. Die Halme stehen dichter
     am Rand, dort sieht man sie im Profil gegen den Himmel. */
  B.grassField = function (lx, ly, lz, w, d, o) {
    o = o || {};
    var r = this.rand;
    var m = o.mat || MAT.grassBlade;
    var dens = o.density || 0.10;          /* Buechel je Quadrateinheit */
    var s = o.size || 1;
    var n = Math.max(6, Math.round(w * d * dens));
    var hw = w / 2 - 0.4, hd = d / 2 - 0.4;
    for (var i = 0; i < n; i++) {
      var x = (r() * 2 - 1) * hw, z = (r() * 2 - 1) * hd;
      /* Randnaehe: 0 in der Mitte, 1 aussen */
      var edge = Math.max(Math.abs(x) / Math.max(hw, 0.001), Math.abs(z) / Math.max(hd, 0.001));
      var sc = s * (0.7 + r() * 0.6) * (1 + edge * 0.55);
      this.tuft(lx + x, ly, lz + z, sc, m);
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

  /* Wasserfall als Blickfang: mehrere unterschiedlich breite Straenge
     statt eines Vorhangs, eine ueberkippende Lippe oben, Gischt und
     Nebelsaeule unten, Felsen an den Flanken. Ein einzelner Quader mit
     Streifenmuster liest sich sofort als Platzhalter. */
  B.waterfall = function (lx, ly, lz, w, h, o) {
    o = o || {};
    var r = this.rand;
    var strands = Math.max(3, Math.round(w * 0.7));

    /* Der Fall ist eine Flaeche in der x-y-Ebene und wird von -z gesehen.
       Eine Rueckwand gehoert deshalb auf die +z-Seite - sie mitzubauen
       waere nur richtig, solange niemand den Fall dreht, deshalb setzt sie
       der Aufrufer (`backWall`). */
    if (o.backWall) {
      this.deco('box', lx, ly - h / 2 + 0.4, lz + 1.6, w * 1.9, h * 1.06, 2.6,
        o.rockMat || MAT.rockDark);
    }

    /* Hauptstrang, dahinter und davor je zwei schmalere - das gibt Tiefe. */
    for (var i = 0; i < strands; i++) {
      var f = (i / Math.max(1, strands - 1)) - 0.5;          /* -0.5 .. 0.5 */
      var sw = w * (0.30 + (1 - Math.abs(f) * 1.7) * 0.55);
      if (sw < w * 0.12) sw = w * 0.12;
      var sz = lz + f * 1.9 + (r() - 0.5) * 0.4;
      var sx = lx + f * w * 0.28 + (r() - 0.5) * 0.3;
      var sh = h * (0.94 + r() * 0.1);
      this.deco('box', sx, ly - sh / 2 + 0.3, sz, sw, sh, 0.55 + r() * 0.4, MAT.fall);
    }

    /* Lippe: das Wasser kippt ueber die Kante, statt an ihr abzureissen. */
    if (o.top !== false) {
      this.deco('box', lx, ly + 0.15, lz, w * 1.12, 0.5, 2.4, MAT.waterShallow);
      this.deco('blob', lx, ly - 0.15, lz + 0.8, w * 1.05, 0.9, 1.5, MAT.fall);
    }

    /* Gischt: mehrere Ballen unterschiedlicher Groesse statt einer Kugel. */
    for (var g = 0; g < 4; g++) {
      var ga = r() * 6.28, gd = r() * w * 0.7;
      this.deco('blob', lx + Math.cos(ga) * gd, ly - h + 0.5 + r() * 1.2, lz + Math.sin(ga) * gd * 0.7,
        w * (0.9 + r() * 0.9), 1.6 + r() * 1.4, w * (0.8 + r() * 0.8), MAT.foam, [0, r() * 6.28, 0]);
    }

    /* Nebel nur am Fuss und klein: eine Saeule ueber die ganze Hoehe hat
       den Bereich weissgewaschen, statt Stimmung zu machen. */
    for (var mI = 0; mI < 2; mI++) {
      this.deco('blob', lx + (r() - 0.5) * w * 0.7, ly - h + 1.6 + mI * 1.8, lz + 1.2 + r() * 0.8,
        w * (0.9 + r() * 0.5), 2.2 + r(), w * (0.7 + r() * 0.4), MAT.mist, [0, r() * 6.28, 0]);
    }

    /* Felsen an den Flanken: der Fall haengt sonst frei in der Wand. */
    if (o.rocks !== false) {
      for (var k = 0; k < 4; k++) {
        var side = k % 2 ? 1 : -1;
        var ky = ly - h * (0.1 + r() * 0.8);
        this.deco(k % 3 === 0 ? 'rock' : (k % 3 === 1 ? 'rock2' : 'rock3'),
          lx + side * (w * 0.62 + r() * 1.2), ky, lz + (r() - 0.5) * 2.2,
          2.2 + r() * 2.4, 1.8 + r() * 2.2, 2.0 + r() * 2.0,
          o.rockMat || MAT.rockDark, [(r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5]);
      }
    }

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
    var was = this.farMode;
    this.farMode = true;
    for (var i = 0; i < 4; i++) {
      this.deco('blob', lx + (r() - 0.5) * s * 2.4, ly + (r() - 0.5) * s * 0.4, lz + (r() - 0.5) * s * 1.6,
        s * (0.9 + r() * 0.8), s * (0.45 + r() * 0.25), s * (0.8 + r() * 0.6), MAT.cloud);
    }
    this.farMode = was;
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
 * Reichweiten der Figur, mit der jetzigen Bewegung neu gemessen. Tempo
 * kauft Weite, und das ist die Grundlage des ganzen Levelbaus:
 *
 *   Tempo |  Sprung | +Doppel | +Dash | Dash+Doppel
 *      17 |    12,2 |    18,6 |  23,7 |        32,9
 *      24 |    15,4 |    24,6 |  26,2 |        37,2
 *      32 |    20,7 |    33,3 |  29,3 |        42,9
 *      42 |    27,4 |    44,2 |  33,2 |        50,1
 *      50 |    32,7 |    53,0 |  36,3 |        55,8
 *
 * Sprunghoehe 2,8 m gehalten, 4,9 m mit Doppelsprung.
 */
(function (root) {
  'use strict';

  var M = root.MR.math;
  var L = root.MR.level;
  var MAT = L.MAT;

  /* ------------------------------------------------------ 0 - Start */
  /* ===================================================================
     ACHT ABSCHNITTE

     Gebaut gegen die gemessene Reichweitentabelle der Figur. Tempo kauft
     Weite, und zwar hart:

       Tempo |  Sprung | +Doppel | +Dash | Dash+Doppel
          17 |    12,2 |    18,6 |  23,7 |        32,9
          24 |    15,4 |    24,6 |  26,2 |        37,2
          32 |    20,7 |    33,3 |  29,3 |        42,9
          42 |    27,4 |    44,2 |  33,2 |        50,1
          50 |    32,7 |    53,0 |  36,3 |        55,8

     Daraus die Bauregeln fuer Luecken (Kante zu Kante):
       bis 12 m   immer zu schaffen, auch aus dem Stand
       14 - 20 m  braucht Schwung oder den Doppelsprung
       21 - 30 m  braucht Tempo 32 aufwaerts oder eine Dash-Ladung
       33 - 45 m  nur mit Tempo 42 und Doppelsprung, oder Dash + Doppel
       ueber 46 m nur als Abkuerzung fuer den, der wirklich schnell ist

     Tempo kommt aus Hoehe: rutschend landen rechnet Fallgeschwindigkeit in
     Vortrieb um (6 m Fall -> 29, 16 m -> 41, 34 m -> 54). Deshalb endet
     jeder riskante Weg mit einem Absturz auf die Hauptbahn - er bezahlt
     sich in Tempo fuer den naechsten Abschnitt aus.

     Farbcode: gruen sicher, gold schnell, rot/pink am schwersten.
     =================================================================== */

  var SAFE = 0, FAST = 1, RISK = 2;

  /* Kristallbogen zwischen zwei Punkten - sie haengen im Sprungbogen, man
     nimmt sie also nur mit, wenn man den weiten Weg wirklich springt. */
  function gemArc(b, x0, y0, z0, x1, y1, z1, n, hint) {
    for (var i = 1; i <= n; i++) {
      var t = i / (n + 1);
      var bow = Math.sin(t * Math.PI) * 3.4;
      b.gem(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + bow + 1.8, z0 + (z1 - z0) * t, { hint: hint });
    }
  }

  /* Eine Kette gleichartiger Plattformen. Gibt die Mitte der letzten zurueck. */
  function chain(b, o) {
    var last = null;
    for (var i = 0; i < o.n; i++) {
      var x = o.x + (o.ax ? (i % 2 ? o.ax : -o.ax) : 0);
      var y = o.y + (o.dy || 0) * i;
      var z = o.z + o.step * i;
      b.plat(x, y, z, o.w, o.d, o.mat, { thickness: o.thick || 1.4 });
      if (o.pillar) b.deco('box', x, y - o.pillar / 2 - 1, z, o.w * 0.55, o.pillar, o.d * 0.5, o.pillarMat || MAT.rock);
      if (o.route !== undefined) b.routeMark(o.fork, o.route, x, y, z);
      if (o.mark) b.mark(x, y, z);
      if (o.gem) b.gem(x, y + 2.2, z, { hint: o.hint });
      if (o.arcGem && i < o.n - 1) {
        var nx = o.x + (o.ax ? ((i + 1) % 2 ? o.ax : -o.ax) : 0);
        gemArc(b, x, y, z + o.d / 2, nx, y + (o.dy || 0), z + o.step - o.d / 2, o.arcGem, o.hint);
      }
      last = [x, y, z];
    }
    return last;
  }

  /* ---------------------------------------------------- 1 - Auftakt
     Ziel: in fuenf Sekunden Sprint, Kante, Sturz, Entscheidung. Die erste
     Gabel liegt direkt hinter der Startkante - man sieht beide Wege, bevor
     man springt, und hat keine Sekunde Leerlauf davor. */
  function s1Auftakt(b) {
    b.zone('Auftakt', 60, 170, {
      fogCol: [0.76, 0.93, 1.0], fogDensity: 0.0013,
      zenith: [0.06, 0.48, 1.0], horizon: [0.99, 0.93, 0.78],
      skyCol: [0.46, 0.80, 1.0], groundCol: [0.30, 0.52, 0.22],
      sunCol: [1.18, 1.08, 0.86], ambient: 'pollen'
    });
    var r = b.rand, i;

    b.plat(0, 0, 4, 22, 14, MAT.meadowLush, { thickness: 2.6 });      /* -3 .. 11 */
    b.mass(0, -3, 4, 20, 34, 12, MAT.rock);
    b.start = { x: b.toWorldX(0, 0), y: b.cursor.y + 0.1, z: b.toWorldZ(0, 0), yaw: b.cursor.yaw };
    b.mark(0, 0, 0);
    for (i = 0; i < 5; i++) b.tree(-13 + (i % 2) * 26, 0, -4 + i * 4, 0.8 + r() * 0.5, { kind: 'pine' });

    /* Die Gabel steht unmittelbar an der Kante. */
    b.routeSign(-9, 0, 9, SAFE);
    b.routeSign(9, 0, 9, RISK);

    /* --- SICHER: flache Stufen, kleine Luecken --- */
    b.routeZone(0, SAFE, -9, 0, 16, 12, 8, 12);
    b.routeArch(-9, -5, 20, 10, 6, SAFE);
    b.plat(-9, -5, 28, 16, 20, MAT.meadow, { thickness: 2.0 });       /* 18 .. 38 */
    b.mass(-9, -8, 28, 14, 30, 18, MAT.rock);
    b.plat(-6, -9, 60, 16, 24, MAT.meadow, { thickness: 2.0 });       /* 48 .. 72 */
    b.mass(-6, -12, 60, 14, 30, 22, MAT.rock);
    b.routeMark(0, SAFE, -9, -5, 28);
    b.routeMark(0, SAFE, -6, -9, 60);
    b.mark(-9, -5, 28);
    b.mark(-6, -9, 60);

    /* --- RISKANT: die hohe Linie ---
       Sie hing zuerst an einem einzigen Sprungfeld, das elf Meter heben
       musste. Wer mit Tempo ankam, flog im Bogen darueber hinweg und traf
       es nie - eine Route, die an einem Punkt haengt, ist keine Route.
       Jetzt liegt die Linie vier Meter ueber der Einstiegsplattform: ein
       Doppelsprung traegt 4,9, also kommt man immer hinauf. Das Sprungfeld
       steht weiterhin da und wirft einen hoeher, fuer die Kristalle im
       Bogen - es ist die Kuer, nicht die Bedingung. */
    b.routeZone(0, RISK, 9, 0, 16, 12, 8, 12);
    b.routeArch(9, -5, 20, 9, 6, RISK);
    b.plat(9, -5, 32, 13, 30, MAT.stone, { thickness: 1.8 });         /* 17 .. 47 */
    b.mass(9, -8, 32, 11, 30, 26, MAT.rock);
    b.bouncePad(9, -5, 30, { power: 30, r: 5, mat: MAT.routeInsane });
    b.plat(9, -1, 72, 12, 36, MAT.stone, { thickness: 1.4 });         /* 54 .. 90 */
    b.deco('box', 9, -9, 72, 8, 18, 14, MAT.rockDark);
    b.gem(9, 1.2, 60, { hint: 'hohe Linie' });
    b.gem(9, 1.2, 72, { hint: 'hohe Linie' });
    b.gem(9, 7.5, 50, { hint: 'nur mit Sprungfeld' });
    b.gem(9, 8.5, 62, { hint: 'nur mit Sprungfeld' });
    b.routeMark(0, RISK, 9, -5, 32);
    b.routeMark(0, RISK, 9, -1, 72);
    b.routeArch(9, -1, 89, 9, 5, RISK);

    /* Zusammenfluss: breit genug, dass ein 20-m-Sturz sicher ankommt. */
    b.plat(0, -14, 126, 30, 56, MAT.canyonDeck, { thickness: 2.6 });  /* 98 .. 154 */
    b.mass(0, -18, 126, 28, 40, 52, MAT.canyon);
    gemArc(b, 9, -1, 90, 3, -14, 110, 2, 'Rueckkehr');
    b.mark(0, -14, 126);
    b.gate(0, -14, 144, { name: 'Auftakt' });
    return { len: 158, rise: -14, turn: 0 };
  }

  /* ------------------------------------------------- 2 - Sprungkette
     Ziel: Rhythmus. Innen sechs kurze Haken, aussen vier weite Saetze mit
     Kristallen. Die innere Kette laesst sich ohne Tempo gehen, die aeussere
     verlangt 32 aufwaerts - genau die Geschwindigkeit, die man aus dem
     Auftakt mitbringt, wenn man dort riskant war. */
  function s2Sprungkette(b) {
    b.zone('Kette', 70, 170, {
      fogCol: [0.80, 0.90, 1.0], fogDensity: 0.0016,
      zenith: [0.05, 0.44, 0.96], horizon: [0.95, 0.90, 0.80],
      skyCol: [0.48, 0.78, 1.0], groundCol: [0.34, 0.46, 0.30],
      sunCol: [1.18, 1.10, 0.90], ambient: 'leaves'
    });
    b.plat(0, 0, 10, 24, 24, MAT.canyonDeck, { thickness: 2.2 });     /* -2 .. 22 */
    b.mass(0, -4, 10, 22, 34, 20, MAT.canyon);
    b.mark(0, 0, 10);
    b.routeSign(-6, 0, 18, SAFE);
    b.routeSign(10, 0, 18, FAST);

    /* Innen: eine absteigende Treppe. Die erste Fassung waren sechs flache
       Huepfer mit acht Metern Luecke - der Testpilot ging sie mit
       Grundtempo 17 und hatte vier Sekunden am Stueck nichts zu tun. Jetzt
       faellt jede Stufe fuenf Meter: mit gehaltener Rutschtaste zahlt jede
       Landung Tempo, also lernt man hier durch Wiederholung, worum es im
       ganzen Level geht. */
    b.routeZone(1, SAFE, -4, 0, 24, 14, 8, 14);
    /* Drei Meter je Stufe, nicht fuenf. Bei fuenf kam die Landung mit
       Aufprall 32 ueber der Schwelle von 30 - jede Stufe zahlte also mehr
       Tempo, als sie kostete, und der Testpilot beschleunigte die Treppe
       hinunter, bis er die Stufen nicht mehr traf. Bei drei Metern liegt
       der Aufprall bei 27 und darunter: der sichere Weg gibt Tempo aus,
       statt welches zu machen. Tempo machen ist die Aufgabe des
       riskanten Wegs. */
    chain(b, { n: 6, x: -3, ax: 1.5, y: -2, dy: -3, z: 44, step: 34, w: 22, d: 28,
               mat: MAT.stone, pillar: 24, fork: 1, route: SAFE, mark: true });

    /* Aussen: vier weite Saetze, 36 m Abstand - 24 m Luecke, also Tempo 32
       aufwaerts. Jede Stufe faellt sieben Meter und zahlt entsprechend
       mehr zurueck. */
    b.routeZone(1, FAST, 12, 0, 24, 12, 8, 14);
    b.routeArch(12, 0, 30, 9, 6, FAST);
    chain(b, { n: 4, x: 14, ax: 1.5, y: 0, dy: -5, z: 56, step: 40, w: 13, d: 18,
               mat: MAT.marble, pillar: 28, pillarMat: MAT.sandstone,
               fork: 1, route: FAST, gem: true, arcGem: 1, hint: 'weiter Satz' });

    b.plat(0, -20, 246, 30, 36, MAT.canyonDeck, { thickness: 2.4 });  /* 228 .. 264 */
    b.mass(0, -24, 246, 28, 36, 32, MAT.canyon);
    b.mark(0, -20, 246);
    b.gate(0, -20, 252, { name: 'Sprungkette' });
    return { len: 266, rise: -20, turn: 8 };
  }

  /* --------------------------------------------- 3 - Die grosse Gabel
     Drei Wege nebeneinander, alle drei von der Einstiegsplattform aus zu
     sehen. Das ist die Entscheidung, um die das Level gebaut ist. */
  function s3Gabel(b) {
    b.zone('Schlucht', 80, 180, {
      fogCol: [1.0, 0.86, 0.72], fogDensity: 0.0020,
      zenith: [0.07, 0.42, 0.90], horizon: [1.0, 0.82, 0.58],
      skyCol: [0.60, 0.72, 0.84], groundCol: [0.48, 0.30, 0.20],
      sunCol: [1.24, 1.04, 0.80], ambient: 'dust'
    });
    var r = b.rand, i;
    b.plat(0, 0, 12, 28, 26, MAT.canyonDeck, { thickness: 2.4 });     /* -1 .. 25 */
    b.mass(0, -4, 12, 26, 36, 22, MAT.canyon);
    b.mark(0, 0, 12);
    b.routeSign(-13, 0, 21, SAFE);
    b.routeSign(0, 0, 21, FAST);
    b.routeSign(13, 0, 21, RISK);

    /* --- GRUEN: durchgehender Boden mit Tempofeld. Kein Absturzrisiko,
       aber man kommt ohne Hoehe und ohne Ladungen am Ende an. --- */
    b.routeZone(2, SAFE, -13, 0, 30, 14, 8, 16);
    b.routeArch(-13, -2, 34, 11, 6, SAFE);
    b.plat(-13, -2, 58, 21, 48, MAT.canyonDeck, { thickness: 2.0 });  /* 34 .. 82 */
    b.mass(-13, -6, 58, 15, 30, 44, MAT.canyonDark);
    b.boostPad(-13, -2, 44, 10, 12, { speed: 27 });
    b.plat(-13, -2, 120, 21, 46, MAT.canyonDeck, { thickness: 2.0 }); /* 97 .. 143 */
    b.mass(-13, -6, 120, 15, 30, 42, MAT.canyonDark);
    b.boostPad(-13, -2, 106, 10, 12, { speed: 29 });
    /* Bis an den Zusammenfluss heran. Vorher endete der sichere Weg bei
       z 188, der Zusammenfluss begann bei 227 - 39 m Luecke auf dem Weg,
       der keine verlangen darf. */
    b.plat(-13, -2, 190, 21, 84, MAT.canyonDeck, { thickness: 2.0 }); /* 148 .. 232 */
    b.mass(-13, -6, 190, 19, 30, 78, MAT.canyonDark);
    b.routeMark(2, SAFE, -13, -2, 58);
    b.routeMark(2, SAFE, -13, -2, 120);
    b.routeMark(2, SAFE, -13, -2, 190);
    b.mark(-13, -2, 58); b.mark(-13, -2, 120); b.mark(-13, -2, 176); b.mark(-13, -2, 216);

    /* --- GOLD: mittlere Absaetze, 28 m Abstand, 14 m Luecke --- */
    b.routeZone(2, FAST, 0, 0, 30, 12, 8, 16);
    b.routeArch(0, 4, 34, 10, 6, FAST);
    chain(b, { n: 5, x: 0, ax: 2, y: 4, dy: 0, z: 50, step: 36, w: 15, d: 22,
               mat: MAT.sandstone, pillar: 30, pillarMat: MAT.canyonLight,
               fork: 2, route: FAST, gem: true, hint: 'Mittelweg' });

    /* --- ROT: Aquaedukt. Sprungfeld hinauf, 34 m Abstaende, und am Ende
       sechzehn Meter Fall auf den Zusammenfluss - das zahlt Tempo 41. --- */
    b.routeZone(2, RISK, 13, 0, 30, 12, 8, 16);
    b.routeArch(13, 16, 40, 9, 5, RISK);
    b.plat(13, 0, 32, 14, 28, MAT.stone, { thickness: 1.8 });         /* 18 .. 46 */
    b.mass(13, -4, 32, 12, 30, 24, MAT.canyonDark);
    b.bouncePad(13, 0, 38, { power: 46, r: 6, mat: MAT.routeInsane });
    chain(b, { n: 4, x: 13, ax: 0, y: 16, dy: 0.5, z: 58, step: 44, w: 11, d: 17,
               mat: MAT.marble, pillar: 40, pillarMat: MAT.sandstoneWorn,
               fork: 2, route: RISK, gem: true, arcGem: 2, hint: 'Aquaedukt' });
    b.routeArch(13, 17.5, 190, 8, 5, RISK);

    for (i = 0; i < 6; i++) b.rock(-24 + (i % 2) * 48, -4, 20 + i * 28, 1.4 + r() * 1.6, { kind: 'shard', mat: MAT.canyon });

    /* Weit nach vorne gezogen: die Irre-Route endet bei z 198 und faellt
       16 m herunter. Ein Sturz aus 16 m dauert 0,71 s und traegt bei Tempo
       40 achtundzwanzig Meter - auf 28,5 m Luecke war das auf die
       Zehntelsekunde genau. */
    b.plat(0, -2, 240, 32, 52, MAT.canyonDeck, { thickness: 2.6 });   /* 214 .. 266 */
    b.mass(0, -6, 240, 30, 36, 48, MAT.canyon);
    gemArc(b, 13, 17.5, 198, 6, -2, 220, 2, 'Rueckkehr');
    b.mark(0, -2, 240);
    b.gate(0, -2, 252, { name: 'Grosse Gabel' });
    return { len: 272, rise: -2, turn: -10 };
  }

  /* ------------------------------------------------ 4 - Tempostrecke
     Hier wird geerntet. Drei Tempofelder, Luecken die mitwachsen: 15, 17,
     22, 26 Meter. Wer mit Schwung hereinkommt, merkt sie kaum. Wer langsam
     ankommt, braucht fuer jede eine Dash-Ladung - und die hat nur, wer
     vorher Kristalle geholt hat. Oben liegt eine Abkuerzung, die 45 m am
     Stueck verlangt: Tempo 42 plus Doppelsprung. */
  function s4Tempo(b) {
    b.zone('Abfahrt', 60, 170, {
      fogCol: [1.0, 0.88, 0.76], fogDensity: 0.0018,
      zenith: [0.08, 0.46, 0.94], horizon: [1.0, 0.86, 0.64],
      skyCol: [0.62, 0.76, 0.90], groundCol: [0.46, 0.34, 0.24],
      sunCol: [1.22, 1.06, 0.84], ambient: 'dust'
    });
    b.plat(0, 0, 18, 24, 34, MAT.canyonDeck, { thickness: 2.4 });     /* 1 .. 35 */
    b.mass(0, -4, 18, 22, 34, 30, MAT.canyonDark);
    b.boostPad(0, 0, 10, 11, 13, { speed: 28 });
    b.mark(0, 0, 18);

    b.plat(0, -2, 66, 22, 28, MAT.canyonDeck, { thickness: 2.2 });    /* 52 .. 80 */
    b.mass(0, -6, 66, 20, 30, 24, MAT.canyonDark);
    b.boostPad(0, -2, 58, 11, 13, { speed: 32 });
    b.mark(0, -2, 66);

    b.plat(0, -4, 114, 22, 26, MAT.canyonDeck, { thickness: 2.2 });   /* 101 .. 127 */
    b.mass(0, -8, 114, 20, 30, 22, MAT.canyonDark);
    b.boostPad(0, -4, 106, 11, 13, { speed: 36 });
    b.mark(0, -4, 114);

    b.plat(0, -6, 164, 22, 26, MAT.canyonDeck, { thickness: 2.2 });   /* 151 .. 177 */
    b.mass(0, -10, 164, 20, 30, 22, MAT.canyonDark);
    b.mark(0, -6, 164);

    b.plat(0, -8, 214, 26, 32, MAT.canyonDeck, { thickness: 2.4 });   /* 198 .. 230 */
    b.mass(0, -12, 214, 24, 34, 28, MAT.canyonDark);
    b.mark(0, -8, 214);

    /* Die Abkuerzung. In der ersten Fassung lag das Brett so, dass von
       der Bahn aus 97 m am Stueck zu ueberbruecken waren - die groesste
       gemessene Reichweite der Figur ist 55,8 m (Tempo 50, Dash und
       Doppelsprung). Sie war schlicht unmoeglich. Jetzt sind es 38 m
       hinauf und 40 m hinunter: machbar mit Tempo 42 und Doppelsprung,
       und sie spart die dritte Plattform. */
    b.routeSign(11, -2, 72, RISK);
    b.routeArch(11, 4, 104, 8, 5, RISK);
    b.plat(11, 4, 118, 10, 20, MAT.gold, { thickness: 1.0 });         /* 108 .. 128 */
    b.routeMark(3, RISK, 11, 4, 118);
    gemArc(b, 2, -2, 80, 11, 4, 108, 2, 'Abkuerzung');
    gemArc(b, 11, 4, 128, 2, -6, 168, 2, 'Abkuerzung');

    b.gate(0, -8, 222, { name: 'Tempostrecke' });
    return { len: 234, rise: -8, turn: 0 };
  }

  /* ----------------------------------------------- 5 - Wandschlucht
     Zwei Waende, dazwischen zwei Hoehen. Oben schmale Absaetze im Wechsel,
     nur mit Wandspruengen zu verbinden - wer sie haelt, behaelt Hoehe und
     Tempo. Unten laeuft ein Boden durch: sicher, aber er nimmt einem die
     Hoehe, aus der am Ende Tempo wird. */
  function s5Wand(b) {
    b.zone('Engstelle', 60, 160, {
      fogCol: [0.72, 0.84, 0.96], fogDensity: 0.0022,
      zenith: [0.05, 0.36, 0.86], horizon: [0.82, 0.86, 0.94],
      skyCol: [0.44, 0.62, 0.84], groundCol: [0.30, 0.34, 0.38],
      sunCol: [1.10, 1.04, 0.94], ambient: 'spray'
    });
    var i;
    b.plat(0, 0, 12, 24, 26, MAT.stone, { thickness: 2.2 });          /* -1 .. 25 */
    b.mass(0, -4, 12, 22, 34, 22, MAT.cliff);
    b.mark(0, 0, 12);
    b.routeSign(-7, 0, 21, SAFE);
    b.routeSign(7, 0, 21, RISK);

    b.mass(-13, 6, 112, 6, 30, 170, MAT.cliff);
    b.mass(13, 6, 112, 6, 30, 170, MAT.cliff);

    /* Unten: durchgehend, sechs Meter tiefer. */
    b.routeZone(4, SAFE, 0, -6, 34, 14, 8, 16);
    for (i = 0; i < 5; i++) {
      b.plat(0, -6, 48 + i * 34, 20, 30, MAT.rockDark, { thickness: 1.8 });
      b.mark(0, -6, 48 + i * 34);
      b.routeMark(4, SAFE, 0, -6, 48 + i * 34);
    }

    /* Oben: sechs schmale Absaetze im Wechsel, 24 m Abstand. */
    b.routeZone(4, RISK, 7, 4, 34, 10, 8, 16);
    b.routeArch(0, 5, 34, 14, 6, RISK);
    for (i = 0; i < 6; i++) {
      var wx = (i % 2 === 0) ? -7 : 7;
      var wz = 50 + i * 30;
      b.plat(wx, 5, wz, 6, 11, MAT.metal, { thickness: 1.0 });
      b.gem(wx, 7.4, wz, { hint: 'Wandabsatz' });
      b.routeMark(4, RISK, wx, 5, wz);
      if (i < 5) gemArc(b, wx, 5, wz + 5, -wx, 5, wz + 19, 1, 'Wandsprung');
    }

    /* Ausstieg: unten ueber ein Sprungfeld, oben direkt hinueber. */
    b.plat(0, -6, 216, 22, 30, MAT.rockDark, { thickness: 1.8 });
    b.bouncePad(0, -6, 222, { power: 42, r: 6, mat: MAT.routeSafe });
    /* Der Ausstieg lag acht Meter ueber dem Schluchtboden und haeng an
       einem einzigen Sprungfeld - ein Punkt, an dem alles scheitert, wenn
       man zu langsam hereinkommt. Jetzt sind es vier Meter: ein
       Doppelsprung traegt 4,9, das Sprungfeld ist nur noch die bequeme
       Variante. */
    b.plat(0, -2, 244, 26, 30, MAT.stone, { thickness: 2.0 });        /* 229 .. 259 */
    b.mass(0, -6, 244, 24, 34, 26, MAT.cliff);
    b.mark(0, -6, 216);
    b.mark(0, -2, 244);
    b.gate(0, -2, 250, { name: 'Wandschlucht' });
    return { len: 262, rise: -2, turn: 12 };
  }

  /* ------------------------------------------- 6 - Setpiece Wasserfall
     Anlauf, Sprungfeld, Flug durch den Wasserfall, dahinter ein schmales
     Brett und ein Dash auf die Landung. Wem das zu viel ist, nimmt die
     Bruecke aussen herum - sie ist laenger und flach, kostet also beides:
     Zeit und die Hoehe fuer den naechsten Abschnitt. */
  function s6Wasserfall(b) {
    b.zone('Wasserfall', 70, 170, {
      fogCol: [0.80, 0.92, 1.0], fogDensity: 0.0024,
      zenith: [0.05, 0.42, 0.94], horizon: [0.88, 0.94, 1.0],
      skyCol: [0.50, 0.74, 0.96], groundCol: [0.28, 0.44, 0.44],
      sunCol: [1.14, 1.10, 1.00], ambient: 'spray'
    });
    var i;
    b.plat(0, 0, 14, 24, 28, MAT.stone, { thickness: 2.2 });          /* 0 .. 28 */
    b.mass(0, -4, 14, 22, 34, 24, MAT.cliff);
    b.mark(0, 0, 14);
    b.routeSign(-14, 0, 24, SAFE);
    b.routeSign(4, 0, 24, RISK);

    /* Die Wand mit dem Fall. Der Durchflug ist die Abkuerzung. */
    b.mass(0, 10, 92, 34, 40, 8, MAT.cliff);
    b.waterfall(0, 26, 88, 16, 34, { backWall: false });
    b.deco('box', 0, 2, 88, 11, 14, 7, MAT.rockDark);

    /* --- RISKANT: Sprungfeld, Durchflug, Brett, Dash --- */
    b.routeZone(5, RISK, 4, 0, 30, 12, 8, 14);
    /* Lag bei z 38 - die Plattform endet bei 28. Das Feld schwebte frei
       in der Luft und war nie zu treffen. */
    b.plat(4, 0, 38, 14, 26, MAT.stone, { thickness: 1.8 });          /* 25 .. 51 */
    b.mass(4, -4, 38, 12, 30, 22, MAT.cliff);
    b.bouncePad(4, 0, 44, { power: 44, r: 6, mat: MAT.routeInsane });
    b.routeArch(0, 12, 74, 11, 6, RISK);
    b.plat(0, 8, 104, 11, 14, MAT.crystalRock, { thickness: 1.4 });   /* 97 .. 111 */
    b.routeMark(5, RISK, 4, 0, 44);
    b.routeMark(5, RISK, 0, 8, 104);
    b.gem(0, 10.4, 104, { hint: 'hinter dem Fall' });
    gemArc(b, 4, 0, 44, 0, 8, 97, 3, 'Durchflug');
    /* 28 m Luecke, gedacht als Dash-Sprung. */
    b.plat(0, 2, 146, 16, 18, MAT.crystalRock, { thickness: 1.6 });   /* 137 .. 155 */
    b.routeMark(5, RISK, 0, 2, 146);
    gemArc(b, 0, 8, 111, 0, 2, 137, 2, 'Dash-Luecke');

    /* --- SICHER: Bruecke aussen herum, flach und lang --- */
    b.routeZone(5, SAFE, -14, 0, 30, 12, 8, 14);
    b.routeArch(-16, 0, 36, 10, 6, SAFE);
    b.plat(-16, -2, 74, 16, 64, MAT.stone, { thickness: 1.8 });       /* 42 .. 106 */
    b.mass(-16, -6, 74, 10, 30, 60, MAT.rockDark);
    b.plat(-16, -2, 140, 16, 56, MAT.stone, { thickness: 1.8 });      /* 112 .. 168 */
    b.mass(-16, -6, 140, 10, 30, 52, MAT.rockDark);
    b.routeMark(5, SAFE, -16, -2, 74);
    b.routeMark(5, SAFE, -16, -2, 140);
    b.mark(-16, -2, 74);
    b.mark(-16, -2, 140);

    for (i = 0; i < 5; i++) b.tree(-26 + (i % 2) * 52, -2, 30 + i * 30, 0.8 + b.rand() * 0.6, { kind: 'pine' });

    b.plat(0, -12, 190, 28, 32, MAT.stone, { thickness: 2.4 });       /* 174 .. 206 */
    b.mass(0, -16, 190, 26, 36, 28, MAT.cliff);
    b.mark(0, -12, 190);
    b.gate(0, -12, 196, { name: 'Wasserfall' });
    return { len: 208, rise: -12, turn: 0 };
  }

  /* ----------------------------------------------- 7 - Setpiece Ruinen
     Der einzige Abschnitt, in dem es nach oben geht. Unten ein sicherer
     Rundweg, oben eine Kletterei ueber Terrassen und Wandspruenge. Wer
     oben ankommt, faellt am Ende 26 m auf die Zielgerade - mit Tempo 48
     sind die letzten Luecken dann kein Problem mehr. */
  function s7Ruinen(b) {
    b.zone('Ruinen', 70, 180, {
      fogCol: [1.0, 0.88, 0.66], fogDensity: 0.0020,
      zenith: [0.06, 0.52, 0.90], horizon: [1.0, 0.84, 0.54],
      skyCol: [0.58, 0.76, 0.86], groundCol: [0.50, 0.38, 0.20],
      sunCol: [1.24, 1.06, 0.78], ambient: 'dust'
    });
    var r = b.rand, i;
    b.plat(0, 0, 14, 26, 28, MAT.sandstoneWorn, { thickness: 2.4 });  /* 0 .. 28 */
    b.mass(0, -4, 14, 24, 34, 24, MAT.cliffWarm);
    b.mark(0, 0, 14);
    b.routeSign(-11, 0, 24, SAFE);
    b.routeSign(11, 0, 24, RISK);

    /* --- SICHER: Hoefe auf einer Ebene --- */
    b.routeZone(6, SAFE, -11, 0, 30, 14, 8, 16);
    b.routeArch(-11, -1, 36, 11, 6, SAFE);
    for (i = 0; i < 4; i++) {
      b.plat(-11, -1, 52 + i * 40, 18, 30, MAT.marble, { thickness: 2.0 });
      b.mass(-11, -5, 52 + i * 40, 16, 26, 26, MAT.sandstone);
      b.mark(-11, -1, 52 + i * 40);
      b.routeMark(6, SAFE, -11, -1, 52 + i * 40);
      b.column(-19, -1, 44 + i * 40, 6 + r() * 2, { r: 1.3, mat: MAT.sandstone, capital: true });
      b.column(-3, -1, 62 + i * 40, 5 + r() * 2, { r: 1.3, mat: MAT.sandstone, capital: true });
    }

    /* --- RISKANT: hinauf ueber Terrassen und eine Wand --- */
    b.routeZone(6, RISK, 11, 0, 30, 12, 8, 16);
    b.plat(11, 0, 36, 14, 28, MAT.sandstone, { thickness: 1.8 });     /* 22 .. 50 */
    b.mass(11, -4, 36, 12, 30, 24, MAT.cliffWarm);
    b.bouncePad(11, 0, 42, { power: 45, r: 6, mat: MAT.routeInsane });
    b.routeArch(11, 12, 50, 9, 5, RISK);
    b.plat(11, 12, 66, 11, 20, MAT.marble, { thickness: 1.4 });       /* 56 .. 76 */
    b.gem(11, 14.4, 66, { hint: 'Terrasse' });
    /* Eine Wand zum Abstossen - ohne sie ist die naechste Terrasse zu hoch. */
    b.mass(19, 18, 96, 5, 26, 44, MAT.cliffWarm);
    b.plat(11, 20, 112, 11, 20, MAT.marble, { thickness: 1.4 });      /* 102 .. 122 */
    b.gem(11, 22.4, 112, { hint: 'Wandsprung' });
    gemArc(b, 11, 12, 76, 11, 20, 102, 2, 'hinauf');
    b.plat(11, 27, 156, 13, 22, MAT.marble, { thickness: 1.6 });      /* 145 .. 167 */
    b.gem(11, 29.4, 156, { hint: 'Spitze' });
    b.routeMark(6, RISK, 11, 0, 42);
    b.routeMark(6, RISK, 11, 12, 66);
    b.routeMark(6, RISK, 11, 20, 112);
    b.routeMark(6, RISK, 11, 27, 156);
    b.routeArch(11, 27, 166, 10, 5, RISK);
    for (i = 0; i < 4; i++) b.ruinWall(22 + (i % 2) * 6, -1, 40 + i * 44, 10 + r() * 6, 4 + r() * 3, { yaw: r() * 3 });

    b.plat(0, 0, 212, 30, 34, MAT.marble, { thickness: 2.6 });        /* 195 .. 229 */
    b.mass(0, -4, 212, 28, 36, 30, MAT.cliffWarm);
    gemArc(b, 11, 27, 167, 4, 0, 198, 2, 'Rueckkehr');
    b.mark(0, 0, 212);
    b.gate(0, 0, 218, { name: 'Ruinen' });
    return { len: 230, rise: 0, turn: -8 };
  }

  /* ------------------------------------------------- 8 - Zielsprint
     Ein Sturz, ein Tempofeld, zwei weite Luecken, das Tor. Keine
     Entscheidung mehr - hier zahlt sich nur noch aus, mit welchem Tempo
     man hereinkommt. */
  function s8Ziel(b) {
    b.zone('Gipfel', 60, 170, {
      fogCol: [0.88, 0.96, 1.0], fogDensity: 0.0022,
      zenith: [0.03, 0.42, 0.98], horizon: [0.96, 0.94, 1.0],
      skyCol: [0.54, 0.84, 1.0], groundCol: [0.50, 0.62, 0.76],
      sunCol: [1.22, 1.14, 1.04], ambient: 'snow'
    });
    var i;
    b.plat(0, 0, 12, 24, 24, MAT.snow, { thickness: 2.2 });           /* 0 .. 24 */
    b.mass(0, -4, 12, 22, 34, 20, MAT.cliff);
    b.mark(0, 0, 12);
    b.routeArch(0, 0, 24, 14, 7, RISK);

    /* Der letzte grosse Sturz: 16 m werden zu Tempo 41. */
    b.plat(0, -16, 62, 28, 40, MAT.snow, { thickness: 2.4 });         /* 42 .. 82 */
    b.mass(0, -20, 62, 26, 36, 36, MAT.cliff);
    gemArc(b, 0, 0, 24, 0, -16, 44, 2, 'Absprung');
    b.boostPad(0, -16, 52, 12, 14, { speed: 38 });
    b.mark(0, -16, 62);

    b.plat(0, -18, 112, 26, 36, MAT.snow, { thickness: 2.2 });        /* 94 .. 130 */
    b.mass(0, -22, 112, 24, 32, 32, MAT.cliff);
    gemArc(b, 0, -16, 82, 0, -18, 94, 2, 'weite Luecke');
    b.mark(0, -18, 112);

    b.plat(0, -20, 162, 30, 40, MAT.snow, { thickness: 2.4 });        /* 142 .. 182 */
    b.mass(0, -24, 162, 28, 36, 36, MAT.cliff);
    gemArc(b, 0, -18, 130, 0, -20, 142, 2, 'letzte Luecke');
    b.mark(0, -20, 162);
    for (i = 0; i < 6; i++) b.iceSpike(-18 + (i % 2) * 36, -20, 150 + i * 6, 0.8 + b.rand() * 0.8);

    var p = b.toWorld(0, -20, 172, [0, 0, 0]);
    b.finish = { x: p[0], y: p[1], z: p[2], yaw: b.cursor.yaw, r: 8.0 };
    b.arch(0, -20, 172, 16, 9, MAT.gold);
    b.deco('box', 0, -10.6, 172, 17, 1.4, 0.6, MAT.flag);
    b.mark(0, -20, 172);
    return { len: 190, rise: -20, turn: 0 };
  }

  root.MR.level.SECTIONS = [s1Auftakt, s2Sprungkette, s3Gabel, s4Tempo, s5Wand, s6Wasserfall, s7Ruinen, s8Ziel];
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

  /* Wie schnell das Aufblitzen eines Tores abklingt (Anteil je Sekunde).
     Steht hier, weil level.update in dieser Einheit liegt - in der
     Baukasten-Einheit darueber waere es zur Laufzeit nicht sichtbar. */
  var FLASH_FADE = 1.0;

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
    b.farMode = true;
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

  function build(opts) {
    opts = opts || {};
    var b = new L.Builder();
    /* Dichte der Halme laesst sich fuer schwaechere Geraete herunterziehen. */
    b.grassScale = opts.grassScale === undefined ? 1 : opts.grassScale;
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
    b.farMode = false;

    /* Richtwert aus Streckenlaenge und Hoehenmetern, geeicht am gemessenen
       Bestlauf: seit die schweren Wege wirklich Zeit einbringen, faehrt der
       Testpilot die drei Irre-Aeste sturzfrei in 37 s - vorher waren es 51
       mit dreizehn Stuerzen. Platin lag bei 56,7 s und war damit geschenkt.
       Jetzt liegt es knapp ueber dem Bestlauf und verlangt saubere
       Routenwahl; wer einmal haengenbleibt, faellt auf Gold. */
    /* Geeicht am gemessenen Lauf: der Testpilot faehrt die sichere Linie
       sturzfrei in 57,5 s. Platin liegt darunter, ist also nur ueber die
       riskanten Wege zu erreichen. Mit /26 lag Platin bei 69,9 s und war
       langsamer als ein mittelmaessiger Durchlauf. */
    var base = pathLen / 36 + totalRise / 22;
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
      far: b.far,
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
      /* Aufblitzen der Tore gehoert in die Simulation, nicht ins Zeichnen.
         Vorher stand hier ein fester Abzug von 0,016 je gezeichnetem Bild:
         das Zeichnen veraenderte damit Spielzustand, und bei 144 Hz
         verblasste das Tor zweieinhalbmal schneller als bei 60. */
      for (i5 = 0; i5 < this.gates.length; i5++) {
        var gt5 = this.gates[i5];
        if (gt5.flash > 0) gt5.flash = Math.max(0, gt5.flash - dt * FLASH_FADE);
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
