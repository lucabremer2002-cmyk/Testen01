/* ---------------------------------------------------------------------
   Prototypstrecke.

   Gebaut um eine einzige Frage, die der Spieler alle paar Sekunden neu
   beantwortet: hoch oder flach?

   Hoch kostet Zeit und bringt Fallhoehe. Fallhoehe wird beim Aufkommen mit
   gedrueckter Rutschtaste zu Tempo. Tempo vergeht nur langsam, traegt also
   ueber die naechsten Luecken - und wer eine Luecke nicht traegt, braucht
   eine Dash-Ladung. Ladungen liegen oben. Damit finanziert der riskante Weg
   sich selbst, ohne dass irgendwo eine Punktzahl hochzaehlt.

   Der Motor kennt nur achsparallele Kaesten, also gibt es keine Rampen.
   Alles Tempo kommt aus Hoehe, Sprungfeldern und Tempofeldern.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var M = root.MR.math;
  var L = root.MR.level;
  var MAT = L.MAT;

  /* Stimmung: ein Bereich, klare Farben, damit man die Geometrie liest. */
  /* Gemessen an der Startzone des grossen Spiels. Meine ersten Werte waren
     ueberall heller - besonders groundCol, das die Aufhellung von unten
     steuert - und das Bild war vollstaendig ausgewaschen: heller Boden,
     kaum Schatten, keine Farbe. */
  var ENV = {
    fogCol: [0.76, 0.93, 1.0], fogDensity: 0.0014,
    zenith: [0.06, 0.48, 1.0], horizon: [0.99, 0.93, 0.78],
    skyCol: [0.46, 0.80, 1.0], groundCol: [0.30, 0.52, 0.22],
    sunCol: [1.18, 1.08, 0.86], ambient: 'none'
  };

  /* Farbcode der Wege - er ist die ganze Erklaerung, die das Level gibt.
     Gruen liegt unten und ist sicher, Gold liegt oben und zahlt Tempo. */
  var SAFE = MAT.routeSafe, FAST = MAT.routeFast, RISK = MAT.routeInsane;

  /* Wegweiser in Wegfarbe: ein Pfosten mit Balken, aus der Ferne lesbar. */
  function sign(b, lx, ly, lz, mat) {
    b.deco('box', lx, ly + 2.2, lz, 0.3, 4.4, 0.3, MAT.beam);
    b.deco('box', lx, ly + 4.3, lz, 3.0, 0.8, 0.3, mat);
  }

  /* Ein Bogen ueber dem Einstieg eines Weges. */
  function arch(b, lx, ly, lz, w, h, mat) {
    b.deco('box', lx - w / 2, ly + h / 2, lz, 0.7, h, 0.7, mat);
    b.deco('box', lx + w / 2, ly + h / 2, lz, 0.7, h, 0.7, mat);
    b.deco('box', lx, ly + h, lz, w + 0.7, 0.7, 0.7, mat);
  }

  /* Eine Reihe Kristalle im Sprungbogen zwischen zwei Punkten. */
  function gemArc(b, x0, y0, z0, x1, y1, z1, n, hint) {
    for (var i = 1; i <= n; i++) {
      var t = i / (n + 1);
      var bow = Math.sin(t * Math.PI) * 3.2;
      b.gem(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + bow + 1.6, z0 + (z1 - z0) * t, { hint: hint });
    }
  }

  /* ------------------------------------------------------------ A Absprung
     Vier Sekunden, die das ganze Spiel erklaeren: laufen, Kante, fallen,
     mit gedrueckter Taste aufkommen - und das Tempo verdoppelt sich. Kein
     Anlaufweg, keine leere Wiese. Die Kante ist nach zwei Sekunden da. */
  function beatStart(b) {
    b.zone('Absprung', 40, 150, ENV);

    /* Kurz. Gemessen lagen zwischen Start und erster Kante zwei Sekunden
       Geradeauslauf auf Grundtempo - zwei Sekunden, in denen das Spiel
       nichts von sich zeigt. Jetzt ist die Kante nach einer halben
       Sekunde da. */
    b.plat(0, 0, 4, 20, 14, MAT.meadowLush, { thickness: 2.4 });     /* -3 .. 11 */
    b.mass(0, -3, 4, 18, 30, 12, MAT.rock);
    b.start = { x: b.toWorldX(0, 0), y: b.cursor.y + 0.1, z: b.toWorldZ(0, 0), yaw: b.cursor.yaw };
    b.mark(0, 0, 0);

    /* Der Hinweis steht direkt im Blickfeld, nicht in einem Menue. */
    sign(b, -7, 0, 9, RISK);
    sign(b, 7, 0, 9, RISK);
    arch(b, 0, 0, 11, 12, 6, RISK);

    /* 10 m Luecke, 14 m Fall. Mit Rutschtaste kommt man mit rund 33 an,
       ohne mit 17 - der Unterschied ist sofort sichtbar. */
    b.plat(0, -14, 44, 26, 34, MAT.canyonDeck, { thickness: 2.4 });  /* 27 .. 61 */
    b.mass(0, -17, 44, 24, 40, 26, MAT.canyon);
    gemArc(b, 0, 0, 11, 0, -14, 28, 2, 'erster Sprung');
    b.mark(0, -14, 44);

    b.plat(0, -14, 82, 26, 32, MAT.canyonDeck, { thickness: 2.4 });  /* 66 .. 98 */
    b.mass(0, -17, 82, 24, 40, 24, MAT.canyon);
    b.mark(0, -14, 90);
    b.gate(0, -14, 90, { name: 'Absprung' });
    return { len: 96, drop: -14 };
  }

  /* ---------------------------------------------------------- B Erste Wahl
     Die erste echte Entscheidung, und sie ist von unten sichtbar: ein
     Sprungfeld fuehrt auf ein Regal mit drei Kristallen und endet in einem
     18-Meter-Fall zurueck auf die Hauptbahn. Wer unten bleibt, laeuft
     ungestoert, kommt aber ohne Ladungen und ohne Tempo an der naechsten
     Luecke an. */
  function beatChoice(b) {
    /* Hauptbahn unten, durchgehend. */
    b.plat(0, 0, 30, 24, 56, MAT.canyonDeck, { thickness: 2.2 });    /* 2 .. 58 */
    b.mass(0, -3, 30, 22, 30, 50, MAT.canyon);
    b.plat(0, 0, 96, 24, 52, MAT.canyonDeck, { thickness: 2.2 });    /* 70 .. 122 */
    b.mass(0, -3, 96, 22, 30, 46, MAT.canyon);
    b.plat(0, 0, 160, 26, 56, MAT.canyonDeck, { thickness: 2.2 });   /* 132 .. 188 */
    b.mass(0, -3, 160, 24, 30, 50, MAT.canyon);
    b.mark(0, 0, 30);
    b.mark(0, 0, 96);
    b.mark(0, 0, 160);

    /* Unten gibt es ein Tempofeld als Trostpreis - der sichere Weg ist
       langsamer, aber nicht hoffnungslos. */
    b.boostPad(0, 0, 100, 10, 12, { speed: 27 });
    sign(b, -10, 0, 14, SAFE);

    /* Oben: Sprungfeld, Regal, Fall. */
    b.bouncePad(9, 0, 22, { power: 41, mat: RISK });
    sign(b, 9, 0, 14, RISK);
    arch(b, 9, 0, 16, 7, 5, RISK);

    b.plat(9, 19, 52, 9, 26, MAT.marble, { thickness: 1.2 });        /* 39 .. 65 */
    b.deco('box', 9, 9, 52, 6, 20, 6, MAT.sandstoneWorn);
    b.plat(9, 19, 92, 9, 26, MAT.marble, { thickness: 1.2 });        /* 79 .. 105 */
    b.deco('box', 9, 9, 92, 6, 20, 6, MAT.sandstoneWorn);
    b.plat(9, 19, 132, 11, 26, MAT.marble, { thickness: 1.2 });      /* 119 .. 145 */
    b.deco('box', 9, 9, 132, 6, 20, 6, MAT.sandstoneWorn);

    b.routeMark(1, 2, 9, 19, 52);
    b.routeMark(1, 2, 9, 19, 92);
    b.routeMark(1, 2, 9, 19, 132);
    b.gem(9, 21, 52, { hint: 'Regal' });
    b.gem(9, 21, 92, { hint: 'Regal' });
    b.gem(9, 21, 132, { hint: 'Regal' });
    gemArc(b, 9, 19, 65, 9, 19, 79, 1, 'Regalsprung');
    gemArc(b, 9, 19, 105, 9, 19, 119, 1, 'Regalsprung');

    /* Das Regal endet frei in der Luft: von hier faellt man 19 m auf die
       Hauptbahn. Genau dafuer war der Umweg da. */
    arch(b, 9, 19, 145, 9, 5, RISK);
    gemArc(b, 9, 19, 146, 4, 0, 168, 2, 'Rueckkehr');

    b.mark(0, 0, 186);
    b.gate(0, 0, 186, { name: 'Erste Wahl' });
    return { len: 194, drop: 0 };
  }

  /* -------------------------------------------------------- C Wandschlucht
     Zwei Waende, dazwischen nichts. Oben haengen schmale Absaetze im
     Wechsel links und rechts - wer sie mit Wandspruengen verbindet, behaelt
     Hoehe und Tempo. Unten laeuft ein Boden durch: sicher, aber er nimmt
     einem die Hoehe, die man am Ende in Tempo umrechnen koennte. */
  function beatWalls(b) {
    var i;
    b.plat(0, 0, 12, 22, 28, MAT.canyonDeck, { thickness: 2.2 });    /* -2 .. 26 */
    b.mass(0, -3, 12, 20, 30, 24, MAT.canyon);
    b.mark(0, 0, 12);
    sign(b, -8, 0, 20, SAFE);
    sign(b, 8, 0, 20, RISK);

    /* Die Waende. Sie waren 46 m hoch und der Boden lag 12 m tief - wer
       unten ankam, stand in einem Schacht, sah nichts und kam mit 10 km/h
       heraus. Jetzt sind sie halb so hoch und der Boden liegt nur sechs
       Meter tiefer: man sieht die Absaetze ueber sich, also weiss man auch
       unten noch, was man verpasst hat. */
    b.mass(-11, 2, 108, 5, 24, 150, MAT.cliff);
    b.mass(11, 2, 108, 5, 24, 150, MAT.cliff);

    /* Unten durch: durchgehender Boden, sechs Meter tiefer. */
    for (i = 0; i < 5; i++) {
      b.plat(0, -6, 44 + i * 30, 16, 26, MAT.rockDark, { thickness: 1.6 });
      b.mark(0, -6, 44 + i * 30);
    }

    /* Oben entlang: schmale Absaetze im Wechsel, nur mit Wandspruengen zu
       verbinden. Sie sind bewusst kurz - hier haelt man sich nicht auf. */
    for (i = 0; i < 6; i++) {
      var wx = (i % 2 === 0) ? -6.5 : 6.5;
      var wz = 44 + i * 26;
      b.plat(wx, 4, wz, 6, 11, MAT.metal, { thickness: 1.0 });
      b.gem(wx, 6.4, wz, { hint: 'Wandabsatz' });
      b.routeMark(1, 1, wx, 4, wz);
      if (i < 5) {
        var nx = (i % 2 === 0) ? 6.5 : -6.5;
        gemArc(b, wx, 4, wz + 6, nx, 4, wz + 20, 1, 'Wandsprung');
      }
    }

    /* Ende oben: freier Absatz, 20 m ueber der naechsten Bahn. */
    b.plat(0, 4, 196, 10, 14, MAT.metal, { thickness: 1.2 });
    arch(b, 0, 4, 203, 9, 5, RISK);

    /* Ende unten: zwei Stufen zurueck nach oben. Ein einzelnes Sprungfeld
       trug die 16 m nicht - der Testpilot kam auf den sicheren Boden und
       nicht wieder herunter. Ein Weg, den man betreten, aber nicht
       verlassen kann, ist kein sicherer Weg, sondern eine Falle. */
    b.plat(0, -6, 194, 18, 24, MAT.rockDark, { thickness: 1.6 });
    /* Die Stufen waren 7 und 5 Meter hoch. Ein gehaltener Sprung traegt
       2,9 m, mit Doppelsprung rund 5 - die erste Stufe war schlicht nicht
       erreichbar, der Testpilot ist dort dreimal abgestuerzt. Jetzt hebt
       ein Sprungfeld die zwoelf Meter, und ein Fangbrett darueber faengt
       auch den, der zu frueh abspringt. */
    b.bouncePad(0, -6, 198, { power: 40, mat: SAFE });
    b.plat(0, -1, 214, 16, 18, MAT.rockDark, { thickness: 1.4 });
    b.mark(0, -6, 194);
    b.mark(0, -1, 214);
    b.gate(0, -1, 216, { name: 'Wandschlucht' });
    return { len: 228, drop: 0 };
  }

  /* -------------------------------------------------------- D Lueckenkette
     Hier stand zuerst eine lange Parallelbruecke als sicherer Weg. Sie lag
     19 m seitlich und 14 m tiefer und liess sich nur aus der Luft anfliegen
     - der Testpilot ist 55 mal in die Luecke dazwischen gefallen. Ein
     sicherer Weg, den man nur mit einem Sprung ins Nichts betritt, ist
     keiner.

     Jetzt gibt es keine zwei Wege mehr, sondern sechsmal dieselbe Frage:
     die Insel direkt anspringen (36 m, geht nur mit Tempo oder einer
     Dash-Ladung) oder den Trittstein in der Mitte nehmen. Der Trittstein
     liegt sieben Meter tiefer - er kostet kein Leben, aber die Hoehe, aus
     der man sonst Tempo gemacht haette, und einen zusaetzlichen Sprung.
     Die Entscheidung faellt damit sechsmal statt einmal. */
  function beatGaps(b) {
    var i, n = 6;

    /* Einstieg: von hier sieht man die ganze Kette. */
    b.plat(0, -16, 8, 26, 26, MAT.crystalRock, { thickness: 2.0 });
    b.mass(0, -20, 8, 24, 30, 22, MAT.crystalRock);
    b.mark(0, -16, 8);
    arch(b, 0, -16, 20, 12, 6, RISK);
    sign(b, -10, -16, 18, SAFE);

    for (i = 0; i < n; i++) {
      var gz = 44 + i * 36;
      b.plat(0, -16, gz, 13, 15, MAT.crystalRock, { thickness: 1.6 });
      b.deco('box', 0, -24, gz, 8, 16, 8, MAT.crystalRock);
      b.mark(0, -16, gz);
      b.routeMark(3, 1, 0, -16, gz);

      /* Der Trittstein in der Luecke: tiefer, schmaler, aber sicher. */
      if (i < n - 1) {
        var sx = (i % 2 === 0) ? -5 : 5;
        b.plat(sx, -23, gz + 18, 7, 9, MAT.stone, { thickness: 1.2 });
        b.deco('box', sx, -30, gz + 18, 4, 14, 4, MAT.rockDark);
        b.mark(sx, -23, gz + 18);
        /* Eindeutig als Trittstein markiert, damit Testlaeufe die mutige
           Linie sauber nachbilden koennen. */
        b.routeMark(3, 0, sx, -23, gz + 18);
        /* Die Kristalle liegen auf der direkten Linie, nicht ueber dem
           Trittstein - wer sicher geht, zahlt mit Ladungen fuer spaeter. */
        gemArc(b, 0, -16, gz + 8, 0, -16, gz + 28, 2, 'Luecke');
      }
    }

    b.plat(0, -16, 260, 22, 26, MAT.crystalRock, { thickness: 2.0 });
    b.mass(0, -20, 260, 20, 30, 22, MAT.crystalRock);
    b.mark(0, -16, 260);
    b.gate(0, -16, 260, { name: 'Lueckenkette' });
    return { len: 274, drop: -16 };
  }

  /* --------------------------------------------------------- E Tempostrecke
     Erholung, aber schnell: eine gerade Bahn mit drei Tempofeldern und
     Luecken, die man bei Tempo nicht einmal bemerkt - und die einen sofort
     bestrafen, wenn man langsam hereinkommt. Hier gibt es nichts zu
     entscheiden, hier wird geerntet, was vorher entschieden wurde. */
  function beatSpeed(b) {
    var i;
    for (i = 0; i < 4; i++) {
      var sz = 16 + i * 40;
      b.plat(0, 0, sz, 20, 28, MAT.snow, { thickness: 2.0 });
      b.mass(0, -3, sz, 18, 30, 24, MAT.cliff);
      b.boostPad(0, 0, sz - 6, 9, 11, { speed: 26 + i * 4 });
      b.mark(0, 0, sz);
      if (i < 3) gemArc(b, 0, 0, sz + 14, 0, 0, sz + 26, 1, 'Tempoluecke');
    }
    b.gate(0, 0, 150, { name: 'Tempostrecke' });
    return { len: 158, drop: 0 };
  }

  /* ---------------------------------------------------------------- F Finale
     Ein Sprungfeld wirft hoch hinaus. Von oben gibt es zwei Landungen: die
     breite Bahn geradeaus, oder - zwei Dash-Ladungen vorausgesetzt - ein
     schmales Brett weit vorne, das dreissig Meter ueberspringt. Danach der
     letzte Fall, und wer ihn rutschend nimmt, faehrt mit Hoechsttempo durch
     das Tor. */
  function beatFinale(b) {
    b.plat(0, 0, 14, 22, 28, MAT.snow, { thickness: 2.0 });
    b.mass(0, -3, 14, 20, 30, 24, MAT.cliff);
    b.bouncePad(0, 0, 22, { power: 48, mat: RISK });
    arch(b, 0, 0, 26, 12, 6, RISK);
    b.mark(0, 0, 14);

    /* Die Abkuerzung: ein schmales Brett, nur mit Dash erreichbar. Es lag
       auf 16 m - das Sprungfeld traegt mit 48 aber nur 14,8 m, das Brett
       war also von nirgendwo aus zu erreichen. Jetzt liegt es auf 11. */
    b.plat(0, 11, 104, 8, 16, MAT.gold, { thickness: 1.0 });
    gemArc(b, 0, 11, 40, 0, 11, 96, 3, 'Abkuerzung');
    arch(b, 0, 11, 96, 7, 4, RISK);

    /* Die breite Landung fuer alle anderen. */
    b.plat(0, -2, 62, 26, 40, MAT.snow, { thickness: 2.0 });
    b.mass(0, -5, 62, 24, 30, 36, MAT.cliff);
    b.mark(0, -2, 62);

    /* Letzter Fall auf die Zielgerade. Die Bahn begann bei z 120 - aus 38 m
       Entfernung und 18 m Hoehe war sie nicht zu erreichen, ein Sprung
       traegt dabei rund 30 m. Der Testpilot ist dort 24 mal gefallen.
       Jetzt beginnt sie bei 100. */
    b.plat(0, -20, 140, 30, 80, MAT.snow, { thickness: 2.4 });
    b.mass(0, -24, 140, 28, 40, 76, MAT.cliff);
    b.mark(0, -20, 140);

    var p = b.toWorld(0, -20, 176, [0, 0, 0]);
    b.finish = { x: p[0], y: p[1], z: p[2], yaw: b.cursor.yaw, r: 8.0 };
    arch(b, 0, -20, 176, 16, 9, MAT.gold);
    b.deco('box', 0, -10.6, 176, 17, 1.4, 0.6, MAT.flag);
    b.mark(0, -20, 176);
    return { len: 182, drop: -20 };
  }

  var BEATS = [beatStart, beatChoice, beatWalls, beatGaps, beatSpeed, beatFinale];
  var TURN_AFTER = [0, 8, -10, 0, 7, 0];   /* leichte Kurven zwischen den Teilen */

  function build() {
    var b = new L.Builder();
    var i;

    for (i = 0; i < BEATS.length; i++) {
      var r = BEATS[i](b);
      b.advance(r.len);
      b.lift(r.drop || 0);
      if (TURN_AFTER[i]) b.turn(TURN_AFTER[i]);
    }

    var bounds = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, minZ: 1e9, maxZ: -1e9 };
    for (i = 0; i < b.world.all.length; i++) {
      var c = b.world.all[i];
      if (c.x - c.hx < bounds.minX) bounds.minX = c.x - c.hx;
      if (c.x + c.hx > bounds.maxX) bounds.maxX = c.x + c.hx;
      if (c.y - c.hy < bounds.minY) bounds.minY = c.y - c.hy;
      if (c.y + c.hy > bounds.maxY) bounds.maxY = c.y + c.hy;
      if (c.z - c.hz < bounds.minZ) bounds.minZ = c.z - c.hz;
      if (c.z + c.hz > bounds.maxZ) bounds.maxZ = c.z + c.hz;
    }

    var pathLen = 0;
    for (i = 1; i < b.spine.length; i++) {
      pathLen += Math.hypot(b.spine[i][0] - b.spine[i - 1][0], b.spine[i][2] - b.spine[i - 1][2]);
    }

    var level = {
      name: 'Prototyp',
      world: b.world, visuals: b.visuals, far: b.far, glass: b.glass,
      ents: b.ents, gems: b.gems, enemies: b.enemies,
      gates: b.checkpoints, zones: b.zones,
      finish: b.finish, start: b.start, bounds: bounds, spine: b.spine,
      pathLength: pathLen, sprayPoints: [], routePaths: b.routePaths || {}, time: 0
    };
    level.spawn = { x: b.start.x, y: b.start.y, z: b.start.z, yaw: b.start.yaw, name: 'Start' };
    for (i = 0; i < level.gates.length; i++) level.gates[i].index = i;

    /* Absturzgrenze grosszuegig: ein Sturz beendet hier keinen Lauf, er
       kostet Zeit. Es waere unfair, wenn er zusaetzlich frueh ausloest. */
    level._floorHint = 0;
    level.floorAt = function (x, z) {
      var sp = this.spine, best = this._floorHint, bd = 1e18;
      for (var i2 = 0; i2 < sp.length; i2++) {
        var dx = sp[i2][0] - x, dz = sp[i2][2] - z;
        var d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i2; }
      }
      this._floorHint = best;
      return sp[best][1] - 34;
    };

    level.reset = function () {
      for (var i3 = 0; i3 < this.ents.length; i3++) if (this.ents[i3].reset) this.ents[i3].reset();
      for (var g = 0; g < this.gems.length; g++) this.gems[g].taken = false;
      for (var k = 0; k < this.gates.length; k++) { this.gates[k].passed = false; this.gates[k].flash = 0; }
      this.time = 0;
    };
    level.softReset = function () {};

    var envOut = {
      fogCol: ENV.fogCol.slice(), fogDensity: ENV.fogDensity,
      zenith: ENV.zenith.slice(), horizon: ENV.horizon.slice(),
      skyCol: ENV.skyCol.slice(), groundCol: ENV.groundCol.slice(),
      sunCol: ENV.sunCol.slice(), ambient: 'none'
    };
    level.envAt = function () { return envOut; };

    level.update = function (t, dt, player) {
      this.time = t;
      for (var i4 = 0; i4 < this.ents.length; i4++) {
        var ent = this.ents[i4], col = ent.col;
        if (col) { col.px = col.x; col.py = col.y; col.pz = col.z; col.pyaw = col.yaw; }
        ent.update(t, dt, player);
      }
    };

    var TMP = new Float32Array(16);
    var m4 = M.m4;
    level.render = function (batch, glass, t) {
      var i5;
      for (i5 = 0; i5 < this.ents.length; i5++) this.ents[i5].render(batch, t);

      for (i5 = 0; i5 < this.gems.length; i5++) {
        var g2 = this.gems[i5];
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

      for (i5 = 0; i5 < this.gates.length; i5++) {
        var gt = this.gates[i5];
        if (gt.flash > 0) gt.flash = Math.max(0, gt.flash - 0.016);
        var pulse = 1 + (gt.flash > 0 ? gt.flash * 0.25 : Math.sin(t * 3 + i5) * 0.03);
        var gmat = gt.passed ? MAT.ringOn : MAT.ringOff;
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var px = gt.x + Math.cos(gt.yaw) * sgn * 5.2;
          var pz = gt.z - Math.sin(gt.yaw) * sgn * 5.2;
          m4.composeYaw(TMP, px, gt.y + 4.2 * pulse, pz, gt.yaw, 0.55, 8.4 * pulse, 0.55);
          batch.add('box', TMP, gmat);
        }
        m4.composeYaw(TMP, gt.x, gt.y + 8.4 * pulse, gt.z, gt.yaw, 11.4, 0.55, 0.55);
        batch.add('box', TMP, gmat);
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

    /* Bestzeitmarken: am gemessenen Lauf geeicht, nicht geraten. Sie werden
       gesetzt, sobald der Testpilot die Strecke faehrt. */
    level.medals = [
      { name: 'Platin', key: 'platin', time: 32 },
      { name: 'Gold', key: 'gold', time: 38 },
      { name: 'Silber', key: 'silber', time: 46 },
      { name: 'Bronze', key: 'bronze', time: 60 }
    ];
    return level;
  }

  root.MR.protoTrack = { build: build };
})(window);
