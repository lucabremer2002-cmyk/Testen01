/* Das Bewegungsbudget - was die Figur kann, und was das Level verlangen darf.
 *
 * Zwei Fragen, und beide muessen gemessen und nicht geschaetzt werden:
 *
 *   1. Wie weit und wie hoch traegt ein GEWOEHNLICHER Sprung? Daraus folgt
 *      die Obergrenze fuer die sichere Route: kein Pflichtsprung darf mehr
 *      als 70 Prozent davon verlangen. Wer eine Strecke baut, die 95
 *      Prozent verlangt, baut eine Strecke, die nur er selbst schafft.
 *
 *   2. Haelt die Obergrenze des Jets? Sie ist die wichtigste Zusage des
 *      Entwurfs - der Jet macht nie schneller als Laufen. Eine Zusage,
 *      die man nicht nachmisst, ist eine Hoffnung.
 *
 * Aufruf: node tools/budget.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });

  const R = await page.evaluate(() => {
    const g = window.GAME, P = window.MR.physics, F = 1/120, p = g.player;
    const T = window.MR.player.TUNING;
    g.render = function(){};
    function welt() {
      const W = new P.World();
      W.add({ x:0, y:-1, z:0, hx:1200, hy:1, hz:1200, yaw:0, cos:1, sin:0, active:true });
      g.level.world = W; p.spawnAt({ x:0, y:0.2, z:0, yaw:0 }); p.grounded = true;
    }
    const leer = { wishX:0, wishZ:1, slide:false, jet:false, jumpPressed:false, jumpHeld:false };
    function anlauf(n, o) { for (let i=0;i<n;i++) p.step(F, Object.assign({}, leer, o||{})); }

    /* --- Sprungweite und -hoehe, ohne Jet, bei verschiedenen Anlauftempi */
    function sprung(doppelt, anlaufSchritte, rutschen) {
      welt();
      anlauf(anlaufSchritte, rutschen ? { slide:true } : {});
      const v0 = p.speed, y0 = p.y, z0 = p.z;
      let gipfel = 0, dj = false;
      p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
      for (let i=0;i<600;i++) {
        const zweit = doppelt && !dj && p.vy < 1;
        if (zweit) dj = true;
        p.step(F, Object.assign({}, leer, { jumpPressed:zweit, jumpHeld:i<60 }));
        if (p.y - y0 > gipfel) gipfel = p.y - y0;
        if (p.grounded && i>8) break;
      }
      return { v:+v0.toFixed(1), h:+gipfel.toFixed(2), w:+(p.z-z0).toFixed(1) };
    }

    /* --- Haelt die Deckelung?
       Der Test muss die Grenze wirklich herausfordern. Auf ebener Strecke
       kommt man nie ueber RUN, ein Zuenden bei Tempo 20 beweist also
       nichts. Die Figur bekommt deshalb von Hand ein Tempo, das ueber
       allem liegt, was das Spiel je erzeugt - 40, also das Doppelte der
       Laufgeschwindigkeit und deutlich ueber der Rutschlandung. Wenn die
       Deckelung das im ersten Schritt einfaengt, faengt sie alles ein. */
    welt();
    anlauf(240, {});
    p.vz = 40; p.vx = 0;
    const vVorJet = Math.hypot(p.vx, p.vz);
    let vMaxImJet = 0, vNachEinemSchritt = 0;
    p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
    for (let i=0;i<300;i++) {
      p.step(F, Object.assign({}, leer, { jet:true, jumpHeld:i<40 }));
      if (i === 0) vNachEinemSchritt = p.speed;
      if (p.speed > vMaxImJet) vMaxImJet = p.speed;
      if (p.tank <= 0) break;
    }
    /* Und danach: bleibt Schwung uebrig? */
    let vNachLoslassen = 0;
    for (let i=0;i<120;i++) { p.step(F, leer); if (p.speed > vNachLoslassen) vNachLoslassen = p.speed; }

    /* --- Was traegt ein voller Tank? */
    function jetFlug(stick) {
      welt(); anlauf(240, {});
      const y0 = p.y, z0 = p.z; let gipfel = 0;
      p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
      for (let i=0;i<900;i++) {
        const an = p.tank > 0;
        p.step(F, { wishX:0, wishZ:stick, slide:false, jet:an, jumpPressed:false, jumpHeld:i<40 });
        if (p.y - y0 > gipfel) gipfel = p.y - y0;
        if (p.grounded && i>10) break;
      }
      return { h:+gipfel.toFixed(1), w:+(p.z-z0).toFixed(0) };
    }
    welt(); let tv=0; while (p.tank > 0 && tv < 900) { p.step(F, Object.assign({}, leer, {jet:true})); tv++; }
    const tank = tv/120;
    let nf=0; while (p.tank < 0.999 && nf < 1200) { p.step(F, leer); nf++; }

    return {
      RUN: T.RUN, JET_TEMPO: T.JET_TEMPO, SPEED_CAP: T.SPEED_CAP,
      tank: +tank.toFixed(2), fuellen: +(nf/120).toFixed(2),
      sprung: { lauf: sprung(false, 240, false), doppel: sprung(true, 240, false),
                schnellDoppel: sprung(true, 600, true) },
      deckel: { vorher:+vVorJet.toFixed(1), ersterSchritt:+vNachEinemSchritt.toFixed(1),
                maxImJet:+vMaxImJet.toFixed(1), nachLoslassen:+vNachLoslassen.toFixed(1) },
      flug: { hoch: jetFlug(0), schraeg: jetFlug(1) }
    };
  });

  const s = R.sprung;
  console.log('Tempo:  Laufen ' + R.RUN + '   Jet ' + R.JET_TEMPO +
              '   Hoechsttempo (Rutschlandung) ' + R.SPEED_CAP);
  console.log('Tank:   ' + R.tank + ' s Schub, ' + R.fuellen + ' s Nachfuellen\n');

  console.log('GEWOEHNLICHER SPRUNG - daraus folgt das Budget der sicheren Route');
  console.log('  Sprung            Tempo ' + String(s.lauf.v).padStart(5) +
              '   ' + String(s.lauf.h).padStart(6) + ' m hoch  ' + String(s.lauf.w).padStart(6) + ' m weit');
  console.log('  + Doppelsprung    Tempo ' + String(s.doppel.v).padStart(5) +
              '   ' + String(s.doppel.h).padStart(6) + ' m hoch  ' + String(s.doppel.w).padStart(6) + ' m weit');
  console.log('  mit Schwung       Tempo ' + String(s.schnellDoppel.v).padStart(5) +
              '   ' + String(s.schnellDoppel.h).padStart(6) + ' m hoch  ' + String(s.schnellDoppel.w).padStart(6) + ' m weit');
  console.log('\n  SICHERE ROUTE darf hoechstens verlangen (70 % vom Doppelsprung):');
  console.log('    ' + (s.doppel.h * 0.7).toFixed(2) + ' m Hoehe      ' +
              (s.doppel.w * 0.7).toFixed(1) + ' m Weite');

  const d = R.deckel;
  const ok = d.maxImJet <= R.JET_TEMPO + 0.05 && d.nachLoslassen <= R.JET_TEMPO + 0.05;
  console.log('\nOBERGRENZE DES JETS');
  console.log('  Tempo beim Zuenden          ' + d.vorher);
  console.log('  nach EINEM Schritt Schub    ' + d.ersterSchritt);
  console.log('  hoechstes Tempo im Schub    ' + d.maxImJet + '   (Grenze ' + R.JET_TEMPO + ')');
  console.log('  hoechstes Tempo danach      ' + d.nachLoslassen);
  console.log('  ' + (ok ? 'HAELT - der Jet macht nie schneller als Laufen'
                         : 'GERISSEN - der Jet ist ein Tempoknopf'));

  console.log('\nWAS EIN VOLLER TANK TRAEGT');
  console.log('  ohne Steuerkreuz  ' + String(R.flug.hoch.h).padStart(5) + ' m hoch  ' +
              String(R.flug.hoch.w).padStart(4) + ' m weit');
  console.log('  mit Steuerkreuz   ' + String(R.flug.schraeg.h).padStart(5) + ' m hoch  ' +
              String(R.flug.schraeg.w).padStart(4) + ' m weit');
  await b.close();
  process.exit(ok ? 0 : 1);
})();
