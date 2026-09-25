/* Rechnet jede Stufe des Levels gegen die gemessenen Reichweiten nach.
 *
 * Der Testpilot sagt, DASS ein Weg nicht geht. Dieses Werkzeug sagt, WO
 * und um wie viel - und zwar ohne ihn, denn sonst diskutiert man immer
 * zwei Fehlerquellen zugleich. Es kennt nur Geometrie und die Tabelle:
 *
 *   Sprung                  2,8 m hoch   12,2 m weit  (bei Tempo 17)
 *   + Doppelsprung          4,9 m hoch   18,6 m weit
 *   Jet kurz angetippt      6,2 m hoch   22   m weit
 *   Jet, nur hoch          25,4 m hoch   11   m weit
 *   Jet, erst hoch dann vor 23,7 m hoch   81   m weit
 *   Jet, nur vor           22,6 m hoch  103   m weit
 *
 * Die Tabelle steht hier von Hand und MUSS nach jeder Aenderung an den
 * Jet-Werten aus tools/jet.js nachgezogen werden - sonst prueft das
 * Werkzeug gegen ein Movement, das es nicht mehr gibt.
 *
 * Aufruf: node tools/stufen.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SATZ = process.env.MR_SATZ || 'turm';

/* Was eine Technik traegt. Die Weite gilt fuer den Anlauf, den man auf
   dem jeweiligen Weg realistisch hat - auf dem sicheren Weg laeuft man,
   auf dem irren fliegt man. */
const KANN = [
  { name: 'Doppelsprung', hoch: 4.9,  weit: 18.6 },
  { name: 'Jet-Tipp',     hoch: 6.2,  weit: 22.0 },
  { name: 'hoch->vor',    hoch: 23.7, weit: 81.0 },
  { name: 'nur vor',      hoch: 22.6, weit: 103.0 }
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  await page.addInitScript(s => { try { localStorage.setItem('mr_satz', s); } catch(e){} }, SATZ);
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  const R = await page.evaluate(() => {
    const lvl = window.GAME.level;
    /* Zu jedem Wegpunkt die Flaeche suchen, auf der er liegt - ihre
       Ausdehnung entscheidet, wie viel LUFT zwischen zwei Stufen
       bleibt. Genau daran ist der Entwurf viermal gescheitert: die
       Mitten lagen weit auseinander, die Kanten nicht. */
    function flaeche(pt) {
      let best = null;
      for (const c of lvl.world.all) {
        if (c.noCollide || c.trigger) continue;
        if (Math.abs(c.y + c.hy - pt[1]) > 1.6) continue;
        if (Math.abs(c.x - pt[0]) > c.hx + 1 || Math.abs(c.z - pt[2]) > c.hz + 1) continue;
        if (!best || c.hx * c.hz < best.hx * best.hz) best = c;
      }
      return best ? { x: best.x, z: best.z, hx: best.hx, hz: best.hz } : null;
    }
    const out = { spine: lvl.spine.map(p => ({ p: p, f: flaeche(p) })), routen: {} };
    const rp = lvl.routePaths || {};
    for (const k in rp) out.routen[k] = rp[k].map(p => ({ p: p, f: flaeche(p) }));
    return out;
  });

  /* Wie viel Luft eine Steigstufe braucht.

     Gemessen: neun Meter Hoehe brauchten sechsundzwanzig Meter Luft. Der
     Grund ist, dass der Jet mit rund 19 m/s^2 hebt, waehrend die Figur
     mit bis zu 52 m/s nach vorn fliegt - die Zeit zum Steigen ist also
     der Weg geteilt durchs Tempo, und wer zu dicht baut, fliegt UNTER
     die naechste Kante statt auf sie. Der Faktor 2,6 ist aus dieser
     Messung, nicht geraten. */
  function luftBedarf(hoch) { return hoch > 1 ? hoch * 2.6 : 0; }

  function pruefe(name, pfad) {
    console.log('\n' + name + '  (' + pfad.length + ' Punkte)');
    let schlimm = 0, eng = 0, gesamt = 0, hoehe = 0;
    for (let i = 1; i < pfad.length; i++) {
      const a = pfad[i-1].p, c = pfad[i].p;
      const fa = pfad[i-1].f, fc = pfad[i].f;
      const weit = Math.hypot(c[0]-a[0], c[2]-a[2]);
      const hoch = c[1] - a[1];
      /* Luft = Mittenabstand minus den beiden halben Flaechen in
         Laufrichtung. */
      let luft = weit;
      if (fa && fc && weit > 0.01) {
        const ux = (c[0]-a[0]) / weit, uz = (c[2]-a[2]) / weit;
        luft -= Math.abs(ux) * fa.hx + Math.abs(uz) * fa.hz;
        luft -= Math.abs(ux) * fc.hx + Math.abs(uz) * fc.hz;
      }
      /* Weglaenge und Steigung aufsummieren.

         Diese zwei Zahlen beantworten die Frage, die der Testpilot
         allein nicht beantworten kann: WARUM ein Weg schneller ist. Als
         die drei Aufstiege der grossen Gabel mit 450, 424 und 433 m
         gemessen wurden, war klar, dass ihre Zeiten nicht auseinander
         liegen KOENNEN - es gibt keinen strukturellen Unterschied, den
         eine Zeit abbilden koennte. Ohne diese Summe haette ich
         stattdessen weiter an den Stufen gedreht. */
      gesamt += Math.hypot(weit, hoch);
      if (hoch > 0) hoehe += hoch;
      const braucht = luftBedarf(hoch);
      /* Nur Steigstufen brauchen Luft. Beim Hinunterspringen duerfen
         sich die Flaechen ueberlappen - dort ist die Frage nicht, ob
         man hoch genug kommt, sondern ob man weich aufkommt. */
      const zuEng = braucht > 0 && luft < braucht - 0.5;
      if (zuEng) eng++;
      /* Die billigste Technik, die diese Stufe traegt. */
      let kann = null;
      for (const K of KANN) {
        if (hoch <= K.hoch * 0.85 && weit <= K.weit * 0.85) { kann = K; break; }
      }
      const marke = !kann ? ' !!' : (zuEng ? ' ><' : '   ');
      if (!kann) schlimm++;
      if (!kann || zuEng || i <= 1 || i === pfad.length - 1) {
        console.log(marke + ' Stufe ' + String(i).padStart(2) + ': ' +
          weit.toFixed(1).padStart(6) + ' m weit, ' + hoch.toFixed(1).padStart(6) + ' m hoch, ' +
          luft.toFixed(1).padStart(6) + ' m Luft (braucht ' + braucht.toFixed(0) + ')   ' +
          (kann ? kann.name : 'KEINE TECHNIK REICHT'));
      }
    }
    if (schlimm) console.log('   ' + schlimm + ' Stufe(n) ausserhalb der Reichweite');
    if (eng) console.log('   ' + eng + ' Stufe(n) mit zu wenig Luft - die Figur fliegt unter die Kante');
    if (!schlimm && !eng) console.log('   alle Stufen passen: Reichweite und Luft');
    console.log('   Weglaenge ' + gesamt.toFixed(0) + ' m, davon ' +
                hoehe.toFixed(0) + ' m Steigung');
  }

  pruefe('Wirbelsaeule (sicherer Pfad)', R.spine);
  const NAME = { '0:0': 'Gabel SICHER', '0:1': 'Gabel SCHNELL', '0:2': 'Gabel IRRE' };
  for (const k of Object.keys(R.routen).sort()) pruefe(NAME[k] || k, R.routen[k]);
  await b.close();
})();
