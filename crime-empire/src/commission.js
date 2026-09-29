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
             lastPhase: 0, spent: 0, beaten: 0, reachedGrand: false,
             /* Eigene Mittel. Vorher war die Kommission eine Zahl, die
                der Spieler mit Geld niederhielt - sie besass nichts, tat
                nichts und zielte auf niemanden. Jetzt hat sie ein
                Budget, legt damit Figuren aufs Brett und sucht sich
                einen Schwerpunkt. */
             budget: 0, assets: [], target: null, lastAction: '', acted: -1 };
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

    /* Was die Kommission selbst aufgebaut hat. Das ist der Unterschied
       zwischen einem Gegner und einem Zaehler: diese Zeilen entstehen
       nicht aus dem, was der Spieler besitzt, sondern aus dem, was die
       andere Seite getan hat - und sie lassen sich gezielt entfernen. */
    var abhoer = 0, spitzel = 0, zeugen = 0;
    var as = (s.commission && s.commission.assets) || [];
    for (i = 0; i < as.length; i++) {
      if (as[i].kind === 'wiretap') abhoer++;
      else if (as[i].kind === 'informant') spitzel++;
      else if (as[i].kind === 'witness') zeugen++;
    }
    if (abhoer) zeilen.push({ label: 'Wiretaps', v: abhoer * 0.8,
      note: abhoer + ' of your sites are being listened to' });
    if (spitzel) zeilen.push({ label: 'Somebody is talking', v: spitzel * 1.3,
      note: spitzel + ' informant' + (spitzel === 1 ? '' : 's') + ' inside your organisation' });
    if (zeugen) zeilen.push({ label: 'Cooperating witnesses', v: zeugen * 1.8,
      note: zeugen + ' named witness' + (zeugen === 1 ? '' : 'es') + ' prepared to testify' });

    /* Ruf oeffnet Tueren, auch im Gericht. */
    if (s.rep >= 70) zeilen.push({ label: 'Standing in the city', v: -0.5, note: 'people vouch for you' });
    if (d.boardCase) zeilen.push({ label: 'Board seat', v: -d.boardCase,
      note: 'a man on a development board is not an obvious defendant' });

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

    pflegeAssets(s, c, report);

    /* Eigenes Budget. Es waechst mit der Phase und aus Beschlagnahmten -
       wer einmal durchsucht wurde, finanziert damit die naechste Runde. */
    c.budget = (c.budget || 0) + 3500 + c.strength * 160 + c.phase * 5500;

    /* Schwerpunkt: der Bezirk, in dem am meisten zu holen ist. Er wird
       angezeigt, damit man weiss, wo man aufraeumen muss. */
    waehleZiel(s, d, c);

    /* Ihr Zug. */
    agieren(s, rng, d, c, report);

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
       setzt den Fall zurueck, statt das Spiel zu beenden.

       Mit Abstand und Nachwirkung: im Szenarienlauf traf es den
       schlampigen Spieler dreizehnmal, alle vier bis sieben Wochen.
       Damit wurde aus einer Katastrophe eine Steuer. Jetzt vergehen
       mindestens fuenfzehn Wochen dazwischen, der Fall faellt tiefer
       zurueck - und jeder weitere Zugriff sitzt haerter, weil sie beim
       zweiten Mal wissen, wo sie suchen muessen. */
    if (c.strength >= 100) {
      if (s.day - (c.lastStrike || -999) < 105) {
        /* Sie haben den Fall, aber noch keinen Termin. Der Druck bleibt. */
        c.strength = 99;
      } else {
        c.lastStrike = s.day;
        strike(s, rng, d, report, book);
        c.strength = 30 + Math.min(20, c.raids * 5);
        c.phase = phaseOf(c.strength).id;
        c.raids++;
      }
    }
  }

  /* ------------------------------------------------ Eigene Zuege

     Ein Gegner, der nur am Ende einmal zuschlaegt, ist ein Countdown.
     Diese Zuege sind klein, sichtbar und einzeln beantwortbar - man
     jagt ihre Figuren, statt eine Zahl zu bezahlen.
  */
  var ZUEGE = [
    { id: 'wiretap', phase: 1, cost: 18000, w: 1.4 },
    { id: 'informant', phase: 1, cost: 26000, w: 1.2 },
    { id: 'freeze', phase: 2, cost: 22000, w: 1.0 },
    { id: 'subpoena', phase: 2, cost: 32000, w: 1.1 },
    { id: 'witness', phase: 3, cost: 55000, w: 1.6 }
  ];

  function waehleZiel(s, d, c) {
    var best = null, bestW = -1;
    for (var k in s.districts) {
      if (!s.districts[k].open) continue;
      var bd = d.byDistrict[k];
      if (!bd) continue;
      var w = bd.gross / 1000 + bd.heat * 3;
      if (w > bestW) { bestW = w; best = k; }
    }
    c.target = best;
  }

  function agieren(s, rng, d, c, report) {
    if (s.day - (c.acted || -99) < 14) return;      /* hoechstens alle zwei Wochen */
    var moeglich = ZUEGE.filter(function (z) {
      if (c.phase < z.phase) return false;
      if (c.budget < z.cost) return false;
      if (z.id === 'wiretap') return s.businesses.length > 0 && zaehle(c, 'wiretap') < 3;
      if (z.id === 'informant') return s.crew.filter(function (x) { return !x.player; }).length > 0 && zaehle(c, 'informant') < 2;
      if (z.id === 'witness') return zaehle(c, 'witness') < 2;
      if (z.id === 'freeze') return s.cash > 20000;
      return true;
    });
    if (!moeglich.length) return;
    var zug = rng.weighted(moeglich);
    if (!zug) return;
    c.budget -= zug.cost;
    c.acted = s.day;

    switch (zug.id) {
      case 'wiretap': {
        /* Auf den lohnendsten Standort im Schwerpunktbezirk. */
        var kand = s.businesses.filter(function (b) {
          return (!c.target || b.district === c.target) && !hatAsset(c, 'wiretap', b.id);
        });
        if (!kand.length) kand = s.businesses.filter(function (b) { return !hatAsset(c, 'wiretap', b.id); });
        if (!kand.length) return;
        kand.sort(function (a, b) { return St.bizFinance(s, b).gross - St.bizFinance(s, a).gross; });
        var ziel = kand[0];
        c.assets.push({ kind: 'wiretap', ref: ziel.id, name: ziel.name, since: s.day });
        c.lastAction = 'put a wire in ' + ziel.name;
        report.push({ t: 'warn', text: 'Something is wrong at ' + ziel.name + '. The phones click, ' +
          'and takings are down. Somebody is listening.' });
        break;
      }
      case 'informant': {
        var leute = s.crew.filter(function (x) { return !x.player && !hatAsset(c, 'informant', x.id); });
        if (!leute.length) return;
        leute.sort(function (a, b) { return a.loyalty - b.loyalty; });
        var wer = leute[0];
        /* Der Name steht im Spielstand, aber die Oberflaeche zeigt ihn
           nicht: wer den Spitzel finden will, muss suchen. */
        c.assets.push({ kind: 'informant', ref: wer.id, name: wer.name, since: s.day, known: false });
        c.lastAction = 'turned somebody inside your organisation';
        report.push({ t: 'bad', banner: 'Somebody Is Talking', ico: 'informant',
          text: 'Details only your own people know have reached the task force. ' +
                'One of them is cooperating, and you do not know which.' });
        break;
      }
      case 'freeze': {
        var betrag = Math.round(s.cash * rng.range(0.10, 0.20));
        if (betrag < 1000) return;
        s.cash -= betrag;
        c.budget += Math.round(betrag * 0.25);      /* sie finanzieren sich daraus */
        c.assets.push({ kind: 'freeze', amount: betrag, until: s.day + 28, since: s.day });
        c.lastAction = 'froze ' + U.money(betrag) + ' of your accounts';
        report.push({ t: 'bad', text: U.money(betrag) + ' has been frozen pending a hearing. ' +
          'You get it back in four weeks, if there is anything left to get.' });
        break;
      }
      case 'subpoena': {
        var b2 = s.businesses.length ? s.businesses[rng.int(0, s.businesses.length - 1)] : null;
        if (!b2) return;
        b2.damage = U.clamp((b2.damage || 0) + 0.3, 0, 0.8);
        c.strength = U.clamp(c.strength + 3, 0, 100);
        c.lastAction = 'subpoenaed the books at ' + b2.name;
        report.push({ t: 'warn', text: 'Investigators took four years of records out of ' + b2.name +
          ' in cardboard boxes. It will not trade properly for a while.' });
        break;
      }
      case 'witness': {
        var namen = ['a former accountant', 'somebody who used to drive for you',
                     'a supplier you stopped paying', 'a man who owns the building next door'];
        var nm = namen[rng.int(0, namen.length - 1)];
        c.assets.push({ kind: 'witness', name: nm, since: s.day });
        c.lastAction = 'signed up a cooperating witness';
        report.push({ t: 'bad', banner: 'A Witness', ico: 'scales',
          text: nm.charAt(0).toUpperCase() + nm.slice(1) + ' has agreed to testify. ' +
                'Every week they stay on the list, the case gets heavier.' });
        break;
      }
    }
  }

  function zaehle(c, kind) {
    var n = 0;
    for (var i = 0; i < (c.assets || []).length; i++) if (c.assets[i].kind === kind) n++;
    return n;
  }
  function hatAsset(c, kind, ref) {
    for (var i = 0; i < (c.assets || []).length; i++) {
      if (c.assets[i].kind === kind && c.assets[i].ref === ref) return true;
    }
    return false;
  }

  /* Eingefrorenes Geld kommt zurueck, Mittel zu verschwundenen Zielen
     verfallen. Laeuft jede Woche. */
  function pflegeAssets(s, c, report) {
    if (!c.assets) c.assets = [];
    for (var i = c.assets.length - 1; i >= 0; i--) {
      var a = c.assets[i];
      if (a.kind === 'freeze') {
        if (s.day >= a.until) {
          s.cash += a.amount;
          report.push({ t: 'good', text: U.money(a.amount) + ' has been released. The hearing found nothing.' });
          c.assets.splice(i, 1);
        }
        continue;
      }
      if (a.kind === 'wiretap' && !U.byId(s.businesses, a.ref)) c.assets.splice(i, 1);
      else if (a.kind === 'informant' && !U.byId(s.crew, a.ref)) c.assets.splice(i, 1);
    }
  }

  /* Der Zugriff. Absichtlich schwer, absichtlich nicht toedlich. */
  function strike(s, rng, d, report, book) {
    var verloren = [];
    /* Zuerst die Untergrundbetriebe - das ist es, was sie beweisen koennen. */
    var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
    /* Jeder weitere Zugriff greift tiefer. */
    var haerte = 1 + Math.min(0.6, (s.commission.raids || 0) * 0.2);
    var nehmen = Math.max(1, Math.round(dreck.length * rng.range(0.28, 0.45) * haerte));
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
    var frost = Math.round(Math.max(0, s.cash) * U.clamp(rng.range(0.25, 0.4) * haerte, 0.2, 0.7));
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

    /* Ein erfolgreicher Zugriff finanziert den naechsten. */
    s.commission.budget += Math.round(frost * 0.5 + wert * 0.1);

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

  /* ------------------------------------------- Gezielte Gegenwehr

     Die allgemeinen Massnahmen senken eine Zahl. Diese hier entfernen
     eine bestimmte Figur vom Brett - und nur sie helfen gegen das, was
     die Kommission aufgebaut hat. Das ist der Unterschied zwischen
     "Geld gegen Statistik" und einem Schlagabtausch.
  */
  function targeted(s, d) {
    var c = s.commission;
    if (!c || !c.open) return [];
    var basis = U.clamp(d.grossIncome * 0.9 + Math.max(0, d.netWorth) * 0.02, 4000, 500000);
    var out = [];
    var wires = zaehle(c, 'wiretap');
    var spitzel = zaehle(c, 'informant');
    var zeugen = zaehle(c, 'witness');
    var frost = 0;
    for (var i = 0; i < (c.assets || []).length; i++) if (c.assets[i].kind === 'freeze') frost += c.assets[i].amount;

    if (wires) {
      out.push({ id: 'sweep', name: 'Sweep for Bugs', cost: Math.round(basis * 0.5 * wires),
        desc: 'A technician, a van and an afternoon in every back office. ' +
              'Removes all ' + wires + ' wiretap' + (wires === 1 ? '' : 's') + '.',
        badge: wires + ' wiretap' + (wires === 1 ? '' : 's') });
    }
    if (spitzel) {
      out.push({ id: 'leak', name: 'Find the Leak', cost: Math.round(basis * 0.9),
        desc: 'Feed four people four different stories and see which one comes back. ' +
              'Good odds of naming the informant. They will not stay afterwards.',
        badge: spitzel + ' informant' + (spitzel === 1 ? '' : 's') });
    }
    if (zeugen) {
      out.push({ id: 'silence', name: 'Persuade a Witness', cost: Math.round(basis * 1.6),
        desc: 'Money, a job for a relative, or a conversation. Removes one witness ' +
              'from the list. It costs reputation and it is noticed.',
        badge: zeugen + ' witness' + (zeugen === 1 ? '' : 'es') });
    }
    if (frost) {
      out.push({ id: 'unfreeze', name: 'Fight the Freeze', cost: Math.round(basis * 0.7),
        desc: 'An emergency motion. Releases ' + U.money(frost) + ' now instead of in four weeks.',
        badge: U.money(frost) + ' frozen' });
    }
    return out;
  }

  function doTargeted(s, rng, id) {
    var c = s.commission;
    if (!c || !c.open) return { ok: false, why: 'There is no case.' };
    var d = St.derive(s);
    var a = null, list = targeted(s, d);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) a = list[i];
    if (!a) return { ok: false, why: 'Nothing to do there.' };
    if (s.cash < a.cost) return { ok: false, why: 'Needs ' + U.money(a.cost) + '.' };

    s.cash -= a.cost;
    s.stats.spent += a.cost;
    c.spent += a.cost;

    if (id === 'sweep') {
      var n = 0;
      for (i = c.assets.length - 1; i >= 0; i--) if (c.assets[i].kind === 'wiretap') { c.assets.splice(i, 1); n++; }
      c.strength = U.clamp(c.strength - n * 2, 0, 100);
      return { ok: true, text: n + ' device' + (n === 1 ? '' : 's') + ' found and destroyed. ' +
        'Your sites are quiet again.' };
    }
    if (id === 'leak') {
      var idx = -1;
      for (i = 0; i < c.assets.length; i++) if (c.assets[i].kind === 'informant') { idx = i; break; }
      if (idx < 0) return { ok: false, why: 'Nobody is talking.' };
      var asset = c.assets[idx];
      /* Nicht garantiert. Wer sucht, findet meistens - aber nicht immer,
         und ein Fehlschlag kostet die Mannschaft Nerven. */
      if (rng.chance(0.72)) {
        var wer = U.byId(s.crew, asset.ref);
        c.assets.splice(idx, 1);
        c.strength = U.clamp(c.strength - 6, 0, 100);
        if (wer) {
          CE.crew.remove(s, wer.id);
          for (i = 0; i < s.crew.length; i++) if (!s.crew[i].player) {
            s.crew[i].loyalty = U.clamp(s.crew[i].loyalty - 5, 0, 100);
          }
          return { ok: true, text: 'It was ' + wer.name + '. They are gone, and everybody knows why.' };
        }
        return { ok: true, text: 'The leak is closed.' };
      }
      for (i = 0; i < s.crew.length; i++) if (!s.crew[i].player) {
        s.crew[i].loyalty = U.clamp(s.crew[i].loyalty - 8, 0, 100);
      }
      return { ok: true, text: 'You interrogated four people and learned nothing. ' +
        'All four of them remember it.' };
    }
    if (id === 'silence') {
      for (i = 0; i < c.assets.length; i++) {
        if (c.assets[i].kind === 'witness') {
          var nm = c.assets[i].name;
          c.assets.splice(i, 1);
          c.strength = U.clamp(c.strength - 9, 0, 100);
          s.rep = U.clamp(s.rep - 3, 0, 100);
          s.heat = U.clamp(s.heat + 3, 0, 100);
          return { ok: true, text: nm.charAt(0).toUpperCase() + nm.slice(1) +
            ' is no longer cooperating. Nobody asked how.' };
        }
      }
      return { ok: false, why: 'No witness to reach.' };
    }
    if (id === 'unfreeze') {
      var summe = 0;
      for (i = c.assets.length - 1; i >= 0; i--) {
        if (c.assets[i].kind === 'freeze') { summe += c.assets[i].amount; c.assets.splice(i, 1); }
      }
      s.cash += summe;
      return { ok: true, text: U.money(summe) + ' released by court order.' };
    }
    return { ok: false, why: 'Unknown.' };
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
    targeted: targeted, doTargeted: doTargeted, zaehle: zaehle,
    canDo: canDo, doAction: doAction, phase: phase, phaseOf: phaseOf,
    incomeCut: incomeCut, shouldOpen: shouldOpen
  };
})(typeof window !== 'undefined' ? window : globalThis);
