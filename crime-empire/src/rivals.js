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
      return 'Nimmt sich ' + (dn ? dn.akk : g.target);
    }
    if (g.kind === 'rival') {
      var o = D.byId(D.RIVALS, g.target);
      return 'Geht vor gegen ' + (o ? o.name : 'einen Rivalen');
    }
    if (g.kind === 'outgrow') return 'Will mehr verdienen als du';
    return 'Festigt den Besitz';
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
      r.lastAct = 'hat ' + od.name + ' Boden abgenommen';
      if (rng.chance(0.5)) {
        report.push({ t: 'neutral', text: rd.name + ' hat ' + od.name + ' teilweise aus ' +
          D.byId(D.DISTRICTS, ziel.id).dat + ' verdrängt. Gefragt hat dich keiner von beiden.' });
      }
    } else {
      r.strength = Math.max(12, r.strength - rng.range(0.5, 2));
      r.lastAct = 'hat im Kampf gegen ' + od.name + ' Leute verloren';
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
              text: rd.name + ' ist ' + D.byId(D.DISTRICTS, pick.id).wohin +
                    ' vorgestoßen. Du hast dort ' + take.toFixed(1) + ' Einfluss verloren.' });
          }
        }
        r.lastAct = 'hat sich ' + D.byId(D.DISTRICTS, pick.id).wohin + ' ausgedehnt';
        break;
      }
      /* Betrieb kaufen - abstrakt, aber mit Folgen: mehr Staerke, mehr
         Einnahmen, hoeherer Preis fuer den Spieler in dem Bezirk. */
      case 'invest': {
        var price = 30000 + rng.int(0, 40000);
        if (r.cash < price) { r.lastAct = 'hat auf dem Geld gesessen'; break; }
        r.cash -= price;
        r.biz++;
        r.strength += rng.range(1.5, 4);
        var where = rng.weighted(Object.keys(r.infl).map(function (id) {
          return { id: id, w: (r.infl[id] || 0) + 1 };
        }));
        if (where) r.infl[where.id] = U.clamp((r.infl[where.id] || 0) + rng.range(0.6, 1.8), 0, 100);
        r.lastAct = 'hat einen weiteren Betrieb gekauft';
        break;
      }
      case 'recruit': {
        var cost = 6000 + rng.int(0, 14000);
        if (r.cash < cost) { r.lastAct = 'war knapp bei Kasse'; break; }
        r.cash -= cost;
        r.strength += rng.range(2, 6);
        r.lastAct = 'hat neue Leute angeheuert';
        break;
      }
      /* Gegen den Spieler vorgehen. Immer angekuendigt, immer erklaert. */
      case 'press': {
        pressure(s, rng, r, rd, d, report);
        break;
      }
      case 'court': {
        r.relation = U.clamp(r.relation + rng.range(2, 6), -100, 100);
        r.lastAct = 'hat ausrichten lassen, dass man reden will';
        break;
      }
      default:
        r.lastAct = 'hat sich diese Woche ruhig verhalten';
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
          text: name + ' hat ' + b.name + ' getroffen. Ertrag ' + U.pct(b.damage) + ' niedriger, bis repariert ist.' });
        r.relation = U.clamp(r.relation - 5, -100, 100);
        r.lastAct = 'hat einen deiner Betriebe sabotiert';
        break;
      }
      case 'undercut': {
        var k2 = pickSharedDistrict(s, r, rng);
        if (!k2) return;
        var loss = rng.range(1.5, 4);
        s.districts[k2].mine = Math.max(0, s.districts[k2].mine - loss);
        r.infl[k2] = U.clamp((r.infl[k2] || 0) + loss * 0.7, 0, 100);
        report.push({ t: 'warn', rival: r.id,
          text: name + ' hat deine Preise ' + D.byId(D.DISTRICTS, k2).wo +
                ' unterboten. Einfluss -' + loss.toFixed(1) + '.' });
        r.lastAct = 'hat dich im Preis unterboten';
        break;
      }
      case 'poach': {
        var pool = s.crew.filter(function (c) { return !c.player && c.loyalty < 62; });
        if (!pool.length) { r.lastAct = 'wollte einen deiner Leute kaufen und scheiterte'; break; }
        var c = rng.pick(pool);
        c.loyalty = U.clamp(c.loyalty - rng.range(10, 22), 0, 100);
        report.push({ t: 'warn', rival: r.id,
          text: name + ' hat ' + c.name + ' ein Angebot gemacht. Loyalität jetzt bei ' + Math.round(c.loyalty) + '.' });
        r.lastAct = 'hat sich an deine Leute herangemacht';
        break;
      }
      case 'tip': {
        var add = rng.range(4, 11);
        s.heat = U.clamp(s.heat + add, 0, 100);
        report.push({ t: 'bad', rival: r.id,
          text: 'Jemand hat deinen Namen bei der Polizei genannt. Hitze +' + add.toFixed(1) +
                '. Das riecht nach ' + name + '.' });
        r.lastAct = 'hat mit der Polizei über dich gesprochen';
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
          text: name + ' ist gegen deine Betriebe vorgegangen. ' + U.money(cost) + ' an Schaden und entgangenem Geschäft.' });
        r.lastAct = 'ist direkt gegen dich vorgegangen';
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
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    var d = St.derive(s);
    var cost = negotiateCost(s, r, d);
    if (s.cash < cost) return { ok: false, why: 'Ein solches Treffen kostet ' + U.money(cost) + '.' };
    s.cash -= cost;
    s.stats.spent += cost;
    /* Wer Staerke mitbringt, wird ernster genommen. Mit 22 bis 36 Punkten
       je Treffen ist ein Buendnis in drei bis vier Gespraechen erreichbar,
       wenn man den Rivalen in der Zeit nicht gleichzeitig bekaempft. */
    var gain = 14 + Math.min(8, d.strength / 22);
    r.relation = U.clamp(r.relation + gain, -100, 100);
    r.truceUntil = s.day + 21;
    return { ok: true, cost: cost, relation: Math.round(r.relation),
      text: def(r.id).leader + ' ist zum Treffen gekommen. Das Verhältnis ist besser, und drei Wochen lang herrscht Waffenruhe.' };
  }

  /* Tribut: klein, billig, jederzeit. Verhandeln ist das grosse Treffen
     mit Waffenstillstand, Tribut die laufende Pflege dazwischen - ohne
     so etwas haengt Diplomatie allein an einem Knopf mit Abklingzeit. */
  function tributeCost(s, r, d) {
    return Math.round(U.clamp(d.grossIncome * 0.14, 2000, 40000));
  }

  function tribute(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    if (r.allied) return { ok: false, why: 'Ihr seid bereits verbündet.' };
    var d = St.derive(s);
    var cost = tributeCost(s, r, d);
    if (s.cash < cost) return { ok: false, why: 'Eine solche Geste kostet ' + U.money(cost) + '.' };
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
      text: def(r.id).leader + ' hat die Geste angenommen. Das Verhältnis steigt um ' + gain + '.' };
  }

  function canAlly(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    if (r.allied) return { ok: false, why: 'Bereits verbündet.' };
    if (r.relation < 42) return { ok: false, why: 'Das Verhältnis muss bei 42 oder besser liegen (derzeit ' + Math.round(r.relation) + ').' };
    var d = St.derive(s);
    var cost = Math.round(Math.max(25000, d.netWorth * 0.08));
    if (s.cash < cost) return { ok: false, why: 'Der Abschluss kostet ' + U.money(cost) + '.' };
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
      text: def(rivalId).leader + ' hat eingeschlagen. Man hält sich aus deinen Bezirken heraus und teilt, was man hört.' };
  }

  function breakAlly(s, rivalId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r || !r.allied) return { ok: false, why: 'Es gibt kein Bündnis zu brechen.' };
    r.allied = false;
    r.relation = U.clamp(r.relation - 55, -100, 100);
    s.rep = U.clamp(s.rep - 3, 0, 100);
    return { ok: true, text: 'Die Abmachung mit ' + def(rivalId).name + ' ist beendet. Man wird sich daran erinnern.' };
  }

  /* Druck machen: teuer, riskant, aber die einzige Art, jemanden
     dauerhaft aus einem Bezirk zu draengen. */
  function canPressure(s, rivalId, districtId) {
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    if (r.allied) return { ok: false, why: 'Ihr seid verbündet.' };
    if (!s.districts[districtId] || !s.districts[districtId].open) return { ok: false, why: 'Dort hast du keinen Fuß in der Tür.' };
    if ((r.infl[districtId] || 0) < 3) return { ok: false, why: 'In diesem Bezirk sind sie kaum vertreten.' };
    var d = St.derive(s);
    var cost = Math.round(Math.max(6000, d.grossIncome * 0.6));
    if (s.cash < cost) return { ok: false, why: 'Benötigt ' + U.money(cost) + '.' };
    if (d.strength < 18) return { ok: false, why: 'Deine Organisation ist nicht stark genug (nötig: 18).' };
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
    CE.fear.add(s, 8, 'Druck auf ' + def(rivalId).name + ' gemacht');
    var win = rng.chance(c.odds);
    if (win) {
      var taken = Math.min(r.infl[districtId], 6 + rng.next() * 4);
      r.infl[districtId] -= taken;
      s.districts[districtId].mine = U.clamp(s.districts[districtId].mine + taken * 0.85, 0, 100);
      r.strength = Math.max(10, r.strength - 4);
      s.rep = U.clamp(s.rep + 2, 0, 100);
      return { ok: true, win: true, cost: c.cost,
        text: 'Ihre Leute haben sich aus ' + D.byId(D.DISTRICTS, districtId).dat +
              ' zurückgezogen. Du hast ' + taken.toFixed(1) + ' Einfluss genommen.' };
    }
    s.rep = U.clamp(s.rep - 2, 0, 100);
    s.heat = U.clamp(s.heat + 4, 0, 100);
    return { ok: true, win: false, cost: c.cost,
      text: 'Sie haben sich nicht bewegt. Du hast ' + U.money(c.cost) + ' ausgegeben, Aufmerksamkeit erregt und einen Feind gemacht.' };
  }

  /* =============================================== Aggressive Wege

     Drei Handlungen, die ein vorsichtiger Spieler nie zu Gesicht
     bekommt, weil er die Furcht dafuer nicht aufbringt. Keine davon
     gibt bessere Werte - sie geben andere Moeglichkeiten:

       Schutzgeld   eine Einnahme, die keine Waesche braucht
       Hineinzwingen ein Bezirk ohne Eintrittsgeld
       Uebernehmen  ein Betrieb ohne Kaufpreis

     Jede kostet Beziehung, Hitze und Ansehen - und sie schliessen die
     seriose Seite des Spiels zu, solange die Furcht hoch bleibt.
  */

  function canDemandTribute(s, rivalId) {
    var F = CE.fear;
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    if (r.allied) return { ok: false, why: 'Einen Verbündeten erpresst man nicht.' };
    if ((s.tributes || []).some(function (t) { return t.rival === rivalId; })) {
      return { ok: false, why: 'Sie zahlen bereits an dich.' };
    }
    if ((s.fear || 0) < F.TORE.tribute) {
      return { ok: false, why: 'Sie fürchten dich noch nicht genug (nötig: ' + F.TORE.tribute + ' Furcht).' };
    }
    var d = St.derive(s);
    if (d.strength < r.strength * 0.9) {
      return { ok: false, why: 'Du bist nicht stark genug für diese Forderung.' };
    }
    var odds = U.clamp(0.3 + ((s.fear || 0) - F.TORE.tribute) / 90 +
      (d.strength - r.strength) / 180, 0.15, 0.9);
    return { ok: true, odds: odds };
  }

  function demandTribute(s, rng, rivalId) {
    var pre = canDemandTribute(s, rivalId);
    if (!pre.ok) return pre;
    var r = U.byId(s.rivals, rivalId), rd = def(rivalId);
    var d = St.derive(s);

    r.relation = U.clamp(r.relation - 26, -100, 100);
    s.heat = U.clamp(s.heat + 4, 0, 100);
    CE.fear.add(s, 6, 'Schutzgeld gefordert');

    if (rng.chance(pre.odds)) {
      if (!s.tributes) s.tributes = [];
      s.tributes.push({ rival: rivalId, since: s.day, weeks: 0 });
      r.strength = Math.max(12, r.strength - 6);
      return { ok: true, win: true,
        text: rd.leader + ' hat eingewilligt. Sie zahlen wöchentlich Schutzgeld, und niemand schreibt es auf.' };
    }
    /* Ein gescheiterter Versuch macht einen dauerhaften Feind. */
    r.relation = U.clamp(r.relation - 18, -100, 100);
    r.truceUntil = -1;
    s.rep = U.clamp(s.rep - 2, 0, 100);
    return { ok: true, win: false,
      text: rd.leader + ' hat dich auflaufen lassen. Seitdem bereitet man sich auf dich vor.' };
  }

  function stopTribute(s, rivalId) {
    if (!s.tributes) return { ok: false, why: 'Da ist nichts zu beenden.' };
    var vorher = s.tributes.length;
    s.tributes = s.tributes.filter(function (t) { return t.rival !== rivalId; });
    if (s.tributes.length === vorher) return { ok: false, why: 'Sie zahlen nicht an dich.' };
    var r = U.byId(s.rivals, rivalId);
    if (r) r.relation = U.clamp(r.relation + 14, -100, 100);
    return { ok: true, text: 'Du hast sie laufen lassen. Auch daran wird man sich erinnern.' };
  }

  /* Betrieb uebernehmen: statt zu kaufen, nimmt man einen. Er kommt
     beschaedigt und heiss, aber er kostet nichts. */
  function canSeize(s, rivalId, districtId) {
    var F = CE.fear;
    var r = U.byId(s.rivals, rivalId);
    if (!r) return { ok: false, why: 'Unbekannte Organisation.' };
    if (r.allied) return { ok: false, why: 'Ihr seid verbündet.' };
    if ((s.fear || 0) < F.TORE.seize) {
      return { ok: false, why: 'Jemandem einen Betrieb einfach wegzunehmen braucht ' + F.TORE.seize + ' Furcht.' };
    }
    if (!s.districts[districtId] || !s.districts[districtId].open) {
      return { ok: false, why: 'Dort hast du keinen Fuß in der Tür.' };
    }
    if ((r.infl[districtId] || 0) < 10) return { ok: false, why: 'Dort haben sie nichts, was sich zu nehmen lohnt.' };
    if (r.biz < 2) return { ok: false, why: 'Es ist zu wenig übrig, um etwas zu nehmen.' };
    var d = St.derive(s);
    var raum = CE.empire.maxBusinesses(s, districtId, d.rank);
    var haben = s.businesses.filter(function (b) { return b.district === districtId; }).length;
    if (haben >= raum) return { ok: false, why: 'In diesem Bezirk ist kein Platz für einen weiteren Betrieb.' };
    var odds = U.clamp(0.28 + (d.strength - r.strength) / 150 + ((s.fear || 0) - 55) / 120, 0.12, 0.85);
    return { ok: true, odds: odds };
  }

  function seize(s, rng, rivalId, districtId) {
    var pre = canSeize(s, rivalId, districtId);
    if (!pre.ok) return pre;
    var r = U.byId(s.rivals, rivalId), rd = def(rivalId);
    var dist = D.byId(D.DISTRICTS, districtId);

    r.relation = U.clamp(r.relation - 34, -100, 100);
    r.truceUntil = -1;
    s.heat = U.clamp(s.heat + 9, 0, 100);
    s.rep = U.clamp(s.rep - 3, 0, 100);
    CE.fear.add(s, 12, 'einen Betrieb übernommen');

    if (!rng.chance(pre.odds)) {
      s.districts[districtId].mine = Math.max(0, s.districts[districtId].mine - 4);
      return { ok: true, win: false,
        text: 'Es ging schief. Ihre Leute haben gewartet, und du hast ' + dist.wo + ' Boden verloren.' };
    }

    /* Was man nimmt, haengt davon ab, was dort ueberhaupt Sinn ergibt. */
    var moeglich = D.BUSINESSES.filter(function (b) {
      return b.tier <= dist.tier + 1 && !b.legal;
    });
    if (!moeglich.length) moeglich = D.BUSINESSES.filter(function (b) { return b.tier <= dist.tier; });
    var def2 = rng.pick(moeglich);

    var b = {
      id: U.nextId(s, 'b'), type: def2.id, district: districtId, level: 1,
      name: def2.name, bought: s.day, shut: 0,
      /* Uebernommen heisst nicht uebergeben: die Leute vor Ort brauchen
         Wochen, bis sie fuer einen arbeiten. */
      damage: 0.45, seized: true, seizedOn: s.day
    };
    s.businesses.push(b);
    r.biz = Math.max(0, r.biz - 1);
    r.infl[districtId] = Math.max(0, (r.infl[districtId] || 0) - 7);
    r.strength = Math.max(12, r.strength - 5);
    s.districts[districtId].mine = U.clamp(s.districts[districtId].mine + 5, 0, 100);
    s.stats.seized = (s.stats.seized || 0) + 1;

    return { ok: true, win: true, biz: b,
      text: 'Du hast ihnen ' + def2.name + ' ' + dist.wo +
            ' weggenommen. Der Betrieb gehört dir, er ist beschädigt, und alle haben es gesehen.' };
  }

  function relationLabel(v) {
    if (v >= 70) return 'Verbündet';
    if (v >= 35) return 'Freundlich';
    if (v >= 10) return 'Verbindlich';
    if (v > -15) return 'Neutral';
    if (v > -45) return 'Kühl';
    if (v > -75) return 'Feindselig';
    return 'Im Krieg';
  }

  CE.rivals = {
    weekly: weekly, totalInfl: totalInfl, negotiate: negotiate, negotiateCost: negotiateCost,
    canAlly: canAlly, ally: ally, breakAlly: breakAlly, canPressure: canPressure,
    tribute: tribute, tributeCost: tributeCost, zielText: zielText, neuesZiel: neuesZiel,
    canDemandTribute: canDemandTribute, demandTribute: demandTribute, stopTribute: stopTribute,
    canSeize: canSeize, seize: seize,
    pressureRival: pressureRival, pressureOdds: pressureOdds, relationLabel: relationLabel,
    friction: friction
  };
})(typeof window !== 'undefined' ? window : globalThis);
