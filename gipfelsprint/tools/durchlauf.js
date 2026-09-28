/* Einmal durchspielen - und dabei zusehen.
 *
 * Die anderen Werkzeuge messen je eine Frage: haelt der Jet-Deckel, ist
 * die Todesebene dicht, wie lang ist ein Abschnitt. Dieses hier macht
 * etwas anderes: es faehrt EINEN Lauf von vorn bis hinten, schreibt eine
 * Zeitleiste mit und macht unterwegs Bilder aus der SPIELKAMERA - nicht
 * aus fest gesetzten Stellungen wie ansichten.js.
 *
 * Es beantwortet damit die Frage, die sich nicht rechnen laesst: was
 * faellt auf, wenn man den Lauf einfach laufen sieht? Deshalb misst es
 * auch Dinge, die kein Ergebnis sind, sondern Eindruecke:
 *
 *   Leerlauf   Strecken, auf denen man nichts tut und nichts entscheidet
 *   Bremser    Stellen, an denen deutlich Tempo verloren geht
 *   Luftzeit   wie lange man am Stueck nicht steht
 *   Blindflug  wie lange die Figur hinter etwas verschwindet
 *
 * Aufruf:  node tools/durchlauf.js [wahl] [praefix]
 *          node tools/durchlauf.js 000 sicher
 *          node tools/durchlauf.js 111 irre
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const WAHL = (process.argv[2] || '000').split('').map(Number);
const PRE = process.argv[3] || 'dl';
const BILDER = 18;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('mr_satz', 'tal'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 60000 });
  await page.addScriptTag({ path: require('path').join(__dirname, 'pilot.js') });
  await page.waitForTimeout(600);

  await page.evaluate((WAHL) => {
    const g = window.GAME, lvl = g.level, sp = lvl.spine;
    ['menu', 'result', 'pause', 'loading', 'rotate'].forEach(id => {
      const e = document.getElementById(id); if (e) e.hidden = true; });
    const h = document.getElementById('hud'); if (h) h.hidden = false;

    const rp = lvl.routePaths || {}, gz = lvl.gates.map(t => t.z);
    const wps = [];
    for (const s of sp) if (s[2] <= gz[0] + 2) wps.push(s);
    for (let k = 0; k < WAHL.length; k++) {
      const alt = rp[k + ':' + WAHL[k]];
      if (alt && WAHL[k] > 0) { for (const w of alt) wps.push(w); }
      else for (const s of sp) if (s[2] > gz[k] + 2 && s[2] < gz[k + 1]) wps.push(s);
    }
    for (const s of sp) if (s[2] >= gz[WAHL.length] - 2) wps.push(s);

    g.resetRun(true); g.state = 'run'; g.runTime = 0;
    const st = window.PILOT.neu(g, {});

    window.__DL = {
      g: g, st: st, wps: wps, F: 1 / 120, halb: 0,
      zeile: [],          /* je Zehntelsekunde ein Eintrag */
      ereignis: [],       /* Spruenge, Landungen, Kristalle, Tore */
      vorGrounded: true, vorJet: false, vorGems: 0, vorTore: 0,
      vorSpeed: 0, letzteBodenV: 0, fertig: false,

      schritt: function () {
        const p = g.player;
        g.runTime += this.F;
        const cmd = window.PILOT.schritt(g, this.st, this.wps);
        g.fixedStep(this.F, cmd);
        const t = g.runTime;

        /* Ereignisse aus Zustandswechseln ableiten - das Spiel meldet sie
           nur an die Partikel, nicht nach aussen. */
        if (this.vorGrounded && !p.grounded) {
          this.ereignis.push({ t: +t.toFixed(2), was: 'ab', v: +p.speed.toFixed(1), y: +p.y.toFixed(1) });
        }
        if (!this.vorGrounded && p.grounded) {
          this.ereignis.push({ t: +t.toFixed(2), was: 'auf', v: +p.speed.toFixed(1), y: +p.y.toFixed(1) });
        }
        if (p.jetAn && !this.vorJet) this.ereignis.push({ t: +t.toFixed(2), was: 'jet', v: +p.speed.toFixed(1) });
        const gems = g.gemsTaken || g.gems || 0;
        if (gems > this.vorGems) this.ereignis.push({ t: +t.toFixed(2), was: 'kristall', n: gems });
        let offen = 0; for (const tr of lvl.gates) if (tr.passed) offen++;
        if (offen > this.vorTore) {
          this.ereignis.push({ t: +t.toFixed(2), was: 'tor', name: lvl.gates[offen - 1].name });
          this.vorTore = offen;
        }
        /* Bremser: mehr als 4 m/s Verlust binnen einer Zehntelsekunde. */
        if (this.vorSpeed - p.speed > 0.4 && p.grounded) {
          this.ereignis.push({ t: +t.toFixed(2), was: 'bremse',
                               von: +this.vorSpeed.toFixed(1), auf: +p.speed.toFixed(1) });
        }
        this.vorGrounded = p.grounded; this.vorJet = p.jetAn;
        this.vorGems = gems; this.vorSpeed = p.speed;

        /* Kamera, Umgebung und Anzeige wie im echten Bild - sonst stimmen
           weder Dunst noch Partikel noch die Zahlen im Bild. */
        this.halb++;
        if (this.halb >= 2) {
          this.halb = 0;
          g.cam.update(1 / 60, p, null, lvl.world);
          if (g.updateEnvironment) g.updateEnvironment(1 / 60);
          if (g.updateAmbient) g.updateAmbient(1 / 60);
          if (g.updateHud) g.updateHud();
        }
        if (this.zeile.length === 0 || t - this.zeile[this.zeile.length - 1].t >= 0.1) {
          this.zeile.push({ t: +t.toFixed(2), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
                            v: +p.speed.toFixed(1), boden: !!p.grounded, jet: !!p.jetAn,
                            tank: +(p.tank === undefined ? 1 : p.tank).toFixed(2) });
        }
        if (g.state !== 'run' || this.st.tode > 0 || t > 200) this.fertig = true;
        return this.fertig;
      },

      bisZeit: function (ziel) {
        while (!this.fertig && g.runTime < ziel) this.schritt();
        return { t: +g.runTime.toFixed(2), fertig: this.fertig, z: +g.player.z.toFixed(0) };
      }
    };
  }, WAHL);

  /* Erst den Lauf einmal blind durchrechnen, um die Gesamtzeit zu kennen -
     danach neu starten und an gleichmaessig verteilten Stellen Bilder
     machen. Sonst lagen alle Bilder im ersten Drittel. */
  const dauer = await page.evaluate(() => {
    const D = window.__DL;
    while (!D.fertig) D.schritt();
    return { t: +window.GAME.runTime.toFixed(2), tode: D.st.tode };
  });

  const marken = [];
  for (let i = 0; i < BILDER; i++) marken.push(dauer.t * (i + 0.5) / BILDER);

  await page.evaluate((WAHL) => {
    const g = window.GAME, lvl = g.level;
    g.resetRun(true); g.state = 'run'; g.runTime = 0;
    ['menu', 'result', 'pause', 'loading', 'rotate'].forEach(id => {
      const e = document.getElementById(id); if (e) e.hidden = true; });
    const h = document.getElementById('hud'); if (h) h.hidden = false;
    const D = window.__DL;
    D.st = window.PILOT.neu(g, {});
    D.zeile = []; D.ereignis = []; D.fertig = false; D.halb = 0;
    D.vorGrounded = true; D.vorJet = false; D.vorGems = 0; D.vorTore = 0; D.vorSpeed = 0;
  }, WAHL);

  const stand = [];
  for (let i = 0; i < marken.length; i++) {
    const s = await page.evaluate((z) => {
      const r = window.__DL.bisZeit(z);
      /* Der erste, blinde Lauf endet im Ergebnisbildschirm. Der bleibt
         sonst ueber jedem Bild liegen - beim ersten Versuch zeigten alle
         achtzehn Bilder die Ergebnistafel statt des Levels. */
      ['menu', 'result', 'pause', 'loading', 'rotate'].forEach(id => {
        const e = document.getElementById(id); if (e) e.hidden = true; });
      window.GAME.render(1 / 60);
      const p = window.GAME.player;
      return { t: r.t, z: r.z, v: +p.speed.toFixed(0), boden: !!p.grounded, jet: !!p.jetAn };
    }, marken[i]);
    stand.push(s);
    await page.screenshot({ path: '/tmp/' + PRE + '-' + String(i).padStart(2, '0') + '.png',
                            animations: 'disabled', timeout: 20000 });
    if (s.t >= dauer.t - 0.01) break;
  }

  const R = await page.evaluate(() => {
    const D = window.__DL, g = window.GAME, z = D.zeile;

    /* Leerlauf: am Boden, kaum Lenkung, kein Jet, kein Sprung, volles
       Tempo. Wer hier nichts tut, verliert auch nichts - genau das ist
       die Definition einer Strecke ohne Handlung. */
    const leer = [];
    let start = null;
    for (let i = 1; i < z.length; i++) {
      const a = z[i];
      const ruhig = a.boden && !a.jet && a.v > 18.5;
      if (ruhig && start === null) start = a.t;
      if ((!ruhig || i === z.length - 1) && start !== null) {
        const len = a.t - start;
        if (len >= 1.5) leer.push({ von: +start.toFixed(1), bis: +a.t.toFixed(1), s: +len.toFixed(1) });
        start = null;
      }
    }
    /* Luftphasen */
    const luft = []; let ls = null;
    for (let i = 1; i < z.length; i++) {
      if (!z[i].boden && ls === null) ls = z[i].t;
      if (z[i].boden && ls !== null) {
        const len = z[i].t - ls;
        if (len >= 0.6) luft.push({ von: +ls.toFixed(1), s: +len.toFixed(1) });
        ls = null;
      }
    }
    const bremsen = D.ereignis.filter(e => e.was === 'bremse');
    /* Aufeinanderfolgende Bremsschritte zu einer Stelle zusammenfassen. */
    const bStellen = [];
    for (const b of bremsen) {
      const l = bStellen[bStellen.length - 1];
      if (l && b.t - l.bis < 0.35) { l.bis = b.t; l.auf = b.auf; }
      else bStellen.push({ von: b.t, bis: b.t, vVon: b.von, auf: b.auf });
    }
    const spruenge = D.ereignis.filter(e => e.was === 'ab').length;
    const zuend = D.ereignis.filter(e => e.was === 'jet').length;
    const tore = D.ereignis.filter(e => e.was === 'tor');
    let vs = 0, nBoden = 0;
    for (const a of z) { vs += a.v; if (a.boden) nBoden++; }
    return {
      zeit: +g.runTime.toFixed(2), tode: D.st.tode,
      kristalle: (g.gemsTaken || g.gems || 0) + '/' + (g.level.gems ? g.level.gems.length : '?'),
      vSchnitt: +(vs / z.length).toFixed(1),
      bodenAnteil: +(nBoden / z.length).toFixed(2),
      spruenge: spruenge, zuendungen: zuend,
      tore: tore.map(t => t.name + ' ' + t.t),
      leer: leer, luft: luft,
      bremsen: bStellen.filter(b => b.vVon - b.auf > 2.5)
        .map(b => ({ t: +b.von.toFixed(1), von: b.vVon, auf: b.auf })),
      zeile: z
    };
  });

  console.log('Durchlauf  Wahl ' + WAHL.join('') + '   Bilder /tmp/' + PRE + '-NN.png');
  console.log('');
  console.log('  Zeit ' + R.zeit + ' s   Stuerze ' + R.tode + '   Kristalle ' + R.kristalle);
  console.log('  Tempo im Schnitt ' + R.vSchnitt + '   am Boden ' + Math.round(R.bodenAnteil * 100) + ' %'
    + '   Spruenge ' + R.spruenge + '   Zuendungen ' + R.zuendungen);
  console.log('  Tore: ' + R.tore.join('  '));
  console.log('');
  console.log('  LEERLAUF (am Boden, volles Tempo, keine Handlung):');
  if (!R.leer.length) console.log('    keiner ueber 1,5 s');
  for (const l of R.leer) console.log('    ' + l.von + ' .. ' + l.bis + ' s   ' + l.s + ' s am Stueck');
  const summe = R.leer.reduce((a, l) => a + l.s, 0);
  console.log('    zusammen ' + summe.toFixed(1) + ' s von ' + R.zeit + ' s  ('
    + Math.round(summe / R.zeit * 100) + ' %)');
  console.log('');
  console.log('  LUFTPHASEN ueber 0,6 s:');
  for (const l of R.luft) console.log('    ab ' + l.von + ' s   ' + l.s + ' s');
  console.log('');
  console.log('  TEMPOVERLUST ueber 2,5 m/s am Boden:');
  if (!R.bremsen.length) console.log('    keiner');
  for (const bb of R.bremsen) console.log('    ' + bb.t + ' s   ' + bb.von + ' -> ' + bb.auf);
  console.log('');
  for (const s of stand) {
    console.log('  Bild ' + String(stand.indexOf(s)).padStart(2, '0') + '  t=' + s.t + ' s  z=' + s.z
      + '  Tempo ' + s.v + (s.boden ? '  Boden' : '  Luft') + (s.jet ? '  JET' : ''));
  }
  if (errs.length) console.log('\nFEHLER: ' + errs.slice(0, 3).join(' | '));
  await b.close();
})();
