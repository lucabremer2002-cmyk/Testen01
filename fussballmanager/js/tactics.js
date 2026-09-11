/*
 * tactics.js - Formation, Aufstellung, Rollen und Mannschaftsstaerke.
 *
 * Die Spielsimulation bekommt von hier ein Objekt mit den Kennzahlen
 * eines Teams (Torwart, Abwehr, Mittelfeld, Angriff plus eine Reihe
 * taktischer Modifikatoren). Alles, was ein Trainer einstellen kann,
 * schlaegt sich in diesen Zahlen nieder.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;

  // Referenzsummen des 4-2-3-1, an dem alle anderen Formationen gemessen
  // werden. Wuerde man stur durch diese Werte teilen, waere eine
  // Fuenferkette defensiv unschlagbar und offensiv wertlos. Deshalb wird
  // geometrisch zwischen der Referenz und der eigenen Rollensumme gemischt:
  // FORM_GEWICHT gibt an, wie stark die Formation durchschlaegt.
  var REF_DEF = 5.28;
  var REF_MID = 3.40;
  var REF_ATT = 3.88;
  var FORM_GEWICHT = 0.34;

  // ------------------------------------------------------------ Taktik anlegen

  function standardAnweisungen() {
    return {
      mentalitaet: 'ausgeglichen',
      pressing: 'mittel',
      abwehrlinie: 'normal',
      aufbau: 'gemischt',
      tempo: 'normal',
      breite: 'normal',
      gegenpressing: 'normal',
      zweikampf: 'normal',
      zeitspiel: 'aus'
    };
  }

  /** Standardrolle eines Slots (die erste in der Liste). */
  function standardRolle(pos) {
    var liste = D.ROLLEN[pos] || D.ROLLEN.ZM;
    return liste[0].id;
  }

  function rolleFinden(pos, id) {
    var liste = D.ROLLEN[pos] || D.ROLLEN.ZM;
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  function neueTaktik(formationName) {
    var f = D.FORMATIONEN[formationName] || D.FORMATIONEN['4-2-3-1'];
    return {
      formation: f.name,
      rollen: f.slots.map(function (s) { return standardRolle(s.pos); }),
      aufstellung: new Array(f.slots.length).fill(null),
      bank: [],
      anweisungen: standardAnweisungen(),
      standards: { ecken: null, freistoss: null, elfmeter: null, einwurf: null },
      kapitaen: null,
      vizekapitaen: null,
      einspielgrad: 45,        // 0-100, waechst bei stabiler Aufstellung
      letzteElf: []
    };
  }

  // ------------------------------------------------------------ Vorlagen

  var MAX_VORLAGEN = 6;

  /**
   * Eine Taktikvorlage haelt fest, wie gespielt werden soll - Formation,
   * Rollen und Anweisungen -, nicht mit wem. Die Aufstellung bleibt beim
   * Anwenden erhalten, soweit die Positionen passen.
   */
  function vorlageAus(taktik, name) {
    return {
      name: name,
      formation: taktik.formation,
      rollen: taktik.rollen.slice(),
      anweisungen: U.clone(taktik.anweisungen)
    };
  }

  function vorlageAnwenden(taktik, vorlage) {
    if (!vorlage) return taktik;
    if (vorlage.formation !== taktik.formation) {
      setzeFormation(taktik, vorlage.formation);
    }
    var f = formation(taktik);
    taktik.rollen = f.slots.map(function (slot, i) {
      var r = vorlage.rollen[i];
      return r && rolleFinden(slot.pos, r) ? r : standardRolle(slot.pos);
    });
    Object.keys(vorlage.anweisungen).forEach(function (k) {
      taktik.anweisungen[k] = vorlage.anweisungen[k];
    });
    return taktik;
  }

  function vorlageSpeichern(world, taktik, name) {
    if (!world.taktikVorlagen) world.taktikVorlagen = [];
    name = (name || '').trim() || ('Vorlage ' + (world.taktikVorlagen.length + 1));
    var neu = vorlageAus(taktik, name);
    var vorhanden = world.taktikVorlagen.filter(function (v) { return v.name === name; })[0];
    if (vorhanden) {
      world.taktikVorlagen[world.taktikVorlagen.indexOf(vorhanden)] = neu;
    } else {
      world.taktikVorlagen.push(neu);
      if (world.taktikVorlagen.length > MAX_VORLAGEN) world.taktikVorlagen.shift();
    }
    return neu;
  }

  function vorlageLoeschen(world, name) {
    if (!world.taktikVorlagen) return;
    world.taktikVorlagen = world.taktikVorlagen.filter(function (v) { return v.name !== name; });
  }

  function formation(taktik) {
    return D.FORMATIONEN[taktik.formation] || D.FORMATIONEN['4-2-3-1'];
  }

  /** Wechselt die Formation und behaelt passende Spieler auf ihren Slots. */
  function setzeFormation(taktik, name) {
    var alt = formation(taktik);
    var altElf = taktik.aufstellung.slice();
    var neu = D.FORMATIONEN[name];
    if (!neu) return taktik;
    taktik.formation = neu.name;
    taktik.rollen = neu.slots.map(function (s) { return standardRolle(s.pos); });
    var frei = altElf.filter(function (id) { return !!id; });
    taktik.aufstellung = neu.slots.map(function (s) {
      // Spieler, der vorher auf gleicher Position stand, bleibt dort.
      for (var i = 0; i < alt.slots.length; i++) {
        if (alt.slots[i].pos === s.pos && altElf[i] && frei.indexOf(altElf[i]) >= 0) {
          var id = altElf[i];
          frei.splice(frei.indexOf(id), 1);
          altElf[i] = null;
          return id;
        }
      }
      return null;
    });
    // Reste auffuellen
    for (var i = 0; i < taktik.aufstellung.length; i++) {
      if (!taktik.aufstellung[i] && frei.length) taktik.aufstellung[i] = frei.shift();
    }
    taktik.einspielgrad = Math.max(20, taktik.einspielgrad - 22);
    return taktik;
  }

  // ------------------------------------------------------------ Aufstellung

  /**
   * Darf der Spieler in diesem Wettbewerb auflaufen? Sperren gelten nur
   * fuer den Wettbewerb, in dem sie ausgesprochen wurden.
   */
  function einsatzbereit(p, world, wettbewerb) {
    if (!p) return false;
    if (p.verletzung) return false;
    if (p.fitness < 20) return false;
    if (p.sperre > 0) {
      var art = wettbewerbsart(wettbewerb);
      if (!art || p.sperreWettbewerb === art) return false;
    }
    // Leihspieler duerfen laut Vertrag nicht gegen den eigenen Verein spielen.
    return true;
  }

  /** Ordnet einen Wettbewerb der Sperrenkategorie zu. */
  function wettbewerbsart(wettbewerb) {
    if (!wettbewerb) return null;
    if (wettbewerb === 'liga' || wettbewerb === 'relegation') return 'liga';
    if (wettbewerb === 'europa' || wettbewerb === 'europaKo') return 'europa';
    if (wettbewerb === 'test') return null;
    return 'pokal';
  }

  /**
   * Sucht die beste Elf. Es wird wiederholt das Paar (Slot, Spieler) mit
   * dem hoechsten Wert gewaehlt - ein gieriges Verfahren, das in der
   * Praxis nahezu immer die optimale Zuordnung findet.
   */
  function autoAufstellung(world, club, taktik, opts) {
    opts = opts || {};
    var f = formation(taktik);
    var kader = world.kaderVon(club.id).filter(function (p) {
      return einsatzbereit(p, world, opts.wettbewerb)
        && (!opts.ausschluss || opts.ausschluss.indexOf(p.id) < 0);
    });
    if (!kader.length) return taktik;

    var slots = f.slots.map(function (s, i) { return { i: i, pos: s.pos }; });
    var vergeben = {};
    var elf = new Array(f.slots.length).fill(null);

    // Bewertungsmatrix
    function wert(p, pos, slotIdx) {
      var basis = P.tagesform(p, pos);
      // Rollenpassung: wie gut passen die Kernattribute zur gewaehlten Rolle
      var r = rolleFinden(pos, taktik.rollen[slotIdx]);
      var bonus = 0;
      if (r.attrs) {
        for (var i = 0; i < r.attrs.length; i++) bonus += (p.attr[r.attrs[i]] - 50) * 0.06;
      }
      // Schonung: mueden Spielern wird ein Malus gegeben
      if (p.fitness < 70) basis *= 0.90;
      return basis + bonus;
    }

    for (var n = 0; n < slots.length; n++) {
      var best = null;
      for (var si = 0; si < slots.length; si++) {
        var s = slots[si];
        if (elf[s.i]) continue;
        for (var pi = 0; pi < kader.length; pi++) {
          var p = kader[pi];
          if (vergeben[p.id]) continue;
          var w = wert(p, s.pos, s.i);
          // Torwartslot nur mit Torwart, Feldslot nicht mit Torwart
          if (s.pos === 'TW' && p.pos !== 'TW') w -= 45;
          if (s.pos !== 'TW' && p.pos === 'TW') w -= 45;
          if (!best || w > best.w) best = { w: w, slot: s.i, p: p };
        }
      }
      if (!best) break;
      elf[best.slot] = best.p.id;
      vergeben[best.p.id] = true;
    }

    taktik.aufstellung = elf;
    taktik.bank = waehleBank(world, club, taktik, kader, vergeben);
    setzeStandardschuetzen(world, taktik);
    setzeKapitaen(world, club, taktik);
    return taktik;
  }

  /** Bank: ein Torwart, dann die besten Spieler mit Blick auf die Abdeckung. */
  function waehleBank(world, club, taktik, kader, vergeben) {
    var rest = kader.filter(function (p) { return !vergeben[p.id]; });
    var bank = [];
    var tw = U.sortBy(rest.filter(function (p) { return p.pos === 'TW'; }),
      function (p) { return -P.gesamt(p); })[0];
    if (tw) { bank.push(tw.id); rest = rest.filter(function (p) { return p.id !== tw.id; }); }

    // Je Mannschaftsteil mindestens eine Alternative
    ['ABW', 'MIT', 'ANG'].forEach(function (gruppe) {
      var kand = U.sortBy(rest.filter(function (p) { return D.POS_GRUPPE[p.pos] === gruppe; }),
        function (p) { return -P.tagesform(p); });
      for (var i = 0; i < Math.min(2, kand.length); i++) {
        if (bank.length >= 9) return;
        bank.push(kand[i].id);
        rest = rest.filter(function (p) { return p.id !== kand[i].id; });
      }
    });

    U.sortBy(rest, function (p) { return -P.tagesform(p); }).forEach(function (p) {
      if (bank.length < 9) bank.push(p.id);
    });
    return bank;
  }

  function setzeStandardschuetzen(world, taktik) {
    var elf = taktik.aufstellung.filter(Boolean).map(function (id) { return world.spieler[id]; })
      .filter(Boolean);
    if (!elf.length) return;
    function bester(fn) { return U.sortBy(elf, fn, true)[0]; }
    var s = taktik.standards;
    var e = bester(function (p) { return p.attr.elfmeter * 1.4 + p.attr.nervenstaerke * 0.7 + p.attr.abschluss * 0.4; });
    var f = bester(function (p) { return p.attr.standards * 1.5 + p.attr.weitschuss * 0.6 + p.attr.technik * 0.3; });
    var c = bester(function (p) { return p.attr.standards * 1.3 + p.attr.flanken * 1.0 + p.attr.uebersicht * 0.3; });
    var w = bester(function (p) { return p.attr.kraft * 0.8 + p.attr.flanken * 0.6; });
    s.elfmeter = e ? e.id : null;
    s.freistoss = f ? f.id : null;
    s.ecken = c ? c.id : null;
    s.einwurf = w ? w.id : null;
  }

  function setzeKapitaen(world, club, taktik) {
    var kader = world.kaderVon(club.id);
    if (!kader.length) return;
    var rang = U.sortBy(kader, function (p) {
      return -(p.attr.fuehrung * 1.8 + p.attr.disziplin * 0.6 + p.attr.teamwork * 0.5
        + P.gesamt(p) * 0.7 + p.alter * 1.4 + (p.kapitaen ? 40 : 0));
    });
    taktik.kapitaen = rang[0] ? rang[0].id : null;
    taktik.vizekapitaen = rang[1] ? rang[1].id : null;
  }

  /**
   * Bereitet die Aufstellung fuer ein konkretes Spiel vor.
   * KI-Vereine stellen komplett neu auf. Beim Verein des Nutzers bleibt
   * dessen Aufstellung erhalten, nicht einsatzfaehige Spieler werden
   * jedoch durch die beste verfuegbare Alternative ersetzt.
   */
  function aufstellungVorbereiten(world, clubId, wettbewerb, erzwingeAuto) {
    var club = world.vereine[clubId];
    if (!club) return null;
    var taktik = world.taktikVon(clubId);
    var f = formation(taktik);

    if (erzwingeAuto) {
      autoAufstellung(world, club, taktik, { wettbewerb: wettbewerb });
      return taktik;
    }

    // Ungueltige Besetzungen ausräumen
    var belegt = {};
    var luecken = [];
    for (var i = 0; i < f.slots.length; i++) {
      var id = taktik.aufstellung[i];
      var p = id ? world.spieler[id] : null;
      var ok = p && p.clubId === clubId && einsatzbereit(p, world, wettbewerb) && !belegt[id];
      if (ok) { belegt[id] = true; }
      else { taktik.aufstellung[i] = null; luecken.push(i); }
    }
    // Bank bereinigen
    taktik.bank = (taktik.bank || []).filter(function (bid) {
      var bp = world.spieler[bid];
      return bp && bp.clubId === clubId && einsatzbereit(bp, world, wettbewerb) && !belegt[bid];
    });

    if (luecken.length) {
      var verfuegbar = world.kaderVon(clubId).filter(function (x) {
        return einsatzbereit(x, world, wettbewerb) && !belegt[x.id];
      });
      luecken.forEach(function (slotIdx) {
        var pos = f.slots[slotIdx].pos;
        var kandidaten = verfuegbar.filter(function (x) {
          return pos === 'TW' ? x.pos === 'TW' : x.pos !== 'TW';
        });
        if (!kandidaten.length) kandidaten = verfuegbar;
        var beste = U.sortBy(kandidaten, function (x) { return -P.tagesform(x, pos); })[0];
        if (!beste) return;
        taktik.aufstellung[slotIdx] = beste.id;
        belegt[beste.id] = true;
        verfuegbar = verfuegbar.filter(function (x) { return x.id !== beste.id; });
        taktik.bank = taktik.bank.filter(function (bid) { return bid !== beste.id; });
      });
    }

    // Bank auffuellen
    var aufBank = {};
    taktik.bank.forEach(function (bid) { aufBank[bid] = true; });
    var rest = world.kaderVon(clubId).filter(function (x) {
      return einsatzbereit(x, world, wettbewerb) && !belegt[x.id] && !aufBank[x.id];
    });
    var hatTW = taktik.bank.some(function (bid) {
      var bp = world.spieler[bid];
      return bp && bp.pos === 'TW';
    });
    if (!hatTW) {
      var tw = U.sortBy(rest.filter(function (x) { return x.pos === 'TW'; }),
        function (x) { return -P.gesamt(x); })[0];
      if (tw) { taktik.bank.unshift(tw.id); rest = rest.filter(function (x) { return x.id !== tw.id; }); }
    }
    U.sortBy(rest, function (x) { return -P.tagesform(x); }).forEach(function (x) {
      if (taktik.bank.length < 9) taktik.bank.push(x.id);
    });
    taktik.bank = taktik.bank.slice(0, 9);

    // Standardschuetzen und Kapitaen an die Elf anpassen
    var elfIds = taktik.aufstellung.filter(Boolean);
    ['ecken', 'freistoss', 'elfmeter', 'einwurf'].forEach(function (k) {
      if (elfIds.indexOf(taktik.standards[k]) < 0) taktik.standards[k] = null;
    });
    if (!taktik.standards.elfmeter) setzeStandardschuetzen(world, taktik);
    if (elfIds.indexOf(taktik.kapitaen) < 0 && elfIds.length) {
      var fuehrer = U.sortBy(elfIds.map(function (id) { return world.spieler[id]; }).filter(Boolean),
        function (x) { return -(x.attr.fuehrung * 1.6 + x.alter); })[0];
      if (fuehrer) taktik.kapitaen = fuehrer.id;
    }
    return taktik;
  }

  /** Prueft, ob die Aufstellung gueltig ist. Liefert eine Liste von Problemen. */
  function pruefeAufstellung(world, club, taktik) {
    var probleme = [];
    var f = formation(taktik);
    var gesehen = {};
    var anzahl = 0;
    for (var i = 0; i < f.slots.length; i++) {
      var id = taktik.aufstellung[i];
      if (!id) { probleme.push('Slot ' + (i + 1) + ' (' + f.slots[i].pos + ') ist unbesetzt.'); continue; }
      var p = world.spieler[id];
      if (!p) { probleme.push('Unbekannter Spieler auf Slot ' + (i + 1) + '.'); continue; }
      if (gesehen[id]) { probleme.push(p.nachname + ' ist doppelt aufgestellt.'); continue; }
      gesehen[id] = true;
      anzahl++;
      if (p.verletzung) probleme.push(p.nachname + ' ist verletzt (' + p.verletzung.name + ').');
      if (p.sperre > 0) probleme.push(p.nachname + ' ist gesperrt.');
      if (p.clubId !== club.id) probleme.push(p.nachname + ' gehört nicht zum Kader.');
    }
    if (anzahl !== 11) probleme.push('Es müssen genau 11 Spieler aufgestellt sein (aktuell ' + anzahl + ').');
    var tws = 0;
    for (i = 0; i < f.slots.length; i++) {
      if (f.slots[i].pos === 'TW' && taktik.aufstellung[i]) {
        var t = world.spieler[taktik.aufstellung[i]];
        if (t && t.pos === 'TW') tws++;
      }
    }
    if (!tws) probleme.push('Kein gelernter Torwart im Tor.');
    return probleme;
  }

  // ------------------------------------------------------------ Mannschaftsstaerke

  function anweisung(kategorie, id) {
    var liste = D.ANWEISUNGEN[kategorie].werte;
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return liste[0];
  }

  /**
   * Berechnet alle Kennzahlen einer Mannschaft fuer ein konkretes Spiel.
   * ctx: { world, club, taktik, heim, wetter, personal, moralBonus }
   */
  function bewerteMannschaft(ctx) {
    var world = ctx.world, club = ctx.club, taktik = ctx.taktik;
    var f = formation(taktik);
    var an = taktik.anweisungen;

    var mentalitaet = anweisung('mentalitaet', an.mentalitaet);
    var pressing = anweisung('pressing', an.pressing);
    var linie = anweisung('abwehrlinie', an.abwehrlinie);
    var aufbau = anweisung('aufbau', an.aufbau);
    var tempo = anweisung('tempo', an.tempo);
    var breite = anweisung('breite', an.breite);
    var gegenpressing = anweisung('gegenpressing', an.gegenpressing);
    var zweikampf = anweisung('zweikampf', an.zweikampf);
    var zeitspiel = anweisung('zeitspiel', an.zeitspiel);

    var defSum = 0, midSum = 0, attSum = 0;
    var rohDef = 0, rohMid = 0, rohAtt = 0;
    var twWert = 45;
    var kreativ = 0, kopfball = 0, tempoWert = 0, standards = 0, disziplin = 0;
    var erfahrung = 0, fuehrung = 0, moral = 0, fitness = 0, arbeitsrate = 0;
    var aufbauQualitaet = 0, konterWert = 0, pressingWert = 0;
    var spieler = [];

    for (var i = 0; i < f.slots.length; i++) {
      var slot = f.slots[i];
      var id = taktik.aufstellung[i];
      var p = id ? world.spieler[id] : null;
      if (!p) continue;
      var rolle = rolleFinden(slot.pos, taktik.rollen[i]);
      var kraft = P.tagesform(p, slot.pos);

      // Rollenpassung: passende Kernattribute geben bis zu +6 %
      var passung = 1;
      if (rolle.attrs) {
        var b = 0;
        for (var a = 0; a < rolle.attrs.length; a++) b += (p.attr[rolle.attrs[a]] - 55);
        passung += U.clamp(b / rolle.attrs.length / 400, -0.06, 0.08);
      }
      kraft *= passung;

      spieler.push({ p: p, slot: slot, rolle: rolle, kraft: kraft, index: i });

      if (slot.pos === 'TW') {
        twWert = kraft * (rolle.def || 1);
        aufbauQualitaet += p.attr.passen * 0.4 * (rolle.aufbau || 1);
      } else {
        defSum += kraft * (rolle.def || 0);
        midSum += kraft * (rolle.mid || 0);
        attSum += kraft * (rolle.att || 0);
        rohDef += (rolle.def || 0);
        rohMid += (rolle.mid || 0);
        rohAtt += (rolle.att || 0);
        kreativ += (p.attr.uebersicht * 0.5 + p.attr.passen * 0.3 + p.attr.technik * 0.2)
          * (rolle.kreativ || 1) * ((rolle.mid || 0) + (rolle.att || 0)) * 0.35;
        kopfball += p.attr.kopfball * (rolle.kopfball || 1) * ((rolle.att || 0) + (rolle.def || 0) * 0.5) * 0.30;
        tempoWert += (p.attr.tempo * 0.6 + p.attr.antritt * 0.4) * ((rolle.att || 0) + (rolle.mid || 0) * 0.4) * 0.35;
        aufbauQualitaet += p.attr.passen * (rolle.aufbau || 1) * ((rolle.mid || 0) + (rolle.def || 0) * 0.4) * 0.25;
        konterWert += (p.attr.tempo * 0.5 + p.attr.entscheidung * 0.3 + p.attr.technik * 0.2)
          * (rolle.konter || 1) * (rolle.att || 0) * 0.5;
        pressingWert += (p.attr.arbeitsrate * 0.6 + p.attr.aggressivitaet * 0.4)
          * (rolle.pressing || 1) * 0.1;
        standards += p.attr.standards * 0.05;
        arbeitsrate += p.attr.arbeitsrate;
      }
      disziplin += p.attr.disziplin;
      erfahrung += Math.min(p.alter, 33) + p.karriere.spiele * 0.02;
      fuehrung += p.attr.fuehrung * (p.id === taktik.kapitaen ? 2.2 : 1);
      moral += p.moral;
      fitness += p.fitness;
    }

    var n = Math.max(1, spieler.length);

    // Besondere Eigenschaften, die auf die ganze Mannschaft wirken.
    var mk = { antreiber: 0, pressingmaschine: 0, zweikampfmonster: 0,
      strafraumbeherrscher: 0, mitspielenderTorwart: 0 };
    spieler.forEach(function (x) {
      var p = x.p || x;
      var liste = p && p.merkmale;
      if (!liste || !liste.length) return;
      if (liste.indexOf('antreiber') >= 0) mk.antreiber += 1;
      if (liste.indexOf('pressingmaschine') >= 0) mk.pressingmaschine += 1;
      if (liste.indexOf('zweikampfmonster') >= 0) mk.zweikampfmonster += 1;
      if (p.pos === 'TW' && liste.indexOf('strafraumbeherrscher') >= 0) mk.strafraumbeherrscher = 1;
      if (p.pos === 'TW' && liste.indexOf('mitspielender_torwart') >= 0) mk.mitspielenderTorwart = 1;
    });

    // Qualitaet je Mannschaftsteil: gewichteter Mittelwert der Spieler, die
    // dort ueberhaupt etwas beitragen. Damit haengt der Wert an der Klasse
    // der Spieler, nicht an der Zahl der besetzten Rollen.
    var qDef = defSum / Math.max(0.05, rohDef);
    var qMid = midSum / Math.max(0.05, rohMid);
    var qAtt = attSum / Math.max(0.05, rohAtt);

    // Formationsform: wie stark ist eine Zone im Vergleich zur Referenz
    // besetzt. Das geometrische Mittel wird auf 1 normiert, damit eine
    // Formation nicht insgesamt staerker oder schwaecher macht, sondern nur
    // Schwerpunkte verschiebt.
    var sd = rohDef / REF_DEF, sm = rohMid / REF_MID, sa = rohAtt / REF_ATT;
    var geo = Math.pow(Math.max(0.01, sd * sm * sa), 1 / 3);
    sd /= geo; sm /= geo; sa /= geo;

    var def = qDef * Math.pow(sd, FORM_GEWICHT);
    var mid = qMid * Math.pow(sm, FORM_GEWICHT);
    var att = qAtt * Math.pow(sa, FORM_GEWICHT);

    // ---- Eigenschaften der Spieler
    // Antreiber heben die Mannschaft, wenn es zaeh wird; Zweikampfmonster
    // stabilisieren die Defensive; ein Torwart, der den Strafraum
    // beherrscht, entschaerft Flanken und Ecken.
    def *= 1 + Math.min(3, mk.zweikampfmonster) * 0.012 + mk.strafraumbeherrscher * 0.018;
    mid *= 1 + Math.min(3, mk.antreiber) * 0.010 + mk.mitspielenderTorwart * 0.012;

    // ---- Formationsmerkmale
    def *= (0.94 + f.kompaktheit * 0.06);
    mid *= (0.96 + (f.ballbesitz || 1) * 0.04);

    // ---- Anweisungen
    att *= mentalitaet.att * tempo.chancen;
    def *= mentalitaet.def;
    def *= (linie.raumHinten > 1 ? 1.03 : linie.raumHinten < 1 ? 1.05 : 1.0);   // beides hat Vorteile
    att *= aufbau.chancenQualitaet;
    mid *= aufbau.ballbesitz * tempo.ballbesitz;

    // ---- Einspielgrad und Moral der Mannschaft
    var einspiel = 0.94 + (taktik.einspielgrad / 100) * 0.10;
    var moralF = 0.95 + (moral / n / 100) * 0.10;
    def *= einspiel * moralF;
    mid *= einspiel * moralF;
    att *= einspiel * moralF;

    // ---- Personal (Co-Trainer, Analysten) hebt die Umsetzung leicht an
    var staffB = ctx.staffBonus || 1;
    def *= staffB; mid *= staffB; att *= staffB;

    // ---- Kabinenklima
    // Eine geschlossene Kabine traegt, eine zerrissene kostet. Gewichtet
    // wird nach Einfluss: Ein unzufriedener Wortfuehrer wiegt schwerer
    // als drei zufriedene Ergaenzungsspieler.
    if (ctx.world && ctx.club && ctx.world.klimaWerte) {
      var kw = ctx.world.klimaWerte[ctx.club.id];
      if (kw && kw.faktor) { att *= kw.faktor; def *= kw.faktor; mid *= kw.faktor; twWert *= kw.faktor; }
    }

    // ---- Heimvorteil
    if (ctx.heim) {
      var kulisse = ctx.stimmung !== undefined ? ctx.stimmung : 0.75;
      // Der Heimvorteil wirkt auf alle Mannschaftsteile. Wuerde nur der
      // Angriff profitieren, wuerde die Heimmannschaft zwar mehr Tore
      // schiessen, aber genauso viele kassieren - unterm Strich ohne Wirkung
      // auf das Ergebnis. Auf die Abwehr wirkt er nur zur Haelfte: eine
      // Mannschaft verteidigt auswaerts kaum schlechter, sie kommt vorne
      // seltener durch.
      var heimF = 1.058 + kulisse * 0.050;
      att *= heimF; mid *= heimF; def *= 1 + (heimF - 1) * 0.45;
    }

    // ---- Wetter
    if (ctx.wetter) {
      att *= ctx.wetter.tempo;
      mid *= (1 - (ctx.wetter.fehler - 1) * 0.20);
    }

    return {
      club: club,
      taktik: taktik,
      formation: f,
      spieler: spieler,
      tw: twWert,
      def: Math.max(5, def),
      mid: Math.max(5, mid),
      att: Math.max(5, att),
      kreativ: kreativ,
      kopfball: kopfball * (aufbau.kopfball || 1) * (linie.kopfballDruck || 1),
      tempo: tempoWert,
      konter: konterWert * (f.konter || 1) * (an.mentalitaet === 'defensiv' || an.mentalitaet === 'abwartend' ? 1.15 : 1),
      pressing: pressingWert * pressing.ballgewinnHoch * (gegenpressing.rueckgewinn || 1)
        * (1 + Math.min(4, mk.pressingmaschine) * 0.020),
      merkmale: mk,
      standards: standards,
      disziplin: disziplin / n,
      erfahrung: erfahrung / n,
      fuehrung: fuehrung / n,
      moral: moral / n,
      fitness: fitness / n,
      arbeitsrate: arbeitsrate / Math.max(1, n - 1),
      aufbau: aufbauQualitaet * (1 + mk.mitspielenderTorwart * 0.030),
      // Modifikatoren, die die Simulation direkt braucht
      mod: {
        konterAnfaellig: (pressing.konterAnfaellig || 1) * (gegenpressing.konterAnfaellig || 1)
          * (linie.raumHinten || 1),
        abseits: linie.abseits || 1,
        ballbesitz: aufbau.ballbesitz * tempo.ballbesitz * (zeitspiel.ballbesitz || 1) * (f.ballbesitz || 1),
        chancen: tempo.chancen * mentalitaet.att,
        flanken: breite.flanken * (f.breite || 1),
        zentrum: breite.zentrum,
        foulneigung: zweikampf.foul,
        kartenrisiko: zweikampf.karten * (zeitspiel.karten || 1),
        zweikampf: zweikampf.zweikampf,
        konditionsbedarf: pressing.kondition * tempo.kondition * (gegenpressing.kondition || 1)
          * (ctx.wetter ? ctx.wetter.kondition : 1),
        risiko: aufbau.risiko,
        tempoSpaet: zeitspiel.tempoSpaet || 1,
        mentalitaet: an.mentalitaet
      }
    };
  }

  /**
   * Taktische Wechselwirkungen zwischen zwei Mannschaften.
   * Liefert Faktoren, die auf die Grundwerte angewendet werden.
   */
  function duell(a, b) {
    var out = { attA: 1, attB: 1, konterA: 1, konterB: 1, ballbesitzA: 1 };

    // Hohes Pressing gegen kurzes Aufbauspiel: Ballgewinne in der Gefahrenzone
    var pressA = a.taktik.anweisungen.pressing;
    var pressB = b.taktik.anweisungen.pressing;
    var aufbauA = a.taktik.anweisungen.aufbau;
    var aufbauB = b.taktik.anweisungen.aufbau;

    if ((pressA === 'hoch' || pressA === 'extrem') && aufbauB === 'kurz') {
      var stark = a.pressing / Math.max(1, b.aufbau) ;
      out.attA *= U.clamp(1 + (stark - 1) * 0.10, 0.95, 1.22);
    }
    if ((pressB === 'hoch' || pressB === 'extrem') && aufbauA === 'kurz') {
      var starkB = b.pressing / Math.max(1, a.aufbau);
      out.attB *= U.clamp(1 + (starkB - 1) * 0.10, 0.95, 1.22);
    }
    // Lange Baelle gegen hohe Abwehrlinie
    if (aufbauA === 'lang' && b.taktik.anweisungen.abwehrlinie === 'hoch') out.attA *= 1.10;
    if (aufbauB === 'lang' && a.taktik.anweisungen.abwehrlinie === 'hoch') out.attB *= 1.10;
    // Konterspiel gegen offensive Gegner
    if (b.mod.mentalitaet === 'offensiv' || b.mod.mentalitaet === 'allesoderNichts') {
      out.konterA *= 1.25;
    }
    if (a.mod.mentalitaet === 'offensiv' || a.mod.mentalitaet === 'allesoderNichts') {
      out.konterB *= 1.25;
    }
    // Breite gegen enges Zentrum
    if (a.mod.flanken > 1.1 && b.mod.zentrum > 1.1) out.attA *= 1.06;
    if (b.mod.flanken > 1.1 && a.mod.zentrum > 1.1) out.attB *= 1.06;

    return out;
  }

  /**
   * Wie gut passt ein Spieler auf eine Position? 1 = gelernte Position,
   * darunter greift die Verwandtschaftstabelle.
   */
  function eignung(p, pos) {
    if (!p) return 0;
    if (p.pos === pos) return 1;
    if (p.nebenpos.indexOf(pos) >= 0) return 0.93;
    var v = (D.POS_VERWANDT[p.pos] || {})[pos];
    return v || 0.30;
  }

  function eignungText(wert) {
    if (wert >= 0.99) return 'Stammposition';
    if (wert >= 0.9) return 'Nebenposition';
    if (wert >= 0.75) return 'gut geeignet';
    if (wert >= 0.6) return 'brauchbar';
    if (wert >= 0.45) return 'Notlösung';
    return 'ungeeignet';
  }

  /**
   * Bericht des Spielanalysten über den nächsten Gegner. Wie genau die
   * Angaben sind, hängt an der Qualität der Analyseabteilung.
   */
  function gegneranalyse(world, eigenerClubId, gegnerId) {
    var gegner = world.vereine[gegnerId];
    if (!gegner) return null;
    var stab = world.stabWerteVon(eigenerClubId);
    var genauigkeit = U.clamp(stab.analyst / 100, 0.12, 0.95);
    var taktik = world.taktikVon(gegnerId);
    var werte = bewerteMannschaft({
      world: world, club: gegner, taktik: taktik, heim: false
    });

    var kader = world.kaderVon(gegnerId);
    var schluessel = U.sortBy(kader.filter(function (p) {
      return !p.verletzung && p.sperre === 0;
    }), function (p) {
      return -(P.gesamt(p) + p.stats.tore * 2.5 + p.stats.vorlagen * 1.5);
    })[0];

    var teile = [
      { id: 'def', name: 'Abwehr', wert: werte.def },
      { id: 'mid', name: 'Mittelfeld', wert: werte.mid },
      { id: 'att', name: 'Angriff', wert: werte.att }
    ];
    var sortiert = U.sortBy(teile, function (t) { return -t.wert; });

    var hinweise = [];
    var an = taktik.anweisungen;
    if (an.pressing === 'hoch' || an.pressing === 'extrem') {
      hinweise.push('Presst früh an. Lange Bälle hinter die Kette können den Druck lösen.');
    }
    if (an.abwehrlinie === 'hoch') {
      hinweise.push('Verteidigt mit hoher Linie – schnelle Spieler in der Spitze sind im Vorteil.');
    }
    if (an.abwehrlinie === 'tief' || an.mentalitaet === 'defensiv') {
      hinweise.push('Steht tief und kompakt. Ohne Kreativität im Zentrum wird es zäh.');
    }
    if (an.mentalitaet === 'offensiv' || an.mentalitaet === 'allesoderNichts') {
      hinweise.push('Geht viel Risiko – dahinter öffnen sich Räume für Konter.');
    }
    if (an.breite === 'breit') hinweise.push('Sucht die Breite; die Außenverteidiger brauchen Unterstützung.');
    if (an.breite === 'eng') hinweise.push('Spielt eng durchs Zentrum, die Flügel bleiben oft frei.');
    if (werte.kopfball > 60) hinweise.push('Bei Standards gefährlich in der Luft.');

    var tab = world.tabellenPlatz(gegnerId);
    return {
      club: gegner,
      genauigkeit: genauigkeit,
      formation: genauigkeit > 0.4 ? taktik.formation : null,
      werte: werte,
      teile: teile,
      staerke: sortiert[0],
      schwaeche: sortiert[sortiert.length - 1],
      schluesselspieler: genauigkeit > 0.3 ? schluessel : null,
      hinweise: genauigkeit > 0.35 ? hinweise.slice(0, 3) : [],
      tabelle: tab,
      unschaerfe: Math.round((1 - genauigkeit) * 12)
    };
  }

  /** Aktualisiert den Einspielgrad nach einem Spiel. */
  function aktualisiereEinspielgrad(taktik) {
    var elf = taktik.aufstellung.filter(Boolean);
    var alt = taktik.letzteElf || [];
    var gleich = 0;
    elf.forEach(function (id) { if (alt.indexOf(id) >= 0) gleich++; });
    var quote = alt.length ? gleich / 11 : 0.5;
    var ziel = 30 + quote * 70;
    taktik.einspielgrad = U.clamp(Math.round(taktik.einspielgrad + (ziel - taktik.einspielgrad) * 0.22 + 2), 10, 100);
    taktik.letzteElf = elf.slice();
  }

  FM.tactics = {
    neueTaktik: neueTaktik,
    standardAnweisungen: standardAnweisungen,
    standardRolle: standardRolle,
    rolleFinden: rolleFinden,
    formation: formation,
    setzeFormation: setzeFormation,
    autoAufstellung: autoAufstellung,
    setzeStandardschuetzen: setzeStandardschuetzen,
    setzeKapitaen: setzeKapitaen,
    pruefeAufstellung: pruefeAufstellung,
    aufstellungVorbereiten: aufstellungVorbereiten,
    vorlageAus: vorlageAus,
    vorlageAnwenden: vorlageAnwenden,
    vorlageSpeichern: vorlageSpeichern,
    vorlageLoeschen: vorlageLoeschen,
    MAX_VORLAGEN: MAX_VORLAGEN,
    wettbewerbsart: wettbewerbsart,
    bewerteMannschaft: bewerteMannschaft,
    duell: duell,
    anweisung: anweisung,
    einsatzbereit: einsatzbereit,
    eignung: eignung,
    eignungText: eignungText,
    gegneranalyse: gegneranalyse,
    aktualisiereEinspielgrad: aktualisiereEinspielgrad
  };

})(typeof window !== 'undefined' ? window : globalThis);
