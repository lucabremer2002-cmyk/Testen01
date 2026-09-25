/* Ein Lauf durch das Tal, mit waehlbaren Abzweigen.
 *
 *   node tools/tallauf.js 00     beide Male der sichere Weg
 *   node tools/tallauf.js 11     beide Abkuerzungen
 *
 * Gemessen wird, was der Spieler merkt: Abschnittszeiten, wie viel Zeit
 * die Figur in der Luft haengt, wie oft sie stuerzt - und wie oft die
 * Duese ueberhaupt gezuendet wurde. Der letzte Wert ist der wichtigste:
 * auf dem sicheren Weg soll er NULL sein. Ein sicherer Weg, der ohne Jet
 * nicht geht, ist kein sicherer Weg.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const WAHL = (process.argv[2] || '00').split('').map(Number);
const OHNE_JET = process.argv.indexOf('--ohne-jet') >= 0;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 320, height: 240 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz','tal'); } catch(e){} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  await page.addScriptTag({ path: require('path').join(__dirname, 'pilot.js') });

  const R = await page.evaluate(({ WAHL, OHNE_JET }) => {
    const g = window.GAME, F = 1/120, lvl = g.level, p = g.player, sp = lvl.spine;
    g.render = function(){};
    const rp = lvl.routePaths || {}, gz = lvl.gates.map(t => t.z);

    /* Die Gabeln liegen zwischen den Toren: Gabel 0 zwischen Tor 1 und 2,
       Gabel 1 zwischen Tor 2 und 3. Vor dem ersten Tor und nach dem
       letzten gilt die Wirbelsaeule. */
    const wps = [];
    for (const s of sp) if (s[2] <= gz[0] + 2) wps.push(s);
    for (let k = 0; k < WAHL.length; k++) {
      const alt = rp[k + ':' + WAHL[k]];
      if (alt && WAHL[k] > 0) { for (const w of alt) wps.push(w); }
      else for (const s of sp) if (s[2] > gz[k] + 2 && s[2] < gz[k+1]) wps.push(s);
    }
    for (const s of sp) if (s[2] >= gz[WAHL.length] - 2) wps.push(s);

    g.resetRun(true); g.state='run'; g.runTime=0;
    const st = window.PILOT.neu(g, { ohneJet: OHNE_JET });
    const splits = []; let gesehen = 0, luft = 0, n = 0, zuendungen = 0, jetVor = false;
    let vSum = 0, vMax = 0, yMin = 1e9, yMax = -1e9;
    const tode = [];
    for (let i = 0; i < 120*200; i++) {
      g.runTime += F;
      const cmd = window.PILOT.schritt(g, st, wps);
      g.fixedStep(F, cmd);
      n++; if (!p.grounded) luft++;
      if (p.jetAn && !jetVor) zuendungen++;
      jetVor = p.jetAn;
      vSum += p.speed; if (p.speed > vMax) vMax = p.speed;
      if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
      let offen = 0; for (const t of lvl.gates) if (t.passed) offen++;
      if (offen > gesehen) { gesehen = offen;
        splits.push({ tor: lvl.gates[gesehen-1].name, t: +g.runTime.toFixed(2),
                      v: +p.speed.toFixed(0) }); }
      /* Am letzten Tor ist der Lauf vorbei. Ohne diesen Abbruch lief das
         Geruest weiter, bis der Pilot irgendwo feststeckte, und rechnete
         die Leerzeit in Tempo-Schnitt und Luftanteil hinein - gemessen
         sackte der Schnitt dadurch von 15,7 auf 7,9. Die Zahl beschrieb
         dann das Werkzeug, nicht das Spiel. */
      if (gesehen >= lvl.gates.length) break;
      const ort = 'y='+p.y.toFixed(0)+' z='+p.z.toFixed(0)+' v='+p.speed.toFixed(0);
      const z = window.PILOT.nachlauf(g, st, F);
      if (z === 'sturz') tode.push('t='+g.runTime.toFixed(1)+'  '+ort);
      if (z === 'fest') { tode.push('FEST  '+ort); break; }
      if (z === 'fertig' || z === 'tot') break;
    }
    return { zustand: g.state, t: +g.runTime.toFixed(2), tode: st.tode, splits,
             luft: +(luft/n).toFixed(2), zuendungen,
             vSchnitt: +(vSum/n).toFixed(1), vMax: +vMax.toFixed(0),
             yMin: +yMin.toFixed(0), yMax: +yMax.toFixed(0),
             kristalle: g.gems + '/' + (lvl.gems ? lvl.gems.length : 0),
             log: tode.slice(0, 4) };
  }, { WAHL, OHNE_JET });

  const NAME = ['sicher', 'Abkuerzung'];
  console.log('Wahl ' + WAHL.map(v => NAME[v]).join(' / ') +
              (OHNE_JET ? '   [DUESE GESPERRT]' : '') + '   ' + R.zustand +
              '   Stuerze ' + R.tode + '   Jet gezuendet ' + R.zuendungen + ' mal');
  let vor = 0;
  R.splits.forEach(s => {
    console.log('   ' + s.tor.padEnd(12) + String(s.t).padStart(7) + ' s' +
                '   Abschnitt ' + String((s.t - vor).toFixed(2)).padStart(6) + ' s' +
                '   Tempo ' + String(s.v).padStart(3));
    vor = s.t;
  });
  console.log('   Tempo im Schnitt ' + R.vSchnitt + ', Spitze ' + R.vMax +
              '   Luftanteil ' + R.luft + '   Hoehe ' + R.yMin + ' .. ' + R.yMax +
              '   Kristalle ' + R.kristalle);
  R.log.forEach(l => console.log('   ! ' + l));
  if (errs.length) console.log('FEHLER: ' + errs.slice(0,3).join('\n'));
  await b.close();
})();
