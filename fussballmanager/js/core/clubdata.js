/* Echte Vereinsdaten: Fanbasis und Zuschauer, TV-Geld nach DFL-Schluessel, Schulden,
   Gesellschafter, Derbys und Geduld des Umfelds. Grundlage: data-src/profiles.py */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  var LEVEL = { bl: 1, bl2: 2, l3: 3, rl: 4 };
  FM.KIND_LABEL = { tradition: 'Traditionsverein', works: 'Werksklub', investor: 'Investorenklub', cult: 'Kultklub', youth: 'Ausbildungsverein', reserve: 'Zweite Mannschaft' };

  /* Zuschauer-Effekt eines Ligawechsels (pro Ligastufe) */
  function leagueShift(from, to) {
    var d = (LEVEL[from] || 3) - (LEVEL[to] || 3);   // > 0: Aufstieg
    return d > 0 ? Math.pow(1.12, d) : d < 0 ? Math.pow(0.82, -d) : 1;
  }

  FM.initClubProfile = function (club, data) {
    var pr = (data && data.profile) || {};
    club.prof = {
      founded: pr.founded || null, nick: pr.nick || '', kind: pr.kind || [], nlz: pr.nlz || 3,
      att: pr.att || null, attL: pr.attL || club.league, tvReal: pr.tv || null, pay: pr.pay || null
    };
    club.rivals = pr.rivals || [];
    club.pat = pr.pat || 1;
    club.owner = (pr.owner || 0) * 1e6;
    club.debt = (pr.debt || 0) * 1e6;
    club.debt0 = club.debt;
    // Fanbasis: echter Schnitt, auf die aktuelle Liga umgerechnet; ausverkaufte Stadien haben mehr Nachfrage
    var att = pr.att || Math.round(club.cap * 0.5);
    var fans = att * leagueShift(pr.attL || club.league, club.league);
    if (att >= club.cap * 0.96) fans = Math.max(fans, club.cap * 1.12);
    club.fans = Math.round(fans);
  };

  /* ---------- Zuschauer ---------- */
  FM.expectedDemand = function (club) { return club.fans || club.cap * 0.6; };

  FM.attendanceFor = function (state, c, a, comp, date) {
    var cap = FM.effectiveCap ? FM.effectiveCap(c) : c.cap;
    var demand = FM.expectedDemand(c);
    var f = 1 + ((a.rep || 60) - 60) / 300;                  // attraktive Gaeste ziehen mehr Fans
    if (FM.isDerby(state, c.id, a.id)) f *= 1.15;
    if (comp === 'cup' || comp === 'po1' || comp === 'po2') f *= 1.1 + (LEVEL[a.league] < LEVEL[c.league] ? 0.15 : 0);
    var lid = c.league;
    if (FM.ZONES[lid] && comp === lid && FM.playedRounds(state, lid) >= 4) {
      var t = FM.table(state, lid), pos = t.findIndex(function (r) { return r.club === c.id; });
      if (pos >= 0) f *= 1.04 - 0.08 * pos / Math.max(1, t.length - 1);   // Tabellenspitze zieht, Keller drueckt
    }
    if (date && [2, 3].indexOf(D.weekday(date)) >= 0) f *= 0.92;       // Englische Woche
    f *= R.range(0.95, 1.05);
    return Math.round(FM.clamp(demand * f, 300, cap));
  };

  /* Fanbasis nach der Saison: Ligawechsel und Erfolg */
  FM.updateFans = function (club, oldLeague, pos, n) {
    var f = leagueShift(oldLeague, club.league);
    if (pos && n) {
      var rel = (pos - 1) / Math.max(1, n - 1);
      f *= 1.03 - 0.05 * rel;
      if (pos === 1) f *= 1.03;
    }
    if (club.prof && club.prof.kind.indexOf('cult') >= 0) f = 1 + (f - 1) * 0.5;      // treue Fans
    else if (club.prof && club.prof.kind.indexOf('tradition') >= 0 && f < 1) f = 1 + (f - 1) * 0.8;
    club.fans = Math.max(300, Math.round(club.fans * f));
  };

  /* ---------- TV-Geld nach DFL-Schluessel ----------
     Haelfte gleichmaessig, Rest nach einer Fuenfjahreswertung. 2026/27 gelten die veroeffentlichten Betraege. */
  var TV_POOL = { bl: { equal: 29.8e6, perf: 536e6 }, bl2: { equal: 6.84e6, perf: 123e6 } };
  var TV_FLAT = { l3: 1.5e6, rl: 0.2e6 };

  /* Startwerte der Wertung aus den echten Betraegen 2026/27 zurueckrechnen (Leistungsanteil ~ Wertung^3) */
  FM.initTvScores = function (state) {
    ['bl', 'bl2'].forEach(function (lid) {
      var cl = state.leagues[lid].clubs.map(function (id) { return state.clubs[id]; });
      var perf = cl.map(function (c) { return Math.max(0.1, (c.prof.tvReal || 0) - TV_POOL[lid].equal / 1e6); });
      var mx = Math.max.apply(null, perf);
      cl.forEach(function (c, i) {
        c.tvScore = (lid === 'bl' ? 36 : 26) * Math.pow(perf[i] / mx, 1 / 3);
      });
    });
    Object.keys(state.clubs).forEach(function (cid) { var c = state.clubs[cid]; if (c.tvScore == null) c.tvScore = 0; });
  };

  FM.assignTv = function (state) {
    var first = state.season.year === (window.FM_DATA && window.FM_DATA.startYear);
    ['bl', 'bl2'].forEach(function (lid) {
      var cl = state.leagues[lid].clubs.map(function (id) { return state.clubs[id]; });
      var w = function (c) { return Math.pow(c.tvScore || 0, 3); };
      var sum = FM.sum(cl, w) || 1;
      cl.forEach(function (c) {
        if (first && c.prof && c.prof.tvReal) c.tvCur = c.prof.tvReal * 1e6;
        else c.tvCur = Math.round(TV_POOL[lid].equal + TV_POOL[lid].perf * w(c) / sum);
      });
    });
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (TV_FLAT[c.league] != null) c.tvCur = TV_FLAT[c.league];
    });
  };

  /* Saisonwertung fuer die Fuenfjahrestabelle: BL-Platz 1 = 36 Punkte … 2. Liga Platz 18 = 1 Punkt */
  FM.updateTvScores = function (state, tables) {
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid], pts = 0;
      ['bl', 'bl2'].forEach(function (lid) {
        var t = tables[lid];
        if (!t) return;
        var i = t.findIndex(function (r) { return r.club === cid; });
        if (i >= 0) pts = lid === 'bl' ? 36 - i : 18 - i;
      });
      c.tvScore = 0.8 * (c.tvScore || 0) + 0.2 * pts;
    });
  };

  /* ---------- Schulden und Gesellschafter ---------- */
  FM.debtService = function (club) {
    if (!club.debt) return 0;
    return club.debt * 0.05 + Math.min(club.debt, (club.debt0 || club.debt) * 0.07);   // Zinsen + Tilgung p. a.
  };

  FM.payDebt = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!c.debt) return;
      var interest = c.debt * 0.05 / 12, repay = Math.min(c.debt, (c.debt0 || c.debt) * 0.07 / 12);
      FM.book(c, 'debt', -(interest + repay));
      c.debt = Math.max(0, c.debt - repay);
      if (!c.debt && cid === state.user.club) FM.addNews(state, { type: 'board', important: true, title: 'Schuldenfrei', body: c.name + ' hat die letzte Rate getilgt. Das Geld für Zins und Tilgung steht ab sofort für den Sport zur Verfügung.' });
    });
  };

  /* Konzern/Investor gleicht Verluste aus (Saisonende und Januar) */
  FM.ownerSupport = function (state) {
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (!c.owner) return;
      var reserve = FM.cashReserve(state, c);
      if (c.money >= reserve) return;
      var amount = Math.min(c.owner / 2, reserve - c.money + 2e6);
      FM.book(c, 'owner', amount);
      if (cid === state.user.club) {
        FM.addNews(state, { type: 'board', important: true, title: 'Gesellschafter gleicht aus', body: 'Der Gesellschafter von ' + c.name + ' schießt ' + FM.fmtMoney(amount) + ' nach, damit der Klub liquide bleibt. Darauf ist nicht unbegrenzt Verlass – höchstens ' + FM.fmtMoney(c.owner) + ' pro Jahr.' });
      }
    });
  };

  /* ---------- Derbys ---------- */
  FM.isDerby = function (state, a, b) {
    var ca = state.clubs[a], cb = state.clubs[b];
    if (!ca || !cb) return false;
    return (ca.rivals || []).indexOf(b) >= 0 || (cb.rivals || []).indexOf(a) >= 0;
  };
})();
