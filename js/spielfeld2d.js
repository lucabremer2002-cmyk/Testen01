/* spielfeld2d.js - Zweidimensionale Darstellung des laufenden Spiels.
 *
 * Die Simulation selbst rechnet mit Wahrscheinlichkeiten, nicht mit
 * Positionen. Diese Ansicht macht daraus ein sichtbares Spiel: Die
 * Mannschaften verschieben sich als Block mit dem Ball, der Ball wandert
 * zwischen den Spielern, und die Ereignisse der Simulation - Chance, Tor,
 * Karte, Wechsel - lösen die passende Bewegung aus.
 *
 * Platzkoordinaten laufen von 0 bis 100 in der Länge (x) und 0 bis 100 in
 * der Breite (y). Die Heimmannschaft greift nach rechts an.
 */
(function (g) {
  'use strict';

  var TEMPO = { langsam: 0.55, normal: 1, schnell: 1.9 };

  function Feld(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spieler = [];
    this.ball = { x: 50, y: 50, zx: 50, zy: 50, hoehe: 0 };
    this.phase = 'anstoss';
    this.phaseZeit = 0;
    this.besitz = 'heim';
    this.ballbesitzQuote = 50;
    this.seitenTausch = false;
    this.laeuft = false;
    this.tempo = 1;
    this.letzterRahmen = 0;
    this.blitz = null;
    this.amBall = null;
  }

  /* Formationsposition in Platzkoordinaten umrechnen.
     Die Formationen sind hochkant angelegt (Tor unten), hier liegt der
     Platz quer - deshalb werden die Achsen getauscht. */
  Feld.prototype.basisPos = function (slot, heim) {
    var fx = slot[1], fy = slot[2];          /* 0-100 quer, 0-100 hoch */
    var laenge = 100 - fy;                    /* eigenes Tor bei 0 */
    var breite = fx;
    if (heim) return { x: laenge * 0.94 + 3, y: breite };
    return { x: 100 - (laenge * 0.94 + 3), y: 100 - breite };
  };

  Feld.prototype.aufstellen = function (heimSeite, gastSeite, spielerMap, heimFarbe, gastFarbe) {
    var self = this;
    this.spieler = [];
    [[heimSeite, true, heimFarbe], [gastSeite, false, gastFarbe]].forEach(function (paar) {
      var seite = paar[0], heim = paar[1], farbe = paar[2];
      var slots = Match.FORMATIONEN[seite.formation] || Match.FORMATIONEN['4-2-3-1'];
      seite.elf.forEach(function (pid, i) {
        var p = spielerMap[pid];
        if (!p) return;
        var basis = self.basisPos(slots[i] || [p.pos, 50, 50], heim);
        self.spieler.push({
          id: pid, heim: heim, farbe: farbe.fuellung, rand: farbe.rand, text: farbe.text,
          kurz: p.nachname.substr(0, 3),
          torwart: (slots[i] && slots[i][0]) === 'TW',
          tempo: 0.55 + (p.attrs.tempo || 50) / 190,
          bx: basis.x, by: basis.y,
          x: basis.x, y: basis.y,
          zx: basis.x, zy: basis.y
        });
      });
    });
    this.ball.x = 50; this.ball.y = 50; this.ball.zx = 50; this.ball.zy = 50;
    this.phase = 'anstoss'; this.phaseZeit = 0;
  };

  Feld.prototype.ersetzen = function (rausId, reinId, spielerMap) {
    var p = spielerMap[reinId];
    for (var i = 0; i < this.spieler.length; i++) {
      if (this.spieler[i].id === rausId && p) {
        this.spieler[i].id = reinId;
        this.spieler[i].kurz = p.nachname.substr(0, 3);
        this.spieler[i].tempo = 0.55 + (p.attrs.tempo || 50) / 190;
        return;
      }
    }
  };

  Feld.prototype.halbzeit = function () {
    this.seitenTausch = !this.seitenTausch;
    var self = this;
    this.spieler.forEach(function (s) {
      s.bx = 100 - s.bx; s.by = 100 - s.by;
      s.x = s.bx; s.y = s.by; s.zx = s.bx; s.zy = s.by;
    });
    this.phase = 'anstoss'; this.phaseZeit = 0;
    this.ball.x = 50; this.ball.y = 50;
  };

  /* Richtung, in die eine Mannschaft angreift: 1 = nach rechts. */
  Feld.prototype.richtung = function (heim) {
    var r = heim ? 1 : -1;
    return this.seitenTausch ? -r : r;
  };

  Feld.prototype.torX = function (heim) {
    /* Das Tor, auf das diese Mannschaft spielt. */
    return this.richtung(heim) > 0 ? 98 : 2;
  };

  Feld.prototype.ereignis = function (e) {
    var heim = e.heim;
    this.besitz = heim ? 'heim' : 'gast';
    if (e.typ === 'chance') { this.phase = 'abschluss'; this.phaseZeit = 0; this.chanceTor = false; }
    else if (e.typ === 'tor') { this.phase = 'abschluss'; this.phaseZeit = 0; this.chanceTor = true; }
    else if (e.typ === 'gelb' || e.typ === 'rot' || e.typ === 'gelbrot') {
      this.phase = 'unterbrechung'; this.phaseZeit = 0;
      this.blitz = { farbe: e.typ === 'gelb' ? '#f2c94c' : '#e0524b', zeit: 0.9 };
    } else if (e.typ === 'anpfiff') { this.phase = 'anstoss'; this.phaseZeit = 0; }
  };

  Feld.prototype.setBallbesitz = function (prozent) { this.ballbesitzQuote = prozent; };

  /* --- Bewegungsmodell --- */

  Feld.prototype.aktualisieren = function (dt) {
    var self = this;
    this.phaseZeit += dt;
    if (this.blitz) {
      this.blitz.zeit -= dt;
      if (this.blitz.zeit <= 0) this.blitz = null;
    }

    var angreifer = this.besitz === 'heim';
    var richt = this.richtung(angreifer);

    switch (this.phase) {
      case 'anstoss':
        this.ball.zx = 50; this.ball.zy = 50;
        if (this.phaseZeit > 1.1) { this.phase = 'aufbau'; this.phaseZeit = 0; }
        break;

      case 'unterbrechung':
        if (this.phaseZeit > 1.3) { this.phase = 'aufbau'; this.phaseZeit = 0; }
        break;

      case 'aufbau':
        /* Der Ball wandert zwischen den Spielern der ballführenden Elf. */
        if (this.phaseZeit > 0.85 || this.nahAmBall()) {
          this.phaseZeit = 0;
          var eigene = this.spieler.filter(function (s) {
            return s.heim === angreifer && !s.torwart;
          });
          if (eigene.length) {
            /* Bevorzugt nach vorne spielen, aber nicht immer. */
            var ziel = eigene[Math.floor(Math.random() * eigene.length)];
            for (var v = 0; v < 2; v++) {
              var alt = eigene[Math.floor(Math.random() * eigene.length)];
              if ((alt.x - ziel.x) * richt > 0) ziel = alt;
            }
            this.ball.zx = ziel.x; this.ball.zy = ziel.y;
            this.amBall = ziel.id;
          }
          /* Gelegentlich den Ballbesitz wechseln – gemäß der Statistik. */
          if (Math.random() < 0.22) {
            var quote = this.ballbesitzQuote / 100;
            this.besitz = Math.random() < quote ? 'heim' : 'gast';
          }
        }
        break;

      case 'abschluss':
        /* Ein Angreifer zieht zum Tor, dann folgt der Schuss. */
        if (this.phaseZeit < 0.75) {
          var vorne = this.spieler.filter(function (s) { return s.heim === angreifer && !s.torwart; })
            .sort(function (a, b) { return (b.x - a.x) * richt; })[0];
          if (vorne) {
            this.ball.zx = vorne.x + richt * 6;
            this.ball.zy = vorne.y;
            this.amBall = vorne.id;
          }
        } else if (this.phaseZeit < 1.5) {
          this.ball.zx = this.torX(angreifer);
          this.ball.zy = this.chanceTor ? 42 + Math.random() * 16 : (Math.random() < 0.5 ? 28 : 72);
          this.ball.hoehe = 1;
        } else {
          this.phase = this.chanceTor ? 'jubel' : 'aufbau';
          this.phaseZeit = 0;
          this.ball.hoehe = 0;
          if (!this.chanceTor) this.besitz = angreifer ? 'gast' : 'heim';
        }
        break;

      case 'jubel':
        if (this.phaseZeit > 2.2) {
          this.phase = 'anstoss'; this.phaseZeit = 0;
          this.besitz = angreifer ? 'gast' : 'heim';
          this.ball.x = 50; this.ball.y = 50;
        }
        break;
    }

    /* Ball zum Ziel bewegen */
    var bs = this.phase === 'abschluss' && this.phaseZeit > 0.75 ? 150 : 46;
    this.ball.x = naehern(this.ball.x, this.ball.zx, bs * dt);
    this.ball.y = naehern(this.ball.y, this.ball.zy, bs * dt);

    /* Mannschaftsblock verschiebt sich mit dem Ball */
    this.spieler.forEach(function (s) {
      if (self.phase === 'jubel' && s.heim === angreifer && !s.torwart) {
        /* Torjubel: alle laufen zum Schützen. */
        s.zx = self.ball.x + (Math.random() - 0.5) * 14;
        s.zy = self.ball.y + (Math.random() - 0.5) * 14;
      } else if (s.torwart) {
        var eigenesTor = self.richtung(s.heim) > 0 ? 3 : 97;
        s.zx = eigenesTor + (self.ball.x - 50) * 0.05;
        s.zy = 50 + (self.ball.y - 50) * 0.28;
      } else {
        var vor = self.richtung(s.heim);
        var ballVorne = (self.ball.x - 50) * vor / 50;   /* -1 hinten, +1 vorne */
        var schub = s.heim === angreifer ? 13 : 10;
        s.zx = s.bx + vor * ballVorne * schub;
        s.zy = s.by + (self.ball.y - 50) * 0.24;
        /* Der ballnächste Spieler geht zum Ball. */
        if (s.id === self.amBall) { s.zx = self.ball.zx; s.zy = self.ball.zy; }
        s.zx += (Math.random() - 0.5) * 1.2;
        s.zy += (Math.random() - 0.5) * 1.2;
      }
      s.zx = Math.max(1.5, Math.min(98.5, s.zx));
      s.zy = Math.max(3, Math.min(97, s.zy));
      var v = s.tempo * 17 * dt;
      s.x = naehern(s.x, s.zx, v);
      s.y = naehern(s.y, s.zy, v * 1.1);
    });

    /* Spieler auseinanderhalten - sonst stehen Gegenspieler deckungsgleich
       übereinander und das Bild wirkt wie ein Fehler. */
    var mind = 4.2;
    for (var i = 0; i < this.spieler.length; i++) {
      for (var j = i + 1; j < this.spieler.length; j++) {
        var a = this.spieler[i], b2 = this.spieler[j];
        var dx = b2.x - a.x, dy = b2.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d >= mind || d === 0) continue;
        var schub = (mind - d) / 2;
        var ux = dx / d, uy = dy / d;
        a.x -= ux * schub; a.y -= uy * schub;
        b2.x += ux * schub; b2.y += uy * schub;
      }
    }
    this.spieler.forEach(function (s) {
      s.x = Math.max(1.5, Math.min(98.5, s.x));
      s.y = Math.max(3, Math.min(97, s.y));
    });
  };

  /* Hat der Ball sein Ziel erreicht? Dann wird neu gespielt. */
  Feld.prototype.nahAmBall = function () {
    var dx = this.ball.x - this.ball.zx, dy = this.ball.y - this.ball.zy;
    return dx * dx + dy * dy < 2.5;
  };

  function naehern(ist, ziel, schritt) {
    var d = ziel - ist;
    if (Math.abs(d) <= schritt) return ziel;
    return ist + Math.sign(d) * schritt;
  }

  /* --- Zeichnen --- */

  Feld.prototype.zeichnen = function () {
    var c = this.ctx, cv = this.canvas;
    var dpr = window.devicePixelRatio || 1;
    var b = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(b * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(b * dpr);
      cv.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, b, h);

    var rand = 8;
    var pb = b - rand * 2, ph = h - rand * 2;
    function X(x) { return rand + x / 100 * pb; }
    function Y(y) { return rand + y / 100 * ph; }

    /* Rasen mit Streifen */
    c.fillStyle = '#4f9e70';
    c.fillRect(0, 0, b, h);
    c.fillStyle = '#4b9a6c';
    for (var i = 0; i < 10; i += 2) {
      c.fillRect(rand + i * (pb / 10), rand, pb / 10, ph);
    }

    /* Linien */
    c.strokeStyle = 'rgba(255,255,255,.8)';
    c.lineWidth = 1.6;
    c.strokeRect(X(0), Y(0), pb, ph);
    c.beginPath(); c.moveTo(X(50), Y(0)); c.lineTo(X(50), Y(100)); c.stroke();
    c.beginPath(); c.arc(X(50), Y(50), pb * 0.09, 0, Math.PI * 2); c.stroke();
    c.strokeRect(X(0), Y(21), pb * 0.16, ph * 0.58);
    c.strokeRect(X(84), Y(21), pb * 0.16, ph * 0.58);
    c.strokeRect(X(0), Y(36), pb * 0.055, ph * 0.28);
    c.strokeRect(X(94.5), Y(36), pb * 0.055, ph * 0.28);
    /* Tore */
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,255,255,.95)';
    c.beginPath(); c.moveTo(X(0), Y(42)); c.lineTo(X(0), Y(58)); c.stroke();
    c.beginPath(); c.moveTo(X(100), Y(42)); c.lineTo(X(100), Y(58)); c.stroke();

    /* Spieler */
    var r = Math.max(6, Math.min(11, pb / 62));
    this.spieler.forEach(function (s) {
      var px = X(s.x), py = Y(s.y);
      c.beginPath();
      c.ellipse(px, py + r * 0.75, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,.16)'; c.fill();
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2);
      c.fillStyle = s.farbe; c.fill();
      c.lineWidth = 1.6; c.strokeStyle = s.rand; c.stroke();
      if (r >= 8) {
        c.fillStyle = s.text;
        c.font = '600 ' + Math.round(r * 0.82) + 'px -apple-system, system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(s.kurz, px, py + 0.5);
      }
    });

    /* Ball */
    var bx = X(this.ball.x), by = Y(this.ball.y);
    var br = Math.max(3.5, r * 0.42);
    c.beginPath();
    c.ellipse(bx, by + br * 1.4, br * 0.9, br * 0.4, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fill();
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2);
    c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();

    /* Kartenblitz */
    if (this.blitz) {
      c.fillStyle = this.blitz.farbe;
      c.globalAlpha = Math.min(0.5, this.blitz.zeit * 0.5);
      c.fillRect(0, 0, b, h);
      c.globalAlpha = 1;
    }
  };

  Feld.prototype.start = function (tempo) {
    var self = this;
    this.tempo = TEMPO[tempo] || 1;
    if (this.laeuft) return;
    this.laeuft = true;
    this.letzterRahmen = performance.now();
    function rahmen(jetzt) {
      if (!self.laeuft) return;
      var dt = Math.min(0.05, (jetzt - self.letzterRahmen) / 1000) * self.tempo;
      self.letzterRahmen = jetzt;
      self.aktualisieren(dt);
      self.zeichnen();
      self.raf = requestAnimationFrame(rahmen);
    }
    this.raf = requestAnimationFrame(rahmen);
  };

  Feld.prototype.setTempo = function (tempo) { this.tempo = TEMPO[tempo] || 1; };

  Feld.prototype.stop = function () {
    this.laeuft = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  };

  g.Feld2D = {
    erzeugen: function (canvas) { return new Feld(canvas); },
    TEMPO: TEMPO
  };
})(typeof window !== 'undefined' ? window : globalThis);
