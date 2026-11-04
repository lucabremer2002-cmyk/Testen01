/*
 * Freier Modus Drechselbank: Rohling waehlen, frei drechseln, Oberflaeche,
 * abstechen, praesentieren, in die Vitrine stellen.
 *
 * Bedienung: Maustaste bzw. Finger halten und das Werkzeug ans Holz fuehren
 * (die Spitze folgt dem Zeiger, bei Touch etwas ueber dem Finger). Tasten:
 * 1-8 Werkzeuge, Leertaste Spindel, Strg+Z Rueckgaengig, F Fertig.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM;
  var U = ZM.ui, h = U.h, HZ = ZM.holz, B = ZM.belohnung;

  var GROESSEN = [
    { id: 'klein', name: 'Kurz', text: '120 × 50 mm', L: 120, a: 25 },
    { id: 'mittel', name: 'Mittel', text: '200 × 60 mm', L: 200, a: 30 },
    { id: 'gross', name: 'Lang', text: '260 × 76 mm', L: 260, a: 38 }
  ];

  function Drechselbank(spiel) {
    this.spiel = spiel;
    this.wahl = { holz: 'buche', groesse: 'mittel', vorlage: null };
    this.sim = null;
    this.szene = null;
    this.raf = null;
    this.laeuft = false;
    this.tastenAn = false;
    this.hudZeit = 0;
    this.fertig = false;
  }

  Drechselbank.prototype.box = function () { return U.$('#drechseln'); };

  Drechselbank.prototype.zeigen = function () {
    U.zeige('drechseln');
    if (this.sim && !this.fertig) { this.weiter(); } else { this.setupZeigen(); }
  };

  // ============================================================ Rohling waehlen
  Drechselbank.prototype.setupZeigen = function () {
    var self = this, box = U.leeren(this.box()), w = this.wahl, p = B.profil(this.spiel.stand);
    this.pause();
    this.sim = null;
    var dr = p.drechseln || {};
    box.className = 'dr dr--setup';
    box.appendChild(h('div.dr-setup__kopf', [
      h('div', [h('p.eyebrow', 'Freier Modus'), h('h1', ['Drechselbank ', h('span.glanz', 'ohne Crash')]),
        h('p.muted', 'Holz einspannen, Spindel läuft, Werkzeug ans Holz – nimm so viel weg, wie du willst. Nichts bricht, nichts crasht.')]),
      h('button.knopf.knopf--gelb.knopf--gross', { type: 'button', onclick: function () { self.starten(); } }, [h('small', 'Los geht’s'), 'Drechseln!'])
    ]));
    // Holzarten mit kleinem Vorschaubild
    var hoelzer = h('div.dr-hoelzer');
    HZ.HOELZER.forEach(function (holz) {
      var bild = HZ.stueckBild({ holz: holz.id, prof: vorschauProfil(), art: 'oel', seed: 5 }, 64, 88);
      bild.className = 'dr-holz__bild';
      hoelzer.appendChild(h('button.dr-holz' + (w.holz === holz.id ? '.aktiv' : ''), { type: 'button', title: holz.text, 'aria-pressed': w.holz === holz.id ? 'true' : 'false',
        onclick: function () { w.holz = holz.id; self.setupZeigen(); } }, [bild, h('b', holz.name)]));
    });
    box.appendChild(h('section.panel', [h('h2', 'Holz'), hoelzer]));
    // Groesse und Vorlage
    var groessen = h('div.dr-wahl');
    GROESSEN.forEach(function (g) {
      groessen.appendChild(h('button.dr-chip' + (w.groesse === g.id && !w.vorlage ? '.aktiv' : ''), { type: 'button', disabled: !!w.vorlage,
        onclick: function () { w.groesse = g.id; self.setupZeigen(); } }, [h('b', g.name), h('small', g.text)]));
    });
    var vorlagen = h('div.dr-vorlagen');
    vorlagen.appendChild(h('button.dr-vorlage' + (!w.vorlage ? '.aktiv' : ''), { type: 'button', onclick: function () { w.vorlage = null; self.setupZeigen(); } },
      [h('span.dr-vorlage__frei', '∞'), h('b', 'Frei'), h('small', 'Mach, was du willst')]));
    HZ.VORLAGEN.forEach(function (v) {
      var prof = [], i, n = Math.round(v.L / HZ.DZ);
      for (i = 0; i < n; i++) { prof.push(HZ.vorlageRadius(v, (i + 0.5) / n)); }
      var bild = HZ.stueckBild({ holz: w.holz, prof: prof, art: 'oel', seed: 5 }, 56, 70);
      var best = dr.vorlagen && dr.vorlagen[v.id];
      vorlagen.appendChild(h('button.dr-vorlage' + (w.vorlage === v.id ? '.aktiv' : ''), { type: 'button', onclick: function () { w.vorlage = v.id; self.setupZeigen(); } },
        [bild, h('b', v.name), h('small.sterne', best ? '★★★'.slice(0, best.sterne) + '☆☆☆'.slice(best.sterne) + ' ' + best.prozent + ' %' : 'noch offen')]));
    });
    box.appendChild(h('div.dr-setup__raster', [
      h('section.panel', [h('h2', 'Rohling'), groessen, h('p.muted', { style: 'margin-top:8px' }, w.vorlage ? 'Bei Vorlagen passt der Rohling automatisch.' : 'Ein Kantholz – die Schruppröhre macht es rund.')]),
      h('section.panel', [h('h2', 'Was drehen wir?'), vorlagen])
    ]));
    // Vitrine
    var vit = p.vitrine || [];
    if (vit.length) {
      var raster = h('div.vitrine');
      vit.forEach(function (st, idx) {
        var bild = HZ.stueckBild(entpacken(st), 110, 150);
        raster.appendChild(h('div.vitrine__stueck', [bild, h('b', st.name), h('small', HZ.holzVon(st.holz).name + (st.prozent !== null && st.prozent !== undefined ? ' · ' + st.prozent + ' %' : '') + ' · ' + '★★★'.slice(0, st.sterne || 0)),
          h('button.vitrine__weg', { type: 'button', 'aria-label': 'Aus der Vitrine nehmen', title: 'Aus der Vitrine nehmen', onclick: function () { vit.splice(idx, 1); U.sichern(self.spiel.stand); self.setupZeigen(); } }, '×')]));
      });
      box.appendChild(h('section.panel', [h('h2', 'Vitrine (' + vit.length + ')'), raster]));
    }
  };

  function vorschauProfil() {
    var p = [], i, n = 80;
    for (i = 0; i < n; i++) { var u = i / (n - 1); p.push(15 + 9 * Math.sin(u * Math.PI) - 4 * Math.exp(-Math.pow((u - 0.7) / 0.06, 2)) + 3 * Math.exp(-Math.pow((u - 0.25) / 0.04, 2))); }
    return p;
  }

  // Vitrine speichert 1-mm-Raster; fuer das Bild wieder auf das 0,5-mm-Raster bringen
  function entpacken(st) {
    var prof = [], brand = st.brand ? [] : null, i;
    for (i = 0; i < st.prof.length; i++) {
      prof.push(st.prof[i], st.prof[i]);
      if (brand) { brand.push(st.brand[i] || 0, st.brand[i] || 0); }
    }
    return { holz: st.holz, prof: prof, brand: brand, art: st.art, beize: st.beize, glaette: st.glaette, seed: st.seed };
  }

  // ============================================================ Werkstatt
  Drechselbank.prototype.starten = function () {
    var w = this.wahl, g = GROESSEN[1], i;
    for (i = 0; i < GROESSEN.length; i++) { if (GROESSEN[i].id === w.groesse) { g = GROESSEN[i]; } }
    var v = w.vorlage ? HZ.vorlageVon(w.vorlage) : null;
    var L = v ? v.L + 22 : g.L, a = v ? v.a : g.a;
    this.sim = new HZ.Drechsel({ holz: w.holz, L: L, a: a, vorlage: w.vorlage });
    this.szene = new ZM.szenen.HolzSzene(this.sim);
    this.fertig = false;
    this.ersterSchnitt = false;
    this.startZeit = Date.now();
    this.uiBauen();
    this.weiter();
  };

  Drechselbank.prototype.uiBauen = function () {
    var self = this, box = U.leeren(this.box()), sim = this.sim;
    box.className = 'dr dr--werk';
    var titel = sim.vorlage ? sim.vorlage.name : 'Freies Stück';
    this.elTreffer = h('b.dr-treffer__wert', '–');
    this.elTrefferRing = h('span.dr-treffer__ring');
    this.elAbtrag = h('span.dr-kopf__abtrag', '0 cm³');
    box.appendChild(h('div.dr-kopf', [
      h('div.dr-kopf__titel', [h('h2', titel), h('span.muted', sim.holz.name + ' · ' + Math.round(sim.L) + ' mm'), this.elAbtrag]),
      sim.vorlage ? h('div.dr-treffer', { title: 'Wie genau du die Vorlage triffst' }, [this.elTrefferRing, h('div', [h('small', 'Formtreue'), this.elTreffer])]) : null,
      h('div.dr-kopf__knoepfe', [
        h('button.knopf.knopf--klein', { type: 'button', title: 'Rückgängig (Strg+Z)', onclick: function () { self.rueckgaengig(); } }, '↶ Zurück'),
        h('button.knopf.knopf--klein', { type: 'button', title: 'Späne wegfegen', onclick: function () { self.szene.fegen(); self.klick(); } }, 'Fegen'),
        h('button.knopf.knopf--klein', { type: 'button', onclick: function () { self.setupZeigen(); } }, 'Neuer Rohling'),
        h('button.knopf.knopf--klein.knopf--gelb', { type: 'button', title: 'Abstechen und präsentieren (F)', onclick: function () { self.fertigMachen(); } }, 'Fertig!')
      ])
    ]));
    this.cv = h('canvas.dr-szene', { 'aria-label': 'Drechselbank. Maustaste oder Finger halten und das Werkzeug ans Holz führen.' });
    this.elHinweis = h('div.dr-hinweis', sim.vorlage ? 'Halte die Maustaste und folge der blauen Kontur. Erst schruppen (1), dann formen.' : 'Halte die Maustaste und führe das Werkzeug ans Holz. Erst schruppen (1) – das Kantholz wird rund.');
    this.elWz = h('div.dr-wzinfo');
    this.elPopups = h('div.popups');
    var buehne = h('div.dr-buehne', [this.cv, this.elWz, this.elHinweis, this.elPopups]);
    box.appendChild(buehne);
    // Werkzeugleiste
    var wzLeiste = h('div.dr-werkzeuge', { role: 'toolbar', 'aria-label': 'Werkzeuge' });
    this.wzKnoepfe = {};
    HZ.WERKZEUGE.forEach(function (wz) {
      var ic = werkzeugIcon(wz);
      var k = h('button.dr-wz' + (sim.wz.id === wz.id ? '.aktiv' : ''), { type: 'button', title: wz.name + ' – ' + wz.text + ' (' + wz.taste + ')', onclick: function () { self.werkzeugWaehlen(wz.id); } },
        [ic, h('b', wz.kurz), h('kbd', wz.taste)]);
      self.wzKnoepfe[wz.id] = k;
      wzLeiste.appendChild(k);
    });
    // Spindel und Drehzahl
    this.knSpindel = h('button.knopf.knopf--gruen.knopf--an', { type: 'button', title: 'Spindel ein/aus (Leertaste)', onclick: function () { self.spindel(); } }, 'Spindel');
    var regler = h('input', { type: 'range', min: '400', max: '3000', step: '100', value: String(sim.n), 'aria-label': 'Drehzahl',
      oninput: function (e) { sim.n = parseInt(e.target.value, 10); self.elN.textContent = sim.n + ' 1/min'; } });
    this.elN = h('output', sim.n + ' 1/min');
    // Oberflaechen
    var ob = h('div.dr-ob');
    [['oel', 'Öl'], ['wachs', 'Wachs'], ['lack', 'Lack']].forEach(function (o) {
      ob.appendChild(h('button.knopf.knopf--klein', { type: 'button', title: o[1] + ' auftragen', onclick: function () { self.oberflaeche(o[0]); } }, o[1]));
    });
    var beizen = h('div.dr-beizen', { 'aria-label': 'Beize' });
    beizen.appendChild(h('button.dr-beize.dr-beize--keine', { type: 'button', title: 'Ohne Beize', onclick: function () { self.beize(null); } }, '∅'));
    Object.keys(HZ.BEIZEN).forEach(function (id) {
      var bz = HZ.BEIZEN[id];
      beizen.appendChild(h('button.dr-beize', { type: 'button', title: 'Beize ' + bz.name, style: 'background:rgb(' + bz.rgb.join(',') + ')', onclick: function () { self.beize(id); } }));
    });
    box.appendChild(h('div.dr-leiste', [
      wzLeiste,
      h('div.dr-leiste__rechts', [
        h('div.gruppe', [this.knSpindel, h('div.hebel', [h('span.gruppe__titel', 'Drehzahl'), regler, this.elN])]),
        h('div.gruppe', [h('span.gruppe__titel', 'Oberfläche'), ob, beizen])
      ])
    ]));
    this.zeigerAn();
    this.werkzeugInfo();
  };

  // Kleines Profilbild der Schneide fuer die Werkzeugknoepfe
  function werkzeugIcon(wz) {
    var cv = document.createElement('canvas'), d = Math.min(2, root.devicePixelRatio || 1);
    cv.width = 44 * d; cv.height = 30 * d;
    cv.className = 'dr-wz__icon';
    var c = cv.getContext('2d');
    c.scale(d, d);
    c.fillStyle = '#d6dce0'; c.strokeStyle = '#d6dce0'; c.lineWidth = 2;
    var X = 22, Y = 6, s = 1.4, k;
    c.beginPath();
    if (wz.form === 'rund') { for (k = 0; k <= 16; k++) { var dz = -wz.r + 2 * wz.r * k / 16; c.lineTo(X + dz * s * (wz.r > 6 ? 0.8 : 1.6), Y + (wz.r - Math.sqrt(wz.r * wz.r - dz * dz)) * s * (wz.r > 6 ? 0.8 : 1.6)); } c.lineTo(X + 14, 28); c.lineTo(X - 14, 28); c.fill(); }
    else if (wz.form === 'flach') { var b = Math.min(28, wz.b * 1.6); c.fillRect(X - b / 2, Y, b, 22); }
    else if (wz.form === 'spitz') { c.moveTo(X, Y); c.lineTo(X + 12, Y + 18); c.lineTo(X + 12, 28); c.lineTo(X - 12, 28); c.lineTo(X - 12, Y + 18); c.fill(); }
    else if (wz.form === 'perl') { c.moveTo(X - 14, Y); for (k = 0; k <= 16; k++) { var dp = -10 + 20 * k / 16; c.lineTo(X + dp, Y + Math.sqrt(100 - dp * dp) * 0.9); } c.lineTo(X + 14, Y); c.lineTo(X + 14, 28); c.lineTo(X - 14, 28); c.fill(); }
    else if (wz.form === 'draht') { c.strokeStyle = '#ffb04a'; c.beginPath(); c.moveTo(6, 26); c.quadraticCurveTo(22, 2, 38, 26); c.stroke(); c.fillStyle = '#b98a58'; c.fillRect(2, 22, 7, 8); c.fillRect(35, 22, 7, 8); }
    else { c.fillStyle = '#d8b878'; c.fillRect(8, 8, 28, 10); c.fillStyle = '#e2a885'; c.beginPath(); c.ellipse(22, 24, 14, 6, 0, 0, Math.PI * 2); c.fill(); }
    return cv;
  }

  Drechselbank.prototype.werkzeugInfo = function () {
    var wz = this.sim.wz;
    U.leeren(this.elWz).appendChild(h('div', [h('b', wz.name), h('span', wz.text)]));
    var id;
    for (id in this.wzKnoepfe) { if (this.wzKnoepfe.hasOwnProperty(id)) { this.wzKnoepfe[id].classList.toggle('aktiv', id === wz.id); } }
  };

  Drechselbank.prototype.werkzeugWaehlen = function (id) {
    this.sim.werkzeug(id);
    this.klick();
    this.werkzeugInfo();
  };

  Drechselbank.prototype.spindel = function () {
    var sim = this.sim;
    sim.an = !sim.an;
    this.knSpindel.classList.toggle('knopf--an', sim.an);
    this.klick();
  };

  Drechselbank.prototype.rueckgaengig = function () {
    if (this.sim.rueckgaengig()) { this.klick(); this.popup('↶', 'klein'); }
  };

  Drechselbank.prototype.oberflaeche = function (art) {
    var self = this, sim = this.sim;
    if (this.szene.wisch) { return; }
    var namen = { oel: 'Öl', wachs: 'Wachs', lack: 'Lack' };
    this.szene.oberflaecheAuftragen(art, undefined, function () { self.popup(namen[art] + ' drauf!', 'gross'); if (self.spiel.klang) { self.spiel.klang.stern(1); } });
    if (!sim.an) { sim.an = true; this.knSpindel.classList.add('knopf--an'); }
  };

  Drechselbank.prototype.beize = function (id) {
    var self = this;
    if (this.szene.wisch) { return; }
    this.szene.oberflaecheAuftragen(this.sim.oberflaeche.art, id, function () { self.popup(id ? 'Gebeizt: ' + HZ.BEIZEN[id].name : 'Beize ab', 'gross'); });
  };

  Drechselbank.prototype.klick = function () { if (this.spiel.klang) { this.spiel.klang.klick(); } };

  Drechselbank.prototype.popup = function (text, art) {
    if (B && this.elPopups) { B.popup(this.elPopups, text, art || null, 50, 22); }
  };

  // ------------------------------------------------------------ Zeiger und Tasten
  Drechselbank.prototype.zeigerAn = function () {
    var self = this, cv = this.cv;
    function ziel(ev) {
      var r = cv.getBoundingClientRect(), sz = self.szene, sim = self.sim;
      if (!sz || !sz.s) { return; }
      var x = ev.clientX - r.left, y = ev.clientY - r.top - (ev.pointerType === 'touch' ? 42 : 0);
      sim.ziel.z = (x - sz.x0) / sz.s;
      sim.ziel.h = Math.max(-1, (y - sz.yc) / sz.s);
    }
    cv.addEventListener('pointerdown', function (ev) {
      if (self.fertig || !self.sim) { return; }
      ev.preventDefault();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* aelterer Browser */ }
      if (self.spiel.klang) { self.spiel.klang.start(); self.spiel.klang.holzStart(); }
      self.sim.merken();
      self.sim.halten = true;
      if (!self.sim.an) { self.sim.an = true; self.knSpindel.classList.add('knopf--an'); }
      ziel(ev);
    });
    cv.addEventListener('pointermove', function (ev) { if (self.sim && !self.fertig) { ziel(ev); } });
    function los() { if (self.sim) { self.sim.halten = false; } }
    cv.addEventListener('pointerup', los);
    cv.addEventListener('pointercancel', los);
    cv.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch' && self.sim) { self.sim.halten = false; } });
    cv.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  };

  Drechselbank.prototype.taste = function (ev) {
    if (U.ansicht() !== 'drechseln' || !this.sim || this.fertig) { return; }
    var t = ev.target && ev.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') { return; }
    var k = ev.key, sim = this.sim, i;
    if ((ev.ctrlKey || ev.metaKey) && (k === 'z' || k === 'Z')) { ev.preventDefault(); this.rueckgaengig(); return; }
    for (i = 0; i < HZ.WERKZEUGE.length; i++) { if (HZ.WERKZEUGE[i].taste === k) { this.werkzeugWaehlen(HZ.WERKZEUGE[i].id); return; } }
    if (k === ' ') { ev.preventDefault(); this.spindel(); }
    else if (k === 'f' || k === 'F') { this.fertigMachen(); }
    else if (k.indexOf('Arrow') === 0) {
      ev.preventDefault();
      var st = ev.shiftKey ? 6 : 1.5;
      if (k === 'ArrowLeft') { sim.ziel.z -= st; } else if (k === 'ArrowRight') { sim.ziel.z += st; }
      else if (k === 'ArrowUp') { sim.ziel.h -= st * 0.5; sim.halten = true; } else if (k === 'ArrowDown') { sim.ziel.h += st; sim.halten = false; }
    }
  };

  // ------------------------------------------------------------ Schleife
  Drechselbank.prototype.weiter = function () {
    var self = this;
    if (this.laeuft || !this.sim) { return; }
    this.laeuft = true;
    this.letzte = null;
    if (!this.tastenAn) {
      this.tastenAn = true;
      this.tastenFn = function (ev) { self.taste(ev); };
      root.addEventListener('keydown', this.tastenFn);
    }
    if (this.spiel.klang && this.spiel.klang.bereit) { this.spiel.klang.holzStart(); }
    this.raf = root.requestAnimationFrame(function (t) { self.schleife(t); });
  };

  Drechselbank.prototype.pause = function () {
    this.laeuft = false;
    if (this.raf) { root.cancelAnimationFrame(this.raf); this.raf = null; }
    if (this.tastenAn) { root.removeEventListener('keydown', this.tastenFn); this.tastenAn = false; }
    if (this.spiel.klang) { this.spiel.klang.holzStopp(); }
  };

  Drechselbank.prototype.schleife = function (t) {
    var self = this;
    if (!this.laeuft) { return; }
    var dt = this.letzte === null ? 1 / 60 : Math.min(0.05, (t - this.letzte) / 1000);
    this.letzte = t;
    var sim = this.sim, n = Math.max(1, Math.ceil(dt / (1 / 120))), i;
    for (i = 0; i < n; i++) { sim.step(dt / n); }
    try { this.szene.zeichne(this.cv, dt, null); } catch (e) { if (!this.zeichenFehler) { this.zeichenFehler = true; if (root.console) { root.console.error(e); } } }
    if (this.spiel.klang && this.spiel.klang.holz) {
      this.spiel.klang.holzUpdate({ n: sim.nEff, rate: sim.rate, eckig: sim.eckig, schleifen: sim.schleifen, brennen: sim.brennen, haerte: sim.holz.haerte });
    }
    if (!this.ersterSchnitt && sim.abtrag > 800) {
      this.ersterSchnitt = true;
      this.elHinweis.classList.add('weg');
    }
    this.hudZeit -= dt;
    if (this.hudZeit <= 0) { this.hudZeit = 0.15; this.hud(); }
    var ev = sim.ereignisse.splice(0);
    ev.forEach(function (e) { if (e.typ === 'abgestochen') { self.abgestochen(); } });
    this.raf = root.requestAnimationFrame(function (tt) { self.schleife(tt); });
  };

  Drechselbank.prototype.hud = function () {
    var sim = this.sim;
    this.elAbtrag.textContent = 'Abtrag ' + U.zahl(sim.abtrag / 1000, 0) + ' cm³';
    if (sim.vorlage) {
      var tr = sim.treffer();
      this.elTreffer.textContent = tr.prozent + ' %';
      this.elTrefferRing.style.setProperty('--p', String(tr.prozent));
      this.elTrefferRing.parentNode.classList.toggle('gut', tr.prozent >= 85);
      if (tr.prozent >= 85 && !this.trefferGefeiert) {
        this.trefferGefeiert = true;
        this.popup('Formtreue 85 % – drei Sterne drin!', 'gross');
        if (this.spiel.klang) { this.spiel.klang.comboHoch(3); }
      }
    }
  };

  // ------------------------------------------------------------ Fertig
  // Automatisch abstechen: Abstechstahl faehrt an der Reitstockseite des Stuecks ganz durch
  Drechselbank.prototype.fertigMachen = function () {
    var sim = this.sim;
    if (this.fertig || this.autoAb) { return; }
    var st = sim.stueck();
    this.autoAb = true;
    sim.werkzeug('abstech');
    this.werkzeugInfo();
    sim.an = true;
    this.knSpindel.classList.add('knopf--an');
    sim.merken();
    var z = Math.min(sim.L - 2, (st.i1 + 1.5) * HZ.DZ + 1.5);
    sim.spitze.z = z; sim.spitze.h = sim.radius(z) + 6;
    sim.ziel.z = z; sim.ziel.h = -1;
    sim.halten = true;
    sim.wz = { id: 'abstech', name: 'Abstechstahl', kurz: 'Abstechen', text: 'Sticht das fertige Stück ab.', form: 'flach', b: 3, rau: 0.5, span: 'grob', tempo: 3, durch: true };
  };

  Drechselbank.prototype.abgestochen = function () {
    var self = this;
    if (this.fertig) { return; }
    this.fertig = true;
    this.autoAb = false;
    this.sim.halten = false;
    this.sim.an = false;
    this.popup('Abgestochen!', 'combo');
    if (this.spiel.klang) { this.spiel.klang.stempel(); }
    setTimeout(function () { self.praesentieren(); }, 900);
  };

  Drechselbank.prototype.praesentieren = function () {
    var self = this, sim = this.sim, st = sim.stueck(), tr = sim.treffer();
    var name = sim.vorlage ? sim.vorlage.name : HZ.nameFuer(st.prof, sim.holz, sim.oberflaeche);
    var brennt = false, i;
    for (i = st.i0; i <= st.i1; i++) { if (sim.brand[i] > 0.15) { brennt = true; break; } }
    // Vitrine: 1-mm-Raster
    var prof1 = [], brand1 = brennt ? [] : null;
    for (i = 0; i < st.prof.length; i += 2) {
      prof1.push(Math.round(st.prof[i] * 10) / 10);
      if (brand1) { brand1.push(Math.round(sim.brand[st.i0 + i] * 100) / 100); }
    }
    var stueck = { name: name, holz: sim.holz.id, art: sim.oberflaeche.art, beize: sim.oberflaeche.beize, prof: prof1, brand: brand1,
      glaette: Math.round(st.glaette * 100) / 100, prozent: tr ? tr.prozent : null, vorlage: sim.vorlage ? sim.vorlage.id : null, seed: sim.seed,
      abtrag: sim.abtrag, schnittZeit: sim.schnittZeit, gebrannt: brennt };
    var bel = B.drechselAbschluss(this.spiel, stueck);
    U.sichern(this.spiel.stand);
    this.pause();
    this.showZeigen(stueck, bel);
  };

  Drechselbank.prototype.showZeigen = function (stueck, bel) {
    var self = this, kl = this.spiel.klang;
    var bild = HZ.stueckBild(entpacken(stueck), 300, 380);
    bild.className = 'dr-show__bild';
    var sterne = h('div.belohnung__sterne.dr-show__sterne');
    var k;
    for (k = 0; k < 3; k++) { sterne.appendChild(h('span.bstern', '★')); }
    var liste = h('ul.xpliste');
    var werte = h('dl.dr-show__werte', [
      stueck.prozent !== null ? h('div', [h('dt', 'Formtreue'), h('dd', stueck.prozent + ' %')]) : null,
      h('div', [h('dt', 'Glätte'), h('dd', Math.round(stueck.glaette * 100) + ' %')]),
      h('div', [h('dt', 'Holz'), h('dd', HZ.holzVon(stueck.holz).name)]),
      h('div', [h('dt', 'Oberfläche'), h('dd', { roh: 'roh', oel: 'geölt', wachs: 'gewachst', lack: 'lackiert' }[stueck.art] + (stueck.beize ? ', ' + HZ.BEIZEN[stueck.beize].name.toLowerCase() + ' gebeizt' : ''))]),
      h('div', [h('dt', 'Späne'), h('dd', U.zahl(stueck.abtrag / 1000, 0) + ' cm³')])
    ]);
    var karte = h('div.dr-show', { role: 'dialog', 'aria-label': 'Fertiges Stück' }, h('div.dr-show__karte', [
      h('div.dr-show__buehne', [h('div.dr-show__licht'), bild, h('div.dr-show__teller')]),
      h('div.dr-show__text', [
        h('p.eyebrow', 'Fertig!'),
        h('h1', stueck.name),
        sterne,
        werte,
        liste,
        bel.erfolge.length ? h('div.belohnung__erfolge', bel.erfolge.map(function (e) { return h('div.erfolg.erfolg--frei.erfolg--neu', [h('span.erfolg__icon', e.icon), h('div', [h('small', 'Neuer Erfolg'), h('b', e.titel), h('span', e.text)])]); })) : null,
        h('div.fussleiste', { style: 'justify-content:flex-start' }, [
          h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { zu(); self.starten(); } }, 'Nochmal'),
          h('button.knopf', { type: 'button', onclick: function () { zu(); self.setupZeigen(); } }, 'Neues Holz'),
          h('button.knopf', { type: 'button', onclick: function () { zu(); self.setupZeigen(); var v = U.$('.vitrine'); if (v && v.scrollIntoView) { v.scrollIntoView({ block: 'center' }); } } }, 'Zur Vitrine')
        ])
      ])
    ]));
    function zu() { if (karte.parentNode) { karte.parentNode.removeChild(karte); } self.spiel.kopf(true); }
    document.body.appendChild(karte);
    // Sterne nacheinander, dann Erfahrung
    var schritt = 0;
    function weiter() {
      if (!karte.parentNode) { return; }
      if (schritt < 3) {
        if (schritt < bel.sterne) { sterne.childNodes[schritt].classList.add('an'); if (kl) { kl.stern(schritt); } }
        schritt++;
        setTimeout(weiter, schritt <= bel.sterne ? 380 : 60);
        return;
      }
      if (schritt === 3) {
        if (bel.sterne === 3) { B.konfetti(160); } else if (bel.sterne === 2) { B.konfetti(60); }
        schritt++;
      }
      var z = bel.xpZeilen[schritt - 4];
      if (z) {
        liste.appendChild(h('li', [h('span', z.text), h('b', '+' + z.xp + ' XP')]));
        if (kl) { kl.tick(schritt); }
        schritt++;
        setTimeout(weiter, 240);
        return;
      }
      if (bel.hinweis) { liste.appendChild(h('li.muted', bel.hinweis)); }
      if (bel.erfolge.length && kl) { kl.erfolgFrei(); }
      if (bel.levelUp) { U.toast('Level ' + bel.nachher.level + ' erreicht – ' + bel.rangNachher + '!'); if (kl) { kl.levelUp(); } B.konfetti(200); }
      self.spiel.kopf(true);
    }
    setTimeout(weiter, 350);
  };

  ZM.Drechselbank = Drechselbank;
})(typeof window !== 'undefined' ? window : globalThis);
