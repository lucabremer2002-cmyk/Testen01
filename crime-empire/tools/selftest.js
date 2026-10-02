/* ---------------------------------------------------------------------
   Selbsttest im echten Browser.

     node tools/selftest.js [url]

   Vorher einen Server starten:  python3 -m http.server 8231

   Geprueft wird, was sich pruefen laesst, nicht was sich gut anfuehlt:

     1. Die Seite laedt ohne Fehler in der Konsole.
     2. Ein neues Spiel startet und laeuft 60 Tage durch.
     3. Jede Buchung stimmt: Bargeld vorher + Summe der Zeilen = nachher.
        Das ist die wichtigste Zusicherung des Spiels - der Spieler soll
        nie Geld verlieren, ohne dass eine Zeile sagt, warum.
     4. Keine Zahl wird NaN oder unendlich.
     5. Speichern und Laden ergibt denselben Zustand.
     6. Jeder Bildschirm baut sich auf und enthaelt keinen toten Knopf.
     7. Jeder data-act-Knopf hat eine Behandlung.

   Jeder Fehlschlag beendet den Lauf mit Code 1.
   --------------------------------------------------------------------- */
'use strict';
const URL = process.argv[2] || 'http://127.0.0.1:8231/index.html';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

/* Erste nicht gesperrte Option - Option 0 kann gesperrt sein, und dann
   bliebe das Ereignis offen und die Zeit stuende still. */
function firstOpenIdx(ev) {
  for (var i = 0; i < ev.options.length; i++) if (!ev.options[i].disabled) return i;
  return 0;
}
/* ---------------------------------------------------- Tote Belohnungen

   Eine Flagge, die ein Ereignis setzt und die nie jemand liest, ist eine
   Belohnung, die es nicht gibt. Der Text verspricht "a permanent edge",
   der Spieler zahlt, und es passiert nichts. Fuenf davon lagen im Code.
   Diese Pruefung liest den Quelltext und verlangt fuer jede gesetzte
   Flagge mindestens eine Stelle, die sie auch auswertet.
   -------------------------------------------------------------------- */
