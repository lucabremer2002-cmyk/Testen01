/* transfers.js - Transfermarkt, Transferverhandlungen und Vertragsverhandlungen. */
(function (g) {
  'use strict';

  var ROLLEN = [
    { id: 'star', name: 'Unverzichtbarer Star', faktor: 1.55, anspruch: 8 },
    { id: 'stamm', name: 'Stammspieler', faktor: 1.22, anspruch: 5 },
    { id: 'rotation', name: 'Rotationsspieler', faktor: 1.00, anspruch: 2 },
    { id: 'ergaenzung', name: 'Ergänzungsspieler', faktor: 0.86, anspruch: -2 },
    { id: 'talent', name: 'Talent für die Zukunft', faktor: 0.78, anspruch: -4 }
  ];

  var VERTRAGSDAUER = [1, 2, 3, 4, 5];

  var zaehler = 0;

  /* --- Bewertungen ---------------------------------------------------- */

  /* Wie wichtig ist ein Spieler fuer seinen aktuellen Verein? 0..1 */
  function wichtigkeit(spieler, kader) {
    var gleiche = kader.filter(function (p) { return Players.GRUPPE[p.pos] === Players.GRUPPE[spieler.pos]; });
    gleiche.sort(function (a, b) { return b.staerke - a.staerke; });
    var rang = gleiche.indexOf(spieler);
    var sortiert = kader.slice().sort(function (a, b) { return b.staerke - a.staerke; });
    var gesamtRang = sortiert.indexOf(spieler);
    var w = 1 - Util.clamp(gesamtRang / Math.max(1, kader.length - 1), 0, 1);
    if (rang === 0) w = Math.min(1, w + 0.22);
    if (rang > 2) w = Math.max(0, w - 0.18);
    return Util.clamp(w, 0, 1);
  }

  /* Ablöseforderung des abgebenden Vereins. */
  function forderung(spieler, kader, verkaeuferKlub, kaeuferKlub, saison) {
    var mw = spieler.marktwert;
    var f = 1.15;
    var w = wichtigkeit(spieler, kader);
    f += w * 0.85;
    var rest = spieler.vertragBis - saison;
    if (rest >= 4) f += 0.30;
    else if (rest === 3) f += 0.15;
    else if (rest === 1) f -= 0.28;
    else if (rest <= 0) f -= 0.75;
    if (spieler.transferliste) f -= 0.32;
    if (spieler.wechselwunsch) f -= 0.22;
    if (spieler.alter <= 21 && spieler.potenzial - spieler.staerke > 8) f += 0.35;
    if (spieler.alter >= 32) f -= 0.22;
    /* Reiche Klubs verkaufen ungern, reiche Kaeufer zahlen mehr. */
    var rufDiff = (verkaeuferKlub.ruf - (kaeuferKlub ? kaeuferKlub.ruf : 50)) / 100;
    f += Util.clamp(rufDiff, -0.25, 0.45);
    f = Util.clamp(f, 0.35, 3.4);
    return Math.max(5000, Math.round(mw * f / 5000) * 5000);
  }

  /* Wechselbereitschaft des Spielers zu einem bestimmten Verein. 0..1 */
  function wechselbereitschaft(spieler, altKlub, neuKlub, kader, saison) {
    var s = 0.35;
    var rufDiff = (neuKlub.ruf - altKlub.ruf) / 100;
    s += rufDiff * 1.25;
    var rest = spieler.vertragBis - saison;
    if (rest <= 0) s += 0.35; else if (rest === 1) s += 0.18; else if (rest >= 4) s -= 0.12;
    if (spieler.transferliste) s += 0.30;
    if (spieler.wechselwunsch) s += 0.35;
    if (kader) {
      var w = wichtigkeit(spieler, kader);
      /* Wer nicht spielt, will weg. */
      s += (0.45 - w) * 0.55;
    }
    if (spieler.alter >= 31) s -= 0.10;
    if (spieler.moral < 45) s += 0.15;
    return Util.clamp(s, 0.02, 0.98);
  }

  /* Gehaltsforderung fuer einen neuen Vertrag. */
  function gehaltsforderung(spieler, klub, rolleId, jahre, istVerlaengerung) {
    var rolle = Util.byId(ROLLEN, rolleId) || ROLLEN[2];
    var basis = Players.gehaltsBasis(spieler.staerke, klub.ruf, spieler.alter);
    var f = 1.0;
    f *= rolle.faktor;
    /* Wer schon hier ist, verlangt mindestens sein bisheriges Gehalt. */
    if (spieler.alter >= 30) f *= 1.08;
    if (spieler.alter <= 21) f *= 0.88;
    if (spieler.form > 70) f *= 1.06;
    if (jahre >= 4) f *= 0.96;
    if (jahre <= 1) f *= 1.10;
    var wunsch = basis * f;
    if (istVerlaengerung) wunsch = Math.max(wunsch, spieler.gehalt * 1.06);
    else wunsch = Math.max(wunsch, spieler.gehalt * 1.02);
    return Math.round(wunsch / 10) * 10;
  }

  function handgeldforderung(spieler, gehaltWoche, jahre) {
    var basis = gehaltWoche * 52 * 0.28;
    if (spieler.vertragBis <= 0) basis *= 1.8;   /* ablösefrei = mehr Handgeld */
    if (spieler.alter >= 30) basis *= 0.8;
    return Math.round(basis * (0.7 + jahre * 0.08) / 1000) * 1000;
  }

  /* --- Transferverhandlung mit dem Verein ----------------------------- */

  function verhandlungStarten(state, opt) {
    /* opt: {typ, spielerId, vonKlubId, zuKlubId, tag} */
    var v = {
      id: 'v' + (++zaehler),
      typ: opt.typ,
      spielerId: opt.spielerId,
      vonKlubId: opt.vonKlubId,
      zuKlubId: opt.zuKlubId,
      phase: 'verein',
      runde: 0,
      forderung: opt.forderung,
      startForderung: opt.forderung,
      letztesAngebot: null,
      einigungAbloese: null,
      historie: [],
      startTag: opt.tag,
      status: 'offen',
      abgelehnt: 0
    };
    return v;
  }

  /* Wert eines strukturierten Angebots aus Sicht des Verkaeufers. */
  function angebotsWert(angebot, marktwert) {
    var w = (angebot.sofort || 0);
    w += (angebot.raten || 0) * 0.88;
    w += (angebot.bonusEinsaetze || 0) * 0.45;
    w += (angebot.bonusAufstieg || 0) * 0.30;
    w += (angebot.weiterverkauf || 0) / 100 * marktwert * 0.35;
    return w;
  }

  function angebotGesamt(angebot) {
    return (angebot.sofort || 0) + (angebot.raten || 0) +
           (angebot.bonusEinsaetze || 0) + (angebot.bonusAufstieg || 0);
  }

  /* Antwort des abgebenden Vereins auf ein Angebot. */
  function vereinAntwort(rng, v, angebot, spieler, verkaeufer, kader) {
    v.runde++;
    v.letztesAngebot = angebot;
    var wert = angebotsWert(angebot, spieler.marktwert);
    var ford = v.forderung;
    v.historie.push({ von: 'kaeufer', text: 'Angebot: ' + Fmt.money(angebotGesamt(angebot)), wert: wert });

    if (wert >= ford * 0.97) {
      v.phase = 'spieler';
      v.einigungAbloese = angebot;
      v.historie.push({ von: 'verkaeufer', text: 'Einigung erzielt. Wir geben den Spieler für ' + Fmt.money(angebotGesamt(angebot)) + ' ab.' });
      return { ok: true, art: 'angenommen' };
    }
    if (v.runde >= 5) {
      v.phase = 'geplatzt';
      v.status = 'geplatzt';
      v.historie.push({ von: 'verkaeufer', text: 'Wir beenden die Gespräche. Das Angebot reicht nicht.' });
      return { ok: false, art: 'abgebrochen' };
    }
    if (wert >= ford * 0.62) {
      /* Gegenangebot: Forderung sinkt langsam. */
      var neu = Math.max(wert * 1.06, ford * (0.99 - v.runde * 0.045));
      v.forderung = Math.round(neu / 5000) * 5000;
      v.historie.push({ von: 'verkaeufer', text: 'Zu wenig. Unsere Forderung: ' + Fmt.money(v.forderung) + '.' });
      return { ok: false, art: 'gegenangebot', forderung: v.forderung };
    }
    v.abgelehnt++;
    if (v.abgelehnt >= 2) {
      v.phase = 'geplatzt';
      v.status = 'geplatzt';
      v.historie.push({ von: 'verkaeufer', text: 'Das ist weit von unseren Vorstellungen entfernt. Gespräche beendet.' });
      return { ok: false, art: 'abgebrochen' };
    }
    v.historie.push({ von: 'verkaeufer', text: 'Deutlich zu wenig. Wir fordern weiterhin ' + Fmt.money(v.forderung) + '.' });
    return { ok: false, art: 'abgelehnt', forderung: v.forderung };
  }

  /* --- Vertragsverhandlung mit dem Spieler ----------------------------- */

  function vertragBewerten(spieler, klub, altKlub, vertrag, kader, saison, istVerlaengerung) {
    /* vertrag: {gehalt, jahre, handgeld, rolle, ausstiegsklausel} */
    var wunschGehalt = gehaltsforderung(spieler, klub, vertrag.rolle, vertrag.jahre, istVerlaengerung);
    var wunschHandgeld = handgeldforderung(spieler, wunschGehalt, vertrag.jahre);
    var punkte = 0;

    var gq = vertrag.gehalt / Math.max(1, wunschGehalt);
    punkte += Util.clamp((gq - 1) * 130, -70, 55);

    var hq = wunschHandgeld > 0 ? (vertrag.handgeld || 0) / wunschHandgeld : 1;
    punkte += Util.clamp((hq - 1) * 22, -18, 18);

    var rolle = Util.byId(ROLLEN, vertrag.rolle) || ROLLEN[2];
    /* Passt die versprochene Rolle zur Staerke des Spielers im Kader? */
    var erwartet = kader ? wichtigkeit(spieler, kader) : 0.5;
    var versprochen = { star: 1.0, stamm: 0.78, rotation: 0.5, ergaenzung: 0.28, talent: 0.2 }[rolle.id];
    punkte += Util.clamp((versprochen - erwartet) * 45, -22, 26);

    if (!istVerlaengerung && altKlub) {
      punkte += Util.clamp((klub.ruf - altKlub.ruf) * 0.75, -35, 40);
    }
    /* Laufzeitwunsch */
    var wunschJahre = spieler.alter >= 31 ? 2 : (spieler.alter <= 22 ? 4 : 3);
    punkte -= Math.abs(vertrag.jahre - wunschJahre) * 5;

    if (vertrag.ausstiegsklausel) punkte += 9;
    if (spieler.moral < 40 && istVerlaengerung) punkte -= 12;

    return {
      punkte: punkte,
      wunschGehalt: wunschGehalt,
      wunschHandgeld: wunschHandgeld,
      wunschJahre: wunschJahre
    };
  }

  function spielerAntwort(rng, v, vertrag, spieler, klub, altKlub, kader, saison, istVerlaengerung) {
    var b = vertragBewerten(spieler, klub, altKlub, vertrag, kader, saison, istVerlaengerung);
    v.spielerRunde = (v.spielerRunde || 0) + 1;
    var schwelle = 6 - v.spielerRunde * 1.6 + rng.float(-3, 3);
    v.historie.push({ von: 'kaeufer', text: 'Vertragsangebot: ' + Fmt.money(vertrag.gehalt) + '/Woche, ' + vertrag.jahre + ' Jahre' });

    if (b.punkte >= schwelle) {
      v.phase = 'fertig';
      v.vertrag = vertrag;
      v.historie.push({ von: 'spieler', text: 'Der Spieler unterschreibt.' });
      return { ok: true, art: 'angenommen', bewertung: b };
    }
    if (v.spielerRunde >= 4) {
      v.phase = 'geplatzt';
      v.status = 'geplatzt';
      v.historie.push({ von: 'spieler', text: 'Der Spieler bricht die Gespräche ab.' });
      return { ok: false, art: 'abgebrochen', bewertung: b };
    }
    /* Der Spieler nennt seine Vorstellung. */
    var wunsch = {
      gehalt: Math.round(Math.max(b.wunschGehalt, vertrag.gehalt * 1.04) / 10) * 10,
      jahre: b.wunschJahre,
      handgeld: b.wunschHandgeld,
      rolle: vertrag.rolle,
      ausstiegsklausel: vertrag.ausstiegsklausel
    };
    var grund;
    if (b.punkte < -40) grund = 'Das Gehalt ist weit unter meinen Vorstellungen.';
    else if (vertrag.gehalt < b.wunschGehalt * 0.95) grund = 'Beim Gehalt müssen Sie nachlegen.';
    else if ((vertrag.handgeld || 0) < b.wunschHandgeld * 0.8) grund = 'Das Handgeld ist zu niedrig.';
    else grund = 'Über die Rolle und die Laufzeit müssen wir noch reden.';
    v.historie.push({ von: 'spieler', text: grund + ' Vorstellung: ' + Fmt.money(wunsch.gehalt) + '/Woche, ' +
      wunsch.jahre + ' Jahre, ' + Fmt.money(wunsch.handgeld) + ' Handgeld.' });
    v.spielerWunsch = wunsch;
    return { ok: false, art: 'gegenforderung', wunsch: wunsch, bewertung: b };
  }

  /* --- Marktsuche ------------------------------------------------------ */

  function marktSuche(state, filter) {
    var out = [];
    var saison = state.saison;
    var meinKlub = state.klubs[state.meinKlubId];
    var alle = Object.keys(state.spieler);
    for (var i = 0; i < alle.length; i++) {
      var p = state.spieler[alle[i]];
      if (p.klubId === state.meinKlubId) continue;
      if (filter.pos && filter.pos !== 'alle') {
        if (filter.pos.length <= 3 && Players.GRUPPE[p.pos] !== filter.pos && p.pos !== filter.pos) continue;
      }
      if (filter.maxAlter && p.alter > filter.maxAlter) continue;
      if (filter.minStaerke && p.staerke < filter.minStaerke) continue;
      if (filter.maxWert && p.marktwert > filter.maxWert) continue;
      if (filter.nation && filter.nation !== 'alle' && p.nation !== filter.nation) continue;
      var klub = p.klubId ? state.klubs[p.klubId] : null;
      if (filter.bereich === 'deutschland' && (!klub || klub.international)) continue;
      if (filter.bereich === 'international' && (!klub || !klub.international)) continue;
      if (filter.bereich === 'ablösefrei' && p.klubId) continue;
      if (filter.nurTransferliste && !p.transferliste && p.klubId) continue;
      if (filter.suche) {
        var q = filter.suche.toLowerCase();
        if (p.name.toLowerCase().indexOf(q) < 0 && (!klub || klub.name.toLowerCase().indexOf(q) < 0)) continue;
      }
      out.push(p);
    }
    var sort = filter.sortierung || 'marktwert';
    out.sort(function (a, b) {
      if (sort === 'staerke') return b.staerke - a.staerke;
      if (sort === 'alter') return a.alter - b.alter;
      if (sort === 'potenzial') return b.potenzial - a.potenzial;
      if (sort === 'name') return a.name < b.name ? -1 : 1;
      return b.marktwert - a.marktwert;
    });
    return out;
  }

  /* --- Leihe ----------------------------------------------------------- */

  function leihBewertung(spieler, altKlub, neuKlub, gehaltsanteil, kaufoption) {
    var p = 0;
    p += (neuKlub.ruf - altKlub.ruf) * 0.4;
    p += (gehaltsanteil - 50) * 0.35;
    if (spieler.alter <= 22) p += 14;
    if (spieler.alter >= 29) p -= 12;
    if (kaufoption) p += 8;
    return p;
  }

  g.Transfers = {
    ROLLEN: ROLLEN,
    VERTRAGSDAUER: VERTRAGSDAUER,
    wichtigkeit: wichtigkeit,
    forderung: forderung,
    wechselbereitschaft: wechselbereitschaft,
    gehaltsforderung: gehaltsforderung,
    handgeldforderung: handgeldforderung,
    verhandlungStarten: verhandlungStarten,
    angebotsWert: angebotsWert,
    angebotGesamt: angebotGesamt,
    vereinAntwort: vereinAntwort,
    vertragBewerten: vertragBewerten,
    spielerAntwort: spielerAntwort,
    marktSuche: marktSuche,
    leihBewertung: leihBewertung,
    setZaehler: function (n) { zaehler = n; },
    getZaehler: function () { return zaehler; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
