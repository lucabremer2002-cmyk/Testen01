/* Wo stehen die Felsnadeln WIRKLICH?
 *
 * Im Durchlauf verlor der Laeufer auf dem sicheren Weg elfmal zwischen
 * 13,6 und 22,6 s mehr als die Haelfte seines Tempos - immer an
 * derselben Stelle, dem Nadelslalom der Senke. Die Frage ist, ob das am
 * Testpiloten liegt (er faehrt ohne Vorausschau in Kanten) oder an der
 * Geometrie.
 *
 * Das laesst sich entscheiden, ohne zu fahren: man misst, wie weit jede
 * Nadel von der Ideallinie steht und wie breit die Luecken links und
 * rechts von ihr sind. Eine Nadel, die 3 m neben der Mittellinie eines
 * 20 m breiten Weges steht, ist ein Hindernis MITTEN auf der Linie -
 * dagegen hilft keine Vorausschau.
 *
 * Aufruf: node tools/nadeln.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 400, height: 300 } });
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz', 'tal'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });

  const R = await page.evaluate(() => {
    const g = window.GAME, lvl = g.level, sp = lvl.spine;

    /* Eine Nadel ist ein Kollisionskoerper von 3,3 x 7 x 3,3 ohne
       Material (rein Sperre) - daran laesst sie sich erkennen. */
    const nadeln = [];
    for (const c of lvl.world.all) {
      if (c.noCollide || c.trigger) continue;
      if (Math.abs(c.hx - 1.65) > 0.2 || Math.abs(c.hz - 1.65) > 0.2) continue;
      if (Math.abs(c.hy - 3.5) > 0.3) continue;
      nadeln.push(c);
    }
    nadeln.sort((a, b) => a.z - b.z);

    /* Naechster Streckenpunkt und Richtung dort */
    function naechster(x, z) {
      let bi = 0, bd = 1e18;
      for (let i = 0; i < sp.length; i++) {
        const dx = sp[i][0] - x, dz = sp[i][2] - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }

    /* Wie breit ist der begehbare Boden quer zur Strecke an dieser
       Stelle, und wo sitzt die Nadel darin? */
    function bodenBei(x, z, y) {
      for (const c of lvl.world.all) {
        if (c.noCollide || c.trigger) continue;
        if (c.hx > 60 || c.hz > 60) continue;
        if (Math.abs(c.x - x) > c.hx || Math.abs(c.z - z) > c.hz) continue;
        const top = c.y + c.hy;
        if (top > y - 6 && top < y + 3) return top;
      }
      return null;
    }

    const out = [];
    for (const n of nadeln) {
      const i = naechster(n.x, n.z);
      const a = sp[Math.max(0, i - 1)], c2 = sp[Math.min(sp.length - 1, i + 1)];
      let dx = c2[0] - a[0], dz = c2[2] - a[2];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const qx = -dz, qz = dx;                       /* quer zur Strecke */
      const ox = n.x - sp[i][0], oz = n.z - sp[i][2];
      const quer = ox * qx + oz * qz;                /* Abstand zur Mittellinie */

      /* Boden quer abtasten: von -18 bis +18 m in Schritten von 0,5 */
      const fuss = sp[i][1];
      let links = null, rechts = null;
      for (let s = -18; s <= 18.01; s += 0.5) {
        const px = sp[i][0] + qx * s, pz = sp[i][2] + qz * s;
        const t = bodenBei(px, pz, fuss);
        if (t !== null) { if (links === null) links = s; rechts = s; }
      }
      out.push({
        z: Math.round(n.z), x: Math.round(n.x),
        quer: +quer.toFixed(1),
        bodenVon: links === null ? null : +links.toFixed(1),
        bodenBis: rechts === null ? null : +rechts.toFixed(1),
        sperrtVon: +(quer - n.hx).toFixed(1), sperrtBis: +(quer + n.hx).toFixed(1)
      });
    }
    return out;
  });

  console.log('Felsnadeln der Senke - Lage zur Ideallinie');
  console.log('');
  console.log('   z     x    quer   begehbar quer      Nadel sperrt     freie Luecken');
  for (const n of R) {
    if (n.bodenVon === null) {
      console.log(('' + n.z).padStart(5) + ('' + n.x).padStart(6) + ('' + n.quer).padStart(8)
        + '     KEIN BODEN in Reichweite  -> Nadel steht in der Luft');
      continue;
    }
    const li = (n.sperrtVon - n.bodenVon), re = (n.bodenBis - n.sperrtBis);
    const aufWeg = n.sperrtVon < n.bodenBis && n.sperrtBis > n.bodenVon;
    console.log(('' + n.z).padStart(5) + ('' + n.x).padStart(6) + ('' + n.quer).padStart(8)
      + ('  ' + n.bodenVon + ' .. ' + n.bodenBis).padEnd(20)
      + ('  ' + n.sperrtVon + ' .. ' + n.sperrtBis).padEnd(17)
      + (aufWeg ? ('links ' + li.toFixed(1) + ' m / rechts ' + re.toFixed(1) + ' m')
                : 'NEBEN dem Weg'));
  }
  console.log('');
  console.log('  quer = Abstand von der Mittellinie (Ideallinie des Piloten).');
  console.log('  Eine Nadel mit |quer| < 2 steht auf der Linie: da hilft keine Vorausschau.');
  await b.close();
})();
