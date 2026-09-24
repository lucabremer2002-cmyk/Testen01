/* Zeit und Austrittstempo je Abschnitt, fuer eine vorgegebene Routenwahl.
   Ein Lauf genuegt: die Simulation ist nachweislich deterministisch. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const WAHL = (process.argv[2] || '0000000').split('').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const R = await page.evaluate((WAHL) => {
    const g = window.GAME, P = window.MR.physics, hit = P.makeHit(), F = 1 / 120;
    g.render = function () {};
    const lvl = g.level, sp = lvl.spine;

    function naechster(pt) {
      let bi = 0, bd = 1e18;
      for (let i = 0; i < sp.length; i++) {
        const d = (sp[i][0]-pt.x)**2 + (sp[i][2]-pt.z)**2;
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }
    const grenzen = lvl.gates.map(naechster);
    const wps = [];
    let from = 0;
    for (let k = 0; k <= lvl.gates.length; k++) {
      const to = k < grenzen.length ? grenzen[k] : sp.length - 1;
      const br = WAHL[k];
      const alt = (br !== undefined && br !== 0 && lvl.routePaths[k + ':' + br]) || null;
      if (alt) {
        wps.push(k === 0 ? [lvl.start.x, lvl.start.y, lvl.start.z]
                         : [lvl.gates[k-1].x, lvl.gates[k-1].y, lvl.gates[k-1].z]);
        for (const w of alt) wps.push(w);
      } else {
        for (let i = from; i <= to; i++) wps.push(sp[i]);
      }
      if (k < grenzen.length) wps.push([lvl.gates[k].x, lvl.gates[k].y, lvl.gates[k].z]);
      from = to + 1;
    }

    g.resetRun(true); g.state = 'run'; g.runTime = 0;
    const p = g.player;
    const tode = [];
    let wi = 1, deaths = 0, stuck = 0, lastZ = p.z;
    const cmd = { wishX: 0, wishZ: 0, slide: false, dash: false, jumpPressed: false, jumpHeld: false };
    const splits = [];
    let gesehen = 0;
    let accDist = 0, accAir = 0, accN = 0, accSum = 0, accMax = 0, accLand = 0;
    let wasGround = true;
    let pxo = p.x, pyo = p.y, pzo = p.z;

    for (let i = 0; i < 120 * 200; i++) {
      const tgt = wps[Math.min(wi, wps.length - 1)];
      const dx = tgt[0] - p.x, dz = tgt[2] - p.z, d2 = Math.hypot(dx, dz);
      if (d2 < 5 && Math.abs(tgt[1] - p.y) < 7) { if (wi < wps.length - 1) wi++; }
      const ux = dx / (d2 || 1), uz = dz / (d2 || 1);
      const along = p.vx * ux + p.vz * uz;
      const latX = p.vx - ux * along, latZ = p.vz - uz * along;
      const lead = p.grounded ? 0.10 : 0.32;
      const aX = dx - latX * lead, aZ = dz - latZ * lead;
      const aL = Math.hypot(aX, aZ) || 1;
      cmd.wishX = aX / aL; cmd.wishZ = aZ / aL;
      const ahead = P.raycast(lvl.world, p.x + cmd.wishX*2.4, p.y-0.4, p.z + cmd.wishZ*2.4, 0,-1,0, 3.2, hit);
      const below = P.raycast(lvl.world, p.x, p.y-0.4, p.z, 0,-1,0, 4.0, hit);
      cmd.slide = (!p.grounded && p.vy < -4) || (p.grounded && p.speed > 19);
      cmd.jumpPressed = false; cmd.dash = false;
      cmd.jumpHeld = d2 > p.speed * 0.52;
      if (p.grounded && (!ahead || (tgt[1]-p.y > 1.5 && d2 < 10) || (p.speed < 5 && i > 60))) {
        cmd.jumpPressed = true;
        if (d2 > 18 && p.dashCharge > 0) cmd.dash = true;
      } else if (!p.grounded && p.coyote <= 0 && p.wallCoyote > 0 && !below) {
        /* ------------------------------------------------- Wandsprung
           Der Spieler beruehrt eine Wand und ist in der Luft. Der
           Wandsprung hat im Spieler Vorrang vor dem Doppelsprung, es
           genuegt also, im Nachfristfenster zu druecken. Ohne diesen
           Zweig presste der Pilot beim Aufsteigen an der Wand nie
           Sprung - die Bedingung darunter verlangt vy < -1 - und die
           Wandschlucht war damit fuer ihn unpassierbar.
           Er zielt dabei zum naechsten Wegpunkt: die Eingabe zieht im
           Spieler die neue Richtung, ohne das Tempo zu aendern. */
        cmd.jumpPressed = true;
        if (d2 > 24 && p.dashCharge > 0) cmd.dash = true;
      } else if (!p.grounded && p.vy < -1 && !below && p.jumps > 0 && tgt[1] > p.y - 3) {
        /* Der Doppelsprung wird nur genommen, wenn das Ziel nicht deutlich
           tiefer liegt. Vorher sprang der Pilot ueber jeder Luecke nach,
           auch wenn er fallen sollte - er segelte dann fuenfzehn Meter
           ueber dem Zusammenfluss hinweg und holte sich das Tempo aus der
           Landung nie ab. Ein Spieler tut das nicht. */
        cmd.jumpPressed = true;
      }
      else if (!p.grounded && p.vy < -5 && !below && p.jumps === 0 && p.dashCharge > 0) cmd.dash = true;

      g.runTime += F;
      g.fixedStep(F, cmd);
      accDist += Math.hypot(p.x-pxo, p.y-pyo, p.z-pzo);
      pxo = p.x; pyo = p.y; pzo = p.z;
      if (!p.grounded) accAir++;
      if (p.grounded && !wasGround) accLand++;
      wasGround = p.grounded;
      accN++; accSum += p.speed; if (p.speed > accMax) accMax = p.speed;

      /* Torpassagen liefern die Abschnittsgrenzen. */
      let offen = 0;
      for (let k = 0; k < lvl.gates.length; k++) if (lvl.gates[k].passed) offen++;
      if (offen > gesehen) {
        gesehen = offen;
        splits.push({ tor: lvl.gates[gesehen-1].name, t: +g.runTime.toFixed(2),
                      tempo: +p.speed.toFixed(1), dash: p.dashCharge, kristalle: g.gems,
                      weg: +accDist.toFixed(0), schnitt: +(accSum/Math.max(1,accN)).toFixed(1),
                      spitze: +accMax.toFixed(1), luft: +(accAir/Math.max(1,accN)).toFixed(2),
                      land: accLand });
        accDist=0; accAir=0; accN=0; accSum=0; accMax=0; accLand=0;
      }
      if (g.state === 'finish') break;
      if (g.state !== 'run') {
        deaths++;
        tode.push('t=' + g.runTime.toFixed(2) + '  pos ' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + ',' + p.z.toFixed(0) + '  wp' + wi + ' -> ' + JSON.stringify(wps[Math.min(wi,wps.length-1)].map(v=>+v.toFixed(0))));
        if (deaths > 6) break;
        g.startRun(true); g.state = 'run'; g.runTime = splits.length ? splits[splits.length-1].t : 0;
        wi = 1;
      }
      if (Math.abs(p.z - lastZ) < 0.05) stuck++; else { stuck = 0; lastZ = p.z; }
      if (stuck > 120 * 12) { tode.push('FEST t=' + g.runTime.toFixed(2) + '  pos ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(1) + '  v=' + p.speed.toFixed(1) + '  grounded=' + p.grounded + '  wp' + wi + ' -> ' + JSON.stringify(wps[Math.min(wi,wps.length-1)].map(v=>+v.toFixed(0)))); break; }
    }
    splits.push({ tor: 'ZIEL', t: +g.runTime.toFixed(2), tempo: +p.speed.toFixed(1),
                  dash: p.dashCharge, kristalle: g.gems,
                  weg: +accDist.toFixed(0), schnitt: +(accSum/Math.max(1,accN)).toFixed(1),
                  spitze: +accMax.toFixed(1), luft: +(accAir/Math.max(1,accN)).toFixed(2),
                  land: accLand });
    return { zustand: g.state, deaths, splits, tode };
  }, WAHL);

  const lbl = ['S','F','I'];
  console.log('Wahl ' + WAHL.map(v=>lbl[v]).join('') + '  ' + R.zustand + '  Stuerze ' + R.deaths);
  let vor = 0;
  R.splits.forEach(s => {
    console.log('   ' + s.tor.padEnd(16) + 'bis ' + String(s.t).padStart(6) + ' s' +
      '   Abschnitt ' + String((s.t - vor).toFixed(2)).padStart(6) + ' s' +
      '   Austritt Tempo ' + String(s.tempo).padStart(5) +
      '   Weg ' + String(s.weg).padStart(4) + ' m' +
      '   Schnitt ' + String(s.schnitt).padStart(5) +
      '   Spitze ' + String(s.spitze).padStart(5) +
      '   Luft ' + String(s.luft).padStart(4) +
      '   Land ' + String(s.land).padStart(3));
    vor = s.t;
  });
  if (R.tode && R.tode.length) { console.log('TODE:'); R.tode.forEach(t=>console.log('   '+t)); }
  await b.close();
})();
