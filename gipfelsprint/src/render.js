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
    'out vec3 vN; out vec3 vW; out vec3 vC; out vec3 vA; out vec4 vP; out vec2 vUv;',
    'void main(){',
    '  mat4 M = mat4(iM0,iM1,iM2,iM3);',
    '  vec4 w = M * vec4(aPos,1.0);',
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
    '  vec3 col = base * (amb * 0.44 + uSunCol * ndl * 1.22 + uSunCol * fill * 0.16);',

    /* Glanz fuer Wasser und Kristall */
    '  if (pat == 4 || pat == 6) {',
    '    vec3 H = normalize(L + V);',
    '    col += uSunCol * pow(max(dot(N, H), 0.0), 48.0) * 0.8;',
    '  }',

    /* Silhouettenlicht haelt Figuren vom Hintergrund getrennt */
    '  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  col += uSkyCol * rim * 0.20;',

    '  col = mix(col, base * 1.35 + 0.18, clamp(vP.x, 0.0, 1.0));',

    '  float dist = length(uCamPos - vW);',
    '  float fog = 1.0 - exp(-dist * uFogDensity);',
    '  col = mix(col, uFogCol, clamp(fog, 0.0, 0.92));',

    '  outColor = vec4(col, alpha);',
    '}'
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
    '  col += uSunCol * pow(sd, 340.0) * 2.4;',
    '  col += uSunCol * pow(sd, 12.0) * 0.28;',
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
    'uniform float uBloomStrength, uVignette;',
    'out vec4 outColor;',
    'void main(){',
    '  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStrength;',
    '  c = c / (c + vec3(1.6)) * 2.1;',            /* nur Spitzlichter komprimieren */
    /* Farbkraft: blasse Stellen werden deutlich angehoben, ohnehin kraeftige
       nur wenig - sonst laufen die Neonfarben ins Weisse. */
    '  float lum = dot(c, vec3(0.299, 0.587, 0.114));',
    '  float sat = clamp(length(c - vec3(lum)) * 1.7, 0.0, 1.0);',
    '  c = mix(vec3(lum), c, mix(1.40, 1.12, sat));',
    /* Leichte S-Kurve: Tiefen satter, Lichter strahlender. */
    '  vec3 t = clamp(c, 0.0, 1.0);',
    '  c = mix(c, t * t * (3.0 - 2.0 * t), 0.26);',
    '  vec2 q = vUv - 0.5;',
    '  c *= 1.0 - dot(q, q) * uVignette;',
    '  c = pow(max(c, 0.0), vec3(0.92));',
    '  outColor = vec4(c, 1.0);',
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
  }

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

    function drawBatches(list) {
      for (var i = 0; i < list.length; i++) {
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
      sunDir: [0.46, 0.66, 0.38],
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
    gfx.render = function (viewProj, invViewProj, camPos, time, opaque, transparent) {
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
      drawBatches(opaque);

      if (transparent && transparent.length) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        drawBatches(transparent);
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
      gl.uniform1f(comp.u.uBloomStrength, 0.46);
      gl.uniform1f(comp.u.uVignette, 0.42);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    };

    return gfx;
  }

  root.MR = root.MR || {};
  root.MR.render = { create: create, STRIDE: STRIDE };
})(window);
