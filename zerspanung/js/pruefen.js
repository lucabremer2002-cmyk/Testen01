/*
 * Endpruefung durch die Qualitaetssicherung und Bewertung nach dem
 * IHK-Punkteschluessel. Gemessen wird mit den wahren Werten der Simulation
 * (Koordinatenmessmaschine, Bezugstemperatur 20 °C).
 */
(function (root) {
  'use strict';

  var ZM = root.ZM;
  var DAT = ZM.daten, U = ZM.ui, h = U.h, zahl = U.zahl;
  var MASCHINENSTUNDE = 85;

  function bewerteMass(ist, nenn, tol) {
    var lo = nenn + tol.u, hi = nenn + tol.o, b = hi - lo;
    if (ist >= lo - 1e-9 && ist <= hi + 1e-9) { return { ok: true, p: 10 }; }
    var ab = ist < lo ? lo - ist : ist - hi;
    if (ab <= b) { return { ok: false, p: 4, nach: true }; }
    return { ok: false, p: 0 };
  }

  function merkmal(liste, op, pos, name, soll, ist, r) {
    liste.push({ op: op, pos: pos, name: name, soll: soll, ist: ist, ok: r.ok, nach: !!r.nach, p: r.p, max: 10 });
  }

  function fmtTol(nenn, tol, st) {
    return DAT.fmtD(nenn) + ' (' + zahl(nenn + tol.u, st) + ' … ' + zahl(nenn + tol.o, st) + ')';
  }

  function bewerteBohren(op, er, liste, hinweise) {
    var sim = er.sim;
    var tol = op.d ? DAT.toleranz(op.d, op.tol) : null;
    var st = tol && tol.o - tol.u < 0.05 ? 3 : 2;
    op.pos.forEach(function (p, i) {
      var r = sim.ergebnisse[i];
      var pos = 'Pos. ' + (i + 1);
      if (!r || !r.gebohrt) {
        merkmal(liste, op.name, pos, 'Bohrung vorhanden', 'ja', 'fehlt', { ok: false, p: 0 });
        return;
      }
      if (r.bruchstueck || r.defekt) {
        merkmal(liste, op.name, pos, 'Bohrung', 'i. O.', r.defekt === 'steckt' ? 'Gewindebohrer sitzt fest' : 'Werkzeugrest steckt', { ok: false, p: 0 });
        return;
      }
      if (op.typ === 'gewinde') {
        var gw = DAT.gewinde[op.gw];
        var noetig = op.durch ? op.dicke - 0.5 : op.tiefe - 0.3;
        merkmal(liste, op.name, pos, 'Gewindelehrdorn Gutseite', 'geht ganz rein', r.gutLehre && r.nutzLaenge >= noetig ? 'geht' : (r.gutLehre ? 'nur ' + zahl(r.nutzLaenge, 1) + ' mm' : 'geht nicht'), { ok: r.gutLehre && r.nutzLaenge >= noetig, p: r.gutLehre && r.nutzLaenge >= noetig ? 10 : (r.gutLehre && r.nutzLaenge >= noetig * 0.7 ? 4 : 0) });
        merkmal(liste, op.name, pos, 'Gewindelehrdorn Ausschussseite', 'geht nicht rein', r.ausLehre ? 'geht rein' : 'geht nicht', { ok: !r.ausLehre, p: r.ausLehre ? 0 : 10 });
        merkmal(liste, op.name, pos, 'Kerndurchmesser D1 (6H)', zahl(gw.d1min, 3) + ' … ' + zahl(gw.d1max, 3), zahl(r.kern, 3), { ok: r.kernOk, p: r.kernOk ? 10 : 0 });
        if (op.lageTol) {
          merkmal(liste, op.name, pos, 'Lageabweichung', '≤ ' + zahl(op.lageTol, 2), zahl(r.lage, 3),
            r.lage <= op.lageTol ? { ok: true, p: 10 } : r.lage <= 2 * op.lageTol ? { ok: false, p: 4 } : { ok: false, p: 0 });
        }
        return;
      }
      if (op.durch && !r.durch) {
        merkmal(liste, op.name, pos, 'Durchgangsbohrung', 'durch', 'nicht durchgebohrt', { ok: false, p: 0 });
      }
      if (tol) {
        merkmal(liste, op.name, pos, 'Durchmesser', fmtTol(op.d, tol, st), zahl(r.d, st), bewerteMass(r.d, op.d, tol));
      }
      if (!op.durch && op.tiefe) {
        var tt = { o: op.tiefeTol || 0.5, u: -(op.tiefeTol || 0.5) };
        merkmal(liste, op.name, pos, 'Bohrtiefe', fmtTol(op.tiefe, tt, 2), zahl(r.tiefe, 2), bewerteMass(r.tiefe, op.tiefe, tt));
      }
      if (op.lageTol) {
        var lr = r.lage <= op.lageTol ? { ok: true, p: 10 } : r.lage <= 2 * op.lageTol ? { ok: false, p: 4, nach: false } : { ok: false, p: 0 };
        merkmal(liste, op.name, pos, 'Lageabweichung', '≤ ' + zahl(op.lageTol, 2), zahl(r.lage, 3), lr);
      }
      if (op.ra && op.ra < 12.5) {
        merkmal(liste, op.name, pos, 'Rauheit Ra', '≤ ' + zahl(op.ra, 1) + ' µm', zahl(r.ra, 2) + ' µm', r.ra <= op.ra ? { ok: true, p: 10 } : r.ra <= op.ra * 1.5 ? { ok: false, p: 4 } : { ok: false, p: 0 });
      }
      if (r.grat > 0.15) { hinweise.grat = (hinweise.grat || 0) + 1; }
    });
  }

  function bewerteDrehen(op, er, liste, hinweise) {
    var sim = er.sim;
    var tol = DAT.toleranz(op.d, op.tol);
    var st = tol.o - tol.u < 0.05 ? 3 : 2;
    var zA = sim.L - op.laenge + 1.5, zB = sim.L - 0.5;
    var b = sim.bereich(zA, zB);
    if (b.roh) {
      merkmal(liste, op.name, '', 'Bearbeitet auf ganzer Länge', 'ja', 'Rohstellen', { ok: false, p: 0 });
    }
    merkmal(liste, op.name, '', 'Ø kleinste Stelle', fmtTol(op.d, tol, st), zahl(b.min, st), bewerteMass(b.min, op.d, tol));
    merkmal(liste, op.name, '', 'Ø größte Stelle', fmtTol(op.d, tol, st), zahl(b.max, st), bewerteMass(b.max, op.d, tol));
    var grenze = (op.d + sim.D0) / 2;
    var len = sim.absatz(grenze);
    var lt = { o: op.laengeTol, u: -op.laengeTol };
    merkmal(liste, op.name, '', 'Absatzlänge', fmtTol(op.laenge, lt, 2), zahl(len, 2), bewerteMass(len, op.laenge, lt));
    merkmal(liste, op.name, '', 'Rauheit Mantelfläche', '≤ Ra ' + zahl(op.ra, 1) + ' µm', zahl(b.ra, 2) + ' µm', b.ra <= op.ra ? { ok: true, p: 10 } : b.ra <= op.ra * 1.5 ? { ok: false, p: 4 } : { ok: false, p: 0 });
    hinweise.drehen = { b: b, len: len, tol: tol, op: op, kegel: sim.D[sim.idx(zB)] - sim.D[sim.idx(zA)] };
    if (b.ratter > 6) { hinweise.ratter = true; }
    if (sim.backenSpur) { hinweise.backen = true; }
  }

  function bewerteFraesen(op, er, liste, hinweise) {
    var sim = er.sim;
    var tb = DAT.toleranz(op.breite, op.breiteTol);
    var tt = DAT.toleranz(op.tiefe, op.tiefeTol);
    var bMin = 1e9, bMax = -1e9, tMin = 1e9, tMax = -1e9, yMit = 0, n = 0, ra = 0, fehlt = false;
    [0.12, 0.5, 0.88].forEach(function (f) {
      var q = sim.querschnitt(sim.L * f, op.tiefe * 0.5);
      if (q.y0 === null) { fehlt = true; return; }
      var b = q.y1 - q.y0;
      bMin = Math.min(bMin, b);
      bMax = Math.max(bMax, b);
      tMin = Math.min(tMin, q.tiefe);
      tMax = Math.max(tMax, q.tiefe);
      yMit += (q.y0 + q.y1) / 2;
      n++;
      ra = Math.max(ra, q.raBoden);
    });
    if (fehlt || !n) {
      merkmal(liste, op.name, '', 'Nut auf ganzer Länge', 'ja', 'unvollständig', { ok: false, p: 0 });
      if (!n) { return; }
    }
    yMit /= n;
    merkmal(liste, op.name, '', 'Nutbreite min.', fmtTol(op.breite, tb, 2), zahl(bMin, 2), bewerteMass(bMin, op.breite, tb));
    merkmal(liste, op.name, '', 'Nutbreite max.', fmtTol(op.breite, tb, 2), zahl(bMax, 2), bewerteMass(bMax, op.breite, tb));
    merkmal(liste, op.name, '', 'Nuttiefe min.', fmtTol(op.tiefe, tt, 2), zahl(tMin, 2), bewerteMass(tMin, op.tiefe, tt));
    merkmal(liste, op.name, '', 'Nuttiefe max.', fmtTol(op.tiefe, tt, 2), zahl(tMax, 2), bewerteMass(tMax, op.tiefe, tt));
    var lt = { o: op.lageTol, u: -op.lageTol };
    merkmal(liste, op.name, '', 'Lage Nutmitte', fmtTol(op.y, lt, 2), zahl(yMit, 2), bewerteMass(yMit, op.y, lt));
    merkmal(liste, op.name, '', 'Rauheit Nutgrund', '≤ ' + zahl(op.ra, 1) + ' µm', zahl(ra, 2) + ' µm', ra <= op.ra ? { ok: true, p: 10 } : ra <= op.ra * 1.5 ? { ok: false, p: 4 } : { ok: false, p: 0 });
    hinweise.fraesen = { bMax: bMax, tMax: tMax, sim: sim };
  }

  // Werkzeugkosten nach Verschleiss: ein gebrochenes Werkzeug zaehlt voll
  function werkzeugKosten(w) {
    if (w.def.typ === 'platte') {
      var je = w.def.preis / w.def.ecken;
      return je * ((w.ecke - 1) + (w.gebrochen ? 1 : Math.min(1, w.VB / 0.3 + 0.05)));
    }
    return w.gebrochen ? w.def.preis : w.def.preis * Math.min(1, w.VB / 0.3 + 0.02);
  }

  function bewerte(spiel, mission, ergebnisse) {
    var merkmale = [], hinweise = {}, abzuege = [], i;
    var unfall = null, brueche = 0, sicherheit = 0, zeit = 0;
    var wichtig = [];
    ergebnisse.forEach(function (er, idx) {
      var op = mission.ops[idx];
      if (!er) {
        if (!op.zwischen) { merkmale.push({ op: op.name, pos: '', name: 'Arbeitsgang', soll: 'ausgeführt', ist: 'fehlt', ok: false, p: 0, max: 10 }); }
        return;
      }
      zeit += er.zeit;
      if (er.unfall) { unfall = er.unfall; }
      sicherheit += er.sicherheit;
      er.werkzeuge.forEach(function (w) { if (w.gebrochen) { brueche++; } });
      wichtig = wichtig.concat(er.wichtig.map(function (e) { e.op = op.name; return e; }));
      if (op.zwischen) { return; }
      if (op.typ === 'drehen') { bewerteDrehen(op, er, merkmale, hinweise); }
      else if (op.typ === 'fraesen') { bewerteFraesen(op, er, merkmale, hinweise); }
      else { bewerteBohren(op, er, merkmale, hinweise); }
    });
    if (hinweise.grat) { zeit += hinweise.grat * 15; }
    var sum = 0, max = 0;
    merkmale.forEach(function (m) { sum += m.p; max += m.max; });
    var basis = max ? sum / max * 100 : 0;
    if (brueche) { abzuege.push({ text: brueche + '× Werkzeugbruch', p: Math.min(24, brueche * 8) }); }
    if (sicherheit) { abzuege.push({ text: sicherheit + '× Verstoß gegen Arbeitssicherheit', p: Math.min(30, sicherheit * 15) }); }
    if (hinweise.backen) { abzuege.push({ text: 'Backenspuren am Werkstück', p: 10 }); }
    if (mission.zeit && zeit > mission.zeit) {
      abzuege.push({ text: 'Vorgabezeit um ' + Math.round((zeit / mission.zeit - 1) * 100) + ' % überschritten', p: Math.min(15, Math.round((zeit / mission.zeit - 1) * 50)) });
    }
    var kostenWkz = 0;
    Object.keys(spiel.werkzeuge).forEach(function (k) {
      spiel.werkzeuge[k].forEach(function (w) { kostenWkz += werkzeugKosten(w); });
    });
    if (mission.budget && kostenWkz > mission.budget) { abzuege.push({ text: 'Werkzeugbudget überschritten', p: 5 }); }
    var abz = 0;
    abzuege.forEach(function (a) { abz += a.p; });
    var punkte = Math.max(0, Math.round(basis - abz));
    if (unfall) { punkte = 0; }
    var note = ZM.missionen.note(punkte);
    var kostenZeit = zeit / 3600 * MASCHINENSTUNDE;
    return {
      merkmale: merkmale, abzuege: abzuege, basis: basis, punkte: punkte, note: note, unfall: unfall,
      zeit: zeit, kostenWkz: kostenWkz, kostenZeit: kostenZeit, brueche: brueche, sicherheit: sicherheit,
      wichtig: wichtig, hinweise: hinweise, ergebnisse: ergebnisse,
      praemie: note.note <= 4 ? mission.lohn * punkte / 100 : 0
    };
  }

  // Erklaerungen, die aus den Messwerten abgeleitet werden
  function analyse(mission, aw) {
    var t = [], hw = aw.hinweise, gesehen = {};
    if (aw.unfall) { t.push('Unfall: ' + (aw.unfall.text || aw.unfall.art) + ' Ein Unfall beendet in der Prüfung sofort die Bewertung.'); }
    aw.wichtig.forEach(function (e) {
      if (e.schwere === 'fehler' || e.schwere === 'unfall') {
        if (gesehen[e.text]) { return; }
        gesehen[e.text] = true;
        t.push(e.op + ': ' + e.text);
      }
    });
    if (hw.drehen) {
      var d = hw.drehen;
      if (d.kegel > 0.012) {
        t.push('Die Welle ist am freien Ende ' + zahl(d.kegel * 1000, 0) + ' µm dicker als am Absatz. Das ist die Durchbiegung unter der Passivkraft. Beim Schlichten eine kleine Schnitttiefe nehmen und lange Teile mit dem Reitstock abstützen.');
      }
      if (d.b.min < d.op.d + d.tol.u) {
        t.push('Untermaß: Bei der Endmessung (20 °C) ist der Durchmesser kleiner als beim Messen an der Maschine. Ein warmes Werkstück schrumpft beim Abkühlen. Rechne die Wärmedehnung ein oder lass es abkühlen.');
      }
      if (d.b.ra > d.op.ra) {
        t.push('Rauheit zu hoch. Theoretisch gilt Rz ≈ f² / (8 · rε) und Ra ≈ Rz / 4. Kleinerer Vorschub, größerer Eckenradius oder eine Wiper-Platte helfen. Aufbauschneiden bei zu kleiner vc und Rattern verschlechtern das zusätzlich.');
      }
      if (d.b.max > d.op.d + d.tol.o) {
        t.push('Übermaß: Der Durchmesser ist noch zu groß. Nach dem Messen die Differenz zustellen – am Durchmesser gemessen, am Skalenring oder an der Digitalanzeige als Durchmesser eingestellt.');
      }
      if (Math.abs(d.len - d.op.laenge) > d.op.laengeTol) {
        t.push('Die Absatzlänge stimmt nicht. Mit dem Längsanschlag fällt der Absatz jedes Mal an dieselbe Stelle.');
      }
    }
    if (hw.ratter) { t.push('Rattermarken auf der Oberfläche. Regeneratives Rattern beginnt, wenn die Schnitttiefe die Stabilitätsgrenze des schwingenden Systems überschreitet. Die Grenze hängt von der Steifigkeit (Ausspannlänge!), der Dämpfung und der Drehzahl ab.'); }
    if (hw.fraesen) {
      var f = hw.fraesen;
      var nutNio = aw.merkmale.filter(function (m) { return !m.ok && /^Nut|Lage Nut/.test(m.name); });
      if (nutNio.length) {
        t.push('Die Nut ist nicht maßhaltig. Ein Fräser schneidet mit Rundlauffehler breiter als sein Nennmaß, und unter Last drückt er sich seitlich weg. Für enge Nutbreiten mit kleinerem Fräser vorfräsen und die Flanken schlichten. Die Tiefe hängt an der Zustellung – und daran, dass der Fräser nicht aus der Spannzange wandert.');
      }
      var raNio = aw.merkmale.filter(function (m) { return !m.ok && m.name === 'Rauheit Nutgrund'; });
      if (raNio.length) {
        t.push('Der Nutgrund ist zu rau. Die Stirnschneiden hinterlassen Vorschubriefen: kleinerer Zahnvorschub fz, weniger Rundlauffehler und kein Rattern machen den Grund glatter.');
      }
      if (f.sim.st.maxAmp > 6) { t.push('Der Fräser hat gerattert. Weniger Zustellung oder eine andere Drehzahl. Die stabilen Drehzahlbereiche liegen zwischen den Stabilitätskeulen.'); }
      if (f.sim.auszug > 0.01) { t.push('Der Fräser hat sich aus der Spannzange gezogen – die Nut ist dadurch tiefer geworden. Bei hoher Axialkraft Weldon- oder Schrumpffutter verwenden.'); }
    }
    if (hw.grat) { t.push(hw.grat + ' Bohrung(en) mussten entgratet werden (+' + hw.grat * 15 + ' s). Weniger Vorschub beim Austritt gibt weniger Grat.'); }
    var nio = aw.merkmale.filter(function (m) { return !m.ok; });
    var erklaert = {};
    var texte = {
      'Bohrung vorhanden': 'Es fehlen Bohrungen. Jede Position auf der Zeichnung muss bearbeitet sein.',
      'Durchgangsbohrung': 'Die Bohrung ist nicht ganz durch. Bei 118° Spitzenwinkel muss die Spitze noch etwa 0,3 × d austreten, bis der volle Durchmesser durch ist.',
      'Durchmesser': 'Durchmesser außer Toleranz. Spiralbohrer bohren immer etwas größer: Rundlauf, verschlissene oder ungleich lange Schneiden, Spänestau und Aufbauschneide vergrößern das Übermaß. Für Passungen wird gerieben.',
      'Bohrtiefe': 'Bohrtiefe falsch. Gemessen wird bis zum Ende des zylindrischen Teils, die Spitze kommt dazu. Mit dem Tiefenanschlag wird jede Bohrung gleich tief.',
      'Lageabweichung': 'Lage außer Toleranz. Anreißen und Körnen schafft etwa ±0,1 bis 0,2 mm. Für enge Lagetoleranzen den Kreuztisch mit Messuhr nehmen und mit dem NC-Anbohrer zentrieren, damit der Bohrer nicht verläuft.',
      'Rauheit Ra': 'Die Oberfläche ist zu rau. Beim Reiben helfen die richtige Reibzugabe, kleine Schnittgeschwindigkeit, gleichmäßiger Vorschub und Schneidöl.',
      'Gewindelehrdorn Gutseite': 'Die Gutseite der Gewindelehre geht nicht ganz rein: Das Gewinde ist zu kurz oder beschädigt. Beim Durchgangsgewinde muss der Anschnitt komplett durch.',
      'Gewindelehrdorn Ausschussseite': 'Die Ausschussseite geht rein: Die Flanken sind ausgerissen. Gewindeschneiden immer mit Schneidöl.',
      'Kerndurchmesser D1 (6H)': 'Der Kerndurchmesser liegt nicht in 6H. Das Kernloch muss etwa d − P sein, für M8 also 6,8 mm.',
      'Bohrung': 'In einer Bohrung steckt ein abgebrochenes Werkzeug. Das Teil ist Ausschuss oder muss erodiert werden.'
    };
    nio.forEach(function (m) {
      var key = m.name;
      if (/^Ø|Absatz|Nut|Lage Nut|Rauheit Nut|Rauheit Mantel|Bearbeitet/.test(key)) { return; }
      if (erklaert[key] || !texte[key]) { return; }
      erklaert[key] = true;
      t.push(texte[key]);
    });
    if (!t.length && !nio.length) { t.push('Alle Merkmale in Toleranz. Sauber gearbeitet.'); }
    if (!t.length && nio.length) { t.push('Nicht alle Merkmale liegen in der Toleranz. Die Messwerte stehen in der Tabelle.'); }
    return t;
  }

  function zeige(spiel, mission, aw, werkstatt) {
    var box = U.leeren(U.$('#pruefen'));
    var note = aw.note;
    var kopf = h('div.pruef__kopf', [
      h('div', [
        h('p.eyebrow', werkstatt ? 'Freie Werkstatt' : mission.auftrag + ' · ' + mission.kunde),
        h('h1', werkstatt ? 'Messprotokoll' : mission.titel),
        h('p.muted', { style: 'margin-top:6px' }, werkstatt ? 'Werte der Koordinatenmessmaschine bei 20 °C.' :
          (aw.unfall ? 'Die Prüfung wurde wegen eines Unfalls abgebrochen.' : (note.note <= 4 ? 'Bestanden.' : 'Nicht bestanden.')) + ' ' + aw.merkmale.filter(function (m) { return m.ok; }).length + ' von ' + aw.merkmale.length + ' Merkmalen in Toleranz.')
      ]),
      werkstatt ? null : h('div.notenstempel.note-' + note.note, [h('div', [h('b', String(note.note)), h('span', note.text), h('small', aw.punkte + ' Punkte')])])
    ]);
    box.appendChild(kopf);

    var tab = h('table');
    tab.appendChild(h('thead', h('tr', [h('th', 'Arbeitsgang'), h('th', 'Merkmal'), h('th.zahl', 'Soll'), h('th.zahl', 'Ist'), h('th', 'Ergebnis')])));
    var tb = h('tbody');
    aw.merkmale.forEach(function (m) {
      tb.appendChild(h('tr', [
        h('td', [m.op, m.pos ? h('small.muted', ' ' + m.pos) : null]),
        h('td', m.name),
        h('td.zahl', m.soll),
        h('td.zahl', m.ist),
        h('td', h('span.chip.' + (m.ok ? 'chip--ok' : m.p > 0 ? 'chip--warn' : 'chip--nio'), m.ok ? 'i. O.' : m.p > 0 ? 'Nacharbeit' : 'n. i. O.'))
      ]));
    });
    if (!aw.merkmale.length) { tb.appendChild(h('tr', h('td', { colspan: '5' }, 'Keine prüfbaren Merkmale.'))); }
    tab.appendChild(tb);

    var rechts = h('div.analyse.panel');
    rechts.appendChild(h('h2', 'Auswertung'));
    function posten(a, b) { rechts.appendChild(h('div.posten', [h('span', a), h('span', b)])); }
    posten('Bearbeitungszeit', U.dauer(aw.zeit) + (mission.zeit ? ' / Vorgabe ' + U.dauer(mission.zeit) : ''));
    posten('Werkzeugkosten', U.geld(aw.kostenWkz) + (mission.budget ? ' / Budget ' + U.geld(mission.budget) : ''));
    posten('Maschinenstunden (' + MASCHINENSTUNDE + ' €/h)', U.geld(aw.kostenZeit));
    if (!werkstatt) {
      posten('Merkmale', zahl(aw.basis, 0) + ' %');
      aw.abzuege.forEach(function (a) { posten(a.text, '−' + a.p); });
      posten('Prämie', U.geld(aw.praemie));
    }
    rechts.appendChild(h('h3', { style: 'margin-top:14px' }, 'Der Meister sagt'));
    analyse(mission, aw).forEach(function (s) { rechts.appendChild(h('p', s)); });

    box.appendChild(h('div.pruef__raster', [h('div.tabelle-wrap', tab), rechts]));
    var fuss = h('div.fussleiste');
    fuss.appendChild(h('button.knopf', { type: 'button', onclick: function () { spiel.missionStarten(mission.id === 'WERKSTATT' ? null : mission.id, true); } }, 'Nochmal'));
    if (!werkstatt) {
      var naechste = spiel.naechsteMission(mission.id);
      if (naechste && note.note <= 4) {
        fuss.appendChild(h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { spiel.missionStarten(naechste.id); } }, 'Nächster Auftrag: ' + naechste.titel));
      }
      fuss.appendChild(h('button.knopf', { type: 'button', onclick: function () { spiel.zeigeKarriere(); } }, 'Zur Karriere'));
    } else {
      fuss.appendChild(h('button.knopf.knopf--gelb', { type: 'button', onclick: function () { spiel.zeigeWerkstatt(); } }, 'Zur Werkstatt'));
    }
    box.appendChild(fuss);
    U.zeige('pruefen');
  }

  ZM.pruefung = { bewerte: bewerte, zeige: zeige, werkzeugKosten: werkzeugKosten };
})(typeof window !== 'undefined' ? window : globalThis);
