/* Rechnet jede Stufe des Levels gegen die gemessenen Reichweiten nach.
 *
 * Der Testpilot sagt, DASS ein Weg nicht geht. Dieses Werkzeug sagt, WO
 * und um wie viel - und zwar ohne ihn, denn sonst diskutiert man immer
 * zwei Fehlerquellen zugleich. Es kennt nur Geometrie und die Tabelle:
 *
 *   Sprung                  2,8 m hoch   12,2 m weit  (bei Tempo 17)
 *   + Doppelsprung          4,9 m hoch   18,6 m weit
 *   Jet kurz angetippt      9,3 m hoch   15   m weit
 *   Jet, nur hoch          26,7 m hoch   13   m weit
 *   Jet, erst hoch dann vor 19,1 m hoch   56   m weit
 *   Jet, nur vor           14,9 m hoch   74   m weit
 *
 * Aufruf: node tools/stufen.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SATZ = process.env.MR_SATZ || 'turm';

/* Was eine Technik traegt. Die Weite gilt fuer den Anlauf, den man auf
   dem jeweiligen Weg realistisch hat - auf dem sicheren Weg laeuft man,
   auf dem irren fliegt man. */
const KANN = [
  { name: 'Doppelsprung', hoch: 4.9,  weit: 18.6 },
  { name: 'Jet-Tipp',     hoch: 9.3,  weit: 22.0 },
  { name: 'hoch->vor',    hoch: 19.1, weit: 56.0 },
  { name: 'nur vor',      hoch: 14.9, weit: 74.0 }
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch(e){} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  const R = await page.evaluate(() => {
    const lvl = window.GAME.level;
    const out = { spine: lvl.spine, routen: {} };
    const rp = lvl.routePaths || {};
    for (const k in rp) out.routen[k] = rp[k];
    return out;
  });

  function pruefe(name, pfad) {
    console.log('\n' + name + '  (' + pfad.length + ' Punkte)');
    let schlimm = 0;
    for (let i = 1; i < pfad.length; i++) {
      const a = pfad[i-1], c = pfad[i];
      const weit = Math.hypot(c[0]-a[0], c[2]-a[2]);
      const hoch = c[1] - a[1];
      /* Die billigste Technik, die diese Stufe traegt. */
      let kann = null;
      for (const K of KANN) {
        if (hoch <= K.hoch * 0.85 && weit <= K.weit * 0.85) { kann = K; break; }
      }
      const marke = kann ? '   ' : ' !!';
      if (!kann) schlimm++;
      if (!kann || i <= 2 || i === pfad.length - 1) {
        console.log(marke + ' Stufe ' + String(i).padStart(2) + ': ' +
          weit.toFixed(1).padStart(6) + ' m weit, ' + hoch.toFixed(1).padStart(6) + ' m hoch   ' +
          (kann ? kann.name : 'KEINE TECHNIK REICHT'));
      }
    }
    if (schlimm) console.log('   ' + schlimm + ' Stufe(n) ausserhalb der gemessenen Reichweite');
    else console.log('   alle Stufen innerhalb der Reichweite (15 % Reserve)');
  }

  pruefe('Wirbelsaeule (sicherer Pfad)', R.spine);
  const NAME = { '0:0': 'Gabel SICHER', '0:1': 'Gabel SCHNELL', '0:2': 'Gabel IRRE' };
  for (const k of Object.keys(R.routen).sort()) pruefe(NAME[k] || k, R.routen[k]);
  await b.close();
})();
