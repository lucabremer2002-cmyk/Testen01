/* pokal.js - DFB-Pokal.
 *
 * 64 Mannschaften: alle Vereine der Bundesliga, 2. Bundesliga und 3. Liga
 * sowie die acht bestplatzierten Klubs der Regionalliga West als
 * Landespokalvertreter. K.-o.-System in einem Spiel, bei Gleichstand
 * Verlängerung und Elfmeterschießen. In den ersten beiden Runden hat der
 * klassentiefere Verein Heimrecht - wie im echten Wettbewerb.
 */
(function (g) {
  'use strict';

  var RUNDEN = [
    { nr: 1, name: '1. Runde', tag: 41, praemie: 209000 },
    { nr: 2, name: '2. Runde', tag: 118, praemie: 419000 },
    { nr: 3, name: 'Achtelfinale', tag: 200, praemie: 838000 },
    { nr: 4, name: 'Viertelfinale', tag: 246, praemie: 1700000 },
    { nr: 5, name: 'Halbfinale', tag: 274, praemie: 3400000 },
    { nr: 6, name: 'Finale', tag: 302, praemie: 2900000 }
  ];
  var SIEGPRAEMIE = 4300000;   /* zusätzlich für den Pokalsieger */

  /* Teilnehmerfeld aus dem Stand der Ligen. */
  function teilnehmer(state) {
    var ids = [];
    ['bl1', 'bl2', 'l3'].forEach(function (lid) {
      var liga = state.ligen[lid];
      if (liga) ids = ids.concat(liga.klubs);
    });
    var rlw = state.ligen.rlw;
    if (rlw) {
      /* Die acht Besten der Regionalliga West vertreten die Landespokale. */
      var reihenfolge = rlw.abschluss && rlw.abschluss.length
        ? rlw.abschluss.slice()
        : rlw.klubs.slice().sort(function (a, b) {
            return state.klubs[b].ruf - state.klubs[a].ruf;
          });
      ids = ids.concat(reihenfolge.slice(0, 8));
    }
    return ids;
  }

  function auslosen(rng, state, ids, rundeNr) {
    var liste = ids.slice();
    rng.shuffle(liste);
    var partien = [];
    for (var i = 0; i + 1 < liste.length; i += 2) {
      var a = liste[i], b = liste[i + 1];
      /* In den ersten beiden Runden hat der klassentiefere Verein Heimrecht. */
      if (rundeNr <= 2) {
        var sa = state.klubs[a].stufe || 1, sb = state.klubs[b].stufe || 1;
        if (sb > sa) { var t = a; a = b; b = t; }
      }
      partien.push({ heim: a, gast: b, th: null, tg: null, verlaengerung: false,
        elfmeter: null, bericht: null, zuschauer: 0 });
    }
    return partien;
  }

  function aufsetzen(state, rng) {
    var ids = teilnehmer(state);
    var runden = RUNDEN.map(function (r) {
      return { nr: r.nr, name: r.name, tag: r.tag, praemie: r.praemie,
        partien: [], gespielt: false };
    });
    runden[0].partien = auslosen(rng, state, ids, 1);
    return {
      name: 'DFB-Pokal',
      runden: runden,
      aktuelleRunde: 1,
      sieger: null,
      teilnehmer: ids.length
    };
  }

  function runde(pokal, nr) {
    return pokal.runden.filter(function (r) { return r.nr === nr; })[0];
  }

  /* Runde, die an diesem Tag ansteht - oder null. */
  function rundeAmTag(state, tag) {
    if (!state.pokal) return null;
    for (var i = 0; i < state.pokal.runden.length; i++) {
      var r = state.pokal.runden[i];
      if (r.tag === tag && !r.gespielt && r.partien.length) return r;
    }
    return null;
  }

  function userPartie(state, r) {
    for (var i = 0; i < r.partien.length; i++) {
      var p = r.partien[i];
      if (p.th === null && (p.heim === state.meinKlubId || p.gast === state.meinKlubId)) return p;
    }
    return null;
  }

  /* Ein Pokalspiel bis zur Entscheidung führen. */
  function partieAustragen(state, r, partie) {
    var heim = state.klubs[partie.heim];
    var liga = heim.ligaId ? state.ligen[heim.ligaId] : state.ligen.bl1;
    var m = Game.pokalSpielVorbereiten(state, liga, partie);
    Match.restSimulieren(m);
    entscheiden(state, r, partie, m);
    return m;
  }

  /* Verlängerung und Elfmeterschießen anhängen, dann verbuchen. */
  function entscheiden(state, r, partie, m) {
    if (m.heim.tore === m.gast.tore) {
      partie.verlaengerung = true;
      Match.verlaengern(m);
      Match.restSimulieren(m);
    }
    abschliessen(state, r, partie, m);
    return m;
  }

  /* Verbucht ein fertig gespieltes Pokalspiel und bestimmt den Sieger.
     Steht es nach der Verlängerung unentschieden, entscheidet das
     Elfmeterschießen - sofern es nicht schon vorliegt. */
  function abschliessen(state, r, partie, m) {
    if (m.heim.tore === m.gast.tore && !partie.elfmeter) {
      partie.elfmeter = Match.elfmeterschiessen(m);
    }
    Game.ergebnisVerbuchen(state, null, partie, m, r.nr, { pokal: true, runde: r });
    partie.sieger = partie.elfmeter
      ? (partie.elfmeter.heim > partie.elfmeter.gast ? partie.heim : partie.gast)
      : (partie.th > partie.tg ? partie.heim : partie.gast);
    return partie.sieger;
  }

  function rundeFertig(state, r) {
    if (r.partien.some(function (p) { return p.th === null; })) return false;
    r.gespielt = true;
    var sieger = r.partien.map(function (p) { return p.sieger; });

    /* Prämie für das Erreichen der nächsten Runde. */
    var naechste = runde(state.pokal, r.nr + 1);
    sieger.forEach(function (id) {
      var k = state.klubs[id];
      if (!k || !k.finanzen) return;
      var betrag = naechste ? naechste.praemie : SIEGPRAEMIE;
      Finance.buchen(k.finanzen, state.tag, 'Pokal',
        naechste ? 'Einzug ins ' + naechste.name : 'Pokalsieg', betrag, 'Pokalprämien');
    });

    if (naechste) {
      naechste.partien = auslosen(Game.rng, state, sieger, naechste.nr);
      state.pokal.aktuelleRunde = naechste.nr;
      if (sieger.indexOf(state.meinKlubId) >= 0) {
        var geg = null;
        naechste.partien.forEach(function (p) {
          if (p.heim === state.meinKlubId) geg = { klub: state.klubs[p.gast], heim: true };
          else if (p.gast === state.meinKlubId) geg = { klub: state.klubs[p.heim], heim: false };
        });
        Game.post(state, 'Pokal: Auslosung ' + naechste.name,
          'Sie stehen im ' + naechste.name + '.' +
          (geg ? ' Der Gegner heißt ' + geg.klub.name + ' – ' +
            (geg.heim ? 'Heimspiel' : 'Auswärtsspiel') + '.' : ''), 'gut');
      }
    } else {
      state.pokal.sieger = sieger[0];
      var s = state.klubs[sieger[0]];
      Game.news(state, s.name + ' gewinnt den DFB-Pokal.', null);
      if (sieger[0] === state.meinKlubId) {
        Game.post(state, 'Pokalsieger!',
          'Sie haben den DFB-Pokal gewonnen. Die Siegprämie von ' + Fmt.money(SIEGPRAEMIE) +
          ' ist gutgeschrieben.', 'gut');
      }
    }
    return true;
  }

  /* Ganze Runde austragen, wahlweise ohne die Partie des Spielers. */
  function rundeAustragen(state, r, ohneUserPartie) {
    r.partien.forEach(function (p) {
      if (p.th !== null) return;
      if (ohneUserPartie && (p.heim === state.meinKlubId || p.gast === state.meinKlubId)) return;
      partieAustragen(state, r, p);
    });
    return rundeFertig(state, r);
  }

  /* Nächste Pokalpartie des eigenen Vereins. */
  function naechstePartie(state) {
    if (!state.pokal) return null;
    for (var i = 0; i < state.pokal.runden.length; i++) {
      var r = state.pokal.runden[i];
      if (r.gespielt || !r.partien.length) continue;
      for (var j = 0; j < r.partien.length; j++) {
        var p = r.partien[j];
        if (p.th !== null) continue;
        if (p.heim === state.meinKlubId || p.gast === state.meinKlubId) {
          return { runde: r, partie: p, heim: p.heim === state.meinKlubId };
        }
      }
    }
    return null;
  }

  function ausgeschieden(state) {
    if (!state.pokal) return true;
    return !naechstePartie(state) && !state.pokal.sieger;
  }

  g.Pokal = {
    RUNDEN: RUNDEN,
    SIEGPRAEMIE: SIEGPRAEMIE,
    aufsetzen: aufsetzen,
    teilnehmer: teilnehmer,
    auslosen: auslosen,
    runde: runde,
    rundeAmTag: rundeAmTag,
    userPartie: userPartie,
    partieAustragen: partieAustragen,
    entscheiden: entscheiden,
    abschliessen: abschliessen,
    rundeAustragen: rundeAustragen,
    rundeFertig: rundeFertig,
    naechstePartie: naechstePartie,
    ausgeschieden: ausgeschieden
  };
})(typeof window !== 'undefined' ? window : globalThis);
