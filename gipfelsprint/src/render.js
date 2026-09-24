/*
 * Minimaler WebGL2-Renderer fuer Gipfelsprint.
 *
 * Bewusst ohne Fremdbibliothek: ein Instanz-Shader fuer alle Koerper
 * (Box, Kugel, Zylinder, Kegel, Torus, Quad), ein Himmels-Shader und
 * eine einfache Bloom-Nachbearbeitung.
 *
 * Instanzdaten pro Objekt (26 floats):
 *   0..15  Modellmatrix
 *   16..18 Grundfarbe
 *   19..21 Akzentfarbe (fuer nach oben zeigende Flaechen)
 *   22..25 (Leuchtkraft, Musterindex, Musterdichte, Deckkraft)
 */
(function (root) {
  'use strict';

  var m4 = root.MR.math.m4;
  var STRIDE = 26;

  /* ------------------------------------------------------------ Geometrie */

  function geoBox() {
    /* Einheitswuerfel, Kantenlaenge 1, Mittelpunkt im Ursprung. */
    var p = [], n = [], u = [], idx = [];
    var faces = [
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
    ];
    for (var f = 0; f < faces.length; f++) {
      var nor = faces[f][0], tan = faces[f][1], bit = faces[f][2];
      var base = p.length / 3;
      for (var c = 0; c < 4; c++) {
        var sx = (c === 1 || c === 2) ? 1 : -1;
        var sy = (c >= 2) ? 1 : -1;
        p.push(
          (nor[0] + tan[0] * sx + bit[0] * sy) * 0.5,
          (nor[1] + tan[1] * sx + bit[1] * sy) * 0.5,
          (nor[2] + tan[2] * sx + bit[2] * sy) * 0.5
        );
        n.push(nor[0], nor[1], nor[2]);
        u.push(sx * 0.5 + 0.5, sy * 0.5 + 0.5);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  function geoSphere(seg, ring) {
    var p = [], n = [], u = [], idx = [];
    for (var y = 0; y <= ring; y++) {
      var v = y / ring, phi = v * Math.PI;
      for (var x = 0; x <= seg; x++) {
        var uu = x / seg, theta = uu * Math.PI * 2;
        var nx = Math.sin(phi) * Math.cos(theta);
        var ny = Math.cos(phi);
        var nz = Math.sin(phi) * Math.sin(theta);
        p.push(nx * 0.5, ny * 0.5, nz * 0.5);
        n.push(nx, ny, nz);
        u.push(uu, v);
      }
    }
    for (var yy = 0; yy < ring; yy++) {
      for (var xx = 0; xx < seg; xx++) {
        var a = yy * (seg + 1) + xx, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  function geoTube(seg, topR, botR, cap) {
    /* Hoehe 1, Radius 0.5 * (topR|botR). */
    var p = [], n = [], u = [], idx = [];
    var i, a, c, s;
    for (i = 0; i <= seg; i++) {
      a = i / seg * Math.PI * 2;
      c = Math.cos(a); s = Math.sin(a);
      var slope = (botR - topR) * 0.5;
      var ny = slope / Math.hypot(1, slope);
      var sc = 1 / Math.hypot(1, slope);
      p.push(c * topR * 0.5, 0.5, s * topR * 0.5);
      n.push(c * sc, ny, s * sc);
      u.push(i / seg, 0);
      p.push(c * botR * 0.5, -0.5, s * botR * 0.5);
      n.push(c * sc, ny, s * sc);
      u.push(i / seg, 1);
    }
    for (i = 0; i < seg; i++) {
      var k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    if (cap) {
      var mk = function (y, r, ny2) {
        var center = p.length / 3;
        p.push(0, y, 0); n.push(0, ny2, 0); u.push(0.5, 0.5);
        for (var j = 0; j <= seg; j++) {
          var ang = j / seg * Math.PI * 2;
          p.push(Math.cos(ang) * r * 0.5, y, Math.sin(ang) * r * 0.5);
          n.push(0, ny2, 0);
          u.push(Math.cos(ang) * 0.5 + 0.5, Math.sin(ang) * 0.5 + 0.5);
        }
        for (var q = 0; q < seg; q++) {
          if (ny2 > 0) idx.push(center, center + 1 + q + 1, center + 1 + q);
          else idx.push(center, center + 1 + q, center + 1 + q + 1);
        }
      };
      if (topR > 0.001) mk(0.5, topR, 1);
      if (botR > 0.001) mk(-0.5, botR, -1);
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  function geoTorus(seg, ring, tube) {
    var p = [], n = [], u = [], idx = [];
    for (var i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (var j = 0; j <= ring; j++) {
        var b = j / ring * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
        var r = 0.5 + tube * cb;
        p.push(ca * r, sb * tube, sa * r);
        n.push(ca * cb, sb, sa * cb);
        u.push(i / seg, j / ring);
      }
    }
    for (var x = 0; x < seg; x++) {
      for (var y = 0; y < ring; y++) {
        var k = x * (ring + 1) + y, k2 = k + ring + 1;
        idx.push(k, k2, k + 1, k2, k2 + 1, k + 1);
      }
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  function geoPrism() {
    /* Dreiecksprisma: Dachform, First laeuft entlang X. */
    var p = [], n = [], u = [], idx = [];
    function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz) {
      var base = p.length / 3;
      p.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      for (var i = 0; i < 4; i++) n.push(nx, ny, nz);
      u.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    var s = 0.5, r = Math.SQRT1_2;
    /* zwei Dachflaechen */
    quad(-s, -s, s, s, -s, s, s, s, 0, -s, s, 0, 0, r, r);
    quad(s, -s, -s, -s, -s, -s, -s, s, 0, s, s, 0, 0, r, -r);
    /* Giebel links und rechts */
    var b1 = p.length / 3;
    p.push(-s, -s, -s, -s, -s, s, -s, s, 0);
    n.push(-1, 0, 0, -1, 0, 0, -1, 0, 0);
    u.push(0, 0, 1, 0, 0.5, 1);
    idx.push(b1, b1 + 1, b1 + 2);
    var b2 = p.length / 3;
    p.push(s, -s, s, s, -s, -s, s, s, 0);
    n.push(1, 0, 0, 1, 0, 0, 1, 0, 0);
    u.push(0, 0, 1, 0, 0.5, 1);
    idx.push(b2, b2 + 1, b2 + 2);
    /* Boden */
    quad(-s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s, 0, -1, 0);
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  /* Grasbuechel: drei gekreuzte, nach oben spitz zulaufende Baender mit
     leichter Biegung. Als Instanz gezeichnet, deshalb darf ein Buechel
     ruhig ein paar Dreiecke kosten. Ursprung steht auf dem Boden. */
  function geoTuft() {
    var p = [], n = [], u = [], idx = [];
    var blades = 3, segs = 3;
    for (var b = 0; b < blades; b++) {
      var a = (b / blades) * Math.PI * 2 + 0.4;
      var dx = Math.cos(a), dz = Math.sin(a);
      var lean = 0.30 + 0.16 * ((b * 7) % 3);
      var half = 0.14 - 0.02 * b;
      var base = p.length / 3;
      for (var s2 = 0; s2 <= segs; s2++) {
        var t = s2 / segs;
        var w = half * (1 - t * 0.92);
        var bend = t * t * lean;
        var cx = dx * bend, cz = dz * bend, cy = t;
        /* Normale zeigt aus der Bandflaeche heraus und leicht nach oben -
           dadurch faengt der Halm Sonne statt als schwarze Kante zu stehen. */
        var nx = -dz, nz2 = dx;
        for (var side = -1; side <= 1; side += 2) {
          p.push(cx + nx * w * side, cy, cz + nz2 * w * side);
          n.push(nx * 0.45, 0.86, nz2 * 0.45);
          u.push(side * 0.5 + 0.5, t);
        }
      }
      for (var s3 = 0; s3 < segs; s3++) {
        var i0 = base + s3 * 2;
        idx.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
        idx.push(i0, i0 + 3, i0 + 1, i0, i0 + 2, i0 + 3);   /* Rueckseite */
      }
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  /* Fels: Kugel mit versetzten Ecken, flach schattiert. Der Versatz haengt
     nur vom Winkel ab, damit jeder Fels dieselbe Form hat - Abwechslung
     kommt ueber Drehung und ungleiche Skalierung beim Setzen. */
  function geoRock(seed) {
    var seg = 9, ring = 6;
    var p = [], n = [], u = [], idx = [];
    function h(i, j) {
      var v = Math.sin((i * 12.9898 + j * 78.233 + seed) * 1.0) * 43758.5453;
      return v - Math.floor(v);
    }
    var pts = [];
    for (var y = 0; y <= ring; y++) {
      var phi = y / ring * Math.PI;
      pts[y] = [];
      for (var x = 0; x <= seg; x++) {
        var th = x / seg * Math.PI * 2;
        var xi = (x === seg) ? 0 : x;
        var r = 0.5 * (0.80 + 0.30 * h(xi, y));
        if (y === 0 || y === ring) r = 0.5 * 0.86;
        pts[y][x] = [Math.sin(phi) * Math.cos(th) * r, Math.cos(phi) * r * 0.86, Math.sin(phi) * Math.sin(th) * r];
      }
    }
    function tri(a, b, c) {
      var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var l = Math.hypot(nx, ny, nz) || 1;
      var base = p.length / 3;
      var v3 = [a, b, c];
      for (var k = 0; k < 3; k++) {
        p.push(v3[k][0], v3[k][1], v3[k][2]);
        n.push(nx / l, ny / l, nz / l);
        u.push(v3[k][0] + 0.5, v3[k][2] + 0.5);
      }
      idx.push(base, base + 1, base + 2);
    }
    for (var y2 = 0; y2 < ring; y2++) {
      for (var x2 = 0; x2 < seg; x2++) {
        var a2 = pts[y2][x2], b2 = pts[y2][x2 + 1], c2 = pts[y2 + 1][x2 + 1], d2 = pts[y2 + 1][x2];
        tri(a2, b2, c2);
        tri(a2, c2, d2);
      }
    }
    return { pos: p, nor: n, uv: u, idx: idx };
  }

  function geoQuad() {
    return {
      pos: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
      nor: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      uv: [0, 0, 1, 0, 1, 1, 0, 1],
      idx: [0, 2, 1, 0, 3, 2]
    };
  }

  /* -------------------------------------------------------------- Shader */

  var VS_MAIN = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNor;',
    'layout(location=2) in vec2 aUv;',
    'layout(location=3) in vec4 iM0;',
    'layout(location=4) in vec4 iM1;',
    'layout(location=5) in vec4 iM2;',
    'layout(location=6) in vec4 iM3;',
    'layout(location=7) in vec3 iColor;',
    'layout(location=8) in vec3 iAccent;',
    'layout(location=9) in vec4 iParams;',
    'uniform mat4 uViewProj;',
    'uniform float uTime;',
    'out vec3 vN; out vec3 vW; out vec3 vC; out vec3 vA; out vec4 vP; out vec2 vUv;',

    /* Wind: nur Muster 10 (Grasbuechel, Blattwerk) bewegt sich, und zwar
       staerker je weiter oben der Punkt im eigenen Koerper liegt. Die
       Phase kommt aus der Weltposition, damit nicht alles im Gleichtakt
       wackelt, sondern Boeen ueber die Wiese laufen. */
    'vec3 windOffset(vec3 wp, float localY, float pat, float hScale){',
    '  if (pat < 9.5) return vec3(0.0);',
    /* localY ist 0..1 im eigenen Koerper - mit der Y-Skalierung der Instanz
       wird daraus die echte Hoehe, und ein kurzer Halm wackelt nicht wie
       ein langer. */
    '  float h = max(localY, 0.0) * hScale;',
    '  float ph = wp.x * 0.22 + wp.z * 0.17;',
    '  float gust = 0.55 + 0.45 * sin(uTime * 0.37 + wp.x * 0.035 + wp.z * 0.028);',
    '  float a = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.8) * 0.25;',
    '  return vec3(a * 0.9, -abs(a) * 0.16, a * 0.5) * h * 0.30 * gust;',
    '}',

    'void main(){',
    '  mat4 M = mat4(iM0,iM1,iM2,iM3);',
    '  vec4 w = M * vec4(aPos,1.0);',
    '  w.xyz += windOffset(w.xyz, aPos.y, iParams.y, length(M[1].xyz));',
    '  vW = w.xyz;',
    '  mat3 rot = mat3(normalize(M[0].xyz), normalize(M[1].xyz), normalize(M[2].xyz));',
    '  vN = normalize(rot * aNor);',
    '  vC = iColor; vA = iAccent; vP = iParams; vUv = aUv;',
    '  gl_Position = uViewProj * w;',
    '}'
  ].join('\n');

  var FS_MAIN = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vN; in vec3 vW; in vec3 vC; in vec3 vA; in vec4 vP; in vec2 vUv;',
    'uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uFogCol, uCamPos;',
    'uniform float uTime, uFogDensity;',
    'uniform mat4 uLightVP;',
    'uniform highp sampler2DShadow uShadow;',
    'uniform float uShadowTexel, uShadowOn, uShadowWorld;',
    'out vec4 outColor;',

    /* Weicher Schatten: neun Proben ueber die Schattenkarte. Die Karte
       vergleicht selbst (COMPARE_REF_TO_TEXTURE), jede Probe ist dadurch
       bereits bilinear gefiltert - neun davon ergeben einen ruhigen Rand.
       Am Kartenrand wird ausgeblendet, sonst gaebe es dort eine Kante. */
    'float sunShadow(vec3 w, vec3 n, float ndl){',
    '  if (uShadowOn < 0.5) return 1.0;',
    /* Versatz entlang der Normalen statt einer grossen Tiefenverschiebung:
       eine reine Tiefenverschiebung loest den Schatten sichtbar vom Fuss
       des Objekts. Der Versatz betraegt knapp zwei Texel der Karte in
       Weltmass und faellt damit nie auf. */
    '  w += n * uShadowWorld * (2.4 - 1.4 * ndl);',
    '  vec4 lp = uLightVP * vec4(w, 1.0);',
    '  vec3 q = lp.xyz / lp.w * 0.5 + 0.5;',
    '  if (q.z > 1.0) return 1.0;',
    '  vec2 d = abs(q.xy - 0.5);',
    '  float edge = 1.0 - smoothstep(0.40, 0.50, max(d.x, d.y));',
    '  if (edge <= 0.001) return 1.0;',
    '  q.z -= mix(0.0009, 0.0003, ndl);',
    '  float sum = 0.0;',
    '  for (int y = -1; y <= 1; y++) {',
    '    for (int x = -1; x <= 1; x++) {',
    '      sum += texture(uShadow, vec3(q.xy + vec2(float(x), float(y)) * uShadowTexel, q.z));',
    '    }',
    '  }',
    '  return mix(1.0, sum / 9.0, edge);',
    '}',

    'float hash21(vec2 p){',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',

    'void main(){',
    '  vec3 N = normalize(vN);',
    '  int pat = int(vP.y + 0.5);',
    '  float alpha = vP.w;',

    /* Deko-Decal (Schattenfleck): keine Beleuchtung, runder Abfall. */
    '  if (pat == 7) {',
    '    float d = length(vUv - 0.5) * 2.0;',
    '    float f = 1.0 - smoothstep(0.45, 1.0, d);',
    '    if (f <= 0.003) discard;',
    '    outColor = vec4(vC, alpha * f);',
    '    return;',
    '  }',

    '  vec3 base = mix(vC, vA, smoothstep(0.35, 0.85, N.y));',
    '  vec2 puv = abs(N.y) > 0.5 ? vW.xz : (abs(N.x) > 0.5 ? vW.zy : vW.xy);',
    '  float sc = max(vP.z, 0.0001);',

    '  if (pat == 1) {',           /* Steinplatten */
    '    vec2 g = puv * sc;',
    '    float ch = mod(floor(g.x) + floor(g.y), 2.0);',
    '    base *= 0.88 + 0.12 * ch;',
    '    vec2 fr = abs(fract(g) - 0.5);',
    '    float line = smoothstep(0.42, 0.5, max(fr.x, fr.y));',
    '    base *= 1.0 - 0.35 * line;',
    '  } else if (pat == 2) {',    /* Holzbohlen */
    '    float b = fract(puv.y * sc);',
    '    float grain = vnoise(puv * vec2(sc * 5.0, sc * 0.6));',
    '    base *= 0.9 + 0.2 * grain;',
    '    base *= 1.0 - 0.4 * smoothstep(0.88, 1.0, abs(b - 0.5) * 2.0);',
    '  } else if (pat == 3) {',    /* Fels */
    '    float m = vnoise(puv * sc) * 0.6 + vnoise(puv * sc * 3.1) * 0.4;',
    '    base *= 0.78 + 0.42 * m;',
    '  } else if (pat == 4) {',    /* Wasser */
    '    float w = sin((puv.x + puv.y) * sc + uTime * 3.0) * 0.5 + 0.5;',
    '    float w2 = vnoise(puv * sc * 0.7 + vec2(0.0, uTime * 1.6));',
    '    base = mix(base, vA, clamp(w * 0.45 + w2 * 0.55, 0.0, 1.0));',
    '    alpha *= 0.72 + 0.28 * w;',
    '  } else if (pat == 5) {',    /* Gras / Laub */
    '    float m = vnoise(puv * sc * 2.0);',
    '    base *= 0.86 + 0.28 * m;',
    '  } else if (pat == 6) {',    /* Kristall-Facetten */
    '    float f = fract(vUv.y * sc + uTime * 0.35);',
    '    base += vA * 0.35 * smoothstep(0.45, 0.5, abs(f - 0.5));',
    '  } else if (pat == 8) {',    /* Wasserfall: laufende Streifen */
    '    float f = fract(puv.y * sc + uTime * 2.4);',
    '    float streak = smoothstep(0.1, 0.5, f) * smoothstep(1.0, 0.6, f);',
    '    base = mix(base, vA, streak);',
    '    alpha *= 0.55 + 0.45 * streak;',
    '  } else if (pat == 10) {',   /* Grashalm: dunkel am Grund, hell zur Spitze */
    '    base = mix(vC, vA, vUv.y * 0.82 + 0.18);',
    '    float fl = vnoise(vec2(vW.x, vW.z) * 0.6);',
    '    base *= 0.86 + 0.30 * fl;',
    '  } else if (pat == 11) {',   /* Gelaende: Grate, Flanken, Schneelinie */
    /* Die Berge im Hintergrund waren glatte Kegel in einer Farbe - sie
       lasen sich als Platzhalter, nicht als Landschaft. Drei Lagen
       Rauschen geben ihnen Grate, die Steilheit verdunkelt die Flanken
       (echte Haenge fangen weniger Himmelslicht), und weit oben liegt
       Schnee. Kostet keine einzige Flaeche mehr. */
    '    vec2 tuv = vW.xz * sc;',
    '    float n = vnoise(tuv) * 0.54 + vnoise(tuv * 2.7) * 0.31 + vnoise(tuv * 7.3) * 0.15;',
    '    float grat = 1.0 - abs(n - 0.5) * 2.0;',
    '    base *= 0.66 + 0.52 * n;',
    '    base *= 1.0 - (1.0 - abs(N.y)) * 0.30;',
    '    base += vA * 0.22 * smoothstep(0.72, 0.95, grat) * smoothstep(0.25, 0.7, N.y);',
    '  } else if (pat == 9) {',    /* Warnstreifen / Tempo-Pfeile */
    '    float f = fract((puv.x + puv.y) * sc - uTime * 1.8);',
    '    base = mix(base, vA, step(0.5, f));',
    '  }',

    '  vec3 V = normalize(uCamPos - vW);',
    '  vec3 L = normalize(uSunDir);',
    '  float ndl = max(dot(N, L), 0.0);',
    '  float sky = N.y * 0.5 + 0.5;',
    '  vec3 amb = mix(uGroundCol, uSkyCol, sky);',
    /* Das Umgebungslicht wird zur Haelfte entfaerbt und schwaecher gewichtet:
       kraeftig blaues Fuelllicht zog sonst jeder Flaeche die eigene Farbe
       weg und alles wurde pastellig. Dafuer traegt die Sonne mehr - das
       gibt satte Farben und klaren Unterschied zwischen Licht und Schatten. */
    '  amb = mix(vec3(dot(amb, vec3(0.299, 0.587, 0.114))), amb, 0.52);',
    /* Gegenlicht haelt abgewandte Flaechen lesbar statt schwarz. */
    '  float fill = max(dot(N, normalize(vec3(-L.x, 0.25, -L.z))), 0.0);',
    '  float sh = sunShadow(vW, N, ndl);',
    /* Im Schatten faellt nur das Sonnenlicht weg, das Umgebungslicht
       bekommt einen kuehlen Einschlag - das trennt Licht und Schatten
       farblich, statt nur dunkler zu werden. */
    /* Der Einschlag im Schatten war zu blau und zu dunkel: enge Schluchten,
       die ganz im Schatten liegen, wurden unlesbar. Etwas mehr
       Umgebungslicht und ein schwaecherer Farbstich. */
    '  vec3 shadeTint = mix(uSkyCol * 1.02 + 0.10, vec3(1.0), sh);',
    /* Das Fuelllicht lag bei 0,54 und damit so hoch, dass beschattete und
       besonnte Flaechen fast gleich hell waren - es gab kein Licht und
       keinen Schatten, nur Helligkeit. Weniger Umgebung, mehr Sonne:
       dasselbe Modell, aber mit Richtung. */
    '  vec3 col = base * (amb * 0.38 * shadeTint + uSunCol * ndl * 1.52 * sh + uSunCol * fill * 0.16);',

    /* Glanz fuer Wasser und Kristall */
    '  if (pat == 4 || pat == 6) {',
    '    vec3 H = normalize(L + V);',
    '    col += uSunCol * pow(max(dot(N, H), 0.0), 48.0) * 0.8;',
    '  }',

    /* Silhouettenlicht haelt Figuren vom Hintergrund getrennt */
    '  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  col += uSkyCol * rim * 0.20;',

    '  col = mix(col, base * 1.35 + 0.18, clamp(vP.x, 0.0, 1.0));',

    /* Kontaktverdunklung. Nach unten zeigende Flaechen bekommen kein
       Himmelslicht und waren trotzdem genauso hell wie alles andere -
       dadurch stand nichts auf dem Boden, alles schwebte. Das ist der
       billigste Ersatz fuer Umgebungsverdeckung und kostet eine Zeile. */
    '  col *= 1.0 - clamp(-N.y, 0.0, 1.0) * 0.34;',

    /* ------------------------------------------------------- Atmosphaere
       Vorher: ein Nebelwert mal eine helle Farbe, gleichmaessig ueber die
       ganze Strecke. Das Ergebnis war Milchglas - die Berge im Hintergrund
       hatten dieselbe Helligkeit wie der Boden vor den Fuessen, und dem
       Bild fehlte jede Tiefe.

       Jetzt drei Dinge zugleich, wie in der echten Atmosphaere:
       - die Dichte nimmt mit der Hoehe ab, also bleibt der Himmel klar
         und nur das Tal steht im Dunst,
       - die Ferne verliert zuerst SAETTIGUNG und erst danach Helligkeit,
       - blickt man Richtung Sonne, kippt der Dunst in ihre Farbe. */
    '  float dist = length(uCamPos - vW);',
    '  vec3 Vd = normalize(vW - uCamPos);',
    '  float hFall = exp(-clamp(vW.y - uCamPos.y, -40.0, 120.0) * 0.011);',
    '  float fog = 1.0 - exp(-dist * uFogDensity * hFall);',
    '  fog = clamp(fog, 0.0, 0.88);',
    '  float sunAmt = pow(max(dot(Vd, L), 0.0), 5.0);',
    /* Die Nebelfarben der Zonen liegen nahe Weiss (0,80/0,90/1,00). Bei
       95 % Deckung verschwand der ganze Hintergrund darin - die Berge
       waren Papierschnitte. Abgedunkelt und auf 88 % begrenzt behaelt die
       Ferne ihre Form. */
    '  vec3 fogC = mix(uFogCol * 0.80, uSunCol * 1.06, sunAmt * 0.55);',
    '  float fl = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(col, vec3(fl), fog * 0.42);',
    '  col = mix(col, fogC, fog);',

    '  outColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* Schattenkarte: dieselben Instanzattribute, aber nur Tiefe aus Sicht der
     Sonne. Der Fragment-Shader schreibt nichts - gl_FragDepth genuegt. */
  var VS_SHADOW = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos;',
    'layout(location=3) in vec4 iM0;',
    'layout(location=4) in vec4 iM1;',
    'layout(location=5) in vec4 iM2;',
    'layout(location=6) in vec4 iM3;',
    'layout(location=9) in vec4 iParams;',
    'uniform mat4 uLightVP;',
    'uniform float uTime;',
    'void main(){',
    '  vec4 w = mat4(iM0,iM1,iM2,iM3) * vec4(aPos,1.0);',
    /* Dieselbe Bewegung wie im Bild - sonst steht der Schatten still,
       waehrend das Gras sich bewegt. */
    '  if (iParams.y > 9.5) {',
    '    float h = max(aPos.y, 0.0) * length(iM1.xyz);',
    '    float ph = w.x * 0.22 + w.z * 0.17;',
    '    float gust = 0.55 + 0.45 * sin(uTime * 0.37 + w.x * 0.035 + w.z * 0.028);',
    '    float a = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.8) * 0.25;',
    '    w.xyz += vec3(a * 0.9, -abs(a) * 0.16, a * 0.5) * h * 0.30 * gust;',
    '  }',
    '  gl_Position = uLightVP * w;',
    '}'
  ].join('\n');

  var FS_SHADOW = [
    '#version 300 es',
    'precision mediump float;',
    'void main(){}'
  ].join('\n');

  var VS_FULL = [
    '#version 300 es',
    'out vec2 vUv;',
    'void main(){',
    '  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);',
    '  vUv = p;',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_SKY = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform mat4 uInvViewProj;',
    'uniform vec3 uCamPos, uSunDir, uZenith, uHorizon, uSunCol;',
    'uniform float uTime;',
    'out vec4 outColor;',
    'float hash21(vec2 p){',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',
    'void main(){',
    '  vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);',
    '  vec4 wp = uInvViewProj * ndc;',
    '  vec3 dir = normalize(wp.xyz / wp.w - uCamPos);',
    '  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 col = mix(uHorizon, uZenith, pow(h, 0.75));',
    /* Sonne mit weichem Hof */
    '  float sd = max(dot(dir, normalize(uSunDir)), 0.0);',
    '  col += uSunCol * pow(sd, 620.0) * 1.5;',
    '  col += uSunCol * pow(sd, 22.0) * 0.20;',
    /* Weiche Wolkenbaender ueber dem Horizont */
    '  if (dir.y > 0.0) {',
    '    vec2 cu = dir.xz / max(dir.y + 0.16, 0.05);',
    '    float n = vnoise(cu * 0.55 + vec2(uTime * 0.012, 0.0)) * 0.6',
    '            + vnoise(cu * 1.4 + vec2(uTime * 0.02, 3.0)) * 0.4;',
    '    float cloud = smoothstep(0.52, 0.86, n) * smoothstep(0.0, 0.22, dir.y);',
    '    col = mix(col, vec3(1.0, 0.99, 0.97), cloud * 0.72);',
    '  }',
    '  outColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var FS_THRESH = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform float uThreshold;',
    'out vec4 outColor;',
    'void main(){',
    '  vec3 c = texture(uTex, vUv).rgb;',
    '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '  float f = smoothstep(uThreshold, uThreshold + 0.35, l);',
    '  outColor = vec4(c * f, 1.0);',
    '}'
  ].join('\n');

  var FS_BLUR = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uDir;',
    'out vec4 outColor;',
    'void main(){',
    '  vec3 sum = texture(uTex, vUv).rgb * 0.227;',
    '  sum += (texture(uTex, vUv + uDir * 1.385).rgb + texture(uTex, vUv - uDir * 1.385).rgb) * 0.316;',
    '  sum += (texture(uTex, vUv + uDir * 3.231).rgb + texture(uTex, vUv - uDir * 3.231).rgb) * 0.070;',
    '  outColor = vec4(sum, 1.0);',
    '}'
  ].join('\n');

  var FS_COMPOSITE = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform sampler2D uScene, uBloom;',
    'uniform float uBloomStrength, uVignette, uChroma;',
    'out vec4 outColor;',

    /* Szene plus Bloom an einer Stelle - einmal je Kanal abgetastet, damit
       der Farbsaum zum Rand hin entsteht. */
    'vec3 hole(vec2 uv){ return texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomStrength; }',

    'void main(){',
    /* --------------------------------------------------- Linse zuerst
       Der Farbsaum MUSS vor der Farbentwicklung stehen. In der ersten
       Fassung wurden Rot und Blau nachtraeglich neu abgetastet, waehrend
       Gruen schon durch Kennlinie, Saettigung und S-Kurve gelaufen war -
       die drei Kanaele kamen damit aus verschiedenen Bearbeitungsstufen,
       und das ganze Bild fiel blass zusammen. */
    '  vec2 q = vUv - 0.5;',
    '  float r2 = dot(q, q);',
    '  vec3 c;',
    '  float ca = uChroma * (0.5 + 3.4 * r2);',
    '  if (ca > 0.0004) {',
    '    c.r = hole(vUv - q * ca).r;',
    '    c.g = hole(vUv).g;',
    '    c.b = hole(vUv + q * ca).b;',
    '  } else {',
    '    c = hole(vUv);',
    '  }',

    /* Filmische Kennlinie (ACES-Naeherung), nur auf die Helligkeit
       angewandt - kanalweise zieht dieselbe Kurve kraeftigen Farben die
       Saettigung weg, weil sie den hellsten Kanal staerker staucht. */
    '  float y = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);',
    '  float ye = y * 1.02;',
    '  float yt = (ye * (2.51 * ye + 0.03)) / (ye * (2.43 * ye + 0.59) + 0.14);',
    '  c *= yt / y;',
    '  c /= max(1.0, max(max(c.r, c.g), c.b));',

    /* Farbkraft: blasse Stellen deutlich anheben, kraeftige kaum - sonst
       laufen die Neonfarben ins Weisse. */
    '  float lum = dot(c, vec3(0.299, 0.587, 0.114));',
    '  float sat = clamp(length(c - vec3(lum)) * 1.7, 0.0, 1.0);',
    '  c = mix(vec3(lum), c, mix(1.42, 1.10, sat));',

    /* Schwarzpunkt. Hier lag der Grund, warum das Bild nach Prototyp
       aussah: der letzte Schritt war frueher pow(c, 0.92), also eine
       Aufhellung. Zusammen mit dem Dunst lag alles im oberen Drittel des
       Helligkeitsbereichs - es gab nirgends ein Schwarz, und ohne Tiefen
       wirkt jedes Modell flach. */
    '  c = max(c - 0.050, 0.0) / (1.0 - 0.050);',

    /* S-Kurve: Tiefen satter, Lichter strahlender. */
    '  vec3 t = clamp(c, 0.0, 1.0);',
    '  c = mix(c, t * t * (3.0 - 2.0 * t), 0.30);',

    /* Farbteilung: Tiefen kuehl, Lichter warm - der Griff, der ein Bild
       nach Film aussehen laesst, fuer zwei Mischungen. */
    '  float ly = dot(c, vec3(0.299, 0.587, 0.114));',
    '  c = mix(c * vec3(0.94, 0.975, 1.08), c * vec3(1.06, 1.005, 0.93), smoothstep(0.20, 0.82, ly));',

    '  c *= 1.0 - r2 * uVignette;',
    /* Feines Korn haelt Verlaeufe ruhig und nimmt dem Bild das Sterile. */
    '  float gr = fract(sin(dot(vUv * 1024.0, vec2(12.9898, 78.233))) * 43758.5453);',
    '  c += (gr - 0.5) * 0.014;',
    '  outColor = vec4(max(c, 0.0), 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------- Renderer */

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Programm: ' + gl.getProgramInfoLog(p));
    }
    var uni = Object.create(null);
    var count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = gl.getActiveUniform(p, i);
      uni[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { prog: p, u: uni };
  }

  function Batch(gfx, dynamic) {
    this.gfx = gfx;
    this.dynamic = !!dynamic;
    this.groups = Object.create(null);
    /* Huellkugel ueber alle Instanzen - damit laesst sich ein ganzer Stapel
       verwerfen, ohne ihn zu zeichnen. Bei beweglichen Stapeln unbenutzt,
       die sind klein und immer beim Spieler. */
    this.cx = 0; this.cy = 0; this.cz = 0; this.cr = Infinity;
  }

  /* Aus den hochgeladenen Instanzen die Huellkugel bestimmen. */
  Batch.prototype.measure = function () {
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    var maxScale = 0, any = false;
    for (var k in this.groups) {
      var g = this.groups[k], d = g.data;
      for (var i = 0; i < g.count; i++) {
        var o = i * STRIDE;
        var x = d[o + 12], y = d[o + 13], z = d[o + 14];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        var s0 = Math.hypot(d[o], d[o + 1], d[o + 2]);
        var s1 = Math.hypot(d[o + 4], d[o + 5], d[o + 6]);
        var s2 = Math.hypot(d[o + 8], d[o + 9], d[o + 10]);
        var sm = Math.max(s0, Math.max(s1, s2));
        if (sm > maxScale) maxScale = sm;
        any = true;
      }
    }
    if (!any) { this.cr = -1; return this; }
    this.cx = (minX + maxX) / 2; this.cy = (minY + maxY) / 2; this.cz = (minZ + maxZ) / 2;
    this.cr = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + maxScale;
    return this;
  };

  Batch.prototype.clear = function () {
    for (var k in this.groups) this.groups[k].count = 0;
    return this;
  };

  Batch.prototype.add = function (meshName, m, mat) {
    var g = this.groups[meshName];
    if (!g) {
      g = this.groups[meshName] = { data: new Float32Array(STRIDE * 128), count: 0, buf: null, vao: null, cap: 128 };
    }
    if (g.count >= g.cap) {
      var bigger = new Float32Array(g.data.length * 2);
      bigger.set(g.data);
      g.data = bigger;
      g.cap *= 2;
      g.needRealloc = true;
    }
    var d = g.data, o = g.count * STRIDE;
    d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2]; d[o + 3] = m[3];
    d[o + 4] = m[4]; d[o + 5] = m[5]; d[o + 6] = m[6]; d[o + 7] = m[7];
    d[o + 8] = m[8]; d[o + 9] = m[9]; d[o + 10] = m[10]; d[o + 11] = m[11];
    d[o + 12] = m[12]; d[o + 13] = m[13]; d[o + 14] = m[14]; d[o + 15] = m[15];
    var c = mat.color, a = mat.accent || mat.color;
    d[o + 16] = c[0]; d[o + 17] = c[1]; d[o + 18] = c[2];
    d[o + 19] = a[0]; d[o + 20] = a[1]; d[o + 21] = a[2];
    d[o + 22] = mat.emissive || 0;
    d[o + 23] = mat.pattern || 0;
    d[o + 24] = mat.patternScale || 1;
    d[o + 25] = mat.alpha === undefined ? 1 : mat.alpha;
    g.count++;
    return this;
  };

  Batch.prototype.upload = function () {
    var gl = this.gfx.gl;
    for (var k in this.groups) {
      var g = this.groups[k];
      if (!g.buf) g.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buf);
      if (!g.vao || g.needRealloc) {
        gl.bufferData(gl.ARRAY_BUFFER, g.data, this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        g.needRealloc = false;
      } else {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.data, 0, g.count * STRIDE);
      }
      if (!g.vao) g.vao = this.gfx.makeVao(k, g.buf);
    }
    return this;
  };

  function create(canvas) {
    var gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      desynchronized: true
    });
    if (!gl) return null;

    var gfx = { gl: gl, canvas: canvas, meshes: Object.create(null), dpr: 1, width: 1, height: 1 };

    var main = program(gl, VS_MAIN, FS_MAIN);
    var sky = program(gl, VS_FULL, FS_SKY);
    var thresh = program(gl, VS_FULL, FS_THRESH);
    var blur = program(gl, VS_FULL, FS_BLUR);
    var comp = program(gl, VS_FULL, FS_COMPOSITE);
    var shadow = program(gl, VS_SHADOW, FS_SHADOW);

    function makeMesh(g) {
      var inter = new Float32Array(g.pos.length / 3 * 8);
      for (var i = 0; i < g.pos.length / 3; i++) {
        inter[i * 8] = g.pos[i * 3];
        inter[i * 8 + 1] = g.pos[i * 3 + 1];
        inter[i * 8 + 2] = g.pos[i * 3 + 2];
        inter[i * 8 + 3] = g.nor[i * 3];
        inter[i * 8 + 4] = g.nor[i * 3 + 1];
        inter[i * 8 + 5] = g.nor[i * 3 + 2];
        inter[i * 8 + 6] = g.uv[i * 2];
        inter[i * 8 + 7] = g.uv[i * 2 + 1];
      }
      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
      return { vb: vb, ib: ib, count: g.idx.length };
    }

    gfx.meshes.box = makeMesh(geoBox());
    gfx.meshes.sphere = makeMesh(geoSphere(14, 9));
    gfx.meshes.blob = makeMesh(geoSphere(10, 7));
    gfx.meshes.cylinder = makeMesh(geoTube(14, 1, 1, true));
    gfx.meshes.cone = makeMesh(geoTube(10, 0.02, 1, true));
    gfx.meshes.crystal = makeMesh(geoTube(6, 0.05, 1, true));
    gfx.meshes.pillar = makeMesh(geoTube(7, 0.74, 1.0, true));
    gfx.meshes.prism = makeMesh(geoPrism());
    gfx.meshes.torus = makeMesh(geoTorus(20, 8, 0.14));
    gfx.meshes.quad = makeMesh(geoQuad());
    gfx.meshes.tuft = makeMesh(geoTuft());
    gfx.meshes.rock = makeMesh(geoRock(1.0));
    gfx.meshes.rock2 = makeMesh(geoRock(17.0));
    gfx.meshes.rock3 = makeMesh(geoRock(53.0));

    gfx.makeVao = function (meshName, instBuf) {
      var mesh = gfx.meshes[meshName];
      var vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      var bytes = STRIDE * 4;
      for (var i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(3 + i);
        gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, bytes, i * 16);
        gl.vertexAttribDivisor(3 + i, 1);
      }
      gl.enableVertexAttribArray(7);
      gl.vertexAttribPointer(7, 3, gl.FLOAT, false, bytes, 64);
      gl.vertexAttribDivisor(7, 1);
      gl.enableVertexAttribArray(8);
      gl.vertexAttribPointer(8, 3, gl.FLOAT, false, bytes, 76);
      gl.vertexAttribDivisor(8, 1);
      gl.enableVertexAttribArray(9);
      gl.vertexAttribPointer(9, 4, gl.FLOAT, false, bytes, 88);
      gl.vertexAttribDivisor(9, 1);
      gl.bindVertexArray(null);
      return vao;
    };

    /* ------------------------------------------------------ Rendertargets */

    var fbo = { scene: null, bright: null, blur: null };

    function makeTarget(w, h, depth) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var rb = null;
      if (depth) {
        rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      }
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { fb: f, tex: tex, rb: rb, w: w, h: h } : null;
    }

    function dropTarget(t) {
      if (!t) return;
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
      if (t.rb) gl.deleteRenderbuffer(t.rb);
    }

    gfx.bloom = true;

    /* ------------------------------------------------- Schattenkarte */

    var shadowMap = null;
    var lightView = m4.make(), lightProj = m4.make(), lightVP = m4.make();
    var focus = { x: 0, y: 0, z: 0, r: 46 };

    function makeShadowMap(size) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0,
        gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      /* Die Karte vergleicht beim Lesen selbst - damit filtert die Hardware
         den Schattenrand, statt rohe Tiefen zu liefern. */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); return null; }
      return { fb: fb, tex: tex, size: size };
    }

    /* Der Schattenkasten folgt dem Spieler. Ohne Rasterung auf Texelschritte
       wandert die Karte bei jeder Kamerabewegung um Bruchteile eines Texels
       weiter und die Schattenraender flimmern. */
    gfx.setShadowFocus = function (x, y, z, radius) {
      focus.x = x; focus.y = y; focus.z = z;
      if (radius) focus.r = radius;
    };

    gfx.shadowQuality = function (size) {
      if (shadowMap && shadowMap.size === size) return;
      if (shadowMap) { gl.deleteFramebuffer(shadowMap.fb); gl.deleteTexture(shadowMap.tex); }
      shadowMap = size > 0 ? makeShadowMap(size) : null;
    };
    gfx.shadowQuality(2048);

    function buildLightMatrix() {
      var d = env.sunDir;
      var len = Math.hypot(d[0], d[1], d[2]) || 1;
      var lx = d[0] / len, ly = d[1] / len, lz = d[2] / len;
      var r = focus.r;
      var texel = 2 * r / shadowMap.size;
      var cx = Math.round(focus.x / texel) * texel;
      var cy = Math.round(focus.y / texel) * texel;
      var cz = Math.round(focus.z / texel) * texel;
      /* Der Kasten reicht nur so weit nach hinten, wie noetig - ein zu
         tiefer Bereich frisst die Genauigkeit der Tiefenwerte auf. */
      var back = r * 1.7;
      m4.lookAt(lightView, [cx + lx * back, cy + ly * back, cz + lz * back], [cx, cy, cz],
        Math.abs(ly) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
      m4.ortho(lightProj, -r, r, -r, r, 1.0, back + r * 1.9);
      m4.multiply(lightVP, lightProj, lightView);
      return lightVP;
    }

    gfx.resize = function (dpr) {
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (w === gfx.width && h === gfx.height) return false;
      canvas.width = w;
      canvas.height = h;
      gfx.width = w;
      gfx.height = h;
      gfx.dpr = dpr;
      dropTarget(fbo.scene); dropTarget(fbo.bright); dropTarget(fbo.blur);
      fbo.scene = makeTarget(w, h, true);
      fbo.bright = makeTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), false);
      fbo.blur = makeTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), false);
      if (!fbo.scene || !fbo.bright || !fbo.blur) gfx.bloom = false;
      return true;
    };

    gfx.createBatch = function (dynamic) { return new Batch(gfx, dynamic); };

    /* Sechs Ebenen der Kamerapyramide aus der Matrix. */
    var planes = new Float32Array(24);
    function extractPlanes(vp) {
      var rows = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]];
      for (var i = 0; i < 6; i++) {
        var a = rows[i][0], b2 = rows[i][1], sg = rows[i][2];
        var px = vp[a] + sg * vp[b2];
        var py = vp[4 + a] + sg * vp[4 + b2];
        var pz = vp[8 + a] + sg * vp[8 + b2];
        var pw = vp[12 + a] + sg * vp[12 + b2];
        var l = Math.hypot(px, py, pz) || 1;
        planes[i * 4] = px / l; planes[i * 4 + 1] = py / l;
        planes[i * 4 + 2] = pz / l; planes[i * 4 + 3] = pw / l;
      }
    }

    function inFrustum(b) {
      if (!(b.cr < Infinity)) return b.cr !== -1;
      for (var i = 0; i < 6; i++) {
        var d = planes[i * 4] * b.cx + planes[i * 4 + 1] * b.cy + planes[i * 4 + 2] * b.cz + planes[i * 4 + 3];
        if (d < -b.cr) return false;
      }
      return true;
    }

    /* Kugelpruefung um den Schattenkasten. Der Kasten ist laengs der
       Sonnenrichtung deutlich tiefer als breit (er reicht hinter die
       Szene, damit hohe Koerper noch hineinwerfen), deshalb muss der
       Radius die Raumdiagonale abdecken - eine Pruefung nur ueber die
       Breite laesst Schatten entfernter, hoher Koerper wegfallen. */
    function nearLight(b) {
      if (!(b.cr < Infinity)) return b.cr !== -1;
      var reach = focus.r * 3.0 + b.cr;
      var dx = b.cx - focus.x, dy = b.cy - focus.y, dz = b.cz - focus.z;
      return dx * dx + dy * dy + dz * dz < reach * reach;
    }

    gfx.drawn = 0;

    gfx.cull = true;
    gfx.cullView = true;
    gfx.cullShadow = true;

    function drawBatches(list, test) {
      for (var i = 0; i < list.length; i++) {
        if (gfx.cull && test && !test(list[i])) continue;
        gfx.drawn++;
        var groups = list[i].groups;
        for (var k in groups) {
          var g = groups[k];
          if (!g.count || !g.vao) continue;
          gl.bindVertexArray(g.vao);
          gl.drawElementsInstanced(gl.TRIANGLES, gfx.meshes[k].count, gl.UNSIGNED_SHORT, 0, g.count);
        }
      }
      gl.bindVertexArray(null);
    }

    var env = {
      /* Sonnenstand. Vorher 48 Grad ueber dem Horizont - also fast Mittag,
         und Mittagslicht ist das flachste Licht, das es gibt: die Schatten
         liegen unter den Objekten und man sieht keine Form. Jetzt 24 Grad.
         Die Schatten werden lang und legen sich quer ueber die Flaechen,
         Kanten bekommen Licht und Gegenlicht, und die Szene hat eine
         Richtung. Das ist der billigste Griff mit der groessten Wirkung. */
      sunDir: [0.62, 0.36, 0.52],
      sunCol: [1.05, 0.96, 0.80],
      skyCol: [0.46, 0.66, 0.92],
      groundCol: [0.30, 0.28, 0.22],
      fogCol: [0.66, 0.80, 0.94],
      zenith: [0.13, 0.42, 0.84],
      horizon: [0.74, 0.88, 0.99],
      fogDensity: 0.0016
    };
    gfx.env = env;

    /*
     * Zeichnet einen Frame.
     *   viewProj / invViewProj : Kameramatrizen
     *   opaque / transparent   : Listen von Batches
     */
    /* casters: die Liste fuer die Schattenkarte. Fehlt sie, wirft alles
       Undurchsichtige Schatten. */
    gfx.render = function (viewProj, invViewProj, camPos, time, opaque, transparent, casters) {
      /* ---- Durchgang 1: Tiefe aus Sicht der Sonne ---- */
      var useShadow = !!shadowMap;
      if (useShadow) {
        buildLightMatrix();
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowMap.fb);
        gl.viewport(0, 0, shadowMap.size, shadowMap.size);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        /* Rueckseiten werfen den Schatten: das schiebt den Selbstschatten
           hinter die sichtbare Flaeche und spart den groessten Teil der
           sonst noetigen Tiefenverschiebung. */
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.useProgram(shadow.prog);
        gl.uniformMatrix4fv(shadow.u.uLightVP, false, lightVP);
        gl.uniform1f(shadow.u.uTime, time);
        drawBatches(casters || opaque, gfx.cullShadow ? nearLight : null);
        gl.cullFace(gl.BACK);
      }

      var useBloom = gfx.bloom && fbo.scene;
      gl.bindFramebuffer(gl.FRAMEBUFFER, useBloom ? fbo.scene.fb : null);
      gl.viewport(0, 0, gfx.width, gfx.height);
      gl.clearColor(env.horizon[0], env.horizon[1], env.horizon[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* Himmel */
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(sky.prog);
      gl.uniformMatrix4fv(sky.u.uInvViewProj, false, invViewProj);
      gl.uniform3fv(sky.u.uCamPos, camPos);
      gl.uniform3fv(sky.u.uSunDir, env.sunDir);
      gl.uniform3fv(sky.u.uZenith, env.zenith);
      gl.uniform3fv(sky.u.uHorizon, env.horizon);
      gl.uniform3fv(sky.u.uSunCol, env.sunCol);
      gl.uniform1f(sky.u.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* Welt */
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
      gl.useProgram(main.prog);
      gl.uniformMatrix4fv(main.u.uViewProj, false, viewProj);
      gl.uniform3fv(main.u.uSunDir, env.sunDir);
      gl.uniform3fv(main.u.uSunCol, env.sunCol);
      gl.uniform3fv(main.u.uSkyCol, env.skyCol);
      gl.uniform3fv(main.u.uGroundCol, env.groundCol);
      gl.uniform3fv(main.u.uFogCol, env.fogCol);
      gl.uniform3fv(main.u.uCamPos, camPos);
      gl.uniform1f(main.u.uTime, time);
      gl.uniform1f(main.u.uFogDensity, env.fogDensity);
      gl.uniform1f(main.u.uShadowOn, useShadow ? 1 : 0);
      if (useShadow) {
        gl.uniformMatrix4fv(main.u.uLightVP, false, lightVP);
        gl.uniform1f(main.u.uShadowTexel, 1 / shadowMap.size);
        gl.uniform1f(main.u.uShadowWorld, 2 * focus.r / shadowMap.size);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, shadowMap.tex);
        gl.uniform1i(main.u.uShadow, 2);
        gl.activeTexture(gl.TEXTURE0);
      }
      gfx.drawn = 0;
      extractPlanes(viewProj);
      drawBatches(opaque, gfx.cullView ? inFrustum : null);

      if (transparent && transparent.length) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        drawBatches(transparent, gfx.cullView ? inFrustum : null);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      if (!useBloom) return;

      /* Bloom: Helligkeitsfilter -> zwei Unschaerfepaesse -> Komposit */
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.bright.fb);
      gl.viewport(0, 0, fbo.bright.w, fbo.bright.h);
      gl.useProgram(thresh.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.scene.tex);
      gl.uniform1i(thresh.u.uTex, 0);
      gl.uniform1f(thresh.u.uThreshold, 0.80);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(blur.prog);
      gl.uniform1i(blur.u.uTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.blur.fb);
      gl.bindTexture(gl.TEXTURE_2D, fbo.bright.tex);
      gl.uniform2f(blur.u.uDir, 1 / fbo.bright.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.bright.fb);
      gl.bindTexture(gl.TEXTURE_2D, fbo.blur.tex);
      gl.uniform2f(blur.u.uDir, 0, 1 / fbo.bright.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gfx.width, gfx.height);
      gl.useProgram(comp.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.scene.tex);
      gl.uniform1i(comp.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fbo.bright.tex);
      gl.uniform1i(comp.u.uBloom, 1);
      /* Bildstimmung. `gfx.grade` setzt das Spiel je Bild - bei Tempo
         wird der Rand dunkler und die Randfehlfarbe staerker, das ist der
         billigste und wirksamste Tempoeindruck, den ein Bildschirm hat. */
      gl.uniform1f(comp.u.uBloomStrength, gfx.grade.bloom);
      gl.uniform1f(comp.u.uVignette, gfx.grade.vignette);
      gl.uniform1f(comp.u.uChroma, gfx.grade.chroma);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    };

    /* Vorgabewerte; das Spiel schreibt sie je Bild um. */
    gfx.grade = { bloom: 0.46, vignette: 0.42, chroma: 0.0 };

    return gfx;
  }

  root.MR = root.MR || {};
  root.MR.render = { create: create, STRIDE: STRIDE };
})(window);
