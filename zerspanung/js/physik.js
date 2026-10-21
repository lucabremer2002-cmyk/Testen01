/*
 * Prozessphysik fuer Bohren, Reiben, Gewindebohren, Drehen und Fraesen.
 *
 * Verwendete Modelle (jeweils die in Ausbildung und Praxis ueblichen):
 *   - Schnittkraft nach Kienzle: kc = kc1.1 * h^-mc * Korrekturfaktoren
 *   - Bohrmoment M = kc * f * (ra^2 - ri^2) / 2, Vorschubkraft ueber Haupt- und
 *     Querschneide, Spanraumfuellung mit tiefenabhaengigem Abtransport
 *   - Bruch: Vergleichsspannung aus Torsion und Biegung (von Mises), Knicken
 *     nach Euler, Ermuedung oberhalb von 60 % der Bruchgrenze
 *   - Maschinennachgiebigkeit: Pinole/Gestell als Feder. Beim Durchbruch
 *     entspannt sie sich schlagartig und der Vorschub springt.
 *   - Verschleiss nach Taylor (vc * T^n = C) plus Warmhaertegrenze
 *   - Drehen: Durchbiegung des Werkstuecks (Kragtraeger bzw. eingespannt mit
 *     Reitstock), regeneratives Rattern mit Prozessdaempfung,
 *     Rauheit Rz = f^2 / (8 r), Waermeausdehnung des Werkstuecks
 *   - Fraesen: mittlere Spanungsdicke hm, Biegung des Schaftfraesers,
 *     Stabilitaetskarte (Lobes) fuer einen Einmassenschwinger,
 *     Umkehrspiel im Gleichlauf, Aufschweissen bei Aluminium
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  var DAT = ZM.daten;
  var DEG = Math.PI / 180;
  var T_UMG = 20;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sq(v) { return v * v; }
  function istHSS(stoffId) { return stoffId.indexOf('HSS') === 0; }
  function istVHM(stoffId) { return stoffId.indexOf('VHM') === 0; }

  // ------------------------------------------------------------------ Zufall
  function Zufall(seed) {
    this.s = (seed >>> 0) || 1;
  }
  Zufall.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Zufall.prototype.gauss = function () {
    var u = 0;
    while (u === 0) { u = this.next(); }
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  };

  // -------------------------------------------------------- Grundmodelle
  function kcKienzle(mat, h) {
    return mat.kc11 * Math.pow(Math.max(h, 0.004), -mat.mc);
  }

  // Spanwinkelkorrektur: je Grad Abweichung vom Bezugsspanwinkel 1,5 %
  function kGamma(mat, gamma) {
    return clamp(1 - 0.015 * (gamma - mat.gamma0), 0.7, 1.3);
  }

  // Schnittgeschwindigkeitskorrektur: bei kleiner vc steigt kc an
  function kV(vc, stoffId) {
    var ref = istHSS(stoffId) ? 20 : 100;
    return clamp(Math.pow(ref / Math.max(vc, 1), 0.07), 0.88, 1.25);
  }

  // Aufbauschneide: tritt in einem vc-Band auf, darueber wird es zu heiss dafuer
  function aufbauschneide(mat, vc, stoffId, kssDef) {
    var mitte = istHSS(stoffId) ? 12 : 45;
    if (mat.iso === 'N') { mitte = istHSS(stoffId) ? 25 : 90; }
    var x = (vc - mitte) / (mitte * 0.7);
    var b = mat.aufbau * Math.exp(-x * x) * kssDef.bue;
    if ((stoffId === 'HMPOL' || stoffId === 'VHM') && mat.iso === 'N') { b *= 0.4; }
    return clamp(b, 0, 1);
  }

  function sortenVc(sorte) {
    return { P15: 1.1, P25: 1.0, P35: 0.85, M25: 1.0, K20: 1.0, N10: 1.0, S15: 1.0 }[sorte] || 1;
  }

  function sortenPassung(def, mat) {
    var t = DAT.sortenPassung[def.iso];
    return (t && t[mat.iso]) || [1, 1];
  }

  // Empfohlene Schnittgeschwindigkeit (m/min) fuer Werkzeug und Werkstoff
  function vcRef(mat, def) {
    var st = DAT.schneidstoffe[def.stoff];
    var vhm = istVHM(def.stoff);
    switch (def.typ) {
      case 'bohrer': return (vhm ? mat.vc.bohrVHM : mat.vc.bohrHSS) * st.vcF;
      case 'reibahle': return vhm ? mat.vc.reibVHM : mat.vc.reibHSS * st.vcF;
      case 'gewinde': return mat.vc.gewHSS * st.vcF;
      case 'platte': return mat.vc.drehHM * sortenPassung(def, mat)[1] * sortenVc(def.sorte);
      case 'fraeser': return (vhm ? mat.vc.fraesVHM : mat.vc.fraesHSS) * st.vcF;
    }
    return 30;
  }

  // Empfohlener Vorschub je Umdrehung (Bohren/Reiben) bzw. je Zahn (Fraesen)
  function fRef(mat, def) {
    switch (def.typ) {
      case 'bohrer': return DAT.bohrVorschub(def.d, mat, istVHM(def.stoff));
      case 'reibahle': return 0.1 * Math.sqrt(def.d) * mat.fF;
      case 'gewinde': return def.P;
      case 'fraeser':
        return (istVHM(def.stoff) ? 0.006 : 0.004) * def.d * Math.pow(mat.fF, 0.7) * (def.z <= 2 ? 1.3 : 1);
    }
    return 0.1;
  }

  function standzeitMin(vc, ref, invN, tRef) {
    return tRef * Math.pow(ref / Math.max(vc, 0.5), invN);
  }

  // Stationaere Schneidentemperatur (empirisch, kalibriert an HSS/Stahl)
  function tempStat(mat, vc, h, proz, kTemp) {
    return T_UMG + 160 * proz * mat.therm * Math.pow(Math.max(vc, 0), 0.45) *
      Math.pow(Math.max(h, 0.005), 0.2) * kTemp;
  }

  // Warmfestigkeit: oberhalb der Erweichungstemperatur sinkt die Festigkeit
  function heissFaktor(T, tSoft) {
    return T > tSoft ? 1 - 0.5 * Math.min(1, (T - tSoft) / 250) : 1;
  }

  function verschleissThermisch(T, tSoft) {
    return T > tSoft ? Math.min(400, Math.exp((T - tSoft) / 30)) : 1;
  }

  // Anlauffarbe von Stahl nach Temperatur (fuer Spaene und Werkzeug)
  function anlaufFarbe(T, basis) {
    if (T < 200) { return basis; }
    if (T < 240) { return '#d9bd6a'; }
    if (T < 270) { return '#b87d3e'; }
    if (T < 295) { return '#8a4f86'; }
    if (T < 330) { return '#3d5fae'; }
    if (T < 400) { return '#5d7895'; }
    if (T < 600) { return '#7b8790'; }
    if (T < 750) { return '#a04030'; }
    return '#e0602a';
  }

  // ------------------------------------------------------- Werkzeugzustand
  function Werkzeug(def, rng) {
    this.def = def;
    this.stoff = DAT.schneidstoffe[def.stoff] || DAT.schneidstoffe.HMCVD;
    this.VB = 0;
    this.T = T_UMG;
    this.maxT = T_UMG;
    this.schaden = 0;
    this.festigkeit = clamp(1 + 0.05 * rng.gauss(), 0.86, 1.12);
    this.gebrochen = false;
    this.bruch = null;
    this.verbogen = 0;
    this.ausbruch = 0;
    this.aufschweiss = 0;
    this.einsatz = 0;
    this.ecke = 1;
    this.ecken = def.ecken || 1;
    this.kosten = def.typ === 'platte' ? def.preis / def.ecken : def.preis;
  }

  // Gemeinsame Bruchpruefung: Vergleichsspannung gegen Festigkeit,
  // oberhalb von 60 % sammelt sich Ermuedungsschaden an.
  function belastung(w, sigmaV, dt, T) {
    var allow = w.stoff.sigma * w.festigkeit * (1 - 0.45 * w.schaden) * heissFaktor(T, w.stoff.tSoft);
    var r = sigmaV / allow;
    if (r > 0.6) {
      w.schaden += dt * 1.6 * Math.pow((r - 0.6) / 0.4, 3) / Math.sqrt(w.stoff.zaeh);
    }
    return r;
  }

  function Ereignisse() {
    this.liste = [];
    this.letzte = {};
  }
  Ereignisse.prototype.add = function (zeit, typ, text, schwere, daten) {
    this.liste.push({ zeit: zeit, typ: typ, text: text, schwere: schwere || 'info', daten: daten || null });
  };
  // Nur alle "pause" Sekunden ein Ereignis desselben Typs
  Ereignisse.prototype.einmalig = function (zeit, typ, text, schwere, pause, daten) {
    if (this.letzte[typ] !== undefined && zeit - this.letzte[typ] < (pause || 4)) { return; }
    this.letzte[typ] = zeit;
    this.add(zeit, typ, text, schwere, daten);
  };
  Ereignisse.prototype.holen = function () {
    var l = this.liste;
    this.liste = [];
    return l;
  };

  function nf(v, s) {
    return v.toFixed(s === undefined ? 1 : s).replace('.', ',');
  }

  // =====================================================================
  //                         BOHREN, REIBEN, GEWINDEBOHREN
  // =====================================================================
  //
  // Koordinate z: Werkzeugspitze, 0 = Werkstueckoberflaeche, positiv nach unten.
  //
  function BohrSim(o) {
    var def = o.wkz.def;
    this.mat = o.mat;
    this.w = o.wkz;
    this.def = def;
    this.m = o.masch;
    this.p = o.param;
    this.op = o.op;
    this.rng = o.rng;
    this.vor = o.vor || [];
    this.kssDef = DAT.kss[this.p.kss] || DAT.kss.trocken;
    this.spann = DAT.spannmittel[this.p.spann || 'fest'];
    this.typ = def.typ;
    this.R = def.d / 2;
    this.vhm = istVHM(def.stoff);

    if (this.typ === 'bohrer') {
      this.kappa = def.spitze / 2 * DEG;
      this.zs = 2;
      this.rch = def.ausgespitzt ? (this.vhm ? 0.03 : 0.035) * def.d : 0.09 * def.d;
      this.gamma = this.vhm ? 8 : 12;
      this.prozK = 1.2;
      this.wp = (this.vhm ? 0.045 : 0.03) * Math.pow(def.d, 3);
      this.wb = (this.vhm ? 0.07 : 0.05) * Math.pow(def.d, 3);
      this.I = (this.vhm ? 0.028 : 0.02) * Math.pow(def.d, 4);
    } else if (this.typ === 'reibahle') {
      this.kappa = 45 * DEG;
      this.zs = def.z;
      this.rch = 0;
      this.gamma = 4;
      this.prozK = 1.1;
      this.wp = 0.08 * Math.pow(def.d, 3);
      this.wb = 0.09 * Math.pow(def.d, 3);
      this.I = 0.04 * Math.pow(def.d, 4);
    } else {
      this.kappa = 90 * DEG;
      this.zs = def.nuten;
      this.rch = 0;
      this.gamma = 8;
      this.prozK = 1.0;
      this.wp = def.mBruch / 1650;
      this.wb = 0.05 * Math.pow(def.d, 3);
      this.I = 0.02 * Math.pow(def.d, 4);
    }
    this.tanK = Math.tan(this.kappa);
    this.sinK = Math.sin(this.kappa);
    this.lp = this.typ === 'bohrer' ? this.R / this.tanK : 0;
    this.vcRef = vcRef(this.mat, def);
    this.fRef = fRef(this.mat, def);
    this.kMasch = this.m.kSteif;
    this.kGam = kGamma(this.mat, this.gamma);
    this.mBruchNmm = this.typ === 'gewinde' ? def.mBruch : this.w.stoff.tau * this.wp;

    this.dicke = this.op.dicke;
    this.durch = !!this.op.durch;
    this.zeit = 0;
    this.n = 0;
    this.nEff = 0;
    this.richtung = 1;
    this.M = 0;
    this.ev = new Ereignisse();
    this.ergebnisse = [];
    this.idx = 0;
    this.unfall = null;
    this.alarm = null;
    this.fertig = false;
    this.ladeLoch(0);
  }

  BohrSim.prototype.ladeLoch = function (i) {
    var v = this.vor[i] || null;
    this.idx = i;
    this.vorLoch = v;
    this.r0 = v && !v.bruchstueck ? v.d / 2 : 0;
    this.vorDurch = v ? !!v.durch : false;
    this.vorTiefe = v ? (v.durch ? 1e9 : v.tiefe) : 0;
    this.vorSpitze = v ? (v.durch ? 1e9 : v.spitze) : 0;
    this.z = -8;
    this.zQ = -8;
    this.F = 0;
    this.zMax = 0;
    this.phi = 0;
    this.lambdaBruch = 0;
    this.hart = null;
    this.f = 0;
    this.M = 0;
    this.Pc = 0;
    this.sigmaR = 0;
    this.lochZeit = 0;
    this.schnittZeit = 0;
    this.durchbruch = false;
    this.autoAus = false;
    this.richtung = 1;
    this.gew = { phase: 'bereit', zMax: 0, spanB: 0, rutscht: false, steckt: false, umsteuer: false };
    this.zyk = null;
    this.st = {
      maxM: 0, maxF: 0, maxT: this.w.T, maxPhi: 0, maxR: 0, fSum: 0, fN: 0, bueSum: 0, bueN: 0,
      fAustritt: 0, rueckwaerts: false, stillstand: false, rubZeit: 0, walk: 0, kratzer: 0,
      gestartet: false, handJitter: 0, hartZeit: 0
    };
    // Lagefehler: Positionierverfahren + Verlaufen beim Anbohren
    var pos = DAT.positionierung[this.p.pos || 'anreissen'];
    var sigma = v ? 0 : pos.sigma;
    this.lageX = v ? v.lageX : sigma * this.rng.gauss();
    this.lageY = v ? v.lageY : sigma * this.rng.gauss();
    this.zentriert = !!(v || this.p.anbohren || pos.koerner);
    this.sitzKoerner = this.p.anbohren ? 99 : (pos.koerner ? 1.4 : 0);
  };

  // Welche Schneidenbereiche sind bei Spitzenlage z im Eingriff?
  BohrSim.prototype.eingriff = function (z) {
    var g = { aktiv: false, rIn: 0, rOut: 0, meissel: false, tiefe: 0 };
    if (z <= this.zMax + 1e-7 || z <= 0) { return g; }
    var R = this.R;
    if (this.typ === 'reibahle') {
      var fase = Math.max(0.05, R - this.r0);
      g.rIn = this.r0;
      g.rOut = this.r0 + (R - this.r0) * Math.min(1, z / fase);
      if (this.durch && z - fase > this.dicke) { g.rOut = 0; }
      else if (this.durch && z > this.dicke) {
        g.rIn = Math.max(g.rIn, this.r0 + (z - this.dicke));
      }
    } else {
      g.rOut = Math.min(R, z * this.tanK);
      if (this.durch) { g.rIn = Math.max(0, (z - this.dicke) * this.tanK); }
      if (this.r0 > 0) {
        var lippe = z - this.r0 / this.tanK;
        if (this.vorDurch || lippe < this.vorTiefe) { g.rIn = Math.max(g.rIn, this.r0); }
      }
      g.meissel = g.rIn < this.rch && (!this.durch || z < this.dicke);
    }
    g.aktiv = g.rOut > g.rIn + 1e-6;
    g.tiefe = Math.min(z, this.durch ? this.dicke : z);
    return g;
  };

  // z, ab dem neues Material beruehrt wird
  BohrSim.prototype.kontaktZ = function () {
    var zk = this.zMax;
    if (this.typ === 'bohrer' && this.r0 > 0) { zk = Math.max(zk, this.r0 / this.tanK); }
    return Math.max(zk, 0);
  };

  // Gemeinsamer Kraftfaktor K: kc = K * h^-mc
  BohrSim.prototype.kFaktor = function (kd, vc) {
    var kver = 1 + 1.3 * this.w.VB + 0.6 * this.w.ausbruch;
    var kh = 1;
    if (this.hart && this.z > this.hart.von && this.z < this.hart.bis) { kh = 1 + 0.35 * this.mat.verfest; }
    return this.mat.kc11 * this.kGam * kd.kc * this.prozK * kver * kh * kV(vc, this.def.stoff);
  };

  // Schubkoeffizient A in F = A * f^(1-mc)
  BohrSim.prototype.schubA = function (g, K) {
    var mc = this.mat.mc;
    var basis = K * Math.pow(this.sinK / this.zs, -mc);
    var zieht = 0;
    if (this.typ === 'bohrer' && g.rIn > 0 && !g.meissel) {
      zieht = this.mat.zieht * (this.def.spitze >= 130 ? 0.75 : 0.9) * clamp(1 - (g.rOut - g.rIn) / this.R * 0.5, 0, 1);
    }
    var lippe = (this.typ === 'reibahle' ? 0.6 : 0.5) * (g.rOut - g.rIn) * this.sinK * (1 - zieht);
    var meissel = g.meissel ? 1.0 * 2 * this.rch : 0;
    return basis * Math.max(lippe + meissel, 0.002 * this.R);
  };

  BohrSim.prototype.reibKraft = function (tiefe) {
    if (this.typ === 'reibahle') { return 30 + 6 * tiefe; }
    return 0.4 * tiefe * this.def.d / 6;
  };

  BohrSim.prototype.spindel = function (dt, nSoll, notaus) {
    var m = this.m;
    var nNenn = this.p.n;
    var a = Math.max(nNenn, 200) / m.hochlauf;
    if (this.n < nSoll) { this.n = Math.min(nSoll, this.n + a * dt); }
    else if (this.n > nSoll) { this.n = Math.max(nSoll, this.n - a * (notaus ? 4 : 1.2) * dt); }
    // Lastabfall und Riemenschlupf aus dem Moment des letzten Schritts
    var mNm = this.M / 1000;
    if (m.cnc) {
      this.mVerf = Math.min(m.mMax, 9550 * m.P / Math.max(this.n, 50));
      if (mNm > this.mVerf * 1.25 && this.n > 10) {
        this.alarmSetzen('Spindel-Überlast (' + nf(mNm) + ' Nm). Die Steuerung hat den Vorschub angehalten.');
      }
      this.nEff = this.n * (1 - 0.01 * Math.min(1, mNm / this.mVerf));
    } else {
      var mNenn = 9550 * m.P * m.eta / Math.max(nNenn, 1);
      this.mVerf = mNenn;
      var mRutsch = mNenn * m.riemen;
      if (mNm > mRutsch && this.n > 1) {
        this.n = Math.max(0, this.n - (mNm / mRutsch - 1) * nNenn * 4 * dt);
        this.ev.einmalig(this.zeit, 'riemen', 'Der Keilriemen rutscht – das Moment (' + nf(mNm) +
          ' Nm) ist größer, als der Antrieb bei ' + nNenn + ' 1/min übertragen kann.', 'warn', 3);
      }
      this.nEff = this.n * (1 - 0.05 * Math.min(1, mNm / mNenn));
    }
  };

  BohrSim.prototype.alarmSetzen = function (text) {
    if (this.alarm) { return; }
    this.alarm = text;
    this.ev.add(this.zeit, 'alarm', text, 'warn');
    if (this.zyk) { this.zyk.halt = true; }
  };

  BohrSim.prototype.step = function (dt, inp) {
    if (this.unfall || this.fertig) { return; }
    var m = this.m, w = this.w, mat = this.mat, def = this.def;
    this.zeit += dt;
    this.lochZeit += dt;

    var kssAn = !!inp.kss && this.p.kss !== 'trocken';
    var kd = kssAn ? this.kssDef : DAT.kss.trocken;
    if (this.p.kss === 'ikz' && !def.ikz && kssAn) { kd = DAT.kss.emulsion; }

    var notaus = !!inp.notaus;
    var nSoll = (inp.spindel && !notaus && !w.gebrochen) ? this.p.n * (inp.ovS || 1) : 0;
    if (this.alarm && m.cnc) { nSoll = inp.spindel && !notaus ? nSoll : 0; }
    this.spindel(dt, nSoll, notaus);
    var nRev = this.nEff / 60;
    var vc = Math.PI * def.d * this.nEff / 1000;

    // ---------------------------------------------- Pinole / Vorschub
    var vQ;
    if (this.typ === 'gewinde') {
      this.stepGewinde(dt, inp, kd, nRev, vc, notaus);
      return;
    }
    if (m.cnc) {
      vQ = this.zyklusSteuerung(dt, inp, nRev);
    } else if (inp.auto && m.vorschuebe && !this.autoAus) {
      vQ = nRev > 0.05 ? this.p.fAuto * nRev : 0;
      if (this.F > m.maxSchub) {
        vQ = 0;
        this.ev.einmalig(this.zeit, 'kupplung', 'Die Überlastkupplung des Vorschubgetriebes rutscht (Vorschubkraft ' +
          Math.round(this.F) + ' N).', 'warn', 3);
      }
    } else {
      var kraft = inp.kraft || 0;
      var Fh = kraft > 0 ? kraft * m.handkraft : kraft * 900;
      vQ = clamp((Fh - 60 - this.F) / 20, -120, 80);
      if (kraft > 0.02 && this.F > 50) {
        this.st.handJitter += dt;
      }
    }
    if (notaus && !m.cnc) { vQ = Math.min(vQ, 0); }

    var zQneu = this.zQ + vQ * dt;
    zQneu = Math.max(zQneu, -10);
    if (!m.cnc && this.p.zAnschlag !== null && this.p.zAnschlag !== undefined && zQneu >= this.p.zAnschlag) {
      zQneu = this.p.zAnschlag;
      if (inp.auto && !this.autoAus) {
        this.autoAus = true;
        this.ev.add(this.zeit, 'anschlag', 'Tiefenanschlag erreicht – der automatische Vorschub ist ausgekuppelt.', 'info');
      }
    }

    // ---------------------------------------------- Werkzeugbewegung
    var zk = this.kontaktZ();
    var g = this.eingriff(Math.max(this.z, zk) + 1e-4);
    var imSchnitt = false;
    var fIst = 0;
    var fKraft = 0;
    if (w.gebrochen) {
      this.z = Math.min(zQneu, this.z < this.zMax ? zQneu : this.z);
      this.zQ = zQneu;
      this.F = 0;
      if (this.z < this.zMax) { this.z = zQneu; }
      this.M = 0;
      this.abkuehlen(dt, kd, false);
      return;
    }
    if (this.z < zk && zQneu > zk && g.aktiv) {
      // Aufsetzen: Werkzeug bleibt an der Kontaktstelle, die Feder wird gespannt
      this.z = zk;
      this.F = this.kMasch * (zQneu - zk);
    } else if (!g.aktiv || zQneu <= this.z || this.z < zk) {
      this.z = zQneu;
      this.F = 0;
    } else {
      imSchnitt = true;
    }

    var K = this.kFaktor(kd, vc);
    var mc = mat.mc;
    var tiefe = clamp(this.z, 0, this.durch ? this.dicke : 1e9);
    var Freib = this.reibKraft(tiefe);
    var Fspan = 0;
    var A = 1;
    if (imSchnitt) {
      g = this.eingriff(this.z + 1e-4);
      A = this.schubA(g, K);
      var Fk = Math.max(0, this.kMasch * (zQneu - this.z));
      Fspan = this.spanSchub(tiefe);
      var Fnetto = Fk - Freib - Fspan;
      fKraft = Fnetto > 0 ? Math.pow(Fnetto / A, 1 / (1 - mc)) : 0;
      fKraft = Math.min(fKraft, 2.5);
      var dz = fKraft * nRev * dt;
      if (this.z + dz > zQneu) { dz = Math.max(0, zQneu - this.z); }
      this.z += dz;
      this.F = Math.max(0, this.kMasch * (zQneu - this.z));
      fIst = nRev > 0.02 ? dz / (nRev * dt) : 0;
      if (this.z > this.zMax) { this.zMax = this.z; }
      g = this.eingriff(this.z - dz * 0.5 + 1e-5);
      if (!g.aktiv) { g = this.eingriff(this.zMax - 1e-4 + 2e-4); }
    }
    this.zQ = zQneu;
    this.f = fIst;
    // Wo das Werkzeug frei hinkommt, ist kein Werkstoff mehr (z. B. nach dem Durchbruch)
    if (this.z > this.zMax && this.z > 0) { this.zMax = this.z; }

    // ---------------------------------------------- Momente und Kraefte
    var R = this.R;
    var fMom = nRev > 0.02 ? Math.max(fIst, nRev < 2 ? fKraft : 0) : 0;
    var kcf = K * Math.pow(this.sinK / this.zs, -mc) * Math.pow(Math.max(fMom, 1e-6), 1 - mc);
    var Mcut = (imSchnitt && fMom > 1e-5) ? kcf * (sq(g.rOut) - sq(g.rIn)) / 2 : 0;
    var fBez = Math.max(fMom, this.fRef * 0.5);
    var Mref = K * Math.pow(this.sinK / this.zs, -mc) * Math.pow(fBez, 1 - mc) * sq(R) / 2;
    var inLoch = this.z > 0.2;
    var Mspan = inLoch && nRev > 0.02 ? Mref * 5 * sq(Math.max(0, this.phi - 0.55)) * (tiefe / def.d) : 0;
    if (this.phi > 1.6) { Mspan *= 1 + 10 * (this.phi - 1.6); }
    var Mland = inLoch && nRev > 0.02 ? Mref * 0.012 * (tiefe / def.d) * kd.reib * (1 + 3 * w.VB) : 0;
    if (this.typ === 'reibahle' && inLoch && nRev > 0.02) { Mland *= 4; }
    var Mges = Mcut + Mspan + Mland;
    this.Mteile = { cut: Mcut, span: Mspan, land: Mland };
    var mRutschNmm = m.cnc ? 1e12 : 9550 * m.P * m.eta / this.p.n * m.riemen * 1000;
    var Mwkz = Math.min(Mges, mRutschNmm * 1.05);
    this.M = Mwkz;
    var Ff = this.F;
    this.Pc = Mwkz / 1000 * this.nEff / 9550;
    this.vc = vc;

    // Reiben ohne Span: unter etwa 0,005 mm Spanungsdicke drueckt die Schneide nur
    var h = fMom / this.zs * this.sinK;
    var rubbing = imSchnitt && nRev > 0.05 && h < 0.004;
    if (inLoch && nRev > 0.05 && !imSchnitt && this.z >= this.zMax - 0.02 && this.F > 5) { rubbing = true; }
    if (rubbing) {
      this.st.rubZeit += dt;
      if (mat.verfest > 0.2 && (!this.hart || this.hart.bis < this.z + 0.02)) {
        this.hart = { von: this.z - 0.01, bis: this.z + 0.06 + 0.06 * mat.verfest };
      }
    }
    if (this.hart && this.z > this.hart.von && this.z < this.hart.bis && imSchnitt) {
      this.st.hartZeit += dt;
    }

    // ---------------------------------------------- Spanraum
    this.spanraum(dt, imSchnitt, fIst, tiefe, kd);

    // ---------------------------------------------- Temperatur und Verschleiss
    var schneidet = imSchnitt && nRev > 0.05;
    var bue = schneidet ? aufbauschneide(mat, vc, def.stoff, kd) : 0;
    var kTemp = kd.temp;
    if (kssAn && this.p.kss === 'emulsion') {
      kTemp = 1 - (1 - kd.temp) * Math.exp(-tiefe / (2 * def.d));
    }
    if (kssAn && this.p.kss === 'oel') {
      kTemp = 1 - (1 - kd.temp) * Math.exp(-tiefe / (3 * def.d));
    }
    if (schneidet || rubbing) {
      var hT = Math.max(h, 0.006);
      var Tss = tempStat(mat, vc, hT, this.typ === 'bohrer' ? 1.0 : 0.85, kTemp);
      Tss += 230 * w.VB + 160 * Math.max(0, this.phi - 0.5) + 100 * w.ausbruch;
      if (rubbing) { Tss += 140 * clamp(vc / this.vcRef, 0.3, 2.5); }
      w.T += (Tss - w.T) * Math.min(1, dt / 1.1);
      var vcRefK = this.vcRef;
      var tL = standzeitMin(vc, vcRefK, w.stoff.invN, this.typ === 'bohrer' ? 20 : 30);
      var dVB = 0.3 / (tL * 60) * Math.pow(Math.max(fMom, 0.01) / this.fRef, 0.4) * mat.abr *
        verschleissThermisch(w.T, w.stoff.tSoft) * (rubbing ? 3 : 1);
      if (this.hart && this.z > this.hart.von && this.z < this.hart.bis) { dVB *= 2.5; }
      if (istHSS(def.stoff) && (mat.iso === 'M' || mat.iso === 'S') && def.stoff === 'HSS') { dVB *= 1.8; }
      w.VB = Math.min(1.2, w.VB + dVB * dt);
      w.einsatz += dt;
      this.schnittZeit += dt;
      if (schneidet) {
        this.st.fSum += fIst;
        this.st.fN += 1;
        this.st.bueSum += bue;
        this.st.bueN += 1;
      }
    } else {
      this.abkuehlen(dt, kd, inLoch);
    }
    if (w.T > w.maxT) { w.maxT = w.T; }
    if (mat.brennbar && schneidet && kd.kuehl === 0 && w.T > 820) {
      this.unfallSetzen('brand', 'Spänebrand! Die trockenen Titanspäne haben sich bei ' + Math.round(w.T) +
        ' °C entzündet. Maschine aus, Metallbrandlöscher (Klasse D) – niemals Wasser. Titan nur mit reichlich Kühlung bohren.');
      return;
    }
    if (w.T > w.stoff.tSoft + 140 && istHSS(def.stoff)) {
      this.ev.einmalig(this.zeit, 'ausgegluht', 'Die Schneidenecken glühen aus (' + Math.round(w.T) +
        ' °C). HSS verliert über ca. ' + w.stoff.tSoft + ' °C seine Härte.', 'warn', 6);
    }

    // ---------------------------------------------- Belastung des Werkzeugs
    var tau = Mwkz / this.wp;
    var Fe = this.knicklast();
    var asym = this.asymmetrie(g);
    var Flat = asym * Ff + (m.rundlauf + w.verbogen) * (this.vhm ? 900 : 400) * (inLoch ? 1 : 0);
    var verst = Ff < 0.97 * Fe ? 1 / (1 - Ff / Fe) : 30;
    var Mb = Flat * def.frei * verst;
    var sigB = Mb / this.wb;
    var sigV = Math.sqrt(sq(sigB) + 3 * sq(tau));
    // Hartmetall ist schlagempfindlich: Momentenspruenge wirken staerker
    var dMrel = this.Mvorher ? Math.abs(Mwkz - this.Mvorher) / Math.max(this.Mvorher, 200) : 0;
    this.Mvorher = Mwkz;
    var dyn = 1 + (1 - w.stoff.zaeh) * (0.06 + Math.min(0.5, dMrel * 3));
    var r = belastung(w, sigV * dyn, dt, w.T);
    this.sigmaR = r;
    this.knickR = Ff / Fe;
    if (sigB > 0.8 * w.stoff.sigma && istHSS(def.stoff) && !w.gebrochen && w.verbogen < 0.15) {
      w.verbogen += 0.05;
      this.ev.einmalig(this.zeit, 'verbogen', 'Der Bohrer hat sich verbogen – er läuft jetzt sichtbar unrund.', 'warn', 3);
    }

    // Statistik
    var st = this.st;
    if (Mwkz > st.maxM) { st.maxM = Mwkz; }
    if (Ff > st.maxF) { st.maxF = Ff; }
    if (w.T > st.maxT) { st.maxT = w.T; }
    if (this.phi > st.maxPhi) { st.maxPhi = this.phi; }
    if (r > st.maxR) { st.maxR = r; }
    if (this.z > 0.3 && this.nEff < 5 && this.F > 0) { st.stillstand = true; }
    if (schneidet) { st.gestartet = true; }

    // Durchbruch
    if (this.durch && this.typ === 'bohrer' && !this.durchbruch && this.z > this.dicke && imSchnitt) {
      this.durchbruch = true;
      st.fAustritt = fIst;
      this.ev.add(this.zeit, 'durchbruch', 'Durchbruch bei z = ' + nf(this.z, 2) + ' mm' +
        (fIst > 2 * this.fRef ? ' – der Vorschub ist dabei auf ' + nf(fIst, 2) + ' mm/U hochgeschnellt!' : '.'), fIst > 2 * this.fRef ? 'warn' : 'info');
    }
    if (this.durchbruch && imSchnitt && fIst > st.fAustritt) { st.fAustritt = fIst; }

    // Werkstueck reisst mit?
    var mNm = Mwkz / 1000;
    if (mNm > this.spann.mHalt && this.spann.unfall) {
      this.unfallSetzen('mitgerissen', 'Das Werkstück wurde vom Bohrer mitgerissen (' + nf(mNm) + ' Nm, Haltemoment ' +
        nf(this.spann.mHalt, 0) + ' Nm). Ein rotierendes Blech oder ein fliegender Schraubstock verletzt schwer. ' +
        'Werkstücke beim Bohren immer festspannen!');
      return;
    }

    if (w.schaden >= 1 || r >= 1) {
      this.bruch(this.bruchUrsache(r, tau, sigB, Ff, Fe, mNm, fIst), mNm);
    }
  };

  BohrSim.prototype.abkuehlen = function (dt, kd, inLoch) {
    var w = this.w;
    var tau = kd.kuehl > 0 ? (inLoch ? 3.5 : 1.8) / kd.kuehl : (inLoch ? 10 : 7);
    w.T += (T_UMG - w.T) * Math.min(1, dt / tau);
  };

  // Spanraumfuellung phi (0 = leer, 1 = voll, darueber verdichtet)
  BohrSim.prototype.spanraum = function (dt, schneidet, f, tiefe, kd) {
    var d = this.def.d;
    var mat = this.mat;
    var lam = mat.span === 'lang' ? 1.0 : mat.span === 'mittel' ? 0.7 : 0.35;
    var le = (mat.span === 'lang' ? 2.6 : mat.span === 'mittel' ? 4 : 7) * kd.le;
    if (this.vhm) { le *= 1.15; }
    if (this.typ === 'reibahle') { lam *= 0.25; le *= 2; }
    if (mat.kleben > 0.5 && kd.schmier < 0.3) { lam *= 1.5; le *= 0.8; }
    // Spanbruchzyklus verkuerzt die Spaene voruebergehend
    if (this.lambdaBruch > 0) { lam *= 0.65; this.lambdaBruch = Math.max(0, this.lambdaBruch - dt); }
    var rel = tiefe / (d * le);
    if (this.z < -0.5) {
      this.phi += (0 - this.phi) * Math.min(1, dt / 0.25);
    } else if (schneidet && f > 0.002) {
      var ziel = 10 * (f / d) * lam * (1 + rel * rel * rel);
      var tau = 0.5 + 0.25 * tiefe / d;
      this.phi += (ziel - this.phi) * Math.min(1, dt / tau);
    } else if (this.nEff > 20) {
      var tauE = 0.6 * (1 + rel * rel);
      this.phi += (0 - this.phi) * Math.min(1, dt / tauE);
    }
    if (this.phi < 0) { this.phi = 0; }
  };

  BohrSim.prototype.spanSchub = function (tiefe) {
    return 0.3 * this.R * 0.0 + (this.phi > 0.55 ? 120 * this.def.d * sq(this.phi - 0.55) * (tiefe / this.def.d) : 0);
  };

  BohrSim.prototype.knicklast = function () {
    var w = this.w;
    var beta = (this.z > this.lp + 0.5 || (this.zentriert && this.z > 0)) ? 0.7 : 2.0;
    if (this.z > 2 * this.def.d) { beta = 0.5; }
    var L = this.def.frei;
    return Math.PI * Math.PI * w.stoff.E * this.I / sq(beta * L);
  };

  // Querkraftanteil beim Anbohren (Verlaufen) als Bruchteil der Vorschubkraft
  BohrSim.prototype.asymmetrie = function (g) {
    var basis = this.vhm ? 0.015 : 0.04;
    if (this.typ !== 'bohrer') { return basis * 0.5; }
    if (this.z > this.lp + 0.3 || this.r0 > this.rch * 1.2) { return basis; }
    var quer = 2 * this.rch;
    var walk;
    if (this.sitzKoerner > 50) { walk = 0; }
    else if (this.sitzKoerner > 0) { walk = quer > this.sitzKoerner ? 0.12 * (quer - this.sitzKoerner) / quer : 0.01; }
    else { walk = this.def.ausgespitzt ? 0.06 : 0.15; }
    if (this.z > 0 && this.z < this.lp) { this.st.walk = Math.max(this.st.walk, walk); }
    return basis + walk;
  };

  BohrSim.prototype.bruchUrsache = function (r, tau, sigB, Ff, Fe, mNm, f) {
    var st = this.st, w = this.w, d = this.def.d;
    var tiefe = clamp(this.z, 0, this.durch ? this.dicke : 1e9);
    var mBruch = this.mBruchNmm / 1000 * w.festigkeit;
    var mt = this.Mteile || { cut: 1, span: 0, land: 0 };
    var spanAnteil = mt.span / Math.max(1, mt.cut + mt.span + mt.land);
    var u = { art: 'torsion', text: '' };
    var manuell = !this.m.cnc;
    if (Ff > 0.9 * Fe) {
      u.art = 'knickung';
      u.text = 'Ausgeknickt: Vorschubkraft ' + Math.round(Ff) + ' N bei einer Knicklast von nur ' + Math.round(Fe) +
        ' N. Lange, dünne Bohrer brauchen eine Zentrierung und wenig Druck.';
    } else if (spanAnteil > 0.4 || this.phi > 1.05) {
      u.art = 'spaene';
      u.text = 'Spänestau: Bei ' + nf(tiefe / d, 1) + '×D Bohrtiefe waren die Spannuten zu ' + Math.round(this.phi * 100) +
        ' % gefüllt. Die verdichteten Späne lieferten ' + Math.round(spanAnteil * 100) + ' % des Drehmoments von ' + nf(mNm, 2) +
        ' Nm (Bruchmoment ≈ ' + nf(mBruch, 2) + ' Nm). Abhilfe: alle 1–2×D entspanen oder einen Bohrer mit IKZ nehmen.';
    } else if (this.durchbruch && f > 2 * this.fRef) {
      u.art = 'durchbruch';
      u.text = 'Bruch beim Durchbruch: Die elastisch vorgespannte Pinole hat sich entspannt, der Vorschub sprang auf ' +
        nf(f, 2) + ' mm/U und das Moment auf ' + nf(mNm, 2) + ' Nm. Kurz vor dem Austritt den Druck zurücknehmen.';
    } else if (w.T > w.stoff.tSoft + 60) {
      u.art = 'hitze';
      u.text = 'Überhitzt: ' + Math.round(w.T) + ' °C an der Schneide. Die Schneiden sind ausgeglüht, der Bohrer hat sich festgefressen. ' +
        'Schnittgeschwindigkeit ' + Math.round(this.vc) + ' m/min statt ca. ' + Math.round(this.vcRef) + ' m/min.';
    } else if (w.VB > 0.45) {
      u.art = 'verschleiss';
      u.text = 'Verschleißbruch: Verschleißmarke VB = ' + nf(w.VB, 2) + ' mm. Stumpfe Schneiden erhöhen Moment und Vorschubkraft, bis der Bohrer aufgibt.';
    } else if (f > 1.8 * this.fRef) {
      u.art = 'vorschub';
      u.text = (manuell ? 'Zu viel Druck auf dem Hebel: ' + Math.round(Ff) + ' N Vorschubkraft ergaben f = ' : 'Zu viel Vorschub: f = ') +
        nf(f, 2) + ' mm/U, empfohlen sind etwa ' + nf(this.fRef, 2) + ' mm/U. Moment ' + nf(mNm, 2) + ' Nm, Bruchmoment ≈ ' + nf(mBruch, 2) + ' Nm.';
    } else if (sigB > 0.6 * Math.sqrt(3) * tau && sigB > 300) {
      u.art = 'biegung';
      u.text = 'Biegebruch: Der Bohrer ist beim Anbohren verlaufen und wurde seitlich belastet (' + Math.round(sigB) +
        ' N/mm²). Vorher körnen oder mit NC-Anbohrer zentrieren.' + (this.vhm ? ' Hartmetall verzeiht das nicht.' : '');
    } else if (w.schaden >= 1) {
      u.art = 'ermuedung';
      u.text = 'Ermüdungsbruch: Der Bohrer lief zu lange nahe an der Belastungsgrenze (max. ' + Math.round(st.maxR * 100) + ' %).';
    } else {
      u.text = 'Torsionsbruch bei ' + nf(mNm, 2) + ' Nm (Bruchmoment ≈ ' + nf(mBruch, 2) + ' Nm).';
    }
    return u;
  };

  BohrSim.prototype.bruch = function (u, mNm) {
    var w = this.w;
    if (w.gebrochen) { return; }
    w.gebrochen = true;
    var rest = this.typ === 'reibahle' ? 0 : clamp(this.z, 0, this.def.l2);
    var lage = clamp(this.z - Math.max(this.def.d * 0.7, Math.min(this.z * 0.6, this.def.l2 * 0.5)), -this.def.frei * 0.5, this.def.l2);
    w.bruch = { art: u.art, text: u.text, z: this.z, bruchstelle: Math.max(this.z - lage, this.def.d * 0.5), steckt: rest > 0 && this.z > 0 };
    this.M = 0;
    this.F = 0;
    var namen = { bohrer: 'Bohrerbruch', reibahle: 'Reibahle gebrochen', gewinde: 'Gewindebohrer gebrochen' };
    this.ev.add(this.zeit, 'bruch', u.text, 'fehler', { art: u.art, titel: namen[this.typ], m: mNm });
  };

  BohrSim.prototype.unfallSetzen = function (art, text) {
    this.unfall = { art: art, text: text };
    this.n = 0;
    this.nEff = 0;
    this.ev.add(this.zeit, 'unfall', text, 'unfall', { art: art });
  };

  // ---------------------------------------------------------- CNC-Zyklen
  // G81 Bohren, G82 Tiefbohren mit Spanbruch, G83 Tiefbohren mit Spanentleerung, G85 Reiben
  BohrSim.prototype.zyklusStart = function () {
    if (this.zyk && this.zyk.aktiv) { return; }
    var c = this.p.zyklus || {};
    this.zyk = { aktiv: true, phase: 'anfahrt', art: c.art || 'G81', Z: c.Z, Q: c.Q || 1e9, letzte: 0, ziel: 0, halt: false, warten: 0 };
    this.alarm = null;
  };

  BohrSim.prototype.zyklusSteuerung = function (dt, inp, nRev) {
    var zy = this.zyk;
    if (!zy || !zy.aktiv || zy.halt || inp.notaus) { return 0; }
    var feed = this.p.fAuto * nRev * (inp.ovF === undefined ? 1 : inp.ovF);
    var eil = 250 * (inp.ovF === undefined ? 1 : Math.min(1, inp.ovF + 0.2));
    var R = -2;
    var zq = this.zQ;
    var v = 0;
    if (nRev < 0.5 && zy.phase === 'bohren') { return 0; }
    switch (zy.phase) {
      case 'anfahrt':
        if (nRev < this.p.n / 60 * 0.9) { return 0; }
        v = zq < R ? eil : -eil;
        if (Math.abs(zq - R) < eil * dt) { this.zQ = R; this.z = Math.min(this.z, R); zy.phase = 'bohren'; zy.ziel = this.naechstesZiel(); return 0; }
        break;
      case 'bohren':
        v = feed;
        if (zq + v * dt >= zy.ziel) {
          v = (zy.ziel - zq) / dt;
          zy.letzte = zy.ziel;
          if (zy.ziel >= zy.Z - 1e-6) { zy.phase = 'raus'; }
          else if (zy.art === 'G83') { zy.phase = 'entspanen'; }
          else if (zy.art === 'G82') { zy.phase = 'spanbruch'; zy.zurueck = zy.ziel - 0.5; this.lambdaBruch = 0.8; }
          else { zy.ziel = this.naechstesZiel(); }
        }
        break;
      case 'spanbruch':
        v = -eil;
        if (zq - eil * dt <= zy.zurueck) { v = (zy.zurueck - zq) / dt; zy.phase = 'bohren'; zy.ziel = this.naechstesZiel(); }
        break;
      case 'entspanen':
        v = -eil;
        if (zq - eil * dt <= R) { v = (R - zq) / dt; zy.phase = 'wiederein'; zy.warten = 0.15; }
        break;
      case 'wiederein':
        if (zy.warten > 0) { zy.warten -= dt; return 0; }
        v = eil;
        if (zq + eil * dt >= zy.letzte - 0.5) { v = (zy.letzte - 0.5 - zq) / dt; zy.phase = 'bohren'; zy.ziel = this.naechstesZiel(); }
        break;
      case 'raus':
        v = zy.art === 'G85' ? -feed * 2 : -eil;
        if (zq + v * dt <= R) { v = (R - zq) / dt; zy.phase = 'fertig'; }
        break;
      case 'fertig':
        zy.aktiv = false;
        this.ev.add(this.zeit, 'zyklusEnde', 'Zyklus beendet.', 'info');
        return 0;
    }
    return v;
  };

  BohrSim.prototype.naechstesZiel = function () {
    var zy = this.zyk;
    if (zy.art === 'G81' || zy.art === 'G85') { return zy.Z; }
    return Math.min(zy.Z, zy.letzte + zy.Q);
  };

  // ---------------------------------------------------------- Gewindebohren
  BohrSim.prototype.umsteuern = function () {
    var g = this.gew;
    if (g.phase === 'schneiden' || g.phase === 'rutscht') {
      g.phase = 'zurueck';
      g.umsteuer = true;
      this.richtung = -1;
    }
  };

  BohrSim.prototype.stepGewinde = function (dt, inp, kd, nRev, vc, notaus) {
    var g = this.gew, def = this.def, mat = this.mat, w = this.w, m = this.m;
    var P = def.P;
    var d0 = this.r0 * 2;
    if (w.gebrochen) {
      this.M = 0;
      this.abkuehlen(dt, kd, false);
      return;
    }
    var zStop = m.cnc ? (this.p.zyklus && this.p.zyklus.Z) : this.p.zAnschlag;
    if (zStop === null || zStop === undefined) { zStop = 1e9; }

    if (m.cnc && inp.zyklusStart && g.phase === 'bereit') { g.phase = 'anfahrt'; }
    if (m.cnc && this.zyk && this.zyk.aktiv && g.phase === 'bereit') { g.phase = 'anfahrt'; }

    var vz = 0;
    switch (g.phase) {
      case 'bereit':
        if (!m.cnc) {
          var kr = inp.kraft || 0;
          var Fh = kr > 0 ? kr * m.handkraft : kr * 900;
          vz = clamp((Fh - 60) / 20, -60, 40);
          if (this.z + vz * dt >= 0 && vz > 0) {
            if (nRev > 0.2 && Fh > 40) { g.phase = 'schneiden'; this.richtung = 1; this.z = 0; vz = 0; }
            else { vz = (0 - this.z) / dt; if (nRev <= 0.2 && Fh > 150) { this.st.stillstand = true; } }
          }
        }
        break;
      case 'anfahrt':
        if (nRev < this.p.n / 60 * 0.9) { break; }
        vz = 200;
        if (this.z + vz * dt >= 0) { vz = (0 - this.z) / dt; g.phase = 'schneiden'; this.richtung = 1; }
        break;
      case 'schneiden':
        vz = P * nRev;
        if (this.z + vz * dt >= zStop) {
          vz = Math.max(0, (zStop - this.z) / dt);
          g.phase = 'zurueck';
          this.richtung = -1;
          this.ev.add(this.zeit, 'umsteuern', m.cnc ? 'Spindel kehrt um (G84).' : 'Tiefenanschlag: Der Gewindeschneidapparat steuert um.', 'info');
        }
        break;
      case 'rutscht':
        vz = 0;
        break;
      case 'zurueck':
        vz = -P * nRev;
        if (this.z + vz * dt <= -0.5) { g.phase = 'fertig'; this.richtung = 1; this.ev.add(this.zeit, 'gewindeFertig', 'Gewindebohrer ist herausgefahren.', 'info'); }
        break;
      case 'fertig':
        vz = m.cnc ? -200 : -30;
        if (this.z <= -8) { vz = 0; if (this.zyk) { this.zyk.aktiv = false; } }
        break;
    }
    if (notaus) { vz = 0; }
    var Mreq = 0;
    var schneidet = false;
    if (inp.umsteuern) { this.umsteuern(); }

    // Gewindemoment
    var t = Math.max(0, (def.d - d0) / 2);
    var ansch = def.anschnitt;
    var ce = clamp(this.z / ansch, 0, 1);
    if (this.durch && this.z - ansch > this.dicke) { ce = clamp(1 - (this.z - ansch - this.dicke) / ansch, 0, 1); }
    var h = t / Math.max(1, (ansch / P) * def.nuten);
    var K = this.kFaktor(kd, vc);
    var kc = K * Math.pow(Math.max(h, 0.004), -mat.mc);
    var Dm = (def.d + d0) / 2;
    // Abgetragene Profilflaeche je Gang ~ t^2 * tan30 (60-Grad-Profil). Ohne Schmierung
    // reisst und klebt der Werkstoff an den Flanken: bis zu 40 % mehr Moment.
    var McutVoll = 0.577 * kc * t * t * Dm * (1 + 0.6 * (1 - kd.schmier));
    var nVoll = clamp((Math.min(this.z, this.durch ? this.dicke : 1e9) - ansch) / P, 0, 200);
    var Mfric = McutVoll * kd.reib * 0.05 * nVoll * (1 + 3 * w.VB);
    var Mchip = 0;
    if (this.z > 0 && nRev > 0.05) {
      if (g.phase === 'schneiden' && vz > 0) {
        schneidet = true;
        Mreq = McutVoll * ce + Mfric;
        // Spaene: Form B schiebt nach unten, Form C foerdert nach oben
        var vol = t * P * 0.5 * Math.PI * Dm * (vz * dt / P) * ce;
        if (!this.durch && def.form === 'B') {
          g.spanB += vol * (mat.span === 'broeckel' ? 2.5 : 5);
          var raum = Math.PI / 4 * d0 * d0 * Math.max(0.05, this.vorTiefe - this.z) + Math.PI / 12 * d0 * d0 * (d0 / 2 / Math.tan(59 * DEG));
          var fb = g.spanB / Math.max(raum, 0.01);
          Mchip = Math.min(McutVoll * 8 * sq(Math.max(0, fb - 0.7)), def.mBruch * 3);
          this.phi = fb;
        } else if (!this.durch) {
          var rel = this.z / (def.d * (mat.span === 'lang' ? 1.6 : 3) * kd.le);
          this.phi += (0.3 * (1 + rel * rel * rel) * (mat.span === 'lang' ? 1 : 0.5) - this.phi) * Math.min(1, dt / 0.6);
          Mchip = McutVoll * 3 * sq(Math.max(0, this.phi - 0.8));
        } else {
          this.phi += (0.25 - this.phi) * Math.min(1, dt / 0.6);
        }
        // Aufsetzen am Bohrungsgrund
        if (!this.durch && this.z > this.vorSpitze - 0.6 * (d0 / 2 / Math.tan(59 * DEG))) {
          Mchip += Math.min(McutVoll * 30 * (1 + 20 * (this.z - (this.vorSpitze - 0.6 * (d0 / 2 / Math.tan(59 * DEG))))), def.mBruch * 3);
          this.ev.einmalig(this.zeit, 'boden', 'Der Gewindebohrer stößt auf den Bohrungsgrund!', 'warn', 2);
        }
        Mreq += Mchip;
      } else if (g.phase === 'zurueck') {
        Mreq = 0.35 * McutVoll + Mfric + (def.form === 'B' && !this.durch ? McutVoll * 1.2 * clamp(this.phi, 0, 2) : 0);
      } else if (g.phase === 'rutscht') {
        Mreq = this.M;
      }
    }
    if (t <= 0.01 && this.z > 0) { Mreq *= 0.05; }

    // Rutschkupplung (nur Gewindeschneidapparat)
    var rutsch = !m.cnc && this.p.rutsch ? this.p.rutsch * 1000 : 1e12;
    var Mwkz = Mreq;
    if (Mreq > rutsch) {
      Mwkz = rutsch;
      if (g.phase === 'schneiden') {
        g.phase = 'rutscht';
        this.ev.add(this.zeit, 'rutsch', 'Die Rutschkupplung hat bei ' + nf(rutsch / 1000) + ' Nm ausgelöst. Jetzt umsteuern (U)!', 'warn');
      } else if (g.phase === 'zurueck') {
        vz = 0;
        if (!g.steckt) {
          g.steckt = true;
          this.ev.add(this.zeit, 'steckt', 'Der Gewindebohrer sitzt fest – selbst beim Rückwärtslauf rutscht die Kupplung. Die Späne haben ihn eingeklemmt.', 'fehler');
        }
      }
    } else if (g.phase === 'rutscht' && Mreq < rutsch * 0.5) {
      g.phase = 'schneiden';
    }
    if (g.phase === 'rutscht') { vz = 0; }

    this.z += vz * dt;
    this.zQ = this.z;
    if (this.z > g.zMax) { g.zMax = this.z; }
    if (this.z > this.zMax) { this.zMax = this.z; }
    this.M = Mwkz;
    this.F = schneidet ? 40 + 0.02 * McutVoll / Math.max(P, 0.1) : 0;
    this.f = schneidet ? P : 0;
    this.vc = vc;
    this.Pc = Mwkz / 1000 * this.nEff / 9550;

    // Temperatur und Verschleiss
    var inLoch = this.z > 0.2;
    if (schneidet) {
      var Tss = tempStat(mat, vc, Math.max(h, 0.01), 0.9, kd.temp) + 200 * w.VB + 80 * Math.max(0, this.phi - 0.6);
      w.T += (Tss - w.T) * Math.min(1, dt / 1.0);
      var tL = standzeitMin(vc, this.vcRef, w.stoff.invN, 30);
      w.VB = Math.min(1.2, w.VB + 0.3 / (tL * 60) * mat.abr * verschleissThermisch(w.T, w.stoff.tSoft) * dt);
      w.einsatz += dt;
      this.schnittZeit += dt;
    } else {
      this.abkuehlen(dt, kd, inLoch);
    }
    if (w.T > w.maxT) { w.maxT = w.T; }
    if (Mwkz > this.st.maxM) { this.st.maxM = Mwkz; }
    if (w.T > this.st.maxT) { this.st.maxT = w.T; }
    if (this.phi > this.st.maxPhi) { this.st.maxPhi = this.phi; }
    if (schneidet) { this.st.gestartet = true; this.st.fSum += vc; this.st.fN += 1; }

    var tau = Mwkz / this.wp;
    var r = belastung(w, Math.sqrt(3) * tau, dt, w.T);
    this.sigmaR = r;
    if (r > this.st.maxR) { this.st.maxR = r; }
    var mNm = Mwkz / 1000;
    if (mNm > this.spann.mHalt && this.spann.unfall) {
      this.unfallSetzen('mitgerissen', 'Das Werkstück wurde beim Gewindebohren mitgerissen (' + nf(mNm) + ' Nm). Werkstücke immer festspannen!');
      return;
    }
    if (r >= 1 || w.schaden >= 1) {
      var mB = def.mBruch / 1000 * w.festigkeit;
      var u = { art: 'torsion' };
      if (!this.durch && this.z > this.vorSpitze - 0.6 * (d0 / 2 / Math.tan(59 * DEG))) {
        u.art = 'boden';
        u.text = 'Der Gewindebohrer ist auf den Bohrungsgrund gestoßen und abgeschert (' + nf(mNm) + ' Nm). Die Kernlochtiefe muss die Gewindetiefe plus Anschnitt plus Bohrerspitze abdecken.';
      } else if (this.phi > 1.0 && def.form === 'B' && !this.durch) {
        u.art = 'spaene';
        u.text = 'Ein Gewindebohrer Form B schiebt die Späne nach vorn – im Grundloch ist dort kein Platz. Spänestau, ' + nf(mNm) + ' Nm. Für Grundlöcher Form C (Spiralnut) nehmen.';
      } else if (d0 < DAT.gewinde[def.gw].d1min) {
        u.art = 'kernloch';
        u.text = 'Kernloch zu klein: Ø ' + nf(d0, 2) + ' mm statt ' + DAT.gewinde[def.gw].kern + ' mm. Die Gewindetiefe stieg auf ' + nf(t, 2) +
          ' mm, das Moment auf ' + nf(mNm) + ' Nm (Bruchmoment ≈ ' + nf(mB) + ' Nm).';
      } else if (kd.schmier < 0.2) {
        u.art = 'trocken';
        u.text = 'Ohne Schmierung steigt das Reibmoment mit jedem Gang. Bei ' + nf(mNm) + ' Nm ist der Gewindebohrer abgeschert. Gewindeschneiden immer mit Öl.';
      } else {
        u.text = 'Torsionsbruch bei ' + nf(mNm) + ' Nm (Bruchmoment ≈ ' + nf(mB) + ' Nm).';
      }
      this.bruch(u, mNm);
    }
  };

  // ---------------------------------------------------------- Lochergebnis
  BohrSim.prototype.lochAbschliessen = function () {
    var w = this.w, def = this.def, mat = this.mat, st = this.st, rng = this.rng;
    var res = { i: this.idx, typ: this.typ, notizen: [], defekt: null, bruchstueck: false };
    var v = this.vorLoch;
    res.lageX = this.lageX;
    res.lageY = this.lageY;
    var fMittel = st.fN ? st.fSum / st.fN : 0;
    var bue = st.bueN ? st.bueSum / st.bueN : 0;
    if (w.gebrochen && w.bruch && w.bruch.steckt && !w.bruchVermerkt) {
      res.defekt = 'bruch';
      res.bruchstueck = true;
      res.notizen.push('Abgebrochenes Werkzeug steckt in der Bohrung.');
      w.bruchVermerkt = true;
    }
    if (st.stillstand) { res.notizen.push('Werkzeug unter Last bei stehender Spindel eingedrückt.'); }

    if (this.typ === 'bohrer') {
      var tiefeCyl = this.zMax - this.lp;
      res.spitze = this.zMax;
      res.durch = this.durch && tiefeCyl > this.dicke - 0.01;
      res.tiefe = res.durch ? this.dicke : Math.max(0, tiefeCyl);
      res.gebohrt = this.zMax > this.lp * 0.5;
      var ueber = ({ HSS: 0.035, HSSE: 0.03, HSSTIN: 0.028 })[def.stoff] || 0.012;
      ueber += 0.5 * (this.m.rundlauf * (this.vhm ? 1 : 0.6) + w.verbogen);
      ueber += 0.08 * w.VB + 0.03 * bue + 0.025 * Math.max(0, st.maxPhi - 0.6) + 0.15 * st.walk;
      ueber += 0.004 * rng.gauss();
      res.d = this.r0 * 2 >= def.d ? this.r0 * 2 : def.d + Math.max(0.002, ueber);
      res.ra = 1.6 + 14 * fMittel + 3 * bue + 2.5 * Math.max(0, st.maxPhi - 0.7) + 6 * w.VB +
        (this.p.kss === 'trocken' ? 0.6 : 0) + (st.rubZeit > 0.5 ? 0.8 : 0) + 0.3 * Math.abs(rng.gauss());
      var walk = st.walk * (0.4 * def.d) * (this.zentriert ? 0.3 : 1);
      if (!v) {
        var a = rng.next() * Math.PI * 2;
        res.lageX = this.lageX + walk * Math.cos(a);
        res.lageY = this.lageY + walk * Math.sin(a);
      }
      res.grat = res.durch ? mat.duktil * (0.04 + 0.9 * st.fAustritt) * (1 + 2 * w.VB) : 0;
      if (mat.iso === 'K' && res.durch && st.fAustritt > 0.2) { res.notizen.push('Ausbrüche an der Austrittskante (Grauguss).'); }
      if (st.hartZeit > 0.3) { res.notizen.push('Kaltverfestigte Zone durchbohrt – erhöhter Verschleiß.'); }
      if (st.maxPhi > 1) { res.notizen.push('Spänestau: Bohrungswand verkratzt.'); }
      if (bue > 0.3) { res.notizen.push('Aufbauschneide: rauere, verschmierte Bohrungswand.'); }
    } else if (this.typ === 'reibahle') {
      var aufmass = def.d / 2 - this.r0;
      var aOpt = 0.06 + 0.004 * def.d;
      res.durch = this.durch && this.zMax > this.dicke + 0.3;
      res.tiefe = res.durch ? this.dicke : Math.max(0, this.zMax - 0.3);
      res.spitze = v ? v.spitze : this.zMax;
      res.gebohrt = this.zMax > 0.5;
      var dd = 0.004;
      var vcVerh = this.vc > 0 ? (st.fN ? this.vcMittel || this.vc : this.vc) / this.vcRef : 1;
      vcVerh = this.vcMax ? this.vcMax / this.vcRef : vcVerh;
      dd += 0.004 * Math.max(0, vcVerh - 1.25) * 5;
      dd += 0.012 * bue;
      if (aufmass > 2 * aOpt) { dd += 0.006 + 0.01 * (aufmass / aOpt - 2); res.notizen.push('Reibzugabe zu groß (' + nf(aufmass * 2, 2) + ' mm am Durchmesser).'); }
      if (aufmass < 0.4 * aOpt) { dd -= 0.004; res.notizen.push('Reibzugabe zu klein – die Reibahle hat gedrückt statt geschnitten.'); }
      dd += 0.1 * (this.m.rundlauf + w.verbogen) - 0.01 * w.VB + 0.0015 * rng.gauss();
      if (st.handJitter > 0.5 && !this.m.cnc) { dd += 0.002; }
      res.d = def.d + dd;
      var fDev = Math.abs(Math.log(Math.max(fMittel, 0.01) / this.fRef));
      res.ra = 0.45 + 0.6 * fDev + 2 * bue + (aufmass < 0.4 * aOpt ? 1.2 : 0) + (aufmass > 2 * aOpt ? 0.9 : 0) +
        Math.max(0, vcVerh - 1.3) * 1.5 + (this.p.kss === 'trocken' ? 0.9 : this.p.kss === 'oel' ? -0.15 : 0) +
        (st.rueckwaerts ? 0.8 : 0) + (st.stillstand ? 0.4 : 0) + 0.08 * Math.abs(rng.gauss()) + (st.handJitter > 0.5 && !this.m.cnc ? 0.2 : 0);
      res.ra = Math.max(0.3, res.ra);
      if (vcVerh > 1.4) { res.notizen.push('Rattermarken: Schnittgeschwindigkeit beim Reiben zu hoch.'); }
      res.grat = 0;
      if (v) { res.lageX = v.lageX; res.lageY = v.lageY; }
    } else {
      var gw = DAT.gewinde[def.gw];
      var d0 = this.r0 * 2;
      res.durch = this.durch;
      res.kern = d0;
      res.spitze = v ? v.spitze : 0;
      res.tiefe = v ? v.tiefe : 0;
      res.gebohrt = this.gew.zMax > def.anschnitt;
      res.nutzLaenge = Math.max(0, (this.durch ? Math.min(this.gew.zMax - def.anschnitt, this.dicke) : this.gew.zMax - def.anschnitt));
      if (this.durch && this.gew.zMax > this.dicke + def.anschnitt * 0.8) { res.nutzLaenge = this.dicke; }
      var kd = this.kssDef;
      var s = (1 - kd.schmier) * (0.25 + 0.6 * mat.aufbau + 0.25 * mat.verfest) * (1 + Math.max(0, (this.vcMax || 0) / this.vcRef - 1)) +
        (d0 < gw.d1min ? 0.25 : 0) + 0.05 * rng.gauss();
      res.ausgerissen = s > 0.55;
      res.kernOk = d0 >= gw.d1min && d0 <= gw.d1max;
      res.steckt = this.gew.steckt;
      if (this.gew.steckt) { res.defekt = 'steckt'; res.notizen.push('Gewindebohrer sitzt fest.'); }
      if (res.ausgerissen) { res.notizen.push('Gewindeflanken ausgerissen (zu wenig Schmierung).'); }
      if (!res.kernOk) { res.notizen.push('Kernlochdurchmesser außerhalb 6H (' + nf(gw.d1min, 3) + ' … ' + nf(gw.d1max, 3) + ' mm).'); }
      res.gutLehre = res.gebohrt && !res.defekt && !res.bruchstueck && w.VB < 0.5;
      res.ausLehre = res.ausgerissen;
      res.d = gw.D;
      res.ra = 0;
      res.grat = 0;
      if (v) { res.lageX = v.lageX; res.lageY = v.lageY; }
    }
    res.lage = Math.sqrt(sq(res.lageX) + sq(res.lageY));
    res.zeitExtra = (this.p.anbohren && this.typ === 'bohrer' && !v ? 12 : 0) + DAT.positionierung[this.p.pos || 'anreissen'].zeit * (v ? 0.3 : 1);
    res.zeit = this.lochZeit + res.zeitExtra;
    res.maxM = st.maxM / 1000;
    res.maxF = st.maxF;
    res.maxT = st.maxT;
    res.maxPhi = st.maxPhi;
    res.maxR = st.maxR;
    res.fMittel = fMittel;
    res.vc = this.vcMax || 0;
    res.VB = w.VB;
    this.ergebnisse.push(res);
    return res;
  };

  BohrSim.prototype.naechstesLoch = function () {
    var res = this.lochAbschliessen();
    if (this.idx + 1 < this.op.anzahl) {
      this.ladeLoch(this.idx + 1);
    } else {
      this.fertig = true;
    }
    return res;
  };

  // Werte fuer Anzeige und Meister
  BohrSim.prototype.anzeige = function () {
    var w = this.w;
    var d = this.def.d;
    if (this.vc && this.f > 0 && this.vc > (this.vcMax || 0)) { this.vcMax = this.vc; }
    return {
      n: this.nEff, vc: this.vc || 0, f: this.f, vf: this.f * this.nEff,
      M: this.M / 1000, mBruch: this.mBruchNmm / 1000 * w.festigkeit * (1 - 0.45 * w.schaden),
      F: this.F, P: this.Pc, pMax: this.m.P, T: w.T, tSoft: w.stoff.tSoft, VB: w.VB,
      phi: this.phi, z: this.z, zQ: this.zQ, tiefe: Math.max(0, this.zMax - this.lp), tiefeD: Math.max(0, this.z) / d,
      last: this.Pc / (this.m.P * (this.m.cnc ? 1 : this.m.eta)),
      r: this.sigmaR, knick: this.knickR || 0, schaden: w.schaden, vcRef: this.vcRef, fRef: this.fRef,
      bue: aufbauschneide(this.mat, this.vc || 0, this.def.stoff, this.kssDef),
      gebrochen: w.gebrochen, loch: this.idx, anzahl: this.op.anzahl, richtung: this.richtung,
      gewPhase: this.gew.phase, zyk: this.zyk ? this.zyk.phase : null, alarm: this.alarm
    };
  };

  // =====================================================================
  //                                 DREHEN
  // =====================================================================
  //
  // Koordinaten: z axial ab Futterbackenflaeche (0) zum freien Ende (L),
  // x = Radius der Werkzeugschneide. Durchmesser werden bei 20 °C gespeichert.
  //
  var DZ = 0.25;

  function DrehSim(o) {
    this.mat = o.mat;
    this.w = o.wkz;
    this.def = o.wkz.def;
    this.m = o.masch;
    this.p = o.param;
    this.op = o.op;
    this.rng = o.rng;
    this.kssDef = DAT.kss[this.p.kss] || DAT.kss.trocken;
    var wst = this.op.wst;
    this.L = wst.L;
    this.D0 = wst.D;
    this.spannL = wst.spannL || 40;
    this.reitstock = !!this.p.reitstock;
    this.N = Math.ceil(this.L / DZ) + 1;
    this.D = new Float32Array(this.N);
    this.Ra = new Float32Array(this.N);
    this.bearb = new Uint8Array(this.N);
    this.ratter = new Float32Array(this.N);
    this.backenSpur = false;
    var i;
    for (i = 0; i < this.N; i++) { this.D[i] = this.D0; this.Ra[i] = 12.5; }
    this.z = this.L + 4;
    this.x = this.D0 / 2 + 3;
    this.xZiel = this.x;
    this.n = 0;
    this.nEff = 0;
    this.zeit = 0;
    this.Twst = T_UMG;
    this.amp = 0;
    this.wirr = 0;
    this.motorWaerme = 0;
    this.ev = new Ereignisse();
    this.unfall = null;
    this.Fc = 0; this.Ff = 0; this.Fp = 0; this.ap = 0; this.f = 0; this.Pc = 0; this.vc = 0; this.delta = 0;
    this.spanForm = '-';
    this.platteBruch = false;
    this.halterSchaden = 0;
    this.kollidiert = false;
    this.vcRef = vcRef(this.mat, this.def);
    this.passung = sortenPassung(this.def, this.mat);
    this.kGam = kGamma(this.mat, this.def.gamma);
    this.kappa = this.def.kappa * DEG;
    this.st = { schnittZeit: 0, maxLast: 0, maxAmp: 0, maxP: 0 };
    this.nachgiebigkeit();
  }

  DrehSim.prototype.idx = function (z) { return clamp(Math.floor(z / DZ), 0, this.N - 1); };

  // Nachgiebigkeit des Systems an der Schneidenposition (mm/N)
  DrehSim.prototype.nachgiebigkeit = function () {
    var E = this.mat.E, L = this.L, z = clamp(this.z, 0.5, L);
    var i, c = 0, s, Is;
    if (!this.reitstock) {
      var schritt = Math.max(1, Math.floor(this.N / 160));
      for (i = 0; i < this.idx(z); i += schritt) {
        s = i * DZ;
        Is = Math.PI * Math.pow(this.D[i], 4) / 64;
        c += sq(z - s) / (E * Is) * DZ * schritt;
      }
      c += z * z / 5e8;
    } else {
      var sum = 0, cnt = 0;
      for (i = 0; i < this.N; i += 4) { sum += Math.pow(this.D[i], 4); cnt++; }
      var Ieff = Math.PI * (sum / cnt) / 64;
      var a = L - z, b = z;
      c = a * a * b * b * b * (3 * L + a) / (12 * E * Ieff * L * L * L);
      c += sq(z / L) / 12000 + sq(a / L) * z * z / 5e8 * 0.3;
    }
    var kHalter = 3 * 210000 * Math.pow(20, 4) / 12 / Math.pow(25, 3);
    c += 1 / 80000 + 1 / kHalter;
    this.c = c;
    this.k = 1 / c;
    var Dm = 0, j;
    for (j = 0; j < this.N; j += 8) { Dm += this.D[j]; }
    Dm /= Math.ceil(this.N / 8);
    var masse = this.mat.rho * Math.PI / 4 * Dm * Dm * (L + this.spannL);
    this.masse = masse;
    var mEff = (this.reitstock ? 0.45 : 0.24) * this.mat.rho * Math.PI / 4 * Dm * Dm * L + 0.02;
    this.fn = Math.sqrt(this.k * 1000 / mEff) / (2 * Math.PI);
    this.zeta = this.reitstock ? 0.04 : 0.03;
  };

  DrehSim.prototype.bLim = function (kc, vcMin) {
    var lam = (vcMin * 1000 / 60) / Math.max(this.fn, 50);
    var pd = 1 + 1.0 / Math.max(lam, 0.05);
    return 2 * this.k * this.zeta * (1 + this.zeta) / (kc * (1 - this.mat.mc) * 0.25) * pd;
  };

  DrehSim.prototype.step = function (dt, inp) {
    if (this.unfall) { return; }
    var m = this.m, w = this.w, def = this.def, mat = this.mat;
    this.zeit += dt;
    var kssAn = !!inp.kss && this.p.kss !== 'trocken';
    var kd = kssAn ? this.kssDef : DAT.kss.trocken;

    // Thermoschock: Kuehlmittel auf heisse Hartmetallschneide
    if (kssAn && !this.kssVorher && w.T > 650 && !istHSS(def.stoff)) {
      w.ausbruch = Math.min(1, w.ausbruch + 0.35);
      this.ev.add(this.zeit, 'thermoschock', 'Thermoschock: Kühlmittel auf die ' + Math.round(w.T) + ' °C heiße Schneide – Kammrisse in der Platte. KSS entweder von Anfang an oder gar nicht.', 'warn');
    }
    this.kssVorher = kssAn;

    // ------------------------------------------------ Spindel
    var notaus = !!inp.notaus;
    var nSoll = inp.spindel && !notaus && !this.motorAus ? this.p.n : 0;
    var a = Math.max(this.p.n, 100) / m.hochlauf;
    if (this.n < nSoll) { this.n = Math.min(nSoll, this.n + a * dt); }
    else if (this.n > nSoll) { this.n = Math.max(nSoll, this.n - a * (notaus ? 2.5 : 0.8) * dt); }
    var Pmax = m.P * m.eta;
    var last = this.Pc / Pmax;
    var droop = 0.05 * Math.min(1, last) + (last > 1 ? 0.6 * (last - 1) : 0);
    this.nEff = Math.max(0, this.n * (1 - droop));
    if (last > 1.1) {
      this.motorWaerme += (last - 1) * dt / 8;
      this.ev.einmalig(this.zeit, 'ueberlast', 'Der Hauptmotor ist überlastet (' + Math.round(last * 100) + ' %). Drehzahl bricht ein.', 'warn', 4);
    } else {
      this.motorWaerme = Math.max(0, this.motorWaerme - dt / 30);
    }
    if (this.motorWaerme >= 1 && !this.motorAus) {
      this.motorAus = true;
      this.ev.add(this.zeit, 'motorschutz', 'Der Motorschutzschalter hat ausgelöst. Spanabnahme verringern!', 'fehler');
    }
    if (last > 2.2 && this.n > 10) {
      this.n *= 0.5;
      this.ev.einmalig(this.zeit, 'stall', 'Die Spindel bleibt fast stehen – das Kippmoment des Motors ist überschritten.', 'fehler', 3);
    }
    var nRev = this.nEff / 60;

    // ------------------------------------------------ Schlitten
    if (inp.xZiel !== undefined && inp.xZiel !== null) { this.xZiel = inp.xZiel / 2; }
    var vxMax = inp.fein ? 0.25 : 2.5;
    var dx = clamp(this.xZiel - this.x, -vxMax * dt, vxMax * dt);
    var xAlt = this.x;
    this.x += dx;
    var vz = 0;
    var dirZ = this.p.richtung || -1;
    if (inp.vorschub && nRev > 0.05 && !this.anschlagAus) {
      vz = dirZ * this.p.f * nRev;
    } else if (inp.zHand) {
      vz = inp.zHand * (inp.eil ? 25 : 4);
    }
    var zNeu = this.z + vz * dt;
    if (this.p.zAnschlag !== null && this.p.zAnschlag !== undefined && inp.vorschub && dirZ < 0 && zNeu <= this.p.zAnschlag) {
      zNeu = this.p.zAnschlag;
      if (!this.anschlagAus) {
        this.anschlagAus = true;
        this.ev.add(this.zeit, 'anschlag', 'Längsanschlag erreicht – Vorschub ausgekuppelt.', 'info');
      }
    }
    if (!inp.vorschub) { this.anschlagAus = false; }
    var zAlt = this.z;
    this.z = Math.min(zNeu, this.L + 60);

    // Kollision mit den Futterbacken
    var backenR = Math.max(this.D0, 20) / 2 + m.futter.backenH;
    if (this.z < 0.6 && this.x < backenR && !this.kollidiert) {
      this.z = Math.max(this.z, 0.2);
      this.kollidiert = true;
      w.gebrochen = true;
      w.bruch = { art: 'kollision', text: 'Kollision mit den Futterbacken.' };
      this.platteBruch = true;
      this.ev.add(this.zeit, 'kollision', 'KOLLISION! Der Drehmeißel ist in die laufenden Futterbacken gefahren. Platte zerstört, Futter beschädigt. Vorschub rechtzeitig auskuppeln oder Längsanschlag setzen.', nRev > 0.5 ? 'unfall' : 'fehler');
      if (nRev > 0.5) { this.unfall = { art: 'kollision', text: 'Kollision mit laufendem Futter.' }; }
      return;
    }
    if (this.reitstock && this.z > this.L + 1.5 && this.x < 12) {
      this.z = Math.min(this.z, this.L + 1.5);
    }

    // ------------------------------------------------ Eingriff
    if (this.zeit - (this.tNach || 0) > 0.08) { this.nachgiebigkeit(); this.tNach = this.zeit; }
    var vc = Math.PI * Math.max(2 * this.x, 1) * this.nEff / 1000;
    this.vc = vc;
    var schneidet = false;
    var ap = 0, h = 0, b = 0, f = 0;
    var heiss = 1 + mat.alpha * (this.Twst - T_UMG);
    var iA = this.idx(zAlt), iN = this.idx(this.z);
    var imWst = this.z >= -0.2 && this.z <= this.L + 0.1;
    var zellen = [];
    var verweilen = false;
    if (imWst && nRev > 0.02) {
      var rOb = this.D[iN] / 2 * heiss;
      ap = rOb - this.x;
      if (Math.abs(vz) > 1e-4) {
        // Zellen, die die Schneide verlassen hat, sind fertig geschnitten.
        // Die aktuelle Zelle traegt noch den unbearbeiteten Durchmesser.
        if (iN !== iA && zAlt >= -0.2 && zAlt <= this.L + 0.1) {
          var s1 = iN < iA ? -1 : 1, k;
          for (k = iA; k !== iN; k += s1) { zellen.push(k); }
        }
        if (ap > 0.003) {
          f = Math.abs(vz) / nRev;
          h = f * Math.sin(this.kappa);
          b = ap / Math.sin(this.kappa);
          schneidet = true;
        }
      } else if (dx < -1e-6 && ap > 0.003) {
        // Einstechen mit dem Planschlitten
        f = -dx / dt / nRev;
        h = f;
        b = Math.min(2 * def.re, 2);
        ap = Math.min(ap, b);
        schneidet = true;
        zellen = [iN];
      } else if (ap > 0.003) {
        // Verweilen: die Schneide dreht den Ring an ihrer Position frei
        zellen = [iN];
        verweilen = true;
      }
    }

    // ------------------------------------------------ Kraefte
    var Fc = 0, Ff = 0, Fp = 0, delta = 0, kc = 0;
    var bue = 0;
    if (schneidet) {
      bue = aufbauschneide(mat, vc, def.stoff, kd);
      var kver = 1 + 1.3 * w.VB + 1.2 * w.ausbruch + (this.platteBruch ? 1.8 : 0);
      kc = kcKienzle(mat, h) * this.kGam * kd.kc * kver * kV(vc, def.stoff) * (1 - 0.12 * bue);
      var rp = 0.22 + 0.35 * Math.exp(-ap / def.re);
      var apEff = ap / (1 + kc * f * rp * this.c);
      Fc = kc * apEff * f;
      Fp = rp * Fc;
      Ff = 0.42 * Fc;
      delta = Fp * this.c;
      ap = apEff;
      if (this.wirr > 0.8) { Fc *= 1.05; }
    }
    this.Fc = Fc; this.Ff = Ff; this.Fp = Fp; this.ap = schneidet ? ap : 0; this.f = f; this.delta = delta;
    this.Pc = Fc * vc / 60000;
    var Mnm = Fc * this.x / 1000;
    this.M = Mnm;

    // ------------------------------------------------ Rattern
    var bl = schneidet ? this.bLim(kc, vc) : 99;
    this.bLimAkt = bl;
    if (schneidet && ap > bl) {
      var wachs = 2 * Math.PI * this.fn * this.zeta * (ap / bl - 1) * 0.15;
      this.amp += (this.amp + 0.3) * Math.min(wachs, 40) * dt;
      var sat = 6 + 45 * Math.min(2, ap / bl - 1);
      if (this.amp > sat) { this.amp = sat; }
      if (this.amp > 4) { this.ev.einmalig(this.zeit, 'rattern', 'Rattern! Das Werkstück schwingt (' + Math.round(this.fn) + ' Hz). Spantiefe verringern, Drehzahl ändern oder Reitstock verwenden.', 'warn', 6); }
    } else {
      this.amp = Math.max(0, this.amp - this.amp * 6 * dt - 2 * dt);
    }
    if (this.amp > this.st.maxAmp) { this.st.maxAmp = this.amp; }

    // ------------------------------------------------ Spanform
    var spanForm = '-';
    if (schneidet) {
      if (mat.span === 'broeckel') { spanForm = 'broeckel'; }
      else if (f > def.fMax * 1.15 || ap > def.apMax) { spanForm = 'gestaucht'; }
      else if (f < def.fMin || ap < def.apMin) { spanForm = mat.iso === 'N' && f > 0.08 ? 'wendel' : 'band'; }
      else { spanForm = 'kurz'; }
      if (spanForm === 'band') {
        this.wirr += dt * (mat.iso === 'M' ? 0.22 : 0.15) * (1 + ap);
        if (this.wirr > 1) { this.ev.einmalig(this.zeit, 'wirr', 'Wirrspäne wickeln sich um Werkstück und Halter. Maschine anhalten und mit dem Spänehaken entfernen (H).', 'warn', 8); }
      }
    }
    this.spanForm = spanForm;

    // ------------------------------------------------ Oberflaeche und Durchmesser
    if ((schneidet || verweilen) && zellen.length) {
      var raTh = 1000 * f * f / (32 * def.re) * (def.wiper ? 0.5 : 1);
      var ra = Math.sqrt(raTh * raTh + mat.raMin * mat.raMin) + 2.5 * bue + 0.22 * this.amp + 3 * w.VB +
        (this.wirr > 1 ? 1.2 : 0) + (this.platteBruch ? 20 : 0) + 4 * w.ausbruch +
        (vc < 40 && !istHSS(def.stoff) ? 1.2 * mat.aufbau : 0);
      var rueck = 0.12 * w.VB;
      var j;
      for (j = 0; j < zellen.length; j++) {
        var ii = zellen[j];
        var rip = this.amp > 0.5 ? (this.amp / 1000) * Math.sin(this.zeit * 2 * Math.PI * this.fn + ii) : 0;
        var dNeu = 2 * (this.x + delta + rueck + rip) / heiss;
        if (dNeu < this.D[ii] - 1e-5) {
          this.D[ii] = dNeu;
          this.Ra[ii] = verweilen && this.bearb[ii] ? this.Ra[ii] : ra * (0.95 + 0.1 * this.rng.next());
          this.bearb[ii] = 1;
          this.ratter[ii] = this.amp;
        }
      }
    }

    // ------------------------------------------------ Spannung im Futter
    if (schneidet) {
      var fsp = m.futter.Fsp * Math.max(0.15, 1 - 0.6 * sq(this.nEff / m.futter.nMax)) * clamp(this.spannL / (0.5 * this.D0), 0.3, 1);
      var mHalt = 0.25 * fsp * this.D0 / 2 / 1000;
      if (Mnm > mHalt) {
        if (!this.backenSpur) {
          this.backenSpur = true;
          this.ev.add(this.zeit, 'rutscht', 'Das Werkstück rutscht in den Backen durch (' + nf(Mnm) + ' Nm > ' + nf(mHalt) + ' Nm Haltemoment). Backenspuren, Rundlauf verloren.', 'fehler');
        }
      }
      if (!this.reitstock) {
        var kipp = Math.sqrt(Fc * Fc + Fp * Fp) * this.z;
        var kippHalt = fsp * this.spannL / 4;
        if (kipp > kippHalt * 1.6) {
          this.unfall = { art: 'herausgerissen', text: 'Das Werkstück wurde aus dem Futter gerissen.' };
          this.ev.add(this.zeit, 'unfall', 'Das Werkstück wurde aus dem Futter gerissen! Die Ausspannlänge (' + Math.round(this.L) +
            ' mm) ist für diese Schnittkraft viel zu groß, die Spannlänge (' + Math.round(this.spannL) + ' mm) zu kurz. Lange Teile mit Reitstock abstützen.', 'unfall');
          return;
        }
      }
    }

    // ------------------------------------------------ Temperatur, Verschleiss
    if (schneidet) {
      var Tss = tempStat(mat, vc, h, 0.68, kd.temp) + 250 * w.VB + 120 * w.ausbruch + (this.platteBruch ? 300 : 0);
      w.T += (Tss - w.T) * Math.min(1, dt / 1.5);
      var tL = standzeitMin(vc, this.vcRef, w.stoff.invN, 15);
      var fBez = (def.fMin + def.fMax) / 2;
      var dVB = 0.3 / (tL * 60) * Math.pow(f / fBez, 0.5) * Math.pow(Math.max(ap, 0.2), 0.15) * mat.abr *
        this.passung[0] * verschleissThermisch(w.T, w.stoff.tSoft);
      if (bue > 0.4) { dVB *= 1 + bue; }
      w.VB = Math.min(1.2, w.VB + dVB * dt);
      w.einsatz += dt;
      this.st.schnittZeit += dt;
      // Waerme ins Werkstueck: etwa 12 % der Schnittleistung
      var Q = 0.12 * this.Pc * 1000;
      this.Twst += Q / (this.masse * this.mat.cp) * dt;
    } else {
      var tauK = kd.kuehl > 0 ? 2 / kd.kuehl : 8;
      w.T += (T_UMG - w.T) * Math.min(1, dt / tauK);
    }
    this.Twst += (T_UMG - this.Twst) * dt * (kssAn ? 0.02 : 0.0015);
    if (w.T > w.maxT) { w.maxT = w.T; }
    if (this.Pc > this.st.maxP) { this.st.maxP = this.Pc; }

    // ------------------------------------------------ Plattenbruch
    if (!schneidet) { this.plattenLast = 0; }
    if (schneidet && !this.platteBruch) {
      var zaeh = { P15: 0.9, P25: 1.0, P35: 1.15, M25: 1.05, K20: 0.9, N10: 0.85, S15: 0.95 }[def.sorte] || 1;
      var rh = h / (def.hMax * zaeh);
      var ra2 = ap / (def.apMax * 1.3);
      var lastP = Math.max(rh, ra2) * (1 + this.amp / 45 + 0.8 * w.ausbruch) + (this.wirr > 1.5 ? 0.15 : 0);
      if (bue > 0.5) { lastP += 0.1; }
      this.plattenLast = lastP;
      if (lastP > this.st.maxLast) { this.st.maxLast = lastP; }
      var hazard = 0;
      if (lastP > 1) { hazard = 4 * (lastP - 1); }
      if (w.VB > 0.5) { hazard += 2 * (w.VB - 0.5); }
      if (lastP > 1.4 || this.rng.next() < hazard * dt) {
        this.platteBruch = true;
        w.gebrochen = true;
        var txt;
        if (rh >= ra2 && rh > 0.9) {
          txt = 'Plattenbruch: Spanungsdicke h = ' + nf(h, 2) + ' mm, die ' + def.name + ' verträgt höchstens ca. ' + nf(def.hMax * zaeh, 2) + ' mm. Vorschub verringern.';
        } else if (ra2 > 0.9) {
          txt = 'Plattenbruch: Schnitttiefe ' + nf(ap, 2) + ' mm ist zu groß für diese Platte (max. ' + nf(def.apMax, 1) + ' mm).';
        } else if (this.amp > 10) {
          txt = 'Schneidenausbruch durch Rattern: Die Schwingung hat die Schneidkante zerrüttet.';
        } else if (w.VB > 0.5) {
          txt = 'Die verschlissene Schneide (VB = ' + nf(w.VB, 2) + ' mm) ist ausgebrochen. Rechtzeitig die Schneide wechseln.';
        } else {
          txt = 'Schneidenausbruch (Belastung ' + Math.round(lastP * 100) + ' %).';
        }
        w.bruch = { art: 'platte', text: txt };
        this.ev.add(this.zeit, 'bruch', txt, 'fehler', { titel: 'Wendeschneidplatte gebrochen' });
      }
    }
    if (this.platteBruch && schneidet) {
      this.halterSchaden += dt;
      if (this.halterSchaden > 1.2) {
        this.ev.einmalig(this.zeit, 'halter', 'Der Klemmhalter schneidet mit! Sofort anhalten – der Halter wird zerstört.', 'fehler', 5);
      }
    }
  };

  DrehSim.prototype.werkzeugWechsel = function (w) {
    this.w = w;
    this.def = w.def;
    this.vcRef = vcRef(this.mat, this.def);
    this.passung = sortenPassung(this.def, this.mat);
    this.kGam = kGamma(this.mat, this.def.gamma);
    this.kappa = this.def.kappa * DEG;
    this.platteBruch = false;
    this.halterSchaden = 0;
  };

  DrehSim.prototype.spaeneEntfernen = function () {
    if (this.nEff > 1) {
      this.ev.add(this.zeit, 'sicherheit', 'Späne niemals bei laufender Spindel entfernen! Erst Hauptspindel aus.', 'warn');
      this.sicherheitsVerstoss = (this.sicherheitsVerstoss || 0) + 1;
      return false;
    }
    this.wirr = 0;
    return true;
  };

  DrehSim.prototype.plattenWechsel = function () {
    var w = this.w;
    if (this.nEff > 1) { return false; }
    w.ecke += 1;
    w.VB = 0;
    w.ausbruch = 0;
    w.schaden = 0;
    w.gebrochen = false;
    w.bruch = null;
    w.T = T_UMG;
    this.platteBruch = false;
    this.halterSchaden = 0;
    return true;
  };

  // Messung durch den Werker: Bezug 20 °C, Messwert enthaelt die Waermedehnung
  DrehSim.prototype.messen = function (zPos, mittelId) {
    var mm = DAT.messmittel[mittelId] || DAT.messmittel.buegel;
    if (this.nEff > 1) { return { fehler: 'Bei laufender Spindel wird nicht gemessen!' }; }
    var i = this.idx(zPos);
    var D20 = this.D[i];
    var wert = D20 * (1 + this.mat.alpha * (this.Twst - T_UMG));
    wert += mm.fehler * (this.rng.next() * 2 - 1) * 0.6;
    wert = Math.round(wert / mm.aufl) * mm.aufl;
    return { wert: wert, aufl: mm.aufl, T: this.Twst, z: zPos };
  };

  DrehSim.prototype.anzeige = function () {
    var w = this.w;
    return {
      n: this.nEff, vc: this.vc, f: this.f, ap: this.ap, Fc: this.Fc, Fp: this.Fp, Ff: this.Ff,
      P: this.Pc, pMax: this.m.P * this.m.eta, last: this.Pc / (this.m.P * this.m.eta), M: this.M,
      T: w.T, tSoft: w.stoff.tSoft, VB: w.VB, amp: this.amp, bLim: this.bLimAkt, fn: this.fn,
      x: this.x * 2, z: this.z, spanForm: this.spanForm, wirr: this.wirr, Twst: this.Twst,
      plattenLast: this.plattenLast || 0, delta: this.delta, gebrochen: w.gebrochen, vcRef: this.vcRef,
      motor: this.motorWaerme, reitstock: this.reitstock
    };
  };

  // Durchmesserbereich auf einer Laenge (fuer die Pruefung)
  DrehSim.prototype.bereich = function (zVon, zBis) {
    var a = this.idx(Math.min(zVon, zBis)), b = this.idx(Math.max(zVon, zBis));
    var min = 1e9, max = -1e9, ra = 0, rat = 0, i, roh = false;
    for (i = a; i <= b; i++) {
      if (this.D[i] < min) { min = this.D[i]; }
      if (this.D[i] > max) { max = this.D[i]; }
      if (this.Ra[i] > ra) { ra = this.Ra[i]; }
      if (this.ratter[i] > rat) { rat = this.ratter[i]; }
      if (!this.bearb[i]) { roh = true; }
    }
    return { min: min, max: max, ra: ra, ratter: rat, roh: roh };
  };

  // Lage des Absatzes: von rechts kommend die erste Zelle mit Ausgangsdurchmesser
  DrehSim.prototype.absatz = function (dGrenze) {
    var i;
    for (i = this.N - 1; i >= 0; i--) {
      if (this.D[i] > dGrenze) { return this.L - (i + 1) * DZ; }
    }
    return this.L;
  };

  // =====================================================================
  //                                 FRAESEN
  // =====================================================================
  //
  // Werkstueck: X 0..L (Vorschubrichtung), Y 0..B, Oberflaeche Z = 0,
  // Tiefe positiv nach unten. Hoehenkarte: abgetragene Tiefe je Zelle.
  //
  var FX = 0.5, FY = 0.1;

  function stabilitaetsKarte(k, fn, zeta, Kt, ze, zahn) {
    var N = 480, nMin = 100, nMax = 40000;
    var lnA = Math.log(nMin), lnB = Math.log(nMax);
    var b = new Float32Array(N), nGrid = new Float32Array(N), i;
    for (i = 0; i < N; i++) { b[i] = 1e9; nGrid[i] = Math.exp(lnA + (lnB - lnA) * i / (N - 1)); }
    var wn = 2 * Math.PI * fn;
    var kNmm = k;
    var lobe, rr;
    function idxN(n) { return (Math.log(n) - lnA) / (lnB - lnA) * (N - 1); }
    for (lobe = 0; lobe < 50; lobe++) {
      var prevN = null, prevB = null;
      for (rr = 1.002; rr < 2.2; rr += 0.004) {
        var den = sq(1 - rr * rr) + sq(2 * zeta * rr);
        var Gr = (1 - rr * rr) / (kNmm * den);
        var Gi = -2 * zeta * rr / (kNmm * den);
        if (Gr >= 0) { continue; }
        var bl = -1 / (2 * Kt * ze * Gr);
        var psi = Math.atan(Gi / Gr);
        var eps = Math.PI - 2 * psi;
        var T = (eps + 2 * Math.PI * lobe) / (rr * wn);
        var n = 60 / (zahn * T);
        if (prevN !== null) {
          var i0 = idxN(Math.min(n, prevN)), i1 = idxN(Math.max(n, prevN));
          var a0 = Math.max(0, Math.ceil(i0)), a1 = Math.min(N - 1, Math.floor(i1));
          for (i = a0; i <= a1; i++) {
            var t = i1 > i0 ? (i - i0) / (i1 - i0) : 0;
            var bv = n < prevN ? bl + (prevB - bl) * t : prevB + (bl - prevB) * t;
            if (bv < b[i]) { b[i] = bv; }
          }
        }
        prevN = n;
        prevB = bl;
      }
    }
    return { n: nGrid, b: b, lnA: lnA, lnB: lnB, N: N };
  }

  function karteWert(karte, n) {
    var x = (Math.log(clamp(n, 100, 40000)) - karte.lnA) / (karte.lnB - karte.lnA) * (karte.N - 1);
    var i = Math.floor(x), t = x - i;
    if (i >= karte.N - 1) { return karte.b[karte.N - 1]; }
    return karte.b[i] * (1 - t) + karte.b[i + 1] * t;
  }

  function FraesSim(o) {
    this.mat = o.mat;
    this.w = o.wkz;
    this.def = o.wkz.def;
    this.m = o.masch;
    this.p = o.param;
    this.op = o.op;
    this.rng = o.rng;
    this.kssDef = DAT.kss[this.p.kss] || DAT.kss.trocken;
    var wst = this.op.wst;
    this.L = wst.L;
    this.B = wst.B;
    this.H = wst.H;
    this.NX = Math.ceil(this.L / FX);
    this.NY = Math.ceil(this.B / FY);
    this.tiefe = new Float32Array(this.NX * this.NY);
    this.raBoden = new Float32Array(this.NX * this.NY);
    // Wandlagen exakt (nicht auf das 0,1-mm-Raster gerundet), fuer die Nutbreite
    this.wandL = new Float32Array(this.NX);
    this.wandR = new Float32Array(this.NX);
    this.wandL.fill(1e9);
    this.wandR.fill(-1e9);
    this.raWand = 0;
    this.R = this.def.d / 2;
    this.auskrag = this.p.auskragung || (this.def.lc + 8);
    this.x = -this.R - 6;
    this.y = this.op.y !== undefined ? this.op.y : this.B / 2;
    this.zT = 0;
    this.zZiel = 0;
    this.yZiel = this.y;
    this.n = 0; this.nEff = 0; this.zeit = 0;
    this.amp = 0;
    this.ev = new Ereignisse();
    this.unfall = null;
    this.vcRef = vcRef(this.mat, this.def);
    this.fzRef = fRef(this.mat, this.def);
    this.kGam = kGamma(this.mat, this.def.al ? 18 : 10);
    this.auszug = 0;
    this.spielGenommen = false;
    this.Fc = 0; this.M = 0; this.Pc = 0; this.Flat = 0; this.ae = 0; this.apE = 0; this.fz = 0; this.delta = 0;
    this.st = { maxR: 0, maxAmp: 0, maxP: 0, schnittZeit: 0, passes: 0 };
    this.pass = null;
    this.waende = [];
    this.steifigkeit();
  }

  FraesSim.prototype.steifigkeit = function () {
    var def = this.def, st = DAT.schneidstoffe[def.stoff];
    var dk = def.kern * def.d;
    var I = Math.PI * Math.pow(dk, 4) / 64;
    var L = this.auskrag;
    var kHalter = this.m.kHalter || 20000;
    this.c = L * L * L / (3 * st.E * I) + 1 / kHalter;
    this.k = 1 / this.c;
    this.Wb = Math.PI * dk * dk * dk / 32;
    var mEff = 0.04 + 0.000004 * def.d * def.d * L;
    this.fn = Math.sqrt(this.k * 1000 / mEff) / (2 * Math.PI);
    this.zeta = 0.035;
    this.karte = null;
  };

  FraesSim.prototype.werkzeugWechsel = function (w) {
    this.w = w;
    this.def = w.def;
    this.R = this.def.d / 2;
    this.vcRef = vcRef(this.mat, this.def);
    this.fzRef = fRef(this.mat, this.def);
    this.auszug = 0;
    this.amp = 0;
    this.steifigkeit();
  };

  FraesSim.prototype.bLim = function (kc, ze) {
    var Kt = kc * (1 - this.mat.mc) * 0.06;
    var zeEff = Math.max(ze, 0.25);
    if (!this.karte || Math.abs(this.karte.Kt - Kt) / Kt > 0.15 || Math.abs(this.karte.ze - zeEff) > 0.2) {
      this.karte = stabilitaetsKarte(this.k, this.fn, this.zeta, Kt, zeEff, this.def.z);
      this.karte.Kt = Kt;
      this.karte.ze = zeEff;
    }
    var b = karteWert(this.karte, Math.max(this.nEff, 100));
    var vcMm = Math.PI * this.def.d * this.nEff / 60;
    var lam = vcMm / Math.max(this.fn, 50);
    // Prozessdaempfung: bei kurzer Wellenlaenge (niedrige vc) daempft die Freiflaeche
    return b * (1 + sq(1.2 / Math.max(lam, 0.05)));
  };

  FraesSim.prototype.zelle = function (ix, iy) { return ix * this.NY + iy; };

  // Eingriff des Fraesers: Material unmittelbar vor der Schneidenbahn.
  // Abgetastet wird die Vorderkante des Fraeserkreises je Querposition s.
  FraesSim.prototype.eingriff = function (dir) {
    var R = this.R, z = this.zT + this.auszug;
    var N = 40, i, eng = 0, apMax = 0, sSum = 0, links = false, rechts = false;
    var eps = FX + this.m.rundlauf + 0.05;
    for (i = 0; i < N; i++) {
      var sy = -R + (i + 0.5) * 2 * R / N;
      var px = this.x + dir * (Math.sqrt(Math.max(0, R * R - sy * sy)) + eps);
      var py = this.y + sy;
      if (py < 0 || py >= this.B || px < 0 || px >= this.L) { continue; }
      var e = z - this.tiefe[this.zelle(Math.floor(px / FX), Math.floor(py / FY))];
      if (e > 0.005) {
        eng++;
        if (e > apMax) { apMax = e; }
        sSum += sy;
        if (sy < -0.8 * R) { links = true; }
        if (sy > 0.8 * R) { rechts = true; }
      }
    }
    if (!eng) { return { ae: 0, ap: 0, frac: 0, seite: 0, beide: false }; }
    return { ae: eng * 2 * R / N, ap: apMax, frac: 1, seite: sSum / eng, beide: links && rechts };
  };

  FraesSim.prototype.abtragen = function () {
    var R = this.R + this.m.rundlauf * 0.5 + (this.amp / 1000) * 0.5;
    var y = this.y + this.deltaY;
    var z = this.zT + this.auszug;
    var x0 = Math.max(0, Math.floor((this.x - R) / FX)), x1 = Math.min(this.NX - 1, Math.floor((this.x + R) / FX));
    var ix, iy, ra = this.raAkt || 1;
    for (ix = x0; ix <= x1; ix++) {
      var px = (ix + 0.5) * FX;
      var hw = Math.sqrt(Math.max(0, R * R - sq(px - this.x)));
      var y0 = Math.max(0, Math.floor((y - hw) / FY)), y1 = Math.min(this.NY - 1, Math.floor((y + hw) / FY));
      if (z > 0.01 && hw > 0) {
        if (y - hw < this.wandL[ix]) { this.wandL[ix] = y - hw; }
        if (y + hw > this.wandR[ix]) { this.wandR[ix] = y + hw; }
      }
      for (iy = y0; iy <= y1; iy++) {
        var c = ix * this.NY + iy;
        if (z > this.tiefe[c] + 1e-4) { this.tiefe[c] = z; this.raBoden[c] = ra; }
      }
    }
  };

  FraesSim.prototype.step = function (dt, inp) {
    if (this.unfall) { return; }
    var m = this.m, w = this.w, def = this.def, mat = this.mat;
    this.zeit += dt;
    var kssAn = !!inp.kss && this.p.kss !== 'trocken';
    var kd = kssAn ? this.kssDef : DAT.kss.trocken;
    var notaus = !!inp.notaus;
    var nSoll = inp.spindel && !notaus && !w.gebrochen ? this.p.n * (inp.ovS || 1) : 0;
    var a = Math.max(this.p.n, 200) / m.hochlauf;
    if (this.n < nSoll) { this.n = Math.min(nSoll, this.n + a * dt); }
    else if (this.n > nSoll) { this.n = Math.max(nSoll, this.n - a * (notaus ? 3 : 1) * dt); }
    var Pmax = m.P * m.eta;
    var last = this.Pc / Pmax;
    this.nEff = this.n * (1 - 0.04 * Math.min(1, last) - (last > 1 ? 0.5 * (last - 1) : 0));
    if (last > 1.15) { this.ev.einmalig(this.zeit, 'ueberlast', 'Spindelüberlast (' + Math.round(last * 100) + ' %).', 'warn', 4); }
    var nRev = Math.max(0, this.nEff) / 60;

    // Zustellung in Z/Y nur ausserhalb des Werkstuecks
    var aussen = this.x + this.R < -0.5 || this.x - this.R > this.L + 0.5;
    if (inp.zZiel !== undefined && inp.zZiel !== null) { this.zZiel = inp.zZiel; }
    if (inp.yZiel !== undefined && inp.yZiel !== null) { this.yZiel = inp.yZiel; }
    if (aussen) {
      this.zT += clamp(this.zZiel - this.zT, -3 * dt, 3 * dt);
      this.y += clamp(this.yZiel - this.y, -5 * dt, 5 * dt);
    }

    var dir = this.p.richtung || 1;
    var vx = 0;
    var vf = this.p.vf * (inp.ovF === undefined ? 1 : inp.ovF) / 60;
    if (inp.vorschub && nRev > 0.05) { vx = dir * vf; }
    else if (inp.xHand) { vx = inp.xHand * (inp.eil ? 40 : 5); dir = inp.xHand > 0 ? 1 : -1; }
    if (inp.vorschub && !(nRev > 0.05) && this.eingriffAkt && this.eingriffAkt.ap > 0) {
      vx = dir * vf;
    }

    // Spiel im Gleichlauf: der Fraeser zieht den Tisch nach
    var spielSprung = 0;
    var g = this.eingriff(vx >= 0 ? 1 : -1);
    this.eingriffAkt = g;
    var gleichlauf;
    if (g.beide || g.ae > 1.6 * this.R) { gleichlauf = 0.5; }
    else { gleichlauf = (g.seite * (vx >= 0 ? 1 : -1)) < 0 ? 1 : 0; }
    this.gleichlauf = gleichlauf;

    var fz = nRev > 0.05 ? Math.abs(vx) / (nRev * def.z) : 0;
    var schneidet = g.ap > 0.005 && g.ae > 0.02 && (nRev > 0.05) && Math.abs(vx) > 1e-4;
    if (g.ap > 0.005 && g.ae > 0.02 && nRev <= 0.05 && Math.abs(vx) > 1e-4) {
      // Vorschub gegen stehenden Fraeser
      this.bruch({ text: 'Der Tisch wurde mit stehender Spindel gegen das Werkstück gefahren. Der Fräser ist abgebrochen.' }, 0);
      return;
    }

    var Fc = 0, M = 0, Flat = 0, Fax = 0, kc = 0, hm = 0, ze = 0, phiS = 0;
    var vc = Math.PI * def.d * this.nEff / 1000;
    this.vc = vc;
    if (schneidet) {
      var aeRel = clamp(g.ae / def.d, 0.01, 1);
      phiS = g.beide ? Math.PI : Math.acos(1 - 2 * aeRel);
      hm = fz * (1 - Math.cos(phiS)) / phiS;
      if (g.beide) { hm = fz * 2 / Math.PI; }
      var bue = aufbauschneide(mat, vc, def.stoff, kd);
      var kver = 1 + 1.3 * w.VB + 0.8 * w.ausbruch + 2.5 * Math.max(0, w.aufschweiss - 0.6);
      kc = kcKienzle(mat, hm) * this.kGam * kd.kc * kver * kV(vc, def.stoff) * (1 - 0.1 * bue);
      ze = def.z * phiS / (2 * Math.PI);
      var tiefRatio = g.ap / def.d;
      var nachschnitt = 1;
      if (tiefRatio > 1.5 && mat.span === 'lang' && g.beide) { nachschnitt = 1 + 0.3 * (tiefRatio - 1.5); }
      Fc = kc * g.ap * hm * ze * g.frac * nachschnitt;
      M = Fc * this.R;
      var kr = g.beide ? 0.55 : 1.1 - 0.35 * phiS / Math.PI;
      Flat = Fc * kr;
      Fax = Fc * Math.tan(def.drall * DEG) * 0.35;
      this.raAkt = 0.5 + 18 * fz * (this.m.rundlauf > 0.01 ? 1.5 : 1) + 1.5 * bue + 0.25 * this.amp + 2 * w.VB + (gleichlauf < 0.5 ? 0.35 : 0) + 3 * Math.max(0, w.aufschweiss - 0.5);

      // Umkehrspiel (konventionelle Maschine, Gleichlauf)
      if (m.umkehrspiel > 0 && gleichlauf > 0.4 && !this.spielGenommen) {
        var Fx = Fc * (0.85 * gleichlauf - 0.6 * (1 - gleichlauf));
        if (Fx > (m.tischReibung || 350) && Math.abs(vx) > 0) {
          this.spielGenommen = true;
          spielSprung = m.umkehrspiel * (vx >= 0 ? 1 : -1);
          var fzSpitze = fz + m.umkehrspiel / (def.z * Math.max(0.3, nRev * 0.05) );
          fzSpitze = Math.min(fzSpitze, fz + m.umkehrspiel);
          var faktor = Math.pow(fzSpitze / Math.max(fz, 0.005), 1 - mat.mc);
          this.ev.add(this.zeit, 'tischZieht', 'Der Tisch hat gezogen! Im Gleichlauf hat der Fräser das Umkehrspiel (' + nf(m.umkehrspiel, 2) +
            ' mm) der Tischspindel herausgerissen. Auf konventionellen Maschinen im Gegenlauf fräsen.', 'warn');
          Fc *= faktor;
          Flat *= faktor;
          M *= faktor;
          this.spitzeGezogen = faktor;
        }
      }
    } else {
      this.raAkt = this.raAkt || 1;
    }
    if (!schneidet && this.spielGenommen && Math.abs(vx) < 1e-4) { this.spielGenommen = false; }

    this.Fc = Fc; this.M = M / 1000; this.Flat = Flat; this.ae = schneidet ? g.ae : 0; this.apE = schneidet ? g.ap : 0;
    this.fz = fz; this.hm = hm;
    this.Pc = M / 1000 * this.nEff / 9550;
    if (this.Pc > this.st.maxP) { this.st.maxP = this.Pc; }

    // Durchbiegung und Wandfehler
    var lever = Math.max(1, this.auskrag - g.ap / 2);
    var delta = Flat * (lever * lever * (3 * this.auskrag - lever)) / (6 * DAT.schneidstoffe[def.stoff].E * Math.PI * Math.pow(def.kern * def.d, 4) / 64) + Flat / (this.m.kHalter || 20000);
    this.delta = delta;
    var richtY = g.beide ? 0.3 : (g.seite > 0 ? -1 : 1) * 0.8;
    this.deltaY = schneidet ? -richtY * delta * (g.seite > 0 ? 1 : -1) : 0;
    if (g.beide && schneidet) { this.deltaY = 0.3 * delta * (this.rng.next() - 0.5); }

    // Rattern
    if (schneidet) {
      var bl = this.bLim(kc, ze);
      this.bLimAkt = bl;
      if (g.ap > bl) {
        var wachs = 2 * Math.PI * this.fn * this.zeta * (g.ap / bl - 1) * 0.12;
        this.amp += (this.amp + 0.3) * Math.min(wachs, 40) * dt;
        var sat = 5 + 40 * Math.min(2, g.ap / bl - 1);
        if (this.amp > sat) { this.amp = sat; }
        if (this.amp > 4) { this.ev.einmalig(this.zeit, 'rattern', 'Der Fräser rattert (' + Math.round(this.fn) + ' Hz). Schnitttiefe reduzieren oder Drehzahl verschieben.', 'warn', 6); }
      } else {
        this.amp = Math.max(0, this.amp - this.amp * 5 * dt - 2 * dt);
      }
    } else {
      this.amp = Math.max(0, this.amp - this.amp * 5 * dt - 2 * dt);
    }
    if (this.amp > this.st.maxAmp) { this.st.maxAmp = this.amp; }

    // Werkzeugbelastung
    var stoff = DAT.schneidstoffe[def.stoff];
    var Fspitze = Flat * (1 + 0.5 / Math.max(ze, 0.5)) * (1 + this.amp / 50);
    var sigB = Fspitze * lever / this.Wb;
    var tau = M / (2 * this.Wb);
    var sigV = Math.sqrt(sigB * sigB + 3 * tau * tau);
    var dyn = istVHM(def.stoff) ? 1 / 0.55 : 1 / 0.6;
    var r = belastung(w, sigV * dyn, dt, w.T);
    this.r = r;
    if (r > this.st.maxR) { this.st.maxR = r; }

    // Aufschweissen (Aluminium)
    if (schneidet && mat.kleben > 0.3) {
      var affin = stoff.alAffin ? 2.0 : (def.al ? 0.2 : 0.8);
      var rate = mat.kleben * affin * (kd.schmier > 0.3 || kd.kuehl > 0.5 ? 0.12 : 1) * (0.5 + w.T / 400) * 0.06;
      w.aufschweiss = Math.min(2, w.aufschweiss + rate * dt);
      if (w.aufschweiss > 0.8) { this.ev.einmalig(this.zeit, 'aufschweiss', 'Aluminium schweißt in die Spannuten auf. Die Spanräume setzen sich zu.', 'warn', 6); }
    }

    // Auszug aus der Spannzange
    if (schneidet && !this.p.weldon) {
      var halt = this.m.cnc ? 9000 : 4200;
      if (Fax > halt * w.festigkeit) {
        this.auszug += dt * 0.6;
        this.ev.einmalig(this.zeit, 'auszug', 'Der Fräser zieht sich aus der Spannzange (Axialkraft ' + Math.round(Fax) + ' N)! Die Nut wird tiefer.', 'warn', 5);
      }
    }

    // Temperatur und Verschleiss
    if (schneidet) {
      var Tss = tempStat(mat, vc, Math.max(hm, 0.005), 0.7, kd.temp) + 220 * w.VB + 150 * Math.max(0, w.aufschweiss - 0.5);
      w.T += (Tss - w.T) * Math.min(1, dt / 1.2);
      var tL = standzeitMin(vc, this.vcRef, stoff.invN, 30) * Math.pow(this.fzRef / Math.max(fz, 0.003), 0.3);
      var dVB = 0.3 / (tL * 60) * mat.abr * verschleissThermisch(w.T, stoff.tSoft) * (gleichlauf < 0.5 ? 1.3 : 1) * (hm < 0.008 ? 2 : 1);
      w.VB = Math.min(1.2, w.VB + dVB * dt);
      w.einsatz += dt;
      this.st.schnittZeit += dt;
    } else {
      var tauK = kd.kuehl > 0 ? 2 / kd.kuehl : 7;
      w.T += (T_UMG - w.T) * Math.min(1, dt / tauK);
    }
    if (w.T > w.maxT) { w.maxT = w.T; }

    // Bewegung und Abtrag
    var xAlt = this.x;
    this.x += vx * dt + spielSprung;
    if (Math.abs(this.x - (this.xAbtrag === undefined ? -1e9 : this.xAbtrag)) > FX * 0.5 || spielSprung) {
      this.abtragen();
      this.xAbtrag = this.x;
    }
    if (schneidet && !this.pass) { this.pass = { z: this.zT, y: this.y, start: this.zeit }; }
    if (!schneidet && this.pass && Math.abs(this.x - xAlt) > 0 && (this.x - this.R > this.L || this.x + this.R < 0)) {
      this.pass = null;
      this.st.passes += 1;
      this.spielGenommen = false;
    }
    if (schneidet && g.ae < 1.95 * this.R) {
      this.raWand = this.raAkt;
    }

    if (r >= 1 || w.schaden >= 1) {
      this.bruch(this.bruchText(r, sigB, tau, g, fz), this.M);
    }
  };

  FraesSim.prototype.bruchText = function (r, sigB, tau, g, fz) {
    var w = this.w, def = this.def;
    if (this.spitzeGezogen && this.spitzeGezogen > 1.3) {
      return { art: 'spiel', text: 'Der Tisch hat im Gleichlauf gezogen – die schlagartig erhöhte Spanungsdicke hat den Fräser abgeschert.' };
    }
    if (w.aufschweiss > 1) {
      return { art: 'aufschweiss', text: 'Die Spannuten sind mit aufgeschweißtem Aluminium zugesetzt. Der Fräser konnte keine Späne mehr aufnehmen und ist gebrochen. Alufräser (poliert, unbeschichtet) und Kühlschmierung verwenden.' };
    }
    if (this.amp > 15) {
      return { art: 'rattern', text: 'Rattern hat den Fräser zerrüttet.' };
    }
    if (g.ap > 1.6 * def.d) {
      return { art: 'tiefe', text: 'Zu große Schnitttiefe: ap = ' + nf(g.ap, 1) + ' mm bei Ø ' + def.d + ' mm. Biegespannung ' + Math.round(sigB) + ' N/mm².' };
    }
    if (fz > 1.8 * this.fzRef) {
      return { art: 'vorschub', text: 'Zu hoher Zahnvorschub: fz = ' + nf(fz, 3) + ' mm (empfohlen ≈ ' + nf(this.fzRef, 3) + ' mm). Biegebruch.' };
    }
    if (w.T > w.stoff.tSoft) {
      return { art: 'hitze', text: 'Überhitzt (' + Math.round(w.T) + ' °C).' };
    }
    return { art: 'biegung', text: 'Biegebruch am Schaft (' + Math.round(sigB) + ' N/mm²). Auskraglänge ' + Math.round(this.auskrag) + ' mm.' };
  };

  FraesSim.prototype.bruch = function (u, mNm) {
    var w = this.w;
    if (w.gebrochen) { return; }
    w.gebrochen = true;
    w.bruch = u;
    this.ev.add(this.zeit, 'bruch', u.text, 'fehler', { titel: 'Fräserbruch' });
  };

  FraesSim.prototype.anzeige = function () {
    var w = this.w;
    return {
      n: this.nEff, vc: this.vc || 0, fz: this.fz, vf: this.fz * this.def.z * this.nEff, ap: this.apE, ae: this.ae,
      Fc: this.Fc, M: this.M, P: this.Pc, pMax: this.m.P * this.m.eta, last: this.Pc / (this.m.P * this.m.eta),
      T: w.T, tSoft: w.stoff.tSoft, VB: w.VB, amp: this.amp, bLim: this.bLimAkt, fn: this.fn,
      r: this.r || 0, delta: this.delta, x: this.x, y: this.y, z: this.zT, gleichlauf: this.gleichlauf,
      aufschweiss: w.aufschweiss, gebrochen: w.gebrochen, vcRef: this.vcRef, fzRef: this.fzRef, auszug: this.auszug
    };
  };

  // Auswertung eines Nut- oder Absatzquerschnitts an der Stelle x
  FraesSim.prototype.querschnitt = function (xPos, tGrenze) {
    var ix = clamp(Math.floor(xPos / FX), 0, this.NX - 1);
    var iy, y0 = -1, y1 = -1, tMax = 0, ra = 0;
    for (iy = 0; iy < this.NY; iy++) {
      var t = this.tiefe[ix * this.NY + iy];
      if (t >= tGrenze) {
        if (y0 < 0) { y0 = iy; }
        y1 = iy;
      }
      if (t > tMax) { tMax = t; ra = this.raBoden[ix * this.NY + iy]; }
    }
    if (y0 >= 0 && this.wandR[ix] > this.wandL[ix]) {
      return { y0: Math.max(0, this.wandL[ix]), y1: Math.min(this.B, this.wandR[ix]), tiefe: tMax, raBoden: ra };
    }
    return { y0: y0 < 0 ? null : y0 * FY, y1: y1 < 0 ? null : (y1 + 1) * FY, tiefe: tMax, raBoden: ra };
  };

  // ------------------------------------------------------------ Empfehlung
  function empfehlung(mat, def, maschine) {
    var vc = vcRef(mat, def);
    var d = def.typ === 'platte' ? null : def.d;
    var r = { vc: vc };
    if (d) {
      r.n = vc * 1000 / (Math.PI * d);
      if (maschine && maschine.drehzahlen) { r.nStufe = DAT.stufeUnter(maschine.drehzahlen, r.n); }
    }
    if (def.typ === 'bohrer' || def.typ === 'reibahle') { r.f = fRef(mat, def); }
    if (def.typ === 'gewinde') { r.f = def.P; }
    if (def.typ === 'fraeser') {
      r.fz = fRef(mat, def);
      if (r.n) { r.vf = r.fz * def.z * r.n; }
    }
    if (def.typ === 'platte') { r.f = (def.fMin + def.fMax) / 2; }
    return r;
  }

  ZM.physik = {
    Zufall: Zufall,
    Werkzeug: Werkzeug,
    BohrSim: BohrSim,
    DrehSim: DrehSim,
    FraesSim: FraesSim,
    kcKienzle: kcKienzle,
    vcRef: vcRef,
    fRef: fRef,
    standzeitMin: standzeitMin,
    tempStat: tempStat,
    aufbauschneide: aufbauschneide,
    anlaufFarbe: anlaufFarbe,
    empfehlung: empfehlung,
    stabilitaetsKarte: stabilitaetsKarte,
    karteWert: karteWert,
    DZ: DZ, FX: FX, FY: FY,
    nf: nf,
    T_UMG: T_UMG
  };
})(typeof window !== 'undefined' ? window : globalThis);
