/* match.js - Spielsimulation.
 * Der Ablauf ist als Minuten-Stepper gebaut, damit der Trainer waehrend des
 * Spiels wechseln und die Taktik umstellen kann.
 */
(function (g) {
  'use strict';

  var FORMATIONEN = {
    '4-4-2':     [['TW', 50, 92], ['LV', 16, 72], ['IV', 38, 76], ['IV', 62, 76], ['RV', 84, 72],
                  ['LM', 16, 48], ['ZM', 38, 50], ['ZM', 62, 50], ['RM', 84, 48],
                  ['ST', 38, 20], ['ST', 62, 20]],
    '4-2-3-1':   [['TW', 50, 92], ['LV', 16, 72], ['IV', 38, 76], ['IV', 62, 76], ['RV', 84, 72],
                  ['DM', 38, 58], ['DM', 62, 58],
                  ['LA', 18, 36], ['OM', 50, 38], ['RA', 82, 36], ['ST', 50, 16]],
    '4-3-3':     [['TW', 50, 92], ['LV', 16, 72], ['IV', 38, 76], ['IV', 62, 76], ['RV', 84, 72],
                  ['DM', 50, 58], ['ZM', 32, 48], ['ZM', 68, 48],
                  ['LA', 18, 26], ['ST', 50, 18], ['RA', 82, 26]],
    '4-1-4-1':   [['TW', 50, 92], ['LV', 16, 72], ['IV', 38, 76], ['IV', 62, 76], ['RV', 84, 72],
                  ['DM', 50, 60], ['LM', 16, 44], ['ZM', 38, 46], ['ZM', 62, 46], ['RM', 84, 44],
                  ['ST', 50, 18]],
    '3-5-2':     [['TW', 50, 92], ['IV', 28, 76], ['IV', 50, 78], ['IV', 72, 76],
                  ['LM', 12, 52], ['DM', 50, 60], ['ZM', 34, 46], ['ZM', 66, 46], ['RM', 88, 52],
                  ['ST', 38, 20], ['ST', 62, 20]],
    '3-4-3':     [['TW', 50, 92], ['IV', 28, 76], ['IV', 50, 78], ['IV', 72, 76],
                  ['LM', 12, 52], ['ZM', 38, 52], ['ZM', 62, 52], ['RM', 88, 52],
                  ['LA', 22, 22], ['ST', 50, 16], ['RA', 78, 22]],
    '5-3-2':     [['TW', 50, 92], ['LV', 10, 66], ['IV', 30, 80], ['IV', 50, 82], ['IV', 70, 80], ['RV', 90, 66],
                  ['ZM', 32, 52], ['DM', 50, 58], ['ZM', 68, 52],
                  ['ST', 40, 20], ['ST', 60, 20]],
    '4-4-1-1':   [['TW', 50, 92], ['LV', 16, 72], ['IV', 38, 76], ['IV', 62, 76], ['RV', 84, 72],
                  ['LM', 16, 48], ['ZM', 38, 52], ['ZM', 62, 52], ['RM', 84, 48],
                  ['OM', 50, 30], ['ST', 50, 16]]
  };

  var MENTALITAET = {
    defensiv:      { ang: 0.78, def: 1.20, name: 'Defensiv' },
    zurueckhaltend:{ ang: 0.90, def: 1.10, name: 'Zurückhaltend' },
    ausgeglichen:  { ang: 1.00, def: 1.00, name: 'Ausgeglichen' },
    offensiv:      { ang: 1.14, def: 0.90, name: 'Offensiv' },
    vollgas:       { ang: 1.30, def: 0.76, name: 'Vollgas' }
  };

  var PRESSING = {
    tief:   { ang: 0.95, def: 1.08, kondition: 0.85, foul: 0.9, name: 'Tief stehen' },
    normal: { ang: 1.00, def: 1.00, kondition: 1.00, foul: 1.0, name: 'Normal' },
    hoch:   { ang: 1.08, def: 0.96, kondition: 1.22, foul: 1.25, name: 'Hohes Pressing' }
  };

  var SPIELWEISE = {
    kurzpass:  { ang: 1.05, chancen: 0.95, name: 'Kurzpassspiel' },
    normal:    { ang: 1.00, chancen: 1.00, name: 'Ausgeglichen' },
    konter:    { ang: 0.94, chancen: 1.16, name: 'Konterfußball' },
    lang:      { ang: 0.96, chancen: 1.08, name: 'Lange Bälle' },
    fluegel:   { ang: 1.02, chancen: 1.04, name: 'Flügelspiel' }
  };

  function standardTaktik() {
    return {
      formation: '4-2-3-1',
      mentalitaet: 'ausgeglichen',
      pressing: 'normal',
      spielweise: 'normal',
      haerte: 'normal'
    };
  }

  /* Effektive Staerke eines Spielers auf einer bestimmten Position.
     frische ueberschreibt die Fitness, sobald das Spiel laeuft - so wirkt
     sich Muedigkeit unmittelbar auf die Leistung aus. */
  function wirkung(p, slotPos, frische) {
    var eig = Players.eignung(p.pos, slotPos);
    var wert = frische === undefined ? p.fitness : frische;
    var fit = 0.58 + 0.42 * (wert / 100);
    var form = 0.86 + 0.28 * (p.form / 100);
    var moral = 0.93 + 0.14 * (p.moral / 100);
    return p.staerke * eig * fit * form * moral;
  }

  /* Automatische Aufstellung: beste Besetzung je Slot, Torwart zuerst. */
  function autoAufstellung(kader, formation, heute) {
    var slots = FORMATIONEN[formation] || FORMATIONEN['4-2-3-1'];
    var verfuegbar = kader.filter(function (p) {
      return p.verletztBis <= heute && p.sperre <= 0;
    });
    var vergeben = {};
    var elf = [];
    /* Torwart-Slots zuerst, dann nach Wichtigkeit der Position. */
    var reihenfolge = slots.map(function (s, i) { return { i: i, pos: s[0] }; })
      .sort(function (a, b) {
        var w = { TW: 0, IV: 1, ST: 2, ZM: 3, DM: 3, OM: 4, LV: 5, RV: 5, LA: 6, RA: 6, LM: 7, RM: 7 };
        return (w[a.pos] || 8) - (w[b.pos] || 8);
      });
    /* Erst nach gelernter Position besetzen. Nur wenn dort niemand mehr
       frei ist, wird die Anforderung schrittweise gelockert - so steht kein
       Innenverteidiger plötzlich im Sturm. */
    reihenfolge.forEach(function (eintrag) {
      var beste = null, besteW = -1;
      var schwellen = [1.0, 0.88, 0.75, 0];
      for (var st = 0; st < schwellen.length && !beste; st++) {
        for (var i = 0; i < verfuegbar.length; i++) {
          var p = verfuegbar[i];
          if (vergeben[p.id]) continue;
          if (Players.eignung(p.pos, eintrag.pos) < schwellen[st]) continue;
          var w = wirkung(p, eintrag.pos);
          if (w > besteW) { besteW = w; beste = p; }
        }
      }
      if (beste) { vergeben[beste.id] = true; elf[eintrag.i] = beste.id; }
    });
    /* Bank: ein Ersatztorwart und für jede Mannschaftsteil mindestens eine
       Alternative, danach die stärksten Übrigen. */
    var rest = verfuegbar.filter(function (p) { return !vergeben[p.id]; });
    rest.sort(function (a, b) { return b.staerke - a.staerke; });
    var bank = [];
    var drin = {};
    function aufBank(p) {
      if (!p || drin[p.id] || bank.length >= 9) return;
      drin[p.id] = true; bank.push(p.id);
    }
    aufBank(rest.filter(function (p) { return p.pos === 'TW'; })[0]);
    ['ABW', 'MIT', 'ANG'].forEach(function (grp) {
      aufBank(rest.filter(function (p) {
        return Players.GRUPPE[p.pos] === grp && !drin[p.id];
      })[0]);
    });
    rest.forEach(aufBank);
    return { formation: formation, elf: elf.filter(Boolean), bank: bank };
  }

  /* Mannschaftswerte aus der aktuellen Elf. */
  function teamWerte(seite, spielerMap) {
    var slots = FORMATIONEN[seite.formation] || FORMATIONEN['4-2-3-1'];
    var tw = 0, abw = [], mit = [], ang = [];
    seite.elf.forEach(function (pid, i) {
      var p = spielerMap[pid];
      if (!p) return;
      var slotPos = (slots[i] && slots[i][0]) || p.pos;
      var w = wirkung(p, slotPos, seite.frische ? seite.frische[pid] : undefined);
      var grp = Players.GRUPPE[slotPos];
      if (grp === 'TW') tw = w;
      else if (grp === 'ABW') abw.push(w);
      else if (grp === 'MIT') mit.push(w);
      else ang.push(w);
    });
    function mittel(a, fallback) {
      if (!a.length) return fallback;
      return Util.sum(a) / a.length;
    }
    var basis = 30;
    var mAbw = mittel(abw, basis * 0.8);
    var mMit = mittel(mit, basis * 0.8);
    var mAng = mittel(ang, basis * 0.8);
    if (!tw) tw = basis * 0.7;
    /* Unterzahl bestraft alle Bereiche. */
    var unterzahl = Math.max(0, 11 - seite.elf.length);
    var uz = Math.pow(0.90, unterzahl);

    var m = MENTALITAET[seite.taktik.mentalitaet] || MENTALITAET.ausgeglichen;
    var pr = PRESSING[seite.taktik.pressing] || PRESSING.normal;
    var sw = SPIELWEISE[seite.taktik.spielweise] || SPIELWEISE.normal;

    var angriff = (mAng * 0.50 + mMit * 0.34 + mAbw * 0.16) * m.ang * pr.ang * sw.ang * uz;
    var abwehr = (mAbw * 0.48 + mMit * 0.28 + tw * 0.24) * m.def * pr.def * uz;
    return {
      tw: tw, abw: mAbw, mit: mMit, ang: mAng,
      angriff: angriff, abwehr: abwehr,
      chancenMod: sw.chancen, konditionMod: pr.kondition, foulMod: pr.foul * (seite.taktik.haerte === 'hart' ? 1.5 : (seite.taktik.haerte === 'fair' ? 0.6 : 1)),
      gesamt: mAbw * 0.34 + mMit * 0.34 + mAng * 0.24 + tw * 0.08
    };
  }

  function seiteAufbauen(klubId, kader, aufstellung, taktik, spielerMap) {
    var elf = aufstellung.elf.slice();
    var bank = aufstellung.bank.slice();
    var s = {
      klubId: klubId, formation: aufstellung.formation, elf: elf, bank: bank,
      taktik: taktik, tore: 0, wechsel: 0, schuesse: 0, chancen: 0, ecken: 0,
      gelb: {}, rot: [], raus: [], eingesetzt: {}, werte: null
    };
    elf.forEach(function (pid) { s.eingesetzt[pid] = { von: 0, bis: 90, note: 3.5, tore: 0, vorlagen: 0 }; });
    /* Frische zu Spielbeginn: der Fitnesswert des Spielers. */
    s.frische = {};
    elf.concat(bank).forEach(function (pid) {
      var p = spielerMap[pid];
      if (p) s.frische[pid] = p.fitness;
    });
    s.werte = teamWerte(s, spielerMap);
    return s;
  }

  /* Waehlt einen Spieler nach Positionsgewicht (z. B. wer trifft). */
  function auswahl(rng, seite, spielerMap, gewichte, ausschluss) {
    var kand = [], summe = 0;
    seite.elf.forEach(function (pid) {
      if (ausschluss && ausschluss.indexOf(pid) >= 0) return;
      var p = spielerMap[pid];
      if (!p) return;
      var w = gewichte[Players.GRUPPE[p.pos]] || 0.2;
      if (p.pos === 'ST') w *= 1.25;
      if (p.pos === 'OM' || p.pos === 'LA' || p.pos === 'RA') w *= 1.1;
      w *= 0.5 + p.staerke / 100;
      kand.push([pid, w]); summe += w;
    });
    if (!kand.length) return null;
    var r = rng.next() * summe;
    for (var i = 0; i < kand.length; i++) { r -= kand[i][1]; if (r <= 0) return kand[i][0]; }
    return kand[0][0];
  }

  var TOR_GEWICHTE = { TW: 0.01, ABW: 0.16, MIT: 0.55, ANG: 1.6 };
  var ASSIST_GEWICHTE = { TW: 0.02, ABW: 0.3, MIT: 1.0, ANG: 0.9 };
  var FOUL_GEWICHTE = { TW: 0.05, ABW: 1.1, MIT: 1.0, ANG: 0.5 };

  var TORTEXTE = [
    '{s} trifft aus kurzer Distanz!',
    '{s} schließt einen schönen Spielzug ab!',
    '{s} verwandelt eiskalt!',
    'Kopfball {s} - drin!',
    '{s} zieht aus 20 Metern ab und trifft!',
    '{s} nutzt den Fehler in der Abwehr!',
    'Konter über den Flügel, {s} vollendet!',
    '{s} staubt nach einem Abpraller ab!'
  ];
  var CHANCEN_TEXTE = [
    '{s} zielt knapp vorbei.',
    'Guter Abschluss von {s}, aber der Torwart pariert.',
    '{s} scheitert am Innenpfosten!',
    'Der Schuss von {s} wird geblockt.',
    '{s} kommt zum Kopfball - drüber.',
    'Riesenchance für {s}, doch der Keeper ist da!'
  ];

  function neu(rng, ctx) {
    /* ctx: {heimKlub, gastKlub, heimSeite, gastSeite, spielerMap, zuschauer, wichtigkeit, heimVorteil} */
    var m = {
      rng: rng,
      minute: 0,
      heim: ctx.heimSeite,
      gast: ctx.gastSeite,
      heimKlub: ctx.heimKlub,
      gastKlub: ctx.gastKlub,
      spieler: ctx.spielerMap,
      zuschauer: ctx.zuschauer || 0,
      auslastung: ctx.auslastung || 0.5,
      ereignisse: [],
      ballbesitz: 50,
      beendet: false,
      nachspielzeit: 0,
      verletzungen: [],
      heimVorteil: ctx.heimVorteil === undefined ? 1.0 : ctx.heimVorteil,
      ligaId: ctx.ligaId || null,
      spieltag: ctx.spieltag || 0
    };
    m.ereignisse.push({ min: 0, typ: 'anpfiff', text: 'Anpfiff im ' + (ctx.heimKlub.stadion || 'Stadion') +
      (m.zuschauer ? ' vor ' + Fmt.num(m.zuschauer) + ' Zuschauern' : '') + '.' });
    berechneXG(m);
    return m;
  }

  /* Neutrale Chancenverwertung - Bezugsgroesse fuer die Umrechnung xG -> Chancen. */
  var BASIS_KONVERSION = 0.343;
  var TOR_BASIS = 1.38;      /* Tore je Team bei ausgeglichener Partie */
  var STAERKE_EXPONENT = 1.25;

  function berechneXG(m) {
    var wh = m.heim.werte, wg = m.gast.werte;
    var hv = 1 + 0.055 * m.heimVorteil * (0.6 + m.auslastung * 0.6);
    var vh = wh.angriff / Math.max(8, wg.abwehr);
    var vg = wg.angriff / Math.max(8, wh.abwehr);
    var hvE = Math.pow(hv, STAERKE_EXPONENT);
    m.xgHeim = Util.clamp(TOR_BASIS * Math.pow(vh, STAERKE_EXPONENT) * hvE, 0.18, 4.4);
    m.xgGast = Util.clamp(TOR_BASIS * Math.pow(vg, STAERKE_EXPONENT) / hvE, 0.15, 4.2);
    var mh = Math.max(1, wh.mit), mg = Math.max(1, wg.mit);
    m.ballbesitz = Math.round(Util.clamp(50 + (mh * hv - mg) / (mh + mg) * 100, 26, 74));
  }

  function spielerName(m, pid) {
    var p = m.spieler[pid];
    return p ? p.name : '?';
  }

  function ereignis(m, typ, min, text, seite, pid, extra) {
    var e = { min: min, typ: typ, text: text, klubId: seite ? seite.klubId : null, spielerId: pid || null };
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    m.ereignisse.push(e);
    return e;
  }

  function torFallen(m, seite, gegner, min) {
    var torschuetze = auswahl(m.rng, seite, m.spieler, TOR_GEWICHTE);
    if (!torschuetze) return;
    var vorlage = m.rng.chance(0.72) ? auswahl(m.rng, seite, m.spieler, ASSIST_GEWICHTE, [torschuetze]) : null;
    seite.tore++;
    var st = seite.eingesetzt[torschuetze];
    if (st) { st.tore++; st.note = Util.clamp(st.note - 0.75, 1.0, 6.0); }
    if (vorlage && seite.eingesetzt[vorlage]) {
      seite.eingesetzt[vorlage].vorlagen++;
      seite.eingesetzt[vorlage].note = Util.clamp(seite.eingesetzt[vorlage].note - 0.4, 1.0, 6.0);
    }
    /* Torwart und Abwehr des Gegners bekommen schlechtere Noten. */
    gegner.elf.forEach(function (pid) {
      var p = m.spieler[pid];
      if (!p) return;
      var grp = Players.GRUPPE[p.pos];
      if (grp === 'TW') gegner.eingesetzt[pid].note = Util.clamp(gegner.eingesetzt[pid].note + 0.28, 1, 6);
      else if (grp === 'ABW') gegner.eingesetzt[pid].note = Util.clamp(gegner.eingesetzt[pid].note + 0.16, 1, 6);
    });
    var txt = m.rng.pick(TORTEXTE).replace('{s}', spielerName(m, torschuetze));
    if (vorlage) txt += ' Vorlage: ' + spielerName(m, vorlage) + '.';
    ereignis(m, 'tor', min, txt, seite, torschuetze, { vorlage: vorlage, stand: m.heim.tore + ':' + m.gast.tore });
  }

  /* Strafstoss: der beste Schuetze der Elf tritt an, rund drei Viertel
     der Elfmeter fallen. */
  function elfmeter(m, seite, gegner, min) {
    var beste = null, bester = -1;
    seite.elf.forEach(function (pid) {
      var p = m.spieler[pid];
      if (!p || p.pos === 'TW') return;
      var w = (p.attrs.abschluss || 0) * 0.7 + (p.attrs.technik || 0) * 0.3;
      if (w > bester) { bester = w; beste = pid; }
    });
    if (!beste) return;
    var schuetze = m.spieler[beste];
    ereignis(m, 'chance', min, 'Elfmeter für ' + (m.heim === seite ? m.heimKlub.kurz : m.gastKlub.kurz) +
      '! ' + schuetze.name + ' legt sich den Ball zurecht.', seite, beste);
    var twId = gegner.elf.filter(function (pid) {
      var p = m.spieler[pid]; return p && p.pos === 'TW';
    })[0];
    var tw = twId ? m.spieler[twId] : null;
    var chance = Util.clamp(0.74 + ((schuetze.attrs.abschluss || 50) - 60) * 0.003 -
      (tw ? ((tw.attrs.reflexe || 50) - 60) * 0.0022 : 0), 0.55, 0.9);
    if (m.rng.next() < chance) {
      seite.tore++;
      var e = seite.eingesetzt[beste];
      if (e) { e.tore++; e.note = Util.clamp(e.note - 0.6, 1, 6); }
      ereignis(m, 'tor', min, schuetze.name + ' verwandelt vom Punkt.', seite, beste,
        { elfmeter: true, stand: m.heim.tore + ':' + m.gast.tore });
    } else {
      if (tw && gegner.eingesetzt[twId]) {
        gegner.eingesetzt[twId].note = Util.clamp(gegner.eingesetzt[twId].note - 0.9, 1, 6);
      }
      ereignis(m, 'chance', min, (tw ? tw.name + ' hält den Elfmeter!' :
        schuetze.name + ' vergibt vom Punkt.'), seite, beste);
      if (seite.eingesetzt[beste]) {
        seite.eingesetzt[beste].note = Util.clamp(seite.eingesetzt[beste].note + 0.8, 1, 6);
      }
    }
  }

  function karte(m, seite, min, rot) {
    var pid = auswahl(m.rng, seite, m.spieler, FOUL_GEWICHTE);
    if (!pid) return;
    /* Schon verwarnte Spieler halten sich meist zurueck - sonst gaebe es
       viel zu viele Gelb-Rote Karten. */
    if (!rot && seite.gelb[pid] && m.rng.chance(0.92)) {
      var frei = seite.elf.filter(function (x) { return !seite.gelb[x]; });
      if (frei.length) pid = frei[m.rng.int(0, frei.length - 1)];
    }
    if (rot) {
      seite.rot.push(pid);
      var idx = seite.elf.indexOf(pid);
      if (idx >= 0) seite.elf.splice(idx, 1);
      if (seite.eingesetzt[pid]) { seite.eingesetzt[pid].bis = min; seite.eingesetzt[pid].note = Util.clamp(seite.eingesetzt[pid].note + 1.6, 1, 6); }
      ereignis(m, 'rot', min, 'Rote Karte für ' + spielerName(m, pid) + '! Nur noch zu zehnt.', seite, pid);
      seite.werte = teamWerte(seite, m.spieler);
      berechneXG(m);
    } else {
      if (seite.gelb[pid]) {
        /* Gelb-Rot */
        seite.rot.push(pid);
        var i2 = seite.elf.indexOf(pid);
        if (i2 >= 0) seite.elf.splice(i2, 1);
        if (seite.eingesetzt[pid]) { seite.eingesetzt[pid].bis = min; seite.eingesetzt[pid].note = Util.clamp(seite.eingesetzt[pid].note + 1.3, 1, 6); }
        ereignis(m, 'gelbrot', min, 'Gelb-Rot für ' + spielerName(m, pid) + '!', seite, pid);
        seite.werte = teamWerte(seite, m.spieler);
        berechneXG(m);
      } else {
        seite.gelb[pid] = true;
        if (seite.eingesetzt[pid]) seite.eingesetzt[pid].note = Util.clamp(seite.eingesetzt[pid].note + 0.25, 1, 6);
        ereignis(m, 'gelb', min, 'Gelbe Karte für ' + spielerName(m, pid) + '.', seite, pid);
      }
    }
  }

  function verletzung(m, seite, min) {
    var pid = seite.elf[m.rng.int(0, seite.elf.length - 1)];
    if (!pid) return;
    var p = m.spieler[pid];
    if (!p) return;
    m.verletzungen.push({ spielerId: pid, klubId: seite.klubId, min: min });
    ereignis(m, 'verletzung', min, spielerName(m, pid) + ' muss verletzt behandelt werden.', seite, pid);
  }

  /* Eine Spielminute. Gibt die in dieser Minute entstandenen Ereignisse zurueck. */
  function minute(m) {
    if (m.beendet) return [];
    var vorher = m.ereignisse.length;
    m.minute++;
    var min = m.minute;

    if (min === 46) ereignis(m, 'info', 45, 'Halbzeit. Stand: ' + m.heim.tore + ':' + m.gast.tore + '.');

    /* Chancenwahrscheinlichkeit pro Minute; Endphase etwas intensiver. */
    var phase = min > 75 ? 1.16 : (min < 10 ? 0.82 : 1.0);
    var seiten = [[m.heim, m.gast, m.xgHeim, m.heim.werte.chancenMod],
                  [m.gast, m.heim, m.xgGast, m.gast.werte.chancenMod]];

    for (var i = 0; i < seiten.length; i++) {
      var seite = seiten[i][0], gegner = seiten[i][1], xg = seiten[i][2], cm = seiten[i][3];
      var pChance = (xg / 90) / BASIS_KONVERSION * phase * cm;
      if (m.rng.next() < pChance) {
        seite.chancen++;
        seite.schuesse++;
        /* Ein kleiner Teil der Chancen endet mit einem Foul im Strafraum. */
        if (m.rng.next() < 0.032) {
          elfmeter(m, seite, gegner, min);
          continue;
        }
        /* Verwertung haengt vom Sturm gegen den Torwart ab und schwankt um
           BASIS_KONVERSION - so bleibt die xG-Rechnung im Mittel erhalten. */
        var konversion = 0.48 * (seite.werte.ang / Math.max(10, gegner.werte.tw * 0.9 + seite.werte.ang * 0.5));
        konversion = Util.clamp(konversion, 0.11, 0.55);
        if (m.rng.next() < konversion) {
          torFallen(m, seite, gegner, min);
        } else {
          var pid = auswahl(m.rng, seite, m.spieler, TOR_GEWICHTE);
          if (pid) ereignis(m, 'chance', min, m.rng.pick(CHANCEN_TEXTE).replace('{s}', spielerName(m, pid)), seite, pid);
        }
      }
      /* Ecken, nur fuer die Statistik */
      if (m.rng.next() < 0.055 * cm) seite.ecken++;
      /* Karten */
      var foulP = 0.021 * seite.werte.foulMod;
      if (m.rng.next() < foulP) {
        karte(m, seite, min, m.rng.chance(0.016));
      }
      /* Verletzungen */
      if (m.rng.next() < 0.0005 * (seite.taktik.haerte === 'hart' ? 1.3 : 1)) {
        verletzung(m, seite, min);
      }
    }

    /* Ermuedung: Wer auf dem Platz steht, verliert Frische. Wie schnell,
       haengt an der Kondition und daran, wie hoch die Elf presst. */
    [m.heim, m.gast].forEach(function (seite) {
      seite.elf.forEach(function (pid) {
        var p = m.spieler[pid];
        if (!p) return;
        var verlust = (0.18 + (100 - (p.attrs.kondition || 50)) * 0.005) * seite.werte.konditionMod;
        if (min > 70) verlust *= 1.2;
        seite.frische[pid] = Util.clamp((seite.frische[pid] || 100) - verlust, 25, 100);
      });
    });
    /* Alle zehn Minuten neu bewerten - so wirkt die Muedigkeit sichtbar. */
    if (min % 10 === 0) {
      m.heim.werte = teamWerte(m.heim, m.spieler);
      m.gast.werte = teamWerte(m.gast, m.spieler);
      berechneXG(m);
    }

    var ende = m.endeMinute || 90;
    if (min >= ende) {
      if (!m.nachspielzeit) m.nachspielzeit = m.rng.int(1, 6);
      if (min >= ende + m.nachspielzeit) {
        abpfiff(m);
      }
    }
    return m.ereignisse.slice(vorher);
  }

  function abpfiff(m) {
    if (m.beendet) return;
    m.beendet = true;
    var min = m.minute;
    ereignis(m, 'abpfiff', min, 'Abpfiff. Endstand: ' + m.heim.tore + ':' + m.gast.tore + '.');
    /* Noten abschliessen: Ergebnisbonus und Zufall. */
    [[m.heim, m.gast], [m.gast, m.heim]].forEach(function (paar) {
      var s = paar[0], geg = paar[1];
      var diff = s.tore - geg.tore;
      var bonus = diff > 0 ? -0.32 : (diff < 0 ? 0.32 : 0);
      if (Math.abs(diff) >= 3) bonus *= 1.5;
      Object.keys(s.eingesetzt).forEach(function (pid) {
        var e = s.eingesetzt[pid];
        var zufall = m.rng.gauss(0, 0.45, -1.1, 1.1);
        e.note = Util.clamp(e.note + bonus + zufall, 1.0, 6.0);
        e.note = Math.round(e.note * 10) / 10;
      });
      /* Torwart bei Zu-Null belohnen */
      if (geg.tore === 0 && s.elf.length) {
        var twId = s.elf.filter(function (pid) {
          var p = m.spieler[pid]; return p && p.pos === 'TW';
        })[0];
        if (twId && s.eingesetzt[twId]) {
          s.eingesetzt[twId].note = Math.round(Util.clamp(s.eingesetzt[twId].note - 0.6, 1, 6) * 10) / 10;
        }
      }
    });
  }

  /* Verlaengerung im Pokal: zweimal fuenfzehn Minuten. */
  function verlaengern(m) {
    m.beendet = false;
    m.endeMinute = 120;
    m.nachspielzeit = 0;
    ereignis(m, 'info', 90, 'Es geht in die Verlängerung. Stand: ' + m.heim.tore + ':' + m.gast.tore + '.');
    return m;
  }

  /* Elfmeterschiessen: fuenf Schuetzen je Mannschaft, danach K.-o. */
  function elfmeterschiessen(m) {
    function quote(seite, gegner) {
      var schuetzen = seite.elf.map(function (pid) { return m.spieler[pid]; })
        .filter(function (p) { return p && p.pos !== 'TW'; })
        .sort(function (a, b) { return (b.attrs.abschluss || 0) - (a.attrs.abschluss || 0); });
      var twId = gegner.elf.filter(function (pid) {
        var p = m.spieler[pid]; return p && p.pos === 'TW';
      })[0];
      var tw = twId ? m.spieler[twId] : null;
      return { schuetzen: schuetzen, tw: tw };
    }
    var h = quote(m.heim, m.gast), g2 = quote(m.gast, m.heim);
    function schuss(seite, i) {
      var p = seite.schuetzen[i % Math.max(1, seite.schuetzen.length)];
      var basis = 0.74 + ((p ? p.attrs.abschluss : 50) - 60) * 0.003 -
        (seite.tw ? ((seite.tw.attrs.reflexe || 50) - 60) * 0.002 : 0);
      /* Mit jedem Durchgang steigt der Druck. */
      basis -= Math.min(0.1, i * 0.012);
      return m.rng.next() < Util.clamp(basis, 0.5, 0.9);
    }
    var th = 0, tg = 0, i = 0;
    for (i = 0; i < 5; i++) {
      if (schuss(h, i)) th++;
      if (schuss(g2, i)) tg++;
      /* Vorzeitige Entscheidung */
      if (th > tg + (5 - i - 1) || tg > th + (5 - i - 1)) break;
    }
    while (th === tg && i < 20) {
      i++;
      var a = schuss(h, i), b = schuss(g2, i);
      if (a) th++;
      if (b) tg++;
    }
    return { heim: th, gast: tg, text: th + ':' + tg + ' nach Elfmeterschießen' };
  }

  function restSimulieren(m) {
    var wache = 0;
    while (!m.beendet && wache++ < 400) minute(m);
    return m;
  }

  /* Wechsel waehrend des Spiels. */
  function wechsel(m, seiteName, rausId, reinId) {
    var seite = seiteName === 'heim' ? m.heim : m.gast;
    if (seite.wechsel >= 5) return { ok: false, grund: 'Alle fünf Wechsel sind aufgebraucht.' };
    var idx = seite.elf.indexOf(rausId);
    if (idx < 0) return { ok: false, grund: 'Der Spieler steht nicht auf dem Platz.' };
    var bidx = seite.bank.indexOf(reinId);
    if (bidx < 0) return { ok: false, grund: 'Der Spieler sitzt nicht auf der Bank.' };
    seite.elf[idx] = reinId;
    seite.bank.splice(bidx, 1);
    seite.raus.push(rausId);
    seite.wechsel++;
    if (seite.eingesetzt[rausId]) seite.eingesetzt[rausId].bis = m.minute;
    seite.eingesetzt[reinId] = { von: m.minute, bis: 90, note: 3.5, tore: 0, vorlagen: 0 };
    /* Frisch von der Bank - genau darum lohnen sich Wechsel. */
    var einP = m.spieler[reinId];
    if (einP) seite.frische[reinId] = einP.fitness;
    seite.werte = teamWerte(seite, m.spieler);
    berechneXG(m);
    ereignis(m, 'wechsel', m.minute, 'Wechsel: ' + spielerName(m, reinId) + ' kommt für ' + spielerName(m, rausId) + '.', seite, reinId, { raus: rausId });
    return { ok: true };
  }

  function taktikAendern(m, seiteName, taktik) {
    var seite = seiteName === 'heim' ? m.heim : m.gast;
    Object.keys(taktik).forEach(function (k) { seite.taktik[k] = taktik[k]; });
    seite.werte = teamWerte(seite, m.spieler);
    berechneXG(m);
    ereignis(m, 'taktik', m.minute, 'Taktikumstellung: ' + (MENTALITAET[seite.taktik.mentalitaet] || {}).name + '.', seite);
  }

  /* Automatische Wechsel fuer die KI (und fuer den Spieler auf Wunsch). */
  function autoWechsel(m, seiteName, heute) {
    var seite = seiteName === 'heim' ? m.heim : m.gast;
    if (seite.wechsel >= 3) return;
    if (m.minute < 55) return;
    if (!seite.bank.length) return;
    /* Muede oder schwache Spieler raus. */
    var kandidaten = seite.elf.map(function (pid) {
      var p = m.spieler[pid];
      if (!p || p.pos === 'TW') return null;
      var e = seite.eingesetzt[pid];
      var frisch = seite.frische ? (seite.frische[pid] || p.fitness) : p.fitness;
      var muedigkeit = 100 - frisch + (m.minute - (e ? e.von : 0)) * 0.3;
      return { pid: pid, wert: muedigkeit + (e ? e.note * 4 : 0) };
    }).filter(Boolean).sort(function (a, b) { return b.wert - a.wert; });
    if (!kandidaten.length) return;
    var raus = kandidaten[0].pid;
    var rausP = m.spieler[raus];
    var beste = null, besteW = -1;
    seite.bank.forEach(function (pid) {
      var p = m.spieler[pid];
      if (!p || p.pos === 'TW') return;
      var w = wirkung(p, rausP.pos);
      if (w > besteW) { besteW = w; beste = pid; }
    });
    if (beste && besteW > wirkung(rausP, rausP.pos, seite.frische[raus]) * 0.86) {
      wechsel(m, seiteName, raus, beste);
    }
  }

  g.Match = {
    FORMATIONEN: FORMATIONEN,
    MENTALITAET: MENTALITAET,
    PRESSING: PRESSING,
    SPIELWEISE: SPIELWEISE,
    standardTaktik: standardTaktik,
    wirkung: wirkung,
    elfmeter: elfmeter,
    autoAufstellung: autoAufstellung,
    teamWerte: teamWerte,
    seiteAufbauen: seiteAufbauen,
    neu: neu,
    minute: minute,
    restSimulieren: restSimulieren,
    verlaengern: verlaengern,
    elfmeterschiessen: elfmeterschiessen,
    wechsel: wechsel,
    taktikAendern: taktikAendern,
    autoWechsel: autoWechsel,
    abpfiff: abpfiff
  };
})(typeof window !== 'undefined' ? window : globalThis);
