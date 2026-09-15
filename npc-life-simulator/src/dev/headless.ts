/**
 * Headless simulation harness. Runs the engine without React so the simulation
 * can be profiled and validated on its own:
 *   npm run simtest -- [years] [population] [seed]
 */
import { SimulationEngine } from '../simulation/SimulationEngine';
import { formatDate, DAYS_PER_YEAR } from '../time/calendar';
import { fullName } from '../npc/NPCFactory';
import type { Speed } from '../time/SimulationClock';

const years = Number(process.argv[2] ?? 5);
const population = Number(process.argv[3] ?? 1200);
const seed = Number(process.argv[4] ?? 847291);
const speed = 500 as Speed;

console.log(`\n=== NPC-Life Simulator · Headless-Test ===`);
console.log(`Seed ${seed} · Startbevölkerung ${population} · Zeitraum ${years} Jahre\n`);

const t0 = performance.now();
const engine = SimulationEngine.create({ seed, population });
const buildMs = performance.now() - t0;

console.log(`Stadt: ${engine.world.name}`);
console.log(`  Aufbau:        ${buildMs.toFixed(0)} ms`);
console.log(`  Gebäude:       ${engine.world.buildings.length}`);
console.log(`  Stadtteile:    ${engine.world.districts.length}`);
console.log(`  Unternehmen:   ${engine.companies.length}`);
console.log(`  NPCs:          ${engine.aliveIds.length}`);
console.log(`  Beziehungen:   ${engine.rels.size}`);
const s0 = engine.stats;
console.log(
  `  Start: Ø Alter ${s0.averageAge.toFixed(1)} · Arbeitslosigkeit ${(s0.unemploymentRate * 100).toFixed(1)}% · Ø Einkommen ${Math.round(s0.averageIncome)} €`,
);
console.log(`  Obdachlos: ${s0.homeless} · Paare: ${s0.couples} · verheiratet: ${s0.married}\n`);

engine.setSpeed(speed);

const targetDays = years * DAYS_PER_YEAR;
const startDay = engine.day;
let ticks = 0;
let maxTick = 0;
let lastReportYear = -1;
const tickStart = performance.now();

while (engine.day - startDay < targetDays) {
  const t = performance.now();
  engine.tick();
  const dt = performance.now() - t;
  if (dt > maxTick) maxTick = dt;
  ticks++;

  const elapsedYears = Math.floor((engine.day - startDay) / DAYS_PER_YEAR);
  if (elapsedYears !== lastReportYear) {
    lastReportYear = elapsedYears;
    const s = engine.stats;
    console.log(
      `${formatDate(engine.day).padEnd(20)} ` +
        `Bev. ${String(s.population).padStart(5)} · ` +
        `Ø${s.averageAge.toFixed(1)} J · ` +
        `Arbeitslos ${(s.unemploymentRate * 100).toFixed(1)}% · ` +
        `Ø Verm. ${Math.round(s.totalWealth / Math.max(1, s.population)).toLocaleString('de-DE')} € · ` +
        `Glück ${s.avgHappiness.toFixed(0)} · ` +
        `Firmen ${s.companiesActive} · ` +
        `Storys ${engine.stories.stories.length}`,
    );
  }
  if (ticks > 400000) {
    console.log('Abbruch: Tick-Limit erreicht.');
    break;
  }
}

const totalMs = performance.now() - tickStart;
const s = engine.stats;

console.log(`\n--- Ergebnis nach ${years} simulierten Jahren ---`);
console.log(`  Bevölkerung:       ${s.population} (Start ${population})`);
console.log(`  Geburten (Jahr):   ${s.birthsThisYear}`);
console.log(`  Todesfälle (Jahr): ${s.deathsThisYear}`);
console.log(`  Ø Alter:           ${s.averageAge.toFixed(1)}`);
console.log(`  Kinder / Senioren: ${s.children} / ${s.seniors}`);
console.log(`  Arbeitslosenquote: ${(s.unemploymentRate * 100).toFixed(1)} %`);
console.log(`  Ø Einkommen:       ${Math.round(s.averageIncome).toLocaleString('de-DE')} €`);
console.log(`  Median-Vermögen:   ${Math.round(s.medianWealth).toLocaleString('de-DE')} €`);
console.log(`  Obdachlos:         ${s.homeless}`);
console.log(`  Paare / Ehen:      ${s.couples} / ${s.married}`);
console.log(`  Beziehungen:       ${s.relationships} (Ø ${s.avgFriends.toFixed(1)} Kontakte)`);
console.log(`  Unternehmen:       ${s.companiesActive} aktiv, ${s.companiesBankrupt} insolvent`);
console.log(`  Wirtschaftslage:   ${s.economyHealth.toFixed(0)}/100 · Inflation ${s.inflation.toFixed(2)} %`);
console.log(`  Ø Glück / Stress:  ${s.avgHappiness.toFixed(0)} / ${s.avgStress.toFixed(0)}`);
console.log(`  Gesamt-NPCs:       ${engine.npcs.length} (inkl. Verstorbene)`);

