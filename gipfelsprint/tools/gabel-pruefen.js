/* Die grosse Gabel unter jedem moeglichen Anlauf.

   Die Simulation ist deterministisch (siehe selftest.js, Abweichung 0 m),
   ein Lauf zweimal zu fahren liefert also zweimal dieselbe Zahl. Was sich
   wirklich aendert, ist das Tempo, mit dem man hereinkommt: ueber den
   riskanten Auftakt und die schnelle Sprungkette sind es 46 statt 17.
   Eine Hierarchie, die nur bei einem Anlauf stimmt, ist keine. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });

  const ANLAEUFE = [[0,0],[2,0],[0,1],[2,1]];
  const ZWEIGE = [0,1,2];
  const wahlen = [];
  for (const [a,c] of ANLAEUFE) for (const z of ZWEIGE) wahlen.push([a,c,z]);

  const R = await page.evaluate((wahlen) => {
    const g = window.GAME, P = window.MR.physics, hit = P.makeHit(), F = 1/120;
    g.render = function(){};
    const lvl = g.level, sp = lvl.spine;
    function naechster(pt){let bi=0,bd=1e18;for(let i=0;i<sp.length;i++){const d=(sp[i][0]-pt.x)**2+(sp[i][2]-pt.z)**2;if(d<bd){bd=d;bi=i;}}return bi;}
    const grenzen = lvl.gates.map(naechster);
    const out = [];
    for (const w of wahlen) {
      const WAHL = [w[0], w[1], w[2], 0, 0, 0, 0];
      const wps = []; let from = 0;
      for (let k = 0; k <= lvl.gates.length; k++) {
        const to = k < grenzen.length ? grenzen[k] : sp.length - 1;
        const alt = (WAHL[k] && lvl.routePaths[k+':'+WAHL[k]]) || null;
        if (alt) { wps.push(k===0?[lvl.start.x,lvl.start.y,lvl.start.z]:[lvl.gates[k-1].x,lvl.gates[k-1].y,lvl.gates[k-1].z]);
                   for (const q of alt) wps.push(q); }
        else { for (let i=from;i<=to;i++) wps.push(sp[i]); }
        if (k < grenzen.length) wps.push([lvl.gates[k].x,lvl.gates[k].y,lvl.gates[k].z]);
        from = to + 1;
      }
      g.resetRun(true); g.state='run'; g.runTime=0;
      const p = g.player;
      let wi=1, tode=0, gesehen=0, tGabelAn=null, tGabelAus=null, eintritt=null, austritt=null, luftN=0, n=0;
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
        if (tGabelAn !== null && tGabelAus === null) { n++; if(!p.grounded) luftN++; }
        let offen=0; for(let k=0;k<lvl.gates.length;k++) if(lvl.gates[k].passed) offen++;
        if (offen > gesehen) {
          gesehen = offen;
          if (gesehen === 2) { tGabelAn = g.runTime; eintritt = p.speed; }
          if (gesehen === 3) { tGabelAus = g.runTime; austritt = p.speed; }
        }
        if(g.state==='finish') break;
        if(g.state!=='run'){ tode++; if(tode>6) break; g.startRun(true); g.state='run'; wi=1; }
      }
      out.push({ anlauf: w[0]+''+w[1], zweig: w[2], tode,
                 t: (tGabelAn!==null&&tGabelAus!==null) ? +(tGabelAus-tGabelAn).toFixed(2) : null,
                 ein: eintritt!==null?+eintritt.toFixed(1):null,
                 aus: austritt!==null?+austritt.toFixed(1):null,
                 luft: n? +(luftN/n).toFixed(2) : null });
    }
    return out;
  }, wahlen);

  const NAME = ['SICHER','SCHNELL','IRRE'];
  const ANL = { '00': 'sicher / sicher', '20': 'irre / sicher', '01': 'sicher / schnell', '20x': '', '21': 'irre / schnell' };
  console.log('Die grosse Gabel, je Anlauf gemessen\n');
  console.log('Anlauf (Auftakt/Sprungkette)   Zweig      Zeit   Anteil   Eintritt  Austritt   Luft  Stuerze');
  console.log('-'.repeat(92));
  const proAnlauf = {};
  for (const r of R) (proAnlauf[r.anlauf] = proAnlauf[r.anlauf] || []).push(r);
  let alleOk = true;
  for (const k of Object.keys(proAnlauf)) {
    const g = proAnlauf[k], basis = g.find(x => x.zweig === 0);
    for (const r of g) {
      const pct = (basis && basis.t && r.t) ? (r.t / basis.t * 100) : null;
      console.log('  ' + (ANL[k]||k).padEnd(28) + NAME[r.zweig].padEnd(9) +
        (r.t !== null ? r.t.toFixed(2) : '  --').padStart(6) + ' s ' +
        (pct !== null ? (pct.toFixed(1) + '%') : '--').padStart(8) +
        String(r.ein).padStart(10) + String(r.aus).padStart(10) +
        String(r.luft).padStart(7) + String(r.tode).padStart(8));
    }
    const s = g.find(x=>x.zweig===0), f = g.find(x=>x.zweig===1), i = g.find(x=>x.zweig===2);
    if (!(s.t > f.t && f.t > i.t)) { alleOk = false; console.log('     !! Reihenfolge verletzt'); }
    console.log('');
  }
  console.log(alleOk ? 'Reihenfolge SICHER > SCHNELL > IRRE gilt bei jedem Anlauf.'
                     : 'ACHTUNG: Reihenfolge stimmt nicht bei jedem Anlauf.');
  await b.close();
})();
