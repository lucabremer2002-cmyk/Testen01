/* saison.js - Saisonabschluss: Relegation, Auf- und Abstieg, Entwicklung,
 * Vertragsende und Aufbau der neuen Spielzeit. */
(function (g) {
  'use strict';

  /* Klubs aus Nordrhein-Westfalen - nur sie wechseln zwischen 3. Liga und
     Regionalliga West, alle anderen gehen in andere Regionalligen. */
  var WEST_STAEDTE = ['Dortmund', 'Essen', 'Duisburg', 'Köln', 'Verl', 'Aachen', 'Bochum',
    'Gelsenkirchen', 'Düsseldorf', 'Mönchengladbach', 'Paderborn', 'Bielefeld', 'Münster',
    'Wuppertal', 'Bocholt', 'Rödinghausen', 'Ahlen', 'Rheda-Wiedenbrück', 'Lotte', 'Gütersloh',
    'Siegen', 'Schermbeck', 'Hennef', 'Düren', 'Velbert', 'Leverkusen', 'Hamm', 'Monheim',
    'Nettetal', 'Meerbusch', 'Hilden', 'Tönisvorst', 'Vreden', 'Holzwickede', 'Lippstadt',
    'Ratingen', 'Sonsbeck', 'Wegberg', 'Garbsen'];

  function istWest(klub) {
    return WEST_STAEDTE.indexOf(klub.stadt) >= 0;
  }

  /* --- Relegation ------------------------------------------------------ */

  function hinRueckspiel(state, klubA, klubB) {
    /* klubA = Klub der hoeheren Liga (Rueckspiel daheim) */
    function einzelspiel(heim, gast) {
      var ligaDummy = { tabelle: {}, klubs: [heim.id, gast.id], name: 'Relegation', id: 'rel', siegPraemie: 0 };
      ligaDummy.tabelle[heim.id] = League.leereTabelle(heim.id);
      ligaDummy.tabelle[gast.id] = League.leereTabelle(gast.id);
      var ctx = Game.matchKontext(state, ligaDummy, heim.id, gast.id);
      var m = Match.neu(Game.rng, ctx);
      Match.restSimulieren(m);
      return m;
    }
    var hin = einzelspiel(klubB, klubA);
    var rueck = einzelspiel(klubA, klubB);
    var gesamtA = hin.gast.tore + rueck.heim.tore;
    var gesamtB = hin.heim.tore + rueck.gast.tore;
    var elfmeter = null;
    if (gesamtA === gesamtB) {
      var staerkeA = klubA.ruf, staerkeB = klubB.ruf;
      var pA = staerkeA / (staerkeA + staerkeB);
      var siegerA = Game.rng.next() < pA;
      elfmeter = siegerA ? '5:4 nach Elfmeterschießen' : '4:5 nach Elfmeterschießen';
      gesamtA += siegerA ? 1 : 0;
      gesamtB += siegerA ? 0 : 1;
    }
    return {
      hin: { heim: klubB.id, gast: klubA.id, th: hin.heim.tore, tg: hin.gast.tore },
      rueck: { heim: klubA.id, gast: klubB.id, th: rueck.heim.tore, tg: rueck.gast.tore },
      gesamtA: gesamtA, gesamtB: gesamtB,
      elfmeter: elfmeter,
      siegerId: gesamtA >= gesamtB ? klubA.id : klubB.id
    };
  }

  /* --- Saison abschliessen --------------------------------------------- */

  function saisonAbschliessen(state) {
    var bericht = {
      saison: state.saison,
      ligen: [],
      relegation: [],
      auf: [], ab: [],
      meinKlub: null
    };

    /* Abschlusstabellen und Praemien */
    state.ligaReihenfolge.forEach(function (lid) {
      var liga = state.ligen[lid];
      var tab = League.tabelleAls(liga);
      liga.abschluss = tab.map(function (z) { return z.klubId; });
      var n = tab.length;
      tab.forEach(function (z, i) {
        var k = state.klubs[z.klubId];
        var faktor = 1 - i / Math.max(1, n - 1);
        var praemie = Math.round(liga.tvGeld * 0.08 * (0.4 + faktor * 1.2));
        Finance.buchen(k.finanzen, state.tag, 'Prämie', 'Platzprämie ' + liga.name + ' (Platz ' + (i + 1) + ')', praemie, 'Prämien');
      });
      var meister = state.klubs[tab[0].klubId];
      meister.saisonStats = meister.saisonStats || {};
      meister.historie.push({ saison: state.saison, liga: liga.name, platz: 1, titel: true });
      var titelBonus = 0;
      Object.keys(meister.finanzen.sponsoren).forEach(function (sl) {
        var sp = meister.finanzen.sponsoren[sl];
        if (sp) titelBonus += sp.titelBonus;
      });
      if (titelBonus) Finance.buchen(meister.finanzen, state.tag, 'Sponsoring', 'Meisterprämie der Sponsoren', titelBonus, 'Sponsoring');
      Game.news(state, meister.name + ' ist Meister der ' + liga.name + '!', lid);
      bericht.ligen.push({
        ligaId: lid, name: liga.name,
        tabelle: tab.map(function (z, i) {
          return { platz: i + 1, klubId: z.klubId, punkte: z.punkte - z.abzug, tore: z.tore, gegentore: z.gegentore, sp: z.sp, s: z.s, u: z.u, n: z.n };
        })
      });
    });

    /* Relegationsspiele */
    var paare = [
      { hoch: 'bl1', runter: 'bl2' },
      { hoch: 'bl2', runter: 'l3' }
    ];
    var relSieger = {};
    paare.forEach(function (paar) {
      var oben = state.ligen[paar.hoch], unten = state.ligen[paar.runter];
      if (!oben || !unten || !oben.relegation) return;
      var obenTab = oben.abschluss;
      var untenTab = unten.abschluss;
      var platzOben = obenTab.length - oben.direktAb - 1;      /* z. B. Platz 16 von 18 */
      var klubA = state.klubs[obenTab[platzOben]];
      var klubB = state.klubs[untenTab[unten.aufstieg]];        /* z. B. Dritter */
      if (!klubA || !klubB) return;
      var e = hinRueckspiel(state, klubA, klubB);
      e.ligaHoch = paar.hoch; e.ligaRunter = paar.runter;
      e.klubA = klubA.id; e.klubB = klubB.id;
      bericht.relegation.push(e);
      relSieger[paar.hoch] = e.siegerId;
      Game.news(state, 'Relegation ' + oben.name + ': ' + state.klubs[e.siegerId].name + ' setzt sich durch.', paar.hoch);
    });

    /* Auf- und Abstieg berechnen */
    var bewegungen = ligenNeuVerteilen(state, relSieger, bericht);
    bericht.auf = bewegungen.auf;
    bericht.ab = bewegungen.ab;

    /* Europapokal fuer die Bundesliga */
    var bl = state.ligen.bl1;
    if (bl) {
      var europa = [
        { name: 'Champions League', betrag: 62000000 },
        { name: 'Champions League', betrag: 55000000 },
        { name: 'Champions League', betrag: 50000000 },
        { name: 'Champions League', betrag: 46000000 },
        { name: 'Europa League', betrag: 19000000 },
        { name: 'Conference League', betrag: 8500000 }
      ];
      Object.keys(state.klubs).forEach(function (id) { state.klubs[id].europapokal = null; });
      bl.abschluss.slice(0, 6).forEach(function (kid, i) {
        state.klubs[kid].europapokal = europa[i];
      });
    }

    /* Steuern auf den Saisonueberschuss - der letzte Regulator, damit ein
       gut gefuehrter Verein Gewinn macht, aber kein Vermoegen anhaeuft. */
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (!k.finanzen) return;
      var ein = Util.sum(Object.keys(k.finanzen.saison.einnahmen), function (kk) {
        return k.finanzen.saison.einnahmen[kk];
      });
      var aus = Util.sum(Object.keys(k.finanzen.saison.ausgaben), function (kk) {
        return k.finanzen.saison.ausgaben[kk];
      });
      var gewinn = ein - aus;
      if (gewinn > 0) {
        /* Progressiv: ein maßvoller Überschuss bleibt weitgehend im Verein,
           ein sehr hoher wird deutlich stärker belastet. */
        var milde = Math.min(gewinn, ein * 0.10);
        var hoch = Math.max(0, gewinn - milde);
        var steuer = milde * 0.25 + hoch * 0.45;
        Finance.buchen(k.finanzen, state.tag, 'Steuern', 'Steuern auf den Jahresüberschuss',
          -Math.round(steuer), 'Steuern');
      }
    });

    bericht.meinKlub = meinSaisonfazit(state, bericht);
    return bericht;
  }

  /* Verteilt alle Vereine auf die Ligen der neuen Saison.
   * Grundgedanke: erst fuer jeden Verein die neue Liga bestimmen, dann die
   * Ligen daraus neu zusammensetzen. So kann kein Verein verloren gehen. */
  function ligenNeuVerteilen(state, relSieger, bericht) {
    var auf = [], ab = [];
    var ligen = state.ligaReihenfolge.map(function (id) { return state.ligen[id]; });
    var neueLiga = {};
    ligen.forEach(function (l) {
      l.klubs.forEach(function (id) { neueLiga[id] = l.id; });
    });

    for (var i = 0; i < ligen.length; i++) {
      var liga = ligen[i];
      var unten = ligen[i + 1];
      var tab = liga.abschluss;

      /* Absteiger dieser Liga */
      var absteiger = [];
      for (var d = 0; d < liga.direktAb; d++) {
        var x = tab[tab.length - 1 - d];
        if (x) absteiger.push(x);
      }
      if (liga.relegation && unten) {
        var platzOben = tab.length - liga.direktAb - 1;
        var klubOben = tab[platzOben];
        if (klubOben && relSieger[liga.id] && relSieger[liga.id] !== klubOben) absteiger.push(klubOben);
      }

      /* Aufsteiger aus der Liga darunter */
      var aufsteiger = [];
      if (unten) {
        for (var a = 0; a < unten.aufstieg; a++) {
          var y = unten.abschluss[a];
          if (y) aufsteiger.push(y);
        }
        if (liga.relegation) {
          var dritter = unten.abschluss[unten.aufstieg];
          if (dritter && relSieger[liga.id] === dritter) aufsteiger.push(dritter);
        }
      }

      aufsteiger.forEach(function (id) {
        neueLiga[id] = liga.id;
        auf.push({ klubId: id, von: unten.id, nach: liga.id });
      });

      absteiger.forEach(function (id) {
        if (unten && liga.id !== 'l3') {
          neueLiga[id] = unten.id;
          ab.push({ klubId: id, von: liga.id, nach: unten.id });
        }
      });

      /* Sonderfall 3. Liga: nur ein Absteiger passt in die Regionalliga West,
         die uebrigen wechseln in andere Regionalligen und verlassen die
         sichtbare Spielwelt. Der Verein des Spielers bleibt immer drin. */
      if (liga.id === 'l3') {
        var meinDabei = absteiger.indexOf(state.meinKlubId) >= 0;
        var nachRLW = null;
        if (meinDabei) {
          nachRLW = state.meinKlubId;
        } else {
          for (var w = 0; w < absteiger.length; w++) {
            if (istWest(state.klubs[absteiger[w]])) { nachRLW = absteiger[w]; break; }
          }
        }
        absteiger.forEach(function (id) {
          if (id === nachRLW) {
            neueLiga[id] = 'rlw';
            ab.push({ klubId: id, von: 'l3', nach: 'rlw' });
          } else {
            neueLiga[id] = null;
            ab.push({ klubId: id, von: 'l3', nach: null });
          }
        });
      }

      /* Regionalliga West: Absteiger gehen in die Oberliga. */
      if (liga.id === 'rlw') {
        absteiger.forEach(function (id) {
          if (id === state.meinKlubId) return;    /* der Spieler bleibt drin */
          neueLiga[id] = null;
          ab.push({ klubId: id, von: 'rlw', nach: null });
        });
        if (absteiger.indexOf(state.meinKlubId) >= 0) {
          /* Statt des Spielers steigt der naechstschlechtere Verein ab. */
          for (var e = tab.length - liga.direktAb - 1; e >= 0; e--) {
            var ersatz = tab[e];
            if (ersatz && ersatz !== state.meinKlubId && neueLiga[ersatz] === 'rlw') {
              neueLiga[ersatz] = null;
              ab.push({ klubId: ersatz, von: 'rlw', nach: null });
              break;
            }
          }
        }
      }
    }

    /* Vereine, die die Spielwelt verlassen, wandern in den Ersatzpool. */
    Object.keys(neueLiga).forEach(function (id) {
      if (neueLiga[id] !== null) return;
      var k = state.klubs[id];
      k.wartend = true;
      k.ligaId = null;
      var pool = k.stufe <= 3 ? state.poolL3 : state.poolRLW;
      if (pool.indexOf(id) < 0) pool.push(id);
    });

    /* Wer gerade abgestiegen ist, darf nicht im selben Sommer zurueckkehren. */
    var geradeRaus = {};
    ab.forEach(function (b) { if (b.nach === null) geradeRaus[b.klubId] = true; });

    /* Neue Ligalisten aufbauen und aus den Pools auffuellen. */
    var neueKlubs = {};
    ligen.forEach(function (l) { neueKlubs[l.id] = []; });
    Object.keys(neueLiga).forEach(function (id) {
      if (neueLiga[id] && neueKlubs[neueLiga[id]]) neueKlubs[neueLiga[id]].push(id);
    });

    ligen.forEach(function (l) {
      var soll = l.klubs.length;
      var pool = l.id === 'rlw' ? state.poolRLW : state.poolL3;
      var stufe = l.stufe;
      var wache = 0;
      while (neueKlubs[l.id].length < soll && wache++ < 40) {
        var neu = poolZiehen(state, pool, neueKlubs[l.id], stufe, geradeRaus);
        if (!neu) break;
        neueKlubs[l.id].push(neu);
        auf.push({ klubId: neu, von: null, nach: l.id });
      }
      /* Sollte ein Pool leer sein, wird die Liga notfalls verkleinert -
         besser als ein kaputter Spielplan. */
      while (neueKlubs[l.id].length > soll) {
        var weg = neueKlubs[l.id].pop();
        state.klubs[weg].wartend = true;
        state.klubs[weg].ligaId = null;
      }
    });

    state.neueLigaVerteilung = neueKlubs;
    return { auf: auf, ab: ab };
  }

  function poolZiehen(state, pool, schonDrin, stufe, gesperrt) {
    var frei = pool.filter(function (id) {
      if (gesperrt && gesperrt[id]) return false;
      return schonDrin.indexOf(id) < 0 && state.klubs[id] && state.klubs[id].wartend;
    });
    if (!frei.length && gesperrt) {
      /* Notfall: lieber einen Rueckkehrer als eine unvollstaendige Liga. */
      frei = pool.filter(function (id) {
        return schonDrin.indexOf(id) < 0 && state.klubs[id] && state.klubs[id].wartend;
      });
    }
    if (!frei.length) return null;
    /* Klubs mit gutem Ruf steigen eher auf. */
    frei.sort(function (a, b) { return state.klubs[b].ruf - state.klubs[a].ruf; });
    var kandidat = frei[Game.rng.int(0, Math.min(3, frei.length - 1))];
    var klub = state.klubs[kandidat];
    klub.wartend = false;
    klub.stufe = stufe;
    var idx = pool.indexOf(kandidat);
    if (idx >= 0) pool.splice(idx, 1);
    if (!klub.kader.length) {
      kaderNachgenerieren(state, klub, stufe);
    }
    return kandidat;
  }

  function kaderNachgenerieren(state, klub, stufe) {
    var kader = Players.kaderErzeugen(Game.rng, klub, Game.basisStaerke(klub), state.saison, function (r) {
      return Names.nationFuerLiga(r, stufe);
    });
    kader.forEach(function (p) { state.spieler[p.id] = p; klub.kader.push(p.id); });
    if (!klub.finanzen) klub.finanzen = Finance.finanzenAufsetzen(Game.rng, klub, stufe);
    if (!klub.jugend) {
      klub.jugend = Jugend.aufsetzen(klub);
      Jugend.jahrgangErzeugen(Game.rng, state, klub);
    }
    if (!klub.verliehen) klub.verliehen = [];
    Finance.SLOTS.forEach(function (slot) {
      if (klub.finanzen.sponsoren[slot.id]) return;
      var ang = Finance.angeboteErzeugen(Game.rng, klub, klub.finanzen, slot.id, state.saison, stufe, 1);
      Finance.sponsorAbschliessen(klub.finanzen, ang[1], state.saison, state.tag);
    });
  }

  function meinSaisonfazit(state, bericht) {
    var mein = state.klubs[state.meinKlubId];
    if (!mein || !mein.ligaId) return null;
    var liga = state.ligen[mein.ligaId];
    var platz = liga.abschluss.indexOf(mein.id) + 1;
    var ziel = mein.vorstand.zielPlatz;
    var diff = ziel - platz;
    var vertrauenAlt = mein.vorstand.vertrauen;
    mein.vorstand.vertrauen = Util.clamp(Math.round(mein.vorstand.vertrauen + diff * 4.5), 0, 100);
    var aufgestiegen = bericht.auf.some(function (b) { return b.klubId === mein.id; });
    var abgestiegen = bericht.ab.some(function (b) { return b.klubId === mein.id; });
    if (aufgestiegen) mein.vorstand.vertrauen = Util.clamp(mein.vorstand.vertrauen + 25, 0, 100);
    if (abgestiegen) mein.vorstand.vertrauen = Util.clamp(mein.vorstand.vertrauen - 22, 0, 100);
    if (mein.finanzen.kontostand < 0) mein.vorstand.vertrauen = Util.clamp(mein.vorstand.vertrauen - 10, 0, 100);

    /* Aufstiegsbonus der Sponsoren */
    if (aufgestiegen) {
      var bonus = 0;
      Object.keys(mein.finanzen.sponsoren).forEach(function (sl) {
        var sp = mein.finanzen.sponsoren[sl];
        if (sp) bonus += sp.aufstiegBonus;
      });
      if (bonus) Finance.buchen(mein.finanzen, state.tag, 'Sponsoring', 'Aufstiegsprämie der Sponsoren', bonus, 'Sponsoring');
    }

    return {
      platz: platz, ziel: ziel, liga: liga.name,
      aufgestiegen: aufgestiegen, abgestiegen: abgestiegen,
      vertrauenAlt: vertrauenAlt, vertrauen: mein.vorstand.vertrauen,
      entlassen: mein.vorstand.vertrauen < 12
    };
  }

  /* --- Neue Saison ------------------------------------------------------ */

  function spielerAltern(state) {
    var abgaenge = [];
    var freieSpieler = [];
    Object.keys(state.spieler).forEach(function (pid) {
      var p = state.spieler[pid];
      p.alter++;
      var klub = p.klubId ? state.klubs[p.klubId] : null;
      var einsatz = Util.clamp(p.stats.minuten / (34 * 90), 0, 1);
      var training = klub && klub.finanzen && klub.finanzen.stadion.module.trainingszentrum ? 0.8 : 0.35;
      if (klub) training += (klub.ruf / 100) * 0.5;
      Players.entwickeln(Game.rng, p, training, einsatz);

      /* Jugendspieler stehen nicht im Profikader - fuer sie gelten weder
         Vertragsende noch Karriereende. */
      if (p.jugend) {
        p.stats = { spiele: 0, tore: 0, vorlagen: 0, gelb: 0, rot: 0, noten: [], minuten: 0 };
        p.fitness = Game.rng.int(88, 100);
        p.marktwert = Players.marktwert(p, state.saison + 1);
        if (p.einschaetzung && klub && klub.jugend) {
          /* Mit einem Jahr mehr Beobachtung wird die Einschaetzung genauer. */
          var g = Jugend.scoutStufe(klub.jugend.scouting).genauigkeit;
          p.einschaetzung = Jugend.einschaetzung(Game.rng, p, Math.min(0.97, g + 0.12));
        }
        return;
      }

      /* Karriereende */
      var endet = false;
      if (p.alter >= 39) endet = true;
      else if (p.alter >= 35 && Game.rng.chance(0.35 + (60 - p.staerke) * 0.012)) endet = true;
      else if (p.alter >= 33 && p.staerke < 40 && Game.rng.chance(0.3)) endet = true;
      if (endet) {
        abgaenge.push(p);
        return;
      }
      p.stats = { spiele: 0, tore: 0, vorlagen: 0, gelb: 0, rot: 0, noten: [], minuten: 0 };
      p.fitness = Game.rng.int(85, 100);
      p.sperre = 0;
      p.marktwert = Players.marktwert(p, state.saison + 1);
      if (p.klubId && p.vertragBis <= state.saison) freieSpieler.push(p);
    });

    abgaenge.forEach(function (p) {
      var klub = p.klubId ? state.klubs[p.klubId] : null;
      if (klub) klub.kader = klub.kader.filter(function (id) { return id !== p.id; });
      if (klub && klub.id === state.meinKlubId) {
        Game.post(state, 'Karriereende: ' + p.name,
          p.name + ' beendet mit ' + p.alter + ' Jahren seine Karriere. Vielen Dank für die geleisteten Dienste!', 'info');
      }
      delete state.spieler[p.id];
    });

    return freieSpieler;
  }

  function vertraegeAbwickeln(state, freieSpieler) {
    freieSpieler.forEach(function (p) {
      var klub = state.klubs[p.klubId];
      if (!klub) return;
      if (klub.id === state.meinKlubId) {
        klub.kader = klub.kader.filter(function (id) { return id !== p.id; });
        p.klubId = null;
        Game.post(state, 'Vertragsende: ' + p.name,
          p.name + ' hat den Verein ablösefrei verlassen, weil der Vertrag nicht verlängert wurde.', 'warnung');
        return;
      }
      /* KI-Klubs verlaengern meistens. */
      var wichtig = Transfers.wichtigkeit(p, Game.kaderVon(state, klub));
      var verlaengern = Game.rng.next() < (0.62 + wichtig * 0.34) && p.alter < 35;
      if (verlaengern) {
        p.vertragBis = state.saison + 1 + Game.rng.int(1, 3);
        p.gehalt = Math.round(Transfers.gehaltsforderung(p, klub, 'rotation', 3, true));
      } else {
        klub.kader = klub.kader.filter(function (id) { return id !== p.id; });
        p.klubId = null;
        p.gehalt = 0;
      }
    });
  }

  function vereinsloseSpieler(state) {
    var out = [];
    Object.keys(state.spieler).forEach(function (id) {
      var p = state.spieler[id];
      if (!p.klubId) out.push(p);
    });
    return out;
  }

  /* Wer zwei Sommer lang keinen Verein findet, beendet seine Laufbahn. */
  function vereinsloseAufraeumen(state) {
    vereinsloseSpieler(state).forEach(function (p) {
      p.ohneVerein = (p.ohneVerein || 0) + 1;
      if (p.ohneVerein >= 2 || p.alter >= 34) delete state.spieler[p.id];
    });
  }

  function nachwuchsErzeugen(state) {
    Object.keys(state.klubs).forEach(function (id) {
      var klub = state.klubs[id];
      if (klub.wartend || !klub.kader) return;
      var soll = klub.international ? 24 : 27;
      var fehlt = soll - klub.kader.length;
      if (fehlt <= 0) return;
      var stufe = klub.international ? 1 : klub.stufe;
      var lz = klub.finanzen && klub.finanzen.stadion.module.trainingszentrum;
      /* Zuerst passende vereinslose Spieler verpflichten. */
      if (klub.id !== state.meinKlubId) {
        var zielStaerke = Game.basisStaerke(klub);
        var frei = vereinsloseSpieler(state).filter(function (p) {
          return p.staerke >= zielStaerke - 9 && p.staerke <= zielStaerke + 5;
        }).sort(function (a, b) { return b.staerke - a.staerke; });
        var nehmen = Math.min(fehlt, frei.length, 3);
        for (var f = 0; f < nehmen; f++) {
          var fp = frei[f];
          fp.klubId = klub.id;
          fp.nummer = Players.nummerFuerKader(fp, Game.kaderVon(state, klub));
          fp.vertragBis = state.saison + 1 + Game.rng.int(1, 3);
          fp.gehalt = Players.gehaltsBasis(fp.staerke, klub.ruf, fp.alter,
            klub.international ? 1 : klub.stufe);
          klub.kader.push(fp.id);
          fehlt--;
        }
      }
      for (var i = 0; i < Math.min(fehlt, 5); i++) {
        var pos = Game.rng.pick(Players.POSITIONEN);
        var st = Game.rng.gauss(Game.basisStaerke(klub) - 13 + (lz ? 3 : 0), 5, 8, 92);
        var p = Players.spielerErzeugen(Game.rng, {
          pos: pos, alter: Game.rng.int(17, 20), staerke: st,
          nation: klub.international ? Names.nationFuerLand(Game.rng, klub.land) : Names.nationFuerLiga(Game.rng, stufe),
          klubId: klub.id, klubRuf: klub.ruf, saison: state.saison + 1
        });
        if (lz) p.potenzial = Util.clamp(p.potenzial + Game.rng.int(2, 7), p.staerke, 99);
        p.nummer = Players.nummerFuerKader(p, Game.kaderVon(state, klub));
        state.spieler[p.id] = p;
        klub.kader.push(p.id);
        if (klub.id === state.meinKlubId && p.potenzial - p.staerke > 14) {
          Game.post(state, 'Talent aus der Jugend: ' + p.name,
            p.name + ' (' + p.alter + ', ' + p.pos + ') rückt aus der eigenen Jugend in den Kader auf. ' +
            'Die Scouts trauen ihm eine Menge zu.', 'gut');
        }
      }
    });
  }

  function neueSaisonStarten(state) {
    var neueVerteilung = state.neueLigaVerteilung;
    state.saison++;
    state.tag = 0;
    state.letzteSpieltagErgebnisse = [];
    state.anstehendesSpiel = null;
    state.verhandlungen = [];

    /* Ligen neu aufsetzen */
    state.ligaReihenfolge.forEach(function (lid) {
      var alt = state.ligen[lid];
      var ligaDaten = DataClubs.LIGEN.filter(function (l) { return l.id === lid; })[0];
      var klubIds = (neueVerteilung && neueVerteilung[lid]) ? neueVerteilung[lid] : alt.klubs;
      klubIds.forEach(function (id) {
        var k = state.klubs[id];
        k.ligaId = lid;
        k.stufe = ligaDaten.stufe;
        k.wartend = false;
        if (!k.kader.length) kaderNachgenerieren(state, k, ligaDaten.stufe);
      });
      state.ligen[lid] = League.ligaAufsetzen(Game.rng, ligaDaten, klubIds);
      Game.zieleSetzen(state, state.ligen[lid]);
    });

    /* Preise an die neue Liga anpassen, Budgets neu setzen */
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (!k.finanzen) return;
      if (k.ligaId) {
        var ref = Finance.PREIS_REFERENZ[k.stufe];
        var sek = k.finanzen.stadion.sektoren;
        if (id !== state.meinKlubId) {
          sek.steh.preis = ref.steh; sek.sitz.preis = ref.sitz; sek.vip.preis = ref.vip;
        }
      }
      k.finanzen.saison = { einnahmen: {}, ausgaben: {} };
      Game.budgetsSetzen(state, k);
      k.aufstellung = null;
      Game.aufstellungPruefen(state, k, 0);
    });

    /* Sponsorenvertraege ablaufen lassen */
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (!k.finanzen) return;
      Object.keys(k.finanzen.sponsoren).forEach(function (slot) {
        var sp = k.finanzen.sponsoren[slot];
        if (!sp) return;
        if (sp.bisSaison <= state.saison) {
          k.finanzen.sponsoren[slot] = null;
          if (slot === 'stadionname') k.finanzen.stadion.name = k.finanzen.stadion.originalName;
          if (id === state.meinKlubId) {
            Game.post(state, 'Sponsorenvertrag ausgelaufen',
              'Der Vertrag mit ' + sp.firma + ' (' + slot + ') ist ausgelaufen. Im Bereich Sponsoring warten neue Angebote.', 'geld');
          } else {
            /* KI schliesst sofort neu ab */
            var ang = Finance.angeboteErzeugen(Game.rng, k, k.finanzen, slot, state.saison, k.international ? 1 : k.stufe, 1);
            Finance.sponsorAbschliessen(k.finanzen, ang[Game.rng.int(0, 2)], state.saison, 0);
          }
        }
      });
      k.finanzen.sponsorAngebote = {};
    });

    /* Neuer Pokalwettbewerb mit dem aktuellen Teilnehmerfeld. */
    state.pokal = Pokal.aufsetzen(state, Game.rng);

    Game.sponsorenPruefen(state);
    state.neueLigaVerteilung = null;
  }

  /* Alle Leihen enden mit der Saison. */
  function leihenBeenden(state) {
    Object.keys(state.spieler).forEach(function (id) {
      var p = state.spieler[id];
      if (p.leihe) Game.leiheBeenden(state, p);
    });
  }

  function saisonwechsel(state) {
    var bericht = saisonAbschliessen(state);
    leihenBeenden(state);
    var frei = spielerAltern(state);
    vertraegeAbwickeln(state, frei);
    nachwuchsErzeugen(state);
    vereinsloseAufraeumen(state);
    neueSaisonStarten(state);
    state.saisonHistorie.unshift({
      saison: bericht.saison,
      ligen: bericht.ligen.map(function (l) {
        return { ligaId: l.ligaId, name: l.name, tabelle: l.tabelle.slice(0, 6) };
      }),
      meinKlub: bericht.meinKlub
    });
    if (state.saisonHistorie.length > 20) state.saisonHistorie.pop();
    return bericht;
  }

  g.Saison = {
    saisonwechsel: saisonwechsel,
    leihenBeenden: leihenBeenden,
    vereinsloseSpieler: vereinsloseSpieler,
    saisonAbschliessen: saisonAbschliessen,
    neueSaisonStarten: neueSaisonStarten,
    hinRueckspiel: hinRueckspiel,
    istWest: istWest,
    kaderNachgenerieren: kaderNachgenerieren
  };
})(typeof window !== 'undefined' ? window : globalThis);
