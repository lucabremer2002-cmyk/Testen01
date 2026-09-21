/*
 * Kollisionswelt.
 *
 * Alle Koerper sind Quader, die nur um die Y-Achse gedreht sein duerfen.
 * Das reicht fuer das ganze Level und macht die Aufloesung schnell und
 * vor allem vorhersagbar - wichtig fuer ein Time-Trial.
 *
 * Die Spielfigur ist eine stehende Kapsel, die als drei Kugeln geprueft
 * wird (Fuss, Mitte, Kopf).
 */
(function (root) {
  'use strict';

  var CELL = 10;

  function World() {
    this.statics = [];
    this.dynamics = [];
    this.all = [];
    this.grid = new Map();
    this.stamp = 0;
    this._marks = [];
    this._out = [];
  }

  World.prototype.add = function (c) {
    c.index = this.all.length;
    c.cos = Math.cos(c.yaw || 0);
    c.sin = Math.sin(c.yaw || 0);
    c.yaw = c.yaw || 0;
    if (c.active === undefined) c.active = true;
    /* Umkreisradius fuer Breitphase und Bewegungsreserve. */
    c.radius = Math.hypot(c.hx, c.hy, c.hz);
    this.all.push(c);
    this._marks.push(0);
    if (c.dynamic) {
      this.dynamics.push(c);
      c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw;
    } else {
      this.statics.push(c);
      this._insert(c);
    }
    return c;
  };

  World.prototype._insert = function (c) {
    var r = Math.hypot(c.hx, c.hz);
    var x0 = Math.floor((c.x - r) / CELL), x1 = Math.floor((c.x + r) / CELL);
    var z0 = Math.floor((c.z - r) / CELL), z1 = Math.floor((c.z + r) / CELL);
    for (var x = x0; x <= x1; x++) {
      for (var z = z0; z <= z1; z++) {
        var key = x + ':' + z;
        var cell = this.grid.get(key);
        if (!cell) { cell = []; this.grid.set(key, cell); }
        cell.push(c);
      }
    }
  };

  /* Alle Koerper in Reichweite einer Kugel; Ergebnis wird wiederverwendet. */
  World.prototype.query = function (x, y, z, r) {
    var out = this._out;
    out.length = 0;
    this.stamp++;
    var s = this.stamp, marks = this._marks;
    var x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    var z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (var cx = x0; cx <= x1; cx++) {
      for (var cz = z0; cz <= z1; cz++) {
        var cell = this.grid.get(cx + ':' + cz);
        if (!cell) continue;
        for (var i = 0; i < cell.length; i++) {
          var c = cell[i];
          if (marks[c.index] === s || !c.active) continue;
          marks[c.index] = s;
          if (Math.abs(c.y - y) > c.hy + r) continue;
          out.push(c);
        }
      }
    }
    for (var d = 0; d < this.dynamics.length; d++) {
      var dc = this.dynamics[d];
      if (!dc.active) continue;
      var dx = dc.x - x, dy = dc.y - y, dz = dc.z - z;
      if (dx * dx + dy * dy + dz * dz > (dc.radius + r) * (dc.radius + r)) continue;
      if (marks[dc.index] === s) continue;
      marks[dc.index] = s;
      out.push(dc);
    }
    return out;
  };

  /* Groesste Eindringtiefe einer Kugel in einen Quader. */
  var _n = [0, 0, 0];

  function sphereVsBox(c, sx, sy, sz, r, res) {
    var dx = sx - c.x, dy = sy - c.y, dz = sz - c.z;
    var lx = c.cos * dx - c.sin * dz;
    var lz = c.sin * dx + c.cos * dz;
    var ly = dy;

    var qx = lx < -c.hx ? -c.hx : (lx > c.hx ? c.hx : lx);
    var qy = ly < -c.hy ? -c.hy : (ly > c.hy ? c.hy : ly);
    var qz = lz < -c.hz ? -c.hz : (lz > c.hz ? c.hz : lz);

    var ex = lx - qx, ey = ly - qy, ez = lz - qz;
    var d2 = ex * ex + ey * ey + ez * ez;

    var nx, ny, nz, depth;
    if (d2 > 1e-10) {
      var d = Math.sqrt(d2);
      if (d >= r) return false;
      nx = ex / d; ny = ey / d; nz = ez / d;
      depth = r - d;
    } else {
      /* Mittelpunkt steckt im Quader: entlang der flachsten Achse heraus. */
      var px = c.hx - Math.abs(lx), py = c.hy - Math.abs(ly), pz = c.hz - Math.abs(lz);
      if (px <= py && px <= pz) { nx = lx < 0 ? -1 : 1; ny = 0; nz = 0; depth = px + r; }
      else if (py <= pz) { nx = 0; ny = ly < 0 ? -1 : 1; nz = 0; depth = py + r; }
      else { nx = 0; ny = 0; nz = lz < 0 ? -1 : 1; depth = pz + r; }
    }

    res.nx = c.cos * nx + c.sin * nz;
    res.ny = ny;
    res.nz = -c.sin * nx + c.cos * nz;
    res.depth = depth;
    return true;
  }

  var _res = { nx: 0, ny: 0, nz: 0, depth: 0 };

  /*
   * Schiebt die Kapsel aus allen Koerpern heraus und meldet Kontakte.
   * body: {x,y,z, vx,vy,vz, radius, height}
   */
  function resolveCapsule(world, body, contact) {
    contact.grounded = false;
    contact.ground = null;
    contact.groundY = -Infinity;
    contact.wall = null;
    contact.wallNx = 0;
    contact.wallNz = 0;
    contact.hits.length = 0;
    contact.landingImpact = 0;

    var r = body.radius;
    var half = body.height * 0.5;
    var reach = half + r + 0.5;

    for (var iter = 0; iter < 3; iter++) {
      var list = world.query(body.x, body.y, body.z, reach);
      var moved = false;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.noCollide) continue;
        for (var s = 0; s < 3; s++) {
          var sy = body.y + (s === 0 ? -(half - r) : (s === 1 ? 0 : (half - r)));
          if (!sphereVsBox(c, body.x, sy, body.z, r, _res)) continue;

          if (contact.hits.indexOf(c) < 0) contact.hits.push(c);
          if (c.trigger) continue;

          body.x += _res.nx * _res.depth;
          body.y += _res.ny * _res.depth;
          body.z += _res.nz * _res.depth;
          moved = true;

          var vn = body.vx * _res.nx + body.vy * _res.ny + body.vz * _res.nz;
          if (vn < 0) {
            if (_res.ny > 0.55 && body.vy < -6) {
              contact.landingImpact = Math.max(contact.landingImpact, -body.vy);
            }
            body.vx -= _res.nx * vn;
            body.vy -= _res.ny * vn;
            body.vz -= _res.nz * vn;
          }

          if (_res.ny > 0.55) {
            contact.grounded = true;
            var topY = c.y + c.hy;
            if (topY > contact.groundY) { contact.groundY = topY; contact.ground = c; }
          } else if (Math.abs(_res.ny) < 0.5) {
            contact.wall = c;
            contact.wallNx = _res.nx;
            contact.wallNz = _res.nz;
          }
        }
      }
      if (!moved) break;
    }
    return contact;
  }

  function makeContact() {
    return {
      grounded: false, ground: null, groundY: -Infinity,
      wall: null, wallNx: 0, wallNz: 0,
      hits: [], landingImpact: 0
    };
  }

  /* Strahl gegen einen Quader (Slab-Test im lokalen Raum). */
  function rayBox(c, ox, oy, oz, dx, dy, dz, maxT, hit) {
    var rx = ox - c.x, ry = oy - c.y, rz = oz - c.z;
    var lx = c.cos * rx - c.sin * rz;
    var lz = c.sin * rx + c.cos * rz;
    var ldx = c.cos * dx - c.sin * dz;
    var ldz = c.sin * dx + c.cos * dz;

    var t0 = 0, t1 = maxT, axis = -1, sign = 1;
    var o = [lx, ry, lz], d = [ldx, dy, ldz], h = [c.hx, c.hy, c.hz];
    for (var a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-8) {
        if (o[a] < -h[a] || o[a] > h[a]) return false;
        continue;
      }
      var inv = 1 / d[a];
      var tn = (-h[a] - o[a]) * inv;
      var tf = (h[a] - o[a]) * inv;
      var sg = -1;
      if (tn > tf) { var tmp = tn; tn = tf; tf = tmp; sg = 1; }
      if (tn > t0) { t0 = tn; axis = a; sign = sg; }
      if (tf < t1) t1 = tf;
      if (t0 > t1) return false;
    }
    if (axis < 0) return false;
    hit.t = t0;
    var nx = axis === 0 ? sign : 0, ny = axis === 1 ? sign : 0, nz = axis === 2 ? sign : 0;
    hit.nx = c.cos * nx + c.sin * nz;
    hit.ny = ny;
    hit.nz = -c.sin * nx + c.cos * nz;
    hit.col = c;
    return true;
  }

  var _hit = { t: 0, nx: 0, ny: 0, nz: 0, col: null };

  /* Naechster Treffer entlang eines Strahls; null wenn frei. */
  function raycast(world, ox, oy, oz, dx, dy, dz, maxT, out, skip) {
    var best = null;
    var step = CELL * 0.5;
    var travelled = 0;
    world.stamp++;
    var s = world.stamp, marks = world._marks;
    var bestT = maxT;

    while (travelled <= maxT + step) {
      var px = ox + dx * travelled, pz = oz + dz * travelled, py = oy + dy * travelled;
      var cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
      for (var gx = cx - 1; gx <= cx + 1; gx++) {
        for (var gz = cz - 1; gz <= cz + 1; gz++) {
          var cell = world.grid.get(gx + ':' + gz);
          if (!cell) continue;
          for (var i = 0; i < cell.length; i++) {
            var c = cell[i];
            if (marks[c.index] === s || !c.active || c.trigger || c.noRay || c === skip) continue;
            marks[c.index] = s;
            if (rayBox(c, ox, oy, oz, dx, dy, dz, bestT, _hit) && _hit.t < bestT) {
              bestT = _hit.t;
              out.t = _hit.t; out.nx = _hit.nx; out.ny = _hit.ny; out.nz = _hit.nz; out.col = _hit.col;
              best = out;
            }
          }
        }
      }
      travelled += step;
      if (py < -400) break;
    }

    for (var d2 = 0; d2 < world.dynamics.length; d2++) {
      var dc = world.dynamics[d2];
      if (!dc.active || dc.trigger || dc.noRay || dc === skip) continue;
      if (rayBox(dc, ox, oy, oz, dx, dy, dz, bestT, _hit) && _hit.t < bestT) {
        bestT = _hit.t;
        out.t = _hit.t; out.nx = _hit.nx; out.ny = _hit.ny; out.nz = _hit.nz; out.col = _hit.col;
        best = out;
      }
    }
    return best;
  }

  root.MR = root.MR || {};
  root.MR.physics = {
    World: World,
    CELL: CELL,
    resolveCapsule: resolveCapsule,
    makeContact: makeContact,
    raycast: raycast,
    rayBox: rayBox,
    makeHit: function () { return { t: 0, nx: 0, ny: 0, nz: 0, col: null }; }
  };
})(window);
