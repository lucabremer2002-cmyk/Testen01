/*
 * transfers.js - Transfermarkt, Verhandlungen, Vertraege, Leihen, Scouting.
 *
 * Ein Transfer laeuft in zwei Stufen: erst einigen sich die Vereine ueber
 * die Abloese, danach der Spieler mit dem neuen Klub ueber den Vertrag.
 * Beide Seiten koennen Gegenangebote machen.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;
  var P = FM.players;
  var F = FM.finance;

  // ------------------------------------------------------------ Grundgeruest

  function neueTransferdaten() {
    return {
      angeboteAus: [],        // Angebote des Nutzers an andere Vereine
      angeboteEin: [],        // Angebote anderer Vereine fuer Nutzerspieler
      verhandlungen: [],      // laufende Vertragsverhandlungen
      beobachtet: [],         // Merkliste
      scoutAuftraege: [],
      scoutnetz: {},
      historie: [],
      geruechte: []
    };
  }

  // Der Kaderstatus ist an einer Stelle beschrieben - hier nur der Zugriff.
  var ROLLENVERSPRECHEN = D.KADERROLLE;

  // ------------------------------------------------------------ Bewertung

  /** Wie gerne wuerde ein Verein diesen Spieler abgeben? 0 = gar nicht, 1 = sofort. */
  function verkaufsbereitschaft(world, p) {
    if (!p.clubId) return 1;
    var club = world.vereine[p.clubId];
    var f = world.finanzen[p.clubId];
    var kader = world.kaderVon(p.clubId);
    var rang = P.kaderRang(p, kader);
    var gleichePos = kader.filter(function (x) {
      return x.id !== p.id && (x.pos === p.pos || x.nebenpos.indexOf(p.pos) >= 0);
    }).length;

    var w = 0.18;
    if (p.transferliste) w += 0.55;
    w += U.clamp((rang - 11) / 26, -0.16, 0.30);          // Reservisten gehen leichter
    w += U.clamp((gleichePos - 1) * 0.06, 0, 0.20);        // Ueberbesetzte Position
    w += (p.wechselwunsch / 100) * 0.35;
    if (p.alter >= 31) w += 0.15;
    if (p.alter <= 20 && p.potenzial - P.gesamt(p) > 12) w -= 0.22;   // Talente behaelt man
    var rest = P.restlaufzeitMonate(p, world);
    if (rest <= 12) w += 0.24;
    if (rest <= 6) w += 0.20;
    if (f && f.kontostand < 0) w += 0.25;                  // Not macht verkaufsbereit
    if (club && club.ruf >= 85 && rang <= 6) w -= 0.20;
    return U.clamp(w, 0, 1);
  }

  /**
   * Was ein angebotener Tauschspieler dem abgebenden Verein wert ist.
   *
   * Nicht sein Marktwert: Ein Verein zahlt fuer einen Spieler, den er
   * nicht braucht, keinen vollen Preis, und das Gehalt haengt ihm danach
   * am Hals. Barmittel sind einem Verein immer lieber als Personal.
   */
  function tauschWert(world, verkaeuferId, p) {
    var club = world.vereine[verkaeuferId];
    if (!club || !p) return 0;
    var wert = P.marktwert(p, world);

    // Grundabschlag: ein Spieler ist kein Geld.
    var faktor = 0.72;

    // Passt die Klasse zum Verein?
    var niveau = P.niveauFuerVerein(club);
    var st = P.gesamt(p);
    if (st < niveau - 10) faktor *= 0.55;             // zu schwach, reine Last
    else if (st > niveau + 8) faktor *= 1.10;         // Verstaerkung

    // Braucht der Verein die Position?
    var kader = world.kaderVon(verkaeuferId);
    var aufPos = kader.filter(function (x) {
      return x.pos === p.pos && P.gesamt(x) >= st - 4;
    }).length;
    if (aufPos === 0) faktor *= 1.18;
    else if (aufPos >= 3) faktor *= 0.70;

    // Gehaltslast
    if (p.vertrag) {
      var f = world.finanzen[verkaeuferId];
      if (f && f.gehaltsbudget) {
        var anteil = p.vertrag.gehalt / Math.max(1, f.gehaltsbudget);
        if (anteil > 0.14) faktor *= U.clamp(1.25 - anteil * 2.2, 0.45, 1.0);
      }
    }

    // Alter: ein 34-Jaehriger im Tausch ist wenig wert
    if (p.alter >= 33) faktor *= 0.55;
    else if (p.alter >= 31) faktor *= 0.78;
    else if (p.alter <= 21 && p.potenzial > st + 8) faktor *= 1.12;

    return Math.round(wert * faktor);
  }

  /** Gesamtwert aller angebotenen Tauschspieler. */
  function tauschPaket(world, verkaeuferId, ids) {
    if (!ids || !ids.length) return { wert: 0, spieler: [] };
    var spieler = ids.map(function (id) { return world.spieler[id]; }).filter(Boolean);
    var wert = 0;
    spieler.forEach(function (p) { wert += tauschWert(world, verkaeuferId, p); });
    return { wert: wert, spieler: spieler };
  }

  /**
   * Bewertet ein Ablösegebot aus Sicht des abgebenden Vereins.
   * Rueckgabe: { status, gegenangebot, text }
   */
  function pruefeAngebot(world, p, angebot, kaeuferId) {
    var club = p.clubId ? world.vereine[p.clubId] : null;
    var kaeufer = world.vereine[kaeuferId];
    var bereit = verkaufsbereitschaft(world, p);
    var forderung = P.forderung(p, world, club);

    // Verhandlungsstaerke des Kaeufers
    var stab = world.stabWerteVon(kaeuferId);
    forderung *= U.clamp(1.14 - stab.verhandlung * 0.16, 0.94, 1.16);

    // Unwillige Vereine rufen Mondpreise auf.
    forderung *= U.clamp(1.85 - bereit * 1.10, 0.80, 1.85);

    // Ein Kooperationspartner laesst mit sich reden.
    if (FM.kooperation && p.clubId) {
      forderung *= FM.kooperation.ablöseRabatt(world, kaeuferId, p.clubId);
    }

    // Ausstiegsklausel schlaegt alles
    if (p.vertrag && p.vertrag.ausstiegsklausel && angebot >= p.vertrag.ausstiegsklausel) {
      return { status: 'angenommen', text: 'Die Ausstiegsklausel wurde gezogen. Der Verein kann den Wechsel nicht verhindern.' };
    }

    var gesamt = angebot.gesamt !== undefined ? angebot.gesamt : angebot;
    // Sofortzahlung ist mehr wert als Raten
    var barwert = angebot.sofort !== undefined
      ? angebot.sofort + (gesamt - angebot.sofort) * 0.88
      : gesamt;
    // Boni werden mit ihrer Eintrittswahrscheinlichkeit gewertet
    if (angebot.boni) barwert += angebot.boni * 0.45;
    if (angebot.weiterverkauf) barwert += P.marktwert(p, world) * (angebot.weiterverkauf / 100) * 0.30;

    // Angebotene Tauschspieler
    var tausch = tauschPaket(world, p.clubId, angebot.tauschIds);
    barwert += tausch.wert;

    if (bereit < 0.10 && barwert < forderung * 1.6) {
      return {
        status: 'abgelehnt',
        text: (club ? club.name : 'Der Verein') + ' erklärt ' + p.nachname +
          ' für unverkäuflich und lehnt jedes Gespräch ab.'
      };
    }

    var tauschText = tausch.spieler.length
      ? ' ' + (club ? club.name : 'Der Verein') + ' bewertet ' +
        (tausch.spieler.length === 1 ? tausch.spieler[0].nachname : tausch.spieler.length + ' Tauschspieler') +
        ' mit ' + U.money(tausch.wert) + '.'
      : '';

    if (barwert >= forderung) {
      return { status: 'angenommen', forderung: forderung, tauschwert: tausch.wert,
        text: 'Die Vereine haben sich geeinigt.' + tauschText };
    }
    if (barwert >= forderung * 0.72) {
      var gegen = Math.round(Math.max(0, forderung - tausch.wert) / 50000) * 50000;
      return {
        status: 'gegenangebot', gegenangebot: gegen, forderung: forderung, tauschwert: tausch.wert,
        text: 'Das Angebot liegt unter den Vorstellungen. Verlangt werden ' + U.money(gegen) +
          (tausch.spieler.length ? ' zusätzlich zum Tausch.' : '.') + tauschText
      };
    }
    return {
      status: 'abgelehnt', forderung: forderung, tauschwert: tausch.wert,
      text: 'Das Angebot wird als deutlich zu niedrig zurückgewiesen. Vorstellung: ' +
        U.money(forderung) + '.' + tauschText
    };
  }

  /**
   * Der Spieler entscheidet ueber das Vertragsangebot.
   * angebot: { gehalt, jahre, handgeld, rolle, praemien, ausstiegsklausel }
   */
  function pruefeVertragsangebot(world, p, angebot, clubId) {
    var club = world.vereine[clubId];
    var basis = P.gehaltsforderung(p, club, world);
    var rolle = ROLLENVERSPRECHEN[angebot.rolle] || ROLLENVERSPRECHEN.rotation;
    var gefordert = basis * rolle.gehaltFaktor;

    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];

    // Interesse am Verein: Ruf, Liga, Europapokal, sportliche Perspektive
    var reiz = 1;
    var alterClub = p.clubId ? world.vereine[p.clubId] : null;
    if (alterClub) {
      var diff = club.ruf - alterClub.ruf;
      reiz -= U.clamp(diff, -40, 40) / 220;             // Abstieg im Ruf kostet extra Geld
      if (club.liga > alterClub.liga) reiz += 0.16;
      if (club.liga < alterClub.liga) reiz -= 0.10;
    }
    if (europaTeilnehmer(world, clubId)) reiz -= 0.06;
    // Ein Trainer mit Namen muss weniger zahlen als ein unbekannter.
    var chef = FM.staff.cheftrainer(world, clubId, club);
    if (chef) reiz -= U.clamp((chef.ruf - 45) / 400, -0.09, 0.12);
    reiz = U.clamp(reiz, 0.72, 1.4);
    gefordert *= reiz;
    if (pers) gefordert *= (0.75 + pers.gehaltsgier * 0.25);

    // Erwartete Spielzeit muss zur Rolle passen
    var kader = world.kaderVon(clubId);
    var kuenftigerRang = geschaetzterRang(world, p, kader);
    var passt = kuenftigerRang <= 11 ? 0.75 : kuenftigerRang <= 16 ? 0.45 : 0.20;
    if (passt + 0.22 < rolle.erwartung) {
      // Versprechen ist unglaubwuerdig
      gefordert *= 1.10;
    }

    var laufzeitFaktor = angebot.jahre >= 4 ? 0.97 : angebot.jahre <= 1 ? 1.10 : 1;
    if (p.alter >= 32 && angebot.jahre >= 3) laufzeitFaktor *= 0.94;
    gefordert *= laufzeitFaktor;
    gefordert = Math.round(gefordert / 500) * 500;

    var geboten = angebot.gehalt;
    // Handgeld gleicht ein niedrigeres Gehalt teilweise aus
    if (angebot.handgeld) geboten += angebot.handgeld / (angebot.jahre * 52) * 0.7;
    if (angebot.ausstiegsklausel) geboten *= 1.04;

    if (geboten >= gefordert) {
      return { status: 'angenommen', gefordert: gefordert,
        text: p.nachname + ' unterschreibt zu diesen Konditionen.' };
    }
    if (geboten >= gefordert * 0.80) {
      return { status: 'gegenforderung', gefordert: gefordert,
        text: p.nachname + ' verlangt ' + U.money(gefordert) + ' pro Woche.' };
    }
    if (geboten >= gefordert * 0.55) {
      return { status: 'gegenforderung', gefordert: gefordert,
        text: 'Die Berater halten das Angebot für nicht konkurrenzfähig. Gefordert werden ' +
          U.money(gefordert) + ' pro Woche.' };
    }
    return { status: 'abgelehnt', gefordert: gefordert,
      text: p.nachname + ' bricht die Gespräche ab - der Abstand ist zu groß.' };
  }

  function europaTeilnehmer(world, clubId) {
    var out = false;
    Object.keys(world.europa || {}).forEach(function (k) {
      if (world.europa[k].deutsche.indexOf(clubId) >= 0) out = true;
    });
    return out;
  }

  function geschaetzterRang(world, p, kader) {
    var staerke = P.gesamt(p);
    var besser = 0;
    kader.forEach(function (x) { if (P.gesamt(x) > staerke) besser++; });
    return besser + 1;
  }

  // ------------------------------------------------------------ Durchfuehrung

  /**
   * Fuehrt einen Transfer aus: Geld fliesst, der Spieler wechselt.
   * konditionen: { ablöse, sofort, raten, boni, weiterverkauf, vertrag }
   */
  function fuehreTransferDurch(world, p, kaeuferId, konditionen) {
    var verkaeuferId = p.clubId;
    var kaeufer = world.vereine[kaeuferId];
    var verkaeufer = verkaeuferId ? world.vereine[verkaeuferId] : null;
    var ablöse = konditionen.ablöse || 0;

    // Budgets fortschreiben: was ausgegeben wird, ist weg; Verkaufserlöse
    // fliessen dem Transferbudget des abgebenden Vereins wieder zu.
    if (world.finanzen[kaeuferId]) {
      world.finanzen[kaeuferId].transferbudget =
        Math.max(0, world.finanzen[kaeuferId].transferbudget - ablöse);
    }
    if (verkaeuferId && world.finanzen[verkaeuferId] && ablöse > 0) {
      world.finanzen[verkaeuferId].transferbudget += Math.round(ablöse * 0.75);
    }

    if (verkaeuferId && ablöse > 0) {
      var sofort = konditionen.sofort !== undefined ? konditionen.sofort : ablöse;
      F.buche(world, kaeuferId, 'aus', 'ablosen', sofort,
        'Ablöse ' + p.nachname + ' (' + (verkaeufer ? verkaeufer.kurz : '') + ')');
      F.buche(world, verkaeuferId, 'ein', 'transfers', sofort,
        'Ablöse ' + p.nachname + ' (an ' + kaeufer.kurz + ')');

      var rest = ablöse - sofort;
      var raten = konditionen.raten || 0;
      if (rest > 0 && raten > 0) {
        for (var i = 1; i <= raten; i++) {
          var betrag = Math.round(rest / raten);
          world.finanzen[kaeuferId].raten.push({
            faellig: world.tag + i * 365, betrag: betrag, text: p.nachname
          });
          world.finanzen[verkaeuferId].forderungen.push({
            faellig: world.tag + i * 365, betrag: betrag, text: p.nachname
          });
        }
      }
      // Weiterverkaufsbeteiligung des alten Vereins
      if (p.vertrag && p.vertrag.weiterverkauf && p.exClubId) {
        var anteil = Math.round(ablöse * p.vertrag.weiterverkauf / 100);
        if (anteil > 0 && world.finanzen[p.exClubId]) {
          F.buche(world, verkaeuferId, 'aus', 'ablosen', anteil, 'Weiterverkaufsbeteiligung');
          F.buche(world, p.exClubId, 'ein', 'transfers', anteil, 'Weiterverkaufsbeteiligung ' + p.nachname);
        }
      }
    }
    if (konditionen.handgeld) {
      F.buche(world, kaeuferId, 'aus', 'sonstige', konditionen.handgeld, 'Handgeld ' + p.nachname);
    }

    // Tauschspieler wechseln in die Gegenrichtung.
    if (konditionen.tauschIds && konditionen.tauschIds.length && verkaeuferId) {
      konditionen.tauschIds.forEach(function (tid) {
        var t = world.spieler[tid];
        if (!t || t.clubId !== kaeuferId) return;
        t.exClubId = kaeuferId;
        world.setzeVerein(t, verkaeuferId);
        t.leihe = null;
        t.transferliste = false;
        t.leihliste = false;
        t.wechselwunsch = 0;
        t.unzufriedenheit = { spielzeit: 0, gehalt: 0, ambition: 0, taktik: 0 };
        t.nummer = freieNummer(world, verkaeuferId, t.nummer);
        t.kaderrolle = P.vorgeschlageneRolle(t, world.kaderVon(verkaeuferId));
        t.rollenSeit = world.tag;
        t.scoutwissen = 1;
        t.marktwert = P.marktwert(t, world);
        t.historie.push({ tag: world.tag, typ: 'tausch', von: kaeuferId, zu: verkaeuferId, ablöse: 0 });
        world.transfer.historie.unshift({
          tag: world.tag, spielerId: t.id, name: t.vorname + ' ' + t.nachname,
          vonId: kaeuferId, zuId: verkaeuferId, ablöse: 0, art: 'tausch'
        });
      });
    }

    p.exClubId = verkaeuferId;
    world.setzeVerein(p, kaeuferId);
    p.leihe = null;
    p.transferliste = false;
    p.leihliste = false;
    p.wechselwunsch = 0;
    p.unzufriedenheit = { spielzeit: 0, gehalt: 0, ambition: 0, taktik: 0 };
    p.moral = U.clamp(p.moral + 10, 5, 99);
    p.scoutwissen = 1;
    p.nummer = freieNummer(world, kaeuferId, p.nummer);
    p.vertrag = konditionen.vertrag || p.vertrag;
    // Die zugesagte Rolle ist ab jetzt sein Kaderstatus - daran wird der
    // Verein gemessen.
    if (konditionen.rolle && D.KADERROLLE[konditionen.rolle]) {
      p.kaderrolle = konditionen.rolle;
    } else {
      p.kaderrolle = P.vorgeschlageneRolle(p, world.kaderVon(kaeuferId));
    }
    p.rollenSeit = world.tag;
    if (konditionen.weiterverkauf) p.vertrag.weiterverkauf = konditionen.weiterverkauf;
    p.marktwert = P.marktwert(p, world);
    p.historie.push({
      tag: world.tag, typ: 'transfer',
      von: verkaeuferId, zu: kaeuferId, ablöse: ablöse
    });

    world.transfer.historie.unshift({
      tag: world.tag, spielerId: p.id, name: p.vorname + ' ' + p.nachname,
      vonId: verkaeuferId, zuId: kaeuferId, ablöse: ablöse, art: 'transfer'
    });

    // Rekordzu- und -abgang des eigenen Vereins
    if (world.nutzerClubId && ablöse > 0) {
      if (!world.rekorde) world.rekorde = FM.engine ? FM.engine.leereRekorde() : null;
      var r = world.rekorde;
      if (r) {
        var eintrag = { tag: world.tag, saison: world.saison, spielerId: p.id,
          name: p.vorname + ' ' + p.nachname, ablöse: ablöse };
        if (kaeuferId === world.nutzerClubId &&
          (!r.rekordzugang || ablöse > r.rekordzugang.ablöse)) {
          eintrag.gegenueber = verkaeuferId;
          r.rekordzugang = eintrag;
        }
        if (verkaeuferId === world.nutzerClubId &&
          (!r.rekordabgang || ablöse > r.rekordabgang.ablöse)) {
          eintrag.gegenueber = kaeuferId;
          r.rekordabgang = eintrag;
        }
      }
    }
    if (world.transfer.historie.length > 400) world.transfer.historie.pop();

    // Aufstellungen aktualisieren
    [verkaeuferId, kaeuferId].forEach(function (cid) {
      if (!cid) return;
      var club = world.vereine[cid];
      var taktik = world.taktiken[cid];
      if (club && taktik) FM.tactics.autoAufstellung(world, club, taktik);
    });
    return p;
  }

  function freieNummer(world, clubId, wunsch) {
    var belegt = {};
    world.kaderVon(clubId).forEach(function (p) { belegt[p.nummer] = true; });
    if (wunsch && !belegt[wunsch]) return wunsch;
    for (var n = 2; n < 80; n++) if (!belegt[n]) return n;
    return 99;
  }

  /** Leihe abwickeln. */
  function fuehreLeiheDurch(world, p, nehmerId, konditionen) {
    var geberId = p.clubId;
    p.leihe = {
      vonClubId: geberId,
      bis: konditionen.bis || (world.tag + 330),
      gehaltsanteil: konditionen.gehaltsanteil !== undefined ? konditionen.gehaltsanteil : 0.5,
      gebuehr: konditionen.gebuehr || 0,
      kaufoption: konditionen.kaufoption || 0,
      kaufpflicht: !!konditionen.kaufpflicht,
      einsatzgarantie: konditionen.einsatzgarantie || 0
    };
    world.setzeVerein(p, nehmerId);
    p.nummer = freieNummer(world, nehmerId, p.nummer);
    p.scoutwissen = 1;
    if (konditionen.gebuehr) {
      F.buche(world, nehmerId, 'aus', 'ablosen', konditionen.gebuehr, 'Leihgebühr ' + p.nachname);
      F.buche(world, geberId, 'ein', 'transfers', konditionen.gebuehr, 'Leihgebühr ' + p.nachname);
    }
    world.transfer.historie.unshift({
      tag: world.tag, spielerId: p.id, name: p.vorname + ' ' + p.nachname,
      vonId: geberId, zuId: nehmerId, ablöse: konditionen.gebuehr || 0, art: 'leihe'
    });
    [geberId, nehmerId].forEach(function (cid) {
      var club = world.vereine[cid];
      var taktik = world.taktiken[cid];
      if (club && taktik) FM.tactics.autoAufstellung(world, club, taktik);
    });
    return p;
  }

  function leiheBeenden(world, p) {
    if (!p.leihe) return;
    var zurueck = p.leihe.vonClubId;
    var kaufpflicht = p.leihe.kaufpflicht;
    var option = p.leihe.kaufoption;
    var nehmer = p.clubId;
    world.setzeVerein(p, zurueck);
    p.leihe = null;
    p.nummer = freieNummer(world, zurueck, p.nummer);
    if (kaufpflicht && option) {
      fuehreTransferDurch(world, p, nehmer, {
        ablöse: option, sofort: option,
        vertrag: P.vertragErzeugen(world.rng, p, world.vereine[nehmer], world, 3)
      });
    }
    var club = world.vereine[zurueck];
    if (club) FM.tactics.autoAufstellung(world, club, world.taktikVon(zurueck));
  }

  // ------------------------------------------------------------ Scouting

  var SCOUT_REGIONEN = [
    { id: 'de', name: 'Deutschland', nationen: ['Deutschland'], dauer: 14, kosten: 12000 },
    { id: 'dach', name: 'Österreich & Schweiz', nationen: ['Österreich', 'Schweiz'], dauer: 18, kosten: 18000 },
    { id: 'benelux', name: 'Benelux', nationen: ['Niederlande', 'Belgien'], dauer: 20, kosten: 22000 },
    { id: 'skandinavien', name: 'Skandinavien', nationen: ['Dänemark', 'Schweden', 'Norwegen'], dauer: 22, kosten: 24000 },
    { id: 'suedeuropa', name: 'Südeuropa', nationen: ['Spanien', 'Portugal', 'Italien', 'Griechenland'], dauer: 24, kosten: 30000 },
    { id: 'osteuropa', name: 'Osteuropa', nationen: ['Polen', 'Tschechien', 'Kroatien', 'Serbien', 'Ukraine', 'Ungarn', 'Slowenien'], dauer: 24, kosten: 26000 },
    { id: 'suedamerika', name: 'Südamerika', nationen: ['Brasilien', 'Argentinien'], dauer: 32, kosten: 48000 },
    { id: 'afrika', name: 'Afrika', nationen: ['Nigeria', 'Ghana', 'Senegal', 'Kamerun', 'Marokko', 'Elfenbeinküste', 'Algerien'], dauer: 32, kosten: 42000 },
    { id: 'asien', name: 'Asien', nationen: ['Japan', 'Südkorea'], dauer: 30, kosten: 40000 },
    { id: 'nordamerika', name: 'Nordamerika', nationen: ['USA'], dauer: 28, kosten: 36000 }
  ];

  // ------------------------------------------------------------ Scoutingnetz

  /**
   * Der Kenntnisstand eines Vereins in einer Region. Er waechst mit
   * jeder Reise dorthin und verfaellt langsam, wenn man sich nicht mehr
   * kuemmert. Wo das Netz dicht ist, melden die Scouts von sich aus, und
   * die Berichte sind genauer.
   */
  function netzStand(world, clubId, regionId) {
    var netz = world.transfer.scoutnetz || {};
    var k = netz[clubId];
    return (k && k[regionId]) || 0;
  }

  function netzSetzen(world, clubId, regionId, wert) {
    if (!world.transfer.scoutnetz) world.transfer.scoutnetz = {};
    if (!world.transfer.scoutnetz[clubId]) world.transfer.scoutnetz[clubId] = {};
    world.transfer.scoutnetz[clubId][regionId] = U.clamp(wert, 0, 1);
  }

  /** Das ganze Netz eines Vereins, fuer die Anzeige. */
  function scoutnetzVon(world, clubId) {
    return SCOUT_REGIONEN.map(function (r) {
      return { region: r, stand: netzStand(world, clubId, r.id) };
    });
  }

  function netzLabel(stand) {
    if (stand >= 0.80) return 'hervorragend';
    if (stand >= 0.58) return 'gut';
    if (stand >= 0.36) return 'brauchbar';
    if (stand >= 0.15) return 'dünn';
    return 'kein Netz';
  }

  /**
   * Woechentlich: Das Netz verfaellt ein wenig, und wo es dicht ist,
   * beobachten die Scouts auch ohne Auftrag.
   */
  function scoutnetzWoche(world) {
    var netz = world.transfer.scoutnetz;
    if (!netz) return;
    Object.keys(netz).forEach(function (clubId) {
      var stab = world.stabWerteVon(clubId);
      SCOUT_REGIONEN.forEach(function (r) {
        var stand = netzStand(world, clubId, r.id);
        if (stand <= 0) return;
        // Verfall: ein gepflegtes Netz haelt laenger als ein zufaelliges.
        netzSetzen(world, clubId, r.id, stand - 0.004 - (1 - stand) * 0.004);

        // Laufende Beobachtung in gut abgedeckten Regionen
        if (stand < 0.36) return;
        var funde = suche(world, {
          nationen: r.nationen, minAlter: 16, maxAlter: 30,
          minStaerke: 0, ausserhalb: clubId
        }, Math.round(stand * 6));
        funde.forEach(function (p) {
          p.scoutwissen = U.clamp(p.scoutwissen + 0.02 + stand * 0.05 * stab.scoutingGenauigkeit, 0, 1);
        });
      });
    });
  }

  function scoutAuftragAnlegen(world, clubId, cfg) {
    var f = world.finanzen[clubId];
    var kosten = cfg.spielerId ? 8000 : (SCOUT_REGIONEN.filter(function (r) { return r.id === cfg.regionId; })[0] || { kosten: 20000 }).kosten;
    if (f.kontostand < kosten) return { fehler: 'Das Scoutingbudget gibt das nicht her.' };
    F.buche(world, clubId, 'aus', 'scouting', kosten, cfg.spielerId ? 'Einzelbeobachtung' : 'Scoutingreise');

    var region = SCOUT_REGIONEN.filter(function (r) { return r.id === cfg.regionId; })[0];
    // Wo das Netz steht, geht eine Reise schneller.
    var stand = region ? netzStand(world, clubId, region.id) : 0;
    var dauer = cfg.spielerId ? 10
      : Math.round((region ? region.dauer : 21) * (1 - stand * 0.35));
    var auftrag = {
      id: U.nextId('sc'),
      clubId: clubId,
      spielerId: cfg.spielerId || null,
      regionId: cfg.regionId || null,
      minAlter: cfg.minAlter || 16,
      maxAlter: cfg.maxAlter || 40,
      position: cfg.position || null,
      minStaerke: cfg.minStaerke || 0,
      start: world.tag,
      fertig: world.tag + dauer,
      ergebnis: null
    };
    world.transfer.scoutAuftraege.push(auftrag);
    return { ok: true, auftrag: auftrag };
  }

  /** Taeglich pruefen, ob Scoutingberichte fertig sind. */
  function scoutingTick(world) {
    var offen = [];
    world.transfer.scoutAuftraege.forEach(function (a) {
      if (a.fertig > world.tag) { offen.push(a); return; }
      var stab = world.stabWerteVon(a.clubId);
      if (a.spielerId) {
        var p = world.spieler[a.spielerId];
        if (p) {
          p.scoutwissen = U.clamp(p.scoutwissen + 0.30 + stab.scoutingGenauigkeit * 0.45, 0, 1);
          if (world.istNutzerVerein(a.clubId)) {
            world.nachricht({
              typ: 'scouting', prioritaet: 1,
              titel: 'Scoutingbericht: ' + p.vorname + ' ' + p.nachname,
              text: berichtstext(world, p, stab.scoutingGenauigkeit),
              spielerId: p.id
            });
          }
        }
      } else {
        var region = SCOUT_REGIONEN.filter(function (r) { return r.id === a.regionId; })[0];
        var treffer = suche(world, {
          nationen: region ? region.nationen : null,
          minAlter: a.minAlter, maxAlter: a.maxAlter,
          position: a.position, minStaerke: a.minStaerke,
          ausserhalb: a.clubId
        }, 8 + Math.round(stab.scoutingGenauigkeit * 8));
        treffer.forEach(function (p) {
          var netzBonus = region ? netzStand(world, a.clubId, region.id) * 0.20 : 0;
          p.scoutwissen = U.clamp(p.scoutwissen + 0.22 + stab.scoutingGenauigkeit * 0.35 + netzBonus, 0, 1);
        });
        if (region) {
          // Jede Reise verdichtet das Netz - die ersten bringen am meisten.
          var vorher = netzStand(world, a.clubId, region.id);
          netzSetzen(world, a.clubId, region.id,
            vorher + (1 - vorher) * (0.22 + stab.scoutingGenauigkeit * 0.18));
        }
        if (world.istNutzerVerein(a.clubId)) {
          var jetzt = region ? netzStand(world, a.clubId, region.id) : 0;
          world.nachricht({
            typ: 'scouting', prioritaet: 1,
            titel: 'Scoutingreise abgeschlossen: ' + (region ? region.name : 'Region'),
            text: 'Die Scouts haben ' + treffer.length + ' Spieler beobachtet, die zum Suchprofil passen. ' +
              (region ? 'Das Netz in ' + region.name + ' ist jetzt ' + netzLabel(jetzt) + '. ' : '') +
              'Die Berichte stehen im Transfermarkt zur Verfügung.',
            spielerIds: treffer.map(function (p) { return p.id; })
          });
        }
      }
    });
    world.transfer.scoutAuftraege = offen;
  }

  function berichtstext(world, p, genauigkeit) {
    var st = P.gesamt(p);
    var label = P.staerkeLabel(st);
    var pot = p.potenzial;
    var spanne = Math.round((1 - genauigkeit) * 16);
    var text = p.vorname + ' ' + p.nachname + ', ' + p.alter + ' Jahre, ' +
      D.POS_NAME[p.pos] + ' (' + p.nation + '). ';
    text += 'Aktuelle Einschätzung: ' + label + '. ';
    if (p.alter <= 23) {
      text += 'Entwicklungspotenzial: ' + P.staerkeLabel(U.clamp(pot - spanne, 1, 99)) +
        ' bis ' + P.staerkeLabel(U.clamp(pot + spanne, 1, 99)) + '. ';
    }
    text += 'Marktwert rund ' + U.money(p.marktwert) + ', ';
    text += p.vertrag ? 'Vertrag bis ' + U.fmtDate(p.vertrag.bis) + '. ' : 'derzeit vertragslos. ';
    var staerken = U.sortBy(D.ALLE_ATTRIBUTE.filter(function (k) {
      return p.pos === 'TW' ? true : D.ATTRIBUTE.torwart.keys.indexOf(k) < 0;
    }), function (k) { return -p.attr[k]; }).slice(0, 3);
    text += 'Auffällige Stärken: ' + staerken.map(function (k) { return D.ATTR_NAME[k]; }).join(', ') + '.';
    return text;
  }

  /** Spielersuche ueber die ganze Welt. */
  function suche(world, filter, limit) {
    filter = filter || {};
    var out = [];
    var alle = world.alleSpieler();
    for (var i = 0; i < alle.length; i++) {
      var p = alle[i];
      if (filter.ausserhalb && p.clubId === filter.ausserhalb) continue;
      if (filter.nurVertragslos && p.clubId) continue;
      if (filter.nationen && filter.nationen.indexOf(p.nation) < 0) continue;
      if (filter.position && p.pos !== filter.position &&
        p.nebenpos.indexOf(filter.position) < 0) continue;
      if (filter.minAlter && p.alter < filter.minAlter) continue;
      if (filter.maxAlter && p.alter > filter.maxAlter) continue;
      var st = P.gesamt(p);
      if (filter.minStaerke && st < filter.minStaerke) continue;
      if (filter.maxWert && p.marktwert > filter.maxWert) continue;
      if (filter.maxGehalt && p.vertrag && p.vertrag.gehalt > filter.maxGehalt) continue;
      if (filter.nurTransferliste && !p.transferliste) continue;
      if (filter.nurAuslauf) {
        if (!p.vertrag || P.restlaufzeitMonate(p, world) > 6) continue;
      }
      if (filter.text) {
        var t = (p.vorname + ' ' + p.nachname).toLowerCase();
        if (t.indexOf(filter.text.toLowerCase()) < 0) continue;
      }
      if (filter.ligen && p.clubId) {
        var c = world.vereine[p.clubId];
        if (!c || filter.ligen.indexOf(c.liga) < 0) continue;
      }
      out.push(p);
    }
    out = U.sortBy(out, function (p) { return -P.gesamt(p); });
    return limit ? out.slice(0, limit) : out;
  }

  // ------------------------------------------------------------ KI-Transfers

  /** Was fehlt einem Verein? Liefert Positionen mit Bedarf. */
  function kaderbedarf(world, clubId) {
    var kader = world.kaderVon(clubId);
    var club = world.vereine[clubId];
    var soll = P.KADER_SCHEMA;
    var bedarf = [];
    var niveau = P.niveauFuerVerein(club);
    soll.forEach(function (e) {
      var pos = e[0], anzahl = e[1];
      var passend = kader.filter(function (p) {
        return p.pos === pos || p.nebenpos.indexOf(pos) >= 0;
      });
      var gut = passend.filter(function (p) { return P.gesamt(p) >= niveau - 4; });
      var dringlichkeit = 0;
      if (passend.length < anzahl) dringlichkeit += (anzahl - passend.length) * 2.2;
      if (gut.length < Math.min(2, anzahl)) dringlichkeit += 1.6;
      if (dringlichkeit > 0) bedarf.push({ pos: pos, dringlichkeit: dringlichkeit, vorhanden: passend.length });
    });
    return U.sortBy(bedarf, function (b) { return -b.dringlichkeit; });
  }

  /**
   * Taegliche Transferaktivitaet der KI-Vereine. Es werden nur wenige
   * Vereine pro Tag aktiv, damit sich der Markt ueber das Fenster verteilt.
   */
  function kiTick(world) {
    if (!world.transferfenster.offen) return;
    var rng = world.rng;
    var profis = world.ligen.bl1.teams.concat(world.ligen.bl2.teams)
      .filter(function (id) { return id !== world.nutzerClubId; });
    var aktive = rng.sample(profis, Math.min(5, profis.length));

    aktive.forEach(function (clubId) {
      if (!rng.chance(0.5)) return;
      kiVereinAktion(world, clubId);
    });

    // Ablösefreie Spieler werden auch ausserhalb des Fensters verpflichtet
    var suchende = rng.sample(profis, Math.min(3, profis.length));
    suchende.forEach(function (clubId) {
      if (rng.chance(0.6)) kiVertragslosen(world, clubId);
    });

    // Angebote fuer Spieler des Nutzers
    if (world.nutzerClubId && rng.chance(0.30)) angebotFuerNutzerspieler(world);
  }

  /** Ein KI-Verein bedient sich auf dem Markt der Vertragslosen. */
  function kiVertragslosen(world, clubId) {
    var rng = world.rng;
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    var kader = world.kaderVon(clubId);
    var maximal = club.liga === 1 ? 29 : club.liga === 2 ? 28 : 26;
    if (kader.length >= maximal) return;

    var bedarf = kaderbedarf(world, clubId);
    var pos = bedarf.length ? bedarf[0].pos : null;
    var niveau = P.niveauFuerVerein(club);
    var frei = world.vertragslose().filter(function (p) {
      if (pos && p.pos !== pos && p.nebenpos.indexOf(pos) < 0) return false;
      var st = P.gesamt(p);
      return st >= niveau - 10 && st <= niveau + 6;
    });
    if (!frei.length) return;
    var ziel = U.sortBy(frei, function (p) { return -P.gesamt(p); })[0];
    var gehalt = P.gehaltsforderung(ziel, club, world);
    if (F.wochenLohnsumme(world, clubId) + gehalt > f.gehaltsbudget * 1.1) return;
    var jahre = ziel.alter <= 25 ? 3 : ziel.alter <= 31 ? 2 : 1;
    fuehreTransferDurch(world, ziel, clubId, {
      ablöse: 0,
      vertrag: {
        bis: world.tag + jahre * 365, unterschrieben: world.tag,
        gehalt: Math.round(gehalt * rng.range(1.0, 1.1) / 500) * 500,
        handgeld: 0, ausstiegsklausel: 0,
        praemien: { einsatz: Math.round(gehalt * 0.1), tor: Math.round(gehalt * 0.1),
          sieg: Math.round(gehalt * 0.08), zuNull: 0 },
        weiterverkauf: 0
      }
    });
  }

  function kiVereinAktion(world, clubId) {
    var rng = world.rng;
    var club = world.vereine[clubId];
    var f = world.finanzen[clubId];
    var kader = world.kaderVon(clubId);

    // Erst aussortieren: zu grosser Kader oder Spieler mit Wechselwunsch
    if (kader.length > 27 || rng.chance(0.25)) {
      var kandidaten = kader.filter(function (p) {
        return P.kaderRang(p, kader) > 18 || p.wechselwunsch > 55;
      });
      if (kandidaten.length) {
        var raus = rng.pick(kandidaten);
        raus.transferliste = true;
      }
    }

    var bedarf = kaderbedarf(world, clubId);
    if (!bedarf.length) return;
    if (f.transferbudget < 200000 && f.kontostand < 1e6) return;

    var ziel = bedarf[0];
    var niveau = P.niveauFuerVerein(club);
    var kandidatenListe = suche(world, {
      position: ziel.pos,
      minStaerke: niveau - 3,
      maxAlter: 33,
      ausserhalb: clubId
    }, 40).filter(function (p) {
      if (p.clubId === world.nutzerClubId) return false;    // laeuft ueber Angebote
      if (p.leihe) return false;
      var preis = p.clubId ? P.forderung(p, world, world.vereine[p.clubId]) : 0;
      return preis <= f.transferbudget;
    });
    if (!kandidatenListe.length) return;

    var ziel2 = rng.weighted(kandidatenListe.slice(0, 12), function (p) {
      return Math.max(0.2, P.gesamt(p) - niveau + 6) * (verkaufsbereitschaft(world, p) + 0.15);
    });
    if (!ziel2) return;

    var preis = ziel2.clubId ? P.forderung(ziel2, world, world.vereine[ziel2.clubId]) : 0;
    if (preis > f.transferbudget) return;
    if (preis > f.kontostand * 0.7 && f.kontostand > 0) return;   // Liquiditaet wahren

    // Gehalt muss passen
    var gehalt = P.gehaltsforderung(ziel2, club, world) * 1.08;
    if (F.wochenLohnsumme(world, clubId) + gehalt > f.gehaltsbudget * 1.15) return;

    var jahre = ziel2.alter <= 24 ? 4 : ziel2.alter <= 29 ? 3 : 2;
    var vertrag = {
      bis: world.tag + jahre * 365,
      unterschrieben: world.tag,
      gehalt: Math.round(gehalt / 500) * 500,
      handgeld: Math.round(preis * 0.04),
      ausstiegsklausel: rng.chance(0.12) ? Math.round(preis * 2.2 / 100000) * 100000 : 0,
      praemien: { einsatz: Math.round(gehalt * 0.1), tor: Math.round(gehalt * 0.12), sieg: Math.round(gehalt * 0.1), zuNull: 0 },
      weiterverkauf: 0
    };
    var alterVerein = ziel2.clubId;
    fuehreTransferDurch(world, ziel2, clubId, {
      ablöse: preis, sofort: Math.round(preis * (rng.chance(0.5) ? 1 : 0.6)),
      raten: 2, vertrag: vertrag
    });

    if (world.nutzerClubId && (alterVerein === world.nutzerClubId)) return;
    // Meldung fuer bedeutende Transfers
    if (preis >= 8e6 || P.gesamt(ziel2) >= 74) {
      world.nachricht({
        typ: 'transfer', prioritaet: 0,
        titel: 'Transfer: ' + ziel2.nachname + ' wechselt zu ' + club.kurz,
        text: club.name + ' verpflichtet ' + ziel2.vorname + ' ' + ziel2.nachname +
          (alterVerein ? ' von ' + world.vereine[alterVerein].name : ' ablösefrei') +
          '. Die Ablöse soll bei ' + U.money(preis) + ' liegen.',
        spielerId: ziel2.id
      });
    }
  }

  function angebotFuerNutzerspieler(world) {
    var rng = world.rng;
    var kader = world.kaderVon(world.nutzerClubId);
    if (!kader.length) return;
    var interessant = kader.filter(function (p) {
      return !p.leihe && (P.gesamt(p) >= P.niveauFuerVerein(world.vereine[world.nutzerClubId]) - 2
        || p.transferliste || p.wechselwunsch > 50);
    });
    if (!interessant.length) return;
    var ziel = rng.pick(interessant);

    // Wer bietet? Ein Verein, der sich den Spieler leisten kann.
    var kaeuferKandidaten = world.ligen.bl1.teams.concat(world.ligen.bl2.teams)
      .filter(function (id) {
        if (id === world.nutzerClubId) return false;
        var f = world.finanzen[id];
        return f && (f.transferbudget >= ziel.marktwert * 0.8 || f.kontostand >= ziel.marktwert * 1.2);
      });
    if (!kaeuferKandidaten.length) return;
    var kaeuferId = rng.weighted(kaeuferKandidaten, function (id) {
      var c = world.vereine[id];
      return Math.pow(c.ruf / 40, 2.2);
    });
    var kaeufer = world.vereine[kaeuferId];

    var forderung = P.forderung(ziel, world, world.vereine[world.nutzerClubId]);
    var gebot = Math.round(forderung * rng.range(0.62, 1.15) / 50000) * 50000;

    var angebot = {
      id: U.nextId('ang'),
      spielerId: ziel.id,
      clubId: kaeuferId,
      ablöse: gebot,
      sofort: Math.round(gebot * rng.range(0.5, 1)),
      raten: 2,
      boni: Math.round(gebot * rng.range(0, 0.2)),
      weiterverkauf: rng.chance(0.35) ? rng.int(5, 20) : 0,
      tag: world.tag,
      frist: world.tag + 7,
      status: 'offen',
      art: 'kauf'
    };
    world.transfer.angeboteEin.push(angebot);
    world.nachricht({
      typ: 'angebot', prioritaet: 2,
      titel: 'Angebot für ' + ziel.nachname + ' von ' + kaeufer.name,
      text: kaeufer.name + ' bietet ' + U.money(gebot) + ' für ' + ziel.vorname + ' ' + ziel.nachname +
        '. Davon ' + U.money(angebot.sofort) + ' sofort' +
        (angebot.boni ? ', dazu bis zu ' + U.money(angebot.boni) + ' an Bonuszahlungen' : '') +
        (angebot.weiterverkauf ? ' sowie ' + angebot.weiterverkauf + ' % Weiterverkaufsbeteiligung' : '') +
        '. Die Frist läuft am ' + U.fmtDate(angebot.frist) + ' ab.',
      spielerId: ziel.id,
      angebotId: angebot.id,
      aktion: 'angebot'
    });
  }

  /** Der Nutzer entscheidet ueber ein eingehendes Angebot. */
  /**
   * Wie teuer eine Rueckkaufoption ist. Der Kaeufer laesst sich das
   * Risiko bezahlen: Er zieht einen Teil der Abloese ab und verlangt
   * einen deutlichen Aufschlag auf den Rueckkaufpreis.
   */
  function rueckkaufKonditionen(ablöse) {
    return {
      abschlag: Math.round(ablöse * 0.09),
      preis: Math.round(ablöse * 1.75 / 100000) * 100000,
      jahre: 3
    };
  }

  /** Darf dieser Verein den Spieler zurueckholen? */
  function rueckkaufOffen(world, p, clubId) {
    var r = p.rueckkauf;
    if (!r || r.clubId !== clubId) return null;
    if (world.tag > r.bis) return null;
    if (p.clubId === clubId) return null;
    return r;
  }

  /** Zieht die Rueckkaufoption. Der abgebende Verein kann sie nicht abwehren. */
  function rueckkaufZiehen(world, spielerId, clubId) {
    var p = world.spieler[spielerId];
    if (!p) return { fehler: 'Spieler nicht gefunden.' };
    var r = rueckkaufOffen(world, p, clubId);
    if (!r) return { fehler: 'Für diesen Spieler besteht keine gültige Rückkaufoption.' };
    var f = world.finanzen[clubId];
    if (f && r.preis > f.transferbudget) {
      return { fehler: 'Das Transferbudget reicht für den Rückkauf nicht aus (' + U.money(r.preis) + ').' };
    }
    var jahre = p.alter <= 26 ? 4 : 3;
    var club = world.vereine[clubId];
    fuehreTransferDurch(world, p, clubId, {
      ablöse: r.preis, sofort: r.preis, raten: 1,
      vertrag: {
        bis: world.tag + jahre * 365, unterschrieben: world.tag,
        gehalt: Math.round(P.gehaltsforderung(p, club, world) * 1.05 / 500) * 500,
        handgeld: 0, ausstiegsklausel: 0,
        praemien: { einsatz: 2000, tor: 3000, sieg: 2000, zuNull: 0 },
        weiterverkauf: 0
      }
    });
    p.rueckkauf = null;
    return { ok: true, preis: r.preis, name: p.vorname + ' ' + p.nachname };
  }

  function angebotEntscheiden(world, angebotId, annehmen, opts) {
    opts = opts || {};
    var angebot = world.transfer.angeboteEin.filter(function (a) { return a.id === angebotId; })[0];
    if (!angebot || angebot.status !== 'offen') return { fehler: 'Angebot nicht mehr gültig.' };
    var p = world.spieler[angebot.spielerId];
    if (!p) return { fehler: 'Spieler nicht gefunden.' };

    if (!annehmen) {
      angebot.status = 'abgelehnt';
      p.moral = U.clamp(p.moral - (p.wechselwunsch > 60 ? 12 : 2), 5, 99);
      if (p.wechselwunsch > 60) {
        p.unzufriedenheit.ambition = U.clamp(p.unzufriedenheit.ambition + 15, 0, 100);
      }
      return { ok: true, status: 'abgelehnt' };
    }

    var kaeufer = world.vereine[angebot.clubId];
    var pruefung = pruefeVertragsangebot(world, p, {
      gehalt: P.gehaltsforderung(p, kaeufer, world) * 1.10,
      jahre: p.alter <= 26 ? 4 : 3, handgeld: 0, rolle: 'stamm'
    }, angebot.clubId);

    if (pruefung.status === 'abgelehnt') {
      angebot.status = 'geplatzt';
      return { ok: true, status: 'geplatzt',
        text: p.nachname + ' konnte sich mit ' + kaeufer.name + ' nicht auf einen Vertrag einigen.' };
    }

    var jahre = p.alter <= 26 ? 4 : 3;
    // Rueckkaufoption: kostet Abloese, sichert aber den Zugriff.
    var rk = null;
    var abloese = angebot.ablöse, sofort = angebot.sofort;
    if (opts.rueckkauf) {
      var k = rueckkaufKonditionen(angebot.ablöse);
      abloese = angebot.ablöse - k.abschlag;
      sofort = Math.round(sofort * (abloese / Math.max(1, angebot.ablöse)));
      rk = { clubId: world.nutzerClubId, preis: k.preis, bis: world.tag + k.jahre * 365 };
    }

    fuehreTransferDurch(world, p, angebot.clubId, {
      ablöse: abloese, sofort: sofort, raten: angebot.raten,
      weiterverkauf: angebot.weiterverkauf,
      vertrag: {
        bis: world.tag + jahre * 365, unterschrieben: world.tag,
        gehalt: Math.round(pruefung.gefordert / 500) * 500,
        handgeld: 0, ausstiegsklausel: 0,
        praemien: { einsatz: 2000, tor: 3000, sieg: 2000, zuNull: 0 },
        weiterverkauf: angebot.weiterverkauf || 0
      }
    });
    if (rk) p.rueckkauf = rk;
    angebot.status = 'abgewickelt';
    return { ok: true, status: 'verkauft', betrag: abloese, rueckkauf: rk ? rk.preis : 0 };
  }

  /** Abgelaufene Angebote entfernen. */
  function angeboteAufraeumen(world) {
    world.transfer.angeboteEin = world.transfer.angeboteEin.filter(function (a) {
      return a.status === 'offen' && a.frist >= world.tag;
    });
    world.transfer.angeboteAus = world.transfer.angeboteAus.filter(function (a) {
      return a.frist >= world.tag;
    });
  }

  // ------------------------------------------------------------ Vertraege

  /** Vertragsangebot an einen eigenen Spieler (Verlaengerung). */
  function verlaengerungAnbieten(world, spielerId, angebot) {
    var p = world.spieler[spielerId];
    if (!p || p.clubId !== world.nutzerClubId) return { fehler: 'Kein eigener Spieler.' };
    var club = world.vereine[world.nutzerClubId];
    var pruefung = pruefeVertragsangebot(world, p, angebot, world.nutzerClubId);
    if (pruefung.status === 'angenommen') {
      var f = world.finanzen[world.nutzerClubId];
      if (angebot.handgeld) {
        F.buche(world, world.nutzerClubId, 'aus', 'sonstige', angebot.handgeld, 'Handgeld ' + p.nachname);
      }
      p.vertrag = {
        bis: world.tag + angebot.jahre * 365,
        unterschrieben: world.tag,
        gehalt: angebot.gehalt,
        handgeld: angebot.handgeld || 0,
        ausstiegsklausel: angebot.ausstiegsklausel || 0,
        praemien: angebot.praemien || p.vertrag.praemien,
        weiterverkauf: p.vertrag ? p.vertrag.weiterverkauf : 0
      };
      p.moral = U.clamp(p.moral + 10, 5, 99);
      p.unzufriedenheit.gehalt = 0;
      p.wechselwunsch = U.clamp(p.wechselwunsch - 30, 0, 100);
      p.marktwert = P.marktwert(p, world);
    }
    return pruefung;
  }

  /** Vertragslosen Spieler verpflichten. */
  function ablösefreiVerpflichten(world, spielerId, angebot) {
    var p = world.spieler[spielerId];
    if (!p || p.clubId) return { fehler: 'Spieler steht unter Vertrag.' };
    var pruefung = pruefeVertragsangebot(world, p, angebot, world.nutzerClubId);
    if (pruefung.status !== 'angenommen') return pruefung;
    fuehreTransferDurch(world, p, world.nutzerClubId, {
      ablöse: 0, handgeld: angebot.handgeld || 0,
      vertrag: {
        bis: world.tag + angebot.jahre * 365, unterschrieben: world.tag,
        gehalt: angebot.gehalt, handgeld: angebot.handgeld || 0,
        ausstiegsklausel: angebot.ausstiegsklausel || 0,
        praemien: angebot.praemien || { einsatz: 2000, tor: 2000, sieg: 1500, zuNull: 0 },
        weiterverkauf: 0
      }
    });
    return { status: 'angenommen', ok: true };
  }

  /** Vertragsablauf pruefen, KI verlaengert selbst. */
  // ------------------------------------------------------------ Vorvertraege

  /**
   * Ab dem 1. Januar darf ein Spieler, dessen Vertrag im Sommer
   * auslaeuft, ablösefrei bei einem anderen Verein unterschreiben. Der
   * abgebende Verein kann das nur verhindern, indem er vorher
   * verlaengert.
   */
  function vorvertragMoeglich(world, p) {
    if (!p.clubId || !p.vertrag || p.leihe) return false;
    if (p.vorvertrag) return false;
    var datum = U.fromDay(world.tag);
    if (datum.m < 1 || datum.m > 6) return false;          // Januar bis Juni
    // Vertraege laufen bis zum 1. Juli - dieser Tag zaehlt noch dazu.
    var saisonende = U.toDay(datum.y, 7, 1);
    return p.vertrag.bis <= saisonende;
  }

  /** Wann ein Vorvertrag in Kraft tritt: zum 1. Juli. */
  function vorvertragStart(world) {
    var datum = U.fromDay(world.tag);
    return U.toDay(datum.y, 7, 1);
  }

  /**
   * Der Spieler entscheidet ueber einen Vorvertrag. Bewertet wird wie
   * bei einem gewoehnlichen Vertragsangebot, nur ohne Abloese - was ihn
   * fuer den Spieler attraktiver macht, weil mehr Gehalt moeglich ist.
   */
  function vorvertragAnbieten(world, spielerId, angebot, clubId) {
    var p = world.spieler[spielerId];
    if (!p) return { fehler: 'Spieler nicht gefunden.' };
    if (!vorvertragMoeglich(world, p)) {
      return { fehler: 'Für diesen Spieler ist kein Vorvertrag möglich.' };
    }
    var pruefung = pruefeVertragsangebot(world, p, angebot, clubId);
    if (pruefung.status !== 'angenommen') return pruefung;

    p.vorvertrag = {
      clubId: clubId,
      ab: vorvertragStart(world),
      gehalt: angebot.gehalt,
      jahre: angebot.jahre,
      handgeld: angebot.handgeld || 0,
      rolle: angebot.rolle || 'rotation'
    };
    var alt = world.vereine[p.clubId];
    var neu = world.vereine[clubId];
    world.transfer.geruechte.unshift({
      tag: world.tag, spielerId: p.id, clubId: clubId,
      text: p.vorname + ' ' + p.nachname + ' hat einen Vorvertrag bei ' + neu.name +
        ' unterschrieben und verlässt ' + (alt ? alt.name : 'seinen Verein') + ' im Sommer ablösefrei.'
    });
    if (world.istNutzerVerein(p.clubId)) {
      world.nachricht({
        typ: 'transfer', prioritaet: 3,
        titel: 'Vorvertrag: ' + p.nachname + ' geht im Sommer',
        text: p.vorname + ' ' + p.nachname + ' hat bei ' + neu.name + ' unterschrieben. ' +
          'Zum 1. Juli verlässt er den Verein ablösefrei.',
        spielerId: p.id
      });
    }
    return { status: 'angenommen', vorvertrag: p.vorvertrag };
  }

  /** Setzt faellige Vorvertraege um. */
  function vorvertraegePruefen(world) {
    world.alleSpieler().forEach(function (p) {
      var v = p.vorvertrag;
      if (!v || world.tag < v.ab) return;
      p.vorvertrag = null;
      var club = world.vereine[v.clubId];
      if (!club) return;
      fuehreTransferDurch(world, p, v.clubId, {
        ablöse: 0, sofort: 0, raten: 1, handgeld: v.handgeld, rolle: v.rolle,
        vertrag: {
          bis: world.tag + v.jahre * 365, unterschrieben: world.tag,
          gehalt: v.gehalt, handgeld: v.handgeld, ausstiegsklausel: 0,
          praemien: { einsatz: Math.round(v.gehalt * 0.10), tor: Math.round(v.gehalt * 0.12),
            sieg: Math.round(v.gehalt * 0.09), zuNull: 0 },
          weiterverkauf: 0
        }
      });
    });
  }

  /** Die KI sichert sich ebenfalls auslaufende Vertraege. */
  function kiVorvertraege(world) {
    var rng = world.rng;
    var datum = U.fromDay(world.tag);
    if (datum.m < 1 || datum.m > 5) return;
    if (!rng.chance(0.22)) return;

    var kandidaten = world.alleSpieler().filter(function (p) {
      return vorvertragMoeglich(world, p) && !world.istNutzerVerein(p.clubId) &&
        P.gesamt(p) >= 58;
    });
    if (!kandidaten.length) return;
    var p = rng.weighted(kandidaten, function (x) { return Math.pow(P.gesamt(x) / 60, 3); });
    if (!p) return;

    var interessenten = world.ligen.bl1.teams.concat(world.ligen.bl2.teams).filter(function (id) {
      if (id === p.clubId || world.istNutzerVerein(id)) return false;
      var club = world.vereine[id];
      var f = world.finanzen[id];
      if (!club || !f) return false;
      if (world.kaderVon(id).length >= (club.liga === 1 ? 29 : 28)) return false;
      return P.gesamt(p) >= P.niveauFuerVerein(club) - 4;
    });
    if (!interessenten.length) return;
    var zielId = rng.pick(interessenten);
    var ziel = world.vereine[zielId];
    vorvertragAnbieten(world, p.id, {
      gehalt: Math.round(P.gehaltsforderung(p, ziel, world) * rng.range(1.05, 1.25) / 500) * 500,
      jahre: p.alter <= 27 ? 4 : 2, handgeld: 0, rolle: 'stamm'
    }, zielId);
  }

  function vertraegePruefen(world) {
    var rng = world.rng;
    world.alleSpieler().forEach(function (p) {
      if (!p.clubId || !p.vertrag) return;
      var rest = p.vertrag.bis - world.tag;
      if (rest > 0) return;
      // Vertrag ausgelaufen
      var club = world.vereine[p.clubId];
      if (p.leihe) { leiheBeenden(world, p); return; }
      if (world.istNutzerVerein(p.clubId)) {
        world.nachricht({
          typ: 'vertrag', prioritaet: 3,
          titel: 'Vertrag ausgelaufen: ' + p.vorname + ' ' + p.nachname,
          text: p.nachname + ' hat den Verein ablösefrei verlassen. Der Kaderplatz ist frei.',
          spielerId: p.id
        });
      }
      p.exClubId = p.clubId;
      world.setzeVerein(p, null);
      p.vertrag = null;
      p.nummer = 0;
      p.kapitaen = false;
      if (club) FM.tactics.autoAufstellung(world, club, world.taktikVon(club.id));
    });
  }

  /** KI verlaengert auslaufende Vertraege ihrer Leistungstraeger. */
  function kiVerlaengerungen(world) {
    var rng = world.rng;
    world.vereinIds.forEach(function (clubId) {
      if (clubId === world.nutzerClubId) return;
      var club = world.vereine[clubId];
      if (!club || club.auslaendisch) return;
      var kader = world.kaderVon(clubId);
      kader.forEach(function (p) {
        if (!p.vertrag || p.leihe) return;
        var monate = P.restlaufzeitMonate(p, world);
        if (monate > 8) return;
        if (!rng.chance(0.05)) return;
        var rang = P.kaderRang(p, kader);
        var wille = rang <= 16 ? 0.8 : 0.35;
        if (p.alter >= 34) wille *= 0.4;
        if (!rng.chance(wille)) return;
        var jahre = p.alter <= 25 ? 4 : p.alter <= 30 ? 3 : 1;
        p.vertrag.bis = world.tag + jahre * 365;
        p.vertrag.gehalt = Math.round(P.gehaltsforderung(p, club, world) * rng.range(1.0, 1.15) / 500) * 500;
        p.vertrag.unterschrieben = world.tag;
      });
    });
  }

  FM.transfers = {
    neueTransferdaten: neueTransferdaten,
    ROLLENVERSPRECHEN: ROLLENVERSPRECHEN,
    SCOUT_REGIONEN: SCOUT_REGIONEN,
    verkaufsbereitschaft: verkaufsbereitschaft,
    pruefeAngebot: pruefeAngebot,
    pruefeVertragsangebot: pruefeVertragsangebot,
    fuehreTransferDurch: fuehreTransferDurch,
    tauschWert: tauschWert,
    tauschPaket: tauschPaket,
    fuehreLeiheDurch: fuehreLeiheDurch,
    leiheBeenden: leiheBeenden,
    scoutAuftragAnlegen: scoutAuftragAnlegen,
    scoutnetzVon: scoutnetzVon,
    netzStand: netzStand,
    netzLabel: netzLabel,
    scoutnetzWoche: scoutnetzWoche,
    scoutingTick: scoutingTick,
    berichtstext: berichtstext,
    suche: suche,
    kaderbedarf: kaderbedarf,
    kiTick: kiTick,
    kiVertragslosen: kiVertragslosen,
    angebotFuerNutzerspieler: angebotFuerNutzerspieler,
    rueckkaufKonditionen: rueckkaufKonditionen,
    rueckkaufOffen: rueckkaufOffen,
    rueckkaufZiehen: rueckkaufZiehen,
    angebotEntscheiden: angebotEntscheiden,
    angeboteAufraeumen: angeboteAufraeumen,
    verlaengerungAnbieten: verlaengerungAnbieten,
    ablösefreiVerpflichten: ablösefreiVerpflichten,
    vertraegePruefen: vertraegePruefen,
    vorvertragMoeglich: vorvertragMoeglich,
    vorvertragAnbieten: vorvertragAnbieten,
    vorvertraegePruefen: vorvertraegePruefen,
    kiVorvertraege: kiVorvertraege,
    kiVerlaengerungen: kiVerlaengerungen,
    freieNummer: freieNummer
  };

})(typeof window !== 'undefined' ? window : globalThis);
