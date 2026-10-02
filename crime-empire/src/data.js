/* ---------------------------------------------------------------------
   Alle Inhalte an einem Ort: Bezirke, Betriebe, Rollen, Rivalen, Raenge,
   Ausbauten, Erfolge.

   Reine Daten, keine Logik. Wer balanciert, aendert nur diese Datei -
   deshalb steht hinter jeder Zahl, was sie im Spiel bedeutet.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};

  /* ---------------------------------------------------------- Bezirke

     tier      1-3, bestimmt Preise, Ertraege und Schwierigkeit
     entry     Eintrittsgeld, um dort ueberhaupt Fuss zu fassen
     rank      benoetigter Rang (Index in RANKS)
     econ      Wirtschaftskraft, Faktor auf alle Ertraege im Bezirk
     lawEye    Polizeipraesenz, Faktor auf die Hitze aus diesem Bezirk
     nom/akk/dat  Name mit Artikel. Deutsche Saetze brauchen ihn:
               "Du bist in der Altstadt", nicht "in Altstadt".
     wo/wohin  Ort und Richtung samt Praeposition, schon verschmolzen:
               "im Hafen", "ins Rotlichtviertel". Wer "in " davor
               setzt, bekommt "in dem Hafen" - deshalb steckt die
               Praeposition hier mit drin.
     poly      Umriss auf der Karte (Prozent der 100x100-Flaeche)
  */
  var DISTRICTS = [
    {
      id: 'oldtown', name: 'Altstadt', short: 'Altstadt', nom: 'Die Altstadt', akk: 'die Altstadt', dat: 'der Altstadt',
      wo: 'in der Altstadt', wohin: 'in die Altstadt', tier: 1, entry: 0, rank: 0,
      econ: 0.80, lawEye: 0.70, pop: 128000,
      tag: 'Billiger Boden, geduldiges Geld',
      desc: 'Vernagelte Schaufenster und Kneipen, die nur Bargeld nehmen. Hier schaut ' +
            'niemand Wichtiges hin, und genau deshalb hat hier jedes Imperium von Blackhaven angefangen.',
      poly: '6,44 27,38 34,55 30,72 10,74',
      label: [19, 56]
    },
    {
      id: 'industrial', name: 'Industriegebiet', short: 'Industrie', nom: 'Das Industriegebiet', akk: 'das Industriegebiet', dat: 'dem Industriegebiet',
      wo: 'im Industriegebiet', wohin: 'ins Industriegebiet', tier: 1, entry: 12000, rank: 1,
      econ: 1.00, lawEye: 0.85, pop: 61000,
      tag: 'Lagerhallen, Lastwagen, keine Fragen',
      desc: 'Gleisanschluss, Kühlhaus und Gabelstapler um drei Uhr nachts. Was sich durch ' +
            'Blackhaven bewegen muss, bewegt sich zuerst hier durch.',
      poly: '30,72 34,55 56,58 58,80 34,86',
      label: [44, 71]
    },
    {
      id: 'redlight', name: 'Rotlichtviertel', short: 'Rotlicht', nom: 'Das Rotlichtviertel', akk: 'das Rotlichtviertel', dat: 'dem Rotlichtviertel',
      wo: 'im Rotlichtviertel', wohin: 'ins Rotlichtviertel', tier: 2, entry: 26000, rank: 1,
      econ: 1.30, lawEye: 1.15, pop: 44000,
      tag: 'Laute Nächte, lauteres Geld',
      desc: 'Sechs Straßenzüge Neon, die nie schlafen. Das Geld kommt schnell und schmutzig ' +
            'herein, und alle, die einen Anteil wollen, kommen genauso.',
      poly: '27,38 30,22 50,18 56,36 34,55',
      label: [39, 33]
    },
    {
      id: 'harbor', name: 'Hafen', short: 'Hafen', nom: 'Der Hafen', akk: 'den Hafen', dat: 'dem Hafen',
      wo: 'im Hafen', wohin: 'in den Hafen', tier: 3, entry: 55000, rank: 2,
      econ: 1.45, lawEye: 1.30, pop: 29000,
      tag: 'Container, Zoll, Konsequenzen',
      desc: 'Kräne und gefälschte Frachtpapiere. Die wertvollste Ladung des Bundesstaates ' +
            'läuft über Pier 9, und jede Kiste hat ihren Preis.',
      poly: '58,80 56,58 82,54 94,70 88,90 60,92',
      label: [73, 74]
    },
    {
      id: 'downtown', name: 'Innenstadt', short: 'Innenstadt', nom: 'Die Innenstadt', akk: 'die Innenstadt', dat: 'der Innenstadt',
      wo: 'in der Innenstadt', wohin: 'in die Innenstadt', tier: 3, entry: 80000, rank: 3,
      econ: 1.75, lawEye: 1.55, pop: 212000,
      tag: 'Glastürme, scharfe Zähne',
      desc: 'Banken, Vorstandsetagen und ein Polizeirevier mit Budget. Der reichste ' +
            'Quadratkilometer von Blackhaven, und der am schwersten zu haltende.',
      poly: '56,36 50,18 74,10 90,26 82,54 56,58',
      label: [70, 34]
    },
    {
      id: 'suburbs', name: 'Vororte', short: 'Vororte', nom: 'Die Vororte', akk: 'die Vororte', dat: 'den Vororten',
      wo: 'in den Vororten', wohin: 'in die Vororte', tier: 2, entry: 40000, rank: 2,
      econ: 1.15, lawEye: 0.95, pop: 186000,
      tag: 'Ruhige Straßen, tiefe Taschen',
      desc: 'Rasenflächen, Familienkombis und zweite Hypotheken. Wenig Risiko, langsames Geld, ' +
            'und der einzige Ort der Stadt, an dem Ansehen echtes Geld wert ist.',
      poly: '10,74 30,72 34,86 26,96 6,92',
      label: [19, 84]
    }
  ];

  /* ---------------------------------------------------------- Betriebe

     cost      Kaufpreis auf Stufe 1 (wird mit econ des Bezirks skaliert)
     income    Bruttoertrag je Woche, Stufe 1
     upkeep    laufende Kosten je Woche, Stufe 1
     heat      Hitze je Woche (nur Untergrund)
     rep       benoetigtes Ansehen
     staff     Arbeitsplaetze - jeder besetzte Platz erhoeht den Ertrag
     infl      Einfluss je Woche im Bezirk
     launder   Waschkapazitaet (nur legale Betriebe), siehe economy.js
     perk      Sonderwirkung, in economy.js ausgewertet
  */
  var BUSINESSES = [
    /* --- legal --------------------------------------------------- */
    { id: 'diner', name: 'Eckrestaurant', legal: true, cost: 6000, income: 1250,
      upkeep: 340, rep: 0, staff: 1, infl: 0.5, launder: 1.1, tier: 1, icon: 'diner',
      blurb: 'Zwölf Tische und eine Fritteuse. Reich wird man damit nie, aber die Bücher sind sauber und die Kasse ist echt.' },
    { id: 'garage', name: 'Autowerkstatt', legal: true, cost: 11000, income: 1850,
      upkeep: 620, rep: 4, staff: 1, infl: 0.7, launder: 1.2, tier: 1, icon: 'garage',
      perk: 'driver', blurb: 'Hebebühnen, Kennzeichen und eine hintere Box, in die sich niemand einträgt. Fahrer in deiner Crew arbeiten von hier aus günstiger.' },
    { id: 'club', name: 'Nachtclub', legal: true, cost: 21000, income: 3400,
      upkeep: 1150, rep: 12, staff: 2, infl: 1.4, launder: 1.35, tier: 2, icon: 'club',
      perk: 'rep', blurb: 'Eine Gästeliste, ein VIP-Bereich und eine Bar, die nur Bargeld nimmt. Hier sieht man dich, und gesehen zu werden ist eine eigene Währung.' },
    { id: 'dealership', name: 'Autohaus', legal: true, cost: 30000, income: 4600,
      upkeep: 1500, rep: 18, staff: 2, infl: 1.2, launder: 1.5, tier: 2, icon: 'car',
      blurb: 'Hohe Preise, wenig Stück, großzügige Papiere. Der beste Ort der Stadt, um zu erklären, woher Geld stammt.' },
    { id: 'logistics', name: 'Spedition', legal: true, cost: 44000, income: 6200,
      upkeep: 2100, rep: 24, staff: 3, infl: 1.8, launder: 1.3, tier: 2, icon: 'truck',
      perk: 'smuggle', blurb: 'Achtzehn Lastwagen und ein Disponent, der nicht fragt. Jeder Schmuggelbetrieb in deinem Besitz wirft mehr ab.' },
    { id: 'construction', name: 'Baufirma', legal: true, cost: 58000, income: 7400,
      upkeep: 2600, rep: 30, staff: 3, infl: 3.2, launder: 1.25, tier: 3, icon: 'crane',
      perk: 'influence', blurb: 'Genehmigungen, Prüfer, Aufträge der Stadt. Mit Beton kauft man einen Bezirk, ohne einen Schuss abzugeben.' },
    { id: 'hotel', name: 'Hotel', legal: true, cost: 88000, income: 11000,
      upkeep: 3900, rep: 40, staff: 4, infl: 2.4, launder: 1.6, tier: 3, icon: 'hotel',
      blurb: 'Neunzig Zimmer, ein Ballsaal und eine Wäscherei, die die ganze Nacht läuft. In jeder Bedeutung des Wortes.' },
    { id: 'casino', name: 'Casino', legal: true, cost: 165000, income: 21000,
      upkeep: 7200, rep: 55, staff: 5, infl: 3.6, launder: 2.0, tier: 3, icon: 'chips',
      perk: 'launder', blurb: 'Ein konzessionierter Saal, ein Separee und eine Kasse, die dein Geld für dich zählt. Das Schmuckstück jedes sauberen Besitzes.' },

    /* --- Untergrund ---------------------------------------------- */
    { id: 'market', name: 'Schwarzmarkt-Netz', legal: false, cost: 9500, income: 2450,
      upkeep: 430, heat: 2.2, rep: 0, staff: 1, infl: 1.0, tier: 1, icon: 'market',
      blurb: 'Eine Telefonliste, drei Garagen und Leute, die dir etwas schulden. Kleine Margen, keine Fixkosten, und die Polizei hat größere Sorgen.' },
    { id: 'gambling', name: 'Illegales Glücksspiel', legal: false, cost: 24000, income: 5600,
      upkeep: 950, heat: 3.2, rep: 8, staff: 2, infl: 1.6, tier: 1, icon: 'dice',
      blurb: 'Ein Hinterzimmer, das jeden Donnerstag umzieht. Der Hausvorteil ist das sauberste Einkommen dieser Stadt.' },
    { id: 'contraband', name: 'Schmuggelwarenhandel', legal: false, cost: 42000, income: 9800,
      upkeep: 1750, heat: 4.6, rep: 20, staff: 3, infl: 2.2, tier: 2, icon: 'crate',
      blurb: 'Unversteuerte Ware palettenweise. Niemand kommt zu Schaden, alle werden bezahlt, und der Zoll bekommt eine Geschichte.' },
    { id: 'smuggling', name: 'Schmuggelbetrieb', legal: false, cost: 72000, income: 16500,
      upkeep: 3100, heat: 6.4, rep: 32, staff: 4, infl: 3.0, tier: 3, icon: 'ship',
      blurb: 'Routen, Fahrer und eine Lücke in den Papieren. Das Geld ist außergewöhnlich, das Risiko auch.' },
    { id: 'distribution', name: 'Illegales Vertriebsnetz', legal: false, cost: 120000, income: 27000,
      upkeep: 5200, heat: 8.6, rep: 46, staff: 5, infl: 4.2, tier: 3, icon: 'web',
      blurb: 'Jede Ecke des Bezirks meldet in dasselbe Buch. Das Ertragreichste, was man besitzen kann, und das Lauteste.' }
  ];

  /* Ausbaustufen: Faktor auf Ertrag, Kosten, Hitze und Einfluss.
     Der Preis einer Stufe ist ein Vielfaches des Kaufpreises. */
  var UPGRADE = {
    max: 5,
    /* Index 0 = Stufe 1 */
    income:  [1.00, 1.45, 1.95, 2.55, 3.25],
    upkeep:  [1.00, 1.30, 1.65, 2.05, 2.50],
    heat:    [1.00, 1.15, 1.32, 1.50, 1.70],
    infl:    [1.00, 1.35, 1.75, 2.20, 2.70],
    staff:   [0, 1, 1, 2, 2],           /* zusaetzliche Arbeitsplaetze */
    priceMul:[0, 0.85, 1.35, 2.10, 3.20]/* Preis der Stufe, x Kaufpreis */
  };

  /* ----------------------------------------------------------- Rollen

     bonus: was die Rolle im Betrieb oder in der Organisation bewirkt.
     Die Auswertung steht in economy.js bzw. ops.js - hier nur die Werte.
  */
  var ROLES = [
    { id: 'boss', name: 'Du', pay: 0, icon: 'boss',
      desc: 'Die Person, deren Name auf nichts steht und hinter allem.',
      slot: 'org', strength: 7, opBonus: 0.04, fixed: true },
    { id: 'operator', name: 'Betriebsleiter', pay: 420, icon: 'operator',
      desc: 'Führt einen Betrieb im Alltag. Bringt zusätzlichen Ertrag, wo immer du ihn einsetzt.',
      slot: 'business', incomeMul: 0.055 },
    { id: 'manager', name: 'Geschäftsführer', pay: 780, icon: 'manager',
      desc: 'Führt einen Betrieb richtig. Deutlich mehr Ertrag und geringere laufende Kosten.',
      slot: 'business', incomeMul: 0.085, upkeepMul: -0.035 },
    { id: 'enforcer', name: 'Vollstrecker', pay: 560, icon: 'enforcer',
      desc: 'Muskeln. Erhöht die Stärke der Organisation und schützt deine Operationen.',
      slot: 'org', strength: 9, opBonus: 0.05 },
    { id: 'accountant', name: 'Buchhalter', pay: 700, icon: 'accountant',
      desc: 'Senkt die Ausgaben der ganzen Organisation und erweitert deine Waschkapazität.',
      slot: 'org', expenseCut: 0.035, launder: 2600 },
    { id: 'lawyer', name: 'Anwalt', pay: 950, icon: 'lawyer',
      desc: 'Nimmt jede Woche Aufmerksamkeit der Polizei weg und mildert jede Geldstrafe.',
      slot: 'org', heatCut: 1.1, fineCut: 0.06 },
    { id: 'driver', name: 'Fahrer', pay: 430, icon: 'driver',
      desc: 'Schnelle Hände am Lenkrad. Verkürzt Operationen und verbessert ihre Aussichten.',
      slot: 'org', opSpeed: 0.09, opBonus: 0.04 },
    { id: 'informant', name: 'Informant', pay: 510, icon: 'informant',
      desc: 'Ohren im Revier und auf der Straße. Warnt vor Razzien und durchschaut Rivalen.',
      slot: 'org', heatCut: 0.45, intel: 1, opBonus: 0.03 },
    { id: 'security', name: 'Sicherheitsexperte', pay: 640, icon: 'security',
      desc: 'Sichert deinen Besitz. Senkt die Sabotagegefahr und die Hitze aus Untergrundgeschäften.',
      slot: 'org', sabotageCut: 0.10, heatMul: -0.05, strength: 4 }
  ];

  /* ------------------------------------------------- Namen und Zuege */

  var FIRST = ['Marcus', 'Elena', 'Dimitri', 'Rosa', 'Tobias', 'Nadia', 'Victor', 'Camille',
    'Omar', 'Bianca', 'Sean', 'Yuki', 'Andre', 'Petra', 'Jonah', 'Alicia', 'Ruben', 'Freya',
    'Cato', 'Mira', 'Desmond', 'Lena', 'Hugo', 'Saskia', 'Malik', 'Iris', 'Dario', 'Noor',
    'Emmett', 'Vera', 'Kwame', 'Sofia', 'Levi', 'Dana', 'Rafael', 'Inge', 'Casper', 'Rhea'];
  var LAST = ['Kovac', 'Mbeki', 'Ferraro', 'Okonkwo', 'Lindqvist', 'Basara', 'Duval', 'Reyes',
    'Novak', 'Achebe', 'Moreau', 'Strand', 'Vasquez', 'Halloran', 'Petrov', 'Nakamura',
    'Baumann', 'Oyelaran', 'Castellan', 'Ibarra', 'Whitlock', 'Draganov', 'Fontaine',
    'Bergström', 'Adeyemi', 'Salvatore', 'Kettler', 'Marchetti', 'Ashworth', 'Lund'];
  var NICK = ['Ghost', 'Paper', 'Sunday', 'Nickel', 'Cold Hands', 'Deacon', 'Slim', 'Porcelain',
    'Two-Time', 'The Clock', 'Quiet', 'Bishop', 'Flint', 'Halo', 'Copper', 'Rook'];

  /* Eigenschaften. mods greifen in employees.js und economy.js. */
  var TRAITS = [
    { id: 'loyal', name: 'Loyal', good: true, desc: 'Die Loyalität sinkt viel langsamer.', loyaltyDecay: -0.55 },
    { id: 'greedy', name: 'Gierig', good: false, desc: 'Verlangt mehr Geld, als die Person wert ist.', payMul: 0.3, loyaltyDecay: 0.35 },
    { id: 'ambitious', name: 'Ehrgeizig', good: null, desc: 'Lernt schnell, hält Stillstand aber nicht aus.', xpMul: 0.6, loyaltyDecay: 0.3 },
    { id: 'discreet', name: 'Diskret', good: true, desc: 'Fällt weniger auf. Senkt die Hitze überall, wo die Person arbeitet.', heat: -0.35 },
    { id: 'reckless', name: 'Leichtsinnig', good: false, desc: 'Liefert Ergebnisse und fällt auf.', heat: 0.5, opBonus: 0.05 },
    { id: 'connected', name: 'Vernetzt', good: true, desc: 'Kennt jeden. Bessere Aussichten bei Operationen.', opBonus: 0.08 },
    { id: 'veteran', name: 'Veteran', good: true, desc: 'Macht das seit zwanzig Jahren. Höhere Könnensgrenze.', skillCap: 2 },
    { id: 'green', name: 'Unerfahren', good: false, desc: 'Neu in alldem. Billig, und man merkt es.', payMul: -0.3, xpMul: 0.4 },
    { id: 'ruthless', name: 'Skrupellos', good: null, desc: 'Auf nützliche Weise furchteinflößend. Mehr Stärke, weniger Ansehen.', strength: 5, rep: -0.04 },
    { id: 'charming', name: 'Charmant', good: true, desc: 'Die Leute mögen die Person. Jede Woche etwas Ansehen.', rep: 0.06 },
    { id: 'gambler', name: 'Zocker', good: false, desc: 'Verliert dein Geld gelegentlich an etwas Dummes.', gambler: true },
    { id: 'meticulous', name: 'Gewissenhaft', good: true, desc: 'Nichts geht durch. Senkt die laufenden Kosten am Einsatzort.', upkeepMul: -0.04 }
  ];

  /* ----------------------------------------------------------- Rivalen

     agg     wie oft sie gegen den Spieler vorgehen
     greed   wie schnell sie expandieren
     home    Bezirke, in denen sie stark starten
  */
  var RIVALS = [
    {
      id: 'saldana', name: 'Das Saldaña-Konsortium', leader: 'Rosa Saldaña',
      color: '#c2410c', agg: 0.35, greed: 0.85, cash: 180000, strength: 62,
      style: 'Konzernartig', home: { downtown: 34, harbor: 22, redlight: 12 },
      desc: 'Führt die Unterwelt wie eine Holding. Saldaña kauft, was sie nicht ausstechen ' +
            'kann, und hat in einer Verhandlung noch nie die Stimme erhoben.'
    },
    {
      id: 'kingsley', name: 'Die Kingsley-Crew', leader: 'Marcus "Deacon" Kingsley',
      color: '#b91c1c', agg: 0.72, greed: 0.5, cash: 90000, strength: 88,
      style: 'Revierbezogen', home: { oldtown: 30, industrial: 28 },
      desc: 'Drei Generationen in denselben acht Straßenzügen. Deacon dehnt sich weniger aus, ' +
            'als dass er sich weigert zu gehen, und Neuankömmlinge nimmt er persönlich.'
    },
    {
      id: 'vance', name: 'Die Vance-Gruppe', leader: 'Adrian Vance',
      color: '#7c3aed', agg: 0.28, greed: 0.7, cash: 240000, strength: 44,
      style: 'Politisch', home: { suburbs: 32, downtown: 20, redlight: 16 },
      desc: 'Das halbe Bauamt schuldet ihm einen Gefallen. Vance fasst nie selbst etwas ' +
            'Illegales an, und deshalb bleibt an ihm nie etwas hängen.'
    },
    {
      id: 'halcones', name: 'Los Halcones', leader: 'Nina Ruiz',
      color: '#0891b2', agg: 0.55, greed: 0.95, cash: 120000, strength: 70,
      style: 'Opportunistisch', home: { harbor: 30, industrial: 18, redlight: 20 },
      desc: 'Groß geworden auf dem Wasser und denkt immer noch so: schnell, beweglich und weg, ' +
            'bevor jemand Anzeige erstattet. Ruiz nimmt alles, was unbewacht ist.'
    }
  ];

  /* ------------------------------------------------------------ Raenge */

  var RANKS = [
    { name: 'Unbekannt', at: 0, blurb: 'Niemand in dieser Stadt kennt deinen Namen.' },
    { name: 'Straßenkrimineller', at: 32, blurb: 'Du bist ein Name auf einer kurzen Liste.' },
    { name: 'Lokale Größe', at: 95, blurb: 'In zwei Bezirken nimmt man deine Anrufe an.' },
    { name: 'Organisationschef', at: 210, blurb: 'Du beschäftigst mehr Leute als die meisten kleinen Firmen.' },
    { name: 'Unterweltboss', at: 400, blurb: 'Die anderen Familien richten ihre Pläne nach dir.' },
    { name: 'Legende der Unterwelt', at: 640, blurb: 'Blackhaven gehört dir in allem außer dem Namen.' }
  ];

  /* -------------------------------------------- Organisationsausbauten

     Dauerhafte Kaeufe mit drei Stufen. cost/upkeep gelten je Stufe.
  */
  var ORG_UPGRADES = [
    { id: 'safehouse', name: 'Unterschlupf', icon: 'house', max: 3,
      cost: [8000, 26000, 70000], upkeep: [150, 400, 900],
      desc: 'Ein Ort für deine Leute, der nicht ihre eigene Adresse ist.',
      effect: 'Crew-Plätze +3 je Stufe', crewCap: 3 },
    { id: 'retainer', name: 'Anwalt auf Abruf', icon: 'scales', max: 3,
      cost: [14000, 42000, 105000], upkeep: [600, 1500, 3400],
      desc: 'Eine Kanzlei in Bereitschaft, zu jeder Stunde und bei jedem Vorwurf.',
      effect: 'Hitze -1,2/Woche und Geldstrafen -12% je Stufe', heatCut: 1.2, fineCut: 0.12 },
    { id: 'laundry', name: 'Waschkette', icon: 'wash', max: 3,
      cost: [18000, 55000, 140000], upkeep: [450, 1200, 2800],
      desc: 'Briefkastenfirmen, Rechnungen und ein Buchhalter, der gut schläft.',
      effect: 'Waschkapazität +$9.000/Woche je Stufe', launder: 9000 },
    { id: 'lookouts', name: 'Späher-Netz', icon: 'eye', max: 3,
      cost: [11000, 34000, 88000], upkeep: [380, 950, 2200],
      desc: 'Kinder an Ecken, Parkwächter, ein Disponent mit Funkscanner.',
      effect: 'Untergrund-Hitze -14% und Razziarisiko -20% je Stufe', heatMul: 0.14, raidCut: 0.20 },
    { id: 'fleet', name: 'Fuhrpark', icon: 'fleet', max: 3,
      cost: [16000, 48000, 120000], upkeep: [520, 1400, 3100],
      desc: 'Transporter, Kennzeichen und eine Karosseriewerkstatt mit Nachtschicht.',
      effect: 'Operationen 15% schneller und +6% Erfolg je Stufe', opSpeed: 0.15, opBonus: 0.06 },
    { id: 'recruiting', name: 'Rekrutierungsnetz', icon: 'net', max: 3,
      cost: [13000, 38000, 95000], upkeep: [340, 880, 2000],
      desc: 'Leute, die Leute finden. Bessere Namen erreichen zuerst dich.',
      effect: 'Neuzugänge +1 Können und +8 Loyalität je Stufe', recruitSkill: 1, recruitLoyal: 8 }
  ];

  /* ------------------------------------------------------------ Erfolge

     check(state, derived) laeuft nach jeder Woche und nach jeder Aktion.
  */
  var ACHIEVEMENTS = [
    { id: 'first_business', name: 'Erster Betrieb', desc: 'Besitze deinen ersten Betrieb.',
      check: function (s) { return s.businesses.length >= 1; } },
    { id: 'first_crew', name: 'Eine Mannschaft', desc: 'Stelle drei Leute ein.',
      check: function (s) { return s.crew.length >= 3; } },
    { id: 'hundred_k', name: 'Die ersten 100.000', desc: 'Halte $100.000 in bar.',
      check: function (s) { return s.cash >= 100000; } },
    { id: 'first_district', name: 'Erster Bezirk', desc: 'Erreiche in einem Bezirk die Mehrheit an Einfluss.',
      check: function (s) { for (var k in s.districts) if (s.districts[k].mine >= 50) return true; return false; } },
    { id: 'five_biz', name: 'Portfolio', desc: 'Besitze fünf Betriebe gleichzeitig.',
      check: function (s) { return s.businesses.length >= 5; } },
    { id: 'clean_hands', name: 'Saubere Hände', desc: 'Erreiche Woche 20 mit einer Hitze unter 10.',
      check: function (s) { return s.day >= 140 && s.heat < 10; } },
    { id: 'first_alliance', name: 'Verständigung', desc: 'Schließe ein Bündnis mit einem Rivalen.',
      check: function (s) { for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i].allied) return true; return false; } },
    { id: 'millionaire', name: 'Millionär', desc: 'Erreiche ein Vermögen von $1.000.000.',
      check: function (s, d) { return d.netWorth >= 1000000; } },
    { id: 'boss', name: 'Unterweltboss', desc: 'Erreiche den Rang Unterweltboss.',
      check: function (s, d) { return d.rank >= 4; } },
    { id: 'citywide', name: 'Stadtweiter Einfluss', desc: 'Sei in allen sechs Bezirken präsent.',
      check: function (s) { var n = 0; for (var k in s.districts) if (s.districts[k].open) n++; return n >= 6; } },
    { id: 'kingmaker', name: 'Königsmacher', desc: 'Drücke einen Rivalen unter 10 Gesamteinfluss.',
      check: function (s, d) {
        for (var i = 0; i < s.rivals.length; i++) if (d.rivalInfluence[s.rivals[i].id] < 10) return true;
        return false; } },
    { id: 'empire', name: 'Imperiumsbauer', desc: 'Besitze zwölf Betriebe gleichzeitig.',
      check: function (s) { return s.businesses.length >= 12; } },
    { id: 'untouchable', name: 'Unantastbar', desc: 'Überstehe eine Razzia ohne jeden Verlust.',
      check: function (s) { return !!s.flags.survivedRaid; } },
    { id: 'legend', name: 'Legende der Unterwelt', desc: 'Erreiche den höchsten Rang.',
      check: function (s, d) { return d.rank >= 5; } },

    /* --- Spaetspiel -------------------------------------------------
       Ziele fuer die Zeit nach der Stadt. Ohne sie endete das Spiel mit
       dem Sieg und lief nur noch weiter. */
    { id: 'case_closed', name: 'Akte geschlossen', desc: 'Drücke ein Bundesverfahren auf null zurück, nachdem es die Anklagekammer erreicht hatte.',
      check: function (s) { return !!(s.flags && s.flags.caseBeaten); } },
    { id: 'model_citizen', name: 'Musterbürger', desc: 'Bringe alle sechs Bezirke gleichzeitig zum Boomen.',
      check: function (s) {
        var n = 0;
        for (var k in s.districts) { if (s.districts[k].open && s.districts[k].state === 'booming') n++; }
        return n >= 6;
      } },
    { id: 'old_friends', name: 'Alte Freunde', desc: 'Bringe die Geschichte einer Person mit über 50 Vertrauen zu Ende.',
      check: function (s) {
        if (!s.people) return false;
        for (var k in s.people) { if (s.people[k].done && s.people[k].trust > 50) return true; }
        return false;
      } },
    { id: 'untouchable_two', name: 'Nichts bleibt hängen', desc: 'Überstehe eine Bundesanklage und baue die volle Kontrolle wieder auf.',
      check: function (s, d) {
        if (!s.flags || !s.flags.indicted) return false;
        var n = 0;
        for (var k in s.districts) if (s.districts[k].open && s.districts[k].mine >= 60) n++;
        return n >= 6;
      } }
  ];

  /* ------------------------------------------------------- Operationen

     Vorlagen fuer Auftraege. payout/days werden mit dem Bezirks-Tier
     skaliert (siehe ops.js). risk = Grundwahrscheinlichkeit zu scheitern.
  */
  var OPS = [
    { id: 'collect', name: 'Inkassotour', days: 2, pay: 1200, risk: 0.28, heat: 0.6, rep: 1, infl: 1.2, crew: 1,
      desc: 'Drei Adressen, ein Nachmittag, Geld, das ohnehin jemandem geschuldet wird.' },
    { id: 'protect', name: 'Schutzabmachung', days: 3, pay: 1650, risk: 0.32, heat: 1.0, rep: 1, infl: 2.4, crew: 1,
      desc: 'Die Ladenbesitzer dieses Blocks zahlen demnächst an jemanden. Warum nicht an dich.' },
    { id: 'fence', name: 'Ware verschieben', days: 3, pay: 2100, risk: 0.36, heat: 1.6, rep: 0, infl: 0.8, crew: 1,
      desc: 'Gestohlen hat sie jemand anderes. Du weißt nur, wer sie kauft und zu welchem Preis.' },
    { id: 'courier', name: 'Kurierfahrt', days: 2, pay: 1400, risk: 0.26, heat: 0.9, rep: 0, infl: 0.6, crew: 1,
      desc: 'Ein Paket durchquert die Stadt, ohne je einen Scanner zu berühren.' },
    { id: 'contract', name: 'Auftrag der Stadt schieben', days: 5, pay: 3200, risk: 0.42, heat: 1.2, rep: 3, infl: 4.0, crew: 2,
      desc: 'Eine Ausschreibung öffnet, eine Ausschreibung schließt, und dazwischen kommt der richtige Umschlag an.' },
    { id: 'raid', name: 'Ecke eines Rivalen übernehmen', days: 4, pay: 2600, risk: 0.44, heat: 2.4, rep: 2, infl: 5.0, crew: 2,
      hostile: true, desc: 'Jemand anderes verdient in deiner Straße. Das endet diese Woche.' },
    { id: 'launder', name: 'Geldsegen waschen', days: 4, pay: 2800, risk: 0.28, heat: -1.4, rep: 0, infl: 0.4, crew: 1,
      desc: 'Schmutziges Geld geht in einen Betrieb, dem du traust, und kommt langweilig wieder heraus.' },
    { id: 'smugrun', name: 'Nachtfracht', days: 5, pay: 4200, risk: 0.44, heat: 2.8, rep: 2, infl: 2.0, crew: 2,
      desc: 'Ein Lastwagen, eine Lücke im Fahrplan, niemand an der Laderampe.' },
    { id: 'blackmail', name: 'Beamten in der Hand haben', days: 6, pay: 3800, risk: 0.40, heat: -0.8, rep: 1, infl: 5.5, crew: 2,
      desc: 'Jeder in dieser Stadt hat ein Foto, das er lieber nicht in deinem Besitz wüsste.' }
  ];

  CE.data = {
    DISTRICTS: DISTRICTS, BUSINESSES: BUSINESSES, UPGRADE: UPGRADE, ROLES: ROLES,
    FIRST: FIRST, LAST: LAST, NICK: NICK, TRAITS: TRAITS, RIVALS: RIVALS,
    RANKS: RANKS, ORG_UPGRADES: ORG_UPGRADES, ACHIEVEMENTS: ACHIEVEMENTS, OPS: OPS,
    byId: function (list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
