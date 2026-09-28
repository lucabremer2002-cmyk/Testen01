/* Wo toetet das Level, und wo faengt es auf?
 *
 * game.js prueft jeden Schritt:  if (p.y < lvl.floorAt(p.x, p.z)) die()
 *
 * Zwei Fehler sind moeglich und beide sind schlimm:
 *
 *   Die Ebene liegt ZU HOCH - man stirbt, waehrend man auf festem Boden
 *   steht oder ihn gerade noch erreichen wuerde. Nichts ist
 *   ungerechter.
 *
 *   Die Ebene liegt ZU TIEF - man faellt sekundenlang, bevor der Lauf
 *   endet. Bei einem Spiel, das vom sofortigen Neustart lebt, ist jede
 *   dieser Sekunden verlorene Lust.
 *
 * Geprueft wird entlang aller Wege: wie weit unter dem begehbaren Boden
 * liegt die Todesebene?
 *
 * Aufruf: node tools/todesebene.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SATZ = process.env.MR_SATZ || 'tal';

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch(e){} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });

  const R = await page.evaluate(() => {
    const lvl = window.GAME.level, P = window.MR.physics;
    const hit = P.makeHit();
    const punkte = [];
    lvl.spine.forEach(p => punkte.push({ p: p, woher: 'Hauptweg' }));
    const rp = lvl.routePaths || {};
    for (const k in rp) rp[k].forEach(p => punkte.push({ p: p, woher: 'Gabel ' + k }));

    const aus = [];
    for (const e of punkte) {
      const p = e.p;
      /* Der wirkliche Boden unter dem Wegpunkt - per Strahl nach unten. */
      const t = P.raycast(lvl.world, p[0], p[1] + 2, p[2], 0, -1, 0, 400, hit);
      const boden = t ? (p[1] + 2 - hit.t) : null;
      const tod = lvl.floorAt(p[0], p[2]);
      aus.push({ woher: e.woher, x: +p[0].toFixed(0), y: +p[1].toFixed(0), z: +p[2].toFixed(0),
                 boden: boden === null ? null : +boden.toFixed(1),
                 tod: +tod.toFixed(1),
                 fall: boden === null ? null : +(boden - tod).toFixed(1) });
    }
    /* Und jetzt FLAECHENDECKEND: ein Raster ueber das ganze Level. An
       jedem Punkt den obersten Boden suchen und mit der Todesebene
       vergleichen. Liegt begehbarer Boden UNTER ihr, stirbt man dort im
       Stehen - und genau das koennen Fangflaechen wie der Muldenboden
       sein, die tief liegen sollen.

       Der erste Versuch pruefte statt dessen zwei von Hand geratene
       Punkte. Einer davon lag gar nicht auf dem Muldenboden, meldete
       aber "TOEDLICH" - eine Stichprobe, die man nicht nachrechnet, ist
       eine Behauptung mit Nachkommastellen. */
    const bnd = lvl.bounds || { minX: -200, maxX: 200, minZ: 0, maxZ: 900 };
    const tot = [];
    let felder = 0;
    for (let x = bnd.minX; x <= bnd.maxX; x += 6) {
      for (let z = bnd.minZ; z <= bnd.maxZ; z += 6) {
        const t = P.raycast(lvl.world, x, 300, z, 0, -1, 0, 600, hit);
        if (!t) continue;
        const oben = 300 - hit.t;
        felder++;
        const td = lvl.floorAt(x, z);
        if (oben < td + 0.3) tot.push({ x: Math.round(x), z: Math.round(z),
                                        boden: +oben.toFixed(1), tod: +td.toFixed(1) });
      }
    }
    return { aus: aus, raster: { felder: felder, tot: tot } };
  });

  const mitBoden = R.aus.filter(r => r.fall !== null);
  const toedlich = mitBoden.filter(r => r.fall <= 0.5);
  const tief = mitBoden.filter(r => r.fall > 40);
  mitBoden.sort((a, c) => a.fall - c.fall);

  console.log('Abstand zwischen begehbarem Boden und Todesebene\n');
  console.log('  Wegpunkte mit Boden darunter:  ' + mitBoden.length + ' von ' + R.aus.length);
  console.log('  geringster Abstand:            ' + mitBoden[0].fall + ' m  (' +
              mitBoden[0].woher + ' bei ' + mitBoden[0].x + ',' + mitBoden[0].z + ')');
  console.log('  groesster Abstand:             ' + mitBoden[mitBoden.length-1].fall + ' m');
  const schnitt = mitBoden.reduce((s, r) => s + r.fall, 0) / mitBoden.length;
  console.log('  im Schnitt:                    ' + schnitt.toFixed(1) + ' m  (Fallzeit ' +
              Math.sqrt(2 * schnitt / 64).toFixed(2) + ' s)');

  if (toedlich.length) {
    console.log('\n  TOEDLICH AUF FESTEM BODEN - ' + toedlich.length + ' Stelle(n):');
    toedlich.slice(0, 6).forEach(r => console.log('    ' + r.woher + '  ' + r.x + ',' + r.y + ',' + r.z +
      '   Boden ' + r.boden + '   Todesebene ' + r.tod));
  }
  if (tief.length) {
    console.log('\n  SEHR TIEF (ueber 40 m, also ueber 1,1 s Fallen) - ' + tief.length + ' Stelle(n)');
  }
  console.log('\n  Raster ueber das ganze Level: ' + R.raster.felder + ' Felder mit Boden');
  if (R.raster.tot.length) {
    console.log('    ' + R.raster.tot.length + ' Felder liegen UNTER der Todesebene:');
    R.raster.tot.slice(0, 8).forEach(t => console.log('      ' + t.x + ',' + t.z +
      '   Boden ' + t.boden + '   Todesebene ' + t.tod));
  } else {
    console.log('    kein begehbarer Boden unter der Todesebene');
  }

  if (errs.length) console.log('\nFEHLER: ' + errs.slice(0,2).join(' | '));
  const ok = toedlich.length === 0 && R.raster.tot.length === 0;
  console.log('\n' + (ok ? 'Die Todesebene liegt ueberall unter dem Boden' : 'ES GIBT FEHLER'));
  await b.close();
  process.exit(ok ? 0 : 1);
})();
