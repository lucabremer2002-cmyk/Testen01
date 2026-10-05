/* Aufstellungs-KI: beste Elf je Formation, Bank, Formationswahl. */
(function () {
  'use strict';
  var FM = window.FM;

  var SLOT_PRIORITY = { GK: 0, CB: 1, ST: 2, CDM: 3, LB: 4, RB: 4, CM: 5, CAM: 6, LW: 7, RW: 7, LM: 8, RM: 8 };

  FM.clubPlayers = function (state, clubId) {
    var out = [];
    var ids = state.clubs[clubId].squad;
    for (var i = 0; i < ids.length; i++) { var p = state.players[ids[i]]; if (p) out.push(p); }
    return out;
  };

  /* Beste Besetzung einer Formation (gierig + Tauschverbesserung) */
  FM.assignFormation = function (players, formation, opts) {
    opts = opts || {};
    var slots = FM.FORMATIONS[formation];
    var avail = players.filter(function (p) { return FM.isAvailable(p) && (!opts.exclude || !opts.exclude[p.id]); });
    var order = slots.map(function (s, i) { return i; }).sort(function (a, b) { return SLOT_PRIORITY[slots[a][0]] - SLOT_PRIORITY[slots[b][0]]; });
    var used = {}, assign = new Array(slots.length);
    function val(p, pos) {
      var v = FM.effectiveRating(p, pos);
      if (opts.rest && p.fit < 75) v -= (75 - p.fit) * 0.4;
      return v;
    }
    order.forEach(function (si) {
      var pos = slots[si][0], best = null, bv = -999;
      for (var i = 0; i < avail.length; i++) {
        var p = avail[i]; if (used[p.id]) continue;
        var v = val(p, pos);
        if (v > bv) { bv = v; best = p; }
      }
      if (best) { used[best.id] = 1; assign[si] = best; }
    });
    // Tauschverbesserung
    for (var pass = 0; pass < 2; pass++) {
      for (var a = 0; a < slots.length; a++) {
        for (var b = a + 1; b < slots.length; b++) {
          var pa = assign[a], pb = assign[b]; if (!pa || !pb) continue;
          var cur = val(pa, slots[a][0]) + val(pb, slots[b][0]);
          var sw = val(pb, slots[a][0]) + val(pa, slots[b][0]);
          if (sw > cur + 0.01) { assign[a] = pb; assign[b] = pa; }
        }
      }
    }
    var total = 0;
    var res = slots.map(function (s, i) {
      var p = assign[i];
      if (p) total += val(p, s[0]);
      return { pos: s[0], pid: p ? p.id : null };
    });
    return { formation: formation, slots: res, total: total };
  };

  FM.pickBench = function (players, slots, size) {
    size = size || 9;
    var inXI = {};
    slots.forEach(function (s) { if (s.pid) inXI[s.pid] = 1; });
    var rest = players.filter(function (p) { return !inXI[p.id] && FM.isAvailable(p); })
      .sort(function (a, b) { return FM.effectiveRating(b) - FM.effectiveRating(a); });
    var bench = [];
    var gk = rest.filter(FM.isGK)[0];
    if (gk) bench.push(gk.id);
    var groups = { DEF: 0, MID: 0, ATT: 0 };
    rest.forEach(function (p) {
      if (bench.length >= size || FM.isGK(p) || bench.indexOf(p.id) >= 0) return;
      var g = FM.mainGroup(p);
      if (groups[g] >= 4) return;
      groups[g]++; bench.push(p.id);
    });
    rest.forEach(function (p) { if (bench.length < size && bench.indexOf(p.id) < 0 && !FM.isGK(p)) bench.push(p.id); });
    return bench;
  };

  var FORMATION_BIAS = { '4-2-3-1': 1.2, '4-3-3': 1, '4-4-2': 0.8, '4-1-4-1': 0.4, '4-4-2 Raute': 0, '3-5-2': 0, '3-4-3': 0.2, '5-3-2': -0.8 };
  FM.bestFormation = function (players, preferred) {
    var best = null;
    FM.FORMATION_KEYS.forEach(function (f) {
      var a = FM.assignFormation(players, f);
      var score = a.total + (f === preferred ? 3 : 0) + (FORMATION_BIAS[f] || 0) * 2.5;
      if (!best || score > best.score) best = { f: f, score: score };
    });
    return best.f;
  };

  /* Komplette Aufstellung fuer ein KI-Team */
  FM.aiLineup = function (state, clubId) {
    var club = state.clubs[clubId];
    var players = FM.clubPlayers(state, clubId);
    if (!club.formation) club.formation = FM.bestFormation(players);
    var a = FM.assignFormation(players, club.formation, { rest: true });
    if (a.slots.some(function (s) { return !s.pid; })) {
      // Notfall: andere Formation probieren
      FM.FORMATION_KEYS.some(function (f) {
        var b = FM.assignFormation(players, f, { rest: true });
        if (!b.slots.some(function (s) { return !s.pid; })) { a = b; return true; }
        return false;
      });
    }
    var slots = a.slots.filter(function (s) { return s.pid; });
    return {
      club: clubId,
      formation: a.formation,
      tactics: club.tactics || FM.defaultTactics(),
      slots: slots,
      bench: FM.pickBench(players, slots, 9),
      ai: true
    };
  };

  /* Aufstellung des Spielers pruefen/ergaenzen (verletzte/gesperrte ersetzen) */
  FM.userLineup = function (state) {
    var club = state.clubs[state.user.club];
    var players = FM.clubPlayers(state, club.id);
    var lu = club.lineup;
    if (!lu || !lu.slots || lu.slots.length !== FM.FORMATIONS[lu.formation].length) {
      lu = club.lineup = FM.autoLineup(state, club.id, club.lineup ? club.lineup.formation : null);
    }
    var used = {};
    var slots = lu.slots.map(function (s) {
      var p = s.pid && state.players[s.pid];
      if (p && p.club === club.id && FM.isAvailable(p) && !used[p.id]) { used[p.id] = 1; return { pos: s.pos, pid: s.pid }; }
      return { pos: s.pos, pid: null };
    });
    slots.forEach(function (s) {
      if (s.pid) return;
      var best = null, bv = -999;
      players.forEach(function (p) {
        if (used[p.id] || !FM.isAvailable(p)) return;
        var v = FM.effectiveRating(p, s.pos);
        if (v > bv) { bv = v; best = p; }
      });
      if (best) { used[best.id] = 1; s.pid = best.id; }
    });
    var bench = (lu.bench || []).filter(function (pid) {
      var p = state.players[pid];
      return p && p.club === club.id && FM.isAvailable(p) && !used[pid];
    });
    var benchSet = {};
    bench.forEach(function (b) { benchSet[b] = 1; used[b] = 1; });
    if (bench.length < 9) {
      var extra = FM.pickBench(players.filter(function (p) { return !used[p.id]; }), [], 9 - bench.length);
      bench = bench.concat(extra);
    }
    return {
      club: club.id,
      formation: lu.formation,
      tactics: Object.assign(FM.defaultTactics(), club.tactics || {}),
      slots: slots.filter(function (s) { return s.pid; }),
      bench: bench.slice(0, 9),
      ai: false
    };
  };

  FM.autoLineup = function (state, clubId, formation) {
    var players = FM.clubPlayers(state, clubId);
    var f = formation || FM.bestFormation(players);
    var a = FM.assignFormation(players, f);
    return { formation: f, slots: a.slots.map(function (s) { return { pos: s.pos, pid: s.pid }; }), bench: FM.pickBench(players, a.slots, 9) };
  };

  /* Staerke-Kennzahl eines Kaders (Durchschnitt der besten Elf) */
  FM.teamStrength = function (state, clubId) {
    var players = FM.clubPlayers(state, clubId).filter(function (p) { return !p.injury; });
    var top = players.slice().sort(function (a, b) { return b.ovr - a.ovr; });
    var gk = top.filter(FM.isGK)[0];
    var field = top.filter(function (p) { return !FM.isGK(p); }).slice(0, 10);
    var arr = field.map(function (p) { return p.ovr; });
    if (gk) arr.push(gk.ovr);
    return arr.length ? FM.avg(arr) : 0;
  };
})();
