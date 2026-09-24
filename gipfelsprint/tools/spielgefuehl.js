/* Spielgefuehl statt Stoppuhr.

   Ein gruener Selbsttest sagt, dass nichts kaputt ist. Er sagt nichts
   darueber, ob der Lauf Spass macht. Dieses Werkzeug misst die Groessen,
   die dafuer zaehlen, und druckt den Lauf als Zeitleiste aus - eine Zeile
   je halbe Sekunde, damit leere Strecken sichtbar werden, statt sich in
   einem Mittelwert zu verstecken.

   Aufruf: node tools/spielgefuehl.js [Routenwahl]   (Vorgabe 0000000) */
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

  const R = await page.evaluate((WAHL) => {
    const g = window.GAME, P = window.MR.physics, hit = P.makeHit(), F = 1/120;
    g.render = function(){};
    const lvl = g.level, sp = lvl.spine;
    function naechster(pt){let bi=0,bd=1e18;for(let i=0;i<sp.length;i++){const d=(sp[i][0]-pt.x)**2+(sp[i][2]-pt.z)**2;if(d<bd){bd=d;bi=i;}}return bi;}
    const grenzen = lvl.gates.map(naechster);
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
    const cmd={wishX:0,wishZ:0,slide:false,dash:false,jumpPressed:false,jumpHeld:false};
    let wi=1, tode=0, gesehen=0;
    const takt = [];                 /* je halbe Sekunde ein Eintrag */
    let fenster = null;
    const gemZeiten = [], torZeiten = [];
    let dashSummeMax = 0, n = 0;
    const histTempo = [], bremsungen = [];
    let kursAlt = null;

    /* `lenk` ist die Kursaenderung in Grad je Fenster.

       Diese Groesse fehlte, und ihr Fehlen hat mich in die Irre gefuehrt:
       das Werkzeug zaehlte nur Spruenge und Dashes, also galt ein Slalom
       bei Tempo 40 als genauso leer wie ein gerader Korridor. Lenken ist
       aber eine Handlung - und auf einem sicheren Weg ist es sogar die
       einzige, die Tempo kostet statt es zu schenken. */
    function neuesFenster(t){ return { t: t, ereignisse: [], tempoMin: 1e9, tempoMax: 0, luft: 0, n: 0,
                                       eingaben: 0, dashVoll: 0, lenk: 0 }; }
    fenster = neuesFenster(0);

    for (let i=0;i<120*150;i++){
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

      if (cmd.jumpPressed || cmd.dash) fenster.eingaben++;
      g.runTime += F;
      g.fixedStep(F, cmd);
      /* fixedStep leert p.events zu Beginn und fuellt sie waehrend des
         Schritts - danach steht dort genau, was in diesem Schritt
         passiert ist. Ein Rueckgabewert existiert nicht; ihn abzufragen
         lieferte stillschweigend eine leere Liste, und die Zeitleiste sah
         aus, als passiere im ganzen Lauf nichts. */
      const evs = p.events || [];

      /* Vollbremsungen: ein Tempoverlust von mehr als 40 % in einer
         Zehntelsekunde, ohne dass der Spieler gebremst haette. Das ist
         das, was sich beim Spielen nach "haengengeblieben" anfuehlt -
         eine Flanke, eine Kante, ein Pfosten. Ein gruener Selbsttest
         sieht davon nichts. */
      histTempo.push(p.speed); if (histTempo.length > 13) histTempo.shift();
      if (histTempo.length === 13) {
        const alt = histTempo[0], neu = histTempo[12];
        if (alt > 12 && neu < alt * 0.6 && p.grounded)
          bremsungen.push({ t:+g.runTime.toFixed(2), von:+alt.toFixed(0), auf:+neu.toFixed(0),
                            x:+p.x.toFixed(0), y:+p.y.toFixed(0), z:+p.z.toFixed(0) });
      }
      if (p.speed > 3) {
        const kurs = Math.atan2(p.vx, p.vz);
        if (kursAlt !== null) {
          let d = kurs - kursAlt;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          fenster.lenk += Math.abs(d) * 180 / Math.PI;
        }
        kursAlt = kurs;
      }
      fenster.n++; n++;
      if (!p.grounded) fenster.luft++;
      if (p.speed < fenster.tempoMin) fenster.tempoMin = p.speed;
      if (p.speed > fenster.tempoMax) fenster.tempoMax = p.speed;
      if (p.dashCharge >= 3) fenster.dashVoll++;
      dashSummeMax += (p.dashCharge >= 3) ? 1 : 0;
      if (Array.isArray(evs)) for (const e of evs) if (['jump','doublejump','dash','walljump','slideland','bounce','boost'].indexOf(e) >= 0) fenster.ereignisse.push(e);

      let offen=0; for(let k=0;k<lvl.gates.length;k++) if(lvl.gates[k].passed) offen++;
      if (offen > gesehen) { gesehen = offen; torZeiten.push({ t:+g.runTime.toFixed(2), name: lvl.gates[gesehen-1].name }); fenster.ereignisse.push('TOR'); }

      if (g.runTime - fenster.t >= 0.5) { takt.push(fenster); fenster = neuesFenster(g.runTime); }
      if (g.state==='finish') break;
      if (g.state!=='run'){ tode++; if(tode>6) break; g.startRun(true); g.state='run'; wi=1; }
    }
    takt.push(fenster);
    return { zustand:g.state, tode, zeit:+g.runTime.toFixed(2), takt, torZeiten, bremsungen,
             dashVollAnteil: +(dashSummeMax/Math.max(1,n)).toFixed(2), kristalle: g.gems, kristalleGesamt: lvl.gemTotal || 0 };
  }, WAHL);

  const KUERZEL = { jump:'S', doublejump:'D', dash:'>', walljump:'W', slideland:'L', bounce:'B', boost:'T', TOR:'|' };
  console.log('Routenwahl ' + WAHL.join('') + '   ' + R.zustand + '   ' + R.zeit + ' s   Stuerze ' + R.tode +
              '   Kristalle ' + R.kristalle);
  console.log('');
  console.log('  Zeit   Tempo        Luft  Kurs  Handlungen');
  let leerLauf = 0, leerMax = 0, leerStart = 0, leerBesteStart = 0, leerN = 0;
  R.takt.forEach(f => {
    const ev = f.ereignisse.map(e => KUERZEL[e] || '?').join('');
    const bar = '#'.repeat(Math.round(f.tempoMax / 3));
    const leer = f.ereignisse.length === 0 && f.lenk < 6;
    if (leer) { if (leerLauf === 0) leerStart = f.t; leerLauf += 0.5; leerN += 0.5;
                if (leerLauf > leerMax) { leerMax = leerLauf; leerBesteStart = leerStart; } }
    else leerLauf = 0;
    console.log('  ' + f.t.toFixed(1).padStart(5) + '  ' +
      (f.tempoMin===1e9?0:f.tempoMin).toFixed(0).padStart(3) + '-' + f.tempoMax.toFixed(0).padStart(3) + ' ' +
      bar.padEnd(16) + ' ' + (f.luft/Math.max(1,f.n)).toFixed(2) +
      String(f.lenk.toFixed(0) +( '\u00b0')).padStart(6) + '  ' +
      (ev || (leer ? '.....  LEER' : (f.lenk >= 6 ? 'lenken' : ''))));
  });
  console.log('');
  console.log('Laengste Strecke ohne Handlung: ' + leerMax.toFixed(1) + ' s (ab ' + leerBesteStart.toFixed(1) + ' s)');
  console.log('  (Handlung = Sprung, Dash, Landung ODER mehr als 6 Grad Kursaenderung je halbe Sekunde)');
  console.log('Anteil Leerlauf am ganzen Lauf: ' + (leerN / R.zeit * 100).toFixed(0) + ' %');
  console.log('Dash-Vorrat voll (3/3):         ' + (R.dashVollAnteil*100).toFixed(0) + ' % der Zeit');
  /* Aufeinanderfolgende Meldungen gehoeren zum selben Ereignis. */
  const gefiltert = R.bremsungen.filter((b,i,a) => i === 0 || b.t - a[i-1].t > 0.4);
  console.log('Vollbremsungen (>40 % Verlust):  ' + gefiltert.length);
  gefiltert.forEach(b => console.log('    bei ' + b.t.toFixed(1) + ' s   Tempo ' + b.von + ' -> ' + b.auf +
    '   Ort ' + b.x + ',' + b.y + ',' + b.z));
  console.log('');
  console.log('Legende  S Sprung  D Doppelsprung  > Dash  W Wandsprung  L Rutschlandung  T Tempofeld  | Tor');
  await b.close();
})();
