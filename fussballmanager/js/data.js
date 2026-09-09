/*
 * data.js - Stammdaten der Spielwelt.
 *
 * Die Vereine, Stadien und Staedte entsprechen der realen Ligalandschaft,
 * alle Spieler und Mitarbeiter werden dagegen prozedural erzeugt. Damit
 * bleibt das Spiel unabhaengig von Kaderdaten, die ohnehin nach wenigen
 * Wochen veraltet waeren.
 */
(function (global) {
  'use strict';

  var FM = global.FM = global.FM || {};

  // ------------------------------------------------------------ Positionen

  // Reihenfolge bestimmt die Sortierung im Kader.
  var POSITIONEN = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LM', 'RM', 'LF', 'RF', 'ST'];

  var POS_NAME = {
    TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger',
    RV: 'Rechtsverteidiger', DM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld',
    OM: 'Offensives Mittelfeld', LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld',
    LF: 'Linksaussen', RF: 'Rechtsaussen', ST: 'Mittelstuermer'
  };

  var POS_GRUPPE = {
    TW: 'TW', IV: 'ABW', LV: 'ABW', RV: 'ABW',
    DM: 'MIT', ZM: 'MIT', OM: 'MIT', LM: 'MIT', RM: 'MIT',
    LF: 'ANG', RF: 'ANG', ST: 'ANG'
  };

  // Wie gut deckt eine Position eine andere ab (1 = perfekt, 0 = gar nicht).
  // Wird als Abschlag auf die Staerke verrechnet, wenn jemand fremdgeht.
  var POS_VERWANDT = {
    TW: { TW: 1 },
    IV: { IV: 1, DM: .72, LV: .62, RV: .62 },
    LV: { LV: 1, RV: .70, LM: .78, IV: .62, LF: .58 },
    RV: { RV: 1, LV: .70, RM: .78, IV: .62, RF: .58 },
    DM: { DM: 1, ZM: .86, IV: .70, RV: .55, LV: .55 },
    ZM: { ZM: 1, DM: .86, OM: .82, LM: .70, RM: .70 },
    OM: { OM: 1, ZM: .82, LF: .72, RF: .72, ST: .68, LM: .68, RM: .68 },
    LM: { LM: 1, RM: .74, LF: .84, ZM: .70, LV: .72 },
    RM: { RM: 1, LM: .74, RF: .84, ZM: .70, RV: .72 },
    LF: { LF: 1, RF: .76, LM: .84, OM: .72, ST: .68 },
    RF: { RF: 1, LF: .76, RM: .84, OM: .72, ST: .68 },
    ST: { ST: 1, LF: .70, RF: .70, OM: .64 }
  };

  // ------------------------------------------------------------ Attribute

  var ATTRIBUTE = {
    technisch: {
      label: 'Technik',
      keys: ['technik', 'passen', 'flanken', 'abschluss', 'weitschuss',
        'dribbling', 'kopfball', 'zweikampf', 'standards', 'elfmeter']
    },
    mental: {
      label: 'Mentalität',
      keys: ['uebersicht', 'entscheidung', 'positionierung', 'antizipation',
        'arbeitsrate', 'aggressivitaet', 'teamwork', 'nervenstaerke',
        'fuehrung', 'disziplin']
    },
    physisch: {
      label: 'Physis',
      keys: ['tempo', 'antritt', 'kraft', 'ausdauer', 'beweglichkeit',
        'sprungkraft', 'balance']
    },
    torwart: {
      label: 'Torwartspiel',
      keys: ['reflexe', 'strafraum', 'handling', 'abschlag', 'einsgegeneins']
    }
  };

  var ATTR_NAME = {
    technik: 'Ballkontrolle', passen: 'Passspiel', flanken: 'Flanken',
    abschluss: 'Abschluss', weitschuss: 'Weitschuss', dribbling: 'Dribbling',
    kopfball: 'Kopfball', zweikampf: 'Zweikampf', standards: 'Standards',
    elfmeter: 'Elfmeter',
    uebersicht: 'Übersicht', entscheidung: 'Entscheidung',
    positionierung: 'Stellungsspiel', antizipation: 'Antizipation',
    arbeitsrate: 'Arbeitsrate', aggressivitaet: 'Aggressivität',
    teamwork: 'Teamwork', nervenstaerke: 'Nervenstärke', fuehrung: 'Führung',
    disziplin: 'Disziplin',
    tempo: 'Tempo', antritt: 'Antritt', kraft: 'Körperkraft',
    ausdauer: 'Ausdauer', beweglichkeit: 'Beweglichkeit',
    sprungkraft: 'Sprungkraft', balance: 'Balance',
    reflexe: 'Reflexe', strafraum: 'Strafraumbeherrschung',
    handling: 'Fangsicherheit', abschlag: 'Abschlag/Abwurf',
    einsgegeneins: 'Eins gegen Eins'
  };

  var ALLE_ATTRIBUTE = [];
  Object.keys(ATTRIBUTE).forEach(function (g) {
    ALLE_ATTRIBUTE = ALLE_ATTRIBUTE.concat(ATTRIBUTE[g].keys);
  });

  // Gewichtung der Attribute je Position. Summe wird normiert.
  var POS_GEWICHTE = {
    TW: { reflexe: 10, einsgegeneins: 8, handling: 8, strafraum: 7, abschlag: 5,
      positionierung: 6, antizipation: 5, entscheidung: 4, nervenstaerke: 4,
      beweglichkeit: 4, sprungkraft: 3, passen: 3, fuehrung: 2, kraft: 2 },
    IV: { zweikampf: 9, positionierung: 9, antizipation: 8, kopfball: 8,
      kraft: 7, entscheidung: 6, sprungkraft: 5, aggressivitaet: 5,
      passen: 5, tempo: 5, disziplin: 4, technik: 3, fuehrung: 3, balance: 3, uebersicht: 2 },
    LV: { tempo: 8, ausdauer: 8, zweikampf: 7, flanken: 7, positionierung: 6,
      antizipation: 6, arbeitsrate: 7, antritt: 6, technik: 5, passen: 5,
      dribbling: 4, entscheidung: 4, kraft: 3, disziplin: 3, teamwork: 3 },
    DM: { zweikampf: 9, positionierung: 8, antizipation: 8, passen: 8,
      arbeitsrate: 7, uebersicht: 6, entscheidung: 6, ausdauer: 6,
      technik: 5, kraft: 5, aggressivitaet: 4, teamwork: 4, disziplin: 4, kopfball: 3 },
    ZM: { passen: 9, uebersicht: 8, technik: 8, entscheidung: 7, ausdauer: 7,
      arbeitsrate: 6, zweikampf: 5, antizipation: 5, dribbling: 5,
      weitschuss: 4, teamwork: 5, positionierung: 4, balance: 3, kraft: 3 },
    OM: { uebersicht: 9, passen: 9, technik: 9, dribbling: 7, entscheidung: 7,
      abschluss: 6, weitschuss: 6, antritt: 5, beweglichkeit: 5,
      standards: 4, nervenstaerke: 4, balance: 4, arbeitsrate: 3 },
    LM: { flanken: 8, ausdauer: 8, arbeitsrate: 7, tempo: 7, technik: 6,
      passen: 6, dribbling: 6, zweikampf: 5, positionierung: 4,
      antritt: 5, entscheidung: 4, teamwork: 4, abschluss: 3 },
    LF: { dribbling: 9, tempo: 9, antritt: 8, technik: 7, abschluss: 6,
      flanken: 6, beweglichkeit: 6, balance: 5, entscheidung: 4,
      passen: 4, nervenstaerke: 3, arbeitsrate: 3, uebersicht: 3 },
    ST: { abschluss: 10, positionierung: 8, antritt: 7, nervenstaerke: 6,
      technik: 6, kopfball: 6, kraft: 6, tempo: 6, antizipation: 5,
      entscheidung: 5, balance: 4, sprungkraft: 4, dribbling: 4, passen: 3 }
  };
  POS_GEWICHTE.RV = POS_GEWICHTE.LV;
  POS_GEWICHTE.RM = POS_GEWICHTE.LM;
  POS_GEWICHTE.RF = POS_GEWICHTE.LF;

  // ------------------------------------------------------------ Vereine

  function c(id, name, kurz, stadt, stadion, kap, liga, ruf, finanz, fans, opts) {
    var o = opts || {};
    return {
      id: id, name: name, kurz: kurz, stadt: stadt, stadion: stadion,
      kapazitaet: kap, liga: liga, ruf: ruf, finanz: finanz, fans: fans,
      farbe: o.farbe || '#3a4a6b', farbe2: o.farbe2 || '#ffffff',
      akademie: o.akademie || Math.round(ruf * 0.85),
      trainingszentrum: o.tz || Math.round(ruf * 0.9),
      medizin: o.med || Math.round(ruf * 0.88),
      scoutingnetz: o.sc || Math.round(ruf * 0.85),
      tradition: o.tradition || ruf,
      europapokal: o.eu || 0        // 5-Jahres-Wertung als Rohwert
    };
  }

  var VEREINE = [
    // --------------------------------------------------- 1. Bundesliga
    c('fcb', 'FC Bayern München', 'FCB', 'München', 'Allianz Arena', 75024, 1, 95, 99, 97,
      { farbe: '#dc052d', farbe2: '#ffffff', akademie: 90, tz: 95, med: 94, sc: 93, eu: 128, tradition: 98 }),
    c('bvb', 'Borussia Dortmund', 'BVB', 'Dortmund', 'Signal Iduna Park', 81365, 1, 87, 88, 96,
      { farbe: '#fde100', farbe2: '#000000', akademie: 86, tz: 88, med: 86, sc: 88, eu: 92, tradition: 92 }),
    c('b04', 'Bayer 04 Leverkusen', 'B04', 'Leverkusen', 'BayArena', 30210, 1, 84, 86, 70,
      { farbe: '#e32219', farbe2: '#000000', akademie: 80, tz: 88, med: 88, sc: 86, eu: 84, tradition: 74 }),
    c('rbl', 'RB Leipzig', 'RBL', 'Leipzig', 'Red Bull Arena', 47069, 1, 82, 89, 72,
      { farbe: '#dd0741', farbe2: '#ffffff', akademie: 82, tz: 92, med: 90, sc: 92, eu: 76, tradition: 48 }),
    c('sge', 'Eintracht Frankfurt', 'SGE', 'Frankfurt', 'Deutsche Bank Park', 58000, 1, 79, 78, 84,
      { farbe: '#e1000f', farbe2: '#000000', akademie: 76, tz: 80, med: 78, sc: 82, eu: 62, tradition: 82 }),
    c('vfb', 'VfB Stuttgart', 'VFB', 'Stuttgart', 'MHPArena', 60449, 1, 77, 74, 85,
      { farbe: '#e32219', farbe2: '#ffffff', akademie: 84, tz: 78, med: 76, sc: 74, eu: 48, tradition: 84 }),
    c('scf', 'SC Freiburg', 'SCF', 'Freiburg', 'Europa-Park Stadion', 34700, 1, 72, 68, 68,
      { farbe: '#000000', farbe2: '#e2001a', akademie: 84, tz: 82, med: 82, sc: 78, eu: 42, tradition: 66 }),
    c('wob', 'VfL Wolfsburg', 'WOB', 'Wolfsburg', 'Volkswagen Arena', 30000, 1, 71, 80, 52,
      { farbe: '#65b32e', farbe2: '#ffffff', akademie: 74, tz: 84, med: 82, sc: 74, eu: 34, tradition: 60 }),
    c('bmg', 'Borussia Mönchengladbach', 'BMG', 'Mönchengladbach', 'Borussia-Park', 54042, 1, 70, 69, 82,
      { farbe: '#000000', farbe2: '#00a94f', akademie: 80, tz: 78, med: 76, sc: 72, eu: 30, tradition: 86 }),
    c('svw', 'SV Werder Bremen', 'SVW', 'Bremen', 'Weserstadion', 42100, 1, 69, 64, 84,
      { farbe: '#1d9053', farbe2: '#ffffff', akademie: 76, tz: 72, med: 72, sc: 70, eu: 24, tradition: 88 }),
    c('koe', '1. FC Köln', 'KOE', 'Köln', 'RheinEnergieStadion', 50000, 1, 67, 65, 88,
      { farbe: '#ed1c24', farbe2: '#ffffff', akademie: 78, tz: 74, med: 72, sc: 68, eu: 16, tradition: 84 }),
    c('hsv', 'Hamburger SV', 'HSV', 'Hamburg', 'Volksparkstadion', 57000, 1, 66, 66, 90,
      { farbe: '#0a3a82', farbe2: '#ffffff', akademie: 76, tz: 76, med: 72, sc: 68, eu: 14, tradition: 90 }),
    c('m05', '1. FSV Mainz 05', 'M05', 'Mainz', 'Mewa Arena', 33305, 1, 66, 60, 60,
      { farbe: '#c3141e', farbe2: '#ffffff', akademie: 78, tz: 74, med: 74, sc: 74, eu: 18, tradition: 58 }),
    c('tsg', 'TSG 1899 Hoffenheim', 'TSG', 'Sinsheim', 'PreZero Arena', 30150, 1, 65, 72, 44,
      { farbe: '#1961b5', farbe2: '#ffffff', akademie: 84, tz: 86, med: 84, sc: 78, eu: 22, tradition: 40 }),
    c('fca', 'FC Augsburg', 'FCA', 'Augsburg', 'WWK Arena', 30660, 1, 62, 58, 56,
      { farbe: '#ba3733', farbe2: '#46714d', akademie: 70, tz: 70, med: 70, sc: 64, eu: 8, tradition: 52 }),
    c('stp', 'FC St. Pauli', 'STP', 'Hamburg', 'Millerntor-Stadion', 29546, 1, 60, 54, 78,
      { farbe: '#61371f', farbe2: '#ffffff', akademie: 66, tz: 64, med: 66, sc: 62, eu: 4, tradition: 66 }),
    c('fcu', '1. FC Union Berlin', 'FCU', 'Berlin', 'An der Alten Försterei', 22012, 1, 66, 62, 74,
      { farbe: '#eb1923', farbe2: '#ffe600', akademie: 64, tz: 68, med: 72, sc: 68, eu: 26, tradition: 58 }),
    c('fch', '1. FC Heidenheim', 'FCH', 'Heidenheim', 'Voith-Arena', 15000, 1, 55, 48, 40,
      { farbe: '#e30613', farbe2: '#003d7d', akademie: 56, tz: 60, med: 62, sc: 56, eu: 6, tradition: 30 }),

    // --------------------------------------------------- 2. Bundesliga
    c('s04', 'FC Schalke 04', 'S04', 'Gelsenkirchen', 'Veltins-Arena', 62271, 2, 63, 52, 94,
      { farbe: '#004d9d', farbe2: '#ffffff', akademie: 82, tz: 78, med: 70, sc: 64, eu: 10, tradition: 90 }),
    c('bsc', 'Hertha BSC', 'BSC', 'Berlin', 'Olympiastadion', 74667, 2, 61, 50, 74,
      { farbe: '#005ca9', farbe2: '#ffffff', akademie: 76, tz: 74, med: 70, sc: 62, eu: 6, tradition: 76 }),
    c('f95', 'Fortuna Düsseldorf', 'F95', 'Düsseldorf', 'Merkur Spiel-Arena', 54600, 2, 57, 52, 66,
      { farbe: '#d8232a', farbe2: '#ffffff', akademie: 68, tz: 70, med: 66, sc: 60, eu: 2, tradition: 70 }),
    c('boc', 'VfL Bochum', 'BOC', 'Bochum', 'Vonovia Ruhrstadion', 26000, 2, 56, 46, 64,
      { farbe: '#005ba4', farbe2: '#ffffff', akademie: 64, tz: 60, med: 62, sc: 56, eu: 2, tradition: 66 }),
    c('h96', 'Hannover 96', 'H96', 'Hannover', 'Heinz von Heiden Arena', 49000, 2, 56, 50, 70,
      { farbe: '#00963f', farbe2: '#ffffff', akademie: 68, tz: 66, med: 64, sc: 58, eu: 2, tradition: 70 }),
    c('fck', '1. FC Kaiserslautern', 'FCK', 'Kaiserslautern', 'Fritz-Walter-Stadion', 49780, 2, 55, 44, 80,
      { farbe: '#e2001a', farbe2: '#ffffff', akademie: 66, tz: 60, med: 60, sc: 54, eu: 0, tradition: 82 }),
    c('fcn', '1. FC Nürnberg', 'FCN', 'Nürnberg', 'Max-Morlock-Stadion', 50000, 2, 55, 46, 74,
      { farbe: '#8a0e21', farbe2: '#ffffff', akademie: 70, tz: 64, med: 62, sc: 56, eu: 0, tradition: 80 }),
    c('ksc', 'Karlsruher SC', 'KSC', 'Karlsruhe', 'BBBank Wildpark', 34302, 2, 52, 42, 58,
      { farbe: '#0055a4', farbe2: '#ffffff', akademie: 64, tz: 66, med: 58, sc: 52, eu: 0, tradition: 62 }),
    c('kie', 'Holstein Kiel', 'KSV', 'Kiel', 'Holstein-Stadion', 15034, 2, 50, 40, 46,
      { farbe: '#0a3a82', farbe2: '#ffffff', akademie: 58, tz: 56, med: 58, sc: 52, eu: 0, tradition: 40 }),
    c('dsc', 'Arminia Bielefeld', 'DSC', 'Bielefeld', 'Schüco Arena', 27300, 2, 50, 38, 60,
      { farbe: '#00519e', farbe2: '#ffffff', akademie: 60, tz: 56, med: 56, sc: 50, eu: 0, tradition: 62 }),
    c('sgd', 'SG Dynamo Dresden', 'SGD', 'Dresden', 'Rudolf-Harbig-Stadion', 32066, 2, 49, 40, 78,
      { farbe: '#ffe500', farbe2: '#000000', akademie: 58, tz: 54, med: 54, sc: 48, eu: 0, tradition: 68 }),
    c('sv98', 'SV Darmstadt 98', 'D98', 'Darmstadt', 'Merck-Stadion', 17810, 2, 48, 40, 48,
      { farbe: '#004b9e', farbe2: '#ffffff', akademie: 54, tz: 54, med: 56, sc: 48, eu: 0, tradition: 46 }),
    c('fcm', '1. FC Magdeburg', 'FCM', 'Magdeburg', 'Avnet Arena', 30098, 2, 48, 38, 62,
      { farbe: '#0b5da5', farbe2: '#ffffff', akademie: 56, tz: 56, med: 54, sc: 48, eu: 0, tradition: 54 }),
    c('scp', 'SC Paderborn 07', 'SCP', 'Paderborn', 'Home Deluxe Arena', 15000, 2, 47, 36, 40,
      { farbe: '#004b9e', farbe2: '#000000', akademie: 58, tz: 54, med: 54, sc: 50, eu: 0, tradition: 34 }),
    c('sgf', 'SpVgg Greuther Fürth', 'SGF', 'Fürth', 'Sportpark Ronhof', 16626, 2, 46, 36, 42,
      { farbe: '#00963f', farbe2: '#ffffff', akademie: 62, tz: 56, med: 54, sc: 48, eu: 0, tradition: 50 }),
    c('eib', 'Eintracht Braunschweig', 'EBS', 'Braunschweig', 'Eintracht-Stadion', 23325, 2, 45, 34, 54,
      { farbe: '#f9b000', farbe2: '#00543d', akademie: 52, tz: 50, med: 52, sc: 44, eu: 0, tradition: 58 }),
    c('sve', 'SV Elversberg', 'SVE', 'Spiesen-Elversberg', 'Waldstadion Kaiserlinde', 10000, 2, 45, 34, 30,
      { farbe: '#000000', farbe2: '#e30613', akademie: 46, tz: 54, med: 52, sc: 48, eu: 0, tradition: 22 }),
    c('scpm', 'SC Preußen Münster', 'SCPM', 'Münster', 'Preußenstadion', 15050, 2, 44, 32, 50,
      { farbe: '#00723f', farbe2: '#ffffff', akademie: 50, tz: 48, med: 50, sc: 44, eu: 0, tradition: 48 })
  ];

  // Dritte Liga und Amateure: Gegner im DFB-Pokal, Auf- und Absteiger.
  var DRITTE_LIGA = [
    ['svww', 'SV Wehen Wiesbaden', 'SVWW', 'Wiesbaden', 'BRITA-Arena', 12566, 42],
    ['1fcs', '1. FC Saarbrücken', 'FCS', 'Saarbrücken', 'Ludwigsparkstadion', 16003, 41],
    ['rwe', 'Rot-Weiss Essen', 'RWE', 'Essen', 'Stadion an der Hafenstraße', 19500, 40],
    ['fce', 'Energie Cottbus', 'FCE', 'Cottbus', 'Stadion der Freundschaft', 22528, 39],
    ['tsv', 'TSV 1860 München', '1860', 'München', 'Grünwalder Stadion', 15000, 40],
    ['fcha', 'Hansa Rostock', 'HRO', 'Rostock', 'Ostseestadion', 29000, 40],
    ['msv', 'MSV Duisburg', 'MSV', 'Duisburg', 'Schauinsland-Reisen-Arena', 31500, 38],
    ['aac', 'Alemannia Aachen', 'AAC', 'Aachen', 'Tivoli', 32960, 37],
    ['waldhof', 'SV Waldhof Mannheim', 'SVW', 'Mannheim', 'Carl-Benz-Stadion', 25667, 37],
    ['aue', 'Erzgebirge Aue', 'AUE', 'Aue', 'Erzgebirgsstadion', 15711, 38],
    ['vik', 'Viktoria Köln', 'FVK', 'Köln', 'Sportpark Höhenberg', 8000, 35],
    ['osn', 'VfL Osnabrück', 'VFL', 'Osnabrück', 'Bremer Brücke', 15741, 37],
    ['fci', 'FC Ingolstadt 04', 'FCI', 'Ingolstadt', 'Audi-Sportpark', 15800, 37],
    ['ulm', 'SSV Ulm 1846', 'ULM', 'Ulm', 'Donaustadion', 17000, 36],
    ['hfc', 'Hallescher FC', 'HFC', 'Halle', 'Leuna-Chemie-Stadion', 15057, 35],
    ['ssv', 'SSV Jahn Regensburg', 'SSV', 'Regensburg', 'Jahnstadion', 15224, 36],
    ['ver', 'SC Verl', 'SCV', 'Verl', 'Sportclub Arena', 5153, 34],
    ['hav', 'Havelse', 'TSV', 'Garbsen', 'HDI-Arena', 8000, 32],
    ['stu2', 'VfB Stuttgart II', 'VFB2', 'Stuttgart', 'GAZi-Stadion', 11500, 33],
    ['schw', 'Schweinfurt 05', 'SFT', 'Schweinfurt', 'Willy-Sachs-Stadion', 15060, 32],
    ['coe', 'FC Köln II', 'KOE2', 'Köln', 'Franz-Kremer-Stadion', 5000, 32]
  ].map(function (r) {
    return c(r[0], r[1], r[2], r[3], r[4], r[5], 3, r[6], Math.round(r[6] * 0.7),
      Math.round(r[6] * 1.05), { akademie: 40, tz: 42, med: 42, sc: 36 });
  });

  // Regionalliga-/Landespokalvertreter fuer die 1. Pokalrunde.
  var AMATEURE = [
    ['bfc', 'BFC Dynamo', 'BFC', 'Berlin', 'Sportforum Hohenschönhausen', 12000, 27],
    ['fcog', 'FC Oberneuland', 'FCO', 'Bremen', 'Vereinsgelände', 4000, 22],
    ['ecw', 'Eintracht Norderstedt', 'ENS', 'Norderstedt', 'Edmund-Plambeck-Stadion', 5000, 24],
    ['tuse', 'Türkspor Dortmund', 'TSD', 'Dortmund', 'Stadion Rote Erde', 25000, 23],
    ['ilz', 'FC Ilzach', 'ILZ', 'Freiburg', 'Möslestadion', 6000, 24],
    ['sfl', 'Sportfreunde Lotte', 'SFL', 'Lotte', 'Frimo-Stadion', 10059, 26],
    ['ath', 'Atlas Delmenhorst', 'ATL', 'Delmenhorst', 'Stadion an der Düsternortstraße', 5000, 24],
    ['bay', 'Bayernliga-Sieger Buchbach', 'BUC', 'Buchbach', 'Sportpark', 3500, 22],
    ['jed', 'Jeddeloh II', 'JED', 'Edewecht', 'Sportpark', 3000, 21],
    ['ros', 'Rostocker FC', 'ROS', 'Rostock', 'Damerower Weg', 3000, 21],
    ['bab', 'Babelsberg 03', 'SVB', 'Potsdam', 'Karl-Liebknecht-Stadion', 10499, 26],
    ['stt', 'Stuttgarter Kickers', 'SKI', 'Stuttgart', 'GAZi-Stadion', 11500, 28],
    ['kfc', 'KFC Uerdingen', 'KFC', 'Krefeld', 'Grotenburg', 14500, 26],
    ['tur', 'Türkgücü München', 'TGM', 'München', 'Grünwalder Stadion', 15000, 25],
    ['bre', 'Bremer SV', 'BSV', 'Bremen', 'Panzenberg', 5000, 22],
    ['ein', 'Eintracht Trier', 'ETR', 'Trier', 'Moselstadion', 10254, 25],
    ['hom', 'FC 08 Homburg', 'FCH8', 'Homburg', 'Waldstadion', 16350, 27],
    ['ber', 'Berliner AK 07', 'BAK', 'Berlin', 'Poststadion', 10000, 24],
    ['aue2', 'Kickers Emden', 'KEM', 'Emden', 'Ostfrieslandstadion', 7200, 23],
    ['neu', 'FC 1. Neubrandenburg', 'FCN4', 'Neubrandenburg', 'Jahnstadion', 8000, 21],
    ['lue', 'Lüner SV', 'LSV', 'Lünen', 'Schwansbeller Weg', 3000, 20],
    ['gie', 'FC Gießen', 'FCG', 'Gießen', 'Waldstadion', 8000, 22],
    ['gru', 'Grün-Weiß Brauweiler', 'GWB', 'Pulheim', 'Sportanlage', 2500, 20],
    ['pir', 'VfL Pirmasens', 'VFP', 'Pirmasens', 'Sportpark Husterhöhe', 12000, 23],
    ['tas', 'Teutonia Ottensen', 'TEU', 'Hamburg', 'Kreuzkirche', 3000, 23],
    ['hei', 'Heider SV', 'HSV2', 'Heide', 'Am Holzkamp', 3000, 20],
    ['sch', 'FSV Schöningen', 'FSV', 'Schöningen', 'Sportpark', 2500, 20],
    ['kah', 'FC Kahl', 'FCKA', 'Kahl', 'Sportgelände', 2000, 19]
  ].map(function (r) {
    return c(r[0], r[1], r[2], r[3], r[4], r[5], 4, r[6], Math.round(r[6] * 0.6),
      Math.round(r[6]), { akademie: 25, tz: 25, med: 28, sc: 20 });
  });

  // Europaeische Gegner. Der Wert steht fuer Ruf/Staerke.
  var EUROPA = [
    ['Real Madrid', 'Spanien', 97], ['Manchester City', 'England', 96],
    ['FC Barcelona', 'Spanien', 94], ['FC Liverpool', 'England', 93],
    ['Paris Saint-Germain', 'Frankreich', 93], ['FC Arsenal', 'England', 92],
    ['Inter Mailand', 'Italien', 90], ['Atlético Madrid', 'Spanien', 89],
    ['FC Chelsea', 'England', 88], ['Juventus Turin', 'Italien', 86],
    ['SSC Neapel', 'Italien', 86], ['AC Mailand', 'Italien', 85],
    ['Tottenham Hotspur', 'England', 84], ['Aston Villa', 'England', 83],
    ['Newcastle United', 'England', 83], ['Manchester United', 'England', 84],
    ['Atalanta Bergamo', 'Italien', 82], ['AS Rom', 'Italien', 81],
    ['Benfica Lissabon', 'Portugal', 82], ['FC Porto', 'Portugal', 81],
    ['Sporting Lissabon', 'Portugal', 82], ['Ajax Amsterdam', 'Niederlande', 79],
    ['PSV Eindhoven', 'Niederlande', 80], ['Feyenoord Rotterdam', 'Niederlande', 77],
    ['Olympique Marseille', 'Frankreich', 79], ['AS Monaco', 'Frankreich', 78],
    ['OSC Lille', 'Frankreich', 76], ['Olympique Lyon', 'Frankreich', 76],
    ['Athletic Bilbao', 'Spanien', 79], ['Real Sociedad', 'Spanien', 77],
    ['FC Villarreal', 'Spanien', 78], ['Betis Sevilla', 'Spanien', 76],
    ['Celtic Glasgow', 'Schottland', 72], ['Glasgow Rangers', 'Schottland', 70],
    ['Galatasaray Istanbul', 'Türkei', 76], ['Fenerbahce Istanbul', 'Türkei', 75],
    ['Besiktas Istanbul', 'Türkei', 70], ['Club Brügge', 'Belgien', 73],
    ['RSC Anderlecht', 'Belgien', 68], ['Royale Union SG', 'Belgien', 70],
    ['RB Salzburg', 'Österreich', 72], ['Sturm Graz', 'Österreich', 66],
    ['Slavia Prag', 'Tschechien', 70], ['Sparta Prag', 'Tschechien', 69],
    ['Dinamo Zagreb', 'Kroatien', 69], ['Roter Stern Belgrad', 'Serbien', 70],
    ['Schachtar Donezk', 'Ukraine', 71], ['Young Boys Bern', 'Schweiz', 66],
    ['Olympiakos Piräus', 'Griechenland', 71], ['Panathinaikos', 'Griechenland', 67],
    ['FC Kopenhagen', 'Dänemark', 68], ['FC Midtjylland', 'Dänemark', 66],
    ['Bodø/Glimt', 'Norwegen', 67], ['Malmö FF', 'Schweden', 63],
    ['Legia Warschau', 'Polen', 63], ['Ferencvaros Budapest', 'Ungarn', 64],
    ['SC Braga', 'Portugal', 72], ['Girona FC', 'Spanien', 74],
    ['Bologna FC', 'Italien', 75], ['AC Florenz', 'Italien', 76],
    ['Stade Rennes', 'Frankreich', 72], ['OGC Nizza', 'Frankreich', 72],
    ['Brighton & Hove', 'England', 79], ['AZ Alkmaar', 'Niederlande', 70],
    ['FC Twente', 'Niederlande', 66], ['Slovan Bratislava', 'Slowakei', 58],
    ['Sheriff Tiraspol', 'Moldau', 52], ['Qarabag Agdam', 'Aserbaidschan', 60],
    ['Ludogorez Rasgrad', 'Bulgarien', 59], ['Maccabi Tel Aviv', 'Israel', 62]
  ].map(function (r) {
    return { name: r[0], land: r[1], ruf: r[2] };
  });

  // ------------------------------------------------------------ Namen

  var NAMEN = {
    Deutschland: {
      w: 34,
      vor: ['Leon', 'Finn', 'Paul', 'Jonas', 'Luca', 'Ben', 'Noah', 'Elias', 'Max', 'Felix',
        'Tim', 'Niklas', 'Lukas', 'Julian', 'Marvin', 'Nico', 'Jan', 'Moritz', 'Philipp', 'Tom',
        'David', 'Simon', 'Erik', 'Marc', 'Kevin', 'Dennis', 'Fabian', 'Florian', 'Sebastian',
        'Christian', 'Daniel', 'Marcel', 'Robin', 'Justin', 'Maximilian', 'Jannik', 'Lennart',
        'Mats', 'Til', 'Hendrik', 'Bastian', 'Kai', 'Sven', 'Torben', 'Malte', 'Jonathan',
        'Emil', 'Anton', 'Oskar', 'Linus', 'Levin', 'Silas', 'Joshua', 'Nils'],
      nach: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
        'Schulz', 'Hoffmann', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder',
        'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange',
        'Schmitt', 'Werner', 'Krause', 'Meier', 'Lehmann', 'Schmid', 'Schulze', 'Maier',
        'Köhler', 'Herrmann', 'König', 'Walter', 'Mayer', 'Huber', 'Kaiser', 'Fuchs',
        'Peters', 'Lang', 'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Schubert', 'Vogel',
        'Friedrich', 'Keller', 'Günther', 'Frank', 'Berger', 'Winkler', 'Roth', 'Beck',
        'Lorenz', 'Baumann', 'Franke', 'Albrecht', 'Schuster', 'Simon', 'Ludwig', 'Böhm',
        'Winter', 'Kraus', 'Martin', 'Schumacher', 'Krämer', 'Vogt', 'Stein', 'Jäger',
        'Otto', 'Sommer', 'Groß', 'Seidel', 'Heinrich', 'Brandt', 'Haas', 'Schreiber',
        'Graf', 'Dietrich', 'Ziegler', 'Kuhn', 'Kühn', 'Pohl', 'Engel', 'Horn', 'Busch',
        'Bergmann', 'Thomas', 'Voigt', 'Sauer', 'Arnold', 'Wolff', 'Pfeiffer', 'Reuter']
    },
    Österreich: { w: 4, vor: ['Marko', 'Stefan', 'Michael', 'Christoph', 'Andreas', 'Konrad', 'Valentino', 'Xaver', 'Sasa', 'Thomas'], nach: ['Gruber', 'Huber', 'Wagner', 'Pichler', 'Steiner', 'Moser', 'Mayr', 'Hofer', 'Leitner', 'Berger', 'Fuchs', 'Eder', 'Fischer', 'Schwarz', 'Winkler', 'Baumgartner'] },
    Schweiz: { w: 3, vor: ['Yann', 'Remo', 'Fabian', 'Silvan', 'Noah', 'Dan', 'Ruben', 'Cédric', 'Loris'], nach: ['Zuber', 'Frei', 'Rieder', 'Widmer', 'Sow', 'Aebischer', 'Vargas', 'Amdouni', 'Steffen', 'Schär', 'Elvedi', 'Kobel'] },
    Niederlande: { w: 5, vor: ['Daan', 'Sem', 'Lucas', 'Milan', 'Jesse', 'Bram', 'Thijs', 'Jurriën', 'Cody', 'Ryan', 'Teun', 'Wout', 'Xavi', 'Quinten'], nach: ['de Jong', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'van Leeuwen', 'Timber', 'Gakpo', 'Frimpong', 'Weghorst', 'Koopmeiners', 'Simons', 'van Hooijdonk'] },
    Frankreich: { w: 6, vor: ['Lucas', 'Hugo', 'Théo', 'Enzo', 'Nathan', 'Mathis', 'Rayan', 'Kylian', 'Jules', 'Ousmane', 'Randal', 'Warren', 'Bradley', 'Loïc'], nach: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Michel', 'Garcia', 'Fofana', 'Diarra', 'Coman', 'Guendouzi', 'Kolo Muani'] },
    Spanien: { w: 4, vor: ['Álvaro', 'Sergio', 'Pablo', 'Javier', 'Marco', 'Iker', 'Hugo', 'Dani', 'Nico', 'Fermín', 'Gavi', 'Pau'], nach: ['García', 'Rodríguez', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Moreno', 'Torres', 'Navas', 'Olmo', 'Cubarsí', 'Merino'] },
    Portugal: { w: 3, vor: ['João', 'Rafael', 'Diogo', 'Bruno', 'Gonçalo', 'Tomás', 'Vitinha', 'Rúben', 'Nuno'], nach: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Neves', 'Leão', 'Dias', 'Mendes'] },
    Italien: { w: 3, vor: ['Lorenzo', 'Matteo', 'Alessandro', 'Riccardo', 'Nicolò', 'Giacomo', 'Federico', 'Davide'], nach: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Barella', 'Frattesi'] },
    Kroatien: { w: 3, vor: ['Luka', 'Ivan', 'Marko', 'Josip', 'Mateo', 'Ante', 'Borna', 'Dominik'], nach: ['Horvat', 'Kovacevic', 'Babic', 'Maric', 'Novak', 'Juric', 'Vlasic', 'Sosa', 'Sucic', 'Petkovic'] },
    Serbien: { w: 3, vor: ['Nemanja', 'Aleksandar', 'Dusan', 'Filip', 'Luka', 'Strahinja', 'Veljko'], nach: ['Jovic', 'Milinkovic', 'Pavlovic', 'Ilic', 'Mitrovic', 'Kostic', 'Gudelj', 'Vlahovic', 'Samardzic'] },
    Polen: { w: 3, vor: ['Jakub', 'Piotr', 'Bartosz', 'Sebastian', 'Nicola', 'Michal', 'Kacper'], nach: ['Nowak', 'Kowalski', 'Wisniewski', 'Zielinski', 'Szymanski', 'Kaminski', 'Bednarek', 'Frankowski', 'Piatek'] },
    Tschechien: { w: 2, vor: ['Tomás', 'Patrik', 'Ondrej', 'Vaclav', 'Adam', 'David'], nach: ['Novak', 'Svoboda', 'Dvorak', 'Cerny', 'Prochazka', 'Soucek', 'Hranac', 'Chory'] },
    Dänemark: { w: 3, vor: ['Mikkel', 'Rasmus', 'Anders', 'Jonas', 'Victor', 'Gustav', 'Morten'], nach: ['Jensen', 'Nielsen', 'Hansen', 'Andersen', 'Pedersen', 'Larsen', 'Kristensen', 'Skov', 'Damsgaard'] },
    Schweden: { w: 2, vor: ['Emil', 'Viktor', 'Anton', 'Gustav', 'Alexander', 'Isak'], nach: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Svensson', 'Gyökeres', 'Elanga'] },
    Norwegen: { w: 2, vor: ['Erling', 'Martin', 'Sander', 'Kristian', 'Ola', 'Antonio'], nach: ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Berg', 'Nusa', 'Sorloth'] },
    England: { w: 3, vor: ['Harry', 'Jack', 'Callum', 'Ryan', 'Jude', 'Cole', 'Reece', 'Levi', 'Archie'], nach: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Hall', 'Wright'] },
    Türkei: { w: 3, vor: ['Kerem', 'Ferdi', 'Arda', 'Can', 'Emre', 'Yusuf', 'Berkan', 'Salih'], nach: ['Yildiz', 'Demir', 'Kaya', 'Sahin', 'Yilmaz', 'Celik', 'Aydin', 'Öztürk', 'Kökcü', 'Aktürkoglu'] },
    Japan: { w: 4, vor: ['Takumi', 'Daichi', 'Ritsu', 'Wataru', 'Kaoru', 'Ao', 'Hiroki', 'Junya'], nach: ['Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Endo', 'Mitoma'] },
    Südkorea: { w: 2, vor: ['Min-jae', 'Heung-min', 'Woo-yeong', 'Jae-sung', 'Kang-in', 'Hyun-woo'], nach: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon'] },
    USA: { w: 3, vor: ['Christian', 'Tyler', 'Brenden', 'Gio', 'Malik', 'Josh', 'Ricardo'], nach: ['Miller', 'Johnson', 'Williams', 'Davis', 'Anderson', 'Moore', 'Adams', 'Pepi', 'Reyna'] },
    Brasilien: { w: 5, vor: ['Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Vinícius', 'Éder', 'Bruno', 'Carlos', 'Pedro', 'Andreas'], nach: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Almeida', 'Pereira', 'Barbosa', 'Ribeiro', 'Nascimento', 'Moraes'] },
    Argentinien: { w: 3, vor: ['Julián', 'Nicolás', 'Facundo', 'Santiago', 'Enzo', 'Valentín', 'Exequiel'], nach: ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Romero', 'Álvarez', 'Sosa'] },
    Nigeria: { w: 2, vor: ['Victor', 'Samuel', 'Chukwu', 'Emmanuel', 'Ademola', 'Kelechi'], nach: ['Okafor', 'Eze', 'Adeyemi', 'Obi', 'Nwankwo', 'Osimhen', 'Chukwueze', 'Bassey'] },
    Ghana: { w: 2, vor: ['Kwame', 'Kofi', 'Daniel', 'Mohammed', 'Ernest', 'Thomas'], nach: ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Amoah', 'Kudus', 'Semenyo'] },
    Senegal: { w: 2, vor: ['Ismaila', 'Pape', 'Abdoulaye', 'Moussa', 'Cheikh', 'Habib'], nach: ['Diallo', 'Ndiaye', 'Sarr', 'Diop', 'Gueye', 'Ciss', 'Mendy', 'Jakobs'] },
    Kamerun: { w: 2, vor: ['Karl', 'Bryan', 'Vincent', 'André', 'Christopher'], nach: ['Etta Eyong', 'Mbeumo', 'Aboubakar', 'Onana', 'Ngamaleu', 'Tolo'] },
    Marokko: { w: 2, vor: ['Amine', 'Youssef', 'Bilal', 'Ismael', 'Anass', 'Yassine'], nach: ['El Amrani', 'Ben Ali', 'Ziyech', 'Amrabat', 'Hakimi', 'Ounahi', 'Saibari'] },
    Elfenbeinküste: { w: 2, vor: ['Sébastien', 'Ibrahim', 'Franck', 'Odilon', 'Amad'], nach: ['Kouassi', 'Traoré', 'Koné', 'Diomandé', 'Bamba', 'Sangaré'] },
    Algerien: { w: 1, vor: ['Riyad', 'Ismael', 'Ramy', 'Adam'], nach: ['Bennacer', 'Boudaoui', 'Zerrouki', 'Amoura', 'Mandi'] },
    Belgien: { w: 2, vor: ['Jérémy', 'Loïs', 'Charles', 'Arthur', 'Maxim'], nach: ['Doku', 'Openda', 'De Ketelaere', 'Vermeeren', 'Theate', 'Castagne'] },
    Ukraine: { w: 1, vor: ['Artem', 'Mykhailo', 'Oleksandr', 'Georgiy'], nach: ['Dovbyk', 'Mudryk', 'Zinchenko', 'Sudakov', 'Tsygankov'] },
    Griechenland: { w: 1, vor: ['Konstantinos', 'Giorgos', 'Christos'], nach: ['Mavropanos', 'Tzolis', 'Giakoumakis', 'Bakasetas'] },
    Slowenien: { w: 1, vor: ['Jan', 'Benjamin', 'Adam'], nach: ['Oblak', 'Sesko', 'Gnezda', 'Janza'] },
    Ungarn: { w: 1, vor: ['Dominik', 'Willi', 'Milos', 'Roland'], nach: ['Szoboszlai', 'Orban', 'Kerkez', 'Sallai', 'Varga'] }
  };

  // ------------------------------------------------------------ Persönlichkeit

  var PERSOENLICHKEITEN = [
    { id: 'profi', name: 'Vorbildlicher Profi', trainingBonus: 1.20, moralStabil: 1.3, gehaltsgier: 0.85, loyalitaet: 1.2 },
    { id: 'ehrgeizig', name: 'Ehrgeizig', trainingBonus: 1.12, moralStabil: 0.9, gehaltsgier: 1.15, loyalitaet: 0.75 },
    { id: 'entschlossen', name: 'Entschlossen', trainingBonus: 1.14, moralStabil: 1.15, gehaltsgier: 1.0, loyalitaet: 1.0 },
    { id: 'loyal', name: 'Loyal', trainingBonus: 1.0, moralStabil: 1.2, gehaltsgier: 0.9, loyalitaet: 1.5 },
    { id: 'ausgeglichen', name: 'Ausgeglichen', trainingBonus: 1.0, moralStabil: 1.0, gehaltsgier: 1.0, loyalitaet: 1.0 },
    { id: 'temperament', name: 'Temperamentvoll', trainingBonus: 0.95, moralStabil: 0.7, gehaltsgier: 1.1, loyalitaet: 0.85 },
    { id: 'launisch', name: 'Launisch', trainingBonus: 0.88, moralStabil: 0.6, gehaltsgier: 1.05, loyalitaet: 0.8 },
    { id: 'geldgierig', name: 'Geldorientiert', trainingBonus: 0.95, moralStabil: 0.85, gehaltsgier: 1.45, loyalitaet: 0.6 },
    { id: 'fuehrer', name: 'Geborener Anführer', trainingBonus: 1.10, moralStabil: 1.35, gehaltsgier: 1.05, loyalitaet: 1.15 },
    { id: 'unbekuemmert', name: 'Unbekümmert', trainingBonus: 0.92, moralStabil: 1.1, gehaltsgier: 0.95, loyalitaet: 1.0 },
    { id: 'nervoes', name: 'Nervös', trainingBonus: 0.98, moralStabil: 0.65, gehaltsgier: 0.95, loyalitaet: 1.05 },
    { id: 'skrupellos', name: 'Skrupellos', trainingBonus: 1.05, moralStabil: 0.9, gehaltsgier: 1.25, loyalitaet: 0.5 }
  ];

  // ------------------------------------------------------------ Formationen

  // x: 0 (links) .. 100 (rechts), y: 0 (eigenes Tor) .. 100 (gegnerisches Tor)
  function slot(pos, x, y) { return { pos: pos, x: x, y: y }; }

  var FORMATIONEN = {
    '4-4-2': {
      name: '4-4-2', beschreibung: 'Klassisch, zwei kompakte Viererketten, Spitzen im Doppel.',
      breite: 1.0, kompaktheit: 1.05, konter: 1.05, ballbesitz: 0.95,
      slots: [slot('TW', 50, 4), slot('LV', 15, 25), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 85, 25),
        slot('LM', 14, 52), slot('ZM', 38, 48), slot('ZM', 62, 48), slot('RM', 86, 52),
        slot('ST', 40, 82), slot('ST', 60, 82)]
    },
    '4-4-2 Raute': {
      name: '4-4-2 Raute', beschreibung: 'Zentrumslastig mit Zehner, Aussenbahnen von den AV besetzt.',
      breite: 0.82, kompaktheit: 1.12, konter: 1.0, ballbesitz: 1.08,
      slots: [slot('TW', 50, 4), slot('LV', 12, 27), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 88, 27),
        slot('DM', 50, 40), slot('ZM', 28, 54), slot('ZM', 72, 54), slot('OM', 50, 68),
        slot('ST', 40, 84), slot('ST', 60, 84)]
    },
    '4-2-3-1': {
      name: '4-2-3-1', beschreibung: 'Der Standard: Doppelsechs als Absicherung, Dreierreihe hinter der Spitze.',
      breite: 1.0, kompaktheit: 1.08, konter: 1.05, ballbesitz: 1.05,
      slots: [slot('TW', 50, 4), slot('LV', 13, 26), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 87, 26),
        slot('DM', 40, 42), slot('DM', 60, 42),
        slot('LF', 15, 66), slot('OM', 50, 66), slot('RF', 85, 66), slot('ST', 50, 86)]
    },
    '4-3-3': {
      name: '4-3-3', beschreibung: 'Breites Angriffstrio, Dreiermittelfeld mit klaren Rollen.',
      breite: 1.12, kompaktheit: 0.98, konter: 1.0, ballbesitz: 1.10,
      slots: [slot('TW', 50, 4), slot('LV', 12, 28), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 88, 28),
        slot('DM', 50, 40), slot('ZM', 32, 54), slot('ZM', 68, 54),
        slot('LF', 14, 78), slot('ST', 50, 86), slot('RF', 86, 78)]
    },
    '4-1-4-1': {
      name: '4-1-4-1', beschreibung: 'Defensiv stabil, ein Sechser sichert, vier Spieler dahinter im Block.',
      breite: 1.02, kompaktheit: 1.16, konter: 1.12, ballbesitz: 0.95,
      slots: [slot('TW', 50, 4), slot('LV', 13, 24), slot('IV', 38, 18), slot('IV', 62, 18), slot('RV', 87, 24),
        slot('DM', 50, 38),
        slot('LM', 14, 58), slot('ZM', 38, 55), slot('ZM', 62, 55), slot('RM', 86, 58), slot('ST', 50, 84)]
    },
    '4-3-2-1': {
      name: '4-3-2-1', beschreibung: 'Tannenbaum: enges Zentrum, zwei Haengende Spitzen.',
      breite: 0.78, kompaktheit: 1.15, konter: 0.95, ballbesitz: 1.10,
      slots: [slot('TW', 50, 4), slot('LV', 12, 27), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 88, 27),
        slot('DM', 50, 42), slot('ZM', 32, 52), slot('ZM', 68, 52),
        slot('OM', 38, 70), slot('OM', 62, 70), slot('ST', 50, 86)]
    },
    '3-5-2': {
      name: '3-5-2', beschreibung: 'Dreierkette, Fluegel schieben hoch, Ueberzahl im Zentrum.',
      breite: 1.05, kompaktheit: 1.02, konter: 1.08, ballbesitz: 1.05,
      slots: [slot('TW', 50, 4), slot('IV', 26, 20), slot('IV', 50, 17), slot('IV', 74, 20),
        slot('LM', 10, 52), slot('DM', 50, 42), slot('ZM', 34, 54), slot('ZM', 66, 54), slot('RM', 90, 52),
        slot('ST', 40, 84), slot('ST', 60, 84)]
    },
    '3-4-3': {
      name: '3-4-3', beschreibung: 'Mutig, hohe Fluegelspieler, verlangt laufstarke Aussenbahnen.',
      breite: 1.15, kompaktheit: 0.92, konter: 1.02, ballbesitz: 1.08,
      slots: [slot('TW', 50, 4), slot('IV', 26, 20), slot('IV', 50, 17), slot('IV', 74, 20),
        slot('LM', 10, 54), slot('ZM', 38, 48), slot('ZM', 62, 48), slot('RM', 90, 54),
        slot('LF', 20, 80), slot('ST', 50, 86), slot('RF', 80, 80)]
    },
    '5-3-2': {
      name: '5-3-2', beschreibung: 'Tiefer Fuenferblock, auf Konter und Standards ausgerichtet.',
      breite: 1.0, kompaktheit: 1.22, konter: 1.20, ballbesitz: 0.84,
      slots: [slot('TW', 50, 4), slot('LV', 10, 24), slot('IV', 28, 16), slot('IV', 50, 14), slot('IV', 72, 16), slot('RV', 90, 24),
        slot('DM', 50, 40), slot('ZM', 34, 50), slot('ZM', 66, 50),
        slot('ST', 40, 80), slot('ST', 60, 80)]
    },
    '5-2-3': {
      name: '5-2-3', beschreibung: 'Fuenferkette mit Angriffstrio - tief stehen, schnell umschalten.',
      breite: 1.08, kompaktheit: 1.15, konter: 1.25, ballbesitz: 0.86,
      slots: [slot('TW', 50, 4), slot('LV', 10, 26), slot('IV', 28, 16), slot('IV', 50, 14), slot('IV', 72, 16), slot('RV', 90, 26),
        slot('ZM', 38, 46), slot('ZM', 62, 46),
        slot('LF', 18, 76), slot('ST', 50, 84), slot('RF', 82, 76)]
    },
    '4-2-2-2': {
      name: '4-2-2-2', beschreibung: 'Zwei Halbraumspieler hinter zwei Spitzen, hohes Gegenpressing.',
      breite: 0.88, kompaktheit: 1.10, konter: 1.10, ballbesitz: 1.02,
      slots: [slot('TW', 50, 4), slot('LV', 13, 26), slot('IV', 38, 20), slot('IV', 62, 20), slot('RV', 87, 26),
        slot('DM', 40, 42), slot('DM', 60, 42),
        slot('OM', 28, 66), slot('OM', 72, 66), slot('ST', 40, 85), slot('ST', 60, 85)]
    },
    '3-4-1-2': {
      name: '3-4-1-2', beschreibung: 'Dreierkette mit Zehner - viel Zentrum, wenig Breite.',
      breite: 0.85, kompaktheit: 1.10, konter: 1.06, ballbesitz: 1.06,
      slots: [slot('TW', 50, 4), slot('IV', 26, 20), slot('IV', 50, 17), slot('IV', 74, 20),
        slot('LM', 12, 52), slot('ZM', 38, 46), slot('ZM', 62, 46), slot('RM', 88, 52),
        slot('OM', 50, 68), slot('ST', 40, 85), slot('ST', 60, 85)]
    }
  };

  // ------------------------------------------------------------ Rollen

  // Rollen veraendern die Gewichtung eines Spielers in den Mannschaftsteilen.
  // def/mid/att = Beitrag zu Abwehr/Mittelfeld/Angriff, kreativ/laufweg als Extra.
  var ROLLEN = {
    TW: [
      { id: 'tw_klassisch', name: 'Klassischer Torhüter', def: 1.00, mid: 0.00, att: 0.00, attrs: ['reflexe', 'handling'] },
      { id: 'tw_mitspielend', name: 'Mitspielender Torhüter', def: 0.94, mid: 0.12, att: 0.00, attrs: ['passen', 'entscheidung'], aufbau: 1.15 },
      { id: 'tw_linie', name: 'Linienkeeper', def: 1.03, mid: 0.00, att: 0.00, attrs: ['reflexe'], hoheLinie: -0.10 }
    ],
    IV: [
      { id: 'iv_klassisch', name: 'Innenverteidiger', def: 1.00, mid: 0.10, att: 0.03, attrs: ['zweikampf', 'positionierung'] },
      { id: 'iv_aufbau', name: 'Aufbauverteidiger', def: 0.92, mid: 0.28, att: 0.05, attrs: ['passen', 'uebersicht'], aufbau: 1.20 },
      { id: 'iv_libero', name: 'Libero', def: 0.95, mid: 0.24, att: 0.06, attrs: ['antizipation', 'technik'], aufbau: 1.12 },
      { id: 'iv_zerstoerer', name: 'Abräumer', def: 1.10, mid: 0.04, att: 0.02, attrs: ['zweikampf', 'aggressivitaet'], karten: 1.25 },
      { id: 'iv_vorstoss', name: 'Vorstoßender IV', def: 0.86, mid: 0.22, att: 0.16, attrs: ['tempo', 'dribbling'] }
    ],
    LV: [
      { id: 'av_klassisch', name: 'Außenverteidiger', def: 0.90, mid: 0.22, att: 0.10, attrs: ['zweikampf', 'positionierung'] },
      { id: 'av_offensiv', name: 'Offensiver Außenverteidiger', def: 0.70, mid: 0.28, att: 0.34, attrs: ['flanken', 'ausdauer'], breite: 1.15 },
      { id: 'av_fluegel', name: 'Flügelverteidiger', def: 0.62, mid: 0.30, att: 0.44, attrs: ['tempo', 'ausdauer'], breite: 1.25 },
      { id: 'av_invers', name: 'Invertierter AV', def: 0.78, mid: 0.42, att: 0.12, attrs: ['passen', 'uebersicht'], breite: 0.75 },
      { id: 'av_defensiv', name: 'Defensiver Außenverteidiger', def: 1.02, mid: 0.12, att: 0.02, attrs: ['zweikampf', 'antizipation'] }
    ],
    DM: [
      { id: 'dm_abraeumer', name: 'Abräumer', def: 0.62, mid: 0.78, att: 0.04, attrs: ['zweikampf', 'antizipation'], karten: 1.2 },
      { id: 'dm_regista', name: 'Regista', def: 0.32, mid: 1.00, att: 0.18, attrs: ['passen', 'uebersicht'], aufbau: 1.30 },
      { id: 'dm_b2b', name: 'Box-to-Box', def: 0.44, mid: 0.88, att: 0.26, attrs: ['ausdauer', 'arbeitsrate'] },
      { id: 'dm_anker', name: 'Anker', def: 0.78, mid: 0.62, att: 0.00, attrs: ['positionierung', 'disziplin'] }
    ],
    ZM: [
      { id: 'zm_allrounder', name: 'Allrounder', def: 0.32, mid: 0.90, att: 0.24, attrs: ['passen', 'ausdauer'] },
      { id: 'zm_achter', name: 'Achter', def: 0.22, mid: 0.86, att: 0.40, attrs: ['arbeitsrate', 'abschluss'] },
      { id: 'zm_spielmacher', name: 'Spielmacher (tief)', def: 0.18, mid: 1.00, att: 0.32, attrs: ['uebersicht', 'technik'], aufbau: 1.25 },
      { id: 'zm_arbeiter', name: 'Arbeiter', def: 0.48, mid: 0.80, att: 0.10, attrs: ['arbeitsrate', 'zweikampf'] }
    ],
    OM: [
      { id: 'om_spielmacher', name: 'Spielmacher', def: 0.06, mid: 0.62, att: 0.72, attrs: ['uebersicht', 'passen'], kreativ: 1.30 },
      { id: 'om_schatten', name: 'Schattenstürmer', def: 0.04, mid: 0.42, att: 0.94, attrs: ['abschluss', 'antritt'] },
      { id: 'om_freigeist', name: 'Freigeist', def: 0.02, mid: 0.52, att: 0.86, attrs: ['dribbling', 'technik'], kreativ: 1.35, disziplinMalus: 1.2 }
    ],
    LM: [
      { id: 'am_klassisch', name: 'Außenbahnspieler', def: 0.36, mid: 0.66, att: 0.42, attrs: ['flanken', 'ausdauer'], breite: 1.15 },
      { id: 'am_defensiv', name: 'Defensiver Außen', def: 0.56, mid: 0.60, att: 0.20, attrs: ['arbeitsrate', 'zweikampf'] },
      { id: 'am_offensiv', name: 'Offensiver Außen', def: 0.16, mid: 0.54, att: 0.72, attrs: ['dribbling', 'flanken'], breite: 1.20 }
    ],
    LF: [
      { id: 'fl_fluegel', name: 'Flügelstürmer', def: 0.08, mid: 0.32, att: 0.94, attrs: ['tempo', 'dribbling'], breite: 1.25 },
      { id: 'fl_invers', name: 'Invertierter Flügel', def: 0.06, mid: 0.34, att: 1.00, attrs: ['abschluss', 'technik'], breite: 0.80 },
      { id: 'fl_vorbereiter', name: 'Vorbereiter', def: 0.10, mid: 0.44, att: 0.82, attrs: ['flanken', 'uebersicht'], kreativ: 1.20 },
      { id: 'fl_arbeitstier', name: 'Arbeitendes Flügelspiel', def: 0.28, mid: 0.44, att: 0.70, attrs: ['arbeitsrate', 'ausdauer'], pressing: 1.20 }
    ],
    ST: [
      { id: 'st_mittel', name: 'Mittelstürmer', def: 0.02, mid: 0.14, att: 1.00, attrs: ['abschluss', 'positionierung'] },
      { id: 'st_ziel', name: 'Zielspieler', def: 0.04, mid: 0.18, att: 0.94, attrs: ['kopfball', 'kraft'], kopfball: 1.35 },
      { id: 'st_wand', name: 'Wandspieler', def: 0.03, mid: 0.34, att: 0.84, attrs: ['technik', 'passen'], kreativ: 1.12 },
      { id: 'st_falsche9', name: 'Falsche Neun', def: 0.03, mid: 0.48, att: 0.76, attrs: ['uebersicht', 'technik'], kreativ: 1.25 },
      { id: 'st_tiefe', name: 'Tiefenläufer', def: 0.02, mid: 0.12, att: 1.02, attrs: ['tempo', 'antritt'], konter: 1.25 },
      { id: 'st_presser', name: 'Pressingspitze', def: 0.10, mid: 0.24, att: 0.88, attrs: ['arbeitsrate', 'aggressivitaet'], pressing: 1.30 }
    ]
  };
  ROLLEN.RV = ROLLEN.LV;
  ROLLEN.RM = ROLLEN.LM;
  ROLLEN.RF = ROLLEN.LF;

  // ------------------------------------------------------------ Anweisungen

  var ANWEISUNGEN = {
    mentalitaet: {
      label: 'Mentalität',
      werte: [
        { id: 'defensiv', name: 'Sehr defensiv', att: 0.80, def: 1.16, tempo: 0.85 },
        { id: 'abwartend', name: 'Abwartend', att: 0.90, def: 1.08, tempo: 0.93 },
        { id: 'ausgeglichen', name: 'Ausgeglichen', att: 1.00, def: 1.00, tempo: 1.00 },
        { id: 'offensiv', name: 'Offensiv', att: 1.11, def: 0.92, tempo: 1.07 },
        { id: 'allesoderNichts', name: 'Alles nach vorn', att: 1.22, def: 0.80, tempo: 1.14 }
      ]
    },
    pressing: {
      label: 'Pressinghöhe',
      werte: [
        { id: 'tief', name: 'Tiefer Block', ballgewinnHoch: 0.62, kondition: 0.88, konterAnfaellig: 0.80 },
        { id: 'mittel', name: 'Mittelfeldpressing', ballgewinnHoch: 1.00, kondition: 1.00, konterAnfaellig: 1.00 },
        { id: 'hoch', name: 'Hohes Pressing', ballgewinnHoch: 1.38, kondition: 1.18, konterAnfaellig: 1.30 },
        { id: 'extrem', name: 'Angriffspressing', ballgewinnHoch: 1.62, kondition: 1.34, konterAnfaellig: 1.55 }
      ]
    },
    abwehrlinie: {
      label: 'Abwehrlinie',
      werte: [
        { id: 'tief', name: 'Tief', raumHinten: 0.70, abseits: 0.70, kopfballDruck: 1.10 },
        { id: 'normal', name: 'Normal', raumHinten: 1.00, abseits: 1.00, kopfballDruck: 1.00 },
        { id: 'hoch', name: 'Hoch', raumHinten: 1.32, abseits: 1.35, kopfballDruck: 0.94 }
      ]
    },
    aufbau: {
      label: 'Spielaufbau',
      werte: [
        { id: 'kurz', name: 'Kurzes Aufbauspiel', ballbesitz: 1.16, risiko: 1.10, chancenQualitaet: 1.05 },
        { id: 'gemischt', name: 'Gemischt', ballbesitz: 1.00, risiko: 1.00, chancenQualitaet: 1.00 },
        { id: 'lang', name: 'Lange Bälle', ballbesitz: 0.82, risiko: 0.85, chancenQualitaet: 0.92, kopfball: 1.20 }
      ]
    },
    tempo: {
      label: 'Spieltempo',
      werte: [
        { id: 'langsam', name: 'Ruhig zirkulieren', chancen: 0.88, ballbesitz: 1.12, kondition: 0.92 },
        { id: 'normal', name: 'Normal', chancen: 1.00, ballbesitz: 1.00, kondition: 1.00 },
        { id: 'schnell', name: 'Schnell nach vorn', chancen: 1.14, ballbesitz: 0.90, kondition: 1.10 }
      ]
    },
    breite: {
      label: 'Spielfeldbreite',
      werte: [
        { id: 'eng', name: 'Eng', zentrum: 1.20, flanken: 0.75 },
        { id: 'normal', name: 'Normal', zentrum: 1.00, flanken: 1.00 },
        { id: 'breit', name: 'Breit', zentrum: 0.82, flanken: 1.28 }
      ]
    },
    gegenpressing: {
      label: 'Gegenpressing',
      werte: [
        { id: 'aus', name: 'Zurückziehen', rueckgewinn: 0.70, kondition: 0.92 },
        { id: 'normal', name: 'Situativ', rueckgewinn: 1.00, kondition: 1.00 },
        { id: 'sofort', name: 'Sofort nachsetzen', rueckgewinn: 1.40, kondition: 1.16, konterAnfaellig: 1.20 }
      ]
    },
    zweikampf: {
      label: 'Zweikampfführung',
      werte: [
        { id: 'fair', name: 'Zurückhaltend', zweikampf: 0.88, karten: 0.70, foul: 0.75 },
        { id: 'normal', name: 'Normal', zweikampf: 1.00, karten: 1.00, foul: 1.00 },
        { id: 'hart', name: 'Hart', zweikampf: 1.14, karten: 1.55, foul: 1.45 }
      ]
    },
    zeitspiel: {
      label: 'Zeitmanagement',
      werte: [
        { id: 'aus', name: 'Kein Zeitspiel', tempoSpaet: 1.00, karten: 1.00 },
        { id: 'ein', name: 'Zeit von der Uhr nehmen', tempoSpaet: 0.78, karten: 1.15, ballbesitz: 1.05 }
      ]
    }
  };

  // ------------------------------------------------------------ Trainingseinheiten

  var TRAININGSEINHEITEN = {
    frei: { name: 'Frei / Regeneration', gruppen: [], fitness: +9, verletzung: 0.10, moral: +0.6, farbe: '#4a5568' },
    regeneration: { name: 'Regenerationslauf', gruppen: [], fitness: +7, verletzung: 0.20, moral: +0.2, farbe: '#3d6b52' },
    kondition: { name: 'Ausdauer & Athletik', gruppen: ['ausdauer', 'kraft', 'tempo', 'antritt', 'sprungkraft', 'balance'], fitness: -5, verletzung: 1.30, moral: -0.3, farbe: '#8a5a2b' },
    technik: { name: 'Technik & Ballarbeit', gruppen: ['technik', 'passen', 'dribbling', 'flanken'], fitness: -1, verletzung: 0.55, moral: +0.2, farbe: '#2b6ca3' },
    taktik_def: { name: 'Defensivtaktik', gruppen: ['positionierung', 'antizipation', 'zweikampf', 'disziplin', 'teamwork'], fitness: -2, verletzung: 0.65, moral: 0, farbe: '#5b4b8a', teamDef: 1.0 },
    taktik_off: { name: 'Offensivtaktik', gruppen: ['uebersicht', 'entscheidung', 'passen', 'teamwork'], fitness: -2, verletzung: 0.65, moral: +0.1, farbe: '#7a3f8a', teamAtt: 1.0 },
    abschluss: { name: 'Abschlusstraining', gruppen: ['abschluss', 'weitschuss', 'kopfball', 'elfmeter'], fitness: -2, verletzung: 0.70, moral: +0.4, farbe: '#a33b3b' },
    standards: { name: 'Standardsituationen', gruppen: ['standards', 'kopfball', 'flanken', 'elfmeter'], fitness: -1, verletzung: 0.50, moral: 0, farbe: '#a3762b', standards: 1.0 },
    spielformen: { name: 'Spielformen / Trainingsspiel', gruppen: ['entscheidung', 'teamwork', 'technik', 'arbeitsrate', 'uebersicht'], fitness: -4, verletzung: 1.05, moral: +0.5, farbe: '#2f7a5a' },
    zweikampf: { name: 'Zweikampfschule', gruppen: ['zweikampf', 'aggressivitaet', 'kraft', 'balance'], fitness: -4, verletzung: 1.45, moral: -0.1, farbe: '#8a3f2b' },
    torwart: { name: 'Torwarttraining', gruppen: ['reflexe', 'handling', 'strafraum', 'einsgegeneins', 'abschlag'], fitness: -2, verletzung: 0.60, moral: +0.2, farbe: '#2b8a7a', nurTW: true },
    video: { name: 'Videoanalyse', gruppen: ['uebersicht', 'entscheidung', 'positionierung', 'antizipation'], fitness: +2, verletzung: 0.05, moral: -0.1, farbe: '#4b5a8a', analyse: 1.0 }
  };

  var INDIVIDUALTRAINING = {
    keins: { name: 'Kein Schwerpunkt', gruppen: [] },
    abschluss: { name: 'Abschluss', gruppen: ['abschluss', 'weitschuss'] },
    passspiel: { name: 'Passspiel', gruppen: ['passen', 'uebersicht'] },
    technik: { name: 'Technik', gruppen: ['technik', 'dribbling'] },
    verteidigen: { name: 'Verteidigen', gruppen: ['zweikampf', 'positionierung', 'antizipation'] },
    athletik: { name: 'Athletik', gruppen: ['kraft', 'ausdauer', 'sprungkraft'] },
    schnelligkeit: { name: 'Schnelligkeit', gruppen: ['tempo', 'antritt', 'beweglichkeit'] },
    kopfball: { name: 'Kopfballspiel', gruppen: ['kopfball', 'sprungkraft', 'positionierung'] },
    standards: { name: 'Standards', gruppen: ['standards', 'elfmeter', 'flanken'] },
    mentalitaet: { name: 'Mentalität', gruppen: ['nervenstaerke', 'entscheidung', 'arbeitsrate', 'disziplin'] },
    torwart: { name: 'Torwartspiel', gruppen: ['reflexe', 'handling', 'einsgegeneins', 'strafraum'] }
  };

  // ------------------------------------------------------------ Personal

  var STAFF_ROLLEN = {
    cotrainer: { name: 'Co-Trainer', anzahl: 2, wirkung: 'Trainingsqualität, Einschätzung des Kaders', attrs: ['taktik', 'training', 'menschenfuehrung'] },
    torwarttrainer: { name: 'Torwarttrainer', anzahl: 1, wirkung: 'Entwicklung der Torhüter', attrs: ['torwarttraining', 'training'] },
    athletiktrainer: { name: 'Athletiktrainer', anzahl: 2, wirkung: 'Fitness, Verletzungsvorbeugung', attrs: ['athletik', 'training'] },
    analyst: { name: 'Spielanalyst', anzahl: 2, wirkung: 'Gegneranalyse, Schwächen erkennen', attrs: ['analyse', 'taktik'] },
    physio: { name: 'Physiotherapeut', anzahl: 3, wirkung: 'Verkürzt Ausfallzeiten', attrs: ['physiotherapie'] },
    arzt: { name: 'Mannschaftsarzt', anzahl: 1, wirkung: 'Diagnose, Rückschlagsrisiko', attrs: ['medizin', 'physiotherapie'] },
    chefscout: { name: 'Chefscout', anzahl: 1, wirkung: 'Genauigkeit aller Scoutingberichte', attrs: ['scouting', 'urteil'] },
    scout: { name: 'Scout', anzahl: 4, wirkung: 'Beobachtung von Spielern und Gegnern', attrs: ['scouting', 'urteil'] },
    nachwuchsleiter: { name: 'Nachwuchsleiter', anzahl: 1, wirkung: 'Qualität des Jahrgangs, Talententwicklung', attrs: ['jugendarbeit', 'urteil'] },
    sportdirektor: { name: 'Sportdirektor', anzahl: 1, wirkung: 'Verhandlungsgeschick bei Transfers', attrs: ['verhandlung', 'urteil'] }
  };

  var STAFF_ATTR_NAME = {
    taktik: 'Taktik', training: 'Trainingslehre', menschenfuehrung: 'Menschenführung',
    torwarttraining: 'Torwarttraining', athletik: 'Athletik', analyse: 'Spielanalyse',
    physiotherapie: 'Physiotherapie', medizin: 'Sportmedizin', scouting: 'Scouting',
    urteil: 'Urteilsvermögen', jugendarbeit: 'Jugendarbeit', verhandlung: 'Verhandlungsführung'
  };

  // ------------------------------------------------------------ Verletzungen

  var VERLETZUNGEN = [
    { name: 'Prellung', min: 2, max: 6, schwere: 1, gewicht: 22 },
    { name: 'Muskelverhärtung', min: 3, max: 8, schwere: 1, gewicht: 20 },
    { name: 'Leichte Zerrung', min: 7, max: 16, schwere: 2, gewicht: 16 },
    { name: 'Muskelfaserriss', min: 18, max: 34, schwere: 3, gewicht: 11 },
    { name: 'Bänderdehnung im Sprunggelenk', min: 12, max: 26, schwere: 2, gewicht: 9 },
    { name: 'Gehirnerschütterung', min: 8, max: 18, schwere: 2, gewicht: 4 },
    { name: 'Innenbandanriss im Knie', min: 30, max: 55, schwere: 3, gewicht: 5 },
    { name: 'Muskelbündelriss', min: 42, max: 70, schwere: 4, gewicht: 4 },
    { name: 'Bänderriss im Sprunggelenk', min: 55, max: 90, schwere: 4, gewicht: 3 },
    { name: 'Meniskusschaden', min: 60, max: 110, schwere: 4, gewicht: 2 },
    { name: 'Schambeinentzündung', min: 45, max: 95, schwere: 4, gewicht: 2 },
    { name: 'Achillessehnenreizung', min: 20, max: 45, schwere: 3, gewicht: 3 },
    { name: 'Schulterluxation', min: 30, max: 60, schwere: 3, gewicht: 2 },
    { name: 'Knochenbruch (Mittelfuß)', min: 60, max: 100, schwere: 5, gewicht: 2 },
    { name: 'Kreuzbandriss', min: 180, max: 280, schwere: 5, gewicht: 1.2 },
    { name: 'Syndesmosebandriss', min: 70, max: 120, schwere: 5, gewicht: 1 }
  ];

  var KRANKHEITEN = [
    { name: 'Grippaler Infekt', min: 4, max: 10 },
    { name: 'Magen-Darm-Infekt', min: 3, max: 7 },
    { name: 'Fieber', min: 3, max: 8 }
  ];

  // ------------------------------------------------------------ Sponsoren

  var SPONSOREN = {
    trikot: ['Volksbank', 'Sparkasse Regional', 'AutoWerk AG', 'Telefonika', 'NordEnergie',
      'GlobalLogistik', 'BauKraft', 'PharmaVita', 'Reisewelt24', 'CyberSafe', 'GrünStrom',
      'MetallUnion', 'Versicherung Concordia', 'DigitalBank', 'FrischMarkt'],
    aermel: ['SoftPoint', 'Getränke Reinhardt', 'FitLife', 'Kaffeerösterei Nord', 'BauMax',
      'HeimTech', 'Autohaus Gebhardt', 'Cloudbase', 'RegioMobil'],
    ausruester: ['Adispor', 'Nikex', 'PumaTec', 'Jakolo', 'Hummelin', 'Uhlmann', 'Kappex', 'Macronix'],
    stadion: ['Allianz', 'Deutsche Bank', 'Volkswagen', 'PreZero', 'MHP', 'Merkur', 'Vonovia',
      'BayArena', 'Red Bull', 'Mewa', 'WWK', 'Voith', 'Veltins', 'Schüco', 'BBBank', 'BRITA'],
    premium: ['StadtWerke', 'HandwerkPlus', 'RegioSpeditionen', 'SüdMilch', 'TechnoPart',
      'NordSee Fisch', 'BurgerHaus', 'FahrradWelt', 'PrintPro', 'Hotelkette Vier Sterne']
  };

  // ------------------------------------------------------------ Sonstiges

  var SCHIEDSRICHTER = [
    { name: 'Deniz Aytekin', streng: 1.05 }, { name: 'Felix Zwayer', streng: 1.12 },
    { name: 'Daniel Siebert', streng: 1.00 }, { name: 'Tobias Stieler', streng: 0.95 },
    { name: 'Sascha Stegemann', streng: 1.08 }, { name: 'Harm Osmers', streng: 0.92 },
    { name: 'Christian Dingert', streng: 1.02 }, { name: 'Bastian Dankert', streng: 1.10 },
    { name: 'Matthias Jöllenbeck', streng: 0.98 }, { name: 'Florian Badstübner', streng: 1.04 },
    { name: 'Robert Hartmann', streng: 0.96 }, { name: 'Sven Jablonski', streng: 1.06 },
    { name: 'Patrick Ittrich', streng: 1.01 }, { name: 'Frank Willenborg', streng: 1.14 }
  ];

  var WETTER = [
    { id: 'sonnig', name: 'Sonnig', tempo: 1.00, fehler: 1.00, kondition: 1.02, zuschauer: 1.03 },
    { id: 'bewoelkt', name: 'Bewölkt', tempo: 1.00, fehler: 1.00, kondition: 1.00, zuschauer: 1.00 },
    { id: 'regen', name: 'Regen', tempo: 0.96, fehler: 1.15, kondition: 1.05, zuschauer: 0.93 },
    { id: 'starkregen', name: 'Starkregen', tempo: 0.90, fehler: 1.30, kondition: 1.10, zuschauer: 0.86 },
    { id: 'wind', name: 'Starker Wind', tempo: 0.97, fehler: 1.18, kondition: 1.04, zuschauer: 0.96 },
    { id: 'schnee', name: 'Schnee', tempo: 0.86, fehler: 1.35, kondition: 1.12, zuschauer: 0.80 },
    { id: 'hitze', name: 'Hitze', tempo: 0.94, fehler: 1.05, kondition: 1.22, zuschauer: 0.97 },
    { id: 'kalt', name: 'Frostig', tempo: 0.96, fehler: 1.10, kondition: 1.06, zuschauer: 0.88 }
  ];

  FM.data = {
    POSITIONEN: POSITIONEN, POS_NAME: POS_NAME, POS_GRUPPE: POS_GRUPPE,
    POS_VERWANDT: POS_VERWANDT, POS_GEWICHTE: POS_GEWICHTE,
    ATTRIBUTE: ATTRIBUTE, ATTR_NAME: ATTR_NAME, ALLE_ATTRIBUTE: ALLE_ATTRIBUTE,
    VEREINE: VEREINE, DRITTE_LIGA: DRITTE_LIGA, AMATEURE: AMATEURE, EUROPA: EUROPA,
    NAMEN: NAMEN, PERSOENLICHKEITEN: PERSOENLICHKEITEN,
    FORMATIONEN: FORMATIONEN, ROLLEN: ROLLEN, ANWEISUNGEN: ANWEISUNGEN,
    TRAININGSEINHEITEN: TRAININGSEINHEITEN, INDIVIDUALTRAINING: INDIVIDUALTRAINING,
    STAFF_ROLLEN: STAFF_ROLLEN, STAFF_ATTR_NAME: STAFF_ATTR_NAME,
    VERLETZUNGEN: VERLETZUNGEN, KRANKHEITEN: KRANKHEITEN,
    SPONSOREN: SPONSOREN, SCHIEDSRICHTER: SCHIEDSRICHTER, WETTER: WETTER
  };

})(typeof window !== 'undefined' ? window : globalThis);
