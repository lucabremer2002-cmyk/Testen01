/* ---------------------------------------------------------------------
   Blackhaven bei Nacht - der bewegte Hintergrund des Hauptmenues.

   Drei Ebenen Haeuser mit Parallaxe, Fenster, die einzeln an- und
   ausgehen, Neonschilder, Regen und Autolichter auf der Strasse. Alles
   prozedural: es gibt kein Bild, nur einen Seed.

   Leistung: ein einziges Canvas, die statischen Ebenen werden einmal
   auf Zwischenbilder gemalt und danach nur noch verschoben. Bei
   "reduzierte Bewegung" faellt die Animation weg, das Bild bleibt.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  function Skyline(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.rng = new CE.util.Rng(20270301);
    this.t = 0;
    this.raf = 0;
    this.still = false;
    this.layers = [];
    this.drops = [];
    this.cars = [];
    this.resize();
    var self = this;
    this._onResize = function () { self.resize(); };
    root.addEventListener('resize', this._onResize);
  }

  Skyline.prototype.resize = function () {
    var dpr = Math.min(root.devicePixelRatio || 1, 1.75);
    this.w = this.c.clientWidth || root.innerWidth;
    this.h = this.c.clientHeight || root.innerHeight;
    this.c.width = Math.round(this.w * dpr);
    this.c.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.build();
  };

  /* Eine Ebene Haeuser auf ein eigenes Canvas malen. */
  Skyline.prototype.layer = function (cfg) {
    var rng = this.rng;
    var w = Math.ceil(this.w * 1.25), h = this.h;
    var off = document.createElement('canvas');
    var dpr = 1;
    off.width = w; off.height = h;
    var g = off.getContext('2d');

    var windows = [];
    var x = -40;
    while (x < w + 40) {
      var bw = rng.int(cfg.minW, cfg.maxW);
      var bh = rng.int(cfg.minH, cfg.maxH);
      var y = h - bh;

      g.fillStyle = cfg.body;
      g.fillRect(x, y, bw, bh);

      /* Dachaufbauten geben der Silhouette Charakter. */
      if (rng.chance(0.4)) {
        var aw = Math.max(4, bw * rng.range(0.12, 0.3));
        g.fillRect(x + bw * 0.5 - aw / 2, y - rng.int(6, 22), aw, 24);
      }
      if (rng.chance(0.22)) {
        /* Antenne mit rotem Warnlicht */
        var ax = Math.round(x + bw * rng.range(0.3, 0.7));
        var ah = rng.int(14, 40);
        g.strokeStyle = cfg.body; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(ax, y); g.lineTo(ax, y - ah); g.stroke();
        windows.push({ x: ax, y: y - ah, w: 2, h: 2, beacon: true });
      }

      /* Fenster */
      var pad = Math.max(3, bw * 0.10);
      var cw = cfg.win, ch = cfg.win * 1.4, gap = cfg.gap;
      for (var wy = y + pad + 4; wy < h - pad; wy += ch + gap) {
        for (var wx = x + pad; wx < x + bw - pad - cw; wx += cw + gap) {
          if (rng.chance(cfg.lit)) {
            windows.push({ x: wx, y: wy, w: cw, h: ch, p: rng.next(), s: rng.range(0.4, 1) });
          }
        }
      }
      x += bw + rng.int(1, cfg.gapB);
    }
    return { canvas: off, windows: windows, speed: cfg.speed, alpha: cfg.alpha, glow: cfg.glow, w: w };
  };

  Skyline.prototype.build = function () {
    this.rng = new CE.util.Rng(20270301);
    this.layers = [
      /* Luftperspektive: was weit weg ist, steht heller im Dunst, was
         nah ist, fast schwarz. Vorher waren alle drei Ebenen praktisch
         gleich dunkel wie der Himmel - dann liest man keine Silhouette
         mehr, nur ein Feld aus Lichtpunkten. */
      this.layer({ body: '#1b2536', minW: 70, maxW: 150, minH: this.h * 0.34, maxH: this.h * 0.66,
        win: 3, gap: 5, gapB: 12, lit: 0.20, speed: 0.0035, alpha: .85, glow: '#2a3a55' }),
      this.layer({ body: '#101725', minW: 55, maxW: 115, minH: this.h * 0.26, maxH: this.h * 0.52,
        win: 3, gap: 4, gapB: 8, lit: 0.30, speed: 0.0075, alpha: 1, glow: '#3a4a6a' }),
      this.layer({ body: '#06080d', minW: 40, maxW: 90, minH: this.h * 0.16, maxH: this.h * 0.36,
        win: 2.5, gap: 4, gapB: 6, lit: 0.34, speed: 0.014, alpha: 1, glow: '#4a5a7a' })
    ];

    /* Regen */
    this.drops = [];
    var n = Math.round(this.w / 9);
    for (var i = 0; i < n; i++) {
      this.drops.push({
        x: this.rng.range(-60, this.w + 60), y: this.rng.range(0, this.h),
        l: this.rng.range(9, 26), v: this.rng.range(340, 700), a: this.rng.range(0.05, 0.2)
      });
    }

    /* Autolichter auf der Strassenebene */
    this.cars = [];
    for (i = 0; i < 7; i++) {
      this.cars.push({
        x: this.rng.range(-200, this.w), y: this.h * this.rng.range(0.90, 0.985),
        v: this.rng.range(55, 160) * (this.rng.chance(0.5) ? 1 : -1),
        w: this.rng.range(24, 60), warm: this.rng.chance(0.55)
      });
    }

    /* Neonschilder */
    this.neon = [];
    var words = ['BAR', 'HOTEL', 'CLUB', 'OFFEN', 'KREDITE', 'PFAND', '24H'];
    for (i = 0; i < 5; i++) {
      this.neon.push({
        x: this.rng.range(this.w * 0.08, this.w * 0.95),
        y: this.rng.range(this.h * 0.45, this.h * 0.88),
        text: words[this.rng.int(0, words.length - 1)],
        hue: this.rng.chance(0.5) ? '#ff3b5c' : (this.rng.chance(0.5) ? '#4bd6e8' : '#d4af5a'),
        p: this.rng.next(), flick: this.rng.chance(0.45), size: this.rng.range(9, 15)
      });
    }
  };

  Skyline.prototype.start = function (still) {
    this.still = !!still;
    if (this.raf) return;
    var self = this, last = 0;
    function frame(now) {
      self.raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (!self.still) self.t += dt;
      self.draw(dt);
      if (self.still) { cancelAnimationFrame(self.raf); self.raf = 0; }
    }
    this.raf = requestAnimationFrame(frame);
  };

  Skyline.prototype.stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  Skyline.prototype.destroy = function () {
    this.stop();
    root.removeEventListener('resize', this._onResize);
  };

  Skyline.prototype.draw = function (dt) {
    var g = this.g, w = this.w, h = this.h, t = this.t;

    /* Himmel: kalt oben, schmutzig-warm am Horizont. */
    var sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05070d');
    sky.addColorStop(0.45, '#0a0f1a');
    sky.addColorStop(0.78, '#141826');
    sky.addColorStop(1, '#1d1a20');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    /* Lichtdunst ueber der Stadt */
    var haze = g.createRadialGradient(w * 0.62, h * 0.94, 10, w * 0.62, h * 0.94, h * 0.75);
    haze.addColorStop(0, 'rgba(224,120,60,.13)');
    haze.addColorStop(0.5, 'rgba(90,70,120,.06)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = haze; g.fillRect(0, 0, w, h);

    /* Ebenen von hinten nach vorne */
    for (var i = 0; i < this.layers.length; i++) {
      var L = this.layers[i];
      var off = -((t * L.speed * w) % (L.w - w));
      g.globalAlpha = L.alpha;
      g.drawImage(L.canvas, off, 0);
      g.globalAlpha = 1;

      /* Fenster darueber, mit eigenem Flackern. */
      g.save();
      g.translate(off, 0);
      for (var j = 0; j < L.windows.length; j++) {
        var win = L.windows[j];
        if (win.beacon) {
          var b = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 1.6 + win.x)), 8);
          g.fillStyle = 'rgba(255,60,60,' + b.toFixed(3) + ')';
          g.fillRect(win.x - 1, win.y - 1, 2.5, 2.5);
          continue;
        }
        /* Langsames An und Aus, jedes Fenster mit eigener Phase. */
        var cyc = Math.sin(t * 0.07 + win.p * 24);
        if (cyc < -0.72) continue;
        var a = win.s * (0.55 + 0.45 * Math.sin(t * 0.5 + win.p * 60));
        var warm = win.p > 0.72;
        g.fillStyle = warm
          ? 'rgba(255,196,110,' + (a * 0.85).toFixed(3) + ')'
          : 'rgba(150,200,255,' + (a * 0.6).toFixed(3) + ')';
        g.fillRect(win.x, win.y, win.w, win.h);
      }
      g.restore();
    }

    /* Neon */
    for (i = 0; i < this.neon.length; i++) {
      var nn = this.neon[i];
      var on = 1;
      if (nn.flick) {
        var f = Math.sin(t * 9 + nn.p * 30) + Math.sin(t * 23 + nn.p * 11);
        on = f > -0.6 ? 1 : 0.15;
      }
      g.save();
      g.globalAlpha = 0.85 * on;
      g.font = '700 ' + nn.size.toFixed(0) + 'px "Oswald", Impact, sans-serif';
      g.fillStyle = nn.hue;
      g.shadowColor = nn.hue;
      g.shadowBlur = 16 * on;
      g.fillText(nn.text, nn.x, nn.y);
      g.restore();
    }

    /* Strasse */
    var road = g.createLinearGradient(0, h * 0.88, 0, h);
    road.addColorStop(0, 'rgba(0,0,0,0)');
    road.addColorStop(1, 'rgba(0,0,0,.75)');
    g.fillStyle = road; g.fillRect(0, h * 0.88, w, h * 0.12);

    /* Autolichter mit Nachzieher auf nassem Asphalt */
    for (i = 0; i < this.cars.length; i++) {
      var car = this.cars[i];
      if (!this.still) car.x += car.v * dt;
      if (car.x > w + 220) car.x = -220;
      if (car.x < -220) car.x = w + 220;
      var col = car.warm ? '255,190,120' : '255,80,80';
      var grad = g.createLinearGradient(car.x, 0, car.x + (car.v > 0 ? car.w : -car.w), 0);
      grad.addColorStop(0, 'rgba(' + col + ',.55)');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      g.fillRect(Math.min(car.x, car.x + (car.v > 0 ? car.w : -car.w)), car.y, car.w, 2.2);
      g.fillStyle = 'rgba(' + col + ',.10)';
      g.fillRect(Math.min(car.x, car.x + (car.v > 0 ? car.w : -car.w)), car.y + 2, car.w, 9);
    }

    /* Regen zuletzt, damit er ueber allem liegt. */
    g.strokeStyle = 'rgba(190,210,235,.5)';
    g.lineWidth = 1;
    g.beginPath();
    for (i = 0; i < this.drops.length; i++) {
      var d = this.drops[i];
      if (!this.still) {
        d.y += d.v * dt;
        d.x += d.v * dt * 0.16;
        if (d.y > h) { d.y = -30; d.x = this.rng.range(-60, w + 60); }
      }
      g.globalAlpha = d.a;
      g.moveTo(d.x, d.y);
      g.lineTo(d.x - d.l * 0.16, d.y - d.l);
    }
    g.stroke();
    g.globalAlpha = 1;
  };

  CE.Skyline = Skyline;
})(typeof window !== 'undefined' ? window : globalThis);
