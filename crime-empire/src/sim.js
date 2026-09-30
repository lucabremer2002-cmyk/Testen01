/* ---------------------------------------------------------------------
   Der Taktgeber.

   advanceDay() ist die einzige Stelle, an der Zeit vergeht. Alles, was
   zeitabhaengig ist, haengt hier dran - Auftraege, Nachwirkungen,
   Wochenabrechnung, Rivalen, Ereignisse.

   Bewusst frei von DOM: tools/simulation.js spielt damit ganze Partien
   ohne Browser durch, und der Selbsttest vergleicht Bargeld gegen die
   Summe der Buchungszeilen.

   Ereignisse halten die Zeit an. Solange s.event gesetzt ist, geht kein
   Tag weiter - der Spieler soll nicht unter Zeitdruck entscheiden.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var U = CE.util, St = CE.state, D = CE.data;

  function rngOf(s) {
    var r = new U.Rng(s.rngState);
    return r;
  }
  function keepRng(s, r) { s.rngState = r.s >>> 0; }

  /* Ein Tag. Gibt einen Bericht zurueck: alles, was passiert ist. */
  function advanceDay(s) {
    if (s.event) return { blocked: true, report: [] };
    var rng = rngOf(s);
    var report = [];

    s.day++;

    /* 1. Auftraege, die heute enden. */
    CE.ops.resolveDue(s, rng, report);

    /* 2. Nachwirkungen frueherer Entscheidungen. */
    CE.events.resolvePending(s, rng, report);

    /* 3. Genesung. */
    for (var i = 0; i < s.crew.length; i++) {
      var c = s.crew[i];
      if (c.hurt && c.hurt <= s.day) { c.hurt = 0; report.push({ t: 'good', text: c.name + ' is back on their feet.' }); }
    }

    /* 4. Wochenwechsel. */
    var weekly = null;
    if (s.day % 7 === 0) weekly = endOfWeek(s, rng, report);

    /* 5. Angebote, die auslaufen. */
    CE.ops.expire(s);

    /* 6. Ereignis ziehen. Nie am selben Tag wie die Wochenabrechnung -
          zwei Fenster hintereinander sind eins zu viel. */
    if (!weekly && !s.event && s.day > 2) {
      var p = 0.16 + Math.min(0.14, s.businesses.length * 0.015);
      if (rng.chance(p)) {
        var ev = CE.events.draw(s, rng);
        if (ev) { s.event = ev; CE.events.markSeen(s, ev.id); }
      }
    }

    /* 7. Fortschritt. */
    var prog = CE.progress.check(s);
    for (i = 0; i < prog.achievements.length; i++) {
      report.push({ t: 'good', ach: true, text: 'Achievement unlocked: ' + prog.achievements[i].name });
    }
    if (prog.rank) report.push({ t: 'rank', text: 'You are now ' + prog.rank.name + '. ' + prog.rank.blurb });

    keepRng(s, rng);
    logReport(s, report);
    return { report: report, weekly: weekly, progress: prog };
  }

  function endOfWeek(s, rng, report) {
    /* Reihenfolge ist wichtig: erst abrechnen (auf dem Stand der Woche),
       dann die Rivalen ziehen lassen, dann neue Angebote. Andersherum
       wuerde der Spieler fuer Zuege bezahlen, die er nie gesehen hat. */
    var res = CE.economy.settle(s, rng);
    for (var i = 0; i < res.report.length; i++) report.push(res.report[i]);

    CE.crew.weekly(s, rng, res.derived, report);
    CE.rivals.weekly(s, rng, res.derived, report);
    CE.commission.weekly(s, rng, res.derived, report, res.entry.book);
    CE.city.weekly(s, rng, res.derived, report);
    CE.fear.weekly(s, rng, res.derived, report);

    for (var k in s.districts) if (s.districts[k].open) CE.ops.refreshOffers(s, rng, k);
    CE.crew.refreshRecruits(s, rng);

    return res.entry;
  }

  /* Protokoll: neueste Meldung oben, auf 200 begrenzt. */
  function logReport(s, report) {
    for (var i = 0; i < report.length; i++) {
      var r = report[i];
      s.log.unshift({ day: s.day, t: r.t || 'neutral', text: r.text, ach: !!r.ach });
    }
    while (s.log.length > 200) s.log.pop();
  }

  /* Eine Entscheidung treffen. Gibt den Ergebnistext zurueck. */
  function choose(s, index) {
    if (!s.event) return null;
    var ev = s.event;
    var opt = ev.options[index];
    if (!opt || opt.disabled) return null;
    var text;
    try { text = opt.go(); }
    catch (e) { text = 'Nothing came of it.'; }
    s.event = null;
    s.log.unshift({ day: s.day, t: 'choice', text: ev.title + ': ' + text, choice: opt.label });
    while (s.log.length > 200) s.log.pop();
    var prog = CE.progress.check(s);
    for (var i = 0; i < prog.achievements.length; i++) {
      s.log.unshift({ day: s.day, t: 'good', ach: true, text: 'Achievement unlocked: ' + prog.achievements[i].name });
    }
    return { text: text, title: ev.title, progress: prog };
  }

  /* Erster Tag: Angebote und Bewerber muessen da sein, bevor der Spieler
     zum ersten Mal hinsieht. */
  function bootstrap(s) {
    var rng = rngOf(s);
    for (var k in s.districts) if (s.districts[k].open) CE.ops.refreshOffers(s, rng, k);
    CE.crew.refreshRecruits(s, rng);
    keepRng(s, rng);
    s.log.unshift({
      day: 0, t: 'rank',
      text: 'Blackhaven, ' + U.dateLabel(0) + '. One room above a laundromat, ' +
            U.money(s.cash) + ' and nobody who owes you anything. Start in Old Town.'
    });
    return s;
  }

  CE.sim = { advanceDay: advanceDay, choose: choose, bootstrap: bootstrap, rngOf: rngOf, keepRng: keepRng };
})(typeof window !== 'undefined' ? window : globalThis);
