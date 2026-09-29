/* ---------------------------------------------------------------------
   Die Stadt als etwas, das zurueckschaut.

   Ein Bezirk war bisher eine Zahlenreihe: Wirtschaftskraft, Polizei,
   Einfluss. Er sah in Woche 90 aus wie in Woche 1. Das ist der Grund,
   warum sich das Spaetspiel wie ein Tabellenblatt anfuehlte - man
   veraenderte die Stadt, aber die Stadt veraenderte sich nicht.

   Jeder Bezirk hat jetzt einen Zustand, der aus dem folgt, was dort
   tatsaechlich passiert: wie viel investiert wurde, wie gross die Hitze
   ist, ob zwei Organisationen um dieselben Strassen streiten. Der
   Zustand wirkt auf den Ertrag, steht auf der Karte und wird gemeldet,
   wenn er kippt.

   Damit hat eine Entscheidung eine Folge, die man *sieht* und nicht nur
   in einer Spalte ablesen muss.
   --------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var CE = root.CE = root.CE || {};
  var D = CE.data, U = CE.util, St = CE.state;

  /* econ  Faktor auf alle Ertraege im Bezirk
     infl  Faktor auf das Einflusswachstum
     heat  Faktor auf die dort erzeugte Hitze                        */
  var ZUSTAENDE = {
    booming: { name: 'Booming', color: '#4ad98a', econ: 1.22, infl: 1.15, heat: 1.0,
      desc: 'Money is moving. Rents are up, the bars are full and everybody wants in.' },
    stable: { name: 'Stable', color: '#6d7280', econ: 1.0, infl: 1.0, heat: 1.0,
      desc: 'Ordinary weeks, ordinary money.' },
    contested: { name: 'Contested', color: '#eaa640', econ: 0.90, infl: 0.85, heat: 1.15,
      desc: 'Two organisations are working the same streets. Nobody is earning what they should.' },
    declining: { name: 'Declining', color: '#8b5cf6', econ: 0.82, infl: 0.9, heat: 0.9,
      desc: 'Shutters stay down. What is left is cheap, and cheap for a reason.' },
    /* Der Ausnahmezustand senkt die erzeugte Hitze, statt sie zu heben.
       Andersherum war es eine Rueckkopplung ohne Ausgang: Lockdown
       machte mehr Hitze, die Hitze hielt den Lockdown, und am Ende der
       Partie standen alle sechs Bezirke gleichzeitig still. Wenn die
       Strasse stillsteht, entsteht dort auch nichts Neues. */
    lockdown: { name: 'Lockdown', color: '#e04141', econ: 0.65, infl: 0.6, heat: 0.7,
      desc: 'Checkpoints and a curfew. Nothing moves here without being seen.' }
  };

  function zustand(id) { return ZUSTAENDE[id] || ZUSTAENDE.stable; }

  function ensure(s, k) {
    var dd = s.districts[k];
    if (!dd.state) { dd.state = 'stable'; dd.stateSince = s.day; }
    return dd;
  }

  /* Welcher Zustand passt jetzt? Die Reihenfolge ist die Rangfolge:
     Ausnahmezustand schlaegt alles, dann Streit, dann Aufschwung. */
  function bewerten(s, d, k) {
    var dd = s.districts[k];
    if (!dd.open) return 'stable';
    var def = D.byId(D.DISTRICTS, k);

    var meine = s.businesses.filter(function (b) { return b.district === k; });
    var bd = d.byDistrict[k];
    var hitzeHier = bd ? bd.heat : 0;

    var fremd = 0, staerkster = 0;
    for (var i = 0; i < s.rivals.length; i++) {
      var v = s.rivals[i].infl[k] || 0;
      if (s.rivals[i].allied) continue;
      fremd += v;
      if (v > staerkster) staerkster = v;
    }

    /* Ausnahmezustand: die Polizei hat diesen Bezirk im Griff. Eine
       Ausnahme, kein Dauerzustand - deshalb hohe Schwelle und, weiter
       unten, ein hartes Ende nach fuenf Wochen. */
    if (s.heat >= 72 && hitzeHier > 4.5 * def.lawEye) return 'lockdown';
    if (s.heat >= 85 && hitzeHier > 2.5) return 'lockdown';

    /* Streit: beide Seiten stark genug, um sich gegenseitig zu stoeren.
       Die Schwelle liegt bewusst hoch. Bei 18 Punkten griff sie schon in
       Woche zehn und besteuerte damit die Eroeffnung - im Vergleichslauf
       stand der Spieler in Woche 24 bei zwei statt fuenf Betrieben.
       Streit ist etwas fuer zwei gewachsene Organisationen. */
    var istStreit = dd.state === 'contested';
    if (dd.mine >= (istStreit ? 26 : 32) && staerkster >= (istStreit ? 22 : 28)) return 'contested';

    /* Aufschwung: Investition, Ruhe und Kontrolle.

       Mit Hysterese: hineinzukommen ist schwerer, als drinzubleiben.
       Ohne das kippte ein Bezirk im Spaetspiel im Takt der schwankenden
       Hitze zwischen "booming" und "stable" hin und her, was auf der
       Karte wie ein Flackern aussah und nichts bedeutete. */
    var istBoom = dd.state === 'booming';
    if (meine.length >= 3 && dd.mine >= 45 && s.heat < (istBoom ? 68 : 55)) return 'booming';

    /* Verfall: kaum jemand investiert hier. */
    if (meine.length === 0 && dd.mine < (dd.state === 'declining' ? 32 : 25) && fremd < 25) return 'declining';

    return 'stable';
  }

  /* Woechentlich. Zustaende aendern sich traege - ein Bezirk soll nicht
     jede Woche die Farbe wechseln. */
  function weekly(s, rng, d, report) {
    /* Die Polizei kann nicht die halbe Stadt gleichzeitig abriegeln.
       Der Ausloeser haengt an der *globalen* Hitze, und mit Betrieben in
       jedem Bezirk kippten darum alle sechs im selben Moment - am Ende
       der Testpartie stand die ganze Stadt still. Eine Sondereinheit
       konzentriert sich auf einen Bezirk, und zwar auf den lautesten. */
    var imLockdown = 0, lautester = null, lautestWert = 0;
    for (var kk in s.districts) {
      var d2 = s.districts[kk];
      if (!d2.open) continue;
      if (d2.state === 'lockdown') imLockdown++;
      var bd2 = d.byDistrict[kk];
      var w2 = bd2 ? bd2.heat : 0;
      if (w2 > lautestWert) { lautestWert = w2; lautester = kk; }
    }

    for (var k in s.districts) {
      var dd = ensure(s, k);
      if (!dd.open) continue;
      var soll = bewerten(s, d, k);

      /* Nur der lauteste Bezirk kann abgeriegelt werden, und nur einer
         auf einmal. */
      if (soll === 'lockdown' && dd.state !== 'lockdown' &&
          (imLockdown > 0 || k !== lautester)) {
        soll = bewerten2(s, d, k);
      }

      /* Eine Stadt kann einen Bezirk nicht ewig abriegeln. Nach fuenf
         Wochen ziehen die Einheiten ab, egal wie die Lage ist - sonst
         friert das Spaetspiel in einem Dauer-Ausnahmezustand ein. */
      if (dd.state === 'lockdown' && s.day - (dd.stateSince || 0) >= 35) {
        dd.state = 'contested';
        dd.stateSince = s.day;
        report.push({ t: 'good', text: D.byId(D.DISTRICTS, k).name +
          ' is open again. The checkpoints came down overnight and nobody explained why.' });
        continue;
      }

      if (soll === dd.state) continue;
      /* Mindestens drei Wochen im alten Zustand, bevor er kippt. */
      if (s.day - (dd.stateSince || 0) < 21) continue;
      if (soll === 'lockdown') imLockdown++;

      var alt = zustand(dd.state), neu = zustand(soll);
      dd.state = soll;
      dd.stateSince = s.day;
      var name = D.byId(D.DISTRICTS, k).name;
      var schlecht = soll === 'lockdown' || soll === 'contested' || soll === 'declining';
      report.push({
        t: schlecht ? 'warn' : 'good',
        banner: soll === 'lockdown' ? name + ' Locked Down' : null,
        ico: 'map',
        text: name + ' is now ' + neu.name.toLowerCase() + '. ' + neu.desc
      });
    }
  }

  /* Derselbe Test ohne den Ausnahmezustand - fuer die Bezirke, die
     gerade nicht der lauteste sind. */
  function bewerten2(s, d, k) {
    var dd = s.districts[k];
    var merk = dd.state;
    dd.state = 'nolock';                 /* verhindert die Hysterese-Zweige */
    var meine = s.businesses.filter(function (b) { return b.district === k; });
    var staerkster = 0, fremd = 0;
    for (var i = 0; i < s.rivals.length; i++) {
      if (s.rivals[i].allied) continue;
      var v = s.rivals[i].infl[k] || 0;
      fremd += v;
      if (v > staerkster) staerkster = v;
    }
    dd.state = merk;
    if (dd.mine >= 32 && staerkster >= 28) return 'contested';
    if (meine.length >= 3 && dd.mine >= 45 && s.heat < 68) return 'booming';
    if (meine.length === 0 && dd.mine < 25 && fremd < 25) return 'declining';
    return 'stable';
  }

  /* Faktoren fuer die Rechnung. bizFinance und economy fragen hier. */
  function econOf(s, k) {
    var dd = s.districts[k];
    return dd && dd.state ? zustand(dd.state).econ : 1;
  }
  function inflOf(s, k) {
    var dd = s.districts[k];
    return dd && dd.state ? zustand(dd.state).infl : 1;
  }
  function heatOf(s, k) {
    var dd = s.districts[k];
    return dd && dd.state ? zustand(dd.state).heat : 1;
  }

  CE.city = {
    ZUSTAENDE: ZUSTAENDE, zustand: zustand, weekly: weekly, bewerten: bewerten,
    econOf: econOf, inflOf: inflOf, heatOf: heatOf, ensure: ensure
  };
})(typeof window !== 'undefined' ? window : globalThis);
