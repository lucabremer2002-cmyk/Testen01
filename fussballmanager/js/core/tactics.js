/* Positionen, Formationen und Positions-Eignung. */
(function () {
  'use strict';
  var FM = window.FM;

  FM.POS_ORDER = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'];

  FM.POS_LABEL = {
    GK: 'TW', CB: 'IV', LB: 'LV', RB: 'RV', CDM: 'ZDM', CM: 'ZM', CAM: 'ZOM',
    LM: 'LM', RM: 'RM', LW: 'LF', RW: 'RF', ST: 'ST'
  };
  FM.POS_NAME = {
    GK: 'Torwart', CB: 'Innenverteidiger', LB: 'Linksverteidiger', RB: 'Rechtsverteidiger',
    CDM: 'Defensives Mittelfeld', CM: 'Zentrales Mittelfeld', CAM: 'Offensives Mittelfeld',
    LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld', LW: 'Linksaußen', RW: 'Rechtsaußen', ST: 'Stürmer'
  };

  FM.posGroup = function (pos) {
    if (pos === 'GK') return 'GK';
    if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
    if (pos === 'ST' || pos === 'LW' || pos === 'RW') return 'ATT';
    return 'MID';
  };
  FM.GROUP_LABEL = { GK: 'Tor', DEF: 'Abwehr', MID: 'Mittelfeld', ATT: 'Angriff' };

  var PEN = {
    GK: { GK: 0 },
    CB: { CB: 0, CDM: 6, LB: 7, RB: 7, CM: 12 },
    LB: { LB: 0, RB: 4, LM: 5, CB: 7, LW: 9, CDM: 12, CM: 12 },
    RB: { RB: 0, LB: 4, RM: 5, CB: 7, RW: 9, CDM: 12, CM: 12 },
    CDM: { CDM: 0, CM: 2, CB: 6, CAM: 8, LB: 10, RB: 10 },
    CM: { CM: 0, CDM: 2, CAM: 3, LM: 6, RM: 6, LW: 9, RW: 9, LB: 12, RB: 12, CB: 12, ST: 12 },
    CAM: { CAM: 0, CM: 3, LW: 5, RW: 5, LM: 6, RM: 6, ST: 6, CDM: 8 },
    LM: { LM: 0, LW: 1, RM: 4, RW: 5, LB: 6, CAM: 6, CM: 7, ST: 9 },
    RM: { RM: 0, RW: 1, LM: 4, LW: 5, RB: 6, CAM: 6, CM: 7, ST: 9 },
    LW: { LW: 0, LM: 1, RW: 3, RM: 4, CAM: 5, ST: 6, LB: 12 },
    RW: { RW: 0, RM: 1, LW: 3, LM: 4, CAM: 5, ST: 6, RB: 12 },
    ST: { ST: 0, CAM: 6, LW: 6, RW: 6, LM: 9, RM: 9, CM: 12 }
  };

  /* Abzug auf die Staerke, wenn natPos-Spieler auf slotPos spielt */
  function pairPenalty(nat, slot) {
    if (nat === slot) return 0;
    if (nat === 'GK') return 40;
    if (slot === 'GK') return 45;
    var row = PEN[nat];
    if (row && row[slot] != null) return row[slot];
    return 18;
  }

  FM.positionPenalty = function (player, slotPos) {
    var best = 99;
    for (var i = 0; i < player.pos.length; i++) {
      var p = pairPenalty(player.pos[i], slotPos) + (i === 0 ? 0 : 1);
      if (p < best) best = p;
    }
    return best;
  };

  /* Formationen: Slots mit Position und Koordinaten (x links→rechts, y eigenes Tor→gegnerisches Tor) */
  FM.FORMATIONS = {
    '4-4-2': [
      ['GK', 50, 6], ['RB', 86, 25], ['CB', 62, 21], ['CB', 38, 21], ['LB', 14, 25],
      ['RM', 86, 54], ['CM', 62, 49], ['CM', 38, 49], ['LM', 14, 54], ['ST', 62, 80], ['ST', 38, 80]
    ],
    '4-3-3': [
      ['GK', 50, 6], ['RB', 86, 25], ['CB', 62, 21], ['CB', 38, 21], ['LB', 14, 25],
      ['CM', 70, 52], ['CDM', 50, 42], ['CM', 30, 52], ['RW', 82, 77], ['ST', 50, 84], ['LW', 18, 77]
    ],
    '4-2-3-1': [
      ['GK', 50, 6], ['RB', 86, 25], ['CB', 62, 21], ['CB', 38, 21], ['LB', 14, 25],
      ['CDM', 62, 41], ['CDM', 38, 41], ['RM', 84, 64], ['CAM', 50, 63], ['LM', 16, 64], ['ST', 50, 86]
    ],
    '4-1-4-1': [
      ['GK', 50, 6], ['RB', 86, 25], ['CB', 62, 21], ['CB', 38, 21], ['LB', 14, 25],
      ['CDM', 50, 38], ['RM', 86, 58], ['CM', 62, 55], ['CM', 38, 55], ['LM', 14, 58], ['ST', 50, 84]
    ],
    '4-4-2 Raute': [
      ['GK', 50, 6], ['RB', 86, 25], ['CB', 62, 21], ['CB', 38, 21], ['LB', 14, 25],
      ['CDM', 50, 38], ['CM', 72, 52], ['CM', 28, 52], ['CAM', 50, 66], ['ST', 62, 84], ['ST', 38, 84]
    ],
    '3-5-2': [
      ['GK', 50, 6], ['CB', 72, 22], ['CB', 50, 19], ['CB', 28, 22],
      ['RM', 88, 52], ['CDM', 62, 43], ['CDM', 38, 43], ['LM', 12, 52], ['CAM', 50, 64], ['ST', 62, 84], ['ST', 38, 84]
    ],
    '3-4-3': [
      ['GK', 50, 6], ['CB', 72, 22], ['CB', 50, 19], ['CB', 28, 22],
      ['RM', 86, 50], ['CM', 62, 47], ['CM', 38, 47], ['LM', 14, 50], ['RW', 80, 78], ['ST', 50, 84], ['LW', 20, 78]
    ],
    '5-3-2': [
      ['GK', 50, 6], ['RB', 90, 32], ['CB', 70, 20], ['CB', 50, 18], ['CB', 30, 20], ['LB', 10, 32],
      ['CM', 70, 52], ['CM', 50, 47], ['CM', 30, 52], ['ST', 62, 80], ['ST', 38, 80]
    ]
  };
  FM.FORMATION_KEYS = Object.keys(FM.FORMATIONS);

  /* Gewichtung der Slots fuer die Mannschaftsteile (Angriff / Mittelfeld / Abwehr) */
  FM.ROLE_WEIGHTS = {
    GK: { att: 0, mid: 0.05, def: 0.25 },
    CB: { att: 0.05, mid: 0.15, def: 1.0 },
    LB: { att: 0.25, mid: 0.35, def: 0.85 },
    RB: { att: 0.25, mid: 0.35, def: 0.85 },
    CDM: { att: 0.12, mid: 0.85, def: 0.7 },
    CM: { att: 0.3, mid: 1.0, def: 0.4 },
    CAM: { att: 0.65, mid: 0.8, def: 0.12 },
    LM: { att: 0.55, mid: 0.6, def: 0.3 },
    RM: { att: 0.55, mid: 0.6, def: 0.3 },
    LW: { att: 0.85, mid: 0.4, def: 0.12 },
    RW: { att: 0.85, mid: 0.4, def: 0.12 },
    ST: { att: 1.0, mid: 0.25, def: 0.05 }
  };

  /* Wahrscheinlichkeitsgewichte fuer Torschuetzen / Vorlagengeber je Slot */
  FM.SCORER_WEIGHT = { GK: 0, CB: 0.4, LB: 0.32, RB: 0.32, CDM: 0.5, CM: 0.85, CAM: 1.5, LM: 1.35, RM: 1.35, LW: 1.85, RW: 1.85, ST: 2.6 };
  FM.ASSIST_WEIGHT = { GK: 0.05, CB: 0.3, LB: 0.8, RB: 0.8, CDM: 0.6, CM: 1.2, CAM: 1.8, LM: 1.5, RM: 1.5, LW: 1.6, RW: 1.6, ST: 1.0 };

  FM.MENTALITY = [
    { id: -2, label: 'Sehr defensiv', att: -0.16, def: 0.13 },
    { id: -1, label: 'Defensiv', att: -0.07, def: 0.06 },
    { id: 0, label: 'Ausgewogen', att: 0, def: 0 },
    { id: 1, label: 'Offensiv', att: 0.07, def: -0.06 },
    { id: 2, label: 'Sehr offensiv', att: 0.15, def: -0.13 }
  ];
  FM.PRESSING = [
    { id: 0, label: 'Tief', mid: -0.03, def: 0.03, fatigue: 0.85 },
    { id: 1, label: 'Normal', mid: 0, def: 0, fatigue: 1 },
    { id: 2, label: 'Hoch', mid: 0.045, def: -0.02, fatigue: 1.25 }
  ];
  FM.TEMPO = [
    { id: 0, label: 'Ruhig', chances: 0.88, fatigue: 0.92 },
    { id: 1, label: 'Normal', chances: 1, fatigue: 1 },
    { id: 2, label: 'Schnell', chances: 1.12, fatigue: 1.12 }
  ];
  FM.defaultTactics = function () { return { mentality: 0, pressing: 1, tempo: 1 }; };
})();
