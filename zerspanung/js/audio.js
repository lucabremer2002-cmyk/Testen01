/*
 * Maschinengeraeusche, vollstaendig mit der Web Audio API synthetisiert.
 *
 *   Motor      Drehstrom-Asynchronmotor: Brummen fest bei 100 Hz (doppelte Netzfrequenz,
 *              Magnetostriktion), unter Last lauter und mit Schwebung im Takt der
 *              Schlupffrequenz (das "Knurren" des belasteten Motors)
 *   Servo      CNC-Hauptspindel am Umrichter: kein Netzbrummen, sondern ein mit der
 *              Drehzahl steigendes Singen (Polfrequenz) und leises PWM-Pfeifen
 *   Getriebe   Zahneingriffsfrequenz proportional zur Spindeldrehzahl
 *   Schnitt    bandbegrenztes Rauschen; beim Fraesen als Impulsfolge im Takt der
 *              Zahneingriffe (fZE), Tiefe aus der Schwankung der Zahnkraft
 *   Rattern    Ton bei der wirklichen Eigenfrequenz (nur in den Hoerbereich begrenzt)
 *   Ueberlast  Keilriemen quietscht (Haft-Gleit-Wechsel), Rastkupplung ratscht im Takt
 *              der Rasten, gestauchte Spaene knistern im Spanbruchtakt, unrundes Rohteil
 *              und Haemmern klopfen, Tisch schlaegt im Umkehrspiel an, rutschendes
 *              Werkstueck und reibender Halter kreischen, Ausbrueche knacken
 *   KSS        Plaetschern des Kuehlschmierstoffs
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function Klang() {
    this.ctx = null;
    this.an = true;
    this.vol = 0.6;
    this.bereit = false;
    this.tAlt = 0;
    this.phKupp = 0;
    this.phKlopf = 0;
    this.knackAlt = 0;
    this.klackAlt = 0;
  }

  // Rauschquelle (Endlosschleife) in einen Filter
  function rauschQuelle(c, buf, rate) {
    var q = c.createBufferSource();
    q.buffer = buf;
    q.loop = true;
    q.playbackRate.value = rate || 1;
    return q;
  }

  function filter(c, typ, f, Q) {
    var b = c.createBiquadFilter();
    b.type = typ;
    b.frequency.value = f;
    if (Q !== undefined) { b.Q.value = Q; }
    return b;
  }

  function verstaerker(c, g) {
    var v = c.createGain();
    v.gain.value = g || 0;
    return v;
  }

  function osz(c, typ, f) {
    var o = c.createOscillator();
    o.type = typ;
    o.frequency.value = f;
    return o;
  }

  Klang.prototype.start = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { this.ctx.resume(); }
      return;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { return; }
    try {
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    var c = this.ctx, sr = c.sampleRate, i;
    this.master = verstaerker(c, this.an ? this.vol : 0);
    var komp = c.createDynamicsCompressor();
    komp.threshold.value = -14;
    komp.ratio.value = 4;
    this.master.connect(komp);
    komp.connect(c.destination);

    // Rauschpuffer (2 s, weiss)
    var len = sr * 2;
    var buf = c.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    for (i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
    this.rauschen = buf;

    // Knisterpuffer: 100 kurze Knacke je Sekunde zu zufaelligen Zeiten (Spanbruch)
    var kb = c.createBuffer(1, len, sr), kd = kb.getChannelData(0), k, j;
    for (k = 0; k < 200; k++) {
      var p0 = Math.floor(Math.random() * (len - 400)), amp = 0.4 + 0.6 * Math.random(), tau = sr * (0.0006 + 0.0012 * Math.random());
      for (j = 0; j < 400; j++) { kd[p0 + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / tau); }
    }
    this.knister = kb;

    // ---------------------------------------------- Asynchronmotor (konventionell)
    // 100 Hz plus Oberwellen; die Schwebung (Schlupf) moduliert die Lautstaerke
    this.motorOsc = osz(c, 'sawtooth', 100);
    var motorLp = filter(c, 'lowpass', 420, 0.7);
    this.motorAm = verstaerker(c, 1);
    this.motorGain = verstaerker(c, 0);
    this.motorOsc.connect(motorLp);
    motorLp.connect(this.motorAm);
    this.motorAm.connect(this.motorGain);
    this.motorGain.connect(this.master);
    this.schlupfOsc = osz(c, 'sine', 3);
    this.schlupfTiefe = verstaerker(c, 0);
    this.schlupfOsc.connect(this.schlupfTiefe);
    this.schlupfTiefe.connect(this.motorAm.gain);
    // Luefter des Motors: breitbandiges Rauschen, mit der Motordrehzahl
    var lq = rauschQuelle(c, buf, 0.5);
    this.lueftLp = filter(c, 'bandpass', 600, 0.6);
    this.lueftGain = verstaerker(c, 0);
    lq.connect(this.lueftLp);
    this.lueftLp.connect(this.lueftGain);
    this.lueftGain.connect(this.master);

    // ---------------------------------------------- Servo-Hauptspindel (CNC)
    this.servoOsc = osz(c, 'triangle', 200);
    this.servoOsc2 = osz(c, 'sine', 400);
    this.servoGain = verstaerker(c, 0);
    var s2g = verstaerker(c, 0.35);
    this.servoOsc.connect(this.servoGain);
    this.servoOsc2.connect(s2g);
    s2g.connect(this.servoGain);
    this.servoGain.connect(this.master);
    this.pwmOsc = osz(c, 'sine', 7900);
    this.pwmGain = verstaerker(c, 0);
    this.pwmOsc.connect(this.pwmGain);
    this.pwmGain.connect(this.master);

    // ---------------------------------------------- Getriebe / Spindellager
    this.getrOsc = osz(c, 'triangle', 60);
    this.getrGain = verstaerker(c, 0);
    this.getrOsc.connect(this.getrGain);
    this.getrGain.connect(this.master);

    // ---------------------------------------------- Schnitt mit Impulsfolge
    var sq = rauschQuelle(c, buf, 1);
    this.schnittBp = filter(c, 'bandpass', 1200, 0.9);
    this.amGain = verstaerker(c, 0.6);
    this.schnittGain = verstaerker(c, 0);
    // Saegezahn als Modulator: steiler Anstieg beim Zahneintritt, Abklingen bis zum naechsten
    this.amOsc = osz(c, 'sawtooth', 30);
    this.amTiefe = verstaerker(c, 0.3);
    this.amOsc.connect(this.amTiefe);
    this.amTiefe.connect(this.amGain.gain);
    sq.connect(this.schnittBp);
    this.schnittBp.connect(this.amGain);
    this.amGain.connect(this.schnittGain);
    this.schnittGain.connect(this.master);

    // ---------------------------------------------- Rattern
    this.ratterOsc = osz(c, 'sine', 900);
    this.ratterOsc2 = osz(c, 'square', 1800);
    this.ratterBp = filter(c, 'bandpass', 1800, 6);
    this.ratterGain = verstaerker(c, 0);
    var r2g = verstaerker(c, 0.25);
    this.ratterOsc.connect(this.ratterGain);
    this.ratterOsc2.connect(this.ratterBp);
    this.ratterBp.connect(r2g);
    r2g.connect(this.ratterGain);
    this.ratterGain.connect(this.master);

    // ---------------------------------------------- Quietschen (stumpfe, reibende Schneide)
    this.quiOsc = osz(c, 'sawtooth', 2600);
    var quiBp = filter(c, 'bandpass', 2600, 12);
    this.quiBp = quiBp;
    this.quiGain = verstaerker(c, 0);
    this.quiOsc.connect(quiBp);
    quiBp.connect(this.quiGain);
    this.quiGain.connect(this.master);

    // ---------------------------------------------- Keilriemen quietscht (Haft-Gleit-Wechsel)
    this.riemOsc = osz(c, 'sawtooth', 1650);
    this.riemVib = osz(c, 'sine', 5.4);
    this.riemVibT = verstaerker(c, 140);
    this.riemVib.connect(this.riemVibT);
    this.riemVibT.connect(this.riemOsc.frequency);
    var riemBp = filter(c, 'bandpass', 1900, 5);
    this.riemAm = verstaerker(c, 0.6);
    this.riemAmOsc = osz(c, 'square', 5.4);
    var riemAmT = verstaerker(c, 0.4);
    this.riemAmOsc.connect(riemAmT);
    riemAmT.connect(this.riemAm.gain);
    this.riemGain = verstaerker(c, 0);
    this.riemOsc.connect(riemBp);
    riemBp.connect(this.riemAm);
    this.riemAm.connect(this.riemGain);
    this.riemGain.connect(this.master);

    // ---------------------------------------------- Kreischen (Werkstueck rutscht, Halter reibt)
    var krq = rauschQuelle(c, buf, 1.3);
    this.kreischBp1 = filter(c, 'bandpass', 1150, 9);
    this.kreischBp2 = filter(c, 'bandpass', 2900, 11);
    this.kreischOsc = osz(c, 'sawtooth', 1150);
    var krOg = verstaerker(c, 0.18);
    this.kreischGain = verstaerker(c, 0);
    krq.connect(this.kreischBp1);
    krq.connect(this.kreischBp2);
    this.kreischOsc.connect(krOg);
    krOg.connect(this.kreischBp1);
    this.kreischBp1.connect(this.kreischGain);
    this.kreischBp2.connect(this.kreischGain);
    this.kreischGain.connect(this.master);

    // ---------------------------------------------- Knistern gestauchter Spaene
    this.knistQ = rauschQuelle(c, this.knister, 1);
    var knHp = filter(c, 'highpass', 1400, 0.7);
    this.knistGain = verstaerker(c, 0);
    this.knistQ.connect(knHp);
    knHp.connect(this.knistGain);
    this.knistGain.connect(this.master);

    // ---------------------------------------------- Haemmern im Umkehrspiel (Grundton im Zahntakt)
    this.hamOsc = osz(c, 'square', 20);
    var hamLp = filter(c, 'lowpass', 260, 1.2);
    this.hamGain = verstaerker(c, 0);
    this.hamOsc.connect(hamLp);
    hamLp.connect(this.hamGain);
    this.hamGain.connect(this.master);

    // ---------------------------------------------- Kuehlschmierstoff
    var kq = rauschQuelle(c, buf, 0.7);
    var khp = filter(c, 'highpass', 2500);
    this.kssGain = verstaerker(c, 0);
    kq.connect(khp);
    khp.connect(this.kssGain);
    this.kssGain.connect(this.master);

    [this.motorOsc, this.schlupfOsc, lq, this.servoOsc, this.servoOsc2, this.pwmOsc, this.getrOsc, sq, this.amOsc, this.ratterOsc, this.ratterOsc2,
      this.quiOsc, this.riemOsc, this.riemVib, this.riemAmOsc, krq, this.kreischOsc, this.knistQ, this.hamOsc, kq].forEach(function (n) { n.start(); });

    this.tAlt = c.currentTime;
    this.bereit = true;
  };

  Klang.prototype.setAn = function (an) {
    this.an = an;
    if (this.master) { this.master.gain.setTargetAtTime(an ? this.vol : 0, this.ctx.currentTime, 0.05); }
  };

  Klang.prototype.setVol = function (v) {
    this.vol = v;
    if (this.master && this.an) { this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  };

  function ziel(param, wert, t, tau) {
    param.setTargetAtTime(wert, t, tau || 0.06);
  }

  // ---------------------------------------------------------- Einzelgeraeusche
  function ping(c, ausgang, f, dauer, lautst, start) {
    var o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    var g = c.createGain();
    g.gain.setValueAtTime(lautst, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
    o.connect(g);
    g.connect(ausgang);
    o.start(start);
    o.stop(start + dauer + 0.05);
  }

  // gefiltertes Rauschstueck ab Zeitpunkt t
  function stueck(self, t, dauer, typ, f, Q, lautst) {
    var c = self.ctx;
    var q = c.createBufferSource();
    q.buffer = self.rauschen;
    var b = filter(c, typ, f, Q);
    var g = c.createGain();
    g.gain.setValueAtTime(lautst, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(b);
    b.connect(g);
    g.connect(self.master);
    q.start(t, Math.random() * 1.5);
    q.stop(t + dauer + 0.03);
  }

  function burst(self, dauer, f0, f1, lautst) {
    var c = self.ctx, t = c.currentTime;
    var q = c.createBufferSource();
    q.buffer = self.rauschen;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f0, t);
    lp.frequency.exponentialRampToValueAtTime(f1, t + dauer);
    var g = c.createGain();
    g.gain.setValueAtTime(lautst, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(lp);
    lp.connect(g);
    g.connect(self.master);
    q.start(t);
    q.stop(t + dauer + 0.05);
  }

  // Rastkupplung: harter, metallischer Ratschklick
  function ratsch(self, t, lautst) {
    stueck(self, t, 0.012, 'highpass', 2200, 0.7, 0.5 * lautst);
    ping(self.ctx, self.master, 3150 + Math.random() * 300, 0.035, 0.12 * lautst, t);
  }
  // Klopfen: dumpfer Schlag (unrundes Rohteil, Haemmern)
  function klopf(self, t, lautst) {
    stueck(self, t, 0.06, 'lowpass', 420, 0.8, 0.6 * lautst);
    ping(self.ctx, self.master, 115, 0.08, 0.35 * lautst, t);
  }
  // Tisch schlaegt im Umkehrspiel an: kurzer, harter Klack mit Gussklang
  function klack(self, t, lautst) {
    stueck(self, t, 0.04, 'bandpass', 1500, 1.2, 0.8 * lautst);
    ping(self.ctx, self.master, 185, 0.12, 0.4 * lautst, t);
    ping(self.ctx, self.master, 960, 0.08, 0.12 * lautst, t);
  }
  // Ausbruch an der Schneide: trockenes Knacken
  function knack(self, t, lautst) {
    stueck(self, t, 0.025, 'highpass', 3000, 0.7, 0.7 * lautst);
    ping(self.ctx, self.master, 4200 + Math.random() * 900, 0.06, 0.1 * lautst, t);
  }

  // z: { n, nMax, last, schnitt (0..1), vc, schneiden, ratter (um), ratterF, quietsch (0..1), kss, extra }
  // extra (Drehen):  cnc, iRel, riemen, kupplung, fRat, puls, fcb, klopfen, nRev, halterReibt, knack, kreischen
  // extra (Fraesen): cnc, fZE, pulsGrad, hammer, tischKlack, riemen, kupplung, fRat, iRel, stumpfReibt, knack
  Klang.prototype.update = function (z) {
    if (!this.bereit) { return; }
    var c = this.ctx, t = c.currentTime, ex = z.extra || {};
    var dt = clamp(t - this.tAlt, 0, 0.25);
    this.tAlt = t;
    var n = z.n || 0, last = z.last || 0;
    var lauf = Math.min(1, n / Math.max(z.nMax || 1000, 1) * 4);
    var motor = n > 1 ? 1 : 0;
    var cnc = !!ex.cnc;

    // Antrieb
    if (!cnc) {
      // Netzbrummen bleibt bei 100 Hz; der Strom (Last) macht es lauter, der Schlupf schwebt
      var iRel = ex.iRel !== undefined ? ex.iRel : 0.35 + 0.65 * Math.min(1.5, last);
      var schlupf = clamp(0.04 * Math.max(0.2, last), 0.01, 0.4);
      ziel(this.motorGain.gain, motor * (0.035 + 0.035 * clamp(iRel, 0, 2)) * Math.max(0.3, lauf), t, 0.12);
      ziel(this.schlupfOsc.frequency, Math.max(0.5, 100 * schlupf), t, 0.2);
      ziel(this.schlupfTiefe.gain, motor * clamp((last - 0.4) * 0.5, 0, 0.6), t, 0.15);
      ziel(this.lueftGain.gain, motor * 0.012 * (1 - 0.5 * clamp(schlupf * 3, 0, 1)), t, 0.3);
      ziel(this.lueftLp.frequency, 600 * (1 - schlupf), t, 0.3);
      ziel(this.servoGain.gain, 0, t, 0.1);
      ziel(this.pwmGain.gain, 0, t, 0.1);
    } else {
      // Umrichter: Polfrequenz (2 Polpaare) und deren Oberton singen mit der Drehzahl
      var fPol = Math.max(10, n / 60 * 2);
      var fs = fPol;
      while (fs < 160) { fs *= 2; }
      ziel(this.servoOsc.frequency, fs, t, 0.05);
      ziel(this.servoOsc2.frequency, fs * 3, t, 0.05);
      ziel(this.servoGain.gain, motor * (0.012 + 0.02 * clamp(n / 4500, 0, 1) + 0.025 * clamp(last, 0, 1.5)), t, 0.08);
      ziel(this.pwmGain.gain, motor * 0.004, t, 0.2);
      ziel(this.motorGain.gain, 0, t, 0.1);
      ziel(this.schlupfTiefe.gain, 0, t, 0.1);
      ziel(this.lueftGain.gain, motor * 0.008, t, 0.3);
    }
    ziel(this.getrOsc.frequency, Math.max(20, n / 60 * 23), t, 0.05);
    ziel(this.getrGain.gain, motor * (cnc ? 0.006 : 0.018) * lauf, t, 0.1);

    // Schnitt
    var s = Math.min(1, z.schnitt || 0);
    ziel(this.schnittGain.gain, 0.32 * Math.sqrt(s), t, 0.04);
    ziel(this.schnittBp.frequency, 500 + Math.min(4500, (z.vc || 0) * 14), t, 0.08);
    var fAm = ex.fZE ? ex.fZE : Math.max(2, n / 60 * (z.schneiden || 1));
    ziel(this.amOsc.frequency, clamp(fAm, 1, 800), t, 0.05);
    var tiefe = ex.fZE ? clamp(0.15 + 0.25 * (ex.pulsGrad || 0), 0.15, 0.55) : 0.08;
    ziel(this.amTiefe.gain, tiefe, t, 0.1);

    // Rattern bei der wirklichen Eigenfrequenz, nur in den Hoerbereich begrenzt
    var ra = Math.min(1, (z.ratter || 0) / 30);
    var rf = clamp(z.ratterF || 900, 90, 6000);
    ziel(this.ratterOsc.frequency, rf, t, 0.05);
    ziel(this.ratterOsc2.frequency, Math.min(12000, rf * 2), t, 0.05);
    ziel(this.ratterBp.frequency, Math.min(12000, rf * 2), t, 0.05);
    ziel(this.ratterGain.gain, 0.22 * ra, t, 0.05);

    // Quietschen der reibenden Schneide bzw. des Fraeserstumpfs
    var q = Math.min(1, (z.quietsch || 0) + (ex.stumpfReibt ? 0.9 : 0));
    ziel(this.quiOsc.frequency, 2300 + 600 * Math.sin(t * 7), t, 0.05);
    ziel(this.quiGain.gain, 0.05 * q, t, 0.08);

    // Keilriemen: Quietschen mit Haft-Gleit-Takt
    var rie = clamp(ex.riemen || 0, 0, 1);
    ziel(this.riemGain.gain, 0.07 * rie, t, 0.06);
    ziel(this.riemOsc.frequency, 1650 - 250 * clamp(last - 1, 0, 1), t, 0.2);

    // Kreischen: Werkstueck rutscht in den Backen, Halter reibt am Werkstueck
    var kr = Math.max(clamp(ex.kreischen || 0, 0, 1), ex.halterReibt ? 0.8 : 0);
    ziel(this.kreischGain.gain, 0.09 * kr, t, 0.05);
    ziel(this.kreischOsc.frequency, ex.halterReibt ? 2900 : 1150, t, 0.1);

    // Spaenestau: Knistern im Spanbruchtakt
    var pu = clamp(((ex.puls || 0) - 0.08) / 0.26, 0, 1);
    ziel(this.knistGain.gain, s > 0 ? 0.35 * pu : 0, t, 0.05);
    if (ex.fcb) { ziel(this.knistQ.playbackRate, clamp(ex.fcb / 100, 0.3, 3), t, 0.1); }

    // Haemmern im Umkehrspiel: dumpfer Grundton im Zahntakt
    var ham = clamp(ex.hammer || 0, 0, 1);
    ziel(this.hamOsc.frequency, clamp(ex.fZE || 20, 4, 200), t, 0.05);
    ziel(this.hamGain.gain, 0.12 * ham, t, 0.05);

    // Ratschende Rastkupplung: einzelne Klicks im Rastentakt
    var ku = clamp(ex.kupplung || 0, 0, 1);
    if (ku > 0.3 && ex.fRat > 0) {
      this.phKupp += Math.min(40, ex.fRat) * dt;
      var m = 0;
      while (this.phKupp >= 1 && m++ < 8) { this.phKupp -= 1; ratsch(this, t + 0.02 + Math.random() * 0.01, ku); }
    } else { this.phKupp = 0; }

    // Unrundes Rohteil / unterbrochener Schnitt: Klopfen einmal je Umdrehung
    var kl = clamp(ex.klopfen || 0, 0, 1);
    if (kl > 0 && ex.nRev > 0) {
      this.phKlopf += Math.min(40, ex.nRev) * dt;
      var m2 = 0;
      while (this.phKlopf >= 1 && m2++ < 8) { this.phKlopf -= 1; klopf(this, t + 0.02, 0.4 + 0.6 * kl); }
    } else { this.phKlopf = 0; }

    // Zaehler aus der Physik: Tischanschlaege und Ausbrueche
    var tk = ex.tischKlack || 0;
    if (tk < this.klackAlt) { this.klackAlt = tk; }
    var nk = Math.min(4, tk - this.klackAlt);
    for (m = 0; m < nk; m++) { klack(this, t + 0.02 + m * 0.03, 1); }
    this.klackAlt = tk;
    var kn = ex.knack || 0;
    if (kn < this.knackAlt) { this.knackAlt = kn; }
    var nn = Math.min(3, kn - this.knackAlt);
    for (m = 0; m < nn; m++) { knack(this, t + 0.02 + m * 0.04, 1); }
    this.knackAlt = kn;

    ziel(this.kssGain.gain, z.kss ? 0.03 : 0, t, 0.2);
  };

  Klang.prototype.stille = function () {
    this.update({ n: 0, last: 0, schnitt: 0 });
    this.knackAlt = 0;
    this.klackAlt = 0;
  };

  // Werkzeugbruch: trockener Knall mit metallischem Nachklang
  Klang.prototype.bruch = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    burst(this, 0.22, 9000, 600, 0.9);
    ping(this.ctx, this.master, 2340, 0.7, 0.22, t);
    ping(this.ctx, this.master, 3871, 0.5, 0.16, t);
    ping(this.ctx, this.master, 5233, 0.35, 0.12, t);
    ping(this.ctx, this.master, 7410, 0.25, 0.08, t + 0.01);
  };

  Klang.prototype.kollision = function () {
    if (!this.bereit) { return; }
    var c = this.ctx, t = c.currentTime;
    burst(this, 0.6, 4000, 200, 1.0);
    var o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    var g = c.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
    ping(c, this.master, 1220, 1.2, 0.2, t + 0.02);
    ping(c, this.master, 1910, 0.9, 0.15, t + 0.02);
  };

  Klang.prototype.klick = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    ping(this.ctx, this.master, 1800, 0.05, 0.08, t);
  };

  Klang.prototype.alarm = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime, i;
    for (i = 0; i < 3; i++) {
      ping(this.ctx, this.master, 880, 0.12, 0.12, t + i * 0.25);
      ping(this.ctx, this.master, 660, 0.12, 0.12, t + i * 0.25 + 0.12);
    }
  };

  Klang.prototype.erfolg = function () {
    if (!this.bereit) { return; }
    var t = this.ctx.currentTime;
    ping(this.ctx, this.master, 523, 0.5, 0.12, t);
    ping(this.ctx, this.master, 659, 0.5, 0.12, t + 0.1);
    ping(this.ctx, this.master, 784, 0.8, 0.12, t + 0.2);
  };

  ZM.Klang = Klang;
})(typeof window !== 'undefined' ? window : globalThis);