function toteFlaggen() {
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'src');
  const quellen = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
  const alles = quellen.map(q => q.text).join('\n');

  const gesetzt = new Set();
  const re = /(?:s|state|probe)\.flags\.([A-Za-z_][\w]*)\s*=/g;
  let m;
  while ((m = re.exec(alles))) gesetzt.add(m[1]);

  const tot = [];
  for (const flagge of gesetzt) {
    /* Jede Nennung zaehlen, die keine Zuweisung ist. */
    const nennungen = alles.match(new RegExp('flags\\.' + flagge + '\\b', 'g')) || [];
    const zuweisungen = alles.match(new RegExp('flags\\.' + flagge + '\\s*=', 'g')) || [];
    if (nennungen.length <= zuweisungen.length) tot.push(flagge);
  }
  return tot;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CRIME, null, { timeout: 20000 });

  const R = await page.evaluate(() => {
    const firstOpen = (ev) => { for (let i = 0; i < ev.options.length; i++) if (!ev.options[i].disabled) return i; return 0; };
    const out = { fails: [], notes: {} };
    const fail = (t) => out.fails.push(t);
    const CE = window.CE, U = CE.util, St = CE.state;

    /* --- 2. Neues Spiel --------------------------------------------- */
    const s = window.CRIME.newGame({ seed: 777, name: 'Tester', difficulty: 'normal' });
    if (!s || s.day !== 0) fail('new game did not start at day 0');
    if (s.crew.length !== 1 || !s.crew[0].player) fail('player is not in the crew');
    if (!s.districts.oldtown.open) fail('Old Town is not open at the start');
    if (!(s.offers.oldtown || []).length) fail('no operations offered on day 0');
    if (!s.recruits.length) fail('no recruits available on day 0');

    /* --- 3./4. 60 Tage, jede Woche nachrechnen ---------------------- */
    let weeks = 0, worstDrift = 0;
    for (let i = 0; i < 60; i++) {
      const before = s.cash;
      const ledgerLen = s.ledger.length;
      window.CRIME.tickDay();
      if (s.event) CE.sim.choose(s, firstOpen(s.event));          /* immer die erste Option */

      if (s.ledger.length > ledgerLen) {
        weeks++;
        const L = s.ledger[0];
        const sum = L.book.reduce((a, b) => a + b.amount, 0);
        /* Die Buchung deckt nur den Wochenabschluss ab; Auftraege und
           Nachwirkungen desselben Tages laufen daneben. Deshalb wird
           gegen die im Eintrag festgehaltenen Werte geprueft. */
        const drift = Math.abs((L.cashBefore + sum) - L.cashAfter);
        /* Jede Zeile wird einzeln gerundet, deshalb darf die Summe um
           wenige Dollar abweichen - nicht um mehr. */
        if (drift > 3) {
          fail('week ' + L.week + ': ledger does not balance (drift ' + drift.toFixed(2) + ')');
        }
        worstDrift = Math.max(worstDrift, drift);
        if (Math.abs(L.net - (L.income - L.expense)) > 1.5) fail('week ' + L.week + ': net != income - expense');
      }

      const nums = [s.cash, s.rep, s.heat];
      for (const k in s.districts) nums.push(s.districts[k].mine);
      for (const n of nums) if (!isFinite(n)) fail('day ' + s.day + ': a value became ' + n);
      if (s.rep < 0 || s.rep > 100) fail('reputation out of range: ' + s.rep);
      if (s.heat < 0 || s.heat > 100) fail('heat out of range: ' + s.heat);
    }
    /* --- 3b. Eine gespielte Partie: kaufen, einstellen, Auftraege ---
       Ohne Handlungen prueft der Lauf oben nur den Leerlauf. */
    s.cash += 120000;
    const bought = CE.empire.buy(s, 'oldtown', 'diner');
    if (!bought.ok) fail('could not buy the starter business: ' + bought.why);
    const bought2 = CE.empire.buy(s, 'oldtown', 'market');
    if (!bought2.ok) fail('could not buy an underground business: ' + bought2.why);
    if (s.recruits.length) {
      const hired = CE.crew.hire(s, s.recruits[0].id);
      if (!hired.ok) fail('could not hire anyone: ' + hired.why);
    }
    const offers = CE.ops.allOffers(s);
    if (offers.length) {
      const free = CE.ops.available(s);
      const started = CE.ops.start(s, offers[0].id, free.slice(0, offers[0].crewNeed).map(c => c.id));
      if (!started.ok) fail('could not start an operation: ' + started.why);
    }
    for (let i = 0; i < 90; i++) {
      window.CRIME.tickDay();
      if (s.event) CE.sim.choose(s, firstOpen(s.event));
      if (!isFinite(s.cash)) { fail('cash became ' + s.cash + ' on day ' + s.day); break; }
      if (s.ledger.length) {
        const L = s.ledger[0];
        const sum = L.book.reduce((a, b) => a + b.amount, 0);
        if (Math.abs((L.cashBefore + sum) - L.cashAfter) > 3) {
          fail('week ' + L.week + ' (active play): ledger does not balance');
          break;
        }
      }
    }
    out.notes.weeksTotal = s.ledger.length;
    out.notes.cashAfterPlay = Math.round(s.cash);
    out.notes.businesses = s.businesses.length;
    out.notes.opsRun = s.stats.opsRun;
    out.notes.logAfterPlay = s.log.length;
    if (s.log.length < 6) fail('the event log barely filled during active play (' + s.log.length + ' lines)');
    if (s.stats.opsRun < 1) fail('no operation ever ran');

    out.notes.weeksSettled = weeks;
    out.notes.worstLedgerDrift = worstDrift;
    out.notes.cashAfter60 = Math.round(s.cash);
    out.notes.logLines = s.log.length;

    const d = St.derive(s);
    for (const k of ['net', 'grossIncome', 'expenses', 'strength', 'notoriety', 'netWorth']) {
      if (!isFinite(d[k])) fail('derive().' + k + ' is ' + d[k]);
    }

    /* --- 5. Speichern und Laden ------------------------------------- */
    CE.save.save(s, '3', 'selftest');
    const back = CE.save.load('3');
    if (!back.ok) fail('save/load failed: ' + back.why);
    else {
      const a = St.derive(s), b = St.derive(back.state);
      if (Math.round(a.net) !== Math.round(b.net)) fail('net differs after reload: ' + a.net + ' vs ' + b.net);
      if (s.cash !== back.state.cash) fail('cash differs after reload');
      if (s.businesses.length !== back.state.businesses.length) fail('businesses lost on reload');
      if (s.rngState !== back.state.rngState) fail('random state lost on reload - the future would differ');
    }

    /* --- 5b. Speichern waehrend einer offenen Entscheidung ----------
       Die Optionen eines Ereignisses sind Funktionen. Landet das
       Ereignis im Spielstand, hat es nach dem Laden Knoepfe ohne
       Wirkung - und weil ein Ereignis die Zeit anhaelt, waere die
       Partie unspielbar. Der Stand muss ohne Ereignis zurueckkommen. */
    {
      const rng = CE.sim.rngOf(s);
      for (let i = 0; i < 60 && !s.event; i++) {
        const ev = CE.events.draw(s, rng);
        if (ev) s.event = ev;
        else s.day++;
      }
      if (!s.event) fail('could not produce an event to test saving during one');
      else {
        CE.save.save(s, '3', 'event-test');
        const re = CE.save.load('3');
        if (!re.ok) fail('save during an event failed');
        else if (re.state.event) fail('a pending decision survived the save - its buttons would be dead');
        const res = CE.sim.advanceDay(re.state);
        if (res.blocked) fail('time is still frozen after loading a save made during a decision');
        /* Jedes Ereignis braucht mindestens eine Antwort, die immer geht,
           sonst kann sich der Spieler festfahren. */
        const stuck = CE.events.EVENTS.length;
        s.event = null;
      }
    }

    /* --- 5c. Kein Ereignis darf alle Optionen sperren --------------

       Ein Ereignis, dessen Antworten alle gesperrt sind, haelt die Zeit
       fuer immer an. Deshalb wird der Katalog unter Bedingungen
       durchgespielt, unter denen die Ereignisse ueberhaupt greifen -
       ein frisches Spiel ohne Betriebe und ohne Ansehen erzeugt fast
       keine, und der Test liefe leer, ohne etwas zu pruefen. */
    {
      const probe = St.newGame({ seed: 31337 });
      CE.sim.bootstrap(probe);
      probe.rep = 50; probe.heat = 50; probe.cash = 90000;
      CE.empire.openDistrict(probe, 'industrial');
      ['diner', 'market', 'garage'].forEach(b => CE.empire.buy(probe, 'oldtown', b));
      CE.empire.buy(probe, 'industrial', 'logistics');
      const rngP = CE.sim.rngOf(probe);
      CE.crew.refreshRecruits(probe, rngP, 8);
      for (let i = 0; i < 4 && probe.recruits.length; i++) CE.crew.hire(probe, probe.recruits[0].id);
      probe.rivals.forEach((r, i) => { r.relation = i % 2 ? 30 : -35; r.infl.oldtown = 20; });
      /* Die Bundesermittlung gehoert zum Spaetspiel und ist Bedingung
         fuer einen Teil der Geschichten. Ohne sie blieb die halbe
         Kessler-Reihe ungeprueft. */
      probe.commission = CE.commission.fresh();
      probe.commission.open = true;
      probe.commission.strength = 45;

      const seen = new Set(), noWayOut = new Set();
      let checked = 0;
      for (let i = 0; i < 3000; i++) {
        probe.day++;
        probe.cash = 200000;                   /* Geldmangel soll nicht alles sperren */
        probe.heat = 20 + (i % 70);
        probe.rep = 20 + (i % 75);
        /* Die Geschichten der wiederkehrenden Figuren haengen an
           Vertrauen. Ohne Schwankung bleiben die spaeten Abschnitte
           ungeprueft - und genau dort stecken die Verzweigungen. */
        if (CE.people) {
          for (const cast of CE.people.CAST) {
            const pp = CE.people.get(probe, cast.id);
            if (i % 130 === 0) { pp.stage = 0; pp.trust = 0; pp.done = false; pp.flags = {}; }
            else if (i % 65 === 0) pp.trust = ((i / 65) % 2) ? 45 : -45;
          }
        }
        /* Die Mannschaft muss beide Zustaende durchlaufen: leer, damit
           die Ereignisse mit Platzbedarf greifen, und voll, damit die
           Ereignisse mit Mannschaftsbedarf greifen. Wurde sie nur
           geleert, blieb "union" (braucht vier Leute) ungeprueft. */
        if (i % 80 === 0) probe.crew = probe.crew.filter(c => c.player);
        if (i % 80 === 40) {
          CE.crew.refreshRecruits(probe, rngP, 8);
          while (probe.crew.filter(c => !c.player).length < 5 && probe.recruits.length) {
            const before = probe.crew.length;
            CE.crew.hire(probe, probe.recruits[0].id);
            if (probe.crew.length === before) break;
          }
        }
        const ev = CE.events.draw(probe, rngP);
        if (!ev) continue;
        checked++;
        seen.add(ev.id);
        if (!ev.options.some(o => !o.disabled)) noWayOut.add(ev.id);
        CE.events.markSeen(probe, ev.id);
        probe.event = ev;
        CE.sim.choose(probe, ev.options.findIndex(o => !o.disabled));
        probe.event = null;
      }
      out.notes.eventsProbed = checked;
      out.notes.eventKindsSeen = seen.size + '/' + CE.events.alle().length;
      if (checked < 40) fail('the event probe barely fired (' + checked + ') - it is not testing anything');
      /* Jedes Ereignis im Katalog muss unter irgendwelchen Bedingungen
         erreichbar sein - was nie kommt, ist toter Inhalt. */
      if (seen.size < CE.events.alle().length) {
        const missed = CE.events.alle().map(e => e.id).filter(id => !seen.has(id));
        fail('events that never fired in 3000 days: ' + missed.join(', '));
      }
      if (noWayOut.size) fail('events with every option locked (soft-lock): ' + [...noWayOut].join(', '));
    }

    /* --- 5d. Jemand verlaesst die Organisation waehrend eines Auftrags

       Leute kuendigen, werden abgeworben, rausgeworfen oder verschwinden
       nach einer Entscheidung - und das alles kann passieren, waehrend
       sie unterwegs sind. Blieb ihre Kennung im laufenden Auftrag
       stehen, stuerzte die Abrechnung ab ("Cannot set properties of
       null") und die Partie war zu Ende. */
    {
      const probe = St.newGame({ seed: 8181 });
      CE.sim.bootstrap(probe);
      probe.cash = 300000;
      const rngX = CE.sim.rngOf(probe);
      CE.crew.refreshRecruits(probe, rngX, 8);
      for (let i = 0; i < 4 && probe.recruits.length; i++) CE.crew.hire(probe, probe.recruits[0].id);

      const angebote = CE.ops.allOffers(probe);
      const mann = probe.crew.filter(c => !c.player);
      let gestartet = 0;
      for (const o of angebote) {
        const frei = CE.ops.available(probe).filter(c => !c.player && !c.post);
        if (frei.length < o.crewNeed) continue;
        if (CE.ops.start(probe, o.id, frei.slice(0, o.crewNeed).map(c => c.id)).ok) gestartet++;
      }
      if (!gestartet) fail('could not start an operation for the crew-removal test');

      /* Jeden Weg durchspielen, auf dem jemand verschwindet. */
      const wege = [];
      const aufOp = probe.ops.flatMap(r => r.crew).filter(id => id !== 'you');
      if (aufOp.length) { CE.crew.remove(probe, aufOp[0]); wege.push('remove'); }
      const nochDa = probe.ops.flatMap(r => r.crew).filter(id => id !== 'you');
      if (nochDa.length) { CE.crew.fire(probe, nochDa[0]); wege.push('fire'); }

      /* Kein laufender Auftrag darf auf jemanden zeigen, den es nicht gibt. */
      for (const run of probe.ops) {
        for (const id of run.crew) {
          if (!U.byId(probe.crew, id)) fail('a running operation still points at a departed crew member');
        }
        if (!run.crew.length) fail('an operation is running with nobody on it');
      }

      /* Und die Abrechnung muss durchlaufen, nicht stuerzen. */
      probe.day += 14;
      try {
        CE.ops.resolveDue(probe, rngX, []);
      } catch (e) {
        fail('settling an operation after someone left threw: ' + e.message);
      }
      out.notes.crewRemovalPaths = wege.join('+') || 'none';
    }

    /* --- 6./7. Alle Bildschirme und alle Knoepfe -------------------- */
    const screens = CE.ui.SCREENS.map(x => x.id);
    const seenActs = new Set();
    for (const id of screens) {
      window.CRIME.go(id);
      window.CRIME.paint();
      const view = document.getElementById('view');
      if (!view.innerHTML || view.innerHTML.length < 120) fail('screen "' + id + '" rendered almost nothing');
      view.querySelectorAll('[data-act]').forEach(n => seenActs.add(n.getAttribute('data-act')));
      if (view.querySelector('.undefined, [data-act=""]')) fail('screen "' + id + '" has a broken control');
      if (/undefined|NaN|\[object Object\]/.test(view.textContent)) {
        const m = view.textContent.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,40}/);
        fail('screen "' + id + '" shows "' + (m ? m[0].trim() : '?') + '"');
      }
    }
    document.querySelectorAll('.navbtn[data-act]').forEach(n => seenActs.add(n.getAttribute('data-act')));

    /* --- 6b. Sichtbarkeit der grossen Bausteine ---------------------
       Eine Funktion, die ein Panel baut, aber nirgends aufgerufen wird,
       faellt in keinem Test auf: kein Fehler, nur ein unsichtbares
       Feature. Genau das war mit dem Figuren-Panel passiert. Deshalb
       wird jetzt geprueft, dass die Bausteine im fertigen Bildschirm
       wirklich auftauchen. */
    {
      const probe2 = St.newGame({ seed: 5150 });
      CE.sim.bootstrap(probe2);
      probe2.cash = 2000000; probe2.rep = 80;
      CE.empire.openDistrict(probe2, 'industrial');
      ['diner', 'market', 'club'].forEach(b => CE.empire.buy(probe2, 'oldtown', b));
      CE.people.bump(probe2, 'kessler', 30, 2);
      probe2.commission.open = true;
      probe2.commission.strength = 55;
      probe2.districts.oldtown.state = 'booming';

      const sichtbar = (schirm, muster, was) => {
        const html = CE.ui.render(schirm, probe2, St.derive(probe2));
        if (!muster.test(html)) fail('"' + was + '" does not appear on the ' + schirm + ' screen');
      };
      sichtbar('rivals', /Kessler/, 'recurring characters');
      sichtbar('rivals', /Aktuelles Ziel/, 'rival goals');
      sichtbar('org', /Stärke des Falls/, 'the federal case');
      sichtbar('org', /Die Akten verbrennen/, 'case counterplay');
      probe2.commission.assets = [
        { kind: 'wiretap', ref: probe2.businesses[0].id, name: probe2.businesses[0].name, since: 1 },
        { kind: 'informant', ref: 'x', name: 'Geheim', since: 1, known: false }
      ];
      sichtbar('org', /Was sie haben/, 'what the commission owns');
      sichtbar('org', /Nach Wanzen suchen/, 'targeted counterplay');
      const orgHtml = CE.ui.render('org', probe2, St.derive(probe2));
      if (/Geheim/.test(orgHtml)) fail('the informant is named in the interface - finding them should be an action');
      sichtbar('city', /Boomend|Stabil/i, 'district states');
      /* Der Einmarsch erscheint nur bei einem Bezirk, den man noch nicht
         hat - also muss die Tafel auch auf einen solchen zeigen. */
      CE.ui.sel.district = 'harbor';
      sichtbar('city', /Mit Gewalt hinein/, 'the aggressive route into a district');
      CE.ui.sel.district = 'oldtown';
      sichtbar('overview', /Furcht/, 'the fear track');
      sichtbar('overview', /Stellung/, 'the legitimacy track');
      /* Furcht muss die aggressiven Knoepfe oeffnen - und ohne sie
         muessen sie erklaert statt versteckt sein. */
      probe2.fear = 70;
      const rivHoch = CE.ui.render('rivals', probe2, St.derive(probe2));
      if (!/Schutzgeld fordern/.test(rivHoch)) fail('at 70 fear the protection demand does not appear');
      if (!/Betrieb nehmen/.test(rivHoch)) fail('at 70 fear the seizure option does not appear');
      probe2.fear = 0;
      const rivNull = CE.ui.render('rivals', probe2, St.derive(probe2));
      if (/Schutzgeld fordern/.test(rivNull)) fail('the protection demand shows at zero fear');
      /* Und die beiden Bedeutungen von "Tribut" duerfen nicht kollidieren. */
      if (/Tribute &middot;/.test(rivNull) && /Paying you protection/.test(rivNull)) {
        fail('the diplomatic gift and extorted protection are both labelled tribute');
      }
      sichtbar('overview', /Bundesverfahren/i, 'the case on the overview');
    }

    const missing = [...seenActs].filter(a => typeof window.CRIME.actions[a] !== 'function');
    if (missing.length) fail('dead buttons, no handler for: ' + missing.join(', '));
    out.notes.actionsSeen = seenActs.size;
    out.notes.screens = screens.length;

    return out;
  });

  /* --- 1. Fehler in der Konsole ------------------------------------- */
  const fails = R.fails.slice();
  const tot = toteFlaggen();
  if (tot.length) fails.push('rewards that are set but never read (dead promises): ' + tot.join(', '));
  if (errors.length) fails.push('page errors: ' + errors.slice(0, 4).join(' | '));

  /* --- Klicktest: jeden Knopf jedes Bildschirms wirklich anklicken --- */
  const clickFails = await clickEverything(page);
  fails.push(...clickFails);

  console.log('CRIME EMPIRE - Selbsttest\n');
  for (const k in R.notes) console.log('  ' + k.padEnd(20) + R.notes[k]);
  console.log('');
  if (fails.length) {
    console.log('FEHLGESCHLAGEN:');
    fails.forEach(f => console.log('  - ' + f));
    await browser.close();
    process.exit(1);
  }
  console.log('Alles gruen.');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

