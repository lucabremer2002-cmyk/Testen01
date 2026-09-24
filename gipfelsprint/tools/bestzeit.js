/* Funktioniert die Wiederspiel-Schleife wirklich?

   Bestzeit, Geist und Live-Rueckstand sind die drei Systeme, die einen
   zum naechsten Versuch ziehen. Sie waren implementiert, aber nie
   nachgewiesen. Dieser Test faehrt zwei Laeufe: der erste legt die
   Bestzeit an, der zweite muss den Geist sehen und einen laufenden
   Rueckstand anzeigen. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  /* Ohne Angabe die LANGE Strecke. Diese Werkzeuge sind fuer sie
     geschrieben (sieben Gabeln, acht Abschnitte). Seit die Kurzstrecke
     Vorgabe des Spiels ist, massen sie sonst stillschweigend die falsche
     Strecke - routen-alle.js rechnete 96 Kombinationen auf einem Level
     mit zwei Gabeln aus und meldete trotzdem "sauber". */
  const SATZ = process.env.MR_SATZ || 'lang';
  if (SATZ) await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch (e) {} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });

  const R = await page.evaluate(() => {
    const g = window.GAME, P = window.MR.physics, hit = P.makeHit(), F = 1/120;
    g.render = function(){};
    const lvl = g.level, sp = lvl.spine;
    function fahre(bremse) {
      g.startRun(true); g.state = 'run'; g.runTime = 0;
      const p = g.player;
      const cmd = { wishX:0, wishZ:0, slide:false, dash:false, jumpPressed:false, jumpHeld:false };
      let wi = 1, tode = 0;
      const deltas = [];
      for (let i = 0; i < 120*130; i++) {
        const tgt = sp[Math.min(wi, sp.length-1)];
        const dx=tgt[0]-p.x, dz=tgt[2]-p.z, d2=Math.hypot(dx,dz);
        if (d2<5 && Math.abs(tgt[1]-p.y)<7) { if (wi<sp.length-1) wi++; }
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
        /* `bremse` macht den zweiten Lauf absichtlich langsamer, damit ein
           Rueckstand entstehen MUSS - sonst sagt ein Wert nahe null nichts. */
        cmd.jumpHeld = d2 > p.speed * (bremse ? 0.80 : 0.52);
        if(p.grounded&&(!ahead||(tgt[1]-p.y>1.5&&d2<10)||(p.speed<5&&i>60))){cmd.jumpPressed=true; if(d2>18&&p.dashCharge>0&&!bremse)cmd.dash=true;}
        else if(!p.grounded&&p.coyote<=0&&p.wallCoyote>0&&!below){cmd.jumpPressed=true;}
        else if(!p.grounded&&p.vy<-1&&!below&&p.jumps>0&&tgt[1]>p.y-3){cmd.jumpPressed=true;}
        else if(!p.grounded&&p.vy<-5&&!below&&p.jumps===0&&p.dashCharge>0&&!bremse)cmd.dash=true;
        g.runTime += F;
        g.fixedStep(F, cmd);
        g.updateVisuals ? g.updateVisuals(F) : 0;
        /* Der Rueckstand wird in der Bildschleife gepflegt; hier von Hand. */
        if (g.ghostPlay && i % 24 === 0) {
          const near = g.ghostPlay.nearestTimeTo(p.x, p.z, g.runTime);
          if (near && near.dist < 22) deltas.push(+(g.runTime - near.time).toFixed(2));
        }
        if (g.state === 'finish') break;
        if (g.state !== 'run') { tode++; if (tode > 4) break; g.startRun(true); g.state='run'; wi=1; }
      }
      return { zeit:+g.runTime.toFixed(2), fertig:g.state==='finish', tode, deltas };
    }
    const a = fahre(false);
    const hatRekord = !!(g.record && g.record.ghost);
    const bestVorher = (g.store.best && g.store.best.time) || null;
    const c = fahre(true);
    return { lauf1:a, rekordAngelegt:hatRekord, bestzeit:bestVorher,
             lauf2:c, geistDa: !!g.ghostPlay };
  });

  console.log('Lauf 1 (Bestzeit anlegen): ' + R.lauf1.zeit + ' s, im Ziel: ' + R.lauf1.fertig);
  console.log('  Bestzeit gespeichert:    ' + (R.bestzeit ? R.bestzeit.toFixed(2) + ' s' : 'NEIN'));
  console.log('  Geistaufzeichnung da:    ' + (R.rekordAngelegt ? 'ja' : 'NEIN'));
  console.log('Lauf 2 (absichtlich langsamer): ' + R.lauf2.zeit + ' s');
  console.log('  Geist geladen:           ' + (R.geistDa ? 'ja' : 'NEIN'));
  const d = R.lauf2.deltas;
  console.log('  Rueckstand-Messpunkte:   ' + d.length);
  if (d.length) {
    console.log('  Verlauf: ' + d.filter((_,i)=>i%Math.max(1,Math.floor(d.length/8))===0).join('  '));
    console.log('  von ' + d[0] + ' s bis ' + d[d.length-1] + ' s');
  }
  const ok = R.bestzeit && R.rekordAngelegt && R.geistDa && d.length > 5 && d[d.length-1] > d[0];
  console.log('\n' + (ok ? 'Wiederspiel-Schleife arbeitet: Bestzeit, Geist und laufender Rueckstand.'
                         : 'FEHLER in der Wiederspiel-Schleife - siehe oben.'));
  await b.close();
})();
