/* Trainerkarriere: Ruf, Bilanz, Titel, Meilensteine, Fanstimmung, Ehrentafel –
   und der Trainermarkt: KI-Vereine entlassen erfolglose Trainer, freie Stellen und Angebote fuer den Spieler. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;
  var D = FM.date;

  var LEAGUES = ['bl', 'bl2', 'l3'];

  /* ---------- Ruf ---------- */
  FM.REP_LABEL = function (r) {
    return r >= 88 ? 'Weltklasse' : r >= 75 ? 'International gefragt' : r >= 60 ? 'Spitzentrainer' : r >= 45 ? 'Angesehen' : r >= 30 ? 'Etabliert' : r >= 15 ? 'Regional bekannt' : 'Unbeschriebenes Blatt';
  };
  /* Ruf, den ein Verein von seinem Trainer erwartet */
  FM.jobNeed = function (club) { return FM.clamp(Math.round((club.rep - 40) * 0.9 + 4), 0, 62); };
  function startRep(club) { return FM.clamp(Math.round((club.rep - 40) * 0.8 + 5), 5, 55); }

  function user(state) {
    var u = state.user;
    if (u.rep == null) u.rep = startRep(state.clubs[u.club]);
    u.rec = u.rec || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    u.titles = u.titles || [];
    u.ach = u.ach || {};
    u.run = u.run || { w: 0, u: 0, l: 0, bw: 0, bu: 0 };
    u.recs = u.recs || {};
    if (u.fans == null) u.fans = 60;
    return u;
  }
  FM.careerUser = user;

  /* ---------- Trainer der KI-Vereine ---------- */
  function coachName(state) {
    var taken = {};
    Object.keys(state.clubs).forEach(function (k) { var c = state.clubs[k].coach; if (c) taken[c.name] = 1; });
    return FM.randomName(taken);
  }
  function newCoach(state, club, date) {
    club.coach = { name: coachName(state), since: date || state.date, age: R.int(36, 61) };
    return club.coach;
  }
  FM.careerInit = function (state) {
    user(state);
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (c.guest || cid === state.user.club || c.coach) return;
      newCoach(state, c, D.iso(state.season.year - R.int(0, 3), 7, 1));
    });
    state.coachLog = state.coachLog || [];
    state.jobs = state.jobs || [];
    state.hist = state.hist || [];
  };

  function logCoach(state, club, out, inn, why) {
    state.coachLog.unshift({ date: state.date, club: club.id, out: out, inn: inn, why: why });
    if (state.coachLog.length > 40) state.coachLog.length = 40;
  }

  /* Neuer Trainer, neuer Schwung */
  function bounce(state, cid) {
    FM.clubPlayers(state, cid).forEach(function (p) { p.mor = FM.clamp(p.mor + 8, 5, 100); p.form = FM.clamp(p.form + 0.4, -3, 3); });
  }

  function appoint(state, club, why, prev) {
    var old = prev || (club.coach ? club.coach.name : null);
    var c = newCoach(state, club);
    bounce(state, club.id);
    logCoach(state, club, old, c.name, why);
    return c;
  }

  /* Darf der Verein dem Spieler die Stelle anbieten? Besserer Verein, passender Ruf, nicht der eigene. */
  function fitsUser(state, club) {
    var u = user(state), me = state.clubs[u.club];
    if (u.fired || club.id === u.club || club.reserve || club.guest) return false;
    if (state.jobs.some(function (j) { return j.club === club.id; })) return false;
    return u.rep >= FM.jobNeed(club) && (club.rep >= me.rep + 4 || FM.levelOf(state, club.id) < FM.levelOf(state, me.id));
  }

  function offerJob(state, club, days, text) {
    var j = { id: 'j' + (state.jobSeq = (state.jobSeq || 0) + 1), club: club.id, until: D.add(state.date, days) };
    state.jobs.push(j);
    FM.addNews(state, {
      type: 'board', important: true, title: 'Jobangebot: ' + club.name,
      body: text + ' ' + FM.expectationText(state, club.id) + ' Das Angebot gilt bis ' + D.fmt(j.until) + '. Nimmst du an, verlässt du ' + state.clubs[state.user.club].name + ' sofort.',
      action: { kind: 'job', id: j.id }
    });
    return j;
  }

  /* Woechentlich in der Saison: Trainer unter Druck */
  FM.coachCheck = function (state) {
    var ul = state.clubs[state.user.club].league;
    LEAGUES.forEach(function (lid) {
      var played = FM.playedRounds(state, lid), total = state.leagues[lid].rounds || 34;
      if (played < 8 || played > total - 4) return;
      var t = FM.table(state, lid);
      t.forEach(function (r, i) {
        var club = state.clubs[r.club], pos = i + 1;
        if (r.club === state.user.club || club.reserve || !club.coach || !club.expect || club.sackY === state.season.year) return;
        if (D.diff(club.coach.since, state.date) < 120) return;
        var gap = pos - club.expect.target, zone = FM.ZONES[lid](pos);
        var p = gap >= 8 ? 0.1 : gap >= 5 ? 0.05 : (zone === 'down' || zone === 'po') && club.expect.target <= 12 ? 0.05 : 0;
        if (!p || !R.chance(p * (club.pat || 1))) return;            // ungeduldiges Umfeld entlaesst schneller
        var out = club.coach.name;
        club.sackY = state.season.year;
        club.coach = null;
        var why = 'Platz ' + pos + ' statt ' + club.expect.label;
        if (fitsUser(state, club) && R.chance(0.5)) {
          logCoach(state, club, out, null, why);
          club.vacant = D.add(state.date, 9);
          FM.addNews(state, { type: 'league', quiet: lid !== ul, title: club.short + ' entlässt Trainer ' + out, body: club.name + ' trennt sich nach ' + played + ' Spieltagen von ' + out + ' (' + why + '). Ein Nachfolger wird gesucht.' });
          offerJob(state, club, 8, club.name + ' hat sich von ' + out + ' getrennt und möchte dich als Nachfolger: Dein Ruf (' + FM.REP_LABEL(user(state).rep) + ') hat den Vorstand überzeugt.');
        } else {
          var c = appoint(state, club, why, out);
          FM.addNews(state, { type: 'league', quiet: lid !== ul, title: club.short + ' entlässt Trainer ' + out, body: club.name + ' trennt sich nach ' + played + ' Spieltagen von ' + out + ' (' + why + '). ' + c.name + ' übernimmt.' });
        }
      });
    });
    // die Stimmung der Fans beruhigt sich mit der Zeit
    var u0 = user(state);
    u0.fans += (56 - u0.fans) * 0.025;
    // offene Stellen und abgelaufene Angebote
    state.jobs = state.jobs.filter(function (j) { return j.until >= state.date; });
    Object.keys(state.clubs).forEach(function (cid) {
      var c = state.clubs[cid];
      if (c.vacant && c.vacant <= state.date && !c.coach && cid !== state.user.club) {
        delete c.vacant;
        var n = appoint(state, c, 'Nachfolge');
        FM.addNews(state, { type: 'league', quiet: true, title: c.short + ': ' + n.name + ' ist neuer Trainer', body: n.name + ' übernimmt bei ' + c.name + '.' });
      }
    });
  };

  FM.jobOf = function (state, id) { return (state.jobs || []).filter(function (j) { return j.id === id && j.until >= state.date; })[0] || null; };

  FM.acceptJob = function (state, id) {
    var j = FM.jobOf(state, id);
    if (!j) return { ok: false, msg: 'Das Angebot ist nicht mehr gültig.' };
    var old = state.clubs[state.user.club], club = state.clubs[j.club];
    FM.changeClub(state, j.club);
    state.jobs = [];
    return { ok: true, msg: 'Du bist neuer Cheftrainer von ' + club.name + '. ' + old.short + ' sucht einen Nachfolger.' };
  };
  FM.declineJob = function (state, id) {
    state.jobs = (state.jobs || []).filter(function (j) { return j.id !== id; });
    return { ok: true, msg: 'Angebot abgelehnt.' };
  };

  /* Vereinswechsel des Spielers: alter Verein bekommt einen Trainer, der neue verliert seinen */
  FM.changeClub = function (state, cid) {
    var u = user(state), old = state.clubs[u.club], club = state.clubs[cid];
    if (old && old.id !== cid && !old.coach) { appoint(state, old, 'Nachfolge von ' + u.name); old.lineup = null; }
    var prev = club.coach ? club.coach.name : null;
    club.coach = null;
    delete club.vacant;
    logCoach(state, club, prev, u.name, 'Trainerwechsel');
    u.fans = 60;
    u.vow = null; u.obj = null; u.bonus = null; u.tix = null;
    u.run = { w: 0, u: 0, l: 0, bw: u.run.bw, bu: u.run.bu };
    FM.takeJob(state, cid);
  };

  /* ---------- Meilensteine ---------- */
  FM.ACH = [
    ['firstWin', 'Der erste Dreier', 'Gewinne dein erstes Pflichtspiel.'],
    ['streak5', 'Serientäter', 'Fünf Pflichtspielsiege in Folge.'],
    ['streak10', 'Unaufhaltsam', 'Zehn Pflichtspielsiege in Folge.'],
    ['unbeaten15', 'Festung', '15 Pflichtspiele ohne Niederlage.'],
    ['goals6', 'Schützenfest', 'Erziele sechs oder mehr Tore in einem Spiel.'],
    ['comeback', 'Comeback-Könige', 'Gewinne nach einem Rückstand von zwei Toren.'],
    ['derby', 'Derbysieger', 'Gewinne ein Derby.'],
    ['giant', 'Pokalschreck', 'Wirf im DFB-Pokal einen höherklassigen Gegner raus.'],
    ['euroNight', 'Magische Nacht', 'Besiege im Europapokal einen der Großen (Stärke 84+).'],
    ['games100', 'Dauerbrenner', '100 Pflichtspiele an der Seitenlinie.'],
    ['games300', 'Institution', '300 Pflichtspiele an der Seitenlinie.'],
    ['survive', 'Dem Abstieg getrotzt', 'Halte mit dem Saisonziel Klassenerhalt die Liga.'],
    ['overperf', 'Überflieger', 'Übertriff das Saisonziel um mindestens fünf Plätze.'],
    ['promo', 'Aufstiegsheld', 'Steige mit deinem Verein auf.'],
    ['climber', 'Durchmarsch', 'Zwei Aufstiege in Folge.'],
    ['cup', 'Der Pott', 'Gewinne den DFB-Pokal.'],
    ['champ', 'Deutscher Meister', 'Hol die Schale.'],
    ['double', 'Double', 'Meisterschaft und DFB-Pokal in einer Saison.'],
    ['europe', 'Europapokalsieger', 'Gewinne einen europäischen Wettbewerb.'],
    ['cl', 'Henkelpott', 'Gewinne die Champions League.'],
    ['youth', 'Jugend forscht', 'Ein Eigengewächs macht 20 Ligaspiele in einer Saison.'],
    ['seller', 'Tafelsilber', 'Verkaufe einen Spieler für mindestens 30 Mio. €.'],
    ['loyal5', 'Vereinstreue', 'Fünf Saisons in Folge beim selben Verein.'],
    ['legend', 'Vereinslegende', 'Zehn Saisons in Folge beim selben Verein.'],
    ['top', 'Ganz oben', 'Erreiche als Trainer den Ruf „International gefragt".']
  ];

  function award(state, id) {
    var u = user(state);
    if (u.ach[id]) return false;
    u.ach[id] = state.date;
    var a = FM.ACH.filter(function (x) { return x[0] === id; })[0];
    if (a) FM.addNews(state, { type: 'league', title: 'Meilenstein: ' + a[1], body: a[2] + ' Geschafft – der Eintrag steht in deiner Karriereübersicht.' });
    return true;
  }
  FM.award = award;

  function fans(state, d) { var u = user(state); u.fans = FM.clamp(u.fans + d, 0, 100); }
  FM.fanMood = fans;
  FM.fanLabel = function (v) { return v >= 80 ? 'Euphorisch' : v >= 62 ? 'Zufrieden' : v >= 45 ? 'Abwartend' : v >= 28 ? 'Unruhig' : 'Aufgebracht'; };

  /* ---------- Nach jedem Pflichtspiel des Spielers ---------- */
  FM.careerAfterMatch = function (state, fx, res, side) {
    var u = user(state), uc = u.club, opp = side === 0 ? fx.away : fx.home;
    var gf = side === 0 ? res.hg : res.ag, ga = side === 0 ? res.ag : res.hg;
    var winner = FM.fixtureWinner(fx), won = gf > ga, lost = gf < ga;
    u.rec.p++; u.rec.gf += gf; u.rec.ga += ga;
    if (won) u.rec.w++; else if (lost) u.rec.l++; else u.rec.d++;
    u.run.w = won ? u.run.w + 1 : 0;
    u.run.u = lost ? 0 : u.run.u + 1;
    u.run.l = lost ? u.run.l + 1 : 0;
    u.run.bw = Math.max(u.run.bw, u.run.w); u.run.bu = Math.max(u.run.bu, u.run.u);
    var derby = FM.isDerby(state, fx.home, fx.away);
    fans(state, (won ? 0.8 : lost ? -1 : 0) + (derby ? (won ? 4 : lost ? -5 : 0) : 0));

    // Rekorde der eigenen Amtszeit
    var label = state.clubs[fx.home].short + ' ' + res.hg + ':' + res.ag + ' ' + state.clubs[fx.away].short + ' (' + D.fmt(fx.date) + ')';
    if (won && (!u.recs.win || gf - ga > u.recs.win.d)) u.recs.win = { d: gf - ga, t: label };
    if (lost && (!u.recs.loss || ga - gf > u.recs.loss.d)) u.recs.loss = { d: ga - gf, t: label };
    if (fx.home === uc && !fx.neutral && res.att && (!u.recs.att || res.att > u.recs.att.d)) u.recs.att = { d: res.att, t: FM.fmtInt(res.att) + ' gegen ' + state.clubs[opp].short + ' (' + D.fmt(fx.date) + ')' };

    if (won) award(state, 'firstWin');
    if (u.run.w >= 5) award(state, 'streak5');
    if (u.run.w >= 10) award(state, 'streak10');
    if (u.run.u >= 15) award(state, 'unbeaten15');
    if (gf >= 6) award(state, 'goals6');
    if (won && derby) award(state, 'derby');
    if (u.rec.p >= 100) award(state, 'games100');
    if (u.rec.p >= 300) award(state, 'games300');
    if (won) {
      var worst = 0, sc = [0, 0];
      (res.ev || []).forEach(function (e) { if (e.t === 'goal' && e.per !== 5) { sc[e.s]++; worst = Math.max(worst, sc[1 - side] - sc[side]); } });
      if (worst >= 2) award(state, 'comeback');
    }
    if (fx.comp === 'cup' && winner === uc && FM.levelOf(state, opp) < FM.levelOf(state, uc)) award(state, 'giant');
    if (FM.EU[fx.comp] && won && FM.euStr(state, opp) >= 84) award(state, 'euroNight');

    // Ansage vor dem Spiel (Pressekonferenz)
    if (u.vow && u.vow.fid === fx.id) {
      if (won) { fans(state, 4); FM.clubPlayers(state, uc).forEach(function (p) { p.mor = FM.clamp(p.mor + 3, 5, 100); }); FM.addNews(state, { type: 'board', quiet: true, title: 'Ansage eingelöst', body: 'Du hast vor dem Spiel den Mund voll genommen – und geliefert. Die Fans feiern dich.' }); }
      else if (lost) { fans(state, -4); u.conf = FM.clamp(u.conf - 2, 0, 100); FM.addNews(state, { type: 'board', quiet: true, title: 'Große Worte, kleines Spiel', body: 'Nach deiner Kampfansage setzt es eine Niederlage. In den Medien gibt es Spott, der Vorstand ist verstimmt.' }); }
      u.vow = null;
    }
  };

  /* ---------- Saisonende ---------- */
  FM.careerSeasonEnd = function (state, sm) {
    var u = user(state), y = sm.year, uc = sm.user.club, us = sm.user, club = state.clubs[uc];
    var rep0 = u.rep, d = 0;
    if (us.pos) d += FM.clamp((us.target - us.pos) * 0.6, -6, 8);
    if (us.promoted) d += 6;
    if (us.relegated) d -= 8;
    var add = function (k) { u.titles.push({ y: y, k: k, club: uc }); };
    var champ = us.pos === 1 && FM.ZONES[us.league];
    if (champ) { add(us.league); d += us.league === 'bl' ? 9 : 4; }
    if (us.promoted) add('up');
    if (us.cupWinner) { add('cup'); d += 6; }
    if (us.eu) {
      var r = us.eu.reached, k = us.eu.comp;
      if (r === 'w') { add(k); d += k === 'cl' ? 15 : k === 'el' ? 10 : 7; }
      else if (r === 'f') d += k === 'cl' ? 7 : 4;
      else if (r === 'sf') d += k === 'cl' ? 5 : 2;
      else if (r === 'qf') d += k === 'cl' ? 3 : 1;
    }
    // wer in einer grossen Liga arbeitet, macht sich einen Namen – wer scheitert, verliert ihn
    if (u.rep < FM.jobNeed(club) && d >= 0) d += 2;
    if (us.fired) d -= 6;
    u.rep = FM.clamp(Math.round(u.rep + d), 0, 100);
    us.rep = u.rep; us.repDelta = u.rep - rep0;
    if (us.pos) fans(state, FM.clamp((us.target - us.pos) * 1.5, -10, 10) + (us.promoted ? 12 : 0) - (us.relegated ? 12 : 0) + (us.cupWinner ? 10 : 0));
    u.conf = FM.clamp(u.conf + (u.fans - 50) * 0.08, 0, 100);

    // Meilensteine
    if (us.promoted) award(state, 'promo');
    var ss = u.seasons, n = ss.length;
    if (us.promoted && n >= 2 && ss[n - 2].promoted) award(state, 'climber');
    if (n) ss[n - 1].promoted = !!us.promoted;
    if (us.cupWinner) award(state, 'cup');
    if (champ && us.league === 'bl') award(state, 'champ');
    if (champ && us.league === 'bl' && us.cupWinner) award(state, 'double');
    if (us.eu && us.eu.reached === 'w') { award(state, 'europe'); if (us.eu.comp === 'cl') award(state, 'cl'); }
    if (us.pos && us.pos <= us.target - 5) award(state, 'overperf');
    if (us.pos && /Klassenerhalt/.test(us.expect || '') && !us.relegated && us.pos <= us.target) award(state, 'survive');
    if (u.rep >= 75) award(state, 'top');
    var same = 0;
    for (var i = n - 1; i >= 0 && ss[i].club === uc; i--) same++;
    if (same >= 5) award(state, 'loyal5');
    if (same >= 10) award(state, 'legend');
    if (FM.clubPlayers(state, uc).some(function (p) { return p.src === 'y' && p.st.apps >= 20 && (!p.hist.length || p.hist.every(function (h) { return h.club === uc; })); })) award(state, 'youth');
    if (state.transfers.some(function (t) { return t.from === uc && t.fee >= 30e6 && t.date >= D.iso(y, 7, 1); })) award(state, 'seller');

    Object.keys(state.clubs).forEach(function (k3) { var c3 = state.clubs[k3]; if (c3.expect) c3.expectPrev = c3.expect.target; });

    // Ehrentafel
    var row = { y: y, cup: sm.awards.cup, u: { club: uc, league: us.league, pos: us.pos } };
    LEAGUES.forEach(function (l) { if (sm.tables[l] && sm.tables[l][0]) row[l] = sm.tables[l][0].club; });
    if (sm.awards.eu) FM.EU_COMPS.forEach(function (k2) { if (sm.awards.eu[k2]) row[k2] = sm.awards.eu[k2].club; });
    if (sm.awards.bl) row.sc = sm.awards.bl.name + ' (' + sm.awards.bl.goals + ')';
    state.hist.push(row);
    if (state.hist.length > 60) state.hist.shift();
  };

  /* Sommer: KI-Vereine ziehen Bilanz – Trainer muessen gehen, und der Spieler bekommt Angebote */
  FM.careerSummer = function (state, sm) {
    var u = user(state), offers = 0;
    LEAGUES.forEach(function (lid) {
      (sm.tables[lid] || []).forEach(function (r, i) {
        var club = state.clubs[r.club];
        if (r.club === u.club || club.reserve || !club.coach) return;
        var gap = (i + 1) - (club.expectPrev != null ? club.expectPrev : i + 1);
        var down = sm.moves.down.indexOf(r.club) >= 0;
        var p = down ? 0.4 : gap >= 6 ? 0.5 : gap >= 3 ? 0.2 : 0.04;
        if (!R.chance(p)) return;
        var out = club.coach.name, why = down ? 'nach dem Abstieg' : gap >= 3 ? 'Saisonziel verfehlt' : 'Trennung im Sommer';
        club.coach = null;
        if (offers < 2 && fitsUser(state, club) && R.chance(0.7)) {
          offers++;
          logCoach(state, club, out, null, why);
          club.vacant = D.add(state.date, 16);
          offerJob(state, club, 14, club.name + ' sucht nach der Trennung von ' + out + ' (' + why + ') einen neuen Cheftrainer und hat an dich gedacht.');
        } else appoint(state, club, why, out);
      });
    });
    // Abwerbeversuch: ein groesserer Verein will den Erfolgstrainer, obwohl dort niemand entlassen wurde
    if (!offers && !u.fired && sm.user.repDelta >= 4 && R.chance(0.45)) {
      var me = state.clubs[u.club];
      var cands = Object.keys(state.clubs).map(function (k) { return state.clubs[k]; }).filter(function (c) {
        return LEAGUES.indexOf(c.league) >= 0 && c.coach && fitsUser(state, c) && c.rep <= me.rep + 22;
      });
      if (cands.length) {
        var c = R.pick(cands), out2 = c.coach.name;
        offerJob(state, c, 14, c.name + ' ist von deiner Arbeit bei ' + me.short + ' beeindruckt und würde für dich Trainer ' + out2 + ' freistellen.');
      }
    }
  };

  /* Angebote nach einer Entlassung: Vereine, zu denen der Ruf passt */
  FM.jobsForFired = function (state) {
    var u = user(state);
    var list = Object.keys(state.clubs).map(function (k) { return state.clubs[k]; }).filter(function (c) {
      return c.id !== u.club && LEAGUES.indexOf(c.league) >= 0 && !c.reserve && !c.guest && FM.jobNeed(c) <= u.rep + 4;
    }).sort(function (a, b) { return b.rep + R.range(0, 8) - a.rep - R.range(0, 8); });
    return list.slice(0, 3).map(function (c) { return c.id; });
  };
})();
