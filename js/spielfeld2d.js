/* spielfeld2d.js - Zweidimensionale Darstellung des laufenden Spiels.
 *
 * Die Simulation rechnet mit Wahrscheinlichkeiten, nicht mit Positionen.
 * Diese Ansicht macht daraus sichtbares Fußballspiel: Ein Spieler führt den
 * Ball, dribbelt kurz an und sucht dann einen Mitspieler. Der Pass fliegt
 * sichtbar - flach und schnell über kurze Wege, als hoher Ball über weite -
 * und kann vom Gegner abgefangen werden. Die Ereignisse der Simulation
 * (Chance, Tor, Karte) lösen die passende Situation aus.
 *
 * Platzkoordinaten: 0-100 in der Länge (x), 0-100 in der Breite (y).
 */
(function (g) {
  'use strict';

  var TEMPO = { langsam: 0.55, normal: 1, schnell: 1.9 };

  function Feld(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.spieler = [];
    this.ball = { x: 50, y: 50, z: 0 };
    this.traeger = null;      /* Spieler am Ball */
    this.flug = null;         /* laufender Pass oder Schuss */
    this.spur = [];           /* verblassende Passlinien */
    this.phase = 'anstoss';
    this.phaseZeit = 0;
    this.haltezeit = 0;
    this.besitz = 'heim';
    this.ballbesitzQuote = 50;
    this.seitenTausch = false;
    this.laeuft = false;
    this.tempo = 1;
    this.blitz = null;
    this.chanceTor = false;
  }

  /* Formationsposition in Platzkoordinaten. Die Formationen sind hochkant
     angelegt (eigenes Tor unten), der Platz liegt quer. */
  Feld.prototype.basisPos = function (slot, heim) {
    var laenge = 100 - slot[2];
    var breite = slot[1];
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
        var slot = slots[i] || [p.pos, 50, 50];
        var basis = self.basisPos(slot, heim);
        self.spieler.push({
          id: pid, heim: heim,
          farbe: farbe.fuellung, rand: farbe.rand, text: farbe.text,
          nummer: p.nummer || (i + 1),
          name: p.nachname,
          torwart: slot[0] === 'TW',
          tempo: 0.6 + (p.attrs.tempo || 50) / 200,
          technik: (p.attrs.technik || 50) / 100,
          uebersicht: (p.attrs.uebersicht || 50) / 100,
          bx: basis.x, by: basis.y, x: basis.x, y: basis.y, zx: basis.x, zy: basis.y
        });
      });
    });
    this.ball = { x: 50, y: 50, z: 0 };
    this.traeger = this.spieler.filter(function (s) { return s.heim && !s.torwart; })[5] || null;
    this.flug = null; this.spur = [];
    this.phase = 'anstoss'; this.phaseZeit = 0;
  };

  Feld.prototype.ersetzen = function (rausId, reinId, spielerMap) {
    var p = spielerMap[reinId];
    for (var i = 0; i < this.spieler.length; i++) {
      if (this.spieler[i].id === rausId && p) {
        var s = this.spieler[i];
        s.id = reinId; s.name = p.nachname; s.nummer = p.nummer || s.nummer;
        s.tempo = 0.6 + (p.attrs.tempo || 50) / 200;
        s.technik = (p.attrs.technik || 50) / 100;
        s.uebersicht = (p.attrs.uebersicht || 50) / 100;
        if (this.traeger === this.spieler[i]) this.traeger = s;
        return;
      }
    }
  };

  Feld.prototype.halbzeit = function () {
    this.seitenTausch = !this.seitenTausch;
    this.spieler.forEach(function (s) {
      s.bx = 100 - s.bx; s.by = 100 - s.by;
      s.x = s.bx; s.y = s.by; s.zx = s.bx; s.zy = s.by;
    });
    this.phase = 'anstoss'; this.phaseZeit = 0;
    this.ball = { x: 50, y: 50, z: 0 };
    this.flug = null; this.spur = [];
    this.traeger = null;
  };

  Feld.prototype.richtung = function (heim) {
    var r = heim ? 1 : -1;
    return this.seitenTausch ? -r : r;
  };
  Feld.prototype.torX = function (heim) { return this.richtung(heim) > 0 ? 99 : 1; };

  Feld.prototype.ereignis = function (e) {
    this.besitz = e.heim ? 'heim' : 'gast';
    if (e.typ === 'chance' || e.typ === 'tor') {
      this.phase = 'angriff'; this.phaseZeit = 0;
      this.chanceTor = e.typ === 'tor';
      /* Der Ball geht sofort zu einem Angreifer der Mannschaft. */
      var stuermer = this.spieler.filter(function (s) { return s.heim === e.heim && !s.torwart; })
        .sort(function (a, b) { return (b.x - a.x) * (e.heim ? 1 : -1); })[0];
      if (stuermer) this.passSpielen(stuermer, 'steil');
    } else if (e.typ === 'gelb' || e.typ === 'rot' || e.typ === 'gelbrot') {
      this.phase = 'unterbrechung'; this.phaseZeit = 0;
      this.blitz = { farbe: e.typ === 'gelb' ? '#f2c94c' : '#e0524b', zeit: 0.85 };
    } else if (e.typ === 'anpfiff') {
      this.phase = 'anstoss'; this.phaseZeit = 0;
    }
  };

  Feld.prototype.setBallbesitz = function (prozent) { this.ballbesitzQuote = prozent; };

  /* --- Passspiel --- */

  function abstand(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Wie frei steht ein Spieler? Abstand zum nächsten Gegenspieler. */
  Feld.prototype.freiheit = function (s) {
    var min = 99;
    for (var i = 0; i < this.spieler.length; i++) {
      var g2 = this.spieler[i];
      if (g2.heim === s.heim) continue;
      var d = abstand(s, g2);
      if (d < min) min = d;
    }
    return min;
  };

  /* Sucht einen Mitspieler und spielt ihn an. */
  Feld.prototype.passZielWaehlen = function (von, art) {
    var self = this;
    var vor = this.richtung(von.heim);
    var kandidaten = [];
    this.spieler.forEach(function (s) {
      if (s.heim !== von.heim || s === von) return;
      if (s.torwart && art === 'steil') return;
      var d = abstand(von, s);
      if (d < 6 || d > 62) return;
      var fortschritt = (s.x - von.x) * vor;      /* nach vorn ist besser */
      var frei = Math.min(18, self.freiheit(s));
      var wert = frei * 1.4 + fortschritt * (art === 'steil' ? 1.9 : 0.8) - d * 0.22;
      if (art === 'steil' && fortschritt < 0) wert -= 30;
      kandidaten.push({ s: s, wert: wert + Math.random() * 12 });
    });
    if (!kandidaten.length) return null;
    kandidaten.sort(function (a, b) { return b.wert - a.wert; });
    /* Nicht immer die beste Option - sonst wirkt es mechanisch. */
    var index = Math.random() < (0.55 + von.uebersicht * 0.3) ? 0 : Math.min(kandidaten.length - 1, 1);
    return kandidaten[index].s;
  };

  Feld.prototype.passSpielen = function (von, art) {
    var ziel = this.passZielWaehlen(von, art);
    if (!ziel) { this.haltezeit = 0.4; return; }
    var d = abstand(von, ziel);
    var typ = d > 38 ? 'lang' : (d > 20 ? 'mittel' : 'kurz');

    /* Abfangen: je enger der Empfänger gedeckt ist, desto eher. */
    var frei = this.freiheit(ziel);
    var risiko = Util.clamp(0.42 - frei * 0.035 - von.technik * 0.16, 0.02, 0.4);
    if (typ === 'lang') risiko += 0.1;
    var abgefangen = Math.random() < risiko;
    var empfaenger = ziel;
    if (abgefangen) {
      var gegner = null, nah = 99;
      for (var i = 0; i < this.spieler.length; i++) {
        var s = this.spieler[i];
        if (s.heim === von.heim) continue;
        var dd = abstand(s, ziel);
        if (dd < nah) { nah = dd; gegner = s; }
      }
      if (gegner) empfaenger = gegner; else abgefangen = false;
    }

    this.flug = {
      vonX: von.x, vonY: von.y, t: 0,
      dauer: Util.clamp(d / (typ === 'lang' ? 62 : 78), 0.22, 0.95),
      hoehe: typ === 'lang' ? 3.4 : (typ === 'mittel' ? 1.1 : 0),
      ziel: empfaenger, abgefangen: abgefangen, art: 'pass'
    };
    this.spur.push({ x1: von.x, y1: von.y, x2: empfaenger.x, y2: empfaenger.y, zeit: 0.85 });
    if (this.spur.length > 6) this.spur.shift();
    this.traeger = null;
  };

  Feld.prototype.schussSpielen = function (von) {
    var torX = this.torX(von.heim);
    var torY = this.chanceTor ? 46 + Math.random() * 8 : (Math.random() < 0.5 ? 34 : 66);
    this.flug = {
      vonX: von.x, vonY: von.y, t: 0, dauer: 0.42,
      hoehe: 2.2, zielPunkt: { x: torX, y: torY },
      art: 'schuss', tor: this.chanceTor
    };
    this.spur.push({ x1: von.x, y1: von.y, x2: torX, y2: torY, zeit: 1.1, schuss: true });
    if (this.spur.length > 6) this.spur.shift();
    this.traeger = null;
  };

  /* --- Ablauf --- */

  Feld.prototype.aktualisieren = function (dt) {
    var self = this;
    this.phaseZeit += dt;
    if (this.blitz) {
      this.blitz.zeit -= dt;
      if (this.blitz.zeit <= 0) this.blitz = null;
    }
    this.spur = this.spur.filter(function (l) { l.zeit -= dt; return l.zeit > 0; });

    var angreifer = this.besitz === 'heim';
    var vorRichtung = this.richtung(angreifer);

    /* Ball in der Luft */
    if (this.flug) {
      var f = this.flug;
      f.t += dt;
      var q = Math.min(1, f.t / f.dauer);
      var zx = f.zielPunkt ? f.zielPunkt.x : f.ziel.x;
      var zy = f.zielPunkt ? f.zielPunkt.y : f.ziel.y;
      this.ball.x = f.vonX + (zx - f.vonX) * q;
      this.ball.y = f.vonY + (zy - f.vonY) * q;
      this.ball.z = f.hoehe * Math.sin(Math.PI * q);
      if (q >= 1) {
        this.ball.z = 0;
        if (f.art === 'schuss') {
          if (f.tor) { this.phase = 'jubel'; this.phaseZeit = 0; }
          else {
            this.besitz = angreifer ? 'gast' : 'heim';
            this.phase = 'aufbau'; this.phaseZeit = 0;
            var tw = this.spieler.filter(function (s) { return s.heim !== angreifer && s.torwart; })[0];
            this.traeger = tw || null;
            this.haltezeit = 0.5;
          }
        } else {
          this.traeger = f.ziel;
          if (f.abgefangen) {
            this.besitz = f.ziel.heim ? 'heim' : 'gast';
            this.phase = 'aufbau'; this.phaseZeit = 0;
          }
          this.haltezeit = 0.18 + Math.random() * 0.3;
        }
        this.flug = null;
      }
    } else if (this.traeger) {
      /* Ball am Fuß, leicht in Laufrichtung versetzt */
      var t2 = this.traeger;
      this.ball.x = t2.x + this.richtung(t2.heim) * 1.6;
      this.ball.y = t2.y;
      this.ball.z = 0;
      this.haltezeit -= dt;
      if (this.haltezeit <= 0) {
        var imStrafraum = (this.torX(t2.heim) > 50 ? t2.x > 82 : t2.x < 18);
        if (this.phase === 'angriff' && imStrafraum) {
          this.schussSpielen(t2);
        } else if (this.phase === 'angriff') {
          this.passSpielen(t2, 'steil');
        } else {
          this.passSpielen(t2, 'aufbau');
          /* Gelegentlich kippt der Ballbesitz durch einen Zweikampf. */
          if (Math.random() < 0.14) {
            var quote = this.ballbesitzQuote / 100;
            this.besitz = Math.random() < quote ? 'heim' : 'gast';
          }
        }
      }
    }

    /* Phasen ohne Ballführung */
    if (this.phase === 'anstoss') {
      if (this.phaseZeit > 1.0) {
        this.phase = 'aufbau'; this.phaseZeit = 0;
        var mitte = this.spieler.filter(function (s) { return s.heim === angreifer && !s.torwart; })
          .sort(function (a, b) { return abstand(a, { x: 50, y: 50 }) - abstand(b, { x: 50, y: 50 }); })[0];
        this.traeger = mitte || null;
        this.haltezeit = 0.3;
      }
    } else if (this.phase === 'unterbrechung') {
      if (this.phaseZeit > 1.2) { this.phase = 'aufbau'; this.phaseZeit = 0; this.haltezeit = 0.3; }
    } else if (this.phase === 'jubel') {
      if (this.phaseZeit > 2.3) {
        this.phase = 'anstoss'; this.phaseZeit = 0;
        this.besitz = angreifer ? 'gast' : 'heim';
        this.ball = { x: 50, y: 50, z: 0 };
        this.traeger = null;
      }
    } else if (this.phase === 'angriff' && this.phaseZeit > 4.5) {
      this.phase = 'aufbau'; this.phaseZeit = 0;
    }

    /* Laufwege */
    this.spieler.forEach(function (s) {
      if (self.phase === 'jubel' && s.heim === angreifer && !s.torwart) {
        s.zx = self.ball.x + (Math.random() - 0.5) * 16;
        s.zy = self.ball.y + (Math.random() - 0.5) * 16;
      } else if (s.torwart) {
        var eigenesTor = self.richtung(s.heim) > 0 ? 3 : 97;
        s.zx = eigenesTor + (self.ball.x - 50) * 0.06;
        s.zy = 50 + (self.ball.y - 50) * 0.3;
      } else {
        var vor = self.richtung(s.heim);
        var ballVorne = (self.ball.x - 50) * vor / 50;
        var schub = s.heim === angreifer ? 14 : 11;
        s.zx = s.bx + vor * ballVorne * schub;
        s.zy = s.by + (self.ball.y - 50) * 0.26;
        if (s === self.traeger) { s.zx = s.bx + vor * ballVorne * schub; }
        /* Anspielpartner läuft dem Ball entgegen, Gegner attackiert. */
        if (self.flug && self.flug.ziel === s) { s.zx = self.ball.x; s.zy = self.ball.y; }
        else if (s.heim !== angreifer && abstand(s, self.ball) < 16) {
          s.zx = self.ball.x - vor * 1.5; s.zy = self.ball.y;
        }
        s.zx += (Math.random() - 0.5) * 1.1;
        s.zy += (Math.random() - 0.5) * 1.1;
      }
      s.zx = Math.max(1.5, Math.min(98.5, s.zx));
      s.zy = Math.max(3, Math.min(97, s.zy));
      var v = s.tempo * 18 * dt;
      s.x = naehern(s.x, s.zx, v);
      s.y = naehern(s.y, s.zy, v * 1.1);
    });

    /* Mindestabstand, damit niemand deckungsgleich steht */
    var mind = 4.2;
    for (var i = 0; i < this.spieler.length; i++) {
      for (var j = i + 1; j < this.spieler.length; j++) {
        var a = this.spieler[i], b2 = this.spieler[j];
        var dx = b2.x - a.x, dy = b2.y - a.y;
        var d2 = Math.sqrt(dx * dx + dy * dy);
        if (d2 >= mind || d2 === 0) continue;
        var schub2 = (mind - d2) / 2, ux = dx / d2, uy = dy / d2;
        a.x -= ux * schub2; a.y -= uy * schub2;
        b2.x += ux * schub2; b2.y += uy * schub2;
      }
    }
    this.spieler.forEach(function (s) {
      s.x = Math.max(1.5, Math.min(98.5, s.x));
      s.y = Math.max(3, Math.min(97, s.y));
    });
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
    if (!b || !h) return;
    if (cv.width !== Math.round(b * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(b * dpr);
      cv.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, b, h);

    var rand = 9;
    var pb = b - rand * 2, ph = h - rand * 2;
    function X(x) { return rand + x / 100 * pb; }
    function Y(y) { return rand + y / 100 * ph; }

    c.fillStyle = '#4f9e70';
    c.fillRect(0, 0, b, h);
    c.fillStyle = '#4b9a6c';
    for (var i = 0; i < 10; i += 2) c.fillRect(rand + i * (pb / 10), rand, pb / 10, ph);

    c.strokeStyle = 'rgba(255,255,255,.78)';
    c.lineWidth = 1.6;
    c.strokeRect(X(0), Y(0), pb, ph);
    c.beginPath(); c.moveTo(X(50), Y(0)); c.lineTo(X(50), Y(100)); c.stroke();
    c.beginPath(); c.arc(X(50), Y(50), pb * 0.088, 0, Math.PI * 2); c.stroke();
    c.strokeRect(X(0), Y(21), pb * 0.16, ph * 0.58);
    c.strokeRect(X(84), Y(21), pb * 0.16, ph * 0.58);
    c.strokeRect(X(0), Y(36), pb * 0.055, ph * 0.28);
    c.strokeRect(X(94.5), Y(36), pb * 0.055, ph * 0.28);
    c.lineWidth = 3.2; c.strokeStyle = 'rgba(255,255,255,.95)';
    c.beginPath(); c.moveTo(X(0), Y(43)); c.lineTo(X(0), Y(57)); c.stroke();
    c.beginPath(); c.moveTo(X(100), Y(43)); c.lineTo(X(100), Y(57)); c.stroke();

    /* Passlinien - sie machen das Spiel lesbar */
    this.spur.forEach(function (l) {
      c.save();
      c.globalAlpha = Math.min(0.6, l.zeit * 0.7);
      c.strokeStyle = l.schuss ? '#ffd45e' : '#ffffff';
      c.lineWidth = l.schuss ? 2.4 : 1.8;
      c.setLineDash(l.schuss ? [] : [5, 4]);
      c.beginPath(); c.moveTo(X(l.x1), Y(l.y1)); c.lineTo(X(l.x2), Y(l.y2)); c.stroke();
      c.restore();
    });

    var r = Math.max(6.5, Math.min(12, pb / 58));
    var self = this;
    this.spieler.forEach(function (s) {
      var px = X(s.x), py = Y(s.y);
      c.beginPath();
      c.ellipse(px, py + r * 0.78, r * 0.85, r * 0.34, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,.17)'; c.fill();
      if (s === self.traeger) {
        c.beginPath(); c.arc(px, py, r + 3.2, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.stroke();
      }
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2);
      c.fillStyle = s.farbe; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = s.rand; c.stroke();
      c.fillStyle = s.text;
      c.font = '600 ' + Math.round(r * 0.95) + 'px -apple-system, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(s.nummer), px, py + 0.5);
    });

    /* Ball mit Schatten - die Höhe macht lange Bälle sichtbar */
    var bx = X(this.ball.x), by = Y(this.ball.y);
    var hoehe = this.ball.z * (ph / 100) * 2.2;
    var br = Math.max(3.2, r * 0.4);
    c.beginPath();
    c.ellipse(bx, by + br * 1.3, br * (0.9 + this.ball.z * 0.05), br * 0.38, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,.24)'; c.fill();
    c.beginPath(); c.arc(bx, by - hoehe, br, 0, Math.PI * 2);
    c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();

    if (this.blitz) {
      c.fillStyle = this.blitz.farbe;
      c.globalAlpha = Math.min(0.45, this.blitz.zeit * 0.5);
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
