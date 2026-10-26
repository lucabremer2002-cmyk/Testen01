/*
 * Spielablauf: Karriere, Auftrag, Ruesten, Bearbeiten, Pruefen, sowie
 * Freie Werkstatt, Tabellenbuch und Einstellungen.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM;
  var DAT = ZM.daten, PH = ZM.physik, U = ZM.ui, h = U.h, zahl = U.zahl;
  var MIS = ZM.missionen;
  var B = ZM.belohnung;

  var STUFEN = { azubi: 'Azubi', geselle: 'Geselle', meister: 'Meister' };
  var OP_NAMEN = { bohren: 'Bohren', reiben: 'Reiben', gewinde: 'Gewindebohren', drehen: 'Drehen', fraesen: 'Fräsen' };

  function Spiel() {
    var self = this;
    this.stand = U.laden();
    B.profil(this.stand);
    B.lackAnwenden(this.stand);
    this.klang = new ZM.Klang();
    this.klang.an = this.stand.einstellungen.ton;
    this.klang.vol = this.stand.einstellungen.vol;
    this.werkzeuge = {};
    this.mission = null;
    this.ergebnisse = [];
    this.bb = null;

    U.$$('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { self.navigiere(b.getAttribute('data-nav')); });
    });
    U.$('#ton').addEventListener('click', function () {
      self.stand.einstellungen.ton = !self.stand.einstellungen.ton;
      self.klang.start();
      self.klang.setAn(self.stand.einstellungen.ton);
      self.tonAnzeige();
      U.sichern(self.stand);
    });
    // Audio darf erst nach einer Bedienhandlung starten
    var erst = function () {
      self.klang.start();
      root.removeEventListener('pointerdown', erst);
      root.removeEventListener('keydown', erst);
    };
    root.addEventListener('pointerdown', erst);
    root.addEventListener('keydown', erst);
    this.tonAnzeige();
    this.stufeAnzeige();
    this.startStatistik();
    this.kopf();
  }

  Spiel.prototype.kopf = function (puls) { B.kopfAktualisieren(this, puls); };

  // Freigeschaltete Auftraege (IDs) und der naechste offene Auftrag
  Spiel.prototype.freieIds = function () {
    var self = this;
    return MIS.liste.filter(function (m, i) { return self.freigeschaltet(i); }).map(function (m) { return m.id; });
  };
  Spiel.prototype.naechsterOffen = function () {
    var i;
    for (i = 0; i < MIS.liste.length; i++) {
      var fp = this.stand.fortschritt[MIS.liste[i].id];
      if (this.freigeschaltet(i) && !(fp && fp.bestanden)) { return MIS.liste[i]; }
    }
    return null;
  };
  Spiel.prototype.tages = function () {
    var t = B.tagesauftrag(this.stand, this.freieIds());
    U.sichern(this.stand);
    return t;
  };

  Spiel.prototype.tonAnzeige = function () {
    var b = U.$('#ton');
    b.textContent = this.stand.einstellungen.ton ? 'Ton an' : 'Ton aus';
    b.setAttribute('aria-pressed', this.stand.einstellungen.ton ? 'true' : 'false');
  };

  Spiel.prototype.stufeAnzeige = function () {
    U.$('#stufe-chip').textContent = STUFEN[this.stand.einstellungen.stufe];
  };

  Spiel.prototype.startStatistik = function () {
    var self = this, s = this.stand.statistik;
    var fertig = Object.keys(this.stand.fortschritt).filter(function (k) { return this.stand.fortschritt[k].bestanden; }, this).length;
    U.$('#stat-schild').textContent = 'Aufträge bestanden ' + fertig + ' / ' + MIS.liste.length + ' · Werkzeugbrüche ' + s.werkzeugBruch + ' · Unfälle ' + s.unfaelle;
    // Weiterspielen statt Karriere beginnen, sobald es Fortschritt gibt
    var naechst = this.naechsterOffen();
    var kn = U.leeren(U.$('#start-knoepfe'));
    if (fertig > 0 && naechst) {
      kn.appendChild(h('button.knopf.knopf--gelb.knopf--gross', { type: 'button', onclick: function () { self.missionStarten(naechst.id); } }, [h('small', 'Weiterspielen'), naechst.titel]));
    } else {
      kn.appendChild(h('button.knopf.knopf--gelb.knopf--gross', { type: 'button', onclick: function () { self.zeigeKarriere(); } }, [h('small', fertig ? 'Alle Aufträge bestanden' : 'Los geht’s'), fertig ? 'Sterne sammeln' : 'Karriere beginnen']));
    }
    kn.appendChild(h('button.knopf', { type: 'button', onclick: function () { self.zeigeWerkstatt(); } }, 'Freie Werkstatt'));
    var box = U.leeren(U.$('#start-spiel'));
    box.appendChild(this.tagesKarte());
    var p = B.profil(this.stand), li = B.levelInfo(p.xp);
    box.appendChild(h('button.spielerkarte', { type: 'button', onclick: function () { self.zeigeProfil(); } }, [
      h('span.spielerkarte__lvl', [h('small', 'Level'), String(li.level)]),
      h('span.spielerkarte__text', [h('b', B.rang(li.level)), h('span.xpbar.xpbar--gross', h('span', { style: 'width:' + Math.round(li.anteil * 100) + '%' })),
        h('small.muted', li.rest + ' / ' + li.bedarf + ' XP · ★ ' + B.sterneGesamt(this.stand) + ' / ' + MIS.liste.length * 3 + ' · ' + Object.keys(p.erfolge).length + ' / ' + B.ERFOLGE.length + ' Erfolge')])
    ]));
  };

  // Karte des Tagesauftrags (Start und Karriere)
  Spiel.prototype.tagesKarte = function () {
    var self = this, t = this.tages();
    if (!t) { return null; }
    var m = MIS.finde(t.id), mod = B.modVon(t.mod), p = B.profil(this.stand);
    return h('div.tageskarte' + (t.erledigt ? '.tageskarte--fertig' : ''), [
      h('div.tageskarte__kopf', [h('span.tageskarte__label', 'Tagesauftrag'), p.serie.tage > 0 ? h('span.hudchip.hudchip--serie', '🔥 ' + p.serie.tage + (p.serie.tage === 1 ? ' Tag' : ' Tage')) : null]),
      h('b.tageskarte__titel', m.titel),
      h('span.tageskarte__mod', mod.text),
      h('div.tageskarte__fuss', [
        h('span.tageskarte__lohn', t.erledigt ? '✓ Erledigt – morgen gibt es einen neuen' : '+' + B.TAGES_XP + ' XP · +' + B.TAGES_GELD + ' €'),
        t.erledigt ? null : h('button.knopf.knopf--klein.knopf--gelb', { type: 'button', onclick: function () { self.missionStarten(t.id); } }, 'Los')
      ])
    ]);
  };

  Spiel.prototype.laufendeBeenden = function () {
    if (this.bb && !this.bb.beendet) { this.bb.abbrechen(); }
    this.bb = null;
  };

  Spiel.prototype.navigiere = function (ziel) {
    this.laufendeBeenden();
    switch (ziel) {
      case 'start': this.startStatistik(); U.zeige('start'); break;
      case 'karriere': this.zeigeKarriere(); break;
      case 'werkstatt': this.zeigeWerkstatt(); break;
      case 'tabellenbuch': this.zeigeTabellenbuch(false); break;
      case 'einstellungen': this.zeigeEinstellungen(); break;
      case 'profil': this.zeigeProfil(); break;
    }
  };

  // ============================================================ Karriere
  Spiel.prototype.freigeschaltet = function (idx) {
    if (this.stand.einstellungen.alles || idx === 0) { return true; }
    // Schon bearbeitete Auftraege bleiben offen, auch wenn davor neue eingefuegt wurden
    if (this.stand.fortschritt[MIS.liste[idx].id]) { return true; }
    var vorher = MIS.liste[idx - 1];
    return !!(this.stand.fortschritt[vorher.id] && this.stand.fortschritt[vorher.id].bestanden);
  };

  function sternReihe(n, gross) {
    var r = h('span.sterne' + (gross ? '.sterne--gross' : ''), { 'aria-label': n + ' von 3 Sternen' }), i;
    for (i = 0; i < 3; i++) { r.appendChild(h('span.stern' + (i < n ? '.stern--an' : ''), '★')); }
    return r;
  }

  Spiel.prototype.zeigeKarriere = function () {
    var self = this, box = U.leeren(U.$('#missionen'));
    var naechst = this.naechsterOffen(), t = this.tages();
    var kz = U.$('#karriere-kopf');
    if (kz) {
      U.leeren(kz);
      kz.appendChild(h('span.hudchip.hudchip--stern', '★ ' + B.sterneGesamt(this.stand) + ' / ' + MIS.liste.length * 3));
      var tk = this.tagesKarte();
      if (tk) { kz.appendChild(tk); }
    }
    MIS.jahre.forEach(function (jahrName, j) {
      var karten = h('div.karten'), anz = 0, ok = 0, st = 0;
      MIS.liste.forEach(function (m, idx) {
        if (m.jahr !== j + 1) { return; }
        var mat = DAT.werkstoffe[m.mat];
        var fp = self.stand.fortschritt[m.id];
        var frei = self.freigeschaltet(idx);
        anz++;
        if (fp && fp.bestanden) { ok++; }
        st += fp && fp.sterne ? fp.sterne : 0;
        var verfahren = [];
        m.ops.forEach(function (op) { if (verfahren.indexOf(OP_NAMEN[op.typ]) < 0) { verfahren.push(OP_NAMEN[op.typ]); } });
        var klassen = 'button.mkarte' + (!frei ? '.mkarte--zu' : '') + (naechst && naechst.id === m.id ? '.mkarte--naechste' : '') + (fp && fp.sterne === 3 ? '.mkarte--gold' : '');
        var band = naechst && naechst.id === m.id ? h('span.mkarte__band', fp ? 'Weiter' : 'Neu') : (t && t.id === m.id && !t.erledigt ? h('span.mkarte__band.mkarte__band--tag', 'Tagesauftrag') : null);
        var karte = h(klassen, { type: 'button', disabled: !frei, onclick: function () { self.missionStarten(m.id); } }, [
          band,
          h('div.mkarte__kopf', [h('span.mkarte__nr', m.auftrag), fp ? sternReihe(fp.sterne || 0) : (band ? null : frei ? h('span.chip', 'offen') : h('span.chip.chip--zu', '🔒 gesperrt'))]),
          h('h3', m.titel),
          h('div.mkarte__meta', [h('span.iso.iso--' + mat.iso, mat.iso), h('span', mat.name), h('span', verfahren.join(', '))]),
          h('div.mkarte__fuss', [h('span.muted', m.kunde), fp ? h('span.note-gross', 'Note ' + fp.note + ' · ' + fp.punkte + ' P.') : h('span.lohn', U.geld(m.lohn))])
        ]);
        karten.appendChild(karte);
      });
      var anteil = anz ? ok / anz : 0;
      box.appendChild(h('section.jahr', [
        h('div.jahr__kopf', [h('h2', jahrName), h('span.jahr__stand', ok + ' / ' + anz + ' bestanden · ★ ' + st + ' / ' + anz * 3),
          h('span.xpbar.jahr__balken', h('span', { style: 'width:' + Math.round(anteil * 100) + '%' }))]),
        karten
      ]));
    });
    U.zeige('karriere');
    var ziel = box.querySelector('.mkarte--naechste');
    if (ziel && ziel.scrollIntoView && root.innerHeight && ziel.getBoundingClientRect().top > root.innerHeight * 0.8) { ziel.scrollIntoView({ block: 'center' }); }
  };

  Spiel.prototype.naechsteMission = function (id) {
    var i;
    for (i = 0; i < MIS.liste.length - 1; i++) { if (MIS.liste[i].id === id) { return MIS.liste[i + 1]; } }
    return null;
  };

  Spiel.prototype.missionStarten = function (id) {
    this.laufendeBeenden();
    var m = id ? MIS.finde(id) : this.letzteWerkstatt;
    if (!m) { this.zeigeKarriere(); return; }
    this.mission = m;
    this.werkzeuge = {};
    this.ergebnisse = [];
    this.opIdx = 0;
    this.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.rng = new PH.Zufall(this.seed);
    if (m.vorbereitet) {
      this.ergebnisse = m.vorbereitet.slice();
      this.opIdx = m.vorbereitet.length;
    }
    this.zeigeBriefing();
  };

  // ============================================================ Auftrag
  Spiel.prototype.zeigeBriefing = function () {
    var self = this, m = this.mission;
    var mat = DAT.werkstoffe[m.mat];
    var box = U.leeren(U.$('#briefing-text'));
    var werkstatt = m.id === 'WERKSTATT';
    box.appendChild(h('div.auftragskopf', [
      h('p.eyebrow', werkstatt ? 'Freie Werkstatt' : 'Auftrag ' + m.auftrag + ' · ' + MIS.jahre[m.jahr - 1]),
      h('h1', m.titel),
      h('p.muted', m.kunde)
    ]));
    if (m.text) { box.appendChild(h('p', m.text)); }
    var kz = h('dl.kennzahlen');
    function kenn(a, b) { kz.appendChild(h('div', [h('dt', a), h('dd', b)])); }
    kenn('Werkstoff', mat.name);
    if (!werkstatt) {
      kenn('Vorgabezeit', U.dauer(m.zeit));
      kenn('Werkzeugbudget', U.geld(m.budget));
    }
    box.appendChild(kz);
    var plan = h('ol.arbeitsplan');
    m.ops.forEach(function (op, i) {
      if (m.vorbereitet && i < m.vorbereitet.length) { return; }
      var fertig = i < self.opIdx;
      plan.appendChild(h('li', [h('b', String((i + 1) * 10)), h('span', [op.name + (fertig ? ' – erledigt' : ''), h('small', DAT.maschinen[op.maschine].name + (op.hinweis ? ' · ' + op.hinweis : ''))])]));
    });
    box.appendChild(h('div', [h('h2', { style: 'margin-bottom:8px' }, 'Arbeitsplan'), plan]));
    var stufe = this.stand.einstellungen.stufe;
    if (m.meister && m.meister.length) {
      var ms = h('div.meister', [h('span.meister__name', 'Meister Brandt')]);
      if (stufe === 'meister') {
        ms.appendChild(h('p', 'Du bist jetzt selbst Meister. Tipps gibt es keine mehr – das Tabellenbuch liegt in der Schublade.'));
      } else {
        m.meister.forEach(function (t) { ms.appendChild(h('p', t)); });
      }
      box.appendChild(ms);
    }
    var naechster = this.opIdx < m.ops.length ? this.opIdx : null;
    var fuss = h('div.fussleiste', { style: 'justify-content:flex-start' });
    if (naechster !== null) {
      fuss.appendChild(h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { self.ruesten(naechster); } },
        naechster === 0 || (m.vorbereitet && naechster === m.vorbereitet.length) ? 'Arbeitsplatz rüsten' : 'Weiter mit Arbeitsgang ' + (naechster + 1) * 10));
    }
    fuss.appendChild(h('button.knopf', { type: 'button', onclick: function () { if (werkstatt) { self.zeigeWerkstatt(); } else { self.zeigeKarriere(); } } }, werkstatt ? 'Zur Werkstatt' : 'Zur Auftragsliste'));
    box.appendChild(fuss);
    U.zeige('briefing');
    var cv = U.$('#zeichnung');
    try { ZM.zeichnung.zeichne(cv, m); } catch (e) { /* Zeichnung ist nur Zierde */ }
    // Nach dem Laden der Schriften erneut zeichnen, sonst steht die Ersatzschrift im Schriftfeld
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (U.ansicht() === 'briefing' && self.mission === m) { ZM.zeichnung.zeichne(cv, m); } });
    }
    if (!this.resizeZeichnung) {
      this.resizeZeichnung = function () { if (U.ansicht() === 'briefing' && self.mission) { ZM.zeichnung.zeichne(U.$('#zeichnung'), self.mission); } };
      root.addEventListener('resize', this.resizeZeichnung);
    }
  };

  Spiel.prototype.ruesten = function (opIdx) {
    var self = this;
    this.opIdx = opIdx;
    this.ruestung = new ZM.Ruesten(this, this.mission, opIdx, function (setup) { self.bearbeiten(opIdx, setup); });
  };

  // Werkzeug aus der Ausgabe: vorhandenes, heiles Werkzeug wird weiterverwendet
  Spiel.prototype.werkzeugHolen = function (def, neu) {
    var liste = this.werkzeuge[def.id] || (this.werkzeuge[def.id] = []);
    if (!neu) {
      var i;
      for (i = liste.length - 1; i >= 0; i--) {
        if (!liste[i].gebrochen && (!liste[i].ecken || liste[i].ecke <= liste[i].ecken)) { return liste[i]; }
      }
    }
    var w = new PH.Werkzeug(def, this.rng);
    liste.push(w);
    return w;
  };

  Spiel.prototype.bearbeiten = function (opIdx, setup) {
    var self = this, m = this.mission, op = m.ops[opIdx];
    var vor = [];
    if (op.vor !== undefined && op.vor !== null) {
      var er = this.ergebnisse[op.vor];
      vor = er && er.sim && er.sim.ergebnisse ? er.sim.ergebnisse : [];
    }
    var wkz = this.werkzeugHolen(setup.def, false);
    var wkz2 = setup.def2 ? (setup.def2.id === setup.def.id ? this.werkzeugHolen(setup.def2, true) : this.werkzeugHolen(setup.def2, false)) : null;
    U.zeige('bearbeiten');
    this.bb = new ZM.Bearbeitung(this, {
      mission: m, op: op, opIdx: opIdx, setup: setup, wkz: wkz, wkz2: wkz2, vor: vor, rng: this.rng,
      fertig: function (ergebnis) { self.opFertig(opIdx, ergebnis); }
    });
  };

  Spiel.prototype.opFertig = function (opIdx, er) {
    this.ergebnisse[opIdx] = er;
    this.bb = null;
    var m = this.mission;
    if (er.unfall) { this.auswerten(); return; }
    if (opIdx + 1 < m.ops.length) {
      this.opIdx = opIdx + 1;
      U.toast('Arbeitsgang ' + (opIdx + 1) * 10 + ' abgeschlossen. Weiter mit ' + m.ops[opIdx + 1].name + '.');
      this.ruesten(opIdx + 1);
      return;
    }
    this.auswerten();
  };

  Spiel.prototype.auswerten = function () {
    var m = this.mission;
    var aw = ZM.pruefung.bewerte(this, m, this.ergebnisse);
    var werkstatt = m.id === 'WERKSTATT';
    var st = this.stand.statistik;
    st.werkzeugBruch += aw.brueche;
    if (aw.unfall) { st.unfaelle += 1; }
    if (!werkstatt) {
      var alt = this.stand.fortschritt[m.id];
      var bestanden = aw.note.note <= 4;
      if (!alt || aw.punkte > alt.punkte) {
        this.stand.fortschritt[m.id] = { punkte: aw.punkte, note: aw.note.note, bestanden: bestanden || (alt && alt.bestanden) };
      } else if (bestanden) {
        alt.bestanden = true;
      }
      if (bestanden) { st.auftraege += 1; }
    }
    var bel = B.abschluss(this, m, aw, werkstatt, this.ergebnisse);
    U.sichern(this.stand);
    ZM.pruefung.zeige(this, m, aw, werkstatt, bel);
  };

  // ============================================================ Profil
  Spiel.prototype.zeigeProfil = function () {
    var self = this, box = U.leeren(U.$('#profil')), p = B.profil(this.stand), li = B.levelInfo(p.xp), st = this.stand.statistik;
    var bestanden = Object.keys(this.stand.fortschritt).filter(function (k) { return self.stand.fortschritt[k].bestanden; }).length;
    box.appendChild(h('section.profil__held', [
      h('div.profil__lvl', [h('small', 'Level'), h('b', String(li.level))]),
      h('div.profil__text', [
        h('p.eyebrow', 'Rang'),
        h('h1', B.rang(li.level)),
        h('span.xpbar.xpbar--gross', h('span', { style: 'width:' + Math.round(li.anteil * 100) + '%' })),
        h('p.muted', li.rest + ' / ' + li.bedarf + ' XP bis Level ' + (li.level + 1) + ' · gesamt ' + U.zahl(p.xp, 0) + ' XP')
      ]),
      h('dl.profil__zahlen', [
        h('div', [h('dt', 'Sterne'), h('dd', '★ ' + B.sterneGesamt(this.stand) + ' / ' + MIS.liste.length * 3)]),
        h('div', [h('dt', 'Kontostand'), h('dd', U.zahl(p.geld, 0) + ' €')]),
        h('div', [h('dt', 'Aufträge bestanden'), h('dd', bestanden + ' / ' + MIS.liste.length)]),
        h('div', [h('dt', 'Serie'), h('dd', '🔥 ' + (p.serie.tage || 0))]),
        h('div', [h('dt', 'Werkzeugbrüche'), h('dd', String(st.werkzeugBruch))]),
        h('div', [h('dt', 'Erfolge'), h('dd', Object.keys(p.erfolge).length + ' / ' + B.ERFOLGE.length)])
      ])
    ]));
    // Raenge
    var leiter = h('ol.rangleiter');
    B.RAENGE.forEach(function (r, i) {
      var naechsteSchwelle = i + 1 < B.RAENGE.length ? B.RAENGE[i + 1][0] : 999;
      var aktiv = li.level >= r[0] && li.level < naechsteSchwelle, erreicht = li.level >= r[0];
      leiter.appendChild(h('li' + (aktiv ? '.aktiv' : erreicht ? '.erreicht' : ''), [h('b', r[1]), h('small', 'ab Level ' + r[0])]));
    });
    box.appendChild(h('section.panel', [h('h2', 'Ränge'), leiter]));
    // Erfolge
    var raster = h('div.erfolge');
    B.ERFOLGE.forEach(function (e) {
      var hat = p.erfolge[e.id];
      raster.appendChild(h('div.erfolg' + (hat ? '.erfolg--frei' : ''), [h('span.erfolg__icon', hat ? e.icon : '🔒'), h('div', [h('b', e.titel), h('span', e.text), hat ? h('small', 'Freigeschaltet am ' + hat.split('-').reverse().join('.')) : null])]));
    });
    box.appendChild(h('section.panel', [h('h2', 'Erfolge ' + Object.keys(p.erfolge).length + ' / ' + B.ERFOLGE.length), raster]));
    // Lackierungen
    var lacke = h('div.lacke');
    B.LACKE.forEach(function (l) {
      var hat = !!p.lacke[l.id], aktiv = p.lack === l.id, gesperrt = li.level < l.level;
      var knopfText = aktiv ? 'Aktiv' : hat ? 'Lackieren' : gesperrt ? 'ab Level ' + l.level : l.preis + ' €';
      lacke.appendChild(h('div.lack' + (aktiv ? '.lack--aktiv' : ''), [
        h('span.lack__muster', { style: 'background:' + l.hex }),
        h('b', l.name),
        h('button.knopf.knopf--klein' + (!hat && !gesperrt && p.geld >= l.preis ? '.knopf--gelb' : ''), { type: 'button', disabled: aktiv || gesperrt, onclick: function () {
          var r = B.lackKaufen(self.stand, l.id);
          if (!r.ok) { U.toast(r.text); return; }
          U.sichern(self.stand);
          if (r.gekauft) {
            if (self.klang) { self.klang.muenze(); }
            B.freischalten(self, 'lack');
            U.toast(l.name + ' gekauft – Dreh- und Fräsmaschinen sind neu lackiert.');
          } else { U.toast('Maschinen in ' + l.name + '.'); }
          self.kopf(true);
          self.zeigeProfil();
        } }, knopfText)
      ]));
    });
    box.appendChild(h('section.panel', [h('h2', 'Lackierung der Maschinen'), h('p.muted', { style: 'margin-bottom:12px' }, 'Bezahlt wird mit den Prämien aus bestandenen Aufträgen. Die Farbe gilt für Dreh- und Fräsmaschinen.'), lacke]));
    U.zeige('profil');
  };

  // ============================================================ Freie Werkstatt
  Spiel.prototype.zeigeWerkstatt = function () {
    var self = this;
    var f = U.leeren(U.$('#werkstatt'));
    var c = this.werkstattWahl || (this.werkstattWahl = {
      verfahren: 'bohren', maschine: 'saeule', mat: 'S235', dicke: 12, durch: true, tiefe: 20, anzahl: 2, d: 8,
      vorD: 9.8, reibD: 10, gw: 'M8', kern: 6.8, D: 40, L: 80, spannL: 40, dZiel: 36, laenge: 50, planen: true, planZ: 2,
      Lb: 80, Bb: 40, Hb: 30, breite: 10, nTiefe: 5
    });
    function feld(titel, inhalt) { return h('div.feld', [h('span.feld__titel', titel), inhalt]); }
    function auswahl(key, opts, neu) {
      var s = h('select', { onchange: function (e) { c[key] = e.target.value; if (neu) { neu(); } self.zeigeWerkstatt(); } });
      opts.forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if (String(c[key]) === String(o[0])) { op.selected = true; } s.appendChild(op); });
      return s;
    }
    function nummer(key, schritt) {
      return h('input', { type: 'number', step: schritt || '0.1', value: String(c[key]), oninput: function (e) { var v = parseFloat(String(e.target.value).replace(',', '.')); if (!isNaN(v)) { c[key] = v; } } });
    }
    var maschinen = c.verfahren === 'drehen' ? [['drehKonv', DAT.maschinen.drehKonv.name], ['drehCNC', DAT.maschinen.drehCNC.name]] :
      c.verfahren === 'fraesen' ? [['fraesKonv', DAT.maschinen.fraesKonv.name], ['baz', DAT.maschinen.baz.name]] :
      [['saeule', DAT.maschinen.saeule.name], ['baz', DAT.maschinen.baz.name]];
    if (!maschinen.some(function (mm) { return mm[0] === c.maschine; })) { c.maschine = maschinen[0][0]; }
    var p1 = h('section.panel', [h('h2', 'Verfahren'),
      feld('Verfahren', auswahl('verfahren', Object.keys(OP_NAMEN).map(function (k) { return [k, OP_NAMEN[k]]; }))),
      feld('Maschine', auswahl('maschine', maschinen)),
      feld('Werkstoff', auswahl('mat', Object.keys(DAT.werkstoffe).map(function (k) { return [k, DAT.werkstoffe[k].name + ' – ' + DAT.werkstoffe[k].art]; })))
    ]);
    var p2 = h('section.panel', [h('h2', 'Werkstück')]);
    var v = c.verfahren;
    if (v === 'bohren' || v === 'reiben' || v === 'gewinde') {
      p2.appendChild(feld('Dicke (mm)', nummer('dicke', '1')));
      p2.appendChild(h('div.feld', h('div.wahl', h('label', [h('input', { type: 'checkbox', checked: c.durch, onchange: function (e) { c.durch = e.target.checked; self.zeigeWerkstatt(); } }), h('span', 'Durchgangsbohrung')]))));
      if (!c.durch) { p2.appendChild(feld(v === 'gewinde' ? 'Gewindetiefe (mm)' : 'Bohrtiefe (mm)', nummer('tiefe', '1'))); }
      p2.appendChild(feld('Anzahl Bohrungen', auswahl('anzahl', [[1, '1'], [2, '2'], [3, '3'], [4, '4']])));
      if (v === 'bohren') { p2.appendChild(feld('Soll-Ø (für das Protokoll)', nummer('d', '0.1'))); }
      if (v === 'reiben') {
        p2.appendChild(feld('Passung Ø … H7', auswahl('reibD', DAT.REIB_D.map(function (d) { return [d, 'Ø ' + d + ' H7']; }))));
        p2.appendChild(feld('Vorbohrung Ø (schon gebohrt)', nummer('vorD', '0.05')));
      }
      if (v === 'gewinde') {
        p2.appendChild(feld('Gewinde', auswahl('gw', Object.keys(DAT.gewinde).map(function (g) { return [g, g + ' × ' + DAT.fmtD(DAT.gewinde[g].P)]; }))));
        p2.appendChild(feld('Kernloch Ø (schon gebohrt)', nummer('kern', '0.05')));
      }
    } else if (v === 'drehen') {
      p2.appendChild(feld('Rohteil Ø (mm)', nummer('D', '1')));
      p2.appendChild(feld('Ausspannlänge (mm)', nummer('L', '1')));
      p2.appendChild(feld('Spannlänge (mm)', nummer('spannL', '1')));
      p2.appendChild(feld('Ziel-Ø (mm, = Rohteil-Ø: kein Absatz)', nummer('dZiel', '0.1')));
      p2.appendChild(feld('Drehlänge (mm)', nummer('laenge', '1')));
      p2.appendChild(h('div.feld', h('div.wahl', h('label', [h('input', { type: 'checkbox', checked: c.planen, onchange: function (e) { c.planen = e.target.checked; self.zeigeWerkstatt(); } }), h('span', 'Stirnseite plandrehen (Rohteil gesägt)')]))));
      if (c.planen) { p2.appendChild(feld('Planzugabe (mm)', nummer('planZ', '0.5'))); }
    } else {
      p2.appendChild(feld('Block Länge × Breite × Höhe (mm)', h('div.gruppe', [nummer('Lb', '1'), nummer('Bb', '1'), nummer('Hb', '1')])));
      p2.appendChild(feld('Nutbreite (mm)', nummer('breite', '1')));
      p2.appendChild(feld('Nuttiefe (mm)', nummer('nTiefe', '0.5')));
    }
    var p3 = h('section.panel', [h('h2', 'Los'), h('p.muted', 'Alle Werkzeuge aus dem Katalog sind freigegeben. Probier ruhig das Falsche aus.'),
      h('div.fussleiste', { style: 'justify-content:flex-start' }, h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { self.werkstattStarten(); } }, 'Zum Rüsten'))]);
    f.appendChild(p1);
    f.appendChild(p2);
    f.appendChild(p3);
    f.onsubmit = function (e) { e.preventDefault(); };
    U.zeige('werkstatt');
  };

  Spiel.prototype.werkstattStarten = function () {
    var c = this.werkstattWahl, v = c.verfahren;
    var m = { id: 'WERKSTATT', titel: 'Freie Werkstatt', kunde: 'Eigene Versuche', auftrag: 'WS-01', jahr: 1, mat: c.mat, zeit: 0, budget: 0, lohn: 0, werkzeuge: null, meister: null, text: '' };
    var anzahl = parseInt(c.anzahl, 10) || 1;
    var pos = [], i, B = Math.max(40, anzahl * 20 + 10), H = 40;
    for (i = 0; i < anzahl; i++) { pos.push([15 + i * 20, 20]); }
    var dicke = Math.max(1, c.dicke), durch = !!c.durch;
    var maschine = c.maschine;
    if (v === 'bohren') {
      m.teil = { art: 'platte', name: 'Versuchsplatte', B: B, H: H, T: dicke };
      m.ops = [{ typ: 'bohren', name: 'Bohren', maschine: maschine, d: c.d, tol: '2768-m', durch: durch, tiefe: durch ? null : c.tiefe, tiefeTol: 0.5, dicke: durch ? dicke : Math.max(dicke, c.tiefe + 10), pos: pos, lageTol: 0.3, ra: 12.5 }];
    } else if (v === 'reiben' || v === 'gewinde') {
      var tiefe = durch ? dicke : c.tiefe;
      var vorD = v === 'reiben' ? c.vorD : c.kern;
      var blockT = durch ? dicke : Math.max(dicke, tiefe + 12);
      var vorTiefe = durch ? blockT : tiefe + (v === 'gewinde' ? 6 : 3);
      var vorbohr = pos.map(function () {
        return { d: vorD + 0.03, durch: durch, tiefe: vorTiefe, spitze: vorTiefe + vorD * 0.3, lageX: 0, lageY: 0, gebohrt: true, notizen: [] };
      });
      m.teil = { art: 'platte', name: 'Versuchsplatte', B: B, H: H, T: blockT };
      var op0 = { typ: 'bohren', name: 'Vorbohrung (vorhanden)', maschine: maschine, d: vorD, durch: durch, tiefe: vorTiefe, dicke: blockT, pos: pos, zwischen: true };
      var op1 = v === 'reiben' ?
        { typ: 'reiben', name: 'Reiben Ø ' + c.reibD + ' H7', maschine: maschine, d: c.reibD, tol: 'H7', durch: durch, tiefe: durch ? null : tiefe, dicke: blockT, pos: pos, lageTol: 0.3, vor: 0, ra: 1.6 } :
        { typ: 'gewinde', name: 'Gewinde ' + c.gw, maschine: maschine, gw: c.gw, durch: durch, tiefe: durch ? null : tiefe, dicke: blockT, pos: pos, vor: 0 };
      m.ops = [op0, op1];
      m.vorbereitet = [{ sim: { ergebnisse: vorbohr }, zeit: 0, werkzeuge: [], wichtig: [], sicherheit: 0, unfall: null }];
    } else if (v === 'drehen') {
      m.teil = { art: 'welle', name: 'Versuchswelle' };
      var opD = { typ: 'drehen', name: 'Drehen', maschine: c.maschine, wst: { D: c.D, L: c.L, spannL: c.spannL, saege: !!c.planen }, laengeTol: 0.3, reitstockErlaubt: c.maschine === 'drehKonv' };
      var planZ = c.planen ? Math.max(0.2, Math.min(c.planZ, c.L / 3)) : 0;
      if (c.planen) { opD.plan = { gesamt: c.spannL + c.L - planZ, tol: 0.1, ra: 3.2, eben: 0.05 }; }
      if (c.dZiel < c.D - 0.1) {
        var lD = Math.min(c.laenge, c.L - planZ - 2);
        if (c.maschine === 'drehCNC') { opD.kontur = [{ d: c.dZiel, tol: '±0.05', bis: lD, ra: 3.2 }]; opD.fase = 0.5; }
        else { opD.d = c.dZiel; opD.tol = '±0.05'; opD.laenge = lD; opD.ra = 3.2; }
      }
      if (!opD.plan && !opD.d && !opD.kontur) { opD.d = c.D - 2; opD.tol = '±0.05'; opD.laenge = Math.min(c.laenge, c.L - 2); opD.ra = 3.2; }
      opD.name = c.maschine === 'drehCNC' ? 'CNC-Drehen' : (opD.plan && !opD.d ? 'Plandrehen' : opD.plan ? 'Plan- und Längsdrehen' : 'Längsdrehen');
      m.ops = [opD];
    } else {
      m.teil = { art: 'nutblock', name: 'Versuchsblock', L: c.Lb, B: c.Bb, H: c.Hb };
      m.ops = [{ typ: 'fraesen', name: 'Nut fräsen', maschine: maschine, wst: { L: c.Lb, B: c.Bb, H: c.Hb }, art: 'nut', breite: c.breite, breiteTol: '+0.1/+0', tiefe: c.nTiefe, tiefeTol: '±0.1', y: c.Bb / 2, lageTol: 0.1, ra: 3.2 }];
    }
    this.letzteWerkstatt = m;
    this.missionStarten(null);
  };

  // ============================================================ Tabellenbuch
  Spiel.prototype.zeigeTabellenbuch = function (ausRuesten) {
    var self = this;
    var box = U.leeren(U.$('#tabellenbuch'));
    var reiter = h('div.reiter', { role: 'tablist' });
    var inhalt = h('div');
    var seiten = [
      ['schnitt', 'Schnittwerte'], ['kienzle', 'Schnittkraft'], ['gewinde', 'Gewinde'], ['toleranz', 'ISO-Toleranzen'],
      ['formeln', 'Formeln'], ['cnc', 'CNC-Drehen'], ['ueberlast', 'Überlast erkennen'], ['werkstoffe', 'Werkstoffe'], ['sicherheit', 'Arbeitssicherheit']
    ];
    var aktiv = this.tbSeite || 'schnitt';
    seiten.forEach(function (s) {
      reiter.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': s[0] === aktiv ? 'true' : 'false', onclick: function () { self.tbSeite = s[0]; self.zeigeTabellenbuch(ausRuesten); } }, s[1]));
    });
    box.appendChild(reiter);
    if (ausRuesten) {
      box.appendChild(h('div', h('button.knopf', { type: 'button', onclick: function () { U.zeige('ruesten'); } }, 'Zurück zum Rüsten')));
    }
    box.appendChild(inhalt);
    var W = DAT.werkstoffe;
    function tabelle(kopf, zeilen) {
      var t = h('table');
      t.appendChild(h('thead', h('tr', kopf.map(function (k, i) { return h(i > 0 ? 'th.zahl' : 'th', k); }))));
      var tb = h('tbody');
      zeilen.forEach(function (z) { tb.appendChild(h('tr', z.map(function (x, i) { return h(i > 0 ? 'td.zahl' : 'td', x); }))); });
      t.appendChild(tb);
      return h('div.tabelle-wrap', t);
    }
    function matZelle(m) { return h('span', [h('span.iso.iso--' + m.iso, m.iso), ' ' + m.name]); }
    if (aktiv === 'schnitt') {
      inhalt.appendChild(h('p.muted', { style: 'margin-bottom:10px' }, 'Richtwerte für die Schnittgeschwindigkeit vc in m/min. HSS-E darf etwa 15 % schneller laufen als HSS, mit TiN-Schicht etwa 35 %. Unbeschichtetes VHM etwa 25 % langsamer als TiAlN-beschichtetes.'));
      inhalt.appendChild(tabelle(['Werkstoff', 'Bohren HSS', 'Bohren VHM', 'Reiben HSS', 'Gewinde HSS', 'Drehen HM', 'Fräsen HSS', 'Fräsen VHM'],
        Object.keys(W).map(function (k) { var m = W[k], v = m.vc; return [matZelle(m), v.bohrHSS, v.bohrVHM, v.reibHSS, v.gewHSS, v.drehHM, v.fraesHSS, v.fraesVHM]; })));
      inhalt.appendChild(h('h2', { style: 'margin:18px 0 8px' }, 'Bohrvorschub f in mm/U (HSS)'));
      inhalt.appendChild(tabelle(['Werkstoff', 'Ø 3', 'Ø 6', 'Ø 10', 'Ø 16'],
        Object.keys(W).map(function (k) { var m = W[k]; return [matZelle(m)].concat([3, 6, 10, 16].map(function (d) { return zahl(DAT.bohrVorschub(d, m, false), 3); })); })));
      inhalt.appendChild(h('p.muted', { style: 'margin-top:8px' }, 'VHM-Bohrer: etwa 30 % mehr Vorschub. Reiben: f ≈ 0,1 · √d mm/U. Fräsen: fz ≈ 0,004 · d (HSS) bzw. 0,006 · d (VHM) in Stahl.'));
    } else if (aktiv === 'kienzle') {
      inhalt.appendChild(h('div.tb-raster', [
        h('div.panel', [h('h2', 'Spezifische Schnittkraft'), h('p', h('span.formel', 'kc = kc1.1 · h^(−mc)')),
          h('p', 'h ist die Spanungsdicke in mm. Je dünner der Span, desto größer die spezifische Schnittkraft. Korrekturen für Spanwinkel, Schnittgeschwindigkeit, Verschleiß und Kühlschmierung kommen dazu.')]),
        h('div.panel', [h('h2', 'Spanungsdicke'), h('p', 'Drehen: h = f · sin κ'), h('p', 'Bohren: h = f/2 · sin(σ/2)'), h('p', 'Fräsen: hm = fz · (ae/d) · 360° / (π · φs)')])
      ]));
      inhalt.appendChild(h('div', { style: 'margin-top:16px' }, tabelle(['Werkstoff', 'kc1.1 (N/mm²)', 'mc', 'kc bei h = 0,05', 'kc bei h = 0,2', 'Rm (N/mm²)'],
        Object.keys(W).map(function (k) { var m = W[k]; return [matZelle(m), m.kc11, zahl(m.mc, 2), zahl(PH.kcKienzle(m, 0.05), 0), zahl(PH.kcKienzle(m, 0.2), 0), m.rm]; }))));
    } else if (aktiv === 'gewinde') {
      inhalt.appendChild(h('p.muted', { style: 'margin-bottom:10px' }, 'Metrisches ISO-Regelgewinde, Muttergewinde 6H. Kernloch ≈ d − P. Die Rutschkupplung stellt man auf etwa 60 % des Bruchmoments ein.'));
      inhalt.appendChild(tabelle(['Gewinde', 'Steigung P', 'Kernlochbohrer', 'D1 min', 'D1 max', 'Bruchmoment ca. (Nm)', 'Rutschkupplung (Nm)'],
        Object.keys(DAT.gewinde).map(function (g) { var x = DAT.gewinde[g], mb = 30 * Math.pow(x.D, 3) / 1000; return [g, DAT.fmtD(x.P), DAT.fmtD(x.kern), zahl(x.d1min, 3), zahl(x.d1max, 3), zahl(mb, 1), zahl(mb * 0.6, 1)]; })));
      inhalt.appendChild(h('div.tb-raster', { style: 'margin-top:16px' }, [
        h('div.panel', [h('h2', 'Form B'), h('p', 'Schälanschnitt über 4–5 Gänge. Schiebt die Späne in Vorschubrichtung vor sich her. Nur für Durchgangslöcher.')]),
        h('div.panel', [h('h2', 'Form C'), h('p', 'Spiralnut 35° rechts, Anschnitt 2–3 Gänge. Fördert die Späne nach oben. Für Grundlöcher. Kernloch tief genug bohren: Gewindetiefe + Anschnitt + Bohrerspitze.')])
      ]));
    } else if (aktiv === 'toleranz') {
      var nenn = h('input', { type: 'number', value: '25', step: '1' });
      var feldI = h('input', { type: 'text', value: 'k6' });
      var aus = h('p.formel', '–');
      var rechne = function () {
        var nm = parseFloat(String(nenn.value).replace(',', '.'));
        var t = DAT.toleranz(nm, String(feldI.value).trim());
        if (!t) { aus.textContent = 'Toleranzfeld nicht hinterlegt: Wellen f, g, h, js, k, m, n, p, Bohrungen F, G, H, JS, Grade IT5 bis IT14.'; return; }
        aus.textContent = isNaN(nm) ? '–' : DAT.fmtD(nm) + ' ' + feldI.value + ': ' + zahl(t.u * 1000, 0) + ' … ' + zahl(t.o * 1000, 0) + ' µm  →  ' + zahl(nm + t.u, 3) + ' … ' + zahl(nm + t.o, 3) + ' mm';
      };
      nenn.addEventListener('input', rechne);
      feldI.addEventListener('input', rechne);
      inhalt.appendChild(h('div.panel', [h('h2', 'Rechner ISO 286'), h('div.gruppe', [h('div.feld', [h('span.feld__titel', 'Nennmaß'), nenn]), h('div.feld', [h('span.feld__titel', 'Toleranzklasse (z. B. H7, g6, k6)'), feldI])]), aus]));
      rechne();
      var nm = [6, 8, 10, 20, 25, 36, 45, 55];
      inhalt.appendChild(h('div', { style: 'margin-top:16px' }, tabelle(['Nennmaß', 'H7 (µm)', 'h6', 'h7', 'h9', 'h11', 'k6'],
        nm.map(function (n) {
          return [DAT.fmtD(n)].concat(['H7', 'h6', 'h7', 'h9', 'h11', 'k6'].map(function (k) { var t = DAT.toleranz(n, k); return (t.o >= 0 ? '+' : '') + Math.round(t.o * 1000) + ' / ' + (t.u >= 0 ? '+' : '') + Math.round(t.u * 1000); }));
        }))));
      inhalt.appendChild(h('p.muted', { style: 'margin-top:8px' }, 'Allgemeintoleranzen ISO 2768-m: bis 6 mm ±0,1 · über 6 bis 30 ±0,2 · über 30 bis 120 ±0,3 · über 120 bis 400 ±0,5.'));
    } else if (aktiv === 'formeln') {
      var f = [
        ['Schnittgeschwindigkeit', 'vc = π · d · n / 1000', 'vc in m/min, d in mm, n in 1/min'],
        ['Drehzahl', 'n = vc · 1000 / (π · d)', 'An Stufengetrieben die nächstkleinere Stufe wählen.'],
        ['Vorschubgeschwindigkeit', 'vf = f · n = fz · z · n', 'vf in mm/min'],
        ['Bohrmoment', 'Mc = kc · f · d² / 8', 'Mc in Nmm; die Querschneide verursacht vor allem Vorschubkraft.'],
        ['Schnittleistung', 'Pc = Fc · vc / 60 000 = Mc · n / 9550', 'Pc in kW, Fc in N, Mc in Nm'],
        ['Drehen: Schnittkraft', 'Fc = ap · f · kc', 'ap = Schnitttiefe'],
        ['Rautiefe (Drehen)', 'Rz ≈ f² / (8 · rε) · 1000', 'Rz in µm; Ra ≈ Rz / 4'],
        ['Fräsen: Leistung', 'Pc = ap · ae · vf · kc / (60 · 10⁶)', 'Pc in kW'],
        ['Standzeit nach Taylor', 'vc · T^n = C', 'HSS n ≈ 0,125: doppelte vc → 1/256 der Standzeit. Hartmetall n ≈ 0,25–0,3.'],
        ['Hauptnutzungszeit', 'th = L · i / (f · n)', 'L = Weg inkl. An- und Überlauf, i = Anzahl Schnitte'],
        ['Wärmedehnung', 'Δl = α · l · ΔT', 'Stahl α ≈ 11,5 µm/(m·K); Aluminium 23 µm/(m·K)'],
        ['Knicklast (Euler)', 'Fk = π² · E · I / (β · l)²', 'Lange, dünne Bohrer knicken schon bei wenigen hundert Newton.'],
        ['Durchbiegung Kragträger', 'f = F · l³ / (3 · E · I)', 'Doppelte Ausspannlänge → achtfache Durchbiegung'],
        ['Plandrehen: Schnittgeschwindigkeit', 'vc = π · d · n / 1000 → 0 zur Mitte', 'Bei fester Drehzahl wird die Mitte rauer (Aufbauschneide). Die CNC hält vc mit G96 konstant, bis die Begrenzung G92 greift.'],
        ['Planvorschub (LZ 200)', 'f_plan = f_längs / 2', 'Der Planzug läuft über die Planspindel, er steht auf der Vorschubtabelle in einer eigenen Spalte.'],
        ['Spitzenhöhe', 'Butzen-Ø = 2 · |h|', 'Unter Mitte bleibt ein Butzen stehen, über Mitte drückt die Freifläche dagegen (α_wirk = α − asin(h/r)).'],
        ['G96 mit Begrenzung', 'r_g = 1000 · vc / (2π · S_max)', 'Unterhalb dieses Radius dreht die Spindel mit S_max, vc fällt wieder gegen null.'],
        ['Moment der Drehzahlstufe', 'M = 9550 · P · η / n', 'Kleinere Stufe = mehr Moment. Der Keilriemen rutscht ab etwa 1,7 · M.']
      ];
      inhalt.appendChild(h('div.tb-raster', f.map(function (x) { return h('div.panel', [h('h3', x[0]), h('p', { style: 'margin:8px 0' }, h('span.formel', x[1])), h('p.muted', x[2])]); })));
    } else if (aktiv === 'cnc') {
      inhalt.appendChild(h('p.muted', { style: 'margin-bottom:10px' }, 'Wegbedingungen und Zusatzfunktionen der CNC-Drehmaschine CT 250 (DIN 66025, PAL-nah). X wird als Durchmesser programmiert, Z ab dem Werkstücknullpunkt W auf der fertigen Stirnfläche (minus = Richtung Futter).'));
      inhalt.appendChild(tabelle(['Adresse', 'Bedeutung', 'Hinweis'], [
        ['G0', 'Eilgang', 'Nie im Eilgang ins Werkstück – Sicherheitsabstand Z2 bzw. X + 2 über Rohmaß'],
        ['G1', 'Gerade im Vorschub', 'braucht F'],
        ['G2 / G3', 'Kreis im / gegen den Uhrzeigersinn mit R', 'Blick mit Z nach rechts, X nach oben'],
        ['G4 F…', 'Verweilzeit in s', ''],
        ['G90 / G91', 'absolut / inkrementell (auch U, W)', ''],
        ['G92 S…', 'Drehzahlbegrenzung (PAL)', 'Fanuc G50 S…, Siemens LIMS=… – immer vor G96'],
        ['G94 / G95', 'Vorschub in mm/min / mm je Umdrehung', 'Drehen fast immer G95'],
        ['G96 S…', 'konstante Schnittgeschwindigkeit vc in m/min', 'n steigt zur Mitte bis zur Begrenzung'],
        ['G97 S…', 'konstante Drehzahl in 1/min', 'für Bohren auf Mitte und Gewinde'],
        ['T0101 / T1 D1', 'Werkzeug und Korrekturspeicher aufrufen', 'vorher den Wechselpunkt anfahren'],
        ['M3 / M4', 'Spindel rechts / links', 'CT 250: Revolver hinter der Mitte, Spanfläche oben → M4'],
        ['M5', 'Spindel aus', ''],
        ['M8 / M9', 'Kühlschmierstoff ein / aus', ''],
        ['M0 / M1', 'programmierter Halt', 'weiter mit NC-Start'],
        ['M30', 'Programmende', '']
      ]));
      inhalt.appendChild(h('div.tb-raster', { style: 'margin-top:16px' }, [
        h('div.panel', [h('h2', 'Programmaufbau'), h('pre.nc', 'N10 G18 G54 G90 G95\nN20 G0 X200 Z150   (Wechselpunkt)\nN30 T0101          (Schruppen)\nN40 G92 S3000\nN50 G96 S220 M4\nN60 M8\nN70 G0 X54 Z2.5\nN80 G0 Z0.1\nN90 G1 X-1.6 F0.3  (plan, über Mitte)\n…\nN300 G0 X200 Z150 M9\nN310 M30')]),
        h('div.panel', [h('h2', 'Einfahren'), h('ol.regeln', [
          'Nullpunkt prüfen: Wie weit steht die Rohteil-Stirnseite über Z0?',
          'Einzelsatz ein, Override klein, Hand am NC-Stopp.',
          'Plandrehen bis X −2 · rε, sonst bleibt ein Zapfen.',
          'Nach dem Schlichten messen und die Verschleißkorrektur eintragen (ΔX am Durchmesser).',
          'Auf Toleranzmitte programmieren, nicht auf Nennmaß.'
        ])])
      ]));
    } else if (aktiv === 'ueberlast') {
      inhalt.appendChild(h('p.muted', { style: 'margin-bottom:10px' }, 'Was eine überlastete Maschine zeigt, woher es kommt und was hilft. Funken entstehen beim Spanen nicht von selbst – sie sind fast immer schon ein Schaden.'));
      inhalt.appendChild(tabelle(['Anzeichen', 'Ursache', 'Abhilfe'], [
        ['Knattern, dicke dunkle Späne, Schneide bröckelt', 'Vorschub über dem Spanformbereich: Der Span staut sich und hämmert auf die Schneide', 'Vorschub senken oder Schruppplatte (PR) nehmen'],
        ['Keilriemen quietscht, Drehzahl bricht ein, Spindel bleibt stehen', 'Moment größer als die Drehzahlstufe liefern kann (M = Fc · r)', 'Kleinere Drehzahlstufe (mehr Moment) oder weniger Spantiefe. Nicht mit Werkzeug im Schnitt anlaufen.'],
        ['Rastkupplung ratscht, Schlitten kommt ruckweise, Zugspindel dreht weiter', 'Vorschubkraft über der Kupplungsgrenze, oft durch eine stumpfe Schneide', 'Vorschub/Spantiefe verringern, Schneide wechseln'],
        ['Tisch ruckt nach vorn oder hämmert (Fräsmaschine)', 'Gleichlauf bzw. wechselnde Vorschubkraft im Umkehrspiel der Tischspindel', 'Gegenlauf, mehr Zähne, kleinerer Zahnvorschub, Klemmung leicht anziehen'],
        ['Rattern: Pfeifen oder Schnarren, regelmäßige Marken', 'Regeneratives Rattern – zu viel Schnitttiefe für die Steifigkeit', 'Weniger ap, andere Drehzahl, Reitstock, kürzer ausspannen, Bettschlitten klemmen'],
        ['Glühende Späne', 'Hohe Schnittgeschwindigkeit, hohe Festigkeit, schlechte Wärmeleitung (Edelstahl, Titan)', 'vc senken, Kühlschmierstoff. Blaue Späne sind beim Hartmetall-Trockendrehen normal.'],
        ['Funken', 'Platte gebrochen und der Halter schneidet mit, Stumpf reibt, Schneide völlig verschlissen, Kollision', 'Sofort anhalten. Aluminium und Messing funken nie.'],
        ['Quietschen beim Plandrehen in der Mitte', 'Schneide über Mitte – die Freifläche drückt gegen den Butzen', 'Spitzenhöhe ausrichten'],
        ['CNC: Alarm, Vorschubhalt', 'Spindelmoment ausgeschöpft (i²t, Drehzahlabweichung) oder Achse blockiert', 'Schnittwerte reduzieren; die CNC ruckelt nicht, sie hält an']
      ]));
    } else if (aktiv === 'werkstoffe') {
      inhalt.appendChild(tabelle(['Werkstoff', 'Werkstoff-Nr.', 'Rm (N/mm²)', 'Härte HB', 'Spanform', 'Hinweis'],
        Object.keys(W).map(function (k) { var m = W[k]; return [matZelle(m), m.nr, m.rm, m.hb, { lang: 'lang', mittel: 'mittel', broeckel: 'kurz/bröckelig' }[m.span], m.text]; })));
      inhalt.appendChild(h('p.muted', { style: 'margin-top:8px' }, 'Farben nach ISO 513: P Stahl (blau), M rostfreier Stahl (gelb), K Gusseisen (rot), N Nichteisenmetalle (grün), S warmfeste Legierungen und Titan (orange).'));
    } else {
      inhalt.appendChild(h('div.panel', [h('h2', 'Betriebsanweisung Werkzeugmaschinen'), h('ol.regeln', [
        'Werkstücke immer festspannen. Ein mitgerissenes Blech schneidet wie ein Messer.',
        'An Maschinen mit drehender Spindel keine Handschuhe, keine Ringe, keine weite Kleidung. Lange Haare zusammenbinden.',
        'Schutzbrille tragen.',
        'Späne nie mit der Hand und nie bei laufender Spindel entfernen. Spänehaken oder Pinsel nehmen.',
        'Nur bei Stillstand messen.',
        'Futterschlüssel sofort abziehen.',
        'Brennende Titan- oder Magnesiumspäne nur mit Metallbrandpulver (Klasse D) löschen, niemals mit Wasser.',
        'Den Not-Aus kennen und erreichen können.'
      ])]));
    }
    U.zeige('tabellenbuch');
  };

  // ============================================================ Einstellungen
  Spiel.prototype.zeigeEinstellungen = function () {
    var self = this, e = this.stand.einstellungen;
    var f = U.leeren(U.$('#einstellungen'));
    var stufen = h('div.wahl');
    [['azubi', 'Azubi', 'Alle Messwerte, Bruchgrenzen, Meister warnt rechtzeitig'], ['geselle', 'Geselle', 'Drehzahl, Vorschub, Spindellast – keine Warnungen'], ['meister', 'Meister', 'Nur Digitalanzeige, Geräusch und Späne']].forEach(function (s) {
      stufen.appendChild(h('label', [h('input', { type: 'radio', name: 'stufe', value: s[0], checked: e.stufe === s[0], onchange: function () { e.stufe = s[0]; U.sichern(self.stand); self.stufeAnzeige(); } }), h('span', [s[1], h('small.muted', s[2])])]));
    });
    var vol = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(e.vol * 100)), oninput: function (ev) { e.vol = parseInt(ev.target.value, 10) / 100; self.klang.start(); self.klang.setVol(e.vol); U.sichern(self.stand); } });
    function check(key, text) {
      return h('label', [h('input', { type: 'checkbox', checked: !!e[key], onchange: function (ev) { e[key] = ev.target.checked; U.sichern(self.stand); if (key === 'ton') { self.klang.start(); self.klang.setAn(e.ton); self.tonAnzeige(); } } }), h('span', text)]);
    }
    var reset = h('div.gruppe');
    var resetKnopf = h('button.knopf.knopf--rot', { type: 'button', onclick: function () {
      U.leeren(reset);
      reset.appendChild(h('span', 'Wirklich alles löschen?'));
      reset.appendChild(h('button.knopf.knopf--rot', { type: 'button', onclick: function () {
        self.stand = U.laden();
        self.stand.fortschritt = {};
        self.stand.statistik = { werkzeugBruch: 0, bohrerBruch: 0, unfaelle: 0, auftraege: 0, loecher: 0 };
        self.stand.spieler = null;
        B.profil(self.stand);
        B.lackAnwenden(self.stand);
        U.sichern(self.stand);
        self.kopf();
        U.toast('Fortschritt gelöscht.');
        self.zeigeEinstellungen();
      } }, 'Ja, löschen'));
      reset.appendChild(h('button.knopf', { type: 'button', onclick: function () { self.zeigeEinstellungen(); } }, 'Abbrechen'));
    } }, 'Fortschritt zurücksetzen');
    reset.appendChild(resetKnopf);
    f.appendChild(h('section.panel', [h('h2', 'Realismusstufe'), stufen]));
    f.appendChild(h('section.panel', [h('h2', 'Ton und Ablauf'), h('div.wahl', [check('ton', 'Maschinengeräusche'), check('zeitraffer', 'Zeitraffer an der Maschine anbieten'), check('alles', 'Alle Aufträge freischalten')]),
      h('div.feld', { style: 'margin-top:12px' }, [h('span.feld__titel', 'Lautstärke'), vol])]));
    f.appendChild(h('section.panel', [h('h2', 'Speicherstand'), h('p.muted', { style: 'margin-bottom:10px' }, 'Der Fortschritt liegt nur in diesem Browser.'), reset]));
    f.onsubmit = function (ev) { ev.preventDefault(); };
    U.zeige('einstellungen');
  };

  function start() {
    ZM.spiel = new Spiel();
    var hot = root.claude && root.claude.hot;
    if (hot && hot.snapshot) {
      try { hot.snapshot(function () { return { ansicht: U.ansicht() }; }); } catch (e) { /* optional */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
