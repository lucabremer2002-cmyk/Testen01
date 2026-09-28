/* Was passiert, wenn eine Abkuerzung MISSLINGT?
 *
 * Der Entwurf verspricht: man verliert Zeit, nicht den Lauf. Unter jeder
 * Abkuerzung liegt Boden, von dem ein Weg zurueckfuehrt. Das ist die
 * wichtigste Zusage fuer einen Spieler, der etwas zum ersten Mal
 * probiert - und sie war bisher behauptet, nicht geprueft: der Testpilot
 * verfehlt nie, er folgt Wegpunkten.
 *
 * Hier fliegt er die Abkuerzung an und laesst MITTEN IM FLUG los. Danach
 * zaehlt nur noch: lebt er, und kommt er ins Ziel?
 *
 * Aufruf: node tools/fehlschlag.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz','tal'); } catch(e){} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });
  await page.addScriptTag({ path: require('path').join(__dirname, 'pilot.js') });

  const R = await page.evaluate(() => {
    const g = window.GAME, F = 1/120, lvl = g.level, p = g.player, sp = lvl.spine;
    g.render = function(){};
    const rp = lvl.routePaths, gz = lvl.gates.map(t => t.z);
    const NAME = ['Senke', 'Ruine', 'Schlucht'];
    const out = [];

    for (let gabel = 0; gabel < 3; gabel++) {
      /* Wegpunkte: bis zur Gabel die Wirbelsaeule, dann der Abkuerzungs-
         pfad, danach wieder die Wirbelsaeule. */
      const wps = [];
      for (const s of sp) if (s[2] <= gz[0] + 2) wps.push(s);
      for (let k = 0; k < 3; k++) {
        const alt = rp[k + ':1'];
        if (k === gabel && alt) { for (const w of alt) wps.push(w); }
        else for (const s of sp) if (s[2] > gz[k] + 2 && s[2] < gz[k+1]) wps.push(s);
      }
      for (const s of sp) if (s[2] >= gz[3] - 2) wps.push(s);

      /* Die sicheren Wegpunkte fuer den Fall, dass es schiefgeht. Ein
         Mensch, der abstuerzt, nimmt danach den Boden - er versucht
         nicht weiter, eine Flaeche zu erreichen, die ueber ihm liegt.
         Ohne diesen Wechsel misst das Werkzeug die Sturheit des
         Piloten, nicht die Rettbarkeit des Levels. */
      const sicher = [];
      for (const s of sp) if (s[2] <= gz[0] + 2) sicher.push(s);
      for (let k = 0; k < 3; k++)
        for (const s of sp) if (s[2] > gz[k] + 2 && s[2] < gz[k+1]) sicher.push(s);
      for (const s of sp) if (s[2] >= gz[3] - 2) sicher.push(s);

      g.resetRun(true); g.state = 'run'; g.runTime = 0;
      const st = window.PILOT.neu(g);
      let flugSchritte = 0, abbruch = false, tiefpunkt = 1e9, gerettet = false;
      let tAbbruch = 0, yAbbruch = 0;

      for (let i = 0; i < 120*200; i++) {
        g.runTime += F;
        const cmd = window.PILOT.schritt(g, st, abbruch ? sicher : wps);

        /* Abgebrochen wird nur eine Zuendung INNERHALB dieser Gabel.
           Der erste Versuch zaehlte jede Zuendung des ganzen Laufs und
           brach deshalb immer dieselbe ab - die aus Abschnitt eins,
           unabhaengig davon, welche Gabel gerade geprueft wurde. Alle
           drei Zeilen zeigten t=6,6 s, was haette auffallen muessen. */
        const inGabel = p.z > gz[gabel] && p.z < gz[gabel + 1];
        if (!abbruch && inGabel) {
          if (cmd.jet) flugSchritte++;
          if (flugSchritte > 24) {
            abbruch = true; tAbbruch = g.runTime; yAbbruch = p.y;
            /* Auf den sicheren Pfad umschalten und den naechsten
               Wegpunkt vor sich suchen. */
            st.wi = 1;
            for (let q = 1; q < sicher.length; q++)
              if (sicher[q][2] > p.z) { st.wi = q; break; }
          }
        }
        if (abbruch && inGabel) cmd.jet = false;

        g.fixedStep(F, cmd);
        if (abbruch && p.grounded && p.y < tiefpunkt) tiefpunkt = p.y;
        if (g.state === 'finish') { gerettet = true; break; }
        const z = window.PILOT.nachlauf(g, st, F);
        if (z === 'tot' || z === 'fest') break;
      }
      out.push({ gabel: NAME[gabel], abgebrochen: abbruch,
                 tAbbruch: +tAbbruch.toFixed(1), yAbbruch: +yAbbruch.toFixed(0),
                 tiefpunkt: tiefpunkt < 1e8 ? +tiefpunkt.toFixed(0) : null,
                 stuerze: st.tode, zustand: g.state, zeit: +g.runTime.toFixed(2),
                 imZiel: gerettet });
    }
    return out;
  });

  console.log('Abkuerzung misslungen - was dann?\n');
  console.log('Gabel      abgebrochen bei      tiefster Boden   Stuerze   Ergebnis');
  R.forEach(r => console.log(
    r.gabel.padEnd(11) +
    (r.abgebrochen ? ('t=' + r.tAbbruch + ' s, y=' + r.yAbbruch).padEnd(21)
                   : 'NICHT GEZUENDET     ') +
    String(r.tiefpunkt === null ? '-' : r.tiefpunkt).padStart(10) + '   ' +
    String(r.stuerze).padStart(7) + '   ' +
    (r.imZiel ? 'im Ziel nach ' + r.zeit + ' s' : 'GESCHEITERT (' + r.zustand + ')')));
  if (errs.length) console.log('\nFEHLER: ' + errs.slice(0,3).join(' | '));
  await b.close();
})();
