/* ---------------------------------------------------------------------
   Die ersten zehn Minuten.

     node tools/anfang.js [seed]

   Die Vorgabe war ausdruecklich: der Anfang darf nicht zaeh sein. Der
   Spieler soll schnell verstehen, wie man Geld verdient und waechst.
   Dieses Werkzeug spielt genau diesen Anfang - ohne Vorwissen, mit
   naheliegenden Zuegen - und prueft vier Zusagen:

     1. In Woche 1 laesst sich sofort etwas tun (Auftraege vorhanden).
     2. Der erste Betrieb ist spaetestens in Woche 3 bezahlbar.
     3. Bis Woche 6 gibt es Mannschaft, Betrieb und positiven Ertrag.
     4. Nichts davon erfordert, Geld zu verlieren, das man nicht hat.

   Reisst eine Zusage, endet der Lauf mit Code 1.
   --------------------------------------------------------------------- */
'use strict';
const path = require('path');
const base = path.join(__dirname, '..', 'src');
['util', 'data', 'state', 'crew', 'ops', 'empire', 'economy', 'rivals', 'fear', 'city', 'commission', 'people', 'events', 'progress', 'save', 'sim']
  .forEach(m => require(path.join(base, m + '.js')));
const { util: U, state: St, data: D, sim: Sim, ops: Ops, crew: Crew, empire: Emp } = globalThis.CE;

const seed = parseInt(process.argv[2] || '2024', 10);
const s = St.newGame({ seed, name: 'Newcomer' });
Sim.bootstrap(s);

const fails = [];
const marks = [];

/* 1. Sofort etwas zu tun? */
const day0 = Ops.allOffers(s);
if (!day0.length) fails.push('Week 1: no operations available on day 0 - nothing to do');
const soloOdds = day0.map(o => Ops.odds(s, o, ['you']));
const bestSolo = Math.max(...soloOdds);
if (bestSolo < 0.6) fails.push('Week 1: best solo job is only ' + Math.round(bestSolo * 100) + '% - too punishing to start');

let firstBizWeek = null, firstHireWeek = null, firstPositiveWeek = null, wentNegative = null;

for (let day = 0; day < 12 * 7; day++) {
  /* Naheliegende Zuege eines neuen Spielers: schicke alle, die frei
     sind, auf den lohnendsten Auftrag, den sie schaffen koennen. */
  let free = Ops.available(s).filter(c => !c.post);
  const offers = Ops.allOffers(s)
    .map(o => ({ o, p: Ops.odds(s, o, free.slice(0, o.crewNeed).map(c => c.id)) }))
    .filter(x => x.p >= 0.6)
    .sort((a, b) => (b.o.pay * b.p) - (a.o.pay * a.p));
  for (const { o } of offers) {
    free = Ops.available(s).filter(c => !c.post);
    if (free.length < o.crewNeed) break;
    Ops.start(s, o.id, free.slice(0, o.crewNeed).map(c => c.id));
  }

  /* Erster Betrieb, sobald bezahlbar mit Puffer. */
  if (!firstBizWeek) {
    for (const def of D.BUSINESSES) {
      const can = Emp.canBuy(s, 'oldtown', def.id);
      if (can.ok && s.cash >= can.cost + 1200) {
        Emp.buy(s, 'oldtown', def.id);
        firstBizWeek = U.weekOf(s.day);
        break;
      }
    }
  }
  /* Erste Einstellung, sobald es sich traegt. */
  if (!firstHireWeek && s.recruits.length && s.cash > 9000) {
    const pick = s.recruits.slice().sort((a, b) => b.skill - a.skill)[0];
    if (Crew.hire(s, pick.id, pick.ask).ok) firstHireWeek = U.weekOf(s.day);
  }
  for (const c of s.crew) {
    if (c.player || c.post) continue;
    if (D.byId(D.ROLES, c.role).slot !== 'business') continue;
    for (const b of s.businesses) if (Crew.assign(s, c.id, b.id).ok) break;
  }

  Sim.advanceDay(s);
  if (s.event) {
    /* Ein vernuenftiger Spieler nimmt nicht jedes Angebot an. Die erste
       Option ist meist die teuerste; wer knapp bei Kasse ist, waehlt die
       letzte - sie ist in diesem Katalog immer die zurueckhaltende.
       (Der Test soll den Einstieg pruefen, nicht die Unvernunft.) */
    const open = s.event.options.map((o, i) => ({ o, i })).filter(x => !x.o.disabled);
    const thin = s.cash < 8000;
    const pick = thin ? open[open.length - 1] : open[0];
    Sim.choose(s, pick ? pick.i : 0);
  }

  if (s.cash < 0 && !wentNegative) wentNegative = U.weekOf(s.day);
  const d = St.derive(s);
  if (!firstPositiveWeek && d.net > 0 && s.businesses.length) firstPositiveWeek = U.weekOf(s.day);
  if (s.day % 7 === 0) {
    marks.push({ w: U.weekOf(s.day), cash: s.cash, net: d.net, biz: s.businesses.length,
      crew: s.crew.length - 1, rep: s.rep, heat: s.heat, rank: d.rankName });
  }
}

console.log('CRIME EMPIRE - die ersten zwoelf Wochen (Seed ' + seed + ')\n');
console.log('Woche  Bargeld     Netto/W   Betr  Crew  Ruf  Hitze  Rang');
for (const m of marks) {
  console.log(String(m.w).padStart(5) + '  ' + U.money(m.cash).padStart(9) + '  ' +
    U.money(m.net).padStart(8) + '  ' + String(m.biz).padStart(4) + '  ' +
    String(m.crew).padStart(4) + '  ' + m.rep.toFixed(0).padStart(3) + '  ' +
    m.heat.toFixed(0).padStart(5) + '  ' + m.rank);
}
console.log('');
console.log('Erste Auftraege am Tag 0 : ' + day0.length + ' (beste Aussicht allein ' + Math.round(bestSolo * 100) + '%)');
console.log('Erster Betrieb           : Woche ' + (firstBizWeek || '-'));
console.log('Erste Einstellung        : Woche ' + (firstHireWeek || '-'));
console.log('Erster Wochengewinn      : Woche ' + (firstPositiveWeek || '-'));
console.log('Je im Minus              : ' + (wentNegative ? 'ja, Woche ' + wentNegative : 'nein'));

if (!firstBizWeek || firstBizWeek > 3) fails.push('First business not affordable until week ' + (firstBizWeek || 'never') + ' - the opening drags');
if (!firstHireWeek || firstHireWeek > 6) fails.push('No crew until week ' + (firstHireWeek || 'never'));
if (!firstPositiveWeek || firstPositiveWeek > 6) fails.push('No positive weekly net until week ' + (firstPositiveWeek || 'never'));
if (wentNegative && wentNegative <= 8) fails.push('A reasonable player goes into debt in week ' + wentNegative);

if (fails.length) {
  console.log('\nFEHLGESCHLAGEN:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nDer Einstieg traegt.');
