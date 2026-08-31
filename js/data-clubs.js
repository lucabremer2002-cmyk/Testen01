/* data-clubs.js - Vereine der spielbaren Ligen (Bundesliga bis Regionalliga West)
 *
 * Felder je Verein:
 *   id, name, kurz (3 Buchstaben), stadt,
 *   c1/c2 = echte Vereinsfarben (primaer/sekundaer) - daraus wird das Wappen erzeugt,
 *   muster = Trikot-/Wappenmuster, form = Wappenform,
 *   stadion, kapazitaet, ruf (0-100)
 */
(function (g) {
  'use strict';

  function c(id, name, kurz, stadt, c1, c2, muster, form, stadion, kap, ruf) {
    return {
      id: id, name: name, kurz: kurz, stadt: stadt,
      c1: c1, c2: c2, muster: muster, form: form,
      stadion: stadion, kapazitaet: kap, ruf: ruf
    };
  }

  /* muster: voll | streifen | halb | schraeg | ring | balken
     form:   schild | rund | raute | wappen | sechseck */

  var BUNDESLIGA = [
    c('fcb', 'FC Bayern München', 'FCB', 'München', '#dc052d', '#ffffff', 'voll', 'rund', 'Allianz Arena', 75024, 96),
    c('bvb', 'Borussia Dortmund', 'BVB', 'Dortmund', '#fde100', '#000000', 'ring', 'rund', 'Signal Iduna Park', 81365, 89),
    c('b04', 'Bayer 04 Leverkusen', 'B04', 'Leverkusen', '#e32221', '#000000', 'schraeg', 'schild', 'BayArena', 30210, 85),
    c('rbl', 'RB Leipzig', 'RBL', 'Leipzig', '#dd0741', '#ffffff', 'halb', 'schild', 'Red Bull Arena', 47069, 84),
    c('sge', 'Eintracht Frankfurt', 'SGE', 'Frankfurt', '#e1000f', '#000000', 'balken', 'wappen', 'Deutsche Bank Park', 58000, 81),
    c('vfb', 'VfB Stuttgart', 'VFB', 'Stuttgart', '#ffffff', '#e32219', 'ring', 'rund', 'MHPArena', 60449, 79),
    c('bmg', 'Borussia Mönchengladbach', 'BMG', 'Mönchengladbach', '#000000', '#00a94f', 'streifen', 'raute', 'Borussia-Park', 54042, 76),
    c('svw', 'SV Werder Bremen', 'SVW', 'Bremen', '#1d9053', '#ffffff', 'raute', 'raute', 'Weserstadion', 42100, 75),
    c('wob', 'VfL Wolfsburg', 'WOB', 'Wolfsburg', '#65b32e', '#ffffff', 'halb', 'sechseck', 'Volkswagen Arena', 30000, 74),
    c('hsv', 'Hamburger SV', 'HSV', 'Hamburg', '#0a3c8c', '#ffffff', 'balken', 'raute', 'Volksparkstadion', 57000, 73),
    c('scf', 'SC Freiburg', 'SCF', 'Freiburg', '#e2001a', '#000000', 'schraeg', 'schild', 'Europa-Park Stadion', 34700, 73),
    c('koe', '1. FC Köln', 'KOE', 'Köln', '#ffffff', '#e2001a', 'halb', 'wappen', 'RheinEnergieStadion', 50000, 72),
    c('tsg', 'TSG 1899 Hoffenheim', 'TSG', 'Sinsheim', '#1961b5', '#ffffff', 'schraeg', 'rund', 'PreZero Arena', 30150, 70),
    c('fcu', '1. FC Union Berlin', 'FCU', 'Berlin', '#eb1923', '#ffe500', 'balken', 'schild', 'Stadion An der Alten Försterei', 22012, 69),
    c('m05', '1. FSV Mainz 05', 'M05', 'Mainz', '#c3141e', '#ffffff', 'balken', 'wappen', 'MEWA ARENA', 33305, 69),
    c('fca', 'FC Augsburg', 'FCA', 'Augsburg', '#ba3733', '#46714d', 'halb', 'schild', 'WWK ARENA', 30660, 67),
    c('stp', 'FC St. Pauli', 'STP', 'Hamburg', '#63432b', '#ffffff', 'voll', 'rund', 'Millerntor-Stadion', 29546, 65),
    c('fch', '1. FC Heidenheim 1846', 'FCH', 'Heidenheim', '#e30613', '#0e2b6b', 'schraeg', 'wappen', 'Voith-Arena', 15000, 62)
  ];

  var BUNDESLIGA2 = [
    c('s04', 'FC Schalke 04', 'S04', 'Gelsenkirchen', '#004d9d', '#ffffff', 'voll', 'rund', 'Veltins-Arena', 62271, 75),
    c('bsc', 'Hertha BSC', 'BSC', 'Berlin', '#005ca9', '#ffffff', 'halb', 'rund', 'Olympiastadion', 74667, 72),
    c('h96', 'Hannover 96', 'H96', 'Hannover', '#00964c', '#000000', 'streifen', 'schild', 'Heinz von Heiden Arena', 49000, 66),
    c('fck', '1. FC Kaiserslautern', 'FCK', 'Kaiserslautern', '#e2001a', '#ffffff', 'balken', 'wappen', 'Fritz-Walter-Stadion', 49780, 66),
    c('f95', 'Fortuna Düsseldorf', 'F95', 'Düsseldorf', '#e2001a', '#ffffff', 'ring', 'rund', 'Merkur Spiel-Arena', 54600, 65),
    c('boc', 'VfL Bochum', 'BOC', 'Bochum', '#005ca9', '#ffffff', 'streifen', 'sechseck', 'Vonovia Ruhrstadion', 26000, 64),
    c('fcn', '1. FC Nürnberg', 'FCN', 'Nürnberg', '#8b0e2e', '#ffffff', 'voll', 'rund', 'Max-Morlock-Stadion', 50000, 64),
    c('ksc', 'Karlsruher SC', 'KSC', 'Karlsruhe', '#0a5ba8', '#ffffff', 'schraeg', 'schild', 'BBBank Wildpark', 34302, 61),
    c('ksv', 'Holstein Kiel', 'KSV', 'Kiel', '#0b4ea2', '#ffffff', 'streifen', 'wappen', 'Holstein-Stadion', 15034, 60),
    c('sgd', 'SG Dynamo Dresden', 'SGD', 'Dresden', '#f6e500', '#000000', 'halb', 'rund', 'Rudolf-Harbig-Stadion', 32066, 60),
    c('d98', 'SV Darmstadt 98', 'D98', 'Darmstadt', '#004f9f', '#ffffff', 'balken', 'raute', 'Merck-Stadion', 17810, 59),
    c('fcm', '1. FC Magdeburg', 'FCM', 'Magdeburg', '#004b9b', '#ffffff', 'schraeg', 'schild', 'MDCC-Arena', 30098, 58),
    c('scp', 'SC Paderborn 07', 'SCP', 'Paderborn', '#004f9f', '#000000', 'streifen', 'sechseck', 'Home Deluxe Arena', 15000, 58),
    c('dsc', 'Arminia Bielefeld', 'DSC', 'Bielefeld', '#00529c', '#ffffff', 'streifen', 'raute', 'SchücoArena', 26515, 57),
    c('sgf', 'SpVgg Greuther Fürth', 'SGF', 'Fürth', '#00954c', '#ffffff', 'halb', 'wappen', 'Sportpark Ronhof', 16626, 57),
    c('scv', 'SC Preußen Münster', 'PSV', 'Münster', '#00713c', '#ffffff', 'balken', 'schild', 'Preußenstadion', 15050, 55),
    c('eib', 'Eintracht Braunschweig', 'EBS', 'Braunschweig', '#f7d117', '#0b3b8c', 'ring', 'rund', 'Eintracht-Stadion', 23325, 55),
    c('sve', 'SV 07 Elversberg', 'SVE', 'Elversberg', '#000000', '#e30613', 'streifen', 'schild', 'Ursapharm-Arena', 10000, 53)
  ];

  var LIGA3 = [
    c('m60', 'TSV 1860 München', '860', 'München', '#009ee0', '#ffffff', 'voll', 'wappen', 'Städtisches Stadion Grünwalder Str.', 15000, 54),
    c('ros', 'FC Hansa Rostock', 'HAN', 'Rostock', '#004b93', '#ffffff', 'schraeg', 'rund', 'Ostseestadion', 29000, 53),
    c('rwe', 'Rot-Weiss Essen', 'RWE', 'Essen', '#e2001a', '#ffffff', 'halb', 'rund', 'Stadion an der Hafenstraße', 20650, 51),
    c('msv', 'MSV Duisburg', 'MSV', 'Duisburg', '#005ca9', '#ffffff', 'streifen', 'rund', 'Schauinsland-Reisen-Arena', 31500, 51),
    c('jrb', 'SSV Jahn Regensburg', 'JRB', 'Regensburg', '#e2001a', '#ffffff', 'balken', 'schild', 'Jahnstadion Regensburg', 15224, 50),
    c('ulm', 'SSV Ulm 1846', 'ULM', 'Ulm', '#000000', '#ffffff', 'streifen', 'wappen', 'Donaustadion', 17000, 49),
    c('aue', 'FC Erzgebirge Aue', 'AUE', 'Aue', '#7c1c2a', '#ffffff', 'voll', 'rund', 'Erzgebirgsstadion', 15711, 49),
    c('swm', 'SV Waldhof Mannheim', 'SVW', 'Mannheim', '#0057a4', '#000000', 'halb', 'schild', 'Carl-Benz-Stadion', 25667, 48),
    c('cot', 'FC Energie Cottbus', 'FCE', 'Cottbus', '#e2001a', '#ffffff', 'ring', 'rund', 'Stadion der Freundschaft', 22528, 47),
    c('aac', 'Alemannia Aachen', 'AAC', 'Aachen', '#f7c600', '#000000', 'streifen', 'wappen', 'Tivoli', 32960, 47),
    c('osn', 'VfL Osnabrück', 'OSN', 'Osnabrück', '#7a2b8c', '#ffffff', 'schraeg', 'raute', 'Bremer Brücke', 16667, 46),
    c('ing', 'FC Ingolstadt 04', 'FCI', 'Ingolstadt', '#e2001a', '#000000', 'streifen', 'sechseck', 'Audi Sportpark', 15200, 46),
    c('fcs', '1. FC Saarbrücken', 'FCS', 'Saarbrücken', '#0a4ea2', '#000000', 'halb', 'rund', 'Ludwigsparkstadion', 16003, 45),
    c('vkm', 'FC Viktoria Köln', 'VKM', 'Köln', '#e2001a', '#ffffff', 'balken', 'schild', 'Sportpark Höhenberg', 8000, 43),
    c('vrl', 'SC Verl', 'VRL', 'Verl', '#005ca9', '#ffffff', 'streifen', 'raute', 'Sportclub Arena', 5153, 42),
    c('swf', '1. FC Schweinfurt 05', 'SWF', 'Schweinfurt', '#00954c', '#ffffff', 'halb', 'wappen', 'Willy-Sachs-Stadion', 12000, 41),
    c('hav', 'TSV Havelse', 'HAV', 'Garbsen', '#0057a4', '#ffe500', 'schraeg', 'schild', 'Wilhelm-Langrehr-Stadion', 3500, 39),
    c('wwi', 'SV Wehen Wiesbaden', 'SVWW', 'Wiesbaden', '#e2001a', '#000000', 'balken', 'sechseck', 'BRITA-Arena', 12566, 45),
    c('bv2', 'Borussia Dortmund II', 'BV2', 'Dortmund', '#fde100', '#000000', 'balken', 'sechseck', 'Stadion Rote Erde', 9999, 42),
    c('vb2', 'VfB Stuttgart II', 'VB2', 'Stuttgart', '#ffffff', '#e32219', 'balken', 'sechseck', 'GAZi-Stadion', 11000, 42)
  ];

  var REGIONALLIGA_WEST = [
    c('wsv', 'Wuppertaler SV', 'WSV', 'Wuppertal', '#e2001a', '#0a3c8c', 'halb', 'rund', 'Stadion am Zoo', 23067, 36),
    c('boc1', '1. FC Bocholt', 'BOC', 'Bocholt', '#000000', '#f7c600', 'streifen', 'schild', 'Am Hünting', 6000, 34),
    c('roe', 'SV Rödinghausen', 'ROE', 'Rödinghausen', '#0057a4', '#ffffff', 'schraeg', 'wappen', 'Häcker Wiehenstadion', 5000, 34),
    c('fko', 'SC Fortuna Köln', 'FKO', 'Köln', '#e2001a', '#ffffff', 'ring', 'rund', 'Südstadion', 14944, 35),
    c('rwa', 'Rot Weiss Ahlen', 'RWA', 'Ahlen', '#e2001a', '#ffffff', 'halb', 'schild', 'Wersestadion', 10101, 33),
    c('wie', 'SC Wiedenbrück', 'WIE', 'Rheda-Wiedenbrück', '#00954c', '#ffffff', 'streifen', 'raute', 'Jahnstadion', 5000, 30),
    c('lot', 'Sportfreunde Lotte', 'LOT', 'Lotte', '#0057a4', '#ffffff', 'balken', 'sechseck', 'Frimo-Stadion', 10059, 31),
    c('gue', 'FC Gütersloh', 'GUE', 'Gütersloh', '#0a3c8c', '#ffffff', 'schraeg', 'schild', 'Heidewaldstadion', 5000, 30),
    c('sie', 'Sportfreunde Siegen', 'SIE', 'Siegen', '#e2001a', '#ffffff', 'streifen', 'wappen', 'Leimbachstadion', 18000, 31),
    c('sch', 'SV Schermbeck', 'SCH', 'Schermbeck', '#e2001a', '#000000', 'halb', 'raute', 'Sportplatz Schermbeck', 3000, 27),
    c('hoh', 'FC Hennef 05', 'HEN', 'Hennef', '#00954c', '#ffffff', 'balken', 'schild', 'Sportzentrum Hennef', 3000, 27),
    c('due', '1. FC Düren', 'DUE', 'Düren', '#0057a4', '#f7c600', 'schraeg', 'rund', 'Westkampfbahn', 4000, 28),
    c('vel', 'SSVg Velbert', 'VEL', 'Velbert', '#004b93', '#ffffff', 'streifen', 'sechseck', 'Sonnenblume', 5000, 28),
    c('s42', 'FC Schalke 04 II', 'S42', 'Gelsenkirchen', '#004d9d', '#ffffff', 'balken', 'sechseck', 'Parkstadion', 5000, 33),
    c('k02', '1. FC Köln II', 'K02', 'Köln', '#ffffff', '#e2001a', 'balken', 'sechseck', 'Franz-Kremer-Stadion', 5000, 33),
    c('f92', 'Fortuna Düsseldorf II', 'F92', 'Düsseldorf', '#e2001a', '#ffffff', 'balken', 'sechseck', 'Paul-Janes-Stadion', 6000, 32),
    c('bm2', 'Borussia Mönchengladbach II', 'BM2', 'Mönchengladbach', '#000000', '#00a94f', 'balken', 'sechseck', 'Grenzlandstadion', 6000, 32),
    c('sp2', 'SC Paderborn 07 II', 'SP2', 'Paderborn', '#004f9f', '#000000', 'balken', 'sechseck', 'Ahorn-Sportpark', 3000, 29)
  ];

  var LIGEN = [
    { id: 'bl1', name: 'Bundesliga', kurz: 'BL', stufe: 1, teams: BUNDESLIGA,
      tvGeld: 50000000, siegPraemie: 900000, aufstieg: 0, direktAb: 2, relegation: 1,
      farbe: '#e11d48' },
    { id: 'bl2', name: '2. Bundesliga', kurz: '2.BL', stufe: 2, teams: BUNDESLIGA2,
      tvGeld: 12000000, siegPraemie: 260000, aufstieg: 2, direktAb: 2, relegation: 1,
      farbe: '#f59e0b' },
    { id: 'l3', name: '3. Liga', kurz: '3.L', stufe: 3, teams: LIGA3,
      tvGeld: 1300000, siegPraemie: 45000, aufstieg: 2, direktAb: 3, relegation: 1,
      farbe: '#22c55e' },
    { id: 'rlw', name: 'Regionalliga West', kurz: 'RLW', stufe: 4, teams: REGIONALLIGA_WEST,
      tvGeld: 180000, siegPraemie: 6000, aufstieg: 1, direktAb: 3, relegation: 0,
      farbe: '#38bdf8' }
  ];

  g.DataClubs = { LIGEN: LIGEN };
})(typeof window !== 'undefined' ? window : globalThis);
