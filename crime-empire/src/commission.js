/* ---------------------------------------------------------------------
   Die Kommission - das Spaetspiel.

   Das Problem, das dieses System loest: ab Woche 90 war alles gekauft.
   Sechs Bezirke, achtundvierzig Betriebe, jeder Ausbau auf Maximum, und
   dreihundertsiebenunddreissigtausend Dollar Gewinn je Woche, die sich
   auftuermten, weil es nichts mehr zu kaufen gab. Ein Aufbauspiel ohne
   etwas zum Aufbauen ist ein Taschenrechner.

   Also bekommt der Erfolg einen Gegner. Eine Bundeskommission baut einen
   Fall gegen die Organisation auf. Der Fall waechst mit *Groesse* - je
   mehr man besitzt, desto mehr gibt es zu ermitteln - und mit Hitze.
   Er laesst sich nicht abschalten, nur verlangsamen und zurueckdraengen,
   und zwar mit genau dem, wovon man zu viel hat: Geld.

   Damit kippt die Bedeutung von Geld im Spaetspiel von "Punktestand" zu
   "Verteidigung". Anwaelte, Rechtsbeistand und legale Betriebe waren
   vorher Beiwerk; hier zahlen sie sich aus.

   Vier Phasen, jede mit anderen Folgen und anderer Gegenwehr. Die
   letzte kostet wirklich etwas - aber sie beendet das Spiel nicht,
   sondern wirft einen zurueck. Ein Aufbauspiel, das man verlieren kann,
   ohne weiterspielen zu duerfen, wird nicht zu Ende gespielt.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  var PHASEN = [
    { id: 0, name: 'Open File', short: 'Filed', at: 0,
      desc: 'A file exists with your name on it. Nothing in it sticks yet.',
      incomeCut: 0 },
    { id: 1, name: 'Surveillance', short: 'Watched', at: 30,
      desc: 'A federal task force is building a picture. Wiretaps, ' +
            'photographs, a lot of patience.',
      incomeCut: 0.07 },
    { id: 2, name: 'Grand Jury', short: 'Grand Jury', at: 62,
      desc: 'They are presenting evidence in a sealed room. Your ' +
            'accountants are being subpoenaed one at a time.',
      incomeCut: 0.18 },
    { id: 3, name: 'Indictment', short: 'Indicted', at: 90,
      desc: 'Sealed indictments are signed. When they move, they take ' +
            'everything they can carry.',
      incomeCut: 0.32 }
  ];

  function phaseOf(strength) {
    var p = PHASEN[0];
    for (var i = PHASEN.length - 1; i >= 0; i--) {
      if (strength >= PHASEN[i].at) { p = PHASEN[i]; break; }
    }
    return p;
  }

  function fresh() {
    return { open: false, strength: 0, phase: 0, opened: -1, raids: 0,
             lastPhase: 0, spent: 0, beaten: 0 };
  }

  /* Wann die Kommission aufmacht: wenn man gross genug ist, um sie zu
     verdienen. Nicht nach Zeit - ein vorsichtiger Spieler soll nicht
     bestraft werden, weil die Uhr laeuft. */
  function shouldOpen(s, d) {
    if (s.commission && s.commission.open) return false;
    if (d.rank >= 3) return true;
    if (d.districtsOpen >= 3 && s.businesses.length >= 10) return true;
    if (d.netWorth > 400000) return true;
    return false;
  }

  /* Woraus der Fall waechst. Jede Zeile wird dem Spieler angezeigt -
     ein Gegner, dessen Naehrboden man nicht sieht, ist Willkuer. */
  function feed(s, d) {
    var zeilen = [];
    var dirty = 0, legal = 0;
    for (var i = 0; i < s.businesses.length; i++) {
      if (D.byId(D.BUSINESSES, s.businesses[i].type).legal) legal++; else dirty++;
    }

    /* Groesse: das Grundrauschen. Je mehr Untergrund, desto mehr Spur. */
    var groesse = dirty * 0.55 + legal * 0.12;
    if (groesse > 0) zeilen.push({ label: 'Scale of the organisation', v: groesse,
      note: dirty + ' underground and ' + legal + ' legal sites to trace' });

    /* Macht an sich. Eine Kommission ermittelt nicht nur Verbrechen,
       sondern Verhaeltnisse - und ab einer gewissen Groesse ist der
       Unterschied akademisch. Ohne diese Zeile wuchs der Fall bei einem
       Imperium mit achtundvierzig Standorten um 1,9 Punkte je Woche und
       erreichte in einer ganzen Partie nie eine Anklage: das Spaetspiel
       hatte wieder keinen Gegner. */
    var macht = Math.pow(Math.max(0, d.netWorth) / 1000000, 0.7) * 0.42;
    if (macht > 0.15) zeilen.push({ label: 'Sheer size of it', v: macht,
      note: U.money(Math.round(d.netWorth)) + ' is not something a task force ignores' });

    /* Hitze ueber 35 ist der schnellste Weg in eine Anklage. */
    if (s.heat > 35) {
      var h = (s.heat - 35) * 0.055;
      zeilen.push({ label: 'Police attention', v: h, note: 'heat at ' + Math.round(s.heat) });
    }

    /* Schmutziges Geld, das nicht gewaschen wird, ist Beweismaterial. */
    if (d.launderLoss > 0) {
      var w = Math.min(3.2, d.launderLoss / 9000);
      zeilen.push({ label: 'Unlaundered money', v: w,
        note: U.money(Math.round(d.launderLoss)) + ' a week going through unexplained' });
    }

    /* Gegenwirkung: Anwaelte, Rechtsbeistand, saubere Bilanz. */
    var anwalt = 0;
    for (i = 0; i < s.crew.length; i++) {
      if (s.crew[i].role === 'lawyer') anwalt += 0.85 * (0.6 + St.effectiveSkill(s.crew[i]) / 14);
    }
    anwalt += (s.org.retainer || 0) * 0.75;
    if (anwalt > 0) zeilen.push({ label: 'Legal defence', v: -anwalt,
      note: 'lawyers and retainers slowing them down' });

    /* Ein sauberer Anteil hilft sichtbar. */
    if (legal > dirty && legal > 0) {
      var sauber = Math.min(2.2, (legal - dirty) * 0.3);
      zeilen.push({ label: 'Legitimate front', v: -sauber,
        note: 'a majority-legal portfolio is hard to characterise' });
    }

    /* Ruf oeffnet Tueren, auch im Gericht. */
    if (s.rep >= 70) zeilen.push({ label: 'Standing in the city', v: -0.5, note: 'people vouch for you' });

    /* Wer klein und ruhig ist, verliert Aufmerksamkeit. */
    if (s.heat < 20 && dirty <= 2) zeilen.push({ label: 'Nothing new to look at', v: -1.4, note: 'quiet weeks' });

    var netto = 0;
    for (i = 0; i < zeilen.length; i++) netto += zeilen[i].v;
    return { zeilen: zeilen, netto: netto };
  }

  /* Wochenschritt. Gibt Berichtszeilen zurueck, die das Spiel anzeigt. */
  function weekly(s, rng, d, report, book) {
    if (!s.commission) s.commission = fresh();
    var c = s.commission;

    if (!c.open) {
      if (!shouldOpen(s, d)) return;
      c.open = true;
      c.opened = s.day;
      c.strength = 8;
      report.push({ t: 'bad', banner: 'Federal Task Force',
        ico: 'scales',
        text: 'A joint task force has opened a file on your organisation. ' +
              'From here, everything you build is also evidence.' });
      return;
    }

    var f = feed(s, d);
    var vorher = c.strength;
    c.strength = U.clamp(c.strength + f.netto, 0, 100);

    var altePhase = c.phase;
    c.phase = phaseOf(c.strength).id;
    if (c.phase >= 2) c.reachedGrand = true;

    if (c.phase > altePhase) {
      var p = PHASEN[c.phase];
      report.push({ t: 'bad', banner: p.name, ico: 'scales',
        text: p.desc + ' Revenue is down ' + U.pct(p.incomeCut) + ' while it lasts.' });
    } else if (c.phase < altePhase) {
      report.push({ t: 'good', banner: 'Case Weakened', ico: 'scales',
        text: 'The case has fallen back to ' + PHASEN[c.phase].name.toLowerCase() + '. ' +
              'Whatever you paid for, it worked.' });
    }

    /* Anklage: der Zugriff. Er nimmt viel, aber nicht alles - und er
       setzt den Fall zurueck, statt das Spiel zu beenden. */
    if (c.strength >= 100) {
      strike(s, rng, d, report, book);
      c.strength = 52;
      c.phase = phaseOf(c.strength).id;
      c.raids++;
    }
  }

  /* Der Zugriff. Absichtlich schwer, absichtlich nicht toedlich. */
  function strike(s, rng, d, report, book) {
    var verloren = [];
    /* Zuerst die Untergrundbetriebe - das ist es, was sie beweisen koennen. */
    var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
    var nehmen = Math.max(1, Math.round(dreck.length * rng.range(0.28, 0.45)));
    rng.shuffle(dreck);
    var wert = 0;
    for (var i = 0; i < nehmen && i < dreck.length; i++) {
      wert += St.bizValue(s, dreck[i]);
      verloren.push(dreck[i].name);
      var id = dreck[i].id;
      s.businesses = s.businesses.filter(function (x) { return x.id !== id; });
      for (var j = 0; j < s.crew.length; j++) if (s.crew[j].post === id) s.crew[j].post = null;
    }

    /* Und Bargeld, das sie einfrieren koennen. */
    var frost = Math.round(Math.max(0, s.cash) * rng.range(0.25, 0.4));
    s.cash -= frost;
    s.stats.spent += frost;

    /* Leute werden mitgenommen. Wer wenig loyal ist, redet. */
    var verhaftet = [];
    var kandidaten = s.crew.filter(function (c2) { return !c2.player; });
    if (kandidaten.length) {
      var n = Math.min(kandidaten.length, 1 + Math.floor(rng.next() * 2));
      rng.shuffle(kandidaten);
      for (i = 0; i < n; i++) {
        var weg = kandidaten[i];
        verhaftet.push(weg.name);
        CE.crew.remove(s, weg.id, report);
        if (weg.loyalty < 45) s.heat = U.clamp(s.heat + 6, 0, 100);
      }
    }

    s.rep = U.clamp(s.rep - 12, 0, 100);
    s.heat = U.clamp(s.heat - 18, 0, 100);
    s.stats.raids++;
    s.flags.indicted = (s.flags.indicted || 0) + 1;

    if (book) {
      CE.economy.line(book, 'Federal seizure', -frost,
        'assets frozen under the indictment' + (verloren.length ? ', plus ' + verloren.length + ' sites taken' : ''), 'bad');
    }
    report.push({ t: 'bad', banner: 'The Raid', ico: 'warn',
      text: 'They moved at dawn. ' + (verloren.length ? verloren.length + ' operations seized (' +
        U.money(wert) + '), ' : '') + U.money(frost) + ' frozen' +
        (verhaftet.length ? ', ' + verhaftet.join(' and ') + ' taken into custody' : '') + '.' });
  }

  /* -------------------------------------------------- Gegenmassnahmen

     Alle kosten Geld, und zwar viel - das ist der Zweck. Jede hat einen
     anderen Nebenpreis, damit die Wahl eine ist.
  */
  function actions(s, d) {
    var basis = Math.max(30000, d.grossIncome * 1.1);
    var c = s.commission || fresh();
    return [
      { id: 'records', name: 'Burn the Records',
        cost: Math.round(basis * 0.6), strength: -9, heat: 3, rep: 0,
        desc: 'Ledgers, drives and a very thorough afternoon. Buys time, nothing more.' },
      { id: 'witness', name: 'Reach a Witness',
        cost: Math.round(basis * 1.4), strength: -19, heat: 2, rep: -4,
        desc: 'Somebody who was going to testify remembers it differently. People notice.' },
      { id: 'counsel', name: 'Mount a Defence',
        cost: Math.round(basis * 2.2), strength: -28, heat: -4, rep: 2,
        desc: 'The best firm in the state, on retainer, for as long as this takes.' },
      { id: 'divest', name: 'Divest the Worst of It',
        cost: 0, strength: -22, heat: -10, rep: 3, divest: true,
        desc: 'Sell your two most exposed underground operations at a loss. ' +
              'Nothing weakens a case like having less to prosecute.' }
    ];
  }

  function canDo(s, id) {
    var c = s.commission;
    if (!c || !c.open) return { ok: false, why: 'There is no case to fight.' };
    var d = St.derive(s);
    var a = null, list = actions(s, d);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) a = list[i];
    if (!a) return { ok: false, why: 'Unknown.' };
    if (a.divest) {
      var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
      if (dreck.length < 2) return { ok: false, why: 'You need at least two underground operations to give up.' };
    } else if (s.cash < a.cost) {
      return { ok: false, why: 'Needs ' + U.money(a.cost) + '.' };
    }
    if (c.strength <= 0) return { ok: false, why: 'The case is already at nothing.' };
    return { ok: true, act: a };
  }

  function doAction(s, id) {
    var pre = canDo(s, id);
    if (!pre.ok) return pre;
    var a = pre.act, c = s.commission;
    var text = '';

    if (a.divest) {
      var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; })
        .sort(function (x, y) { return St.bizFinance(s, y).heat - St.bizFinance(s, x).heat; });
      var erloes = 0, namen = [];
      for (var i = 0; i < 2 && i < dreck.length; i++) {
        erloes += Math.round(St.bizValue(s, dreck[i]) * 0.5);
        namen.push(dreck[i].name);
        var r = CE.empire.sell(s, dreck[i].id);
        /* sell() zahlt 68 %, hier sind es 50 - der Rest ist der Preis der Eile. */
        s.cash -= Math.round(r.price - St.bizValue(s, dreck[i]) * 0.5);
      }
      text = namen.join(' and ') + ' are gone, at half what they were worth.';
    } else {
      s.cash -= a.cost;
      s.stats.spent += a.cost;
      c.spent += a.cost;
      text = U.money(a.cost) + ' spent.';
    }

    c.strength = U.clamp(c.strength + a.strength, 0, 100);
    s.heat = U.clamp(s.heat + (a.heat || 0), 0, 100);
    s.rep = U.clamp(s.rep + (a.rep || 0), 0, 100);
    var neu = phaseOf(c.strength).id;
    if (neu < c.phase) { c.phase = neu; c.beaten++; }
    else c.phase = neu;

    /* Wer einen Fall von der Anklagekammer auf null zurueckdraengt, hat
       etwas geschafft, das eigene Erwaehnung verdient. */
    if (c.reachedGrand && c.strength <= 0) s.flags.caseBeaten = true;

    return { ok: true, text: a.name + ': ' + text + ' Case strength down to ' + Math.round(c.strength) + '.',
      strength: c.strength, phase: c.phase };
  }

  function phase(s) {
    if (!s.commission || !s.commission.open) return PHASEN[0];
    return phaseOf(s.commission.strength);
  }

  function incomeCut(s) { return phase(s).incomeCut; }

  CE.commission = {
    PHASEN: PHASEN, fresh: fresh, weekly: weekly, feed: feed, actions: actions,
    canDo: canDo, doAction: doAction, phase: phase, phaseOf: phaseOf,
    incomeCut: incomeCut, shouldOpen: shouldOpen
  };
})(typeof window !== 'undefined' ? window : globalThis);
