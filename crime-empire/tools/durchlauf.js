/* ---------------------------------------------------------------------
   Echter Durchlauf mit der Maus.

     node tools/durchlauf.js [url]

   Kein Aufruf interner Funktionen: es wird geklickt, was ein Mensch
   klicken wuerde. Neues Spiel anlegen, spielen, speichern, neu laden,
   fortsetzen - und pruefen, dass der Stand wirklich wieder da ist.

   Laeuft auch gegen eine file://-Adresse, denn genau so soll das Spiel
   startbar sein.
   --------------------------------------------------------------------- */
'use strict';
const URL = process.argv[2] || 'http://127.0.0.1:8231/index.html';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const fails = [];
  const step = (ok, what) => { if (!ok) fails.push(what); return ok; };

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CRIME, null, { timeout: 20000 });

  /* --- Hauptmenue --------------------------------------------------- */
  step(await page.isVisible('.title__main'), 'the title is not visible');
  step(await page.isHidden('#game'), 'the game shell is showing behind the menu');
  step(await page.isHidden('#modal'), 'a dialog is open on the menu');

  /* --- Neues Spiel anlegen ------------------------------------------ */
  await page.click('[data-menu="new"]');
  await page.waitForSelector('#modal:not([hidden])', { timeout: 5000 });
  await page.fill('#ngName', 'Testerin');
  await page.click('#ngDiff [data-diff="normal"]');
  await page.click('[data-act="__startNew"]');
  await page.waitForSelector('#game:not([hidden])', { timeout: 5000 });
  step(await page.isHidden('#menu'), 'the menu did not close');

  let s = await page.evaluate(() => {
    const st = window.CRIME.state();
    return { name: st.name, day: st.day, cash: st.cash, offers: window.CE.ops.allOffers(st).length };
  });
  step(s.name === 'Testerin', 'the name was not taken over (got "' + s.name + '")');
  step(s.day === 0, 'a new game does not start on day 0');
  step(s.offers > 0, 'no operations on the first day');

  /* --- Einen Auftrag von Hand starten ------------------------------- */
  await page.click('[data-act="go"][data-screen="city"]');
  await page.waitForTimeout(250);
  /* Einen Auftrag waehlen, der mit der vorhandenen Mannschaft ueberhaupt
     zu schaffen ist - am ersten Tag ist das nur der Spieler selbst, und
     ein Auftrag fuer zwei Leute bliebe zu Recht gesperrt. */
  const opId = await page.evaluate(() => {
    const st = window.CRIME.state();
    const frei = window.CE.ops.available(st).length;
    const o = window.CE.ops.allOffers(st).find(x => x.crewNeed <= frei);
    return o ? o.id : null;
  });
  step(!!opId, 'no operation on day 0 can be staffed by the crew you start with');
  const hasPick = await page.evaluate((id) => {
    const p = document.querySelector('#view .pick[data-op="' + id + '"]:not([disabled])');
    if (!p) return false;
    p.click();
    return true;
  }, opId);
  step(hasPick, 'no crew could be selected for that operation');
  await page.waitForTimeout(300);
  const picked = await page.evaluate((id) => {
    const send = document.querySelector('#view [data-act="startOp"][data-op="' + id + '"]:not([disabled])');
    if (!send) return 'the send button stayed disabled after picking somebody';
    send.click();
    return null;
  }, opId);
  step(picked === null, picked || '');
  await page.waitForTimeout(250);
  step(await page.evaluate(() => window.CRIME.state().ops.length > 0),
    'the operation did not start');

  /* --- Zeit laufen lassen ------------------------------------------- */
  await page.click('.sbtn[data-speed="3"]');
  await page.waitForTimeout(3200);
  const after = await page.evaluate(() => {
    const st = window.CRIME.state();
    /* Ein Ereignis haelt die Zeit an - das ist gewollt, also beantworten. */
    if (st.event) {
      const i = st.event.options.findIndex(o => !o.disabled);
      window.CRIME.actions.choose({ i: String(i < 0 ? 0 : i) });
    }
    return { day: st.day, speed: st.speed };
  });
  step(after.day > 0, 'time did not advance while playing (day ' + after.day + ')');

  /* Pausieren und offene Fenster schliessen - so macht es ein Mensch
     auch, bevor er ins Menue geht. */
  await page.click('.sbtn[data-speed="0"]');
  await page.waitForTimeout(150);
  await closeOverlays(page);

  /* --- Speichern in Platz 2 ----------------------------------------- */
  await page.click('[data-act="saveDialog"]');
  await page.waitForSelector('#modal:not([hidden])');
  await page.click('[data-act="saveTo"][data-slot="2"]');
  await page.waitForTimeout(220);
  const saved = await page.evaluate(() => {
    const r = window.CE.save.load('2');
    return r.ok ? { day: r.state.day, cash: r.state.cash, name: r.state.name, event: !!r.state.event } : null;
  });
  step(!!saved, 'saving to slot 2 produced nothing');
  step(saved && !saved.event, 'a pending decision was written into the save');

  /* --- Seite neu laden, fortsetzen ---------------------------------- */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CRIME);
  step(await page.isVisible('#menu'), 'the menu did not come back after a reload');
  const contEnabled = await page.evaluate(() => !document.querySelector('[data-menu="continue"]').disabled);
  step(contEnabled, 'Continue is disabled although a save exists');

  await page.click('[data-menu="continue"]');
  await page.waitForSelector('#game:not([hidden])', { timeout: 5000 });
  const back = await page.evaluate(() => {
    const st = window.CRIME.state();
    return { day: st.day, cash: st.cash, name: st.name };
  });
  step(back.name === 'Testerin', 'the wrong game was continued');
  step(Math.abs(back.day - (saved ? saved.day : -1)) <= 1,
    'continuing landed on day ' + back.day + ', the save said ' + (saved && saved.day));

  await page.click('.sbtn[data-speed="0"]');
  await closeOverlays(page);

  /* --- Jeden Bildschirm anklicken ----------------------------------- */
  for (const id of ['overview', 'city', 'business', 'crew', 'org', 'rivals', 'finance', 'log', 'awards']) {
    await page.click('[data-act="go"][data-screen="' + id + '"]');
    await page.waitForTimeout(140);
    const okScreen = await page.evaluate(() => {
      const v = document.getElementById('view');
      return v.innerHTML.length > 200 && !/undefined|NaN/.test(v.textContent);
    });
    step(okScreen, 'screen "' + id + '" is empty or shows undefined/NaN');
  }

  if (errs.length) fails.push('console errors: ' + errs.slice(0, 3).join(' | '));

  console.log('CRIME EMPIRE - Durchlauf gegen ' + URL.replace(/^file:.*\//, 'file://.../') + '\n');
  if (fails.length) {
    console.log('FEHLGESCHLAGEN:');
    fails.forEach(f => console.log('  - ' + f));
    await browser.close();
    process.exit(1);
  }
  console.log('  Menue, neues Spiel, Auftrag, Zeit, Speichern, Neuladen, Fortsetzen, alle Ansichten: in Ordnung.');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

/* Wochenabrechnung oder Entscheidung wegklicken, wie ein Spieler es tut. */
async function closeOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const done = await page.evaluate(() => {
      const ev = document.getElementById('event');
      if (!ev.hidden) {
        const o = document.querySelector('#evOpts .opt:not([disabled])');
        if (o) { o.click(); return false; }
      }
      for (const id of ['report', 'modal']) {
        const m = document.getElementById(id);
        if (!m.hidden) { m.querySelector('[data-close]').click(); return false; }
      }
      return true;
    });
    if (done) return;
    await page.waitForTimeout(120);
  }
}
