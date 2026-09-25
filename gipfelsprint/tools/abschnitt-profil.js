/* Zeit und Austrittstempo je Abschnitt, fuer eine vorgegebene Routenwahl.
   Ein Lauf genuegt: die Simulation ist nachweislich deterministisch. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const WAHL = (process.argv[2] || '0000000').split('').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  /* Welcher Abschnittssatz gemessen wird - MR_SATZ=sturz waehlt die
     Kurzstrecke. Die Wahl liegt im localStorage, also vor dem Laden setzen. */
  /* Ohne Angabe die LANGE Strecke. Diese Werkzeuge sind fuer sie
     geschrieben (sieben Gabeln, acht Abschnitte). Seit die Kurzstrecke
     Vorgabe des Spiels ist, massen sie sonst stillschweigend die falsche
     Strecke - routen-alle.js rechnete 96 Kombinationen auf einem Level
     mit zwei Gabeln aus und meldete trotzdem "sauber". */
  const SATZ = process.env.MR_SATZ || 'lang';
  if (SATZ) await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch (e) {} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  /* Der Testpilot kommt aus tools/pilot.js - einmal geschrieben, von
     allen Werkzeugen benutzt. */
  await page.addScriptTag({ path: require('path').join(__dirname, 'pilot.js') });
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
    const st = window.PILOT.neu(g);
    const splits = [];
    let gesehen = 0;
    let accDist = 0, accAir = 0, accN = 0, accSum = 0, accMax = 0, accLand = 0;
    let wasGround = true;
    let pxo = p.x, pyo = p.y, pzo = p.z;

    for (let i = 0; i < 120 * 200; i++) {
      const cmd = window.PILOT.schritt(g, st, wps);
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
                      tempo: +p.speed.toFixed(1), tank: +p.tank.toFixed(2), kristalle: g.gems,
                      weg: +accDist.toFixed(0), schnitt: +(accSum/Math.max(1,accN)).toFixed(1),
                      spitze: +accMax.toFixed(1), luft: +(accAir/Math.max(1,accN)).toFixed(2),
                      land: accLand });
        accDist=0; accAir=0; accN=0; accSum=0; accMax=0; accLand=0;
      }
      const wp = wps[Math.min(st.wi, wps.length-1)];
      const ort = p.x.toFixed(0) + ',' + p.y.toFixed(0) + ',' + p.z.toFixed(0) +
                  '  wp' + st.wi + ' -> ' + JSON.stringify(wp.map(v=>+v.toFixed(0)));
      const z = window.PILOT.nachlauf(g, st, F);
      if (z === 'sturz') {
        tode.push('t=' + g.runTime.toFixed(2) + '  pos ' + ort);
        g.runTime = splits.length ? splits[splits.length-1].t : 0;
      } else if (z === 'fest') {
        tode.push('FEST t=' + g.runTime.toFixed(2) + '  pos ' + ort +
                  '  v=' + p.speed.toFixed(1) + '  grounded=' + p.grounded); break;
      } else if (z === 'fertig' || z === 'tot') break;
    }
    splits.push({ tor: 'ZIEL', t: +g.runTime.toFixed(2), tempo: +p.speed.toFixed(1),
                  tank: +p.tank.toFixed(2), kristalle: g.gems,
                  weg: +accDist.toFixed(0), schnitt: +(accSum/Math.max(1,accN)).toFixed(1),
                  spitze: +accMax.toFixed(1), luft: +(accAir/Math.max(1,accN)).toFixed(2),
                  land: accLand });
    return { zustand: g.state, deaths: st.tode, splits, tode };
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
