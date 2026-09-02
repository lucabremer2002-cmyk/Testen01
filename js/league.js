/* league.js - Spielplan, Tabellen, Kalender und Saisonwechsel. */
(function (g) {
  'use strict';

  var SAISON_START = 45;   /* 1. Spieltag: Tag 45 = Mitte August */
  var WINTERPAUSE = 30;    /* zusaetzliche Tage nach der Hinrunde */
  var SAISON_ENDE_ZIEL = 315;

  /* Doppelte Hin-/Rueckrunde nach dem Berger-Verfahren. */
  function spielplan(rng, teamIds) {
    var ids = teamIds.slice();
    if (ids.length % 2 === 1) ids.push(null);
    rng.shuffle(ids);
    var n = ids.length;
    var runden = [];
    var feld = ids.slice();
    for (var r = 0; r < n - 1; r++) {
      var paare = [];
      for (var i = 0; i < n / 2; i++) {
        var a = feld[i], b = feld[n - 1 - i];
        if (a === null || b === null) continue;
        /* Heimrecht abwechselnd, damit niemand nur auswaerts spielt */
        if ((r + i) % 2 === 0) paare.push({ heim: a, gast: b });
        else paare.push({ heim: b, gast: a });
      }
      runden.push(paare);
      var fest = feld[0];
      var rest = feld.slice(1);
      rest.unshift(rest.pop());
      feld = [fest].concat(rest);
    }
    /* Rueckrunde mit getauschtem Heimrecht */
    var rueck = runden.map(function (rd) {
      return rd.map(function (p) { return { heim: p.gast, gast: p.heim }; });
    });
    rng.shuffle(rueck);
    return runden.concat(rueck);
  }

  /* Verteilt die Spieltage auf Kalendertage inkl. Winterpause. */
  function spieltagTage(anzahl) {
    var halb = Math.ceil(anzahl / 2);
    var raum = SAISON_ENDE_ZIEL - SAISON_START - WINTERPAUSE;
    var abstand = Math.max(4, Math.floor(raum / (anzahl - 1)));
    var tage = [];
    for (var i = 0; i < anzahl; i++) {
      var t = SAISON_START + i * abstand + (i >= halb ? WINTERPAUSE : 0);
      tage.push(t);
    }
    return tage;
  }

  function leereTabelle(klubId) {
    return {
      klubId: klubId, sp: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0, punkte: 0,
      abzug: 0, form: []
    };
  }

  function tabelleSortieren(zeilen) {
    return zeilen.slice().sort(function (a, b) {
      var pa = a.punkte - a.abzug, pb = b.punkte - b.abzug;
      if (pb !== pa) return pb - pa;
      var da = a.tore - a.gegentore, db = b.tore - b.gegentore;
      if (db !== da) return db - da;
      if (b.tore !== a.tore) return b.tore - a.tore;
      return a.klubId < b.klubId ? -1 : 1;
    });
  }

  function ergebnisEintragen(tab, heimId, gastId, th, tg) {
    var h = tab[heimId], gst = tab[gastId];
    h.sp++; gst.sp++;
    h.tore += th; h.gegentore += tg;
    gst.tore += tg; gst.gegentore += th;
    if (th > tg) { h.s++; h.punkte += 3; gst.n++; h.form.push('S'); gst.form.push('N'); }
    else if (th < tg) { gst.s++; gst.punkte += 3; h.n++; h.form.push('N'); gst.form.push('S'); }
    else { h.u++; gst.u++; h.punkte++; gst.punkte++; h.form.push('U'); gst.form.push('U'); }
    if (h.form.length > 6) h.form.shift();
    if (gst.form.length > 6) gst.form.shift();
  }

  /* Erstellt die Saisonstruktur fuer eine Liga. */
  function ligaAufsetzen(rng, liga, klubIds) {
    var plan = spielplan(rng, klubIds);
    var tage = spieltagTage(plan.length);
    var spieltage = plan.map(function (paare, i) {
      return {
        nr: i + 1,
        tag: tage[i],
        gespielt: false,
        partien: paare.map(function (p) {
          return { heim: p.heim, gast: p.gast, th: null, tg: null, bericht: null };
        })
      };
    });
    var tabelle = {};
    klubIds.forEach(function (id) { tabelle[id] = leereTabelle(id); });
    return {
      id: liga.id, name: liga.name, kurz: liga.kurz, stufe: liga.stufe, farbe: liga.farbe,
      tvGeld: liga.tvGeld, siegPraemie: liga.siegPraemie,
      aufstieg: liga.aufstieg, direktAb: liga.direktAb, relegation: liga.relegation,
      klubs: klubIds.slice(),
      spieltage: spieltage,
      tabelle: tabelle,
      aktuellerSpieltag: 0,
      abschluss: null
    };
  }

  function tabelleAls(liga) {
    return tabelleSortieren(liga.klubs.map(function (id) { return liga.tabelle[id]; }));
  }

  function platzVon(liga, klubId) {
    var t = tabelleAls(liga);
    for (var i = 0; i < t.length; i++) if (t[i].klubId === klubId) return i + 1;
    return 0;
  }

  /* Naechstes Spiel eines Klubs ab einem bestimmten Tag. */
  function naechstesSpiel(liga, klubId, abTag) {
    for (var i = 0; i < liga.spieltage.length; i++) {
      var st = liga.spieltage[i];
      if (st.gespielt || st.tag < abTag) continue;
      for (var j = 0; j < st.partien.length; j++) {
        var p = st.partien[j];
        if (p.heim === klubId || p.gast === klubId) {
          return { spieltag: st, partie: p, heim: p.heim === klubId };
        }
      }
    }
    return null;
  }

  function spieleVon(liga, klubId) {
    var out = [];
    liga.spieltage.forEach(function (st) {
      st.partien.forEach(function (p) {
        if (p.heim === klubId || p.gast === klubId) {
          out.push({ nr: st.nr, tag: st.tag, partie: p, heim: p.heim === klubId, gespielt: st.gespielt });
        }
      });
    });
    return out;
  }

  g.League = {
    SAISON_START: SAISON_START,
    WINTERPAUSE: WINTERPAUSE,
    SAISON_ENDE_ZIEL: SAISON_ENDE_ZIEL,
    spielplan: spielplan,
    spieltagTage: spieltagTage,
    ligaAufsetzen: ligaAufsetzen,
    leereTabelle: leereTabelle,
    tabelleSortieren: tabelleSortieren,
    tabelleAls: tabelleAls,
    ergebnisEintragen: ergebnisEintragen,
    platzVon: platzVon,
    naechstesSpiel: naechstesSpiel,
    spieleVon: spieleVon
  };
})(typeof window !== 'undefined' ? window : globalThis);
