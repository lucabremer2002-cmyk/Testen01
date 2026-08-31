/* game.js - Spielwelt, Tagesablauf, KI, Saisonwechsel, Speicherstand. */
(function (g) {
  'use strict';

  var VERSION = 1;
  var SPEICHER_KEY = 'fussballmanager_speicherstand_v1';

  var Game = {
    state: null,
    rng: null
  };

  /* =================== Weltaufbau =================== */

  /* Spielstaerke haengt vor allem an der Ligastufe und erst danach am Ruf
     des Vereins. So bleiben die vier Ligen sauber voneinander getrennt. */
  var LIGA_BASIS   = { 1: 61, 2: 51, 3: 43, 4: 31 };
  var LIGA_SPANNE  = { 1: 19, 2: 12, 3: 10, 4: 11 };
  var LIGA_RUFSPANNE = { 1: [62, 96], 2: [53, 75], 3: [39, 54], 4: [21, 36] };

  function basisStaerke(klub) {
    if (typeof klub === 'number') klub = { ruf: klub, stufe: 1 };
    if (klub.international || !klub.stufe) {
      return Util.clamp(55 + (klub.ruf - 60) * 0.714, 24, 84);
    }
    var stufe = Util.clamp(klub.stufe, 1, 4);
    var spanne = LIGA_RUFSPANNE[stufe];
    var rel = Util.clamp((klub.ruf - spanne[0]) / (spanne[1] - spanne[0]), 0, 1);
    return LIGA_BASIS[stufe] + rel * LIGA_SPANNE[stufe];
  }

  function klubAnlegen(daten, ligaId, stufe) {
    var k = {};
    Object.keys(daten).forEach(function (key) { k[key] = daten[key]; });
    k.ligaId = ligaId || null;
    k.stufe = stufe;
    k.kader = [];
    k.taktik = Match.standardTaktik();
    k.aufstellung = null;
    k.finanzen = null;
    k.vorstand = { vertrauen: 62, zielPlatz: 10, ziel: '', bewertung: [] };
    k.europapokal = null;
    k.saisonStats = { titel: 0 };
    k.historie = [];
    return k;
  }

  function weltErzeugen(seed, saison) {
    var rng = new RNG(seed);
    var state = {
      version: VERSION,
      seed: seed,
      saison: saison,
      tag: 0,
      meinKlubId: null,
      managerName: 'Trainer',
      klubs: {},
      spieler: {},
      ligen: {},
      ligaReihenfolge: [],
      intlKlubs: [],
      verhandlungen: [],
      postfach: [],
      news: [],
      saisonHistorie: [],
      anstehendesSpiel: null,
      letzteSpieltagErgebnisse: [],
      poolL3: DataPool.REGIONALLIGA_REST.map(function (c) { return c.id; }),
      poolRLW: DataPool.OBERLIGA_WEST.map(function (c) { return c.id; }),
      statistik: { transfers: [] },
      einstellungen: { autoAufstellung: false, spieltempo: 'normal' }
    };

    /* Deutsche Ligen */
    DataClubs.LIGEN.forEach(function (liga) {
      var ids = [];
      liga.teams.forEach(function (t) {
        var k = klubAnlegen(t, liga.id, liga.stufe);
        state.klubs[k.id] = k;
        ids.push(k.id);
      });
      state.ligen[liga.id] = League.ligaAufsetzen(rng, liga, ids);
      state.ligaReihenfolge.push(liga.id);
    });

    /* Ersatzvereine (noch ohne Liga, warten auf Auf-/Abstieg) */
    DataPool.REGIONALLIGA_REST.forEach(function (t) {
      var k = klubAnlegen(t, null, 4); k.wartend = true; state.klubs[k.id] = k;
    });
    DataPool.OBERLIGA_WEST.forEach(function (t) {
      var k = klubAnlegen(t, null, 5); k.wartend = true; state.klubs[k.id] = k;
    });

    /* Internationale Klubs - nur Transfermarkt */
    DataIntl.CLUBS.forEach(function (t) {
      var k = klubAnlegen(t, null, 0);
      k.international = true;
      k.kapazitaet = 30000;
      k.stadion = t.name + ' Stadion';
      state.klubs[k.id] = k;
      state.intlKlubs.push(k.id);
    });

    /* Kader - wartende Ersatzvereine bekommen ihren Kader erst beim Aufstieg. */
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (k.wartend) {
        k.finanzen = Finance.finanzenAufsetzen(rng, k, Math.min(4, k.stufe));
        return;
      }
      var stufe = k.international ? 1 : Util.clamp(k.stufe, 1, 4);
      var kader;
      if (k.international) {
        kader = Players.kaderErzeugen(rng, k, basisStaerke(k), saison, function (r) {
          return Names.nationFuerLand(r, k.land);
        });
        /* Internationale Kader etwas kleiner halten - spart Speicher. */
        kader = kader.slice(0, 24);
      } else {
        kader = Players.kaderErzeugen(rng, k, basisStaerke(k), saison, function (r) {
          return Names.nationFuerLiga(r, stufe);
        });
      }
      kader.forEach(function (p) { state.spieler[p.id] = p; k.kader.push(p.id); });
      k.finanzen = Finance.finanzenAufsetzen(rng, k, k.international ? 1 : k.stufe);
      k.aufstellung = Match.autoAufstellung(kaderVon(state, k), k.taktik.formation, 0);
    });

    /* Startsponsoren fuer alle Vereine */
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (k.wartend) return;
      Finance.SLOTS.forEach(function (slot) {
        var ang = Finance.angeboteErzeugen(rng, k, k.finanzen, slot.id, saison, k.international ? 1 : k.stufe, 1);
        var gewaehlt = ang[1];
        gewaehlt.bisSaison = saison + rng.int(1, 3);
        Finance.sponsorAbschliessen(k.finanzen, gewaehlt, saison, 0);
      });
      budgetsSetzen(state, k);
    });

    /* Vorstandsziele */
    state.ligaReihenfolge.forEach(function (lid) {
      zieleSetzen(state, state.ligen[lid]);
    });

    /* Europapokalteilnehmer der Vorsaison (nach Ruf) */
    var europa = [
      { name: 'Champions League', betrag: 62000000 },
      { name: 'Champions League', betrag: 55000000 },
      { name: 'Champions League', betrag: 50000000 },
      { name: 'Champions League', betrag: 46000000 },
      { name: 'Europa League', betrag: 19000000 },
      { name: 'Conference League', betrag: 8500000 }
    ];
    state.ligen.bl1.klubs.slice()
      .sort(function (a, b) { return state.klubs[b].ruf - state.klubs[a].ruf; })
      .slice(0, 6)
      .forEach(function (id, i) { state.klubs[id].europapokal = europa[i]; });

    Game.rng = rng;
    return state;
  }

  function kaderVon(state, klub) {
    return klub.kader.map(function (id) { return state.spieler[id]; }).filter(Boolean);
  }

  function zieleSetzen(state, liga) {
    var klubs = liga.klubs.map(function (id) { return state.klubs[id]; });
    var sortiert = klubs.slice().sort(function (a, b) { return b.ruf - a.ruf; });
    sortiert.forEach(function (k, i) {
      var platz = i + 1;
      var n = liga.klubs.length;
      /* Der Vorstand erwartet ungefaehr die Platzierung, die der Kader hergibt -
         der schwaechste Verein soll aber immerhin die Klasse halten. */
      var letzterSicherer = Math.max(1, n - liga.direktAb - liga.relegation);
      var ziel = Util.clamp(Math.round(platz * 0.85), 1, letzterSicherer);
      k.vorstand.zielPlatz = ziel;
      if (ziel <= 1) k.vorstand.ziel = 'Die Meisterschaft ist Pflicht.';
      else if (ziel <= 3) k.vorstand.ziel = 'Ein Platz unter den ersten ' + ziel + ' wird erwartet.';
      else if (ziel <= liga.aufstieg + 1 && liga.aufstieg > 0) k.vorstand.ziel = 'Der Aufstieg ist das erklärte Ziel.';
      else if (ziel >= n - liga.direktAb - 1) k.vorstand.ziel = 'Der Klassenerhalt muss gesichert werden.';
      else k.vorstand.ziel = 'Ein einstelliger Tabellenplatz wäre gut, mindestens aber Platz ' + ziel + '.';
    });
  }

  function budgetsSetzen(state, k) {
    var fin = k.finanzen;
    var umsatz = Finance.jahresUmsatzSchaetzung(k, fin, k.international ? 1 : k.stufe);
    var gehaltssumme = Util.sum(kaderVon(state, k), function (p) { return p.gehalt; });
    fin.gehaltsbudget = Math.round(Math.max(gehaltssumme * 1.14, umsatz * 0.52 / 52));
    fin.transferbudget = Math.max(0, Math.round(fin.kontostand * 0.55 + umsatz * 0.12));
  }

  /* =================== Postfach & Nachrichten =================== */

  function post(state, betreff, text, art, daten) {
    state.postfach.unshift({
      id: 'm' + state.postfach.length + '_' + state.tag,
      tag: state.tag, saison: state.saison,
      betreff: betreff, text: text, art: art || 'info',
      gelesen: false, daten: daten || null
    });
    if (state.postfach.length > 120) state.postfach.pop();
  }

  function news(state, text, ligaId) {
    state.news.unshift({ tag: state.tag, text: text, ligaId: ligaId || null });
    if (state.news.length > 60) state.news.pop();
  }

  /* =================== Spielbetrieb =================== */

  function istTransferfenster(state) {
    var t = state.tag;
    return (t >= 0 && t <= 62) || (t >= 184 && t <= 215);
  }

  function aufstellungPruefen(state, klub, heute) {
    var kader = kaderVon(state, klub);
    var auf = klub.aufstellung;
    var gueltig = auf && auf.elf && auf.elf.length === 11 && auf.elf.every(function (pid) {
      var p = state.spieler[pid];
      return p && p.klubId === klub.id && p.verletztBis <= heute && p.sperre <= 0;
    });
    if (!gueltig) {
      klub.aufstellung = Match.autoAufstellung(kader, klub.taktik.formation, heute);
      return false;
    }
    /* Gesperrte/verletzte Bankspieler entfernen */
    auf.bank = auf.bank.filter(function (pid) {
      var p = state.spieler[pid];
      return p && p.klubId === klub.id && p.verletztBis <= heute && p.sperre <= 0 && auf.elf.indexOf(pid) < 0;
    });
    return true;
  }

  function matchKontext(state, liga, heimId, gastId) {
    var heim = state.klubs[heimId], gast = state.klubs[gastId];
    aufstellungPruefen(state, heim, state.tag);
    aufstellungPruefen(state, gast, state.tag);
    var spielerMap = {};
    heim.kader.concat(gast.kader).forEach(function (pid) { spielerMap[pid] = state.spieler[pid]; });
    var sh = Match.seiteAufbauen(heimId, kaderVon(state, heim), heim.aufstellung, JSON.parse(JSON.stringify(heim.taktik)), spielerMap);
    var sg = Match.seiteAufbauen(gastId, kaderVon(state, gast), gast.aufstellung, JSON.parse(JSON.stringify(gast.taktik)), spielerMap);
    var tabelle = liga.tabelle[heimId];
    var formWert = tabelle.form.length
      ? Util.sum(tabelle.form, function (f) { return f === 'S' ? 1 : (f === 'U' ? 0.5 : 0); }) / tabelle.form.length
      : 0.5;
    var bes = Finance.zuschauer(Game.rng, heim, heim.finanzen, {
      gegnerRuf: gast.ruf, platz: League.platzVon(liga, heimId), teams: liga.klubs.length,
      form: formWert, stufe: heim.stufe
    });
    var kap = Finance.kapazitaet(heim.finanzen.stadion);
    return {
      heimKlub: heim, gastKlub: gast, heimSeite: sh, gastSeite: sg, spielerMap: spielerMap,
      zuschauer: bes, auslastung: kap ? bes / kap : 0.5,
      heimVorteil: 1, ligaId: liga.id
    };
  }

  function spielSimulieren(state, liga, partie, spieltagNr) {
    var ctx = matchKontext(state, liga, partie.heim, partie.gast);
    ctx.spieltag = spieltagNr;
    var m = Match.neu(Game.rng, ctx);
    /* KI-Wechsel in der zweiten Halbzeit */
    while (!m.beendet) {
      Match.minute(m);
      if (m.minute === 60 || m.minute === 72 || m.minute === 80) {
        Match.autoWechsel(m, 'heim', state.tag);
        Match.autoWechsel(m, 'gast', state.tag);
      }
    }
    ergebnisVerbuchen(state, liga, partie, m, spieltagNr);
    return m;
  }

  /* Uebertraegt ein beendetes Spiel in Tabelle, Statistiken und Finanzen. */
  function ergebnisVerbuchen(state, liga, partie, m, spieltagNr) {
    partie.th = m.heim.tore;
    partie.tg = m.gast.tore;
    partie.zuschauer = m.zuschauer;
    partie.bericht = m.ereignisse.filter(function (e) {
      return e.typ === 'tor' || e.typ === 'rot' || e.typ === 'gelbrot';
    }).map(function (e) { return { min: e.min, typ: e.typ, text: e.text, klubId: e.klubId }; });

    League.ergebnisEintragen(liga.tabelle, partie.heim, partie.gast, m.heim.tore, m.gast.tore);

    [[m.heim, m.gast], [m.gast, m.heim]].forEach(function (paar) {
      var seite = paar[0], gegner = paar[1];
      Object.keys(seite.eingesetzt).forEach(function (pid) {
        var p = state.spieler[pid];
        if (!p) return;
        var e = seite.eingesetzt[pid];
        var minuten = Math.max(0, Math.min(90, e.bis) - e.von);
        p.stats.spiele++;
        p.stats.minuten += minuten;
        if (p.bonusEinsaetze && p.stats.spiele >= p.bonusEinsaetze.spiele) {
          var vonKlub = state.klubs[p.bonusEinsaetze.klubId];
          var meinKlubJetzt = state.klubs[p.klubId];
          if (vonKlub && vonKlub.finanzen) {
            Finance.buchen(vonKlub.finanzen, state.tag, 'Transfer',
              'Einsatzbonus ' + p.name, p.bonusEinsaetze.betrag, 'Transfererlöse');
          }
          if (meinKlubJetzt && meinKlubJetzt.finanzen) {
            Finance.buchen(meinKlubJetzt.finanzen, state.tag, 'Transfer',
              'Einsatzbonus fällig: ' + p.name, -p.bonusEinsaetze.betrag, 'Transferausgaben');
            if (p.klubId === state.meinKlubId) {
              post(state, 'Einsatzbonus fällig',
                p.name + ' hat ' + p.bonusEinsaetze.spiele + ' Pflichtspiele absolviert. Der vereinbarte Bonus von ' +
                Fmt.money(p.bonusEinsaetze.betrag) + ' wurde an ' + (vonKlub ? vonKlub.name : 'den früheren Verein') + ' überwiesen.', 'geld');
            }
          }
          p.bonusEinsaetze = null;
        }
        p.stats.tore += e.tore;
        p.stats.vorlagen += e.vorlagen;
        p.stats.noten.push(e.note);
        if (p.stats.noten.length > 40) p.stats.noten.shift();
        /* Fitness und Form */
        var verbrauch = minuten * (0.30 + (100 - p.attrs.kondition) * 0.0055) * seite.werte.konditionMod;
        p.fitness = Util.clamp(Math.round(p.fitness - verbrauch), 12, 100);
        var formZiel = Util.clamp(100 - (e.note - 1) * 20, 5, 98);
        p.form = Math.round(Util.clamp(p.form * 0.72 + formZiel * 0.28, 5, 98));
        var ergebnis = seite.tore - gegner.tore;
        p.moral = Util.clamp(Math.round(p.moral + (ergebnis > 0 ? 2.5 : (ergebnis < 0 ? -2.2 : 0.3))), 5, 100);
      });
      /* Karten */
      Object.keys(seite.gelb).forEach(function (pid) {
        var p = state.spieler[pid];
        if (!p) return;
        p.stats.gelb++;
        if (p.stats.gelb % 5 === 0) {
          p.sperre = Math.max(p.sperre, 1);
          if (p.klubId === state.meinKlubId) {
            post(state, 'Gelbsperre: ' + p.name, p.name + ' hat die fünfte Gelbe Karte gesehen und fehlt im nächsten Spiel.', 'warnung');
          }
        }
      });
      seite.rot.forEach(function (pid) {
        var p = state.spieler[pid];
        if (!p) return;
        p.stats.rot++;
        var spiele = Game.rng.chance(0.5) ? 2 : 3;
        p.sperre = Math.max(p.sperre, spiele);
        if (p.klubId === state.meinKlubId) {
          post(state, 'Sperre: ' + p.name, p.name + ' wurde des Feldes verwiesen und ist für ' + spiele + ' Spiele gesperrt.', 'warnung');
        }
      });
      /* Spielsperren abbauen: alle nicht eingesetzten gesperrten Spieler */
      var klub = state.klubs[seite.klubId];
      klub.kader.forEach(function (pid) {
        var p = state.spieler[pid];
        if (p && p.sperre > 0 && !seite.eingesetzt[pid]) p.sperre--;
      });
    });

    /* Verletzungen */
    m.verletzungen.forEach(function (v) {
      var p = state.spieler[v.spielerId];
      if (!p) return;
      var info = Players.verletzen(Game.rng, p, state.tag);
      if (p.klubId === state.meinKlubId) {
        post(state, 'Verletzung: ' + p.name, p.name + ' hat sich eine Verletzung zugezogen (' + info.art +
          ') und fällt etwa ' + info.tage + ' Tage aus.', 'warnung');
      }
    });

    /* Finanzen: Heimeinnahmen, Praemien, Sponsorenboni */
    var heimK = state.klubs[partie.heim], gastK = state.klubs[partie.gast];
    var ein = Finance.spieltagEinnahmen(heimK.finanzen, m.zuschauer);
    heimK.finanzen.stadion.zuletztZuschauer = m.zuschauer;
    Finance.buchen(heimK.finanzen, state.tag, 'Spieltag',
      'Heimspiel gegen ' + gastK.name + ' (' + Fmt.num(m.zuschauer) + ' Zuschauer)', ein.gesamt, 'Spieltagseinnahmen');

    [[heimK, m.heim.tore > m.gast.tore], [gastK, m.gast.tore > m.heim.tore]].forEach(function (paar) {
      var k = paar[0], sieg = paar[1];
      if (!sieg) return;
      Finance.buchen(k.finanzen, state.tag, 'Prämie', 'Siegprämie ' + liga.name, liga.siegPraemie, 'Prämien');
      var bonus = 0;
      Object.keys(k.finanzen.sponsoren).forEach(function (sl) {
        var sp = k.finanzen.sponsoren[sl];
        if (sp) bonus += sp.siegBonus;
      });
      if (bonus > 0) Finance.buchen(k.finanzen, state.tag, 'Sponsoring', 'Siegbonus der Sponsoren', bonus, 'Sponsoring');
    });

    state.letzteSpieltagErgebnisse.push({
      ligaId: liga.id, spieltag: spieltagNr,
      heim: partie.heim, gast: partie.gast, th: partie.th, tg: partie.tg
    });
    return m;
  }

  /* Spieltag komplett austragen (optional ohne die Partie des Spielers). */
  function spieltagAustragen(state, liga, st, ohneUserPartie) {
    st.partien.forEach(function (p) {
      if (p.th !== null) return;
      if (ohneUserPartie && (p.heim === state.meinKlubId || p.gast === state.meinKlubId)) return;
      spielSimulieren(state, liga, p, st.nr);
    });
    var offen = st.partien.some(function (p) { return p.th === null; });
    if (!offen) {
      st.gespielt = true;
      liga.aktuellerSpieltag = Math.max(liga.aktuellerSpieltag, st.nr);
      spieltagNachrichten(state, liga, st);
    }
  }

  function spieltagNachrichten(state, liga, st) {
    var tab = League.tabelleAls(liga);
    if (st.nr >= 3) {
      news(state, liga.name + ', ' + st.nr + '. Spieltag: ' + state.klubs[tab[0].klubId].name +
        ' führt die Tabelle mit ' + (tab[0].punkte - tab[0].abzug) + ' Punkten an.', liga.id);
    }
  }

  /* =================== Tagesablauf =================== */

  function wochenAbrechnung(state) {
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      var fin = k.finanzen;
      if (!fin) return;
      var kader = kaderVon(state, k);
      var stufe = k.international ? 1 : k.stufe;

      /* Gehaelter */
      var gehalt = Util.sum(kader, function (p) { return p.gehalt; });
      if (gehalt > 0) Finance.buchen(fin, state.tag, 'Gehalt', 'Spielergehälter', -gehalt, 'Spielergehälter');

      /* Personal, Nachwuchs, Stadionunterhalt. In den unteren Ligen arbeitet
         ein grosser Teil des Vereins ehrenamtlich - entsprechend guenstiger. */
      var personalQuote = [0.26, 0.26, 0.22, 0.16, 0.11][Math.min(4, stufe)];
      var personal = gehalt * personalQuote + 2500 * (5 - Math.min(4, stufe));
      Finance.buchen(fin, state.tag, 'Personal', 'Trainerstab & Verwaltung', -Math.round(personal), 'Personal');
      /* Mitgliedsbeitraege, Vereinsheim, kleine Sponsoren */
      var sonstige = Finance.grundNachfrage(k.ruf) * 0.55 + 900;
      Finance.buchen(fin, state.tag, 'Sonstiges', 'Mitgliedsbeiträge & Sonstiges', Math.round(sonstige), 'Sonstige Einnahmen');
      var unterhalt = Finance.unterhaltWoche(fin, stufe);
      Finance.buchen(fin, state.tag, 'Stadion', 'Stadionunterhalt', -Math.round(unterhalt), 'Stadionunterhalt');

      /* Sponsoring */
      var sp = Finance.sponsorEinnahmenWoche(fin);
      if (sp > 0) Finance.buchen(fin, state.tag, 'Sponsoring', 'Sponsorenzahlungen', Math.round(sp), 'Sponsoring');

      /* Fernsehgeld nach Tabellenplatz */
      if (k.ligaId) {
        var liga = state.ligen[k.ligaId];
        var n = liga.klubs.length;
        var platz = League.platzVon(liga, k.id);
        /* Die Verteilung ist bewusst steil: Spitzenplaetze bringen deutlich
           mehr Medienerloese als das Tabellenende. */
        var rel = 1 - (platz - 1) / Math.max(1, n - 1);
        var faktor = 0.40 + 1.40 * Math.pow(rel, 1.6);
        var tv = liga.tvGeld * faktor / 52;
        Finance.buchen(fin, state.tag, 'TV-Geld', 'Medienerlöse', Math.round(tv), 'TV-Gelder');
      }
      if (k.europapokal) {
        Finance.buchen(fin, state.tag, 'Europapokal', k.europapokal.name, Math.round(k.europapokal.betrag / 52), 'Europapokal');
      }

      /* Merchandising */
      var erfolg = 0.5;
      if (k.ligaId) {
        var l2 = state.ligen[k.ligaId];
        erfolg = 1 - (League.platzVon(l2, k.id) - 1) / Math.max(1, l2.klubs.length - 1);
      }
      var merch = Finance.merchandisingWoche(k, fin, erfolg);
      Finance.buchen(fin, state.tag, 'Merchandising', 'Fanartikel & Sonstiges', Math.round(merch), 'Merchandising');

      /* Transfer-Ratenzahlungen */
      Finance.verpflichtungenWoche(fin, state.tag, state);

      /* Kredite */
      var kr = Finance.kreditWoche(fin, state.tag);
      if (kr.zinsen + kr.tilgung > 0) {
        Finance.buchen(fin, state.tag, 'Bank', 'Kreditrate (Zins ' + Fmt.money(kr.zinsen) + ')',
          -Math.round(kr.zinsen + kr.tilgung), 'Kreditrate');
        if (kr.abgeloest && k.id === state.meinKlubId) {
          post(state, 'Kredit abbezahlt', 'Ein Kredit wurde vollständig getilgt.', 'gut');
        }
      }

      /* Dispozinsen */
      if (fin.kontostand < 0) {
        var dispo = -fin.kontostand * (Finance.DISPO_ZINS / 52);
        Finance.buchen(fin, state.tag, 'Bank', 'Überziehungszinsen', -Math.round(dispo), 'Überziehungszinsen');
        fin.dispoTage += 7;
      } else {
        fin.dispoTage = 0;
      }

      /* Regeneration und Formdrift */
      kader.forEach(function (p) {
        var reg = 6 + p.attrs.kondition * 0.075 + (fin.stadion.module.trainingszentrum ? 2 : 0);
        p.fitness = Util.clamp(Math.round(p.fitness + reg), 0, 100);
        p.form = Math.round(Util.clamp(p.form + Game.rng.gauss(0, 3.4, -9, 9) + (50 - p.form) * 0.06, 5, 98));
        p.moral = Util.clamp(Math.round(p.moral + (p.wechselwunsch ? -1.2 : 0.4) + Game.rng.gauss(0, 1.2, -3, 3)), 5, 100);
      });
    });

    /* Warnungen fuer den Spieler */
    var mein = state.klubs[state.meinKlubId];
    if (mein) {
      var fin = mein.finanzen;
      if (fin.kontostand < 0 && fin.dispoTage >= 28 && !fin.punktabzugGedroht) {
        fin.punktabzugGedroht = true;
        post(state, 'Ernste Finanzlage', 'Das Konto ist seit vier Wochen im Minus. Der Verband droht mit Punktabzug, ' +
          'falls die Lage nicht bereinigt wird. Ein Kredit oder Spielerverkäufe könnten helfen.', 'warnung');
      }
      if (fin.kontostand >= 0 && fin.punktabzugGedroht) {
        fin.punktabzugGedroht = false;
        post(state, 'Finanzlage entspannt', 'Das Konto ist wieder ausgeglichen. Die Drohung des Verbandes ist vom Tisch.', 'gut');
      }
    }
  }

  function taeglicheEreignisse(state) {
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      if (!k.finanzen) return;
      var fertig = Finance.ausbauPruefen(k.finanzen, state.tag);
      if (fertig && id === state.meinKlubId) {
        post(state, 'Baumaßnahme abgeschlossen', fertig.text, 'gut');
      }
    });
    /* Verletzungen auslaufen lassen */
    Object.keys(state.spieler).forEach(function (pid) {
      var p = state.spieler[pid];
      if (p.verletztBis > 0 && p.verletztBis <= state.tag) {
        p.verletztBis = 0;
        if (p.verletzung && p.klubId === state.meinKlubId) {
          post(state, 'Zurück im Training', p.name + ' hat seine Verletzung auskuriert und steht wieder zur Verfügung.', 'gut');
        }
        p.verletzung = null;
        p.fitness = Math.min(p.fitness, 78);
      }
    });
  }

  /* =================== KI =================== */

  function kiTransfers(state) {
    if (!istTransferfenster(state)) return;
    var rng = Game.rng;
    var alleKlubs = Object.keys(state.klubs).filter(function (id) {
      return id !== state.meinKlubId && !state.klubs[id].wartend;
    });
    rng.shuffle(alleKlubs);
    var anzahl = Math.min(10, Math.max(4, Math.round(alleKlubs.length * 0.05)));
    for (var i = 0; i < anzahl && i < alleKlubs.length; i++) {
      kiEinTransfer(state, state.klubs[alleKlubs[i]]);
    }
    if (rng.chance(0.22)) kiAngeboteAnSpieler(state);
  }

  function kiEinTransfer(state, kaeufer) {
    var rng = Game.rng;
    if (!kaeufer.finanzen) return;
    var kader = kaderVon(state, kaeufer);
    if (kader.length >= 30) return;
    var budget = kaeufer.finanzen.transferbudget;
    if (budget < 20000) return;
    /* Schwaechste Position suchen */
    var gruppen = { TW: [], ABW: [], MIT: [], ANG: [] };
    kader.forEach(function (p) { gruppen[Players.GRUPPE[p.pos]].push(p); });
    var schwach = null, wert = 1e9;
    Object.keys(gruppen).forEach(function (grp) {
      var arr = gruppen[grp].slice().sort(function (a, b) { return b.staerke - a.staerke; });
      var soll = { TW: 1, ABW: 4, MIT: 4, ANG: 2 }[grp];
      if (arr.length < soll + 1) { if (0 < wert) { wert = 0; schwach = grp; } return; }
      var schnitt = Util.sum(arr.slice(0, soll), function (p) { return p.staerke; }) / soll;
      if (schnitt < wert) { wert = schnitt; schwach = grp; }
    });
    if (!schwach) return;

    /* Kandidaten suchen: Stichprobe aus dem Weltbestand, danach der beste
       Spieler, der sportlich weiterhilft und ins Budget passt. */
    var kandidaten = [];
    var alleIds = Object.keys(state.spieler);
    var versuche = Math.min(500, alleIds.length);
    for (var i = 0; i < versuche; i++) {
      var p = state.spieler[alleIds[rng.int(0, alleIds.length - 1)]];
      if (!p || p.klubId === kaeufer.id) continue;
      if (Players.GRUPPE[p.pos] !== schwach) continue;
      if (p.marktwert > budget) continue;
      if (p.staerke < wert - 1) continue;
      if (p.klubId === state.meinKlubId) continue;
      if (p.verletztBis > state.tag + 30) continue;
      kandidaten.push(p);
      if (kandidaten.length >= 25) break;
    }
    if (!kandidaten.length) return;
    kandidaten.sort(function (a, b) { return b.staerke - a.staerke; });

    /* Der stärkste Spieler ist meist zu teuer - deshalb der Reihe nach
       durchgehen, bis eine Ablöse ins Budget passt. */
    for (var n = 0; n < Math.min(8, kandidaten.length); n++) {
      var ziel = kandidaten[n];
      var verkaeufer = ziel.klubId ? state.klubs[ziel.klubId] : null;
      if (!verkaeufer) {
        transferAusfuehren(state, ziel, null, kaeufer, 0, null);
        return;
      }
      var vKader = kaderVon(state, verkaeufer);
      if (vKader.length <= 19) continue;
      var ford = Transfers.forderung(ziel, vKader, verkaeufer, kaeufer, state.saison);
      if (ford > budget) continue;
      var bereit = Transfers.wechselbereitschaft(ziel, verkaeufer, kaeufer, vKader, state.saison);
      if (rng.next() > bereit) continue;
      transferAusfuehren(state, ziel, verkaeufer, kaeufer, ford, null);
      return;
    }
  }

  function transferAusfuehren(state, spieler, verkaeufer, kaeufer, abloese, vertrag, struktur) {
    struktur = struktur || null;
    var sofort = struktur ? (struktur.sofort || 0) : abloese;

    /* Weiterverkaufsbeteiligung eines frueheren Vereins bedienen. */
    var beteiligung = 0;
    if (spieler.weiterverkauf && abloese > 0 && verkaeufer &&
        spieler.weiterverkauf.klubId !== verkaeufer.id) {
      var altKlub = state.klubs[spieler.weiterverkauf.klubId];
      if (altKlub && altKlub.finanzen) {
        beteiligung = Math.round(abloese * spieler.weiterverkauf.prozent / 100);
        Finance.buchen(altKlub.finanzen, state.tag, 'Transfer',
          'Weiterverkaufsbeteiligung ' + spieler.name, beteiligung, 'Transfererlöse');
      }
      spieler.weiterverkauf = null;
    }

    if (verkaeufer) {
      verkaeufer.kader = verkaeufer.kader.filter(function (id) { return id !== spieler.id; });
      if (verkaeufer.finanzen) {
        Finance.buchen(verkaeufer.finanzen, state.tag, 'Transfer',
          'Verkauf ' + spieler.name + ' an ' + kaeufer.name +
          (struktur && struktur.raten ? ' (Sofortzahlung)' : ''),
          Math.max(0, sofort - beteiligung), 'Transfererlöse');
        verkaeufer.finanzen.transferbudget += Math.round(Math.max(0, sofort - beteiligung) * 0.7);
      }
      verkaeufer.aufstellung = null;
    }
    kaeufer.kader.push(spieler.id);
    spieler.klubId = kaeufer.id;
    spieler.transferliste = false;
    spieler.wechselwunsch = false;
    spieler.moral = Util.clamp(spieler.moral + 8, 5, 100);
    if (kaeufer.finanzen) {
      if (sofort > 0) {
        Finance.buchen(kaeufer.finanzen, state.tag, 'Transfer', 'Verpflichtung ' + spieler.name +
          (verkaeufer ? ' von ' + verkaeufer.name : ''), -sofort, 'Transferausgaben');
      }
      kaeufer.finanzen.transferbudget = Math.max(0, kaeufer.finanzen.transferbudget - abloese);
      /* Ratenzahlung als laufende Verpflichtung eintragen. */
      if (struktur && struktur.raten > 0 && verkaeufer) {
        var wochen = Math.max(1, Math.round((struktur.ratenJahre || 2) * 52));
        kaeufer.finanzen.verpflichtungen.push({
          art: 'rate', text: spieler.name,
          wocheBetrag: Math.round(struktur.raten / wochen),
          restWochen: wochen, anKlubId: verkaeufer.id
        });
      }
      /* Weiterverkaufsbeteiligung und Einsatzbonus vormerken. */
      if (struktur && struktur.weiterverkauf > 0 && verkaeufer) {
        spieler.weiterverkauf = { klubId: verkaeufer.id, prozent: struktur.weiterverkauf };
      }
      if (struktur && struktur.bonusEinsaetze > 0 && verkaeufer) {
        spieler.bonusEinsaetze = { klubId: verkaeufer.id, betrag: struktur.bonusEinsaetze, spiele: 25 };
      }
    }
    if (vertrag) {
      spieler.gehalt = vertrag.gehalt;
      spieler.vertragBis = state.saison + vertrag.jahre;
      spieler.rolle = vertrag.rolle;
      spieler.ausstiegsklausel = vertrag.ausstiegsklausel || null;
      if (vertrag.handgeld && kaeufer.finanzen) {
        Finance.buchen(kaeufer.finanzen, state.tag, 'Transfer', 'Handgeld ' + spieler.name, -vertrag.handgeld, 'Handgelder');
      }
    } else {
      spieler.gehalt = Players.gehaltsBasis(spieler.staerke, kaeufer.ruf, spieler.alter);
      spieler.vertragBis = state.saison + Game.rng.int(2, 4);
    }
    spieler.marktwert = Players.marktwert(spieler, state.saison);
    kaeufer.aufstellung = null;
    state.statistik.transfers.unshift({
      tag: state.tag, saison: state.saison, spielerId: spieler.id, name: spieler.name,
      von: verkaeufer ? verkaeufer.id : null, zu: kaeufer.id, abloese: abloese
    });
    if (state.statistik.transfers.length > 200) state.statistik.transfers.pop();
  }

  /* KI-Klubs machen Angebote fuer Spieler des Nutzers. */
  function kiAngeboteAnSpieler(state) {
    var rng = Game.rng;
    var mein = state.klubs[state.meinKlubId];
    if (!mein) return;
    var kader = kaderVon(state, mein);
    if (kader.length <= 18) return;
    if (!rng.chance(0.35)) return;

    var kandidaten = kader.filter(function (p) {
      return p.transferliste || rng.chance(0.10);
    });
    if (!kandidaten.length) return;
    var spieler = rng.pick(kandidaten);
    /* Passenden Interessenten finden */
    var moegliche = Object.keys(state.klubs).filter(function (id) {
      var k = state.klubs[id];
      if (id === state.meinKlubId || k.wartend) return false;
      if (!k.finanzen) return false;
      if (k.finanzen.transferbudget < spieler.marktwert * 0.7) return false;
      return Math.abs(k.ruf - mein.ruf) < 42;
    });
    if (!moegliche.length) return;
    var interessent = state.klubs[rng.pick(moegliche)];
    var basis = Transfers.forderung(spieler, kader, mein, interessent, state.saison);
    var gebot = Math.round(basis * rng.float(0.62, 1.15) / 5000) * 5000;
    if (gebot > interessent.finanzen.transferbudget) gebot = interessent.finanzen.transferbudget;
    if (gebot < 5000) return;

    state.verhandlungen.push({
      id: 'v_ki_' + state.tag + '_' + spieler.id,
      typ: 'verkauf',
      spielerId: spieler.id,
      vonKlubId: mein.id,
      zuKlubId: interessent.id,
      phase: 'angebot',
      gebot: gebot,
      forderung: basis,
      runde: 0,
      historie: [{ von: 'kaeufer', text: interessent.name + ' bietet ' + Fmt.money(gebot) + '.' }],
      startTag: state.tag,
      frist: state.tag + 10,
      status: 'offen'
    });
    post(state, 'Transferangebot für ' + spieler.name,
      interessent.name + ' bietet ' + Fmt.money(gebot) + ' für ' + spieler.name + ' (Marktwert ' +
      Fmt.money(spieler.marktwert) + '). Sie können das Angebot im Transferbereich bearbeiten.',
      'transfer', { verhandlungId: 'v_ki_' + state.tag + '_' + spieler.id });
  }

  /* Sponsorenangebote auffrischen. */
  function sponsorenPruefen(state) {
    var mein = state.klubs[state.meinKlubId];
    if (!mein) return;
    var fin = mein.finanzen;
    Finance.SLOTS.forEach(function (slot) {
      var akt = fin.sponsoren[slot.id];
      var laeuftAus = !akt || akt.bisSaison <= state.saison;
      if (!laeuftAus) return;
      if (fin.sponsorAngebote[slot.id]) return;
      if (akt && state.tag < 200) return;   /* erst in der Rueckrunde neu verhandeln */
      var erfolg = 1;
      if (mein.ligaId) {
        var liga = state.ligen[mein.ligaId];
        var platz = League.platzVon(liga, mein.id);
        erfolg = 0.88 + (1 - (platz - 1) / Math.max(1, liga.klubs.length - 1)) * 0.28;
      }
      fin.sponsorAngebote[slot.id] = Finance.angeboteErzeugen(
        Game.rng, mein, fin, slot.id, state.saison, mein.stufe, erfolg);
      post(state, 'Neue Sponsorenangebote: ' + slot.name,
        'Für den Bereich „' + slot.name + '" liegen drei Angebote vor. Im Bereich Sponsoring können Sie entscheiden.',
        'geld');
    });
  }

  /* =================== Ein Tag weiter =================== */

  function naechsterTag(state) {
    state.tag++;
    state.letzteSpieltagErgebnisse = [];

    taeglicheEreignisse(state);
    kiTransfers(state);
    if (state.tag % 7 === 0) {
      wochenAbrechnung(state);
      sponsorenPruefen(state);
      verhandlungenPruefen(state);
    }

    /* Spieltage heute? */
    var heute = [];
    state.ligaReihenfolge.forEach(function (lid) {
      var liga = state.ligen[lid];
      liga.spieltage.forEach(function (st) {
        if (st.tag === state.tag && !st.gespielt) heute.push({ liga: liga, st: st });
      });
    });

    var userPartie = null;
    heute.forEach(function (h) {
      h.st.partien.forEach(function (p) {
        if (p.heim === state.meinKlubId || p.gast === state.meinKlubId) {
          if (p.th === null) userPartie = { liga: h.liga, st: h.st, partie: p };
        }
      });
    });

    if (userPartie) {
      state.anstehendesSpiel = {
        ligaId: userPartie.liga.id,
        spieltagNr: userPartie.st.nr,
        heim: userPartie.partie.heim,
        gast: userPartie.partie.gast
      };
      return { typ: 'spiel', spiel: state.anstehendesSpiel };
    }

    heute.forEach(function (h) { spieltagAustragen(state, h.liga, h.st, false); });

    if (saisonVorbei(state)) return { typ: 'saisonende' };
    return { typ: 'tag', spieltage: heute.length };
  }

  /* Nach dem Nutzerspiel: restliche Partien des Tages austragen. */
  function tagAbschliessen(state) {
    state.ligaReihenfolge.forEach(function (lid) {
      var liga = state.ligen[lid];
      liga.spieltage.forEach(function (st) {
        if (st.tag === state.tag && !st.gespielt) spieltagAustragen(state, liga, st, false);
      });
    });
    state.anstehendesSpiel = null;
    if (saisonVorbei(state)) return { typ: 'saisonende' };
    return { typ: 'tag' };
  }

  function saisonVorbei(state) {
    return state.ligaReihenfolge.every(function (lid) {
      var liga = state.ligen[lid];
      return liga.spieltage.every(function (st) { return st.gespielt; });
    });
  }

  function verhandlungenPruefen(state) {
    var offen = [];
    state.verhandlungen.forEach(function (v) {
      if (v.status !== 'offen') return;
      if (v.frist && state.tag > v.frist) {
        v.status = 'abgelaufen';
        return;
      }
      offen.push(v);
    });
    state.verhandlungen = offen.concat(state.verhandlungen.filter(function (v) {
      return v.status !== 'offen' && state.tag - v.startTag < 30;
    }));
  }

  g.Game = Game;
  Game.VERSION = VERSION;
  Game.SPEICHER_KEY = SPEICHER_KEY;
  Game.weltErzeugen = weltErzeugen;
  Game.basisStaerke = basisStaerke;
  Game.kaderVon = kaderVon;
  Game.post = post;
  Game.news = news;
  Game.istTransferfenster = istTransferfenster;
  Game.aufstellungPruefen = aufstellungPruefen;
  Game.matchKontext = matchKontext;
  Game.spielSimulieren = spielSimulieren;
  Game.ergebnisVerbuchen = ergebnisVerbuchen;
  Game.spieltagAustragen = spieltagAustragen;
  Game.naechsterTag = naechsterTag;
  Game.tagAbschliessen = tagAbschliessen;
  Game.saisonVorbei = saisonVorbei;
  Game.wochenAbrechnung = wochenAbrechnung;
  Game.budgetsSetzen = budgetsSetzen;
  Game.zieleSetzen = zieleSetzen;
  Game.transferAusfuehren = transferAusfuehren;
  Game.kiTransfers = kiTransfers;
  Game.sponsorenPruefen = sponsorenPruefen;
})(typeof window !== 'undefined' ? window : globalThis);
