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
     poly      Umriss auf der Karte (Prozent der 100x100-Flaeche)
  */
  var DISTRICTS = [
    {
      id: 'oldtown', name: 'Old Town', short: 'Old Town', tier: 1, entry: 0, rank: 0,
      econ: 0.80, lawEye: 0.70, pop: 128000,
      tag: 'Cheap ground, patient money',
      desc: 'Boarded shopfronts and cash-only bars. Nobody important is watching, ' +
            'which is exactly why every empire in Blackhaven started here.',
      poly: '6,44 27,38 34,55 30,72 10,74',
      label: [19, 56]
    },
    {
      id: 'industrial', name: 'Industrial District', short: 'Industrial', tier: 1, entry: 12000, rank: 1,
      econ: 1.00, lawEye: 0.85, pop: 61000,
      tag: 'Warehouses, trucks, no questions',
      desc: 'Rail spurs, cold storage and forklifts running at 3am. Anything that ' +
            'needs to move through Blackhaven moves through here first.',
      poly: '30,72 34,55 56,58 58,80 34,86',
      label: [44, 71]
    },
    {
      id: 'redlight', name: 'Red Light District', short: 'Red Light', tier: 2, entry: 26000, rank: 1,
      econ: 1.30, lawEye: 1.15, pop: 44000,
      tag: 'Loud nights, louder money',
      desc: 'Six blocks of neon that never sleep. Cash comes in fast and dirty, ' +
            'and so does everyone who wants a cut of it.',
      poly: '27,38 30,22 50,18 56,36 34,55',
      label: [39, 33]
    },
    {
      id: 'harbor', name: 'Harbor', short: 'Harbor', tier: 3, entry: 55000, rank: 2,
      econ: 1.45, lawEye: 1.30, pop: 29000,
      tag: 'Containers, customs, consequences',
      desc: 'Cranes and manifest fraud. The most valuable freight in the state ' +
            'passes through Pier 9, and every crate has a price.',
      poly: '58,80 56,58 82,54 94,70 88,90 60,92',
      label: [73, 74]
    },
    {
      id: 'downtown', name: 'Downtown', short: 'Downtown', tier: 3, entry: 80000, rank: 3,
      econ: 1.75, lawEye: 1.55, pop: 212000,
      tag: 'Glass towers, sharp teeth',
      desc: 'Banks, boardrooms and a police precinct with a budget. The richest ' +
            'square mile in Blackhaven, and the hardest to hold.',
      poly: '56,36 50,18 74,10 90,26 82,54 56,58',
      label: [70, 34]
    },
    {
      id: 'suburbs', name: 'Suburbs', short: 'Suburbs', tier: 2, entry: 40000, rank: 2,
      econ: 1.15, lawEye: 0.95, pop: 186000,
      tag: 'Quiet streets, deep pockets',
      desc: 'Lawns, minivans and second mortgages. Low risk, slow burn, and the ' +
            'only place in the city where respectability is worth real money.',
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
    { id: 'diner', name: 'Corner Restaurant', legal: true, cost: 6000, income: 1250,
      upkeep: 340, rep: 0, staff: 1, infl: 0.5, launder: 1.1, tier: 1, icon: 'diner',
      blurb: 'Twelve tables and a fryer. It will never make you rich, but the books are clean and the register is real.' },
    { id: 'garage', name: 'Auto Garage', legal: true, cost: 11000, income: 1850,
      upkeep: 620, rep: 4, staff: 1, infl: 0.7, launder: 1.2, tier: 1, icon: 'garage',
      perk: 'driver', blurb: 'Lifts, plates and a back bay nobody signs into. Drivers on your crew work cheaper out of here.' },
    { id: 'club', name: 'Nightclub', legal: true, cost: 21000, income: 3400,
      upkeep: 1150, rep: 12, staff: 2, infl: 1.4, launder: 1.35, tier: 2, icon: 'club',
      perk: 'rep', blurb: 'A door list, a VIP floor and a cash bar. People see you here, and being seen is its own currency.' },
    { id: 'dealership', name: 'Car Dealership', legal: true, cost: 30000, income: 4600,
      upkeep: 1500, rep: 18, staff: 2, infl: 1.2, launder: 1.5, tier: 2, icon: 'car',
      blurb: 'High ticket, low volume, generous paperwork. The single best place in the city to explain where money came from.' },
    { id: 'logistics', name: 'Logistics Company', legal: true, cost: 44000, income: 6200,
      upkeep: 2100, rep: 24, staff: 3, infl: 1.8, launder: 1.3, tier: 2, icon: 'truck',
      perk: 'smuggle', blurb: 'Eighteen trucks and a dispatcher who does not ask. Every smuggling operation you own runs richer.' },
    { id: 'construction', name: 'Construction Company', legal: true, cost: 58000, income: 7400,
      upkeep: 2600, rep: 30, staff: 3, infl: 3.2, launder: 1.25, tier: 3, icon: 'crane',
      perk: 'influence', blurb: 'Permits, inspectors, city contracts. Concrete is how you buy a district without firing a shot.' },
    { id: 'hotel', name: 'Hotel', legal: true, cost: 88000, income: 11000,
      upkeep: 3900, rep: 40, staff: 4, infl: 2.4, launder: 1.6, tier: 3, icon: 'hotel',
      blurb: 'Ninety rooms, a ballroom and a laundry that runs all night. In every sense of the word.' },
    { id: 'casino', name: 'Casino', legal: true, cost: 165000, income: 21000,
      upkeep: 7200, rep: 55, staff: 5, infl: 3.6, launder: 2.0, tier: 3, icon: 'chips',
      perk: 'launder', blurb: 'A licensed floor, a private room and a cage that counts your money for you. The crown jewel of any clean portfolio.' },

    /* --- Untergrund ---------------------------------------------- */
    { id: 'market', name: 'Black-Market Network', legal: false, cost: 9500, income: 2450,
      upkeep: 430, heat: 2.2, rep: 0, staff: 1, infl: 1.0, tier: 1, icon: 'market',
      blurb: 'A phone list, three lock-ups and people who owe you. Small margins, no overhead, and the police have bigger problems.' },
    { id: 'gambling', name: 'Underground Gambling', legal: false, cost: 24000, income: 5600,
      upkeep: 950, heat: 3.2, rep: 8, staff: 2, infl: 1.6, tier: 1, icon: 'dice',
      blurb: 'A back room that moves every Thursday. The house edge is the purest income in this city.' },
    { id: 'contraband', name: 'Contraband Trading', legal: false, cost: 42000, income: 9800,
      upkeep: 1750, heat: 4.6, rep: 20, staff: 3, infl: 2.2, tier: 2, icon: 'crate',
      blurb: 'Untaxed goods by the pallet. Nobody gets hurt, everybody gets paid, and customs gets a story.' },
    { id: 'smuggling', name: 'Smuggling Operation', legal: false, cost: 72000, income: 16500,
      upkeep: 3100, heat: 6.4, rep: 32, staff: 4, infl: 3.0, tier: 3, icon: 'ship',
      blurb: 'Routes, drivers and a window in the manifest. The money is extraordinary and so is the exposure.' },
    { id: 'distribution', name: 'Illicit Distribution Network', legal: false, cost: 120000, income: 27000,
      upkeep: 5200, heat: 8.6, rep: 46, staff: 5, infl: 4.2, tier: 3, icon: 'web',
      blurb: 'Every corner in the district reporting to one ledger. The most profitable thing you can own, and the loudest.' }
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
    { id: 'boss', name: 'You', pay: 0, icon: 'boss',
      desc: 'The person whose name is on nothing and behind everything.',
      slot: 'org', strength: 7, opBonus: 0.04, fixed: true },
    { id: 'operator', name: 'Business Operator', pay: 420, icon: 'operator',
      desc: 'Runs a single business day to day. Adds income wherever you post them.',
      slot: 'business', incomeMul: 0.055 },
    { id: 'manager', name: 'Manager', pay: 780, icon: 'manager',
      desc: 'Oversees a business properly. Strong income boost, and cuts its upkeep.',
      slot: 'business', incomeMul: 0.085, upkeepMul: -0.035 },
    { id: 'enforcer', name: 'Enforcer', pay: 560, icon: 'enforcer',
      desc: 'Muscle. Raises organisation strength and protects your operations.',
      slot: 'org', strength: 9, opBonus: 0.05 },
    { id: 'accountant', name: 'Accountant', pay: 700, icon: 'accountant',
      desc: 'Cuts organisation-wide expenses and widens your laundering capacity.',
      slot: 'org', expenseCut: 0.035, launder: 2600 },
    { id: 'lawyer', name: 'Lawyer', pay: 950, icon: 'lawyer',
      desc: 'Bleeds off police attention every week and softens every fine.',
      slot: 'org', heatCut: 1.1, fineCut: 0.06 },
    { id: 'driver', name: 'Driver', pay: 430, icon: 'driver',
      desc: 'Fast hands on the wheel. Shortens operations and improves their odds.',
      slot: 'org', opSpeed: 0.09, opBonus: 0.04 },
    { id: 'informant', name: 'Informant', pay: 510, icon: 'informant',
      desc: 'Ears in the precinct and on the street. Warns you before raids and reads rivals.',
      slot: 'org', heatCut: 0.45, intel: 1, opBonus: 0.03 },
    { id: 'security', name: 'Security Specialist', pay: 640, icon: 'security',
      desc: 'Locks down your holdings. Cuts sabotage risk and lowers heat from underground work.',
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
    { id: 'loyal', name: 'Loyal', good: true, desc: 'Loyalty decays far more slowly.', loyaltyDecay: -0.55 },
    { id: 'greedy', name: 'Greedy', good: false, desc: 'Expects more money than they are worth.', payMul: 0.3, loyaltyDecay: 0.35 },
    { id: 'ambitious', name: 'Ambitious', good: null, desc: 'Learns fast, but resents standing still.', xpMul: 0.6, loyaltyDecay: 0.3 },
    { id: 'discreet', name: 'Discreet', good: true, desc: 'Draws less attention. Cuts heat wherever they work.', heat: -0.35 },
    { id: 'reckless', name: 'Reckless', good: false, desc: 'Gets results and gets noticed.', heat: 0.5, opBonus: 0.05 },
    { id: 'connected', name: 'Connected', good: true, desc: 'Knows everyone. Better odds on operations.', opBonus: 0.08 },
    { id: 'veteran', name: 'Veteran', good: true, desc: 'Has done this for twenty years. Higher skill ceiling.', skillCap: 2 },
    { id: 'green', name: 'Green', good: false, desc: 'New to all of this. Cheap, and it shows.', payMul: -0.3, xpMul: 0.4 },
    { id: 'ruthless', name: 'Ruthless', good: null, desc: 'Frightening in a useful way. More strength, less reputation.', strength: 5, rep: -0.04 },
    { id: 'charming', name: 'Charming', good: true, desc: 'People like them. Small reputation gain every week.', rep: 0.06 },
    { id: 'gambler', name: 'Gambler', good: false, desc: 'Occasionally loses your money on something stupid.', gambler: true },
    { id: 'meticulous', name: 'Meticulous', good: true, desc: 'Nothing slips. Cuts upkeep wherever they are posted.', upkeepMul: -0.04 }
  ];

  /* ----------------------------------------------------------- Rivalen

     agg     wie oft sie gegen den Spieler vorgehen
     greed   wie schnell sie expandieren
     home    Bezirke, in denen sie stark starten
  */
  var RIVALS = [
    {
      id: 'saldana', name: 'The Saldana Combine', leader: 'Rosa Saldaña',
      color: '#c2410c', agg: 0.35, greed: 0.85, cash: 180000, strength: 62,
      style: 'Corporate', home: { downtown: 34, harbor: 22, redlight: 12 },
      desc: 'Runs the underworld like a holding company. Saldaña buys what she cannot ' +
            'out-compete and has never once raised her voice in a negotiation.'
    },
    {
      id: 'kingsley', name: 'Kingsley Crew', leader: 'Marcus "Deacon" Kingsley',
      color: '#b91c1c', agg: 0.72, greed: 0.5, cash: 90000, strength: 88,
      style: 'Territorial', home: { oldtown: 30, industrial: 28 },
      desc: 'Three generations on the same eight blocks. Deacon does not expand so ' +
            'much as refuse to leave, and he takes newcomers personally.'
    },
    {
      id: 'vance', name: 'The Vance Group', leader: 'Adrian Vance',
      color: '#7c3aed', agg: 0.28, greed: 0.7, cash: 240000, strength: 44,
      style: 'Political', home: { suburbs: 32, downtown: 20, redlight: 16 },
      desc: 'Half the zoning board owes him a favour. Vance never touches anything ' +
            'illegal himself, which is why nothing ever sticks to him.'
    },
    {
      id: 'halcones', name: 'Los Halcones', leader: 'Nina Ruiz',
      color: '#0891b2', agg: 0.55, greed: 0.95, cash: 120000, strength: 70,
      style: 'Opportunist', home: { harbor: 30, industrial: 18, redlight: 20 },
      desc: 'Came up on the water and still thinks like it: fast, mobile, and gone ' +
            'before anyone files a report. Ruiz takes whatever is unguarded.'
    }
  ];

  /* ------------------------------------------------------------ Raenge */

  var RANKS = [
    { name: 'Unknown', at: 0, blurb: 'Nobody in this city knows your name.' },
    { name: 'Street Operator', at: 32, blurb: 'You are a name on a short list.' },
    { name: 'Local Figure', at: 95, blurb: 'People in two districts take your calls.' },
    { name: 'Organization Leader', at: 210, blurb: 'You employ more people than most small firms.' },
    { name: 'Crime Boss', at: 400, blurb: 'The other families schedule around you.' },
    { name: 'Underworld Legend', at: 640, blurb: 'Blackhaven is yours in everything but name.' }
  ];

  /* -------------------------------------------- Organisationsausbauten

     Dauerhafte Kaeufe mit drei Stufen. cost/upkeep gelten je Stufe.
  */
  var ORG_UPGRADES = [
    { id: 'safehouse', name: 'Safe House', icon: 'house', max: 3,
      cost: [8000, 26000, 70000], upkeep: [150, 400, 900],
      desc: 'Somewhere for your people to be that is not their own address.',
      effect: 'Crew capacity +3 per level', crewCap: 3 },
    { id: 'retainer', name: 'Legal Retainer', icon: 'scales', max: 3,
      cost: [14000, 42000, 105000], upkeep: [600, 1500, 3400],
      desc: 'A firm on call, whatever the hour and whatever the charge.',
      effect: 'Heat -1.2/week and fines -12% per level', heatCut: 1.2, fineCut: 0.12 },
    { id: 'laundry', name: 'Laundering Chain', icon: 'wash', max: 3,
      cost: [18000, 55000, 140000], upkeep: [450, 1200, 2800],
      desc: 'Shell companies, invoices and a bookkeeper who sleeps fine.',
      effect: 'Laundering capacity +$9,000/week per level', launder: 9000 },
    { id: 'lookouts', name: 'Lookout Network', icon: 'eye', max: 3,
      cost: [11000, 34000, 88000], upkeep: [380, 950, 2200],
      desc: 'Kids on corners, valets, a dispatcher with a scanner.',
      effect: 'Underground heat -14% and raid risk -20% per level', heatMul: 0.14, raidCut: 0.20 },
    { id: 'fleet', name: 'Vehicle Fleet', icon: 'fleet', max: 3,
      cost: [16000, 48000, 120000], upkeep: [520, 1400, 3100],
      desc: 'Vans, plates and a body shop that works nights.',
      effect: 'Operations 15% faster and +6% success per level', opSpeed: 0.15, opBonus: 0.06 },
    { id: 'recruiting', name: 'Recruiting Pipeline', icon: 'net', max: 3,
      cost: [13000, 38000, 95000], upkeep: [340, 880, 2000],
      desc: 'People who find people. Better names reach you first.',
      effect: 'Recruits +1 skill and +8 loyalty per level', recruitSkill: 1, recruitLoyal: 8 }
  ];

  /* ------------------------------------------------------------ Erfolge

     check(state, derived) laeuft nach jeder Woche und nach jeder Aktion.
  */
  var ACHIEVEMENTS = [
    { id: 'first_business', name: 'First Business', desc: 'Own your first business.',
      check: function (s) { return s.businesses.length >= 1; } },
    { id: 'first_crew', name: 'Made Men', desc: 'Recruit three people.',
      check: function (s) { return s.crew.length >= 3; } },
    { id: 'hundred_k', name: 'First 100,000', desc: 'Hold $100,000 in cash.',
      check: function (s) { return s.cash >= 100000; } },
    { id: 'first_district', name: 'First District', desc: 'Take majority influence in any district.',
      check: function (s) { for (var k in s.districts) if (s.districts[k].mine >= 50) return true; return false; } },
    { id: 'five_biz', name: 'Portfolio', desc: 'Own five businesses at once.',
      check: function (s) { return s.businesses.length >= 5; } },
    { id: 'clean_hands', name: 'Clean Hands', desc: 'Reach week 20 with heat below 10.',
      check: function (s) { return s.day >= 140 && s.heat < 10; } },
    { id: 'first_alliance', name: 'Understanding', desc: 'Form an alliance with a rival.',
      check: function (s) { for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i].allied) return true; return false; } },
    { id: 'millionaire', name: 'Millionaire', desc: 'Reach a net worth of $1,000,000.',
      check: function (s, d) { return d.netWorth >= 1000000; } },
    { id: 'boss', name: 'Crime Boss', desc: 'Reach the rank of Crime Boss.',
      check: function (s, d) { return d.rank >= 4; } },
    { id: 'citywide', name: 'Citywide Influence', desc: 'Hold presence in all six districts.',
      check: function (s) { var n = 0; for (var k in s.districts) if (s.districts[k].open) n++; return n >= 6; } },
    { id: 'kingmaker', name: 'Kingmaker', desc: 'Drive a rival below 10 total influence.',
      check: function (s, d) {
        for (var i = 0; i < s.rivals.length; i++) if (d.rivalInfluence[s.rivals[i].id] < 10) return true;
        return false; } },
    { id: 'empire', name: 'Empire Builder', desc: 'Own twelve businesses at once.',
      check: function (s) { return s.businesses.length >= 12; } },
    { id: 'untouchable', name: 'Untouchable', desc: 'Survive a raid attempt with nothing lost.',
      check: function (s) { return !!s.flags.survivedRaid; } },
    { id: 'legend', name: 'Underworld Legend', desc: 'Reach the highest rank.',
      check: function (s, d) { return d.rank >= 5; } }
  ];

  /* ------------------------------------------------------- Operationen

     Vorlagen fuer Auftraege. payout/days werden mit dem Bezirks-Tier
     skaliert (siehe ops.js). risk = Grundwahrscheinlichkeit zu scheitern.
  */
  var OPS = [
    { id: 'collect', name: 'Collection Run', days: 2, pay: 1200, risk: 0.28, heat: 0.6, rep: 1, infl: 1.2, crew: 1,
      desc: 'Three addresses, one afternoon, money that is already owed to somebody.' },
    { id: 'protect', name: 'Protection Arrangement', days: 3, pay: 1650, risk: 0.32, heat: 1.0, rep: 1, infl: 2.4, crew: 1,
      desc: 'Shopkeepers on this block start paying somebody. It may as well be you.' },
    { id: 'fence', name: 'Fence a Shipment', days: 3, pay: 2100, risk: 0.36, heat: 1.6, rep: 0, infl: 0.8, crew: 1,
      desc: 'Somebody else stole it. You just know who will buy it and for how much.' },
    { id: 'courier', name: 'Courier Job', days: 2, pay: 1400, risk: 0.26, heat: 0.9, rep: 0, infl: 0.6, crew: 1,
      desc: 'A package crosses the city without ever touching a scanner.' },
    { id: 'contract', name: 'City Contract Fix', days: 5, pay: 3200, risk: 0.42, heat: 1.2, rep: 3, infl: 4.0, crew: 2,
      desc: 'A bid opens, a bid closes, and the right envelope arrives in between.' },
    { id: 'raid', name: 'Muscle a Rival Corner', days: 4, pay: 2600, risk: 0.44, heat: 2.4, rep: 2, infl: 5.0, crew: 2,
      hostile: true, desc: 'Somebody else is earning on your street. That ends this week.' },
    { id: 'launder', name: 'Wash a Windfall', days: 4, pay: 2800, risk: 0.28, heat: -1.4, rep: 0, infl: 0.4, crew: 1,
      desc: 'Dirty money goes into a business you trust and comes out boring.' },
    { id: 'smugrun', name: 'Night Freight', days: 5, pay: 4200, risk: 0.44, heat: 2.8, rep: 2, infl: 2.0, crew: 2,
      desc: 'One truck, one window in the schedule, nobody on the loading dock.' },
    { id: 'blackmail', name: 'Leverage an Official', days: 6, pay: 3800, risk: 0.40, heat: -0.8, rep: 1, infl: 5.5, crew: 2,
      desc: 'Everyone in this city has a photograph they would rather you did not own.' }
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
