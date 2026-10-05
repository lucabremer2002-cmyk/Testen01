/* Spielstand: neues Spiel anlegen, Speichern/Laden. */
(function () {
  'use strict';
  var FM = window.FM;

  FM.SAVE_KEY = 'matchplan.save.';
  FM.SAVE_VERSION = 3;
  FM.MIN_SQUAD = 22;

  FM.leagueOf = function (state, clubId) { return state.leagues[state.clubs[clubId].league]; };

  FM.newGame = function (opts) {
    var data = window.FM_DATA;
    FM.rng.seed(opts.seed || (Date.now() >>> 0));
    var year = data.startYear;
    var state = {
      v: FM.SAVE_VERSION,
      created: Date.now(),
      user: { name: opts.manager || 'Trainer', club: opts.club, conf: 62, seasons: [], fired: false, firedCount: 0, joined: year },
      date: FM.date.iso(year, 7, 1),
      season: { year: year, phase: 'pre' },
      clubs: {},
      players: {},
      leagues: {},
      fixtures: {},
      calendar: [],
      news: [],
      free: [],
      transfers: [],
      offers: [],
      training: { focus: 'balanced', intensity: 1 },
      settings: { speed: 1 },
      fxSeq: 0
    };
    FM.state = state;

    data.leagues.forEach(function (l) { state.leagues[l.id] = { id: l.id, name: l.name, short: l.short, level: l.level, clubs: [] }; });

    data.clubs.forEach(function (c) {
      var club = {
        id: c.id, name: c.name, short: c.short, abbr: c.abbr, colors: c.colors, stadium: c.stadium, cap: c.cap,
        rep: c.rep, league: c.league, reserve: c.reserve || null,
        money: Math.round(c.money * 1e6),
        squad: [], formation: null, tactics: FM.defaultTactics(), lineup: null,
        hist: [], fin: FM.emptyLedger(), finPrev: null, expect: null
      };
      state.clubs[c.id] = club;
      state.leagues[c.league].clubs.push(c.id);
      var rows = data.players[c.id] || [];
      rows.forEach(function (row, i) {
        var p = FM.makePlayer(row, c.id, c.league, year, c.id + '_', i);
        state.players[p.id] = p;
        club.squad.push(p.id);
      });
    });

    Object.keys(state.clubs).forEach(function (cid) { FM.fillSquad(state, cid, true); });
    Object.keys(state.clubs).forEach(function (cid) { FM.calibrateCommercial(state, state.clubs[cid]); });
    Object.keys(state.clubs).forEach(function (cid) {
      var club = state.clubs[cid];
      club.formation = FM.bestFormation(FM.clubPlayers(state, cid));
    });
    var uc = state.clubs[opts.club];
    uc.lineup = FM.autoLineup(state, uc.id, uc.formation);
    uc.tactics = FM.defaultTactics();

    FM.startSeason(state, true);
    FM.addNews(state, {
      type: 'board', title: 'Willkommen beim ' + uc.name,
      body: 'Der Vorstand begrüßt dich als neuen Cheftrainer. ' + FM.expectationText(state, uc.id) +
        ' Das Transferfenster ist bis zum 31. August geöffnet – nutze die Vorbereitung, um den Kader zu schärfen.'
    });
    return state;
  };

  /* Kader auffuellen: mind. 2 Torhueter und MIN_SQUAD Spieler (Akademie-Nachwuchs) */
  FM.fillSquad = function (state, cid, initial) {
    var club = state.clubs[cid];
    var players = FM.clubPlayers(state, cid);
    var gks = players.filter(FM.isGK).length;
    var added = [];
    var min = club.league === 'rl' ? 20 : FM.MIN_SQUAD;
    while (gks < 2) { added.push(FM.makeYouth(club, state, { pos: 'GK', age: FM.rng.int(17, 19) })); gks++; }
    var need = min - players.length - added.length;
    for (var i = 0; i < need; i++) {
      var groups = { DEF: 0, MID: 0, ATT: 0 };
      players.concat(added).forEach(function (p) { if (!FM.isGK(p)) groups[FM.mainGroup(p)]++; });
      var g = groups.DEF < 7 ? 'DEF' : groups.MID < 7 ? 'MID' : groups.ATT < 4 ? 'ATT' : null;
      var pos = g === 'DEF' ? FM.rng.pick(['CB', 'CB', 'LB', 'RB']) : g === 'MID' ? FM.rng.pick(['CM', 'CDM', 'CAM', 'LM', 'RM']) : g === 'ATT' ? FM.rng.pick(['ST', 'LW', 'RW']) : null;
      added.push(FM.makeYouth(club, state, pos ? { pos: pos } : {}));
    }
    added.forEach(function (p) {
      state.players[p.id] = p;
      club.squad.push(p.id);
    });
    return added;
  };

  /* ---------- Speichern / Laden ---------- */
  FM.save = function (slot) {
    var state = FM.state;
    if (!state) return false;
    state.rng = FM.rng.state;
    state.saved = Date.now();
    try {
      var json = JSON.stringify(state, function (k, v) { return typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v; });
      var packed = window.LZString ? 'lz:' + window.LZString.compressToUTF16(json) : json;
      localStorage.setItem(FM.SAVE_KEY + (slot || 1), packed);
      var c = state.clubs[state.user.club];
      localStorage.setItem(FM.SAVE_KEY + 'meta.' + (slot || 1), JSON.stringify({ v: state.v, manager: state.user.name, club: c.name, clubId: c.id, colors: c.colors, abbr: c.abbr, date: state.date, season: state.season.year, saved: state.saved, league: c.league }));
      return true;
    } catch (e) {
      console.warn('Speichern fehlgeschlagen', e);
      return false;
    }
  };

  FM.load = function (slot) {
    try {
      var raw = localStorage.getItem(FM.SAVE_KEY + (slot || 1));
      if (!raw) return null;
      if (raw.slice(0, 3) === 'lz:') raw = window.LZString.decompressFromUTF16(raw.slice(3));
      var state = JSON.parse(raw);
      if (!state || state.v !== FM.SAVE_VERSION) return null;
      FM.state = state;
      if (state.rng) FM.rng.state = state.rng;
      FM.invalidateTables();
      return state;
    } catch (e) {
      console.warn('Laden fehlgeschlagen', e);
      return null;
    }
  };

  FM.saveInfo = function (slot) {
    try {
      if (!localStorage.getItem(FM.SAVE_KEY + (slot || 1))) return null;
      var meta = JSON.parse(localStorage.getItem(FM.SAVE_KEY + 'meta.' + (slot || 1)) || 'null');
      if (!meta || meta.v !== FM.SAVE_VERSION) return { incompatible: true };
      return meta;
    } catch (e) { return null; }
  };

  FM.deleteSave = function (slot) {
    try {
      localStorage.removeItem(FM.SAVE_KEY + (slot || 1));
      localStorage.removeItem(FM.SAVE_KEY + 'meta.' + (slot || 1));
    } catch (e) { /* ignorieren */ }
  };

  FM.exportSave = function () {
    var state = FM.state;
    state.rng = FM.rng.state;
    return new Blob([JSON.stringify(state)], { type: 'application/json' });
  };

  FM.importSave = function (text) {
    var s = JSON.parse(text);
    if (!s || s.v !== FM.SAVE_VERSION || !s.clubs || !s.players) throw new Error('Ungültige oder inkompatible Spielstanddatei.');
    FM.state = s;
    if (s.rng) FM.rng.state = s.rng;
    FM.invalidateTables();
    return s;
  };
})();
