/* Liegen die Kristalle ueberhaupt auf einem Weg?
 *
 * Im Durchlauf sammelte der Laeufer auf dem sicheren Weg 9 von 68
 * Kristallen. Das kann zweierlei heissen: die Kristalle liegen absichtlich
 * auf den Abkuerzungen - oder sie liegen neben JEDEM Weg, weil ihre
 * Koordinaten von Hand gesetzt sind und die Wege sich seither bewegt
 * haben. Genau dieser Fehler ist bei den Felsnadeln nachgewiesen worden.
 *
 * Das Werkzeug misst fuer jeden Kristall den kuerzesten Abstand zu jeder
 * Route (Wirbelsaeule und die Zweige der drei Gabeln) und sagt, welcher
 * Weg ihn im Vorbeigehen einsammelt. Der Sammelradius steht im Spiel.
 *
 * Aufruf: node tools/kristalle.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 400, height: 300 } });
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz', 'tal'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });

  const R = await page.evaluate(() => {
    const g = window.GAME, lvl = g.level;
    const rp = lvl.routePaths || {};

    /* Sammelradius: das Spiel prueft den Abstand zum Kristall. */
    const RAD = (lvl.gems[0] && lvl.gems[0].r) || 2.6;

    function nah(pfad, x, y, z) {
      let best = 1e18;
      for (let i = 1; i < pfad.length; i++) {
        const a = pfad[i - 1], c = pfad[i];
        const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
        const ll = dx * dx + dy * dy + dz * dz || 1;
        let t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / ll;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + dx * t, py = a[1] + dy * t, pz = a[2] + dz * t;
        const d = Math.hypot(x - px, y - py, z - pz);
        if (d < best) best = d;
      }
      return best;
    }

    /* Alle Routen: Wirbelsaeule plus jeder Gabelzweig. */
    const wege = { 'Hauptweg': lvl.spine };
    for (const k in rp) wege[k] = rp[k];

    const out = [];
    for (const gm of lvl.gems) {
      const e = { x: Math.round(gm.x), y: Math.round(gm.y), z: Math.round(gm.z),
                  hint: gm.hint || '', beste: null, d: 1e18, alle: {} };
      for (const name in wege) {
        const d = nah(wege[name], gm.x, gm.y, gm.z);
        e.alle[name] = +d.toFixed(1);
        if (d < e.d) { e.d = d; e.beste = name; }
      }
      e.d = +e.d.toFixed(1);
      out.push(e);
    }
    return { rad: RAD, gems: out, wege: Object.keys(wege) };
  });

  const GRENZE = 6;   /* mehr als 6 m neben JEDEM Weg = praktisch unerreichbar */
  console.log('Kristalle: Abstand zum naechsten Weg   (Sammelradius im Spiel: ' + R.rad + ' m)');
  console.log('Wege: ' + R.wege.join(', '));
  console.log('');
  const weit = R.gems.filter(e => e.d > GRENZE).sort((a, b) => b.d - a.d);
  const proWeg = {};
  for (const e of R.gems) {
    if (e.d > GRENZE) continue;
    proWeg[e.beste] = (proWeg[e.beste] || 0) + 1;
  }
  console.log('  Erreichbar (naeher als ' + GRENZE + ' m an einem Weg):');
  for (const k in proWeg) console.log('    ' + k.padEnd(12) + String(proWeg[k]).padStart(3));
  console.log('    ' + 'zusammen'.padEnd(12) + String(R.gems.length - weit.length).padStart(3)
    + ' von ' + R.gems.length);
  console.log('');
  console.log('  ZU WEIT von jedem Weg (' + weit.length + '):');
  for (const e of weit.slice(0, 26)) {
    console.log('    x=' + String(e.x).padStart(5) + ' y=' + String(e.y).padStart(4)
      + ' z=' + String(e.z).padStart(4) + '   ' + String(e.d).padStart(6) + ' m zu "'
      + e.beste + '"   ' + (e.hint ? '(' + e.hint + ')' : ''));
  }
  await b.close();
})();
