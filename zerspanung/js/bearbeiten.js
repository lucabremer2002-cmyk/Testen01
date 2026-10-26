/*
 * Bearbeitung an der Maschine: Simulationsschleife, Bedienpult, Tastatur,
 * Meldungen und der Meister, der in der Stufe "Azubi" rechtzeitig warnt.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM;
  var DAT = ZM.daten, PH = ZM.physik, U = ZM.ui, h = U.h, zahl = U.zahl;
  var DT = 1 / 480;

  function Bearbeitung(spiel, k) {
    var self = this;
    this.spiel = spiel;
    this.k = k;
    this.op = k.op;
    this.stufe = spiel.stand.einstellungen.stufe;
    this.masch = DAT.maschinen[this.op.maschine];
    this.mat = DAT.werkstoffe[k.mission.mat];
    this.art = this.op.typ === 'drehen' ? 'dreh' : this.op.typ === 'fraesen' ? 'fraes' : 'bohr';
    this.cnc = !!this.masch.cnc;
    this.rng = k.rng;
    this.wkzListe = [k.wkz];
    if (k.wkz2 && k.wkz2 !== k.wkz) { this.wkzListe.push(k.wkz2); }
    this.messungen = [];
    this.sicherheit = 0;
    this.wichtig = [];
    this.warnZeit = {};
    this.verlauf = [];
    this.faktor = 1;
    this.inp = { spindel: false, kss: false, kraft: 0, auto: false, notaus: false, ovF: 1, ovS: 1, vorschub: false, zHand: 0, xHand: 0, eil: false, xZiel: null, zZiel: null, yZiel: null, umsteuern: false, plan: false, klemmen: false };
    this.tasten = {};
    this.beendet = false;
    this.cncZustand = null;

    var op = this.op, p = k.setup.param;
    if (this.art === 'bohr') {
      this.sim = new PH.BohrSim({
        mat: this.mat, wkz: k.wkz, masch: this.masch, param: p,
        op: { dicke: op.dicke, durch: op.durch, anzahl: op.pos.length }, vor: k.vor, rng: this.rng
      });
      this.szene = new ZM.szenen.BohrSzene(this.sim, op);
    } else if (this.art === 'dreh') {
      this.sim = new PH.DrehSim({ mat: this.mat, wkz: k.wkz, masch: this.masch, param: p, op: { wst: op.wst }, rng: this.rng });
      if (this.cnc) {
        // Revolver: T1 schruppen, T2 schlichten; Start am Wechselpunkt
        this.revolver = { 1: k.wkz, 2: k.wkz2 || k.wkz };
        this.korr = { 1: { x: 0, z: 0 }, 2: { x: 0, z: 0 } };
        this.sim.x = 100;
        this.sim.z = p.zW + 150;
        this.sim.xZiel = this.sim.x;
      } else {
        this.xZiel = Math.round((op.wst.D + 6) * 10) / 10;
        this.inp.xZiel = this.xZiel;
        this.zNull = 0;
      }
      this.szene = new ZM.szenen.DrehSzene(this.sim);
    } else {
      this.sim = new PH.FraesSim({ mat: this.mat, wkz: k.wkz, masch: this.masch, param: p, op: { wst: op.wst, y: op.y }, rng: this.rng });
      this.szene = new ZM.szenen.FraesSzene(this.sim);
      this.zZiel = 0;
      this.inp.zZiel = 0;
    }
    this.ncZeilen = k.setup.nc ? k.setup.nc.split('\n') : null;

    this.aufbauen();
    // Spielebene: Schichtpunkte und Combo fuer sauberes Zerspanen
    this.schicht = ZM.belohnung ? new ZM.belohnung.Schicht(this) : null;
    this.tastenAn();
    this.letzte = null;
    this.hudZeit = 0;
    this.scopeZeit = 0;
    this.meisterZeit = 0;
    this.raf = root.requestAnimationFrame(function (t) { self.schleife(t); });
    this.log('Arbeitsplatz gerüstet: ' + (k.setup.def.bez || k.setup.def.name) + ', n = ' + p.n + ' 1/min.', 'info');
    if (p.psa && !this.cnc) {
      if (!p.psa.brille) {
        this.sicherheit += 1;
        this.log('Ohne Schutzbrille an der Maschine – Späne fliegen dir in die Augen. Verstoß gegen die Betriebsanweisung.', 'fehler');
        this.live('Schutzbrille fehlt!', true);
      }
      if (p.psa.handschuhe) {
        this.sicherheit += 1;
        this.log('Handschuhe an einer Maschine mit drehender Spindel! Der Handschuh wird erfasst und die Hand mit hineingezogen. Verstoß gegen die Betriebsanweisung.', 'fehler');
        this.live('Keine Handschuhe an drehenden Spindeln!', true);
      }
    }
    if (this.stufe === 'azubi') { this.meisterSagt(this.einstiegsTipp()); }
  }

  Bearbeitung.prototype.einstiegsTipp = function () {
    if (this.art === 'bohr') {
      if (this.cnc) { return 'NC-Start drücken. Mit dem Vorschub-Override kannst du jederzeit eingreifen.'; }
      if (this.sim.typ === 'gewinde') { return 'Spindel an, Hebel leicht ziehen, bis der Gewindebohrer anschneidet. Er zieht sich dann selbst rein.'; }
      return 'Spindel an (Enter), dann den Hebel ziehen: Pfeil ↓ erhöht die Kraft, ↑ nimmt sie zurück, R fährt ganz zurück.';
    }
    if (this.art === 'dreh' && this.cnc) { return 'Erst im Einzelsatz (E) und mit kleinem Override einfahren. NC-Start (Enter) arbeitet Satz für Satz ab, NC-Stopp (S) hält an.'; }
    if (this.art === 'dreh' && this.op.plan && !this.op.d && !this.op.kontur) { return 'Meißel vor die Stirnseite fahren, Spindel an, ankratzen und Z nullen (0). Bettschlitten klemmen (B), mit dem Oberschlitten zustellen und den Planzug einlegen (P).'; }
    if (this.art === 'dreh') { return 'Erst X-Zielmaß eingeben und zustellen, solange der Meißel rechts vom Werkstück steht. Dann Spindel an und Vorschub (V). Planen geht mit dem Planzug (P).'; }
    return this.cnc ? 'NC-Start fährt das Programm Schnitt für Schnitt ab.' : 'Tiefe außerhalb des Werkstücks zustellen, Spindel an, dann Vorschub (V).';
  };

  // ============================================================ Aufbau
  Bearbeitung.prototype.aufbauen = function () {
    var self = this, op = this.op, k = this.k;
    var kopf = U.leeren(U.$('#bb-kopf'));
    var soll = '';
    if (op.typ === 'drehen') {
      var K = DAT.drehKontur(op), teile = [];
      K.stufen.forEach(function (st) {
        var t = DAT.toleranz(st.d, st.tol);
        teile.push('Ø ' + DAT.fmtD(st.d) + ' ' + String(st.tol).replace(/\./g, ',') + ' (' + DAT.fmtD(st.d + t.u) + ' … ' + DAT.fmtD(st.d + t.o) + ') auf ' + DAT.fmtD(st.bis) + ' mm');
      });
      if (K.plan) { teile.push('Gesamtlänge ' + DAT.fmtD(K.plan.gesamt) + ' ±' + DAT.fmtD(K.plan.tol)); }
      soll = 'Soll ' + teile.join(' · ');
    } else if (op.typ === 'fraesen') {
      soll = 'Soll Nut ' + DAT.fmtD(op.breite) + ' ' + op.breiteTol.replace(/\./g, ',') + ' × ' + DAT.fmtD(op.tiefe) + ' ' + op.tiefeTol.replace(/\./g, ',');
    } else if (op.typ === 'gewinde') {
      soll = op.gw + (op.durch ? ' durchgehend, Dicke ' + DAT.fmtD(op.dicke) + ' mm' : ' × ' + DAT.fmtD(op.tiefe));
    } else {
      soll = (op.d ? 'Ø ' + DAT.fmtD(op.d) + (op.tol && op.tol !== '2768-m' ? ' ' + op.tol.replace(/\./g, ',') : '') : 'Vorbohrung') + (op.durch ? ', durch ' + DAT.fmtD(op.dicke) + ' mm' : ', ' + DAT.fmtD(op.tiefe) + ' tief');
    }
    this.elZeit = h('span.chip', '0:00');
    kopf.appendChild(h('h2', op.name));
    kopf.appendChild(h('span.soll', soll));
    kopf.appendChild(h('span.muted', this.masch.name));
    var rechts = h('div.rechts', [this.elZeit]);
    if (this.spiel.stand.einstellungen.zeitraffer) {
      var zr = h('div.stufen', { role: 'group', 'aria-label': 'Zeitraffer' });
      [1, 2, 4].forEach(function (f) {
        zr.appendChild(h('button', { type: 'button', 'aria-pressed': f === 1 ? 'true' : 'false', onclick: function () {
          self.faktor = f;
          U.$$('button', zr).forEach(function (b) { b.setAttribute('aria-pressed', b.textContent === f + '×' ? 'true' : 'false'); });
        } }, f + '×'));
      });
      rechts.appendChild(zr);
    }
    rechts.appendChild(h('button.knopf.knopf--klein', { type: 'button', onclick: function () { self.fragenBeenden(); } }, 'Arbeitsgang beenden'));
    kopf.appendChild(rechts);

    this.cv = U.$('#szene');
    U.leeren(U.$('#log'));
    U.leeren(U.$('#live'));
    U.$('#overlay').hidden = true;
    this.pultAufbauen();
    this.bedienAufbauen();
  };

  function balken(name, einheit) {
    var fill = h('div.balken__fuell');
    var grenze = h('div.balken__grenze', { hidden: true });
    var wert = h('span.balken__wert', '–');
    var el = h('div.balken', [h('span.balken__name', name), h('div.balken__spur', [fill, grenze]), wert]);
    return { el: el, fill: fill, grenze: grenze, wert: wert, einheit: einheit };
  }

  Bearbeitung.prototype.pultAufbauen = function () {
    var pult = U.leeren(U.$('#pult'));
    var st = this.stufe, art = this.art, cnc = this.cnc;
    var vfd = h('div.vfd');
    var hud = this.hud = { vfd: {}, b: {} };
    function zeile(key, name, einheit) {
      var w = h('span', '–');
      vfd.appendChild(h('div.vfd__zeile', [h('span', name), h('span', [w, h('small', einheit)])]));
      hud.vfd[key] = w;
    }
    if (art === 'bohr') {
      zeile('z', 'Z', 'mm');
      if (st !== 'meister' || cnc) { zeile('n', 'S', '1/min'); }
      if (st !== 'meister') { zeile('f', 'F', this.sim.typ === 'gewinde' ? 'mm/U' : 'mm/U'); zeile('vc', 'vc', 'm/min'); }
    } else if (art === 'dreh') {
      zeile('x', 'X Ø', 'mm');
      zeile('z', cnc ? 'Z (W)' : 'Z', 'mm');
      if (st !== 'meister' || cnc) { zeile('n', 'S', '1/min'); zeile('vc', 'vc', 'm/min'); }
      if (cnc) { zeile('f', 'F', 'mm/U'); zeile('t', 'T', ''); }
    } else {
      zeile('x', 'X', 'mm');
      zeile('y', 'Y', 'mm');
      zeile('z', 'Z', 'mm');
      if (st !== 'meister' || cnc) { zeile('n', 'S', '1/min'); zeile('vf', 'F', 'mm/min'); }
    }
    pult.appendChild(vfd);

    var mess = h('div.mess');
    var add = function (key, name, einheit) { var b = balken(name, einheit); hud.b[key] = b; mess.appendChild(b.el); };
    if (st === 'azubi') {
      if (art === 'bohr') {
        add('M', 'Drehmoment', 'Nm');
        add('F', 'Vorschubkraft', 'N');
        add('phi', 'Spanraum', '%');
        add('T', 'Schneide', '°C');
        add('VB', 'Verschleiß VB', 'mm');
        add('P', 'Leistung', 'kW');
      } else if (art === 'dreh') {
        add('P', 'Leistung', 'kW');
        add('mo', cnc ? 'Spindellast' : 'Moment / Nennmoment', '%');
        add('pl', 'Plattenlast', '%');
        add('amp', 'Schwingung', 'µm');
        add('T', 'Schneide', '°C');
        add('VB', 'Verschleiß VB', 'mm');
        add('d', 'Durchbiegung', 'µm');
        add('Tw', 'Werkstück', '°C');
      } else {
        add('r', 'Fräserlast', '%');
        add('P', 'Leistung', 'kW');
        add('amp', 'Schwingung', 'µm');
        add('T', 'Schneide', '°C');
        add('VB', 'Verschleiß VB', 'mm');
        add('d', 'Abdrängung', 'µm');
        if (this.mat.kleben > 0.3) { add('al', 'Aufschweißung', '%'); }
      }
    } else if (st === 'geselle' || cnc) {
      add('last', 'Spindellast', '%');
      if (st === 'geselle' && art === 'bohr') { add('T', 'Schneide', '°C'); }
    }
    if (mess.childNodes.length) {
      pult.appendChild(h('h3', st === 'azubi' ? 'Messwerte (Kraftmessplattform)' : 'Maschine'));
      pult.appendChild(mess);
    }
    if (st !== 'meister') {
      this.scope = h('canvas#scope');
      pult.appendChild(h('h3', st === 'azubi' ? (art === 'bohr' ? 'Drehmoment und Bruchgrenze' : art === 'dreh' ? 'Leistung und Plattenlast' : 'Fräserbelastung') : 'Spindellast'));
      pult.appendChild(this.scope);
    } else {
      this.scope = null;
    }
    if (art === 'dreh' && st !== 'meister') {
      hud.span = h('p.muted', 'Spanform: –');
      pult.appendChild(hud.span);
    }
    if (this.ncZeilen) {
      this.ncEl = h('pre.nc');
      pult.appendChild(h('h3', 'NC-Programm'));
      pult.appendChild(this.ncEl);
      this.ncAkt = -1;
      this.ncZeichnen(-1);
    }
    this.messEl = h('div');
    pult.appendChild(this.messEl);
    pult.appendChild(h('h3', 'Werkzeug'));
    this.wkzEl = h('p.muted', { style: 'font-size:13px' });
    pult.appendChild(this.wkzEl);
  };

  Bearbeitung.prototype.ncZeichnen = function (akt) {
    if (!this.ncEl || akt === this.ncAkt) { return; }
    this.ncAkt = akt;
    var el = U.leeren(this.ncEl);
    this.ncZeilen.forEach(function (z, i) {
      el.appendChild(h(i === akt ? 'span.akt' : 'span', z + '\n'));
    });
  };

  function knopf(text, taste, klasse, klick) {
    var b = h('button.knopf' + (klasse ? '.' + klasse : ''), { type: 'button', onclick: klick }, [text, taste ? h('kbd', taste) : null]);
    return b;
  }

  Bearbeitung.prototype.bedienAufbauen = function () {
    var self = this, bed = U.leeren(U.$('#bedien'));
    var art = this.art, cnc = this.cnc, sim = this.sim;
    this.kn = {};
    var g1 = h('div.gruppe');
    if (cnc) {
      this.kn.start = knopf('NC-Start', 'Enter', 'knopf--gruen', function () { self.ncStart(); });
      this.kn.stopp = knopf('NC-Stopp', 'S', null, function () { self.ncStopp(); });
      g1.appendChild(this.kn.start);
      g1.appendChild(this.kn.stopp);
    } else {
      this.kn.spindel = knopf('Spindel', 'Enter', 'knopf--gruen', function () { self.spindel(); });
      g1.appendChild(this.kn.spindel);
    }
    this.kn.kss = knopf('KSS', 'K', null, function () { self.kss(); });
    g1.appendChild(this.kn.kss);
    bed.appendChild(g1);
    bed.appendChild(h('div.trenner'));

    if (art === 'bohr' && !cnc) {
      var rng = h('input#hebel', { type: 'range', min: '-100', max: '100', step: '1', value: '0', 'aria-label': 'Hebelkraft',
        oninput: function (e) { self.inp.kraft = parseInt(e.target.value, 10) / 100; } });
      this.hebelOut = h('output', { for: 'hebel' }, '0 N');
      this.hebel = rng;
      bed.appendChild(h('div.hebel', [h('span.gruppe__titel', 'Hebel'), rng, this.hebelOut]));
      var g2 = h('div.gruppe');
      g2.appendChild(knopf('Zurück', 'R', null, function () { self.zurueck(); }));
      if (this.k.setup.param.vorschubAuto) {
        this.kn.auto = knopf('Auto-Vorschub', 'A', null, function () { self.auto(); });
        g2.appendChild(this.kn.auto);
      }
      if (sim.typ === 'gewinde') { g2.appendChild(knopf('Umsteuern', 'U', null, function () { self.inp.umsteuern = true; })); }
      g2.appendChild(knopf('Nächste Bohrung', 'N', null, function () { self.naechste(); }));
      bed.appendChild(g2);
    } else if (art === 'bohr' && cnc) {
      bed.appendChild(this.override());
    } else if (art === 'dreh' && cnc) {
      var gc = h('div.gruppe');
      this.kn.einzel = knopf('Einzelsatz', 'E', null, function () { self.einzelsatz(); });
      gc.appendChild(this.kn.einzel);
      gc.appendChild(knopf('Reset', 'R', null, function () { self.ncReset(); }));
      bed.appendChild(gc);
      bed.appendChild(this.override());
      var gk = h('div.gruppe');
      gk.appendChild(knopf('Messen', 'M', null, function () { self.messen(); }));
      gk.appendChild(knopf('Korrektur', 'O', null, function () { self.korrekturFenster(); }));
      gk.appendChild(knopf('Späne', 'H', null, function () { self.spaene(); }));
      gk.appendChild(knopf('Platte', 'W', null, function () { self.platte(); }));
      bed.appendChild(gk);
    } else if (art === 'dreh') {
      var g3 = h('div.gruppe');
      this.kn.vorschub = knopf('Längszug', 'V', null, function () { self.vorschub(); });
      this.kn.plan = knopf('Planzug', 'P', null, function () { self.planzug(); });
      this.kn.klemmen = knopf('Bettschlitten klemmen', 'B', null, function () { self.klemmen(); });
      g3.appendChild(this.kn.vorschub);
      g3.appendChild(this.kn.plan);
      g3.appendChild(this.halteKnopf('◀', '←', function (v) { self.inp.zHand = v ? -1 : 0; }));
      g3.appendChild(this.halteKnopf('▶', '→', function (v) { self.inp.zHand = v ? 1 : 0; }));
      g3.appendChild(this.kn.klemmen);
      bed.appendChild(g3);
      var xin = h('input#x-ziel', { type: 'number', step: '0.01', value: String(this.xZiel), 'aria-label': 'X-Zielmaß Durchmesser',
        onkeydown: function (e) { if (e.key === 'Enter') { self.xSetzen(parseFloat(String(e.target.value).replace(',', '.'))); e.target.blur(); } } });
      this.xIn = xin;
      var gx = h('div.gruppe', [h('span.gruppe__titel', 'X Ø'), h('div.xeingabe', [xin,
        knopf('Anfahren', null, 'knopf--klein', function () { self.xSetzen(parseFloat(String(xin.value).replace(',', '.'))); })])]);
      [-1, -0.1, -0.02, 0.02, 0.1, 1].forEach(function (d) {
        gx.appendChild(knopf((d > 0 ? '+' : '−') + DAT.fmtD(Math.abs(d)), null, 'knopf--klein', function () { self.xSetzen(self.xZiel + d); }));
      });
      bed.appendChild(gx);
      // Oberschlitten: Planzustellung in Z, relativ zum gesetzten Nullpunkt
      var zin = h('input#z-ober', { type: 'number', step: '0.01', value: '', placeholder: 'Z rel.', 'aria-label': 'Oberschlitten Z-Ziel relativ zum Nullpunkt',
        onkeydown: function (e) { if (e.key === 'Enter') { self.oberSetzen(parseFloat(String(e.target.value).replace(',', '.'))); e.target.blur(); } } });
      this.zIn = zin;
      var gz = h('div.gruppe', [h('span.gruppe__titel', 'Oberschlitten Z'), h('div.xeingabe', [zin,
        knopf('Anfahren', null, 'knopf--klein', function () { self.oberSetzen(parseFloat(String(zin.value).replace(',', '.'))); })])]);
      [-1, -0.1, -0.02, 0.02, 0.1, 1].forEach(function (d) {
        gz.appendChild(knopf((d > 0 ? '+' : '−') + DAT.fmtD(Math.abs(d)), null, 'knopf--klein', function () { self.oberRelativ(d); }));
      });
      gz.appendChild(knopf('Z nullen', '0', 'knopf--klein', function () { self.zNullen(); }));
      bed.appendChild(gz);
      bed.appendChild(this.getriebe());
      var g4 = h('div.gruppe');
      g4.appendChild(knopf('Messen', 'M', null, function () { self.messen(); }));
      g4.appendChild(knopf('Späne', 'H', null, function () { self.spaene(); }));
      g4.appendChild(knopf('Platte', 'W', null, function () { self.platte(); }));
      bed.appendChild(g4);
    } else if (art === 'fraes' && !cnc) {
      var g5 = h('div.gruppe');
      this.kn.vorschub = knopf('Vorschub X+', 'V', null, function () { self.vorschub(); });
      g5.appendChild(this.kn.vorschub);
      g5.appendChild(this.halteKnopf('◀', '←', function (v) { self.inp.xHand = v ? -1 : 0; }));
      g5.appendChild(this.halteKnopf('▶', '→', function (v) { self.inp.xHand = v ? 1 : 0; }));
      g5.appendChild(knopf('Eilgang zurück', 'R', null, function () { self.eilZurueck(); }));
      bed.appendChild(g5);
      var zin = h('input#z-ziel', { type: 'number', step: '0.1', min: '0', value: '0', 'aria-label': 'Zustelltiefe',
        onkeydown: function (e) { if (e.key === 'Enter') { self.zSetzen(parseFloat(String(e.target.value).replace(',', '.'))); e.target.blur(); } } });
      this.zIn = zin;
      var gz = h('div.gruppe', [h('span.gruppe__titel', 'Tiefe'), h('div.xeingabe', [zin, knopf('Zustellen', null, 'knopf--klein', function () { self.zSetzen(parseFloat(String(zin.value).replace(',', '.'))); })])]);
      [0.5, 1, 2].forEach(function (d) { gz.appendChild(knopf('+' + DAT.fmtD(d), null, 'knopf--klein', function () { self.zSetzen(self.zZiel + d); })); });
      bed.appendChild(gz);
      bed.appendChild(h('div.gruppe', [knopf('Messen', 'M', null, function () { self.messen(); }), knopf('Fräser', 'W', null, function () { self.fraeserNeu(); })]));
    } else {
      bed.appendChild(this.override());
      bed.appendChild(h('div.gruppe', [knopf('Messen', 'M', null, function () { self.messen(); }), knopf('Fräser', 'W', null, function () { self.fraeserNeu(); })]));
    }
    this.kn.notaus = h('button.notaus', { type: 'button', onclick: function () { self.notaus(); }, 'aria-label': 'Not-Aus (Leertaste)' }, ['NOT', h('br'), 'AUS']);
    bed.appendChild(h('div', { style: 'margin-left:auto' }, this.kn.notaus));
  };

  // Hebel am Spindelstock und am Vorschubgetriebe der konventionellen Drehmaschine:
  // geschaltet wird nur bei stehender Spindel und ausgekuppeltem Zug (z. B. Schruppen, dann Schlichten)
  Bearbeitung.prototype.getriebe = function () {
    var self = this, m = this.masch, p = this.k.setup.param;
    function wahl(titel, label, werte, key, text, einheit) {
      var sel = h('select', { 'aria-label': label, onchange: function (e) {
        var v = parseFloat(e.target.value), sim = self.sim;
        var grund = sim.nEff > 1 || self.inp.spindel ? 'Getriebe nur bei stehender Spindel schalten – sonst schlagen die Zahnräder aus.' :
          self.inp.vorschub || self.inp.plan ? 'Erst Längs- bzw. Planzug auskuppeln.' : null;
        if (grund) { e.target.value = String(p[key]); self.log(grund, 'warn'); return; }
        p[key] = v;
        self.klick();
        self.log(label + ' auf ' + text(v) + ' ' + einheit + ' geschaltet.', 'info');
      } });
      werte.forEach(function (v) {
        var o = h('option', { value: String(v) }, text(v));
        if (v === p[key]) { o.selected = true; }
        sel.appendChild(o);
      });
      return h('div.hebel', [h('span.gruppe__titel', titel), sel]);
    }
    return h('div.gruppe', [
      wahl('n 1/min', 'Drehzahl', m.drehzahlen, 'n', function (v) { return String(v); }, '1/min'),
      wahl('f mm/U', 'Längsvorschub', m.vorschuebe, 'f', function (v) { return DAT.fmtD(v); }, 'mm/U')
    ]);
  };

  Bearbeitung.prototype.override = function () {
    var self = this;
    var f = h('input', { type: 'range', min: '0', max: '120', step: '10', value: '100', 'aria-label': 'Vorschub-Override',
      oninput: function (e) { self.inp.ovF = parseInt(e.target.value, 10) / 100; self.ovFOut.textContent = e.target.value + ' %'; } });
    var s = h('input', { type: 'range', min: '50', max: '150', step: '5', value: '100', 'aria-label': 'Spindel-Override',
      oninput: function (e) { self.inp.ovS = parseInt(e.target.value, 10) / 100; self.ovSOut.textContent = e.target.value + ' %'; } });
    this.ovFEl = f;
    this.ovSEl = s;
    this.ovFOut = h('output', '100 %');
    this.ovSOut = h('output', '100 %');
    return h('div.gruppe', [
      h('div.hebel', [h('span.gruppe__titel', 'F%'), f, this.ovFOut]),
      h('div.hebel', [h('span.gruppe__titel', 'S%'), s, this.ovSOut])
    ]);
  };

  Bearbeitung.prototype.halteKnopf = function (text, taste, setzen) {
    var b = knopf(text, taste, 'knopf--klein', null);
    var an = function (e) { e.preventDefault(); setzen(true); };
    var aus = function () { setzen(false); };
    b.addEventListener('pointerdown', an);
    b.addEventListener('pointerup', aus);
    b.addEventListener('pointerleave', aus);
    b.addEventListener('pointercancel', aus);
    return b;
  };

  // ============================================================ Bedienung
  Bearbeitung.prototype.klick = function () { if (this.spiel.klang) { this.spiel.klang.klick(); } };

  Bearbeitung.prototype.spindel = function () {
    if (this.inp.notaus) { this.log('Erst den Not-Aus entriegeln.', 'warn'); return; }
    this.klick();
    this.inp.spindel = !this.inp.spindel;
    this.log(this.inp.spindel ? 'Spindel ein.' : 'Spindel aus.', 'info');
  };

  Bearbeitung.prototype.kss = function () {
    this.klick();
    if (this.k.setup.param.kss === 'trocken') {
      this.log('Gerüstet ist Trockenbearbeitung – kein Kühlschmierstoff vorgesehen.', 'info');
      this.inp.kss = false;
      return;
    }
    this.inp.kss = !this.inp.kss;
  };

  Bearbeitung.prototype.auto = function () {
    this.klick();
    if (this.sim.autoAus && !this.inp.auto) { this.sim.autoAus = false; }
    this.inp.auto = !this.inp.auto;
    if (!this.inp.auto) { this.sim.autoAus = false; }
    this.log(this.inp.auto ? 'Automatischer Vorschub eingekuppelt.' : 'Automatischer Vorschub ausgekuppelt.', 'info');
  };

  Bearbeitung.prototype.zurueck = function () {
    var self = this;
    this.setKraft(-1);
    this.inp.auto = false;
    clearTimeout(this.zurueckT);
    this.zurueckT = setTimeout(function () { if (self.inp.kraft < 0) { self.setKraft(0); } }, 900);
  };

  Bearbeitung.prototype.setKraft = function (v) {
    this.inp.kraft = Math.max(-1, Math.min(1, v));
    if (this.hebel) { this.hebel.value = String(Math.round(this.inp.kraft * 100)); }
  };

  Bearbeitung.prototype.naechste = function () {
    var sim = this.sim;
    if (sim.fertig) { return; }
    if (sim.z > -0.5 && !sim.w.gebrochen) { this.log('Erst das Werkzeug aus der Bohrung fahren (R).', 'warn'); return; }
    if (sim.typ === 'gewinde' && sim.gew.phase !== 'fertig' && sim.gew.phase !== 'bereit' && !sim.w.gebrochen) {
      this.log('Der Gewindebohrer ist noch nicht ausgefahren.', 'warn');
      return;
    }
    var gebohrt = sim.typ === 'gewinde' ? sim.gew.zMax > sim.def.anschnitt : sim.zMax > 0.3;
    if (!gebohrt && !sim.w.gebrochen) {
      var self = this;
      this.overlay('warn', 'Bohrung auslassen?', 'An dieser Position wurde noch nicht bearbeitet. Wenn du weitermachst, fehlt sie am Werkstück.', [
        { text: 'Zurück', aktion: function () {} },
        { text: 'Auslassen', klasse: 'knopf--rot', aktion: function () { self.lochWeiter(); } }
      ]);
      return;
    }
    this.lochWeiter();
  };

  Bearbeitung.prototype.lochWeiter = function () {
    var sim = this.sim;
    var res = sim.naechstesLoch();
    this.szene.neuesLoch();
    this.inp.auto = false;
    if (this.kn.auto) { this.kn.auto.classList.remove('knopf--an'); }
    if (!this.cnc) { this.setKraft(0); }
    var txt = 'Position ' + (res.i + 1) + ' fertig';
    if (res.typ !== 'gewinde') { txt += ': max. ' + zahl(res.maxM, 2) + ' Nm, ' + zahl(res.maxT, 0) + ' °C'; }
    this.log(txt + (res.notizen.length ? ' – ' + res.notizen.join(' ') : '') + '.', res.defekt ? 'fehler' : 'info');
    if (sim.fertig) { this.opFertig(); }
  };

  Bearbeitung.prototype.vorschub = function () {
    this.klick();
    if (this.art === 'dreh' && this.inp.plan && !this.inp.vorschub) { this.log('Erst den Planzug auskuppeln.', 'warn'); return; }
    if (this.art === 'fraes' && this.sim.x > this.sim.L + this.sim.R) { this.log('Der Tisch steht in der Endlage. Erst Eilgang zurück (R).', 'warn'); return; }
    this.inp.vorschub = !this.inp.vorschub;
    this.log(this.inp.vorschub ? 'Vorschub eingekuppelt.' : 'Vorschub ausgekuppelt.', 'info');
  };

  // ------------------------------------------------------------ Drehen konventionell
  Bearbeitung.prototype.planzug = function () {
    this.klick();
    if (this.inp.vorschub && !this.inp.plan) { this.log('Längs- und Planzug lassen sich nicht gleichzeitig einlegen.', 'warn'); return; }
    this.inp.plan = !this.inp.plan;
    if (!this.inp.plan) {
      // Planzug aus: der Querschlitten bleibt stehen, die Skala zeigt die Ist-Lage
      this.xZiel = Math.round(this.sim.x * 200) / 100;
      if (this.xIn) { this.xIn.value = this.xZiel.toFixed(2); }
    }
    this.log(this.inp.plan ? 'Planzug eingelegt (Planvorschub ' + DAT.fmtD(this.k.setup.param.f / 2) + ' mm/U).' : 'Planzug ausgekuppelt.', 'info');
  };

  Bearbeitung.prototype.klemmen = function () {
    this.klick();
    this.inp.klemmen = !this.inp.klemmen;
    this.log(this.inp.klemmen ? 'Bettschlitten geklemmt. Zustellung in Z jetzt mit dem Oberschlitten.' : 'Bettschlitten-Klemmung gelöst.', 'info');
  };

  Bearbeitung.prototype.zNullen = function () {
    this.klick();
    this.zNull = this.sim.z;
    this.log('Z genullt: Die Anzeige zeigt jetzt Z relativ zu dieser Stelle (z. B. nach dem Ankratzen an der Stirnseite).', 'info');
  };

  Bearbeitung.prototype.oberSetzen = function (zRel) {
    if (isNaN(zRel)) { return; }
    var ziel = (this.zNull || 0) + zRel;
    this.inp.zZiel = ziel;
    this.inp.zNr = (this.inp.zNr || 0) + 1;
    this.inp.zHand = 0;
    if (this.zIn) { this.zIn.value = zRel.toFixed(2); }
    this.log('Oberschlitten auf Z = ' + zahl(zRel, 2) + ' (relativ).', 'info');
  };

  Bearbeitung.prototype.oberRelativ = function (d) {
    // vom laufenden Ziel aus weiterkurbeln, sonst von der Ist-Lage (Handkurbel, Laengszug)
    var basis = this.sim.zZiel !== null && this.sim.zZiel !== undefined ? this.sim.zZiel : this.sim.z;
    this.inp.zZiel = basis + d;
    this.inp.zNr = (this.inp.zNr || 0) + 1;
    if (this.zIn) { this.zIn.value = (this.inp.zZiel - (this.zNull || 0)).toFixed(2); }
  };

  // ------------------------------------------------------------ CNC-Drehen
  Bearbeitung.prototype.laufNeu = function () {
    var self = this, p = this.k.setup.param;
    this.lauf = new ZM.nc.Lauf(this.k.setup.nc, {
      zW: p.zW,
      wechselZeit: this.masch.wechselZeit,
      werkzeug: function (nr) {
        var w = self.revolver[nr];
        if (!w) { return null; }
        var kk = self.korr[nr] || { x: 0, z: 0 };
        self.lauf.opt.zW = p.zW + kk.z;
        self.lauf.korrX = kk.x;
        return w;
      }
    });
    this.lauf.korrX = 0;
    this.lauf.einzelsatz = !!this.einzel;
    if (this.lauf.fehler.length) { this.log('Programmfehler: ' + this.lauf.fehler[0].text, 'fehler'); }
  };

  Bearbeitung.prototype.einzelsatz = function () {
    this.klick();
    this.einzel = !this.einzel;
    if (this.lauf) { this.lauf.einzelsatz = this.einzel; }
    this.log(this.einzel ? 'Einzelsatz ein: Nach jedem Satz wartet die Steuerung auf NC-Start.' : 'Einzelsatz aus.', 'info');
  };

  Bearbeitung.prototype.ncReset = function () {
    this.klick();
    this.lauf = null;
    this.sim.alarm = null;
    this.inp.spindel = false;
    this.inp.kss = false;
    this.inp.bahn = null;
    this.ncZeichnen(-1);
    this.log('Reset: Programm abgebrochen, Spindel aus. NC-Start beginnt wieder am Programmanfang.', 'info');
  };

  Bearbeitung.prototype.korrekturFenster = function () {
    var self = this, box = U.leeren(this.messEl);
    var felder = {};
    var zeilen = [1, 2].map(function (nr) {
      var kx = h('input', { type: 'number', step: '0.001', value: String(self.korr[nr].x), 'aria-label': 'Korrektur T' + nr + ' X' });
      var kz = h('input', { type: 'number', step: '0.01', value: String(self.korr[nr].z), 'aria-label': 'Korrektur T' + nr + ' Z' });
      felder[nr] = [kx, kz];
      return h('div.feld', [h('span.feld__titel', 'T' + nr + ' ' + (self.revolver[nr] ? self.revolver[nr].def.name : '')), h('div.gruppe', [h('span', 'ΔX Ø'), kx, h('span', 'ΔZ'), kz])]);
    });
    box.appendChild(h('div.messfenster', [h('h3', 'Werkzeug-Verschleißkorrektur')].concat(zeilen).concat([
      h('button.knopf.knopf--gelb', { type: 'button', onclick: function () {
        [1, 2].forEach(function (nr) {
          var x = parseFloat(String(felder[nr][0].value).replace(',', '.')), z = parseFloat(String(felder[nr][1].value).replace(',', '.'));
          self.korr[nr] = { x: isNaN(x) ? 0 : x, z: isNaN(z) ? 0 : z };
        });
        self.log('Korrektur übernommen: T1 ΔX ' + zahl(self.korr[1].x, 3) + ', T2 ΔX ' + zahl(self.korr[2].x, 3) + '. Wirkt beim nächsten Werkzeugaufruf.', 'info');
      } }, 'Übernehmen'),
      h('small.muted', 'Ist der Durchmesser 0,010 zu groß, trägst du ΔX = −0,010 ein und lässt das Programm noch einmal laufen. Die Schruppschnitte gehen dann durch die Luft.')
    ])));
  };

  Bearbeitung.prototype.xSetzen = function (v) {
    if (isNaN(v)) { return; }
    v = Math.round(v * 1000) / 1000;
    v = Math.max(1, Math.min(this.op.wst.D + 40, v));
    this.xZiel = v;
    this.inp.xZiel = v;
    this.inp.xNr = (this.inp.xNr || 0) + 1;
    if (this.xIn) { this.xIn.value = v.toFixed(2); }
  };

  Bearbeitung.prototype.zSetzen = function (v) {
    if (isNaN(v)) { return; }
    var sim = this.sim;
    v = Math.max(0, Math.min(sim.def.lc, Math.round(v * 100) / 100));
    var aussen = sim.x + sim.R < -0.5 || sim.x - sim.R > sim.L + 0.5;
    if (!aussen) { this.log('Zustellen nur außerhalb des Werkstücks. Erst zurückfahren.', 'warn'); return; }
    this.zZiel = v;
    this.inp.zZiel = v;
    if (this.zIn) { this.zIn.value = v.toFixed(2); }
    this.log('Zustellung auf ' + zahl(v, 2) + ' mm Tiefe.', 'info');
  };

  Bearbeitung.prototype.eilZurueck = function () {
    this.inp.vorschub = false;
    this.eilAktiv = true;
  };

  Bearbeitung.prototype.notaus = function () {
    var self = this;
    this.inp.notaus = true;
    this.inp.spindel = false;
    this.inp.vorschub = false;
    this.inp.auto = false;
    this.setKraft(0);
    if (this.cncZustand) { this.cncZustand.halt = true; }
    if (this.sim.zyk) { this.sim.zyk.halt = true; }
    if (this.lauf) {
      // Not-Aus wirkt an der CNC wie Reset: Programm abgebrochen, nach dem Entriegeln laeuft nichts von selbst an
      this.lauf = null;
      this.inp.bahn = null;
      this.inp.kss = false;
      this.ncZeichnen(-1);
    }
    this.kn.notaus.classList.add('aktiv');
    if (this.spiel.klang) { this.spiel.klang.alarm(); }
    this.log('NOT-AUS betätigt.', 'warn');
    this.overlay('warn', 'Not-Aus', 'Alle Antriebe stehen. Erst entriegeln, wenn die Ursache beseitigt ist.', [
      { text: 'Entriegeln', klasse: 'knopf--gelb', aktion: function () { self.inp.notaus = false; self.kn.notaus.classList.remove('aktiv'); self.sim.alarm = null; } }
    ]);
  };

  // ------------------------------------------------------------ CNC
  Bearbeitung.prototype.ncStart = function () {
    var sim = this.sim;
    if (this.inp.notaus) { this.log('Erst den Not-Aus entriegeln.', 'warn'); return; }
    if (sim.alarm) { this.log('Alarm quittiert.', 'info'); sim.alarm = null; }
    this.klick();
    if (this.art === 'dreh') {
      if (!this.lauf || this.lauf.fertig) {
        this.laufNeu();
        this.log('NC-Start: Programm läuft' + (this.einzel ? ' im Einzelsatz' : '') + '.', 'info');
      } else {
        this.log('NC-Start: weiter.', 'info');
      }
      this.lauf.halt = false;
      return;
    }
    this.inp.spindel = true;
    this.inp.kss = this.k.setup.param.kss !== 'trocken';
    if (this.art === 'bohr') {
      if (sim.fertig) { return; }
      if (sim.zyk && sim.zyk.aktiv) { sim.zyk.halt = false; this.log('Programm fortgesetzt.', 'info'); return; }
      this.cncZustand = { lauf: true, warten: 0 };
      if (sim.typ === 'gewinde') { this.inp.zyklusStart = true; sim.zyklusStart(); }
      else { sim.zyklusStart(); }
      this.log('NC-Start: Zyklus ' + sim.p.zyklus.art + ', Position ' + (sim.idx + 1) + '.', 'info');
    } else {
      if (!this.cncZustand) {
        var tiefen = [], t = 0, ap = this.k.setup.param.apSchnitt;
        while (t < this.op.tiefe - 1e-6 && tiefen.length < 40) { t = Math.min(this.op.tiefe, t + ap); tiefen.push(t); }
        this.cncZustand = { lauf: true, tiefen: tiefen, k: 0, phase: 'zustellen', halt: false };
        this.log('NC-Start: ' + tiefen.length + ' Schnitte bis ' + zahl(this.op.tiefe, 2) + ' mm.', 'info');
      } else {
        this.cncZustand.halt = false;
        this.log('Programm fortgesetzt.', 'info');
      }
    }
  };

  Bearbeitung.prototype.ncStopp = function () {
    this.klick();
    if (this.lauf) { this.lauf.halt = true; this.log('NC-Stopp: Vorschubhalt, Spindel läuft weiter.', 'info'); return; }
    if (this.sim.zyk) { this.sim.zyk.halt = true; }
    if (this.cncZustand) { this.cncZustand.halt = true; }
    this.inp.vorschub = false;
    this.inp.xHand = 0;
    this.log('NC-Stopp: Vorschub angehalten, Spindel läuft weiter.', 'info');
  };

  Bearbeitung.prototype.cncBohrTakt = function (dt) {
    var sim = this.sim, z = this.cncZustand;
    if (!z || !z.lauf || sim.fertig) { return; }
    var fertig = sim.typ === 'gewinde' ? (sim.gew.phase === 'fertig' && sim.z <= -7.9) : (sim.zyk && !sim.zyk.aktiv && sim.zyk.phase === 'fertig');
    if (sim.w.gebrochen) { return; }
    if (fertig && !z.warten) {
      z.warten = 0.9;
      this.lochWeiter();
      if (sim.fertig) { z.lauf = false; this.inp.spindel = false; this.inp.kss = false; return; }
    }
    if (z.warten > 0) {
      z.warten -= dt;
      if (z.warten <= 0) {
        z.warten = 0;
        if (sim.typ === 'gewinde') { this.inp.zyklusStart = true; sim.zyklusStart(); } else { sim.zyklusStart(); }
      }
    }
    if (this.ncZeilen) {
      var basis = -1, i;
      for (i = 0; i < this.ncZeilen.length; i++) { if (/G8\d/.test(this.ncZeilen[i])) { basis = i; break; } }
      this.ncZeichnen(basis >= 0 ? basis + Math.min(sim.idx, this.op.pos.length - 1) : -1);
    }
  };

  Bearbeitung.prototype.cncFraesTakt = function () {
    var sim = this.sim, z = this.cncZustand, inp = this.inp;
    if (!z || !z.lauf || z.halt || inp.notaus) { inp.vorschub = false; inp.xHand = 0; return; }
    if (sim.w.gebrochen) { inp.vorschub = false; return; }
    var ziel = z.tiefen[z.k];
    var start = -(sim.R + 6);
    var basis = -1, i;
    if (this.ncZeilen) {
      for (i = 0; i < this.ncZeilen.length; i++) { if (/G1 Z/.test(this.ncZeilen[i])) { basis = i; break; } }
    }
    var off = 0;
    switch (z.phase) {
      case 'zustellen':
        inp.zZiel = ziel;
        inp.vorschub = false;
        inp.xHand = 0;
        if (Math.abs(sim.zT - ziel) < 0.002 && sim.nEff > this.k.setup.param.n * 0.9) { z.phase = 'fraesen'; }
        off = 0;
        break;
      case 'fraesen':
        inp.vorschub = true;
        if (sim.x > sim.L + sim.R + 5) { inp.vorschub = false; z.phase = 'hoch'; }
        off = 1;
        break;
      case 'hoch':
        inp.zZiel = 0;
        if (sim.zT < 0.01) { z.phase = 'zurueck'; }
        off = 2;
        break;
      case 'zurueck':
        inp.xHand = -1;
        inp.eil = true;
        if (sim.x <= start) {
          inp.xHand = 0;
          inp.eil = false;
          z.k += 1;
          if (z.k >= z.tiefen.length) {
            z.lauf = false;
            inp.spindel = false;
            inp.kss = false;
            this.log('Programmende M30.', 'info');
            this.ncZeichnen(this.ncZeilen ? this.ncZeilen.length - 1 : -1);
            return;
          }
          z.phase = 'zustellen';
        }
        off = 3;
        break;
    }
    if (basis >= 0) { this.ncZeichnen(basis + z.k * 4 + off); }
  };

  // ------------------------------------------------------------ Drehen/Fraesen
  Bearbeitung.prototype.messen = function () {
    var self = this, sim = this.sim, op = this.op;
    this.klick();
    var box = U.leeren(this.messEl);
    if (sim.nEff > 1) {
      this.sicherheit += 1;
      if (this.schicht) { this.schicht.brechen('Sicherheit!'); }
      this.log('Messen bei laufender Spindel ist verboten! Erst Spindel aus.', 'fehler');
      this.live('Niemals an laufenden Teilen messen!', true);
      return;
    }
    if (this.art === 'dreh') {
      var Kd = DAT.drehKontur(op);
      var zVor = Math.round((sim.laengeZ() - (Kd.stufen.length ? Kd.stufen[0].bis / 2 : 5)) * 10) / 10;
      var zin = h('input#mess-z', { type: 'number', step: '1', min: '0', max: String(op.wst.L), value: String(zVor) });
      var mm = h('select#mess-mm');
      ['messschieber', 'digital', 'buegel', 'buegelDigital'].forEach(function (id) {
        var o = h('option', { value: id }, DAT.messmittel[id].name);
        if (id === 'buegel') { o.selected = true; }
        mm.appendChild(o);
      });
      var aus = h('div.messfenster__wert', '–');
      var los = function () {
        var z = parseFloat(String(zin.value).replace(',', '.'));
        var r = sim.messen(z, mm.value);
        if (r.fehler) { aus.textContent = r.fehler; return; }
        var stellen = r.aufl < 0.005 ? 3 : 2;
        aus.textContent = 'Ø ' + zahl(r.wert, stellen);
        self.szene.messung(z);
        self.messungen.push({ z: z, wert: r.wert, T: r.T });
        // Spielebene: Mass einer Stufe in der Toleranz getroffen
        if (self.schicht) {
          var zF = sim.laengeZ(), vonS = 0;
          Kd.stufen.forEach(function (st, si) {
            var lo = zF - st.bis, hi = zF - vonS;
            vonS = st.bis;
            if (z <= lo || z >= hi) { return; }
            var tl = DAT.toleranz(st.d, st.tol);
            if (tl && r.wert >= st.d + tl.u - 1e-9 && r.wert <= st.d + tl.o + 1e-9) { self.schicht.mass('d' + si, 'Ø ' + DAT.fmtD(st.d) + ' in Toleranz!'); }
          });
        }
        self.log('Messung bei Z = ' + zahl(z, 0) + ' mm: Ø ' + zahl(r.wert, stellen) + ' mm (' + DAT.messmittel[mm.value].name + ', Werkstück ' + zahl(r.T, 0) + ' °C)', 'mess');
      };
      var laenge = function () {
        var r = sim.laengeMessen('digital');
        if (r.fehler) { aus.textContent = r.fehler; return; }
        aus.textContent = 'L ' + zahl(r.wert, 2);
        self.messungen.push({ laenge: r.wert, T: r.T });
        self.log('Gesamtlänge mit dem Messschieber: ' + zahl(r.wert, 2) + ' mm (Werkstück ' + zahl(r.T, 0) + ' °C)', 'mess');
      };
      box.appendChild(h('div.messfenster', [
        h('h3', 'Messen'),
        h('div.feld', [h('label', { for: 'mess-z' }, 'Position Z (vom Futter, mm)'), zin]),
        h('div.feld', [h('label', { for: 'mess-mm' }, 'Messmittel'), mm]),
        h('div.gruppe', [h('button.knopf.knopf--gelb', { type: 'button', onclick: los }, 'Ø messen'),
          h('button.knopf', { type: 'button', onclick: laenge }, 'Gesamtlänge messen')]),
        aus,
        h('small.muted', 'Das Werkstück wird beim Drehen warm. Gemessen wird bei der aktuellen Temperatur.')
      ]));
      los();
    } else {
      var q = sim.querschnitt(sim.L / 2, Math.max(0.05, (sim.zT || this.op.tiefe) * 0.5));
      var b = q.y0 !== null ? q.y1 - q.y0 : 0;
      var fehlerB = 0.02 * (this.rng.next() * 2 - 1);
      var fehlerT = 0.02 * (this.rng.next() * 2 - 1);
      var txt = q.y0 !== null ? 'Nut in der Mitte: Breite ' + zahl(Math.round((b + fehlerB) * 50) / 50, 2) + ' mm, Tiefe ' + zahl(Math.round((q.tiefe + fehlerT) * 50) / 50, 2) + ' mm' : 'Noch keine Nut zu messen.';
      box.appendChild(h('div.messfenster', [h('h3', 'Messschieber'), h('div.messfenster__wert', { style: 'font-size:18px' }, txt)]));
      this.log(txt + ' (Messschieber 0,02)', 'mess');
    }
  };

  Bearbeitung.prototype.spaene = function () {
    this.klick();
    if (this.sim.spaeneEntfernen()) {
      this.log('Wirrspäne mit dem Spänehaken entfernt.', 'info');
      if (ZM.belohnung) { ZM.belohnung.freischalten(this.spiel, 'bandsalat'); }
    } else {
      // gezaehlt wird ueber das Ereignis 'sicherheit' der Simulation
      this.live('Späne nie bei laufender Spindel entfernen!', true);
    }
  };

  Bearbeitung.prototype.platte = function () {
    var self = this, sim = this.sim;
    if (sim.nEff > 1) { this.log('Erst die Spindel anhalten.', 'warn'); return; }
    if (this.cnc && this.revolver) {
      var kn = [];
      [1, 2].forEach(function (nr) {
        var w = self.revolver[nr];
        if (!w || (nr === 2 && w === self.revolver[1])) { return; }
        kn.push({ text: 'T' + nr + ': neue Schneidecke (' + U.geld(w.def.preis / w.def.ecken) + ')', aktion: function () {
          if (w.ecke >= w.ecken) {
            var neu = self.spiel.werkzeugHolen(w.def, true);
            self.wkzListe.push(neu);
            self.revolver[nr] = neu;
            if (sim.w === w) { sim.werkzeugWechsel(neu); }
          } else {
            w.ecke += 1; w.VB = 0; w.ausbruch = 0; w.schaden = 0; w.gebrochen = false; w.bruch = null; w.T = 20;
            if (sim.w === w) { sim.platteBruch = false; sim.halterSchaden = 0; }
          }
          self.log('T' + nr + ': neue Schneidecke eingesetzt.', 'info');
        } });
      });
      kn.push({ text: 'Abbrechen', aktion: function () {} });
      this.overlay('ok', 'Wendeschneidplatten im Revolver', 'T1: ' + this.revolver[1].def.name + ', VB ' + zahl(this.revolver[1].VB, 2) + ' mm' +
        (this.revolver[2] && this.revolver[2] !== this.revolver[1] ? ' · T2: ' + this.revolver[2].def.name + ', VB ' + zahl(this.revolver[2].VB, 2) + ' mm' : ''), kn);
      return;
    }
    var erlaubt = (this.k.mission.werkzeuge && this.k.mission.werkzeuge.platten) || DAT.katalog().platten.map(function (p) { return p.id; });
    var knoepfe = [{ text: 'Schneidecke drehen (' + U.geld(sim.w.def.preis / sim.w.def.ecken) + ')', aktion: function () {
      if (sim.w.ecke >= sim.w.ecken) { self.neuePlatte(sim.def.id); return; }
      sim.plattenWechsel();
      self.log('Neue Schneidecke ' + sim.w.ecke + ' von ' + sim.w.ecken + '.', 'info');
    } }];
    erlaubt.forEach(function (id) {
      if (id === sim.def.id) { return; }
      knoepfe.push({ text: DAT.platte(id).name, aktion: function () { self.neuePlatte(id); } });
    });
    knoepfe.push({ text: 'Abbrechen', aktion: function () {} });
    this.overlay('ok', 'Wendeschneidplatte', 'Aktuell: ' + sim.def.name + ' ' + sim.def.sorte + ', Schneidecke ' + sim.w.ecke + ' von ' + sim.w.ecken + ', VB = ' + zahl(sim.w.VB, 2) + ' mm.', knoepfe);
  };

  Bearbeitung.prototype.neuePlatte = function (id) {
    var def = Object.assign({ typ: 'platte' }, DAT.platte(id));
    var w = this.spiel.werkzeugHolen(def, true);
    this.wkzListe.push(w);
    this.sim.werkzeugWechsel(w);
    this.log('Platte gewechselt: ' + def.name + ' ' + def.sorte + '.', 'info');
  };

  Bearbeitung.prototype.fraeserNeu = function () {
    var self = this, sim = this.sim;
    if (sim.nEff > 1) { this.log('Erst die Spindel anhalten.', 'warn'); return; }
    this.overlay('ok', 'Fräser wechseln', 'Einen neuen ' + sim.def.bez + ' aus der Ausgabe holen (' + U.geld(sim.def.preis) + ')?', [
      { text: 'Neuen Fräser holen', klasse: 'knopf--gelb', aktion: function () {
        var w = self.spiel.werkzeugHolen(sim.def, true);
        self.wkzListe.push(w);
        sim.werkzeugWechsel(w);
        self.log('Neuer Fräser eingespannt.', 'info');
      } },
      { text: 'Abbrechen', aktion: function () {} }
    ]);
  };

  // ============================================================ Tastatur
  Bearbeitung.prototype.tastenAn = function () {
    var self = this;
    this.onDown = function (e) {
      if (self.beendet || U.ansicht() !== 'bearbeiten') { return; }
      var t = e.target;
      if (t && (t.tagName === 'INPUT' && t.type !== 'range') || (t && t.tagName === 'SELECT')) { return; }
      var key = e.key;
      var behandelt = true;
      var art = self.art, cnc = self.cnc;
      if (key === ' ') { self.notaus(); }
      else if (key === 'Enter') { if (cnc) { self.ncStart(); } else { self.spindel(); } }
      else if (key === 'k' || key === 'K') { self.kss(); }
      else if (art === 'bohr' && !cnc) {
        if (key === 'ArrowDown') { self.tasten.runter = true; }
        else if (key === 'ArrowUp') { self.tasten.hoch = true; }
        else if (key === 'r' || key === 'R') { self.zurueck(); }
        else if (key === 'a' || key === 'A') { if (self.kn.auto) { self.auto(); } }
        else if (key === 'u' || key === 'U') { self.inp.umsteuern = true; }
        else if (key === 'n' || key === 'N') { self.naechste(); }
        else if (/^[0-9]$/.test(key)) { self.setKraft(parseInt(key, 10) / 10); }
        else { behandelt = false; }
      } else if (cnc) {
        if (key === 's' || key === 'S') { self.ncStopp(); }
        else if (art === 'dreh' && (key === 'e' || key === 'E')) { self.einzelsatz(); }
        else if (art === 'dreh' && (key === 'r' || key === 'R')) { self.ncReset(); }
        else if (art === 'dreh' && (key === 'o' || key === 'O')) { self.korrekturFenster(); }
        else if (art === 'dreh' && (key === 'w' || key === 'W')) { self.platte(); }
        else if (art === 'dreh' && (key === 'h' || key === 'H')) { self.spaene(); }
        else if (key === '+' && self.ovFEl) { self.ovFEl.value = String(Math.min(120, parseInt(self.ovFEl.value, 10) + 10)); self.ovFEl.dispatchEvent(new Event('input')); }
        else if (key === '-' && self.ovFEl) { self.ovFEl.value = String(Math.max(0, parseInt(self.ovFEl.value, 10) - 10)); self.ovFEl.dispatchEvent(new Event('input')); }
        else if (key === 'm' || key === 'M') { self.messen(); }
        else { behandelt = false; }
      } else if (art === 'dreh') {
        var schritt = e.shiftKey ? 1 : e.altKey ? 0.02 : 0.1;
        if (key === 'ArrowLeft') { self.inp.zHand = -1; self.inp.eil = e.shiftKey; }
        else if (key === 'ArrowRight') { self.inp.zHand = 1; self.inp.eil = e.shiftKey; }
        else if (key === 'ArrowUp') { self.xSetzen(self.xZiel + schritt); }
        else if (key === 'ArrowDown') { self.xSetzen(self.xZiel - schritt); }
        else if (key === 'v' || key === 'V') { self.vorschub(); }
        else if (key === 'p' || key === 'P') { self.planzug(); }
        else if (key === 'b' || key === 'B') { self.klemmen(); }
        else if (key === '0') { self.zNullen(); }
        else if (key === '+') { self.oberRelativ(e.altKey ? 0.02 : e.shiftKey ? 1 : 0.1); }
        else if (key === '-') { self.oberRelativ(-(e.altKey ? 0.02 : e.shiftKey ? 1 : 0.1)); }
        else if (key === 'm' || key === 'M') { self.messen(); }
        else if (key === 'h' || key === 'H') { self.spaene(); }
        else if (key === 'w' || key === 'W') { self.platte(); }
        else { behandelt = false; }
      } else if (art === 'fraes') {
        if (key === 'ArrowLeft') { self.inp.xHand = -1; self.inp.eil = e.shiftKey; }
        else if (key === 'ArrowRight') { self.inp.xHand = 1; self.inp.eil = e.shiftKey; }
        else if (key === 'v' || key === 'V') { self.vorschub(); }
        else if (key === 'r' || key === 'R') { self.eilZurueck(); }
        else if (key === 'm' || key === 'M') { self.messen(); }
        else if (key === 'w' || key === 'W') { self.fraeserNeu(); }
        else { behandelt = false; }
      } else { behandelt = false; }
      if (behandelt) { e.preventDefault(); }
    };
    this.onUp = function (e) {
      if (e.key === 'ArrowDown') { self.tasten.runter = false; }
      if (e.key === 'ArrowUp') { self.tasten.hoch = false; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (self.art === 'dreh') { self.inp.zHand = 0; } else if (self.art === 'fraes' && !self.cnc) { self.inp.xHand = 0; }
        self.inp.eil = false;
      }
    };
    this.onWheel = function (e) {
      if (self.art !== 'bohr' || self.cnc) { return; }
      e.preventDefault();
      self.setKraft(self.inp.kraft + (e.deltaY > 0 ? 0.03 : -0.03));
    };
    root.addEventListener('keydown', this.onDown);
    root.addEventListener('keyup', this.onUp);
    this.cv.addEventListener('wheel', this.onWheel, { passive: false });
  };

  Bearbeitung.prototype.tastenAus = function () {
    root.removeEventListener('keydown', this.onDown);
    root.removeEventListener('keyup', this.onUp);
    this.cv.removeEventListener('wheel', this.onWheel);
  };

  // ============================================================ Schleife
  Bearbeitung.prototype.schleife = function (t) {
    var self = this;
    if (this.beendet) { return; }
    var dt = this.letzte === null ? 1 / 60 : Math.min(0.05, (t - this.letzte) / 1000);
    this.letzte = t;
    var pause = !U.$('#overlay').hidden && this.overlayPause;
    if (!pause) {
      this.takt(dt * this.faktor);
    }
    var a = { kss: this.inp.kss, vorschub: this.inp.vorschub };
    try {
      this.szene.zeichne(this.cv, pause ? 0 : dt, a);
    } catch (e) {
      if (!this.zeichenFehler) { this.zeichenFehler = true; this.log('Darstellungsfehler: ' + e.message, 'fehler'); }
    }
    this.hudZeit -= dt;
    if (this.hudZeit <= 0) { this.hudZeit = 1 / 12; this.hudAktualisieren(); }
    this.raf = root.requestAnimationFrame(function (tt) { self.schleife(tt); });
  };

  Bearbeitung.prototype.takt = function (dt) {
    var inp = this.inp, sim = this.sim;
    // Hebel ueber Tasten
    if (this.art === 'bohr' && !this.cnc) {
      if (this.tasten.runter) { this.setKraft(Math.max(0, inp.kraft) + 0.45 * dt); }
      if (this.tasten.hoch) { this.setKraft(inp.kraft - 0.9 * dt); }
    }
    if (this.art === 'fraes' && !this.cnc && this.eilAktiv) {
      inp.xHand = -1;
      inp.eil = true;
      if (sim.x <= -(sim.R + 6)) { this.eilAktiv = false; inp.xHand = 0; inp.eil = false; }
    }
    if (this.art === 'fraes' && this.cnc) { this.cncFraesTakt(); }
    if (this.art === 'fraes' && !this.cnc && inp.vorschub && sim.x > sim.L + sim.R + 1) {
      inp.vorschub = false;
      this.log('Endlage erreicht – Tischvorschub aus.', 'info');
    }
    var n = Math.max(1, Math.ceil(dt / DT));
    var d = dt / n, i;
    var huell = this.art === 'dreh' ? this.huelle || (this.huelle = [0, 0, 9]) : null;
    for (i = 0; i < n; i++) {
      if (this.lauf) { this.lauf.tick(sim, inp, d); }
      else if (this.art === 'dreh' && this.cnc) { inp.bahn = null; inp.spindel = false; }
      sim.step(d, inp);
      inp.umsteuern = false;
      inp.zyklusStart = false;
      if (huell) {
        var lw = this.cnc ? sim.Minst / Math.max(1, sim.m.mS1) : sim.lastM;
        if (lw > huell[0]) { huell[0] = lw; }
        if (lw < huell[2]) { huell[2] = lw; }
        if ((sim.plattenLast || 0) > huell[1]) { huell[1] = sim.plattenLast || 0; }
      }
    }
    if (this.lauf) {
      var ml = this.lauf.meldungen.splice(0);
      var selbst = this;
      ml.forEach(function (mm) {
        selbst.log(mm.text, mm.art === 'warn' ? 'warn' : 'info');
        if (mm.art === 'ende') { selbst.live('Programmende M30 – Teil messen oder Arbeitsgang beenden.', false); if (selbst.spiel.klang) { selbst.spiel.klang.erfolg(); } }
      });
      this.ncZeichnen(this.lauf.zeile());
    }
    if (this.art === 'bohr' && this.cnc) { this.cncBohrTakt(dt); }
    this.ereignisse();
    // Verlauf fuer das Oszilloskop
    this.scopeZeit -= dt;
    if (this.scopeZeit <= 0) {
      this.scopeZeit = 1 / 30;
      var mw = this.messwert();
      if (this.huelle) {
        mw = this.stufe === 'azubi' ? [this.huelle[0], this.huelle[1], this.huelle[2]] : [Math.min(1.6, this.huelle[0]), null, this.huelle[2]];
        this.huelle = [0, 0, 9];
      }
      this.verlauf.push(mw);
      if (this.verlauf.length > 240) { this.verlauf.shift(); }
    }
    this.meisterZeit -= dt;
    if (this.meisterZeit <= 0) { this.meisterZeit = 0.25; this.meister(); }
    this.klang();
    if (this.schicht) { this.schicht.takt(dt); }
  };

  // Hauptmesswert relativ zur Grenze (1 = Grenze)
  Bearbeitung.prototype.messwert = function () {
    var a = this.sim.anzeige(), st = this.stufe;
    if (st !== 'azubi') { return [Math.min(1.6, a.last || 0), null]; }
    if (this.art === 'bohr') { return [a.M / Math.max(0.01, a.mBruch), a.P / a.pMax]; }
    if (this.art === 'dreh') { return [a.last, a.plattenLast]; }
    return [a.r, a.last];
  };

  Bearbeitung.prototype.klang = function () {
    var kl = this.spiel.klang;
    if (!kl || !kl.bereit) { return; }
    var a = this.sim.anzeige(), sim = this.sim;
    var schnitt = 0, ratter = 0, rf = 900, quiet = 0, schneiden = 2, extra = null;
    if (this.art === 'bohr') {
      schnitt = a.f > 0.002 && a.n > 5 ? Math.min(1, a.P / 1.2 + 0.25) : 0;
      quiet = (a.f < 0.01 && a.z > 0.3 && a.n > 30 && a.F > 30 ? 0.8 : 0) + Math.min(1, Math.max(0, sim.w.VB - 0.2) * 2) * (schnitt > 0 ? 1 : 0) + (sim.phi > 0.8 ? 0.6 : 0);
      schneiden = sim.typ === 'bohrer' ? 2 : sim.def.z || 3;
    } else if (this.art === 'dreh') {
      schnitt = a.ap > 0.005 && a.n > 5 ? Math.min(1, a.P / 4 + 0.3) : 0;
      ratter = a.amp;
      rf = a.fn;
      schneiden = 1;
      quiet = a.reib > 0 ? 0.8 : 0;
      extra = { cnc: this.cnc, iRel: a.iRel, riemen: a.riemenGleitet ? 1 : 0, kupplung: a.kupplung, fRat: a.fRat, puls: a.puls, fcb: a.fcb,
        klopfen: a.rE > 0.3 && a.n > 5 ? a.rE : 0, nRev: a.n / 60, halterReibt: a.halterReibt, knack: a.knack, kreischen: a.rB };
    } else {
      schnitt = a.ap > 0.005 && a.ae > 0.01 && a.n > 5 ? Math.min(1, a.P / 3 + 0.3) : 0;
      ratter = a.amp;
      rf = a.fn;
      schneiden = sim.def.z;
      quiet = a.stumpfReibt ? 0.9 : 0;
      extra = { cnc: this.cnc, fZE: a.fZE, pulsGrad: a.pulsGrad, hammer: a.hammer, tischKlack: a.tischKlack, riemen: a.riemenGleitet ? 1 : 0,
        kupplung: a.kupplung, fRat: 8 * (this.k.setup.param.vf || 100) / 300, iRel: this.cnc ? 0 : 0.35 + 0.65 * (a.lastM || 0), stumpfReibt: a.stumpfReibt, knack: a.knack };
    }
    kl.update({ n: a.n, nMax: this.cnc && this.art === 'dreh' ? Math.max(1, a.nSoll || a.n) : this.k.setup.param.n, last: a.last, schnitt: schnitt, vc: a.vc, schneiden: schneiden, ratter: ratter, ratterF: rf, quietsch: quiet, kss: this.inp.kss, extra: extra });
  };

  // ============================================================ Ereignisse
  Bearbeitung.prototype.ereignisse = function () {
    var self = this, liste = this.sim.ev.holen();
    liste.forEach(function (e) {
      self.szene.ereignis(e);
      if (self.schicht) { self.schicht.ereignis(e); }
      var klasse = e.schwere === 'info' ? 'info' : e.schwere;
      self.log(e.text, klasse);
      if (e.schwere !== 'info') { self.wichtig.push(e); }
      var kl = self.spiel.klang;
      if (e.typ === 'bruch') {
        if (kl) { kl.bruch(); }
        self.bruchOverlay(e);
      } else if (e.typ === 'kollision') {
        if (kl) { kl.kollision(); }
        if (e.schwere !== 'unfall') { self.bruchOverlay({ text: e.text, daten: { titel: 'Kollision' } }); }
      } else if (e.typ === 'unfall') {
        if (kl) { kl.kollision(); kl.alarm(); }
      } else if (e.typ === 'anschlag') {
        if (self.art === 'dreh') { self.inp.vorschub = false; }
        if (self.art === 'bohr') { self.inp.auto = false; }
      } else if (e.typ === 'durchbruch' && e.schwere === 'warn') {
        self.live(e.text, false);
      } else if (e.typ === 'tischZieht' || e.typ === 'rutsch' || e.typ === 'steckt' || e.typ === 'stall' || e.typ === 'stumpf' || e.typ === 'thermoschock' || e.typ === 'motorschutz' || e.typ === 'alarm' || e.typ === 'spanbrand' || e.typ === 'abgewuergt') {
        self.live(e.text, e.typ !== 'rutsch');
        if (e.typ === 'motorschutz') { self.inp.spindel = false; self.inp.vorschub = false; self.inp.plan = false; }
        if (e.typ === 'alarm' && kl) { kl.alarm(); }
      } else if (e.typ === 'mitte') {
        self.inp.plan = false;
      } else if (e.typ === 'rattern' || e.typ === 'wirr' || e.typ === 'riemen' || e.typ === 'aufschweiss' || e.typ === 'auszug' || e.typ === 'halter' || e.typ === 'ausgegluht' || e.typ === 'boden' ||
        e.typ === 'kupplung' || e.typ === 'unterbrochen' || e.typ === 'zapfen' || e.typ === 'haemmern' || e.typ === 'schlitten' || e.typ === 'oberschlitten' || e.typ === 'ueberMitte' || e.typ === 'fliehkraft' || e.typ === 'geklemmt' || e.typ === 'klemmHand' || e.typ === 'anfahren' || e.typ === 'rutscht') {
        if (self.stufe !== 'meister' || e.typ === 'geklemmt' || e.typ === 'klemmHand') { self.live(e.text, e.typ === 'halter' || e.typ === 'boden' || e.typ === 'rutscht'); }
      }
      if (e.typ === 'sicherheit') { self.sicherheit += 1; }
    });
    if (this.sim.unfall && !this.unfallGezeigt) {
      this.unfallGezeigt = true;
      this.inp.spindel = false;
      this.overlayPause = true;
      this.overlay('unfall', 'Unfall', this.sim.unfall.text || (liste[0] && liste[0].text) || 'Arbeitsunfall.', [
        { text: 'Zur Auswertung', klasse: 'knopf--gelb', aktion: function () { self.beenden(true); } }
      ], true);
    }
  };

  Bearbeitung.prototype.bruchOverlay = function (e) {
    var self = this, sim = this.sim;
    var titel = (e.daten && e.daten.titel) || 'Werkzeugbruch';
    this.inp.vorschub = false;
    this.inp.auto = false;
    if (!this.cnc) { this.setKraft(0); }
    if (this.cncZustand) { this.cncZustand.halt = true; }
    if (this.lauf) { this.lauf.halt = true; }
    this.inp.plan = false;
    var preis = sim.def.typ === 'platte' ? sim.def.preis / sim.def.ecken : sim.def.preis;
    var knoepfe = [];
    if (this.art === 'bohr') {
      var rest = sim.op.anzahl - sim.idx - 1;
      if (rest > 0) {
        knoepfe.push({ text: 'Neues Werkzeug holen, weiter mit Position ' + (sim.idx + 2) + ' (' + U.geld(sim.def.preis) + ')', klasse: 'knopf--gelb', aktion: function () {
          self.inp.spindel = false;
          var w = self.spiel.werkzeugHolen(sim.def, true);
          self.wkzListe.push(w);
          sim.naechstesLoch();
          sim.w = w;
          sim.mBruchNmm = sim.typ === 'gewinde' ? sim.def.mBruch : w.stoff.tau * sim.wp;
          self.szene.neuesLoch();
          if (self.cncZustand) { self.cncZustand = null; sim.zyk = null; }
          self.log('Neues Werkzeug eingespannt. Die Position mit dem abgebrochenen Rest ist Ausschuss.', 'warn');
        } });
      }
      knoepfe.push({ text: 'Arbeitsgang abbrechen', klasse: 'knopf--rot', aktion: function () { self.beenden(false); } });
    } else {
      knoepfe.push({ text: this.art === 'dreh' ? 'Neue Schneidecke (' + U.geld(preis) + ')' : 'Neuen Fräser holen (' + U.geld(preis) + ')', klasse: 'knopf--gelb', aktion: function () {
        self.inp.spindel = false;
        if (self.art === 'dreh') {
          if (sim.w.ecke < sim.w.ecken) { sim.plattenWechsel(); }
          else { self.neuePlatte(sim.def.id); }
          if (self.cnc) { self.log('An der CNC: Reset (R), dann NC-Start – das Programm beginnt von vorn, die fertigen Schnitte gehen durch die Luft.', 'info'); }
        } else {
          var w2 = self.spiel.werkzeugHolen(sim.def, true);
          self.wkzListe.push(w2);
          sim.werkzeugWechsel(w2);
        }
        self.log('Werkzeug gewechselt. Erst Spindel wieder einschalten.', 'info');
      } });
      knoepfe.push({ text: 'Arbeitsgang abbrechen', klasse: 'knopf--rot', aktion: function () { self.beenden(false); } });
    }
    this.overlayPause = true;
    this.overlay('fehler', titel, e.text, knoepfe);
  };

  Bearbeitung.prototype.opFertig = function () {
    var self = this;
    this.inp.spindel = false;
    this.inp.kss = false;
    if (this.spiel.klang) { this.spiel.klang.erfolg(); }
    this.overlayPause = true;
    this.overlay('ok', 'Arbeitsgang erledigt', 'Alle ' + this.op.pos.length + ' Positionen sind bearbeitet.', [
      { text: 'Weiter', klasse: 'knopf--gelb', aktion: function () { self.beenden(false); } }
    ]);
  };

  Bearbeitung.prototype.fragenBeenden = function () {
    var self = this;
    var text = this.art === 'bohr' ? 'Noch nicht bearbeitete Positionen fehlen dann am Werkstück.' : 'Das Teil wird ausgespannt und geht in die Prüfung.';
    this.overlayPause = true;
    this.overlay('ok', 'Arbeitsgang beenden?', text, [
      { text: 'Weiterarbeiten', aktion: function () {} },
      { text: 'Beenden und prüfen', klasse: 'knopf--gelb', aktion: function () { self.beenden(false); } }
    ]);
  };

  // ============================================================ Overlay, Meldungen
  Bearbeitung.prototype.overlay = function (art, titel, text, knoepfe, bleibt) {
    var self = this, ov = U.$('#overlay');
    U.leeren(ov);
    var karte = h('div.overlay__karte' + (art === 'unfall' || art === 'warn' ? '.overlay__karte--unfall' : art === 'ok' ? '.overlay__karte--ok' : ''), [
      h('h2', titel), h('p', text)
    ]);
    var kb = h('div.overlay__knoepfe');
    knoepfe.forEach(function (k) {
      kb.appendChild(h('button.knopf' + (k.klasse ? '.' + k.klasse : ''), { type: 'button', onclick: function () {
        if (!bleibt) { ov.hidden = true; self.overlayPause = false; }
        k.aktion();
      } }, k.text));
    });
    karte.appendChild(kb);
    ov.appendChild(karte);
    ov.hidden = false;
    var erster = kb.querySelector('button');
    if (erster) { erster.focus(); }
  };

  Bearbeitung.prototype.log = function (text, klasse) {
    var el = U.$('#log');
    var z = h('div.log__z.' + (klasse || 'info'), [h('time', U.dauer(this.sim ? this.sim.zeit : 0)), h('span', text)]);
    el.insertBefore(z, el.firstChild);
    while (el.childNodes.length > 80) { el.removeChild(el.lastChild); }
  };

  Bearbeitung.prototype.live = function (text, kritisch) {
    var box = U.$('#live');
    var d = h('div' + (kritisch ? '.kritisch' : ''), text);
    box.appendChild(d);
    while (box.childNodes.length > 3) { box.removeChild(box.firstChild); }
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 4200);
  };

  Bearbeitung.prototype.meisterSagt = function (text) {
    this.log('Meister: ' + text, 'meister');
    this.live('Meister: ' + text, false);
  };

  // Warnungen nur in der Stufe Azubi
  Bearbeitung.prototype.meister = function () {
    if (this.stufe !== 'azubi' || this.sim.w.gebrochen || this.sim.unfall) { return; }
    var a = this.sim.anzeige(), sim = this.sim, self = this, t = sim.zeit;
    function sag(key, text, pause) {
      if (self.warnZeit[key] !== undefined && t - self.warnZeit[key] < (pause || 6)) { return; }
      self.warnZeit[key] = t;
      self.meisterSagt(text);
    }
    if (this.art === 'bohr') {
      var schneidet = a.f > 0.002 && a.n > 5 && a.z > 0;
      if (a.r > 0.72) { sag('r', 'Der Bohrer ist bei ' + Math.round(a.r * 100) + ' % seiner Bruchgrenze – sofort Druck rausnehmen!', 3); }
      if (a.phi > 0.75 && sim.typ === 'bohrer') { sag('phi', 'Die Spannuten sind voll. Raus aus der Bohrung und entspanen!', 4); }
      if (a.T > a.tSoft - 70 && schneidet) { sag('T', 'Die Schneide wird zu heiß (' + Math.round(a.T) + ' °C). Drehzahl runter oder mehr kühlen.', 5); }
      if (schneidet && a.vc > 1.35 * a.vcRef && sim.typ !== 'gewinde') { sag('vc', 'Zu schnell: vc = ' + Math.round(a.vc) + ' m/min, Richtwert ' + Math.round(a.vcRef) + ' m/min.', 10); }
      if (schneidet && a.f > 1.7 * a.fRef && sim.typ === 'bohrer') { sag('f', 'Zu viel Vorschub: ' + zahl(a.f, 2) + ' mm/U, Richtwert ' + zahl(a.fRef, 2) + ' mm/U.', 5); }
      if (sim.durch && sim.typ === 'bohrer' && !sim.durchbruch && a.z > sim.dicke - 0.4 && a.F > 120 && !this.inp.auto) { sag('durch', 'Gleich kommt der Durchbruch – Druck zurücknehmen!', 8); }
      if (schneidet && !this.inp.kss && this.k.setup.param.kss !== 'trocken') { sag('kss', 'Der Kühlschmierstoff ist aus (K).', 12); }
      if (a.z > 0.2 && a.n > 30 && a.f < 0.01 && a.F > 40 && this.mat.verfest > 0.5) { sag('reib', 'Nicht reiben lassen! Entweder schneiden oder raus.', 5); }
      if (a.z > 0.2 && a.n < 5 && a.F > 150) { sag('steht', 'Die Spindel steht – Druck weg, sonst bricht er beim Anlaufen.', 5); }
    } else if (this.art === 'dreh') {
      if (a.kupplung > 0.3 && !this.cnc) { sag('kupp', 'Hörst du die Kupplung ratschen? Vorschub raus! Die Vorschubkraft ist zu groß – kleinerer Vorschub, weniger Spantiefe oder eine frische Schneide.', 4); }
      if (a.riemenGleitet && a.n > 5) { sag('riemen', 'Der Riemen rutscht! Vorschub aus. Eine kleinere Drehzahlstufe hat mehr Moment.', 4); }
      if (a.riemenGleitet && a.n <= 5) { sag('abgew', 'Abgewürgt. Vorschub aus, Werkzeug zurückziehen, erst dann wieder anlaufen lassen.', 4); }
      if (a.rS > 0.3) { sag('stau', 'Die Späne stauen sich und hämmern auf die Schneide – der Vorschub liegt über dem Spanformbereich der Platte.', 5); }
      if (a.modus === 'plan' && !this.cnc && !this.inp.klemmen) { sag('klemm', 'Beim Plandrehen den Bettschlitten klemmen (B), sonst drückt er sich weg.', 10); }
      if (a.reib > 0.2) { sag('reib', 'Die Schneide steht über Mitte – hörst du das Quietschen? Sofort zurück!', 3); }
      if (a.glut > 0.3) { sag('glut', 'Die Späne glühen. Das ist die Schnittgeschwindigkeit, nicht der Vorschub.', 8); }
      if (a.amp > 2.5) { sag('amp', 'Es rattert. Weniger Schnitttiefe oder Reitstock.', 6); }
      if (a.plattenLast > 0.85) { sag('pl', 'Die Platte ist am Limit (' + Math.round(a.plattenLast * 100) + ' %).', 4); }
      if (a.spanForm === 'band') { sag('band', 'Bandspäne! Der Vorschub oder die Schnitttiefe liegt unter dem Spanformbereich der Platte.', 12); }
      if (!this.cnc && this.inp.vorschub && (sim.p.zAnschlag === null || sim.p.zAnschlag === undefined) && a.z < 14 && a.x < sim.D0 + 40) { sag('futter', 'Achtung, gleich kommt das Futter! Vorschub aus!', 2); }
      if (a.last > 0.95) { sag('last', 'Die Spindel ist an der Leistungsgrenze.', 6); }
      // Heisse Schneide ist bei Richtwert-vc normal (Edelstahl, Titan); gewarnt wird erst darueber
      // bzw. kurz vor der Warmhaertegrenze
      if (a.ap > 0 && a.T > a.tSoft - 60) { sag('T', 'Die Schneide ist an der Warmhärtegrenze (' + Math.round(a.T) + ' °C) – Schnittgeschwindigkeit senken, Kühlung prüfen.', 6); }
      else if (a.ap > 0 && a.T > a.tSoft - 150 && a.vc > 1.15 * (a.vcRef || 1e9)) { sag('T', 'Die Schneide wird sehr heiß – die Schnittgeschwindigkeit liegt über dem Richtwert.', 6); }
    } else {
      if (a.hammer > 0.3) { sag('hammer', 'Der Tisch hämmert im Spiel der Spindel – weniger Zahnvorschub oder ein Fräser mit mehr Zähnen.', 5); }
      if (a.riemenGleitet) { sag('riemen', 'Der Riemen rutscht! Vorschub aus. Bei dieser Drehzahlstufe hat die Spindel kaum Moment.', 4); }
      if (a.stumpfReibt) { sag('stumpf', 'Der Stumpf reibt im Werkstück – sofort Vorschub und Spindel aus!', 3); }
      if (a.r > 0.72) { sag('r', 'Der Fräser ist bei ' + Math.round(a.r * 100) + ' % seiner Bruchgrenze!', 3); }
      if (a.amp > 2.5) { sag('amp', 'Der Fräser rattert. Weniger Tiefe oder andere Drehzahl.', 6); }
      if (a.aufschweiss > 0.5) { sag('al', sim.mat.iso === 'N' ? 'Das Aluminium schweißt auf den Fräser.' : 'Der Werkstoff klebt an den Schneiden und setzt die Spannuten zu.', 8); }
      if (a.last > 0.95) { sag('last', 'Spindel an der Leistungsgrenze.', 6); }
      if (a.T > a.tSoft - 80 && a.ap > 0) { sag('T', 'Die Schneide wird zu heiß.', 6); }
    }
  };

  // ============================================================ Anzeige
  function setB(b, wert, anteil, grenze, text) {
    if (!b) { return; }
    var w = Math.max(0, Math.min(1, anteil));
    b.fill.style.width = (w * 100).toFixed(1) + '%';
    b.wert.textContent = text;
    if (grenze !== null && grenze !== undefined) {
      b.grenze.hidden = false;
      b.grenze.style.left = (Math.min(1, grenze) * 100).toFixed(1) + '%';
    }
    b.el.classList.toggle('krit', grenze !== null && grenze !== undefined && anteil >= grenze * 0.85);
    b.el.classList.toggle('warn', grenze !== null && grenze !== undefined && anteil >= grenze * 0.6 && anteil < grenze * 0.85);
  }

  Bearbeitung.prototype.hudAktualisieren = function () {
    var a = this.sim.anzeige(), v = this.hud.vfd, b = this.hud.b, sim = this.sim;
    this.elZeit.textContent = U.dauer(sim.zeit);
    if (this.art === 'bohr') {
      if (v.z) { v.z.textContent = zahl(a.z, 2); }
      if (v.n) { v.n.textContent = zahl(a.n, 0); }
      if (v.f) { v.f.textContent = zahl(a.f, 3); }
      if (v.vc) { v.vc.textContent = zahl(a.vc, 1); }
      setB(b.M, a.M, a.M / (a.mBruch * 1.25), 0.8, zahl(a.M, 2) + ' Nm');
      var skala = Math.max(sim.m.handkraft || sim.m.maxSchub, 1);
      var fe = a.knick > 0.001 ? a.F / a.knick : null;
      setB(b.F, a.F, a.F / skala, fe ? Math.min(1, fe / skala) : null, zahl(a.F, 0) + ' N');
      setB(b.phi, a.phi, a.phi / 1.5, 1 / 1.5, zahl(a.phi * 100, 0) + ' %');
      setB(b.T, a.T, a.T / (a.tSoft * 1.3), this.stufe === 'azubi' ? 1 / 1.3 : null, zahl(a.T, 0) + ' °C');
      setB(b.VB, a.VB, a.VB / 0.6, 0.5, zahl(a.VB, 2));
      setB(b.P, a.P, a.P / a.pMax, 1, zahl(a.P, 2) + ' kW');
      setB(b.last, a.last, a.last / 1.5, 1 / 1.5, zahl(a.last * 100, 0) + ' %');
      if (this.hebelOut) {
        var kr = this.inp.kraft;
        this.hebelOut.textContent = kr >= 0 ? Math.round(kr * sim.m.handkraft) + ' N' : 'zurück';
      }
      if (this.kn.auto) { this.kn.auto.classList.toggle('knopf--an', this.inp.auto && !sim.autoAus); }
    } else if (this.art === 'dreh') {
      if (v.x) { v.x.textContent = zahl(a.x, 3); }
      if (v.z) { v.z.textContent = zahl(a.z - (this.cnc ? this.k.setup.param.zW : (this.zNull || 0)), 2); }
      if (v.n) { v.n.textContent = zahl(a.n, 0); }
      if (v.vc) { v.vc.textContent = zahl(a.vc, 0); }
      if (v.f) { v.f.textContent = zahl(a.f, 3); }
      if (v.t) { v.t.textContent = this.lauf ? 'T' + this.lauf.zustand.tnr : 'T1'; }
      setB(b.P, a.P, a.P / a.pMax, 1, zahl(a.P, 2) + ' kW');
      setB(b.mo, a.last, a.last / 2.5, this.cnc ? (sim.m.mMax / sim.m.mS1) / 2.5 : sim.kR / 2.5, zahl(a.last * 100, 0) + ' %');
      setB(b.pl, a.plattenLast, a.plattenLast / 1.4, 1 / 1.4, zahl(a.plattenLast * 100, 0) + ' %');
      setB(b.amp, a.amp, a.amp / 40, 4 / 40, zahl(a.amp, 1));
      setB(b.T, a.T, a.T / (a.tSoft * 1.2), 1 / 1.2, zahl(a.T, 0) + ' °C');
      setB(b.VB, a.VB, a.VB / 0.6, 0.5, zahl(a.VB, 2));
      setB(b.d, a.delta * 1000, a.delta * 1000 / 60, null, zahl(a.delta * 1000, 1));
      setB(b.Tw, a.Twst, (a.Twst - 20) / 60, null, zahl(a.Twst, 1) + ' °C');
      setB(b.last, a.last, a.last / 1.5, 1 / 1.5, zahl(a.last * 100, 0) + ' %');
      if (this.hud.span) {
        var sf = { kurz: 'kurze Spiralspäne', band: 'Bandspäne (zu lang!)', wendel: 'Wendelspäne', broeckel: 'Bröckelspäne', gestaucht: 'gestauchte Späne (zu dick!)', '-': '–' };
        this.hud.span.textContent = 'Spanform: ' + (sf[a.spanForm] || a.spanForm) + (a.wirr > 0.5 ? ' · Wirrspäne sammeln sich' : '');
      }
      if (this.kn.vorschub) { this.kn.vorschub.classList.toggle('knopf--an', this.inp.vorschub); }
      if (this.kn.plan) { this.kn.plan.classList.toggle('knopf--an', this.inp.plan); }
      if (this.kn.klemmen) { this.kn.klemmen.classList.toggle('knopf--an', this.inp.klemmen); }
      if (this.kn.einzel) { this.kn.einzel.classList.toggle('knopf--an', !!this.einzel); }
      if (this.hud.span && a.alarm) { this.hud.span.textContent = a.alarm; }
    } else {
      if (v.x) { v.x.textContent = zahl(a.x, 2); }
      if (v.y) { v.y.textContent = zahl(a.y, 2); }
      if (v.z) { v.z.textContent = zahl(-a.z, 2); }
      if (v.n) { v.n.textContent = zahl(a.n, 0); }
      if (v.vf) { v.vf.textContent = zahl(this.k.setup.param.vf * (this.inp.ovF === undefined ? 1 : this.inp.ovF), 0); }
      setB(b.r, a.r, a.r / 1.2, 1 / 1.2, zahl(a.r * 100, 0) + ' %');
      setB(b.P, a.P, a.P / a.pMax, 1, zahl(a.P, 2) + ' kW');
      setB(b.amp, a.amp, a.amp / 40, 4 / 40, zahl(a.amp, 1));
      setB(b.T, a.T, a.T / (a.tSoft * 1.2), 1 / 1.2, zahl(a.T, 0) + ' °C');
      setB(b.VB, a.VB, a.VB / 0.6, 0.5, zahl(a.VB, 2));
      setB(b.d, a.delta * 1000, a.delta * 1000 / 150, null, zahl(a.delta * 1000, 0));
      setB(b.al, a.aufschweiss, a.aufschweiss / 1.5, 1 / 1.5, zahl(a.aufschweiss * 100, 0) + ' %');
      setB(b.last, a.last, a.last / 1.5, 1 / 1.5, zahl(a.last * 100, 0) + ' %');
      if (this.kn.vorschub) { this.kn.vorschub.classList.toggle('knopf--an', this.inp.vorschub); }
    }
    if (this.kn.spindel) { this.kn.spindel.classList.toggle('knopf--an', this.inp.spindel); }
    if (this.kn.start) { this.kn.start.classList.toggle('knopf--an', !!(this.cncZustand && this.cncZustand.lauf && !this.cncZustand.halt) || !!(this.lauf && !this.lauf.halt && !this.lauf.fertig)); }
    this.kn.kss.classList.toggle('knopf--an', this.inp.kss);
    var w = sim.w;
    this.wkzEl.textContent = (w.def.bez || (w.def.name + ' ' + (w.def.sorte || ''))) + (this.stufe === 'azubi' ? ' · VB ' + zahl(w.VB, 2) + ' mm · max. ' + zahl(w.maxT, 0) + ' °C' : '') + (w.gebrochen ? ' · GEBROCHEN' : '');
    this.scopeZeichnen();
  };

  Bearbeitung.prototype.scopeZeichnen = function () {
    if (!this.scope) { return; }
    var r = ZM.szenen.resize(this.scope), c = r.ctx, W = r.w, H = r.h;
    c.fillStyle = '#06110e';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(130,245,210,0.12)';
    c.lineWidth = 1;
    var i;
    for (i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, H * i / 4); c.lineTo(W, H * i / 4); c.stroke(); }
    var max = 1.3;
    var yG = H - H / max;
    c.strokeStyle = 'rgba(217,45,32,0.85)';
    c.setLineDash([6, 4]);
    c.beginPath();
    c.moveTo(0, yG);
    c.lineTo(W, yG);
    c.stroke();
    c.setLineDash([]);
    var v = this.verlauf, n = v.length;
    function kurve(idx, farbe) {
      c.strokeStyle = farbe;
      c.lineWidth = 1.6;
      c.beginPath();
      var j, erst = true;
      for (j = 0; j < n; j++) {
        var wv = v[j][idx];
        if (wv === null || wv === undefined) { continue; }
        var x = W - (n - 1 - j) * (W / 240);
        var y = H - Math.min(max, wv) / max * H;
        if (erst) { c.moveTo(x, y); erst = false; } else { c.lineTo(x, y); }
      }
      c.stroke();
    }
    // Huellkurve (min..max je Abtastung), damit schnelles Ruckeln nicht als Scheinmuster erscheint
    c.strokeStyle = 'rgba(130,245,210,0.35)';
    c.lineWidth = Math.max(1, W / 240);
    var jj;
    for (jj = 0; jj < n; jj++) {
      if (v[jj].length < 3 || v[jj][2] === undefined || v[jj][2] > 8) { continue; }
      var xx = W - (n - 1 - jj) * (W / 240);
      c.beginPath();
      c.moveTo(xx, H - Math.min(max, v[jj][0]) / max * H);
      c.lineTo(xx, H - Math.min(max, v[jj][2]) / max * H);
      c.stroke();
    }
    kurve(1, 'rgba(242,177,0,0.65)');
    kurve(0, '#82f5d2');
    c.fillStyle = 'rgba(217,45,32,0.9)';
    c.font = '10px ' + "'Share Tech Mono', monospace";
    c.fillText(this.stufe === 'azubi' ? 'Grenze' : '100 %', 4, yG - 3);
  };

  // ============================================================ Ende
  // Abbruch ohne Ergebnis (z. B. Wechsel in ein anderes Menue)
  Bearbeitung.prototype.abbrechen = function () {
    if (this.beendet) { return; }
    this.beendet = true;
    if (this.schicht) { this.schicht.entfernen(); }
    root.cancelAnimationFrame(this.raf);
    this.tastenAus();
    if (this.spiel.klang) { this.spiel.klang.stille(); }
  };

  Bearbeitung.prototype.beenden = function (unfall) {
    if (this.beendet) { return; }
    this.beendet = true;
    root.cancelAnimationFrame(this.raf);
    this.tastenAus();
    if (this.spiel.klang) { this.spiel.klang.stille(); }
    var sim = this.sim;
    var opZeit = sim.zeit;
    if (this.art === 'bohr') {
      // Noch offene Positionen: die aktuelle abschliessen (falls bearbeitet), Rest fehlt
      if (!sim.fertig) {
        var gebohrt = sim.typ === 'gewinde' ? sim.gew.zMax > 0.5 : sim.zMax > 0.3;
        if (gebohrt || sim.w.gebrochen) { sim.lochAbschliessen(); }
      }
      sim.ergebnisse.forEach(function (r) { opZeit += r.zeitExtra || 0; });
    }
    if (this.art === 'dreh' && this.k.setup.param.ruestZeit) { opZeit += this.k.setup.param.ruestZeit; }
    U.$('#overlay').hidden = true;
    this.k.fertig({
      sim: sim,
      art: this.art,
      zeit: opZeit,
      werkzeuge: this.wkzListe,
      wichtig: this.wichtig,
      unfall: sim.unfall || null,
      sicherheit: this.sicherheit,
      messungen: this.messungen,
      schicht: this.schicht ? this.schicht.ergebnis() : null
    });
    if (this.schicht) { this.schicht.entfernen(); }
  };

  ZM.Bearbeitung = Bearbeitung;
})(typeof window !== 'undefined' ? window : globalThis);
