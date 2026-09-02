/* data-intl.js - Internationale Vereine.
 * Diese Klubs nehmen NICHT am Spielbetrieb teil (keine Liga, keine Tabelle),
 * sie existieren ausschliesslich als Handelspartner auf dem Transfermarkt.
 * Format: [name, kurz, land, wettbewerb, farbe1, farbe2, ruf, muster, form]
 */
(function (g) {
  'use strict';

  var I = [
    /* England */
    ['Manchester City', 'MCI', 'England', 'Premier League', '#6cabdd', '#ffffff', 95, 'voll', 'rund'],
    ['Arsenal FC', 'ARS', 'England', 'Premier League', '#ef0107', '#ffffff', 92, 'halb', 'wappen'],
    ['Liverpool FC', 'LIV', 'England', 'Premier League', '#c8102e', '#00b2a9', 94, 'voll', 'schild'],
    ['Manchester United', 'MUN', 'England', 'Premier League', '#da291c', '#fbe122', 91, 'voll', 'rund'],
    ['Chelsea FC', 'CHE', 'England', 'Premier League', '#034694', '#ffffff', 90, 'voll', 'rund'],
    ['Tottenham Hotspur', 'TOT', 'England', 'Premier League', '#132257', '#ffffff', 87, 'halb', 'schild'],
    ['Newcastle United', 'NEW', 'England', 'Premier League', '#241f20', '#ffffff', 84, 'streifen', 'wappen'],
    ['Aston Villa', 'AVL', 'England', 'Premier League', '#670e36', '#95bfe5', 83, 'schraeg', 'rund'],
    ['West Ham United', 'WHU', 'England', 'Premier League', '#7a263a', '#1bb1e7', 79, 'halb', 'schild'],
    ['Brighton & Hove Albion', 'BHA', 'England', 'Premier League', '#0057b8', '#ffffff', 78, 'streifen', 'rund'],
    ['Crystal Palace', 'CRY', 'England', 'Premier League', '#1b458f', '#c4122e', 75, 'streifen', 'wappen'],
    ['Everton FC', 'EVE', 'England', 'Premier League', '#003399', '#ffffff', 75, 'voll', 'schild'],
    ['Nottingham Forest', 'NFO', 'England', 'Premier League', '#dd0000', '#ffffff', 74, 'voll', 'rund'],
    ['Leeds United', 'LEE', 'England', 'Premier League', '#ffffff', '#1d428a', 72, 'voll', 'rund'],

    /* Spanien */
    ['Real Madrid', 'RMA', 'Spanien', 'LaLiga', '#ffffff', '#febe10', 97, 'voll', 'rund'],
    ['FC Barcelona', 'FCB', 'Spanien', 'LaLiga', '#a50044', '#004d98', 95, 'streifen', 'wappen'],
    ['Atlético Madrid', 'ATM', 'Spanien', 'LaLiga', '#cb3524', '#ffffff', 89, 'streifen', 'schild'],
    ['Athletic Bilbao', 'ATH', 'Spanien', 'LaLiga', '#ee2523', '#ffffff', 80, 'streifen', 'wappen'],
    ['Real Sociedad', 'RSO', 'Spanien', 'LaLiga', '#0067b1', '#ffffff', 79, 'streifen', 'rund'],
    ['Real Betis', 'BET', 'Spanien', 'LaLiga', '#00954c', '#ffffff', 78, 'streifen', 'rund'],
    ['Villarreal CF', 'VIL', 'Spanien', 'LaLiga', '#ffe667', '#005187', 78, 'voll', 'schild'],
    ['Valencia CF', 'VAL', 'Spanien', 'LaLiga', '#ffffff', '#f18e00', 76, 'voll', 'raute'],
    ['Sevilla FC', 'SEV', 'Spanien', 'LaLiga', '#ffffff', '#d81920', 79, 'voll', 'wappen'],
    ['Girona FC', 'GIR', 'Spanien', 'LaLiga', '#cd2534', '#ffffff', 73, 'streifen', 'schild'],

    /* Italien */
    ['Inter Mailand', 'INT', 'Italien', 'Serie A', '#0068a8', '#000000', 91, 'streifen', 'rund'],
    ['AC Mailand', 'MIL', 'Italien', 'Serie A', '#fb090b', '#000000', 89, 'streifen', 'schild'],
    ['Juventus Turin', 'JUV', 'Italien', 'Serie A', '#000000', '#ffffff', 88, 'streifen', 'wappen'],
    ['SSC Neapel', 'NAP', 'Italien', 'Serie A', '#12a0d7', '#ffffff', 87, 'voll', 'rund'],
    ['AS Rom', 'ROM', 'Italien', 'Serie A', '#8e1f2f', '#f0bc42', 84, 'voll', 'schild'],
    ['Atalanta Bergamo', 'ATA', 'Italien', 'Serie A', '#1e71b8', '#000000', 83, 'streifen', 'rund'],
    ['Lazio Rom', 'LAZ', 'Italien', 'Serie A', '#87d8f7', '#ffffff', 79, 'voll', 'wappen'],
    ['AC Florenz', 'FIO', 'Italien', 'Serie A', '#582c83', '#ffffff', 78, 'voll', 'raute'],
    ['FC Bologna', 'BOL', 'Italien', 'Serie A', '#1a2f48', '#a01e20', 76, 'streifen', 'schild'],
    ['Torino FC', 'TOR', 'Italien', 'Serie A', '#8b1a1a', '#ffffff', 72, 'voll', 'rund'],

    /* Frankreich */
    ['Paris Saint-Germain', 'PSG', 'Frankreich', 'Ligue 1', '#004170', '#da291c', 94, 'balken', 'rund'],
    ['Olympique Marseille', 'OM', 'Frankreich', 'Ligue 1', '#2faee0', '#ffffff', 81, 'voll', 'rund'],
    ['AS Monaco', 'ASM', 'Frankreich', 'Ligue 1', '#e63946', '#ffffff', 80, 'schraeg', 'raute'],
    ['Olympique Lyon', 'OL', 'Frankreich', 'Ligue 1', '#ffffff', '#132bb2', 78, 'voll', 'schild'],
    ['LOSC Lille', 'LIL', 'Frankreich', 'Ligue 1', '#e01e13', '#0a2352', 77, 'halb', 'rund'],
    ['OGC Nizza', 'NIZ', 'Frankreich', 'Ligue 1', '#c8102e', '#000000', 74, 'halb', 'wappen'],
    ['Stade Rennes', 'REN', 'Frankreich', 'Ligue 1', '#e2001a', '#000000', 74, 'streifen', 'schild'],
    ['RC Lens', 'LEN', 'Frankreich', 'Ligue 1', '#f5c400', '#e2001a', 73, 'streifen', 'sechseck'],

    /* Niederlande / Belgien / Portugal */
    ['Ajax Amsterdam', 'AJA', 'Niederlande', 'Eredivisie', '#d2122e', '#ffffff', 80, 'balken', 'schild'],
    ['PSV Eindhoven', 'PSV', 'Niederlande', 'Eredivisie', '#ed1c24', '#ffffff', 79, 'streifen', 'rund'],
    ['Feyenoord Rotterdam', 'FEY', 'Niederlande', 'Eredivisie', '#e30613', '#ffffff', 77, 'halb', 'wappen'],
    ['AZ Alkmaar', 'AZ', 'Niederlande', 'Eredivisie', '#e2001a', '#ffffff', 71, 'voll', 'schild'],
    ['FC Twente', 'TWE', 'Niederlande', 'Eredivisie', '#e2001a', '#ffffff', 68, 'voll', 'rund'],
    ['Club Brügge', 'CLB', 'Belgien', 'Pro League', '#0a55a0', '#000000', 73, 'streifen', 'rund'],
    ['RSC Anderlecht', 'AND', 'Belgien', 'Pro League', '#5c2d91', '#ffffff', 70, 'voll', 'wappen'],
    ['KRC Genk', 'GNK', 'Belgien', 'Pro League', '#0a55a0', '#ffffff', 68, 'halb', 'schild'],
    ['Benfica Lissabon', 'BEN', 'Portugal', 'Liga Portugal', '#e30613', '#ffffff', 82, 'voll', 'rund'],
    ['FC Porto', 'POR', 'Portugal', 'Liga Portugal', '#0033a0', '#ffffff', 81, 'streifen', 'schild'],
    ['Sporting Lissabon', 'SCP', 'Portugal', 'Liga Portugal', '#008057', '#ffffff', 80, 'streifen', 'wappen'],
    ['SC Braga', 'BRA', 'Portugal', 'Liga Portugal', '#e2001a', '#ffffff', 71, 'voll', 'rund'],

    /* Rest Europa */
    ['Celtic Glasgow', 'CEL', 'Schottland', 'Premiership', '#008b4c', '#ffffff', 71, 'streifen', 'rund'],
    ['Glasgow Rangers', 'RAN', 'Schottland', 'Premiership', '#1b458f', '#ffffff', 69, 'voll', 'schild'],
    ['FC Red Bull Salzburg', 'RBS', 'Österreich', 'Bundesliga (A)', '#e2001a', '#ffffff', 71, 'halb', 'schild'],
    ['SK Rapid Wien', 'RAP', 'Österreich', 'Bundesliga (A)', '#00954c', '#ffffff', 64, 'streifen', 'wappen'],
    ['BSC Young Boys', 'YB', 'Schweiz', 'Super League', '#f7c600', '#000000', 66, 'halb', 'rund'],
    ['FC Basel 1893', 'BAS', 'Schweiz', 'Super League', '#e2001a', '#0a3c8c', 66, 'halb', 'schild'],
    ['Galatasaray Istanbul', 'GAL', 'Türkei', 'Süper Lig', '#a90432', '#fdb912', 76, 'halb', 'rund'],
    ['Fenerbahçe Istanbul', 'FEN', 'Türkei', 'Süper Lig', '#ffed00', '#00296b', 75, 'schraeg', 'schild'],
    ['Besiktas Istanbul', 'BJK', 'Türkei', 'Süper Lig', '#000000', '#ffffff', 71, 'streifen', 'rund'],
    ['Olympiakos Piräus', 'OLY', 'Griechenland', 'Super League', '#e2001a', '#ffffff', 68, 'streifen', 'wappen'],
    ['Roter Stern Belgrad', 'CZV', 'Serbien', 'SuperLiga', '#e2001a', '#ffffff', 66, 'streifen', 'schild'],
    ['Dinamo Zagreb', 'DIN', 'Kroatien', '1. HNL', '#0a55a0', '#ffffff', 66, 'voll', 'rund'],
    ['Slavia Prag', 'SLA', 'Tschechien', 'Fortuna Liga', '#e2001a', '#ffffff', 65, 'halb', 'wappen'],
    ['Legia Warschau', 'LEG', 'Polen', 'Ekstraklasa', '#00713c', '#ffffff', 63, 'voll', 'schild'],
    ['FC Kopenhagen', 'FCK', 'Dänemark', 'Superliga', '#ffffff', '#0a55a0', 66, 'halb', 'sechseck'],
    ['FC Brøndby', 'BIF', 'Dänemark', 'Superliga', '#f7c600', '#0a55a0', 60, 'streifen', 'rund'],

    /* Amerika / Asien */
    ['CR Flamengo', 'FLA', 'Brasilien', 'Série A', '#e2001a', '#000000', 79, 'streifen', 'rund'],
    ['SE Palmeiras', 'PAL', 'Brasilien', 'Série A', '#00954c', '#ffffff', 78, 'voll', 'schild'],
    ['FC São Paulo', 'SAO', 'Brasilien', 'Série A', '#e2001a', '#000000', 74, 'balken', 'wappen'],
    ['SC Corinthians', 'COR', 'Brasilien', 'Série A', '#ffffff', '#000000', 74, 'voll', 'rund'],
    ['CA Boca Juniors', 'BOC', 'Argentinien', 'Liga Profesional', '#0a3c8c', '#f7c600', 75, 'balken', 'schild'],
    ['CA River Plate', 'RIV', 'Argentinien', 'Liga Profesional', '#ffffff', '#e2001a', 76, 'schraeg', 'rund'],
    ['CF Monterrey', 'MTY', 'Mexiko', 'Liga MX', '#00274c', '#ffffff', 68, 'streifen', 'schild'],
    ['Inter Miami CF', 'MIA', 'USA', 'MLS', '#f7b5cd', '#000000', 70, 'voll', 'rund'],
    ['LAFC', 'LAF', 'USA', 'MLS', '#000000', '#c39e6d', 68, 'voll', 'sechseck'],
    ['Al-Hilal', 'HIL', 'Saudi-Arabien', 'Saudi Pro League', '#0a55a0', '#ffffff', 79, 'voll', 'rund'],
    ['Al-Nassr', 'NAS', 'Saudi-Arabien', 'Saudi Pro League', '#f7c600', '#0a55a0', 77, 'halb', 'schild'],
    ['Al-Ittihad', 'ITT', 'Saudi-Arabien', 'Saudi Pro League', '#f7c600', '#000000', 76, 'streifen', 'wappen'],
    ['Al-Ahli Jeddah', 'AHL', 'Saudi-Arabien', 'Saudi Pro League', '#00713c', '#ffffff', 74, 'voll', 'rund']
  ];

  var CLUBS = I.map(function (a, i) {
    return {
      id: 'i' + i, name: a[0], kurz: a[1], land: a[2], wettbewerb: a[3],
      c1: a[4], c2: a[5], ruf: a[6], muster: a[7], form: a[8],
      international: true, stadt: a[2]
    };
  });

  g.DataIntl = { CLUBS: CLUBS };
})(typeof window !== 'undefined' ? window : globalThis);
