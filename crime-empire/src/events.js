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
    if (e.rep) { s.rep = U.clamp(s.rep + e.rep, 0, 100); parts.push((e.rep > 0 ? '+' : '') + e.rep.toFixed(1) + ' Ansehen'); }
    if (e.heat) { s.heat = U.clamp(s.heat + e.heat, 0, 100); parts.push((e.heat > 0 ? '+' : '') + e.heat.toFixed(1) + ' Hitze'); }
    if (e.infl && e.district) {
      s.districts[e.district].mine = U.clamp(s.districts[e.district].mine + e.infl, 0, 100);
      parts.push((e.infl > 0 ? '+' : '') + e.infl.toFixed(1) + ' Einfluss ' + D.byId(D.DISTRICTS, e.district).wo);
    }
    if (e.loyaltyAll) {
      for (var i = 0; i < s.crew.length; i++) if (!s.crew[i].player) s.crew[i].loyalty = U.clamp(s.crew[i].loyalty + e.loyaltyAll, 0, 100);
      parts.push((e.loyaltyAll > 0 ? '+' : '') + e.loyaltyAll + ' Loyalität in der ganzen Crew');
    }
    if (e.crew && e.loyalty) {
      e.crew.loyalty = U.clamp(e.crew.loyalty + e.loyalty, 0, 100);
      parts.push(e.crew.name + ' ' + (e.loyalty > 0 ? '+' : '') + e.loyalty + ' Loyalität');
    }
    if (e.relation && e.rival) {
      e.rival.relation = U.clamp(e.rival.relation + e.relation, -100, 100);
      parts.push(D.byId(D.RIVALS, e.rival.id).name + ' ' + (e.relation > 0 ? '+' : '') + e.relation + ' Verhältnis');
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
          title: 'Die Loyalitätsfrage', tone: 'crew', who: e.id,
          text: e.name + ' hat dich auf dem Weg nach draußen abgefangen. Die Person trägt mehr, als sie ' +
                'bezahlt bekommt, und weiß jetzt, was die Arbeit wert ist: ' + U.money(want) +
                ' die Woche statt ' + U.money(e.salary) + '.',
          options: [
            { label: 'Zahlen', hint: U.moneySigned(-diff) + '/Woche, Loyalität steigt',
              go: function () {
                CE.crew.setSalary(s, e.id, want);
                return e.name + ' ist wieder bei der Arbeit und meint es ernst. ' + fx(s, { crew: e, loyalty: 10 });
              } },
            { label: 'Ablehnen', hint: 'Jetzt kostenlos. Man wird sich erinnern.',
              go: function () {
                var r = fx(s, { crew: e, loyalty: -22 });
                later(s, 14, 'grudge', { crew: e.id });
                return 'Du hast gesagt, die Zahl sei die Zahl. ' + r;
              } },
            { label: 'Stattdessen befördern', hint: U.money(Math.round(fair * 3)) + ' einmalig, dauerhaft mehr Können',
              disabled: s.cash < Math.round(fair * 3) || St.effectiveSkill(e) >= e.potential,
              why: s.cash < Math.round(fair * 3) ? 'Nicht genug Bargeld.' : 'Da ist nichts mehr dazuzulernen.',
              go: function () {
                var res = CE.crew.promote(s, e.id);
                return res.ok
                  ? e.name + ' nahm den Titel statt des Geldes. ' + fx(s, { crew: e, loyalty: 6 })
                  : res.why;
              } },
            { label: 'Rauswerfen', hint: 'Severance ' + U.money(e.salary * 2) + ', Stimmung in der Crew sinkt',
              disabled: s.cash < e.salary * 2, why: 'Du kannst die Abfindung nicht zahlen.',
              go: function () {
                var n = e.name;
                CE.crew.fire(s, e.id);
                return n + ' räumte noch am selben Nachmittag. Der Rest der Crew hat zugesehen.';
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
          title: 'Ein besseres Angebot', tone: 'crew', who: e.id,
          text: rd.leader + ' hat ' + e.name + ' zum Essen eingeladen. Die Zahl auf dem Tisch ist ' +
                'besser als deine, und ' + e.name + ' hat es dir erzählt — was entweder ' +
                'Loyalität ist oder ein Druckmittel.',
          options: [
            { label: 'Mitgehen und erhöhen', hint: U.moneySigned(-counter) + '/Woche',
              go: function () {
                CE.crew.setSalary(s, e.id, e.salary + counter);
                return fx(s, { crew: e, loyalty: 14, rival: r, relation: -6 });
              } },
            { label: 'Die Person entscheiden lassen', hint: 'Kostet nichts. Kann alles kosten.',
              go: function () {
                if (c.rng.chance(0.45 + (60 - e.loyalty) / 160)) {
                  var n = e.name;
                  CE.crew.remove(s, e.id);
                  r.strength += 5;
                  return n + ' nahm das Angebot an und ging. ' + rd.name + ' ist dadurch stärker.';
                }
                return e.name + ' ist geblieben. Man wollte gefragt werden, nicht gekauft. ' + fx(s, { crew: e, loyalty: 8 });
              } },
            { label: rd.leader.split(' ')[0] + ' zum Aufhören auffordern', hint: 'Verhältnis sinkt, die Crew sieht zu',
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
          title: 'Die Bücher gehen nicht auf', tone: 'crew', who: e.id,
          text: 'Etwa ' + U.money(amount) + ' sind über einen Monat verschwunden. Die Spur endet bei ' +
                e.name + ', und die Hinweise sind vielsagend, aber nicht eindeutig.',
          options: [
            { label: 'Zur Rede stellen', hint: 'Wenn du recht hast, bekommst du es zurück',
              go: function () {
                if (c.rng.chance(0.62)) {
                  return e.name + ' knickte ein und zahlte zurück. ' + fx(s, { cash: amount, crew: e, loyalty: -14 });
                }
                return 'Es war die falsche Person. ' + e.name + ' hat den Vorwurf nicht vergessen. ' +
                       fx(s, { crew: e, loyalty: -18, loyaltyAll: -2 });
              } },
            { label: 'Nichts sagen und beobachten', hint: 'Kostet das Geld vorerst',
              go: function () {
                later(s, 21, 'skim', { crew: e.id, amount: amount });
                return 'Du lässt es laufen. Wer es auch ist, wird bequem, und bequeme Leute werden unvorsichtig.';
              } },
            { label: 'Ein Exempel statuieren', hint: 'Loyalität sinkt, niemand versucht es noch einmal',
              go: function () {
                var n = e.name;
                CE.crew.fire(s, e.id);
                s.flags.exampleMade = (s.flags.exampleMade || 0) + 1;
                CE.fear.add(s, 4, 'ein Exempel statuiert');
                return n + ' ist weg, und jeder weiß warum. ' + fx(s, { loyaltyAll: -6, rep: 1, heat: 2 });
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
          title: 'Mehr, als er fasst', tone: 'money',
          text: b.name + ' weist seit einem Monat Geschäft ab. Hier ist Platz zu wachsen, ' +
                'wenn du jetzt Geld hineinsteckst — oder du nimmst den Überschuss heraus und gehst weiter.',
          options: [
            { label: 'Reinvest ' + U.money(cost), hint: 'Dauerhaft +12% Ertrag an diesem Standort',
              disabled: s.cash < cost, why: 'Nicht genug Bargeld.',
              go: function () {
                s.cash -= cost; s.stats.spent += cost;
                b.boost = (b.boost || 0) + 0.12;
                return b.name + ' wird um die Nachfrage herum umgebaut. Ertrag dauerhaft +12%.';
              } },
            { label: 'Den Überschuss nehmen', hint: U.moneySigned(Math.round(f.gross * 1.1)),
              go: function () { return fx(s, { cash: Math.round(f.gross * 1.1) }); } },
            { label: 'Es ruhig halten', hint: 'Weniger Aufmerksamkeit, etwas Einfluss',
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
          title: 'Ein Prüfer kommt vorbei', tone: 'heat',
          text: 'Ein städtischer Prüfer fand bei ' + b.name + ' in vierzig Minuten elf Verstöße ' +
                'und erwähnte zweimal, dass die meisten davon Ermessenssache sind.',
          options: [
            { label: 'Den Mann bezahlen', hint: U.moneySigned(-demand) + ', Hitze sinkt',
              disabled: s.cash < demand, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -demand, heat: -4 }); } },
            { label: 'Die Mängel ordentlich beheben', hint: U.moneySigned(-Math.round(demand * 1.6)) + ', Ansehen steigt',
              disabled: s.cash < demand * 1.6, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -Math.round(demand * 1.6), rep: 2.5, heat: -2 }); } },
            { label: 'Ihn hinauswerfen', hint: 'Kostenlos. Hitze steigt deutlich.',
              go: function () {
                later(s, 10, 'inspection', { biz: b.id });
                return fx(s, { heat: 9, rep: 0.5 }) + '. Er ging mit aufgeschlagenem Notizbuch.';
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
          title: 'Ein schlechtes Quartal', tone: 'money',
          text: b.name + ' blutet. Weniger Laufkundschaft, zwei Mitbewerber haben in derselben ' +
                'Straße eröffnet, und die Verluste belaufen sich bisher auf ' + U.money(loss) + '.',
          options: [
            { label: 'Die Verluste decken', hint: U.moneySigned(-loss),
              disabled: s.cash < loss, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -loss }); } },
            { label: 'Auf den Knochen sparen', hint: 'Halber Verlust, Ertrag wochenlang beschädigt',
              go: function () {
                b.damage = U.clamp((b.damage || 0) + 0.4, 0, 0.8);
                return fx(s, { cash: -Math.round(loss / 2) }) + '. Der Ertrag von ' + b.name + ' leidet, bis sich das erholt.';
              } },
            { label: 'Verkaufen', hint: U.moneySigned(Math.round(St.bizValue(s, b) * 0.68)),
              go: function () {
                var r = CE.empire.sell(s, b.id);
                return b.name + ' ist jetzt das Problem von jemand anderem. ' + U.money(r.price) + ' zurückgeholt.';
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
          title: 'Ein Vorschlag', tone: 'rival', who: r.id,
          text: rd.leader + ' will ' + D.byId(D.DISTRICTS, k).wo +
                ' mitverdienen. Ihre Leute, dein Boden, der Schnitt wird geteilt. Der Einstieg kostet ' + U.money(buyIn) + '.',
          options: [
            { label: 'Darauf eingehen', hint: U.moneySigned(-buyIn) + ', Verhältnis und Einfluss steigen',
              disabled: s.cash < buyIn, why: 'Nicht genug Bargeld.',
              go: function () {
                return fx(s, { cash: -buyIn, rival: r, relation: 25, infl: 6, district: k, rep: 1.5 });
              } },
            { label: 'Gegenangebot: dein Boden, deine Regeln', hint: 'Könnte sie beleidigen',
              go: function () {
                if (c.rng.chance(0.4)) return fx(s, { rival: r, relation: 12, infl: 3, district: k }) +
                  '. Sie haben zuerst geblinzelt.';
                return fx(s, { rival: r, relation: -18 }) + '. ' + rd.leader.split(' ')[0] + ' macht kein zweites Angebot.';
              } },
            { label: 'Höflich ablehnen', hint: 'Kleiner Dämpfer fürs Verhältnis',
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
          title: 'Eine Grenze ' + D.byId(D.DISTRICTS, k).wo, tone: 'rival', who: r.id,
          text: rd.name + ' hat Leute an denselben Ecken wie du. Diese Woche gibt jemand ' +
                'nach, und so oder so wird das entschieden.',
          options: [
            { label: 'Sie verdrängen', hint: U.moneySigned(-cost) + ', Ausgang ungewiss',
              disabled: s.cash < cost, why: 'Nicht genug Bargeld.',
              go: function () {
                s.cash -= cost;
                var odds = U.clamp(0.35 + (c.d.strength - r.strength) / 140, 0.12, 0.88);
                CE.fear.add(s, 5, 'einen Rivalen von einer Ecke verdrängt');
                if (c.rng.chance(odds)) {
                  r.infl[k] = Math.max(0, r.infl[k] - 7);
                  return fx(s, { infl: 6, district: k, rival: r, relation: -18, rep: 2, heat: 3 }) + '. Sie sind gewichen.';
                }
                return fx(s, { infl: -3, district: k, rival: r, relation: -14, heat: 4, rep: -1 }) +
                       '. Sie sind nicht gewichen, und es hat dich etwas gekostet.';
              } },
            { label: 'Den Bezirk aufteilen', hint: 'Beide bleiben, Verhältnis verbessert sich',
              go: function () {
                r.truceUntil = s.day + 28;
                return fx(s, { rival: r, relation: 16 }) + '. Eine Linie wurde gezogen, und beide Seiten können damit leben.';
              } },
            { label: 'Zurückziehen', hint: 'Einfluss verlieren, allem anderen aus dem Weg gehen',
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
          title: 'Nachricht von innen', tone: 'heat',
          text: (hasInformant ? 'Dein Informant sagt, ' : 'Ein Ermittler, den du nie getroffen hast, sagt, ') +
                'deine Organisation stehe auf einer Liste, und die Liste sei kurz. Angezeigt ist noch nichts.',
          options: [
            { label: 'Die Akte kaufen', hint: U.moneySigned(-cost) + ', Hitze sinkt stark',
              disabled: s.cash < cost, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -cost, heat: -16, rep: -1 }); } },
            { label: 'Eine Woche lang alles dichtmachen', hint: 'Kein Untergrund-Einkommen, Hitze sinkt',
              go: function () {
                s.flags.layLowUntil = s.day + 7;
                return fx(s, { heat: -11 }) + '. Alles im Untergrund bleibt bis nächste Woche dunkel.';
              } },
            { label: 'Weitermachen', hint: 'Kostenlos. Du gehst ein Risiko ein.',
              go: function () {
                later(s, 7, 'bust', {});
                return 'Du hast nichts getan. Vielleicht passiert ja nichts.';
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
          title: 'Ein Freund bei der Polizei', tone: 'heat',
          text: 'Sergeant Halloran vom 9. Revier hat ein Angebot: ' + U.money(weekly) + ' die Woche, ' +
                'und dein Name taucht in den Lagebesprechungen nicht mehr auf.',
          options: [
            { label: 'Ihn auf die Lohnliste setzen', hint: U.moneySigned(-weekly) + '/Woche, dauerhaft weniger Hitze',
              disabled: c.paid.length >= c.d.crewCap,
              why: 'Kein Platz in deiner Crew. Bau einen Unterschlupf.',
              go: function () {
                s.flags.halloran = s.day;
                s.crew.push({
                  id: U.nextId(s, 'c'), name: 'Sgt. Halloran', role: 'informant', skill: 6,
                  potential: 7, xp: 0, loyalty: 45, salary: weekly, traits: ['discreet'],
                  post: null, busyUntil: -1, hired: s.day, face: 424242, mood: '', raises: 0
                });
                return 'Halloran steht als Berater in den Büchern. ' + fx(s, { heat: -6 });
              } },
            { label: 'Einmal zahlen, nichts schulden', hint: U.moneySigned(-weekly * 6) + ', einmalig weniger Hitze',
              disabled: s.cash < weekly * 6, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -weekly * 6, heat: -12 }); } },
            { label: 'Das Gespräch aufnehmen', hint: 'Später ein Druckmittel, jetzt riskant',
              go: function () {
                if (c.rng.chance(0.6)) {
                  s.flags.leverage = (s.flags.leverage || 0) + 1;
                  return 'Du hast ihn auf Band. Das ist mehr wert als Geld. ' + fx(s, { heat: -4 });
                }
                return 'Er hat es gemerkt. ' + fx(s, { heat: 10 });
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
          title: 'Ein Notverkauf', tone: 'money',
          text: 'Der Besitzer von ' + def.name + ' ' + D.byId(D.DISTRICTS, k).wo +
                ' muss diese Woche raus. Er verlangt ' + U.money(price) + ' — achtunddreißig Prozent unter ' +
                'dem Wert, und dafür gibt es einen Grund.',
          options: [
            { label: 'Kaufen', hint: U.moneySigned(-price),
              disabled: s.cash < price || s.rep < def.rep,
              why: s.cash < price ? 'Nicht genug Bargeld.' : 'Dein Ansehen reicht für dieses Geschäft nicht.',
              go: function () {
                s.cash -= price; s.stats.spent += price;
                var b = {
                  id: U.nextId(s, 'b'), type: def.id, district: k, level: 1,
                  name: def.name, bought: s.day, shut: 0,
                  damage: c.rng.chance(0.4) ? 0.3 : 0
                };
                s.businesses.push(b);
                return def.name + ' gehört dir.' + (b.damage ? ' Der Betrieb braucht Arbeit, bevor er richtig verdient.' : '');
              } },
            { label: 'Herausfinden warum', hint: 'Kostet eine Woche, bringt die Wahrheit',
              go: function () {
                later(s, 5, 'duediligence', { district: k, type: def.id, price: price });
                return 'Du hast jemanden darauf angesetzt. In ein paar Tagen weißt du mehr.';
              } },
            { label: 'Weggehen', hint: 'Nichts gewonnen, nichts verloren',
              go: function () { return 'Du hast genug Probleme.'; } }
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
          title: 'Jemand, den man kennenlernen sollte', tone: 'crew',
          text: r.name + ' wurde empfohlen. ' + (D.byId(D.ROLES, r.role).name) +
                ', Können ' + r.skill + ', und ein Ruf, der vor der Person da war. ' +
                'Verlangt wird ' + U.money(r.ask) + ' die Woche und ' + U.money(fee) + ' für die Unterschrift.',
          options: [
            { label: 'Unterschreiben lassen', hint: U.moneySigned(-fee) + ' now, ' + U.money(r.ask) + '/week',
              disabled: s.cash < fee || c.paid.length >= c.d.crewCap,
              why: s.cash < fee ? 'Nicht genug Bargeld.' : 'Kein Platz in deiner Crew.',
              go: function () {
                s.cash -= fee; s.stats.spent += fee;
                s.crew.push({
                  id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                  potential: r.potential, xp: 0, loyalty: r.loyalty, salary: r.ask,
                  traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                  face: r.face, mood: '', raises: 0
                });
                return r.name + ' fängt am Montag an.';
              } },
            { label: 'Hart verhandeln', hint: '25% billiger, oder die Person geht',
              disabled: c.paid.length >= c.d.crewCap, why: 'Kein Platz in deiner Crew.',
              go: function () {
                if (c.rng.chance(0.5)) {
                  var pay = Math.round(r.ask * 0.75);
                  s.crew.push({
                    id: U.nextId(s, 'c'), name: r.name, role: r.role, skill: r.skill,
                    potential: r.potential, xp: 0, loyalty: Math.max(20, r.loyalty - 15), salary: pay,
                    traits: r.traits.slice(), post: null, busyUntil: -1, hired: s.day,
                    face: r.face, mood: '', raises: 0
                  });
                  return r.name + ' took ' + U.money(pay) + '. Dass du gedrückt hast, wird nicht vergessen.';
                }
                return r.name + ' nahm während des Gesprächs einen Anruf von jemand anderem an.';
              } },
            { label: 'Jetzt nicht', hint: '', go: function () { return 'Du hast es ziehen lassen.'; } }
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
          title: 'Druck ' + dist.wo, tone: 'heat',
          text: 'Die Stadt hat eine Sonderkommission auf ' + dist.akk + ' angesetzt. Jeder, der in diesem ' +
                'Bezirk arbeitet, bekommt es zu spüren, auch die, die nicht zu dir gehören.',
          options: [
            { label: 'In den Stadtteilfonds einzahlen', hint: U.moneySigned(-cost) + ', Ansehen und Einfluss steigen',
              disabled: s.cash < cost, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -cost, rep: 3, infl: 4, district: k, heat: -4 }); } },
            { label: 'Es aussitzen', hint: 'Hitze steigt, Einfluss sinkt',
              go: function () { return fx(s, { heat: 6, infl: -3, district: k }); } },
            { label: 'Sie auf einen Rivalen ansetzen', hint: 'Hitze sinkt, Verhältnis sinkt stark',
              disabled: c.enemies.length === 0 && s.rivals.filter(function (r) { return r.infl[k] > 5; }).length === 0,
              why: 'Hier lohnt es sich nicht, auf jemanden zu zeigen.',
              go: function () {
                var cands = s.rivals.filter(function (r) { return r.infl[k] > 5; });
                var r = cands.length ? c.rng.pick(cands) : c.rng.pick(s.rivals);
                r.infl[k] = Math.max(0, r.infl[k] - 4);
                CE.fear.add(s, 3, 'einen Rivalen angeschwärzt');
                return fx(s, { heat: -8, rival: r, relation: -25, rep: -2 }) +
                       '. ' + D.byId(D.RIVALS, r.id).name + ' wird herausfinden, wer das war.';
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
          title: 'Das lange Spiel', tone: 'money',
          text: 'Ein Vermittler ohne Visitenkarte baut etwas Stadtweites auf und will ' +
                U.money(cost) + ' deines Geldes darin. Keine Papiere, keine Garantien, und eine Rendite ' +
                'irgendwo zwischen nichts und außerordentlich.',
          options: [
            { label: 'Investieren', hint: U.moneySigned(-cost) + ', klärt sich in sechs Wochen',
              disabled: s.cash < cost, why: 'Nicht genug Bargeld.',
              go: function () {
                s.cash -= cost; s.stats.spent += cost;
                later(s, 42, 'investment', { amount: cost });
                return 'Das Geld ist sechs Wochen weg. Dann erfährst du, was für ein Mensch der Vermittler ist.';
              } },
            { label: 'Die Hälfte investieren', hint: U.moneySigned(-Math.round(cost / 2)) + ', sicherer',
              disabled: s.cash < cost / 2, why: 'Nicht genug Bargeld.',
              go: function () {
                var half = Math.round(cost / 2);
                s.cash -= half; s.stats.spent += half;
                later(s, 42, 'investment', { amount: half, safe: true });
                return 'Halb dabei. Der Vermittler bemerkte die Absicherung und respektierte sie.';
              } },
            { label: 'Ablehnen', hint: '', go: function () { return 'Du behältst dein Geld dort, wo du es sehen kannst.'; } }
          ]
        };
      }
    },
    /* --- Spaetes Spiel -----------------------------------------------

       Im Testlauf ueber 95 Wochen kamen 118 Entscheidungen aus nur
       vierzehn Vorlagen - "A Distressed Sale" allein achtzehnmal. Die
       folgenden greifen erst, wenn das Imperium steht, und verschieben
       das Gewicht im Spaetspiel auf Stoffe, die es vorher nicht gab. */
    {
      id: 'union', w: 1.4, cool: 9,
      when: function (s, c) { return s.businesses.length >= 6 && c.paid.length >= 4; },
      build: function (s, c) {
        var kosten = Math.round(Math.max(3000, c.d.salaries * 0.55) / 10) * 10;
        return {
          title: 'Sie haben geredet', tone: 'crew',
          text: 'Deine Leute haben Zahlen verglichen. Die Nachricht kam über drei von ihnen ' +
                'gleichzeitig, also war sie abgesprochen: alle wollen mehr, und sie wollen es ' +
                'zusammen.',
          options: [
            { label: 'Der ganzen Crew mehr zahlen', hint: U.moneySigned(-kosten) + '/Woche, Loyalität auf ganzer Linie',
              go: function () {
                for (var i = 0; i < s.crew.length; i++) {
                  if (!s.crew[i].player) s.crew[i].salary = Math.round(s.crew[i].salary * 1.14);
                }
                return 'Dass du so schnell zusagst, hatte niemand erwartet. ' + fx(s, { loyaltyAll: 14, rep: 1 });
              } },
            { label: 'Die Wortführer herauskaufen', hint: U.moneySigned(-Math.round(kosten * 2.5)) + ' once',
              disabled: s.cash < kosten * 2.5, why: 'Nicht genug Bargeld.',
              go: function () {
                var top = c.paid.slice().sort(function (a, b) { return b.loyalty - a.loyalty; }).slice(0, 2);
                for (var i = 0; i < top.length; i++) top[i].loyalty = U.clamp(top[i].loyalty + 18, 0, 100);
                return 'Zwei von ihnen wurden still, und der Rest hat es bemerkt. ' +
                       fx(s, { cash: -Math.round(kosten * 2.5), loyaltyAll: -5 });
              } },
            { label: 'Daran erinnern, wer zahlt', hint: 'Kostenlos. Loyalität fällt stark.',
              go: function () { return fx(s, { loyaltyAll: -16, rep: 0.5, heat: 1 }); } }
          ]
        };
      }
    },
    {
      id: 'federal', w: 1.5, cool: 11,
      when: function (s, c) { return c.d.rank >= 3 && s.heat >= 35; },
      build: function (s, c) {
        var kosten = Math.round(Math.max(20000, c.d.grossIncome * 0.9));
        return {
          title: 'Nicht mehr nur örtlich', tone: 'heat',
          text: 'Der Wagen vor deinem Waschsalon hat Kennzeichen des Bundes. Welche Akte das auch ist, sie ' +
                'begann nicht im 9. Revier, und wer sie liest, nimmt keine Umschläge.',
          options: [
            { label: 'Alles umbauen', hint: U.moneySigned(-kosten) + ', Hitze -22',
              disabled: s.cash < kosten, why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -kosten, heat: -22, rep: -1 }); } },
            { label: 'Ihnen jemand anderen liefern', hint: 'Hitze -14, ein Rivale wendet sich gegen dich',
              disabled: c.enemies.length === 0 && s.rivals.length === 0, why: 'Niemand, den man liefern könnte.',
              go: function () {
                var r = c.rng.pick(s.rivals);
                r.infl[c.rng.pick(c.openDistricts)] = Math.max(0, (r.infl[c.openDistricts[0]] || 0) - 5);
                return fx(s, { heat: -14, rival: r, relation: -30, rep: -3 }) +
                       '. ' + D.byId(D.RIVALS, r.id).name + ' wird herausfinden, woher das kam.';
              } },
            { label: 'Sie schauen lassen', hint: 'Jetzt kostenlos, später teuer',
              go: function () {
                later(s, 21, 'federal', {});
                return 'Du hast nichts geändert. Sie werden sich Zeit nehmen.';
              } }
          ]
        };
      }
    },
    {
      id: 'succession', w: 1.2, cool: 14,
      /* Nur solange es keine rechte Hand gibt - vorher kam dieselbe
         Szene dreimal in einer Partie, jedes Mal mit jemand anderem. */
      when: function (s, c) {
        if (s.flags.second && U.byId(s.crew, s.flags.second)) return false;
        return c.paid.filter(function (x) { return St.effectiveSkill(x) >= 8; }).length > 0 && c.d.rank >= 3;
      },
      build: function (s, c) {
        var beste = c.paid.filter(function (x) { return St.effectiveSkill(x) >= 8; })
          .sort(function (a, b) { return St.effectiveSkill(b) - St.effectiveSkill(a); })[0];
        return {
          title: 'Die zweite Reihe', tone: 'crew', who: beste.id,
          text: beste.name + ' führt an den meisten Tagen mehr von dieser Organisation als du, und ' +
                'alle haben es bemerkt. Noch liegt darin keine Drohung. Das muss auch so bleiben.',
          options: [
            { label: 'Zur rechten Hand machen', hint: 'Starke Loyalität, dafür ein Anteil',
              go: function () {
                beste.salary = Math.round(beste.salary * 1.35);
                s.flags.second = beste.id;
                return beste.name + ' ist jetzt deine rechte Hand, und das Gehalt sagt das auch. ' +
                       fx(s, { crew: beste, loyalty: 22, loyaltyAll: 4, rep: 2 });
              } },
            { label: 'Die Aufgaben aufteilen', hint: 'Sicherer, und man weiß warum',
              go: function () { return fx(s, { crew: beste, loyalty: -16, loyaltyAll: -3 }); } },
            { label: 'Nichts tun', hint: 'Es ändert sich nichts. Vorerst.',
              go: function () {
                later(s, 28, 'ambition', { crew: beste.id });
                return 'Du hast nichts gesagt. Die andere Seite auch nicht.';
              } }
          ]
        };
      }
    },
    {
      id: 'expansion_offer', w: 1.3, cool: 10,
      when: function (s, c) {
        for (var k in s.districts) if (!s.districts[k].open) return c.d.rank >= 2 && s.cash > 25000;
        return false;
      },
      build: function (s, c) {
        var zu = [];
        for (var k in s.districts) if (!s.districts[k].open) zu.push(k);
        var ziel = c.rng.pick(zu);
        var dist = D.byId(D.DISTRICTS, ziel);
        var preis = Math.round(CE.empire.entryCost(s, ziel) * 0.6);
        return {
          title: 'Eine Tür ' + dist.wohin, tone: 'money',
          text: 'Jemand, der jemandem etwas schuldet, der dir etwas schuldet, kann deinen Namen in ' +
                dist.wo + ' auf die richtige Liste setzen. Das ist eine Abkürzung, kein Geschenk, und Abkürzungen ' +
                'werden in dieser Stadt gern erinnert.',
          options: [
            { label: 'Die Abkürzung nehmen', hint: U.moneySigned(-preis) + ', bringt dich dort hinein',
              disabled: s.cash < preis || c.d.rank < dist.rank,
              why: s.cash < preis ? 'Nicht genug Bargeld.' : 'Für diesen Bezirk fehlt dir noch das Ansehen.',
              go: function () {
                s.cash -= preis; s.stats.spent += preis;
                s.districts[ziel].open = true;
                s.districts[ziel].mine = Math.max(s.districts[ziel].mine, 5);
                return 'Du bist ' + dist.wo + ', für ' + U.money(preis) + '. ' +
                       fx(s, { rep: 1.5, heat: 2 });
              } },
            { label: 'Fragen, was es wirklich kostet', hint: 'Auskunft, keine Zusage',
              go: function () {
                return 'Der Gefallen wäre innerhalb eines Jahres eingefordert worden, und nicht in Geld. ' +
                       'Gut zu wissen. ' + fx(s, { rep: 0.5 });
              } },
            { label: 'Den langsamen Weg gehen', hint: 'Jetzt nichts',
              go: function () { return 'Du gehst durch die Vordertür hinein oder gar nicht.'; } }
          ]
        };
      }
    },
    {
      id: 'legit', w: 1.1, cool: 13,
      when: function (s, c) { return c.d.rank >= 4 && c.d.cleanGross > 20000; },
      build: function (s, c) {
        var kosten = Math.round(c.d.netWorth * 0.09);
        return {
          title: 'Die seriöse Möglichkeit', tone: 'money',
          text: 'Eine Projektgesellschaft will dich im Aufsichtsrat. Echter Name, echter Titel, Fotos ' +
                'beim Banddurchschneiden. Es würde ' + U.money(kosten) + ' kosten und ein gewisses Maß ' +
                'von dem, was du bist.',
          options: [
            { label: 'Den Sitz kaufen', hint: U.moneySigned(-kosten) + ', Ansehen steigt und Hitze sinkt',
              disabled: s.cash < kosten, why: 'Nicht genug Bargeld.',
              go: function () {
                s.flags.board = true;
                return fx(s, { cash: -kosten, rep: 8, heat: -12 }) +
                       '. Seriosität ist also käuflich, wie alles andere auch.';
              } },
            { label: 'Jemand anderen hineinsetzen', hint: 'Billiger, weniger Nutzen',
              disabled: s.cash < Math.round(kosten * 0.4), why: 'Nicht genug Bargeld.',
              go: function () { return fx(s, { cash: -Math.round(kosten * 0.4), rep: 3, heat: -5 }); } },
            { label: 'Ablehnen', hint: 'Dass man dir eine Absage erteilt hat, bleibt haften',
              go: function () { return fx(s, { rep: -1 }) + '. Du willst dein Gesicht auf nichts davon haben.'; } }
          ]
        };
      }
    },
    {
      id: 'cartel', w: 1.2, cool: 12,
      when: function (s, c) { return c.d.rank >= 3 && s.rivals.filter(function (r) { return !r.allied; }).length >= 2; },
      build: function (s, c) {
        var zwei = c.rng.shuffle(s.rivals.filter(function (r) { return !r.allied; }).slice()).slice(0, 2);
        var a = zwei[0], b = zwei[1];
        var ad = D.byId(D.RIVALS, a.id), bd = D.byId(D.RIVALS, b.id);
        return {
          title: 'Ein Tisch für drei', tone: 'rival', who: a.id,
          text: ad.leader + ' und ' + bd.leader + ' liegen über die Docks im Streit, und beide ' +
                'haben dich gebeten, dich dazuzusetzen. Was du als Nächstes tust, erfährt einer von ihnen.',
          options: [
            { label: 'Partei ergreifen für ' + ad.leader.split(' ').pop(), hint: 'Verhältnis zu einem steigt, zum anderen sinkt',
              go: function () { return fx(s, { rival: a, relation: 26 }) + ', ' + fx(s, { rival: b, relation: -20 }); } },
            { label: 'Partei ergreifen für ' + bd.leader.split(' ').pop(), hint: 'Das Gegenstück dazu',
              go: function () { return fx(s, { rival: b, relation: 26 }) + ', ' + fx(s, { rival: a, relation: -20 }); } },
            { label: 'Den Frieden vermitteln', hint: 'Beides verbessert sich, der Versuch kostet Ansehen',
              go: function () {
                if (c.rng.chance(0.55 + c.d.rep / 400)) {
                  return 'Unterschrieben haben sie nichts, aber vor deinen Augen die Hände geschüttelt. ' +
                         fx(s, { rival: a, relation: 16 }) + ', ' + fx(s, { rival: b, relation: 16 }) + ', ' + fx(s, { rep: 3 });
                }
                return 'Am Tisch fiel alles auseinander, und beide geben dem Gastgeber die Schuld. ' +
                       fx(s, { rival: a, relation: -8 }) + ', ' + fx(s, { rival: b, relation: -8 });
              } }
          ]
        };
      }
    }
  ];

  /* ------------------------------------------------------- Auswahl */

  /* Der Gesamtkatalog: allgemeine Ereignisse plus die Geschichten der
     wiederkehrenden Figuren. Beide laufen durch dieselbe gewichtete
     Auswahl mit Abklingzeit - eine Geschichte ist kein Sonderfall,
     sie hat nur eine engere Bedingung. */
  var alleCache = null;
  function alle() {
    if (!alleCache) {
      alleCache = EVENTS.concat(CE.people ? CE.people.stories(fx, later) : []);
    }
    return alleCache;
  }

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
    var katalog = alle();
    for (var i = 0; i < katalog.length; i++) {
      var e = katalog[i];
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
          CE.crew.remove(s, c.id);
          return { t: 'bad', text: c.name + ' hat mitgenommen, was zu erreichen war — ' + U2.money(take) + ' — und ist verschwunden.' };
        }
        return { t: 'neutral', text: c.name + ' hat die Absage verwunden. Einigermaßen.' };
      }
      case 'skim': {
        var c2 = U.byId(s.crew, p.data.crew);
        if (!c2) return null;
        if (rng.chance(0.7)) {
          s.cash += p.data.amount;
          c2.loyalty = U.clamp(c2.loyalty - 25, 0, 100);
          return { t: 'good', text: 'Du hast ' + c2.name + ' auf frischer Tat erwischt. ' + U2.money(p.data.amount) + ' recovered.' };
        }
        s.cash -= Math.round(p.data.amount * 0.8);
        return { t: 'bad', text: 'Another ' + U2.money(Math.round(p.data.amount * 0.8)) + ' ist zur Tür hinaus. Du weißt immer noch nicht, wer.' };
      }
      case 'inspection': {
        var fine = Math.round(Math.max(4000, St.derive(s).grossIncome * 0.3) * St.derive(s).fineMul);
        s.cash -= fine;
        s.heat = U.clamp(s.heat + 5, 0, 100);
        return { t: 'bad', text: 'Der Prüfer kam mit dem Stadtjustiziar zurück. ' + U2.money(fine) + ' an Strafen.' };
      }
      case 'bust': {
        if (rng.chance(0.55)) {
          var hit = Math.round(Math.max(8000, St.derive(s).grossIncome * 0.6) * St.derive(s).fineMul);
          s.cash -= hit;
          s.heat = U.clamp(s.heat - 6, 0, 100);
          return { t: 'bad', text: 'Sie haben Klage eingereicht. ' + U2.money(hit) + ' an Anwaltskosten, bevor überhaupt etwas vor Gericht kam.' };
        }
        s.flags.survivedRaid = true;
        return { t: 'good', text: 'Daraus wurde nichts. Die Akte wanderte in eine Schublade.' };
      }
      case 'duediligence': {
        var dist = D.byId(D.DISTRICTS, p.data.district);
        var def = D.byId(D.BUSINESSES, p.data.type);
        if (rng.chance(0.45)) {
          return { t: 'good', text: def.name + ' ' + dist.wo +
            ' war sauber — der Besitzer war einfach krank. Es ging an jemand anderen, bevor du handeln konntest.' };
        }
        return { t: 'neutral', text: def.name + ' ' + dist.wo +
          ' hatte drei Grundschulden und einen stillen Teilhaber. Gut, dass du gefragt hast.' };
      }
      case 'federal': {
        var schwer = Math.round(Math.max(25000, St.derive(s).grossIncome * 1.4) * St.derive(s).fineMul);
        s.cash -= schwer;
        s.heat = U.clamp(s.heat + 8, 0, 100);
        return { t: 'bad', text: 'Das Bundesverfahren schlug ein. ' + U2.money(schwer) +
          ' an Beschlagnahmen und Anwaltskosten, bevor überhaupt jemand ein Gericht sah.' };
      }
      case 'ambition': {
        var amb = U.byId(s.crew, p.data.crew);
        if (!amb) return null;
        if (amb.loyalty < 55 && rng.chance(0.5)) {
          var mit = Math.round(Math.max(4000, St.derive(s).grossIncome * 0.25));
          s.cash -= mit;
          CE.crew.remove(s, amb.id);
          return { t: 'bad', text: amb.name + ' ging und nahm ' + U2.money(mit) +
            ' der Organisation mit. Du hast es kommen sehen und nichts getan.' };
        }
        amb.loyalty = U.clamp(amb.loyalty + 6, 0, 100);
        return { t: 'neutral', text: amb.name + ' hat sich erledigt. Was es auch war, es ist vorbei.' };
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
            ? 'Der Vermittler ist weg und ' + U2.money(amount) + '.'
            : 'Das stadtweite Unternehmen zahlte ' + U2.money(back) + ' auf ' + U2.money(amount) + ' zurück.'
        };
      }
    }
    return null;
  }

  CE.events = { draw: draw, markSeen: markSeen, resolvePending: resolvePending,
    EVENTS: EVENTS, alle: alle, fx: fx };
})(typeof window !== 'undefined' ? window : globalThis);
