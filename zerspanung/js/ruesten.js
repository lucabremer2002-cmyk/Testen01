/*
 * Ruesten: Werkzeug aus der Ausgabe holen, Maschine einstellen, Schnittwerte
 * festlegen. Der Rechner zeigt die Formeln aus dem Tabellenbuch mit den
 * gewaehlten Werten, bei CNC-Maschinen auch das NC-Programm.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM;
  var DAT = ZM.daten, PH = ZM.physik, U = ZM.ui, h = U.h;
  var zahl = U.zahl;

  function opText(op) {
    var t = { bohren: 'Bohren', reiben: 'Reiben', gewinde: 'Gewindebohren', drehen: 'Längsdrehen', fraesen: 'Fräsen' };
    return t[op.typ];
  }

  function Ruesten(spiel, mission, opIdx, weiter) {
    this.spiel = spiel;
    this.m = mission;
    this.opIdx = opIdx;
    this.op = mission.ops[opIdx];
    this.masch = DAT.maschinen[this.op.maschine];
    this.mat = DAT.werkstoffe[mission.mat];
    this.stufe = spiel.stand.einstellungen.stufe;
    this.cnc = !!this.masch.cnc;
    this.weiter = weiter;
    var op = this.op;
    var w = this.wahl = {
      typ: null, d: op.d || null, gw: null, form: null, platte: null,
      n: null, fAuto: null, vorschub: 'hand', vf: null, f: null,
      kss: this.masch.kss.indexOf('emulsion') >= 0 ? 'emulsion' : this.masch.kss[0],
      zAnschlagAn: false, zAnschlag: null, spann: 'fest', pos: this.cnc ? 'cnc' : 'anreissen', anbohren: false,
      rutschAn: false, rutsch: 9, zyklus: op.typ === 'gewinde' ? 'G84' : op.typ === 'reiben' ? 'G85' : 'G81', Z: null, Q: null,
      reitstock: false, laengsAn: op.typ === 'drehen', laenge: op.laenge || null, auskrag: null, apSchnitt: null,
      brille: false, handschuhe: false
    };
    var erlaubt = this.erlaubteTypen();
    if (erlaubt.length === 1) { w.typ = erlaubt[0]; }
    if (op.typ === 'gewinde' && op.gw) { w.form = null; }
    if (op.typ === 'drehen' || op.typ === 'fraesen') { w.f = null; }
    if (op.typ === 'gewinde') { w.kss = this.masch.kss.indexOf('oel') >= 0 ? 'oel' : w.kss; }
    if (mission.mat === 'GJL250') { w.kss = 'trocken'; }
    this.zeige();
  }

  Ruesten.prototype.erlaubteTypen = function () {
    var wz = this.m.werkzeuge || {};
    switch (this.op.typ) {
      case 'bohren': return wz.bohrer || Object.keys(DAT.bohrerTypen);
      case 'reiben': return wz.reibahlen || ['HSSE', 'VHM'];
      case 'gewinde': return wz.gewinde || Object.keys(DAT.gewinde);
      case 'drehen': return wz.platten || DAT.katalog().platten.map(function (p) { return p.id; });
      case 'fraesen': return wz.fraeser || Object.keys(DAT.fraeserTypen);
    }
    return [];
  };

  // Aktuell gewaehltes Werkzeug als Definition
  Ruesten.prototype.def = function () {
    var w = this.wahl, op = this.op;
    switch (op.typ) {
      case 'bohren': return w.typ && w.d ? DAT.bohrer(w.typ, w.d) : null;
      case 'reiben': return w.typ && w.d ? DAT.reibahle(w.typ, w.d) : null;
      case 'gewinde': return w.gw && w.form ? DAT.gewindebohrer(w.gw, w.form) : null;
      case 'drehen': return w.platte ? Object.assign({ typ: 'platte' }, DAT.platte(w.platte)) : null;
      case 'fraesen': return w.typ && w.d ? DAT.fraeser(w.typ, w.d) : null;
    }
    return null;
  };

  Ruesten.prototype.zeige = function () {
    var self = this, op = this.op, m = this.m;
    var box = U.leeren(U.$('#ruesten'));
    var kopf = h('div.ruesten__kopf', [
      h('div', [
        h('p.eyebrow', 'Arbeitsgang ' + (this.opIdx + 1) + ' von ' + m.ops.length + ' · ' + opText(op)),
        h('h1', op.name),
        h('p.muted', this.masch.name + ' · ' + this.mat.name + ' (' + this.mat.art + ')')
      ]),
      h('div.gruppe', [
        h('button.knopf', { type: 'button', onclick: function () { self.spiel.zeigeBriefing(); } }, 'Zeichnung'),
        h('button.knopf', { type: 'button', onclick: function () { self.spiel.zeigeTabellenbuch(true); } }, 'Tabellenbuch')
      ])
    ]);
    this.elWkz = h('section.panel');
    this.elMasch = h('section.panel');
    this.elRech = h('section.panel');
    var raster = h('div.ruesten', [this.elWkz, this.elMasch, this.elRech]);
    var fuss = h('div.fussleiste', [
      h('button.knopf', { type: 'button', onclick: function () { self.spiel.zeigeBriefing(); } }, 'Zurück'),
      h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { self.starten(); } }, 'An die Maschine')
    ]);
    box.appendChild(kopf);
    box.appendChild(raster);
    box.appendChild(fuss);
    this.zeigeWerkzeug();
    this.zeigeMaschine();
    this.zeigeRechner();
    U.zeige('ruesten');
  };

  // ------------------------------------------------------------ Werkzeug
  Ruesten.prototype.zeigeWerkzeug = function () {
    var self = this, op = this.op, w = this.wahl;
    var el = U.leeren(this.elWkz);
    el.appendChild(h('h2', 'Werkzeugausgabe'));
    var liste = h('div.wkz-liste');
    var typen = this.erlaubteTypen();

    function karte(def, aktiv, klick, zusatz) {
      var b = h('button.wkz', { type: 'button', 'aria-pressed': aktiv ? 'true' : 'false', onclick: klick }, [
        U.werkzeugIcon(def),
        h('span', [h('b', zusatz.titel), h('small', zusatz.text)]),
        h('span.wkz__preis', U.geld(zusatz.preis))
      ]);
      return b;
    }

    if (op.typ === 'bohren' || op.typ === 'reiben' || op.typ === 'fraesen') {
      var dRef = w.d || op.d || (op.typ === 'fraesen' ? op.breite : 8);
      typen.forEach(function (t) {
        var def;
        if (op.typ === 'bohren') { def = DAT.bohrer(t, dRef); }
        else if (op.typ === 'reiben') { def = DAT.reibahle(t, DAT.REIB_D.indexOf(dRef) >= 0 ? dRef : 10); }
        else { def = DAT.fraeser(t, DAT.FRAES_D.indexOf(dRef) >= 0 ? dRef : 10); }
        var info = op.typ === 'bohren' ? DAT.bohrerTypen[t] : op.typ === 'fraesen' ? DAT.fraeserTypen[t] : null;
        var titel = op.typ === 'reiben' ? def.name : info.name;
        var text = DAT.schneidstoffe[def.stoff].name + (op.typ === 'bohren' ? ', Spitze ' + def.spitze + '°' + (def.ikz ? ', IKZ' : '') : '') +
          (op.typ === 'fraesen' ? ', Drall ' + def.drall + '°' : '');
        liste.appendChild(karte(def, w.typ === t, function () { w.typ = t; self.aenderung(true); }, { titel: titel, text: text, preis: def.preis }));
      });
      el.appendChild(liste);
      // Durchmesser
      var ds = op.typ === 'bohren' ? DAT.BOHRER_D : op.typ === 'reiben' ? DAT.REIB_D : DAT.FRAES_D;
      if (w.typ && op.typ === 'bohren' && DAT.bohrerTypen[w.typ].stoff.indexOf('VHM') === 0) {
        ds = ds.filter(function (d) { return d >= 2 && d <= 16; });
      }
      var sel = h('select#wkz-d', { onchange: function (e) { w.d = parseFloat(e.target.value) || null; self.aenderung(true); } });
      sel.appendChild(h('option', { value: '' }, '– Durchmesser wählen –'));
      ds.forEach(function (d) {
        var o = h('option', { value: String(d) }, 'Ø ' + DAT.fmtD(d) + ' mm');
        if (w.d === d) { o.selected = true; }
        sel.appendChild(o);
      });
      el.appendChild(h('div.feld', [h('label', { for: 'wkz-d' }, 'Durchmesser'), sel]));
    } else if (op.typ === 'gewinde') {
      typen.forEach(function (gw) {
        ['B', 'C'].forEach(function (form) {
          var def = DAT.gewindebohrer(gw, form);
          liste.appendChild(karte(def, w.gw === gw && w.form === form, function () { w.gw = gw; w.form = form; self.aenderung(true); },
            { titel: gw + ' Form ' + form, text: form === 'B' ? 'Schälanschnitt, Späne nach vorn' : 'Spiralnut 35°, Späne nach oben', preis: def.preis }));
        });
      });
      el.appendChild(liste);
    } else if (op.typ === 'drehen') {
      typen.forEach(function (id) {
        var p = DAT.platte(id);
        var def = Object.assign({ typ: 'platte' }, p);
        liste.appendChild(karte(def, w.platte === id, function () { w.platte = id; self.aenderung(true); },
          { titel: p.name + ' ' + p.sorte, text: 'rε ' + DAT.fmtD(p.re) + ' · f ' + DAT.fmtD(p.fMin) + '–' + DAT.fmtD(p.fMax) + ' · ap ' + DAT.fmtD(p.apMin) + '–' + DAT.fmtD(p.apMax) + ' · ' + p.text,
            preis: p.preis / p.ecken }));
      });
      el.appendChild(liste);
    }
    var def = this.def();
    if (def) {
      var daten = [];
      if (def.l1) { daten.push('Gesamtlänge ' + def.l1 + ' mm', 'Schneidenlänge ' + (def.l2 || def.lc) + ' mm'); }
      if (def.frei) { daten.push('freie Länge ' + Math.round(def.frei) + ' mm'); }
      if (def.typ === 'gewinde') { daten.push('Steigung ' + DAT.fmtD(def.P) + ' mm', 'Anschnitt ' + DAT.fmtD(def.anschnitt) + ' mm'); }
      if (def.typ === 'platte') { daten.push('Einstellwinkel ' + def.kappa + '°', def.ecken + ' Schneidecken'); }
      el.appendChild(h('p.muted', { style: 'margin-top:10px;font-size:13px' }, daten.join(' · ')));
    }
  };

  // ------------------------------------------------------------ Maschine
  function stufenFeld(titel, id, werte, aktuell, einheit, empf, klick) {
    var box = h('div.stufen', { role: 'group', 'aria-label': titel });
    werte.forEach(function (v) {
      var b = h('button', { type: 'button', 'aria-pressed': aktuell === v ? 'true' : 'false', onclick: function () { klick(v); } }, DAT.fmtD(v));
      if (empf !== null && empf !== undefined && empf === v) { b.classList.add('empf'); b.title = 'Richtwert'; }
      box.appendChild(b);
    });
    return h('div.feld', [h('span.feld__titel', titel + (einheit ? ' (' + einheit + ')' : '')), box]);
  }

  function zahlFeld(titel, id, wert, einheit, min, max, schritt, aendern, hilfe) {
    var inp = h('input#' + id, { type: 'number', inputmode: 'decimal', min: min, max: max, step: schritt, value: wert === null || wert === undefined ? '' : String(wert),
      oninput: function (e) { var v = parseFloat(String(e.target.value).replace(',', '.')); aendern(isNaN(v) ? null : v); } });
    return h('div.feld', [h('label', { for: id }, titel + (einheit ? ' (' + einheit + ')' : '')), inp, hilfe ? h('small', hilfe) : null]);
  }

  function radioFeld(titel, name, optionen, aktuell, aendern) {
    var box = h('div.wahl');
    optionen.forEach(function (o) {
      var inp = h('input', { type: 'radio', name: name, value: o.id, checked: aktuell === o.id, onchange: function () { aendern(o.id); } });
      box.appendChild(h('label', [inp, h('span', [o.name, o.text ? h('small.muted', o.text) : null])]));
    });
    return h('div.feld', [h('span.feld__titel', titel), box]);
  }

  function checkFeld(titel, id, an, aendern, kind) {
    var inp = h('input#' + id, { type: 'checkbox', checked: an, onchange: function (e) { aendern(e.target.checked); } });
    return h('div.feld', [h('div.wahl', [h('label', { for: id }, [inp, h('span', titel)])]), kind || null]);
  }

  Ruesten.prototype.empfehlung = function () {
    var def = this.def();
    if (!def) { return null; }
    var e = PH.empfehlung(this.mat, def, this.masch);
    if (def.typ === 'platte') {
      var dm = (this.op.wst.D + this.op.d) / 2;
      e.n = e.vc * 1000 / (Math.PI * dm);
      if (this.masch.drehzahlen) { e.nStufe = DAT.stufeUnter(this.masch.drehzahlen, e.n); }
    }
    if (def.typ === 'fraeser' && this.masch.vorschuebeMin && e.vf) {
      var nS = e.nStufe || e.n;
      e.vfStufe = DAT.stufeUnter(this.masch.vorschuebeMin, e.fz * def.z * nS);
    }
    if (this.masch.vorschuebe && e.f) { e.fStufe = DAT.stufeUnter(this.masch.vorschuebe, e.f); }
    return e;
  };

  Ruesten.prototype.zeigeMaschine = function () {
    var self = this, op = this.op, w = this.wahl, m = this.masch;
    var el = U.leeren(this.elMasch);
    el.appendChild(h('h2', 'Maschine einrichten'));
    var e = this.stufe === 'meister' ? null : this.empfehlung();
    function neu() { self.aenderung(false); }
    var kssOpt = m.kss.map(function (k) { return { id: k, name: DAT.kss[k].name }; });

    // Drehzahl
    if (m.drehzahlen) {
      el.appendChild(stufenFeld('Drehzahl', 'n', m.drehzahlen, w.n, '1/min', e ? e.nStufe : null, function (v) { w.n = v; self.aenderung(true); }));
    } else {
      el.appendChild(zahlFeld('Drehzahl S', 'r-n', w.n, '1/min', m.nMin, m.nMax, 10, function (v) { w.n = v; neu(); }, 'stufenlos ' + m.nMin + ' … ' + m.nMax + ' 1/min'));
    }

    if (op.typ === 'bohren' || op.typ === 'reiben') {
      if (!this.cnc) {
        el.appendChild(radioFeld('Vorschub', 'vorschub', [
          { id: 'hand', name: 'Handhebel', text: 'Du bestimmst die Vorschubkraft' },
          { id: 'auto', name: 'Pinolenvorschub automatisch', text: 'konstanter Vorschub je Umdrehung' }
        ], w.vorschub, function (v) { w.vorschub = v; self.aenderung(true); }));
        if (w.vorschub === 'auto') {
          el.appendChild(stufenFeld('Vorschubstufe', 'f', m.vorschuebe, w.fAuto, 'mm/U', e ? e.fStufe : null, function (v) { w.fAuto = v; self.aenderung(true); }));
        }
        el.appendChild(checkFeld('Tiefenanschlag setzen', 'r-za', w.zAnschlagAn, function (v) { w.zAnschlagAn = v; self.aenderung(true); },
          w.zAnschlagAn ? zahlFeld('Anschlag (Spitzentiefe)', 'r-zaw', w.zAnschlag, 'mm', 0, 200, 0.1, function (v) { w.zAnschlag = v; neu(); }) : null));
        if (op.typ === 'bohren' && !op.vor) {
          el.appendChild(radioFeld('Positionieren', 'pos', [
            { id: 'anreissen', name: 'Anreißen und körnen', text: 'Lage ca. ±0,2 mm' },
            { id: 'kreuztisch', name: 'Kreuztisch mit Messuhr', text: 'Lage ca. ±0,03 mm, dauert länger' }
          ], w.pos, function (v) { w.pos = v; neu(); }));
          el.appendChild(checkFeld('Mit NC-Anbohrer zentrieren (+12 s je Bohrung)', 'r-anb', w.anbohren, function (v) { w.anbohren = v; neu(); }));
        }
      } else {
        el.appendChild(zahlFeld('Vorschub f', 'r-f', w.fAuto, 'mm/U', 0.005, 1, 0.005, function (v) { w.fAuto = v; neu(); }));
        var zyk = op.typ === 'reiben' ? [{ id: 'G85', name: 'G85 Reibzyklus' }] : [
          { id: 'G81', name: 'G81 Bohren', text: 'in einem Zug auf Tiefe' },
          { id: 'G82', name: 'G82 Tiefbohren mit Spanbruch', text: 'kurzer Rückzug 0,5 mm nach jeder Zustellung' },
          { id: 'G83', name: 'G83 Tiefbohren mit Spanentleerung', text: 'Rückzug auf Sicherheitsebene nach jeder Zustellung' }];
        el.appendChild(radioFeld('Bohrzyklus', 'zyk', zyk, w.zyklus, function (v) { w.zyklus = v; self.aenderung(true); }));
        el.appendChild(zahlFeld('Bohrtiefe Z (Spitze)', 'r-z', w.Z, 'mm', 0, 200, 0.1, function (v) { w.Z = v; neu(); }));
        if (w.zyklus === 'G82' || w.zyklus === 'G83') {
          el.appendChild(zahlFeld('Zustelltiefe Q', 'r-q', w.Q, 'mm', 0.5, 50, 0.5, function (v) { w.Q = v; neu(); }));
        }
      }
    } else if (op.typ === 'gewinde') {
      if (!this.cnc) {
        el.appendChild(zahlFeld('Tiefenanschlag (Spitze, Umsteuerung)', 'r-za2', w.zAnschlag, 'mm', 0, 200, 0.1, function (v) { w.zAnschlag = v; neu(); },
          'Gewindeschneidapparat mit Längenausgleich steuert am Anschlag um'));
        el.appendChild(checkFeld('Rutschkupplung aktiv', 'r-ru', w.rutschAn, function (v) { w.rutschAn = v; self.aenderung(true); },
          w.rutschAn ? zahlFeld('Auslösemoment', 'r-ruw', w.rutsch, 'Nm', 0.5, 80, 0.5, function (v) { w.rutsch = v; neu(); }) : null));
      } else {
        el.appendChild(zahlFeld('Gewindetiefe Z (Spitze), G84', 'r-z', w.Z, 'mm', 0, 200, 0.1, function (v) { w.Z = v; neu(); }));
      }
    } else if (op.typ === 'drehen') {
      el.appendChild(stufenFeld('Vorschub', 'f', m.vorschuebe, w.f, 'mm/U', e ? DAT.stufeUnter(m.vorschuebe, e.f || 0.2) : null, function (v) { w.f = v; self.aenderung(true); }));
      if (op.reitstockErlaubt || this.m.id === 'WERKSTATT') {
        el.appendChild(checkFeld('Mit Reitstock (mitlaufende Körnerspitze)', 'r-rs', w.reitstock, function (v) { w.reitstock = v; neu(); }));
      }
      el.appendChild(checkFeld('Längsanschlag setzen', 'r-la', w.laengsAn, function (v) { w.laengsAn = v; self.aenderung(true); },
        w.laengsAn ? zahlFeld('Drehlänge vom freien Ende', 'r-law', w.laenge, 'mm', 1, op.wst.L - 1, 0.1, function (v) { w.laenge = v; neu(); }) : null));
    } else if (op.typ === 'fraesen') {
      if (m.vorschuebeMin) {
        el.appendChild(stufenFeld('Tischvorschub', 'vf', m.vorschuebeMin, w.vf, 'mm/min', e ? e.vfStufe : null, function (v) { w.vf = v; self.aenderung(true); }));
      } else {
        el.appendChild(zahlFeld('Vorschub F', 'r-vf', w.vf, 'mm/min', 10, m.vfMax, 10, function (v) { w.vf = v; neu(); }));
        el.appendChild(zahlFeld('Zustellung je Schnitt', 'r-ap', w.apSchnitt, 'mm', 0.1, 40, 0.1, function (v) { w.apSchnitt = v; neu(); }, 'Das Programm fährt so viele Schnitte, bis die Nuttiefe erreicht ist.'));
      }
      var def = this.def();
      var minA = def ? def.lc + 4 : 20;
      if (w.auskrag === null && def) { w.auskrag = def.lc + 8; }
      el.appendChild(zahlFeld('Auskraglänge', 'r-ak', w.auskrag, 'mm', minA, 120, 1, function (v) { w.auskrag = v; neu(); }, def ? 'mindestens ' + minA + ' mm (Schneidenlänge ' + def.lc + ' mm)' : null));
    }

    el.appendChild(radioFeld('Kühlschmierung', 'kss', kssOpt, w.kss, function (v) { w.kss = v; neu(); }));
    if (!this.cnc) {
      el.appendChild(h('div.feld', [h('span.feld__titel', 'Persönliche Schutzausrüstung'),
        h('div.wahl', [
          h('label', [h('input', { type: 'checkbox', checked: w.brille, onchange: function (ev) { w.brille = ev.target.checked; } }), h('span', 'Schutzbrille')]),
          h('label', [h('input', { type: 'checkbox', checked: w.handschuhe, onchange: function (ev) { w.handschuhe = ev.target.checked; } }), h('span', 'Arbeitshandschuhe')])
        ])]));
    }
    if ((op.typ === 'bohren' || op.typ === 'reiben' || op.typ === 'gewinde') && !this.cnc) {
      el.appendChild(radioFeld('Spannmittel', 'spann', Object.keys(DAT.spannmittel).map(function (k) { return { id: k, name: DAT.spannmittel[k].name }; }), w.spann, function (v) { w.spann = v; neu(); }));
    }
  };

  // ------------------------------------------------------------ Rechner
  Ruesten.prototype.zeigeRechner = function () {
    var op = this.op, w = this.wahl, mat = this.mat;
    var el = U.leeren(this.elRech);
    el.appendChild(h('h2', 'Rechner'));
    var def = this.def();
    var r = h('div.rechner');
    function zeile(a, b) { r.appendChild(h('div.rechner__zeile', [h('span', a), h('span', b)])); }
    if (!def) {
      el.appendChild(h('p.muted', 'Zuerst ein Werkzeug wählen.'));
      return;
    }
    var e = this.stufe === 'meister' ? null : this.empfehlung();
    var n = w.n;
    var d = def.typ === 'platte' ? op.wst.D : def.d;
    if (n) {
      zeile('vc = π · d · n / 1000', zahl(Math.PI * d * n / 1000, 1) + ' m/min');
      if (def.typ === 'platte') { zeile('vc am Fertigmaß Ø' + DAT.fmtD(op.d), zahl(Math.PI * op.d * n / 1000, 1) + ' m/min'); }
    }
    if (e) {
      zeile('Richtwert vc (Tabellenbuch)', zahl(e.vc, 0) + ' m/min');
      if (e.n) { zeile('→ n = vc · 1000 / (π · d)', zahl(e.n, 0) + ' 1/min'); }
      if (e.f && def.typ !== 'gewinde') { zeile('Richtwert f', zahl(e.f, 3) + ' mm/U'); }
      if (e.fz) { zeile('Richtwert fz', zahl(e.fz, 3) + ' mm'); }
    }
    var kc;
    if ((def.typ === 'bohrer' || def.typ === 'reibahle') && n) {
      var f = w.vorschub === 'auto' || this.cnc ? w.fAuto : (e ? e.f : null);
      if (f) {
        var hh = f / 2 * Math.sin(def.spitze / 2 * Math.PI / 180);
        kc = PH.kcKienzle(mat, hh) * 1.2;
        var M = kc * f * def.d * def.d / 8 / 1000;
        if (def.typ === 'reibahle') {
          var r0 = (def.d - 0.2) / 2;
          M = kc * f * (def.d * def.d / 4 - r0 * r0) / 2 / 1000;
        }
        var P = M * n / 9550;
        zeile('vf = f · n', zahl(f * n, 0) + ' mm/min' + (w.vorschub === 'hand' && !this.cnc ? ' (bei Richtwert)' : ''));
        zeile('Mc = kc · f · d² / 8', zahl(M, 2) + ' Nm');
        zeile('Pc = Mc · n / 9550', zahl(P, 2) + ' kW (Maschine ' + DAT.fmtD(this.masch.P) + ' kW)');
        if (this.stufe === 'azubi' && def.typ === 'bohrer') {
          var wp = (def.stoff.indexOf('VHM') === 0 ? 0.045 : 0.03) * Math.pow(def.d, 3);
          zeile('Bruchmoment ca.', zahl(DAT.schneidstoffe[def.stoff].tau * wp / 1000, 1) + ' Nm');
        }
        var L = (op.durch ? op.dicke + def.d * 0.3 + 2 : (op.tiefe || 10) + def.d * 0.3) + 2;
        zeile('th = L / (f · n) je Bohrung', zahl(L / (f * n) * 60, 1) + ' s');
      }
    } else if (def.typ === 'gewinde' && n) {
      zeile('Vorschub = Steigung', DAT.fmtD(def.P) + ' mm/U');
      zeile('Bruchmoment ca.', zahl(def.mBruch / 1000, 1) + ' Nm');
      if (this.stufe === 'azubi') {
        r.appendChild(h('p.rechner__formel', 'Kernloch = Nenndurchmesser − Steigung. Anschnitt ' + DAT.fmtD(def.anschnitt) + ' mm – der Tiefenanschlag muss für ein Durchgangsgewinde mindestens Plattendicke + Anschnitt sein.'));
      }
    } else if (def.typ === 'platte') {
      if (w.f) {
        var rz = w.f * w.f / (8 * def.re) * 1000 * (def.wiper ? 0.5 : 1);
        zeile('Rz,th = f² / (8 · rε)', zahl(rz, 2) + ' µm');
        zeile('Ra ≈ Rz / 4', zahl(rz / 4, 2) + ' µm');
        kc = PH.kcKienzle(mat, w.f);
        zeile('Fc je mm Schnitttiefe', zahl(kc * w.f, 0) + ' N');
        if (n) {
          var vc = Math.PI * op.wst.D * n / 1000;
          zeile('Pc je mm Schnitttiefe', zahl(kc * w.f * vc / 60000, 2) + ' kW');
          zeile('th = l / (f · n) je Schnitt', zahl(op.laenge / (w.f * n) * 60, 1) + ' s');
        }
        if (w.f < def.fMin || w.f > def.fMax) { r.appendChild(h('p.rechner__warn', 'Vorschub außerhalb des Spanformbereichs der Platte (' + DAT.fmtD(def.fMin) + '–' + DAT.fmtD(def.fMax) + ' mm/U).')); }
      }
    } else if (def.typ === 'fraeser' && n && w.vf) {
      var fz = w.vf / (def.z * n);
      var hm = fz * 2 / Math.PI;
      kc = PH.kcKienzle(mat, hm);
      zeile('fz = vf / (z · n)', zahl(fz, 3) + ' mm');
      zeile('hm (Vollnut) = 2/π · fz', zahl(hm, 3) + ' mm');
      zeile('Pc je mm ap (Vollnut)', zahl(def.d * w.vf * kc / 60e6, 2) + ' kW');
      zeile('th = (l + d) / vf je Schnitt', zahl((op.wst.L + def.d + 12) / w.vf * 60, 1) + ' s');
    }
    el.appendChild(r);
    if (this.cnc) {
      el.appendChild(h('h3', { style: 'margin:14px 0 6px' }, 'NC-Programm'));
      el.appendChild(h('pre.nc', this.ncText(def)));
    }
  };

  Ruesten.prototype.ncText = function (def) {
    var w = this.wahl, op = this.op, z = [];
    var n = w.n ? Math.round(w.n) : '?';
    var kss = w.kss === 'trocken' ? '' : w.kss === 'ikz' ? 'M88 (IKZ EIN)' : 'M8 (KSS EIN)';
    z.push('%O' + (1000 + this.opIdx) + ' (' + op.name.toUpperCase() + ')');
    z.push('N10 G90 G54 G17');
    z.push('N20 T1 M6 (' + (def.bez || def.name) + ')');
    z.push('N30 S' + n + ' M3');
    if (kss) { z.push('N40 ' + kss); }
    var nr = 50;
    if (op.typ === 'fraesen') {
      var ap = w.apSchnitt || op.tiefe;
      var tief = 0, k = 0;
      z.push('N' + nr + ' G0 X' + (-(def.d / 2 + 6)) + ' Y' + DAT.fmtD(op.y) + ' Z2'); nr += 10;
      while (tief < op.tiefe - 1e-6 && k < 40) {
        tief = Math.min(op.tiefe, tief + ap);
        k++;
        z.push('N' + nr + ' G1 Z' + DAT.fmtD(-Math.round(tief * 100) / 100) + ' F500'); nr += 10;
        z.push('N' + nr + ' G1 X' + (op.wst.L + def.d / 2 + 6) + ' F' + (w.vf || '?')); nr += 10;
        z.push('N' + nr + ' G0 Z2'); nr += 10;
        z.push('N' + nr + ' G0 X' + (-(def.d / 2 + 6))); nr += 10;
      }
    } else {
      var F = w.fAuto && w.n ? Math.round(w.fAuto * w.n) : '?';
      var p0 = op.pos[0];
      z.push('N' + nr + ' G0 X' + p0[0] + ' Y' + p0[1] + ' Z2'); nr += 10;
      var zyk = w.zyklus;
      var zeile = 'N' + nr + ' ' + zyk + ' Z' + (w.Z ? DAT.fmtD(-w.Z) : '?') + ' R2';
      if (zyk === 'G82' || zyk === 'G83') { zeile += ' Q' + (w.Q ? DAT.fmtD(w.Q) : '?'); }
      zeile += zyk === 'G84' ? ' F' + (w.n && def.P ? Math.round(def.P * w.n) : '?') : ' F' + F;
      z.push(zeile); nr += 10;
      op.pos.slice(1).forEach(function (p) { z.push('N' + nr + ' X' + p[0] + ' Y' + p[1]); nr += 10; });
      z.push('N' + nr + ' G80'); nr += 10;
    }
    z.push('N' + nr + ' G0 Z100 M9'); nr += 10;
    z.push('N' + nr + ' M30');
    return z.join('\n');
  };

  Ruesten.prototype.aenderung = function (alles) {
    if (alles) {
      this.zeigeWerkzeug();
      this.zeigeMaschine();
    }
    this.zeigeRechner();
  };

  // ------------------------------------------------------------ Start
  Ruesten.prototype.starten = function () {
    var w = this.wahl, op = this.op, def = this.def();
    var fehler = null;
    if (!def) { fehler = 'Es ist noch kein Werkzeug ausgewählt.'; }
    else if (!w.n) { fehler = 'Die Drehzahl fehlt.'; }
    else if (op.typ === 'bohren' || op.typ === 'reiben') {
      if ((w.vorschub === 'auto' || this.cnc) && !w.fAuto) { fehler = 'Der Vorschub fehlt.'; }
      if (this.cnc && !w.Z) { fehler = 'Die Bohrtiefe Z fehlt.'; }
      if (this.cnc && (w.zyklus === 'G82' || w.zyklus === 'G83') && !w.Q) { fehler = 'Die Zustelltiefe Q fehlt.'; }
      if (!this.cnc && w.zAnschlagAn && !w.zAnschlag) { fehler = 'Der Tiefenanschlag hat keinen Wert.'; }
      if (def.d > (this.masch.futter || 99)) { fehler = 'Das Bohrfutter spannt nur bis Ø ' + this.masch.futter + ' mm.'; }
    } else if (op.typ === 'gewinde') {
      if (!this.cnc && !w.zAnschlag) { fehler = 'Ohne Tiefenanschlag steuert der Gewindeschneidapparat nicht um.'; }
      if (this.cnc && !w.Z) { fehler = 'Die Gewindetiefe Z fehlt.'; }
    } else if (op.typ === 'drehen') {
      if (!w.f) { fehler = 'Der Vorschub fehlt.'; }
      if (w.laengsAn && !w.laenge) { fehler = 'Die Länge für den Längsanschlag fehlt.'; }
    } else if (op.typ === 'fraesen') {
      if (!w.vf) { fehler = 'Der Vorschub fehlt.'; }
      if (!w.auskrag || w.auskrag < def.lc + 4) { fehler = 'Die Auskraglänge muss mindestens ' + (def.lc + 4) + ' mm sein.'; }
      if (this.cnc && !w.apSchnitt) { fehler = 'Die Zustellung je Schnitt fehlt.'; }
      if (op.tiefe > def.lc) { fehler = 'Die Schneidenlänge (' + def.lc + ' mm) reicht nicht für ' + DAT.fmtD(op.tiefe) + ' mm Tiefe.'; }
    }
    if (fehler) { U.toast(fehler); return; }

    var param = {
      n: w.n, kss: w.kss, spann: w.spann, pos: w.pos, anbohren: w.anbohren && op.typ === 'bohren' && !op.vor,
      psa: { brille: w.brille, handschuhe: w.handschuhe }
    };
    if (op.typ === 'bohren' || op.typ === 'reiben') {
      param.fAuto = this.cnc || w.vorschub === 'auto' ? w.fAuto : null;
      param.vorschubAuto = !this.cnc && w.vorschub === 'auto';
      param.zAnschlag = !this.cnc && w.zAnschlagAn ? w.zAnschlag : null;
      if (this.cnc) { param.zyklus = { art: w.zyklus, Z: w.Z, Q: w.Q || 1e9 }; }
    } else if (op.typ === 'gewinde') {
      param.zAnschlag = this.cnc ? null : w.zAnschlag;
      param.rutsch = !this.cnc && w.rutschAn ? w.rutsch : null;
      if (this.cnc) { param.zyklus = { art: 'G84', Z: w.Z }; }
    } else if (op.typ === 'drehen') {
      param.f = w.f;
      param.reitstock = w.reitstock;
      param.zAnschlag = w.laengsAn ? op.wst.L - w.laenge : null;
    } else if (op.typ === 'fraesen') {
      param.vf = w.vf;
      param.auskragung = w.auskrag;
      param.apSchnitt = w.apSchnitt;
      param.richtung = 1;
    }
    this.weiter({ def: def, param: param, nc: this.cnc ? this.ncText(def) : null });
  };

  ZM.Ruesten = Ruesten;
})(typeof window !== 'undefined' ? window : globalThis);
