/*
 * Drechselbank: Holz zwischen Spitzen, Werkzeug frei von Hand gefuehrt.
 *
 * Bewusst ein Spielmodell, keine Zerspanungsphysik: Es gibt keine Kraefte,
 * keinen Bruch und keinen Crash. Das Werkzeug traegt nur ab, was seine
 * Schneide beruehrt, und nie weiter als bis auf einen duennen Kern – nur der
 * Abstechstahl geht ganz durch und macht das Stueck fertig.
 *
 * Profil: r[i] je 0,5 mm, Start ist ein Kantholz mit halber Kantenlaenge a
 * (Eckradius a * sqrt 2). Dazu je Zelle Rauheit (Werkzeugriefen) und
 * Brandspur. Oberflaeche (Oel, Wachs, Lack, Beize) gilt fuer das ganze Stueck.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  var DZ = 0.5;
  var RMIN = 1.2;          // duennster Kern ausser beim Abstechen, mm
  var SQ2 = Math.SQRT2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ------------------------------------------------------------ Rauschen
  function hash1(i) { var h = Math.sin(i * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }
  function hash2(i, j) { var h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }
  function rauschen1(x) {
    var i = Math.floor(x), f = x - i;
    f = f * f * (3 - 2 * f);
    return hash1(i) + (hash1(i + 1) - hash1(i)) * f;
  }
  function rauschen2(x, y) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // ------------------------------------------------------------ Holzarten
  // hell/dunkel: Frueh- und Spaetholz (RGB), ring: Jahrringabstand (mm), kontrast der Ringe,
  // maser: Unruhe der Ringe entlang der Achse, haerte 0..1 (Spangroesse, Klang, Abtragstempo)
  var HOELZER = [
    { id: 'fichte', name: 'Fichte', hell: [232, 202, 156], dunkel: [190, 136, 80], ring: 3.4, kontrast: 0.85, maser: 0.25, haerte: 0.3, text: 'Weich und hell, kräftige Jahrringe.' },
    { id: 'ahorn', name: 'Ahorn', hell: [242, 230, 204], dunkel: [216, 194, 158], ring: 2.8, kontrast: 0.35, maser: 0.25, haerte: 0.65, text: 'Fast weiß, fein und glatt.' },
    { id: 'buche', name: 'Buche', hell: [226, 182, 140], dunkel: [198, 148, 106], ring: 2.6, kontrast: 0.4, maser: 0.15, haerte: 0.7, text: 'Hart und gleichmäßig.' },
    { id: 'eiche', name: 'Eiche', hell: [210, 168, 112], dunkel: [140, 98, 56], ring: 2.2, kontrast: 0.75, maser: 0.35, haerte: 0.75, text: 'Kräftige Maserung, riecht nach Holzfass.' },
    { id: 'kirsche', name: 'Kirsche', hell: [212, 136, 94], dunkel: [162, 88, 58], ring: 2.4, kontrast: 0.5, maser: 0.3, haerte: 0.55, text: 'Rötlich, mit Öl wird es feuerrot.' },
    { id: 'nuss', name: 'Nussbaum', hell: [148, 102, 68], dunkel: [84, 54, 34], ring: 2.6, kontrast: 0.6, maser: 0.55, haerte: 0.6, text: 'Dunkel und edel.' },
    { id: 'olive', name: 'Olive', hell: [218, 186, 124], dunkel: [98, 70, 40], ring: 1.6, kontrast: 0.9, maser: 1.3, haerte: 0.85, text: 'Wilde Maserung – jedes Stück ein Unikat.' },
    { id: 'zebrano', name: 'Zebrano', hell: [230, 204, 152], dunkel: [66, 46, 28], ring: 2.0, kontrast: 1, maser: 0.3, haerte: 0.7, streifen: true, text: 'Gestreift wie ein Zebra.' },
    { id: 'ebenholz', name: 'Ebenholz', hell: [66, 54, 48], dunkel: [24, 20, 18], ring: 2.2, kontrast: 0.5, maser: 0.3, haerte: 0.95, text: 'Tiefschwarz, mit Wachs wie Spiegel.' },
    { id: 'regenbogen', name: 'Regenbogen', regenbogen: true, hell: [230, 210, 170], dunkel: [120, 90, 60], ring: 3.6, kontrast: 0, maser: 0.35, haerte: 0.55, text: 'Bunt verleimte Schichten – jede Kehle legt neue Farben frei.' },
    { id: 'epoxid', name: 'Epoxid-Glow', epoxid: true, hell: [200, 156, 100], dunkel: [118, 80, 44], ring: 2.0, kontrast: 0.55, maser: 0.8, haerte: 0.5, text: 'Holz mit leuchtendem Gießharz.' }
  ];
  function holzVon(id) { var i; for (i = 0; i < HOELZER.length; i++) { if (HOELZER[i].id === id) { return HOELZER[i]; } } return HOELZER[0]; }

  // ------------------------------------------------------------ Werkzeuge
  // form: rund (Hohlkehle schneiden), flach, spitz (V), perl (konkave Schneide -> Perle),
  // draht (Brandlinie), flaeche (Schleifen). rau: Riefen, die das Werkzeug hinterlaesst.
  var WERKZEUGE = [
    { id: 'schrupp', name: 'Schruppröhre', kurz: 'Schruppen', taste: '1', form: 'rund', r: 9, rau: 0.65, span: 'grob', tempo: 1.25, text: 'Macht aus dem Kantholz eine Walze. Nimmt richtig was weg.' },
    { id: 'roehre', name: 'Formröhre', kurz: 'Kehlen', taste: '2', form: 'rund', r: 3.5, rau: 0.4, span: 'band', tempo: 1, text: 'Für Kehlen und Rundungen.' },
    { id: 'meissel', name: 'Schlichtmeißel', kurz: 'Schlichten', taste: '3', form: 'flach', b: 16, rau: 0.06, span: 'band', tempo: 0.8, text: 'Lange, glatte Flächen und saubere Kanten.' },
    { id: 'spitz', name: 'Spitzmeißel', kurz: 'V-Kerbe', taste: '4', form: 'spitz', winkel: 32, rau: 0.25, span: 'locke', tempo: 0.9, text: 'V-Kerben und scharfe Absätze.' },
    { id: 'perl', name: 'Perlstab', kurz: 'Perlen', taste: '5', form: 'perl', r: 4, rau: 0.15, span: 'locke', tempo: 0.9, text: 'Eine perfekte Perle in einem Zug.' },
    { id: 'abstech', name: 'Abstechstahl', kurz: 'Abstechen', taste: '6', form: 'flach', b: 3, rau: 0.5, span: 'grob', tempo: 1, durch: true, text: 'Schmale Einstiche – und ganz durch: fertig!' },
    { id: 'brand', name: 'Brenndraht', kurz: 'Brennen', taste: '7', form: 'draht', b: 1.4, rau: 0, span: 'rauch', tempo: 1, text: 'Leicht andrücken: schwarze Brandlinie mit Rauch.' },
    { id: 'schleif', name: 'Schleifpapier', kurz: 'Schleifen', taste: '8', form: 'flaeche', b: 24, rau: 0, span: 'staub', tempo: 1, text: 'Macht die Oberfläche glatt. Danach glänzen Öl und Wachs richtig.' }
  ];
  function werkzeugVon(id) { var i; for (i = 0; i < WERKZEUGE.length; i++) { if (WERKZEUGE[i].id === id) { return WERKZEUGE[i]; } } return WERKZEUGE[0]; }

  // Hoechster erlaubter Radius im Abstand dz von der Werkzeugmitte, Spitze auf Radius h
  function grenze(wz, h, dz) {
    var adz = Math.abs(dz);
    switch (wz.form) {
      case 'rund': return adz >= wz.r ? Infinity : h + wz.r - Math.sqrt(wz.r * wz.r - dz * dz);
      case 'flach': return adz > wz.b / 2 ? Infinity : h + (adz > wz.b / 2 - 0.3 ? 0.3 : 0);
      case 'spitz': return adz > 9 ? Infinity : h + adz / Math.tan(wz.winkel * Math.PI / 180);
      case 'perl': return adz > wz.r + 0.8 ? Infinity : (adz >= wz.r ? h : h + Math.sqrt(wz.r * wz.r - dz * dz));
      default: return Infinity;
    }
  }
  function halbbreite(wz) { return wz.form === 'rund' ? wz.r : wz.form === 'spitz' ? 9 : wz.form === 'perl' ? wz.r + 0.8 : (wz.b || 2) / 2; }

  // ------------------------------------------------------------ Vorlagen
  // p: Stuetzpunkte [u (0..1 entlang der Laenge), Radius mm]; L: Laenge der Form in mm
  var VORLAGEN = [
    { id: 'kreisel', name: 'Kreisel', L: 64, a: 27, p: [[0, 0.8], [0.05, 2.5], [0.18, 9], [0.38, 21], [0.44, 24.5], [0.5, 23], [0.62, 13], [0.7, 6], [0.78, 3.5], [1, 3.5]] },
    { id: 'bauer', name: 'Schachfigur Bauer', L: 72, a: 19, p: [[0, 16], [0.1, 16], [0.16, 12.5], [0.24, 10.5], [0.34, 9], [0.48, 7.5], [0.56, 12], [0.6, 12], [0.66, 6.5], [0.72, 9.5], [0.8, 11.5], [0.9, 10], [0.98, 4], [1, 1]] },
    { id: 'pilz', name: 'Pilz', L: 80, a: 31, p: [[0, 11], [0.3, 9.5], [0.5, 10], [0.56, 14], [0.62, 26], [0.72, 29], [0.84, 25], [0.94, 15], [1, 2]] },
    { id: 'vase', name: 'Vase', L: 150, a: 32, p: [[0, 20], [0.06, 24], [0.2, 29], [0.36, 30], [0.52, 24], [0.68, 13], [0.8, 10], [0.9, 13], [0.97, 16.5], [1, 15]] },
    { id: 'kerze', name: 'Kerzenständer', L: 160, a: 32, p: [[0, 30], [0.07, 30], [0.1, 22], [0.14, 14], [0.2, 12], [0.26, 16], [0.3, 12], [0.48, 11], [0.52, 15], [0.56, 11], [0.74, 12], [0.78, 16], [0.82, 12], [0.88, 16], [0.94, 22], [1, 22]] },
    { id: 'eierbecher', name: 'Eierbecher', L: 72, a: 25, p: [[0, 22], [0.12, 21], [0.22, 12], [0.4, 8], [0.52, 9], [0.62, 15], [0.8, 20], [0.94, 21.5], [1, 21]] },
    { id: 'schlaeger', name: 'Mini-Baseballschläger', L: 190, a: 26, p: [[0, 12], [0.04, 12.5], [0.07, 8], [0.35, 8.5], [0.55, 12], [0.75, 19], [0.9, 23], [0.97, 22], [1, 18]] },
    { id: 'rakete', name: 'Rakete', L: 140, a: 28, p: [[0, 14], [0.06, 18], [0.12, 22], [0.16, 16], [0.2, 16], [0.62, 16], [0.66, 19], [0.7, 16], [0.82, 13], [0.92, 7], [1, 1]] }
  ];
  function vorlageVon(id) { var i; for (i = 0; i < VORLAGEN.length; i++) { if (VORLAGEN[i].id === id) { return VORLAGEN[i]; } } return null; }

  // Monotone Interpolation der Stuetzpunkte (keine Ueberschwinger zwischen den Punkten)
  function vorlageRadius(v, u) {
    var p = v.p, k;
    if (u <= p[0][0]) { return p[0][1]; }
    for (k = 0; k < p.length - 1; k++) {
      if (u <= p[k + 1][0]) {
        var t = (u - p[k][0]) / Math.max(1e-6, p[k + 1][0] - p[k][0]);
        t = t * t * (3 - 2 * t);
        return p[k][1] + (p[k + 1][1] - p[k][1]) * t;
      }
    }
    return p[p.length - 1][1];
  }

  // ------------------------------------------------------------ Querschnitt
  // Flaeche des Kantholzes (halbe Kantenlaenge a), abgedreht auf Radius r
  function flaeche(r, a) {
    if (r <= a) { return Math.PI * r * r; }
    if (r >= a * SQ2) { return 4 * a * a; }
    return Math.PI * r * r - 4 * (r * r * Math.acos(a / r) - a * Math.sqrt(r * r - a * a));
  }

  // ============================================================ Drechselstueck
  // o: { holz, L (mm), a (halbe Kantenlaenge, mm), vorlage (id oder null) }
  function Drechsel(o) {
    this.holz = holzVon(o.holz);
    this.L = o.L || 200;
    this.a = o.a || 28;
    this.N = Math.round(this.L / DZ);
    this.r = new Float32Array(this.N);
    this.rau = new Float32Array(this.N);
    this.brand = new Float32Array(this.N);
    var i;
    for (i = 0; i < this.N; i++) { this.r[i] = this.a * SQ2; this.rau[i] = 1; }
    this.seed = o.seed || Math.floor(Math.random() * 1000);
    // Mark (Kern des Baums) etwas aus der Mitte, so entstehen beim Stillstand Flammen
    this.mark = { x: (hash1(this.seed) - 0.5) * this.holz.ring * 0.9, y: (hash1(this.seed + 7) - 0.5) * this.holz.ring * 0.9 };
    this.vorlage = o.vorlage ? vorlageVon(o.vorlage) : null;
    this.rVorlage = null;
    if (this.vorlage) {
      this.vorlageZ0 = Math.max(6, (this.L - this.vorlage.L) / 2);
      this.rVorlage = new Float32Array(this.N);
      for (i = 0; i < this.N; i++) {
        var z = (i + 0.5) * DZ, u = (z - this.vorlageZ0) / this.vorlage.L;
        this.rVorlage[i] = u < 0 || u > 1 ? NaN : vorlageRadius(this.vorlage, u);
      }
    }
    this.wz = WERKZEUGE[0];
    this.spitze = { z: this.L / 2, h: this.a * SQ2 + 14 };
    this.ziel = { z: this.L / 2, h: this.a * SQ2 + 14 };
    this.halten = false;        // Werkzeug wird gefuehrt (Maustaste, Finger)
    this.n = 1800;              // Drehzahl 1/min
    this.an = true;
    this.nEff = 0;
    this.winkel = 0;
    this.oberflaeche = { art: 'roh', beize: null };
    this.abtrag = 0;            // mm^3 gesamt
    this.rate = 0;              // mm^3/s, geglaettet
    this.eckig = 0;             // Anteil des Schnitts an den Kanten des Kantholzes
    this.schleifen = 0; this.brennen = 0; this.zeit = 0; this.schnittZeit = 0;
    this.version = 0;           // steigt bei jeder Formaenderung (Neuzeichnen)
    this.dirtyA = 0; this.dirtyB = this.N - 1;
    this.rueck = [];
    this.abgestochen = null;
    this.ereignisse = [];
    this.kontakt = null;        // { z, r, typ, menge } fuer Spaene
    this.benutzt = {};
  }

  Drechsel.prototype.zelle = function (z) { return clamp(Math.floor(z / DZ), 0, this.N - 1); };

  // Radius, auf dem die Werkzeugspitze das Holz gerade beruehrt (Profil der Schneide beachtet)
  Drechsel.prototype.beruehrHoehe = function (z) {
    var wz = this.wz, hb = halbbreite(wz), i0 = this.zelle(z - hb), i1 = this.zelle(z + hb), i, h = -Infinity;
    if (z + hb < 0 || z - hb > this.L) { return -Infinity; }
    for (i = i0; i <= i1; i++) {
      var dz = (i + 0.5) * DZ - z;
      if (Math.abs(dz) > hb) { continue; }
      var g0 = wz.form === 'flaeche' || wz.form === 'draht' ? 0 : grenze(wz, 0, dz);
      if (g0 === Infinity) { continue; }
      if (this.r[i] - g0 > h) { h = this.r[i] - g0; }
    }
    return h;
  };
  Drechsel.prototype.radius = function (z) { return this.r[this.zelle(z)]; };

  Drechsel.prototype.werkzeug = function (id) { this.wz = werkzeugVon(id); };

  // Zustand vor jedem Zug merken (Rueckgaengig)
  Drechsel.prototype.merken = function () {
    if (this.abgestochen) { return; }
    this.rueck.push({ r: new Float32Array(this.r), rau: new Float32Array(this.rau), brand: new Float32Array(this.brand), abtrag: this.abtrag });
    if (this.rueck.length > 30) { this.rueck.shift(); }
  };
  Drechsel.prototype.rueckgaengig = function () {
    var s = this.rueck.pop();
    if (!s || this.abgestochen) { return false; }
    this.r.set(s.r); this.rau.set(s.rau); this.brand.set(s.brand);
    this.abtrag = s.abtrag;
    this.markiere(0, this.N - 1);
    return true;
  };

  Drechsel.prototype.markiere = function (a, b) {
    if (this.version === this.gezeichnet) { this.dirtyA = a; this.dirtyB = b; }
    else { this.dirtyA = Math.min(this.dirtyA, a); this.dirtyB = Math.max(this.dirtyB, b); }
    this.version++;
  };

  // Ein Zeitschritt: Spindel, Werkzeug zum Ziel fuehren, abtragen
  Drechsel.prototype.step = function (dt) {
    if (dt <= 0) { return; }
    this.zeit += dt;
    // Spindel faehrt linear hoch (1600 1/min je s) und bremst mit 1200 1/min je s
    var nSoll = this.an && !this.abgestochen ? this.n : 0;
    if (this.nEff < nSoll) { this.nEff = Math.min(nSoll, this.nEff + 1600 * dt); } else { this.nEff = Math.max(nSoll, this.nEff - 1200 * dt); }
    this.winkel = (this.winkel + this.nEff / 60 * 2 * Math.PI * dt) % (2 * Math.PI);
    var holz = this.holz, wz = this.wz;
    var drehend = this.nEff > 120;
    // Werkzeug folgt dem Ziel auf der Geraden (sonst schneidet die Spitze vor dem Ziel zu tief):
    // in der Luft schnell, im Holz nur so schnell, wie es schneidet
    var sp = this.spitze, zi = this.ziel;
    var gleiten = wz.form === 'flaeche' || wz.form === 'draht';
    var hTouchZiel = this.beruehrHoehe(zi.z);
    var hZiel = this.halten ? zi.h : Math.max(zi.h, hTouchZiel + 6);
    if (gleiten) { hZiel = Math.max(hZiel, hTouchZiel - 1.5); }
    var dz = zi.z - sp.z, dh = hZiel - sp.h, len = Math.sqrt(dz * dz + dh * dh);
    var tief = sp.h < this.beruehrHoehe(sp.z) - 0.05;
    var vCut = (35 + 70 * Math.min(1, this.nEff / 3000)) * wz.tempo;
    var vRad = (10 + 28 * Math.min(1, this.nEff / 2500)) * (1.35 - 0.6 * holz.haerte) * wz.tempo;
    var f = len > 1e-9 ? Math.min(1, (tief && !gleiten ? vCut : 300) * dt / len) : 1;
    if (dh < 0 && !gleiten) {
      // Eintauchen ins Holz begrenzt die Zustellung (bei stehender Spindel gar nicht)
      var hTouchJetzt = this.beruehrHoehe(sp.z + dz * f);
      if (sp.h + dh * f < hTouchJetzt) {
        var luft = Math.max(0, sp.h - hTouchJetzt);
        var erlaubt = luft + (drehend ? vRad * dt : 0);
        if (-dh * f > erlaubt) { f = Math.min(f, erlaubt / -dh); }
      }
    }
    var zNeu = sp.z + dz * f, hNeu = sp.h + dh * f;
    hNeu = Math.max(hNeu, wz.durch ? -0.5 : RMIN - 0.4);
    var schritte = Math.max(1, Math.ceil(Math.max(Math.abs(zNeu - sp.z), Math.abs(hNeu - sp.h)) / 0.4)), k, ab = 0, kontaktR = null, eckig = 0, eckigN = 0;
    var z0 = sp.z, h0 = sp.h;
    this.schleifen = 0; this.brennen = 0;
    for (k = 1; k <= schritte; k++) {
      var zt = z0 + (zNeu - z0) * k / schritte, ht = h0 + (hNeu - h0) * k / schritte;
      var e = this.bearbeiten(zt, ht, dt / schritte, drehend);
      ab += e.ab;
      if (e.kontakt !== null) { kontaktR = e.kontakt; }
      eckig += e.eckig; eckigN += e.n;
    }
    sp.z = clamp(zNeu, -10, this.L + 10);
    sp.h = hNeu;
    this.abtrag += ab;
    var rateNeu = ab / dt;
    this.rate += (rateNeu - this.rate) * Math.min(1, dt * 12);
    this.eckig = eckigN ? eckig / eckigN : 0;
    if (ab > 0) { this.schnittZeit += dt; }
    this.kontakt = kontaktR !== null ? { z: sp.z, r: kontaktR, menge: ab, typ: wz.span } : (this.schleifen > 0 || this.brennen > 0 ? { z: sp.z, r: this.radius(sp.z), menge: 0, typ: wz.span } : null);
  };

  // Werkzeug an (zt, ht): Abtrag, Riefen, Schleifen, Brennen
  Drechsel.prototype.bearbeiten = function (zt, ht, dt, drehend) {
    var wz = this.wz, a = this.a, hb = halbbreite(wz);
    var i0 = this.zelle(zt - hb), i1 = this.zelle(zt + hb), i, ab = 0, kontakt = null, eckig = 0, n = 0;
    if (zt + hb < 0 || zt - hb > this.L || this.abgestochen) { return { ab: 0, kontakt: null, eckig: 0, n: 0 }; }
    if (wz.form === 'flaeche' || wz.form === 'draht') {
      for (i = i0; i <= i1; i++) {
        var dz = (i + 0.5) * DZ - zt;
        if (Math.abs(dz) > hb || ht > this.r[i] + 0.25 || !drehend) { continue; }
        kontakt = this.r[i];
        if (wz.form === 'flaeche') {
          this.rau[i] = Math.max(0, this.rau[i] - dt * 1.4);
          if (this.r[i] > RMIN + 0.05) { this.r[i] -= dt * 0.01; }
          this.schleifen = 1;
        } else {
          var druck = clamp((this.r[i] + 0.25 - ht) / 1.5, 0.1, 1);
          this.brand[i] = Math.min(1, this.brand[i] + dt * 1.6 * druck);
          if (this.r[i] > RMIN + 0.1) { this.r[i] -= dt * 0.06 * druck; }
          this.brennen = Math.max(this.brennen, druck);
        }
      }
      if (kontakt !== null) { this.markiere(i0, i1); this.benutzt[wz.id] = true; }
      return { ab: 0, kontakt: kontakt, eckig: 0, n: 0 };
    }
    if (!drehend) { return { ab: 0, kontakt: null, eckig: 0, n: 0 }; }
    for (i = i0; i <= i1; i++) {
      var g = grenze(wz, ht, (i + 0.5) * DZ - zt);
      if (g === Infinity) { continue; }
      var rmin = wz.durch ? 0 : RMIN;
      var neu = Math.max(rmin, g);
      if (neu < this.r[i] - 1e-4) {
        ab += (flaeche(this.r[i], a) - flaeche(neu, a)) * DZ;
        if (this.r[i] > a) { eckig += 1; }
        n += 1;
        this.r[i] = neu;
        this.rau[i] = Math.max(wz.rau, Math.min(1, this.rau[i] * 0.5 + wz.rau));
        this.brand[i] *= 0.2;
        kontakt = neu;
        if (wz.durch && neu < 0.35 && !this.abgestochen) {
          this.abgestochen = { z: (i + 0.5) * DZ };
          this.ereignisse.push({ typ: 'abgestochen', z: (i + 0.5) * DZ });
        }
      }
    }
    if (n) { this.markiere(i0, i1); this.benutzt[wz.id] = true; }
    return { ab: ab, kontakt: kontakt, eckig: eckig, n: n };
  };

  // Bereich, in dem wirklich gedrechselt wurde (fuer Fertigstellen und Bewertung)
  Drechsel.prototype.arbeitsbereich = function () {
    var a = this.a * SQ2 - 0.05, i0 = -1, i1 = -1, i;
    for (i = 0; i < this.N; i++) { if (this.r[i] < a) { if (i0 < 0) { i0 = i; } i1 = i; } }
    return i0 < 0 ? null : { i0: i0, i1: i1 };
  };

  // Fertiges Stueck: zwischen den Abstichstellen bzw. im Arbeitsbereich ohne die Spitzen-Enden
  Drechsel.prototype.stueck = function () {
    var i0, i1, b;
    if (this.vorlage) {
      i0 = this.zelle(this.vorlageZ0);
      i1 = this.zelle(this.vorlageZ0 + this.vorlage.L) - 1;
    } else {
      b = this.arbeitsbereich() || { i0: 0, i1: this.N - 1 };
      i0 = Math.max(b.i0, this.zelle(4));
      i1 = Math.min(b.i1, this.zelle(this.L - 4));
    }
    if (this.abgestochen) {
      var ia = this.zelle(this.abgestochen.z);
      // Abstich mitten im Stueck: das Stueck ist der groessere Teil
      if (ia >= i0 && ia <= i1) {
        if (ia - i0 > i1 - ia) { i1 = Math.max(i0, ia - 1); } else { i0 = Math.min(i1, ia + 1); }
      }
    }
    var prof = [], i, vol = 0, rauS = 0;
    for (i = i0; i <= i1; i++) {
      prof.push(Math.min(this.r[i], this.a * SQ2));
      vol += flaeche(this.r[i], this.a) * DZ;
      rauS += this.rau[i];
    }
    var n = Math.max(1, i1 - i0 + 1);
    return { i0: i0, i1: i1, prof: prof, L: n * DZ, volumen: vol, glaette: 1 - rauS / n };
  };

  // Formtreue zur Vorlage: je Zelle 1 (auf 0,5 mm), 0,7 (1,2 mm), 0,35 (2,5 mm), sonst 0
  Drechsel.prototype.treffer = function () {
    if (!this.rVorlage) { return null; }
    var s = 0, n = 0, zuTief = 0, i;
    for (i = 0; i < this.N; i++) {
      var t = this.rVorlage[i];
      if (isNaN(t)) { continue; }
      var e = Math.abs(this.r[i] - t);
      s += e <= 0.5 ? 1 : e <= 1.2 ? 0.7 : e <= 2.5 ? 0.35 : 0;
      if (this.r[i] < t - 0.5) { zuTief++; }
      n++;
    }
    return { prozent: n ? Math.round(s / n * 100) : 0, zuTief: n ? zuTief / n : 0 };
  };

  // Name fuer ein freies Stueck aus seiner Form
  function nameFuer(prof, holz, oberflaeche) {
    var n = prof.length, i, max = 0, min = 1e9, perlen = 0, kehlen = 0, iMax = 0;
    for (i = 0; i < n; i++) { if (prof[i] > max) { max = prof[i]; iMax = i; } if (prof[i] < min) { min = prof[i]; } }
    var schritt = Math.max(2, Math.round(n / 60));
    for (i = schritt; i < n - schritt; i += schritt) {
      var a = prof[i - schritt], b = prof[i], c = prof[i + schritt];
      if (b > a + 0.4 && b > c + 0.4 && b > min + 1.5) { perlen++; }
      if (b < a - 0.4 && b < c - 0.4) { kehlen++; }
    }
    var L = n * DZ, ratio = L / Math.max(1, 2 * max), lage = iMax / Math.max(1, n - 1);
    // [Name, Geschlecht] fuer die Endung des Eigenschaftsworts
    var namen;
    if (perlen >= 4) { namen = [['Perlenspindel', 'f'], ['Perlenstab', 'm']]; }
    else if (ratio > 5) { namen = [['Zauberstab', 'm'], ['Spindel', 'f'], ['Taktstock', 'm']]; }
    else if (max > 2.6 * min && (lage < 0.25 || lage > 0.75)) { namen = [['Pilz', 'm'], ['Kreisel', 'm'], ['Stößel', 'm']]; }
    else if (max > 1.8 * min && lage > 0.25 && lage < 0.75) { namen = [['Vase', 'f'], ['Fässchen', 'n'], ['Flasche', 'f']]; }
    else if (kehlen >= 2) { namen = [['Säule', 'f'], ['Balustersäule', 'f'], ['Kerzenständer', 'm']]; }
    else if (ratio < 1.6) { namen = [['Knauf', 'm'], ['Döschen', 'n'], ['Klötzchen', 'n']]; }
    else { namen = [['Griff', 'm'], ['Werkzeugheft', 'n'], ['Drechselstück', 'n']]; }
    var wahl = namen[(perlen + kehlen + Math.round(L)) % namen.length], name = wahl[0], endung = { m: 'er ', f: 'e ', n: 'es ' }[wahl[1]];
    if (holz.regenbogen) { return 'Regenbogen-' + name; }
    var stamm = holz.epoxid ? 'Leuchtend' : oberflaeche.art === 'lack' ? 'Glänzend' : oberflaeche.art === 'wachs' ? 'Poliert' : oberflaeche.art === 'oel' ? 'Geölt' : '';
    return stamm ? stamm + endung + name : name;
  }

  ZM.holz = {
    DZ: DZ, RMIN: RMIN, HOELZER: HOELZER, holzVon: holzVon, WERKZEUGE: WERKZEUGE, werkzeugVon: werkzeugVon,
    VORLAGEN: VORLAGEN, vorlageVon: vorlageVon, vorlageRadius: vorlageRadius, grenze: grenze, halbbreite: halbbreite,
    flaeche: flaeche, Drechsel: Drechsel, nameFuer: nameFuer, rauschen1: rauschen1, rauschen2: rauschen2, hash1: hash1
  };
})(typeof window !== 'undefined' ? window : globalThis);
