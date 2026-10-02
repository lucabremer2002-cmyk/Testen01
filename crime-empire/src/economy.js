/* ---------------------------------------------------------------------
   Die Wochenabrechnung.

   Eine Regel steht ueber allem: der Spieler verliert nie Geld, ohne dass
   eine Zeile im Buch sagt, warum. Jede Bewegung landet als Posten im
   Ledger, die Summe der Posten ist exakt die Veraenderung des Bargelds.
   tools/selftest.js prueft genau das - stimmt es nicht, faellt der Test.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* Ein Buchungsposten. sign ergibt sich aus dem Betrag. */
  function line(book, label, amount, note, kind) {
    if (Math.abs(amount) < 0.5) return;
    book.push({ label: label, amount: Math.round(amount), note: note || '', kind: kind || '' });
  }

  /* Wochenabschluss. Gibt {book, report, ...} zurueck; das Spiel schreibt
     das Ergebnis in den Zustand und zeigt es als Bericht. */
  function settle(s, rng) {
    var week = U.weekOf(s.day);
    var report = [];
    var book = [];
    var cashBefore = s.cash;
    var layingLow = (s.flags.layLowUntil || -1) > s.day;

    var d = St.derive(s);

    /* ------------------------------------------------ Einnahmen */
    var cleanGross = 0, dirtyGross = 0, launderCap = d.launderCap;
    var perBiz = [];
    for (var i = 0; i < s.businesses.length; i++) {
      var b = s.businesses[i];
      var f = St.bizFinance(s, b);
      var def = D.byId(D.BUSINESSES, b.type);
      var gross = f.gross;

      /* Ruhephase: Untergrund steht still. */
      if (layingLow && !def.legal) gross = 0;
      /* Schaden aus Sabotage oder Razzia klingt ueber Wochen ab. */
      if (b.damage > 0) { gross *= (1 - U.clamp(b.damage, 0, 0.8)); }

      if (def.legal) cleanGross += gross; else dirtyGross += gross;
      perBiz.push({ b: b, def: def, f: f, gross: gross });
    }

    var over = Math.max(0, dirtyGross - launderCap);
    var launderLoss = over * 0.42;
    var grossTotal = cleanGross + dirtyGross;

    /* Die Kommission zuerst - sie greift auf denselben Bruttoertrag zu. */
    var caseCut = CE.commission ? CE.commission.incomeCut(s) : 0;
    var caseLoss = (grossTotal - launderLoss) * caseCut;

    /* Hitzestrafe auf alles, was hereinkommt. */
    var hp = St.heatPenalty(s.heat);
    var heatLoss = (grossTotal - launderLoss - caseLoss) * hp;

    line(book, 'Legale Einnahmen', cleanGross, s.businesses.filter(function (x) {
      return D.byId(D.BUSINESSES, x.type).legal; }).length + ' Betriebe', 'in');
    line(book, 'Untergrund-Einnahmen', dirtyGross,
      layingLow ? 'ausgesetzt - untergetaucht' : 'vor der Wäsche', 'in');
    line(book, 'Waschverluste', -launderLoss,
      U.money(over) + ' über deiner Kapazität von ' + U.money(launderCap) + ', 42% abgeschrieben', 'loss');
    line(book, 'Bundesverfahren', -caseLoss,
      (CE.commission ? CE.commission.phase(s).name : '') + ' kostet dich ' + U.pct(caseCut) + ' der Einnahmen', 'bad');
    line(book, 'Polizeidruck', -heatLoss,
      'Hitze ' + Math.round(s.heat) + ' kostet dich ' + U.pct(hp) + ' der Einnahmen', 'loss');

    /* ------------------------------------------------- Ausgaben */
    var upkeep = 0;
    for (i = 0; i < perBiz.length; i++) upkeep += perBiz[i].f.upkeep;
    var expenseCut = U.clamp(d.expenseCut || 0, 0, 0.35);
    upkeep *= (1 - expenseCut);

    var salaries = 0;
    for (i = 0; i < s.crew.length; i++) salaries += s.crew[i].salary;
    salaries *= (1 - expenseCut * 0.5);

    line(book, 'Betriebskosten', -upkeep, s.businesses.length + ' Standorte' +
      (expenseCut > 0 ? ', Buchhalter sparen ' + U.pct(expenseCut) : ''), 'out');
    line(book, 'Gehälter', -salaries, s.crew.filter(function (c) { return !c.player; }).length + ' auf der Lohnliste', 'out');
    line(book, 'Organisationskosten', -d.orgUpkeep, 'Unterschlüpfe, Anwälte, Fuhrpark', 'out');
    line(book, 'Bezirkskosten', -d.districtCost, d.districtsOpen + ' Bezirke gehalten', 'out');

    var income = cleanGross + dirtyGross - launderLoss - caseLoss - heatLoss;
    var expense = upkeep + salaries + d.orgUpkeep + d.districtCost;

    /* -------------------------------------------- Schutzgeld

       Der wirtschaftliche Kern der aggressiven Spielweise. Diese
       Einnahme laeuft an der Waesche vorbei: niemand meldet, was er aus
       Angst zahlt. Damit hat Aggression eine Einnahmeart, die ein
       vorsichtiger Spieler nicht hat - und sie erklaert, warum er sich
       die legalen Fassaden nicht sparen kann. */
    if (CE.fear) {
      var trib = CE.fear.tributeIncome(s, d);
      if (trib.total > 0) {
        income += trib.total;
        for (i = 0; i < trib.zeilen.length; i++) {
          line(book, 'Schutzgeld', trib.zeilen[i].amount,
            trib.zeilen[i].name + ' zahlt wöchentlich - keine Wäsche nötig', 'in');
        }
      }
    }

    /* ---------------------------------- Ertrag aus Buendnissen

       Ein Buendnis kostete bisher Geld und brachte nur Schutz - einen
       Nutzen, den man nicht beziffern kann. Wer auf Wachstum spielt,
       schloss deshalb nie eines: dasselbe Geld in einen Betrieb gesteckt
       verdiente sichtbar. Jetzt teilt ein Verbuendeter seinen Umsatz,
       und die Zeile steht mit Namen im Buch. */
    for (i = 0; i < s.rivals.length; i++) {
      var ally = s.rivals[i];
      if (!ally.allied) continue;
      var allyInfl = 0;
      for (var ak in ally.infl) allyInfl += ally.infl[ak];
      var cut = Math.round(allyInfl * 58 * (0.7 + s.rep / 250));
      if (cut > 0) {
        income += cut;
        line(book, 'Bündnisanteil', cut,
          D.byId(D.RIVALS, ally.id).name + ' teilt seinen Schnitt über ' + Math.round(allyInfl) + ' Einfluss', 'in');
      }
    }

    /* --------------------------------------- Zufaelle der Woche */
    var extra = weeklyIncidents(s, rng, d, book, report, perBiz);
    expense += extra.expense;
    income += extra.income;

    /* --------------------------------------------- Verrechnung */
    var net = income - expense;
    s.cash += net;
    if (net > 0) s.stats.earned += net; else s.stats.spent += -net;

    /* ------------------------------------------------- Schulden

       Bargeld darf ins Minus, aber nie stillschweigend. Wer im Minus
       steht, zahlt Zinsen an Leute, die keine Mahnungen schreiben - und
       wer zu tief faellt, verliert Besitz, in fester Reihenfolge und mit
       Ansage. Ein Spiel, das einfach bei -400.000 weiterlaeuft, nimmt
       dem Geld seine Bedeutung. */
    if (s.cash < 0) {
      var debt = -s.cash;
      var interest = Math.round(debt * 0.06);
      s.cash -= interest;
      line(book, 'Schuldzinsen', -interest, 'du schuldest ' + U.money(debt) + ' an Leute, die 6% pro Woche nehmen', 'bad');
      expense += interest;
      report.push({ t: 'bad', text: 'Du stehst mit ' + U.money(debt + interest) + ' im Minus. Die Zinsen laufen mit 6% pro Woche.' });

      /* Zwangsverkauf, sobald die Schuld das Vermoegen ueberholt. */
      var d3 = St.derive(s);
      if (d3.bizValue > 0 && -s.cash > d3.bizValue * 0.5) {
        var cheapest = null;
        for (var q = 0; q < s.businesses.length; q++) {
          var vq = St.bizValue(s, s.businesses[q]);
          if (!cheapest || vq < cheapest.v) cheapest = { b: s.businesses[q], v: vq };
        }
        if (cheapest) {
          var got = Math.round(cheapest.v * 0.5);
          s.cash += got;
          s.businesses = s.businesses.filter(function (x) { return x.id !== cheapest.b.id; });
          for (var q2 = 0; q2 < s.crew.length; q2++) if (s.crew[q2].post === cheapest.b.id) s.crew[q2].post = null;
          line(book, 'Zwangsverkauf', got, cheapest.b.name + ' zum halben Wert verkauft, um deine Schulden zu bedienen', 'bad');
          report.push({ t: 'bad', text: 'Deine Gläubiger haben ' + cheapest.b.name + ' genommen. Weg für ' + U.money(got) + ', die Hälfte des Werts.' });
          s.rep = U.clamp(s.rep - 4, 0, 100);
        }
      }
    }

    /* ----------------------------------------------- Hitze, Ruf */
    var heatGain = 0;
    for (i = 0; i < perBiz.length; i++) {
      if (layingLow && !perBiz[i].def.legal) continue;
      heatGain += perBiz[i].f.heat;
    }
    var heatDecay = d.heatDecay;
    if (layingLow) heatDecay += 8;
    var heatDelta = heatGain - heatDecay + (extra.heat || 0);
    s.heat = U.clamp(s.heat + heatDelta, 0, 100);

    var repDelta = d.repDrift + (extra.rep || 0);
    /* Wer gross verdient, wird bekannt; wer nur stillsteht, verblasst. */
    if (income > 0) repDelta += Math.min(1.2, Math.pow(income / 12000, 0.6) * 0.5);
    if (s.businesses.length === 0 && s.ops.length === 0) repDelta -= 0.4;
    s.rep = U.clamp(s.rep + repDelta, 0, 100);

    /* ----------------------------------------------- Einfluss */
    var inflReport = [];
    for (var k in s.districts) {
      var dd = s.districts[k];
      if (!dd.open) continue;
      var gain = d.influenceGain[k] || 0;
      /* Fremder Druck: je staerker die Rivalen hier stehen, desto mehr
         von dem Zuwachs verpufft. */
      /* Verbuendete zaehlen hier nicht mit: wer sich die Hand gegeben
         hat, kaempft nicht um dieselbe Strasse. */
      var rivalHere = 0;
      for (i = 0; i < s.rivals.length; i++) {
        if (s.rivals[i].allied) continue;
        rivalHere += s.rivals[i].infl[k] || 0;
      }
      var contest = 1 - U.clamp(rivalHere / 160, 0, 0.75);
      contest *= CE.city ? CE.city.inflOf(s, k) : 1;
      var before = dd.mine;
      dd.mine = U.clamp(dd.mine + gain * contest, 0, 100);
      if (Math.abs(dd.mine - before) > 0.05) {
        inflReport.push({ id: k, delta: dd.mine - before });
      }
    }

    /* Schaden heilt. */
    for (i = 0; i < s.businesses.length; i++) {
      if (s.businesses[i].damage > 0) s.businesses[i].damage = Math.max(0, s.businesses[i].damage - 0.22);
    }

    var entry = {
      week: week, day: s.day, book: book,
      income: Math.round(income), expense: Math.round(expense), net: Math.round(net),
      cashAfter: Math.round(s.cash), cashBefore: Math.round(cashBefore),
      heat: Math.round(s.heat * 10) / 10, heatDelta: Math.round(heatDelta * 10) / 10,
      rep: Math.round(s.rep * 10) / 10, influence: inflReport
    };
    s.ledger.unshift(entry);
    if (s.ledger.length > 80) s.ledger.pop();

    var d2 = St.derive(s);
    s.history.push({
      week: week, cash: Math.round(s.cash), income: Math.round(income),
      expense: Math.round(expense), heat: Math.round(s.heat), rep: Math.round(s.rep),
      infl: Math.round(d2.totalInfluence), worth: Math.round(d2.netWorth)
    });
    if (s.history.length > 400) s.history.shift();

    return { entry: entry, report: report, derived: d2 };
  }

  /* --------------------------------------------- Zufaelle der Woche

     Kleine Dinge, die kein Ereignisfenster verdienen, aber die Woche
     lebendig machen. Alle erscheinen als Buchungszeile mit Begruendung.
  */
  function weeklyIncidents(s, rng, d, book, report, perBiz) {
    var out = { expense: 0, income: 0, heat: 0, rep: 0 };

    /* Reparaturen und Kleinkram, skaliert mit der Groesse. */
    if (s.businesses.length && rng.chance(0.30)) {
      var target = rng.pick(s.businesses);
      var def = D.byId(D.BUSINESSES, target.type);
      var cost = Math.round(St.bizValue(s, target) * rng.range(0.008, 0.025));
      if (cost > 0) {
        out.expense += cost;
        line(book, 'Ungeplante Reparaturen', -cost, target.name + ' - ' +
          rng.pick(['Keller unter Wasser', 'Brandschutzprüfung', 'defekte Kühlung', 'Dachschaden',
                    'gestohlene Ware', 'eine Scheibe und eine Botschaft']), 'out');
      }
    }

    /* Gute Woche fuer einen Betrieb. */
    if (s.businesses.length && rng.chance(0.22)) {
      var star = rng.pick(s.businesses);
      var f = St.bizFinance(s, star);
      var bonus = Math.round(f.gross * rng.range(0.25, 0.7));
      if (bonus > 0) {
        out.income += bonus;
        line(book, 'Außergewöhnliche Woche', bonus, star.name + ' lag weit über dem üblichen Schnitt', 'in');
      }
    }

    /* Ermittlungen ab Hitze 40: kosten Geld, nie den Betrieb. */
    if (s.heat >= 40 && rng.chance(0.18 + (s.heat - 40) * 0.008)) {
      var fine = Math.round(Math.max(2500, d.grossIncome * rng.range(0.10, 0.28)) * d.fineMul);
      out.expense += fine;
      s.stats.fines++;
      line(book, 'Anwaltskosten und Strafen', -fine, 'eine Ermittlung hat deine Unterlagen erreicht', 'bad');
      report.push({ t: 'bad', text: 'Die Ermittler haben die Organisation mit ' + U.money(fine) + ' belegt.' });
    }

    /* Razzia ab Hitze 70: kann einen Untergrundbetrieb kosten. */
    if (s.heat >= 70) {
      var raidP = (0.06 + (s.heat - 70) * 0.006) * (1 - U.clamp(d.raidCut, 0, 0.7));
      if (rng.chance(raidP)) {
        s.stats.raids++;
        var dirty = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
        if (dirty.length && rng.chance(0.55)) {
          var lost = rng.pick(dirty);
          var value = St.bizValue(s, lost);
          s.businesses = s.businesses.filter(function (x) { return x.id !== lost.id; });
          for (var i = 0; i < s.crew.length; i++) if (s.crew[i].post === lost.id) s.crew[i].post = null;
          line(book, 'Beschlagnahme', 0, lost.name + ' wurde durchsucht und eingezogen. ' + U.money(value) + ' an Werten verloren.', 'bad');
          report.push({ t: 'bad', text: 'RAZZIA: ' + lost.name + ' ist weg. ' + U.money(value) + ' abgeschrieben.' });
          s.heat = U.clamp(s.heat - 12, 0, 100);
          s.rep = U.clamp(s.rep - 3, 0, 100);
        } else {
          var hit = Math.round(Math.max(6000, d.grossIncome * 0.5) * d.fineMul);
          out.expense += hit;
          s.flags.survivedRaid = true;
          line(book, 'Razzia ohne Anklage', -hit, 'sie haben durchsucht, Unterlagen mitgenommen und sind gegangen', 'bad');
          report.push({ t: 'warn', text: 'Eine Razzia kam und fand nichts Anklagefähiges. ' + U.money(hit) + ' an Kosten.' });
          s.heat = U.clamp(s.heat - 8, 0, 100);
        }
      }
    }

    return out;
  }

  CE.economy = { settle: settle, line: line };
})(typeof window !== 'undefined' ? window : globalThis);
