/* Match-Engine: minutengenaue Simulation mit Chancen/xG, Karten, Verletzungen,
   Wechseln, Verlaengerung und Elfmeterschiessen. Laeuft fuer Live-Spiele schrittweise
   und fuer alle anderen Partien in einem Rutsch. */
(function () {
  'use strict';
  var FM = window.FM;
  var R = FM.rng;

  var HOME_ADV = 1.7;           // Ratingpunkte Heimvorteil
  var SHOT_RATE = 0.128;        // Abschluesse pro Minute und Team bei gleicher Staerke
  var FOUL_RATE = 0.122;        // Fouls pro Minute und Team
  var INJ_RATE = 0.00011;       // Verletzungsrisiko je Spieler und Minute

  function Match(players, home, away, opts) {
    this.P = players;
    this.opts = opts || {};
    this.sides = [this._side(home, 0), this._side(away, 1)];
    this.minute = 0;
    this.period = 1;               // 1,2 regulaer; 3,4 Verlaengerung; 5 Elfmeterschiessen
    this.added = [R.int(1, 3), R.int(2, 6), R.int(0, 2), R.int(1, 3)];
    this.events = [];
    this.finished = false;
    this.pens = null;
    this.stats = { poss: [0, 0], shots: [0, 0], sot: [0, 0], xg: [0, 0], corners: [0, 0], fouls: [0, 0], yc: [0, 0], rc: [0, 0], saves: [0, 0] };
    this.goals = [0, 0];
    this.agg = this.opts.agg || null; // Ergebnis Hinspiel [heim, gast] aus Sicht dieses Spiels
    this.dirty = [true, true];
    this.str = [null, null];
    this.possTicks = 0;
  }

  Match.prototype._side = function (cfg, idx) {
    var self = this;
    var side = {
      idx: idx,
      club: cfg.club,
      formation: cfg.formation,
      tactics: Object.assign(FM.defaultTactics(), cfg.tactics || {}),
      onPitch: cfg.slots.map(function (s) { return { pid: s.pid, pos: s.pos }; }),
      bench: cfg.bench.slice(),
      subsLeft: 5,
      ai: cfg.ai !== false,
      pr: {}
    };
    side.onPitch.forEach(function (s) { self._initPr(side, s.pid, s.pos, 0); });
    return side;
  };

  Match.prototype._initPr = function (side, pid, pos, minute) {
    var p = this.P[pid];
    side.pr[pid] = {
      pid: pid, pos: pos, on: minute, off: null,
      fit: p ? p.fit : 100, yc: 0, rc: false, goals: 0, assists: 0, shots: 0, sot: 0, saves: 0,
      perf: 0, inj: false, og: 0
    };
  };

  /* ---------- Staerkeberechnung ---------- */
  Match.prototype._strength = function (si) {
    if (!this.dirty[si] && this.str[si]) return this.str[si];
    var side = this.sides[si], P = this.P, self = this;
    var att = 0, mid = 0, def = 0, gk = 50, wa = 0, wm = 0, wd = 0;
    var formation = FM.FORMATIONS[side.formation] || FM.FORMATIONS['4-4-2'];
    formation.forEach(function (sl) { var w = FM.ROLE_WEIGHTS[sl[0]]; wa += w.att; wm += w.mid; wd += w.def; });
    side.onPitch.forEach(function (s) {
      var p = P[s.pid], pr = side.pr[s.pid];
      if (!p || pr.rc) return;
      var eff = FM.effectiveRating(p, s.pos, pr.fit);
      var w = FM.ROLE_WEIGHTS[s.pos];
      if (s.pos === 'GK') { gk = eff; def += w.def * eff; mid += w.mid * eff; return; }
      var st = p.s;
      var aEff = eff + 0.25 * ((st[0] + st[1] + st[3]) / 3 - p.ovr);
      var mEff = eff + 0.25 * ((st[2] + st[3]) / 2 - p.ovr);
      var dEff = eff + 0.25 * ((st[4] + st[5]) / 2 - p.ovr);
      att += w.att * aEff; mid += w.mid * mEff; def += w.def * dEff;
    });
    var men = FM.MENTALITY[side.tactics.mentality + 2], pre = FM.PRESSING[side.tactics.pressing];
    var home = (si === 0 && !this.opts.neutral) ? HOME_ADV : 0;
    var res = {
      att: att / wa * (1 + men.att) + home,
      mid: mid / wm * (1 + pre.mid) + home,
      def: def / wd * (1 + men.def + pre.def) + home,
      gk: gk + home * 0.5
    };
    this.str[si] = res;
    this.dirty[si] = false;
    return res;
  };

  Match.prototype.strengths = function () { return [this._strength(0), this._strength(1)]; };

  Match.prototype._active = function (side) {
    return side.onPitch.filter(function (s) { return !side.pr[s.pid].rc; });
  };

  Match.prototype._ev = function (e) { e.m = this.minute; e.per = this.period; this.events.push(e); return e; };

  /* ---------- Ein Spielminute ---------- */
  Match.prototype.step = function () {
    if (this.finished) return null;
    var before = this.events.length;
    if (this.period === 5) { this._shootout(); return this.events.slice(before); }

    this.minute++;
    var S = this.strengths();
    var pH = 1 / (1 + Math.exp(-(S[0].mid - S[1].mid) / 6.5));
    pH = FM.clamp(pH, 0.24, 0.76);
    this.stats.poss[0] += pH; this.stats.poss[1] += 1 - pH; this.possTicks++;

    var tempo = (FM.TEMPO[this.sides[0].tactics.tempo].chances + FM.TEMPO[this.sides[1].tactics.tempo].chances) / 2;
    for (var si = 0; si < 2; si++) {
      var o = 1 - si, share = si === 0 ? pH : 1 - pH;
      var diff = S[si].att - S[o].def;
      var rate = SHOT_RATE * tempo * (0.7 + share * 0.6) * (0.35 + 1.3 / (1 + Math.exp(-diff / 10)));
      if (this.period >= 3) rate *= 0.85;
      if (R.chance(rate)) this._attack(si, diff, S[o].gk);
      if (R.chance(FOUL_RATE)) this._foul(si);
    }
    this._fatigueAndInjuries();
    this._aiDecisions();

    var limit = this.period === 1 ? 45 : this.period === 2 ? 90 : this.period === 3 ? 105 : 120;
    var addIdx = this.period - 1;
    if (this.minute >= limit + this.added[addIdx]) this._endPeriod();
    return this.events.slice(before);
  };

  Match.prototype._pickWeighted = function (side, weightTable, statIdx, excludePid) {
    var self = this, act = this._active(side).filter(function (s) { return s.pid !== excludePid; });
    if (!act.length) return null;
    var pick = R.weighted(act, function (s) {
      var p = self.P[s.pid];
      var st = p && p.s ? p.s[statIdx] : 60;
      return weightTable[s.pos] * Math.pow(Math.max(30, st) / 70, 2);
    });
    return pick ? pick.pid : null;
  };

  Match.prototype._attack = function (si, diff, oppGk) {
    var side = this.sides[si], opp = this.sides[1 - si], st = this.stats;
    var isPen = R.chance(0.0105);
    var shooter, assist = null, xg, kind;
    if (isPen) {
      shooter = this._penTaker(side);
      xg = 0.76; kind = 'pen';
      this._ev({ t: 'penAwarded', s: si, p: shooter });
    } else {
      shooter = this._pickWeighted(side, FM.SCORER_WEIGHT, 1);
      var pBig = FM.clamp(0.1 + diff * 0.0035, 0.045, 0.2);
      var r = R.next();
      if (r < pBig) { xg = R.range(0.26, 0.55); kind = 'big'; }
      else if (r < pBig + 0.45) { xg = R.range(0.06, 0.16); kind = 'box'; }
      else { xg = R.range(0.02, 0.06); kind = 'long'; }
      if (R.chance(kind === 'long' ? 0.35 : 0.8)) assist = this._pickWeighted(side, FM.ASSIST_WEIGHT, 2, shooter);
    }
    if (!shooter) return;
    var sp = this.P[shooter], prS = side.pr[shooter];
    var sho = sp.s ? (FM.isGK(sp) ? 30 : sp.s[1]) : 60;
    var gkPid = this._gk(opp), gkP = gkPid ? this.P[gkPid] : null;
    var gkRating = gkPid ? oppGk : 40;
    var pGoal = xg * (1 + (sho - 70) / 110) * (1 - (gkRating - 72) / 110);
    if (isPen) pGoal = FM.clamp(0.74 + (sho - 75) / 180 - (gkRating - 75) / 260, 0.6, 0.9);
    pGoal = FM.clamp(pGoal, 0.005, 0.92);
    st.shots[si]++; st.xg[si] += xg; prS.shots++;

    if (R.chance(pGoal)) {
      st.sot[si]++; prS.sot++;
      if (!isPen && R.chance(0.012)) { this._ownGoal(si); return; }
      this.goals[si]++;
      prS.goals++; prS.perf += isPen ? 0.8 : 1.05;
      if (assist && !isPen) { side.pr[assist].assists++; side.pr[assist].perf += 0.55; }
      if (gkPid) opp.pr[gkPid].perf -= 0.25;
      this._concede(opp);
      this._ev({ t: 'goal', s: si, p: shooter, a: isPen ? null : assist, pen: isPen, kind: kind, score: this.goals.slice() });
      return;
    }
    var onTarget = R.chance(isPen ? 0.55 : kind === 'big' ? 0.55 : 0.36);
    if (onTarget) {
      st.sot[si]++; prS.sot++; st.saves[1 - si]++;
      if (gkPid) { opp.pr[gkPid].saves++; opp.pr[gkPid].perf += kind === 'big' || isPen ? 0.45 : 0.12; }
    }
    prS.perf += onTarget ? 0.05 : -0.03;
    if (R.chance(0.33)) st.corners[si]++;
    if (isPen) this._ev({ t: 'penMiss', s: si, p: shooter, saved: onTarget, gk: gkPid });
    else if (kind === 'big' || (onTarget && R.chance(0.25))) this._ev({ t: onTarget ? 'save' : 'miss', s: si, p: shooter, gk: gkPid, big: kind === 'big' });
  };

  Match.prototype._ownGoal = function (si) {
    var opp = this.sides[1 - si];
    var defs = this._active(opp).filter(function (s) { return s.pos !== 'GK'; });
    if (!defs.length) return;
    var og = R.weighted(defs, function (s) { return FM.posGroup(s.pos) === 'DEF' ? 3 : 1; });
    this.goals[si]++;
    opp.pr[og.pid].og++; opp.pr[og.pid].perf -= 0.7;
    this._concede(opp);
    this._ev({ t: 'goal', s: si, p: og.pid, og: true, score: this.goals.slice() });
  };

  Match.prototype._concede = function (side) {
    this._active(side).forEach(function (s) {
      var g = FM.posGroup(s.pos);
      if (g === 'DEF') side.pr[s.pid].perf -= 0.14;
      else if (g === 'GK') side.pr[s.pid].perf -= 0.1;
    });
  };

  Match.prototype._gk = function (side) {
    var g = side.onPitch.filter(function (s) { return s.pos === 'GK' && !side.pr[s.pid].rc; })[0];
    return g ? g.pid : null;
  };

  Match.prototype._penTaker = function (side) {
    var self = this, best = null, bv = -1;
    this._active(side).forEach(function (s) {
      var p = self.P[s.pid]; if (!p || s.pos === 'GK') return;
      var v = p.s[1] + (s.pos === 'ST' ? 4 : 0) + p.ovr * 0.3;
      if (v > bv) { bv = v; best = s.pid; }
    });
    return best;
  };

  Match.prototype._foul = function (si) {
    var side = this.sides[si];
    this.stats.fouls[si]++;
    var act = this._active(side).filter(function (s) { return s.pos !== 'GK' || R.chance(0.1); });
    if (!act.length) return;
    var f = R.weighted(act, function (s) { var g = FM.posGroup(s.pos); return (g === 'DEF' ? 1.4 : g === 'MID' ? 1.2 : 0.8) * (side.pr[s.pid].yc ? 0.35 : 1); });
    var pr = side.pr[f.pid];
    var late = this.minute > 70 ? 1.25 : 1;
    if (R.chance(0.0019)) { this._sendOff(si, f.pid, false); return; }
    if (R.chance(0.14 * late * (pr.yc ? 0.55 : 1))) {
      if (pr.yc >= 1) { pr.yc++; this._sendOff(si, f.pid, true); return; }
      pr.yc = 1; pr.perf -= 0.15; this.stats.yc[si]++;
      this._ev({ t: 'yc', s: si, p: f.pid });
    }
  };

  Match.prototype._sendOff = function (si, pid, second) {
    var side = this.sides[si], pr = side.pr[pid];
    pr.rc = true; pr.perf -= 1.2; pr.off = this.minute;
    this.stats.rc[si]++; if (second) this.stats.yc[si]++;
    this.dirty[si] = true;
    this._ev({ t: second ? 'yc2' : 'rc', s: si, p: pid });
    // Torwart vom Platz: Feldspieler muss ins Tor (bzw. Wechsel durch KI)
    var self = this;
    if (pr.pos === 'GK') {
      var benchGk = side.bench.filter(function (b) { return self.P[b] && FM.isGK(self.P[b]); })[0];
      if (benchGk && side.subsLeft > 0 && side.ai) {
        var victim = this._active(side).filter(function (s) { return s.pos !== 'GK'; }).sort(function (a, b) { return FM.posGroup(a.pos) === 'ATT' ? -1 : 1; })[0];
        if (victim) this.substitute(si, victim.pid, benchGk, 'GK');
      } else {
        var field = this._active(side).filter(function (s) { return s.pos !== 'GK'; })[0];
        if (field) field.pos = 'GK';
      }
    }
  };

  Match.prototype._fatigueAndInjuries = function () {
    for (var si = 0; si < 2; si++) {
      var side = this.sides[si];
      var fat = FM.PRESSING[side.tactics.pressing].fatigue * FM.TEMPO[side.tactics.tempo].fatigue;
      var act = this._active(side);
      for (var i = 0; i < act.length; i++) {
        var s = act[i], pr = side.pr[s.pid], p = this.P[s.pid];
        if (!p) continue;
        var phy = p.s ? p.s[5] : 65;
        var drop = s.pos === 'GK' ? 0.05 : 0.175 * fat * (1.25 - phy / 200) * (p.age >= 32 ? 1.1 : 1);
        pr.fit = Math.max(20, pr.fit - drop);
        if (this.minute % 10 === 0) this.dirty[si] = true;
        var risk = INJ_RATE * (pr.fit < 60 ? 2.2 : pr.fit < 75 ? 1.4 : 1);
        if (!pr.inj && R.chance(risk)) {
          pr.inj = true; pr.perf -= 0.1;
          this._ev({ t: 'inj', s: si, p: s.pid });
          if (side.ai) this._aiInjurySub(si, s.pid);
        }
      }
    }
  };

  /* ---------- Wechsel ---------- */
  Match.prototype.substitute = function (si, outPid, inPid, pos) {
    var side = this.sides[si];
    if (side.subsLeft <= 0) return false;
    var idx = -1;
    side.onPitch.forEach(function (s, i) { if (s.pid === outPid) idx = i; });
    if (idx < 0 || side.pr[outPid].rc) return false;
    var bi = side.bench.indexOf(inPid);
    if (bi < 0) return false;
    var slotPos = pos || side.onPitch[idx].pos;
    side.bench.splice(bi, 1);
    side.pr[outPid].off = this.minute;
    side.onPitch[idx] = { pid: inPid, pos: slotPos };
    this._initPr(side, inPid, slotPos, this.minute);
    side.subsLeft--;
    side.subbedOut = side.subbedOut || [];
    side.subbedOut.push(outPid);
    this.dirty[si] = true;
    this._ev({ t: 'sub', s: si, p: inPid, out: outPid });
    return true;
  };

  Match.prototype.setTactics = function (si, t) {
    Object.assign(this.sides[si].tactics, t);
    this.dirty[si] = true;
  };

  Match.prototype.swapPositions = function (si, pidA, pidB) {
    var side = this.sides[si], a = null, b = null;
    side.onPitch.forEach(function (s) { if (s.pid === pidA) a = s; if (s.pid === pidB) b = s; });
    if (!a || !b) return;
    var t = a.pos; a.pos = b.pos; b.pos = t;
    side.pr[pidA].pos = a.pos; side.pr[pidB].pos = b.pos;
    this.dirty[si] = true;
  };

  Match.prototype._bestBenchFor = function (side, pos, excludeGk) {
    var self = this, best = null, bv = -99;
    side.bench.forEach(function (pid) {
      var p = self.P[pid]; if (!p) return;
      if (excludeGk && FM.isGK(p) && pos !== 'GK') return;
      var v = FM.effectiveRating(p, pos);
      if (v > bv) { bv = v; best = pid; }
    });
    return best;
  };

  Match.prototype._aiInjurySub = function (si, pid) {
    var side = this.sides[si];
    var slot = side.onPitch.filter(function (s) { return s.pid === pid; })[0];
    if (!slot || side.subsLeft <= 0) return;
    var rep = this._bestBenchFor(side, slot.pos, true);
    if (rep) this.substitute(si, pid, rep, slot.pos);
  };

  Match.prototype._aiDecisions = function () {
    var m = this.minute;
    for (var si = 0; si < 2; si++) {
      var side = this.sides[si];
      if (!side.ai || side.subsLeft <= 0) continue;
      // Mentalitaet an den Spielstand anpassen
      if (m === 70 || m === 80) {
        var gd = this.goals[si] - this.goals[1 - si];
        if (this.agg) gd = (si === 0 ? this.agg[0] + this.goals[0] - this.agg[1] - this.goals[1] : this.agg[1] + this.goals[1] - this.agg[0] - this.goals[0]);
        var men = gd < 0 ? (m === 80 ? 2 : 1) : gd > 0 ? -1 : side.baseMentality || 0;
        if (side.baseMentality == null) side.baseMentality = side.tactics.mentality;
        this.setTactics(si, { mentality: FM.clamp(men, -2, 2) });
      }
      if (m < 56 || (m > 88 && this.period <= 2)) continue;
      var window = (m === 58 || m === 66 || m === 74 || m === 82) ? 1 : 0;
      if (this.period >= 3 && m === 100) window = 1;
      if (!window) continue;
      var self = this;
      var cands = this._active(side).filter(function (s) { return s.pos !== 'GK'; })
        .map(function (s) { return { s: s, pr: side.pr[s.pid] }; })
        .filter(function (c) { return c.pr.fit < 72 || c.pr.perf < -0.6 || (c.pr.yc && m > 60 && R.chance(0.3)); })
        .sort(function (a, b) { return (a.pr.fit + a.pr.perf * 10) - (b.pr.fit + b.pr.perf * 10); });
      var n = Math.min(cands.length, side.subsLeft, m < 70 ? 2 : 1 + (R.chance(0.5) ? 1 : 0));
      for (var i = 0; i < n; i++) {
        var c = cands[i];
        var rep = self._bestBenchFor(side, c.s.pos, true);
        if (rep && FM.effectiveRating(self.P[rep], c.s.pos) > FM.effectiveRating(self.P[c.s.pid], c.s.pos) - 8 - (72 - c.pr.fit) * 0.2) {
          self.substitute(si, c.s.pid, rep, c.s.pos);
        }
      }
    }
  };

  /* ---------- Spielabschnitte ---------- */
  Match.prototype._endPeriod = function () {
    var p = this.period;
    if (p === 1) {
      this._ev({ t: 'half' });
      this.period = 2; this.minute = 45;
      this._recover(4);
      return;
    }
    if (p === 2) {
      var needEt = false;
      if (this.opts.knockout) {
        if (this.agg) {
          var tH = this.agg[0] + this.goals[0], tA = this.agg[1] + this.goals[1];
          needEt = tH === tA;
        } else needEt = this.goals[0] === this.goals[1];
      }
      if (needEt) {
        this._ev({ t: 'ft90' });
        this.period = 3; this.minute = 90; this._recover(2);
        this.sides.forEach(function (s) { s.subsLeft += 1; });
        return;
      }
      return this._finish();
    }
    if (p === 3) { this._ev({ t: 'etHalf' }); this.period = 4; this.minute = 105; return; }
    if (p === 4) {
      var tie = this.agg ? (this.agg[0] + this.goals[0] === this.agg[1] + this.goals[1]) : this.goals[0] === this.goals[1];
      if (tie) { this.period = 5; this.pens = { taken: [[], []], score: [0, 0], round: 0 }; this._ev({ t: 'pensStart' }); return; }
      return this._finish();
    }
  };

  Match.prototype._recover = function (amount) {
    this.sides.forEach(function (side) {
      Object.keys(side.pr).forEach(function (k) { side.pr[k].fit = Math.min(100, side.pr[k].fit + amount); });
    });
    this.dirty = [true, true];
  };

  Match.prototype._shootout = function () {
    var ps = this.pens;
    var self = this;
    function takers(side) {
      return self._active(side).filter(function (s) { return s.pos !== 'GK'; })
        .map(function (s) { return s.pid; })
        .sort(function (a, b) { return self.P[b].s[1] - self.P[a].s[1]; });
    }
    var order = [takers(this.sides[0]), takers(this.sides[1])];
    for (var si = 0; si < 2; si++) {
      var list = order[si];
      var pid = list[ps.round % list.length];
      var sho = this.P[pid].s[1];
      var gkPid = this._gk(this.sides[1 - si]);
      var gk = gkPid ? this.P[gkPid].ovr : 50;
      var ok = R.chance(FM.clamp(0.76 + (sho - 72) / 200 - (gk - 75) / 250, 0.55, 0.9));
      if (ok) ps.score[si]++;
      ps.taken[si].push(ok);
      this._ev({ t: 'pen', s: si, p: pid, ok: ok, score: ps.score.slice() });
      // vorzeitige Entscheidung in den ersten 5 Runden
      if (ps.round < 5) {
        var left0 = 5 - ps.taken[0].length, left1 = 5 - ps.taken[1].length;
        if (ps.score[0] > ps.score[1] + left1 || ps.score[1] > ps.score[0] + left0) { this._finish(); return; }
      }
    }
    ps.round++;
    if (ps.round >= 5 && ps.score[0] !== ps.score[1]) this._finish();
  };

  Match.prototype._finish = function () {
    if (this.finished) return;
    this.finished = true;
    this._ev({ t: 'end' });
    this._grades();
  };

  Match.prototype.runToEnd = function () {
    var guard = 0;
    while (!this.finished && guard++ < 400) this.step();
  };

  /* ---------- Noten (Kicker-Skala 1,0 – 6,0) ---------- */
  Match.prototype._grades = function () {
    var self = this, all = [];
    var gdTotal = this.goals[0] - this.goals[1];
    this.sides.forEach(function (side, si) {
      var gd = si === 0 ? gdTotal : -gdTotal;
      var res = gd > 0 ? 0.35 : gd < 0 ? -0.35 : 0;
      var strengths = self.strengths();
      var rel = (strengths[si].mid - strengths[1 - si].mid) / 30;
      var conceded = self.goals[1 - si];
      Object.keys(side.pr).forEach(function (pid) {
        var pr = side.pr[pid], p = self.P[pid];
        var mins = (pr.off != null ? pr.off : self.minute) - pr.on;
        pr.mins = Math.max(0, Math.min(120, mins));
        if (pr.mins < 1 && !pr.goals) { pr.grade = null; return; }
        var g = FM.posGroup(pr.pos);
        var score = res + gd * 0.07 + pr.perf + (p ? (p.ovr - 72) / 22 : 0) - rel * 0.2;
        if ((g === 'DEF' || g === 'GK') && conceded === 0 && pr.mins >= 60) score += 0.45;
        score += R.normal(0, 0.42);
        if (pr.mins < 25) score *= 0.5;
        var grade = FM.clamp(3.5 - score, 1, 6);
        grade = Math.round(grade * 2) / 2;
        if (pr.rc) grade = Math.max(grade, 5);
        if (pr.goals >= 3) grade = Math.min(grade, 1.5);
        pr.grade = grade;
        if (pr.mins >= 30) all.push({ pid: pid, grade: grade, score: score + pr.goals * 0.2 });
      });
    });
    all.sort(function (a, b) { return a.grade - b.grade || b.score - a.score; });
    this.motm = all.length ? all[0].pid : null;
  };

  /* ---------- Ergebnisobjekt ---------- */
  Match.prototype.result = function (compact) {
    var st = this.stats, n = Math.max(1, this.possTicks);
    var res = {
      hg: this.goals[0], ag: this.goals[1],
      aet: this.period >= 3,
      pen: this.pens ? this.pens.score.slice() : null,
      motm: this.motm,
      stats: {
        poss: [Math.round(st.poss[0] / n * 100), 100 - Math.round(st.poss[0] / n * 100)],
        shots: st.shots, sot: st.sot, xg: [FM.round1(st.xg[0]), FM.round1(st.xg[1])],
        corners: st.corners, fouls: st.fouls, yc: st.yc, rc: st.rc
      },
      ev: [],
      pl: {}
    };
    var keep = { goal: 1, yc: 1, yc2: 1, rc: 1, inj: 1, sub: 1, penMiss: 1, pen: 1 };
    this.events.forEach(function (e) {
      if (compact && !keep[e.t]) return;
      if (compact && e.t === 'sub') return;
      var o = { m: e.m, t: e.t };
      ['s', 'p', 'a', 'out', 'pen', 'og', 'ok', 'saved', 'big', 'per', 'score'].forEach(function (k) { if (e[k] != null) o[k] = e[k]; });
      res.ev.push(o);
    });
    this.sides.forEach(function (side, si) {
      Object.keys(side.pr).forEach(function (pid) {
        var pr = side.pr[pid];
        res.pl[pid] = { s: si, pos: pr.pos, g: pr.grade, gl: pr.goals, as: pr.assists, mi: pr.mins || 0, yc: pr.yc, rc: pr.rc ? 1 : 0, inj: pr.inj ? 1 : 0, fit: Math.round(pr.fit), st: pr.on === 0 ? 1 : 0 };
      });
    });
    return res;
  };

  FM.Match = Match;
})();
