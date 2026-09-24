/* ---------------------------------------------------------------------
   Selbsttest: die technische Basislinie des Spiels, reproduzierbar.

     node tools/selftest.js [url]

   Standard ist http://127.0.0.1:8123/index.html. Vorher einen Server im
   Projektordner starten, etwa:  python3 -m http.server 8123

   Gemessen wird nur, was sich messen laesst. Jeder Wert hat eine Schranke;
   wird sie gerissen, endet der Lauf mit Code 1. Die Schranken stammen aus
   gemessenen Werten, nicht aus Wunschdenken - wer sie aendert, soll in der
   Begruendung sagen, warum die neue Zahl richtiger ist.
   --------------------------------------------------------------------- */
'use strict';
const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

/* Schranken. Links der gemessene Stand, rechts die Grenze. */
const GRENZEN = {
  determinismus_m: 0,          /* muss exakt null sein */
  uhr_fehler_s: 0.05,          /* Laufuhr nach 10 s Wanduhr, jede Bildrate */
  tempo_streuung: 0.06,        /* relative Streuung des Tempos ueber Bildraten */
  durchschlaege: 0,            /* Waende von 0,4 m bei Tempo bis 70 */
  sim_ms: 0.25,                /* ein Simulationsschritt */
  hud_ms: 0.10,                /* eine Anzeigenaktualisierung */
  heap_je_bild_b: 64           /* Speicherzuwachs je Bild */
};

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--no-sandbox', '--js-flags=--expose-gc']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const fehlerAusSeite = [];
  page.on('pageerror', e => fehlerAusSeite.push(e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.GAME, null, { timeout: 30000 });
  await page.waitForTimeout(500);

  const R = await page.evaluate(() => {
    const g = window.GAME, F = 1 / 120, p = g.player, P = window.MR.physics;
    const ergebnis = {};
    g.render = function () {};

    /* --- Eingabeskript, gleich fuer alle Laeufe --- */
    const skript = i => ({
      wishX: Math.sin(i * F * 0.7) * 0.6, wishZ: 1,
      slide: (i % 240) < 140, dash: (i % 300) === 60,
      jumpPressed: (i % 90) === 0, jumpHeld: (i % 90) < 30
    });
    function lauf(n) {
      g.resetRun(true); g.state = 'run';
      for (let i = 0; i < n; i++) g.fixedStep(F, skript(i));
      return { x: p.x, y: p.y, z: p.z };
    }

    /* 1 Determinismus */
    const a = lauf(1200), b = lauf(1200);
    ergebnis.determinismus_m = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

    /* 2 Bildratenunabhaengigkeit, auf freier Flaeche und ueber die echte
       Schleife - sonst misst man Levelgeometrie oder Abtastraster. */
    /* World.add() traegt selbst ins Raumraster ein - der Aufruf von
       rebuild() war wirkungslos (die Methode gibt es nicht) und hat nur
       so ausgesehen, als wuerde hier etwas nachgezogen. */
    g.level.world.add({ x: 0, y: 999, z: 600, hx: 400, hy: 1, hz: 700,
                        yaw: 0, cos: 1, sin: 0, active: true });
    const echterFloor = g.level.floorAt;
    g.level.floorAt = () => 900;

    let T = 0, letzterSprung = -1;
    const SPRUENGE = [1.0, 2.2, 3.6, 5.0, 6.4, 7.8, 9.0];
    const inp = g.input;
    inp.axis = () => ({ x: Math.sin(T * 0.7) * 0.5, y: 1, len: 1, fromTouch: false });
    inp.lookDelta = () => ({ x: 0, y: 0 });
    inp.camAxis = () => ({ x: 0, y: 0 });
    inp.endFrame = () => {};
    inp.grabPointer = () => {};
    inp.hit = k => {
      if (k !== 'jump') return false;
      for (const s of SPRUENGE) if (T >= s && letzterSprung < s) { letzterSprung = T; return true; }
      return false;
    };
    inp.down = k => k === 'jump' ? SPRUENGE.some(s => T >= s && T < s + 0.25)
                                 : (k === 'sprint' ? (T % 2) < 1.2 : false);

    function beiBildrate(hz) {
      g.startRun(true); g.state = 'run';
      g.lastFrame = 0; g.accumulator = 0;
      T = 0; letzterSprung = -1;
      p.spawnAt({ x: 0, y: 1000.2, z: 0, yaw: 0 });
      const schritt = 1000 / hz;
      /* Das Spitzentempo unterscheidet die Bildraten, das Endtempo nicht:
         am Ende steht die Figur ohnehin auf Grundtempo. Eine Pruefung, die
         nicht durchfallen kann, taeuscht Sicherheit vor. */
      let spitze = 0;
      for (let uhr = 0; uhr < 10000; ) {
        uhr += schritt; T = uhr / 1000; g.frame(uhr);
        if (p.speed > spitze) spitze = p.speed;
      }
      return { uhr: g.runTime, tempo: spitze };
    }
    const raten = [30, 60, 120, 144, 165];
    const werte = raten.map(beiBildrate);
    ergebnis.uhr_fehler_s = Math.max(...werte.map(w => Math.abs(w.uhr - 10)));
    const tMin = Math.min(...werte.map(w => w.tempo)), tMax = Math.max(...werte.map(w => w.tempo));
    ergebnis.tempo_streuung = (tMax - tMin) / tMax;
    ergebnis.bildraten = raten.map((hz, i) => hz + 'Hz:' + werte[i].uhr.toFixed(3) + 's/Spitze' + werte[i].tempo.toFixed(1));
    g.level.floorAt = echterFloor;

    /* 3 Durchschlagen duenner Waende bei hohem Tempo

       Diese Pruefung mass zuvor sich selbst. Sie hat die beiden Testwaende
       mit `world.all.pop()` entfernt und danach `world.rebuild()`
       aufgerufen - eine Methode, die es in World nicht gibt, weshalb der
       Aufruf hinter `if` stillschweigend entfiel. `all` ist aber nur die
       Liste; die Koerper stehen zusaetzlich im Raumraster `grid`, und
       daraus hat sie nie jemand geloescht. Ab dem zweiten Durchlauf stand
       also ein wachsender Stapel Waende an derselben Stelle, und jede
       weitere Messung lief gegen die Geometrie des ersten Durchgangs. Das
       Ergebnis "0 Durchschlaege" war damit kein Beweis, sondern ein
       Artefakt.

       Jetzt bekommt jede Konfiguration eine frische Welt. Das ist
       billiger als eine Aufraeumfunktion und kann per Konstruktion nicht
       verschmutzen. */
    let durch = 0;
    const echteWelt = g.level.world;
    for (let dicke = 0.4; dicke <= 2.0; dicke += 0.4) {
      for (let v = 30; v <= 70; v += 10) {
        const w = new P.World();
        w.add({ x: 0, y: 503, z: 40, hx: 30, hy: 6, hz: dicke / 2, yaw: 0, cos: 1, sin: 0, active: true });
        w.add({ x: 0, y: 499, z: 20, hx: 30, hy: 1, hz: 60, yaw: 0, cos: 1, sin: 0, active: true });
        g.level.world = w;
        p.spawnAt({ x: 0, y: 500.2, z: 0, yaw: 0 });
        p.grounded = true;
        const cmd = { wishX: 0, wishZ: 1, slide: false, dash: false, jumpPressed: false, jumpHeld: false };
        for (let i = 0; i < 240; i++) { p.vz = v; p.vx = 0; p.step(F, cmd); if (p.z > 45) break; }
        if (p.z > 42) durch++;
      }
    }
    g.level.world = echteWelt;
    ergebnis.durchschlaege = durch;

    /* 4 Kosten je Bild */
    g.startRun(true); g.state = 'run';
    const cmd = { wishX: 0, wishZ: 1, slide: true, dash: false, jumpPressed: false, jumpHeld: false };
    function zeit(fn, n) { fn(); fn(); const t0 = performance.now();
      for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n; }
    ergebnis.sim_ms = zeit(() => g.fixedStep(F, cmd), 600);
    ergebnis.hud_ms = zeit(() => g.updateHud(), 600);

    /* 5 Speicherzuwachs in der heissen Schleife */
    ergebnis.heap_je_bild_b = 0;
    if (performance.memory) {
      if (window.gc) window.gc();
      const h0 = performance.memory.usedJSHeapSize;
      for (let i = 0; i < 600; i++) { g.fixedStep(F, cmd); g.updateHud(); }
      ergebnis.heap_je_bild_b = Math.max(0, (performance.memory.usedJSHeapSize - h0) / 600);
    }
    return ergebnis;
  });

  await browser.close();

  let schlecht = 0;
  const zeile = (name, wert, grenze, einheit) => {
    const ok = wert <= grenze;
    if (!ok) schlecht++;
    console.log('  ' + (ok ? 'ok  ' : 'FEHL') + '  ' + name.padEnd(30) +
      String(typeof wert === 'number' ? +wert.toFixed(4) : wert).padStart(10) +
      '  (Grenze ' + grenze + ')' + (einheit ? ' ' + einheit : ''));
  };
  console.log('Selbsttest ' + URL + '\n');
  zeile('Determinismus, Abweichung', R.determinismus_m, GRENZEN.determinismus_m, 'm');
  zeile('Laufuhr, groesster Fehler', R.uhr_fehler_s, GRENZEN.uhr_fehler_s, 's');
  zeile('Spitzentempo, Streuung', R.tempo_streuung, GRENZEN.tempo_streuung, '');
  zeile('Durchschlagene Waende', R.durchschlaege, GRENZEN.durchschlaege, 'von 25');
  zeile('Simulationsschritt', R.sim_ms, GRENZEN.sim_ms, 'ms');
  zeile('Anzeige je Bild', R.hud_ms, GRENZEN.hud_ms, 'ms');
  zeile('Heap-Zuwachs je Bild', R.heap_je_bild_b, GRENZEN.heap_je_bild_b, 'Byte');
  console.log('\n  Bildraten (Laufuhr nach 10 s / hoechstes Tempo):');
  console.log('    ' + R.bildraten.join('   '));
  if (fehlerAusSeite.length) {
    schlecht++;
    console.log('\n  FEHL  Fehler auf der Seite:');
    fehlerAusSeite.forEach(m => console.log('        ' + m));
  }
  console.log('\n' + (schlecht ? schlecht + ' Pruefung(en) gerissen' : 'Alle Pruefungen bestanden'));
  process.exit(schlecht ? 1 : 0);
})();
