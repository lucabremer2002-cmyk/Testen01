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
    { id: 0, name: 'Akte angelegt', short: 'Akte', at: 0,
      desc: 'Es gibt eine Akte mit deinem Namen darauf. Noch hält nichts darin.',
      incomeCut: 0 },
    { id: 1, name: 'Überwachung', short: 'Beobachtet', at: 30,
      desc: 'Eine Bundessonderkommission setzt ein Bild zusammen. Abhörwanzen, ' +
            'Fotos, sehr viel Geduld.',
      incomeCut: 0.07 },
    { id: 2, name: 'Anklagekammer', short: 'Kammer', at: 62,
      desc: 'In einem verschlossenen Raum werden Beweise vorgelegt. Deine ' +
            'Buchhalter werden einer nach dem anderen vorgeladen.',
      incomeCut: 0.18 },
    { id: 3, name: 'Anklage', short: 'Angeklagt', at: 90,
      desc: 'Versiegelte Anklageschriften sind unterschrieben. Wenn sie zugreifen, ' +
            'nehmen sie alles mit, was sie tragen können.',
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
    if (groesse > 0) zeilen.push({ label: 'Größe der Organisation', v: groesse,
      note: dirty + ' Untergrund- und ' + legal + ' legale Standorte zu verfolgen' });

    /* Macht an sich. Eine Kommission ermittelt nicht nur Verbrechen,
       sondern Verhaeltnisse - und ab einer gewissen Groesse ist der
       Unterschied akademisch. Ohne diese Zeile wuchs der Fall bei einem
       Imperium mit achtundvierzig Standorten um 1,9 Punkte je Woche und
       erreichte in einer ganzen Partie nie eine Anklage: das Spaetspiel
       hatte wieder keinen Gegner. */
    var macht = Math.pow(Math.max(0, d.netWorth) / 1000000, 0.7) * 0.42;
    if (macht > 0.15) zeilen.push({ label: 'Schiere Größe', v: macht,
      note: U.money(Math.round(d.netWorth)) + ' übersieht keine Sonderkommission' });

    /* Hitze ueber 35 ist der schnellste Weg in eine Anklage. */
    if (s.heat > 35) {
      var h = (s.heat - 35) * 0.055;
      zeilen.push({ label: 'Aufmerksamkeit der Polizei', v: h, note: 'Hitze bei ' + Math.round(s.heat) });
    }

    /* Schmutziges Geld, das nicht gewaschen wird, ist Beweismaterial. */
    if (d.launderLoss > 0) {
      var w = Math.min(3.2, d.launderLoss / 9000);
      zeilen.push({ label: 'Ungewaschenes Geld', v: w,
        note: U.money(Math.round(d.launderLoss)) + ' pro Woche laufen unerklärt durch' });
    }

    /* Gegenwirkung: Anwaelte, Rechtsbeistand, saubere Bilanz. */
    var anwalt = 0;
    for (i = 0; i < s.crew.length; i++) {
      if (s.crew[i].role === 'lawyer') anwalt += 0.85 * (0.6 + St.effectiveSkill(s.crew[i]) / 14);
    }
    anwalt += (s.org.retainer || 0) * 0.75;
    if (anwalt > 0) zeilen.push({ label: 'Rechtliche Verteidigung', v: -anwalt,
      note: 'Anwälte und Mandate bremsen sie aus' });

    /* Ein sauberer Anteil hilft sichtbar. */
    if (legal > dirty && legal > 0) {
      var sauber = Math.min(2.2, (legal - dirty) * 0.3);
      zeilen.push({ label: 'Seriöse Fassade', v: -sauber,
        note: 'ein überwiegend legaler Besitz ist schwer einzuordnen' });
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
    if (abhoer) zeilen.push({ label: 'Abhörwanzen', v: abhoer * 0.8,
      note: abhoer + ' deiner Standorte werden abgehört' });
    if (spitzel) zeilen.push({ label: 'Jemand redet', v: spitzel * 1.3,
      note: spitzel + (spitzel === 1 ? ' Informant' : ' Informanten') + ' in deiner Organisation' });
    if (zeugen) zeilen.push({ label: 'Kronzeugen', v: zeugen * 1.8,
      note: zeugen + (zeugen === 1 ? ' benannter Zeuge ist' : ' benannte Zeugen sind') + ' aussagebereit' });

    /* Ruf oeffnet Tueren, auch im Gericht. */
    if (s.rep >= 70) zeilen.push({ label: 'Ansehen in der Stadt', v: -0.5, note: 'Leute legen für dich ein gutes Wort ein' });
    if (d.boardCase) zeilen.push({ label: 'Aufsichtsratssitz', v: -d.boardCase,
      note: 'wer im Bauausschuss sitzt, ist kein naheliegender Angeklagter' });

    /* Wer klein und ruhig ist, verliert Aufmerksamkeit. */
    if (s.heat < 20 && dirty <= 2) zeilen.push({ label: 'Nichts Neues zu sehen', v: -1.4, note: 'ruhige Wochen' });

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
      report.push({ t: 'bad', banner: 'Sonderkommission des Bundes',
        ico: 'scales',
        text: 'Eine gemeinsame Sonderkommission hat eine Akte über deine Organisation angelegt. ' +
              'Ab jetzt ist alles, was du aufbaust, auch Beweismaterial.' });
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
        text: p.desc + ' Die Einnahmen liegen ' + U.pct(p.incomeCut) + ' niedriger, solange das anhält.' });
    } else if (c.phase < altePhase) {
      report.push({ t: 'good', banner: 'Fall geschwächt', ico: 'scales',
        text: 'Der Fall ist zurückgefallen auf: ' + PHASEN[c.phase].name + '. ' +
              'Wofür du auch bezahlt hast, es hat gewirkt.' });
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
        c.lastAction = 'hat ' + ziel.name + ' verwanzt';
        report.push({ t: 'warn', text: ziel.name + ': etwas stimmt nicht. Die Telefone knacken, ' +
          'und die Einnahmen sinken. Jemand hört mit.' });
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
        c.lastAction = 'hat jemanden in deiner Organisation umgedreht';
        report.push({ t: 'bad', banner: 'Jemand redet', ico: 'informant',
          text: 'Einzelheiten, die nur deine eigenen Leute kennen, sind bei der Kommission angekommen. ' +
                'Einer von ihnen kooperiert, und du weißt nicht, wer.' });
        break;
      }
      case 'freeze': {
        var betrag = Math.round(s.cash * rng.range(0.10, 0.20));
        if (betrag < 1000) return;
        s.cash -= betrag;
        c.budget += Math.round(betrag * 0.25);      /* sie finanzieren sich daraus */
        c.assets.push({ kind: 'freeze', amount: betrag, until: s.day + 28, since: s.day });
        c.lastAction = 'hat ' + U.money(betrag) + ' deiner Konten eingefroren';
        report.push({ t: 'bad', text: U.money(betrag) + ' wurden bis zu einer Anhörung eingefroren. ' +
          'In vier Wochen bekommst du sie zurück, falls dann noch etwas da ist.' });
        break;
      }
      case 'subpoena': {
        var b2 = s.businesses.length ? s.businesses[rng.int(0, s.businesses.length - 1)] : null;
        if (!b2) return;
        b2.damage = U.clamp((b2.damage || 0) + 0.3, 0, 0.8);
        c.strength = U.clamp(c.strength + 3, 0, 100);
        c.lastAction = 'hat die Bücher von ' + b2.name + ' beschlagnahmt';
        report.push({ t: 'warn', text: 'Die Ermittler haben vier Jahre Unterlagen in Kartons hinausgetragen - ' + b2.name +
          ' läuft eine Weile nicht richtig.' });
        break;
      }
      case 'witness': {
        var namen = ['ein früherer Buchhalter', 'jemand, der früher für dich gefahren ist',
                     'ein Lieferant, den du nicht mehr bezahlt hast', 'der Besitzer des Nachbarhauses'];
        var nm = namen[rng.int(0, namen.length - 1)];
        c.assets.push({ kind: 'witness', name: nm, since: s.day });
        c.lastAction = 'hat einen Kronzeugen gewonnen';
        report.push({ t: 'bad', banner: 'Ein Zeuge', ico: 'scales',
          text: nm.charAt(0).toUpperCase() + nm.slice(1) + ' hat zugesagt auszusagen. ' +
                'Jede Woche auf der Liste macht den Fall schwerer.' });
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
          report.push({ t: 'good', text: U.money(a.amount) + ' wurden freigegeben. Die Anhörung hat nichts ergeben.' });
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
      CE.economy.line(book, 'Beschlagnahme des Bundes', -frost,
        'Vermögen unter der Anklage eingefroren' + (verloren.length ? ', dazu ' + verloren.length + ' Standorte genommen' : ''), 'bad');
    }
    report.push({ t: 'bad', banner: 'Der Zugriff', ico: 'warn',
      text: 'Sie kamen im Morgengrauen. ' + (verloren.length ? verloren.length + ' Betriebe beschlagnahmt (' +
        U.money(wert) + '), ' : '') + U.money(frost) + ' eingefroren' +
        (verhaftet.length ? ', ' + verhaftet.join(' und ') + ' in Gewahrsam' : '') + '.' });
  }

  /* -------------------------------------------------- Gegenmassnahmen

     Alle kosten Geld, und zwar viel - das ist der Zweck. Jede hat einen
     anderen Nebenpreis, damit die Wahl eine ist.
  */
  function actions(s, d) {
    var basis = Math.max(30000, d.grossIncome * 1.1);
    var c = s.commission || fresh();
    return [
      { id: 'records', name: 'Die Akten verbrennen',
        cost: Math.round(basis * 0.6), strength: -9, heat: 3, rep: 0,
        desc: 'Bücher, Festplatten und ein sehr gründlicher Nachmittag. Kauft Zeit, mehr nicht.' },
      { id: 'witness', name: 'Einen Zeugen erreichen',
        cost: Math.round(basis * 1.4), strength: -19, heat: 2, rep: -4,
        desc: 'Jemand, der aussagen wollte, erinnert sich jetzt anders. Das fällt auf.' },
      { id: 'counsel', name: 'Eine Verteidigung aufbauen',
        cost: Math.round(basis * 2.2), strength: -28, heat: -4, rep: 2,
        desc: 'Die beste Kanzlei des Bundesstaates, auf Dauermandat, so lange es dauert.' },
      { id: 'divest', name: 'Das Schlimmste abstoßen',
        cost: 0, strength: -22, heat: -10, rep: 3, divest: true,
        desc: 'Verkaufe deine zwei auffälligsten Untergrundbetriebe mit Verlust. ' +
              'Nichts schwächt einen Fall so wie weniger, das man anklagen kann.' }
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
      out.push({ id: 'sweep', name: 'Nach Wanzen suchen', cost: Math.round(basis * 0.5 * wires),
        desc: 'Ein Techniker, ein Transporter und ein Nachmittag in jedem Hinterzimmer. ' +
              'Entfernt alle ' + wires + (wires === 1 ? ' Wanze' : ' Wanzen') + '.',
        badge: wires + (wires === 1 ? ' Wanze' : ' Wanzen') });
    }
    if (spitzel) {
      out.push({ id: 'leak', name: 'Das Leck finden', cost: Math.round(basis * 0.9),
        desc: 'Vier Leuten vier verschiedene Geschichten erzählen und sehen, welche zurückkommt. ' +
              'Gute Aussicht, den Informanten zu benennen. Danach bleibt er nicht.',
        badge: spitzel + (spitzel === 1 ? ' Informant' : ' Informanten') });
    }
    if (zeugen) {
      out.push({ id: 'silence', name: 'Einen Zeugen überzeugen', cost: Math.round(basis * 1.6),
        desc: 'Geld, eine Stelle für einen Verwandten oder ein Gespräch. Nimmt einen Zeugen ' +
              'von der Liste. Das kostet Ansehen, und es fällt auf.',
        badge: zeugen + (zeugen === 1 ? ' Zeuge' : ' Zeugen') });
    }
    if (frost) {
      out.push({ id: 'unfreeze', name: 'Gegen die Sperre klagen', cost: Math.round(basis * 0.7),
        desc: 'Ein Eilantrag. Gibt ' + U.money(frost) + ' jetzt frei statt in vier Wochen.',
        badge: U.money(frost) + ' eingefroren' });
    }
    return out;
  }

  function doTargeted(s, rng, id) {
    var c = s.commission;
    if (!c || !c.open) return { ok: false, why: 'Es gibt keinen Fall.' };
    var d = St.derive(s);
    var a = null, list = targeted(s, d);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) a = list[i];
    if (!a) return { ok: false, why: 'Dort gibt es nichts zu tun.' };
    if (s.cash < a.cost) return { ok: false, why: 'Benötigt ' + U.money(a.cost) + '.' };

    s.cash -= a.cost;
    s.stats.spent += a.cost;
    c.spent += a.cost;

    if (id === 'sweep') {
      var n = 0;
      for (i = c.assets.length - 1; i >= 0; i--) if (c.assets[i].kind === 'wiretap') { c.assets.splice(i, 1); n++; }
      c.strength = U.clamp(c.strength - n * 2, 0, 100);
      return { ok: true, text: n + (n === 1 ? ' Wanze wurde' : ' Wanzen wurden') + ' gefunden und zerstört. ' +
        'Deine Betriebe sind wieder still.' };
    }
    if (id === 'leak') {
      var idx = -1;
      for (i = 0; i < c.assets.length; i++) if (c.assets[i].kind === 'informant') { idx = i; break; }
      if (idx < 0) return { ok: false, why: 'Niemand redet.' };
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
          return { ok: true, text: 'Es war ' + wer.name + '. Die Person ist weg, und alle wissen warum.' };
        }
        return { ok: true, text: 'Das Leck ist geschlossen.' };
      }
      for (i = 0; i < s.crew.length; i++) if (!s.crew[i].player) {
        s.crew[i].loyalty = U.clamp(s.crew[i].loyalty - 8, 0, 100);
      }
      return { ok: true, text: 'Du hast vier Leute befragt und nichts erfahren. ' +
        'Alle vier werden sich daran erinnern.' };
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
            ' kooperiert nicht mehr. Niemand hat gefragt, wie das kam.' };
        }
      }
      return { ok: false, why: 'Es gibt keinen Zeugen zu erreichen.' };
    }
    if (id === 'unfreeze') {
      var summe = 0;
      for (i = c.assets.length - 1; i >= 0; i--) {
        if (c.assets[i].kind === 'freeze') { summe += c.assets[i].amount; c.assets.splice(i, 1); }
      }
      s.cash += summe;
      return { ok: true, text: U.money(summe) + ' per Gerichtsbeschluss freigegeben.' };
    }
    return { ok: false, why: 'Unbekannt.' };
  }

  function canDo(s, id) {
    var c = s.commission;
    if (!c || !c.open) return { ok: false, why: 'Es gibt keinen Fall zu bekämpfen.' };
    var d = St.derive(s);
    var a = null, list = actions(s, d);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) a = list[i];
    if (!a) return { ok: false, why: 'Unbekannt.' };
    if (a.divest) {
      var dreck = s.businesses.filter(function (b) { return !D.byId(D.BUSINESSES, b.type).legal; });
      if (dreck.length < 2) return { ok: false, why: 'Du brauchst mindestens zwei Untergrundbetriebe, die du aufgeben kannst.' };
    } else if (s.cash < a.cost) {
      return { ok: false, why: 'Benötigt ' + U.money(a.cost) + '.' };
    }
    if (c.strength <= 0) return { ok: false, why: 'Der Fall liegt bereits bei null.' };
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
      text = namen.join(' und ') + ' sind weg, für die Hälfte ihres Werts.';
    } else {
      s.cash -= a.cost;
      s.stats.spent += a.cost;
      c.spent += a.cost;
      text = U.money(a.cost) + ' ausgegeben.';
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

    return { ok: true, text: a.name + ': ' + text + ' Stärke des Falls jetzt ' + Math.round(c.strength) + '.',
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
