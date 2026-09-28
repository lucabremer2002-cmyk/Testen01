/* Bilder aus dem Spiel, immer an denselben Stellen.
 *
 * Grafik laesst sich nicht rechnen. Was sich rechnen laesst, ist die
 * Vergleichbarkeit: dieselben Kameras, dieselbe Groesse, derselbe
 * Zeitpunkt. Nur so sieht man, ob eine Aenderung etwas besser gemacht
 * hat oder nur anders.
 *
 * Aufruf: node tools/ansichten.js [praefix]
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PRE = process.argv[2] || 'v';

const KAMERAS = [
  { name: 'start',    z: 20,  yaw: 0.00, pitch: 0.16, dist: 13 },
  { name: 'senke',    z: 200, yaw: -0.5, pitch: 0.26, dist: 22 },
  { name: 'ruine',    z: 420, yaw: 0.35, pitch: 0.20, dist: 18 },
  { name: 'schlucht', z: 700, yaw: -0.2, pitch: 0.30, dist: 24 },
  { name: 'ziel',     z: 812, yaw: 0.00, pitch: 0.18, dist: 16 }
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz','tal'); } catch(e){} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });
  await page.waitForTimeout(1200);

  for (const k of KAMERAS) {
    await page.evaluate((k) => {
      const g = window.GAME, p = g.player, sp = g.level.spine;
      ['menu','result','pause','loading','rotate','hud'].forEach(id => {
        const e = document.getElementById(id); if (e) e.hidden = true; });
      g.resetRun(true); g.state = 'run';
      let best = sp[0];
      for (const q of sp) if (Math.abs(q[2] - k.z) < Math.abs(best[2] - k.z)) best = q;
      p.spawnAt({ x: best[0], y: best[1] + 1.2, z: best[2], yaw: k.yaw });
      g.cam.update(1/60, p, null, g.level.world, true);
      g.cam.yaw = k.yaw; g.cam.pitch = k.pitch;
      g.cam.distNow = k.dist; g.cam.manualTimer = 99;
      g.render();
    }, k);
    await page.waitForTimeout(420);
    await page.screenshot({ path: '/tmp/' + PRE + '-' + k.name + '.png',
                            animations: 'disabled', timeout: 20000 });
  }
  console.log(errs.length ? 'FEHLER: ' + errs.slice(0,2).join(' | ') : 'ok');
  await b.close();
})();
