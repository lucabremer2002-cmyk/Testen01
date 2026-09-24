/* Wie schnell antwortet die Figur auf eine Taste?

   Das ist die erste Frage bei Priorität "Spielgefuehl" und war nie
   gemessen. Gemessen wird in Simulationsschritten (1/120 s) von der
   gedrueckten Taste bis zur ersten sichtbaren Wirkung - nicht bis zum
   Ende der Bewegung. Alles ueber drei Schritten (25 ms) faellt einem
   Spieler als Traegheit auf. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  const R = await page.evaluate(() => {
    const g = window.GAME, P = window.MR.physics, F = 1/120;
    g.render = function(){};
    const p = g.player;
    const out = [];
    function frischeWelt() {
      const W = new P.World();
      W.add({ x:0, y:-1, z:0, hx:600, hy:1, hz:600, yaw:0, cos:1, sin:0, active:true });
      g.level.world = W;
      p.spawnAt({ x:0, y:0.2, z:0, yaw:0 });
      p.grounded = true;
    }
    const leer = { wishX:0, wishZ:0, slide:false, dash:false, jumpPressed:false, jumpHeld:false };

    /* 1 Anlaufen aus dem Stand */
    frischeWelt();
    let n = 0;
    for (let i=0;i<240;i++){ p.step(F, { wishX:0, wishZ:1, slide:false, dash:false, jumpPressed:false, jumpHeld:true });
      if (p.speed > 0.5 && !n) n = i + 1;
      if (p.speed > 16.0) { out.push({ was:'Anlaufen bis Tempo 16', schritte:i+1, ms:+((i+1)/120*1000).toFixed(1) }); break; } }
    out.push({ was:'erste Bewegung', schritte:n, ms:+(n/120*1000).toFixed(1) });

    /* 2 Sprung: erster Schritt mit vy > 0 */
    frischeWelt();
    for (let i=0;i<60;i++) p.step(F, { wishX:0, wishZ:1, slide:false, dash:false, jumpPressed:false, jumpHeld:false });
    let js = 0;
    for (let i=0;i<40;i++){
      p.step(F, { wishX:0, wishZ:1, slide:false, dash:false, jumpPressed:i===0, jumpHeld:true });
      if (p.vy > 0.1) { js = i + 1; break; }
    }
    out.push({ was:'Sprung setzt ein', schritte:js, ms:+(js/120*1000).toFixed(1) });

    /* 3 Dash: erster Schritt mit deutlichem Tempozuwachs */
    frischeWelt();
    for (let i=0;i<60;i++) p.step(F, { wishX:0, wishZ:1, slide:false, dash:false, jumpPressed:false, jumpHeld:false });
    const vor = p.speed;
    let ds = 0;
    for (let i=0;i<40;i++){
      p.step(F, { wishX:0, wishZ:1, slide:false, dash:i===0, jumpPressed:false, jumpHeld:false });
      if (p.speed > vor + 2) { ds = i + 1; break; }
    }
    out.push({ was:'Dash setzt ein', schritte:ds, ms:+(ds/120*1000).toFixed(1) });

    /* 4 Richtungswechsel: von +z auf -z, bis die Bewegung kippt */
    frischeWelt();
    for (let i=0;i<240;i++) p.step(F, { wishX:0, wishZ:1, slide:false, dash:false, jumpPressed:false, jumpHeld:false });
    const vz0 = p.vz;
    let ws = 0, wsHalb = 0;
    for (let i=0;i<240;i++){
      p.step(F, { wishX:0, wishZ:-1, slide:false, dash:false, jumpPressed:false, jumpHeld:false });
      if (!wsHalb && p.vz < vz0 * 0.5) wsHalb = i + 1;
      if (p.vz < 0) { ws = i + 1; break; }
    }
    out.push({ was:'Wende: halbes Tempo', schritte:wsHalb, ms:+(wsHalb/120*1000).toFixed(1) });
    out.push({ was:'Wende: Richtung kippt', schritte:ws, ms:+(ws/120*1000).toFixed(1) });

    /* 5 Puffer und Nachfrist: wie frueh/spaet darf man druecken? */
    const T = window.MR.player.TUNING;
    /* Diese drei sind KEINE Verzoegerung, sondern Nachsicht: Fenster, in
       denen eine zu frueh oder zu spaet gedrueckte Taste trotzdem zaehlt.
       Gross ist hier gut. Sie stehen nur zur Vollstaendigkeit dabei und
       bekommen deshalb keine Warnmarkierung. */
    out.push({ was:'Sprungpuffer (vorher)', schritte:Math.round(T.BUFFER*120), ms:+(T.BUFFER*1000).toFixed(0), gut:true });
    out.push({ was:'Nachfrist Kante', schritte:Math.round(T.COYOTE*120), ms:+(T.COYOTE*1000).toFixed(0), gut:true });
    out.push({ was:'Nachfrist Wand', schritte:Math.round(T.WALL_COYOTE*120), ms:+(T.WALL_COYOTE*1000).toFixed(0), gut:true });
    return out;
  });
  console.log('Reaktionszeiten (1 Schritt = 8,3 ms)\n');
  R.forEach(r => console.log('  ' + r.was.padEnd(26) + String(r.schritte).padStart(4) + ' Schritte' +
    String(r.ms + ' ms').padStart(11) +
    (r.gut ? '   (Nachsicht, gross ist gut)' : (r.ms > 25 ? '   <-- spuerbar' : ''))));
  await b.close();
})();
