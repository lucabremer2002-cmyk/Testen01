/* Prüfstand für den Jet-Schub.

   Die Werte sollen nicht geraten sein. Gemessen wird, was den Spieler
   betrifft: wie hoch komme ich, wie weit komme ich, wie lange reicht der
   Tank, und wie lange muss ich warten. Jede Zeile ist ein Wertesatz.

   Aufruf: node tools/jet.js            (aktuelle Werte)
           node tools/jet.js sweep      (Wertetabelle) */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const SWEEP = [
  /* Name                       H    V   MAX  STEIG  VERB  FUELL */
  ['aktuell',                null, null, null, null, null, null],
  ['Br 2,0 / N 0,58',          95,  142,   52,   34,  1.60, 1.00, 0.58, 2.0],
  ['Br 2,0 / N 0,40',          95,  142,   52,   34,  1.60, 1.00, 0.40, 2.0],
  ['Br 1,4 / N 0,40',          95,  142,   52,   34,  1.60, 1.00, 0.40, 1.4],
  ['Br 1,4 / N 0,25',          95,  142,   52,   34,  1.60, 1.00, 0.25, 1.4]
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz','lang'); } catch(e){} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });

  const saetze = process.argv[2] === 'sweep' ? SWEEP : [SWEEP[0]];
  const R = await page.evaluate((saetze) => {
    const g = window.GAME, P = window.MR.physics, F = 1/120, p = g.player;
    const T = window.MR.player.TUNING;
    g.render = function(){};
    const orig = { H:T.JET_SCHUB_H, V:T.JET_SCHUB_V, M:T.JET_MAX, S:T.JET_STEIG_MAX,
                   VB:T.TANK_VERBRAUCH, NF:T.TANK_NACHFUELL };
    function welt(){ const W = new P.World();
      W.add({ x:0, y:-1, z:0, hx:900, hy:1, hz:900, yaw:0, cos:1, sin:0, active:true });
      g.level.world = W; p.spawnAt({ x:0, y:0.2, z:0, yaw:0 }); p.grounded = true; }
    const leer = { wishX:0, wishZ:1, slide:false, jet:false, jumpPressed:false, jumpHeld:false };
    function lauf(n, o){ for (let i=0;i<n;i++) p.step(F, Object.assign({}, leer, o(i))); }

    const zeilen = [];
    const origRest = T.JET_V_NEIGUNG, origQB = T.JET_QUERBREMSE;
    for (const [name,H,V,M,S,VB,NF,REST,QB] of saetze) {
      T.JET_V_NEIGUNG = origRest; T.JET_QUERBREMSE = origQB;
      if (H !== null) { T.JET_SCHUB_H=H; T.JET_SCHUB_V=V; T.JET_MAX=M; T.JET_STEIG_MAX=S;
                        T.TANK_VERBRAUCH=VB; T.TANK_NACHFUELL=NF;
                      }
      if (typeof REST === 'number') T.JET_V_NEIGUNG = REST;
      if (typeof QB === 'number') T.JET_QUERBREMSE = QB;
      else { T.JET_SCHUB_H=orig.H; T.JET_SCHUB_V=orig.V; T.JET_MAX=orig.M;
             T.JET_STEIG_MAX=orig.S; T.TANK_VERBRAUCH=orig.VB; T.TANK_NACHFUELL=orig.NF; }

      /* Tankdauer */
      welt(); let tv=0; while (p.tank > 0 && tv < 900) { p.step(F, Object.assign({}, leer, {jet:true})); tv++; }
      const dauer = tv/120;
      /* Nachfuellen */
      let nf=0; while (p.tank < 0.999 && nf < 1200) { p.step(F, leer); nf++; }
      const fuellen = nf/120;

      /* Steighoehe. Gemessen wird der SCHEITELPUNKT, nicht der Endstand -
         nach dem Schub faellt man wieder, und der Endstand sagte deshalb
         "minus 0,3 m" fuer einen Jet, der in Wahrheit steigt.
         Zwei Faelle getrennt, weil sie das Spiel unterschiedlich nutzen:
         kurz antippen (Auftrieb) gegen ganzen Tank (Vortrieb). */
      function steighoehe(haltedauer) {
        welt();
        const yy = p.y; let gipfel = 0;
        const n = Math.round(haltedauer * 120);
        for (let i = 0; i < 480; i++) {
          p.step(F, { wishX:0, wishZ:0, slide:false, jet: i < n, jumpPressed:false, jumpHeld:false });
          if (p.y - yy > gipfel) gipfel = p.y - yy;
          if (p.grounded && i > n + 4) break;
        }
        return gipfel;
      }
      const steigTipp = steighoehe(0.35);
      const steigGipfel = steighoehe(dauer);

      /* Sprungweite: Anlauf, Sprung, Jet bis der Tank leer ist */
      function weite(mitJet) {
        welt(); lauf(240, () => ({}));
        const z0 = p.z;
        p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
        for (let i=0;i<900;i++) {
          p.step(F, Object.assign({}, leer, { jet: mitJet, jumpHeld: i<40 }));
          if (p.grounded && i>10) break;
        }
        return p.z - z0;
      }
      const wOhne = weite(false), wMit = weite(true);

      /* Schraegflug: derselbe Schub, nur das Steuerkreuz aendert sich.
         Wenn die Vektorisierung wirkt, muss diese Reihe eine Kurve sein -
         viel Hoehe / wenig Weite bis wenig Hoehe / viel Weite - und nicht
         vier mal dasselbe. */
      const winkel = [0, 0.35, 0.7, 1].map(function (stick) {
        welt(); lauf(240, function(){ return {}; });
        const y0 = p.y, z0 = p.z; let gipfel = 0;
        p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
        for (let i=0;i<900;i++) {
          p.step(F, { wishX:0, wishZ:stick, slide:false, jet:true, jumpPressed:false, jumpHeld:i<40 });
          if (p.y - y0 > gipfel) gipfel = p.y - y0;
          if (p.grounded && i>10) break;
        }
        return { stick:stick, h:+gipfel.toFixed(1), w:+(p.z-z0).toFixed(0) };
      });

      /* Was kostet ein Steigflug an TEMPO? In einem senkrechten Level
         steigt man dauernd - wenn jede Stufe das Tempo auf null bringt,
         laeuft man das ganze Level im Schritt. */
      welt(); lauf(240, function(){ return {}; });
      const vAnlauf = p.speed;
      p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
      for (let i=0;i<Math.round(dauer*120);i++)
        p.step(F, { wishX:0, wishZ:0, slide:false, jet:true, jumpPressed:false, jumpHeld:i<40 });
      const vNachSteig = p.speed;

      /* Umschalten waehrend des Schubs.

         Am Keyboard gibt es kein halbes Steuerkreuz - nur 0 oder 1. Die
         Zwischenwerte der Schraegflug-Reihe sind dort also nicht
         erreichbar. Was ein Tastaturspieler stattdessen tun kann: die
         Richtung WAEHREND der Tankfuellung wechseln. Ob das etwas bringt
         und was, muss gemessen werden - sonst baue ich ein Level um eine
         Technik herum, die es gar nicht gibt. */
      const muster = [
        ['nur hoch',  function(t){ return 0; }],
        ['nur vor',   function(t){ return 1; }],
        ['hoch->vor', function(t){ return t < 0.5 ? 0 : 1; }],
        ['vor->hoch', function(t){ return t < 0.5 ? 1 : 0; }],
        ['wechselnd', function(t){ return Math.floor(t * 6) % 2; }]
      ].map(function (mm) {
        welt(); lauf(240, function(){ return {}; });
        const y0 = p.y, z0 = p.z; let gipfel = 0;
        const n = Math.round(dauer * 120);
        p.step(F, Object.assign({}, leer, { jumpPressed:true, jumpHeld:true }));
        for (let i=0;i<900;i++) {
          const stick = i < n ? mm[1](i / n) : 0;
          p.step(F, { wishX:0, wishZ:stick, slide:false, jet: i < n,
                      jumpPressed:false, jumpHeld:i<40 });
          if (p.y - y0 > gipfel) gipfel = p.y - y0;
          if (p.grounded && i>10) break;
        }
        return { name: mm[0], h:+gipfel.toFixed(1), w:+(p.z-z0).toFixed(0) };
      });

      /* Tempo nach 0,5 s Schub aus dem Lauf */
      welt(); lauf(240, () => ({}));
      const vVor = p.speed;
      lauf(60, () => ({ jet:true }));
      const vNach = p.speed;

      zeilen.push({ name, dauer:+dauer.toFixed(2), fuellen:+fuellen.toFixed(2),
                    tipp:+steigTipp.toFixed(1),
                    steig:+steigGipfel.toFixed(1), wOhne:+wOhne.toFixed(0), wMit:+wMit.toFixed(0),
                    vVor:+vVor.toFixed(0), vNach:+vNach.toFixed(0), winkel:winkel, muster:muster,
                    vAnlauf:+vAnlauf.toFixed(0), vSteig:+vNachSteig.toFixed(0) });
    }
    T.JET_V_NEIGUNG = origRest; T.JET_QUERBREMSE = origQB;
    T.JET_SCHUB_H=orig.H; T.JET_SCHUB_V=orig.V; T.JET_MAX=orig.M;
    T.JET_STEIG_MAX=orig.S; T.TANK_VERBRAUCH=orig.VB; T.TANK_NACHFUELL=orig.NF;
    return zeilen;
  }, saetze);

  console.log('Wertesatz'.padEnd(17) + 'Tank'.padStart(6) + 'Fuell'.padStart(7) +
              'Tipp'.padStart(7) + 'Steig'.padStart(7) + 'Weite-'.padStart(8) +
              'Weite+'.padStart(8) + 'Tempo'.padStart(10));
  console.log(''.padEnd(17) + 's'.padStart(6) + 's'.padStart(7) +
              '0,35s'.padStart(7) + 'voll'.padStart(7) + 'm'.padStart(8) + 'm'.padStart(8));
  console.log('-'.repeat(78));
  R.forEach(r => console.log(
    r.name.padEnd(17) + String(r.dauer).padStart(6) + String(r.fuellen).padStart(7) +
    String(r.tipp).padStart(7) + String(r.steig).padStart(7) + String(r.wOhne).padStart(8) +
    String(r.wMit).padStart(8) + String(r.vVor + '->' + r.vNach).padStart(10)));
  console.log('\nSchraegflug - gleicher Schub, nur das Steuerkreuz aendert sich:');
  console.log('Wertesatz'.padEnd(17) + [0,0.35,0.7,1].map(function(v){
    return ('Stick ' + v.toFixed(2)).padStart(16); }).join(''));
  R.forEach(function(r){ console.log(r.name.padEnd(17) + r.winkel.map(function(w){
    return (w.h.toFixed(1) + ' hoch /' + String(w.w).padStart(4) + ' weit').padStart(16); }).join('')); });
  console.log('\nTempo nach einem vollen Steigflug (Anlauf -> danach):');
  R.forEach(function(r){ console.log('  ' + r.name.padEnd(18) + r.vAnlauf + ' -> ' + r.vSteig +
    '   (' + Math.round(r.vSteig / Math.max(1, r.vAnlauf) * 100) + ' % behalten)'); });
  console.log('\nUmschalten waehrend des Schubs (am Keyboard spielbar):');
  R.forEach(function(r){ console.log('  ' + r.name);
    r.muster.forEach(function(m){ console.log('    ' + m.name.padEnd(12) +
      String(m.h.toFixed(1)).padStart(6) + ' m hoch  ' + String(m.w).padStart(5) + ' m weit'); }); });
  await b.close();
})();
