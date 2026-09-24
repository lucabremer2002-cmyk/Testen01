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
  const SATZ = process.env.MR_SATZ || '';
  if (SATZ) await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch (e) {} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
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
      const p = g.player;
      let wi=1, tode=0, stuck=0, lastZ=p.z, fest=false;
      const cmd={wishX:0,wishZ:0,slide:false,dash:false,jumpPressed:false,jumpHeld:false};
      for (let i=0;i<120*130;i++){
        const tgt=wps[Math.min(wi,wps.length-1)];
        const dx=tgt[0]-p.x, dz=tgt[2]-p.z, d2=Math.hypot(dx,dz);
        if(d2<5 && Math.abs(tgt[1]-p.y)<7){ if(wi<wps.length-1) wi++; }
        const ux=dx/(d2||1), uz=dz/(d2||1);
        const along=p.vx*ux+p.vz*uz;
        const latX=p.vx-ux*along, latZ=p.vz-uz*along;
        const lead=p.grounded?0.10:0.32;
        const aX=dx-latX*lead, aZ=dz-latZ*lead, aL=Math.hypot(aX,aZ)||1;
        cmd.wishX=aX/aL; cmd.wishZ=aZ/aL;
        const ahead=P.raycast(lvl.world,p.x+cmd.wishX*2.4,p.y-0.4,p.z+cmd.wishZ*2.4,0,-1,0,3.2,hit);
        const below=P.raycast(lvl.world,p.x,p.y-0.4,p.z,0,-1,0,4.0,hit);
        cmd.slide=(!p.grounded&&p.vy<-4)||(p.grounded&&p.speed>19);
        cmd.jumpPressed=false; cmd.dash=false;
        cmd.jumpHeld=d2>p.speed*0.52;
        if(p.grounded&&(!ahead||(tgt[1]-p.y>1.5&&d2<10)||(p.speed<5&&i>60))){cmd.jumpPressed=true; if(d2>18&&p.dashCharge>0)cmd.dash=true;}
        else if(!p.grounded&&p.coyote<=0&&p.wallCoyote>0&&!below){cmd.jumpPressed=true; if(d2>24&&p.dashCharge>0)cmd.dash=true;}
        else if(!p.grounded&&p.vy<-1&&!below&&p.jumps>0&&tgt[1]>p.y-3){cmd.jumpPressed=true;}
        else if(!p.grounded&&p.vy<-5&&!below&&p.jumps===0&&p.dashCharge>0)cmd.dash=true;
        g.runTime+=F; g.fixedStep(F,cmd);
        if(g.state==='finish') break;
        if(g.state!=='run'){ tode++; if(tode>6) break; g.startRun(true); g.state='run'; wi=1; }
        if(Math.abs(p.z-lastZ)<0.05) stuck++; else {stuck=0; lastZ=p.z;}
        if(stuck>120*10){ fest=true; break; }
      }
      out.push({ w: WAHL.join(''), ok: g.state==='finish', t: +g.runTime.toFixed(2), tode, fest });
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
