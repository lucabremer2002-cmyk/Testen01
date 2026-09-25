/* Rechnet jede Stufe des Levels gegen die gemessenen Reichweiten nach.
 *
 * Der Testpilot sagt, DASS ein Weg nicht geht. Dieses Werkzeug sagt, WO
 * und um wie viel - und zwar ohne ihn, denn sonst diskutiert man immer
 * zwei Fehlerquellen zugleich. Es kennt nur Geometrie und die Tabelle:
 *
 *   Sprung                  2,80 m hoch   13,3 m weit  (bei Tempo 20)
 *   + Doppelsprung          4,65 m hoch   19,5 m weit
 *   Jet, ohne Steuerkreuz  25,4  m hoch   11   m weit
 *   Jet, mit Steuerkreuz   22,6  m hoch   47   m weit
 *
 * Die Tabelle steht hier von Hand und MUSS nach jeder Aenderung an den
 * Bewegungswerten aus tools/budget.js nachgezogen werden - sonst prueft
 * das Werkzeug gegen ein Movement, das es nicht mehr gibt.
 *
 * DIE WICHTIGERE PRUEFUNG ist die der SICHEREN Route. Sie darf hoechstens
 * 70 Prozent dessen verlangen, was ein Doppelsprung traegt - also 3,25 m
 * Hoehe und 13,6 m Weite. Eine Strecke, die 95 Prozent verlangt, schafft
 * nur, wer sie gebaut hat. Wer sie zum ersten Mal sieht, faellt.
 *
 * Aufruf: node tools/stufen.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SATZ = process.env.MR_SATZ || 'turm';

/* Was eine Technik traegt. Die Weite gilt fuer den Anlauf, den man auf
   dem jeweiligen Weg realistisch hat - auf dem sicheren Weg laeuft man,
   auf dem irren fliegt man. */
const KANN = [
  { name: 'Sprung',       hoch: 2.80, weit: 13.3 },
  { name: 'Doppelsprung', hoch: 4.65, weit: 19.5 },
  { name: 'Jet',          hoch: 22.6, weit: 47.0 }
];

/* Was die SICHERE Route hoechstens verlangen darf: 70 Prozent des
   Doppelsprungs. Alles darueber ist eine Expertenstelle und gehoert auf
   eine alternative Route, nicht auf den Hauptweg. */
