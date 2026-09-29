/* ---------------------------------------------------------------------
   Ereignisse und Entscheidungen.

   Ein Ereignis ist kein Zufallstext. Jedes hat eine Bedingung, die am
   tatsaechlichen Spielstand haengt - ohne Mannschaft gibt es keine
   Gehaltsforderung, ohne Untergrundbetrieb keine Razziawarnung. Die
   Auswahl ist gewichtet und merkt sich, was schon kam.

   Jede Option nennt *vorher*, was sie kostet, und wirkt danach ueber
   apply(). Manche setzen eine Nachwirkung in s.pending, die Tage spaeter
   zuschlaegt - so bekommen Entscheidungen ein Gedaechtnis.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* Hilfsfunktion fuer Wirkungen. Alles laeuft hierdurch, damit jeder
     Effekt automatisch einen lesbaren Satz erzeugt. */
  function fx(s, e) {
    var parts = [];
    if (e.cash) { s.cash += e.cash; (e.cash > 0 ? s.stats.earned += e.cash : s.stats.spent += -e.cash); parts.push(U.moneySigned(e.cash)); }
    if (e.rep) { s.rep = U.clamp(s.rep + e.rep, 0, 100); parts.push((e.rep > 0 ? '+' : '') + e.rep.toFixed(1) + ' reputation'); }
    if (e.heat) { s.heat = U.clamp(s.heat + e.heat, 0, 100); parts.push((e.heat > 0 ? '+' : '') + e.heat.toFixed(1) + ' heat'); }
    if (e.infl && e.district) {
      s.districts[e.district].mine = U.clamp(s.districts[e.district].mine + e.infl, 0, 100);
      parts.push((e.infl > 0 ? '+' : '') + e.infl.toFixed(1) + ' influence in ' + D.byId(D.DISTRICTS, e.district).name);
    }
    if (e.loyaltyAll) {
      for (var i = 0; i < s.crew.length; i++) if (!s.crew[i].player) s.crew[i].loyalty = U.clamp(s.crew[i].loyalty + e.loyaltyAll, 0, 100);
      parts.push((e.loyaltyAll > 0 ? '+' : '') + e.loyaltyAll + ' loyalty across the crew');
    }
    if (e.crew && e.loyalty) {
      e.crew.loyalty = U.clamp(e.crew.loyalty + e.loyalty, 0, 100);
      parts.push(e.crew.name + ' ' + (e.loyalty > 0 ? '+' : '') + e.loyalty + ' loyalty');
    }
    if (e.relation && e.rival) {
      e.rival.relation = U.clamp(e.rival.relation + e.relation, -100, 100);
      parts.push(D.byId(D.RIVALS, e.rival.id).name + ' ' + (e.relation > 0 ? '+' : '') + e.relation + ' relations');
    }
    return parts.join(', ');
  }

  function later(s, days, kind, payload) {
    s.pending.push({ day: s.day + days, kind: kind, data: payload || {} });
  }

  /* ------------------------------------------------------- Katalog

     when(s, ctx)  - darf das Ereignis jetzt kommen?
     build(s, ctx) - Titel, Text und Optionen, bereits mit den konkreten
                     Namen und Zahlen dieses Spielstands gefuellt.
  */
  var EVENTS = [

    /* --- Mannschaft ------------------------------------------------ */
    {
      id: 'raise', w: 2.4, cool: 6,
      when: function (s, c) { return c.unhappy.length > 0; },
      build: function (s, c) {
        var e = c.rng.pick(c.unhappy);
        var fair = CE.crew.fairSalary(e);
        var want = Math.round(Math.max(fair, e.salary * 1.35) / 10) * 10;
        var diff = want - e.salary;
        return {
          title: 'The Loyalty Problem', tone: 'crew', who: e.id,
          text: e.name + ' caught you on the way out. They have been carrying more than they ' +
                'are paid for, and they know what the job is worth now: ' + U.money(want) +
                ' a week instead of ' + U.money(e.salary) + '.',
          options: [
            { label: 'Pay it', hint: U.moneySigned(-diff) + '/week, loyalty up',
              go: function () {
                CE.crew.setSalary(s, e.id, want);
                return e.name + ' is back at work and means it. ' + fx(s, { crew: e, loyalty: 10 });
              } },
            { label: 'Refuse', hint: 'Free now. They will remember.',
              go: function () {
                var r = fx(s, { crew: e, loyalty: -22 });
                later(s, 14, 'grudge', { crew: e.id });
                return 'You told them the number was the number. ' + r;
              } },
            { label: 'Offer a promotion instead', hint: U.money(Math.round(fair * 3)) + ' once, permanent skill gain',
              disabled: s.cash < Math.round(fair * 3) || St.effectiveSkill(e) >= e.potential,
              why: s.cash < Math.round(fair * 3) ? 'Not enough cash.' : 'They have nothing left to learn.',
              go: function () {
                var res = CE.crew.promote(s, e.id);
                return res.ok
                  ? e.name + ' took the title over the money. ' + fx(s, { crew: e, loyalty: 6 })
                  : res.why;
              } },
            { label: 'Cut them loose', hint: 'Severance ' + U.money(e.salary * 2) + ', crew morale down',
              disabled: s.cash < e.salary * 2, why: 'You cannot cover severance.',
              go: function () {
                var n = e.name;
                CE.crew.fire(s, e.id);
                return n + ' cleared out the same afternoon. The rest of the crew watched.';
              } }
          ]
        };
      }
    },
    {
      id: 'poached', w: 1.6, cool: 8,
      when: function (s, c) { return c.paid.length > 0 && c.enemies.length > 0; },
      build: function (s, c) {
        var e = c.rng.pick(c.paid);
        var r = c.rng.pick(c.enemies);
        var rd = D.byId(D.RIVALS, r.id);
        var counter = Math.round(e.salary * 0.6 / 10) * 10;
        return {
          title: 'A Better Offer', tone: 'crew', who: e.id,
          text: rd.leader + ' has been buying ' + e.name + ' lunch. The number on the table is ' +
                'better than yours, and ' + e.name + ' told you about it — which is either ' +
                'loyalty or leverage.',
          options: [
            { label: 'Match and raise', hint: U.moneySigned(-counter) + '/week',
              go: function () {
                CE.crew.setSalary(s, e.id, e.salary + counter);
                return fx(s, { crew: e, loyalty: 14, rival: r, relation: -6 });
              } },
            { label: 'Let them decide', hint: 'Costs nothing. Might cost everything.',
              go: function () {
                if (c.rng.chance(0.45 + (60 - e.loyalty) / 160)) {
                  var n = e.name;
                  s.crew = s.crew.filter(function (x) { return x.id !== e.id; });
                  r.strength += 5;
                  return n + ' took the offer and walked. ' + rd.name + ' is stronger for it.';
                }
                return e.name + ' stayed. They wanted to be asked, not bought. ' + fx(s, { crew: e, loyalty: 8 });
              } },
            { label: 'Tell ' + rd.leader.split(' ')[0] + ' to stop', hint: 'Relations down, crew watching',
              go: function () {
                return fx(s, { rival: r, relation: -14, crew: e, loyalty: 6, rep: 1 });
              } }
          ]
        };
      }
    },
    {
      id: 'skimming', w: 1.3, cool: 10,
      when: function (s, c) { return c.paid.length > 1 && s.businesses.length > 0; },
      build: function (s, c) {
        var e = c.rng.pick(c.paid);
        var amount = Math.round(Math.max(1200, c.d.grossIncome * 0.08));
        return {
          title: 'The Books Do Not Close', tone: 'crew', who: e.id,
          text: 'Roughly ' + U.money(amount) + ' has gone missing over a month. The trail ends at ' +
                e.name + ', and the evidence is suggestive rather than certain.',
          options: [
            { label: 'Confront them', hint: 'If you are right, you get it back',
              go: function () {
                if (c.rng.chance(0.62)) {
                  return e.name + ' folded and paid it back. ' + fx(s, { cash: amount, crew: e, loyalty: -14 });
                }
                return 'It was not them. ' + e.name + ' has not forgotten being accused. ' +
                       fx(s, { crew: e, loyalty: -18, loyaltyAll: -2 });
              } },
            { label: 'Say nothing and watch', hint: 'Costs the money for now',
              go: function () {
                later(s, 21, 'skim', { crew: e.id, amount: amount });
                return 'You let it run. Whoever it is will get comfortable, and comfortable people get careless.';
              } },
            { label: 'Make an example', hint: 'Loyalty falls, nobody tries again',
              go: function () {
                var n = e.name;
                CE.crew.fire(s, e.id);
                s.flags.exampleMade = (s.flags.exampleMade || 0) + 1;
                return n + ' is gone and everyone knows why. ' + fx(s, { loyaltyAll: -6, rep: 1, heat: 2 });
              } }
          ]
        };
      }
    },

    /* --- Geschaeft -------------------------------------------------- */
    {
      id: 'windfall', w: 1.5, cool: 5,
      when: function (s) { return s.businesses.length > 0; },
      build: function (s, c) {
        var b = c.rng.pick(s.businesses);
        var f = St.bizFinance(s, b);
        var cost = Math.round(f.gross * 1.8);
        return {
          title: 'More Than It Can Hold', tone: 'money',
          text: b.name + ' has been turning away business for a month. There is room to grow ' +
                'here if you put money in now — or you can take the surplus out and move on.',
          options: [
            { label: 'Reinvest ' + U.money(cost), hint: 'Permanent +12% income at this site',
              disabled: s.cash < cost, why: 'Not enough cash.',
              go: function () {
                s.cash -= cost; s.stats.spent += cost;
                b.boost = (b.boost || 0) + 0.12;
                return b.name + ' is being rebuilt around the demand. Income up 12% for good.';
              } },
            { label: 'Take the surplus', hint: U.moneySigned(Math.round(f.gross * 1.1)),
              go: function () { return fx(s, { cash: Math.round(f.gross * 1.1) }); } },
            { label: 'Keep it quiet', hint: 'Less attention, small influence gain',
              go: function () { return fx(s, { heat: -3, infl: 1.5, district: b.district }); } }
          ]
        };
      }
    },
    {
      id: 'shakedown', w: 1.4, cool: 6,
      when: function (s) { return s.businesses.length > 0 && s.day > 21; },
      build: function (s, c) {
        var b = c.rng.pick(s.businesses);
        var demand = Math.round(Math.max(2000, c.d.grossIncome * 0.22));
        return {
          title: 'An Inspector Calls', tone: 'heat',
          text: 'A city inspector found eleven violations at ' + b.name + ' in forty minutes, ' +
                'and mentioned twice that most of them are discretionary.',
          options: [
            { label: 'Pay the man', hint: U.moneySigned(-demand) + ', heat down',
              disabled: s.cash < demand, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -demand, heat: -4 }); } },
            { label: 'Fix the violations properly', hint: U.moneySigned(-Math.round(demand * 1.6)) + ', reputation up',
              disabled: s.cash < demand * 1.6, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -Math.round(demand * 1.6), rep: 2.5, heat: -2 }); } },
            { label: 'Throw him out', hint: 'Free. Heat up sharply.',
              go: function () {
                later(s, 10, 'inspection', { biz: b.id });
                return fx(s, { heat: 9, rep: 0.5 }) + '. He left with his notebook out.';
              } }
          ]
        };
      }
    },
    {
      id: 'downturn', w: 1.1, cool: 9,
      when: function (s) { return s.businesses.length >= 2; },
      build: function (s, c) {
        var b = c.rng.pick(s.businesses);
        var loss = Math.round(St.bizFinance(s, b).gross * 2.2);
        return {
          title: 'A Bad Quarter', tone: 'money',
          text: b.name + ' is bleeding. Foot traffic is down, two competitors opened on the same ' +
                'street, and the losses so far come to ' + U.money(loss) + '.',
          options: [
            { label: 'Cover the losses', hint: U.moneySigned(-loss),
              disabled: s.cash < loss, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -loss }); } },
            { label: 'Cut costs to the bone', hint: 'Half the loss, output damaged for weeks',
              go: function () {
                b.damage = U.clamp((b.damage || 0) + 0.4, 0, 0.8);
                return fx(s, { cash: -Math.round(loss / 2) }) + '. Output at ' + b.name + ' will suffer until it recovers.';
              } },
            { label: 'Sell it', hint: U.moneySigned(Math.round(St.bizValue(s, b) * 0.68)),
              go: function () {
                var r = CE.empire.sell(s, b.id);
                return b.name + ' is somebody else’s problem. ' + U.money(r.price) + ' recovered.';
              } }
          ]
        };
      }
    },

    /* --- Rivalen ---------------------------------------------------- */
    {
      id: 'offer_partnership', w: 1.3, cool: 8,
      when: function (s, c) { return c.friendly.length > 0 && s.businesses.length >= 2; },
      build: function (s, c) {
        var r = c.rng.pick(c.friendly);
        var rd = D.byId(D.RIVALS, r.id);
        var buyIn = Math.round(Math.max(15000, c.d.netWorth * 0.06));
        var k = c.rng.pick(Object.keys(s.districts).filter(function (x) { return s.districts[x].open; }));
        return {
          title: 'A Proposal', tone: 'rival', who: r.id,
          text: rd.leader + ' wants a joint interest in ' + D.byId(D.DISTRICTS, k).name +
                '. Their people, your ground, split the take. The buy-in is ' + U.money(buyIn) + '.',
          options: [
            { label: 'Take the deal', hint: U.moneySigned(-buyIn) + ', relations and influence up',
              disabled: s.cash < buyIn, why: 'Not enough cash.',
              go: function () {
                return fx(s, { cash: -buyIn, rival: r, relation: 25, infl: 6, district: k, rep: 1.5 });
              } },
            { label: 'Counter: your ground, your rules', hint: 'Might insult them',
              go: function () {
                if (c.rng.chance(0.4)) return fx(s, { rival: r, relation: 12, infl: 3, district: k }) +
                  '. They blinked first.';
                return fx(s, { rival: r, relation: -18 }) + '. ' + rd.leader.split(' ')[0] + ' does not counter twice.';
              } },
            { label: 'Decline politely', hint: 'Small relations hit',
              go: function () { return fx(s, { rival: r, relation: -5 }); } }
          ]
        };
      }
    },
    {
      id: 'territory_dispute', w: 1.5, cool: 7,
      when: function (s, c) { return c.contested.length > 0 && s.day > 28; },
      build: function (s, c) {
        var pair = c.rng.pick(c.contested);
        var r = pair.rival, k = pair.district;
        var rd = D.byId(D.RIVALS, r.id);
        var cost = Math.round(Math.max(5000, c.d.grossIncome * 0.5));
        return {
          title: 'A Line in ' + D.byId(D.DISTRICTS, k).name, tone: 'rival', who: r.id,
          text: rd.name + ' has people working the same corners as yours. Somebody is going to ' +
                'give ground this week, and it will be decided one way or another.',
          options: [
            { label: 'Push them out', hint: U.moneySigned(-cost) + ', outcome uncertain',
              disabled: s.cash < cost, why: 'Not enough cash.',
              go: function () {
                s.cash -= cost;
                var odds = U.clamp(0.35 + (c.d.strength - r.strength) / 140, 0.12, 0.88);
                if (c.rng.chance(odds)) {
                  r.infl[k] = Math.max(0, r.infl[k] - 7);
                  return fx(s, { infl: 6, district: k, rival: r, relation: -18, rep: 2, heat: 3 }) + '. They moved.';
                }
                return fx(s, { infl: -3, district: k, rival: r, relation: -14, heat: 4, rep: -1 }) +
                       '. They did not move, and it cost you.';
              } },
            { label: 'Split the district', hint: 'Both stay, relations improve',
              go: function () {
                r.truceUntil = s.day + 28;
                return fx(s, { rival: r, relation: 16 }) + '. A line was drawn and both sides can live with it.';
              } },
            { label: 'Pull back', hint: 'Lose influence, avoid everything else',
              go: function () { return fx(s, { infl: -5, district: k, rival: r, relation: 8, rep: -1.5 }); } }
          ]
        };
      }
    },

    /* --- Hitze ------------------------------------------------------ */
    {
      id: 'informant_warning', w: 1.8, cool: 5,
      when: function (s, c) { return s.heat >= 45; },
      build: function (s, c) {
        var cost = Math.round(Math.max(3500, c.d.grossIncome * 0.35));
        var hasInformant = s.crew.some(function (x) { return x.role === 'informant'; });
        return {
          title: 'Word From Inside', tone: 'heat',
          text: (hasInformant ? 'Your informant says ' : 'A detective you have never met says ') +
                'your organisation is on a list, and the list is short. Nothing has been filed yet.',
          options: [
            { label: 'Buy the file', hint: U.moneySigned(-cost) + ', heat down hard',
              disabled: s.cash < cost, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -cost, heat: -16, rep: -1 }); } },
            { label: 'Shut everything down for a week', hint: 'No underground income, heat down',
              go: function () {
                s.flags.layLowUntil = s.day + 7;
                return fx(s, { heat: -11 }) + '. Everything underground is dark until next week.';
              } },
            { label: 'Carry on', hint: 'Free. You are gambling.',
              go: function () {
                later(s, 7, 'bust', {});
                return 'You did nothing. Perhaps nothing happens.';
              } }
          ]
        };
      }
    },
    {
      id: 'dirty_cop', w: 1.2, cool: 12,
      /* Nur einmal: sonst steht nach dreissig Wochen ein halbes Dutzend
         Halloran auf der Lohnliste, alle mit demselben Namen. */
      when: function (s, c) { return s.heat >= 25 && c.d.grossIncome > 6000 && !s.flags.halloran; },
      build: function (s, c) {
        var weekly = Math.round(Math.max(800, c.d.grossIncome * 0.06) / 10) * 10;
        return {
          title: 'A Friend on the Force', tone: 'heat',
          text: 'Sergeant Halloran of the 9th has a proposition: ' + U.money(weekly) + ' a week, ' +
                'and your name stops appearing in briefings.',
          options: [
            { label: 'Put him on the payroll', hint: U.moneySigned(-weekly) + '/week, steady heat relief',
              disabled: c.paid.length >= c.d.crewCap,
              why: 'No room in your crew. Build a Safe House.',
              go: function () {
                s.flags.halloran = s.day;
                s.crew.push({
                  id: U.nextId(s, 'c'), name: 'Sgt. Halloran', role: 'informant', skill: 6,
                  potential: 7, xp: 0, loyalty: 45, salary: weekly, traits: ['discreet'],
                  post: null, busyUntil: -1, hired: s.day, face: 424242, mood: '', raises: 0
                });
                return 'Halloran is on the books as a consultant. ' + fx(s, { heat: -6 });
              } },
            { label: 'Pay once, owe nothing', hint: U.moneySigned(-weekly * 6) + ', one-time heat drop',
              disabled: s.cash < weekly * 6, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -weekly * 6, heat: -12 }); } },
            { label: 'Record the conversation', hint: 'Leverage later, risky now',
              go: function () {
                if (c.rng.chance(0.6)) {
                  s.flags.leverage = (s.flags.leverage || 0) + 1;
                  return 'You have him on tape. That is worth more than money. ' + fx(s, { heat: -4 });
                }
                return 'He noticed. ' + fx(s, { heat: 10 });
              } }
          ]
        };
      }
    },

    /* --- Gelegenheiten ---------------------------------------------- */
    {
      id: 'opportunity', w: 1.6, cool: 4,
      when: function (s, c) { return c.openDistricts.length > 0 && s.cash > 4000; },
      build: function (s, c) {
        var k = c.rng.pick(c.openDistricts);
        var pool = D.BUSINESSES.filter(function (b) {
          var dist = D.byId(D.DISTRICTS, k);
          return b.tier <= dist.tier + 1 && s.rep >= b.rep * 0.7;
        });
        var def = c.rng.pick(pool.length ? pool : D.BUSINESSES);
        var price = Math.round(St.buyCost(k, def.id) * 0.62);
        return {
          title: 'A Distressed Sale', tone: 'money',
          text: 'The owner of a ' + def.name.toLowerCase() + ' in ' + D.byId(D.DISTRICTS, k).name +
                ' needs out this week. Asking ' + U.money(price) + ' — thirty-eight per cent under ' +
                'what it is worth, and there is a reason for that.',
          options: [
            { label: 'Buy it', hint: U.moneySigned(-price),
              disabled: s.cash < price || s.rep < def.rep,
              why: s.cash < price ? 'Not enough cash.' : 'Your reputation is too thin for that trade.',
              go: function () {
                s.cash -= price; s.stats.spent += price;
                var b = {
                  id: U.nextId(s, 'b'), type: def.id, district: k, level: 1,
                  name: def.name, bought: s.day, shut: 0,
                  damage: c.rng.chance(0.4) ? 0.3 : 0
                };
                s.businesses.push(b);
                return def.name + ' is yours.' + (b.damage ? ' It needs work before it earns properly.' : '');
              } },
            { label: 'Find out why', hint: 'Costs a week, tells you the truth',
              go: function () {
                later(s, 5, 'duediligence', { district: k, type: def.id, price: price });
                return 'You put somebody on it. You will know in a few days.';
              } },
            { label: 'Walk away', hint: 'Nothing gained, nothing lost',
              go: function () { return 'You have enough problems.'; } }
          ]
        };
      }
    },
    {
      id: 'specialist', w: 1.2, cool: 8,
      when: function (s, c) { return c.paid.length < c.d.crewCap && s.rep >= 12; },
      build: function (s, c) {
        var r = CE.crew.makeRecruit(s, c.rng, { bonus: 2.5 });
        var fee = Math.round(r.ask * 3);
        return {
          title: 'Someone Worth Meeting', tone: 'crew',
          text: r.name + ' came recommended. ' + (D.byId(D.ROLES, r.role).name) +
                ', skill ' + r.skill + ', and a reputation that arrived before they did. ' +
                'They want ' + U.money(r.ask) + ' a week and ' + U.money(fee) + ' to sign.',
          options: [
            { label: 'Sign them', hint: U.moneySigned(-fee) + ' now, ' + U.money(r.ask) + '/week',
              disabled: s.cash < fee || c.paid.length >= c.d.crewCap,
              why: s.cash < fee ? 'Not enough cash.' : 'No room in your crew.',
              go: function () {
                s.cash -= fee; s.stats.spent += fee;
                s.crew.push({
                  id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                  potential: r.potential, xp: 0, loyalty: r.loyalty, salary: r.ask,
                  traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                  face: r.face, mood: '', raises: 0
                });
                return r.name + ' starts Monday.';
              } },
            { label: 'Negotiate hard', hint: '25% cheaper, or they walk',
              disabled: c.paid.length >= c.d.crewCap, why: 'No room in your crew.',
              go: function () {
                if (c.rng.chance(0.5)) {
                  var pay = Math.round(r.ask * 0.75);
                  s.crew.push({
                    id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                    potential: r.potential, xp: 0, loyalty: Math.max(20, r.loyalty - 15), salary: pay,
                    traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                    face: r.face, mood: '', raises: 0
                  });
                  return r.name + ' took ' + U.money(pay) + '. They will not forget that you pushed.';
                }
                return r.name + ' took a call from somebody else while you were talking.';
              } },
            { label: 'Not now', hint: '', go: function () { return 'You let it pass.'; } }
          ]
        };
      }
    },
    {
      id: 'district_heat', w: 1.0, cool: 10,
      when: function (s, c) { return c.openDistricts.length >= 2 && s.day > 35; },
      build: function (s, c) {
        var k = c.rng.pick(c.openDistricts);
        var dist = D.byId(D.DISTRICTS, k);
        var cost = Math.round(Math.max(4000, c.d.grossIncome * 0.4));
        return {
          title: 'Pressure in ' + dist.name, tone: 'heat',
          text: 'The city has put a task force on ' + dist.name + '. Every operator in the ' +
                'district is feeling it, including the ones who are not yours.',
          options: [
            { label: 'Fund the community fund', hint: U.moneySigned(-cost) + ', reputation and influence up',
              disabled: s.cash < cost, why: 'Not enough cash.',
              go: function () { return fx(s, { cash: -cost, rep: 3, infl: 4, district: k, heat: -4 }); } },
            { label: 'Ride it out', hint: 'Heat up, influence down',
              go: function () { return fx(s, { heat: 6, infl: -3, district: k }); } },
            { label: 'Point them at a rival', hint: 'Heat down, relations down sharply',
              disabled: c.enemies.length === 0 && s.rivals.filter(function (r) { return r.infl[k] > 5; }).length === 0,
              why: 'Nobody else is worth pointing at here.',
              go: function () {
                var cands = s.rivals.filter(function (r) { return r.infl[k] > 5; });
                var r = cands.length ? c.rng.pick(cands) : c.rng.pick(s.rivals);
                r.infl[k] = Math.max(0, r.infl[k] - 4);
                return fx(s, { heat: -8, rival: r, relation: -25, rep: -2 }) +
                       '. ' + D.byId(D.RIVALS, r.id).name + ' will work out who did it.';
              } }
          ]
        };
      }
    },
    {
      id: 'rank_offer', w: 0.9, cool: 14,
      when: function (s, c) { return c.d.rank >= 2 && s.cash > 30000; },
      build: function (s, c) {
        var cost = Math.round(c.d.netWorth * 0.12);
        return {
          title: 'The Long Game', tone: 'money',
          text: 'A broker with no business card is assembling something citywide and wants ' +
                U.money(cost) + ' of your money in it. No paperwork, no guarantees, and a return ' +
                'somewhere between nothing and extraordinary.',
          options: [
            { label: 'Invest', hint: U.moneySigned(-cost) + ', resolves in six weeks',
              disabled: s.cash < cost, why: 'Not enough cash.',
              go: function () {
                s.cash -= cost; s.stats.spent += cost;
                later(s, 42, 'investment', { amount: cost });
                return 'The money is gone for six weeks. Then you find out what kind of person the broker is.';
              } },
            { label: 'Invest half', hint: U.moneySigned(-Math.round(cost / 2)) + ', safer',
              disabled: s.cash < cost / 2, why: 'Not enough cash.',
              go: function () {
                var half = Math.round(cost / 2);
                s.cash -= half; s.stats.spent += half;
                later(s, 42, 'investment', { amount: half, safe: true });
                return 'Half in. The broker noticed the hedge and respected it.';
              } },
            { label: 'Decline', hint: '', go: function () { return 'You keep your money where you can see it.'; } }
          ]
        };
      }
    }
  ];

  /* ------------------------------------------------------- Auswahl */

  function context(s, rng) {
    var d = St.derive(s);
    var paid = s.crew.filter(function (c) { return !c.player; });
    var openDistricts = [];
    for (var k in s.districts) if (s.districts[k].open) openDistricts.push(k);
    var contested = [];
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      if (r.allied) continue;
      for (var j = 0; j < openDistricts.length; j++) {
        var kk = openDistricts[j];
        if ((r.infl[kk] || 0) > 8 && s.districts[kk].mine > 8) contested.push({ rival: r, district: kk });
      }
    }
    return {
      rng: rng, d: d, paid: paid,
      unhappy: paid.filter(function (c) { return c.loyalty < 55 || c.salary < CE.crew.fairSalary(c) * 0.85; }),
      friendly: s.rivals.filter(function (r) { return r.relation > 5 && !r.allied; }),
      enemies: s.rivals.filter(function (r) { return r.relation < -10; }),
      contested: contested, openDistricts: openDistricts
    };
  }

  /* Ein Ereignis ziehen. Gibt null zurueck, wenn nichts passt - das ist
     ein gueltiges Ergebnis, nicht ein Fehler. */
  function draw(s, rng) {
    var c = context(s, rng);
    var pool = [];
    for (var i = 0; i < EVENTS.length; i++) {
      var e = EVENTS[i];
      var seen = s.eventSeen[e.id];
      if (seen && s.day - seen.last < (e.cool || 6) * 7) continue;
      if (e.when && !e.when(s, c)) continue;
      /* Was oft kam, kommt seltener. */
      var w = e.w / (1 + (seen ? seen.n : 0) * 0.35);
      pool.push({ e: e, w: w });
    }
    var pick = rng.weighted(pool);
    if (!pick) return null;
    var built = pick.e.build(s, c);
    built.id = pick.e.id;
    return built;
  }

  function markSeen(s, id) {
    var e = s.eventSeen[id] || { n: 0, last: -999 };
    e.n++; e.last = s.day;
    s.eventSeen[id] = e;
  }

  /* --------------------------------------------- Nachwirkungen */

  /* Faellige Nachwirkungen aufloesen. Taeglich aufgerufen. */
  function resolvePending(s, rng, report) {
    for (var i = s.pending.length - 1; i >= 0; i--) {
      var p = s.pending[i];
      if (p.day > s.day) continue;
      s.pending.splice(i, 1);
      var txt = runPending(s, rng, p);
      if (txt) report.push(txt);
    }
  }

  function runPending(s, rng, p) {
    var U2 = U;
    switch (p.kind) {
      case 'grudge': {
        var c = U.byId(s.crew, p.data.crew);
        if (!c) return null;
        if (c.loyalty < 40 && rng.chance(0.5)) {
          var take = Math.round(Math.max(1500, St.derive(s).grossIncome * 0.12));
          s.cash -= take;
          s.crew = s.crew.filter(function (x) { return x.id !== c.id; });
          return { t: 'bad', text: c.name + ' emptied what they could reach — ' + U2.money(take) + ' — and disappeared.' };
        }
        return { t: 'neutral', text: c.name + ' got over being refused. Mostly.' };
      }
      case 'skim': {
        var c2 = U.byId(s.crew, p.data.crew);
        if (!c2) return null;
        if (rng.chance(0.7)) {
          s.cash += p.data.amount;
          c2.loyalty = U.clamp(c2.loyalty - 25, 0, 100);
          return { t: 'good', text: 'You caught ' + c2.name + ' in the act. ' + U2.money(p.data.amount) + ' recovered.' };
        }
        s.cash -= Math.round(p.data.amount * 0.8);
        return { t: 'bad', text: 'Another ' + U2.money(Math.round(p.data.amount * 0.8)) + ' walked out the door. You still do not know who.' };
      }
      case 'inspection': {
        var fine = Math.round(Math.max(4000, St.derive(s).grossIncome * 0.3) * St.derive(s).fineMul);
        s.cash -= fine;
        s.heat = U.clamp(s.heat + 5, 0, 100);
        return { t: 'bad', text: 'The inspector came back with the city attorney. ' + U2.money(fine) + ' in fines.' };
      }
      case 'bust': {
        if (rng.chance(0.55)) {
          var hit = Math.round(Math.max(8000, St.derive(s).grossIncome * 0.6) * St.derive(s).fineMul);
          s.cash -= hit;
          s.heat = U.clamp(s.heat - 6, 0, 100);
          return { t: 'bad', text: 'They filed. ' + U2.money(hit) + ' in legal costs before anything even reached a courtroom.' };
        }
        s.flags.survivedRaid = true;
        return { t: 'good', text: 'Nothing came of it. The file went in a drawer.' };
      }
      case 'duediligence': {
        var dist = D.byId(D.DISTRICTS, p.data.district);
        var def = D.byId(D.BUSINESSES, p.data.type);
        if (rng.chance(0.45)) {
          return { t: 'good', text: 'The ' + def.name.toLowerCase() + ' in ' + dist.name +
            ' was clean — the owner was simply sick. It sold to somebody else before you could move.' };
        }
        return { t: 'neutral', text: 'The ' + def.name.toLowerCase() + ' in ' + dist.name +
          ' had three liens and a silent partner. You are glad you asked.' };
      }
      case 'investment': {
        var amount = p.data.amount;
        var roll = rng.next();
        var mult = p.data.safe ? (roll < 0.18 ? 0.5 : (roll < 0.7 ? 1.5 : 2.4))
                               : (roll < 0.3 ? 0 : (roll < 0.65 ? 1.6 : 3.2));
        var back = Math.round(amount * mult);
        s.cash += back;
        if (back > amount) s.stats.earned += back - amount;
        return {
          t: back > amount ? 'good' : 'bad',
          text: back === 0
            ? 'The broker is gone and so is ' + U2.money(amount) + '.'
            : 'The citywide venture paid back ' + U2.money(back) + ' on ' + U2.money(amount) + '.'
        };
      }
    }
    return null;
  }

  CE.events = { draw: draw, markSeen: markSeen, resolvePending: resolvePending, EVENTS: EVENTS, fx: fx };
})(typeof window !== 'undefined' ? window : globalThis);
