/* jugend.js - Jugendakademie: Ausbaustufen, Jahrgänge, Scouting.
 *
 * Jugendspieler stehen nicht im Profikader, sondern in klub.jugend.talente.
 * Sie kosten nur eine kleine Aufwandsentschädigung und tauchen weder in der
 * Aufstellung noch in der Gehaltsabrechnung des Profikaders auf, bis sie
 * einen Profivertrag unterschreiben.
 */
(function (g) {
  'use strict';

  var STUFEN = [
    { stufe: 1, name: 'Kreisebene', kosten: 0, unterhalt: 350,
      talente: [1, 2], bonus: -16,
      text: 'Ein paar engagierte Ehrenamtliche. Was hier durchkommt, ist Zufall.' },
    { stufe: 2, name: 'Bezirksleistungszentrum', kosten: 220000, unterhalt: 1400,
      talente: [2, 3], bonus: -11,
      text: 'Feste Trainer, eigene Plätze. Der Verein wird in der Region wahrgenommen.' },
    { stufe: 3, name: 'Nachwuchsleistungszentrum', kosten: 1400000, unterhalt: 6500,
      talente: [2, 4], bonus: -6,
      text: 'Eigene Jahrgangsmannschaften und Athletiktrainer. Talente kommen von weiter her.' },
    { stufe: 4, name: 'Zertifiziertes NLZ', kosten: 5200000, unterhalt: 19000,
      talente: [3, 4], bonus: -2,
      text: 'Internat, Reha-Abteilung, eigene Spielphilosophie über alle Jahrgänge.' },
    { stufe: 5, name: 'Eliteschule des Fußballs', kosten: 14000000, unterhalt: 44000,
      talente: [3, 5], bonus: 3,
      text: 'Die besten Talente des Landes kommen von sich aus. Ein Aushängeschild.' }
  ];

  var SCOUTING = [
    { stufe: 1, name: 'Ein Zettel im Trainerbüro', kosten: 0, unterhalt: 150, genauigkeit: 0.30 },
    { stufe: 2, name: 'Nebenberufliche Scouts', kosten: 90000, unterhalt: 900, genauigkeit: 0.50 },
    { stufe: 3, name: 'Regionales Scoutingnetz', kosten: 600000, unterhalt: 3800, genauigkeit: 0.68 },
    { stufe: 4, name: 'Bundesweites Netz', kosten: 2400000, unterhalt: 11000, genauigkeit: 0.83 },
    { stufe: 5, name: 'Datengestützte Analyse', kosten: 7000000, unterhalt: 26000, genauigkeit: 0.95 }
  ];

  /* Der Jahrgang rückt Ende Juli nach. */
  var JAHRGANG_TAG = 20;

  function stufe(n) { return STUFEN[Util.clamp(n, 1, 5) - 1]; }
  function scoutStufe(n) { return SCOUTING[Util.clamp(n, 1, 5) - 1]; }

  function aufsetzen(klub) {
    /* Große Vereine starten mit einer besseren Akademie. */
    var s = klub.ruf >= 82 ? 5 : (klub.ruf >= 70 ? 4 : (klub.ruf >= 55 ? 3 : (klub.ruf >= 40 ? 2 : 1)));
    var sc = Util.clamp(s - 1, 1, 5);
    return {
      stufe: s,
      scouting: sc,
      talente: [],
      ausbau: null,
      letzterJahrgang: -1,
      hervorgebracht: 0
    };
  }

  function unterhaltWoche(jugend) {
    return stufe(jugend.stufe).unterhalt + scoutStufe(jugend.scouting).unterhalt;
  }

  /* Wie stark ein Jahrgang ausfällt: Ausbaustufe, Ansehen und Zufall. */
  function jahrgangErzeugen(rng, state, klub) {
    var j = klub.jugend;
    var st = stufe(j.stufe);
    var anzahl = rng.int(st.talente[0], st.talente[1]);
    var basis = Game.basisStaerke(klub);
    var neue = [];
    for (var i = 0; i < anzahl; i++) {
      var alter = rng.int(16, 18);
      /* Ein Jugendspieler startet deutlich unter Profiniveau. Wie weit
         darunter, hängt am Ligastandard und an der Ausbaustufe. */
      var startStaerke = Util.clamp(
        rng.gauss(basis * 0.62 + st.stufe * 1.8 + (alter - 16) * 2.5, 3.5, 6, 68), 6, 68);
      var p = Players.spielerErzeugen(rng, {
        pos: rng.pick(Players.POSITIONEN),
        alter: alter,
        staerke: startStaerke,
        nation: klub.international ? Names.nationFuerLand(rng, klub.land)
                                   : Names.nationFuerLiga(rng, Util.clamp(klub.stufe, 1, 4)),
        klubId: klub.id,
        klubRuf: klub.ruf,
        saison: state.saison
      });
      /* Die meisten Talente werden solide Spieler ihrer Liga, nur wenige
         schlagen wirklich ein. Deshalb eine rechtsschiefe Verteilung:
         ein schmaler Grundaufschlag plus ein seltener Ausnahmebonus. */
      var spielraum = rng.gauss(11 + st.stufe * 1.6, 5.5, 2, 30);
      if (rng.chance(0.05 + st.stufe * 0.025)) {
        spielraum += rng.gauss(14, 6, 4, 28);
        p.ausnahmetalent = true;
      }
      p.potenzial = Util.clamp(Math.round(p.staerke + spielraum), p.staerke + 2, 99);
      p.jugend = true;
      p.jugendSeit = state.saison;
      p.gehalt = Math.round(Players.gehaltsBasis(p.staerke, klub.ruf, p.alter) * 0.28);
      p.vertragBis = state.saison + 2;
      p.marktwert = Players.marktwert(p, state.saison);
      p.einschaetzung = einschaetzung(rng, p, scoutStufe(j.scouting).genauigkeit);
      state.spieler[p.id] = p;
      j.talente.push(p.id);
      neue.push(p);
    }
    j.letzterJahrgang = state.saison;
    j.hervorgebracht += neue.length;
    return neue;
  }

  /* Der Scout schätzt das Potenzial - je besser das Netz, desto enger die Spanne. */
  function einschaetzung(rng, spieler, genauigkeit) {
    var spanne = Math.round((1 - genauigkeit) * 34) + 3;
    var mitte = spieler.potenzial + Math.round(rng.gauss(0, spanne * 0.45, -spanne, spanne));
    var von = Util.clamp(mitte - Math.round(spanne / 2), spieler.staerke, 99);
    var bis = Util.clamp(mitte + Math.round(spanne / 2), von + 2, 99);
    var noten = ['Ergänzungsspieler für die Regionalliga', 'Kann in der Regionalliga bestehen',
      'Perspektive für die 3. Liga', 'Traut man die 2. Bundesliga zu', 'Bundesligaformat möglich',
      'Ein Spieler für die erste Reihe'];
    var index = Util.clamp(Math.floor(((von + bis) / 2 - 30) / 11), 0, noten.length - 1);
    return { von: von, bis: bis, urteil: noten[index], genauigkeit: genauigkeit };
  }

  /* Talent bekommt einen Profivertrag und rückt in den Kader auf. */
  function hochziehen(state, klub, spieler, vertrag) {
    var i = klub.jugend.talente.indexOf(spieler.id);
    if (i < 0) return { ok: false, grund: 'Der Spieler gehört nicht zur Akademie.' };
    if (klub.kader.length >= 30) return { ok: false, grund: 'Der Profikader ist mit 30 Spielern voll.' };
    klub.jugend.talente.splice(i, 1);
    klub.kader.push(spieler.id);
    spieler.jugend = false;
    spieler.einschaetzung = null;
    spieler.gehalt = vertrag.gehalt;
    spieler.vertragBis = state.saison + vertrag.jahre;
    spieler.rolle = vertrag.rolle || 'talent';
    spieler.moral = Util.clamp(spieler.moral + 12, 5, 100);
    spieler.marktwert = Players.marktwert(spieler, state.saison);
    klub.aufstellung = null;
    return { ok: true };
  }

  function freigeben(state, klub, spieler) {
    var i = klub.jugend.talente.indexOf(spieler.id);
    if (i < 0) return false;
    klub.jugend.talente.splice(i, 1);
    delete state.spieler[spieler.id];
    return true;
  }

  /* Was ein Talent für seinen ersten Profivertrag verlangt. */
  function vertragsforderung(spieler, klub) {
    var basis = Players.gehaltsBasis(spieler.staerke, klub.ruf, spieler.alter);
    var talentzuschlag = 1 + Math.max(0, spieler.potenzial - spieler.staerke) / 100 * 0.9;
    return Math.round(basis * talentzuschlag / 10) * 10;
  }

  function ausbauStarten(klub, tag, art) {
    var j = klub.jugend;
    if (j.ausbau) return { ok: false, grund: 'Es läuft bereits eine Maßnahme.' };
    var naechste = art === 'scouting' ? scoutStufe(j.scouting + 1) : stufe(j.stufe + 1);
    var aktuell = art === 'scouting' ? j.scouting : j.stufe;
    if (aktuell >= 5) return { ok: false, grund: 'Die höchste Stufe ist bereits erreicht.' };
    if (naechste.kosten > klub.finanzen.kontostand) {
      return { ok: false, grund: 'Nicht genug Geld auf dem Konto.' };
    }
    var tage = art === 'scouting' ? 60 : 90 + naechste.stufe * 30;
    j.ausbau = { art: art, ziel: aktuell + 1, kosten: naechste.kosten, startTag: tag, fertigTag: tag + tage };
    Finance.buchen(klub.finanzen, tag, 'Jugend',
      (art === 'scouting' ? 'Ausbau Scouting auf Stufe ' : 'Ausbau Akademie auf Stufe ') + (aktuell + 1),
      -naechste.kosten, 'Jugendarbeit');
    return { ok: true, tage: tage };
  }

  function ausbauPruefen(klub, tag) {
    var j = klub.jugend;
    if (!j || !j.ausbau || tag < j.ausbau.fertigTag) return null;
    var a = j.ausbau;
    j.ausbau = null;
    if (a.art === 'scouting') {
      j.scouting = a.ziel;
      return { text: 'Das Scouting arbeitet ab sofort auf Stufe ' + a.ziel + ': ' + scoutStufe(a.ziel).name + '.' };
    }
    j.stufe = a.ziel;
    return { text: 'Die Jugendakademie ist jetzt ein ' + stufe(a.ziel).name + '.' };
  }

  /* Talente, die zu alt werden, verlassen den Verein. */
  function jahrgangAltern(state, klub) {
    var weg = [];
    var j = klub.jugend;
    if (!j) return weg;
    j.talente = j.talente.filter(function (id) {
      var p = state.spieler[id];
      if (!p) return false;
      if (p.alter >= 20 || state.saison - p.jugendSeit >= 3) {
        weg.push(p);
        delete state.spieler[id];
        return false;
      }
      return true;
    });
    return weg;
  }

  g.Jugend = {
    STUFEN: STUFEN,
    SCOUTING: SCOUTING,
    JAHRGANG_TAG: JAHRGANG_TAG,
    stufe: stufe,
    scoutStufe: scoutStufe,
    aufsetzen: aufsetzen,
    unterhaltWoche: unterhaltWoche,
    jahrgangErzeugen: jahrgangErzeugen,
    einschaetzung: einschaetzung,
    hochziehen: hochziehen,
    freigeben: freigeben,
    vertragsforderung: vertragsforderung,
    ausbauStarten: ausbauStarten,
    ausbauPruefen: ausbauPruefen,
    jahrgangAltern: jahrgangAltern
  };
})(typeof window !== 'undefined' ? window : globalThis);
