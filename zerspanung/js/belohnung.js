/*
 * Spielebene ueber der Simulation: Erfahrung und Rang, Sterne je Auftrag,
 * Erfolge, Tagesauftrag mit Serie, Lackierungen fuer die Maschinen und die
 * Schicht-Wertung an der Maschine (Combo fuer sauberes, sicheres Arbeiten).
 *
 * Belohnt wird nur, was auch in der Werkstatt gut ist: Mass halten, nichts
 * zerbrechen, im richtigen Lastbereich zerspanen, sicher arbeiten. Fehler
 * kosten die Combo, aber nie bereits verdiente Punkte.
 */
(function (root) {
  'use strict';

  var ZM = root.ZM = root.ZM || {};
  var hatDom = typeof document !== 'undefined';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function U() { return ZM.ui; }
  function zahlAus(s) { var v = parseFloat(String(s).replace(/[^\d,.\-]/g, '').replace(',', '.')); return isNaN(v) ? null : v; }

  // ============================================================ Rang und Erfahrung
  // XP von Level l nach l + 1; die Karriere einmal sauber durch reicht etwa fuer Level 14
  function bedarf(level) { return 100 + 60 * (level - 1); }

  function levelInfo(xp) {
    var l = 1, rest = Math.max(0, xp || 0);
    while (rest >= bedarf(l) && l < 99) { rest -= bedarf(l); l++; }
    return { level: l, rest: rest, bedarf: bedarf(l), anteil: rest / bedarf(l) };
  }

  var RAENGE = [[1, 'Neuling'], [2, 'Lehrling'], [4, 'Späneprofi'], [6, 'Maßhalter'], [8, 'Prüfling'], [10, 'Geselle'],
    [13, 'Facharbeiter'], [16, 'Einrichter'], [19, 'Vorarbeiter'], [22, 'Meister'], [26, 'Spanwerk-Legende']];
  function rang(level) {
    var r = RAENGE[0][1], i;
    for (i = 0; i < RAENGE.length; i++) { if (level >= RAENGE[i][0]) { r = RAENGE[i][1]; } }
    return r;
  }

  // ============================================================ Speicherstand
  function profil(stand) {
    var p = stand.spieler || (stand.spieler = {});
    if (typeof p.xp !== 'number') { p.xp = 0; }
    if (typeof p.geld !== 'number') { p.geld = 0; }
    p.erfolge = p.erfolge || {};
    p.zaehler = p.zaehler || {};
    p.lacke = p.lacke || { werkstattgruen: true };
    p.lack = p.lack || 'werkstattgruen';
    p.serie = p.serie || { tage: 0, letzter: null };
    p.rekorde = p.rekorde || {};
    p.gesehen = p.gesehen || {};
    if (!p.v) {
      // Spielstand von vor der Spielebene: Sterne aus der Note, Erfahrung fuer bestandene Auftraege
      Object.keys(stand.fortschritt || {}).forEach(function (id) {
        var fp = stand.fortschritt[id];
        if (!fp || !fp.bestanden) { return; }
        if (fp.sterne === undefined) { fp.sterne = fp.note <= 2 ? 2 : 1; }
        if (!p.zaehler['bestanden_' + id]) {
          p.zaehler['bestanden_' + id] = true;
          p.xp += 100 + 80 + ({ 1: 120, 2: 70, 3: 35, 4: 10 }[fp.note] || 0) + 60 * fp.sterne;
        }
        if (!p.erfolge.erster) { p.erfolge.erster = datumKey(); }
        if (fp.note === 1 && !p.erfolge.einser) { p.erfolge.einser = datumKey(); }
      });
      p.v = 1;
    }
    return p;
  }

  // Serie zaehlt nur, solange der letzte erledigte Tagesauftrag von heute oder gestern ist
  function serieAktiv(p) {
    var heute = datumKey();
    return (p.serie.tage || 0) > 0 && (p.serie.letzter === heute || p.serie.letzter === vortag(heute));
  }

  // ============================================================ Sterne
  // 1 Stern: bestanden; 2: Note 2 oder besser; 3: Note 1 ohne Werkzeugbruch in der Vorgabezeit
  function sterne(aw, mission) {
    if (!aw || aw.unfall || !aw.note || aw.note.note > 4) { return 0; }
    if (aw.note.note === 1 && !aw.brueche && (!mission || !mission.zeit || aw.zeit <= mission.zeit)) { return 3; }
    return aw.note.note <= 2 ? 2 : 1;
  }

  function sterneGesamt(stand) {
    var s = 0;
    Object.keys(stand.fortschritt || {}).forEach(function (k) { s += stand.fortschritt[k].sterne || 0; });
    return s;
  }

  // ============================================================ Tagesauftrag
  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  function datumKey(d) { d = d || new Date(); return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()); }
  function vortag(key) {
    var t = key.split('-'), d = new Date(+t[0], +t[1] - 1, +t[2]);
    d.setDate(d.getDate() - 1);
    return datumKey(d);
  }
  function hash(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619) >>> 0; }
    return h >>> 0;
  }

  var MODS = [
    { id: 'note1', text: 'Note 1 holen', pruef: function (aw) { return aw.note.note === 1; } },
    { id: 'zeit', text: 'Bestehen in höchstens 70 % der Vorgabezeit', pruef: function (aw, m) { return aw.note.note <= 4 && !!m.zeit && aw.zeit <= 0.7 * m.zeit; } },
    { id: 'heil', text: 'Note 2 oder besser, ohne Werkzeugbruch', pruef: function (aw) { return aw.note.note <= 2 && !aw.brueche; } },
    { id: 'spar', text: 'Bestehen mit höchstens der Hälfte des Werkzeugbudgets', pruef: function (aw, m) { return aw.note.note <= 4 && !!m.budget && aw.kostenWkz <= 0.5 * m.budget; } },
    { id: 'drei', text: 'Drei Sterne holen', pruef: function (aw, m) { return sterne(aw, m) === 3; } },
    { id: 'flow', text: 'Bestehen und dabei Combo ×4 erreichen', pruef: function (aw, m, x) { return aw.note.note <= 4 && x.kette >= 3; } }
  ];
  var TAGES_XP = 200, TAGES_GELD = 100;

  function modVon(id) { var i; for (i = 0; i < MODS.length; i++) { if (MODS[i].id === id) { return MODS[i]; } } return MODS[0]; }

  // frei: Liste freigeschalteter Auftrags-IDs; der Tagesauftrag bleibt den ganzen Tag gleich
  function tagesauftrag(stand, frei, key) {
    var p = profil(stand);
    key = key || datumKey();
    if (p.tages && p.tages.datum === key) { return p.tages; }
    if (!frei.length) { return null; }
    var h = hash('spanwerk' + key);
    p.tages = { datum: key, id: frei[h % frei.length], mod: MODS[(h >>> 8) % MODS.length].id, erledigt: false };
    return p.tages;
  }

  // ============================================================ Lackierungen
  var LACKE = [
    { id: 'werkstattgruen', name: 'Werkstattgrün', hex: '#5f7560', preis: 0, level: 1 },
    { id: 'taubenblau', name: 'Taubenblau', hex: '#4f6a86', preis: 250, level: 1 },
    { id: 'lichtgrau', name: 'Lichtgrau', hex: '#8a9296', preis: 400, level: 3 },
    { id: 'signalorange', name: 'Signalorange', hex: '#c0631f', preis: 700, level: 5 },
    { id: 'anthrazit', name: 'Anthrazit', hex: '#3b4045', preis: 900, level: 8 },
    { id: 'rennrot', name: 'Rennrot', hex: '#a3262a', preis: 1400, level: 12 },
    { id: 'meistergold', name: 'Meistergold', hex: '#a8842c', preis: 2500, level: 20 }
  ];
  function lackVon(id) { var i; for (i = 0; i < LACKE.length; i++) { if (LACKE[i].id === id) { return LACKE[i]; } } return LACKE[0]; }
  function lackAnwenden(stand) {
    var p = profil(stand);
    ZM.optik = ZM.optik || {};
    ZM.optik.lack = lackVon(p.lack).hex;
  }
  function lackKaufen(stand, id) {
    var p = profil(stand), l = lackVon(id), lv = levelInfo(p.xp).level;
    if (p.lacke[id]) { p.lack = id; lackAnwenden(stand); return { ok: true, gewechselt: true }; }
    if (lv < l.level) { return { ok: false, text: 'Erst ab Level ' + l.level + '.' }; }
    if (p.geld < l.preis) { return { ok: false, text: 'Dafür fehlen noch ' + U().geld(l.preis - p.geld) + '.' }; }
    p.geld -= l.preis;
    p.lacke[id] = true;
    p.lack = id;
    lackAnwenden(stand);
    return { ok: true, gekauft: true };
  }

  // ============================================================ Erfolge
  function cncAuftrag(m) {
    return (m.ops || []).some(function (op) { var ma = ZM.daten && ZM.daten.maschinen[op.maschine]; return !!(ma && ma.cnc); });
  }
  function merkmalMit(aw, f) { return (aw.merkmale || []).some(f); }

  // pruef(x): x = { aw, mission, bestanden, p, stand, sterneGesamt, sterneMax, level, kette }; ohne pruef: wird live vergeben
  var ERFOLGE = [
    { id: 'erster', icon: '🔩', titel: 'Erster Span', text: 'Den ersten Auftrag bestanden.', pruef: function (x) { return x.bestanden; } },
    { id: 'einser', icon: '🥇', titel: 'Einser-Kandidat', text: 'Zum ersten Mal Note 1.', pruef: function (x) { return !x.werkstatt && x.aw.note.note === 1; } },
    { id: 'dreistern', icon: '⭐', titel: 'Volle Punktzahl', text: 'Drei Sterne in einem Auftrag.', pruef: function (x) { return x.neueSterne === 3; } },
    { id: 'sterne20', icon: '🌟', titel: 'Sternensammler', text: '20 Sterne in der Karriere.', pruef: function (x) { return x.sterneGesamt >= 20; } },
    { id: 'sternealle', icon: '🌌', titel: 'Sternenhimmel', text: 'Alle Sterne der Karriere.', pruef: function (x) { return x.sterneGesamt >= x.sterneMax; } },
    { id: 'flow', icon: '🔥', titel: 'Im Flow', text: 'Combo ×5 an der Maschine.' },
    { id: 'schnell', icon: '⏱️', titel: 'Schneller als die Uhr', text: 'Bestanden in der halben Vorgabezeit.', pruef: function (x) { return x.bestanden && !!x.mission.zeit && x.aw.zeit <= 0.5 * x.mission.zeit; } },
    { id: 'spiegel', icon: '✨', titel: 'Spiegelglanz', text: 'Eine Fläche mit Ra 0,4 µm oder besser.', pruef: function (x) { return !x.werkstatt && merkmalMit(x.aw, function (m) { return m.ok && /Rauheit/.test(m.name) && zahlAus(m.ist) !== null && zahlAus(m.ist) <= 0.4; }); } },
    { id: 'mitte', icon: '🎯', titel: 'Toleranzmitte', text: 'Ein Passmaß auf ein Zehntel der Toleranz in der Mitte getroffen.', pruef: function (x) { return !x.werkstatt && merkmalMit(x.aw, function (m) { return m.ok && m.rel !== undefined && m.rel <= 0.1 && m.band <= 0.06; }); } },
    { id: 'feinfuehl', icon: '🪶', titel: 'Feingefühl', text: 'Fünf Aufträge in Folge ohne Werkzeugbruch.', pruef: function (x) { return (x.p.zaehler.ohneBruch || 0) >= 5; } },
    { id: 'sicher', icon: '🦺', titel: 'Sicherheit zuerst', text: 'Zehn Aufträge in Folge ohne Sicherheitsverstoß.', pruef: function (x) { return (x.p.zaehler.sicher || 0) >= 10; } },
    { id: 'cnc', icon: '💾', titel: 'Programmierer', text: 'Einen CNC-Auftrag bestanden.', pruef: function (x) { return x.bestanden && cncAuftrag(x.mission); } },
    { id: 'plan', icon: '📏', titel: 'Plan wie ein Spiegel', text: 'Ebenheit 0,01 mm oder besser.', pruef: function (x) { return !x.werkstatt && merkmalMit(x.aw, function (m) { return m.ok && m.name === 'Ebenheit' && zahlAus(m.ist) !== null && zahlAus(m.ist) <= 0.01; }); } },
    { id: 'geselle', icon: '📜', titel: 'Gesellenbrief', text: 'Die Gesellenprüfung bestanden.', pruef: function (x) { return x.bestanden && x.mission.id === 'M15'; } },
    { id: 'tages', icon: '📅', titel: 'Tagwerk', text: 'Einen Tagesauftrag erledigt.', pruef: function (x) { return !!x.tagesErledigt; } },
    { id: 'serie3', icon: '📆', titel: 'Dranbleiber', text: 'An drei Tagen in Folge den Tagesauftrag erledigt.', pruef: function (x) { return (x.p.serie.tage || 0) >= 3; } },
    { id: 'spar', icon: '🦊', titel: 'Sparfuchs', text: 'Bestanden mit weniger als einem Viertel des Werkzeugbudgets.', pruef: function (x) { return x.bestanden && !!x.mission.budget && x.aw.kostenWkz < 0.25 * x.mission.budget; } },
    { id: 'bastler', icon: '🧪', titel: 'Bastler', text: 'Zehn Versuche in der Freien Werkstatt.', pruef: function (x) { return (x.p.zaehler.werkstatt || 0) >= 10; } },
    { id: 'lehrgeld', icon: '💥', titel: 'Teures Lehrgeld', text: 'Das erste Werkzeug zerbrochen. Passiert jedem genau einmal zum ersten Mal.' },
    { id: 'bandsalat', icon: '🍝', titel: 'Bandsalat', text: 'Wirrspäne mit dem Spänehaken entfernt – bei stehender Spindel.' },
    { id: 'level10', icon: '🎖️', titel: 'Geselle im Herzen', text: 'Level 10 erreicht.', pruef: function (x) { return x.level >= 10; } },
    { id: 'reich', icon: '💰', titel: 'Gut verdient', text: '1000 € Prämie auf dem Konto.', pruef: function (x) { return x.p.geld >= 1000; } },
    { id: 'lack', icon: '🎨', titel: 'Neuer Anstrich', text: 'Eine Maschine neu lackiert.' }
  ];
  function erfolgVon(id) { var i; for (i = 0; i < ERFOLGE.length; i++) { if (ERFOLGE[i].id === id) { return ERFOLGE[i]; } } return null; }

  // Live vergebener Erfolg (an der Maschine oder im Profil); gibt true zurueck, wenn neu
  function freischalten(spiel, id) {
    var p = profil(spiel.stand), e = erfolgVon(id);
    if (!e || p.erfolge[id]) { return false; }
    p.erfolge[id] = datumKey();
    U().sichern(spiel.stand);
    erfolgToast(e);
    if (spiel.klang) { spiel.klang.erfolgFrei(); }
    return true;
  }

  // ============================================================ Abschluss eines Auftrags
  // Rechnet Erfahrung, Geld, Sterne, Rekorde, Tagesauftrag und Erfolge und schreibt sie in den Stand.
  function abschluss(spiel, mission, aw, werkstatt, ergebnisse) {
    var stand = spiel.stand, p = profil(stand), MIS = ZM.missionen;
    if (spiel.tages) { spiel.tages(); }
    var vorher = levelInfo(p.xp), xpZeilen = [], geld = 0;
    var kette = 0, schichtWert = 0, schnitt = 0;
    (ergebnisse || []).forEach(function (er) {
      if (er && er.schicht) { schichtWert += er.schicht.wert || 0; kette = Math.max(kette, er.schicht.maxKette || 0); schnitt += er.schicht.schnitt || 0; }
    });
    var bestanden = !werkstatt && !aw.unfall && aw.note.note <= 4;
    // Ohne Span gibt es nichts: mindestens 5 s zerspant oder ein Merkmal in Toleranz
    var gearbeitet = !aw.unfall && (schnitt >= 5 || (aw.merkmale || []).some(function (m) { return m.ok; }));
    var fp = werkstatt ? null : stand.fortschritt[mission.id];
    var alteSterne = fp && fp.sterne ? fp.sterne : 0;
    var neueSterne = werkstatt ? 0 : sterne(aw, mission);
    var erstmals = bestanden && !(p.zaehler['bestanden_' + mission.id]);
    function xp(text, wert) { if (wert > 0) { xpZeilen.push({ text: text, xp: Math.round(wert) }); } }

    var wiederholung = bestanden && !erstmals;
    if (werkstatt) {
      if (gearbeitet) {
        xp('Werkstattversuch', 15);
        xp('Flow-Bonus', Math.min(60, schichtWert / 40));
        p.zaehler.werkstatt = (p.zaehler.werkstatt || 0) + 1;
      }
    } else {
      if (bestanden) {
        xp(wiederholung ? 'Auftrag wiederholt' : 'Auftrag bestanden', wiederholung ? 40 : 100);
        xp('Note ' + aw.note.note, { 1: 120, 2: 70, 3: 35, 4: 10 }[aw.note.note] * (wiederholung ? 0.5 : 1));
        if (neueSterne > alteSterne) { xp((neueSterne - alteSterne) + (neueSterne - alteSterne > 1 ? ' neue Sterne' : ' neuer Stern'), 60 * (neueSterne - alteSterne)); }
        if (erstmals) { xp('Erstabschluss', 80); }
        if (!aw.brueche) { xp('Ohne Werkzeugbruch', 30); }
        if (mission.zeit && aw.zeit <= mission.zeit) { xp(aw.zeit <= 0.5 * mission.zeit ? 'Doppelt so schnell wie die Vorgabe' : 'In der Vorgabezeit', aw.zeit <= 0.5 * mission.zeit ? 60 : 30); }
        p.zaehler['bestanden_' + mission.id] = true;
        // Wiederholte Auftraege bringen die halbe Praemie (Nachauftrag)
        geld += Math.max(0, aw.praemie || 0) * (wiederholung ? 0.5 : 1);
      } else if (gearbeitet) {
        xp('Erfahrung gesammelt', 25);
      }
      if (gearbeitet) { xp('Flow-Bonus', Math.min(150, schichtWert / 20)); }
      if (aw.unfall) { p.zaehler.ohneBruch = 0; p.zaehler.sicher = 0; }
      else if (bestanden) {
        p.zaehler.ohneBruch = aw.brueche ? 0 : (p.zaehler.ohneBruch || 0) + 1;
        p.zaehler.sicher = aw.sicherheit ? 0 : (p.zaehler.sicher || 0) + 1;
      } else {
        if (aw.brueche) { p.zaehler.ohneBruch = 0; }
        if (aw.sicherheit) { p.zaehler.sicher = 0; }
      }
      if (fp) { fp.sterne = Math.max(alteSterne, neueSterne); }
    }

    // Tagesauftrag
    var tagesErledigt = false, tages = p.tages;
    if (!werkstatt && tages && tages.id === mission.id && !tages.erledigt && tages.datum === datumKey() &&
      modVon(tages.mod).pruef(aw, mission, { kette: kette })) {
      tages.erledigt = true;
      tagesErledigt = true;
      xp('Tagesauftrag: ' + modVon(tages.mod).text, TAGES_XP);
      geld += TAGES_GELD;
      var heute = datumKey();
      if (p.serie.letzter !== heute) {
        p.serie.tage = p.serie.letzter === vortag(heute) ? (p.serie.tage || 0) + 1 : 1;
        p.serie.letzter = heute;
      }
    }

    // Rekorde
    var rekord = null;
    if (!werkstatt && bestanden) {
      var r = p.rekorde[mission.id];
      if (!r || aw.punkte > r.punkte || (aw.punkte === r.punkte && aw.zeit < r.zeit - 0.5)) {
        rekord = r ? (aw.punkte > r.punkte ? 'punkte' : 'zeit') : null;
        p.rekorde[mission.id] = { punkte: aw.punkte, zeit: aw.zeit };
      }
    }

    var xpSumme = 0;
    xpZeilen.forEach(function (z) { xpSumme += z.xp; });
    p.xp += xpSumme;
    p.geld += Math.round(geld);
    var nachher = levelInfo(p.xp);

    // Erfolge
    var sterneMax = MIS ? MIS.liste.length * 3 : 54;
    var x = { aw: aw, mission: mission, werkstatt: werkstatt, bestanden: bestanden, p: p, stand: stand, neueSterne: neueSterne,
      sterneGesamt: sterneGesamt(stand), sterneMax: sterneMax, level: nachher.level, kette: kette, tagesErledigt: tagesErledigt };
    var neueErfolge = [];
    ERFOLGE.forEach(function (e) {
      if (!e.pruef || p.erfolge[e.id]) { return; }
      var ok = false;
      try { ok = !!e.pruef(x); } catch (err) { ok = false; }
      if (ok) { p.erfolge[e.id] = datumKey(); neueErfolge.push(e); }
    });

    return {
      xpZeilen: xpZeilen, xp: xpSumme, vorher: vorher, nachher: nachher, levelUp: nachher.level > vorher.level,
      rangVorher: rang(vorher.level), rangNachher: rang(nachher.level),
      geld: Math.round(geld), kontostand: p.geld, sterne: neueSterne, alteSterne: alteSterne, besteSterne: fp ? fp.sterne || 0 : 0, wiederholung: wiederholung, rekord: rekord,
      erfolge: neueErfolge, tagesErledigt: tagesErledigt, schichtWert: Math.round(schichtWert), kette: kette
    };
  }

  // ============================================================ Effekte
  function reduziert() {
    return hatDom && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Konfetti ueber der ganzen Seite (Physik: Wurf, Luftwiderstand, Flattern)
  function konfetti(menge) {
    if (!hatDom || reduziert()) { return; }
    var cv = document.createElement('canvas');
    cv.className = 'konfetti';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    var dpr = Math.min(2, root.devicePixelRatio || 1), W = root.innerWidth, H = root.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var FARBEN = ['#f2b100', '#46b874', '#ffffff', '#ff7a45', '#5aa9ff', '#ffd65a', '#e86bd0'];
    var teile = [], i;
    for (i = 0; i < menge; i++) {
      var links = i % 2 === 0;
      teile.push({ x: links ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.25), vx: (links ? 1 : -1) * (250 + Math.random() * 650), vy: -(650 + Math.random() * 750),
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, fl: Math.random() * 6.28,
        farbe: FARBEN[i % FARBEN.length] });
    }
    var alt = null, t = 0;
    function schritt(jetzt) {
      var dt = alt === null ? 0.016 : Math.min(0.05, (jetzt - alt) / 1000);
      alt = jetzt;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      var lebend = 0;
      teile.forEach(function (q) {
        q.vy += 1300 * dt;
        q.vx *= Math.pow(0.35, dt);
        q.vy *= Math.pow(0.7, dt);
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.rot += q.vr * dt; q.fl += 9 * dt;
        if (q.y < H + 20) { lebend++; }
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.scale(1, Math.cos(q.fl));
        ctx.fillStyle = q.farbe;
        ctx.globalAlpha = clamp(3.4 - t, 0, 1);
        ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        ctx.restore();
      });
      if (lebend && t < 3.6) { root.requestAnimationFrame(schritt); } else if (cv.parentNode) { cv.parentNode.removeChild(cv); }
    }
    root.requestAnimationFrame(schritt);
  }

  // Zahl hochzaehlen (ease-out), tick() bei jedem sichtbaren Schritt (fuer das Zaehlgeraeusch)
  function zaehlen(el, von, bis, ms, fmt, tick, fertig) {
    fmt = fmt || function (v) { return String(Math.round(v)); };
    if (!hatDom || reduziert() || ms <= 0) { el.textContent = fmt(bis); if (fertig) { fertig(); } return; }
    var t0 = null, letzter = -1, n = 0;
    function schritt(jetzt) {
      if (t0 === null) { t0 = jetzt; }
      var u = clamp((jetzt - t0) / ms, 0, 1), e = 1 - Math.pow(1 - u, 3), v = von + (bis - von) * e;
      el.textContent = fmt(v);
      if (tick && jetzt - letzter > 70 && u < 1) { letzter = jetzt; tick(n++); }
      if (u < 1) { root.requestAnimationFrame(schritt); } else if (fertig) { fertig(); }
    }
    root.requestAnimationFrame(schritt);
  }

  // Schwebende Punktanzeige ueber der Maschine
  function popup(container, text, klasse, x, y) {
    if (!hatDom || !container) { return; }
    var d = document.createElement('div');
    d.className = 'popup' + (klasse ? ' popup--' + klasse : '');
    d.textContent = text;
    d.style.left = (x === undefined ? 50 + (Math.random() - 0.5) * 24 : x) + '%';
    d.style.top = (y === undefined ? 38 + (Math.random() - 0.5) * 14 : y) + '%';
    container.appendChild(d);
    setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, klasse === 'gross' || klasse === 'weg' ? 1900 : 1300);
  }

  function erfolgToast(e) {
    if (!hatDom) { return; }
    var box = document.getElementById('erfolg-toasts');
    if (!box) { box = document.createElement('div'); box.id = 'erfolg-toasts'; box.className = 'erfolg-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var h = U().h;
    var karte = h('div.erfolg-toast', [h('span.erfolg-toast__icon', e.icon), h('div', [h('small', 'Erfolg freigeschaltet'), h('b', e.titel), h('span', e.text)])]);
    box.appendChild(karte);
    setTimeout(function () { karte.classList.add('weg'); }, 4200);
    setTimeout(function () { if (karte.parentNode) { karte.parentNode.removeChild(karte); } }, 4800);
  }

  function wackeln(el) {
    if (!hatDom || !el || reduziert()) { return; }
    el.classList.remove('wackeln');
    void el.offsetWidth;
    el.classList.add('wackeln');
    setTimeout(function () { el.classList.remove('wackeln'); }, 450);
  }

  // ============================================================ Kopfleiste
  function kopfAktualisieren(spiel, puls) {
    if (!hatDom) { return; }
    var p = profil(spiel.stand), li = levelInfo(p.xp), u = U();
    var el = function (id) { return document.getElementById(id); };
    if (!el('hud-level')) { return; }
    el('hud-level').textContent = String(li.level);
    el('hud-rang').textContent = rang(li.level);
    el('hud-xp').style.width = Math.round(li.anteil * 100) + '%';
    el('hud-xp-text').textContent = li.rest + ' / ' + li.bedarf + ' XP';
    el('hud-geld').textContent = u.zahl(p.geld, 0) + ' €';
    el('hud-sterne').textContent = '★ ' + sterneGesamt(spiel.stand);
    var s = el('hud-serie');
    if (s) {
      s.hidden = !serieAktiv(p);
      s.textContent = '🔥 ' + p.serie.tage;
      s.title = p.serie.tage + (p.serie.tage === 1 ? ' Tag' : ' Tage') + ' in Folge den Tagesauftrag erledigt';
    }
    if (puls) { ['hud-geld', 'hud-sterne', 'hud-level'].forEach(function (id) { var e = el(id); e.classList.remove('puls'); void e.offsetWidth; e.classList.add('puls'); }); }
  }

  // ============================================================ Schicht: Wertung an der Maschine
  var MULTI = [1, 2, 3, 4, 5];
  var STUFE_ZEIT = 3.2;        // s sauberes Zerspanen bis zur naechsten Combo-Stufe
  var RATE = 12;               // Punkte je Sekunde sauberen Zerspanens bei x1
  var BRUCH_TEXT = {
    rattern: 'Rattern!', haemmern: 'Tisch hämmert!', tischZieht: 'Tisch zieht!', rutscht: 'Werkstück rutscht!', rutsch: 'Werkstück rutscht!',
    riemen: 'Riemen rutscht!', kupplung: 'Kupplung ratscht!', wirr: 'Wirrspäne!', aufschweiss: 'Aufschweißen!', motorschutz: 'Motorschutz!',
    stall: 'Abgewürgt!', abgewuergt: 'Abgewürgt!', steckt: 'Bohrer steckt!', bruch: 'Werkzeugbruch!', kollision: 'Kollision!', unfall: 'Unfall!',
    sicherheit: 'Sicherheit!', alarm: 'Alarm!', stumpf: 'Stumpf reibt!', halter: 'Halter schneidet mit!'
  };

  function Schicht(bb) {
    this.bb = bb;
    this.wert = 0; this.kette = 0; this.maxKette = 0; this.fluss = 0; this.sauber = 0;
    this.akku = 0; this.popZeit = 0; this.letzterBruch = -10; this.zeit = 0; this.loecher = 0;
    this.schnitt = 0; this.seitBonus = 0;
    this.massBonus = {};
    this.angezeigt = -1;
    if (!hatDom) { return; }
    var buehne = document.querySelector('.bb__buehne');
    this.buehne = buehne;
    if (!buehne) { return; }
    var alt = document.querySelectorAll('.bb .schicht, .bb .popups');
    Array.prototype.forEach.call(alt, function (n) { n.parentNode.removeChild(n); });
    var h = U().h;
    this.elWert = h('b.schicht__wert', '0');
    this.elMulti = h('span.schicht__multi', '×1');
    this.elBalken = h('span');
    this.el = h('div.schicht', { 'aria-hidden': 'true' }, [
      h('div.schicht__oben', [h('div.schicht__punkte', [this.elWert, h('small', 'Schichtpunkte')]), this.elMulti]),
      h('div.schicht__balken', this.elBalken)
    ]);
    this.pops = h('div.popups', { 'aria-hidden': 'true' });
    // Anzeige in der Kopfzeile der Maschine, damit sie keine Beschriftung der Szene verdeckt
    var kopf = document.querySelector('#bb-kopf .rechts');
    if (kopf) { kopf.insertBefore(this.el, kopf.firstChild); } else { buehne.appendChild(this.el); }
    buehne.appendChild(this.pops);
  }

  // Zustand der Zerspanung: schneidet, gut (im Lastfenster, ruhig), schlecht (mit Grund),
  // prod: Produktivitaet gegenueber dem Richtwert (langsames Arbeiten bringt nicht mehr Punkte)
  Schicht.prototype.bewerten = function () {
    var bb = this.bb, sim = bb.sim, a = sim.anzeige(), art = bb.art;
    var z = { schneidet: false, gut: false, schlecht: null, prod: 1 };
    if (a.gebrochen || sim.unfall) { return z; }
    if (art === 'dreh') {
      z.schneidet = a.ap > 0.005 && a.n > 5 && (a.modus === 'laengs' || a.modus === 'plan');
      if (!z.schneidet) { return z; }
      var pl = a.plattenLast || 0;
      if (a.amp > 8) { z.schlecht = 'Rattern!'; }
      else if (a.ruck > 0.35) { z.schlecht = 'Überlast!'; }
      else if (pl > 1.05) { z.schlecht = 'Platte am Limit!'; }
      z.gut = !z.schlecht && pl >= 0.12 && pl <= 0.92 && (a.last || 0) < 0.98 && a.amp < 3 && a.ruck < 0.15;
      // Bandspaene: Schnitt zaehlt, aber nur halb (Spankontrolle gehoert zum sauberen Arbeiten)
      z.halb = a.spanForm === 'band';
      z.prod = clamp(pl / 0.45, 0.4, 1.3) * clamp(a.vc / Math.max(1, a.vcRef || a.vc), 0.5, 1.2) * (z.halb ? 0.5 : 1);
    } else if (art === 'fraes') {
      z.schneidet = a.ap > 0.005 && a.ae > 0.01 && a.n > 5;
      if (!z.schneidet) { return z; }
      if (a.amp > 8) { z.schlecht = 'Rattern!'; }
      else if (a.ruck > 0.35) { z.schlecht = 'Überlast!'; }
      else if (a.r > 0.95) { z.schlecht = 'Fräser am Limit!'; }
      z.gut = !z.schlecht && a.r >= 0.1 && a.r <= 0.85 && a.amp < 3 && a.ruck < 0.15 && (a.hammer || 0) < 0.2;
      z.prod = clamp(a.r / 0.4, 0.4, 1.3) * clamp(a.vc / Math.max(1, a.vcRef || a.vc), 0.5, 1.2);
    } else {
      z.schneidet = a.f > 0.002 && a.n > 5 && a.M > 0.001;
      if (!z.schneidet) { return z; }
      var m = a.M / Math.max(0.01, a.mBruch);
      if (m > 0.9) { z.schlecht = 'Kurz vorm Bruch!'; }
      else if (a.phi > 0.85) { z.schlecht = 'Spänestau!'; }
      // Bohren und Reiben: Vorschub und vc am Richtwert des Werkzeugs; Gewinde: Vorschub = Steigung
      var fv = a.fRef ? a.f / a.fRef : 1, vv = a.vcRef ? a.vc / a.vcRef : 1;
      var imFenster = sim.typ === 'gewinde' ? true : fv >= 0.5 && fv <= 1.4 && vv >= 0.6 && vv <= 1.35;
      z.gut = !z.schlecht && imFenster && m <= 0.75 && a.phi < 0.6 && (a.last || 0) < 0.95;
      z.prod = sim.typ === 'gewinde' ? 1 : clamp(fv, 0.4, 1.25) * clamp(vv, 0.5, 1.2);
    }
    return z;
  };

  Schicht.prototype.takt = function (dt) {
    if (!(dt > 0)) { return; }
    this.zeit += dt;
    var z = this.bewerten();
    if (z.schneidet) { this.schnitt += dt; this.seitBonus += dt; }
    if (z.schlecht) {
      this.brechen(z.schlecht);
    } else if (z.gut) {
      this.sauber += dt;
      this.fluss += dt / STUFE_ZEIT * (z.halb ? 0.5 : 1);
      this.akku += RATE * MULTI[this.kette] * z.prod * dt;
      this.popZeit += dt;
      if (this.popZeit >= 1.3) { this.gutschreiben(); }
      if (this.fluss >= 1) {
        if (this.kette < MULTI.length - 1) {
          this.kette += 1;
          this.maxKette = Math.max(this.maxKette, this.kette);
          this.fluss = 0;
          popup(this.pops, 'Combo ×' + MULTI[this.kette], 'combo', 50, 26);
          if (this.bb.spiel.klang) { this.bb.spiel.klang.comboHoch(this.kette); }
          if (this.el) { this.el.classList.remove('hoch'); void this.el.offsetWidth; this.el.classList.add('hoch'); }
          if (this.kette === MULTI.length - 1) { freischalten(this.bb.spiel, 'flow'); }
        } else {
          this.fluss = 1;
        }
      }
    } else if (z.schneidet) {
      this.fluss = Math.max(0, this.fluss - dt * 0.25);
      if (this.akku > 0) { this.gutschreiben(); }
    } else if (this.akku > 0) {
      this.gutschreiben();
    }
    // Bohrungen: jede fertige Bohrung ist ein kleiner Bonus
    var sim = this.bb.sim;
    if (this.bb.art === 'bohr' && sim.ergebnisse && sim.ergebnisse.length > this.loecher) {
      var neu = 0, k;
      for (k = this.loecher; k < sim.ergebnisse.length; k++) { if (sim.ergebnisse[k].gebohrt && !sim.ergebnisse[k].defekt) { neu++; } }
      this.loecher = sim.ergebnisse.length;
      if (neu && !sim.w.gebrochen) { this.bonus(neu > 1 ? neu + ' Bohrungen fertig' : 'Bohrung fertig', 25 * neu); }
    }
    this.anzeigen();
  };

  Schicht.prototype.gutschreiben = function () {
    var p = Math.round(this.akku);
    this.akku = 0;
    this.popZeit = 0;
    if (p <= 0) { return; }
    this.wert += p;
    popup(this.pops, '+' + p, this.kette >= 3 ? 'heiss' : null);
    if (this.bb.spiel.klang) { this.bb.spiel.klang.punkt(this.kette); }
  };

  Schicht.prototype.bonus = function (text, p) {
    var w = Math.round(p * MULTI[this.kette]);
    this.wert += w;
    popup(this.pops, text + ' +' + w, 'gross', 50, 30);
    if (this.bb.spiel.klang) { this.bb.spiel.klang.muenze(); }
    this.anzeigen();
  };

  // Combo verloren; Punkte bleiben, nur der Multiplikator faellt
  Schicht.prototype.brechen = function (text) {
    if (this.akku > 0) { this.gutschreiben(); }
    var hatte = this.kette > 0 || this.fluss > 0.3;
    this.kette = 0;
    this.fluss = 0;
    if (!hatte || this.zeit - this.letzterBruch < 1.5) { this.letzterBruch = this.zeit; return; }
    this.letzterBruch = this.zeit;
    popup(this.pops, text + ' Combo weg', 'weg', 50, 34);
    if (this.bb.spiel.klang) { this.bb.spiel.klang.comboWeg(); }
    wackeln(this.el);
    this.anzeigen();
  };

  Schicht.prototype.ereignis = function (e) {
    if (!e) { return; }
    if (e.typ === 'bruch') { freischalten(this.bb.spiel, 'lehrgeld'); }
    if (BRUCH_TEXT[e.typ] && e.schwere !== 'info') { this.brechen(BRUCH_TEXT[e.typ]); return; }
    // Anschlag: nur nach einem echten Schnitt seit dem letzten Bonus
    if (e.typ === 'anschlag' && this.bb.art === 'dreh' && this.seitBonus >= 2) {
      this.seitBonus = 0;
      this.bonus('Punktlandung am Anschlag', 30);
    }
  };

  // Gemessenes Mass in der Toleranz: einmal je Merkmal ein Bonus
  Schicht.prototype.mass = function (schluessel, text) {
    if (this.massBonus[schluessel]) { return; }
    this.massBonus[schluessel] = true;
    this.bonus(text, 80);
    if (this.bb.spiel.klang) { this.bb.spiel.klang.stern(1); }
  };

  Schicht.prototype.anzeigen = function () {
    if (!this.el) { return; }
    var w = Math.round(this.wert);
    if (w !== this.angezeigt) { this.elWert.textContent = U().zahl(w, 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); this.angezeigt = w; }
    this.elMulti.textContent = '×' + MULTI[this.kette];
    this.el.setAttribute('data-stufe', String(this.kette));
    this.elBalken.style.width = Math.round(clamp(this.fluss, 0, 1) * 100) + '%';
  };

  Schicht.prototype.ergebnis = function () {
    if (this.akku > 0) { this.wert += Math.round(this.akku); this.akku = 0; }
    return { wert: Math.round(this.wert), maxKette: this.maxKette, sauber: this.sauber, schnitt: this.schnitt };
  };

  Schicht.prototype.entfernen = function () {
    if (this.el && this.el.parentNode) { this.el.parentNode.removeChild(this.el); }
    if (this.pops && this.pops.parentNode) { this.pops.parentNode.removeChild(this.pops); }
  };

  ZM.belohnung = {
    bedarf: bedarf, levelInfo: levelInfo, rang: rang, RAENGE: RAENGE, profil: profil, serieAktiv: serieAktiv, sterne: sterne, sterneGesamt: sterneGesamt,
    datumKey: datumKey, vortag: vortag, tagesauftrag: tagesauftrag, MODS: MODS, modVon: modVon, TAGES_XP: TAGES_XP, TAGES_GELD: TAGES_GELD,
    LACKE: LACKE, lackVon: lackVon, lackAnwenden: lackAnwenden, lackKaufen: lackKaufen,
    ERFOLGE: ERFOLGE, erfolgVon: erfolgVon, freischalten: freischalten, abschluss: abschluss,
    konfetti: konfetti, zaehlen: zaehlen, popup: popup, erfolgToast: erfolgToast, wackeln: wackeln, kopfAktualisieren: kopfAktualisieren,
    Schicht: Schicht, MULTI: MULTI
  };
})(typeof window !== 'undefined' ? window : globalThis);
