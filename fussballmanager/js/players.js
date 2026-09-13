/*
 * players.js - Spielererzeugung, Bewertung, Marktwert und Entwicklung.
 *
 * Ein Spieler traegt 32 Attribute (1-99). Aus ihnen wird ueber
 * positionsabhaengige Gewichte die Staerke berechnet. Alles andere
 * (Marktwert, Gehalt, Entwicklung) haengt an dieser Staerke.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};
  var U = FM.util;
  var D = FM.data;

  // ------------------------------------------------------------ Hilfen

  /** Normierte Positionsgewichte, einmal berechnet und gecacht. */
  var gewichtCache = {};
  function gewichte(pos) {
    if (gewichtCache[pos]) return gewichtCache[pos];
    var raw = D.POS_GEWICHTE[pos] || D.POS_GEWICHTE.ZM;
    var total = 0, k;
    for (k in raw) total += raw[k];
    var out = {};
    for (k in raw) out[k] = raw[k] / total;
    gewichtCache[pos] = out;
    return out;
  }

  /** Rohe Positionsstaerke aus den Attributen (1-99). */
  function rohStaerke(p, pos) {
    var g = gewichte(pos), s = 0, k;
    for (k in g) s += (p.attr[k] || 1) * g[k];
    return s;
  }

  /**
   * Staerke auf einer bestimmten Position, inklusive Abschlag fuer
   * Fremdpositionen und dem starken Fuss auf der Aussenbahn.
   */
  function posStaerke(p, pos) {
    var verwandt = D.POS_VERWANDT[p.pos] || {};
    var eignung = verwandt[pos] || 0;
    // Nebenpositionen erlauben volle Ausbeute.
    if (p.pos === pos) eignung = 1;
    else if (p.nebenpos.indexOf(pos) >= 0) eignung = Math.max(eignung, 0.93);
    if (eignung <= 0) eignung = 0.30;             // Notloesung, aber moeglich

    var basis = rohStaerke(p, pos);
    var wert = basis * (0.45 + 0.55 * eignung);

    // Falscher Fuss auf der Aussenbahn kostet etwas.
    if (p.fuss !== 'beidfüßig') {
      if ((pos === 'LV' || pos === 'LM' || pos === 'LF') && p.fuss === 'rechts') wert *= 0.955;
      if ((pos === 'RV' || pos === 'RM' || pos === 'RF') && p.fuss === 'links') wert *= 0.955;
    }
    return U.clamp(wert, 1, 99);
  }

  /** Staerke auf der Hauptposition. */
  function gesamt(p) {
    return posStaerke(p, p.pos);
  }

  /**
   * Aktuelle Einsatzstaerke: Grundstaerke, moduliert durch Form, Moral,
   * Fitness und Alterserfahrung. Das ist der Wert, mit dem die
   * Spielsimulation rechnet.
   */
  function tagesform(p, pos) {
    var basis = posStaerke(p, pos || p.pos);
    var formF = 0.90 + (p.form / 100) * 0.20;         // 0.90 .. 1.10
    var moralF = 0.94 + (p.moral / 100) * 0.12;       // 0.94 .. 1.06
    var fitF = p.fitness >= 85 ? 1.0
      : p.fitness >= 70 ? 0.97
        : p.fitness >= 55 ? 0.92
          : p.fitness >= 40 ? 0.84 : 0.74;
    return basis * formF * moralF * fitF;
  }

  // ------------------------------------------------------------ Erzeugung

  var NATIONEN = Object.keys(D.NAMEN);
  var NAT_GEWICHT = NATIONEN.map(function (n) { return D.NAMEN[n].w; });

  function waehleNation(rng, auslandsquote) {
    if (rng.next() > auslandsquote) return 'Deutschland';
    var total = 0, i;
    for (i = 0; i < NATIONEN.length; i++) if (NATIONEN[i] !== 'Deutschland') total += NAT_GEWICHT[i];
    var r = rng.next() * total;
    for (i = 0; i < NATIONEN.length; i++) {
      if (NATIONEN[i] === 'Deutschland') continue;
      r -= NAT_GEWICHT[i];
      if (r <= 0) return NATIONEN[i];
    }
    return 'Deutschland';
  }

  /**
   * Vor- und Nachnamen stammen aus laendertypischen Listen. Manche
   * Kombinationen ergeben zufaellig den Namen eines echten Profis - dann
   * wird der Vorname neu gezogen. Ein erfundener Spieler soll nicht wie
   * eine Kopie eines bestimmten Menschen aussehen.
   */
  var ECHTE_NAMEN = {
    'Viktor Gyökeres': 1, 'Aleksandar Mitrovic': 1, 'Samuel Chukwueze': 1,
    'Victor Osimhen': 1, 'Mykhailo Mudryk': 1, 'Artem Dovbyk': 1,
    'Georgiy Sudakov': 1, 'Oleksandr Zinchenko': 1, 'Randal Kolo Muani': 1,
    'Jurriën Timber': 1, 'Quinten Timber': 1, 'Cody Gakpo': 1,
    'Wout Weghorst': 1, 'Teun Koopmeiners': 1, 'Xavi Simons': 1,
    'Dani Olmo': 1, 'Pau Cubarsí': 1, 'Rafael Leão': 1,
    'Nicolò Barella': 1, 'Davide Frattesi': 1, 'Borna Sosa': 1,
    'Luka Sucic': 1, 'Luka Jovic': 1, 'Strahinja Pavlovic': 1,
    'Filip Kostic': 1, 'Nemanja Gudelj': 1, 'Dusan Vlahovic': 1,
    'Piotr Zielinski': 1, 'Sebastian Szymanski': 1, 'Jakub Kaminski': 1,
    'Mikkel Damsgaard': 1, 'Antonio Nusa': 1, 'Wataru Endo': 1,
    'Kaoru Mitoma': 1, 'Ricardo Pepi': 1, 'Mohammed Kudus': 1,
    'Bryan Mbeumo': 1, 'Vincent Aboubakar': 1, 'Ismael Saibari': 1,
    'Ibrahim Sangaré': 1, 'Ismael Bennacer': 1, 'Charles De Ketelaere': 1,
    'Arthur Vermeeren': 1, 'Arthur Theate': 1, 'Ruben Vargas': 1,
    'Fabian Schär': 1, 'Fabian Frei': 1, 'Silvan Widmer': 1,
    'Karl Etta Eyong': 1
  };

  function name(rng, nation) {
    var pool = D.NAMEN[nation] || D.NAMEN.Deutschland;
    var nachname = rng.pick(pool.nach);
    var vorname = rng.pick(pool.vor);
    var versuche = 0;
    while (ECHTE_NAMEN[vorname + ' ' + nachname] && versuche < 8) {
      vorname = rng.pick(pool.vor);
      versuche++;
    }
    if (ECHTE_NAMEN[vorname + ' ' + nachname]) nachname = rng.pick(pool.nach);
    return { vorname: vorname, nachname: nachname };
  }

  /**
   * Attribute erzeugen, sodass die Positionsstaerke ungefaehr `ziel` trifft.
   * Wichtige Attribute liegen hoeher, unwichtige streuen breiter.
   */
  function erzeugeAttribute(rng, pos, ziel) {
    var g = gewichte(pos);
    var maxG = 0, k;
    for (k in g) if (g[k] > maxG) maxG = g[k];

    var istTW = pos === 'TW';
    var attr = {};
    for (var i = 0; i < D.ALLE_ATTRIBUTE.length; i++) {
      k = D.ALLE_ATTRIBUTE[i];
      var istTWAttr = D.ATTRIBUTE.torwart.keys.indexOf(k) >= 0;
      var v;
      if (istTW && !istTWAttr && !g[k]) {
        // Feldspielerattribute eines Torhueters: bewusst niedrig.
        v = rng.gauss(ziel * 0.42, 9);
      } else if (!istTW && istTWAttr) {
        v = rng.gauss(14, 6);
      } else {
        var wichtig = (g[k] || 0) / maxG;      // 0 .. 1
        var bias = wichtig > 0 ? -6 + wichtig * 16 : -13;
        v = rng.gauss(ziel + bias, 8.5);
      }
      attr[k] = U.clamp(Math.round(v), 1, 99);
    }

    // Zwei Korrekturdurchlaeufe, damit die Zielstaerke sauber getroffen wird.
    for (var durchlauf = 0; durchlauf < 3; durchlauf++) {
      var s = 0;
      for (k in g) s += attr[k] * g[k];
      var diff = ziel - s;
      if (Math.abs(diff) < 0.4) break;
      for (k in g) {
        attr[k] = U.clamp(Math.round(attr[k] + diff * (0.5 + g[k] / maxG * 0.9)), 1, 99);
      }
    }
    return attr;
  }

  var FUESSE = ['rechts', 'rechts', 'rechts', 'rechts', 'links', 'links', 'beidfüßig'];

  function nebenpositionen(rng, pos) {
    var kandidaten = Object.keys(D.POS_VERWANDT[pos] || {}).filter(function (k) {
      return k !== pos && D.POS_VERWANDT[pos][k] >= 0.62;
    });
    var n = pos === 'TW' ? 0 : rng.int(0, Math.min(2, kandidaten.length));
    return rng.sample(kandidaten, n);
  }

  /**
   * Erzeugt einen Spieler.
   * opts: { pos, ziel (Staerke), alter, nation, auslandsquote, potenzialBonus }
   */
  function erzeugeSpieler(rng, opts) {
    opts = opts || {};
    var pos = opts.pos || rng.pick(D.POSITIONEN);
    var alter = opts.alter !== undefined ? opts.alter : rng.int(18, 33);
    var ziel = U.clamp(opts.ziel !== undefined ? opts.ziel : 55, 12, 96);

    // Junge Spieler sind noch nicht auf ihrem Niveau, alte schon darueber hinaus.
    var reife = alter <= 17 ? 0.62 : alter <= 19 ? 0.74 : alter <= 21 ? 0.85
      : alter <= 23 ? 0.93 : alter <= 32 ? 1.0 : alter <= 34 ? 0.98 : 0.94;
    var aktuell = U.clamp(ziel * reife + rng.gauss(0, 2), 8, 96);

    var nation = opts.nation || waehleNation(rng, opts.auslandsquote !== undefined ? opts.auslandsquote : 0.42);
    var nm = name(rng, nation);
    var attr = erzeugeAttribute(rng, pos, aktuell);

    var persoenlichkeit = rng.weighted(D.PERSOENLICHKEITEN, function (p) {
      return p.id === 'ausgeglichen' ? 3 : 1;
    });

    // Potenzial: junge Spieler koennen sich deutlich steigern.
    var luft = alter <= 17 ? rng.range(10, 34) : alter <= 19 ? rng.range(7, 28)
      : alter <= 21 ? rng.range(4, 20) : alter <= 24 ? rng.range(2, 12)
        : alter <= 27 ? rng.range(0, 5) : 0;
    var potenzial = U.clamp(Math.round(aktuell + luft + (opts.potenzialBonus || 0)), 12, 99);

    var p = {
      id: U.nextId('p'),
      vorname: nm.vorname,
      nachname: nm.nachname,
      nation: nation,
      alter: alter,
      geburtstag: rng.int(1, 365),
      pos: pos,
      nebenpos: nebenpositionen(rng, pos),
      fuss: pos === 'LV' || pos === 'LM' || pos === 'LF'
        ? (rng.chance(0.72) ? 'links' : rng.pick(['rechts', 'beidfüßig']))
        : rng.pick(FUESSE),
      attr: attr,
      potenzial: potenzial,
      form: U.clamp(Math.round(rng.gauss(52, 14)), 10, 95),
      moral: U.clamp(Math.round(rng.gauss(66, 12)), 15, 99),
      fitness: U.clamp(Math.round(rng.gauss(94, 4)), 60, 100),
      frische: 100,
      verletzung: null,
      verletzungsneigung: U.clamp(Math.round(rng.gauss(50, 18)), 5, 95),
      persoenlichkeit: persoenlichkeit.id,
      clubId: opts.clubId || null,
      nummer: 0,
      merkmale: [],
      kaderrolle: 'rotation',
      rollenSeit: 0,
      nationalelf: false,
      laenderspiele: 0,
      laendertore: 0,
      rueckkauf: null,           // { clubId, preis, bis } - Rueckkaufoption
      vorvertrag: null,          // { clubId, ab, gehalt, jahre } - ab Januar moeglich
      zweitteam: false,          // spielt in der U23
      u23: { spiele: 0, tore: 0 },
      kapitaen: false,
      vertrag: null,
      leihe: null,
      marktwert: 0,
      wechselwunsch: 0,          // 0 = zufrieden, 100 = will unbedingt weg
      unzufriedenheit: { spielzeit: 0, gehalt: 0, ambition: 0, taktik: 0 },
      transferliste: false,
      leihliste: false,
      trainingsfokus: 'keins',
      umschulung: null,          // { pos, fortschritt } - Training auf eine neue Position
      trainingsleistung: 50,
      sperre: 0,
      sperreGrund: '',
      gelbeSaison: 0,
      staerkeStart: 0,             // Staerke zu Saisonbeginn - Grundlage der Entwicklungsmarke
      stats: leereStats(),
      ligaStats: leereStats(),     // nur Ligaspiele - fuer Torjaegerliste und Tabellen
      karriere: leereStats(),
      saisonhistorie: [],        // je Saison ein Eintrag, aelteste zuerst
      historie: [],
      scoutwissen: opts.clubId ? 1 : U.clamp(rng.range(0.12, 0.45), 0, 1),
      letzteNoten: []
    };
    p.merkmale = merkmaleWaehlen(rng, p);
    p.marktwert = marktwert(p);
    p.staerkeStart = Math.round(gesamt(p) * 10) / 10;
    return p;
  }

  function leereStats() {
    return {
      spiele: 0, startelf: 0, minuten: 0, tore: 0, vorlagen: 0,
      gelb: 0, gelbrot: 0, rot: 0, notenSumme: 0, notenAnzahl: 0,
      gegentore: 0, zuNull: 0, schuesse: 0, schuesseAufsTor: 0,
      zweikaempfe: 0, zweikaempfeGewonnen: 0, paesse: 0, paesseAngekommen: 0,
      kmGelaufen: 0, xG: 0, xA: 0, paraden: 0
    };
  }

  function schnitt(stats) {
    return stats.notenAnzahl ? stats.notenSumme / stats.notenAnzahl : 0;
  }

  /**
   * Schreibt die abgelaufene Saison in die Laufbahn des Spielers fort.
   * Kurze Schluessel, weil das in jedem Spielstand mitgespeichert wird.
   */
  function saisonAbschliessen(p, world) {
    if (!p.stats || !p.stats.spiele) return null;
    var club = p.clubId ? world.vereine[p.clubId] : null;
    var eintrag = {
      s: world.saison,
      c: p.clubId || null,
      l: club ? club.liga : 0,
      sp: p.stats.spiele,
      st: p.stats.startelf,
      t: p.stats.tore,
      v: p.stats.vorlagen,
      n: Math.round(schnitt(p.stats) * 100) / 100,
      zn: p.pos === 'TW' ? p.stats.zuNull : 0
    };
    p.saisonhistorie = p.saisonhistorie || [];
    p.saisonhistorie.push(eintrag);
    if (p.saisonhistorie.length > 24) p.saisonhistorie.shift();
    return eintrag;
  }

  /**
   * Wie viel staerker (oder schwaecher) ist ein Spieler seit Saisonbeginn?
   * Diese Zahl ist der sichtbarste Beweis dafuer, dass Training, Spielzeit
   * und Nachwuchsarbeit etwas bewirken.
   */
  function entwicklungSeitSaisonstart(p) {
    if (!p.staerkeStart) return 0;
    return Math.round((gesamt(p) - p.staerkeStart) * 10) / 10;
  }

  /** Beste Saison nach Toren - fuer Kurzportraets und Scoutberichte. */
  function besteSaison(p) {
    var h = p.saisonhistorie || [];
    var best = null;
    h.forEach(function (e) {
      if (!best || e.t > best.t || (e.t === best.t && e.sp > best.sp)) best = e;
    });
    return best;
  }

  // ------------------------------------------------------------ Marktwert

  var POS_WERTFAKTOR = {
    TW: 0.72, IV: 0.95, LV: 0.92, RV: 0.92, DM: 0.98, ZM: 1.02,
    OM: 1.12, LM: 1.00, RM: 1.00, LF: 1.14, RF: 1.14, ST: 1.20
  };

  var ALTER_FAKTOR = {
    16: 1.15, 17: 1.30, 18: 1.42, 19: 1.46, 20: 1.44, 21: 1.40, 22: 1.34,
    23: 1.28, 24: 1.20, 25: 1.14, 26: 1.08, 27: 1.02, 28: 0.94, 29: 0.84,
    30: 0.72, 31: 0.60, 32: 0.48, 33: 0.38, 34: 0.28, 35: 0.20, 36: 0.14,
    37: 0.09, 38: 0.06, 39: 0.04, 40: 0.03
  };

  function alterFaktor(a) {
    if (a < 16) return 1.0;
    return ALTER_FAKTOR[a] !== undefined ? ALTER_FAKTOR[a] : 0.03;
  }

  /** Restlaufzeit des Vertrags in Monaten (grob). */
  function restlaufzeitMonate(p, world) {
    if (!p.vertrag || !world) return 24;
    return Math.max(0, Math.round((p.vertrag.bis - world.tag) / 30.4));
  }

  function marktwert(p, world) {
    var st = gesamt(p);
    var basis = Math.pow(Math.max(1, st - 36) / 40, 4.2) * 42e6;

    // Potenzialaufschlag: was ein Spieler noch werden kann, zahlt der Markt mit.
    var luft = Math.max(0, p.potenzial - st);
    var potFaktor = 1 + (luft / 40) * (p.alter <= 21 ? 1.25 : p.alter <= 24 ? 0.75 : 0.30);

    var wert = basis * alterFaktor(p.alter) * potFaktor * (POS_WERTFAKTOR[p.pos] || 1);

    // Form und Torgefahr der laufenden Saison
    wert *= 0.94 + (p.form / 100) * 0.12;
    if (p.stats.spiele >= 8) {
      var quote = (p.stats.tore + p.stats.vorlagen * 0.6) / p.stats.spiele;
      wert *= U.clamp(0.90 + quote * 0.55, 0.90, 1.45);
    }

    // Vertragslaufzeit
    if (world) {
      var m = restlaufzeitMonate(p, world);
      var vf = m >= 36 ? 1.05 : m >= 24 ? 1.00 : m >= 18 ? 0.92
        : m >= 12 ? 0.78 : m >= 6 ? 0.52 : 0.28;
      wert *= vf;
    }

    if (p.verletzung && p.verletzung.tage > 60) wert *= 0.80;
    return Math.max(25000, Math.round(wert / 25000) * 25000);
  }

  /** Geforderte Ablöse des abgebenden Vereins (immer ueber dem Marktwert). */
  function forderung(p, world, club) {
    var mw = p.marktwert;
    var f = 1.30;
    if (p.alter <= 21) f += 0.28;                       // Talente sind teuer
    if (p.vertrag && restlaufzeitMonate(p, world) >= 36) f += 0.22;
    if (p.transferliste) f -= 0.30;
    if (p.wechselwunsch > 60) f -= 0.22;
    if (club && club.finanz > 80) f += 0.15;            // reiche Klubs muessen nicht verkaufen
    if (club && club.finanz < 40) f -= 0.10;
    return Math.max(25000, Math.round(mw * U.clamp(f, 0.55, 2.4) / 25000) * 25000);
  }

  // ------------------------------------------------------------ Gehalt

  function gehaltsforderung(p, club, world) {
    var st = Math.max(gesamt(p), p.potenzial * 0.72);
    var basis = Math.pow(Math.max(1, st - 35) / 40, 3.0) * 150000;  // EUR pro Woche
    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
    basis *= pers ? pers.gehaltsgier : 1;
    if (club) {
      basis *= 0.66 + (club.ruf / 100) * 0.62;    // grosse Klubs zahlen mehr
      if (club.liga === 2) basis *= 0.55;
      if (club.liga >= 3) basis *= 0.28;
    }
    if (p.alter <= 20) basis *= 0.55;
    else if (p.alter <= 22) basis *= 0.78;
    else if (p.alter >= 33) basis *= 0.88;
    return Math.max(2000, Math.round(basis / 500) * 500);
  }

  function vertragErzeugen(rng, p, club, world, jahre) {
    jahre = jahre || rng.int(1, 4);
    var gehalt = gehaltsforderung(p, club, world);
    gehalt = Math.round(gehalt * rng.range(0.85, 1.18) / 500) * 500;
    return {
      bis: world ? world.tag + Math.round(jahre * 365) : 0,
      unterschrieben: world ? world.tag : 0,
      gehalt: gehalt,                                   // EUR pro Woche
      handgeld: 0,
      ausstiegsklausel: rng.chance(0.14) ? Math.round(marktwert(p, world) * rng.range(1.4, 2.6) / 100000) * 100000 : 0,
      praemien: {
        einsatz: Math.round(gehalt * rng.range(0.05, 0.14) / 100) * 100,
        tor: p.pos === 'ST' || p.pos === 'LF' || p.pos === 'RF' || p.pos === 'OM'
          ? Math.round(gehalt * rng.range(0.10, 0.25) / 100) * 100 : Math.round(gehalt * 0.05 / 100) * 100,
        sieg: Math.round(gehalt * rng.range(0.06, 0.16) / 100) * 100,
        zuNull: p.pos === 'TW' || p.pos === 'IV' ? Math.round(gehalt * 0.10 / 100) * 100 : 0
      },
      weiterverkauf: 0                                   // Anteil % fuer Ex-Verein
    };
  }

  // ------------------------------------------------------------ Kader

  // Sollbesetzung eines Profikaders (Position -> Anzahl).
  var KADER_SCHEMA = [
    ['TW', 3], ['IV', 4], ['LV', 2], ['RV', 2], ['DM', 2],
    ['ZM', 4], ['OM', 2], ['LF', 2], ['RF', 2], ['ST', 3]
  ];

  /**
   * Erzeugt einen kompletten Kader fuer einen Verein. Die Staerke der
   * einzelnen Spieler streut um ein Niveau, das sich aus dem Ruf des
   * Vereins ergibt.
   */
  /**
   * Wie gut kennt man einen fremden Spieler, ohne ihn beobachtet zu haben?
   * Ein Nationalspieler eines Spitzenvereins ist jedem ein Begriff, ein
   * Ergaenzungsspieler aus der 3. Liga niemandem. Ohne dieses Gefaelle
   * waere die gesamte Scoutingabteilung ohne Aufgabe.
   */
  function bekanntheit(p, club, rng) {
    var ligaAnteil = club.liga === 1 ? 0.34 : club.liga === 2 ? 0.20 : 0.06;
    var klasse = (gesamt(p) - 42) / 150;              // 0 .. ~0.38
    var alt = p.alter >= 26 ? 0.08 : p.alter <= 20 ? -0.06 : 0;
    var wert = 0.16 + ligaAnteil + klasse + alt + (rng ? rng.range(-0.07, 0.07) : 0);
    return U.clamp(Math.round(wert * 100) / 100, 0.08, 0.92);
  }

  function erzeugeKader(rng, club, world) {
    var niveau = niveauFuerVerein(club);
    var spieler = [];
    var nummern = {};
    var auslandsquote = U.clamp(0.10 + (club.ruf / 100) * 0.62, 0.08, 0.72);

    KADER_SCHEMA.forEach(function (eintrag) {
      var pos = eintrag[0], anzahl = eintrag[1];
      for (var i = 0; i < anzahl; i++) {
        // Der erste Spieler je Position ist Stammkraft, danach faellt es ab.
        var abschlag = i === 0 ? rng.range(1.5, 4.5) : i === 1 ? rng.range(-2.5, 2.0)
          : i === 2 ? rng.range(-8, -2) : rng.range(-14, -5);
        var alter;
        var r = rng.next();
        if (r < 0.10) alter = rng.int(17, 19);
        else if (r < 0.30) alter = rng.int(20, 22);
        else if (r < 0.62) alter = rng.int(23, 26);
        else if (r < 0.86) alter = rng.int(27, 30);
        else alter = rng.int(31, 36);

        var p = erzeugeSpieler(rng, {
          pos: pos,
          ziel: U.clamp(niveau + abschlag + rng.gauss(0, 2.2), 20, 95),
          alter: alter,
          clubId: club.id,
          auslandsquote: auslandsquote,
          potenzialBonus: (club.akademie - 55) / 14
        });
        p.vertrag = vertragErzeugen(rng, p, club, world, gewichteteLaufzeit(rng, p));
        p.marktwert = marktwert(p, world);
        p.scoutwissen = bekanntheit(p, club, rng);
        spieler.push(p);
      }
    });

    // Kaderstatus nach der Stellung im Kader.
    rollenAusrichten(spieler, world);

    // Trikotnummern verteilen: 1 fuer den ersten Torwart, danach frei.
    var sortiert = U.sortBy(spieler, function (p) { return -gesamt(p); });
    var tws = sortiert.filter(function (p) { return p.pos === 'TW'; });
    if (tws[0]) { tws[0].nummer = 1; nummern[1] = true; }
    sortiert.forEach(function (p) {
      if (p.nummer) return;
      var n;
      var versuche = 0;
      do { n = rng.int(2, 39); versuche++; } while (nummern[n] && versuche < 80);
      if (nummern[n]) { n = 40; while (nummern[n]) n++; }
      nummern[n] = true;
      p.nummer = n;
    });

    // Kapitaen: Fuehrung, Erfahrung und Staerke entscheiden.
    var kap = U.sortBy(spieler, function (p) {
      return -(p.attr.fuehrung * 1.6 + p.attr.disziplin * 0.5 + gesamt(p) * 0.8 + p.alter * 1.2);
    })[0];
    if (kap) kap.kapitaen = true;

    return spieler;
  }

  function gewichteteLaufzeit(rng, p) {
    if (p.alter <= 20) return rng.int(3, 5);
    if (p.alter <= 24) return rng.int(2, 5);
    if (p.alter <= 29) return rng.int(1, 4);
    if (p.alter <= 33) return rng.int(1, 3);
    return 1;
  }

  /** Durchschnittliches Kaderniveau, das zu einem Verein passt. */
  function niveauFuerVerein(club) {
    // Die Spreizung ist bewusst gross: zwischen Meister und Aufsteiger
    // liegen in der Bundesliga real rund 25 Punkte Kaderqualitaet.
    if (club.liga === 1) return 19 + club.ruf * 0.62;      // Ruf 95 -> 78, Ruf 55 -> 53
    if (club.liga === 2) return 17 + club.ruf * 0.58;      // Ruf 63 -> 54, Ruf 44 -> 43
    if (club.liga === 3) return 12 + club.ruf * 0.60;
    return 6 + club.ruf * 0.62;
  }

  // ------------------------------------------------------------ Entwicklung

  /**
   * Woechentliche Entwicklung eines Spielers.
   * ctx: { trainingsqualitaet, einheiten (Liste), fokus, spielanteil (0-1),
   *        akademie, tz, world, rng, personalBonus }
   */
  function entwickle(p, ctx) {
    var rng = ctx.rng;
    var st = gesamt(p);
    var luft = p.potenzial - st;

    // Altersabhaengige Lernkurve
    var lern;
    if (p.alter <= 17) lern = 1.55;
    else if (p.alter <= 19) lern = 1.40;
    else if (p.alter <= 21) lern = 1.15;
    else if (p.alter <= 23) lern = 0.90;
    else if (p.alter <= 25) lern = 0.62;
    else if (p.alter <= 27) lern = 0.38;
    else if (p.alter <= 29) lern = 0.20;
    else lern = 0.08;

    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
    var persF = pers ? pers.trainingBonus : 1;

    var spielF = 0.55 + U.clamp(ctx.spielanteil || 0, 0, 1) * 0.75;   // Spielpraxis zaehlt
    var moralF = 0.85 + (p.moral / 100) * 0.30;
    var qualF = 0.55 + (ctx.trainingsqualitaet / 100) * 0.90;

    var fortschritt = luft > 0
      ? (luft / 30) * lern * persF * spielF * moralF * qualF * 0.55
      : 0;

    // Verletzte trainieren nicht mit.
    if (p.verletzung) fortschritt *= 0.10;

    // Welche Attribute profitieren? Trainingseinheiten und Individualfokus.
    var pool = [];
    (ctx.einheiten || []).forEach(function (id) {
      var e = D.TRAININGSEINHEITEN[id];
      if (!e) return;
      if (e.nurTW && p.pos !== 'TW') return;
      if (!e.nurTW && p.pos === 'TW' && e.gruppen.length && id !== 'kondition' && id !== 'spielformen') {
        // Feldspielereinheiten bringen Torhuetern wenig.
        pool = pool.concat(e.gruppen.slice(0, 1));
        return;
      }
      pool = pool.concat(e.gruppen);
    });
    var fokus = D.INDIVIDUALTRAINING[p.trainingsfokus];
    if (fokus && fokus.gruppen.length) {
      pool = pool.concat(fokus.gruppen, fokus.gruppen, fokus.gruppen);
    }
    if (!pool.length) pool = D.ALLE_ATTRIBUTE.slice();

    var g = gewichte(p.pos);
    var punkte = fortschritt;
    var veraendert = [];
    var versuche = 0;
    while (punkte > 0.05 && versuche < 40) {
      versuche++;
      var k = rng.pick(pool);
      if (p.pos !== 'TW' && D.ATTRIBUTE.torwart.keys.indexOf(k) >= 0) continue;
      if (p.attr[k] >= 99) continue;
      // Wichtige Attribute wachsen bevorzugt.
      var chance = 0.35 + (g[k] || 0) * 4;
      if (!rng.chance(Math.min(0.95, chance))) continue;
      p.attr[k] += 1;
      veraendert.push(k);
      punkte -= 1;
    }
    // Restpunkte als Wahrscheinlichkeit
    if (punkte > 0 && rng.chance(punkte)) {
      var k2 = rng.pick(pool);
      if (p.attr[k2] < 99 && (p.pos === 'TW' || D.ATTRIBUTE.torwart.keys.indexOf(k2) < 0)) {
        p.attr[k2] += 1; veraendert.push(k2);
      }
    }

    // Alterung: ab 30 lassen die physischen Werte nach.
    if (p.alter >= 29) {
      var abbau = (p.alter - 28) * 0.055;
      if (p.alter >= 33) abbau *= 1.7;
      abbau *= (1 - (p.attr.disziplin / 400));             // Profis halten sich laenger
      var physisch = D.ATTRIBUTE.physisch.keys;
      if (rng.chance(abbau)) {
        var kp = rng.pick(physisch);
        if (p.attr[kp] > 8) { p.attr[kp] -= 1; veraendert.push('-' + kp); }
      }
      // Erfahrung waechst weiter
      if (rng.chance(0.05) && p.attr.entscheidung < 99) p.attr.entscheidung += 1;
      if (rng.chance(0.04) && p.attr.fuehrung < 99) p.attr.fuehrung += 1;
      if (rng.chance(0.04) && p.attr.positionierung < 99) p.attr.positionierung += 1;
    }

    // Trainingsleistung als sichtbare Rueckmeldung fuer den Trainer
    var soll = 50 + fortschritt * 55 + (p.moral - 60) * 0.25 + rng.gauss(0, 8);
    p.trainingsleistung = Math.round(U.clamp(p.trainingsleistung * 0.6 + soll * 0.4, 1, 99));

    return veraendert;
  }

  /** Form driftet Woche fuer Woche in Richtung eines Zielwerts. */
  function formDrift(p, rng) {
    var ziel = 45 + (p.moral - 60) * 0.35 + (p.trainingsleistung - 50) * 0.30;
    if (p.letzteNoten.length) {
      // Gute Noten heben die Form (Note 1 = gut, 6 = schlecht).
      var schnittNote = U.avg(p.letzteNoten.slice(-5));
      ziel += (3.5 - schnittNote) * 12;
    }
    ziel = U.clamp(ziel, 8, 96);
    p.form = U.clamp(Math.round(p.form + (ziel - p.form) * 0.30 + rng.gauss(0, 5)), 5, 99);
  }


  // ------------------------------------------------------------ Merkmale

  /** Waehlt die besonderen Eigenschaften eines Spielers. */
  function merkmaleWaehlen(rng, p) {
    var moeglich = D.MERKMALE.filter(function (m) {
      try { return m.passt(p); } catch (e) { return false; }
    });
    if (!moeglich.length) return [];
    // Klasse entscheidet, wie viele Eigenheiten ein Spieler mitbringt.
    var st = gesamt(p);
    var schnitt = st >= 82 ? 2.0 : st >= 72 ? 1.5 : st >= 62 ? 1.0 : 0.6;
    var anzahl = Math.min(moeglich.length, Math.max(0, Math.round(rng.gauss(schnitt, 0.8))));
    var gewaehlt = [];
    for (var i = 0; i < anzahl; i++) {
      var kandidaten = moeglich.filter(function (m) { return gewaehlt.indexOf(m.id) < 0; });
      if (!kandidaten.length) break;
      var m = rng.weighted(kandidaten, function (x) { return x.gewicht || 1; });
      if (m) gewaehlt.push(m.id);
    }
    return gewaehlt;
  }

  function hatMerkmal(p, id) {
    return !!(p && p.merkmale && p.merkmale.indexOf(id) >= 0);
  }

  /**
   * Prueft nach einer Entwicklung, ob ein Spieler eine neue Eigenschaft
   * ausgepraegt hat. Nur junge Spieler bekommen noch welche dazu.
   */
  function merkmaleFortschreiben(rng, p) {
    if (p.alter > 26) return null;
    if ((p.merkmale || []).length >= 3) return null;
    if (!rng.chance(0.12)) return null;
    var neu = D.MERKMALE.filter(function (m) {
      if (m.negativ) return false;
      if (hatMerkmal(p, m.id)) return false;
      try { return m.passt(p); } catch (e) { return false; }
    });
    if (!neu.length) return null;
    var m = rng.weighted(neu, function (x) { return x.gewicht || 1; });
    if (!m) return null;
    p.merkmale.push(m.id);
    return m;
  }

  // ------------------------------------------------------------ Zweite Mannschaft

  var U23_HOECHSTALTER = 23;

  /** Darf dieser Spieler ueberhaupt in der zweiten Mannschaft spielen? */
  function u23Moeglich(p) {
    return p.alter <= U23_HOECHSTALTER;
  }

  /**
   * Ein Wochenspiel der zweiten Mannschaft. Es wird nicht ausgespielt -
   * was zaehlt, ist die Spielpraxis: Der Spieler entwickelt sich, als
   * haette er weitgehend durchgespielt, und bleibt bei Laune.
   */
  function u23Woche(p, rng) {
    if (!p.zweitteam || !u23Moeglich(p)) return null;
    if (p.verletzung || p.sperre > 0) return null;
    // Wer bei den Profis gespielt hat, ist ausgelaugt - dann kein
    // zusaetzliches Spiel in der Zweiten.
    if (p.fitness < 74) return null;
    if (!p.u23) p.u23 = { spiele: 0, tore: 0 };
    p.u23.spiele += 1;
    var torquote = p.pos === 'ST' || p.pos === 'LF' || p.pos === 'RF' ? 0.55
      : p.pos === 'OM' || p.pos === 'ZM' ? 0.25 : p.pos === 'TW' ? 0 : 0.08;
    var tore = 0;
    if (rng.chance(Math.min(0.9, torquote))) tore = 1;
    if (tore && rng.chance(0.18)) tore += 1;
    p.u23.tore += tore;
    p.moral = U.clamp(p.moral + 0.8 + tore * 0.6, 5, 99);
    p.fitness = U.clamp(p.fitness - 9, 0, 100);
    return { spiele: 1, tore: tore };
  }


  // ------------------------------------------------------------ Umschulung

  /**
   * Wie lange die Gewoehnung an eine neue Position dauert. Je naeher die
   * neue Position an der alten liegt, desto schneller geht es; junge
   * Spieler lernen leichter um als gestandene.
   */
  function umschulungsDauer(p, pos) {
    var naehe = (D.POS_VERWANDT[p.pos] || {})[pos] || 0.30;
    var wochen = 40 - naehe * 26;                      // 14 bis 32 Wochen
    if (p.alter <= 21) wochen *= 0.75;
    else if (p.alter >= 30) wochen *= 1.35;
    wochen *= U.clamp(1.25 - p.attr.entscheidung / 240, 0.85, 1.25);
    return Math.max(8, Math.round(wochen));
  }

  /** Startet eine Umschulung. Gibt null zurueck, wenn sie sinnlos waere. */
  function starteUmschulung(p, pos, world) {
    if (!pos || pos === p.pos) return null;
    if (p.pos === 'TW' || pos === 'TW') return null;    // Torwart bleibt Torwart
    if (p.nebenpos.indexOf(pos) >= 0) return null;      // kann er schon
    p.umschulung = {
      pos: pos,
      wochen: 0,
      ziel: umschulungsDauer(p, pos),
      seit: world ? world.tag : 0
    };
    return p.umschulung;
  }

  function brichUmschulungAb(p) { p.umschulung = null; }

  /**
   * Ein Trainingswochenschritt der Umschulung. Ist sie abgeschlossen,
   * zaehlt die neue Position als Nebenposition - der Spieler verliert
   * dort kaum noch Klasse.
   */
  function umschulungsSchritt(p, trainingsqualitaet) {
    var u = p.umschulung;
    if (!u) return null;
    var tempo = 0.7 + U.clamp(trainingsqualitaet, 5, 99) / 140;
    u.wochen += tempo;
    if (u.wochen < u.ziel) return null;
    p.umschulung = null;
    if (p.nebenpos.indexOf(u.pos) < 0) p.nebenpos = p.nebenpos.concat([u.pos]);
    return { pos: u.pos };
  }

  /** Fortschritt einer laufenden Umschulung, 0 bis 1. */
  function umschulungsStand(p) {
    if (!p.umschulung) return 0;
    return U.clamp(p.umschulung.wochen / Math.max(1, p.umschulung.ziel), 0, 1);
  }

  /** Positionen, auf die sich ein Spieler umschulen liesse. */
  function umschulungsZiele(p) {
    if (p.pos === 'TW') return [];
    return D.POSITIONEN.filter(function (pos) {
      if (pos === 'TW' || pos === p.pos) return false;
      return p.nebenpos.indexOf(pos) < 0;
    });
  }

  // ------------------------------------------------------------ Kaderstatus

  /** Der Status, den ein Spieler nach seiner Stellung im Kader bekaeme. */
  function vorgeschlageneRolle(p, kader) {
    var rang = kaderRang(p, kader);
    if (p.alter <= 19 && rang > 14) return 'perspektive';
    if (rang <= 3) return 'star';
    if (rang <= 11) return 'stamm';
    if (rang <= 16) return 'rotation';
    if (p.alter <= 21) return 'perspektive';
    return 'ergaenzung';
  }

  /**
   * Verteilt den Kaderstatus im ganzen Kader neu. Vereine der KI machen
   * das laufend; beim Verein des Nutzers nur, wo noch nichts gesetzt ist -
   * seine Entscheidungen bleiben stehen.
   */
  function rollenAusrichten(kader, world, nurLuecken) {
    var sortiert = U.sortBy(kader, function (x) { return -gesamt(x); });
    sortiert.forEach(function (p, i) {
      if (nurLuecken && p.kaderrolle && p.rollenSeit) return;
      if (p.kaderrolle === 'abgang' && nurLuecken) return;
      var rang = i + 1;
      var id;
      if (p.alter <= 19 && rang > 14) id = 'perspektive';
      else if (rang <= 3) id = 'star';
      else if (rang <= 11) id = 'stamm';
      else if (rang <= 16) id = 'rotation';
      else if (p.alter <= 21) id = 'perspektive';
      else id = 'ergaenzung';
      p.kaderrolle = id;
      if (!p.rollenSeit) p.rollenSeit = world ? world.tag : 0;
    });
  }

  function rolleVon(p) {
    return D.KADERROLLE[p.kaderrolle] || D.KADERROLLE.rotation;
  }

  /** Setzt den Status neu und verbucht die Reaktion des Spielers. */
  function setzeKaderrolle(p, id, world) {
    var alt = rolleVon(p);
    var neu = D.KADERROLLE[id];
    if (!neu || neu.id === alt.id) return null;
    p.kaderrolle = neu.id;
    p.rollenSeit = world ? world.tag : 0;
    var sprung = neu.stolz - alt.stolz;
    p.moral = U.clamp(p.moral + sprung * 0.9, 5, 99);
    if (sprung < 0) {
      p.unzufriedenheit.ambition = U.clamp(p.unzufriedenheit.ambition - sprung * 1.6, 0, 100);
    } else {
      p.unzufriedenheit.spielzeit = U.clamp(p.unzufriedenheit.spielzeit - sprung * 1.2, 0, 100);
    }
    return { alt: alt, neu: neu, sprung: sprung };
  }

  // ------------------------------------------------------------ Zufriedenheit

  /**
   * Berechnet die Unzufriedenheit eines Spielers. Ergebnis wandert in
   * p.unzufriedenheit und treibt langfristig den Wechselwunsch.
   */
  function pruefeZufriedenheit(p, club, world, rng) {
    var u = p.unzufriedenheit;
    var anteil = p.stats.spiele > 0 ? p.stats.minuten / Math.max(1, world.spieltageGespielt(club.id) * 90) : 0;

    // Die erwartete Spielzeit steht im Kaderstatus - das ist das
    // Versprechen, das der Trainer dem Spieler gegeben hat.
    var rolle = rolleVon(p);
    var erwartet = rolle.erwartung;
    if (p.alter <= 20) erwartet *= 0.75;
    // Wer in der zweiten Mannschaft spielt, bekommt seine Minuten dort.
    if (p.zweitteam) erwartet *= 0.30;
    var luecke = erwartet - anteil;
    if (world.spieltageGespielt(club.id) >= 5) {
      // Wer mehr spielt als versprochen, wird spuerbar zufriedener.
      u.spielzeit = U.clamp(u.spielzeit +
        (luecke > 0.10 ? luecke * 30 : luecke < -0.08 ? -9 : -6), 0, 100);
    }

    // Gehalt im Vergleich zu dem, was er verlangen wuerde
    var soll = gehaltsforderung(p, club, world);
    if (p.vertrag) {
      var verhaeltnis = p.vertrag.gehalt / soll;
      u.gehalt = U.clamp(u.gehalt + (verhaeltnis < 0.78 ? (0.78 - verhaeltnis) * 45 : -5), 0, 100);
    }

    // Ambition: guter Spieler in schwachem Verein
    var st = gesamt(p);
    var passend = niveauFuerVerein(club);
    u.ambition = U.clamp(u.ambition + (st > passend + 8 ? (st - passend - 8) * 1.3 : -4), 0, 100);

    var pers = D.PERSOENLICHKEITEN.filter(function (x) { return x.id === p.persoenlichkeit; })[0];
    var loyal = pers ? pers.loyalitaet : 1;
    var gesamtU = (u.spielzeit * 1.1 + u.gehalt * 0.9 + u.ambition * 1.0 + u.taktik * 0.5) / 3.5;
    if (p.kaderrolle === 'abgang') gesamtU = Math.min(100, gesamtU + 22);
    p.wechselwunsch = U.clamp(Math.round(gesamtU / loyal), 0, 100);

    // Moral folgt der Zufriedenheit langsam
    var moralZiel = 78 - gesamtU * 0.45;
    p.moral = U.clamp(Math.round(p.moral + (moralZiel - p.moral) * 0.14 + rng.gauss(0, 2.5)), 5, 99);
  }

  /** Position im internen Ranking des Kaders (1 = bester Spieler). */
  function kaderRang(p, kader) {
    var sortiert = U.sortBy(kader, function (x) { return -gesamt(x); });
    for (var i = 0; i < sortiert.length; i++) if (sortiert[i].id === p.id) return i + 1;
    return kader.length;
  }

  // ------------------------------------------------------------ Anzeige

  var STAERKE_LABEL = [
    [88, 'Weltklasse'], [80, 'International'], [73, 'Bundesliga-Spitze'],
    [66, 'Bundesliga-Stammkraft'], [58, 'Bundesliga-Ergänzung'],
    [50, 'Zweitliga-Stammkraft'], [42, 'Zweitliga-Ergänzung'],
    [34, 'Drittliga-Niveau'], [0, 'Amateurniveau']
  ];

  function staerkeLabel(v) {
    for (var i = 0; i < STAERKE_LABEL.length; i++) {
      if (v >= STAERKE_LABEL[i][0]) return STAERKE_LABEL[i][1];
    }
    return 'Amateurniveau';
  }

  /**
   * Attributwert so, wie ihn der Trainer sieht: bei geringem Scoutwissen
   * unscharf. Liefert { wert, min, max, sicher }.
   */
  function sichtbaresAttribut(p, key, wissen) {
    var w = wissen === undefined ? p.scoutwissen : wissen;
    var v = p.attr[key];
    if (w >= 0.95) return { wert: v, min: v, max: v, sicher: true };
    var spanne = Math.round((1 - w) * 26);
    return {
      wert: v, min: U.clamp(v - spanne, 1, 99), max: U.clamp(v + spanne, 1, 99), sicher: false
    };
  }

  FM.players = {
    erzeugeSpieler: erzeugeSpieler,
    erzeugeKader: erzeugeKader,
    bekanntheit: bekanntheit,
    erzeugeAttribute: erzeugeAttribute,
    vertragErzeugen: vertragErzeugen,
    gewichte: gewichte,
    rohStaerke: rohStaerke,
    posStaerke: posStaerke,
    gesamt: gesamt,
    tagesform: tagesform,
    marktwert: marktwert,
    forderung: forderung,
    gehaltsforderung: gehaltsforderung,
    restlaufzeitMonate: restlaufzeitMonate,
    entwickle: entwickle,
    formDrift: formDrift,
    pruefeZufriedenheit: pruefeZufriedenheit,
    kaderRang: kaderRang,
    niveauFuerVerein: niveauFuerVerein,
    staerkeLabel: staerkeLabel,
    sichtbaresAttribut: sichtbaresAttribut,
    leereStats: leereStats,
    schnitt: schnitt,
    saisonAbschliessen: saisonAbschliessen,
    besteSaison: besteSaison,
    entwicklungSeitSaisonstart: entwicklungSeitSaisonstart,
    alterFaktor: alterFaktor,
    KADER_SCHEMA: KADER_SCHEMA,
    merkmaleWaehlen: merkmaleWaehlen,
    merkmaleFortschreiben: merkmaleFortschreiben,
    hatMerkmal: hatMerkmal,
    vorgeschlageneRolle: vorgeschlageneRolle,
    rollenAusrichten: rollenAusrichten,
    rolleVon: rolleVon,
    setzeKaderrolle: setzeKaderrolle,
    starteUmschulung: starteUmschulung,
    brichUmschulungAb: brichUmschulungAb,
    umschulungsSchritt: umschulungsSchritt,
    umschulungsStand: umschulungsStand,
    umschulungsZiele: umschulungsZiele,
    umschulungsDauer: umschulungsDauer,
    u23Moeglich: u23Moeglich,
    u23Woche: u23Woche,
    U23_HOECHSTALTER: U23_HOECHSTALTER
  };

})(typeof window !== 'undefined' ? window : globalThis);
