/* save.js - Kompakter Spielstand.
 * Spieler machen den Grossteil des Speicherstands aus. Sie werden deshalb
 * nicht als Objekte, sondern als Zahlenreihen mit gemeinsamen Wortlisten
 * abgelegt - das drueckt die Groesse auf etwa ein Fuenftel.
 */
(function (g) {
  'use strict';

  var ATTR_ORDER = ['tempo', 'technik', 'zweikampf', 'passspiel', 'abschluss',
    'kopfball', 'kondition', 'uebersicht', 'stellungsspiel', 'reflexe'];
  var POS = Players.POSITIONEN;
  var ROLLEN_IDS = ['star', 'stamm', 'rotation', 'ergaenzung', 'talent'];

  function Woerterbuch() {
    this.liste = [];
    this.index = {};
  }
  Woerterbuch.prototype.id = function (wort) {
    if (wort === null || wort === undefined) return -1;
    if (this.index[wort] === undefined) {
      this.index[wort] = this.liste.length;
      this.liste.push(wort);
    }
    return this.index[wort];
  };

  function serialisieren(state) {
    var wb = { v: new Woerterbuch(), n: new Woerterbuch(), na: new Woerterbuch(), ve: new Woerterbuch(), kl: new Woerterbuch() };
    var spieler = [];
    Object.keys(state.spieler).forEach(function (pid) {
      var p = state.spieler[pid];
      var flags = (p.transferliste ? 1 : 0) | (p.wechselwunsch ? 2 : 0);
      var reihe = [
        parseInt(p.id.substr(1), 10),
        wb.v.id(p.vorname), wb.n.id(p.nachname), wb.na.id(p.nation),
        POS.indexOf(p.pos), p.alter, p.staerke, p.potenzial,
        p.form, p.fitness, p.moral,
        wb.kl.id(p.klubId), p.vertragBis - state.saison,
        p.gehalt, p.marktwert, p.verletztBis, wb.ve.id(p.verletzung || null),
        p.sperre, flags, ROLLEN_IDS.indexOf(p.rolle || ''), p.ausstiegsklausel || 0
      ];
      for (var i = 0; i < ATTR_ORDER.length; i++) reihe.push(p.attrs[ATTR_ORDER[i]] || 0);
      var s = p.stats;
      reihe.push(s.spiele, s.tore, s.vorlagen, s.gelb, s.rot, s.minuten);
      reihe.push(s.noten.slice(-12).map(function (x) { return Math.round(x * 10); }));
      reihe.push(p.weiterverkauf ? [wb.kl.id(p.weiterverkauf.klubId), p.weiterverkauf.prozent] : 0);
      reihe.push(p.bonusEinsaetze ? [wb.kl.id(p.bonusEinsaetze.klubId), p.bonusEinsaetze.betrag, p.bonusEinsaetze.spiele] : 0);
      reihe.push(p.leihe ? [wb.kl.id(p.leihe.vonKlubId), p.leihe.bisTag, p.leihe.gehaltsanteil,
        p.leihe.kaufoption || 0, p.leihe.gebuehr || 0] : 0);
      reihe.push(p.jugend ? [p.jugendSeit,
        p.einschaetzung ? [p.einschaetzung.von, p.einschaetzung.bis, p.einschaetzung.urteil,
          Math.round(p.einschaetzung.genauigkeit * 100)] : 0] : 0);
      spieler.push(reihe);
    });

    /* Klubs ohne die Kader-Objekte (die stecken in den Spielern). */
    var klubs = {};
    Object.keys(state.klubs).forEach(function (id) {
      var k = state.klubs[id];
      klubs[id] = {
        l: k.ligaId, s: k.stufe, w: k.wartend ? 1 : 0,
        t: k.taktik, a: k.aufstellung,
        f: k.finanzen ? finanzenKlein(k.finanzen, id === state.meinKlubId) : null,
        vs: k.vorstand, ep: k.europapokal, h: k.historie,
        vl: k.verliehen || [], ju: k.jugend || null,
        st: k.finanzen ? null : undefined
      };
    });

    return {
      v: Game.VERSION,
      seed: state.seed,
      rng: Game.rng ? Game.rng.s : state.seed,
      saison: state.saison,
      tag: state.tag,
      mein: state.meinKlubId,
      manager: state.managerName,
      zaehler: {
        spieler: Players.getIdZaehler(),
        transfer: Transfers.getZaehler()
      },
      wb: { v: wb.v.liste, n: wb.n.liste, na: wb.na.liste, ve: wb.ve.liste, kl: wb.kl.liste },
      spieler: spieler,
      klubs: klubs,
      ligen: state.ligen,
      intlKlubs: state.intlKlubs,
      ligaReihenfolge: state.ligaReihenfolge,
      verhandlungen: state.verhandlungen,
      postfach: state.postfach.slice(0, 60),
      news: state.news.slice(0, 30),
      saisonHistorie: state.saisonHistorie,
      poolL3: state.poolL3,
      poolRLW: state.poolRLW,
      statistik: { transfers: state.statistik.transfers.slice(0, 80) },
      einstellungen: state.einstellungen,
      anstehendesSpiel: state.anstehendesSpiel
    };
  }

  function finanzenKlein(fin, eigen) {
    return {
      k: Math.round(fin.kontostand),
      tb: fin.transferbudget, gb: fin.gehaltsbudget,
      sp: fin.sponsoren, sa: fin.sponsorAngebote,
      st: fin.stadion, kr: fin.kredite, vp: fin.verpflichtungen || [],
      /* Die Buchungshistorie der KI-Vereine sieht niemand - sie waere der
         groesste Posten im Spielstand. */
      b: eigen ? fin.buchungen.slice(-60) : [],
      sai: fin.saison, ges: fin.gesamt,
      dt: fin.dispoTage, pa: fin.punktabzugGedroht ? 1 : 0
    };
  }

  function finanzenGross(f) {
    return {
      kontostand: f.k, transferbudget: f.tb, gehaltsbudget: f.gb,
      sponsoren: f.sp, sponsorAngebote: f.sa || {},
      stadion: f.st, kredite: f.kr || [], verpflichtungen: f.vp || [],
      buchungen: f.b || [], saison: f.sai || { einnahmen: {}, ausgaben: {} },
      gesamt: f.ges || { einnahmen: 0, ausgaben: 0 },
      dispoTage: f.dt || 0, punktabzugGedroht: !!f.pa
    };
  }

  function deserialisieren(d) {
    var state = {
      version: d.v, seed: d.seed, saison: d.saison, tag: d.tag,
      meinKlubId: d.mein, managerName: d.manager,
      klubs: {}, spieler: {}, ligen: d.ligen,
      ligaReihenfolge: d.ligaReihenfolge, intlKlubs: d.intlKlubs,
      verhandlungen: d.verhandlungen || [], postfach: d.postfach || [], news: d.news || [],
      saisonHistorie: d.saisonHistorie || [],
      anstehendesSpiel: d.anstehendesSpiel || null,
      letzteSpieltagErgebnisse: [],
      poolL3: d.poolL3, poolRLW: d.poolRLW,
      statistik: d.statistik || { transfers: [] },
      einstellungen: d.einstellungen || {}
    };

    /* Stammdaten der Vereine aus den Datendateien holen. */
    var stamm = {};
    DataClubs.LIGEN.forEach(function (l) { l.teams.forEach(function (t) { stamm[t.id] = t; }); });
    DataPool.REGIONALLIGA_REST.forEach(function (t) { stamm[t.id] = t; });
    DataPool.OBERLIGA_WEST.forEach(function (t) { stamm[t.id] = t; });
    DataIntl.CLUBS.forEach(function (t) { stamm[t.id] = t; });

    Object.keys(d.klubs).forEach(function (id) {
      var kd = d.klubs[id], basis = stamm[id];
      if (!basis) return;
      var k = {};
      Object.keys(basis).forEach(function (key) { k[key] = basis[key]; });
      k.ligaId = kd.l; k.stufe = kd.s; k.wartend = !!kd.w;
      k.taktik = kd.t || Match.standardTaktik();
      k.aufstellung = kd.a || null;
      k.finanzen = kd.f ? finanzenGross(kd.f) : null;
      k.vorstand = kd.vs || { vertrauen: 60, zielPlatz: 10, ziel: '' };
      k.europapokal = kd.ep || null;
      k.historie = kd.h || [];
      k.verliehen = kd.vl || [];
      k.jugend = kd.ju || null;
      k.kader = [];
      k.international = !!basis.international;
      state.klubs[id] = k;
    });

    var wb = d.wb;
    d.spieler.forEach(function (r) {
      var attrs = {};
      for (var i = 0; i < ATTR_ORDER.length; i++) attrs[ATTR_ORDER[i]] = r[21 + i];
      var vor = wb.v[r[1]], nach = wb.n[r[2]];
      var klubId = r[11] >= 0 ? wb.kl[r[11]] : null;
      var p = {
        id: 'p' + r[0], vorname: vor, nachname: nach, name: vor + ' ' + nach,
        nation: wb.na[r[3]], pos: POS[r[4]], gruppe: Players.GRUPPE[POS[r[4]]],
        alter: r[5], staerke: r[6], potenzial: r[7],
        form: r[8], fitness: r[9], moral: r[10],
        klubId: klubId, vertragBis: r[12] + d.saison,
        gehalt: r[13], marktwert: r[14], verletztBis: r[15],
        verletzung: r[16] >= 0 ? wb.ve[r[16]] : null,
        sperre: r[17],
        transferliste: !!(r[18] & 1), wechselwunsch: !!(r[18] & 2),
        rolle: r[19] >= 0 ? ROLLEN_IDS[r[19]] : null,
        ausstiegsklausel: r[20] || null,
        attrs: attrs,
        stats: {
          spiele: r[31], tore: r[32], vorlagen: r[33], gelb: r[34], rot: r[35], minuten: r[36],
          noten: (r[37] || []).map(function (x) { return x / 10; })
        },
        karriere: []
      };
      if (r[38]) p.weiterverkauf = { klubId: wb.kl[r[38][0]], prozent: r[38][1] };
      if (r[39]) p.bonusEinsaetze = { klubId: wb.kl[r[39][0]], betrag: r[39][1], spiele: r[39][2] };
      if (r[40]) {
        p.leihe = { vonKlubId: wb.kl[r[40][0]], bisTag: r[40][1], gehaltsanteil: r[40][2],
          kaufoption: r[40][3], gebuehr: r[40][4] };
      }
      if (r[41]) {
        p.jugend = true;
        p.jugendSeit = r[41][0];
        if (r[41][1]) {
          p.einschaetzung = { von: r[41][1][0], bis: r[41][1][1], urteil: r[41][1][2],
            genauigkeit: r[41][1][3] / 100 };
        }
      }
      state.spieler[p.id] = p;
      if (klubId && state.klubs[klubId] && !p.jugend) state.klubs[klubId].kader.push(p.id);
    });

    Players.setIdZaehler(d.zaehler.spieler);
    Transfers.setZaehler(d.zaehler.transfer);
    Game.rng = new RNG(d.rng);
    Game.rng.s = d.rng >>> 0;
    return state;
  }

  function speichern(state) {
    var daten = serialisieren(state);
    var text = JSON.stringify(daten);
    try {
      localStorage.setItem(Game.SPEICHER_KEY, text);
      return { ok: true, groesse: text.length };
    } catch (e) {
      return { ok: false, grund: 'Der Speicherplatz des Browsers reicht nicht aus.', groesse: text.length };
    }
  }

  function laden() {
    var text;
    try { text = localStorage.getItem(Game.SPEICHER_KEY); } catch (e) { return null; }
    if (!text) return null;
    try {
      return deserialisieren(JSON.parse(text));
    } catch (e) {
      return null;
    }
  }

  function vorhanden() {
    try { return !!localStorage.getItem(Game.SPEICHER_KEY); } catch (e) { return false; }
  }

  function loeschen() {
    try { localStorage.removeItem(Game.SPEICHER_KEY); } catch (e) { /* egal */ }
  }

  g.Speicher = {
    serialisieren: serialisieren,
    deserialisieren: deserialisieren,
    speichern: speichern,
    laden: laden,
    vorhanden: vorhanden,
    loeschen: loeschen
  };
})(typeof window !== 'undefined' ? window : globalThis);
