/* data-pool.js - Vereinspool fuer Auf- und Abstieg an den Raendern der Spielwelt.
 *
 * Aus der 3. Liga steigen drei Klubs ab, aus der Regionalliga West steigt aber
 * nur einer auf - die restlichen Plaetze fuellen Meister der uebrigen
 * Regionalligen (Nord, Nordost, Sued, Suedwest, Bayern). Unterhalb der
 * Regionalliga West uebernehmen Oberliga-Aufsteiger.
 */
(function (g) {
  'use strict';

  function c(id, name, kurz, stadt, c1, c2, muster, form, stadion, kap, ruf) {
    return { id: id, name: name, kurz: kurz, stadt: stadt, c1: c1, c2: c2,
      muster: muster, form: form, stadion: stadion, kapazitaet: kap, ruf: ruf };
  }

  /* Kandidaten fuer die 3. Liga (Meister der anderen Regionalligen). */
  var REGIONALLIGA_REST = [
    c('cfc', 'Chemnitzer FC', 'CFC', 'Chemnitz', '#0a55a0', '#ffffff', 'streifen', 'rund', 'Stadion an der Gellertstraße', 15000, 40),
    c('hfc', 'Hallescher FC', 'HFC', 'Halle', '#e2001a', '#ffffff', 'halb', 'schild', 'Leuna-Chemie-Stadion', 15057, 41),
    c('ofc', 'Kickers Offenbach', 'OFC', 'Offenbach', '#e2001a', '#ffffff', 'ring', 'rund', 'Stadion am Bieberer Berg', 20500, 41),
    c('stk', 'Stuttgarter Kickers', 'STK', 'Stuttgart', '#0a55a0', '#f7c600', 'streifen', 'wappen', 'GAZi-Stadion', 11400, 39),
    c('spu', 'SpVgg Unterhaching', 'SPU', 'Unterhaching', '#e2001a', '#0a55a0', 'halb', 'schild', 'Uhlsport Park', 15053, 40),
    c('svs', 'SV Sandhausen', 'SVS', 'Sandhausen', '#000000', '#e2001a', 'streifen', 'raute', 'BWT-Stadion am Hardtwald', 15414, 42),
    c('czj', 'FC Carl Zeiss Jena', 'CZJ', 'Jena', '#0a55a0', '#f7c600', 'balken', 'rund', 'Ernst-Abbe-Sportfeld', 12900, 39),
    c('vfl', 'VfB Lübeck', 'VFL', 'Lübeck', '#00954c', '#ffffff', 'streifen', 'schild', 'Stadion Lohmühle', 17869, 37),
    c('hom', 'FC 08 Homburg', 'HOM', 'Homburg', '#00954c', '#ffffff', 'halb', 'wappen', 'Waldstadion', 12000, 38),
    c('bfc', 'BFC Dynamo', 'BFC', 'Berlin', '#7c1c2a', '#ffffff', 'streifen', 'rund', 'Sportforum Hohenschönhausen', 12000, 38),
    c('sth', 'TSV Steinbach Haiger', 'STH', 'Haiger', '#0a3c8c', '#ffffff', 'schraeg', 'sechseck', 'Haarwasen', 4800, 36),
    c('gie', 'FC Gießen', 'GIE', 'Gießen', '#0a55a0', '#ffffff', 'halb', 'schild', 'Waldstadion Gießen', 8000, 34),
    c('vfo', 'VfB Oldenburg', 'VFO', 'Oldenburg', '#0a3c8c', '#ffffff', 'streifen', 'raute', 'Marschwegstadion', 15200, 36),
    c('nor', 'Eintracht Norderstedt', 'NOR', 'Norderstedt', '#e2001a', '#000000', 'balken', 'schild', 'Edmund-Plambeck-Stadion', 5100, 33),
    c('koc', 'FC Rot-Weiß Koblenz', 'KOB', 'Koblenz', '#e2001a', '#ffffff', 'halb', 'rund', 'Stadion Oberwerth', 15100, 34),
    c('kot', 'SV Eintracht Trier', 'TRI', 'Trier', '#000000', '#ffffff', 'streifen', 'wappen', 'Moselstadion', 10254, 34)
  ];

  /* Kandidaten fuer die Regionalliga West (Oberliga-Aufsteiger aus NRW). */
  var OBERLIGA_WEST = [
    c('etb', 'ETB SW Essen', 'ETB', 'Essen', '#ffffff', '#000000', 'streifen', 'rund', 'Uhlenkrugstadion', 7000, 25),
    c('vbh', 'VfB Homberg', 'VBH', 'Duisburg', '#0a55a0', '#ffffff', 'halb', 'schild', 'PCC-Stadion', 3000, 25),
    c('kra', 'FC Kray', 'KRA', 'Essen', '#e2001a', '#ffffff', 'balken', 'raute', 'PSV-Stadion', 3000, 23),
    c('rat', 'Ratingen 04/19', 'RAT', 'Ratingen', '#0a3c8c', '#f7c600', 'schraeg', 'schild', 'Sportpark Ratingen', 3000, 24),
    c('bau', 'Sportfreunde Baumberg', 'BAU', 'Monheim', '#00954c', '#ffffff', 'streifen', 'sechseck', 'Sportpark Baumberg', 2000, 22),
    c('net', 'SC Union Nettetal', 'NET', 'Nettetal', '#e2001a', '#0a3c8c', 'halb', 'rund', 'Stadion Nettetal', 2500, 22),
    c('mee', 'TSV Meerbusch', 'MEE', 'Meerbusch', '#0a55a0', '#ffffff', 'balken', 'schild', 'Sportpark Meerbusch', 2000, 21),
    c('hil', 'VfB 03 Hilden', 'HIL', 'Hilden', '#e2001a', '#ffffff', 'streifen', 'wappen', 'Bandsbusch', 3000, 22),
    c('cro', 'Cronenberger SC', 'CRO', 'Wuppertal', '#0a3c8c', '#ffffff', 'halb', 'raute', 'Sportplatz Hastener Str.', 2000, 21),
    c('lip', 'SV Lippstadt 08', 'LIP', 'Lippstadt', '#000000', '#f7c600', 'streifen', 'rund', 'Am Bruchbaum', 4000, 26),
    c('rhy', 'Westfalia Rhynern', 'RHY', 'Hamm', '#e2001a', '#ffffff', 'balken', 'sechseck', 'Sportplatz Rhynern', 2500, 22),
    c('son', 'SV Sonsbeck', 'SON', 'Sonsbeck', '#0a55a0', '#ffffff', 'schraeg', 'schild', 'Sportanlage Sonsbeck', 2000, 21),
    c('web', 'FC Wegberg-Beeck', 'WEB', 'Wegberg', '#e2001a', '#000000', 'streifen', 'raute', 'Waldstadion Beeck', 2500, 22),
    c('sto', 'SC St. Tönis', 'STO', 'Tönisvorst', '#f7c600', '#0a3c8c', 'halb', 'rund', 'Sportzentrum Corneliusplatz', 2000, 21),
    c('vre', 'SpVgg Vreden', 'VRE', 'Vreden', '#0a55a0', '#ffffff', 'balken', 'wappen', 'Sportzentrum Vreden', 2000, 21),
    c('hol', 'Holzwickeder SC', 'HOL', 'Holzwickede', '#00954c', '#ffffff', 'streifen', 'schild', 'Montanhydraulik-Stadion', 2500, 21)
  ];

  g.DataPool = { REGIONALLIGA_REST: REGIONALLIGA_REST, OBERLIGA_WEST: OBERLIGA_WEST };
})(typeof window !== 'undefined' ? window : globalThis);
