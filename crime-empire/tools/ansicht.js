/* Bildschirmfotos aller Ansichten - damit sich Aussehen pruefen laesst,
   statt es zu behaupten.   node tools/ansicht.js [url] [ordner]        */
'use strict';
const URL = process.argv[2] || 'http://127.0.0.1:8231/index.html';
const DIR = process.argv[3] || '/tmp/ce-shots';
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

/* Erste nicht gesperrte Option - Option 0 kann gesperrt sein, und dann
   bliebe das Ereignis offen und die Zeit stuende still. */
function firstOpenIdx(ev) {
  for (var i = 0; i < ev.options.length; i++) if (!ev.options[i].disabled) return i;
  return 0;
}
(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.CRIME);
  await page.waitForTimeout(1800);                     /* Skyline animieren lassen */
  await page.screenshot({ path: DIR + '/00-menu.png' });

  /* Eine Partie aufbauen, damit die Bildschirme etwas zeigen. */
  await page.evaluate(() => {
    const firstOpen = (ev) => { for (let i = 0; i < ev.options.length; i++) if (!ev.options[i].disabled) return i; return 0; };
    const s = window.CRIME.newGame({ seed: 4242, name: 'Vito', difficulty: 'normal' });
    const CE = window.CE;
    s.cash = 260000; s.rep = 46; s.heat = 38;
    CE.empire.openDistrict(s, 'industrial');
    CE.empire.openDistrict(s, 'redlight');
    CE.empire.buy(s, 'oldtown', 'diner');
    CE.empire.buy(s, 'oldtown', 'market');
    CE.empire.buy(s, 'oldtown', 'garage');
    CE.empire.buy(s, 'industrial', 'logistics');
    CE.empire.buy(s, 'industrial', 'contraband');
    CE.empire.buy(s, 'redlight', 'club');
    CE.empire.buy(s, 'redlight', 'gambling');
    CE.empire.upgradeOrg(s, 'safehouse');
    CE.empire.upgradeOrg(s, 'laundry');
    CE.empire.upgradeOrg(s, 'retainer');
    const rng = CE.sim.rngOf(s);
    CE.crew.refreshRecruits(s, rng, 6);
    for (let i = 0; i < 5 && s.recruits.length; i++) CE.crew.hire(s, s.recruits[0].id);
    CE.sim.keepRng(s, rng);
    s.crew.forEach(c => { if (!c.player && !c.post) {
      for (const b of s.businesses) if (CE.crew.assign(s, c.id, b.id).ok) break;
    }});
    for (let i = 0; i < 84; i++) { window.CRIME.tickDay(); if (s.event) CE.sim.choose(s, firstOpen(s.event)); }
    s.cash = 340000;
    document.getElementById('modal').hidden = true;
    document.getElementById('report').hidden = true;
    document.getElementById('event').hidden = true;
  });

  const shots = [['overview','01'],['city','02'],['business','03'],['crew','04'],
                 ['org','05'],['rivals','06'],['finance','07'],['log','08'],['awards','09']];
  for (const [screen, n] of shots) {
    await page.evaluate(s => { window.CRIME.go(s); window.CRIME.paint(); }, screen);
    await page.waitForTimeout(420);
    await page.screenshot({ path: DIR + '/' + n + '-' + screen + '.png' });
  }

  /* Ereignisfenster */
  await page.evaluate(() => {
    const s = window.CRIME.state();
    const rng = window.CE.sim.rngOf(s);
    for (let i = 0; i < 40 && !s.event; i++) {
      const ev = window.CE.events.draw(s, rng);
      if (ev) { s.event = ev; break; }
      s.day++;
    }
    window.CRIME.go('overview'); window.CRIME.paint();
    if (s.event) window.CRIME.actions.showEvent({});
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: DIR + '/10-event.png' });

  /* Mannschaftsfenster */
  await page.evaluate(() => {
    document.getElementById('event').hidden = true;
    const s = window.CRIME.state();
    const c = s.crew.find(x => !x.player);
    if (c) window.CRIME.actions.crewDialog({ id: c.id });
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: DIR + '/11-crewdialog.png' });

  /* Schmales Fenster */
  await page.setViewportSize({ width: 430, height: 880 });
  await page.evaluate(() => { document.getElementById('modal').hidden = true; window.CRIME.go('overview'); window.CRIME.paint(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: DIR + '/12-mobile.png', fullPage: false });

  console.log('Bilder in ' + DIR);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
