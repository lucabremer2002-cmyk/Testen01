/* ---------------------------------------------------------------------
   Rivalen.

   Sie handeln jede Woche, unabhaengig vom Spieler: Geld verdienen,
   Gebiet nehmen, Leute anwerben - und wenn die Beziehung schlecht genug
   ist, gegen den Spieler vorgehen. Wer nichts tut, sieht seinen Einfluss
   schrumpfen; das ist der Motor, der die Karte in Bewegung haelt.

   Die Entscheidung eines Rivalen ist eine gewichtete Wahl aus wenigen
   Zuegen. Kein Baum, keine Zustandsmaschine - die Gewichte haengen an
   Persoenlichkeit (agg, greed) und Lage, und das genuegt, damit sich
   Saldana anders anfuehlt als Kingsley.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  function def(id) { return D.byId(D.RIVALS, id); }

  function totalInfl(r) {
    var t = 0;
    for (var k in r.infl) t += r.infl[k];
    return t;
  }

  /* Wie stark ein Rivale den Spieler wahrnimmt: gemeinsame Bezirke,
     Machtunterschied, Beziehung. */
  function friction(s, r, d) {
    var overlap = 0;
    for (var k in s.districts) {
      if (!s.districts[k].open) continue;
      overlap += Math.min(s.districts[k].mine, r.infl[k] || 0);
    }
    var power = d.strength / Math.max(20, r.strength);
    /* Ein Niemand ist keinen Zug wert. Erst wer sichtbar etwas besitzt,
       wird zum Problem - sonst schlaegt Kingsley in Woche zwei einen
       Spieler zusammen, der noch nichts hat, und das Spiel ist vorbei,
       bevor es angefangen hat. */
    var worth = U.clamp((s.businesses.length + d.totalInfluence / 14) / 4, 0, 1.4);
    return (overlap / 40 + Math.max(0, power - 0.8) * 0.6 - r.relation / 120) * worth;
  }

  /* ----------------------------------------------------------- Ziele

     Ein Rivale, der jede Woche gewichtet wuerfelt, wirkt betriebsam,
     aber nicht zielstrebig. Deshalb hat jetzt jeder eine Absicht, die
     mehrere Wochen haelt, auf die er hinarbeitet und die auf seiner
     Karte steht. Man kann ihm dabei zusehen - und ihn davon abbringen.
  */
  function neuesZiel(s, rng, r, rd, d) {
    var kand = [];

    /* Einen Bezirk nehmen, in dem er noch nicht stark ist. */
    for (var k in s.districts) {
      var hier = r.infl[k] || 0;
      var frei = Math.max(0, 100 - hier - othersIn(s, r, k) - (s.districts[k].open ? s.districts[k].mine : 0));
      kand.push({ kind: 'district', target: k,
        w: (frei / 30 + (rd.home[k] ? 2 : 0)) * rd.greed });
    }

    /* Einen anderen Rivalen bekaempfen - die Stadt gehoert nicht nur
       dem Spieler, und das soll man merken. */
    for (var i = 0; i < s.rivals.length; i++) {
      var anderer = s.rivals[i];
      if (anderer.id === r.id) continue;
      var reibung = 0;
      for (var kk in anderer.infl) {
        if ((r.infl[kk] || 0) > 8 && (anderer.infl[kk] || 0) > 8) reibung += 1;
      }
      if (reibung) kand.push({ kind: 'rival', target: anderer.id, w: reibung * 0.9 * rd.agg });
    }

    /* Den Spieler ueberholen. */
    if (d.netWorth > 150000) kand.push({ kind: 'outgrow', target: null, w: 1.2 * rd.greed });

    /* Sich sammeln. */
    kand.push({ kind: 'consolidate', target: null, w: 0.8 });

    var z = rng.weighted(kand);
    if (!z) z = { kind: 'consolidate', target: null };
    return { kind: z.kind, target: z.target, since: s.day, progress: 0 };
  }

  /* Ist das Ziel erreicht oder sinnlos geworden? */
  function zielFertig(s, r, d) {
    var g = r.goal;
    if (!g) return true;
    if (s.day - g.since > 140) return true;          /* zwanzig Wochen genug */
    if (g.kind === 'district') return (r.infl[g.target] || 0) >= 55;
    if (g.kind === 'rival') {
      var o = U.byId(s.rivals, g.target);
      if (!o) return true;
      return totalInfl(o) < 25;
    }
    if (g.kind === 'outgrow') return r.cash > d.netWorth;
    if (g.kind === 'consolidate') return r.strength > 140;
    return false;
  }

  function zielText(s, r) {
    var g = r.goal;
    if (!g) return '';
    if (g.kind === 'district') {
      var dn = D.byId(D.DISTRICTS, g.target);
      return 'Taking ' + (dn ? dn.name : g.target);
    }
    if (g.kind === 'rival') {
      var o = D.byId(D.RIVALS, g.target);
      return 'Moving against ' + (o ? o.name : 'a rival');
    }
    if (g.kind === 'outgrow') return 'Out-earning you';
    return 'Consolidating';
  }

  /* Einen anderen Rivalen angreifen. Der Spieler sieht es im Protokoll
     und auf der Karte - die Stadt lebt auch ohne ihn. */
  function rivalKrieg(s, rng, r, rd, report) {
    var o = U.byId(s.rivals, r.goal.target);
    if (!o) return;
    var od = def(o.id);
    var kand = [];
    for (var k in o.infl) if ((o.infl[k] || 0) > 6) kand.push({ id: k, w: o.infl[k] });
    var ziel = rng.weighted(kand);
    if (!ziel) return;
    var staerke = r.strength / Math.max(20, o.strength);
    if (rng.chance(U.clamp(0.35 + (staerke - 1) * 0.3, 0.12, 0.85))) {
      var genommen = rng.range(1.5, 4.5);
      o.infl[ziel.id] = Math.max(0, o.infl[ziel.id] - genommen);
      r.infl[ziel.id] = U.clamp((r.infl[ziel.id] || 0) + genommen * 0.75, 0, 100);
      o.strength = Math.max(12, o.strength - rng.range(1, 3));
      r.lastAct = 'took ground from ' + od.name;
      if (rng.chance(0.5)) {
        report.push({ t: 'neutral', text: rd.name + ' pushed ' + od.name + ' out of part of ' +
          D.byId(D.DISTRICTS, ziel.id).name + '. Neither of them asked you.' });
      }
    } else {
      r.strength = Math.max(12, r.strength - rng.range(0.5, 2));
      r.lastAct = 'lost people fighting ' + od.name;
    }
  }

  /* -------------------------------------------------------- Wochenzug */

  function weekly(s, rng, d, report) {
    var mods = s.mods || { rivalSpeed: 1 };
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      var rd = def(r.id);

      /* Einnahmen: Gebiet mal Staerke. */
      var earn = Math.round(totalInfl(r) * 190 * (0.6 + rd.greed * 0.7) * mods.rivalSpeed);
      r.cash += earn;

      /* Stammgebiet waechst nach. Ohne das ist jeder Rivale nach dreissig
         Wochen erledigt und die Karte tot - sie sollen sich wehren
         koennen, auch wenn der Spieler sie einmal verdraengt hat. */
      for (var hk in rd.home) {
        var floorHere = rd.home[hk] * 0.55;
        if ((r.infl[hk] || 0) < floorHere) {
          r.infl[hk] = Math.min(floorHere, (r.infl[hk] || 0) + 0.9 * mods.rivalSpeed);
        }
      }

      /* Beziehungen driften zur Mitte, aber nicht symmetrisch: Groll
         verblasst, eine gepflegte Freundschaft nicht. Vorher zog derselbe
         Satz auch jedes muehsam erarbeitete Plus wieder auf null - in
         einer vollen Partie ueber 95 Wochen kam kein einziger Rivale je
         auf die 55 Punkte fuer ein Buendnis, obwohl durchgehend
         verhandelt wurde. Das gesamte Buendnissystem war damit tot. */
      r.relation += r.relation < 0 ? (0 - r.relation) * 0.055 : (0 - r.relation) * 0.010;
      if (r.allied) r.relation = Math.max(r.relation, 45);
      if (r.truceUntil > s.day) continue;

      /* Ziel pflegen. */
      if (!r.goal || zielFertig(s, r, d)) r.goal = neuesZiel(s, rng, r, rd, d);

      /* Krieg gegen einen anderen Rivalen laeuft neben allem anderen. */
      if (r.goal.kind === 'rival' && rng.chance(0.45)) {
        rivalKrieg(s, rng, r, rd, report);
        continue;
      }

      var f = friction(s, r, d);
      var moves = [
        { id: 'expand', w: 1.6 * rd.greed },
        { id: 'invest', w: r.cash > 80000 ? 1.2 : 0.3 },
        { id: 'recruit', w: 0.8 },
        /* Schonfrist: die ersten vier Wochen gehoeren dem Spieler. */
        { id: 'press', w: s.day < 28 ? 0 : Math.max(0, f) * 2.4 * rd.agg * (r.allied ? 0.05 : 1) },
        { id: 'court', w: r.relation > 10 && !r.allied ? 0.5 : 0.15 },
        { id: 'idle', w: 0.5 }
      ];
      /* Wer ein Ziel hat, verfolgt es auch. */
      if (r.goal.kind === 'district') moves[0].w *= 2.4;
      if (r.goal.kind === 'outgrow') moves[1].w *= 2.2;
      if (r.goal.kind === 'consolidate') moves[2].w *= 2.4;

      var move = rng.weighted(moves);
      act(s, rng, r, rd, move ? move.id : 'idle', d, report, r.goal);
    }
  }

  function act(s, rng, r, rd, move, d, report, goal) {
    var k, dist, best, i;
    switch (move) {
      /* Gebiet nehmen - bevorzugt dort, wo wenig Widerstand steht. */
      case 'expand': {
        var cands = [];
        for (k in s.districts) {
          var mine = s.districts[k].mine;
          var here = r.infl[k] || 0;
          var home = rd.home[k] ? 1.8 : 1;
          var free = Math.max(0, 100 - mine - othersIn(s, r, k));
          cands.push({ id: k, w: (free / 40 + here / 50) * home });
        }
        /* Auf das Ziel zusteuern, statt zu streuen. */
        if (goal && goal.kind === 'district') {
          for (var ci = 0; ci < cands.length; ci++) if (cands[ci].id === goal.target) cands[ci].w *= 5;
        }
        var pick = rng.weighted(cands);
        if (!pick) return;
        var gain = rng.range(0.8, 2.6) * (0.6 + rd.greed);
        var before = r.infl[pick.id] || 0;
        r.infl[pick.id] = U.clamp(before + gain, 0, 100);
        /* Wo der Spieler sitzt, geht das auf seine Kosten. */
        if (s.districts[pick.id].open && s.districts[pick.id].mine > 3) {
          var take = Math.min(s.districts[pick.id].mine - 2, gain * 0.45);
          if (take > 0) {
            s.districts[pick.id].mine -= take;
            report.push({ t: 'warn', rival: r.id,
              text: rd.name + ' pushed into ' + D.byId(D.DISTRICTS, pick.id).name +
                    '. You lost ' + take.toFixed(1) + ' influence there.' });
          }
        }
        r.lastAct = 'expanded into ' + D.byId(D.DISTRICTS, pick.id).name;
        break;
      }
      /* Betrieb kaufen - abstrakt, aber mit Folgen: mehr Staerke, mehr
         Einnahmen, hoeherer Preis fuer den Spieler in dem Bezirk. */
      case 'invest': {
        var price = 30000 + rng.int(0, 40000);
        if (r.cash < price) { r.lastAct = 'sat on its money'; break; }
        r.cash -= price;
        r.biz++;
        r.strength += rng.range(1.5, 4);
        var where = rng.weighted(Object.keys(r.infl).map(function (id) {
          return { id: id, w: (r.infl[id] || 0) + 1 };
        }));
        if (where) r.infl[where.id] = U.clamp((r.infl[where.id] || 0) + rng.range(0.6, 1.8), 0, 100);
        r.lastAct = 'bought another business';
        break;
      }
      case 'recruit': {
        var cost = 6000 + rng.int(0, 14000);
        if (r.cash < cost) { r.lastAct = 'was short on cash'; break; }
        r.cash -= cost;
        r.strength += rng.range(2, 6);
        r.lastAct = 'brought on new people';
        break;
      }
      /* Gegen den Spieler vorgehen. Immer angekuendigt, immer erklaert. */
      case 'press': {
        pressure(s, rng, r, rd, d, report);
        break;
      }
      case 'court': {
        r.relation = U.clamp(r.relation + rng.range(2, 6), -100, 100);
        r.lastAct = 'sent word that they want to talk';
        break;
      }
      default:
        r.lastAct = 'kept quiet this week';
    }
  }

  function othersIn(s, self, k) {
    var t = 0;
    for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i] !== self) t += s.rivals[i].infl[k] || 0;
    return t;
  }

  /* Angriffe. Welcher kommt, haengt davon ab, was der Spieler hat. */
  function pressure(s, rng, r, rd, d, report) {
    var options = [];
    var myBiz = s.businesses.slice();
    if (myBiz.length) options.push({ id: 'sabotage', w: 1.2 });
    if (myBiz.length) options.push({ id: 'undercut', w: 1.0 });
    options.push({ id: 'poach', w: s.crew.length > 1 ? 1.1 : 0 });
    options.push({ id: 'tip', w: 0.8 });
    options.push({ id: 'muscle', w: r.strength > d.strength ? 1.3 : 0.4 });
    var choice = rng.weighted(options);
    if (!choice) return;

    var name = rd.name;
    switch (choice.id) {
      case 'sabotage': {
        var b = rng.pick(myBiz);
        var cut = U.clamp(1 - d.sabotageCut, 0.25, 1);
        b.damage = U.clamp((b.damage || 0) + rng.range(0.25, 0.55) * cut, 0, 0.8);
        report.push({ t: 'bad', rival: r.id,
          text: name + ' hit ' + b.name + '. Output down ' + U.pct(b.damage) + ' until it is repaired.' });
        r.relation = U.clamp(r.relation - 5, -100, 100);
        r.lastAct = 'sabotaged one of your sites';
        break;
      }
      case 'undercut': {
        var k2 = pickSharedDistrict(s, r, rng);
        if (!k2) return;
        var loss = rng.range(1.5, 4);
        s.districts[k2].mine = Math.max(0, s.districts[k2].mine - loss);
        r.infl[k2] = U.clamp((r.infl[k2] || 0) + loss * 0.7, 0, 100);
        report.push({ t: 'warn', rival: r.id,
          text: name + ' undercut your prices in ' + D.byId(D.DISTRICTS, k2).name +
                '. Influence -' + loss.toFixed(1) + '.' });
        r.lastAct = 'undercut you on price';
        break;
      }
      case 'poach': {
        var pool = s.crew.filter(function (c) { return !c.player && c.loyalty < 62; });
        if (!pool.length) { r.lastAct = 'tried to buy one of your people and failed'; break; }
        var c = rng.pick(pool);
        c.loyalty = U.clamp(c.loyalty - rng.range(10, 22), 0, 100);
        report.push({ t: 'warn', rival: r.id,
          text: name + ' made ' + c.name + ' an offer. Loyalty is down to ' + Math.round(c.loyalty) + '.' });
        r.lastAct = 'went after your people';
        break;
      }
      case 'tip': {
        var add = rng.range(4, 11);
        s.heat = U.clamp(s.heat + add, 0, 100);
        report.push({ t: 'bad', rival: r.id,
          text: 'Somebody put your name in front of the police. Heat +' + add.toFixed(1) +
                '. It smells like ' + name + '.' });
        r.lastAct = 'talked to the police about you';
        r.relation = U.clamp(r.relation - 8, -100, 100);
        break;
      }
      case 'muscle': {
        /* Der Schaden richtet sich nach dem, was da ist - ein Angriff
           darf wehtun, aber nie mehr kosten als eine gute Woche. */
        var cost = Math.round(U.clamp(d.grossIncome * rng.range(0.12, 0.3),
                                      400, Math.max(600, d.netWorth * 0.06)));
        s.cash -= cost;
        s.rep = U.clamp(s.rep - 1.5, 0, 100);
        report.push({ t: 'bad', rival: r.id,
          text: name + ' leaned on your operations. ' + U.money(cost) + ' in damage and lost business.' });
        r.lastAct = 'moved on you directly';
        r.relation = U.clamp(r.relation - 6, -100, 100);
        break;
      }
    }
  }

  function pickSharedDistrict(s, r, rng) {
    var cands = [];
    for (var k in s.districts) {
      if (s.districts[k].open && s.districts[k].mine > 4 && (r.infl[k] || 0) > 3) cands.push({ id: k, w: r.infl[k] });
    }
    var p = rng.weighted(cands);
    return p ? p.id : null;
  }

  /* ---------------------------------------------- Spieleraktionen */

  /* Preise haengen an Macht und Beziehung: wer stark ist, zahlt weniger. */
  /* Der Preis haengt am Wocheneinkommen, nicht am Vermoegen: wer viel
     besitzt, aber wenig verdient, konnte sich sonst kein Treffen mehr
     leisten - im Testlauf stieg ein Gespraech auf 88.000 Dollar, waehrend
     es 22 Punkte Beziehung brachte, die von selbst wieder zerfielen. */
  function negotiateCost(s, r, d) {
    var base = U.clamp(d.grossIncome * 0.45, 6000, 120000);
    var mult = 1 + Math.max(0, -r.relation) / 160;
    mult *= U.clamp(r.strength / Math.max(20, d.strength), 0.7, 1.6);
    return Math.round(base * mult);
  }

  function negotiate(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unknown organisation.' };
    var d = St.derive(s);
    var cost = negotiateCost(s, r, d);
    if (s.cash < cost) return { ok: false, why: 'A meeting like that costs ' + U.money(cost) + '.' };
    s.cash -= cost;
    s.stats.spent += cost;
    /* Wer Staerke mitbringt, wird ernster genommen. Mit 22 bis 36 Punkten
       je Treffen ist ein Buendnis in drei bis vier Gespraechen erreichbar,
       wenn man den Rivalen in der Zeit nicht gleichzeitig bekaempft. */
    var gain = 14 + Math.min(8, d.strength / 22);
    r.relation = U.clamp(r.relation + gain, -100, 100);
    r.truceUntil = s.day + 21;
    return { ok: true, cost: cost, relation: Math.round(r.relation),
      text: def(r.id).leader + ' took the meeting. Relations improved and there is a truce for three weeks.' };
  }

  /* Tribut: klein, billig, jederzeit. Verhandeln ist das grosse Treffen
     mit Waffenstillstand, Tribut die laufende Pflege dazwischen - ohne
     so etwas haengt Diplomatie allein an einem Knopf mit Abklingzeit. */
  function tributeCost(s, r, d) {
    return Math.round(U.clamp(d.grossIncome * 0.14, 2000, 40000));
  }

  function tribute(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unknown organisation.' };
    if (r.allied) return { ok: false, why: 'You are already allied.' };
    var d = St.derive(s);
    var cost = tributeCost(s, r, d);
    if (s.cash < cost) return { ok: false, why: 'A gesture like that costs ' + U.money(cost) + '.' };
    s.cash -= cost;
    s.stats.spent += cost;
    r.cash += Math.round(cost * 0.6);
    /* Abnehmender Ertrag: ein Geschenk beeindruckt einen Fremden mehr
       als einen Freund. Tribut bringt einen in die Naehe, den Abschluss
       macht das Treffen - sonst liesse sich ein Buendnis in drei Wochen
       zusammenkaufen, und das ist keine Errungenschaft. */
    var gain = U.clamp(9 * (1 - r.relation / 100), 2, 11);
    r.relation = U.clamp(r.relation + gain, -100, 100);
    return { ok: true, cost: cost, relation: Math.round(r.relation),
      text: def(r.id).leader + ' accepted the gesture. Relations improved by ' + gain + '.' };
  }

  function canAlly(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unknown organisation.' };
    if (r.allied) return { ok: false, why: 'Already allied.' };
    if (r.relation < 42) return { ok: false, why: 'Relations must be at 42 or better (currently ' + Math.round(r.relation) + ').' };
    var d = St.derive(s);
    var cost = Math.round(Math.max(25000, d.netWorth * 0.08));
    if (s.cash < cost) return { ok: false, why: 'Sealing it costs ' + U.money(cost) + '.' };
    return { ok: true, cost: cost };
  }

  function ally(s, rivalId) {
    var c = canAlly(s, rivalId);
    if (!c.ok) return c;
    var r = U.byId(s.rivals, rivalId);
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    r.allied = true;
    r.relation = U.clamp(r.relation + 15, -100, 100);
    s.rep = U.clamp(s.rep + 4, 0, 100);
    /* Andere mögen es nicht, wenn sich zwei zusammentun. */
    for (var i = 0; i < s.rivals.length; i++) {
      if (s.rivals[i].id !== rivalId) s.rivals[i].relation = U.clamp(s.rivals[i].relation - 8, -100, 100);
    }
    return { ok: true, cost: c.cost,
      text: def(rivalId).leader + ' shook on it. They will stay out of your districts and share what they hear.' };
  }

  function breakAlly(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r || !r.allied) return { ok: false, why: 'No alliance to break.' };
    r.allied = false;
    r.relation = U.clamp(r.relation - 55, -100, 100);
    s.rep = U.clamp(s.rep - 3, 0, 100);
    return { ok: true, text: 'The arrangement with ' + def(rivalId).name + ' is over. They will remember it.' };
  }

  /* Druck machen: teuer, riskant, aber die einzige Art, jemanden
     dauerhaft aus einem Bezirk zu draengen. */
  function canPressure(s, rivalId, districtId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unknown organisation.' };
    if (r.allied) return { ok: false, why: 'You are allied with them.' };
    if (!s.districts[districtId] || !s.districts[districtId].open) return { ok: false, why: 'You are not established there.' };
    if ((r.infl[districtId] || 0) < 3) return { ok: false, why: 'They are not really in that district.' };
    var d = St.derive(s);
    var cost = Math.round(Math.max(6000, d.grossIncome * 0.6));
    if (s.cash < cost) return { ok: false, why: 'Needs ' + U.money(cost) + '.' };
    if (d.strength < 25) return { ok: false, why: 'Your organisation is not strong enough (need 25).' };
    return { ok: true, cost: cost, odds: pressureOdds(s, r, d) };
  }

  function pressureOdds(s, r, d) {
    return U.clamp(0.28 + (d.strength - r.strength) / 160 + s.rep / 400, 0.1, 0.9);
  }

  function pressureRival(s, rng, rivalId, districtId) {
    var c = canPressure(s, rivalId, districtId);
    if (!c.ok) return c;
    var r = U.byId(s.rivals, rivalId);
    s.cash -= c.cost;
    s.stats.spent += c.cost;
    r.relation = U.clamp(r.relation - 22, -100, 100);
    s.heat = U.clamp(s.heat + 5, 0, 100);
    var win = rng.chance(c.odds);
    if (win) {
      var taken = Math.min(r.infl[districtId], 6 + rng.next() * 4);
      r.infl[districtId] -= taken;
      s.districts[districtId].mine = U.clamp(s.districts[districtId].mine + taken * 0.85, 0, 100);
      r.strength = Math.max(10, r.strength - 4);
      s.rep = U.clamp(s.rep + 2, 0, 100);
      return { ok: true, win: true, cost: c.cost,
        text: 'Their people pulled back from ' + D.byId(D.DISTRICTS, districtId).name +
              '. You took ' + taken.toFixed(1) + ' influence.' };
    }
    s.rep = U.clamp(s.rep - 2, 0, 100);
    s.heat = U.clamp(s.heat + 4, 0, 100);
    return { ok: true, win: false, cost: c.cost,
      text: 'They did not move. You spent ' + U.money(c.cost) + ', drew attention and made an enemy.' };
  }

  function relationLabel(v) {
    if (v >= 70) return 'Allied';
    if (v >= 35) return 'Friendly';
    if (v >= 10) return 'Cordial';
    if (v > -15) return 'Neutral';
    if (v > -45) return 'Cold';
    if (v > -75) return 'Hostile';
    return 'At War';
  }

  CE.rivals = {
    weekly: weekly, totalInfl: totalInfl, negotiate: negotiate, negotiateCost: negotiateCost,
    canAlly: canAlly, ally: ally, breakAlly: breakAlly, canPressure: canPressure,
    tribute: tribute, tributeCost: tributeCost, zielText: zielText, neuesZiel: neuesZiel,
    pressureRival: pressureRival, pressureOdds: pressureOdds, relationLabel: relationLabel,
    friction: friction
  };
})(typeof window !== 'undefined' ? window : globalThis);
