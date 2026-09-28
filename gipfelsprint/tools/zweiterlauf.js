/* Der zweite Lauf - und alles, was ihn ausmacht.
 *
 * Ein Zeitfahren lebt vom Wiederholen. Dafuer muss nach dem ersten Lauf
 * etwas UEBRIG BLEIBEN: eine Bestzeit, ein Geist, der die alte Linie
 * zeigt, ein Rueckstand, der waehrend des Fahrens mitlaeuft.
 *
 * Geprueft wird das hier, und es ist nicht selbstverstaendlich: der
 * Geist wird in finishRun() aufgezeichnet, und finishRun() wurde in
 * diesem Level lange gar nicht aufgerufen - es fehlte die Ziellinie. Der
 * Geist hat hier also noch nie existiert.
 *
 * Aufruf: node tools/zweiterlauf.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz','tal'); } catch(e){} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });
  await page.addScriptTag({ path: require('path').join(__dirname, 'pilot.js') });

  const R = await page.evaluate(() => {
    const g = window.GAME, F = 1/120, lvl = g.level, p = g.player, sp = lvl.spine;
    const rp = lvl.routePaths, gz = lvl.gates.map(t => t.z);

    function wegpunkte(wahl) {
      const w = [];
      for (const s of sp) if (s[2] <= gz[0] + 2) w.push(s);
      for (let k = 0; k < 3; k++) {
        const alt = rp[k + ':' + wahl[k]];
        if (alt && wahl[k] > 0) { for (const q of alt) w.push(q); }
        else for (const s of sp) if (s[2] > gz[k] + 2 && s[2] < gz[k+1]) w.push(s);
      }
      for (const s of sp) if (s[2] >= gz[3] - 2) w.push(s);
      return w;
    }

    function fahre(wahl, bremse) {
      const wps = wegpunkte(wahl);
      g.startRun(true); g.state = 'run'; g.runTime = 0;
      const st = window.PILOT.neu(g, { bremse: bremse });
      const deltas = [];
      for (let i = 0; i < 120*200; i++) {
        g.runTime += F;
        g.fixedStep(F, window.PILOT.schritt(g, st, wps));
        /* Der Rueckstand wird sonst in der Bildschleife gepflegt. */
        if (g.ghostPlay && i % 30 === 0) {
          const n = g.ghostPlay.nearestTimeTo(p.x, p.z, g.runTime);
          if (n && n.dist < 22) deltas.push(+(g.runTime - n.time).toFixed(2));
        }
        if (g.state === 'finish') break;
        const z = window.PILOT.nachlauf(g, st, F);
        if (z === 'tot' || z === 'fest') break;
      }
      return { zeit: +g.runTime.toFixed(2), imZiel: g.state === 'finish',
               tode: st.tode, deltas: deltas };
    }

    const a = fahre([1,1,1], false);
    /* Die Medaille wird NICHT gespeichert, sie wird aus der Bestzeit
       abgeleitet - eine Quelle der Wahrheit statt zweier, die
       auseinanderlaufen koennen. Geprueft wird deshalb die Ableitung
       und das, was im Menue davon ankommt. */
    const med = g.medalFor(g.store.best ? g.store.best.time : 1e9);
    const html = g.medalHtml();
    const nachEins = { best: (g.store.best && g.store.best.time) || null,
                       geist: !!(g.record && g.record.ghost),
                       bilder: g.record && g.record.ghost
                               ? (g.record.ghost.n || g.record.ghost.length ||
                                  (g.record.ghost.t && g.record.ghost.t.length) || '?') : 0,
                       medaille: med ? med.name : null,
                       erworben: (html.match(/earned/g) || []).length };
    /* Zweiter Lauf, absichtlich langsamer - so MUSS ein Rueckstand
       entstehen. Ein Wert nahe null saegt sonst nichts aus. */
    const c = fahre([0,0,0], true);
    return { lauf1: a, nachEins: nachEins, lauf2: c,
             geistLaeuft: !!g.ghostPlay,
             bestNachher: (g.store.best && g.store.best.time) || null };
  });

  const ok = [];
  function pruef(name, bedingung, text) {
    ok.push(bedingung);
    console.log((bedingung ? '  ok   ' : '  FEHL ') + name.padEnd(30) + text);
  }
  console.log('Der zweite Lauf\n');
  pruef('Lauf 1 im Ziel', R.lauf1.imZiel, R.lauf1.zeit + ' s, Stuerze ' + R.lauf1.tode);
  pruef('Bestzeit gespeichert', R.nachEins.best !== null,
        R.nachEins.best ? R.nachEins.best.toFixed(2) + ' s' : 'KEINE');
  pruef('Medaille abgeleitet', !!R.nachEins.medaille, R.nachEins.medaille || 'KEINE');
  pruef('Menue zeigt sie an', R.nachEins.erworben > 0,
        R.nachEins.erworben + ' von 4 Medaillen als erworben markiert');
  pruef('Geist aufgezeichnet', R.nachEins.geist, R.nachEins.bilder + ' Bilder');
  pruef('Geist laeuft im 2. Lauf', R.geistLaeuft, R.geistLaeuft ? 'ja' : 'NEIN');
  pruef('Rueckstand wird gemessen', R.lauf2.deltas.length > 3,
        R.lauf2.deltas.length + ' Messpunkte' +
        (R.lauf2.deltas.length ? ', von ' + R.lauf2.deltas[0] + ' bis ' +
          R.lauf2.deltas[R.lauf2.deltas.length-1] + ' s' : ''));
  pruef('Rueckstand waechst', R.lauf2.deltas.length > 3 &&
        R.lauf2.deltas[R.lauf2.deltas.length-1] > R.lauf2.deltas[0],
        'der langsamere Lauf faellt zurueck');
  pruef('Bestzeit bleibt die bessere', R.bestNachher !== null &&
        Math.abs(R.bestNachher - R.lauf1.zeit) < 0.01,
        R.bestNachher ? R.bestNachher.toFixed(2) + ' s (Lauf 2: ' + R.lauf2.zeit + ' s)' : '-');
  if (errs.length) console.log('\nFEHLER: ' + errs.slice(0,3).join(' | '));
  console.log('\n' + (ok.every(Boolean) ? 'Alles in Ordnung' : 'ES GIBT FEHLER'));
  await b.close();
  process.exit(ok.every(Boolean) ? 0 : 1);
})();
