/* ---------------------------------------------------------------------
   Vollpartie ohne Browser.

     node tools/simulation.js [wochen] [seed] [--leise]

   Ein schlichter, aber ehrlicher Spieler: er nimmt lohnende Auftraege,
   stellt ein, wenn Geld da ist, kauft den besten erreichbaren Betrieb,
   haelt die Hitze im Griff und entscheidet Ereignisse nach der ersten
   nicht gesperrten Option.

   Der Zweck ist nicht, das Spiel zu gewinnen, sondern die Kurve zu
   sehen: Waechst das Vermoegen? Kommt der Rang? Bleibt die Hitze
   beherrschbar? Wer Zahlen aendert, laesst das hier laufen.
   --------------------------------------------------------------------- */
'use strict';
const path = require('path');
const base = path.join(__dirname, '..', 'src');
['util', 'data', 'state', 'crew', 'ops', 'empire', 'economy', 'rivals', 'events', 'progress', 'save', 'sim']
  .forEach(m => require(path.join(base, m + '.js')));

const { util: U, state: St, data: D, sim: Sim, ops: Ops, crew: Crew, empire: Emp } = globalThis.CE;

const weeks = parseInt(process.argv[2] || '104', 10);
const seed = parseInt(process.argv[3] || '12345', 10);
const quiet = process.argv.includes('--leise');

const s = St.newGame({ seed, name: 'Sim' });
Sim.bootstrap(s);
const rng = new U.Rng(seed ^ 0x5f3759df);

/* --- Politik des Spielers ------------------------------------------- */

function takeOps() {
  const free = Ops.available(s).filter(c => !c.post);
  if (!free.length) return;
  const offers = Ops.allOffers(s)
    .map(o => {
      const crew = free.slice(0, o.crewNeed);
      const p = Ops.odds(s, o, crew.map(c => c.id));
      return { o, crew, p, ev: o.pay * p - o.pay * 0.2 * (1 - p) };
    })
    .filter(x => x.p > 0.55)
    .sort((a, b) => b.ev - a.ev);
  for (const cand of offers) {
    const stillFree = Ops.available(s).filter(c => !c.post);
    if (stillFree.length < cand.o.crewNeed) break;
    Ops.start(s, cand.o.id, stillFree.slice(0, cand.o.crewNeed).map(c => c.id));
  }
}

function spend() {
  const d = St.derive(s);
  /* Hitze zuerst - sie frisst alles andere auf. */
  if (s.heat > 62) {
    const acts = Emp.heatActions(s);
    const a = s.cash > acts[1].cost * 2 ? acts[1] : acts[2];
    Emp.doHeatAction(s, a.id);
  }
  /* Personal, solange Platz und Geld da sind. */
  const paid = s.crew.filter(c => !c.player).length;
  if (paid < d.crewCap && s.recruits.length && s.cash > 15000) {
    const best = s.recruits.slice().sort((a, b) => (b.skill * 100 - b.ask) - (a.skill * 100 - a.ask))[0];
    Crew.hire(s, best.id, best.ask);
  }
  /* Unbesetzte Posten fuellen. */
  for (const c of s.crew) {
    if (c.player || c.post) continue;
    const role = D.byId(D.ROLES, c.role);
    if (role.slot !== 'business') continue;
    for (const b of s.businesses) {
      if (Crew.assign(s, c.id, b.id).ok) break;
    }
  }
  /* Bezirk oeffnen, wenn bezahlbar. */
  for (const dist of D.DISTRICTS) {
    const can = Emp.canOpenDistrict(s, dist.id);
    if (can.ok && s.cash > can.cost * 2.6) { Emp.openDistrict(s, dist.id); break; }
  }
  /* Bester Betrieb, den man sich gut leisten kann. */
  let best = null;
  for (const k in s.districts) {
    if (!s.districts[k].open) continue;
    for (const def of D.BUSINESSES) {
      const can = Emp.canBuy(s, k, def.id);
      if (!can.ok || s.cash < can.cost * 1.9) continue;
      const score = (def.income * (def.legal ? 1 : 0.8)) / can.cost;
      if (!best || score > best.score) best = { k, id: def.id, score, cost: can.cost };
    }
  }
  if (best) Emp.buy(s, best.k, best.id);
  /* Ausbauen, wenn reichlich Geld da ist. */
  if (s.businesses.length) {
    const b = s.businesses.slice().sort((a, b2) => a.level - b2.level)[0];
    const can = Emp.canUpgrade(s, b.id);
    if (can.ok && s.cash > can.cost * 3.2) Emp.upgrade(s, b.id);
  }
  /* Organisation ausbauen. */
  for (const up of D.ORG_UPGRADES) {
    const can = Emp.canUpgradeOrg(s, up.id);
    if (can.ok && s.cash > can.cost * 4) { Emp.upgradeOrg(s, up.id); break; }
  }
}

/* --- Lauf ------------------------------------------------------------ */

let bankrupt = 0, maxHeat = 0, events = 0;
const marks = [];
for (let day = 0; day < weeks * 7; day++) {
  if (s.event) { Sim.choose(s, firstOpen(s.event)); events++; }
  takeOps();
  if (day % 3 === 0) spend();
  Sim.advanceDay(s);
  if (s.event) { Sim.choose(s, firstOpen(s.event)); events++; }
  if (s.cash < 0) bankrupt++;
  if (s.heat > maxHeat) maxHeat = s.heat;
  if (s.day % 28 === 0) {
    const d = St.derive(s);
    marks.push({ week: U.weekOf(s.day), cash: s.cash, worth: d.netWorth, rank: d.rankName,
      biz: s.businesses.length, crew: s.crew.length - 1, heat: s.heat, rep: s.rep,
      infl: d.totalInfluence, net: d.net });
  }
}

function firstOpen(ev) {
  for (let i = 0; i < ev.options.length; i++) if (!ev.options[i].disabled) return i;
  return 0;
}

if (!quiet) {
  console.log('CRIME EMPIRE - Simulation, Seed ' + seed + ', ' + weeks + ' Wochen\n');
  console.log('Woche   Bargeld     Vermoegen   Netto/W   Betr  Crew  Hitze  Ruf  Einfl  Rang');
  for (const m of marks) {
    console.log(
      String(m.week).padStart(5) + '  ' +
      U.money(m.cash).padStart(10) + '  ' +
      U.money(m.worth).padStart(11) + '  ' +
      U.money(m.net).padStart(8) + '  ' +
      String(m.biz).padStart(4) + '  ' +
      String(m.crew).padStart(4) + '  ' +
      m.heat.toFixed(0).padStart(5) + '  ' +
      m.rep.toFixed(0).padStart(3) + '  ' +
      m.infl.toFixed(0).padStart(5) + '  ' + m.rank);
  }
  const d = St.derive(s);
  console.log('\nErfolge: ' + globalThis.CE.progress.earned(s).length + '/' + D.ACHIEVEMENTS.length +
    '   Ereignisse: ' + events + '   Auftraege: ' + s.stats.opsWon + '/' + s.stats.opsRun +
    '   Razzien: ' + s.stats.raids + '   Strafen: ' + s.stats.fines);
  console.log('Tage im Minus: ' + bankrupt + '   hoechste Hitze: ' + maxHeat.toFixed(0));
  console.log('Rivalen: ' + s.rivals.map(r =>
    D.byId(D.RIVALS, r.id).name.split(' ').pop() + ' ' + globalThis.CE.rivals.totalInfl(r).toFixed(0) +
    '/' + r.relation.toFixed(0)).join('  '));
}

module.exports = { state: s, marks };
