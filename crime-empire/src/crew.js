/* ---------------------------------------------------------------------
   Mannschaft: Bewerber erzeugen, einstellen, bezahlen, entlassen.

   Leitgedanke: niemand ist austauschbar. Jeder Bewerber hat Faehigkeit,
   Potenzial, Gehaltsvorstellung und zwei Eigenschaften, die zueinander
   passen muessen - ein gieriger Anfaenger ist ein schlechtes Geschaeft,
   ein loyaler Veteran ein Glueckstreffer.

   Loyalitaet ist die Waehrung dieses Systems. Sie faellt, wenn man
   unterbezahlt, die Hitze hochlaesst oder Leute uebergeht, und sie
   entscheidet, ob jemand kuendigt, stiehlt oder redet.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* Gehaltsforderung: Rolle, Faehigkeit und Eigenschaften. Bewusst
     ueberlinear - ein Zehner kostet mehr als zwei Fuenfer, und das soll
     man spueren. */
  function askingSalary(role, skill, traits) {
    var base = role.pay * (0.55 + Math.pow(skill / 10, 1.45) * 1.25);
    for (var i = 0; i < traits.length; i++) {
      var t = D.byId(D.TRAITS, traits[i]);
      if (t && t.payMul) base *= (1 + t.payMul);
    }
    return Math.max(120, Math.round(base / 10) * 10);
  }

  function makeRecruit(s, rng, opts) {
    opts = opts || {};
    var d = St.derive(s);
    var roles = D.ROLES.filter(function (r) { return !r.fixed; });
    var role = opts.role ? D.byId(D.ROLES, opts.role) : rng.pick(roles);

    /* Ansehen und die Anwerbung bestimmen, wer ueberhaupt vorspricht. */
    /* Wer gefuerchtet wird, bekommt, wer uebrig bleibt. */
    var tier = (s.rep / 100) * 3.2 + (s.org.recruiting || 0) * 1.0 + (opts.bonus || 0) -
               (d.recruitPenalty || 0);
    var skill = Math.round(U.clamp(rng.bell(1.5, 6.5) + tier, 1, 10));
    var potential = Math.round(U.clamp(skill + rng.bell(0, 4.2), skill, 12));

    /* Eigenschaften: eine, manchmal zwei, nie widerspruechlich. */
    var pool = D.TRAITS.slice();
    rng.shuffle(pool);
    var traits = [];
    var exclude = { loyal: 'greedy', greedy: 'loyal', veteran: 'green', green: 'veteran',
                    discreet: 'reckless', reckless: 'discreet' };
    for (var i = 0; i < pool.length && traits.length < (rng.chance(0.45) ? 2 : 1); i++) {
      var t = pool[i];
      if (exclude[t.id] && traits.indexOf(exclude[t.id]) >= 0) continue;
      if (t.id === 'green' && skill >= 6) continue;
      if (t.id === 'veteran' && skill < 6) continue;
      traits.push(t.id);
    }

    var loyalty = Math.round(U.clamp(
      rng.bell(38, 72) + (s.rep * 0.18) + (s.org.recruiting || 0) * 8 +
      (traits.indexOf('loyal') >= 0 ? 18 : 0) + (traits.indexOf('greedy') >= 0 ? -12 : 0), 15, 98));

    var name = rng.pick(D.FIRST) + ' ' + rng.pick(D.LAST);
    if (rng.chance(0.22)) {
      var parts = name.split(' ');
      name = parts[0] + ' "' + rng.pick(D.NICK) + '" ' + parts[1];
    }

    return {
      id: U.nextId(s, 'r'),
      name: name, role: role.id, skill: skill, potential: potential,
      loyalty: loyalty, traits: traits, ask: askingSalary(role, skill, traits),
      face: rng.int(0, 999999), xp: 0
    };
  }

  /* Bewerberliste erneuern. Laeuft jede Woche und bei "Search". */
  function refreshRecruits(s, rng, count) {
    var n = count || (3 + Math.min(3, Math.floor(s.rep / 25)));
    s.recruits = [];
    for (var i = 0; i < n; i++) s.recruits.push(makeRecruit(s, rng));
    return s.recruits;
  }

  function hire(s, recruitId, salary) {
    var r = U.byId(s.recruits, recruitId);
    if (!r) return { ok: false, why: 'Diese Person ist nicht mehr zu haben.' };
    var d = St.derive(s);
    var paid = s.crew.filter(function (c) { return !c.player; }).length;
    if (paid >= d.crewCap) return { ok: false, why: 'Kein Platz. Kauf einen Unterschlupf, um mehr Leute führen zu können.' };

    salary = Math.round(salary === undefined ? r.ask : salary);
    var signing = Math.round(r.ask * 1.6);
    if (s.cash < signing) return { ok: false, why: 'Du kannst die Antrittszahlung von ' + U.money(signing) + ' nicht aufbringen.' };

    /* Wer unter Forderung anbietet, bekommt weniger Loyalitaet - oder
       eine Absage. Beides wird vorher angezeigt. */
    var ratio = salary / r.ask;
    if (ratio < 0.7) return { ok: false, why: 'Über ' + U.money(salary) + ' hat die Person nur gelacht und ist gegangen.' };
    var loyalty = U.clamp(Math.round(r.loyalty + (ratio - 1) * 70), 5, 100);

    s.cash -= signing;
    s.stats.spent += signing;
    var c = {
      id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
      potential: r.potential, xp: 0, loyalty: loyalty, salary: salary,
      traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
      face: r.face, mood: '', raises: 0
    };
    s.crew.push(c);
    s.recruits = s.recruits.filter(function (x) { return x.id !== recruitId; });
    return { ok: true, crew: c, signing: signing };
  }

  /* Jemanden aus der Organisation nehmen - die einzige richtige Art.

     Wer geht, verschwindet auch aus laufenden Auftraegen. Vorher blieb
     seine Kennung in run.crew stehen, und beim Abrechnen suchte ops.js
     einen Menschen, den es nicht mehr gab: "Cannot set properties of
     null". Das ist kein Randfall - Leute kuendigen, werden abgeworben,
     rausgeworfen oder verschwinden nach einer Entscheidung, und alles
     davon kann passieren, waehrend sie unterwegs sind.

     Bleibt ein Auftrag ohne einen einzigen Kopf zurueck, platzt er.
     Das ist ehrlicher, als ihn geisterhaft weiterlaufen zu lassen. */
  function remove(s, crewId, report) {
    var weg = U.byId(s.crew, crewId);
    if (!weg) return null;
    s.crew = s.crew.filter(function (x) { return x.id !== crewId; });

    for (var i = s.ops.length - 1; i >= 0; i--) {
      var run = s.ops[i];
      var idx = run.crew.indexOf(crewId);
      if (idx < 0) continue;
      run.crew.splice(idx, 1);
      if (!run.crew.length) {
        s.ops.splice(i, 1);
        if (report) {
          report.push({ t: 'bad', text: run.offer.name + ' ist geplatzt - ' + weg.name +
            ' war allein darauf angesetzt und ist weg.' });
        }
      } else {
        /* Weniger Leute, schlechtere Aussicht. */
        run.odds = U.clamp(run.odds - 0.18, 0.04, 0.93);
        if (report) {
          report.push({ t: 'warn', text: weg.name + ' ist bei ' + run.offer.name +
            ' ausgestiegen. Der Rest macht mit ' + Math.round(run.odds * 100) + '% weiter.' });
        }
      }
    }
    return weg;
  }

  function fire(s, crewId) {
    var c = U.byId(s.crew, crewId);
    if (!c || c.player) return { ok: false, why: 'Dich selbst kannst du nicht entlassen.' };
    var severance = Math.round(c.salary * 2);
    if (s.cash < severance) return { ok: false, why: 'Die Abfindung von ' + U.money(severance) + ' ist mehr, als du hast.' };
    s.cash -= severance;
    remove(s, crewId);
    /* Andere sehen zu. Wer Leute rauswirft, verliert etwas Vertrauen. */
    for (var i = 0; i < s.crew.length; i++) if (!s.crew[i].player) s.crew[i].loyalty = U.clamp(s.crew[i].loyalty - 4, 0, 100);
    return { ok: true, severance: severance };
  }

  function setSalary(s, crewId, salary) {
    var c = U.byId(s.crew, crewId);
    if (!c || c.player) return { ok: false, why: 'Nicht möglich.' };
    var old = c.salary;
    var fair = fairSalary(c);
    salary = Math.max(100, Math.round(salary));
    c.salary = salary;
    if (salary > old) {
      c.loyalty = U.clamp(c.loyalty + Math.min(22, (salary - old) / Math.max(120, fair) * 40), 0, 100);
      c.raises = (c.raises || 0) + 1;
    } else if (salary < old) {
      c.loyalty = U.clamp(c.loyalty - Math.min(35, (old - salary) / Math.max(120, fair) * 55), 0, 100);
    }
    return { ok: true, from: old, to: salary };
  }

  /* Was jemand nach heutigem Stand wert ist - Grundlage fuer Unmut. */
  function fairSalary(c) {
    var role = D.byId(D.ROLES, c.role);
    return askingSalary(role, St.effectiveSkill(c), c.traits);
  }

  function assign(s, crewId, bizId) {
    var c = U.byId(s.crew, crewId);
    if (!c) return { ok: false, why: 'Unbekanntes Crew-Mitglied.' };
    if (c.player) return { ok: false, why: 'Du führst die Organisation, du stehst nicht hinter der Theke.' };
    if (c.busyUntil > s.day) return { ok: false, why: c.name + ' ist auf einem Auftrag unterwegs.' };
    if (bizId === null) { c.post = null; return { ok: true }; }
    var b = U.byId(s.businesses, bizId);
    if (!b) return { ok: false, why: 'Unbekannter Betrieb.' };
    var role = D.byId(D.ROLES, c.role);
    if (role.slot !== 'business') return { ok: false, why: role.name + ' arbeitet für die Organisation, nicht für einen einzelnen Betrieb.' };
    var f = St.bizFinance(s, b);
    if (f.filled >= f.slots && c.post !== bizId) return { ok: false, why: 'Dort ist keine Stelle frei.' };
    c.post = bizId;
    return { ok: true };
  }

  /* Woechentliche Entwicklung: Erfahrung, Loyalitaet, Stimmung. */
  function weekly(s, rng, d, report) {
    var quitters = [];
    for (var i = 0; i < s.crew.length; i++) {
      var c = s.crew[i];
      if (c.player) { c.xp += 6; continue; }

      /* Erfahrung sammelt, wer arbeitet. */
      var working = c.post || c.busyUntil > s.day;
      var xpGain = (working ? 11 : 4);
      var t = traitMod(c, 'xpMul');
      c.xp += Math.round(xpGain * (1 + t));
      var cap = c.potential * 100 - (c.skill * 100);
      if (c.xp > cap) c.xp = cap;

      /* Loyalitaet: Bezahlung gegen Wert, Hitze, Untaetigkeit. */
      var fair = fairSalary(c);
      var payGap = (c.salary - fair) / fair;              /* negativ = unterbezahlt */
      var drift = 0;
      if (payGap < -0.12) drift -= Math.min(6, -payGap * 14);
      else if (payGap > 0.15) drift += Math.min(2.4, payGap * 5);
      else drift += 0.5;
      if (s.heat > 60) drift -= (s.heat - 60) * 0.06;
      if (!working) drift -= 0.8;                          /* Leerlauf zermuerbt */
      if (s.rep > 55) drift += 0.5;
      drift -= traitMod(c, 'loyaltyDecay');
      drift += (d && d.secondHand) || 0;    /* eine rechte Hand haelt Ordnung */
      c.loyalty = U.clamp(c.loyalty + drift, 0, 100);

      c.mood = c.loyalty > 75 ? 'loyal' : (c.loyalty > 45 ? 'steady' : (c.loyalty > 22 ? 'restless' : 'hostile'));

      /* Spieler mit Eigenschaft "gambler" verliert gelegentlich Geld. */
      if (St.hasTrait(c, 'gambler') && rng.chance(0.06)) {
        var loss = Math.round(c.salary * rng.range(2, 6));
        if (loss > 0 && s.cash > loss) {
          s.cash -= loss;
          report.push({ t: 'bad', text: c.name + ' hat ' + U.money(loss) + ' aus der Kasse am Kartentisch verloren.' });
          c.loyalty = U.clamp(c.loyalty - 3, 0, 100);
        }
      }

      /* Kuendigung: nur bei echtem Unmut, und nie ohne Vorwarnung -
         die Warnung kommt als Ereignis, wenn loyalty unter 30 faellt. */
      if (c.loyalty < 14 && rng.chance(0.22 + (14 - c.loyalty) * 0.03)) quitters.push(c);
    }

    for (var j = 0; j < quitters.length; j++) {
      var q = quitters[j];
      remove(s, q.id, report);
      report.push({ t: 'bad', text: q.name + ' ist gegangen. Die Loyalität lag seit Wochen am Boden.' });
      /* Wer verbittert geht, redet manchmal. */
      if (rng.chance(0.3)) {
        s.heat = U.clamp(s.heat + 4, 0, 100);
        report.push({ t: 'bad', text: 'Es heißt, ' + q.name + ' redet. Hitze +4.' });
      }
    }
    return quitters;
  }

  function traitMod(c, key) {
    var v = 0;
    for (var i = 0; i < c.traits.length; i++) {
      var t = D.byId(D.TRAITS, c.traits[i]);
      if (t && t[key]) v += t[key];
    }
    return v;
  }

  /* Bonuszahlung: schnelles Mittel gegen Unmut, kostet Geld. */
  function bonus(s, crewId) {
    var c = U.byId(s.crew, crewId);
    if (!c || c.player) return { ok: false, why: 'Nicht möglich.' };
    var amount = Math.round(c.salary * 4);
    if (s.cash < amount) return { ok: false, why: 'Du brauchst ' + U.money(amount) + '.' };
    s.cash -= amount;
    c.loyalty = U.clamp(c.loyalty + 16, 0, 100);
    return { ok: true, amount: amount };
  }

  /* Befoerderung: teurer Dauerposten, aber ein grosser Sprung. */
  function promote(s, crewId) {
    var c = U.byId(s.crew, crewId);
    if (!c || c.player) return { ok: false, why: 'Nicht möglich.' };
    if (St.effectiveSkill(c) >= c.potential) return { ok: false, why: c.name + ' kann in dieser Rolle nichts mehr dazulernen.' };
    var cost = Math.round(fairSalary(c) * 3);
    if (s.cash < cost) return { ok: false, why: 'Schulung und neuer Titel kosten ' + U.money(cost) + '.' };
    s.cash -= cost;
    c.skill = Math.min(c.potential, c.skill + 1);
    c.loyalty = U.clamp(c.loyalty + 12, 0, 100);
    c.salary = Math.round(c.salary * 1.18);
    return { ok: true, cost: cost, skill: c.skill };
  }

  CE.crew = {
    remove: remove, makeRecruit: makeRecruit, refreshRecruits: refreshRecruits, hire: hire, fire: fire,
    setSalary: setSalary, fairSalary: fairSalary, assign: assign, weekly: weekly,
    bonus: bonus, promote: promote, askingSalary: askingSalary, traitMod: traitMod
  };
})(typeof window !== 'undefined' ? window : globalThis);
