/* Jede gueltige Routenkombination einmal durchfahren.
   Die Gabel-fuer-Gabel-Messung haelt alles andere sicher - genau deshalb
   kann sie eine Stelle uebersehen, die nur bei hohem Eingangstempo
   versagt. Gemessen: die Dash-Kette der grossen Gabel war ueber den
   sicheren Anlauf passierbar und ueber den schnellen nicht. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
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
  const ZW = [[0,1],[0,1],[0,1,2],[0],[0,1],[0,1],[0,2]];
  const alle = [];
  (function rek(i, acc) {
    if (i === ZW.length) { alle.push(acc.slice()); return; }
    for (const v of ZW[i]) { acc.push(v); rek(i+1, acc); acc.pop(); }
  })(0, []);
  const R = await page.evaluate((alle) => {
    const g = window.GAME, P = window.MR.physics, hit = P.makeHit(), F = 1/120;
    g.render = function(){};
    const lvl = g.level, sp = lvl.spine;
    function naechster(pt){let bi=0,bd=1e18;for(let i=0;i<sp.length;i++){const d=(sp[i][0]-pt.x)**2+(sp[i][2]-pt.z)**2;if(d<bd){bd=d;bi=i;}}return bi;}
    const grenzen = lvl.gates.map(naechster);
    const out = [];
    for (const WAHL of alle) {
      const wps = []; let from = 0;
      for (let k = 0; k <= lvl.gates.length; k++) {
        const to = k < grenzen.length ? grenzen[k] : sp.length - 1;
        const alt = (WAHL[k] && lvl.routePaths[k+':'+WAHL[k]]) || null;
        if (alt) { wps.push(k===0?[lvl.start.x,lvl.start.y,lvl.start.z]:[lvl.gates[k-1].x,lvl.gates[k-1].y,lvl.gates[k-1].z]);
                   for (const w of alt) wps.push(w); }
        else { for (let i=from;i<=to;i++) wps.push(sp[i]); }
        if (k < grenzen.length) wps.push([lvl.gates[k].x,lvl.gates[k].y,lvl.gates[k].z]);
        from = to + 1;
      }
      g.resetRun(true); g.state='run'; g.runTime=0;
      const st = window.PILOT.neu(g);
      let fest = false, fertig = false;
      for (let i=0;i<120*130;i++){
        g.runTime += F;
        g.fixedStep(F, window.PILOT.schritt(g, st, wps));
        const z = window.PILOT.nachlauf(g, st, F);
        if (z === 'fertig') { fertig = true; break; }
        if (z === 'tot') break;
        if (z === 'fest') { fest = true; break; }
      }
      out.push({ w: WAHL.join(''), ok: g.state==='finish', t: +g.runTime.toFixed(2), tode: st.tode, fest });
    }
    return out;
  }, alle);
  const schlecht = R.filter(r => !r.ok || r.tode > 0 || r.fest);
  const gut = R.filter(r => r.ok && !r.tode && !r.fest).sort((a,x)=>a.t-x.t);
  const MED = [['Platin',51.5],['Gold',54.1],['Silber',62.8],['Bronze',82.4]];
  const zaehl = {};
  gut.forEach(r => { const m = MED.find(m => r.t <= m[1]); const k = m ? m[0] : 'keine'; zaehl[k] = (zaehl[k]||0) + 1; });
  console.log('\nVerteilung der 96 Kombinationen:');
  [50,52,54,56,58,60].forEach(t => console.log('   unter ' + t + ' s: ' +
    String(gut.filter(r => r.t <= t).length).padStart(3) + ' von ' + gut.length));
  console.log('\nMedaille je Kombination (kumulativ, Testpilot):');
  MED.forEach(m => console.log('   ' + m[0].padEnd(8) + 'bis ' + m[1].toFixed(1) + ' s   ' +
    String(gut.filter(r => r.t <= m[1]).length).padStart(3) + ' von ' + gut.length));
  console.log('Kombinationen: ' + R.length + '   sauber: ' + gut.length + '   fehlerhaft: ' + schlecht.length);
  if (schlecht.length) { console.log('\nFEHLERHAFT:'); schlecht.forEach(r=>console.log('   '+r.w+'  '+(r.fest?'FESTGEFAHREN':'Stuerze '+r.tode)+'  t='+r.t)); }
  console.log('\nSchnellste 5:'); gut.slice(0,5).forEach(r=>console.log('   '+r.w+'  '+r.t.toFixed(2)+' s'));
  console.log('Langsamste 3:'); gut.slice(-3).forEach(r=>console.log('   '+r.w+'  '+r.t.toFixed(2)+' s'));
  await b.close();
})();