/* Klickt jeden sichtbaren, nicht gesperrten Knopf an und prueft, dass
   danach kein Fehler in der Konsole steht und die Seite noch lebt. */
async function clickEverything(page) {
  const fails = [];
  const live = [];
  page.on('pageerror', e => live.push(e.message));

  const screens = await page.evaluate(() => window.CE.ui.SCREENS.map(x => x.id));
  for (const id of screens) {
    await page.evaluate(s => { window.CRIME.go(s); window.CRIME.paint(); }, id);
    const n = await page.evaluate(() =>
      document.querySelectorAll('#view [data-act]:not([disabled])').length);
    for (let i = 0; i < Math.min(n, 14); i++) {
      const ok = await page.evaluate((idx) => {
        const list = document.querySelectorAll('#view [data-act]:not([disabled])');
        const el = list[idx];
        if (!el) return true;
        /* dispatchEvent statt click(): SVG-Elemente (die Bezirke auf der
           Karte) haben keine click()-Methode, ein echter Mausklick
           erreicht sie trotzdem. */
        try {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        } catch (e) { return 'click threw: ' + e.message; }
        return true;
      }, i);
      if (ok !== true) fails.push('screen ' + id + ': ' + ok);
      /* Fenster wieder schliessen, damit der naechste Klick durchkommt. */
      await page.evaluate(() => {
        document.getElementById('modal').hidden = true;
        document.getElementById('report').hidden = true;
      });
      await page.evaluate(s => { window.CRIME.go(s); window.CRIME.paint(); }, id);
    }
  }
  if (live.length) fails.push('errors while clicking: ' + live.slice(0, 3).join(' | '));
  return fails;
}