const li = engine.ledger.lastMonthIncome;
const ls = engine.ledger.lastMonthSpend;
const inTotal = Object.values(li).reduce((a, b) => a + b, 0);
const outTotal = Object.values(ls).reduce((a, b) => a + b, 0);
console.log(`\n--- Haushaltsbilanz der Stadt (letzter voller Monat) ---`);
console.log(`  Einnahmen ${Math.round(inTotal).toLocaleString('de-DE').padStart(12)} €`);
for (const [k, v] of Object.entries(li)) {
  if (v > 0) console.log(`    ${k.padEnd(14)} ${Math.round(v).toLocaleString('de-DE').padStart(12)} €`);
}
console.log(`  Ausgaben  ${Math.round(outTotal).toLocaleString('de-DE').padStart(12)} €`);
for (const [k, v] of Object.entries(ls)) {
  if (v > 0) console.log(`    ${k.padEnd(14)} ${Math.round(v).toLocaleString('de-DE').padStart(12)} €`);
}
console.log(`  Saldo pro Kopf und Monat: ${Math.round((inTotal - outTotal) / Math.max(1, s.population)).toLocaleString('de-DE')} €`);

const needTotals = {
  hunger: 0, energy: 0, hygiene: 0, social: 0, fun: 0, comfort: 0, safety: 0, stress: 0,
};
for (const id of engine.aliveIds) {
  const n = engine.npcs[id].needs;
  for (const k of Object.keys(needTotals) as (keyof typeof needTotals)[]) needTotals[k] += n[k];
}
let slots = 0;
let filled = 0;
for (const c of engine.companies) {
  if (c.bankrupt) continue;
  for (const pos of c.positions) {
    slots += pos.max;
    filled += pos.filled;
  }
}
console.log(`\n--- Arbeitsmarkt ---`);
console.log(`  Stellen gesamt:    ${slots}`);
console.log(`  davon besetzt:     ${filled}`);
console.log(`  Erwerbsfähige:     ${s.workingAge}`);
console.log(`  Stellen je Person: ${(slots / Math.max(1, s.workingAge)).toFixed(2)}`);

console.log(`\n--- Durchschnittliche Bedürfnisse (0-100) ---`);
console.log(
  '  ' +
    Object.entries(needTotals)
      .map(([k, v]) => `${k} ${(v / Math.max(1, s.population)).toFixed(0)}`)
      .join(' · '),
);

console.log(`\n--- Aktivitätsverteilung ---`);
const totalActions = Object.values(engine.actionCounts).reduce((a, b) => a + b, 0);
const sortedActions = Object.entries(engine.actionCounts).sort((a, b) => b[1] - a[1]);
for (const [name, n] of sortedActions) {
  const share = ((n / totalActions) * 100).toFixed(1);
  console.log(`  ${name.padEnd(14)} ${String(n).padStart(9)}  ${share.padStart(5)} %`);
}

console.log(`\n--- Performance ---`);
console.log(`  Ticks:             ${ticks}`);
console.log(`  Gesamtzeit:        ${(totalMs / 1000).toFixed(2)} s`);
console.log(`  Ø Tick:            ${(totalMs / ticks).toFixed(2)} ms`);
console.log(`  Max. Tick:         ${maxTick.toFixed(2)} ms`);
console.log(`  Entscheidungen:    ${engine.perf.decisionsTotal.toLocaleString('de-DE')}`);
console.log(`  Entsch./Sekunde:   ${Math.round(engine.perf.decisionsTotal / (totalMs / 1000)).toLocaleString('de-DE')}`);
console.log(`  Sim-Jahre/Sekunde: ${(years / (totalMs / 1000)).toFixed(2)}`);

console.log(`\n--- Beispielgeschichten ---`);
for (const story of engine.stories.stories.slice(0, 3)) {
  console.log(`\n  „${story.title}“ (${formatDate(story.startDay, true)} – ${formatDate(story.endDay, true)})`);
  console.log(`  ${story.summary}`);
}

console.log(`\n--- Reichste Einwohner ---`);
for (const t of s.topRich.slice(0, 5)) {
  const npc = engine.npcs[t.id];
  console.log(
    `  ${fullName(npc).padEnd(24)} ${String(npc.ageYears).padStart(3)} J · ` +
      `${Math.round(t.value).toLocaleString('de-DE').padStart(12)} €`,
  );
}

console.log(`\n--- Letzte Ereignisse ---`);
for (const e of engine.events.recent(8, 40)) {
  console.log(`  ${formatDate(e.day, true).padEnd(14)} ${e.text}`);
}
console.log();

// Sanity checks so a broken build fails loudly instead of silently.
const problems: string[] = [];
if (s.population < population * 0.4) problems.push(`Bevölkerung kollabiert (${s.population})`);
if (s.population > population * 3) problems.push(`Bevölkerungsexplosion (${s.population})`);
if (s.unemploymentRate > 0.45) problems.push(`Arbeitslosigkeit unrealistisch (${(s.unemploymentRate * 100).toFixed(0)}%)`);
if (s.homeless > s.population * 0.25) problems.push(`Zu viele Obdachlose (${s.homeless})`);
if (s.averageAge < 12 || s.averageAge > 70) problems.push(`Ø Alter unplausibel (${s.averageAge.toFixed(1)})`);
if (engine.stories.stories.length === 0) problems.push('Keine emergenten Storys entstanden');
if (s.companiesActive < 10) problems.push(`Zu wenige Unternehmen (${s.companiesActive})`);

if (problems.length) {
  console.log('⚠  Auffälligkeiten:');
  for (const p of problems) console.log('   - ' + p);
  process.exitCode = 1;
} else {
  console.log('✓ Alle Plausibilitätsprüfungen bestanden.');
}