const SICHER_HOCH = 4.65 * 0.7;
const SICHER_WEIT = 19.5 * 0.7;

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

  /* Wie viel Anlauf ein Steigflug braucht.

     Der Jet hebt mit rund 19 m/s^2 und fliegt waagerecht mit 20 m/s -
     mehr darf er nicht, das ist die Obergrenze des Entwurfs. Die Zeit
     zum Steigen ist also sqrt(2h/19,2), und der Weg dabei 20 mal diese
     Zeit: 6,5 mal die Wurzel aus der Hoehe. Mit 15 Prozent Reserve.

     Frueher stand hier ein Faktor von 2,6 je Meter, LINEAR. Der stammte
     aus der Zeit, als der Jet 52 m/s flog: da war die Waagerechte der
     Engpass und wuchs mit der Hoehe. Jetzt ist die SENKRECHTE der
     Engpass, und der Bedarf waechst nur noch mit der Wurzel - eine
     doppelt so hohe Stufe braucht nicht doppelt so viel Anlauf, sondern
     das Anderthalbfache. */
  function luftBedarf(hoch) { return hoch > 1 ? 7.5 * Math.sqrt(hoch) : 0; }

  function pruefe(name, pfad, istSicher) {
    console.log('\n' + name + '  (' + pfad.length + ' Punkte)' +
                (istSicher ? '   [SICHERE ROUTE - Grenze ' + SICHER_HOCH.toFixed(2) +
                             ' m hoch / ' + SICHER_WEIT.toFixed(1) + ' m weit]' : ''));
    let schlimm = 0, eng = 0, hart = 0, gesamt = 0, hoehe = 0, gelaufen = 0;
    for (let i = 1; i < pfad.length; i++) {
      const a = pfad[i-1].p, c = pfad[i].p;
      const fa = pfad[i-1].f, fc = pfad[i].f;
      const weit = Math.hypot(c[0]-a[0], c[2]-a[2]);
      const hoch = c[1] - a[1];
      gesamt += Math.hypot(weit, hoch);
      if (hoch > 0) hoehe += hoch;

      /* LUFT ist die Luecke zwischen den Flaechen, nicht der Abstand
         ihrer Mittelpunkte. Beruehren sie sich, ist die Luft negativ -
         dann gibt es nichts zu springen, man LAEUFT. Diese Unterscheidung
         ist der ganze Sinn des Werkzeugs: ein durchgehender Weg aus
         ueberlappenden Flaechen sah vorher aus wie eine Kette von
         Zwanzig-Meter-Spruengen, weil nur die Mittenabstaende gemessen
         wurden. */
      let luft = weit;
      if (fa && fc && weit > 0.01) {
        const ux = (c[0]-a[0]) / weit, uz = (c[2]-a[2]) / weit;
        luft -= Math.abs(ux) * fa.hx + Math.abs(uz) * fa.hz;
        luft -= Math.abs(ux) * fc.hx + Math.abs(uz) * fc.hz;
      }
      luft = Math.max(0, luft);

      /* Begehbar: keine Luecke, und die Stufe ist niedriger als die
         Hoehe, die die Physik von selbst uebersteigt (STEP_HEIGHT). */
      if (luft <= 0.01 && hoch <= 0.62) { gelaufen++; continue; }

      /* Ein Schritt nach UNTEN traegt weiter als einer nach oben, und
         zwar erheblich: wer vierzehn Meter faellt, ist 0,66 s laenger in
         der Luft und kommt bei Tempo 20 dreizehn Meter weiter. Die
         Reichweite waechst also mit der Fallhoehe.

         Ohne diese Zeile meldete das Werkzeug den Schlusssturz des
         Levels als zu schwer - einen Sprung, den man gar nicht
         verfehlen kann, weil unten eine vierzig Meter tiefe Flaeche
         liegt. Eine Pruefung, die Falschmeldungen erzeugt, gewoehnt
         einem das Hinsehen ab. */
      const fallBonus = hoch < 0 ? 20 * Math.sqrt(2 * (-hoch) / 64) : 0;

      let kann = null;
      for (const K of KANN) {
        if (hoch <= K.hoch * 0.85 && luft <= (K.weit + fallBonus) * 0.85) { kann = K; break; }
      }
      const zuHart = istSicher &&
                     (hoch > SICHER_HOCH || luft > SICHER_WEIT + fallBonus);
      if (zuHart) hart++;
      if (!kann) schlimm++;

      /* Nur ein Steigflug mit der Duese braucht Anlaufluft - ein Sprung
         folgt einer Wurfparabel und ist mit Hoehe und Weite beschrieben. */
      const braucht = (kann && kann.name === 'Jet' && hoch > 1) ? luftBedarf(hoch) : 0;
      const zuEng = braucht > 0 && luft < braucht - 0.5;
      if (zuEng) eng++;

      const marke = !kann ? ' !!' : (zuHart ? ' ##' : (zuEng ? ' ><' : '   '));
      if (!kann || zuHart || zuEng) {
        console.log(marke + ' Stufe ' + String(i).padStart(2) + ': ' +
          luft.toFixed(1).padStart(6) + ' m Luft, ' + hoch.toFixed(1).padStart(6) + ' m hoch' +
          (braucht ? '  (braucht ' + braucht.toFixed(0) + ' m Anlauf)' : '') + '   ' +
          (kann ? kann.name : 'KEINE TECHNIK REICHT'));
      }
    }
    console.log('   ' + gelaufen + ' von ' + (pfad.length - 1) + ' Uebergaengen sind begehbar (kein Sprung)');
    if (hart) console.log('   ' + hart + ' Stelle(n) ZU SCHWER fuer die sichere Route (ueber 70 %)');
    if (schlimm) console.log('   ' + schlimm + ' Stelle(n) ausserhalb jeder Reichweite');
    if (eng) console.log('   ' + eng + ' Steigflug(e) mit zu wenig Anlauf');
    if (!schlimm && !eng && !hart) console.log('   alles passt: Reichweite, Anlauf, Fairness');
    console.log('   Weglaenge ' + gesamt.toFixed(0) + ' m, davon ' +
                hoehe.toFixed(0) + ' m Steigung');
  }

  pruefe('Hauptweg (sichere Route)', R.spine, true);
  const NAME = { '0:0': 'Gabel SICHER', '0:1': 'Gabel SCHNELL', '0:2': 'Gabel IRRE' };
  for (const k of Object.keys(R.routen).sort())
    pruefe(NAME[k] || k, R.routen[k], k.endsWith(':0'));
  await b.close();
})();
